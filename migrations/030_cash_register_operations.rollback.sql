-- Volta da 030: apaga só a tabela de controle das ações offline.
-- Seguro: nenhuma tabela existente do caixa depende dela.
BEGIN;

DROP TABLE IF EXISTS cash_register_operations;

COMMIT;
