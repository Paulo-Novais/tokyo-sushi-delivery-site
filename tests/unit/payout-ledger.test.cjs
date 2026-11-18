// Repasse semanal (modelo iFood): extrato discriminado e valor a repassar.
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildWeeklyStatement,
  getWeekPeriod,
  getWeekPeriodByKey,
} = require("../../lib/payout-ledger.cjs");
const { estimateProcessingFeeCents, isOnlinePaymentMethod } = require("../../lib/payment-methods.cjs");

test("semana de segunda a domingo (Brasília) e repasse na quarta seguinte", () => {
  // Domingo 23:30 em Brasília = segunda 02:30 UTC: ainda é a semana anterior.
  const sunday = getWeekPeriod("2026-11-23T02:30:00Z", { payoutWeekday: 3 });
  assert.equal(sunday.weekKey, "2026-11-16");
  assert.equal(sunday.lastDay, "2026-11-22");
  assert.equal(sunday.payoutDate, "2026-11-25");
  assert.equal(sunday.periodStart, "2026-11-16T03:00:00.000Z");
  assert.equal(sunday.periodEnd, "2026-11-23T03:00:00.000Z");
  // Segunda 00:10 em Brasília já é a semana nova.
  assert.equal(getWeekPeriod("2026-11-23T03:10:00Z").weekKey, "2026-11-23");
  assert.equal(getWeekPeriodByKey("2026-11-16").weekKey, "2026-11-16");
  assert.throws(() => getWeekPeriodByKey("16/11/2026"));
});

const period = getWeekPeriodByKey("2026-11-16", { payoutWeekday: 3 });
const at = (day, hour = 20) => `2026-11-${String(day).padStart(2, "0")}T${hour}:00:00-03:00`;

test("extrato: vendas por forma, taxas, devolução, mensalidade e débito discriminados", () => {
  const entries = [
    { type: "SALE", method: "pix", amountCents: 10000, orderId: "o1", orderPublicId: "#101", occurredAt: at(16) },
    { type: "PROCESSING_FEE", method: "pix", amountCents: 99, orderId: "o1", occurredAt: at(16) },
    { type: "SALE", method: "credit_card", amountCents: 20000, orderId: "o2", orderPublicId: "#102", occurredAt: at(17) },
    { type: "PROCESSING_FEE", method: "credit_card", amountCents: 698, orderId: "o2", occurredAt: at(17) },
    { type: "SALE", method: "meal_voucher", amountCents: 5000, orderId: "o3", orderPublicId: "#103", occurredAt: at(18) },
    { type: "PROCESSING_FEE", method: "meal_voucher", amountCents: 300, orderId: "o3", occurredAt: at(18) },
    { type: "REFUND", amountCents: 5000, orderId: "o3", orderPublicId: "#103", description: "Pedido cancelado", occurredAt: at(19) },
    { type: "SUBSCRIPTION", amountCents: 14990, description: "Novembro/2026", occurredAt: at(20) },
    { type: "DEBT", amountCents: 1000, description: "Taxa de adesão (parcela 1/3)", occurredAt: at(20) },
    { type: "CREDIT", amountCents: 500, description: "Ajuste de taxa", occurredAt: at(21) },
    // Fora da semana: ignorado.
    { type: "SALE", method: "pix", amountCents: 99999, occurredAt: "2026-11-23T03:00:00Z" },
  ];
  const statement = buildWeeklyStatement({ entries, period });
  assert.equal(statement.totals.grossSalesCents, 35000);
  assert.equal(statement.totals.feesCents, 1097);
  assert.equal(statement.totals.refundsCents, 5000);
  assert.equal(statement.totals.subscriptionCents, 14990);
  assert.equal(statement.totals.debtsCents, 1000);
  assert.equal(statement.totals.creditsCents, 500);
  // 35000 - 1097 - 5000 - 14990 - 1000 + 500
  assert.equal(statement.netCents, 13413);
  assert.equal(statement.payoutCents, 13413);
  assert.equal(statement.carryOverCents, 0);

  const pix = statement.methods.find((method) => method.method === "pix");
  assert.deepEqual(pix, { method: "pix", label: "Pix", count: 1, grossCents: 10000, feeCents: 99 });
  const labels = statement.lines.map((line) => line.label);
  assert.ok(labels.includes("Vendas Crédito (1 pedido)"));
  assert.ok(labels.includes("Taxa VR/VA"));
  assert.ok(labels.some((label) => label.startsWith("Devolução ao cliente · Pedido cancelado · pedido #103")));
  assert.ok(labels.includes("Mensalidade INOVAS · Novembro/2026"));
  assert.ok(labels.includes("Débito do restaurante · Taxa de adesão (parcela 1/3)"));
  // A soma das linhas fecha com o valor do repasse.
  assert.equal(statement.lines.reduce((sum, line) => sum + line.amountCents, 0), statement.netCents);

  // Por pedido: bruto, taxa, devolução e líquido.
  const o3 = statement.orders.find((row) => row.orderId === "o3");
  assert.deepEqual(
    { gross: o3.grossCents, fee: o3.feeCents, refund: o3.refundCents, net: o3.netCents },
    { gross: 5000, fee: 300, refund: 5000, net: -300 }
  );
});

