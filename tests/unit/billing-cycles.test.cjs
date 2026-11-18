// Ciclos de cobrança da mensalidade: descontos e quando cobrar.
const test = require("node:test");
const assert = require("node:assert/strict");
const { computeCycleCharge, cyclePeriodFor, normalizeBillingCycle } = require("../../lib/billing-cycles.cjs");

test("descontos: trimestral -R$15, semestral -R$30, anual -8%", () => {
  assert.deepEqual(computeCycleCharge(19900, "MONTHLY"), { cycle: "MONTHLY", label: "Mensal", months: 1, grossCents: 19900, discountCents: 0, totalCents: 19900, perMonthCents: 19900 });
  assert.equal(computeCycleCharge(19900, "QUARTERLY").totalCents, 59700 - 1500);
  assert.equal(computeCycleCharge(19900, "QUARTERLY").perMonthCents, 19400);
  assert.equal(computeCycleCharge(19900, "SEMIANNUAL").totalCents, 119400 - 3000);
  const annual = computeCycleCharge(19900, "ANNUAL");
  assert.equal(annual.grossCents, 238800);
  assert.equal(annual.discountCents, 19104);
  assert.equal(annual.totalCents, 219696);
  assert.equal(normalizeBillingCycle("qualquer"), "MONTHLY");
});

test("quando cobrar: só no início de cada período do ciclo", () => {
  assert.equal(cyclePeriodFor("MONTHLY", "", "2026-12"), "MONTHLY:2026-12:0");
  assert.equal(cyclePeriodFor("QUARTERLY", "2026-11", "2026-11"), "QUARTERLY:2026-11:0");
  assert.equal(cyclePeriodFor("QUARTERLY", "2026-11", "2026-12"), "");
  assert.equal(cyclePeriodFor("QUARTERLY", "2026-11", "2027-02"), "QUARTERLY:2026-11:1");
  assert.equal(cyclePeriodFor("SEMIANNUAL", "2026-11", "2027-05"), "SEMIANNUAL:2026-11:1");
  assert.equal(cyclePeriodFor("ANNUAL", "2026-11", "2027-10"), "");
  assert.equal(cyclePeriodFor("ANNUAL", "2026-11", "2027-11"), "ANNUAL:2026-11:1");
});
