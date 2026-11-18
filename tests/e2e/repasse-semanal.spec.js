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
  await page.goto("/admin/login.html?next=%2Fadmin%2F");
  await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForLoadState("networkidle");
  await page.goto("/admin/?section=finance");
  const block = page.locator("[data-admin-payout]");
  await expect(block).toContainText("Repasse do pagamento online");
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
