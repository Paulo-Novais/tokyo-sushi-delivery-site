const { test, expect } = require("@playwright/test");
const {
  baseURL,
  createApiContext,
  loginMaster,
  loginTenantOwner,
  onboardRestaurant,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");

// Integração iFood (simulador): o pedido entra no Gestor, e aceitar /
// pronto / saiu / cancelar no Gestor avisa o iFood. Sem taxa INOVAS.

const post = (api, url, data) => api.post(url, { headers: { Origin: baseURL, Referer: `${baseURL}/` }, data });

test("iFood: pedido entra no Gestor e os status voltam para o iFood", async ({ browser }) => {
  test.setTimeout(150_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, { key: uniqueKey("ifood"), name: "Restaurante iFood", ownerPassword: "OwnerIfood123!" });
  const other = await onboardRestaurant(master.api, { key: uniqueKey("ifoodb"), name: "Outro iFood", ownerPassword: "OwnerIfoodB123!" });
  const owner = await loginTenantOwner(restaurant);
  const otherOwner = await loginTenantOwner(other);
  const merchantId = `loja-${restaurant.key}`;
  const site = await createApiContext();

  // Loja ainda não vinculada: pedido ignorado.
  const ignored = await (await post(site, "/api/channels/test-simulate", { merchantId })).json();
  expect(ignored.ignored).toBe(true);

  // Tela: Configurações > Integrações > conectar iFood.
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `127.97.${Math.floor(Math.random() * 200)}.8` } });
  const page = await context.newPage();
  await page.goto("/admin/login.html?next=%2Fadmin%2F");
  await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForLoadState("networkidle");
  await page.goto("/admin/?section=settings&tab=channels");
  const slot = page.locator("[data-channels-slot]");
  await expect(slot.locator('[data-channel-status="ifood"]')).toHaveText("Não conectado");
  await expect(slot.locator('[data-channel-status="food99"]')).toHaveText("Não conectado");
  await expect(slot.locator('[data-channel-status="ubereats"]')).toHaveText("Pelo iFood");
  await slot.locator('[data-channel-store="ifood"]').fill(merchantId);
  await slot.locator('[data-channel-action="link"][data-channel="ifood"]').click();
  await expect(slot).toContainText("Integração salva");
  await expect(slot.locator('[data-channel-status="ifood"]')).toHaveText("Conectado");

  // A mesma loja não pode ir para outro restaurante.
  const taken = await otherOwner.api.post("/api/admin/channels/save", { data: { channel: "ifood", externalStoreId: merchantId } });
  expect(taken.status()).toBe(409);

  // Pedido do iFood entra no Gestor (aviso repetido não duplica).
  const listOrders = async () => (await (await owner.api.get("/api/admin/orders/list?limit=80")).json()).orders || [];
  const before = (await listOrders()).length;
  const created = await (await post(site, "/api/channels/test-simulate", { merchantId })).json();
  expect(created.created).toBe(true);
  await post(site, "/api/channels/ifood/webhook", { orderId: created.ifoodOrderId, merchantId, fullCode: "PLACED" });
  const orders = await listOrders();
  expect(orders.length).toBe(before + 1);
  const order = orders.find((entry) => String(entry.publicId) === String(created.orderPublicId));
  expect(order.totalAmount ?? order.total).toBeCloseTo(151.8, 2);

  // Status no Gestor -> iFood.
  const setStatus = (status) => owner.api.post("/api/admin/orders/status", { data: { orderId: order.id, status, manual: true } });
  for (const [status, action] of [["Aceito", "confirm"], ["Em preparo", "startPreparation"], ["Pronto", "readyToPickup"], ["Saiu para entrega", "dispatch"]]) {
    const response = await setStatus(status);
    const body = await response.json();
    expect(response.status(), JSON.stringify(body)).toBe(200);
    expect(body.channelSync, status).toMatchObject({ ok: true, action });
  }
  const actions = (await (await site.get(`/api/channels/test-actions?orderId=${created.ifoodOrderId}`)).json()).actions.map((entry) => entry.action);
  expect(actions).toEqual(["confirm", "startPreparation", "readyToPickup", "dispatch"]);

  // Cancelar outro pedido avisa o iFood.
  const second = await (await post(site, "/api/channels/test-simulate", { merchantId })).json();
  const secondOrder = (await listOrders()).find((entry) => String(entry.publicId) === String(second.orderPublicId));
  const cancel = await (await owner.api.post("/api/admin/orders/status", { data: { orderId: secondOrder.id, status: "Cancelado", note: "Sem ingrediente", manual: true } })).json();
  expect(cancel.channelSync).toMatchObject({ ok: true, action: "requestCancellation" });

  // Gestor mostra a origem do pedido.
  await page.goto("/admin/?section=orders");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toContainText("iFood · PAGO NO APP");

  await context.close();
  await site.dispose();
  await owner.api.dispose();
  await otherOwner.api.dispose();
  await master.api.dispose();
});

