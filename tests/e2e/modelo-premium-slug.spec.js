const { test, expect } = require("@playwright/test");
const { loginMaster, loginTenantOwner, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");

// Modelo Premium, fase 3: restaurante em inovasfood.com.br/<slug> com páginas, links,
// SEO e dados do aparelho próprios — e o Tokyo exatamente como antes.
const pizza = {
  id: "pizza-calabresa", name: "Pizza Calabresa", category: "Pizzas", description: "Molho, mussarela e calabresa.",
  image: "", badge: "", price: 49.9, basePrice: 49.9, regularPrice: 49.9,
  isAvailable: true, isPaused: false, isOrderable: true, availabilityState: "active",
};

test("Slug: páginas, links, SEO e sacola do próprio restaurante", async ({ browser }) => {
  test.setTimeout(180_000);
  const master = await loginMaster();
  const tenant = await onboardRestaurant(master.api, { key: uniqueKey("fase3"), name: "Pizzaria Fase3", ownerPassword: "OwnerFase3123!" });
  await master.api.dispose();
  const owner = await loginTenantOwner(tenant);
  expect((await owner.api.post("/api/admin/settings/save", { data: { settings: { restaurantName: "Pizzaria Fase3", whatsapp: "16988887777" } } })).status()).toBe(200);
  await owner.api.dispose();

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/catalog", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        sections: [{ id: "pizzas-salgadas", kicker: "Pizzas", title: "Pizzas Salgadas", description: "", items: [pizza] }],
        items: [pizza],
        featuredItems: [],
        tenantContext: { restaurantKey: tenant.key },
      }),
    })
  );

  // Home
  await page.goto(`/${tenant.key}`, { waitUntil: "networkidle" });
  const origin = new URL(page.url()).origin;
  await expect(page).toHaveTitle(/Pizzaria Fase3/);
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toMatch(/Tokyo|japon/i);
  await expect(page.locator(".hero-copy h1")).toContainText("Pizzaria Fase3");
  await expect(page.locator(".hero-visual")).toBeHidden();
  expect(await page.locator("img[src*='tokyo-logo']:visible").count()).toBe(0);
  const metas = await page.evaluate(() => ({
    canonical: document.querySelector('link[rel="canonical"]')?.href,
    ogUrl: document.querySelector('meta[property="og:url"]')?.content,
    description: document.querySelector('meta[name="description"]')?.content,
    ogImage: document.querySelector('meta[property="og:image"]')?.content || "",
  }));
  expect(metas.canonical).toBe(`${origin}/${tenant.key}`);
  expect(metas.ogUrl).toBe(`${origin}/${tenant.key}`);
  expect(metas.description).not.toMatch(/Tokyo/i);
  expect(metas.ogImage).not.toMatch(/combinado|tokyo/i);

  // Links internos ficam sob o slug, com endereço limpo.
  const cardapioLink = page.locator('.site-header a[href$="/cardapio"]').first();
  await expect(cardapioLink).toHaveAttribute("href", `/${tenant.key}/cardapio`);
  await cardapioLink.click();
  await expect(page).toHaveURL(new RegExp(`/${tenant.key}/cardapio$`));

  // Cardápio: atalhos do restaurante, sem Hashi/Shoyu do Tokyo.
  await expect(page.locator(".catalog-hero .quick-links")).toContainText("Pizzas Salgadas");
  await expect(page.locator(".catalog-hero .quick-links")).not.toContainText("Temakis");
  await expect(page.locator(".catalog-addons-panel")).toBeHidden();
  expect(await page.locator("body").innerText()).not.toMatch(/Hashi|Shoyu|Tokyo/i);

  // Sacola guardada só para este restaurante.
  await page.locator('[data-item-name="Pizza Calabresa"] [data-add-to-cart]').first().click();
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys.some((key) => key.startsWith(`${tenant.key}:`) && /cart/.test(key))).toBe(true);
  expect(keys.some((key) => /^tokyo_sushi_delivery_cart$/.test(key))).toBe(false);

  // As outras páginas também abrem pelo endereço limpo.
  for (const pageName of ["entrega", "historico", "avaliar", "trabalhe-conosco", "acompanhar"]) {
    const response = await page.goto(`/${tenant.key}/${pageName}`, { waitUntil: "domcontentloaded" });
    expect(response?.status(), pageName).toBe(200);
    await page.waitForLoadState("networkidle");
    expect(await page.locator("body").innerText(), pageName).not.toMatch(/Tokyo/);
  }

  expect(errors).toEqual([]);
  await context.close();
});

test("Slug: o Tokyo no domínio dele continua igual (links, sacola e complementos)", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto("/cardapio.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-item-name='Carpaccio de Salmao']")).toHaveCount(1);
  await expect(page.locator(".site-header a[href='./cardapio.html']").first()).toBeAttached();
  await expect(page.locator(".catalog-hero .quick-links")).toContainText("Temakis");
  await expect(page.locator(".catalog-addons-panel")).toBeVisible();
  await expect(page).toHaveTitle(/Tokyo/);
  await page.locator("[data-item-name='Carpaccio de Salmao'] [data-add-to-cart]").first().click();
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).toContain("tokyo_sushi_delivery_cart");
  await context.close();
});
