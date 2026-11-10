const test = require("node:test");
const assert = require("node:assert/strict");
const { buildKasuloCatalog } = require("../../lib/kasulo-bootstrap.cjs");
const { itemSupportsSalesChannel } = require("../../lib/catalog-store.cjs");

test("Kasulo is provisioned with its official menu and dining-only rodizio", () => {
  const catalog = buildKasuloCatalog();
  const items = catalog.sections.flatMap((section) => section.items);
  const rodizio = catalog.sections.find((section) => section.id === "rodizio-salao");

  assert.equal(items.length, 34);
  assert.equal(rodizio.items.length, 4);
  assert.equal(catalog.sections.find((section) => section.id === "pizzas-salgadas").items.length, 20);
  assert.equal(catalog.sections.find((section) => section.id === "pizzas-doces").items.length, 3);
  assert.equal(catalog.sections.find((section) => section.id === "bebidas").items.length, 7);
  assert.equal(items.some((item) => /tokyo|sushi/i.test(item.name)), false);
});

test("rodizio can be sold at the dining cash register but never by delivery", () => {
  const catalog = buildKasuloCatalog();
  const rodizioItems = catalog.sections.find((section) => section.id === "rodizio-salao").items;
  const deliveryItems = catalog.sections
    .flatMap((section) => section.items)
    .filter((item) => itemSupportsSalesChannel(item, "delivery"));

  assert.equal(rodizioItems.every((item) => itemSupportsSalesChannel(item, "dining")), true);
  assert.equal(rodizioItems.some((item) => itemSupportsSalesChannel(item, "delivery")), false);
  assert.equal(deliveryItems.length, 30);
});
