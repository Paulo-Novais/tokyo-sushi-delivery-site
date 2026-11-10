const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { neon } = require("./tenant-sql.cjs");
const {
  assertMigrationManagedRelations,
} = require("./database-schema.cjs");
const { buildHttpError } = require("./http.cjs");
const { getCatalogValidationContext } = require("./catalog-store.cjs");
const {
  createOrder,
  getAdminOrderDetails,
  updateAdminOrderStatus,
} = require("./order-store.cjs");
const {
  getOperationalTenant,
} = require("./tenant-context.cjs");

const LOCAL_STORAGE_FILE =
  String(process.env.INOVAS_CASH_REGISTER_DATA_FILE || "").trim() ||
  path.join(process.cwd(), ".data", "cash-register.json");
const LOCAL_STORE_VERSION = 1;
const MAX_TABLES = 80;
const MAX_ITEM_QUANTITY = 99;
const MAX_MONEY = 9999999.99;
const MAX_NOTE_LENGTH = 600;
const PAYMENT_METHODS = Object.freeze([
  "CASH",
  "PIX",
  "DEBIT_CARD",
  "CREDIT_CARD",
  "MEAL_VOUCHER",
  "OTHER",
]);
const ACTIVE_TAB_STATUSES = new Set(["OPEN", "AWAITING_PAYMENT"]);
const EDITABLE_ITEM_STATUS = "PENDING";
const ORDER_TO_ITEM_STATUS = Object.freeze({
  Recebido: "SENT",
  Aceito: "SENT",
  "Em preparo": "IN_PREPARATION",
  Pronto: "READY",
  "Saiu para entrega": "READY",
  Entregue: "DELIVERED",
  "Retirada concluida": "DELIVERED",
  Finalizado: "DELIVERED",
  Cancelado: "CANCELLED",
});

let sqlClient = null;
let schemaReadyPromise = null;
let fileMutationQueue = Promise.resolve();

const cloneJson = (value) => JSON.parse(JSON.stringify(value));
const nowIso = () => new Date().toISOString();
const createId = (prefix) => `${prefix}_${crypto.randomUUID()}`;
const normalizeText = (value, maxLength = 180) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
const normalizeMultiline = (value, maxLength = MAX_NOTE_LENGTH) =>
  String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .slice(0, maxLength);
const roundMoney = (value) => Number(Number(value || 0).toFixed(2));
const toMoney = (value, { min = 0, max = MAX_MONEY, field = "valor" } = {}) => {
  const normalized =
    typeof value === "string"
      ? value.replace(/[^\d,.\-]/g, "").replace(",", ".")
      : value;
  const numeric = Number(normalized);

  if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
    throw buildHttpError(
      400,
      `O ${field} informado e invalido.`,
      "cash_register_invalid_money",
      { field }
    );
  }

  return roundMoney(numeric);
};
const toInteger = (value, { min = 1, max = 999, field = "quantidade" } = {}) => {
  const numeric = Number.parseInt(value, 10);

  if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
    throw buildHttpError(
      400,
      `A ${field} informada e invalida.`,
      "cash_register_invalid_integer",
      { field }
    );
  }

  return numeric;
};
const normalizeActor = (actor = {}) => ({
  identityId: normalizeText(actor.identityId || actor.identity_id, 160),
  login: normalizeText(actor.login || actor.email, 160).toLowerCase(),
  displayName:
    normalizeText(actor.displayName || actor.name || actor.nome, 180) ||
    normalizeText(actor.login || actor.email, 160),
});
const assertActor = (actor) => {
  if (!actor.login) {
    throw buildHttpError(
      401,
      "Operador autenticado nao identificado.",
      "cash_register_actor_required"
    );
  }
};
const getStorageMode = () => {
  if (String(process.env.DATABASE_URL || "").trim()) {
    return "neon";
  }

  return process.env.NODE_ENV === "production" ? "disabled" : "file";
};
const assertStorageAvailable = () => {
  if (getStorageMode() === "disabled") {
    throw buildHttpError(
      503,
      "DATABASE_URL nao foi configurada. O Caixa exige armazenamento persistente.",
      "cash_register_storage_unavailable"
    );
  }
};
const getSql = () => {
  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }

  return sqlClient;
};
const tenantOptions = (tenant) => ({ tenantContext: tenant.tenantContext });
const scopeKey = (tenant) => `${tenant.tenantId}::${tenant.restaurantId}`;
const registerLockKey = (tenant) =>
  `inovas:cash-register:${tenant.tenantId}:${tenant.restaurantId}`;
