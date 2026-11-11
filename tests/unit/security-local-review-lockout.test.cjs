// O bloqueio por senhas erradas só pode ser desligado no servidor local
// de revisão. Em qualquer ambiente da Vercel (VERCEL=1) ou em produção,
// a chave é ignorada e o bloqueio continua valendo.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const guardian = require(path.resolve(__dirname, "..", "..", "lib", "security-guardian.cjs"));

const KEYS = ["INOVAS_LOCAL_REVIEW_DISABLE_LOGIN_LOCKOUT", "VERCEL", "NODE_ENV"];
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
test.afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  guardian.resetSecurityGuardianForTests();
});

const fakeRequest = () => ({
  method: "POST",
  url: "/api/admin/login",
  headers: { "x-forwarded-for": "10.9.8.7", "user-agent": "teste-unitario", host: "127.0.0.1" },
});

const failFiveTimes = () => {
  for (let index = 0; index < 5; index += 1) {
    guardian.recordSecurityFailure(fakeRequest(), {
      routeType: "admin-auth",
      action: "restaurant:login",
      reason: "invalid_credentials",
      userKey: "owner@exemplo.local",
    });
  }
};

const isBlocked = async () => {
  try {
    await guardian.guardSecurity(fakeRequest(), {
      routeType: "admin-auth",
      action: "restaurant:login",
      requireTenant: false,
      rateLimitProfile: "adminLogin",
    });
    return false;
  } catch (error) {
    return [403, 429].includes(error.statusCode);
  }
};

// Fluxo real do login: o guardião avalia a requisição e, se a senha estiver
// errada, a falha é registrada com o contexto que ele montou. O limite geral de
// tentativas fica alto (mesmo ajuste do servidor de revisão) para provar que é o
// bloqueio por senha errada que segura a sexta tentativa, e não o limite geral.
const LOGIN_OPTIONS = {
  routeType: "admin-auth",
  action: "restaurant:login",
  requireTenant: false,
  rateLimitProfile: "adminLogin",
};

const withHighRateLimit = () => {
  process.env.INOVAS_ENVIRONMENT = "preview";
  process.env.INOVAS_ENABLE_PREVIEW_E2E_OVERRIDES = "1";
  process.env.INOVAS_PREVIEW_ADMIN_LOGIN_RATE_LIMIT = "1000";
};

const failFiveTimesRealFlow = async () => {
  for (let index = 0; index < 5; index += 1) {
    const req = fakeRequest();
    await guardian.guardSecurity(req, LOGIN_OPTIONS);
    guardian.recordSecurityFailure(req, {
      routeType: "admin-auth",
      action: "restaurant:login",
      reason: "invalid_credentials",
      userKey: "owner@exemplo.local",
    });
  }
};

const isBlockedRealFlow = async () => {
  try {
    await guardian.guardSecurity(fakeRequest(), LOGIN_OPTIONS);
    return false;
  } catch (error) {
    return error.statusCode === 429 && error.errorCode === "security_temporary_block";
  }
};

for (const key of ["INOVAS_ENVIRONMENT", "INOVAS_ENABLE_PREVIEW_E2E_OVERRIDES", "INOVAS_PREVIEW_ADMIN_LOGIN_RATE_LIMIT"]) {
  if (!KEYS.includes(key)) {
    KEYS.push(key);
    saved[key] = process.env[key];
  }
}

test("sem a chave, 5 senhas erradas bloqueiam (comportamento de produção)", async () => {
  delete process.env.INOVAS_LOCAL_REVIEW_DISABLE_LOGIN_LOCKOUT;
  delete process.env.VERCEL;
  withHighRateLimit();
  await failFiveTimesRealFlow();
  assert.equal(await isBlockedRealFlow(), true);
});

test("com a chave no servidor local, 5 senhas erradas não bloqueiam", async () => {
  process.env.INOVAS_LOCAL_REVIEW_DISABLE_LOGIN_LOCKOUT = "1";
  process.env.NODE_ENV = "development";
  delete process.env.VERCEL;
  withHighRateLimit();
  await failFiveTimesRealFlow();
  assert.equal(await isBlockedRealFlow(), false);
  failFiveTimes();
  assert.equal(await isBlocked(), false);
});

test("na Vercel a chave é ignorada e o bloqueio continua", async () => {
  process.env.INOVAS_LOCAL_REVIEW_DISABLE_LOGIN_LOCKOUT = "1";
  process.env.VERCEL = "1";
  withHighRateLimit();
  await failFiveTimesRealFlow();
  assert.equal(await isBlockedRealFlow(), true);
});

test("com NODE_ENV=production a chave é ignorada e o bloqueio continua", async () => {
  process.env.INOVAS_LOCAL_REVIEW_DISABLE_LOGIN_LOCKOUT = "1";
  process.env.NODE_ENV = "production";
  delete process.env.VERCEL;
  withHighRateLimit();
  await failFiveTimesRealFlow();
  assert.equal(await isBlockedRealFlow(), true);
});
