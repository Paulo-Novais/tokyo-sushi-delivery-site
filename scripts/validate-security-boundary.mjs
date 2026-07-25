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
  console.error("Preview security-boundary guard rejected the request.");
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
  const role = roleResult.rows[0] || null;
  const ownershipResult = await client.query(
    `
      SELECT
        count(*)::integer AS total_tables,
        count(*) FILTER (WHERE tableowner = $1)::integer AS runtime_owned_tables
      FROM pg_tables
      WHERE schemaname = 'public'
    `,
    [runtimeRole]
  );
  const membershipsResult = await client.query(
    `
      SELECT
        member_role.rolname AS member,
        granted_role.rolname AS granted_role,
        membership.admin_option
      FROM pg_auth_members AS membership
      JOIN pg_roles AS member_role ON member_role.oid = membership.member
      JOIN pg_roles AS granted_role ON granted_role.oid = membership.roleid
      WHERE member_role.rolname IN ($1, current_user)
         OR granted_role.rolname = $1
      ORDER BY member_role.rolname, granted_role.rolname
    `,
    [runtimeRole]
  );
  const rlsResult = await client.query(`
    SELECT
      count(*) FILTER (WHERE relrowsecurity)::integer AS rls_enabled,
      count(*) FILTER (WHERE relforcerowsecurity)::integer AS rls_forced
    FROM pg_class
    JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
    WHERE pg_namespace.nspname = 'public'
      AND pg_class.relkind = 'r'
  `);
  const policiesResult = await client.query(`
    SELECT count(*)::integer AS policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
  `);
  const migrationsTableResult = await client.query(
    `SELECT to_regclass('public.schema_migrations') AS relation`
  );
  const migrationsResult = migrationsTableResult.rows[0]?.relation
    ? await client.query(`
        SELECT name
        FROM schema_migrations
        WHERE name IN (
          '015_system_restaurant_security_boundary.sql',
          '016_public_routing_and_provisioning_boundary.sql'
        )
        ORDER BY name
      `)
    : { rows: [] };

  console.log(
    JSON.stringify({
      validated: true,
      branchId,
      runtimeRole: {
        exists: Boolean(role),
        canLogin: role?.rolcanlogin === true,
        isSuperuser: role?.rolsuper === true,
        bypassesRls: role?.rolbypassrls === true,
      },
      ownership: ownershipResult.rows[0] || {},
      memberships: membershipsResult.rows,
      rls: rlsResult.rows[0] || {},
      policyCount: policiesResult.rows[0]?.policy_count || 0,
      migrationsTablePresent: Boolean(
        migrationsTableResult.rows[0]?.relation
      ),
      migrations: migrationsResult.rows.map(({ name }) => name),
    })
  );
} finally {
  client.release();
  await pool.end();
}
