const fs = require("node:fs/promises");
const path = require("node:path");
const { neon } = require("./tenant-sql.cjs");
const {
  assertMigrationManagedRelations,
} = require("./database-schema.cjs");
const { buildHttpError } = require("./http.cjs");
const { getOperationalTenant, matchesTenantScope } = require("./tenant-context.cjs");

const LOCAL_ORDERS_FILE = path.join(process.cwd(), ".data", "orders.json");
const LOCAL_CRM_FILE = path.join(process.cwd(), ".data", "customer-crm.json");
const FINAL_ORDER_STATUSES = new Set(["entregue", "retirada concluida", "cancelado", "finalizado"]);
const CANCELLED_ORDER_STATUSES = new Set(["cancelado"]);
const DEFAULT_INACTIVE_DAYS = 30;
const TAG_OPTIONS = Object.freeze([
  { key: "vip", label: "VIP" },
  { key: "recorrente", label: "Recorrente" },
  { key: "atencao", label: "Atencao" },
  { key: "bloqueado", label: "Bloqueado" },
]);
const TAG_KEYS = new Set(TAG_OPTIONS.map((tag) => tag.key));

let sqlClient = null;
let crmSchemaReadyPromise = null;

const getStorageMode = () => {
  if (String(process.env.DATABASE_URL || "").trim()) {
    return "neon";
  }

  return process.env.NODE_ENV === "production" ? "disabled" : "file";
};

const assertStorageIsAvailable = () => {
  if (getStorageMode() === "disabled") {
    throw buildHttpError(
      503,
      "DATABASE_URL ainda nao foi configurada. Em producao, o CRM precisa de banco persistente.",
      "customer_crm_storage_unavailable"
    );
  }
};

const getSql = () => {
  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }

  return sqlClient;
};

const ensureCrmNeonSchema = async () => {
  if (crmSchemaReadyPromise) {
    return crmSchemaReadyPromise;
  }

  const sql = getSql();
  crmSchemaReadyPromise = (async () => {
    if (
      await assertMigrationManagedRelations({
        sql,
        relations: ["customer_crm_profiles"],
        component: "clientes",
      })
    ) {
      return;
    }

    await sql`
      CREATE TABLE IF NOT EXISTS customer_crm_profiles (
        customer_key TEXT NOT NULL,
        tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
        restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default',
        restaurant_key TEXT NOT NULL DEFAULT 'default',
        notes TEXT NOT NULL DEFAULT '',
        tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_by_login TEXT NOT NULL DEFAULT '',
        updated_by_display_name TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      ALTER TABLE customer_crm_profiles
      ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default'
    `;

    await sql`
      ALTER TABLE customer_crm_profiles
      ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default'
    `;

    await sql`
      ALTER TABLE customer_crm_profiles
      ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default'
    `;

    await sql`
      ALTER TABLE customer_crm_profiles
      DROP CONSTRAINT IF EXISTS customer_crm_profiles_pkey
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS customer_crm_profiles_restaurant_key_idx
      ON customer_crm_profiles (restaurant_key, customer_key)
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS customer_crm_profiles_tenant_restaurant_customer_uidx
      ON customer_crm_profiles (tenant_id, restaurant_id, customer_key)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS customer_crm_profiles_tenant_restaurant_idx
      ON customer_crm_profiles (tenant_id, restaurant_id)
    `;
  })().catch((error) => {
    crmSchemaReadyPromise = null;
    throw error;
  });

  return crmSchemaReadyPromise;
};

const readJsonFile = async (filePath, fallbackValue) => {
  try {
    const contents = await fs.readFile(filePath, "utf8");
    return JSON.parse(contents);
  } catch (error) {
    return fallbackValue;
  }
};

const writeJsonFile = async (filePath, payload) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
};

const readLocalOrders = async () => {
  const store = await readJsonFile(LOCAL_ORDERS_FILE, { orders: [] });
  return Array.isArray(store?.orders) ? store.orders : [];
};

const readLocalCrmStore = async () => {
  const store = await readJsonFile(LOCAL_CRM_FILE, { version: 1, profiles: [] });
  return {
    version: 1,
    profiles: Array.isArray(store?.profiles) ? store.profiles : [],
  };
};

