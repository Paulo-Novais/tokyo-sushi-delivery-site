// Liga o usuário de banco da identidade do cliente (inovas_customer_auth),
// criado SEM login pela migration 036: define LOGIN + senha e confere que ele
// não é superusuário, não tem BYPASSRLS e só enxerga as tabelas customer_auth_*.
//
// A senha vem de variável de ambiente e NUNCA é escrita em arquivo ou log.
// Rodar só depois da migration 036, com backup e GO do Paulo.
//
// Variáveis:
//   MIGRATION_DATABASE_URL                conexão administrativa (neondb_owner) do branch alvo
//   INOVAS_TARGET_ENVIRONMENT             preview | production
//   INOVAS_EXPECTED_BRANCH_ID             id do branch Neon esperado
//   INOVAS_CUSTOMER_AUTH_DB_PASSWORD      senha nova (48+ caracteres)
//   INOVAS_CUSTOMER_AUTH_ROLE_CONFIRM     "<ambiente>:<branch>:inovas_customer_auth"
import { Pool } from "@neondatabase/serverless";

const ROLE = "inovas_customer_auth";
const AUTH_TABLES = [
  "customer_auth_users",
  "customer_auth_sessions",
  "customer_auth_accounts",
  "customer_auth_verifications",
  "customer_auth_rate_limits",
];

const sanitize = (error) =>
  String(error?.message || error || "erro")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[URL_OCULTA]")
    .replace(/password\s*'[^']*'/gi, "password '[OCULTA]'")
    .slice(0, 400);
const fail = (message) => {
  console.error(`CUSTOMER_AUTH_ROLE_FAILED;message=${sanitize(message)}`);
  process.exit(1);
};
process.on("unhandledRejection", fail);
process.on("uncaughtException", fail);

const url = String(process.env.MIGRATION_DATABASE_URL || "").trim();
const environment = String(process.env.INOVAS_TARGET_ENVIRONMENT || "").trim().toLowerCase();
const branch = String(process.env.INOVAS_EXPECTED_BRANCH_ID || "").trim();
const password = String(process.env.INOVAS_CUSTOMER_AUTH_DB_PASSWORD || "");
const confirm = String(process.env.INOVAS_CUSTOMER_AUTH_ROLE_CONFIRM || "").trim();

if (!["preview", "production"].includes(environment)) fail("INOVAS_TARGET_ENVIRONMENT precisa ser preview ou production.");
if (!url) fail("MIGRATION_DATABASE_URL é obrigatória.");
if (!branch) fail("INOVAS_EXPECTED_BRANCH_ID é obrigatório.");
if (password.length < 48) fail("A senha precisa ter 48 caracteres ou mais.");
if (confirm !== `${environment}:${branch}:${ROLE}`) fail("Confirmação recusada.");

const quoteLiteral = (value) => `'${String(value).replace(/'/g, "''")}'`;
const pool = new Pool({ connectionString: url });
pool.on("error", () => {});
const client = await pool.connect();
try {
  const identity = (await client.query(`SELECT current_setting('neon.branch_id', true) AS branch_id`)).rows[0];
  if (identity?.branch_id !== branch) fail("O banco conectado não é o branch confirmado.");
  const role = (await client.query(`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1`, [ROLE])).rows[0];
  if (!role) fail("Usuário inovas_customer_auth não existe: aplique a migration 036 antes.");
  if (role.rolsuper || role.rolbypassrls) fail("Usuário inovas_customer_auth com permissão proibida (superusuário ou BYPASSRLS).");

  await client.query(
    `ALTER ROLE ${ROLE} WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION CONNECTION LIMIT 20 PASSWORD ${quoteLiteral(password)}`
  );
  await client.query(`ALTER ROLE ${ROLE} SET search_path = pg_catalog, public`);

  // Só as tabelas customer_auth_* (nada de pedidos, clientes ou equipe).
  const grants = (
    await client.query(
      `SELECT DISTINCT table_name FROM information_schema.role_table_grants WHERE grantee = $1 AND table_schema = 'public'`,
      [ROLE]
    )
  ).rows.map((row) => row.table_name);
  const extra = grants.filter((name) => !AUTH_TABLES.includes(name));
  if (extra.length) fail(`Permissão em tabela fora do login: ${extra.join(", ")}`);
  const missing = AUTH_TABLES.filter((name) => !grants.includes(name));
  if (missing.length) fail(`Faltam permissões: ${missing.join(", ")}`);

  console.log(`CUSTOMER_AUTH_ROLE_OK;environment=${environment};branch=${branch};role=${ROLE}`);
} finally {
  client.release();
  await pool.end();
}
