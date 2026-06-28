import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

const BOARD_VISIBLE_CARD_LIMIT = 3;
const PREPARING_COLUMN_LABEL = "Em preparo";
const BASE_TIME_MS = new Date("2026-04-17T17:00:00-03:00").getTime();
const DASHBOARD_METRIC_LABELS = [
  "Pedidos do dia",
  "Em preparo",
  "Em rota",
  "Faturamento hoje",
];
const ORDERS_METRIC_LABELS = [
  "Recebidos",
  "Aceitos",
  "Em preparo",
  "Prontos",
  "Saiu para entrega",
  "Finalizados hoje",
];

const createStaticServer = (rootDirectory) =>
  http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
      let pathname = decodeURIComponent(requestUrl.pathname);

      if (pathname === "/") {
        pathname = "/index.html";
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

const waitForCondition = async (predicate, message, timeoutMs = 10000, intervalMs = 100) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    if (await predicate()) {
      return;
    }

    await sleep(intervalMs);
  }

  throw new Error(message);
};

const pad = (value) => String(value).padStart(3, "0");

const formatScheduledLabel = (value) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

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
  createdAt,
  updatedAt = createdAt,
  customerName,
  fulfillmentMode = "delivery",
  timingMode = "immediate",
  paymentMethod = "pix",
  totalAmount = 89.9,
  latestStatusNote = "",
}) => {
  const orderId = `order-${code.toLowerCase()}`;
  const publicId = `TKY-${code}`;
  const subtotal = Number((totalAmount - 8.9).toFixed(2));
  const note =
    latestStatusNote ||
    {
      Recebido: "Pedido aguardando primeira leitura.",
      Aceito: "Pedido aceito pela operacao.",
      "Em preparo": "Pedido na cozinha.",
      Pronto: "Pedido pronto para saida.",
      "Saiu para entrega": "Pedido em rota.",
      Entregue: "Entrega concluida.",
      "Retirada concluida": "Retirada concluida.",
    }[status] ||
    "Pedido em acompanhamento.";
  const scheduledFor =
    timingMode === "scheduled" ? new Date(new Date(createdAt).getTime() + 45 * 60000).toISOString() : null;

  return {
    id: orderId,
    publicId,
    status,
    customerName,
    customerPhone: "(11) 97777-0000",
    customerEmail: `${orderId}@teste.local`,
    customerNotes: "Validacao automatizada do kanban.",
    orderType: timingMode === "scheduled" ? "scheduled" : "delivery",
    fulfillmentMode,
    timingMode,
    scheduledFor,
    scheduledDate: scheduledFor ? scheduledFor.slice(0, 10) : "",
    scheduledTime: scheduledFor ? scheduledFor.slice(11, 16) : "",
    scheduledLabel: scheduledFor ? formatScheduledLabel(scheduledFor) : "",
    paymentMethod,
    needsChange: false,
    cashAmount: null,
    changeAmount: null,
    itemCount: 2,
    subtotal,
    addonsTotal: 0,
    deliveryFee: fulfillmentMode === "pickup" ? 0 : 8.9,
    totalAmount,
    addressFull: fulfillmentMode === "pickup" ? "" : "Rua Kanban, 321 - Centro, Sao Paulo - SP",
    addressComplement: "Sala 2",
    addressReference: "Porta lateral",
    addressNeighborhood: "Centro",
    addressCity: "Sao Paulo",
    addressState: "SP",
    deliveryDistanceText: fulfillmentMode === "pickup" ? "" : "3,8 km",
    deliveryRouteBand: fulfillmentMode === "pickup" ? "" : "Centro expandido",
    deliveryEstimateText: fulfillmentMode === "pickup" ? "" : "35-45 min",
    latestStatusNote: note,
    itemPreview: "Combo executivo + 1 adicional",
    createdAt,
    updatedAt,
    items: [
      {
        id: `${orderId}-product`,
        type: "product",
        name: "Combinado Executivo",
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
        metadata: {
          chargedQuantity: 0,
          freeUnits: 1,
        },
      },
    ],
    auditTrail: buildAuditTrail(status, updatedAt, note),
  };
};

