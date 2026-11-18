-- Integrações com plataformas de delivery (iFood; 99Food e Keeta pelo Open Delivery):
-- qual loja da plataforma pertence a cada restaurante. Sem taxa para o
-- restaurante. Ordem: depois de 034. Volta: 035_channel_accounts.rollback.sql
BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS restaurant_channel_accounts (
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_key TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('ifood', 'food99', 'keeta', 'ubereats')),
  external_store_id TEXT NOT NULL CHECK (char_length(external_store_id) BETWEEN 3 AND 120),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, restaurant_id, channel),
  UNIQUE (channel, external_store_id)
);

ALTER TABLE restaurant_channel_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_channel_accounts FORCE ROW LEVEL SECURITY;

-- Só o servidor no escopo "system" (aviso da plataforma e Configurações).
DROP POLICY IF EXISTS inovas_channel_accounts_system ON restaurant_channel_accounts;
CREATE POLICY inovas_channel_accounts_system ON restaurant_channel_accounts
FOR ALL USING (current_setting('app.audience', true) = 'system')
WITH CHECK (current_setting('app.audience', true) = 'system');

-- Permissão para o usuário do sistema (o mesmo que já acessa admin_users).
DO $$
DECLARE
  runtime_role record;
BEGIN
  FOR runtime_role IN
    SELECT DISTINCT grantee FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'admin_users'
      AND privilege_type = 'SELECT' AND grantee NOT IN (current_user, 'PUBLIC')
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON restaurant_channel_accounts TO %I', runtime_role.grantee);
  END LOOP;
END $$;

COMMIT;
