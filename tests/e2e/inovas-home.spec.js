const path = require("node:path");
const fs = require("node:fs/promises");
const { test, expect } = require("@playwright/test");

// Nova home da INOVAS (esboço "Nova Home"): 7 páginas no mesmo endereço, calculadora e contato.
const outDir = path.join(process.cwd(), "artifacts", "inovas-home");
const PAGES = ["inicio", "recursos", "economia", "na-pratica", "planos", "duvidas", "contato"];

const collectErrors = (page) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
};

test("Home: menu troca de página, âncoras antigas e sem erros", async ({ page }) => {
  await fs.mkdir(outDir, { recursive: true });
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/inovas", { waitUntil: "networkidle" });
  await expect(page).toHaveTitle(/INOVAS Food/);
  await expect(page.locator('[data-page="inicio"]')).toBeVisible();
  await expect(page.locator('[data-page="planos"]')).toBeHidden();
  await expect(page.locator("#if-hero-title")).toContainText("vender mais");
  // O painel do topo é ilustrativo e diz isso.
  await expect(page.locator(".if-mock-note")).toHaveText("Simulação · dados ilustrativos");

  for (const id of PAGES) {
    await page.locator(`.if-menu > [data-page-link="${id}"]`).click();
    await expect(page.locator(`[data-page="${id}"]`)).toBeVisible();
    await expect(page.locator(`.if-menu > [data-page-link="${id}"]`)).toHaveAttribute("aria-current", "page");
    expect(await page.locator(".if-page.is-active").count()).toBe(1);
    expect(page.url()).toContain(`#${id}`);
    await page.screenshot({ path: path.join(outDir, `${id}.png`), fullPage: true });
  }

  // Voltar do navegador volta para a página anterior.
  await page.goBack();
  await expect(page.locator('[data-page="duvidas"]')).toBeVisible();

  // Link antigo "#demonstracao" ainda abre o início; "#footer-contato" abre o contato.
  await page.goto("/inovas#demonstracao");
  await expect(page.locator('[data-page="inicio"]')).toBeVisible();
  await page.goto("/inovas#footer-contato");
  await expect(page.locator('[data-page="contato"]')).toBeVisible();

  // Nenhum texto de rascunho do esboço foi publicado.
  const html = await page.content();
  for (const marker of ["[X min]", "[telefone]", "[e-mail]", "[Confirmar", "[demais itens]", "[Conferir", "[informar", "[Preencher", "[Espaço", "99999-9999"]) {
    expect(html, marker).not.toContain(marker);
  }
  expect(errors).toEqual([]);
});

test("Home: Recursos mostra o módulo escolhido", async ({ page }) => {
  await page.goto("/inovas#recursos");
  await page.locator('[data-module="4"]').click();
  await expect(page.locator('[data-module="4"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-module="0"]')).toHaveAttribute("aria-selected", "false");
  await expect(page.locator("[data-module-name]")).toHaveText("Estoque");
  await expect(page.locator("[data-module-plan]")).toHaveText("Profissional e PRO");
  await expect(page.locator("[data-module-items] li")).toHaveCount(4);
});

test("Home: Economia calcula plano, domínio e comissão do app", async ({ page }) => {
  await page.goto("/inovas#economia");
  const price = page.locator("[data-builder-price]");
  await expect(price).toHaveText("R$ 100");
  await expect(page.locator("[data-builder-year]")).toContainText("R$ 1.200 por ano");

  // Valores padrão do esboço: R$ 20.000, 30%, Plano Básico (15,2%), plano Delivery.
  await expect(page.locator("[data-calc-fee]")).toHaveText("R$ 912/mês");
  await expect(page.locator("[data-calc-month]")).toHaveText("R$ 812");
  await expect(page.locator("[data-calc-year]")).toHaveText("R$ 9.744");
  await expect(page.locator("[data-calc-break]")).toContainText("R$ 658 por mês");

  // Profissional + domínio próprio = R$ 260.
  await page.locator('.if-plan-pick label:has(input[value="profissional"])').click();
  await page.locator(".if-toggle").click();
  await expect(price).toHaveText("R$ 260");
  await expect(page.locator("[data-builder-desc]")).toHaveText("Plano Profissional · domínio próprio incluso");
  await expect(page.locator("[data-calc-inovas]")).toHaveText("R$ 260/mês");
  await expect(page.locator("[data-calc-month]")).toHaveText("R$ 652");

  // Plano Entrega do app (26,2%) sobre R$ 6.000 = R$ 1.572.
  await page.locator('.if-calc-plan label:has(input[value="0.262"])').click();
  await expect(page.locator("[data-calc-fee]")).toHaveText("R$ 1.572/mês");

  // Vendas baixas: a economia nunca fica negativa.
  await page.locator("[data-calc-sales]").fill("2000");
  await page.locator("[data-calc-share]").fill("5");
  await expect(page.locator("[data-calc-month]")).toHaveText("R$ 0");

  // "trocar" avança o plano: Profissional -> PRO.
  await page.locator("[data-calc-swap]").click();
  await expect(price).toHaveText("a partir de R$ 390");
});

test("Home: Dúvidas abre uma por vez e o contato valida antes de abrir o e-mail", async ({ page }) => {
  await page.goto("/inovas#duvidas");
  const items = page.locator("[data-faq] details");
  await expect(items).toHaveCount(9);
  await items.nth(2).locator("summary").click();
  await expect(items.nth(2)).toHaveAttribute("open", "");
  await expect(items.nth(0)).not.toHaveAttribute("open", "");

  await page.goto("/inovas#contato");
  const form = page.locator("[data-contact-form]");
  await form.locator('button[type="submit"]').click();
  await expect(form.locator("[data-contact-error]")).toBeVisible();

  // Com tudo preenchido, monta o mailto em vez de enviar dados para algum servidor.
  await form.locator('input[name="nome"]').fill("Maria Teste");
  await form.locator('input[name="restaurante"]').fill("Casa Teste");
  await form.locator('input[name="whatsapp"]').fill("(11) 91234-5678");
  const requests = [];
  page.on("request", (req) => { if (req.method() === "POST") requests.push(req.url()); });
  await form.locator('button[type="submit"]').click();
  await expect(form.locator("[data-contact-error]")).toBeHidden();
  expect(requests).toEqual([]);
});

test("Home: sem rolagem lateral do celular ao desktop em todas as páginas", async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const id of PAGES) {
      await page.goto(`/inovas#${id}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${id} em ${width}px`).toBeLessThanOrEqual(1);
    }
  }
  // No celular o menu abre pelo botão.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inovas");
  await expect(page.locator(".if-menu")).toBeHidden();
  await page.locator("[data-menu-toggle]").click();
  await expect(page.locator(".if-menu")).toBeVisible();
  await page.locator('.if-menu > [data-page-link="planos"]').click();
  await expect(page.locator('[data-page="planos"]')).toBeVisible();
  await expect(page.locator(".if-menu")).toBeHidden();
  await page.screenshot({ path: path.join(outDir, "planos-celular.png"), fullPage: true });
});
