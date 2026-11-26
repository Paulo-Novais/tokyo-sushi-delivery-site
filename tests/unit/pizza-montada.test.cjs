const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPizzaItemId, normalizePizzaBuilder, resolvePizzaItem } = require("../../lib/pizza-builder.cjs");
const { normalizeOrderSubmission } = require("../../lib/order-payload.cjs");

const flavor = (id, name, price, sectionId = "pizzas-salgadas", extra = {}) => [
  id,
  { id, name, price, sectionId, isOrderable: true, category: "Pizzas Salgadas", ...extra },
];
const itemMap = new Map([
  flavor("calabresa", "Calabresa", 52.9),
  flavor("camarao", "Camarão", 79.9),
  flavor("frango", "Frango com Catupiry", 59.9),
  flavor("mucarela", "Muçarela", 49.9),
  flavor("chocolate", "Chocolate", 49.9, "pizzas-doces"),
  flavor("pausada", "Pausada", 40, "pizzas-salgadas", { isOrderable: false }),
  ["coca", { id: "coca", name: "Coca 2L", price: 14.9, sectionId: "bebidas", isOrderable: true, category: "Bebidas" }],
]);
const config = {
  enabled: true,
  sizeLabel: "8 pedaços",
  flavorCounts: [1, 2, 4],
  flavorSectionIds: ["pizzas-salgadas", "pizzas-doces"],
  borders: [
    { name: "Catupiry", price: 9 },
    { name: "Cheddar", price: "9,00" },
    { name: "Muçarela", price: 8 },
  ],
};

test("configuração: limpa valores e cria ids das bordas", () => {
  const normalized = normalizePizzaBuilder({ ...config, flavorCounts: [4, 2, 2, 9, "1"] });
  assert.deepEqual(normalized.flavorCounts, [1, 2, 4]);
  assert.deepEqual(normalized.borders.map((border) => border.id), ["catupiry", "cheddar", "mucarela"]);
  assert.equal(normalized.borders[1].price, 9);
  assert.equal(normalizePizzaBuilder(null).enabled, false);
});

test("2 sabores: cobra o mais caro, não a soma; borda soma por cima", () => {
  const pizza = resolvePizzaItem(buildPizzaItemId(["calabresa", "camarao"], "mucarela"), { itemMap, config });
  assert.equal(pizza.unitPrice, 87.9);
  assert.equal(pizza.metadata.pizza.chargedFlavorId, "camarao");
  assert.match(pizza.name, /½ Calabresa \+ ½ Camarão/);
  assert.match(pizza.name, /borda de Muçarela/);
});

test("1 sabor sem borda = preço do sabor", () => {
  const pizza = resolvePizzaItem(buildPizzaItemId(["mucarela"], ""), { itemMap, config });
  assert.equal(pizza.unitPrice, 49.9);
  assert.match(pizza.name, /^Pizza Muçarela \(8 pedaços\) · sem borda$/);
});

test("4 sabores: ¼ de cada e preço do mais caro", () => {
  const pizza = resolvePizzaItem(buildPizzaItemId(["calabresa", "frango", "mucarela", "chocolate"], "catupiry"), { itemMap, config });
  assert.equal(pizza.unitPrice, 68.9);
  assert.match(pizza.name, /¼ Calabresa/);
});

test("recusa: quantidade não liberada, sabor repetido, fora das seções, pausado, borda inventada, desligado", () => {
  assert.throws(() => resolvePizzaItem("pizza|3|calabresa,camarao,frango|", { itemMap, config }), /Quantidade de sabores/);
  assert.throws(() => resolvePizzaItem("pizza|2|calabresa,calabresa|", { itemMap, config }), /Não repita/);
  assert.throws(() => resolvePizzaItem("pizza|2|calabresa,coca|", { itemMap, config }), /não é um sabor/);
  assert.throws(() => resolvePizzaItem("pizza|2|calabresa,pausada|", { itemMap, config }), /não está disponível/);
  assert.throws(() => resolvePizzaItem("pizza|2|calabresa,camarao|ouro", { itemMap, config }), /Borda não encontrada/);
  assert.throws(() => resolvePizzaItem("pizza|2|calabresa|", { itemMap, config }), /Escolha 2 sabores/);
  assert.throws(() => resolvePizzaItem("pizza|1|calabresa|", { itemMap, config: { ...config, enabled: false } }), /não está ativa/);
});

test("pedido: o preço enviado pelo navegador é ignorado e recalculado", () => {
  const order = normalizeOrderSubmission(
    {
      profile: { id: "p1", name: "Cliente", phone: "(16) 99999-0000", email: "c@x.test" },
      items: [
        { id: buildPizzaItemId(["calabresa", "camarao"], "catupiry"), name: "qualquer", price: 1, quantity: 2 },
        { id: "coca", quantity: 1, price: 0.01 },
      ],
      checkout: { customerName: "Cliente", customerPhone: "(16) 99999-0000", paymentMethod: "pix", fulfillmentMode: "pickup", timingMode: "immediate" },
    },
    { itemMap, pizzaBuilder: config }
  );
  const pizza = order.items.find((item) => item.category === "Pizza montada");
  assert.equal(pizza.unitPrice, 88.9);
  assert.equal(pizza.totalPrice, 177.8);
  assert.equal(order.items.find((item) => item.id === "coca").unitPrice, 14.9);
});

test("borda grátis (R$ 0) é aceita e não muda o preço", () => {
  const free = { ...config, borders: [{ name: "Catupiry", price: "0" }, { name: "Cheddar", price: 0 }] };
  assert.deepEqual(normalizePizzaBuilder(free).borders.map((border) => border.price), [0, 0]);
  const pizza = resolvePizzaItem(buildPizzaItemId(["calabresa", "camarao"], "cheddar"), { itemMap, config: free });
  assert.equal(pizza.unitPrice, 79.9);
  assert.match(pizza.name, /borda de Cheddar/);
});
