const { test, expect } = require("@playwright/test");
const { loginMaster, loginTenantOwner, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");

// Adicionais do plano: a INOVAS cria o adicional no catálogo (System), o dono
// liga e desliga no Gestor (cobra o mês inteiro ao ligar; desligar vale até o
// fim do mês) e a INOVAS dá cortesia. O dono não mexe no catálogo nem em cortesia.

const shot = async (page, name) => {
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png`, fullPage: false });
};

const systemPage = async (browser) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    extraHTTPHeaders: { "x-forwarded-for": `127.98.${Math.floor(Math.random() * 200)}.4` },
  });
  const page = await context.newPage();
  await page.goto("/system/login.html");
  await page.getByLabel("E-mail").fill(process.env.E2E_ADMIN_LOGIN);
  await page.getByLabel("Senha").fill(process.env.E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/system\/?$/);
  return { context, page };
};

const ownerPage = async (browser, restaurant) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    extraHTTPHeaders: { "x-forwarded-for": `127.99.${Math.floor(Math.random() * 200)}.6` },
  });
  const page = await context.newPage();
  await page.goto("/admin/login.html?next=%2Fadmin%2F");
  await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForLoadState("networkidle");
  return { context, page };
};

test("Adicionais: INOVAS cria, dono liga e desliga, cobrança do mês e cortesia", async ({ browser }) => {
  test.setTimeout(240_000);
  const suffix = Math.random().toString(36).slice(2, 7);
  const addonName = `Rotas ${suffix}`;
  const section = `rotas-${suffix}`;
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, { key: uniqueKey("adicional"), name: "Pizzaria Adicional", ownerPassword: "OwnerAdic123!" });
  const activate = await master.api.post("/api/admin/master/subscription", { data: { restaurantKey: restaurant.key, plan: "BUSINESS", status: "ACTIVE" } });
  expect(activate.status()).toBe(200);

  // 1) Painel INOVAS > Planos e adicionais > Catálogo > Criar adicional.
  const system = await systemPage(browser);
  const sysErrors = [];
  system.page.on("pageerror", (error) => sysErrors.push(error.message));
  await system.page.goto("/system#addons");
  await expect(system.page.getByRole("heading", { name: "Planos e adicionais" })).toBeVisible();
  await expect(system.page.locator(`[data-addons-row="${restaurant.key}"]`)).toBeVisible();
  await shot(system.page, "sys-1-restaurantes");
  await system.page.locator('[data-addons-tab="catalog"]').click();
  await expect(system.page.locator("text=Tela da cozinha").first()).toBeVisible();
  await system.page.locator("[data-addon-new]").click();
  const form = system.page.locator("[data-addon-form]");
  await form.locator('input[name="name"]').fill(addonName);
  await form.locator('textarea[name="description"]').fill("Rotas do dia dos entregadores, com o tempo de cada entrega.");
  await form.locator('input[name="price"]').fill("19.90");
  await form.locator('label[title="truck"]').click();
  await form.locator('label:has(input[name="plan-START"][value="none"])').click();
  await form.locator('label:has(input[name="plan-PRO"][value="included"])').click();
  await form.locator('input[name="link"]').fill("https://site-de-fora.com");
  await expect(form.locator("[data-addon-link-msg]")).toContainText("Links de fora não são aceitos");
  await form.locator('input[name="link"]').fill(`/admin/?section=${section}`);
  await expect(form.locator("[data-addon-link-msg]")).toContainText("Link da plataforma");
  await form.locator('input[name="menuLabel"]').fill("Rotas");
  await form.locator('select[name="status"]').selectOption("live");
  await expect(form.locator("[data-addon-preview]")).toContainText(addonName);
  await shot(system.page, "sys-2-criar");
  await form.getByRole("button", { name: "Criar adicional" }).click();
  await expect(system.page.locator("[data-system-toast]")).toContainText("já aparece para os restaurantes");
  await expect(system.page.locator("[data-addons-panel]")).toContainText(addonName);
  await shot(system.page, "sys-3-catalogo");
  const catalog = (await (await master.api.get("/api/system/addons")).json()).data.catalog;
  const created = catalog.find((item) => item.name === addonName);
  expect(created).toMatchObject({ priceCents: 1990, status: "live", link: `/admin/?section=${section}`, plans: { START: "none", BUSINESS: "paid", PRO: "included" } });

  // 2) O dono não cria adicional nem dá cortesia.
  const owner = await loginTenantOwner(restaurant);
  expect([401, 403]).toContain((await owner.api.post("/api/system/addons/catalog", { data: { name: "X" } })).status());
  expect([401, 403]).toContain((await owner.api.post(`/api/system/addons/${restaurant.key}/gift`, { data: { addonKey: created.key, reason: "eu mesmo" } })).status());

  // 3) Link da tela com o adicional desligado leva para "Plano e adicionais".
  const gestor = await ownerPage(browser, restaurant);
  const ownerErrors = [];
  gestor.page.on("pageerror", (error) => ownerErrors.push(error.message));
  await gestor.page.goto(`/admin/?section=${section}`);
  await expect(gestor.page).toHaveURL(new RegExp(`tab=addons&addon=${created.key}`));
  const card = gestor.page.locator(`[data-addon-card="${created.key}"]`);
  await expect(card).toBeVisible();
  await expect(card).toHaveClass(/is-highlight/);
  await expect(gestor.page.locator("[data-addons-total]")).toHaveText(/179,90/);
  await shot(gestor.page, "gx-1-adicionais");

  // 4) Ligar: janela com o valor grande; só liga depois de marcar "Entendi".
  await card.locator("[data-addon-switch]").click();
  const modal = gestor.page.locator("[data-addon-modal]");
  await expect(modal).toContainText("R$ 19,90");
  await expect(modal.locator("[data-addon-modal-go]")).toBeDisabled();
  await modal.locator("[data-addon-agree]").check();
  await shot(gestor.page, "gx-2-ligar");
  await modal.locator("[data-addon-modal-go]").click();
  await expect(gestor.page.locator("[data-addons-message]")).toContainText("ligado");
  await expect(card).toContainText("Ligado");
  await expect(gestor.page.locator("[data-addons-total]")).toHaveText(/199,80/);
  // O mês inteiro foi lançado no extrato (uma vez só).
  let billing = (await (await master.api.get("/api/system/billing")).json()).data.restaurants.find((row) => row.restaurantKey === restaurant.key);
  expect(billing.owedCents).toBe(1990);
  expect(billing.monthlyValueCents).toBe(19980);

  // 5) Desligar: continua até o fim do mês; religar não cobra de novo.
  await card.locator("[data-addon-switch]").click();
  await expect(modal).toContainText("não é cobrado");
  await modal.locator("[data-addon-modal-go]").click();
  await expect(card).toContainText("Desliga em");
  await expect(gestor.page.locator("[data-addons-total]")).toHaveText(/179,90/);
  await shot(gestor.page, "gx-3-desligando");
  await card.getByRole("button", { name: "Manter ligado" }).click();
  await expect(card).toContainText("Ligado");
  billing = (await (await master.api.get("/api/system/billing")).json()).data.restaurants.find((row) => row.restaurantKey === restaurant.key);
  expect(billing.owedCents).toBe(1990);

  // 6) INOVAS: detalhes do restaurante e cortesia de 1 mês.
  await system.page.reload();
  await system.page.locator('[data-addons-tab="restaurants"]').click();
  await system.page.locator(`[data-addons-row="${restaurant.key}"]`).click();
  const drawer = system.page.locator("dialog.is-drawer");
  await expect(drawer).toContainText(addonName);
  await expect(drawer).toContainText("ligado pelo dono");
  await shot(system.page, "sys-4-detalhes");
  await drawer.locator("[data-addon-gift-open]").click();
  const gift = system.page.locator("[data-addon-gift-form]");
  await gift.locator('select[name="what"]').selectOption("__discount");
  await gift.locator('input[name="percent"]').fill("50");
  await expect(gift.locator("[data-gift-preview]")).toContainText("R$ 89,95");
  await gift.getByRole("button", { name: "Dar cortesia" }).click();
  // Sem motivo não envia (campo obrigatório).
  expect(await gift.locator('textarea[name="reason"]').evaluate((element) => element.checkValidity())).toBe(false);
  await gift.locator('textarea[name="reason"]').fill("Indicou dois restaurantes novos");
  await shot(system.page, "sys-5-cortesia");
  await gift.getByRole("button", { name: "Dar cortesia" }).click();
  await expect(system.page.locator("[data-system-toast]")).toContainText("Cortesia registrada");
  await expect(system.page.locator("dialog.is-drawer")).toContainText("50% de desconto no plano");
  const view = (await (await master.api.get("/api/system/addons")).json()).data.restaurants.find((row) => row.restaurantKey === restaurant.key);
  expect(view.discount).toMatchObject({ percent: 50, valueCents: 8995 });
  expect(view.monthlyValueCents).toBe(17990 - 8995 + 1990);

  // 7) Gestor mostra o desconto da INOVAS no resumo.
  await gestor.page.reload();
  await expect(gestor.page.locator("[data-addons-summary]")).toContainText("Desconto INOVAS (50%)");
  expect(sysErrors).toEqual([]);
  expect(ownerErrors).toEqual([]);
  await system.context.close();
  await gestor.context.close();
});
