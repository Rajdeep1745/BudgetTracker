CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  group_name TEXT NOT NULL CHECK (group_name IN ('Personal', 'Household')),
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE monthly_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL CHECK (date_trunc('month', month) = month),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  personal_percent NUMERIC(5,2) NOT NULL CHECK (personal_percent >= 0 AND personal_percent <= 100),
  carry_in NUMERIC(12,2) NOT NULL DEFAULT 0,
  carry_in_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  savings_target NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (savings_target >= 0),
  UNIQUE(month)
);

CREATE TABLE app_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total_saved NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_saved >= 0),
  carry_in_enabled BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO app_settings (id, carry_in_enabled)
VALUES (1, TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE budget_fixed_cost_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_month DATE NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date
    CHECK (date_trunc('month', created_month) = created_month),
  archived_month DATE
    CHECK (archived_month IS NULL OR date_trunc('month', archived_month) = archived_month)
);

CREATE UNIQUE INDEX budget_fixed_cost_types_active_name_idx
  ON budget_fixed_cost_types (lower(name))
  WHERE archived_month IS NULL;

CREATE TABLE monthly_budget_fixed_costs (
  monthly_budget_id UUID NOT NULL
    REFERENCES monthly_budgets(id) ON DELETE CASCADE,
  fixed_cost_type_id UUID NOT NULL
    REFERENCES budget_fixed_cost_types(id) ON DELETE RESTRICT,
  name_snapshot TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  PRIMARY KEY (monthly_budget_id, fixed_cost_type_id)
);

CREATE INDEX monthly_budget_fixed_costs_type_idx
  ON monthly_budget_fixed_costs (fixed_cost_type_id, monthly_budget_id);

INSERT INTO budget_fixed_cost_types (id, name, created_month) VALUES
  ('00000000-0000-4000-8000-000000000001', 'Rent', DATE '0001-01-01'),
  ('00000000-0000-4000-8000-000000000002', 'Didi fees', DATE '0001-01-01');

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  transaction_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX transactions_date_idx ON transactions(transaction_date);
CREATE INDEX transactions_category_idx ON transactions(category_id);
CREATE INDEX transactions_recent_idx
  ON transactions(transaction_date DESC, created_at DESC, id DESC);
CREATE INDEX transactions_category_recent_idx
  ON transactions(category_id, transaction_date DESC, created_at DESC, id DESC);
CREATE INDEX transactions_amount_idx ON transactions(amount);

INSERT INTO categories (name, group_name, color) VALUES
  ('Food', 'Personal', '#8b5cf6'),
  ('Vegetables', 'Household', '#22c55e'),
  ('Meat', 'Household', '#14b8a6'),
  ('Fish', 'Household', '#0ea5e9'),
  ('Groceries', 'Household', '#10b981'),
  ('Transportation', 'Personal', '#f97316'),
  ('Medical', 'Personal', '#ef4444'),
  ('Entertainment', 'Personal', '#a855f7'),
  ('Shopping', 'Personal', '#ec4899'),
  ('Education', 'Personal', '#6366f1'),
  ('Bills', 'Household', '#64748b'),
  ('Gifts', 'Personal', '#f59e0b'),
  ('Miscellaneous', 'Personal', '#78716c')
ON CONFLICT (name) DO UPDATE SET
  group_name = EXCLUDED.group_name,
  color = EXCLUDED.color;

UPDATE transactions t
SET category_id = target.id
FROM categories legacy
JOIN categories target ON target.name = CASE legacy.name
  WHEN 'Dining & outings' THEN 'Food'
  WHEN 'Transport' THEN 'Transportation'
  WHEN 'Household essentials' THEN 'Groceries'
END
WHERE t.category_id = legacy.id
  AND legacy.name IN ('Dining & outings', 'Transport', 'Household essentials');

DELETE FROM categories
WHERE name IN ('Dining & outings', 'Transport', 'Household essentials');
