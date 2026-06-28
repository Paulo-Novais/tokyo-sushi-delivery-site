import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"],
  [".xml", "application/xml; charset=utf-8"],
]);

const AUTH_PROFILE_KEY = "tokyo_sushi_profile";
const CUSTOMER_CLIENT_TOKEN_KEY = "tokyo_customer_client_token";

const customer = {
  id: "profile-ui-stage3-local",
  name: "Cliente UI Local",
  phone: "(11) 96666-3311",
  email: "cliente-ui-local@teste.com",
};

const publicDeliverySettingsMock = {
  ok: true,
  storageMode: "validation-mock",
  generatedAt: "2026-04-11T20:30:00.000Z",
  summary: {
    totalBands: 4,
    activeBands: 4,
    inactiveBands: 0,
    activeCouriers: 0,
    totalCouriers: 0,
    deliveriesEnabled: true,
    pickupEnabled: true,
    freeShippingEnabled: false,
    maxRadiusKm: 14.9,
  },
  settings: {
    distanceBands: [
      {
        id: "band-up-to-1-9",
        minKm: 0,
        maxKm: 1.9,
        label: "Ate 1,9 km",
        customerFee: 9,
        courierFee: 0,
        minimumOrder: 0,
        isActive: true,
      },
      {
        id: "band-up-to-6-9",
        minKm: 1.9,
        maxKm: 6.9,
        label: "1,9 a 6,9 km",
        customerFee: 10,
        courierFee: 0,
        minimumOrder: 0,
        isActive: true,
      },
      {
        id: "band-up-to-10-9",
        minKm: 6.9,
        maxKm: 10.9,
        label: "6,9 a 10,9 km",
        customerFee: 12,
        courierFee: 0,
        minimumOrder: 0,
        isActive: true,
      },
      {
        id: "band-up-to-14-9",
        minKm: 10.9,
        maxKm: 14.9,
        label: "10,9 a 14,9 km",
        customerFee: 15,
        courierFee: 0,
        minimumOrder: 0,
        isActive: true,
      },
    ],
    deliveryTime: {
      minMinutes: 40,
      maxMinutes: 60,
      message: "Entrega estimada entre 40 e 60 minutos",
    },
    serviceArea: {
      maxRadiusKm: 14.9,
      servedNeighborhoods: [],
      blockedNeighborhoods: [],
      outOfAreaMessage: "No momento nao entregamos nessa regiao.",
    },
    freeShipping: {
      enabled: false,
      minimumOrder: 120,
      appliesToAllBands: true,
      bandIds: [],
    },
    pickup: {
      enabled: true,
      estimateMinutes: 25,
      message: "Retirada disponivel em 25 minutos",
    },
    status: {
      deliveriesEnabled: true,
      pausedMessage: "Entregas pausadas temporariamente. Retirada no balcao disponivel.",
    },
    updatedAt: "2026-04-11T20:30:00.000Z",
  },
};

const publicRestaurantSettingsMock = {
  ok: true,
  storageMode: "validation-mock",
  generatedAt: "2026-04-11T20:30:00.000Z",
  summary: {
    restaurantKey: "default",
    restaurantName: "Tokyo Sushi Delivery",
    hasStructuredBusinessSchedule: true,
  },
  settings: {
    restaurantKey: "default",
    restaurantName: "Tokyo Sushi Delivery",
    logoUrl: "./site-images/tokyo-logo-premium-transparent.png",
    bannerUrl: "./site-images/combinado-imperial.png",
    primaryColor: "#e83637",
    secondaryColor: "#f5c3d3",
    whatsapp: "5516990507398",
    address: "Rua General Osorio, 2165, Franca - SP, 14400-520, Brasil",
    businessHours: "18:00 as 23:00",
    businessSchedule: {
      timeZone: "America/Sao_Paulo",
      acceptOrdersOutsideHours: false,
      specialDates: [],
      days: {},
    },
    hasStructuredBusinessSchedule: true,
  },
};

