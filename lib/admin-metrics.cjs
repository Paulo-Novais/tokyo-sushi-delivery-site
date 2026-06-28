const {
  DAY_MS,
  buildOperationalWindow,
  buildOperationalWindowForPreset,
  getOperationalDayWindow,
  parseOperationalCustomWindow,
  toOperationalDateInput,
  toTimestamp,
} = require("./operational-day.cjs");

const ORDER_STATUSES = [
  "Recebido",
  "Aceito",
  "Em preparo",
  "Pronto",
  "Saiu para entrega",
  "Entregue",
  "Retirada concluida",
  "Cancelado",
];
const LEGACY_FINALIZED_STATUS = "Finalizado";

const METRIC_PERIOD_OPTIONS = Object.freeze([
  { key: "today", label: "Hoje" },
  { key: "7d", label: "Ultimos 7 dias" },
  { key: "30d", label: "Ultimos 30 dias" },
  { key: "custom", label: "Periodo customizado" },
]);

const METRIC_FLOW_OPTIONS = Object.freeze([
  { key: "", label: "Todos os fluxos" },
  { key: "delivery", label: "Entrega" },
  { key: "pickup", label: "Retirada" },
  { key: "scheduled", label: "Agendados" },
]);

const METRIC_STATUS_OPTIONS = Object.freeze([
  { key: "", label: "Todos os status" },
  ...ORDER_STATUSES.map((status) => ({
    key: status,
    label: status,
  })),
]);

const normalizeStatusKey = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const resolveCanonicalOrderStatus = (status, fulfillmentMode = "") => {
  const normalizedStatus = normalizeStatusKey(status);
  const normalizedFulfillmentMode = String(fulfillmentMode || "").trim().toLowerCase();

  if (!normalizedStatus) {
    return "";
  }

  if (normalizedStatus === "novo" || normalizedStatus === "recebido") {
    return "Recebido";
  }

  if (normalizedStatus === "confirmado" || normalizedStatus === "aceito") {
    return "Aceito";
  }

  if (normalizedStatus === "em preparo") {
    return "Em preparo";
  }

  if (normalizedStatus === "pronto") {
    return "Pronto";
  }

  if (normalizedStatus === "saiu para entrega") {
    return "Saiu para entrega";
  }

  if (normalizedStatus === normalizeStatusKey(LEGACY_FINALIZED_STATUS)) {
    return normalizedFulfillmentMode === "pickup" ? "Retirada concluida" : "Entregue";
  }

  if (normalizedStatus === "entregue") {
    return "Entregue";
  }

  if (normalizedStatus === "retirada concluida") {
    return "Retirada concluida";
  }

  if (normalizedStatus === "cancelado") {
    return "Cancelado";
  }

  return "";
};

const toIsoString = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const formatShortDayLabel = (dateInput) => {
  const parts = String(dateInput || "").trim().split("-");

  if (parts.length !== 3) {
    return "--/--";
  }

  return `${parts[2]}/${parts[1]}`;
};

const formatRangeLabel = (startDate, endDate) => {
  const startLabel = formatShortDayLabel(startDate);
  const endLabel = formatShortDayLabel(endDate);

  if (!startDate || !endDate) {
    return "Periodo indisponivel";
  }

  if (startDate === endDate) {
    return startLabel;
  }

  return `${startLabel} a ${endLabel}`;
};

const buildWindowForPreset = (period, now = new Date()) => {
  return buildOperationalWindowForPreset(period, now);
};

const parseCustomWindow = (startDate, endDate, now = new Date()) => {
  return parseOperationalCustomWindow(startDate, endDate, now);
};