const buildPreparingOrders = (count) => {
  const orders = [];

  for (let index = 1; index <= count; index += 1) {
    const createdAt = new Date(BASE_TIME_MS + (index - 1) * 5 * 60000).toISOString();

    orders.push(
      buildOrder({
        code: `PRP-${pad(index)}`,
        status: "Em preparo",
        createdAt,
        updatedAt: createdAt,
        customerName: `Cliente Preparo ${pad(index)}`,
        totalAmount: 69.9 + index,
      })
    );
  }

  return orders;
};

const buildScenarioOrders = (preparingCount) => {
  const preparingOrders = buildPreparingOrders(preparingCount);
  const supportOrders = [
    buildOrder({
      code: "NOV-001",
      status: "Recebido",
      createdAt: new Date(BASE_TIME_MS - 20 * 60000).toISOString(),
      customerName: "Cliente Novo 001",
      totalAmount: 72.5,
    }),
    buildOrder({
      code: "AGD-001",
      status: "Aceito",
      createdAt: new Date(BASE_TIME_MS - 45 * 60000).toISOString(),
      updatedAt: new Date(BASE_TIME_MS - 40 * 60000).toISOString(),
      customerName: "Cliente Agendado 001",
      timingMode: "scheduled",
      totalAmount: 96.4,
    }),
    buildOrder({
      code: "PRT-001",
      status: "Pronto",
      createdAt: new Date(BASE_TIME_MS - 30 * 60000).toISOString(),
      updatedAt: new Date(BASE_TIME_MS - 15 * 60000).toISOString(),
      customerName: "Cliente Pronto 001",
      totalAmount: 81.2,
    }),
  ];

  const shuffledPreparingOrders = preparingOrders
    .slice()
    .sort((left, right) => right.publicId.localeCompare(left.publicId));

  return [...shuffledPreparingOrders, ...supportOrders];
};

const calculateStats = (orders) => {
  const activeOrders = orders.filter(
    (order) => !["Entregue", "Retirada concluida", "Cancelado"].includes(order.status)
  );
  const preparingOrders = orders.filter((order) => order.status === "Em preparo");
  const readyOrders = orders.filter((order) => order.status === "Pronto");
  const deliveryOrders = orders.filter((order) => order.status === "Saiu para entrega");
  const scheduledOrders = orders.filter(
    (order) =>
      order.timingMode === "scheduled" &&
      !["Entregue", "Retirada concluida", "Cancelado"].includes(order.status)
  );
  const byStatusMap = new Map();

  orders.forEach((order) => {
    byStatusMap.set(order.status, (byStatusMap.get(order.status) || 0) + 1);
  });

  return {
    totalOrders: orders.length,
    newOrders: orders.filter((order) => order.status === "Recebido").length,
    activeOrders: activeOrders.length,
    scheduledOrders: scheduledOrders.length,
    todayOrders: orders.length,
    preparingOrders: preparingOrders.length,
    readyOrders: readyOrders.length,
    deliveryOrders: deliveryOrders.length,
    todayRevenue: activeOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
    byStatus: Array.from(byStatusMap.entries()).map(([status, total]) => ({ status, total })),
  };
};

const createRouteState = () => {
  const scenarios = {
    five: buildScenarioOrders(5),
    ten: buildScenarioOrders(10),
    thirteen: buildScenarioOrders(13),
    three: buildScenarioOrders(3),
  };

  return {
    scenarios,
    activeScenarioKey: "five",
    orders: scenarios.five.map((order) => ({ ...order })),
    generatedAt: new Date(BASE_TIME_MS).toISOString(),
    statusUpdates: 0,
    listRequests: 0,
    detailRequests: 0,
    auditRequests: 0,
    statusRequests: 0,
  };
};

const setScenario = (routeState, scenarioKey) => {
  routeState.activeScenarioKey = scenarioKey;
  routeState.orders = routeState.scenarios[scenarioKey].map((order) => ({ ...order }));
  routeState.generatedAt = new Date(Date.now()).toISOString();
};

const findOrder = (routeState, orderId) => routeState.orders.find((order) => order.id === orderId) || null;

