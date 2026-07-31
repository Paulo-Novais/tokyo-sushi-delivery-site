import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  Client,
  neon,
} from "@neondatabase/serverless";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(
  rootDir,
  "migrations",
  "022_cash_register_dining_room.sql"
);
const expectedTables = Object.freeze([
  "dining_tables",
  "cash_register_sessions",
  "dining_tabs",
  "dining_tab_items",
  "dining_order_batches",
  "cash_payment_sets",
  "cash_payments",
  "cash_register_movements",
  "cash_register_audit_events",
]);
const expectedForeignKeys = Object.freeze([
  ["dining_tabs", "cash_register_sessions"],
  ["dining_tabs", "dining_tables"],
  ["dining_tab_items", "dining_tabs"],
  ["dining_order_batches", "dining_tabs"],
  ["dining_order_batches", "orders"],
  ["cash_payment_sets", "cash_register_sessions"],
  ["cash_payment_sets", "dining_tabs"],
  ["cash_payments", "cash_payment_sets"],
  ["cash_payments", "cash_register_sessions"],
  ["cash_payments", "dining_tabs"],
  ["cash_register_movements", "cash_register_sessions"],
  ["cash_register_movements", "dining_tabs"],
  ["cash_register_movements", "cash_payment_sets"],
]);
const expectedUniqueIndexes = Object.freeze([
  "cash_register_sessions_one_open_uidx",
  "dining_tabs_one_active_per_table_uidx",
]);
const expectedPermissionKeys = Object.freeze([
  "tenant.cash_register.view",
  "tenant.cash_register.configure",
  "tenant.cash_register.open",
  "tenant.cash_register.close",
  "tenant.cash_register.open_tab",
  "tenant.cash_register.add_item",
  "tenant.cash_register.send_order",
  "tenant.cash_register.discount",
  "tenant.cash_register.remove_service",
  "tenant.cash_register.close_tab",
  "tenant.cash_register.confirm_payment",
  "tenant.cash_register.history",
]);

const fingerprint = (value) =>
  value
    ? crypto
        .createHash("sha256")
        .update(String(value))
        .digest("hex")
        .slice(0, 16)
    : "missing";

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const sanitizeError = (error) =>
  String(error?.message || error || "unknown")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_URL]")
    .replace(/ep-[a-z0-9-]+(?:\.[a-z0-9.-]+)?/gi, "[REDACTED_HOST]")
    .replace(/password=[^\s&]+/gi, "password=[REDACTED]")
    .slice(0, 500);

const getPreviewContext = async () => {
  assert(
    process.env.INOVAS_ENVIRONMENT === "preview",
    "INOVAS_ENVIRONMENT precisa ser preview."
  );
  assert(
    process.env.INOVAS_TENANT_MODE === "strict",
    "INOVAS_TENANT_MODE precisa ser strict no Preview."
  );
  assert(process.env.DATABASE_URL, "DATABASE_URL Preview ausente.");
  assert(process.env.NEON_PROJECT_ID, "NEON_PROJECT_ID Preview ausente.");
  assert(process.env.NEON_BRANCH_ID, "NEON_BRANCH_ID Preview ausente.");

  const databaseUrl = new URL(process.env.DATABASE_URL);
  assert(
    ["postgres:", "postgresql:"].includes(databaseUrl.protocol),
    "DATABASE_URL Preview nao e PostgreSQL."
  );
  const sql = neon(databaseUrl.toString());
  const [identity] = await sql`
    SELECT
      current_setting('neon.branch_id', true) AS branch_id,
      current_setting('neon.project_id', true) AS project_id,
      current_database() AS database_name,
      current_user AS database_user,
      current_setting('server_version') AS server_version
  `;
  assert(identity?.branch_id, "O banco Preview nao informou neon.branch_id.");
  assert(
    identity.branch_id === process.env.NEON_BRANCH_ID,
    "NEON_BRANCH_ID nao corresponde ao banco conectado."
  );
  assert(
    !identity.project_id ||
      identity.project_id === process.env.NEON_PROJECT_ID,
    "NEON_PROJECT_ID nao corresponde ao banco conectado."
  );

  return {
    sql,
    identity,
    databaseUrl,
  };
};

