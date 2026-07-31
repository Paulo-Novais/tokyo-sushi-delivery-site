const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { neon } = require("./tenant-sql.cjs");
const {
  assertMigrationManagedRelations,
} = require("./database-schema.cjs");
const {
  buildAdminMetricsSnapshot,
  buildComparisonWindowFromFilters,
  normalizeMetricsFilters,
} = require("./admin-metrics.cjs");
const { ORDER_PREFIXES } = require("./app-branding.cjs");
const { buildHttpError } = require("./http.cjs");
const {
  buildOperationalWindow,
  buildOperationalWindowForPreset,
  getOperationalDayWindow,
  isWithinOperationalWindow,
  operationalDateKeyToStartMs,
  parseOperationalCustomWindow,
  toOperationalDateInput,
} = require("./operational-day.cjs");
const { getAdminDeliverySettings } = require("./delivery-settings-store.cjs");
const { getFinanceClosing } = require("./finance-store.cjs");
const { ORDER_STATUSES } = require("./order-payload.cjs");
const {
  getOperationalTenant,
  matchesTenantScope,
  withTenantScope,
} = require("./tenant-context.cjs");

const LOCAL_STORAGE_FILE = path.join(process.cwd(), ".data", "orders.json");
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;
const SCHEDULE_DUE_SOON_WINDOW_MS = 45 * 60 * 1000;
const LEGACY_FINALIZED_STATUS = "Finalizado";
const FINAL_ORDER_STATUSES = new Set(["Entregue", "Retirada concluida", "Cancelado"]);
const DEFAULT_INITIAL_STATUS_NOTE = "Pedido criado pelo site.";
const DEFAULT_ADMIN_STATUS_NOTE = "Status atualizado manualmente no gestor.";
const DEFAULT_MANUAL_AUDIT_NOTE = "Alteracao manual registrada no pedido.";
const PUBLIC_ORDER_PREFIX =
  String(ORDER_PREFIXES.publicOrder || "TKY")
    .replace(/[^a-z0-9-]/gi, "")
    .toUpperCase() || "TKY";
const AUDIT_ACTION_OPTIONS = Object.freeze([
  { key: "order_created", label: "Pedido criado" },
  { key: "order_accepted", label: "Pedido aceito" },
  { key: "order_marked_preparing", label: "Em preparo" },
  { key: "order_marked_ready", label: "Pedido pronto" },
  { key: "order_out_for_delivery", label: "Saiu para entrega" },
  { key: "order_marked_picked_up", label: "Retirada concluida" },
  { key: "order_finalized", label: "Pedido entregue" },
  { key: "order_cancelled", label: "Pedido cancelado" },
  { key: "status_updated", label: "Status atualizado" },
  { key: "manual_order_update", label: "Alteracao manual" },
]);
const AUDIT_ACTION_LABELS = AUDIT_ACTION_OPTIONS.reduce((summary, entry) => {
  summary[entry.key] = entry.label;
  return summary;
}, {});
const ORDER_STATUS_INDEX = ORDER_STATUSES.reduce((summary, status, index) => {
  summary[status] = index;
  return summary;
}, {});

const normalizeStatusKey = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const resolveCanonicalOrderStatus = (status, fulfillmentMode = "") => {
  const normalizedStatus = normalizeStatusKey(status);
  const normalizedFulfillmentMode = String(fulfillmentMode || "").trim().toLowerCase();

  if (!normalizedStatus) {
    return "";
  }

  if (normalizedStatus === "novo" || normalizedStatus === "recebido") {
    return "Recebido";
  }

  if (normalizedStatus === "confirmado" || normalizedStatus === "aceito") {
    return "Aceito";
  }

  if (normalizedStatus === "em preparo") {
    return "Em preparo";
  }

  if (normalizedStatus === "pronto") {
    return "Pronto";
  }

  if (normalizedStatus === "saiu para entrega") {
    return "Saiu para entrega";
  }

  if (normalizedStatus === "finalizado") {
    return normalizedFulfillmentMode === "pickup" ? "Retirada concluida" : "Entregue";
  }

  if (normalizedStatus === "entregue") {
    return "Entregue";
  }

  if (normalizedStatus === "retirada concluida") {
    return "Retirada concluida";
  }

  if (normalizedStatus === "cancelado") {
    return "Cancelado";
  }

  return "";
};

let sqlClient = null;
let schemaReadyPromise = null;

const getStorageMode = () => {
  if (String(process.env.DATABASE_URL || "").trim()) {
    return "neon";
  }

  return process.env.NODE_ENV === "production" ? "disabled" : "file";
};

const assertStorageIsAvailable = () => {
  if (getStorageMode() === "disabled") {
    const error = new Error(
      "DATABASE_URL ainda nao foi configurada. Em producao, os pedidos so podem ser salvos com banco persistente."
    );
    error.statusCode = 503;
    throw error;
  }
};

const getSql = () => {
  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }

  return sqlClient;
};

const ensureNeonSchema = async () => {
  if (schemaReadyPromise) {
    return schemaReadyPromise;
  }

  const sql = getSql();
  schemaReadyPromise = (async () => {
    if (
      await assertMigrationManagedRelations({
        sql,
        relations: ["customers", "orders", "order_items", "order_status_events"],
        component: "pedidos",
      })
    ) {
      return;
    }

    await sql`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        customer_key TEXT NOT NULL,
        tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
        restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default',
        restaurant_key TEXT NOT NULL DEFAULT 'default',
        profile_id TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        public_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
        restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default',
        restaurant_key TEXT NOT NULL DEFAULT 'default',
        customer_id TEXT NOT NULL REFERENCES customers(id),
        customer_key TEXT NOT NULL,
        profile_id TEXT NOT NULL DEFAULT '',
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_email TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        order_type TEXT NOT NULL,
        fulfillment_mode TEXT NOT NULL,
        timing_mode TEXT NOT NULL,
        scheduled_for TIMESTAMPTZ,
        scheduled_date TEXT NOT NULL DEFAULT '',
        scheduled_time TEXT NOT NULL DEFAULT '',
        scheduled_label TEXT NOT NULL DEFAULT '',
        payment_method TEXT NOT NULL,
        needs_change BOOLEAN NOT NULL DEFAULT FALSE,
        cash_amount NUMERIC(10, 2),
        change_amount NUMERIC(10, 2),
        item_count INTEGER NOT NULL DEFAULT 0,
        subtotal NUMERIC(10, 2) NOT NULL,
        addons_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
        delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
        total NUMERIC(10, 2) NOT NULL,
        customer_notes TEXT NOT NULL DEFAULT '',
        address_line TEXT NOT NULL DEFAULT '',
        address_number TEXT NOT NULL DEFAULT '',
        address_complement TEXT NOT NULL DEFAULT '',
        address_reference TEXT NOT NULL DEFAULT '',
        address_postal_code TEXT NOT NULL DEFAULT '',
        address_neighborhood TEXT NOT NULL DEFAULT '',
        address_city TEXT NOT NULL DEFAULT '',
        address_state TEXT NOT NULL DEFAULT '',
        address_full TEXT NOT NULL DEFAULT '',
        delivery_distance_text TEXT NOT NULL DEFAULT '',
        delivery_route_band TEXT NOT NULL DEFAULT '',
        delivery_estimate_text TEXT NOT NULL DEFAULT '',
        latest_status_note TEXT NOT NULL DEFAULT '',
        request_signature TEXT NOT NULL,
        raw_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
        restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default',
        restaurant_key TEXT NOT NULL DEFAULT 'default',
        sort_order INTEGER NOT NULL DEFAULT 0,
        item_type TEXT NOT NULL,
        source_item_id TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
        total_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
        metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS order_status_events (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
        restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default',
        restaurant_key TEXT NOT NULL DEFAULT 'default',
        action TEXT NOT NULL DEFAULT 'status_updated',
        status TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'system',
        admin_login TEXT NOT NULL DEFAULT '',
        admin_display_name TEXT NOT NULL DEFAULT '',
        metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default'
    `;

    await sql`
      ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default'
    `;

    await sql`
      ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default'
    `;

    await sql`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default'
    `;

    await sql`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default'
    `;

    await sql`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default'
    `;

    await sql`
      ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default'
    `;

    await sql`
      ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default'
    `;

    await sql`
      ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default'
    `;

    await sql`
      ALTER TABLE order_status_events
      ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default'
    `;

    await sql`
      ALTER TABLE order_status_events
      ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default'
    `;

    await sql`
      ALTER TABLE order_status_events
      ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default'
    `;

    await sql`
      ALTER TABLE customers
      DROP CONSTRAINT IF EXISTS customers_customer_key_key
    `;

    await sql`
      ALTER TABLE orders
      DROP CONSTRAINT IF EXISTS orders_public_id_key
    `;

    await sql`
      ALTER TABLE order_status_events
      ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT 'status_updated'
    `;

    await sql`
      ALTER TABLE order_status_events
      ADD COLUMN IF NOT EXISTS admin_login TEXT NOT NULL DEFAULT ''
    `;

    await sql`
      ALTER TABLE order_status_events
      ADD COLUMN IF NOT EXISTS admin_display_name TEXT NOT NULL DEFAULT ''
    `;

    await sql`
      ALTER TABLE order_status_events
      ADD COLUMN IF NOT EXISTS metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS orders_status_created_at_idx
      ON orders (status, created_at DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS customers_restaurant_key_customer_key_idx
      ON customers (restaurant_key, customer_key)
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_restaurant_customer_key_uidx
      ON customers (tenant_id, restaurant_id, customer_key)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS customers_tenant_restaurant_idx
      ON customers (tenant_id, restaurant_id)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS orders_restaurant_key_status_created_at_idx
      ON orders (restaurant_key, status, created_at DESC)
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS orders_tenant_restaurant_public_id_uidx
      ON orders (tenant_id, restaurant_id, public_id)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS orders_tenant_restaurant_status_created_at_idx
      ON orders (tenant_id, restaurant_id, status, created_at DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS orders_customer_key_created_at_idx
      ON orders (customer_key, created_at DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS orders_restaurant_key_customer_key_created_at_idx
      ON orders (restaurant_key, customer_key, created_at DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS orders_tenant_restaurant_customer_key_created_at_idx
      ON orders (tenant_id, restaurant_id, customer_key, created_at DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS orders_request_signature_idx
      ON orders (request_signature)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS orders_restaurant_key_request_signature_idx
      ON orders (restaurant_key, customer_key, request_signature)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS orders_tenant_restaurant_request_signature_idx
      ON orders (tenant_id, restaurant_id, customer_key, request_signature)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS order_items_order_id_idx
      ON order_items (order_id, sort_order)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS order_items_restaurant_key_order_id_idx
      ON order_items (restaurant_key, order_id, sort_order)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS order_items_tenant_restaurant_order_id_idx
      ON order_items (tenant_id, restaurant_id, order_id, sort_order)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS order_status_events_order_id_created_at_idx
      ON order_status_events (order_id, created_at DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS order_status_events_restaurant_key_order_id_created_at_idx
      ON order_status_events (restaurant_key, order_id, created_at DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS order_status_events_tenant_restaurant_order_id_created_at_idx
      ON order_status_events (tenant_id, restaurant_id, order_id, created_at DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS order_status_events_admin_login_created_at_idx
      ON order_status_events (admin_login, created_at DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS order_status_events_action_created_at_idx
      ON order_status_events (action, created_at DESC)
    `;
  })().catch((error) => {
    schemaReadyPromise = null;
    throw error;
  });

  return schemaReadyPromise;
};

const ensureFileStore = async () => {
  await fs.mkdir(path.dirname(LOCAL_STORAGE_FILE), { recursive: true });

  try {
    await fs.access(LOCAL_STORAGE_FILE);
  } catch (error) {
    await fs.writeFile(
      LOCAL_STORAGE_FILE,
      JSON.stringify(
        {
          version: 1,
          customers: [],
          orders: [],
        },
        null,
        2
      )
    );
  }
};

const readFileStore = async () => {
  await ensureFileStore();
  const contents = await fs.readFile(LOCAL_STORAGE_FILE, "utf8");

  try {
    const parsed = JSON.parse(contents);
    return {
      version: 1,
      customers: Array.isArray(parsed?.customers) ? parsed.customers : [],
      orders: Array.isArray(parsed?.orders) ? parsed.orders : [],
    };
  } catch (error) {
    return {
      version: 1,
      customers: [],
      orders: [],
    };
  }
};

const writeFileStore = async (store) => {
  await fs.mkdir(path.dirname(LOCAL_STORAGE_FILE), { recursive: true });
  await fs.writeFile(LOCAL_STORAGE_FILE, JSON.stringify(store, null, 2));
};

const scopeOrdersByTenant = (orders = [], tenant) =>
  (Array.isArray(orders) ? orders : []).filter((order) => matchesTenantScope(order, tenant));

const scopeCustomersByTenant = (customers = [], tenant) =>
  (Array.isArray(customers) ? customers : []).filter((customer) =>
    matchesTenantScope(customer, tenant)
  );

const getTenantStoreOptions = (tenant) => ({
  tenantContext: tenant.tenantContext,
});