const moveOrderToStatus = (routeState, orderId, nextStatus, note) => {
  const currentOrder = findOrder(routeState, orderId);

  if (!currentOrder) {
    return null;
  }

  routeState.statusUpdates += 1;
  const updatedAt = new Date(BASE_TIME_MS + (500 + routeState.statusUpdates) * 60000).toISOString();
  const nextOrder = {
    ...currentOrder,
    status: nextStatus,
    updatedAt,
    latestStatusNote: note || currentOrder.latestStatusNote,
    auditTrail: [
      {
        id: `audit-${orderId}-${routeState.statusUpdates}`,
        action: "status_updated",
        actionLabel: `Status ${nextStatus}`,
        status: nextStatus,
        note: note || currentOrder.latestStatusNote,
        source: "admin",
        adminLogin: "gestor.local",
        adminDisplayName: "Gestor Local",
        createdAt: updatedAt,
      },
      ...(currentOrder.auditTrail || []),
    ],
  };

  routeState.orders = routeState.orders.map((order) => (order.id === orderId ? nextOrder : order));
  routeState.generatedAt = updatedAt;
  return nextOrder;
};

const readText = async (locator) => ((await locator.textContent()) || "").trim();

const getBoardColumn = (page, columnLabel) =>
  page.locator(".admin-board-column").filter({
    has: page.locator(".admin-board-column-head strong", { hasText: columnLabel }),
  });

const getCardIdsFromColumn = async (page, columnLabel) =>
  getBoardColumn(page, columnLabel)
    .locator("[data-order-select]")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const orderId = node.getAttribute("data-order-select") || "";
        const match = /^order-prp-(\d{3})$/.exec(orderId);
        return match ? `TKY-PRP-${match[1]}` : orderId;
      })
    );

const getModalOrderIds = async (page) =>
  page
    .locator("[data-board-modal-order-select]")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const orderId = node.getAttribute("data-board-modal-order-select") || "";
        const match = /^order-prp-(\d{3})$/.exec(orderId);
        return match ? `TKY-PRP-${match[1]}` : orderId;
      })
    );

const getDesktopLayoutMetrics = async (page) =>
  page.evaluate(() => {
    const sidebar = document.querySelector(".admin-sidebar");
    const detailPanel = document.querySelector(".admin-detail-panel");
    const board = document.querySelector(".admin-board");
    const boardColumns = Array.from(document.querySelectorAll(".admin-board-column"));
    const logo = document.querySelector(".admin-brand-logo");
    const title = document.querySelector(".admin-main-intro h1");
    const statCard = document.querySelector(".admin-stat-card");
    const boardRect = board?.getBoundingClientRect();
    const lastColumnRect = boardColumns.at(-1)?.getBoundingClientRect();

    return {
      sidebarWidth: sidebar?.getBoundingClientRect().width || 0,
      detailWidth: detailPanel?.getBoundingClientRect().width || 0,
      boardClientWidth: board?.clientWidth || 0,
      boardScrollWidth: board?.scrollWidth || 0,
      boardGap: Number.parseFloat(window.getComputedStyle(board || document.body).columnGap || "0") || 0,
      columnCount: boardColumns.length,
      lastColumnRightOffset:
        boardRect && lastColumnRect ? lastColumnRect.right - boardRect.left : 0,
      logoCurrentSrc: logo?.currentSrc || logo?.getAttribute("src") || "",
      logoWidth: logo?.getBoundingClientRect().width || 0,
      titleFontSize: Number.parseFloat(window.getComputedStyle(title || document.body).fontSize || "0") || 0,
      statCardHeight: statCard?.getBoundingClientRect().height || 0,
    };
  });

const validateDesktopLayout = async (page) => {
  const metrics = await getDesktopLayoutMetrics(page);

  assert.equal(metrics.columnCount, 5, "O kanban deveria renderizar as cinco colunas operacionais.");
  assert.ok(
    metrics.boardScrollWidth <= metrics.boardClientWidth + 2,
    "As cinco colunas deveriam caber sem corte no desktop validado."
  );
  assert.ok(
    metrics.lastColumnRightOffset <= metrics.boardClientWidth + 2,
    "A ultima coluna do kanban nao deveria ficar cortada na direita."
  );
  assert.ok(
    metrics.logoCurrentSrc.includes("/assets/tokyo-logo-sidebar.png"),
    "A sidebar deveria usar a nova logo dedicada."
  );
  assert.ok(metrics.logoWidth > 0, "A logo da sidebar deveria estar renderizada.");
  assert.ok(metrics.sidebarWidth > 0, "A sidebar deveria estar renderizada.");
  assert.ok(metrics.detailWidth > 0, "O painel lateral direito deveria estar renderizado.");
};

