const test = require("node:test");
const assert = require("node:assert/strict");
const { buildForecast, normalizePhoneForWhatsapp } = require("../../lib/forecast.cjs");

const DAY = 86400000;
// "Agora": sexta 20/11/2026 às 21h no horário da loja (UTC-3) = 00h UTC do dia 21.
const NOW = new Date("2026-11-21T00:00:00Z");
// Gera um pedido às 20h (horário da loja) N dias antes de hoje.
const at = (daysAgo, hour = 20) => new Date(Date.UTC(2026, 10, 20 - daysAgo, hour + 3, 0, 0)).toISOString();

const weekdayFactor = [0.6, 0.5, 0.6, 0.7, 0.9, 1.4, 1.6]; // dom..sáb
const buildOrders = () => {
  const orders = [];
  for (let d = 1; d <= 120; d += 1) {
    const date = new Date(Date.UTC(2026, 10, 20 - d));
    const count = Math.round(10 * weekdayFactor[date.getUTCDay()]);
    for (let i = 0; i < count; i += 1) {
      orders.push({
        createdAt: at(d, 18 + (i % 4)),
        status: "Finalizado",
        total: 100,
        customerKey: `phone:5511900000${String(i).padStart(3, "0")}`,
        customerName: `Cliente ${i}`,
        customerPhone: `11900000${String(i).padStart(3, "0")}`,
        channel: "site",
        items: [{ name: i % 2 ? "Hot Roll" : "Combinado Kumo", quantity: 1, totalPrice: 100 }],
      });
    }
  }
  return orders;
};

test("previsão de vendas segue o padrão do dia da semana e acerta o histórico", () => {
  const result = buildForecast({ orders: buildOrders(), now: NOW });
  assert.equal(result.hasEnoughHistory, true);
  const future = result.sales.days.filter((d) => !d.isPast);
  assert.equal(future.length, 14);
  const saturday = future.find((d) => d.weekday === 6);
  const monday = future.find((d) => d.weekday === 1);
  assert.ok(saturday.forecast > monday.forecast * 2, "sábado prevê bem mais que segunda");
  assert.ok(Math.abs(saturday.forecast - 1600) < 120, `sábado ~R$ 1.600, veio ${saturday.forecast}`);
  assert.ok(saturday.low <= saturday.forecast && saturday.high >= saturday.forecast);
  assert.ok(result.sales.kpis.accuracyPct >= 90, `acerto alto em dado regular: ${result.sales.kpis.accuracyPct}`);
  assert.equal(result.sales.peak.weekdayName, "sábado");
  assert.ok(result.sales.dishes.length >= 2);
});

test("cancelados não entram e sem histórico não quebra", () => {
  const empty = buildForecast({ orders: [], now: NOW });
  assert.equal(empty.hasEnoughHistory, false);
  assert.equal(empty.sales.kpis.next7, 0);
  assert.equal(empty.customers.count, 0);

  const orders = buildOrders().map((o) => ({ ...o, status: "Cancelado" }));
  const cancelled = buildForecast({ orders, now: NOW });
  assert.equal(cancelled.sales.kpis.lastWeek, 0);
});

test("cliente que pedia toda semana e quase parou aparece como frequência caindo", () => {
  const orders = buildOrders();
  // Carlos: 1 pedido por semana entre 120 e 31 dias atrás, e só 1 nos últimos 30.
  for (let d = 35; d <= 118; d += 7) {
    orders.push({ createdAt: at(d), status: "Finalizado", total: 80, customerKey: "phone:5511988887777", customerName: "Carlos", customerPhone: "(11) 98888-7777", items: [{ name: "Combinado Kumo", quantity: 2, totalPrice: 80 }] });
  }
  orders.push({ createdAt: at(10), status: "Finalizado", total: 80, customerKey: "phone:5511988887777", customerName: "Carlos", customerPhone: "(11) 98888-7777", items: [{ name: "Combinado Kumo", quantity: 1, totalPrice: 80 }] });
  const result = buildForecast({ orders, now: NOW });
  const carlos = result.customers.customers.find((c) => c.name === "Carlos");
  assert.ok(carlos, "Carlos está na lista");
  assert.equal(carlos.nowMonthly, 1);
  assert.ok(carlos.beforeMonthly >= 3);
  assert.equal(carlos.favorite, "Combinado Kumo");
  assert.equal(carlos.whatsapp, "5511988887777");
  assert.equal(carlos.lastOrderDays, 10);
  // Clientes regulares (que continuam pedindo) não aparecem.
  assert.ok(!result.customers.customers.some((c) => c.name === "Cliente 0"));
});

test("fechamento do mês soma o realizado e projeta o resto", () => {
  const result = buildForecast({ orders: buildOrders(), now: NOW });
  assert.equal(result.month.daysInMonth, 30);
  assert.ok(result.month.actualToDate > 0);
  assert.ok(result.month.projectedClose > result.month.actualToDate);
  assert.equal(result.month.actual.length, 30);
});

test("alerta quando as últimas horas vêm bem abaixo do normal", () => {
  const orders = buildOrders();
  // Hoje (sexta) às 21h: nenhum pedido; nas sextas anteriores, ~9 por dia entre 18h e 21h.
  const result = buildForecast({ orders, now: NOW });
  assert.ok(result.todayAlert.series.length > 0);
  assert.ok(result.todayAlert.alert, "deve alertar queda");
  assert.match(result.todayAlert.alert.title, /abaixo do normal/);
});

