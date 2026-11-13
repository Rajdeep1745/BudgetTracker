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
  if (filters.from)
    addCondition("t.transaction_date >= ?::date", filters.from);
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
  const result = await pool.query(
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
  return result.rows[0];
}

export async function updateTransaction(id, transaction) {
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
}

export async function deleteTransaction(id) {
  await pool.query("DELETE FROM transactions WHERE id = $1", [id]);
}
