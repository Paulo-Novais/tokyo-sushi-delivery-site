const path = require("node:path");
const fs = require("node:fs/promises");
const { test, expect } = require("@playwright/test");
const {
  createPublicOrder,
  loginMaster,
  loginTenantOwner,
  onboardRestaurant,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");

// Previsão inteligente: tela em Resultados, só leitura e isolada por restaurante.
const outDir = path.join(process.cwd(), "artifacts", "previsao");

test("Previsão: tela no Gestor e dados isolados por restaurante", async ({ page }) => {
  test.setTimeout(180_000);
  await fs.mkdir(outDir, { recursive: true });
  const master = await loginMaster();
  const a = await onboardRestaurant(master.api, { key: uniqueKey("prev-a"), name: "Restaurante Previsão A", ownerPassword: "OwnerPrevA123!" });
  const b = await onboardRestaurant(master.api, { key: uniqueKey("prev-b"), name: "Restaurante Previsão B", ownerPassword: "OwnerPrevB123!" });
  await master.api.dispose();

  // Um pedido só no restaurante A.
  await createPublicOrder({ host: a.host, label: "previsao-a" });

  const ownerA = await loginTenantOwner(a);
  const ownerB = await loginTenantOwner(b);
  const forecastA = (await (await ownerA.api.get("/api/admin/forecast")).json()).forecast;
  const responseB = await ownerB.api.get("/api/admin/forecast");
  expect(responseB.status()).toBe(200);
  const forecastB = (await responseB.json()).forecast;

  const todayA = forecastA.todayAlert.series.reduce((sum, hour) => sum + (hour.actual || 0), 0);
  const todayB = forecastB.todayAlert.series.reduce((sum, hour) => sum + (hour.actual || 0), 0);
  expect(todayA).toBe(1);
  expect(todayB).toBe(0);
  expect(forecastB.customers.count).toBe(0);
  expect(forecastA.hasEnoughHistory).toBe(false);

  // Sem login não abre.
  const anonymous = await page.request.get("/api/admin/forecast");
  expect(anonymous.status()).toBe(401);
  await ownerA.api.dispose();
  await ownerB.api.dispose();

  // Tela: Resultados › Previsão.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `127.62.${Math.floor(Math.random() * 200)}.4` });
  await page.goto("/admin/login.html?next=%2Fadmin%2F");
  await page.locator('input[name="identifier"]').fill(a.ownerLogin);
  await page.locator('input[name="password"]').fill(a.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  const navItem = page.locator('.admin-nav [data-admin-section="forecast"]');
  await expect(navItem).toBeVisible();
  await navItem.click();
  await expect(page.locator(".gx-res-head h2")).toHaveText("Previsão");
  await expect(page.locator('.gx-res-tabs [data-results-tab="forecast"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".gx-fc-banner")).toBeVisible();
  await expect(page.locator(".gx-fc-kpi")).toHaveCount(5);
  await expect(page.locator(".gx-fc")).toContainText("pelo menos 2 semanas de pedidos");
  await expect(page.locator(".gx-fc-card h3", { hasText: "Vendas por dia" })).toBeVisible();
  await expect(page.locator(".gx-fc-card h3", { hasText: "Matéria-prima" })).toBeVisible();
  await expect(page.locator(".gx-fc-card h3", { hasText: "Clientes com frequência caindo" })).toBeVisible();
  await expect(page.locator(".gx-fc-card h3", { hasText: "Lucro e prejuízo" })).toBeVisible();
  await page.screenshot({ path: path.join(outDir, "previsao-pouco-historico.png"), fullPage: true });

  // As outras abas de Resultados seguem funcionando.
  await page.locator('.gx-res-tabs [data-results-tab="reports"]').click();
  await expect(page.locator(".gx-res-head h2")).toHaveText("Relatórios");
});
