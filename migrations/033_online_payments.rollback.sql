-- Volta da 033: apaga só os registros de pagamento online e os recebedores.
-- ATENÇÃO: apaga o histórico de pagamentos online. Faça backup antes.
BEGIN;

DROP TABLE IF EXISTS online_payments;
DROP TABLE IF EXISTS restaurant_payment_accounts;

COMMIT;