const normalizeMetricsFilters = (filters = {}, options = {}) => {
  const now = options.now instanceof Date ? options.now : new Date();
  const requestedPeriod = String(filters.period || "").trim().toLowerCase();
  const period = METRIC_PERIOD_OPTIONS.some((entry) => entry.key === requestedPeriod)
    ? requestedPeriod
    : "7d";
  const adminLogin = String(filters.adminLogin || "").trim().toLowerCase();
  const status = String(filters.status || "").trim();
  const flow = String(filters.flow || "").trim().toLowerCase();
  const normalizedFlow = METRIC_FLOW_OPTIONS.some((entry) => entry.key === flow) ? flow : "";
  const window =
    period === "custom"
      ? parseCustomWindow(filters.startDate, filters.endDate, now)
      : buildWindowForPreset(period, now);

  return {
    period,
    periodLabel:
      METRIC_PERIOD_OPTIONS.find((entry) => entry.key === period)?.label || "Ultimos 7 dias",
    adminLogin,
    status,
    flow: normalizedFlow,
    startDate: window.startDate,
    endDate: window.endDate,
    startIso: window.startIso,
    endIso: window.endIso,
    startMs: window.startMs,
    endMs: window.endMs,
    dayCount: window.dayCount,
    rangeLabel: formatRangeLabel(window.startDate, window.endDate),
  };
};

const buildComparisonWindowFromFilters = (filters = {}) => {
  const durationMs = Math.max(DAY_MS, Number(filters.endMs || 0) - Number(filters.startMs || 0));
  const startMs = Number(filters.startMs || 0) - durationMs;
  const endMs = Number(filters.startMs || 0);
  const comparisonWindow = buildOperationalWindow(startMs, endMs);
  const comparisonLabelByPeriod = {
    today: "Ontem",
    "7d": "7 dias anteriores",
    "30d": "30 dias anteriores",
    custom: "Periodo anterior equivalente",
  };

  return {
    ...filters,
    period: "comparison",
    periodLabel: comparisonLabelByPeriod[filters.period] || "Periodo anterior",
    startDate: comparisonWindow.startDate,
    endDate: comparisonWindow.endDate,
    startIso: comparisonWindow.startIso,
    endIso: comparisonWindow.endIso,
    startMs: comparisonWindow.startMs,
    endMs: comparisonWindow.endMs,
    dayCount: comparisonWindow.dayCount,
    rangeLabel: formatRangeLabel(comparisonWindow.startDate, comparisonWindow.endDate),
  };
};

const clampRate = (value) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Number(value.toFixed(1))));
};

const averageMs = (samples) => {
  const validSamples = samples.filter((value) => Number.isFinite(value) && value >= 0);

  if (validSamples.length === 0) {
    return null;
  }

  return Math.round(validSamples.reduce((sum, value) => sum + value, 0) / validSamples.length);
};

const createStageMetric = (key, label, samples) => ({
  key,
  label,
  sampleCount: samples.filter((value) => Number.isFinite(value) && value >= 0).length,
  averageMs: averageMs(samples),
});

const normalizeOrderRecord = (order) => ({
  id: String(order?.id || "").trim(),
  publicId: String(order?.publicId || "").trim(),
  customerName: String(order?.customerName || "").trim(),
  fulfillmentMode: String(order?.fulfillmentMode || "").trim().toLowerCase(),
  timingMode: String(order?.timingMode || "").trim().toLowerCase(),
  status:
    resolveCanonicalOrderStatus(order?.status, order?.fulfillmentMode) ||
    String(order?.status || "").trim(),
  totalAmount: Number(order?.totalAmount ?? order?.total ?? 0),
  createdAt: toIsoString(order?.createdAt),
  updatedAt: toIsoString(order?.updatedAt || order?.createdAt),
});

const normalizeEventRecord = (event) => ({
  id: String(event?.id || "").trim(),
  orderId: String(event?.orderId || "").trim(),
  publicId: String(event?.publicId || "").trim(),
  customerName: String(event?.customerName || "").trim(),
  action: String(event?.action || "status_updated").trim(),
  status:
    resolveCanonicalOrderStatus(
      event?.status,
      event?.metadata?.fulfillmentMode || event?.metadata?.fulfillment_mode || ""
    ) ||
    String(event?.status || "").trim(),
  note: String(event?.note || "").trim(),
  source: String(event?.source || "system").trim(),
  adminLogin: String(event?.adminLogin || "").trim().toLowerCase(),
  adminDisplayName: String(event?.adminDisplayName || "").trim(),
  metadata: event?.metadata && typeof event.metadata === "object" ? event.metadata : {},
  createdAt: toIsoString(event?.createdAt),
});

