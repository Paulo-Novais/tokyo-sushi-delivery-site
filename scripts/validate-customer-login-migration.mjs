// Testa a migration 036 (login do cliente) num Postgres real em memória
// (PGlite), sem tocar em nenhum banco da Neon: aplica, confere RLS e
// permissões, roda a Better Auth de verdade em cima das tabelas e aplica o rollback.
// Uso: npm run validate:customer-login-migration
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pg = new PGlite();
const ok = (cond, msg) => { console.log(cond ? "OK  " : "FALHA", msg); if (!cond) process.exitCode = 1; };
const q = (sql, params) => pg.query(sql, params);
const assertRejects = async (fn, msg) => {
  let rejected = false;
  try {
    await fn();
  } catch {
    rejected = true;
  }
  ok(rejected, msg);
};

// Base mínima: tabela customers + usuário de runtime com SELECT nela (como em produção).
await pg.exec(`CREATE ROLE inovas_app_test NOLOGIN NOBYPASSRLS; CREATE TABLE customers (id text primary key); GRANT SELECT ON customers TO inovas_app_test;`);
await pg.exec(fs.readFileSync(`${REPO}/migrations/036_customer_login.sql`, "utf8"));
ok(true, "migration 036 aplicou sem erro");
await pg.exec(fs.readFileSync(`${REPO}/migrations/036_customer_login.sql`, "utf8"));
ok(true, "migration 036 aplicou de novo sem erro (idempotente)");

const role = (await q(`SELECT rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname='inovas_customer_auth'`)).rows[0];
ok(role && !role.rolsuper && !role.rolbypassrls, "usuário inovas_customer_auth sem superusuário e sem BYPASSRLS");

// ---- runtime: sessões por restaurante isoladas
const asRuntime = async (scope, fn) => {
  await pg.exec("BEGIN");
  try {
    await q(`SET LOCAL ROLE inovas_app_test`);
    for (const [k, v] of Object.entries(scope)) await q(`SELECT set_config($1, $2, true)`, [k, v]);
    return await fn();
  } finally { await pg.exec("ROLLBACK").catch(() => {}); }
};
const A = { "app.audience": "public", "app.tenant_id": "tA", "app.restaurant_id": "rA" };
const B = { "app.audience": "public", "app.tenant_id": "tB", "app.restaurant_id": "rB" };
const hash = "a".repeat(64);
// grava como A (com commit)
await pg.exec("BEGIN"); await q("SET LOCAL ROLE inovas_app_test");
for (const [k, v] of Object.entries(A)) await q(`SELECT set_config($1,$2,true)`, [k, v]);
await q(`INSERT INTO customer_sessions (token_hash, tenant_id, restaurant_id, restaurant_key, identity_id, customer_key, expires_at) VALUES ($1,'tA','rA','ka','u1','phone:16991234567', NOW() + interval '1 day')`, [hash]);
await pg.exec("COMMIT");
ok((await asRuntime(A, () => q(`SELECT count(*)::int n FROM customer_sessions`))).rows[0].n === 1, "restaurante A vê a própria sessão");
ok((await asRuntime(B, () => q(`SELECT count(*)::int n FROM customer_sessions`))).rows[0].n === 0, "restaurante B NÃO vê a sessão de A");
ok((await asRuntime({}, () => q(`SELECT count(*)::int n FROM customer_sessions`))).rows[0].n === 0, "sem contexto de restaurante: nada");
const upd = await asRuntime(B, () => q(`UPDATE customer_sessions SET revoked_at = NOW() WHERE token_hash=$1`, [hash]));
ok(upd.affectedRows === 0, "restaurante B NÃO consegue alterar a sessão de A");
let denied = false;
try { await asRuntime(B, () => q(`INSERT INTO customer_sessions (token_hash, tenant_id, restaurant_id, restaurant_key, identity_id, customer_key, expires_at) VALUES ($1,'tA','rA','ka','u2','phone:1', NOW())`, ["b".repeat(64)])); } catch { denied = true; }
ok(denied, "restaurante B NÃO consegue gravar sessão em nome de A");
let noAuth = false;
try { await asRuntime(A, () => q(`SELECT * FROM customer_auth_users`)); } catch (e) { noAuth = /permission denied/.test(e.message); }
ok(noAuth, "usuário de runtime NÃO lê as contas de login (customer_auth_users)");
const sysRevoke = await asRuntime({ "app.audience": "system" }, () => q(`UPDATE customer_sessions SET revoked_at = NOW() WHERE identity_id='u1' AND revoked_at IS NULL`));
ok(sysRevoke.affectedRows === 1, "servidor (system) consegue derrubar as sessões da pessoa (troca de senha)");
let sysDelete = 0;
try { sysDelete = (await asRuntime({ "app.audience": "system" }, () => q(`DELETE FROM customer_sessions`))).affectedRows; } catch { sysDelete = -1; }
ok(sysDelete !== 1 && sysDelete <= 0, "nem o system apaga sessões (só marca saída)");

