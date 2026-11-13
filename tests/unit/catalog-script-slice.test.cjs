// O servidor (lib/catalog-store.cjs) lê o cardápio base executando um trecho do script.js
// num ambiente sem navegador. Se alguém puser código com document/window nesse trecho,
// a API do cardápio quebra para todos os restaurantes ("document is not defined").
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const START = 'const SITE_IMAGES_DIRECTORY = "./site-images";';
const END = "const groupMediaControllers = new Map();";

test("o trecho do cardápio no script.js roda sem navegador e traz o cardápio do Tokyo", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "..", "..", "script.js"), "utf8");
  const start = source.indexOf(START);
  const end = source.indexOf(END);
  assert.ok(start > -1 && end > start, "marcadores do trecho encontrados");
  const sandbox = { module: { exports: {} }, exports: {} };
  vm.runInNewContext(
    `${source.slice(start, end)}\nnormalizeImageFields(MENU_SECTIONS);\nmodule.exports = { MENU_SECTIONS };`,
    sandbox,
    { timeout: 1500 }
  );
  const sections = sandbox.module.exports.MENU_SECTIONS;
  assert.equal(sections.length, 6);
  assert.equal(sections.flatMap((section) => section.items).length, 89);
});
