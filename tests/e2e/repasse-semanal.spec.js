const { test, expect } = require("@playwright/test");
const {
  loginMaster,
  loginTenantOwner,
  onboardRestaurant,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");

// Repasse semanal (modelo iFood): a INOVAS lança mensalidade, débitos e
// créditos; o restaurante vê o extrato discriminado no Financeiro e não
// consegue lançar nada. Venda e taxa só podem vir do provedor de pagamento.

const mondayOf = (offsetWeeks = 0) => {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000); // Brasília
  const day = (now.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day + offsetWeeks * 7));
  return monday.toISOString().slice(0, 10);
};

test("Repasse: INOVAS lança débitos, restaurante vê extrato discriminado e fecha a semana", async ({ browser }) => {
  test.setTimeout(150_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("repasse"),
    name: "Restaurante Repasse",
    ownerPassword: "OwnerRepasse123!",
  });
  const other = await onboardRestaurant(master.api, {
    key: uniqueKey("repasseb"),
    name: "Restaurante Outro",
    ownerPassword: "OwnerRepasseB123!",
  });

  const lastWeek = mondayOf(-1);
  const post = (key, action, data) => master.api.post(`/api/system/restaurants/${key}/${action}`, { data });
  const midLastWeek = `${lastWeek}T15:00:00-03:00`;

  const subscription = await post(restaurant.key, "ledger", {
    type: "SUBSCRIPTION",
    amountCents: 14990,
    description: "Mensalidade",
    idempotencyKey: `sub-${restaurant.key}`,
    occurredAt: midLastWeek,
  });
  expect(subscription.status(), JSON.stringify(await subscription.json())).toBe(200);
  const repeated = await post(restaurant.key, "ledger", {
    type: "SUBSCRIPTION",
    amountCents: 14990,
    description: "Mensalidade",
    idempotencyKey: `sub-${restaurant.key}`,
    occurredAt: midLastWeek,
  });
  expect((await repeated.json()).data.replayed).toBe(true);
  expect((await post(restaurant.key, "ledger", {
    type: "DEBT",
    amountCents: 2500,
    description: "Taxa de adesão (1/3)",
    idempotencyKey: `debt-${restaurant.key}`,
    occurredAt: midLastWeek,
  })).status()).toBe(200);
  expect((await post(restaurant.key, "ledger", {
    type: "CREDIT",
    amountCents: 1000,
    description: "Desconto de boas-vindas",
    idempotencyKey: `credit-${restaurant.key}`,
    occurredAt: midLastWeek,
  })).status()).toBe(200);

  // Venda e taxa não podem ser lançadas à mão.
  const fakeSale = await post(restaurant.key, "ledger", {
    type: "SALE",
    amountCents: 999999,
    description: "x",
    idempotencyKey: `sale-${restaurant.key}`,
  });
  expect(fakeSale.status()).toBe(400);

  // Fecha a semana passada: débitos > vendas -> nada a repassar, saldo devedor.
  const closed = await post(restaurant.key, "payouts", { weekKey: lastWeek });
  expect(closed.status(), JSON.stringify(await closed.json())).toBe(200);
  const payout = (await closed.json()).data.payout;
  expect(payout.status).toBe("NOTHING_TO_PAY");
  expect(payout.carryOverCents).toBe(-(14990 + 2500 - 1000));

  // Restaurante: lê o próprio extrato; não lança nada; não vê o outro.
  const owner = await loginTenantOwner(restaurant);
  const statementResponse = await owner.api.get(`/api/admin/payouts/statement?week=${lastWeek}`);
  expect(statementResponse.status()).toBe(200);
  const { statement } = await statementResponse.json();
  expect(statement.closed).toBe(true);
  expect(statement.lines.map((line) => line.label)).toEqual([
    "Mensalidade INOVAS · Mensalidade",
    "Débito do restaurante · Taxa de adesão (1/3)",
    "Crédito / ajuste a favor · Desconto de boas-vindas",
  ]);
  const current = await (await owner.api.get("/api/admin/payouts/statement")).json();
  expect(current.statement.lines[0]).toMatchObject({ label: "Saldo devedor da semana anterior", amountCents: -16490 });
  expect((await owner.api.post("/api/admin/payouts/statement", { data: {} })).status()).toBe(405);
  expect([401, 403]).toContain((await owner.api.post(`/api/system/restaurants/${restaurant.key}/ledger`, {
    data: { type: "CREDIT", amountCents: 100000, description: "eu mesmo", idempotencyKey: "self-credit-1" },
  })).status());

  const otherOwner = await loginTenantOwner(other);
  const otherStatement = await (await otherOwner.api.get(`/api/admin/payouts/statement?week=${lastWeek}`)).json();
  expect(otherStatement.statement.lines).toEqual([]);

  // Tela: Financeiro mostra o bloco do repasse com o saldo devedor.
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": `127.88.${Math.floor(Math.random() * 200)}.4` },
  });
  const page = await context.newPage();
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/api/") && response.status() >= 400) browserErrors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("/admin/login.html?next=%2Fadmin%2F");
  await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForLoadState("networkidle");
  await page.goto("/admin/?section=finance");
  await page.waitForLoadState("networkidle");
  const block = page.locator("[data-admin-payout]");
  await expect(block, browserErrors.join(" | ")).toContainText("Repasse do pagamento online");
  await expect(block).toContainText("Saldo devedor da semana anterior");
  await block.locator('[data-payout-week="-1"]').click();
  await expect(block).toContainText("Nada a repassar");
  await expect(block).toContainText("Mensalidade INOVAS");
  await expect(block).toContainText("Taxa de adesão (1/3)");
  await expect(block).toContainText("Desconto de boas-vindas");

  await context.close();
  await owner.api.dispose();
  await otherOwner.api.dispose();
  await master.api.dispose();
});

