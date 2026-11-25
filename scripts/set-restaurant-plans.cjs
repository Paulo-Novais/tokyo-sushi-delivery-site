// Troca o plano de restaurantes no banco de PRODUÇÃO (Neon), pelo mesmo código
// que o Painel INOVAS usa. Uso (GitHub Actions, com DATABASE_URL do segredo):
//   node scripts/set-restaurant-plans.cjs --plano PRO --nomes "kasulo,casulo,tokyo" [--aplicar]
// Sem --aplicar só mostra o que mudaria (simulação).
"use strict";
const args = process.argv.slice(2);
const get = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 ? String(args[index + 1] || "") : fallback;
};
const apply = args.includes("--aplicar");
const plan = get("--plano", "PRO").toUpperCase();
const names = get("--nomes", "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);

(async () => {
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL.");
  if (!names.length) throw new Error("Informe --nomes.");
  const store = require("../lib/master-platform-store.cjs");
  const restaurants = await store.listRestaurantBilling();
  const targets = restaurants.filter((restaurant) => {
    const text = `${restaurant.restaurantKey || ""} ${restaurant.name || ""} ${restaurant.slug || ""}`.toLowerCase();
    return names.some((name) => text.includes(name));
  });
  console.log(`Restaurantes no banco: ${restaurants.length}. Encontrados: ${targets.length}.`);
  for (const restaurant of targets) {
    const before = await store.getRestaurantBillingByKey(restaurant.restaurantKey);
    console.log(`- ${restaurant.name} (${restaurant.restaurantKey}): hoje ${before?.plan || "?"} R$ ${before?.monthlyValue ?? "?"}`);
    if (!apply) continue;
    await store.updateRestaurantSubscription(
      { restaurantKey: restaurant.restaurantKey, plan, status: "ACTIVE" },
      { login: "github-actions", userType: "MASTER", displayName: "Troca de plano (GO do Paulo)" }
    );
    const after = await store.getRestaurantBillingByKey(restaurant.restaurantKey);
    const access = await store.getRestaurantCommercialAccess(restaurant.restaurantKey);
    console.log(`  agora ${after.plan} R$ ${after.monthlyValue} · recursos: ${access.releasedFeatures.join(", ")}`);
  }
  if (!apply) console.log("Simulação: nada foi alterado. Rode com --aplicar para trocar.");
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
