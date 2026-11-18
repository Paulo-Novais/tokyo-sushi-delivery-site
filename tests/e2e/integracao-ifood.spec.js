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
  await expect(slot.locator('[data-channel-status="food99"]')).toHaveText("Em breve");
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
