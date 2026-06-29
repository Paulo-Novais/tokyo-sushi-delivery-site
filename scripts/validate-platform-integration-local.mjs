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
]);

const PUBLIC_ROUTES = [
  "/index.html",
  "/cardapio.html",
  "/entrega.html",
  "/avaliar.html",
  "/acompanhar.html",
];

const PROFILE_FIXTURES = Object.freeze({
  master: { login: "usermaster@inovas.com", password: "novais753951" },
  owner: { login: "owner.local", password: "senha-owner" },
  developer: { login: "dev.local", password: "senha-dev" },
  custom: { login: "custom.local", password: "senha-custom" },
});

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

const resolveMasterHtmlAccess = async (cookieHeader, authContext) => {
  const session = authContext.adminAuth.getAdminSessionFromCookieHeader(cookieHeader || "");

  if (!session) {
    return "unauthenticated";
  }

  try {
    const accessContext = await authContext.userPermissions.getAdminAccessContext(
      session,
      [],
      authContext.adminAuth.getConfiguredAdminUsers()
    );
    const userType = String(
      accessContext.session?.userType || accessContext.session?.tipo_usuario || ""
    )
      .trim()
      .toUpperCase();

    return userType === "MASTER" ? "master" : "forbidden";
  } catch (error) {
    return "forbidden";
  }
};