const buildPublicOrderId = () => {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${PUBLIC_ORDER_PREFIX}-${yyyy}${mm}${dd}-${suffix}`;
};

const toIsoString = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const toNumberOrNull = (value) => {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeItemRecord = (item) => ({
  id: item.id,
  sortOrder: Number(item.sortOrder || 0),
  sourceItemId: item.sourceItemId || "",
  type: item.itemType || item.type || "product",
  name: item.name,
  category: item.category || "",
  quantity: Number(item.quantity || 0),
  unitPrice: Number(item.unitPrice || 0),
  totalPrice: Number(item.totalPrice || 0),
  metadata: item.metadata || {},
});

const normalizeStatusEvent = (entry, fallbackStatus, fallbackCreatedAt) => ({
  id: entry?.id || crypto.randomUUID(),
  status:
    resolveCanonicalOrderStatus(
      entry?.status || fallbackStatus,
      entry?.fulfillmentMode || entry?.fulfillment_mode || ""
    ) ||
    entry?.status ||
    fallbackStatus,
  note: entry?.note || "",
  source: entry?.source || "system",
  createdAt: toIsoString(entry?.createdAt || fallbackCreatedAt) || toIsoString(fallbackCreatedAt),
});

const normalizeAuditMetadata = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce((summary, [key, entryValue]) => {
    if (typeof entryValue === "undefined") {
      return summary;
    }

    summary[key] = entryValue;
    return summary;
  }, {});
};

const getAuditActionLabel = (action, status = "") => {
  const normalizedAction = String(action || "").trim();
  const canonicalStatus = resolveCanonicalOrderStatus(status) || String(status || "").trim();

  if (normalizedAction === "order_finalized" && canonicalStatus === "Retirada concluida") {
    return "Retirada concluida";
  }

  return AUDIT_ACTION_LABELS[normalizedAction] || (canonicalStatus ? `Status ${canonicalStatus}` : "Atualizacao operacional");
};

const buildAuditEvent = ({
  action,
  status,
  note = "",
  source = "system",
  adminLogin = "",
  adminDisplayName = "",
  metadata = {},
  createdAt = new Date().toISOString(),
} = {}) => ({
  id: crypto.randomUUID(),
  action: String(action || "status_updated").trim() || "status_updated",
  status: resolveCanonicalOrderStatus(status, metadata?.fulfillmentMode || metadata?.fulfillment_mode) || String(status || "").trim(),
  note: String(note || "").trim(),
  source: String(source || "system").trim() || "system",
  adminLogin: String(adminLogin || "").trim().toLowerCase(),
  adminDisplayName: String(adminDisplayName || "").trim(),
  metadata: normalizeAuditMetadata(metadata),
  createdAt: toIsoString(createdAt) || new Date().toISOString(),
});

const resolveAuditAction = ({
  previousStatus = "",
  nextStatus = "",
  fulfillmentMode = "",
  manual = false,
} = {}) => {
  const canonicalPreviousStatus = resolveCanonicalOrderStatus(previousStatus, fulfillmentMode);
  const canonicalNextStatus = resolveCanonicalOrderStatus(nextStatus, fulfillmentMode);

  if (manual && canonicalPreviousStatus === canonicalNextStatus) {
    return "manual_order_update";
  }

  if (canonicalPreviousStatus === "Recebido" && canonicalNextStatus === "Aceito") {
    return "order_accepted";
  }

  if (canonicalNextStatus === "Em preparo") {
    return "order_marked_preparing";
  }

  if (canonicalNextStatus === "Pronto") {
    return "order_marked_ready";
  }

  if (canonicalNextStatus === "Saiu para entrega") {
    return "order_out_for_delivery";
  }

  if (canonicalNextStatus === "Retirada concluida") {
    return "order_marked_picked_up";
  }

  if (canonicalNextStatus === "Entregue") {
    return "order_finalized";
  }

  if (canonicalNextStatus === "Cancelado") {
    return "order_cancelled";
  }

  return "status_updated";
};

const buildAuditNote = ({ action, status, note = "" }) => {
  const normalizedNote = String(note || "").replace(/\s+/g, " ").trim().slice(0, 240);

  if (normalizedNote) {
    return normalizedNote;
  }

  if (action === "order_created") {
    return DEFAULT_INITIAL_STATUS_NOTE;
  }

  if (action === "order_accepted") {
    return "Pedido aceito pela operacao.";
  }

  if (action === "order_marked_preparing") {
    return "Pedido encaminhado para a cozinha.";
  }

  if (action === "order_marked_ready") {
    return "Pedido finalizado na cozinha e pronto para expedicao.";
  }

  if (action === "order_out_for_delivery") {
    return "Pedido saiu para entrega.";
  }

  if (action === "order_marked_picked_up") {
    return "Retirada concluida no gestor.";
  }

  if (action === "order_finalized") {
    return "Entrega concluida no gestor.";
  }

  if (action === "order_cancelled") {
    return "Pedido cancelado no gestor.";
  }

  if (action === "manual_order_update") {
    return DEFAULT_MANUAL_AUDIT_NOTE;
  }

  return `${DEFAULT_ADMIN_STATUS_NOTE} Novo status: ${status}.`;
};

const normalizeAuditEvent = (entry, fallbackRecord = {}) => {
  const fallbackStatus = String(fallbackRecord.status || "").trim();
  const metadata =
    normalizeAuditMetadata(entry?.metadata) ||
    normalizeAuditMetadata(entry?.metadataJson) ||
    normalizeAuditMetadata(entry?.metadata_json);
  const fulfillmentMode =
    metadata?.fulfillmentMode ||
    metadata?.fulfillment_mode ||
    fallbackRecord.fulfillmentMode ||
    fallbackRecord.fulfillment_mode ||
    "";
  const status =
    resolveCanonicalOrderStatus(entry?.status || fallbackStatus || "", fulfillmentMode) ||
    String(entry?.status || fallbackStatus || "").trim();
  const rawAction = String(entry?.action || "").trim();
  const action =
    rawAction ||
    (String(entry?.source || "").trim() === "system" &&
    String(entry?.note || "").trim() === DEFAULT_INITIAL_STATUS_NOTE
      ? "order_created"
      : "status_updated");
  const adminLogin = String(entry?.adminLogin || entry?.admin_login || "").trim().toLowerCase();
  const adminDisplayName = String(entry?.adminDisplayName || entry?.admin_display_name || "").trim();
  const createdAt =
    toIsoString(entry?.createdAt || entry?.created_at || fallbackRecord.updatedAt || fallbackRecord.createdAt) ||
    toIsoString(fallbackRecord.updatedAt || fallbackRecord.createdAt) ||
    new Date().toISOString();

  return {
    id: entry?.id || crypto.randomUUID(),
    action,
    actionLabel: getAuditActionLabel(action, status),
    status,
    note: String(entry?.note || "").trim(),
    source: String(entry?.source || "system").trim() || "system",
    adminLogin,
    adminDisplayName,
    metadata,
    createdAt,
  };
};

const buildFallbackStatusHistory = (record) => [
  normalizeStatusEvent(
    {
      status: record.status,
      note: record.latestStatusNote || DEFAULT_INITIAL_STATUS_NOTE,
      source: "system",
      createdAt: record.updatedAt || record.createdAt,
    },
    record.status,
    record.createdAt
  ),
];

const getStatusHistory = (record) => {
  const history = Array.isArray(record.statusHistory) ? record.statusHistory : [];

  if (history.length === 0) {
    return buildFallbackStatusHistory(record);
  }

  return history
    .map((entry) => normalizeStatusEvent(entry, record.status, record.createdAt))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
};

const buildFallbackAuditTrail = (record) => [
  normalizeAuditEvent(
    buildAuditEvent({
      action: "order_created",
      status: record.status,
      note: record.latestStatusNote || DEFAULT_INITIAL_STATUS_NOTE,
      source: "system",
      metadata: {
        createdBy: "site",
      },
      createdAt: record.createdAt,
    }),
    record
  ),
];

const getAuditTrail = (record) => {
  const rawAuditTrail = Array.isArray(record.auditTrail)
    ? record.auditTrail
    : Array.isArray(record.statusHistory)
      ? record.statusHistory
      : [];

  if (rawAuditTrail.length === 0) {
    return buildFallbackAuditTrail(record);
  }

  return rawAuditTrail
    .map((entry) => normalizeAuditEvent(entry, record))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
};

const mapAuditTrailToPublicStatusHistory = (record) =>
  getAuditTrail(record).map((entry) => ({
    id: entry.id,
    status: entry.status || record.status,
    note: entry.note || DEFAULT_INITIAL_STATUS_NOTE,
    source: entry.source || "system",
    createdAt: entry.createdAt,
  }));

const getOrderLifecycleTimestamps = (record) => {
  const fulfillmentMode = record?.fulfillmentMode || record?.fulfillment_mode || "";
  const status = resolveCanonicalOrderStatus(record?.status || "", fulfillmentMode) || String(record?.status || "").trim();
  const fallbackUpdatedAt = toIsoString(record?.updatedAt || record?.updated_at || record?.createdAt || record?.created_at);

  const auditTrail =
    Array.isArray(record?.auditTrail) || Array.isArray(record?.statusHistory) ? getAuditTrail(record) : [];
  const findAuditTimestamp = (predicate) => auditTrail.find(predicate)?.createdAt || "";
  const completedAt =
    toIsoString(record?.completedAt || record?.completed_at) ||
    findAuditTimestamp(
      (entry) => entry.action === "order_marked_picked_up" || entry.action === "order_finalized"
    ) ||
    ((status === "Entregue" || status === "Retirada concluida") && fallbackUpdatedAt ? fallbackUpdatedAt : "");
  const cancelledAt =
    toIsoString(record?.cancelledAt || record?.cancelled_at) ||
    findAuditTimestamp((entry) => entry.action === "order_cancelled" || entry.status === "Cancelado") ||
    (status === "Cancelado" && fallbackUpdatedAt ? fallbackUpdatedAt : "");
  const closedAt =
    toIsoString(record?.closedAt || record?.closed_at) || cancelledAt || completedAt || "";

  return {
    completedAt,
    cancelledAt,
    closedAt,
    operationalCreatedDate: toOperationalDateInput(record?.createdAt || record?.created_at || ""),
    operationalClosedDate: closedAt ? toOperationalDateInput(closedAt) : "",
  };
};

const buildItemPreview = (items) => {
  const normalizedItems = Array.isArray(items)
    ? items
        .map((item) => ({
          name: String(item?.name || "").trim(),
          type: String(item?.type || item?.itemType || "product").trim().toLowerCase(),
        }))
        .filter((item) => item.name)
    : [];

  if (normalizedItems.length === 0) {
    return "";
  }

  const primaryItems = normalizedItems.filter((item) => item.type === "product");
  const previewSource = primaryItems.length > 0 ? primaryItems : normalizedItems;
  const uniqueNames = [];

  previewSource.forEach((item) => {
    const normalizedName = item.name.toLowerCase();

    if (!uniqueNames.some((entry) => entry.toLowerCase() === normalizedName)) {
      uniqueNames.push(item.name);
    }
  });

  const visibleNames = uniqueNames.slice(0, 2);
  const remainingItems = Math.max(uniqueNames.length - visibleNames.length, 0);

  if (remainingItems === 0) {
    return visibleNames.join(", ");
  }

  return `${visibleNames.join(", ")} +${remainingItems} item(ns)`;
};

const isCompletedStatus = (status, fulfillmentMode = "") => {
  const canonicalStatus = resolveCanonicalOrderStatus(status, fulfillmentMode);
  return canonicalStatus === "Entregue" || canonicalStatus === "Retirada concluida";
};

const isCompletedOrderArchivedFromOperations = (record, operationalWindow = getOperationalDayWindow()) => {
  if (!isCompletedStatus(record?.status, record?.fulfillmentMode || record?.fulfillment_mode)) {
    return false;
  }

  const { completedAt } = getOrderLifecycleTimestamps(record);
  return completedAt ? !isWithinOperationalWindow(completedAt, operationalWindow) : true;
};

const isOrderVisibleInOperations = (record, operationalWindow = getOperationalDayWindow()) => {
  if (!record) {
    return false;
  }

  if (isCompletedOrderArchivedFromOperations(record, operationalWindow)) {
    return false;
  }

  return true;
};

const formatOrderSummary = (record) => ({
  ...getOrderLifecycleTimestamps(record),
  id: record.id,
  publicId: record.publicId,
  status:
    resolveCanonicalOrderStatus(record.status, record.fulfillmentMode || record.fulfillment_mode) ||
    record.status,
  customerName: record.customerName,
  customerPhone: record.customerPhone,
  customerEmail: record.customerEmail || "",
  orderType: record.orderType,
  fulfillmentMode: record.fulfillmentMode,
  timingMode: record.timingMode,
  scheduledFor: record.scheduledFor || null,
  scheduledLabel: record.scheduledLabel || "",
  paymentMethod: record.paymentMethod,
  itemCount: Number(record.itemCount || 0),
  subtotal: Number(record.subtotal || 0),
  deliveryFee: Number(record.deliveryFee || 0),
  totalAmount: Number(record.total || 0),
  createdAt: record.createdAt,
  updatedAt: record.updatedAt || record.createdAt,
  addressFull: record.addressFull || "",
  latestStatusNote: record.latestStatusNote || "",
  itemPreview: record.itemPreview || buildItemPreview(record.items),
  items: Array.isArray(record.items) ? record.items.map(normalizeItemRecord) : [],
});

const formatOrderDetails = (record) => ({
  ...formatOrderSummary(record),
  customerId: record.customerId || "",
  customerKey: record.customerKey || "",
  profileId: record.profileId || "",
  needsChange: Boolean(record.needsChange),
  cashAmount: toNumberOrNull(record.cashAmount),
  changeAmount: toNumberOrNull(record.changeAmount),
  addonsTotal: Number(record.addonsTotal || 0),
  customerNotes: record.customerNotes || "",
  scheduledDate: record.scheduledDate || "",
  scheduledTime: record.scheduledTime || "",
  addressLine: record.addressLine || "",
  addressNumber: record.addressNumber || "",
  addressComplement: record.addressComplement || "",
  addressReference: record.addressReference || "",
  addressPostalCode: record.addressPostalCode || "",
  addressNeighborhood: record.addressNeighborhood || "",
  addressCity: record.addressCity || "",
  addressState: record.addressState || "",
  deliveryDistanceText: record.deliveryDistanceText || "",
  deliveryRouteBand: record.deliveryRouteBand || "",
  deliveryEstimateText: record.deliveryEstimateText || "",
  rawPayload: record.rawPayload && typeof record.rawPayload === "object" ? record.rawPayload : {},
  items: Array.isArray(record.items) ? record.items.map(normalizeItemRecord) : [],
  statusHistory: mapAuditTrailToPublicStatusHistory(record),
  auditTrail: getAuditTrail(record),
});

const formatCustomerTrackingOrder = (record) => {
  const order =
    record && typeof record === "object" && Object.prototype.hasOwnProperty.call(record, "totalAmount")
      ? record
      : formatOrderDetails(record);

  return {
    id: order.id,
    publicId: order.publicId,
    status: resolveCanonicalOrderStatus(order.status, order.fulfillmentMode) || order.status,
    orderType: order.orderType,
    fulfillmentMode: order.fulfillmentMode,
    timingMode: order.timingMode,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    scheduledFor: order.scheduledFor,
    scheduledDate: order.scheduledDate,
    scheduledTime: order.scheduledTime,
    scheduledLabel: order.scheduledLabel,
    paymentMethod: order.paymentMethod,
    needsChange: order.needsChange,
    cashAmount: order.cashAmount,
    changeAmount: order.changeAmount,
    itemCount: order.itemCount,
    subtotal: order.subtotal,
    addonsTotal: order.addonsTotal,
    deliveryFee: order.deliveryFee,
    totalAmount: order.totalAmount,
    customerNotes: order.customerNotes,
    addressFull: order.addressFull,
    addressComplement: order.addressComplement,
    addressReference: order.addressReference,
    addressNeighborhood: order.addressNeighborhood,
    addressCity: order.addressCity,
    addressState: order.addressState,
    deliveryDistanceText: order.deliveryDistanceText,
    deliveryRouteBand: order.deliveryRouteBand,
    deliveryEstimateText: order.deliveryEstimateText,
    latestStatusNote: order.latestStatusNote,
    items: order.items,
    statusHistory: order.statusHistory,
  };
};

const isFinalStatus = (status, fulfillmentMode = "") =>
  FINAL_ORDER_STATUSES.has(resolveCanonicalOrderStatus(status, fulfillmentMode));

const getNowTimestamp = () => Date.now();

const getTimingPriority = (record) => (record.timingMode === "scheduled" ? 1 : 0);

const getScheduledTimestamp = (record) => {
  const timestamp = new Date(record.scheduledFor || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
};

const getScheduledDateKey = (record) => {
  const explicitDate = String(record?.scheduledDate || record?.scheduled_date || "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(explicitDate)) {
    return explicitDate;
  }

  const scheduledTimestamp = new Date(record?.scheduledFor || record?.scheduled_for || 0).getTime();

  if (!Number.isFinite(scheduledTimestamp)) {
    return "";
  }

  return new Date(scheduledTimestamp).toISOString().slice(0, 10);
};

const isScheduledAwaitingActivation = (record, nowTimestamp = getNowTimestamp()) => {
  if (!record || isFinalStatus(record.status, record.fulfillmentMode || record.fulfillment_mode)) {
    return false;
  }

  if (String(record.timingMode || record.timing_mode || "").trim().toLowerCase() !== "scheduled") {
    return false;
  }

  const scheduledTimestamp = getScheduledTimestamp(record);
  return Number.isFinite(scheduledTimestamp) && scheduledTimestamp > nowTimestamp;
};

const isScheduledDueSoon = (record, nowTimestamp = getNowTimestamp()) => {
  if (!isScheduledAwaitingActivation(record, nowTimestamp)) {
    return false;
  }

  return getScheduledTimestamp(record) - nowTimestamp <= SCHEDULE_DUE_SOON_WINDOW_MS;
};

const getScheduledActivationStatus = (record, nowTimestamp = getNowTimestamp()) => {
  if (!isScheduledAwaitingActivation(record, nowTimestamp)) {
    return "";
  }

  return isScheduledDueSoon(record, nowTimestamp) ? "Proximo do horario" : "Agendado";
};

const formatScheduledOrderSummary = (record, nowTimestamp = getNowTimestamp()) => ({
  ...formatOrderSummary(record),
  scheduleState: getScheduledActivationStatus(record, nowTimestamp),
  scheduleDate: getScheduledDateKey(record),
  isDueSoon: isScheduledDueSoon(record, nowTimestamp),
  isAwaitingActivation: isScheduledAwaitingActivation(record, nowTimestamp),
});

const sortOrdersForAdmin = (orders) =>
  orders.slice().sort((left, right) => {
    const leftClosed = isFinalStatus(left.status, left.fulfillmentMode || left.fulfillment_mode);
    const rightClosed = isFinalStatus(right.status, right.fulfillmentMode || right.fulfillment_mode);

    if (leftClosed !== rightClosed) {
      return leftClosed ? 1 : -1;
    }

    const statusDiff =
      Number(
        ORDER_STATUS_INDEX[
          resolveCanonicalOrderStatus(left.status, left.fulfillmentMode || left.fulfillment_mode)
        ] ?? ORDER_STATUSES.length
      ) -
      Number(
        ORDER_STATUS_INDEX[
          resolveCanonicalOrderStatus(right.status, right.fulfillmentMode || right.fulfillment_mode)
        ] ?? ORDER_STATUSES.length
      );

    if (statusDiff !== 0) {
      return statusDiff;
    }

    const timingDiff = getTimingPriority(left) - getTimingPriority(right);

    if (timingDiff !== 0) {
      return timingDiff;
    }

    if (left.timingMode === "scheduled" && right.timingMode === "scheduled") {
      const scheduledDiff = getScheduledTimestamp(left) - getScheduledTimestamp(right);

      if (scheduledDiff !== 0) {
        return scheduledDiff;
      }
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

const normalizeStatusValue = (value) => {
  const legacyFinalized = normalizeStatusKey(value) === normalizeStatusKey(LEGACY_FINALIZED_STATUS);

  if (legacyFinalized) {
    return LEGACY_FINALIZED_STATUS;
  }

  return resolveCanonicalOrderStatus(value);
};

const assertValidOrderStatus = (value) => {
  const normalizedStatus = normalizeStatusValue(value);

  if (!normalizedStatus) {
    throw buildHttpError(
      400,
      "O status informado nao e valido para o pedido.",
      "invalid_order_status"
    );
  }

  return normalizedStatus;
};

const buildAdminAuditPayload = ({
  currentOrder,
  nextStatus,
  note = "",
  actor = {},
  manual = false,
} = {}) => {
  const fulfillmentMode = currentOrder?.fulfillmentMode || currentOrder?.fulfillment_mode || "";
  const previousStatus =
    resolveCanonicalOrderStatus(currentOrder?.status || "", fulfillmentMode) ||
    String(currentOrder?.status || "").trim();
  const resolvedNextStatus =
    resolveCanonicalOrderStatus(nextStatus, fulfillmentMode) || String(nextStatus || "").trim();
  const statusChanged = previousStatus !== resolvedNextStatus;
  const action = resolveAuditAction({
    previousStatus,
    nextStatus: resolvedNextStatus,
    fulfillmentMode,
    manual,
  });
  const auditNote = buildAuditNote({
    action,
    status: resolvedNextStatus,
    note,
  });
  const auditEvent = buildAuditEvent({
    action,
    status: resolvedNextStatus,
    note: auditNote,
    source: "admin",
    adminLogin: actor?.login || "",
    adminDisplayName: actor?.displayName || "",
    metadata: {
      previousStatus,
      nextStatus: resolvedNextStatus,
      fulfillmentMode,
      manual: Boolean(manual),
      orderType: currentOrder?.orderType || "",
    },
  });
  const messageByAction = {
    order_accepted: "Pedido aceito e registrado na auditoria.",
    order_marked_preparing: "Pedido movido para preparo e registrado na auditoria.",
    order_marked_ready: "Pedido marcado como pronto e registrado na auditoria.",
    order_out_for_delivery: "Saida para entrega registrada na auditoria.",
    order_marked_picked_up: "Retirada do pedido registrada na auditoria.",
    order_finalized: "Entrega concluida e registrada na auditoria.",
    order_cancelled: "Cancelamento do pedido registrado na auditoria.",
    manual_order_update: "Registro manual adicionado ao historico do pedido.",
    status_updated: `Status atualizado para ${resolvedNextStatus}.`,
  };

  return {
    action,
    actionLabel: getAuditActionLabel(action, resolvedNextStatus),
    auditEvent,
    auditNote,
    statusChanged,
    message: messageByAction[action] || `Status atualizado para ${resolvedNextStatus}.`,
    nextStatus: resolvedNextStatus,
    previousStatus,
  };
};

const matchAuditLogFilters = (event, filters = {}) => {
  const adminLoginFilter = String(filters.adminLogin || "").trim().toLowerCase();
  const actionFilter = String(filters.action || "").trim();
  const orderFilter = String(filters.orderQuery || "").trim().toLowerCase();

  if (adminLoginFilter && String(event.adminLogin || "").trim().toLowerCase() !== adminLoginFilter) {
    return false;
  }

  if (actionFilter && String(event.action || "").trim() !== actionFilter) {
    return false;
  }

  if (!orderFilter) {
    return true;
  }

  const searchableValue = [
    event.orderId,
    event.publicId,
    event.customerName,
    event.status,
    event.note,
    event.adminLogin,
    event.adminDisplayName,
  ]
    .join(" ")
    .toLowerCase();

  return searchableValue.includes(orderFilter);
};

const formatAuditLogEvent = (event, order) => ({
  id: event.id,
  action: event.action,
  actionLabel: event.actionLabel || getAuditActionLabel(event.action, event.status),
  status: event.status,
  note: event.note || "",
  source: event.source || "system",
  adminLogin: event.adminLogin || "",
  adminDisplayName: event.adminDisplayName || "",
  metadata: normalizeAuditMetadata(event.metadata),
  createdAt: event.createdAt,
  orderId: order.id,
  publicId: order.publicId,
  customerName: order.customerName,
});

const findOrderRecord = (orders, identifier) => {
  const normalizedIdentifier = String(identifier || "").trim();

  if (!normalizedIdentifier) {
    return null;
  }

  return (
    orders.find((order) => order.id === normalizedIdentifier) ||
    orders.find((order) => order.publicId === normalizedIdentifier)
  );
};

const pickActiveOrder = (orders, customerKey) =>
  sortOrdersForAdmin(
    orders.filter(
      (order) =>
        order.customerKey === customerKey &&
        !isFinalStatus(order.status, order.fulfillmentMode || order.fulfillment_mode)
    )
  )[0] || null;

const buildDashboardStats = (orders) => {
  const dayWindow = getOperationalDayWindow();
  const nowTimestamp = getNowTimestamp();
  const canonicalOrders = orders.map((order) => ({
    ...order,
    status:
      resolveCanonicalOrderStatus(order.status, order.fulfillmentMode || order.fulfillment_mode) ||
      order.status,
  }));
  const operationalOrders = canonicalOrders.filter((order) => isOrderVisibleInOperations(order, dayWindow));
  const totalOrders = operationalOrders.length;
  const visibleCompletedOrders = canonicalOrders.filter(
    (order) => isCompletedStatus(order.status, order.fulfillmentMode || order.fulfillment_mode) &&
      !isCompletedOrderArchivedFromOperations(order, dayWindow)
  );
  const newOrders = operationalOrders.filter((order) => order.status === "Recebido").length;
  const activeOrders = operationalOrders.filter(
    (order) =>
      !isFinalStatus(order.status, order.fulfillmentMode || order.fulfillment_mode) &&
      !isScheduledAwaitingActivation(order, nowTimestamp)
  ).length;
  const scheduledOrders = operationalOrders.filter(
    (order) =>
      order.timingMode === "scheduled" &&
      !isFinalStatus(order.status, order.fulfillmentMode || order.fulfillment_mode) &&
      isScheduledAwaitingActivation(order, nowTimestamp)
  ).length;
  const todayOrdersList = canonicalOrders.filter((order) => isWithinOperationalWindow(order.createdAt, dayWindow));
  const todayRevenue = visibleCompletedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);

  const byStatus = ORDER_STATUSES.reduce((summary, status) => {
    summary[status] = canonicalOrders.filter((order) => {
      if (order.status !== status) {
        return false;
      }

      if (status === "Entregue" || status === "Retirada concluida") {
        return !isCompletedOrderArchivedFromOperations(order, dayWindow);
      }

      return true;
    }).length;
    return summary;
  }, {});

  return {
    totalOrders,
    newOrders,
    activeOrders,
    scheduledOrders,
    todayOrders: todayOrdersList.length,
    preparingOrders: Number(byStatus["Em preparo"] || 0),
    readyOrders: Number(byStatus.Pronto || 0),
    deliveryOrders: Number(byStatus["Saiu para entrega"] || 0),
    todayRevenue: Number(todayRevenue.toFixed(2)),
    byStatus,
  };
};

const buildOperationalOrderScope = (orders, now = new Date()) => {
  const operationalWindow = getOperationalDayWindow(now);
  return orders.filter((order) => isOrderVisibleInOperations(order, operationalWindow));
};

const buildDashboardOrderScope = (orders, limit = 40, now = new Date()) =>
  sortOrdersForAdmin(buildOperationalOrderScope(orders, now)).slice(0, limit);

const FINANCE_PERIOD_OPTIONS = Object.freeze([
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "month_current", label: "Mes atual" },
  { key: "custom", label: "Personalizado" },
]);

const normalizeFinanceFilters = (filters = {}, options = {}) => {
  const now = options.now instanceof Date ? options.now : new Date();
  const requestedPeriod = String(filters.period || "").trim().toLowerCase();
  const period = FINANCE_PERIOD_OPTIONS.some((entry) => entry.key === requestedPeriod)
    ? requestedPeriod
    : "today";
  let window;

  if (period === "custom") {
    window = parseOperationalCustomWindow(filters.startDate, filters.endDate, now);
  } else if (period === "month_current") {
    const todayWindow = getOperationalDayWindow(now);
    const [year, month] = String(todayWindow.startDate || "").split("-");
    const monthStartMs = operationalDateKeyToStartMs(`${year}-${month}-01`);
    window = Number.isFinite(monthStartMs)
      ? buildOperationalWindow(monthStartMs, todayWindow.endMs)
      : buildOperationalWindowForPreset("30d", now);
  } else {
    window = buildOperationalWindowForPreset(period, now);
  }

  return {
    period,
    periodLabel: FINANCE_PERIOD_OPTIONS.find((entry) => entry.key === period)?.label || "Hoje",
    startDate: window.startDate,
    endDate: window.endDate,
    startIso: window.startIso,
    endIso: window.endIso,
    startMs: window.startMs,
    endMs: window.endMs,
    dayCount: window.dayCount,
    periodKey: `${period}:${window.startDate}:${window.endDate}`,
    rangeLabel:
      period === "today"
        ? `Dia operacional ${window.startDate}`
        : `${window.startDate} ate ${window.endDate}`,
    cutoffTime: window.cutoffTime,
  };
};

const getFinanceReferenceTimestamp = (order) => {
  const status = resolveCanonicalOrderStatus(order?.status, order?.fulfillmentMode);

  if (status === "Entregue" || status === "Retirada concluida") {
    return order.completedAt || order.closedAt || order.updatedAt || order.createdAt;
  }

  if (status === "Cancelado") {
    return order.cancelledAt || order.closedAt || order.updatedAt || order.createdAt;
  }

  return order.createdAt || order.updatedAt;
};

const getFinanceStatus = (order) => {
  const status = resolveCanonicalOrderStatus(order?.status, order?.fulfillmentMode);

  if (status === "Cancelado") {
    return "cancelled";
  }

  if (status === "Entregue" || status === "Retirada concluida") {
    return "paid";
  }

  return "pending";
};

const calculateOrderDiscountAmount = (order) =>
  Number(
    (Array.isArray(order?.items) ? order.items : [])
      .reduce((sum, item) => {
        const promotion = item?.metadata?.promotion || {};
        const quantity = Number(item?.quantity || 0);
        const savingsPerUnit = Number(promotion.savingsPerUnit || 0);

        if (!Number.isFinite(quantity) || !Number.isFinite(savingsPerUnit)) {
          return sum;
        }

        return sum + Math.max(0, savingsPerUnit * quantity);
      }, 0)
      .toFixed(2)
  );

const getDeliveryPayoutSettingsSummary = (settings = {}) => ({
  mode: settings.courierPayout?.mode || "fixed_by_band",
  percentage: Number(settings.courierPayout?.percentage || 0),
  manualAmount: Number(settings.courierPayout?.manualAmount || 0),
  distanceBands: Array.isArray(settings.distanceBands) ? settings.distanceBands : [],
});

const calculateDeliveryPayoutForOrder = (order, settings = {}) => {
  if (order?.fulfillmentMode !== "delivery") {
    return 0;
  }

  const deliveryFee = Number(order.deliveryFee || 0);
  const payout = getDeliveryPayoutSettingsSummary(settings);

  if (payout.mode === "percentage_fee") {
    return Number(Math.max(0, deliveryFee * (payout.percentage / 100)).toFixed(2));
  }

  if (payout.mode === "manual") {
    return Number(Math.max(0, payout.manualAmount).toFixed(2));
  }

  const matchingBand = payout.distanceBands.find(
    (band) =>
      band?.isActive !== false &&
      Math.abs(Number(band.customerFee || 0) - deliveryFee) < 0.01
  );

  return Number(Math.max(0, Number(matchingBand?.courierFee || 0)).toFixed(2));
};

const buildFinancePaymentBreakdown = (paidOrders, totalReceived) => {
  const groups = [
    { key: "dinheiro", label: "Dinheiro", methods: ["dinheiro"] },
    { key: "pix", label: "Pix", methods: ["pix"] },
    { key: "cartao", label: "Cartao", methods: ["credito", "debito"] },
    { key: "online_outros", label: "Online/outros", methods: [] },
  ];

  return groups.map((group) => {
    const filteredOrders = paidOrders.filter((order) =>
      group.methods.length
        ? group.methods.includes(order.paymentMethod)
        : !["dinheiro", "pix", "credito", "debito"].includes(order.paymentMethod)
    );
    const total = Number(
      filteredOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0).toFixed(2)
    );

    return {
      key: group.key,
      label: group.label,
      count: filteredOrders.length,
      total,
      percent: totalReceived > 0 ? Number(((total / totalReceived) * 100).toFixed(1)) : 0,
    };
  });
};

const buildFinanceTrend = (paidOrders, filters) => {
  const dayCount = Math.min(Math.max(Number(filters.dayCount || 1), 1), 62);
  const dayMs = 24 * 60 * 60 * 1000;
  const buckets = Array.from({ length: dayCount }, (_, index) => {
    const bucketStartMs = Number(filters.startMs || Date.now()) + index * dayMs;
    const dateKey = toOperationalDateInput(bucketStartMs);

    return {
      key: dateKey,
      label: dateKey.slice(5).replace("-", "/"),
      total: 0,
      count: 0,
    };
  });
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  paidOrders.forEach((order) => {
    const bucket = bucketMap.get(toOperationalDateInput(getFinanceReferenceTimestamp(order)));

    if (!bucket) {
      return;
    }

    bucket.total = Number((bucket.total + Number(order.totalAmount || 0)).toFixed(2));
    bucket.count += 1;
  });

  return buckets;
};

const buildFinanceHourlyOrders = (orders) => {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}h`,
    count: 0,
  }));

  orders.forEach((order) => {
    const date = new Date(order.createdAt || getFinanceReferenceTimestamp(order));

    if (Number.isNaN(date.getTime())) {
      return;
    }

    buckets[date.getHours()].count += 1;
  });

  return buckets.filter((bucket) => bucket.count > 0);
};

