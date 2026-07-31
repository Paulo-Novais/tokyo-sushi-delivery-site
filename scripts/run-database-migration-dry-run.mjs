import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Pool } from "@neondatabase/serverless";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(rootDir, "migrations");
const migrationArgument = String(process.argv[2] || "").trim();
const connectionString = String(process.env.MIGRATION_DATABASE_URL || "").trim();
const expectedBranchId = String(process.env.NEON_BRANCH_ID || "").trim();
const productionBranchId = String(
  process.env.INOVAS_PRODUCTION_BRANCH_ID || ""
).trim();
const confirmation = String(process.env.INOVAS_DRY_RUN_CONFIRM || "").trim();
const environment = String(process.env.INOVAS_ENVIRONMENT || "")
  .trim()
  .toLowerCase();
const sourceCommit = String(process.env.INOVAS_SOURCE_COMMIT || "").trim();
const expectedLegacyRows = Number(
  process.env.INOVAS_EXPECTED_LEGACY_ROWS || 303
);

const allowedMigrations = new Set([
  "014_extend_admin_users_creation_experience.sql",
  "015_system_restaurant_security_boundary.sql",
  "016_public_routing_and_provisioning_boundary.sql",
  "017_user_profile_metadata.sql",
  "018_user_session_lifecycle.sql",
  "019_tenant_identity_administration.sql",
  "020_support_view_least_privilege.sql",
  "021_authentication_identity_lookup.sql",
  "022_cash_register_dining_room.sql",
  "023_invitation_acceptance_rls.sql",
  "024_public_customer_upsert_rls.sql",
  "025_public_customer_order_tracking_rls.sql",
]);

const legacyTables = Object.freeze([
  "admin_users",
  "catalog_item_overrides",
  "catalog_promotions",
  "catalog_runtime_state",
  "customer_crm_profiles",
  "customer_reviews",
  "customers",
  "delivery_settings",
  "finance_closings",
  "inventory_runtime_state",
  "master_platform_state",
  "order_items",
  "order_status_events",
  "orders",
  "restaurant_settings",
]);

const dependenciesByMigration = Object.freeze({
  "014": ["admin_users"],
  "015": [
    "admin_users",
    "catalog_item_overrides",
    "catalog_promotions",
    "catalog_runtime_state",
    "customer_crm_profiles",
    "customer_reviews",
    "customers",
    "delivery_settings",
    "finance_closings",
    "inventory_runtime_state",
    "master_platform_state",
    "order_items",
    "order_status_events",
    "orders",
    "restaurant_settings",
  ],
  "016": [
    "admin_users",
    "master_platform_state",
    "identities",
    "restaurant_memberships",
  ],
  "017": ["admin_users"],
  "018": ["auth_sessions"],
  "019": ["identities", "restaurant_memberships"],
  "020": [
    "admin_users",
    "restaurant_memberships",
    "restaurant_role_bindings",
    "auth_sessions",
    "user_audit_events",
  ],
  "021": ["admin_users"],
  "022": [
    "orders",
    "permission_definitions",
    "role_definitions",
    "role_permission_bindings",
  ],
  "023": ["admin_users"],
  "024": ["customers"],
  "025": ["orders", "order_items", "order_status_events"],
});

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sanitize = (value) =>
  String(value?.message || value || "unknown")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/password=[^\s&]+/gi, "password=[REDACTED]")
    .slice(0, 800);

const quoteIdentifier = (value) =>
  `"${String(value).replaceAll('"', '""')}"`;

const stripTransactionWrapper = (sqlText) => {
  const beginMatches = [...sqlText.matchAll(/^\s*BEGIN;\s*$/gim)];
  const commitMatches = [...sqlText.matchAll(/^\s*COMMIT;\s*$/gim)];
  assert(beginMatches.length === 1, "Migration must contain exactly one BEGIN.");
  assert(commitMatches.length === 1, "Migration must contain exactly one COMMIT.");
  assert(
    beginMatches[0].index < commitMatches[0].index,
    "Migration transaction wrapper is malformed."
  );
  return sqlText
    .replace(/^\s*BEGIN;\s*$/im, "")
    .replace(/^\s*COMMIT;\s*$/im, "");
};