const createPublicTabId = () =>
  `CMD-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;

const ensureNeonSchema = async () => {
  if (schemaReadyPromise) {
    return schemaReadyPromise;
  }

  const sql = getSql();
  schemaReadyPromise = (async () => {
    if (
      await assertMigrationManagedRelations({
        sql,
        relations: [
          "dining_tables",
          "cash_register_sessions",
          "dining_tabs",
          "dining_tab_items",
          "dining_order_batches",
          "cash_payment_sets",
          "cash_payments",
          "cash_register_movements",
          "cash_register_audit_events",
        ],
        component: "caixa",
      })
    ) {
      return;
    }

    await sql`
      CREATE TABLE IF NOT EXISTS dining_tables (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        restaurant_id TEXT NOT NULL,
        restaurant_key TEXT NOT NULL,
        number INTEGER,
        label TEXT NOT NULL,
        capacity INTEGER NOT NULL DEFAULT 4,
        status TEXT NOT NULL DEFAULT 'FREE',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS dining_tables_scope_label_uidx
      ON dining_tables (tenant_id, restaurant_id, label)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS cash_register_sessions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        restaurant_id TEXT NOT NULL,
        restaurant_key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN',
        opening_user_id TEXT NOT NULL DEFAULT '',
        opening_user_login TEXT NOT NULL,
        opening_user_display_name TEXT NOT NULL,
        opening_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
        service_charge_rate NUMERIC(5, 2) NOT NULL DEFAULT 10,
        opening_notes TEXT NOT NULL DEFAULT '',
        opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        closing_user_id TEXT NOT NULL DEFAULT '',
        closing_user_login TEXT NOT NULL DEFAULT '',
        closing_user_display_name TEXT NOT NULL DEFAULT '',
        counted_cash NUMERIC(12, 2),
        expected_cash NUMERIC(12, 2),
        difference_amount NUMERIC(12, 2),
        closing_notes TEXT NOT NULL DEFAULT '',
        totals_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        closed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS cash_register_sessions_one_open_uidx
      ON cash_register_sessions (tenant_id, restaurant_id)
      WHERE status = 'OPEN'
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS dining_tabs (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        restaurant_id TEXT NOT NULL,
        restaurant_key TEXT NOT NULL,
        cash_register_id TEXT NOT NULL REFERENCES cash_register_sessions(id),
        table_id TEXT NOT NULL REFERENCES dining_tables(id),
        public_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN',
        waiter_id TEXT NOT NULL DEFAULT '',
        waiter_login TEXT NOT NULL DEFAULT '',
        waiter_name TEXT NOT NULL,
        customer_id TEXT NOT NULL DEFAULT '',
        customer_name TEXT NOT NULL DEFAULT '',
        guest_count INTEGER NOT NULL DEFAULT 1,
        subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
        discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
        service_charge_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
        service_charge_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        service_charge_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
        addition_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
        total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
        opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        closing_started_at TIMESTAMPTZ,
        closed_at TIMESTAMPTZ,
        closed_by_login TEXT NOT NULL DEFAULT '',
        closed_by_display_name TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS dining_tabs_scope_public_id_uidx
      ON dining_tabs (tenant_id, restaurant_id, public_id)
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS dining_tabs_one_active_per_table_uidx
      ON dining_tabs (tenant_id, restaurant_id, table_id)
      WHERE status IN ('OPEN', 'AWAITING_PAYMENT')
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS dining_tab_items (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        restaurant_id TEXT NOT NULL,
        restaurant_key TEXT NOT NULL,
        tab_id TEXT NOT NULL REFERENCES dining_tabs(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        image_url TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        quantity INTEGER NOT NULL,
        unit_price NUMERIC(12, 2) NOT NULL,
        total_price NUMERIC(12, 2) NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        batch_id TEXT,
        order_id TEXT,
        created_by_login TEXT NOT NULL,
        created_by_display_name TEXT NOT NULL,
        sent_by_login TEXT NOT NULL DEFAULT '',
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS dining_tab_items_tab_status_idx
      ON dining_tab_items (tenant_id, restaurant_id, tab_id, status, created_at)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS dining_order_batches (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        restaurant_id TEXT NOT NULL,
        restaurant_key TEXT NOT NULL,
        tab_id TEXT NOT NULL REFERENCES dining_tabs(id) ON DELETE CASCADE,
        batch_number INTEGER NOT NULL,
        order_id TEXT NOT NULL REFERENCES orders(id),
        sent_by_login TEXT NOT NULL,
        sent_by_display_name TEXT NOT NULL,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS dining_order_batches_tab_number_uidx
      ON dining_order_batches (tenant_id, restaurant_id, tab_id, batch_number)
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS dining_order_batches_order_uidx
      ON dining_order_batches (tenant_id, restaurant_id, order_id)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS cash_payment_sets (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        restaurant_id TEXT NOT NULL,
        restaurant_key TEXT NOT NULL,
        cash_register_id TEXT NOT NULL REFERENCES cash_register_sessions(id),
        tab_id TEXT NOT NULL REFERENCES dining_tabs(id),
        idempotency_key TEXT NOT NULL,
        total_amount NUMERIC(12, 2) NOT NULL,
        confirmed_by_login TEXT NOT NULL,
        confirmed_by_display_name TEXT NOT NULL,
        confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS cash_payment_sets_tab_uidx
      ON cash_payment_sets (tenant_id, restaurant_id, tab_id)
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS cash_payment_sets_idempotency_uidx
      ON cash_payment_sets (tenant_id, restaurant_id, idempotency_key)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS cash_payments (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        restaurant_id TEXT NOT NULL,
        restaurant_key TEXT NOT NULL,
        payment_set_id TEXT NOT NULL REFERENCES cash_payment_sets(id) ON DELETE CASCADE,
        cash_register_id TEXT NOT NULL REFERENCES cash_register_sessions(id),
        tab_id TEXT NOT NULL REFERENCES dining_tabs(id),
        method TEXT NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        received_amount NUMERIC(12, 2),
        change_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'CONFIRMED',
        created_by_login TEXT NOT NULL,
        created_by_display_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS cash_register_movements (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        restaurant_id TEXT NOT NULL,
        restaurant_key TEXT NOT NULL,
        cash_register_id TEXT NOT NULL REFERENCES cash_register_sessions(id),
        tab_id TEXT REFERENCES dining_tabs(id),
        payment_set_id TEXT REFERENCES cash_payment_sets(id),
        movement_type TEXT NOT NULL,
        payment_method TEXT NOT NULL DEFAULT '',
        amount NUMERIC(12, 2) NOT NULL,
        metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by_login TEXT NOT NULL,
        created_by_display_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS cash_register_audit_events (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        restaurant_id TEXT NOT NULL,
        restaurant_key TEXT NOT NULL,
        cash_register_id TEXT,
        tab_id TEXT,
        table_id TEXT,
        event_type TEXT NOT NULL,
        actor_identity_id TEXT NOT NULL DEFAULT '',
        actor_login TEXT NOT NULL,
        actor_display_name TEXT NOT NULL,
        before_json JSONB,
        after_json JSONB,
        metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  })();

  return schemaReadyPromise;
};

const createEmptyLocalStore = () => ({
  version: LOCAL_STORE_VERSION,
  scopes: {},
});
const createEmptyScope = (tenant) => ({
  tenantId: tenant.tenantId,
  restaurantId: tenant.restaurantId,
  restaurantKey: tenant.restaurantKey,
  tables: [],
  registers: [],
  tabs: [],
  items: [],
  batches: [],
  paymentSets: [],
  payments: [],
  movements: [],
  audits: [],
});
const readLocalStore = async () => {
  try {
    const contents = await fs.readFile(LOCAL_STORAGE_FILE, "utf8");
    const parsed = JSON.parse(contents);
    return {
      version: LOCAL_STORE_VERSION,
      scopes:
        parsed?.scopes && typeof parsed.scopes === "object" && !Array.isArray(parsed.scopes)
          ? parsed.scopes
          : {},
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return createEmptyLocalStore();
    }
    throw error;
  }
};
const writeLocalStore = async (store) => {
  await fs.mkdir(path.dirname(LOCAL_STORAGE_FILE), { recursive: true });
  const temporaryPath = `${LOCAL_STORAGE_FILE}.${process.pid}.${crypto
    .randomBytes(4)
    .toString("hex")}.tmp`;
  await fs.writeFile(
    temporaryPath,
    `${JSON.stringify(
      { version: LOCAL_STORE_VERSION, scopes: store.scopes || {} },
      null,
      2
    )}\n`,
    "utf8"
  );
  await fs.rename(temporaryPath, LOCAL_STORAGE_FILE);
};
const withLocalMutation = (tenant, callback) => {
  const run = async () => {
    const store = await readLocalStore();
    const key = scopeKey(tenant);
    const scoped = store.scopes[key]
      ? cloneJson(store.scopes[key])
      : createEmptyScope(tenant);
    const result = await callback(scoped);
    store.scopes[key] = scoped;
    await writeLocalStore(store);
    return result;
  };
  const task = fileMutationQueue.then(run, run);
  fileMutationQueue = task.catch(() => undefined);
  return task;
};
const readLocalScope = async (tenant) => {
  const store = await readLocalStore();
  return store.scopes[scopeKey(tenant)]
    ? cloneJson(store.scopes[scopeKey(tenant)])
    : createEmptyScope(tenant);
};

const buildAuditRecord = ({
  tenant,
  actor,
  eventType,
  registerId = "",
  tabId = "",
  tableId = "",
  before = null,
  after = null,
  metadata = {},
}) => ({
  id: createId("cash_evt"),
  tenantId: tenant.tenantId,
  restaurantId: tenant.restaurantId,
  restaurantKey: tenant.restaurantKey,
  cashRegisterId: registerId,
  tabId,
  tableId,
  eventType,
  actorIdentityId: actor.identityId,
  actorLogin: actor.login,
  actorDisplayName: actor.displayName,
  before: before ? cloneJson(before) : null,
  after: after ? cloneJson(after) : null,
  metadata: cloneJson(metadata || {}),
  createdAt: nowIso(),
});
const appendLocalAudit = (scope, input) => {
  const audit = buildAuditRecord(input);
  scope.audits.unshift(audit);
  scope.audits = scope.audits.slice(0, 1000);
  return audit;
};

const assertOpenRegister = (register) => {
  if (!register || register.status !== "OPEN") {
    throw buildHttpError(
      409,
      "Abra o caixa antes de operar o salao.",
      "cash_register_not_open"
    );
  }
};
const assertOpenTab = (tab, { allowAwaiting = false } = {}) => {
  const allowed = allowAwaiting ? ACTIVE_TAB_STATUSES : new Set(["OPEN"]);
  if (!tab || !allowed.has(tab.status)) {
    throw buildHttpError(
      409,
      "A comanda nao esta aberta para esta operacao.",
      "dining_tab_not_open"
    );
  }
};
const findOpenRegister = (scope) =>
  scope.registers.find((entry) => entry.status === "OPEN") || null;
const findActiveTabForTable = (scope, tableId) =>
  scope.tabs.find(
    (entry) => entry.tableId === tableId && ACTIVE_TAB_STATUSES.has(entry.status)
  ) || null;
const getTabItems = (scope, tabId) =>
  scope.items
    .filter((entry) => entry.tabId === tabId)
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));
const calculateTabValues = (
  items,
  {
    discountAmount = 0,
    serviceChargeEnabled = true,
    serviceChargeRate = 0,
    additionAmount = 0,
  } = {}
) => {
  const subtotal = roundMoney(
    items
      .filter((item) => item.status !== "CANCELLED")
      .reduce((sum, item) => sum + Number(item.totalPrice || 0), 0)
  );
  const discount = Math.min(toMoney(discountAmount, { field: "desconto" }), subtotal);
  const additions = toMoney(additionAmount, { field: "acrescimo" });
  const rate = toMoney(serviceChargeRate, {
    min: 0,
    max: 30,
    field: "percentual da taxa de servico",
  });
  const serviceCharge = serviceChargeEnabled
    ? roundMoney((subtotal * rate) / 100)
    : 0;
  const total = roundMoney(Math.max(0, subtotal - discount + serviceCharge + additions));
  return {
    subtotal,
    discountAmount: discount,
    serviceChargeRate: rate,
    serviceChargeEnabled: Boolean(serviceChargeEnabled),
    serviceChargeAmount: serviceCharge,
    additionAmount: additions,
    totalAmount: total,
  };
};

const getCatalogProduct = async (productId, tenant) => {
  const normalizedProductId = normalizeText(productId, 160);
  const context = await getCatalogValidationContext(tenantOptions(tenant));
  const product = context.itemMap.get(normalizedProductId);

  if (!product) {
    throw buildHttpError(
      404,
      "Produto nao encontrado no cardapio deste restaurante.",
      "cash_register_product_not_found"
    );
  }

  if (
    product.isOrderable !== true ||
    product.isAvailable === false ||
    product.isPaused === true ||
    typeof product.price !== "number" ||
    product.price <= 0
  ) {
    throw buildHttpError(
      409,
      "Este produto esta indisponivel para venda.",
      "cash_register_product_unavailable"
    );
  }

  return product;
};

const normalizePaymentInput = (payments, totalAmount) => {
  if (!Array.isArray(payments) || !payments.length || payments.length > 8) {
    throw buildHttpError(
      400,
      "Informe ao menos uma forma de pagamento valida.",
      "cash_register_invalid_payments"
    );
  }

  const normalized = payments.map((payment) => {
    const method = normalizeText(payment?.method, 40).toUpperCase();
    if (!PAYMENT_METHODS.includes(method)) {
      throw buildHttpError(
        400,
        "Forma de pagamento invalida.",
        "cash_register_invalid_payment_method"
      );
    }

    const amount = toMoney(payment?.amount, {
      min: 0.01,
      field: "valor do pagamento",
    });
    const receivedAmount =
      method === "CASH"
        ? toMoney(payment?.receivedAmount ?? payment?.received_amount ?? amount, {
            min: amount,
            field: "valor recebido em dinheiro",
          })
        : null;
    const changeAmount =
      method === "CASH" ? roundMoney(receivedAmount - amount) : 0;

    if (changeAmount < 0) {
      throw buildHttpError(
        400,
        "O valor recebido em dinheiro nao pode gerar troco negativo.",
        "cash_register_negative_change"
      );
    }

    return {
      id: createId("cash_payment"),
      method,
      amount,
      receivedAmount,
      changeAmount,
    };
  });
  const paymentTotal = roundMoney(
    normalized.reduce((sum, payment) => sum + payment.amount, 0)
  );

  if (paymentTotal !== roundMoney(totalAmount)) {
    throw buildHttpError(
      409,
      "A soma dos pagamentos precisa ser exatamente igual ao total da comanda.",
      "cash_register_payment_total_mismatch",
      {
        expectedTotal: roundMoney(totalAmount),
        paymentTotal,
      }
    );
  }

  return normalized;
};

const serializeRegisterRow = (row = {}) => ({
  id: row.id,
  tenantId: row.tenant_id || row.tenantId,
  restaurantId: row.restaurant_id || row.restaurantId,
  restaurantKey: row.restaurant_key || row.restaurantKey,
  status: row.status,
  openingUserId: row.opening_user_id ?? row.openingUserId ?? "",
  openingUserLogin: row.opening_user_login ?? row.openingUserLogin ?? "",
  openingUserDisplayName:
    row.opening_user_display_name ?? row.openingUserDisplayName ?? "",
  openingAmount: Number(row.opening_amount ?? row.openingAmount ?? 0),
  serviceChargeRate: Number(
    row.service_charge_rate ?? row.serviceChargeRate ?? 10
  ),
  openingNotes: row.opening_notes ?? row.openingNotes ?? "",
  openedAt: row.opened_at ?? row.openedAt ?? "",
  closingUserId: row.closing_user_id ?? row.closingUserId ?? "",
  closingUserLogin: row.closing_user_login ?? row.closingUserLogin ?? "",
  closingUserDisplayName:
    row.closing_user_display_name ?? row.closingUserDisplayName ?? "",
  countedCash:
    row.counted_cash === null || typeof row.counted_cash === "undefined"
      ? row.countedCash ?? null
      : Number(row.counted_cash),
  expectedCash:
    row.expected_cash === null || typeof row.expected_cash === "undefined"
      ? row.expectedCash ?? null
      : Number(row.expected_cash),
  differenceAmount:
    row.difference_amount === null ||
    typeof row.difference_amount === "undefined"
      ? row.differenceAmount ?? null
      : Number(row.difference_amount),
  closingNotes: row.closing_notes ?? row.closingNotes ?? "",
  totals: row.totals_json ?? row.totals ?? {},
  closedAt: row.closed_at ?? row.closedAt ?? null,
  createdAt: row.created_at ?? row.createdAt ?? "",
  updatedAt: row.updated_at ?? row.updatedAt ?? "",
});
const serializeTableRow = (row = {}) => ({
  id: row.id,
  tenantId: row.tenant_id || row.tenantId,
  restaurantId: row.restaurant_id || row.restaurantId,
  restaurantKey: row.restaurant_key || row.restaurantKey,
  number:
    row.number === null || typeof row.number === "undefined"
      ? null
      : Number(row.number),
  label: row.label || "",
  capacity: Number(row.capacity || 0),
  status: row.status || "FREE",
  active: row.active !== false,
  sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0),
  createdAt: row.created_at ?? row.createdAt ?? "",
  updatedAt: row.updated_at ?? row.updatedAt ?? "",
});
const serializeTabRow = (row = {}) => ({
  id: row.id,
  tenantId: row.tenant_id || row.tenantId,
  restaurantId: row.restaurant_id || row.restaurantId,
  restaurantKey: row.restaurant_key || row.restaurantKey,
  cashRegisterId: row.cash_register_id ?? row.cashRegisterId,
  tableId: row.table_id ?? row.tableId,
  publicId: row.public_id ?? row.publicId,
  status: row.status,
  waiterId: row.waiter_id ?? row.waiterId ?? "",
  waiterLogin: row.waiter_login ?? row.waiterLogin ?? "",
  waiterName: row.waiter_name ?? row.waiterName ?? "",
  customerId: row.customer_id ?? row.customerId ?? "",
  customerName: row.customer_name ?? row.customerName ?? "",
  guestCount: Number(row.guest_count ?? row.guestCount ?? 1),
  subtotal: Number(row.subtotal || 0),
  discountAmount: Number(row.discount_amount ?? row.discountAmount ?? 0),
  serviceChargeRate: Number(
    row.service_charge_rate ?? row.serviceChargeRate ?? 0
  ),
  serviceChargeEnabled:
    (row.service_charge_enabled ?? row.serviceChargeEnabled) !== false,
  serviceChargeAmount: Number(
    row.service_charge_amount ?? row.serviceChargeAmount ?? 0
  ),
  additionAmount: Number(row.addition_amount ?? row.additionAmount ?? 0),
  totalAmount: Number(row.total_amount ?? row.totalAmount ?? 0),
  openedAt: row.opened_at ?? row.openedAt ?? "",
  closingStartedAt:
    row.closing_started_at ?? row.closingStartedAt ?? null,
  closedAt: row.closed_at ?? row.closedAt ?? null,
  closedByLogin: row.closed_by_login ?? row.closedByLogin ?? "",
  closedByDisplayName:
    row.closed_by_display_name ?? row.closedByDisplayName ?? "",
  createdAt: row.created_at ?? row.createdAt ?? "",
  updatedAt: row.updated_at ?? row.updatedAt ?? "",
});
const serializeItemRow = (row = {}) => ({
  id: row.id,
  tenantId: row.tenant_id || row.tenantId,
  restaurantId: row.restaurant_id || row.restaurantId,
  restaurantKey: row.restaurant_key || row.restaurantKey,
  tabId: row.tab_id ?? row.tabId,
  productId: row.product_id ?? row.productId,
  productName: row.product_name ?? row.productName,
  category: row.category || "",
  imageUrl: row.image_url ?? row.imageUrl ?? "",
  notes: row.notes || "",
  quantity: Number(row.quantity || 0),
  unitPrice: Number(row.unit_price ?? row.unitPrice ?? 0),
  totalPrice: Number(row.total_price ?? row.totalPrice ?? 0),
  status: row.derived_status || row.status || "PENDING",
  batchId: row.batch_id ?? row.batchId ?? null,
  orderId: row.order_id ?? row.orderId ?? null,
  createdByLogin: row.created_by_login ?? row.createdByLogin ?? "",
  createdByDisplayName:
    row.created_by_display_name ?? row.createdByDisplayName ?? "",
  sentByLogin: row.sent_by_login ?? row.sentByLogin ?? "",
  sentAt: row.sent_at ?? row.sentAt ?? null,
  createdAt: row.created_at ?? row.createdAt ?? "",
  updatedAt: row.updated_at ?? row.updatedAt ?? "",
});
const serializeBatchRow = (row = {}) => ({
  id: row.id,
  tenantId: row.tenant_id || row.tenantId,
  restaurantId: row.restaurant_id || row.restaurantId,
  restaurantKey: row.restaurant_key || row.restaurantKey,
  tabId: row.tab_id ?? row.tabId,
  batchNumber: Number(row.batch_number ?? row.batchNumber ?? 0),
  orderId: row.order_id ?? row.orderId,
  orderStatus: row.order_status ?? row.orderStatus ?? "",
  orderPublicId: row.order_public_id ?? row.orderPublicId ?? "",
  sentByLogin: row.sent_by_login ?? row.sentByLogin ?? "",
  sentByDisplayName:
    row.sent_by_display_name ?? row.sentByDisplayName ?? "",
  sentAt: row.sent_at ?? row.sentAt ?? "",
});
const serializePaymentRow = (row = {}) => ({
  id: row.id,
  tenantId: row.tenant_id || row.tenantId,
  restaurantId: row.restaurant_id || row.restaurantId,
  restaurantKey: row.restaurant_key || row.restaurantKey,
  paymentSetId: row.payment_set_id ?? row.paymentSetId,
  cashRegisterId: row.cash_register_id ?? row.cashRegisterId,
  tabId: row.tab_id ?? row.tabId,
  method: row.method,
  amount: Number(row.amount || 0),
  receivedAmount:
    row.received_amount === null ||
    typeof row.received_amount === "undefined"
      ? row.receivedAmount ?? null
      : Number(row.received_amount),
  changeAmount: Number(row.change_amount ?? row.changeAmount ?? 0),
  status: row.status || "CONFIRMED",
  createdByLogin: row.created_by_login ?? row.createdByLogin ?? "",
  createdByDisplayName:
    row.created_by_display_name ?? row.createdByDisplayName ?? "",
  createdAt: row.created_at ?? row.createdAt ?? "",
});
const serializeAuditRow = (row = {}) => ({
  id: row.id,
  tenantId: row.tenant_id || row.tenantId,
  restaurantId: row.restaurant_id || row.restaurantId,
  restaurantKey: row.restaurant_key || row.restaurantKey,
  cashRegisterId: row.cash_register_id ?? row.cashRegisterId ?? "",
  tabId: row.tab_id ?? row.tabId ?? "",
  tableId: row.table_id ?? row.tableId ?? "",
  eventType: row.event_type ?? row.eventType,
  actorIdentityId: row.actor_identity_id ?? row.actorIdentityId ?? "",
  actorLogin: row.actor_login ?? row.actorLogin ?? "",
  actorDisplayName:
    row.actor_display_name ?? row.actorDisplayName ?? "",
  before: row.before_json ?? row.before ?? null,
  after: row.after_json ?? row.after ?? null,
  metadata: row.metadata_json ?? row.metadata ?? {},
  createdAt: row.created_at ?? row.createdAt ?? "",
});

const buildRegisterSummary = ({ register, tabs = [], payments = [] }) => {
  if (!register) {
    return null;
  }

  const registerTabs = tabs.filter(
    (tab) => tab.cashRegisterId === register.id && tab.status === "CLOSED"
  );
  const registerPayments = payments.filter(
    (payment) =>
      payment.cashRegisterId === register.id && payment.status === "CONFIRMED"
  );
  const byMethod = PAYMENT_METHODS.reduce((summary, method) => {
    summary[method] = roundMoney(
      registerPayments
        .filter((payment) => payment.method === method)
        .reduce((sum, payment) => sum + payment.amount, 0)
    );
    return summary;
  }, {});
  const totalSold = roundMoney(
    registerPayments.reduce((sum, payment) => sum + payment.amount, 0)
  );
  const discounts = roundMoney(
    registerTabs.reduce((sum, tab) => sum + tab.discountAmount, 0)
  );
  const serviceCharges = roundMoney(
    registerTabs.reduce((sum, tab) => sum + tab.serviceChargeAmount, 0)
  );

  return {
    paymentTotals: byMethod,
    discounts,
    serviceCharges,
    totalSold,
    closedTabs: registerTabs.length,
    expectedCash: roundMoney(register.openingAmount + (byMethod.CASH || 0)),
  };
};

const composeSnapshot = ({
  tenant,
  register,
  lastClosedRegister = null,
  tables = [],
  tabs = [],
  items = [],
  batches = [],
  payments = [],
  audits = [],
  storageMode,
}) => {
  const tableMap = new Map(tables.map((table) => [table.id, table]));
  const itemMap = new Map();
  items.forEach((item) => {
    if (!itemMap.has(item.tabId)) {
      itemMap.set(item.tabId, []);
    }
    itemMap.get(item.tabId).push(item);
  });
  const batchMap = new Map();
  batches.forEach((batch) => {
    if (!batchMap.has(batch.tabId)) {
      batchMap.set(batch.tabId, []);
    }
    batchMap.get(batch.tabId).push(batch);
  });
  const paymentMap = new Map();
  payments.forEach((payment) => {
    if (!paymentMap.has(payment.tabId)) {
      paymentMap.set(payment.tabId, []);
    }
    paymentMap.get(payment.tabId).push(payment);
  });
  const enrichedTabs = tabs.map((tab) => ({
    ...tab,
    table: tableMap.get(tab.tableId) || null,
    items: (itemMap.get(tab.id) || []).sort(
      (left, right) => new Date(left.createdAt) - new Date(right.createdAt)
    ),
    batches: (batchMap.get(tab.id) || []).sort(
      (left, right) => left.batchNumber - right.batchNumber
    ),
    payments: paymentMap.get(tab.id) || [],
  }));
  const activeTabMap = new Map(
    enrichedTabs
      .filter((tab) => ACTIVE_TAB_STATUSES.has(tab.status))
      .map((tab) => [tab.tableId, tab])
  );
  const enrichedTables = tables.map((table) => {
    const tab = activeTabMap.get(table.id) || null;
    return {
      ...table,
      status: tab
        ? tab.status === "AWAITING_PAYMENT"
          ? "AWAITING_PAYMENT"
          : "OCCUPIED"
        : table.status,
      activeTab: tab
        ? {
            id: tab.id,
            publicId: tab.publicId,
            status: tab.status,
            guestCount: tab.guestCount,
            openedAt: tab.openedAt,
            totalAmount: calculateTabValues(tab.items, {
              discountAmount: tab.discountAmount,
              serviceChargeEnabled: tab.serviceChargeEnabled,
              serviceChargeRate: tab.serviceChargeRate,
              additionAmount: tab.additionAmount,
            }).totalAmount,
          }
        : null,
    };
  });
  const openRegisterSummary = buildRegisterSummary({
    register,
    tabs: enrichedTabs,
    payments,
  });

  return {
    storageMode,
    generatedAt: nowIso(),
    tenant: {
      tenantId: tenant.tenantId,
      restaurantId: tenant.restaurantId,
      restaurantKey: tenant.restaurantKey,
    },
    register,
    registerSummary: openRegisterSummary,
    lastClosedRegister,
    tables: enrichedTables.sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        String(left.label).localeCompare(String(right.label), "pt-BR")
    ),
    activeTabs: enrichedTabs.filter((tab) => ACTIVE_TAB_STATUSES.has(tab.status)),
    recentTabs: enrichedTabs
      .filter((tab) => !ACTIVE_TAB_STATUSES.has(tab.status))
      .sort((left, right) => new Date(right.closedAt) - new Date(left.closedAt))
      .slice(0, 30),
    auditEvents: audits.slice(0, 80),
    paymentMethods: PAYMENT_METHODS,
  };
};

const syncLocalBatchStatuses = async (scope, tenant) => {
  const orderStatusById = new Map();

  for (const batch of scope.batches) {
    try {
      const payload = await getAdminOrderDetails(
        batch.orderId,
        tenantOptions(tenant)
      );
      const status = payload?.order?.status || "";
      batch.orderStatus = status;
      batch.orderPublicId = payload?.order?.publicId || batch.orderPublicId || "";
      orderStatusById.set(batch.orderId, status);
    } catch (error) {
      if (error?.statusCode !== 404) {
        throw error;
      }
    }
  }

  scope.items.forEach((item) => {
    if (!item.orderId || item.status === "PENDING") {
      return;
    }
    const derivedStatus = ORDER_TO_ITEM_STATUS[orderStatusById.get(item.orderId)];
    if (derivedStatus) {
      item.status = derivedStatus;
    }
  });
};

const getLocalSnapshot = async (tenant) => {
  const scope = await readLocalScope(tenant);
  await syncLocalBatchStatuses(scope, tenant);
  const registers = scope.registers.map(serializeRegisterRow);
  const register = registers.find((entry) => entry.status === "OPEN") || null;
  const lastClosedRegister =
    registers
      .filter((entry) => entry.status === "CLOSED")
      .sort((left, right) => new Date(right.closedAt) - new Date(left.closedAt))[0] ||
    null;
  return composeSnapshot({
    tenant,
    register,
    lastClosedRegister,
    tables: scope.tables.map(serializeTableRow),
    tabs: scope.tabs.map(serializeTabRow),
    items: scope.items.map(serializeItemRow),
    batches: scope.batches.map(serializeBatchRow),
    payments: scope.payments.map(serializePaymentRow),
    audits: scope.audits.map(serializeAuditRow),
    storageMode: "file",
  });
};

const getNeonSnapshot = async (tenant) => {
  await ensureNeonSchema();
  const sql = getSql();
  const [
    registerRows,
    lastClosedRows,
    tableRows,
    tabRows,
    itemRows,
    batchRows,
    paymentRows,
    auditRows,
  ] = await Promise.all([
    sql`
      SELECT * FROM cash_register_sessions
      WHERE tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND status = 'OPEN'
      ORDER BY opened_at DESC
      LIMIT 1
    `,
    sql`
      SELECT * FROM cash_register_sessions
      WHERE tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND status = 'CLOSED'
      ORDER BY closed_at DESC
      LIMIT 1
    `,
    sql`
      SELECT * FROM dining_tables
      WHERE tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND restaurant_key = ${tenant.restaurantKey}
        AND active = TRUE
      ORDER BY sort_order ASC, label ASC
    `,
    sql`
      SELECT * FROM dining_tabs
      WHERE tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND restaurant_key = ${tenant.restaurantKey}
        AND (
          status IN ('OPEN', 'AWAITING_PAYMENT')
          OR closed_at >= NOW() - INTERVAL '30 days'
        )
      ORDER BY opened_at DESC
      LIMIT 200
    `,
    sql`
      SELECT item.*,
        COALESCE(
          CASE orders.status
            WHEN 'Recebido' THEN 'SENT'
            WHEN 'Aceito' THEN 'SENT'
            WHEN 'Em preparo' THEN 'IN_PREPARATION'
            WHEN 'Pronto' THEN 'READY'
            WHEN 'Saiu para entrega' THEN 'READY'
            WHEN 'Entregue' THEN 'DELIVERED'
            WHEN 'Retirada concluida' THEN 'DELIVERED'
            WHEN 'Finalizado' THEN 'DELIVERED'
            WHEN 'Cancelado' THEN 'CANCELLED'
            ELSE NULL
          END,
          item.status
        ) AS derived_status
      FROM dining_tab_items AS item
      LEFT JOIN orders
        ON orders.id = item.order_id
       AND orders.tenant_id = item.tenant_id
       AND orders.restaurant_id = item.restaurant_id
      WHERE item.tenant_id = ${tenant.tenantId}
        AND item.restaurant_id = ${tenant.restaurantId}
        AND item.restaurant_key = ${tenant.restaurantKey}
      ORDER BY item.created_at ASC
      LIMIT 3000
    `,
    sql`
      SELECT batch.*, orders.status AS order_status,
        orders.public_id AS order_public_id
      FROM dining_order_batches AS batch
      INNER JOIN orders
        ON orders.id = batch.order_id
       AND orders.tenant_id = batch.tenant_id
       AND orders.restaurant_id = batch.restaurant_id
      WHERE batch.tenant_id = ${tenant.tenantId}
        AND batch.restaurant_id = ${tenant.restaurantId}
        AND batch.restaurant_key = ${tenant.restaurantKey}
      ORDER BY batch.sent_at DESC
      LIMIT 1000
    `,
    sql`
      SELECT * FROM cash_payments
      WHERE tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND restaurant_key = ${tenant.restaurantKey}
        AND created_at >= NOW() - INTERVAL '90 days'
      ORDER BY created_at DESC
      LIMIT 2000
    `,
    sql`
      SELECT * FROM cash_register_audit_events
      WHERE tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND restaurant_key = ${tenant.restaurantKey}
      ORDER BY created_at DESC
      LIMIT 80
    `,
  ]);

  return composeSnapshot({
    tenant,
    register: registerRows[0] ? serializeRegisterRow(registerRows[0]) : null,
    lastClosedRegister: lastClosedRows[0]
      ? serializeRegisterRow(lastClosedRows[0])
      : null,
    tables: tableRows.map(serializeTableRow),
    tabs: tabRows.map(serializeTabRow),
    items: itemRows.map(serializeItemRow),
    batches: batchRows.map(serializeBatchRow),
    payments: paymentRows.map(serializePaymentRow),
    audits: auditRows.map(serializeAuditRow),
    storageMode: "neon",
  });
};

const getCashRegisterSnapshot = async (options = {}) => {
  const tenant = getOperationalTenant(options, "cash-register:snapshot");
  assertStorageAvailable();
  return getStorageMode() === "neon"
    ? getNeonSnapshot(tenant)
    : getLocalSnapshot(tenant);
};

const configureDiningTablesLocal = async (payload, actor, tenant) =>
  withLocalMutation(tenant, async (scope) => {
    if (scope.tables.length) {
      throw buildHttpError(
        409,
        "O salao ja possui mesas configuradas.",
        "dining_tables_already_configured"
      );
    }
    const count = toInteger(payload.count, {
      min: 1,
      max: MAX_TABLES,
      field: "quantidade de mesas",
    });
    const capacity = toInteger(payload.capacity || payload.defaultCapacity || 4, {
      min: 1,
      max: 50,
      field: "capacidade",
    });
    const createdAt = nowIso();
    scope.tables = Array.from({ length: count }, (_, index) => ({
      id: createId("table"),
      tenantId: tenant.tenantId,
      restaurantId: tenant.restaurantId,
      restaurantKey: tenant.restaurantKey,
      number: index + 1,
      label: `Mesa ${String(index + 1).padStart(2, "0")}`,
      capacity,
      status: "FREE",
      active: true,
      sortOrder: index + 1,
      createdAt,
      updatedAt: createdAt,
    }));
    appendLocalAudit(scope, {
      tenant,
      actor,
      eventType: "TABLES_CONFIGURED",
      after: { count, capacity },
    });
    return {
      storageMode: "file",
      message: `${count} mesa(s) configurada(s) com sucesso.`,
    };
  });

const configureDiningTablesNeon = async (payload, actor, tenant) => {
  await ensureNeonSchema();
  const sql = getSql();
  const existing = await sql`
    SELECT COUNT(*)::int AS count
    FROM dining_tables
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
  `;
  if (Number(existing[0]?.count || 0) > 0) {
    throw buildHttpError(
      409,
      "O salao ja possui mesas configuradas.",
      "dining_tables_already_configured"
    );
  }
  const count = toInteger(payload.count, {
    min: 1,
    max: MAX_TABLES,
    field: "quantidade de mesas",
  });
  const capacity = toInteger(payload.capacity || payload.defaultCapacity || 4, {
    min: 1,
    max: 50,
    field: "capacidade",
  });
  const queries = Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const label = `Mesa ${String(number).padStart(2, "0")}`;
    return sql`
      INSERT INTO dining_tables (
        id, tenant_id, restaurant_id, restaurant_key, number, label,
        capacity, status, active, sort_order, created_at, updated_at
      )
      VALUES (
        ${createId("table")}, ${tenant.tenantId}, ${tenant.restaurantId},
        ${tenant.restaurantKey}, ${number}, ${label}, ${capacity}, 'FREE',
        TRUE, ${number}, NOW(), NOW()
      )
    `;
  });
  const audit = buildAuditRecord({
    tenant,
    actor,
    eventType: "TABLES_CONFIGURED",
    after: { count, capacity },
  });
  queries.push(sql`
    INSERT INTO cash_register_audit_events (
      id, tenant_id, restaurant_id, restaurant_key, cash_register_id,
      tab_id, table_id, event_type, actor_identity_id, actor_login,
      actor_display_name, before_json, after_json, metadata_json, created_at
    )
    VALUES (
      ${audit.id}, ${tenant.tenantId}, ${tenant.restaurantId},
      ${tenant.restaurantKey}, '', '', '', ${audit.eventType},
      ${actor.identityId}, ${actor.login}, ${actor.displayName}, NULL,
      ${JSON.stringify(audit.after)}::jsonb, '{}'::jsonb, NOW()
    )
  `);
  try {
    await sql.transaction(queries);
  } catch (error) {
    if (String(error?.message || "").toLowerCase().includes("unique")) {
      throw buildHttpError(
        409,
        "O salao ja foi configurado por outro operador.",
        "dining_tables_already_configured"
      );
    }
    throw error;
  }
  return {
    storageMode: "neon",
    message: `${count} mesa(s) configurada(s) com sucesso.`,
  };
};

