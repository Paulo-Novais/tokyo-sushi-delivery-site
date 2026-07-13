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
  { method = "GET", url, host = "localhost:3000", body = null, cookie = "", ip = "127.0.5.1" }
) => {
  const req = {
    method,
    url,
    headers: {
      host,
      "x-forwarded-for": ip,
      "x-forwarded-proto": "http",
      accept: "application/json",
      "user-agent": "validate-v1-2-saas-local",
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

const login = async (
  adminApi,
  { identifier, password, next = "/admin/", host = "localhost:3000", ip = "127.0.5.1" }
) => {
  const response = await runAdminApi(adminApi, {
    method: "POST",
    url: `http://${host}/api/admin/login`,
    host,
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

  return {
    response,
    cookie,
  };
};

const expectStatus = async (adminApi, options, expectedStatus, message) => {
  const response = await runAdminApi(adminApi, options);
  assert.equal(response.statusCode, expectedStatus, message);
  return response;
};

const saveUser = (adminApi, cookie, user, expectedStatus = 200, message = "Usuario deveria ser salvo") =>
  expectStatus(
    adminApi,
    {
      method: "POST",
      url: "http://localhost:3000/api/admin/users/save",
      cookie,
      body: {
        user,
      },
    },
    expectedStatus,
    message
  );

const restaurantPayload = ({ key, ownerPassword = "SenhaOwnerV12" }) => ({
  restaurantName: `Restaurante ${key}`,
  tradeName: `Restaurante ${key}`,
  slug: key,
  restaurantKey: key,
  domain: `${key}.localhost`,
  document: "12345678000190",
  ownerFullName: `Owner ${key}`,
  city: "Sao Paulo",
  postalCode: "01000000",
  establishmentNumber: "101",
  email: `owner@${key}.local`,
  phone: "5511999922222",
  whatsapp: "5511999922222",
  adhesionDate: "2026-06-29",
  address: {
    street: "Rua V1.2",
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
  plan: "PRO",
  subscriptionStatus: "TRIAL",
  adminUser: {
    login: `owner@${key}.local`,
    email: `owner@${key}.local`,
    name: `Owner ${key}`,
    password: ownerPassword,
  },
});

const readWorkspaceFile = (relativePath) =>
  fs.readFile(path.join(workspaceRoot, relativePath), "utf8");

const assertOrderedKeys = (source, keys, label) => {
  let cursor = -1;

  for (const key of keys) {
    const index = source.indexOf(`key: "${key}"`, cursor + 1);
    assert.ok(index > cursor, `${label} deve declarar ${key} na ordem esperada.`);
    cursor = index;
  }
};

const validateSourceArchitecture = async () => {
  const adminSource = await readWorkspaceFile("admin/admin.js");
  const cssSource = await readWorkspaceFile("admin/admin.css");
  const permissionsSource = await readWorkspaceFile("lib/user-permissions.cjs");
  const storeSource = await readWorkspaceFile("lib/master-platform-store.cjs");

  assert.ok(adminSource.includes("const RESTAURANT_NAV_SECTIONS"), "UI deve ter menu de restaurante separado.");
  assert.ok(adminSource.includes("const SYSTEM_NAV_SECTIONS"), "UI deve ter menu de sistema separado.");
  assertOrderedKeys(
    adminSource.slice(adminSource.indexOf("const RESTAURANT_NAV_SECTIONS")),
    [
      "dashboard",
      "orders",
      "scheduled",
      "menu",
      "deliveries",
      "customers",
      "promotions",
      "metrics",
      "reports",
      "inventory",
      "finance",
      "reviews",
      "settings",
    ],
    "Menu de restaurante"
  );
  const systemMenuSource = adminSource.slice(
    adminSource.indexOf("const SYSTEM_NAV_SECTIONS"),
    adminSource.indexOf("const NAV_SECTIONS")
  );
  assertOrderedKeys(
    systemMenuSource,
    [
      "users",
      "orders",
      "scheduled",
      "menu",
      "deliveries",
      "customers",
      "promotions",
      "metrics",
      "reports",
      "finance",
      "reviews",
      "settings",
    ],
    "Menu de sistema"
  );
  assert.equal(systemMenuSource.includes('key: "dashboard"'), false, "Menu de sistema nao deve exibir Dashboard.");
  assert.equal(systemMenuSource.includes('key: "inventory"'), false, "Menu de sistema nao deve exibir Estoque.");
  assert.ok(adminSource.includes("SYSTEM_GLOBAL_FILTERS"), "UI deve estruturar filtros globais por restaurante.");
  assert.ok(adminSource.includes('data-system-filter="${escapeHtml(filter.key)}"'), "Filtros globais devem renderizar campos.");
  assert.ok(adminSource.includes("Consolidado da plataforma"), "Financeiro/Relatorios/Metricas devem preparar consolidado.");
  assert.ok(adminSource.includes("Administrador do Sistema"), "Header MASTER deve identificar administracao do sistema.");
  assert.ok(cssSource.includes(".admin-system-filter-bar"), "Filtros globais devem ter layout responsivo.");
  assert.ok(permissionsSource.includes("SYSTEM_USER_HIERARCHY"), "Backend deve declarar hierarquia do sistema.");
  assert.ok(permissionsSource.includes("users.read") && permissionsSource.includes("settings.write"), "Permissoes SaaS module.action devem existir.");
  assert.ok(permissionsSource.includes("single_master_required"), "Backend deve impedir mais de um MASTER.");
  assert.ok(storeSource.includes("seller_id") && storeSource.includes("sellerId"), "Onboarding deve persistir seller_id.");
};

const validateApiArchitecture = async (adminApi) => {
  const master = await login(adminApi, {
    identifier: "master@v1-2.local",
    password: "SenhaMasterV12",
    next: "/admin/master.html",
  });
  assert.equal(master.response.payload?.admin?.userType, "MASTER");
  assert.equal(master.response.payload?.admin?.restaurantKey, "", "MASTER nao deve receber restaurantKey.");
  assert.equal(master.response.payload?.admin?.restaurantName || "", "", "MASTER nao deve receber restaurantName.");
  assert.equal(master.response.payload?.admin?.platformScope, true, "MASTER deve ser usuario de sistema.");

  const usersPayload = await expectStatus(
    adminApi,
    {
      url: "http://localhost:3000/api/admin/users/list",
      cookie: master.cookie,
    },
    200,
    "MASTER deve listar usuarios."
  );
  assert.deepEqual(usersPayload.payload?.systemHierarchy, [
    "MASTER",
    "SOCIO",
    "DESENVOLVEDOR",
    "SUPORTE",
    "VENDEDOR",
  ]);
  assert.equal(usersPayload.payload?.permissionArchitecture?.version, "v1.2");
  assert.ok(
    usersPayload.payload?.permissionArchitecture?.modules?.some((module) =>
      module.permissions?.some((permission) => permission.permission === "users.read")
    ),
    "Payload deve expor permissoes module.action."
  );

  await saveUser(
    adminApi,
    master.cookie,
    {
      name: "Master Duplicado",
      login: "master2@v1-2.local",
      email: "master2@v1-2.local",
      password: "SenhaMaster2",
      status: "ACTIVE",
      userScope: "SYSTEM",
      userType: "MASTER",
    },
    403,
    "MASTER duplicado deve ser bloqueado."
  );

  await saveUser(adminApi, master.cookie, {
    name: "Socio INOVAS",
    login: "socio@v1-2.local",
    email: "socio@v1-2.local",
    password: "SenhaSocioV12",
    status: "ACTIVE",
    userScope: "SYSTEM",
    userType: "SOCIO",
  });
  const socio = await login(adminApi, {
    identifier: "socio@v1-2.local",
    password: "SenhaSocioV12",
  });
  assert.equal(socio.response.payload?.admin?.restaurantKey, "", "SOCIO nao deve receber restaurantKey.");

  await saveUser(
    adminApi,
    socio.cookie,
    {
      name: "Master Indevido",
      login: "master-socio@v1-2.local",
      email: "master-socio@v1-2.local",
      password: "SenhaMasterSocio",
      status: "ACTIVE",
      userScope: "SYSTEM",
      userType: "MASTER",
    },
    403,
    "SOCIO nao deve criar MASTER."
  );
  await saveUser(adminApi, socio.cookie, {
    name: "Dev INOVAS",
    login: "dev@v1-2.local",
    email: "dev@v1-2.local",
    password: "SenhaDevV12",
    status: "ACTIVE",
    userScope: "SYSTEM",
    userType: "DESENVOLVEDOR",
  });
  const developer = await login(adminApi, {
    identifier: "dev@v1-2.local",
    password: "SenhaDevV12",
  });

  await saveUser(adminApi, developer.cookie, {
    name: "Suporte INOVAS",
    login: "suporte@v1-2.local",
    email: "suporte@v1-2.local",
    password: "SenhaSuporteV12",
    status: "ACTIVE",
    userScope: "SYSTEM",
    userType: "SUPORTE",
  });
  await saveUser(adminApi, developer.cookie, {
    name: "Vendedor Dev",
    login: "vendedor-dev@v1-2.local",
    email: "vendedor-dev@v1-2.local",
    password: "SenhaVendedorDev",
    status: "ACTIVE",
    userScope: "SYSTEM",
    userType: "VENDEDOR",
  });
  await saveUser(
    adminApi,
    developer.cookie,
    {
      name: "Socio Indevido",
      login: "socio-dev@v1-2.local",
      email: "socio-dev@v1-2.local",
      password: "SenhaSocioDev",
      status: "ACTIVE",
      userScope: "SYSTEM",
      userType: "SOCIO",
    },
    403,
    "DESENVOLVEDOR nao deve criar SOCIO."
  );
  await saveUser(
    adminApi,
    developer.cookie,
    {
      name: "Owner Indevido",
      login: "owner-dev@v1-2.local",
      email: "owner-dev@v1-2.local",
      phone: "5511999911111",
      password: "SenhaOwnerDev",
      status: "ACTIVE",
      userScope: "RESTAURANT",
      userType: "OWNER",
      restaurantKey: "default",
    },
    403,
    "DESENVOLVEDOR nao deve administrar usuarios de restaurante."
  );

  const suporte = await login(adminApi, {
    identifier: "suporte@v1-2.local",
    password: "SenhaSuporteV12",
  });
  await saveUser(adminApi, suporte.cookie, {
    name: "Vendedor Suporte",
    login: "seller-v12",
    email: "seller-v12@v1-2.local",
    password: "SenhaVendedorV12",
    status: "ACTIVE",
    userScope: "SYSTEM",
    userType: "VENDEDOR",
  });
  await saveUser(
    adminApi,
    suporte.cookie,
    {
      name: "Dev Indevido",
      login: "dev-suporte@v1-2.local",
      email: "dev-suporte@v1-2.local",
      password: "SenhaDevSuporte",
      status: "ACTIVE",
      userScope: "SYSTEM",
      userType: "DESENVOLVEDOR",
    },
    403,
    "SUPORTE nao deve criar DESENVOLVEDOR."
  );
  await saveUser(adminApi, suporte.cookie, {
    name: "Caixa Default",
    login: "caixa-default@v1-2.local",
    email: "caixa-default@v1-2.local",
    phone: "5511999912121",
    password: "SenhaCaixaV12",
    status: "ACTIVE",
    userScope: "RESTAURANT",
    userType: "CAIXA",
    restaurantKey: "default",
  });

  const vendedor = await login(adminApi, {
    identifier: "seller-v12",
    password: "SenhaVendedorV12",
  });
  await saveUser(
    adminApi,
    vendedor.cookie,
    {
      name: "Vendedor Indevido",
      login: "vendedor-api@v1-2.local",
      email: "vendedor-api@v1-2.local",
      password: "SenhaVendedorApi",
      status: "ACTIVE",
      userScope: "SYSTEM",
      userType: "VENDEDOR",
    },
    403,
    "VENDEDOR nao deve alterar usuarios do sistema via API."
  );

  const onboarding = await expectStatus(
    adminApi,
    {
      method: "POST",
      url: "http://localhost:3000/api/admin/master/onboard-restaurant",
      cookie: vendedor.cookie,
      body: restaurantPayload({ key: "seller-v12" }),
      ip: "127.0.5.20",
    },
    200,
    "VENDEDOR deve cadastrar restaurante e usuario inicial."
  );
  assert.equal(onboarding.payload?.restaurant?.restaurantKey, "seller-v12");
  assert.equal(onboarding.payload?.restaurant?.seller_id, "seller-v12");
  assert.equal(onboarding.payload?.restaurantAdmin?.userType, "OWNER");
  assert.equal(onboarding.payload?.restaurantAdmin?.restaurantKey, "seller-v12");

  const { resetSecurityGuardianForTests } = require(path.join(workspaceRoot, "lib/security-guardian.cjs"));
  resetSecurityGuardianForTests();

  const owner = await login(adminApi, {
    identifier: "owner@seller-v12.local",
    password: "SenhaOwnerV12",
    host: "seller-v12.localhost",
    ip: "127.0.5.21",
  });
  assert.equal(owner.response.payload?.admin?.userType, "OWNER");
  assert.equal(owner.response.payload?.admin?.restaurantKey, "seller-v12");
  assert.equal(owner.response.payload?.admin?.restaurantName, "Restaurante seller-v12");

  await saveUser(
    adminApi,
    owner.cookie,
    {
      name: "Caixa Fora",
      login: "caixa-fora@v1-2.local",
      email: "caixa-fora@v1-2.local",
      phone: "5511999913131",
      password: "SenhaCaixaFora",
      status: "ACTIVE",
      userScope: "RESTAURANT",
      userType: "CAIXA",
      restaurantKey: "default",
    },
    403,
    "OWNER nao deve escrever em outro restaurante."
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
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
    INOVAS_TENANT_MODE: process.env.INOVAS_TENANT_MODE,
    NODE_ENV: process.env.NODE_ENV,
  };
  const beforeRealData = await getDirectoryFingerprint(realDataDirectory);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tokyo-v1-2-saas-"));

  try {
    await validateSourceArchitecture();

    await fs.mkdir(path.join(tempRoot, ".data"), { recursive: true });
    process.chdir(tempRoot);
    process.env.NODE_ENV = "development";
    process.env.INOVAS_TENANT_MODE = "pilot";
    process.env.ADMIN_SESSION_SECRET = "validate-v1-2-saas-secret";
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
          login: "master@v1-2.local",
          email: "master@v1-2.local",
          displayName: "Master V1.2",
          passwordHash: adminAuth.createPasswordHash("SenhaMasterV12"),
          userType: "MASTER",
          userScope: "SYSTEM",
          platformScope: true,
        },
      ],
    });

    const adminApi = require(path.join(workspaceRoot, "lib/admin-api.cjs"));
    await validateApiArchitecture(adminApi);
  } finally {
    process.chdir(originalCwd);

    for (const [key, value] of Object.entries(originalEnv)) {
      if (typeof value === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    await fs.rm(tempRoot, { recursive: true, force: true });
    const afterRealData = await getDirectoryFingerprint(realDataDirectory);
    assert.deepEqual(afterRealData, beforeRealData, "Validacao V1.2 nao deve alterar .data real.");
  }
};

run()
  .then(() => {
    console.log("validate:v1-2-saas-local OK");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
