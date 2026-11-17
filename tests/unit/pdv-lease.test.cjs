const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { LEASE_TTL_MS, createLeaseToken, verifyLeaseToken } = require("../../lib/pdv-lease.cjs");

// Chaves só para teste (geradas na hora).
const keys = crypto.generateKeyPairSync("ed25519");
const privateKeyPem = keys.privateKey.export({ type: "pkcs8", format: "pem" });
const publicKeyPem = keys.publicKey.export({ type: "spki", format: "pem" });
const base = {
  restaurantId: "rest_a",
  tenantId: "tenant_a",
  deviceId: "pc-caixa-1",
  subscriptionActive: true,
  privateKeyPem,
};

test("passe válido por 24 h, conferido com a chave pública", () => {
  const now = Date.UTC(2026, 10, 17, 12);
  const { token, payload } = createLeaseToken({ ...base, now });
  assert.equal(payload.expiresAt - payload.issuedAt, LEASE_TTL_MS);
  assert.deepEqual(verifyLeaseToken(token, publicKeyPem), payload);
});

test("assinatura vencida não renova o passe", () => {
  assert.throws(() => createLeaseToken({ ...base, subscriptionActive: false }), {
    errorCode: "pdv_subscription_inactive",
  });
});

test("passe editado no computador (prazo esticado) é recusado", () => {
  const { token } = createLeaseToken(base);
  const [body, signature] = token.split(".");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  payload.expiresAt += 7 * 24 * 60 * 60 * 1000;
  const forged = `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${signature}`;
  assert.equal(verifyLeaseToken(forged, publicKeyPem), null);
});

test("passe assinado com outra chave é recusado", () => {
  const other = crypto.generateKeyPairSync("ed25519");
  const { token } = createLeaseToken({
    ...base,
    privateKeyPem: other.privateKey.export({ type: "pkcs8", format: "pem" }),
  });
  assert.equal(verifyLeaseToken(token, publicKeyPem), null);
});

test("lixo e formatos estranhos não quebram e são recusados", () => {
  for (const token of ["", "abc", "a.b.c", "....", null, undefined]) {
    assert.equal(verifyLeaseToken(token, publicKeyPem), null);
  }
});

test("passe com prazo maior que 24 h é recusado mesmo assinado", () => {
  const { token } = createLeaseToken({ ...base, ttlMs: LEASE_TTL_MS * 2 });
  assert.equal(verifyLeaseToken(token, publicKeyPem), null);
});
