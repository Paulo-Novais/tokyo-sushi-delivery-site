import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const realDataDirectory = path.join(workspaceRoot, ".data");

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

const buildReq = ({
  url = "/api/admin/dashboard",
  method = "GET",
  headers = {},
  body = "",
  tenantContext = null,
  ip = "127.0.0.1",
} = {}) => {
  const req = {
    url,
    method,
    headers: {
      host: "localhost",
      "user-agent": "SecurityGuardianLocal/1.0",
      ...headers,
    },
    body,
    socket: {
      remoteAddress: ip,
    },
  };

  if (tenantContext) {
    req.tenantContext = tenantContext;
  }

  return req;
};

const assertRejectsWithCode = async (label, fn, acceptedCodes) => {
  const codes = Array.isArray(acceptedCodes) ? acceptedCodes : [acceptedCodes];
  await assert.rejects(
    fn,
    (error) => codes.includes(error?.errorCode),
    `${label} deveria falhar com ${codes.join(" ou ")}`
  );
};

const buildTenant = (buildTenantContext, restaurantKey, label) =>
  buildTenantContext(
    {
      host: `${restaurantKey}.security.local`,
      restaurantKey,
      restaurantName: label,
      matched: true,
      resolutionMode: "local-validation",
      multiRestaurantActive: false,
    },
    {
      source: "validate:security-guardian-local",
    }
  );

