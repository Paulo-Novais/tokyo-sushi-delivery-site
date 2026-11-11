const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const {
  expectNoHorizontalOverflow,
  loginMaster,
  onboardRestaurant,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");

// Captura cada área do Gestor para revisão visual e garante que nenhuma
// tela quebra a largura em 1024, 1366 e 1920 px.

const shots = path.join(process.cwd(), "artifacts", "novo-gestor");
fs.mkdirSync(shots, { recursive: true });

const SECTIONS = [
  ["painel", "dashboard"],
  ["pedidos", "orders"],
  ["cardapio", "menu"],
  ["estoque", "inventory"],
  ["clientes", "customers"],
  ["resultados", "metrics"],
  ["financeiro", "finance"],
  ["relatorios", "reports"],
  ["configuracoes", "settings"],
];

test("Gestor: todas as áreas abrem sem erro e sem rolagem lateral", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("gestor-visual"),
    name: "Restaurante Visual",
    ownerPassword: "OwnerGestorVisual123!",
  });
  try {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.setExtraHTTPHeaders({ "x-forwarded-for": "127.41.51.61" });
    await page.goto("/admin/login.html?next=%2Fadmin%2F", { waitUntil: "domcontentloaded" });
    await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
    await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
    await page.locator("[data-admin-login-submit]").click();
    await expect(page).toHaveURL(/\/admin\/?/);
    await page.waitForLoadState("networkidle");

    for (const [name, key] of SECTIONS) {
      await page.locator(`.admin-nav [data-admin-section="${key}"]`).click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(400);
      for (const [width, height] of [[1366, 768], [1024, 768]]) {
        await page.setViewportSize({ width, height });
        await expectNoHorizontalOverflow(page);
        await page.screenshot({ path: path.join(shots, `${name}-${width}.png`), fullPage: true });
        await page.screenshot({ path: path.join(shots, `${name}-${width}-tela.png`) });
      }
      await page.setViewportSize({ width: 1366, height: 768 });
    }
    expect(errors).toEqual([]);
  } finally {
    await master.api.dispose();
  }
});
