const test = require("node:test");
const assert = require("node:assert/strict");
const { computeBillingSituation, todayInBrazil } = require("../../lib/billing-enforcement.cjs");

const now = new Date("2026-11-25T15:00:00Z");
const owing = { balanceCents: -29990, lastSubscriptionAt: "2026-11-01T12:00:00Z" };
const base = { status: "ACTIVE", accessStatus: "ACTIVE" };

test("sem dívida: em dia", () => {
  assert.equal(computeBillingSituation(base, { balanceCents: 0 }, now).situation, "PAID_UP");
});

test("devendo há mais de 10 dias sem prazo: em atraso", () => {
  assert.equal(computeBillingSituation(base, owing, now).situation, "OVERDUE");
});

test("com prazo: vale até o fim do dia do prazo (horário de Brasília)", () => {
  const contract = { ...base, billingGrace: { until: "2026-11-25" } };
  assert.equal(computeBillingSituation(contract, owing, now).situation, "GRACE");
  // 23h30 de Brasília do mesmo dia ainda está no prazo.
  assert.equal(computeBillingSituation(contract, owing, new Date("2026-11-26T02:30:00Z")).situation, "GRACE");
  // 00h30 do dia seguinte: venceu.
  assert.equal(computeBillingSituation(contract, owing, new Date("2026-11-26T03:30:00Z")).situation, "GRACE_EXPIRED");
});

test("bloqueado vem antes de tudo", () => {
  const contract = { ...base, status: "BLOCKED", accessStatus: "SUSPENDED", billingGrace: { until: "2026-11-20" } };
  assert.equal(computeBillingSituation(contract, owing, now).situation, "BLOCKED");
});

test("prazo sem dívida não conta", () => {
  const contract = { ...base, billingGrace: { until: "2026-11-20" } };
  assert.equal(computeBillingSituation(contract, { balanceCents: 0 }, now).situation, "PAID_UP");
});

test("data de hoje no Brasil", () => {
  assert.equal(todayInBrazil(new Date("2026-11-26T02:59:00Z")), "2026-11-25");
  assert.equal(todayInBrazil(new Date("2026-11-26T03:00:00Z")), "2026-11-26");
});

test("rotina diária: bloqueia só prazo vencido com 'bloquear sozinho' e apaga prazo de quem pagou", async () => {
  const { runBillingEnforcement } = require("../../lib/billing-enforcement.cjs");
  const contracts = [
    { restaurantKey: "vencido-auto", tenantId: "t1", restaurantId: "r1", ...base, billingGrace: { until: "2026-11-20", autoBlock: true } },
    { restaurantKey: "vencido-manual", tenantId: "t2", restaurantId: "r2", ...base, billingGrace: { until: "2026-11-20", autoBlock: false } },
    { restaurantKey: "no-prazo", tenantId: "t3", restaurantId: "r3", ...base, billingGrace: { until: "2026-11-30", autoBlock: true } },
    { restaurantKey: "pagou", tenantId: "t4", restaurantId: "r4", ...base, billingGrace: { until: "2026-11-20", autoBlock: true } },
  ];
  const balances = [
    { tenantId: "t1", restaurantId: "r1", balanceCents: -29990 },
    { tenantId: "t2", restaurantId: "r2", balanceCents: -29990 },
    { tenantId: "t3", restaurantId: "r3", balanceCents: -29990 },
    { tenantId: "t4", restaurantId: "r4", balanceCents: 0 },
  ];
  const suspended = [];
  const cleared = [];
  const audited = [];
  const summary = await runBillingEnforcement({
    now,
    deps: {
      listRestaurantBilling: async () => contracts,
      listRestaurantBalances: async () => balances,
      updateRestaurantPlatformRecord: async (payload) => {
        suspended.push(payload);
        return { restaurant: { tenantId: "x", restaurantId: "y" } };
      },
      setRestaurantBillingGrace: async (key, grace) => cleared.push([key, grace]),
    },
    audit: async (event) => audited.push(event),
  });
  assert.deepEqual(summary.blocked, ["vencido-auto"]);
  assert.deepEqual(summary.graceCleared, ["pagou"]);
  assert.equal(suspended[0].accessStatus, "SUSPENDED");
  assert.equal(suspended[0].billingBlock, true);
  assert.match(suspended[0].reason, /20\/11\/2026/);
  assert.deepEqual(cleared, [["pagou", null]]);
  assert.equal(audited.length, 1);
});
