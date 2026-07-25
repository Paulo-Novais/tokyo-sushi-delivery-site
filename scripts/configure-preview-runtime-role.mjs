import { Pool } from "@neondatabase/serverless";

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const branchId = String(process.env.NEON_BRANCH_ID || "").trim();
const confirmation = String(
  process.env.INOVAS_PREVIEW_MIGRATION_CONFIRM || ""
).trim();
const environment = String(process.env.INOVAS_ENVIRONMENT || "")
  .trim()
  .toLowerCase();
const runtimeRole = String(process.env.INOVAS_RUNTIME_DB_ROLE || "").trim();
const runtimePassword = String(
  process.env.INOVAS_RUNTIME_DB_PASSWORD || ""
).trim();
const expectedEndpoint = String(
  process.env.INOVAS_PREVIEW_NEON_ENDPOINT || ""
)
  .trim()
  .toLowerCase();

if (
  !databaseUrl ||
  !branchId ||
  environment !== "preview" ||
  confirmation !== branchId ||
  !/^[a-z_][a-z0-9_]{2,62}$/.test(runtimeRole)
) {
  console.error("Preview runtime-role guard rejected the request.");
  process.exit(1);
}

const parsedUrl = new URL(databaseUrl);

if (
  !expectedEndpoint ||
  !parsedUrl.hostname.toLowerCase().startsWith(expectedEndpoint)
) {
  console.error("Database endpoint does not match the confirmed Preview endpoint.");
  process.exit(1);
}

const quoteIdentifier = (value) => `"${String(value).replace(/"/g, '""')}"`;
const quoteLiteral = (value) => `'${String(value).replace(/'/g, "''")}'`;
const pool = new Pool({ connectionString: databaseUrl });
const client = await pool.connect();

try {
  const roleResult = await client.query(
    `
      SELECT
        rolname,
        rolsuper,
        rolbypassrls,
        rolcanlogin
      FROM pg_roles
      WHERE rolname = $1
    `,
    [runtimeRole]
  );
  let role = roleResult.rows[0] || null;

  if (!role) {
    if (runtimePassword.length < 32) {
      throw new Error(
        "INOVAS_RUNTIME_DB_PASSWORD must contain at least 32 characters."
      );
    }
    await client.query(`
      CREATE ROLE ${quoteIdentifier(runtimeRole)}
      WITH
        LOGIN
        PASSWORD ${quoteLiteral(runtimePassword)}
        NOSUPERUSER
        NOCREATEDB
        NOCREATEROLE
        NOINHERIT
        NOREPLICATION
        NOBYPASSRLS
    `);
    const createdRoleResult = await client.query(
      `
        SELECT
          rolname,
          rolsuper,
          rolbypassrls,
          rolcanlogin
        FROM pg_roles
        WHERE rolname = $1
      `,
      [runtimeRole]
    );
    role = createdRoleResult.rows[0] || null;
  } else if (runtimePassword.length >= 32) {
    await client.query(
      `ALTER ROLE ${quoteIdentifier(runtimeRole)} PASSWORD ${quoteLiteral(
        runtimePassword
      )}`
    );
  }

  if (!role || role.rolsuper || role.rolbypassrls || !role.rolcanlogin) {
    throw new Error(
      `Runtime role rejected: exists=${Boolean(role)}, login=${Boolean(
        role?.rolcanlogin
      )}, superuser=${Boolean(role?.rolsuper)}, bypassesRls=${Boolean(
        role?.rolbypassrls
      )}.`
    );
  }

  await client.query("BEGIN");
  const databaseName = parsedUrl.pathname.replace(/^\/+/, "");
  const ownerRole = await client.query(`SELECT current_user AS role`);
  const ownerRoleName = ownerRole.rows[0]?.role;
  await client.query(
    `GRANT ${quoteIdentifier(runtimeRole)} TO ${quoteIdentifier(ownerRoleName)}`
  );
  await client.query(
    `GRANT CONNECT ON DATABASE ${quoteIdentifier(databaseName)} TO ${quoteIdentifier(
      runtimeRole
    )}`
  );
  await client.query(
    `GRANT USAGE, CREATE ON SCHEMA public TO ${quoteIdentifier(runtimeRole)}`
  );
  const tablesResult = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  for (const { tablename } of tablesResult.rows) {
    await client.query(
      `ALTER TABLE public.${quoteIdentifier(tablename)} OWNER TO ${quoteIdentifier(
        runtimeRole
      )}`
    );
  }

  const sequencesResult = await client.query(`
    SELECT sequencename
    FROM pg_sequences
    WHERE schemaname = 'public'
    ORDER BY sequencename
  `);

  for (const { sequencename } of sequencesResult.rows) {
    await client.query(
      `ALTER SEQUENCE public.${quoteIdentifier(
        sequencename
      )} OWNER TO ${quoteIdentifier(runtimeRole)}`
    );
  }

  await client.query(
    `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${quoteIdentifier(
      runtimeRole
    )}`
  );
  await client.query(
    `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${quoteIdentifier(
      runtimeRole
    )}`
  );
  await client.query("COMMIT");

  console.log(
    JSON.stringify({
      configured: true,
      branchId,
      runtimeRole,
      tableOwnershipTransferred: tablesResult.rows.length,
      sequenceOwnershipTransferred: sequencesResult.rows.length,
      bypassesRls: false,
    })
  );
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
