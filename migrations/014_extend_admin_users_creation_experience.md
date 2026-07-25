# Migration 014 - Extend admin user creation

## Objective

Evolve the existing `admin_users` identity model without introducing a parallel
user table. The current architecture remains a global identity with one
restaurant association per user.

## Forward migration

```sql
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
```

The application also accepts `PENDING` in the existing `status` text column.
No existing row is changed: old users keep their status, profile and
permissions, receive no new permission, and keep the current authentication
behavior.

Before applying the unique index in an environment with legacy imports, run:

```sql
SELECT LOWER(email), COUNT(*)
FROM admin_users
WHERE email <> ''
GROUP BY LOWER(email)
HAVING COUNT(*) > 1;
```

Resolve any result explicitly. Do not merge identities automatically.

## Rollback

Only roll back after removing application reads of these fields:

```sql
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
```

Rows with `PENDING` must be activated, blocked or removed before deploying code
that does not understand that status.

## Security notes

- Only the SHA-256 invitation token hash is stored.
- Passwords continue to use the existing per-password salted `scrypt` hash.
- Audit metadata excludes passwords, password hashes and invitation tokens.
- E-mail uniqueness remains global, matching the current identity architecture.
- `tenant_id` and `restaurant_id` are derived by the backend from the authorized
  restaurant key; client values are not trusted.
