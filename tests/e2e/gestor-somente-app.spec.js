const { test, expect } = require("@playwright/test");
const { loginMaster, loginTenantOwner, onboardRestaurant, hostForKey, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");

// Pedidos e Caixa só no app INOVAS PDV (regra de todos os restaurantes; no
// servidor de testes local vale para "somenteapp-*").
const APP_HEADERS = { "X-Inovas-Client": "inovas-pdv-desktop" };

test("Navegador: Caixa e mudança de pedido bloqueados; app funciona; Painel segue no navegador", async ({ page }) => {
  test.setTimeout(180_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("somenteapp"),
    name: "Restaurante Somente App",
    ownerPassword: "OwnerSomenteApp123!",
  });
  await master.api.dispose();
  const host = hostForKey(restaurant.key);
  const { api } = await loginTenantOwner({ ...restaurant, host });

  // Navegador: Caixa recusado; leitura de pedidos (Painel) segue.
  const browserCash = await api.get("/api/admin/cash-register/snapshot");
  expect(browserCash.status()).toBe(403);
  expect((await browserCash.json()).errorCode).toBe("pdv_app_required");
  expect((await api.get("/api/admin/orders/list?limit=5")).status()).toBe(200);
  const browserStatus = await api.post("/api/admin/orders/status", { data: { orderId: "x", status: "Aceito" } });
  expect(browserStatus.status()).toBe(403);
  expect((await browserStatus.json()).errorCode).toBe("pdv_app_required");

  // App (cabeçalho do INOVAS PDV): Caixa liberado.
  expect((await api.get("/api/admin/cash-register/snapshot", { headers: APP_HEADERS })).status()).toBe(200);
  const appSession = await (await api.get("/api/admin/session", { headers: APP_HEADERS })).json();
  expect(appSession.pdvApp).toEqual({ required: true, isApp: true });
  const browserSession = await (await api.get("/api/admin/session")).json();
  expect(browserSession.pdvApp).toEqual({ required: true, isApp: false });
  await api.dispose();

  // Tela do navegador: Pedidos e Caixa mostram o aviso com o botão de baixar.
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `127.88.${Math.floor(Math.random() * 200)}.6` });
  await page.goto("/admin/login.html?next=%2Fadmin%2F");
  await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForLoadState("networkidle");
  await page.goto("/admin/?section=orders");
  await expect(page.locator("[data-pdv-app-required] h2")).toHaveText("Pedidos funciona no app INOVAS PDV");
  await expect(page.locator("[data-pdv-download]")).toHaveAttribute("href", /INOVAS-PDV-Setup\.exe$/);
  if (process.env.PDV_SHOT_DIR) await page.screenshot({ path: `${process.env.PDV_SHOT_DIR}/somente-app-pedidos.png` });
  await page.goto("/admin/caixa/salao");
  await expect(page.locator("[data-pdv-app-required] h2")).toHaveText("Caixa e Comandas funciona no app INOVAS PDV");
  // Painel continua no navegador.
  await page.goto("/admin/?section=dashboard");
  await expect(page.locator("[data-pdv-app-required]")).toHaveCount(0);
});
