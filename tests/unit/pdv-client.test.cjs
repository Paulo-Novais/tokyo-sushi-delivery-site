const test = require("node:test");
const assert = require("node:assert/strict");
const { isPdvAppRequest, isPdvAppRequiredFor } = require("../../lib/pdv-client.cjs");

const req = (headers) => ({ headers });

test("reconhece o app pelo cabeçalho ou pelo User-Agent", () => {
  assert.equal(isPdvAppRequest(req({ "x-inovas-client": "inovas-pdv-desktop" })), true);
  assert.equal(isPdvAppRequest(req({ "user-agent": "Mozilla/5.0 Chrome/140 Electron/45 InovasPDV/0.2.1" })), true);
  assert.equal(isPdvAppRequest(req({ "user-agent": "Mozilla/5.0 Chrome/140" })), false);
  assert.equal(isPdvAppRequest(req({ "x-inovas-client": "outro" })), false);
  assert.equal(isPdvAppRequest(req({})), false);
});

test("chave INOVAS_REQUIRE_PDV_APP: desligada por padrão, 'on' para todos, prefixo para testes", () => {
  const saved = process.env.INOVAS_REQUIRE_PDV_APP;
  try {
    delete process.env.INOVAS_REQUIRE_PDV_APP;
    assert.equal(isPdvAppRequiredFor("tokyo-sushi"), false);
    process.env.INOVAS_REQUIRE_PDV_APP = "on";
    assert.equal(isPdvAppRequiredFor("tokyo-sushi"), true);
    assert.equal(isPdvAppRequiredFor("restaurante-novo"), true);
    process.env.INOVAS_REQUIRE_PDV_APP = "prefix:somenteapp-";
    assert.equal(isPdvAppRequiredFor("somenteapp-abc"), true);
    assert.equal(isPdvAppRequiredFor("tokyo-sushi"), false);
    process.env.INOVAS_REQUIRE_PDV_APP = "off";
    assert.equal(isPdvAppRequiredFor("tokyo-sushi"), false);
  } finally {
    if (saved === undefined) delete process.env.INOVAS_REQUIRE_PDV_APP;
    else process.env.INOVAS_REQUIRE_PDV_APP = saved;
  }
});

test("app do garçom: reconhecido à parte e só com ações de garçom", () => {
  const { isWaiterAppRequest, isWaiterAppCashAction } = require("../../lib/pdv-client.cjs");
  const android = req({ "user-agent": "Mozilla/5.0 (Linux; Android 14) Chrome/140 Mobile InovasGarcom/1.0.0" });
  assert.equal(isWaiterAppRequest(android), true);
  assert.equal(isWaiterAppRequest(req({ "x-inovas-client": "inovas-garcom-android" })), true);
  assert.equal(isPdvAppRequest(android), false, "garçom não vale como Gestor do PC");
  assert.equal(isWaiterAppRequest(req({ "x-inovas-client": "inovas-pdv-desktop" })), false);
  for (const action of ["snapshot", "open-tab", "update-tab", "add-item", "update-item", "remove-item", "send-order"]) {
    assert.equal(isWaiterAppCashAction(action), true, action);
  }
  for (const action of ["open", "close", "movement", "begin-closing", "confirm-payment", "reopen-tab", "add-table", "counter-order"]) {
    assert.equal(isWaiterAppCashAction(action), false, action);
  }
});