const printIdentity = async () => {
  const { identity, databaseUrl } = await getPreviewContext();
  console.log(
    [
      "PREVIEW_IDENTITY",
      "verified=true",
      `project_fp=${fingerprint(
        identity.project_id || process.env.NEON_PROJECT_ID
      )}`,
      `branch_fp=${fingerprint(identity.branch_id)}`,
      `host_fp=${fingerprint(databaseUrl.hostname)}`,
      `database_fp=${fingerprint(identity.database_name)}`,
      `user_fp=${fingerprint(identity.database_user)}`,
      `server_version=${identity.server_version}`,
    ].join(";")
  );
};

const assertMigrationDependencies = async (sql) => {
  const [dependencies] = await sql`
    SELECT
      to_regclass('public.orders') IS NOT NULL AS orders_exists,
      to_regclass('public.permission_definitions') IS NOT NULL AS permissions_exists,
      to_regclass('public.role_definitions') IS NOT NULL AS roles_exists,
      to_regclass('public.role_permission_bindings') IS NOT NULL AS bindings_exists
  `;
  assert(dependencies?.orders_exists, "Tabela orders ausente.");
  assert(
    dependencies?.permissions_exists,
    "Tabela permission_definitions ausente."
  );
  assert(dependencies?.roles_exists, "Tabela role_definitions ausente.");
  assert(
    dependencies?.bindings_exists,
    "Tabela role_permission_bindings ausente."
  );
};

const applyMigration = async () => {
  const { sql } = await getPreviewContext();
  await assertMigrationDependencies(sql);
  const migration = await fs.readFile(migrationPath, "utf8");
  const destructiveSql = migration
    .replace(/--.*$/gm, "")
    .match(/\b(?:DROP\s+TABLE|TRUNCATE|DELETE\s+FROM)\b/i);
  assert(!destructiveSql, "Migration 022 contem operacao destrutiva inesperada.");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();
  try {
    await client.query(
      `
        SELECT
          set_config('app.audience', 'system', false),
          set_config('app.support_mode', 'NONE', false),
          set_config('app.tenant_id', '__none__', false),
          set_config('app.restaurant_id', '__none__', false)
      `
    );
    await client.query(migration);
  } finally {
    await client.end();
  }
  console.log(
    `MIGRATION_022_APPLIED;sha256=${crypto
      .createHash("sha256")
      .update(migration)
      .digest("hex")}`
  );
};

