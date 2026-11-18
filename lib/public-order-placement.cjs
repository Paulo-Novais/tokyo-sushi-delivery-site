"use strict";

// Regras comuns para criar um pedido público (site): plano ativo, Gestor
// aberto, horário de funcionamento, preços do cardápio do servidor e nova
// tentativa em falha de conexão com o banco. Usado pelo pedido normal
// (api/orders/create.js) e pelo pedido pago online (lib/online-checkout.cjs).

const { getCatalogValidationContext } = require("./catalog-store.cjs");
const { buildHttpError } = require("./http.cjs");
const { normalizeOrderSubmission } = require("./order-payload.cjs");
const { getPublicRestaurantSettings } = require("./restaurant-settings-store.cjs");
const { createOrder } = require("./order-store.cjs");
const { getPlanAccessForAdminModule } = require("./master-platform-store.cjs");
const { runWithDatabaseScope } = require("./tenant-sql.cjs");
const { getPresence } = require("./restaurant-presence.cjs");
const { DEFAULT_TIMEZONE, getBusinessHoursStatus } = require("./business-hours.cjs");

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

const createOrderWithRetry = async (payload, tenantContext, { decorate } = {}) => {
  let lastError = null;

  for (let attempt = 0; attempt <= ORDER_CREATE_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const catalogContext = await getCatalogValidationContext({
        tenantContext,
        salesChannel: "delivery",
      });
      const normalizedOrder = normalizeOrderSubmission(payload, catalogContext);
      if (typeof decorate === "function") decorate(normalizedOrder);
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

// "Gestor aberto" (regra de todos os restaurantes): sem sinal do Gestor/app
// nos últimos minutos, o pedido não entra — o cliente não fica esperando um
// pedido que ninguém vai ver. Sem dado confiável (tabela ausente/erro), segue
// como antes para não travar vendas por falha técnica.
const assertRestaurantGestorOnline = async (tenantContext) => {
  const presence = await getPresence({ tenantContext });
  if (presence.online) return;
  throw buildHttpError(
    409,
    "Restaurante indisponivel no momento. Tente novamente mais tarde.",
    "restaurant_unavailable",
    { operationalStatus: { gestorOnline: false } }
  );
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


// Valida o pedido como se fosse criar (cardápio, valores, horário), sem gravar.
// Usado antes de cobrar online: o valor cobrado é o total calculado aqui.
const prepareOrder = async (payload, tenantContext) => {
  const catalogContext = await getCatalogValidationContext({ tenantContext, salesChannel: "delivery" });
  const normalizedOrder = normalizeOrderSubmission(payload, catalogContext);
  await runWithDatabaseScope(
    {
      audience: "public",
      customerKey: normalizedOrder.customer.key,
      tenantId: tenantContext.tenantId,
      restaurantId: tenantContext.restaurantId,
      restaurantKey: tenantContext.restaurantKey,
    },
    () => assertImmediateOrderWithinBusinessHours(normalizedOrder, tenantContext)
  );
  return normalizedOrder;
};

module.exports = {
  assertPublicOrderTenantCanOperate,
  assertRestaurantGestorOnline,
  createOrderWithRetry,
  prepareOrder,
};
