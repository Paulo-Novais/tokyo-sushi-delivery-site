const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { neon } = require("@neondatabase/serverless");
const { buildHttpError } = require("./http.cjs");
const { ORDER_STATUSES } = require("./order-payload.cjs");

const LOCAL_STORAGE_FILE = path.join(process.cwd(), ".data", "orders.json");
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;
const FINAL_ORDER_STATUSES = new Set(["Finalizado", "Cancelado"]);
const DEFAULT_INITIAL_STATUS_NOTE = "Pedido criado pelo site.";
const DEFAULT_ADMIN_STATUS_NOTE = "Status atualizado manualmente no gestor.";
const ORDER_STATUS_INDEX = ORDER_STATUSES.reduce((summary, status, index) => {
  summary[status] = index;
  return summary;
}, {});

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
    await sql`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        customer_key TEXT UNIQUE NOT NULL,
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
        public_id TEXT UNIQUE NOT NULL,
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
        status TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'system',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS orders_status_created_at_idx
      ON orders (status, created_at DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS orders_customer_key_created_at_idx
      ON orders (customer_key, created_at DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS orders_request_signature_idx
      ON orders (request_signature)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS order_items_order_id_idx
      ON order_items (order_id, sort_order)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS order_status_events_order_id_created_at_idx
      ON order_status_events (order_id, created_at DESC)
    `;
  })();

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
  await fs.writeFile(LOCAL_STORAGE_FILE, JSON.stringify(store, null, 2));
};

const buildPublicOrderId = () => {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `TKY-${yyyy}${mm}${dd}-${suffix}`;
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
  status: entry?.status || fallbackStatus,
  note: entry?.note || "",
  source: entry?.source || "system",
  createdAt: toIsoString(entry?.createdAt || fallbackCreatedAt) || toIsoString(fallbackCreatedAt),
});

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

const formatOrderSummary = (record) => ({
  id: record.id,
  publicId: record.publicId,
  status: record.status,
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
  items: Array.isArray(record.items) ? record.items.map(normalizeItemRecord) : [],
  statusHistory: getStatusHistory(record),
});

