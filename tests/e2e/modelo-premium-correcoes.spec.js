const { test, expect } = require("@playwright/test");
const { loginMaster, loginTenantOwner, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");

// Modelo Premium, seção 3 da spec: nada de número fictício publicado como real,
// indicadores vindos do restaurante e candidatura que chega ao restaurante certo.
test("Modelo Premium: indicadores reais, avaliações sem nota fictícia e candidatura pelo WhatsApp do restaurante", async ({ browser }) => {
  test.setTimeout(150_000);
  const master = await loginMaster();
  const tenant = await onboardRestaurant(master.api, { key: uniqueKey("premium"), ownerPassword: "OwnerPremium123!" });
  await master.api.dispose();
  const owner = await loginTenantOwner(tenant);
  const saved = await owner.api.post("/api/admin/settings/save", {
    data: { settings: { restaurantName: `Casa ${tenant.key}`, whatsapp: "(16) 98888-7777", averagePreparationTimeMinutes: 35 } },
  });
  expect(saved.status()).toBe(200);
  await owner.api.dispose();

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // Home: sem avaliações -> "Novo"; tempo do Gestor; itens contados do cardápio.
  await page.goto(`/${tenant.key}`, { waitUntil: "networkidle" });
  const reviews = page.locator('[data-home-metric="reviews"]');
  await expect(reviews).toBeVisible();
  await expect(reviews).toContainText("Novo");
  await expect(reviews).toContainText("Ainda sem avaliações");
  await expect(page.locator('[data-home-metric="time"]')).toContainText("35 min");
  const items = page.locator("[data-home-item-count]");
  await expect(items).toHaveText(/^\d+$/);
  const metricsText = await page.locator(".hero-metrics").innerText();
  expect(metricsText).not.toContain("--");
  expect(metricsText).not.toContain("+40");
  expect(metricsText).not.toContain("25min");
  expect(await page.locator("body").innerText()).not.toContain("Hot Holl");

  // Avaliar: nenhuma nota inventada no HTML nem na tela.
  const avaliar = await page.request.get(`/${tenant.key}/avaliar.html`);
  expect(await avaliar.text()).not.toContain("4.2 de 5");
  await page.goto(`/${tenant.key}/avaliar.html`, { waitUntil: "networkidle" });
  await expect(page.locator("[data-review-average]")).toHaveText("Ainda sem avaliações");

  // Trabalhe Conosco: abre o WhatsApp do restaurante com a candidatura (não guarda só no aparelho).
  await page.addInitScript(() => {
    window.__opened = [];
    window.open = (url) => {
      window.__opened.push(String(url));
      return null;
    };
  });
  await page.goto(`/${tenant.key}/trabalhe-conosco.html`, { waitUntil: "networkidle" });
  const form = page.locator("[data-career-form]");
  await form.locator('[name="career_name"]').fill("Maria Candidata");
  await form.locator('[name="career_phone"]').fill("(16) 99111-2222");
  await form.locator('[name="career_email"]').fill("maria@example.com");
  await form.locator('[name="career_area"]').selectOption("Cozinha");
  await form.locator('[name="career_experience"]').selectOption("1 a 3 anos");
  await form.locator('[name="career_schedule"]').fill("Noite e fim de semana");
  await form.locator('[name="career_message"]').fill("Tenho experiência em cozinha.");
  await form.locator('button[type="submit"]').click();
  const opened = await page.evaluate(() => window.__opened);
  expect(opened).toHaveLength(1);
  const url = new URL(opened[0]);
  expect(url.hostname).toBe("wa.me");
  expect(url.pathname).toBe("/5516988887777");
  const text = url.searchParams.get("text");
  expect(text).toContain(`Casa ${tenant.key}`);
  expect(text).toContain("Maria Candidata");
  expect(text).toContain("Cozinha");
  await expect(page.locator("[data-career-feedback]")).toContainText("Abrimos o WhatsApp");

  // Sem WhatsApp configurado: avisa e não abre nada.
  await page.route("**/api/restaurant-settings", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.settings = { ...body.settings, whatsapp: "" };
    await route.fulfill({ response, json: body });
  });
  await page.goto(`/${tenant.key}/trabalhe-conosco.html`, { waitUntil: "networkidle" });
  await form.locator('[name="career_name"]').fill("Maria Candidata");
  await form.locator('[name="career_phone"]').fill("(16) 99111-2222");
  await form.locator('[name="career_email"]').fill("maria@example.com");
  await form.locator('[name="career_area"]').selectOption("Cozinha");
  await form.locator('[name="career_experience"]').selectOption("1 a 3 anos");
  await form.locator('[name="career_schedule"]').fill("Noite");
  await form.locator('[name="career_message"]').fill("Teste.");
  await form.locator('button[type="submit"]').click();
  expect(await page.evaluate(() => window.__opened)).toHaveLength(0);
  await expect(page.locator("[data-career-feedback]")).toContainText("ainda não configurou o WhatsApp");

  expect(errors).toEqual([]);
  await context.close();
});
