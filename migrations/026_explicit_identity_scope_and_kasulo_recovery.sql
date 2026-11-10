-- INOVAS Food — SYSTEM × RESTAURANT security boundary
-- Persist the identity domain explicitly and recover the Kasulo owner tenant.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
DECLARE
  kasulo_user_count INTEGER;
BEGIN
  IF to_regclass('public.admin_users') IS NULL
    OR to_regclass('public.identities') IS NULL
    OR to_regclass('public.system_principals') IS NULL
    OR to_regclass('public.restaurant_memberships') IS NULL
    OR to_regclass('public.public_restaurant_routes') IS NULL THEN
    RAISE EXCEPTION 'Migrations 015-021 are required before migration 026.';
  END IF;

  SELECT COUNT(*)
  INTO kasulo_user_count
  FROM admin_users
  WHERE LOWER(login) = 'kasulorochapizzaria@gmail.com'
     OR LOWER(email) = 'kasulorochapizzaria@gmail.com';

  IF kasulo_user_count <> 1 THEN
    RAISE EXCEPTION 'Kasulo preflight expected exactly one admin_users row, found %.', kasulo_user_count;
  END IF;
END
$preflight$;

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS user_scope TEXT NOT NULL DEFAULT 'UNASSIGNED',
  ADD COLUMN IF NOT EXISTS platform_scope BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE admin_users
SET
  user_scope = CASE
    WHEN restaurant_key <> ''
      AND tenant_id <> ''
      AND restaurant_id <> ''
      AND user_type IN (
        'OWNER', 'GERENTE', 'SUBGERENTE', 'CAIXA', 'COZINHA', 'GARCOM',
        'BAR', 'ESTOQUE', 'FINANCEIRO', 'MARKETING', 'ENTREGADOR',
        'ATENDENTE', 'CUSTOM'
      ) THEN 'RESTAURANT'
    WHEN restaurant_key = ''
      AND tenant_id = ''
      AND restaurant_id = ''
      AND user_type IN (
        'MASTER', 'SOCIO', 'DESENVOLVEDOR', 'SUPORTE', 'VENDEDOR',
        'COMERCIAL', 'FINANCEIRO_INOVAS', 'IMPLANTACAO',
        'CUSTOMER_SUCCESS', 'AUDITOR'
      ) THEN 'SYSTEM'
    ELSE 'UNASSIGNED'
  END,
  platform_scope = (
    restaurant_key = ''
    AND tenant_id = ''
    AND restaurant_id = ''
    AND user_type IN (
      'MASTER', 'SOCIO', 'DESENVOLVEDOR', 'SUPORTE', 'VENDEDOR',
      'COMERCIAL', 'FINANCEIRO_INOVAS', 'IMPLANTACAO',
      'CUSTOMER_SUCCESS', 'AUDITOR'
    )
  );

ALTER TABLE admin_users
  DROP CONSTRAINT IF EXISTS admin_users_user_scope_check,
  DROP CONSTRAINT IF EXISTS admin_users_system_scope_check,
  DROP CONSTRAINT IF EXISTS admin_users_restaurant_scope_check;

ALTER TABLE admin_users
  ADD CONSTRAINT admin_users_user_scope_check
    CHECK (user_scope IN ('SYSTEM', 'RESTAURANT', 'UNASSIGNED')),
  ADD CONSTRAINT admin_users_system_scope_check
    CHECK (
      user_scope <> 'SYSTEM'
      OR (
        platform_scope = TRUE
        AND tenant_id = ''
        AND restaurant_id = ''
        AND restaurant_key = ''
      )
    ),
  ADD CONSTRAINT admin_users_restaurant_scope_check
    CHECK (
      user_scope <> 'RESTAURANT'
      OR (
        platform_scope = FALSE
        AND tenant_id <> ''
        AND restaurant_id <> ''
        AND restaurant_key <> ''
      )
    );

CREATE INDEX IF NOT EXISTS admin_users_scope_status_idx
ON admin_users (user_scope, status);