const buildFinanceFulfillmentBreakdown = (orders) => {
  const deliveryOrders = orders.filter((order) => order.fulfillmentMode === "delivery");
  const pickupOrders = orders.filter((order) => order.fulfillmentMode === "pickup");

  return [
    {
      key: "delivery",
      label: "Entrega",
      count: deliveryOrders.length,
      total: Number(deliveryOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0).toFixed(2)),
    },
    {
      key: "pickup",
      label: "Retirada",
      count: pickupOrders.length,
      total: Number(pickupOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0).toFixed(2)),
    },
  ];
};

const buildFinanceSnapshot = ({
  orders = [],
  filters = {},
  generatedAt = new Date().toISOString(),
  storageMode = "",
  deliverySettings = {},
  closing = null,
} = {}) => {
  const normalizedFilters = normalizeFinanceFilters(filters);
  const normalizedOrders = Array.isArray(orders)
    ? orders
        .map((order) => formatOrderSummary(order))
        .map((order) => ({
          ...order,
          financialStatus: getFinanceStatus(order),
          occurredAt: getFinanceReferenceTimestamp(order),
          discountAmount: calculateOrderDiscountAmount(order),
          productRevenue: Number(Math.max(0, Number(order.subtotal || 0)).toFixed(2)),
          deliveryPayout: calculateDeliveryPayoutForOrder(order, deliverySettings),
        }))
    : [];
  const financeOrders = normalizedOrders.filter((order) =>
    isWithinOperationalWindow(getFinanceReferenceTimestamp(order), normalizedFilters)
  );
  const paidOrders = financeOrders.filter((order) => order.financialStatus === "paid");
  const pendingOrders = financeOrders.filter((order) => order.financialStatus === "pending");
  const cancelledOrders = financeOrders.filter((order) => order.financialStatus === "cancelled");
  const validOrders = financeOrders.filter((order) => order.financialStatus !== "cancelled");
  const grossRevenue = Number(
    validOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0).toFixed(2)
  );
  const receivedRevenue = Number(
    paidOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0).toFixed(2)
  );
  const deliveryFees = Number(
    validOrders.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0).toFixed(2)
  );
  const discountAmount = Number(
    validOrders.reduce((sum, order) => sum + Number(order.discountAmount || 0), 0).toFixed(2)
  );
  const deliveryPayout = Number(
    validOrders.reduce((sum, order) => sum + Number(order.deliveryPayout || 0), 0).toFixed(2)
  );
  const cancelledRevenue = Number(
    cancelledOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0).toFixed(2)
  );
  const pendingAmount = Number(
    pendingOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0).toFixed(2)
  );
  const paymentBreakdown = buildFinancePaymentBreakdown(paidOrders, receivedRevenue);
  const closingCountedCash = closing?.countedCash;
  const cashExpected = paymentBreakdown.find((entry) => entry.key === "dinheiro")?.total || 0;
  const pixReceived = paymentBreakdown.find((entry) => entry.key === "pix")?.total || 0;
  const cardReceived = paymentBreakdown.find((entry) => entry.key === "cartao")?.total || 0;
  const otherReceived = paymentBreakdown.find((entry) => entry.key === "online_outros")?.total || 0;
  const totalReceived =
    (typeof closingCountedCash === "number" ? closingCountedCash : cashExpected) +
    pixReceived +
    cardReceived +
    otherReceived;
  const ordersForTable = financeOrders
    .map((order) => ({
      ...order,
      outcomeType:
        order.financialStatus === "cancelled"
          ? "cancelled"
          : order.financialStatus === "paid"
            ? "paid"
            : "pending",
    }))
    .sort((left, right) => new Date(right.occurredAt || 0) - new Date(left.occurredAt || 0));

  return {
    generatedAt: toIsoString(generatedAt) || new Date().toISOString(),
    storageMode: String(storageMode || "").trim(),
    filters: normalizedFilters,
    periodOptions: FINANCE_PERIOD_OPTIONS,
    overview: {
      grossRevenue,
      netRevenue: Number(Math.max(0, grossRevenue - deliveryFees - discountAmount).toFixed(2)),
      closedRevenue: receivedRevenue,
      receivedRevenue,
      pendingAmount,
      cancelledRevenue,
      discountAmount,
      averageTicket: validOrders.length > 0 ? Number((grossRevenue / validOrders.length).toFixed(2)) : 0,
      paidAverageTicket: paidOrders.length > 0 ? Number((receivedRevenue / paidOrders.length).toFixed(2)) : 0,
      validOrders: validOrders.length,
      paidOrders: paidOrders.length,
      pendingOrders: pendingOrders.length,
      finalizedOrders: paidOrders.length,
      cancelledOrders: cancelledOrders.length,
      deliveredOrders: validOrders.filter((order) => order.fulfillmentMode === "delivery").length,
      pickedUpOrders: validOrders.filter((order) => order.fulfillmentMode === "pickup").length,
      deliveryFees,
      deliveryPayout,
    },
    paymentBreakdown,
    closing: {
      periodKey: normalizedFilters.periodKey,
      periodStartDate: normalizedFilters.startDate,
      periodEndDate: normalizedFilters.endDate,
      countedCash: typeof closingCountedCash === "number" ? closingCountedCash : null,
      notes: closing?.notes || "",
      updatedAt: closing?.updatedAt || "",
      updatedByDisplayName: closing?.updatedByDisplayName || "",
      totalExpected: receivedRevenue,
      totalReceived: Number(totalReceived.toFixed(2)),
      difference: Number((totalReceived - receivedRevenue).toFixed(2)),
      cashExpected,
      pixReceived,
      cardReceived,
      otherReceived,
    },
    charts: {
      revenueTrend: buildFinanceTrend(paidOrders, normalizedFilters),
      paymentMethods: paymentBreakdown,
      hourlyOrders: buildFinanceHourlyOrders(validOrders),
      fulfillment: buildFinanceFulfillmentBreakdown(validOrders),
    },
    deliveryPayoutSettings: getDeliveryPayoutSettingsSummary(deliverySettings),
    orders: ordersForTable,
    transactions: ordersForTable,
  };
};