const createStaticServer = (rootDirectory, adminApi, authContext) =>
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
        res.end(
          JSON.stringify({
            ok: true,
            sections: [],
            items: [],
          })
        );
        return;
      }

      let pathname = decodeURIComponent(requestUrl.pathname);

      if (pathname === "/favicon.ico") {
        res.writeHead(204, { "Cache-Control": "no-store" });
        res.end();
        return;
      }

      if (pathname === "/") {
        pathname = "/index.html";
      }

      if (pathname === "/admin/" || pathname === "/admin") {
        pathname = "/admin/index.html";
      }

      if (pathname === "/admin/master") {
        pathname = "/admin/master.html";
      }

      if (pathname === "/admin/master.html") {
        const access = await resolveMasterHtmlAccess(req.headers.cookie || "", authContext);

        if (access === "unauthenticated") {
          const loginUrl = new URL("/admin/login.html", `http://${req.headers.host || "127.0.0.1"}`);
          loginUrl.searchParams.set("next", `${pathname}${requestUrl.search}`);
          res.writeHead(307, {
            "Cache-Control": "no-store",
            Location: loginUrl.pathname + loginUrl.search,
          });
          res.end();
          return;
        }

        if (access !== "master") {
          res.writeHead(403, {
            "Cache-Control": "no-store",
            "Content-Type": "text/plain; charset=utf-8",
          });
          res.end("Acesso negado ao Painel Master.");
          return;
        }
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

const login = async (adminApi, profile, next = "/admin/") => {
  const response = await runAdminApi(adminApi, {
    method: "POST",
    url: "http://localhost:3000/api/admin/login",
    body: {
      identifier: profile.login,
      password: profile.password,
      next,
    },
  });

  assert.equal(response.statusCode, 200, `Login deveria funcionar para ${profile.login}.`);
  const cookie = extractCookieHeader(response);

  assert.ok(cookie, `Login deveria emitir cookie para ${profile.login}.`);

  return {
    response,
    cookie,
  };
};

const createManagedUser = async (adminApi, masterCookie, user) => {
  const response = await runAdminApi(adminApi, {
    method: "POST",
    url: "http://localhost:3000/api/admin/users/save",
    cookie: masterCookie,
    body: {
      user,
    },
  });

  assert.equal(response.statusCode, 200, `Usuario ${user.login} deveria ser criado.`);
  assert.equal(response.payload?.user?.restaurantKey, "default");
  assert.equal(response.payload?.user?.tipo_usuario, user.userType);

  return response.payload.user;
};

const expectApiStatus = async (adminApi, options, expectedStatus, message) => {
  const response = await runAdminApi(adminApi, options);

  assert.equal(response.statusCode, expectedStatus, message);
  return response;
};

const validateStaticContracts = async (adminAuth) => {
  const siteConfig = JSON.parse(await fs.readFile(path.join(workspaceRoot, "site.config.json"), "utf8"));

  assert.equal(siteConfig.primaryDomain, "tokyosushidelivery.com.br", "Dominio principal nao deve mudar.");
  assert.equal(siteConfig.companyWebsite, "https://tokyosushidelivery.com.br");
  assert.equal(siteConfig.identifiers.cookieNames.adminSession, "tokyo_admin_session");
  assert.equal(siteConfig.identifiers.cookieNames.customerSession, "tokyo_customer_session");
  assert.equal(siteConfig.identifiers.cookieNames.customerLoginChallenge, "tokyo_customer_login_challenge");
  assert.equal(siteConfig.identifiers.storageKeys.adminTheme, "tokyo_admin_theme");
  assert.equal(siteConfig.identifiers.storageKeys.cart, "tokyo_sushi_delivery_cart");
  assert.equal(siteConfig.identifiers.headerNames.customerClientToken, "x-tokyo-customer-client-token");
  assert.equal(siteConfig.identifiers.headerNames.customerKey, "x-tokyo-customer-key");
  assert.equal(adminAuth.ADMIN_SESSION_COOKIE_NAME, "tokyo_admin_session");
};

const validateApiMatrix = async (adminApi) => {
  const masterLogin = await login(adminApi, PROFILE_FIXTURES.master, "/admin/master.html");
  const masterCookie = masterLogin.cookie;

  assert.equal(masterLogin.response.payload?.admin?.tipo_usuario, "MASTER");
  assert.equal(masterLogin.response.payload?.admin?.restaurantKey, "default");

  const oldMasterLogin = await runAdminApi(adminApi, {
    method: "POST",
    url: "http://localhost:3000/api/admin/login",
    body: {
      identifier: "master.local",
      password: "senha-master",
      next: "/admin/master.html",
    },
  });

  assert.equal(oldMasterLogin.statusCode, 401, "login Master antigo nao deve autenticar.");
  assert.equal(oldMasterLogin.payload?.errorCode, "invalid_credentials");

  await createManagedUser(adminApi, masterCookie, {
    name: "Owner Local",
    login: PROFILE_FIXTURES.owner.login,
    email: "owner.local@teste.local",
    phone: "5511999911111",
    password: PROFILE_FIXTURES.owner.password,
    status: "ACTIVE",
    userType: "OWNER",
  });
  await createManagedUser(adminApi, masterCookie, {
    name: "Desenvolvedor Local",
    login: PROFILE_FIXTURES.developer.login,
    email: "dev.local@teste.local",
    password: PROFILE_FIXTURES.developer.password,
    status: "ACTIVE",
    userType: "DESENVOLVEDOR",
  });
  await createManagedUser(adminApi, masterCookie, {
    name: "Custom Local",
    login: PROFILE_FIXTURES.custom.login,
    email: "custom.local@teste.local",
    password: PROFILE_FIXTURES.custom.password,
    status: "ACTIVE",
    userType: "CUSTOM",
    permissions: {
      orders_view: true,
    },
  });

  const ownerLogin = await login(adminApi, PROFILE_FIXTURES.owner);
  const developerLogin = await login(adminApi, PROFILE_FIXTURES.developer);
  const customLogin = await login(adminApi, PROFILE_FIXTURES.custom);

  assert.equal(ownerLogin.response.payload?.admin?.tipo_usuario, "OWNER");
  assert.equal(developerLogin.response.payload?.admin?.tipo_usuario, "DESENVOLVEDOR");
  assert.equal(customLogin.response.payload?.admin?.tipo_usuario, "CUSTOM");

  await expectApiStatus(
    adminApi,
    { url: "http://localhost:3000/api/admin/orders/list?limit=1", cookie: masterCookie },
    200,
    "MASTER deve acessar Gestor."
  );
  const masterPanel = await expectApiStatus(
    adminApi,
    { url: "http://localhost:3000/api/admin/master/overview", cookie: masterCookie },
    200,
    "MASTER deve acessar API Master."
  );
  assert.equal(masterPanel.payload?.restaurantKey, "default");
  assert.equal(masterPanel.payload?.restaurants?.[0]?.restaurantKey, "default");
  assert.equal(masterPanel.payload?.restaurants?.[0]?.status, "CLIENTE_MODELO");
  assert.equal(masterPanel.payload?.futureArchitecture?.multiRestaurantActive, false);

  await expectApiStatus(
    adminApi,
    { url: "http://localhost:3000/api/admin/orders/list?limit=1", cookie: ownerLogin.cookie },
    200,
    "OWNER deve acessar Gestor."
  );
  await expectApiStatus(
    adminApi,
    { url: "http://localhost:3000/api/admin/finance", cookie: ownerLogin.cookie },
    200,
    "OWNER deve acessar financeiro do Gestor."
  );
  await expectApiStatus(
    adminApi,
    { url: "http://localhost:3000/api/admin/audit", cookie: ownerLogin.cookie },
    403,
    "OWNER nao deve acessar logs de desenvolvedor."
  );
  await expectApiStatus(
    adminApi,
    { url: "http://localhost:3000/api/admin/master/overview", cookie: ownerLogin.cookie },
    403,
    "OWNER nao deve acessar API Master."
  );

  await expectApiStatus(
    adminApi,
    { url: "http://localhost:3000/api/admin/orders/list?limit=1", cookie: developerLogin.cookie },
    200,
    "DESENVOLVEDOR deve acessar Gestor."
  );
  await expectApiStatus(
    adminApi,
    { url: "http://localhost:3000/api/admin/audit", cookie: developerLogin.cookie },
    200,
    "DESENVOLVEDOR deve acessar logs/diagnostico permitido."
  );
  await expectApiStatus(
    adminApi,
    { url: "http://localhost:3000/api/admin/master/overview", cookie: developerLogin.cookie },
    403,
    "DESENVOLVEDOR nao deve acessar API Master."
  );

  await expectApiStatus(
    adminApi,
    { url: "http://localhost:3000/api/admin/orders/list?limit=1", cookie: customLogin.cookie },
    200,
    "CUSTOM com orders_view deve acessar pedidos."
  );
  const customFinance = await expectApiStatus(
    adminApi,
    { url: "http://localhost:3000/api/admin/finance", cookie: customLogin.cookie },
    403,
    "CUSTOM sem financial_view deve receber 403 no financeiro."
  );
  assert.equal(customFinance.payload?.errorCode, "admin_permission_denied");
  await expectApiStatus(
    adminApi,
    {
      method: "POST",
      url: "http://localhost:3000/api/admin/orders/status",
      cookie: customLogin.cookie,
      body: { orderId: "pedido-inexistente", status: "Aceito" },
    },
    403,
    "CUSTOM sem orders_edit deve receber 403 ao editar pedido."
  );
  await expectApiStatus(
    adminApi,
    { url: "http://localhost:3000/api/admin/users/list", cookie: customLogin.cookie },
    403,
    "CUSTOM sem users_view deve receber 403 em usuarios."
  );
  const customMaster = await expectApiStatus(
    adminApi,
    { url: "http://localhost:3000/api/admin/master/overview", cookie: customLogin.cookie },
    403,
    "CUSTOM nao deve acessar API Master."
  );
  assert.equal(customMaster.payload?.errorCode, "master_access_required");

  await expectApiStatus(
    adminApi,
    { url: "http://localhost:3000/api/admin/orders/list?limit=1" },
    401,
    "API protegida sem cookie deve retornar 401."
  );

  return {
    masterCookie,
    ownerCookie: ownerLogin.cookie,
    developerCookie: developerLogin.cookie,
    customCookie: customLogin.cookie,
  };
};

const loginBrowser = async (page, baseURL, profile, next = "/admin/") => {
  await page.goto(`${baseURL}/admin/login.html?next=${encodeURIComponent(next)}`, {
    waitUntil: "domcontentloaded",
  });
  await waitForCondition(
    async () => (await page.locator("[data-admin-login-form]").count()) === 1,
    `Login deveria carregar para ${profile.login}.`
  );
  await page.locator('input[name="identifier"]').fill(profile.login);
  await page.locator('input[name="password"]').fill(profile.password);
  await page.locator("[data-admin-login-submit]").click();
};

const getText = (page, selector) =>
  page.locator(selector).textContent().then((text) => text || "").catch(() => "");

const validateRestaurantMenu = async (page, expected) => {
  await waitForCondition(
    async () => (await page.locator("[data-admin-nav] [data-admin-section]").count()) >= expected.minItems,
    "Menu do Gestor deveria renderizar secoes permitidas."
  );
  const navText = await getText(page, "[data-admin-nav]");

  expected.includes.forEach((label) => {
    assert.ok(navText.includes(label), `Menu do Gestor deveria conter ${label}. Texto: ${navText}`);
  });
  expected.excludes.forEach((label) => {
    assert.equal(navText.includes(label), false, `Menu do Gestor nao deveria conter ${label}. Texto: ${navText}`);
  });
};

const validateMasterHtmlServerAccess = async (baseURL, authCookies) => {
  const noSession = await fetch(`${baseURL}/admin/master.html`, { redirect: "manual" });
  assert.equal(noSession.status, 307, "Usuario sem sessao deve ser redirecionado para login.");
  assert.ok(
    String(noSession.headers.get("location") || "").startsWith("/admin/login.html"),
    "Redirecionamento sem sessao deve apontar para login."
  );

  const master = await fetch(`${baseURL}/admin/master.html`, {
    headers: { cookie: authCookies.masterCookie },
    redirect: "manual",
  });
  assert.equal(master.status, 200, "MASTER deve carregar /admin/master.html.");
  assert.ok(
    (await master.text()).includes('data-admin-page="master"'),
    "HTML do Master deve ser entregue ao MASTER."
  );

  const deniedProfiles = [
    ["OWNER", authCookies.ownerCookie],
    ["DESENVOLVEDOR", authCookies.developerCookie],
    ["CUSTOM", authCookies.customCookie],
  ];

  for (const [label, cookie] of deniedProfiles) {
    const response = await fetch(`${baseURL}/admin/master.html`, {
      headers: { cookie },
      redirect: "manual",
    });
    assert.equal(response.status, 403, `${label} nao deve carregar /admin/master.html.`);
    assert.ok((await response.text()).includes("Acesso negado"), `${label} deve receber acesso negado.`);
  }
};

const validateBrowserLayering = async (adminApi, authContext, authCookies) => {
  const server = createStaticServer(workspaceRoot, adminApi, authContext);
  const { port } = await listen(server);
  const baseURL = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];
  const pageErrors = [];

  try {
    for (const publicRoute of PUBLIC_ROUTES) {
      const response = await fetch(`${baseURL}${publicRoute}`);
      assert.equal(response.status, 200, `Rota publica deve continuar acessivel: ${publicRoute}`);
    }

    await validateMasterHtmlServerAccess(baseURL, authCookies);

    const masterContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 960 } });
    const masterPage = await masterContext.newPage();
    masterPage.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(`master:${message.text()}`);
      }
    });
    masterPage.on("pageerror", (error) => pageErrors.push(`master:${String(error?.message || error)}`));

    await loginBrowser(masterPage, baseURL, PROFILE_FIXTURES.master, "/admin/master.html");
    await waitForCondition(
      async () => (await masterPage.evaluate(() => document.body.dataset.adminPage).catch(() => "")) === "master",
      "MASTER deveria abrir /admin/master.html."
    );
    await waitForCondition(
      async () => (await masterPage.locator("[data-master-section-button]").count()) >= 10,
      "Menu Master deveria renderizar modulos da plataforma."
    );
    const masterNavText = await getText(masterPage, "[data-master-nav]");

    ["Dashboard Geral", "Restaurantes", "Planos", "Recursos", "Dominios", "Assinaturas", "Desenvolvedor"].forEach(
      (label) => assert.ok(masterNavText.includes(label), `Menu Master deveria conter ${label}.`)
    );
    ["Pedidos", "Cardapio", "Financeiro", "Estoque"].forEach((label) =>
      assert.equal(masterNavText.includes(label), false, `Menu Master nao deveria conter item do Gestor: ${label}.`)
    );
    await masterContext.close();

    const ownerContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 960 } });
    const ownerPage = await ownerContext.newPage();
    ownerPage.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(`owner:${message.text()}`);
      }
    });
    ownerPage.on("pageerror", (error) => pageErrors.push(`owner:${String(error?.message || error)}`));

    await loginBrowser(ownerPage, baseURL, PROFILE_FIXTURES.owner, "/admin/");
    await waitForCondition(
      async () => (await ownerPage.evaluate(() => document.body.dataset.adminPage).catch(() => "")) === "dashboard",
      "OWNER deveria abrir Gestor."
    );
    await validateRestaurantMenu(ownerPage, {
      minItems: 8,
      includes: ["Pedidos", "Financeiro", "Usuarios"],
      excludes: ["Painel Master", "Restaurantes", "Planos", "Recursos", "Dominios", "Assinaturas", "Relatorios Gerais", "Desenvolvedor"],
    });
    await ownerContext.close();

    const customContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 960 } });
    const customPage = await customContext.newPage();
    customPage.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(`custom:${message.text()}`);
      }
    });
    customPage.on("pageerror", (error) => pageErrors.push(`custom:${String(error?.message || error)}`));

    await loginBrowser(customPage, baseURL, PROFILE_FIXTURES.custom, "/admin/");
    await waitForCondition(
      async () => (await customPage.evaluate(() => document.body.dataset.adminPage).catch(() => "")) === "dashboard",
      "CUSTOM deveria abrir Gestor."
    );
    await validateRestaurantMenu(customPage, {
      minItems: 1,
      includes: ["Pedidos"],
      excludes: [
        "Financeiro",
        "Estoque",
        "Clientes",
        "Usuarios",
        "Configuracoes",
        "Cardapio",
        "Painel Master",
        "Restaurantes",
        "Planos",
        "Recursos",
        "Dominios",
      ],
    });
    await customContext.close();

    assert.deepEqual(consoleErrors, [], "Validacao de browser nao deveria emitir erros no console.");
    assert.deepEqual(pageErrors, [], "Validacao de browser nao deveria disparar erros de execucao.");
  } finally {
    await browser.close();
    await closeServer(server);
  }
};

