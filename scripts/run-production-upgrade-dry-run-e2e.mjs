import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { Pool } from "@neondatabase/serverless";

const require = createRequire(import.meta.url);
const { createPasswordHash } = require("../lib/user-permissions.cjs");

const ownerDatabaseUrl = String(process.env.OWNER_DATABASE_URL || "").trim();
const previewUrl = String(process.env.INOVAS_PREVIEW_URL || "")
  .trim()
  .replace(/\/+$/, "");
const expectedBranchId = String(
  process.env.INOVAS_EXPECTED_BRANCH_ID || ""
).trim();
const productionBranchId = String(
  process.env.INOVAS_PRODUCTION_BRANCH_ID || ""
).trim();
const expectedEndpoint = String(
  process.env.INOVAS_EXPECTED_NEON_ENDPOINT || ""
)
  .trim()
  .toLowerCase();
const confirmation = String(process.env.INOVAS_DRY_RUN_E2E_CONFIRM || "").trim();
const expectedLegacyRows = Number(
  process.env.INOVAS_EXPECTED_LEGACY_ROWS || 303
);
const reportPath = path.resolve(
  process.cwd(),
  process.env.INOVAS_PLAYWRIGHT_JSON_REPORT ||
    "_tmp_dry_run_playwright_results.json"
);
const requestedTestFiles = String(
  process.env.INOVAS_PLAYWRIGHT_TEST_FILES || ""
)
  .split(",")
  .map((value) => value.trim().replaceAll("\\", "/"))
  .filter(Boolean);
const allowedTestFiles = new Set([
  "tests/e2e/cash-register.spec.js",
  "tests/e2e/public-restaurant-routing.spec.js",
  "tests/e2e/system-tenant-boundary.spec.js",
  "tests/e2e/user-creation.spec.js",
  "tests/e2e/v1.8-smoke.spec.js",
  "tests/e2e/v1.9-auth-security.spec.js",
  "tests/e2e/v1.9-rbac-tenant.spec.js",
  "tests/e2e/v1.9-responsive.spec.js",
  "tests/validate-stage-3-ui.spec.js",
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

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const quoteIdentifier = (value) =>
  `"${String(value).replaceAll('"', '""')}"`;

const connectionEndpoint = ownerDatabaseUrl
  ? new URL(ownerDatabaseUrl).hostname.toLowerCase()
  : "";
const previewHost = previewUrl ? new URL(previewUrl).hostname.toLowerCase() : "";

assert(ownerDatabaseUrl, "OWNER_DATABASE_URL is required.");
assert(previewUrl, "INOVAS_PREVIEW_URL is required.");
assert(expectedBranchId, "INOVAS_EXPECTED_BRANCH_ID is required.");
assert(productionBranchId, "INOVAS_PRODUCTION_BRANCH_ID is required.");
assert(
  expectedBranchId !== productionBranchId,
  "The dry-run branch must differ from Production."
);
assert(expectedEndpoint, "INOVAS_EXPECTED_NEON_ENDPOINT is required.");
assert(
  connectionEndpoint.startsWith(expectedEndpoint),
  "The owner connection does not use the expected clone endpoint."
);
assert(previewHost.endsWith(".vercel.app"), "The target must be a Vercel Preview URL.");
assert(
  confirmation === `${expectedBranchId}:${previewUrl}`,
  "The full Preview E2E confirmation is invalid."
);
assert(
  Number.isSafeInteger(expectedLegacyRows) && expectedLegacyRows >= 303,
  "INOVAS_EXPECTED_LEGACY_ROWS must be an integer of at least 303."
);
assert(
  requestedTestFiles.every((fileName) => allowedTestFiles.has(fileName)),
  "INOVAS_PLAYWRIGHT_TEST_FILES contains a non-allowlisted test file."
);

const pool = new Pool({ connectionString: ownerDatabaseUrl });
const password = `Dry${crypto.randomBytes(36).toString("base64url")}A1!`;
let login = "";
let technicalUserId = "";
let identityId = "";
let originalMasterRow = null;
let adminUserColumns = [];

const snapshotLegacyRows = async (client) => {
  const snapshot = new Map();
  let total = 0;
  for (const tableName of legacyTables) {
    const rows = (
      await client.query(
        `SELECT to_jsonb(record) AS row_data FROM public.${quoteIdentifier(
          tableName
        )} AS record`
      )
    ).rows.map(({ row_data: rowData }) => JSON.stringify(rowData));
    snapshot.set(tableName, rows);
    total += rows.length;
  }
  return { snapshot, total };
};

const compareLegacySnapshots = (before, after) => {
  const changedTables = [];
  let preservedRows = 0;
  for (const tableName of legacyTables) {
    const remaining = new Map();
    for (const row of after.snapshot.get(tableName) || []) {
      remaining.set(row, (remaining.get(row) || 0) + 1);
    }
    const missing = [];
    for (const row of before.snapshot.get(tableName) || []) {
      const count = remaining.get(row) || 0;
      if (!count) {
        missing.push(row);
        continue;
      }
      preservedRows += 1;
      remaining.set(row, count - 1);
    }
    if (missing.length) {
      changedTables.push({ table: tableName, missingOrChangedRows: missing.length });
    }
  }
  return {
    expectedRows: before.total,
    preservedRows,
    changedTables,
    preserved: preservedRows === before.total,
  };
};

const readPlaywrightCounts = async () => {
  const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
  const counts = { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0 };
  const visit = (suite) => {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        counts.total += 1;
        const results = test.results || [];
        const finalStatus = results.at(-1)?.status || "skipped";
        const hadFailure = results
          .slice(0, -1)
          .some((result) => !["passed", "skipped"].includes(result.status));
        if (finalStatus === "passed") {
          counts.passed += 1;
          if (hadFailure) counts.flaky += 1;
        } else if (finalStatus === "skipped") {
          counts.skipped += 1;
        } else {
          counts.failed += 1;
        }
      }
    }
    for (const child of suite.suites || []) visit(child);
  };
  for (const suite of report.suites || []) visit(suite);
  return counts;
};

