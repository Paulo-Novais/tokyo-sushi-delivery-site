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
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_DISPLAY_NAME: process.env.ADMIN_DISPLAY_NAME,
    ADMIN_USERS: process.env.ADMIN_USERS,
    ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
  };
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tokyo-permissions-validation-"));

  try {
    await fs.mkdir(path.join(tempRoot, ".data"), { recursive: true });
    process.chdir(tempRoot);
    process.env.NODE_ENV = "development";
    delete process.env.DATABASE_URL;
    delete process.env.ADMIN_USERS;
    delete process.env.ADMIN_PASSWORD;

    const adminAuth = require(path.join(workspaceRoot, "lib/admin-auth.cjs"));

    process.env.ADMIN_LOGIN = "usermaster@inovas.com";
    process.env.ADMIN_PASSWORD_HASH = adminAuth.createPasswordHash("novais753951");
    process.env.ADMIN_DISPLAY_NAME = "Master INOVAS Food";
    process.env.ADMIN_SESSION_SECRET = "segredo-local-de-permissoes";
    process.env.ADMIN_USERS = JSON.stringify([
      {
        login: "usermaster@inovas.com",
        displayName: "Master INOVAS Food",
        passwordHash: adminAuth.createPasswordHash("novais753951"),
        userType: "MASTER",
        platformScope: true,
      },
      {
        login: "owner@default.local",
        displayName: "Owner Default",
        passwordHash: adminAuth.createPasswordHash("senha-owner-default"),
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
          restaurantKey: "default",
          preparedForFutureRestaurantAssociation: true,
          users: [
            {
              id: "legacy_master_local",
              restaurantKey: "default",
              name: "Master Antigo",
              login: "master.local",
              email: "master.local@teste.local",
              passwordHash: adminAuth.createPasswordHash("senha-master"),
              status: "ACTIVE",
              userType: "MASTER",
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

    const legacyLogin = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://localhost:3000/api/admin/login",
      body: {
        identifier: "master.local",
        password: "senha-master",
        next: "/admin/",
      },
    });

    assert.equal(legacyLogin.statusCode, 401, "login Master antigo nao deve autenticar");
    assert.equal(legacyLogin.payload?.errorCode, "invalid_credentials");

    const masterLogin = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://localhost:3000/api/admin/login",
      body: {
        identifier: "usermaster@inovas.com",
        password: "novais753951",
        next: "/admin/",
      },
    });

    assert.equal(masterLogin.statusCode, 200, "novo login Master deve autenticar");
    assert.equal(masterLogin.payload?.admin?.tipo_usuario, "MASTER", "novo usuario Master deve ser MASTER");
    assert.equal(
      masterLogin.payload?.admin?.permissions?.users_view,
      false,
      "MASTER nao deve receber permissao operacional de usuarios"
    );

    const masterCookie = extractCookieHeader(masterLogin);
    assert.ok(masterCookie, "login MASTER deve emitir cookie de sessao");

    const masterSession = await runAdminApi(adminApi, {
      url: "http://localhost:3000/api/admin/session",
      cookie: masterCookie,
    });

    assert.equal(masterSession.statusCode, 200, "sessao MASTER deve ser valida");
    assert.equal(masterSession.payload?.authenticated, true, "sessao MASTER deve autenticar");
    assert.equal(masterSession.payload?.admin?.userType, "MASTER", "sessao deve expor tipo MASTER");

    const usersBefore = await runAdminApi(adminApi, {
      url: "http://localhost:3000/api/admin/users/list",
      cookie: masterCookie,
    });

    assert.equal(usersBefore.statusCode, 403, "MASTER nao deve usar a rota operacional de usuarios");
    assert.equal(usersBefore.payload?.errorCode, "system_session_not_tenant_session");

    const ownerLogin = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://localhost:3000/api/admin/login",
      body: {
        identifier: "owner@default.local",
        password: "senha-owner-default",
        next: "/admin/",
      },
    });
    assert.equal(ownerLogin.statusCode, 200, "OWNER default deve autenticar");
    const ownerCookie = extractCookieHeader(ownerLogin);
    assert.ok(ownerCookie, "login OWNER deve emitir cookie de sessao");

    const restaurantUsersBefore = await runAdminApi(adminApi, {
      url: "http://localhost:3000/api/admin/users/list",
      cookie: ownerCookie,
    });

    assert.equal(restaurantUsersBefore.statusCode, 200, "OWNER deve listar usuarios do restaurante");
    assert.equal(restaurantUsersBefore.payload?.restaurantKey, "default", "usuarios devem manter restaurant_key default");
    assert.ok(
      restaurantUsersBefore.payload?.users?.some(
        (user) => user.login === "owner@default.local" && user.tipo_usuario === "OWNER"
      ),
      "OWNER default deve aparecer na equipe do restaurante"
    );
    assert.equal(
      restaurantUsersBefore.payload?.users?.some((user) => user.login === "master.local"),
      false,
      "usuario Master antigo materializado deve ser removido da base legada"
    );

    const customPermissions = {
      orders_view: true,
      users_view: true,
    };
    const customSave = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://localhost:3000/api/admin/users/save",
      cookie: ownerCookie,
      body: {
        user: {
          name: "Operador Local",
          login: "operador.local",
          email: "operador.local@teste.local",
          password: "senha-custom",
          status: "ACTIVE",
          userType: "CUSTOM",
          permissions: customPermissions,
        },
      },
    });

    assert.equal(customSave.statusCode, 200, "MASTER deve criar usuario CUSTOM");
    assert.equal(customSave.payload?.user?.tipo_usuario, "CUSTOM", "usuario criado deve ser CUSTOM");
    assert.equal(
      customSave.payload?.user?.effectivePermissions?.orders_view,
      true,
      "permissao individual orders_view deve ser aplicada"
    );
    assert.equal(
      customSave.payload?.user?.effectivePermissions?.financial_view,
      false,
      "permissao financeira nao marcada deve ficar negada"
    );

    const customLogin = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://localhost:3000/api/admin/login",
      body: {
        identifier: "operador.local",
        password: "senha-custom",
        next: "/admin/",
      },
    });

    assert.equal(customLogin.statusCode, 200, "usuario CUSTOM ativo deve autenticar");
    assert.equal(customLogin.payload?.admin?.tipo_usuario, "CUSTOM", "login deve expor tipo CUSTOM");
    const customCookie = extractCookieHeader(customLogin);

    const allowedOrders = await runAdminApi(adminApi, {
      url: "http://localhost:3000/api/admin/orders/list?limit=1",
      cookie: customCookie,
    });

    assert.equal(allowedOrders.statusCode, 200, "CUSTOM com orders_view deve acessar pedidos");

    const forbiddenFinance = await runAdminApi(adminApi, {
      url: "http://localhost:3000/api/admin/finance",
      cookie: customCookie,
    });

    assert.equal(forbiddenFinance.statusCode, 403, "CUSTOM sem financial_view deve receber 403");
    assert.equal(
      forbiddenFinance.payload?.errorCode,
      "admin_permission_denied",
      "403 deve usar codigo de permissao"
    );

    const forbiddenStatus = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://localhost:3000/api/admin/users/status",
      cookie: customCookie,
      body: {
        login: "operador.local",
        status: "BLOCKED",
      },
    });

    assert.equal(forbiddenStatus.statusCode, 403, "CUSTOM sem users_edit nao pode bloquear usuario");

    const blockCustom = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://localhost:3000/api/admin/users/status",
      cookie: ownerCookie,
      body: {
        login: "operador.local",
        status: "BLOCKED",
      },
    });

    assert.equal(blockCustom.statusCode, 200, "OWNER deve bloquear usuario sem excluir fisicamente");
    assert.equal(blockCustom.payload?.user?.status, "BLOCKED", "status bloqueado deve ser persistido");

    const blockedLogin = await runAdminApi(adminApi, {
      method: "POST",
      url: "http://localhost:3000/api/admin/login",
      body: {
        identifier: "operador.local",
        password: "senha-custom",
        next: "/admin/",
      },
    });

    assert.equal(blockedLogin.statusCode, 403, "usuario bloqueado nao deve autenticar");
    assert.equal(blockedLogin.payload?.errorCode, "admin_user_blocked");

    const store = JSON.parse(await fs.readFile(path.join(tempRoot, ".data", "admin-users.json"), "utf8"));
    assert.equal(store.restaurantKey, "default", "store local deve manter restaurantKey default");
    assert.equal(
      store.preparedForFutureRestaurantAssociation,
      true,
      "store deve documentar preparacao para associacao futura"
    );
    assert.equal(
      store.users.some((user) => user.login === "operador.local"),
      true,
      "bloqueio nao deve excluir fisicamente o usuario"
    );

    console.log("Validacao local de usuarios e permissoes concluida com sucesso.");
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
