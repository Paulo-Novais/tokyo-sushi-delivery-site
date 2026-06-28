import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import middleware from "../middleware.js";

const require = createRequire(import.meta.url);
const adminAuth = require("../lib/admin-auth.cjs");
const customerAuth = require("../lib/customer-auth.cjs");
const { buildCustomerKey } = require("../lib/order-payload.cjs");
const createOrderHandler = require("../api/orders/create.js");
const adminApiHandler = require("../api/admin/[...action].js");
const adminAuthHandler = adminApiHandler;
const adminOrderActionHandler = adminApiHandler;
const customerActionHandler = require("../api/customer/[...action].js");
const customerAuthActionHandler = customerActionHandler;

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

const toCookieHeaders = (setCookieHeader) => {
  if (Array.isArray(setCookieHeader)) {
    return setCookieHeader;
  }

  return setCookieHeader ? [setCookieHeader] : [];
};

const mergeCookieHeader = (existingCookieHeader = "", setCookieHeader) => {
  const jar = new Map();

  String(existingCookieHeader || "")
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const separatorIndex = entry.indexOf("=");

      if (separatorIndex === -1) {
        return;
      }

      const cookieName = entry.slice(0, separatorIndex).trim();
      const cookieValue = entry.slice(separatorIndex + 1).trim();

      if (cookieName && cookieValue) {
        jar.set(cookieName, cookieValue);
      }
    });

  toCookieHeaders(setCookieHeader).forEach((cookieHeader) => {
    const firstPart = String(cookieHeader || "").split(";")[0];
    const separatorIndex = firstPart.indexOf("=");

    if (separatorIndex === -1) {
      return;
    }

    const cookieName = firstPart.slice(0, separatorIndex).trim();
    const cookieValue = firstPart.slice(separatorIndex + 1).trim();

    if (!cookieName) {
      return;
    }

    if (!cookieValue) {
      jar.delete(cookieName);
      return;
    }

    jar.set(cookieName, cookieValue);
  });

  return [...jar.entries()].map(([cookieName, cookieValue]) => `${cookieName}=${cookieValue}`).join("; ");
};

const extractCookieValue = (setCookieHeader, cookieName) => {
  const match = toCookieHeaders(setCookieHeader)
    .map((entry) => String(entry || "").split(";")[0])
    .find((entry) => entry.startsWith(`${cookieName}=`));

  if (!match) {
    return "";
  }

  return decodeURIComponent(match.slice(cookieName.length + 1));
};

const buildPublicJsonHeaders = ({
  origin = "http://localhost:3000",
  clientIp = "203.0.113.10",
  cookie = "",
  extraHeaders = {},
} = {}) => ({
  host: "localhost:3000",
  "x-forwarded-proto": "http",
  "x-forwarded-for": clientIp,
  origin,
  accept: "application/json",
  "content-type": "application/json; charset=utf-8",
  ...(cookie ? { cookie } : {}),
  ...extraHeaders,
});

const buildCustomerTrackingHeaders = ({
  customerKey,
  clientToken,
  cookie = "",
  clientIp = "203.0.113.60",
} = {}) => ({
  host: "localhost:3000",
  "x-forwarded-proto": "http",
  "x-forwarded-for": clientIp,
  accept: "application/json",
  ...(cookie ? { cookie } : {}),
  "x-tokyo-customer-key": customerKey,
  "x-tokyo-customer-client-token": clientToken,
});

