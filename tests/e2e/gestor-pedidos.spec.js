const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { loginMaster, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");
const { mockBusyOrders } = require("./helpers/orders-mock.cjs");

// Tela de Pedidos conforme o esboço "INOVAS · Tela de Pedidos", com a
// operação cheia simulada (pedidos em todas as etapas, alguns atrasados).
const outDir = path.join(process.cwd(), "artifacts", "novo-gestor", "pedidos");
fs.mkdirSync(outDir, { recursive: true });

const openOrders = async (page, theme = "light") => {
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("pedidos"),
    name: "Restaurante Pedidos",
    ownerPassword: "OwnerPedidos123!",
  });
  await master.api.dispose();
  await mockBusyOrders(page);
  // Cardápio do restaurante com foto para um dos produtos dos pedidos.
  await page.route("**/api/admin/catalog/list**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        summary: { totalSections: 1, totalItems: 1 },
        sections: [{ id: "rolls", name: "Rolls", items: [{ id: "hot-roll-salmao", name: "Hot Roll Salmão", image: "/assets/inovas-segments/sushi.jpg", price: 32.5 }] }],
      }),
    })
  );
  await page.addInitScript((value) => {
    try { localStorage.setItem("tokyo_admin_theme", value); } catch {}
  }, theme);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `127.33.${Math.floor(Math.random() * 200)}.9` });
  await page.goto("/admin/login.html?next=%2Fadmin%2F");
  await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForLoadState("networkidle");
  await page.locator('.admin-nav [data-admin-section="orders"]').first().click();
  await page.waitForSelector(".gx-ticket");
  await page.waitForTimeout(400);
};

test("Pedidos: grade, filtros, detalhes e ações como no esboço", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openOrders(page);
  await page.screenshot({ path: path.join(outDir, "pedidos-1440.png") });

  const tickets = page.locator(".gx-ticket");
  const total = await tickets.count();
  expect(total).toBeGreaterThan(15);
  // Cartão enxuto: sem lista de produtos, só valor e quantidade de itens.
  await expect(page.locator(".gx-ticket .gx-ticket-items")).toHaveCount(0);
  await expect(tickets.first().locator(".gx-ticket-total")).toHaveText(/^R\$\s?[0-9.]+,[0-9]{2}$/);

  // Do mais antigo para o mais novo: o primeiro é atrasado.
  await expect(tickets.first()).toHaveClass(/is-age-late/);
  await expect(page.locator(".gx-age-legend")).toContainText("+30 min");

  // Todos / Entrega / Retirada somam certo.
  const modeCount = async (key) =>
    Number((await page.locator(`[data-orders-mode="${key}"]`).innerText()).split("·")[1].trim());
  const all = await modeCount("all");
  expect(all).toBe(total);
  expect((await modeCount("delivery")) + (await modeCount("pickup"))).toBe(all);
  await page.locator('[data-orders-mode="pickup"]').click();
  await expect(tickets).toHaveCount(await modeCount("pickup"));
  await expect(page.locator(".gx-ticket .gx-tag.is-delivery")).toHaveCount(0);
  await page.locator('[data-orders-mode="all"]').click();

  // Etapa como filtro; clicar de novo volta para todas.
  const preparing = Number(await page.locator('[data-orders-stage="preparing"] strong').innerText());
  await page.locator('[data-orders-stage="preparing"]').click();
  await expect(tickets).toHaveCount(preparing);
  await expect(page.locator(".gx-ticket-status").first()).toHaveText(/em preparo/i);
  await page.locator('[data-orders-stage="preparing"]').click();
  await expect(tickets).toHaveCount(total);

  // Encerrados viraram filtros.
  await page.locator('[data-orders-stage="done"]').click();
  await expect(page.locator(".gx-grid-head h2")).toContainText("Finalizados");
  await page.locator('[data-orders-stage="done"]').click();

  // Detalhes fixos à direita (tela larga), com itens, valor, pagamento e etapa.
  await tickets.first().locator(".gx-order-hit").click();
  const detail = page.locator("[data-admin-detail-panel]");
  await expect(detail).toBeInViewport();
  await expect(detail.locator(".gx-od-head h2")).not.toBeEmpty();
  await expect(detail.locator(".gx-od-items li")).not.toHaveCount(0);
  await expect(detail.locator(".gx-od-totalbox")).toContainText("Total");
  await expect(detail.locator(".gx-od-sums")).toContainText("Subtotal");
  await expect(detail.locator(".gx-od-steplabel")).toContainText(/Etapa: .+[1-5] de 5/);
  await expect(detail.locator(".gx-od-pills")).toContainText("Feito às");
  // Dados do cliente recolhidos em "Ver dados", como no esboço.
  await expect(detail.locator(".gx-od-data dl")).toBeHidden();
  await detail.locator(".gx-od-data summary").click();
  await expect(detail.locator(".gx-od-data dl")).toBeVisible();
  // Foto do produto vinda do cardápio do restaurante.
  const withPhoto = page.locator(".gx-ticket").filter({ hasText: "Wagner Silva" }).first();
  await withPhoto.locator(".gx-order-hit").click();
  await expect(detail.locator("img.gx-od-photo")).toHaveCount(1);
  await expect(detail.locator("img.gx-od-photo")).toHaveJSProperty("complete", true);
  await page.screenshot({ path: path.join(outDir, "pedidos-detalhes.png") });

  // A ação principal avança a etapa.
  const received = Number(await page.locator('[data-orders-stage="received"] strong').innerText());
  await page.locator('[data-orders-stage="received"]').click();
  await tickets.first().locator(".gx-order-hit").click();
  await expect(detail.locator(".gx-od-primary")).toHaveText(/Aceitar pedido/);
  await detail.locator(".gx-od-primary").click();
  await expect(page.locator('[data-orders-stage="received"] strong')).toHaveText(String(received - 1));

  // Cancelar pede confirmação (recusada aqui: nada muda).
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.locator('[data-orders-stage="received"]').click();
  await page.locator('[data-orders-stage="accepted"]').click();
  await tickets.first().locator(".gx-order-hit").click();
  const accepted = Number(await page.locator('[data-orders-stage="accepted"] strong').innerText());
  await detail.locator(".gx-od-cancel").click();
  await expect(page.locator('[data-orders-stage="accepted"] strong')).toHaveText(String(accepted));
});

