-- Pagamento online (modelo iFood): lançamentos do restaurante e repasses
-- semanais. Cada venda online, taxa do pagamento, devolução, contestação,
-- mensalidade INOVAS, débito e crédito vira um lançamento; o repasse da
-- semana é calculado a partir deles e fica registrado com o extrato.
-- Valores em centavos (inteiros), sempre positivos; o tipo define o sinal.
-- Ordem: depois de 031. Volta: 032_restaurant_payouts.rollback.sql
-- (apaga só estas duas tabelas novas).
BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS restaurant_ledger_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_key TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'SALE', 'PROCESSING_FEE', 'PLATFORM_FEE', 'REFUND', 'CHARGEBACK', 'SUBSCRIPTION', 'DEBT', 'CREDIT'
  )),
  payment_method TEXT NOT NULL DEFAULT '' CHECK (char_length(payment_method) <= 40),
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 300),
  order_id TEXT NOT NULL DEFAULT '',
  order_public_id TEXT NOT NULL DEFAULT '',
  payment_id TEXT NOT NULL DEFAULT '',
  -- Evita lançamento em dobro (ex.: aviso repetido do provedor).
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 200),
  occurred_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, restaurant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS restaurant_ledger_entries_period_idx
  ON restaurant_ledger_entries (tenant_id, restaurant_id, occurred_at);

CREATE TABLE IF NOT EXISTS restaurant_payouts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_key TEXT NOT NULL,
  week_key DATE NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  payout_date DATE NOT NULL,
  gross_sales_cents BIGINT NOT NULL DEFAULT 0,
  net_cents BIGINT NOT NULL DEFAULT 0,
  payout_cents BIGINT NOT NULL DEFAULT 0 CHECK (payout_cents >= 0),
  carry_over_cents BIGINT NOT NULL DEFAULT 0 CHECK (carry_over_cents <= 0),
  status TEXT NOT NULL CHECK (status IN ('SCHEDULED', 'NOTHING_TO_PAY', 'PAID', 'FAILED')),
  statement_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_transfer_id TEXT NOT NULL DEFAULT '',
  closed_by TEXT NOT NULL DEFAULT '',
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  UNIQUE (tenant_id, restaurant_id, week_key)
);

ALTER TABLE restaurant_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_ledger_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE restaurant_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_payouts FORCE ROW LEVEL SECURITY;

-- Leitura: o próprio restaurante e o suporte (extrato). Sistema INOVAS: tudo.
DROP POLICY IF EXISTS inovas_ledger_select ON restaurant_ledger_entries;
CREATE POLICY inovas_ledger_select ON restaurant_ledger_entries
FOR SELECT USING (
  current_setting('app.audience', true) = 'system'
  OR (
    tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND current_setting('app.audience', true) IN ('restaurant', 'support')
  )
);

-- Escrita: só o sistema INOVAS (aviso do provedor, mensalidade, fechamento).
-- O restaurante nunca lança nem altera valores.
DROP POLICY IF EXISTS inovas_ledger_insert ON restaurant_ledger_entries;
CREATE POLICY inovas_ledger_insert ON restaurant_ledger_entries
FOR INSERT WITH CHECK (current_setting('app.audience', true) = 'system');

DROP POLICY IF EXISTS inovas_payouts_select ON restaurant_payouts;
CREATE POLICY inovas_payouts_select ON restaurant_payouts
FOR SELECT USING (
  current_setting('app.audience', true) = 'system'
  OR (
    tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND current_setting('app.audience', true) IN ('restaurant', 'support')
  )
);

DROP POLICY IF EXISTS inovas_payouts_insert ON restaurant_payouts;
CREATE POLICY inovas_payouts_insert ON restaurant_payouts
FOR INSERT WITH CHECK (current_setting('app.audience', true) = 'system');

DROP POLICY IF EXISTS inovas_payouts_update ON restaurant_payouts;
CREATE POLICY inovas_payouts_update ON restaurant_payouts
FOR UPDATE USING (current_setting('app.audience', true) = 'system')
WITH CHECK (current_setting('app.audience', true) = 'system');

COMMIT;
