const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { loginMaster, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");
const { mockBusyOrders } = require("./helpers/orders-mock.cjs");

// Varredura de telas: do celular antigo (320 px) ao monitor 2560 px.
// Em cada tamanho abre o Gestor (todas as abas), o System e o site público e
// mede: rolagem lateral da página, elementos que saem da tela e botões
// pequenos demais para tocar no celular.

const outDir = path.join(process.cwd(), "artifacts", "responsividade");
fs.mkdirSync(outDir, { recursive: true });

const VIEWPORTS = [
  { name: "320-celular-antigo", width: 320, height: 568, touch: true },
  { name: "360-celular", width: 360, height: 640, touch: true },
  { name: "390-celular", width: 390, height: 844, touch: true },
  { name: "768-tablet", width: 768, height: 1024, touch: true },
  { name: "1024-monitor-antigo", width: 1024, height: 768 },
  { name: "1280-notebook", width: 1280, height: 720 },
  { name: "1366-notebook", width: 1366, height: 768 },
  { name: "1440-monitor", width: 1440, height: 900 },
  { name: "1920-full-hd", width: 1920, height: 1080 },
  { name: "2560-qhd", width: 2560, height: 1440 },
];

const audit = () => {
  const doc = document.documentElement;
  const width = doc.clientWidth;
  const problems = [];
  const overflow = doc.scrollWidth - width;
  if (overflow > 1) problems.push(`rolagem lateral de ${overflow}px`);
  const isScrollableAncestor = (node) => {
    let n = node.parentElement;
    while (n && n !== document.body) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll|hidden)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 1) return true;
      if (cs.position === "fixed") return true;
      n = n.parentElement;
    }
    return false;
  };
  const visible = (node) => {
    const cs = getComputedStyle(node);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) return false;
    const r = node.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const offenders = [];
  for (const node of document.querySelectorAll("body *")) {
    if (!visible(node)) continue;
    const r = node.getBoundingClientRect();
    if ((r.right > width + 1 || r.left < -1) && !isScrollableAncestor(node) && getComputedStyle(node).position !== "fixed") {
      offenders.push(`${node.tagName.toLowerCase()}.${[...node.classList].slice(0, 2).join(".")} (${Math.round(r.left)}→${Math.round(r.right)})`);
    }
  }
  if (offenders.length) problems.push(`fora da tela: ${[...new Set(offenders)].slice(0, 5).join(", ")}`);
  // Texto cortado sem reticências (scrollWidth maior que a caixa e sem overflow visível).
  const clipped = [];
  for (const node of document.querySelectorAll("h1, h2, h3, button, a, label, strong")) {
    if (!visible(node) || node.closest(".sr-only")) continue;
    const cs = getComputedStyle(node);
    if (cs.textOverflow === "ellipsis") continue;
    if (node.scrollWidth > node.clientWidth + 2 && /hidden|clip/.test(cs.overflowX) && node.clientWidth > 0) {
      // Só conta se o próprio texto passa da caixa (zoom de foto e sombra não contam).
      const range = document.createRange();
      range.selectNodeContents(node);
      const textBox = range.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      if (textBox.right <= box.right + 1 && textBox.left >= box.left - 1) continue;
      clipped.push(`${node.tagName.toLowerCase()} "${(node.textContent || "").trim().slice(0, 30)}"`);
    }
  }
  if (clipped.length) problems.push(`texto cortado: ${clipped.slice(0, 4).join(", ")}`);
  return problems;
};

