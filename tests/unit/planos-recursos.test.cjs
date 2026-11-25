// Tabela de planos de 25/11/2026: o que cada plano libera no Gestor/PDV,
// cobrança do domínio próprio e vagas de usuário.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const workspaceRoot = path.resolve(__dirname, "..", "..");
const ACTOR = { login: "master@inovas.test", userType: "MASTER" };

const withIsolatedPlatform = async (fn) => {
  const originalCwd = process.cwd();
  const saved = { DATABASE_URL: process.env.DATABASE_URL, POSTGRES_URL: process.env.POSTGRES_URL, INOVAS_TENANT_MODE: process.env.INOVAS_TENANT_MODE };
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "inovas-planos-"));
  fs.mkdirSync(path.join(tempRoot, ".data"));
  fs.copyFileSync(path.join(workspaceRoot, "script.js"), path.join(tempRoot, "script.js"));
  try {
    process.chdir(tempRoot);
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    process.env.INOVAS_TENANT_MODE = "pilot";
    for (const key of Object.keys(require.cache)) {
      if (key.startsWith(path.join(workspaceRoot, "lib"))) delete require.cache[key];
    }
    await fn(require(path.join(workspaceRoot, "lib", "master-platform-store.cjs")));
  } finally {
    process.chdir(originalCwd);
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
};

const KEY = "kasulo-rocha-pizzaria";
const access = (store, group, action = "list") => store.getPlanAccessForAdminModule({ group, action, restaurantKey: KEY });

test("Essencial: pedidos sim; estoque, caixa e previsão não", async () => {
  await withIsolatedPlatform(async (store) => {
    await store.provisionRestaurantRecovery({ restaurantName: "Kasulo Rocha Pizzaria", restaurantKey: KEY });
    await store.updateRestaurantSubscription({ restaurantKey: KEY, plan: "START", status: "ACTIVE" }, ACTOR);
    assert.equal((await access(store, "orders")).allowed, true);
    assert.equal((await access(store, "inventory")).allowed, false);
    assert.equal((await access(store, "cash-register", "snapshot")).allowed, false);
    assert.equal((await access(store, "dashboard", "forecast")).allowed, false);
  });
});

test("Profissional: estoque, financeiro e relatórios; caixa, clientes e previsão só no Completo", async () => {
  await withIsolatedPlatform(async (store) => {
    await store.provisionRestaurantRecovery({ restaurantName: "Kasulo Rocha Pizzaria", restaurantKey: KEY });
    await store.updateRestaurantSubscription({ restaurantKey: KEY, plan: "BUSINESS", status: "ACTIVE" }, ACTOR);
    assert.equal((await access(store, "inventory")).allowed, true);
    assert.equal((await access(store, "finance")).allowed, true);
    assert.equal((await access(store, "metrics")).allowed, true);
    assert.equal((await access(store, "cash-register", "snapshot")).allowed, false);
    assert.equal((await access(store, "customers")).allowed, false);
    assert.equal((await access(store, "dashboard", "forecast")).allowed, false);
    await store.updateRestaurantSubscription({ restaurantKey: KEY, plan: "PRO", status: "ACTIVE" }, ACTOR);
    assert.equal((await access(store, "cash-register", "snapshot")).allowed, true);
    assert.equal((await access(store, "customers")).allowed, true);
    assert.equal((await access(store, "dashboard", "forecast")).allowed, true);
  });
});

test("Completo legado (Tokyo): mantém caixa e previsão", async () => {
  await withIsolatedPlatform(async (store) => {
    await store.provisionRestaurantRecovery({ restaurantName: "Kasulo Rocha Pizzaria", restaurantKey: KEY });
    await store.updateRestaurantSubscription({ restaurantKey: KEY, plan: "PREMIUM", status: "ACTIVE" }, ACTOR);
    assert.equal((await access(store, "cash-register", "snapshot")).allowed, true);
    assert.equal((await access(store, "dashboard", "forecast")).allowed, true);
  });
});

test("domínio próprio soma R$ 49 na mensalidade dos planos pagos", async () => {
  await withIsolatedPlatform(async (store) => {
    await store.provisionRestaurantRecovery({ restaurantName: "Kasulo Rocha Pizzaria", restaurantKey: KEY });
    await store.updateRestaurantSubscription({ restaurantKey: KEY, plan: "START", status: "ACTIVE" }, ACTOR);
    const before = await store.getRestaurantBillingByKey(KEY);
    await store.updateRestaurantPlatformRecord({ restaurantKey: KEY, customDomain: "www.kasulopizzaria.com.br" }, ACTOR);
    const after = await store.getRestaurantBillingByKey(KEY);
    assert.equal(Math.round((after.monthlyValue - before.monthlyValue) * 100), 4900);
    assert.ok(after.addons.some((addon) => addon.key === "customDomain"));
    await store.updateRestaurantPlatformRecord({ restaurantKey: KEY, customDomain: "" }, ACTOR);
    assert.equal((await store.getRestaurantBillingByKey(KEY)).monthlyValue, before.monthlyValue);
  });
});

test("vagas de usuário: desativado libera a vaga", () => {
  const { countSeatUsers } = require(path.join(workspaceRoot, "lib", "plan-limits.cjs"));
  const users = [
    { id: "1", restaurantKey: KEY, status: "ACTIVE" },
    { id: "2", restaurantKey: KEY, status: "PENDING" },
    { id: "3", restaurantKey: KEY, status: "INACTIVE" },
    { id: "4", restaurantKey: "outro", status: "ACTIVE" },
    { id: "5", restaurantKey: KEY, status: "ACTIVE", userScope: "SYSTEM" },
  ];
  assert.equal(countSeatUsers(users, KEY), 2);
  assert.equal(countSeatUsers(users, KEY, "1"), 1);
});
