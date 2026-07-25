-- INOVAS Food — SYSTEM × RESTAURANT security boundary
-- Rollback for migration 015.
-- Execute only on the isolated Preview branch after taking a branch snapshot.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $disable_operational_rls$
DECLARE
  table_name TEXT;
  operational_tables CONSTANT TEXT[] := ARRAY[
    'admin_users',
    'catalog_item_overrides',
    'catalog_promotions',
    'catalog_runtime_state',
    'customer_crm_profiles',
    'customer_reviews',
    'customers',
    'delivery_settings',
    'finance_closings',
    'inventory_runtime_state',
    'master_platform_state',
    'order_items',
    'order_status_events',
    'orders',
    'restaurant_settings'
  ];
BEGIN
  FOREACH table_name IN ARRAY operational_tables LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', table_name);
      EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', table_name);
    END IF;
  END LOOP;
END
$disable_operational_rls$;

DROP TABLE IF EXISTS system_alerts CASCADE;
DROP TABLE IF EXISTS tenant_health_scores CASCADE;
DROP TABLE IF EXISTS integration_health CASCADE;
DROP TABLE IF EXISTS platform_usage_daily CASCADE;
DROP TABLE IF EXISTS platform_health_snapshots CASCADE;
DROP TABLE IF EXISTS user_audit_events CASCADE;
DROP TABLE IF EXISTS system_support_sessions CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS invitations CASCADE;
DROP TABLE IF EXISTS auth_sessions CASCADE;
DROP TABLE IF EXISTS permission_overrides CASCADE;
DROP TABLE IF EXISTS role_permission_bindings CASCADE;
DROP TABLE IF EXISTS role_definitions CASCADE;
DROP TABLE IF EXISTS permission_definitions CASCADE;
DROP TABLE IF EXISTS restaurant_role_bindings CASCADE;
DROP TABLE IF EXISTS restaurant_memberships CASCADE;
DROP TABLE IF EXISTS system_role_bindings CASCADE;
DROP TABLE IF EXISTS system_principals CASCADE;
DROP TABLE IF EXISTS identities CASCADE;

ALTER TABLE admin_users
  DROP COLUMN IF EXISTS profile_version,
  DROP COLUMN IF EXISTS deny_overrides_json,
  DROP COLUMN IF EXISTS grant_overrides_json,
  DROP COLUMN IF EXISTS base_role;

COMMIT;
