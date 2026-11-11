// Operação cheia simulada para a tela de Pedidos (só no navegador do teste).
const NOW = Date.now();
const minutesAgo = (minutes) => new Date(NOW - minutes * 60000).toISOString();

const NAMES = [
  "Ana Souza", "Bruno Lima", "Carla Dias", "Diego Rocha", "Elisa Prado", "Fábio Nunes",
  "Gabi Torres", "Heitor Melo", "Íris Campos", "João Pedro", "Karen Alves", "Lucas Reis",
  "Marina Costa", "Nina Duarte", "Otávio Pires", "Paula Mendes", "Rafael Gomes", "Sofia Lins",
  "Tiago Ramos", "Vera Lúcia", "Wagner Silva", "Yasmin Rocha", "Zeca Moura", "Alice Pinto",
];

const ITEMS = [
  ["Combinado Imperial", 129.9],
  ["Hot Roll Salmão", 32.5],
  ["Temaki Salmão", 29.9],
  ["Uramaki Filadélfia", 34.9],
  ["Yakisoba Tradicional", 42],
  ["Guioza (6 un.)", 24.9],
  ["Carpaccio de Salmão", 58.5],
];

const STATUSES = [
  // status, quantos, minutos desde a criação (o primeiro de cada é o mais antigo)
  ["Recebido", 5, [3, 6, 9, 14, 22]],
  ["Aceito", 4, [8, 12, 18, 27]],
  ["Em preparo", 7, [15, 19, 24, 31, 36, 41, 48]],
  ["Pronto", 4, [26, 33, 39, 52]],
  ["Saiu para entrega", 4, [35, 44, 51, 63]],
];

const buildOrder = ({ index, status, minutes }) => {
  const code = String(1200 + index);
  const pickup = index % 4 === 0;
  const scheduled = index % 7 === 3;
  const items = [ITEMS[index % ITEMS.length], ITEMS[(index + 2) % ITEMS.length], ITEMS[(index + 4) % ITEMS.length]]
    .slice(0, 1 + (index % 3))
    .map(([name, price], position) => ({
      id: `it-${code}-${position}`,
      type: "product",
      name,
      category: "Cardápio",
      quantity: 1 + ((index + position) % 2),
      unitPrice: price,
      totalPrice: price * (1 + ((index + position) % 2)),
      metadata: {},
    }));
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const fee = pickup ? 0 : 9;
  const createdAt = minutesAgo(minutes);
  const scheduledFor = scheduled ? new Date(NOW + 50 * 60000).toISOString() : null;
  return {
    id: `order-${code}`,
    publicId: `TKY-${code}`,
    status,
    customerName: NAMES[index % NAMES.length],
    customerPhone: "(16) 99999-0000",
    customerNotes: index % 5 === 0 ? "Sem cebolinha, por favor." : "",
    orderType: scheduled ? "scheduled" : pickup ? "pickup" : "delivery",
    fulfillmentMode: pickup ? "pickup" : "delivery",
    timingMode: scheduled ? "scheduled" : "now",
    scheduledFor,
    scheduledDate: scheduledFor ? scheduledFor.slice(0, 10) : "",
    scheduledTime: scheduledFor ? scheduledFor.slice(11, 16) : "",
    scheduledLabel: scheduledFor ? "Hoje" : "",
    paymentMethod: ["pix", "credit_card", "cash", "debit_card"][index % 4],
    needsChange: false,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    addonsTotal: 0,
    deliveryFee: fee,
    totalAmount: Number((subtotal + fee).toFixed(2)),
    addressFull: pickup ? "" : `Rua das Flores, ${100 + index} - Centro, Franca - SP`,
    addressNeighborhood: pickup ? "" : ["Centro", "Jardim Paulista", "Vila Nova", "São José"][index % 4],
    deliveryEstimateText: pickup ? "" : "35-45 min",
    latestStatusNote: "",
    itemPreview: items.map((item) => item.name).join(", "),
    createdAt,
    updatedAt: createdAt,
    items,
    auditTrail: [],
  };
};

const buildOrders = () => {
  const orders = [];
  let index = 0;
  for (const [status, count, minutesList] of STATUSES) {
    for (let position = 0; position < count; position += 1) {
      index += 1;
      orders.push(buildOrder({ index, status, minutes: minutesList[position] }));
    }
  }
  // Alguns encerrados para a consulta.
  for (const status of ["Entregue", "Retirada concluida", "Entregue", "Cancelado"]) {
    index += 1;
    orders.push(buildOrder({ index, status, minutes: 90 + index }));
  }
  return orders;
};

const stats = (orders) => {
  const active = orders.filter((order) => !["Entregue", "Retirada concluida", "Cancelado"].includes(order.status));
  const byStatus = new Map();
  orders.forEach((order) => byStatus.set(order.status, (byStatus.get(order.status) || 0) + 1));
  return {
    totalOrders: orders.length,
    newOrders: orders.filter((order) => order.status === "Recebido").length,
    activeOrders: active.length,
    scheduledOrders: active.filter((order) => order.timingMode === "scheduled").length,
    todayOrders: orders.length,
    preparingOrders: orders.filter((order) => order.status === "Em preparo").length,
    readyOrders: orders.filter((order) => order.status === "Pronto").length,
    deliveryOrders: orders.filter((order) => order.status === "Saiu para entrega").length,
    todayRevenue: active.reduce((sum, order) => sum + order.totalAmount, 0),
    byStatus: [...byStatus.entries()].map(([status, total]) => ({ status, total })),
  };
};

// Intercepta lista, detalhes e mudança de status de pedidos.
const mockBusyOrders = async (page) => {
  const orders = buildOrders();
  await page.route("**/api/admin/orders/list?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ storageMode: "mock", generatedAt: new Date().toISOString(), stats: stats(orders), orders, recentOrders: orders }),
    })
  );
  await page.route("**/api/admin/orders/details?**", (route) => {
    const id = new URL(route.request().url()).searchParams.get("orderId");
    const order = orders.find((entry) => entry.id === id);
    return route.fulfill({
      status: order ? 200 : 404,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(order ? { storageMode: "mock", order } : { message: "Pedido não encontrado." }),
    });
  });
  await page.route("**/api/admin/orders/status", async (route) => {
    const body = route.request().postDataJSON() || {};
    const order = orders.find((entry) => entry.id === body.orderId);
    if (order && body.status) {
      order.status = body.status;
      order.updatedAt = new Date().toISOString();
    }
    return route.fulfill({
      status: order ? 200 : 404,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(order ? { storageMode: "mock", order, stats: stats(orders) } : { message: "Pedido não encontrado." }),
    });
  });
  return orders;
};

module.exports = { mockBusyOrders };
