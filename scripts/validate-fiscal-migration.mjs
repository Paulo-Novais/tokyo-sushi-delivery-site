// Testa a migration 037 (notas fiscais) num Postgres em memória (PGlite), sem
// tocar em nenhum banco da Neon: aplica duas vezes, confere RLS/permissões,
// grava como "system", bloqueia outros escopos e aplica o rollback.
// Uso: node scripts/validate-fiscal-migration.mjs
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pg = new PGlite();
const ok = (cond, msg) => { console.log(cond ? "OK  " : "FALHA", msg); if (!cond) process.exitCode = 1; };

await pg.exec(`CREATE ROLE inovas_app_test NOLOGIN NOBYPASSRLS; CREATE TABLE admin_users (id text primary key); GRANT SELECT ON admin_users TO inovas_app_test;`);
const sql = fs.readFileSync(`${REPO}/migrations/037_fiscal_invoices.sql`, "utf8");
await pg.exec(sql);
ok(true, "migration 037 aplicou sem erro");
await pg.exec(sql);
ok(true, "migration 037 pode rodar de novo (idempotente)");
const rls = await pg.query(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'fiscal_invoices'`);
ok(rls.rows[0]?.relrowsecurity && rls.rows[0]?.relforcerowsecurity, "RLS ligado e forçado");
const grants = await pg.query(`SELECT privilege_type FROM information_schema.role_table_grants WHERE table_name = 'fiscal_invoices' AND grantee = 'inovas_app_test' ORDER BY 1`);
ok(grants.rows.map((r) => r.privilege_type).join(",") === "INSERT,SELECT,UPDATE", "usuário do sistema: SELECT, INSERT, UPDATE (sem DELETE)");

await pg.exec(`SET ROLE inovas_app_test`);
await pg.exec(`SELECT set_config('app.audience', 'system', false)`);
await pg.query(`INSERT INTO fiscal_invoices (id, tenant_id, restaurant_id, restaurant_key, order_id, provider_ref, provider, status, amount_cents)
  VALUES ('nfce_1', 't', 'r', 'k', 'o1', 'inv-1', 'fake', 'PROCESSING', 7980)`);
ok((await pg.query(`SELECT count(*)::int AS n FROM fiscal_invoices`)).rows[0].n === 1, "escopo system grava e lê");
let rejected = false;
try {
  await pg.query(`INSERT INTO fiscal_invoices (id, tenant_id, restaurant_id, restaurant_key, order_id, provider_ref, provider, status, amount_cents)
    VALUES ('nfce_2', 't', 'r', 'k', 'o2', 'inv-1', 'fake', 'PROCESSING', 1)`);
} catch { rejected = true; }
ok(rejected, "referência repetida no emissor é recusada");
await pg.exec(`SELECT set_config('app.audience', 'public', false)`);
ok((await pg.query(`SELECT count(*)::int AS n FROM fiscal_invoices`)).rows[0].n === 0, "escopo público não enxerga notas");
await pg.exec(`RESET ROLE`);
await pg.exec(fs.readFileSync(`${REPO}/migrations/037_fiscal_invoices.rollback.sql`, "utf8"));
ok((await pg.query(`SELECT to_regclass('fiscal_invoices') AS t`)).rows[0].t === null, "rollback apaga só a tabela nova");
ok((await pg.query(`SELECT to_regclass('admin_users') AS t`)).rows[0].t !== null, "rollback não mexe em outras tabelas");
