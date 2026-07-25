-- INOVAS Food — SYSTEM × RESTAURANT security boundary
-- User profile metadata used by the professional management experience.
-- Apply only to the isolated Preview database branch.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS internal_note TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS admin_users_department_idx
ON admin_users (tenant_id, restaurant_id, department);

COMMIT;
