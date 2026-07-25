import { neon } from "@neondatabase/serverless";

const databaseUrl = String(process.env.DATABASE_URL || "").trim();

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = neon(databaseUrl);

try {
  const [identity] = await sql`
    select
      current_database() as database,
      current_user as role,
      current_setting('server_version_num') as server_version
  `;
  const [roleSecurity] = await sql`
    select
      rolsuper as is_superuser,
      rolbypassrls as bypasses_rls
    from pg_roles
    where rolname = current_user
  `;

  console.log(
    JSON.stringify({
      connected: true,
      database: identity?.database || null,
      role: identity?.role || null,
      serverVersion: identity?.server_version || null,
      roleSecurity: {
        isSuperuser: roleSecurity?.is_superuser === true,
        bypassesRls: roleSecurity?.bypasses_rls === true,
      },
    })
  );
} catch (error) {
  console.error(
    JSON.stringify({
      connected: false,
      error: error instanceof Error ? error.message : "Unknown database error",
    })
  );
  process.exit(1);
}
