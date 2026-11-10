// Security behavior: the default (Tokyo) catalog must never be projected into a
// different restaurant. INOVAS_ALLOW_TENANT_CATALOG_FALLBACK=true is a test-only
// compatibility switch for disposable validation tenants.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const workspaceRoot = path.resolve(__dirname, "..", "..");

const withIsolatedCatalog = async (fallback, fn) => {
  const originalCwd = process.cwd();
  const saved = {
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
    INOVAS_TENANT_MODE: process.env.INOVAS_TENANT_MODE,
    INOVAS_ALLOW_TENANT_CATALOG_FALLBACK: process.env.INOVAS_ALLOW_TENANT_CATALOG_FALLBACK,
  };
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "inovas-catalog-isolation-"));
  fs.mkdirSync(path.join(tempRoot, ".data"));
  fs.copyFileSync(path.join(workspaceRoot, "script.js"), path.join(tempRoot, "script.js"));
  try {
    process.chdir(tempRoot);
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    process.env.INOVAS_TENANT_MODE = "pilot";
    if (fallback) process.env.INOVAS_ALLOW_TENANT_CATALOG_FALLBACK = "true";
    else delete process.env.INOVAS_ALLOW_TENANT_CATALOG_FALLBACK;
    for (const key of Object.keys(require.cache)) {
      if (key.startsWith(path.join(workspaceRoot, "lib"))) delete require.cache[key];
    }
    const catalogStore = require(path.join(workspaceRoot, "lib", "catalog-store.cjs"));
    const { buildTenantContext } = require(path.join(workspaceRoot, "lib", "tenant-context.cjs"));
    await fn({ catalogStore, buildTenantContext });
  } finally {
    process.chdir(originalCwd);
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
};

const itemCount = async (catalogStore, tenantContext) =>
  (await catalogStore.getCatalogValidationContext({ tenantContext })).itemMap.size;

test("a new restaurant does not inherit the default catalog", async () => {
  await withIsolatedCatalog(false, async ({ catalogStore, buildTenantContext }) => {
    const other = buildTenantContext({ restaurantKey: "restaurante-novo", matchedDomain: true });
    assert.equal(await itemCount(catalogStore, other), 0, "tenant novo deve começar sem cardápio");

    const defaultTenant = buildTenantContext({ restaurantKey: "default", matchedDomain: true });
    assert.ok((await itemCount(catalogStore, defaultTenant)) > 0, "tenant padrão mantém o próprio cardápio");
  });
});

test("the fallback is opt-in and only for disposable validation tenants", async () => {
  await withIsolatedCatalog(true, async ({ catalogStore, buildTenantContext }) => {
    const other = buildTenantContext({ restaurantKey: "restaurante-teste", matchedDomain: true });
    assert.ok((await itemCount(catalogStore, other)) > 0, "flag de teste reativa o cardápio-fixture");
  });
});
