const { test, expect } = require("@playwright/test");
const {
  createApiContext,
  createPublicOrder,
  hostForKey,
  loginMaster,
  loginTenantOwner,
  onboardRestaurant,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");

// Modelo Premium, fase 4: dois restaurantes e o MESMO telefone de cliente.
// Um restaurante não vê pedidos, clientes nem avaliações do outro.
const SAME_PHONE = "(11) 96666-1111"; // é o telefone fixo do orderPayload dos testes

test("Isolamento: mesmo cliente em dois restaurantes — pedidos, CRM e avaliações separados", async () => {
  test.setTimeout(180_000);
  const master = await loginMaster();
  const keyA = uniqueKey("isoa");
  const keyB = uniqueKey("isob");
  const a = await onboardRestaurant(master.api, { key: keyA, name: "Pizzaria Iso A", ownerPassword: "OwnerIsoA123!" });
  const b = await onboardRestaurant(master.api, { key: keyB, name: "Pizzaria Iso B", ownerPassword: "OwnerIsoB123!" });
  await master.api.dispose();

  // Mesmo cliente (mesmo telefone) pede nos dois.
  const orderA = await createPublicOrder({ host: hostForKey(keyA), label: keyA });
  const orderB = await createPublicOrder({ host: hostForKey(keyB), label: keyB });
  const idOf = (order) => order.publicId || order.id;

  // Avaliação só no restaurante A.
  const publicA = await createApiContext({ host: hostForKey(keyA) });
  const review = await publicA.post("/api/reviews", {
    data: { name: "Cliente Mesmo Telefone", contact: SAME_PHONE, rating: 5, message: `Avaliação só do ${keyA}` },
  });
  expect(review.status(), await review.text()).toBe(200);
  await publicA.dispose();

  const ownerA = await loginTenantOwner(a);
  const ownerB = await loginTenantOwner(b);
  try {
    // Pedidos
    const ordersA = (await (await ownerA.api.get("/api/admin/orders/list?limit=80")).json()).orders || [];
    const ordersB = (await (await ownerB.api.get("/api/admin/orders/list?limit=80")).json()).orders || [];
    const idsA = ordersA.map((order) => order.publicId || order.id);
    const idsB = ordersB.map((order) => order.publicId || order.id);
    expect(idsA).toContain(idOf(orderA));
    expect(idsA).not.toContain(idOf(orderB));
    expect(idsB).toContain(idOf(orderB));
    expect(idsB).not.toContain(idOf(orderA));

    // CRM: o mesmo telefone aparece com 1 pedido em cada restaurante (não soma).
    const customersA = (await (await ownerA.api.get("/api/admin/customers/list")).json()).customers || [];
    const customersB = (await (await ownerB.api.get("/api/admin/customers/list")).json()).customers || [];
    const samePhone = (list) => list.filter((customer) => String(customer.customerPhone || "").replace(/\D/g, "").endsWith("966661111"));
    expect(samePhone(customersA)).toHaveLength(1);
    expect(samePhone(customersA)[0].ordersCount).toBe(1);
    expect(samePhone(customersB)).toHaveLength(1);
    expect(samePhone(customersB)[0].ordersCount).toBe(1);

    // Avaliações: B não vê a de A.
    const reviewsA = JSON.stringify(await (await ownerA.api.get("/api/admin/reviews/list")).json());
    const reviewsB = JSON.stringify(await (await ownerB.api.get("/api/admin/reviews/list")).json());
    expect(reviewsA).toContain(`Avaliação só do ${keyA}`);
    expect(reviewsB).not.toContain(`Avaliação só do ${keyA}`);

    // Pedido de A: o dono de A lê pelo id; o dono de B não consegue nem pelo id direto.
    const internalIdA = ordersA.find((order) => (order.publicId || order.id) === idOf(orderA))?.id;
    expect(internalIdA).toBeTruthy();
    const ownDetail = await ownerA.api.get(`/api/admin/orders/details?orderId=${encodeURIComponent(internalIdA)}`);
    expect(ownDetail.status()).toBe(200);
    const crossDetail = await ownerB.api.get(`/api/admin/orders/details?orderId=${encodeURIComponent(internalIdA)}`);
    expect([403, 404]).toContain(crossDetail.status());
    expect(JSON.stringify(await crossDetail.json().catch(() => ({})))).not.toContain(idOf(orderA));
  } finally {
    await ownerA.api.dispose();
    await ownerB.api.dispose();
  }
});
