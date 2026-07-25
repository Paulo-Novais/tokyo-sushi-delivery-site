-- INOVAS Food — SYSTEM × RESTAURANT security boundary
-- Rollback for scoped identity administration.
-- Apply only to the isolated Preview database branch.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP POLICY IF EXISTS inovas_identity_select ON identities;
DROP POLICY IF EXISTS inovas_identity_insert ON identities;
DROP POLICY IF EXISTS inovas_identity_update ON identities;
DROP POLICY IF EXISTS inovas_identity_delete ON identities;

CREATE POLICY inovas_identity_access ON identities
FOR ALL
USING (
  current_setting('app.audience', true) = 'system'
  OR id = current_setting('app.identity_id', true)
)
WITH CHECK (
  current_setting('app.audience', true) = 'system'
  OR id = current_setting('app.identity_id', true)
);

COMMIT;
