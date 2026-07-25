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
const masterLogin = "master@v110-onboarding.local";
const masterPassword = "SenhaMasterV110";
const masterHost = "localhost:3000";
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
]);

const touchedEnvKeys = [
  "ADMIN_LOGIN",
  "ADMIN_PASSWORD",
  "ADMIN_PASSWORD_HASH",
  "ADMIN_DISPLAY_NAME",
  "ADMIN_USERS",
  "ADMIN_SESSION_SECRET",
  "DATABASE_URL",
  "POSTGRES_URL",
  "NODE_ENV",
  "INOVAS_TENANT_MODE",
];

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

const resetWorkspaceModuleCache = () => {
  const prefix = `${workspaceRoot}${path.sep}`;

  Object.keys(require.cache).forEach((entry) => {
    if (entry.startsWith(prefix)) {
      delete require.cache[entry];
    }
  });
};

const restoreEnv = (snapshot) => {
  touchedEnvKeys.forEach((key) => {
    if (typeof snapshot[key] === "undefined") {
      delete process.env[key];
    } else {
      process.env[key] = snapshot[key];
    }
  });
};

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

const runJsonApi = async (
  handler,
  {
    method = "GET",
    url,
    host = masterHost,
    body = null,
    cookie = "",
    ip = "127.0.0.1",
  } = {}
) => {
  const req = {
    method,
    url,
    headers: {
      host,
      "x-forwarded-proto": "http",
      accept: "application/json",
      "user-agent": "V110OnboardingValidator/1.0",
      ...(cookie ? { cookie } : {}),
    },
    socket: { remoteAddress: ip },
    connection: { remoteAddress: ip },
    body: body === null ? "" : JSON.stringify(body),
  };
  const res = buildMockResponse();

  await handler(req, res);
  return res;
};

const extractCookieHeader = (response) => {
  const setCookie = response.headers["Set-Cookie"] || response.headers["set-cookie"] || "";
  const cookie = Array.isArray(setCookie) ? setCookie[0] : String(setCookie);
  return cookie.split(";")[0];
};