const upsertCustomerInFileStore = (store, customer, tenant) => {
  const existingCustomerIndex = store.customers.findIndex(
    (entry) => entry.customerKey === customer.key && matchesTenantScope(entry, tenant)
  );
  const now = new Date().toISOString();
  const customerRecord =
    existingCustomerIndex >= 0
      ? {
          ...store.customers[existingCustomerIndex],
          tenantId: tenant.tenantId,
          restaurantId: tenant.restaurantId,
          restaurantKey: tenant.restaurantKey,
          profileId: customer.profileId || "",
          name: customer.name,
          phone: customer.phone,
          email: customer.email || "",
          updatedAt: now,
        }
      : {
          id: crypto.randomUUID(),
          tenantId: tenant.tenantId,
          restaurantId: tenant.restaurantId,
          restaurantKey: tenant.restaurantKey,
          customerKey: customer.key,
          profileId: customer.profileId || "",
          name: customer.name,
          phone: customer.phone,
          email: customer.email || "",
          createdAt: now,
          updatedAt: now,
        };

  if (existingCustomerIndex >= 0) {
    store.customers[existingCustomerIndex] = customerRecord;
  } else {
    store.customers.push(customerRecord);
  }

  return customerRecord;
};

const findDuplicateOrder = (orders, customerKey, requestSignature, tenant) =>
  orders.find((order) => {
    if (
      order.customerKey !== customerKey ||
      order.requestSignature !== requestSignature ||
      !matchesTenantScope(order, tenant)
    ) {
      return false;
    }

    return Date.now() - new Date(order.createdAt).getTime() < DUPLICATE_WINDOW_MS;
  });

