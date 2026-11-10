import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { Pool } from "@neondatabase/serverless";

const require = createRequire(import.meta.url);
const { createPasswordHash } = require("../lib/user-permissions.cjs");

const migrationDatabaseUrl = String(
  process.env.MIGRATION_DATABASE_URL || ""
).trim();
const previewUrl = String(process.env.INOVAS_PREVIEW_URL || "")
  .trim()
  .replace(/\/+$/, "");
const expectedBranchId = String(
  process.env.INOVAS_EXPECTED_BRANCH_ID || ""
).trim();
const confirmation = String(
  process.env.INOVAS_PREVIEW_E2E_CONFIRM || ""
).trim();

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(migrationDatabaseUrl && previewUrl && expectedBranchId, "Preview E2E guard is incomplete.");
assert(confirmation === `${expectedBranchId}:${previewUrl}`, "Preview E2E was not confirmed.");
assert(new URL(previewUrl).hostname.endsWith(".vercel.app"), "Preview URL is invalid.");

const pool = new Pool({ connectionString: migrationDatabaseUrl });
const login = `preview-system-e2e-${crypto.randomUUID()}@inovas.invalid`;
const password = `Sys${crypto.randomBytes(32).toString("base64url")}A1!`;
const identityId = `identity_${crypto
  .createHash("sha256")
  .update(login.toLowerCase())
  .digest("hex")
  .slice(0, 24)}`;

const retire = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE auth_sessions SET status='REVOKED', revoked_at=COALESCE(revoked_at,NOW()), revoked_by='preview_e2e_cleanup' WHERE identity_id=$1`,
      [identityId]
    );
    await client.query(
      `UPDATE system_principals SET status='BLOCKED', updated_at=NOW() WHERE identity_id=$1`,
      [identityId]
    );
    await client.query(
      `UPDATE identities SET credential_status='DISABLED', updated_at=NOW() WHERE id=$1`,
      [identityId]
    );
    await client.query("DELETE FROM admin_users WHERE LOWER(login)=LOWER($1)", [login]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

let playwrightValidated = false;
try {
  const identity = (
    await pool.query(`SELECT current_setting('neon.branch_id',true) branch_id`)
  ).rows[0];
  assert(identity?.branch_id === expectedBranchId, "E2E owner URL uses another branch.");
  await pool.query(
    `
      INSERT INTO admin_users (
        id, tenant_id, restaurant_id, restaurant_key, name, login, email,
        password_hash, status, user_type, credential_mode,
        must_change_password, source, profile_version, created_at, updated_at
      )
      VALUES (
        $1, '', '', '', 'Preview System E2E', $2, $2, $3, 'ACTIVE',
        'VENDEDOR', 'TEMPORARY_PASSWORD', TRUE, 'managed',
        '2026.07.31', NOW(), NOW()
      )
    `,
    [`preview_system_e2e_${crypto.randomUUID()}`, login, createPasswordHash(password)]
  );

  const child = spawn(
    process.execPath,
    [
      require.resolve("@playwright/test/cli"),
      "test",
      "tests/e2e/cash-register.spec.js",
      "--project=chromium",
      "--workers=1",
      "--timeout=120000",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        BASE_URL: previewUrl,
        VALIDATION_BASE_URL: previewUrl,
        E2E_ADMIN_LOGIN: login,
        E2E_ADMIN_PASSWORD: password,
      },
      stdio: "inherit",
      windowsHide: true,
    }
  );
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  assert(exitCode === 0, `Preview Playwright exited with code ${exitCode}.`);
  playwrightValidated = true;
} finally {
  await retire();
  await pool.end();
}

console.log(
  JSON.stringify({
    validated: playwrightValidated,
    playwrightTestsPassed: playwrightValidated ? 1 : 0,
    playwrightTestsFailed: playwrightValidated ? 0 : 1,
    technicalSystemUserRetired: true,
  })
);
