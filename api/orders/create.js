const {
  createCustomerSessionToken,
  hasCustomerSessionConfig,
  readCustomerClientToken,
  readCustomerKeyHeader,
  serializeCustomerSessionCookie,
} = require("../../lib/customer-auth.cjs");
const { getCatalogValidationContext } = require("../../lib/catalog-store.cjs");
const { buildHttpError, json, parseJsonBody } = require("../../lib/http.cjs");
const { normalizeOrderSubmission } = require("../../lib/order-payload.cjs");
const { getPublicRestaurantSettings } = require("../../lib/restaurant-settings-store.cjs");
const { assertPublicOrderRequest } = require("../../lib/request-guard.cjs");
const { createOrder } = require("../../lib/order-store.cjs");
const { getPlanAccessForAdminModule } = require("../../lib/master-platform-store.cjs");
const {
  getRequestTenantContext,
  withTenantContextPayload,
} = require("../../lib/tenant-context.cjs");
const { guardSecurity, recordSecurityFailure } = require("../../lib/security-guardian.cjs");
const { runWithDatabaseScope } = require("../../lib/tenant-sql.cjs");
const {
  DEFAULT_TIMEZONE,
  getBusinessHoursStatus,
} = require("../../lib/business-hours.cjs");

const ORDER_CREATE_RETRY_DELAYS_MS = [250, 750];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const attachOperationalStatusSnapshot = (normalizedOrder, operationalStatus) => {
  const isImmediateOrder = normalizedOrder.order.timingMode === "immediate";

  normalizedOrder.order.rawPayload = {
    ...(normalizedOrder.order.rawPayload || {}),
    operationalStatus: {
      orderTimingMode: normalizedOrder.order.timingMode || "",
      validationApplied: Boolean(operationalStatus.validationApplied && isImmediateOrder),
      immediateValidationApplied: Boolean(operationalStatus.validationApplied && isImmediateOrder),
      timeZone: operationalStatus.timeZone || DEFAULT_TIMEZONE,
      checkedAt: operationalStatus.checkedAt || new Date().toISOString(),
      localDate: operationalStatus.localDate || "",
      localTime: operationalStatus.localTime || "",
      dayKey: operationalStatus.dayKey || "",
      dayLabel: operationalStatus.dayLabel || "",
      isSpecialDateActive: Boolean(operationalStatus.isSpecialDateActive),
      specialDate: operationalStatus.activeSpecialDate || null,
      activeSpecialDate: operationalStatus.activeSpecialDate || null,
      specialDateNotice: operationalStatus.specialDateNotice || "",
      isOpen: Boolean(operationalStatus.isOpen),
      acceptsOrdersOutsideHours: operationalStatus.acceptsOrdersOutsideHours === true,
      acceptsImmediateOrders: operationalStatus.acceptsImmediateOrders === true,
      closedReason: operationalStatus.closedReason || "",
      openTime: operationalStatus.openTime || "",
      closeTime: operationalStatus.closeTime || "",
      pauseStart: operationalStatus.pauseStart || "",
      pauseEnd: operationalStatus.pauseEnd || "",
      todayHoursLabel: operationalStatus.todayHoursLabel || "",
      nextOpeningDate: operationalStatus.nextOpeningDate || "",
      nextOpeningTime: operationalStatus.nextOpeningTime || "",
      nextOpeningLabel: operationalStatus.nextOpeningLabel || "",
      message: operationalStatus.message || "",
    },
  };
};

const assertImmediateOrderWithinBusinessHours = async (normalizedOrder, tenantContext) => {
  const publicSettings = await getPublicRestaurantSettings({ tenantContext });
  const operationalStatus = publicSettings.settings?.hasStructuredBusinessSchedule
    ? getBusinessHoursStatus(publicSettings.settings.businessSchedule)
    : getBusinessHoursStatus(null);

  attachOperationalStatusSnapshot(normalizedOrder, operationalStatus);

  if (normalizedOrder.order.timingMode !== "immediate") {
    return;
  }

  if (operationalStatus.acceptsImmediateOrders) {
    return;
  }

  throw buildHttpError(
    409,
    operationalStatus.message ||
      "Estamos fechados agora. Voce pode agendar seu pedido para o proximo horario de atendimento.",
    "store_closed",
    {
      operationalStatus: {
        isOpen: operationalStatus.isOpen,
        closedReason: operationalStatus.closedReason,
        localDate: operationalStatus.localDate,
        localTime: operationalStatus.localTime,
        isSpecialDateActive: operationalStatus.isSpecialDateActive,
        specialDate: operationalStatus.activeSpecialDate,
        activeSpecialDate: operationalStatus.activeSpecialDate,
        nextOpeningLabel: operationalStatus.nextOpeningLabel,
        acceptsOrdersOutsideHours: operationalStatus.acceptsOrdersOutsideHours,
      },
    }
  );
};

const isRetryableOrderCreateError = (error) => {
  if (error?.statusCode) {
    return false;
  }

  const message = String(error?.message || "").toLowerCase();

  return (
    Boolean(error?.["neon:retryable"]) ||
    message.includes("control plane request failed") ||
    message.includes("fetch failed")
  );
};

const createOrderWithRetry = async (payload, tenantContext) => {
  let lastError = null;

  for (let attempt = 0; attempt <= ORDER_CREATE_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const catalogContext = await getCatalogValidationContext({ tenantContext });
      const normalizedOrder = normalizeOrderSubmission(payload, catalogContext);
      const result = await runWithDatabaseScope(
        {
          audience: "public",
          customerKey: normalizedOrder.customer.key,
          tenantId: tenantContext.tenantId,
          restaurantId: tenantContext.restaurantId,
          restaurantKey: tenantContext.restaurantKey,
        },
        async () => {
          await assertImmediateOrderWithinBusinessHours(
            normalizedOrder,
            tenantContext
          );
          return createOrder(normalizedOrder, { tenantContext });
        }
      );

      return {
        normalizedOrder,
        result,
      };
    } catch (error) {
      lastError = error;

      if (!isRetryableOrderCreateError(error) || attempt >= ORDER_CREATE_RETRY_DELAYS_MS.length) {
        throw error;
      }

      await sleep(ORDER_CREATE_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
};

const assertPublicOrderTenantCanOperate = async (tenantContext) => {
  const planAccess = await getPlanAccessForAdminModule({
    group: "orders",
    action: "create",
    restaurantKey: tenantContext.restaurantKey || "default",
  });

  if (!planAccess.allowed) {
    throw buildHttpError(
      403,
      "Nao foi possivel concluir a operacao.",
      "plan_feature_forbidden",
      {
        featureKey: planAccess.featureKey,
        planKey: planAccess.commercialAccess?.planKey,
        reason: planAccess.reason,
      }
    );
  }
};

module.exports = async (req, res) => {
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
};
