const path = require("node:path");
const fs = require("node:fs/promises");
const { test, expect } = require("@playwright/test");
const { loginMaster, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");

// Estoque v2 (esboço) + menu lateral agrupado.
const outDir = path.join(process.cwd(), "artifacts", "estoque");

const openInventory = async (page, theme = "dark") => {
  const master = await loginMaster();
  const r = await onboardRestaurant(master.api, { key: uniqueKey("estoque"), name: "Restaurante Estoque", ownerPassword: "OwnerEstoque123!" });
  await master.api.dispose();
  await page.addInitScript((value) => { try { localStorage.setItem("tokyo_admin_theme", value); } catch {} }, theme);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `127.61.${Math.floor(Math.random() * 200)}.4` });
  await page.goto("/admin/login.html?next=%2Fadmin%2F");
  await page.locator('input[name="identifier"]').fill(r.ownerLogin);
  await page.locator('input[name="password"]').fill(r.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForSelector('.admin-nav [data-admin-section="inventory"]');
  await page.locator('.admin-nav [data-admin-section="inventory"]').click();
  await page.waitForSelector(".gx-inv-row:not(.gx-inv-row-head)");
};

test("Estoque v2: tabela, filtros, entrada/baixa e menu agrupado", async ({ page }) => {
  test.setTimeout(150_000);
  await fs.mkdir(outDir, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await openInventory(page);

  // Menu: títulos de grupo, todos os itens com ícone, selo só no Estoque e em Configurações.
  for (const heading of ["Operação", "Cardápio", "Clientes", "Resultados", "Ajustes"]) {
    await expect(page.locator(".admin-nav .gx-nav-heading", { hasText: heading })).toBeVisible();
  }
  await expect(page.locator('.admin-nav [data-admin-section="scheduled"] .admin-nav-icon')).toBeVisible();
  await expect(page.locator('.admin-nav [data-admin-section="orders"] .admin-nav-badge')).toHaveCount(0);
  await expect(page.locator('.admin-nav [data-admin-section="settings"] .admin-nav-badge')).toHaveText("Site");

  // Cabeçalho, indicadores e tabela.
  await expect(page.locator(".gx-inv-head h2")).toHaveText("Controle diário de insumos");
  await expect(page.locator(".gx-inv-stat")).toHaveCount(5);
  const rows = page.locator(".gx-inv-row:not(.gx-inv-row-head)");
  const total = await rows.count();
  expect(total).toBeGreaterThan(10);
  await expect(page.locator(".gx-inv-title")).toContainText(`${total} itens`);
  await page.screenshot({ path: path.join(outDir, "estoque-escuro.png") });

  // Busca.
  const firstName = (await rows.first().locator(".gx-inv-name").innerText()).trim();
  await page.locator("[data-inventory-search]").fill(firstName.slice(0, 6));
  await expect(rows.first().locator(".gx-inv-name")).toContainText(firstName.slice(0, 6));
  await page.locator("[data-inventory-search]").fill("");
  await expect(rows).toHaveCount(total);

  // Categoria e indicador como filtros.
  const chip = page.locator(".gx-inv-chip").nth(1);
  const chipCount = Number((await chip.locator("span").innerText()).trim());
  await chip.click();
  await expect(rows).toHaveCount(chipCount);
  await page.locator('.gx-inv-chip[data-inventory-category=""]').click();
  const okCount = Number(await page.locator('[data-inventory-status="ok"] strong').innerText());
  await page.locator('[data-inventory-status="ok"]').click();
  await expect(rows).toHaveCount(okCount);
  await page.locator('[data-inventory-status="ok"]').click();
  await expect(rows).toHaveCount(total);

  // Entrada: painel lateral, +, prévia e validade do lote.
  const row = rows.first();
  const name = (await row.locator(".gx-inv-name").innerText()).trim();
  const before = Number((await row.locator(".gx-inv-stock b").innerText()).replace(/\./g, "").replace(",", "."));
  await row.locator('[data-inventory-adjust-intent="add"]').click();
  const drawer = page.locator("[data-admin-detail-panel]");
  await expect(page.locator("body")).toHaveClass(/gx-inv-drawer-open/);
  await expect(drawer.locator(".gx-inv-move-head h2")).toHaveText(name);
  await page.locator('[data-inv-step="1"]').click();
  await expect(drawer.locator("[data-inv-preview]")).toContainText(String(before + 2).replace(".", ","));
  const future = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  await drawer.locator("[data-inv-expiration]").fill(future);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, "estoque-entrada.png") });
  await drawer.locator(".gx-inv-confirm").click();
  await expect(page.locator("body")).not.toHaveClass(/gx-inv-drawer-open/);
  const updated = page.locator(".gx-inv-row", { has: page.locator(".gx-inv-name", { hasText: name }) }).first();
  await expect(updated.locator(".gx-inv-stock b")).toHaveText(String(before + 2).replace(".", ","));
  await expect(updated.locator(".admin-inventory-validity")).toContainText(/Vence|dias|amanh/i);

  // Baixa pela aba do painel.
  await updated.locator('[data-inventory-adjust-intent="add"]').click();
  await drawer.locator('[data-inv-move-mode="remove"]').click();
  await expect(drawer.locator(".gx-inv-move-head small")).toHaveText("Baixa de estoque");
  await drawer.locator(".gx-inv-confirm").click();
  await expect(updated.locator(".gx-inv-stock b")).toHaveText(String(before + 1).replace(".", ","));

  // Novo item abre o painel com o formulário; Esc fecha.
  await page.locator("[data-inventory-new]").click();
  await expect(drawer.locator("[data-inventory-item-form]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveClass(/gx-inv-drawer-open/);

  // Exportar baixa um CSV.
  const download = page.waitForEvent("download");
  await page.locator("[data-inventory-export]").click();
  expect((await download).suggestedFilename()).toMatch(/^estoque-\d{4}-\d{2}-\d{2}\.csv$/);

  // Grade.
  await page.locator('[data-inventory-view="grid"]').click();
  await expect(page.locator(".gx-inv-grid .admin-inventory-item").first()).toBeVisible();
  await page.locator('[data-inventory-view="list"]').click();
});

test("Estoque v2: tema claro e celular", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openInventory(page, "light");
  await page.screenshot({ path: path.join(outDir, "estoque-claro.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(outDir, "estoque-celular.png") });
});
