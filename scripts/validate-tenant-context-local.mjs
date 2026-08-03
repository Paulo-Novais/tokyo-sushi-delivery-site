import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const realDataDirectory = path.join(workspaceRoot, ".data");

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

const buildReq = ({ method = "GET", url = "http://localhost/api/catalog", host = "tokyosushidelivery.com.br", body = "", cookie = "" } = {}) => ({
  method,
  url,
  headers: {
    host,
    "x-forwarded-host": host,
    "x-forwarded-proto": host.includes("localhost") ? "http" : "https",
    origin: host.includes("localhost") ? "http://localhost" : `https://${host}`,
    referer: host.includes("localhost") ? "http://localhost/" : `https://${host}/`,
    "content-type": "application/json",
    ...(cookie ? { cookie } : {}),
  },
  body,
});

const runApi = async (handler, req) => {
  const res = buildMockResponse();

  await handler(req, res);
  return res;
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

const validateTenantResolver = async (tenantContext) => {
  const current = await tenantContext.getRequestTenantContext(
    buildReq({ url: "https://tokyosushidelivery.com.br/api/catalog" }),
    { source: "test:current" }
  );
  const simulation = await tenantContext.getRequestTenantContext(
    buildReq({ url: "https://pizzariadojoao.com.br/api/catalog", host: "pizzariadojoao.com.br" }),
    { source: "test:simulation" }
  );
  const unknown = await tenantContext.getRequestTenantContext(
    buildReq({ url: "https://desconhecido.example/api/catalog", host: "desconhecido.example" }),
    { source: "test:unknown" }
  );

  [current, simulation, unknown].forEach((context) => {
    assert.equal(context.tenantMode, "default_only");
    assert.equal(context.restaurantKey, "default");
    assert.equal(context.legacyRestaurantKey, "default");
    assert.equal(context.multiRestaurantActive, false);
    assert.equal(context.fallbackRestaurantKey, "default");
  });

  assert.equal(current.matchedDomain, true);
  assert.equal(simulation.matchedDomain, true);
  assert.equal(unknown.matchedDomain, false);

  const serialized = tenantContext.serializeTenantContext(current);
  assert.equal(serialized.restaurantKey, "default");
  assert.equal(serialized.defaultOnly, true);
  assert.equal(Object.prototype.hasOwnProperty.call(serialized, "domain"), false);
};

const validatePublicApis = async ({ catalogApi, deliveryApi, restaurantApi }) => {
  const catalog = await runApi(catalogApi, buildReq({ url: "https://tokyosushidelivery.com.br/api/catalog" }));
  assert.equal(catalog.statusCode, 200);
  assert.equal(catalog.payload?.tenantContext?.restaurantKey, "default");
  assert.equal(catalog.payload?.tenantContext?.defaultOnly, true);

  const reviews = await runApi(
    catalogApi,
    buildReq({ url: "https://tokyosushidelivery.com.br/api/catalog?publicView=reviews" })
  );
  assert.equal(reviews.statusCode, 200);
  assert.equal(reviews.payload?.tenantContext?.restaurantKey, "default");

  const delivery = await runApi(
    deliveryApi,
    buildReq({ url: "https://tokyosushidelivery.com.br/api/delivery-settings" })
  );
  assert.equal(delivery.statusCode, 200);
  assert.equal(delivery.payload?.tenantContext?.restaurantKey, "default");

  const restaurant = await runApi(
    restaurantApi,
    buildReq({ url: "https://tokyosushidelivery.com.br/api/restaurant-settings" })
  );
  assert.equal(restaurant.statusCode, 200);
  assert.equal(restaurant.payload?.tenantContext?.restaurantKey, "default");
};

const validateAdminApi = async ({ adminApi, adminAuth }) => {
  const platformHost = "inovasfood.com.br";
  const login = await runApi(
    adminApi,
    buildReq({
      method: "POST",
      url: `https://${platformHost}/api/admin/login`,
      host: platformHost,
      body: JSON.stringify({
        identifier: "usermaster@inovas.com",
        password: "novais753951",
        next: "/admin/",
      }),
    })
  );

  assert.equal(login.statusCode, 200, "Login admin deveria funcionar.");
  assert.equal(login.payload?.admin?.userScope, "SYSTEM");
  assert.equal(login.payload?.admin?.platformScope, true);
  assert.equal(login.payload?.admin?.restaurantKey, "");
  assert.equal(login.payload?.admin?.tenantContext, undefined);

  const cookie = String(login.headers["Set-Cookie"] || "")
    .split(";")[0]
    .trim();
  assert.ok(cookie, "Login admin deveria emitir cookie.");

  const orders = await runApi(
    adminApi,
    buildReq({
      url: `https://${platformHost}/api/admin/orders/list`,
      host: platformHost,
      cookie,
    })
  );
  assert.ok(
    [401, 403].includes(orders.statusCode),
    "Sessao System nao deve acessar API operacional de restaurante."
  );
  assert.equal(
    adminAuth.getAdminSessionFromCookieHeader(cookie),
    null,
    "Cookie System nao deve ser aceito pelo leitor de sessao Restaurant legado."
  );
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
    ALLOWED_PUBLIC_ORIGINS: process.env.ALLOWED_PUBLIC_ORIGINS,
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
    INOVAS_TENANT_MODE: process.env.INOVAS_TENANT_MODE,
    NODE_ENV: process.env.NODE_ENV,
  };
  const beforeRealData = await getDirectoryFingerprint(realDataDirectory);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tokyo-tenant-context-"));

  try {
    await fs.mkdir(path.join(tempRoot, ".data"), { recursive: true });
    await fs.copyFile(path.join(workspaceRoot, "script.js"), path.join(tempRoot, "script.js"));
    process.chdir(tempRoot);
    process.env.NODE_ENV = "development";
    process.env.INOVAS_TENANT_MODE = "default_only";
    process.env.ALLOWED_PUBLIC_ORIGINS = "https://tokyosushidelivery.com.br";
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.ADMIN_USERS;
    delete process.env.ADMIN_PASSWORD;

    const adminAuth = require(path.join(workspaceRoot, "lib/admin-auth.cjs"));

    process.env.ADMIN_LOGIN = "usermaster@inovas.com";
    process.env.ADMIN_PASSWORD_HASH = adminAuth.createPasswordHash("novais753951");
    process.env.ADMIN_DISPLAY_NAME = "Master INOVAS Food";
    process.env.ADMIN_SESSION_SECRET = "segredo-local-tenant-context";

    const tenantContext = require(path.join(workspaceRoot, "lib/tenant-context.cjs"));
    const catalogApi = require(path.join(workspaceRoot, "api/catalog.js"));
    const deliveryApi = catalogApi;
    const restaurantApi = catalogApi;
    const adminApi = require(path.join(workspaceRoot, "lib/admin-api.cjs"));

    await validateTenantResolver(tenantContext);
    await validatePublicApis({ catalogApi, deliveryApi, restaurantApi });
    await validateAdminApi({ adminApi, adminAuth });

    const afterRealData = await getDirectoryFingerprint(realDataDirectory);
    assert.deepEqual(afterRealData, beforeRealData, "Validacao de tenant nao deve alterar .data real.");

    console.log("Validacao local de TenantContext concluida com sucesso.");
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