test("débitos maiores que as vendas: não repassa e leva o saldo devedor para a próxima semana", () => {
  const week1 = buildWeeklyStatement({
    period,
    entries: [
      { type: "SALE", method: "pix", amountCents: 5000, occurredAt: at(16) },
      { type: "SUBSCRIPTION", amountCents: 14990, occurredAt: at(17) },
    ],
  });
  assert.equal(week1.payoutCents, 0);
  assert.equal(week1.carryOverCents, -9990);

  const nextPeriod = getWeekPeriodByKey("2026-11-23", { payoutWeekday: 3 });
  const week2 = buildWeeklyStatement({
    period: nextPeriod,
    openingBalanceCents: week1.carryOverCents,
    entries: [{ type: "SALE", method: "credit_card", amountCents: 30000, occurredAt: "2026-11-24T20:00:00-03:00" }],
  });
  assert.equal(week2.lines[0].label, "Saldo devedor da semana anterior");
  assert.equal(week2.lines[0].amountCents, -9990);
  assert.equal(week2.payoutCents, 20010);
});

test("saldo inicial positivo é ignorado (positivo sempre é repassado na semana)", () => {
  const statement = buildWeeklyStatement({ period, entries: [], openingBalanceCents: 5000 });
  assert.equal(statement.netCents, 0);
  assert.equal(statement.lines.length, 0);
});

test("valores negativos ou quebrados no lançamento não invertem o sinal", () => {
  const statement = buildWeeklyStatement({
    period,
    entries: [
      { type: "SALE", method: "pix", amountCents: -1000.4, occurredAt: at(16) },
      { type: "DEBT", amountCents: -200, occurredAt: at(16) },
      { type: "INVALIDO", amountCents: 999, occurredAt: at(16) },
    ],
  });
  assert.equal(statement.netCents, 800);
});

test("formas de pagamento online e taxa estimada só com configuração", () => {
  for (const method of ["pix", "credit_card", "debit_card", "meal_voucher"]) {
    assert.equal(isOnlinePaymentMethod(method), true);
  }
  assert.equal(isOnlinePaymentMethod("dinheiro"), false);
  const saved = process.env.INOVAS_PAYMENT_FEE_ESTIMATES;
  try {
    delete process.env.INOVAS_PAYMENT_FEE_ESTIMATES;
    assert.equal(estimateProcessingFeeCents("pix", 10000), null);
    process.env.INOVAS_PAYMENT_FEE_ESTIMATES = JSON.stringify({ credit_card: { percentBps: 349, fixedCents: 50 } });
    assert.equal(estimateProcessingFeeCents("credit_card", 10000), 399);
    assert.equal(estimateProcessingFeeCents("pix", 10000), null);
  } finally {
    if (saved === undefined) delete process.env.INOVAS_PAYMENT_FEE_ESTIMATES;
    else process.env.INOVAS_PAYMENT_FEE_ESTIMATES = saved;
  }
});

test("taxa INOVAS (1,5%): linha própria, por pedido e descontada do repasse", () => {
  const { computePlatformFeeCents } = require("../../lib/payout-ledger.cjs");
  assert.equal(computePlatformFeeCents(10000), 150);
  assert.equal(computePlatformFeeCents(5850), 88);
  const statement = buildWeeklyStatement({
    period,
    entries: [
      { type: "SALE", method: "credit_card", amountCents: 10000, orderId: "o9", occurredAt: at(16) },
      { type: "PROCESSING_FEE", method: "credit_card", amountCents: 349, orderId: "o9", occurredAt: at(16) },
      { type: "PLATFORM_FEE", amountCents: 150, orderId: "o9", occurredAt: at(16) },
    ],
  });
  assert.equal(statement.totals.platformFeesCents, 150);
  assert.equal(statement.netCents, 10000 - 349 - 150);
  assert.ok(statement.lines.some((line) => line.label === "Taxa INOVAS (1,5% das vendas online)" && line.amountCents === -150));
  assert.equal(statement.orders[0].platformFeeCents, 150);
  assert.equal(statement.orders[0].netCents, 9501);
});

test("divisão na Stone: taxa INOVAS vai direto para o recebedor da INOVAS", () => {
  const { buildSplit } = require("../../lib/payment-provider.cjs");
  const saved = process.env.PAGARME_PLATFORM_RECIPIENT_ID;
  try {
    delete process.env.PAGARME_PLATFORM_RECIPIENT_ID;
    assert.deepEqual(buildSplit({ amountCents: 10000, recipientId: "re_rest", platformFeeCents: 150 }).map((rule) => [rule.recipient_id, rule.type, rule.amount]), [["re_rest", "percentage", 100]]);
    process.env.PAGARME_PLATFORM_RECIPIENT_ID = "re_inovas";
    const split = buildSplit({ amountCents: 10000, recipientId: "re_rest", platformFeeCents: 150 });
    assert.deepEqual(split.map((rule) => [rule.recipient_id, rule.type, rule.amount]), [["re_rest", "flat", 9850], ["re_inovas", "flat", 150]]);
    assert.equal(split[0].options.charge_processing_fee, true);
    assert.equal(split[1].options.charge_processing_fee, false);
  } finally {
    if (saved === undefined) delete process.env.PAGARME_PLATFORM_RECIPIENT_ID;
    else process.env.PAGARME_PLATFORM_RECIPIENT_ID = saved;
  }
});
