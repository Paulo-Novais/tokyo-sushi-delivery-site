// CRM de clientes: mesas do salão sem identificação não viram "cliente",
// e cada cliente recebe um segmento (Novo, Recorrente, VIP, Em risco, Sumido).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const crm = require(path.resolve(__dirname, "..", "..", "lib", "customer-crm-store.cjs"));

const NOW = new Date("2026-11-12T22:00:00.000Z");
const daysAgo = (days) => new Date(NOW.getTime() - days * 86400000).toISOString();
let seq = 0;
const order = ({ phone = "", name = "Cliente", days = 0, total = 100, mode = "delivery", status = "Entregue" } = {}) => ({
  id: `o${(seq += 1)}`,
  publicId: `#${seq}`,
  customerName: name,
  customerPhone: phone,
  status,
  fulfillmentMode: mode,
  orderType: mode === "dining" ? "Salao" : "Delivery",
  totalAmount: total,
  createdAt: daysAgo(days),
  customerKey: mode === "dining" && !phone ? `dining-tab:t${seq}` : "",
});

test("mesas do salão sem telefone ficam fora da base e aparecem no resumo", () => {
  const orders = [
    order({ phone: "16990000001", name: "Ana", days: 1 }),
    order({ name: "Mesa 4", mode: "dining", total: 60 }),
    order({ name: "Mesa 7", mode: "dining", total: 40 }),
    order({ name: "Mesa 2", mode: "dining", total: 99, status: "Cancelado" }),
  ];
  const customers = crm.buildCustomerRecords({ orders, profiles: [], now: NOW });
  assert.deepEqual(customers.map((c) => c.customerName), ["Ana"]);

  const summary = crm.buildSummary(customers, { orders });
  assert.equal(summary.totalCustomers, 1);
  // Cancelado não entra no valor.
  assert.deepEqual(summary.unidentifiedDining, { orders: 2, total: 100 });
});

test("mesa com telefone vinculado conta como cliente", () => {
  const orders = [order({ phone: "16990000009", name: "Bia", mode: "dining" })];
  const customers = crm.buildCustomerRecords({ orders, profiles: [], now: NOW });
  assert.equal(customers.length, 1);
});

test("segmentos por recência, frequência e marcação VIP", () => {
  const orders = [
    order({ phone: "1", name: "Novo", days: 6 }),
    order({ phone: "2", name: "Rec", days: 3 }),
    order({ phone: "2", name: "Rec", days: 20 }),
    order({ phone: "3", name: "Vip", days: 0 }),
    order({ phone: "4", name: "Risco", days: 38 }),
    order({ phone: "4", name: "Risco", days: 50 }),
    order({ phone: "5", name: "Sumido", days: 95 }),
    order({ phone: "6", name: "VipSumido", days: 70 }),
    order({ phone: "7", name: "SoCancelou", days: 2, status: "Cancelado" }),
  ];
  const profiles = [
    { customerKey: "phone:3", tags: ["vip"] },
    { customerKey: "phone:6", tags: ["vip"] },
  ];
  const customers = crm.buildCustomerRecords({ orders, profiles, now: NOW });
  const byName = Object.fromEntries(customers.map((c) => [c.customerName, c.segment]));
  assert.deepEqual(byName, {
    Novo: "novo",
    Rec: "recorrente",
    Vip: "vip",
    Risco: "em-risco",
    Sumido: "sumido",
    VipSumido: "sumido",
    SoCancelou: "novo",
  });

  const summary = crm.buildSummary(customers, { orders });
  assert.deepEqual(summary.segments, { novo: 2, recorrente: 1, vip: 1, "em-risco": 1, sumido: 2 });
  // Compraram 2+ vezes: Rec e Risco = 2 de 6 que compraram (SoCancelou não comprou).
  assert.equal(summary.returnRate, 33);
});
