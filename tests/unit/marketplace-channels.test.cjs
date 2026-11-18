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
  assert.deepEqual(mapped.order.rawPayload.channelOrder, { channel: "ifood", externalId: "abc-123", displayId: "4321", prepaid: false, deliveredBy: "MERCHANT" });
  assert.equal(mapped.items[0].quantity, 2);
  assert.equal(mapped.items[0].unitPrice, 30);
  assert.match(mapped.order.customerNotes, /Pedido iFood #4321/);
  assert.match(mapped.order.customerNotes, /troco para R\$ 100/);
  assert.match(mapped.order.customerNotes, /Temaki: 1x Cream cheese, sem cebola/);
  // Mesmo pedido -> mesma assinatura (não duplica).
  assert.equal(mapped.requestSignature, mapIfoodOrder({ id: "abc-123" }).requestSignature);
});
