import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const realDataDirectory = path.join(workspaceRoot, ".data");

const MASTER_LOGIN = "master@v1-final.local";
const MASTER_PASSWORD = "SenhaMasterV1Final";
const MASTER_HOST = "localhost:3000";

const touchedEnvKeys = [
  "ADMIN_LOGIN",
  "ADMIN_PASSWORD",
  "ADMIN_PASSWORD_HASH",
  "ADMIN_DISPLAY_NAME",
  "ADMIN_USERS",
  "ADMIN_SESSION_SECRET",
  "DATABASE_URL",
  "POSTGRES_URL",
  "NODE_ENV",
  "INOVAS_TENANT_MODE",
];

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

const resetWorkspaceModuleCache = () => {
  const prefix = `${workspaceRoot}${path.sep}`;

  Object.keys(require.cache).forEach((entry) => {
    if (entry.startsWith(prefix)) {
      delete require.cache[entry];
    }
  });
};

const restoreEnv = (snapshot) => {
  Object.entries(snapshot).forEach(([key, value]) => {
    if (typeof value === "undefined") {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });
};

const withV1Workspace = async (prefix, fn, { tenantMode = "pilot" } = {}) => {
  const originalCwd = process.cwd();
  const originalEnv = touchedEnvKeys.reduce((snapshot, key) => {
    snapshot[key] = process.env[key];
    return snapshot;
  }, {});
  const beforeFingerprint = await getDirectoryFingerprint(realDataDirectory);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), prefix));

  try {
    await fs.mkdir(path.join(tempRoot, ".data"), { recursive: true });
    await fs.copyFile(path.join(workspaceRoot, "script.js"), path.join(tempRoot, "script.js"));
    process.chdir(tempRoot);
    process.env.NODE_ENV = "development";
    process.env.INOVAS_TENANT_MODE = tenantMode;
    process.env.ADMIN_LOGIN = MASTER_LOGIN;
    process.env.ADMIN_PASSWORD = MASTER_PASSWORD;
    process.env.ADMIN_DISPLAY_NAME = "Master V1 Final";
    process.env.ADMIN_SESSION_SECRET = `${prefix}secret`;
    delete process.env.ADMIN_PASSWORD_HASH;
    delete process.env.ADMIN_USERS;
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    resetWorkspaceModuleCache();

    await fn({
      tempRoot,
      adminApi: require(path.join(workspaceRoot, "lib/admin-api.cjs")),
      orderCreateApi: require(path.join(workspaceRoot, "api/orders/create.js")),
      catalogApi: require(path.join(workspaceRoot, "api/catalog.js")),
      masterStore: require(path.join(workspaceRoot, "lib/master-platform-store.cjs")),
      securityGuardian: require(path.join(workspaceRoot, "lib/security-guardian.cjs")),
    });
  } finally {
    process.chdir(originalCwd);
    restoreEnv(originalEnv);
    resetWorkspaceModuleCache();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }

  const afterFingerprint = await getDirectoryFingerprint(realDataDirectory);
  assert.deepEqual(afterFingerprint, beforeFingerprint, "Validacao V1 nao deve tocar .data real.");
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

const runJsonApi = async (
  handler,
  {
    method = "GET",
    url = `http://${MASTER_HOST}/api/admin/dashboard`,
    host = MASTER_HOST,
    body = null,
    cookie = "",
    ip = "127.0.0.1",
    userAgent = "V1FinalValidator/1.0",
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
      "user-agent": userAgent,
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
    socket: { remoteAddress: ip },
  };
  const res = buildMockResponse();

  await handler(req, res);
  return res;
};

const extractCookieHeader = (response) => {
  const setCookie = response.headers["Set-Cookie"] || response.headers["set-cookie"] || "";
  const cookie = Array.isArray(setCookie) ? setCookie[0] : String(setCookie || "");
  return cookie.split(";")[0];
};

const assertStatus = (response, statusCode, message) => {
  assert.equal(response.statusCode, statusCode, `${message}: ${JSON.stringify(response.payload)}`);
};

const loginAdmin = async (adminApi, { identifier, password, ip = "127.0.1.1" }) => {
  const response = await runJsonApi(adminApi, {
    method: "POST",
    url: `http://${MASTER_HOST}/api/admin/login`,
    host: MASTER_HOST,
    ip,
    body: { identifier, password },
  });

  assertStatus(response, 200, `Login deveria funcionar para ${identifier}`);
  const cookie = extractCookieHeader(response);
  assert.ok(cookie, `Login deveria emitir cookie para ${identifier}`);
  return { response, cookie };
};

const loginMaster = (adminApi, ip = "127.0.1.1") =>
  loginAdmin(adminApi, {
    identifier: MASTER_LOGIN,
    password: MASTER_PASSWORD,
    ip,
  });

const buildDocumentForRestaurantKey = (key = "default") => {
  const hash = String(key || "default")
    .split("")
    .reduce((total, character) => (total * 31 + character.charCodeAt(0)) % 1000000000000, 0);

  return `12${String(hash).padStart(12, "0")}`.slice(0, 14);
};

