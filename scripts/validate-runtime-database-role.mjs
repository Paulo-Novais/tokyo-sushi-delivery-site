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
  console.error(`RUNTIME_ROLE_VALIDATION_FAILED;message=${sanitizeError(error)}`);
  process.exit(1);
});
process.on("unhandledRejection", (error) => {
  console.error(`RUNTIME_ROLE_VALIDATION_FAILED;message=${sanitizeError(error)}`);
  process.exit(1);
});

const migrationDatabaseUrl = String(
  process.env.MIGRATION_DATABASE_URL || ""
).trim();
const runtimeDatabaseUrl = String(process.env.DATABASE_URL || "").trim();
const expectedBranchId = String(
  process.env.INOVAS_EXPECTED_BRANCH_ID || ""
).trim();
const runtimeRole = String(process.env.INOVAS_RUNTIME_DB_ROLE || "").trim();
const expectedEndpoint = String(
  process.env.INOVAS_EXPECTED_NEON_ENDPOINT || ""
)
  .trim()
  .toLowerCase();

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

assert(migrationDatabaseUrl && runtimeDatabaseUrl, "Both database URLs are required.");
assert(expectedBranchId && runtimeRole && expectedEndpoint, "Role validation guard is incomplete.");
for (const connectionString of [migrationDatabaseUrl, runtimeDatabaseUrl]) {
  const parsed = new URL(connectionString);
  assert(
    parsed.hostname.toLowerCase().startsWith(expectedEndpoint),
    "Database endpoint does not match the confirmed endpoint."
  );
}

const ownerPool = new Pool({ connectionString: migrationDatabaseUrl });
const runtimePool = new Pool({ connectionString: runtimeDatabaseUrl });
ownerPool.on("error", () => {});
runtimePool.on("error", () => {});

const expectDenied = async (query) => {
  try {
    await query();
    return false;
  } catch (error) {
    return ["42501", "25006"].includes(error?.code) ||
      /permission denied|not allowed|read-only/i.test(String(error?.message || ""));
  }
};

