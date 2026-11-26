"use strict";

// Cobrança dos adicionais do plano no extrato do restaurante.
//
// Cada adicional pago gera UM lançamento por mês, com a chave
// "addon:<adicional>:<AAAA-MM>". Assim:
//   - ligou no dia 15  → o mês inteiro é lançado na hora;
//   - a rotina do mês  → lança os adicionais ligados (mesma chave: se já foi
//                        lançado ao ligar, não cobra de novo);
//   - desligou e religou no mesmo mês → mesma chave, sem custo extra.
// O lançamento é do tipo "SUBSCRIPTION" (Mensalidade INOVAS): sai do repasse
// de quem recebe online ou entra como valor devido para quem paga por fora.

const { buildTenantContext } = require("./tenant-context.cjs");
const { recordLedgerEntry } = require("./payout-store.cjs");
const { ledgerKeyFor, monthLabel } = require("./plan-addons.cjs");

const optionsFor = (restaurant) => ({
  tenantContext: buildTenantContext(
    {
      host: "addons.inovas.local",
      matched: true,
      tenantId: restaurant.tenantId,
      restaurantId: restaurant.restaurantId,
      restaurantKey: restaurant.restaurantKey,
      resolutionMode: "system",
      multiRestaurantActive: true,
    },
    { source: "plan-addons:billing" }
  ),
});

// Lança o mês de um adicional. Devolve o valor lançado (0 se já estava).
const chargeAddonMonth = async (restaurant, { addonKey, name, priceCents, monthKey }, { actorLogin = "", now = new Date(), options = null } = {}) => {
  if (!(priceCents > 0)) return 0;
  const { replayed } = await recordLedgerEntry(options || optionsFor(restaurant), {
    type: "SUBSCRIPTION",
    amountCents: priceCents,
    description: `${monthLabel(monthKey)} · Adicional ${name}`.slice(0, 120),
    idempotencyKey: ledgerKeyFor(addonKey, monthKey),
    occurredAt: new Date(now).toISOString(),
  }, { actorLogin: actorLogin || "adicionais" });
  return replayed ? 0 : priceCents;
};

// Rotina do mês: lança todos os adicionais pagos e ligados. billing vem de
// getRestaurantBillingByKey (planAddons com "charged").
const chargeMonthlyAddons = async (restaurant, billing, monthKey, { options = null, now = new Date() } = {}) => {
  let total = 0;
  for (const addon of (billing?.planAddons || []).filter((entry) => entry.charged)) {
    total += await chargeAddonMonth(restaurant, { addonKey: addon.key, name: addon.name, priceCents: addon.priceCents, monthKey }, { actorLogin: "rotina-mensalidade", now, options }).catch(() => 0);
  }
  return total;
};

module.exports = { chargeAddonMonth, chargeMonthlyAddons };
