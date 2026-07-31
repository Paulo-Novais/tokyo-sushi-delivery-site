-- INOVAS Food - rollback for migration 014.
-- Destructive for metadata created after migration 014. Prefer branch/PITR restore.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP INDEX IF EXISTS admin_users_email_lower_uidx;

ALTER TABLE admin_users
  DROP COLUMN IF EXISTS audit_json,
  DROP COLUMN IF EXISTS invitation_used_at,
  DROP COLUMN IF EXISTS invitation_sent_at,
  DROP COLUMN IF EXISTS invitation_created_at,
  DROP COLUMN IF EXISTS invitation_expires_at,
  DROP COLUMN IF EXISTS invitation_token_hash,
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS must_change_password,
  DROP COLUMN IF EXISTS credential_mode,
  DROP COLUMN IF EXISTS job_title;

COMMIT;
