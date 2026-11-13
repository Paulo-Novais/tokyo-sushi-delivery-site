// Login da equipe (Gestor e System, routeType "admin-auth") sem bloqueio por
// tentativas: decisão do Paulo em 13/11/2026. Nenhum limite de tentativas,
// nenhum bloqueio por senha errada e nenhuma negação por "muitas falhas", em
// qualquer ambiente. O login de clientes ("customer-auth") continua com limite.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const guardian = require(path.resolve(__dirname, "..", "..", "lib", "security-guardian.cjs"));

const KEYS = [
  "INOVAS_LOCAL_REVIEW_DISABLE_LOGIN_LOCKOUT",
  "VERCEL",
  "NODE_ENV",
  "INOVAS_ENVIRONMENT",
  "INOVAS_ENABLE_PREVIEW_E2E_OVERRIDES",
  "INOVAS_PREVIEW_ADMIN_LOGIN_RATE_LIMIT",
];
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

const restoreEnvironment = () => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
};

test.beforeEach(() => {
  restoreEnvironment();
  delete process.env.INOVAS_LOCAL_REVIEW_DISABLE_LOGIN_LOCKOUT;
  delete process.env.INOVAS_ENVIRONMENT;
  delete process.env.INOVAS_ENABLE_PREVIEW_E2E_OVERRIDES;
  delete process.env.INOVAS_PREVIEW_ADMIN_LOGIN_RATE_LIMIT;
  process.env.VERCEL = "1";
  process.env.NODE_ENV = "production";
  guardian.resetSecurityGuardianForTests();
});

test.afterEach(() => {
  restoreEnvironment();
  guardian.resetSecurityGuardianForTests();
});

const fakeRequest = (url = "/api/admin/login") => ({
  method: "POST",
  url,
  headers: { "x-forwarded-for": "10.9.8.7", "user-agent": "teste-unitario", host: "inovasfood.com.br" },
});

// As duas portas de login da equipe: /api/admin/login e /api/auth/{system,restaurant}/login.
const STAFF_LOGIN_OPTIONS = [
  { routeType: "admin-auth", group: "auth", action: "login", requireTenant: false, requireSession: false },
  { routeType: "admin-auth", action: "restaurant:login", requireTenant: false, requireSession: false, rateLimitProfile: "adminLogin" },
  { routeType: "admin-auth", action: "system:login", requireTenant: false, requireSession: false, rateLimitProfile: "adminLogin" },
];

const attemptWrongPassword = async (options) => {
  const req = fakeRequest();
  await guardian.guardSecurity(req, options);
  guardian.recordSecurityFailure(req, {
    routeType: "admin-auth",
    action: options.action,
    reason: "invalid_credentials",
    userKey: "owner@exemplo.local",
  });
};

for (const options of STAFF_LOGIN_OPTIONS) {
  test(`login da equipe (${options.action}) aceita 50 senhas erradas seguidas sem bloquear`, async () => {
    for (let index = 0; index < 50; index += 1) {
      await attemptWrongPassword(options);
    }

    const result = await guardian.guardSecurity(fakeRequest(), options);
    assert.equal(result.allowed, true);
  });
}

test("login de clientes continua com limite de tentativas", async () => {
  const options = {
    routeType: "customer-auth",
    action: "customer-auth:verify",
    requireTenant: false,
    rateLimitProfile: "customerAuth",
  };
  const limit = guardian.RATE_LIMIT_PROFILES.customerAuth.limit;

  for (let index = 0; index < limit; index += 1) {
    await guardian.guardSecurity(fakeRequest("/api/customer/auth/verify"), options);
  }

  await assert.rejects(
    () => guardian.guardSecurity(fakeRequest("/api/customer/auth/verify"), options),
    (error) => error.statusCode === 429 && error.errorCode === "security_rate_limited"
  );
});
