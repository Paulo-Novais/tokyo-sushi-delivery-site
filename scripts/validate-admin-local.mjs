import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const realDataDirectory = path.join(workspaceRoot, ".data");

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"],
  [".xml", "application/xml; charset=utf-8"],
]);

const BASE_TIME_MS = new Date("2026-06-21T18:30:00-03:00").getTime();
const PROTECTED_ADMIN_PATHS = new Set([
  "/api/admin/orders/list",
  "/api/admin/orders/details",
  "/api/admin/audit",
  "/api/admin/catalog/list",
  "/api/admin/customers/list",
  "/api/admin/reviews/list",
  "/api/admin/settings/list",
  "/api/admin/inventory/list",
  "/api/admin/finance",
]);

const createStaticServer = (rootDirectory) =>
  http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
      let pathname = decodeURIComponent(requestUrl.pathname);

      if (pathname === "/") {
        pathname = "/index.html";
      }

      if (pathname === "/admin/") {
        pathname = "/admin/index.html";
      }

      const requestedPath = path.resolve(rootDirectory, `.${pathname}`);

      if (!requestedPath.startsWith(rootDirectory)) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Forbidden");
        return;
      }

      const stats = await fs.stat(requestedPath).catch(() => null);

      if (!stats || !stats.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }

      const extension = path.extname(requestedPath).toLowerCase();
      const contentType = MIME_TYPES.get(extension) || "application/octet-stream";
      const body = await fs.readFile(requestedPath);

      res.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": contentType,
      });
      res.end(body);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Internal server error");
    }
  });

const listen = (server) =>
  new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        host: "127.0.0.1",
        port: Number(address.port),
      });
    });
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForCondition = async (predicate, message, timeoutMs = 12000, intervalMs = 100) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    if (await predicate()) {
      return;
    }

    await sleep(intervalMs);
  }

  throw new Error(message);
};

const getDirectoryFingerprint = async (directoryPath) => {
  const stats = await fs.stat(directoryPath).catch(() => null);

  if (!stats) {
    return { exists: false, entries: [] };
  }

  assert.ok(stats.isDirectory(), ".data real deveria ser diretorio quando existir.");

  const entries = [];

  const visit = async (currentPath, relativeBase = "") => {
    const children = await fs.readdir(currentPath, { withFileTypes: true });

    for (const child of children) {
      const childPath = path.join(currentPath, child.name);
      const relativePath = path.join(relativeBase, child.name).replace(/\\/g, "/");
      const childStats = await fs.stat(childPath);

      entries.push({
        path: relativePath,
        type: child.isDirectory() ? "dir" : "file",
        size: childStats.size,
        mtimeMs: Math.round(childStats.mtimeMs),
      });

      if (child.isDirectory()) {
        await visit(childPath, relativePath);
      }
    }
  };

  await visit(directoryPath);
  entries.sort((left, right) => left.path.localeCompare(right.path));

  return { exists: true, entries };
};

const pad = (value) => String(value).padStart(3, "0");

const buildAuditTrail = (status, createdAt, note) => [
  {
    id: `audit-${status}-${createdAt}`,
    action: "status_updated",
    actionLabel: `Status ${status}`,
    status,
    note,
    source: "admin",
    adminLogin: "gestor.local",
    adminDisplayName: "Gestor Local",
    createdAt,
  },
];

