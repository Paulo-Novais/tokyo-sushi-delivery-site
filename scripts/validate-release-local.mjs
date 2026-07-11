import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const isFast = process.argv.includes("--fast");

const criticalJsonFiles = [
  "package.json",
  "package-lock.json",
  "site.config.json",
  "vercel.json",
];

const syntaxFiles = [
  "maps-config.js",
  "script.js",
  "site-config.js",
  "playwright.config.cjs",
  "scripts/local-validation-server.cjs",
  "tests/validate-stage-3-ui.spec.js",
  "tests/e2e/helpers/v1.9-fixtures.cjs",
  "tests/e2e/v1.8-smoke.spec.js",
  "tests/e2e/v1.9-auth-security.spec.js",
  "tests/e2e/v1.9-rbac-tenant.spec.js",
  "tests/e2e/v1.9-responsive.spec.js",
  "lib/admin-api.cjs",
  "lib/app-branding.cjs",
  "lib/master-platform-store.cjs",
];

const fastCommands = [
  [npmCommand, ["audit", "--omit=dev"], "npm audit --omit=dev"],
  [npmCommand, ["run", "validate:v1-final-local"], "validate:v1-final-local"],
  [npmCommand, ["run", "validate:responsive-platform-local"], "validate:responsive-platform-local"],
  [npmCommand, ["run", "validate:admin-kanban-volume:local"], "validate:admin-kanban-volume:local"],
  [npmCommand, ["run", "validate:stage-3-ui-local"], "validate:stage-3-ui-local"],
  [npmCommand, ["run", "validate:whatsapp"], "validate:whatsapp"],
  [npmCommand, ["run", "test:e2e"], "test:e2e"],
];

const fullCommands = [
  [npmCommand, ["audit", "--omit=dev"], "npm audit --omit=dev"],
  [npmCommand, ["run", "validate:v1-1-users-local"], "validate:v1-1-users-local"],
  [npmCommand, ["run", "validate:v1-2-saas-local"], "validate:v1-2-saas-local"],
  [npmCommand, ["run", "validate:v1-3-platform-local"], "validate:v1-3-platform-local"],
  [npmCommand, ["run", "validate:v1-security-hardening-local"], "validate:v1-security-hardening-local"],
  [npmCommand, ["run", "validate:v1-onboarding-local"], "validate:v1-onboarding-local"],
  [npmCommand, ["run", "validate:v1-subscription-local"], "validate:v1-subscription-local"],
  [npmCommand, ["run", "validate:v1-rbac-local"], "validate:v1-rbac-local"],
  [npmCommand, ["run", "validate:v1-audit-local"], "validate:v1-audit-local"],
  [npmCommand, ["run", "validate:v1-export-local"], "validate:v1-export-local"],
  [npmCommand, ["run", "validate:v1-pilot-journey-local"], "validate:v1-pilot-journey-local"],
  [npmCommand, ["run", "validate:v1-final-local"], "validate:v1-final-local"],
  [npmCommand, ["run", "validate:admin-platform-owner-local"], "validate:admin-platform-owner-local"],
  [npmCommand, ["run", "validate:master-panel-local"], "validate:master-panel-local"],
  [npmCommand, ["run", "validate:domains-local"], "validate:domains-local"],
  [npmCommand, ["run", "validate:responsive-platform-local"], "validate:responsive-platform-local"],
  [npmCommand, ["run", "validate:admin-kanban-volume:local"], "validate:admin-kanban-volume:local"],
  [npmCommand, ["run", "validate:stage-3-ui-local"], "validate:stage-3-ui-local"],
  [npmCommand, ["run", "validate:whatsapp"], "validate:whatsapp"],
  [npmCommand, ["run", "test:e2e"], "test:e2e"],
];

const secretPatterns = [
  ["google_api_key", /AIza[0-9A-Za-z_-]{35}/],
  ["github_token", /gh[pousr]_[0-9A-Za-z_]{36,255}/],
  ["openai_key", /sk-[A-Za-z0-9_-]{20,}/],
  ["vercel_token", /vercel_[A-Za-z0-9]{20,}/i],
  ["slack_token", /xox[baprs]-[0-9A-Za-z-]{10,}/],
  ["private_key", /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/],
];

const ignoredScanPrefixes = [
  ".data/",
  ".git/",
  ".tmp/",
  "node_modules/",
  "playwright-report/",
  "test-results/",
];

const normalizePath = (filePath) => filePath.replace(/\\/g, "/");
const needsShell = (command) =>
  process.platform === "win32" && /\.(?:cmd|bat)$/i.test(command);
const spawnReleaseCommand = (command, args, options) => {
  if (!needsShell(command)) {
    return spawnSync(command, args, options);
  }

  const commandLine = [command, ...args].join(" ");
  return spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", commandLine], options);
};

const run = (command, args, label) => {
  console.log(`\n[release] ${label}`);
  const result = spawnReleaseCommand(command, args, {
    cwd: workspaceRoot,
    env: process.env,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${label} falhou com exit code ${result.status}`);
  }
};

const runCapture = (command, args, label) => {
  const result = spawnReleaseCommand(command, args, {
    cwd: workspaceRoot,
    env: process.env,
    encoding: "utf8",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${label} falhou${details ? `:\n${details}` : ""}`);
  }

  return result.stdout;
};

const validateJson = () => {
  console.log("\n[release] JSON parse");
  for (const relativePath of criticalJsonFiles) {
    const absolutePath = path.join(workspaceRoot, relativePath);
    JSON.parse(fs.readFileSync(absolutePath, "utf8"));
    console.log(`  OK ${relativePath}`);
  }
};

const validateSyntax = () => {
  for (const relativePath of syntaxFiles) {
    const absolutePath = path.join(workspaceRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Arquivo esperado nao encontrado: ${relativePath}`);
    }
    run(process.execPath, ["--check", relativePath], `syntax ${relativePath}`);
  }
};

const listScannableFiles = () => {
  const output = runCapture(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    "git ls-files"
  );

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(normalizePath)
    .filter((relativePath) => !ignoredScanPrefixes.some((prefix) => relativePath.startsWith(prefix)));
};

const validateSecrets = () => {
  console.log("\n[release] high-confidence secret scan");
  const findings = [];

  for (const relativePath of listScannableFiles()) {
    const absolutePath = path.join(workspaceRoot, relativePath);
    const stats = fs.statSync(absolutePath, { throwIfNoEntry: false });
    if (!stats?.isFile() || stats.size > 2_000_000) {
      continue;
    }

    const body = fs.readFileSync(absolutePath, "utf8");
    for (const [label, pattern] of secretPatterns) {
      if (pattern.test(body)) {
        findings.push(`${relativePath}: ${label}`);
      }
    }
  }

  if (findings.length > 0) {
    throw new Error(`Possiveis segredos encontrados:\n${findings.join("\n")}`);
  }

  console.log("  OK nenhum segredo de alta confianca encontrado.");
};

try {
  console.log(`[release] modo ${isFast ? "fast" : "full"}`);
  validateJson();
  validateSyntax();
  run("git", ["diff", "--check"], "git diff --check");
  validateSecrets();

  const commands = isFast ? fastCommands : fullCommands;
  for (const [command, args, label] of commands) {
    run(command, args, label);
  }

  console.log(`\nvalidate:release${isFast ? ":fast" : ""} OK`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
