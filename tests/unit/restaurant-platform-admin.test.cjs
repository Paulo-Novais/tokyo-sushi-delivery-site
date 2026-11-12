// Tela Restaurantes do System: o Master suspende/reativa, publica o site em
// /<slug>, edita os dados de plataforma e vincula domínio próprio.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const workspaceRoot = path.resolve(__dirname, "..", "..");

const withIsolatedPlatform = async (fn) => {
  const originalCwd = process.cwd();
  const saved = {
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
    INOVAS_TENANT_MODE: process.env.INOVAS_TENANT_MODE,
  };
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "inovas-platform-admin-"));
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
    const store = require(path.join(workspaceRoot, "lib", "master-platform-store.cjs"));
    const resolution = require(path.join(workspaceRoot, "lib", "tenant-resolution.cjs"));
    await fn({ store, resolution });
  } finally {
    process.chdir(originalCwd);
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
};

const ACTOR = { login: "master@inovas.test", displayName: "Master" };

test("restaurante recuperado com site desligado volta ao ar ao publicar o site", async () => {
  await withIsolatedPlatform(async ({ store, resolution }) => {
    await store.provisionRestaurantRecovery({ restaurantName: "Kasulo Rocha Pizzaria", restaurantKey: "kasulo-rocha-pizzaria" });
    assert.equal((await resolution.resolveRestaurantBySlug("kasulo-rocha-pizzaria")).matched, false, "recuperado nasce fora do ar");

    await store.updateRestaurantPlatformRecord({ restaurantKey: "kasulo-rocha-pizzaria", publicSiteEnabled: true }, ACTOR);
    const route = await resolution.resolveRestaurantBySlug("kasulo-rocha-pizzaria");
    assert.equal(route.matched, true);
    assert.equal(route.publicUrl, "https://inovasfood.com.br/kasulo-rocha-pizzaria");
  });
});

test("suspender tira o site do ar e bloqueia o contrato; reativar devolve", async () => {
  await withIsolatedPlatform(async ({ store, resolution }) => {
    await store.provisionRestaurantRecovery({ restaurantName: "Kasulo Rocha Pizzaria", restaurantKey: "kasulo-rocha-pizzaria" });
    await store.updateRestaurantPlatformRecord({ restaurantKey: "kasulo-rocha-pizzaria", publicSiteEnabled: true }, ACTOR);

    assert.throws(
      () => store.assertRestaurantSuspensionReason(""),
      (error) => error.errorCode === "restaurant_suspension_reason_required"
    );
    const suspended = await store.updateRestaurantPlatformRecord(
      { restaurantKey: "kasulo-rocha-pizzaria", accessStatus: "SUSPENDED", reason: "Mensalidade em atraso" },
      ACTOR
    );
    assert.equal(suspended.restaurant.status, "SUSPENDED");
    assert.equal((await resolution.resolveRestaurantBySlug("kasulo-rocha-pizzaria")).matched, false);
    const gestorAccess = () =>
      store.getPlanAccessForAdminModule({ group: "orders", action: "list", restaurantKey: "kasulo-rocha-pizzaria" });
    assert.equal((await gestorAccess()).allowed, false, "Gestor bloqueado enquanto suspenso");

    const reactivated = await store.updateRestaurantPlatformRecord(
      { restaurantKey: "kasulo-rocha-pizzaria", accessStatus: "ACTIVE", reason: "Pagamento confirmado" },
      ACTOR
    );
    assert.equal(reactivated.restaurant.status, "ACTIVE");
    assert.equal((await resolution.resolveRestaurantBySlug("kasulo-rocha-pizzaria")).matched, true);
    assert.equal((await gestorAccess()).allowed, true, "Gestor liberado depois de reativar");
  });
});

test("domínio próprio fica pendente até confirmar o DNS e não pode ser de outro restaurante", async () => {
  await withIsolatedPlatform(async ({ store, resolution }) => {
    await store.provisionRestaurantRecovery({ restaurantName: "Kasulo Rocha Pizzaria", restaurantKey: "kasulo-rocha-pizzaria" });
    await store.updateRestaurantPlatformRecord(
      { restaurantKey: "kasulo-rocha-pizzaria", publicSiteEnabled: true, customDomain: "https://www.KasuloPizzaria.com.br/" },
      ACTOR
    );
    const pending = await store.updateRestaurantPlatformRecord({ restaurantKey: "kasulo-rocha-pizzaria" }, ACTOR);
    assert.equal(pending.domain.customDomain, "kasulopizzaria.com.br");
    assert.equal(pending.domain.status, "PENDING_DNS");
    assert.equal((await resolution.resolveRestaurantByHost("kasulopizzaria.com.br")).matched, false);

    const verified = await store.updateRestaurantPlatformRecord(
      { restaurantKey: "kasulo-rocha-pizzaria", domainStatus: "VERIFIED" },
      ACTOR
    );
    assert.equal(verified.domain.status, "VERIFIED");
    const byHost = await resolution.resolveRestaurantByHost("kasulopizzaria.com.br");
    assert.equal(byHost.matched, true);
    assert.equal(byHost.restaurantKey, "kasulo-rocha-pizzaria");

    await assert.rejects(
      store.updateRestaurantPlatformRecord({ restaurantKey: "kasulo-rocha-pizzaria", customDomain: "tokyosushidelivery.com.br" }, ACTOR),
      (error) => error.errorCode === "restaurant_domain_in_use"
    );
    await assert.rejects(
      store.updateRestaurantPlatformRecord({ restaurantKey: "kasulo-rocha-pizzaria", customDomain: "inovasfood.com.br" }, ACTOR),
      (error) => error.errorCode === "restaurant_domain_reserved"
    );
  });
});

test("editar nome e plano dos dados de plataforma", async () => {
  await withIsolatedPlatform(async ({ store }) => {
    await store.provisionRestaurantRecovery({ restaurantName: "Kasulo Rocha Pizzaria", restaurantKey: "kasulo-rocha-pizzaria" });
    const result = await store.updateRestaurantPlatformRecord(
      { restaurantKey: "kasulo-rocha-pizzaria", name: "Kasulo Rocha", plan: "PRO" },
      ACTOR
    );
    assert.equal(result.restaurant.name, "Kasulo Rocha");
    assert.equal(result.subscription.plan, "PRO");
    await assert.rejects(
      store.updateRestaurantPlatformRecord({ restaurantKey: "nao-existe", name: "X" }, ACTOR),
      (error) => error.errorCode === "restaurant_not_found"
    );
  });
});
