-- Permissões do usuário do sistema (o mesmo que já acessa admin_users) nas
-- tabelas novas: caixa sem duplicar (030), Gestor aberto (031), extrato e
-- repasse (032) e pagamento online (033). Sem isso o site recebe "permission
-- denied" nessas tabelas. Detecta o usuário sozinho (não precisa saber o nome).
-- Ordem: depois de 033. Volta: 034_payments_runtime_grants.rollback.sql
BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
DECLARE
  runtime_role record;
BEGIN
  FOR runtime_role IN
    SELECT DISTINCT grantee
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'admin_users'
      AND privilege_type = 'SELECT'
      AND grantee NOT IN (current_user, 'PUBLIC')
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON cash_register_operations TO %I', runtime_role.grantee);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON restaurant_presence TO %I', runtime_role.grantee);
    EXECUTE format('GRANT SELECT, INSERT ON restaurant_ledger_entries TO %I', runtime_role.grantee);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON restaurant_payouts TO %I', runtime_role.grantee);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON online_payments TO %I', runtime_role.grantee);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON restaurant_payment_accounts TO %I', runtime_role.grantee);
    RAISE NOTICE 'Permissoes concedidas para %', runtime_role.grantee;
  END LOOP;
END $$;

COMMIT;
