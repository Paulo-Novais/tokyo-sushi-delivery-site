const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

// Novo Caixa — Fase 2: componentes base em várias resoluções (ESPEC seção 5).
// Página de teste montada só com os componentes; nenhuma tela do Caixa atual muda.

const artifactDirectory = path.join(process.cwd(), "artifacts", "novo-caixa");
fs.mkdirSync(artifactDirectory, { recursive: true });

const tables = Array.from({ length: 12 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  const variant = index === 4 ? "busy" : index === 7 ? "bill" : "free";
  const label = { free: "Livre", busy: "Ocupada", bill: "Pediu conta" }[variant];
  const meta = variant === "free" ? "0 pessoas · Abrir comanda →" : "4 pessoas · 42 min";
  return `<button type="button" class="cx-status-card is-${variant}"><span class="cx-card-number">${number}</span><span class="cx-card-status">${label}</span><span class="cx-card-meta">${meta}</span></button>`;
}).join("");

const products = Array.from({ length: 10 }, (_, index) =>
  `<button type="button" class="cx-status-card is-free"><span class="cx-muted">${index + 1}</span><strong>Produto exemplo ${index + 1}</strong><span class="cx-num">R$ 10,00</span></button>`
).join("");

const page = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/admin/cash-ui.css"><script src="/admin/cash-ui.js"></script>
<style>body{margin:0;background:#f4f5f7}</style></head><body>
<div class="cx-root">
  <header class="cx-topbar">
    <div class="cx-topbar-title"><h1>Salão</h1><p>Caixa aberto às 18:02 · fundo R$ 200,00</p></div>
    <div class="cx-topbar-actions">
      <button class="cx-btn" type="button">+ Nova comanda <span class="cx-kbd">F1</span></button>
      <button class="cx-btn" type="button">Lançar pedido <span class="cx-kbd">F3</span></button>
      <button class="cx-btn" type="button">Sangria / Suprimento</button>
      <button class="cx-btn cx-btn-primary" type="button">Fechar caixa</button>
    </div>
  </header>
  <div class="cx-scroll-row" data-test="categories">${["Favoritos","Entradas","Sushis","Hot rolls","Temakis","Combos","Pratos quentes","Bebidas","Sobremesas","Adicionais"].map((c)=>`<button class="cx-chip" type="button">${c}</button>`).join("")}</div>
  <div class="cx-split" style="margin-top:16px">
    <section class="cx-split-main" data-test="main"><div class="cx-grid-tables" data-test="tables">${tables}</div>
      <div class="cx-grid-products" style="margin-top:16px">${products}</div></section>
    <aside class="cx-split-side cx-panel" data-test="side"><div class="cx-panel-scroll" style="padding:16px">Pedido</div>
      <div style="padding:16px"><button class="cx-btn cx-btn-primary cx-btn-block" type="button" data-test="send">Enviar para a cozinha <span class="cx-kbd">F2</span></button></div></aside>
  </div>
  <div class="cx-stepper" data-test="stepper"><button type="button" data-cx-step="-1" aria-label="Menos uma pessoa">−</button><output>0</output><button type="button" data-cx-step="1" aria-label="Mais uma pessoa">+</button></div>
  <button class="cx-btn" type="button" data-test="open-modal">Abrir comanda</button>
  <dialog class="cx-modal" data-test="modal">
    <div class="cx-modal-head"><h2>Abrir comanda</h2></div>
    <div class="cx-modal-body"><p class="cx-hint is-error" data-test="hint">Informe quantas sentaram para abrir a comanda</p></div>
    <div class="cx-modal-actions"><button class="cx-btn" type="button" data-test="cancel" onclick="this.closest('dialog').close()">Cancelar (Esc)</button>
      <button class="cx-btn cx-btn-primary" type="button" data-cx-confirm data-test="confirm" disabled>Abrir mesa</button></div>
  </dialog>
</div>
<script>
  window.stepper = InovasCashUi.bindStepper(document.querySelector('[data-test=stepper]'), {
    min: 0, max: 8,
    onChange: (value) => {
      const confirm = document.querySelector('[data-test=confirm]');
      confirm.disabled = value < 1;
      document.querySelector('[data-test=hint]').hidden = value >= 1;
    },
  });
  window.confirmed = 0;
  document.querySelector('[data-test=open-modal]').addEventListener('click', () =>
    InovasCashUi.openModal(document.querySelector('[data-test=modal]'), { onConfirm: () => { window.confirmed += 1; } }));
</script>
</body></html>`;

const mount = async (browserPage, width, height) => {
  await browserPage.setViewportSize({ width, height });
  await browserPage.goto("/admin/login.html");
  await browserPage.setContent(page, { waitUntil: "load" });
  await expect(browserPage.locator("[data-test=tables] .cx-status-card")).toHaveCount(12);
};

const expectNoHorizontalOverflow = async (browserPage) => {
  const { scrollWidth, clientWidth } = await browserPage.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, "a página não pode rolar na horizontal").toBeLessThanOrEqual(clientWidth + 1);
};

for (const [width, height] of [[1024, 768], [1366, 768], [1920, 1080]]) {
  test(`componentes base cabem em ${width}x${height} e mantêm alvos de 44 px`, async ({ page: browserPage }) => {
    await mount(browserPage, width, height);
    await expectNoHorizontalOverflow(browserPage);

    const smallTargets = await browserPage.$$eval(".cx-btn, .cx-chip, .cx-stepper button", (nodes) =>
      nodes
        .filter((node) => node.offsetParent !== null)
        .map((node) => ({ text: node.textContent.trim(), h: node.getBoundingClientRect().height, w: node.getBoundingClientRect().width }))
        .filter((box) => box.h < 44 || box.w < 44)
    );
    expect(smallTargets).toEqual([]);

    // Em 1024 px ou mais, cardápio e pedido ficam lado a lado.
    const main = await browserPage.locator("[data-test=main]").boundingBox();
    const side = await browserPage.locator("[data-test=side]").boundingBox();
    expect(side.x).toBeGreaterThan(main.x + main.width - 1);
    await expect(browserPage.locator("[data-test=send]")).toBeVisible();

    // Categorias rolam dentro da linha, sem quebrar a página.
    const row = await browserPage.locator("[data-test=categories]").evaluate((node) => ({
      height: node.getBoundingClientRect().height,
    }));
    expect(row.height).toBeLessThan(70);

    await browserPage.screenshot({ path: path.join(artifactDirectory, `componentes-${width}x${height}.png`), fullPage: true });
  });
}

test("abaixo de 1024 px o pedido desce para baixo do cardápio", async ({ page: browserPage }) => {
  await mount(browserPage, 800, 900);
  await expectNoHorizontalOverflow(browserPage);
  const main = await browserPage.locator("[data-test=main]").boundingBox();
  const side = await browserPage.locator("[data-test=side]").boundingBox();
  expect(side.y).toBeGreaterThanOrEqual(main.y + main.height - 1);
});

test("zoom de 125% em 1366 px não corta nada", async ({ page: browserPage }) => {
  // Zoom de 125% equivale a uma janela CSS de 1093 px.
  await mount(browserPage, 1093, 614);
  await expectNoHorizontalOverflow(browserPage);
  await expect(browserPage.locator("[data-test=send]")).toBeVisible();
});

test("stepper e modal: 0 pessoas bloqueia, Enter confirma e Esc fecha", async ({ page: browserPage }) => {
  await mount(browserPage, 1024, 768);
  const stepper = browserPage.locator("[data-test=stepper]");
  await expect(stepper.locator("[data-cx-step='-1']")).toBeDisabled();

  await browserPage.locator("[data-test=open-modal]").click();
  await expect(browserPage.locator("[data-test=modal]")).toBeVisible();
  await expect(browserPage.locator("[data-test=confirm]")).toBeDisabled();
  await browserPage.keyboard.press("Enter");
  expect(await browserPage.evaluate(() => window.confirmed)).toBe(0);
  await browserPage.keyboard.press("Escape");
  await expect(browserPage.locator("[data-test=modal]")).toBeHidden();

  await stepper.locator("[data-cx-step='1']").click();
  await stepper.locator("[data-cx-step='1']").click();
  await expect(stepper.locator("output")).toHaveText("2");
  await browserPage.locator("[data-test=open-modal]").click();
  await expect(browserPage.locator("[data-test=confirm]")).toBeEnabled();
  await expect(browserPage.locator("[data-test=hint]")).toBeHidden();
  await browserPage.locator("[data-test=modal]").press("Enter");
  expect(await browserPage.evaluate(() => window.confirmed)).toBe(1);
});
