BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE UNIQUE INDEX IF NOT EXISTS dining_tables_scope_number_uidx
  ON dining_tables (tenant_id, restaurant_id, number)
  WHERE number IS NOT NULL;

CREATE TABLE IF NOT EXISTS cash_register_table_assignments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_key TEXT NOT NULL,
  cash_register_id TEXT NOT NULL REFERENCES cash_register_sessions(id),
  table_id TEXT NOT NULL REFERENCES dining_tables(id),
  table_number INTEGER NOT NULL CHECK (table_number BETWEEN 1 AND 200),
  table_label TEXT NOT NULL,
  added_by_identity_id TEXT NOT NULL DEFAULT '',
  added_by_login TEXT NOT NULL,
  added_by_display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, restaurant_id, cash_register_id, table_number),
  UNIQUE (tenant_id, restaurant_id, cash_register_id, table_id)
);

CREATE INDEX IF NOT EXISTS cash_register_table_assignments_register_idx
  ON cash_register_table_assignments (
    tenant_id, restaurant_id, cash_register_id, table_number
  );

ALTER TABLE cash_register_table_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_register_table_assignments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inovas_cash_tenant_access
  ON cash_register_table_assignments;

CREATE POLICY inovas_cash_tenant_access
  ON cash_register_table_assignments
  FOR ALL
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND current_setting('app.audience', true) IN ('restaurant', 'support')
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND (
      current_setting('app.audience', true) = 'restaurant'
      OR (
        current_setting('app.audience', true) = 'support'
        AND current_setting('app.support_mode', true) = 'ADMIN'
      )
    )
  );

COMMIT;
