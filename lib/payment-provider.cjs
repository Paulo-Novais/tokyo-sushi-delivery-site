"use strict";

// Provedor de pagamento online.
//
// - "pagarme": Pagar.me (Stone) API Core v5. O cliente paga no checkout
//   hospedado da Pagar.me (os dados do cartão nunca passam pelo nosso
//   servidor). Divisão (split): 100% para o recebedor do restaurante, que paga
//   a taxa do meio de pagamento. Chaves só em variáveis da Vercel:
//     PAGARME_SECRET_KEY        chave secreta (sk_test_... ou sk_...)
//     PAGARME_API_URL           opcional (padrão https://api.pagar.me/core/v5)
//     PAGARME_WEBHOOK_TOKEN     token secreto que vai na URL do aviso
//     PAGARME_CHECKOUT_METHODS  opcional: "credit_card,debit_card,pix,voucher"
// - "fake": provedor de teste (só fora de produção). Simula o checkout e o
//   aviso de pagamento para testar o fluxo inteiro sem a Stone.
//
// Sem configuração: pagamento online desligado (o site segue como hoje).
//
// Segurança: o aviso (webhook) nunca é confiado sozinho — o servidor consulta
// o pedido na Pagar.me com a chave secreta antes de confirmar o pagamento.

const crypto = require("node:crypto");
const { buildHttpError } = require("./http.cjs");

const METHOD_TO_PAGARME = Object.freeze({
  pix: "pix",
  credit_card: "credit_card",
  debit_card: "debit_card",
  meal_voucher: "voucher",
});
const PAGARME_TO_METHOD = Object.freeze(
  Object.fromEntries(Object.entries(METHOD_TO_PAGARME).map(([key, value]) => [value, key]))
);

const getProviderName = () => {
  const explicit = String(process.env.INOVAS_PAYMENT_PROVIDER || "").trim().toLowerCase();
  if (explicit === "fake") {
    return process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production" ? "" : "fake";
  }
  if (explicit === "off") return "";
  if (String(process.env.PAGARME_SECRET_KEY || "").trim()) return "pagarme";
  return "";
};

const isOnlinePaymentEnabled = () => Boolean(getProviderName());

const getEnabledMethods = () => {
  const provider = getProviderName();
  if (!provider) return [];
  if (provider === "fake") return Object.keys(METHOD_TO_PAGARME);
  const configured = String(process.env.PAGARME_CHECKOUT_METHODS || "credit_card,debit_card,pix")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return Object.keys(METHOD_TO_PAGARME).filter((method) => configured.includes(METHOD_TO_PAGARME[method]));
};

const assertWebhookToken = (token) => {
  const expected = String(process.env.PAGARME_WEBHOOK_TOKEN || "").trim();
  const given = String(token || "");
  if (getProviderName() === "fake") return;
  if (!expected || expected.length < 16) {
    throw buildHttpError(503, "Aviso de pagamento nao configurado.", "payment_webhook_not_configured");
  }
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw buildHttpError(401, "Aviso de pagamento recusado.", "payment_webhook_unauthorized");
  }
};

/* ---------------- Pagar.me ---------------- */

const pagarmeRequest = async (method, path, body) => {
  const baseUrl = String(process.env.PAGARME_API_URL || "https://api.pagar.me/core/v5").replace(/\/+$/, "");
  const secret = String(process.env.PAGARME_SECRET_KEY || "").trim();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    // Não repassa a resposta bruta (pode conter dados do cliente).
    const error = buildHttpError(
      response.status >= 500 ? 502 : 422,
      "O provedor de pagamento recusou a operacao.",
      "payment_provider_error",
      { providerStatus: response.status, providerMessage: String(payload?.message || "").slice(0, 200) }
    );
    throw error;
  }
  return payload || {};
};

// Status do pedido na Pagar.me -> status interno.
const mapPagarmeStatus = (order = {}) => {
  const status = String(order.status || "").toLowerCase();
  const charge = Array.isArray(order.charges) ? order.charges[0] || {} : {};
  const chargeStatus = String(charge.status || "").toLowerCase();
  if (chargeStatus === "refunded") return "REFUNDED";
  if (status === "paid" || chargeStatus === "paid") return "PAID";
  if (["canceled", "failed"].includes(status) || ["failed", "canceled"].includes(chargeStatus)) return "FAILED";
  return "PENDING";
};

