import crypto from "node:crypto";
import fs from "node:fs";

const parseEnvFile = (filePath) =>
  Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        const key = line.slice(0, separatorIndex);
        let value = line.slice(separatorIndex + 1).trim();

        if (value.startsWith('"') && value.endsWith('"')) {
          try {
            value = JSON.parse(value);
          } catch {
            value = value.slice(1, -1);
          }
        }

        return [key, value];
      })
  );

const fingerprint = (value) =>
  crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 16);

const getSafeDatabaseIdentity = (environment, env) => {
  let databaseUrl = null;

  try {
    databaseUrl = new URL(env.DATABASE_URL || "");
  } catch {
    databaseUrl = null;
  }

  const hostname = databaseUrl?.hostname || "";
  const database = (databaseUrl?.pathname || "").replace(/^\/+/, "");
  const endpoint = hostname.split(".")[0] || "";

  return {
    environment,
    databaseUrlPresent: Boolean(env.DATABASE_URL),
    databaseUrlLength: String(env.DATABASE_URL || "").length,
    databaseUrlParseable: Boolean(databaseUrl),
    urlFingerprint: fingerprint(env.DATABASE_URL),
    hostFingerprint: fingerprint(hostname),
    databaseFingerprint: fingerprint(database),
    endpointFingerprint: fingerprint(endpoint),
    projectIdPresent: Boolean(env.NEON_PROJECT_ID),
    projectIdLength: String(env.NEON_PROJECT_ID || "").length,
    projectFingerprint: fingerprint(env.NEON_PROJECT_ID),
    branchIdPresent: Boolean(env.NEON_BRANCH_ID),
    branchFingerprint: fingerprint(env.NEON_BRANCH_ID),
    tenantModePresent: Boolean(env.INOVAS_TENANT_MODE),
    adminSessionSecretFingerprint: fingerprint(env.ADMIN_SESSION_SECRET),
  };
};

const [productionPath, previewPath] = process.argv.slice(2);

if (!productionPath || !previewPath) {
  console.error(
    "Usage: node scripts/inspect-env-fingerprints.mjs <production.env> <preview.env>"
  );
  process.exitCode = 1;
} else {
  const production = getSafeDatabaseIdentity(
    "production",
    parseEnvFile(productionPath)
  );
  const preview = getSafeDatabaseIdentity("preview", parseEnvFile(previewPath));

  console.log(
    JSON.stringify(
      {
        production,
        preview,
        comparison: {
          sameDatabaseUrl: production.urlFingerprint === preview.urlFingerprint,
          sameHost: production.hostFingerprint === preview.hostFingerprint,
          sameDatabase:
            production.databaseFingerprint === preview.databaseFingerprint,
          sameEndpoint:
            production.endpointFingerprint === preview.endpointFingerprint,
          sameProject:
            production.projectFingerprint === preview.projectFingerprint,
          sameAdminSessionSecret:
            production.adminSessionSecretFingerprint ===
            preview.adminSessionSecretFingerprint,
        },
      },
      null,
      2
    )
  );
}