test("99Food (Open Delivery): código gerado pela INOVAS, pedido no Gestor e status de volta", async ({ browser }) => {
  test.setTimeout(150_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, { key: uniqueKey("food99"), name: "Restaurante 99", ownerPassword: "Owner99Food123!" });
  const owner = await loginTenantOwner(restaurant);
  const site = await createApiContext();

  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `127.98.${Math.floor(Math.random() * 200)}.9` } });
  const page = await context.newPage();
  await page.goto("/admin/login.html?next=%2Fadmin%2F");
  await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForLoadState("networkidle");
  await page.goto("/admin/?section=settings&tab=channels");
  const slot = page.locator("[data-channels-slot]");
  await slot.locator('[data-channel-action="generate"][data-channel="food99"]').click();
  await expect(slot.locator('[data-channel-status="food99"]')).toHaveText("Conectado");
  const merchantId = await slot.locator('[data-channel-code="food99"]').inputValue();
  expect(merchantId.length).toBeGreaterThanOrEqual(36);
  await context.close();

  const listOrders = async () => (await (await owner.api.get("/api/admin/orders/list?limit=80")).json()).orders || [];
  const before = (await listOrders()).length;
  const created = await (await post(site, "/api/channels/test-simulate", { channel: "food99", merchantId })).json();
  expect(created.created, JSON.stringify(created)).toBe(true);
  // Aviso repetido (mesmo pedido) não duplica.
  await site.post("/api/channels/food99/v1/newEvent", {
    headers: { Origin: baseURL, "x-app-merchantid": merchantId, "x-app-id": "app-teste" },
    data: { eventId: "e1", eventType: "CREATED", orderId: created.externalOrderId, orderURL: "", createdAt: new Date().toISOString() },
  });
  const orders = await listOrders();
  expect(orders.length).toBe(before + 1);
  const order = orders.find((entry) => String(entry.publicId) === String(created.orderPublicId));

  for (const [status, action] of [["Aceito", "confirm"], ["Em preparo", "preparing"], ["Pronto", "readyForPickup"], ["Saiu para entrega", "dispatch"], ["Entregue", "delivered"]]) {
    const body = await (await owner.api.post("/api/admin/orders/status", { data: { orderId: order.id, status, manual: true } })).json();
    expect(body.channelSync, status).toMatchObject({ ok: true, action });
  }
  const actions = (await (await site.get(`/api/channels/test-actions?orderId=${created.externalOrderId}`)).json()).actions.map((entry) => entry.action);
  expect(actions).toEqual(["confirm", "preparing", "readyForPickup", "dispatch", "delivered"]);

  // Entrega pela plataforma: "saiu" não é enviado; cancelamento com motivo.
  const second = await (await post(site, "/api/channels/test-simulate", { channel: "food99", merchantId, deliveredBy: "MARKETPLACE" })).json();
  const secondOrder = (await listOrders()).find((entry) => String(entry.publicId) === String(second.orderPublicId));
  const dispatched = await (await owner.api.post("/api/admin/orders/status", { data: { orderId: secondOrder.id, status: "Saiu para entrega", manual: true } })).json();
  expect(dispatched.channelSync).toBeUndefined();
  const cancelled = await (await owner.api.post("/api/admin/orders/status", { data: { orderId: secondOrder.id, status: "Cancelado", note: "Sem entregador", manual: true } })).json();
  expect(cancelled.channelSync).toMatchObject({ ok: true, action: "requestCancellation" });
  const cancelAction = (await (await site.get(`/api/channels/test-actions?orderId=${second.externalOrderId}`)).json()).actions.pop();
  expect(cancelAction.body).toMatchObject({ code: "INTERNAL_DIFFICULTIES_OF_THE_RESTAURANT", mode: "MANUAL", reason: "Sem entregador" });

  await site.dispose();
  await owner.api.dispose();
  await master.api.dispose();
});

