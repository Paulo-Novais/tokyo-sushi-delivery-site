-- INOVAS Food · Migração 029 em Produção · Passo 4: conferência SOMENTE LEITURA
-- Rodar logo depois de aplicar a 029. Não altera nada.

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

-- Esperado: 1 linha, rls_ligada = true e rls_forcada = true.
SELECT relname AS tabela,
       relrowsecurity AS rls_ligada,
       relforcerowsecurity AS rls_forcada
FROM pg_class
WHERE relname = 'cash_register_table_assignments';

-- Esperado: 1 linha, política inovas_cash_tenant_access.
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'cash_register_table_assignments';

-- Esperado: 2 linhas (o índice único de mesa e o índice do caixa).
SELECT indexname
FROM pg_indexes
WHERE indexname IN (
  'dining_tables_scope_number_uidx',
  'cash_register_table_assignments_register_idx'
)
ORDER BY indexname;

-- Esperado: 0 (tabela nova começa vazia; nenhum dado antigo foi tocado).
SELECT count(*) AS linhas FROM cash_register_table_assignments;

-- Se existir usuário de runtime limitado, esperado: SELECT e INSERT para ele.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'cash_register_table_assignments'
ORDER BY grantee, privilege_type;

COMMIT;