const buildOrder = ({
  code,
  status,
  createdOffsetMinutes,
  customerName,
  fulfillmentMode = "delivery",
  timingMode = "immediate",
  paymentMethod = "pix",
  totalAmount = 89.9,
  financialStatus = "paid",
}) => {
  const createdAt = new Date(BASE_TIME_MS + createdOffsetMinutes * 60000).toISOString();
  const orderId = `order-${code.toLowerCase()}`;
  const scheduledFor =
    timingMode === "scheduled" ? new Date(BASE_TIME_MS + (createdOffsetMinutes + 90) * 60000).toISOString() : null;
  const note =
    {
      Recebido: "Pedido aguardando aceite.",
      Aceito: "Pedido aceito pela operacao.",
      "Em preparo": "Pedido na cozinha.",
      Pronto: "Pedido pronto para saida.",
      "Saiu para entrega": "Pedido em rota.",
      Entregue: "Entrega concluida.",
      "Retirada concluida": "Retirada concluida.",
      Cancelado: "Pedido cancelado na validacao.",
    }[status] || "Pedido em acompanhamento.";
  const subtotal = Number((totalAmount - (fulfillmentMode === "pickup" ? 0 : 8.9)).toFixed(2));

  return {
    id: orderId,
    publicId: `TKY-${code}`,
    status,
    customerName,
    customerPhone: "(11) 97777-0101",
    customerEmail: `${orderId}@teste.local`,
    customerNotes: "Pedido sintetico da validacao admin local.",
    orderType: timingMode === "scheduled" ? "scheduled" : "delivery",
    fulfillmentMode,
    timingMode,
    scheduledFor,
    scheduledDate: scheduledFor ? scheduledFor.slice(0, 10) : "",
    scheduledTime: scheduledFor ? scheduledFor.slice(11, 16) : "",
    scheduledLabel: scheduledFor ? `${scheduledFor.slice(0, 10)} ${scheduledFor.slice(11, 16)}` : "",
    paymentMethod,
    financialStatus,
    needsChange: false,
    cashAmount: null,
    changeAmount: null,
    itemCount: 2,
    subtotal,
    productRevenue: subtotal,
    addonsTotal: 0,
    deliveryFee: fulfillmentMode === "pickup" ? 0 : 8.9,
    discountAmount: 0,
    totalAmount,
    addressFull: fulfillmentMode === "pickup" ? "" : "Rua Validacao, 123 - Centro, Franca - SP",
    addressComplement: "Sala 1",
    addressReference: "Porta lateral",
    addressNeighborhood: "Centro",
    addressCity: "Franca",
    addressState: "SP",
    deliveryDistanceText: fulfillmentMode === "pickup" ? "" : "3,2 km",
    deliveryRouteBand: fulfillmentMode === "pickup" ? "" : "Centro expandido",
    deliveryEstimateText: fulfillmentMode === "pickup" ? "" : "40-55 min",
    latestStatusNote: note,
    itemPreview: "Combo validacao + molho",
    createdAt,
    updatedAt: createdAt,
    occurredAt: createdAt,
    items: [
      {
        id: `${orderId}-combo`,
        type: "product",
        name: "Combo Validacao",
        category: "Combinados",
        quantity: 1,
        unitPrice: subtotal,
        totalPrice: subtotal,
        metadata: {},
      },
      {
        id: `${orderId}-addon`,
        type: "addon",
        name: "Molho especial",
        category: "Complemento",
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
        metadata: {},
      },
    ],
    auditTrail: buildAuditTrail(status, createdAt, note),
  };
};

const buildOrders = () => [
  buildOrder({
    code: "ADM-001",
    status: "Recebido",
    createdOffsetMinutes: -50,
    customerName: "Cliente Recebido",
    totalAmount: 72.5,
    financialStatus: "pending",
  }),
  buildOrder({
    code: "ADM-002",
    status: "Aceito",
    createdOffsetMinutes: -45,
    customerName: "Cliente Aceito",
    timingMode: "scheduled",
    totalAmount: 96.4,
  }),
  buildOrder({
    code: "ADM-003",
    status: "Em preparo",
    createdOffsetMinutes: -35,
    customerName: "Cliente Preparo",
    totalAmount: 88.9,
  }),
  buildOrder({
    code: "ADM-004",
    status: "Pronto",
    createdOffsetMinutes: -25,
    customerName: "Cliente Pronto",
    totalAmount: 81.2,
  }),
  buildOrder({
    code: "ADM-005",
    status: "Saiu para entrega",
    createdOffsetMinutes: -15,
    customerName: "Cliente Rota",
    totalAmount: 109.9,
  }),
  buildOrder({
    code: "ADM-006",
    status: "Entregue",
    createdOffsetMinutes: -120,
    customerName: "Cliente Entregue",
    totalAmount: 119.9,
  }),
  buildOrder({
    code: "ADM-007",
    status: "Cancelado",
    createdOffsetMinutes: -140,
    customerName: "Cliente Cancelado",
    totalAmount: 62.1,
    financialStatus: "cancelled",
  }),
  buildOrder({
    code: "ADM-008",
    status: "Retirada concluida",
    createdOffsetMinutes: -160,
    customerName: "Cliente Retirada",
    fulfillmentMode: "pickup",
    paymentMethod: "debito",
    totalAmount: 54.4,
  }),
];

const calculateStats = (orders) => {
  const byStatus = orders.reduce((summary, order) => {
    summary[order.status] = (summary[order.status] || 0) + 1;
    return summary;
  }, {});
  const activeOrders = orders.filter(
    (order) => !["Entregue", "Retirada concluida", "Cancelado"].includes(order.status)
  );

  return {
    totalOrders: orders.length,
    newOrders: byStatus.Recebido || 0,
    activeOrders: activeOrders.length,
    scheduledOrders: orders.filter((order) => order.timingMode === "scheduled").length,
    todayOrders: orders.length,
    preparingOrders: byStatus["Em preparo"] || 0,
    readyOrders: byStatus.Pronto || 0,
    deliveryOrders: byStatus["Saiu para entrega"] || 0,
    todayRevenue: orders
      .filter((order) => order.status !== "Cancelado")
      .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
    byStatus,
  };
};

