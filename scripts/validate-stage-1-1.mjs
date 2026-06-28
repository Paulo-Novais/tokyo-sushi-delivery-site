import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import middleware from "../middleware.js";

const require = createRequire(import.meta.url);
const adminAuth = require("../lib/admin-auth.cjs");
const createOrderHandler = require("../api/orders/create.js");
const adminApiHandler = require("../api/admin/[...action].js");
const adminDashboardHandler = adminApiHandler;
const adminAuthHandler = adminApiHandler;

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localDataDirectory = path.join(workspaceRoot, ".data");

const buildMockResponse = () => {
  const headers = {};

  return {
    statusCode: 200,
    payload: null,
    headers,
    setHeader(name, value) {
      headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return payload;
    },
  };
};

const buildMockRequest = ({
  method = "GET",
  body = "",
  headers = {},
  url = "http://localhost:3000/",
  remoteAddress = "127.0.0.1",
} = {}) => ({
  method,
  body,
  headers: Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), value])
  ),
  socket: {
    remoteAddress,
  },
  url,
});

const runHandler = async (handler, requestConfig) => {
  const req = buildMockRequest(requestConfig);
  const res = buildMockResponse();
  await handler(req, res);
  return { req, res };
};

const extractSessionCookieValue = (setCookieHeader) => {
  const cookiePart = String(setCookieHeader || "").split(";")[0];
  const separatorIndex = cookiePart.indexOf("=");
  return decodeURIComponent(cookiePart.slice(separatorIndex + 1));
};

const buildSampleOrderPayload = () => ({
  profile: {
    id: "profile-cliente-001",
    name: "Cliente Teste",
    phone: "(11) 99888-7766",
    email: "cliente@teste.com",
  },
  checkout: {
    paymentMethod: "pix",
    fulfillmentMode: "delivery",
    timingMode: "scheduled",
    scheduledDate: "2026-04-12",
    scheduledTime: "19:30",
    cashChangeRequired: "",
    cashAmountProvided: "",
    customerNotes: "Sem cebolinha.",
  },
  items: [
    {
      id: "carpaccio-salmao",
      name: "Carpaccio de Salmao",
      category: "Carpaccio",
      quantity: 2,
      price: 58.5,
    },
  ],
  addons: [
    {
      id: "addon-1",
      name: "Molho especial",
      quantity: 2,
      chargedQuantity: 2,
      freeUnits: 0,
      unitPrice: 3.5,
      totalPrice: 7,
    },
  ],
  deliveryQuote: {
    street: "Rua das Flores",
    houseNumber: "123",
    complement: "Apto 21",
    reference: "Portao preto",
    cep: "01310-100",
    neighborhood: "Centro",
    city: "Sao Paulo",
    state: "SP",
    geocodedAddress: "Rua das Flores, 123 - Centro, Sao Paulo - SP",
    destinationLabel: "Rua das Flores, 123 - Centro, Sao Paulo - SP",
    distanceText: "4,2 km",
    routeBand: "Centro expandido",
    totalEstimateText: "45-60 min",
    fee: 9.9,
  },
});

