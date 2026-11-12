const path = require("node:path");
const { test, expect } = require("@playwright/test");

// Site do restaurante: acompanhar pedido (novo desenho, atualiza a cada 10 s).
const outDir = path.join(process.cwd(), "artifacts", "acompanhar");
const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();

const buildOrder = (status, fulfillmentMode = "pickup") => ({
  id: "order-acomp-1",
  publicId: "48213",
  status,
  fulfillmentMode,
  orderType: "immediate",
  createdAt: minutesAgo(9),
  updatedAt: minutesAgo(1),
  paymentMethod: "dinheiro",
  subtotal: 112.5,
  deliveryFee: fulfillmentMode === "pickup" ? 0 : 9,
  totalAmount: fulfillmentMode === "pickup" ? 112.5 : 121.5,
  addressFull: fulfillmentMode === "pickup" ? "" : "Rua das Flores, 115 - Centro",
  items: [
    { type: "product", name: "Combinado Tokyo 40 peças", quantity: 1, totalPrice: 89.9 },
    { type: "product", name: "Hot Roll Salmão", quantity: 2, totalPrice: 22.6 },
  ],
  statusHistory: [
    { status: "Em preparo", createdAt: minutesAgo(5) },
    { status: "Aceito", createdAt: minutesAgo(8) },
    { status: "Recebido", createdAt: minutesAgo(9) },
  ].filter((entry) => ["Recebido", "Aceito", "Em preparo", "Pronto"].indexOf(entry.status) <= ["Recebido", "Aceito", "Em preparo", "Pronto"].indexOf(status)),
});

const openTracking = async (page, state) => {
  await page.addInitScript(() => {
    localStorage.setItem("tokyo_sushi_profile", JSON.stringify({ name: "Ana Cliente", phone: "16999990000", email: "" }));
    localStorage.setItem("tokyo_customer_client_token", "teste-token-acompanhar");
  });
  await page.route("**/api/customer/orders/active**", (route) => {
    state.calls += 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true, hasActiveOrder: true, order: buildOrder(state.status, state.mode) }),
    });
  });
  await page.goto("/acompanhar.html");
  await expect(page.locator(".tk-track")).toBeVisible({ timeout: 15000 });
};

test("Acompanhar pedido: etapa, contador de 10 s, WhatsApp e resumo", async ({ page }) => {
  test.setTimeout(90_000);
  const state = { status: "Em preparo", mode: "pickup", calls: 0 };
  await page.setViewportSize({ width: 390, height: 844 });
  await openTracking(page, state);

  await expect(page.locator(".tk-track-code")).toHaveText("#48213");
  await expect(page.locator(".tk-track-hero h3")).toHaveText("Preparando com capricho");
  await expect(page.locator(".tk-track-badge")).toContainText(/em preparo/i);
  await expect(page.locator(".tk-track-step")).toHaveCount(5);
  await expect(page.locator(".tk-track-step.is-done")).toHaveCount(2);
  await expect(page.locator(".tk-track-step.is-current")).toContainText("Em preparo");
  await expect(page.locator(".tk-track-step").last()).toContainText("Retirado");
  await expect(page.locator(".tk-track-facts")).toContainText("Retirada na loja");
  await expect(page.locator(".tk-track-summary")).toContainText("Pagamento na retirada · Dinheiro");
  await page.screenshot({ path: path.join(outDir, "celular-tela.png") });
  await expect(page.locator(".tk-track-total")).toContainText("112,50");
  const whatsapp = await page.locator(".tk-track-btn.is-whatsapp").getAttribute("href");
  expect(whatsapp).toMatch(/^https:\/\/wa\.me\/\d+\?text=.*48213/);
  // A apresentação antiga some quando há pedido ativo.
  await expect(page.locator(".tracking-hero-section")).toBeHidden();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(outDir, "celular-em-preparo.png"), fullPage: true });

  // Contador regressivo e atualização sozinha em ~10 s.
  await expect(page.locator("[data-tracking-countdown]")).toHaveText(/Atualiza em \d+s/);
  const callsBefore = state.calls;
  state.status = "Pronto";
  await expect(page.locator(".tk-track-hero h3")).toHaveText("Pronto para retirar", { timeout: 13_000 });
  expect(state.calls).toBeGreaterThan(callsBefore);

  // "Atualizar agora" busca na hora.
  const callsNow = state.calls;
  await page.locator("[data-tracking-refresh]").click();
  await expect.poll(() => state.calls).toBeGreaterThan(callsNow);
});

test("Acompanhar pedido: entrega no computador e pedido concluído", async ({ page }) => {
  test.setTimeout(90_000);
  const state = { status: "Saiu para entrega", mode: "delivery", calls: 0 };
  await page.setViewportSize({ width: 1440, height: 900 });
  await openTracking(page, state);
  await expect(page.locator(".tk-track-hero h3")).toHaveText("A caminho");
  await expect(page.locator(".tk-track-step")).toHaveCount(6);
  await expect(page.locator(".tk-track-summary")).toContainText("Rua das Flores, 115 - Centro");
  await expect(page.locator(".tk-track-summary")).toContainText("Taxa de entrega");
  await page.screenshot({ path: path.join(outDir, "desktop-a-caminho.png"), fullPage: true });

  state.status = "Entregue";
  await page.locator("[data-tracking-refresh]").click();
  await expect(page.locator(".tk-track-hero h3")).toHaveText("Pedido entregue");
  await expect(page.locator("[data-tracking-countdown]")).toHaveCount(0);
  await expect(page.locator(".tk-track-foot")).toHaveText("Pedido encerrado.");
  await page.screenshot({ path: path.join(outDir, "desktop-entregue.png"), fullPage: true });
});
