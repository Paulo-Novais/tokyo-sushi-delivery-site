import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const realDataDirectory = path.join(workspaceRoot, ".data");

const REQUIRED_FEATURES = [
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
  "whatsappAI",
];

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webp", "image/webp"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
]);

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

const runAdminApi = async (handler, { method = "GET", url, body = null, cookie = "" }) => {
  const req = {
    method,
    url,
    headers: {
      host: "localhost:3000",
      "x-forwarded-proto": "http",
      accept: "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: body === null ? "" : JSON.stringify(body),
  };
  const res = buildMockResponse();

  await handler(req, res);
  return res;
};

const extractCookieHeader = (response) => {
  const setCookie = String(response.headers["Set-Cookie"] || response.headers["set-cookie"] || "");
  return setCookie.split(";")[0];
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

const readRequestBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => chunks.push(chunk));
    req.on("error", reject);
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });

const handleAdminApiRequest = async (adminApi, req, res) => {
  req.body = await readRequestBody(req);
  const apiResponse = {
    setHeader(name, value) {
      res.setHeader(name, value);
    },
    status(code) {
      res.statusCode = code;
      return this;
    },
    json(payload) {
      if (!res.hasHeader("Content-Type")) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      }

      res.end(JSON.stringify(payload));
      return payload;
    },
  };

  await adminApi(req, apiResponse);
};

const createStaticServer = (rootDirectory, adminApi) =>
  http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || "/", "http://127.0.0.1");

      if (requestUrl.pathname.startsWith("/api/admin")) {
        await handleAdminApiRequest(adminApi, req, res);
        return;
      }

      if (requestUrl.pathname === "/api/catalog") {
        res.writeHead(200, {
          "Cache-Control": "no-store",
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(JSON.stringify({ ok: true, sections: [], items: [] }));
        return;
      }

      let pathname = decodeURIComponent(requestUrl.pathname);

      if (pathname === "/") {
        pathname = "/index.html";
      }

      if (pathname === "/admin/" || pathname === "/admin") {
        pathname = "/admin/index.html";
      }

      if (pathname === "/admin/master") {
        pathname = "/admin/master.html";
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
      res.end(String(error?.message || "Internal server error"));
    }
  });

const listen = (server) =>
  new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ host: "127.0.0.1", port: Number(address.port) });
    });
  });

const closeServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
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

const login = async (adminApi, identifier, password, next = "/admin/") => {
  const response = await runAdminApi(adminApi, {
    method: "POST",
    url: "http://localhost:3000/api/admin/login",
    body: { identifier, password, next },
  });

  assert.equal(response.statusCode, 200, `Login deveria funcionar para ${identifier}.`);
  const cookie = extractCookieHeader(response);

  assert.ok(cookie, `Login deveria emitir cookie para ${identifier}.`);

  return { response, cookie };
};

const createUser = async (adminApi, masterCookie, user) => {
  const response = await runAdminApi(adminApi, {
    method: "POST",
    url: "http://localhost:3000/api/admin/users/save",
    cookie: masterCookie,
    body: { user },
  });

  assert.equal(response.statusCode, 200, `Usuario ${user.login} deveria ser criado.`);
  return response.payload.user;
};

const readMasterStore = async (tempRoot) =>
  JSON.parse(await fs.readFile(path.join(tempRoot, ".data", "master-platform.json"), "utf8"));

const writeMasterStore = async (tempRoot, store) => {
  await fs.writeFile(
    path.join(tempRoot, ".data", "master-platform.json"),
    JSON.stringify(store, null, 2)
  );
};

const setContractPlan = async (tempRoot, planKey) => {
  const store = await readMasterStore(tempRoot);
  const plan = store.plans.find((entry) => entry.key === planKey);

  assert.ok(plan, `Plano ${planKey} deveria existir no store temporario.`);
  const features = plan.recursos_inclusos || plan.includedFeatures || plan.features || [];
  const contract = {
    ...(store.contracts?.[0] || store.subscriptions?.[0] || {}),
    key: "default",
    restaurantKey: "default",
    restaurantName: "Tokyo Sushi Delivery",
    restaurant: "Tokyo Sushi Delivery",
    plan: plan.key,
    planName: plan.name,
    monthlyValue: plan.monthlyValue,
    valor_mensal: plan.valor_mensal,
    status: "ACTIVE",
    contractStatus: "ACTIVE",
    status_contrato: "ATIVO",
    releasedFeatures: features,
    recursos_liberados: features,
    blockedModules: [],
    modulos_bloqueados: [],
  };

  store.subscriptions = [contract];
  store.contracts = [contract];
  store.restaurants = (store.restaurants || []).map((restaurant) => ({
    ...restaurant,
    plan: plan.key,
  }));
  store.restaurantFeatureFlags = {
    default: REQUIRED_FEATURES.reduce((flags, feature) => {
      flags[feature] = feature !== "whatsappAI";
      return flags;
    }, {}),
  };

  await writeMasterStore(tempRoot, store);
};