const validateSchema = async () => {
  const { sql } = await getPreviewContext();
  await assertMigrationDependencies(sql);
  const tables = await sql.query(
    `
      SELECT
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS rls_forced
      FROM pg_class AS c
      INNER JOIN pg_namespace AS n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname = ANY($1::text[])
      ORDER BY c.relname
    `,
    [expectedTables]
  );
  assert(
    tables.length === expectedTables.length,
    `Esperadas ${expectedTables.length} tabelas; encontradas ${tables.length}.`
  );
  assert(
    tables.every((table) => table.rls_enabled && table.rls_forced),
    "Todas as tabelas do Caixa precisam de RLS ENABLE + FORCE."
  );

  const policies = await sql.query(
    `
      SELECT tablename, policyname, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
        AND policyname = 'inovas_cash_tenant_access'
      ORDER BY tablename
    `,
    [expectedTables]
  );
  assert(
    policies.length === expectedTables.length,
    "Politica RLS do Caixa ausente em uma ou mais tabelas."
  );
  assert(
    policies.every(
      (policy) =>
        policy.cmd === "ALL" &&
        String(policy.qual || "").includes("app.tenant_id") &&
        String(policy.qual || "").includes("app.restaurant_id") &&
        String(policy.with_check || "").includes("app.support_mode")
    ),
    "Definicao da politica RLS nao corresponde ao escopo esperado."
  );

  const foreignKeys = await sql.query(
    `
      SELECT
        source.relname AS source_table,
        target.relname AS target_table
      FROM pg_constraint AS constraint_record
      INNER JOIN pg_class AS source
        ON source.oid = constraint_record.conrelid
      INNER JOIN pg_class AS target
        ON target.oid = constraint_record.confrelid
      INNER JOIN pg_namespace AS namespace_record
        ON namespace_record.oid = source.relnamespace
      WHERE namespace_record.nspname = 'public'
        AND constraint_record.contype = 'f'
        AND source.relname = ANY($1::text[])
      ORDER BY source.relname, target.relname
    `,
    [expectedTables]
  );
  for (const [source, target] of expectedForeignKeys) {
    assert(
      foreignKeys.some(
        (foreignKey) =>
          foreignKey.source_table === source &&
          foreignKey.target_table === target
      ),
      `Foreign key ausente: ${source} -> ${target}.`
    );
  }

  const uniqueIndexes = await sql.query(
    `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY($1::text[])
      ORDER BY indexname
    `,
    [expectedUniqueIndexes]
  );
  assert(
    uniqueIndexes.length === expectedUniqueIndexes.length,
    "Indices unicos parciais do Caixa ausentes."
  );
  assert(
    uniqueIndexes.every(
      (index) =>
        String(index.indexdef).includes("UNIQUE") &&
        String(index.indexdef).includes("WHERE")
    ),
    "Indices de concorrencia precisam ser UNIQUE e parciais."
  );

  const constraints = await sql.query(
    `
      SELECT
        constraint_record.contype AS constraint_type,
        COUNT(*)::integer AS total
      FROM pg_constraint AS constraint_record
      INNER JOIN pg_class AS table_record
        ON table_record.oid = constraint_record.conrelid
      INNER JOIN pg_namespace AS namespace_record
        ON namespace_record.oid = table_record.relnamespace
      WHERE namespace_record.nspname = 'public'
        AND table_record.relname = ANY($1::text[])
      GROUP BY constraint_record.contype
      ORDER BY constraint_record.contype
    `,
    [expectedTables]
  );
  const constraintCounts = Object.fromEntries(
    constraints.map((entry) => [
      entry.constraint_type,
      Number(entry.total || 0),
    ])
  );
  assert(
    Number(constraintCounts.p || 0) === expectedTables.length,
    "Todas as tabelas precisam de primary key."
  );
  assert(
    Number(constraintCounts.f || 0) >= expectedForeignKeys.length,
    "Quantidade de foreign keys abaixo do esperado."
  );
  assert(
    Number(constraintCounts.c || 0) >= 20,
    "Quantidade de check constraints abaixo do esperado."
  );

  const [, permissions, roleBindingRows] = await sql.transaction(
    [
      sql`SELECT set_config('app.audience', 'system', true)`,
      sql`
        SELECT key
        FROM permission_definitions
        WHERE key = ANY(${expectedPermissionKeys})
          AND active = TRUE
        ORDER BY key
      `,
      sql`
        SELECT COUNT(*)::integer AS total
        FROM role_permission_bindings
        WHERE domain = 'RESTAURANT'
          AND permission_key = ANY(${expectedPermissionKeys})
      `,
    ],
    { readOnly: true }
  );
  assert(
    permissions.length === expectedPermissionKeys.length,
    "Permissoes do Caixa nao foram materializadas integralmente."
  );

  const [roleBindings] = roleBindingRows;
  assert(
    Number(roleBindings?.total || 0) >= 12,
    "Bindings de perfil para o Caixa nao foram materializados."
  );

  console.log(
    [
      "MIGRATION_022_VALID",
      `tables=${tables.length}`,
      `policies=${policies.length}`,
      `foreign_keys=${foreignKeys.length}`,
      `unique_partial_indexes=${uniqueIndexes.length}`,
      `primary_keys=${Number(constraintCounts.p || 0)}`,
      `check_constraints=${Number(constraintCounts.c || 0)}`,
      `permissions=${permissions.length}`,
      `role_bindings=${Number(roleBindings?.total || 0)}`,
    ].join(";")
  );
};

const scopedQueries = (sql, tenantId, restaurantId, statements) => [
  sql`
    SELECT
      set_config('app.audience', 'restaurant', true),
      set_config('app.tenant_id', ${tenantId}, true),
      set_config('app.restaurant_id', ${restaurantId}, true),
      set_config('app.support_mode', 'NONE', true)
  `,
  ...statements,
];