const createOrderRecord = (normalizedOrder, customerRecord, tenant) => {
  const now = new Date().toISOString();
  const initialAuditEvent = buildAuditEvent({
    action: "order_created",
    status: normalizedOrder.order.status,
    note: buildAuditNote({
      action: "order_created",
      status: normalizedOrder.order.status,
      note: DEFAULT_INITIAL_STATUS_NOTE,
    }),
    source: "system",
    metadata: {
      channel: "site",
    },
    createdAt: now,
  });

  return {
    id: crypto.randomUUID(),
    publicId: buildPublicOrderId(),
    tenantId: tenant.tenantId,
    restaurantId: tenant.restaurantId,
    restaurantKey: tenant.restaurantKey,
    customerId: customerRecord.id,
    customerKey: normalizedOrder.customer.key,
    profileId: normalizedOrder.customer.profileId || "",
    customerName: normalizedOrder.customer.name,
    customerPhone: normalizedOrder.customer.phone,
    customerEmail: normalizedOrder.customer.email || "",
    status: normalizedOrder.order.status,
    orderType: normalizedOrder.order.orderType,
    fulfillmentMode: normalizedOrder.order.fulfillmentMode,
    timingMode: normalizedOrder.order.timingMode,
    scheduledFor: normalizedOrder.order.scheduledFor,
    scheduledDate: normalizedOrder.order.scheduledDate,
    scheduledTime: normalizedOrder.order.scheduledTime,
    scheduledLabel: normalizedOrder.order.scheduledLabel,
    paymentMethod: normalizedOrder.order.paymentMethod,
    needsChange: Boolean(normalizedOrder.order.needsChange),
    cashAmount: normalizedOrder.order.cashAmountProvided,
    changeAmount: normalizedOrder.order.changeAmount,
    itemCount: normalizedOrder.order.itemCount,
    subtotal: normalizedOrder.order.subtotal,
    addonsTotal: normalizedOrder.order.addonsTotal,
    deliveryFee: normalizedOrder.order.deliveryFee,
    total: normalizedOrder.order.total,
    customerNotes: normalizedOrder.order.customerNotes || "",
    addressLine: normalizedOrder.order.addressLine || "",
    addressNumber: normalizedOrder.order.addressNumber || "",
    addressComplement: normalizedOrder.order.addressComplement || "",
    addressReference: normalizedOrder.order.addressReference || "",
    addressPostalCode: normalizedOrder.order.addressPostalCode || "",
    addressNeighborhood: normalizedOrder.order.addressNeighborhood || "",
    addressCity: normalizedOrder.order.addressCity || "",
    addressState: normalizedOrder.order.addressState || "",
    addressFull: normalizedOrder.order.addressFull || "",
    deliveryDistanceText: normalizedOrder.order.deliveryDistanceText || "",
    deliveryRouteBand: normalizedOrder.order.deliveryRouteBand || "",
    deliveryEstimateText: normalizedOrder.order.deliveryEstimateText || "",
    latestStatusNote: DEFAULT_INITIAL_STATUS_NOTE,
    requestSignature: normalizedOrder.requestSignature,
    rawPayload: normalizedOrder.order.rawPayload || {},
    items: normalizedOrder.items.map((item, index) => ({
      id: crypto.randomUUID(),
      tenantId: tenant.tenantId,
      restaurantId: tenant.restaurantId,
      restaurantKey: tenant.restaurantKey,
      sortOrder: index,
      sourceItemId: item.id,
      itemType: item.type,
      name: item.name,
      category: item.category || "",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      metadata: item.metadata || {},
    })),
    auditTrail: [withTenantScope(initialAuditEvent, tenant.tenantContext)],
    statusHistory: mapAuditTrailToPublicStatusHistory({
      status: normalizedOrder.order.status,
      latestStatusNote: DEFAULT_INITIAL_STATUS_NOTE,
      auditTrail: [withTenantScope(initialAuditEvent, tenant.tenantContext)],
      createdAt: now,
      updatedAt: now,
    }),
    createdAt: now,
    updatedAt: now,
  };
};

const createOrderInFileStore = async (normalizedOrder, tenant) => {
  const store = await readFileStore();
  const duplicateOrder = findDuplicateOrder(
    store.orders,
    normalizedOrder.customer.key,
    normalizedOrder.requestSignature,
    tenant
  );

  if (duplicateOrder) {
    return {
      created: false,
      storageMode: "file",
      order: formatOrderSummary(duplicateOrder),
    };
  }

  const customerRecord = upsertCustomerInFileStore(store, normalizedOrder.customer, tenant);
  const orderRecord = createOrderRecord(normalizedOrder, customerRecord, tenant);
  store.orders.unshift(orderRecord);
  await writeFileStore(store);

  return {
    created: true,
    storageMode: "file",
    order: formatOrderSummary(orderRecord),
  };
};

const createOrderInNeon = async (normalizedOrder, tenant) => {
  await ensureNeonSchema();
  const sql = getSql();

  const duplicateRows = await sql`
    SELECT
      id,
      public_id,
      status,
      customer_name,
      customer_phone,
      customer_email,
      order_type,
      fulfillment_mode,
      timing_mode,
      scheduled_label,
      payment_method,
      item_count,
      subtotal,
      delivery_fee,
      total,
      address_full,
      created_at
    FROM orders
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
      AND customer_key = ${normalizedOrder.customer.key}
      AND request_signature = ${normalizedOrder.requestSignature}
      AND created_at >= NOW() - INTERVAL '2 minutes'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (duplicateRows.length > 0) {
    const duplicateOrder = duplicateRows[0];

    return {
      created: false,
      storageMode: "neon",
      order: {
        id: duplicateOrder.id,
        publicId: duplicateOrder.public_id,
        status: duplicateOrder.status,
        customerName: duplicateOrder.customer_name,
        customerPhone: duplicateOrder.customer_phone,
        customerEmail: duplicateOrder.customer_email || "",
        orderType: duplicateOrder.order_type,
        fulfillmentMode: duplicateOrder.fulfillment_mode,
        timingMode: duplicateOrder.timing_mode,
        scheduledLabel: duplicateOrder.scheduled_label || "",
        paymentMethod: duplicateOrder.payment_method,
        itemCount: Number(duplicateOrder.item_count || 0),
        subtotal: Number(duplicateOrder.subtotal || 0),
        deliveryFee: Number(duplicateOrder.delivery_fee || 0),
        totalAmount: Number(duplicateOrder.total || 0),
        createdAt: duplicateOrder.created_at,
        addressFull: duplicateOrder.address_full || "",
        items: [],
      },
    };
  }

  const customerId = crypto.randomUUID();
  const orderId = crypto.randomUUID();
  const publicId = buildPublicOrderId();
  const customerRows = await sql`
    INSERT INTO customers (id, customer_key, tenant_id, restaurant_id, restaurant_key, profile_id, name, phone, email, created_at, updated_at)
    VALUES (
      ${customerId},
      ${normalizedOrder.customer.key},
      ${tenant.tenantId},
      ${tenant.restaurantId},
      ${tenant.restaurantKey},
      ${normalizedOrder.customer.profileId || ""},
      ${normalizedOrder.customer.name},
      ${normalizedOrder.customer.phone},
      ${normalizedOrder.customer.email || ""},
      NOW(),
      NOW()
    )
    ON CONFLICT (tenant_id, restaurant_id, customer_key) DO UPDATE
      SET
        tenant_id = EXCLUDED.tenant_id,
        restaurant_id = EXCLUDED.restaurant_id,
        restaurant_key = EXCLUDED.restaurant_key,
        profile_id = EXCLUDED.profile_id,
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        updated_at = NOW()
    RETURNING id
  `;
  const resolvedCustomerId = customerRows[0]?.id || customerId;

  const insertQueries = [
    sql`
      INSERT INTO orders (
        id,
        public_id,
        tenant_id,
        restaurant_id,
        restaurant_key,
        customer_id,
        customer_key,
        profile_id,
        customer_name,
        customer_phone,
        customer_email,
        status,
        order_type,
        fulfillment_mode,
        timing_mode,
        scheduled_for,
        scheduled_date,
        scheduled_time,
        scheduled_label,
        payment_method,
        needs_change,
        cash_amount,
        change_amount,
        item_count,
        subtotal,
        addons_total,
        delivery_fee,
        total,
        customer_notes,
        address_line,
        address_number,
        address_complement,
        address_reference,
        address_postal_code,
        address_neighborhood,
        address_city,
        address_state,
        address_full,
        delivery_distance_text,
        delivery_route_band,
        delivery_estimate_text,
        latest_status_note,
        request_signature,
        raw_payload_json,
        created_at,
        updated_at
      )
      VALUES (
        ${orderId},
        ${publicId},
        ${tenant.tenantId},
        ${tenant.restaurantId},
        ${tenant.restaurantKey},
        ${resolvedCustomerId},
        ${normalizedOrder.customer.key},
        ${normalizedOrder.customer.profileId || ""},
        ${normalizedOrder.customer.name},
        ${normalizedOrder.customer.phone},
        ${normalizedOrder.customer.email || ""},
        ${normalizedOrder.order.status},
        ${normalizedOrder.order.orderType},
        ${normalizedOrder.order.fulfillmentMode},
        ${normalizedOrder.order.timingMode},
        ${normalizedOrder.order.scheduledFor},
        ${normalizedOrder.order.scheduledDate},
        ${normalizedOrder.order.scheduledTime},
        ${normalizedOrder.order.scheduledLabel},
        ${normalizedOrder.order.paymentMethod},
        ${Boolean(normalizedOrder.order.needsChange)},
        ${normalizedOrder.order.cashAmountProvided},
        ${normalizedOrder.order.changeAmount},
        ${normalizedOrder.order.itemCount},
        ${normalizedOrder.order.subtotal},
        ${normalizedOrder.order.addonsTotal},
        ${normalizedOrder.order.deliveryFee},
        ${normalizedOrder.order.total},
        ${normalizedOrder.order.customerNotes},
        ${normalizedOrder.order.addressLine},
        ${normalizedOrder.order.addressNumber},
        ${normalizedOrder.order.addressComplement},
        ${normalizedOrder.order.addressReference},
        ${normalizedOrder.order.addressPostalCode},
        ${normalizedOrder.order.addressNeighborhood},
        ${normalizedOrder.order.addressCity},
        ${normalizedOrder.order.addressState},
        ${normalizedOrder.order.addressFull},
        ${normalizedOrder.order.deliveryDistanceText},
        ${normalizedOrder.order.deliveryRouteBand},
        ${normalizedOrder.order.deliveryEstimateText},
        ${DEFAULT_INITIAL_STATUS_NOTE},
        ${normalizedOrder.requestSignature},
        ${JSON.stringify(normalizedOrder.order.rawPayload || {})}::jsonb,
        NOW(),
        NOW()
      )
    `,
    sql`
      INSERT INTO order_status_events (
        id,
        order_id,
        tenant_id,
        restaurant_id,
        restaurant_key,
        action,
        status,
        note,
        source,
        admin_login,
        admin_display_name,
        metadata_json,
        created_at
      )
      VALUES (
        ${crypto.randomUUID()},
        ${orderId},
        ${tenant.tenantId},
        ${tenant.restaurantId},
        ${tenant.restaurantKey},
        ${"order_created"},
        ${normalizedOrder.order.status},
        ${DEFAULT_INITIAL_STATUS_NOTE},
        ${"system"},
        ${""},
        ${""},
        ${JSON.stringify({ channel: "site" })}::jsonb,
        NOW()
      )
    `,
  ];

  normalizedOrder.items.forEach((item, index) => {
    insertQueries.push(sql`
      INSERT INTO order_items (
        id,
        order_id,
        tenant_id,
        restaurant_id,
        restaurant_key,
        sort_order,
        item_type,
        source_item_id,
        name,
        category,
        quantity,
        unit_price,
        total_price,
        metadata_json,
        created_at
      )
      VALUES (
        ${crypto.randomUUID()},
        ${orderId},
        ${tenant.tenantId},
        ${tenant.restaurantId},
        ${tenant.restaurantKey},
        ${index},
        ${item.type},
        ${item.id},
        ${item.name},
        ${item.category || ""},
        ${item.quantity},
        ${item.unitPrice},
        ${item.totalPrice},
        ${JSON.stringify(item.metadata || {})}::jsonb,
        NOW()
      )
    `);
  });

  await sql.transaction(insertQueries);

  return {
    created: true,
    storageMode: "neon",
    order: {
      id: orderId,
      publicId,
      status: normalizedOrder.order.status,
      customerName: normalizedOrder.customer.name,
      customerPhone: normalizedOrder.customer.phone,
      customerEmail: normalizedOrder.customer.email || "",
      orderType: normalizedOrder.order.orderType,
      fulfillmentMode: normalizedOrder.order.fulfillmentMode,
      timingMode: normalizedOrder.order.timingMode,
      scheduledLabel: normalizedOrder.order.scheduledLabel || "",
      paymentMethod: normalizedOrder.order.paymentMethod,
      itemCount: normalizedOrder.order.itemCount,
      subtotal: normalizedOrder.order.subtotal,
      deliveryFee: normalizedOrder.order.deliveryFee,
      totalAmount: normalizedOrder.order.total,
      createdAt: new Date().toISOString(),
      addressFull: normalizedOrder.order.addressFull || "",
      items: normalizedOrder.items.map((item) => ({
        type: item.type,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
    },
  };
};

const createOrder = async (normalizedOrder, options = {}) => {
  const tenant = getOperationalTenant(options, "orders:create");
  assertStorageIsAvailable();
  return getStorageMode() === "neon"
    ? createOrderInNeon(normalizedOrder, tenant)
    : createOrderInFileStore(normalizedOrder, tenant);
};

const getDashboardFromFileStore = async (limit = 40, tenant) => {
  const store = await readFileStore();
  const tenantOrders = scopeOrdersByTenant(store.orders, tenant);
  const operationalWindow = getOperationalDayWindow();
  const orderSummaries = buildDashboardOrderScope(tenantOrders, limit, new Date()).map((order) =>
    formatOrderSummary(order)
  );

  return {
    storageMode: "file",
    generatedAt: new Date().toISOString(),
    stats: buildDashboardStats(tenantOrders),
    operationalWindow,
    orders: orderSummaries,
    recentOrders: orderSummaries,
  };
};

const getDashboardFromNeon = async (limit = 40, tenant) => {
  await ensureNeonSchema();
  const sql = getSql();
  const operationalWindow = getOperationalDayWindow();
  const countRows = await sql`
    SELECT status, COUNT(*)::int AS total
    FROM orders
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
    GROUP BY status
  `;
  const spotlightRows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'Em preparo')::int AS preparing_orders,
      COUNT(*) FILTER (WHERE status = 'Pronto')::int AS ready_orders,
      COUNT(*) FILTER (WHERE status = 'Saiu para entrega')::int AS delivery_orders
    FROM orders
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
  `;
  const createdDuringOperationalDayRows = await sql`
    SELECT
      COUNT(*)::int AS total_orders
    FROM orders
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
      AND created_at >= ${operationalWindow.startIso}
      AND created_at < ${operationalWindow.endIso}
  `;
  const completedDuringOperationalDayRows = await sql`
    SELECT
      COALESCE(SUM(total), 0)::numeric AS total_revenue
    FROM orders
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
      AND status IN ('Finalizado', 'Entregue', 'Retirada concluida')
      AND updated_at >= ${operationalWindow.startIso}
      AND updated_at < ${operationalWindow.endIso}
  `;
  const activeRows = await sql`
    SELECT COUNT(*)::int AS total
    FROM orders
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
      AND status NOT IN ('Finalizado', 'Entregue', 'Retirada concluida', 'Cancelado')
      AND NOT (
        timing_mode = 'scheduled'
        AND scheduled_for IS NOT NULL
        AND scheduled_for > NOW()
      )
  `;
  const openRows = await sql`
    SELECT
      id,
      public_id,
      status,
      customer_name,
      customer_phone,
      customer_email,
      order_type,
      fulfillment_mode,
      timing_mode,
      scheduled_for,
      scheduled_label,
      payment_method,
      item_count,
      subtotal,
      delivery_fee,
      total,
      address_full,
      latest_status_note,
      created_at,
      updated_at
    FROM orders
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
      AND status NOT IN ('Finalizado', 'Entregue', 'Retirada concluida', 'Cancelado')
    ORDER BY updated_at DESC, created_at DESC
  `;
  const completedRows = await sql`
    SELECT
      id,
      public_id,
      status,
      customer_name,
      customer_phone,
      customer_email,
      order_type,
      fulfillment_mode,
      timing_mode,
      scheduled_for,
      scheduled_label,
      payment_method,
      item_count,
      subtotal,
      delivery_fee,
      total,
      address_full,
      latest_status_note,
      created_at,
      updated_at
    FROM orders
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
      AND status IN ('Finalizado', 'Entregue', 'Retirada concluida')
      AND updated_at >= ${operationalWindow.startIso}
      AND updated_at < ${operationalWindow.endIso}
    ORDER BY updated_at DESC, created_at DESC
    LIMIT ${limit}
  `;
  const cancelledRows = await sql`
    SELECT
      id,
      public_id,
      status,
      customer_name,
      customer_phone,
      customer_email,
      order_type,
      fulfillment_mode,
      timing_mode,
      scheduled_for,
      scheduled_label,
      payment_method,
      item_count,
      subtotal,
      delivery_fee,
      total,
      address_full,
      latest_status_note,
      created_at,
      updated_at
    FROM orders
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
      AND status = 'Cancelado'
    ORDER BY updated_at DESC, created_at DESC
    LIMIT ${limit}
  `;

  const scopedRows = [];
  const seenRowIds = new Set();
  [...openRows, ...completedRows, ...cancelledRows].forEach((row) => {
    if (!row?.id || seenRowIds.has(row.id)) {
      return;
    }

    seenRowIds.add(row.id);
    scopedRows.push(row);
  });

  const itemRows =
    scopedRows.length > 0
      ? await sql`
          SELECT
            order_id,
            item_type,
            name,
            sort_order,
            created_at
          FROM order_items
          WHERE tenant_id = ${tenant.tenantId}
            AND restaurant_id = ${tenant.restaurantId}
            AND restaurant_key = ${tenant.restaurantKey}
            AND order_id = ANY(${scopedRows.map((row) => row.id)})
          ORDER BY order_id ASC, sort_order ASC, created_at ASC
        `
      : [];

  const byStatus = ORDER_STATUSES.reduce((summary, status) => {
    summary[status] = 0;
    return summary;
  }, {});

  countRows.forEach((entry) => {
    const canonicalStatus = resolveCanonicalOrderStatus(entry.status, "");

    if (!canonicalStatus) {
      return;
    }

    byStatus[canonicalStatus] = Number(byStatus[canonicalStatus] || 0) + Number(entry.total || 0);
  });
  const visibleCompletedByStatus = completedRows.reduce(
    (summary, row) => {
      const canonicalStatus = resolveCanonicalOrderStatus(row.status, row.fulfillment_mode || "");

      if (canonicalStatus === "Entregue" || canonicalStatus === "Retirada concluida") {
        summary[canonicalStatus] += 1;
      }

      return summary;
    },
    {
      Entregue: 0,
      "Retirada concluida": 0,
    }
  );
  byStatus.Entregue = visibleCompletedByStatus.Entregue;
  byStatus["Retirada concluida"] = visibleCompletedByStatus["Retirada concluida"];
  const itemPreviewByOrderId = itemRows.reduce((summary, row) => {
    if (!summary[row.order_id]) {
      summary[row.order_id] = [];
    }

    summary[row.order_id].push({
      itemType: row.item_type,
      name: row.name,
    });
    return summary;
  }, {});
  const totalOrders = Object.values(byStatus).reduce((sum, value) => sum + Number(value || 0), 0);
  const newOrders = Number(byStatus.Recebido || 0);
  const scheduledRows = await sql`
    SELECT COUNT(*)::int AS total
    FROM orders
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
      AND timing_mode = 'scheduled'
      AND scheduled_for IS NOT NULL
      AND scheduled_for > NOW()
      AND status NOT IN ('Finalizado', 'Entregue', 'Retirada concluida', 'Cancelado')
  `;
  const futureScheduledOrders = Number(scheduledRows[0]?.total || 0);
  const activeOrders = Number(activeRows[0]?.total || 0);

  const orderSummaries = sortOrdersForAdmin(
    scopedRows.map((row) => ({
      id: row.id,
      publicId: row.public_id,
      status: row.status,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      customerEmail: row.customer_email || "",
      orderType: row.order_type,
      fulfillmentMode: row.fulfillment_mode,
      timingMode: row.timing_mode,
      scheduledFor: row.scheduled_for ? toIsoString(row.scheduled_for) : null,
      scheduledLabel: row.scheduled_label || "",
      paymentMethod: row.payment_method,
      itemCount: Number(row.item_count || 0),
      subtotal: Number(row.subtotal || 0),
      deliveryFee: Number(row.delivery_fee || 0),
      total: Number(row.total || 0),
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at) || toIsoString(row.created_at),
      addressFull: row.address_full || "",
      latestStatusNote: row.latest_status_note || "",
      itemPreview: buildItemPreview(itemPreviewByOrderId[row.id] || []),
    }))
  )
    .filter((record) => isOrderVisibleInOperations(record, operationalWindow))
    .slice(0, limit)
    .map((record) => formatOrderSummary(record));

  return {
    storageMode: "neon",
    generatedAt: new Date().toISOString(),
    operationalWindow,
    stats: {
      totalOrders,
      newOrders,
      activeOrders,
      scheduledOrders: futureScheduledOrders,
      todayOrders: Number(createdDuringOperationalDayRows[0]?.total_orders || 0),
      preparingOrders: Number(spotlightRows[0]?.preparing_orders || 0),
      readyOrders: Number(spotlightRows[0]?.ready_orders || 0),
      deliveryOrders: Number(spotlightRows[0]?.delivery_orders || 0),
      todayRevenue: Number(completedDuringOperationalDayRows[0]?.total_revenue || 0),
      byStatus,
    },
    orders: orderSummaries,
    recentOrders: orderSummaries,
  };
};