const describePagarmeOrder = (order = {}) => {
  const charge = Array.isArray(order.charges) ? order.charges[0] || {} : {};
  const transaction = charge.last_transaction || {};
  const method = PAGARME_TO_METHOD[String(charge.payment_method || "").toLowerCase()] || "";
  // Taxa real cobrada: a Pagar.me informa no split/recebível; quando não vem
  // na consulta, fica nula e o extrato usa a estimativa configurada.
  const feeCandidates = [
    transaction?.split?.[0]?.fee,
    charge?.fee,
    transaction?.fee,
  ].map((value) => Number(value)).filter((value) => Number.isFinite(value) && value >= 0);
  return {
    providerOrderId: String(order.id || ""),
    providerChargeId: String(charge.id || ""),
    status: mapPagarmeStatus(order),
    method,
    paidAmountCents: Number(charge.paid_amount || charge.amount || order.amount || 0),
    feeCents: feeCandidates.length ? Math.round(feeCandidates[0]) : null,
    checkoutUrl: String(order.checkouts?.[0]?.payment_url || ""),
  };
};

// Divisão do pagamento: a taxa INOVAS vai direto para o recebedor da INOVAS
// (PAGARME_PLATFORM_RECIPIENT_ID); o resto para o restaurante, que paga a
// taxa do meio de pagamento. Sem recebedor INOVAS: 100% para o restaurante
// (a taxa fica descontada no repasse semanal).
const buildSplit = ({ amountCents, recipientId, platformFeeCents }) => {
  const platformRecipient = String(process.env.PAGARME_PLATFORM_RECIPIENT_ID || "").trim();
  const fee = Math.max(0, Math.min(Math.round(platformFeeCents || 0), amountCents - 1));
  if (!platformRecipient || fee <= 0) {
    return [
      {
        amount: 100,
        recipient_id: recipientId,
        type: "percentage",
        options: { charge_processing_fee: true, charge_remainder_fee: true, liable: true },
      },
    ];
  }
  return [
    {
      amount: amountCents - fee,
      recipient_id: recipientId,
      type: "flat",
      options: { charge_processing_fee: true, charge_remainder_fee: true, liable: true },
    },
    {
      amount: fee,
      recipient_id: platformRecipient,
      type: "flat",
      options: { charge_processing_fee: false, charge_remainder_fee: false, liable: false },
    },
  ];
};

const pagarmeProvider = {
  name: "pagarme",
  async createCheckout({ payment, order, customer, recipientId, successUrl, platformFeeCents = 0 }) {
    if (!recipientId) {
      throw buildHttpError(409, "Pagamento online nao ativado para este restaurante.", "payment_recipient_missing");
    }
    const accepted = getEnabledMethods().map((method) => METHOD_TO_PAGARME[method]);
    const phone = String(customer.phone || "").replace(/\D/g, "");
    const created = await pagarmeRequest("POST", "/orders", {
      code: payment.id,
      closed: true,
      items: [
        {
          amount: payment.amountCents,
          description: `Pedido ${order.restaurantName || ""}`.trim().slice(0, 250),
          quantity: 1,
          code: payment.id,
        },
      ],
      customer: {
        name: String(customer.name || "Cliente").slice(0, 64),
        type: "individual",
        ...(customer.email ? { email: customer.email } : {}),
        ...(phone.length >= 10
          ? { phones: { mobile_phone: { country_code: "55", area_code: phone.slice(-11, -9) || phone.slice(0, 2), number: phone.slice(-9) } } }
          : {}),
      },
      payments: [
        {
          payment_method: "checkout",
          amount: payment.amountCents,
          checkout: {
            expires_in: 30 * 60,
            billing_address_editable: false,
            customer_editable: true,
            accepted_payment_methods: accepted,
            success_url: successUrl,
            skip_checkout_success_page: true,
            ...(accepted.includes("pix") ? { pix: { expires_in: 30 * 60 } } : {}),
            ...(accepted.includes("credit_card") ? { credit_card: { installments: [{ number: 1, total: payment.amountCents }] } } : {}),
          },
          split: buildSplit({ amountCents: payment.amountCents, recipientId, platformFeeCents }),
        },
      ],
      metadata: { inovas_payment_id: payment.id, restaurant_key: order.restaurantKey || "" },
    });
    const described = describePagarmeOrder(created);
    if (!described.checkoutUrl) {
      throw buildHttpError(502, "O provedor nao devolveu o link de pagamento.", "payment_checkout_missing");
    }
    return described;
  },
  async getOrder(providerOrderId) {
    return describePagarmeOrder(await pagarmeRequest("GET", `/orders/${encodeURIComponent(providerOrderId)}`));
  },
  async refund({ providerChargeId, amountCents }) {
    const refunded = await pagarmeRequest("DELETE", `/charges/${encodeURIComponent(providerChargeId)}`, {
      amount: amountCents,
    });
    return { status: String(refunded.status || "").toLowerCase() === "refunded" ? "REFUNDED" : "PENDING" };
  },
  async transfer({ recipientId, amountCents }) {
    const transfer = await pagarmeRequest("POST", `/recipients/${encodeURIComponent(recipientId)}/transfers`, {
      amount: amountCents,
    });
    return { transferId: String(transfer.id || ""), status: String(transfer.status || "") };
  },
  // Cria o recebedor do restaurante (para onde vai o dinheiro das vendas).
  // A Pagar.me pode pedir dados extras de cadastro (KYC); nesse caso o
  // recebedor fica "em análise" e a INOVAS completa no painel deles.
  async createRecipient(account) {
    const isCompany = account.holderDocument.length === 14;
    const created = await pagarmeRequest("POST", "/recipients", {
      code: `${account.restaurantKey}`.slice(0, 52),
      register_information: {
        type: isCompany ? "corporation" : "individual",
        document: account.holderDocument,
        email: account.holderEmail,
        ...(isCompany ? { company_name: account.holderName, trading_name: account.holderName } : { name: account.holderName }),
        phone_numbers: account.holderPhone
          ? [{ ddd: account.holderPhone.slice(0, 2), number: account.holderPhone.slice(2), type: "mobile" }]
          : [],
      },
      default_bank_account: {
        holder_name: account.holderName.slice(0, 30),
        holder_type: isCompany ? "company" : "individual",
        holder_document: account.holderDocument,
        bank: account.bankCode,
        branch_number: account.branchNumber,
        ...(account.branchCheckDigit ? { branch_check_digit: account.branchCheckDigit } : {}),
        account_number: account.accountNumber,
        account_check_digit: account.accountCheckDigit,
        type: account.accountType === "savings" ? "savings" : "checking",
      },
      // O repasse semanal é feito pela rotina da INOVAS (já com os descontos).
      transfer_settings: { transfer_enabled: false },
    });
    const status = String(created.status || "").toLowerCase();
    return {
      recipientId: String(created.id || ""),
      status: status === "active" ? "ACTIVE" : status === "refused" ? "REFUSED" : "PENDING",
    };
  },
  // O aviso só informa QUAL pedido mudou; o status vem da consulta.
  extractProviderOrderId(body = {}) {
    const data = body?.data || {};
    return String(data.order?.id || (String(data.id || "").startsWith("or_") ? data.id : "") || "");
  },
};