const createStaticServer = (rootDirectory) =>
  http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
      let pathname = decodeURIComponent(requestUrl.pathname);

      if (pathname === "/") {
        pathname = "/index.html";
      }

      if (pathname === "/admin/" || pathname === "/admin") {
        pathname = "/admin/index.html";
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
      res.end("Internal server error");
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

const loginAdmin = async (adminApi, { host = masterHost, identifier, password, ip = "127.0.1.1" }) => {
  const response = await runJsonApi(adminApi, {
    method: "POST",
    url: `http://${host}/api/admin/login`,
    host,
    ip,
    body: { identifier, password },
  });

  assert.equal(response.statusCode, 200, `Login deveria funcionar para ${identifier}.`);
  const cookie = extractCookieHeader(response);
  assert.ok(cookie, `Login deveria emitir cookie para ${identifier}.`);

  return { response, cookie };
};

const loginMaster = (adminApi) =>
  loginAdmin(adminApi, {
    identifier: masterLogin,
    password: masterPassword,
  });

const nextDocument = (() => {
  let index = 10000000000000;
  return () => String(index++);
})();

const restaurantPayload = ({
  key,
  name = `Restaurante ${key}`,
  document = nextDocument(),
  email = `contato@${key}.local`,
  domain = "",
  customDomain = "",
  ownerLogin = `owner@${key}.local`,
  ownerPassword = "SenhaOwnerV110",
  plan = "PRO",
} = {}) => ({
  restaurantName: name,
  tradeName: name,
  slug: key,
  restaurantKey: key,
  ...(domain ? { domain } : {}),
  ...(customDomain ? { customDomain } : {}),
  document,
  ownerFullName: `Owner ${name}`,
  responsible: `Owner ${name}`,
  companyName: `${name} LTDA`,
  stateRegistration: "Isento",
  city: "Sao Paulo",
  postalCode: "01000000",
  establishmentNumber: "100",
  email,
  phone: "5511999999999",
  whatsapp: "5511999999999",
  adhesionDate: "2026-07-18",
  address: {
    street: "Rua INOVAS",
    number: "100",
    neighborhood: "Centro",
    city: "Sao Paulo",
    state: "SP",
    postalCode: "01000000",
  },
  menuAddress: customDomain
    ? {
        type: "custom",
        slug: key,
        internalUrl: `https://www.inovasfood.com.br/${key}`,
        customDomain,
      }
    : {
        type: "inovas",
        slug: key,
        internalUrl: `https://www.inovasfood.com.br/${key}`,
      },
  features: ["delivery", "pickup", "whatsapp"],
  appearance: {
    logoUrl: "/assets/logo-v110.png",
    bannerUrl: "/assets/banner-v110.jpg",
    primaryColor: "#ff5a00",
    secondaryColor: "#111827",
  },
  delivery: {
    radiusKm: 6,
    fee: 8,
    minimumOrder: 25,
    deliveriesEnabled: true,
  },
  paymentMethods: ["pix", "card"],
  plan,
  subscriptionStatus: "TRIAL",
  adminUser: {
    login: ownerLogin,
    email: ownerLogin,
    name: `Owner ${name}`,
    password: ownerPassword,
    phone: "5511999999999",
  },
});

const onboardRestaurant = (adminApi, cookie, body, ip = "127.0.2.1") =>
  runJsonApi(adminApi, {
    method: "POST",
    url: `http://${masterHost}/api/admin/master/onboard-restaurant`,
    host: masterHost,
    cookie,
    ip,
    body,
  });

const countRestaurants = async (adminApi, cookie) => {
  const response = await runJsonApi(adminApi, {
    url: `http://${masterHost}/api/admin/master/overview`,
    host: masterHost,
    cookie,
  });

  assert.equal(response.statusCode, 200, "MASTER deveria consultar overview.");
  return response.payload.restaurants.length;
};

const assertConflict = async (adminApi, cookie, response, expectedCode, expectedMessage) => {
  assert.equal(response.statusCode, 409, `${expectedCode} deveria retornar 409.`);
  assert.equal(response.payload?.ok, false, `${expectedCode} deveria retornar ok=false.`);
  assert.equal(response.payload?.error, expectedCode, `${expectedCode} deveria expor error estavel.`);
  assert.equal(response.payload?.message, expectedMessage, `${expectedCode} deveria expor mensagem amigavel.`);
  assert.notEqual(response.statusCode, 500, `${expectedCode} nao deveria retornar 500.`);
  assert.equal(
    await countRestaurants(adminApi, cookie),
    assertConflict.expectedCount,
    `${expectedCode} nao deveria criar restaurante parcial.`
  );
};

const validateFrontendConflictHandling = async () => {
  const server = createStaticServer(workspaceRoot);
  const { port } = await listen(server);
  const baseURL = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ headless: true });
  let submittedPayload = null;

  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await page.route(`${baseURL}/api/admin/master/overview`, async (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          admin: {
            name: "Master V1.10",
            displayName: "Master V1.10",
            userType: "MASTER",
          },
          storageMode: "frontend-v110-validation",
          platform: { masterName: "Master V1.10", planLabel: "MASTER" },
          platformDashboard: { totalRestaurants: 1, activeRestaurants: 1, blockedRestaurants: 0 },
          restaurants: [
            {
              key: "v110-existing",
              restaurantKey: "v110-existing",
              slug: "v110-existing",
              name: "Restaurante Existente",
              plan: "PRO",
              status: "ACTIVE",
            },
          ],
          plans: [{ key: "START" }, { key: "BUSINESS" }, { key: "PRO" }],
          domains: [],
          users: [],
        }),
      })
    );
    await page.route(`${baseURL}/api/admin/master/onboard-restaurant`, async (route) => {
      submittedPayload = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: "restaurant_cnpj_already_exists",
          message: "Já existe um restaurante cadastrado com este CNPJ.",
        }),
      });
    });

    await page.goto(`${baseURL}/admin/master.html`, { waitUntil: "networkidle" });
    await page.locator('[data-master-section-button="restaurants"]').click();
    await page.locator('[data-master-user-action="new-restaurant"]').click();
    await page.waitForSelector("[data-master-restaurant-form]");
    await page.evaluate(() => {
      const form = document.querySelector("[data-master-restaurant-form]");
      const setValue = (name, value) => {
        const field = form?.querySelector(`[name="${name}"]`);

        if (!field) {
          return;
        }

        field.value = value;
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
      };

      setValue("tradeName", "Restaurante Frontend V110");
      setValue("companyName", "Restaurante Frontend V110 LTDA");
      setValue("document", "11.222.333/0001-81");
      setValue("responsible", "Paulo Novais");
      setValue("email", "frontend-v110@teste.local");
      setValue("phone", "(11) 99999-9999");
      setValue("postalCode", "01000-000");
      setValue("street", "Rua INOVAS");
      setValue("establishmentNumber", "100");
      setValue("neighborhood", "Centro");
      setValue("city", "Sao Paulo");
      setValue("state", "SP");
      setValue("slug", "frontend-v110");
      setValue("ownerName", "Owner Frontend V110");
      setValue("ownerEmail", "owner-frontend-v110@teste.local");
      setValue("ownerPassword", "SenhaOwnerV110");
      setValue("ownerPasswordConfirm", "SenhaOwnerV110");
      setValue("adhesionDate", "2026-07-18");
    });

    await page.locator('[data-master-restaurant-form] button[type="submit"]').click();
    await page.waitForFunction(() =>
      document.querySelector('[data-master-onboarding-feedback]')?.textContent?.includes("CNPJ")
    );

    assert.equal(submittedPayload?.document, "11.222.333/0001-81");
    assert.equal(await page.locator("[data-master-restaurant-form]").isVisible(), true);
    assert.equal(await page.locator('[name="document"]').inputValue(), "11.222.333/0001-81");
    assert.equal(await page.locator('[name="tradeName"]').inputValue(), "Restaurante Frontend V110");
    assert.equal(await page.locator('[name="document"]').getAttribute("aria-invalid"), "true");
    assert.equal(
      await page.locator('[data-master-onboarding-validation="document"]').innerText(),
      "Já existe um restaurante cadastrado com este CNPJ."
    );
    assert.match(
      await page.locator('[data-master-onboarding-feedback]').innerText(),
      /Já existe um restaurante cadastrado com este CNPJ\./
    );
    assert.equal(
      await page.evaluate(() => document.body.dataset.masterSection),
      "restaurants",
      "Erro de backend nao deveria voltar para a listagem de usuarios."
    );
  } finally {
    await browser.close();
    await closeServer(server);
  }
};

