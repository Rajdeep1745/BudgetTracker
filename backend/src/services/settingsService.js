import { pool } from "../db.js";
import { toMonth } from "../utils/dates.js";

export async function getSettings(month) {
  const [settingsResult, fixedCostsResult] = await Promise.all([
    pool.query(
      "SELECT carry_in_enabled FROM app_settings WHERE id = 1",
    ),
    pool.query(
      `SELECT id, name
       FROM budget_fixed_cost_types
       WHERE created_month <= $1::date
         AND (archived_month IS NULL OR archived_month > $1::date)
       ORDER BY name`,
      [toMonth(month)],
    ),
  ]);

  return {
    carryInEnabled: settingsResult.rows[0]?.carry_in_enabled ?? true,
    fixedCosts: fixedCostsResult.rows,
  };
}

export async function createFixedCost({ name, effectiveMonth }) {
  const result = await pool.query(
    `INSERT INTO budget_fixed_cost_types (name, created_month)
     VALUES ($1, $2::date)
     RETURNING id, name`,
    [name, toMonth(effectiveMonth)],
  );
  return result.rows[0];
}

export async function deleteFixedCost(id, effectiveMonth) {
  const month = toMonth(effectiveMonth);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE budget_fixed_cost_types
       SET archived_month = $2::date
       WHERE id = $1 AND archived_month IS NULL
       RETURNING id, name`,
      [id, month],
    );

    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `DELETE FROM monthly_budget_fixed_costs
       WHERE fixed_cost_type_id = $1
         AND monthly_budget_id IN (
           SELECT id FROM monthly_budgets WHERE month >= $2::date
         )`,
      [id, month],
    );
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setCarryInEnabled(enabled, effectiveMonth) {
  const month = toMonth(effectiveMonth);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO app_settings (id, carry_in_enabled)
       VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE
       SET carry_in_enabled = EXCLUDED.carry_in_enabled`,
      [enabled],
    );
    await client.query(
      `UPDATE monthly_budgets
       SET carry_in_enabled = $1
       WHERE month >= $2::date`,
      [enabled, month],
    );
    await client.query("COMMIT");
    return { carryInEnabled: enabled };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
