const { test, expect } = require("@playwright/test");
const { loginMaster, loginTenantOwner, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");

// Modelo Premium (seção 3 da spec): Trabalhe Conosco entrega a candidatura ao restaurante
// certo (antes ficava só no aparelho do candidato), sem nota/nomes errados do Tokyo.
const stubWindowOpen = async (page) => {
  await page.addInitScript(() => {
    window.__opened = [];
    window.open = (url) => {
      window.__opened.push(String(url));
      return null;
    };
  });
};

const fillCareer = async (page) => {
  const form = page.locator("[data-career-form]");
  await form.locator('[name="career_name"]').fill("Maria Candidata");
  await form.locator('[name="career_phone"]').fill("(16) 99111-2222");
  await form.locator('[name="career_email"]').fill("maria@example.com");
  await form.locator('[name="career_area"]').selectOption("Cozinha");
  await form.locator('[name="career_experience"]').selectOption("1 a 3 anos");
  await form.locator('[name="career_schedule"]').fill("Noite e fim de semana");
  await form.locator('[name="career_message"]').fill("Tenho experiência em cozinha.");
  await form.locator('button[type="submit"]').click();
};

test("Candidatura vai para o WhatsApp do restaurante (com 55) ou avisa quando não há WhatsApp", async ({ browser }) => {
  test.setTimeout(150_000);
  const master = await loginMaster();
  const withPhone = await onboardRestaurant(master.api, { key: uniqueKey("vaga"), name: "Pizzaria Vagas", ownerPassword: "OwnerVaga123!" });
  const noPhone = await onboardRestaurant(master.api, { key: uniqueKey("vagasem"), name: "Pizzaria Sem Zap", ownerPassword: "OwnerVagaSem123!" });
  await master.api.dispose();
  const owner = await loginTenantOwner(withPhone);
  // Número salvo sem o 55: o link precisa ganhar o código do país.
  expect((await owner.api.post("/api/admin/settings/save", { data: { settings: { restaurantName: "Pizzaria Vagas", whatsapp: "(16) 98888-7777" } } })).status()).toBe(200);
  await owner.api.dispose();

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await stubWindowOpen(page);

  await page.goto(`/${withPhone.key}/trabalhe-conosco`, { waitUntil: "networkidle" });
  await expect(page.locator('button[type="submit"]', { hasText: "Enviar pelo WhatsApp" })).toBeVisible();
  await fillCareer(page);
  const opened = await page.evaluate(() => window.__opened);
  expect(opened).toHaveLength(1);
  const url = new URL(opened[0]);
  expect(url.hostname).toBe("wa.me");
  expect(url.pathname).toBe("/5516988887777");
  const text = url.searchParams.get("text");
  expect(text).toContain("Pizzaria Vagas");
  expect(text).toContain("Maria Candidata");
  expect(text).toContain("Cozinha");
  await expect(page.locator("[data-career-feedback]")).toContainText("Abrimos o WhatsApp");
  // Nada da candidatura fica guardado como "enviado" no aparelho.
  expect(await page.evaluate(() => Object.keys(localStorage).some((key) => /career/.test(key)))).toBe(false);

  // Restaurante sem WhatsApp (o cadastro de teste já traz um telefone; aqui ele vem vazio):
  // avisa e não abre nada — nunca o número do Tokyo.
  await page.route("**/api/restaurant-settings", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.settings = { ...body.settings, whatsapp: "" };
    await route.fulfill({ response, json: body });
  });
  await page.goto(`/${noPhone.key}/trabalhe-conosco`, { waitUntil: "networkidle" });
  await fillCareer(page);
  expect(await page.evaluate(() => window.__opened)).toHaveLength(0);
  await expect(page.locator("[data-career-feedback]")).toContainText("ainda não configurou o WhatsApp");

  expect(errors).toEqual([]);
  await context.close();
});

test("Tokyo: candidatura vai para o WhatsApp do Tokyo e o cardápio diz Hot Roll", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await stubWindowOpen(page);
  await page.goto("/trabalhe-conosco.html", { waitUntil: "networkidle" });
  await fillCareer(page);
  const opened = await page.evaluate(() => window.__opened);
  expect(opened).toHaveLength(1);
  expect(new URL(opened[0]).pathname).toBe("/5516990507398");

  await page.goto("/tokyo.html", { waitUntil: "domcontentloaded" });
  const html = await (await page.request.get("/tokyo.html")).text();
  expect(html).not.toContain("Hot Holl");
  await context.close();
});