const validateStaticContracts = async () => {
  const masterStoreSource = await fs.readFile(path.join(workspaceRoot, "lib", "master-platform-store.cjs"), "utf8");

  ["TRIAL", "ACTIVE", "EXPIRED", "BLOCKED", "CANCELED"].forEach((status) => {
    assert.ok(
      masterStoreSource.includes(status),
      `Store comercial deve reconhecer status de assinatura ${status}.`
    );
  });
};

const validatePlanModel = async (masterStore) => {
  const snapshot = await masterStore.getMasterPlatformSnapshot();
  const planKeys = new Set((snapshot.plans || []).map((plan) => plan.key));
  const resourceKeys = new Set((snapshot.resources || []).map((resource) => resource.key));
  const premium = snapshot.plans.find((plan) => plan.key === "PREMIUM");
  const contract = (snapshot.contracts || snapshot.subscriptions || [])[0];

  ["START", "PRO", "PREMIUM"].forEach((planKey) => {
    assert.ok(planKeys.has(planKey), `Plano ${planKey} deveria existir.`);
  });

  REQUIRED_FEATURES.forEach((feature) => {
    assert.ok(resourceKeys.has(feature), `Recurso ${feature} deveria existir.`);
  });

  assert.equal(snapshot.restaurantKey, "default");
  assert.equal(contract.restaurantKey, "default");
  assert.equal(contract.plan, "PREMIUM", "Tokyo Sushi deve iniciar como PREMIUM.");
  assert.equal(contract.status, "ACTIVE", "Contrato do Tokyo Sushi deve iniciar ativo.");
  assert.equal(snapshot.commercialAccess.planKey, "PREMIUM");
  assert.ok(premium.recursos_inclusos.includes("finance"), "PREMIUM deve liberar financeiro.");
  assert.ok(premium.recursos_inclusos.includes("inventory"), "PREMIUM deve liberar estoque.");
  assert.ok(premium.recursos_inclusos.includes("customDomain"), "PREMIUM deve preparar dominio proprio.");
  assert.ok(snapshot.commercialAccess.releasedFeatures.includes("finance"));
  assert.ok(snapshot.commercialAccess.releasedFeatures.includes("inventory"));
  assert.equal(snapshot.commercialAccess.features.whatsappAI.future, true);
  assert.equal(snapshot.commercialAccess.features.whatsappAI.enabled, false);
  assert.equal(snapshot.restaurantFeatureFlags.default.whatsappAI, false);

  const premiumFinance = await masterStore.getPlanAccessForAdminModule({ group: "finance" });
  assert.equal(premiumFinance.allowed, true, "PREMIUM deve permitir modulo financeiro.");
};

