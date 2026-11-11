import express from "express";
import cors from "cors";
import { z } from "zod";
import { pool } from "./db.js";

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3100")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
const monthPattern = /^\d{4}-\d{2}$/;
const toMonth = (value) => `${value}-01`;

app.get("/api/health", (_, res) => res.json({ ok: true }));
app.get("/api/categories", async (_, res, next) => {
  try {
    res.json(
      (await pool.query("SELECT * FROM categories ORDER BY group_name, name"))
        .rows,
    );
  } catch (e) {
    next(e);
  }
});
app.get("/api/dashboard", async (req, res, next) => {
  const month = String(req.query.month || new Date().toISOString().slice(0, 7));
  if (!monthPattern.test(month))
    return res.status(400).json({ error: "month must be YYYY-MM" });
  try {
    const { rows } = await pool.query(
      `
      SELECT c.id, c.name, c.group_name, c.color,
        COALESCE(SUM(t.amount), 0)::float AS spent
      FROM categories c
      LEFT JOIN transactions t ON t.category_id = c.id
        AND t.transaction_date >= $1::date
        AND t.transaction_date < ($1::date + INTERVAL '1 month')
      GROUP BY c.id
      ORDER BY c.group_name, c.name`,
      [toMonth(month)],
    );
    const budgetResult = await pool.query(
      `SELECT total_amount, personal_percent, rent, didi_fees, carry_in,
        savings_target
       FROM monthly_budgets WHERE month = $1::date`,
      [toMonth(month)],
    );
    const settingsResult = await pool.query(
      "SELECT total_saved FROM app_settings WHERE id = 1",
    );
    const budget = budgetResult.rows[0];
    const totalSaved = Number(settingsResult.rows[0]?.total_saved ?? 0);
    const allowance = Number(budget?.total_amount ?? 0);
    const personalPercent = Number(budget?.personal_percent ?? 40);
    const rent = Number(budget?.rent ?? 0);
    const didiFees = Number(budget?.didi_fees ?? 0);
    const carryIn = Number(budget?.carry_in ?? 0);
    const savingsTarget = Number(budget?.savings_target ?? 0);
    const effectiveAllowance = allowance - rent - didiFees + carryIn;
    const spendableBudget = effectiveAllowance - savingsTarget;
    const allocationBase = Math.max(spendableBudget, 0);
    const spentByGroup = rows.reduce(
      (totals, category) => ({
        ...totals,
        [category.group_name]:
          (totals[category.group_name] ?? 0) + category.spent,
      }),
      {},
    );
    const groups = ["Personal", "Grocery"].map((name) => {
      const groupBudget =
        name === "Personal"
          ? (allocationBase * personalPercent) / 100
          : (allocationBase * (100 - personalPercent)) / 100;
      const spent = spentByGroup[name] ?? 0;
      return {
        name,
        budget: groupBudget,
        spent,
        remaining: Math.max(groupBudget - spent, 0),
        percent: name === "Personal" ? personalPercent : 100 - personalPercent,
      };
    });
    const daily = await pool.query(
      `SELECT transaction_date::text AS date, SUM(amount)::float AS amount
      FROM transactions WHERE transaction_date >= $1::date AND transaction_date < ($1::date + INTERVAL '1 month')
      GROUP BY transaction_date ORDER BY transaction_date`,
      [toMonth(month)],
    );
    const spent = rows.reduce((total, category) => total + category.spent, 0);
    res.json({
      month,
      totals: {
        budget: spendableBudget,
        spent,
        remaining: Math.max(spendableBudget - spent, 0),
      },
      budget: {
        allowance,
        rent,
        didiFees,
        carryIn,
        alreadySaved: totalSaved,
        savingsTarget,
        effectiveAllowance,
        spendableBudget,
        personalPercent,
      },
      groups,
      categories: rows,
      daily: daily.rows,
    });
  } catch (e) {
    next(e);
  }
});
app.get("/api/transactions", async (req, res, next) => {
  const month = String(req.query.month || new Date().toISOString().slice(0, 7));
  try {
    res.json(
      (
        await pool.query(
          `SELECT t.*, c.name AS category_name, c.group_name, c.color FROM transactions t JOIN categories c ON c.id=t.category_id WHERE t.transaction_date >= $1::date AND t.transaction_date < ($1::date + INTERVAL '1 month') ORDER BY t.transaction_date DESC, t.created_at DESC`,
          [toMonth(month)],
        )
      ).rows,
    );
  } catch (e) {
    next(e);
  }
});
const transactionSchema = z.object({
  categoryId: z.string().uuid(),
  description: z.string().trim().max(140).optional().default(""),
  amount: z.coerce.number().positive(),
  transactionDate: z.string().date(),
});
app.post("/api/transactions", async (req, res, next) => {
  try {
    const x = transactionSchema.parse(req.body);
    const result = await pool.query(
      "INSERT INTO transactions (category_id, description, amount, transaction_date) VALUES ($1,$2,$3,$4) RETURNING *",
      [x.categoryId, x.description, x.amount, x.transactionDate],
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    next(e);
  }
});
app.delete("/api/transactions/:id", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM transactions WHERE id=$1", [req.params.id]);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
const budgetSchema = z.object({
  month: z.string().regex(monthPattern),
  allowance: z.coerce.number().finite().min(0),
  personalPercent: z.coerce.number().finite().min(0).max(100),
  rent: z.coerce.number().finite().min(0),
  didiFees: z.coerce.number().finite().min(0),
  carryIn: z.coerce.number().finite(),
  alreadySaved: z.coerce.number().finite().min(0),
  savingsTarget: z.coerce.number().finite().min(0),
});
app.put("/api/budgets", async (req, res, next) => {
  try {
    const x = budgetSchema.parse(req.body);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `INSERT INTO monthly_budgets
           (month, total_amount, personal_percent, rent, didi_fees, carry_in,
            savings_target)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (month) DO UPDATE SET
           total_amount = EXCLUDED.total_amount,
           personal_percent = EXCLUDED.personal_percent,
           rent = EXCLUDED.rent,
           didi_fees = EXCLUDED.didi_fees,
           carry_in = EXCLUDED.carry_in,
           savings_target = EXCLUDED.savings_target
         RETURNING month, total_amount AS allowance,
           personal_percent AS "personalPercent", rent,
           didi_fees AS "didiFees", carry_in AS "carryIn",
           savings_target AS "savingsTarget"`,
        [
          toMonth(x.month),
          x.allowance,
          x.personalPercent,
          x.rent,
          x.didiFees,
          x.carryIn,
          x.savingsTarget,
        ],
      );
      await client.query(
        `INSERT INTO app_settings (id, total_saved) VALUES (1, $1)
         ON CONFLICT (id) DO UPDATE SET total_saved = EXCLUDED.total_saved`,
        [x.alreadySaved],
      );
      await client.query("COMMIT");
      res.json({ ...result.rows[0], alreadySaved: x.alreadySaved });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (e) {
    next(e);
  }
});
app.use((err, _, res, __) => {
  console.error(err);
  res.status(err instanceof z.ZodError ? 400 : 500).json({
    error: err instanceof z.ZodError ? err.issues[0].message : "Server error",
  });
});
app.listen(process.env.PORT || 3101, () => console.log("Budget API listening"));
