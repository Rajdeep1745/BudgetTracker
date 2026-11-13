import { pool } from "../db.js";
import { toMonth } from "../utils/dates.js";

export async function saveBudget(budget) {
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
        toMonth(budget.month),
        budget.allowance,
        budget.personalPercent,
        budget.rent,
        budget.didiFees,
        budget.carryIn,
        budget.savingsTarget,
      ],
    );
    await client.query(
      `INSERT INTO app_settings (id, total_saved) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET total_saved = EXCLUDED.total_saved`,
      [budget.alreadySaved],
    );
    await client.query("COMMIT");
    return { ...result.rows[0], alreadySaved: budget.alreadySaved };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