// ---- Loja de sessões (lib/customer-session-store.cjs) com o SQL de produção,
// rodando como o usuário de runtime e com o escopo do restaurante aplicado.
{
  const store = require(`${REPO}/lib/customer-session-store.cjs`);
  const { getDatabaseScope } = require(`${REPO}/lib/tenant-sql.cjs`);
  const sql = async (strings, ...values) => {
    const text = strings.reduce((acc, part, index) => acc + part + (index < values.length ? `$${index + 1}` : ""), "");
    const scope = getDatabaseScope();
    await pg.exec("BEGIN");
    try {
      await q("SET LOCAL ROLE inovas_app_test");
      const settings = [
        ["app.audience", scope.audience],
        ["app.tenant_id", scope.tenantId || "__none__"],
        ["app.restaurant_id", scope.restaurantId || "__none__"],
      ];
      for (const [key, value] of settings) await q("SELECT set_config($1, $2, true)", [key, value]);
      const result = await q(text, values);
      await pg.exec("COMMIT");
      return result.rows;
    } catch (error) {
      await pg.exec("ROLLBACK").catch(() => {});
      throw error;
    }
  };
  store.setCustomerSessionSqlForTests(sql);
  const tenantA = { tenantId: "tA", restaurantId: "rA", restaurantKey: "ka" };
  const tenantB = { tenantId: "tB", restaurantId: "rB", restaurantKey: "kb" };
  const person = { identityId: "pessoa-1", customerKey: "phone:16991234567", name: "Ana", phone: "16991234567", email: "ana@x.test" };
  const a = await store.createCustomerSession(tenantA, person);
  const b = await store.createCustomerSession(tenantB, person);
  ok((await store.findCustomerSession(tenantA, a.token))?.identityId === "pessoa-1", "loja: sessão de A encontrada em A (SQL de produção)");
  ok((await store.findCustomerSession(tenantB, a.token)) === null, "loja: token de A não abre sessão em B");
  await store.updateCustomerSessionProfile(tenantA, a.token, { phone: "16900001111", customerKey: "phone:16900001111" });
  ok((await store.findCustomerSession(tenantA, a.token))?.phone === "16900001111", "loja: telefone atualizado na sessão");
  await store.revokeCustomerSession(tenantA, a.token);
  ok((await store.findCustomerSession(tenantA, a.token)) === null, "loja: Sair derruba a sessão");
  ok((await store.findCustomerSession(tenantB, b.token))?.identityId === "pessoa-1", "loja: sair em A não derruba B");
  await store.revokeAllSessionsForIdentity("pessoa-1");
  ok((await store.findCustomerSession(tenantB, b.token)) === null, "loja: troca de senha derruba as sessões em todos os restaurantes");
  await assertRejects(
    () => store.createCustomerSession({ tenantId: "", restaurantId: "", restaurantKey: "" }, person),
    "loja: sem restaurante, falha"
  );
  store.setCustomerSessionSqlForTests(null);
}