const validateRls = async () => {
  const { sql } = await getPreviewContext();
  const [role] = await sql`
    SELECT rolsuper, rolbypassrls
    FROM pg_roles
    WHERE rolname = current_user
  `;
  assert(role && !role.rolsuper, "Usuario Preview nao pode ser superuser.");
  assert(
    !role.rolbypassrls,
    "Usuario Preview nao pode possuir BYPASSRLS."
  );

  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const tenantA = `tenant_rls_a_${suffix}`;
  const restaurantA = `restaurant_rls_a_${suffix}`;
  const tenantB = `tenant_rls_b_${suffix}`;
  const restaurantB = `restaurant_rls_b_${suffix}`;
  const tableA = `table_rls_a_${suffix}`;
  const tableB = `table_rls_b_${suffix}`;

  try {
    await sql.transaction(
      scopedQueries(sql, tenantA, restaurantA, [
        sql`
          INSERT INTO dining_tables (
            id, tenant_id, restaurant_id, restaurant_key,
            number, label, capacity, status, sort_order
          )
          VALUES (
            ${tableA}, ${tenantA}, ${restaurantA}, 'rls-a',
            1, 'RLS A', 4, 'FREE', 1
          )
        `,
      ])
    );
    await sql.transaction(
      scopedQueries(sql, tenantB, restaurantB, [
        sql`
          INSERT INTO dining_tables (
            id, tenant_id, restaurant_id, restaurant_key,
            number, label, capacity, status, sort_order
          )
          VALUES (
            ${tableB}, ${tenantB}, ${restaurantB}, 'rls-b',
            1, 'RLS B', 4, 'FREE', 1
          )
        `,
      ])
    );

    const [, visibleA] = await sql.transaction(
      scopedQueries(sql, tenantA, restaurantA, [
        sql`
          SELECT id
          FROM dining_tables
          WHERE id IN (${tableA}, ${tableB})
          ORDER BY id
        `,
      ]),
      { readOnly: true }
    );
    const [, visibleB] = await sql.transaction(
      scopedQueries(sql, tenantB, restaurantB, [
        sql`
          SELECT id
          FROM dining_tables
          WHERE id IN (${tableA}, ${tableB})
          ORDER BY id
        `,
      ]),
      { readOnly: true }
    );
    assert(
      visibleA.length === 1 && visibleA[0].id === tableA,
      "Tenant A visualizou dados fora do proprio escopo."
    );
    assert(
      visibleB.length === 1 && visibleB[0].id === tableB,
      "Tenant B visualizou dados fora do proprio escopo."
    );

    let crossTenantWriteBlocked = false;
    try {
      await sql.transaction(
        scopedQueries(sql, tenantA, restaurantA, [
          sql`
            INSERT INTO dining_tables (
              id, tenant_id, restaurant_id, restaurant_key,
              number, label, capacity, status, sort_order
            )
            VALUES (
              ${`table_cross_${suffix}`}, ${tenantB}, ${restaurantB}, 'rls-b',
              2, 'RLS CROSS', 4, 'FREE', 2
            )
          `,
        ])
      );
    } catch (error) {
      crossTenantWriteBlocked =
        error?.code === "42501" ||
        /row-level security|policy/i.test(String(error?.message || ""));
    }
    assert(
      crossTenantWriteBlocked,
      "RLS nao bloqueou escrita cross-tenant."
    );

    console.log(
      "RLS_ISOLATION_VALID;read_a=1;read_b=1;cross_tenant_write=blocked;role_bypass=false"
    );
  } finally {
    await sql.transaction(
      scopedQueries(sql, tenantA, restaurantA, [
        sql`DELETE FROM dining_tables WHERE id = ${tableA}`,
      ])
    );
    await sql.transaction(
      scopedQueries(sql, tenantB, restaurantB, [
        sql`DELETE FROM dining_tables WHERE id = ${tableB}`,
      ])
    );
  }
};

const command = String(process.argv[2] || "identity").trim().toLowerCase();
const commands = {
  identity: printIdentity,
  migrate: applyMigration,
  validate: validateSchema,
  "validate-rls": validateRls,
};

if (!commands[command]) {
  console.error(
    "Uso: node scripts/manage-cash-register-preview.mjs identity|migrate|validate|validate-rls"
  );
  process.exit(2);
}

try {
  await commands[command]();
} catch (error) {
  console.error(
    `PREVIEW_DATABASE_COMMAND_FAILED;command=${command};code=${
      error?.code || "unknown"
    };message=${sanitizeError(error)}`
  );
  process.exit(1);
}