const publicCatalogMock = {
  ok: true,
  storageMode: "validation-mock",
  generatedAt: "2026-04-11T20:30:00.000Z",
  summary: {
    totalItems: 0,
    totalSections: 0,
  },
  items: [],
  sections: [],
  featuredItemId: "",
  featuredItemIds: [],
};

const normalizePhone = (value) => String(value || "").replace(/\D/g, "").slice(-11);

const buildCustomerKey = ({ phone, email = "", profileId = "" }) => {
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedProfileId = String(profileId || "").trim();

  if (normalizedPhone) {
    return `phone:${normalizedPhone}`;
  }

  if (normalizedEmail) {
    return `email:${normalizedEmail}`;
  }

  return `profile:${normalizedProfileId}`;
};

const buildTrackingOrder = () => {
  const createdAt = new Date("2026-04-11T20:30:00-03:00").toISOString();

  return {
    id: "order-stage3-local",
    publicId: "TKY-LOCAL-0001",
    status: "Recebido",
    orderType: "scheduled",
    fulfillmentMode: "delivery",
    timingMode: "scheduled",
    createdAt,
    updatedAt: createdAt,
    scheduledFor: new Date("2026-04-12T20:45:00-03:00").toISOString(),
    scheduledDate: "2026-04-12",
    scheduledTime: "20:45",
    scheduledLabel: "2026-04-12 20:45",
    paymentMethod: "pix",
    needsChange: false,
    cashAmount: null,
    changeAmount: null,
    itemCount: 2,
    subtotal: 84.9,
    addonsTotal: 3.5,
    deliveryFee: 9.9,
    totalAmount: 98.3,
    customerNotes: "Sem cebolinha. Validacao local.",
    addressFull: "Rua das Flores, 123 - Centro, Sao Paulo - SP",
    addressComplement: "Apto 21",
    addressReference: "Portao preto",
    addressNeighborhood: "Centro",
    addressCity: "Sao Paulo",
    addressState: "SP",
    deliveryDistanceText: "4,2 km",
    deliveryRouteBand: "Centro expandido",
    deliveryEstimateText: "45-60 min",
    latestStatusNote: "Pedido criado pelo site.",
    items: [
      {
        id: "combo-stage3-local",
        type: "product",
        name: "Combinado Local Tracking",
        category: "Combinados",
        quantity: 1,
        unitPrice: 84.9,
        totalPrice: 84.9,
      },
      {
        id: "addon-stage3-local",
        type: "addon",
        name: "Molho especial",
        category: "Complemento do pedido",
        quantity: 1,
        unitPrice: 3.5,
        totalPrice: 3.5,
      },
    ],
    statusHistory: [
      {
        id: "status-stage3-local-1",
        status: "Recebido",
        note: "Pedido criado pelo site.",
        source: "system",
        createdAt,
      },
    ],
  };
};

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

const readLocatorText = async (page, selector) => {
  try {
    return (await page.locator(selector).textContent()) || "";
  } catch (error) {
    return "";
  }
};

const waitForText = async (page, selector, text, message, timeoutMs = 10000) => {
  await waitForCondition(
    async () => {
      const content = await readLocatorText(page, selector);
      return content.includes(text);
    },
    message,
    timeoutMs
  );
};

