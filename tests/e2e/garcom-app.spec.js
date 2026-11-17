const { test, expect } = require("@playwright/test");
const {
  baseURL,
  createApiContext,
  expectNoHorizontalOverflow,
  loginAdmin,
  loginMaster,
  loginTenantOwner,
  onboardRestaurant,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");

// App do garçom (Android / tela /garcom): login do sistema, mesas, cardápio e
// envio para a cozinha. Nada de caixa, pagamento ou valores do caixa.

const WAITER_HEADERS = { "x-inovas-client": "inovas-garcom-android" };

const setupRestaurantWithWaiter = async (prefix) => {
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey(prefix),
    name: "Restaurante Garcom",
    ownerPassword: "OwnerGarcom123!",
  });
  await master.api.dispose();

  const owner = await loginTenantOwner(restaurant);
  const waiterLogin = `garcom.${restaurant.key || Date.now()}@inovas.local`.toLowerCase();
  const waiterPassword = "GarcomTeste123!";
  const created = await owner.api.post("/api/tenant/users", {
    data: {
      email: waiterLogin,
      name: "Garçom Teste",
      password: waiterPassword,
      role: "WAITER",
      credentialMode: "TEMPORARY_PASSWORD",
    },
  });
  expect(created.status(), JSON.stringify(await created.json().catch(() => ({})))).toBe(201);

  const opened = await owner.api.post("/api/admin/cash-register/open", {
    data: { openingAmount: 100, serviceChargeRate: 10, tableCount: 4 },
  });
  expect(opened.status(), JSON.stringify(await opened.json().catch(() => ({})))).toBe(200);
  return { restaurant, owner, waiterLogin, waiterPassword };
};

test("App do garçom (servidor): só ações de garçom e resposta sem valores do caixa", async () => {
  test.setTimeout(120_000);
  const { owner, waiterLogin, waiterPassword } = await setupRestaurantWithWaiter("garcomapi");
  const api = await createApiContext({ origin: baseURL });
  const session = await loginAdmin(api, { identifier: waiterLogin, password: waiterPassword });
  expect(session.response.status()).toBe(200);

  const snapshotResponse = await api.get("/api/admin/cash-register/snapshot", { headers: WAITER_HEADERS });
  expect(snapshotResponse.status()).toBe(200);
  const snapshot = await snapshotResponse.json();
  expect(snapshot.waiter.displayName).toBe("Garçom Teste");
  expect(snapshot.snapshot.register?.status).toBe("OPEN");
  expect(snapshot.snapshot.tables.length).toBe(4);
  // Sem dados do caixa no celular.
  for (const field of ["registerSummary", "movements", "auditEvents", "recentTabs", "paymentMethods"]) {
    expect(snapshot.snapshot[field], field).toBeUndefined();
  }
  expect(snapshot.admin).toBeUndefined();
  expect(Object.keys(snapshot.snapshot.register).sort()).toEqual(["id", "status"]);

  const product = snapshot.catalog.sections
    .flatMap((section) => section.items || [])
    .find((item) => item.isOrderable === true && item.isPaused !== true && item.isAvailable !== false);
  expect(product).toBeTruthy();

  // Abre a mesa: a comanda fica no nome de quem está logado (mesmo se tentar trocar).
  const table = snapshot.snapshot.tables[0];
  const openTab = await api.post("/api/admin/cash-register/open-tab", {
    headers: WAITER_HEADERS,
    data: { tableId: table.id, guestCount: 2, waiterName: "Outro Nome", waiterLogin: "dono@x" },
  });
  expect(openTab.status(), JSON.stringify(await openTab.json().catch(() => ({})))).toBe(200);
  const opened = await openTab.json();
  const tab = opened.snapshot.activeTabs.find((entry) => entry.id === opened.tabId);
  expect(tab.waiterName).toBe("Garçom Teste");

  // Item com observação; reenvio com o mesmo código não duplica.
  const operationId = `op_${require("node:crypto").randomUUID()}`;
  const addData = { tabId: tab.id, productId: product.id, quantity: 2, notes: "sem cebolinha", operationId };
  const first = await api.post("/api/admin/cash-register/add-item", { headers: WAITER_HEADERS, data: addData });
  const second = await api.post("/api/admin/cash-register/add-item", { headers: WAITER_HEADERS, data: addData });
  expect(first.status()).toBe(200);
  expect((await second.json()).operation).toEqual({ id: operationId, replayed: true });

  const send = await api.post("/api/admin/cash-register/send-order", {
    headers: WAITER_HEADERS,
    data: { tabId: tab.id },
  });
  expect(send.status(), JSON.stringify(await send.json().catch(() => ({})))).toBe(200);
  const sent = (await send.json()).snapshot.activeTabs.find((entry) => entry.id === tab.id);
  expect(sent.items).toHaveLength(1);
  expect(sent.items[0]).toMatchObject({ quantity: 2, notes: "sem cebolinha" });
  expect(sent.items[0].status).not.toBe("PENDING");

  // Fechar conta, pagamento e caixa: recusados no app, mesmo para o dono.
  for (const [action, data] of [
    ["begin-closing", { tabId: tab.id }],
    ["confirm-payment", { tabId: tab.id }],
    ["close", {}],
    ["movement", { type: "SUPPLY", amount: 1, reason: "x" }],
  ]) {
    const waiterTry = await api.post(`/api/admin/cash-register/${action}`, { headers: WAITER_HEADERS, data });
    expect(waiterTry.status(), action).toBe(403);
    expect(["waiter_app_action_not_allowed", "admin_permission_denied"]).toContain((await waiterTry.json()).errorCode);
    const ownerTry = await owner.api.post(`/api/admin/cash-register/${action}`, { headers: WAITER_HEADERS, data });
    expect(ownerTry.status(), `owner ${action}`).toBe(403);
    expect((await ownerTry.json()).errorCode, `owner ${action}`).toBe("waiter_app_action_not_allowed");
  }

  // No Gestor (sem o cabeçalho do app) o pedido aparece para o caixa.
  const ownerSnapshot = await (await owner.api.get("/api/admin/cash-register/snapshot")).json();
  const ownerTab = ownerSnapshot.activeTabs.find((entry) => entry.id === tab.id);
  expect(ownerTab.items[0].orderId).toBeTruthy();

  await api.dispose();
  await owner.api.dispose();
});

