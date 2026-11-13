const { test, expect } = require("@playwright/test");
const { loginMaster, loginTenantOwner, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");

// Bug relatado: o site da pizzaria abria vermelho (padrão do Tokyo) e só depois ficava claro.
// A cor e o tema precisam estar na primeira pintura, antes de o script buscar as configurações.
test("Site por slug já abre com a cor e o tema do restaurante, antes das configurações carregarem", async ({ browser }) => {
  test.setTimeout(150_000);
  const master = await loginMaster();
  const tenant = await onboardRestaurant(master.api, { key: uniqueKey("cor"), name: "Pizzaria Clara", ownerPassword: "OwnerCor123!" });
  await master.api.dispose();
  const owner = await loginTenantOwner(tenant);
  const saved = await owner.api.post("/api/admin/settings/save", {
    data: { settings: { restaurantName: "Pizzaria Clara", primaryColor: "#ff8c00", secondaryColor: "#2f6f3e", siteTheme: "LIGHT" } },
  });
  expect(saved.status()).toBe(200);
  await owner.api.dispose();

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Segura as configurações por 4 s: o que aparece nesse tempo é a "primeira pintura".
  await page.route("**/api/restaurant-settings", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    await route.continue();
  });

  for (const pagePath of ["", "/cardapio"]) {
    await page.goto(`/${tenant.key}${pagePath}`, { waitUntil: "domcontentloaded" });
    const first = await page.evaluate(() => {
      const root = document.documentElement;
      const style = getComputedStyle(root);
      return {
        primary: style.getPropertyValue("--primary").trim(),
        gold: style.getPropertyValue("--gold").trim(),
        theme: root.dataset.siteTheme,
        themeMode: root.dataset.siteThemeMode,
        bg: style.getPropertyValue("--bg").trim(),
        themeColorMeta: document.querySelector('meta[name="theme-color"]')?.content,
      };
    });
    expect(first.primary, pagePath).toBe("#ff8c00");
    expect(first.gold, pagePath).toBe("#2f6f3e");
    expect(first.theme, pagePath).toBe("light");
    expect(first.themeMode, pagePath).toBe("light");
    expect(first.themeColorMeta, pagePath).toBe("#ff8c00");
    // Fundo do tema claro desde o início (o escuro do Tokyo é #080505).
    expect(first.bg, `${pagePath} fundo claro na primeira pintura`).toBe("#fff8f5");
  }

  // Depois das configurações carregarem, continua igual (nada "troca" de cor).
  await page.waitForLoadState("networkidle");
  const after = await page.evaluate(() => ({
    primary: getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
    theme: document.documentElement.dataset.siteTheme,
  }));
  expect(after).toEqual({ primary: "#ff8c00", theme: "light" });
  expect(errors).toEqual([]);
  await context.close();
});

test("Tokyo continua escuro e vermelho desde a primeira pintura", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto("/tokyo.html", { waitUntil: "domcontentloaded" });
  const first = await page.evaluate(() => ({
    primary: getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
    theme: document.documentElement.dataset.siteTheme || "dark",
  }));
  expect(first).toEqual({ primary: "#e83637", theme: "dark" });
  await context.close();
});