const orderMatchesFlow = (order, flow) => {
  if (!flow) {
    return true;
  }

  if (flow === "scheduled") {
    return order.timingMode === "scheduled";
  }

  return order.fulfillmentMode === flow;
};

const buildOrderEventMap = (events) =>
  events.reduce((summary, event) => {
    if (!event.orderId) {
      return summary;
    }

    if (!summary.has(event.orderId)) {
      summary.set(event.orderId, []);
    }

    summary.get(event.orderId).push(event);
    return summary;
  }, new Map());

const sortEventsAscending = (events) =>
  events
    .slice()
    .filter((event) => event.createdAt)
    .sort((left, right) => toTimestamp(left.createdAt) - toTimestamp(right.createdAt));

const findFirstEventAt = (events, predicate) => {
  const match = events.find((event) => predicate(event));
  return match?.createdAt || "";
};

const buildOrderTimeline = (order, events) => {
  const orderedEvents = sortEventsAscending(events);
  const firstAdminEvent = orderedEvents.find((event) => event.adminLogin);
  const acceptedAt = findFirstEventAt(
    orderedEvents,
    (event) => event.action === "order_accepted" || event.status === "Aceito"
  );
  const preparingAt = findFirstEventAt(
    orderedEvents,
    (event) => event.action === "order_marked_preparing" || event.status === "Em preparo"
  );
  const readyAt = findFirstEventAt(
    orderedEvents,
    (event) => event.action === "order_marked_ready" || event.status === "Pronto"
  );
  const dispatchAt = findFirstEventAt(
    orderedEvents,
    (event) => event.action === "order_out_for_delivery" || event.status === "Saiu para entrega"
  );
  const pickedUpAt = findFirstEventAt(
    orderedEvents,
    (event) => event.action === "order_marked_picked_up"
  );
  const finalizedAt = findFirstEventAt(
    orderedEvents,
    (event) => event.action === "order_finalized"
  );
  const cancelledAt = findFirstEventAt(
    orderedEvents,
    (event) => event.action === "order_cancelled" || event.status === "Cancelado"
  );

  return {
    createdAt: order.createdAt,
    firstAdminAt: firstAdminEvent?.createdAt || acceptedAt || "",
    firstAdminLogin: firstAdminEvent?.adminLogin || "",
    firstAdminDisplayName: firstAdminEvent?.adminDisplayName || "",
    acceptedAt,
    preparingAt,
    readyAt,
    dispatchAt,
    pickedUpAt,
    finalizedAt,
    cancelledAt: cancelledAt || (order.status === "Cancelado" ? order.updatedAt : ""),
    completedAt:
      pickedUpAt ||
      finalizedAt ||
      (order.status === "Entregue" || order.status === "Retirada concluida" ? order.updatedAt : ""),
  };
};

const diffMs = (startValue, endValue) => {
  const startMs = toTimestamp(startValue);
  const endMs = toTimestamp(endValue);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null;
  }

  return endMs - startMs;
};

const buildStatusBreakdown = (orders) =>
  ORDER_STATUSES.map((status) => ({
    key: status,
    label: status,
    value: orders.filter((order) => order.status === status).length,
  }));

const buildFlowBreakdown = (orders) => {
  const deliveryOrders = orders.filter((order) => order.fulfillmentMode === "delivery").length;
  const pickupOrders = orders.filter((order) => order.fulfillmentMode === "pickup").length;
  const scheduledOrders = orders.filter((order) => order.timingMode === "scheduled").length;

  return [
    { key: "delivery", label: "Entrega", value: deliveryOrders },
    { key: "pickup", label: "Retirada", value: pickupOrders },
    { key: "scheduled", label: "Agendados", value: scheduledOrders },
  ];
};

