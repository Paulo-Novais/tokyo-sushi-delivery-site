import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "@neondatabase/serverless";
import { runtimeTablePrivileges } from "./runtime-database-privileges.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const loadEnvironment = async () => {
  const raw = await fs.readFile(path.join(root, ".env.production.local"), "utf8").catch(() => "");
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
};
const quoteIdentifier = (value) => `"${String(value).replace(/"/g, '""')}"`;

await loadEnvironment();
const runtimeRole = String(process.env.INOVAS_RUNTIME_DB_ROLE || "").trim();
if (process.env.INOVAS_ENVIRONMENT !== "production") {
  throw new Error("INOVAS_ENVIRONMENT=production is required.");
}
if (!/^[a-z_][a-z0-9_]{2,62}$/.test(runtimeRole)) {
  throw new Error("INOVAS_RUNTIME_DB_ROLE is invalid.");
}
if (process.env.INOVAS_RUNTIME_RBAC_GRANT_CONFIRM !== `production:${runtimeRole}`) {
  throw new Error("Runtime RBAC grant confirmation was rejected.");
}

const connectionString = String(
  process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || ""
).trim();
if (!connectionString) throw new Error("Migration database URL is required.");

const requiredTables = [
  "permission_definitions",
  "permission_overrides",
  "restaurant_role_bindings",
  "role_definitions",
  "role_permission_bindings",
  "system_role_bindings",
];
const pool = new Pool({ connectionString });
const client = await pool.connect();
try {
  const identity = await client.query(
    `SELECT current_user AS database_user,
            current_setting('neon.branch_id', true) AS branch_id`
  );
  if (!/owner/i.test(String(identity.rows[0]?.database_user || ""))) {
    throw new Error("Runtime RBAC repair requires the database owner connection.");
  }
  const role = await client.query(
    `SELECT rolsuper, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname = $1`,
    [runtimeRole]
  );
  if (
    role.rowCount !== 1 || role.rows[0].rolsuper || role.rows[0].rolcreaterole ||
    role.rows[0].rolbypassrls
  ) {
    throw new Error("Runtime role boundary is invalid.");
  }

  await client.query("BEGIN");
  for (const tableName of requiredTables) {
    const privileges = runtimeTablePrivileges[tableName];
    if (!privileges?.length) throw new Error(`Missing privilege policy for ${tableName}.`);
    await client.query(
      `GRANT ${privileges.join(", ")} ON TABLE public.${quoteIdentifier(tableName)} TO ${quoteIdentifier(runtimeRole)}`
    );
  }
  await client.query(
    `GRANT ${quoteIdentifier(runtimeRole)} TO ${quoteIdentifier(identity.rows[0].database_user)}`
  );
  await client.query(`SET LOCAL ROLE ${quoteIdentifier(runtimeRole)}`);
  await client.query(`SELECT set_config('app.audience', 'system', true)`);
  const systemCheck = await client.query(
    `SELECT COUNT(*)::INTEGER AS permissions FROM permission_definitions
      WHERE domain = 'SYSTEM' AND active = TRUE`
  );
  await client.query(`SELECT set_config('app.audience', 'restaurant', true)`);
  const restaurantCheck = await client.query(
    `SELECT COUNT(*)::INTEGER AS permissions FROM permission_definitions
      WHERE domain = 'RESTAURANT' AND active = TRUE`
  );
  await client.query("RESET ROLE");
  await client.query(
    `REVOKE ${quoteIdentifier(runtimeRole)} FROM ${quoteIdentifier(identity.rows[0].database_user)}`
  );
  if (systemCheck.rows[0]?.permissions !== 19 || restaurantCheck.rows[0]?.permissions !== 60) {
    throw new Error("Runtime RBAC catalog postcondition failed.");
  }
  await client.query("COMMIT");
  console.log(JSON.stringify({
    ok: true,
    branchId: identity.rows[0].branch_id,
    runtimeRole,
    grantedTables: requiredTables,
    systemPermissions: systemCheck.rows[0].permissions,
    restaurantPermissions: restaurantCheck.rows[0].permissions,
  }, null, 2));
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