test("orientação de estoque usa mínimo e validade", () => {
  const result = buildForecast({
    orders: [],
    now: NOW,
    inventoryItems: [
      { name: "Salmão", quantity: 2, minimumQuantity: 6, unit: "kg", status: { key: "critical" }, expiration: {} },
      { name: "Cream cheese", quantity: 5, minimumQuantity: 1, unit: "kg", status: { key: "ok" }, expiration: { isExpiringSoon: true, label: "Vence em 2 dia(s)" } },
      { name: "Arroz", quantity: 20, minimumQuantity: 5, unit: "kg", status: { key: "ok" }, expiration: {} },
    ],
  });
  assert.deepEqual(result.inventory.buyMore.map((i) => i.name), ["Salmão"]);
  assert.deepEqual(result.inventory.buyLess.map((i) => i.name), ["Cream cheese"]);
});

test("telefone para WhatsApp", () => {
  assert.equal(normalizePhoneForWhatsapp("(11) 98888-7777"), "5511988887777");
  assert.equal(normalizePhoneForWhatsapp("5511988887777"), "5511988887777");
  assert.equal(normalizePhoneForWhatsapp("123"), "");
});

// ---- Fase 2: ficha técnica, lucro por prato e matéria-prima ----
const { dishKey } = require("../../lib/forecast.cjs");

const costItems = [
  { id: "salmao", name: "Salmão", unit: "kg", quantity: 2, minimumQuantity: 3, unitCost: 80, expiration: {} },
  { id: "arroz", name: "Arroz", unit: "kg", quantity: 50, minimumQuantity: 5, unitCost: 10, expiration: {} },
  { id: "cream", name: "Cream cheese", unit: "kg", quantity: 6, minimumQuantity: 1, unitCost: 40, expiration: {} },
];
const costRecipes = [
  { key: dishKey("Combinado Kumo"), dishName: "Combinado Kumo", ingredients: [{ itemId: "salmao", quantity: 0.2 }, { itemId: "arroz", quantity: 0.2 }], packagingCost: 2 },
  { key: dishKey("Hot Roll"), dishName: "Hot Roll", ingredients: [{ itemId: "cream", quantity: 0.4 }, { itemId: "salmao", quantity: 0.05 }], packagingCost: 1 },
];
const costOrders = () => {
  const orders = [];
  for (let d = 1; d <= 60; d += 1) {
    orders.push({ createdAt: at(d), status: "Finalizado", total: 100, channel: "site", items: [{ name: "Combinado Kumo", quantity: 1, totalPrice: 72 }] });
    orders.push({ createdAt: at(d, 21), status: "Finalizado", total: 20, channel: "ifood", items: [{ name: "Hot Roll", quantity: 1, totalPrice: 20 }] });
    orders.push({ createdAt: at(d, 19), status: "Finalizado", total: 30, channel: "site", items: [{ name: "Yakissoba", quantity: 1, totalPrice: 30 }] });
  }
  return orders;
};

test("lucro por prato: custo da ficha, taxa do canal e prejuízo", () => {
  const result = buildForecast({ orders: costOrders(), now: NOW, inventoryItems: costItems, recipes: costRecipes, costSettings: { channelFees: { site: 0, ifood: 27 } } });
  const kumo = result.profit.rows.find((r) => r.name === "Combinado Kumo");
  const hot = result.profit.rows.find((r) => r.name === "Hot Roll");
  // Kumo: 0,2×80 + 0,2×10 + 2 = 20 de custo; preço 72 no site (sem taxa) → lucro 52 por unidade.
  assert.equal(kumo.unitCost, 20);
  assert.equal(kumo.unitProfit, 52);
  assert.equal(kumo.qty, 30);
  // Hot Roll no iFood: 0,4×40 + 0,05×80 + 1 = 21 de custo; 20 − 27% de taxa − 21 = prejuízo.
  assert.equal(hot.unitCost, 21);
  assert.ok(hot.profit < 0);
  assert.equal(hot.tone, "bad");
  assert.ok(hot.targetPrice > 20);
  assert.equal(result.profit.losing, 1);
  assert.ok(result.profit.followTotal > result.profit.currentTotal);
  // Prato sem ficha aparece separado.
  assert.deepEqual(result.profit.withoutRecipe.map((r) => r.name), ["Yakissoba"]);
});

test("matéria-prima: consumo previsto, faltas e perdas do histórico", () => {
  const movements = [
    { at: at(10), itemId: "salmao", mode: "remove", amount: 3, quantityAfter: 0, unitCost: 80 },
    { at: at(10, 22), itemId: "salmao", mode: "remove", amount: 0, quantityAfter: 0, unitCost: 80 },
    { at: at(20), itemId: "cream", mode: "loss", amount: 1.5, quantityAfter: 6, unitCost: 40 },
  ];
  const result = buildForecast({ orders: costOrders(), now: NOW, inventoryItems: costItems, recipes: costRecipes, movements });
  const salmao = result.rawMaterials.rows.find((r) => r.itemId === "salmao");
  const cream = result.rawMaterials.rows.find((r) => r.itemId === "cream");
  // 7 dias: 7 Kumo × 0,2 + 7 Hot Roll × 0,05 = 1,75 kg; tem 2, mínimo 3 → comprar 2,75.
  assert.equal(salmao.need7, 1.75);
  assert.equal(salmao.toBuy, 2.75);
  assert.equal(salmao.ruptures, 1, "zerou 2 vezes no mesmo dia conta 1");
  assert.equal(salmao.kind, "more");
  assert.equal(cream.lossValue, 60);
  assert.equal(cream.kind, "less");
  assert.equal(result.rawMaterials.lossValue60, 60);
});

test("chave do prato igual à do estoque (acentos e espaços)", () => {
  assert.equal(dishKey("  Teppan  Salmão "), "teppan-salmao");
});