const buildAdminMetrics = (orders, timelineByOrderId, events, filters) => {
  const filteredEvents = filters.adminLogin
    ? events.filter((event) => event.adminLogin === filters.adminLogin)
    : events.filter((event) => event.adminLogin);
  const eventsByAdmin = filteredEvents.reduce((summary, event) => {
    if (!event.adminLogin) {
      return summary;
    }

    if (!summary.has(event.adminLogin)) {
      summary.set(event.adminLogin, {
        adminLogin: event.adminLogin,
        adminDisplayName: event.adminDisplayName || event.adminLogin,
        totalActions: 0,
        touchedOrders: new Set(),
        acceptedOrders: new Set(),
        finalizedOrders: new Set(),
        cancelledOrders: new Set(),
        firstResponseSamples: [],
        lastActionAt: "",
      });
    }

    const adminSummary = summary.get(event.adminLogin);
    adminSummary.totalActions += 1;
    adminSummary.touchedOrders.add(event.orderId);

    if (event.action === "order_accepted") {
      adminSummary.acceptedOrders.add(event.orderId);
    }

    if (event.action === "order_finalized" || event.action === "order_marked_picked_up") {
      adminSummary.finalizedOrders.add(event.orderId);
    }

    if (event.action === "order_cancelled") {
      adminSummary.cancelledOrders.add(event.orderId);
    }

    if (!adminSummary.lastActionAt || toTimestamp(event.createdAt) > toTimestamp(adminSummary.lastActionAt)) {
      adminSummary.lastActionAt = event.createdAt;
      adminSummary.adminDisplayName = event.adminDisplayName || adminSummary.adminDisplayName;
    }

    return summary;
  }, new Map());

  orders.forEach((order) => {
    const timeline = timelineByOrderId.get(order.id);

    if (!timeline?.firstAdminLogin) {
      return;
    }

    const initialResponseMs = diffMs(order.createdAt, timeline.firstAdminAt);

    if (!Number.isFinite(initialResponseMs)) {
      return;
    }

    if (!eventsByAdmin.has(timeline.firstAdminLogin)) {
      eventsByAdmin.set(timeline.firstAdminLogin, {
        adminLogin: timeline.firstAdminLogin,
        adminDisplayName: timeline.firstAdminDisplayName || timeline.firstAdminLogin,
        totalActions: 0,
        touchedOrders: new Set(),
        acceptedOrders: new Set(),
        finalizedOrders: new Set(),
        cancelledOrders: new Set(),
        firstResponseSamples: [],
        lastActionAt: "",
      });
    }

    eventsByAdmin.get(timeline.firstAdminLogin).firstResponseSamples.push(initialResponseMs);
  });

  const totalActions = Array.from(eventsByAdmin.values()).reduce((sum, entry) => sum + entry.totalActions, 0);

  return Array.from(eventsByAdmin.values())
    .map((entry) => ({
      adminLogin: entry.adminLogin,
      adminDisplayName: entry.adminDisplayName || entry.adminLogin,
      totalActions: entry.totalActions,
      touchedOrders: entry.touchedOrders.size,
      acceptedOrders: entry.acceptedOrders.size,
      finalizedOrders: entry.finalizedOrders.size,
      cancelledOrders: entry.cancelledOrders.size,
      initialResponseSamples: entry.firstResponseSamples.length,
      initialResponseAverageMs: averageMs(entry.firstResponseSamples),
      participationRate: totalActions > 0 ? clampRate((entry.totalActions / totalActions) * 100) : 0,
      lastActionAt: entry.lastActionAt || "",
    }))
    .sort((left, right) => {
      if (right.totalActions !== left.totalActions) {
        return right.totalActions - left.totalActions;
      }

      if (right.finalizedOrders !== left.finalizedOrders) {
        return right.finalizedOrders - left.finalizedOrders;
      }

      return left.adminDisplayName.localeCompare(right.adminDisplayName, "pt-BR");
    });
};

