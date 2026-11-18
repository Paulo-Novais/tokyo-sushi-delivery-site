"use strict";

// Repasse semanal (modelo iFood): extrato do restaurante e valor a repassar.
// Tudo em centavos (inteiros) para não errar arredondamento.
//
// Semana: segunda 00:00 até domingo 23:59 (horário de Brasília, UTC-3; o
// Brasil não tem horário de verão desde 2019). O repasse da semana sai no dia
// configurado da semana seguinte (INOVAS_PAYOUT_WEEKDAY: 1=segunda ... 7=domingo;
// padrão 3 = quarta-feira, como o iFood).
//
// Valor do repasse = vendas online − taxas do pagamento − devoluções −
// contestações − mensalidade INOVAS − outros débitos + créditos/ajustes
// + saldo devedor da semana anterior (se houver).
// Se der negativo, nada é repassado e o saldo devedor passa para a semana
// seguinte (aparece discriminado no próximo extrato).

const { getOnlinePaymentMethod, ONLINE_PAYMENT_METHODS } = require("./payment-methods.cjs");

const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// sign: +1 entra para o restaurante, -1 sai.
const ENTRY_TYPES = Object.freeze({
  SALE: Object.freeze({ sign: 1, label: "Venda online" }),
  PROCESSING_FEE: Object.freeze({ sign: -1, label: "Taxa do pagamento" }),
  REFUND: Object.freeze({ sign: -1, label: "Devolução ao cliente" }),
  CHARGEBACK: Object.freeze({ sign: -1, label: "Contestação do cliente (chargeback)" }),
  SUBSCRIPTION: Object.freeze({ sign: -1, label: "Mensalidade INOVAS" }),
  DEBT: Object.freeze({ sign: -1, label: "Débito do restaurante" }),
  CREDIT: Object.freeze({ sign: 1, label: "Crédito / ajuste a favor" }),
});

const isEntryType = (value) => Object.prototype.hasOwnProperty.call(ENTRY_TYPES, String(value || ""));

const toCents = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(Math.abs(number));
};

// Valor com sinal pelo tipo (o valor guardado é sempre positivo).
const signedAmount = (entry) => ENTRY_TYPES[entry.type].sign * toCents(entry.amountCents);

const readPayoutWeekday = () => {
  const value = Number(process.env.INOVAS_PAYOUT_WEEKDAY || 3);
  return Number.isInteger(value) && value >= 1 && value <= 7 ? value : 3;
};

const formatLocalDate = (utcMs) => new Date(utcMs + BRT_OFFSET_MS).toISOString().slice(0, 10);

// Semana (segunda a domingo, horário de Brasília) que contém a data.
const getWeekPeriod = (dateLike = new Date(), { payoutWeekday = readPayoutWeekday() } = {}) => {
  const time = new Date(dateLike).getTime();
  if (!Number.isFinite(time)) throw new Error("Data invalida para o periodo do repasse.");
  const local = new Date(time + BRT_OFFSET_MS);
  const dayIndex = (local.getUTCDay() + 6) % 7; // segunda = 0
  const localMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const startMs = localMidnight - dayIndex * DAY_MS - BRT_OFFSET_MS;
  const endMs = startMs + 7 * DAY_MS;
  return {
    weekKey: formatLocalDate(startMs),
    periodStart: new Date(startMs).toISOString(),
    periodEnd: new Date(endMs).toISOString(), // exclusivo (segunda seguinte 00:00)
    lastDay: formatLocalDate(endMs - DAY_MS),
    payoutDate: formatLocalDate(endMs + (payoutWeekday - 1) * DAY_MS),
  };
};

const getWeekPeriodByKey = (weekKey, options) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(weekKey || ""))) {
    throw new Error("Semana invalida (use AAAA-MM-DD da segunda-feira).");
  }
  return getWeekPeriod(`${weekKey}T12:00:00-03:00`, options);
};

const methodLabel = (methodId) => getOnlinePaymentMethod(methodId)?.shortLabel || "Outros";

const inPeriod = (entry, period) => {
  const time = new Date(entry.occurredAt).getTime();
  return time >= new Date(period.periodStart).getTime() && time < new Date(period.periodEnd).getTime();
};

