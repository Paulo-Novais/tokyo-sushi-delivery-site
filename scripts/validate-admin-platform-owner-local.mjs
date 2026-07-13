import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
      "user-agent": "admin-platform-owner-validation",
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

const run = async () => {
  const originalCwd = process.cwd();
  const originalEnv = {
    ADMIN_LOGIN: process.env.ADMIN_LOGIN,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
    ADMIN_USERS: process.env.ADMIN_USERS,
    ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
    NODE_ENV: process.env.NODE_ENV,
    INOVAS_TENANT_MODE: process.env.INOVAS_TENANT_MODE,
  };
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tokyo-admin-platform-owner-"));

  try {
    await fs.mkdir(path.join(tempRoot, ".data"), { recursive: true });
    process.chdir(tempRoot);
    process.env.NODE_ENV = "development";
    process.env.INOVAS_TENANT_MODE = "default_only";
    process.env.ADMIN_SESSION_SECRET = "admin-platform-owner-local-secret";
    delete process.env.ADMIN_LOGIN;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_PASSWORD_HASH;
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;

    const adminAuth = require(path.join(workspaceRoot, "lib/admin-auth.cjs"));
    process.env.ADMIN_USERS = JSON.stringify([
      {
        login: "usermaster@gmail.com",
        displayName: "Master INOVAS Food",
        passwordHash: adminAuth.createPasswordHash("novais96"),
        userType: "MASTER",
        platformScope: true,
      },
      {
        login: "paulo.novais96@gmail.com",
        displayName: "Owner Tokyo Sushi",
        passwordHash: adminAuth.createPasswordHash("senha-owner-local"),
        userType: "OWNER",
        restaurantKey: "default",
        tenantId: "tenant_default",
        restaurantId: "restaurant_default",
      },
    ]);
    await fs.writeFile(
      path.join(tempRoot, ".data", "admin-users.json"),
      JSON.stringify(
        {
          version: 1,
          users: [
            {
              id: "legacy_fabianepv_outlook_com",
              login: "fabianepv@outlook.com",
              email: "fabianepv@outlook.com",
              name: "Fabiane legado",
              passwordHash: adminAuth.createPasswordHash("senha-fabiane-local"),
              status: "ACTIVE",
              userType: "MASTER",
              restaurantKey: "default",
              tenantId: "tenant_default",
              restaurantId: "restaurant_default",
              permissions: {},
              source: "legacy_env",
            },
          ],
        },
        null,
        2
      )
    );

    const adminApi = require(path.join(workspaceRoot, "lib/admin-api.cjs"));
    const { getConfiguredAdminUsers } = adminAuth;

    const configuredUsers = getConfiguredAdminUsers();
    assert.equal(configuredUsers.length, 2, "ADMIN_USERS deve conter apenas MASTER e OWNER");
    assert.equal(
      configuredUsers.some((user) => user.login === "fabianepv@outlook.com"),
      false,
      "Fabiane nao deve permanecer em ADMIN_USERS"
    );

    const removedLegacyLogin = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://localhost:3000/api/admin/login",
      body: {
        identifier: "fabianepv@outlook.com",
        password: "senha-fabiane-local",
      },
    });

    assert.equal(
      removedLegacyLogin.statusCode,
      401,
      "usuario legacy_env removido de ADMIN_USERS nao deve autenticar"
    );

    const masterLogin = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://localhost:3000/api/admin/login",
      body: {
        identifier: "usermaster@gmail.com",
        password: "novais96",
      },
    });

    assert.equal(masterLogin.statusCode, 200, "MASTER deve autenticar");
    assert.equal(masterLogin.payload?.admin?.userType, "MASTER", "MASTER deve manter tipo MASTER");
    assert.equal(masterLogin.payload?.admin?.platformScope, true, "MASTER deve ser escopo plataforma");
    assert.equal(masterLogin.payload?.admin?.restaurantKey, "", "MASTER nao deve pertencer ao restaurante");
    const masterCookie = extractCookieHeader(masterLogin);
    assert.ok(masterCookie, "login MASTER deve emitir cookie");

    const masterPanel = await runAdminApi(adminApi, {
      url: "http://localhost:3000/api/admin/master/overview",
      cookie: masterCookie,
    });

    assert.equal(masterPanel.statusCode, 200, "MASTER deve acessar Painel Master");
    const syncedLocalStore = JSON.parse(
      await fs.readFile(path.join(tempRoot, ".data", "admin-users.json"), "utf8")
    );
    assert.equal(
      syncedLocalStore.users.some((user) => user.login === "fabianepv@outlook.com"),
      false,
      "store local nao deve manter usuario legacy_env removido"
    );

    const ownerLogin = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://localhost:3000/api/admin/login",
      body: {
        identifier: "paulo.novais96@gmail.com",
        password: "senha-owner-local",
      },
    });

    assert.equal(ownerLogin.statusCode, 200, "OWNER deve autenticar");
    assert.equal(ownerLogin.payload?.admin?.userType, "OWNER", "Paulo deve ser OWNER");
    assert.equal(ownerLogin.payload?.admin?.restaurantKey, "default", "OWNER deve pertencer ao Tokyo/default");
    assert.equal(ownerLogin.payload?.admin?.platformScope, false, "OWNER nao deve ser plataforma");
    assert.equal(
      ownerLogin.payload?.admin?.permissions?.orders_view,
      true,
      "OWNER deve administrar pedidos do Tokyo"
    );
    const ownerCookie = extractCookieHeader(ownerLogin);
    assert.ok(ownerCookie, "login OWNER deve emitir cookie");

    const ownerOrders = await runAdminApi(adminApi, {
      url: "http://localhost:3000/api/admin/orders/list?limit=1",
      cookie: ownerCookie,
    });

    assert.equal(ownerOrders.statusCode, 200, "OWNER deve acessar pedidos do Tokyo");

    const ownerMasterPanel = await runAdminApi(adminApi, {
      url: "http://localhost:3000/api/admin/master/overview",
      cookie: ownerCookie,
    });

    assert.equal(ownerMasterPanel.statusCode, 403, "OWNER nao deve acessar Painel Master");
    assert.equal(
      ownerMasterPanel.payload?.errorCode,
      "master_access_required",
      "bloqueio do Painel Master deve exigir MASTER"
    );

    console.log("Validacao local MASTER plataforma e OWNER Tokyo concluida com sucesso.");
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