const buildDailySeries = (orders, filters) => {
  const buckets = Array.from({ length: filters.dayCount }, (_, index) => {
    const dayStartMs = filters.startMs + index * DAY_MS;
    const date = toOperationalDateInput(dayStartMs);

    return {
      index,
      date,
      label: formatShortDayLabel(date),
      orders: 0,
      cancelled: 0,
      finalized: 0,
      delivery: 0,
      pickup: 0,
      revenue: 0,
    };
  });

  orders.forEach((order) => {
    const createdAtMs = toTimestamp(order.createdAt);

    if (!Number.isFinite(createdAtMs)) {
      return;
    }

    const index = Math.floor((createdAtMs - filters.startMs) / DAY_MS);

    if (index < 0 || index >= buckets.length) {
      return;
    }

    const bucket = buckets[index];
    bucket.orders += 1;
    bucket.cancelled += order.status === "Cancelado" ? 1 : 0;
    bucket.finalized += ["Entregue", "Retirada concluida"].includes(order.status) ? 1 : 0;
    bucket.delivery += order.fulfillmentMode === "delivery" ? 1 : 0;
    bucket.pickup += order.fulfillmentMode === "pickup" ? 1 : 0;
    bucket.revenue += order.status === "Cancelado" ? 0 : Number(order.totalAmount || 0);
  });

  return buckets.map((bucket) => ({
    ...bucket,
    revenue: Number(bucket.revenue.toFixed(2)),
  }));
};

const buildCumulativeSeries = (dailySeries) => {
  let runningOrders = 0;
  let runningRevenue = 0;

  return dailySeries.map((entry) => {
    runningOrders += Number(entry.orders || 0);
    runningRevenue += Number(entry.revenue || 0);

    return {
      date: entry.date,
      label: entry.label,
      orders: runningOrders,
      revenue: Number(runningRevenue.toFixed(2)),
    };
  });
};

const buildHighlights = (overview, byAdmin, stageMetrics) => {
  const mostActiveAdmin = byAdmin[0] || null;
  const bestResponseAdmin =
    byAdmin
      .filter((entry) => Number.isFinite(entry.initialResponseAverageMs))
      .slice()
      .sort((left, right) => left.initialResponseAverageMs - right.initialResponseAverageMs)[0] || null;
  const completionLeader =
    byAdmin
      .filter((entry) => entry.finalizedOrders > 0)
      .slice()
      .sort((left, right) => right.finalizedOrders - left.finalizedOrders)[0] || null;
  const responseMetric = stageMetrics.find((entry) => entry.key === "firstResponse");

  return {
    auditCoverageRate: overview.totalOrders > 0
      ? clampRate((overview.ordersWithAudit / overview.totalOrders) * 100)
      : 0,
    responseCoverageRate:
      overview.totalOrders > 0 && responseMetric
        ? clampRate((responseMetric.sampleCount / overview.totalOrders) * 100)
        : 0,
    mostActiveAdmin: mostActiveAdmin
      ? {
          adminLogin: mostActiveAdmin.adminLogin,
          adminDisplayName: mostActiveAdmin.adminDisplayName,
          totalActions: mostActiveAdmin.totalActions,
        }
      : null,
    bestResponseAdmin: bestResponseAdmin
      ? {
          adminLogin: bestResponseAdmin.adminLogin,
          adminDisplayName: bestResponseAdmin.adminDisplayName,
          averageMs: bestResponseAdmin.initialResponseAverageMs,
        }
      : null,
    completionLeader: completionLeader
      ? {
          adminLogin: completionLeader.adminLogin,
          adminDisplayName: completionLeader.adminDisplayName,
          finalizedOrders: completionLeader.finalizedOrders,
        }
      : null,
  };
};

const buildDeltaMetric = (key, label, currentValue, previousValue, options = {}) => {
  const numericCurrent = Number(currentValue);
  const numericPrevious = Number(previousValue);
  const hasCurrent = Number.isFinite(numericCurrent);
  const hasPrevious = Number.isFinite(numericPrevious);
  const deltaValue = hasCurrent && hasPrevious ? numericCurrent - numericPrevious : null;
  const deltaPercent =
    hasCurrent && hasPrevious
      ? numericPrevious === 0
        ? numericCurrent === 0
          ? 0
          : null
        : Number((((numericCurrent - numericPrevious) / Math.abs(numericPrevious)) * 100).toFixed(1))
      : null;
  const direction =
    !hasCurrent || !hasPrevious || numericCurrent === numericPrevious
      ? "flat"
      : numericCurrent > numericPrevious
        ? "up"
        : "down";
  const better = options.better === "down" ? "down" : "up";
  const tone =
    direction === "flat"
      ? "neutral"
      : better === "down"
        ? direction === "down"
          ? "positive"
          : "negative"
        : direction === "up"
          ? "positive"
          : "negative";

  return {
    key,
    label,
    unit: options.unit || "count",
    currentValue: hasCurrent ? numericCurrent : null,
    previousValue: hasPrevious ? numericPrevious : null,
    deltaValue,
    deltaPercent,
    direction,
    tone,
    currentRangeLabel: options.currentRangeLabel || "",
    previousRangeLabel: options.previousRangeLabel || "",
  };
};

