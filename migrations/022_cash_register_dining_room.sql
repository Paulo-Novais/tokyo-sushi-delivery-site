-- INOVAS Food — Caixa / Salão MVP
-- Apply only to an isolated Preview database after migrations 015-021.
-- This migration is additive and does not backfill or mutate existing orders.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS dining_tables (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_key TEXT NOT NULL,
  number INTEGER,
  label TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4 CHECK (capacity BETWEEN 1 AND 50),
  status TEXT NOT NULL DEFAULT 'FREE'
    CHECK (status IN ('FREE', 'OCCUPIED', 'AWAITING_PAYMENT', 'UNAVAILABLE')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, restaurant_id, label)
);

CREATE INDEX IF NOT EXISTS dining_tables_scope_status_idx
  ON dining_tables (tenant_id, restaurant_id, status, sort_order);

CREATE TABLE IF NOT EXISTS cash_register_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'CLOSED')),
  opening_user_id TEXT NOT NULL DEFAULT '',
  opening_user_login TEXT NOT NULL,
  opening_user_display_name TEXT NOT NULL,
  opening_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (opening_amount >= 0),
  service_charge_rate NUMERIC(5, 2) NOT NULL DEFAULT 10
    CHECK (service_charge_rate BETWEEN 0 AND 30),
  opening_notes TEXT NOT NULL DEFAULT '',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closing_user_id TEXT NOT NULL DEFAULT '',
  closing_user_login TEXT NOT NULL DEFAULT '',
  closing_user_display_name TEXT NOT NULL DEFAULT '',
  counted_cash NUMERIC(12, 2),
  expected_cash NUMERIC(12, 2),
  difference_amount NUMERIC(12, 2),
  closing_notes TEXT NOT NULL DEFAULT '',
  totals_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS cash_register_sessions_one_open_uidx
  ON cash_register_sessions (tenant_id, restaurant_id)
  WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS cash_register_sessions_scope_opened_idx
  ON cash_register_sessions (tenant_id, restaurant_id, opened_at DESC);

CREATE TABLE IF NOT EXISTS dining_tabs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_key TEXT NOT NULL,
  cash_register_id TEXT NOT NULL REFERENCES cash_register_sessions(id),
  table_id TEXT NOT NULL REFERENCES dining_tables(id),
  public_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'AWAITING_PAYMENT', 'CLOSED', 'CANCELLED')),
  waiter_id TEXT NOT NULL DEFAULT '',
  waiter_login TEXT NOT NULL DEFAULT '',
  waiter_name TEXT NOT NULL,
  customer_id TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT '',
  guest_count INTEGER NOT NULL DEFAULT 1 CHECK (guest_count BETWEEN 1 AND 100),
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  service_charge_rate NUMERIC(5, 2) NOT NULL DEFAULT 0
    CHECK (service_charge_rate BETWEEN 0 AND 30),
  service_charge_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  service_charge_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (service_charge_amount >= 0),
  addition_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (addition_amount >= 0),
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closing_started_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  closed_by_login TEXT NOT NULL DEFAULT '',
  closed_by_display_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, restaurant_id, public_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS dining_tabs_one_active_per_table_uidx
  ON dining_tabs (tenant_id, restaurant_id, table_id)
  WHERE status IN ('OPEN', 'AWAITING_PAYMENT');

CREATE INDEX IF NOT EXISTS dining_tabs_scope_status_idx
  ON dining_tabs (tenant_id, restaurant_id, status, opened_at DESC);

CREATE INDEX IF NOT EXISTS dining_tabs_register_idx
  ON dining_tabs (cash_register_id, status, opened_at DESC);