const catalogPayload = {
  ok: true,
  storageMode: "validation-mock",
  generatedAt: new Date(BASE_TIME_MS).toISOString(),
  summary: {
    totalSections: 2,
    totalItems: 3,
    activeItems: 2,
    pausedItems: 1,
    unavailableItems: 0,
    promotedItems: 1,
    highlightedItems: 1,
    itemsWithoutPrice: 0,
  },
  sections: [
    {
      id: "combinados",
      title: "Combinados",
      name: "Combinados",
      description: "Combos principais",
      displayOrder: 1,
      isActive: true,
      items: [
        {
          id: "combo-validacao",
          sourceItemId: "combo-validacao",
          name: "Combo Validacao",
          category: "Combinados",
          description: "Item sintetico seguro",
          price: 89.9,
          image: "../site-images/combinado-sakura.png",
          isActive: true,
          isAvailable: true,
          isPaused: false,
          isHighlighted: true,
          promotionLabel: "Destaque",
        },
        {
          id: "combo-pausado",
          sourceItemId: "combo-pausado",
          name: "Combo Pausado",
          category: "Combinados",
          description: "Item pausado para leitura do gestor",
          price: 74.9,
          image: "../site-images/combinado-fuji.png",
          isActive: true,
          isAvailable: false,
          isPaused: true,
        },
      ],
    },
    {
      id: "entradas",
      title: "Entradas",
      name: "Entradas",
      description: "Entradas e porcoes",
      displayOrder: 2,
      isActive: true,
      items: [
        {
          id: "guioza-validacao",
          sourceItemId: "guioza-validacao",
          name: "Guioza Validacao",
          category: "Entradas",
          description: "Entrada sintetica",
          price: 29.9,
          image: "../site-images/guioza-premium.jpg",
          isActive: true,
          isAvailable: true,
          isPaused: false,
        },
      ],
    },
  ],
  sectionDisplayOrder: ["combinados", "entradas"],
  featuredItemId: "combo-validacao",
  featuredItemIds: ["combo-validacao"],
  catalogOptions: {
    sections: [
      { id: "combinados", title: "Combinados" },
      { id: "entradas", title: "Entradas" },
    ],
    categories: ["Combinados", "Entradas"],
  },
};

const customersPayload = {
  ok: true,
  storageMode: "validation-mock",
  generatedAt: new Date(BASE_TIME_MS).toISOString(),
  summary: {
    totalCustomers: 2,
    recurringCustomers: 1,
    vipCustomers: 1,
    attentionCustomers: 1,
    blockedCustomers: 0,
    lapsedCustomers: 1,
    totalOrders: 5,
    totalSpent: 459.5,
    averageTicket: 91.9,
    inactiveDays: 30,
  },
  tagOptions: [
    { key: "vip", label: "VIP" },
    { key: "recorrente", label: "Recorrente" },
    { key: "atencao", label: "Atencao" },
  ],
  customers: [
    {
      key: "phone:11977770101",
      customerKey: "phone:11977770101",
      customerName: "Cliente Recorrente",
      customerPhone: "(11) 97777-0101",
      customerEmail: "recorrente@teste.local",
      whatsappUrl: "https://wa.me/5511977770101",
      ordersCount: 4,
      revenueOrderCount: 4,
      activeOrders: 1,
      cancelledOrders: 0,
      totalSpent: 359.6,
      averageTicket: 89.9,
      totalItems: 8,
      lastOrderAt: new Date(BASE_TIME_MS - 35 * 60000).toISOString(),
      lastPurchaseAt: new Date(BASE_TIME_MS - 35 * 60000).toISOString(),
      daysSinceLastPurchase: 0,
      lastOrderPublicId: "TKY-ADM-003",
      lastStatus: "Em preparo",
      mostUsedAddress: "Rua Validacao, 123 - Centro",
      topItems: [{ name: "Combo Validacao", quantity: 4 }],
      orders: [],
      notes: "Cliente sintetico para validacao.",
      tags: ["vip", "recorrente"],
      updatedAt: new Date(BASE_TIME_MS).toISOString(),
      updatedByDisplayName: "Gestor Local",
      isRecurring: true,
      isLapsed: false,
      suggestedAction: "Mandar mensagem no WhatsApp",
    },
    {
      key: "phone:11988880202",
      customerKey: "phone:11988880202",
      customerName: "Cliente Sumido",
      customerPhone: "(11) 98888-0202",
      customerEmail: "sumido@teste.local",
      ordersCount: 1,
      revenueOrderCount: 1,
      activeOrders: 0,
      cancelledOrders: 0,
      totalSpent: 99.9,
      averageTicket: 99.9,
      totalItems: 2,
      lastOrderAt: new Date(BASE_TIME_MS - 45 * 24 * 60 * 60000).toISOString(),
      lastPurchaseAt: new Date(BASE_TIME_MS - 45 * 24 * 60 * 60000).toISOString(),
      daysSinceLastPurchase: 45,
      lastOrderPublicId: "TKY-OLD-001",
      lastStatus: "Entregue",
      mostUsedAddress: "Rua Antiga, 45 - Centro",
      topItems: [{ name: "Guioza Validacao", quantity: 1 }],
      orders: [],
      notes: "",
      tags: ["atencao"],
      updatedAt: "",
      updatedByDisplayName: "",
      isRecurring: false,
      isLapsed: true,
      suggestedAction: "Reativar cliente",
    },
  ],
};

