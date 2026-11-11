CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  group_name TEXT NOT NULL CHECK (group_name IN ('Personal', 'Grocery')),
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE monthly_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL CHECK (date_trunc('month', month) = month),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  personal_percent NUMERIC(5,2) NOT NULL CHECK (personal_percent >= 0 AND personal_percent <= 100),
  rent NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (rent >= 0),
  didi_fees NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (didi_fees >= 0),
  carry_in NUMERIC(12,2) NOT NULL DEFAULT 0,
  savings_target NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (savings_target >= 0),
  UNIQUE(month)
);

CREATE TABLE app_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total_saved NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_saved >= 0)
);

INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE monthly_budgets
  ADD COLUMN IF NOT EXISTS rent NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (rent >= 0),
  ADD COLUMN IF NOT EXISTS didi_fees NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (didi_fees >= 0),
  ADD COLUMN IF NOT EXISTS carry_in NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS savings_target NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (savings_target >= 0);

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

INSERT INTO categories (name, group_name, color) VALUES
  ('Food', 'Personal', '#8b5cf6'),
  ('Vegetables', 'Grocery', '#22c55e'),
  ('Meat', 'Grocery', '#14b8a6'),
  ('Fish', 'Grocery', '#0ea5e9'),
  ('Groceries', 'Grocery', '#10b981'),
  ('Transportation', 'Personal', '#f97316'),
  ('Medical', 'Personal', '#ef4444'),
  ('Entertainment', 'Personal', '#a855f7'),
  ('Shopping', 'Personal', '#ec4899'),
  ('Education', 'Personal', '#6366f1'),
  ('Bills', 'Grocery', '#64748b'),
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