/* ---------------- Provedor de teste ---------------- */

const fakeOrders = new Map();

const fakeProvider = {
  name: "fake",
  async createCheckout({ payment, recipientId, successUrl }) {
    const providerOrderId = `fake_or_${payment.id}`;
    fakeOrders.set(providerOrderId, {
      providerOrderId,
      providerChargeId: `fake_ch_${payment.id}`,
      status: "PENDING",
      method: payment.method,
      paidAmountCents: payment.amountCents,
      feeCents: null,
      recipientId: recipientId || "",
      successUrl,
    });
    return {
      ...fakeOrders.get(providerOrderId),
      checkoutUrl: `/pagamento-teste.html?payment=${encodeURIComponent(payment.id)}&order=${encodeURIComponent(providerOrderId)}`,
    };
  },
  async getOrder(providerOrderId) {
    const order = fakeOrders.get(providerOrderId);
    if (!order) throw buildHttpError(404, "Pedido de teste nao encontrado.", "payment_not_found");
    return { ...order };
  },
  // Só existe no provedor de teste: simula o cliente pagando/recusando.
  async simulate(providerOrderId, outcome) {
    const order = fakeOrders.get(providerOrderId);
    if (!order) throw buildHttpError(404, "Pedido de teste nao encontrado.", "payment_not_found");
    order.status = outcome === "paid" ? "PAID" : "FAILED";
    if (order.status === "PAID") {
      const rates = { pix: 99, credit_card: 349, debit_card: 149, meal_voucher: 600 };
      order.feeCents = Math.round((order.paidAmountCents * (rates[order.method] || 0)) / 10000);
    }
    return { ...order };
  },
  async refund({ providerChargeId }) {
    for (const order of fakeOrders.values()) {
      if (order.providerChargeId === providerChargeId) order.status = "REFUNDED";
    }
    return { status: "REFUNDED" };
  },
  async transfer({ amountCents }) {
    return { transferId: `fake_tr_${crypto.randomUUID()}`, status: amountCents > 0 ? "transferred" : "skipped" };
  },
  async createRecipient(account) {
    return { recipientId: `fake_re_${account.restaurantKey}`.slice(0, 80), status: "ACTIVE" };
  },
  extractProviderOrderId(body = {}) {
    return String(body?.data?.order?.id || body?.data?.id || "");
  },
};

const getPaymentProvider = () => {
  const name = getProviderName();
  if (name === "pagarme") return pagarmeProvider;
  if (name === "fake") return fakeProvider;
  throw buildHttpError(503, "Pagamento online ainda nao ativado.", "online_payment_disabled");
};

module.exports = {
  assertWebhookToken,
  buildSplit,
  getEnabledMethods,
  getPaymentProvider,
  getProviderName,
  isOnlinePaymentEnabled,
  mapPagarmeStatus,
  describePagarmeOrder,
};
