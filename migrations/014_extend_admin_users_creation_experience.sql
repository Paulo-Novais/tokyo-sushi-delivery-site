-- INOVAS Food - SYSTEM x RESTAURANT security boundary
-- Materialized executable form of 014_extend_admin_users_creation_experience.md.
-- The SQL body is intentionally equivalent to the reviewed Markdown forward block.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS job_title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS credential_mode TEXT NOT NULL DEFAULT 'TEMPORARY_PASSWORD',
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS invitation_token_hash TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invitation_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invitation_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS audit_json JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_lower_uidx
  ON admin_users (LOWER(email))
  WHERE email <> '';

COMMIT;