const configureDiningTables = async (payload = {}, actorInput = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "cash-register:configure-tables");
  const actor = normalizeActor(actorInput);
  assertActor(actor);
  assertStorageAvailable();
  return getStorageMode() === "neon"
    ? configureDiningTablesNeon(payload, actor, tenant)
    : configureDiningTablesLocal(payload, actor, tenant);
};

const openCashRegisterLocal = async (payload, actor, tenant) =>
  withLocalMutation(tenant, async (scope) => {
    if (findOpenRegister(scope)) {
      throw buildHttpError(
        409,
        "Ja existe um caixa aberto para este restaurante.",
        "cash_register_already_open"
      );
    }
    const openingAmount = toMoney(payload.openingAmount ?? payload.initialAmount ?? 0, {
      field: "valor inicial",
    });
    const serviceChargeRate = toMoney(payload.serviceChargeRate ?? 10, {
      min: 0,
      max: 30,
      field: "percentual da taxa de servico",
    });
    const openedAt = nowIso();
    const register = {
      id: createId("register"),
      tenantId: tenant.tenantId,
      restaurantId: tenant.restaurantId,
      restaurantKey: tenant.restaurantKey,
      status: "OPEN",
      openingUserId: actor.identityId,
      openingUserLogin: actor.login,
      openingUserDisplayName: actor.displayName,
      openingAmount,
      serviceChargeRate,
      openingNotes: normalizeMultiline(payload.notes || payload.openingNotes),
      openedAt,
      closingUserId: "",
      closingUserLogin: "",
      closingUserDisplayName: "",
      countedCash: null,
      expectedCash: null,
      differenceAmount: null,
      closingNotes: "",
      totals: {},
      closedAt: null,
      createdAt: openedAt,
      updatedAt: openedAt,
    };
    scope.registers.unshift(register);
    scope.movements.unshift({
      id: createId("cash_movement"),
      tenantId: tenant.tenantId,
      restaurantId: tenant.restaurantId,
      restaurantKey: tenant.restaurantKey,
      cashRegisterId: register.id,
      tabId: null,
      paymentSetId: null,
      movementType: "OPENING",
      paymentMethod: "CASH",
      amount: openingAmount,
      metadata: { notes: register.openingNotes },
      createdByLogin: actor.login,
      createdByDisplayName: actor.displayName,
      createdAt: openedAt,
    });
    appendLocalAudit(scope, {
      tenant,
      actor,
      eventType: "REGISTER_OPENED",
      registerId: register.id,
      after: {
        openingAmount,
        serviceChargeRate,
        openedAt,
      },
    });
    return {
      storageMode: "file",
      register,
      message: "Caixa aberto com sucesso.",
    };
  });

const openCashRegisterNeon = async (payload, actor, tenant) => {
  await ensureNeonSchema();
  const sql = getSql();
  const existing = await sql`
    SELECT id FROM cash_register_sessions
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND status = 'OPEN'
    LIMIT 1
  `;
  if (existing.length) {
    throw buildHttpError(
      409,
      "Ja existe um caixa aberto para este restaurante.",
      "cash_register_already_open"
    );
  }
  const openingAmount = toMoney(payload.openingAmount ?? payload.initialAmount ?? 0, {
    field: "valor inicial",
  });
  const serviceChargeRate = toMoney(payload.serviceChargeRate ?? 10, {
    min: 0,
    max: 30,
    field: "percentual da taxa de servico",
  });
  const notes = normalizeMultiline(payload.notes || payload.openingNotes);
  const registerId = createId("register");
  const movementId = createId("cash_movement");
  const audit = buildAuditRecord({
    tenant,
    actor,
    eventType: "REGISTER_OPENED",
    registerId,
    after: { openingAmount, serviceChargeRate },
  });
  try {
    await sql.transaction([
      sql`
        INSERT INTO cash_register_sessions (
          id, tenant_id, restaurant_id, restaurant_key, status,
          opening_user_id, opening_user_login, opening_user_display_name,
          opening_amount, service_charge_rate, opening_notes, opened_at,
          created_at, updated_at
        )
        VALUES (
          ${registerId}, ${tenant.tenantId}, ${tenant.restaurantId},
          ${tenant.restaurantKey}, 'OPEN', ${actor.identityId}, ${actor.login},
          ${actor.displayName}, ${openingAmount}, ${serviceChargeRate},
          ${notes}, NOW(), NOW(), NOW()
        )
      `,
      sql`
        INSERT INTO cash_register_movements (
          id, tenant_id, restaurant_id, restaurant_key, cash_register_id,
          tab_id, payment_set_id, movement_type, payment_method, amount,
          metadata_json, created_by_login, created_by_display_name, created_at
        )
        VALUES (
          ${movementId}, ${tenant.tenantId}, ${tenant.restaurantId},
          ${tenant.restaurantKey}, ${registerId}, NULL, NULL, 'OPENING',
          'CASH', ${openingAmount}, ${JSON.stringify({ notes })}::jsonb,
          ${actor.login}, ${actor.displayName}, NOW()
        )
      `,
      sql`
        INSERT INTO cash_register_audit_events (
          id, tenant_id, restaurant_id, restaurant_key, cash_register_id,
          tab_id, table_id, event_type, actor_identity_id, actor_login,
          actor_display_name, before_json, after_json, metadata_json, created_at
        )
        VALUES (
          ${audit.id}, ${tenant.tenantId}, ${tenant.restaurantId},
          ${tenant.restaurantKey}, ${registerId}, '', '', ${audit.eventType},
          ${actor.identityId}, ${actor.login}, ${actor.displayName}, NULL,
          ${JSON.stringify(audit.after)}::jsonb, '{}'::jsonb, NOW()
        )
      `,
    ]);
  } catch (error) {
    if (String(error?.message || "").toLowerCase().includes("unique")) {
      throw buildHttpError(
        409,
        "O caixa ja foi aberto por outro operador.",
        "cash_register_already_open"
      );
    }
    throw error;
  }
  return {
    storageMode: "neon",
    message: "Caixa aberto com sucesso.",
    registerId,
  };
};