test("App do garçom (tela): login, abre mesa, lança item com observação e envia", async ({ browser }) => {
  test.setTimeout(150_000);
  const { owner, waiterLogin, waiterPassword } = await setupRestaurantWithWaiter("garcomui");
  await owner.api.dispose();

  const context = await browser.newContext({
    viewport: { width: 393, height: 851 },
    isMobile: true,
    hasTouch: true,
    extraHTTPHeaders: { "x-forwarded-for": `127.77.${Math.floor(Math.random() * 200)}.9` },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/garcom");
  await expect(page.getByRole("heading", { name: "INOVAS Garçom" })).toBeVisible();
  await page.locator('input[name="identifier"]').fill(waiterLogin);
  await page.locator('input[name="password"]').fill(waiterPassword);
  await page.getByRole("button", { name: "Entrar" }).click();

  // Mesas
  await expect(page.locator(".gc-header strong")).toContainText("Restaurante Garcom");
  await expect(page.locator(".gc-table")).toHaveCount(4);
  await expectNoHorizontalOverflow(page);
  await page.locator(".gc-table").first().click();
  await page.getByRole("button", { name: "Mais pessoas" }).click();
  await page.locator('[data-gc-sheet] input[name="customerName"]').fill("Ana");
  await page.getByRole("button", { name: "Abrir mesa" }).click();

  // Cardápio: item com observação
  await expect(page.getByRole("tab", { name: /Cardápio/ })).toHaveAttribute("aria-selected", "true");
  await page.locator(".gc-product-main").first().click();
  await page.getByRole("button", { name: "Aumentar" }).click();
  await page.locator('[data-gc-sheet] textarea[name="notes"]').fill("sem gergelim");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.locator("[data-gc-sheet]")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /Pedido/ })).toContainText("2");
  await expectNoHorizontalOverflow(page);

  // Pedido: confere e envia
  await page.getByRole("tab", { name: /Pedido/ }).click();
  await expect(page.locator(".gc-line small").first()).toContainText("sem gergelim");
  await page.getByRole("button", { name: /Enviar para a cozinha \(2\)/ }).click();
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.locator("[data-gc-toast]")).toContainText("Pedido enviado");

  // Mesa fica ocupada; reabrindo, o item aparece como enviado.
  const busy = page.locator(".gc-table.is-busy");
  await expect(busy).toHaveCount(1);
  await expect(busy).toContainText("Ana");
  await busy.click();
  await page.getByRole("tab", { name: /Pedido/ }).click();
  await expect(page.locator(".gc-line.is-sent")).toHaveCount(1);
  await expect(page.locator(".gc-badge")).toContainText(/cozinha|preparo|Pronto/);

  // Sair volta ao login.
  await page.getByRole("button", { name: "Voltar" }).click();
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page.locator('input[name="identifier"]')).toBeVisible();

  expect(errors).toEqual([]);
  await context.close();
});
