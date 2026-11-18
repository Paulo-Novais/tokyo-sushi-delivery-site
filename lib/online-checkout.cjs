"use strict";

// Pagamento online do site (modelo iFood).
//
// 1. Cliente escolhe "Pagar online" (Pix, crédito, débito ou VR/VA).
// 2. O servidor valida o carrinho como um pedido normal (cardápio, preços do
//    servidor, horário, Gestor aberto) e cobra o TOTAL calculado aqui.
// 3. O cliente paga no checkout do provedor (Pagar.me/Stone).
// 4. Quando o provedor confirma (aviso + consulta ao provedor), o pedido é
//    criado já "PAGO ONLINE" e entram no extrato a venda e a taxa.
// 5. Se o pedido não puder ser criado (ex.: restaurante fechou), o valor é
//    devolvido automaticamente ao cliente.
// O pedido não pago nunca aparece no Gestor.

const { buildHttpError } = require("./http.cjs");
const { buildTenantContext } = require("./tenant-context.cjs");
const { runWithDatabaseScope } = require("./tenant-sql.cjs");
const { estimateProcessingFeeCents } = require("./payment-methods.cjs");
const { getPaymentProvider } = require("./payment-provider.cjs");
const { getRestaurantOnlineMethods } = require("./payment-settings.cjs");
const store = require("./online-payment-store.cjs");
const { recordLedgerEntry } = require("./payout-store.cjs");
const { computePlatformFeeCents } = require("./payout-ledger.cjs");
const {
  assertPublicOrderTenantCanOperate,
  assertRestaurantGestorOnline,
  createOrderWithRetry,
  prepareOrder,
} = require("./public-order-placement.cjs");

// Forma online -> forma do pedido (como aparece no Gestor e no financeiro).
const ORDER_PAYMENT_METHOD = Object.freeze({
  pix: "pix",
  credit_card: "credito",
  debit_card: "debito",
  meal_voucher: "vale",
});

const tenantOf = (tenantContext) => ({
  tenantId: tenantContext.tenantId,
  restaurantId: tenantContext.restaurantId,
  restaurantKey: tenantContext.restaurantKey,
});

const contextForPayment = (payment, restaurantName = "") =>
  buildTenantContext(
    {
      host: "payments.inovas.local",
      matched: true,
      tenantId: payment.tenantId,
      restaurantId: payment.restaurantId,
      restaurantKey: payment.restaurantKey,
      restaurantName,
      resolutionMode: "system",
      multiRestaurantActive: true,
    },
    { source: "payments:fulfill" }
  );

const publicScope = (tenantContext) => ({
  audience: "public",
  tenantId: tenantContext.tenantId,
  restaurantId: tenantContext.restaurantId,
  restaurantKey: tenantContext.restaurantKey,
});

// Volta do pagamento: só caminho do próprio site (nunca outro domínio).
const safeReturnPath = (value) => {
  const raw = String(value || "/");
  return /^\/(?!\/)[A-Za-z0-9/_.-]{0,200}$/.test(raw) ? raw : "/";
};