test("Pedidos: tela menor usa painel deslizante; celular sem rolagem lateral", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1024, height: 768 });
  await openOrders(page);
  await expect(page.locator("body")).not.toHaveClass(/gx-orders-drawer-open/);
  await page.locator(".gx-ticket .gx-order-hit").first().click();
  await expect(page.locator("body")).toHaveClass(/gx-orders-drawer-open/);
  await page.waitForTimeout(350);
  await expect(page.locator("[data-admin-detail-panel]")).toBeInViewport();
  await page.screenshot({ path: path.join(outDir, "pedidos-1024-detalhes.png") });
  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveClass(/gx-orders-drawer-open/);

  await page.setViewportSize({ width: 360, height: 740 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(outDir, "pedidos-360.png") });
});

test("Pedidos: cartões compactos, 4 ou mais por fileira em notebook e monitor", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await openOrders(page);
  const columnsAt = async (width) => {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(250);
    return page.evaluate(() => getComputedStyle(document.querySelector(".gx-grid")).gridTemplateColumns.split(" ").length);
  };
  const report = {};
  const overflowing = {};
  for (const width of [1280, 1366, 1440, 1600, 1920]) {
    report[width] = await columnsAt(width);
    // Nada dentro do cartão pode passar da borda (cronômetro, etapa, valor).
    overflowing[width] = await page.evaluate(() =>
      [...document.querySelectorAll(".gx-ticket")].filter((card) => {
        const box = card.getBoundingClientRect();
        return [...card.querySelectorAll(".gx-ticket-timer, .gx-ticket-status, .gx-ticket-total")].some(
          (node) => node.getBoundingClientRect().right > box.right + 1
        );
      }).length
    );
  }
  console.log("cartões com conteúdo vazando:", JSON.stringify(overflowing));
  expect(Object.values(overflowing).every((count) => count === 0)).toBe(true);
  console.log("cartões por fileira:", JSON.stringify(report));
  expect(report[1280]).toBeGreaterThanOrEqual(4);
  expect(report[1366]).toBeGreaterThanOrEqual(4);
  expect(report[1440]).toBeGreaterThanOrEqual(4);
  expect(report[1920]).toBeGreaterThanOrEqual(5);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outDir, "pedidos-compacto-1440.png") });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outDir, "pedidos-compacto-1920.png") });
});

test("Pedidos: tema escuro", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openOrders(page, "dark");
  await page.locator(".gx-ticket .gx-order-hit").nth(4).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, "pedidos-escuro.png") });
});
