-- INOVAS Food — SYSTEM × RESTAURANT security boundary
-- Audited user lifecycle session revocation.
-- Apply only to the isolated Preview database branch.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inovas_auth_session_access ON auth_sessions;

CREATE POLICY inovas_auth_session_access ON auth_sessions
FOR ALL
USING (
  identity_id = current_setting('app.identity_id', true)
  OR (
    current_setting('app.audience', true) = 'system'
    AND audience = 'system'
  )
  OR (
    (
      current_setting('app.audience', true) = 'restaurant'
      OR (
        current_setting('app.audience', true) = 'support'
        AND current_setting('app.support_mode', true) = 'ADMIN'
      )
    )
    AND audience = 'restaurant'
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
  )
)
WITH CHECK (
  identity_id = current_setting('app.identity_id', true)
  OR (
    current_setting('app.audience', true) = 'system'
    AND audience = 'system'
  )
  OR (
    (
      current_setting('app.audience', true) = 'restaurant'
      OR (
        current_setting('app.audience', true) = 'support'
        AND current_setting('app.support_mode', true) = 'ADMIN'
      )
    )
    AND audience = 'restaurant'
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
  )
);

COMMIT;
