-- INOVAS Food - Painel System V1: configuracoes administrativas e visibilidade do menu.
-- Esta migracao altera somente o catalogo RBAC. Nenhum dado operacional e modificado.
BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.permission_definitions') IS NULL
    OR to_regclass('public.role_definitions') IS NULL
    OR to_regclass('public.role_permission_bindings') IS NULL THEN
    RAISE EXCEPTION 'Migration 015 is required before migration 028.';
  END IF;
END
$preflight$;

INSERT INTO permission_definitions (
  key, domain, module, action, risk_level,
  dependencies_json, description, version, active, updated_at
)
VALUES
  ('system.settings.view', 'SYSTEM', 'settings', 'view', 'LOW', '[]'::jsonb, 'Visualizar configurações da plataforma.', '2026.08.05', TRUE, NOW()),
  ('system.settings.manage', 'SYSTEM', 'settings', 'manage', 'CRITICAL', '["system.settings.view"]'::jsonb, 'Administrar configurações da plataforma.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.dashboard', 'RESTAURANT', 'navigation', 'dashboard', 'LOW', '[]'::jsonb, 'Exibir Painel no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.users', 'RESTAURANT', 'navigation', 'users', 'LOW', '[]'::jsonb, 'Exibir Usuários no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.cash_register', 'RESTAURANT', 'navigation', 'cash_register', 'LOW', '[]'::jsonb, 'Exibir Caixa no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.orders', 'RESTAURANT', 'navigation', 'orders', 'LOW', '[]'::jsonb, 'Exibir Pedidos no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.catalog', 'RESTAURANT', 'navigation', 'catalog', 'LOW', '[]'::jsonb, 'Exibir Cardápio no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.scheduled', 'RESTAURANT', 'navigation', 'scheduled', 'LOW', '[]'::jsonb, 'Exibir Agendamentos no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.delivery', 'RESTAURANT', 'navigation', 'delivery', 'LOW', '[]'::jsonb, 'Exibir Entregas no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.customers', 'RESTAURANT', 'navigation', 'customers', 'LOW', '[]'::jsonb, 'Exibir Clientes no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.promotions', 'RESTAURANT', 'navigation', 'promotions', 'LOW', '[]'::jsonb, 'Exibir Promoções no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.metrics', 'RESTAURANT', 'navigation', 'metrics', 'LOW', '[]'::jsonb, 'Exibir Métricas no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.reports', 'RESTAURANT', 'navigation', 'reports', 'LOW', '[]'::jsonb, 'Exibir Relatórios no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.financial', 'RESTAURANT', 'navigation', 'financial', 'LOW', '[]'::jsonb, 'Exibir Financeiro no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.reviews', 'RESTAURANT', 'navigation', 'reviews', 'LOW', '[]'::jsonb, 'Exibir Avaliações no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.settings', 'RESTAURANT', 'navigation', 'settings', 'LOW', '[]'::jsonb, 'Exibir Configurações no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.inventory', 'RESTAURANT', 'navigation', 'inventory', 'LOW', '[]'::jsonb, 'Exibir Estoque no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.printing', 'RESTAURANT', 'navigation', 'printing', 'LOW', '[]'::jsonb, 'Exibir Impressão no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.production', 'RESTAURANT', 'navigation', 'production', 'LOW', '[]'::jsonb, 'Exibir Produção no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.tables', 'RESTAURANT', 'navigation', 'tables', 'LOW', '[]'::jsonb, 'Exibir Mesas no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.dining_room', 'RESTAURANT', 'navigation', 'dining_room', 'LOW', '[]'::jsonb, 'Exibir Salão no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.delivery_channel', 'RESTAURANT', 'navigation', 'delivery_channel', 'LOW', '[]'::jsonb, 'Exibir Delivery no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.loyalty', 'RESTAURANT', 'navigation', 'loyalty', 'LOW', '[]'::jsonb, 'Exibir Fidelidade no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.coupons', 'RESTAURANT', 'navigation', 'coupons', 'LOW', '[]'::jsonb, 'Exibir Cupons no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.marketing', 'RESTAURANT', 'navigation', 'marketing', 'LOW', '[]'::jsonb, 'Exibir Marketing no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.api', 'RESTAURANT', 'navigation', 'api', 'LOW', '[]'::jsonb, 'Exibir API no menu lateral do restaurante.', '2026.08.05', TRUE, NOW()),
  ('tenant.navigation.integrations', 'RESTAURANT', 'navigation', 'integrations', 'LOW', '[]'::jsonb, 'Exibir Integrações no menu lateral do restaurante.', '2026.08.05', TRUE, NOW())