const runValidation = async () => {
  const originalCwd = process.cwd();
  const originalEnv = {
    ADMIN_LOGIN: process.env.ADMIN_LOGIN,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
    ADMIN_DISPLAY_NAME: process.env.ADMIN_DISPLAY_NAME,
    ADMIN_USERS: process.env.ADMIN_USERS,
    ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
    NODE_ENV: process.env.NODE_ENV,
    INOVAS_TENANT_MODE: process.env.INOVAS_TENANT_MODE,
  };
  const beforeFingerprint = await getDirectoryFingerprint(realDataDirectory);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tokyo-security-guardian-"));

  try {
    await fs.mkdir(path.join(tempRoot, ".data"), { recursive: true });
    process.chdir(tempRoot);
    process.env.NODE_ENV = "development";
    process.env.INOVAS_TENANT_MODE = "default_only";
    process.env.ADMIN_LOGIN = "master@security.local";
    process.env.ADMIN_PASSWORD = "SenhaSegura123";
    process.env.ADMIN_DISPLAY_NAME = "Master Security";
    process.env.ADMIN_SESSION_SECRET = "security-guardian-local-secret";
    delete process.env.ADMIN_PASSWORD_HASH;
    delete process.env.ADMIN_USERS;
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;

    const {
      ADMIN_SESSION_COOKIE_NAME,
      createAdminSessionToken,
      getConfiguredAdminUsers,
    } = require(path.join(workspaceRoot, "lib/admin-auth.cjs"));
    const { saveAdminUser } = require(path.join(workspaceRoot, "lib/user-permissions.cjs"));
    const { buildTenantContext } = require(path.join(workspaceRoot, "lib/tenant-context.cjs"));
    const {
      getSecurityAuditTrail,
      getSecurityEvents,
      guardSecurity,
      recordSecurityFailure,
      resetSecurityGuardianForTests,
    } = require(path.join(workspaceRoot, "lib/security-guardian.cjs"));

    const defaultTenant = buildTenant(buildTenantContext, "default", "Tokyo Sushi");
    const tenantB = buildTenant(buildTenantContext, "tenant-b", "Tenant B Sushi");
    const masterToken = createAdminSessionToken({
      login: "master@security.local",
      displayName: "Master Security",
    });
    const masterCookie = `${ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(masterToken)}`;
    const masterActor = {
      login: "master@security.local",
      displayName: "Master Security",
      userType: "MASTER",
      tipo_usuario: "MASTER",
    };

    await saveAdminUser(
      {
        login: "custom@security.local",
        name: "Custom Security",
        password: "SenhaCustom123",
        userType: "CUSTOM",
        permissions: {
          dashboard_view: true,
        },
      },
      masterActor,
      getConfiguredAdminUsers()
    );

    const customToken = createAdminSessionToken({
      login: "custom@security.local",
      displayName: "Custom Security",
    });
    const customCookie = `${ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(customToken)}`;

    await assertRejectsWithCode(
      "tenant ausente/invalido em modo strict",
      async () => {
        process.env.INOVAS_TENANT_MODE = "strict";
        resetSecurityGuardianForTests();
        await guardSecurity(
          buildReq({
            url: "/api/admin/orders/list",
            headers: {
              host: "tenant-invalido.security.local",
              cookie: masterCookie,
            },
          }),
          {
            routeType: "admin",
            group: "orders",
            action: "list",
            requireTenant: true,
            requireSession: true,
            requiredPermissions: "orders_view",
          }
        );
      },
      ["tenant_context_required", "tenant_domain_not_found"]
    );
    process.env.INOVAS_TENANT_MODE = "default_only";

    resetSecurityGuardianForTests();
    await assertRejectsWithCode(
      "rota admin sem sessao",
      () =>
        guardSecurity(
          buildReq({
            url: "/api/admin/orders/list",
            tenantContext: defaultTenant,
          }),
          {
            routeType: "admin",
            group: "orders",
            action: "list",
            requireTenant: true,
            requireSession: true,
            requiredPermissions: "orders_view",
          }
        ),
      "admin_session_required"
    );

    resetSecurityGuardianForTests();
    await assertRejectsWithCode(
      "rota sem permissao",
      () =>
        guardSecurity(
          buildReq({
            url: "/api/admin/finance",
            headers: { cookie: customCookie },
            tenantContext: defaultTenant,
          }),
          {
            routeType: "admin",
            group: "finance",
            action: "finance",
            requireTenant: true,
            requireSession: true,
            requiredPermissions: "financial_view",
          }
        ),
      "admin_permission_denied"
    );

    resetSecurityGuardianForTests();
    await assertRejectsWithCode(
      "financeiro sem permissao",
      () =>
        guardSecurity(
          buildReq({
            url: "/api/admin/finance",
            method: "POST",
            headers: { cookie: customCookie },
            tenantContext: defaultTenant,
          }),
          {
            routeType: "admin",
            group: "finance",
            action: "finance",
            requireTenant: true,
            requireSession: true,
            requiredPermissions: "financial_edit",
          }
        ),
      "admin_permission_denied"
    );

    resetSecurityGuardianForTests();
    await assertRejectsWithCode(
      "admin com tenant incompativel",
      () =>
        guardSecurity(
          buildReq({
            url: "/api/admin/dashboard",
            headers: { cookie: customCookie },
            tenantContext: tenantB,
          }),
          {
            routeType: "admin",
            group: "dashboard",
            action: "dashboard",
            requireTenant: true,
            requireSession: true,
            requiredPermissions: "dashboard_view",
          }
        ),
      "security_access_denied"
    );

    resetSecurityGuardianForTests();
    for (let index = 0; index < 5; index += 1) {
      await guardSecurity(
        buildReq({
          url: "/api/admin/login",
          method: "POST",
          tenantContext: defaultTenant,
          ip: "10.0.0.10",
        }),
        {
          routeType: "admin-auth",
          group: "auth",
          action: "login",
          requireTenant: true,
          requireSession: false,
        }
      );
    }

    await assertRejectsWithCode(
      "rate limit de login",
      () =>
        guardSecurity(
          buildReq({
            url: "/api/admin/login",
            method: "POST",
            tenantContext: defaultTenant,
            ip: "10.0.0.10",
          }),
          {
            routeType: "admin-auth",
            group: "auth",
            action: "login",
            requireTenant: true,
            requireSession: false,
          }
        ),
      "security_rate_limited"
    );

    resetSecurityGuardianForTests();
    const auditReq = buildReq({
      url: "/api/orders/create",
      method: "POST",
      tenantContext: defaultTenant,
      ip: "10.0.0.20",
    });
    await guardSecurity(auditReq, {
      routeType: "public-write",
      action: "orders:create",
      requireTenant: true,
      rateLimitProfile: "publicWrite",
    });
    assert.ok(getSecurityAuditTrail().length >= 1, "acao sensivel permitida deve registrar auditoria");

    recordSecurityFailure(auditReq, {
      reason: "log_sanitization_probe",
      metadata: {
        password: "senha-nao-pode-vazar",
        token: "token-nao-pode-vazar",
        cookie: "cookie-nao-pode-vazar",
        nested: {
          secret: "segredo-nao-pode-vazar",
        },
        safe: "valor-permitido",
      },
    });
    const serializedEvents = JSON.stringify(getSecurityEvents());
    assert.equal(serializedEvents.includes("senha-nao-pode-vazar"), false);
    assert.equal(serializedEvents.includes("token-nao-pode-vazar"), false);
    assert.equal(serializedEvents.includes("cookie-nao-pode-vazar"), false);
    assert.equal(serializedEvents.includes("segredo-nao-pode-vazar"), false);
    assert.ok(serializedEvents.includes("valor-permitido"), "logs sanitizados devem manter metadados nao sensiveis");

    resetSecurityGuardianForTests();
    const allowed = await guardSecurity(
      buildReq({
        url: "/api/admin/dashboard",
        headers: { cookie: masterCookie },
        tenantContext: defaultTenant,
      }),
      {
        routeType: "admin",
        group: "dashboard",
        action: "dashboard",
        requireTenant: true,
        requireSession: true,
        requiredPermissions: "dashboard_view",
      }
    );
    assert.equal(allowed.allowed, true, "Tokyo Sushi/default deve continuar permitido");
    assert.equal(defaultTenant.restaurantKey, "default");
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

  const afterFingerprint = await getDirectoryFingerprint(realDataDirectory);
  assert.deepEqual(afterFingerprint, beforeFingerprint, "Validacao nao deve tocar .data real.");
};

runValidation()
  .then(() => {
    console.log("validate:security-guardian-local OK");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
