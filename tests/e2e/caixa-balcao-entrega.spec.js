const path = require("node:path");
const fs = require("node:fs/promises");
const { test, expect } = require("@playwright/test");
const { expectNoHorizontalOverflow, loginMaster, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");

// Caixa: "Lançar pedido" com Mesa, Retirada (balcão) e Entrega (telefone).
// No Gestor, cada pedido aparece com o tipo certo: Mesa 03, Retirada, Entrega.
test("Caixa lança pedido de mesa, retirada e entrega; Pedidos mostra o tipo certo", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("balcao"),
    name: "Restaurante Balcao",
    ownerPassword: "OwnerBalcao123!",
  });
  await master.api.dispose();
  const shots = path.join(process.cwd(), "artifacts", "novo-caixa", "balcao");
  await fs.mkdir(shots, { recursive: true });
  const root = page.locator(".cash-v3");

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `127.52.${Math.floor(Math.random() * 200)}.3` });
  await page.goto("/admin/login.html?next=%2Fadmin%2Fcaixa%2Fsalao");
  await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await expect(root.getByRole("heading", { name: "Abrir caixa" })).toBeVisible({ timeout: 20_000 });
  await root.getByRole("button", { name: /Abrir caixa com \d+ mesas/ }).click();
  await expect(root.locator("[data-cx-table]").first()).toBeVisible();

  // 1) Mesa 03 pelo "Lançar pedido" → Mesa.
  await root.locator('[data-cx-action="go-pdv"]').click();
  await expect(root.locator(".cx-launch")).toHaveCount(3);
  await page.screenshot({ path: path.join(shots, "1-escolha.png") });
  await root.locator('[data-cx-action="launch-table"]').click();
  const openDialog = root.locator('[data-cx-form="open-tab"]');
  await expect(openDialog).toBeVisible();
  await openDialog.locator('[data-cx-pick], [data-cx-set="openTab.tableId"]').nth(2).click();
  await openDialog.locator('[data-cx-set="openTab.guests"][data-cx-value="2"]').click();
  await openDialog.locator("[data-cx-confirm]").click();
  await expect(root.getByRole("heading", { name: /Lançar pedido · Mesa 03/ })).toBeVisible();
  await root.locator("[data-cx-product]").first().click();
  await page.keyboard.press("F2");
  await expect(root.locator(".cx-order-group", { hasText: "Já na cozinha" })).toBeVisible();
  await page.keyboard.press("Escape");

  // 2) Retirada no balcão: nome obrigatório, telefone opcional.
  await page.keyboard.press("F3");
  await root.locator('[data-cx-action="launch-pickup"]').click();
  await expect(root.getByRole("heading", { name: "Lançar pedido · Retirada no balcão" })).toBeVisible();
  await root.locator("[data-cx-product]").first().click();
  await root.locator("[data-cx-product]").nth(1).click();
  const send = root.locator('[data-cx-action="counter-send"]');
  await expect(send).toBeDisabled();
  await root.locator('[data-cx-field="counter.name"]').fill("Bruna Balcão");
  await expect(send).toBeEnabled();
  await root.locator('[data-cx-set="counter.payment"][data-cx-value="dinheiro"]').click();
  await root.locator('[data-cx-field="counter.cashFor"]').fill("100");
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(shots, "2-retirada.png") });
  await send.click();
  await expect(root.locator("[data-cx-table]").first()).toBeVisible();
  await expect(root).toContainText("retirada enviado");

  // 3) Entrega por telefone: exige telefone e endereço.
  await root.locator('[data-cx-action="go-pdv"]').click();
  await root.locator('[data-cx-action="launch-delivery"]').click();
  await expect(root.getByRole("heading", { name: "Lançar pedido · Entrega" })).toBeVisible();
  await root.locator("[data-cx-product]").first().click();
  await root.locator('[data-cx-field="counter.name"]').fill("Carlos Telefone");
  await expect(root.locator('[data-cx-action="counter-send"]')).toBeDisabled();
  await expect(root.locator(".cx-counter-hint")).toContainText("telefone");
  await root.locator('[data-cx-field="counter.phone"]').fill("(16) 99999-1234");
  await root.locator('[data-cx-field="counter.line"]').fill("Rua das Flores");
  await root.locator('[data-cx-field="counter.number"]').fill("115");
  await root.locator('[data-cx-field="counter.neighborhood"]').fill("Centro");
  await root.locator('[data-cx-field="counter.fee"]').fill("7");
  await expect(root.locator(".cx-totals")).toContainText("Taxa de entrega");
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(shots, "3-entrega.png") });
  await page.keyboard.press("F2");
  await expect(root).toContainText("entrega enviado");

  // Gestor > Pedidos: cada um com o tipo certo.
  await page.goto("/admin/?section=orders");
  await page.waitForSelector(".gx-ticket");
  const card = (name) => page.locator(".gx-ticket").filter({ hasText: name });
  const mesa = page.locator(".gx-ticket").filter({ has: page.locator(".gx-tag.is-dining") });
  await expect(mesa).toHaveCount(1);
  await expect(mesa.locator(".gx-tag")).toHaveText(/Mesa 0?3/);
  await expect(card("Bruna Balcão").locator(".gx-tag")).toHaveText("Retirada");
  await expect(card("Carlos Telefone").locator(".gx-tag")).toHaveText("Entrega");
  await expect(page.locator('[data-orders-mode="dining"]')).toContainText("Mesa · 1");

  // Detalhe da entrega: endereço e taxa; da mesa: sem taxa e com "Marcar como servido" no fim.
  await card("Carlos Telefone").locator(".gx-order-hit").click();
  const detail = page.locator("[data-admin-order-detail]");
  await detail.locator(".gx-od-data summary").click();
  await expect(detail.locator(".gx-od-data")).toContainText("Rua das Flores, 115 - Centro");
  await expect(detail.locator(".gx-od-sums")).toContainText("R$ 7,00");
  await mesa.locator(".gx-order-hit").click();
  await expect(detail.locator(".gx-od-pill.is-dining")).toHaveText(/Mesa 0?3/);
  await expect(detail.locator(".gx-od-sums")).not.toContainText("Taxa de entrega");
  await page.screenshot({ path: path.join(shots, "4-pedidos-tipos.png") });
  // Mesa: Aceitar → Iniciar preparo → Marcar como pronto → Marcar como servido (sem "Despachar").
  // O painel continua no mesmo pedido a cada etapa.
  const steps = ["Aceitar pedido", "Iniciar preparo", "Marcar como pronto", "Marcar como servido"];
  for (let index = 0; index < steps.length - 1; index += 1) {
    const button = detail.locator(".gx-od-primary");
    await expect(button).toHaveText(steps[index]);
    await expect(button).toBeEnabled();
    // Servidor local guarda sessão em arquivo: espera as chamadas anteriores terminarem.
    await page.waitForLoadState("networkidle");
    await button.click();
    await page.waitForLoadState("networkidle");
    await expect(detail.locator(".gx-od-primary")).toHaveText(steps[index + 1], { timeout: 15_000 });
    await expect(detail.locator(".gx-od-pill.is-dining")).toHaveText(/Mesa 0?3/);
  }
  await page.waitForLoadState("networkidle");
  await detail.locator(".gx-od-primary").click();
  await expect(detail.locator(".gx-od-steplabel")).toContainText("Servido");
  expect(errors).toEqual([]);
});