const waitForPreparingColumn = async (page, expectedTotalCount, expectedOverflowCount) => {
  await waitForCondition(
    async () => {
      const column = getBoardColumn(page, PREPARING_COLUMN_LABEL);
      const visibleCount = await column.locator("[data-order-select]").count();
      const totalCountText = await readText(column.locator(".admin-board-column-meta span"));
      const overflowText = expectedOverflowCount > 0
        ? await readText(column.locator(".admin-board-overflow-count"))
        : "";

      return (
        visibleCount === Math.min(BOARD_VISIBLE_CARD_LIMIT, expectedTotalCount) &&
        totalCountText === String(expectedTotalCount) &&
        (expectedOverflowCount === 0 || overflowText.includes(String(expectedOverflowCount)))
      );
    },
    `A coluna ${PREPARING_COLUMN_LABEL} nao refletiu ${expectedTotalCount} pedidos.`,
    12000
  );
};

const validatePreparingColumnState = async (page, expectedTotalCount) => {
  const expectedOverflowCount = Math.max(expectedTotalCount - BOARD_VISIBLE_CARD_LIMIT, 0);
  const column = getBoardColumn(page, PREPARING_COLUMN_LABEL);
  const visibleCards = column.locator("[data-order-select]");
  const visibleIds = await getCardIdsFromColumn(page, PREPARING_COLUMN_LABEL);
  const expectedVisibleIds = Array.from({ length: Math.min(BOARD_VISIBLE_CARD_LIMIT, expectedTotalCount) }, (_, index) =>
    `TKY-PRP-${pad(index + 1)}`
  );

  assert.equal(
    await visibleCards.count(),
    Math.min(BOARD_VISIBLE_CARD_LIMIT, expectedTotalCount),
    "A coluna deveria exibir no maximo 3 cards visiveis."
  );
  assert.deepEqual(
    visibleIds,
    expectedVisibleIds,
    "A coluna de preparo deveria mostrar os pedidos mais antigos primeiro."
  );
  assert.equal(
    await readText(column.locator(".admin-board-column-meta span")),
    String(expectedTotalCount),
    "O total da coluna de preparo ficou incorreto."
  );

  if (expectedOverflowCount > 0) {
    assert.equal(
      await readText(column.locator(".admin-board-overflow-count")),
      `+ ${expectedOverflowCount} pedido${expectedOverflowCount === 1 ? "" : "s"}`,
      "O indicador de pedidos excedentes nao ficou claro."
    );
    assert.equal(
      await readText(column.locator(".admin-board-overflow-button")),
      `Ver todos (${expectedTotalCount})`,
      "O botao para abrir todos os pedidos ficou incorreto."
    );
  } else {
    assert.equal(
      await column.locator(".admin-board-overflow").count(),
      0,
      "Nao deveria existir indicador de excedente quando a coluna tem 3 pedidos ou menos."
    );
  }
};

const openPreparingModal = async (page, expectedTotalCount) => {
  await getBoardColumn(page, PREPARING_COLUMN_LABEL).locator("[data-board-column-open]").click();
  await waitForCondition(
    async () =>
      (await page.locator("[data-admin-board-modal]").evaluate((node) => !node.hidden).catch(() => false)) &&
      (await page.locator(".admin-board-modal-row").count()) === expectedTotalCount,
    "O modal de pedidos da coluna nao abriu corretamente."
  );
};

const closePreparingModal = async (page) => {
  await page.locator("[data-admin-board-modal-close]").first().click();
  await waitForCondition(
    async () => page.locator("[data-admin-board-modal]").evaluate((node) => node.hidden).catch(() => true),
    "O modal da coluna nao foi fechado."
  );
};

const validatePreparingModal = async (page, expectedTotalCount) => {
  const modalTitle = await readText(page.locator("[data-admin-board-modal-title]"));
  const modalSubtitle = await readText(page.locator("[data-admin-board-modal-subtitle]"));
  const modalOrderIds = await getModalOrderIds(page);
  const expectedIds = Array.from({ length: expectedTotalCount }, (_, index) => `TKY-PRP-${pad(index + 1)}`);

  assert.equal(
    modalTitle,
    "Todos os pedidos de em preparo",
    "O titulo do modal da coluna nao ficou consistente."
  );
  assert.ok(
    modalSubtitle.includes(`${expectedTotalCount} pedido${expectedTotalCount === 1 ? "" : "s"}`),
    "O resumo do modal nao indicou o total da coluna."
  );
  assert.deepEqual(
    modalOrderIds,
    expectedIds,
    "O modal deveria listar todos os pedidos da coluna em ordem do mais antigo para o mais recente."
  );
};