const run = async () => {
  await fs.rm(localDataDirectory, { recursive: true, force: true });

  process.env.NODE_ENV = "development";
  process.env.ADMIN_LOGIN = "admin@tokyo.test";
  process.env.ADMIN_PASSWORD_HASH = adminAuth.createPasswordHash("senha-segura");
  process.env.ADMIN_DISPLAY_NAME = "Gestor Tokyo";
  process.env.ADMIN_SESSION_SECRET = "segredo-admin-super-forte";
  process.env.ALLOWED_PUBLIC_ORIGINS =
    "https://tokyosushidelivery.com.br,http://localhost:3000,http://127.0.0.1:3000";
  process.env.ORDER_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.ORDER_RATE_LIMIT_MAX_REQUESTS = "2";
  process.env.ORDER_MAX_BODY_BYTES = "65536";
  delete process.env.DATABASE_URL;

  const loginPageResponse = middleware(
    new Request("http://localhost:3000/admin/login.html")
  );
  assert.equal(loginPageResponse.status, 200, "A tela de login deve ser publica.");

  const adminCssResponse = middleware(new Request("http://localhost:3000/admin/admin.css"));
  assert.equal(adminCssResponse.status, 200, "O CSS da tela de login deve ser publico.");

  const adminJsResponse = middleware(new Request("http://localhost:3000/admin/admin.js"));
  assert.equal(adminJsResponse.status, 200, "O JS da tela de login deve ser publico.");

  const blockedAdminResponse = middleware(new Request("http://localhost:3000/admin/"));
  assert.equal(blockedAdminResponse.status, 307, "O painel admin sem sessao deve redirecionar.");
  assert.match(
    blockedAdminResponse.headers.get("location") || "",
    /\/admin\/login\.html\?next=%2Fadmin%2F$/,
    "O redirecionamento do admin sem sessao deve apontar para o login."
  );

  const invalidOrderAttempt = await runHandler(createOrderHandler, {
    method: "POST",
    url: "http://localhost:3000/api/orders/create",
    headers: {
      host: "localhost:3000",
      "x-forwarded-proto": "http",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify({}),
  });
  assert.equal(
    invalidOrderAttempt.res.statusCode,
    415,
    "Pedidos sem Content-Type JSON devem ser bloqueados."
  );

  const localLogin = await runHandler(adminAuthHandler, {
    method: "POST",
    url: "http://localhost:3000/api/admin/login",
    headers: {
      host: "localhost:3000",
      "x-forwarded-proto": "http",
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      identifier: "admin@tokyo.test",
      password: "senha-segura",
      next: "/admin/",
    }),
  });
  assert.equal(localLogin.res.statusCode, 200, "O login local valido deve funcionar.");
  assert.ok(localLogin.res.headers["Set-Cookie"], "O login deve devolver Set-Cookie.");
  assert.ok(
    !String(localLogin.res.headers["Set-Cookie"]).includes("Secure"),
    "O cookie local nao deve usar Secure."
  );

  const sessionToken = extractSessionCookieValue(localLogin.res.headers["Set-Cookie"]);
  const authenticatedAdminResponse = middleware(
    new Request("http://localhost:3000/admin/", {
      headers: {
        cookie: `${adminAuth.ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
      },
    })
  );
  assert.equal(
    authenticatedAdminResponse.status,
    200,
    "Com sessao valida, o admin deve continuar acessivel."
  );

  const productionLogin = await runHandler(adminAuthHandler, {
    method: "POST",
    url: "https://tokyosushidelivery.com.br/api/admin/login",
    headers: {
      host: "tokyosushidelivery.com.br",
      "x-forwarded-proto": "https",
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      identifier: "admin@tokyo.test",
      password: "senha-segura",
      next: "/admin/",
    }),
  });
  assert.equal(productionLogin.res.statusCode, 200, "O login em contexto HTTPS deve funcionar.");
  assert.ok(
    String(productionLogin.res.headers["Set-Cookie"]).includes("Secure"),
    "O cookie de producao deve manter a flag Secure."
  );

  const validOrderRequest = await runHandler(createOrderHandler, {
    method: "POST",
    url: "http://localhost:3000/api/orders/create",
    headers: {
      host: "localhost:3000",
      "x-forwarded-proto": "http",
      "x-forwarded-for": "203.0.113.10",
      origin: "http://localhost:3000",
      "content-type": "application/json; charset=utf-8",
      accept: "application/json",
    },
    body: JSON.stringify(buildSampleOrderPayload()),
  });
  assert.equal(validOrderRequest.res.statusCode, 200, "O pedido valido deve ser criado.");
  assert.equal(validOrderRequest.res.payload?.ok, true, "A API deve confirmar o pedido.");
  assert.equal(
    validOrderRequest.res.payload?.order?.status,
    "Recebido",
    "O pedido deve nascer com status Recebido."
  );

  const dashboardRequest = await runHandler(adminDashboardHandler, {
    method: "GET",
    url: "http://localhost:3000/api/admin/dashboard",
    headers: {
      host: "localhost:3000",
      "x-forwarded-proto": "http",
      cookie: `${adminAuth.ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
    },
  });
  assert.equal(dashboardRequest.res.statusCode, 200, "O dashboard admin deve carregar com sessao.");
  assert.ok(
    Array.isArray(dashboardRequest.res.payload?.orders) &&
      dashboardRequest.res.payload.orders.length >= 1,
    "O painel admin deve listar o pedido criado."
  );
  assert.equal(
    dashboardRequest.res.payload.orders[0]?.publicId,
    validOrderRequest.res.payload.order.publicId,
    "O pedido criado deve aparecer no painel admin."
  );

  const wrongOriginOrder = await runHandler(createOrderHandler, {
    method: "POST",
    url: "https://tokyosushidelivery.com.br/api/orders/create",
    headers: {
      host: "tokyosushidelivery.com.br",
      "x-forwarded-proto": "https",
      "x-forwarded-for": "203.0.113.20",
      origin: "https://site-malicioso.example",
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(buildSampleOrderPayload()),
  });
  assert.equal(
    wrongOriginOrder.res.statusCode,
    403,
    "Pedidos de origem nao autorizada devem ser bloqueados."
  );

  await runHandler(createOrderHandler, {
    method: "POST",
    url: "http://localhost:3000/api/orders/create",
    headers: {
      host: "localhost:3000",
      "x-forwarded-proto": "http",
      "x-forwarded-for": "203.0.113.30",
      origin: "http://localhost:3000",
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(buildSampleOrderPayload()),
  });

  await runHandler(createOrderHandler, {
    method: "POST",
    url: "http://localhost:3000/api/orders/create",
    headers: {
      host: "localhost:3000",
      "x-forwarded-proto": "http",
      "x-forwarded-for": "203.0.113.30",
      origin: "http://localhost:3000",
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      ...buildSampleOrderPayload(),
      profile: {
        id: "profile-cliente-001",
        name: "Cliente Teste",
        phone: "(11) 99888-7766",
        email: "cliente2@teste.com",
      },
    }),
  });

  const rateLimitedOrder = await runHandler(createOrderHandler, {
    method: "POST",
    url: "http://localhost:3000/api/orders/create",
    headers: {
      host: "localhost:3000",
      "x-forwarded-proto": "http",
      "x-forwarded-for": "203.0.113.30",
      origin: "http://localhost:3000",
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      ...buildSampleOrderPayload(),
      profile: {
        id: "profile-cliente-003",
        name: "Cliente Rate Limit",
        phone: "(11) 97777-1111",
        email: "ratelimit@teste.com",
      },
    }),
  });
  assert.equal(rateLimitedOrder.res.statusCode, 429, "O rate limit deve bloquear excesso por IP.");
  assert.ok(
    rateLimitedOrder.res.headers["Retry-After"],
    "O rate limit deve informar Retry-After."
  );

  await fs.rm(localDataDirectory, { recursive: true, force: true });
  console.log("ETAPA 1.1 validada com sucesso.");
};

run().catch(async (error) => {
  await fs.rm(localDataDirectory, { recursive: true, force: true });
  console.error(error);
  process.exitCode = 1;
});
