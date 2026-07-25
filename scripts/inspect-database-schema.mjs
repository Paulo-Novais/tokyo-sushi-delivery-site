import { neon } from "@neondatabase/serverless";

const databaseUrl = String(process.env.DATABASE_URL || "").trim();

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = neon(databaseUrl);
const tables = await sql`
  select
    table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_type = 'BASE TABLE'
  order by table_name
`;
const tenantColumns = await sql`
  select
    table_name,
    array_agg(column_name order by ordinal_position) as columns
  from information_schema.columns
  where table_schema = 'public'
    and column_name in ('tenant_id', 'restaurant_id', 'restaurant_key')
  group by table_name
  order by table_name
`;
const adminUserColumns = await sql`
  select column_name
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'admin_users'
  order by ordinal_position
`;

console.log(
  JSON.stringify({
    tables: tables.map(({ table_name: tableName }) => tableName),
    tenantScopedTables: tenantColumns.map(
      ({ table_name: tableName, columns }) => ({
        tableName,
        scopeColumns: columns,
      })
    ),
    adminUserColumns: adminUserColumns.map(
      ({ column_name: columnName }) => columnName
    ),
  })
);
