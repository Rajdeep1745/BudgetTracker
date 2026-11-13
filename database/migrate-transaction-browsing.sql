CREATE INDEX IF NOT EXISTS transactions_recent_idx
  ON transactions(transaction_date DESC, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS transactions_category_recent_idx
  ON transactions(category_id, transaction_date DESC, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS transactions_amount_idx ON transactions(amount);