const openCashRegister = async (payload = {}, actorInput = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "cash-register:open");
  const actor = normalizeActor(actorInput);
  assertActor(actor);
  assertStorageAvailable();
  return getStorageMode() === "neon"
    ? openCashRegisterNeon(payload, actor, tenant)
    : openCashRegisterLocal(payload, actor, tenant);
};

const computeClosingTotals = ({ register, tabs, payments }) =>
  buildRegisterSummary({ register, tabs, payments }) || {
    paymentTotals: PAYMENT_METHODS.reduce((summary, method) => {
      summary[method] = 0;
      return summary;
    }, {}),
    discounts: 0,
    serviceCharges: 0,
    totalSold: 0,
    closedTabs: 0,
    expectedCash: register?.openingAmount || 0,
  };

const closeCashRegisterLocal = async (payload, actor, tenant) =>
  withLocalMutation(tenant, async (scope) => {
    const register = findOpenRegister(scope);
    assertOpenRegister(register);
    const activeTabs = scope.tabs.filter(
      (tab) =>
        tab.cashRegisterId === register.id && ACTIVE_TAB_STATUSES.has(tab.status)
    );
    if (activeTabs.length) {
      throw buildHttpError(
        409,
        "Finalize todas as comandas antes de fechar o caixa.",
        "cash_register_has_open_tabs",
        { openTabs: activeTabs.length }
      );
    }
    const totals = computeClosingTotals({
      register: serializeRegisterRow(register),
      tabs: scope.tabs.map(serializeTabRow),
      payments: scope.payments.map(serializePaymentRow),
    });
    const countedCash = toMoney(payload.countedCash, {
      field: "valor contado em dinheiro",
    });
    const closedAt = nowIso();
    register.status = "CLOSED";
    register.closingUserId = actor.identityId;
    register.closingUserLogin = actor.login;
    register.closingUserDisplayName = actor.displayName;
    register.countedCash = countedCash;
    register.expectedCash = totals.expectedCash;
    register.differenceAmount = roundMoney(countedCash - totals.expectedCash);
    register.closingNotes = normalizeMultiline(payload.notes || payload.closingNotes);
    register.totals = totals;
    register.closedAt = closedAt;
    register.updatedAt = closedAt;
    scope.movements.unshift({
      id: createId("cash_movement"),
      tenantId: tenant.tenantId,
      restaurantId: tenant.restaurantId,
      restaurantKey: tenant.restaurantKey,
      cashRegisterId: register.id,
      tabId: null,
      paymentSetId: null,
      movementType: "CLOSING",
      paymentMethod: "CASH",
      amount: countedCash,
      metadata: {
        expectedCash: totals.expectedCash,
        differenceAmount: register.differenceAmount,
      },
      createdByLogin: actor.login,
      createdByDisplayName: actor.displayName,
      createdAt: closedAt,
    });
    appendLocalAudit(scope, {
      tenant,
      actor,
      eventType: "REGISTER_CLOSED",
      registerId: register.id,
      before: { status: "OPEN" },
      after: {
        status: "CLOSED",
        countedCash,
        expectedCash: totals.expectedCash,
        differenceAmount: register.differenceAmount,
        totals,
      },
    });
    return {
      storageMode: "file",
      register: serializeRegisterRow(register),
      totals,
      message: "Caixa fechado com sucesso.",
    };
  });

const closeCashRegisterNeon = async (payload, actor, tenant) => {
  await ensureNeonSchema();
  const sql = getSql();
  const registerRows = await sql`
    SELECT * FROM cash_register_sessions
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND status = 'OPEN'
    LIMIT 1
  `;
  const register = registerRows[0]
    ? serializeRegisterRow(registerRows[0])
    : null;
  assertOpenRegister(register);
  const activeRows = await sql`
    SELECT COUNT(*)::int AS count
    FROM dining_tabs
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND cash_register_id = ${register.id}
      AND status IN ('OPEN', 'AWAITING_PAYMENT')
  `;
  if (Number(activeRows[0]?.count || 0) > 0) {
    throw buildHttpError(
      409,
      "Finalize todas as comandas antes de fechar o caixa.",
      "cash_register_has_open_tabs",
      { openTabs: Number(activeRows[0]?.count || 0) }
    );
  }
  const tabRows = await sql`
    SELECT * FROM dining_tabs
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND cash_register_id = ${register.id}
      AND status = 'CLOSED'
  `;
  const paymentRows = await sql`
    SELECT * FROM cash_payments
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND cash_register_id = ${register.id}
      AND status = 'CONFIRMED'
  `;
  const totals = computeClosingTotals({
    register,
    tabs: tabRows.map(serializeTabRow),
    payments: paymentRows.map(serializePaymentRow),
  });
  const countedCash = toMoney(payload.countedCash, {
    field: "valor contado em dinheiro",
  });
  const differenceAmount = roundMoney(countedCash - totals.expectedCash);
  const notes = normalizeMultiline(payload.notes || payload.closingNotes);
  const movementId = createId("cash_movement");
  const audit = buildAuditRecord({
    tenant,
    actor,
    eventType: "REGISTER_CLOSED",
    registerId: register.id,
    before: { status: "OPEN" },
    after: {
      status: "CLOSED",
      countedCash,
      expectedCash: totals.expectedCash,
      differenceAmount,
      totals,
    },
  });
  const results = await sql.transaction([
    sql`
      SELECT pg_advisory_xact_lock(hashtextextended(${registerLockKey(tenant)}, 0))
    `,
    sql`
      WITH closed_register AS (
        UPDATE cash_register_sessions
        SET status = 'CLOSED',
            closing_user_id = ${actor.identityId},
            closing_user_login = ${actor.login},
            closing_user_display_name = ${actor.displayName},
            counted_cash = ${countedCash},
            expected_cash = ${totals.expectedCash},
            difference_amount = ${differenceAmount},
            closing_notes = ${notes},
            totals_json = ${JSON.stringify(totals)}::jsonb,
            closed_at = NOW(),
            updated_at = NOW()
        WHERE id = ${register.id}
          AND tenant_id = ${tenant.tenantId}
          AND restaurant_id = ${tenant.restaurantId}
          AND status = 'OPEN'
          AND NOT EXISTS (
            SELECT 1
            FROM dining_tabs AS active_tab
            WHERE active_tab.tenant_id = ${tenant.tenantId}
              AND active_tab.restaurant_id = ${tenant.restaurantId}
              AND active_tab.cash_register_id = ${register.id}
              AND active_tab.status IN ('OPEN', 'AWAITING_PAYMENT')
          )
        RETURNING id
      ),
      closing_movement AS (
        INSERT INTO cash_register_movements (
          id, tenant_id, restaurant_id, restaurant_key, cash_register_id,
          tab_id, payment_set_id, movement_type, payment_method, amount,
          metadata_json, created_by_login, created_by_display_name, created_at
        )
        SELECT
          ${movementId}, ${tenant.tenantId}, ${tenant.restaurantId},
          ${tenant.restaurantKey}, id, NULL, NULL, 'CLOSING', 'CASH',
          ${countedCash},
          ${JSON.stringify({
            expectedCash: totals.expectedCash,
            differenceAmount,
          })}::jsonb,
          ${actor.login}, ${actor.displayName}, NOW()
        FROM closed_register
        RETURNING id
      ),
      closing_audit AS (
        INSERT INTO cash_register_audit_events (
          id, tenant_id, restaurant_id, restaurant_key, cash_register_id,
          tab_id, table_id, event_type, actor_identity_id, actor_login,
          actor_display_name, before_json, after_json, metadata_json, created_at
        )
        SELECT
          ${audit.id}, ${tenant.tenantId}, ${tenant.restaurantId},
          ${tenant.restaurantKey}, id, '', '', ${audit.eventType},
          ${actor.identityId}, ${actor.login}, ${actor.displayName},
          ${JSON.stringify(audit.before)}::jsonb,
          ${JSON.stringify(audit.after)}::jsonb, '{}'::jsonb, NOW()
        FROM closed_register
        RETURNING id
      )
      SELECT id FROM closed_register
    `,
  ]);
  if (!results[1]?.length) {
    throw buildHttpError(
      409,
      "O caixa mudou de estado ou ainda possui comandas abertas.",
      "cash_register_close_conflict"
    );
  }
  return {
    storageMode: "neon",
    totals,
    message: "Caixa fechado com sucesso.",
  };
};

const closeCashRegister = async (payload = {}, actorInput = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "cash-register:close");
  const actor = normalizeActor(actorInput);
  assertActor(actor);
  assertStorageAvailable();
  return getStorageMode() === "neon"
    ? closeCashRegisterNeon(payload, actor, tenant)
    : closeCashRegisterLocal(payload, actor, tenant);
};

const normalizeOpenTabInput = (payload, actor) => ({
  tableId: normalizeText(payload.tableId, 180),
  waiterId: normalizeText(payload.waiterId || actor.identityId, 160),
  waiterLogin: normalizeText(payload.waiterLogin || actor.login, 160).toLowerCase(),
  waiterName:
    normalizeText(payload.waiterName || actor.displayName, 180) ||
    actor.displayName,
  customerId: normalizeText(payload.customerId, 160),
  customerName: normalizeText(payload.customerName, 180),
  guestCount: toInteger(payload.guestCount || payload.customerCount || 1, {
    min: 1,
    max: 100,
    field: "quantidade de clientes",
  }),
});

const openDiningTabLocal = async (payload, actor, tenant) =>
  withLocalMutation(tenant, async (scope) => {
    const register = findOpenRegister(scope);
    assertOpenRegister(register);
    const input = normalizeOpenTabInput(payload, actor);
    const table = scope.tables.find(
      (entry) => entry.id === input.tableId && entry.active !== false
    );
    if (!table || table.status === "UNAVAILABLE") {
      throw buildHttpError(
        404,
        "Mesa nao encontrada ou indisponivel.",
        "dining_table_not_available"
      );
    }
    if (findActiveTabForTable(scope, table.id)) {
      throw buildHttpError(
        409,
        "Esta mesa ja possui uma comanda aberta.",
        "dining_table_already_has_tab"
      );
    }
    const openedAt = nowIso();
    const tab = {
      id: createId("tab"),
      tenantId: tenant.tenantId,
      restaurantId: tenant.restaurantId,
      restaurantKey: tenant.restaurantKey,
      cashRegisterId: register.id,
      tableId: table.id,
      publicId: createPublicTabId(),
      status: "OPEN",
      waiterId: input.waiterId,
      waiterLogin: input.waiterLogin,
      waiterName: input.waiterName,
      customerId: input.customerId,
      customerName: input.customerName,
      guestCount: input.guestCount,
      subtotal: 0,
      discountAmount: 0,
      serviceChargeRate: register.serviceChargeRate,
      serviceChargeEnabled: true,
      serviceChargeAmount: 0,
      additionAmount: 0,
      totalAmount: 0,
      openedAt,
      closingStartedAt: null,
      closedAt: null,
      closedByLogin: "",
      closedByDisplayName: "",
      createdAt: openedAt,
      updatedAt: openedAt,
    };
    scope.tabs.unshift(tab);
    table.status = "OCCUPIED";
    table.updatedAt = openedAt;
    appendLocalAudit(scope, {
      tenant,
      actor,
      eventType: "TAB_OPENED",
      registerId: register.id,
      tabId: tab.id,
      tableId: table.id,
      after: {
        publicId: tab.publicId,
        guestCount: tab.guestCount,
        waiterName: tab.waiterName,
      },
    });
    return {
      storageMode: "file",
      tab: serializeTabRow(tab),
      message: "Comanda aberta com sucesso.",
    };
  });

const openDiningTabNeon = async (payload, actor, tenant) => {
  await ensureNeonSchema();
  const sql = getSql();
  const input = normalizeOpenTabInput(payload, actor);
  const [registerRows, tableRows, activeRows] = await Promise.all([
    sql`
      SELECT * FROM cash_register_sessions
      WHERE tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND status = 'OPEN'
      LIMIT 1
    `,
    sql`
      SELECT * FROM dining_tables
      WHERE id = ${input.tableId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND active = TRUE
      LIMIT 1
    `,
    sql`
      SELECT id FROM dining_tabs
      WHERE table_id = ${input.tableId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND status IN ('OPEN', 'AWAITING_PAYMENT')
      LIMIT 1
    `,
  ]);
  const register = registerRows[0]
    ? serializeRegisterRow(registerRows[0])
    : null;
  assertOpenRegister(register);
  const table = tableRows[0] ? serializeTableRow(tableRows[0]) : null;
  if (!table || table.status === "UNAVAILABLE") {
    throw buildHttpError(
      404,
      "Mesa nao encontrada ou indisponivel.",
      "dining_table_not_available"
    );
  }
  if (activeRows.length) {
    throw buildHttpError(
      409,
      "Esta mesa ja possui uma comanda aberta.",
      "dining_table_already_has_tab"
    );
  }
  const tabId = createId("tab");
  const publicId = createPublicTabId();
  const audit = buildAuditRecord({
    tenant,
    actor,
    eventType: "TAB_OPENED",
    registerId: register.id,
    tabId,
    tableId: table.id,
    after: {
      publicId,
      guestCount: input.guestCount,
      waiterName: input.waiterName,
    },
  });
  try {
    const results = await sql.transaction([
      sql`
        SELECT pg_advisory_xact_lock(hashtextextended(${registerLockKey(tenant)}, 0))
      `,
      sql`
        INSERT INTO dining_tabs (
          id, tenant_id, restaurant_id, restaurant_key, cash_register_id,
          table_id, public_id, status, waiter_id, waiter_login, waiter_name,
          customer_id, customer_name, guest_count, subtotal, discount_amount,
          service_charge_rate, service_charge_enabled, service_charge_amount,
          addition_amount, total_amount, opened_at, created_at, updated_at
        )
        SELECT
          ${tabId}, ${tenant.tenantId}, ${tenant.restaurantId},
          ${tenant.restaurantKey}, ${register.id}, ${table.id}, ${publicId},
          'OPEN', ${input.waiterId}, ${input.waiterLogin}, ${input.waiterName},
          ${input.customerId}, ${input.customerName}, ${input.guestCount}, 0, 0,
          ${register.serviceChargeRate}, TRUE, 0, 0, 0, NOW(), NOW(), NOW()
        FROM cash_register_sessions AS current_register
        WHERE current_register.id = ${register.id}
          AND current_register.tenant_id = ${tenant.tenantId}
          AND current_register.restaurant_id = ${tenant.restaurantId}
          AND current_register.status = 'OPEN'
        RETURNING id
      `,
      sql`
        UPDATE dining_tables
        SET status = 'OCCUPIED', updated_at = NOW()
        WHERE id = ${table.id}
          AND tenant_id = ${tenant.tenantId}
          AND restaurant_id = ${tenant.restaurantId}
          AND status = 'FREE'
          AND EXISTS (
            SELECT 1 FROM dining_tabs
            WHERE id = ${tabId}
              AND tenant_id = ${tenant.tenantId}
              AND restaurant_id = ${tenant.restaurantId}
          )
      `,
      sql`
        INSERT INTO cash_register_audit_events (
          id, tenant_id, restaurant_id, restaurant_key, cash_register_id,
          tab_id, table_id, event_type, actor_identity_id, actor_login,
          actor_display_name, before_json, after_json, metadata_json, created_at
        )
        SELECT
          ${audit.id}, ${tenant.tenantId}, ${tenant.restaurantId},
          ${tenant.restaurantKey}, ${register.id}, ${tabId}, ${table.id},
          ${audit.eventType}, ${actor.identityId}, ${actor.login},
          ${actor.displayName}, NULL, ${JSON.stringify(audit.after)}::jsonb,
          '{}'::jsonb, NOW()
        FROM dining_tabs
        WHERE id = ${tabId}
          AND tenant_id = ${tenant.tenantId}
          AND restaurant_id = ${tenant.restaurantId}
      `,
    ]);
    if (!results[1]?.length) {
      throw buildHttpError(
        409,
        "O caixa foi fechado por outro operador. Atualize a tela.",
        "cash_register_closed_during_tab_open"
      );
    }
  } catch (error) {
    if (error?.errorCode === "cash_register_closed_during_tab_open") {
      throw error;
    }
    if (String(error?.message || "").toLowerCase().includes("unique")) {
      throw buildHttpError(
        409,
        "Esta mesa ja foi ocupada por outro operador.",
        "dining_table_already_has_tab"
      );
    }
    throw error;
  }
  return {
    storageMode: "neon",
    tabId,
    publicId,
    message: "Comanda aberta com sucesso.",
  };
};

