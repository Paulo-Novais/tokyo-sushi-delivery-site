const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { neon } = require("./tenant-sql.cjs");
const { buildHttpError } = require("./http.cjs");
const { getOperationalTenant } = require("./tenant-context.cjs");

const LOCAL_STORAGE_FILE = path.join(process.cwd(), ".data", "inventory-store.json");
const LOCAL_STORE_VERSION = 1;
const STORE_KEY = "default";
const MAX_TEXT_LENGTH = 180;
const MAX_UNIT_LENGTH = 40;
const MAX_QUANTITY = 1000000;
const LOW_STOCK_MULTIPLIER = 1.2;
const EXPIRATION_WARNING_DAYS = 3;
const DEFAULT_UNIT = "unidade";
const SEED_SOURCE_LABEL = "CHECKLIST FINAL .docx";

const INVENTORY_SEED_CATEGORIES = Object.freeze([
  {
    title: "DISTRIBUIDORA DE PEIXES",
    items: ["Salmão", "Salmão Defumado", "Tilapia", "Camarão", "Camarão (grande)"],
  },
  {
    title: "DISTRIBUIDORA RIBEIRÂNEA (INSUMOS JAPONES)",
    items: [
      "Arroz Japonês",
      "Kani-Kama",
      "Tempero Arroz",
      "Alga",
      "Hondashi",
      "Shoyu 20Lts",
      "Shoyu 30ml",
      "Tare 30ml",
      "Gergelim",
      "Farinha Panko",
      "Maravilhas do Mar (knorr)",
      "Amêndoas",
      "Geleia",
      "Pimenta Sriracha",
      "Massa Harumaki",
      "Molho Tonkatsu",
    ],
  },
  {
    title: "HORT-FRUTI",
    items: [
      "Cebolinha",
      "Gengibre",
      "Limão",
      "Pepino Japonês",
      "Pimenta Biquinho",
      "Alho Poró",
      "Cebola Roxa",
      "Rúcula",
      "Mostarda",
      "Pimentão Vermelho",
      "Pimentão Amarelo",
      "Pimentão Verde",
      "Repolho Roxo",
      "Repolho Verde",
      "Brócolis",
      "Cenoura",
      "Couve Flor",
      "Couve",
      "Acelga",
      "Alface",
      "Banana",
    ],
  },
  {
    title: "MERCADO",
    items: [
      "Cream Cheese (Scala)",
      "Cream Cheese (Polenghi)",
      "Farinha de Trigo",
      "Castanha",
      "Shimeji",
      "Shitake",
      "Frango",
      "Filé Mignon",
      "Lombo (Carne de Porco)",
      "Azeite de Oliva",
      "Tomate Seco",
      "Goiabada",
      "Creme de Avelã",
      "Açúcar 5kg",
    ],
  },
  {
    title: "CASA DE EMBALAGENS",
    items: [
      "Embalagem HF100",
      "Embalagem Temakeira",
      "Embalagem Mega Hots",
      "Sacolas",
      "Guardanapos",
      "Pacote de Hashi",
      "Adaptador (Hashi infantil)",
      "Grampeador",
      "Filme PVC",
      "Grampos",
      "Maçarico",
    ],
  },
  {
    title: "LIMPEZA E HIGIENE",
    items: ["Água Sanitária", "Detergente", "Bucha lavar louça", "Saco de lixo 50L"],
  },
]);

let sqlClient = null;
let schemaReadyPromise = null;

const cloneJson = (value) => JSON.parse(JSON.stringify(value));

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
      "DATABASE_URL ainda nao foi configurada. O estoque precisa de armazenamento persistente.",
      "inventory_storage_unavailable"
    );
  }
};

const getSql = () => {
  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }

  return sqlClient;
};