const assertNoUnscopedPhysicalRestaurantIdInTempData = async (tempRoot) => {
  const dataRoot = path.join(tempRoot, ".data");
  const files = await fs.readdir(dataRoot).catch(() => []);

  for (const fileName of files.filter((entry) => entry.endsWith(".json"))) {
    const contents = await fs.readFile(path.join(dataRoot, fileName), "utf8");
    if (contents.includes("restaurant_id")) {
      assert.ok(
        contents.includes("tenant_id"),
        `${fileName} nao pode persistir restaurant_id sem tenant_id.`
      );
    }
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
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tokyo-platform-integration-"));

  try {
    await fs.mkdir(path.join(tempRoot, ".data"), { recursive: true });
    process.chdir(tempRoot);
    process.env.NODE_ENV = "development";
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.ADMIN_USERS;
    delete process.env.ADMIN_PASSWORD;

    const adminAuth = require(path.join(workspaceRoot, "lib/admin-auth.cjs"));

    process.env.ADMIN_LOGIN = PROFILE_FIXTURES.master.login;
    process.env.ADMIN_PASSWORD_HASH = adminAuth.createPasswordHash(PROFILE_FIXTURES.master.password);
    process.env.ADMIN_DISPLAY_NAME = "Master INovas Food";
    process.env.ADMIN_SESSION_SECRET = "segredo-local-platform-integration";

    await validateStaticContracts(adminAuth);

    const adminApi = require(path.join(workspaceRoot, "lib/admin-api.cjs"));
    const userPermissions = require(path.join(workspaceRoot, "lib/user-permissions.cjs"));

    const authCookies = await validateApiMatrix(adminApi);
    await validateBrowserLayering(adminApi, { adminAuth, userPermissions }, authCookies);
    await assertNoUnscopedPhysicalRestaurantIdInTempData(tempRoot);

    const adminUsersStore = JSON.parse(await fs.readFile(path.join(tempRoot, ".data", "admin-users.json"), "utf8"));
    const masterStore = JSON.parse(await fs.readFile(path.join(tempRoot, ".data", "master-platform.json"), "utf8"));

    assert.equal(adminUsersStore.restaurantKey, "default");
    assert.equal(masterStore.restaurantKey, "default");
    assert.equal(masterStore.restaurants[0].restaurantKey, "default");
    assert.equal(masterStore.restaurants[0].status, "CLIENTE_MODELO");

    const afterRealData = await getDirectoryFingerprint(realDataDirectory);
    assert.deepEqual(afterRealData, beforeRealData, "Validacao integrada nao deve alterar .data real.");

    console.log("Validacao local de integracao da plataforma concluida com sucesso.");
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