const openDiningTab = async (payload = {}, actorInput = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "cash-register:open-tab");
  const actor = normalizeActor(actorInput);
  assertActor(actor);
  assertStorageAvailable();
  return getStorageMode() === "neon"
    ? openDiningTabNeon(payload, actor, tenant)
    : openDiningTabLocal(payload, actor, tenant);
};

const buildNewItem = ({ payload, product, actor, tenant }) => {
  const quantity = toInteger(payload.quantity || 1, {
    min: 1,
    max: MAX_ITEM_QUANTITY,
    field: "quantidade",
  });
  const unitPrice = toMoney(product.price, {
    min: 0.01,
    field: "preco do produto",
  });
  const createdAt = nowIso();
  return {
    id: createId("tab_item"),
    tenantId: tenant.tenantId,
    restaurantId: tenant.restaurantId,
    restaurantKey: tenant.restaurantKey,
    tabId: normalizeText(payload.tabId, 180),
    productId: product.id,
    productName: product.name,
    category: product.category || product.sectionTitle || "",
    imageUrl: product.image || "",
    notes: normalizeMultiline(payload.notes, 400),
    quantity,
    unitPrice,
    totalPrice: roundMoney(unitPrice * quantity),
    status: "PENDING",
    batchId: null,
    orderId: null,
    createdByLogin: actor.login,
    createdByDisplayName: actor.displayName,
    sentByLogin: "",
    sentAt: null,
    createdAt,
    updatedAt: createdAt,
  };
};

const addDiningTabItemLocal = async (payload, actor, tenant, product) =>
  withLocalMutation(tenant, async (scope) => {
    const register = findOpenRegister(scope);
    assertOpenRegister(register);
    const tab = scope.tabs.find((entry) => entry.id === payload.tabId);
    assertOpenTab(tab);
    const item = buildNewItem({ payload, product, actor, tenant });
    item.tabId = tab.id;
    scope.items.push(item);
    const values = calculateTabValues(getTabItems(scope, tab.id), {
      discountAmount: tab.discountAmount,
      serviceChargeEnabled: false,
      serviceChargeRate: tab.serviceChargeRate,
      additionAmount: tab.additionAmount,
    });
    Object.assign(tab, values, {
      serviceChargeEnabled: tab.serviceChargeEnabled,
      serviceChargeAmount: tab.serviceChargeAmount,
      totalAmount: values.subtotal,
      updatedAt: nowIso(),
    });
    appendLocalAudit(scope, {
      tenant,
      actor,
      eventType: "ITEM_ADDED",
      registerId: register.id,
      tabId: tab.id,
      tableId: tab.tableId,
      after: {
        itemId: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      },
    });
    return {
      storageMode: "file",
      item: serializeItemRow(item),
      message: "Item adicionado a comanda.",
    };
  });

const addDiningTabItemNeon = async (payload, actor, tenant, product) => {
  await ensureNeonSchema();
  const sql = getSql();
  const tabId = normalizeText(payload.tabId, 180);
  const [registerRows, tabRows] = await Promise.all([
    sql`
      SELECT * FROM cash_register_sessions
      WHERE tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND status = 'OPEN'
      LIMIT 1
    `,
    sql`
      SELECT * FROM dining_tabs
      WHERE id = ${tabId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
      LIMIT 1
    `,
  ]);
  const register = registerRows[0]
    ? serializeRegisterRow(registerRows[0])
    : null;
  const tab = tabRows[0] ? serializeTabRow(tabRows[0]) : null;
  assertOpenRegister(register);
  assertOpenTab(tab);
  const item = buildNewItem({ payload: { ...payload, tabId }, product, actor, tenant });
  const audit = buildAuditRecord({
    tenant,
    actor,
    eventType: "ITEM_ADDED",
    registerId: register.id,
    tabId,
    tableId: tab.tableId,
    after: {
      itemId: item.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    },
  });
  await sql.transaction([
    sql`
      INSERT INTO dining_tab_items (
        id, tenant_id, restaurant_id, restaurant_key, tab_id, product_id,
        product_name, category, image_url, notes, quantity, unit_price,
        total_price, status, batch_id, order_id, created_by_login,
        created_by_display_name, sent_by_login, sent_at, created_at, updated_at
      )
      VALUES (
        ${item.id}, ${tenant.tenantId}, ${tenant.restaurantId},
        ${tenant.restaurantKey}, ${tabId}, ${item.productId},
        ${item.productName}, ${item.category}, ${item.imageUrl}, ${item.notes},
        ${item.quantity}, ${item.unitPrice}, ${item.totalPrice}, 'PENDING',
        NULL, NULL, ${actor.login}, ${actor.displayName}, '', NULL, NOW(), NOW()
      )
    `,
    sql`
      UPDATE dining_tabs
      SET subtotal = (
            SELECT COALESCE(SUM(total_price), 0)
            FROM dining_tab_items
            WHERE tab_id = ${tabId}
              AND tenant_id = ${tenant.tenantId}
              AND restaurant_id = ${tenant.restaurantId}
              AND status <> 'CANCELLED'
          ),
          total_amount = (
            SELECT COALESCE(SUM(total_price), 0)
            FROM dining_tab_items
            WHERE tab_id = ${tabId}
              AND tenant_id = ${tenant.tenantId}
              AND restaurant_id = ${tenant.restaurantId}
              AND status <> 'CANCELLED'
          ),
          updated_at = NOW()
      WHERE id = ${tabId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND status = 'OPEN'
    `,
    sql`
      INSERT INTO cash_register_audit_events (
        id, tenant_id, restaurant_id, restaurant_key, cash_register_id,
        tab_id, table_id, event_type, actor_identity_id, actor_login,
        actor_display_name, before_json, after_json, metadata_json, created_at
      )
      VALUES (
        ${audit.id}, ${tenant.tenantId}, ${tenant.restaurantId},
        ${tenant.restaurantKey}, ${register.id}, ${tabId}, ${tab.tableId},
        ${audit.eventType}, ${actor.identityId}, ${actor.login},
        ${actor.displayName}, NULL, ${JSON.stringify(audit.after)}::jsonb,
        '{}'::jsonb, NOW()
      )
    `,
  ]);
  return {
    storageMode: "neon",
    item,
    message: "Item adicionado a comanda.",
  };
};

const addDiningTabItem = async (payload = {}, actorInput = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "cash-register:add-item");
  const actor = normalizeActor(actorInput);
  assertActor(actor);
  assertStorageAvailable();
  const product = await getCatalogProduct(payload.productId, tenant);
  return getStorageMode() === "neon"
    ? addDiningTabItemNeon(payload, actor, tenant, product)
    : addDiningTabItemLocal(payload, actor, tenant, product);
};

const updateDiningTabItemLocal = async (payload, actor, tenant) =>
  withLocalMutation(tenant, async (scope) => {
    const register = findOpenRegister(scope);
    assertOpenRegister(register);
    const item = scope.items.find((entry) => entry.id === payload.itemId);
    const tab = item
      ? scope.tabs.find((entry) => entry.id === item.tabId)
      : null;
    assertOpenTab(tab);
    if (!item || item.status !== EDITABLE_ITEM_STATUS) {
      throw buildHttpError(
        409,
        "Somente itens pendentes podem ser alterados.",
        "dining_item_not_editable"
      );
    }
    const before = serializeItemRow(item);
    item.quantity = toInteger(payload.quantity, {
      min: 1,
      max: MAX_ITEM_QUANTITY,
      field: "quantidade",
    });
    if (Object.prototype.hasOwnProperty.call(payload, "notes")) {
      item.notes = normalizeMultiline(payload.notes, 400);
    }
    item.totalPrice = roundMoney(item.quantity * item.unitPrice);
    item.updatedAt = nowIso();
    const values = calculateTabValues(getTabItems(scope, tab.id), {
      serviceChargeEnabled: false,
    });
    tab.subtotal = values.subtotal;
    tab.totalAmount = values.subtotal;
    tab.updatedAt = item.updatedAt;
    appendLocalAudit(scope, {
      tenant,
      actor,
      eventType: "ITEM_UPDATED",
      registerId: register.id,
      tabId: tab.id,
      tableId: tab.tableId,
      before,
      after: serializeItemRow(item),
    });
    return {
      storageMode: "file",
      item: serializeItemRow(item),
      message: "Item pendente atualizado.",
    };
  });

const updateDiningTabItemNeon = async (payload, actor, tenant) => {
  await ensureNeonSchema();
  const sql = getSql();
  const itemId = normalizeText(payload.itemId, 180);
  const rows = await sql`
    SELECT item.*, tab.status AS tab_status, tab.table_id,
      tab.cash_register_id
    FROM dining_tab_items AS item
    INNER JOIN dining_tabs AS tab ON tab.id = item.tab_id
    INNER JOIN cash_register_sessions AS register
      ON register.id = tab.cash_register_id
    WHERE item.id = ${itemId}
      AND item.tenant_id = ${tenant.tenantId}
      AND item.restaurant_id = ${tenant.restaurantId}
      AND register.status = 'OPEN'
    LIMIT 1
  `;
  const row = rows[0];
  if (!row || row.tab_status !== "OPEN" || row.status !== "PENDING") {
    throw buildHttpError(
      409,
      "Somente itens pendentes de uma comanda aberta podem ser alterados.",
      "dining_item_not_editable"
    );
  }
  const before = serializeItemRow(row);
  const quantity = toInteger(payload.quantity, {
    min: 1,
    max: MAX_ITEM_QUANTITY,
    field: "quantidade",
  });
  const notes = Object.prototype.hasOwnProperty.call(payload, "notes")
    ? normalizeMultiline(payload.notes, 400)
    : before.notes;
  const totalPrice = roundMoney(before.unitPrice * quantity);
  const audit = buildAuditRecord({
    tenant,
    actor,
    eventType: "ITEM_UPDATED",
    registerId: row.cash_register_id,
    tabId: before.tabId,
    tableId: row.table_id,
    before,
    after: { ...before, quantity, notes, totalPrice },
  });
  await sql.transaction([
    sql`
      UPDATE dining_tab_items
      SET quantity = ${quantity}, notes = ${notes},
          total_price = ${totalPrice}, updated_at = NOW()
      WHERE id = ${itemId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND status = 'PENDING'
    `,
    sql`
      UPDATE dining_tabs
      SET subtotal = (
            SELECT COALESCE(SUM(total_price), 0)
            FROM dining_tab_items
            WHERE tab_id = ${before.tabId}
              AND tenant_id = ${tenant.tenantId}
              AND restaurant_id = ${tenant.restaurantId}
              AND status <> 'CANCELLED'
          ),
          total_amount = (
            SELECT COALESCE(SUM(total_price), 0)
            FROM dining_tab_items
            WHERE tab_id = ${before.tabId}
              AND tenant_id = ${tenant.tenantId}
              AND restaurant_id = ${tenant.restaurantId}
              AND status <> 'CANCELLED'
          ),
          updated_at = NOW()
      WHERE id = ${before.tabId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND status = 'OPEN'
    `,
    sql`
      INSERT INTO cash_register_audit_events (
        id, tenant_id, restaurant_id, restaurant_key, cash_register_id,
        tab_id, table_id, event_type, actor_identity_id, actor_login,
        actor_display_name, before_json, after_json, metadata_json, created_at
      )
      VALUES (
        ${audit.id}, ${tenant.tenantId}, ${tenant.restaurantId},
        ${tenant.restaurantKey}, ${row.cash_register_id}, ${before.tabId},
        ${row.table_id}, ${audit.eventType}, ${actor.identityId},
        ${actor.login}, ${actor.displayName},
        ${JSON.stringify(audit.before)}::jsonb,
        ${JSON.stringify(audit.after)}::jsonb, '{}'::jsonb, NOW()
      )
    `,
  ]);
  return {
    storageMode: "neon",
    item: audit.after,
    message: "Item pendente atualizado.",
  };
};

const updateDiningTabItem = async (payload = {}, actorInput = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "cash-register:update-item");
  const actor = normalizeActor(actorInput);
  assertActor(actor);
  assertStorageAvailable();
  return getStorageMode() === "neon"
    ? updateDiningTabItemNeon(payload, actor, tenant)
    : updateDiningTabItemLocal(payload, actor, tenant);
};

const removeDiningTabItemLocal = async (payload, actor, tenant) =>
  withLocalMutation(tenant, async (scope) => {
    const register = findOpenRegister(scope);
    assertOpenRegister(register);
    const itemIndex = scope.items.findIndex((entry) => entry.id === payload.itemId);
    const item = itemIndex >= 0 ? scope.items[itemIndex] : null;
    const tab = item
      ? scope.tabs.find((entry) => entry.id === item.tabId)
      : null;
    assertOpenTab(tab);
    if (!item || item.status !== "PENDING") {
      throw buildHttpError(
        409,
        "Somente itens pendentes podem ser removidos.",
        "dining_item_not_removable"
      );
    }
    scope.items.splice(itemIndex, 1);
    const values = calculateTabValues(getTabItems(scope, tab.id), {
      serviceChargeEnabled: false,
    });
    tab.subtotal = values.subtotal;
    tab.totalAmount = values.subtotal;
    tab.updatedAt = nowIso();
    appendLocalAudit(scope, {
      tenant,
      actor,
      eventType: "ITEM_REMOVED",
      registerId: register.id,
      tabId: tab.id,
      tableId: tab.tableId,
      before: serializeItemRow(item),
    });
    return {
      storageMode: "file",
      itemId: item.id,
      message: "Item pendente removido.",
    };
  });

const removeDiningTabItemNeon = async (payload, actor, tenant) => {
  await ensureNeonSchema();
  const sql = getSql();
  const itemId = normalizeText(payload.itemId, 180);
  const rows = await sql`
    SELECT item.*, tab.status AS tab_status, tab.table_id,
      tab.cash_register_id
    FROM dining_tab_items AS item
    INNER JOIN dining_tabs AS tab ON tab.id = item.tab_id
    INNER JOIN cash_register_sessions AS register
      ON register.id = tab.cash_register_id
    WHERE item.id = ${itemId}
      AND item.tenant_id = ${tenant.tenantId}
      AND item.restaurant_id = ${tenant.restaurantId}
      AND register.status = 'OPEN'
    LIMIT 1
  `;
  const row = rows[0];
  if (!row || row.tab_status !== "OPEN" || row.status !== "PENDING") {
    throw buildHttpError(
      409,
      "Somente itens pendentes de uma comanda aberta podem ser removidos.",
      "dining_item_not_removable"
    );
  }
  const item = serializeItemRow(row);
  const audit = buildAuditRecord({
    tenant,
    actor,
    eventType: "ITEM_REMOVED",
    registerId: row.cash_register_id,
    tabId: item.tabId,
    tableId: row.table_id,
    before: item,
  });
  await sql.transaction([
    sql`
      DELETE FROM dining_tab_items
      WHERE id = ${itemId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND status = 'PENDING'
    `,
    sql`
      UPDATE dining_tabs
      SET subtotal = (
            SELECT COALESCE(SUM(total_price), 0)
            FROM dining_tab_items
            WHERE tab_id = ${item.tabId}
              AND tenant_id = ${tenant.tenantId}
              AND restaurant_id = ${tenant.restaurantId}
              AND status <> 'CANCELLED'
          ),
          total_amount = (
            SELECT COALESCE(SUM(total_price), 0)
            FROM dining_tab_items
            WHERE tab_id = ${item.tabId}
              AND tenant_id = ${tenant.tenantId}
              AND restaurant_id = ${tenant.restaurantId}
              AND status <> 'CANCELLED'
          ),
          updated_at = NOW()
      WHERE id = ${item.tabId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND status = 'OPEN'
    `,
    sql`
      INSERT INTO cash_register_audit_events (
        id, tenant_id, restaurant_id, restaurant_key, cash_register_id,
        tab_id, table_id, event_type, actor_identity_id, actor_login,
        actor_display_name, before_json, after_json, metadata_json, created_at
      )
      VALUES (
        ${audit.id}, ${tenant.tenantId}, ${tenant.restaurantId},
        ${tenant.restaurantKey}, ${row.cash_register_id}, ${item.tabId},
        ${row.table_id}, ${audit.eventType}, ${actor.identityId},
        ${actor.login}, ${actor.displayName},
        ${JSON.stringify(item)}::jsonb, NULL, '{}'::jsonb, NOW()
      )
    `,
  ]);
  return {
    storageMode: "neon",
    itemId,
    message: "Item pendente removido.",
  };
};

