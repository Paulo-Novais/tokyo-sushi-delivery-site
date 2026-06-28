import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const realDataDirectory = path.join(workspaceRoot, ".data");

const MOBILE_WIDTHS = [320, 360, 375, 390, 414, 430, 768];
const PUBLIC_PAGES = [
  { label: "inicio", pathname: "/" },
  { label: "cardapio", pathname: "/cardapio.html" },
  { label: "entrega", pathname: "/entrega.html" },
  { label: "acompanhar", pathname: "/acompanhar.html" },
  { label: "historico", pathname: "/historico.html" },
  { label: "avaliar", pathname: "/avaliar.html" },
  { label: "trabalhe-conosco", pathname: "/trabalhe-conosco.html" },
];
const SITE_LAYOUTS = ["MODERN", "CATALOGO", "PREMIUM"];
const SITE_THEMES = ["LIGHT", "DARK", "AUTO"];
const ORDER_FLOW_WIDTHS = MOBILE_WIDTHS;

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".cjs", "application/javascript; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "application/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"],
]);

const currentAppearance = {
  layout: "MODERN",
  theme: "DARK",
};

const getDirectoryFingerprint = async (directoryPath) => {
  const stats = await fs.stat(directoryPath).catch(() => null);

  if (!stats) {
    return { exists: false, entries: [] };
  }

  assert.ok(stats.isDirectory(), ".data real deve ser um diretorio quando existir.");
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

const writeJson = (res, payload, statusCode = 200) => {
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
};

const buildRestaurantSettingsPayload = () => ({
  ok: true,
  storageMode: "mock",
  settings: {
    restaurantKey: "default",
    restaurantName: "Tokyo Sushi Delivery",
    logoUrl: "./site-images/tokyo-logo-premium-transparent.png",
    bannerUrl: "./site-images/combinado-imperial.png",
    primaryColor: "#e83637",
    secondaryColor: "#f5c3d3",
    accentColor: "#f2b649",
    gradientStart: "#e83637",
    gradientEnd: "#2b1214",
    useGradient: true,
    siteLayout: currentAppearance.layout,
    siteTheme: currentAppearance.theme,
    slogan: "Delivery Premium",
    description: "Restaurante modelo da validacao mobile publica.",
    instagram: "https://instagram.com/tokyosushidelivery",
    facebook: "",
    tiktok: "",
    site: "https://tokyosushidelivery.com.br",
    addressFields: {
      postalCode: "14400-520",
      street: "Rua General Osorio",
      number: "2165",
      neighborhood: "",
      city: "Franca",
      state: "SP",
    },
    deliveryBase: {
      latitude: -20.5387,
      longitude: -47.4009,
      maxDeliveryRadiusKm: 8,
      fixedDeliveryFee: 8,
      pricePerKm: 2,
      minimumDeliveryOrder: 50,
      pickupEnabled: true,
      deliveryEnabled: true,
    },
    platformFooter: {
      showPlatformBranding: true,
      headline: "Desenvolvido por INovas Food",
      description: "Plataforma profissional para restaurantes",
      displayUrl: "www.inovasfood.com.br",
      url: "https://www.inovasfood.com.br",
    },
    appearance: {
      layout: currentAppearance.layout,
      theme: currentAppearance.theme,
      colors: {
        primary: "#e83637",
        secondary: "#f5c3d3",
        accent: "#f2b649",
        gradientStart: "#e83637",
        gradientEnd: "#2b1214",
        useGradient: true,
      },
      identity: {
        slogan: "Delivery Premium",
        description: "Restaurante modelo da validacao mobile publica.",
      },
      social: {
        instagram: "https://instagram.com/tokyosushidelivery",
        site: "https://tokyosushidelivery.com.br",
      },
      platformFooter: {
        showPlatformBranding: true,
        headline: "Desenvolvido por INovas Food",
        description: "Plataforma profissional para restaurantes",
        displayUrl: "www.inovasfood.com.br",
        url: "https://www.inovasfood.com.br",
      },
    },
  },
});

const buildCatalogPayload = () => ({
  ok: true,
  sections: [],
  items: [],
  featuredItems: [],
  sectionDisplayOrder: [],
});

const buildReviewsPayload = () => ({
  ok: true,
  summary: {
    displayAverage: 5,
    displayAverageLabel: "5.0",
    publicReviewCount: 1,
    publicCountLabel: "1 avaliacao publicada",
    recentCountLabel: "Baseado em 1 avaliacao recente",
  },
  reviews: [
    {
      id: "mock-review-mobile",
      name: "Cliente mobile",
      rating: 5,
      message: "Fluxo mobile validado em ambiente local.",
      createdAt: "2026-01-01T00:00:00.000Z",
      status: "published",
    },
  ],
});

const buildDeliverySettingsPayload = () => ({
  ok: true,
  summary: {
    deliveryEnabled: true,
    pickupEnabled: true,
    fixedDeliveryFee: 8,
    minimumDeliveryOrder: 50,
  },
  settings: {
    deliveryEnabled: true,
    pickupEnabled: true,
    fixedDeliveryFee: 8,
    pricePerKm: 2,
    minimumDeliveryOrder: 50,
    maxDeliveryRadiusKm: 8,
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
});

const createStaticServer = (rootDirectory) =>
  http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || "/", "http://127.0.0.1");

      if (requestUrl.pathname === "/api/restaurant-settings") {
        writeJson(res, buildRestaurantSettingsPayload());
        return;
      }

      if (requestUrl.pathname === "/api/catalog") {
        writeJson(res, buildCatalogPayload());
        return;
      }

      if (requestUrl.pathname === "/api/reviews") {
        writeJson(res, buildReviewsPayload());
        return;
      }

      if (requestUrl.pathname === "/api/delivery-settings") {
        writeJson(res, buildDeliverySettingsPayload());
        return;
      }

      if (requestUrl.pathname === "/api/customer/orders/active") {
        writeJson(res, {
          ok: true,
          authenticated: false,
          hasActiveOrder: false,
          order: null,
        });
        return;
      }

      if (requestUrl.pathname.startsWith("/api/")) {
        writeJson(res, { ok: false, error: "Not found" }, 404);
        return;
      }

      let pathname = decodeURIComponent(requestUrl.pathname);

      if (pathname === "/") {
        pathname = "/index.html";
      }

      const requestedPath = path.resolve(rootDirectory, `.${pathname}`);

      if (requestedPath !== rootDirectory && !requestedPath.startsWith(`${rootDirectory}${path.sep}`)) {
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
      res.end(error?.message || "Internal server error");
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

const closeServer = (server) =>
  new Promise((resolve) => {
    server.close(() => resolve());
  });

const getGoogleMapsStub = (requestUrl) => {
  const url = new URL(requestUrl);
  const callbackName = url.searchParams.get("callback");

  return `
    window.google = window.google || {};
    window.google.maps = window.google.maps || {
      TravelMode: { DRIVING: "DRIVING" },
      UnitSystem: { METRIC: 0 },
      DistanceMatrixStatus: { OK: "OK" },
      DistanceMatrixElementStatus: { ZERO_RESULTS: "ZERO_RESULTS" },
      DistanceMatrixService: function DistanceMatrixService() {
        this.getDistanceMatrix = function getDistanceMatrix(_request, callback) {
          callback({ rows: [{ elements: [{ status: "ZERO_RESULTS" }] }] }, "OK");
        };
      }
    };
    ${callbackName ? `if (window.${callbackName}) window.${callbackName}();` : ""}
  `;
};

const collectMobileMetrics = async (page, expectedPathname) =>
  page.evaluate((pagePathname) => {
    const toRect = (selector) => {
      const node = document.querySelector(selector);

      if (!node) {
        return { exists: false };
      }

      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);

      return {
        exists: true,
        x: Number(rect.x.toFixed(2)),
        y: Number(rect.y.toFixed(2)),
        right: Number(rect.right.toFixed(2)),
        bottom: Number(rect.bottom.toFixed(2)),
        width: Number(rect.width.toFixed(2)),
        height: Number(rect.height.toFixed(2)),
        display: style.display,
        opacity: Number(style.opacity),
        pointerEvents: style.pointerEvents,
        visibility: style.visibility,
      };
    };

    const isVisibleInteractive = (node) => {
      if (!(node instanceof HTMLElement)) {
        return false;
      }

      if (node.matches('[hidden], [aria-hidden="true"], [disabled]')) {
        return false;
      }

      const style = window.getComputedStyle(node);

      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) === 0 ||
        style.pointerEvents === "none"
      ) {
        return false;
      }

      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const smallTargets = Array.from(
      document.querySelectorAll(
        'a, button, input, select, textarea, label, [role="button"], [tabindex]:not([tabindex="-1"])'
      )
    )
      .filter(isVisibleInteractive)
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        const tagName = node.tagName.toLowerCase();
        const label =
          node.getAttribute("aria-label") ||
          node.textContent?.replace(/\s+/g, " ").trim() ||
          node.getAttribute("href") ||
          node.getAttribute("class") ||
          tagName;

        if (tagName === "input" && node.type === "hidden") {
          return false;
        }

        return rect.width < 40 || rect.height < 40
          ? {
              selector: node.className || tagName,
              label,
              width: Number(rect.width.toFixed(2)),
              height: Number(rect.height.toFixed(2)),
            }
          : false;
      })
      .map((node) => {
        const rect = node.getBoundingClientRect();

        return {
          tagName: node.tagName.toLowerCase(),
          className: String(node.className || ""),
          label:
            node.getAttribute("aria-label") ||
            node.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) ||
            node.getAttribute("href") ||
            "",
          width: Number(rect.width.toFixed(2)),
          height: Number(rect.height.toFixed(2)),
        };
      });

    return {
      pathname: pagePathname,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      htmlDataset: {
        layout: document.documentElement.dataset.siteLayout || "",
        theme: document.documentElement.dataset.siteTheme || "",
        themeMode: document.documentElement.dataset.siteThemeMode || "",
      },
      header: toRect(".site-header"),
      brand: toRect(".brand"),
      navLinks: toRect(".nav-links"),
      navActions: toRect(".nav-actions"),
      cartButton: toRect("[data-cart-toggle]"),
      footer: toRect("[data-site-footer]"),
      platformFooter: toRect("[data-platform-branding]"),
      catalogRoot: toRect("[data-catalog-root]"),
      catalogNav: toRect("[data-public-layout-nav]"),
      mobileCatalogSheet: toRect("[data-mobile-catalog-sheet]"),
      cartDrawer: toRect("[data-cart-drawer]"),
      cartClose: toRect("[data-cart-close]"),
      cartItem: toRect(".cart-item"),
      cartCheckoutDock: toRect("[data-cart-checkout-shell]"),
      cartCheckoutToggle: toRect("[data-cart-checkout-toggle]"),
      cartCheckoutPanel: toRect("[data-cart-checkout-panel]"),
      cartSubmit: toRect("[data-cart-submit]"),
      visibleCatalogCards: document.querySelectorAll("[data-catalog-root] .catalog-card").length,
      cartIsOpen: document.body.classList.contains("cart-open"),
      catalogSheetIsOpen: document.body.classList.contains("catalog-sheet-open"),
      cartItemCount: Number(document.querySelector("[data-cart-count]")?.textContent || 0),
      smallTargets,
    };
  }, expectedPathname);

