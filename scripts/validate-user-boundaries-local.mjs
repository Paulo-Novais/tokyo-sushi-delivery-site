// RBAC / identity-boundary validation for user management (local, in-process, temp data).
// Covers MASTER, SOCIO, OWNER, GERENTE and a common restaurant user (CAIXA):
//   - legitimate creation paths inside each actor's own domain;
//   - explicit identity scope (SYSTEM x RESTAURANT) required by the API;
//   - correct tenant binding of restaurant users;
//   - privilege-escalation and cross-tenant attempts must be denied.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pw = (label) => `${label}-${randomBytes(12).toString("base64url")}A1`;
const PASS = {
  master: pw("master"),
  owner: pw("owner"),
  socio: pw("socio"),
  gerente: pw("gerente"),
  caixa: pw("caixa"),
};

const mockResponse = () => {
  const headers = {};
  return {
    statusCode: 200,
    payload: null,
    headers,
    setHeader(name, value) { headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return payload; },
  };
};

let ipCounter = 10;
const call = async (handler, { method = "GET", url, body = null, cookie = "" }) => {
  const ip = `127.0.31.${ipCounter++ % 250}`;
  const requestUrl = new URL(url);
  const req = {
    method,
    url,
    headers: {
      host: requestUrl.host,
      "x-forwarded-proto": requestUrl.protocol.replace(":", ""),
      "x-forwarded-for": ip,
      "user-agent": "validate-user-boundaries-local",
      accept: "application/json",
      ...(cookie ? { cookie } : {}),
    },
    socket: { remoteAddress: ip },
    body: body === null ? "" : JSON.stringify(body),
  };
  const res = mockResponse();
  await handler(req, res);
  return res;
};
const cookieOf = (res) => String(res.headers["Set-Cookie"] || res.headers["set-cookie"] || "").split(";")[0];
const BASE = "http://localhost:3000";

const results = [];
const expectStatus = (label, res, allowed) => {
  const ok = allowed.includes(res.statusCode);
  results.push({ label, status: res.statusCode, errorCode: res.payload?.errorCode || "", ok });
  assert.ok(
    ok,
    `${label}: esperado HTTP ${allowed.join("/")}, recebido ${res.statusCode} (${res.payload?.errorCode || JSON.stringify(res.payload?.error || "")})`
  );
  return res;
};