CREATE TABLE IF NOT EXISTS dining_tab_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_key TEXT NOT NULL,
  tab_id TEXT NOT NULL REFERENCES dining_tabs(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price > 0),
  total_price NUMERIC(12, 2) NOT NULL CHECK (total_price > 0),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN (
      'PENDING', 'SENT', 'IN_PREPARATION', 'READY', 'DELIVERED', 'CANCELLED'
    )),
  batch_id TEXT,
  order_id TEXT,
  created_by_login TEXT NOT NULL,
  created_by_display_name TEXT NOT NULL,
  sent_by_login TEXT NOT NULL DEFAULT '',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dining_tab_items_tab_status_idx
  ON dining_tab_items (tenant_id, restaurant_id, tab_id, status, created_at);

CREATE TABLE IF NOT EXISTS dining_order_batches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_key TEXT NOT NULL,
  tab_id TEXT NOT NULL REFERENCES dining_tabs(id) ON DELETE CASCADE,
  batch_number INTEGER NOT NULL CHECK (batch_number > 0),
  order_id TEXT NOT NULL REFERENCES orders(id),
  sent_by_login TEXT NOT NULL,
  sent_by_display_name TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, restaurant_id, tab_id, batch_number),
  UNIQUE (tenant_id, restaurant_id, order_id)
);

CREATE INDEX IF NOT EXISTS dining_order_batches_tab_idx
  ON dining_order_batches (tenant_id, restaurant_id, tab_id, batch_number);

CREATE TABLE IF NOT EXISTS cash_payment_sets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_key TEXT NOT NULL,
  cash_register_id TEXT NOT NULL REFERENCES cash_register_sessions(id),
  tab_id TEXT NOT NULL REFERENCES dining_tabs(id),
  idempotency_key TEXT NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
  confirmed_by_login TEXT NOT NULL,
  confirmed_by_display_name TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, restaurant_id, tab_id),
  UNIQUE (tenant_id, restaurant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS cash_payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_key TEXT NOT NULL,
  payment_set_id TEXT NOT NULL REFERENCES cash_payment_sets(id) ON DELETE CASCADE,
  cash_register_id TEXT NOT NULL REFERENCES cash_register_sessions(id),
  tab_id TEXT NOT NULL REFERENCES dining_tabs(id),
  method TEXT NOT NULL
    CHECK (method IN (
      'CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'MEAL_VOUCHER', 'OTHER'
    )),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  received_amount NUMERIC(12, 2),
  change_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
  status TEXT NOT NULL DEFAULT 'CONFIRMED'
    CHECK (status IN ('CONFIRMED', 'REVERSED')),
  created_by_login TEXT NOT NULL,
  created_by_display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cash_payments_register_method_idx
  ON cash_payments (tenant_id, restaurant_id, cash_register_id, method, created_at);

CREATE TABLE IF NOT EXISTS cash_register_movements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_key TEXT NOT NULL,
  cash_register_id TEXT NOT NULL REFERENCES cash_register_sessions(id),
  tab_id TEXT REFERENCES dining_tabs(id),
  payment_set_id TEXT REFERENCES cash_payment_sets(id),
  movement_type TEXT NOT NULL
    CHECK (movement_type IN ('OPENING', 'SALE', 'SUPPLY', 'WITHDRAWAL', 'CLOSING')),
  payment_method TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12, 2) NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_login TEXT NOT NULL,
  created_by_display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cash_register_movements_register_idx
  ON cash_register_movements (
    tenant_id, restaurant_id, cash_register_id, movement_type, created_at
  );

CREATE TABLE IF NOT EXISTS cash_register_audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_key TEXT NOT NULL,
  cash_register_id TEXT,
  tab_id TEXT,
  table_id TEXT,
  event_type TEXT NOT NULL,
  actor_identity_id TEXT NOT NULL DEFAULT '',
  actor_login TEXT NOT NULL,
  actor_display_name TEXT NOT NULL,
  before_json JSONB,
  after_json JSONB,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cash_register_audit_scope_created_idx
  ON cash_register_audit_events (
    tenant_id, restaurant_id, created_at DESC
  );

