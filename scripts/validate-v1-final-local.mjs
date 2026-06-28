import { runV1Final } from "./v1-validation-suite.mjs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const legacyValidationScripts = [
  ["validate:v1-release-local", "scripts/validate-v1-release-local.mjs"],
  ["validate:tenant-context-local", "scripts/validate-tenant-context-local.mjs"],
  ["validate:tenant-isolation-local", "scripts/validate-tenant-isolation-local.mjs"],
  ["validate:tenant-persistence-local", "scripts/validate-tenant-persistence-local.mjs"],
  ["validate:security-guardian-local", "scripts/validate-security-guardian-local.mjs"],
  ["validate:permissions-local", "scripts/validate-permissions-local.mjs"],
  ["validate:plans-contracts-local", "scripts/validate-plans-contracts-local.mjs"],
  ["validate:platform-integration-local", "scripts/validate-platform-integration-local.mjs"],
  ["validate:admin-local", "scripts/validate-admin-local.mjs"],
  ["validate:site-layouts-local", "scripts/validate-site-layouts-local.mjs"],
  ["validate:mobile-public-local", "scripts/validate-mobile-public-local.mjs"],
  ["validate:business-hours", "scripts/validate-business-hours.mjs"],
];

const runNodeValidationScript = ([label, scriptPath]) => {
  console.log(`\n[v1-final] ${label}`);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: workspaceRoot,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${label} falhou com exit code ${result.status}`);
  }
};

runV1Final()
  .then(() => {
    legacyValidationScripts.forEach(runNodeValidationScript);
  })
  .then(() => {
    console.log("validate:v1-final-local OK");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
