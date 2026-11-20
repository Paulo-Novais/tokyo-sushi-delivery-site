-- Volta da 036_customer_login.sql.
-- ATENÇÃO: apaga as contas de login dos clientes (Google e e-mail/senha) e as
-- sessões nos sites. Pedidos, clientes e histórico dos restaurantes NÃO são
-- tocados. Antes de rodar: backup do Neon e GO do Paulo.
-- Depois de rodar, voltar o código para a versão anterior (sem o login novo).
BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP TABLE IF EXISTS customer_sessions;
DROP TABLE IF EXISTS customer_auth_rate_limits;
DROP TABLE IF EXISTS customer_auth_verifications;
DROP TABLE IF EXISTS customer_auth_accounts;
DROP TABLE IF EXISTS customer_auth_sessions;
DROP TABLE IF EXISTS customer_auth_users;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'inovas_customer_auth') THEN
    REVOKE ALL ON SCHEMA public FROM inovas_customer_auth;
    EXECUTE format('REVOKE ALL ON DATABASE %I FROM inovas_customer_auth', current_database());
    DROP ROLE inovas_customer_auth;
  END IF;
END $$;

COMMIT;