try {
  const runtimeIdentity = (
    await runtimePool.query(`
      SELECT
        current_user AS database_user,
        current_setting('neon.branch_id', true) AS branch_id
    `)
  ).rows[0];
  assert(runtimeIdentity?.database_user === runtimeRole, "Runtime URL uses another role.");
  assert(runtimeIdentity?.branch_id === expectedBranchId, "Runtime URL uses another branch.");

  const role = (
    await ownerPool.query(
      `
        SELECT
          rolcanlogin,
          rolsuper,
          rolinherit,
          rolcreaterole,
          rolcreatedb,
          rolreplication,
          rolbypassrls,
          rolconnlimit
        FROM pg_roles
        WHERE rolname = $1
      `,
      [runtimeRole]
    )
  ).rows[0];
  assert(role?.rolcanlogin, "Runtime role cannot login.");
  assert(!role.rolsuper, "Runtime role is superuser.");
  assert(!role.rolinherit, "Runtime role unexpectedly inherits memberships.");
  assert(!role.rolcreaterole, "Runtime role can create roles.");
  assert(!role.rolcreatedb, "Runtime role can create databases.");
  assert(!role.rolreplication, "Runtime role can replicate.");
  assert(!role.rolbypassrls, "Runtime role bypasses RLS.");
  assert(role.rolconnlimit === 50, "Runtime role connection limit is unexpected.");

  const memberships = await ownerPool.query(
    `
      SELECT granted_role.rolname AS granted_role
      FROM pg_auth_members AS membership
      INNER JOIN pg_roles AS member_role ON member_role.oid = membership.member
      INNER JOIN pg_roles AS granted_role ON granted_role.oid = membership.roleid
      WHERE member_role.rolname = $1
    `,
    [runtimeRole]
  );
  assert(memberships.rowCount === 0, "Runtime role has role memberships.");

  const ownership = (
    await ownerPool.query(
      `
        SELECT count(*)::integer AS owned_objects
        FROM pg_class AS object_record
        INNER JOIN pg_namespace AS namespace_record
          ON namespace_record.oid = object_record.relnamespace
        INNER JOIN pg_roles AS owner_role ON owner_role.oid = object_record.relowner
        WHERE namespace_record.nspname = 'public'
          AND owner_role.rolname = $1
      `,
      [runtimeRole]
    )
  ).rows[0];
  assert(ownership.owned_objects === 0, "Runtime role owns database objects.");

  const schemaPrivileges = (
    await ownerPool.query(
      `
        SELECT
          has_schema_privilege($1, 'public', 'USAGE') AS usage,
          has_schema_privilege($1, 'public', 'CREATE') AS create_privilege
      `,
      [runtimeRole]
    )
  ).rows[0];
  assert(schemaPrivileges.usage, "Runtime role lacks public schema usage.");
  assert(!schemaPrivileges.create_privilege, "Runtime role can create schema objects.");

  const tableRows = await ownerPool.query(`
    SELECT table_record.relname AS table_name
    FROM pg_class AS table_record
    INNER JOIN pg_namespace AS namespace_record
      ON namespace_record.oid = table_record.relnamespace
    WHERE namespace_record.nspname = 'public'
      AND table_record.relkind IN ('r', 'p')
    ORDER BY table_record.relname
  `);
  const availableTables = new Set(tableRows.rows.map(({ table_name }) => table_name));
  const privilegeNames = [
    "SELECT",
    "INSERT",
    "UPDATE",
    "DELETE",
    "TRUNCATE",
    "REFERENCES",
    "TRIGGER",
  ];
  for (const tableName of availableTables) {
    const expected = new Set(runtimeTablePrivileges[tableName] || []);
    for (const privilege of privilegeNames) {
      const granted = (
        await ownerPool.query(
          "SELECT has_table_privilege($1, $2, $3) AS granted",
          [runtimeRole, `public.${tableName}`, privilege]
        )
      ).rows[0].granted;
      assert(
        granted === expected.has(privilege),
        `Unexpected ${privilege} privilege on ${tableName}.`
      );
    }
  }
  assert(
    runtimeReferencedTables.every((tableName) => availableTables.has(tableName)),
    "One or more runtime tables are missing."
  );

  const sequenceCount = (
    await ownerPool.query(
      `
        SELECT count(*)::integer AS total
        FROM pg_class AS sequence_record
        INNER JOIN pg_namespace AS namespace_record
          ON namespace_record.oid = sequence_record.relnamespace
        WHERE namespace_record.nspname = 'public'
          AND sequence_record.relkind = 'S'
      `
    )
  ).rows[0].total;
  assert(
    sequenceCount === Object.keys(runtimeSequencePrivileges).length,
    "Sequence inventory differs from the audited allowlist."
  );

  const directFunctionGrants = await ownerPool.query(
    `
      SELECT function_record.oid::regprocedure::text AS signature
      FROM pg_proc AS function_record
      INNER JOIN pg_namespace AS namespace_record
        ON namespace_record.oid = function_record.pronamespace
      CROSS JOIN LATERAL aclexplode(
        COALESCE(
          function_record.proacl,
          acldefault('f', function_record.proowner)
        )
      ) AS privilege_record
      INNER JOIN pg_roles AS grantee_role
        ON grantee_role.oid = privilege_record.grantee
      WHERE namespace_record.nspname = 'public'
        AND grantee_role.rolname = $1
        AND privilege_record.privilege_type = 'EXECUTE'
      ORDER BY signature
    `,
    [runtimeRole]
  );
  assert(
    directFunctionGrants.rowCount === Object.keys(runtimeFunctionPrivileges).length,
    "Runtime role has direct grants on unapproved public functions."
  );
  const publicFunctionAudit = (
    await ownerPool.query(
      `
        SELECT
          count(*) FILTER (
            WHERE has_function_privilege($1, function_record.oid, 'EXECUTE')
          )::integer AS executable_via_public,
          count(*) FILTER (
            WHERE function_record.prosecdef
              AND has_function_privilege($1, function_record.oid, 'EXECUTE')
          )::integer AS executable_security_definer
        FROM pg_proc AS function_record
        INNER JOIN pg_namespace AS namespace_record
          ON namespace_record.oid = function_record.pronamespace
        WHERE namespace_record.nspname = 'public'
      `,
      [runtimeRole]
    )
  ).rows[0];
  assert(
    publicFunctionAudit.executable_security_definer === 0,
    "Runtime role can execute a SECURITY DEFINER function."
  );

  const publicTables = await ownerPool.query(`
    SELECT relname
    FROM pg_class
    INNER JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
    WHERE pg_namespace.nspname = 'public'
      AND relkind IN ('r', 'p')
      AND NOT relrowsecurity
    ORDER BY relname
  `);
  assert(publicTables.rowCount === 0, "One or more public tables do not have RLS enabled.");

  const ddlDenied = await expectDenied(() =>
    runtimePool.query("CREATE TABLE public.inovas_runtime_forbidden_test (id integer)")
  );
  const tempDenied = await expectDenied(() =>
    runtimePool.query("CREATE TEMP TABLE inovas_runtime_forbidden_temp (id integer)")
  );
  const setRoleDenied = await expectDenied(() =>
    runtimePool.query("SET ROLE neondb_owner")
  );
  const unauthorizedTableDenied = await expectDenied(() =>
    runtimePool.query("SELECT count(*) FROM permission_definitions")
  );
  const unauthorizedFunctionDenied = await expectDenied(() =>
    runtimePool.query("SELECT pg_read_file('postgresql.conf', 0, 1)")
  );
  assert(ddlDenied, "Runtime role can create persistent tables.");
  assert(tempDenied, "Runtime role can create temporary tables.");
  assert(setRoleDenied, "Runtime role can SET ROLE to the owner.");
  assert(unauthorizedTableDenied, "Runtime role can access an unapproved table.");
  assert(unauthorizedFunctionDenied, "Runtime role can execute an unapproved function.");

  console.log(
    JSON.stringify({
      validated: true,
      branchId: expectedBranchId,
      runtimeRole,
      attributes: {
        login: true,
        superuser: false,
        inherit: false,
        createRole: false,
        createDatabase: false,
        replication: false,
        bypassRls: false,
        connectionLimit: 50,
      },
      memberships: 0,
      ownedObjects: 0,
      schemaUsage: true,
      schemaCreate: false,
      allowedTables: runtimeReferencedTables.length,
      allowedSequences: Object.keys(runtimeSequencePrivileges).length,
      allowedFunctions: Object.keys(runtimeFunctionPrivileges).length,
      publicExtensionFunctions: {
        executableViaPublic: publicFunctionAudit.executable_via_public,
        executableSecurityDefiner: 0,
        directRuntimeGrants: 0,
      },
      forbiddenOperations: {
        persistentDdl: "blocked",
        temporaryDdl: "blocked",
        setOwnerRole: "blocked",
        unapprovedTable: "blocked",
        unapprovedFunction: "blocked",
      },
    })
  );
} finally {
  await Promise.all([ownerPool.end(), runtimePool.end()]);
}
