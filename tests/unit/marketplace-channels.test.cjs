// Conversão do pedido do iFood para o pedido INOVAS.
const test = require("node:test");
const assert = require("node:assert/strict");
const { mapIfoodOrder } = require("../../lib/marketplace-channels.cjs");

test("pedido do iFood vira pedido INOVAS com origem, itens, total e observações", () => {
  const mapped = mapIfoodOrder({
    id: "abc-123",
    displayId: "4321",
    orderType: "DELIVERY",
    orderTiming: "IMMEDIATE",
    customer: { id: "c1", name: "Maria", phone: { number: "0800 123", localizer: "9988" } },
    items: [
      { id: "x", name: "Temaki", quantity: 2, unitPrice: 30, totalPrice: 60, observations: "sem cebola", options: [{ name: "Cream cheese", quantity: 1 }] },
    ],
    total: { subTotal: 60, deliveryFee: 5, orderAmount: 65 },
    payments: { prepaid: 0, pending: 65, methods: [{ method: "CASH", cash: { changeFor: 100 } }] },
    delivery: { deliveredBy: "MERCHANT", deliveryAddress: { streetName: "Rua A", streetNumber: "1", formattedAddress: "Rua A, 1" } },
  });
  assert.equal(mapped.order.status, "Recebido");
  assert.equal(mapped.order.fulfillmentMode, "delivery");
  assert.equal(mapped.order.paymentMethod, "dinheiro");
  assert.equal(mapped.order.total, 65);
  assert.equal(mapped.order.deliveryFee, 5);
  assert.deepEqual(mapped.order.rawPayload.channelOrder, { channel: "ifood", salesChannel: "", externalId: "abc-123", displayId: "4321", prepaid: false, deliveredBy: "MERCHANT" });
  assert.equal(mapped.items[0].quantity, 2);
  assert.equal(mapped.items[0].unitPrice, 30);
  assert.match(mapped.order.customerNotes, /Pedido iFood #4321/);
  assert.match(mapped.order.customerNotes, /troco para R\$ 100/);
  assert.match(mapped.order.customerNotes, /Temaki: 1x Cream cheese, sem cebola/);
  // Mesmo pedido -> mesma assinatura (não duplica).
  assert.equal(mapped.requestSignature, mapIfoodOrder({ id: "abc-123" }).requestSignature);
});

test("pedido Open Delivery (99Food) vira pedido INOVAS", () => {
  const { mapOpenDeliveryOrder } = require("../../lib/marketplace-channels.cjs");
  const mapped = mapOpenDeliveryOrder("food99", {
    id: "od-1",
    displayId: "77",
    type: "TAKEOUT",
    orderTiming: "INSTANT",
    customer: { id: "c9", name: "João", phone: { number: "(16) 99999-0000" } },
    items: [{ id: "a", name: "Hot roll", quantity: 2, totalPrice: { value: 49.8 }, specialInstructions: "bem passado" }],
    otherFees: [{ type: "DELIVERY_FEE", price: { value: 0 } }],
    total: { itemsPrice: { value: 49.8 }, orderAmount: { value: 49.8 } },
    payments: { prepaid: 0, pending: 49.8, methods: [{ method: "CREDIT", type: "PENDING" }] },
  });
  assert.equal(mapped.order.fulfillmentMode, "pickup");
  assert.equal(mapped.order.paymentMethod, "credito");
  assert.equal(mapped.order.total, 49.8);
  assert.equal(mapped.items[0].unitPrice, 24.9);
  assert.equal(mapped.customer.phone, "16999990000");
  assert.equal(mapped.order.rawPayload.channelOrder.standard, "opendelivery");
  assert.equal(mapped.order.rawPayload.channelOrder.prepaid, false);
  assert.match(mapped.order.customerNotes, /Pedido 99Food #77/);
  assert.match(mapped.order.customerNotes, /Cobrar na entrega/);
});

test("pedido feito no app da Uber (via iFood) guarda o canal de venda", () => {
  const { mapIfoodOrder } = require("../../lib/marketplace-channels.cjs");
  const mapped = mapIfoodOrder({
    id: "uber-1",
    displayId: "1",
    orderType: "TAKEOUT",
    salesChannel: "UBER_EATS",
    customer: { id: "c", name: "Cli" },
    items: [{ id: "i", name: "Temaki", quantity: 1, unitPrice: 10, totalPrice: 10 }],
    total: { subTotal: 10, deliveryFee: 0, orderAmount: 10 },
    payments: { prepaid: 10, pending: 0, methods: [{ method: "CREDIT", prepaid: true }] },
  });
  assert.equal(mapped.order.rawPayload.channelOrder.salesChannel, "UBER_EATS");
});