INSERT INTO permission_definitions (
  key, domain, module, action, risk_level,
  dependencies_json, description, version, active
)
VALUES
  (
    'system.roles.view', 'SYSTEM', 'roles', 'view', 'LOW', '[]'::jsonb,
    'Visualizar perfis e permissões.', '2026.08.04', TRUE
  ),
  (
    'system.roles.manage', 'SYSTEM', 'roles', 'manage', 'CRITICAL',
    '["system.roles.view"]'::jsonb,
    'Administrar perfis e permissões.', '2026.08.04', TRUE
  ),
  (
    'system.integrations.view', 'SYSTEM', 'integrations', 'view', 'LOW', '[]'::jsonb,
    'Visualizar integrações da plataforma.', '2026.08.04', TRUE
  ),
  (
    'system.integrations.manage', 'SYSTEM', 'integrations', 'manage', 'CRITICAL',
    '["system.integrations.view"]'::jsonb,
    'Configurar integrações da plataforma.', '2026.08.04', TRUE
  ),
  ('tenant.orders.create', 'RESTAURANT', 'orders', 'create', 'HIGH', '["tenant.orders.view"]'::jsonb, 'Criar pedidos.', '2026.08.04', TRUE),
  ('tenant.orders.cancel', 'RESTAURANT', 'orders', 'cancel', 'HIGH', '["tenant.orders.view"]'::jsonb, 'Cancelar pedidos.', '2026.08.04', TRUE),
  ('tenant.orders.delete', 'RESTAURANT', 'orders', 'delete', 'CRITICAL', '["tenant.orders.view"]'::jsonb, 'Excluir pedidos.', '2026.08.04', TRUE),
  ('tenant.customers.create', 'RESTAURANT', 'customers', 'create', 'LOW', '["tenant.customers.view"]'::jsonb, 'Cadastrar clientes.', '2026.08.04', TRUE),
  ('tenant.customers.edit', 'RESTAURANT', 'customers', 'edit', 'MEDIUM', '["tenant.customers.view"]'::jsonb, 'Editar clientes.', '2026.08.04', TRUE),
  ('tenant.customers.delete', 'RESTAURANT', 'customers', 'delete', 'HIGH', '["tenant.customers.view"]'::jsonb, 'Excluir clientes.', '2026.08.04', TRUE),
  ('tenant.catalog.create', 'RESTAURANT', 'catalog', 'create', 'HIGH', '["tenant.catalog.view"]'::jsonb, 'Criar produtos e seções.', '2026.08.04', TRUE),
  ('tenant.catalog.delete', 'RESTAURANT', 'catalog', 'delete', 'CRITICAL', '["tenant.catalog.view"]'::jsonb, 'Excluir produtos e seções.', '2026.08.04', TRUE),
  ('tenant.promotions.view', 'RESTAURANT', 'promotions', 'view', 'LOW', '[]'::jsonb, 'Visualizar promoções.', '2026.08.04', TRUE),
  ('tenant.promotions.create', 'RESTAURANT', 'promotions', 'create', 'HIGH', '["tenant.promotions.view"]'::jsonb, 'Criar promoções.', '2026.08.04', TRUE),
  ('tenant.promotions.edit', 'RESTAURANT', 'promotions', 'edit', 'HIGH', '["tenant.promotions.view"]'::jsonb, 'Editar promoções.', '2026.08.04', TRUE),
  ('tenant.promotions.delete', 'RESTAURANT', 'promotions', 'delete', 'CRITICAL', '["tenant.promotions.view"]'::jsonb, 'Excluir promoções.', '2026.08.04', TRUE),
  ('tenant.reviews.view', 'RESTAURANT', 'reviews', 'view', 'LOW', '[]'::jsonb, 'Visualizar avaliações.', '2026.08.04', TRUE),
  ('tenant.reviews.edit', 'RESTAURANT', 'reviews', 'edit', 'MEDIUM', '["tenant.reviews.view"]'::jsonb, 'Moderar avaliações.', '2026.08.04', TRUE),
  ('tenant.reviews.delete', 'RESTAURANT', 'reviews', 'delete', 'HIGH', '["tenant.reviews.view"]'::jsonb, 'Excluir avaliações.', '2026.08.04', TRUE),
  ('tenant.inventory.create', 'RESTAURANT', 'inventory', 'create', 'HIGH', '["tenant.inventory.view"]'::jsonb, 'Cadastrar itens de estoque.', '2026.08.04', TRUE),
  ('tenant.inventory.delete', 'RESTAURANT', 'inventory', 'delete', 'CRITICAL', '["tenant.inventory.view"]'::jsonb, 'Excluir itens de estoque.', '2026.08.04', TRUE),
  ('tenant.financial.create', 'RESTAURANT', 'financial', 'create', 'HIGH', '["tenant.financial.view"]'::jsonb, 'Lançar movimentações financeiras.', '2026.08.04', TRUE),
  ('tenant.financial.refund', 'RESTAURANT', 'financial', 'refund', 'CRITICAL', '["tenant.financial.view"]'::jsonb, 'Estornar pagamentos.', '2026.08.04', TRUE),
  ('tenant.users.create', 'RESTAURANT', 'users', 'create', 'HIGH', '["tenant.users.view"]'::jsonb, 'Criar usuários.', '2026.08.04', TRUE),
  ('tenant.users.edit', 'RESTAURANT', 'users', 'edit', 'HIGH', '["tenant.users.view"]'::jsonb, 'Editar usuários.', '2026.08.04', TRUE),
  ('tenant.users.delete', 'RESTAURANT', 'users', 'delete', 'CRITICAL', '["tenant.users.view"]'::jsonb, 'Excluir usuários.', '2026.08.04', TRUE),
  ('tenant.users.permissions', 'RESTAURANT', 'users', 'permissions', 'CRITICAL', '["tenant.users.view"]'::jsonb, 'Alterar perfis e permissões dos usuários.', '2026.08.04', TRUE),
  ('tenant.business_hours.view', 'RESTAURANT', 'business_hours', 'view', 'LOW', '[]'::jsonb, 'Visualizar horários.', '2026.08.04', TRUE),
  ('tenant.business_hours.edit', 'RESTAURANT', 'business_hours', 'edit', 'HIGH', '["tenant.business_hours.view"]'::jsonb, 'Editar horários.', '2026.08.04', TRUE),
  ('tenant.special_dates.view', 'RESTAURANT', 'special_dates', 'view', 'LOW', '[]'::jsonb, 'Visualizar datas especiais.', '2026.08.04', TRUE),
  ('tenant.special_dates.create', 'RESTAURANT', 'special_dates', 'create', 'LOW', '["tenant.special_dates.view"]'::jsonb, 'Criar datas especiais.', '2026.08.04', TRUE),
  ('tenant.special_dates.edit', 'RESTAURANT', 'special_dates', 'edit', 'LOW', '["tenant.special_dates.view"]'::jsonb, 'Editar datas especiais.', '2026.08.04', TRUE),
  ('tenant.special_dates.delete', 'RESTAURANT', 'special_dates', 'delete', 'HIGH', '["tenant.special_dates.view"]'::jsonb, 'Excluir datas especiais.', '2026.08.04', TRUE)
