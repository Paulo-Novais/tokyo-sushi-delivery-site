"use strict";

// /api/channels/*  (integrações com plataformas de delivery)
//   POST ifood/webhook?token=   aviso do iFood (pedido confirmado pela consulta)
//   POST test-simulate          só provedor de teste: cria um pedido "do iFood"
//   GET  test-actions           só provedor de teste: o que foi avisado ao iFood

const crypto = require("node:crypto");
const { buildHttpError, json, parseJsonBody } = require("./http.cjs");
const { assertIfoodWebhookToken, fakeIfood, getIfoodMode, handleIfoodEvent } = require("./marketplace-channels.cjs");

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

    if ((action === "test-simulate" || action === "test-actions") && getIfoodMode() !== "fake") {
      throw buildHttpError(404, "Rota nao encontrada.", "not_found");
    }

    if (action === "test-simulate" && req.method === "POST") {
      const body = parseJsonBody(req.body, { strict: true });
      const id = `fake-ifood-${crypto.randomUUID()}`;
      const merchantId = String(body.merchantId || "");
      fakeIfood.orders.set(id, {
        id,
        displayId: String(Math.floor(1000 + Math.random() * 9000)),
        orderType: body.pickup ? "TAKEOUT" : "DELIVERY",
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
      return json(res, 200, { ok: true, actions: fakeIfood.actions.filter((entry) => !orderId || entry.orderId === orderId) });
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
