const { test, expect } = require("@playwright/test");
const { loginMaster, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");
const { mockBusyOrders } = require("./helpers/orders-mock.cjs");

// Alertas sonoros do Gestor: novo pedido (com aviso e repetição até aceitar),
// pedido passando de 30 min e preferências salvas no computador.
test("Alertas de som: novo pedido, atrasado e preferências", async ({ page }) => {
  test.setTimeout(120_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("som"),
    name: "Restaurante Som",
    ownerPassword: "OwnerSom123!",
  });
  await master.api.dispose();

  // Conta cada nota tocada (sem precisar ouvir).
  await page.addInitScript(() => {
    window.__tones = [];
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args) {
      window.__tones.push(Math.round(this.frequency.value));
      return start.apply(this, args);
    };
  });
  const orders = await mockBusyOrders(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `127.44.${Math.floor(Math.random() * 200)}.7` });
  await page.goto("/admin/login.html?next=%2Fadmin%2F");
  await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForLoadState("networkidle");

  // Antes do primeiro clique o navegador bloqueia som: aparece o aviso para liberar.
  await expect(page.locator("[data-order-alert-unlock]")).toBeVisible();
  await page.locator('.admin-nav [data-admin-section="orders"]').first().click();
  await page.waitForSelector(".gx-ticket");
  await expect(page.locator("[data-order-alert-unlock]")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__tones.length)).toBe(0);

  // Título da aba mostra quantos pedidos esperam aceite.
  await expect(page).toHaveTitle(/^\(\d+\) Novos pedidos/);

  // Testar som pelo painel "Sons".
  await page.locator("[data-order-alert-panel]").click();
  await expect(page.locator(".gx-sound-panel")).toBeVisible();
  await page.locator('[data-order-alert-test="newOrder"]').click();
  await expect.poll(() => page.evaluate(() => window.__tones.length)).toBeGreaterThan(0);
  await page.locator("[data-order-alert-panel]").click();

  // Chega um pedido novo: toca a campainha e mostra o aviso com "Ver pedido".
  const base = orders.find((order) => order.status === "Recebido");
  orders.unshift({ ...base, id: "order-novo-som", publicId: "TKY-9999", customerName: "Cliente Novo Som", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await page.evaluate(() => (window.__tones = []));
  await page.evaluate(() => loadActiveAdminSection({ preserveSelection: true }));
  await expect(page.locator(".gx-alert-toast.is-newOrder")).toContainText("Cliente Novo Som");
  await expect.poll(() => page.evaluate(() => window.__tones.slice(0, 3))).toEqual([880, 1175, 1568]);
  await page.screenshot({ path: "artifacts/novo-gestor/pedidos/alerta-novo-pedido.png" });
  await page.locator(".gx-alert-toast.is-newOrder [data-order-alert-open]").click();
  await expect(page.locator("[data-admin-order-detail] .gx-od-head h2")).toHaveText("Cliente Novo Som");

  // Um pedido passa de 30 min: toca o alerta de atrasado (sem repetir a campainha no mesmo ciclo).
  const warn = orders.find((order) => {
    const minutes = (Date.now() - new Date(order.createdAt).getTime()) / 60000;
    return !["Entregue", "Retirada concluida", "Cancelado"].includes(order.status) && order.timingMode !== "scheduled" && minutes >= 20 && minutes < 30;
  });
  expect(warn, "o simulador deveria ter um pedido entre 20 e 30 min").toBeTruthy();
  warn.createdAt = new Date(Date.now() - 31 * 60000).toISOString();
  await page.evaluate(() => (window.__tones = []));
  await page.evaluate(() => loadActiveAdminSection({ preserveSelection: true }));
  await expect(page.locator(".gx-alert-toast.is-late")).toContainText("passou de 30 min");
  await expect.poll(() => page.evaluate(() => window.__tones.slice(0, 3))).toEqual([523, 523, 392]);

  // Desligar os alertas: nada mais toca e a escolha fica salva.
  await page.locator("[data-order-alert-panel]").click();
  await page.locator('[data-order-alert-pref="enabled"]').uncheck();
  await page.evaluate(() => (window.__tones = []));
  orders.unshift({ ...base, id: "order-novo-som-2", customerName: "Outro Cliente", createdAt: new Date().toISOString() });
  await page.evaluate(() => loadActiveAdminSection({ preserveSelection: true }));
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__tones.length)).toBe(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("inovas_order_alerts_v1")).enabled)).toBe(false);
  await expect(page.locator("[data-order-alert-panel]")).toContainText("Sons");
});
