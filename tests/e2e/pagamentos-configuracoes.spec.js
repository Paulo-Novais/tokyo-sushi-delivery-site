const { test, expect } = require("@playwright/test");
const {
  createApiContext,
  loginAdmin,
  loginMaster,
  loginTenantOwner,
  onboardRestaurant,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");

// Configurações > Pagamentos e repasses: conta bancária obrigatória (só o
// dono altera, dados mascarados), escolha das formas online e taxas.

test("Pagamentos e repasses: aviso obrigatório, conta só do dono, formas e taxas", async ({ browser }) => {
  test.setTimeout(150_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("pagconfig"),
    name: "Restaurante Config Pagamento",
    ownerPassword: "OwnerPagConfig123!",
  });
  const owner = await loginTenantOwner(restaurant);

  // Sem conta: não deixa ativar formas online.
  const early = await owner.api.post("/api/admin/payment-settings/save", { data: { enabledMethods: ["pix"] } });
  expect(early.status()).toBe(409);
  expect((await early.json()).errorCode).toBe("payment_bank_required");

  // Dados inválidos são recusados com explicação.
  const invalid = await owner.api.post("/api/admin/payment-settings/save", {
    data: { bankAccount: { holderName: "X", holderDocument: "11111111111", bankCode: "1", accountNumber: "" } },
  });
  expect(invalid.status()).toBe(400);
  expect((await invalid.json()).error).toContain("CPF ou CNPJ");

  // Funcionário com permissão de configurações não troca a conta bancária.
  const staffLogin = `config.${restaurant.key}@inovas.local`;
  const created = await owner.api.post("/api/tenant/users", {
    data: { email: staffLogin, name: "Gerente", password: "GerenteConfig123!", role: "MANAGER", credentialMode: "TEMPORARY_PASSWORD" },
  });
  expect(created.status(), JSON.stringify(await created.json().catch(() => ({})))).toBe(201);
  {
    const staff = await createApiContext();
    await loginAdmin(staff, { identifier: staffLogin, password: "GerenteConfig123!" });
    const staffTry = await staff.post("/api/admin/payment-settings/save", {
      data: { bankAccount: { holderName: "Golpe", holderDocument: "529.982.247-25", holderEmail: "a@b.co", holderPhone: "11999990000", bankCode: "260", branchNumber: "1", accountNumber: "1", accountCheckDigit: "1" } },
    });
    expect(staffTry.status()).toBe(403);
    await staff.dispose();
  }

  // Tela: aviso obrigatório no topo e aba Pagamentos e repasses.
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `127.93.${Math.floor(Math.random() * 200)}.5` } });
  const page = await context.newPage();
  await page.goto("/admin/login.html?next=%2Fadmin%2F");
  await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-payment-required-banner]")).toContainText("Obrigatório");

  await page.goto("/admin/?section=settings&tab=payments");
  const slot = page.locator("[data-payment-settings-slot]");
  await expect(slot).toContainText("Conta bancária para os repasses");
  await expect(slot.locator("[data-pay-status]")).toHaveText("Conta não cadastrada");
  await slot.locator('[data-pay-field="holderName"]').fill("Restaurante Config Pagamento LTDA");
  await slot.locator('[data-pay-field="holderDocument"]').fill("11.222.333/0001-81");
  await slot.locator('[data-pay-field="holderEmail"]').fill("financeiro@config.test");
  await slot.locator('[data-pay-field="holderPhone"]').fill("(16) 98888-7777");
  await slot.locator('[data-pay-field="bankCode"]').selectOption("260");
  await slot.locator('[data-pay-field="branchNumber"]').fill("0001");
  await slot.locator('[data-pay-field="accountNumber"]').fill("1234567");
  await slot.locator('[data-pay-field="accountCheckDigit"]').fill("8");
  await slot.locator('[data-pay-action="save-bank"]').click();
  await expect(slot).toContainText("Conta bancária salva");
  await expect(slot.locator("[data-pay-status]")).toHaveText("Ativa para receber");
  // Mascarado: não mostra o CNPJ nem a conta inteiros.
  await expect(slot).toContainText("11.•••.•••/••••-81");
  await expect(slot).not.toContainText("1234567");
  await expect(page.locator("[data-payment-required-banner]")).toHaveCount(0);

  // Ativa Pix e Crédito; o site passa a oferecer só essas.
  await slot.locator('label:has([data-pay-method="pix"])').click();
  await slot.locator('label:has([data-pay-method="credit_card"])').click();
  await slot.locator('[data-pay-action="save-methods"]').click();
  await expect(slot).toContainText("Formas de pagamento online atualizadas");
  await expect(slot).toContainText("Taxas e quanto você recebe");

  const site = await createApiContext({ host: restaurant.host });
  const methods = await (await site.get("/api/payments/methods")).json();
  expect(methods.methods.map((method) => method.id)).toEqual(["pix", "credit_card"]);

  await site.dispose();
  await context.close();
  await owner.api.dispose();
  await master.api.dispose();
});