ON CONFLICT (key)
DO UPDATE SET
  domain = EXCLUDED.domain,
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  risk_level = EXCLUDED.risk_level,
  dependencies_json = EXCLUDED.dependencies_json,
  description = EXCLUDED.description,
  version = EXCLUDED.version,
  active = TRUE,
  updated_at = NOW();

INSERT INTO role_permission_bindings (
  domain, role_key, role_version, permission_key, created_at
)
SELECT 'SYSTEM', 'MASTER', role.version, permission.key, NOW()
FROM role_definitions AS role
CROSS JOIN permission_definitions AS permission
WHERE role.domain = 'SYSTEM'
  AND role.key = 'MASTER'
  AND role.active = TRUE
  AND permission.key IN (
    'system.roles.view', 'system.roles.manage',
    'system.integrations.view', 'system.integrations.manage'
  )
ON CONFLICT DO NOTHING;

INSERT INTO role_permission_bindings (
  domain, role_key, role_version, permission_key, created_at
)
SELECT 'SYSTEM', 'SOCIO', role.version, 'system.roles.view', NOW()
FROM role_definitions AS role
WHERE role.domain = 'SYSTEM'
  AND role.key = 'SOCIO'
  AND role.active = TRUE
ON CONFLICT DO NOTHING;

INSERT INTO role_permission_bindings (
  domain, role_key, role_version, permission_key, created_at
)
SELECT 'RESTAURANT', 'OWNER', role.version, permission.key, NOW()
FROM role_definitions AS role
CROSS JOIN permission_definitions AS permission
WHERE role.domain = 'RESTAURANT'
  AND role.key = 'OWNER'
  AND role.active = TRUE
  AND permission.domain = 'RESTAURANT'
  AND permission.active = TRUE
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS inovas_restaurant_permission_catalog ON permission_definitions;
CREATE POLICY inovas_restaurant_permission_catalog ON permission_definitions
FOR SELECT
USING (
  domain = 'RESTAURANT'
  AND current_setting('app.audience', true) IN ('restaurant', 'support')
);

