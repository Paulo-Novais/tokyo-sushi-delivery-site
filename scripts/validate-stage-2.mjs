import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const adminAuth = require("../lib/admin-auth.cjs");
const createOrderHandler = require("../api/orders/create.js");
const adminLoginHandler = require("../api/admin/login.js");
const adminDashboardHandler = require("../api/admin/dashboard.js");
const adminOrderActionHandler = require("../api/admin/orders/[action].js");

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
    id: "profile-cliente-002",
    name: "Cliente Operacao",
    phone: "(11) 97777-2211",
    email: "operacao@teste.com",
  },
  checkout: {
    paymentMethod: "dinheiro",
    fulfillmentMode: "delivery",
    timingMode: "scheduled",
    scheduledDate: "2026-04-12",
    scheduledTime: "20:30",
    cashChangeRequired: "yes",
    cashAmountProvided: "130",
    customerNotes: "Caprichar no shoyu.",
  },
  items: [
    {
      id: "combo-2",
      name: "Combinado Executivo",
      category: "Combinados",
      quantity: 1,
      price: 89.9,
    },
  ],
  addons: [
    {
      id: "addon-2",
      name: "Molho tare",
      quantity: 2,
      chargedQuantity: 2,
      freeUnits: 0,
      unitPrice: 2.5,
      totalPrice: 5,
    },
  ],
  deliveryQuote: {
    street: "Rua da Consolacao",
    houseNumber: "500",
    complement: "Conjunto 11",
    reference: "Ao lado da portaria",
    cep: "01302-000",
    neighborhood: "Consolacao",
    city: "Sao Paulo",
    state: "SP",
    geocodedAddress: "Rua da Consolacao, 500 - Consolacao, Sao Paulo - SP",
    destinationLabel: "Rua da Consolacao, 500 - Consolacao, Sao Paulo - SP",
    distanceText: "5,1 km",
    routeBand: "Centro expandido",
    totalEstimateText: "40-55 min",
    fee: 8.9,
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
  process.env.ORDER_RATE_LIMIT_MAX_REQUESTS = "10";
  process.env.ORDER_MAX_BODY_BYTES = "65536";
  delete process.env.DATABASE_URL;

  const createdOrder = await runHandler(createOrderHandler, {
    method: "POST",
    url: "http://localhost:3000/api/orders/create",
    headers: {
      host: "localhost:3000",
      "x-forwarded-proto": "http",
      "x-forwarded-for": "203.0.113.50",
      origin: "http://localhost:3000",
      "content-type": "application/json; charset=utf-8",
      accept: "application/json",
    },
    body: JSON.stringify(buildSampleOrderPayload()),
  });
  assert.equal(createdOrder.res.statusCode, 200, "O pedido da ETAPA 2 deve ser criado.");
  assert.equal(createdOrder.res.payload?.order?.status, "Novo", "O pedido deve nascer como Novo.");

  const login = await runHandler(adminLoginHandler, {
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
  assert.equal(login.res.statusCode, 200, "O login admin deve funcionar antes de operar o painel.");
  const sessionToken = extractSessionCookieValue(login.res.headers["Set-Cookie"]);
  const sessionCookie = `${adminAuth.ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`;

  const orderList = await runHandler(adminOrderActionHandler, {
    method: "GET",
    url: "http://localhost:3000/api/admin/orders/list?limit=20",
    headers: {
      host: "localhost:3000",
      "x-forwarded-proto": "http",
      cookie: sessionCookie,
    },
  });
  assert.equal(orderList.res.statusCode, 200, "A listagem operacional do admin deve carregar.");
  assert.ok(Array.isArray(orderList.res.payload?.orders), "A API deve devolver a lista de pedidos.");
  assert.equal(
    orderList.res.payload.orders[0]?.publicId,
    createdOrder.res.payload.order.publicId,
    "O pedido criado precisa aparecer na fila operacional."
  );

  const orderDetails = await runHandler(adminOrderActionHandler, {
    method: "GET",
    url: `http://localhost:3000/api/admin/orders/details?orderId=${createdOrder.res.payload.order.id}`,
    headers: {
      host: "localhost:3000",
      "x-forwarded-proto": "http",
      cookie: sessionCookie,
    },
  });
  assert.equal(orderDetails.res.statusCode, 200, "Os detalhes do pedido devem abrir.");
  assert.equal(
    orderDetails.res.payload?.order?.customerName,
    "Cliente Operacao",
    "O detalhe precisa expor os dados do cliente."
  );
  assert.equal(
    orderDetails.res.payload?.order?.items?.length,
    2,
    "Os itens e adicionais devem aparecer no detalhe."
  );
  assert.ok(
    Array.isArray(orderDetails.res.payload?.order?.statusHistory) &&
      orderDetails.res.payload.order.statusHistory.length >= 1,
    "O detalhe deve trazer o historico de status."
  );

  const statusUpdate = await runHandler(adminOrderActionHandler, {
    method: "POST",
    url: "http://localhost:3000/api/admin/orders/status",
    headers: {
      host: "localhost:3000",
      "x-forwarded-proto": "http",
      cookie: sessionCookie,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      orderId: createdOrder.res.payload.order.id,
      status: "Em preparo",
    }),
  });
  assert.equal(statusUpdate.res.statusCode, 200, "A atualizacao de status deve funcionar.");
  assert.equal(
    statusUpdate.res.payload?.order?.status,
    "Em preparo",
    "O pedido deve refletir o novo status no retorno."
  );

  const updatedOrderDetails = await runHandler(adminOrderActionHandler, {
    method: "GET",
    url: `http://localhost:3000/api/admin/orders/details?orderId=${createdOrder.res.payload.order.id}`,
    headers: {
      host: "localhost:3000",
      "x-forwarded-proto": "http",
      cookie: sessionCookie,
    },
  });
  assert.equal(
    updatedOrderDetails.res.payload?.order?.status,
    "Em preparo",
    "O detalhe deve mostrar o status atualizado."
  );
  assert.equal(
    updatedOrderDetails.res.payload?.order?.statusHistory?.[0]?.status,
    "Em preparo",
    "O historico deve registrar a ultima mudanca de status."
  );

  const dashboardRequest = await runHandler(adminDashboardHandler, {
    method: "GET",
    url: "http://localhost:3000/api/admin/dashboard",
    headers: {
      host: "localhost:3000",
      "x-forwarded-proto": "http",
      cookie: sessionCookie,
    },
  });
  assert.equal(dashboardRequest.res.statusCode, 200, "O dashboard legado deve continuar funcionando.");
  assert.equal(
    dashboardRequest.res.payload?.orders?.[0]?.status,
    "Em preparo",
    "O dashboard deve refletir o novo status do pedido."
  );

  await fs.rm(localDataDirectory, { recursive: true, force: true });
  console.log("ETAPA 2 validada com sucesso.");
};

run().catch(async (error) => {
  await fs.rm(localDataDirectory, { recursive: true, force: true });
  console.error(error);
  process.exitCode = 1;
});
