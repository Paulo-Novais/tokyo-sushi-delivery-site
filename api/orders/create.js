const { withRequestTiming } = require("../../lib/request-timing.cjs");
const {
  createCustomerSessionToken,
  hasCustomerSessionConfig,
  readCustomerClientToken,
  readCustomerKeyHeader,
  serializeCustomerSessionCookie,
} = require("../../lib/customer-auth.cjs");
const { json, parseJsonBody } = require("../../lib/http.cjs");
const { assertPublicOrderRequest } = require("../../lib/request-guard.cjs");
const {
  getRequestTenantContext,
  withTenantContextPayload,
} = require("../../lib/tenant-context.cjs");
const { guardSecurity, recordSecurityFailure } = require("../../lib/security-guardian.cjs");
const { runWithDatabaseScope } = require("../../lib/tenant-sql.cjs");
const {
  assertPublicOrderTenantCanOperate,
  assertRestaurantGestorOnline,
  createOrderWithRetry,
} = require("../../lib/public-order-placement.cjs");

module.exports = withRequestTiming(async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, {
      error: "Metodo nao permitido.",
      errorCode: "method_not_allowed",
    });
  }

  try {
    await guardSecurity(req, {
      routeType: "public-write",
      action: "orders:create",
      requireTenant: true,
      rateLimitProfile: "publicWrite",
    });
    assertPublicOrderRequest(req);
    const tenantContext = await getRequestTenantContext(req, {
      source: "public:orders:create",
    });
    const payload = parseJsonBody(req.body, { strict: true });
    const { normalizedOrder, result } = await runWithDatabaseScope(
      {
        audience: "public",
        tenantId: tenantContext.tenantId,
        restaurantId: tenantContext.restaurantId,
        restaurantKey: tenantContext.restaurantKey,
      },
      async () => {
        await assertPublicOrderTenantCanOperate(tenantContext);
        await assertRestaurantGestorOnline(tenantContext);
        return createOrderWithRetry(payload, tenantContext);
      }
    );
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
        restaurantKey: tenantContext.restaurantKey,
      });
      responseHeaders["Set-Cookie"] = serializeCustomerSessionCookie(sessionToken, req);
    }

    return json(res, 200, {
      ok: true,
      ...withTenantContextPayload(
        {
          created: result.created,
          storageMode: result.storageMode,
          order: result.order,
        },
        tenantContext
      ),
    }, responseHeaders);
  } catch (error) {
    if (error?.statusCode && Number(error.statusCode) >= 400) {
      recordSecurityFailure(req, {
        routeType: "public-write",
        action: "orders:create",
        reason: error?.errorCode || "order_create_rejected",
      });
    }

    if (error?.retryAfterSeconds) {
      res.setHeader("Retry-After", String(error.retryAfterSeconds));
    }

    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || "Nao foi possivel registrar o pedido.",
      errorCode:
        error?.errorCode || (error?.statusCode ? "invalid_order_payload" : "internal_error"),
      ...(error?.operationalStatus ? { operationalStatus: error.operationalStatus } : {}),
    });
  }
});
