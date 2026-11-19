"use strict";

// /api/payments/*  (pagamento online do site)
//   GET  methods          formas online ativas para o restaurante do site
//   POST checkout         valida o carrinho e devolve o link de pagamento
//   GET  status?payment=  situação do pagamento (tela de retorno)
//   POST webhook?token=   aviso do provedor (confirmado por consulta ao provedor)
//   POST test-simulate    só provedor de teste: simula pagar/recusar
//   GET  cron-payouts     rotina semanal (Vercel Cron, com CRON_SECRET)

const crypto = require("node:crypto");
const { buildHttpError, getRequestOrigin, getRequestHeader, json, parseJsonBody } = require("./http.cjs");
const { assertPublicOrderRequest } = require("./request-guard.cjs");
const { getRequestTenantContext } = require("./tenant-context.cjs");
const { guardSecurity, recordSecurityFailure } = require("./security-guardian.cjs");
const { ONLINE_PAYMENT_METHODS } = require("./payment-methods.cjs");
const {
  assertWebhookToken,
  getEnabledMethods,
  getPaymentProvider,
  getProviderName,
} = require("./payment-provider.cjs");
const { getCheckoutStatus, handleProviderNotice, startCheckout } = require("./online-checkout.cjs");
const { applySessionToOrderPayload, requireCustomerOrderSession } = require("./customer-order-session.cjs");
const { runWeeklyPayouts } = require("./payout-runner.cjs");
const { getRestaurantOnlineMethods } = require("./payment-settings.cjs");

// Aceita /api/payments/<ação>, /api/customer/__payments/<ação> (reescrita
// da Vercel) e a ação vinda em ?...action=__payments/<ação>.
const getAction = (req) => {
  const url = new URL(String(req.url || "/"), "http://localhost");
  const segments = url.pathname.split("/").filter(Boolean);
  const marker = segments.findIndex((segment) => segment === "payments" || segment === "__payments");
  let action = marker >= 0 ? segments[marker + 1] || "" : "";
  if (!action || /^\[\.\.\..+\]$/.test(action)) {
    const queryAction = String(url.searchParams.get("...action") || url.searchParams.get("action") || "");
    action = queryAction.replace(/^__payments\/?/, "");
  }
  return { action: String(action || "").split("/")[0], url };
};

const sendError = (res, error) =>
  json(res, Number(error?.statusCode || 500), {
    error: error?.statusCode ? error.message : "Nao foi possivel concluir o pagamento.",
    errorCode: error?.errorCode || (error?.statusCode ? "payment_error" : "internal_error"),
    ...(error?.operationalStatus ? { operationalStatus: error.operationalStatus } : {}),
  });

const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
};

const handlePaymentsApi = async (req, res) => {
  const { action, url } = getAction(req);
  try {
    if (action === "methods" && req.method === "GET") {
      // Formas que ESTE restaurante ativou (e a plataforma liberou).
      const tenantContext = await getRequestTenantContext(req, { source: "public:payments:methods" }).catch(() => null);
      const enabled = tenantContext ? await getRestaurantOnlineMethods(tenantContext) : [];
      return json(res, 200, {
        ok: true,
        enabled: enabled.length > 0,
        methods: ONLINE_PAYMENT_METHODS.filter((method) => enabled.includes(method.id)),
      });
    }

    if (action === "checkout" && req.method === "POST") {
      await guardSecurity(req, {
        routeType: "public-write",
        action: "orders:create",
        requireTenant: true,
        rateLimitProfile: "publicWrite",
      });
      assertPublicOrderRequest(req);
      const tenantContext = await getRequestTenantContext(req, { source: "public:payments:checkout" });
      // Pagamento online também só com cliente logado; dados do cliente vêm da sessão.
      const customerSession = await requireCustomerOrderSession(req, tenantContext);
      const payload = applySessionToOrderPayload(parseJsonBody(req.body, { strict: true }), customerSession);
      const result = await startCheckout({ tenantContext, payload, origin: getRequestOrigin(req) });
      return json(res, 200, { ok: true, ...result });
    }

    if (action === "status" && req.method === "GET") {
      const tenantContext = await getRequestTenantContext(req, { source: "public:payments:status" });
      const status = await getCheckoutStatus({ tenantContext, paymentId: url.searchParams.get("payment") });
      res.setHeader("Cache-Control", "no-store");
      return json(res, 200, { ok: true, ...status });
    }

    if (action === "webhook" && req.method === "POST") {
      assertWebhookToken(url.searchParams.get("token"));
      const body = parseJsonBody(req.body, { strict: false }) || {};
      const result = await handleProviderNotice(body);
      return json(res, 200, { ok: true, ...result });
    }

    if (action === "test-simulate" && req.method === "POST") {
      if (getProviderName() !== "fake") {
        throw buildHttpError(404, "Rota nao encontrada.", "not_found");
      }
      const body = parseJsonBody(req.body, { strict: true });
      const provider = getPaymentProvider();
      await provider.simulate(String(body.providerOrderId || ""), body.outcome === "paid" ? "paid" : "failed");
      const result = await handleProviderNotice({ data: { order: { id: body.providerOrderId } } });
      const remote = await provider.getOrder(String(body.providerOrderId || ""));
      let returnUrl = "/";
      try {
        const parsed = new URL(remote.successUrl || "/", "http://local");
        returnUrl = `${parsed.pathname}${parsed.search}`;
      } catch {
        returnUrl = "/";
      }
      return json(res, 200, { ok: true, ...result, returnUrl });
    }

    if (action === "cron-payouts" && req.method === "GET") {
      const secret = String(process.env.CRON_SECRET || "");
      const auth = getRequestHeader(req, "authorization");
      if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
        throw buildHttpError(401, "Nao autorizado.", "cron_unauthorized");
      }
      const summary = await runWeeklyPayouts({ actorLogin: "rotina-semanal" });
      return json(res, 200, { ok: true, ...summary });
    }

    return json(res, 404, { error: "Rota de pagamento nao encontrada.", errorCode: "not_found" });
  } catch (error) {
    if (action === "checkout" && error?.statusCode >= 400 && error?.statusCode < 500) {
      recordSecurityFailure(req, {
        routeType: "public-write",
        action: "orders:create",
        reason: error?.errorCode || "payment_checkout_rejected",
      });
    }
    if (error?.retryAfterSeconds) res.setHeader("Retry-After", String(error.retryAfterSeconds));
    return sendError(res, error);
  }
};

module.exports = handlePaymentsApi;
