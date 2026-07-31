-- INOVAS Food - customer-key-bound public order tracking.
-- Apply after 024 on an isolated database branch before Production rollout.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP POLICY IF EXISTS inovas_tenant_select ON orders;
CREATE POLICY inovas_tenant_select ON orders
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

DROP POLICY IF EXISTS inovas_tenant_select ON order_items;
CREATE POLICY inovas_tenant_select ON order_items
FOR SELECT USING (
  tenant_id = current_setting('app.tenant_id', true)
  AND restaurant_id = current_setting('app.restaurant_id', true)
  AND (
    current_setting('app.audience', true) IN (
      'restaurant', 'support', 'provisioning'
    )
    OR (
      current_setting('app.audience', true) = 'public'
      AND EXISTS (
        SELECT 1
        FROM orders AS scoped_order
        WHERE scoped_order.id = order_items.order_id
          AND scoped_order.tenant_id = order_items.tenant_id
          AND scoped_order.restaurant_id = order_items.restaurant_id
          AND scoped_order.customer_key = current_setting(
            'app.customer_key',
            true
          )
      )
    )
  )
);

DROP POLICY IF EXISTS inovas_tenant_select ON order_status_events;
CREATE POLICY inovas_tenant_select ON order_status_events
FOR SELECT USING (
  tenant_id = current_setting('app.tenant_id', true)
  AND restaurant_id = current_setting('app.restaurant_id', true)
  AND (
    current_setting('app.audience', true) IN (
      'restaurant', 'support', 'provisioning'
    )
    OR (
      current_setting('app.audience', true) = 'public'
      AND EXISTS (
        SELECT 1
        FROM orders AS scoped_order
        WHERE scoped_order.id = order_status_events.order_id
          AND scoped_order.tenant_id = order_status_events.tenant_id
          AND scoped_order.restaurant_id = order_status_events.restaurant_id
          AND scoped_order.customer_key = current_setting(
            'app.customer_key',
            true
          )
      )
    )
  )
);

COMMIT;
