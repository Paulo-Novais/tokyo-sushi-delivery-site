// Caixa offline (etapa 1): ação com operationId roda uma vez só.
// Usa armazenamento local isolado (arquivos temporários), nunca banco remoto.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "..", "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "inovas-cash-operations-"));
fs.mkdirSync(path.join(tempRoot, ".data"), { recursive: true });
fs.copyFileSync(path.join(workspaceRoot, "script.js"), path.join(tempRoot, "script.js"));

const originalCwd = process.cwd();
process.chdir(tempRoot);
process.env.NODE_ENV = "development";
process.env.INOVAS_TENANT_MODE = "default_only";
process.env.INOVAS_CASH_REGISTER_DATA_FILE = path.join(tempRoot, ".data", "cash-register.json");
process.env.INOVAS_CASH_OPERATIONS_FILE = path.join(tempRoot, ".data", "cash-register-operations.json");
delete process.env.DATABASE_URL;

const { buildTenantContext } = require(path.join(workspaceRoot, "lib/tenant-context.cjs"));
const cash = require(path.join(workspaceRoot, "lib/cash-register-store.cjs"));
const { runCashOperation, isValidOperationId } = require(path.join(workspaceRoot, "lib/cash-register-operations.cjs"));

const tenant = (key) => ({
  tenantContext: buildTenantContext(
    {
      host: `${key}.cash-operations.local`,
      restaurantKey: key,
      restaurantName: `Restaurante ${key}`,
      matched: true,
      resolutionMode: "local-validation",
      multiRestaurantActive: true,
    },
    { source: "test:cash-register-operations" }
  ),
});
const actor = { identityId: "identity_ops_test", login: "caixa.ops@inovas.local", displayName: "Caixa Ops" };
const optionsA = tenant("ops-a");
const optionsB = tenant("ops-b");
const newOperationId = () => `op_${crypto.randomUUID()}`;

test.after(() => {
  process.chdir(originalCwd);
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

const run = (options, action, body, execute, operationId) =>
  runCashOperation({ operationId, action, body, actor, options, execute });

test("formato do código da operação", () => {
  assert.equal(isValidOperationId(newOperationId()), true);
  assert.equal(isValidOperationId("op_123"), false);
  assert.equal(isValidOperationId(crypto.randomUUID()), false);
});

test("sem operationId: comportamento de sempre (executa toda vez)", async () => {
  let calls = 0;
  const execute = async () => ++calls;
  assert.deepEqual(await run(optionsA, "noop", {}, execute), { result: 1, replayed: false });
  assert.deepEqual(await run(optionsA, "noop", {}, execute), { result: 2, replayed: false });
});

test("reenvio da mesma ação (mesmo operationId) não duplica a movimentação", async () => {
  await cash.openCashRegister({ openingAmount: 100, serviceChargeRate: 10, tableCount: 4 }, actor, optionsA);
  const operationId = newOperationId();
  const body = { type: "SUPPLY", amount: 30, reason: "Troco extra" };
  const execute = () => cash.recordCashMovement(body, actor, optionsA);

  const first = await run(optionsA, "movement", body, execute, operationId);
  const second = await run(optionsA, "movement", body, execute, operationId);
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.deepEqual(second.result, JSON.parse(JSON.stringify(first.result)));

  const snapshot = await cash.getCashRegisterSnapshot(optionsA);
  assert.equal(snapshot.movements.length, 1, "só uma movimentação gravada");
  assert.equal(snapshot.registerSummary.supplies, 30);
});

test("mesmo código com dados diferentes é recusado (409)", async () => {
  const operationId = newOperationId();
  await run(optionsA, "noop", { value: 1 }, async () => "ok", operationId);
  await assert.rejects(run(optionsA, "noop", { value: 2 }, async () => "ok", operationId), {
    errorCode: "cash_operation_conflict",
  });
  await assert.rejects(run(optionsA, "outra", { value: 1 }, async () => "ok", operationId), {
    errorCode: "cash_operation_conflict",
  });
});

test("ordem dos campos não muda a impressão digital da ação", async () => {
  const operationId = newOperationId();
  await run(optionsA, "noop", { a: 1, b: { c: 2, d: 3 } }, async () => "ok", operationId);
  const again = await run(optionsA, "noop", { b: { d: 3, c: 2 }, a: 1 }, async () => "ok", operationId);
  assert.equal(again.replayed, true);
});

test("erro de regra (4xx) fica guardado: reenviar devolve o mesmo erro sem executar de novo", async () => {
  const operationId = newOperationId();
  const body = { type: "SUPPLY", amount: 0, reason: "Valor inválido" };
  let calls = 0;
  const execute = () => {
    calls += 1;
    return cash.recordCashMovement(body, actor, optionsA);
  };
  await assert.rejects(run(optionsA, "movement", body, execute, operationId), {
    errorCode: "cash_movement_invalid_amount",
  });
  await assert.rejects(run(optionsA, "movement", body, execute, operationId), (error) =>
    error.errorCode === "cash_movement_invalid_amount" && error.replayed === true
  );
  assert.equal(calls, 1);
});

test("erro de servidor/conexão (5xx) libera o código para tentar de novo", async () => {
  const operationId = newOperationId();
  let calls = 0;
  const flaky = async () => {
    calls += 1;
    if (calls === 1) throw Object.assign(new Error("banco fora"), { statusCode: 503 });
    return "gravado";
  };
  await assert.rejects(run(optionsA, "noop", {}, flaky, operationId));
  const retry = await run(optionsA, "noop", {}, flaky, operationId);
  assert.deepEqual(retry, { result: "gravado", replayed: false });
  assert.equal(calls, 2);
});

test("restaurantes isolados: o mesmo código em outro restaurante é outra operação", async () => {
  const operationId = newOperationId();
  const inA = await run(optionsA, "noop", {}, async () => "A", operationId);
  const inB = await run(optionsB, "noop", {}, async () => "B", operationId);
  assert.deepEqual(inA, { result: "A", replayed: false });
  assert.deepEqual(inB, { result: "B", replayed: false });
});

test("código inválido é recusado antes de executar", async () => {
  let calls = 0;
  await assert.rejects(run(optionsA, "noop", {}, async () => ++calls, "nao-e-um-codigo"), {
    errorCode: "cash_operation_id_invalid",
  });
  assert.equal(calls, 0);
});