const startCheckout = async ({ tenantContext, payload, origin }) => {
  const provider = getPaymentProvider();
  const method = String(payload?.checkout?.onlinePaymentMethod || "");
  if (!(await getRestaurantOnlineMethods(tenantContext)).includes(method)) {
    throw buildHttpError(400, "Forma de pagamento online indisponivel.", "online_payment_method_invalid");
  }
  // O pedido entra com a forma correspondente; troco não se aplica.
  const orderPayload = {
    ...payload,
    checkout: {
      ...(payload.checkout || {}),
      paymentMethod: ORDER_PAYMENT_METHOD[method],
      cashChangeRequired: "no",
      cashAmountProvided: null,
    },
  };

  const normalized = await runWithDatabaseScope(publicScope(tenantContext), async () => {
    await assertPublicOrderTenantCanOperate(tenantContext);
    await assertRestaurantGestorOnline(tenantContext);
    return prepareOrder(orderPayload, tenantContext);
  });
  const amountCents = Math.round(Number(normalized.order.total) * 100);
  if (!Number.isInteger(amountCents) || amountCents < 100) {
    throw buildHttpError(400, "Valor do pedido invalido para pagamento online.", "online_payment_amount_invalid");
  }

  const tenant = tenantOf(tenantContext);
  const recipient = provider.name === "pagarme" ? await store.getRecipient(tenant) : null;
  if (provider.name === "pagarme" && !recipient?.recipientId) {
    throw buildHttpError(409, "Pagamento online ainda nao ativado para este restaurante.", "payment_recipient_missing");
  }

  let payment = await store.createPayment(tenant, {
    method,
    amountCents,
    orderPayload,
    customerKey: normalized.customer.key,
    provider: provider.name,
  });
  try {
    const checkout = await provider.createCheckout({
      payment,
      order: { restaurantKey: tenant.restaurantKey, restaurantName: tenantContext.restaurantName || "" },
      customer: normalized.customer,
      recipientId: recipient?.recipientId || "",
      platformFeeCents: computePlatformFeeCents(amountCents, method),
      successUrl: `${origin}${safeReturnPath(payload?.checkout?.returnPath)}?pagamento=${encodeURIComponent(payment.id)}`,
    });
    payment = await store.updatePayment(payment, {
      providerOrderId: checkout.providerOrderId,
      providerChargeId: checkout.providerChargeId,
      checkoutUrl: checkout.checkoutUrl,
    });
  } catch (error) {
    await store.updatePayment(payment, { status: "FAILED", failureReason: String(error.message || "").slice(0, 300) });
    throw error;
  }
  return {
    paymentId: payment.id,
    checkoutUrl: payment.checkoutUrl,
    amountCents,
    method,
  };
};

const refundPayment = async (payment, reason) => {
  const provider = getPaymentProvider();
  if (payment.providerChargeId) {
    await provider.refund({ providerChargeId: payment.providerChargeId, amountCents: payment.amountCents });
  }
  return store.updatePayment(payment, {
    status: payment.orderId ? "REFUNDED" : "ORDER_FAILED",
    refundedAt: new Date().toISOString(),
    failureReason: String(reason || "").slice(0, 300),
  });
};

// Confirma um pagamento consultando o provedor. Seguro para repetir: só o
// primeiro processamento cria o pedido e lança no extrato.
const syncPayment = async (payment) => {
  if (!payment || payment.status !== "PENDING" || !payment.providerOrderId) return payment;
  const provider = getPaymentProvider();
  const remote = await provider.getOrder(payment.providerOrderId);

  if (remote.status === "FAILED") {
    return store.updatePayment(payment, { status: "FAILED", failureReason: "Pagamento recusado ou expirado." });
  }
  if (remote.status !== "PAID") return payment;

  // Trava: só um processamento passa de PENDING para PAID.
  if (!(await store.claimPaymentTransition(payment, "PENDING", "PAID"))) {
    return store.getPaymentById(payment, payment.id);
  }
  const paidAt = new Date().toISOString();
  let current = await store.updatePayment(payment, {
    paidAt,
    providerChargeId: remote.providerChargeId || payment.providerChargeId,
    feeCents: remote.feeCents,
  });

  if (Number(remote.paidAmountCents) !== Number(current.amountCents)) {
    return refundPayment(current, "Valor pago diferente do pedido; devolvido automaticamente.");
  }

  const tenantContext = contextForPayment(current);
  let orderResult;
  try {
    orderResult = await runWithDatabaseScope(publicScope(tenantContext), () =>
      createOrderWithRetry(current.orderPayload, tenantContext, {
        decorate: (normalizedOrder) => {
          normalizedOrder.order.rawPayload = {
            ...(normalizedOrder.order.rawPayload || {}),
            onlinePayment: {
              paymentId: current.id,
              method: current.method,
              status: "PAID",
              amountCents: current.amountCents,
              provider: current.provider,
              paidAt,
            },
          };
        },
      })
    );
  } catch (error) {
    // Pago, mas o pedido não pôde ser criado: devolve o dinheiro.
    return refundPayment(current, `Pedido nao criado (${error.message || "erro"}); valor devolvido.`);
  }

  const order = orderResult.result.order || {};
  current = await store.updatePayment(current, {
    orderId: String(order.id || order.orderId || ""),
    orderPublicId: String(order.publicId || order.orderNumber || ""),
  });

  // Extrato do restaurante: venda + taxa do meio de pagamento.
  const options = { tenantContext };
  const base = {
    method: current.method,
    orderId: current.orderId,
    orderPublicId: current.orderPublicId ? `#${String(current.orderPublicId).replace(/^#/, "")}` : "",
    paymentId: current.id,
    occurredAt: paidAt,
  };
  await recordLedgerEntry(options, { ...base, type: "SALE", amountCents: current.amountCents, idempotencyKey: `${current.id}:sale` });
  const feeCents = current.feeCents ?? estimateProcessingFeeCents(current.method, current.amountCents);
  if (feeCents && feeCents > 0) {
    await recordLedgerEntry(options, { ...base, type: "PROCESSING_FEE", amountCents: feeCents, idempotencyKey: `${current.id}:fee` });
  }
  // Taxa INOVAS (padrão 1,5%) sobre a venda online.
  const platformFeeCents = computePlatformFeeCents(current.amountCents, current.method);
  if (platformFeeCents > 0) {
    await recordLedgerEntry(options, { ...base, type: "PLATFORM_FEE", amountCents: platformFeeCents, idempotencyKey: `${current.id}:platform-fee` });
  }
  return current;
};

