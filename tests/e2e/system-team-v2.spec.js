const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

// Equipe INOVAS conforme o "Esboço Painel System INOVAS v2": Usuários INOVAS
// (indicadores, tabela e convite), Perfis e permissões (cartões que destacam
// a coluna da matriz) e Auditoria (sessões em andamento, filtros e CSV).
// A logo do canto superior esquerdo continua sendo a da INOVAS.

const artifactDirectory = path.join(process.cwd(), "artifacts", "system-panel-v2");
const login = process.env.E2E_ADMIN_LOGIN;
const password = process.env.E2E_ADMIN_PASSWORD;

fs.mkdirSync(artifactDirectory, { recursive: true });

const expectNoHorizontalOverflow = async (page) => {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
};

test("Equipe INOVAS: convite, perfis e auditoria do esboço v2", async ({ page }) => {
  test.setTimeout(120_000);
  const consoleErrors = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.setViewportSize({ width: 1366, height: 900 });

  const signIn = await page.request.post("/api/admin/login", {
    data: { identifier: login, password },
  });
  expect(signIn.status()).toBe(200);

  // Usuários INOVAS
  await page.goto("/system/users");
  await expect(page.getByRole("heading", { name: "Usuários INOVAS" })).toBeVisible();
  await expect(page.locator(".sys-brand img")).toHaveAttribute("src", /inovas-food-logo-menu\.png$/);
  await expect(page.locator(".sys-crumbs")).toContainText("Equipe INOVAS");
  await expect(page.locator(".sys-team-kpi")).not.toHaveCount(0);
  await expect(page.locator(".sys-team-kpi").first()).toContainText("Membros ativos");
  await expect(page.locator(".sys-team-table")).toContainText(login);
  // O esboço tinha 2 etapas e escopo por restaurante; o sistema não tem, então não aparecem.
  await expect(page.locator("body")).not.toContainText("2 etapas");

  // Convidar abre a janela do esboço (perfis em cartões, validade do convite)
  await page.locator("[data-invite-focus]").click();
  await expect(page.locator("[data-invite-dialog]")).toBeVisible();
  await expect(page.locator("#convidar-titulo")).toHaveText("Convidar usuário");
  await expect(page.locator(".sys-inv-role", { hasText: "Master" })).toContainText("Tudo no System");
  await page.screenshot({ path: path.join(artifactDirectory, "convidar-usuario.png") });

  // Validação local antes de chamar a API
  await page.locator("[data-invite-form] button[type='submit']").click();
  await expect(page.locator("[data-invite-error]")).toHaveText("Informe o nome da pessoa.");

  // Escolher o perfil marca o cartão
  await page.locator(".sys-inv-role", { hasText: "Comercial" }).click();
  await expect(page.locator(".sys-inv-role.is-active")).toContainText("Comercial");
  await page.locator("[data-invite-form] select[name='ttl']").selectOption("168");

  const suffix = Date.now().toString(36);
  const email = `convite.${suffix}@inovas.local`;
  await page.locator("[data-invite-form] input[name='name']").fill(`Convite ${suffix}`);
  await page.locator("[data-invite-form] input[name='email']").fill(email);
  await page.locator("[data-invite-form] button[type='submit']").click();
  await expect(page.locator(".sys-inv-done")).toContainText(`Convite registrado para ${email}`);
  // Validade de 7 dias escolhida na janela
  const inSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  await expect(page.locator(".sys-inv-done")).toContainText(`Vale até ${inSevenDays}`);
  await page.locator(".sys-inv-actions [data-invite-close]").click();
  await expect(page.locator("[data-invite-dialog]")).toBeHidden();
  const invitedRow = page.locator(".sys-team-table tr", { hasText: email });
  await expect(invitedRow).toContainText("Comercial");
  await expect(invitedRow).toContainText("Convite pendente");
  await page.locator("[data-team-search]").fill(suffix);
  await expect(page.locator(".sys-team-table tbody tr")).toHaveCount(1);
  await page.locator("[data-team-search]").fill("");
  await page.screenshot({ path: path.join(artifactDirectory, "usuarios-inovas.png"), fullPage: true });

  // Perfis e permissões: clicar no cartão destaca a coluna
  await page.goto("/system/roles");
  await expect(page.getByRole("heading", { name: "Perfis e permissões" })).toBeVisible();
  await page.locator(".sys-profile-card", { hasText: "Comercial" }).click();
  await expect(page.locator(".sys-profile-card.is-active")).toContainText("Comercial");
  await expect(page.locator(".sys-perm-table thead th.is-col-active")).toHaveText("Comercial");
  await expect(page.locator(".sys-profile-card", { hasText: "Comercial" })).toContainText(/1 pessoa|\d+ pessoas/);
  await page.screenshot({ path: path.join(artifactDirectory, "perfis-e-permissoes.png"), fullPage: true });

  // Auditoria: filtro "Equipe INOVAS" mostra o convite; CSV exporta o filtrado
  await page.goto("/system#audit");
  await expect(page.getByRole("heading", { name: "Auditoria e sessões de suporte" })).toBeVisible();
  await page.locator("[data-audit-filter='period']").selectOption("all");
  await page.locator("[data-audit-scope='team']").click();
  await expect(page.locator("[data-audit-scope='team']")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".sys-audit-table")).toContainText("SYSTEM_USER_CREATED");
  await expect(page.locator(".sys-audit-table")).toContainText("Alteração");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("[data-audit-export]").click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^auditoria-inovas-\d{4}-\d{2}-\d{2}\.csv$/);
  const csvPath = path.join(artifactDirectory, "auditoria.csv");
  await download.saveAs(csvPath);
  const csv = fs.readFileSync(csvPath, "utf8");
  expect(csv).toContain('"Quando";"Quem";"Ação"');
  expect(csv).toContain("SYSTEM_USER_CREATED");
  await page.locator("[data-audit-scope='support']").click();
  await expect(page.locator("[data-audit-results]")).not.toContainText("SYSTEM_USER_CREATED");
  await page.screenshot({ path: path.join(artifactDirectory, "auditoria.png"), fullPage: true });

  // Busca rápida da barra superior leva para Restaurantes já filtrado
  await page.goto("/system/users");
  await page.locator("#sys-quick-search-input").fill("kasulo");
  await page.locator("#sys-quick-search-input").press("Enter");
  await expect(page).toHaveURL(/\/system#restaurants\?search=kasulo$/);
  await expect(page.locator("[data-restaurant-filter='search']")).toHaveValue("kasulo");

  // Celular: sem rolagem lateral
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/system/users");
  await expect(page.getByRole("heading", { name: "Usuários INOVAS" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(artifactDirectory, "usuarios-inovas-mobile.png"), fullPage: true });
  await page.locator("[data-invite-focus]").click();
  await expect(page.locator("[data-invite-dialog]")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(artifactDirectory, "convidar-usuario-mobile.png") });
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-invite-dialog]")).toBeHidden();

  expect(consoleErrors, consoleErrors.join(" | ")).toEqual([]);
});
