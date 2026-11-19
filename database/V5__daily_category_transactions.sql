-- Back up transactions before applying: consolidated rows cannot be separated
-- again from their comma-joined descriptions alone.
BEGIN;

-- Prevent writes between consolidation and creation of the uniqueness rule.
LOCK TABLE transactions IN ACCESS EXCLUSIVE MODE;

CREATE TEMP TABLE daily_transaction_merges ON COMMIT DROP AS
SELECT category_id, transaction_date,
       (array_agg(id ORDER BY created_at, id))[1] AS retained_id,
       SUM(amount) AS amount,
       COALESCE(
         string_agg(NULLIF(btrim(description), ''), ', ' ORDER BY created_at, id),
         ''
       ) AS description
FROM transactions
GROUP BY category_id, transaction_date
HAVING COUNT(*) > 1;

-- Retain the oldest row's ID and timestamp. Numeric overflow aborts the entire
-- migration, leaving the original transactions intact.
UPDATE transactions AS transaction
SET amount = merged.amount, description = merged.description
FROM daily_transaction_merges AS merged
WHERE transaction.id = merged.retained_id;

DELETE FROM transactions AS transaction
USING daily_transaction_merges AS merged
WHERE transaction.category_id = merged.category_id
  AND transaction.transaction_date = merged.transaction_date
  AND transaction.id <> merged.retained_id;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_category_date_uidx
  ON transactions (category_id, transaction_date);

COMMIT;