DROP POLICY IF EXISTS inovas_restaurant_role_catalog ON role_definitions;
CREATE POLICY inovas_restaurant_role_catalog ON role_definitions
FOR SELECT
USING (
  domain = 'RESTAURANT'
  AND current_setting('app.audience', true) IN ('restaurant', 'support')
);

DROP POLICY IF EXISTS inovas_restaurant_role_binding_catalog ON role_permission_bindings;
CREATE POLICY inovas_restaurant_role_binding_catalog ON role_permission_bindings
FOR SELECT
USING (
  domain = 'RESTAURANT'
  AND current_setting('app.audience', true) IN ('restaurant', 'support')
);

-- Authentication may inspect only the exact identity's explicit affiliations.
DROP POLICY IF EXISTS inovas_system_principal_authentication ON system_principals;
CREATE POLICY inovas_system_principal_authentication ON system_principals
FOR SELECT
USING (
  current_setting('app.audience', true) = 'authentication'
  AND identity_id = current_setting('app.identity_id', true)
);

DROP POLICY IF EXISTS inovas_membership_authentication ON restaurant_memberships;
CREATE POLICY inovas_membership_authentication ON restaurant_memberships
FOR SELECT
USING (
  current_setting('app.audience', true) = 'authentication'
  AND identity_id = current_setting('app.identity_id', true)
);

DROP POLICY IF EXISTS inovas_auth_audit_insert ON user_audit_events;
CREATE POLICY inovas_auth_audit_insert ON user_audit_events
FOR INSERT
WITH CHECK (
  current_setting('app.audience', true) = 'authentication'
  AND actor_identity_id IS NULL
  AND target_identity_id IS NULL
  AND tenant_id IS NULL
  AND restaurant_id IS NULL
);

DROP POLICY IF EXISTS inovas_admin_users_select ON admin_users;
DROP POLICY IF EXISTS inovas_admin_users_insert ON admin_users;
DROP POLICY IF EXISTS inovas_admin_users_update ON admin_users;
DROP POLICY IF EXISTS inovas_admin_users_delete ON admin_users;

CREATE POLICY inovas_admin_users_select ON admin_users
FOR SELECT USING (
  (
    current_setting('app.audience', true) = 'authentication'
    AND LOWER(login) = LOWER(current_setting('app.login', true))
  )
  OR (
    current_setting('app.audience', true) = 'system'
    AND user_scope = 'SYSTEM'
    AND platform_scope = TRUE
  )
  OR (
    current_setting('app.audience', true) IN ('restaurant', 'provisioning')
    AND user_scope = 'RESTAURANT'
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
  )
  OR (
    current_setting('app.audience', true) = 'support'
    AND current_setting('app.support_mode', true) = 'ADMIN'
    AND user_scope = 'RESTAURANT'
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
  )
);

