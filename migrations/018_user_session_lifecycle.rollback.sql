-- INOVAS Food — SYSTEM × RESTAURANT security boundary
-- Rollback for audited user lifecycle session revocation.
-- Apply only to the isolated Preview database branch.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP POLICY IF EXISTS inovas_auth_session_access ON auth_sessions;

CREATE POLICY inovas_auth_session_access ON auth_sessions
FOR ALL
USING (identity_id = current_setting('app.identity_id', true))
WITH CHECK (identity_id = current_setting('app.identity_id', true));

COMMIT;
