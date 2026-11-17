const { test, expect } = require("@playwright/test");
const { loginMaster, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");

// Caixa e Pedidos ficam só no app INOVAS PDV. No site, o menu lateral do
// restaurante não mostra esses itens, mas as telas continuam abrindo pelo
// endereço, porque é assim que o app as usa.

test("Gestor no site: menu sem Caixa e Pedidos, telas continuam abrindo pelo endereço", async ({ page }) => {
  test.setTimeout(180_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("menuapp"),
    name: "Restaurante Menu App",
    ownerPassword: "OwnerMenuApp123!",
  });

  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `127.44.${Math.floor(Math.random() * 200)}.7` });
  await page.goto("/admin/login.html?next=%2Fadmin%2F");
  await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForLoadState("networkidle");

  const nav = page.locator(".admin-nav");
  await expect(nav.locator('[data-admin-section="dashboard"]')).toBeVisible();
  await expect(nav.locator('[data-admin-section="menu"]')).toBeVisible();
  await expect(nav.locator('[data-admin-section="cash-register"]')).toBeHidden();
  await expect(nav.locator('[data-admin-section="orders"]')).toBeHidden();
  const visibleTitles = await nav.locator(".admin-nav-item:visible strong").allInnerTexts();
  expect(visibleTitles).not.toContain("Caixa");
  expect(visibleTitles).not.toContain("Pedidos");
  expect(visibleTitles).toContain("Agendamentos");

  // Atalhos internos continuam abrindo Pedidos (ex.: "ver pedidos" do Financeiro).
  await nav.locator('[data-admin-section="finance"]').click();
  await expect(page.locator("body")).toHaveAttribute("data-admin-section", "finance");
  await page.evaluate(() => {
    const link = document.createElement("button");
    link.type = "button";
    link.dataset.finGoto = "orders";
    document.body.append(link);
    link.click();
    link.remove();
  });
  await expect(page.locator("body")).toHaveAttribute("data-admin-section", "orders");
  await expect(nav.locator('[data-admin-section="orders"]')).toBeHidden();

  // Endereços que o app abre continuam funcionando.
  await page.goto("/admin/?section=orders");
  await expect.poll(() => page.evaluate(() => document.body.dataset.adminSection)).toBe("orders");
  await expect(nav.locator('[data-admin-section="orders"]')).toBeHidden();

  await page.goto("/admin/caixa/salao");
  await expect.poll(() => page.evaluate(() => document.body.dataset.adminSection)).toBe("cash-register");
  await expect(nav.locator('[data-admin-section="cash-register"]')).toBeHidden();
  await expect(nav.locator(".admin-nav-submenu")).toHaveCount(0);

  expect(errors).toEqual([]);
});
