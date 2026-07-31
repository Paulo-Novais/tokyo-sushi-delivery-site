import fs from "node:fs";
import path from "node:path";
import { Pool } from "@neondatabase/serverless";

const [migrationPathArgument] = process.argv.slice(2);
const migrationPath = path.resolve(
  process.cwd(),
  migrationPathArgument || "migrations/015_system_restaurant_security_boundary.sql"
);
const databaseUrl = String(
  process.env.MIGRATION_DATABASE_URL || ""
).trim();
const expectedBranchId = String(process.env.NEON_BRANCH_ID || "").trim();
const confirmation = String(
  process.env.INOVAS_PREVIEW_MIGRATION_CONFIRM || ""
).trim();
const environment = String(process.env.INOVAS_ENVIRONMENT || "")
  .trim()
  .toLowerCase();

if (!databaseUrl || !expectedBranchId) {
  console.error("MIGRATION_DATABASE_URL and NEON_BRANCH_ID are required.");
  process.exit(1);
}

if (environment !== "preview" || confirmation !== expectedBranchId) {
  console.error(
    "Preview migration guard rejected the request. Set INOVAS_ENVIRONMENT=preview and confirm the exact NEON_BRANCH_ID."
  );
  process.exit(1);
}

const parsedUrl = new URL(databaseUrl);
const expectedEndpoint = String(
  process.env.INOVAS_PREVIEW_NEON_ENDPOINT || ""
)
  .trim()
  .toLowerCase();

if (
  !expectedEndpoint ||
  !parsedUrl.hostname.toLowerCase().startsWith(expectedEndpoint)
) {
  console.error("Database endpoint does not match the confirmed Preview endpoint.");
  process.exit(1);
}

const migrationSql = fs.readFileSync(migrationPath, "utf8");

if (
  !migrationSql.includes("INOVAS Food") ||
  !migrationSql.includes("SYSTEM") ||
  !migrationSql.includes("RESTAURANT security boundary")
) {
  console.error("Migration signature is missing.");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query(migrationSql);
  console.log(
    JSON.stringify({
      applied: true,
      migration: path.basename(migrationPath),
      branchId: expectedBranchId,
      endpoint: expectedEndpoint,
    })
  );
} finally {
  await pool.end();
}
