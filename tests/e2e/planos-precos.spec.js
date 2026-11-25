const { test, expect } = require("@playwright/test");
const {
  baseURL,
  createApiContext,
  loginCustomerForRestaurant,
  loginMaster,
  onboardRestaurant,
  orderPayload,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");

// Tabela comercial (25/11/2026): Essencial R$ 99,90 · Profissional R$ 179,90 ·
// Completo R$ 299,90. O Grátis (até 50 pedidos/mês) segue como plano legado.

test("Plano Grátis: aceita 50 pedidos no mês e recusa o 51º com aviso", async () => {
  test.setTimeout(240_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("gratis"),
    name: "Restaurante Gratis",
    ownerPassword: "OwnerGratis123!",
    plan: "FREE",
  });
  const activate = await master.api.post("/api/admin/master/subscription", {
    data: { restaurantKey: restaurant.key, plan: "FREE", status: "ACTIVE" },
  });
  expect(activate.status(), JSON.stringify(await activate.json())).toBe(200);

  // Pedido no site exige cliente logado: um cliente faz os pedidos de teste
  // (cada pedido sai de um endereço IP diferente, como clientes diferentes).
  const customer = await loginCustomerForRestaurant({ host: restaurant.host, label: `gratis-${restaurant.key}` });
  const placeOrder = async (index) => {
    const api = await createApiContext({ host: restaurant.host, cookie: customer.cookie });
    try {
      const response = await api.post("/api/orders/create", {
        headers: { Origin: baseURL, Referer: `${baseURL}/` },
        data: orderPayload(`gratis-${index}`),
      });
      return { status: response.status(), body: await response.json().catch(() => ({})) };
    } finally {
      await api.dispose();
    }
  };
  for (let index = 1; index <= 50; index += 1) {
    const result = await placeOrder(index);
    expect(result.status, `pedido ${index}: ${JSON.stringify(result.body)}`).toBe(200);
  }
  const blocked = await placeOrder(51);
  expect(blocked.status).toBe(409);
  expect(blocked.body.errorCode).toBe("plan_order_limit_reached");
  expect(blocked.body.error).toContain("limite de pedidos");

  // Tabela no painel: Essencial R$ 49,90 com 50 pedidos só no Grátis.
  const billing = (await (await master.api.get("/api/system/billing")).json()).data;
  const row = billing.restaurants.find((entry) => entry.restaurantKey === restaurant.key);
  expect(row.plan).toBe("FREE");
  expect(row.monthlyValueCents).toBe(0);
  await master.api.dispose();
});
