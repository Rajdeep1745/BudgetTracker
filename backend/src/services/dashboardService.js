import { pool } from "../db.js";
import { toMonth } from "../utils/dates.js";

export async function getDashboard(month) {
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
    `SELECT total_amount, personal_percent, carry_in, carry_in_enabled,
      savings_target
     FROM monthly_budgets WHERE month = $1::date`,
    [toMonth(month)],
  );
  const settingsResult = await pool.query(
    "SELECT total_saved, carry_in_enabled FROM app_settings WHERE id = 1",
  );
  const fixedCostsResult = await pool.query(
    `SELECT fixed_cost_type_id AS id, name_snapshot AS name,
       amount::float AS amount
     FROM monthly_budget_fixed_costs
     WHERE monthly_budget_id = (
       SELECT id FROM monthly_budgets WHERE month = $1::date
     )
     UNION ALL
     SELECT types.id, types.name, 0::float AS amount
     FROM budget_fixed_cost_types AS types
     WHERE types.created_month <= $1::date
       AND (types.archived_month IS NULL OR types.archived_month > $1::date)
       AND NOT EXISTS (
         SELECT 1
         FROM monthly_budget_fixed_costs AS saved_costs
         JOIN monthly_budgets AS saved_budget
           ON saved_budget.id = saved_costs.monthly_budget_id
         WHERE saved_budget.month = $1::date
           AND saved_costs.fixed_cost_type_id = types.id
       )
     ORDER BY name`,
    [toMonth(month)],
  );
  const budget = budgetResult.rows[0];
  const totalSaved = Number(settingsResult.rows[0]?.total_saved ?? 0);
  const fixedCosts = fixedCostsResult.rows.map((cost) => ({
    ...cost,
    amount: Number(cost.amount),
  }));
  const fixedCostTotal = fixedCosts.reduce((total, cost) => total + cost.amount, 0);
  const allowance = Number(budget?.total_amount ?? 0);
  const personalPercent = Number(budget?.personal_percent ?? 40);
  const carryIn = Number(budget?.carry_in ?? 0);
  const carryInEnabled = Boolean(
    budget?.carry_in_enabled ??
      settingsResult.rows[0]?.carry_in_enabled ??
      true,
  );
  const savingsTarget = Number(budget?.savings_target ?? 0);
  const effectiveAllowance =
    allowance - fixedCostTotal + (carryInEnabled ? carryIn : 0);
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
  const groups = ["Personal", "Household"].map((name) => {
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
     FROM transactions
     WHERE transaction_date >= $1::date
       AND transaction_date < ($1::date + INTERVAL '1 month')
     GROUP BY transaction_date
     ORDER BY transaction_date`,
    [toMonth(month)],
  );
  const groupDaily = await pool.query(
    `SELECT c.group_name, t.transaction_date::text AS date,
      SUM(t.amount)::float AS amount
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.transaction_date >= $1::date
       AND t.transaction_date < ($1::date + INTERVAL '1 month')
     GROUP BY c.group_name, t.transaction_date
     ORDER BY c.group_name, t.transaction_date`,
    [toMonth(month)],
  );
  const spent = rows.reduce((total, category) => total + category.spent, 0);

  return {
    month,
    totals: {
      budget: spendableBudget,
      spent,
      remaining: Math.max(spendableBudget - spent, 0),
    },
    budget: {
      allowance,
      fixedCosts,
      fixedCostTotal,
      carryIn,
      carryInEnabled,
      alreadySaved: totalSaved,
      savingsTarget,
      effectiveAllowance,
      spendableBudget,
      personalPercent,
    },
    groups,
    categories: rows,
    daily: daily.rows,
    groupDaily: groupDaily.rows,
  };
}
