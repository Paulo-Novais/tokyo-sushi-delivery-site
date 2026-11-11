const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

// Painel System redesenhado (novembro/2026): login neutro "Acesso à
// plataforma", Visão geral, Restaurantes, Suporte auditado, Auditoria,
// Usuários INOVAS e Perfis e menus, em desktop e a 390 px.

const artifactDirectory = path.join(process.cwd(), "artifacts", "system-panel-v1");
const login = process.env.E2E_ADMIN_LOGIN;
const password = process.env.E2E_ADMIN_PASSWORD;

fs.mkdirSync(artifactDirectory, { recursive: true });

// "Health Score" é o nome adotado pelo produto para o indicador; os demais
// rótulos da interface precisam estar em português.
const assertNoEnglishInterfaceLabels = async (page) => {
  const text = await page.locator("body").innerText();
  for (const label of [
    "Dashboard",
    "Support",
    "Integration",
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

const expectNoHorizontalOverflow = async (page) => {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth, "a página não pode rolar na horizontal").toBeLessThanOrEqual(
    overflow.clientWidth + 1
  );
};

test("Painel System redesenhado renderiza todas as áreas em português", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  // Login único, sem mencionar System ou restaurante.
  await page.goto("/system/login.html");
  await expect(page.getByRole("heading", { name: "Acesso à plataforma" })).toBeVisible();
  const loginText = await page.locator("body").innerText();
  expect(loginText).not.toMatch(/Painel System|Gestor|Acesso exclusivo/i);
  await assertNoEnglishInterfaceLabels(page);
  await page.screenshot({ path: path.join(artifactDirectory, "acesso-plataforma.png"), fullPage: true });

  // Erro de credencial não revela se o e-mail existe.
  await page.getByLabel("E-mail").fill("ninguem@example.com");
  await page.getByLabel("Senha").fill("senha-incorreta-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator("[data-system-login-feedback]")).toContainText("E-mail ou senha incorretos");
  // O 401 proposital acima gera "Failed to load resource" no console.
  consoleErrors.length = 0;

  await page.getByLabel("E-mail").fill(login);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/system\/?$/);

  // Visão geral
  await expect(page.getByRole("heading", { name: "Visão geral da INOVAS" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Precisa de atenção" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Health Score por restaurante" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fronteira System ativa" })).toBeVisible();
  await expect(page.getByText("Tokyo Sushi").first()).toBeVisible();
  await expect(page.locator(".sys-sidebar [aria-current='page']")).toHaveText(/Visão geral/);
  await expect(page.locator("body")).not.toContainText("Protótipo");
  await assertNoEnglishInterfaceLabels(page);
  await page.screenshot({ path: path.join(artifactDirectory, "visao-geral.png"), fullPage: true });

  // Restaurantes: lista + painel de detalhe
  await page.goto("/system#restaurants");
  await expect(page.getByRole("heading", { name: "Restaurantes", exact: true })).toBeVisible();
  await expect(page.getByText("clique em uma linha para ver os detalhes")).toBeVisible();
  const tokyoRow = page.locator("[data-restaurant-row]", { hasText: "Tokyo Sushi" });
  await expect(tokyoRow).toBeVisible();
  await tokyoRow.click();
  await expect(page.locator("[data-restaurant-detail]")).toContainText("Restaurante selecionado");
  await expect(page.locator("[data-restaurant-detail]")).toContainText("Tokyo Sushi");
  await expect(page.locator("[data-restaurant-detail]")).toContainText("Integrações e rotinas");
  await page.getByPlaceholder("Buscar por nome ou identificador").fill("kasulo-rocha");
  await expect(page.locator("[data-restaurant-row]")).toHaveCount(1);
  await expect(page.locator("[data-restaurant-row]").first()).toContainText("Kasulo");
  await assertNoEnglishInterfaceLabels(page);
  await page.screenshot({ path: path.join(artifactDirectory, "restaurantes.png"), fullPage: true });

  // Suporte auditado: botão só habilita com motivo >= 10 e confirmação
  await page.goto("/system#support");
  await expect(page.getByRole("heading", { name: "Suporte auditado" })).toBeVisible();
  const submit = page.locator("[data-support-submit]");
  await expect(submit).toBeDisabled();
  await page.locator("[data-support-field='reason']").fill("curto");
  await page.locator("[data-support-field='confirmed']").check();
  await expect(submit).toBeDisabled();
  await expect(page.locator("[data-support-counter]")).toHaveText("5 de 10 caracteres no mínimo");
  await page.locator("[data-support-field='reason']").fill("Verificar falha na integração do WhatsApp");
  await expect(submit).toBeEnabled();
  await expect(submit).toHaveText("Iniciar sessão — 30 min");
  await page.locator("[data-support-mode='ADMIN']").click();
  await expect(submit).toHaveText("Iniciar sessão — 15 min");
  await expect(page.locator("[data-support-admin-warning]")).toBeVisible();
  await assertNoEnglishInterfaceLabels(page);
  await page.screenshot({ path: path.join(artifactDirectory, "suporte.png"), fullPage: true });

  // Auditoria: somente leitura, com detalhe do evento destacado
  await page.goto("/system#audit");
  await expect(page.getByRole("heading", { name: "Auditoria e sessões de suporte" })).toBeVisible();
  await expect(page.locator("body")).toContainText("não podem ser editados nem apagados");
  await expect(page.getByRole("heading", { name: "Sessões de suporte em andamento" })).toBeVisible();
  await page.locator("[data-audit-filter='period']").selectOption("all");
  const firstAuditRow = page.locator("[data-audit-row]").first();
  if (await firstAuditRow.count()) {
    await firstAuditRow.click();
    await expect(page.locator("[data-audit-detail]")).toContainText("Detalhe do evento destacado");
    await expect(page.locator("[data-audit-detail]")).toContainText("Request ID");
  }
  await assertNoEnglishInterfaceLabels(page);
  await page.screenshot({ path: path.join(artifactDirectory, "auditoria.png"), fullPage: true });

  // Rotas antigas são absorvidas (Saúde -> Visão geral; Integrações -> Restaurantes)
  await page.goto("/system#health");
  await expect(page.getByRole("heading", { name: "Visão geral da INOVAS" })).toBeVisible();
  await page.goto("/system#integrations");
  await expect(page.getByRole("heading", { name: "Restaurantes", exact: true })).toBeVisible();

  // Usuários INOVAS com o shell novo
  await page.goto("/system/users");
  await expect(page.getByRole("heading", { name: "Usuários INOVAS" })).toBeVisible();
  await expect(page.locator(".sys-sidebar [aria-current='page']")).toHaveText(/Usuários INOVAS/);
  await assertNoEnglishInterfaceLabels(page);
  await page.screenshot({ path: path.join(artifactDirectory, "usuarios-inovas.png"), fullPage: true });

  // Perfis e permissões: cartões, matriz real e editor
  await page.goto("/system/roles");
  await expect(page.getByRole("heading", { name: "Perfis e permissões" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Matriz de permissões" })).toBeVisible();
  await expect(page.locator(".sys-perm-table")).toContainText("system.restaurants.suspend");
  await expect(page.locator(".sys-rules")).toContainText("Regras fixas");
  await page.screenshot({ path: path.join(artifactDirectory, "perfis-equipe.png"), fullPage: true });
  await page.getByRole("tab", { name: "Usuários de restaurante" }).click();
  await expect(page.getByRole("heading", { name: "Menus visíveis no restaurante" })).toBeVisible();
  await expect(page.locator(".roles-navigation-grid input[type='checkbox']")).toHaveCount(25);
  await assertNoEnglishInterfaceLabels(page);
  await page.screenshot({ path: path.join(artifactDirectory, "perfis-e-menus.png"), fullPage: true });

  // Celular (390 px): barra superior, menu lateral e navegação inferior
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/system");
  await expect(page.getByRole("heading", { name: "Visão geral da INOVAS" })).toBeVisible();
  await expect(page.locator(".sys-bottomnav")).toBeVisible();
  await expect(page.locator(".sys-bottomnav a[aria-current='page']")).toHaveText(/Início/);
  await expectNoHorizontalOverflow(page);
  await page.locator("[data-sys-menu-toggle]").click();
  await expect(page.locator(".sys-shell")).toHaveClass(/is-menu-open/);
  await expect(page.locator(".sys-sidebar")).toBeVisible();
  await page.locator("[data-sys-menu-close]").click();
  await expect(page.locator(".sys-shell")).not.toHaveClass(/is-menu-open/);
  await page.screenshot({ path: path.join(artifactDirectory, "visao-geral-mobile.png"), fullPage: true });

  await page.goto("/system#restaurants");
  await expect(page.getByRole("heading", { name: "Restaurantes", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.goto("/system/roles");
  await expect(page.getByRole("heading", { name: "Perfis e permissões" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.goto("/system/users");
  await expect(page.getByRole("heading", { name: "Usuários INOVAS" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(artifactDirectory, "usuarios-inovas-mobile.png"), fullPage: true });
  await page.goto("/system#audit");
  await expect(page.getByRole("heading", { name: "Auditoria e sessões de suporte" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(artifactDirectory, "perfis-e-menus-mobile.png"), fullPage: true });

  expect(consoleErrors, consoleErrors.join(" | ")).toEqual([]);
});

test("perfil sem permissão não vê o item do menu e recebe 403 na API", async ({ browser }) => {
  const master = await browser.newContext();
  const masterApi = master.request;
  const masterLogin = await masterApi.post("/api/admin/login", {
    data: { identifier: login, password },
  });
  expect(masterLogin.status()).toBe(200);

  const suffix = Date.now().toString(36);
  const email = `comercial.${suffix}@inovas.local`;
  const created = await masterApi.post("/api/system/users", {
    data: {
      name: `Comercial ${suffix}`,
      email,
      role: "COMERCIAL",
      credentialMode: "TEMPORARY_PASSWORD",
    },
  });
  expect([200, 201]).toContain(created.status());
  const createdBody = await created.json();
  const userPassword = createdBody?.data?.access?.temporaryPassword;
  expect(userPassword, "senha temporária do usuário COMERCIAL").toBeTruthy();
  await master.close();

  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  try {
    const sellerLogin = await page.request.post("/api/auth/system/login", {
      data: { identifier: email, password: userPassword },
    });
    expect(sellerLogin.status()).toBe(200);

    // COMERCIAL não tem system.audit.view nem system.users.view.
    const audit = await page.request.get("/api/system/audit");
    expect(audit.status()).toBe(403);
    const users = await page.request.get("/api/system/users");
    expect(users.status()).toBe(403);

    await page.goto("/system");
    await expect(page.getByRole("heading", { name: "Visão geral da INOVAS" })).toBeVisible();
    await expect(page.locator(".sys-sidebar")).not.toContainText("Auditoria");
    await expect(page.locator(".sys-sidebar")).not.toContainText("Usuários INOVAS");
    await expect(page.locator(".sys-sidebar")).toContainText("Restaurantes");

    await page.goto("/system#audit");
    // Rota sem permissão volta para a primeira área permitida.
    await expect(page.getByRole("heading", { name: "Visão geral da INOVAS" })).toBeVisible();
  } finally {
    await context.close();
  }
});