const buildSampleOrderPayload = ({
  id,
  name,
  phone,
  email,
  productId,
  productName,
} = {}) => ({
  profile: {
    id,
    name,
    phone,
    email,
  },
  checkout: {
    paymentMethod: "pix",
    fulfillmentMode: "delivery",
    timingMode: "scheduled",
    scheduledDate: "2026-04-12",
    scheduledTime: "20:15",
    cashChangeRequired: "",
    cashAmountProvided: "",
    customerNotes: "Sem cebolinha.",
  },
  items: [
    {
      id: productId,
      name: productName,
      category: "Combinados",
      quantity: 1,
      price: 79.9,
    },
  ],
  addons: [
    {
      id: `addon-${productId}`,
      name: "Molho especial",
      quantity: 1,
      chargedQuantity: 1,
      freeUnits: 0,
      unitPrice: 3.5,
      totalPrice: 3.5,
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

const customerA = {
  id: "profile-cliente-stage3-a",
  name: "Cliente Acompanhamento",
  phone: "(11) 98888-1101",
  email: "cliente-a@teste.com",
};

const customerB = {
  id: "profile-cliente-stage3-b",
  name: "Cliente Vizinho",
  phone: "(11) 97777-2202",
  email: "cliente-b@teste.com",
};

const run = async () => {
  await fs.rm(localDataDirectory, { recursive: true, force: true });

  process.env.NODE_ENV = "development";
  process.env.ADMIN_LOGIN = "admin@tokyo.test";
  process.env.ADMIN_PASSWORD_HASH = adminAuth.createPasswordHash("senha-segura");
  process.env.ADMIN_DISPLAY_NAME = "Gestor Tokyo";
  process.env.ADMIN_SESSION_SECRET = "segredo-admin-super-forte";
  process.env.CUSTOMER_SESSION_SECRET = "segredo-customer-super-forte";
  process.env.ALLOWED_PUBLIC_ORIGINS =
    "https://tokyosushidelivery.com.br,http://localhost:3000,http://127.0.0.1:3000";
  process.env.ORDER_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.ORDER_RATE_LIMIT_MAX_REQUESTS = "10";
  process.env.ORDER_MAX_BODY_BYTES = "65536";
  process.env.CUSTOMER_AUTH_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.CUSTOMER_AUTH_START_MAX_REQUESTS = "10";
  process.env.CUSTOMER_AUTH_VERIFY_MAX_REQUESTS = "10";
  delete process.env.DATABASE_URL;
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_VERIFY_TEMPLATE_NAME;

  const customerKeyA = buildCustomerKey({
    phone: customerA.phone,
    email: customerA.email,
    profileId: customerA.id,
  });
  const customerKeyB = buildCustomerKey({
    phone: customerB.phone,
    email: customerB.email,
    profileId: customerB.id,
  });

  const createdOrderA = await runHandler(createOrderHandler, {
    method: "POST",
    url: "http://localhost:3000/api/orders/create",
    headers: buildPublicJsonHeaders({
      clientIp: "203.0.113.21",
      extraHeaders: {
        "x-tokyo-customer-client-token": "device-create-a",
        "x-tokyo-customer-key": customerKeyA,
      },
    }),
    body: JSON.stringify(
      buildSampleOrderPayload({
        ...customerA,
        productId: "carpaccio-salmao",
        productName: "Carpaccio de Salmao",
      })
    ),
  });
  assert.equal(createdOrderA.res.statusCode, 200, "O pedido do cliente A deve ser criado.");
  assert.ok(
    String(createdOrderA.res.headers["Set-Cookie"] || "").includes(customerAuth.CUSTOMER_SESSION_COOKIE_NAME),
    "A criacao do pedido deve devolver uma sessao publica do cliente separada do admin."
  );

  const createdOrderB = await runHandler(createOrderHandler, {
    method: "POST",
    url: "http://localhost:3000/api/orders/create",
    headers: buildPublicJsonHeaders({
      clientIp: "203.0.113.22",
      extraHeaders: {
        "x-tokyo-customer-client-token": "device-create-b",
        "x-tokyo-customer-key": customerKeyB,
      },
    }),
    body: JSON.stringify(
      buildSampleOrderPayload({
        ...customerB,
        productId: "ceviche-salmao",
        productName: "Ceviche Salmao",
      })
    ),
  });
  assert.equal(createdOrderB.res.statusCode, 200, "O pedido do cliente B deve ser criado.");

  const adminLogin = await runHandler(adminAuthHandler, {
    method: "POST",
    url: "http://localhost:3000/api/admin/login",
    headers: buildPublicJsonHeaders({
      clientIp: "203.0.113.40",
    }),
    body: JSON.stringify({
      identifier: "admin@tokyo.test",
      password: "senha-segura",
      next: "/admin/",
    }),
  });
  assert.equal(adminLogin.res.statusCode, 200, "O login admin deve funcionar antes das validacoes.");
  const adminSessionToken = extractCookieValue(
    adminLogin.res.headers["Set-Cookie"],
    adminAuth.ADMIN_SESSION_COOKIE_NAME
  );
  const adminSessionCookie = `${adminAuth.ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(
    adminSessionToken
  )}`;

  let customerACookies = "";
  const trackingClientTokenA = "device-track-a";
  const loginStartA = await runHandler(customerAuthActionHandler, {
    method: "POST",
    url: "http://localhost:3000/api/customer/auth/start",
    headers: buildPublicJsonHeaders({
      clientIp: "203.0.113.61",
      extraHeaders: {
        "x-tokyo-customer-client-token": trackingClientTokenA,
      },
    }),
    body: JSON.stringify({
      name: customerA.name,
      phone: customerA.phone,
    }),
  });
  assert.equal(loginStartA.res.statusCode, 200, "O login do cliente deve iniciar com sucesso.");
  assert.equal(
    loginStartA.res.payload?.deliveryMode,
    "device-preview",
    "No ambiente local, o login deve expor um codigo provisorio sem depender do WhatsApp real."
  );
  assert.match(
    String(loginStartA.res.payload?.previewCode || ""),
    /^\d{6}$/,
    "O codigo provisorio local deve ter 6 digitos."
  );
  customerACookies = mergeCookieHeader(customerACookies, loginStartA.res.headers["Set-Cookie"]);
  assert.ok(
    customerACookies.includes(`${customerAuth.CUSTOMER_LOGIN_CHALLENGE_COOKIE_NAME}=`),
    "O inicio do login deve guardar um desafio temporario separado da sessao final do cliente."
  );

  const loginVerifyA = await runHandler(customerAuthActionHandler, {
    method: "POST",
    url: "http://localhost:3000/api/customer/auth/verify",
    headers: buildPublicJsonHeaders({
      clientIp: "203.0.113.61",
      cookie: customerACookies,
      extraHeaders: {
        "x-tokyo-customer-client-token": trackingClientTokenA,
      },
    }),
    body: JSON.stringify({
      code: loginStartA.res.payload.previewCode,
    }),
  });
  assert.equal(loginVerifyA.res.statusCode, 200, "O codigo do cliente deve validar com sucesso.");
  customerACookies = mergeCookieHeader(customerACookies, loginVerifyA.res.headers["Set-Cookie"]);
  const customerSessionTokenA = extractCookieValue(
    loginVerifyA.res.headers["Set-Cookie"],
    customerAuth.CUSTOMER_SESSION_COOKIE_NAME
  );
  assert.ok(customerSessionTokenA, "A verificacao deve emitir a sessao final do cliente.");
  assert.equal(
    adminAuth.verifyAdminSessionToken(customerSessionTokenA),
    null,
    "A sessao do cliente nao pode ser reconhecida como sessao administrativa."
  );
  assert.equal(
    customerAuth.verifyCustomerSessionToken(adminSessionToken),
    null,
    "A sessao admin nao pode ser reconhecida como sessao do cliente."
  );
  assert.ok(
    !customerACookies.includes(`${customerAuth.CUSTOMER_LOGIN_CHALLENGE_COOKIE_NAME}=`),
    "O desafio temporario precisa ser limpo depois que o login do cliente conclui."
  );

  const activeOrderA = await runHandler(customerActionHandler, {
    method: "GET",
    url: "http://localhost:3000/api/customer/orders/active",
    headers: buildCustomerTrackingHeaders({
      customerKey: customerKeyA,
      clientToken: trackingClientTokenA,
      cookie: customerACookies,
      clientIp: "203.0.113.61",
    }),
  });
  assert.equal(activeOrderA.res.statusCode, 200, "A consulta do pedido ativo deve responder.");
  assert.equal(activeOrderA.res.payload?.authenticated, true, "O cliente autenticado deve ser reconhecido.");
  assert.equal(activeOrderA.res.payload?.hasActiveOrder, true, "O cliente autenticado deve ter pedido ativo.");
  assert.equal(
    activeOrderA.res.payload?.order?.publicId,
    createdOrderA.res.payload?.order?.publicId,
    "O cliente deve ver apenas o proprio pedido ativo."
  );
  assert.notEqual(
    activeOrderA.res.payload?.order?.publicId,
    createdOrderB.res.payload?.order?.publicId,
    "O pedido do outro cliente nao pode aparecer na area publica."
  );

  const forcedForeignQueryA = await runHandler(customerActionHandler, {
    method: "GET",
    url: `http://localhost:3000/api/customer/orders/active?orderId=${createdOrderB.res.payload?.order?.id}`,
    headers: buildCustomerTrackingHeaders({
      customerKey: customerKeyA,
      clientToken: trackingClientTokenA,
      cookie: customerACookies,
      clientIp: "203.0.113.61",
    }),
  });
  assert.equal(
    forcedForeignQueryA.res.payload?.order?.publicId,
    createdOrderA.res.payload?.order?.publicId,
    "Mesmo forçando um orderId na URL, a area publica deve continuar presa ao pedido do proprio cliente."
  );

  const wrongCustomerKeyAttempt = await runHandler(customerActionHandler, {
    method: "GET",
    url: "http://localhost:3000/api/customer/orders/active",
    headers: buildCustomerTrackingHeaders({
      customerKey: customerKeyB,
      clientToken: trackingClientTokenA,
      cookie: customerACookies,
      clientIp: "203.0.113.61",
    }),
  });
  assert.equal(
    wrongCustomerKeyAttempt.res.payload?.authenticated,
    false,
    "Trocar o customer key no cabecalho deve invalidar a sessao publica do cliente."
  );
  assert.equal(
    wrongCustomerKeyAttempt.res.payload?.order,
    null,
    "Nao deve haver nenhum pedido exposto quando a posse do pedido nao confere."
  );

  const wrongOriginLoginStart = await runHandler(customerAuthActionHandler, {
    method: "POST",
    url: "https://tokyosushidelivery.com.br/api/customer/auth/start",
    headers: buildPublicJsonHeaders({
      origin: "https://site-malicioso.example",
      clientIp: "203.0.113.91",
      extraHeaders: {
        "x-tokyo-customer-client-token": "device-malicious",
      },
    }),
    body: JSON.stringify({
      name: customerA.name,
      phone: customerA.phone,
    }),
  });
  assert.equal(
    wrongOriginLoginStart.res.statusCode,
    403,
    "A rota publica de login do cliente nao deve aceitar origens nao autorizadas."
  );

  const adminApiWithoutAdminCookie = middleware(
    new Request("http://localhost:3000/api/admin/orders/list", {
      headers: {
        cookie: customerACookies,
      },
    })
  );
  assert.equal(
    adminApiWithoutAdminCookie.status,
    401,
    "A sessao do cliente nao pode abrir as APIs administrativas."
  );

  const adminPageWithoutAdminCookie = middleware(
    new Request("http://localhost:3000/admin/", {
      headers: {
        cookie: customerACookies,
      },
    })
  );
  assert.equal(
    adminPageWithoutAdminCookie.status,
    307,
    "A sessao do cliente nao pode abrir o painel administrativo."
  );

  const statusUpdate = await runHandler(adminOrderActionHandler, {
    method: "POST",
    url: "http://localhost:3000/api/admin/orders/status",
    headers: buildPublicJsonHeaders({
      clientIp: "203.0.113.40",
      cookie: adminSessionCookie,
    }),
    body: JSON.stringify({
      orderId: createdOrderA.res.payload?.order?.id,
      status: "Em preparo",
      note: "Pedido entrou na cozinha.",
    }),
  });
  assert.equal(statusUpdate.res.statusCode, 200, "O gestor deve conseguir atualizar o status.");

  const syncedActiveOrderA = await runHandler(customerActionHandler, {
    method: "GET",
    url: "http://localhost:3000/api/customer/orders/active",
    headers: buildCustomerTrackingHeaders({
      customerKey: customerKeyA,
      clientToken: trackingClientTokenA,
      cookie: customerACookies,
      clientIp: "203.0.113.61",
    }),
  });
  assert.equal(
    syncedActiveOrderA.res.payload?.order?.status,
    "Em preparo",
    "A area publica deve refletir o status atualizado pelo gestor no backend."
  );
  assert.equal(
    syncedActiveOrderA.res.payload?.order?.statusHistory?.[0]?.status,
    "Em preparo",
    "O historico publico deve ser sincronizado com o mesmo registro que o admin alterou."
  );

  let customerBCookies = "";
  const trackingClientTokenB = "device-track-b";
  const loginStartB = await runHandler(customerAuthActionHandler, {
    method: "POST",
    url: "http://localhost:3000/api/customer/auth/start",
    headers: buildPublicJsonHeaders({
      clientIp: "203.0.113.62",
      extraHeaders: {
        "x-tokyo-customer-client-token": trackingClientTokenB,
      },
    }),
    body: JSON.stringify({
      name: customerB.name,
      phone: customerB.phone,
    }),
  });
  customerBCookies = mergeCookieHeader(customerBCookies, loginStartB.res.headers["Set-Cookie"]);
  const loginVerifyB = await runHandler(customerAuthActionHandler, {
    method: "POST",
    url: "http://localhost:3000/api/customer/auth/verify",
    headers: buildPublicJsonHeaders({
      clientIp: "203.0.113.62",
      cookie: customerBCookies,
      extraHeaders: {
        "x-tokyo-customer-client-token": trackingClientTokenB,
      },
    }),
    body: JSON.stringify({
      code: loginStartB.res.payload.previewCode,
    }),
  });
  customerBCookies = mergeCookieHeader(customerBCookies, loginVerifyB.res.headers["Set-Cookie"]);

  const activeOrderB = await runHandler(customerActionHandler, {
    method: "GET",
    url: "http://localhost:3000/api/customer/orders/active",
    headers: buildCustomerTrackingHeaders({
      customerKey: customerKeyB,
      clientToken: trackingClientTokenB,
      cookie: customerBCookies,
      clientIp: "203.0.113.62",
    }),
  });
  assert.equal(
    activeOrderB.res.payload?.order?.publicId,
    createdOrderB.res.payload?.order?.publicId,
    "O cliente B deve ver somente o proprio pedido."
  );
  assert.notEqual(
    activeOrderB.res.payload?.order?.publicId,
    createdOrderA.res.payload?.order?.publicId,
    "O cliente B nao pode enxergar o pedido do cliente A."
  );

  const logoutA = await runHandler(customerActionHandler, {
    method: "POST",
    url: "http://localhost:3000/api/customer/logout",
    headers: buildPublicJsonHeaders({
      clientIp: "203.0.113.61",
      cookie: customerACookies,
    }),
    body: JSON.stringify({}),
  });
  assert.equal(logoutA.res.statusCode, 200, "O logout publico do cliente deve responder.");
  customerACookies = mergeCookieHeader(customerACookies, logoutA.res.headers["Set-Cookie"]);

  const afterLogoutActiveOrderA = await runHandler(customerActionHandler, {
    method: "GET",
    url: "http://localhost:3000/api/customer/orders/active",
    headers: buildCustomerTrackingHeaders({
      customerKey: customerKeyA,
      clientToken: trackingClientTokenA,
      cookie: customerACookies,
      clientIp: "203.0.113.61",
    }),
  });
  assert.equal(
    afterLogoutActiveOrderA.res.payload?.authenticated,
    false,
    "Depois do logout, o backend nao deve mais reconhecer a sessao do cliente."
  );
  assert.equal(
    afterLogoutActiveOrderA.res.payload?.order,
    null,
    "Depois do logout, o acompanhamento publico deve ficar limpo."
  );

  await fs.rm(localDataDirectory, { recursive: true, force: true });
  console.log("ETAPA 3 validada com sucesso.");
};

run().catch(async (error) => {
  await fs.rm(localDataDirectory, { recursive: true, force: true });
  console.error(error);
  process.exitCode = 1;
});
