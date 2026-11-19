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

test("App INOVAS PDV antigo (0.2.0): Gestor pede para atualizar, com botão quando o app oferece", async ({ browser }) => {
  test.setTimeout(120_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("somenteapp"),
    name: "Restaurante App Antigo",
    ownerPassword: "OwnerAppAntigo123!",
  });
  await master.api.dispose();
  // User-Agent padrão do Electron, sem "InovasPDV/<versão>" (como o app 0.2.0).
  const oldAppUserAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) inovas-pdv/0.2.0 Chrome/140.0.0.0 Electron/38.0.0 Safari/537.36";
  const login = async (page) => {
    await page.goto("/admin/login.html?next=%2Fadmin%2F");
    await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
    await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
    const loginResponse = page.waitForResponse((response) => response.url().includes("/login") && response.request().method() === "POST");
    await page.locator("[data-admin-login-submit]").click();
    const done = await loginResponse;
    expect(done.status()).toBe(200);
    await page.waitForLoadState("networkidle");
    await page.goto("/admin/?section=orders");
  };

  // Sem a ponte do app: passo a passo apontando para "Verificar atualização".
  const oldContext = await browser.newContext({
    userAgent: oldAppUserAgent,
    extraHTTPHeaders: { "x-forwarded-for": `127.87.${Math.floor(Math.random() * 200)}.6` },
  });
  const oldPage = await oldContext.newPage();
  await login(oldPage);
  const card = oldPage.locator("[data-pdv-app-update]");
  await expect(card.locator("h2")).toHaveText("Atualize o app INOVAS PDV");
  await expect(card).toContainText("Verificar atualização");
  await expect(oldPage.locator("[data-pdv-download]")).toHaveCount(0);
  await oldContext.close();

  // Com a ponte (app 0.3.1+): botão "Atualizar agora" chama o app.
  const bridgeContext = await browser.newContext({
    userAgent: oldAppUserAgent,
    extraHTTPHeaders: { "x-forwarded-for": `127.86.${Math.floor(Math.random() * 200)}.6` },
  });
  await bridgeContext.addInitScript(() => {
    window.__updateCalls = 0;
    window.InovasPDV = {
      version: "0.3.1",
      updateNow: async () => {
        window.__updateCalls += 1;
        return { ok: true };
      },
    };
  });
  const bridgePage = await bridgeContext.newPage();
  await login(bridgePage);
  await bridgePage.locator("[data-pdv-update-now]").click();
  await expect.poll(() => bridgePage.evaluate(() => window.__updateCalls)).toBe(1);
  await expect(bridgePage.locator("[data-pdv-update-now]")).toHaveText("Baixando a atualização…");
  await bridgeContext.close();
});

test("App INOVAS PDV 0.3.1+: faixa 'Nova versão' com Atualizar agora quando o app tem atualização", async ({ browser }) => {
  test.setTimeout(120_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("faixaapp"),
    name: "Restaurante Faixa App",
    ownerPassword: "OwnerFaixaApp123!",
  });
  await master.api.dispose();
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Electron/45.2.0 Safari/537.36 InovasPDV/0.3.1",
    extraHTTPHeaders: { "x-forwarded-for": `127.85.${Math.floor(Math.random() * 200)}.6`, "X-Inovas-Client": "inovas-pdv-desktop" },
  });
  await context.addInitScript(() => {
    window.__updateCalls = 0;
    window.InovasPDV = {
      getUpdate: async () => ({ version: "0.3.1", available: "0.3.2" }),
      updateNow: async () => {
        window.__updateCalls += 1;
        return { ok: true };
      },
    };
  });
  const page = await context.newPage();
  await page.goto("/admin/login.html?next=%2Fadmin%2F");
  await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
  const loginResponse = page.waitForResponse((response) => response.url().includes("/login") && response.request().method() === "POST");
  await page.locator("[data-admin-login-submit]").click();
  await loginResponse;
  await page.waitForLoadState("networkidle");
  await page.goto("/admin/?section=dashboard");
  const banner = page.locator("[data-pdv-update-banner]");
  await expect(banner).toContainText("Nova versão do app INOVAS PDV (0.3.2)");
  await banner.getByRole("button", { name: "Atualizar agora" }).click();
  await expect.poll(() => page.evaluate(() => window.__updateCalls)).toBe(1);
  await context.close();
});
