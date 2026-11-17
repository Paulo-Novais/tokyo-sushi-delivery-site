-- Caixa offline (etapa 1): ações do caixa com código único (operationId).
-- O caixa local reenvia a fila quando a internet volta; esta tabela garante
-- que cada ação seja executada uma vez só na nuvem.
-- Ordem: depois de 029. Volta: 030_cash_register_operations.rollback.sql
-- (só apaga esta tabela nova; nada das tabelas existentes muda).
BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS cash_register_operations (
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_key TEXT NOT NULL,
  operation_id TEXT NOT NULL CHECK (operation_id ~ '^op_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  action TEXT NOT NULL CHECK (char_length(action) BETWEEN 1 AND 60),
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'DONE', 'FAILED')),
  result_json JSONB,
  error_json JSONB,
  actor_identity_id TEXT NOT NULL DEFAULT '',
  actor_login TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, restaurant_id, operation_id)
);

CREATE INDEX IF NOT EXISTS cash_register_operations_created_idx
  ON cash_register_operations (tenant_id, restaurant_id, created_at DESC);

ALTER TABLE cash_register_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_register_operations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inovas_cash_tenant_access
  ON cash_register_operations;

CREATE POLICY inovas_cash_tenant_access
  ON cash_register_operations
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
