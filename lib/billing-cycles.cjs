"use strict";

// Ciclos de cobrança da mensalidade INOVAS:
//   Mensal      sem desconto
//   Trimestral  R$ 5 a menos por mês  -> R$ 15 de desconto no total
//   Semestral   R$ 5 a menos por mês  -> R$ 30 de desconto no total
//   Anual       8% de desconto no total
// Valores em centavos.

const BILLING_CYCLES = Object.freeze({
  MONTHLY: Object.freeze({ key: "MONTHLY", label: "Mensal", months: 1 }),
  QUARTERLY: Object.freeze({ key: "QUARTERLY", label: "Trimestral", months: 3 }),
  SEMIANNUAL: Object.freeze({ key: "SEMIANNUAL", label: "Semestral", months: 6 }),
  ANNUAL: Object.freeze({ key: "ANNUAL", label: "Anual", months: 12 }),
});

const normalizeBillingCycle = (value) => {
  const key = String(value || "").trim().toUpperCase();
  return BILLING_CYCLES[key] ? key : "MONTHLY";
};

const computeCycleCharge = (monthlyValueCents, cycleKey) => {
  const cycle = BILLING_CYCLES[normalizeBillingCycle(cycleKey)];
  const monthly = Math.max(0, Math.round(Number(monthlyValueCents) || 0));
  const grossCents = monthly * cycle.months;
  let discountCents = 0;
  if (cycle.key === "QUARTERLY" || cycle.key === "SEMIANNUAL") discountCents = 500 * cycle.months;
  if (cycle.key === "ANNUAL") discountCents = Math.round(grossCents * 0.08);
  discountCents = Math.min(discountCents, grossCents);
  return {
    cycle: cycle.key,
    label: cycle.label,
    months: cycle.months,
    grossCents,
    discountCents,
    totalCents: grossCents - discountCents,
    perMonthCents: Math.round((grossCents - discountCents) / cycle.months),
  };
};

// Mês (AAAA-MM) é início de um período do ciclo? Os períodos contam a partir
// do mês-âncora (quando o ciclo começou). Devolve a chave do período ou "".
const monthsBetween = (fromKey, toKey) => {
  const [fy, fm] = fromKey.split("-").map(Number);
  const [ty, tm] = toKey.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
};

const cyclePeriodFor = (cycleKey, anchorMonthKey, monthKey) => {
  const cycle = BILLING_CYCLES[normalizeBillingCycle(cycleKey)];
  const anchor = /^\d{4}-\d{2}$/.test(String(anchorMonthKey || "")) ? anchorMonthKey : monthKey;
  const diff = monthsBetween(anchor, monthKey);
  if (diff < 0 || diff % cycle.months !== 0) return "";
  return `${cycle.key}:${anchor}:${diff / cycle.months}`;
};

module.exports = {
  BILLING_CYCLES,
  computeCycleCharge,
  cyclePeriodFor,
  normalizeBillingCycle,
};