const computePeriodMetrics = (normalizedOrders, normalizedEvents, filters) => {
  const orderEventMap = buildOrderEventMap(normalizedEvents);
  const filteredOrders = normalizedOrders.filter((order) => {
    const createdAtMs = toTimestamp(order.createdAt);

    if (!Number.isFinite(createdAtMs) || createdAtMs < filters.startMs || createdAtMs >= filters.endMs) {
      return false;
    }

    if (filters.status && order.status !== filters.status) {
      return false;
    }

    if (!orderMatchesFlow(order, filters.flow)) {
      return false;
    }

    if (!filters.adminLogin) {
      return true;
    }

    return (orderEventMap.get(order.id) || []).some((event) => event.adminLogin === filters.adminLogin);
  });
  const filteredOrderIds = new Set(filteredOrders.map((order) => order.id));
  const filteredEvents = normalizedEvents.filter((event) => filteredOrderIds.has(event.orderId));
  const timelineByOrderId = filteredOrders.reduce((summary, order) => {
    summary.set(order.id, buildOrderTimeline(order, orderEventMap.get(order.id) || []));
    return summary;
  }, new Map());
  const finalizedOrders = filteredOrders.filter((order) =>
    ["Entregue", "Retirada concluida"].includes(order.status)
  );
  const cancelledOrders = filteredOrders.filter((order) => order.status === "Cancelado");
  const pickedUpOrders = filteredOrders.filter((order) => {
    const timeline = timelineByOrderId.get(order.id);
    return Boolean(
      timeline?.pickedUpAt ||
      (order.fulfillmentMode === "pickup" && order.status === "Retirada concluida")
    );
  });
  const stageMetrics = [
    createStageMetric(
      "firstResponse",
      "Tempo medio de resposta inicial",
      filteredOrders.map((order) => diffMs(order.createdAt, timelineByOrderId.get(order.id)?.firstAdminAt))
    ),
    createStageMetric(
      "createdToAccepted",
      "Criacao ate aceite",
      filteredOrders.map((order) => diffMs(order.createdAt, timelineByOrderId.get(order.id)?.acceptedAt))
    ),
    createStageMetric(
      "acceptedToPreparing",
      "Aceite ate preparo",
      filteredOrders.map((order) => diffMs(
        timelineByOrderId.get(order.id)?.acceptedAt,
        timelineByOrderId.get(order.id)?.preparingAt
      ))
    ),
    createStageMetric(
      "preparingToReady",
      "Preparo ate pronto",
      filteredOrders.map((order) => diffMs(
        timelineByOrderId.get(order.id)?.preparingAt,
        timelineByOrderId.get(order.id)?.readyAt
      ))
    ),
    createStageMetric(
      "dispatchOrPickup",
      "Criacao ate despacho ou retirada",
      filteredOrders.map((order) => {
        const timeline = timelineByOrderId.get(order.id);
        return diffMs(
          order.createdAt,
          timeline?.dispatchAt ||
            timeline?.pickedUpAt ||
            (order.fulfillmentMode === "pickup" ? timeline?.completedAt : "")
        );
      })
    ),
    createStageMetric(
      "completion",
      "Criacao ate finalizacao",
      filteredOrders.map((order) => diffMs(order.createdAt, timelineByOrderId.get(order.id)?.completedAt))
    ),
  ];
  const byAdmin = buildAdminMetrics(filteredOrders, timelineByOrderId, filteredEvents, filters);
  const ordersWithAudit = filteredOrders.filter((order) => (orderEventMap.get(order.id) || []).length > 0).length;
  const dailySeries = buildDailySeries(filteredOrders, filters);
  const overview = {
    totalOrders: filteredOrders.length,
    totalFinalized: finalizedOrders.length,
    totalCancelled: cancelledOrders.length,
    totalPickedUp: pickedUpOrders.length,
    totalInDelivery: filteredOrders.filter((order) => order.status === "Saiu para entrega").length,
    totalRevenue: Number(
      filteredOrders
        .filter((order) => order.status !== "Cancelado")
        .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0)
        .toFixed(2)
    ),
    averageTicket:
      filteredOrders.filter((order) => order.status !== "Cancelado").length > 0
        ? Number(
            (
              filteredOrders
                .filter((order) => order.status !== "Cancelado")
                .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0) /
              filteredOrders.filter((order) => order.status !== "Cancelado").length
            ).toFixed(2)
          )
        : 0,
    cancellationRate:
      filteredOrders.length > 0 ? clampRate((cancelledOrders.length / filteredOrders.length) * 100) : 0,
    completionRate:
      filteredOrders.length > 0 ? clampRate((finalizedOrders.length / filteredOrders.length) * 100) : 0,
    ordersWithAudit,
    ordersWithAdminAction: filteredOrders.filter(
      (order) => (orderEventMap.get(order.id) || []).some((event) => event.adminLogin)
    ).length,
  };

  return {
    filters,
    overview,
    stageMetrics,
    byAdmin,
    statusBreakdown: buildStatusBreakdown(filteredOrders),
    flowBreakdown: buildFlowBreakdown(filteredOrders),
    highlights: buildHighlights(overview, byAdmin, stageMetrics),
    dailySeries,
    cumulativeSeries: buildCumulativeSeries(dailySeries),
  };
};

