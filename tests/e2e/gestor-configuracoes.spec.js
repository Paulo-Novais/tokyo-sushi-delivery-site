const path = require("node:path");
const fs = require("node:fs/promises");
const { test, expect, request: playwrightRequest } = require("@playwright/test");
const { loginMaster, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");

// Configurações do site (esboço "Configurações do site"): 7 seções, pré-visualização ao vivo,
// salvar de verdade e conferir que o outro restaurante não muda.
const outDir = path.join(process.cwd(), "artifacts", "configuracoes");

const loginPage = async (page, restaurant, theme) => {
  await page.addInitScript((value) => { try { localStorage.setItem("tokyo_admin_theme", value); } catch {} }, theme);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `127.73.${Math.floor(Math.random() * 200)}.5` });
  await page.goto("/admin/login.html?next=%2Fadmin%2F");
  await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForSelector('.admin-nav [data-admin-section="settings"]');
  await page.locator('.admin-nav [data-admin-section="settings"]').click();
  await page.waitForSelector(".gx-set-panel:not([hidden])");
};

const readSettings = async (page) =>
  page.evaluate(async () => {
    const response = await fetch("/api/admin/settings/list", { credentials: "include" });
    return (await response.json()).settings;
  });

test("Configurações: seções, pré-visualização e salvar sem afetar outro restaurante", async ({ browser }) => {
  test.setTimeout(180_000);
  await fs.mkdir(outDir, { recursive: true });
  const master = await loginMaster();
  const a = await onboardRestaurant(master.api, { key: uniqueKey("cfga"), name: "Restaurante Config A", ownerPassword: "OwnerCfgA123!" });
  const b = await onboardRestaurant(master.api, { key: uniqueKey("cfgb"), name: "Restaurante Config B", ownerPassword: "OwnerCfgB123!" });
  await master.api.dispose();

  const contextB = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const pageB = await contextB.newPage();
  await loginPage(pageB, b, "light");
  const beforeB = await readSettings(pageB);

  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await loginPage(page, a, "dark");

  await expect(page.locator(".gx-set-head h2")).toHaveText("Configurações do site");
  await expect(page.locator("[data-gx-set-tab]")).toHaveCount(7);
  await expect(page.locator("[data-gx-set-status]")).toHaveText("Tudo salvo");
  await page.screenshot({ path: path.join(outDir, "identidade-escuro.png"), fullPage: true });

  // Identidade: o nome muda na pré-visualização na hora e marca "não salvo".
  await page.locator('[data-restaurant-settings-field="restaurantName"]').fill("Casa Teste A");
  await page.locator('[data-restaurant-settings-field="slogan"]').fill("Sabor de verdade");
  await expect(page.locator('[data-gx-prev="name"]')).toHaveText("Casa Teste A");
  await expect(page.locator('[data-gx-prev="slogan"]')).toHaveText("Sabor de verdade");
  await expect(page.locator("[data-gx-set-status]")).toHaveText("Alterações não salvas");

  // Aparência: paleta pronta + tema claro.
  await page.locator('[data-gx-set-tab="appearance"]').click();
  await expect(page.locator('[data-gx-set-panel="appearance"]')).toBeVisible();
  await expect(page.locator('[data-gx-set-panel="identity"]')).toBeHidden();
  await page.locator('[data-gx-palette="jade"]').click();
  await expect(page.locator('[data-gx-palette="jade"]')).toHaveClass(/is-active/);
  await expect(page.locator('[data-gx-set-hex="primaryColor"]')).toHaveText("#10B981");
  await page.locator('[data-gx-theme="LIGHT"]').click();
  await expect(page.locator("[data-gx-set-phone]")).toHaveAttribute("data-theme", "light");
  await page.screenshot({ path: path.join(outDir, "aparencia-escuro.png"), fullPage: true });

  // Funcionamento: fecha o domingo.
  await page.locator('[data-gx-set-tab="hours"]').click();
  await page.locator('[data-restaurant-settings-field="businessSchedule.days.sunday.isOpen"]').uncheck();
  await page.screenshot({ path: path.join(outDir, "funcionamento-escuro.png"), fullPage: true });

  // Entrega: pedido mínimo.
  await page.locator('[data-gx-set-tab="delivery"]').click();
  await page.locator('[data-restaurant-settings-field="deliveryBase.minimumDeliveryOrder"]').fill("45");

  // Google: prévia acompanha o título.
  await page.locator('[data-gx-set-tab="seo"]').click();
  await page.locator('[data-restaurant-settings-field="seoTitle"]').fill("Casa Teste A | Delivery");
  await expect(page.locator("[data-gx-google-title]")).toHaveText("Casa Teste A | Delivery");
  await expect(page.locator('[data-gx-set-count="seoTitle"]')).toHaveText("23/60");

  await page.locator('[data-restaurant-settings-action="save"]').click();
  await expect(page.locator("[data-gx-set-status]")).toHaveText("Tudo salvo");
  // Continua na mesma seção depois de salvar.
  await expect(page.locator('[data-gx-set-panel="seo"]')).toBeVisible();

  const savedA = await readSettings(page);
  expect(savedA.restaurantName).toBe("Casa Teste A");
  expect(savedA.slogan).toBe("Sabor de verdade");
  expect(String(savedA.primaryColor).toLowerCase()).toBe("#10b981");
  expect(String(savedA.siteTheme).toUpperCase()).toBe("LIGHT");
  expect(savedA.businessSchedule.days.sunday.isOpen).toBe(false);
  expect(Number(savedA.deliveryBase.minimumDeliveryOrder)).toBe(45);
  expect(savedA.seoTitle).toBe("Casa Teste A | Delivery");

  // Restaurante B não mudou.
  const afterB = await readSettings(pageB);
  expect(afterB.restaurantName).toBe(beforeB.restaurantName);
  expect(afterB.primaryColor).toBe(beforeB.primaryColor);
  expect(afterB.seoTitle).toBe(beforeB.seoTitle);

  // Descartar volta ao que está salvo.
  await page.locator('[data-gx-set-tab="identity"]').click();
  await page.locator('[data-restaurant-settings-field="restaurantName"]').fill("Nome que não vai ficar");
  await page.locator('[data-restaurant-settings-action="reset"]').click();
  await expect(page.locator('[data-restaurant-settings-field="restaurantName"]')).toHaveValue("Casa Teste A");
  await expect(page.locator("[data-gx-set-status]")).toHaveText("Tudo salvo");

  expect(errors).toEqual([]);
  await context.close();
  await contextB.close();
});

test("Configurações: tema claro e celular sem rolagem lateral", async ({ browser }) => {
  test.setTimeout(120_000);
  await fs.mkdir(outDir, { recursive: true });
  const master = await loginMaster();
  const r = await onboardRestaurant(master.api, { key: uniqueKey("cfgc"), name: "Restaurante Config C", ownerPassword: "OwnerCfgC123!" });
  await master.api.dispose();
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await context.newPage();
  await loginPage(page, r, "light");
  await page.screenshot({ path: path.join(outDir, "identidade-claro.png"), fullPage: true });
  for (const tab of ["appearance", "hours", "delivery", "contact", "seo", "address"]) {
    await page.locator(`[data-gx-set-tab="${tab}"]`).click();
    for (const width of [320, 390, 768, 1024, 1500]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(120);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${tab} em ${width}px`).toBeLessThanOrEqual(1);
    }
  }
  await page.locator('[data-gx-set-tab="hours"]').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(outDir, "funcionamento-celular.png"), fullPage: true });
  await context.close();
});
