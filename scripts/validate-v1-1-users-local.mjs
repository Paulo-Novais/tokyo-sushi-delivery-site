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

const runAdminApi = async (
  handler,
  { method = "GET", url, host = "localhost:3000", body = null, cookie = "", ip = "127.0.0.1" }
) => {
  const req = {
    method,
    url,
    headers: {
      host,
      "x-forwarded-for": ip,
      "x-forwarded-proto": "http",
      accept: "application/json",
      "user-agent": "validate-v1-1-users-local",
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

      if (pathname === "/admin/usuarios/novo") {
        pathname = "/admin/usuarios/novo.html";
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
      resolve({ port: Number(address.port) });
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
      const childStats = await fs.stat(childPath);
      const relativePath = path.join(relativeBase, child.name).replace(/\\/g, "/");

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

const restoreEnvironment = (originalEnv) => {
  Object.entries(originalEnv).forEach(([key, value]) => {
    if (typeof value === "undefined") {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });
};

const loginAdmin = async (adminApi, { host, identifier, password, cookie = "", ip = "127.0.1.1" }) => {
  const response = await runAdminApi(adminApi, {
    method: "POST",
    url: `http://${host}/api/admin/login`,
    host,
    cookie,
    ip,
    body: {
      identifier,
      password,
      next: "/admin/",
    },
  });

  assert.equal(response.statusCode, 200, `${identifier} deveria autenticar em ${host}`);
  const sessionCookie = extractCookieHeader(response);
  assert.ok(sessionCookie, "login administrativo deve emitir cookie");
  return { response, cookie: sessionCookie };
};

const restaurantPayload = ({ key = "usuarios-a", plan = "PRO" } = {}) => ({
  restaurantName: "Usuarios A",
  tradeName: "Usuarios A",
  slug: key,
  restaurantKey: key,
  domain: `${key}.localhost`,
  document: "12345678000190",
  ownerFullName: "Owner Usuarios A",
  city: "Sao Paulo",
  postalCode: "01000000",
  establishmentNumber: "101",
  email: `owner@${key}.local`,
  phone: "5511999922222",
  whatsapp: "5511999922222",
  adhesionDate: "2026-06-28",
  address: {
    street: "Rua V1.1",
    number: "101",
    neighborhood: "Centro",
    city: "Sao Paulo",
    state: "SP",
    postalCode: "01000000",
  },
  delivery: {
    radiusKm: 6,
    fee: 9,
    minimumOrder: 35,
    deliveriesEnabled: true,
  },
  paymentMethods: ["pix", "card", "cash"],
  plan,
  subscriptionStatus: "TRIAL",
  adminUser: {
    login: `owner@${key}.local`,
    email: `owner@${key}.local`,
    name: "Owner Usuarios A",
    password: "SenhaOwnerV11",
  },
});

const readWorkspaceFile = async (relativePath) =>
  fs.readFile(path.join(workspaceRoot, relativePath), "utf8");

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

const openUsersModule = async (page) => {
  await page.locator('[data-admin-section="users"]').click();
  await waitForCondition(
    async () => (await page.locator(".admin-users-table").count()) === 1,
    "Modulo Usuarios deveria renderizar tabela."
  );
};

const captureBrowserDiagnostics = (page, label, consoleErrors, pageErrors) => {
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(`${label}:${message.text()}`);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(`${label}:${String(error?.message || error)}`));
  page.on("response", async (response) => {
    const status = response.status();

    if (status >= 400) {
      const request = response.request();
      let body = "";

      try {
        body = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 300);
      } catch (error) {
        body = "";
      }

      consoleErrors.push(
        `${label}:HTTP ${status} ${request.method()} ${response.url()}${body ? ` ${body}` : ""}`
      );
    }
  });
};

const validateUsersBrowser = async (adminApi) => {
  const { resetSecurityGuardianForTests } = require(path.join(workspaceRoot, "lib/security-guardian.cjs"));
  resetSecurityGuardianForTests();

  const server = createStaticServer(workspaceRoot, adminApi);
  const { port } = await listen(server);
  const baseURL = `http://usuarios-a.localhost:${port}`;
  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];
  const pageErrors = [];

  try {
    const desktopContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 960 } });
    const desktopPage = await desktopContext.newPage();
    captureBrowserDiagnostics(desktopPage, "desktop", consoleErrors, pageErrors);

    await loginBrowser(desktopPage, baseURL, "master@v1-1.local", "SenhaMasterV11");
    await openUsersModule(desktopPage);

    const headers = await desktopPage.locator(".admin-users-table thead th").allTextContents();
    assert.deepEqual(
      headers.map((header) => header.replace(/\s+/g, " ").trim().replace(/[\\^v]+$/g, "").trim()),
      ["ID", "Nome", "Restaurante", "Plano", "Perfil", "Status", "Acoes"],
      "Tabela Usuarios deve seguir a ordem obrigatoria"
    );
    await desktopPage.locator("[data-user-inline-search]").fill("Owner");
    await waitForCondition(
      async () => (await desktopPage.locator(".admin-users-table tbody tr").count()) >= 1,
      "Busca por nome deveria manter resultado visivel."
    );
    await desktopPage.locator('[data-user-sort="name"]').click();
    await desktopPage.locator('[data-user-filter="restaurant"]').selectOption("usuarios-a");
    await desktopPage.locator('[data-user-filter="profile"]').selectOption("OWNER");
    await desktopPage.locator('[data-user-filter="status"]').selectOption("ACTIVE");
    await desktopPage.locator("[data-user-clear-filters]").click();
    await desktopPage.locator("[data-user-page-size]").selectOption("10");
    assert.equal(await desktopPage.locator("[data-user-page]").count(), 2, "Paginacao deve expor anterior/proxima.");
    await desktopPage.locator("[data-user-new]").click();
    await waitForCondition(
      async () =>
        desktopPage.url().includes("/admin/usuarios/novo") &&
        (await desktopPage.locator("[data-user-form]:visible").count()) === 1,
      "Botao Novo usuario deve abrir a pagina dedicada."
    );
    assert.equal(
      await desktopPage.locator("[data-custom-permissions]").isHidden(),
      true,
      "Permissoes avancadas devem permanecer ocultas."
    );
    assert.equal(
      await desktopPage.locator('input[name="userType"][value="GERENTE"]').isChecked(),
      true,
      "Perfil pronto deve ser a experiencia inicial."
    );
    await desktopContext.close();

    const masterContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 960 } });
    const masterPage = await masterContext.newPage();
    captureBrowserDiagnostics(masterPage, "master", consoleErrors, pageErrors);

    await loginBrowser(masterPage, baseURL, "master@v1-1.local", "SenhaMasterV11");
    await openUsersModule(masterPage);
    assert.equal(
      await masterPage.locator("[data-admin-main-title]").textContent(),
      "INOVAS Food",
      "Header MASTER deve exibir INOVAS Food em vez de restaurante."
    );
    assert.equal(
      await masterPage.locator("[data-admin-welcome]").textContent(),
      "Administrador do Sistema",
      "Header MASTER deve identificar administracao do sistema."
    );
    await masterPage.locator("[data-user-new]").click();
    await waitForCondition(
      async () => (await masterPage.locator("[data-user-form]:visible").count()) === 1,
      "MASTER deve abrir a pagina dedicada."
    );
    assert.equal(
      await masterPage.locator('select[name="restaurantKey"]').count(),
      1,
      "MASTER deve escolher o restaurante."
    );
    await masterContext.close();

    const mobileContext = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
    const mobilePage = await mobileContext.newPage();
    captureBrowserDiagnostics(mobilePage, "mobile", consoleErrors, pageErrors);

    await loginBrowser(mobilePage, baseURL, "master@v1-1.local", "SenhaMasterV11");
    await openUsersModule(mobilePage);
    const mobileLayout = await mobilePage.evaluate(() => {
      const tableWrap = document.querySelector(".admin-users-table-wrap");
      const firstCell = document.querySelector(".admin-users-table tbody td");
      const bodyOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;

      return {
        hasTableScroll: tableWrap ? tableWrap.scrollWidth >= tableWrap.clientWidth : false,
        tableCellDisplay: firstCell ? getComputedStyle(firstCell).display : "",
        viewportWidth: window.innerWidth,
        bodyOverflow,
      };
    });
    assert.equal(mobileLayout.tableCellDisplay, "flex", "Tabela mobile deve virar cards responsivos.");
    assert.ok(mobileLayout.bodyOverflow <= 4, "Pagina mobile nao deve gerar overflow horizontal relevante.");
    await mobileContext.close();

    assert.deepEqual(consoleErrors, [], "Tela Usuarios nao deve emitir erros no console.");
    assert.deepEqual(pageErrors, [], "Tela Usuarios nao deve disparar erros de execucao.");
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
    INOVAS_TENANT_MODE: process.env.INOVAS_TENANT_MODE,
    NODE_ENV: process.env.NODE_ENV,
  };
  const beforeRealData = await getDirectoryFingerprint(realDataDirectory);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tokyo-v1-1-users-"));

  try {
    await fs.mkdir(path.join(tempRoot, ".data"), { recursive: true });
    process.chdir(tempRoot);
    process.env.NODE_ENV = "development";
    process.env.INOVAS_TENANT_MODE = "pilot";
    process.env.ADMIN_SESSION_SECRET = "validate-v1-1-users-secret";
    delete process.env.ADMIN_LOGIN;
    delete process.env.ADMIN_PASSWORD_HASH;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_DISPLAY_NAME;
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;

    const adminAuth = require(path.join(workspaceRoot, "lib/admin-auth.cjs"));
    process.env.ADMIN_USERS = JSON.stringify({
      users: [
        {
          login: "master@v1-1.local",
          email: "master@v1-1.local",
          displayName: "Master V1.1",
          passwordHash: adminAuth.createPasswordHash("SenhaMasterV11"),
          userType: "MASTER",
          platformScope: true,
        },
      ],
    });

    const adminApi = require(path.join(workspaceRoot, "lib/admin-api.cjs"));
    const masterStore = require(path.join(workspaceRoot, "lib/master-platform-store.cjs"));

    const master = await loginAdmin(adminApi, {
      host: "localhost:3000",
      identifier: "master@v1-1.local",
      password: "SenhaMasterV11",
    });
    assert.equal(master.response.payload?.admin?.userType, "MASTER", "login MASTER deve manter perfil MASTER");
    assert.equal(master.response.payload?.admin?.platformScope, true, "MASTER nao deve depender de restaurante");

    const missingRegistration = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://localhost:3000/api/admin/master/onboard-restaurant",
      host: "localhost:3000",
      cookie: master.cookie,
      ip: "127.0.2.1",
      body: {
        restaurantName: "Cadastro Incompleto",
        slug: "cadastro-incompleto",
        plan: "PRO",
        adminUser: {
          login: "owner@cadastro-incompleto.local",
          email: "owner@cadastro-incompleto.local",
          name: "Owner Incompleto",
          password: "SenhaOwnerV11",
        },
      },
    });
    assert.equal(missingRegistration.statusCode, 400, "cadastro sem campos V1.1 deve falhar");
    assert.equal(missingRegistration.payload?.errorCode, "v1_1_registration_required");

    const onboarding = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://localhost:3000/api/admin/master/onboard-restaurant",
      host: "localhost:3000",
      cookie: master.cookie,
      ip: "127.0.2.2",
      body: restaurantPayload(),
    });
    assert.equal(onboarding.statusCode, 200, "MASTER deve cadastrar restaurante V1.1 completo");
    assert.equal(onboarding.payload?.restaurant?.restaurantKey, "usuarios-a");
    assert.equal(onboarding.payload?.restaurantAdmin?.userType, "OWNER");
    assert.equal(onboarding.payload?.registration?.cnpjMei, "12345678000190");

    const overview = await runAdminApi(adminApi, {
      url: "http://localhost:3000/api/admin/master/overview",
      host: "localhost:3000",
      cookie: master.cookie,
      ip: "127.0.2.3",
    });
    assert.equal(overview.statusCode, 200, "MASTER deve abrir diretorio de usuarios");
    const ownerDirectory = overview.payload?.users?.find((user) => user.login === "owner@usuarios-a.local");
    assert.ok(ownerDirectory, "diretorio Master deve listar OWNER criado");
    assert.ok(ownerDirectory.id, "diretorio deve expor ID como referencia principal");
    assert.equal(ownerDirectory.restaurantName, "Usuarios A");
    assert.equal(ownerDirectory.plan, "PRO");
    assert.equal(ownerDirectory.cnpjMei, "12345678000190");
    assert.ok(
      String(ownerDirectory.searchIndex || "").includes("12345678000190") &&
        String(ownerDirectory.searchIndex || "").includes(ownerDirectory.id),
      "busca deve cobrir ID e CNPJ/MEI"
    );

    const createSupport = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://localhost:3000/api/admin/users/save",
      host: "localhost:3000",
      cookie: master.cookie,
      ip: "127.0.2.4",
      body: {
        user: {
          name: "Suporte INOVAS",
          login: "suporte@v1-1.local",
          email: "suporte@v1-1.local",
          password: "SenhaSuporteV11",
          status: "ACTIVE",
          userScope: "SYSTEM",
          userType: "SUPORTE",
        },
      },
    });
    assert.equal(createSupport.statusCode, 200, "MASTER deve criar usuario do sistema sem restaurante");
    assert.equal(createSupport.payload?.user?.restaurantKey, "", "Usuario do sistema nao deve ter restaurantKey");
    assert.equal(createSupport.payload?.user?.platformScope, true, "Usuario do sistema deve ter platformScope");

    const adminUiSource = await readWorkspaceFile("admin/admin.js");
    assert.ok(
      adminUiSource.includes('{ key: "id", label: "ID"') &&
        adminUiSource.includes('{ key: "name", label: "Nome"') &&
        adminUiSource.includes('{ key: "restaurant", label: "Restaurante"') &&
        adminUiSource.includes('{ key: "plan", label: "Plano"') &&
        adminUiSource.includes('{ key: "profile", label: "Perfil"') &&
        adminUiSource.includes('{ key: "status", label: "Status"') &&
        adminUiSource.includes('{ key: "actions", label: "Acoes"'),
      "UI deve declarar tabela na ordem ID/Nome/Restaurante/Plano/Perfil/Status/Acoes"
    );
    assert.ok(adminUiSource.includes("data-user-sort"), "UI deve expor ordenacao por colunas");
    assert.ok(adminUiSource.includes("data-user-page"), "UI deve expor paginacao");
    assert.ok(adminUiSource.includes("data-user-inline-search"), "UI deve expor busca da tela Usuarios");
    assert.ok(adminUiSource.includes("data-user-scope"), "UI deve expor Tipo de usuario no cadastro");

    const owner = await loginAdmin(adminApi, {
      host: "usuarios-a.localhost",
      identifier: "owner@usuarios-a.local",
      password: "SenhaOwnerV11",
      ip: "127.0.3.1",
    });
    assert.equal(owner.response.payload?.admin?.userType, "OWNER", "OWNER deve autenticar no proprio tenant");
    assert.equal(owner.response.payload?.admin?.restaurantKey, "usuarios-a");

    const ownerList = await runAdminApi(adminApi, {
      url: "http://usuarios-a.localhost/api/admin/users/list",
      host: "usuarios-a.localhost",
      cookie: owner.cookie,
      ip: "127.0.3.2",
    });
    assert.equal(ownerList.statusCode, 200, "OWNER deve listar usuarios do proprio restaurante");
    assert.ok(ownerList.payload?.users?.length >= 1);
    assert.equal(
      ownerList.payload.users.every((user) => user.restaurantKey === "usuarios-a"),
      true,
      "OWNER nao deve enxergar usuarios de outro restaurante ou plataforma"
    );

    const createCashier = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://usuarios-a.localhost/api/admin/users/save",
      host: "usuarios-a.localhost",
      cookie: owner.cookie,
      ip: "127.0.3.3",
      body: {
        user: {
          name: "Caixa Usuarios A",
          login: "caixa@usuarios-a.local",
          email: "caixa@usuarios-a.local",
          phone: "5511999933333",
          password: "SenhaCaixaV11",
          status: "ACTIVE",
          userType: "CAIXA",
          restaurantKey: "usuarios-a",
        },
      },
    });
    assert.equal(createCashier.statusCode, 200, "OWNER deve criar usuario interno do proprio restaurante");
    assert.equal(createCashier.payload?.user?.userType, "CAIXA");
    assert.equal(createCashier.payload?.user?.restaurantKey, "usuarios-a");
    assert.equal(
      createCashier.payload?.user?.effectivePermissions?.financial_view,
      true,
      "perfil CAIXA deve receber permissoes padrao"
    );
    assert.equal(
      createCashier.payload?.user?.effectivePermissions?.users_create,
      false,
      "perfil CAIXA nao deve herdar administracao de usuarios"
    );

    const duplicateCashier = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://usuarios-a.localhost/api/admin/users/save",
      host: "usuarios-a.localhost",
      cookie: owner.cookie,
      ip: "127.0.3.31",
      body: {
        user: {
          name: "Caixa Duplicado",
          login: "caixa-duplicado@usuarios-a.local",
          email: "caixa@usuarios-a.local",
          phone: "5511999933334",
          password: "SenhaCaixaV11",
          status: "ACTIVE",
          userType: "CAIXA",
          restaurantKey: "usuarios-a",
        },
      },
    });
    assert.equal(duplicateCashier.statusCode, 409, "API deve impedir duplicidade de e-mail");
    assert.equal(duplicateCashier.payload?.errorCode, "duplicate_user_email");

    const invalidCashier = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://usuarios-a.localhost/api/admin/users/save",
      host: "usuarios-a.localhost",
      cookie: owner.cookie,
      ip: "127.0.3.32",
      body: {
        user: {
          name: "Caixa Invalido",
          login: "caixa-invalido@usuarios-a.local",
          email: "email-invalido",
          phone: "123",
          password: "123",
          status: "ACTIVE",
          userType: "CAIXA",
          restaurantKey: "usuarios-a",
        },
      },
    });
    assert.equal(invalidCashier.statusCode, 400, "API deve validar e-mail, telefone e senha");

    const editCashier = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://usuarios-a.localhost/api/admin/users/save",
      host: "usuarios-a.localhost",
      cookie: owner.cookie,
      ip: "127.0.3.33",
      body: {
        user: {
          id: createCashier.payload?.user?.id,
          name: "Caixa Usuarios A Editado",
          login: "caixa@usuarios-a.local",
          email: "caixa-editado@usuarios-a.local",
          phone: "5511999944444",
          status: "ACTIVE",
          userType: "CAIXA",
          restaurantKey: "usuarios-a",
        },
      },
    });
    assert.equal(editCashier.statusCode, 200, "OWNER deve editar usuario interno do proprio restaurante");
    assert.equal(editCashier.payload?.user?.name, "Caixa Usuarios A Editado");
    assert.equal(editCashier.payload?.user?.phone, "5511999944444");

    const createManager = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://usuarios-a.localhost/api/admin/users/save",
      host: "usuarios-a.localhost",
      cookie: owner.cookie,
      ip: "127.0.3.34",
      body: {
        user: {
          name: "Gerente Usuarios A",
          login: "gerente@usuarios-a.local",
          email: "gerente@usuarios-a.local",
          phone: "5511999955555",
          password: "SenhaGerenteV11",
          status: "ACTIVE",
          userType: "GERENTE",
          restaurantKey: "usuarios-a",
        },
      },
    });
    assert.equal(createManager.statusCode, 200, "OWNER deve criar GERENTE interno");

    const manager = await loginAdmin(adminApi, {
      host: "usuarios-a.localhost",
      identifier: "gerente@usuarios-a.local",
      password: "SenhaGerenteV11",
      ip: "127.0.3.35",
    });
    const managerWriteDenied = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://usuarios-a.localhost/api/admin/users/save",
      host: "usuarios-a.localhost",
      cookie: manager.cookie,
      ip: "127.0.3.36",
      body: {
        user: {
          name: "Caixa Gerente Indevido",
          login: "caixa-gerente@usuarios-a.local",
          email: "caixa-gerente@usuarios-a.local",
          phone: "5511999966666",
          password: "SenhaCaixaV11",
          status: "ACTIVE",
          userType: "CAIXA",
          restaurantKey: "usuarios-a",
        },
      },
    });
    assert.equal(managerWriteDenied.statusCode, 403, "GERENTE nao deve alterar usuarios via API");
    assert.equal(managerWriteDenied.payload?.errorCode, "user_profile_view_only");

    const createMasterDenied = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://usuarios-a.localhost/api/admin/users/save",
      host: "usuarios-a.localhost",
      cookie: owner.cookie,
      ip: "127.0.3.4",
      body: {
        user: {
          name: "Master Indevido",
          login: "master-indevido@usuarios-a.local",
          email: "master-indevido@usuarios-a.local",
          phone: "5511999977777",
          password: "SenhaMasterIndevida",
          status: "ACTIVE",
          userType: "MASTER",
          restaurantKey: "usuarios-a",
        },
      },
    });
    assert.equal(createMasterDenied.statusCode, 403, "OWNER nao deve criar MASTER");
    assert.ok(
      ["owner_cannot_manage_platform_user", "system_user_hierarchy_denied"].includes(
        createMasterDenied.payload?.errorCode
      ),
      "OWNER deve continuar bloqueado ao tentar criar usuario de plataforma"
    );

    const createOtherTenantDenied = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://usuarios-a.localhost/api/admin/users/save",
      host: "usuarios-a.localhost",
      cookie: owner.cookie,
      ip: "127.0.3.5",
      body: {
        user: {
          name: "Caixa Outro Tenant",
          login: "caixa@outro-tenant.local",
          email: "caixa@outro-tenant.local",
          phone: "5511999988888",
          password: "SenhaCaixaOutro",
          status: "ACTIVE",
          userType: "CAIXA",
          restaurantKey: "outro-tenant",
        },
      },
    });
    assert.equal(createOtherTenantDenied.statusCode, 403, "OWNER nao deve criar usuario em outro restaurante");
    assert.equal(createOtherTenantDenied.payload?.errorCode, "owner_restaurant_scope_denied");

    const blockCashier = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://usuarios-a.localhost/api/admin/users/status",
      host: "usuarios-a.localhost",
      cookie: owner.cookie,
      ip: "127.0.3.6",
      body: {
        login: "caixa@usuarios-a.local",
        status: "BLOCKED",
      },
    });
    assert.equal(blockCashier.statusCode, 200, "OWNER deve bloquear usuario interno");
    assert.equal(blockCashier.payload?.user?.status, "BLOCKED");

    const unblockCashier = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://usuarios-a.localhost/api/admin/users/status",
      host: "usuarios-a.localhost",
      cookie: owner.cookie,
      ip: "127.0.3.7",
      body: {
        login: "caixa@usuarios-a.local",
        status: "ACTIVE",
      },
    });
    assert.equal(unblockCashier.statusCode, 200, "OWNER deve desbloquear usuario interno");
    assert.equal(unblockCashier.payload?.user?.status, "ACTIVE");

    const deleteCashier = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://usuarios-a.localhost/api/admin/users/delete",
      host: "usuarios-a.localhost",
      cookie: owner.cookie,
      ip: "127.0.3.8",
      body: {
        login: "caixa@usuarios-a.local",
      },
    });
    assert.equal(deleteCashier.statusCode, 200, "OWNER deve excluir usuario interno");
    assert.equal(
      deleteCashier.payload?.users?.some((user) => user.login === "caixa@usuarios-a.local"),
      false,
      "usuario excluido nao deve permanecer na lista"
    );

    const deleteManager = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://usuarios-a.localhost/api/admin/users/delete",
      host: "usuarios-a.localhost",
      cookie: owner.cookie,
      ip: "127.0.3.9",
      body: {
        login: "gerente@usuarios-a.local",
      },
    });
    assert.equal(deleteManager.statusCode, 200, "OWNER deve excluir GERENTE interno");

    await validateUsersBrowser(adminApi);

    const originalMode = process.env.INOVAS_TENANT_MODE;
    process.env.INOVAS_TENANT_MODE = "default_only";
    const defaultOnlyResolution = await masterStore.resolveRestaurantByHost("usuarios-a.localhost");
    assert.equal(defaultOnlyResolution.restaurantKey, "default", "default_only deve manter Tokyo/default");
    assert.equal(defaultOnlyResolution.multiRestaurantActive, false, "pilot nao deve ficar ativo em default_only");
    process.env.INOVAS_TENANT_MODE = originalMode;

    const afterRealData = await getDirectoryFingerprint(realDataDirectory);
    assert.deepEqual(afterRealData, beforeRealData, "validacao V1.1 nao deve tocar .data real");

    console.log("validate:v1-1-users-local OK");
  } finally {
    process.chdir(originalCwd);
    restoreEnvironment(originalEnv);
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