const validatePreparingModalScroll = async (page) => {
  const metrics = await page.locator("[data-admin-board-modal-list]").evaluate((node) => {
    const element = node;
    const styles = window.getComputedStyle(element);
    const beforeScrollTop = element.scrollTop;
    element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight);

    return {
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      afterScrollTop: element.scrollTop,
      overflowY: styles.overflowY,
      overscrollBehavior: styles.overscrollBehavior,
      canScroll: element.scrollHeight > element.clientHeight,
      dialogClientHeight:
        element.closest(".admin-board-modal-dialog")?.getBoundingClientRect().height || 0,
      beforeScrollTop,
    };
  });

  assert.ok(metrics.dialogClientHeight > 0, "O dialogo do modal deveria ter altura definida.");
  assert.ok(metrics.canScroll, "A lista do modal deveria ultrapassar a altura visivel neste cenario.");
  assert.ok(
    metrics.overflowY === "auto" || metrics.overflowY === "scroll",
    "A lista do modal deveria manter overflow vertical interno."
  );
  assert.ok(metrics.afterScrollTop > metrics.beforeScrollTop, "A lista do modal nao respondeu ao scroll interno.");
};

const waitForDashboardSection = async (page) => {
  await waitForCondition(
    async () =>
      (await page.evaluate(() => document.body.dataset.adminSection).catch(() => "")) === "dashboard" &&
      (await page.locator(".admin-dashboard-summary-card").count()) > 0,
    "O gestor deveria exibir a visao Dashboard."
  );
};

const waitForOrdersSection = async (page, expectedPreparingCount) => {
  await waitForCondition(
    async () =>
      (await page.evaluate(() => document.body.dataset.adminSection).catch(() => "")) === "orders" &&
      (await page.locator(".admin-board-column").count()) === 5 &&
      (await getBoardColumn(page, PREPARING_COLUMN_LABEL).locator("[data-order-select]").count()) ===
        Math.min(BOARD_VISIBLE_CARD_LIMIT, expectedPreparingCount),
    "O gestor deveria exibir a visao Pedidos com o kanban operacional."
  );
};

const waitForInitialAdminSection = async (page, expectedPreparingCount) => {
  let activeSection = "";

  await waitForCondition(
    async () => {
      activeSection = await page.evaluate(() => document.body.dataset.adminSection).catch(() => "");

      if (activeSection === "dashboard") {
        return (await page.locator(".admin-dashboard-summary-card").count()) > 0;
      }

      if (activeSection === "orders") {
        return (
          (await page.locator(".admin-board-column").count()) === 5 &&
          (await getBoardColumn(page, PREPARING_COLUMN_LABEL).locator("[data-order-select]").count()) ===
            Math.min(BOARD_VISIBLE_CARD_LIMIT, expectedPreparingCount)
        );
      }

      return false;
    },
    "O gestor deveria carregar a tela inicial atual, Dashboard ou Pedidos."
  );

  return activeSection;
};

