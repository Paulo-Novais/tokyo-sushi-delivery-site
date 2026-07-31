-- Revert 023 to the policies established by 015 and 021.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP POLICY IF EXISTS inovas_admin_users_select ON admin_users;
CREATE POLICY inovas_admin_users_select ON admin_users
FOR SELECT USING (
  (
    current_setting('app.audience', true) = 'authentication'
    AND LOWER(login) = LOWER(current_setting('app.login', true))
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
  restaurant_key = ''
  OR (
    tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
  )
);

COMMIT;