const removeDiningTabItem = async (payload = {}, actorInput = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "cash-register:remove-item");
  const actor = normalizeActor(actorInput);
  assertActor(actor);
  assertStorageAvailable();
  return getStorageMode() === "neon"
    ? removeDiningTabItemNeon(payload, actor, tenant)
    : removeDiningTabItemLocal(payload, actor, tenant);
};

const buildDiningProductionOrder = ({
  tenant,
  tab,
  table,
  items,
  batchNumber,
  actor,
}) => {
  const subtotal = roundMoney(
    items.reduce((sum, item) => sum + item.totalPrice, 0)
  );
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const customerLabel =
    tab.customerName || table?.label || `Mesa ${tab.tableId.slice(-4)}`;
  return {
    customer: {
      key: `dining-tab:${tab.id}`,
      profileId: tab.customerId || "",
      name: customerLabel,
      phone: "",
      email: "",
    },
    order: {
      status: "Recebido",
      orderType: "Salao",
      fulfillmentMode: "dining",
      timingMode: "immediate",
      scheduledFor: null,
      scheduledDate: "",
      scheduledTime: "",
      scheduledLabel: "",
      paymentMethod: "pending",
      needsChange: false,
      cashAmountProvided: null,
      changeAmount: null,
      itemCount,
      subtotal,
      addonsTotal: 0,
      deliveryFee: 0,
      total: subtotal,
      customerNotes: `Comanda ${tab.publicId} · ${table?.label || "Mesa"}`,
      addressLine: "",
      addressNumber: "",
      addressComplement: "",
      addressReference: "",
      addressPostalCode: "",
      addressNeighborhood: "",
      addressCity: "",
      addressState: "",
      addressFull: table?.label || "",
      deliveryDistanceText: "",
      deliveryRouteBand: "",
      deliveryEstimateText: "",
      rawPayload: {
        channel: "dining",
        tenantId: tenant.tenantId,
        restaurantId: tenant.restaurantId,
        diningTabId: tab.id,
        diningTabPublicId: tab.publicId,
        tableId: tab.tableId,
        tableLabel: table?.label || "",
        batchNumber,
        waiterId: tab.waiterId,
        waiterLogin: tab.waiterLogin,
        waiterName: tab.waiterName,
        sentByLogin: actor.login,
        sentByDisplayName: actor.displayName,
      },
    },
    items: items.map((item) => ({
      id: item.productId,
      type: "product",
      name: item.productName,
      category: item.category,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      metadata: {
        channel: "dining",
        diningTabItemId: item.id,
        notes: item.notes,
        image: item.imageUrl,
      },
    })),
    requestSignature: `dining:${tenant.tenantId}:${tenant.restaurantId}:${tab.id}:batch:${batchNumber}`,
  };
};

const revalidatePendingItems = async (items, tenant) =>
  Promise.all(
    items.map(async (item) => {
      const product = await getCatalogProduct(item.productId, tenant);
      const unitPrice = toMoney(product.price, {
        min: 0.01,
        field: "preco do produto",
      });
      return {
        ...item,
        productName: product.name,
        category: product.category || product.sectionTitle || "",
        imageUrl: product.image || item.imageUrl || "",
        unitPrice,
        totalPrice: roundMoney(unitPrice * item.quantity),
      };
    })
  );

const sendDiningOrderLocal = async (payload, actor, tenant) =>
  withLocalMutation(tenant, async (scope) => {
    const register = findOpenRegister(scope);
    assertOpenRegister(register);
    const tab = scope.tabs.find((entry) => entry.id === payload.tabId);
    assertOpenTab(tab);
    const table = scope.tables.find((entry) => entry.id === tab.tableId) || null;
    const pending = getTabItems(scope, tab.id).filter(
      (item) => item.status === "PENDING"
    );
    if (!pending.length) {
      throw buildHttpError(
        409,
        "Nao ha itens pendentes para enviar.",
        "dining_no_pending_items"
      );
    }
    const validatedItems = await revalidatePendingItems(pending, tenant);
    validatedItems.forEach((validated) => {
      const current = scope.items.find((item) => item.id === validated.id);
      Object.assign(current, validated, { updatedAt: nowIso() });
    });
    const batchNumber =
      Math.max(
        0,
        ...scope.batches
          .filter((batch) => batch.tabId === tab.id)
          .map((batch) => Number(batch.batchNumber || 0))
      ) + 1;
    const orderInput = buildDiningProductionOrder({
      tenant,
      tab: serializeTabRow(tab),
      table: table ? serializeTableRow(table) : null,
      items: validatedItems.map(serializeItemRow),
      batchNumber,
      actor,
    });
    const orderResult = await createOrder(orderInput, tenantOptions(tenant));
    const batchId = createId("dining_batch");
    const sentAt = nowIso();
    const batch = {
      id: batchId,
      tenantId: tenant.tenantId,
      restaurantId: tenant.restaurantId,
      restaurantKey: tenant.restaurantKey,
      tabId: tab.id,
      batchNumber,
      orderId: orderResult.order.id,
      orderStatus: orderResult.order.status,
      orderPublicId: orderResult.order.publicId,
      sentByLogin: actor.login,
      sentByDisplayName: actor.displayName,
      sentAt,
    };
    scope.batches.push(batch);
    pending.forEach((pendingItem) => {
      const item = scope.items.find((entry) => entry.id === pendingItem.id);
      item.status = "SENT";
      item.batchId = batchId;
      item.orderId = orderResult.order.id;
      item.sentByLogin = actor.login;
      item.sentAt = sentAt;
      item.updatedAt = sentAt;
    });
    tab.subtotal = roundMoney(
      getTabItems(scope, tab.id).reduce(
        (sum, item) =>
          item.status === "CANCELLED" ? sum : sum + item.totalPrice,
        0
      )
    );
    tab.totalAmount = tab.subtotal;
    tab.updatedAt = sentAt;
    appendLocalAudit(scope, {
      tenant,
      actor,
      eventType: "ORDER_SENT",
      registerId: register.id,
      tabId: tab.id,
      tableId: tab.tableId,
      after: {
        batchId,
        batchNumber,
        orderId: orderResult.order.id,
        orderPublicId: orderResult.order.publicId,
        itemIds: pending.map((item) => item.id),
      },
    });
    return {
      storageMode: "file",
      batch: serializeBatchRow(batch),
      order: orderResult.order,
      message: `Pedido ${batchNumber} enviado para producao.`,
    };
  });

const sendDiningOrderNeon = async (payload, actor, tenant) => {
  await ensureNeonSchema();
  const sql = getSql();
  const tabId = normalizeText(payload.tabId, 180);
  const [registerRows, tabRows, itemRows, batchRows] = await Promise.all([
    sql`
      SELECT * FROM cash_register_sessions
      WHERE tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND status = 'OPEN'
      LIMIT 1
    `,
    sql`
      SELECT tab.*, dining_tables.label AS table_label,
        dining_tables.capacity AS table_capacity,
        dining_tables.number AS table_number
      FROM dining_tabs AS tab
      INNER JOIN dining_tables ON dining_tables.id = tab.table_id
      WHERE tab.id = ${tabId}
        AND tab.tenant_id = ${tenant.tenantId}
        AND tab.restaurant_id = ${tenant.restaurantId}
      LIMIT 1
    `,
    sql`
      SELECT * FROM dining_tab_items
      WHERE tab_id = ${tabId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND status = 'PENDING'
      ORDER BY created_at ASC
    `,
    sql`
      SELECT COALESCE(MAX(batch_number), 0)::int AS last_batch
      FROM dining_order_batches
      WHERE tab_id = ${tabId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
    `,
  ]);
  const register = registerRows[0]
    ? serializeRegisterRow(registerRows[0])
    : null;
  const tab = tabRows[0] ? serializeTabRow(tabRows[0]) : null;
  assertOpenRegister(register);
  assertOpenTab(tab);
  const pending = itemRows.map(serializeItemRow);
  if (!pending.length) {
    throw buildHttpError(
      409,
      "Nao ha itens pendentes para enviar.",
      "dining_no_pending_items"
    );
  }
  const validatedItems = await revalidatePendingItems(pending, tenant);
  const batchNumber = Number(batchRows[0]?.last_batch || 0) + 1;
  const table = {
    id: tab.tableId,
    label: tabRows[0].table_label || "",
    capacity: Number(tabRows[0].table_capacity || 0),
    number: Number(tabRows[0].table_number || 0),
  };
  const orderInput = buildDiningProductionOrder({
    tenant,
    tab,
    table,
    items: validatedItems,
    batchNumber,
    actor,
  });
  const orderResult = await createOrder(orderInput, tenantOptions(tenant));
  const batchId = createId("dining_batch");
  const audit = buildAuditRecord({
    tenant,
    actor,
    eventType: "ORDER_SENT",
    registerId: register.id,
    tabId,
    tableId: tab.tableId,
    after: {
      batchId,
      batchNumber,
      orderId: orderResult.order.id,
      orderPublicId: orderResult.order.publicId,
      itemIds: pending.map((item) => item.id),
    },
  });
  const queries = [
    sql`
      INSERT INTO dining_order_batches (
        id, tenant_id, restaurant_id, restaurant_key, tab_id, batch_number,
        order_id, sent_by_login, sent_by_display_name, sent_at
      )
      VALUES (
        ${batchId}, ${tenant.tenantId}, ${tenant.restaurantId},
        ${tenant.restaurantKey}, ${tabId}, ${batchNumber},
        ${orderResult.order.id}, ${actor.login}, ${actor.displayName}, NOW()
      )
    `,
  ];
  validatedItems.forEach((item) => {
    queries.push(sql`
      UPDATE dining_tab_items
      SET product_name = ${item.productName},
          category = ${item.category},
          image_url = ${item.imageUrl},
          unit_price = ${item.unitPrice},
          total_price = ${item.totalPrice},
          status = 'SENT',
          batch_id = ${batchId},
          order_id = ${orderResult.order.id},
          sent_by_login = ${actor.login},
          sent_at = NOW(),
          updated_at = NOW()
      WHERE id = ${item.id}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND tab_id = ${tabId}
        AND status = 'PENDING'
    `);
  });
  queries.push(
    sql`
      UPDATE dining_tabs
      SET subtotal = (
            SELECT COALESCE(SUM(total_price), 0)
            FROM dining_tab_items
            WHERE tab_id = ${tabId}
              AND tenant_id = ${tenant.tenantId}
              AND restaurant_id = ${tenant.restaurantId}
              AND status <> 'CANCELLED'
          ),
          total_amount = (
            SELECT COALESCE(SUM(total_price), 0)
            FROM dining_tab_items
            WHERE tab_id = ${tabId}
              AND tenant_id = ${tenant.tenantId}
              AND restaurant_id = ${tenant.restaurantId}
              AND status <> 'CANCELLED'
          ),
          updated_at = NOW()
      WHERE id = ${tabId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND status = 'OPEN'
    `,
    sql`
      INSERT INTO cash_register_audit_events (
        id, tenant_id, restaurant_id, restaurant_key, cash_register_id,
        tab_id, table_id, event_type, actor_identity_id, actor_login,
        actor_display_name, before_json, after_json, metadata_json, created_at
      )
      VALUES (
        ${audit.id}, ${tenant.tenantId}, ${tenant.restaurantId},
        ${tenant.restaurantKey}, ${register.id}, ${tabId}, ${tab.tableId},
        ${audit.eventType}, ${actor.identityId}, ${actor.login},
        ${actor.displayName}, NULL, ${JSON.stringify(audit.after)}::jsonb,
        ${JSON.stringify({
          inventoryStrategy: "existing_manual_inventory_without_recipe_mapping",
        })}::jsonb, NOW()
      )
    `
  );
  try {
    await sql.transaction(queries);
  } catch (error) {
    if (String(error?.message || "").toLowerCase().includes("unique")) {
      const existingBatch = await sql`
        SELECT batch.*, orders.status AS order_status,
          orders.public_id AS order_public_id
        FROM dining_order_batches AS batch
        INNER JOIN orders ON orders.id = batch.order_id
        WHERE batch.tenant_id = ${tenant.tenantId}
          AND batch.restaurant_id = ${tenant.restaurantId}
          AND batch.tab_id = ${tabId}
          AND batch.batch_number = ${batchNumber}
        LIMIT 1
      `;
      if (existingBatch[0]) {
        return {
          storageMode: "neon",
          batch: serializeBatchRow(existingBatch[0]),
          alreadyProcessed: true,
          message: `Pedido ${batchNumber} ja estava enviado.`,
        };
      }
    }
    throw error;
  }
  return {
    storageMode: "neon",
    batch: {
      id: batchId,
      tabId,
      batchNumber,
      orderId: orderResult.order.id,
      orderPublicId: orderResult.order.publicId,
      orderStatus: orderResult.order.status,
    },
    order: orderResult.order,
    message: `Pedido ${batchNumber} enviado para producao.`,
  };
};

const sendDiningOrder = async (payload = {}, actorInput = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "cash-register:send-order");
  const actor = normalizeActor(actorInput);
  assertActor(actor);
  assertStorageAvailable();
  return getStorageMode() === "neon"
    ? sendDiningOrderNeon(payload, actor, tenant)
    : sendDiningOrderLocal(payload, actor, tenant);
};

const normalizeClosingInput = (payload, register) => ({
  tabId: normalizeText(payload.tabId, 180),
  discountAmount: toMoney(payload.discountAmount ?? 0, {
    field: "desconto",
  }),
  serviceChargeEnabled: payload.serviceChargeEnabled !== false,
  serviceChargeRate: toMoney(
    payload.serviceChargeRate ?? register.serviceChargeRate ?? 10,
    {
      min: 0,
      max: 30,
      field: "percentual da taxa de servico",
    }
  ),
  additionAmount: toMoney(payload.additionAmount ?? 0, {
    field: "acrescimo",
  }),
});

const assertTabReadyToClose = (items) => {
  if (!items.length) {
    throw buildHttpError(
      409,
      "Adicione e envie ao menos um item antes de fechar a conta.",
      "dining_tab_empty"
    );
  }
  const pending = items.filter((item) => item.status === "PENDING");
  if (pending.length) {
    throw buildHttpError(
      409,
      "Envie todos os itens pendentes antes de fechar a conta.",
      "dining_tab_has_pending_items",
      { pendingItems: pending.length }
    );
  }
  const activeItems = items.filter((item) => item.status !== "CANCELLED");
  if (!activeItems.length) {
    throw buildHttpError(
      409,
      "A comanda nao possui itens validos para pagamento.",
      "dining_tab_no_billable_items"
    );
  }
};

