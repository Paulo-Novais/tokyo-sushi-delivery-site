const crypto = require("node:crypto");
const { test, expect } = require("@playwright/test");
const { loginMaster, onboardRestaurant, loginTenantOwner, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");
const { verifyLeaseToken } = require("../../lib/pdv-lease.cjs");

// Caixa offline, etapa 1 (servidor): passe de 24 h e ações sem duplicar.
test("Caixa offline (servidor): passe de 24 h e reenvio da fila sem duplicar", async () => {
  test.setTimeout(120_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("offline"),
    name: "Restaurante Offline",
    ownerPassword: "OwnerOffline123!",
  });
  await master.api.dispose();
  const { api } = await loginTenantOwner(restaurant);

  // Passe: precisa do computador identificado; sai assinado e válido por 24 h.
  const invalid = await api.post("/api/admin/pdv/lease", { data: { deviceId: "x" } });
  expect(invalid.status()).toBe(400);
  const leaseResponse = await api.post("/api/admin/pdv/lease", { data: { deviceId: "pc-caixa-teste-01" } });
  expect(leaseResponse.status()).toBe(200);
  const lease = await leaseResponse.json();
  const payload = verifyLeaseToken(lease.lease, process.env.PDV_LEASE_PUBLIC_KEY_E2E);
  expect(payload, "passe assinado pela chave do servidor").toBeTruthy();
  expect(payload.deviceId).toBe("pc-caixa-teste-01");
  expect(payload.expiresAt - payload.issuedAt).toBe(24 * 60 * 60 * 1000);

  // Abre o caixa e envia a mesma sangria duas vezes (como a fila faria após queda).
  const open = await api.post("/api/admin/cash-register/open", {
    data: { openingAmount: 200, serviceChargeRate: 10, tableCount: 4, operationId: `op_${crypto.randomUUID()}` },
  });
  expect(open.status(), JSON.stringify(await open.json().catch(() => ({})))).toBe(200);

  const operationId = `op_${crypto.randomUUID()}`;
  const movement = { type: "SUPPLY", amount: 25, reason: "Troco extra", operationId };
  const first = await (await api.post("/api/admin/cash-register/movement", { data: movement })).json();
  const second = await (await api.post("/api/admin/cash-register/movement", { data: movement })).json();
  expect(first.operation).toEqual({ id: operationId, replayed: false });
  expect(second.operation).toEqual({ id: operationId, replayed: true });
  expect(second.snapshot.movements).toHaveLength(1);
  expect(second.snapshot.registerSummary.supplies).toBe(25);

  // Mesmo código com outro valor: recusado.
  const conflicting = await api.post("/api/admin/cash-register/movement", {
    data: { ...movement, amount: 99 },
  });
  expect(conflicting.status()).toBe(409);
  expect((await conflicting.json()).errorCode).toBe("cash_operation_conflict");

  // Sem operationId: tudo como antes.
  const plain = await api.post("/api/admin/cash-register/movement", {
    data: { type: "SUPPLY", amount: 5, reason: "Sem código" },
  });
  const plainBody = await plain.json();
  expect(plain.status()).toBe(200);
  expect(plainBody.operation).toBeUndefined();
  expect(plainBody.snapshot.movements).toHaveLength(2);
  await api.dispose();
});

test("Caixa offline (servidor): sem login não recebe passe", async ({ request }) => {
  const response = await request.post("/api/admin/pdv/lease", { data: { deviceId: "pc-caixa-teste-01" } });
  expect([401, 403]).toContain(response.status());
});