const tinyTargets = () => {
  const small = [];
  for (const node of document.querySelectorAll("button, a[href], input:not([type=hidden]), select, [role=button]")) {
    const cs = getComputedStyle(node);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = node.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.bottom < 0 || r.top > window.innerHeight * 3) continue;
    if (node.closest(".sr-only, [hidden]")) continue;
    if (node.matches(".gx-order-hit")) continue;
    // Caixa de marcar dentro de rótulo grande: o alvo de toque é o rótulo.
    const label = node.matches("input[type=checkbox], input[type=radio]") && node.closest("label");
    if (label) {
      const lr = label.getBoundingClientRect();
      if (lr.height >= 30 && lr.width >= 30) continue;
    }
    if (r.height < 30 || r.width < 30) small.push(`${node.tagName.toLowerCase()} "${(node.textContent || node.getAttribute("aria-label") || "").trim().slice(0, 20)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return small;
};

const report = [];
const record = (viewport, page, problems) => {
  if (problems.length) report.push(`[${viewport}] ${page}: ${problems.join(" | ")}`);
};

test.describe.configure({ mode: "serial" });

let restaurant;

test.beforeAll(async () => {
  const master = await loginMaster();
  restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("telas"),
    name: "Restaurante Telas",
    ownerPassword: "OwnerTelas123!",
  });
  await master.api.dispose();
});

for (const viewport of VIEWPORTS) {
  test(`telas ${viewport.name}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: Boolean(viewport.touch),
      extraHTTPHeaders: { "x-forwarded-for": `127.80.${viewport.width % 250}.${viewport.height % 250}` },
    });
    const page = await context.newPage();
    try {
      // Login do Gestor
      await page.goto("/admin/login.html");
      record(viewport.name, "login-gestor", await page.evaluate(audit));
      await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
      await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
      await mockBusyOrders(page);
      await page.locator("[data-admin-login-submit]").click();
      await page.waitForLoadState("networkidle");

      const sections = await page.evaluate(() =>
        [...new Set([...document.querySelectorAll(".admin-nav [data-admin-section]")].map((node) => node.dataset.adminSection))]
      );
      for (const section of sections) {
        await page.goto(`/admin/?section=${section}`);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(400);
        const problems = await page.evaluate(audit);
        if (viewport.touch) {
          const small = await page.evaluate(tinyTargets);
          if (small.length > 0) problems.push(`alvos pequenos (${small.length}): ${small.slice(0, 3).join(", ")}`);
        }
        record(viewport.name, `gestor/${section}`, problems);
        if (["dashboard", "orders", "cash-register", "menu", "finance"].includes(section)) {
          await page.screenshot({ path: path.join(outDir, `${viewport.name}-${section}.png`) });
        }
      }

      // Site público
      for (const publicPath of ["/", "/cardapio.html"]) {
        await page.goto(publicPath);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(300);
        record(viewport.name, `site${publicPath}`, await page.evaluate(audit));
      }
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-site-cardapio.png`) });
    } finally {
      await context.close();
    }

    // System (Master)
    const systemContext = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: Boolean(viewport.touch),
      extraHTTPHeaders: { "x-forwarded-for": `127.81.${viewport.width % 250}.${viewport.height % 250}` },
    });
    const systemPage = await systemContext.newPage();
    try {
      await systemPage.goto("/system/login.html");
      record(viewport.name, "login-system", await systemPage.evaluate(audit));
      const login = await systemPage.request.post("/api/admin/login", {
        data: { identifier: process.env.E2E_ADMIN_LOGIN, password: process.env.E2E_ADMIN_PASSWORD },
      });
      expect(login.status()).toBe(200);
      for (const systemPath of ["/system", "/system#restaurants", "/system#support", "/system#audit", "/system/users", "/system/roles"]) {
        await systemPage.goto(systemPath);
        await systemPage.waitForLoadState("networkidle");
        await systemPage.waitForTimeout(400);
        record(viewport.name, `system${systemPath.replace("/system", "") || "/"}`, await systemPage.evaluate(audit));
      }
      await systemPage.screenshot({ path: path.join(outDir, `${viewport.name}-system-perfis.png`) });
    } finally {
      await systemContext.close();
    }
  });
}

test.afterAll(() => {
  fs.writeFileSync(path.join(outDir, "relatorio.txt"), report.join("\n") || "Nenhum problema encontrado.");
});