const assertVisible = (rect, label) => {
  assert.equal(rect.exists, true, `${label} nao encontrado.`);
  assert.notEqual(rect.display, "none", `${label} com display none.`);
  assert.notEqual(rect.visibility, "hidden", `${label} invisivel.`);
  assert.ok(rect.opacity > 0, `${label} com opacidade zero.`);
  assert.ok(rect.width > 0 && rect.height > 0, `${label} sem dimensoes visiveis.`);
};

const validateMetrics = ({ metrics, width, pageLabel, expectedLayout, expectedTheme }) => {
  assert.ok(
    metrics.scrollWidth <= metrics.innerWidth + 2,
    `${pageLabel} ${width}px gerou overflow horizontal: scrollWidth=${metrics.scrollWidth}, innerWidth=${metrics.innerWidth}.`
  );

  assertVisible(metrics.header, `${pageLabel} header`);
  assertVisible(metrics.brand, `${pageLabel} marca`);
  assertVisible(metrics.navLinks, `${pageLabel} navegacao`);
  assertVisible(metrics.cartButton, `${pageLabel} botao da sacola`);
  assertVisible(metrics.footer, `${pageLabel} rodape`);
  assertVisible(metrics.platformFooter, `${pageLabel} rodape INovas`);

  assert.ok(
    metrics.cartButton.width >= 40 && metrics.cartButton.height >= 40,
    `${pageLabel} ${width}px deixou a sacola com alvo menor que 40px.`
  );

  assert.equal(
    metrics.htmlDataset.layout,
    expectedLayout.toLowerCase(),
    `${pageLabel} ${width}px nao aplicou layout ${expectedLayout}.`
  );
  assert.equal(
    metrics.htmlDataset.themeMode,
    expectedTheme.toLowerCase(),
    `${pageLabel} ${width}px nao aplicou modo de tema ${expectedTheme}.`
  );

  if (pageLabel === "cardapio") {
    assertVisible(metrics.catalogRoot, "cardapio raiz do catalogo");
    assertVisible(metrics.catalogNav, "cardapio navegacao por categorias");
  }

  assert.equal(
    metrics.smallTargets.length,
    0,
    `${pageLabel} ${width}px tem alvos de toque pequenos: ${JSON.stringify(metrics.smallTargets.slice(0, 8))}`
  );
};