const validateDashboardExperience = async (page) => {
  const metricLabels = await page
    .locator("[data-admin-stats] .admin-stat-card span")
    .evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim() || "").filter(Boolean));
  const layoutState = await page.evaluate(() => {
    const detailPanel = document.querySelector("[data-admin-detail-panel]");
    const statsRoot = document.querySelector("[data-admin-stats]");
    const dashboardSummary = document.querySelector("[data-admin-search-dashboard-summary]");
    const searchInput = document.querySelector("[data-admin-search-input]");
    const toggle = document.querySelector("[data-admin-theme-toggle]");
    const logo = document.querySelector(".admin-brand-logo");
    const toggleRect = toggle?.getBoundingClientRect();
    const logoRect = logo?.getBoundingClientRect();

    return {
      activeSection: document.body.dataset.adminSection || "",
      activeTheme: document.body.dataset.adminTheme || "",
      detailDisplay: detailPanel ? window.getComputedStyle(detailPanel).display : "",
      statsDisplay: statsRoot ? window.getComputedStyle(statsRoot).display : "",
      dashboardSummaryVisible: dashboardSummary ? !dashboardSummary.hidden : false,
      searchVisible: Boolean(searchInput && !searchInput.hidden),
      themeToggleVisible: Boolean(toggleRect && toggleRect.width > 0 && toggleRect.height > 0),
      themeToggleAligned: Boolean(toggleRect && logoRect && Math.abs(toggleRect.top - logoRect.top) < 48),
    };
  });

  assert.equal(layoutState.activeSection, "dashboard", "A area Dashboard deveria ficar ativa ao navegar para ela.");
  assert.ok(
    ["light", "dark"].includes(layoutState.activeTheme),
    "O tema ativo deveria ser uma das opcoes suportadas pelo gestor."
  );
  assert.deepEqual(metricLabels, DASHBOARD_METRIC_LABELS, "O Dashboard deveria exibir os indicadores compactos esperados.");
  assert.equal(layoutState.detailDisplay, "none", "O painel lateral deve ficar oculto no Dashboard.");
  assert.equal(layoutState.statsDisplay, "grid", "Os indicadores do Dashboard deveriam ficar visiveis.");
  assert.ok(layoutState.dashboardSummaryVisible, "O resumo gerencial do topo deveria aparecer no Dashboard.");
  assert.ok(layoutState.searchVisible, "O campo de busca deveria permanecer disponivel na experiencia gerencial atual.");
  assert.ok(layoutState.themeToggleVisible, "O botao de tema deveria ficar visivel ao lado da logo.");
  assert.ok(layoutState.themeToggleAligned, "O botao de tema deveria permanecer alinhado com a logo.");
  assert.equal(
    await page.locator(".admin-board-column").count(),
    0,
    "O Dashboard gerencial nao deveria renderizar o kanban operacional na area principal."
  );
};

const toggleThemeAndValidatePersistence = async (page, expectedPreparingCount) => {
  const previousTheme = await page.evaluate(() => document.body.dataset.adminTheme).catch(() => "");
  const expectedTheme = previousTheme === "dark" ? "light" : "dark";

  await page.locator("[data-admin-theme-toggle]").click();
  await waitForCondition(
    async () => (await page.evaluate(() => document.body.dataset.adminTheme).catch(() => "")) === expectedTheme,
    "O tema oposto deveria ser aplicado apos acionar o toggle."
  );

  assert.equal(
    await page.evaluate(() => window.localStorage.getItem("tokyo_admin_theme")),
    expectedTheme,
    "A preferencia de tema deveria ser persistida localmente."
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForInitialAdminSection(page, expectedPreparingCount);

  assert.equal(
    await page.evaluate(() => document.body.dataset.adminTheme),
    expectedTheme,
    "O tema escolhido deveria ser restaurado automaticamente apos recarregar."
  );
};

const openDashboardSection = async (page) => {
  if ((await page.evaluate(() => document.body.dataset.adminSection).catch(() => "")) === "dashboard") {
    await waitForDashboardSection(page);
    return;
  }

  await page.locator('[data-admin-section="dashboard"]').click();
  await waitForDashboardSection(page);
};

const openOrdersSection = async (page, expectedPreparingCount) => {
  if ((await page.evaluate(() => document.body.dataset.adminSection).catch(() => "")) === "orders") {
    await waitForOrdersSection(page, expectedPreparingCount);
    return;
  }

  await page.locator('[data-admin-section="orders"]').click();
  await waitForOrdersSection(page, expectedPreparingCount);
};

const validateOrdersExperience = async (page) => {
  const metricLabels = await page
    .locator("[data-admin-stats] .admin-stat-card span")
    .evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim() || "").filter(Boolean));
  const state = await page.evaluate(() => {
    const detailPanel = document.querySelector("[data-admin-detail-panel]");
    const statsRoot = document.querySelector("[data-admin-stats]");
    const ribbonRoot = document.querySelector("[data-admin-ops-ribbon]");

    return {
      activeSection: document.body.dataset.adminSection || "",
      detailDisplay: detailPanel ? window.getComputedStyle(detailPanel).display : "",
      statsDisplay: statsRoot ? window.getComputedStyle(statsRoot).display : "",
      ribbonDisplay: ribbonRoot ? window.getComputedStyle(ribbonRoot).display : "",
    };
  });

  assert.equal(state.activeSection, "orders", "A navegacao deveria levar para a area Pedidos.");
  assert.notEqual(state.detailDisplay, "none", "O painel lateral deve permanecer visivel na area Pedidos.");
  assert.equal(state.statsDisplay, "grid", "Os indicadores operacionais deveriam aparecer na area Pedidos.");
  assert.deepEqual(metricLabels, ORDERS_METRIC_LABELS, "A area Pedidos deveria exibir os indicadores operacionais atuais.");
  assert.equal(state.ribbonDisplay, "none", "Os blocos do Dashboard nao deveriam aparecer na area Pedidos.");
  assert.equal(
    await page.locator(".admin-dashboard-summary-card").count(),
    0,
    "A area Pedidos nao deveria renderizar cards gerenciais do Dashboard."
  );
  assert.equal(
    await page.locator(".admin-board-column").count(),
    5,
    "A area Pedidos deveria renderizar as cinco colunas do kanban."
  );
};