const getCatalogSnapshot = async (client) => {
  const catalog = (
    await client.query(`
      SELECT
        (SELECT count(*)::integer FROM pg_tables WHERE schemaname = 'public')
          AS tables,
        (SELECT count(*)::integer
         FROM information_schema.columns WHERE table_schema = 'public')
          AS columns,
        (SELECT count(*)::integer
         FROM pg_constraint AS constraint_record
         INNER JOIN pg_class AS table_record
           ON table_record.oid = constraint_record.conrelid
         INNER JOIN pg_namespace AS namespace_record
           ON namespace_record.oid = table_record.relnamespace
         WHERE namespace_record.nspname = 'public') AS constraints,
        (SELECT count(*)::integer
         FROM pg_indexes WHERE schemaname = 'public') AS indexes,
        (SELECT count(*)::integer
         FROM pg_policies WHERE schemaname = 'public') AS policies,
        (SELECT count(*)::integer
         FROM pg_class AS table_record
         INNER JOIN pg_namespace AS namespace_record
           ON namespace_record.oid = table_record.relnamespace
         WHERE namespace_record.nspname = 'public'
           AND table_record.relkind IN ('r', 'p')
           AND table_record.relrowsecurity) AS rls_tables,
        (SELECT count(*)::integer
         FROM pg_class AS table_record
         INNER JOIN pg_namespace AS namespace_record
           ON namespace_record.oid = table_record.relnamespace
         WHERE namespace_record.nspname = 'public'
           AND table_record.relkind IN ('r', 'p')
           AND table_record.relforcerowsecurity) AS forced_rls_tables
    `)
  ).rows[0];

  let legacyRows = 0;
  for (const tableName of legacyTables) {
    if (
      !(
        await client.query("SELECT to_regclass($1) IS NOT NULL AS present", [
          `public.${tableName}`,
        ])
      ).rows[0].present
    ) {
      continue;
    }
    const result = await client.query(
      `SELECT count(*)::integer AS total FROM public.${quoteIdentifier(tableName)}`
    );
    legacyRows += Number(result.rows[0].total || 0);
  }

  const orphanReviews = (
    await client.query(`
      SELECT count(*)::integer AS total
      FROM customer_reviews AS review_record
      LEFT JOIN customers AS customer_record
        ON customer_record.customer_key = review_record.customer_key
        AND customer_record.tenant_id = review_record.tenant_id
        AND customer_record.restaurant_id = review_record.restaurant_id
      WHERE NULLIF(review_record.customer_key, '') IS NOT NULL
        AND customer_record.id IS NULL
    `)
  ).rows[0].total;

  return {
    ...catalog,
    legacy_rows: legacyRows,
    orphan_reviews: Number(orphanReviews || 0),
  };
};

