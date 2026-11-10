-- INOVAS Food ? repair the complete default RBAC matrix after partial catalog seeding.
BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.permission_definitions') IS NULL
    OR to_regclass('public.role_definitions') IS NULL
    OR to_regclass('public.role_permission_bindings') IS NULL
    OR to_regclass('public.system_principals') IS NULL THEN
    RAISE EXCEPTION 'Migration 015 is required before migration 027.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM permission_definitions
    WHERE key = 'system.dashboard.view' AND domain = 'SYSTEM' AND active = TRUE
  ) THEN
    RAISE EXCEPTION 'The SYSTEM permission catalog is incomplete.';
  END IF;
END
$preflight$;

CREATE TEMP TABLE inovas_default_role_policy (
  domain TEXT NOT NULL,
  role_key TEXT NOT NULL,
  permissions JSONB NOT NULL,
  PRIMARY KEY (domain, role_key)
) ON COMMIT DROP;

INSERT INTO inovas_default_role_policy (domain, role_key, permissions)
VALUES
  ('SYSTEM', 'MASTER', '["system.dashboard.view","system.restaurants.view","system.restaurants.create","system.restaurants.edit","system.restaurants.suspend","system.plans.manage","system.domains.manage","system.health.view","system.audit.view","system.integrations.view","system.integrations.manage","system.users.view","system.users.manage","system.roles.view","system.roles.manage","system.support.start","system.support.admin","system.billing.view","system.billing.manage"]'::jsonb),
  ('SYSTEM', 'SOCIO', '["system.dashboard.view","system.restaurants.view","system.restaurants.create","system.restaurants.edit","system.restaurants.suspend","system.plans.manage","system.domains.manage","system.health.view","system.audit.view","system.integrations.view","system.integrations.manage","system.users.view","system.roles.view","system.support.start","system.support.admin","system.billing.view"]'::jsonb),
  ('SYSTEM', 'SUPORTE', '["system.dashboard.view","system.restaurants.view","system.health.view","system.audit.view","system.support.start"]'::jsonb),
  ('SYSTEM', 'DESENVOLVEDOR', '["system.dashboard.view","system.restaurants.view","system.health.view","system.audit.view","system.support.start","system.support.admin"]'::jsonb),
  ('SYSTEM', 'COMERCIAL', '["system.dashboard.view","system.restaurants.view","system.restaurants.create","system.plans.manage"]'::jsonb),
  ('SYSTEM', 'FINANCEIRO_INOVAS', '["system.dashboard.view","system.restaurants.view","system.billing.view","system.billing.manage"]'::jsonb),
  ('SYSTEM', 'IMPLANTACAO', '["system.dashboard.view","system.restaurants.view","system.restaurants.create","system.restaurants.edit","system.domains.manage","system.health.view"]'::jsonb),
  ('SYSTEM', 'CUSTOMER_SUCCESS', '["system.dashboard.view","system.restaurants.view","system.health.view","system.support.start"]'::jsonb),
  ('SYSTEM', 'AUDITOR', '["system.dashboard.view","system.restaurants.view","system.health.view","system.audit.view","system.billing.view","system.users.view"]'::jsonb),
  ('RESTAURANT', 'OWNER', '["tenant.dashboard.view","tenant.orders.view","tenant.orders.edit","tenant.customers.view","tenant.catalog.view","tenant.catalog.edit","tenant.inventory.view","tenant.inventory.edit","tenant.financial.view","tenant.financial.edit","tenant.delivery.view","tenant.delivery.edit","tenant.reports.view","tenant.reports.export","tenant.settings.view","tenant.settings.edit","tenant.users.view","tenant.users.manage","tenant.audit.view","tenant.cash_register.view","tenant.cash_register.configure","tenant.cash_register.open","tenant.cash_register.close","tenant.cash_register.open_tab","tenant.cash_register.add_item","tenant.cash_register.send_order","tenant.cash_register.discount","tenant.cash_register.remove_service","tenant.cash_register.close_tab","tenant.cash_register.confirm_payment","tenant.cash_register.history","tenant.orders.create","tenant.orders.cancel","tenant.orders.delete","tenant.customers.create","tenant.customers.edit","tenant.customers.delete","tenant.catalog.create","tenant.catalog.delete","tenant.promotions.view","tenant.promotions.create","tenant.promotions.edit","tenant.promotions.delete","tenant.reviews.view","tenant.reviews.edit","tenant.reviews.delete","tenant.inventory.create","tenant.inventory.delete","tenant.financial.create","tenant.financial.refund","tenant.users.create","tenant.users.edit","tenant.users.delete","tenant.users.permissions","tenant.business_hours.view","tenant.business_hours.edit","tenant.special_dates.view","tenant.special_dates.create","tenant.special_dates.edit","tenant.special_dates.delete"]'::jsonb),
  ('RESTAURANT', 'ADMIN', '["tenant.dashboard.view","tenant.orders.view","tenant.orders.edit","tenant.customers.view","tenant.catalog.view","tenant.catalog.edit","tenant.inventory.view","tenant.inventory.edit","tenant.financial.view","tenant.delivery.view","tenant.delivery.edit","tenant.reports.view","tenant.reports.export","tenant.settings.view","tenant.settings.edit","tenant.users.view","tenant.users.manage","tenant.audit.view","tenant.cash_register.view","tenant.cash_register.configure","tenant.cash_register.open","tenant.cash_register.close","tenant.cash_register.open_tab","tenant.cash_register.add_item","tenant.cash_register.send_order","tenant.cash_register.discount","tenant.cash_register.remove_service","tenant.cash_register.close_tab","tenant.cash_register.confirm_payment","tenant.cash_register.history","tenant.orders.create","tenant.orders.cancel","tenant.orders.delete","tenant.customers.create","tenant.customers.edit","tenant.customers.delete","tenant.catalog.create","tenant.catalog.delete","tenant.promotions.view","tenant.promotions.create","tenant.promotions.edit","tenant.promotions.delete","tenant.reviews.view","tenant.reviews.edit","tenant.reviews.delete","tenant.inventory.create","tenant.inventory.delete","tenant.users.create","tenant.users.edit","tenant.users.delete","tenant.users.permissions","tenant.business_hours.view","tenant.business_hours.edit","tenant.special_dates.view","tenant.special_dates.create","tenant.special_dates.edit","tenant.special_dates.delete"]'::jsonb),
  ('RESTAURANT', 'MANAGER', '["tenant.dashboard.view","tenant.orders.view","tenant.orders.edit","tenant.customers.view","tenant.catalog.view","tenant.catalog.edit","tenant.inventory.view","tenant.inventory.edit","tenant.financial.view","tenant.delivery.view","tenant.delivery.edit","tenant.reports.view","tenant.reports.export","tenant.settings.view","tenant.users.view","tenant.audit.view","tenant.cash_register.view","tenant.cash_register.configure","tenant.cash_register.open","tenant.cash_register.close","tenant.cash_register.open_tab","tenant.cash_register.add_item","tenant.cash_register.send_order","tenant.cash_register.discount","tenant.cash_register.remove_service","tenant.cash_register.close_tab","tenant.cash_register.confirm_payment","tenant.cash_register.history","tenant.orders.create","tenant.orders.cancel","tenant.orders.delete","tenant.customers.create","tenant.customers.edit","tenant.customers.delete","tenant.catalog.create","tenant.catalog.delete","tenant.promotions.view","tenant.promotions.create","tenant.promotions.edit","tenant.promotions.delete","tenant.reviews.view","tenant.reviews.edit","tenant.reviews.delete","tenant.inventory.create","tenant.inventory.delete","tenant.business_hours.view","tenant.business_hours.edit","tenant.special_dates.view","tenant.special_dates.create","tenant.special_dates.edit","tenant.special_dates.delete"]'::jsonb),
  ('RESTAURANT', 'CASHIER', '["tenant.dashboard.view","tenant.orders.view","tenant.orders.edit","tenant.orders.create","tenant.customers.view","tenant.financial.view","tenant.cash_register.view","tenant.cash_register.open","tenant.cash_register.close","tenant.cash_register.open_tab","tenant.cash_register.add_item","tenant.cash_register.send_order","tenant.cash_register.remove_service","tenant.cash_register.close_tab","tenant.cash_register.confirm_payment","tenant.cash_register.history"]'::jsonb),
  ('RESTAURANT', 'SERVICE', '["tenant.dashboard.view","tenant.orders.view","tenant.orders.edit","tenant.orders.create","tenant.customers.view","tenant.delivery.view","tenant.cash_register.view","tenant.cash_register.open_tab","tenant.cash_register.add_item","tenant.cash_register.send_order","tenant.cash_register.history"]'::jsonb),
  ('RESTAURANT', 'KITCHEN', '["tenant.dashboard.view","tenant.orders.view","tenant.orders.edit","tenant.catalog.view"]'::jsonb),
  ('RESTAURANT', 'INVENTORY', '["tenant.dashboard.view","tenant.catalog.view","tenant.inventory.view","tenant.inventory.edit","tenant.inventory.create"]'::jsonb),
  ('RESTAURANT', 'FINANCE', '["tenant.dashboard.view","tenant.financial.view","tenant.reports.view","tenant.reports.export"]'::jsonb),
  ('RESTAURANT', 'DELIVERY', '["tenant.dashboard.view","tenant.orders.view","tenant.orders.edit","tenant.delivery.view","tenant.delivery.edit"]'::jsonb),
  ('RESTAURANT', 'READ_ONLY', '["tenant.dashboard.view","tenant.orders.view","tenant.customers.view","tenant.catalog.view","tenant.inventory.view","tenant.financial.view","tenant.delivery.view","tenant.reports.view","tenant.settings.view","tenant.users.view","tenant.audit.view","tenant.cash_register.view","tenant.promotions.view","tenant.reviews.view","tenant.business_hours.view","tenant.special_dates.view"]'::jsonb),
  ('RESTAURANT', 'CUSTOM', '[]'::jsonb);

