-- INOVAS Food · Migração 029 em Produção · Passo 1: checagem SOMENTE LEITURA
-- Rodar no console SQL do Neon, no branch de Produção. Não altera nada.
-- Cada consulta tem o resultado esperado ao lado. Se algum não bater, PARE.

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

-- 1) Tabelas que a 029 exige (vêm da 022) e se a 029 já foi aplicada.
--    Esperado: dining_tables, cash_register_sessions, cash_register_movements
--    e permission_definitions presentes; cash_register_table_assignments AUSENTE.
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name IN (
  'dining_tables',
  'cash_register_sessions',
  'cash_register_movements',
  'permission_definitions',
  'cash_register_table_assignments',
  'schema_migrations'
)
ORDER BY table_name, table_schema;

-- 2) A 028 (menus por permissão) já está no banco?
--    Esperado com 028 aplicada: 25 ou mais. Se vier 0, a 028 NÃO foi aplicada
--    e o código novo não deve ir para Produção antes dela (decisão separada).
SELECT count(*) AS permissoes_de_menu
FROM permission_definitions
WHERE key LIKE 'tenant.navigation.%';

-- 3) Números de mesa repetidos impedem o índice único da 029.
--    Esperado: nenhuma linha.
SELECT tenant_id, restaurant_id, number, count(*) AS repeticoes
FROM dining_tables
WHERE number IS NOT NULL
GROUP BY tenant_id, restaurant_id, number
HAVING count(*) > 1;

-- 4) O índice da 029 já existe?
--    Esperado: nenhuma linha.
SELECT schemaname, indexname
FROM pg_indexes
WHERE indexname = 'dining_tables_scope_number_uidx';

-- 5) Usuário de banco do runtime. Se existir um inovas_app_*, a tabela nova
--    vai precisar de GRANT (Passo 3). Se só existir o dono, não precisa.
SELECT rolname, rolbypassrls, rolcreaterole
FROM pg_roles
WHERE rolname LIKE 'inovas_app%' OR rolname = current_user
ORDER BY rolname;

-- 6) Caixas abertos agora. Aplique com 0 caixas abertos para não travar
--    ninguém no meio do atendimento.
SELECT status, count(*) AS caixas
FROM cash_register_sessions
GROUP BY status
ORDER BY status;

COMMIT;
