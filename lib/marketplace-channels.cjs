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
const { createOrder } = require("./order-store.cjs");

const CHANNELS = Object.freeze({
  ifood: Object.freeze({ id: "ifood", label: "iFood", available: true }),
  food99: Object.freeze({ id: "food99", label: "99Food", available: false }),
  ubereats: Object.freeze({ id: "ubereats", label: "Uber Eats", available: false }),
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
  const storeId = String(externalStoreId || "").trim();
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
const isChannelEnabled = (channel) => channel === "ifood" && Boolean(getIfoodMode());

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
          externalId: String(order.id),
          displayId: String(order.displayId || ""),
          prepaid,
          deliveredBy: String(order.delivery?.deliveredBy || ""),
        },
      },
    },
    items,
    // Mesmo pedido do iFood nunca entra duas vezes.
    requestSignature: crypto.createHash("sha256").update(`ifood:${order.id}`).digest("hex"),
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

// Aviso do iFood: pedido novo (PLACED/PLC) vira pedido no Gestor.
const handleIfoodEvent = async (event = {}) => {
  const code = String(event.fullCode || event.code || "").toUpperCase();
  const orderId = String(event.orderId || "");
  const merchantId = String(event.merchantId || "");
  if (!orderId || !merchantId) return { ignored: true };
  if (!["PLACED", "PLC"].includes(code)) return { ignored: true, code };
  const account = await findAccountByStore("ifood", merchantId);
  if (!account || !account.enabled) return { ignored: true, reason: "store_not_linked" };
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
  if (!channelOrder || channelOrder.channel !== "ifood" || !isChannelEnabled("ifood")) return null;
  const status = String(nextStatus || "").trim().toLowerCase();
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
