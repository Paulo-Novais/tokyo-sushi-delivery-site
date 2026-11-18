"use strict";

// /api/channels/*  (integrações com plataformas de delivery)
//   POST ifood/webhook?token=   aviso do iFood (pedido confirmado pela consulta)
//   POST test-simulate          só provedor de teste: cria um pedido "do iFood"
//   GET  test-actions           só provedor de teste: o que foi avisado ao iFood

const crypto = require("node:crypto");
const { buildHttpError, json, parseJsonBody } = require("./http.cjs");
const {
  CHANNELS,
  assertIfoodWebhookToken,
  assertOpenDeliveryApp,
  fakeIfood,
  fakeOpenDelivery,
  getIfoodMode,
  getOpenDeliveryMode,
  handleIfoodEvent,
  handleOpenDeliveryEvent,
  verifyOpenDeliverySignature,
} = require("./marketplace-channels.cjs");
const { getRequestHeader } = require("./http.cjs");

const OD_CHANNELS = Object.values(CHANNELS).filter((channel) => channel.standard === "opendelivery").map((channel) => channel.id);
const anyFake = () => getIfoodMode() === "fake" || OD_CHANNELS.some((channel) => getOpenDeliveryMode(channel) === "fake");

const getAction = (req) => {
  const url = new URL(String(req.url || "/"), "http://localhost");
  const segments = url.pathname.split("/").filter(Boolean);
  const marker = segments.findIndex((segment) => segment === "channels" || segment === "__channels");
  let action = marker >= 0 ? segments.slice(marker + 1).join("/") : "";
  if (!action || /^\[\.\.\..+\]$/.test(action)) {
    action = String(url.searchParams.get("...action") || url.searchParams.get("action") || "").replace(/^__channels\/?/, "");
  }
  return { action, url };
};

