import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "@neondatabase/serverless";
import masterPlatformStore from "../lib/master-platform-store.cjs";
import tenantSql from "../lib/tenant-sql.cjs";
import kasuloBootstrap from "../lib/kasulo-bootstrap.cjs";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetEmail = "kasulorochapizzaria@gmail.com";
const migrationPath = path.join(
  workspaceRoot,
  "migrations",
  "026_explicit_identity_scope_and_kasulo_recovery.sql"
);

const loadLocalEnvironment = async () => {
  const envPath = path.join(workspaceRoot, ".env.production.local");
  const raw = await fs.readFile(envPath, "utf8").catch(() => "");
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
};

await loadLocalEnvironment();

if (process.env.INOVAS_ENVIRONMENT !== "production") {
  throw new Error("INOVAS_ENVIRONMENT=production is required.");
}
if (process.env.INOVAS_KASULO_RECOVERY_CONFIRM !== targetEmail) {
  throw new Error(
    `INOVAS_KASULO_RECOVERY_CONFIRM must equal ${targetEmail}.`
  );
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
const migrationSha256 = crypto
  .createHash("sha256")
  .update(migrationSql)
  .digest("hex");
const pool = new Pool({ connectionString });

try {
  const connection = await pool.query(
    "SELECT current_database() AS database_name, current_user AS database_user"
  );
  if (!/owner/i.test(String(connection.rows[0]?.database_user || ""))) {
    throw new Error("Kasulo recovery requires the database owner connection.");
  }

  await pool.query(migrationSql);

  process.env.DATABASE_URL = connectionString;
  tenantSql.enterDatabaseScope({
    audience: "system",
    identityId: "identity_migration_026",
    sessionId: "migration_026",
  });
  const recovery = await masterPlatformStore.provisionRestaurantRecovery(
    {
      restaurantName: "Kasulo Rocha Pizzaria",
      restaurantKey: "kasulo-rocha-pizzaria",
      ownerName: "Kasulo Rocha Pizzaria",
      ownerEmail: targetEmail,
      ownerPhone: "+5516991744108",
      logoUrl: kasuloBootstrap.KASULO_LOGO_URL,
      primaryColor: "#d93025",
      secondaryColor: "#f97316",
      document: "30.132.838/0001-08",
      address: {
        street: "Rua Batatais",
        number: "1106",
        neighborhood: "Centro",
        city: "Franca",
        state: "SP",
      },
      businessHours: "Terça a Domingo das 18:00 às 23:30",
      menuSourceUrl: kasuloBootstrap.KASULO_OFFICIAL_MENU_URL,
      plan: "PREMIUM",
      publicSiteEnabled: false,
    },
    {
      login: "migration-026",
      email: "migration-026@inovasfood.com.br",
      displayName: "Recuperação segura do tenant",
      userType: "MASTER",
    }
  );

  tenantSql.enterDatabaseScope({
    audience: "provisioning",
    identityId: "identity_migration_026",
    sessionId: "migration_026",
    ...kasuloBootstrap.KASULO_TENANT,
  });
  const catalog = await kasuloBootstrap.provisionKasuloCatalog({
    login: "migration-026",
    displayName: "Recuperação segura do tenant",
  });

  const verification = await pool.query(
    `SELECT
       u.login,
       u.user_scope,
       u.platform_scope,
       u.user_type,
       u.tenant_id,
       u.restaurant_id,
       u.restaurant_key,
       EXISTS (
         SELECT 1 FROM system_principals p WHERE p.identity_id = i.id
       ) AS has_system_principal,
       EXISTS (
         SELECT 1
         FROM restaurant_memberships m
         WHERE m.identity_id = i.id
           AND m.status = 'ACTIVE'
           AND m.restaurant_role = 'OWNER'
       ) AS has_active_owner_membership,
       EXISTS (
         SELECT 1
         FROM auth_sessions s
         WHERE s.identity_id = i.id
           AND s.audience = 'system'
           AND s.status = 'ACTIVE'
       ) AS has_active_system_session,
       NOT EXISTS (
         SELECT 1
         FROM public_restaurant_routes route
         WHERE route.restaurant_key = 'kasulo-rocha-pizzaria'
       ) AS has_no_public_site,
       (
         SELECT COUNT(*)::INTEGER
         FROM jsonb_array_elements(COALESCE(c.sections, '[]'::jsonb)) section,
              jsonb_array_elements(COALESCE(section->'items', '[]'::jsonb)) item
       ) AS catalog_item_count,
       (
         SELECT COUNT(*)::INTEGER
         FROM jsonb_array_elements(COALESCE(c.sections, '[]'::jsonb)) section,
              jsonb_array_elements(COALESCE(section->'items', '[]'::jsonb)) item
         WHERE item->>'id' LIKE 'rodizio-%'
            OR item->>'id' = 'taxa-infantil-5-a-10-anos'
       ) AS dining_only_item_count
     FROM admin_users u
     JOIN identities i ON LOWER(i.login) = LOWER(u.login)
     LEFT JOIN catalog_runtime_state c
       ON c.tenant_id = u.tenant_id
      AND c.restaurant_id = u.restaurant_id
      AND c.restaurant_key = u.restaurant_key
     WHERE LOWER(u.login) = LOWER($1)`,
    [targetEmail]
  );
  const result = verification.rows[0];
  if (
    !result ||
    result.user_scope !== "RESTAURANT" ||
    result.platform_scope !== false ||
    result.user_type !== "OWNER" ||
    result.has_system_principal !== false ||
    result.has_active_owner_membership !== true ||
    result.has_active_system_session !== false ||
    result.has_no_public_site !== true ||
    result.catalog_item_count !== 34 ||
    result.dining_only_item_count !== 4
  ) {
    throw new Error(`Kasulo postcondition failed: ${JSON.stringify(result)}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        database: connection.rows[0].database_name,
        migration: path.basename(migrationPath),
        migrationSha256,
        tenantRecovered: recovery.recovered,
        restaurantKey: result.restaurant_key,
        tenantId: result.tenant_id,
        restaurantId: result.restaurant_id,
        role: result.user_type,
        systemPrincipalRemoved: !result.has_system_principal,
        systemSessionsRevoked: !result.has_active_system_session,
        publicSiteDisabled: result.has_no_public_site,
        catalogItems: result.catalog_item_count,
        diningOnlyItems: result.dining_only_item_count,
        catalogStorageMode: catalog.storageMode,
      },
      null,
      2
    )
  );
} finally {
  await pool.end();
}
