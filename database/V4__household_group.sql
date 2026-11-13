BEGIN;

ALTER TABLE categories
  DROP CONSTRAINT IF EXISTS categories_group_name_check;

UPDATE categories
SET group_name = 'Household'
WHERE group_name = 'Grocery';

ALTER TABLE categories
  ADD CONSTRAINT categories_group_name_check
  CHECK (group_name IN ('Personal', 'Household'));

COMMIT;
