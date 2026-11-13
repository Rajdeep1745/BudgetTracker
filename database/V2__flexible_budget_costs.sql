BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS carry_in_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE monthly_budgets
  ADD COLUMN IF NOT EXISTS carry_in_enabled BOOLEAN NOT NULL DEFAULT TRUE;

INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS budget_fixed_cost_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_month DATE NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date
    CHECK (date_trunc('month', created_month) = created_month),
  archived_month DATE
    CHECK (archived_month IS NULL OR date_trunc('month', archived_month) = archived_month)
);

CREATE UNIQUE INDEX IF NOT EXISTS budget_fixed_cost_types_active_name_idx
  ON budget_fixed_cost_types (lower(name))
  WHERE archived_month IS NULL;

CREATE TABLE IF NOT EXISTS monthly_budget_fixed_costs (
  monthly_budget_id UUID NOT NULL
    REFERENCES monthly_budgets(id) ON DELETE CASCADE,
  fixed_cost_type_id UUID NOT NULL
    REFERENCES budget_fixed_cost_types(id) ON DELETE RESTRICT,
  name_snapshot TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  PRIMARY KEY (monthly_budget_id, fixed_cost_type_id)
);

CREATE INDEX IF NOT EXISTS monthly_budget_fixed_costs_type_idx
  ON monthly_budget_fixed_costs (fixed_cost_type_id, monthly_budget_id);

INSERT INTO budget_fixed_cost_types (id, name, created_month) VALUES
  ('00000000-0000-4000-8000-000000000001', 'Rent', DATE '0001-01-01'),
  ('00000000-0000-4000-8000-000000000002', 'Didi fees', DATE '0001-01-01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO monthly_budget_fixed_costs
  (monthly_budget_id, fixed_cost_type_id, name_snapshot, amount)
SELECT budgets.id, cost_types.id, 'Rent', budgets.rent
FROM monthly_budgets AS budgets
JOIN budget_fixed_cost_types AS cost_types
  ON cost_types.id = '00000000-0000-4000-8000-000000000001'
  AND (cost_types.archived_month IS NULL OR budgets.month < cost_types.archived_month)
ON CONFLICT (monthly_budget_id, fixed_cost_type_id) DO NOTHING;

INSERT INTO monthly_budget_fixed_costs
  (monthly_budget_id, fixed_cost_type_id, name_snapshot, amount)
SELECT budgets.id, cost_types.id, 'Didi fees', budgets.didi_fees
FROM monthly_budgets AS budgets
JOIN budget_fixed_cost_types AS cost_types
  ON cost_types.id = '00000000-0000-4000-8000-000000000002'
  AND (cost_types.archived_month IS NULL OR budgets.month < cost_types.archived_month)
ON CONFLICT (monthly_budget_id, fixed_cost_type_id) DO NOTHING;

COMMIT;
