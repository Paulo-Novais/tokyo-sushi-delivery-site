import { Pool } from "@neondatabase/serverless";
import {
  runtimeFunctionPrivileges,
  runtimeReferencedTables,
  runtimeSequencePrivileges,
  runtimeTablePrivileges,
} from "./runtime-database-privileges.mjs";

const sanitizeError = (error) =>
  String(error?.message || error || "unknown")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/password=[^\s&]+/gi, "password=[REDACTED]")
    .slice(0, 500);
process.on("uncaughtException", (error) => {
  console.error(`RUNTIME_ROLE_COMMAND_FAILED;message=${sanitizeError(error)}`);
  process.exit(1);
});
process.on("unhandledRejection", (error) => {
  console.error(`RUNTIME_ROLE_COMMAND_FAILED;message=${sanitizeError(error)}`);
  process.exit(1);
});

const migrationDatabaseUrl = String(
  process.env.MIGRATION_DATABASE_URL || ""
).trim();
const targetEnvironment = String(
  process.env.INOVAS_TARGET_ENVIRONMENT || ""
)
  .trim()
  .toLowerCase();
const expectedBranchId = String(
  process.env.INOVAS_EXPECTED_BRANCH_ID || ""
).trim();
const expectedEndpoint = String(
  process.env.INOVAS_EXPECTED_NEON_ENDPOINT || ""
)
  .trim()
  .toLowerCase();
const runtimeRole = String(process.env.INOVAS_RUNTIME_DB_ROLE || "").trim();
const runtimePassword = String(
  process.env.INOVAS_RUNTIME_DB_PASSWORD || ""
).trim();
const confirmation = String(
  process.env.INOVAS_RUNTIME_ROLE_CONFIRM || ""
).trim();
const legacyRuntimeRole = String(
  process.env.INOVAS_LEGACY_RUNTIME_DB_ROLE || ""
).trim();
const finalizeLegacyRole =
  String(process.env.INOVAS_FINALIZE_LEGACY_RUNTIME_ROLE || "") === "true";
const requireAllTables =
  String(process.env.INOVAS_REQUIRE_ALL_RUNTIME_TABLES || "") === "true";

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const quoteIdentifier = (value) => `"${String(value).replace(/"/g, '""')}"`;
const quoteLiteral = (value) => `'${String(value).replace(/'/g, "''")}'`;

assert(
  ["preview", "production"].includes(targetEnvironment),
  "Target environment must be preview or production."
);
assert(migrationDatabaseUrl, "MIGRATION_DATABASE_URL is required.");
assert(expectedBranchId, "Expected Neon branch is required.");
assert(expectedEndpoint, "Expected Neon endpoint is required.");
assert(
  /^[a-z_][a-z0-9_]{2,62}$/.test(runtimeRole),
  "Runtime role name is invalid."
);
assert(
  confirmation === `${targetEnvironment}:${expectedBranchId}:${runtimeRole}`,
  "Runtime-role confirmation was rejected."
);
if (legacyRuntimeRole) {
  assert(
    /^[a-z_][a-z0-9_]{2,62}$/.test(legacyRuntimeRole) &&
      legacyRuntimeRole !== runtimeRole,
    "Legacy runtime role is invalid."
  );
}

const parsedUrl = new URL(migrationDatabaseUrl);
assert(
  parsedUrl.hostname.toLowerCase().startsWith(expectedEndpoint),
  "Migration endpoint does not match the confirmed endpoint."
);

const pool = new Pool({ connectionString: migrationDatabaseUrl });
pool.on("error", () => {});
const client = await pool.connect();

