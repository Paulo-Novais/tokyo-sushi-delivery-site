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

test("sem a chave, 5 senhas erradas bloqueiam (comportamento de produção)", async () => {
  delete process.env.INOVAS_LOCAL_REVIEW_DISABLE_LOGIN_LOCKOUT;
  delete process.env.VERCEL;
  failFiveTimes();
  assert.equal(await isBlocked(), true);
});

test("com a chave no servidor local, 5 senhas erradas não bloqueiam", async () => {
  process.env.INOVAS_LOCAL_REVIEW_DISABLE_LOGIN_LOCKOUT = "1";
  process.env.NODE_ENV = "development";
  delete process.env.VERCEL;
  failFiveTimes();
  assert.equal(await isBlocked(), false);
});

test("na Vercel a chave é ignorada e o bloqueio continua", async () => {
  process.env.INOVAS_LOCAL_REVIEW_DISABLE_LOGIN_LOCKOUT = "1";
  process.env.VERCEL = "1";
  failFiveTimes();
  assert.equal(await isBlocked(), true);
});

test("com NODE_ENV=production a chave é ignorada e o bloqueio continua", async () => {
  process.env.INOVAS_LOCAL_REVIEW_DISABLE_LOGIN_LOCKOUT = "1";
  process.env.NODE_ENV = "production";
  delete process.env.VERCEL;
  failFiveTimes();
  assert.equal(await isBlocked(), true);
});