ON CONFLICT (key) DO UPDATE SET
  domain = EXCLUDED.domain,
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  risk_level = EXCLUDED.risk_level,
  dependencies_json = EXCLUDED.dependencies_json,
  description = EXCLUDED.description,
  version = EXCLUDED.version,
  active = TRUE,
  updated_at = NOW();

INSERT INTO role_definitions (
  key, domain, label, authority_level, version, active, updated_at
)
VALUES
  ('ADMINISTRADOR', 'SYSTEM', 'Administrador', 90, '2026.08.04', TRUE, NOW()),
  ('OPERATOR', 'RESTAURANT', 'Operador', 35, '2026.08.04', TRUE, NOW()),
  ('WAITER', 'RESTAURANT', 'Garçom', 30, '2026.08.04', TRUE, NOW())
ON CONFLICT (domain, key, version) DO UPDATE SET
  label = EXCLUDED.label,
  authority_level = EXCLUDED.authority_level,
  active = TRUE,
  updated_at = NOW();

UPDATE role_definitions
SET label = CASE
  WHEN domain = 'SYSTEM' AND key = 'FINANCEIRO_INOVAS' THEN 'Financeiro'
  WHEN domain = 'SYSTEM' AND key = 'AUDITOR' THEN 'Auditoria'
  WHEN domain = 'SYSTEM' AND key = 'CUSTOMER_SUCCESS' THEN 'Sucesso do cliente'
  WHEN domain = 'RESTAURANT' AND key = 'OWNER' THEN 'Proprietário'
  WHEN domain = 'RESTAURANT' AND key = 'SERVICE' THEN 'Operador (legado)'
  WHEN domain = 'RESTAURANT' AND key = 'DELIVERY' THEN 'Entregador'
  ELSE label
END,
updated_at = NOW()
WHERE (domain = 'SYSTEM' AND key IN ('FINANCEIRO_INOVAS', 'AUDITOR', 'CUSTOMER_SUCCESS'))
   OR (domain = 'RESTAURANT' AND key IN ('OWNER', 'SERVICE', 'DELIVERY'));

UPDATE permission_definitions
SET description = CASE key
  WHEN 'tenant.cash_register.view' THEN 'Visualizar Caixa e Salão.'
  WHEN 'tenant.cash_register.configure' THEN 'Configurar mesas do salão.'
  WHEN 'tenant.cash_register.send_order' THEN 'Enviar pedido para produção.'
  WHEN 'tenant.cash_register.remove_service' THEN 'Remover taxa de serviço.'
  WHEN 'tenant.cash_register.history' THEN 'Visualizar histórico do caixa.'
  ELSE description
END,
updated_at = NOW()
WHERE key IN (
  'tenant.cash_register.view',
  'tenant.cash_register.configure',
  'tenant.cash_register.send_order',
  'tenant.cash_register.remove_service',
  'tenant.cash_register.history'
);