const buildComparisonPayload = (currentMetrics, previousMetrics) => {
  const currentRangeLabel = currentMetrics.filters.rangeLabel;
  const previousRangeLabel = previousMetrics.filters.rangeLabel;
  const currentFirstResponse = currentMetrics.stageMetrics.find((entry) => entry.key === "firstResponse")?.averageMs;
  const previousFirstResponse = previousMetrics.stageMetrics.find((entry) => entry.key === "firstResponse")?.averageMs;
  const currentCompletionTime = currentMetrics.stageMetrics.find((entry) => entry.key === "completion")?.averageMs;
  const previousCompletionTime = previousMetrics.stageMetrics.find((entry) => entry.key === "completion")?.averageMs;

  const metrics = {
    totalOrders: buildDeltaMetric(
      "totalOrders",
      "Pedidos",
      currentMetrics.overview.totalOrders,
      previousMetrics.overview.totalOrders,
      { better: "up", unit: "count", currentRangeLabel, previousRangeLabel }
    ),
    totalRevenue: buildDeltaMetric(
      "totalRevenue",
      "Receita valida",
      currentMetrics.overview.totalRevenue,
      previousMetrics.overview.totalRevenue,
      { better: "up", unit: "currency", currentRangeLabel, previousRangeLabel }
    ),
    cancellationRate: buildDeltaMetric(
      "cancellationRate",
      "Taxa de cancelamento",
      currentMetrics.overview.cancellationRate,
      previousMetrics.overview.cancellationRate,
      { better: "down", unit: "percent", currentRangeLabel, previousRangeLabel }
    ),
    completionRate: buildDeltaMetric(
      "completionRate",
      "Taxa de conclusao",
      currentMetrics.overview.completionRate,
      previousMetrics.overview.completionRate,
      { better: "up", unit: "percent", currentRangeLabel, previousRangeLabel }
    ),
    firstResponse: buildDeltaMetric(
      "firstResponse",
      "Resposta inicial",
      currentFirstResponse,
      previousFirstResponse,
      { better: "down", unit: "duration", currentRangeLabel, previousRangeLabel }
    ),
    completionTime: buildDeltaMetric(
      "completionTime",
      "Tempo medio ate conclusao",
      currentCompletionTime,
      previousCompletionTime,
      { better: "down", unit: "duration", currentRangeLabel, previousRangeLabel }
    ),
  };

  return {
    currentRangeLabel,
    previousRangeLabel,
    metrics,
    trends: [
      {
        ...metrics.totalOrders,
        key: "ordersTrend",
        label: "Tendencia de pedidos",
      },
      {
        ...metrics.cancellationRate,
        key: "cancellationTrend",
        label: "Tendencia de cancelamento",
      },
      {
        ...(Number.isFinite(metrics.completionTime.currentValue) || Number.isFinite(metrics.completionTime.previousValue)
          ? metrics.completionTime
          : metrics.firstResponse),
        key: "averageTimeTrend",
        label: "Tendencia de tempo medio",
      },
    ],
  };
};