const validateApiAccess = async (adminApi, tempRoot) => {
  const masterLogin = await login(adminApi, "usermaster@inovas.com", "novais753951", "/admin/master.html");
  const masterCookie = masterLogin.cookie;

  await createUser(adminApi, masterCookie, {
    name: "Owner Planos",
    login: "owner.planos",
    email: "owner.planos@teste.local",
    password: "senha-owner",
    status: "ACTIVE",
    userType: "OWNER",
  });
  await createUser(adminApi, masterCookie, {
    name: "Custom Sem Financeiro",
    login: "custom.sem.financeiro",
    email: "custom.sem.financeiro@teste.local",
    password: "senha-custom",
    status: "ACTIVE",
    userType: "CUSTOM",
    permissions: {
      orders_view: true,
    },
  });

  const ownerLogin = await login(adminApi, "owner.planos", "senha-owner");
  const customLogin = await login(adminApi, "custom.sem.financeiro", "senha-custom");

  const premiumFinance = await runAdminApi(adminApi, {
    url: "http://localhost:3000/api/admin/finance",
    cookie: ownerLogin.cookie,
  });
  assert.equal(premiumFinance.statusCode, 200, "Plano PREMIUM + permissao deve liberar financeiro.");

  const customFinance = await runAdminApi(adminApi, {
    url: "http://localhost:3000/api/admin/finance",
    cookie: customLogin.cookie,
  });
  assert.equal(customFinance.statusCode, 403, "Usuario sem permissao continua bloqueado.");
  assert.equal(customFinance.payload?.errorCode, "admin_permission_denied");

  await setContractPlan(tempRoot, "START");

  const startFinance = await runAdminApi(adminApi, {
    url: "http://localhost:3000/api/admin/finance",
    cookie: ownerLogin.cookie,
  });
  assert.equal(startFinance.statusCode, 403, "Plano sem financeiro deve bloquear API financeira.");
  assert.equal(startFinance.payload?.errorCode, "plan_feature_forbidden");
  assert.equal(startFinance.payload?.featureKey, "finance");

  const startInventory = await runAdminApi(adminApi, {
    url: "http://localhost:3000/api/admin/inventory/list",
    cookie: ownerLogin.cookie,
  });
  assert.equal(startInventory.statusCode, 403, "Plano sem estoque deve bloquear API de estoque.");
  assert.equal(startInventory.payload?.errorCode, "plan_feature_forbidden");

  const startOrders = await runAdminApi(adminApi, {
    url: "http://localhost:3000/api/admin/orders/list?limit=1",
    cookie: ownerLogin.cookie,
  });
  assert.equal(startOrders.statusCode, 200, "Plano START + permissao deve liberar pedidos.");

  await setContractPlan(tempRoot, "PREMIUM");

  const restoredFinance = await runAdminApi(adminApi, {
    url: "http://localhost:3000/api/admin/finance",
    cookie: ownerLogin.cookie,
  });
  assert.equal(restoredFinance.statusCode, 200, "Retorno para PREMIUM deve liberar financeiro.");

  return { ownerCookie: ownerLogin.cookie, customCookie: customLogin.cookie };
};

const loginBrowser = async (page, baseURL, identifier, password) => {
  await page.goto(`${baseURL}/admin/login.html?next=%2Fadmin%2F`, { waitUntil: "domcontentloaded" });
  await waitForCondition(
    async () => (await page.locator("[data-admin-login-form]").count()) === 1,
    `Login deveria carregar para ${identifier}.`
  );
  await page.locator('input[name="identifier"]').fill(identifier);
  await page.locator('input[name="password"]').fill(password);
  await page.locator("[data-admin-login-submit]").click();
  await waitForCondition(
    async () => (await page.evaluate(() => document.body.dataset.adminPage).catch(() => "")) === "dashboard",
    `Gestor deveria abrir para ${identifier}.`
  );
};

const getNavText = (page) => page.locator("[data-admin-nav]").textContent().then((text) => text || "");