const ensureInventorySchema = async () => {
  if (schemaReadyPromise) {
    return schemaReadyPromise;
  }

  const sql = getSql();
  schemaReadyPromise = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS inventory_runtime_state (
        state_key TEXT NOT NULL,
        tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
        restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default',
        restaurant_key TEXT NOT NULL DEFAULT 'default',
        items JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by_login TEXT NOT NULL DEFAULT '',
        updated_by_display_name TEXT NOT NULL DEFAULT ''
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS inventory_runtime_state_updated_at_idx
      ON inventory_runtime_state (updated_at DESC)
    `;

    await sql`
      ALTER TABLE inventory_runtime_state
      ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default'
    `;

    await sql`
      ALTER TABLE inventory_runtime_state
      ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default'
    `;

    await sql`
      ALTER TABLE inventory_runtime_state
      ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default'
    `;

    await sql`
      ALTER TABLE inventory_runtime_state
      DROP CONSTRAINT IF EXISTS inventory_runtime_state_pkey
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS inventory_runtime_state_restaurant_key_idx
      ON inventory_runtime_state (restaurant_key, updated_at DESC)
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS inventory_runtime_state_tenant_restaurant_state_uidx
      ON inventory_runtime_state (tenant_id, restaurant_id, state_key)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS inventory_runtime_state_tenant_restaurant_updated_idx
      ON inventory_runtime_state (tenant_id, restaurant_id, updated_at DESC)
    `;
  })();

  return schemaReadyPromise;
};

const normalizeText = (value, maxLength = MAX_TEXT_LENGTH) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const normalizeSearchKey = (value) =>
  normalizeText(value, 240)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toSafeQuantity = (value) => {
  if (value === null || typeof value === "undefined" || value === "") {
    return 0;
  }

  const normalizedValue =
    typeof value === "string" ? value.replace(/[^\d,.\-]/g, "").replace(",", ".") : value;
  const numericValue = Number(normalizedValue);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Number(Math.min(Math.max(numericValue, 0), MAX_QUANTITY).toFixed(3));
};

const normalizeDateValue = (value) => {
  const normalizedValue = normalizeText(value, 20);

  if (!normalizedValue) {
    return "";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return "";
  }

  const date = new Date(`${normalizedValue}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "" : normalizedValue;
};

const normalizeTimestamp = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const buildInventoryItemId = (category, name, existingIds = new Set()) => {
  const baseId = normalizeSearchKey(`${category}-${name}`).slice(0, 96) || crypto.randomUUID();
  let candidate = baseId;
  let suffix = 2;

  while (existingIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }

  existingIds.add(candidate);
  return candidate;
};

const getItemDedupKey = (item) =>
  `${normalizeSearchKey(item?.category || "Sem categoria")}::${normalizeSearchKey(item?.name || "")}`;

const normalizeInventoryItem = (item = {}, existingIds = new Set()) => {
  const name = normalizeText(item.name, 160);
  const category = normalizeText(item.category, 160) || "Sem categoria";
  const id = normalizeText(item.id, 120) || buildInventoryItemId(category, name, existingIds);
  const createdAt = normalizeTimestamp(item.createdAt || item.created_at) || new Date().toISOString();

  existingIds.add(id);

  return {
    id,
    name,
    category,
    quantity: toSafeQuantity(item.quantity ?? item.currentQuantity ?? item.current_quantity),
    unit: normalizeText(item.unit, MAX_UNIT_LENGTH) || DEFAULT_UNIT,
    minimumQuantity: toSafeQuantity(
      item.minimumQuantity ?? item.minimum_quantity ?? item.minQuantity ?? item.min_quantity
    ),
    expirationDate: normalizeDateValue(item.expirationDate ?? item.expiration_date ?? item.validity ?? item.validade),
    source: normalizeText(item.source, 40) || "manual",
    createdAt,
    updatedAt: normalizeTimestamp(item.updatedAt || item.updated_at) || createdAt,
    updatedByLogin: normalizeText(item.updatedByLogin || item.updated_by_login, 120).toLowerCase(),
    updatedByDisplayName: normalizeText(item.updatedByDisplayName || item.updated_by_display_name, 160),
  };
};

const normalizeInventoryItems = (items = []) => {
  const existingIds = new Set();
  const seenKeys = new Set();
  const normalizedItems = [];

  (Array.isArray(items) ? items : []).forEach((item) => {
    const normalizedItem = normalizeInventoryItem(item, existingIds);
    const dedupKey = getItemDedupKey(normalizedItem);

    if (!normalizedItem.name || seenKeys.has(dedupKey)) {
      return;
    }

    seenKeys.add(dedupKey);
    normalizedItems.push(normalizedItem);
  });

  return normalizedItems;
};

const getEmptyStore = () => ({
  version: LOCAL_STORE_VERSION,
  tenantId: "tenant_default",
  restaurantId: "restaurant_default",
  restaurantKey: "default",
  items: [],
  tenants: {},
});

const getScopedStoreKey = (tenant) =>
  tenant.isDefaultTenant ? STORE_KEY : `${tenant.restaurantKey}:${STORE_KEY}`;

const ensureFileStore = async () => {
  await fs.mkdir(path.dirname(LOCAL_STORAGE_FILE), { recursive: true });

  try {
    await fs.access(LOCAL_STORAGE_FILE);
  } catch (error) {
    await fs.writeFile(LOCAL_STORAGE_FILE, JSON.stringify(getEmptyStore(), null, 2));
  }
};

const readFileStore = async () => {
  await ensureFileStore();
  const contents = await fs.readFile(LOCAL_STORAGE_FILE, "utf8");

  try {
    const parsed = JSON.parse(contents);
    return {
      version: Number(parsed?.version || LOCAL_STORE_VERSION),
      tenantId: normalizeText(parsed?.tenantId || parsed?.tenant_id, 120) || "tenant_default",
      restaurantId: normalizeText(parsed?.restaurantId || parsed?.restaurant_id, 120) || "restaurant_default",
      restaurantKey: normalizeText(parsed?.restaurantKey || parsed?.restaurant_key, 120) || "default",
      items: normalizeInventoryItems(parsed?.items),
      tenants:
        parsed?.tenants && typeof parsed.tenants === "object" && !Array.isArray(parsed.tenants)
          ? parsed.tenants
          : {},
    };
  } catch (error) {
    return getEmptyStore();
  }
};

const writeFileStore = async (store) => {
  await fs.mkdir(path.dirname(LOCAL_STORAGE_FILE), { recursive: true });
  await fs.writeFile(
    LOCAL_STORAGE_FILE,
    `${JSON.stringify(
      {
        version: LOCAL_STORE_VERSION,
        tenantId: normalizeText(store?.tenantId || store?.tenant_id, 120) || "tenant_default",
        restaurantId: normalizeText(store?.restaurantId || store?.restaurant_id, 120) || "restaurant_default",
        restaurantKey: normalizeText(store?.restaurantKey || store?.restaurant_key, 120) || "default",
        items: normalizeInventoryItems(store?.items),
        tenants:
          store?.tenants && typeof store.tenants === "object" && !Array.isArray(store.tenants)
            ? store.tenants
            : {},
      },
      null,
      2
    )}\n`,
    "utf8"
  );
};

const readNeonStore = async (tenant) => {
  await ensureInventorySchema();
  const stateKey = getScopedStoreKey(tenant);
  const rows = await getSql()`
    SELECT items
    FROM inventory_runtime_state
    WHERE state_key = ${stateKey}
      AND tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
    LIMIT 1
  `;

  if (!rows[0]) {
    return getEmptyStore();
  }

  return {
    version: LOCAL_STORE_VERSION,
    items: normalizeInventoryItems(rows[0].items),
  };
};

const writeNeonStore = async (store, actor = {}, tenant) => {
  await ensureInventorySchema();
  const stateKey = getScopedStoreKey(tenant);
  await getSql()`
    INSERT INTO inventory_runtime_state (
      state_key,
      tenant_id,
      restaurant_id,
      restaurant_key,
      items,
      updated_at,
      updated_by_login,
      updated_by_display_name
    )
    VALUES (
      ${stateKey},
      ${tenant.tenantId},
      ${tenant.restaurantId},
      ${tenant.restaurantKey},
      ${JSON.stringify(normalizeInventoryItems(store?.items))}::jsonb,
      NOW(),
      ${normalizeText(actor.login, 120).toLowerCase()},
      ${normalizeText(actor.displayName, 160)}
    )
    ON CONFLICT (tenant_id, restaurant_id, state_key)
    DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      restaurant_id = EXCLUDED.restaurant_id,
      restaurant_key = EXCLUDED.restaurant_key,
      items = EXCLUDED.items,
      updated_at = EXCLUDED.updated_at,
      updated_by_login = EXCLUDED.updated_by_login,
      updated_by_display_name = EXCLUDED.updated_by_display_name
  `;
};

const readStore = async (tenant) => {
  assertStorageIsAvailable();

  if (getStorageMode() === "neon") {
    return readNeonStore(tenant);
  }

  const store = await readFileStore();

  if (tenant.isDefaultTenant) {
    return {
      version: LOCAL_STORE_VERSION,
      items: normalizeInventoryItems(store.items),
    };
  }

  return {
    version: LOCAL_STORE_VERSION,
    items: normalizeInventoryItems(store.tenants?.[tenant.restaurantKey]?.items),
  };
};

const writeStore = async (store, actor = {}, tenant) => {
  assertStorageIsAvailable();

  if (getStorageMode() === "neon") {
    await writeNeonStore(store, actor, tenant);
    return;
  }

  const currentStore = await readFileStore();

  if (tenant.isDefaultTenant) {
    await writeFileStore({
      ...currentStore,
      version: LOCAL_STORE_VERSION,
      tenantId: tenant.tenantId,
      restaurantId: tenant.restaurantId,
      restaurantKey: tenant.restaurantKey,
      items: normalizeInventoryItems(store?.items),
    });
    return;
  }

  await writeFileStore({
    ...currentStore,
    version: LOCAL_STORE_VERSION,
    tenants: {
      ...(currentStore.tenants || {}),
      [tenant.restaurantKey]: {
        ...(currentStore.tenants?.[tenant.restaurantKey] || {}),
        tenantId: tenant.tenantId,
        restaurantId: tenant.restaurantId,
        restaurantKey: tenant.restaurantKey,
        items: normalizeInventoryItems(store?.items),
      },
    },
  });
};

const buildSeedItems = () =>
  INVENTORY_SEED_CATEGORIES.flatMap((category) =>
    category.items.map((name) => ({
      name,
      category: category.title,
      quantity: 0,
      unit: DEFAULT_UNIT,
      minimumQuantity: 0,
      expirationDate: "",
      source: "docx",
    }))
  );

const mergeSeedItems = (store = {}) => {
  const items = normalizeInventoryItems(store.items);
  const existingKeys = new Set(items.map(getItemDedupKey));
  const existingIds = new Set(items.map((item) => item.id));
  let addedCount = 0;

  buildSeedItems().forEach((seedItem) => {
    const dedupKey = getItemDedupKey(seedItem);

    if (existingKeys.has(dedupKey)) {
      return;
    }

    const now = new Date().toISOString();
    items.push(
      normalizeInventoryItem(
        {
          ...seedItem,
          id: buildInventoryItemId(seedItem.category, seedItem.name, existingIds),
          createdAt: now,
          updatedAt: now,
        },
        existingIds
      )
    );
    existingKeys.add(dedupKey);
    addedCount += 1;
  });

  return {
    store: {
      version: LOCAL_STORE_VERSION,
      items,
    },
    addedCount,
  };
};

const loadMergedStore = async (tenant) => {
  const store = await readStore(tenant);
  const merged = mergeSeedItems(store);

  if (merged.addedCount > 0) {
    await writeStore(
      merged.store,
      {
        login: "system",
        displayName: "Seed DOCX",
      },
      tenant
    );
  }

  return merged.store;
};

const getInventoryStatus = (item) => {
  const quantity = toSafeQuantity(item.quantity);
  const minimumQuantity = toSafeQuantity(item.minimumQuantity);

  if (minimumQuantity > 0 && quantity < minimumQuantity) {
    return {
      key: "critical",
      label: "Critico",
      helper: "Abaixo do minimo",
    };
  }

  if (minimumQuantity > 0 && quantity <= minimumQuantity * LOW_STOCK_MULTIPLIER) {
    return {
      key: "low",
      label: "Baixo",
      helper: "Proximo do minimo",
    };
  }

  return {
    key: "ok",
    label: "OK",
    helper: "Acima do minimo",
  };
};

const getTodayStart = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const getExpirationInfo = (item) => {
  const expirationDate = normalizeDateValue(item.expirationDate);

  if (!expirationDate) {
    return {
      key: "none",
      label: "Sem validade",
      daysToExpire: null,
      isExpired: false,
      isExpiringSoon: false,
    };
  }

  const expiration = new Date(`${expirationDate}T00:00:00`);
  const daysToExpire = Math.ceil((expiration.getTime() - getTodayStart().getTime()) / 86400000);

  if (daysToExpire < 0) {
    return {
      key: "expired",
      label: `Vencido ha ${Math.abs(daysToExpire)} dia(s)`,
      daysToExpire,
      isExpired: true,
      isExpiringSoon: false,
    };
  }

  if (daysToExpire === 0) {
    return {
      key: "today",
      label: "Vence hoje",
      daysToExpire,
      isExpired: false,
      isExpiringSoon: true,
    };
  }

  return {
    key: daysToExpire <= EXPIRATION_WARNING_DAYS ? "soon" : "future",
    label: `Vence em ${daysToExpire} dia(s)`,
    daysToExpire,
    isExpired: false,
    isExpiringSoon: daysToExpire <= EXPIRATION_WARNING_DAYS,
  };
};

const enrichInventoryItem = (item) => ({
  ...item,
  status: getInventoryStatus(item),
  expiration: getExpirationInfo(item),
});

const buildInventorySummary = (items = []) => {
  const enrichedItems = items.map(enrichInventoryItem);
  const categories = [...new Set(enrichedItems.map((item) => item.category).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, "pt-BR")
  );

  return {
    totalItems: enrichedItems.length,
    totalCategories: categories.length,
    okItems: enrichedItems.filter((item) => item.status.key === "ok").length,
    lowItems: enrichedItems.filter((item) => item.status.key === "low").length,
    criticalItems: enrichedItems.filter((item) => item.status.key === "critical").length,
    expiringSoonItems: enrichedItems.filter((item) => item.expiration.isExpiringSoon).length,
    expiredItems: enrichedItems.filter((item) => item.expiration.isExpired).length,
    importedItems: enrichedItems.filter((item) => item.source === "docx").length,
  };
};

const applyInventoryFilters = (items = [], filters = {}) => {
  const queryKey = normalizeSearchKey(filters.query);
  const categoryKey = normalizeSearchKey(filters.category);
  const statusKey = normalizeText(filters.status, 40).toLowerCase();

  return items.filter((item) => {
    const enrichedItem = enrichInventoryItem(item);
    const matchesQuery =
      !queryKey ||
      normalizeSearchKey(`${item.name} ${item.category} ${item.unit}`).includes(queryKey);
    const matchesCategory = !categoryKey || normalizeSearchKey(item.category) === categoryKey;
    const matchesStatus = !statusKey || enrichedItem.status.key === statusKey;

    return matchesQuery && matchesCategory && matchesStatus;
  });
};

const getAdminInventory = async (filters = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "inventory:admin:list");
  const store = await loadMergedStore(tenant);
  const items = normalizeInventoryItems(store.items).map(enrichInventoryItem);
  const filteredItems = applyInventoryFilters(items, filters).map(enrichInventoryItem);
  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, "pt-BR")
  );

  return {
    storageMode: getStorageMode(),
    generatedAt: new Date().toISOString(),
    sourceDocument: SEED_SOURCE_LABEL,
    seedSummary: {
      categories: INVENTORY_SEED_CATEGORIES.length,
      items: buildSeedItems().length,
    },
    filters: {
      query: normalizeText(filters.query, 120),
      category: normalizeText(filters.category, 160),
      status: normalizeText(filters.status, 40).toLowerCase(),
    },
    summary: buildInventorySummary(items),
    categories,
    items: filteredItems.sort((left, right) => {
      const categoryOrder = left.category.localeCompare(right.category, "pt-BR");
      return categoryOrder || left.name.localeCompare(right.name, "pt-BR");
    }),
  };
};