const writeLocalCrmStore = async (store) => {
  await writeJsonFile(LOCAL_CRM_FILE, {
    version: 1,
    profiles: Array.isArray(store?.profiles) ? store.profiles : [],
  });
};

const toIsoString = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const normalizeText = (value, maxLength = 500) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const normalizeMultilineText = (value, maxLength = 1200) =>
  String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .trim()
    .slice(0, maxLength);

const normalizePhoneDigits = (value) => String(value || "").replace(/\D/g, "");

const normalizeSearchValue = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalizeStatusKey = (value) => normalizeSearchValue(value).replace(/\s+/g, " ");

const isCancelledOrder = (order) => CANCELLED_ORDER_STATUSES.has(normalizeStatusKey(order?.status));

const isFinalOrder = (order) => FINAL_ORDER_STATUSES.has(normalizeStatusKey(order?.status));

const buildFallbackCustomerKey = (order) => {
  const phone = normalizePhoneDigits(order?.customerPhone || order?.customer_phone).slice(-11);
  const email = String(order?.customerEmail || order?.customer_email || "").trim().toLowerCase();
  const name = normalizeSearchValue(order?.customerName || order?.customer_name);

  if (phone) {
    return `phone:${phone}`;
  }

  if (email) {
    return `email:${email}`;
  }

  return name ? `name:${name}` : "";
};

const getCustomerKey = (order) =>
  String(order?.customerKey || order?.customer_key || buildFallbackCustomerKey(order)).trim();

const normalizeOrderItem = (item = {}) => ({
  id: String(item.id || "").trim(),
  sortOrder: Number(item.sortOrder || item.sort_order || 0),
  type: String(item.type || item.itemType || item.item_type || "product").trim().toLowerCase(),
  name: normalizeText(item.name, 160),
  category: normalizeText(item.category, 120),
  quantity: Number(item.quantity || 0),
  unitPrice: Number(item.unitPrice || item.unit_price || 0),
  totalPrice: Number(item.totalPrice || item.total_price || 0),
});

const normalizeOrderRecord = (record = {}) => ({
  id: String(record.id || "").trim(),
  publicId: String(record.publicId || record.public_id || "").trim(),
  customerKey: getCustomerKey(record),
  customerName: normalizeText(record.customerName || record.customer_name, 160),
  customerPhone: normalizeText(record.customerPhone || record.customer_phone, 40),
  customerEmail: normalizeText(record.customerEmail || record.customer_email, 160).toLowerCase(),
  status: normalizeText(record.status, 80),
  orderType: normalizeText(record.orderType || record.order_type, 60),
  fulfillmentMode: normalizeText(record.fulfillmentMode || record.fulfillment_mode, 60).toLowerCase(),
  timingMode: normalizeText(record.timingMode || record.timing_mode, 60).toLowerCase(),
  scheduledFor: toIsoString(record.scheduledFor || record.scheduled_for) || null,
  scheduledLabel: normalizeText(record.scheduledLabel || record.scheduled_label, 120),
  paymentMethod: normalizeText(record.paymentMethod || record.payment_method, 80),
  itemCount: Number(record.itemCount || record.item_count || 0),
  subtotal: Number(record.subtotal || 0),
  deliveryFee: Number(record.deliveryFee || record.delivery_fee || 0),
  totalAmount: Number(record.totalAmount || record.total || 0),
  customerNotes: normalizeText(record.customerNotes || record.customer_notes, 600),
  addressFull: normalizeText(record.addressFull || record.address_full, 260),
  addressLine: normalizeText(record.addressLine || record.address_line, 160),
  addressNumber: normalizeText(record.addressNumber || record.address_number, 40),
  addressComplement: normalizeText(record.addressComplement || record.address_complement, 120),
  addressNeighborhood: normalizeText(record.addressNeighborhood || record.address_neighborhood, 120),
  addressCity: normalizeText(record.addressCity || record.address_city, 120),
  addressState: normalizeText(record.addressState || record.address_state, 40),
  latestStatusNote: normalizeText(record.latestStatusNote || record.latest_status_note, 260),
  createdAt: toIsoString(record.createdAt || record.created_at),
  updatedAt: toIsoString(record.updatedAt || record.updated_at || record.createdAt || record.created_at),
  items: Array.isArray(record.items)
    ? record.items.map(normalizeOrderItem).filter((item) => item.name)
    : Array.isArray(record.items_json)
      ? record.items_json.map(normalizeOrderItem).filter((item) => item.name)
      : [],
});