const reviewsPayload = {
  ok: true,
  storageMode: "validation-mock",
  generatedAt: new Date(BASE_TIME_MS).toISOString(),
  summary: {
    totalReviews: 2,
    publishedReviews: 1,
    hiddenReviews: 1,
    expiredReviews: 0,
    recentReviews: 2,
    internalAverage: 4.5,
    displayAverage: 5,
  },
  reviews: [
    {
      id: "review-validacao-1",
      customerName: "Cliente Satisfeito",
      customerContact: "(11) 97777-0303",
      customerPhone: "(11) 97777-0303",
      customerEmail: "satisfeito@teste.local",
      rating: 5,
      message: "Entrega rapida e comida excelente.",
      status: "published",
      statusLabel: "Publicada",
      visibilityState: "automatic",
      publicationLabel: "Exibe por 8 semanas",
      remainingLabel: "55 dias restantes",
      isRecent: true,
      source: "site",
      createdAt: new Date(BASE_TIME_MS - 3 * 24 * 60 * 60000).toISOString(),
    },
    {
      id: "review-validacao-2",
      customerName: "Cliente Reservado",
      customerContact: "(11) 98888-0404",
      customerPhone: "(11) 98888-0404",
      customerEmail: "reservado@teste.local",
      rating: 4,
      message: "Boa experiencia.",
      status: "hidden",
      statusLabel: "Oculta",
      visibilityState: "hidden",
      publicationLabel: "Exibe por 4 semanas",
      remainingLabel: "Oculta manualmente",
      isRecent: true,
      source: "site",
      createdAt: new Date(BASE_TIME_MS - 4 * 24 * 60 * 60000).toISOString(),
    },
  ],
};

const inventoryPayload = {
  ok: true,
  storageMode: "validation-mock",
  generatedAt: new Date(BASE_TIME_MS).toISOString(),
  sourceDocument: "Checklist sintetico local",
  seedSummary: {
    items: 2,
  },
  summary: {
    totalItems: 2,
    okItems: 1,
    lowItems: 1,
    criticalItems: 0,
    expiringSoonItems: 1,
    expiredItems: 0,
  },
  categories: ["Peixes", "Insumos"],
  items: [
    {
      id: "salmao-validacao",
      name: "Salmao fresco",
      category: "Peixes",
      unit: "kg",
      quantity: 8,
      minimumQuantity: 3,
      status: { key: "ok", label: "OK", className: "is-ok" },
      expiration: {
        date: "2026-06-24",
        label: "Validade em 3 dias",
        isExpired: false,
        isExpiringSoon: true,
      },
      source: "manual",
      updatedAt: new Date(BASE_TIME_MS).toISOString(),
    },
    {
      id: "shoyu-validacao",
      name: "Shoyu premium",
      category: "Insumos",
      unit: "un",
      quantity: 2,
      minimumQuantity: 6,
      status: { key: "low", label: "Baixo", className: "is-low" },
      expiration: {
        date: "",
        label: "Sem validade",
        isExpired: false,
        isExpiringSoon: false,
      },
      source: "docx",
      updatedAt: new Date(BASE_TIME_MS).toISOString(),
    },
  ],
};

