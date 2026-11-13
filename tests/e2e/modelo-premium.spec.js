// Modelo Premium: o site do Tokyo é o modelo; outro restaurante usa o mesmo
// layout em /<slug> com a própria identidade e sem enxergar dados do Tokyo.
const { test, expect, request } = require("@playwright/test");
const {
  loginMaster,
  loginTenantOwner,
  onboardRestaurant,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");

const baseURL = process.env.BASE_URL || process.env.VALIDATION_BASE_URL || "http://127.0.0.1:3000";
const SAME_PHONE = "(16) 99888-7766";
const PREMIUM_SETTINGS = (name) => ({
  restaurantName: name,
  slogan: "Pizzaria Delivery",
  whatsapp: "5516900001111",
  averagePreparationTimeMinutes: 40,
  // Os testes rodam a qualquer hora: o restaurante de teste aceita pedido fora do horário.
  businessSchedule: { acceptOrdersOutsideHours: true },
  premiumContent: {
    heroEyebrow: "Pizzaria artesanal (dados de teste)",
    heroTitleLines: ["Pizza quentinha,", "direto na sua casa."],
    cartAddons: [
      { id: "borda-catupiry", name: "Borda de catupiry", unitPrice: 12, freeUnits: 0, defaultQuantity: 0 },
      { id: "ingrediente-extra", name: "Ingrediente extra", unitPrice: 6, freeUnits: 0, defaultQuantity: 0 },
    ],
  },
});

const publicApiFor = (slug) =>
  request.newContext({
    baseURL,
    extraHTTPHeaders: {
      "x-inovas-restaurant-slug": slug,
      origin: baseURL,
      referer: `${baseURL}/${slug}`,
      "x-forwarded-for": `127.31.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`,
    },
  });

const orderPayload = (label) => ({
  profile: { id: `profile-${label}`, name: `Cliente ${label}`, phone: SAME_PHONE, email: "" },
  checkout: {
    paymentMethod: "pix",
    fulfillmentMode: "pickup",
    timingMode: "immediate",
    scheduledDate: "",
    scheduledTime: "",
    cashChangeRequired: "",
    cashAmountProvided: "",
    customerNotes: `modelo premium ${label}`,
  },
  items: [{ id: "carpaccio-salmao", name: "Carpaccio de Salmao", category: "Carpaccio", quantity: 1, price: 58.5 }],
  addons: [],
  deliveryQuote: null,
});

test.describe("Modelo Premium por slug", () => {
  let master;
  let tenantA;
  let tenantB;
  let ownerA;
  let ownerB;

  test.beforeAll(async () => {
    master = await loginMaster();
    tenantA = await onboardRestaurant(master.api, { key: uniqueKey("premium-a") });
    tenantB = await onboardRestaurant(master.api, { key: uniqueKey("kasulo-teste") });
    ownerA = await loginTenantOwner(tenantA);
    ownerB = await loginTenantOwner(tenantB);
    for (const [owner, name] of [
      [ownerA, "Restaurante A Teste"],
      [ownerB, "Kasulo Teste Pizzaria"],
    ]) {
      const response = await owner.api.post("/api/admin/settings/save", { data: { settings: PREMIUM_SETTINGS(name) } });
      expect(response.status()).toBe(200);
    }
  });

  test.afterAll(async () => {
    await Promise.all([master?.api, ownerA?.api, ownerB?.api].filter(Boolean).map((api) => api.dispose()));
  });

  test("páginas sob o slug com identidade, links e SEO do restaurante", async ({ page }) => {
    const slug = tenantB.key;
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    for (const [suffix, titlePrefix] of [
      ["", ""],
      ["/cardapio", "Cardápio | "],
      ["/entrega", "Entrega | "],
      ["/historico", "Histórico | "],
      ["/avaliar", "Avaliar | "],
      ["/trabalhe-conosco", "Trabalhe Conosco | "],
    ]) {
      const response = await page.goto(`/${slug}${suffix}`, { waitUntil: "networkidle" });
      expect(response?.status(), suffix).toBe(200);
      expect(new URL(page.url()).pathname).toBe(`/${slug}${suffix}`);
      await expect(page).toHaveTitle(`${titlePrefix}Kasulo Teste Pizzaria`);
      await expect(page.locator("link[rel=canonical]")).toHaveAttribute(
        "href",
        `https://inovasfood.com.br/${slug}${suffix}`
      );
      await expect(page.locator(".site-header .brand-meta strong")).toHaveText("Kasulo Teste Pizzaria");

      const navHrefs = await page.locator(".nav-links a").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
      expect(navHrefs).toEqual([
        `/${slug}/cardapio`,
        `/${slug}/entrega`,
        `/${slug}/historico`,
        `/${slug}/avaliar`,
        `/${slug}/trabalhe-conosco`,
      ]);
      const allHrefs = await page.locator("a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
      expect(allHrefs.filter((href) => /\.html/.test(href)), `links .html em ${suffix}`).toEqual([]);

      // O servidor local usa o cardápio do Tokyo como fixture dos restaurantes de teste
      // (INOVAS_ALLOW_TENANT_CATALOG_FALLBACK, só local); o cardápio fica fora desta checagem.
      const bodyText = await page.evaluate(() => {
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll("#catalogo, [data-catalog-root], [data-mobile-catalog-sheet], .catalog-mobile-block, [data-premium-quick-links], .hero-visual, script").forEach((node) => node.remove());
        return clone.innerText || clone.textContent || "";
      });
      const tokyoText = bodyText.match(/.{0,60}(tokyo|sushi|japon|hashi|shoyu|general os[oó]rio|14400-520).{0,40}/i)?.[0] || "";
      expect(tokyoText, `texto do Tokyo em ${suffix}`).toBe("");
      const whatsappHrefs = await page.locator('a[href*="wa.me"]').evaluateAll((links) => links.map((link) => link.href));
      for (const href of whatsappHrefs) {
        expect(href).toContain("wa.me/5516900001111");
      }
    }

    expect(pageErrors).toEqual([]);
  });

  test("home e cardápio usam textos, indicadores e complementos da configuração", async ({ page }) => {
    const slug = tenantB.key;
    await page.goto(`/${slug}`, { waitUntil: "networkidle" });
    await expect(page.locator("[data-premium-hero-eyebrow]")).toContainText("Pizzaria artesanal (dados de teste)");
    await expect(page.locator("[data-premium-metric-time]")).toHaveText("40min");
    await expect(page.locator("[data-premium-metric-items]")).not.toHaveText("+40");
    await expect(page.locator("[data-home-review-average]")).toHaveText("Novo");

    await page.goto(`/${slug}/cardapio`, { waitUntil: "networkidle" });
    const addons = page.locator("[data-cart-addons-panel]");
    await expect(addons).toContainText("Borda de catupiry");
    await expect(addons).toContainText("Ingrediente extra");
    await expect(addons).not.toContainText(/hashi|shoyu/i);

    await page.goto(`/${slug}/avaliar`, { waitUntil: "networkidle" });
    await expect(page.locator("[data-review-average]")).toHaveText("Ainda sem avaliações");
  });

  test("endereços antigos redirecionam e páginas soltas não caem no Tokyo", async () => {
    const api = await request.newContext({ baseURL });
    try {
      const legacy = await api.get(`/${tenantB.key}/cardapio.html?x=1`, { maxRedirects: 0 });
      expect(legacy.status()).toBe(308);
      expect(new URL(legacy.headers().location, baseURL).pathname).toBe(`/${tenantB.key}/cardapio`);

      const unknownPage = await api.get(`/${tenantB.key}/package.json`, { maxRedirects: 0 });
      expect(unknownPage.status()).toBe(404);

      const missingSlug = await api.get("/api/catalog?publicView=premium-page&page=cardapio");
      expect(missingSlug.status()).toBe(404);
    } finally {
      await api.dispose();
    }
  });

  test("mesmo telefone em dois restaurantes: pedidos e avaliações não se misturam", async () => {
    const apiA = await publicApiFor(tenantA.key);
    const apiB = await publicApiFor(tenantB.key);
    try {
      const orderA = await (await apiA.post("/api/orders/create", { data: orderPayload("a") })).json();
      const orderB = await (await apiB.post("/api/orders/create", { data: orderPayload("b") })).json();
      expect(orderA.tenantContext?.restaurantKey).toBe(tenantA.key);
      expect(orderB.tenantContext?.restaurantKey).toBe(tenantB.key);
      const idA = orderA.order.publicId || orderA.order.id;
      const idB = orderB.order.publicId || orderB.order.id;

      const listA = JSON.stringify(await (await ownerA.api.get("/api/admin/orders/list")).json());
      const listB = JSON.stringify(await (await ownerB.api.get("/api/admin/orders/list")).json());
      expect(listA).toContain(idA);
      expect(listA).not.toContain(idB);
      expect(listB).toContain(idB);
      expect(listB).not.toContain(idA);

      const review = await apiA.post("/api/reviews", {
        data: { name: "Cliente A", contact: SAME_PHONE, rating: 5, message: "Avaliação só do restaurante A" },
      });
      expect(review.status()).toBe(200);
      const reviewsB = JSON.stringify(await (await apiB.get("/api/reviews")).json());
      expect(reviewsB).not.toContain("Avaliação só do restaurante A");
      const reviewsA = JSON.stringify(await (await apiA.get("/api/reviews")).json());
      expect(reviewsA).toContain("Avaliação só do restaurante A");
    } finally {
      await apiA.dispose();
      await apiB.dispose();
    }
  });

  test("login e dados do aparelho ficam separados por restaurante", async ({ page }) => {
    await page.goto(`/${tenantA.key}`, { waitUntil: "networkidle" });
    const keyA = await page.evaluate(() => AUTH_PROFILE_KEY);
    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ name: "Cliente A", phone: "16998887766" })), keyA);

    await page.goto(`/${tenantB.key}`, { waitUntil: "networkidle" });
    const keyB = await page.evaluate(() => AUTH_PROFILE_KEY);
    expect(keyA).toContain(tenantA.key);
    expect(keyB).toContain(tenantB.key);
    expect(await page.evaluate((key) => localStorage.getItem(key), keyB)).toBeNull();
    await expect(page.locator("[data-auth-label]")).toHaveText("Entrar");
  });
});