CREATE POLICY inovas_admin_users_insert ON admin_users
FOR INSERT WITH CHECK (
  (
    current_setting('app.audience', true) = 'system'
    AND user_scope = 'SYSTEM'
    AND platform_scope = TRUE
  )
  OR (
    current_setting('app.audience', true) IN ('restaurant', 'provisioning')
    AND user_scope = 'RESTAURANT'
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
  )
  OR (
    current_setting('app.audience', true) = 'support'
    AND current_setting('app.support_mode', true) = 'ADMIN'
    AND user_scope = 'RESTAURANT'
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
  )
);

CREATE POLICY inovas_admin_users_update ON admin_users
FOR UPDATE
USING (
  (
    current_setting('app.audience', true) = 'system'
    AND user_scope = 'SYSTEM'
    AND platform_scope = TRUE
  )
  OR (
    current_setting('app.audience', true) IN ('restaurant', 'provisioning')
    AND user_scope = 'RESTAURANT'
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
  )
  OR (
    current_setting('app.audience', true) = 'support'
    AND current_setting('app.support_mode', true) = 'ADMIN'
    AND user_scope = 'RESTAURANT'
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
  )
)
WITH CHECK (
  (
    current_setting('app.audience', true) = 'system'
    AND user_scope = 'SYSTEM'
    AND platform_scope = TRUE
  )
  OR (
    current_setting('app.audience', true) IN ('restaurant', 'provisioning')
    AND user_scope = 'RESTAURANT'
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
  )
  OR (
    current_setting('app.audience', true) = 'support'
    AND current_setting('app.support_mode', true) = 'ADMIN'
    AND user_scope = 'RESTAURANT'
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
  )
);

CREATE POLICY inovas_admin_users_delete ON admin_users
FOR DELETE USING (
  (
    current_setting('app.audience', true) = 'system'
    AND user_scope = 'SYSTEM'
    AND platform_scope = TRUE
  )
  OR (
    current_setting('app.audience', true) IN ('restaurant', 'support')
    AND user_scope = 'RESTAURANT'
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND (
      current_setting('app.audience', true) = 'restaurant'
      OR current_setting('app.support_mode', true) = 'ADMIN'
    )
  )
);

-- Exact legacy recovery requested for Kasulo Rocha Pizzaria.
UPDATE admin_users
SET
  tenant_id = 'tenant_kasulo_rocha_pizzaria',
  restaurant_id = 'restaurant_kasulo_rocha_pizzaria',
  restaurant_key = 'kasulo-rocha-pizzaria',
  user_type = 'OWNER',
  user_scope = 'RESTAURANT',
  platform_scope = FALSE,
  base_role = 'OWNER',
  profile_version = '2026.08.04',
  job_title = 'Proprietário',
  department = 'Administração',
  grant_overrides_json = '[]'::jsonb,
  deny_overrides_json = '[]'::jsonb,
  audit_json = CASE
    WHEN COALESCE(audit_json, '[]'::jsonb) @> '[{"id":"user_evt_kasulo_scope_recovered_20260804"}]'::jsonb
      THEN COALESCE(audit_json, '[]'::jsonb)
    ELSE COALESCE(audit_json, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'id', 'user_evt_kasulo_scope_recovered_20260804',
        'action', 'IDENTITY_SCOPE_RECOVERED',
        'actorType', 'MIGRATION',
        'actorLogin', 'codex@inovasfood.com.br',
        'restaurantKey', 'kasulo-rocha-pizzaria',
        'userType', 'OWNER',
        'status', 'ACTIVE',
        'createdAt', NOW(),
        'metadata', jsonb_build_object(
          'fromDomain', 'SYSTEM',
          'toDomain', 'RESTAURANT',
          'reason', 'legacy_owner_created_as_commercial'
        )
      )
    )
  END,
  updated_at = NOW()
