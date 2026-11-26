const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveDemoSitePage } = require("../../lib/demo-sites.cjs");
const { isPublicBuildFile } = require("../../lib/public-surface-policy.cjs");
const { parsePublicRestaurantPath } = require("../../lib/tenant-resolution.cjs");

test("demonstração: só a página inicial do slug e só slugs da lista", () => {
  assert.equal(resolveDemoSitePage("aesfiharia", ""), "/demo/aesfiharia/index.html");
  assert.equal(resolveDemoSitePage("aesfiharia", "/"), "/demo/aesfiharia/index.html");
  assert.equal(resolveDemoSitePage("aesfiharia", "/cardapio"), "");
  assert.equal(resolveDemoSitePage("outro-restaurante", ""), "");
});

test("arquivos da demonstração são públicos e /demo não vira restaurante", () => {
  assert.equal(isPublicBuildFile("demo/aesfiharia/index.html"), true);
  assert.equal(isPublicBuildFile("demo/aesfiharia/img/carne2.jpg"), true);
  assert.equal(parsePublicRestaurantPath("/demo/aesfiharia/img/carne2.jpg").recognized, false);
  assert.equal(parsePublicRestaurantPath("/aesfiharia").slug, "aesfiharia");
});
