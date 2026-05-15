const {
  createCustomerSessionToken,
  hasCustomerSessionConfig,
  readCustomerClientToken,
  readCustomerKeyHeader,
  serializeCustomerSessionCookie,
} = require("../../lib/customer-auth.cjs");
const { json, parseJsonBody } = require("../../lib/http.cjs");
const { normalizeOrderSubmission } = require("../../lib/order-payload.cjs");
const { assertPublicOrderRequest } = require("../../lib/request-guard.cjs");
const { createOrder } = require("../../lib/order-store.cjs");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, {
      error: "Metodo nao permitido.",
      errorCode: "method_not_allowed",
    });
  }

  try {
    assertPublicOrderRequest(req);
    const payload = parseJsonBody(req.body, { strict: true });
    const normalizedOrder = normalizeOrderSubmission(payload);
    const result = await createOrder(normalizedOrder);
    const responseHeaders = {};
    const customerClientToken = readCustomerClientToken(req);
    const customerKeyHeader = readCustomerKeyHeader(req);

    if (
      hasCustomerSessionConfig() &&
      customerClientToken &&
      customerKeyHeader &&
      customerKeyHeader === normalizedOrder.customer.key
    ) {
      const sessionToken = createCustomerSessionToken({
        customerKey: normalizedOrder.customer.key,
        clientToken: customerClientToken,
      });
      responseHeaders["Set-Cookie"] = serializeCustomerSessionCookie(sessionToken, req);
    }

    return json(res, 200, {
      ok: true,
      created: result.created,
      storageMode: result.storageMode,
      order: result.order,
    }, responseHeaders);
  } catch (error) {
    if (error?.retryAfterSeconds) {
      res.setHeader("Retry-After", String(error.retryAfterSeconds));
    }

    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || "Nao foi possivel registrar o pedido.",
      errorCode:
        error?.errorCode || (error?.statusCode ? "invalid_order_payload" : "internal_error"),
    });
  }
};