DELETE FROM role_permission_bindings AS binding
USING role_definitions AS role, inovas_default_role_policy AS policy
WHERE binding.domain = role.domain
  AND binding.role_key = role.key
  AND binding.role_version = role.version
  AND role.active = TRUE
  AND policy.domain = role.domain
  AND policy.role_key = role.key;

INSERT INTO role_permission_bindings (
  domain, role_key, role_version, permission_key, created_at
)
SELECT
  role.domain,
  role.key,
  role.version,
  permission.value,
  NOW()
FROM role_definitions AS role
JOIN inovas_default_role_policy AS policy
  ON policy.domain = role.domain
 AND policy.role_key = role.key
CROSS JOIN LATERAL jsonb_array_elements_text(policy.permissions) AS permission(value)
JOIN permission_definitions AS definition
  ON definition.key = permission.value
 AND definition.domain = role.domain
 AND definition.active = TRUE
WHERE role.active = TRUE
ON CONFLICT DO NOTHING;

INSERT INTO user_audit_events (
  id, actor_identity_id, actor_type, target_identity_id,
  tenant_id, restaurant_id, event_type, result, reason,
  before_json, after_json, request_id, metadata_json, created_at
)
SELECT
  'audit_system_master_rbac_repaired_20260804',
  NULL,
  'MIGRATION',
  principal.identity_id,
  NULL,
  NULL,
  'SYSTEM_MASTER_RBAC_REPAIRED',
  'SUCCESS',
  'Cat?logo persistente possu?a somente as permiss?es adicionadas pela migra??o 026.',
  jsonb_build_object('effectivePermissionCount', 4),
  jsonb_build_object('effectivePermissionCount', 19, 'role', 'MASTER', 'domain', 'SYSTEM'),
  'migration-027',
  jsonb_build_object('tenantBindingsChanged', FALSE, 'passwordChanged', FALSE),
  NOW()
FROM system_principals AS principal
JOIN identities AS identity ON identity.id = principal.identity_id
WHERE LOWER(identity.login) = 'usermaster@gmail.com'
ON CONFLICT (id) DO NOTHING;

DO $postcondition$
DECLARE
  incomplete_master_versions INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO incomplete_master_versions
  FROM role_definitions AS role
  WHERE role.domain = 'SYSTEM'
    AND role.key = 'MASTER'
    AND role.active = TRUE
    AND (
      SELECT COUNT(*)
      FROM role_permission_bindings AS binding
      WHERE binding.domain = role.domain
        AND binding.role_key = role.key
        AND binding.role_version = role.version
    ) <> 19;

  IF incomplete_master_versions <> 0 THEN
    RAISE EXCEPTION 'MASTER RBAC repair postcondition failed for % active version(s).', incomplete_master_versions;
  END IF;
END
$postcondition$;

COMMIT;
