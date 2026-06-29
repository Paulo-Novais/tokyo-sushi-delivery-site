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
          password: "SenhaMasterIndevida",
          status: "ACTIVE",
          userType: "MASTER",
          restaurantKey: "usuarios-a",
        },
      },
    });
    assert.equal(createMasterDenied.statusCode, 403, "OWNER nao deve criar MASTER");
    assert.equal(createMasterDenied.payload?.errorCode, "owner_cannot_manage_platform_user");

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
