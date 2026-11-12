// Tela Restaurantes do System: o Master cadastra restaurante com o site já no ar
// em /<slug>, suspende/reativa (Gestor e site), publica/tira o site do ar,
// edita dados de plataforma e vincula domínio próprio.
const { test, expect, request } = require("@playwright/test");

const login = process.env.E2E_ADMIN_LOGIN;
const password = process.env.E2E_ADMIN_PASSWORD;
const baseURL = process.env.BASE_URL || process.env.VALIDATION_BASE_URL || "http://127.0.0.1:3000";

const uniqueSlug = () => `teste-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const publicStatus = async (path) => {
  const api = await request.newContext({ baseURL });
  try {
    return (await api.get(path, { maxRedirects: 0 })).status();
  } finally {
    await api.dispose();
  }
};

test("Master cadastra, suspende, reativa e vincula domínio pela tela Restaurantes", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const slug = uniqueSlug();
  const name = `Pizzaria ${slug}`;

  await page.goto("/system/login.html");
  await page.getByLabel("E-mail").fill(login);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/system\/?$/);

  await page.goto("/system#restaurants");
  await page.getByRole("button", { name: "+ Novo restaurante" }).click();
  const form = page.locator("[data-restaurant-form=create]");
  await form.getByLabel("Nome do restaurante").fill(name);
  await expect(form.getByLabel("Endereço INOVAS")).toHaveValue(`pizzaria-${slug}`);
  await form.getByLabel("Endereço INOVAS").fill(slug);
  await form.getByLabel("CNPJ ou CPF (MEI)").fill(String(Date.now()).slice(-11).padStart(11, "1"));
  await form.getByLabel("Nome do responsável").fill("Responsável Teste");
  await form.getByLabel("E-mail do responsável (login do Gestor)").fill(`dono@${slug}.test`);
  await form.getByLabel("Senha inicial do responsável").fill("SenhaInicial123");
  await form.getByLabel("WhatsApp do restaurante").fill("16 99999-0000");
  await form.getByLabel("Rua").fill("Rua Teste");
  await form.getByLabel("Número").fill("100");
  await form.getByLabel("Cidade").fill("Franca");
  await form.getByLabel("Estado (UF)").fill("SP");
  await form.getByLabel("CEP").fill("14400-000");
  await form.getByRole("button", { name: "Cadastrar e publicar site" }).click();
  await expect(page.locator("[data-system-toast]")).toContainText(`inovasfood.com.br/${slug}`);

  // Link do restaurante no ar logo após o cadastro.
  expect(await publicStatus(`/${slug}`)).toBe(200);
  const detail = page.locator("[data-restaurant-detail]");
  await expect(detail.getByRole("heading", { name })).toBeVisible();
  await expect(detail).toContainText("No ar");

  // Suspender: exige motivo e confirmação; site sai do ar.
  await detail.getByRole("button", { name: "Suspender acesso" }).click();
  const suspend = page.locator("[data-restaurant-form=status]");
  await suspend.getByLabel("Motivo").fill("Teste automatizado de suspensão");
  await suspend.getByRole("checkbox").check();
  await suspend.getByRole("button", { name: "Suspender acesso" }).click();
  await expect(page.locator("[data-system-toast]")).toContainText("Restaurante suspenso");
  expect(await publicStatus(`/${slug}`)).toBe(404);
  await expect(detail.getByRole("button", { name: "Reativar acesso" })).toBeVisible();

  // Reativar.
  await detail.getByRole("button", { name: "Reativar acesso" }).click();
  const reactivate = page.locator("[data-restaurant-form=status]");
  await reactivate.getByLabel("Motivo").fill("Teste automatizado de reativação");
  await reactivate.getByRole("checkbox").check();
  await reactivate.getByRole("button", { name: "Reativar acesso" }).click();
  await expect(page.locator("[data-system-toast]")).toContainText("Restaurante reativado");
  expect(await publicStatus(`/${slug}`)).toBe(200);

  // Editar dados de plataforma.
  await detail.getByRole("button", { name: "Editar dados de plataforma" }).click();
  const edit = page.locator("[data-restaurant-form=edit]");
  await edit.getByLabel("Nome do restaurante").fill(`${name} Editada`);
  await edit.getByRole("button", { name: "Salvar" }).click();
  await expect(detail.getByRole("heading", { name: `${name} Editada` })).toBeVisible();

  // Domínio próprio: fica aguardando DNS até confirmar.
  await detail.getByRole("button", { name: "Vincular domínio próprio" }).click();
  const domain = page.locator("[data-restaurant-form=domain]");
  await domain.getByLabel("Domínio").fill(`www.${slug}.com.br`);
  await domain.getByRole("button", { name: "Salvar domínio" }).click();
  await expect(detail).toContainText(`${slug}.com.br`);
  await expect(detail).toContainText("Aguardando DNS");
  await detail.getByRole("button", { name: "Gerenciar domínio próprio" }).click();
  await page.locator("[data-restaurant-form=domain]").getByRole("button", { name: "Confirmar DNS" }).click();
  await expect(detail).toContainText("Ativo");

  // Auditoria registra as ações com o usuário do System.
  await page.goto("/system#audit");
  await expect(page.locator("body")).toContainText("Restaurante suspenso");
  await expect(page.locator("body")).toContainText("Restaurante reativado");

  expect(pageErrors).toEqual([]);
});

test("Suporte com acesso total: Gestor do restaurante como proprietário, gravado com o usuário do System", async ({ page }) => {
  const { loginMaster, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, { key: uniqueKey("suporte-total") });
  await master.api.dispose();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/system/login.html");
  await page.getByLabel("E-mail").fill(login);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/system\/?$/);

  await page.goto(`/system#support?key=${restaurant.key}`);
  await expect(page.locator("body")).toContainText("Acesso total ao restaurante");
  await expect(page.locator("[data-support-mode]")).toHaveCount(0);
  await page.locator("[data-support-field=restaurantKey]").selectOption(restaurant.key);
  await page.locator("[data-support-field=reason]").fill("Ajuste de cardápio pedido pelo dono por telefone.");
  await page.locator("[data-support-field=confirmed]").check();
  await page.getByRole("button", { name: "Entrar no restaurante — 60 min" }).click();
  await page.getByRole("link", { name: "Abrir restaurante em suporte" }).click();

  await expect(page.locator("[data-support-access-banner]")).toContainText("acesso total");
  await expect(page.locator("[data-support-access-banner]")).toContainText("gravado com o seu usuário");

  const session = await (await page.request.get("/api/admin/session")).json();
  expect(session.admin.support.mode).toBe("ADMIN");
  expect(session.admin.tenantContext?.restaurantKey || session.admin.restaurantKey).toBe(restaurant.key);

  const current = await (await page.request.get("/api/admin/settings/list")).json().catch(() => ({}));
  const save = await page.request.post("/api/admin/settings/save", {
    data: { settings: { ...(current.settings || {}), restaurantName: "Alterado pelo suporte" } },
  });
  expect(save.status(), await save.text()).toBe(200);
  const saved = await save.json();
  expect(saved.settings.updatedByLogin).toBe(String(login).toLowerCase());
  expect(saved.settings.restaurantName).toBe("Alterado pelo suporte");

  await page.goto("/system#audit");
  await expect(page.locator("body")).toContainText("Ação no restaurante em suporte");

  await page.request.post("/api/support/revoke", { data: {} });
  const afterRevoke = await page.request.post("/api/admin/settings/save", {
    data: { settings: { restaurantName: "Depois de encerrar" } },
  });
  expect(afterRevoke.status()).not.toBe(200);
  expect(pageErrors).toEqual([]);
});
