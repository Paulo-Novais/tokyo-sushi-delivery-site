const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { loginMaster, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");

// Padronização: o menu lateral e o início do conteúdo precisam ter as mesmas
// medidas em todas as páginas do Gestor (abas internas e páginas separadas,
// como Usuários), nos dois temas.

const outDir = path.join(process.cwd(), "artifacts", "novo-gestor", "padrao");
fs.mkdirSync(outDir, { recursive: true });

const measure = () => {
  const box = (selector) => {
    const node = document.querySelector(selector);
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) };
  };
  const sidebar = document.querySelector(".admin-sidebar, .users-sidebar");
  const style = sidebar ? getComputedStyle(sidebar) : null;
  const firstNav = sidebar?.querySelector(".admin-nav-item, .gx-nav-item, .users-nav a, .sys-nav-link");
  const label = firstNav?.querySelector("strong") || firstNav;
  const navStyle = label ? getComputedStyle(label) : null;
  const logo = sidebar?.querySelector(".admin-brand-logo, .gx-brand img, img");
  const content = document.querySelector(".admin-main-shell, .users-main, .sys-main");
  const contentRect = content?.getBoundingClientRect();
  return {
    sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : null,
    sidebarX: sidebar ? Math.round(sidebar.getBoundingClientRect().x) : null,
    sidebarBg: style?.backgroundColor || null,
    logoWidth: logo ? Math.round(logo.getBoundingClientRect().width) : null,
    navItemHeight: firstNav ? Math.round(firstNav.getBoundingClientRect().height) : null,
    navFontSize: navStyle ? navStyle.fontSize : null,
    contentX: contentRect ? Math.round(contentRect.x) : null,
    title: box("h1"),
  };
};

// Pedidos e Caixa saíram do menu do navegador (ficam no app INOVAS PDV): o botão
// continua na página, escondido, e é clicado como o app faz.
const openSection = async (page, key) => {
  const button = page.locator(`.admin-nav [data-admin-section="${key}"]`);
  if (await button.isVisible()) await button.click();
  else await button.evaluate((node) => node.click());
};

test("Gestor: menu e conteúdo com as mesmas medidas em todas as páginas", async ({ page }) => {
  test.setTimeout(240_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("padrao"),
    name: "Restaurante Padrao",
    ownerPassword: "OwnerPadrao123!",
  });
  const rows = [];
  try {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.setExtraHTTPHeaders({ "x-forwarded-for": "127.71.81.91" });
    await page.goto("/admin/login.html?next=%2Fadmin%2F");
    await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
    await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
    await page.locator("[data-admin-login-submit]").click();
    await page.waitForLoadState("networkidle");

    for (const theme of ["light", "dark"]) {
      await page.goto("/admin/");
      await page.waitForLoadState("networkidle");
      const current = await page.evaluate(() => document.body.dataset.adminTheme);
      if (current !== theme) await page.locator("[data-admin-theme-toggle]").click();
      for (const section of ["dashboard", "cash-register", "orders", "menu", "finance", "settings"]) {
        await openSection(page, section);
        await page.waitForTimeout(500);
        rows.push({ theme, page: section, ...(await page.evaluate(measure)) });
      }
      for (const [name, url] of [["usuarios", "/admin/users"], ["novo-usuario", "/admin/users/new"]]) {
        await page.goto(url);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(400);
        rows.push({ theme, page: name, ...(await page.evaluate(measure)) });
        await page.screenshot({ path: path.join(outDir, `${theme}-${name}.png`) });
      }
    }
  } finally {
    await master.api.dispose();
  }
  fs.writeFileSync(path.join(outDir, "medidas.json"), JSON.stringify(rows, null, 2));
  const reference = rows[0];
  const problems = [];
  for (const row of rows) {
    for (const key of ["sidebarWidth", "sidebarX", "logoWidth", "navItemHeight", "navFontSize", "contentX"]) {
      if (String(row[key]) !== String(reference[key])) {
        problems.push(`${row.theme}/${row.page}: ${key}=${row[key]} (padrão ${reference[key]})`);
      }
    }
  }
  expect(problems, problems.join("\n")).toEqual([]);
});