const handleProviderNotice = async (body) => {
  const provider = getPaymentProvider();
  const providerOrderId = provider.extractProviderOrderId(body);
  if (!providerOrderId) return { ignored: true };
  const payment = await store.findPaymentByProviderOrderId(providerOrderId);
  if (!payment) return { ignored: true };
  const synced = await syncPayment(payment);
  return { ignored: false, status: synced.status };
};

// Tela de retorno do cliente: consulta (e confirma, se o aviso atrasou).
const getCheckoutStatus = async ({ tenantContext, paymentId }) => {
  let payment = await store.getPaymentById(tenantOf(tenantContext), paymentId);
  if (!payment) throw buildHttpError(404, "Pagamento nao encontrado.", "payment_not_found");
  if (payment.status === "PENDING") payment = await syncPayment(payment);
  return {
    paymentId: payment.id,
    status: payment.status,
    method: payment.method,
    amountCents: payment.amountCents,
    orderPublicId: payment.orderPublicId || "",
    checkoutUrl: payment.status === "PENDING" ? payment.checkoutUrl : "",
  };
};

// Restaurante cancelou um pedido pago online: devolve ao cliente e lança a
// devolução no extrato. Pedido sem pagamento online: nada a fazer.
const refundOrderIfPaidOnline = async ({ tenantContext, orderId, reason = "Pedido cancelado" }) => {
  const payment = await store.findPaymentByOrderId(tenantOf(tenantContext), orderId);
  if (!payment || payment.status !== "PAID") return { refunded: false };
  const refunded = await refundPayment(payment, reason);
  await recordLedgerEntry(
    { tenantContext },
    {
      type: "REFUND",
      amountCents: payment.amountCents,
      orderId: payment.orderId,
      orderPublicId: payment.orderPublicId ? `#${String(payment.orderPublicId).replace(/^#/, "")}` : "",
      paymentId: payment.id,
      description: String(reason).slice(0, 120),
      idempotencyKey: `${payment.id}:refund`,
    }
  );
  // Pedido devolvido: a taxa INOVAS daquela venda volta para o restaurante.
  const platformFeeCents = computePlatformFeeCents(payment.amountCents, payment.method);
  if (platformFeeCents > 0) {
    await recordLedgerEntry(
      { tenantContext },
      {
        type: "CREDIT",
        amountCents: platformFeeCents,
        orderId: payment.orderId,
        paymentId: payment.id,
        description: "Estorno da taxa INOVAS (pedido devolvido)",
        idempotencyKey: `${payment.id}:platform-fee-refund`,
      }
    );
  }
  return { refunded: true, status: refunded.status };
};

module.exports = {
  ORDER_PAYMENT_METHOD,
  getCheckoutStatus,
  handleProviderNotice,
  refundOrderIfPaidOnline,
  startCheckout,
  syncPayment,
};
