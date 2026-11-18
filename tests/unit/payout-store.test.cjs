// Repasse semanal: lançamentos sem duplicar, isolamento entre restaurantes e
// fechamento da semana. Armazenamento local temporário (nunca banco remoto).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "..", "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "inovas-payouts-"));
fs.copyFileSync(path.join(workspaceRoot, "script.js"), path.join(tempRoot, "script.js"));
const originalCwd = process.cwd();
process.chdir(tempRoot);
process.env.NODE_ENV = "development";
process.env.INOVAS_TENANT_MODE = "default_only";
process.env.INOVAS_PAYOUTS_FILE = path.join(tempRoot, ".data", "payouts.json");
delete process.env.DATABASE_URL;

const { buildTenantContext } = require(path.join(workspaceRoot, "lib/tenant-context.cjs"));
const store = require(path.join(workspaceRoot, "lib/payout-store.cjs"));

const tenant = (key) => ({
  tenantContext: buildTenantContext(
    { host: `${key}.payouts.local`, restaurantKey: key, restaurantName: key, matched: true, resolutionMode: "local-validation", multiRestaurantActive: true },
    { source: "test:payouts" }
  ),
});
const A = tenant("repasse-a");
const B = tenant("repasse-b");

test.after(() => {
  process.chdir(originalCwd);
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

const at = (iso) => `${iso}-03:00`;

test("lançamento com a mesma chave não duplica; restaurante B não vê o extrato de A", async () => {
  const sale = { type: "SALE", method: "pix", amountCents: 12000, orderId: "o1", orderPublicId: "#1", idempotencyKey: "pay_1:sale", occurredAt: at("2026-11-17T20:00:00") };
  const first = await store.recordLedgerEntry(A, sale);
  const again = await store.recordLedgerEntry(A, sale);
  assert.equal(first.replayed, false);
  assert.equal(again.replayed, true);
  assert.equal(again.entry.id, first.entry.id);
  await store.recordLedgerEntry(A, { type: "PROCESSING_FEE", method: "pix", amountCents: 119, orderId: "o1", idempotencyKey: "pay_1:fee", occurredAt: at("2026-11-17T20:00:00") });

  const statementA = await store.getWeeklyStatement(A, { weekKey: "2026-11-16" });
  assert.equal(statementA.totals.grossSalesCents, 12000);
  assert.equal(statementA.payoutCents, 11881);
  assert.equal(statementA.status, "OPEN");
  const statementB = await store.getWeeklyStatement(B, { weekKey: "2026-11-16" });
  assert.equal(statementB.totals.grossSalesCents, 0);
  // Mesma chave em outro restaurante é outro lançamento.
  const inB = await store.recordLedgerEntry(B, sale);
  assert.equal(inB.replayed, false);
});

test("validação: tipo, valor, forma de pagamento e descrição de débito", async () => {
  await assert.rejects(store.recordLedgerEntry(A, { type: "X", amountCents: 1, idempotencyKey: "k-invalid-1" }), { errorCode: "ledger_entry_type_invalid" });
  await assert.rejects(store.recordLedgerEntry(A, { type: "DEBT", amountCents: 0, description: "x", idempotencyKey: "k-invalid-2" }), { errorCode: "ledger_entry_amount_invalid" });
  await assert.rejects(store.recordLedgerEntry(A, { type: "SALE", method: "dinheiro", amountCents: 100, idempotencyKey: "k-invalid-3" }), { errorCode: "ledger_entry_method_invalid" });
  await assert.rejects(store.recordLedgerEntry(A, { type: "DEBT", amountCents: 100, idempotencyKey: "k-invalid-4" }), { errorCode: "ledger_entry_description_required" });
  await assert.rejects(store.recordLedgerEntry(A, { type: "CREDIT", amountCents: 100, description: "x" }), { errorCode: "ledger_entry_idempotency_required" });
});

test("fechamento: só depois do domingo; congela o extrato; saldo devedor vai para a semana seguinte", async () => {
  await store.recordLedgerEntry(A, { type: "SUBSCRIPTION", amountCents: 14990, description: "Novembro/2026", idempotencyKey: "sub:2026-11", occurredAt: at("2026-11-18T09:00:00") });
  await assert.rejects(store.closeWeek(A, { weekKey: "2026-11-16", now: new Date("2026-11-20T12:00:00Z") }), { errorCode: "payout_week_not_finished" });

  const closed = await store.closeWeek(A, { weekKey: "2026-11-16", actorLogin: "rotina", now: new Date("2026-11-24T12:00:00Z") });
  // 12000 - 119 - 14990 = -3109 -> nada a repassar, saldo devedor -3109.
  assert.equal(closed.payout.status, "NOTHING_TO_PAY");
  assert.equal(closed.payout.payoutCents, 0);
  assert.equal(closed.payout.carryOverCents, -3109);
  assert.equal(closed.payout.payoutDate, "2026-11-25");
  const again = await store.closeWeek(A, { weekKey: "2026-11-16", now: new Date("2026-11-24T12:00:00Z") });
  assert.equal(again.replayed, true);

  // Lançamento atrasado na semana fechada não muda o extrato congelado.
  await store.recordLedgerEntry(A, { type: "CREDIT", amountCents: 100, description: "tarde", idempotencyKey: "late-credit-1", occurredAt: at("2026-11-19T09:00:00") });
  const frozen = await store.getWeeklyStatement(A, { weekKey: "2026-11-16" });
  assert.equal(frozen.closed, true);
  assert.equal(frozen.netCents, -3109);

  // Semana seguinte começa com o saldo devedor discriminado.
  await store.recordLedgerEntry(A, { type: "SALE", method: "credit_card", amountCents: 20000, idempotencyKey: "pay_2:sale", occurredAt: at("2026-11-24T20:00:00") });
  const next = await store.getWeeklyStatement(A, { weekKey: "2026-11-23" });
  assert.equal(next.lines[0].label, "Saldo devedor da semana anterior");
  assert.equal(next.payoutCents, 20000 - 3109);

  const list = await store.listPayouts(A);
  assert.equal(list.length, 1);
  assert.equal(list[0].statement, undefined, "lista sem o extrato completo");
  assert.equal((await store.listPayouts(B)).length, 0);
});
