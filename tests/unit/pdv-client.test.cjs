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