const run = async () => {
  const originalCwd = process.cwd();
  const originalEnv = touchedEnvKeys.reduce((snapshot, key) => {
    snapshot[key] = process.env[key];
    return snapshot;
  }, {});
  const beforeFingerprint = await getDirectoryFingerprint(realDataDirectory);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tokyo-v110-onboarding-"));

  try {
    await fs.mkdir(path.join(tempRoot, ".data"), { recursive: true });
    process.chdir(tempRoot);
    process.env.NODE_ENV = "development";
    process.env.INOVAS_TENANT_MODE = "pilot";
    process.env.ADMIN_LOGIN = masterLogin;
    process.env.ADMIN_PASSWORD = masterPassword;
    process.env.ADMIN_DISPLAY_NAME = "Master V1.10";
    process.env.ADMIN_SESSION_SECRET = "tokyo-v110-onboarding-secret";
    delete process.env.ADMIN_PASSWORD_HASH;
    delete process.env.ADMIN_USERS;
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    resetWorkspaceModuleCache();

    const adminApi = require(path.join(workspaceRoot, "lib/admin-api.cjs"));
    const masterStore = require(path.join(workspaceRoot, "lib/master-platform-store.cjs"));
    const master = await loginMaster(adminApi);

    const pendingDomain = await onboardRestaurant(
      adminApi,
      master.cookie,
      restaurantPayload({
        key: "v110-custom",
        document: "12.345.678/0001-90",
        email: "Contato@V110.com.br",
        customDomain: "https://www.v110-custom.com.br/",
      })
    );

    assert.equal(pendingDomain.statusCode, 200, "Dominio proprio deveria cadastrar restaurante.");
    assert.equal(pendingDomain.payload.domain.domain, "v110-custom.com.br");
    assert.equal(pendingDomain.payload.domain.customDomain, "v110-custom.com.br");
    assert.equal(pendingDomain.payload.domain.primaryDomain, "");
    assert.equal(pendingDomain.payload.domain.status, "PENDING_VERIFICATION");
    assert.equal(pendingDomain.payload.domain.statusLabel, "Aguardando verificação");
    assert.equal(pendingDomain.payload.domain.dnsIntegrated, false);
    assert.equal(pendingDomain.payload.domain.sslIntegrated, false);
    assert.equal(pendingDomain.payload.domain.verifiedAt, null);
    assert.equal(pendingDomain.payload.domain.activatedAt, null);

    const pendingResolution = await masterStore.resolveRestaurantByHost("v110-custom.com.br");
    assert.notEqual(
      pendingResolution.restaurantKey,
      "v110-custom",
      "Dominio pendente nao deveria resolver para o restaurante."
    );
    assert.equal(pendingResolution.matched, false, "Dominio pendente nao deveria participar do roteamento.");

    const activeTechnicalDomain = await onboardRestaurant(
      adminApi,
      master.cookie,
      restaurantPayload({
        key: "v110-technical",
        domain: "v110-technical.localhost",
        ownerLogin: "owner@v110-technical.local",
      })
    );

    assert.equal(activeTechnicalDomain.statusCode, 200, "Host tecnico deveria continuar ativo.");
    assert.equal(activeTechnicalDomain.payload.domain.status, "ACTIVE");
    const technicalResolution = await masterStore.resolveRestaurantByHost("v110-technical.localhost");
    assert.equal(technicalResolution.restaurantKey, "v110-technical");
    assert.equal(technicalResolution.matched, true);

    assertConflict.expectedCount = await countRestaurants(adminApi, master.cookie);
    await assertConflict(
      adminApi,
      master.cookie,
      await onboardRestaurant(
        adminApi,
        master.cookie,
        restaurantPayload({
          key: "v110-dup-cnpj",
          document: "12345678000190",
          email: "dup-cnpj@v110.local",
          customDomain: "dup-cnpj-v110.com.br",
        })
      ),
      "restaurant_cnpj_already_exists",
      "Já existe um restaurante cadastrado com este CNPJ."
    );

    await assertConflict(
      adminApi,
      master.cookie,
      await onboardRestaurant(
        adminApi,
        master.cookie,
        restaurantPayload({
          key: "v110-dup-email",
          document: nextDocument(),
          email: " contato@v110.com.br ",
          customDomain: "dup-email-v110.com.br",
        })
      ),
      "restaurant_email_already_exists",
      "Já existe um restaurante cadastrado com este e-mail."
    );

    await assertConflict(
      adminApi,
      master.cookie,
      await onboardRestaurant(
        adminApi,
        master.cookie,
        restaurantPayload({
          key: "v110-custom",
          document: nextDocument(),
          email: "dup-slug@v110.local",
          customDomain: "dup-slug-v110.com.br",
        })
      ),
      "restaurant_slug_already_exists",
      "Este endereço INOVAS já está sendo utilizado."
    );

    for (const variant of [
      "v110-custom.com.br",
      "www.v110-custom.com.br",
      "https://v110-custom.com.br/",
      "https://www.v110-custom.com.br",
    ]) {
      await assertConflict(
        adminApi,
        master.cookie,
        await onboardRestaurant(
          adminApi,
          master.cookie,
          restaurantPayload({
            key: `v110-dup-domain-${variant
              .replace(/[^a-z0-9]+/gi, "-")
              .replace(/^-+|-+$/g, "")
              .toLowerCase()}`,
            document: nextDocument(),
            email: `dup-domain-${nextDocument()}@v110.local`,
            customDomain: variant,
          })
        ),
        "restaurant_domain_already_exists",
        "Este domínio já está vinculado ou solicitado por outro restaurante."
      );
    }

    const invalidPayload = await onboardRestaurant(adminApi, master.cookie, { restaurantName: "Sem admin" });
    assert.equal(invalidPayload.statusCode, 400, "Payload invalido deveria retornar 400.");
    assert.equal(invalidPayload.payload?.ok, false);
    assert.equal(invalidPayload.payload?.error, "missing_restaurant_admin_user");
    assert.notEqual(invalidPayload.statusCode, 500);
    assert.equal(await countRestaurants(adminApi, master.cookie), assertConflict.expectedCount);

    const owner = await loginAdmin(adminApi, {
      host: "v110-technical.localhost",
      identifier: "owner@v110-technical.local",
      password: "SenhaOwnerV110",
      ip: "127.0.3.1",
    });
    const forbidden = await onboardRestaurant(
      adminApi,
      owner.cookie,
      restaurantPayload({
        key: "v110-owner-forbidden",
        document: nextDocument(),
        email: "owner-forbidden@v110.local",
        customDomain: "owner-forbidden-v110.com.br",
      })
    );

    assert.equal(forbidden.statusCode, 403, "Usuario comum deveria receber 403 no onboarding.");
    assert.equal(forbidden.payload?.ok, false);
    assert.notEqual(forbidden.statusCode, 500);
    assert.equal(await countRestaurants(adminApi, master.cookie), assertConflict.expectedCount);

    await validateFrontendConflictHandling();

    console.log("validate:v1-10-onboarding-fixes-local OK");
  } finally {
    process.chdir(originalCwd);
    restoreEnv(originalEnv);
    resetWorkspaceModuleCache();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }

  const afterFingerprint = await getDirectoryFingerprint(realDataDirectory);
  assert.deepEqual(afterFingerprint, beforeFingerprint, "Validacao V1.10 nao deve tocar .data real.");
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
