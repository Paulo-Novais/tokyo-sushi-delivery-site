-- INOVAS Food — SYSTEM × RESTAURANT security boundary
-- Apply only after confirming an isolated Preview database branch.
-- The application runtime role is configured separately after this migration.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $preflight$
BEGIN
  IF current_database() IS NULL THEN
    RAISE EXCEPTION 'Database preflight failed.';
  END IF;

  IF to_regclass('public.admin_users') IS NULL THEN
    RAISE EXCEPTION 'admin_users is required before migration 015.';
  END IF;
END
$preflight$;

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS job_title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS credential_mode TEXT NOT NULL DEFAULT 'TEMPORARY_PASSWORD',
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS invitation_token_hash TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invitation_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invitation_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS audit_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS base_role TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS grant_overrides_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS deny_overrides_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS profile_version TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS identities (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  login TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  credential_status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (credential_status IN ('ACTIVE', 'PENDING', 'BLOCKED', 'DISABLED')),
  failed_login_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
  locked_until TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS identities_email_lower_uidx
  ON identities (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS identities_login_lower_uidx
  ON identities (LOWER(login));

CREATE TABLE IF NOT EXISTS system_principals (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL UNIQUE REFERENCES identities(id) ON DELETE CASCADE,
  system_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'PENDING', 'BLOCKED')),
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_role_bindings (
  id TEXT PRIMARY KEY,
  principal_id TEXT NOT NULL REFERENCES system_principals(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL,
  role_version TEXT NOT NULL DEFAULT '2026.07.25',
  granted_by TEXT NOT NULL DEFAULT '',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (principal_id, role_key)
);

CREATE TABLE IF NOT EXISTS restaurant_memberships (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_key TEXT NOT NULL,
  restaurant_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'PENDING', 'BLOCKED', 'DISABLED')),
  invited_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (identity_id, tenant_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS restaurant_memberships_scope_idx
  ON restaurant_memberships (tenant_id, restaurant_id, status);

CREATE TABLE IF NOT EXISTS restaurant_role_bindings (
  id TEXT PRIMARY KEY,
  membership_id TEXT NOT NULL REFERENCES restaurant_memberships(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL,
  role_version TEXT NOT NULL DEFAULT '2026.07.25',
  granted_by TEXT NOT NULL DEFAULT '',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (membership_id, role_key)
);

CREATE TABLE IF NOT EXISTS permission_definitions (
  key TEXT PRIMARY KEY,
  domain TEXT NOT NULL CHECK (domain IN ('SYSTEM', 'RESTAURANT')),
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'LOW'
    CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  dependencies_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_definitions (
  key TEXT NOT NULL,
  domain TEXT NOT NULL CHECK (domain IN ('SYSTEM', 'RESTAURANT')),
  label TEXT NOT NULL,
  authority_level INTEGER NOT NULL DEFAULT 0 CHECK (authority_level >= 0),
  version TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (domain, key, version)
);

CREATE TABLE IF NOT EXISTS role_permission_bindings (
  domain TEXT NOT NULL,
  role_key TEXT NOT NULL,
  role_version TEXT NOT NULL,
  permission_key TEXT NOT NULL REFERENCES permission_definitions(key),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (domain, role_key, role_version, permission_key),
  FOREIGN KEY (domain, role_key, role_version)
    REFERENCES role_definitions(domain, key, version)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS permission_overrides (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  principal_id TEXT REFERENCES system_principals(id) ON DELETE CASCADE,
  membership_id TEXT REFERENCES restaurant_memberships(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permission_definitions(key),
  effect TEXT NOT NULL CHECK (effect IN ('GRANT', 'DENY')),
  reason TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CHECK (
    (principal_id IS NOT NULL AND membership_id IS NULL)
    OR (principal_id IS NULL AND membership_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS permission_overrides_identity_idx
  ON permission_overrides (identity_id, revoked_at);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  audience TEXT NOT NULL CHECK (audience IN ('system', 'restaurant')),
  jti_hash TEXT NOT NULL UNIQUE,
  principal_id TEXT REFERENCES system_principals(id) ON DELETE CASCADE,
  membership_id TEXT REFERENCES restaurant_memberships(id) ON DELETE CASCADE,
  tenant_id TEXT,
  restaurant_id TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  CHECK (
    (audience = 'system' AND principal_id IS NOT NULL
      AND membership_id IS NULL AND tenant_id IS NULL AND restaurant_id IS NULL)
    OR
    (audience = 'restaurant' AND membership_id IS NOT NULL
      AND principal_id IS NULL AND tenant_id IS NOT NULL AND restaurant_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS auth_sessions_active_identity_idx
  ON auth_sessions (identity_id, audience, status, expires_at DESC);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  membership_id TEXT REFERENCES restaurant_memberships(id) ON DELETE CASCADE,
  principal_id TEXT REFERENCES system_principals(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'USED', 'EXPIRED', 'REVOKED')),
  expires_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (membership_id IS NOT NULL AND principal_id IS NULL)
    OR (membership_id IS NULL AND principal_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS invitations_pending_idx
  ON invitations (identity_id, status, expires_at DESC);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_support_sessions (
  id TEXT PRIMARY KEY,
  system_identity_id TEXT NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  system_session_id TEXT NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_key TEXT NOT NULL,
  restaurant_name TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL CHECK (mode IN ('VIEW', 'ADMIN')),
  reason TEXT NOT NULL CHECK (LENGTH(reason) >= 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT NOT NULL DEFAULT '',
  confirmation_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  request_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED'))
);

CREATE INDEX IF NOT EXISTS system_support_sessions_active_idx
  ON system_support_sessions
    (system_identity_id, status, expires_at DESC);
CREATE INDEX IF NOT EXISTS system_support_sessions_scope_idx
  ON system_support_sessions
    (tenant_id, restaurant_id, status, expires_at DESC);

CREATE TABLE IF NOT EXISTS user_audit_events (
  id TEXT PRIMARY KEY,
  actor_identity_id TEXT REFERENCES identities(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL,
  target_identity_id TEXT REFERENCES identities(id) ON DELETE SET NULL,
  tenant_id TEXT,
  restaurant_id TEXT,
  event_type TEXT NOT NULL,
  result TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  before_json JSONB,
  after_json JSONB,
  request_id TEXT NOT NULL DEFAULT '',
  support_session_id TEXT REFERENCES system_support_sessions(id) ON DELETE SET NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_audit_events_scope_idx
  ON user_audit_events (tenant_id, restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_audit_events_actor_idx
  ON user_audit_events (actor_identity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_health_snapshots (
  id TEXT PRIMARY KEY,
  captured_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  active_restaurants INTEGER NOT NULL DEFAULT 0,
  suspended_restaurants INTEGER NOT NULL DEFAULT 0,
  degraded_restaurants INTEGER NOT NULL DEFAULT 0,
  integration_failures INTEGER NOT NULL DEFAULT 0,
  critical_alerts INTEGER NOT NULL DEFAULT 0,
  metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS platform_health_snapshots_captured_idx
  ON platform_health_snapshots (captured_at DESC);

CREATE TABLE IF NOT EXISTS platform_usage_daily (
  usage_date DATE NOT NULL,
  metric_key TEXT NOT NULL,
  metric_value NUMERIC NOT NULL DEFAULT 0,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (usage_date, metric_key)
);

CREATE TABLE IF NOT EXISTS integration_health (
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  integration_key TEXT NOT NULL,
  status TEXT NOT NULL,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  error_code TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, restaurant_id, integration_key)
);

CREATE TABLE IF NOT EXISTS tenant_health_scores (
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_key TEXT NOT NULL,
  health_status TEXT NOT NULL,
  health_score INTEGER NOT NULL CHECK (health_score BETWEEN 0 AND 100),
  last_heartbeat_at TIMESTAMPTZ,
  domain_status TEXT NOT NULL DEFAULT 'UNKNOWN',
  failed_integrations INTEGER NOT NULL DEFAULT 0,
  pending_jobs INTEGER NOT NULL DEFAULT 0,
  critical_errors INTEGER NOT NULL DEFAULT 0,
  backup_status TEXT NOT NULL DEFAULT 'UNKNOWN',
  version TEXT NOT NULL DEFAULT '',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, restaurant_id)
);

CREATE TABLE IF NOT EXISTS system_alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  restaurant_id TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

INSERT INTO identities (
  id,
  email,
  login,
  display_name,
  password_hash,
  credential_status,
  created_at,
  updated_at
)
SELECT
  'identity_' || SUBSTRING(
    ENCODE(DIGEST(LOWER(COALESCE(NULLIF(email, ''), login)), 'sha256'), 'hex'),
    1,
    24
  ),
  LOWER(COALESCE(NULLIF(email, ''), login)),
  LOWER(login),
  name,
  password_hash,
  CASE
    WHEN status IN ('ACTIVE', 'PENDING', 'BLOCKED') THEN status
    ELSE 'BLOCKED'
  END,
  created_at,
  updated_at
FROM admin_users
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  login = EXCLUDED.login,
  display_name = EXCLUDED.display_name,
  password_hash = EXCLUDED.password_hash,
  credential_status = EXCLUDED.credential_status,
  updated_at = EXCLUDED.updated_at;

INSERT INTO system_principals (
  id,
  identity_id,
  system_role,
  status,
  created_by,
  created_at,
  updated_at
)
SELECT
  'system_principal_' || SUBSTRING(
    ENCODE(DIGEST(
      'identity_' || SUBSTRING(
        ENCODE(DIGEST(LOWER(COALESCE(NULLIF(email, ''), login)), 'sha256'), 'hex'),
        1,
        24
      ),
      'sha256'
    ), 'hex'),
    1,
    24
  ),
  'identity_' || SUBSTRING(
    ENCODE(DIGEST(LOWER(COALESCE(NULLIF(email, ''), login)), 'sha256'), 'hex'),
    1,
    24
  ),
  user_type,
  status,
  created_by,
  created_at,
  updated_at
FROM admin_users
WHERE user_type IN (
  'MASTER', 'SOCIO', 'DESENVOLVEDOR', 'SUPORTE', 'VENDEDOR', 'COMERCIAL',
  'FINANCEIRO_INOVAS', 'IMPLANTACAO', 'CUSTOMER_SUCCESS', 'AUDITOR'
)
  OR restaurant_key = ''
ON CONFLICT (identity_id) DO UPDATE SET
  system_role = EXCLUDED.system_role,
  status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at;

INSERT INTO restaurant_memberships (
  id,
  identity_id,
  tenant_id,
  restaurant_id,
  restaurant_key,
  restaurant_role,
  status,
  invited_by,
  created_at,
  updated_at
)
SELECT
  'membership_' || SUBSTRING(
    ENCODE(DIGEST(
      (
        'identity_' || SUBSTRING(
          ENCODE(DIGEST(LOWER(COALESCE(NULLIF(email, ''), login)), 'sha256'), 'hex'),
          1,
          24
        )
      ) || ':' || tenant_id || ':' || restaurant_id,
      'sha256'
    ), 'hex'),
    1,
    24
  ),
  'identity_' || SUBSTRING(
    ENCODE(DIGEST(LOWER(COALESCE(NULLIF(email, ''), login)), 'sha256'), 'hex'),
    1,
    24
  ),
  tenant_id,
  restaurant_id,
  restaurant_key,
  user_type,
  status,
  created_by,
  created_at,
  updated_at
FROM admin_users
WHERE NOT (
  user_type IN (
    'MASTER', 'SOCIO', 'DESENVOLVEDOR', 'SUPORTE', 'VENDEDOR', 'COMERCIAL',
    'FINANCEIRO_INOVAS', 'IMPLANTACAO', 'CUSTOMER_SUCCESS', 'AUDITOR'
  )
  OR restaurant_key = ''
)
ON CONFLICT (identity_id, tenant_id, restaurant_id) DO UPDATE SET
  restaurant_key = EXCLUDED.restaurant_key,
  restaurant_role = EXCLUDED.restaurant_role,
  status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at;

INSERT INTO system_role_bindings (id, principal_id, role_key, role_version, granted_by)
SELECT
  'system_binding_' || SUBSTRING(
    ENCODE(DIGEST(id || ':' || system_role, 'sha256'), 'hex'),
    1,
    24
  ),
  id,
  system_role,
  '2026.07.25',
  created_by
FROM system_principals
ON CONFLICT (principal_id, role_key) DO NOTHING;

INSERT INTO restaurant_role_bindings (id, membership_id, role_key, role_version, granted_by)
SELECT
  'restaurant_binding_' || SUBSTRING(
    ENCODE(DIGEST(id || ':' || restaurant_role, 'sha256'), 'hex'),
    1,
    24
  ),
  id,
  restaurant_role,
  '2026.07.25',
  invited_by
FROM restaurant_memberships
ON CONFLICT (membership_id, role_key) DO NOTHING;

INSERT INTO permission_definitions (
  key, domain, module, action, risk_level, dependencies_json, description, version
)
VALUES
  ('system.dashboard.view', 'SYSTEM', 'dashboard', 'view', 'LOW', '[]', 'Visualizar painel da plataforma.', '2026.07.25'),
  ('system.restaurants.view', 'SYSTEM', 'restaurants', 'view', 'LOW', '[]', 'Visualizar restaurantes.', '2026.07.25'),
  ('system.restaurants.create', 'SYSTEM', 'restaurants', 'create', 'HIGH', '["system.restaurants.view"]', 'Cadastrar restaurantes.', '2026.07.25'),
  ('system.restaurants.edit', 'SYSTEM', 'restaurants', 'edit', 'HIGH', '["system.restaurants.view"]', 'Editar restaurantes.', '2026.07.25'),
  ('system.restaurants.suspend', 'SYSTEM', 'restaurants', 'suspend', 'CRITICAL', '["system.restaurants.view"]', 'Suspender restaurantes.', '2026.07.25'),
  ('system.plans.manage', 'SYSTEM', 'plans', 'manage', 'HIGH', '[]', 'Administrar planos.', '2026.07.25'),
  ('system.domains.manage', 'SYSTEM', 'domains', 'manage', 'HIGH', '[]', 'Administrar domínios.', '2026.07.25'),
  ('system.health.view', 'SYSTEM', 'health', 'view', 'LOW', '[]', 'Visualizar saúde técnica.', '2026.07.25'),
  ('system.audit.view', 'SYSTEM', 'audit', 'view', 'MEDIUM', '[]', 'Visualizar auditoria.', '2026.07.25'),
  ('system.users.view', 'SYSTEM', 'users', 'view', 'LOW', '[]', 'Visualizar usuários internos.', '2026.07.25'),
  ('system.users.manage', 'SYSTEM', 'users', 'manage', 'CRITICAL', '["system.users.view"]', 'Administrar usuários internos.', '2026.07.25'),
  ('system.support.start', 'SYSTEM', 'support', 'start', 'HIGH', '["system.restaurants.view"]', 'Iniciar suporte VIEW.', '2026.07.25'),
  ('system.support.admin', 'SYSTEM', 'support', 'admin', 'CRITICAL', '["system.support.start"]', 'Iniciar suporte ADMIN.', '2026.07.25'),
  ('system.billing.view', 'SYSTEM', 'billing', 'view', 'LOW', '[]', 'Visualizar faturamento.', '2026.07.25'),
  ('system.billing.manage', 'SYSTEM', 'billing', 'manage', 'CRITICAL', '["system.billing.view"]', 'Administrar faturamento.', '2026.07.25'),
  ('tenant.dashboard.view', 'RESTAURANT', 'dashboard', 'view', 'LOW', '[]', 'Visualizar painel.', '2026.07.25'),
  ('tenant.orders.view', 'RESTAURANT', 'orders', 'view', 'LOW', '[]', 'Visualizar pedidos.', '2026.07.25'),
  ('tenant.orders.edit', 'RESTAURANT', 'orders', 'edit', 'HIGH', '["tenant.orders.view"]', 'Editar pedidos.', '2026.07.25'),
  ('tenant.customers.view', 'RESTAURANT', 'customers', 'view', 'MEDIUM', '[]', 'Visualizar clientes.', '2026.07.25'),
  ('tenant.catalog.view', 'RESTAURANT', 'catalog', 'view', 'LOW', '[]', 'Visualizar cardápio.', '2026.07.25'),
  ('tenant.catalog.edit', 'RESTAURANT', 'catalog', 'edit', 'HIGH', '["tenant.catalog.view"]', 'Editar cardápio.', '2026.07.25'),
  ('tenant.inventory.view', 'RESTAURANT', 'inventory', 'view', 'LOW', '[]', 'Visualizar estoque.', '2026.07.25'),
  ('tenant.inventory.edit', 'RESTAURANT', 'inventory', 'edit', 'HIGH', '["tenant.inventory.view"]', 'Editar estoque.', '2026.07.25'),
  ('tenant.financial.view', 'RESTAURANT', 'financial', 'view', 'HIGH', '[]', 'Visualizar financeiro.', '2026.07.25'),
  ('tenant.financial.edit', 'RESTAURANT', 'financial', 'edit', 'CRITICAL', '["tenant.financial.view"]', 'Editar financeiro.', '2026.07.25'),
  ('tenant.delivery.view', 'RESTAURANT', 'delivery', 'view', 'LOW', '[]', 'Visualizar entregas.', '2026.07.25'),
  ('tenant.delivery.edit', 'RESTAURANT', 'delivery', 'edit', 'HIGH', '["tenant.delivery.view"]', 'Editar entregas.', '2026.07.25'),
  ('tenant.reports.view', 'RESTAURANT', 'reports', 'view', 'LOW', '[]', 'Visualizar relatórios.', '2026.07.25'),
  ('tenant.reports.export', 'RESTAURANT', 'reports', 'export', 'HIGH', '["tenant.reports.view"]', 'Exportar relatórios.', '2026.07.25'),
  ('tenant.settings.view', 'RESTAURANT', 'settings', 'view', 'LOW', '[]', 'Visualizar configurações.', '2026.07.25'),
  ('tenant.settings.edit', 'RESTAURANT', 'settings', 'edit', 'CRITICAL', '["tenant.settings.view"]', 'Editar configurações.', '2026.07.25'),
  ('tenant.users.view', 'RESTAURANT', 'users', 'view', 'LOW', '[]', 'Visualizar equipe.', '2026.07.25'),
  ('tenant.users.manage', 'RESTAURANT', 'users', 'manage', 'CRITICAL', '["tenant.users.view"]', 'Administrar equipe.', '2026.07.25'),
  ('tenant.audit.view', 'RESTAURANT', 'audit', 'view', 'MEDIUM', '[]', 'Visualizar auditoria.', '2026.07.25')
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

INSERT INTO role_definitions (domain, key, label, authority_level, version)
VALUES
  ('SYSTEM', 'MASTER', 'Master', 100, '2026.07.25'),
  ('SYSTEM', 'SOCIO', 'Sócio', 90, '2026.07.25'),
  ('SYSTEM', 'DESENVOLVEDOR', 'Desenvolvedor', 60, '2026.07.25'),
  ('SYSTEM', 'SUPORTE', 'Suporte', 50, '2026.07.25'),
  ('SYSTEM', 'COMERCIAL', 'Comercial', 30, '2026.07.25'),
  ('SYSTEM', 'FINANCEIRO_INOVAS', 'Financeiro INOVAS', 40, '2026.07.25'),
  ('SYSTEM', 'IMPLANTACAO', 'Implantação', 40, '2026.07.25'),
  ('SYSTEM', 'CUSTOMER_SUCCESS', 'Customer Success', 35, '2026.07.25'),
  ('SYSTEM', 'AUDITOR', 'Auditor', 20, '2026.07.25'),
  ('RESTAURANT', 'OWNER', 'Proprietário', 100, '2026.07.25'),
  ('RESTAURANT', 'ADMIN', 'Administrador', 90, '2026.07.25'),
  ('RESTAURANT', 'MANAGER', 'Gerente', 75, '2026.07.25'),
  ('RESTAURANT', 'CASHIER', 'Caixa', 35, '2026.07.25'),
  ('RESTAURANT', 'SERVICE', 'Atendimento', 30, '2026.07.25'),
  ('RESTAURANT', 'KITCHEN', 'Cozinha', 25, '2026.07.25'),
  ('RESTAURANT', 'INVENTORY', 'Estoque', 30, '2026.07.25'),
  ('RESTAURANT', 'FINANCE', 'Financeiro', 45, '2026.07.25'),
  ('RESTAURANT', 'DELIVERY', 'Entrega', 20, '2026.07.25'),
  ('RESTAURANT', 'READ_ONLY', 'Somente leitura', 10, '2026.07.25'),
  ('RESTAURANT', 'CUSTOM', 'Personalizado', 0, '2026.07.25')
ON CONFLICT (domain, key, version) DO UPDATE SET
  label = EXCLUDED.label,
  authority_level = EXCLUDED.authority_level,
  active = TRUE,
  updated_at = NOW();

-- Operational RLS: tenant scope is supplied by the connection options built
-- from a verified RestaurantSession or SupportSession. System has no policy.
DO $rls$
DECLARE
  table_name TEXT;
  public_select_tables CONSTANT TEXT[] := ARRAY[
    'catalog_item_overrides',
    'catalog_promotions',
    'catalog_runtime_state',
    'customer_reviews',
    'delivery_settings',
    'restaurant_settings'
  ];
  public_insert_tables CONSTANT TEXT[] := ARRAY[
    'customers',
    'customer_reviews',
    'orders',
    'order_items',
    'order_status_events'
  ];
  operational_tables CONSTANT TEXT[] := ARRAY[
    'catalog_item_overrides',
    'catalog_promotions',
    'catalog_runtime_state',
    'customer_crm_profiles',
    'customer_reviews',
    'customers',
    'delivery_settings',
    'finance_closings',
    'inventory_runtime_state',
    'order_items',
    'order_status_events',
    'orders',
    'restaurant_settings'
  ];
BEGIN
  FOREACH table_name IN ARRAY operational_tables LOOP
    IF to_regclass('public.' || table_name) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS inovas_tenant_select ON %I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS inovas_tenant_insert ON %I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS inovas_tenant_update ON %I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS inovas_tenant_delete ON %I', table_name);

    EXECUTE format(
      'CREATE POLICY inovas_tenant_select ON %I FOR SELECT USING (
        tenant_id = current_setting(''app.tenant_id'', true)
        AND restaurant_id = current_setting(''app.restaurant_id'', true)
        AND (
          current_setting(''app.audience'', true) IN (''restaurant'', ''support'')
          OR (
            current_setting(''app.audience'', true) = ''public''
            AND %L = ANY (%L::text[])
          )
        )
      )',
      table_name,
      table_name,
      public_select_tables
    );

    EXECUTE format(
      'CREATE POLICY inovas_tenant_insert ON %I FOR INSERT WITH CHECK (
        tenant_id = current_setting(''app.tenant_id'', true)
        AND restaurant_id = current_setting(''app.restaurant_id'', true)
        AND (
          current_setting(''app.audience'', true) = ''restaurant''
          OR (
            current_setting(''app.audience'', true) = ''support''
            AND current_setting(''app.support_mode'', true) = ''ADMIN''
          )
          OR (
            current_setting(''app.audience'', true) = ''public''
            AND %L = ANY (%L::text[])
          )
        )
      )',
      table_name,
      table_name,
      public_insert_tables
    );

    EXECUTE format(
      'CREATE POLICY inovas_tenant_update ON %I FOR UPDATE USING (
        tenant_id = current_setting(''app.tenant_id'', true)
        AND restaurant_id = current_setting(''app.restaurant_id'', true)
        AND (
          current_setting(''app.audience'', true) = ''restaurant''
          OR (
            current_setting(''app.audience'', true) = ''support''
            AND current_setting(''app.support_mode'', true) = ''ADMIN''
          )
        )
      ) WITH CHECK (
        tenant_id = current_setting(''app.tenant_id'', true)
        AND restaurant_id = current_setting(''app.restaurant_id'', true)
      )',
      table_name
    );

    EXECUTE format(
      'CREATE POLICY inovas_tenant_delete ON %I FOR DELETE USING (
        tenant_id = current_setting(''app.tenant_id'', true)
        AND restaurant_id = current_setting(''app.restaurant_id'', true)
        AND (
          current_setting(''app.audience'', true) = ''restaurant''
          OR (
            current_setting(''app.audience'', true) = ''support''
            AND current_setting(''app.support_mode'', true) = ''ADMIN''
          )
        )
      )',
      table_name
    );
  END LOOP;
END
$rls$;

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inovas_admin_users_select ON admin_users;
DROP POLICY IF EXISTS inovas_admin_users_insert ON admin_users;
DROP POLICY IF EXISTS inovas_admin_users_update ON admin_users;
DROP POLICY IF EXISTS inovas_admin_users_delete ON admin_users;

CREATE POLICY inovas_admin_users_select ON admin_users
FOR SELECT USING (
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
  OR
  (
    current_setting('app.audience', true) = 'restaurant'
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND restaurant_key <> ''
  )
  OR
  (
    current_setting('app.audience', true) = 'support'
    AND current_setting('app.support_mode', true) = 'ADMIN'
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND restaurant_key <> ''
  )
);

CREATE POLICY inovas_admin_users_insert ON admin_users
FOR INSERT WITH CHECK (
  (
    current_setting('app.audience', true) = 'system'
    AND (
      restaurant_key = ''
      OR user_type = 'OWNER'
    )
  )
  OR
  (
    current_setting('app.audience', true) = 'restaurant'
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND restaurant_key <> ''
  )
  OR
  (
    current_setting('app.audience', true) = 'support'
    AND current_setting('app.support_mode', true) = 'ADMIN'
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
  )
);

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
  OR
  (
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

CREATE POLICY inovas_admin_users_delete ON admin_users
FOR DELETE USING (
  (
    current_setting('app.audience', true) = 'system'
    AND restaurant_key = ''
  )
  OR
  (
    current_setting('app.audience', true) IN ('restaurant', 'support')
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND (
      current_setting('app.audience', true) = 'restaurant'
      OR current_setting('app.support_mode', true) = 'ADMIN'
    )
  )
);

DO $system_rls$
DECLARE
  table_name TEXT;
  system_tables CONSTANT TEXT[] := ARRAY[
    'master_platform_state',
    'system_principals',
    'system_role_bindings',
    'permission_definitions',
    'role_definitions',
    'role_permission_bindings',
    'platform_health_snapshots',
    'platform_usage_daily',
    'tenant_health_scores',
    'integration_health',
    'system_alerts'
  ];
BEGIN
  FOREACH table_name IN ARRAY system_tables LOOP
    IF to_regclass('public.' || table_name) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS inovas_system_only ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY inovas_system_only ON %I FOR ALL
       USING (current_setting(''app.audience'', true) = ''system'')
       WITH CHECK (current_setting(''app.audience'', true) = ''system'')',
      table_name
    );
  END LOOP;
END
$system_rls$;

ALTER TABLE identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE identities FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inovas_identity_access ON identities;

CREATE POLICY inovas_identity_select ON identities
FOR SELECT
USING (
  current_setting('app.audience', true) = 'system'
  OR id = current_setting('app.identity_id', true)
  OR EXISTS (
    SELECT 1
    FROM restaurant_memberships AS membership
    WHERE membership.identity_id = identities.id
      AND membership.tenant_id = current_setting('app.tenant_id', true)
      AND membership.restaurant_id = current_setting('app.restaurant_id', true)
      AND current_setting('app.audience', true) IN (
        'restaurant', 'support', 'provisioning'
      )
  )
);

CREATE POLICY inovas_identity_insert ON identities
FOR INSERT
WITH CHECK (
  current_setting('app.audience', true) = 'system'
  OR (
    current_setting('app.tenant_id', true) NOT IN ('', '__none__')
    AND current_setting('app.restaurant_id', true) NOT IN ('', '__none__')
    AND (
      current_setting('app.audience', true) IN ('restaurant', 'provisioning')
      OR (
        current_setting('app.audience', true) = 'support'
        AND current_setting('app.support_mode', true) = 'ADMIN'
      )
    )
  )
);

CREATE POLICY inovas_identity_update ON identities
FOR UPDATE
USING (
  current_setting('app.audience', true) = 'system'
  OR id = current_setting('app.identity_id', true)
  OR EXISTS (
    SELECT 1
    FROM restaurant_memberships AS membership
    WHERE membership.identity_id = identities.id
      AND membership.tenant_id = current_setting('app.tenant_id', true)
      AND membership.restaurant_id = current_setting('app.restaurant_id', true)
      AND (
        current_setting('app.audience', true) IN (
          'restaurant', 'provisioning'
        )
        OR (
          current_setting('app.audience', true) = 'support'
          AND current_setting('app.support_mode', true) = 'ADMIN'
        )
      )
  )
)
WITH CHECK (
  current_setting('app.audience', true) = 'system'
  OR id = current_setting('app.identity_id', true)
  OR EXISTS (
    SELECT 1
    FROM restaurant_memberships AS membership
    WHERE membership.identity_id = identities.id
      AND membership.tenant_id = current_setting('app.tenant_id', true)
      AND membership.restaurant_id = current_setting('app.restaurant_id', true)
      AND (
        current_setting('app.audience', true) IN (
          'restaurant', 'provisioning'
        )
        OR (
          current_setting('app.audience', true) = 'support'
          AND current_setting('app.support_mode', true) = 'ADMIN'
        )
      )
  )
);

CREATE POLICY inovas_identity_delete ON identities
FOR DELETE
USING (current_setting('app.audience', true) = 'system');

ALTER TABLE restaurant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_memberships FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inovas_membership_access ON restaurant_memberships;
CREATE POLICY inovas_membership_access ON restaurant_memberships
FOR ALL
USING (
  current_setting('app.audience', true) = 'system'
  OR (
    tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND (
      identity_id = current_setting('app.identity_id', true)
      OR current_setting('app.audience', true) IN ('restaurant', 'support')
    )
  )
)
WITH CHECK (
  current_setting('app.audience', true) = 'system'
  OR (
    tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
  )
);

ALTER TABLE restaurant_role_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_role_bindings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inovas_restaurant_binding_access ON restaurant_role_bindings;
CREATE POLICY inovas_restaurant_binding_access ON restaurant_role_bindings
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM restaurant_memberships membership
    WHERE membership.id = membership_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM restaurant_memberships membership
    WHERE membership.id = membership_id
  )
);

ALTER TABLE permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_overrides FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inovas_permission_override_access ON permission_overrides;
CREATE POLICY inovas_permission_override_access ON permission_overrides
FOR ALL
USING (
  current_setting('app.audience', true) = 'system'
  OR identity_id = current_setting('app.identity_id', true)
)
WITH CHECK (
  current_setting('app.audience', true) = 'system'
  OR identity_id = current_setting('app.identity_id', true)
);

ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inovas_auth_session_access ON auth_sessions;
CREATE POLICY inovas_auth_session_access ON auth_sessions
FOR ALL
USING (identity_id = current_setting('app.identity_id', true))
WITH CHECK (identity_id = current_setting('app.identity_id', true));

ALTER TABLE system_support_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_support_sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inovas_support_session_access ON system_support_sessions;
CREATE POLICY inovas_support_session_access ON system_support_sessions
FOR ALL
USING (
  current_setting('app.audience', true) = 'system'
  AND system_identity_id = current_setting('app.identity_id', true)
)
WITH CHECK (
  current_setting('app.audience', true) = 'system'
  AND system_identity_id = current_setting('app.identity_id', true)
);

ALTER TABLE user_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_audit_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inovas_user_audit_access ON user_audit_events;
CREATE POLICY inovas_user_audit_access ON user_audit_events
FOR ALL
USING (
  current_setting('app.audience', true) = 'system'
  OR (
    tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND current_setting('app.audience', true) IN ('restaurant', 'support')
  )
)
WITH CHECK (
  current_setting('app.audience', true) = 'system'
  OR (
    tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND current_setting('app.audience', true) IN ('restaurant', 'support')
  )
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inovas_invitation_access ON invitations;
CREATE POLICY inovas_invitation_access ON invitations
FOR ALL
USING (
  current_setting('app.audience', true) = 'system'
  OR identity_id = current_setting('app.identity_id', true)
)
WITH CHECK (
  current_setting('app.audience', true) = 'system'
  OR identity_id = current_setting('app.identity_id', true)
);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inovas_password_reset_access ON password_reset_tokens;
CREATE POLICY inovas_password_reset_access ON password_reset_tokens
FOR ALL
USING (
  current_setting('app.audience', true) = 'system'
  OR identity_id = current_setting('app.identity_id', true)
)
WITH CHECK (
  current_setting('app.audience', true) = 'system'
  OR identity_id = current_setting('app.identity_id', true)
);

COMMIT;