WHERE LOWER(login) = 'kasulorochapizzaria@gmail.com'
   OR LOWER(email) = 'kasulorochapizzaria@gmail.com';

INSERT INTO restaurant_memberships (
  id, identity_id, tenant_id, restaurant_id, restaurant_key,
  restaurant_role, status, invited_by, created_at, updated_at
)
SELECT
  'membership_' || SUBSTRING(
    ENCODE(DIGEST(i.id || ':tenant_kasulo_rocha_pizzaria:restaurant_kasulo_rocha_pizzaria', 'sha256'), 'hex'),
    1,
    24
  ),
  i.id,
  'tenant_kasulo_rocha_pizzaria',
  'restaurant_kasulo_rocha_pizzaria',
  'kasulo-rocha-pizzaria',
  'OWNER',
  'ACTIVE',
  'usermaster@gmail.com',
  NOW(),
  NOW()
FROM identities AS i
WHERE LOWER(i.login) = 'kasulorochapizzaria@gmail.com'
   OR LOWER(i.email) = 'kasulorochapizzaria@gmail.com'
ON CONFLICT (identity_id, tenant_id, restaurant_id)
DO UPDATE SET
  restaurant_key = EXCLUDED.restaurant_key,
  restaurant_role = 'OWNER',
  status = 'ACTIVE',
  updated_at = NOW();

INSERT INTO restaurant_role_bindings (
  id, membership_id, role_key, role_version, granted_by, granted_at
)
SELECT
  'restaurant_binding_' || SUBSTRING(
    ENCODE(DIGEST(m.id || ':OWNER', 'sha256'), 'hex'),
    1,
    24
  ),
  m.id,
  'OWNER',
  '2026.07.25',
  'usermaster@gmail.com',
  NOW()
FROM restaurant_memberships AS m
WHERE m.restaurant_key = 'kasulo-rocha-pizzaria'
  AND m.restaurant_role = 'OWNER'
ON CONFLICT (membership_id, role_key)
DO UPDATE SET revoked_at = NULL;

INSERT INTO user_audit_events (
  id, actor_identity_id, actor_type, target_identity_id,
  tenant_id, restaurant_id, event_type, result, reason,
  before_json, after_json, request_id, metadata_json, created_at
)
SELECT
  'audit_kasulo_scope_recovered_20260804',
  NULL,
  'MIGRATION',
  i.id,
  'tenant_kasulo_rocha_pizzaria',
  'restaurant_kasulo_rocha_pizzaria',
  'IDENTITY_SCOPE_RECOVERED',
  'SUCCESS',
  'Proprietário legado criado indevidamente como COMERCIAL do System.',
  jsonb_build_object('domain', 'SYSTEM', 'role', 'COMERCIAL'),
  jsonb_build_object(
    'domain', 'RESTAURANT',
    'role', 'OWNER',
    'restaurantKey', 'kasulo-rocha-pizzaria'
  ),
  'migration-026',
  jsonb_build_object('sessionsRevoked', TRUE, 'systemPrincipalRemoved', TRUE),
  NOW()
FROM identities AS i
WHERE LOWER(i.login) = 'kasulorochapizzaria@gmail.com'
   OR LOWER(i.email) = 'kasulorochapizzaria@gmail.com'
ON CONFLICT (id) DO NOTHING;

UPDATE auth_sessions
SET
  status = 'REVOKED',
  revoked_at = NOW(),
  revoked_by = 'migration-026'
WHERE identity_id IN (
  SELECT id
  FROM identities
  WHERE LOWER(login) = 'kasulorochapizzaria@gmail.com'
     OR LOWER(email) = 'kasulorochapizzaria@gmail.com'
)
  AND audience = 'system'
  AND status = 'ACTIVE';