const restaurantPayload = ({
  key,
  name,
  plan = "PRO",
  status = "TRIAL",
  whatsapp = "5511999999999",
  ownerLogin,
  ownerPassword = "SenhaOwnerV1",
} = {}) => ({
  restaurantName: name || `Restaurante ${key}`,
  tradeName: name || `Restaurante ${key}`,
  slug: key,
  restaurantKey: key,
  domain: `${key}.localhost`,
  document: buildDocumentForRestaurantKey(key),
  ownerFullName: `Owner ${name || key}`,
  city: "Sao Paulo",
  postalCode: "01000000",
  establishmentNumber: "100",
  email: ownerLogin || `owner@${key}.local`,
  phone: whatsapp,
  adhesionDate: "2026-06-28",
  whatsapp,
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
  plan,
  subscriptionStatus: status,
  adminUser: {
    login: ownerLogin || `owner@${key}.local`,
    email: ownerLogin || `owner@${key}.local`,
    name: `Owner ${name || key}`,
    password: ownerPassword,
  },
});

const onboardRestaurant = async (adminApi, masterCookie, options, ip = "127.0.2.1") => {
  const response = await runJsonApi(adminApi, {
    method: "POST",
    url: `http://${MASTER_HOST}/api/admin/master/onboard-restaurant`,
    host: MASTER_HOST,
    cookie: masterCookie,
    ip,
    body: restaurantPayload(options),
  });

  assertStatus(response, 200, `Onboarding deveria cadastrar ${options.key}`);
  return response.payload;
};

const updateSubscription = async (adminApi, masterCookie, body, ip = "127.0.3.1") => {
  const response = await runJsonApi(adminApi, {
    method: "POST",
    url: `http://${MASTER_HOST}/api/admin/master/subscription`,
    host: MASTER_HOST,
    cookie: masterCookie,
    ip,
    body,
  });

  assertStatus(response, 200, "MASTER deveria atualizar assinatura");
  return response.payload;
};

const createAdminUser = async (adminApi, sessionCookie, user, ip = "127.0.4.1") => {
  const host = user.restaurantKey ? `${user.restaurantKey}.localhost` : MASTER_HOST;
  const response = await runJsonApi(adminApi, {
    method: "POST",
    url: `http://${host}/api/admin/users/save`,
    host,
    cookie: sessionCookie,
    ip,
    body: { user },
  });

  assertStatus(response, 200, `Usuario ${user.login} deveria ser criado`);
  return response.payload.user;
};