const beginDiningTabClosingLocal = async (payload, actor, tenant) =>
  withLocalMutation(tenant, async (scope) => {
    const register = findOpenRegister(scope);
    assertOpenRegister(register);
    const input = normalizeClosingInput(payload, serializeRegisterRow(register));
    const tab = scope.tabs.find((entry) => entry.id === input.tabId);
    assertOpenTab(tab);
    const items = getTabItems(scope, tab.id);
    assertTabReadyToClose(items);
    const before = serializeTabRow(tab);
    const values = calculateTabValues(items, input);
    const closingStartedAt = nowIso();
    Object.assign(tab, values, {
      status: "AWAITING_PAYMENT",
      closingStartedAt,
      updatedAt: closingStartedAt,
    });
    const table = scope.tables.find((entry) => entry.id === tab.tableId);
    if (table) {
      table.status = "AWAITING_PAYMENT";
      table.updatedAt = closingStartedAt;
    }
    if (values.discountAmount > 0) {
      appendLocalAudit(scope, {
        tenant,
        actor,
        eventType: "DISCOUNT_APPLIED",
        registerId: register.id,
        tabId: tab.id,
        tableId: tab.tableId,
        before: { discountAmount: before.discountAmount },
        after: { discountAmount: values.discountAmount },
      });
    }
    if (!values.serviceChargeEnabled) {
      appendLocalAudit(scope, {
        tenant,
        actor,
        eventType: "SERVICE_CHARGE_REMOVED",
        registerId: register.id,
        tabId: tab.id,
        tableId: tab.tableId,
        before: { serviceChargeEnabled: true },
        after: { serviceChargeEnabled: false },
      });
    }
    appendLocalAudit(scope, {
      tenant,
      actor,
      eventType: "TAB_AWAITING_PAYMENT",
      registerId: register.id,
      tabId: tab.id,
      tableId: tab.tableId,
      before,
      after: serializeTabRow(tab),
    });
    return {
      storageMode: "file",
      tab: serializeTabRow(tab),
      message: "Conta calculada e aguardando pagamento.",
    };
  });

const beginDiningTabClosingNeon = async (payload, actor, tenant) => {
  await ensureNeonSchema();
  const sql = getSql();
  const tabId = normalizeText(payload.tabId, 180);
  const [registerRows, tabRows, itemRows] = await Promise.all([
    sql`
      SELECT * FROM cash_register_sessions
      WHERE tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND status = 'OPEN'
      LIMIT 1
    `,
    sql`
      SELECT * FROM dining_tabs
      WHERE id = ${tabId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
      LIMIT 1
    `,
    sql`
      SELECT * FROM dining_tab_items
      WHERE tab_id = ${tabId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
      ORDER BY created_at ASC
    `,
  ]);
  const register = registerRows[0]
    ? serializeRegisterRow(registerRows[0])
    : null;
  const tab = tabRows[0] ? serializeTabRow(tabRows[0]) : null;
  assertOpenRegister(register);
  assertOpenTab(tab);
  const items = itemRows.map(serializeItemRow);
  assertTabReadyToClose(items);
  const input = normalizeClosingInput(payload, register);
  const values = calculateTabValues(items, input);
  const audit = buildAuditRecord({
    tenant,
    actor,
    eventType: "TAB_AWAITING_PAYMENT",
    registerId: register.id,
    tabId,
    tableId: tab.tableId,
    before: tab,
    after: { ...tab, ...values, status: "AWAITING_PAYMENT" },
  });
  const queries = [
    sql`
      UPDATE dining_tabs
      SET status = 'AWAITING_PAYMENT',
          subtotal = ${values.subtotal},
          discount_amount = ${values.discountAmount},
          service_charge_rate = ${values.serviceChargeRate},
          service_charge_enabled = ${values.serviceChargeEnabled},
          service_charge_amount = ${values.serviceChargeAmount},
          addition_amount = ${values.additionAmount},
          total_amount = ${values.totalAmount},
          closing_started_at = NOW(),
          updated_at = NOW()
      WHERE id = ${tabId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND status = 'OPEN'
      RETURNING id
    `,
    sql`
      UPDATE dining_tables
      SET status = 'AWAITING_PAYMENT', updated_at = NOW()
      WHERE id = ${tab.tableId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
    `,
  ];
  if (values.discountAmount > 0) {
    const discountAudit = buildAuditRecord({
      tenant,
      actor,
      eventType: "DISCOUNT_APPLIED",
      registerId: register.id,
      tabId,
      tableId: tab.tableId,
      before: { discountAmount: tab.discountAmount },
      after: { discountAmount: values.discountAmount },
    });
    queries.push(sql`
      INSERT INTO cash_register_audit_events (
        id, tenant_id, restaurant_id, restaurant_key, cash_register_id,
        tab_id, table_id, event_type, actor_identity_id, actor_login,
        actor_display_name, before_json, after_json, metadata_json, created_at
      )
      VALUES (
        ${discountAudit.id}, ${tenant.tenantId}, ${tenant.restaurantId},
        ${tenant.restaurantKey}, ${register.id}, ${tabId}, ${tab.tableId},
        ${discountAudit.eventType}, ${actor.identityId}, ${actor.login},
        ${actor.displayName}, ${JSON.stringify(discountAudit.before)}::jsonb,
        ${JSON.stringify(discountAudit.after)}::jsonb, '{}'::jsonb, NOW()
      )
    `);
  }
  if (!values.serviceChargeEnabled) {
    const serviceAudit = buildAuditRecord({
      tenant,
      actor,
      eventType: "SERVICE_CHARGE_REMOVED",
      registerId: register.id,
      tabId,
      tableId: tab.tableId,
      before: { serviceChargeEnabled: true },
      after: { serviceChargeEnabled: false },
    });
    queries.push(sql`
      INSERT INTO cash_register_audit_events (
        id, tenant_id, restaurant_id, restaurant_key, cash_register_id,
        tab_id, table_id, event_type, actor_identity_id, actor_login,
        actor_display_name, before_json, after_json, metadata_json, created_at
      )
      VALUES (
        ${serviceAudit.id}, ${tenant.tenantId}, ${tenant.restaurantId},
        ${tenant.restaurantKey}, ${register.id}, ${tabId}, ${tab.tableId},
        ${serviceAudit.eventType}, ${actor.identityId}, ${actor.login},
        ${actor.displayName}, ${JSON.stringify(serviceAudit.before)}::jsonb,
        ${JSON.stringify(serviceAudit.after)}::jsonb, '{}'::jsonb, NOW()
      )
    `);
  }
  queries.push(sql`
    INSERT INTO cash_register_audit_events (
      id, tenant_id, restaurant_id, restaurant_key, cash_register_id,
      tab_id, table_id, event_type, actor_identity_id, actor_login,
      actor_display_name, before_json, after_json, metadata_json, created_at
    )
    VALUES (
      ${audit.id}, ${tenant.tenantId}, ${tenant.restaurantId},
      ${tenant.restaurantKey}, ${register.id}, ${tabId}, ${tab.tableId},
      ${audit.eventType}, ${actor.identityId}, ${actor.login},
      ${actor.displayName}, ${JSON.stringify(audit.before)}::jsonb,
      ${JSON.stringify(audit.after)}::jsonb, '{}'::jsonb, NOW()
    )
  `);
  const results = await sql.transaction(queries);
  if (!results[0]?.length) {
    throw buildHttpError(
      409,
      "A comanda mudou de estado durante o fechamento.",
      "dining_tab_state_conflict"
    );
  }
  return {
    storageMode: "neon",
    tab: audit.after,
    message: "Conta calculada e aguardando pagamento.",
  };
};

const beginDiningTabClosing = async (
  payload = {},
  actorInput = {},
  options = {}
) => {
  const tenant = getOperationalTenant(options, "cash-register:begin-closing");
  const actor = normalizeActor(actorInput);
  assertActor(actor);
  assertStorageAvailable();
  return getStorageMode() === "neon"
    ? beginDiningTabClosingNeon(payload, actor, tenant)
    : beginDiningTabClosingLocal(payload, actor, tenant);
};

const reopenDiningTabLocal = async (payload, actor, tenant) =>
  withLocalMutation(tenant, async (scope) => {
    const register = findOpenRegister(scope);
    assertOpenRegister(register);
    const tab = scope.tabs.find((entry) => entry.id === payload.tabId);
    if (!tab || tab.status !== "AWAITING_PAYMENT") {
      throw buildHttpError(
        409,
        "Somente uma conta aguardando pagamento pode ser reaberta.",
        "dining_tab_not_awaiting_payment"
      );
    }
    if (scope.paymentSets.some((entry) => entry.tabId === tab.id)) {
      throw buildHttpError(
        409,
        "A comanda ja possui pagamento confirmado.",
        "dining_tab_already_paid"
      );
    }
    const before = serializeTabRow(tab);
    tab.status = "OPEN";
    tab.closingStartedAt = null;
    tab.discountAmount = 0;
    tab.serviceChargeEnabled = true;
    tab.serviceChargeAmount = 0;
    tab.totalAmount = tab.subtotal;
    tab.updatedAt = nowIso();
    const table = scope.tables.find((entry) => entry.id === tab.tableId);
    if (table) {
      table.status = "OCCUPIED";
      table.updatedAt = tab.updatedAt;
    }
    appendLocalAudit(scope, {
      tenant,
      actor,
      eventType: "TAB_REOPENED",
      registerId: register.id,
      tabId: tab.id,
      tableId: tab.tableId,
      before,
      after: serializeTabRow(tab),
    });
    return {
      storageMode: "file",
      tab: serializeTabRow(tab),
      message: "Comanda reaberta para novos pedidos.",
    };
  });

const reopenDiningTabNeon = async (payload, actor, tenant) => {
  await ensureNeonSchema();
  const sql = getSql();
  const tabId = normalizeText(payload.tabId, 180);
  const rows = await sql`
    SELECT tab.*, register.status AS register_status
    FROM dining_tabs AS tab
    INNER JOIN cash_register_sessions AS register
      ON register.id = tab.cash_register_id
    LEFT JOIN cash_payment_sets AS payment_set
      ON payment_set.tab_id = tab.id
     AND payment_set.tenant_id = tab.tenant_id
     AND payment_set.restaurant_id = tab.restaurant_id
    WHERE tab.id = ${tabId}
      AND tab.tenant_id = ${tenant.tenantId}
      AND tab.restaurant_id = ${tenant.restaurantId}
      AND payment_set.id IS NULL
    LIMIT 1
  `;
  const row = rows[0];
  if (
    !row ||
    row.register_status !== "OPEN" ||
    row.status !== "AWAITING_PAYMENT"
  ) {
    throw buildHttpError(
      409,
      "A comanda nao pode ser reaberta neste estado.",
      "dining_tab_not_awaiting_payment"
    );
  }
  const tab = serializeTabRow(row);
  const audit = buildAuditRecord({
    tenant,
    actor,
    eventType: "TAB_REOPENED",
    registerId: tab.cashRegisterId,
    tabId,
    tableId: tab.tableId,
    before: tab,
    after: {
      ...tab,
      status: "OPEN",
      closingStartedAt: null,
      discountAmount: 0,
      serviceChargeEnabled: true,
      serviceChargeAmount: 0,
      totalAmount: tab.subtotal,
    },
  });
  const results = await sql.transaction([
    sql`
      UPDATE dining_tabs
      SET status = 'OPEN',
          discount_amount = 0,
          service_charge_enabled = TRUE,
          service_charge_amount = 0,
          total_amount = subtotal,
          closing_started_at = NULL,
          updated_at = NOW()
      WHERE id = ${tabId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND status = 'AWAITING_PAYMENT'
        AND NOT EXISTS (
          SELECT 1 FROM cash_payment_sets
          WHERE tab_id = ${tabId}
            AND tenant_id = ${tenant.tenantId}
            AND restaurant_id = ${tenant.restaurantId}
        )
      RETURNING id
    `,
    sql`
      UPDATE dining_tables
      SET status = 'OCCUPIED', updated_at = NOW()
      WHERE id = ${tab.tableId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
    `,
    sql`
      INSERT INTO cash_register_audit_events (
        id, tenant_id, restaurant_id, restaurant_key, cash_register_id,
        tab_id, table_id, event_type, actor_identity_id, actor_login,
        actor_display_name, before_json, after_json, metadata_json, created_at
      )
      VALUES (
        ${audit.id}, ${tenant.tenantId}, ${tenant.restaurantId},
        ${tenant.restaurantKey}, ${tab.cashRegisterId}, ${tabId},
        ${tab.tableId}, ${audit.eventType}, ${actor.identityId},
        ${actor.login}, ${actor.displayName},
        ${JSON.stringify(audit.before)}::jsonb,
        ${JSON.stringify(audit.after)}::jsonb, '{}'::jsonb, NOW()
      )
    `,
  ]);
  if (!results[0]?.length) {
    throw buildHttpError(
      409,
      "A comanda ja foi paga ou alterada por outro operador.",
      "dining_tab_state_conflict"
    );
  }
  return {
    storageMode: "neon",
    tab: audit.after,
    message: "Comanda reaberta para novos pedidos.",
  };
};

const reopenDiningTab = async (payload = {}, actorInput = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "cash-register:reopen-tab");
  const actor = normalizeActor(actorInput);
  assertActor(actor);
  assertStorageAvailable();
  return getStorageMode() === "neon"
    ? reopenDiningTabNeon(payload, actor, tenant)
    : reopenDiningTabLocal(payload, actor, tenant);
};

const normalizeIdempotencyKey = (value) => {
  const key = normalizeText(value, 180);
  if (key.length < 8) {
    throw buildHttpError(
      400,
      "Chave de idempotencia do pagamento invalida.",
      "cash_register_invalid_idempotency_key"
    );
  }
  return key;
};

const getPaymentMethodSummary = (payments) => {
  const keys = [...new Set(payments.map((payment) => payment.method))];
  if (keys.length > 1) {
    return "misto";
  }
  const labels = {
    CASH: "dinheiro",
    PIX: "pix",
    DEBIT_CARD: "cartao_debito",
    CREDIT_CARD: "cartao_credito",
    MEAL_VOUCHER: "vale_refeicao",
    OTHER: "outros",
  };
  return labels[keys[0]] || "outros";
};

