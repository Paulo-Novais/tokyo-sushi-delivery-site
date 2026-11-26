const { test, expect } = require("@playwright/test");
const {
  createPublicOrder,
  hostForKey,
  loginMaster,
  loginTenantOwner,
  onboardRestaurant,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");

// Nota fiscal (NFC-e) com o emissor simulado do servidor de testes:
// Gestor > Configurações > Nota fiscal mostra o que falta; com os dados
// completos o pedido entregue sai com nota sozinho; cancelar o pedido cancela a
// nota; plano Essencial não emite.

const FISCAL = {
  legalName: "Pizzaria Teste Nota LTDA",
  cnpj: "11.222.333/0001-81",
  stateRegistration: "123.456.789.110",
  crt: "1",
  series: "1",
  cscId: "000001",
  autoEmit: true,
};

test("Nota fiscal: configura, emite sozinha ao entregar, cancela junto com o pedido", async ({ browser }) => {
  test.setTimeout(180_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, {
    key: uniqueKey("notafiscal"),
    name: "Pizzaria Nota",
    ownerPassword: "OwnerNota123!",
  });
  const host = hostForKey(restaurant.key);
  const { api } = await loginTenantOwner({ ...restaurant, host });

  // Sem dados: pendente e explica o que falta.
  let status = await (await api.get("/api/admin/settings/fiscal")).json();
  expect(status.readiness.ready).toBe(false);
  expect(status.readiness.missing).toEqual(expect.arrayContaining(["CNPJ", "Inscrição estadual"]));

  // Tela: preenche os dados da empresa e envia certificado + CSC.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": `127.73.${Math.floor(Math.random() * 200)}.5` } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/login");
  await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForLoadState("networkidle");
  await page.goto("/admin/?section=settings&tab=fiscal");
  const slot = page.locator("[data-fiscal-slot]");
  await expect(slot).toContainText("Falta preencher");
  for (const [name, value] of Object.entries(FISCAL)) {
    if (name === "crt" || name === "autoEmit") continue;
    await slot.locator(`[data-fiscal-field="${name}"]`).fill(value);
  }
  await slot.locator('[data-fiscal-secret="cscToken"]').fill("ABCDEF1234567890ABCDEF1234567890");
  await slot.locator("[data-fiscal-certificate]").setInputFiles({ name: "certificado.pfx", mimeType: "application/x-pkcs12", buffer: Buffer.from("certificado-de-teste") });
  await slot.locator('[data-fiscal-secret="certificatePassword"]').fill("senha-do-certificado");
  await slot.locator('[data-fiscal-action="save"]').click();
  await expect(page.locator("[data-fiscal-message]")).toContainText("Nota fiscal pronta");
  await expect(page.locator("[data-fiscal-status]")).toHaveText("Pronta para emitir");
  if (process.env.FISCAL_SHOT_DIR) await page.screenshot({ path: `${process.env.FISCAL_SHOT_DIR}/nota-fiscal-config.png`, fullPage: true });
  expect(pageErrors).toEqual([]);

  // Nada secreto foi guardado nas configurações do restaurante.
  const settings = JSON.stringify((await (await api.get("/api/admin/settings/list")).json()).settings || {});
  expect(settings).not.toContain("ABCDEF1234567890");
  expect(settings).not.toContain("senha-do-certificado");
  expect(settings).toContain("11222333000181");

  // Pedido entregue: nota sai sozinha.
  expect((await api.get("/api/admin/orders/list?limit=5")).status()).toBe(200);
  const order = await createPublicOrder({ host, label: `${restaurant.key}-nota` });
  const setStatus = async (value, note = "") => {
    const response = await api.post("/api/admin/orders/status", { data: { orderId: order.id, status: value, note, manual: true } });
    const body = await response.json();
    expect(response.status(), JSON.stringify(body)).toBe(200);
    return body;
  };
  for (const value of ["Aceito", "Em preparo", "Pronto"]) await setStatus(value);
  const done = await setStatus("Retirada concluida");
  expect(done.fiscal).toMatchObject({ status: "AUTHORIZED" });
  let invoice = await (await api.get(`/api/admin/orders/invoice?orderId=${encodeURIComponent(order.id)}`)).json();
  expect(invoice.invoices).toHaveLength(1);
  expect(invoice.invoices[0]).toMatchObject({ status: "AUTHORIZED", environment: "homologacao" });
  expect(invoice.invoices[0].accessKey).toHaveLength(44);
  // Emitir de novo não duplica.
  const again = await (await api.post("/api/admin/orders/invoice-emit", { data: { orderId: order.id } })).json();
  expect(again.replayed, JSON.stringify(again)).toBe(true);

  // Lista de notas na tela.
  await page.reload();
  await expect(page.locator("[data-fiscal-invoices]")).toContainText("Autorizada");

  // Cancelar a nota pelo botão do pedido (cancelamento manual).
  const canceled = await (await api.post("/api/admin/orders/invoice-cancel", { data: { orderId: order.id, reason: "Cliente pediu o cancelamento da compra" } })).json();
  expect(canceled.canceled, JSON.stringify(canceled)).toBe(true);
  invoice = await (await api.get(`/api/admin/orders/invoice?orderId=${encodeURIComponent(order.id)}`)).json();
  expect(invoice.invoices[0].status).toBe("CANCELED");

  // Outro pedido cancelado no Gestor depois de emitido: nota cancelada junto.
  const second = await createPublicOrder({ host, label: `${restaurant.key}-nota2` });
  await api.post("/api/admin/orders/invoice-emit", { data: { orderId: second.id } }).then(async (response) => {
    // Pedido ainda não concluído pode ter nota emitida à mão (ex.: salão).
    expect(response.status()).toBe(200);
  });
  const cancelOrder = await (await api.post("/api/admin/orders/status", { data: { orderId: second.id, status: "Cancelado", note: "Cliente desistiu", manual: true } })).json();
  expect(cancelOrder.fiscal).toMatchObject({ status: "CANCELED" });

  // Plano Essencial: não emite e explica.
  const essential = await master.api.post("/api/admin/master/subscription", { data: { restaurantKey: restaurant.key, plan: "START", status: "ACTIVE" } });
  expect(essential.status()).toBe(200);
  const essentialStatus = await api.get("/api/admin/settings/fiscal");
  status = await essentialStatus.json();
  expect(essentialStatus.status()).toBe(403);
  expect(status.errorCode).toBe("plan_feature_forbidden");
  const essentialEmit = await api.post("/api/admin/orders/invoice-emit", { data: { orderId: order.id } });
  expect(essentialEmit.status()).toBe(409);
  expect((await essentialEmit.json()).error).toContain("Profissional ou Completo");

  // Outro restaurante não vê as notas deste.
  const other = await onboardRestaurant(master.api, { key: uniqueKey("notafiscalb"), ownerPassword: "OwnerNotaB123!" });
  const otherOwner = await loginTenantOwner({ ...other, host: hostForKey(other.key) });
  const otherList = await (await otherOwner.api.get("/api/admin/settings/fiscal")).json();
  expect(otherList.invoices).toEqual([]);
  const otherOrder = await (await otherOwner.api.get(`/api/admin/orders/invoice?orderId=${encodeURIComponent(order.id)}`)).json();
  expect(otherOrder.invoices).toEqual([]);

  await otherOwner.api.dispose();
  await context.close();
  await api.dispose();
  await master.api.dispose();
});

test("Aba NFC-e: modo 'Eu escolho', emitir vários, não emitir e desfazer", async ({ browser }) => {
  test.setTimeout(180_000);
  const master = await loginMaster();
  const restaurant = await onboardRestaurant(master.api, { key: uniqueKey("nfceaba"), name: "Pizzaria Aba", ownerPassword: "OwnerAba123!" });
  const host = hostForKey(restaurant.key);
  const { api } = await loginTenantOwner({ ...restaurant, host });
  const saved = await api.post("/api/admin/settings/fiscal-save", {
    data: { ...FISCAL, cscToken: "ABCDEF1234567890ABCDEF1234567890", certificateBase64: Buffer.from("cert").toString("base64"), certificatePassword: "senha" },
  });
  expect(saved.status()).toBe(200);
  expect((await api.get("/api/admin/orders/list?limit=5")).status()).toBe(200);
  const orders = [];
  for (const label of ["a", "b", "c"]) orders.push(await createPublicOrder({ host, label: `${restaurant.key}-${label}` }));

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": `127.75.${Math.floor(Math.random() * 200)}.5` } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/login");
  await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
  await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForLoadState("networkidle");
  // Menu: item NFC-e em Resultados, junto dos outros.
  const navItem = page.locator('.admin-nav [data-admin-section="fiscal"]');
  await expect(navItem).toBeVisible();
  await expect(navItem).toContainText("NFC-e");
  await navItem.click();
  const root = page.locator("[data-nf-root]");
  await expect(root).toBeVisible();
  await expect(page.locator('[data-nf-kpi="none"]')).toHaveText("3");

  // Modo "Eu escolho".
  await root.locator('[data-nf-mode="manual"]').click();
  await expect(page.locator("[data-nf-notice]")).toContainText("você escolhe");
  expect((await (await api.get("/api/admin/settings/fiscal")).json()).readiness.fiscal.autoEmit).toBe(false);

  // Seleciona 2 e emite; o terceiro marca "Não emitir".
  await root.locator(`[data-nf-check="${orders[0].id}"]`).check();
  await root.locator(`[data-nf-check="${orders[1].id}"]`).check();
  await expect(page.locator("[data-nf-bulk]")).toContainText("2 pedidos selecionados");
  if (process.env.FISCAL_SHOT_DIR) await page.screenshot({ path: `${process.env.FISCAL_SHOT_DIR}/nfce-aba-selecao.png` });
  await page.locator("[data-nf-bulk-emit]").click();
  await expect(page.locator("[data-nf-notice]")).toContainText("2 notas autorizadas");
  await expect(page.locator('[data-nf-kpi="ok"]')).toHaveText("2");
  await root.locator(`[data-nf-skip="${orders[2].id}"]`).click();
  await expect(page.locator('[data-nf-kpi="skip"]')).toHaveText("1");
  await expect(page.locator(`[data-nf-row="${orders[2].id}"]`)).toContainText("Não emitir");

  // Pedido marcado "Não emitir" não sai sozinho mesmo no automático.
  await root.locator('[data-nf-mode="auto"]').click();
  await expect(page.locator("[data-nf-notice]")).toContainText("automática");
  for (const value of ["Aceito", "Em preparo", "Pronto", "Retirada concluida"]) {
    await api.post("/api/admin/orders/status", { data: { orderId: orders[2].id, status: value, manual: true } });
  }
  let list = await (await api.get("/api/admin/orders/fiscal-list?period=today")).json();
  expect(list.orders.find((row) => row.id === orders[2].id).invoice.status).toBe("SKIPPED");

  // Desfazer e emitir.
  await page.goto("/admin/");
  await page.locator('.admin-nav [data-admin-section="fiscal"]').click();
  await page.locator(`[data-nf-unskip="${orders[2].id}"]`).click();
  await expect(page.locator(`[data-nf-row="${orders[2].id}"]`)).toContainText("Sem nota");
  await page.locator(`[data-nf-emit="${orders[2].id}"]`).click();
  await expect(page.locator(`[data-nf-row="${orders[2].id}"]`)).toContainText("Autorizada");
  if (process.env.FISCAL_SHOT_DIR) await page.screenshot({ path: `${process.env.FISCAL_SHOT_DIR}/nfce-aba-final.png` });
  list = await (await api.get("/api/admin/orders/fiscal-list?period=today")).json();
  expect(list.orders.filter((row) => row.invoice?.status === "AUTHORIZED")).toHaveLength(3);
  expect(pageErrors).toEqual([]);

  // Plano Essencial: item com cadeado do Profissional.
  await master.api.post("/api/admin/master/subscription", { data: { restaurantKey: restaurant.key, plan: "START", status: "ACTIVE" } });
  await page.goto("/admin/?section=dashboard");
  await expect(page.locator('.admin-nav [data-admin-section="fiscal"]')).toContainText("Profissional");

  await context.close();
  await api.dispose();
  await master.api.dispose();
});