const saveInventoryItem = async (payload = {}, actor = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "inventory:admin:save-item");
  const store = await loadMergedStore(tenant);
  const items = normalizeInventoryItems(store.items);
  const itemId = normalizeText(payload.itemId || payload.id, 120);
  const existingItem = itemId ? items.find((item) => item.id === itemId) : null;
  const now = new Date().toISOString();
  const nextItem = normalizeInventoryItem({
    ...existingItem,
    id: existingItem?.id || itemId || undefined,
    name: payload.name,
    category: payload.category,
    quantity: payload.quantity,
    unit: payload.unit,
    minimumQuantity: payload.minimumQuantity,
    expirationDate: payload.expirationDate,
    source: existingItem?.source || "manual",
    createdAt: existingItem?.createdAt || now,
    updatedAt: now,
    updatedByLogin: actor.login,
    updatedByDisplayName: actor.displayName,
  });

  if (!nextItem.name) {
    throw buildHttpError(400, "Informe o nome do item do estoque.", "missing_inventory_item_name");
  }

  if (!nextItem.category) {
    throw buildHttpError(400, "Informe a categoria do item do estoque.", "missing_inventory_category");
  }

  const duplicateItem = items.find(
    (item) => item.id !== nextItem.id && getItemDedupKey(item) === getItemDedupKey(nextItem)
  );

  if (duplicateItem) {
    throw buildHttpError(409, "Este item ja existe nesta categoria do estoque.", "duplicate_inventory_item");
  }

  const nextItems = existingItem
    ? items.map((item) => (item.id === existingItem.id ? nextItem : item))
    : [...items, nextItem];

  await writeStore({ version: LOCAL_STORE_VERSION, items: nextItems }, actor, tenant);

  return {
    storageMode: getStorageMode(),
    generatedAt: new Date().toISOString(),
    message: existingItem ? "Item do estoque salvo com sucesso." : "Item criado no estoque com sucesso.",
    itemId: nextItem.id,
    item: enrichInventoryItem(nextItem),
  };
};