const assertWithinViewport = (rect, metrics, label) => {
  assertVisible(rect, label);
  assert.ok(rect.x >= -2, `${label} ultrapassou a esquerda da viewport.`);
  assert.ok(rect.right <= metrics.innerWidth + 2, `${label} ultrapassou a direita da viewport.`);
  assert.ok(rect.bottom <= metrics.innerHeight + 2, `${label} ultrapassou a base da viewport.`);
};

const validateOpenCartMetrics = ({ metrics, width }) => {
  assert.ok(
    metrics.scrollWidth <= metrics.innerWidth + 2,
    `fluxo pedido ${width}px gerou overflow horizontal: scrollWidth=${metrics.scrollWidth}, innerWidth=${metrics.innerWidth}.`
  );
  assert.equal(metrics.cartIsOpen, true, `fluxo pedido ${width}px nao abriu a sacola.`);
  assert.ok(metrics.cartItemCount > 0, `fluxo pedido ${width}px nao adicionou item na sacola.`);
  assertWithinViewport(metrics.cartDrawer, metrics, `fluxo pedido ${width}px drawer da sacola`);
  assertVisible(metrics.cartItem, `fluxo pedido ${width}px item da sacola`);
  assertVisible(metrics.cartCheckoutDock, `fluxo pedido ${width}px bloco de checkout`);
  assertVisible(metrics.cartCheckoutToggle, `fluxo pedido ${width}px botao de checkout`);
  assertVisible(metrics.cartCheckoutPanel, `fluxo pedido ${width}px painel de checkout`);
  assertVisible(metrics.cartSubmit, `fluxo pedido ${width}px botao finalizar`);
  assertVisible(metrics.cartClose, `fluxo pedido ${width}px botao fechar sacola`);

  for (const [label, rect] of [
    ["fechar sacola", metrics.cartClose],
    ["checkout", metrics.cartCheckoutToggle],
    ["finalizar", metrics.cartSubmit],
  ]) {
    assert.ok(
      rect.width >= 40 && rect.height >= 40,
      `fluxo pedido ${width}px deixou ${label} com alvo menor que 40px.`
    );
  }

  assert.equal(
    metrics.smallTargets.length,
    0,
    `fluxo pedido ${width}px tem alvos de toque pequenos: ${JSON.stringify(metrics.smallTargets.slice(0, 8))}`
  );
};

