// Automated audit of the public (static) build.
// 1. Builds into a temporary directory with the same allowlist used in deploy.
// 2. Fails if any private file (lib/, scripts/, docs/, migrations/, tests/,
//    *.md, configs, dotfiles, _tmp*) is present.
// 3. Fails if a page references a local asset that is missing, or if a
//    vercel.json rewrite points to a static file that is not published.
// 4. Fails on high-confidence secret patterns inside published files.
// 5. Checks the policy against the production exposure snapshot when present.
// Prints paths and pattern names only, never secret values.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildPublic } from "./build-public.mjs";

const require = createRequire(import.meta.url);
const { isPrivateStaticPath, PUBLIC_LIB_FILES } = require("../lib/public-surface-policy.cjs");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "inovas-public-build-"));
const failures = [];
const fail = (message) => failures.push(message);

const published = buildPublic(outDir).sort();
const publishedSet = new Set(published);

// --- 2. forbidden content -------------------------------------------------
const FORBIDDEN = [
  [/^lib\//, "modulo interno de lib/"],
  [/^(scripts|docs|migrations|tests|api|node_modules|artifacts|menu_pdf_crops)\//, "pasta interna"],
  [/\.(md|sql|patch|log|mjs|pem|key)$/i, "extensao privada"],
  [/^(package(-lock)?\.json|vercel\.json|site\.config\.json|middleware\.js|playwright\.config\.cjs)$/i, "configuracao/servidor"],
  [/(^|\/)(\.|_tmp)/i, "arquivo oculto ou temporario"],
];
for (const file of published) {
  if (PUBLIC_LIB_FILES.includes(file)) continue;
  for (const [pattern, reason] of FORBIDDEN) {
    if (pattern.test(file)) fail(`PRIVADO publicado (${reason}): ${file}`);
  }
}

// --- 3. references and rewrites -------------------------------------------
const exists = (urlPath) => {
  const clean = urlPath.split(/[?#]/)[0].replace(/^\/+/, "");
  if (!clean) return publishedSet.has("index.html");
  if (publishedSet.has(clean)) return true;
  if (publishedSet.has(`${clean}.html`)) return true;
  if (publishedSet.has(`${clean.replace(/\/$/, "")}/index.html`)) return true;
  return false;
};
const isLocalRef = (value) =>
  value &&
  !/^(https?:|\/\/|mailto:|tel:|data:|blob:|javascript:|#)/i.test(value) &&
  !value.includes("${") &&
  !value.startsWith("/api/");

let checkedRefs = 0;
for (const file of published.filter((f) => f.endsWith(".html"))) {
  const html = fs.readFileSync(path.join(outDir, file), "utf8");
  for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    const ref = match[1].trim();
    if (!isLocalRef(ref)) continue;
    const resolved = ref.startsWith("/")
      ? ref
      : `/${path.posix.normalize(path.posix.join(path.posix.dirname(file), ref))}`;
    if (/\.(html?|css|js|cjs|png|jpe?g|svg|webp|ico|webmanifest|json|xml|txt|woff2?)(\?|#|$)/i.test(resolved)) {
      checkedRefs++;
      if (!exists(resolved)) fail(`REFERENCIA quebrada em ${file}: ${ref}`);
    }
  }
}

const vercel = JSON.parse(fs.readFileSync(path.join(repoRoot, "vercel.json"), "utf8"));
assert.equal(vercel.outputDirectory, "public", "vercel.json deve declarar outputDirectory=public");
assert.ok(
  String(vercel.buildCommand || "").includes("build-public"),
  "vercel.json deve gerar ./public com scripts/build-public.mjs"
);
let checkedRewrites = 0;
for (const rule of vercel.rewrites || []) {
  const destination = String(rule.destination || "");
  if (!destination.startsWith("/") || destination.startsWith("/api/") || destination.includes(":")) continue;
  if (!/\.[a-z0-9]+$/i.test(destination)) continue;
  checkedRewrites++;
  if (!exists(destination)) fail(`REWRITE aponta para arquivo nao publicado: ${rule.source} -> ${destination}`);
}

// --- 4. secrets ------------------------------------------------------------
const SECRET_PATTERNS = {
  "postgres URL com senha": /postgres(?:ql)?:\/\/[^:\s'"]+:[^@\s'"]{6,}@/,
  "senha Neon (npg_)": /\bnpg_[A-Za-z0-9]{10,}/,
  "token Meta/WhatsApp": /\bEAA[A-Za-z0-9]{40,}/,
  "chave Google": /\bAIza[0-9A-Za-z_-]{35}\b/,
  "chave privada": /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  "hash scrypt": /\bscrypt\$[0-9a-f]{16,}\$[0-9a-f]{32,}/,
  "token GitHub": /\bgh[pousr]_[A-Za-z0-9]{30,}/,
};
for (const file of published.filter((f) => /\.(html|js|cjs|css|json|txt|xml|webmanifest)$/i.test(f))) {
  const text = fs.readFileSync(path.join(outDir, file), "utf8");
  for (const [name, pattern] of Object.entries(SECRET_PATTERNS)) {
    if (pattern.test(text)) fail(`SEGREDO (${name}) em ${file}`);
  }
}

// --- 5. production exposure snapshot (optional, read-only) -----------------
const snapshotManifest =
  process.env.INOVAS_PROD_EXPOSURE_MANIFEST ||
  "C:/Dev/INOVAS-PROD-SNAPSHOT/2026-11-04-backend/MANIFEST-PRODUCAO-BACKEND.csv";
let exposureSummary = null;
if (fs.existsSync(snapshotManifest)) {
  const rows = fs.readFileSync(snapshotManifest, "utf8").split(/\r?\n/).slice(1).filter(Boolean);
  const exposed = rows
    .map((row) => row.match(/^(\d+),"([^"]*)",[^,]*,[^,]*,[^,]*,"([^"]+)"/))
    .filter((m) => m && m[1] === "200" && m[2] !== "FALLBACK_HOME")
    .map((m) => m[3]);
  const stillPublic = exposed.filter((p) => publishedSet.has(p) && !PUBLIC_LIB_FILES.includes(p));
  const blockedByPolicy = exposed.filter((p) => isPrivateStaticPath(`/${p}`));
  stillPublic.forEach((p) => fail(`EXPOSICAO de producao continuaria publica: ${p}`));
  exposureSummary = { exposedInProduction: exposed.length, blockedByPolicy: blockedByPolicy.length, stillPublic };
}

const report = {
  generatedAt: new Date().toISOString(),
  publishedFiles: published.length,
  publishedByTopLevel: published.reduce((acc, f) => {
    const key = f.includes("/") ? f.split("/")[0] + "/" : "(raiz)";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}),
  checkedReferences: checkedRefs,
  checkedRewrites,
  exposureSummary,
  failures,
};
const reportPath = process.env.INOVAS_PUBLIC_BUILD_REPORT;
if (reportPath) fs.writeFileSync(reportPath, JSON.stringify({ ...report, published }, null, 2));
fs.rmSync(outDir, { recursive: true, force: true });

console.log(JSON.stringify(report, null, 2));
if (failures.length) {
  console.error(`[public-build] ${failures.length} falha(s).`);
  process.exit(1);
}
console.log("[public-build] OK: somente recursos publicos no build.");