const buildAddressLabel = (order) => {
  if (order.addressFull) {
    return order.addressFull;
  }

  const firstLine = [order.addressLine, order.addressNumber].filter(Boolean).join(", ");
  const secondLine = [order.addressNeighborhood, order.addressCity, order.addressState]
    .filter(Boolean)
    .join(" - ");

  return [firstLine, secondLine].filter(Boolean).join(" | ");
};

const incrementCounter = (map, key, payload = {}) => {
  const normalizedKey = normalizeSearchValue(key);

  if (!normalizedKey) {
    return;
  }

  const current = map.get(normalizedKey) || {
    key: normalizedKey,
    label: normalizeText(key, 220),
    count: 0,
    quantity: 0,
    total: 0,
    lastAt: "",
    category: payload.category || "",
  };

  current.count += Number(payload.count || 1);
  current.quantity += Number(payload.quantity || 0);
  current.total += Number(payload.total || 0);

  if (payload.lastAt && (!current.lastAt || new Date(payload.lastAt) > new Date(current.lastAt))) {
    current.lastAt = payload.lastAt;
    current.label = normalizeText(payload.label || key, 220);
  }

  map.set(normalizedKey, current);
};

const pickMostUsedAddress = (addressMap) =>
  Array.from(addressMap.values())
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return new Date(right.lastAt || 0) - new Date(left.lastAt || 0);
    })[0]?.label || "";

const sortTopItems = (itemsMap) =>
  Array.from(itemsMap.values())
    .map((item) => ({
      name: item.label,
      category: item.category || "",
      quantity: item.quantity || item.count,
      ordersCount: item.count,
      totalSpent: Number(item.total || 0),
      lastOrderedAt: item.lastAt || "",
    }))
    .sort((left, right) => {
      if (right.quantity !== left.quantity) {
        return right.quantity - left.quantity;
      }

      if (right.ordersCount !== left.ordersCount) {
        return right.ordersCount - left.ordersCount;
      }

      return new Date(right.lastOrderedAt || 0) - new Date(left.lastOrderedAt || 0);
    })
    .slice(0, 8);

const normalizeTags = (tags) =>
  (Array.isArray(tags) ? tags : [])
    .map((tag) => String(tag || "").trim().toLowerCase())
    .filter((tag, index, list) => TAG_KEYS.has(tag) && list.indexOf(tag) === index);

const normalizeProfile = (profile = {}) => ({
  tenantId: normalizeText(profile.tenantId || profile.tenant_id, 120) || "tenant_default",
  restaurantId: normalizeText(profile.restaurantId || profile.restaurant_id, 120) || "restaurant_default",
  restaurantKey: normalizeText(profile.restaurantKey || profile.restaurant_key, 120) || "default",
  customerKey: String(profile.customerKey || profile.customer_key || "").trim(),
  notes: normalizeMultilineText(profile.notes || ""),
  tags: normalizeTags(profile.tags || profile.tags_json || []),
  updatedAt: toIsoString(profile.updatedAt || profile.updated_at),
  updatedByLogin: String(profile.updatedByLogin || profile.updated_by_login || "").trim().toLowerCase(),
  updatedByDisplayName: normalizeText(profile.updatedByDisplayName || profile.updated_by_display_name, 160),
});

