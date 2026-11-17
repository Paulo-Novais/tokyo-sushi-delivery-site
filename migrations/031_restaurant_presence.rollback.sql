-- Volta da 031: apaga só a tabela de presença do Gestor.
-- Sem ela, o site volta a aceitar pedidos sem checar se o Gestor está aberto.
BEGIN;

DROP TABLE IF EXISTS restaurant_presence;

COMMIT;