const validatePreconditions = async (client, version) => {
  const dependencies = dependenciesByMigration[version] || [];
  const dependencyRows = await client.query(
    `
      SELECT dependency_name,
        to_regclass('public.' || dependency_name) IS NOT NULL AS present
      FROM unnest($1::text[]) AS dependency_name
      ORDER BY dependency_name
    `,
    [dependencies]
  );
  const missing = dependencyRows.rows
    .filter((entry) => !entry.present)
    .map((entry) => entry.dependency_name);
  assert(missing.length === 0, `Missing dependencies: ${missing.join(", ")}`);

  if (["014", "015"].includes(version)) {
    const identityPreflight = (
      await client.query(`
        WITH normalized AS (
          SELECT
            LOWER(COALESCE(NULLIF(email, ''), login)) AS identity_email,
            LOWER(login) AS identity_login,
            LOWER(email) AS lower_email,
            tenant_id,
            restaurant_id,
            restaurant_key,
            status,
            user_type,
            (
              user_type IN (
                'MASTER', 'SOCIO', 'DESENVOLVEDOR', 'SUPORTE', 'VENDEDOR',
                'COMERCIAL', 'FINANCEIRO_INOVAS', 'IMPLANTACAO',
                'CUSTOMER_SUCCESS', 'AUDITOR'
              ) OR restaurant_key = ''
            ) AS is_system
          FROM admin_users
        )
        SELECT
          (SELECT count(*) FROM (
            SELECT lower_email FROM normalized
            WHERE lower_email <> '' GROUP BY 1 HAVING count(*) > 1
          ) AS duplicate_email)::integer AS duplicate_email_groups,
          (SELECT count(*) FROM (
            SELECT identity_login FROM normalized GROUP BY 1 HAVING count(*) > 1
          ) AS duplicate_login)::integer AS duplicate_login_groups,
          (SELECT count(*) FROM (
            SELECT identity_email FROM normalized GROUP BY 1 HAVING count(*) > 1
          ) AS duplicate_identity)::integer AS duplicate_identity_groups,
          count(*) FILTER (
            WHERE is_system AND status NOT IN ('ACTIVE', 'PENDING', 'BLOCKED')
          )::integer AS rejected_system_status,
          count(*) FILTER (
            WHERE NOT is_system
              AND status NOT IN ('ACTIVE', 'PENDING', 'BLOCKED', 'DISABLED')
          )::integer AS rejected_membership_status
        FROM normalized
      `)
    ).rows[0];
    assert(
      Object.values(identityPreflight).every((value) => Number(value) === 0),
      `Identity preflight rejected: ${JSON.stringify(identityPreflight)}`
    );
  }
};

const validatePostconditions = async (client, version) => {
  if (version === "014") {
    const result = (
      await client.query(`
        SELECT
          (SELECT count(*)::integer
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'admin_users'
             AND column_name = ANY($1::text[])) AS columns,
          to_regclass('public.admin_users_email_lower_uidx') IS NOT NULL AS index
      `, [[
        "job_title", "credential_mode", "must_change_password", "created_by",
        "invitation_token_hash", "invitation_expires_at",
        "invitation_created_at", "invitation_sent_at", "invitation_used_at",
        "audit_json",
      ]])
    ).rows[0];
    assert(result.columns === 10 && result.index, "Migration 014 postcondition failed.");
  }

  if (version === "015") {
    const result = (
      await client.query(`
        SELECT
          (SELECT count(*)::integer FROM identities) AS identities,
          (SELECT count(*)::integer FROM system_principals) AS principals,
          (SELECT count(*)::integer FROM restaurant_memberships) AS memberships,
          (SELECT count(*)::integer FROM permission_definitions
             WHERE version = '2026.07.25') AS permissions,
          (SELECT count(*)::integer FROM role_definitions
             WHERE version = '2026.07.25') AS roles
      `)
    ).rows[0];
    assert(
      result.identities === 2 && result.principals === 1 &&
        result.memberships === 1 && result.permissions === 34 && result.roles === 20,
      `Migration 015 postcondition failed: ${JSON.stringify(result)}`
    );
  }

  if (version === "016") {
    const result = (
      await client.query(`
        SELECT count(*)::integer AS routes FROM public_restaurant_routes
      `)
    ).rows[0];
    assert(result.routes === 1, "Migration 016 expected one projected route.");
  }

  if (version === "022") {
    const result = (
      await client.query(`
        SELECT
          (SELECT count(*)::integer FROM pg_tables
           WHERE schemaname = 'public'
             AND tablename = ANY($1::text[])) AS cash_tables,
          (SELECT count(*)::integer FROM permission_definitions
           WHERE key LIKE 'tenant.cash_register.%') AS cash_permissions,
          (SELECT count(*)::integer FROM role_permission_bindings
           WHERE permission_key LIKE 'tenant.cash_register.%') AS cash_bindings
      `, [[
        "dining_tables", "cash_register_sessions", "dining_tabs",
        "dining_tab_items", "dining_order_batches", "cash_payment_sets",
        "cash_payments", "cash_register_movements",
        "cash_register_audit_events",
      ]])
    ).rows[0];
    assert(
      result.cash_tables === 9 && result.cash_permissions === 12 &&
        result.cash_bindings === 53,
      `Migration 022 postcondition failed: ${JSON.stringify(result)}`
    );
  }
};

