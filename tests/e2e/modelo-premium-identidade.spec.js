const { test, expect } = require("@playwright/test");
const { loginMaster, loginTenantOwner, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");

// Modelo Premium: restaurante que não preencheu um dado não herda o do Tokyo
// (WhatsApp, endereço, logo, textos). E o Tokyo continua com os dele.
const TOKYO_WHATSAPP = "5516990507398";

test("Identidade: restaurante novo não herda WhatsApp, endereço nem textos do Tokyo", async ({ browser }) => {
  test.setTimeout(150_000);
  const master = await loginMaster();
  const tenant = await onboardRestaurant(master.api, { key: uniqueKey("ident"), name: "Pizzaria Identidade", ownerPassword: "OwnerIdent123!" });
  await master.api.dispose();

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(`/${tenant.key}`, { waitUntil: "networkidle" });
  const api = await (await page.request.get("/api/restaurant-settings")).json();
  expect(api.tenantContext.restaurantKey).toBe(tenant.key);
  const settings = api.settings;
  expect(settings.whatsapp || "").not.toBe(TOKYO_WHATSAPP);
  expect(JSON.stringify(settings).toLowerCase()).not.toContain("tokyo");
  expect(JSON.stringify(settings)).not.toContain("General Osorio");

  // Nenhum botão de WhatsApp visível leva para o número do Tokyo.
  const visibleTokyoLinks = await page.evaluate((number) =>
    [...document.querySelectorAll('a[href*="wa.me"]')].filter(
      (link) => link.href.includes(number) && link.offsetParent !== null
    ).length, TOKYO_WHATSAPP);
  expect(visibleTokyoLinks).toBe(0);

  // Sem WhatsApp configurado, a candidatura avisa (não manda para o Tokyo).
  if (!settings.whatsapp) {
    await page.addInitScript(() => {
      window.__opened = [];
      window.open = (url) => { window.__opened.push(String(url)); return null; };
    });
    await page.goto(`/${tenant.key}/trabalhe-conosco.html`, { waitUntil: "networkidle" });
    const form = page.locator("[data-career-form]");
    await form.locator('[name="career_name"]').fill("Maria");
    await form.locator('[name="career_phone"]').fill("(16) 99111-2222");
    await form.locator('[name="career_email"]').fill("maria@example.com");
    await form.locator('[name="career_area"]').selectOption("Cozinha");
    await form.locator('[name="career_experience"]').selectOption("1 a 3 anos");
    await form.locator('[name="career_schedule"]').fill("Noite");
    await form.locator('[name="career_message"]').fill("Teste.");
    await form.locator('button[type="submit"]').click();
    expect(await page.evaluate(() => window.__opened)).toHaveLength(0);
    await expect(page.locator("[data-career-feedback]")).toContainText("ainda não configurou o WhatsApp");
  }

  // Com WhatsApp configurado, os botões voltam e apontam para o número dele.
  const owner = await loginTenantOwner(tenant);
  const saved = await owner.api.post("/api/admin/settings/save", { data: { settings: { ...settings, whatsapp: "(16) 98888-7777" } } });
  expect(saved.status()).toBe(200);
  const savedSettings = (await saved.json()).settings;
  expect(JSON.stringify(savedSettings).toLowerCase()).not.toContain("tokyo");
  await owner.api.dispose();
  await page.goto(`/${tenant.key}`, { waitUntil: "networkidle" });
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('a[href*="wa.me"]')].filter((link) => link.offsetParent !== null).map((link) => link.href)
  );
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) expect(href).toContain("wa.me/5516988887777");

  expect(errors).toEqual([]);
  await context.close();
});

test("Identidade: o Tokyo continua com o WhatsApp e o endereço dele", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto("/tokyo.html", { waitUntil: "domcontentloaded" });
  const api = await (await page.request.get("/api/restaurant-settings")).json();
  expect(api.settings.whatsapp).toBe(TOKYO_WHATSAPP);
  expect(api.settings.restaurantName).toMatch(/Tokyo/);
  await expect
    .poll(() => page.evaluate(() => [...document.querySelectorAll('a[href*="wa.me"]')].filter((link) => link.offsetParent !== null).length))
    .toBeGreaterThan(0);
  await context.close();
});