DELETE FROM system_principals
WHERE identity_id IN (
  SELECT id
  FROM identities
  WHERE LOWER(login) = 'kasulorochapizzaria@gmail.com'
     OR LOWER(email) = 'kasulorochapizzaria@gmail.com'
);

-- Kasulo operates only through the authenticated INOVAS panel in this phase.
DELETE FROM public_restaurant_routes
WHERE restaurant_key = 'kasulo-rocha-pizzaria';

INSERT INTO restaurant_settings (
  tenant_id, restaurant_id, restaurant_key, settings_json,
  created_at, updated_at, updated_by_login, updated_by_display_name
)
VALUES (
  'tenant_kasulo_rocha_pizzaria',
  'restaurant_kasulo_rocha_pizzaria',
  'kasulo-rocha-pizzaria',
  jsonb_build_object(
    'tenantId', 'tenant_kasulo_rocha_pizzaria',
    'restaurantId', 'restaurant_kasulo_rocha_pizzaria',
    'restaurantKey', 'kasulo-rocha-pizzaria',
    'restaurantName', 'Kasulo Rocha Pizzaria',
    'logoUrl', 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiAsb73JVRuYDoR56VDuy5XnJukDRG7lQXOdbvl1Jje2qpa8F9SrYrjxUf077yMBKTOinZlatJ1zbkKs3LWjiaUHfOUMTF7kzxiEJQYtvrBdezQ4Lys1Zq0236XmrV1KrvSMbUuFYOMYY9MN8N1DpU4sGiVs11lOFZ41KgynOpbQsT9iuO3opsMaPBnG10/s320/kasulinho.png',
    'bannerUrl', 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEi4MqBQU_tKWXWlD8B8u7GmIfppz7bP71HyE3ZURSC4vg2VPfXnoc7PLCM4kLcN_wgFxZtAVdHOnoy8M145Agru134fFLQY3d39BrirldQesAp8WLqLPIlA5JDCA0M-l4L0nZYdNwh2ysc4q-FqcjAMcCb98SR0ClxQRT_dpLbUr-eNRDFkFkz14wkUycA/s320/pizzaria-kasulo-franca-pizza-lombo-canadense.png',
    'primaryColor', '#d93025',
    'secondaryColor', '#f97316',
    'accentColor', '#facc15',
    'gradientStart', '#d93025',
    'gradientEnd', '#f97316',
    'useGradient', TRUE,
    'siteLayout', 'MODERN',
    'siteTheme', 'LIGHT',
    'slogan', 'Muita pizza, boas companhias e momentos inesquecíveis',
    'description', 'Pizzaria Kasulo Rocha em Franca - SP',
    'presentationText', 'Kasulo Rocha Pizzaria — sabores salgados, doces, bebidas e rodízio no salão.',
    'whatsapp', '+5516991744108',
    'address', 'Rua Batatais, 1106 - Centro, Franca - SP',
    'addressFields', jsonb_build_object(
      'postalCode', '', 'street', 'Rua Batatais', 'number', '1106',
      'complement', '', 'neighborhood', 'Centro', 'city', 'Franca', 'state', 'SP'
    ),
    'businessHours', 'Terça a Domingo das 18:00 às 23:30',
    'publicSiteEnabled', FALSE,
    'menuSourceUrl', 'https://www.kasulopizzaria.com.br/?m=1',
    'hasStructuredBusinessSchedule', FALSE,
    'updatedByLogin', 'migration-026',
    'updatedByDisplayName', 'Recuperação segura do tenant'
  ),
  NOW(),
  NOW(),
  'migration-026',
  'Recuperação segura do tenant'
)
ON CONFLICT (tenant_id, restaurant_id, restaurant_key)
DO UPDATE SET
  settings_json = EXCLUDED.settings_json,
  updated_at = NOW(),
  updated_by_login = EXCLUDED.updated_by_login,
  updated_by_display_name = EXCLUDED.updated_by_display_name;

COMMIT;
