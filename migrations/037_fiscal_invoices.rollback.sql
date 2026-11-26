-- Desfaz 037: apaga só a tabela de notas fiscais.
BEGIN;
DROP TABLE IF EXISTS fiscal_invoices;
COMMIT;
