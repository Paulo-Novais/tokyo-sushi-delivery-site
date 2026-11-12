const path = require("node:path");
const fs = require("node:fs/promises");
const { test, expect } = require("@playwright/test");
const { loginMaster, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");

// Resultados (Resumo): indicadores com comparação, vendas por dia, pagamentos,
// situação, mais vendidos e fechamentos. Dados do Financeiro simulados.
const outDir = path.join(process.cwd(), "artifacts", "resultados");
const day = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const snapshot = (scale) => ({
  filters: { startDate: day(-6), endDate: day(0) },
  overview: { grossRevenue: 7920 * scale, validOrders: Math.round(142 * scale), averageTicket: 55.77, cancelledOrders: scale === 1 ? 5 : 7 },
  paymentBreakdown: [
    { key: "dinheiro", label: "Dinheiro", total: 1350, percent: 17 },
    { key: "pix", label: "Pix", total: 3560, percent: 45 },
    { key: "cartao", label: "Cartao", total: 2450, percent: 31 },
    { key: "online_outros", label: "Online/outros", total: 560, percent: 7 },
  ],
  charts: { revenueTrend: [980, 1120, 1480, 1090, 1560, 1250, 1284].map((total, index) => ({ key: day(index - 6), total })) },
  statusSummary: { delivered: 131, inProgress: 6, cancelled: 5 },
  topProducts: [
    { name: "Combo Sushi 20 peças", quantity: 38 },
    { name: "Temaki Salmão", quantity: 31 },
    { name: "Guioza", quantity: 27 },
  ],
  productRanking: [
    { name: "Combo Sushi 20 peças", quantity: 38, total: 1938 },
    { name: "Temaki Salmão", quantity: 31, total: 1240 },
    { name: "Hot Roll", quantity: 22, total: 990 },
    { name: "Guioza", quantity: 27, total: 810 },
    { name: "Carpaccio de Salmão", quantity: 14, total: 560 },
    { name: "Yakisoba", quantity: 9, total: 430 },
    { name: "Sunomono", quantity: 6, total: 180 },
    { name: "Missoshiru", quantity: 8, total: 120 },
  ],
  reportOrders: Array.from({ length: 40 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (index % 7));
    date.setHours(index % 3 === 0 ? 20 : index % 3 === 1 ? 12 : 19, 15, 0, 0);
    return { createdAt: date.toISOString(), total: 50 + index, channel: ["site", "salao", "retirada", "balcao"][index % 4], returningCustomer: index % 5 !== 0 };
  }),
  recentCashClosings: [
    { closedAt: `${day(-1)}T23:30:00`, countedCash: 1164, differenceAmount: 0 },
    { closedAt: `${day(-2)}T23:30:00`, countedCash: 1538.5, differenceAmount: 3 },
  ],
});

const open = async (page, theme) => {
  const master = await loginMaster();
  const r = await onboardRestaurant(master.api, { key: uniqueKey("result"), name: "Restaurante Resultados", ownerPassword: "OwnerResult123!" });
  await master.api.dispose();
  await page.route("**/api/admin/finance?**", (route) => {
    const url = new URL(route.request().url());
    const previous = url.searchParams.get("period") === "custom";
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, ...snapshot(previous ? 0.89 : 1) }) });
  });
  await page.addInitScript((value) => { try { localStorage.setItem("tokyo_admin_theme", value); } catch {} }, theme);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `127.71.${Math.floor(Math.random() * 200)}.5` });
  await page.goto("/admin/login.html?next=%2Fadmin%2F");
  await page.locator('input[name="identifier"]').fill(r.ownerLogin);
  await page.locator('input[name="password"]').fill(r.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForSelector('.admin-nav [data-admin-section="metrics"]');
  await page.locator('.admin-nav [data-admin-section="metrics"]').click();
  await page.waitForSelector(".gx-res-kpi");
};

test("Resultados: resumo com comparação, gráfico e listas", async ({ page }) => {
  test.setTimeout(120_000);
  await fs.mkdir(outDir, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "light");
  await expect(page.locator(".gx-res-head h2")).toHaveText("Resumo");
  await expect(page.locator(".gx-res-kpi").first()).toContainText("R$ 7.920,00");
  await expect(page.locator(".gx-res-kpi").first()).toContainText("▲ 12% vs. semana anterior");
  await expect(page.locator(".gx-res-kpi").nth(3)).toContainText("▼ 2 a menos que antes");
  await expect(page.locator(".gx-res-bar-col")).toHaveCount(7);
  await expect(page.locator(".gx-res-bar-col.is-today .gx-res-bar-label")).toHaveText("Hoje");
  await expect(page.locator(".gx-res-pay-row").first()).toContainText("Dinheiro");
  await expect(page.locator(".gx-res-list").first()).toContainText("131");
  await expect(page.locator(".gx-res-list").nth(1)).toContainText("Combo Sushi 20 peças");
  await expect(page.locator(".gx-res-list").nth(2)).toContainText("Confere");
  await expect(page.locator(".gx-res-list").nth(2)).toContainText("Sobrou R$ 3,00");
  await page.screenshot({ path: path.join(outDir, "resumo-claro.png"), fullPage: true });

  const download = page.waitForEvent("download");
  await page.locator("[data-results-download]").click();
  expect((await download).suggestedFilename()).toMatch(/^resultados-.*\.csv$/);

  // Abas levam a Financeiro e Relatórios, com o mesmo cabeçalho.
  await page.locator('[data-results-tab="finance"]').click();
  await expect(page.locator("body")).toHaveAttribute("data-admin-section", "finance");
  await expect(page.locator('[data-results-tab="finance"]')).toHaveClass(/is-active/);
  await page.locator('[data-results-tab="reports"]').click();
  await expect(page.locator("body")).toHaveAttribute("data-admin-section", "reports");

  // Relatórios: pico (mapa de calor), ABC, canais, clientes; os que dependem de dados novos ficam "em breve".
  await expect(page.locator(".gx-rep-card")).toHaveCount(6);
  await expect(page.locator(".gx-rep-heat .gx-rep-cell").first()).toBeVisible();
  await expect(page.locator(".gx-rep-view-head p")).toContainText("Os horários com mais pedidos");
  await page.screenshot({ path: path.join(outDir, "relatorios-pico.png"), fullPage: true });
  await page.locator('[data-report-key="abc"]').click();
  await expect(page.locator(".gx-rep-tr:not(.is-head)")).toHaveCount(8);
  await expect(page.locator(".gx-rep-tr:not(.is-head)").first()).toContainText("A");
  await expect(page.locator(".gx-rep-tr:not(.is-head)").last()).toContainText("C");
  await page.screenshot({ path: path.join(outDir, "relatorios-abc.png"), fullPage: true });
  await page.locator('[data-report-key="channels"]').click();
  await expect(page.locator(".gx-rep-bars .gx-res-pay-row")).toHaveCount(4);
  await expect(page.locator(".gx-rep-bars")).toContainText("Site próprio");
  await page.locator('[data-report-key="customers"]').click();
  await expect(page.locator(".gx-rep-view-head p")).toContainText("% dos pedidos vieram de clientes que já tinham comprado antes");
  const reportCsv = page.waitForEvent("download");
  await page.locator("[data-report-csv]").click();
  expect((await reportCsv).suggestedFilename()).toMatch(/^relatorio-customers-/);
  await page.locator('[data-report-key="dre"]').click();
  await expect(page.locator(".gx-rep-soon")).toContainText("despesas");
});

test("Resultados: tema escuro e celular", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "dark");
  await page.screenshot({ path: path.join(outDir, "resumo-escuro.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
