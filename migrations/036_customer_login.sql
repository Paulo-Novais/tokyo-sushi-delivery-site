-- Login do CLIENTE dos sites dos restaurantes (Google ou e-mail e senha).
-- Ordem: depois de 035. Volta: 036_customer_login.rollback.sql
--
-- Duas partes:
-- 1) Identidade do cliente (tabelas customer_auth_*), usada pela biblioteca
--    Better Auth. Única na plataforma (mesmo e-mail = mesma conta). Só o usuário
--    de banco "inovas_customer_auth" enxerga essas tabelas (RLS + grants). O
--    usuário de runtime dos restaurantes NÃO tem acesso.
-- 2) Sessões do cliente POR RESTAURANTE (customer_sessions), com RLS por
--    restaurante, acessadas pelo usuário de runtime de sempre.
--
-- Não altera nenhuma tabela existente.
BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Usuário de banco da identidade do cliente: criado sem login e sem senha.
-- A senha é definida depois pelo script scripts/configure-customer-auth-database-role.mjs
-- (senha vinda de variável de ambiente, nunca escrita em arquivo).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'inovas_customer_auth') THEN
    CREATE ROLE inovas_customer_auth NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
  END IF;
END $$;

-- ---------- 1) Identidade (Better Auth; nomes de coluna da biblioteca) ----------

CREATE TABLE IF NOT EXISTS customer_auth_users (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  "image" TEXT,
  "phone" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_auth_sessions (
  "id" TEXT PRIMARY KEY,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES customer_auth_users ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS customer_auth_sessions_user_idx ON customer_auth_sessions ("userId");

CREATE TABLE IF NOT EXISTS customer_auth_accounts (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES customer_auth_users ("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ,
  "refreshTokenExpiresAt" TIMESTAMPTZ,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS customer_auth_accounts_user_idx ON customer_auth_accounts ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS customer_auth_accounts_provider_idx ON customer_auth_accounts ("providerId", "accountId");

-- Tokens de "esqueci minha senha", códigos de uso único e contadores de tentativa.
CREATE TABLE IF NOT EXISTS customer_auth_verifications (
  "id" TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS customer_auth_verifications_identifier_idx ON customer_auth_verifications ("identifier");

-- Limite de tentativas por IP (anti força bruta).
CREATE TABLE IF NOT EXISTS customer_auth_rate_limits (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "count" INTEGER NOT NULL,
  "lastRequest" BIGINT NOT NULL
);

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'customer_auth_users', 'customer_auth_sessions', 'customer_auth_accounts',
    'customer_auth_verifications', 'customer_auth_rate_limits'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS inovas_customer_auth_only ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY inovas_customer_auth_only ON %I FOR ALL TO inovas_customer_auth USING (true) WITH CHECK (true)',
      table_name
    );
    EXECUTE format('REVOKE ALL ON %I FROM PUBLIC', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO inovas_customer_auth', table_name);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO inovas_customer_auth;
DO $$ BEGIN EXECUTE format('GRANT CONNECT ON DATABASE %I TO inovas_customer_auth', current_database()); END $$;

-- ---------- 2) Sessões do cliente por restaurante ----------

CREATE TABLE IF NOT EXISTS customer_sessions (
  token_hash TEXT PRIMARY KEY CHECK (char_length(token_hash) = 64),
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_key TEXT NOT NULL,
  identity_id TEXT NOT NULL,
  customer_key TEXT NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS customer_sessions_identity_idx ON customer_sessions (identity_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS customer_sessions_tenant_idx ON customer_sessions (tenant_id, restaurant_id);

ALTER TABLE customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sessions FORCE ROW LEVEL SECURITY;

-- Site público do restaurante: só as sessões DESTE restaurante (sem contexto, nada).
DROP POLICY IF EXISTS inovas_customer_sessions_public ON customer_sessions;
CREATE POLICY inovas_customer_sessions_public ON customer_sessions
FOR ALL
USING (
  current_setting('app.audience', true) = 'public'
  AND tenant_id = current_setting('app.tenant_id', true)
  AND restaurant_id = current_setting('app.restaurant_id', true)
)
WITH CHECK (
  current_setting('app.audience', true) = 'public'
  AND tenant_id = current_setting('app.tenant_id', true)
  AND restaurant_id = current_setting('app.restaurant_id', true)
);

-- Troca de senha: o servidor (escopo "system") derruba as sessões da pessoa
-- em todos os restaurantes. Só leitura e marcação de saída; não cria nem apaga.
DROP POLICY IF EXISTS inovas_customer_sessions_system_select ON customer_sessions;
CREATE POLICY inovas_customer_sessions_system_select ON customer_sessions
FOR SELECT USING (current_setting('app.audience', true) = 'system');
DROP POLICY IF EXISTS inovas_customer_sessions_system_revoke ON customer_sessions;
CREATE POLICY inovas_customer_sessions_system_revoke ON customer_sessions
FOR UPDATE USING (current_setting('app.audience', true) = 'system')
WITH CHECK (current_setting('app.audience', true) = 'system' AND revoked_at IS NOT NULL);

-- Permissão para o usuário de runtime (o mesmo que já acessa a tabela customers).
DO $$
DECLARE
  runtime_role record;
BEGIN
  FOR runtime_role IN
    SELECT DISTINCT grantee FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'customers'
      AND privilege_type = 'SELECT' AND grantee NOT IN (current_user, 'PUBLIC', 'inovas_customer_auth')
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON customer_sessions TO %I', runtime_role.grantee);
  END LOOP;
END $$;

COMMIT;