const buildWhatsappUrl = (phone) => {
  const digits = normalizePhoneDigits(phone);

  if (!digits) {
    return "";
  }

  const nationalDigits = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${nationalDigits}`;
};

const getDaysSince = (value, now = new Date()) => {
  const timestamp = new Date(value || 0).getTime();

  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return null;
  }

  return Math.max(0, Math.floor((now.getTime() - timestamp) / 86400000));
};

const getSuggestedAction = (customer) => {
  if (customer.tags.includes("bloqueado")) {
    return "Revisar cadastro antes de aceitar novo pedido";
  }

  if (customer.daysSinceLastPurchase !== null && customer.daysSinceLastPurchase >= DEFAULT_INACTIVE_DAYS) {
    return "Mandar mensagem no WhatsApp";
  }

  if (customer.tags.includes("atencao")) {
    return "Acompanhar proximo atendimento";
  }

  if (customer.tags.includes("vip")) {
    return "Enviar mimo ou oferta VIP";
  }

  if (customer.isRecurring) {
    return "Agradecer recorrencia no WhatsApp";
  }

  return "Mandar mensagem no WhatsApp";
};

const buildCustomerRecords = ({ orders = [], profiles = [], now = new Date() } = {}) => {
  const profilesByKey = new Map(
    profiles.map(normalizeProfile).filter((profile) => profile.customerKey).map((profile) => [profile.customerKey, profile])
  );
  const grouped = new Map();

  orders.map(normalizeOrderRecord).filter((order) => order.customerKey).forEach((order) => {
    const key = order.customerKey;
    const current = grouped.get(key) || {
      key,
      customerKey: key,
      customerName: order.customerName || "Cliente sem nome",
      customerPhone: order.customerPhone || "",
      customerEmail: order.customerEmail || "",
      ordersCount: 0,
      revenueOrderCount: 0,
      activeOrders: 0,
      cancelledOrders: 0,
      totalSpent: 0,
      totalItems: 0,
      lastOrderAt: "",
      lastPurchaseAt: "",
      lastOrderPublicId: "",
      lastStatus: "",
      addressMap: new Map(),
      itemMap: new Map(),
      orders: [],
    };

    current.ordersCount += 1;
    current.totalItems += Number(order.itemCount || 0);

    if (!isFinalOrder(order)) {
      current.activeOrders += 1;
    }

    if (isCancelledOrder(order)) {
      current.cancelledOrders += 1;
    } else {
      current.revenueOrderCount += 1;
      current.totalSpent += Number(order.totalAmount || 0);

      if (!current.lastPurchaseAt || new Date(order.createdAt) > new Date(current.lastPurchaseAt)) {
        current.lastPurchaseAt = order.createdAt;
      }
    }

    const addressLabel = buildAddressLabel(order);
    if (addressLabel) {
      incrementCounter(current.addressMap, addressLabel, {
        label: addressLabel,
        lastAt: order.createdAt,
      });
    }

    order.items.forEach((item) => {
      incrementCounter(current.itemMap, item.name, {
        label: item.name,
        category: item.category || "",
        count: 1,
        quantity: Number(item.quantity || 0),
        total: Number(item.totalPrice || 0),
        lastAt: order.createdAt,
      });
    });

    current.orders.push(order);

    if (!current.lastOrderAt || new Date(order.createdAt) > new Date(current.lastOrderAt)) {
      current.lastOrderAt = order.createdAt;
      current.lastOrderPublicId = order.publicId || "";
      current.lastStatus = order.status || "";
      current.customerName = order.customerName || current.customerName;
      current.customerPhone = order.customerPhone || current.customerPhone;
      current.customerEmail = order.customerEmail || current.customerEmail;
    }

    grouped.set(key, current);
  });

  return Array.from(grouped.values()).map((record) => {
    const profile = profilesByKey.get(record.customerKey) || normalizeProfile({ customerKey: record.customerKey });
    const sortedOrders = record.orders
      .slice()
      .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
    const lastPurchaseAt = record.lastPurchaseAt || record.lastOrderAt || "";
    const daysSinceLastPurchase = getDaysSince(lastPurchaseAt, now);
    const customer = {
      key: record.customerKey,
      customerKey: record.customerKey,
      customerName: record.customerName || "Cliente sem nome",
      customerPhone: record.customerPhone || "",
      customerEmail: record.customerEmail || "",
      phoneDigits: normalizePhoneDigits(record.customerPhone),
      whatsappUrl: buildWhatsappUrl(record.customerPhone),
      ordersCount: record.ordersCount,
      revenueOrderCount: record.revenueOrderCount,
      activeOrders: record.activeOrders,
      cancelledOrders: record.cancelledOrders,
      lastOrderAt: record.lastOrderAt,
      lastPurchaseAt,
      daysSinceLastPurchase,
      lastOrderPublicId: record.lastOrderPublicId,
      lastStatus: record.lastStatus,
      totalSpent: Number(record.totalSpent.toFixed(2)),
      averageTicket:
        record.revenueOrderCount > 0
          ? Number((record.totalSpent / record.revenueOrderCount).toFixed(2))
          : 0,
      totalItems: record.totalItems,
      mostUsedAddress: pickMostUsedAddress(record.addressMap),
      topItems: sortTopItems(record.itemMap),
      orders: sortedOrders,
      notes: profile.notes || "",
      tags: profile.tags || [],
      updatedAt: profile.updatedAt || "",
      updatedByLogin: profile.updatedByLogin || "",
      updatedByDisplayName: profile.updatedByDisplayName || "",
      isRecurring: record.ordersCount >= 2,
      isLapsed: daysSinceLastPurchase !== null && daysSinceLastPurchase >= DEFAULT_INACTIVE_DAYS,
    };

    customer.suggestedAction = getSuggestedAction(customer);
    return customer;
  });
};

const normalizeFilters = (filters = {}) => ({
  query: String(filters.query || "").trim(),
  tag: String(filters.tag || "").trim().toLowerCase(),
  inactiveDays: Number.parseInt(String(filters.inactiveDays || ""), 10),
  sortBy: String(filters.sortBy || "recent").trim().toLowerCase(),
});

const customerMatchesTag = (customer, tag) => {
  if (!tag) {
    return true;
  }

  if (tag === "recorrente") {
    return customer.isRecurring || customer.tags.includes(tag);
  }

  return customer.tags.includes(tag);
};

const filterCustomers = (customers, rawFilters = {}) => {
  const filters = normalizeFilters(rawFilters);
  const query = normalizeSearchValue(filters.query);
  const inactiveDays = Number.isFinite(filters.inactiveDays) ? filters.inactiveDays : 0;

  return customers.filter((customer) => {
    if (query) {
      const searchableValue = normalizeSearchValue(
        [
          customer.customerName,
          customer.customerPhone,
          customer.customerEmail,
          customer.mostUsedAddress,
          customer.lastOrderPublicId,
          customer.tags.join(" "),
        ].join(" ")
      );

      if (!searchableValue.includes(query)) {
        return false;
      }
    }

    if (!customerMatchesTag(customer, filters.tag)) {
      return false;
    }

    if (inactiveDays > 0) {
      return customer.daysSinceLastPurchase !== null && customer.daysSinceLastPurchase >= inactiveDays;
    }

    return true;
  });
};

const sortCustomers = (customers, rawSortBy = "recent") => {
  const sortBy = String(rawSortBy || "recent").trim().toLowerCase();

  return customers.slice().sort((left, right) => {
    if (sortBy === "spend-desc") {
      if (right.totalSpent !== left.totalSpent) {
        return right.totalSpent - left.totalSpent;
      }
    }

    if (sortBy === "orders-desc") {
      if (right.ordersCount !== left.ordersCount) {
        return right.ordersCount - left.ordersCount;
      }
    }

    if (sortBy === "lapsed-desc") {
      return Number(right.daysSinceLastPurchase || 0) - Number(left.daysSinceLastPurchase || 0);
    }

    return new Date(right.lastPurchaseAt || right.lastOrderAt || 0) - new Date(left.lastPurchaseAt || left.lastOrderAt || 0);
  });
};

const buildSummary = (customers) => {
  const totalSpent = customers.reduce((sum, customer) => sum + Number(customer.totalSpent || 0), 0);
  const revenueOrders = customers.reduce((sum, customer) => sum + Number(customer.revenueOrderCount || 0), 0);

  return {
    totalCustomers: customers.length,
    recurringCustomers: customers.filter((customer) => customer.isRecurring).length,
    vipCustomers: customers.filter((customer) => customer.tags.includes("vip")).length,
    attentionCustomers: customers.filter((customer) => customer.tags.includes("atencao")).length,
    blockedCustomers: customers.filter((customer) => customer.tags.includes("bloqueado")).length,
    lapsedCustomers: customers.filter((customer) => customer.isLapsed).length,
    totalOrders: customers.reduce((sum, customer) => sum + Number(customer.ordersCount || 0), 0),
    totalSpent: Number(totalSpent.toFixed(2)),
    averageTicket: revenueOrders > 0 ? Number((totalSpent / revenueOrders).toFixed(2)) : 0,
    topSpender: customers.slice().sort((left, right) => right.totalSpent - left.totalSpent)[0] || null,
    inactiveDays: DEFAULT_INACTIVE_DAYS,
  };
};

const getAdminCustomersFromFileStore = async (filters = {}, tenant) => {
  const [orders, crmStore] = await Promise.all([readLocalOrders(), readLocalCrmStore()]);
  const tenantOrders = orders.filter((order) => matchesTenantScope(order, tenant));
  const tenantProfiles = crmStore.profiles.filter((profile) =>
    matchesTenantScope(profile, tenant)
  );
  const allCustomers = buildCustomerRecords({
    orders: tenantOrders,
    profiles: tenantProfiles,
  });
  const normalizedFilters = normalizeFilters(filters);
  const customers = sortCustomers(filterCustomers(allCustomers, normalizedFilters), normalizedFilters.sortBy);

  return {
    storageMode: "file",
    generatedAt: new Date().toISOString(),
    filters: normalizedFilters,
    tagOptions: TAG_OPTIONS,
    summary: buildSummary(allCustomers),
    customers,
  };
};

const getAdminCustomersFromNeon = async (filters = {}, tenant) => {
  await ensureCrmNeonSchema();
  const sql = getSql();
  const orderRows = await sql`
    SELECT
      id,
      public_id,
      customer_key,
      customer_name,
      customer_phone,
      customer_email,
      status,
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
      customer_notes,
      address_line,
      address_number,
      address_complement,
      address_neighborhood,
      address_city,
      address_state,
      address_full,
      latest_status_note,
      created_at,
      updated_at,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', order_items.id,
          'sortOrder', order_items.sort_order,
          'type', order_items.item_type,
          'sourceItemId', order_items.source_item_id,
          'name', order_items.name,
          'category', order_items.category,
          'quantity', order_items.quantity,
          'unitPrice', order_items.unit_price,
          'totalPrice', order_items.total_price
        ) ORDER BY order_items.sort_order ASC)
        FROM order_items
        WHERE order_items.tenant_id = ${tenant.tenantId}
          AND order_items.restaurant_id = ${tenant.restaurantId}
          AND order_items.restaurant_key = ${tenant.restaurantKey}
          AND order_items.order_id = orders.id
      ), '[]'::json) AS items_json
    FROM orders
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
    ORDER BY created_at DESC
  `;
  const profileRows = await sql`
    SELECT
      tenant_id,
      restaurant_id,
      restaurant_key,
      customer_key,
      notes,
      tags_json,
      updated_by_login,
      updated_by_display_name,
      updated_at
    FROM customer_crm_profiles
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
  `;
  const allCustomers = buildCustomerRecords({
    orders: orderRows,
    profiles: profileRows,
  });
  const normalizedFilters = normalizeFilters(filters);
  const customers = sortCustomers(filterCustomers(allCustomers, normalizedFilters), normalizedFilters.sortBy);

  return {
    storageMode: "neon",
    generatedAt: new Date().toISOString(),
    filters: normalizedFilters,
    tagOptions: TAG_OPTIONS,
    summary: buildSummary(allCustomers),
    customers,
  };
};

const getAdminCustomers = async (filters = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "customers:admin:list");
  assertStorageIsAvailable();
  return getStorageMode() === "neon"
    ? getAdminCustomersFromNeon(filters, tenant)
    : getAdminCustomersFromFileStore(filters, tenant);
};

const normalizeProfilePayload = (payload = {}) => {
  const customerKey = String(payload.customerKey || payload.key || "").trim();

  if (!customerKey) {
    throw buildHttpError(400, "Informe o cliente que deseja atualizar.", "missing_customer_key");
  }

  return {
    customerKey,
    notes: normalizeMultilineText(payload.notes || ""),
    tags: normalizeTags(payload.tags || []),
  };
};

const saveCustomerProfileInFileStore = async (payload, actor = {}, tenant) => {
  const profilePayload = normalizeProfilePayload(payload);
  const [orders, store] = await Promise.all([readLocalOrders(), readLocalCrmStore()]);
  const customerExists = orders.some(
    (order) =>
      getCustomerKey(order) === profilePayload.customerKey &&
      matchesTenantScope(order, tenant)
  );

  if (!customerExists) {
    throw buildHttpError(404, "Nao encontrei este cliente nos pedidos.", "customer_not_found");
  }

  const now = new Date().toISOString();
  const actorLogin = String(actor?.login || "").trim().toLowerCase();
  const actorDisplayName = normalizeText(actor?.displayName || actorLogin, 160);
  const profiles = store.profiles.slice();
  const existingIndex = profiles.findIndex(
    (profile) =>
      String(profile.customerKey || profile.customer_key || "").trim() === profilePayload.customerKey &&
      matchesTenantScope(profile, tenant)
  );
  const nextProfile = {
    ...(existingIndex >= 0 ? profiles[existingIndex] : {}),
    tenantId: tenant.tenantId,
    restaurantId: tenant.restaurantId,
    restaurantKey: tenant.restaurantKey,
    customerKey: profilePayload.customerKey,
    notes: profilePayload.notes,
    tags: profilePayload.tags,
    updatedAt: now,
    updatedByLogin: actorLogin,
    updatedByDisplayName: actorDisplayName,
  };

  if (existingIndex >= 0) {
    profiles[existingIndex] = nextProfile;
  } else {
    profiles.push(nextProfile);
  }

  await writeLocalCrmStore({ version: 1, profiles });

  const snapshot = await getAdminCustomersFromFileStore({}, tenant);
  return {
    ...snapshot,
    message: "Perfil do cliente salvo com sucesso.",
    customer: snapshot.customers.find((customer) => customer.customerKey === profilePayload.customerKey) || null,
  };
};

const saveCustomerProfileInNeon = async (payload, actor = {}, tenant) => {
  await ensureCrmNeonSchema();
  const sql = getSql();
  const profilePayload = normalizeProfilePayload(payload);
  const customerRows = await sql`
    SELECT customer_key
    FROM orders
    WHERE customer_key = ${profilePayload.customerKey}
      AND tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
    LIMIT 1
  `;

  if (customerRows.length === 0) {
    throw buildHttpError(404, "Nao encontrei este cliente nos pedidos.", "customer_not_found");
  }

  const actorLogin = String(actor?.login || "").trim().toLowerCase();
  const actorDisplayName = normalizeText(actor?.displayName || actorLogin, 160);

  await sql`
    INSERT INTO customer_crm_profiles (
      tenant_id,
      restaurant_id,
      restaurant_key,
      customer_key,
      notes,
      tags_json,
      updated_by_login,
      updated_by_display_name,
      created_at,
      updated_at
    )
    VALUES (
      ${tenant.tenantId},
      ${tenant.restaurantId},
      ${tenant.restaurantKey},
      ${profilePayload.customerKey},
      ${profilePayload.notes},
      ${JSON.stringify(profilePayload.tags)}::jsonb,
      ${actorLogin},
      ${actorDisplayName},
      NOW(),
      NOW()
    )
    ON CONFLICT (tenant_id, restaurant_id, customer_key) DO UPDATE
    SET
      tenant_id = EXCLUDED.tenant_id,
      restaurant_id = EXCLUDED.restaurant_id,
      restaurant_key = EXCLUDED.restaurant_key,
      notes = EXCLUDED.notes,
      tags_json = EXCLUDED.tags_json,
      updated_by_login = EXCLUDED.updated_by_login,
      updated_by_display_name = EXCLUDED.updated_by_display_name,
      updated_at = NOW()
  `;

  const snapshot = await getAdminCustomersFromNeon({}, tenant);
  return {
    ...snapshot,
    message: "Perfil do cliente salvo com sucesso.",
    customer: snapshot.customers.find((customer) => customer.customerKey === profilePayload.customerKey) || null,
  };
};

const saveAdminCustomerProfile = async (payload = {}, actor = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "customers:admin:save-profile");
  assertStorageIsAvailable();
  return getStorageMode() === "neon"
    ? saveCustomerProfileInNeon(payload, actor, tenant)
    : saveCustomerProfileInFileStore(payload, actor, tenant);
};

module.exports = {
  getAdminCustomers,
  saveAdminCustomerProfile,
};
