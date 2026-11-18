"use strict";

// Integrações com plataformas de delivery (iFood agora; 99Food e Uber Eats
// depois). Sem taxa para o restaurante: só facilita a operação.
//
// - O pedido da plataforma entra no Gestor como qualquer pedido (mesma fila,
//   som e impressão), marcado com a origem ("iFood").
// - Ao mudar o status no Gestor (aceitar, pronto, saiu, cancelar), a
//   plataforma é avisada.
// - O aviso da plataforma nunca é confiado sozinho: o pedido é sempre
//   consultado na plataforma com a credencial da INOVAS.
//
// iFood (Merchant API, modelo centralizado: uma credencial da INOVAS):
//   IFOOD_CLIENT_ID, IFOOD_CLIENT_SECRET  credenciais do app INOVAS no iFood
//   IFOOD_WEBHOOK_TOKEN                    senha que vai na URL do aviso
//   IFOOD_API_URL                          opcional (padrão merchant-api.ifood.com.br)
// Provedor de TESTE: INOVAS_CHANNELS_PROVIDER=fake (só fora de produção).

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { buildHttpError } = require("./http.cjs");
const { neon, runWithDatabaseScope } = require("./tenant-sql.cjs");
const { buildTenantContext } = require("./tenant-context.cjs");
const { createOrder, findOrderBySignature, updateAdminOrderStatus } = require("./order-store.cjs");

// standard: "ifood" (API própria) ou "opendelivery" (padrão aberto da Abrasel,
// usado pela 99Food e pela Keeta). No Open Delivery o código da loja é gerado
// pela INOVAS e colado pelo restaurante no portal da plataforma.
const CHANNELS = Object.freeze({
  ifood: Object.freeze({ id: "ifood", label: "iFood", available: true, standard: "ifood" }),
  food99: Object.freeze({ id: "food99", label: "99Food", available: true, standard: "opendelivery", envPrefix: "FOOD99" }),
  keeta: Object.freeze({ id: "keeta", label: "Keeta", available: true, standard: "opendelivery", envPrefix: "KEETA" }),
  // Uber Eats encerrou o delivery de restaurantes no Brasil (2022); pedidos de
  // comida feitos no app da Uber chegam pelo iFood.
  ubereats: Object.freeze({ id: "ubereats", label: "Uber Eats", available: false, standard: "", note: "Os pedidos de comida do app Uber chegam pelo iFood." }),
});

/* ---------------- vínculo loja da plataforma <-> restaurante ---------------- */

let sqlClient = null;
let fileQueue = Promise.resolve();
const getStorageMode = () => {
  if (String(process.env.DATABASE_URL || "").trim()) return "neon";
  return process.env.NODE_ENV === "production" ? "disabled" : "file";
};
const getSql = () => {
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
};
const localFile = () =>
  String(process.env.INOVAS_CHANNELS_FILE || "").trim() || path.join(process.cwd(), ".data", "channel-accounts.json");