const main = async () => {
  const server = createStaticServer(workspaceRoot);
  const { port } = await listen(server);
  const baseURL = `http://127.0.0.1:${port}`;
  const routeState = createRouteState();
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 960 },
    });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedResponses = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    page.on("pageerror", (error) => {
      pageErrors.push(String(error?.message || error));
    });
    page.on("response", (response) => {
      if (response.status() >= 400) {
        failedResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.route("**/api/admin/session", async (route) => {
      const features = [
        "onlineMenu",
        "orders",
        "whatsappButton",
        "deliveryCalculation",
        "customDomain",
        "advancedReports",
        "crm",
        "inventory",
        "finance",
        "reviews",
        "promotions",
        "coupons",
        "scheduledOrders",
        "platformBranding",
      ];

      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          authenticated: true,
          admin: {
            login: "gestor.local",
            displayName: "Gestor Local",
            userType: "OWNER",
            tipo_usuario: "OWNER",
            restaurantKey: "default",
            permissions: {
              dashboard_view: true,
              orders_view: true,
              orders_edit: true,
              inventory_view: true,
              developer_logs_view: true,
            },
            commercialAccess: {
              planKey: "PRO",
              contractStatus: "ACTIVE",
              releasedFeatures: features,
              blockedModules: [],
              features: features.reduce((summary, featureKey) => {
                summary[featureKey] = {
                  key: featureKey,
                  enabled: true,
                  allowedByPlan: true,
                  released: true,
                  blocked: false,
                  future: false,
                };
                return summary;
              }, {}),
            },
          },
        }),
      });
    });

    await page.route("**/api/admin/orders/list?**", async (route) => {
      routeState.listRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          storageMode: "mock",
          generatedAt: routeState.generatedAt,
          stats: calculateStats(routeState.orders),
          orders: routeState.orders,
          recentOrders: routeState.orders,
          admin: {
            displayName: "Gestor Local",
          },
        }),
      });
    });

    await page.route("**/api/admin/orders/details?**", async (route) => {
      routeState.detailRequests += 1;
      const requestUrl = new URL(route.request().url());
      const orderId = requestUrl.searchParams.get("orderId") || "";
      const order = findOrder(routeState, orderId);

      if (!order) {
        await route.fulfill({
          status: 404,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify({
            message: "Pedido nao encontrado.",
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          storageMode: "mock",
          order,
        }),
      });
    });

    await page.route("**/api/admin/audit?**", async (route) => {
      routeState.auditRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          storageMode: "mock",
          events: [],
          adminOptions: [],
          actionOptions: [],
        }),
      });
    });

    await page.route("**/api/admin/inventory/list", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          ok: true,
          storageMode: "validation-mock",
          generatedAt: routeState.generatedAt,
          sourceDocument: "Validacao local",
          seedSummary: {
            items: 0,
          },
          summary: {
            totalItems: 0,
            okItems: 0,
            lowItems: 0,
            criticalItems: 0,
            expiringSoonItems: 0,
            expiredItems: 0,
          },
          categories: [],
          items: [],
        }),
      });
    });

    await page.route("**/api/admin/orders/status", async (route) => {
      routeState.statusRequests += 1;
      const payload = JSON.parse(route.request().postData() || "{}");
      const order = moveOrderToStatus(
        routeState,
        String(payload.orderId || "").trim(),
        String(payload.status || "").trim(),
        String(payload.note || "").trim()
      );

      assert.ok(order, "O pedido enviado para atualizacao deveria existir na massa simulada.");

      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          storageMode: "mock",
          message: `Status atualizado para ${payload.status}.`,
          order,
        }),
      });
    });

    await page.route("**/api/admin/logout", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.route("**/api/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          ok: true,
          storageMode: "validation-mock",
          generatedAt: routeState.generatedAt,
          summary: {
            totalItems: 0,
            totalSections: 0,
          },
          items: [],
          sections: [],
          featuredItemId: "",
          featuredItemIds: [],
        }),
      });
    });

    await page.goto(`${baseURL}/admin/index.html`, {
      waitUntil: "domcontentloaded",
    });

    await waitForInitialAdminSection(page, 5);

    await openDashboardSection(page);
    await validateDashboardExperience(page);
    await toggleThemeAndValidatePersistence(page, 5);

    await openOrdersSection(page, 5);
    await validateOrdersExperience(page);
    await waitForPreparingColumn(page, 5, 2);
    await validatePreparingColumnState(page, 5);
    await validateDesktopLayout(page);

    await openPreparingModal(page, 5);
    await validatePreparingModal(page, 5);

    await page.locator('[data-board-modal-order-select="order-prp-004"]').click();
    await waitForCondition(
      async () => (await readText(page.locator("[data-admin-order-detail]"))).includes("Cliente Preparo 004"),
      "Selecionar um pedido pelo modal deveria abrir o detalhe lateral correto."
    );
    const detailHeaderSummary = await readText(page.locator("[data-admin-order-detail]"));
    assert.ok(
      detailHeaderSummary.includes("Em preparo") &&
        detailHeaderSummary.includes("Entrega") &&
        detailHeaderSummary.includes("TKY-PRP-004") &&
        detailHeaderSummary.includes("17:15"),
      "O painel deveria destacar codigo, status, tipo e horario relevante."
    );
    await waitForCondition(
      async () => page.locator("[data-admin-board-modal]").evaluate((node) => node.hidden).catch(() => true),
      "O modal deveria fechar apos selecionar um pedido."
    );

    await page.locator('[data-order-action="order-prp-004"][data-next-status="Pronto"]').click();
    await waitForPreparingColumn(page, 4, 1);
    await validatePreparingColumnState(page, 4);
    assert.equal(
      await readText(getBoardColumn(page, "Prontos").locator(".admin-board-column-meta span")),
      "2",
      "A coluna de prontos deveria receber automaticamente o pedido atualizado."
    );

    setScenario(routeState, "ten");
    await page.locator("[data-admin-refresh]").last().click();
    await waitForPreparingColumn(page, 10, 7);
    await validatePreparingColumnState(page, 10);

    setScenario(routeState, "thirteen");
    await page.locator("[data-admin-refresh]").last().click();
    await waitForPreparingColumn(page, 13, 10);
    await validatePreparingColumnState(page, 13);

    await openPreparingModal(page, 13);
    await validatePreparingModal(page, 13);
    await validatePreparingModalScroll(page);
    await page.screenshot({
      path: path.join(workspaceRoot, "_tmp_admin_kanban_volume_validation.png"),
      fullPage: true,
    });

    setScenario(routeState, "three");
    await page.evaluate(() => {
      document.querySelector("[data-admin-refresh]")?.click();
    });
    await waitForPreparingColumn(page, 3, 0);
    await waitForCondition(
      async () => page.locator("[data-admin-board-modal]").evaluate((node) => node.hidden).catch(() => true),
      "O modal deveria fechar quando a coluna volta a ter somente 3 pedidos."
    );
    await validatePreparingColumnState(page, 3);

    assert.ok(routeState.listRequests >= 5, "O gestor deveria consultar a lista em cada atualizacao relevante.");
    assert.ok(routeState.detailRequests >= 1, "A validacao deveria abrir pelo menos um detalhe de pedido.");
    assert.ok(routeState.auditRequests >= 1, "A auditoria silenciosa deveria continuar funcionando.");
    assert.equal(routeState.statusRequests, 1, "A mudanca de status deveria ser acionada uma vez.");
    assert.deepEqual(failedResponses, [], "O gestor nao deveria carregar recursos com erro HTTP.");
    assert.deepEqual(consoleErrors, [], "O gestor nao deveria emitir erros no console durante a validacao.");
    assert.deepEqual(pageErrors, [], "O gestor nao deveria disparar erros de execucao durante a validacao.");

    console.log("Dashboard, tema persistente e kanban admin validados com sucesso.");
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
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
