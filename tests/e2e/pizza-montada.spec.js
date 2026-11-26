const { test, expect } = require("@playwright/test");
const {
  baseURL,
  createCustomerApiContext,
  hostForKey,
  loginMaster,
  loginTenantOwner,
  onboardRestaurant,
  orderPayload,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");

// Pizzaria: o dono liga a "Montagem de pizza", escolhe as seções de sabores,
// quantos sabores (1, 2, 4) e as bordas. O site mostra "Monte sua pizza" e o
// servidor cobra o sabor mais caro + borda, ignorando o preço do navegador.

const PIZZA_BUILDER = (sectionIds) => ({
  enabled: true,
  sizeLabel: "8 pedaços",
  flavorCounts: [1, 2, 4],
  flavorSectionIds: sectionIds,
  borders: [
    { name: "Catupiry", price: 9 },
    { name: "Cheddar", price: 9 },
    { name: "Muçarela", price: 8 },
  ],
});

test("Pizzaria: configura no Gestor, monta 2 sabores com borda no site e o servidor cobra o mais caro", async ({ browser }) => {
  test.setTimeout(180_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("pizzaria"),
    name: "Pizzaria Teste",
    ownerPassword: "OwnerPizzaria123!",
  });
  await master.api.dispose();
  const host = hostForKey(restaurant.key);
  const { api } = await loginTenantOwner({ ...restaurant, host });

  // Cardápio: seção de sabores com 3 pizzas.
  const section = await api.post("/api/admin/catalog/save-section", { data: { title: "Pizzas Salgadas" } });
  expect(section.status()).toBe(200);
  const sectionId = (await section.json()).sectionId;
  const flavors = {};
  for (const [name, price] of [["Calabresa", 52.9], ["Camarão", 79.9], ["Muçarela", 49.9]]) {
    const saved = await api.post("/api/admin/catalog/save-item", {
      data: { sectionId, name, price, description: `Pizza de ${name}`, isAvailable: true },
    });
    expect(saved.status(), name).toBe(200);
    flavors[name] = (await saved.json()).item.id;
  }

  // Sem permissão de editar cardápio não salva; o dono salva.
  const saved = await api.post("/api/admin/catalog/pizza-builder", { data: { pizzaBuilder: PIZZA_BUILDER([sectionId]) } });
  expect(saved.status()).toBe(200);
  const builder = (await saved.json()).pizzaBuilder;
  expect(builder).toMatchObject({ enabled: true, flavorCounts: [1, 2, 4], flavorSectionIds: [sectionId] });
  expect(builder.borders.map((border) => border.id)).toEqual(["catupiry", "cheddar", "mucarela"]);
  expect((await (await api.get("/api/admin/catalog/pizza-builder")).json()).pizzaBuilder.enabled).toBe(true);
  // Salvar as configurações gerais do restaurante não apaga a montagem.
  const settings = (await (await api.get("/api/admin/settings/list")).json()).settings;
  if (settings) {
    const { pizzaBuilder, ...rest } = settings;
    const resaved = await api.post("/api/admin/settings/update", { data: { settings: rest } });
    if (resaved.status() === 200) {
      expect((await (await api.get("/api/admin/catalog/pizza-builder")).json()).pizzaBuilder.enabled).toBe(true);
    }
  }

  // Gestor (tela): Cardápio > Montagem de pizza mostra "Ligada" e salva uma borda nova.
  const gestor = await browser.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": `127.72.${Math.floor(Math.random() * 200)}.5` } });
  const gestorPage = await gestor.newPage();
  const gestorErrors = [];
  gestorPage.on("pageerror", (error) => gestorErrors.push(error.message));
  await gestorPage.goto("/login");
  await gestorPage.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await gestorPage.locator('input[name="password"]').fill(restaurant.ownerPassword);
  await gestorPage.locator("[data-admin-login-submit]").click();
  await gestorPage.waitForLoadState("networkidle");
  await gestorPage.goto("/admin/?section=menu");
  const card = gestorPage.locator("[data-pizza-builder-card]");
  await expect(card).toContainText("Ligada no site");
  await card.locator("summary").click();
  const form = card.locator("[data-pizza-builder-form]");
  await expect(form.locator('input[name="flavorSectionIds"]:checked')).toHaveCount(1);
  await form.locator("[data-pizza-builder-add-border]").click();
  await form.locator('[data-pizza-builder-border]').last().locator('[name="borderName"]').fill("Chocolate");
  await form.locator('[data-pizza-builder-border]').last().locator('[name="borderPrice"]').fill("12,00");
  await form.getByRole("button", { name: "Salvar montagem" }).click();
  await expect(gestorPage.locator("[data-pizza-builder-message]")).toContainText("Montagem salva");
  if (process.env.PIZZA_SHOT_DIR) await gestorPage.screenshot({ path: `${process.env.PIZZA_SHOT_DIR}/gestor-montagem.png`, fullPage: false });
  const afterUi = (await (await api.get("/api/admin/catalog/pizza-builder")).json()).pizzaBuilder;
  expect(afterUi.borders.map((border) => border.name)).toEqual(["Catupiry", "Cheddar", "Muçarela", "Chocolate"]);
  expect(afterUi.borders[3].price).toBe(12);
  expect(gestorErrors).toEqual([]);
  await gestor.close();

  // Site: "Monte sua pizza" aparece e monta ½ Calabresa + ½ Camarão com borda de catupiry.
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `127.71.${Math.floor(Math.random() * 200)}.5` } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`/${restaurant.key}/cardapio`, { waitUntil: "networkidle" });
  const block = page.locator("[data-pizza-builder]");
  await expect(block).toBeVisible();
  if (process.env.PIZZA_SHOT_DIR) { await block.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${process.env.PIZZA_SHOT_DIR}/site-monte-sua-pizza.png` }); }
  await expect(block).toContainText("Monte sua pizza");
  await expect(block.locator("[data-pizza-open]")).toHaveCount(3);
  await block.locator('[data-pizza-open="2"]').click();
  const overlay = page.locator("[data-pizza-overlay]");
  await expect(overlay).toBeVisible();
  await expect(overlay.locator("[data-pizza-add]")).toBeDisabled();
  await overlay.locator(`[data-pizza-flavor="${flavors["Calabresa"]}"]`).click();
  await overlay.locator(`[data-pizza-flavor="${flavors["Camarão"]}"]`).click();
  await expect(overlay.locator("[data-pizza-calc]")).toContainText("Camarão R$ 79,90");
  await overlay.locator('[data-pizza-border-mode="1"]').click();
  await expect(overlay.locator("[data-pizza-add-label]")).toHaveText("Escolha o recheio da borda");
  await overlay.locator('[data-pizza-border="catupiry"]').click();
  await expect(overlay.locator("[data-pizza-add-total]")).toHaveText("R$ 88,90");
  if (process.env.PIZZA_SHOT_DIR) await page.screenshot({ path: `${process.env.PIZZA_SHOT_DIR}/site-montando.png` });
  await overlay.locator("[data-pizza-add]").click();
  await expect(overlay).toBeHidden();
  const cart = page.locator("[data-cart-items]");
  await expect(cart).toContainText("Pizza 2 sabores (8 pedaços): ½ Calabresa + ½ Camarão · borda de Catupiry");
  await expect(cart).toContainText("R$ 88,90");
  // A pizza continua na sacola depois de recarregar a página.
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("[data-cart-items]")).toContainText("½ Calabresa + ½ Camarão", { timeout: 15_000 });
  expect(pageErrors).toEqual([]);
  await context.close();

  // Pedido: o navegador manda preço R$ 1,00 e o servidor cobra R$ 88,90.
  const customer = await createCustomerApiContext({ host, label: `${restaurant.key}-pizza` });
  expect((await api.get("/api/admin/orders/list?limit=5")).status()).toBe(200); // Gestor aberto
  const pizzaId = `pizza|2|${flavors["Calabresa"]},${flavors["Camarão"]}|catupiry`;
  const payload = orderPayload(`${restaurant.key}-pizza`);
  payload.items = [{ id: pizzaId, name: "Pizza barata", category: "x", quantity: 1, price: 1 }];
  const created = await customer.post("/api/orders/create", {
    headers: { Origin: baseURL, Referer: `${baseURL}/` },
    data: payload,
  });
  const body = await created.json();
  expect(created.status(), JSON.stringify(body)).toBe(200);
  const order = body.order;
  expect(Number(order.total ?? order.totalAmount ?? order.subtotal)).toBeGreaterThanOrEqual(88.9);
  const list = await (await api.get("/api/admin/orders/list?limit=5")).json();
  const saved2 = JSON.stringify(list);
  expect(saved2).toContain("½ Calabresa + ½ Camarão");
  expect(saved2).toContain("88.9");

  // Sabor fora das seções de sabores é recusado.
  const bad = orderPayload(`${restaurant.key}-pizza-bad`);
  bad.items = [{ id: `pizza|2|${flavors["Calabresa"]},carpaccio-salmao|`, quantity: 1, price: 1, name: "x", category: "x" }];
  const refused = await customer.post("/api/orders/create", { headers: { Origin: baseURL, Referer: `${baseURL}/` }, data: bad });
  expect(refused.status()).toBe(400);
  await customer.dispose();
  await api.dispose();
});
