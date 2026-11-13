const { test, expect } = require("@playwright/test");
const { loginMaster, onboardRestaurant, uniqueKey } = require("./helpers/v1.9-fixtures.cjs");

// Modelo Premium: o cardápio do Tokyo nunca aparece em outro restaurante.
// Em produção o servidor entrega cardápio vazio para restaurante novo (teste unitário
// catalog-tenant-isolation). Aqui a API é simulada para testar o site: ele não pode
// completar com o cardápio fixo do Tokyo que está no script.js.
const TOKYO_ITEM = "Carpaccio de Salmao";

const pizzaCatalog = (key, sections) => ({
  ok: true,
  sectionDisplayOrder: sections.map((section) => section.id),
  sections,
  items: sections.flatMap((section) => section.items),
  featuredItems: [],
  tenantContext: { restaurantKey: key, restaurantName: `Pizzaria ${key}` },
});

const calabresa = {
  id: "pizza-calabresa",
  name: "Pizza Calabresa",
  category: "Pizzas",
  description: "Molho, mussarela e calabresa.",
  image: "",
  badge: "",
  price: 49.9,
  basePrice: 49.9,
  regularPrice: 49.9,
  isAvailable: true,
  isPaused: false,
  isOrderable: true,
  availabilityState: "active",
};

test("Cardápio: restaurante novo não mostra o cardápio do Tokyo; mostra só o próprio", async ({ browser }) => {
  test.setTimeout(150_000);
  const master = await loginMaster();
  const tenant = await onboardRestaurant(master.api, { key: uniqueKey("cardapio"), ownerPassword: "OwnerCardapio123!" });
  await master.api.dispose();

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let catalog = pizzaCatalog(tenant.key, []);
  let failing = false;
  await page.route("**/api/catalog", (route) =>
    failing
      ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
      : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(catalog) })
  );

  // Cardápio ainda vazio.
  await page.goto(`/${tenant.key}/cardapio.html`, { waitUntil: "networkidle" });
  const root = page.locator("[data-catalog-root]");
  await expect(root).toContainText("ainda não publicou o cardápio");
  await expect(root.locator(`[data-item-name="${TOKYO_ITEM}"]`)).toHaveCount(0);

  // Home: sem indicador de itens (não conta o cardápio do Tokyo).
  await page.goto(`/${tenant.key}`, { waitUntil: "networkidle" });
  await expect(page.locator('[data-home-metric="items"]')).toBeHidden();

  // Com uma categoria e um item: aparece só o da pizzaria.
  catalog = pizzaCatalog(tenant.key, [
    { id: "pizzas-salgadas", kicker: "Pizzas", title: "Pizzas Salgadas", description: "", items: [calabresa] },
  ]);
  await page.goto(`/${tenant.key}/cardapio.html`, { waitUntil: "networkidle" });
  await expect(root.locator('[data-item-name="Pizza Calabresa"]')).toHaveCount(1);
  await expect(root.locator(`[data-item-name="${TOKYO_ITEM}"]`)).toHaveCount(0);
  await expect(root).not.toContainText("Combinados");
  await page.goto(`/${tenant.key}`, { waitUntil: "networkidle" });
  await expect(page.locator("[data-home-item-count]")).toHaveText("1");

  // API fora do ar: aviso com "Tentar de novo", nunca o cardápio de outro restaurante.
  failing = true;
  await page.goto(`/${tenant.key}/cardapio.html`, { waitUntil: "networkidle" });
  await expect(root).toContainText("Não foi possível carregar o cardápio");
  await expect(root.locator(`[data-item-name="${TOKYO_ITEM}"]`)).toHaveCount(0);
  failing = false;
  await root.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(root.locator('[data-item-name="Pizza Calabresa"]')).toHaveCount(1);

  expect(errors).toEqual([]);
  await context.close();
});

test("Cardápio: o Tokyo continua com o cardápio dele", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto("/cardapio.html", { waitUntil: "domcontentloaded" });
  const api = await (await page.request.get("/api/catalog")).json();
  expect(api.tenantContext.restaurantKey).toBe("default");
  const root = page.locator("[data-catalog-root]");
  await expect(root.locator(`[data-item-name="${TOKYO_ITEM}"]`)).toHaveCount(1);
  await expect(root).toContainText("Combinados");
  await context.close();
});
