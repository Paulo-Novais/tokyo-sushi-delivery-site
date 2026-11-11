const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { loginMaster, onboardRestaurant, uniqueKey, expectNoHorizontalOverflow } = require("./helpers/v1.9-fixtures.cjs");

// Cardápio do Gestor em lista compacta: uma linha por prato, formulário só ao
// clicar, busca rápida sem recarregar e o prato aberto continua aberto depois
// de salvar.

const outDir = path.join(process.cwd(), "artifacts", "novo-gestor");
fs.mkdirSync(outDir, { recursive: true });

test("Cardápio compacto: abrir, editar, salvar e buscar", async ({ page }) => {
  test.setTimeout(180_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("cardapio"),
    name: "Restaurante Cardapio",
    ownerPassword: "OwnerCardapio123!",
  });
  try {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.setExtraHTTPHeaders({ "x-forwarded-for": "127.61.71.81" });
    await page.goto("/admin/login.html?next=%2Fadmin%2F%3Fsection%3Dmenu");
    await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
    await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
    await page.locator("[data-admin-login-submit]").click();
    await page.waitForLoadState("networkidle");
    await page.locator('.admin-nav [data-admin-section="menu"]').first().click();

    const rows = page.locator(".admin-menu-line:not(.is-new)");
    await expect(rows.first()).toBeVisible();
    const total = await rows.count();
    expect(total).toBeGreaterThan(5);
    // Nenhum formulário aberto ao chegar: só as linhas.
    await expect(page.locator(".admin-menu-line[open]")).toHaveCount(0);
    await expect(page.locator(".admin-menu-item-card:visible")).toHaveCount(0);

    await page.locator(".admin-menu-section-card").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(outDir, "cardapio-lista.png") });

    // Cada linha fechada precisa ser compacta (no máximo 90 px).
    const rowHeights = await rows.evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().height)));
    expect(Math.max(...rowHeights), `alturas: ${rowHeights.slice(0, 5).join(",")}`).toBeLessThanOrEqual(90);

    // Abre o primeiro prato, muda o preço e salva.
    const first = rows.first();
    const name = (await first.locator(".admin-menu-row-name strong").innerText()).trim();
    await first.locator(".admin-menu-row-summary").click();
    await expect(first.locator(".admin-menu-item-card")).toBeVisible();
    await first.locator('input[name="price"]').fill("47.90");
    await first.locator('button[value="save-item"]').click();
    const reopened = page.locator(".admin-menu-line:not(.is-new)", { hasText: name }).first();
    await expect(reopened.locator(".admin-menu-row-price")).toContainText("47,90");
    await expect(reopened).toHaveAttribute("open", "");
    await expect(reopened).toBeInViewport();
    await page.screenshot({ path: path.join(outDir, "cardapio-editando.png") });

    // Busca rápida filtra sem recarregar e mantém o foco no campo.
    const search = page.locator("[data-menu-quick-search]");
    await search.fill(name.slice(0, 6));
    await expect(search).toBeFocused();
    const visible = await page.locator(".admin-menu-line:not(.is-new):visible").count();
    expect(visible).toBeGreaterThan(0);
    expect(visible).toBeLessThan(total);
    await search.fill("zzzz-nao-existe");
    await expect(page.locator("[data-menu-search-empty]")).toBeVisible();
    await search.fill("");
    await expect(page.locator(".admin-menu-line:not(.is-new):visible")).toHaveCount(total);

    // Celular: sem rolagem lateral.
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
  } finally {
    await master.api.dispose();
  }
});
