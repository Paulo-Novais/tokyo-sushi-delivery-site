-- INOVAS Food — SYSTEM × RESTAURANT security boundary
-- Rollback for migration 017 on the isolated Preview branch only.

BEGIN;

DROP INDEX IF EXISTS admin_users_department_idx;
ALTER TABLE admin_users
  DROP COLUMN IF EXISTS internal_note,
  DROP COLUMN IF EXISTS department;

COMMIT;
