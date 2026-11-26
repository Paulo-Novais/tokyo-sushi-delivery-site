-- Nota fiscal (NFC-e): uma linha por nota pedida ao serviço emissor
-- (Focus NFe ou outro). Guarda só o resultado público da nota (número, chave,
-- links do DANFE/XML/QR Code) e a situação. Certificado A1 e CSC do
-- restaurante NUNCA ficam aqui: vão direto para o serviço emissor.
-- Ordem: depois de 036. Volta: 037_fiscal_invoices.rollback.sql
-- (apaga só esta tabela nova).
BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS fiscal_invoices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_key TEXT NOT NULL,
  order_id TEXT NOT NULL,
  order_public_id TEXT NOT NULL DEFAULT '',
  -- Referência única enviada ao emissor (não repete nota do mesmo pedido).
  provider_ref TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('focusnfe', 'fake')),
  environment TEXT NOT NULL DEFAULT 'homologacao' CHECK (environment IN ('homologacao', 'producao')),
  status TEXT NOT NULL CHECK (status IN ('PROCESSING', 'AUTHORIZED', 'REJECTED', 'CANCELED', 'ERROR')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  number TEXT NOT NULL DEFAULT '',
  series TEXT NOT NULL DEFAULT '',
  access_key TEXT NOT NULL DEFAULT '' CHECK (access_key ~ '^[0-9]{0,44}$'),
  danfe_url TEXT NOT NULL DEFAULT '' CHECK (char_length(danfe_url) <= 600),
  xml_url TEXT NOT NULL DEFAULT '' CHECK (char_length(xml_url) <= 600),
  qrcode_url TEXT NOT NULL DEFAULT '' CHECK (char_length(qrcode_url) <= 1200),
  message TEXT NOT NULL DEFAULT '' CHECK (char_length(message) <= 500),
  requested_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  authorized_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS fiscal_invoices_ref_uidx ON fiscal_invoices (provider_ref);
CREATE INDEX IF NOT EXISTS fiscal_invoices_order_idx ON fiscal_invoices (tenant_id, restaurant_id, order_id);
CREATE INDEX IF NOT EXISTS fiscal_invoices_recent_idx ON fiscal_invoices (tenant_id, restaurant_id, created_at DESC);

ALTER TABLE fiscal_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_invoices FORCE ROW LEVEL SECURITY;

-- Só o servidor no escopo "system" (o Gestor pede pelo servidor).
DROP POLICY IF EXISTS inovas_fiscal_invoices_system ON fiscal_invoices;
CREATE POLICY inovas_fiscal_invoices_system ON fiscal_invoices
FOR ALL USING (current_setting('app.audience', true) = 'system')
WITH CHECK (current_setting('app.audience', true) = 'system');

-- Mesmo usuário do sistema que já acessa admin_users (ver 034).
DO $$
DECLARE
  runtime_role record;
BEGIN
  FOR runtime_role IN
    SELECT DISTINCT grantee
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'admin_users'
      AND privilege_type = 'SELECT'
      AND grantee NOT IN (current_user, 'PUBLIC')
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON fiscal_invoices TO %I', runtime_role.grantee);
    RAISE NOTICE 'Permissoes concedidas para %', runtime_role.grantee;
  END LOOP;
END $$;

COMMIT;