const buildWeeklyStatement = ({ entries = [], period, openingBalanceCents = 0 }) => {
  if (!period?.periodStart) throw new Error("Periodo do repasse obrigatorio.");
  const weekEntries = entries
    .filter((entry) => isEntryType(entry.type) && inPeriod(entry, period))
    .sort((left, right) => new Date(left.occurredAt) - new Date(right.occurredAt));

  // Vendas por forma de pagamento (quantidade, bruto, taxa).
  const byMethod = new Map(
    ONLINE_PAYMENT_METHODS.map((method) => [method.id, { method: method.id, label: method.shortLabel, count: 0, grossCents: 0, feeCents: 0 }])
  );
  const methodBucket = (methodId) => {
    const key = byMethod.has(methodId) ? methodId : "other";
    if (!byMethod.has(key)) byMethod.set(key, { method: key, label: "Outros", count: 0, grossCents: 0, feeCents: 0 });
    return byMethod.get(key);
  };
  const orders = new Map();
  const orderRow = (entry) => {
    const key = entry.orderId || entry.paymentId || entry.id;
    if (!orders.has(key)) {
      orders.set(key, {
        orderId: entry.orderId || "",
        orderPublicId: entry.orderPublicId || "",
        method: entry.method || "",
        methodLabel: methodLabel(entry.method),
        occurredAt: entry.occurredAt,
        grossCents: 0,
        feeCents: 0,
        refundCents: 0,
        netCents: 0,
      });
    }
    return orders.get(key);
  };

  const deductions = []; // linhas discriminadas (devoluções, débitos, mensalidade...)
  const totals = {
    grossSalesCents: 0,
    feesCents: 0,
    refundsCents: 0,
    chargebacksCents: 0,
    subscriptionCents: 0,
    debtsCents: 0,
    creditsCents: 0,
  };

  for (const entry of weekEntries) {
    const amount = toCents(entry.amountCents);
    if (entry.type === "SALE") {
      const bucket = methodBucket(entry.method);
      bucket.count += 1;
      bucket.grossCents += amount;
      totals.grossSalesCents += amount;
      const row = orderRow(entry);
      row.grossCents += amount;
      row.occurredAt = entry.occurredAt;
    } else if (entry.type === "PROCESSING_FEE") {
      methodBucket(entry.method).feeCents += amount;
      totals.feesCents += amount;
      if (entry.orderId || entry.paymentId) orderRow(entry).feeCents += amount;
    } else {
      const field = {
        REFUND: "refundsCents",
        CHARGEBACK: "chargebacksCents",
        SUBSCRIPTION: "subscriptionCents",
        DEBT: "debtsCents",
        CREDIT: "creditsCents",
      }[entry.type];
      totals[field] += amount;
      if ((entry.type === "REFUND" || entry.type === "CHARGEBACK") && (entry.orderId || entry.paymentId)) {
        orderRow(entry).refundCents += amount;
      }
      deductions.push({
        type: entry.type,
        label: ENTRY_TYPES[entry.type].label,
        description: String(entry.description || ""),
        orderPublicId: entry.orderPublicId || "",
        occurredAt: entry.occurredAt,
        amountCents: signedAmount(entry),
      });
    }
  }

  const opening = Math.min(0, Math.round(Number(openingBalanceCents) || 0));
  const netCents =
    totals.grossSalesCents -
    totals.feesCents -
    totals.refundsCents -
    totals.chargebacksCents -
    totals.subscriptionCents -
    totals.debtsCents +
    totals.creditsCents +
    opening;

  // Extrato discriminado, na ordem em que o restaurante lê.
  const methods = [...byMethod.values()].filter((bucket) => bucket.count || bucket.feeCents);
  const lines = [];
  if (opening < 0) {
    lines.push({ type: "OPENING_BALANCE", label: "Saldo devedor da semana anterior", amountCents: opening });
  }
  for (const bucket of methods) {
    lines.push({
      type: "SALE",
      label: `Vendas ${bucket.label} (${bucket.count} pedido${bucket.count === 1 ? "" : "s"})`,
      amountCents: bucket.grossCents,
    });
  }
  for (const bucket of methods) {
    if (bucket.feeCents) {
      lines.push({ type: "PROCESSING_FEE", label: `Taxa ${bucket.label}`, amountCents: -bucket.feeCents });
    }
  }
  for (const deduction of deductions) {
    lines.push({
      type: deduction.type,
      label: [deduction.label, deduction.description, deduction.orderPublicId ? `pedido ${deduction.orderPublicId}` : ""]
        .filter(Boolean)
        .join(" · "),
      amountCents: deduction.amountCents,
      occurredAt: deduction.occurredAt,
    });
  }

  const orderRows = [...orders.values()]
    .map((row) => ({ ...row, netCents: row.grossCents - row.feeCents - row.refundCents }))
    .sort((left, right) => new Date(left.occurredAt) - new Date(right.occurredAt));

  return {
    period,
    openingBalanceCents: opening,
    totals,
    methods,
    lines,
    orders: orderRows,
    netCents,
    payoutCents: Math.max(0, netCents),
    carryOverCents: Math.min(0, netCents),
  };
};

const formatBRL = (cents) =>
  (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

module.exports = {
  ENTRY_TYPES,
  buildWeeklyStatement,
  formatBRL,
  getWeekPeriod,
  getWeekPeriodByKey,
  isEntryType,
  signedAmount,
};
