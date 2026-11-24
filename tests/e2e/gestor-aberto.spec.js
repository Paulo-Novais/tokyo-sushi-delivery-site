const { test, expect } = require("@playwright/test");
const {
  baseURL,
  createApiContext,
  createCustomerApiContext,
  hostForKey,
  loginMaster,
  loginTenantOwner,
  onboardRestaurant,
  orderPayload,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");

// "Gestor aberto" (regra de todos os restaurantes): o site só aceita pedido
// quando o Gestor do restaurante está aberto e não foi fechado por tempo.
// No servidor de testes local a regra vale para restaurantes "presenca-*".

const tryOrder = async (host, label) => {
  const api = await createCustomerApiContext({ host, label });
  try {
    const response = await api.post("/api/orders/create", {
      headers: { Origin: baseURL, Referer: `${baseURL}/` },
      data: orderPayload(label),
    });
    return { status: response.status(), body: await response.json().catch(() => ({})) };
  } finally {
    await api.dispose();
  }
};

const siteAvailability = async (host) => {
  const api = await createApiContext({ host });
  try {
    const body = await (await api.get("/api/restaurant-settings")).json();
    return body.availability;
  } finally {
    await api.dispose();
  }
};

test("Gestor fechado: site indisponível; Gestor aberto: aceita; Fechar Gestor pausa e reabre", async ({ page }) => {
  test.setTimeout(180_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("presenca"),
    name: "Restaurante Presenca",
    ownerPassword: "OwnerPresenca123!",
  });
  await master.api.dispose();
  const host = hostForKey(restaurant.key);

  // Ninguém abriu o Gestor: site indisponível e servidor recusa o pedido.
  expect(await siteAvailability(host)).toEqual({ gestorOnline: false });
  const blocked = await tryOrder(host, `${restaurant.key}-fechado`);
  expect(blocked.status).toBe(409);
  expect(blocked.body.errorCode).toBe("restaurant_unavailable");

  // Gestor aberto (lê a fila de pedidos): site libera.
  const { api } = await loginTenantOwner({ ...restaurant, host });
  expect((await api.get("/api/admin/orders/list?limit=10")).status()).toBe(200);
  expect(await siteAvailability(host)).toEqual({ gestorOnline: true });
  const accepted = await tryOrder(host, `${restaurant.key}-aberto`);
  expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);

  // Fechar Gestor: só tempos permitidos; site indisponível durante a pausa.
  expect((await api.post("/api/admin/presence/pause", { data: { minutes: 10 } })).status()).toBe(400);
  const paused = await (await api.post("/api/admin/presence/pause", { data: { minutes: 30 } })).json();
  expect(paused.presence.paused).toBe(true);
  expect(paused.presence.acceptingOrders).toBe(false);
  expect(await siteAvailability(host)).toEqual({ gestorOnline: false });
  expect((await tryOrder(host, `${restaurant.key}-pausa`)).body.errorCode).toBe("restaurant_unavailable");

  // Reabrir agora.
  const resumed = await (await api.post("/api/admin/presence/resume", { data: {} })).json();
  expect(resumed.presence.paused).toBe(false);
  expect(await siteAvailability(host)).toEqual({ gestorOnline: true });
  await api.dispose();

  // Na tela do Gestor: botão ao lado do nome do restaurante.
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `127.77.${Math.floor(Math.random() * 200)}.4` });
  await page.goto("/admin/login.html?next=%2Fadmin%2F");
  await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForLoadState("networkidle");
  const toggle = page.locator("[data-presence-toggle]:visible");
  await expect(toggle).toContainText("Recebendo pedidos");
  await toggle.click();
  await expect(page.locator("[data-presence-pause]:visible")).toHaveText(["15 min", "30 min", "60 min", "240 min"]);
  await page.locator('[data-presence-pause="60"]:visible').click();
  await expect(toggle).toContainText("Fechado até");
  await page.screenshot({ path: "artifacts/gestor-aberto/fechado.png" });
  expect(await siteAvailability(host)).toEqual({ gestorOnline: false });
  await toggle.click();
  await page.locator("[data-presence-resume]:visible").click();
  await expect(toggle).toContainText("Recebendo pedidos");
  expect(await siteAvailability(host)).toEqual({ gestorOnline: true });
});