const getCustomerActiveOrderFromFileStore = async (customerKey, tenant) => {
  const store = await readFileStore();
  const activeOrder = pickActiveOrder(scopeOrdersByTenant(store.orders, tenant), customerKey);

  return {
    storageMode: "file",
    hasActiveOrder: Boolean(activeOrder),
    order: activeOrder ? formatCustomerTrackingOrder(activeOrder) : null,
  };
};

const getCustomerActiveOrderFromNeon = async (customerKey, tenant) => {
  await ensureNeonSchema();
  const sql = getSql();
  const activeRows = await sql`
    SELECT
      id,
      public_id,
      status,
      customer_key,
      order_type,
      fulfillment_mode,
      timing_mode,
      scheduled_for,
      scheduled_label,
      created_at,
      updated_at
    FROM orders
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
      AND customer_key = ${String(customerKey || "").trim()}
      AND status NOT IN ('Finalizado', 'Entregue', 'Retirada concluida', 'Cancelado')
    ORDER BY created_at DESC
    LIMIT 12
  `;

  const activeOrder = pickActiveOrder(
    activeRows.map((row) => ({
      id: row.id,
      publicId: row.public_id,
      status: row.status,
      customerKey: row.customer_key,
      orderType: row.order_type,
      fulfillmentMode: row.fulfillment_mode,
      timingMode: row.timing_mode,
      scheduledFor: row.scheduled_for ? toIsoString(row.scheduled_for) : null,
      scheduledLabel: row.scheduled_label || "",
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at) || toIsoString(row.created_at),
    })),
    customerKey
  );

  if (!activeOrder) {
    return {
      storageMode: "neon",
      hasActiveOrder: false,
      order: null,
    };
  }

  const details = await getOrderDetailsFromNeon(activeOrder.id, tenant);
  return {
    storageMode: "neon",
    hasActiveOrder: true,
    order: formatCustomerTrackingOrder(details.order),
  };
};

const getOrderDetailsFromFileStore = async (identifier, tenant) => {
  const store = await readFileStore();
  const orderRecord = findOrderRecord(scopeOrdersByTenant(store.orders, tenant), identifier);

  if (!orderRecord) {
    throw buildHttpError(404, "Nao encontrei o pedido solicitado.", "order_not_found");
  }

  return {
    storageMode: "file",
    order: formatOrderDetails(orderRecord),
  };
};

