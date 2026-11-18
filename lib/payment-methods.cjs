"use strict";

// Pagamento online (modelo iFood): formas aceitas no site/app e a regra de
// taxa de cada uma. A taxa cobrada do restaurante é a taxa REAL do provedor
// de pagamento (repassada sem margem): a INOVAS ganha só a mensalidade.
//
// Os percentuais abaixo NÃO são preço: servem só de previsão até o provedor
// informar a taxa exata de cada pagamento (o extrato usa a taxa informada).
// Configuração: INOVAS_PAYMENT_FEE_ESTIMATES (JSON), por exemplo
//   {"pix":{"percentBps":99},"credit_card":{"percentBps":349,"fixedCents":0}}
// (percentBps = centésimos de 1%: 99 = 0,99%).

const ONLINE_PAYMENT_METHODS = Object.freeze([
  Object.freeze({ id: "pix", label: "Pix", shortLabel: "Pix" }),
  Object.freeze({ id: "credit_card", label: "Cartão de crédito", shortLabel: "Crédito" }),
  Object.freeze({ id: "debit_card", label: "Cartão de débito", shortLabel: "Débito" }),
  Object.freeze({
    id: "meal_voucher",
    label: "Vale-refeição / alimentação (VR, VA)",
    shortLabel: "VR/VA",
  }),
]);

const METHOD_IDS = new Set(ONLINE_PAYMENT_METHODS.map((method) => method.id));

const isOnlinePaymentMethod = (value) => METHOD_IDS.has(String(value || ""));

const getOnlinePaymentMethod = (value) =>
  ONLINE_PAYMENT_METHODS.find((method) => method.id === String(value || "")) || null;

const toNonNegativeInteger = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
};

const readFeeEstimates = () => {
  const raw = String(process.env.INOVAS_PAYMENT_FEE_ESTIMATES || "").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

// Taxa estimada (centavos) de um pagamento. Sem configuração: null (o extrato
// mostra "a confirmar" até o provedor informar a taxa real).
const estimateProcessingFeeCents = (methodId, amountCents) => {
  if (!isOnlinePaymentMethod(methodId)) return null;
  const rule = readFeeEstimates()[methodId];
  if (!rule) return null;
  const percentBps = toNonNegativeInteger(rule.percentBps);
  const fixedCents = toNonNegativeInteger(rule.fixedCents);
  const amount = toNonNegativeInteger(amountCents);
  return Math.round((amount * percentBps) / 10000) + fixedCents;
};

module.exports = {
  ONLINE_PAYMENT_METHODS,
  estimateProcessingFeeCents,
  getOnlinePaymentMethod,
  isOnlinePaymentMethod,
};