const validateBrowserMenus = async (adminApi, tempRoot) => {
  const server = createStaticServer(workspaceRoot, adminApi);
  const { port } = await listen(server);
  const baseURL = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];
  const pageErrors = [];

  try {
    await setContractPlan(tempRoot, "START");

    const startContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 960 } });
    const startPage = await startContext.newPage();
    startPage.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(`start:${message.text()}`);
      }
    });
    startPage.on("pageerror", (error) => pageErrors.push(`start:${String(error?.message || error)}`));

    await loginBrowser(startPage, baseURL, "owner.planos", "senha-owner");
    await waitForCondition(
      async () => (await startPage.locator("[data-admin-nav] [data-admin-section]").count()) >= 3,
      "Menu START deveria renderizar secoes permitidas."
    );
    const startNavText = await getNavText(startPage);

    ["Pedidos", "Cardapio", "Usuarios"].forEach((label) => {
      assert.ok(startNavText.includes(label), `Menu START deveria conter ${label}.`);
    });
    ["Financeiro", "Estoque", "Clientes", "Promocoes", "Relatorios", "Avaliacoes"].forEach((label) => {
      assert.equal(startNavText.includes(label), false, `Menu START nao deveria conter ${label}.`);
    });
    await startContext.close();

    await setContractPlan(tempRoot, "PREMIUM");

    const premiumContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 960 } });
    const premiumPage = await premiumContext.newPage();
    premiumPage.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(`premium:${message.text()}`);
      }
    });
    premiumPage.on("pageerror", (error) => pageErrors.push(`premium:${String(error?.message || error)}`));

    await loginBrowser(premiumPage, baseURL, "owner.planos", "senha-owner");
    await waitForCondition(
      async () => (await premiumPage.locator("[data-admin-nav] [data-admin-section]").count()) >= 8,
      "Menu PREMIUM deveria renderizar secoes completas."
    );
    const premiumNavText = await getNavText(premiumPage);

    ["Financeiro", "Estoque", "Clientes", "Promocoes"].forEach((label) => {
      assert.ok(premiumNavText.includes(label), `Menu PREMIUM deveria conter ${label}.`);
    });
    await premiumContext.close();

    const customContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 960 } });
    const customPage = await customContext.newPage();
    customPage.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(`custom:${message.text()}`);
      }
    });
    customPage.on("pageerror", (error) => pageErrors.push(`custom:${String(error?.message || error)}`));

    await loginBrowser(customPage, baseURL, "custom.sem.financeiro", "senha-custom");
    const customNavText = await getNavText(customPage);
    assert.ok(customNavText.includes("Pedidos"), "CUSTOM com permissao deve ver Pedidos.");
    assert.equal(customNavText.includes("Financeiro"), false, "CUSTOM sem permissao nao deve ver Financeiro.");
    await customContext.close();

    assert.deepEqual(consoleErrors, [], "Validacao de planos nao deveria emitir erros no console.");
    assert.deepEqual(pageErrors, [], "Validacao de planos nao deveria disparar erros de execucao.");
  } finally {
    await browser.close();
    await closeServer(server);
  }
};

const run = async () => {
  const originalCwd = process.cwd();
  const originalEnv = {
    ADMIN_LOGIN: process.env.ADMIN_LOGIN,
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_DISPLAY_NAME: process.env.ADMIN_DISPLAY_NAME,
    ADMIN_USERS: process.env.ADMIN_USERS,
    ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
    NODE_ENV: process.env.NODE_ENV,
  };
  const beforeRealData = await getDirectoryFingerprint(realDataDirectory);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tokyo-plans-contracts-"));

  try {
    await fs.mkdir(path.join(tempRoot, ".data"), { recursive: true });
    process.chdir(tempRoot);
    process.env.NODE_ENV = "development";
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.ADMIN_USERS;
    delete process.env.ADMIN_PASSWORD;

    const adminAuth = require(path.join(workspaceRoot, "lib/admin-auth.cjs"));

    process.env.ADMIN_LOGIN = "usermaster@inovas.com";
    process.env.ADMIN_PASSWORD_HASH = adminAuth.createPasswordHash("novais753951");
    process.env.ADMIN_DISPLAY_NAME = "Master INovas Food";
    process.env.ADMIN_SESSION_SECRET = "segredo-local-planos-contratos";

    const masterStore = require(path.join(workspaceRoot, "lib/master-platform-store.cjs"));
    const adminApi = require(path.join(workspaceRoot, "lib/admin-api.cjs"));

    await validateStaticContracts();
    await validatePlanModel(masterStore);
    await validateApiAccess(adminApi, tempRoot);
    await validateBrowserMenus(adminApi, tempRoot);

    const persistedStore = await readMasterStore(tempRoot);
    assert.equal(persistedStore.restaurantKey, "default");
    assert.equal(persistedStore.contracts[0].restaurantKey, "default");
    assert.equal(persistedStore.contracts[0].plan, "PREMIUM");

    const forbiddenField = ["restaurant", "id"].join("_");
    const tempFiles = await fs.readdir(path.join(tempRoot, ".data"));
    for (const fileName of tempFiles.filter((entry) => entry.endsWith(".json"))) {
      const contents = await fs.readFile(path.join(tempRoot, ".data", fileName), "utf8");
      assert.equal(contents.includes(forbiddenField), false, `${fileName} nao deve criar campo proibido.`);
    }

    const afterRealData = await getDirectoryFingerprint(realDataDirectory);
    assert.deepEqual(afterRealData, beforeRealData, "Validacao de planos nao deve alterar .data real.");

    console.log("Validacao local de planos, recursos e contratos concluida com sucesso.");
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
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