test("Painel INOVAS: pagamentos do restaurante, lançar débito e conta mascarada", async ({ browser }) => {
  test.setTimeout(150_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("painelpag"),
    name: "Restaurante Painel Pagamento",
    ownerPassword: "OwnerPainelPag123!",
  });
  const owner = await loginTenantOwner(restaurant);
  const bank = await owner.api.post("/api/admin/payment-settings/save", {
    data: {
      bankAccount: {
        holderName: "Restaurante Painel LTDA",
        holderDocument: "11.222.333/0001-81",
        holderEmail: "fin@painel.test",
        holderPhone: "16999990000",
        bankCode: "341",
        branchNumber: "1234",
        accountNumber: "9876543",
        accountCheckDigit: "2",
      },
    },
  });
  expect(bank.status()).toBe(200);

  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `127.94.${Math.floor(Math.random() * 200)}.6` } });
  const page = await context.newPage();
  await page.goto("/system/login.html");
  await page.getByLabel("E-mail").fill(process.env.E2E_ADMIN_LOGIN);
  await page.getByLabel("Senha").fill(process.env.E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/system\/?$/);
  await page.goto("/system#restaurants");
  await page.getByPlaceholder("Buscar por nome ou identificador").fill(restaurant.key);
  await page.locator("[data-restaurant-row]").first().click();
  const block = page.locator(`[data-sys-payments="${restaurant.key}"]`);
  await expect(block).toContainText("Pagamentos e repasses");
  await expect(block).toContainText("Conta ativa");
  await expect(block).toContainText("Restaurante Painel LTDA");
  await expect(block).toContainText("11.•••.•••/••••-81");
  await expect(block).not.toContainText("9876543");

  await block.locator('[data-sys-pay-entry] [name="amount"]').fill("25,00");
  await block.locator('[data-sys-pay-entry] [name="description"]').fill("Taxa de adesão (1/3)");
  await block.locator('[data-sys-pay-entry] button[type="submit"]').click();
  await expect(page.locator(`[data-sys-payments="${restaurant.key}"]`)).toContainText("-R$ 25,00");

  const statement = (await (await owner.api.get("/api/admin/payouts/statement")).json()).statement;
  expect(statement.lines.map((line) => line.label)).toContain("Débito do restaurante · Taxa de adesão (1/3)");

  await context.close();
  await owner.api.dispose();
  await master.api.dispose();
});

