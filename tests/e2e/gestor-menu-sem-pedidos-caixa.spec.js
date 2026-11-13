const { test, expect } = require("@playwright/test");
const { loginMaster, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");

// Pedidos e Caixa passaram para o app INOVAS PDV (Gestor desktop). No Gestor do
// navegador eles saem do menu, mas:
//  - o endereço direto continua abrindo (decisão do Paulo: só tirar do menu);
//  - os botões continuam na página (escondidos): o app troca de tela clicando
//    neles, e o aviso "Ver pedido" do Gestor também.

const loginOwner = async (page) => {
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("menu-pdv"),
    name: "Restaurante Menu",
    ownerPassword: "OwnerMenuPdv123!",
  });
  await master.api.dispose();
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `127.34.${Math.floor(Math.random() * 200)}.9` });
  await page.goto("/login");
  await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForURL(/\/admin\//);
  await page.waitForSelector('.admin-nav [data-admin-section="dashboard"]');
};

test("Gestor no navegador: Pedidos e Caixa fora do menu, resto do menu igual", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginOwner(page);

  const nav = page.locator(".admin-nav");
  await expect(nav.locator('[data-admin-section="orders"]')).toBeHidden();
  await expect(nav.locator('[data-admin-section="cash-register"]')).toBeHidden();
  await expect(nav.locator(".admin-nav-submenu")).toBeHidden();
  // Botões continuam na página (o app e o aviso "Ver pedido" usam).
  await expect(nav.locator('[data-admin-section="orders"]')).toHaveCount(1);
  await expect(nav.locator('[data-admin-section="cash-register"]')).toHaveCount(1);
  // O resto do menu continua visível.
  for (const section of ["dashboard", "menu", "customers", "finance", "settings", "users"]) {
    await expect(nav.locator(`[data-admin-section="${section}"]`), section).toBeVisible();
  }
});

test("Gestor no navegador: endereço direto de Pedidos e Caixa continua abrindo", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await loginOwner(page);

  await page.goto("/admin/?section=orders");
  await expect(page.locator("body")).toHaveAttribute("data-admin-section", "orders");
  await expect(page.locator("[data-admin-module-content]")).not.toContainText("Carregando modulo");

  await page.goto("/admin/caixa/salao");
  await expect(page.locator("body")).toHaveAttribute("data-admin-section", "cash-register");
  await expect(page.locator(".admin-nav .admin-nav-submenu")).toBeHidden();

  // Como o app faz: troca de tela clicando no botão escondido do menu.
  await page.evaluate(() => document.querySelector('.admin-nav [data-admin-section="orders"]').click());
  await expect(page.locator("body")).toHaveAttribute("data-admin-section", "orders");
});

test("Gestor no celular: menu sem Pedidos e Caixa", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await loginOwner(page);
  await expect(page.locator('.admin-nav [data-admin-section="orders"]')).toBeHidden();
  await expect(page.locator('.admin-nav [data-admin-section="cash-register"]')).toBeHidden();
});