test("Plataforma avisa o Gestor: aceite, pronto, cancelamento e pedido de cancelamento", async ({ browser }) => {
  test.setTimeout(150_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, { key: uniqueKey("avisos"), name: "Restaurante Avisos", ownerPassword: "OwnerAvisos123!" });
  const owner = await loginTenantOwner(restaurant);
  const site = await createApiContext();
  const merchantId = `loja-${restaurant.key}`;
  expect((await owner.api.post("/api/admin/channels/save", { data: { channel: "ifood", externalStoreId: merchantId } })).status()).toBe(200);
  const listOrders = async () => (await (await owner.api.get("/api/admin/orders/list?limit=80")).json()).orders || [];
  const findOrder = async (publicId) => (await listOrders()).find((entry) => String(entry.publicId) === String(publicId));
  const event = (data) => post(site, "/api/channels/test-event", { merchantId, ...data });

  // iFood confirma e marca pronto: o Gestor acompanha e NÃO reenvia ao iFood.
  const first = await (await post(site, "/api/channels/test-simulate", { merchantId })).json();
  expect((await (await event({ orderId: first.ifoodOrderId, code: "CFM" })).json()).status).toBe("Aceito");
  expect((await findOrder(first.orderPublicId)).status).toBe("Aceito");
  // Aviso repetido ou atrasado não volta a etapa.
  await event({ orderId: first.ifoodOrderId, code: "RTP" });
  expect((await (await event({ orderId: first.ifoodOrderId, code: "CFM" })).json()).reason).toBe("already_there");
  expect((await findOrder(first.orderPublicId)).status).toBe("Pronto");
  const echoed = (await (await site.get(`/api/channels/test-actions?orderId=${first.ifoodOrderId}`)).json()).actions;
  expect(echoed).toEqual([]);

  // Cliente cancela no app do iFood: pedido cancelado no Gestor com o motivo.
  const second = await (await post(site, "/api/channels/test-simulate", { merchantId })).json();
  const cancelled = await (await event({ orderId: second.ifoodOrderId, code: "CAN", metadata: { reason: "Cliente desistiu" } })).json();
  expect(cancelled.status).toBe("Cancelado");
  const cancelledOrder = await findOrder(second.orderPublicId);
  expect(cancelledOrder.status).toBe("Cancelado");
  expect(cancelledOrder.latestStatusNote).toContain("Cancelado no iFood");
  expect(cancelledOrder.latestStatusNote).toContain("Cliente desistiu");
  // Depois de cancelado, nenhum aviso muda o pedido.
  expect((await (await event({ orderId: second.ifoodOrderId, code: "CFM" })).json()).reason).toBe("order_closed");

  // Pedido feito no app da Uber (chega pelo iFood) e um novo esperando aceite.
  const uber = await (await post(site, "/api/channels/test-simulate", { merchantId, salesChannel: "UBER_EATS" })).json();
  expect(uber.created).toBe(true);

  // Tela: alerta do cancelamento, etiqueta da origem, contador e filtro.
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `127.96.${Math.floor(Math.random() * 200)}.7` } });
  const page = await context.newPage();
  await page.goto("/admin/login.html?next=%2Fadmin%2F");
  await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForLoadState("networkidle");
  await page.goto("/admin/?section=orders");
  await page.waitForSelector(".gx-ticket");
  const alert = page.locator(".gx-platform-alert.is-cancelled");
  await expect(alert).toHaveCount(1);
  await expect(alert).toContainText("foi cancelado no iFood");
  await expect(alert).toContainText("Cliente desistiu");
  const uberCard = page.locator(".gx-ticket").filter({ has: page.locator('[data-order-origin="uber"]') });
  await expect(uberCard).toHaveCount(1);
  await expect(uberCard.locator("[data-accept-timer]")).toContainText("Aceite em");
  await expect(page.locator('[data-order-origin="ifood"]')).toHaveCount(1);
  await page.locator('[data-orders-origin="uber"]').click();
  await expect(page.locator(".gx-ticket")).toHaveCount(1);
  await page.locator('[data-orders-origin="all"]').click();
  await alert.locator("[data-platform-alert-dismiss]").click();
  await expect(page.locator(".gx-platform-alert")).toHaveCount(0);
  // "Entendi" vale depois de recarregar.
  await page.reload();
  await page.waitForSelector(".gx-ticket");
  await expect(page.locator(".gx-platform-alert")).toHaveCount(0);
  await context.close();

  // 99Food: cliente pede cancelamento; cancelar no Gestor aceita o pedido dele.
  const food = await owner.api.post("/api/admin/channels/save", { data: { channel: "food99", externalStoreId: "generate" } });
  const foodBody = await food.json();
  expect(food.status(), JSON.stringify(foodBody)).toBe(200);
  const foodMerchant = (foodBody.channels || []).find((entry) => entry.id === "food99" || entry.channel === "food99")?.externalStoreId;
  expect(foodMerchant).toBeTruthy();
  const od = await (await post(site, "/api/channels/test-simulate", { channel: "food99", merchantId: foodMerchant })).json();
  const request = await (await post(site, "/api/channels/test-event", {
    channel: "food99",
    merchantId: foodMerchant,
    orderId: od.externalOrderId,
    code: "ORDER_CANCELLATION_REQUEST",
    metadata: { reason: "Endereço errado", code: "CONSUMER_CANCELLATION_REQUESTED" },
  })).json();
  expect(request.cancellationRequested).toBe(true);
  const odOrder = await findOrder(od.orderPublicId);
  expect(odOrder.status).toBe("Recebido");
  expect(odOrder.latestStatusNote).toContain("Cliente pediu cancelamento no 99Food");
  const odCancel = await (await owner.api.post("/api/admin/orders/status", { data: { orderId: odOrder.id, status: "Cancelado", note: "Aceito o pedido do cliente", manual: true } })).json();
  expect(odCancel.channelSync).toMatchObject({ ok: true, action: "acceptCancellation" });

  await site.dispose();
  await owner.api.dispose();
  await master.api.dispose();
});