const formatCustomerTrackingOrder = (record) => {
  const order =
    record && typeof record === "object" && Object.prototype.hasOwnProperty.call(record, "totalAmount")
      ? record
      : formatOrderDetails(record);

  return {
    id: order.id,
    publicId: order.publicId,
    status: order.status,
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

const isFinalStatus = (status) => FINAL_ORDER_STATUSES.has(String(status || ""));

const getTimingPriority = (record) => (record.timingMode === "scheduled" ? 1 : 0);

const getScheduledTimestamp = (record) => {
  const timestamp = new Date(record.scheduledFor || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
};

const sortOrdersForAdmin = (orders) =>
  orders.slice().sort((left, right) => {
    const leftClosed = isFinalStatus(left.status);
    const rightClosed = isFinalStatus(right.status);

    if (leftClosed !== rightClosed) {
      return leftClosed ? 1 : -1;
    }

    const statusDiff =
      Number(ORDER_STATUS_INDEX[left.status] ?? ORDER_STATUSES.length) -
      Number(ORDER_STATUS_INDEX[right.status] ?? ORDER_STATUSES.length);

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
  const normalizedValue = String(value || "").trim().toLowerCase();
  return ORDER_STATUSES.find((status) => status.toLowerCase() === normalizedValue) || "";
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

const getStatusUpdateNote = (status, note) => {
  const normalizedNote = String(note || "").replace(/\s+/g, " ").trim().slice(0, 240);
  return normalizedNote || `${DEFAULT_ADMIN_STATUS_NOTE} Novo status: ${status}.`;
};

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
    orders.filter((order) => order.customerKey === customerKey && !isFinalStatus(order.status))
  )[0] || null;

const buildDashboardStats = (orders) => {
  const totalOrders = orders.length;
  const newOrders = orders.filter((order) => order.status === "Novo").length;
  const activeOrders = orders.filter((order) => !isFinalStatus(order.status)).length;
  const scheduledOrders = orders.filter(
    (order) => order.timingMode === "scheduled" && !isFinalStatus(order.status)
  ).length;

  const byStatus = ORDER_STATUSES.reduce((summary, status) => {
    summary[status] = orders.filter((order) => order.status === status).length;
    return summary;
  }, {});

  return {
    totalOrders,
    newOrders,
    activeOrders,
    scheduledOrders,
    byStatus,
  };
};

const upsertCustomerInFileStore = (store, customer) => {
  const existingCustomerIndex = store.customers.findIndex(
    (entry) => entry.customerKey === customer.key
  );
  const now = new Date().toISOString();
  const customerRecord =
    existingCustomerIndex >= 0
      ? {
          ...store.customers[existingCustomerIndex],
          profileId: customer.profileId || "",
          name: customer.name,
          phone: customer.phone,
          email: customer.email || "",
          updatedAt: now,
        }
      : {
          id: crypto.randomUUID(),
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

const findDuplicateOrder = (orders, customerKey, requestSignature) =>
  orders.find((order) => {
    if (order.customerKey !== customerKey || order.requestSignature !== requestSignature) {
      return false;
    }

    return Date.now() - new Date(order.createdAt).getTime() < DUPLICATE_WINDOW_MS;
  });

const createOrderRecord = (normalizedOrder, customerRecord) => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    publicId: buildPublicOrderId(),
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
    statusHistory: [
      {
        id: crypto.randomUUID(),
        status: normalizedOrder.order.status,
        note: DEFAULT_INITIAL_STATUS_NOTE,
        source: "system",
        createdAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
};

const createOrderInFileStore = async (normalizedOrder) => {
  const store = await readFileStore();
  const duplicateOrder = findDuplicateOrder(
    store.orders,
    normalizedOrder.customer.key,
    normalizedOrder.requestSignature
  );

  if (duplicateOrder) {
    return {
      created: false,
      storageMode: "file",
      order: formatOrderSummary(duplicateOrder),
    };
  }

  const customerRecord = upsertCustomerInFileStore(store, normalizedOrder.customer);
  const orderRecord = createOrderRecord(normalizedOrder, customerRecord);
  store.orders.unshift(orderRecord);
  await writeFileStore(store);

  return {
    created: true,
    storageMode: "file",
    order: formatOrderSummary(orderRecord),
  };
};

const createOrderInNeon = async (normalizedOrder) => {
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
    WHERE customer_key = ${normalizedOrder.customer.key}
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
    INSERT INTO customers (id, customer_key, profile_id, name, phone, email, created_at, updated_at)
    VALUES (
      ${customerId},
      ${normalizedOrder.customer.key},
      ${normalizedOrder.customer.profileId || ""},
      ${normalizedOrder.customer.name},
      ${normalizedOrder.customer.phone},
      ${normalizedOrder.customer.email || ""},
      NOW(),
      NOW()
    )
    ON CONFLICT (customer_key) DO UPDATE
      SET
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
        status,
        note,
        source,
        created_at
      )
      VALUES (
        ${crypto.randomUUID()},
        ${orderId},
        ${normalizedOrder.order.status},
        ${DEFAULT_INITIAL_STATUS_NOTE},
        ${"system"},
        NOW()
      )
    `,
  ];

  normalizedOrder.items.forEach((item, index) => {
    insertQueries.push(sql`
      INSERT INTO order_items (
        id,
        order_id,
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

const createOrder = async (normalizedOrder) => {
  assertStorageIsAvailable();
  return getStorageMode() === "neon"
    ? createOrderInNeon(normalizedOrder)
    : createOrderInFileStore(normalizedOrder);
};

const getDashboardFromFileStore = async (limit = 40) => {
  const store = await readFileStore();
  const orders = sortOrdersForAdmin(store.orders);
  const orderSummaries = orders.slice(0, limit).map((order) => formatOrderSummary(order));

  return {
    storageMode: "file",
    generatedAt: new Date().toISOString(),
    stats: buildDashboardStats(store.orders),
    orders: orderSummaries,
    recentOrders: orderSummaries,
  };
};

const getDashboardFromNeon = async (limit = 40) => {
  await ensureNeonSchema();
  const sql = getSql();
  const countRows = await sql`
    SELECT status, COUNT(*)::int AS total
    FROM orders
    GROUP BY status
  `;
  const recentRows = await sql`
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
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  const byStatus = ORDER_STATUSES.reduce((summary, status) => {
    summary[status] =
      countRows.find((entry) => entry.status === status)?.total || 0;
    return summary;
  }, {});
  const totalOrders = Object.values(byStatus).reduce((sum, value) => sum + Number(value || 0), 0);
  const newOrders = Number(byStatus.Novo || 0);
  const activeOrders = totalOrders - Number(byStatus.Finalizado || 0) - Number(byStatus.Cancelado || 0);
  const scheduledRows = await sql`
    SELECT COUNT(*)::int AS total
    FROM orders
    WHERE timing_mode = 'scheduled'
      AND status NOT IN ('Finalizado', 'Cancelado')
  `;

  const orderSummaries = sortOrdersForAdmin(
    recentRows.map((row) => ({
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
    }))
  ).map((record) => formatOrderSummary(record));

  return {
    storageMode: "neon",
    generatedAt: new Date().toISOString(),
    stats: {
      totalOrders,
      newOrders,
      activeOrders,
      scheduledOrders: Number(scheduledRows[0]?.total || 0),
      byStatus,
    },
    orders: orderSummaries,
    recentOrders: orderSummaries,
  };
};

const getCustomerActiveOrderFromFileStore = async (customerKey) => {
  const store = await readFileStore();
  const activeOrder = pickActiveOrder(store.orders, customerKey);

  return {
    storageMode: "file",
    hasActiveOrder: Boolean(activeOrder),
    order: activeOrder ? formatCustomerTrackingOrder(activeOrder) : null,
  };
};

const getCustomerActiveOrderFromNeon = async (customerKey) => {
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
    WHERE customer_key = ${String(customerKey || "").trim()}
      AND status NOT IN ('Finalizado', 'Cancelado')
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

  const details = await getOrderDetailsFromNeon(activeOrder.id);
  return {
    storageMode: "neon",
    hasActiveOrder: true,
    order: formatCustomerTrackingOrder(details.order),
  };
};

const getOrderDetailsFromFileStore = async (identifier) => {
  const store = await readFileStore();
  const orderRecord = findOrderRecord(store.orders, identifier);

  if (!orderRecord) {
    throw buildHttpError(404, "Nao encontrei o pedido solicitado.", "order_not_found");
  }

  return {
    storageMode: "file",
    order: formatOrderDetails(orderRecord),
  };
};

const getOrderDetailsFromNeon = async (identifier) => {
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
      latest_status_note,
      created_at,
      updated_at
    FROM orders
    WHERE id = ${String(identifier || "").trim()}
       OR public_id = ${String(identifier || "").trim()}
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
    WHERE order_id = ${orderRow.id}
    ORDER BY sort_order ASC, created_at ASC
  `;
  const statusEventRows = await sql`
    SELECT
      id,
      status,
      note,
      source,
      created_at
    FROM order_status_events
    WHERE order_id = ${orderRow.id}
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
      statusHistory: statusEventRows.map((event) => ({
        id: event.id,
        status: event.status,
        note: event.note || "",
        source: event.source || "system",
        createdAt: toIsoString(event.created_at),
      })),
    }),
  };
};

const updateOrderStatusInFileStore = async (identifier, nextStatus, note = "") => {
  const store = await readFileStore();
  const orderIndex = store.orders.findIndex((order) => {
    const normalizedIdentifier = String(identifier || "").trim();
    return order.id === normalizedIdentifier || order.publicId === normalizedIdentifier;
  });

  if (orderIndex === -1) {
    throw buildHttpError(404, "Nao encontrei o pedido solicitado.", "order_not_found");
  }

  const currentOrder = store.orders[orderIndex];

  if (currentOrder.status === nextStatus) {
    return {
      storageMode: "file",
      changed: false,
      order: formatOrderDetails(currentOrder),
    };
  }

  const now = new Date().toISOString();
  const statusHistory = Array.isArray(currentOrder.statusHistory)
    ? currentOrder.statusHistory.slice()
    : buildFallbackStatusHistory(currentOrder);

  statusHistory.push({
    id: crypto.randomUUID(),
    status: nextStatus,
    note: getStatusUpdateNote(nextStatus, note),
    source: "admin",
    createdAt: now,
  });

  store.orders[orderIndex] = {
    ...currentOrder,
    status: nextStatus,
    latestStatusNote: getStatusUpdateNote(nextStatus, note),
    statusHistory,
    updatedAt: now,
  };

  await writeFileStore(store);

  return {
    storageMode: "file",
    changed: true,
    order: formatOrderDetails(store.orders[orderIndex]),
  };
};

const updateOrderStatusInNeon = async (identifier, nextStatus, note = "") => {
  await ensureNeonSchema();
  const sql = getSql();
  const orderRows = await sql`
    SELECT id, status
    FROM orders
    WHERE id = ${String(identifier || "").trim()}
       OR public_id = ${String(identifier || "").trim()}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (orderRows.length === 0) {
    throw buildHttpError(404, "Nao encontrei o pedido solicitado.", "order_not_found");
  }

  const currentOrder = orderRows[0];

  if (currentOrder.status === nextStatus) {
    const details = await getOrderDetailsFromNeon(currentOrder.id);
    return {
      storageMode: "neon",
      changed: false,
      order: details.order,
    };
  }

  const statusNote = getStatusUpdateNote(nextStatus, note);
  await sql.transaction([
    sql`
      UPDATE orders
      SET
        status = ${nextStatus},
        latest_status_note = ${statusNote},
        updated_at = NOW()
      WHERE id = ${currentOrder.id}
    `,
    sql`
      INSERT INTO order_status_events (
        id,
        order_id,
        status,
        note,
        source,
        created_at
      )
      VALUES (
        ${crypto.randomUUID()},
        ${currentOrder.id},
        ${nextStatus},
        ${statusNote},
        ${"admin"},
        NOW()
      )
    `,
  ]);

  const details = await getOrderDetailsFromNeon(currentOrder.id);
  return {
    storageMode: "neon",
    changed: true,
    order: details.order,
  };
};

const getAdminDashboard = async (limit = 40) => {
  assertStorageIsAvailable();
  return getStorageMode() === "neon"
    ? getDashboardFromNeon(limit)
    : getDashboardFromFileStore(limit);
};

const getAdminOrderList = async (limit = 40) => getAdminDashboard(limit);

const getAdminOrderDetails = async (identifier) => {
  assertStorageIsAvailable();
  return getStorageMode() === "neon"
    ? getOrderDetailsFromNeon(identifier)
    : getOrderDetailsFromFileStore(identifier);
};

const updateAdminOrderStatus = async (identifier, status, note = "") => {
  assertStorageIsAvailable();
  const nextStatus = assertValidOrderStatus(status);
  return getStorageMode() === "neon"
    ? updateOrderStatusInNeon(identifier, nextStatus, note)
    : updateOrderStatusInFileStore(identifier, nextStatus, note);
};

const getCustomerActiveOrder = async (customerKey) => {
  assertStorageIsAvailable();
  return getStorageMode() === "neon"
    ? getCustomerActiveOrderFromNeon(customerKey)
    : getCustomerActiveOrderFromFileStore(customerKey);
};

module.exports = {
  createOrder,
  getAdminDashboard,
  getAdminOrderDetails,
  getAdminOrderList,
  getCustomerActiveOrder,
  getStorageMode,
  updateAdminOrderStatus,
};
