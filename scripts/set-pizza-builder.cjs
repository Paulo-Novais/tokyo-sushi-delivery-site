// Liga a "Montagem de pizza" de um restaurante no banco de PRODUÇÃO, pelo mesmo
// código que o Gestor usa (Cardápio > Montagem de pizza). Uso (GitHub Actions,
// com DATABASE_URL do segredo):
//   node scripts/set-pizza-builder.cjs --nome kasulo --sabores 1,2,4 \
//     --bordas "Catupiry=0,Cheddar=0,Muçarela=0" [--tamanho "8 pedaços"] [--aplicar]
// As categorias de sabores são as do cardápio com "pizza" no nome.
// Sem --aplicar só mostra o que mudaria (simulação).
"use strict";
const args = process.argv.slice(2);
const get = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 ? String(args[index + 1] || "") : fallback;
};
const apply = args.includes("--aplicar");
const name = get("--nome").trim().toLowerCase();
const counts = get("--sabores", "1,2").split(",").map((value) => Number.parseInt(value, 10)).filter(Boolean);
const sizeLabel = get("--tamanho", "8 pedaços");
const borders = get("--bordas", "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
    const [borderName, price] = entry.split("=");
    return { name: String(borderName || "").trim(), price: String(price ?? "0").trim().replace(",", ".") };
  });

(async () => {
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL.");
  if (!name) throw new Error("Informe --nome.");
  const { runWithDatabaseScope } = require("../lib/tenant-sql.cjs");
  const { buildTenantContext } = require("../lib/tenant-context.cjs");
  const master = require("../lib/master-platform-store.cjs");
  const { getAdminCatalog } = require("../lib/catalog-store.cjs");
  const { getAdminRestaurantSettings, updateRestaurantSettings } = require("../lib/restaurant-settings-store.cjs");

  const restaurants = await master.listRestaurantBilling();
  const targets = restaurants.filter((restaurant) =>
    `${restaurant.restaurantKey} ${restaurant.name}`.toLowerCase().includes(name)
  );
  if (targets.length !== 1) {
    throw new Error(`Esperava 1 restaurante com "${name}", achei ${targets.length}: ${targets.map((entry) => entry.name).join(", ")}`);
  }
  const restaurant = targets[0];
  const tenantContext = buildTenantContext(
    {
      host: "github-actions.inovas.local",
      matched: true,
      tenantId: restaurant.tenantId,
      restaurantId: restaurant.restaurantId,
      restaurantKey: restaurant.restaurantKey,
      restaurantName: restaurant.name,
      resolutionMode: "system",
      multiRestaurantActive: true,
    },
    { source: "script:pizza-builder" }
  );
  const scope = {
    audience: "system",
    tenantId: restaurant.tenantId,
    restaurantId: restaurant.restaurantId,
    restaurantKey: restaurant.restaurantKey,
  };
  await runWithDatabaseScope(scope, async () => {
    const catalog = await getAdminCatalog({}, { tenantContext });
    const flavorSections = (catalog.sections || []).filter((section) => /pizza/i.test(`${section.title} ${section.id}`));
    console.log(`Restaurante: ${restaurant.name} (${restaurant.restaurantKey})`);
    console.log(`Categorias do cardápio: ${(catalog.sections || []).map((section) => `${section.title} [${section.id}] ${(section.items || []).length} itens`).join(" | ")}`);
    console.log(`Sabores (categorias com "pizza"): ${flavorSections.map((section) => section.title).join(", ") || "NENHUMA"}`);
    if (!flavorSections.length) throw new Error("Nenhuma categoria de pizza encontrada. Nada foi alterado.");
    const current = await getAdminRestaurantSettings({ tenantContext });
    const pizzaBuilder = {
      enabled: true,
      sizeLabel,
      flavorCounts: counts,
      flavorSectionIds: flavorSections.map((section) => section.id),
      borders,
    };
    console.log(`Hoje: ${JSON.stringify(current.settings?.pizzaBuilder || null)}`);
    console.log(`Novo: ${JSON.stringify(pizzaBuilder)}`);
    if (!apply) {
      console.log("Simulação: nada foi alterado. Rode com --aplicar para ligar.");
      return;
    }
    const result = await updateRestaurantSettings(
      { settings: { ...current.settings, pizzaBuilder } },
      { login: "github-actions", displayName: "Montagem de pizza (GO do Paulo)" },
      { tenantContext }
    );
    console.log(`Salvo: ${JSON.stringify(result.settings?.pizzaBuilder || null)}`);
  });
})().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