const routeExternalDependencies = async (page) => {
  await page.route("https://maps.googleapis.com/**", async (route) => {
    await route.fulfill({
      body: getGoogleMapsStub(route.request().url()),
      contentType: "application/javascript; charset=utf-8",
      status: 200,
    });
  });
  await page.route("https://viacep.com.br/**", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ erro: true }),
      contentType: "application/json; charset=utf-8",
      status: 200,
    });
  });
};

const validateScenario = async ({ browser, baseUrl, pageInfo, width, layout, theme }) => {
  currentAppearance.layout = layout;
  currentAppearance.theme = theme;

  const context = await browser.newContext({
    deviceScaleFactor: 1,
    hasTouch: width < 900,
    isMobile: width < 900,
    serviceWorkers: "block",
    viewport: {
      width,
      height: width >= 768 ? 1024 : 900,
    },
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
    pageErrors.push(error.message);
  });
  page.on("response", (response) => {
    const url = response.url();

    if (url.startsWith(baseUrl) && response.status() >= 400) {
      failedResponses.push(`${response.status()} ${url}`);
    }
  });

  await routeExternalDependencies(page);

  try {
    const response = await page.goto(`${baseUrl}${pageInfo.pathname}`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    assert.ok(response?.ok(), `${pageInfo.label} ${width}px falhou ao carregar.`);

    await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
    await page
      .waitForFunction(() => document.querySelector("[data-site-footer]"), null, { timeout: 8000 })
      .catch(() => {});
    await page.waitForTimeout(300);

    assert.equal(consoleErrors.length, 0, `${pageInfo.label} ${width}px gerou console.error: ${consoleErrors.join(" | ")}`);
    assert.equal(pageErrors.length, 0, `${pageInfo.label} ${width}px gerou pageerror: ${pageErrors.join(" | ")}`);
    assert.equal(failedResponses.length, 0, `${pageInfo.label} ${width}px teve respostas >=400: ${failedResponses.join(" | ")}`);

    const topMetrics = await collectMobileMetrics(page, pageInfo.pathname);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(450);
    const bottomMetrics = await collectMobileMetrics(page, pageInfo.pathname);
    const metrics = {
      ...topMetrics,
      footer: bottomMetrics.footer,
      platformFooter: bottomMetrics.platformFooter,
      smallTargets: [...topMetrics.smallTargets, ...bottomMetrics.smallTargets],
    };

    validateMetrics({
      metrics,
      width,
      pageLabel: pageInfo.label,
      expectedLayout: layout,
      expectedTheme: theme,
    });
  } finally {
    await context.close();
  }
};

const validateOrderFlowScenario = async ({ browser, baseUrl, width }) => {
  currentAppearance.layout = "MODERN";
  currentAppearance.theme = "DARK";

  const context = await browser.newContext({
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    serviceWorkers: "block",
    viewport: {
      width,
      height: width >= 768 ? 1024 : 900,
    },
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
    pageErrors.push(error.message);
  });
  page.on("response", (response) => {
    const url = response.url();

    if (url.startsWith(baseUrl) && response.status() >= 400) {
      failedResponses.push(`${response.status()} ${url}`);
    }
  });

  await routeExternalDependencies(page);

  try {
    const response = await page.goto(`${baseUrl}/cardapio.html`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    assert.ok(response?.ok(), `fluxo pedido ${width}px falhou ao carregar cardapio.`);

    await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
    await page.waitForSelector("[data-catalog-root]", { timeout: 8000 });
    await page.waitForSelector("[data-mobile-catalog-group-card], button[data-add-to-cart]", {
      timeout: 8000,
    });

    const mobileGroupCard = page.locator("[data-mobile-catalog-group-card]:visible").first();
    if ((await mobileGroupCard.count()) > 0) {
      await mobileGroupCard.click();
      await page.waitForFunction(() => document.body.classList.contains("catalog-sheet-open"), null, {
        timeout: 5000,
      });
    }

    const addButton = page.locator("button[data-add-to-cart]:visible:not([disabled])").first();
    await addButton.waitFor({ state: "visible", timeout: 8000 });
    await addButton.click();
    await page.waitForFunction(
      () => Number(document.querySelector("[data-cart-count]")?.textContent || 0) > 0,
      null,
      { timeout: 5000 }
    );

    await page.locator("[data-cart-toggle]:visible").first().click();
    await page.waitForFunction(() => document.body.classList.contains("cart-open"), null, {
      timeout: 5000,
    });
    await page.locator("[data-cart-checkout-toggle]:visible").first().click();
    await page.waitForFunction(
      () => !document.querySelector("[data-cart-checkout-panel]")?.hasAttribute("hidden"),
      null,
      { timeout: 5000 }
    );
    await page.waitForTimeout(300);

    assert.equal(consoleErrors.length, 0, `fluxo pedido ${width}px gerou console.error: ${consoleErrors.join(" | ")}`);
    assert.equal(pageErrors.length, 0, `fluxo pedido ${width}px gerou pageerror: ${pageErrors.join(" | ")}`);
    assert.equal(failedResponses.length, 0, `fluxo pedido ${width}px teve respostas >=400: ${failedResponses.join(" | ")}`);

    const metrics = await collectMobileMetrics(page, "/cardapio.html");
    validateOpenCartMetrics({ metrics, width });
  } finally {
    await context.close();
  }
};

const main = async () => {
  const beforeDataFingerprint = await getDirectoryFingerprint(realDataDirectory);
  const server = createStaticServer(workspaceRoot);
  const address = await listen(server);
  const baseUrl = `http://${address.host}:${address.port}`;
  const browser = await chromium.launch();
  let validatedScenarios = 0;

  try {
    for (const width of MOBILE_WIDTHS) {
      for (const pageInfo of PUBLIC_PAGES) {
        await validateScenario({
          browser,
          baseUrl,
          pageInfo,
          width,
          layout: "MODERN",
          theme: "DARK",
        });
        validatedScenarios += 1;
      }
    }

    for (const layout of SITE_LAYOUTS) {
      for (const theme of SITE_THEMES) {
        for (const width of [390, 768]) {
          await validateScenario({
            browser,
            baseUrl,
            pageInfo: { label: "cardapio", pathname: "/cardapio.html" },
            width,
            layout,
            theme,
          });
          validatedScenarios += 1;
        }
      }
    }

    for (const width of ORDER_FLOW_WIDTHS) {
      await validateOrderFlowScenario({
        browser,
        baseUrl,
        width,
      });
      validatedScenarios += 1;
    }
  } finally {
    await browser.close();
    await closeServer(server);
  }

  const afterDataFingerprint = await getDirectoryFingerprint(realDataDirectory);
  assert.deepEqual(afterDataFingerprint, beforeDataFingerprint, "A validacao mobile nao pode alterar .data real.");

  console.log(`validate:mobile-public-local OK - ${validatedScenarios} cenarios mobile validados.`);
};

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
