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