INSERT INTO role_permission_bindings (
  domain, role_key, role_version, permission_key, created_at
)
SELECT role.domain, role.key, role.version, permission.key, NOW()
FROM role_definitions AS role
JOIN permission_definitions AS permission ON permission.domain = 'SYSTEM' AND permission.active = TRUE
WHERE role.domain = 'SYSTEM'
  AND role.active = TRUE
  AND (
    role.key = 'MASTER'
    OR (
      role.key = 'ADMINISTRADOR'
      AND permission.key NOT IN (
        'system.users.manage', 'system.roles.manage',
        'system.billing.manage', 'system.settings.manage'
      )
    )
    OR (role.key = 'SOCIO' AND permission.key IN ('system.settings.view', 'system.settings.manage'))
  )
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE inovas_restaurant_navigation_policy (
  role_key TEXT PRIMARY KEY,
  items JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO inovas_restaurant_navigation_policy (role_key, items)
VALUES
  ('OWNER', '["dashboard","users","cash_register","orders","catalog","scheduled","delivery","customers","promotions","metrics","reports","financial","reviews","settings","inventory","printing","production","tables","dining_room","delivery_channel","loyalty","coupons","marketing","api","integrations"]'::jsonb),
  ('ADMIN', '["dashboard","users","cash_register","orders","catalog","scheduled","delivery","customers","promotions","metrics","reports","financial","reviews","settings","inventory","printing","production","tables","dining_room","delivery_channel","loyalty","coupons","marketing","api","integrations"]'::jsonb),
  ('MANAGER', '["dashboard","users","cash_register","orders","catalog","scheduled","delivery","customers","promotions","metrics","reports","reviews","inventory","production","tables","dining_room","integrations"]'::jsonb),
  ('OPERATOR', '["dashboard","cash_register","orders"]'::jsonb),
  ('CASHIER', '["dashboard","cash_register","orders","customers","financial"]'::jsonb),
  ('SERVICE', '["dashboard","cash_register","orders"]'::jsonb),
  ('WAITER', '["dashboard","orders","tables","dining_room"]'::jsonb),
  ('KITCHEN', '["dashboard","orders","production"]'::jsonb),
  ('INVENTORY', '["dashboard","catalog","inventory"]'::jsonb),
  ('FINANCE', '["dashboard","financial","reports"]'::jsonb),
  ('DELIVERY', '["dashboard","orders","delivery","delivery_channel"]'::jsonb),
  ('READ_ONLY', '["dashboard","reports"]'::jsonb),
  ('CUSTOM', '[]'::jsonb);

INSERT INTO role_permission_bindings (
  domain, role_key, role_version, permission_key, created_at
)
SELECT
  role.domain,
  role.key,
  role.version,
  'tenant.navigation.' || item.value,
  NOW()
FROM role_definitions AS role
JOIN inovas_restaurant_navigation_policy AS policy ON policy.role_key = role.key
CROSS JOIN LATERAL jsonb_array_elements_text(policy.items) AS item(value)
JOIN permission_definitions AS permission
  ON permission.key = 'tenant.navigation.' || item.value
 AND permission.domain = 'RESTAURANT'
 AND permission.active = TRUE
WHERE role.domain = 'RESTAURANT' AND role.active = TRUE
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE inovas_new_restaurant_role_policy (
  role_key TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  PRIMARY KEY (role_key, permission_key)
) ON COMMIT DROP;

INSERT INTO inovas_new_restaurant_role_policy (role_key, permission_key)
VALUES
  ('OPERATOR', 'tenant.dashboard.view'),
  ('OPERATOR', 'tenant.orders.view'),
  ('OPERATOR', 'tenant.orders.edit'),
  ('OPERATOR', 'tenant.orders.create'),
  ('OPERATOR', 'tenant.cash_register.view'),
  ('OPERATOR', 'tenant.cash_register.open_tab'),
  ('OPERATOR', 'tenant.cash_register.add_item'),
  ('OPERATOR', 'tenant.cash_register.send_order'),
  ('OPERATOR', 'tenant.cash_register.history'),
  ('WAITER', 'tenant.dashboard.view'),
  ('WAITER', 'tenant.orders.view'),
  ('WAITER', 'tenant.orders.edit'),
  ('WAITER', 'tenant.orders.create'),
  ('WAITER', 'tenant.cash_register.view'),
  ('WAITER', 'tenant.cash_register.open_tab'),
  ('WAITER', 'tenant.cash_register.add_item'),
  ('WAITER', 'tenant.cash_register.send_order');

INSERT INTO role_permission_bindings (
  domain, role_key, role_version, permission_key, created_at
)
SELECT role.domain, role.key, role.version, policy.permission_key, NOW()
FROM role_definitions AS role
JOIN inovas_new_restaurant_role_policy AS policy ON policy.role_key = role.key
JOIN permission_definitions AS permission
  ON permission.key = policy.permission_key
 AND permission.domain = 'RESTAURANT'
 AND permission.active = TRUE
WHERE role.domain = 'RESTAURANT' AND role.active = TRUE
ON CONFLICT DO NOTHING;

DO $postcondition$
DECLARE
  navigation_permission_count INTEGER;
  incomplete_owner_versions INTEGER;
BEGIN
  SELECT COUNT(*) INTO navigation_permission_count
  FROM permission_definitions
  WHERE domain = 'RESTAURANT' AND module = 'navigation' AND active = TRUE;

  IF navigation_permission_count <> 25 THEN
    RAISE EXCEPTION 'Navigation RBAC catalog has %, expected 25.', navigation_permission_count;
  END IF;

  SELECT COUNT(*) INTO incomplete_owner_versions
  FROM role_definitions AS role
  WHERE role.domain = 'RESTAURANT'
    AND role.key = 'OWNER'
    AND role.active = TRUE
    AND (
      SELECT COUNT(*)
      FROM role_permission_bindings AS binding
      JOIN permission_definitions AS permission ON permission.key = binding.permission_key
      WHERE binding.domain = role.domain
        AND binding.role_key = role.key
        AND binding.role_version = role.version
        AND permission.module = 'navigation'
        AND permission.active = TRUE
    ) <> 25;

  IF incomplete_owner_versions <> 0 THEN
    RAISE EXCEPTION 'OWNER navigation RBAC is incomplete for % active version(s).', incomplete_owner_versions;
  END IF;
END
$postcondition$;

COMMIT;