const restaurantSettingsPayload = {
  ok: true,
  storageMode: "validation-mock",
  generatedAt: new Date(BASE_TIME_MS).toISOString(),
  summary: {
    restaurantKey: "default",
    restaurantName: "Tokyo Sushi Delivery",
    hasStructuredBusinessSchedule: true,
  },
  settings: {
    restaurantKey: "default",
    restaurantName: "Tokyo Sushi Delivery",
    logoUrl: "../site-images/tokyo-logo-premium-transparent.png",
    bannerUrl: "../site-images/combinado-imperial.png",
    primaryColor: "#e83637",
    secondaryColor: "#f5c3d3",
    whatsapp: "5516990507398",
    businessHours: "18:00 as 23:00",
    address: "Rua General Osorio, 2165, Franca - SP",
    addressFields: {
      postalCode: "14400-520",
      street: "Rua General Osorio",
      number: "2165",
      complement: "",
      neighborhood: "Centro",
      city: "Franca",
      state: "SP",
    },
    deliveryBase: {
      latitude: "-20.536416",
      longitude: "-47.393922",
      maxDeliveryRadiusKm: 14.9,
      fixedDeliveryFee: 9,
      pricePerKm: 0,
      minimumDeliveryOrder: 0,
      pickupEnabled: true,
      deliveryEnabled: true,
    },
    businessSchedule: {
      timeZone: "America/Sao_Paulo",
      acceptOrdersOutsideHours: false,
      closedMessage:
        "Estamos fechados agora. Voce pode agendar seu pedido para o proximo horario de atendimento.",
      peakPreparationExtraMinutes: 0,
      specialDates: [],
      days: {
        monday: { isOpen: true, openTime: "18:00", closeTime: "23:00", pauseStart: "", pauseEnd: "" },
        tuesday: { isOpen: true, openTime: "18:00", closeTime: "23:00", pauseStart: "", pauseEnd: "" },
        wednesday: { isOpen: true, openTime: "18:00", closeTime: "23:00", pauseStart: "", pauseEnd: "" },
        thursday: { isOpen: true, openTime: "18:00", closeTime: "23:00", pauseStart: "", pauseEnd: "" },
        friday: { isOpen: true, openTime: "18:00", closeTime: "23:00", pauseStart: "", pauseEnd: "" },
        saturday: { isOpen: true, openTime: "18:00", closeTime: "23:00", pauseStart: "", pauseEnd: "" },
        sunday: { isOpen: true, openTime: "18:00", closeTime: "23:00", pauseStart: "", pauseEnd: "" },
      },
    },
    hasStructuredBusinessSchedule: true,
    defaultDeliveryFee: 9,
    averagePreparationTimeMinutes: 25,
    presentationText: "Validacao local segura.",
    updatedAt: new Date(BASE_TIME_MS).toISOString(),
    updatedByLogin: "gestor.local",
    updatedByDisplayName: "Gestor Local",
  },
};

const buildFinancePayload = (orders) => {
  const validOrders = orders.filter((order) => order.status !== "Cancelado");
  const paidOrders = validOrders.filter((order) => order.financialStatus === "paid");
  const pendingOrders = validOrders.filter((order) => order.financialStatus !== "paid");
  const grossRevenue = validOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const deliveryFees = validOrders.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0);
  const receivedRevenue = paidOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const paymentBreakdown = ["pix", "credito", "debito", "dinheiro"].map((paymentMethod) => {
    const paymentOrders = validOrders.filter((order) => order.paymentMethod === paymentMethod);

    return {
      paymentMethod,
      label: paymentMethod,
      total: paymentOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
      orders: paymentOrders.length,
    };
  });

  return {
    ok: true,
    storageMode: "validation-mock",
    generatedAt: new Date(BASE_TIME_MS).toISOString(),
    filters: {
      period: "today",
      startDate: "2026-06-21",
      endDate: "2026-06-21",
      rangeLabel: "Hoje",
    },
    overview: {
      totalOrders: orders.length,
      validOrders: validOrders.length,
      grossRevenue,
      netRevenue: grossRevenue - deliveryFees,
      deliveryFees,
      deliveryPayout: Number((deliveryFees * 0.7).toFixed(2)),
      averageTicket: validOrders.length ? grossRevenue / validOrders.length : 0,
      paidOrders: paidOrders.length,
      pendingOrders: pendingOrders.length,
      cancelledOrders: orders.filter((order) => order.status === "Cancelado").length,
      cancelledRevenue: orders
        .filter((order) => order.status === "Cancelado")
        .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
      receivedRevenue,
      pendingAmount: pendingOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
    },
    paymentBreakdown,
    orders,
    dailySeries: [
      {
        label: "21/06",
        date: "2026-06-21",
        revenue: grossRevenue,
        orders: validOrders.length,
      },
    ],
    deliveryPayoutSettings: {
      mode: "percentage_fee",
      percentage: 70,
      manualAmount: 0,
    },
    closing: {
      totalExpected: receivedRevenue,
      notes: "",
      savedAt: "",
    },
  };
};