const getOrderDetailsFromNeon = async (identifier, tenant) => {
  await ensureNeonSchema();
  const sql = getSql();
  const orderRows = await sql`
    SELECT
      id,
      public_id,
      customer_id,
      customer_key,
      profile_id,
      customer_name,
      customer_phone,
      customer_email,
      status,
      order_type,
      fulfillment_mode,
      timing_mode,
      scheduled_for,
      scheduled_date,
      scheduled_time,
      scheduled_label,
      payment_method,
      needs_change,
      cash_amount,
      change_amount,
      item_count,
      subtotal,
      addons_total,
      delivery_fee,
      total,
      customer_notes,
      address_line,
      address_number,
      address_complement,
      address_reference,
      address_postal_code,
      address_neighborhood,
      address_city,
      address_state,
      address_full,
      delivery_distance_text,
      delivery_route_band,
      delivery_estimate_text,
      raw_payload_json,
      latest_status_note,
      created_at,
      updated_at
    FROM orders
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
      AND (
        id = ${String(identifier || "").trim()}
        OR public_id = ${String(identifier || "").trim()}
      )
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (orderRows.length === 0) {
    throw buildHttpError(404, "Nao encontrei o pedido solicitado.", "order_not_found");
  }

  const orderRow = orderRows[0];
  const itemRows = await sql`
    SELECT
      id,
      sort_order,
      item_type,
      source_item_id,
      name,
      category,
      quantity,
      unit_price,
      total_price,
      metadata_json,
      created_at
    FROM order_items
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
      AND order_id = ${orderRow.id}
    ORDER BY sort_order ASC, created_at ASC
  `;
  const statusEventRows = await sql`
    SELECT
      id,
      action,
      status,
      note,
      source,
      admin_login,
      admin_display_name,
      metadata_json,
      created_at
    FROM order_status_events
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
      AND order_id = ${orderRow.id}
    ORDER BY created_at DESC
  `;

  return {
    storageMode: "neon",
    order: formatOrderDetails({
      id: orderRow.id,
      publicId: orderRow.public_id,
      customerId: orderRow.customer_id,
      customerKey: orderRow.customer_key,
      profileId: orderRow.profile_id || "",
      customerName: orderRow.customer_name,
      customerPhone: orderRow.customer_phone,
      customerEmail: orderRow.customer_email || "",
      status: orderRow.status,
      orderType: orderRow.order_type,
      fulfillmentMode: orderRow.fulfillment_mode,
      timingMode: orderRow.timing_mode,
      scheduledFor: orderRow.scheduled_for ? toIsoString(orderRow.scheduled_for) : null,
      scheduledDate: orderRow.scheduled_date || "",
      scheduledTime: orderRow.scheduled_time || "",
      scheduledLabel: orderRow.scheduled_label || "",
      paymentMethod: orderRow.payment_method,
      needsChange: Boolean(orderRow.needs_change),
      cashAmount: toNumberOrNull(orderRow.cash_amount),
      changeAmount: toNumberOrNull(orderRow.change_amount),
      itemCount: Number(orderRow.item_count || 0),
      subtotal: Number(orderRow.subtotal || 0),
      addonsTotal: Number(orderRow.addons_total || 0),
      deliveryFee: Number(orderRow.delivery_fee || 0),
      total: Number(orderRow.total || 0),
      customerNotes: orderRow.customer_notes || "",
      addressLine: orderRow.address_line || "",
      addressNumber: orderRow.address_number || "",
      addressComplement: orderRow.address_complement || "",
      addressReference: orderRow.address_reference || "",
      addressPostalCode: orderRow.address_postal_code || "",
      addressNeighborhood: orderRow.address_neighborhood || "",
      addressCity: orderRow.address_city || "",
      addressState: orderRow.address_state || "",
      addressFull: orderRow.address_full || "",
      deliveryDistanceText: orderRow.delivery_distance_text || "",
      deliveryRouteBand: orderRow.delivery_route_band || "",
      deliveryEstimateText: orderRow.delivery_estimate_text || "",
      rawPayload: orderRow.raw_payload_json || {},
      latestStatusNote: orderRow.latest_status_note || "",
      createdAt: toIsoString(orderRow.created_at),
      updatedAt: toIsoString(orderRow.updated_at) || toIsoString(orderRow.created_at),
      items: itemRows.map((item) => ({
        id: item.id,
        sortOrder: Number(item.sort_order || 0),
        sourceItemId: item.source_item_id || "",
        itemType: item.item_type,
        name: item.name,
        category: item.category || "",
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unit_price || 0),
        totalPrice: Number(item.total_price || 0),
        metadata: item.metadata_json || {},
      })),
      auditTrail: statusEventRows.map((event) => ({
        id: event.id,
        action: event.action || "",
        status: event.status,
        note: event.note || "",
        source: event.source || "system",
        adminLogin: event.admin_login || "",
        adminDisplayName: event.admin_display_name || "",
        metadata: event.metadata_json || {},
        createdAt: toIsoString(event.created_at),
      })),
    }),
  };
};

const updateOrderStatusInFileStore = async (identifier, nextStatus, note = "", options = {}, tenant) => {
  const store = await readFileStore();
  const orderIndex = store.orders.findIndex((order) => {
    const normalizedIdentifier = String(identifier || "").trim();
    return (
      matchesTenantScope(order, tenant) &&
      (order.id === normalizedIdentifier || order.publicId === normalizedIdentifier)
    );
  });

  if (orderIndex === -1) {
    throw buildHttpError(404, "Nao encontrei o pedido solicitado.", "order_not_found");
  }

  const currentOrder = store.orders[orderIndex];
  const auditPayload = buildAdminAuditPayload({
    currentOrder,
    nextStatus,
    note,
    actor: options.actor,
    manual: Boolean(options.manual),
  });

  if (!auditPayload.statusChanged && auditPayload.action !== "manual_order_update") {
    return {
      storageMode: "file",
      changed: false,
      order: formatOrderDetails(currentOrder),
    };
  }

  const now = new Date().toISOString();
  const auditTrail = Array.isArray(currentOrder.auditTrail)
    ? currentOrder.auditTrail.slice()
    : getAuditTrail(currentOrder);
  auditTrail.push({
    ...withTenantScope(auditPayload.auditEvent, tenant.tenantContext),
    createdAt: now,
  });

  const nextOrderRecord = {
    ...currentOrder,
    status: auditPayload.statusChanged ? auditPayload.nextStatus : currentOrder.status,
    latestStatusNote: auditPayload.auditNote,
    auditTrail,
    statusHistory: mapAuditTrailToPublicStatusHistory({
      ...currentOrder,
      status: auditPayload.statusChanged ? auditPayload.nextStatus : currentOrder.status,
      latestStatusNote: auditPayload.auditNote,
      auditTrail,
      updatedAt: now,
    }),
    updatedAt: now,
  };

  store.orders[orderIndex] = nextOrderRecord;

  await writeFileStore(store);

  return {
    storageMode: "file",
    changed: true,
    message: auditPayload.message,
    auditEvent: normalizeAuditEvent(
      nextOrderRecord.auditTrail[nextOrderRecord.auditTrail.length - 1],
      nextOrderRecord
    ),
    order: formatOrderDetails(store.orders[orderIndex]),
  };
};

const updateOrderStatusInNeon = async (identifier, nextStatus, note = "", options = {}, tenant) => {
  await ensureNeonSchema();
  const sql = getSql();
  const orderRows = await sql`
    SELECT id, status, fulfillment_mode, order_type
    FROM orders
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
      AND (
        id = ${String(identifier || "").trim()}
        OR public_id = ${String(identifier || "").trim()}
      )
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (orderRows.length === 0) {
    throw buildHttpError(404, "Nao encontrei o pedido solicitado.", "order_not_found");
  }

  const currentOrder = orderRows[0];
  const auditPayload = buildAdminAuditPayload({
    currentOrder: {
      status: currentOrder.status,
      fulfillmentMode: currentOrder.fulfillment_mode,
      orderType: currentOrder.order_type,
    },
    nextStatus,
    note,
    actor: options.actor,
    manual: Boolean(options.manual),
  });

  if (!auditPayload.statusChanged && auditPayload.action !== "manual_order_update") {
    const details = await getOrderDetailsFromNeon(currentOrder.id, tenant);
    return {
      storageMode: "neon",
      changed: false,
      order: details.order,
    };
  }

  const transactionQueries = [];

  if (auditPayload.statusChanged) {
    transactionQueries.push(sql`
      UPDATE orders
      SET
        status = ${auditPayload.nextStatus},
        latest_status_note = ${auditPayload.auditNote},
        updated_at = NOW()
      WHERE id = ${currentOrder.id}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND restaurant_key = ${tenant.restaurantKey}
    `);
  } else {
    transactionQueries.push(sql`
      UPDATE orders
      SET
        latest_status_note = ${auditPayload.auditNote},
        updated_at = NOW()
      WHERE id = ${currentOrder.id}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND restaurant_key = ${tenant.restaurantKey}
    `);
  }

  transactionQueries.push(
    sql`
      INSERT INTO order_status_events (
        id,
        order_id,
        tenant_id,
        restaurant_id,
        restaurant_key,
        action,
        status,
        note,
        source,
        admin_login,
        admin_display_name,
        metadata_json,
        created_at
      )
      VALUES (
        ${crypto.randomUUID()},
        ${currentOrder.id},
        ${tenant.tenantId},
        ${tenant.restaurantId},
        ${tenant.restaurantKey},
        ${auditPayload.action},
        ${auditPayload.statusChanged ? auditPayload.nextStatus : currentOrder.status},
        ${auditPayload.auditNote},
        ${"admin"},
        ${String(options?.actor?.login || "").trim().toLowerCase()},
        ${String(options?.actor?.displayName || "").trim()},
        ${JSON.stringify(auditPayload.auditEvent.metadata || {})}::jsonb,
        NOW()
      )
    `
  );

  await sql.transaction(transactionQueries);

  const details = await getOrderDetailsFromNeon(currentOrder.id, tenant);
  return {
    storageMode: "neon",
    changed: true,
    message: auditPayload.message,
    auditEvent: normalizeAuditEvent(
      {
        ...auditPayload.auditEvent,
        status: auditPayload.statusChanged ? auditPayload.nextStatus : currentOrder.status,
      },
      details.order
    ),
    order: details.order,
  };
};

const normalizeScheduledFilters = (filters = {}) => ({
  date: String(filters.date || "").trim(),
  fulfillmentMode: String(filters.fulfillmentMode || "").trim().toLowerCase(),
});

const sortScheduledOrders = (orders) =>
  orders.slice().sort((left, right) => {
    const scheduledDiff = getScheduledTimestamp(left) - getScheduledTimestamp(right);

    if (scheduledDiff !== 0) {
      return scheduledDiff;
    }

    return new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime();
  });

const buildScheduledOrdersSummary = (orders, nowTimestamp = getNowTimestamp()) => {
  const nextScheduledOrder = orders[0] || null;

  return {
    totalOrders: orders.length,
    deliveryOrders: orders.filter((order) => order.fulfillmentMode === "delivery").length,
    pickupOrders: orders.filter((order) => order.fulfillmentMode === "pickup").length,
    dueSoonOrders: orders.filter((order) => isScheduledDueSoon(order, nowTimestamp)).length,
    nextScheduledAt: nextScheduledOrder?.scheduledFor || null,
  };
};

const getAdminScheduledOrdersFromFileStore = async (filters = {}, tenant) => {
  const normalizedFilters = normalizeScheduledFilters(filters);
  const store = await readFileStore();
  const nowTimestamp = getNowTimestamp();
  const scheduledOrders = sortScheduledOrders(
    scopeOrdersByTenant(store.orders, tenant)
      .filter((order) => isScheduledAwaitingActivation(order, nowTimestamp))
      .filter((order) =>
        !normalizedFilters.fulfillmentMode || order.fulfillmentMode === normalizedFilters.fulfillmentMode
      )
      .filter((order) => !normalizedFilters.date || getScheduledDateKey(order) === normalizedFilters.date)
  ).map((order) => formatScheduledOrderSummary(order, nowTimestamp));

  return {
    storageMode: "file",
    generatedAt: new Date().toISOString(),
    filters: normalizedFilters,
    summary: buildScheduledOrdersSummary(scheduledOrders, nowTimestamp),
    orders: scheduledOrders,
  };
};

const getAdminScheduledOrdersFromNeon = async (filters = {}, tenant) => {
  await ensureNeonSchema();
  const sql = getSql();
  const normalizedFilters = normalizeScheduledFilters(filters);
  const fulfillmentModeFilter = normalizedFilters.fulfillmentMode;
  const dateFilter = normalizedFilters.date;
  const rows = await sql`
    SELECT
      id,
      public_id,
      status,
      customer_name,
      customer_phone,
      customer_email,
      order_type,
      fulfillment_mode,
      timing_mode,
      scheduled_for,
      scheduled_date,
      scheduled_time,
      scheduled_label,
      payment_method,
      item_count,
      subtotal,
      delivery_fee,
      total,
      address_full,
      latest_status_note,
      created_at,
      updated_at
    FROM orders
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
      AND timing_mode = 'scheduled'
      AND scheduled_for IS NOT NULL
      AND scheduled_for > NOW()
      AND status NOT IN ('Finalizado', 'Entregue', 'Retirada concluida', 'Cancelado')
      AND (${fulfillmentModeFilter} = '' OR fulfillment_mode = ${fulfillmentModeFilter})
      AND (${dateFilter} = '' OR scheduled_date = ${dateFilter})
    ORDER BY scheduled_for ASC, created_at ASC
    LIMIT 250
  `;

  const nowTimestamp = getNowTimestamp();
  const scheduledOrders = rows.map((row) =>
    formatScheduledOrderSummary(
      {
        id: row.id,
        publicId: row.public_id,
        status: row.status,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        customerEmail: row.customer_email || "",
        orderType: row.order_type,
        fulfillmentMode: row.fulfillment_mode,
        timingMode: row.timing_mode,
        scheduledFor: row.scheduled_for ? toIsoString(row.scheduled_for) : null,
        scheduledDate: row.scheduled_date || "",
        scheduledTime: row.scheduled_time || "",
        scheduledLabel: row.scheduled_label || "",
        paymentMethod: row.payment_method,
        itemCount: Number(row.item_count || 0),
        subtotal: Number(row.subtotal || 0),
        deliveryFee: Number(row.delivery_fee || 0),
        total: Number(row.total || 0),
        addressFull: row.address_full || "",
        latestStatusNote: row.latest_status_note || "",
        createdAt: toIsoString(row.created_at),
        updatedAt: toIsoString(row.updated_at) || toIsoString(row.created_at),
      },
      nowTimestamp
    )
  );

  return {
    storageMode: "neon",
    generatedAt: new Date().toISOString(),
    filters: normalizedFilters,
    summary: buildScheduledOrdersSummary(scheduledOrders, nowTimestamp),
    orders: scheduledOrders,
  };
};

const parseAuditLogLimit = (value) => {
  const numericValue = Number.parseInt(String(value || ""), 10);

  if (!Number.isFinite(numericValue)) {
    return 60;
  }

  return Math.min(Math.max(numericValue, 10), 200);
};

const formatAuditAdminOptions = (events) =>
  events
    .filter((event) => event.adminLogin)
    .reduce((summary, event) => {
      if (!summary.some((entry) => entry.login === event.adminLogin)) {
        summary.push({
          login: event.adminLogin,
          displayName: event.adminDisplayName || event.adminLogin,
        });
      }

      return summary;
    }, [])
    .sort((left, right) => left.displayName.localeCompare(right.displayName, "pt-BR"));

const getAdminAuditLogFromFileStore = async (filters = {}, tenant) => {
  const store = await readFileStore();
  const allEvents = sortOrdersForAdmin(scopeOrdersByTenant(store.orders, tenant)).flatMap((order) =>
    getAuditTrail(order).map((event) => formatAuditLogEvent(event, order))
  );
  const filteredEvents = allEvents
    .filter((event) => matchAuditLogFilters(event, filters))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const limit = parseAuditLogLimit(filters.limit);

  return {
    storageMode: "file",
    generatedAt: new Date().toISOString(),
    events: filteredEvents.slice(0, limit),
    totalEvents: filteredEvents.length,
    adminOptions: formatAuditAdminOptions(allEvents),
    actionOptions: AUDIT_ACTION_OPTIONS,
  };
};

