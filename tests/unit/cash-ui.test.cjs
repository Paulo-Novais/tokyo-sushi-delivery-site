const test = require("node:test");
const assert = require("node:assert/strict");
const ui = require("../../admin/cash-ui.js");

test("divide R$ 295,35 por 4 com o centavo na última pessoa (ESPEC 3.7)", () => {
  assert.deepEqual(ui.splitEqually(295.35, 4), [73.84, 73.84, 73.84, 73.83]);
});

test("divisão igual sempre soma o total, inclusive com texto em reais", () => {
  for (const [total, parts] of [["100,00", 3], [0.05, 3], [180.95, 3], [10, 1], ["1.234,56", 7]]) {
    const shares = ui.splitEqually(total, parts);
    assert.equal(shares.length, parts);
    const sum = shares.reduce((acc, value) => acc + ui.toCents(value), 0);
    assert.equal(sum, ui.toCents(total));
    assert.ok(shares.every((value) => value >= 0));
  }
  assert.deepEqual(ui.splitEqually(100, 3), [33.34, 33.34, 33.32]);
});

test("divisão recusa 0 pessoas e valor inválido", () => {
  assert.throws(() => ui.splitEqually(50, 0), RangeError);
  assert.throws(() => ui.splitEqually("abc", 2), RangeError);
});

test("troco e falta em dinheiro", () => {
  assert.deepEqual(ui.cashChange(80.95, 100), { change: 19.05, missing: 0 });
  assert.deepEqual(ui.cashChange(80.95, 50), { change: 0, missing: 30.95 });
  assert.deepEqual(ui.cashChange("80,95", "80,95"), { change: 0, missing: 0 });
});

test("formatação em reais com milhar e centavos", () => {
  assert.equal(ui.formatMoney(1284.5), "R$ 1.284,50");
  assert.equal(ui.formatMoney("73,8"), "R$ 73,80");
  assert.equal(ui.formatMoney(0), "R$ 0,00");
});

test("lançamento rápido 3*12 lança 3 unidades do item 12", () => {
  assert.deepEqual(ui.parseQuickEntry("3*12"), { quantity: 3, query: "12" });
  assert.deepEqual(ui.parseQuickEntry(" 2 x temaki "), { quantity: 2, query: "temaki" });
  assert.deepEqual(ui.parseQuickEntry("12"), { quantity: 1, query: "12" });
  assert.deepEqual(ui.parseQuickEntry("500*7"), { quantity: 99, query: "7" });
});

test("mesas exibidas com dois dígitos e quantidade limitada", () => {
  assert.equal(ui.formatTableNumber(5), "05");
  assert.equal(ui.formatTableNumber(12), "12");
  assert.equal(ui.clampInteger(-3, { min: 0, max: 8 }), 0);
  assert.equal(ui.clampInteger("9", { min: 0, max: 8 }), 8);
  assert.equal(ui.clampInteger("abc", { min: 1, max: 8 }), 1);
});
