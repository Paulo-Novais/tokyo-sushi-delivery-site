-- INOVAS Food - token-scoped customer visibility for public order upserts.
-- Apply after 023 on an isolated database branch before Production rollout.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP POLICY IF EXISTS inovas_tenant_select ON customers;
CREATE POLICY inovas_tenant_select ON customers
FOR SELECT USING (
  tenant_id = current_setting('app.tenant_id', true)
  AND restaurant_id = current_setting('app.restaurant_id', true)
  AND (
    current_setting('app.audience', true) IN (
      'restaurant', 'support', 'provisioning'
    )
    OR (
      current_setting('app.audience', true) = 'public'
      AND NULLIF(current_setting('app.customer_key', true), '') IS NOT NULL
      AND current_setting('app.customer_key', true) <> '__none__'
      AND customer_key = current_setting('app.customer_key', true)
    )
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
    OR (
      current_setting('app.audience', true) = 'public'
      AND NULLIF(current_setting('app.customer_key', true), '') IS NOT NULL
      AND current_setting('app.customer_key', true) <> '__none__'
      AND customer_key = current_setting('app.customer_key', true)
    )
  )
) WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)
  AND restaurant_id = current_setting('app.restaurant_id', true)
  AND (
    current_setting('app.audience', true) <> 'public'
    OR customer_key = current_setting('app.customer_key', true)
  )
);

COMMIT;