CREATE INDEX IF NOT EXISTS cash_register_audit_tab_created_idx
  ON cash_register_audit_events (
    tenant_id, restaurant_id, tab_id, created_at DESC
  );

INSERT INTO permission_definitions (
  key, domain, module, action, risk_level, dependencies_json, description, version
)
VALUES
  ('tenant.cash_register.view', 'RESTAURANT', 'cash_register', 'view', 'MEDIUM', '[]', 'Visualizar Caixa e Salão.', '2026.07.30'),
  ('tenant.cash_register.configure', 'RESTAURANT', 'cash_register', 'configure', 'HIGH', '["tenant.cash_register.view"]', 'Configurar mesas do salão.', '2026.07.30'),
  ('tenant.cash_register.open', 'RESTAURANT', 'cash_register', 'open', 'HIGH', '["tenant.cash_register.view"]', 'Abrir caixa.', '2026.07.30'),
  ('tenant.cash_register.close', 'RESTAURANT', 'cash_register', 'close', 'CRITICAL', '["tenant.cash_register.view"]', 'Fechar caixa.', '2026.07.30'),
  ('tenant.cash_register.open_tab', 'RESTAURANT', 'cash_register', 'open_tab', 'HIGH', '["tenant.cash_register.view"]', 'Abrir comanda.', '2026.07.30'),
  ('tenant.cash_register.add_item', 'RESTAURANT', 'cash_register', 'add_item', 'HIGH', '["tenant.cash_register.view"]', 'Adicionar e editar item pendente.', '2026.07.30'),
  ('tenant.cash_register.send_order', 'RESTAURANT', 'cash_register', 'send_order', 'HIGH', '["tenant.cash_register.view"]', 'Enviar lote para produção.', '2026.07.30'),
  ('tenant.cash_register.discount', 'RESTAURANT', 'cash_register', 'discount', 'CRITICAL', '["tenant.cash_register.view"]', 'Aplicar desconto.', '2026.07.30'),
  ('tenant.cash_register.remove_service', 'RESTAURANT', 'cash_register', 'remove_service', 'HIGH', '["tenant.cash_register.view"]', 'Remover taxa de serviço.', '2026.07.30'),
  ('tenant.cash_register.close_tab', 'RESTAURANT', 'cash_register', 'close_tab', 'CRITICAL', '["tenant.cash_register.view"]', 'Fechar conta.', '2026.07.30'),
  ('tenant.cash_register.confirm_payment', 'RESTAURANT', 'cash_register', 'confirm_payment', 'CRITICAL', '["tenant.cash_register.view"]', 'Confirmar pagamento.', '2026.07.30'),
  ('tenant.cash_register.history', 'RESTAURANT', 'cash_register', 'history', 'MEDIUM', '["tenant.cash_register.view"]', 'Visualizar histórico do caixa.', '2026.07.30')
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

INSERT INTO role_permission_bindings (
  domain, role_key, role_version, permission_key
)
SELECT
  'RESTAURANT',
  role_permission.role_key,
  role_definition.version,
  role_permission.permission_key
