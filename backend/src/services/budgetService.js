import { pool } from "../db.js";
import { toMonth } from "../utils/dates.js";

export async function saveBudget(budget) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO monthly_budgets
         (month, total_amount, personal_percent, carry_in,
          carry_in_enabled, savings_target)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (month) DO UPDATE SET
         total_amount = EXCLUDED.total_amount,
         personal_percent = EXCLUDED.personal_percent,
         carry_in = EXCLUDED.carry_in,
         carry_in_enabled = EXCLUDED.carry_in_enabled,
         savings_target = EXCLUDED.savings_target
       RETURNING id, month, total_amount AS allowance,
         personal_percent AS "personalPercent", carry_in AS "carryIn",
         carry_in_enabled AS "carryInEnabled",
         savings_target AS "savingsTarget"`,
      [
        toMonth(budget.month),
        budget.allowance,
        budget.personalPercent,
        budget.carryIn,
        budget.carryInEnabled,
        budget.savingsTarget,
      ],
    );

    const fixedCostIds = budget.fixedCosts.map((cost) => cost.id);
    const validFixedCosts = await client.query(
      `SELECT id
       FROM budget_fixed_cost_types
       WHERE id = ANY($1::uuid[])
         AND created_month <= $2::date
         AND (archived_month IS NULL OR archived_month > $2::date)
       FOR SHARE`,
      [fixedCostIds, toMonth(budget.month)],
    );
    if (validFixedCosts.rowCount !== fixedCostIds.length) {
      const error = new Error(
        "One or more fixed costs are unavailable for this month.",
      );
      error.statusCode = 400;
      throw error;
    }

    await client.query(
      "DELETE FROM monthly_budget_fixed_costs WHERE monthly_budget_id = $1",
      [result.rows[0].id],
    );
    if (budget.fixedCosts.length > 0) {
      await client.query(
        `INSERT INTO monthly_budget_fixed_costs
           (monthly_budget_id, fixed_cost_type_id, name_snapshot, amount)
         SELECT $1, types.id, types.name, requested.amount
         FROM unnest($2::uuid[], $3::numeric[])
           AS requested(fixed_cost_type_id, amount)
         JOIN budget_fixed_cost_types AS types
           ON types.id = requested.fixed_cost_type_id`,
        [
          result.rows[0].id,
          budget.fixedCosts.map((cost) => cost.id),
          budget.fixedCosts.map((cost) => cost.amount),
        ],
      );
    }

    await client.query(
      `INSERT INTO app_settings (id, total_saved) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET total_saved = EXCLUDED.total_saved`,
      [budget.alreadySaved],
    );
    await client.query("COMMIT");
    return {
      ...result.rows[0],
      fixedCosts: budget.fixedCosts,
      alreadySaved: budget.alreadySaved,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
