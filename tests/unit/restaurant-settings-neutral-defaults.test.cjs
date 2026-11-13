// Modelo Premium: um restaurante que não preencheu um campo NUNCA herda o dado do Tokyo
// (WhatsApp, endereço, logo, redes, textos, SEO). O Tokyo (restaurante padrão) continua igual.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const store = require(path.resolve(__dirname, "..", "..", "lib", "restaurant-settings-store.cjs"));

const kasulo = {
  tenantId: "tenant_kasulo",
  restaurantId: "restaurant_kasulo",
  restaurantKey: "kasulo-rocha-pizzaria",
  isDefaultTenant: false,
  tenantContext: { restaurantName: "Kasulo Rocha Pizzaria" },
};
const tokyo = { tenantId: "tenant_default", restaurantId: "restaurant_default", restaurantKey: "default", isDefaultTenant: true, tenantContext: {} };

test("restaurante novo: campos vazios ficam vazios (sem dados do Tokyo)", () => {
  const defaults = store.buildTenantDefaultSettings(kasulo);
  const settings = store.normalizeRestaurantSettings({ restaurantKey: kasulo.restaurantKey }, defaults);
  const tokyoDefaults = store.getDefaultRestaurantSettings();

  assert.equal(settings.restaurantName, "Kasulo Rocha Pizzaria");
  assert.equal(settings.whatsapp, "");
  assert.equal(settings.address, "");
  assert.equal(settings.addressFields.city, "");
  assert.equal(settings.logoUrl, "");
  assert.equal(settings.bannerUrl, "");
  assert.equal(settings.instagram, "");
  assert.equal(settings.slogan, "");
  assert.equal(settings.presentationText, "");
  // Vazio: o site usa o nome atual do restaurante como título.
  assert.equal(settings.seoTitle, "");
  assert.equal(settings.seoShareImage, "");
  assert.deepEqual(settings.seoKeywords, []);
  assert.equal(settings.averagePreparationTimeMinutes, 0);
  const text = JSON.stringify(settings).toLowerCase();
  assert.ok(!text.includes("tokyo"), "nenhuma menção ao Tokyo");
  assert.ok(!text.includes(String(tokyoDefaults.whatsapp)), "sem o WhatsApp do Tokyo");
});

test("restaurante novo: o que ele preenche é mantido", () => {
  const defaults = store.buildTenantDefaultSettings(kasulo);
  const settings = store.normalizeRestaurantSettings(
    { restaurantName: "Kasulo", whatsapp: "(16) 98888-7777", averagePreparationTimeMinutes: 40 },
    defaults
  );
  assert.equal(settings.restaurantName, "Kasulo");
  assert.equal(settings.whatsapp, "16988887777");
  assert.equal(settings.averagePreparationTimeMinutes, 40);
});

test("Tokyo continua com os padrões dele", () => {
  const defaults = store.buildTenantDefaultSettings(tokyo);
  assert.deepEqual(defaults, store.getDefaultRestaurantSettings());
  const settings = store.normalizeRestaurantSettings({}, defaults);
  assert.deepEqual(settings, store.normalizeRestaurantSettings({}));
});
