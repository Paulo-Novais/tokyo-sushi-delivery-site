const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const artifactDirectory = path.join(process.cwd(), "artifacts", "system-panel-v1");
const login = process.env.E2E_ADMIN_LOGIN;
const password = process.env.E2E_ADMIN_PASSWORD;

fs.mkdirSync(artifactDirectory, { recursive: true });

const assertNoEnglishInterfaceLabels = async (page) => {
  const text = await page.locator("body").innerText();
  for (const label of [
    "Dashboard",
    "Support",
    "Integration",
    "Health",
    "Users",
    "Roles",
    "Restaurant",
    "Settings",
    "Logout",
    "HEALTHY",
    "DEGRADED",
    "OFFLINE",
  ]) {
    expect(text, `rótulo em inglês encontrado: ${label}`).not.toMatch(
      new RegExp(`(^|\\s)${label}(?=\\s|$|[.:,;])`, "m")
    );
  }
};

test("Painel System V1 renders every administrative area in Portuguese", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("/system/login.html");
  await expect(page.getByRole("heading", { name: "Acesso exclusivo ao Painel System" })).toBeVisible();
  await assertNoEnglishInterfaceLabels(page);
  await page.getByLabel("E-mail corporativo").fill(login);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar no Painel System" }).click();
  await expect(page).toHaveURL(/\/system\/?$/);

  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
  await expect(page.getByText("Atividade recente", { exact: true })).toBeVisible();
  await assertNoEnglishInterfaceLabels(page);
  await page.screenshot({
    path: path.join(artifactDirectory, "visao-geral.png"),
    fullPage: true,
  });

  await page.goto("/system#restaurants");
  await expect(page.getByRole("heading", { name: "Restaurantes", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tokyo Sushi" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kasulo Rocha Pizzaria" })).toBeVisible();
  await expect(page.getByText("Proprietário", { exact: true }).first()).toBeVisible();
  await assertNoEnglishInterfaceLabels(page);
  await page.screenshot({
    path: path.join(artifactDirectory, "restaurantes.png"),
    fullPage: true,
  });

  await page.goto("/system#health");
  await expect(page.getByRole("heading", { name: "Saúde", exact: true })).toBeVisible();
  for (const component of [
    "API",
    "Banco",
    "Armazenamento",
    "Autenticação",
    "Sessões",
    "Cache",
    "Integrações",
  ]) {
    await expect(page.getByText(component, { exact: true }).first()).toBeVisible();
  }
  await assertNoEnglishInterfaceLabels(page);

  await page.goto("/system#integrations");
  await expect(page.getByRole("heading", { name: "Integrações", exact: true })).toBeVisible();
  for (const integration of [
    "Google Maps",
    "WhatsApp",
    "PIX",
    "Impressoras",
    "E-mail",
    "Notificações push",
    "Webhook",
  ]) {
    await expect(page.getByRole("heading", { name: integration, exact: true })).toBeVisible();
  }
  await assertNoEnglishInterfaceLabels(page);

  for (const route of [
    ["audit", "Auditoria"],
    ["support", "Suporte"],
    ["settings", "Configurações"],
  ]) {
    await page.goto(`/system#${route[0]}`);
    await expect(page.getByRole("heading", { name: route[1], exact: true })).toBeVisible();
    await assertNoEnglishInterfaceLabels(page);
  }

  await page.goto("/system/users");
  await expect(page.getByRole("heading", { name: "Usuários INOVAS" })).toBeVisible();
  await assertNoEnglishInterfaceLabels(page);

  await page.goto("/system/roles");
  await expect(page.getByRole("heading", { name: "Perfis e permissões" })).toBeVisible();
  await page.getByRole("button", { name: "Usuários de restaurante" }).click();
  await expect(page.getByRole("heading", { name: "Menus visíveis no restaurante" })).toBeVisible();
  await expect(page.locator(".roles-navigation-grid input[type='checkbox']")).toHaveCount(25);
  await assertNoEnglishInterfaceLabels(page);
  await page.screenshot({
    path: path.join(artifactDirectory, "perfis-e-menus.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Menus visíveis no restaurante" })).toBeVisible();
  await page.screenshot({
    path: path.join(artifactDirectory, "perfis-e-menus-mobile.png"),
    fullPage: true,
  });

  expect(consoleErrors).toEqual([]);
});
