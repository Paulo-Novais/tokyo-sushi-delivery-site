const { test, expect, request } = require("@playwright/test");
const {
  loginMaster,
  loginTenantOwner,
  onboardRestaurant,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");

// Mensalidade atrasada: a equipe INOVAS dá prazo, o restaurante vê o aviso,
// a INOVAS bloqueia (site fora do ar e Gestor travado) e, ao registrar o
// pagamento, o acesso volta sozinho. O restaurante não consegue mexer nisso.

const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${process.env.E2E_PORT || 3000}`;

const publicStatus = async (path) => {
  const api = await request.newContext({ baseURL });
  try {
    return (await api.get(path, { maxRedirects: 0 })).status();
  } finally {
    await api.dispose();
  }
};

const inDays = (days) =>
  new Date(Date.now() - 3 * 60 * 60 * 1000 + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const ownerPage = async (browser, restaurant) => {
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": `127.96.${Math.floor(Math.random() * 200)}.9` },
  });
  const page = await context.newPage();
  await page.goto("/admin/login.html?next=%2Fadmin%2F");
  await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForLoadState("networkidle");
  return { context, page };
};

test("Mensalidade atrasada: prazo, aviso no Gestor, bloqueio e liberação ao pagar", async ({ browser }) => {
  test.setTimeout(180_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("prazo"),
    name: "Restaurante Prazo",
    ownerPassword: "OwnerPrazo123!",
  });
  const activate = await master.api.post("/api/admin/master/subscription", {
    data: { restaurantKey: restaurant.key, plan: "PRO", status: "ACTIVE" },
  });
  expect(activate.status()).toBe(200);
  const charged = await master.api.post(`/api/system/restaurants/${restaurant.key}/ledger`, {
    data: {
      type: "SUBSCRIPTION",
      amountCents: 29990,
      description: "Mensalidade de teste",
      idempotencyKey: `teste-prazo-${restaurant.key}`,
      occurredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
  });
  expect(charged.status()).toBe(200);
  expect(await publicStatus(`/${restaurant.key}`)).toBe(200);
  const billing = (await (await master.api.get("/api/system/billing")).json()).data;
  expect(billing.restaurants.find((entry) => entry.restaurantKey === restaurant.key)).toMatchObject({ situation: "OVERDUE", owedCents: 29990 });

  // O dono do restaurante não consegue dar prazo nem se desbloquear.
  const owner = await loginTenantOwner(restaurant);
  for (const action of ["grace", "block", "unblock"]) {
    const response = await owner.api.post(`/api/system/billing/${restaurant.key}/${action}`, {
      data: { until: inDays(30) },
    });
    expect([401, 403], action).toContain(response.status());
  }
  // Prazo no passado é recusado.
  const past = await master.api.post(`/api/system/billing/${restaurant.key}/grace`, { data: { until: inDays(-1) } });
  expect(past.status()).toBe(400);

  // Painel INOVAS: dar prazo de 3 dias.
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": `127.97.${Math.floor(Math.random() * 200)}.7` },
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/system/login.html");
  await page.getByLabel("E-mail").fill(process.env.E2E_ADMIN_LOGIN);
  await page.getByLabel("Senha").fill(process.env.E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/system\/?$/);
  await page.goto("/system#billing");
  await page.locator('[data-billing-filter="OVERDUE"]').click();
  let line = page.locator(`[data-billing-row="${restaurant.key}"]`);
  await expect(line).toContainText("Em atraso");
  await line.getByRole("button", { name: "Dar prazo" }).click();
  const form = page.locator(`[data-billing-grace-form="${restaurant.key}"]`);
  await form.locator('input[name="until"]').fill(inDays(3));
  await form.locator('input[name="note"]').fill("Prometeu pagar via Pix");
  await form.locator('input[name="autoBlock"]').check();
  await form.getByRole("button", { name: "Salvar prazo" }).click();
  await expect(page.locator("[data-system-toast]")).toContainText("Prazo dado até");
  await page.locator('[data-billing-filter="GRACE"]').click();
  line = page.locator(`[data-billing-row="${restaurant.key}"]`);
  await expect(line).toContainText("Com prazo");
  await expect(line).toContainText("Prometeu pagar via Pix");
  await expect(line).toContainText("bloqueia sozinho");

  // Gestor do restaurante: faixa com o prazo, sem a observação interna.
  const ownerView = await ownerPage(browser, restaurant);
  const banner = ownerView.page.locator("[data-billing-banner]");
  await expect(banner).toContainText("Prazo para pagamento");
  await expect(banner).not.toContainText("Pix");
  await expect(ownerView.page.locator("[data-access-lock]")).toHaveCount(0);

  // Bloquear agora.
  page.once("dialog", (dialog) => dialog.accept());
  await line.getByRole("button", { name: "Bloquear agora" }).click();
  await expect(page.locator("[data-system-toast]")).toContainText("Restaurante bloqueado");
  await page.locator('[data-billing-filter="BLOCKED"]').click();
  line = page.locator(`[data-billing-row="${restaurant.key}"]`);
  await expect(line).toContainText("Bloqueado");
  await expect(line).toContainText("por falta de pagamento");
  expect(await publicStatus(`/${restaurant.key}`)).toBe(404);

  // Gestor travado: tela de bloqueio e API recusa.
  await ownerView.page.reload();
  await expect(ownerView.page.locator("[data-access-lock]")).toContainText("Sistema bloqueado por mensalidade em atraso");
  const blockedOrders = await owner.api.get("/api/admin/payouts/statement");
  expect(blockedOrders.status()).toBe(403);
  expect((await blockedOrders.json()).errorCode).toBe("restaurant_access_suspended");

  // Registrar o pagamento libera sozinho.
  page.once("dialog", (dialog) => dialog.accept("299,90"));
  await line.locator("[data-billing-pay]").click();
  await expect(page.locator("[data-system-toast]")).toContainText("Acesso liberado");
  await page.locator('[data-billing-filter=""]').click();
  line = page.locator(`[data-billing-row="${restaurant.key}"]`);
  await expect(line).toContainText("Em dia");
  expect(await publicStatus(`/${restaurant.key}`)).toBe(200);
  expect((await owner.api.get("/api/admin/payouts/statement")).status()).toBe(200);
  await ownerView.page.reload();
  await expect(ownerView.page.locator("[data-access-lock]")).toHaveCount(0);
  await expect(ownerView.page.locator("[data-billing-banner]")).toHaveCount(0);

  // Auditoria registra prazo, bloqueio e liberação.
  const audit = await (await master.api.get("/api/system/audit")).json();
  const types = (audit.data?.events || []).filter((event) => JSON.stringify(event).includes(restaurant.key)).map((event) => event.eventType);
  expect(types).toEqual(expect.arrayContaining(["SYSTEM_BILLING_GRACE_GRANTED", "SYSTEM_RESTAURANT_SUSPENDED", "SYSTEM_RESTAURANT_REACTIVATED"]));

  expect(pageErrors).toEqual([]);
  await ownerView.context.close();
  await context.close();
  await owner.api.dispose();
  await master.api.dispose();
});
