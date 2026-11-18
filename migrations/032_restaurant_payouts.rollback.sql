-- Volta da 032: apaga só os lançamentos e repasses do pagamento online.
-- ATENÇÃO: apaga o histórico de extratos. Faça backup antes se já houver uso real.
BEGIN;

DROP TABLE IF EXISTS restaurant_payouts;
DROP TABLE IF EXISTS restaurant_ledger_entries;

COMMIT;