const handleChannelsApi = async (req, res) => {
  const { action, url } = getAction(req);
  try {
    if (action === "ifood/webhook" && req.method === "POST") {
      assertIfoodWebhookToken(url.searchParams.get("token"));
      const body = parseJsonBody(req.body, { strict: false }) || {};
      const events = Array.isArray(body) ? body : [body];
      const results = [];
      for (const event of events.slice(0, 50)) results.push(await handleIfoodEvent(event));
      return json(res, 202, { ok: true, results });
    }

    // Open Delivery (99Food, Keeta): a plataforma chama <base>/v1/newEvent.
    const odMatch = /^([a-z0-9]+)\/v1\/newEvent$/.exec(action);
    if (odMatch && OD_CHANNELS.includes(odMatch[1]) && req.method === "POST") {
      const channel = odMatch[1];
      if (!getOpenDeliveryMode(channel)) throw buildHttpError(503, "Integracao nao ativada.", "channels_not_configured");
      assertOpenDeliveryApp(channel, getRequestHeader(req, "x-app-id"));
      const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
      const signature = getRequestHeader(req, "x-app-signature");
      // Corpo já convertido pela Vercel: a assinatura só é exigida quando o
      // texto original está disponível. O pedido sempre é consultado na
      // plataforma com a credencial da INOVAS antes de entrar no Gestor.
      if (typeof req.body === "string" && !verifyOpenDeliverySignature(channel, rawBody, signature)) {
        throw buildHttpError(403, "Assinatura invalida.", "opendelivery_signature_invalid");
      }
      const event = parseJsonBody(req.body, { strict: false }) || {};
      const result = await handleOpenDeliveryEvent(channel, event, { merchantId: getRequestHeader(req, "x-app-merchantid") });
      return json(res, 200, { ok: true, ...result });
    }

    if ((action === "test-simulate" || action === "test-actions" || action === "test-event") && !anyFake()) {
      throw buildHttpError(404, "Rota nao encontrada.", "not_found");
    }

    // Só teste: a plataforma manda um aviso de status/cancelamento.
    if (action === "test-event" && req.method === "POST") {
      const body = parseJsonBody(req.body, { strict: true });
      const channel = String(body.channel || "ifood");
      const merchantId = String(body.merchantId || "");
      const orderId = String(body.orderId || "");
      const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : undefined;
      const result =
        channel === "ifood"
          ? await handleIfoodEvent({ orderId, merchantId, fullCode: String(body.code || ""), metadata })
          : await handleOpenDeliveryEvent(channel, { eventId: crypto.randomUUID(), eventType: String(body.code || ""), orderId, metadata }, { merchantId });
      return json(res, 200, { ok: true, ...result });
    }

    if (action === "test-simulate" && req.method === "POST" && OD_CHANNELS.includes(String(parseJsonBody(req.body, { strict: true }).channel || ""))) {
      const body = parseJsonBody(req.body, { strict: true });
      const channel = String(body.channel);
      const id = crypto.randomUUID();
      const merchantId = String(body.merchantId || "");
      fakeOpenDelivery.orders.set(id, {
        id,
        type: body.pickup ? "TAKEOUT" : "DELIVERY",
        displayId: String(Math.floor(100 + Math.random() * 900)),
        createdAt: new Date().toISOString(),
        orderTiming: "INSTANT",
        merchant: { id: merchantId, name: "Loja teste" },
        customer: { id: "cli-od-1", name: `Cliente ${CHANNELS[channel].label} Teste`, phone: { number: "11999990000" } },
        items: [
          { id: "a", name: "Hot roll 10 peças", quantity: 2, unitPrice: { value: 24.9, currency: "BRL" }, totalPrice: { value: 49.8, currency: "BRL" }, specialInstructions: "bem passado" },
          { id: "b", name: "Yakisoba", quantity: 1, unitPrice: { value: 39.9, currency: "BRL" }, totalPrice: { value: 39.9, currency: "BRL" }, options: [{ name: "Carne", quantity: 1 }] },
        ],
        otherFees: [{ name: "Entrega", type: "DELIVERY_FEE", price: { value: 6, currency: "BRL" } }],
        total: { itemsPrice: { value: 89.7, currency: "BRL" }, otherFees: { value: 6, currency: "BRL" }, orderAmount: { value: 95.7, currency: "BRL" } },
        payments: { prepaid: 95.7, pending: 0, methods: [{ value: 95.7, currency: "BRL", type: "PREPAID", method: "PIX" }] },
        delivery: {
          deliveredBy: body.deliveredBy || "MERCHANT",
          deliveryAddress: { country: "BR", state: "SP", city: "Ribeirão Preto", district: "Centro", street: "Rua Teste", number: "200", postalCode: "14000000", complement: "" },
        },
      });
      const result = await handleOpenDeliveryEvent(channel, { eventId: crypto.randomUUID(), eventType: "CREATED", orderId: id }, { merchantId });
      return json(res, 200, { ok: true, externalOrderId: id, ...result });
    }

    if (action === "test-simulate" && req.method === "POST") {
      const body = parseJsonBody(req.body, { strict: true });
      const id = `fake-ifood-${crypto.randomUUID()}`;
      const merchantId = String(body.merchantId || "");
      fakeIfood.orders.set(id, {
        id,
        displayId: String(Math.floor(1000 + Math.random() * 9000)),
        orderType: body.pickup ? "TAKEOUT" : "DELIVERY",
        salesChannel: String(body.salesChannel || "IFOOD"),
        orderTiming: "IMMEDIATE",
        merchant: { id: merchantId },
        customer: { id: "cliente-ifood-1", name: "Cliente iFood Teste", phone: { number: "0800 000 0000", localizer: "12345678" } },
        items: [
          { id: "i1", name: "Combinado 20 peças", quantity: 1, unitPrice: 79.9, totalPrice: 79.9, observations: "sem cebolinha" },
          { id: "i2", name: "Temaki salmão", quantity: 2, unitPrice: 32, totalPrice: 64, options: [{ name: "Cream cheese", quantity: 1 }] },
        ],
        total: { subTotal: 143.9, deliveryFee: 7.9, orderAmount: 151.8 },
        payments: { prepaid: 151.8, pending: 0, methods: [{ method: "CREDIT", prepaid: true }] },
        delivery: {
          deliveredBy: body.deliveredBy || "MERCHANT",
          deliveryAddress: { streetName: "Rua Teste", streetNumber: "100", neighborhood: "Centro", city: "Ribeirão Preto", state: "SP", formattedAddress: "Rua Teste, 100 - Centro" },
        },
      });
      const result = await handleIfoodEvent({ orderId: id, merchantId, fullCode: "PLACED" });
      return json(res, 200, { ok: true, ifoodOrderId: id, ...result });
    }

    if (action === "test-actions" && req.method === "GET") {
      const orderId = url.searchParams.get("orderId") || "";
      return json(res, 200, {
        ok: true,
        actions: [...fakeIfood.actions, ...fakeOpenDelivery.actions].filter((entry) => !orderId || entry.orderId === orderId),
      });
    }

    return json(res, 404, { error: "Rota de integracao nao encontrada.", errorCode: "not_found" });
  } catch (error) {
    return json(res, Number(error?.statusCode || 500), {
      error: error?.statusCode ? error.message : "Nao foi possivel processar a integracao.",
      errorCode: error?.errorCode || "internal_error",
    });
  }
};

module.exports = handleChannelsApi;
