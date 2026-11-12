const path = require("node:path");
const fs = require("node:fs/promises");
const { test, expect } = require("@playwright/test");
const { loginMaster, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");

// Tela "Acesso à plataforma" (esboço Nova Home): um login só para restaurante e equipe INOVAS.
const outDir = path.join(process.cwd(), "artifacts", "acesso-plataforma");
const masterLogin = process.env.E2E_ADMIN_LOGIN;
const masterPassword = process.env.E2E_ADMIN_PASSWORD;

const openLogin = async (page) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `127.91.${Math.floor(Math.random() * 200)}.7` });
  await page.goto("/admin/login.html?next=%2Fadmin%2F");
  await expect(page.getByRole("heading", { name: "Bem-vindo de volta" })).toBeVisible();
};

test("Login: visual, mostrar senha, ajuda e erro sem revelar o e-mail", async ({ page }) => {
  await fs.mkdir(outDir, { recursive: true });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 960 });
  await openLogin(page);
  await expect(page.locator('input[name="identifier"]')).toHaveAttribute("placeholder", "voce@seurestaurante.com.br");
  await expect(page.locator(".lg-mock-note")).toHaveText("Simulação · dados ilustrativos");
  // Seleção de restaurante e aviso só aparecem quando há algo para mostrar.
  await expect(page.locator("[data-restaurant-selection]")).toBeHidden();
  await expect(page.locator("[data-admin-login-feedback]")).toBeHidden();
  await expect(page.getByRole("link", { name: "Voltar para o site", exact: true })).toHaveAttribute("href", "/");
  await page.screenshot({ path: path.join(outDir, "login-desktop.png"), fullPage: true });

  // Olho mostra e esconde a senha.
  const password = page.locator('input[name="password"]');
  await password.fill("abc123");
  await page.locator("[data-login-eye]").click();
  await expect(password).toHaveAttribute("type", "text");
  await page.locator("[data-login-eye]").click();
  await expect(password).toHaveAttribute("type", "password");

  // "Esqueci minha senha" explica como redefinir (não promete e-mail automático).
  await page.locator("[data-login-forgot]").click();
  await expect(page.locator("#lg-forgot")).toBeVisible();
  await expect(page.locator("#lg-forgot")).toContainText("redefinir a senha");

  // Campos vazios.
  await password.fill("");
  await page.locator("[data-admin-login-submit]").click();
  await expect(page.locator("[data-admin-login-feedback]")).toContainText("Preencha login e senha");

  // Senha errada: mensagem genérica e o botão volta com o rótulo e a seta.
  await page.locator('input[name="identifier"]').fill("ninguem@example.com");
  await password.fill("senha-incorreta-123");
  await page.locator("[data-admin-login-submit]").click();
  await expect(page.locator("[data-admin-login-feedback]")).toBeVisible();
  await expect(page.locator("[data-admin-login-submit]")).toHaveText("Entrar");
  await expect(page.locator("[data-admin-login-submit] svg")).toHaveCount(1);
  await expect(page).toHaveURL(/\/admin\/login\.html/);
  expect(errors).toEqual([]);
});

test("Login: dono vai para o Gestor e equipe INOVAS vai para o System", async ({ browser }) => {
  test.setTimeout(120_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, { key: uniqueKey("lgn"), name: "Restaurante Login", ownerPassword: "OwnerLogin123!" });
  await master.api.dispose();

  const owner = await browser.newContext();
  const ownerPage = await owner.newPage();
  await openLogin(ownerPage);
  await ownerPage.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await ownerPage.locator('input[name="password"]').fill(restaurant.ownerPassword);
  await ownerPage.locator("[data-admin-login-submit]").click();
  await expect(ownerPage).toHaveURL(/\/admin\/(index\.html)?(\?.*)?$/);
  await owner.close();

  const staff = await browser.newContext();
  const staffPage = await staff.newPage();
  await openLogin(staffPage);
  await staffPage.locator('input[name="identifier"]').fill(masterLogin);
  await staffPage.locator('input[name="password"]').fill(masterPassword);
  await staffPage.locator("[data-admin-login-submit]").click();
  await expect(staffPage).toHaveURL(/\/system\/?$/);
  await staff.close();
});

test("Login: celular sem rolagem lateral", async ({ page }) => {
  await fs.mkdir(outDir, { recursive: true });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await openLogin(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${width}px`).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await openLogin(page);
  await page.screenshot({ path: path.join(outDir, "login-celular.png"), fullPage: true });
});
