// Isolamento de identidade: um restaurante que não é o Tokyo nunca pode herdar
// nome, logo, WhatsApp, endereço ou SEO do Tokyo (padrão silencioso proibido).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const workspaceRoot = path.resolve(__dirname, "..", "..");
const TOKYO_MARKERS = [/tokyo/i, /sushi/i, /5516990507398/, /General Os[oó]rio/i, /combinado-imperial/i];

const withIsolatedSettings = async (fn) => {
  const originalCwd = process.cwd();
  const saved = {
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
    INOVAS_TENANT_MODE: process.env.INOVAS_TENANT_MODE,
  };
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "inovas-settings-isolation-"));
  fs.mkdirSync(path.join(tempRoot, ".data"));
  try {
    process.chdir(tempRoot);
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    process.env.INOVAS_TENANT_MODE = "pilot";
    for (const key of Object.keys(require.cache)) {
      if (key.startsWith(path.join(workspaceRoot, "lib"))) delete require.cache[key];
    }
    const store = require(path.join(workspaceRoot, "lib", "restaurant-settings-store.cjs"));
    const { buildTenantContext } = require(path.join(workspaceRoot, "lib", "tenant-context.cjs"));
    await fn({ store, buildTenantContext });
  } finally {
    process.chdir(originalCwd);
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
};

const assertNoTokyoIdentity = (settings, label) => {
  const identity = JSON.stringify({
    restaurantName: settings.restaurantName,
    logoUrl: settings.logoUrl,
    bannerUrl: settings.bannerUrl,
    whatsapp: settings.whatsapp,
    address: settings.address,
    addressFields: settings.addressFields,
    seoTitle: settings.seoTitle,
    seoDescription: settings.seoDescription,
    seoShareImage: settings.seoShareImage,
    seoKeywords: settings.seoKeywords,
    seoOpenGraph: settings.seoOpenGraph,
    site: settings.site,
    premiumContent: settings.premiumContent,
  });
  for (const marker of TOKYO_MARKERS) {
    assert.doesNotMatch(identity, marker, `${label}: herdou identidade do Tokyo (${marker})`);
  }
};

test("restaurante novo sem configuração salva não herda a identidade do Tokyo", async () => {
  await withIsolatedSettings(async ({ store, buildTenantContext }) => {
    const tenantContext = buildTenantContext({
      restaurantKey: "kasulo-rocha-pizzaria",
      restaurantName: "Kasulo Rocha Pizzaria",
      matchedDomain: true,
    });
    const { settings } = await store.getPublicRestaurantSettings({ tenantContext });
    assertNoTokyoIdentity(settings, "leitura pública");
    assert.equal(settings.restaurantKey, "kasulo-rocha-pizzaria");
    assert.equal(settings.whatsapp, "", "sem WhatsApp configurado não pode cair no número do Tokyo");
    assert.deepEqual(settings.premiumContent.cartAddons, [], "complementos do Tokyo (hashi/shoyu) não valem para outro restaurante");
  });
});

test("salvar só parte das configurações não completa o resto com dados do Tokyo", async () => {
  await withIsolatedSettings(async ({ store, buildTenantContext }) => {
    const tenantContext = buildTenantContext({ restaurantKey: "kasulo-rocha-pizzaria", matchedDomain: true });
    await store.updateRestaurantSettings({ settings: { restaurantName: "Kasulo Rocha Pizzaria" } }, {}, { tenantContext });
    const { settings } = await store.getPublicRestaurantSettings({ tenantContext });
    assert.equal(settings.restaurantName, "Kasulo Rocha Pizzaria");
    assertNoTokyoIdentity(settings, "após salvar parcial");
  });
});

test("o Tokyo continua com a própria identidade e os complementos atuais", async () => {
  await withIsolatedSettings(async ({ store, buildTenantContext }) => {
    const tenantContext = buildTenantContext({ restaurantKey: "default", matchedDomain: true });
    const { settings } = await store.getPublicRestaurantSettings({ tenantContext });
    assert.match(settings.restaurantName, /Tokyo/);
    assert.equal(settings.whatsapp, "5516990507398");
    assert.deepEqual(
      settings.premiumContent.cartAddons.map((addon) => addon.id),
      ["hashi", "adaptador", "shoyu", "tare"]
    );
  });
});

test("salvar pelo Gestor sem premiumContent mantém os textos do Modelo Premium", async () => {
  await withIsolatedSettings(async ({ store, buildTenantContext }) => {
    const tenantContext = buildTenantContext({ restaurantKey: "kasulo-rocha-pizzaria", matchedDomain: true });
    await store.updateRestaurantSettings(
      {
        settings: {
          restaurantName: "Kasulo Rocha Pizzaria",
          premiumContent: {
            heroEyebrow: "Pizzaria artesanal",
            cartAddons: [{ id: "borda-catupiry", name: "Borda de catupiry", unitPrice: 12, freeUnits: 0, defaultQuantity: 0 }],
          },
        },
      },
      {},
      { tenantContext }
    );
    await store.updateRestaurantSettings({ settings: { restaurantName: "Kasulo Rocha" } }, {}, { tenantContext });
    const { settings } = await store.getPublicRestaurantSettings({ tenantContext });
    assert.equal(settings.restaurantName, "Kasulo Rocha");
    assert.equal(settings.premiumContent.heroEyebrow, "Pizzaria artesanal");
    assert.deepEqual(settings.premiumContent.cartAddons.map((addon) => addon.id), ["borda-catupiry"]);
  });
});
