import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "@neondatabase/serverless";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetLogin = "usermaster@gmail.com";
const migrationPath = path.join(root, "migrations", "027_restore_default_rbac_matrix.sql");

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

await loadEnvironment();

if (process.env.INOVAS_ENVIRONMENT !== "production") {
  throw new Error("INOVAS_ENVIRONMENT=production is required.");
}
if (process.env.INOVAS_MASTER_RBAC_REPAIR_CONFIRM !== targetLogin) {
  throw new Error(`INOVAS_MASTER_RBAC_REPAIR_CONFIRM must equal ${targetLogin}.`);
}

const connectionString = String(
  process.env.MIGRATION_DATABASE_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    ""
).trim();
if (!connectionString) throw new Error("Migration database URL is required.");

const migrationSql = await fs.readFile(migrationPath, "utf8");
const pool = new Pool({ connectionString });

try {
  const connection = await pool.query(
    "SELECT current_database() AS database_name, current_user AS database_user"
  );
  if (!/owner/i.test(String(connection.rows[0]?.database_user || ""))) {
    throw new Error("MASTER RBAC repair requires the database owner connection.");
  }

  const before = await pool.query(
    `SELECT u.user_scope, u.platform_scope, u.user_type, u.tenant_id,
            u.restaurant_id, u.restaurant_key,
            COUNT(DISTINCT membership.id)::INTEGER AS active_tenant_memberships
       FROM admin_users u
       JOIN identities identity ON LOWER(identity.login) = LOWER(u.login)
       LEFT JOIN restaurant_memberships membership
         ON membership.identity_id = identity.id AND membership.status = 'ACTIVE'
      WHERE LOWER(u.login) = LOWER($1)
      GROUP BY u.user_scope, u.platform_scope, u.user_type, u.tenant_id,
               u.restaurant_id, u.restaurant_key`,
    [targetLogin]
  );
  const master = before.rows[0];
  if (
    !master || master.user_scope !== "SYSTEM" || master.platform_scope !== true ||
    master.user_type !== "MASTER" || master.tenant_id || master.restaurant_id ||
    master.restaurant_key || master.active_tenant_memberships !== 0
  ) {
    throw new Error("MASTER identity boundary precondition failed.");
  }

  await pool.query(migrationSql);

  const verification = await pool.query(
    `SELECT role.version,
            COUNT(binding.permission_key)::INTEGER AS permission_count,
            BOOL_OR(binding.permission_key = 'system.dashboard.view') AS can_view_dashboard,
            BOOL_OR(binding.permission_key = 'system.users.manage') AS can_manage_users,
            BOOL_OR(binding.permission_key = 'system.roles.manage') AS can_manage_roles
       FROM role_definitions role
       LEFT JOIN role_permission_bindings binding
         ON binding.domain = role.domain
        AND binding.role_key = role.key
        AND binding.role_version = role.version
      WHERE role.domain = 'SYSTEM' AND role.key = 'MASTER' AND role.active = TRUE
      GROUP BY role.version`,
  );
  if (
    !verification.rows.length || verification.rows.some((row) =>
      row.permission_count !== 19 || !row.can_view_dashboard ||
      !row.can_manage_users || !row.can_manage_roles
    )
  ) {
    throw new Error("MASTER RBAC repair postcondition failed.");
  }

  console.log(JSON.stringify({
    ok: true,
    database: connection.rows[0].database_name,
    migration: path.basename(migrationPath),
    migrationSha256: crypto.createHash("sha256").update(migrationSql).digest("hex"),
    masterScope: master.user_scope,
    masterRole: master.user_type,
    activeTenantMemberships: master.active_tenant_memberships,
    activeRoleVersions: verification.rows,
  }, null, 2));
} finally {
  await pool.end();
}
