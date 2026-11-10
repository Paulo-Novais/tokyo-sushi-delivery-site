-- INOVAS Food — SYSTEM × RESTAURANT security boundary
-- Rollback keeps the recovered tenant and owner intact to avoid access loss.
-- It removes only the new constraints/index/policies; data reversal is manual.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP POLICY IF EXISTS inovas_system_principal_authentication ON system_principals;
DROP POLICY IF EXISTS inovas_membership_authentication ON restaurant_memberships;
DROP POLICY IF EXISTS inovas_auth_audit_insert ON user_audit_events;

DROP INDEX IF EXISTS admin_users_scope_status_idx;

ALTER TABLE admin_users
  DROP CONSTRAINT IF EXISTS admin_users_user_scope_check,
  DROP CONSTRAINT IF EXISTS admin_users_system_scope_check,
  DROP CONSTRAINT IF EXISTS admin_users_restaurant_scope_check;

COMMIT;
