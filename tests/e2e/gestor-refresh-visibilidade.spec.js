const { test, expect } = require("@playwright/test");
const { loginMaster, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");

// Gestor escondido (aba em segundo plano, janela minimizada ou outro módulo
// aberto no app): a recarga completa da tela pausa, mas a busca do aviso de
// pedido novo continua. Ao voltar, a tela recarrega na hora.

const setHidden = (page, hidden) =>
  page.evaluate((value) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => value });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (value ? "hidden" : "visible"),
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);

test("Gestor: recarga pausa com a tela escondida e o aviso de pedido continua", async ({ page }) => {
  test.setTimeout(180_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("refresh"),
    name: "Restaurante Refresh",
    ownerPassword: "OwnerRefresh123!",
  });

  await page.clock.install();
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `127.66.${Math.floor(Math.random() * 200)}.3` });
  await page.goto("/admin/login.html?next=%2Fadmin%2F");
  await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForLoadState("networkidle");
  await page.goto("/admin/?section=dashboard");
  await page.waitForLoadState("networkidle");

  const calls = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) calls.push(`${url.pathname}${url.search}`);
  });
  const count = (predicate) => calls.filter(predicate).length;
  // Avança o relógio aos poucos: as chamadas de rede são reais e precisam
  // terminar antes do próximo ciclo (o aviso não sobrepõe buscas).
  const advance = async (totalMs) => {
    for (let elapsed = 0; elapsed < totalMs; elapsed += 5_000) {
      await page.clock.runFor(5_000);
      await page.waitForTimeout(400);
    }
  };
  const isAlertCheck = (call) => call.startsWith("/api/admin/orders/list?limit=80");
  // Qualquer outra chamada de dados é a recarga da tela (a seção aberta decide quais).
  const isSectionRefresh = (call) =>
    !isAlertCheck(call) && !call.startsWith("/api/admin/session") && !call.startsWith("/api/admin/presence");

  // Visível: a recarga da tela acontece a cada 20 s.
  await advance(45_000);
  await expect.poll(() => count(isSectionRefresh)).toBeGreaterThan(0);

  // Escondido: nenhuma recarga da tela, mas o aviso de pedido continua buscando.
  calls.length = 0;
  await setHidden(page, true);
  await advance(60_000);
  expect(count(isSectionRefresh)).toBe(0);
  expect(count(isAlertCheck)).toBeGreaterThanOrEqual(3);

  // Voltou a ficar visível: recarrega na hora.
  calls.length = 0;
  await setHidden(page, false);
  await expect.poll(() => count(isSectionRefresh)).toBeGreaterThan(0);
});
