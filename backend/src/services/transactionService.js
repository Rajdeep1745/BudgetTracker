import { pool } from "../db.js";
import { toMonth } from "../utils/dates.js";

export async function listTransactions(month, filters) {
  const values = [toMonth(month)];
  const conditions = [
    "t.transaction_date >= $1::date",
    "t.transaction_date < ($1::date + INTERVAL '1 month')",
  ];
  const addCondition = (sql, value) => {
    values.push(value);
    conditions.push(sql.replace("?", `$${values.length}`));
  };
  if (filters.search) {
    values.push(`%${filters.search}%`);
    const parameter = `$${values.length}`;
    conditions.push(
      `(c.name ILIKE ${parameter} OR t.description ILIKE ${parameter}
        OR t.transaction_date::text ILIKE ${parameter}
        OR t.amount::text ILIKE ${parameter})`,
    );
  }
  if (filters.categoryId)
    addCondition("t.category_id = ?::uuid", filters.categoryId);
  if (filters.from) addCondition("t.transaction_date >= ?::date", filters.from);
  if (filters.to) addCondition("t.transaction_date <= ?::date", filters.to);

  const where = conditions.join(" AND ");
  const sortColumn = {
    date: "t.transaction_date",
    category: "c.name",
    description: "t.description",
    amount: "t.amount",
  }[filters.sortBy];
  const sortDirection = filters.sortDirection === "asc" ? "ASC" : "DESC";
  const [countResult, transactionsResult] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS total
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE ${where}`,
      values,
    ),
    pool.query(
      `SELECT t.id, t.category_id, t.description, t.amount,
              t.transaction_date::text AS transaction_date, t.created_at,
              c.name AS category_name, c.group_name, c.color
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE ${where}
       ORDER BY ${sortColumn} ${sortDirection},
         t.transaction_date DESC, t.created_at DESC, t.id DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, filters.pageSize, (filters.page - 1) * filters.pageSize],
    ),
  ]);
  return {
    items: transactionsResult.rows,
    total: countResult.rows[0].total,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function createTransaction(transaction) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize additions even when no transaction exists for this date yet.
    await client.query("SELECT id FROM categories WHERE id = $1 FOR UPDATE", [
      transaction.categoryId,
    ]);
    const existing = await client.query(
      `SELECT id FROM transactions
       WHERE category_id = $1 AND transaction_date = $2::date
       ORDER BY created_at, id
       FOR UPDATE`,
      [transaction.categoryId, transaction.transactionDate],
    );
    let result;
    if (existing.rows.length > 0) {
      const ids = existing.rows.map((row) => row.id);
      result = await client.query(
        `UPDATE transactions SET
           amount = (SELECT SUM(amount) FROM transactions WHERE id = ANY($2::uuid[])) + $3::numeric,
           description = concat_ws(', ',
             (SELECT string_agg(NULLIF(btrim(description), ''), ', ' ORDER BY created_at, id)
              FROM transactions WHERE id = ANY($2::uuid[])),
             NULLIF(btrim($4::text), ''))
         WHERE id = $1
         RETURNING id, category_id, description, amount,
                   transaction_date::text AS transaction_date, created_at`,
        [ids[0], ids, transaction.amount, transaction.description],
      );
      if (ids.length > 1) {
        await client.query(
          "DELETE FROM transactions WHERE id = ANY($1::uuid[])",
          [ids.slice(1)],
        );
      }
    } else {
      result = await client.query(
        `INSERT INTO transactions
       (category_id, description, amount, transaction_date)
     VALUES ($1, $2, $3, $4)
     RETURNING id, category_id, description, amount,
               transaction_date::text AS transaction_date, created_at`,
        [
          transaction.categoryId,
          transaction.description,
          transaction.amount,
          transaction.transactionDate,
        ],
      );
    }
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateTransaction(id, transaction) {
  try {
    const result = await pool.query(
      `UPDATE transactions
     SET category_id = $1, description = $2, amount = $3, transaction_date = $4
     WHERE id = $5
     RETURNING id, category_id, description, amount,
               transaction_date::text AS transaction_date, created_at`,
      [
        transaction.categoryId,
        transaction.description,
        transaction.amount,
        transaction.transactionDate,
        id,
      ],
    );
    return result.rows[0];
  } catch (error) {
    if (
      error.code === "23505" &&
      error.constraint === "transactions_category_date_uidx"
    ) {
      error.statusCode = 409;
      error.message =
        "A transaction already exists for this category and date. Edit that transaction or choose a different category or date.";
    }
    throw error;
  }
}

export async function deleteTransaction(id) {
  await pool.query("DELETE FROM transactions WHERE id = $1", [id]);
}