const createRouteState = () => {
  const orders = buildOrders();

  return {
    authenticated: false,
    tempRoot: "",
    orders,
    stats: calculateStats(orders),
    calls: new Map(),
  };
};

const bumpCall = (routeState, key) => {
  routeState.calls.set(key, (routeState.calls.get(key) || 0) + 1);
};

const fulfillJson = async (route, payload, status = 200) => {
  await route.fulfill({
    status,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(payload),
  });
};

const readJsonRequestBody = (route) => {
  const rawBody = route.request().postData() || "{}";
  return JSON.parse(rawBody);
};

const handleAdminApiRoute = async (route, routeState) => {
  const request = route.request();
  const requestUrl = new URL(request.url());
  const pathname = requestUrl.pathname;
  const method = request.method();

  bumpCall(routeState, pathname);

  if (pathname === "/api/admin/session") {
    assert.equal(method, "GET", "A consulta de sessao admin deve usar GET.");
    await fulfillJson(route, {
      ok: true,
      authenticated: routeState.authenticated,
      admin: routeState.authenticated ? { login: "gestor.local", displayName: "Gestor Local" } : null,
    });
    return;
  }

  if (pathname === "/api/admin/login") {
    assert.equal(method, "POST", "O login admin deve usar POST.");
    const payload = readJsonRequestBody(route);
    assert.equal(payload.identifier, "gestor.local", "O login deve enviar o identificador digitado.");
    assert.equal(payload.password, "senha-segura", "O login deve enviar a senha digitada.");
    assert.ok(String(payload.next || "").startsWith("/admin"), "O login deve manter redirect seguro para /admin.");
    routeState.authenticated = true;
    await fulfillJson(route, {
      ok: true,
      authenticated: true,
      redirectTo: "/admin/index.html",
      admin: { login: "gestor.local", displayName: "Gestor Local" },
    });
    return;
  }

  if (pathname === "/api/admin/logout") {
    assert.equal(method, "POST", "O logout admin deve usar POST.");
    routeState.authenticated = false;
    await fulfillJson(route, { ok: true });
    return;
  }

  if (PROTECTED_ADMIN_PATHS.has(pathname)) {
    assert.equal(routeState.authenticated, true, `Endpoint protegido chamado sem login: ${pathname}`);
  }

  if (pathname === "/api/admin/orders/list") {
    await fulfillJson(route, {
      ok: true,
      storageMode: "validation-mock",
      generatedAt: new Date(BASE_TIME_MS).toISOString(),
      stats: routeState.stats,
      orders: routeState.orders,
      recentOrders: routeState.orders,
      admin: { displayName: "Gestor Local" },
    });
    return;
  }

  if (pathname === "/api/admin/orders/details") {
    const orderId = requestUrl.searchParams.get("orderId") || "";
    const order = routeState.orders.find((entry) => entry.id === orderId);

    await fulfillJson(
      route,
      order
        ? { ok: true, storageMode: "validation-mock", order }
        : { error: "Pedido nao encontrado.", errorCode: "order_not_found" },
      order ? 200 : 404
    );
    return;
  }

  if (pathname === "/api/admin/audit") {
    await fulfillJson(route, {
      ok: true,
      storageMode: "validation-mock",
      events: [],
      adminOptions: [{ login: "gestor.local", label: "Gestor Local" }],
      actionOptions: [],
    });
    return;
  }

  if (pathname === "/api/admin/catalog/list") {
    await fulfillJson(route, catalogPayload);
    return;
  }

  if (pathname === "/api/admin/customers/list") {
    await fulfillJson(route, customersPayload);
    return;
  }

  if (pathname === "/api/admin/reviews/list") {
    await fulfillJson(route, reviewsPayload);
    return;
  }

  if (pathname === "/api/admin/settings/list") {
    await fulfillJson(route, restaurantSettingsPayload);
    return;
  }

  if (pathname === "/api/admin/inventory/list") {
    await fulfillJson(route, inventoryPayload);
    return;
  }

  if (pathname === "/api/admin/finance") {
    await fulfillJson(route, buildFinancePayload(routeState.orders));
    return;
  }

  await fulfillJson(route, {
    error: `Endpoint admin nao mockado: ${pathname}`,
    errorCode: "admin_validation_route_missing",
  }, 500);
};

const validateLogin = async (page, baseURL) => {
  await page.goto(`${baseURL}/admin/login.html?next=%2Fadmin%2F`, {
    waitUntil: "domcontentloaded",
  });
  await waitForCondition(
    async () => (await page.locator("[data-admin-login-form]").count()) === 1,
    "A tela de login admin deveria renderizar o formulario."
  );

  await page.locator('input[name="identifier"]').fill("gestor.local");
  await page.locator('input[name="password"]').fill("senha-segura");
  await page.locator("[data-admin-login-submit]").click();

  await waitForCondition(
    async () => (await page.evaluate(() => document.body.dataset.adminPage).catch(() => "")) === "dashboard",
    "O login deveria redirecionar para o painel admin."
  );
};