const main = async () => {
  assert(environment === "migration-dry-run", "Environment must be migration-dry-run.");
  assert(connectionString, "MIGRATION_DATABASE_URL is required.");
  assert(expectedBranchId, "NEON_BRANCH_ID is required.");
  assert(productionBranchId, "INOVAS_PRODUCTION_BRANCH_ID is required.");
  assert(expectedBranchId !== productionBranchId, "Production branch is forbidden.");
  assert(confirmation === expectedBranchId, "Dry-run confirmation was rejected.");
  assert(sourceCommit, "INOVAS_SOURCE_COMMIT is required.");
  assert(
    Number.isSafeInteger(expectedLegacyRows) && expectedLegacyRows >= 303,
    "INOVAS_EXPECTED_LEGACY_ROWS must be an integer of at least 303."
  );
  assert(migrationArgument, "Migration path is required.");

  const migrationPath = path.resolve(rootDir, migrationArgument);
  assert(
    path.dirname(migrationPath) === migrationsDir,
    "Migration must be directly inside the migrations directory."
  );
  const migrationName = path.basename(migrationPath);
  assert(allowedMigrations.has(migrationName), "Migration is not allowlisted.");
  const version = migrationName.slice(0, 3);
  const rawSql = await fs.readFile(migrationPath, "utf8");
  assert(rawSql.includes("INOVAS Food"), "Migration signature is missing.");
  const migrationBody = stripTransactionWrapper(rawSql);
  const sha256 = crypto.createHash("sha256").update(rawSql).digest("hex");

  const pool = new Pool({ connectionString });
  pool.on("error", () => {});
  const client = await pool.connect();
  try {
    const identity = (
      await client.query(`
        SELECT
          current_database() AS database_name,
          current_user AS database_user,
          current_setting('neon.branch_id', true) AS branch_id
      `)
    ).rows[0];
    assert(identity.branch_id === expectedBranchId, "Connected branch is not the dry-run branch.");
    assert(identity.branch_id !== productionBranchId, "Production connection was rejected.");
    const role = (
      await client.query(`
        SELECT rolcreaterole, rolbypassrls
        FROM pg_roles WHERE rolname = current_user
      `)
    ).rows[0];
    assert(role?.rolcreaterole && role?.rolbypassrls, "Administrative role is required.");

    await client.query(`CREATE SCHEMA IF NOT EXISTS inovas_migrations`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS inovas_migrations.schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        source_commit TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const existing = (
      await client.query(
        `SELECT version, name, sha256 FROM inovas_migrations.schema_migrations
         WHERE version = $1`,
        [version]
      )
    ).rows[0];
    if (existing) {
      assert(existing.name === migrationName, "Ledger name mismatch.");
      assert(existing.sha256 === sha256, "Ledger hash mismatch.");
      console.log(JSON.stringify({
        applied: false,
        skipped_by_ledger: true,
        version,
        migration: migrationName,
        sha256,
        branch_id: expectedBranchId,
      }));
      return;
    }

    const before = await getCatalogSnapshot(client);
    await validatePreconditions(client, version);
    const startedAt = performance.now();
    await client.query("BEGIN");
    try {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('inovas:schema-migration'))"
      );
      await client.query(migrationBody);
      await validatePostconditions(client, version);
      const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
      await client.query(
        `INSERT INTO inovas_migrations.schema_migrations
          (version, name, sha256, source_commit, branch_id, duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [version, migrationName, sha256, sourceCommit, expectedBranchId, durationMs]
      );
      await client.query("COMMIT");
      const after = await getCatalogSnapshot(client);
      assert(
        after.legacy_rows === expectedLegacyRows,
        "Legacy row count changed unexpectedly."
      );
      assert(after.orphan_reviews === 1, "Legacy orphan review was not preserved.");
      console.log(JSON.stringify({
        applied: true,
        version,
        migration: migrationName,
        sha256,
        branch_id: expectedBranchId,
        database: identity.database_name,
        administrator: identity.database_user,
        duration_ms: durationMs,
        before,
        after,
      }));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
};

main().catch((error) => {
  console.error(`DRY_RUN_MIGRATION_FAILED;message=${sanitize(error)}`);
  process.exit(1);
});