const readLocal = async () => {
  try {
    return JSON.parse(await fs.readFile(localFile(), "utf8")).accounts || [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
};
const writeLocal = async (accounts) => {
  await fs.mkdir(path.dirname(localFile()), { recursive: true });
  await fs.writeFile(localFile(), `${JSON.stringify({ accounts }, null, 2)}\n`, "utf8");
};
const assertStorage = () => {
  if (getStorageMode() === "disabled") {
    throw buildHttpError(503, "Integracoes ainda nao ativadas.", "channels_not_configured");
  }
  return getStorageMode();
};
const translate = (error) =>
  error?.code === "42P01" || /restaurant_channel_accounts/.test(String(error?.message || ""))
    ? buildHttpError(503, "Integracoes ainda nao ativadas.", "channels_not_configured")
    : error;
const asSystem = (callback) =>
  runWithDatabaseScope({ audience: "system" }, async () => {
    try {
      return await callback(getSql());
    } catch (error) {
      throw translate(error);
    }
  });
const fromRow = (row) => ({
  tenantId: row.tenant_id ?? row.tenantId,
  restaurantId: row.restaurant_id ?? row.restaurantId,
  restaurantKey: row.restaurant_key ?? row.restaurantKey,
  channel: row.channel,
  externalStoreId: row.external_store_id ?? row.externalStoreId,
  enabled: (row.enabled ?? true) !== false,
  updatedAt: row.updated_at ?? row.updatedAt ?? null,
});

const listChannelAccounts = async (tenant) => {
  const mode = assertStorage();
  if (mode === "file") {
    return (await readLocal()).filter((row) => row.tenantId === tenant.tenantId && row.restaurantId === tenant.restaurantId).map(fromRow);
  }
  return asSystem(async (sql) =>
    (await sql`SELECT * FROM restaurant_channel_accounts WHERE tenant_id = ${tenant.tenantId} AND restaurant_id = ${tenant.restaurantId}`).map(fromRow)
  );
};

const findAccountByStore = async (channel, externalStoreId) => {
  const mode = assertStorage();
  if (mode === "file") {
    const row = (await readLocal()).find((entry) => entry.channel === channel && entry.externalStoreId === externalStoreId);
    return row ? fromRow(row) : null;
  }
  return asSystem(async (sql) => {
    const rows = await sql`SELECT * FROM restaurant_channel_accounts WHERE channel = ${channel} AND external_store_id = ${externalStoreId}`;
    return rows[0] ? fromRow(rows[0]) : null;
  });
};

const STORE_ID_PATTERN = /^[A-Za-z0-9-]{3,120}$/;

// Vincula (ou desvincula, com externalStoreId vazio) a loja da plataforma.
const saveChannelAccount = async (tenant, { channel, externalStoreId, enabled = true, actorLogin = "" }) => {
  const mode = assertStorage();
  if (!CHANNELS[channel]?.available) {
    throw buildHttpError(400, "Integracao ainda nao disponivel.", "channel_not_available");
  }
  let storeId = String(externalStoreId || "").trim();
  // Open Delivery: o código da loja é gerado aqui (identificador + UUID).
  if (storeId === "generate" && CHANNELS[channel].standard === "opendelivery") {
    storeId = `${String(tenant.restaurantKey || "loja").replace(/[^A-Za-z0-9]/g, "").slice(0, 40)}-${crypto.randomUUID()}`;
  }
  if (storeId && !STORE_ID_PATTERN.test(storeId)) {
    throw buildHttpError(400, "Codigo da loja invalido (copie o ID da loja no Portal do Parceiro).", "channel_store_invalid");
  }
  const owner = storeId ? await findAccountByStore(channel, storeId) : null;
  if (owner && !(owner.tenantId === tenant.tenantId && owner.restaurantId === tenant.restaurantId)) {
    throw buildHttpError(409, "Esta loja ja esta vinculada a outro restaurante.", "channel_store_taken");
  }
  const by = String(actorLogin || "").slice(0, 160);
  if (mode === "file") {
    const rows = (await readLocal()).filter(
      (row) => !(row.tenantId === tenant.tenantId && row.restaurantId === tenant.restaurantId && row.channel === channel)
    );
    if (storeId) rows.push({ ...tenant, channel, externalStoreId: storeId, enabled: enabled !== false, updatedBy: by, updatedAt: new Date().toISOString() });
    await writeLocal(rows);
  } else {
    await asSystem(async (sql) => {
      if (!storeId) {
        await sql`DELETE FROM restaurant_channel_accounts WHERE tenant_id = ${tenant.tenantId} AND restaurant_id = ${tenant.restaurantId} AND channel = ${channel}`;
        return;
      }
      await sql`
        INSERT INTO restaurant_channel_accounts (tenant_id, restaurant_id, restaurant_key, channel, external_store_id, enabled, updated_by)
        VALUES (${tenant.tenantId}, ${tenant.restaurantId}, ${tenant.restaurantKey}, ${channel}, ${storeId}, ${enabled !== false}, ${by})
        ON CONFLICT (tenant_id, restaurant_id, channel) DO UPDATE SET
          external_store_id = EXCLUDED.external_store_id, enabled = EXCLUDED.enabled,
          updated_by = EXCLUDED.updated_by, updated_at = NOW()
      `;
    });
  }
  return listChannelAccounts(tenant);
};

/* ---------------- cliente do iFood ---------------- */

const getIfoodMode = () => {
  const explicit = String(process.env.INOVAS_CHANNELS_PROVIDER || "").trim().toLowerCase();
  if (explicit === "fake") return process.env.VERCEL_ENV === "production" ? "" : "fake";
  if (String(process.env.IFOOD_CLIENT_ID || "").trim() && String(process.env.IFOOD_CLIENT_SECRET || "").trim()) return "real";
  return "";
};
// Open Delivery (99Food, Keeta): credenciais que a plataforma entrega à
// INOVAS como "Software Service": <PREFIX>_CLIENT_ID, <PREFIX>_CLIENT_SECRET,
// <PREFIX>_API_URL (servidor da plataforma) e <PREFIX>_APP_ID (X-App-Id).
const getOpenDeliveryMode = (channel) => {
  const config = CHANNELS[channel];
  if (!config || config.standard !== "opendelivery") return "";
  if (String(process.env.INOVAS_CHANNELS_PROVIDER || "").trim().toLowerCase() === "fake") {
    return process.env.VERCEL_ENV === "production" ? "" : "fake";
  }
  const env = (name) => String(process.env[`${config.envPrefix}_${name}`] || "").trim();
  return env("CLIENT_ID") && env("CLIENT_SECRET") && env("API_URL") ? "real" : "";
};

const isChannelEnabled = (channel) =>
  channel === "ifood" ? Boolean(getIfoodMode()) : Boolean(getOpenDeliveryMode(channel));

let ifoodToken = { value: "", expiresAt: 0 };
const ifoodBaseUrl = () => String(process.env.IFOOD_API_URL || "https://merchant-api.ifood.com.br").replace(/\/+$/, "");

const ifoodAuth = async () => {
  if (ifoodToken.value && Date.now() < ifoodToken.expiresAt - 60_000) return ifoodToken.value;
  const response = await fetch(`${ifoodBaseUrl()}/authentication/v1.0/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grantType: "client_credentials",
      clientId: String(process.env.IFOOD_CLIENT_ID || ""),
      clientSecret: String(process.env.IFOOD_CLIENT_SECRET || ""),
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.accessToken) {
    throw buildHttpError(502, "Nao foi possivel conectar ao iFood.", "ifood_auth_failed");
  }
  ifoodToken = { value: payload.accessToken, expiresAt: Date.now() + Number(payload.expiresIn || 3600) * 1000 };
  return ifoodToken.value;
};

const ifoodRequest = async (method, url, body) => {
  const token = await ifoodAuth();
  const response = await fetch(`${ifoodBaseUrl()}${url}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (response.status === 202 || response.status === 204) return {};
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw buildHttpError(502, "O iFood recusou a operacao.", "ifood_request_failed", { providerStatus: response.status });
  }
  return payload;
};

// Provedor de TESTE (simula o iFood) — só fora de produção.
const fakeIfood = { orders: new Map(), actions: [] };

const ifoodClient = {
  async getOrder(orderId) {
    if (getIfoodMode() === "fake") {
      const order = fakeIfood.orders.get(orderId);
      if (!order) throw buildHttpError(404, "Pedido de teste nao encontrado.", "ifood_order_not_found");
      return order;
    }
    return ifoodRequest("GET", `/order/v1.0/orders/${encodeURIComponent(orderId)}`);
  },
  async action(orderId, action, body) {
    if (getIfoodMode() === "fake") {
      fakeIfood.actions.push({ orderId, action, body: body || null });
      return {};
    }
    return ifoodRequest("POST", `/order/v1.0/orders/${encodeURIComponent(orderId)}/${action}`, body);
  },
};

/* ---------------- cliente Open Delivery (99Food, Keeta) ---------------- */

const odTokens = new Map();
const fakeOpenDelivery = { orders: new Map(), actions: [] };
const odEnv = (channel, name) => String(process.env[`${CHANNELS[channel].envPrefix}_${name}`] || "").trim();
const odBaseUrl = (channel) => odEnv(channel, "API_URL").replace(/\/+$/, "");

const odAuth = async (channel) => {
  const cached = odTokens.get(channel);
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.value;
  const response = await fetch(`${odBaseUrl(channel)}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: odEnv(channel, "CLIENT_ID"),
      client_secret: odEnv(channel, "CLIENT_SECRET"),
      grant_type: "client_credentials",
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw buildHttpError(502, `Nao foi possivel conectar a ${CHANNELS[channel].label}.`, "opendelivery_auth_failed");
  }
  odTokens.set(channel, { value: payload.access_token, expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000 });
  return payload.access_token;
};

const odRequest = async (channel, method, url, body) => {
  const token = await odAuth(channel);
  const target = /^https:\/\//.test(url) ? url : `${odBaseUrl(channel)}${url}`;
  // Só fala com o servidor configurado da plataforma (nunca com URL de terceiros).
  if (!target.startsWith(`${odBaseUrl(channel)}/`)) {
    throw buildHttpError(400, "Endereco do pedido fora da plataforma.", "opendelivery_url_invalid");
  }
  const response = await fetch(target, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (response.status === 202 || response.status === 204) return {};
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw buildHttpError(502, `A ${CHANNELS[channel].label} recusou a operacao.`, "opendelivery_request_failed", { providerStatus: response.status });
  }
  return payload;
};

const openDeliveryClient = {
  async getOrder(channel, orderId) {
    if (getOpenDeliveryMode(channel) === "fake") {
      const order = fakeOpenDelivery.orders.get(orderId);
      if (!order) throw buildHttpError(404, "Pedido de teste nao encontrado.", "opendelivery_order_not_found");
      return order;
    }
    return odRequest(channel, "GET", `/v1/orders/${encodeURIComponent(orderId)}`);
  },
  async action(channel, orderId, action, body) {
    if (getOpenDeliveryMode(channel) === "fake") {
      fakeOpenDelivery.actions.push({ channel, orderId, action, body: body || null });
      return {};
    }
    return odRequest(channel, "POST", `/v1/orders/${encodeURIComponent(orderId)}/${action}`, body || undefined);
  },
};

// Pedido Open Delivery -> pedido INOVAS (mesmo formato do pedido do site).
const ODPAY = { CREDIT: "credito", DEBIT: "debito", CREDIT_DEBIT: "credito", PIX: "pix", CASH: "dinheiro", MEAL_VOUCHER: "vale", FOOD_VOUCHER: "vale" };
const priceOf = (value) => money(value?.value ?? value ?? 0);

const mapOpenDeliveryOrder = (channel, order) => {
  const label = CHANNELS[channel].label;
  const type = String(order.type || "DELIVERY").toUpperCase();
  const isDelivery = type === "DELIVERY";
  const scheduled = String(order.orderTiming || "").toUpperCase() === "SCHEDULED";
  const method = order.payments?.methods?.[0] || {};
  const prepaid = Number(order.payments?.pending || 0) === 0 && Number(order.payments?.prepaid || 0) > 0;
  const address = order.delivery?.deliveryAddress || {};
  const items = (order.items || []).map((item, index) => {
    const quantity = Math.max(1, Math.round(Number(item.quantity) || 1));
    const totalPrice = priceOf(item.totalPrice);
    const options = (item.options || []).map((option) => `${option.quantity || 1}x ${option.name}`);
    return {
      id: `${channel}:${item.id || index}`,
      type: "product",
      name: String(item.name || "Item").slice(0, 160),
      category: label,
      quantity,
      unitPrice: money(totalPrice / quantity || priceOf(item.unitPrice)),
      totalPrice,
      metadata: { observations: String(item.specialInstructions || "").slice(0, 300), options },
    };
  });
  const deliveryFee = money(
    (order.otherFees || []).filter((fee) => String(fee.type || "").toUpperCase() === "DELIVERY_FEE").reduce((sum, fee) => sum + priceOf(fee.price), 0)
  );
  const subtotal = priceOf(order.total?.itemsPrice) || money(items.reduce((sum, item) => sum + item.totalPrice, 0));
  const total = priceOf(order.total?.orderAmount) || money(subtotal + deliveryFee);
  const notes = [
    `Pedido ${label} #${order.displayId || ""}`,
    order.delivery?.pickupCode ? `Código de coleta: ${order.delivery.pickupCode}` : "",
    prepaid ? `PAGO NO APP ${label}` : `Cobrar na entrega${method.method === "CASH" && method.changeFor ? ` (troco para R$ ${method.changeFor})` : ""}`,
    ...items.filter((item) => item.metadata.observations || item.metadata.options.length).map(
      (item) => `${item.name}: ${[...item.metadata.options, item.metadata.observations].filter(Boolean).join(", ")}`
    ),
    order.extraInfo ? String(order.extraInfo) : "",
  ].filter(Boolean).join("\n");
  return {
    customer: {
      key: `${channel}:${order.customer?.id || order.id}`,
      profileId: "",
      name: String(order.customer?.name || `Cliente ${label}`).slice(0, 160),
      phone: String(order.customer?.phone?.number || "").replace(/\D/g, "").slice(0, 13),
      email: "",
    },
    order: {
      status: "Recebido",
      orderType: isDelivery ? (scheduled ? "agendado_entrega" : "entrega") : scheduled ? "agendado_retirada" : "retirada",
      fulfillmentMode: isDelivery ? "delivery" : "pickup",
      timingMode: scheduled ? "scheduled" : "immediate",
      scheduledFor: scheduled ? order.schedule?.scheduledDateTimeStart || null : null,
      scheduledDate: "",
      scheduledTime: "",
      scheduledLabel: "",
      paymentMethod: ODPAY[String(method.method || "").toUpperCase()] || "pix",
      needsChange: false,
      cashAmountProvided: null,
      changeAmount: null,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      addonsTotal: 0,
      deliveryFee,
      total,
      customerNotes: notes.slice(0, 600),
      addressLine: String(address.street || ""),
      addressNumber: String(address.number || ""),
      addressComplement: String(address.complement || ""),
      addressReference: String(address.reference || ""),
      addressPostalCode: String(address.postalCode || ""),
      addressNeighborhood: String(address.district || ""),
      addressCity: String(address.city || ""),
      addressState: String(address.state || ""),
      addressFull: [address.street, address.number, address.district, address.city].filter(Boolean).join(", "),
      deliveryDistanceText: "",
      deliveryRouteBand: "",
      deliveryEstimateText: "",
      rawPayload: {
        channel,
        channelOrder: {
          channel,
          standard: "opendelivery",
          externalId: String(order.id),
          displayId: String(order.displayId || ""),
          prepaid,
          deliveredBy: String(order.delivery?.deliveredBy || ""),
          orderType: type,
        },
      },
    },
    items,
    requestSignature: channelSignature(channel, String(order.id)),
  };
};

/* ---------------- avisos de status vindos da plataforma ---------------- */

const channelSignature = (channel, externalId) =>
  crypto.createHash("sha256").update(`${channel}:${externalId}`).digest("hex");

const withOrderScope = (account, fn) =>
  runWithDatabaseScope(
    { audience: "system", tenantId: account.tenantId, restaurantId: account.restaurantId, restaurantKey: account.restaurantKey },
    fn
  );

// Ordem das etapas: aviso da plataforma só avança o pedido, nunca volta.
const STATUS_RANK = {
  Recebido: 0,
  Aceito: 1,
  "Em preparo": 2,
  Pronto: 3,
  "Saiu para entrega": 4,
  Entregue: 5,
  "Retirada concluida": 5,
  Cancelado: 6,
};
const FINAL_STATUSES = new Set(["Entregue", "Retirada concluida", "Cancelado"]);
const OD_CANCEL_BY = {
  CONSUMER_CANCELLATION_REQUESTED: "pelo cliente",
};
const IFOOD_EVENT_STATUS = {
  CFM: "Aceito",
  CONFIRMED: "Aceito",
  SPS: "Em preparo",
  SEPARATION_STARTED: "Em preparo",
  RTP: "Pronto",
  READY_TO_PICKUP: "Pronto",
  DSP: "Saiu para entrega",
  DISPATCHED: "Saiu para entrega",
  CON: "done",
  CONCLUDED: "done",
  CAN: "Cancelado",
  CANCELLED: "Cancelado",
};
const OD_EVENT_STATUS = {
  CONFIRMED: "Aceito",
  PREPARING: "Em preparo",
  READY_FOR_PICKUP: "Pronto",
  DISPATCHED: "Saiu para entrega",
  PICKED_UP: "done",
  DELIVERED: "done",
  CONCLUDED: "done",
  CANCELLED: "Cancelado",
};

const cleanReason = (value) => String(value || "").replace(/\s+/g, " ").trim().slice(0, 200);
const ifoodReason = (metadata = {}) =>
  cleanReason(metadata.reason || metadata.cancelReason || metadata.CANCEL_REASON || metadata.description || metadata.details || "");

const mapIfoodEvent = (event = {}) => {
  const code = String(event.fullCode || event.code || "").toUpperCase();
  if (["HSD", "HANDSHAKE_DISPUTE", "CONSUMER_CANCELLATION_REQUESTED"].includes(code)) {
    return { request: true, reason: ifoodReason(event.metadata) };
  }
  const status = IFOOD_EVENT_STATUS[code];
  return status ? { status, reason: ifoodReason(event.metadata), by: "" } : null;
};

const mapOpenDeliveryEvent = (event = {}) => {
  const type = String(event.eventType || "").toUpperCase();
  const metadata = event.metadata && typeof event.metadata === "object" ? event.metadata : {};
  if (type === "ORDER_CANCELLATION_REQUEST") return { request: true, reason: cleanReason(metadata.reason) };
  const status = OD_EVENT_STATUS[type];
  if (!status) return null;
  return { status, reason: cleanReason(metadata.reason), by: OD_CANCEL_BY[String(metadata.code || "").toUpperCase()] || "" };
};

const PLATFORM_ACTOR = (label) => ({ login: "plataforma", displayName: label });

// Aplica o aviso no pedido do Gestor SEM avisar a plataforma de volta (ela
// é a origem). Nota começa com "Cancelado no <plataforma>" para o alerta.
const applyPlatformEvent = async (account, signature, label, mapped) => {
  if (!mapped) return { ignored: true, reason: "event_not_handled" };
  const tenantContext = tenantContextFor(account);
  return withOrderScope(account, async () => {
    const current = await findOrderBySignature(signature, { tenantContext });
    if (!current) return { ignored: true, reason: "order_not_found" };
    if (FINAL_STATUSES.has(current.status)) return { ignored: true, reason: "order_closed", status: current.status };
    const pickup = current.fulfillmentMode === "pickup";
    if (mapped.request) {
      const note = `Cliente pediu cancelamento no ${label}${mapped.reason ? `: ${mapped.reason}` : ""}. Cancele no Gestor para aceitar.`;
      await updateAdminOrderStatus(current.id, current.status, note, { tenantContext, manual: true, actor: PLATFORM_ACTOR(label) });
      return { ignored: false, cancellationRequested: true };
    }
    let next = mapped.status === "done" ? (pickup ? "Retirada concluida" : "Entregue") : mapped.status;
    if (next === "Saiu para entrega" && pickup) return { ignored: true, reason: "pickup_order" };
    if (next !== "Cancelado" && (STATUS_RANK[next] ?? -1) <= (STATUS_RANK[current.status] ?? -1)) {
      return { ignored: true, reason: "already_there", status: current.status };
    }
    const note =
      next === "Cancelado"
        ? `Cancelado no ${label}${mapped.by ? ` ${mapped.by}` : ""}${mapped.reason ? `. Motivo: ${mapped.reason}` : ""}. Não prepare.`
        : `Atualizado pelo ${label}.`;
    const result = await updateAdminOrderStatus(current.id, next, note, { tenantContext, actor: PLATFORM_ACTOR(label) });
    return { ignored: false, status: result?.order?.status || next };
  });
};

// Aviso Open Delivery (POST .../v1/newEvent): CREATED vira pedido no Gestor;
// os demais (aceito, pronto, cancelado...) atualizam o pedido que já existe.
const handleOpenDeliveryEvent = async (channel, event = {}, { merchantId = "" } = {}) => {
  const eventType = String(event.eventType || "").toUpperCase();
  const orderId = String(event.orderId || "");
  if (!orderId || !merchantId) return { ignored: true };
  const account = await findAccountByStore(channel, merchantId);
  if (!account || !account.enabled) return { ignored: true, reason: "store_not_linked" };
  const signature = channelSignature(channel, orderId);
  if (eventType !== "CREATED") {
    return applyPlatformEvent(account, signature, CHANNELS[channel]?.label || "plataforma", mapOpenDeliveryEvent(event));
  }
  // Aviso repetido (mesmo depois de horas) não cria o pedido de novo.
  const existing = await withOrderScope(account, () => findOrderBySignature(signature, { tenantContext: tenantContextFor(account) }));
  if (existing) return { ignored: false, created: false, orderPublicId: existing.publicId };
  const order = await openDeliveryClient.getOrder(channel, orderId);
  if (order.merchant?.id && String(order.merchant.id) !== merchantId) return { ignored: true, reason: "merchant_mismatch" };
  const tenantContext = tenantContextFor(account);
  const result = await runWithDatabaseScope(
    { audience: "public", tenantId: account.tenantId, restaurantId: account.restaurantId, restaurantKey: account.restaurantKey },
    () => createOrder(mapOpenDeliveryOrder(channel, order), { tenantContext })
  );
  return { ignored: false, created: result.created, orderPublicId: result.order?.publicId };
};

// Assinatura do aviso: HMAC-SHA256 do corpo com o client secret.
const verifyOpenDeliverySignature = (channel, rawBody, signature) => {
  if (getOpenDeliveryMode(channel) === "fake") return true;
  const secret = odEnv(channel, "CLIENT_SECRET");
  const expected = crypto.createHmac("sha256", secret).update(String(rawBody || "")).digest("hex");
  const given = String(signature || "").trim().toLowerCase();
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
};
const assertOpenDeliveryApp = (channel, appId) => {
  if (getOpenDeliveryMode(channel) === "fake") return;
  const expected = odEnv(channel, "APP_ID");
  if (expected && String(appId || "") !== expected) {
    throw buildHttpError(403, "Aplicativo nao reconhecido.", "opendelivery_app_unknown");
  }
};

const OD_STATUS_ACTION = {
  aceito: "confirm",
  "em preparo": "preparing",
  pronto: "readyForPickup",
  "saiu para entrega": "dispatch",
  entregue: "delivered",
  "retirada concluida": "pickedUp",
};

/* ---------------- pedido do iFood -> pedido INOVAS ---------------- */

const PAYMENT_MAP = { CREDIT: "credito", DEBIT: "debito", PIX: "pix", CASH: "dinheiro", MEAL_VOUCHER: "vale", FOOD_VOUCHER: "vale" };
const money = (value) => Number(Number(value || 0).toFixed(2));

const mapIfoodOrder = (order) => {
  const isDelivery = String(order.orderType || "DELIVERY").toUpperCase() === "DELIVERY";
  const scheduled = String(order.orderTiming || "").toUpperCase() === "SCHEDULED";
  const payment = order.payments?.methods?.[0] || {};
  const prepaid = Number(order.payments?.pending || 0) === 0 && Number(order.payments?.prepaid || 0) > 0;
  const address = order.delivery?.deliveryAddress || {};
  const items = (order.items || []).map((item, index) => {
    const options = (item.options || []).map((option) => `${option.quantity || 1}x ${option.name}`);
    const unit = money(item.totalPrice && item.quantity ? item.totalPrice / item.quantity : item.unitPrice);
    return {
      id: `ifood:${item.id || index}`,
      type: "product",
      name: String(item.name || "Item").slice(0, 160),
      category: "iFood",
      quantity: Math.max(1, Number.parseInt(item.quantity, 10) || 1),
      unitPrice: unit,
      totalPrice: money(item.totalPrice ?? unit * (item.quantity || 1)),
      metadata: { observations: String(item.observations || "").slice(0, 300), options },
    };
  });
  const subtotal = money(order.total?.subTotal ?? items.reduce((sum, item) => sum + item.totalPrice, 0));
  const deliveryFee = money(order.total?.deliveryFee || 0);
  const total = money(order.total?.orderAmount ?? subtotal + deliveryFee);
  const customerPhone = String(order.customer?.phone?.number || "").replace(/\D/g, "").slice(0, 13);
  const notes = [
    `Pedido iFood #${order.displayId || ""}`,
    order.customer?.phone?.localizer ? `Localizador: ${order.customer.phone.localizer}` : "",
    prepaid ? "PAGO NO APP iFood" : `Cobrar na entrega${payment.method === "CASH" && payment.cash?.changeFor ? ` (troco para R$ ${payment.cash.changeFor})` : ""}`,
    ...items.filter((item) => item.metadata.observations || item.metadata.options.length).map(
      (item) => `${item.name}: ${[...item.metadata.options, item.metadata.observations].filter(Boolean).join(", ")}`
    ),
  ].filter(Boolean).join("\n");
  return {
    customer: {
      key: `ifood:${order.customer?.id || order.id}`,
      profileId: "",
      name: String(order.customer?.name || "Cliente iFood").slice(0, 160),
      phone: customerPhone,
      email: "",
    },
    order: {
      status: "Recebido",
      orderType: isDelivery ? (scheduled ? "agendado_entrega" : "entrega") : scheduled ? "agendado_retirada" : "retirada",
      fulfillmentMode: isDelivery ? "delivery" : "pickup",
      timingMode: scheduled ? "scheduled" : "immediate",
      scheduledFor: scheduled ? order.schedule?.deliveryDateTimeStart || null : null,
      scheduledDate: "",
      scheduledTime: "",
      scheduledLabel: "",
      paymentMethod: PAYMENT_MAP[String(payment.method || "").toUpperCase()] || "pix",
      needsChange: false,
      cashAmountProvided: null,
      changeAmount: null,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      addonsTotal: 0,
      deliveryFee,
      total,
      customerNotes: notes.slice(0, 600),
      addressLine: String(address.streetName || ""),
      addressNumber: String(address.streetNumber || ""),
      addressComplement: String(address.complement || ""),
      addressReference: String(address.reference || ""),
      addressPostalCode: String(address.postalCode || ""),
      addressNeighborhood: String(address.neighborhood || ""),
      addressCity: String(address.city || ""),
      addressState: String(address.state || ""),
      addressFull: String(address.formattedAddress || ""),
      deliveryDistanceText: "",
      deliveryRouteBand: "",
      deliveryEstimateText: "",
      rawPayload: {
        channel: "ifood",
        channelOrder: {
          channel: "ifood",
          // Canal de venda informado pelo iFood (ex.: pedido feito pelo app da Uber).
          salesChannel: String(order.salesChannel || "").slice(0, 40),
          externalId: String(order.id),
          displayId: String(order.displayId || ""),
          prepaid,
          deliveredBy: String(order.delivery?.deliveredBy || ""),
        },
      },
    },
    items,
    // Mesmo pedido do iFood nunca entra duas vezes.
    requestSignature: channelSignature("ifood", String(order.id)),
  };
};

const tenantContextFor = (account) =>
  buildTenantContext(
    {
      host: "channels.inovas.local",
      matched: true,
      tenantId: account.tenantId,
      restaurantId: account.restaurantId,
      restaurantKey: account.restaurantKey,
      resolutionMode: "system",
      multiRestaurantActive: true,
    },
    { source: "channels:ifood" }
  );

// Aviso do iFood: pedido novo (PLACED/PLC) vira pedido no Gestor; aceito,
// pronto, saiu, concluído e cancelado atualizam o pedido que já existe.
const handleIfoodEvent = async (event = {}) => {
  const code = String(event.fullCode || event.code || "").toUpperCase();
  const orderId = String(event.orderId || "");
  const merchantId = String(event.merchantId || "");
  if (!orderId || !merchantId) return { ignored: true };
  const account = await findAccountByStore("ifood", merchantId);
  if (!account || !account.enabled) return { ignored: true, reason: "store_not_linked" };
  const signature = channelSignature("ifood", orderId);
  if (!["PLACED", "PLC"].includes(code)) {
    return applyPlatformEvent(account, signature, "iFood", mapIfoodEvent(event));
  }
  const existing = await withOrderScope(account, () => findOrderBySignature(signature, { tenantContext: tenantContextFor(account) }));
  if (existing) return { ignored: false, created: false, orderPublicId: existing.publicId };
  const order = await ifoodClient.getOrder(orderId);
  if (String(order.merchant?.id || merchantId) !== merchantId) return { ignored: true, reason: "merchant_mismatch" };
  const tenantContext = tenantContextFor(account);
  const result = await runWithDatabaseScope(
    { audience: "public", tenantId: account.tenantId, restaurantId: account.restaurantId, restaurantKey: account.restaurantKey },
    () => createOrder(mapIfoodOrder(order), { tenantContext })
  );
  return { ignored: false, created: result.created, orderPublicId: result.order?.publicId };
};

// Gestor mudou o status de um pedido do iFood: avisa o iFood.
const STATUS_TO_IFOOD = {
  aceito: "confirm",
  "em preparo": "startPreparation",
  pronto: "readyToPickup",
  "saiu para entrega": "dispatch",
};
const syncChannelStatus = async (order, nextStatus, { note = "" } = {}) => {
  const channelOrder = order?.rawPayload?.channelOrder;
  if (!channelOrder || !isChannelEnabled(channelOrder.channel)) return null;
  const status = String(nextStatus || "").trim().toLowerCase();
  if (channelOrder.standard === "opendelivery") {
    if (status.startsWith("cancelad")) {
      // Cliente já tinha pedido o cancelamento na plataforma: aceitar o pedido dele.
      const trail = Array.isArray(order.auditTrail) ? order.auditTrail : [];
      if (trail.some((entry) => /^Cliente pediu cancelamento/i.test(String(entry?.note || "")))) {
        await openDeliveryClient.action(channelOrder.channel, channelOrder.externalId, "acceptCancellation");
        return "acceptCancellation";
      }
      await openDeliveryClient.action(channelOrder.channel, channelOrder.externalId, "requestCancellation", {
        reason: String(note || "Cancelado pelo restaurante").slice(0, 250),
        code: "INTERNAL_DIFFICULTIES_OF_THE_RESTAURANT",
        mode: "MANUAL",
      });
      return "requestCancellation";
    }
    const odAction = OD_STATUS_ACTION[status];
    if (!odAction) return null;
    // Entrega feita pela plataforma: "saiu" e "entregue" são dela.
    if ((odAction === "dispatch" || odAction === "delivered") && channelOrder.deliveredBy === "MARKETPLACE") return null;
    await openDeliveryClient.action(channelOrder.channel, channelOrder.externalId, odAction);
    return odAction;
  }
  if (status.startsWith("cancelad")) {
    await ifoodClient.action(channelOrder.externalId, "requestCancellation", {
      reason: String(note || "Cancelado pelo restaurante").slice(0, 250),
      cancellationCode: "501",
    });
    return "requestCancellation";
  }
  const action = STATUS_TO_IFOOD[status];
  if (!action) return null;
  // Pedido entregue pelo entregador do iFood: "pronto" é o fim do nosso lado.
  if (action === "dispatch" && channelOrder.deliveredBy === "IFOOD") return null;
  await ifoodClient.action(channelOrder.externalId, action);
  return action;
};

const assertIfoodWebhookToken = (token) => {
  if (getIfoodMode() === "fake") return;
  const expected = String(process.env.IFOOD_WEBHOOK_TOKEN || "");
  const given = String(token || "");
  if (expected.length < 16 || given.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    throw buildHttpError(401, "Aviso recusado.", "ifood_webhook_unauthorized");
  }
};

module.exports = {
  CHANNELS,
  assertOpenDeliveryApp,
  fakeOpenDelivery,
  getOpenDeliveryMode,
  handleOpenDeliveryEvent,
  mapOpenDeliveryOrder,
  verifyOpenDeliverySignature,
  assertIfoodWebhookToken,
  fakeIfood,
  getIfoodMode,
  handleIfoodEvent,
  isChannelEnabled,
  listChannelAccounts,
  mapIfoodOrder,
  saveChannelAccount,
  syncChannelStatus,
};