const restoreTechnicalMaster = async () => {
  if (!originalMasterRow || !technicalUserId || !identityId) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
        UPDATE auth_sessions
        SET status = 'REVOKED',
            revoked_at = COALESCE(revoked_at, NOW()),
            revoked_by = 'production_upgrade_dry_run_cleanup'
        WHERE identity_id = $1
      `,
      [identityId]
    );
    const assignments = adminUserColumns
      .filter((columnName) => columnName !== "id")
      .map(
        (columnName) =>
          `${quoteIdentifier(columnName)} = restored.${quoteIdentifier(columnName)}`
      )
      .join(", ");
    await client.query(
      `
        UPDATE admin_users AS current_record
        SET ${assignments}
        FROM jsonb_populate_record(NULL::admin_users, $1::jsonb) AS restored
        WHERE current_record.id = $2
      `,
      [JSON.stringify(originalMasterRow), technicalUserId]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

const restoreMutableLegacyBaseline = async () => {
  const rows = (baseline?.snapshot.get("master_platform_state") || []).map(
    (row) => JSON.parse(row)
  );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM master_platform_state");
    if (rows.length) {
      await client.query(
        `
          INSERT INTO master_platform_state
          SELECT *
          FROM jsonb_populate_recordset(
            NULL::master_platform_state,
            $1::jsonb
          )
        `,
        [JSON.stringify(rows)]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

let playwrightExitCode = null;
let playwrightCounts = null;
let legacyPreservation = null;
let baseline = null;

try {
  const client = await pool.connect();
  try {
    const identity = (
      await client.query(
        `SELECT current_setting('neon.branch_id', true) AS branch_id`
      )
    ).rows[0];
    assert(
      identity?.branch_id === expectedBranchId,
      "The E2E owner connection reached an unexpected branch."
    );
    assert(
      identity?.branch_id !== productionBranchId,
      "The E2E owner connection reached Production."
    );
    baseline = await snapshotLegacyRows(client);
    assert(
      baseline.total === expectedLegacyRows,
      `Expected ${expectedLegacyRows} legacy rows before E2E, found ${baseline.total}.`
    );
    const masters = await client.query(`
      SELECT to_jsonb(user_record) AS row_data
      FROM admin_users AS user_record
      WHERE user_type = 'MASTER'
        AND restaurant_key = ''
        AND status = 'ACTIVE'
      ORDER BY created_at, id
    `);
    assert(
      masters.rowCount === 1,
      `Expected exactly one active System MASTER, found ${masters.rowCount}.`
    );
    originalMasterRow = masters.rows[0].row_data;
    technicalUserId = originalMasterRow.id;
    login = originalMasterRow.login;
    identityId = `identity_${crypto
      .createHash("sha256")
      .update(login.toLowerCase())
      .digest("hex")
      .slice(0, 24)}`;
    adminUserColumns = (
      await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'admin_users'
        ORDER BY ordinal_position
      `)
    ).rows.map((row) => row.column_name);
    await client.query(
      `
        UPDATE admin_users
        SET password_hash = $1,
            status = 'ACTIVE',
            credential_mode = 'TEMPORARY_PASSWORD',
            must_change_password = FALSE,
            updated_at = NOW()
        WHERE id = $2
      `,
      [createPasswordHash(password), technicalUserId]
    );
  } finally {
    client.release();
  }

  await fs.rm(reportPath, { force: true });
  const child = spawn(
    process.execPath,
    [
      require.resolve("@playwright/test/cli"),
      "test",
      ...requestedTestFiles,
      "--project=chromium",
      "--workers=1",
      "--timeout=120000",
      "--reporter=list,json",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        BASE_URL: previewUrl,
        VALIDATION_BASE_URL: previewUrl,
        E2E_ADMIN_LOGIN: login,
        E2E_ADMIN_PASSWORD: password,
        PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath,
      },
      stdio: "inherit",
      windowsHide: true,
    }
  );
  playwrightExitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  playwrightCounts = await readPlaywrightCounts();
} finally {
  await restoreTechnicalMaster();
  await restoreMutableLegacyBaseline();
  const client = await pool.connect();
  try {
    const after = await snapshotLegacyRows(client);
    legacyPreservation = compareLegacySnapshots(baseline, after);
  } finally {
    client.release();
    await pool.end();
  }
}

const result = {
  validated:
    playwrightExitCode === 0 &&
    playwrightCounts?.failed === 0 &&
    legacyPreservation?.preserved === true,
  playwrightExitCode,
  playwright: playwrightCounts,
  legacyPreservation,
  technicalMasterRestored: true,
  mutableLegacyBaselineRestored: true,
  previewHost,
  branchId: expectedBranchId,
};

console.log(JSON.stringify(result, null, 2));
if (!result.validated) process.exitCode = 1;
