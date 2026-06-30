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
const OFFICIAL_ADMIN_LOGO = "assets/inovas-food-logo-oficial.png";

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
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

const runAdminApi = async (
  handler,
  { method = "GET", url, body = null, cookie = "", ip = "127.0.13.1" }
) => {
  const req = {
    method,
    url,
    headers: {
      host: "localhost:3000",
      "x-forwarded-for": ip,
      "x-forwarded-proto": "http",
      accept: "application/json",
      "user-agent": "validate-v1-3-platform-local",
      ...(cookie ? { cookie } : {}),
    },
    socket: {
      remoteAddress: ip,
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

const login = async (adminApi, { identifier, password, ip = "127.0.13.1", next = "/admin/master.html" }) => {
  const response = await runAdminApi(adminApi, {
    method: "POST",
    url: "http://localhost:3000/api/admin/login",
    ip,
    body: {
      identifier,
      password,
      next,
    },
  });

  assert.equal(response.statusCode, 200, `Login deveria funcionar para ${identifier}.`);
  const cookie = extractCookieHeader(response);
  assert.ok(cookie, `Login deveria emitir cookie para ${identifier}.`);

  return { response, cookie };
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

      let pathname = decodeURIComponent(requestUrl.pathname);

      if (pathname === "/admin/" || pathname === "/admin") {
        pathname = "/admin/index.html";
      }

      if (pathname === "/admin/master") {
        pathname = "/admin/master.html";
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
      res.end(String(error?.message || "Internal server error"));
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

const waitForText = async (page, selector, expectedText, message) => {
  await waitForCondition(async () => {
    const text = (await page.locator(selector).textContent().catch(() => "")) || "";
    return text.includes(expectedText);
  }, message);
};

const assertOfficialLogo = async (page, selector, message) => {
  const src = await page.locator(selector).first().getAttribute("src");
  assert.ok(
    String(src || "").replace(/\\/g, "/").includes(OFFICIAL_ADMIN_LOGO),
    message
  );
};

const saveSystemUser = async (adminApi, cookie, userType, index) => {
  const loginId = `${userType.toLowerCase()}-v13@inovas.local`;
  const response = await runAdminApi(adminApi, {
    method: "POST",
    url: "http://localhost:3000/api/admin/users/save",
    cookie,
    ip: `127.0.13.${index}`,
    body: {
      user: {
        login: loginId,
        email: loginId,
        name: `${userType} V1.3`,
        password: "SenhaV13Platform",
        status: "ACTIVE",
        userType,
      },
    },
  });

  assert.equal(response.statusCode, 200, `${userType} deveria ser criado por MASTER.`);
  assert.equal(response.payload?.user?.restaurantKey || "", "", `${userType} nao deve receber restaurantKey.`);

  return loginId;
};

const validateApi = async (adminApi) => {
  // API layer: validates platform scope without relying on frontend-only menus.
  const master = await login(adminApi, {
    identifier: "usermaster@inovas.com",
    password: "novais753951",
    ip: "127.0.13.1",
  });

  assert.equal(master.response.payload?.admin?.tipo_usuario, "MASTER", "login padrao deve ser MASTER.");

  const overview = await runAdminApi(adminApi, {
    url: "http://localhost:3000/api/admin/master/overview",
    cookie: master.cookie,
    ip: "127.0.13.1",
  });

  assert.equal(overview.statusCode, 200, "MASTER deve acessar snapshot V1.3.");
  const snapshot = overview.payload;

  assert.ok(snapshot?.menu?.some((item) => item.key === "restaurants"), "Menu deve conter Restaurantes.");
  assert.ok(snapshot?.menu?.some((item) => item.key === "sellers"), "Menu deve conter Vendedores.");
  assert.ok(snapshot?.menu?.some((item) => item.key === "commissions"), "Menu deve conter Comissao.");
  assert.ok(snapshot?.menu?.some((item) => item.key === "contracts"), "Menu deve conter Contratos.");
  assert.ok(snapshot?.menu?.some((item) => item.key === "finance"), "Menu deve conter Financeiro.");
  assert.ok(snapshot?.menu?.some((item) => item.key === "commercial"), "Menu deve conter Comercial.");

  const dashboard = snapshot.platformDashboard || snapshot.dashboard || {};
  [
    "totalRestaurants",
    "activeRestaurants",
    "blockedRestaurants",
    "systemUsers",
    "restaurantUsers",
    "ordersToday",
    "ordersMonth",
    "totalCustomers",
    "totalRevenue",
    "monthlyRevenue",
    "newRestaurants",
    "activeSubscriptions",
    "expiringSubscriptions",
    "averagePlatformUsage",
    "supportTickets",
    "errors",
    "performanceScore",
  ].forEach((key) => {
    assert.ok(Object.prototype.hasOwnProperty.call(dashboard, key), `Dashboard V1.3 deve expor ${key}.`);
  });

  assert.ok(
    snapshot.platformPlans?.some((plan) => plan.displayName === "Essencial") &&
      snapshot.platformPlans?.some((plan) => plan.displayName === "Profissional") &&
      snapshot.platformPlans?.some((plan) => plan.displayName === "Enterprise"),
    "Planos oficiais V1.3 devem existir."
  );
  assert.ok(Array.isArray(snapshot.sellers), "Snapshot deve expor vendedores.");
  assert.ok(Array.isArray(snapshot.commissions), "Snapshot deve expor comissoes.");
  assert.ok(Array.isArray(snapshot.platformContracts), "Snapshot deve expor contratos.");
  assert.ok(snapshot.financeDashboard, "Snapshot deve expor dashboard financeiro.");
  assert.ok(snapshot.commercialDashboard, "Snapshot deve expor dashboard comercial.");
  assert.ok(snapshot.settings?.smtp?.status, "Configuracoes devem preparar SMTP.");
  assert.ok(snapshot.settings?.api?.status, "Configuracoes devem preparar API.");
  assert.ok(snapshot.settings?.tokens?.status, "Configuracoes devem preparar tokens.");

  const userTypes = ["SOCIO", "DESENVOLVEDOR", "SUPORTE", "VENDEDOR"];
  const createdUsers = [];

  for (let index = 0; index < userTypes.length; index += 1) {
    createdUsers.push(await saveSystemUser(adminApi, master.cookie, userTypes[index], index + 2));
  }

  const expectedAccess = new Map([
    ["SOCIO", 200],
    ["DESENVOLVEDOR", 403],
    ["SUPORTE", 403],
    ["VENDEDOR", 403],
  ]);

  for (let index = 0; index < userTypes.length; index += 1) {
    const userType = userTypes[index];
    const loggedUser = await login(adminApi, {
      identifier: createdUsers[index],
      password: "SenhaV13Platform",
      ip: `127.0.13.${index + 10}`,
    });
    const panelAccess = await runAdminApi(adminApi, {
      url: "http://localhost:3000/api/admin/master/overview",
      cookie: loggedUser.cookie,
      ip: `127.0.13.${index + 10}`,
    });

    assert.equal(
      panelAccess.statusCode,
      expectedAccess.get(userType),
      `${userType} deve ser validado separadamente no acesso ao painel.`
    );
  }
};

const validateBrowser = async (adminApi) => {
  // Browser layer: validates the approved INOVAS shell, navigation and mobile layout.
  const server = createStaticServer(workspaceRoot, adminApi);
  const { port } = await listen(server);
  const baseURL = `http://127.0.0.1:${port}`;
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

    await page.goto(`${baseURL}/admin/login.html?next=%2Fadmin%2Fmaster.html`, {
      waitUntil: "domcontentloaded",
    });
    await assertOfficialLogo(
      page,
      ".admin-login-brand-logo",
      "Login admin deve carregar a logo oficial INOVAS Food."
    );
    await page.locator('input[name="identifier"]').fill("usermaster@inovas.com");
    await page.locator('input[name="password"]').fill("novais753951");
    await page.locator("[data-admin-login-submit]").click();

    await waitForCondition(
      async () =>
        (await page.evaluate(() => document.body.dataset.adminPage).catch(() => "")) === "master" &&
        (await page.evaluate(() => document.body.dataset.masterSection).catch(() => "")) === "dashboard",
      "Login MASTER deveria abrir o painel da Plataforma."
    );
    await assertOfficialLogo(
      page,
      ".master-brand-logo",
      "Painel Master deve carregar a logo oficial INOVAS Food."
    );

    await waitForText(page, "body", "Dashboard Plataforma", "Dashboard Plataforma deveria renderizar.");
    await waitForText(page, "body", "Total Restaurantes", "Card Total Restaurantes deveria aparecer.");
    await waitForText(page, "body", "Usuarios Sistema", "Card Usuarios Sistema deveria aparecer.");
    await waitForText(page, "body", "Performance", "Card Performance deveria aparecer.");

    const sections = [
      ["restaurants", "Gestao de Restaurantes"],
      ["plans", "Gestao dos Planos"],
      ["subscriptions", "Assinaturas / Contratos"],
      ["sellers", "Vendedores"],
      ["commissions", "Comissao"],
      ["contracts", "Contratos"],
      ["finance", "Dashboard Financeiro"],
      ["commercial", "Dashboard Comercial"],
      ["logs", "Logs"],
      ["audit", "Auditoria"],
      ["settings", "Configuracoes da Plataforma"],
    ];

    for (const [section, expectedText] of sections) {
      await page.locator(`[data-master-section-button="${section}"]`).click();
      await waitForCondition(
        async () => (await page.evaluate(() => document.body.dataset.masterSection)) === section,
        `Secao ${section} deveria ativar.`
      );
      await waitForText(page, "[data-master-content]", expectedText, `Secao ${section} deveria renderizar.`);
    }

    await page.locator('[data-master-section-button="restaurants"]').click();
    await waitForText(page, "[data-master-content]", "Cidade", "Tabela Restaurantes deveria conter Cidade.");
    await waitForText(page, "[data-master-content]", "Ultimo Login", "Tabela Restaurantes deveria conter Ultimo Login.");
    await page.locator('[data-master-restaurant-action="view"]').first().click();
    await waitForText(page, "[data-master-content]", "Pagina Restaurante", "Pagina Restaurante deveria abrir.");
    await waitForText(page, "[data-master-content]", "Financeiro", "Aba Financeiro deveria existir.");
    await waitForText(page, "[data-master-content]", "Configuracoes", "Aba Configuracoes deveria existir.");

    await page.setViewportSize({ width: 390, height: 860 });
    await page.locator('[data-master-section-button="finance"]').click();
    await waitForText(page, "[data-master-content]", "Dashboard Financeiro", "Financeiro deve renderizar no mobile.");

    assert.deepEqual(consoleErrors, [], "Painel Plataforma V1.3 nao deveria emitir erros no console.");
    assert.deepEqual(pageErrors, [], "Painel Plataforma V1.3 nao deveria disparar erros de execucao.");
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
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tokyo-v13-platform-validation-"));

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
    process.env.ADMIN_SESSION_SECRET = "segredo-local-v13-platform";

    const { resetSecurityGuardianForTests } = require(path.join(workspaceRoot, "lib/security-guardian.cjs"));
    const adminApi = require(path.join(workspaceRoot, "lib/admin-api.cjs"));

    await validateApi(adminApi);
    resetSecurityGuardianForTests();
    await validateBrowser(adminApi);

    const afterRealData = await getDirectoryFingerprint(realDataDirectory);
    assert.deepEqual(afterRealData, beforeRealData, "Validacao V1.3 nao deve alterar .data real.");

    console.log("Validacao local V1.3 Plataforma concluida com sucesso.");
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
