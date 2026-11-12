const path = require("node:path");
const fs = require("node:fs/promises");
const { test, expect } = require("@playwright/test");
const { loginMaster, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");

// Financeiro (esboço "Financeiro redesign"): líquido com comparação, vendas por hora,
// indicadores, meios de pagamento, conferência do caixa e entregas. Dados simulados.
const outDir = path.join(process.cwd(), "artifacts", "financeiro");
const today = (() => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
})();

const buildSnapshot = ({ previous = false, countedCash = null, notes = "" } = {}) => ({
  ok: true,
  filters: { period: previous ? "custom" : "today", periodKey: previous ? "custom:x" : `today:${today}:${today}`, startDate: today, endDate: today, dayCount: 1 },
  periodOptions: [
    { key: "today", label: "Hoje" },
    { key: "7d", label: "7 dias" },
    { key: "30d", label: "30 dias" },
    { key: "month_current", label: "Mês atual" },
    { key: "custom", label: "Personalizado" },
  ],
  overview: {
    grossRevenue: 3912.4,
    netRevenue: previous ? 3206.55 : 3475.9,
    receivedRevenue: 3726.4,
    pendingAmount: 186,
    pendingOrders: 3,
    cancelledRevenue: 146.8,
    discountAmount: 124.5,
    averageTicket: 81.51,
    validOrders: 48,
    paidOrders: 45,
    cancelledOrders: 2,
    deliveredOrders: 26,
    deliveryFees: 312,
    deliveryPayout: 286,
  },
  paymentBreakdown: [
    { key: "dinheiro", label: "Dinheiro", count: 9, total: 612.3, percent: 16.4 },
    { key: "pix", label: "Pix", count: 21, total: 1684.1, percent: 45.2 },
    { key: "cartao", label: "Cartao", count: 15, total: 1430, percent: 38.4 },
    { key: "online_outros", label: "Online/outros", count: 0, total: 0, percent: 0 },
  ],
  reportOrders: Array.from({ length: 48 }, (_, index) => {
    const date = new Date();
    date.setHours([12, 13, 19, 20, 20, 21][index % 6], 10, 0, 0);
    return { createdAt: date.toISOString(), total: 60 + index, channel: "site", returningCustomer: false };
  }),
  closing: {
    countedCash,
    notes,
    updatedAt: countedCash === null ? "" : new Date().toISOString(),
    totalExpected: 3726.4,
    totalReceived: countedCash === null ? 3726.4 : Number((3726.4 - 612.3 + countedCash).toFixed(2)),
    difference: countedCash === null ? 0 : Number((countedCash - 612.3).toFixed(2)),
    cashExpected: 612.3,
    pixReceived: 1684.1,
    cardReceived: 1430,
    otherReceived: 0,
  },
  deliveryPayoutSettings: { mode: "fixed_by_band" },
});

const open = async (page, theme) => {
  const master = await loginMaster();
  const r = await onboardRestaurant(master.api, { key: uniqueKey("fin"), name: "Restaurante Financeiro", ownerPassword: "OwnerFin123!" });
  await master.api.dispose();
  const saved = { countedCash: null, notes: "" };
  await page.route("**/api/admin/finance**", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      const body = JSON.parse(request.postData() || "{}");
      saved.countedCash = Number(String(body.closing?.countedCash || "").replace(",", "."));
      saved.notes = body.closing?.notes || "";
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...buildSnapshot(saved), message: "Fechamento salvo." }) });
    }
    const url = new URL(request.url());
    const previous = url.searchParams.get("period") === "custom";
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(buildSnapshot({ previous, ...saved })) });
  });
  await page.addInitScript((value) => { try { localStorage.setItem("tokyo_admin_theme", value); } catch {} }, theme);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `127.72.${Math.floor(Math.random() * 200)}.5` });
  await page.goto("/admin/login.html?next=%2Fadmin%2F");
  await page.locator('input[name="identifier"]').fill(r.ownerLogin);
  await page.locator('input[name="password"]').fill(r.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForSelector('.admin-nav [data-admin-section="finance"]');
  await page.locator('.admin-nav [data-admin-section="finance"]').click();
  await page.waitForSelector(".gx-fin-net");
  return saved;
};

test("Financeiro: líquido, comparação, indicadores e conferência do caixa", async ({ page }) => {
  test.setTimeout(120_000);
  await fs.mkdir(outDir, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const saved = await open(page, "dark");

  await expect(page.locator(".gx-res-head h2")).toHaveText("Financeiro");
  await expect(page.locator('[data-results-tab="finance"]')).toHaveClass(/is-active/);
  await expect(page.locator(".gx-fin-big")).toHaveText("R$ 3.475,90");
  await expect(page.locator("[data-fin-compare]")).toContainText("+8,4% vs.");
  await expect(page.locator("[data-fin-compare]")).toContainText("passad");
  await expect(page.locator(".gx-fin-parts")).toContainText("− R$ 312,00");
  await expect(page.locator(".gx-fin-hour.is-peak")).toHaveCount(1);
  await expect(page.locator(".gx-fin-hours .gx-fin-card-head")).toContainText("Pico às 20h");
  await expect(page.locator(".gx-fin-kpi").nth(1)).toContainText("de 48 válidos");
  await expect(page.locator(".gx-fin-kpi").nth(2)).toContainText("4% dos pedidos");
  await expect(page.locator(".gx-fin-kpi.is-pending")).toContainText("3 pedido(s) em aberto");
  // Meio sem movimento não aparece; o de maior valor vem primeiro.
  await expect(page.locator(".gx-fin-pay-table .gx-fin-tr:not(.is-head)")).toHaveCount(3);
  await expect(page.locator(".gx-fin-pay-table .gx-fin-tr:not(.is-head)").first()).toContainText("Pix");
  await expect(page.locator(".gx-fin-badge")).toHaveText("Aguardando conferência");
  await expect(page.locator(".gx-fin-delivery")).toContainText("R$ 26,00");
  await page.screenshot({ path: path.join(outDir, "financeiro-escuro.png"), fullPage: true });

  // Conferência com falta no dinheiro: aparece o aviso e o campo do motivo.
  await page.locator('input[name="countedCash"]').fill("600,30");
  await page.locator(".gx-fin-primary").click();
  await expect(page.locator(".gx-fin-alert")).toContainText("Faltam R$ 12,00 no dinheiro");
  await expect(page.locator(".gx-fin-badge")).toHaveText("Conferido com diferença");
  await expect(page.locator(".gx-fin-close-table .gx-fin-tr.is-total")).toContainText("R$ 3.714,40");
  expect(saved.countedCash).toBeCloseTo(600.3, 2);
  await page.locator('textarea[name="notes"]').fill("Troco dado a mais");
  await page.locator(".gx-fin-primary").click();
  await expect(page.locator('textarea[name="notes"]')).toHaveValue("Troco dado a mais");
  expect(saved.notes).toBe("Troco dado a mais");

  // "ver pedidos" leva para Pedidos.
  await page.locator('[data-fin-goto="orders"]').click();
  await expect(page.locator("body")).toHaveAttribute("data-admin-section", "orders");
});

test("Financeiro: tema claro e celular sem rolagem lateral", async ({ page }) => {
  test.setTimeout(120_000);
  await fs.mkdir(outDir, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "light");
  await expect(page.locator(".gx-fin-big")).toHaveText("R$ 3.475,90");
  await page.screenshot({ path: path.join(outDir, "financeiro-claro.png"), fullPage: true });
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `largura ${width}`).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(outDir, "financeiro-celular.png"), fullPage: true });
});
