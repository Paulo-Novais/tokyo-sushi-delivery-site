"use strict";

// Pizza montada (cardápio do tipo Pizzaria).
//
// O restaurante liga a montagem, escolhe quais seções do cardápio são os
// sabores (cada item = pizza inteira daquele sabor, com o preço dela), quantos
// sabores a pizza pode ter (1, 2, 3 ou 4) e as bordas recheadas com preço.
//
// No pedido, a pizza montada vem com o id
//   pizza|<quantidade de sabores>|<id do sabor>,<id do sabor>|<id da borda ou vazio>
// e o servidor recalcula tudo: preço = sabor MAIS CARO (nunca a soma) + borda.

const PIZZA_ITEM_PREFIX = "pizza|";
const ALLOWED_FLAVOR_COUNTS = Object.freeze([1, 2, 3, 4]);
const MAX_BORDERS = 8;
const MAX_FLAVOR_SECTIONS = 12;
const MAX_BORDER_PRICE = 200;

const text = (value, max = 80) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const slug = (value) =>
  text(value, 60)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const money = (value) => {
  const number = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(number) || number < 0 || number > MAX_BORDER_PRICE) return null;
  return Math.round(number * 100) / 100;
};

const normalizePizzaBuilder = (value) => {
  const source = value && typeof value === "object" ? value : {};
  const counts = [...new Set((Array.isArray(source.flavorCounts) ? source.flavorCounts : [1, 2])
    .map((count) => Number.parseInt(count, 10))
    .filter((count) => ALLOWED_FLAVOR_COUNTS.includes(count)))].sort((a, b) => a - b);
  const sectionIds = [...new Set((Array.isArray(source.flavorSectionIds) ? source.flavorSectionIds : [])
    .map((id) => text(id, 120))
    .filter(Boolean))].slice(0, MAX_FLAVOR_SECTIONS);
  const seenBorders = new Set();
  const borders = (Array.isArray(source.borders) ? source.borders : [])
    .map((border) => {
      const name = text(border?.name, 40);
      const price = money(border?.price);
      if (!name || price === null) return null;
      let id = slug(border?.id || name) || "borda";
      while (seenBorders.has(id)) id = `${id}-2`;
      seenBorders.add(id);
      return { id, name, price };
    })
    .filter(Boolean)
    .slice(0, MAX_BORDERS);
  return {
    enabled: source.enabled === true,
    sizeLabel: text(source.sizeLabel, 40) || "8 pedaços",
    flavorCounts: counts.length ? counts : [1],
    flavorSectionIds: sectionIds,
    borders,
  };
};

const isPizzaItemId = (id) => String(id || "").startsWith(PIZZA_ITEM_PREFIX);

const buildPizzaItemId = (flavorIds = [], borderId = "") =>
  `${PIZZA_ITEM_PREFIX}${flavorIds.length}|${flavorIds.join(",")}|${borderId || ""}`;

const parsePizzaItemId = (id) => {
  const parts = String(id || "").split("|");
  if (parts.length !== 4 || parts[0] !== "pizza") return null;
  const count = Number.parseInt(parts[1], 10);
  const flavorIds = parts[2].split(",").map((entry) => entry.trim()).filter(Boolean);
  return { count, flavorIds, borderId: parts[3].trim() };
};

const fractionLabel = (count) => (count === 2 ? "½" : count === 3 ? "⅓" : count === 4 ? "¼" : "");

const fail = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.errorCode = "invalid_pizza_item";
  throw error;
};

// Confere a pizza montada contra o cardápio e a configuração do restaurante.
// Devolve nome, categoria, preço unitário e o detalhe para a cozinha.
const resolvePizzaItem = (itemId, { itemMap, config } = {}) => {
  const builder = normalizePizzaBuilder(config);
  if (!builder.enabled) fail("A montagem de pizza não está ativa neste restaurante.");
  const parsed = parsePizzaItemId(itemId);
  if (!parsed) fail("Pizza montada inválida.");
  const { count, flavorIds, borderId } = parsed;
  if (!builder.flavorCounts.includes(count)) fail("Quantidade de sabores não permitida.");
  if (flavorIds.length !== count) fail(`Escolha ${count} sabor${count > 1 ? "es" : ""} para a pizza.`);
  if (new Set(flavorIds).size !== flavorIds.length) fail("Não repita o mesmo sabor na pizza.");
  const sections = new Set(builder.flavorSectionIds);
  const flavors = flavorIds.map((flavorId) => {
    const item = itemMap instanceof Map ? itemMap.get(flavorId) : null;
    if (!item) fail("Um dos sabores não existe mais no cardápio.");
    if (!sections.has(item.sectionId)) fail(`${item.name} não é um sabor de pizza.`);
    if (!item.isOrderable) fail(`O sabor ${item.name} não está disponível agora.`);
    if (typeof item.price !== "number") fail(`O sabor ${item.name} está sem preço.`);
    return { id: item.id, name: text(item.name, 80), price: Number(item.price.toFixed(2)) };
  });
  let border = null;
  if (borderId) {
    border = builder.borders.find((entry) => entry.id === borderId) || null;
    if (!border) fail("Borda não encontrada.");
  }
  const topFlavor = flavors.reduce((top, flavor) => (flavor.price > top.price ? flavor : top), flavors[0]);
  const unitPrice = Number((topFlavor.price + (border ? border.price : 0)).toFixed(2));
  const fraction = fractionLabel(count);
  const flavorText = flavors.map((flavor) => `${fraction ? `${fraction} ` : ""}${flavor.name}`).join(" + ");
  const title = count === 1 ? `Pizza ${flavors[0].name}` : `Pizza ${count} sabores`;
  const name = text(
    `${title} (${builder.sizeLabel})${count > 1 ? `: ${flavorText}` : ""}${border ? ` · borda de ${border.name}` : " · sem borda"}`,
    160
  );
  return {
    id: buildPizzaItemId(flavors.map((flavor) => flavor.id), border?.id || ""),
    name,
    category: "Pizza montada",
    unitPrice,
    metadata: {
      pizza: {
        sizeLabel: builder.sizeLabel,
        flavorCount: count,
        flavors,
        chargedFlavorId: topFlavor.id,
        border: border ? { id: border.id, name: border.name, price: border.price } : null,
        rule: "sabor_mais_caro",
      },
    },
  };
};

module.exports = {
  ALLOWED_FLAVOR_COUNTS,
  PIZZA_ITEM_PREFIX,
  buildPizzaItemId,
  isPizzaItemId,
  normalizePizzaBuilder,
  parsePizzaItemId,
  resolvePizzaItem,
};
