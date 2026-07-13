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

const validateApi = async (adminApi) => {
  const masterLogin = await runAdminApi(adminApi, {
    method: "POST",
    url: "http://localhost:3000/api/admin/login",
    body: {
      identifier: "usermaster@inovas.com",
      password: "novais753951",
      next: "/admin/master.html",
    },
  });

  assert.equal(masterLogin.statusCode, 200, "MASTER deve autenticar com login existente.");
  assert.equal(masterLogin.payload?.admin?.tipo_usuario, "MASTER", "login padrao deve ser MASTER.");
  const masterCookie = extractCookieHeader(masterLogin);

  assert.ok(masterCookie, "login MASTER deve emitir cookie.");

  const overview = await runAdminApi(adminApi, {
    url: "http://localhost:3000/api/admin/master/overview",
    cookie: masterCookie,
  });

  assert.equal(overview.statusCode, 200, "MASTER deve acessar /api/admin/master/overview.");
  assert.equal(overview.payload?.restaurantKey, "default", "Painel Master deve manter restaurant_key default.");
  assert.equal(overview.payload?.futureArchitecture?.multiRestaurantActive, false);
  assert.equal(overview.payload?.restaurants?.[0]?.status, "CLIENTE_MODELO");
  assert.equal(overview.payload?.restaurants?.[0]?.restaurantKey, "default");
  assert.ok(
    overview.payload?.plans?.some((plan) => plan.key === "START") &&
      overview.payload?.plans?.some((plan) => plan.key === "PRO") &&
      overview.payload?.plans?.some((plan) => plan.key === "PREMIUM"),
    "planos START, PRO e PREMIUM devem existir."
  );
  assert.equal(
    overview.payload?.restaurantFeatureFlags?.default?.whatsappAI,
    false,
    "whatsappAI deve existir como flag preparada."
  );
  assert.ok(
    overview.payload?.resources?.some((resource) => resource.key === "finance") &&
      overview.payload?.resources?.some((resource) => resource.key === "whatsappAI"),
    "recursos comerciais devem ser expostos no Painel Master."
  );
  assert.equal(
    overview.payload?.commercialAccess?.planKey,
    "PREMIUM",
    "Tokyo Sushi deve estar no contrato PREMIUM."
  );

  const customSave = await runAdminApi(adminApi, {
    method: "POST",
    url: "http://localhost:3000/api/admin/users/save",
    cookie: masterCookie,
    body: {
      user: {
        name: "Operador Master Negado",
        login: "operador.master.negado",
        email: "operador.master.negado@teste.local",
        password: "senha-custom",
        status: "ACTIVE",
        userType: "CUSTOM",
        permissions: {
          dashboard_view: true,
        },
      },
    },
  });

  assert.equal(customSave.statusCode, 200, "MASTER deve criar usuario CUSTOM para teste.");

  const customLogin = await runAdminApi(adminApi, {
    method: "POST",
    url: "http://localhost:3000/api/admin/login",
    body: {
      identifier: "operador.master.negado",
      password: "senha-custom",
      next: "/admin/master.html",
    },
  });

  assert.equal(customLogin.statusCode, 200, "CUSTOM ativo deve autenticar.");
  const customCookie = extractCookieHeader(customLogin);
  const forbiddenMaster = await runAdminApi(adminApi, {
    url: "http://localhost:3000/api/admin/master/overview",
    cookie: customCookie,
  });

  assert.equal(forbiddenMaster.statusCode, 403, "CUSTOM nao deve acessar Painel Master.");
  assert.equal(forbiddenMaster.payload?.errorCode, "master_access_required");
};

const validateBrowser = async (adminApi) => {
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
    await waitForCondition(
      async () => (await page.locator("[data-admin-login-form]").count()) === 1,
      "Login administrativo deveria carregar."
    );
    await page.locator('input[name="identifier"]').fill("usermaster@inovas.com");
    await page.locator('input[name="password"]').fill("novais753951");
    await page.locator("[data-admin-login-submit]").click();

    await waitForCondition(
      async () =>
        (await page.evaluate(() => document.body.dataset.adminPage).catch(() => "")) === "master" &&
        (await page.evaluate(() => document.body.dataset.masterSection).catch(() => "")) === "dashboard",
      "Login MASTER deveria abrir o Painel Master."
    );

    await waitForText(page, "body", "Painel Master", "Painel Master deveria renderizar o titulo.");
    await waitForText(page, "body", "Dashboard Geral", "Dashboard Geral deveria aparecer.");
    await waitForText(page, "body", "Restaurantes", "Menu de restaurantes deveria aparecer.");
    await waitForText(page, "body", "Planos", "Menu de planos deveria aparecer.");
    await waitForText(page, "body", "Recursos", "Menu de recursos deveria aparecer.");

    await page.locator('[data-master-section-button="restaurants"]').click();
    await waitForCondition(
      async () => (await page.evaluate(() => document.body.dataset.masterSection)) === "restaurants",
      "Menu Restaurantes deveria ativar a secao."
    );
    await waitForText(page, "[data-master-content]", "Tokyo Sushi", "Tokyo Sushi deveria existir como Cliente Modelo.");
    await waitForText(page, "[data-master-content]", "Cliente Modelo", "Status Cliente Modelo deveria aparecer.");

    await page.locator('[data-master-section-button="plans"]').click();
    await waitForText(page, "[data-master-content]", "START", "Plano START deveria aparecer.");
    await waitForText(page, "[data-master-content]", "PRO", "Plano PRO deveria aparecer.");
    await waitForText(page, "[data-master-content]", "PREMIUM", "Plano PREMIUM deveria aparecer.");

    await page.locator('[data-master-section-button="resources"]').click();
    await waitForText(page, "[data-master-content]", "finance", "Recurso financeiro deveria aparecer.");
    await waitForText(page, "[data-master-content]", "whatsappAI", "Recurso futuro WhatsApp AI deveria aparecer.");

    await page.locator('[data-master-section-button="domains"]').click();
    await waitForText(page, "[data-master-content]", "Dominio principal", "Modulo Dominios deveria renderizar.");

    await page.locator('[data-master-section-button="developer"]').click();
    await waitForText(page, "[data-master-content]", "validate:master-panel-local", "Area tecnica deveria listar a nova validacao.");
    await waitForText(page, "[data-master-content]", "whatsappAI", "Area tecnica deveria listar feature flags.");

    assert.deepEqual(consoleErrors, [], "Painel Master nao deveria emitir erros no console.");
    assert.deepEqual(pageErrors, [], "Painel Master nao deveria disparar erros de execucao.");
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
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tokyo-master-panel-validation-"));

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
    process.env.ADMIN_DISPLAY_NAME = "Master INOVAS Food";
    process.env.ADMIN_SESSION_SECRET = "segredo-local-master-panel";

    const adminApi = require(path.join(workspaceRoot, "lib/admin-api.cjs"));

    await validateApi(adminApi);
    await validateBrowser(adminApi);

    const masterStore = JSON.parse(
      await fs.readFile(path.join(tempRoot, ".data", "master-platform.json"), "utf8")
    );

    assert.equal(masterStore.restaurantKey, "default", "store Master deve manter restaurantKey default.");
    assert.equal(masterStore.restaurants[0].restaurantKey, "default");
    assert.equal(masterStore.restaurants[0].status, "CLIENTE_MODELO");

    const afterRealData = await getDirectoryFingerprint(realDataDirectory);
    assert.deepEqual(afterRealData, beforeRealData, "Validacao Master nao deve alterar .data real.");

    console.log("Validacao local do Painel Master concluida com sucesso.");
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