// ---- Better Auth de verdade nas tabelas, como inovas_customer_auth
await q(`SET ROLE inovas_customer_auth`);
const pool = {
  connect: async () => ({
    query: async (sql, params) => {
      const r = await pg.query(sql, params || []);
      const command = String(sql).trim().split(/\s+/)[0].toUpperCase();
      return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length, command };
    },
    release: () => {},
  }),
  end: async () => {},
};
const { PostgresDialect } = await import(require.resolve("kysely"));
delete process.env.CUSTOMER_AUTH_DATABASE_URL;
process.env.CUSTOMER_AUTH_URL = "http://127.0.0.1:3000";
const identity = require(`${REPO}/lib/customer-identity.cjs`);
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "inovas-036-"));
process.env.INOVAS_CUSTOMER_SESSIONS_FILE = path.join(tmpDir, "sessions.json");
process.env.INOVAS_CUSTOMER_OUTBOX_FILE = path.join(tmpDir, "outbox.json");
identity.setCustomerAuthDatabaseForTests({ dialect: new PostgresDialect({ pool }), type: "postgres" });
const auth = await identity.getCustomerAuth();
const B_URL = "http://127.0.0.1:3000/api/customer/identity";
const call = async (path, body, cookie = "") => {
  const r = await auth.handler(new Request(B_URL + path, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", origin: "http://127.0.0.1:3000", "x-forwarded-for": "10.1.1.1", cookie }, body: body ? JSON.stringify(body) : undefined }));
  return { status: r.status, cookies: r.headers.getSetCookie(), text: await r.text() };
};
ok((await call("/sign-up/email", { name: "Ana", email: "ana@pg.test", password: "senha-forte-1", phone: "16991234567" })).status === 200, "Better Auth: cadastro grava no Postgres");
const s = await call("/sign-in/email", { email: "ana@pg.test", password: "senha-forte-1" });
ok(s.status === 200, "Better Auth: login com senha no Postgres");
const cookie = s.cookies.map((c) => c.split(";")[0]).join("; ");
ok(JSON.parse((await call("/get-session", null, cookie)).text)?.user?.phone === "16991234567", "Better Auth: sessão e telefone lidos do Postgres");
const acc = (await q(`SELECT "password" FROM customer_auth_accounts WHERE "providerId"='credential'`)).rows[0];
ok(acc && acc.password.startsWith("$argon2id$") && !acc.password.includes("senha-forte-1"), "senha guardada só como hash argon2id");
ok((await call("/sign-in/email", { email: "ana@pg.test", password: "errada-12345" })).status === 401, "senha errada recusada");
const user = (await q(`SELECT id FROM customer_auth_users WHERE email='ana@pg.test'`)).rows[0];
const code = await identity.createHandoffCode({ user, restaurantKey: "ka", returnUrl: new URL("https://ka.example/cardapio") });
ok(Boolean(await identity.redeemHandoffCode({ code, restaurantKey: "ka", origin: "https://ka.example" })), "código de uso único funciona uma vez");
ok(!(await identity.redeemHandoffCode({ code, restaurantKey: "ka", origin: "https://ka.example" })), "código de uso único NÃO funciona na segunda vez");
await q(`RESET ROLE`);

// ---- rollback
await pg.exec(fs.readFileSync(`${REPO}/migrations/036_customer_login.rollback.sql`, "utf8"));
const left = (await q(`SELECT count(*)::int n FROM information_schema.tables WHERE table_name LIKE 'customer_auth_%' OR table_name='customer_sessions'`)).rows[0].n;
const roleLeft = (await q(`SELECT count(*)::int n FROM pg_roles WHERE rolname='inovas_customer_auth'`)).rows[0].n;
ok(left === 0 && roleLeft === 0, "rollback remove as tabelas e o usuário de banco");
ok((await q(`SELECT count(*)::int n FROM customers`)).rows[0].n === 0 && true, "rollback não mexe em customers");
await pg.exec(fs.readFileSync(`${REPO}/migrations/036_customer_login.sql`, "utf8"));
ok(true, "migration aplica de novo depois do rollback");
process.exit(process.exitCode || 0);
