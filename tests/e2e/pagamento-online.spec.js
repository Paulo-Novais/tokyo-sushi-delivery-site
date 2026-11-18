const { test, expect } = require("@playwright/test");
const {
  baseURL,
  createApiContext,
  createTenantBrowserContext,
  loginMaster,
  loginTenantOwner,
  onboardRestaurant,
  orderPayload,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");

// Pagamento online (modelo iFood) com o provedor de TESTE (simula a Stone):
// cobra antes, cria o pedido só depois do pagamento aprovado, lança venda e
// taxa no extrato, devolve ao cancelar e nunca duplica.

const postJson = (api, url, data) =>
  api.post(url, { headers: { Origin: baseURL, Referer: `${baseURL}/` }, data });

test("Pagamento online: Pix aprovado vira pedido pago; cancelar devolve; recusado não cria pedido", async ({ browser }) => {
  test.setTimeout(180_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("pagonline"),
    name: "Restaurante Pagamento Online",
    ownerPassword: "OwnerPagOnline123!",
  });
  const owner = await loginTenantOwner(restaurant);
  const site = await createApiContext({ host: restaurant.host });

  // Sem conta bancária e sem escolha do dono: o site não oferece pagamento online.
  expect((await (await site.get("/api/payments/methods")).json()).enabled).toBe(false);
  const bank = await owner.api.post("/api/admin/payment-settings/save", {
    data: {
      bankAccount: {
        holderName: "Restaurante Pagamento Online LTDA",
        holderDocument: "11.222.333/0001-81",
        holderEmail: "financeiro@restaurante.test",
        holderPhone: "(16) 99999-0000",
        bankCode: "341",
        branchNumber: "1234",
        accountNumber: "567890",
        accountCheckDigit: "1",
        accountType: "checking",
      },
    },
  });
  expect(bank.status(), JSON.stringify(await bank.json())).toBe(200);
  const enable = await owner.api.post("/api/admin/payment-settings/save", {
    data: { enabledMethods: ["pix", "credit_card", "debit_card", "meal_voucher"] },
  });
  expect((await enable.json()).settings.enabledMethods).toHaveLength(4);

  // Formas online ativas (provedor de teste).
  const methods = await (await site.get("/api/payments/methods")).json();
  expect(methods.enabled).toBe(true);
  expect(methods.methods.map((method) => method.id)).toEqual(["pix", "credit_card", "debit_card", "meal_voucher"]);

  const listOrders = async () => (await (await owner.api.get("/api/admin/orders/list?limit=80")).json()).orders || [];
  const ordersBefore = (await listOrders()).length;

  // Preço adulterado no navegador não muda a cobrança: vale o cardápio do servidor.
  const payload = orderPayload("pagonline-pix");
  payload.items[0].price = 1;
  payload.checkout.onlinePaymentMethod = "pix";
  payload.checkout.returnPath = "/cardapio.html";
  const checkoutResponse = await postJson(site, "/api/payments/checkout", payload);
  const checkout = await checkoutResponse.json();
  expect(checkoutResponse.status(), JSON.stringify(checkout)).toBe(200);
  expect(checkout.amountCents).toBe(5850);
  expect(checkout.checkoutUrl).toContain("/pagamento-teste.html?payment=");
  const providerOrderId = new URL(checkout.checkoutUrl, baseURL).searchParams.get("order");

  // Antes de pagar: nada no Gestor.
  const pending = await (await site.get(`/api/payments/status?payment=${checkout.paymentId}`)).json();
  expect(pending.status).toBe("PENDING");
  expect((await listOrders()).length).toBe(ordersBefore);

  // Cliente paga (simulado). Aviso repetido não duplica o pedido.
  const paid = await (await postJson(site, "/api/payments/test-simulate", { providerOrderId, outcome: "paid" })).json();
  expect(paid.status).toBe("PAID");
  expect(paid.returnUrl).toBe(`/cardapio.html?pagamento=${checkout.paymentId}`);
  await postJson(site, "/api/payments/test-simulate", { providerOrderId, outcome: "paid" });
  const status = await (await site.get(`/api/payments/status?payment=${checkout.paymentId}`)).json();
  expect(status.status).toBe("PAID");
  expect(status.orderPublicId).toBeTruthy();
  const ordersAfter = await listOrders();
  expect(ordersAfter.length).toBe(ordersBefore + 1);
  const order = ordersAfter.find((entry) => String(entry.publicId) === String(status.orderPublicId));
  expect(order).toBeTruthy();
  expect(order.paymentMethod).toBe("pix");

  // Extrato: venda + taxa do Pix.
  const statement = (await (await owner.api.get("/api/admin/payouts/statement")).json()).statement;
  expect(statement.totals.grossSalesCents).toBe(5850);
  expect(statement.totals.feesCents).toBe(58);
  // Pix: sem taxa INOVAS (só a da operadora).
  expect(statement.totals.platformFeesCents).toBe(0);
  expect(statement.netCents).toBe(5850 - 58);
  expect(statement.lines.map((line) => line.label)).toEqual(
    expect.arrayContaining(["Vendas Pix (1 pedido)", "Taxa Pix"])
  );

  // Tela de volta do cliente: banner de aprovado.
  const context = await createTenantBrowserContext(browser, { host: restaurant.host });
  const page = await context.newPage();
  await page.goto(`/cardapio.html?pagamento=${checkout.paymentId}`);
  await expect(page.locator("[data-online-payment-banner]")).toContainText("Pagamento aprovado");
  await context.close();

  // Restaurante cancela: valor devolvido e devolução no extrato.
  const cancel = await owner.api.post("/api/admin/orders/status", {
    data: { orderId: order.id, status: "Cancelado", note: "Sem ingrediente", manual: true },
  });
  const cancelBody = await cancel.json();
  expect(cancel.status(), JSON.stringify(cancelBody)).toBe(200);
  expect(cancelBody.onlineRefund).toMatchObject({ refunded: true });
  const afterRefund = (await (await owner.api.get("/api/admin/payouts/statement")).json()).statement;
  expect(afterRefund.totals.refundsCents).toBe(5850);
  // Só a taxa da operadora fica.
  expect(afterRefund.netCents).toBe(-58);
  expect((await (await site.get(`/api/payments/status?payment=${checkout.paymentId}`)).json()).status).toBe("REFUNDED");

  // Crédito aprovado: taxa INOVAS de 1,5% (R$ 58,50 -> R$ 0,88).
  const cardPayload = orderPayload("pagonline-credito");
  cardPayload.checkout.onlinePaymentMethod = "credit_card";
  const card = await (await postJson(site, "/api/payments/checkout", cardPayload)).json();
  const cardOrder = new URL(card.checkoutUrl, baseURL).searchParams.get("order");
  expect((await (await postJson(site, "/api/payments/test-simulate", { providerOrderId: cardOrder, outcome: "paid" })).json()).status).toBe("PAID");
  const withCard = (await (await owner.api.get("/api/admin/payouts/statement")).json()).statement;
  expect(withCard.totals.platformFeesCents).toBe(88);
  expect(withCard.lines.map((line) => line.label)).toContain("Taxa INOVAS (1,5% em cartão e vale; Pix sem taxa)");

  // VR/VA recusado: nenhum pedido criado.
  const voucherPayload = orderPayload("pagonline-vale");
  voucherPayload.checkout.onlinePaymentMethod = "meal_voucher";
  const voucher = await (await postJson(site, "/api/payments/checkout", voucherPayload)).json();
  const voucherOrderId = new URL(voucher.checkoutUrl, baseURL).searchParams.get("order");
  const refused = await (await postJson(site, "/api/payments/test-simulate", { providerOrderId: voucherOrderId, outcome: "failed" })).json();
  expect(refused.status).toBe("FAILED");
  expect((await listOrders()).length).toBe(ordersBefore + 2);

  // Forma inválida, rota da rotina sem segredo e retorno para outro site.
  const invalid = orderPayload("pagonline-invalido");
  invalid.checkout.onlinePaymentMethod = "dinheiro";
  expect((await postJson(site, "/api/payments/checkout", invalid)).status()).toBe(400);
  expect((await site.get("/api/payments/cron-payouts")).status()).toBe(401);
  const evil = orderPayload("pagonline-retorno");
  evil.checkout.onlinePaymentMethod = "credit_card";
  evil.checkout.returnPath = "//site-malicioso.com/x";
  const evilCheckout = await (await postJson(site, "/api/payments/checkout", evil)).json();
  const evilOrder = new URL(evilCheckout.checkoutUrl, baseURL).searchParams.get("order");
  const evilPaid = await (await postJson(site, "/api/payments/test-simulate", { providerOrderId: evilOrder, outcome: "paid" })).json();
  expect(evilPaid.returnUrl.startsWith("/?pagamento=")).toBe(true);

  await site.dispose();
  await owner.api.dispose();
  await master.api.dispose();
});