try {
  const [identity, ownerRole] = await Promise.all([
    client.query(`
      SELECT
        current_database() AS database_name,
        current_user AS database_user,
        current_setting('neon.branch_id', true) AS branch_id
    `),
    client.query(`
      SELECT rolsuper, rolcreaterole, rolbypassrls
      FROM pg_roles
      WHERE rolname = current_user
    `),
  ]);
  const databaseIdentity = identity.rows[0];
  const administrator = ownerRole.rows[0];
  assert(
    databaseIdentity?.branch_id === expectedBranchId,
    "Connected database is not the confirmed Neon branch."
  );
  assert(
    administrator?.rolcreaterole === true &&
      administrator?.rolbypassrls === true,
    "Migration connection is not an administrative connection."
  );

  const existingTables = new Set(
    (
      await client.query(`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
      `)
    ).rows.map(({ tablename }) => tablename)
  );
  const missingTables = runtimeReferencedTables.filter(
    (tableName) => !existingTables.has(tableName)
  );
  assert(
    !requireAllTables || missingTables.length === 0,
    `Runtime relations are missing: ${missingTables.join(", ")}`
  );

  await client.query("BEGIN");
  const roleResult = await client.query(
    `
      SELECT
        rolsuper,
        rolcreatedb,
        rolcreaterole,
        rolreplication,
        rolbypassrls
      FROM pg_roles
      WHERE rolname = $1
    `,
    [runtimeRole]
  );
  if (!roleResult.rowCount) {
    assert(
      runtimePassword.length >= 48,
      "A new runtime role requires a password with 48+ characters."
    );
    await client.query(`
      CREATE ROLE ${quoteIdentifier(runtimeRole)}
      WITH
        LOGIN
        NOSUPERUSER
        NOCREATEDB
        NOCREATEROLE
        NOINHERIT
        NOREPLICATION
        NOBYPASSRLS
        CONNECTION LIMIT 50
        PASSWORD ${quoteLiteral(runtimePassword)}
    `);
  } else {
    const existingRole = roleResult.rows[0];
    assert(
      !existingRole.rolsuper &&
        !existingRole.rolcreatedb &&
        !existingRole.rolcreaterole &&
        !existingRole.rolreplication &&
        !existingRole.rolbypassrls,
      "Existing runtime role has prohibited attributes."
    );
    if (runtimePassword) {
      assert(
        runtimePassword.length >= 48,
        "Runtime password must have 48+ characters when rotation is requested."
      );
    }
    await client.query(`
      ALTER ROLE ${quoteIdentifier(runtimeRole)}
      WITH
        LOGIN
        NOINHERIT
        CONNECTION LIMIT 50
        ${runtimePassword ? `PASSWORD ${quoteLiteral(runtimePassword)}` : ""}
    `);
  }
  await client.query(
    `ALTER ROLE ${quoteIdentifier(
      runtimeRole
    )} SET search_path = pg_catalog, public`
  );

  if (legacyRuntimeRole && finalizeLegacyRole) {
    const ownedTables = await client.query(
      `
        SELECT table_record.relname AS table_name
        FROM pg_class AS table_record
        INNER JOIN pg_namespace AS namespace_record
          ON namespace_record.oid = table_record.relnamespace
        INNER JOIN pg_roles AS owner_role
          ON owner_role.oid = table_record.relowner
        WHERE namespace_record.nspname = 'public'
          AND table_record.relkind IN ('r', 'p', 'S')
          AND owner_role.rolname = $1
        ORDER BY table_record.relname
      `,
      [legacyRuntimeRole]
    );
    for (const { table_name: objectName } of ownedTables.rows) {
      const objectType = existingTables.has(objectName) ? "TABLE" : "SEQUENCE";
      await client.query(
        `ALTER ${objectType} public.${quoteIdentifier(
          objectName
        )} OWNER TO ${quoteIdentifier(databaseIdentity.database_user)}`
      );
    }
  }

  await client.query(
    `REVOKE ALL PRIVILEGES ON DATABASE ${quoteIdentifier(
      databaseIdentity.database_name
    )} FROM ${quoteIdentifier(runtimeRole)}`
  );
  await client.query(
    `REVOKE TEMPORARY ON DATABASE ${quoteIdentifier(
      databaseIdentity.database_name
    )} FROM PUBLIC`
  );
  await client.query(
    `GRANT CONNECT ON DATABASE ${quoteIdentifier(
      databaseIdentity.database_name
    )} TO ${quoteIdentifier(runtimeRole)}`
  );
  await client.query(
    `REVOKE ALL PRIVILEGES ON SCHEMA public FROM ${quoteIdentifier(runtimeRole)}`
  );
  await client.query(
    `GRANT USAGE ON SCHEMA public TO ${quoteIdentifier(runtimeRole)}`
  );
  await client.query(
    `REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ${quoteIdentifier(
      runtimeRole
    )}`
  );
  await client.query(
    `REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ${quoteIdentifier(
      runtimeRole
    )}`
  );
  await client.query(
    `REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM ${quoteIdentifier(
      runtimeRole
    )}`
  );

  for (const [tableName, privileges] of Object.entries(
    runtimeTablePrivileges
  )) {
    if (!existingTables.has(tableName)) {
      continue;
    }
    await client.query(
      `GRANT ${privileges.join(", ")} ON TABLE public.${quoteIdentifier(
        tableName
      )} TO ${quoteIdentifier(runtimeRole)}`
    );
  }
  for (const [sequenceName, privileges] of Object.entries(
    runtimeSequencePrivileges
  )) {
    await client.query(
      `GRANT ${privileges.join(", ")} ON SEQUENCE public.${quoteIdentifier(
        sequenceName
      )} TO ${quoteIdentifier(runtimeRole)}`
    );
  }
  for (const [functionSignature, privileges] of Object.entries(
    runtimeFunctionPrivileges
  )) {
    await client.query(
      `GRANT ${privileges.join(", ")} ON FUNCTION ${
        functionSignature
      } TO ${quoteIdentifier(runtimeRole)}`
    );
  }

  if (legacyRuntimeRole && finalizeLegacyRole) {
    await client.query(
      `REVOKE ${quoteIdentifier(legacyRuntimeRole)} FROM ${quoteIdentifier(
        databaseIdentity.database_user
      )}`
    );
    await client.query(
      `REVOKE ALL PRIVILEGES ON DATABASE ${quoteIdentifier(
        databaseIdentity.database_name
      )} FROM ${quoteIdentifier(legacyRuntimeRole)}`
    );
    await client.query(
      `REVOKE ALL PRIVILEGES ON SCHEMA public FROM ${quoteIdentifier(
        legacyRuntimeRole
      )}`
    );
    await client.query(
      `REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ${quoteIdentifier(
        legacyRuntimeRole
      )}`
    );
    await client.query(
      `REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ${quoteIdentifier(
        legacyRuntimeRole
      )}`
    );
    await client.query(
      `ALTER ROLE ${quoteIdentifier(legacyRuntimeRole)} NOLOGIN`
    );
  }

  await client.query("COMMIT");
  console.log(
    JSON.stringify({
      configured: true,
      targetEnvironment,
      branchId: expectedBranchId,
      runtimeRole,
      connectionLimit: 50,
      grantedTables: runtimeReferencedTables.filter((tableName) =>
        existingTables.has(tableName)
      ).length,
      skippedMissingTables: missingTables.length,
      grantedSequences: Object.keys(runtimeSequencePrivileges).length,
      grantedFunctions: Object.keys(runtimeFunctionPrivileges).length,
      legacyRoleFinalized: Boolean(legacyRuntimeRole && finalizeLegacyRole),
    })
  );
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
