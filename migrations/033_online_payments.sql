-- Pagamento online (Pagar.me/Stone): cada tentativa de pagamento do site e a
-- conta de recebimento (recebedor) de cada restaurante no provedor.
-- O pedido só é criado depois que o provedor confirma o pagamento.
-- Ordem: depois de 032. Volta: 033_online_payments.rollback.sql
-- (apaga só estas duas tabelas novas).
BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS online_payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'ORDER_FAILED')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'credit_card', 'debit_card', 'meal_voucher')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  -- Carrinho validado no servidor (vira o pedido quando o pagamento confirmar).
  order_payload JSONB NOT NULL,
  customer_key TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL CHECK (provider IN ('pagarme', 'fake')),
  provider_order_id TEXT NOT NULL DEFAULT '',
  provider_charge_id TEXT NOT NULL DEFAULT '',
  checkout_url TEXT NOT NULL DEFAULT '',
  fee_cents BIGINT,
  order_id TEXT NOT NULL DEFAULT '',
  order_public_id TEXT NOT NULL DEFAULT '',
  failure_reason TEXT NOT NULL DEFAULT '' CHECK (char_length(failure_reason) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS online_payments_provider_order_idx ON online_payments (provider_order_id);
CREATE INDEX IF NOT EXISTS online_payments_order_idx ON online_payments (tenant_id, restaurant_id, order_id);

-- Configuração de pagamento online do restaurante (Configurações >
-- Pagamentos e repasses): formas aceitas, conta bancária para o repasse e o
-- recebedor criado no provedor. Dados bancários só o servidor lê; a tela
-- mostra mascarado. Só o dono do restaurante altera a conta bancária.
CREATE TABLE IF NOT EXISTS restaurant_payment_accounts (
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_key TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('pagarme', 'fake')),
  recipient_id TEXT NOT NULL DEFAULT '',
  recipient_status TEXT NOT NULL DEFAULT 'NOT_SUBMITTED'
    CHECK (recipient_status IN ('NOT_SUBMITTED', 'PENDING', 'ACTIVE', 'REFUSED')),
  recipient_message TEXT NOT NULL DEFAULT '' CHECK (char_length(recipient_message) <= 300),
  enabled_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  holder_name TEXT NOT NULL DEFAULT '' CHECK (char_length(holder_name) <= 128),
  holder_document TEXT NOT NULL DEFAULT '' CHECK (holder_document ~ '^[0-9]{0,14}$'),
  holder_email TEXT NOT NULL DEFAULT '' CHECK (char_length(holder_email) <= 160),
  holder_phone TEXT NOT NULL DEFAULT '' CHECK (holder_phone ~ '^[0-9]{0,13}$'),
  bank_code TEXT NOT NULL DEFAULT '' CHECK (bank_code ~ '^[0-9]{0,3}$'),
  branch_number TEXT NOT NULL DEFAULT '' CHECK (branch_number ~ '^[0-9]{0,4}$'),
  branch_check_digit TEXT NOT NULL DEFAULT '' CHECK (branch_check_digit ~ '^[0-9]?$'),
  account_number TEXT NOT NULL DEFAULT '' CHECK (account_number ~ '^[0-9]{0,13}$'),
  account_check_digit TEXT NOT NULL DEFAULT '' CHECK (account_check_digit ~ '^[0-9Xx]{0,2}$'),
  account_type TEXT NOT NULL DEFAULT 'checking' CHECK (account_type IN ('checking', 'savings')),
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, restaurant_id)
);

ALTER TABLE online_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_payments FORCE ROW LEVEL SECURITY;
ALTER TABLE restaurant_payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_payment_accounts FORCE ROW LEVEL SECURITY;

-- Só o servidor no escopo "system" (checkout, aviso do provedor, rotina).
DROP POLICY IF EXISTS inovas_online_payments_system ON online_payments;
CREATE POLICY inovas_online_payments_system ON online_payments
FOR ALL USING (current_setting('app.audience', true) = 'system')
WITH CHECK (current_setting('app.audience', true) = 'system');

DROP POLICY IF EXISTS inovas_payment_accounts_system ON restaurant_payment_accounts;
CREATE POLICY inovas_payment_accounts_system ON restaurant_payment_accounts
FOR ALL USING (current_setting('app.audience', true) = 'system')
WITH CHECK (current_setting('app.audience', true) = 'system');

COMMIT;
