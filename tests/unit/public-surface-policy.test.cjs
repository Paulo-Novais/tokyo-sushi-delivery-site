const assert = require("node:assert/strict");
const test = require("node:test");
const {
  isPrivateStaticPath,
  isPublicBuildFile,
} = require("../../lib/public-surface-policy.cjs");

test("internal modules, scripts, docs and configs are private", () => {
  for (const pathname of [
    "/lib/admin-auth.cjs",
    "/lib/user-permissions.cjs",
    "/scripts/run-kasulo-identity-recovery.mjs",
    "/scripts/local-validation-server.cjs",
    "/docs/security/RUNTIME-DATABASE-ROLE.md",
    "/migrations/026_explicit_identity_scope_and_kasulo_recovery.sql",
    "/tests/e2e/cash-register.spec.js",
    "/CHANGELOG.md",
    "/INOVAS-FOOD-SECURITY-REVIEW.md",
    "/package.json",
    "/vercel.json",
    "/site.config.json",
    "/middleware.js",
    "/playwright.config.cjs",
    "/.env.example",
    "/.vercel/project.json",
    "/_tmp_admin_kanban_volume_validation.png",
    "/LIB/ADMIN-AUTH.CJS",
    "/%6Cib/admin-auth.cjs",
    "/admin/../lib/admin-auth.cjs",
  ]) {
    assert.equal(isPrivateStaticPath(pathname), true, pathname);
  }
});

test("public pages, assets, APIs and verification paths stay reachable", () => {
  for (const pathname of [
    "/",
    "/index.html",
    "/inovas.html",
    "/script.js",
    "/styles.css",
    "/admin/login.html",
    "/admin/admin.js",
    "/system/system.js",
    "/system/roles/roles.js",
    "/assets/logo.png",
    "/lib/business-hours.cjs",
    "/api/admin/session",
    "/api/system/health",
    "/.well-known/acme-challenge/token",
  ]) {
    assert.equal(isPrivateStaticPath(pathname), false, pathname);
  }
});

test("public build allowlist excludes server and tooling files", () => {
  assert.equal(isPublicBuildFile("index.html"), true);
  assert.equal(isPublicBuildFile("admin/users/users.js"), true);
  assert.equal(isPublicBuildFile("lib/business-hours.cjs"), true);
  assert.equal(isPublicBuildFile("lib/http.cjs"), false);
  assert.equal(isPublicBuildFile("api/catalog.js"), false);
  assert.equal(isPublicBuildFile("middleware.js"), false);
  assert.equal(isPublicBuildFile("playwright.config.cjs"), false);
  assert.equal(isPublicBuildFile("README.md"), false);
  assert.equal(isPublicBuildFile("menu_pdf_crops/page-1.png"), false);
  assert.equal(isPublicBuildFile("artifacts/x.png"), false);
});
