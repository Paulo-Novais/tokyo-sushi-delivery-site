-- Revert 024 to the generic tenant policies established by 016.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP POLICY IF EXISTS inovas_tenant_select ON customers;
CREATE POLICY inovas_tenant_select ON customers
FOR SELECT USING (
  tenant_id = current_setting('app.tenant_id', true)
  AND restaurant_id = current_setting('app.restaurant_id', true)
  AND current_setting('app.audience', true) IN (
    'restaurant', 'support', 'provisioning'
  )
);

DROP POLICY IF EXISTS inovas_tenant_update ON customers;
CREATE POLICY inovas_tenant_update ON customers
FOR UPDATE USING (
  tenant_id = current_setting('app.tenant_id', true)
  AND restaurant_id = current_setting('app.restaurant_id', true)
  AND (
    current_setting('app.audience', true) IN ('restaurant', 'provisioning')
    OR (
      current_setting('app.audience', true) = 'support'
      AND current_setting('app.support_mode', true) = 'ADMIN'
    )
  )
) WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)
  AND restaurant_id = current_setting('app.restaurant_id', true)
);

COMMIT;
