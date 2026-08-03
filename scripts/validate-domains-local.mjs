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

const EXPECTED_DOMAINS = [
  "tokyosushidelivery.com.br",
  "pizzariadojoao.com.br",
  "burguerprime.com.br",
];

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

const createStaticServer = (rootDirectory, adminApi, systemAuthApi, systemApi) =>
  http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || "/", "http://127.0.0.1");

      if (requestUrl.pathname.startsWith("/api/admin")) {
        await handleAdminApiRequest(adminApi, req, res);
        return;
      }

      if (requestUrl.pathname.startsWith("/api/auth/system")) {
        await handleAdminApiRequest(systemAuthApi, req, res);
        return;
      }

      if (requestUrl.pathname.startsWith("/api/system")) {
        await handleAdminApiRequest(systemApi, req, res);
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

      if (pathname === "/system" || pathname === "/system/") {
        pathname = "/system/index.html";
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

const validateStaticContracts = async () => {
  const siteConfig = JSON.parse(await fs.readFile(path.join(workspaceRoot, "site.config.json"), "utf8"));
  const masterStoreSource = await fs.readFile(path.join(workspaceRoot, "lib", "master-platform-store.cjs"), "utf8");

  assert.equal(siteConfig.primaryDomain, "tokyosushidelivery.com.br", "Dominio atual do Tokyo Sushi nao deve mudar.");
  assert.equal(siteConfig.companyWebsite, "https://tokyosushidelivery.com.br");
  assert.ok(masterStoreSource.includes("tenantId"), "Store de dominios deve manter tenantId fisico.");
  assert.ok(masterStoreSource.includes("restaurantId"), "Store de dominios deve manter restaurantId fisico.");
};

const validateDomainModel = async (masterStore) => {
  const snapshot = await masterStore.getMasterPlatformSnapshot();
  const domains = snapshot.domains || [];
  const hosts = domains.map((domain) => domain.domain || domain.customDomain || domain.primaryDomain);

  EXPECTED_DOMAINS.forEach((domain) => {
    assert.ok(hosts.includes(domain), `Dominio ${domain} deveria estar cadastrado/simulado.`);
  });

  assert.equal(snapshot.restaurantKey, "default");
  assert.equal(snapshot.domainResolver.activeMode, "default_only");
  assert.equal(snapshot.domainResolver.dnsIntegrated, false);
  assert.equal(snapshot.domainResolver.sslIntegrated, false);
  assert.equal(snapshot.futureArchitecture.preparedForCustomDomains, true);
  assert.equal(snapshot.futureArchitecture.multiRestaurantActive, false);

  domains.forEach((domain) => {
    assert.equal(domain.restaurantKey, "default", `Dominio ${domain.domain} deve preservar restaurant_key default.`);
    assert.ok(domain.status, `Dominio ${domain.domain} deve possuir status.`);
    assert.ok(domain.sslStatus, `Dominio ${domain.domain} deve possuir sslStatus.`);
    assert.ok(domain.ssl_status, `Dominio ${domain.domain} deve expor ssl_status.`);
    assert.ok(domain.createdAt, `Dominio ${domain.domain} deve possuir data de criacao.`);
    assert.ok(domain.created_at, `Dominio ${domain.domain} deve expor created_at.`);
    assert.ok(domain.observations || domain.notes, `Dominio ${domain.domain} deve possuir observacoes.`);
  });

  const current = await masterStore.resolveRestaurantByHost("https://tokyosushidelivery.com.br/cardapio.html");
  const pizza = await masterStore.resolveRestaurantByHost("pizzariadojoao.com.br");
  const burger = await masterStore.resolveRestaurantByHost("www.burguerprime.com.br");
  const unknown = await masterStore.resolveRestaurantByHost("restaurante-nao-cadastrado.test");

  [current, pizza, burger, unknown].forEach((resolution) => {
    assert.equal(resolution.restaurantKey, "default");
    assert.equal(resolution.multiRestaurantActive, false);
    assert.equal(resolution.resolutionMode, "default_only");
    assert.equal(resolution.dnsIntegrated, false);
    assert.equal(resolution.sslIntegrated, false);
  });

  assert.equal(current.matched, true);
  assert.equal(pizza.matched, true);
  assert.equal(burger.matched, true);
  assert.equal(unknown.matched, false);
};

const validateDomainApi = async (adminApi) => {
  const masterLogin = await runAdminApi(adminApi, {
    method: "POST",
    url: "http://localhost:3000/api/admin/login",
    body: {
      identifier: "usermaster@inovas.com",
      password: "novais753951",
      next: "/admin/master.html",
    },
  });

  assert.equal(masterLogin.statusCode, 200, "MASTER deve autenticar.");
  const masterCookie = extractCookieHeader(masterLogin);
  assert.ok(masterCookie, "MASTER deve receber cookie.");

  const overview = await runAdminApi(adminApi, {
    url: "http://localhost:3000/api/admin/master/domains",
    cookie: masterCookie,
  });

  assert.equal(overview.statusCode, 200, "MASTER deve acessar API Master de dominios.");
  assert.equal(overview.payload?.activeModule, "domains");
  assert.equal(overview.payload?.restaurantKey, "default");
  assert.equal(overview.payload?.domains?.length >= 3, true);
  assert.ok(
    overview.payload.domains.some((domain) => domain.customDomain === "pizzariadojoao.com.br"),
    "API Master deve expor pizzariadojoao.com.br como simulacao."
  );
  assert.ok(
    overview.payload.domains.some((domain) => domain.customDomain === "burguerprime.com.br"),
    "API Master deve expor burguerprime.com.br como simulacao."
  );

  const ownerCreate = await runAdminApi(adminApi, {
    method: "POST",
    url: "http://localhost:3000/api/admin/users/save",
    cookie: masterCookie,
    body: {
      user: {
        name: "Owner Dominios Negado",
        login: "owner.dominios.negado",
        email: "owner.dominios.negado@teste.local",
        phone: "5511999913131",
        password: "senha-owner",
        status: "ACTIVE",
        userType: "OWNER",
      },
    },
  });

  assert.equal(
    ownerCreate.statusCode,
    403,
    "SystemSession nao deve criar usuario no dominio operacional sem suporte"
  );
  assert.equal(
    ownerCreate.payload?.errorCode,
    "system_session_not_tenant_session",
    "criacao operacional deve exigir RestaurantSession ou SupportSession"
  );
};

const validateDomainBrowser = async (adminApi, systemAuthApi, systemApi) => {
  const server = createStaticServer(
    workspaceRoot,
    adminApi,
    systemAuthApi,
    systemApi
  );
  const { port } = await listen(server);
  const baseURL = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 960 } });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));

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
        (await page.locator("[data-system-app] h1").textContent().catch(() => ""))
          .includes("INOVAS"),
      "MASTER deveria abrir o Painel System."
    );

    const contentText = (await page.locator("[data-system-app]").textContent()) || "";
    assert.ok(
      contentText.includes("Fronteira System ativa"),
      "Painel System deveria declarar a fronteira sem tenant."
    );
    assert.ok(
      contentText.includes("Tokyo Sushi"),
      "Painel System deveria carregar a saude agregada do restaurante."
    );

    assert.deepEqual(consoleErrors, [], "Painel de dominios nao deveria emitir erros no console.");
    assert.deepEqual(pageErrors, [], "Painel de dominios nao deveria disparar erros de execucao.");

    await context.close();
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
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tokyo-domains-validation-"));

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
    process.env.ADMIN_SESSION_SECRET = "segredo-local-dominios";

    const masterStore = require(path.join(workspaceRoot, "lib/master-platform-store.cjs"));
    const adminApi = require(path.join(workspaceRoot, "lib/admin-api.cjs"));
    const systemAuthApi = require(path.join(workspaceRoot, "api/auth/system/[...action].js"));
    const systemApi = require(path.join(workspaceRoot, "lib/system-api.cjs"));

    await validateStaticContracts();
    await validateDomainModel(masterStore);
    await validateDomainApi(adminApi);
    await validateDomainBrowser(adminApi, systemAuthApi, systemApi);

    const persistedStore = JSON.parse(
      await fs.readFile(path.join(tempRoot, ".data", "master-platform.json"), "utf8")
    );

    assert.equal(persistedStore.restaurantKey, "default");
    assert.ok(
      persistedStore.domains.some((domain) => domain.customDomain === "pizzariadojoao.com.br"),
      "Store temporario deve conter dominio ficticio pizzariadojoao.com.br."
    );
    assert.ok(
      persistedStore.domains.some((domain) => domain.customDomain === "burguerprime.com.br"),
      "Store temporario deve conter dominio ficticio burguerprime.com.br."
    );

    const afterRealData = await getDirectoryFingerprint(realDataDirectory);
    assert.deepEqual(afterRealData, beforeRealData, "Validacao de dominios nao deve alterar .data real.");

    console.log("Validacao local de dominios concluida com sucesso.");
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