const adjustInventoryStock = async (payload = {}, actor = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "inventory:admin:adjust-stock");
  const store = await loadMergedStore(tenant);
  const items = normalizeInventoryItems(store.items);
  const itemId = normalizeText(payload.itemId || payload.id, 120);
  const mode = normalizeText(payload.mode || payload.type || payload.operation, 20).toLowerCase();
  const amount = toSafeQuantity(payload.amount || payload.quantity);
  const item = items.find((entry) => entry.id === itemId);

  if (!item) {
    throw buildHttpError(404, "Nao encontrei o item do estoque.", "inventory_item_not_found");
  }

  if (!["add", "remove"].includes(mode)) {
    throw buildHttpError(400, "Informe se a movimentacao e entrada ou baixa.", "invalid_inventory_adjustment_mode");
  }

  if (amount <= 0) {
    throw buildHttpError(400, "Informe uma quantidade maior que zero.", "invalid_inventory_adjustment_amount");
  }

  const nextQuantity =
    mode === "add" ? item.quantity + amount : Math.max(0, item.quantity - amount);
  const updatedItem = normalizeInventoryItem({
    ...item,
    quantity: nextQuantity,
    updatedAt: new Date().toISOString(),
    updatedByLogin: actor.login,
    updatedByDisplayName: actor.displayName,
  });
  const nextItems = items.map((entry) => (entry.id === item.id ? updatedItem : entry));

  await writeStore({ version: LOCAL_STORE_VERSION, items: nextItems }, actor, tenant);

  return {
    storageMode: getStorageMode(),
    generatedAt: new Date().toISOString(),
    message: mode === "add" ? "Entrada de estoque registrada." : "Baixa de estoque registrada.",
    itemId: updatedItem.id,
    item: enrichInventoryItem(updatedItem),
  };
};

module.exports = {
  adjustInventoryStock,
  getAdminInventory,
  saveInventoryItem,
};
