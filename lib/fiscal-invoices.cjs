"use strict";

// NFC-e do pedido: confere se o restaurante pode emitir, monta a nota a partir
// do pedido, pede ao emissor e guarda o resultado. Cancela junto com o pedido.

const crypto = require("node:crypto");
const { buildHttpError } = require("./http.cjs");
const { getFiscalEnvironment, getFiscalProvider, getFiscalProviderName } = require("./fiscal-provider.cjs");
const { createInvoice, listInvoicesForOrder, listRecentInvoices, updateInvoice } = require("./fiscal-invoice-store.cjs");
const { getMissingFiscalFields, normalizeFiscalSettings } = require("./fiscal-settings.cjs");

// Nota fiscal inclusa no Profissional e no Completo (tabela de 25/11/2026).
const FISCAL_PLANS = Object.freeze(["BUSINESS", "PRO", "PREMIUM"]);
const DRINK_PATTERN = /bebida|refrigerante|refri\b|suco|cerveja|[aá]gua|ch[aá] gelado|energ[eé]tico|vinho|drink|long neck|lata/i;

// Formas de pagamento do sistema -> código da NFC-e (tPag).
const PAYMENT_CODES = Object.freeze({
  dinheiro: "01",
  credito: "03",
  credit_card: "03",
  debito: "04",
  debit_card: "04",
  vale: "10",
  meal_voucher: "10",
  pix: "17",
});

const money = (value) => Math.round(Number(value || 0) * 100) / 100;
const tenantOf = (tenantContext) => ({
  tenantId: tenantContext.tenantId,
  restaurantId: tenantContext.restaurantId,
  restaurantKey: tenantContext.restaurantKey,
});

const loadDeps = () => ({
  settingsStore: require("./restaurant-settings-store.cjs"),
  master: require("./master-platform-store.cjs"),
  orders: require("./order-store.cjs"),
  catalog: require("./catalog-store.cjs"),
});

// O que falta para emitir: serviço da INOVAS, plano, dados do restaurante, banco.
const getFiscalReadiness = async ({ tenantContext, deps = loadDeps() } = {}) => {
  const [settings, billing] = await Promise.all([
    deps.settingsStore.getAdminRestaurantSettings({ tenantContext }),
    deps.master.getRestaurantBillingByKey(tenantContext.restaurantKey).catch(() => null),
  ]);
  const fiscal = normalizeFiscalSettings(settings.settings?.fiscal);
  const plan = String(billing?.plan || "").toUpperCase();
  const providerActive = Boolean(getFiscalProviderName());
  let storageReady = true;
  try {
    await listRecentInvoices(tenantOf(tenantContext), 1);
  } catch (error) {
    if (error?.errorCode === "fiscal_storage_unavailable") storageReady = false;
    else throw error;
  }
  const missing = getMissingFiscalFields(fiscal);
  const blockers = [];
  if (!FISCAL_PLANS.includes(plan)) blockers.push("A nota fiscal faz parte do plano Profissional ou Completo.");
  if (!providerActive) blockers.push("A INOVAS ainda está ativando o serviço emissor de notas.");
  if (!storageReady) blockers.push("Atualização do banco de notas pendente (INOVAS).");
  if (missing.length) blockers.push(`Falta preencher: ${missing.join(", ")}.`);
  return {
    ready: blockers.length === 0,
    planAllowed: FISCAL_PLANS.includes(plan),
    providerActive,
    provider: getFiscalProviderName() || "",
    environment: getFiscalEnvironment(),
    storageReady,
    missing,
    blockers,
    fiscal,
  };
};

// Pedido -> NFC-e (formato da Focus NFe v2).
const buildNfcePayload = ({ order, fiscal, catalogItems = new Map(), now = new Date() }) => {
  const items = (Array.isArray(order.items) ? order.items : []).filter((item) => Number(item.quantity) > 0);
  if (!items.length) throw buildHttpError(400, "Pedido sem itens para a nota.", "fiscal_order_empty");
  const lines = items.map((item, index) => {
    const quantity = Number(item.quantity) || 1;
    const total = money(item.totalPrice ?? Number(item.unitPrice || 0) * quantity);
    const unit = money(total / quantity);
    const catalogItem = catalogItems.get(String(item.id || item.productId || "")) || {};
    const label = `${item.name || ""} ${item.category || ""} ${catalogItem.sectionTitle || ""}`;
    const ncm = /^\d{8}$/.test(String(catalogItem.ncm || "")) ? catalogItem.ncm : DRINK_PATTERN.test(label) ? fiscal.ncmDrink : fiscal.ncmFood;
    const cfop = /^\d{4}$/.test(String(catalogItem.cfop || "")) ? catalogItem.cfop : fiscal.cfop;
    return {
      numero_item: index + 1,
      codigo_produto: String(item.id || item.productId || `item-${index + 1}`).slice(0, 60),
      descricao: String(item.name || "Item").slice(0, 120),
      codigo_ncm: ncm,
      cfop,
      unidade_comercial: "UN",
      quantidade_comercial: quantity,
      valor_unitario_comercial: unit,
      unidade_tributavel: "UN",
      quantidade_tributavel: quantity,
      valor_unitario_tributavel: unit,
      valor_bruto: total,
      icms_origem: 0,
      icms_situacao_tributaria: fiscal.icmsCst,
      pis_situacao_tributaria: fiscal.pisCofinsCst,
      cofins_situacao_tributaria: fiscal.pisCofinsCst,
    };
  });
  const itemsTotal = money(lines.reduce((sum, line) => sum + line.valor_bruto, 0));
  const freight = money(order.deliveryFee || 0);
  const orderTotal = money(order.totalAmount ?? order.total ?? itemsTotal + freight);
  const discount = money(Math.max(0, itemsTotal + freight - orderTotal));
  const paid = money(itemsTotal + freight - discount);
  const isDelivery = String(order.fulfillmentMode || order.orderType || "").toLowerCase() === "delivery";
  const paymentCode = PAYMENT_CODES[String(order.paymentMethod || "").toLowerCase()] || "99";
  return {
    natureza_operacao: "VENDA AO CONSUMIDOR",
    data_emissao: new Date(now).toISOString(),
    cnpj_emitente: fiscal.cnpj,
    serie: fiscal.series,
    presenca_comprador: isDelivery ? 4 : 1,
    consumidor_final: 1,
    local_destino: 1,
    modalidade_frete: freight > 0 ? 0 : 9,
    ...(freight > 0 ? { valor_frete: freight } : {}),
    ...(discount > 0 ? { valor_desconto: discount } : {}),
    items: lines,
    formas_pagamento: [{ forma_pagamento: paymentCode, valor_pagamento: paid }],
  };
};