const run = async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "inovas-user-boundaries-"));
  const originalCwd = process.cwd();
  try {
    await fs.mkdir(path.join(tempRoot, ".data"), { recursive: true });
    process.chdir(tempRoot);
    process.env.NODE_ENV = "development";
    process.env.INOVAS_TENANT_MODE = "strict";
    process.env.ADMIN_SESSION_SECRET = randomBytes(32).toString("base64url");
    for (const key of ["ADMIN_LOGIN", "ADMIN_PASSWORD", "ADMIN_PASSWORD_HASH", "DATABASE_URL", "POSTGRES_URL"]) delete process.env[key];

    const adminAuth = require(path.join(workspaceRoot, "lib/admin-auth.cjs"));
    process.env.ADMIN_USERS = JSON.stringify([
      { login: "master.boundary@local.test", displayName: "Master Boundary", passwordHash: adminAuth.createPasswordHash(PASS.master), userType: "MASTER", platformScope: true },
      { login: "owner.boundary@local.test", displayName: "Owner Boundary", passwordHash: adminAuth.createPasswordHash(PASS.owner), userType: "OWNER", restaurantKey: "default", tenantId: "tenant_default", restaurantId: "restaurant_default" },
    ]);
    const adminApi = require(path.join(workspaceRoot, "lib/admin-api.cjs"));

    const login = async (identifier, password, label) => {
      const res = expectStatus(`${label} autentica`, await call(adminApi, { method: "POST", url: `${BASE}/api/admin/login`, body: { identifier, password } }), [200]);
      const cookie = cookieOf(res);
      assert.ok(cookie, `${label} deve receber cookie de sessao`);
      return cookie;
    };
    const save = (cookie, user) => call(adminApi, { method: "POST", url: `${BASE}/api/admin/users/save`, cookie, body: { user } });
    const restaurantUser = (login, userType, extra = {}) => ({
      login, email: login, name: `${userType} Boundary`, password: PASS[userType.toLowerCase()] || pw("x"),
      phone: "5511999990000", status: "ACTIVE", userType, userScope: "RESTAURANT", restaurantKey: "default", ...extra,
    });

    // ---- MASTER ---------------------------------------------------------
    // A SystemSession never operates inside a tenant directly (it must open an
    // audited support session). User management for SYSTEM identities lives in
    // /api/system/users — covered by tests/e2e/user-role-boundaries.spec.js.
    const master = await login("master.boundary@local.test", PASS.master, "MASTER");
    const masterTenantWrite = expectStatus(
      "MASTER (sessão System) NÃO grava usuários pelo caminho do tenant",
      await save(master, restaurantUser("gerente.master@local.test", "GERENTE")),
      [403]
    );
    assert.equal(masterTenantWrite.payload?.errorCode, "system_session_not_tenant_session");

    // ---- OWNER ----------------------------------------------------------
    const owner = await login("owner.boundary@local.test", PASS.owner, "OWNER");
    const created = expectStatus("OWNER cria GERENTE (escopo RESTAURANT explicito)",
      await save(owner, restaurantUser("gerente.boundary@local.test", "GERENTE")), [200]);
    const gerenteRecord = created.payload?.user || {};
    assert.equal(gerenteRecord.userScope, "RESTAURANT", "GERENTE deve ter escopo RESTAURANT");
    assert.notEqual(gerenteRecord.platformScope, true, "GERENTE nunca deve ter escopo de plataforma");
    assert.equal(gerenteRecord.restaurantKey, "default", "GERENTE deve ficar vinculado ao restaurante do OWNER");
    assert.equal(gerenteRecord.tenantId || "tenant_default", "tenant_default", "GERENTE deve ficar no tenant do OWNER");
    expectStatus("OWNER cria CAIXA", await save(owner, restaurantUser("caixa.boundary@local.test", "CAIXA")), [200]);

    expectStatus("OWNER sem userScope explicito e rejeitado (especificacao 026)",
      await save(owner, { ...restaurantUser("sem.escopo@local.test", "GERENTE"), userScope: undefined }), [422]);
    expectStatus("OWNER NAO pode criar MASTER (escalada para SYSTEM)",
      await save(owner, { login: "escalada.master@local.test", email: "escalada.master@local.test", name: "Escalada", password: pw("e"), status: "ACTIVE", userType: "MASTER", userScope: "SYSTEM" }), [400, 403]);
    expectStatus("OWNER NAO pode criar GERENTE com escopo SYSTEM",
      await save(owner, { ...restaurantUser("escalada.scope@local.test", "GERENTE"), userScope: "SYSTEM", restaurantKey: "" }), [400, 403]);
    expectStatus("OWNER NAO pode criar outro OWNER",
      await save(owner, restaurantUser("outro.owner@local.test", "OWNER")), [400, 403]);
    const crossTenant = await save(owner, restaurantUser("cross.tenant@local.test", "GERENTE", { restaurantKey: "restaurante-alheio" }));
    results.push({ label: "OWNER tenta criar GERENTE em outro restaurante", status: crossTenant.statusCode, errorCode: crossTenant.payload?.errorCode || "", ok: true });
    if (crossTenant.statusCode === 200) {
      assert.equal(crossTenant.payload?.user?.restaurantKey, "default", "pedido para outro restaurante deve ser confinado ao restaurante do OWNER");
    } else {
      assert.ok([400, 403, 404].includes(crossTenant.statusCode), "pedido para outro restaurante deve ser negado");
    }
    expectStatus("OWNER NAO pode alterar o MASTER",
      await save(owner, { login: "master.boundary@local.test", email: "master.boundary@local.test", name: "Master alterado", status: "ACTIVE", userType: "MASTER", userScope: "SYSTEM" }), [400, 403, 404, 409]);

    // ---- GERENTE --------------------------------------------------------
    const gerente = await login("gerente.boundary@local.test", PASS.gerente, "GERENTE");
    expectStatus("GERENTE NAO cria usuarios (perfil somente leitura em usuarios)",
      await save(gerente, restaurantUser("caixa.pelo.gerente@local.test", "CAIXA")), [403]);
    expectStatus("GERENTE NAO se promove a OWNER",
      await save(gerente, { ...restaurantUser("gerente.boundary@local.test", "OWNER"), password: undefined }), [400, 403]);
    expectStatus("GERENTE NAO se promove a MASTER",
      await save(gerente, { login: "gerente.boundary@local.test", email: "gerente.boundary@local.test", name: "G", status: "ACTIVE", userType: "MASTER", userScope: "SYSTEM" }), [400, 403]);
    expectStatus("GERENTE NAO acessa o Painel Master",
      await call(adminApi, { url: `${BASE}/api/admin/master/overview`, cookie: gerente }), [401, 403, 404]);

    // ---- CAIXA (usuario comum) -----------------------------------------
    const caixa = await login("caixa.boundary@local.test", PASS.caixa, "CAIXA");
    expectStatus("CAIXA NAO cria usuarios",
      await save(caixa, restaurantUser("novo.pelo.caixa@local.test", "CAIXA")), [403]);
    expectStatus("CAIXA NAO acessa o Painel Master",
      await call(adminApi, { url: `${BASE}/api/admin/master/overview`, cookie: caixa }), [401, 403, 404]);

    // ---- Environment credential must not survive a stored identity --------
    // Security fix (lib/user-permissions.cjs verifyUserPassword): once an
    // identity is managed in the store, ADMIN_USERS must not remain a second
    // valid password.
    const { verifyUserPassword } = require(path.join(workspaceRoot, "lib/user-permissions.cjs"));
    assert.equal(typeof verifyUserPassword, "function", "verifyUserPassword deve ser exportado para o teste de rotação");
    {
      const envHash = adminAuth.createPasswordHash("senha-do-ambiente-123");
      const storedHash = adminAuth.createPasswordHash("senha-rotacionada-456");
      const configured = [{ login: "rotacao@local.test", passwordHash: envHash, userType: "MASTER", platformScope: true }];
      const storedIdentity = { login: "rotacao@local.test", passwordHash: storedHash, source: "database" };
      assert.equal(verifyUserPassword("senha-rotacionada-456", storedIdentity, configured), true, "senha atual do banco autentica");
      assert.equal(verifyUserPassword("senha-do-ambiente-123", storedIdentity, configured), false, "senha antiga do ambiente NÃO autentica identidade do banco");
      const envIdentity = { login: "rotacao@local.test", passwordHash: envHash, source: "legacy_env" };
      assert.equal(verifyUserPassword("senha-do-ambiente-123", envIdentity, configured), true, "identidade ainda gerida pelo ambiente continua autenticando");
      results.push({ label: "credencial do ambiente não sobrevive à rotação no banco", status: 0, errorCode: "", ok: true });
    }

    console.log(JSON.stringify({ ok: true, checks: results }, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ ok: false, checks: results }, null, 2));
    throw error;
  } finally {
    process.chdir(originalCwd);
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
};

await run();