const createStaticServer = (rootDirectory) =>
  http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
      let pathname = decodeURIComponent(requestUrl.pathname);

      if (
        pathname === "/api/delivery-settings" ||
        pathname === "/api/restaurant-settings" ||
        pathname === "/api/catalog"
      ) {
        if (req.method !== "GET") {
          res.writeHead(405, {
            "Allow": "GET",
            "Content-Type": "application/json; charset=utf-8",
          });
          res.end(
            JSON.stringify({
              error: "Metodo nao permitido.",
              errorCode: "method_not_allowed",
            })
          );
          return;
        }

        res.writeHead(200, {
          "Cache-Control": "no-store",
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(
          JSON.stringify(
            pathname === "/api/restaurant-settings"
              ? publicRestaurantSettingsMock
              : pathname === "/api/catalog"
                ? publicCatalogMock
                : publicDeliverySettingsMock
          )
        );
        return;
      }

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

const main = async () => {
  const server = createStaticServer(workspaceRoot);
  const { port } = await listen(server);
  const baseURL = `http://127.0.0.1:${port}`;
  const trackingRootSelector = "[data-tracking-root]";
  const trackingSummarySelector = "[data-tracking-summary]";
  const headerCtaSelector = "[data-order-cta]";
  const expectedCustomerKey = buildCustomerKey(customer);
  const previewCode = "654321";
  const routeState = {
    authenticated: false,
    order: buildTrackingOrder(),
    authStartRequests: 0,
    authVerifyRequests: 0,
    activeOrderRequests: 0,
    logoutRequests: 0,
    lastTrackingHeaders: null,
  };

  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const context = await browser.newContext({
      baseURL,
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

    await page.addInitScript(() => {
      const originalSetInterval = window.setInterval.bind(window);

      window.setInterval = (callback, delay, ...args) =>
        originalSetInterval(callback, delay >= 25000 ? 150 : delay, ...args);
    });

    await page.route("**/api/customer/auth/start", async (route) => {
      routeState.authStartRequests += 1;
      const request = route.request();
      const payload = JSON.parse(request.postData() || "{}");
      const headers = request.headers();

      assert.equal(request.method(), "POST", "O login do cliente deve iniciar por POST.");
      assert.equal(payload.name, customer.name, "O nome do cliente precisa seguir para o backend.");
      assert.equal(
        normalizePhone(payload.phone),
        normalizePhone(customer.phone),
        "O telefone do cliente precisa seguir para o backend."
      );
      assert.ok(
        headers["x-tokyo-customer-client-token"],
        "O login do cliente precisa enviar o token seguro do aparelho."
      );

      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          ok: true,
          deliveryMode: "device-preview",
          notice: "Use o codigo provisorio deste aparelho para validar o acesso.",
          previewCode,
          expiresInSeconds: 600,
        }),
      });
    });

    await page.route("**/api/customer/auth/verify", async (route) => {
      routeState.authVerifyRequests += 1;
      const request = route.request();
      const payload = JSON.parse(request.postData() || "{}");
      const headers = request.headers();

      assert.equal(request.method(), "POST", "A validacao do codigo deve usar POST.");
      assert.equal(payload.code, previewCode, "O codigo digitado precisa bater com o desafio enviado.");
      assert.ok(
        headers["x-tokyo-customer-client-token"],
        "A validacao do codigo precisa manter o token seguro do aparelho."
      );

      routeState.authenticated = true;

      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          ok: true,
          authenticated: true,
        }),
      });
    });

    await page.route("**/api/customer/orders/active", async (route) => {
      routeState.activeOrderRequests += 1;
      routeState.lastTrackingHeaders = route.request().headers();

      if (routeState.authenticated) {
        assert.equal(
          routeState.lastTrackingHeaders["x-tokyo-customer-key"],
          expectedCustomerKey,
          "A consulta publica deve usar a chave do proprio cliente autenticado."
        );
        assert.ok(
          routeState.lastTrackingHeaders["x-tokyo-customer-client-token"],
          "A consulta publica deve manter o token seguro do aparelho."
        );
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify(
          routeState.authenticated
            ? {
                ok: true,
                authenticated: true,
                hasActiveOrder: true,
                order: routeState.order,
              }
            : {
                ok: true,
                authenticated: false,
                hasActiveOrder: false,
                order: null,
              }
        ),
      });
    });

    await page.route("**/api/customer/logout", async (route) => {
      routeState.logoutRequests += 1;
      routeState.authenticated = false;

      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          ok: true,
        }),
      });
    });

    await page.goto(`${baseURL}/acompanhar.html`, {
      waitUntil: "domcontentloaded",
    });

    await waitForText(
      page,
      headerCtaSelector,
      "Pedir Agora",
      "O botao do cabecalho deveria comecar como Pedir Agora."
    );
    await waitForText(
      page,
      trackingRootSelector,
      "Login necessario",
      "A area publica deveria bloquear o acompanhamento antes do login."
    );
    await waitForText(
      page,
      trackingSummarySelector,
      "Entre com sua conta",
      "O resumo inicial deveria orientar o login do cliente."
    );

    await page.locator("[data-auth-open]").first().click();
    await page.locator('input[name="entry_name"]').fill(customer.name);
    await page.locator('input[name="entry_phone"]').fill(customer.phone);
    await page.locator("[data-auth-phone-form] .auth-submit").click();

    await waitForText(
      page,
      ".auth-code-preview",
      previewCode,
      "O codigo provisorio deveria aparecer no fluxo local de validacao."
    );

    await page.locator('input[name="phone_code"]').fill(previewCode);
    await page.locator("[data-auth-phone-verify-form] .auth-submit").click();

    await waitForText(
      page,
      trackingRootSelector,
      routeState.order.publicId,
      "O cliente autenticado deveria visualizar o proprio pedido."
    );
    await waitForText(
      page,
      trackingRootSelector,
      "Recebido",
      "O acompanhamento deveria refletir o status inicial do pedido."
    );
    await waitForText(
      page,
      headerCtaSelector,
      "Acompanhar Pedido",
      "O cabecalho deveria trocar para Acompanhar Pedido quando existir pedido ativo."
    );

    const activeOrderRequestsAfterLogin = routeState.activeOrderRequests;
    const updatedAt = new Date().toISOString();
    routeState.order = {
      ...routeState.order,
      status: "Em preparo",
      updatedAt,
      latestStatusNote: "Pedido entrou na cozinha.",
      statusHistory: [
        {
          id: "status-stage3-local-2",
          status: "Em preparo",
          note: "Pedido entrou na cozinha.",
          source: "admin",
          createdAt: updatedAt,
        },
        ...routeState.order.statusHistory,
      ],
    };

    await waitForCondition(
      async () => routeState.activeOrderRequests > activeOrderRequestsAfterLogin,
      "A pagina nao fez a atualizacao automatica do pedido apos a mudanca de status.",
      8000
    );
    await waitForText(
      page,
      trackingRootSelector,
      "Em preparo",
      "A area publica nao refletiu o status atualizado do pedido."
    );
    await waitForText(
      page,
      trackingRootSelector,
      "Pedido entrou na cozinha.",
      "A anotacao operacional mais recente nao apareceu para o cliente."
    );

    await page.locator("[data-auth-open]").first().click();
    await page.locator("[data-auth-logout]").click();

    await waitForText(
      page,
      headerCtaSelector,
      "Pedir Agora",
      "O cabecalho deveria voltar para Pedir Agora depois do logout."
    );
    await waitForText(
      page,
      trackingRootSelector,
      "Login necessario",
      "A area publica deveria voltar para o estado bloqueado depois do logout."
    );

    const localStorageState = await page.evaluate(
      ({ authProfileKey, customerClientTokenKey }) => ({
        authProfile: window.localStorage.getItem(authProfileKey),
        customerClientToken: window.localStorage.getItem(customerClientTokenKey),
      }),
      {
        authProfileKey: AUTH_PROFILE_KEY,
        customerClientTokenKey: CUSTOMER_CLIENT_TOKEN_KEY,
      }
    );

    assert.equal(routeState.authStartRequests, 1, "O fluxo local deveria solicitar um unico codigo.");
    assert.equal(routeState.authVerifyRequests, 1, "O fluxo local deveria validar um unico codigo.");
    assert.ok(
      routeState.activeOrderRequests >= 2,
      "O acompanhamento local deveria consultar o pedido pelo menos duas vezes."
    );
    assert.ok(routeState.logoutRequests >= 1, "O fluxo local deveria chamar o endpoint de logout.");
    assert.equal(localStorageState.authProfile, null, "O logout deve limpar o perfil local do cliente.");
    assert.equal(
      localStorageState.customerClientToken,
      null,
      "O logout deve limpar o token seguro do aparelho."
    );
    assert.deepEqual(consoleErrors, [], "A area publica nao deveria emitir erros no console.");
    assert.deepEqual(pageErrors, [], "A pagina publica nao deveria disparar erros de execucao.");

    console.log("ETAPA 3 UI local validada com sucesso.");
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