const refFor = (tenantContext, order, attempt) => {
  const base = crypto
    .createHash("sha256")
    .update(`${tenantContext.tenantId}:${tenantContext.restaurantId}:${order.id}`)
    .digest("hex")
    .slice(0, 16);
  return `inv-${base}-${attempt}`;
};

const isFinalSale = (status) => /^(entregue|retirada concluida)$/i.test(String(status || "").trim());

const emitInvoiceForOrder = async ({ tenantContext, orderId, actorLogin = "", deps = loadDeps() }) => {
  const readiness = await getFiscalReadiness({ tenantContext, deps });
  if (!readiness.ready) {
    throw buildHttpError(409, readiness.blockers.join(" "), "fiscal_not_ready", { blockers: readiness.blockers });
  }
  const tenant = tenantOf(tenantContext);
  const details = await deps.orders.getAdminOrderDetails(String(orderId), { tenantContext });
  const order = details?.order;
  if (!order) throw buildHttpError(404, "Pedido não encontrado.", "order_not_found");
  if (/^cancelad/i.test(String(order.status || ""))) {
    throw buildHttpError(409, "Pedido cancelado não emite nota.", "fiscal_order_canceled");
  }
  const existing = await listInvoicesForOrder(tenant, order.id);
  const current = existing.find((invoice) => ["AUTHORIZED", "PROCESSING"].includes(invoice.status));
  if (current) return { invoice: current, replayed: true };

  const catalogItems = await deps.catalog
    .getCatalogValidationContext({ tenantContext })
    .then((context) => context.itemMap)
    .catch(() => new Map());
  const payload = buildNfcePayload({ order, fiscal: readiness.fiscal, catalogItems });
  const provider = getFiscalProvider();
  const invoice = await createInvoice(tenant, {
    orderId: order.id,
    orderPublicId: order.publicId,
    providerRef: refFor(tenantContext, order, existing.length + 1),
    provider: provider.name,
    environment: getFiscalEnvironment(),
    amountCents: Math.round(payload.formas_pagamento[0].valor_pagamento * 100),
    requestedBy: actorLogin,
  });
  let result;
  try {
    result = await provider.emit({ ref: invoice.providerRef, payload });
  } catch (error) {
    result = { status: "ERROR", message: error?.message || "Falha ao falar com o emissor." };
  }
  const saved = await updateInvoice(tenant, invoice.id, result);
  return { invoice: saved || { ...invoice, ...result }, replayed: false };
};

const cancelInvoiceForOrder = async ({ tenantContext, orderId, reason = "" }) => {
  const tenant = tenantOf(tenantContext);
  const invoices = await listInvoicesForOrder(tenant, String(orderId));
  const authorized = invoices.find((invoice) => invoice.status === "AUTHORIZED");
  if (!authorized) return { canceled: false, reason: "sem_nota_autorizada" };
  const justification = String(reason || "").trim().length >= 15 ? String(reason).trim().slice(0, 255) : `Pedido cancelado no Gestor. ${String(reason || "").trim()}`.trim().padEnd(15, ".");
  const result = await getFiscalProvider().cancel({ ref: authorized.providerRef, reason: justification });
  const saved = await updateInvoice(tenant, authorized.id, { ...result, status: result.status === "CANCELED" ? "CANCELED" : "AUTHORIZED" });
  return { canceled: saved?.status === "CANCELED", invoice: saved, message: result.message || "" };
};

// Depois de mudar o status no Gestor: entregue/retirado emite (se automático);
// cancelado cancela a nota. Nunca desfaz a mudança de status.
const syncInvoiceWithOrderStatus = async ({ tenantContext, orderId, status, note = "", actorLogin = "" }) => {
  if (/^cancelad/i.test(String(status || ""))) {
    return cancelInvoiceForOrder({ tenantContext, orderId, reason: note ? `Pedido cancelado: ${note}` : "" });
  }
  if (!isFinalSale(status)) return null;
  const readiness = await getFiscalReadiness({ tenantContext });
  if (!readiness.ready || !readiness.fiscal.autoEmit) return null;
  return emitInvoiceForOrder({ tenantContext, orderId, actorLogin });
};

module.exports = {
  FISCAL_PLANS,
  buildNfcePayload,
  cancelInvoiceForOrder,
  emitInvoiceForOrder,
  getFiscalReadiness,
  isFinalSale,
  syncInvoiceWithOrderStatus,
};
