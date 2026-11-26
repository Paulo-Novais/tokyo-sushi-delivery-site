const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");

process.env.INOVAS_FISCAL_INVOICES_FILE = path.join(os.tmpdir(), `nfce-${process.pid}-${Date.now()}.json`);
delete process.env.DATABASE_URL;

const { buildNfcePayload, emitInvoiceForOrder, cancelInvoiceForOrder, getFiscalReadiness } = require("../../lib/fiscal-invoices.cjs");
const { normalizeFiscalSettings, getMissingFiscalFields } = require("../../lib/fiscal-settings.cjs");
const { fromFocus } = require("../../lib/fiscal-provider.cjs");

const fiscal = normalizeFiscalSettings({
  legalName: "Kasulo Rocha Pizzaria LTDA",
  cnpj: "12.345.678/0001-90",
  stateRegistration: "123456789",
  crt: 1,
  cscId: "1",
  companyRegistered: true,
});
const order = {
  id: "ord-1",
  publicId: "TK-1",
  status: "Entregue",
  fulfillmentMode: "delivery",
  paymentMethod: "pix",
  deliveryFee: 9,
  totalAmount: 79.8,
  items: [
    { id: "pizza-calabresa", name: "Pizza Calabresa", category: "Pizzas Salgadas", quantity: 1, unitPrice: 59.9, totalPrice: 59.9 },
    { id: "coca", name: "Coca-Cola 2L", category: "Bebidas", quantity: 1, unitPrice: 14.9, totalPrice: 14.9 },
  ],
};

test("dados fiscais: limpa CNPJ, padrões de restaurante e o que falta", () => {
  assert.equal(fiscal.cnpj, "12345678000190");
  assert.equal(fiscal.ncmFood, "21069090");
  assert.equal(fiscal.cfop, "5102");
  assert.equal(fiscal.icmsCst, "102");
  assert.deepEqual(getMissingFiscalFields(normalizeFiscalSettings({})), [
    "CNPJ",
    "Razão social",
    "Inscrição estadual",
    "ID do CSC",
    "Certificado digital A1 e CSC enviados ao emissor",
  ]);
  assert.equal(normalizeFiscalSettings({ crt: 3 }).icmsCst, "00");
});

test("nota: NCM de comida e bebida, frete, desconto e Pix", () => {
  const payload = buildNfcePayload({ order, fiscal });
  assert.equal(payload.cnpj_emitente, "12345678000190");
  assert.equal(payload.presenca_comprador, 4);
  assert.equal(payload.items[0].codigo_ncm, "21069090");
  assert.equal(payload.items[1].codigo_ncm, "22021000");
  assert.equal(payload.valor_frete, 9);
  assert.equal(payload.valor_desconto, 4); // 59,90 + 14,90 + 9 - 79,80
  assert.deepEqual(payload.formas_pagamento, [{ forma_pagamento: "17", valor_pagamento: 79.8 }]);
});

test("nota: NCM/CFOP do próprio item vencem o padrão; retirada é presencial", () => {
  const items = new Map([["coca", { ncm: "22029900", cfop: "5405", sectionTitle: "Bebidas" }]]);
  const payload = buildNfcePayload({ order: { ...order, fulfillmentMode: "pickup", deliveryFee: 0, totalAmount: 74.8, paymentMethod: "dinheiro" }, fiscal, catalogItems: items });
  assert.equal(payload.items[1].codigo_ncm, "22029900");
  assert.equal(payload.items[1].cfop, "5405");
  assert.equal(payload.presenca_comprador, 1);
  assert.equal(payload.valor_frete, undefined);
  assert.equal(payload.formas_pagamento[0].forma_pagamento, "01");
});

test("resposta da Focus NFe vira o formato do sistema", () => {
  const result = fromFocus({ status: "autorizado", numero: "15", serie: "1", chave_nfe: "NFe35261112345678000190650010000000151000000150", caminho_danfe: "/notas/x.html" });
  assert.equal(result.status, "AUTHORIZED");
  assert.equal(result.accessKey.length, 44);
  assert.match(result.danfeUrl, /^https:\/\/homologacao\.focusnfe\.com\.br\/notas\/x\.html$/);
  assert.equal(fromFocus({ status: "erro_autorizacao", mensagem_sefaz: "Rejeição" }).status, "REJECTED");
});

const tenantContext = { tenantId: "t-kasulo", restaurantId: "r-kasulo", restaurantKey: "kasulo" };
const deps = (plan = "PRO", fiscalData = fiscal) => ({
  settingsStore: { getAdminRestaurantSettings: async () => ({ settings: { fiscal: fiscalData } }) },
  master: { getRestaurantBillingByKey: async () => ({ plan }) },
  orders: { getAdminOrderDetails: async () => ({ order }) },
  catalog: { getCatalogValidationContext: async () => ({ itemMap: new Map() }) },
});

test("pronto para emitir: plano, serviço da INOVAS e dados do restaurante", async () => {
  delete process.env.FISCAL_PROVIDER;
  let readiness = await getFiscalReadiness({ tenantContext, deps: deps() });
  assert.equal(readiness.ready, false);
  assert.match(readiness.blockers.join(" "), /ativando o serviço emissor/);
  process.env.FISCAL_PROVIDER = "fake";
  readiness = await getFiscalReadiness({ tenantContext, deps: deps("START") });
  assert.match(readiness.blockers.join(" "), /Profissional ou Completo/);
  readiness = await getFiscalReadiness({ tenantContext, deps: deps("PRO") });
  assert.equal(readiness.ready, true);
});

test("emite uma vez só por pedido e cancela junto com o pedido", async () => {
  process.env.FISCAL_PROVIDER = "fake";
  const first = await emitInvoiceForOrder({ tenantContext, orderId: "ord-1", deps: deps() });
  assert.equal(first.invoice.status, "AUTHORIZED");
  assert.equal(first.invoice.amountCents, 7980);
  assert.equal(first.invoice.accessKey.length, 44);
  const again = await emitInvoiceForOrder({ tenantContext, orderId: "ord-1", deps: deps() });
  assert.equal(again.replayed, true);
  assert.equal(again.invoice.id, first.invoice.id);
  const canceled = await cancelInvoiceForOrder({ tenantContext, orderId: "ord-1", reason: "Cliente desistiu do pedido" });
  assert.equal(canceled.canceled, true);
  assert.equal(canceled.invoice.status, "CANCELED");
  // Depois de cancelada, pode emitir de novo (nova referência).
  const reissued = await emitInvoiceForOrder({ tenantContext, orderId: "ord-1", deps: deps() });
  assert.notEqual(reissued.invoice.id, first.invoice.id);
});

test("sem estar pronto, emitir explica o que falta", async () => {
  process.env.FISCAL_PROVIDER = "fake";
  await assert.rejects(
    emitInvoiceForOrder({ tenantContext, orderId: "ord-1", deps: deps("PRO", normalizeFiscalSettings({ cnpj: "1" })) }),
    (error) => error.errorCode === "fiscal_not_ready" && /CNPJ/.test(error.message)
  );
});