const readBodySection = (page) => page.evaluate(() => document.body.dataset.adminSection || "").catch(() => "");

const clickSection = async (page, section) => {
  await page.locator(`[data-admin-section="${section}"]`).click();
  await waitForCondition(
    async () => (await readBodySection(page)) === section,
    `A navegacao deveria ativar a secao ${section}.`
  );
};

const waitForVisibleText = async (page, selector, expectedText, message) => {
  await waitForCondition(async () => {
    const text = (await page.locator(selector).textContent().catch(() => "")) || "";
    return text.includes(expectedText);
  }, message);
};

const validateOrders = async (page) => {
  await waitForCondition(
    async () =>
      (await readBodySection(page)) === "orders" &&
      (await page.locator(".admin-board-column").count()) === 5 &&
      (await page.locator("[data-order-select]").count()) >= 5,
    "Pedidos deveria renderizar kanban com pedidos sinteticos."
  );
  const targetOrder = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll("[data-order-select]")).map((button) => ({
      id: button.getAttribute("data-order-select") || "",
      selected: Boolean(button.closest(".admin-order-card.is-selected")),
    }));

    return cards.find((card) => card.id && !card.selected)?.id || cards[0]?.id || "";
  });
  const customerByOrderId = {
    "order-adm-001": "Cliente Recebido",
    "order-adm-002": "Cliente Aceito",
    "order-adm-003": "Cliente Preparo",
    "order-adm-004": "Cliente Pronto",
    "order-adm-005": "Cliente Rota",
  };

  assert.ok(targetOrder, "Pedidos deveria ter ao menos um card para abrir detalhe.");
  await page.locator(`[data-order-select="${targetOrder}"]`).click({ force: true });

  try {
    await waitForVisibleText(
      page,
      "[data-admin-order-detail]",
      customerByOrderId[targetOrder] || "Cliente",
      "Selecionar pedido deveria abrir detalhe lateral."
    );
  } catch (error) {
    const debugState = await page.evaluate(() => ({
      activeSection: document.body.dataset.adminSection || "",
      selectedCards: Array.from(document.querySelectorAll(".admin-order-card.is-selected [data-order-select]")).map(
        (button) => button.getAttribute("data-order-select") || ""
      ),
      detailTitle: document.querySelector("[data-admin-detail-title]")?.textContent?.trim() || "",
      detailText: document.querySelector("[data-admin-order-detail]")?.textContent?.replace(/\s+/g, " ").trim() || "",
    }));
    error.message = `${error.message} Debug: ${JSON.stringify({ targetOrder, debugState })}`;
    throw error;
  }
};

const validateMenu = async (page) => {
  await clickSection(page, "menu");
  await waitForVisibleText(
    page,
    "[data-admin-module-content]",
    "Combo Validacao",
    "Cardapio deveria renderizar itens administrativos sinteticos."
  );
  assert.equal(
    await page.locator("[data-menu-section-form]").count(),
    3,
    "Cardapio deveria renderizar duas categorias existentes e uma area de nova categoria."
  );
};

const validateCustomers = async (page) => {
  await clickSection(page, "customers");
  await waitForVisibleText(
    page,
    "[data-admin-module-content]",
    "Cliente Recorrente",
    "Clientes deveria renderizar a base CRM sintetica."
  );
  assert.ok(
    (await page.locator("[data-customer-key]").count()) >= 2,
    "Clientes deveria exibir cards de cliente navegaveis."
  );
};

const validateReports = async (page) => {
  await clickSection(page, "reports");
  await waitForVisibleText(
    page,
    "[data-admin-module-content]",
    "Performance do turno e gargalos",
    "Relatorios deveria renderizar o panorama operacional."
  );
  await waitForVisibleText(
    page,
    "[data-admin-module-content]",
    "Distribuicao por status",
    "Relatorios deveria exibir distribuicao por status."
  );
};

const validateInventory = async (page) => {
  await clickSection(page, "inventory");
  await waitForVisibleText(
    page,
    "[data-admin-module-content]",
    "Salmao fresco",
    "Estoque deveria renderizar itens sinteticos."
  );
  assert.ok(
    (await page.locator("[data-inventory-select]").count()) >= 2,
    "Estoque deveria exibir itens selecionaveis."
  );
};