const buildChartsPayload = (currentMetrics, previousMetrics) => ({
  ordersByDay: {
    label: "Pedidos por dia",
    current: currentMetrics.dailySeries.map((entry) => ({
      date: entry.date,
      label: entry.label,
      value: entry.orders,
    })),
    previous: previousMetrics.dailySeries.map((entry) => ({
      date: entry.date,
      label: entry.label,
      value: entry.orders,
    })),
  },
  cumulativeOrders: {
    label: "Evolucao acumulada",
    current: currentMetrics.cumulativeSeries.map((entry) => ({
      date: entry.date,
      label: entry.label,
      value: entry.orders,
    })),
    previous: previousMetrics.cumulativeSeries.map((entry) => ({
      date: entry.date,
      label: entry.label,
      value: entry.orders,
    })),
  },
  status: currentMetrics.statusBreakdown,
  flows: currentMetrics.flowBreakdown,
});

const buildAdminMetricsSnapshot = ({
  orders = [],
  events = [],
  filters = {},
  adminOptions = [],
  generatedAt = new Date().toISOString(),
  storageMode = "",
} = {}) => {
  const normalizedFilters = normalizeMetricsFilters(filters);
  const comparisonFilters = buildComparisonWindowFromFilters(normalizedFilters);
  const normalizedOrders = Array.isArray(orders)
    ? orders.map(normalizeOrderRecord).filter((order) => order.id && order.createdAt)
    : [];
  const normalizedEvents = Array.isArray(events)
    ? events.map(normalizeEventRecord).filter((event) => event.orderId && event.createdAt)
    : [];
  const currentMetrics = computePeriodMetrics(normalizedOrders, normalizedEvents, normalizedFilters);
  const previousMetrics = computePeriodMetrics(normalizedOrders, normalizedEvents, comparisonFilters);

  return {
    generatedAt: toIsoString(generatedAt) || new Date().toISOString(),
    storageMode: String(storageMode || "").trim(),
    filters: normalizedFilters,
    periodOptions: METRIC_PERIOD_OPTIONS,
    flowOptions: METRIC_FLOW_OPTIONS,
    statusOptions: METRIC_STATUS_OPTIONS,
    adminOptions: Array.isArray(adminOptions)
      ? adminOptions
          .filter((entry) => String(entry?.login || "").trim())
          .map((entry) => ({
            login: String(entry.login || "").trim().toLowerCase(),
            displayName: String(entry.displayName || entry.login || "").trim(),
          }))
          .filter(
            (entry, index, items) =>
              items.findIndex((candidate) => candidate.login === entry.login) === index
          )
          .sort((left, right) => left.displayName.localeCompare(right.displayName, "pt-BR"))
      : [],
    overview: currentMetrics.overview,
    stageMetrics: currentMetrics.stageMetrics,
    byAdmin: currentMetrics.byAdmin,
    statusBreakdown: currentMetrics.statusBreakdown,
    flowBreakdown: currentMetrics.flowBreakdown,
    highlights: currentMetrics.highlights,
    comparison: buildComparisonPayload(currentMetrics, previousMetrics),
    charts: buildChartsPayload(currentMetrics, previousMetrics),
  };
};

module.exports = {
  METRIC_FLOW_OPTIONS,
  METRIC_PERIOD_OPTIONS,
  METRIC_STATUS_OPTIONS,
  buildAdminMetricsSnapshot,
  buildComparisonWindowFromFilters,
  normalizeMetricsFilters,
};
