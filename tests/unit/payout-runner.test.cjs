// Rotina semanal do repasse: fecha a semana anterior, transfere o líquido e
// não transfere de novo se rodar outra vez. Provedor de TESTE, arquivos locais.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "..", "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "inovas-payout-runner-"));
fs.copyFileSync(path.join(workspaceRoot, "script.js"), path.join(tempRoot, "script.js"));
const originalCwd = process.cwd();
process.chdir(tempRoot);
process.env.NODE_ENV = "development";
process.env.INOVAS_TENANT_MODE = "default_only";
process.env.INOVAS_PAYMENT_PROVIDER = "fake";
process.env.INOVAS_PAYOUTS_FILE = path.join(tempRoot, ".data", "payouts.json");
process.env.INOVAS_ONLINE_PAYMENTS_FILE = path.join(tempRoot, ".data", "online-payments.json");
delete process.env.DATABASE_URL;

const { buildTenantContext } = require(path.join(workspaceRoot, "lib/tenant-context.cjs"));
const payouts = require(path.join(workspaceRoot, "lib/payout-store.cjs"));
const { setRecipient } = require(path.join(workspaceRoot, "lib/online-payment-store.cjs"));
const { runWeeklyPayouts } = require(path.join(workspaceRoot, "lib/payout-runner.cjs"));

test.after(() => {
  process.chdir(originalCwd);
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("rotina: fecha a semana anterior, transfere e não repete a transferência", async () => {
  const tenantContext = buildTenantContext(
    { host: "runner.local", restaurantKey: "runner-a", restaurantName: "A", matched: true, resolutionMode: "local-validation", multiRestaurantActive: true },
    { source: "test:runner" }
  );
  const tenant = { tenantId: tenantContext.tenantId, restaurantId: tenantContext.restaurantId, restaurantKey: tenantContext.restaurantKey };
  await setRecipient(tenant, { provider: "fake", recipientId: "re_teste_123" });
  const options = { tenantContext };
  await payouts.recordLedgerEntry(options, { type: "SALE", method: "pix", amountCents: 20000, idempotencyKey: "runner:sale", occurredAt: "2026-11-17T20:00:00-03:00" });
  await payouts.recordLedgerEntry(options, { type: "PROCESSING_FEE", method: "pix", amountCents: 198, idempotencyKey: "runner:fee", occurredAt: "2026-11-17T20:00:00-03:00" });
  await payouts.recordLedgerEntry(options, { type: "SUBSCRIPTION", amountCents: 14990, description: "Novembro", idempotencyKey: "runner:sub", occurredAt: "2026-11-18T08:00:00-03:00" });

  // Quarta 25/11 de manhã: fecha a semana 16–22/11.
  const now = new Date("2026-11-25T12:07:00Z");
  const first = await runWeeklyPayouts({ now });
  assert.equal(first.weekKey, "2026-11-16");
  assert.deepEqual(first.restaurants, [{ restaurantKey: "runner-a", status: "PAID", payoutCents: 20000 - 198 - 14990 }]);

  const second = await runWeeklyPayouts({ now });
  assert.equal(second.restaurants[0].status, "PAID");
  const list = await payouts.listPayouts(options);
  assert.equal(list.length, 1);
  assert.equal(list[0].status, "PAID");
  assert.ok(list[0].providerTransferId.startsWith("fake_tr_"));
  const statement = await payouts.getWeeklyStatement(options, { weekKey: "2026-11-16" });
  assert.equal(statement.status, "PAID");
});