const confirmDiningPaymentLocal = async (payload, actor, tenant) =>
  withLocalMutation(tenant, async (scope) => {
    const idempotencyKey = normalizeIdempotencyKey(payload.idempotencyKey);
    const existingSet = scope.paymentSets.find(
      (entry) =>
        entry.idempotencyKey === idempotencyKey ||
        entry.tabId === normalizeText(payload.tabId, 180)
    );
    if (existingSet) {
      return {
        storageMode: "file",
        paymentSet: cloneJson(existingSet),
        alreadyProcessed: true,
        message: "Pagamento ja confirmado anteriormente.",
      };
    }
    const register = findOpenRegister(scope);
    assertOpenRegister(register);
    const tab = scope.tabs.find((entry) => entry.id === payload.tabId);
    if (!tab || tab.status !== "AWAITING_PAYMENT") {
      throw buildHttpError(
        409,
        "A comanda precisa estar aguardando pagamento.",
        "dining_tab_not_awaiting_payment"
      );
    }
    const items = getTabItems(scope, tab.id);
    const recalculated = calculateTabValues(items, {
      discountAmount: tab.discountAmount,
      serviceChargeEnabled: tab.serviceChargeEnabled,
      serviceChargeRate: tab.serviceChargeRate,
      additionAmount: tab.additionAmount,
    });
    if (recalculated.totalAmount !== roundMoney(tab.totalAmount)) {
      throw buildHttpError(
        409,
        "O total da comanda mudou. Reabra o fechamento e confira os valores.",
        "dining_tab_total_changed"
      );
    }
    const payments = normalizePaymentInput(
      payload.payments,
      recalculated.totalAmount
    );
    const confirmedAt = nowIso();
    const paymentSet = {
      id: createId("payment_set"),
      tenantId: tenant.tenantId,
      restaurantId: tenant.restaurantId,
      restaurantKey: tenant.restaurantKey,
      cashRegisterId: register.id,
      tabId: tab.id,
      idempotencyKey,
      totalAmount: recalculated.totalAmount,
      confirmedByLogin: actor.login,
      confirmedByDisplayName: actor.displayName,
      confirmedAt,
    };
    const persistedPayments = payments.map((payment) => ({
      ...payment,
      tenantId: tenant.tenantId,
      restaurantId: tenant.restaurantId,
      restaurantKey: tenant.restaurantKey,
      paymentSetId: paymentSet.id,
      cashRegisterId: register.id,
      tabId: tab.id,
      status: "CONFIRMED",
      createdByLogin: actor.login,
      createdByDisplayName: actor.displayName,
      createdAt: confirmedAt,
    }));
    scope.paymentSets.push(paymentSet);
    scope.payments.push(...persistedPayments);
    persistedPayments.forEach((payment) => {
      scope.movements.unshift({
        id: createId("cash_movement"),
        tenantId: tenant.tenantId,
        restaurantId: tenant.restaurantId,
        restaurantKey: tenant.restaurantKey,
        cashRegisterId: register.id,
        tabId: tab.id,
        paymentSetId: paymentSet.id,
        movementType: "SALE",
        paymentMethod: payment.method,
        amount: payment.amount,
        metadata: {
          receivedAmount: payment.receivedAmount,
          changeAmount: payment.changeAmount,
          tabPublicId: tab.publicId,
        },
        createdByLogin: actor.login,
        createdByDisplayName: actor.displayName,
        createdAt: confirmedAt,
      });
    });
    const before = serializeTabRow(tab);
    Object.assign(tab, recalculated, {
      status: "CLOSED",
      closedAt: confirmedAt,
      closedByLogin: actor.login,
      closedByDisplayName: actor.displayName,
      updatedAt: confirmedAt,
    });
    const table = scope.tables.find((entry) => entry.id === tab.tableId);
    if (table) {
      table.status = "FREE";
      table.updatedAt = confirmedAt;
    }
    scope.items
      .filter((item) => item.tabId === tab.id && item.status !== "CANCELLED")
      .forEach((item) => {
        item.status = "DELIVERED";
        item.updatedAt = confirmedAt;
      });
    const tabBatches = scope.batches.filter((batch) => batch.tabId === tab.id);
    const paymentMethod = getPaymentMethodSummary(payments);
    for (const batch of tabBatches) {
      await updateAdminOrderStatus(
        batch.orderId,
        "Entregue",
        `Pagamento confirmado no salao · ${tab.publicId} · ${paymentMethod}`,
        {
          ...tenantOptions(tenant),
          actor: {
            login: actor.login,
            displayName: actor.displayName,
          },
        }
      );
      batch.orderStatus = "Entregue";
    }
    appendLocalAudit(scope, {
      tenant,
      actor,
      eventType: "PAYMENT_CONFIRMED",
      registerId: register.id,
      tabId: tab.id,
      tableId: tab.tableId,
      before,
      after: {
        ...serializeTabRow(tab),
        paymentSetId: paymentSet.id,
        payments: persistedPayments.map(serializePaymentRow),
      },
      metadata: {
        idempotencyKey,
        inventoryStrategy: "existing_manual_inventory_without_recipe_mapping",
      },
    });
    appendLocalAudit(scope, {
      tenant,
      actor,
      eventType: "TABLE_RELEASED",
      registerId: register.id,
      tabId: tab.id,
      tableId: tab.tableId,
      before: { status: "AWAITING_PAYMENT" },
      after: { status: "FREE" },
    });
    return {
      storageMode: "file",
      paymentSet,
      payments: persistedPayments.map(serializePaymentRow),
      tab: serializeTabRow(tab),
      message: "Pagamento confirmado e mesa liberada.",
    };
  });

const findExistingNeonPayment = async (tenant, { idempotencyKey, tabId }) => {
  const rows = await getSql()`
    SELECT * FROM cash_payment_sets
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND (
        idempotency_key = ${idempotencyKey}
        OR tab_id = ${tabId}
      )
    ORDER BY confirmed_at DESC
    LIMIT 1
  `;
  return rows[0] || null;
};

const confirmDiningPaymentNeon = async (payload, actor, tenant) => {
  await ensureNeonSchema();
  const sql = getSql();
  const tabId = normalizeText(payload.tabId, 180);
  const idempotencyKey = normalizeIdempotencyKey(payload.idempotencyKey);
  const existing = await findExistingNeonPayment(tenant, {
    idempotencyKey,
    tabId,
  });
  if (existing) {
    return {
      storageMode: "neon",
      paymentSet: {
        id: existing.id,
        tabId: existing.tab_id,
        idempotencyKey: existing.idempotency_key,
        totalAmount: Number(existing.total_amount || 0),
        confirmedAt: existing.confirmed_at,
      },
      alreadyProcessed: true,
      message: "Pagamento ja confirmado anteriormente.",
    };
  }
  const [registerRows, tabRows, itemRows, batchRows] = await Promise.all([
    sql`
      SELECT * FROM cash_register_sessions
      WHERE tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND status = 'OPEN'
      LIMIT 1
    `,
    sql`
      SELECT * FROM dining_tabs
      WHERE id = ${tabId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
      LIMIT 1
    `,
    sql`
      SELECT * FROM dining_tab_items
      WHERE tab_id = ${tabId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
      ORDER BY created_at ASC
    `,
    sql`
      SELECT * FROM dining_order_batches
      WHERE tab_id = ${tabId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
      ORDER BY batch_number ASC
    `,
  ]);
  const register = registerRows[0]
    ? serializeRegisterRow(registerRows[0])
    : null;
  const tab = tabRows[0] ? serializeTabRow(tabRows[0]) : null;
  assertOpenRegister(register);
  if (!tab || tab.status !== "AWAITING_PAYMENT") {
    throw buildHttpError(
      409,
      "A comanda precisa estar aguardando pagamento.",
      "dining_tab_not_awaiting_payment"
    );
  }
  const items = itemRows.map(serializeItemRow);
  const recalculated = calculateTabValues(items, {
    discountAmount: tab.discountAmount,
    serviceChargeEnabled: tab.serviceChargeEnabled,
    serviceChargeRate: tab.serviceChargeRate,
    additionAmount: tab.additionAmount,
  });
  if (recalculated.totalAmount !== roundMoney(tab.totalAmount)) {
    throw buildHttpError(
      409,
      "O total da comanda mudou. Reabra o fechamento e confira os valores.",
      "dining_tab_total_changed"
    );
  }
  const payments = normalizePaymentInput(
    payload.payments,
    recalculated.totalAmount
  );
  const paymentSetId = createId("payment_set");
  const paymentMethod = getPaymentMethodSummary(payments);
  const audit = buildAuditRecord({
    tenant,
    actor,
    eventType: "PAYMENT_CONFIRMED",
    registerId: register.id,
    tabId,
    tableId: tab.tableId,
    before: tab,
    after: {
      ...tab,
      ...recalculated,
      status: "CLOSED",
      paymentSetId,
      payments,
    },
    metadata: {
      idempotencyKey,
      inventoryStrategy: "existing_manual_inventory_without_recipe_mapping",
    },
  });
  const tableAudit = buildAuditRecord({
    tenant,
    actor,
    eventType: "TABLE_RELEASED",
    registerId: register.id,
    tabId,
    tableId: tab.tableId,
    before: { status: "AWAITING_PAYMENT" },
    after: { status: "FREE" },
  });
  const queries = [
    sql`
      INSERT INTO cash_payment_sets (
        id, tenant_id, restaurant_id, restaurant_key, cash_register_id,
        tab_id, idempotency_key, total_amount, confirmed_by_login,
        confirmed_by_display_name, confirmed_at
      )
      SELECT
        ${paymentSetId}, ${tenant.tenantId}, ${tenant.restaurantId},
        ${tenant.restaurantKey}, ${register.id}, ${tabId}, ${idempotencyKey},
        ${recalculated.totalAmount}, ${actor.login}, ${actor.displayName}, NOW()
      FROM dining_tabs AS current_tab
      INNER JOIN cash_register_sessions AS current_register
        ON current_register.id = current_tab.cash_register_id
      WHERE current_tab.id = ${tabId}
        AND current_tab.tenant_id = ${tenant.tenantId}
        AND current_tab.restaurant_id = ${tenant.restaurantId}
        AND current_tab.status = 'AWAITING_PAYMENT'
        AND current_register.id = ${register.id}
        AND current_register.status = 'OPEN'
    `,
  ];
  payments.forEach((payment) => {
    const movementId = createId("cash_movement");
    queries.push(
      sql`
        INSERT INTO cash_payments (
          id, tenant_id, restaurant_id, restaurant_key, payment_set_id,
          cash_register_id, tab_id, method, amount, received_amount,
          change_amount, status, created_by_login, created_by_display_name,
          created_at
        )
        VALUES (
          ${payment.id}, ${tenant.tenantId}, ${tenant.restaurantId},
          ${tenant.restaurantKey}, ${paymentSetId}, ${register.id}, ${tabId},
          ${payment.method}, ${payment.amount}, ${payment.receivedAmount},
          ${payment.changeAmount}, 'CONFIRMED', ${actor.login},
          ${actor.displayName}, NOW()
        )
      `,
      sql`
        INSERT INTO cash_register_movements (
          id, tenant_id, restaurant_id, restaurant_key, cash_register_id,
          tab_id, payment_set_id, movement_type, payment_method, amount,
          metadata_json, created_by_login, created_by_display_name, created_at
        )
        VALUES (
          ${movementId}, ${tenant.tenantId}, ${tenant.restaurantId},
          ${tenant.restaurantKey}, ${register.id}, ${tabId}, ${paymentSetId},
          'SALE', ${payment.method}, ${payment.amount},
          ${JSON.stringify({
            receivedAmount: payment.receivedAmount,
            changeAmount: payment.changeAmount,
            tabPublicId: tab.publicId,
          })}::jsonb,
          ${actor.login}, ${actor.displayName}, NOW()
        )
      `
    );
  });
  queries.push(
    sql`
      UPDATE dining_tabs
      SET status = 'CLOSED',
          subtotal = ${recalculated.subtotal},
          discount_amount = ${recalculated.discountAmount},
          service_charge_rate = ${recalculated.serviceChargeRate},
          service_charge_enabled = ${recalculated.serviceChargeEnabled},
          service_charge_amount = ${recalculated.serviceChargeAmount},
          addition_amount = ${recalculated.additionAmount},
          total_amount = ${recalculated.totalAmount},
          closed_at = NOW(),
          closed_by_login = ${actor.login},
          closed_by_display_name = ${actor.displayName},
          updated_at = NOW()
      WHERE id = ${tabId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND status = 'AWAITING_PAYMENT'
    `,
    sql`
      UPDATE dining_tables
      SET status = 'FREE', updated_at = NOW()
      WHERE id = ${tab.tableId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND status = 'AWAITING_PAYMENT'
    `,
    sql`
      UPDATE dining_tab_items
      SET status = 'DELIVERED', updated_at = NOW()
      WHERE tab_id = ${tabId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND status NOT IN ('PENDING', 'CANCELLED')
    `
  );
  batchRows.forEach((batch) => {
    queries.push(
      sql`
        UPDATE orders
        SET status = 'Entregue',
            payment_method = ${paymentMethod},
            latest_status_note = ${`Pagamento confirmado no salao · ${tab.publicId}`},
            updated_at = NOW()
        WHERE id = ${batch.order_id}
          AND tenant_id = ${tenant.tenantId}
          AND restaurant_id = ${tenant.restaurantId}
          AND status NOT IN ('Entregue', 'Retirada concluida', 'Cancelado')
      `,
      sql`
        INSERT INTO order_status_events (
          id, order_id, tenant_id, restaurant_id, restaurant_key, action,
          status, note, source, admin_login, admin_display_name,
          metadata_json, created_at
        )
        VALUES (
          ${createId("order_event")}, ${batch.order_id}, ${tenant.tenantId},
          ${tenant.restaurantId}, ${tenant.restaurantKey}, 'order_finalized',
          'Entregue', ${`Pagamento confirmado no salao · ${tab.publicId}`},
          'admin', ${actor.login}, ${actor.displayName},
          ${JSON.stringify({
            channel: "dining",
            diningTabId: tabId,
            paymentSetId,
          })}::jsonb,
          NOW()
        )
      `
    );
  });
  queries.push(
    sql`
      INSERT INTO cash_register_audit_events (
        id, tenant_id, restaurant_id, restaurant_key, cash_register_id,
        tab_id, table_id, event_type, actor_identity_id, actor_login,
        actor_display_name, before_json, after_json, metadata_json, created_at
      )
      VALUES (
        ${audit.id}, ${tenant.tenantId}, ${tenant.restaurantId},
        ${tenant.restaurantKey}, ${register.id}, ${tabId}, ${tab.tableId},
        ${audit.eventType}, ${actor.identityId}, ${actor.login},
        ${actor.displayName}, ${JSON.stringify(audit.before)}::jsonb,
        ${JSON.stringify(audit.after)}::jsonb,
        ${JSON.stringify(audit.metadata)}::jsonb, NOW()
      )
    `,
    sql`
      INSERT INTO cash_register_audit_events (
        id, tenant_id, restaurant_id, restaurant_key, cash_register_id,
        tab_id, table_id, event_type, actor_identity_id, actor_login,
        actor_display_name, before_json, after_json, metadata_json, created_at
      )
      VALUES (
        ${tableAudit.id}, ${tenant.tenantId}, ${tenant.restaurantId},
        ${tenant.restaurantKey}, ${register.id}, ${tabId}, ${tab.tableId},
        ${tableAudit.eventType}, ${actor.identityId}, ${actor.login},
        ${actor.displayName}, ${JSON.stringify(tableAudit.before)}::jsonb,
        ${JSON.stringify(tableAudit.after)}::jsonb, '{}'::jsonb, NOW()
      )
    `
  );
  try {
    await sql.transaction(queries);
  } catch (error) {
    const processed = await findExistingNeonPayment(tenant, {
      idempotencyKey,
      tabId,
    });
    if (processed) {
      return {
        storageMode: "neon",
        paymentSet: {
          id: processed.id,
          tabId: processed.tab_id,
          idempotencyKey: processed.idempotency_key,
          totalAmount: Number(processed.total_amount || 0),
          confirmedAt: processed.confirmed_at,
        },
        alreadyProcessed: true,
        message: "Pagamento ja confirmado anteriormente.",
      };
    }
    if (
      String(error?.message || "").toLowerCase().includes("foreign key") ||
      String(error?.message || "").toLowerCase().includes("violates")
    ) {
      throw buildHttpError(
        409,
        "A comanda ou o caixa mudou de estado. Atualize a tela antes de tentar novamente.",
        "cash_register_payment_state_conflict"
      );
    }
    throw error;
  }
  return {
    storageMode: "neon",
    paymentSet: {
      id: paymentSetId,
      tabId,
      idempotencyKey,
      totalAmount: recalculated.totalAmount,
      confirmedAt: nowIso(),
    },
    payments,
    tab: audit.after,
    message: "Pagamento confirmado e mesa liberada.",
  };
};

const confirmDiningPayment = async (
  payload = {},
  actorInput = {},
  options = {}
) => {
  const tenant = getOperationalTenant(options, "cash-register:confirm-payment");
  const actor = normalizeActor(actorInput);
  assertActor(actor);
  assertStorageAvailable();
  return getStorageMode() === "neon"
    ? confirmDiningPaymentNeon(payload, actor, tenant)
    : confirmDiningPaymentLocal(payload, actor, tenant);
};

module.exports = {
  PAYMENT_METHODS,
  addDiningTabItem,
  beginDiningTabClosing,
  closeCashRegister,
  configureDiningTables,
  confirmDiningPayment,
  getCashRegisterSnapshot,
  getStorageMode,
  openCashRegister,
  openDiningTab,
  removeDiningTabItem,
  reopenDiningTab,
  sendDiningOrder,
  updateDiningTabItem,
};