const orderPayload = (label = "V1") => ({
  profile: {
    id: `profile-${label}`,
    name: `Cliente ${label}`,
    phone: "(11) 96666-1111",
    email: `cliente-${label}@tenant.test`,
  },
  checkout: {
    paymentMethod: "pix",
    fulfillmentMode: "pickup",
    timingMode: "immediate",
    scheduledDate: "",
    scheduledTime: "",
    cashChangeRequired: "",
    cashAmountProvided: "",
    customerNotes: `pedido validacao ${label}`,
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

const createPublicOrder = async (orderCreateApi, { key, label = key, ip = "127.0.5.1" }) => {
  const host = `${key}.localhost`;
  const response = await runJsonApi(orderCreateApi, {
    method: "POST",
    url: `http://${host}/api/orders/create`,
    host,
    ip,
    body: orderPayload(label),
  });

  assertStatus(response, 200, `Pedido publico deveria ser criado em ${key}`);
  assert.equal(response.payload?.tenantContext?.restaurantKey, key);
  return response.payload.order;
};

const buildPilotPair = async ({ adminApi, masterStore }, masterCookie) => {
  const tenantA = await onboardRestaurant(adminApi, masterCookie, {
    key: "piloto-a",
    name: "Piloto A",
    plan: "PRO",
    ownerLogin: "owner@piloto-a.local",
    ownerPassword: "SenhaOwnerA",
  });
  const tenantB = await onboardRestaurant(adminApi, masterCookie, {
    key: "piloto-b",
    name: "Piloto B",
    plan: "PRO",
    ownerLogin: "owner@piloto-b.local",
    ownerPassword: "SenhaOwnerB",
  });
  const ownerA = await loginAdmin(adminApi, {
    host: "piloto-a.localhost",
    identifier: "owner@piloto-a.local",
    password: "SenhaOwnerA",
    ip: "127.0.6.1",
  });
  const ownerB = await loginAdmin(adminApi, {
    host: "piloto-b.localhost",
    identifier: "owner@piloto-b.local",
    password: "SenhaOwnerB",
    ip: "127.0.6.2",
  });
  const resolutionA = await masterStore.resolveRestaurantByHost("piloto-a.localhost");
  const resolutionB = await masterStore.resolveRestaurantByHost("piloto-b.localhost");

  assert.equal(resolutionA.restaurantKey, "piloto-a");
  assert.equal(resolutionB.restaurantKey, "piloto-b");

  return { tenantA, tenantB, ownerA, ownerB };
};

const expectForbidden = (response, message) => {
  assert.ok([401, 403, 404, 429].includes(response.statusCode), `${message}: ${response.statusCode}`);
};

export const runSecurityHardening = async () =>
  withV1Workspace("tokyo-v1-security-", async (ctx) => {
    const { adminApi, orderCreateApi, securityGuardian } = ctx;
    const master = await loginMaster(adminApi);
    const { ownerA } = await buildPilotPair(ctx, master.cookie);
    const order = await createPublicOrder(orderCreateApi, { key: "piloto-a", label: "security" });

    const noSession = await runJsonApi(adminApi, {
      url: "http://piloto-a.localhost/api/admin/orders/list",
      host: "piloto-a.localhost",
      ip: "127.0.7.1",
    });
    assertStatus(noSession, 401, "Admin sem sessao deve ser bloqueado");

    process.env.INOVAS_TENANT_MODE = "strict";
    const invalidTenant = await runJsonApi(adminApi, {
      url: "http://tenant-inexistente.localhost/api/admin/orders/list",
      host: "tenant-inexistente.localhost",
      cookie: master.cookie,
      ip: "127.0.7.2",
    });
    expectForbidden(invalidTenant, "Tenant inexistente deve ser bloqueado");
    process.env.INOVAS_TENANT_MODE = "pilot";

    const crossTenant = await runJsonApi(adminApi, {
      url: "http://piloto-b.localhost/api/admin/orders/list",
      host: "piloto-b.localhost",
      cookie: ownerA.cookie,
      ip: "127.0.7.3",
    });
    assertStatus(crossTenant, 403, "Usuario do tenant A nao deve acessar tenant B");

    await createAdminUser(adminApi, ownerA.cookie, {
      login: "sempermissao@piloto-a.local",
      email: "sempermissao@piloto-a.local",
      name: "Sem Permissao",
      password: "SenhaCustomV1",
      userType: "CUSTOM",
      restaurantKey: "piloto-a",
      permissions: { orders_view: true },
    });
    const custom = await loginAdmin(adminApi, {
      host: "piloto-a.localhost",
      identifier: "sempermissao@piloto-a.local",
      password: "SenhaCustomV1",
      ip: "127.0.7.4",
    });

    const financeDenied = await runJsonApi(adminApi, {
      url: "http://piloto-a.localhost/api/admin/finance",
      host: "piloto-a.localhost",
      cookie: custom.cookie,
      ip: "127.0.7.5",
    });
    assertStatus(financeDenied, 403, "Financeiro sem permissao deve ser bloqueado");

    const exportDenied = await runJsonApi(adminApi, {
      url: "http://piloto-a.localhost/api/admin/exports?scope=orders",
      host: "piloto-a.localhost",
      cookie: custom.cookie,
      ip: "127.0.7.6",
    });
    assertStatus(exportDenied, 403, "Exportacao sem permissao deve ser bloqueada");

    const inventoryDenied = await runJsonApi(adminApi, {
      method: "POST",
      url: "http://piloto-a.localhost/api/admin/inventory/adjust-stock",
      host: "piloto-a.localhost",
      cookie: custom.cookie,
      ip: "127.0.7.7",
      body: { itemId: "inexistente", mode: "add", amount: 1 },
    });
    assertStatus(inventoryDenied, 403, "Alteracao de estoque sem permissao deve ser bloqueada");

    const priceDenied = await runJsonApi(adminApi, {
      method: "POST",
      url: "http://piloto-a.localhost/api/admin/catalog/update",
      host: "piloto-a.localhost",
      cookie: custom.cookie,
      ip: "127.0.7.8",
      body: { itemId: "carpaccio-salmao", price: 99 },
    });
    assertStatus(priceDenied, 403, "Alteracao de preco sem permissao deve ser bloqueada");

    const cancelDenied = await runJsonApi(adminApi, {
      method: "POST",
      url: "http://piloto-a.localhost/api/admin/orders/status",
      host: "piloto-a.localhost",
      cookie: custom.cookie,
      ip: "127.0.7.9",
      body: { orderId: order.publicId, status: "Cancelado", note: "sem permissao" },
    });
    assertStatus(cancelDenied, 403, "Cancelamento de pedido sem permissao deve ser bloqueado");

    await updateSubscription(adminApi, master.cookie, {
      restaurantKey: "piloto-a",
      status: "BLOCKED",
    });
    const blockedPublicOrder = await runJsonApi(orderCreateApi, {
      method: "POST",
      url: "http://piloto-a.localhost/api/orders/create",
      host: "piloto-a.localhost",
      ip: "127.0.7.10",
      body: orderPayload("blocked"),
    });
    assertStatus(blockedPublicOrder, 403, "Restaurante bloqueado nao deve criar pedido publico");

    securityGuardian.recordSecurityFailure(
      {
        headers: { host: "piloto-a.localhost", "user-agent": "V1SecretProbe" },
        socket: { remoteAddress: "127.0.7.11" },
      },
      {
        reason: "sanitize_probe",
        metadata: {
          password: "senha-nao-pode-vazar",
          token: "token-nao-pode-vazar",
          cookie: "cookie-nao-pode-vazar",
          authorization: "bearer segredo",
          safe: "valor-ok",
        },
      }
    );
    const events = JSON.stringify(securityGuardian.getSecurityEvents());
    assert.equal(events.includes("senha-nao-pode-vazar"), false);
    assert.equal(events.includes("token-nao-pode-vazar"), false);
    assert.equal(events.includes("cookie-nao-pode-vazar"), false);
    assert.equal(events.includes("bearer segredo"), false);
    assert.ok(events.includes("valor-ok"));
  });

export const runOnboarding = async () =>
  withV1Workspace("tokyo-v1-onboarding-", async ({ adminApi, masterStore }) => {
    const master = await loginMaster(adminApi);
    const tenantA = await onboardRestaurant(adminApi, master.cookie, {
      key: "onboard-a",
      name: "Onboard A",
      plan: "START",
      ownerLogin: "owner@onboard-a.local",
      ownerPassword: "SenhaOwnerA",
    });
    const tenantB = await onboardRestaurant(adminApi, master.cookie, {
      key: "onboard-b",
      name: "Onboard B",
      plan: "BUSINESS",
      ownerLogin: "owner@onboard-b.local",
      ownerPassword: "SenhaOwnerB",
    });

    assert.notEqual(tenantA.restaurant.tenantId, tenantB.restaurant.tenantId);
    assert.notEqual(tenantA.restaurant.restaurantKey, tenantB.restaurant.restaurantKey);
    assert.equal((await masterStore.resolveRestaurantByHost("onboard-a.localhost")).restaurantKey, "onboard-a");
    assert.equal((await masterStore.resolveRestaurantByHost("onboard-b.localhost")).restaurantKey, "onboard-b");

    const originalMode = process.env.INOVAS_TENANT_MODE;
    process.env.INOVAS_TENANT_MODE = "default_only";
    assert.equal((await masterStore.resolveRestaurantByHost("onboard-a.localhost")).restaurantKey, "default");
    process.env.INOVAS_TENANT_MODE = originalMode;

    const duplicateSlug = await runJsonApi(adminApi, {
      method: "POST",
      url: `http://${MASTER_HOST}/api/admin/master/onboard-restaurant`,
      host: MASTER_HOST,
      cookie: master.cookie,
      ip: "127.0.8.1",
      body: restaurantPayload({ key: "onboard-a", ownerLogin: "dup@onboard.local" }),
    });
    assert.notEqual(duplicateSlug.statusCode, 200, "Slug duplicado deve falhar");

    for (const [label, payload] of [
      ["whatsapp invalido", restaurantPayload({ key: "bad-whatsapp", whatsapp: "123", ownerLogin: "owner@bad-whatsapp.local" })],
      ["plano invalido", restaurantPayload({ key: "bad-plan", plan: "ENTERPRISE", ownerLogin: "owner@bad-plan.local" })],
      ["status invalido", restaurantPayload({ key: "bad-status", status: "OVERDUE", ownerLogin: "owner@bad-status.local" })],
      [
        "email invalido",
        {
          ...restaurantPayload({ key: "bad-email", ownerLogin: "owner-bad-email" }),
          adminUser: {
            login: "owner-bad-email",
            email: "owner-bad-email",
            name: "Owner Bad Email",
            password: "SenhaOwnerBad",
          },
        },
      ],
    ]) {
      const response = await runJsonApi(adminApi, {
        method: "POST",
        url: `http://${MASTER_HOST}/api/admin/master/onboard-restaurant`,
        host: MASTER_HOST,
        cookie: master.cookie,
        ip: `127.0.8.${Math.floor(Math.random() * 100) + 20}`,
        body: payload,
      });
      assert.notEqual(response.statusCode, 200, `${label} deve falhar seguro`);
    }

    const ownerA = await loginAdmin(adminApi, {
      host: "onboard-a.localhost",
      identifier: "owner@onboard-a.local",
      password: "SenhaOwnerA",
      ip: "127.0.8.2",
    });
    const crossTenant = await runJsonApi(adminApi, {
      url: "http://onboard-b.localhost/api/admin/dashboard",
      host: "onboard-b.localhost",
      cookie: ownerA.cookie,
      ip: "127.0.8.3",
    });
    assertStatus(crossTenant, 403, "Admin A nao deve acessar B");

    const defaultSession = await runJsonApi(adminApi, {
      url: `http://${MASTER_HOST}/api/admin/session`,
      host: MASTER_HOST,
      cookie: master.cookie,
      ip: "127.0.8.4",
    });
    assertStatus(defaultSession, 200, "Tokyo/default deve seguir intacto");
    assert.equal(defaultSession.payload?.admin?.restaurantKey, "");
    assert.equal(defaultSession.payload?.admin?.platformScope, true);
  });

export const runSubscription = async () =>
  withV1Workspace("tokyo-v1-subscription-", async ({ adminApi }) => {
    const master = await loginMaster(adminApi);
    await onboardRestaurant(adminApi, master.cookie, {
      key: "sub-start",
      plan: "START",
      ownerLogin: "owner@sub-start.local",
      ownerPassword: "SenhaStart",
    });
    await onboardRestaurant(adminApi, master.cookie, {
      key: "sub-business",
      plan: "BUSINESS",
      ownerLogin: "owner@sub-business.local",
      ownerPassword: "SenhaBusiness",
    });
    await onboardRestaurant(adminApi, master.cookie, {
      key: "sub-pro",
      plan: "PRO",
      ownerLogin: "owner@sub-pro.local",
      ownerPassword: "SenhaPro",
    });

    const start = await loginAdmin(adminApi, {
      host: "sub-start.localhost",
      identifier: "owner@sub-start.local",
      password: "SenhaStart",
      ip: "127.0.9.1",
    });
    const business = await loginAdmin(adminApi, {
      host: "sub-business.localhost",
      identifier: "owner@sub-business.local",
      password: "SenhaBusiness",
      ip: "127.0.9.2",
    });
    const pro = await loginAdmin(adminApi, {
      host: "sub-pro.localhost",
      identifier: "owner@sub-pro.local",
      password: "SenhaPro",
      ip: "127.0.9.3",
    });

    assertStatus(
      await runJsonApi(adminApi, {
        url: "http://sub-start.localhost/api/admin/orders/list",
        host: "sub-start.localhost",
        cookie: start.cookie,
        ip: "127.0.9.4",
      }),
      200,
      "START deve acessar pedidos"
    );
    assertStatus(
      await runJsonApi(adminApi, {
        url: "http://sub-start.localhost/api/admin/finance",
        host: "sub-start.localhost",
        cookie: start.cookie,
        ip: "127.0.9.5",
      }),
      403,
      "START nao deve acessar financeiro"
    );
    assertStatus(
      await runJsonApi(adminApi, {
        url: "http://sub-business.localhost/api/admin/dashboard?adminView=metrics",
        host: "sub-business.localhost",
        cookie: business.cookie,
        ip: "127.0.9.6",
      }),
      200,
      "BUSINESS deve acessar relatorios"
    );
    assertStatus(
      await runJsonApi(adminApi, {
        url: "http://sub-business.localhost/api/admin/inventory/list",
        host: "sub-business.localhost",
        cookie: business.cookie,
        ip: "127.0.9.7",
      }),
      403,
      "BUSINESS nao deve acessar estoque PRO"
    );
    assertStatus(
      await runJsonApi(adminApi, {
        url: "http://sub-pro.localhost/api/admin/finance",
        host: "sub-pro.localhost",
        cookie: pro.cookie,
        ip: "127.0.9.8",
      }),
      200,
      "PRO deve acessar financeiro"
    );

    for (const status of ["EXPIRED", "BLOCKED", "CANCELED"]) {
      await updateSubscription(adminApi, master.cookie, { restaurantKey: "sub-pro", status });
      const response = await runJsonApi(adminApi, {
        url: "http://sub-pro.localhost/api/admin/orders/list",
        host: "sub-pro.localhost",
        cookie: pro.cookie,
        ip: `127.0.9.${10 + status.length}`,
      });
      assertStatus(response, 403, `${status} deve bloquear operacao admin`);
    }

    await updateSubscription(adminApi, master.cookie, {
      restaurantKey: "sub-start",
      plan: "PRO",
      status: "ACTIVE",
    });
    assertStatus(
      await runJsonApi(adminApi, {
        url: "http://sub-start.localhost/api/admin/finance",
        host: "sub-start.localhost",
        cookie: start.cookie,
        ip: "127.0.9.30",
      }),
      200,
      "Troca para PRO deve liberar financeiro"
    );
  });

export const runRbac = async () =>
  withV1Workspace("tokyo-v1-rbac-", async (ctx) => {
    const { adminApi } = ctx;
    const master = await loginMaster(adminApi);
    await onboardRestaurant(adminApi, master.cookie, {
      key: "rbac-a",
      plan: "PRO",
      ownerLogin: "owner@rbac-a.local",
      ownerPassword: "SenhaOwnerRbacA",
    });
    await onboardRestaurant(adminApi, master.cookie, {
      key: "rbac-b",
      plan: "PRO",
      ownerLogin: "owner@rbac-b.local",
      ownerPassword: "SenhaOwnerRbacB",
    });
    const ownerA = await loginAdmin(adminApi, {
      host: "rbac-a.localhost",
      identifier: "owner@rbac-a.local",
      password: "SenhaOwnerRbacA",
      ip: "127.0.10.20",
    });

    const users = [
      ["gestor@rbac-a.local", { dashboard_view: true, orders_view: true, customers_view: true, reports_view: true }],
      ["caixa@rbac-a.local", { dashboard_view: true, orders_view: true, orders_edit: true }],
      ["cozinha@rbac-a.local", { dashboard_view: true, orders_view: true, orders_edit: true }],
      ["estoque@rbac-a.local", { dashboard_view: true, inventory_view: true, inventory_edit: true }],
      ["financeiro@rbac-a.local", { dashboard_view: true, financial_view: true, reports_view: true, exports_view: true }],
      ["entregador@rbac-a.local", { dashboard_view: true, delivery_view: true, orders_view: true }],
      ["atendente@rbac-a.local", { dashboard_view: true, orders_view: true, customers_view: true }],
      ["semperfil@rbac-a.local", {}],
    ];

    for (const [login, permissions] of users) {
      await createAdminUser(adminApi, ownerA.cookie, {
        login,
        email: login,
        name: login.split("@")[0],
        password: "SenhaPerfilV1",
        userType: "CUSTOM",
        restaurantKey: "rbac-a",
        permissions,
      });
    }

    const loginProfile = (login, ip) =>
      loginAdmin(adminApi, {
        host: "rbac-a.localhost",
        identifier: login,
        password: "SenhaPerfilV1",
        ip,
      });
    const gestor = await loginProfile("gestor@rbac-a.local", "127.0.10.1");
    const estoque = await loginProfile("estoque@rbac-a.local", "127.0.10.2");
    const financeiro = await loginProfile("financeiro@rbac-a.local", "127.0.10.3");
    const atendente = await loginProfile("atendente@rbac-a.local", "127.0.10.4");
    const semPerfil = await loginProfile("semperfil@rbac-a.local", "127.0.10.5");

    assertStatus(
      await runJsonApi(adminApi, {
        url: "http://rbac-a.localhost/api/admin/orders/list",
        host: "rbac-a.localhost",
        cookie: gestor.cookie,
        ip: "127.0.10.6",
      }),
      200,
      "Gestor deve acessar pedidos"
    );
    assertStatus(
      await runJsonApi(adminApi, {
        url: "http://rbac-a.localhost/api/admin/master/overview",
        host: "rbac-a.localhost",
        cookie: gestor.cookie,
        ip: "127.0.10.7",
      }),
      401,
      "Gestor nao deve acessar plataforma"
    );
    assertStatus(
      await runJsonApi(adminApi, {
        url: "http://rbac-b.localhost/api/admin/dashboard",
        host: "rbac-b.localhost",
        cookie: gestor.cookie,
        ip: "127.0.10.8",
      }),
      403,
      "Tenant errado deve ser negado"
    );
    assertStatus(
      await runJsonApi(adminApi, {
        url: "http://rbac-a.localhost/api/admin/inventory/list",
        host: "rbac-a.localhost",
        cookie: estoque.cookie,
        ip: "127.0.10.9",
      }),
      200,
      "Estoque deve acessar estoque"
    );
    assertStatus(
      await runJsonApi(adminApi, {
        url: "http://rbac-a.localhost/api/admin/finance",
        host: "rbac-a.localhost",
        cookie: estoque.cookie,
        ip: "127.0.10.10",
      }),
      403,
      "Estoque nao deve acessar financeiro completo"
    );
    assertStatus(
      await runJsonApi(adminApi, {
        url: "http://rbac-a.localhost/api/admin/finance",
        host: "rbac-a.localhost",
        cookie: financeiro.cookie,
        ip: "127.0.10.11",
      }),
      200,
      "Financeiro deve acessar financeiro"
    );
    assertStatus(
      await runJsonApi(adminApi, {
        url: "http://rbac-a.localhost/api/admin/settings/list",
        host: "rbac-a.localhost",
        cookie: atendente.cookie,
        ip: "127.0.10.12",
      }),
      403,
      "Atendente nao deve acessar configuracoes criticas"
    );
    assertStatus(
      await runJsonApi(adminApi, {
        url: "http://rbac-a.localhost/api/admin/dashboard",
        host: "rbac-a.localhost",
        cookie: semPerfil.cookie,
        ip: "127.0.10.13",
      }),
      403,
      "Usuario sem perfil/permissao nao deve acessar admin"
    );

    assertStatus(
      await runJsonApi(adminApi, {
        url: "http://rbac-a.localhost/api/admin/master/overview",
        host: "rbac-a.localhost",
        cookie: ownerA.cookie,
        ip: "127.0.10.15",
      }),
      401,
      "Admin Restaurante nao deve virar Admin Geral"
    );
  });

export const runAudit = async () =>
  withV1Workspace("tokyo-v1-audit-", async ({ adminApi, securityGuardian, tempRoot }) => {
    const failedLogin = await runJsonApi(adminApi, {
      method: "POST",
      url: `http://${MASTER_HOST}/api/admin/login`,
      host: MASTER_HOST,
      ip: "127.0.11.1",
      body: { identifier: MASTER_LOGIN, password: "senha-errada" },
    });
    assertStatus(failedLogin, 401, "Falha de login deve ser negada");

    const master = await loginMaster(adminApi, "127.0.11.2");
    await onboardRestaurant(adminApi, master.cookie, {
      key: "audit-a",
      plan: "PRO",
      ownerLogin: "owner@audit-a.local",
      ownerPassword: "SenhaAuditA",
    });
    await updateSubscription(adminApi, master.cookie, {
      restaurantKey: "audit-a",
      plan: "BUSINESS",
      status: "ACTIVE",
    });

    const owner = await loginAdmin(adminApi, {
      host: "audit-a.localhost",
      identifier: "owner@audit-a.local",
      password: "SenhaAuditA",
      ip: "127.0.11.3",
    });
    const exportResponse = await runJsonApi(adminApi, {
      url: "http://audit-a.localhost/api/admin/exports?scope=orders",
      host: "audit-a.localhost",
      cookie: owner.cookie,
      ip: "127.0.11.4",
    });
    assertStatus(exportResponse, 200, "Exportacao deve registrar auditoria");

    const events = JSON.stringify(securityGuardian.getSecurityAuditTrail());
    assert.ok(events.includes("export_created"), "Auditoria deve registrar exportacao");
    assert.equal(events.includes(MASTER_PASSWORD), false, "Auditoria nao deve vazar senha");

    const masterStore = JSON.parse(await fs.readFile(path.join(tempRoot, ".data", "master-platform.json"), "utf8"));
    const auditActions = JSON.stringify(masterStore.audit || []);
    assert.ok(auditActions.includes("restaurant_onboarded"));
    assert.ok(auditActions.includes("subscription_updated"));
  });

export const runExport = async () =>
  withV1Workspace("tokyo-v1-export-", async ({ adminApi, orderCreateApi }) => {
    const master = await loginMaster(adminApi);
    await onboardRestaurant(adminApi, master.cookie, {
      key: "export-a",
      plan: "PRO",
      ownerLogin: "owner@export-a.local",
      ownerPassword: "SenhaExportA",
    });
    await onboardRestaurant(adminApi, master.cookie, {
      key: "export-b",
      plan: "PRO",
      ownerLogin: "owner@export-b.local",
      ownerPassword: "SenhaExportB",
    });
    const ownerA = await loginAdmin(adminApi, {
      host: "export-a.localhost",
      identifier: "owner@export-a.local",
      password: "SenhaExportA",
      ip: "127.0.12.1",
    });
    const ownerB = await loginAdmin(adminApi, {
      host: "export-b.localhost",
      identifier: "owner@export-b.local",
      password: "SenhaExportB",
      ip: "127.0.12.2",
    });
    const orderA = await createPublicOrder(orderCreateApi, { key: "export-a", label: "export-a", ip: "127.0.12.3" });
    const orderB = await createPublicOrder(orderCreateApi, { key: "export-b", label: "export-b", ip: "127.0.12.4" });

    await runJsonApi(adminApi, {
      method: "POST",
      url: "http://export-a.localhost/api/admin/inventory/save-item",
      host: "export-a.localhost",
      cookie: ownerA.cookie,
      ip: "127.0.12.5",
      body: { name: "Shoyu Export A", category: "Molhos", quantity: 10, unit: "un", minimumQuantity: 2 },
    });

    const exportA = await runJsonApi(adminApi, {
      url: "http://export-a.localhost/api/admin/exports?scope=all",
      host: "export-a.localhost",
      cookie: ownerA.cookie,
      ip: "127.0.12.6",
    });
    assertStatus(exportA, 200, "Exportacao A deve funcionar");
    const serializedA = JSON.stringify(exportA.payload.data);
    assert.ok(serializedA.includes(orderA.publicId));
    assert.equal(serializedA.includes(orderB.publicId), false, "Exportacao A nao deve conter dados B");
    assert.ok(serializedA.includes("Shoyu Export A"));

    const exportB = await runJsonApi(adminApi, {
      url: "http://export-b.localhost/api/admin/exports?scope=orders",
      host: "export-b.localhost",
      cookie: ownerB.cookie,
      ip: "127.0.12.7",
    });
    assertStatus(exportB, 200, "Exportacao B deve funcionar");
    const serializedB = JSON.stringify(exportB.payload.data);
    assert.ok(serializedB.includes(orderB.publicId));
    assert.equal(serializedB.includes(orderA.publicId), false, "Exportacao B nao deve conter dados A");

    await createAdminUser(adminApi, ownerA.cookie, {
      login: "sem-export@export-a.local",
      email: "sem-export@export-a.local",
      name: "Sem Export",
      password: "SenhaSemExport",
      userType: "CUSTOM",
      restaurantKey: "export-a",
      permissions: { orders_view: true },
    });
    const custom = await loginAdmin(adminApi, {
      host: "export-a.localhost",
      identifier: "sem-export@export-a.local",
      password: "SenhaSemExport",
      ip: "127.0.12.8",
    });
    assertStatus(
      await runJsonApi(adminApi, {
        url: "http://export-a.localhost/api/admin/exports?scope=orders",
        host: "export-a.localhost",
        cookie: custom.cookie,
        ip: "127.0.12.9",
      }),
      403,
      "Exportacao deve exigir permissao"
    );
  });

export const runPilotJourney = async () =>
  withV1Workspace("tokyo-v1-journey-", async ({ adminApi, orderCreateApi, masterStore }) => {
    const master = await loginMaster(adminApi);
    await onboardRestaurant(adminApi, master.cookie, {
      key: "journey-a",
      name: "Jornada Piloto A",
      plan: "PRO",
      ownerLogin: "owner@journey-a.local",
      ownerPassword: "SenhaJourneyA",
    });
    assert.equal((await masterStore.resolveRestaurantByHost("journey-a.localhost")).restaurantKey, "journey-a");
    const owner = await loginAdmin(adminApi, {
      host: "journey-a.localhost",
      identifier: "owner@journey-a.local",
      password: "SenhaJourneyA",
      ip: "127.0.13.1",
    });

    assertStatus(
      await runJsonApi(adminApi, {
        url: "http://journey-a.localhost/api/admin/settings/list",
        host: "journey-a.localhost",
        cookie: owner.cookie,
        ip: "127.0.13.2",
      }),
      200,
      "Configuracoes iniciais devem existir"
    );

    const catalog = await runJsonApi(adminApi, {
      url: "http://journey-a.localhost/api/admin/catalog/list",
      host: "journey-a.localhost",
      cookie: owner.cookie,
      ip: "127.0.13.3",
    });
    assertStatus(catalog, 200, "Catalogo deve listar");
    const sectionId = catalog.payload.sections?.[0]?.id;
    assert.ok(sectionId, "Catalogo deve ter categoria base");
    assertStatus(
      await runJsonApi(adminApi, {
        method: "POST",
        url: "http://journey-a.localhost/api/admin/catalog/save-item",
        host: "journey-a.localhost",
        cookie: owner.cookie,
        ip: "127.0.13.4",
        body: { sectionId, name: "Produto Jornada", price: 42, category: "Jornada" },
      }),
      200,
      "Produto deve ser criado"
    );

    const order = await createPublicOrder(orderCreateApi, { key: "journey-a", label: "journey", ip: "127.0.13.5" });
    const orders = await runJsonApi(adminApi, {
      url: "http://journey-a.localhost/api/admin/orders/list",
      host: "journey-a.localhost",
      cookie: owner.cookie,
      ip: "127.0.13.6",
    });
    assertStatus(orders, 200, "Pedido deve aparecer no admin");
    assert.ok(orders.payload.orders.some((entry) => entry.publicId === order.publicId));
    assertStatus(
      await runJsonApi(adminApi, {
        method: "POST",
        url: "http://journey-a.localhost/api/admin/orders/status",
        host: "journey-a.localhost",
        cookie: owner.cookie,
        ip: "127.0.13.7",
        body: { orderId: order.publicId, status: "Em preparo", note: "jornada" },
      }),
      200,
      "Status do pedido deve mudar"
    );

    const customers = await runJsonApi(adminApi, {
      url: "http://journey-a.localhost/api/admin/customers/list",
      host: "journey-a.localhost",
      cookie: owner.cookie,
      ip: "127.0.13.8",
    });
    assertStatus(customers, 200, "Clientes devem listar");
    const customerKey = customers.payload.customers?.[0]?.customerKey;
    assert.ok(customerKey, "Pedido deve gerar cliente");
    assertStatus(
      await runJsonApi(adminApi, {
        method: "POST",
        url: "http://journey-a.localhost/api/admin/customers/save",
        host: "journey-a.localhost",
        cookie: owner.cookie,
        ip: "127.0.13.9",
        body: { customerKey, notes: "Cliente da jornada", tags: ["piloto"] },
      }),
      200,
      "Perfil de cliente deve salvar"
    );

    assertStatus(
      await runJsonApi(adminApi, {
        url: "http://journey-a.localhost/api/admin/dashboard?adminView=metrics",
        host: "journey-a.localhost",
        cookie: owner.cookie,
        ip: "127.0.13.10",
      }),
      200,
      "Dashboard/metricas deve respeitar tenant"
    );
    assertStatus(
      await runJsonApi(adminApi, {
        method: "POST",
        url: "http://journey-a.localhost/api/admin/inventory/save-item",
        host: "journey-a.localhost",
        cookie: owner.cookie,
        ip: "127.0.13.11",
        body: { name: "Insumo Jornada", category: "Base", quantity: 5, unit: "un", minimumQuantity: 1 },
      }),
      200,
      "Estoque deve salvar"
    );
    assertStatus(
      await runJsonApi(adminApi, {
        url: "http://journey-a.localhost/api/admin/exports?scope=all",
        host: "journey-a.localhost",
        cookie: owner.cookie,
        ip: "127.0.13.12",
      }),
      200,
      "Exportacao completa deve funcionar"
    );

    await updateSubscription(adminApi, master.cookie, { restaurantKey: "journey-a", plan: "BUSINESS", status: "ACTIVE" });
    assertStatus(
      await runJsonApi(adminApi, {
        url: "http://journey-a.localhost/api/admin/finance",
        host: "journey-a.localhost",
        cookie: owner.cookie,
        ip: "127.0.13.13",
      }),
      403,
      "Plano BUSINESS deve bloquear financeiro PRO"
    );
    await updateSubscription(adminApi, master.cookie, { restaurantKey: "journey-a", plan: "PRO", status: "EXPIRED" });
    assertStatus(
      await runJsonApi(adminApi, {
        url: "http://journey-a.localhost/api/admin/orders/list",
        host: "journey-a.localhost",
        cookie: owner.cookie,
        ip: "127.0.13.14",
      }),
      403,
      "Assinatura expirada deve bloquear operacao"
    );
  });

const scenarioMap = {
  "security-hardening": runSecurityHardening,
  onboarding: runOnboarding,
  subscription: runSubscription,
  rbac: runRbac,
  audit: runAudit,
  export: runExport,
  "pilot-journey": runPilotJourney,
};

export const runV1Scenario = async (name) => {
  const runner = scenarioMap[name];

  if (!runner) {
    throw new Error(`Cenario V1 desconhecido: ${name}`);
  }

  await runner();
};

export const runV1Final = async () => {
  for (const name of Object.keys(scenarioMap)) {
    await runV1Scenario(name);
  }
};