test("Painel INOVAS: Mensalidades mostra em atraso e em dia; registrar pagamento", async ({ browser }) => {
  test.setTimeout(150_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("mensal"),
    name: "Restaurante Mensalidade",
    ownerPassword: "OwnerMensal123!",
  });
  const activate = await master.api.post("/api/admin/master/subscription", {
    data: { restaurantKey: restaurant.key, plan: "PREMIUM", status: "ACTIVE" },
  });
  expect(activate.status(), JSON.stringify(await activate.json())).toBe(200);
  // Mensalidade lançada há 15 dias e não paga -> em atraso.
  const charged = await master.api.post(`/api/system/restaurants/${restaurant.key}/ledger`, {
    data: {
      type: "SUBSCRIPTION",
      amountCents: 34900,
      description: "Mensalidade de teste",
      idempotencyKey: `teste-mensal-${restaurant.key}`,
      occurredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
  });
  expect(charged.status()).toBe(200);

  const billing = (await (await master.api.get("/api/system/billing")).json()).data;
  const row = billing.restaurants.find((entry) => entry.restaurantKey === restaurant.key);
  expect(row).toMatchObject({ situation: "OVERDUE", owedCents: 34900, contractStatus: "ACTIVE" });
  expect(billing.summary.overdue).toBeGreaterThanOrEqual(1);

  // Tela: filtra "Em atraso" e registra o pagamento.
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `127.95.${Math.floor(Math.random() * 200)}.7` } });
  const page = await context.newPage();
  await page.goto("/system/login.html");
  await page.getByLabel("E-mail").fill(process.env.E2E_ADMIN_LOGIN);
  await page.getByLabel("Senha").fill(process.env.E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/system\/?$/);
  await page.goto("/system#billing");
  await expect(page.getByRole("heading", { name: "Mensalidades e repasses" })).toBeVisible();
  await page.locator('[data-billing-filter="OVERDUE"]').click();
  const line = page.locator(`[data-billing-row="${restaurant.key}"]`);
  await expect(line).toContainText("Em atraso");
  await expect(line).toContainText("R$ 349,00");
  page.once("dialog", (dialog) => dialog.accept("349,00"));
  await line.locator("[data-billing-pay]").click();
  await page.locator('[data-billing-filter=""]').click();
  await expect(page.locator(`[data-billing-row="${restaurant.key}"]`)).toContainText("Em dia");

  // Ciclo trimestral: R$ 349 x 3 = R$ 1.047 - R$ 15 = R$ 1.032.
  const cycleSelect = page.locator(`[data-billing-cycle="${restaurant.key}"]`);
  await expect(cycleSelect.locator('option[value="QUARTERLY"]')).toHaveText("Trimestral · R$ 1.032,00 (−R$ 15,00)");
  await expect(cycleSelect.locator('option[value="ANNUAL"]')).toHaveText("Anual · R$ 3.852,96 (−R$ 335,04)");
  const saved = page.waitForResponse((response) => response.url().includes("/api/admin/master/subscription"));
  await cycleSelect.selectOption("QUARTERLY");
  expect((await saved).status()).toBe(200);
  await expect(page.locator(`[data-billing-cycle="${restaurant.key}"]`)).toHaveValue("QUARTERLY");
  const after = (await (await master.api.get("/api/system/billing")).json()).data.restaurants.find((entry) => entry.restaurantKey === restaurant.key);
  expect(after.billingCycle).toBe("QUARTERLY");
  expect(after.cycleCharge).toMatchObject({ totalCents: 103200, discountCents: 1500, months: 3 });

  await context.close();
  await master.api.dispose();
});
