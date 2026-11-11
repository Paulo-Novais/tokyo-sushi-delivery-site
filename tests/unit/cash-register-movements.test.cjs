// Novo Caixa — sangria, suprimento e observação obrigatória no fechamento.
// Usa o armazenamento local isolado (arquivo temporário), nunca banco remoto.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "..", "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "inovas-cash-movements-"));
fs.mkdirSync(path.join(tempRoot, ".data"), { recursive: true });
fs.copyFileSync(path.join(workspaceRoot, "script.js"), path.join(tempRoot, "script.js"));

const originalCwd = process.cwd();
process.chdir(tempRoot);
process.env.NODE_ENV = "development";
process.env.INOVAS_TENANT_MODE = "default_only";
process.env.INOVAS_CASH_REGISTER_DATA_FILE = path.join(tempRoot, ".data", "cash-register.json");
delete process.env.DATABASE_URL;

const { buildTenantContext } = require(path.join(workspaceRoot, "lib/tenant-context.cjs"));
const cash = require(path.join(workspaceRoot, "lib/cash-register-store.cjs"));

const tenant = (key) => ({
  tenantContext: buildTenantContext(
    {
      host: `${key}.cash-movements.local`,
      restaurantKey: key,
      restaurantName: `Restaurante ${key}`,
      matched: true,
      resolutionMode: "local-validation",
      multiRestaurantActive: true,
    },
    { source: "test:cash-register-movements" }
  ),
});
const actor = {
  identityId: "identity_cash_movement_test",
  login: "operador.teste@inovas.local",
  displayName: "Operador Teste",
};
const optionsA = tenant("mov-a");
const optionsB = tenant("mov-b");

test.after(() => {
  process.chdir(originalCwd);
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

const rejectsWith = (promise, code) =>
  assert.rejects(promise, (error) => error?.errorCode === code, `deveria falhar com ${code}`);

test("sangria e suprimento exigem caixa aberto, valor positivo e motivo", async () => {
  await rejectsWith(
    cash.recordCashMovement({ type: "SUPPLY", amount: 10, reason: "Troco extra" }, actor, optionsA),
    "cash_register_not_open"
  );
  await cash.openCashRegister({ openingAmount: 200, serviceChargeRate: 10, tableCount: 4 }, actor, optionsA);
  await rejectsWith(
    cash.recordCashMovement({ type: "SUPPLY", amount: 0, reason: "Troco extra" }, actor, optionsA),
    "cash_movement_invalid_amount"
  );
  await rejectsWith(
    cash.recordCashMovement({ type: "SUPPLY", amount: 10, reason: "" }, actor, optionsA),
    "cash_movement_reason_required"
  );
  await rejectsWith(
    cash.recordCashMovement({ type: "SALE", amount: 10, reason: "Tipo indevido" }, actor, optionsA),
    "cash_movement_invalid_type"
  );
});

test("sangria e suprimento entram no dinheiro esperado (ESPEC 3.10)", async () => {
  await cash.recordCashMovement({ type: "SUPPLY", amount: 50, reason: "Reforço de troco" }, actor, optionsA);
  await cash.recordCashMovement({ type: "WITHDRAWAL", amount: 80, reason: "Sangria para o cofre" }, actor, optionsA);
  const snapshot = await cash.getCashRegisterSnapshot(optionsA);
  assert.equal(snapshot.registerSummary.supplies, 50);
  assert.equal(snapshot.registerSummary.withdrawals, 80);
  assert.equal(snapshot.registerSummary.expectedCash, 170);
  assert.equal(snapshot.movements.length, 2);
  assert.deepEqual(
    snapshot.movements.map((movement) => movement.movementType).sort(),
    ["SUPPLY", "WITHDRAWAL"]
  );
  assert.ok(snapshot.movements.every((movement) => movement.reason && movement.createdByDisplayName));
});

test("sangria não pode deixar a gaveta negativa", async () => {
  await rejectsWith(
    cash.recordCashMovement({ type: "WITHDRAWAL", amount: 1000, reason: "Retirada grande" }, actor, optionsA),
    "cash_movement_exceeds_drawer"
  );
});

test("restaurante B não vê os movimentos do restaurante A", async () => {
  const snapshotB = await cash.getCashRegisterSnapshot(optionsB);
  assert.equal(snapshotB.register, null);
  assert.deepEqual(snapshotB.movements, []);
  await assert.rejects(cash.recordCashMovement({ type: "SUPPLY", amount: 5, reason: "Sem tenant" }, actor, {}));
});

test("fechamento com diferença exige observação", async () => {
  await rejectsWith(
    cash.closeCashRegister({ countedCash: 160, notes: "" }, actor, optionsA),
    "cash_register_difference_requires_notes"
  );
  const closed = await cash.closeCashRegister(
    { countedCash: 160, notes: "Faltaram R$ 10,00 de troco" },
    actor,
    optionsA
  );
  assert.equal(closed.totals.expectedCash, 170);
  const snapshot = await cash.getCashRegisterSnapshot(optionsA);
  assert.equal(snapshot.lastClosedRegister.differenceAmount, -10);
});

test("fechamento sem diferença não exige observação", async () => {
  await cash.openCashRegister({ openingAmount: 100, serviceChargeRate: 10, tableCount: 2 }, actor, optionsB);
  const closed = await cash.closeCashRegister({ countedCash: 100, notes: "" }, actor, optionsB);
  assert.equal(closed.totals.expectedCash, 100);
});
