-- INOVAS Food - invitation acceptance under a token-bound authentication scope.
-- Apply after 021 on an isolated database branch before Production rollout.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP POLICY IF EXISTS inovas_admin_users_select ON admin_users;
CREATE POLICY inovas_admin_users_select ON admin_users
FOR SELECT USING (
  (
    current_setting('app.audience', true) = 'authentication'
    AND (
      LOWER(login) = LOWER(current_setting('app.login', true))
      OR (
        NULLIF(current_setting('app.invitation_token_hash', true), '') IS NOT NULL
        AND current_setting('app.invitation_token_hash', true) <> '__none__'
        AND invitation_token_hash = current_setting(
          'app.invitation_token_hash',
          true
        )
      )
    )
  )
  OR (
    current_setting('app.audience', true) = 'system'
    AND restaurant_key = ''
  )
  OR (
    current_setting('app.audience', true) IN ('restaurant', 'provisioning')
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND restaurant_key <> ''
  )
  OR (
    current_setting('app.audience', true) = 'support'
    AND current_setting('app.support_mode', true) = 'ADMIN'
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND restaurant_key <> ''
  )
);

DROP POLICY IF EXISTS inovas_admin_users_update ON admin_users;
CREATE POLICY inovas_admin_users_update ON admin_users
FOR UPDATE USING (
  (
    current_setting('app.audience', true) = 'authentication'
    AND NULLIF(current_setting('app.invitation_token_hash', true), '') IS NOT NULL
    AND current_setting('app.invitation_token_hash', true) <> '__none__'
    AND invitation_token_hash = current_setting(
      'app.invitation_token_hash',
      true
    )
  )
  OR (
    current_setting('app.audience', true) = 'system'
    AND (
      restaurant_key = ''
      OR user_type IN (
        'MASTER', 'SOCIO', 'DESENVOLVEDOR', 'SUPORTE', 'VENDEDOR', 'COMERCIAL',
        'FINANCEIRO_INOVAS', 'IMPLANTACAO', 'CUSTOMER_SUCCESS', 'AUDITOR'
      )
    )
  )
  OR (
    current_setting('app.audience', true) IN ('restaurant', 'support')
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND (
      current_setting('app.audience', true) = 'restaurant'
      OR current_setting('app.support_mode', true) = 'ADMIN'
    )
  )
) WITH CHECK (
  (
    current_setting('app.audience', true) = 'authentication'
    AND NULLIF(current_setting('app.invitation_token_hash', true), '') IS NOT NULL
    AND current_setting('app.invitation_token_hash', true) <> '__none__'
    AND LOWER(login) = LOWER(current_setting('app.login', true))
  )
  OR restaurant_key = ''
  OR (
    tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
  )
);

COMMIT;