FROM (
  VALUES
    ('OWNER', 'tenant.cash_register.view'),
    ('OWNER', 'tenant.cash_register.configure'),
    ('OWNER', 'tenant.cash_register.open'),
    ('OWNER', 'tenant.cash_register.close'),
    ('OWNER', 'tenant.cash_register.open_tab'),
    ('OWNER', 'tenant.cash_register.add_item'),
    ('OWNER', 'tenant.cash_register.send_order'),
    ('OWNER', 'tenant.cash_register.discount'),
    ('OWNER', 'tenant.cash_register.remove_service'),
    ('OWNER', 'tenant.cash_register.close_tab'),
    ('OWNER', 'tenant.cash_register.confirm_payment'),
    ('OWNER', 'tenant.cash_register.history'),
    ('ADMIN', 'tenant.cash_register.view'),
    ('ADMIN', 'tenant.cash_register.configure'),
    ('ADMIN', 'tenant.cash_register.open'),
    ('ADMIN', 'tenant.cash_register.close'),
    ('ADMIN', 'tenant.cash_register.open_tab'),
    ('ADMIN', 'tenant.cash_register.add_item'),
    ('ADMIN', 'tenant.cash_register.send_order'),
    ('ADMIN', 'tenant.cash_register.discount'),
    ('ADMIN', 'tenant.cash_register.remove_service'),
    ('ADMIN', 'tenant.cash_register.close_tab'),
    ('ADMIN', 'tenant.cash_register.confirm_payment'),
    ('ADMIN', 'tenant.cash_register.history'),
    ('MANAGER', 'tenant.cash_register.view'),
    ('MANAGER', 'tenant.cash_register.configure'),
    ('MANAGER', 'tenant.cash_register.open'),
    ('MANAGER', 'tenant.cash_register.close'),
    ('MANAGER', 'tenant.cash_register.open_tab'),
    ('MANAGER', 'tenant.cash_register.add_item'),
    ('MANAGER', 'tenant.cash_register.send_order'),
    ('MANAGER', 'tenant.cash_register.discount'),
    ('MANAGER', 'tenant.cash_register.remove_service'),
    ('MANAGER', 'tenant.cash_register.close_tab'),
    ('MANAGER', 'tenant.cash_register.confirm_payment'),
    ('MANAGER', 'tenant.cash_register.history'),
    ('CASHIER', 'tenant.cash_register.view'),
    ('CASHIER', 'tenant.cash_register.open'),
    ('CASHIER', 'tenant.cash_register.close'),
    ('CASHIER', 'tenant.cash_register.open_tab'),
    ('CASHIER', 'tenant.cash_register.add_item'),
    ('CASHIER', 'tenant.cash_register.send_order'),
    ('CASHIER', 'tenant.cash_register.remove_service'),
    ('CASHIER', 'tenant.cash_register.close_tab'),
    ('CASHIER', 'tenant.cash_register.confirm_payment'),
    ('CASHIER', 'tenant.cash_register.history'),
    ('SERVICE', 'tenant.cash_register.view'),
    ('SERVICE', 'tenant.cash_register.open_tab'),
    ('SERVICE', 'tenant.cash_register.add_item'),
    ('SERVICE', 'tenant.cash_register.send_order'),
    ('SERVICE', 'tenant.cash_register.history'),
    ('READ_ONLY', 'tenant.cash_register.view'),
    ('READ_ONLY', 'tenant.cash_register.history')
) AS role_permission(role_key, permission_key)
INNER JOIN role_definitions AS role_definition
  ON role_definition.domain = 'RESTAURANT'
  AND role_definition.key = role_permission.role_key
  AND role_definition.active = TRUE
INNER JOIN permission_definitions AS permission_definition
  ON permission_definition.key = role_permission.permission_key
  AND permission_definition.active = TRUE
ON CONFLICT (domain, role_key, role_version, permission_key) DO NOTHING;

DO $cash_register_rls$
DECLARE
  table_name TEXT;
  tenant_tables CONSTANT TEXT[] := ARRAY[
    'dining_tables',
    'cash_register_sessions',
    'dining_tabs',
    'dining_tab_items',
    'dining_order_batches',
    'cash_payment_sets',
    'cash_payments',
    'cash_register_movements',
    'cash_register_audit_events'
  ];
BEGIN
  FOREACH table_name IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS inovas_cash_tenant_access ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY inovas_cash_tenant_access ON %I FOR ALL
       USING (
         tenant_id = current_setting(''app.tenant_id'', true)
         AND restaurant_id = current_setting(''app.restaurant_id'', true)
         AND current_setting(''app.audience'', true) IN (''restaurant'', ''support'')
       )
       WITH CHECK (
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
$cash_register_rls$;

COMMIT;