const getAdminAuditLogFromNeon = async (filters = {}, tenant) => {
  await ensureNeonSchema();
  const sql = getSql();
  const normalizedAdminLogin = String(filters.adminLogin || "").trim().toLowerCase();
  const normalizedAction = String(filters.action || "").trim();
  const normalizedOrderQuery = String(filters.orderQuery || "").trim();
  const orderLikeFilter = `%${normalizedOrderQuery}%`;
  const limit = parseAuditLogLimit(filters.limit);
  const events = await sql`
    SELECT
      event.id,
      event.order_id,
      event.action,
      event.status,
      event.note,
      event.source,
      event.admin_login,
      event.admin_display_name,
      event.metadata_json,
      event.created_at,
      orders.public_id,
      orders.customer_name
    FROM order_status_events AS event
    INNER JOIN orders ON orders.id = event.order_id
    WHERE orders.tenant_id = ${tenant.tenantId}
      AND orders.restaurant_id = ${tenant.restaurantId}
      AND orders.restaurant_key = ${tenant.restaurantKey}
      AND event.tenant_id = ${tenant.tenantId}
      AND event.restaurant_id = ${tenant.restaurantId}
      AND event.restaurant_key = ${tenant.restaurantKey}
      AND (${normalizedAdminLogin} = '' OR event.admin_login = ${normalizedAdminLogin})
      AND (${normalizedAction} = '' OR event.action = ${normalizedAction})
      AND (
        ${normalizedOrderQuery} = ''
        OR event.order_id ILIKE ${orderLikeFilter}
        OR orders.public_id ILIKE ${orderLikeFilter}
        OR orders.customer_name ILIKE ${orderLikeFilter}
      )
    ORDER BY event.created_at DESC
    LIMIT ${limit}
  `;
  const adminRows = await sql`
    SELECT DISTINCT admin_login, admin_display_name
    FROM order_status_events
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
      AND admin_login <> ''
    ORDER BY admin_display_name ASC, admin_login ASC
  `;
  const countRows = await sql`
    SELECT COUNT(*)::int AS total
    FROM order_status_events AS event
    INNER JOIN orders ON orders.id = event.order_id
    WHERE orders.tenant_id = ${tenant.tenantId}
      AND orders.restaurant_id = ${tenant.restaurantId}
      AND orders.restaurant_key = ${tenant.restaurantKey}
      AND event.tenant_id = ${tenant.tenantId}
      AND event.restaurant_id = ${tenant.restaurantId}
      AND event.restaurant_key = ${tenant.restaurantKey}
      AND (${normalizedAdminLogin} = '' OR event.admin_login = ${normalizedAdminLogin})
      AND (${normalizedAction} = '' OR event.action = ${normalizedAction})
      AND (
        ${normalizedOrderQuery} = ''
        OR event.order_id ILIKE ${orderLikeFilter}
        OR orders.public_id ILIKE ${orderLikeFilter}
        OR orders.customer_name ILIKE ${orderLikeFilter}
      )
  `;

  return {
    storageMode: "neon",
    generatedAt: new Date().toISOString(),
    events: events.map((event) => ({
      id: event.id,
      action: event.action || "status_updated",
      actionLabel: getAuditActionLabel(event.action, event.status),
      status: event.status,
      note: event.note || "",
      source: event.source || "system",
      adminLogin: event.admin_login || "",
      adminDisplayName: event.admin_display_name || "",
      metadata: event.metadata_json || {},
      createdAt: toIsoString(event.created_at),
      orderId: event.order_id,
      publicId: event.public_id,
      customerName: event.customer_name,
    })),
    totalEvents: Number(countRows[0]?.total || 0),
    adminOptions: adminRows.map((entry) => ({
      login: entry.admin_login,
      displayName: entry.admin_display_name || entry.admin_login,
    })),
    actionOptions: AUDIT_ACTION_OPTIONS,
  };
};

const getAdminAuditLog = async (filters = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "orders:audit-log");
  assertStorageIsAvailable();
  return getStorageMode() === "neon"
    ? getAdminAuditLogFromNeon(filters, tenant)
    : getAdminAuditLogFromFileStore(filters, tenant);
};

const getAdminMetricsFromFileStore = async (filters = {}, tenant) => {
  const store = await readFileStore();
  const orders = scopeOrdersByTenant(store.orders, tenant);
  const events = orders.flatMap((order) =>
    getAuditTrail(order).map((event) => formatAuditLogEvent(event, order))
  );

  return buildAdminMetricsSnapshot({
    orders,
    events,
    filters,
    adminOptions: formatAuditAdminOptions(events),
    generatedAt: new Date().toISOString(),
    storageMode: "file",
  });
};

const getAdminMetricsFromNeon = async (filters = {}, tenant) => {
  await ensureNeonSchema();
  const sql = getSql();
  const normalizedFilters = normalizeMetricsFilters(filters);
  const comparisonFilters = buildComparisonWindowFromFilters(normalizedFilters);
  const combinedStartIso =
    comparisonFilters.startMs < normalizedFilters.startMs
      ? comparisonFilters.startIso
      : normalizedFilters.startIso;
  const orders = await sql`
    SELECT
      id,
      public_id,
      customer_name,
      status,
      fulfillment_mode,
      timing_mode,
      total,
      created_at,
      updated_at
    FROM orders
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
      AND created_at >= ${combinedStartIso}
      AND created_at < ${normalizedFilters.endIso}
    ORDER BY created_at DESC
  `;
  const events = await sql`
    SELECT
      event.id,
      event.order_id,
      event.action,
      event.status,
      event.note,
      event.source,
      event.admin_login,
      event.admin_display_name,
      event.metadata_json,
      event.created_at,
      orders.public_id,
      orders.customer_name
    FROM order_status_events AS event
    INNER JOIN orders ON orders.id = event.order_id
    WHERE orders.tenant_id = ${tenant.tenantId}
      AND orders.restaurant_id = ${tenant.restaurantId}
      AND orders.restaurant_key = ${tenant.restaurantKey}
      AND event.tenant_id = ${tenant.tenantId}
      AND event.restaurant_id = ${tenant.restaurantId}
      AND event.restaurant_key = ${tenant.restaurantKey}
      AND orders.created_at >= ${combinedStartIso}
      AND orders.created_at < ${normalizedFilters.endIso}
    ORDER BY event.created_at DESC
  `;
  const adminRows = await sql`
    SELECT DISTINCT admin_login, admin_display_name
    FROM order_status_events
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
      AND admin_login <> ''
    ORDER BY admin_display_name ASC, admin_login ASC
  `;

  return buildAdminMetricsSnapshot({
    orders: orders.map((order) => ({
      id: order.id,
      publicId: order.public_id,
      customerName: order.customer_name,
      status: order.status,
      fulfillmentMode: order.fulfillment_mode,
      timingMode: order.timing_mode,
      totalAmount: Number(order.total || 0),
      createdAt: toIsoString(order.created_at),
      updatedAt: toIsoString(order.updated_at) || toIsoString(order.created_at),
    })),
    events: events.map((event) => ({
      id: event.id,
      orderId: event.order_id,
      publicId: event.public_id,
      customerName: event.customer_name,
      action: event.action || "status_updated",
      status: event.status,
      note: event.note || "",
      source: event.source || "system",
      adminLogin: event.admin_login || "",
      adminDisplayName: event.admin_display_name || "",
      metadata: event.metadata_json || {},
      createdAt: toIsoString(event.created_at),
    })),
    filters,
    adminOptions: adminRows.map((entry) => ({
      login: entry.admin_login,
      displayName: entry.admin_display_name || entry.admin_login,
    })),
    generatedAt: new Date().toISOString(),
    storageMode: "neon",
  });
};

const getAdminMetrics = async (filters = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "orders:metrics");
  assertStorageIsAvailable();
  return getStorageMode() === "neon"
    ? getAdminMetricsFromNeon(filters, tenant)
    : getAdminMetricsFromFileStore(filters, tenant);
};

const getAdminFinanceFromFileStore = async (filters = {}, tenant) => {
  const store = await readFileStore();
  const tenantOptions = getTenantStoreOptions(tenant);
  const deliverySettings = (await getAdminDeliverySettings(tenantOptions)).settings || {};
  const normalizedFilters = normalizeFinanceFilters(filters);
  const closing = await getFinanceClosing(normalizedFilters.periodKey, tenantOptions);

  return buildFinanceSnapshot({
    orders: scopeOrdersByTenant(store.orders, tenant),
    filters,
    generatedAt: new Date().toISOString(),
    storageMode: "file",
    deliverySettings,
    closing,
  });
};

const getAdminFinanceFromNeon = async (filters = {}, tenant) => {
  await ensureNeonSchema();
  const sql = getSql();
  const normalizedFilters = normalizeFinanceFilters(filters);
  const tenantOptions = getTenantStoreOptions(tenant);
  const deliverySettings = (await getAdminDeliverySettings(tenantOptions)).settings || {};
  const rows = await sql`
    SELECT
      id,
      public_id,
      status,
      customer_name,
      customer_phone,
      customer_email,
      order_type,
      fulfillment_mode,
      timing_mode,
      scheduled_for,
      scheduled_label,
      payment_method,
      item_count,
      subtotal,
      delivery_fee,
      total,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', order_items.id,
          'sortOrder', order_items.sort_order,
          'sourceItemId', order_items.source_item_id,
          'type', order_items.item_type,
          'name', order_items.name,
          'category', order_items.category,
          'quantity', order_items.quantity,
          'unitPrice', order_items.unit_price,
          'totalPrice', order_items.total_price,
          'metadata', order_items.metadata_json
        ) ORDER BY order_items.sort_order ASC)
        FROM order_items
        WHERE order_items.tenant_id = ${tenant.tenantId}
          AND order_items.restaurant_id = ${tenant.restaurantId}
          AND order_items.restaurant_key = ${tenant.restaurantKey}
          AND order_items.order_id = orders.id
      ), '[]'::json) AS items_json,
      address_full,
      latest_status_note,
      created_at,
      updated_at
    FROM orders
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
      AND (
        (
          status IN ('Finalizado', 'Entregue', 'Retirada concluida', 'Cancelado')
          AND updated_at >= ${normalizedFilters.startIso}
          AND updated_at < ${normalizedFilters.endIso}
        )
        OR (
          status NOT IN ('Finalizado', 'Entregue', 'Retirada concluida', 'Cancelado')
          AND created_at >= ${normalizedFilters.startIso}
          AND created_at < ${normalizedFilters.endIso}
        )
      )
    ORDER BY updated_at DESC, created_at DESC
  `;
  const closing = await getFinanceClosing(normalizedFilters.periodKey, tenantOptions);

  return buildFinanceSnapshot({
    orders: rows.map((row) => ({
      id: row.id,
      publicId: row.public_id,
      status: row.status,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      customerEmail: row.customer_email || "",
      orderType: row.order_type,
      fulfillmentMode: row.fulfillment_mode,
      timingMode: row.timing_mode,
      scheduledFor: row.scheduled_for ? toIsoString(row.scheduled_for) : null,
      scheduledLabel: row.scheduled_label || "",
      paymentMethod: row.payment_method,
      itemCount: Number(row.item_count || 0),
      subtotal: Number(row.subtotal || 0),
      deliveryFee: Number(row.delivery_fee || 0),
      total: Number(row.total || 0),
      items: Array.isArray(row.items_json) ? row.items_json : [],
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at) || toIsoString(row.created_at),
      addressFull: row.address_full || "",
      latestStatusNote: row.latest_status_note || "",
    })),
    filters,
    generatedAt: new Date().toISOString(),
    storageMode: "neon",
    deliverySettings,
    closing,
  });
};

const getAdminFinance = async (filters = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "orders:finance");
  assertStorageIsAvailable();
  return getStorageMode() === "neon"
    ? getAdminFinanceFromNeon(filters, tenant)
    : getAdminFinanceFromFileStore(filters, tenant);
};

const getAdminScheduledOrders = async (filters = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "orders:scheduled");
  assertStorageIsAvailable();
  return getStorageMode() === "neon"
    ? getAdminScheduledOrdersFromNeon(filters, tenant)
    : getAdminScheduledOrdersFromFileStore(filters, tenant);
};

const getAdminDashboard = async (limit = 40, options = {}) => {
  const tenant = getOperationalTenant(options, "orders:dashboard");
  assertStorageIsAvailable();
  return getStorageMode() === "neon"
    ? getDashboardFromNeon(limit, tenant)
    : getDashboardFromFileStore(limit, tenant);
};

const getAdminOrderList = async (limit = 40, options = {}) => getAdminDashboard(limit, options);

const getAdminOrderDetails = async (identifier, options = {}) => {
  const tenant = getOperationalTenant(options, "orders:details");
  assertStorageIsAvailable();
  return getStorageMode() === "neon"
    ? getOrderDetailsFromNeon(identifier, tenant)
    : getOrderDetailsFromFileStore(identifier, tenant);
};

const updateAdminOrderStatus = async (identifier, status, note = "", options = {}) => {
  const tenant = getOperationalTenant(options, "orders:update-status");
  assertStorageIsAvailable();
  const nextStatus = assertValidOrderStatus(status);
  return getStorageMode() === "neon"
    ? updateOrderStatusInNeon(identifier, nextStatus, note, options, tenant)
    : updateOrderStatusInFileStore(identifier, nextStatus, note, options, tenant);
};

const getCustomerActiveOrder = async (customerKey, options = {}) => {
  const tenant = getOperationalTenant(options, "orders:customer-active");
  assertStorageIsAvailable();
  return getStorageMode() === "neon"
    ? getCustomerActiveOrderFromNeon(customerKey, tenant)
    : getCustomerActiveOrderFromFileStore(customerKey, tenant);
};

module.exports = {
  createOrder,
  getAdminAuditLog,
  getAdminDashboard,
  getAdminFinance,
  getAdminMetrics,
  getAdminOrderDetails,
  getAdminOrderList,
  getAdminScheduledOrders,
  getCustomerActiveOrder,
  getStorageMode,
  updateAdminOrderStatus,
};
