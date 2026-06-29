import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const realDataDirectory = path.join(workspaceRoot, ".data");

const getDirectoryFingerprint = async (directoryPath) => {
  const stats = await fs.stat(directoryPath).catch(() => null);

  if (!stats) {
    return { exists: false, entries: [] };
  }

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

const extractCookieHeader = (response) => {
  const setCookie = response.headers["Set-Cookie"] || response.headers["set-cookie"] || "";
  const cookie = Array.isArray(setCookie) ? setCookie[0] : String(setCookie || "");
  return cookie.split(";")[0];
};

const runJsonApi = async (
  handler,
  {
    method = "GET",
    url = "http://localhost:3000/api/admin/dashboard",
    host = "localhost:3000",
    body = null,
    cookie = "",
    ip = "127.0.0.1",
  } = {}
) => {
  const bodyText = body === null ? "" : JSON.stringify(body);
  const req = {
    method,
    url,
    headers: {
      host,
      "x-forwarded-host": host,
      "x-forwarded-for": ip,
      "x-forwarded-proto": "http",
      "user-agent": "V1ReleaseValidator/1.0",
      accept: "application/json",
      ...(body !== null
        ? {
            "content-type": "application/json",
            "content-length": String(Buffer.byteLength(bodyText, "utf8")),
            origin: `http://${host}`,
          }
        : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: bodyText,
    socket: {
      remoteAddress: ip,
    },
  };
  const res = buildMockResponse();

  await handler(req, res);
  return res;
};

const buildOrderPayload = () => ({
  profile: {
    id: "profile-v1-pilot",
    name: "Cliente V1 Piloto",
    phone: "(11) 96666-1111",
    email: "cliente-v1@tenant.test",
  },
  checkout: {
    paymentMethod: "pix",
    fulfillmentMode: "pickup",
    timingMode: "immediate",
    scheduledDate: "",
    scheduledTime: "",
    cashChangeRequired: "",
    cashAmountProvided: "",
    customerNotes: "pedido validacao v1",
  },
  items: [
    {
      id: "carpaccio-salmao",
      name: "Carpaccio de Salmao",
      category: "Carpaccio",
      quantity: 1,
      price: 58.5,
    },
  ],
  addons: [],
  deliveryQuote: null,
});

const runValidation = async () => {
  const originalCwd = process.cwd();
  const originalEnv = {
    ADMIN_LOGIN: process.env.ADMIN_LOGIN,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
    ADMIN_DISPLAY_NAME: process.env.ADMIN_DISPLAY_NAME,
    ADMIN_USERS: process.env.ADMIN_USERS,
    ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
    NODE_ENV: process.env.NODE_ENV,
    INOVAS_TENANT_MODE: process.env.INOVAS_TENANT_MODE,
  };
  const beforeFingerprint = await getDirectoryFingerprint(realDataDirectory);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tokyo-v1-release-"));

  try {
    await fs.mkdir(path.join(tempRoot, ".data"), { recursive: true });
    await fs.copyFile(path.join(workspaceRoot, "script.js"), path.join(tempRoot, "script.js"));
    process.chdir(tempRoot);
    process.env.NODE_ENV = "development";
    process.env.INOVAS_TENANT_MODE = "pilot";
    process.env.ADMIN_LOGIN = "master@v1.local";
    process.env.ADMIN_PASSWORD = "SenhaMasterV1";
    process.env.ADMIN_DISPLAY_NAME = "Master V1";
    process.env.ADMIN_SESSION_SECRET = "v1-release-local-secret";
    delete process.env.ADMIN_PASSWORD_HASH;
    delete process.env.ADMIN_USERS;
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;

    const adminApi = require(path.join(workspaceRoot, "lib/admin-api.cjs"));
    const orderCreateApi = require(path.join(workspaceRoot, "api/orders/create.js"));
    const { resolveRestaurantByHost } = require(path.join(workspaceRoot, "lib/master-platform-store.cjs"));

    const masterLogin = await runJsonApi(adminApi, {
      method: "POST",
      url: "http://localhost:3000/api/admin/login",
      host: "localhost:3000",
      body: {
        identifier: "master@v1.local",
        password: "SenhaMasterV1",
      },
    });
    assert.equal(masterLogin.statusCode, 200, "MASTER deve autenticar no default.");
    const masterCookie = extractCookieHeader(masterLogin);
    assert.ok(masterCookie, "login MASTER deve emitir cookie.");

    const onboarding = await runJsonApi(adminApi, {
      method: "POST",
      url: "http://localhost:3000/api/admin/master/onboard-restaurant",
      host: "localhost:3000",
      cookie: masterCookie,
      body: {
        restaurantName: "Pizzaria V1 Piloto",
        tradeName: "Pizzaria V1 Piloto",
        slug: "pizzaria-v1",
        domain: "pizzaria-v1.localhost",
        document: "12345678000190",
        ownerFullName: "Owner Pizzaria V1",
        city: "Sao Paulo",
        postalCode: "01000000",
        establishmentNumber: "100",
        email: "owner@pizzaria-v1.local",
        phone: "5511999911111",
        adhesionDate: "2026-06-28",
        whatsapp: "5511999911111",
        address: {
          street: "Rua V1",
          number: "100",
          neighborhood: "Centro",
          city: "Sao Paulo",
          state: "SP",
          postalCode: "01000000",
        },
        businessSchedule: {
          acceptOrdersOutsideHours: true,
        },
        delivery: {
          radiusKm: 6,
          fee: 9,
          minimumOrder: 35,
          deliveriesEnabled: true,
        },
        paymentMethods: ["pix", "card", "cash"],
        plan: "START",
        subscriptionStatus: "TRIAL",
        adminUser: {
          login: "owner@pizzaria-v1.local",
          email: "owner@pizzaria-v1.local",
          name: "Owner Pizzaria V1",
          password: "SenhaOwnerV1",
        },
      },
    });
    assert.equal(onboarding.statusCode, 200, "onboarding deve cadastrar restaurante piloto.");
    assert.equal(onboarding.payload?.restaurant?.restaurantKey, "pizzaria-v1");
    assert.equal(onboarding.payload?.restaurantAdmin?.restaurantKey, "pizzaria-v1");
    assert.equal(onboarding.payload?.subscription?.contractStatus, "TRIAL");

    const defaultOnlyMode = process.env.INOVAS_TENANT_MODE;
    process.env.INOVAS_TENANT_MODE = "default_only";
    const defaultOnlyResolution = await resolveRestaurantByHost("pizzaria-v1.localhost");
    assert.equal(defaultOnlyResolution.restaurantKey, "default", "default_only deve preservar Tokyo/default.");
    process.env.INOVAS_TENANT_MODE = defaultOnlyMode;

    const pilotResolution = await resolveRestaurantByHost("pizzaria-v1.localhost");
    assert.equal(pilotResolution.restaurantKey, "pizzaria-v1", "pilot deve resolver dominio real.");
    assert.equal(pilotResolution.multiRestaurantActive, true);

    const ownerLogin = await runJsonApi(adminApi, {
      method: "POST",
      url: "http://pizzaria-v1.localhost/api/admin/login",
      host: "pizzaria-v1.localhost",
      body: {
        identifier: "owner@pizzaria-v1.local",
        password: "SenhaOwnerV1",
      },
    });
    assert.equal(ownerLogin.statusCode, 200, "admin do restaurante deve autenticar no proprio dominio.");
    assert.equal(ownerLogin.payload?.admin?.restaurantKey, "pizzaria-v1");
    const ownerCookie = extractCookieHeader(ownerLogin);
    assert.ok(ownerCookie, "login OWNER do tenant deve emitir cookie.");

    const wrongTenantLogin = await runJsonApi(adminApi, {
      method: "POST",
      url: "http://localhost:3000/api/admin/login",
      host: "localhost:3000",
      body: {
        identifier: "owner@pizzaria-v1.local",
        password: "SenhaOwnerV1",
      },
    });
    assert.equal(wrongTenantLogin.statusCode, 403, "admin de restaurante nao deve logar no tenant default.");

    const createdOrder = await runJsonApi(orderCreateApi, {
      method: "POST",
      url: "http://pizzaria-v1.localhost/api/orders/create",
      host: "pizzaria-v1.localhost",
      body: buildOrderPayload(),
      ip: "127.0.0.2",
    });
    assert.equal(createdOrder.statusCode, 200, "pedido publico do tenant piloto deve ser criado.");
    assert.equal(createdOrder.payload?.tenantContext?.restaurantKey, "pizzaria-v1");

    const ownerOrders = await runJsonApi(adminApi, {
      url: "http://pizzaria-v1.localhost/api/admin/orders/list?limit=20",
      host: "pizzaria-v1.localhost",
      cookie: ownerCookie,
    });
    assert.equal(ownerOrders.statusCode, 200, "admin do tenant deve listar pedidos do proprio tenant.");
    assert.ok(
      ownerOrders.payload?.orders?.some((order) => order.publicId === createdOrder.payload.order.publicId),
      "pedido do tenant piloto deve aparecer para o proprio admin"
    );

    const defaultOrders = await runJsonApi(adminApi, {
      url: "http://localhost:3000/api/admin/orders/list?limit=50",
      host: "localhost:3000",
      cookie: masterCookie,
    });
    assert.equal(defaultOrders.statusCode, 200, "Tokyo/default deve continuar listando pedidos.");
    assert.equal(
      defaultOrders.payload?.orders?.some((order) => order.publicId === createdOrder.payload.order.publicId),
      false,
      "pedido do tenant piloto nao pode aparecer no default"
    );

    const financeBlocked = await runJsonApi(adminApi, {
      url: "http://pizzaria-v1.localhost/api/admin/finance",
      host: "pizzaria-v1.localhost",
      cookie: ownerCookie,
    });
    assert.equal(financeBlocked.statusCode, 403, "plano START deve bloquear financeiro.");
    assert.equal(financeBlocked.payload?.errorCode, "plan_feature_forbidden");

    const expiredSubscription = await runJsonApi(adminApi, {
      method: "POST",
      url: "http://localhost:3000/api/admin/master/subscription",
      host: "localhost:3000",
      cookie: masterCookie,
      body: {
        restaurantKey: "pizzaria-v1",
        status: "EXPIRED",
      },
    });
    assert.equal(expiredSubscription.statusCode, 200, "MASTER deve expirar assinatura.");
    assert.equal(expiredSubscription.payload?.subscription?.contractStatus, "EXPIRED");

    const expiredOrders = await runJsonApi(adminApi, {
      url: "http://pizzaria-v1.localhost/api/admin/orders/list?limit=20",
      host: "pizzaria-v1.localhost",
      cookie: ownerCookie,
    });
    assert.equal(expiredOrders.statusCode, 403, "assinatura vencida deve bloquear operacao admin.");
    assert.equal(expiredOrders.payload?.errorCode, "plan_feature_forbidden");
  } finally {
    process.chdir(originalCwd);

    Object.entries(originalEnv).forEach(([key, value]) => {
      if (typeof value === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });

    await fs.rm(tempRoot, { recursive: true, force: true });
  }

  const afterFingerprint = await getDirectoryFingerprint(realDataDirectory);
  assert.deepEqual(afterFingerprint, beforeFingerprint, "Validacao nao deve tocar .data real.");
};

runValidation()
  .then(() => {
    console.log("validate:v1-release-local OK");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