const validateFinance = async (page) => {
  await clickSection(page, "finance");
  await waitForVisibleText(
    page,
    "[data-admin-module-content]",
    "Financeiro",
    "Financeiro deveria renderizar o modulo de fechamento."
  );
  await waitForVisibleText(
    page,
    "[data-admin-module-content]",
    "Faturamento bruto",
    "Financeiro deveria exibir indicadores de receita."
  );
};

const validateReviews = async (page) => {
  await clickSection(page, "reviews");
  await waitForVisibleText(
    page,
    "[data-admin-module-content]",
    "Cliente Satisfeito",
    "Avaliacoes deveria renderizar feedbacks sinteticos."
  );
  assert.ok(
    (await page.locator("[data-review-select]").count()) >= 2,
    "Avaliacoes deveria exibir avaliacoes selecionaveis."
  );
};

const validateSettings = async (page) => {
  await clickSection(page, "settings");
  await waitForVisibleText(
    page,
    "[data-admin-module-content]",
    "Personalizacao do restaurante",
    "Configuracoes deveria renderizar personalizacao do restaurante."
  );
  assert.equal(
    await page.locator("[data-restaurant-settings-root]").count(),
    1,
    "Configuracoes deveria exibir formulario isolado de ajustes."
  );
};

const validateNoBrowserErrors = (consoleErrors, pageErrors) => {
  assert.deepEqual(consoleErrors, [], "O admin local nao deveria emitir erros no console.");
  assert.deepEqual(pageErrors, [], "O admin local nao deveria disparar erros de execucao.");
};

const runWithIsolatedEnvironment = async (callback) => {
  const originalEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
    NODE_ENV: process.env.NODE_ENV,
  };
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tokyo-admin-local-validation-"));
  const beforeRealData = await getDirectoryFingerprint(realDataDirectory);

  try {
    await fs.mkdir(path.join(tempRoot, ".data"), { recursive: true });
    process.env.NODE_ENV = "development";
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;

    return await callback(tempRoot, beforeRealData);
  } finally {
    if (originalEnv.DATABASE_URL === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalEnv.DATABASE_URL;
    }

    if (originalEnv.POSTGRES_URL === undefined) {
      delete process.env.POSTGRES_URL;
    } else {
      process.env.POSTGRES_URL = originalEnv.POSTGRES_URL;
    }

    if (originalEnv.NODE_ENV === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalEnv.NODE_ENV;
    }

    await fs.rm(tempRoot, { recursive: true, force: true });
  }
};

const main = async () =>
  runWithIsolatedEnvironment(async (tempRoot, beforeRealData) => {
    const server = createStaticServer(workspaceRoot);
    const { port } = await listen(server);
    const baseURL = `http://127.0.0.1:${port}`;
    const routeState = createRouteState();
    routeState.tempRoot = tempRoot;
    const browser = await chromium.launch({ headless: true });

    try {
      const context = await browser.newContext({
        baseURL,
        viewport: { width: 1440, height: 960 },
      });
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];

      page.on("console", (message) => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      });
      page.on("pageerror", (error) => {
        pageErrors.push(String(error?.message || error));
      });

      await context.route("**/api/admin/**", (route) => handleAdminApiRoute(route, routeState));
      await context.route("**/api/catalog", (route) => fulfillJson(route, catalogPayload));

      await validateLogin(page, baseURL);
      await validateOrders(page);
      await validateMenu(page);
      await validateCustomers(page);
      await validateReports(page);
      await validateInventory(page);
      await validateFinance(page);
      await validateReviews(page);
      await validateSettings(page);
      validateNoBrowserErrors(consoleErrors, pageErrors);

      const afterRealData = await getDirectoryFingerprint(realDataDirectory);
      assert.deepEqual(afterRealData, beforeRealData, "A validacao admin local nao deve alterar .data real.");
      assert.equal(
        await fs.stat(path.join(tempRoot, ".data")).then((stats) => stats.isDirectory()).catch(() => false),
        true,
        "A validacao deveria reservar .data temporario isolado."
      );

      const requiredCalls = [
        "/api/admin/session",
        "/api/admin/login",
        "/api/admin/orders/list",
        "/api/admin/orders/details",
        "/api/admin/catalog/list",
        "/api/admin/customers/list",
        "/api/admin/inventory/list",
        "/api/admin/finance",
        "/api/admin/reviews/list",
        "/api/admin/settings/list",
      ];

      requiredCalls.forEach((pathname) => {
        assert.ok(routeState.calls.get(pathname) >= 1, `Endpoint validado: ${pathname}`);
      });

      console.log("Validacao admin local isolada concluida com sucesso.");
    } finally {
      await browser.close();
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
