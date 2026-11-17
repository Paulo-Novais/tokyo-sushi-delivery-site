-- "Gestor aberto": último sinal de vida do Gestor/app de cada restaurante e
-- pausa manual ("Fechar Gestor"). O site só aceita pedido quando o Gestor deu
-- sinal nos últimos minutos e não está pausado.
-- Ordem: depois de 030. Volta: 031_restaurant_presence.rollback.sql
-- (só apaga esta tabela nova). Sem a tabela, o site segue aceitando pedidos
-- como hoje (o código não bloqueia se a tabela não existir).
BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS restaurant_presence (
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_key TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_source TEXT NOT NULL DEFAULT '' CHECK (char_length(last_source) <= 40),
  -- "Fechar Gestor" (15/30/60/240 min): até quando os pedidos ficam pausados.
  paused_until TIMESTAMPTZ,
  paused_by_login TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (tenant_id, restaurant_id)
);

ALTER TABLE restaurant_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_presence FORCE ROW LEVEL SECURITY;

-- Leitura: o restaurante, o suporte e o site público (só "está online?").
DROP POLICY IF EXISTS inovas_presence_select ON restaurant_presence;
CREATE POLICY inovas_presence_select ON restaurant_presence
FOR SELECT USING (
  tenant_id = current_setting('app.tenant_id', true)
  AND restaurant_id = current_setting('app.restaurant_id', true)
  AND current_setting('app.audience', true) IN ('restaurant', 'support', 'public')
);

-- Escrita: só a sessão do próprio restaurante (Gestor/app).
DROP POLICY IF EXISTS inovas_presence_insert ON restaurant_presence;
CREATE POLICY inovas_presence_insert ON restaurant_presence
FOR INSERT WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)
  AND restaurant_id = current_setting('app.restaurant_id', true)
  AND current_setting('app.audience', true) = 'restaurant'
);

DROP POLICY IF EXISTS inovas_presence_update ON restaurant_presence;
CREATE POLICY inovas_presence_update ON restaurant_presence
FOR UPDATE USING (
  tenant_id = current_setting('app.tenant_id', true)
  AND restaurant_id = current_setting('app.restaurant_id', true)
  AND current_setting('app.audience', true) = 'restaurant'
) WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)
  AND restaurant_id = current_setting('app.restaurant_id', true)
  AND current_setting('app.audience', true) = 'restaurant'
);

COMMIT;
