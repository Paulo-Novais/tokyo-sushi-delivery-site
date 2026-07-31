-- Revert 025 to tenant-only operational reads.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $rollback$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'orders',
    'order_items',
    'order_status_events'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS inovas_tenant_select ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY inovas_tenant_select ON %I FOR SELECT USING (
        tenant_id = current_setting(''app.tenant_id'', true)
        AND restaurant_id = current_setting(''app.restaurant_id'', true)
        AND current_setting(''app.audience'', true) IN (
          ''restaurant'', ''support'', ''provisioning''
        )
      )',
      table_name
    );
  END LOOP;
END
$rollback$;

COMMIT;
