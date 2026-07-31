const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const vm = require("node:vm");
const { neon } = require("./tenant-sql.cjs");
const {
  assertMigrationManagedRelations,
} = require("./database-schema.cjs");
const { buildHttpError } = require("./http.cjs");
const {
  getOperationalTenant,
  matchesTenantScope,
} = require("./tenant-context.cjs");

const LOCAL_STORAGE_FILE = path.join(process.cwd(), ".data", "catalog-overrides.json");
const SCRIPT_FILE = path.join(process.cwd(), "script.js");
const CATALOG_START_MARKER = 'const SITE_IMAGES_DIRECTORY = "./site-images";';
const CATALOG_END_MARKER = "const groupMediaControllers = new Map();";
const STORE_TIMEZONE_OFFSET = "-03:00";
const LOCAL_STORE_VERSION = 3;
const MAX_FEATURED_HOME_ITEMS = 3;
const MAX_ITEM_PRICE = 2000;
const MAX_PROMOTION_NAME_LENGTH = 160;
const MAX_PROMOTION_TARGET_LENGTH = 160;
const MAX_SECTION_TITLE_LENGTH = 160;
const MAX_SECTION_DESCRIPTION_LENGTH = 320;
const MAX_ITEM_NAME_LENGTH = 160;
const MAX_ITEM_DESCRIPTION_LENGTH = 500;
const MAX_ITEM_DETAIL_LENGTH = 120;
const MAX_ITEM_CATEGORY_LENGTH = 160;
const MAX_ITEM_BADGE_LENGTH = 80;
const MAX_IMAGE_VALUE_LENGTH = 800000;

let sqlClient = null;
let schemaReadyPromise = null;
let baseCatalogPromise = null;

const cloneJson = (value) => JSON.parse(JSON.stringify(value));
const getEmptyLocalStore = () => ({
  version: LOCAL_STORE_VERSION,
  tenantId: "tenant_default",
  restaurantId: "restaurant_default",
  restaurantKey: "default",
  items: [],
  promotions: [],
  catalogStructure: {
    sections: [],
    sectionDisplayOrder: [],
    featuredItemId: "",
    featuredItemIds: [],
  },
  tenants: {},
});

const getScopedStateKey = (tenant) =>
  tenant.isDefaultTenant ? "current" : `${tenant.restaurantKey}:current`;

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
      "DATABASE_URL ainda nao foi configurada. O catalogo administrativo precisa de armazenamento persistente.",
      "catalog_storage_unavailable"
    );
  }
};

const getSql = () => {
  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }

  return sqlClient;
};

const ensureCatalogSchema = async () => {
  if (schemaReadyPromise) {
    return schemaReadyPromise;
  }

  const sql = getSql();
  schemaReadyPromise = (async () => {
    if (
      await assertMigrationManagedRelations({
        sql,
        relations: [
          "catalog_item_overrides",
          "catalog_promotions",
          "catalog_runtime_state",
        ],
        component: "cardapio",
      })
    ) {
      return;
    }

    await sql`
      CREATE TABLE IF NOT EXISTS catalog_item_overrides (
        item_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
        restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default',
        restaurant_key TEXT NOT NULL DEFAULT 'default',
        price_override NUMERIC(10, 2),
        is_available BOOLEAN NOT NULL DEFAULT TRUE,
        is_paused BOOLEAN NOT NULL DEFAULT FALSE,
        is_promoted BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by_login TEXT NOT NULL DEFAULT '',
        updated_by_display_name TEXT NOT NULL DEFAULT ''
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS catalog_item_overrides_updated_at_idx
      ON catalog_item_overrides (updated_at DESC)
    `;

    await sql`
      ALTER TABLE catalog_item_overrides
      ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default'
    `;

    await sql`
      ALTER TABLE catalog_item_overrides
      ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default'
    `;

    await sql`
      ALTER TABLE catalog_item_overrides
      ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default'
    `;

    await sql`
      ALTER TABLE catalog_item_overrides
      DROP CONSTRAINT IF EXISTS catalog_item_overrides_pkey
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS catalog_item_overrides_restaurant_key_idx
      ON catalog_item_overrides (restaurant_key, updated_at DESC)
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS catalog_item_overrides_tenant_restaurant_item_uidx
      ON catalog_item_overrides (tenant_id, restaurant_id, item_id)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS catalog_item_overrides_tenant_restaurant_updated_idx
      ON catalog_item_overrides (tenant_id, restaurant_id, updated_at DESC)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS catalog_promotions (
        id TEXT NOT NULL,
        tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
        restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default',
        restaurant_key TEXT NOT NULL DEFAULT 'default',
        internal_name TEXT NOT NULL DEFAULT '',
        scope_type TEXT NOT NULL DEFAULT 'item',
        target_value TEXT NOT NULL DEFAULT '',
        pricing_type TEXT NOT NULL DEFAULT 'fixed_price',
        fixed_price NUMERIC(10, 2),
        discount_percent NUMERIC(6, 2),
        starts_at TIMESTAMPTZ NOT NULL,
        ends_at TIMESTAMPTZ NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by_login TEXT NOT NULL DEFAULT '',
        updated_by_display_name TEXT NOT NULL DEFAULT ''
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS catalog_promotions_status_idx
      ON catalog_promotions (is_enabled, starts_at, ends_at, updated_at DESC)
    `;

    await sql`
      ALTER TABLE catalog_promotions
      ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default'
    `;

    await sql`
      ALTER TABLE catalog_promotions
      ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default'
    `;

    await sql`
      ALTER TABLE catalog_promotions
      ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default'
    `;

    await sql`
      ALTER TABLE catalog_promotions
      DROP CONSTRAINT IF EXISTS catalog_promotions_pkey
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS catalog_promotions_restaurant_key_status_idx
      ON catalog_promotions (restaurant_key, is_enabled, starts_at, ends_at, updated_at DESC)
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS catalog_promotions_tenant_restaurant_id_uidx
      ON catalog_promotions (tenant_id, restaurant_id, id)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS catalog_promotions_tenant_restaurant_status_idx
      ON catalog_promotions (tenant_id, restaurant_id, is_enabled, starts_at, ends_at, updated_at DESC)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS catalog_runtime_state (
        state_key TEXT NOT NULL,
        tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
        restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default',
        restaurant_key TEXT NOT NULL DEFAULT 'default',
        sections JSONB NOT NULL DEFAULT '[]'::jsonb,
        section_display_order JSONB NOT NULL DEFAULT '[]'::jsonb,
        featured_item_id TEXT NOT NULL DEFAULT '',
        featured_item_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by_login TEXT NOT NULL DEFAULT '',
        updated_by_display_name TEXT NOT NULL DEFAULT ''
      )
    `;

    await sql`
      ALTER TABLE catalog_runtime_state
      ADD COLUMN IF NOT EXISTS featured_item_ids JSONB NOT NULL DEFAULT '[]'::jsonb
    `;

    await sql`
      ALTER TABLE catalog_runtime_state
      ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default'
    `;

    await sql`
      ALTER TABLE catalog_runtime_state
      ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default'
    `;

    await sql`
      ALTER TABLE catalog_runtime_state
      ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default'
    `;

    await sql`
      ALTER TABLE catalog_runtime_state
      DROP CONSTRAINT IF EXISTS catalog_runtime_state_pkey
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS catalog_runtime_state_restaurant_key_idx
      ON catalog_runtime_state (restaurant_key, updated_at DESC)
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS catalog_runtime_state_tenant_restaurant_state_uidx
      ON catalog_runtime_state (tenant_id, restaurant_id, state_key)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS catalog_runtime_state_tenant_restaurant_updated_idx
      ON catalog_runtime_state (tenant_id, restaurant_id, updated_at DESC)
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
      JSON.stringify(getEmptyLocalStore(), null, 2)
    );
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
      items: Array.isArray(parsed?.items) ? parsed.items : [],
      promotions: Array.isArray(parsed?.promotions) ? parsed.promotions : [],
      catalogStructure:
        parsed?.catalogStructure && typeof parsed.catalogStructure === "object"
          ? parsed.catalogStructure
          : getEmptyLocalStore().catalogStructure,
      tenants:
        parsed?.tenants && typeof parsed.tenants === "object" && !Array.isArray(parsed.tenants)
          ? parsed.tenants
          : {},
    };
  } catch (error) {
    return getEmptyLocalStore();
  }
};

const writeFileStore = async (store) => {
  await fs.writeFile(
    LOCAL_STORAGE_FILE,
    JSON.stringify(
      {
        ...getEmptyLocalStore(),
        ...(store && typeof store === "object" ? store : {}),
        tenantId: normalizeText(store?.tenantId || store?.tenant_id, 120) || "tenant_default",
        restaurantId: normalizeText(store?.restaurantId || store?.restaurant_id, 120) || "restaurant_default",
        restaurantKey: normalizeText(store?.restaurantKey || store?.restaurant_key, 120) || "default",
        items: Array.isArray(store?.items) ? store.items : [],
        promotions: Array.isArray(store?.promotions) ? store.promotions : [],
        catalogStructure:
          store?.catalogStructure && typeof store.catalogStructure === "object"
            ? store.catalogStructure
            : getEmptyLocalStore().catalogStructure,
        tenants:
          store?.tenants && typeof store.tenants === "object" && !Array.isArray(store.tenants)
            ? store.tenants
            : {},
      },
      null,
      2
    )
  );
};

const toMoneyOrNull = (value) => {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value.toFixed(2));
  }

  const normalizedValue = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=.*\.)/g, "")
    .replace(",", ".");
  const numericValue = Number(normalizedValue);
  return Number.isFinite(numericValue) ? Number(numericValue.toFixed(2)) : null;
};

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();
    if (["true", "1", "yes", "sim", "on"].includes(normalizedValue)) {
      return true;
    }
    if (["false", "0", "no", "nao", "off"].includes(normalizedValue)) {
      return false;
    }
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return fallback;
};

const normalizeText = (value, maxLength = 200) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const normalizeDateTimeValue = (value) => {
  const normalizedValue = normalizeText(value, 40);

  if (!normalizedValue) {
    return "";
  }

  const resolvedValue = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalizedValue)
    ? normalizedValue
    : `${normalizedValue}:00${STORE_TIMEZONE_OFFSET}`;
  const parsedDate = new Date(resolvedValue);

  return Number.isNaN(parsedDate.getTime()) ? "" : parsedDate.toISOString();
};

const normalizePositivePercent = (value) => {
  const numericValue = toMoneyOrNull(value);

  if (numericValue === null) {
    return null;
  }

  return Number(numericValue.toFixed(2));
};

const normalizeOverrideRecord = (record) => ({
  tenantId: normalizeText(record?.tenantId || record?.tenant_id, 120),
  restaurantId: normalizeText(record?.restaurantId || record?.restaurant_id, 120),
  restaurantKey: normalizeText(record?.restaurantKey || record?.restaurant_key, 120),
  itemId: normalizeText(record?.itemId || record?.item_id, 160),
  priceOverride: toMoneyOrNull(record?.priceOverride ?? record?.price_override),
  isAvailable: normalizeBoolean(record?.isAvailable ?? record?.is_available, true),
  isPaused: normalizeBoolean(record?.isPaused ?? record?.is_paused, false),
  isPromoted: normalizeBoolean(record?.isPromoted ?? record?.is_promoted, false),
  updatedAt: normalizeText(record?.updatedAt || record?.updated_at, 80),
  updatedByLogin: normalizeText(record?.updatedByLogin || record?.updated_by_login, 120),
  updatedByDisplayName: normalizeText(record?.updatedByDisplayName || record?.updated_by_display_name, 160),
});

const normalizePromotionRecord = (record) => ({
  tenantId: normalizeText(record?.tenantId || record?.tenant_id, 120),
  restaurantId: normalizeText(record?.restaurantId || record?.restaurant_id, 120),
  restaurantKey: normalizeText(record?.restaurantKey || record?.restaurant_key, 120),
  id: normalizeText(record?.id, 120),
  internalName: normalizeText(
    record?.internalName || record?.internal_name,
    MAX_PROMOTION_NAME_LENGTH
  ),
  scopeType: normalizeText(record?.scopeType || record?.scope_type, 30).toLowerCase() || "item",
  targetValue: normalizeText(record?.targetValue || record?.target_value, MAX_PROMOTION_TARGET_LENGTH),
  pricingType:
    normalizeText(record?.pricingType || record?.pricing_type, 30).toLowerCase() || "fixed_price",
  fixedPrice: toMoneyOrNull(record?.fixedPrice ?? record?.fixed_price),
  discountPercent: normalizePositivePercent(record?.discountPercent ?? record?.discount_percent),
  startsAt: normalizeDateTimeValue(record?.startsAt || record?.starts_at),
  endsAt: normalizeDateTimeValue(record?.endsAt || record?.ends_at),
  isEnabled: normalizeBoolean(record?.isEnabled ?? record?.is_enabled, true),
  createdAt: normalizeDateTimeValue(record?.createdAt || record?.created_at),
  updatedAt: normalizeDateTimeValue(record?.updatedAt || record?.updated_at),
  updatedByLogin: normalizeText(record?.updatedByLogin || record?.updated_by_login, 120),
  updatedByDisplayName: normalizeText(record?.updatedByDisplayName || record?.updated_by_display_name, 160),
});

const normalizeLongText = (value, maxLength = 4000) => String(value || "").trim().slice(0, maxLength);

const slugifyCatalogValue = (value, fallback = "item") => {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return normalized || fallback;
};

const buildUniqueCatalogId = (desiredValue, existingIds, fallbackPrefix = "item") => {
  const baseId = slugifyCatalogValue(desiredValue, fallbackPrefix);

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  let nextId = `${baseId}-${suffix}`;

  while (existingIds.has(nextId)) {
    suffix += 1;
    nextId = `${baseId}-${suffix}`;
  }

  return nextId;
};

const normalizeCatalogItemRecord = (record = {}) => {
  const basePrice =
    toMoneyOrNull(record?.basePrice ?? record?.base_price) ??
    toMoneyOrNull(record?.price);
  const currentPrice = toMoneyOrNull(record?.price);
  const price = currentPrice !== null ? currentPrice : basePrice;
  const availabilityState =
    normalizeText(record?.availabilityState || record?.availability_state, 40).toLowerCase() || "";
  const isPaused =
    availabilityState === "paused"
      ? true
      : normalizeBoolean(record?.isPaused ?? record?.is_paused, false);
  const isAvailable =
    availabilityState === "unavailable"
      ? false
      : normalizeBoolean(record?.isAvailable ?? record?.is_available, true);

  return {
    id: normalizeText(record?.id, 160),
    name: normalizeText(record?.name, MAX_ITEM_NAME_LENGTH),
    category: normalizeText(record?.category, MAX_ITEM_CATEGORY_LENGTH),
    description: normalizeText(record?.description, MAX_ITEM_DESCRIPTION_LENGTH),
    detail: normalizeText(record?.detail, MAX_ITEM_DETAIL_LENGTH),
    image: normalizeLongText(record?.image, MAX_IMAGE_VALUE_LENGTH),
    badge: normalizeText(record?.badge, MAX_ITEM_BADGE_LENGTH),
    price,
    basePrice,
    isAvailable,
    isPaused,
    isPromoted: normalizeBoolean(record?.isPromoted ?? record?.is_promoted, false),
    isHighlighted: normalizeBoolean(record?.isHighlighted ?? record?.is_highlighted, false),
  };
};

const normalizeCatalogSectionRecord = (record = {}) => ({
  id: normalizeText(record?.id, 160),
  kicker: normalizeText(record?.kicker, 80),
  title: normalizeText(record?.title, MAX_SECTION_TITLE_LENGTH),
  description: normalizeText(record?.description, MAX_SECTION_DESCRIPTION_LENGTH),
  items: (Array.isArray(record?.items) ? record.items : []).map(normalizeCatalogItemRecord),
});

const normalizeFeaturedItemIds = (value = {}, availableItemIds = null) => {
  const featuredItemIds = [];
  const shouldFilter = availableItemIds instanceof Set && availableItemIds.size > 0;
  const appendCandidate = (candidate) => {
    const normalizedCandidate = normalizeText(candidate, 160);

    if (
      !normalizedCandidate ||
      featuredItemIds.includes(normalizedCandidate) ||
      (shouldFilter && !availableItemIds.has(normalizedCandidate))
    ) {
      return;
    }

    featuredItemIds.push(normalizedCandidate);
  };
  const rawFeaturedIds = value?.featuredItemIds ?? value?.featured_item_ids;

  if (Array.isArray(rawFeaturedIds)) {
    rawFeaturedIds.forEach(appendCandidate);
  }

  if (featuredItemIds.length === 0) {
    appendCandidate(value?.featuredItemId ?? value?.featured_item_id);
  }

  return featuredItemIds.slice(0, MAX_FEATURED_HOME_ITEMS);
};

const normalizeCatalogStructure = (value = {}) => {
  const sections = (Array.isArray(value?.sections) ? value.sections : [])
    .map(normalizeCatalogSectionRecord)
    .filter((section) => section.id && section.title);
  const availableItemIds = new Set(
    sections.flatMap((section) =>
      (Array.isArray(section.items) ? section.items : [])
        .map((item) => normalizeText(item?.id, 160))
        .filter(Boolean)
    )
  );
  const availableSectionIds = new Set(sections.map((section) => section.id));
  const sectionDisplayOrder = [
    ...new Set(
      (Array.isArray(value?.sectionDisplayOrder ?? value?.section_display_order)
        ? value.sectionDisplayOrder ?? value.section_display_order
        : []
      )
        .map((entry) => normalizeText(entry, 160))
        .filter((entry) => entry && availableSectionIds.has(entry))
    ),
  ];

  sections.forEach((section) => {
    if (!sectionDisplayOrder.includes(section.id)) {
      sectionDisplayOrder.push(section.id);
    }
  });

  const featuredItemIds = normalizeFeaturedItemIds(value, availableItemIds);

  return {
    sections,
    sectionDisplayOrder,
    featuredItemId: featuredItemIds[0] || "",
    featuredItemIds,
  };
};

const getCatalogScriptSlice = (source) => {
  const startIndex = source.indexOf(CATALOG_START_MARKER);
  const endIndex = source.indexOf(CATALOG_END_MARKER);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw buildHttpError(
      500,
      "Nao encontrei a base do catalogo no script publico.",
      "catalog_source_not_found"
    );
  }

  return source.slice(startIndex, endIndex);
};

const getBaseCatalogSnapshot = async () => {
  if (baseCatalogPromise) {
    return baseCatalogPromise;
  }

  baseCatalogPromise = (async () => {
    const source = await fs.readFile(SCRIPT_FILE, "utf8");
    const catalogSlice = getCatalogScriptSlice(source);
    const sandbox = {
      module: { exports: {} },
      exports: {},
    };

    vm.runInNewContext(
      `
${catalogSlice}
normalizeImageFields(MENU_SECTIONS);
module.exports = {
  MENU_SECTIONS,
  MENU_SECTION_DISPLAY_ORDER,
};
      `,
      sandbox,
      {
        timeout: 1500,
      }
    );

    const sections = cloneJson(sandbox.module.exports.MENU_SECTIONS || []);
    const sectionDisplayOrder = Array.isArray(sandbox.module.exports.MENU_SECTION_DISPLAY_ORDER)
      ? [...sandbox.module.exports.MENU_SECTION_DISPLAY_ORDER]
      : [];

    return {
      sections,
      sectionDisplayOrder,
    };
  })();

  return baseCatalogPromise;
};

const getOverrideMapFromRecords = (records) =>
  records.reduce((summary, record) => {
    const normalizedRecord = normalizeOverrideRecord(record);

    if (!normalizedRecord.itemId) {
      return summary;
    }

    summary.set(normalizedRecord.itemId, normalizedRecord);
    return summary;
  }, new Map());

const getOverrideMapFromFileStore = async (tenant) => {
  const store = await readFileStore();
  return getOverrideMapFromRecords(
    (Array.isArray(store.items) ? store.items : []).filter((entry) =>
      matchesTenantScope(entry, tenant)
    )
  );
};

const getOverrideMapFromNeon = async (tenant) => {
  await ensureCatalogSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT
      item_id,
      price_override,
      is_available,
      is_paused,
      is_promoted,
      updated_at,
      updated_by_login,
      updated_by_display_name
    FROM catalog_item_overrides
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
  `;

  return getOverrideMapFromRecords(rows);
};

const getCatalogOverrideMap = async (tenant) => {
  const storageMode = getStorageMode();

  if (storageMode === "neon") {
    return getOverrideMapFromNeon(tenant);
  }

  assertStorageIsAvailable();
  return getOverrideMapFromFileStore(tenant);
};

const getCatalogStructureFromFileStore = async (tenant) => {
  const store = await readFileStore();

  if (!tenant.isDefaultTenant) {
    return normalizeCatalogStructure(store.tenants?.[tenant.restaurantKey]?.catalogStructure || {});
  }

  return normalizeCatalogStructure(store.catalogStructure);
};

const getCatalogStructureFromNeon = async (tenant) => {
  await ensureCatalogSchema();
  const sql = getSql();
  const stateKey = getScopedStateKey(tenant);
  const rows = await sql`
    SELECT
      sections,
      section_display_order,
      featured_item_id,
      featured_item_ids
    FROM catalog_runtime_state
    WHERE state_key = ${stateKey}
      AND tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
    LIMIT 1
  `;

  const row = Array.isArray(rows) ? rows[0] : null;
  return normalizeCatalogStructure({
    sections: row?.sections,
    sectionDisplayOrder: row?.section_display_order,
    featuredItemId: row?.featured_item_id,
    featuredItemIds: row?.featured_item_ids,
  });
};

const getCatalogStructureState = async (tenant) => {
  const storageMode = getStorageMode();

  if (storageMode === "neon") {
    const state = await getCatalogStructureFromNeon(tenant);

    if (state.sections.length > 0) {
      return state;
    }
  } else {
    assertStorageIsAvailable();
    const state = await getCatalogStructureFromFileStore(tenant);

    if (state.sections.length > 0) {
      return state;
    }
  }

  const baseCatalog = await getBaseCatalogSnapshot();
  return normalizeCatalogStructure({
    sections: baseCatalog.sections,
    sectionDisplayOrder: baseCatalog.sectionDisplayOrder,
    featuredItemId: "",
    featuredItemIds: [],
  });
};

const saveCatalogStructureToFileStore = async (nextState = {}, actor = {}, tenant) => {
  const store = await readFileStore();
  const normalizedState = normalizeCatalogStructure(nextState);
  const nextStore = tenant.isDefaultTenant
    ? {
        ...store,
        version: LOCAL_STORE_VERSION,
        tenantId: tenant.tenantId,
        restaurantId: tenant.restaurantId,
        restaurantKey: tenant.restaurantKey,
        catalogStructure: normalizedState,
      }
    : {
        ...store,
        version: LOCAL_STORE_VERSION,
        tenants: {
          ...(store.tenants || {}),
          [tenant.restaurantKey]: {
            ...(store.tenants?.[tenant.restaurantKey] || {}),
            tenantId: tenant.tenantId,
            restaurantId: tenant.restaurantId,
            restaurantKey: tenant.restaurantKey,
            catalogStructure: normalizedState,
          },
        },
      };

  await writeFileStore(nextStore);

  return {
    storageMode: "file",
    generatedAt: new Date().toISOString(),
    actor: {
      login: normalizeText(actor.login, 120).toLowerCase(),
      displayName: normalizeText(actor.displayName, 160),
    },
    catalogStructure: normalizedState,
  };
};

const saveCatalogStructureToNeon = async (nextState = {}, actor = {}, tenant) => {
  await ensureCatalogSchema();
  const sql = getSql();
  const stateKey = getScopedStateKey(tenant);
  const normalizedState = normalizeCatalogStructure(nextState);
  const updatedByLogin = normalizeText(actor.login, 120).toLowerCase();
  const updatedByDisplayName = normalizeText(actor.displayName, 160);

  await sql`
    INSERT INTO catalog_runtime_state (
      state_key,
      tenant_id,
      restaurant_id,
      restaurant_key,
      sections,
      section_display_order,
      featured_item_id,
      featured_item_ids,
      updated_at,
      updated_by_login,
      updated_by_display_name
    )
    VALUES (
      ${stateKey},
      ${tenant.tenantId},
      ${tenant.restaurantId},
      ${tenant.restaurantKey},
      ${JSON.stringify(normalizedState.sections)}::jsonb,
      ${JSON.stringify(normalizedState.sectionDisplayOrder)}::jsonb,
      ${normalizedState.featuredItemId},
      ${JSON.stringify(normalizedState.featuredItemIds)}::jsonb,
      NOW(),
      ${updatedByLogin},
      ${updatedByDisplayName}
    )
    ON CONFLICT (tenant_id, restaurant_id, state_key) DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      restaurant_id = EXCLUDED.restaurant_id,
      restaurant_key = EXCLUDED.restaurant_key,
      sections = EXCLUDED.sections,
      section_display_order = EXCLUDED.section_display_order,
      featured_item_id = EXCLUDED.featured_item_id,
      featured_item_ids = EXCLUDED.featured_item_ids,
      updated_at = NOW(),
      updated_by_login = EXCLUDED.updated_by_login,
      updated_by_display_name = EXCLUDED.updated_by_display_name
  `;

  return {
    storageMode: "neon",
    generatedAt: new Date().toISOString(),
    actor: {
      login: updatedByLogin,
      displayName: updatedByDisplayName,
    },
    catalogStructure: normalizedState,
  };
};

const saveCatalogStructureState = async (nextState = {}, actor = {}, tenant) => {
  assertStorageIsAvailable();
  return getStorageMode() === "neon"
    ? saveCatalogStructureToNeon(nextState, actor, tenant)
    : saveCatalogStructureToFileStore(nextState, actor, tenant);
};

const buildCatalogStructureIndex = (sections = []) => {
  const sectionMap = new Map();
  const itemMap = new Map();

  (Array.isArray(sections) ? sections : []).forEach((section) => {
    sectionMap.set(section.id, section);
    (Array.isArray(section.items) ? section.items : []).forEach((item) => {
      itemMap.set(item.id, {
        item,
        section,
      });
    });
  });

  return {
    sectionMap,
    itemMap,
  };
};

const getPromotionRecordsFromFileStore = async (tenant) => {
  const store = await readFileStore();
  return (Array.isArray(store.promotions) ? store.promotions : [])
    .filter((entry) => matchesTenantScope(entry, tenant))
    .map(normalizePromotionRecord);
};

const getPromotionRecordsFromNeon = async (tenant) => {
  await ensureCatalogSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT
      id,
      internal_name,
      scope_type,
      target_value,
      pricing_type,
      fixed_price,
      discount_percent,
      starts_at,
      ends_at,
      is_enabled,
      created_at,
      updated_at,
      updated_by_login,
      updated_by_display_name
    FROM catalog_promotions
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
    ORDER BY starts_at ASC, updated_at DESC
  `;

  return rows.map(normalizePromotionRecord);
};

const getCatalogPromotionRecords = async (tenant) => {
  const storageMode = getStorageMode();

  if (storageMode === "neon") {
    return getPromotionRecordsFromNeon(tenant);
  }

  assertStorageIsAvailable();
  return getPromotionRecordsFromFileStore(tenant);
};

const normalizeCatalogTargetKey = (value) =>
  normalizeText(value, MAX_PROMOTION_TARGET_LENGTH).toLowerCase();

const getPromotionStatus = (promotion, nowTimestamp = Date.now()) => {
  const startsAtMs = new Date(promotion?.startsAt || "").getTime();
  const endsAtMs = new Date(promotion?.endsAt || "").getTime();

  if (!promotion?.isEnabled || !Number.isFinite(startsAtMs) || !Number.isFinite(endsAtMs)) {
    return "ended";
  }

  if (nowTimestamp < startsAtMs) {
    return "scheduled";
  }

  if (nowTimestamp > endsAtMs) {
    return "ended";
  }

  return "active";
};

const getPromotionStatusLabel = (status) => {
  if (status === "active") {
    return "Ativa";
  }

  if (status === "scheduled") {
    return "Agendada";
  }

  return "Encerrada";
};

const getPromotionBadgeLabel = (promotion, savingsPercent) => {
  if (promotion?.pricingType === "percent_discount" && Number.isFinite(promotion?.discountPercent)) {
    return `${Number(promotion.discountPercent)}% OFF`;
  }

  if (Number.isFinite(savingsPercent) && savingsPercent > 0) {
    return `${Number(savingsPercent.toFixed(0))}% OFF`;
  }

  return "Promocao";
};

const getPromotionValueLabel = (promotion) => {
  if (promotion?.pricingType === "percent_discount") {
    return Number.isFinite(promotion?.discountPercent)
      ? `${Number(promotion.discountPercent)}% de desconto`
      : "Desconto percentual";
  }

  return promotion?.fixedPrice !== null && typeof promotion?.fixedPrice !== "undefined"
    ? `Preco fixo de R$ ${Number(promotion.fixedPrice).toFixed(2).replace(".", ",")}`
    : "Preco fixo";
};

const getAvailabilityState = (item) => {
  if (item.isPaused) {
    return "paused";
  }

  if (!item.isAvailable) {
    return "unavailable";
  }

  return "active";
};

const getAvailabilityLabel = (state) => {
  if (state === "paused") {
    return "Pausado";
  }

  if (state === "unavailable") {
    return "Indisponivel";
  }

  return "Ativo";
};

const isItemOrderable = (item) =>
  Boolean(item) &&
  item.isAvailable !== false &&
  item.isPaused !== true &&
  typeof item.price === "number";

const getPromotionPriceForItem = (promotion, regularPrice) => {
  if (!Number.isFinite(regularPrice) || regularPrice <= 0) {
    return null;
  }

  if (promotion?.pricingType === "percent_discount") {
    if (!Number.isFinite(promotion?.discountPercent) || promotion.discountPercent <= 0 || promotion.discountPercent >= 100) {
      return null;
    }

    const discountedPrice = Number(
      (regularPrice * (1 - Number(promotion.discountPercent) / 100)).toFixed(2)
    );

    return discountedPrice < regularPrice ? discountedPrice : null;
  }

  if (!Number.isFinite(promotion?.fixedPrice) || promotion.fixedPrice < 0) {
    return null;
  }

  const fixedPrice = Number(promotion.fixedPrice.toFixed(2));
  return fixedPrice < regularPrice ? fixedPrice : null;
};

const getPromotionScopeMatchesItem = (promotion, item) => {
  if (!promotion || !item) {
    return false;
  }

  if (promotion.scopeType === "item") {
    return promotion.targetValue === item.id;
  }

  if (promotion.scopeType === "category") {
    return normalizeCatalogTargetKey(promotion.targetValue) === normalizeCatalogTargetKey(item.category);
  }

  return false;
};

const buildResolvedPromotionForItem = (promotion, item, regularPrice) => {
  const promotionalPrice = getPromotionPriceForItem(promotion, regularPrice);

  if (!Number.isFinite(promotionalPrice)) {
    return null;
  }

  const savingsAmount = Number((regularPrice - promotionalPrice).toFixed(2));
  const savingsPercent = regularPrice > 0 ? Number(((savingsAmount / regularPrice) * 100).toFixed(2)) : 0;

  return {
    id: promotion.id,
    internalName: promotion.internalName,
    scopeType: promotion.scopeType,
    targetValue: promotion.targetValue,
    pricingType: promotion.pricingType,
    fixedPrice: promotion.fixedPrice,
    discountPercent: promotion.discountPercent,
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
    status: "active",
    statusLabel: getPromotionStatusLabel("active"),
    promotionalPrice,
    originalPrice: regularPrice,
    savingsAmount,
    savingsPercent,
    badgeLabel: getPromotionBadgeLabel(promotion, savingsPercent),
    valueLabel: getPromotionValueLabel(promotion),
    itemId: item.id,
    itemName: item.name,
  };
};

const resolveActivePromotionForItem = (item, promotions, nowTimestamp = Date.now()) => {
  if (!item || !Array.isArray(promotions) || promotions.length === 0) {
    return null;
  }

  if (item.isAvailable === false || item.isPaused === true || !Number.isFinite(item.regularPrice)) {
    return null;
  }

  const activeCandidates = promotions
    .filter((promotion) => getPromotionStatus(promotion, nowTimestamp) === "active")
    .filter((promotion) => getPromotionScopeMatchesItem(promotion, item))
    .map((promotion) => buildResolvedPromotionForItem(promotion, item, item.regularPrice))
    .filter(Boolean)
    .sort((left, right) => {
      if (left.promotionalPrice !== right.promotionalPrice) {
        return left.promotionalPrice - right.promotionalPrice;
      }

      return new Date(left.endsAt).getTime() - new Date(right.endsAt).getTime();
    });

  return activeCandidates[0] || null;
};

const buildMergedCatalogSections = async (options = {}) => {
  const tenant = getOperationalTenant(options, "catalog:merge");
  const { includePromotions = false } = options;
  const catalogStructure = await getCatalogStructureState(tenant);
  const overrideMap = await getCatalogOverrideMap(tenant);
  const promotionRecords = includePromotions ? await getCatalogPromotionRecords(tenant) : [];
  const nowTimestamp = Date.now();
  const sections = cloneJson(catalogStructure.sections);
  const featuredItemIds = normalizeFeaturedItemIds(catalogStructure);
  const featuredItemId = featuredItemIds[0] || "";
  const featuredItemIdsSet = new Set(featuredItemIds);

  sections.forEach((section) => {
    section.items = Array.isArray(section.items)
      ? section.items.map((item) => {
          const override = overrideMap.get(item.id) || null;
          const basePrice =
            typeof item.basePrice === "number"
              ? Number(item.basePrice.toFixed(2))
              : typeof item.price === "number"
                ? Number(item.price.toFixed(2))
                : null;
          const configuredPrice =
            typeof item.price === "number"
              ? Number(item.price.toFixed(2))
              : basePrice;
          const regularPrice =
            override && override.priceOverride !== null ? override.priceOverride : configuredPrice;
          const isAvailable = override ? override.isAvailable : item.isAvailable !== false;
          const isPaused = override ? override.isPaused : item.isPaused === true;
          const manualPromotionFlag = override ? override.isPromoted : item.isPromoted === true;
          const availabilityState = getAvailabilityState({
            isAvailable,
            isPaused,
          });
          const regularItem = {
            ...item,
            basePrice,
            regularPrice,
            price: regularPrice,
            isAvailable,
            isPaused,
            sectionId: section.id,
            sectionTitle: section.title,
          };
          const activePromotion = includePromotions
            ? resolveActivePromotionForItem(regularItem, promotionRecords, nowTimestamp)
            : null;
          const effectivePrice = activePromotion ? activePromotion.promotionalPrice : regularPrice;
          const isPromoted = manualPromotionFlag || Boolean(activePromotion);
          const displayBadge = activePromotion
            ? activePromotion.badgeLabel
            : manualPromotionFlag
              ? "Promocao"
            : availabilityState === "paused"
              ? "Pausado"
              : availabilityState === "unavailable"
                ? "Indisponivel"
                : item.badge || "";

          return {
            ...item,
            basePrice,
            regularPrice,
            price: effectivePrice,
            originalPrice: activePromotion ? regularPrice : null,
            baseBadge: item.badge || "",
            badge: displayBadge,
            isAvailable,
            isPaused,
            isPromoted,
            hasActivePromotion: Boolean(activePromotion),
            activePromotion,
            availabilityState,
            availabilityLabel: getAvailabilityLabel(availabilityState),
            isOrderable: isItemOrderable({
              isAvailable,
              isPaused,
              price: effectivePrice,
            }),
            overrideUpdatedAt: override?.updatedAt || "",
            overrideUpdatedByLogin: override?.updatedByLogin || "",
            overrideUpdatedByDisplayName: override?.updatedByDisplayName || "",
            sectionId: section.id,
            sectionTitle: section.title,
            isHighlighted: featuredItemIdsSet.has(item.id),
          };
        })
      : [];
  });

  return {
    sectionDisplayOrder: [...catalogStructure.sectionDisplayOrder],
    featuredItemId,
    featuredItemIds,
    sections,
  };
};

const getCatalogItemMap = async (options = {}) => {
  const catalog = await buildMergedCatalogSections(options);

  return catalog.sections.reduce((summary, section) => {
    section.items.forEach((item) => {
      summary.set(item.id, item);
    });

    return summary;
  }, new Map());
};

const applyCatalogAdminFilters = (sections, filters = {}) => {
  const query = normalizeText(filters.query || "", 160).toLowerCase();
  const sectionId = normalizeText(filters.sectionId || "", 120);
  const availabilityState = normalizeText(filters.availabilityState || "", 40).toLowerCase();

  return sections
    .filter((section) => !sectionId || section.id === sectionId)
    .map((section) => {
      const filteredItems = section.items.filter((item) => {
        if (availabilityState && item.availabilityState !== availabilityState) {
          return false;
        }

        if (!query) {
          return true;
        }

        const searchableValue = [
          item.id,
          item.name,
          item.category,
          item.sectionTitle,
          item.availabilityLabel,
        ]
          .join(" ")
          .toLowerCase();

        return searchableValue.includes(query);
      });

      const categories = [...new Set(filteredItems.map((item) => item.category).filter(Boolean))];

      return {
        ...section,
        categories,
        visibleItemCount: filteredItems.length,
        items: filteredItems,
      };
    })
    .filter((section) => section.items.length > 0 || !query);
};

const buildCatalogSummary = (sections) => {
  const items = sections.flatMap((section) => section.items);
  const categories = new Set(items.map((item) => item.category).filter(Boolean));

  return {
    totalSections: sections.length,
    totalCategories: categories.size,
    totalItems: items.length,
    activeItems: items.filter((item) => item.availabilityState === "active").length,
    pausedItems: items.filter((item) => item.availabilityState === "paused").length,
    unavailableItems: items.filter((item) => item.availabilityState === "unavailable").length,
    promotedItems: items.filter((item) => item.isPromoted).length,
    highlightedItems: items.filter((item) => item.isHighlighted).length,
    orderableItems: items.filter((item) => item.isOrderable).length,
    itemsWithoutPrice: items.filter((item) => typeof item.price !== "number").length,
  };
};

const getAdminCatalog = async (filters = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "catalog:admin:list");
  const storageMode = getStorageMode();
  assertStorageIsAvailable();
  const catalog = await buildMergedCatalogSections({
    includePromotions: false,
    tenantContext: tenant.tenantContext,
  });
  const sections = applyCatalogAdminFilters(catalog.sections, filters).map((section) => ({
    id: section.id,
    kicker: section.kicker,
    title: section.title,
    description: section.description,
    categories: section.categories,
    itemCount: section.items.length,
    items: section.items,
  }));

  return {
    storageMode,
    generatedAt: new Date().toISOString(),
    filters: {
      query: normalizeText(filters.query || "", 160),
      sectionId: normalizeText(filters.sectionId || "", 120),
      availabilityState: normalizeText(filters.availabilityState || "", 40).toLowerCase(),
    },
    summary: buildCatalogSummary(sections),
    sections,
    sectionDisplayOrder: catalog.sectionDisplayOrder,
    featuredItemId: catalog.featuredItemId,
    featuredItemIds: catalog.featuredItemIds,
    catalogOptions: {
      sections: catalog.sections.map((section) => ({
        id: section.id,
        title: section.title,
      })),
      categories: [
        ...new Set(
          catalog.sections.flatMap((section) =>
            (Array.isArray(section.items) ? section.items : [])
              .map((item) => normalizeText(item.category, MAX_ITEM_CATEGORY_LENGTH))
              .filter(Boolean)
          )
        ),
      ].sort((left, right) => left.localeCompare(right, "pt-BR")),
    },
  };
};

const getPublicCatalogState = async (options = {}) => {
  const tenant = getOperationalTenant(options, "catalog:public:list");
  const catalog = await buildMergedCatalogSections({
    includePromotions: true,
    tenantContext: tenant.tenantContext,
  });
  const publicSections = catalog.sections
    .map((section) => ({
      ...section,
      items: (Array.isArray(section.items) ? section.items : []).filter((item) => item.isPaused !== true),
    }))
    .filter((section) => section.items.length > 0);
  const items = publicSections.flatMap((section) =>
    section.items.map((item) => ({
      id: item.id,
      price: item.price,
      basePrice: item.basePrice,
      regularPrice: item.regularPrice,
      originalPrice: item.originalPrice,
      badge: item.badge || "",
      baseBadge: item.baseBadge || "",
      isAvailable: item.isAvailable,
      isPaused: item.isPaused,
      isPromoted: item.isPromoted,
      hasActivePromotion: Boolean(item.hasActivePromotion),
      activePromotion: item.activePromotion
        ? {
            id: item.activePromotion.id,
            internalName: item.activePromotion.internalName,
            scopeType: item.activePromotion.scopeType,
            targetValue: item.activePromotion.targetValue,
            pricingType: item.activePromotion.pricingType,
            fixedPrice: item.activePromotion.fixedPrice,
            discountPercent: item.activePromotion.discountPercent,
            startsAt: item.activePromotion.startsAt,
            endsAt: item.activePromotion.endsAt,
            promotionalPrice: item.activePromotion.promotionalPrice,
            originalPrice: item.activePromotion.originalPrice,
            savingsAmount: item.activePromotion.savingsAmount,
            savingsPercent: item.activePromotion.savingsPercent,
            badgeLabel: item.activePromotion.badgeLabel,
            valueLabel: item.activePromotion.valueLabel,
          }
        : null,
      availabilityState: item.availabilityState,
      availabilityLabel: item.availabilityLabel,
      isOrderable: item.isOrderable,
      isHighlighted: item.isHighlighted === true,
    }))
  );
  const publicItemMap = publicSections.reduce((summary, section) => {
    (Array.isArray(section.items) ? section.items : []).forEach((item) => {
      summary.set(item.id, item);
    });

    return summary;
  }, new Map());
  const featuredItems = catalog.featuredItemIds
    .map((itemId) => publicItemMap.get(itemId) || null)
    .filter(Boolean);
  const featuredItem = featuredItems[0] || null;
  const featuredItemIds = featuredItems.map((item) => item.id);

  return {
    generatedAt: new Date().toISOString(),
    sectionDisplayOrder: catalog.sectionDisplayOrder,
    sections: publicSections,
    items,
    featuredItemId: featuredItem?.id || "",
    featuredItemIds,
    featuredItem,
    featuredItems,
  };
};

const buildCatalogItemResponse = async (itemId, options = {}) => {
  const itemMap = await getCatalogItemMap(options);
  const item = itemMap.get(itemId);

  if (!item) {
    throw buildHttpError(404, "Nao encontrei o item solicitado no catalogo.", "catalog_item_not_found");
  }

  return item;
};

const assertValidPriceOverride = (value, itemName) => {
  if (value === null) {
    return null;
  }

  if (!Number.isFinite(value)) {
    throw buildHttpError(400, `O preco informado para ${itemName} e invalido.`, "invalid_catalog_price");
  }

  if (value < 0 || value > MAX_ITEM_PRICE) {
    throw buildHttpError(
      400,
      `O preco informado para ${itemName} precisa ficar entre R$ 0,00 e R$ ${MAX_ITEM_PRICE},00.`,
      "invalid_catalog_price_range"
    );
  }

  return Number(value.toFixed(2));
};

const getBaseCatalogItemMap = async () => {
  const baseCatalog = await getBaseCatalogSnapshot();
  const itemMap = new Map();

  baseCatalog.sections.forEach((section) => {
    (Array.isArray(section.items) ? section.items : []).forEach((item) => {
      itemMap.set(item.id, {
        ...normalizeCatalogItemRecord(item),
        sectionId: section.id,
        sectionTitle: section.title,
      });
    });
  });

  return itemMap;
};

const clearCatalogOverridesFromFileStore = async (itemIds = [], tenant) => {
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return;
  }

  const idsToClear = new Set(itemIds.map((itemId) => normalizeText(itemId, 160)).filter(Boolean));

  if (idsToClear.size === 0) {
    return;
  }

  const store = await readFileStore();
  const nextItems = (Array.isArray(store.items) ? store.items : []).filter(
    (entry) =>
      !(
        matchesTenantScope(entry, tenant) &&
        idsToClear.has(normalizeText(entry?.itemId || entry?.item_id, 160))
      )
  );

  if (nextItems.length === (Array.isArray(store.items) ? store.items.length : 0)) {
    return;
  }

  await writeFileStore({
    ...store,
    version: LOCAL_STORE_VERSION,
    items: nextItems,
  });
};

const clearCatalogOverridesFromNeon = async (itemIds = [], tenant) => {
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return;
  }

  const idsToClear = [...new Set(itemIds.map((itemId) => normalizeText(itemId, 160)).filter(Boolean))];

  if (idsToClear.length === 0) {
    return;
  }

  await ensureCatalogSchema();
  const sql = getSql();

  for (const itemId of idsToClear) {
    await sql`
      DELETE FROM catalog_item_overrides
      WHERE item_id = ${itemId}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND restaurant_key = ${tenant.restaurantKey}
    `;
  }
};

const clearCatalogOverrides = async (itemIds = [], tenant) => {
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return;
  }

  return getStorageMode() === "neon"
    ? clearCatalogOverridesFromNeon(itemIds, tenant)
    : clearCatalogOverridesFromFileStore(itemIds, tenant);
};

const assertValidAvailabilityState = (value, fallback = "active") => {
  const availabilityState = normalizeText(value, 40).toLowerCase() || fallback;

  if (!["active", "paused", "unavailable"].includes(availabilityState)) {
    throw buildHttpError(
      400,
      "O estado operacional do item precisa ser ativo, pausado ou indisponivel.",
      "invalid_catalog_availability_state"
    );
  }

  return availabilityState;
};

const saveCatalogSection = async (payload = {}, actor = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "catalog:admin:save-section");
  assertStorageIsAvailable();
  const catalogState = await getCatalogStructureState(tenant);
  const nextSections = cloneJson(catalogState.sections);
  const existingSectionId = normalizeText(payload.sectionId || payload.id, 160);
  const sectionIndex = nextSections.findIndex((section) => section.id === existingSectionId);
  const title = normalizeText(payload.title, MAX_SECTION_TITLE_LENGTH);

  if (!title) {
    throw buildHttpError(400, "Informe o nome da categoria que deseja salvar.", "missing_catalog_section_title");
  }

  const existingIds = new Set(nextSections.map((section) => section.id));

  if (sectionIndex >= 0) {
    existingIds.delete(existingSectionId);
  }

  const nextSectionId =
    sectionIndex >= 0 ? existingSectionId : buildUniqueCatalogId(payload.slug || title, existingIds, "secao");
  const currentSection = sectionIndex >= 0 ? nextSections[sectionIndex] : null;
  const nextSection = normalizeCatalogSectionRecord({
    ...(currentSection || {}),
    id: nextSectionId,
    kicker: normalizeText(payload.kicker, 80),
    title,
    description: normalizeText(payload.description, MAX_SECTION_DESCRIPTION_LENGTH),
    items: currentSection?.items || [],
  });

  if (sectionIndex >= 0) {
    nextSections[sectionIndex] = nextSection;
  } else {
    nextSections.push(nextSection);
  }

  const nextSectionDisplayOrder = catalogState.sectionDisplayOrder.filter((entry) => entry !== existingSectionId);

  if (!nextSectionDisplayOrder.includes(nextSectionId)) {
    nextSectionDisplayOrder.push(nextSectionId);
  }

  const result = await saveCatalogStructureState(
    {
      sections: nextSections,
      sectionDisplayOrder: nextSectionDisplayOrder,
      featuredItemId: catalogState.featuredItemId,
      featuredItemIds: catalogState.featuredItemIds,
    },
    actor,
    tenant
  );

  return {
    storageMode: result.storageMode,
    generatedAt: result.generatedAt,
    message:
      sectionIndex >= 0
        ? `Categoria ${nextSection.title} atualizada com sucesso.`
        : `Categoria ${nextSection.title} criada com sucesso.`,
    sectionId: nextSectionId,
    section: nextSection,
  };
};

const deleteCatalogSection = async (payload = {}, actor = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "catalog:admin:delete-section");
  assertStorageIsAvailable();
  const sectionId = normalizeText(payload.sectionId || payload.id, 160);

  if (!sectionId) {
    throw buildHttpError(400, "Informe a categoria que deseja remover.", "missing_catalog_section");
  }

  const catalogState = await getCatalogStructureState(tenant);
  const nextSections = cloneJson(catalogState.sections);
  const sectionIndex = nextSections.findIndex((section) => section.id === sectionId);

  if (sectionIndex === -1) {
    throw buildHttpError(404, "Nao encontrei a categoria solicitada.", "catalog_section_not_found");
  }

  const removedSection = nextSections.splice(sectionIndex, 1)[0];
  const removedItemIds = (Array.isArray(removedSection?.items) ? removedSection.items : []).map((item) => item.id);
  const nextFeaturedItemIds = normalizeFeaturedItemIds(catalogState).filter((itemId) => !removedItemIds.includes(itemId));
  const result = await saveCatalogStructureState(
    {
      sections: nextSections,
      sectionDisplayOrder: catalogState.sectionDisplayOrder.filter((entry) => entry !== sectionId),
      featuredItemId: nextFeaturedItemIds[0] || "",
      featuredItemIds: nextFeaturedItemIds,
    },
    actor,
    tenant
  );

  await clearCatalogOverrides(removedItemIds, tenant);

  return {
    storageMode: result.storageMode,
    generatedAt: result.generatedAt,
    message: `Categoria ${removedSection.title} removida com sucesso.`,
    sectionId,
  };
};

const saveCatalogItem = async (payload = {}, actor = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "catalog:admin:save-item");
  assertStorageIsAvailable();
  const catalogState = await getCatalogStructureState(tenant);
  const nextSections = cloneJson(catalogState.sections);
  const { sectionMap, itemMap } = buildCatalogStructureIndex(nextSections);
  const requestedItemId = normalizeText(payload.itemId || payload.id, 160);
  const requestedSectionId = normalizeText(payload.sectionId, 160);
  const currentEntry = requestedItemId ? itemMap.get(requestedItemId) || null : null;
  const targetSectionId = requestedSectionId || currentEntry?.section?.id || "";
  const targetSection = sectionMap.get(targetSectionId) || null;

  if (!targetSection) {
    throw buildHttpError(400, "Escolha a categoria em que o prato deve aparecer.", "missing_catalog_item_section");
  }

  const name = normalizeText(payload.name, MAX_ITEM_NAME_LENGTH);

  if (!name) {
    throw buildHttpError(400, "Informe o nome do prato que deseja salvar.", "missing_catalog_item_name");
  }

  const existingIds = new Set(itemMap.keys());

  if (currentEntry?.item?.id) {
    existingIds.delete(currentEntry.item.id);
  }

  const nextItemId =
    currentEntry?.item?.id || buildUniqueCatalogId(payload.slug || name, existingIds, "item");
  const currentFeaturedItemIds = normalizeFeaturedItemIds(catalogState);
  const availabilityState = assertValidAvailabilityState(
    payload.availabilityState || currentEntry?.item?.availabilityState || "active"
  );
  const baseItemMap = await getBaseCatalogItemMap();
  const baseItem = currentEntry?.item?.id ? baseItemMap.get(currentEntry.item.id) || null : null;
  const nextPrice = assertValidPriceOverride(
    toMoneyOrNull(
      Object.prototype.hasOwnProperty.call(payload, "price")
        ? payload.price
        : currentEntry?.item?.regularPrice ?? currentEntry?.item?.price
    ),
    name
  );
  const nextItem = normalizeCatalogItemRecord({
    ...(baseItem || {}),
    ...(currentEntry?.item || {}),
    id: nextItemId,
    name,
    category: normalizeText(
      payload.category || currentEntry?.item?.category || targetSection.title,
      MAX_ITEM_CATEGORY_LENGTH
    ),
    description: normalizeText(
      payload.description || currentEntry?.item?.description,
      MAX_ITEM_DESCRIPTION_LENGTH
    ),
    detail: normalizeText(payload.detail || currentEntry?.item?.detail, MAX_ITEM_DETAIL_LENGTH),
    image: normalizeLongText(payload.image ?? currentEntry?.item?.image, MAX_IMAGE_VALUE_LENGTH),
    badge: normalizeText(
      payload.badge || currentEntry?.item?.badge || baseItem?.badge || "Consulte",
      MAX_ITEM_BADGE_LENGTH
    ),
    price: nextPrice,
    basePrice:
      baseItem?.price ??
      currentEntry?.item?.basePrice ??
      currentEntry?.item?.price ??
      nextPrice,
    isAvailable: availabilityState !== "unavailable",
    isPaused: availabilityState === "paused",
    isPromoted: currentEntry?.item?.isPromoted === true,
  });
  const wantsHighlight = normalizeBoolean(
    payload.isHighlighted ?? payload.isFeatured ?? payload.isPromoted,
    currentEntry?.item?.isHighlighted === true || currentFeaturedItemIds.includes(nextItemId)
  );
  const nextFeaturedItemIds = currentFeaturedItemIds.filter((itemId) => itemId !== nextItemId);

  if (wantsHighlight && nextFeaturedItemIds.length >= MAX_FEATURED_HOME_ITEMS) {
    throw buildHttpError(
      400,
      `Voce pode destacar ate ${MAX_FEATURED_HOME_ITEMS} pratos na home. Remova um destaque atual para incluir outro item.`,
      "catalog_highlight_limit_reached"
    );
  }

  if (wantsHighlight) {
    nextFeaturedItemIds.unshift(nextItemId);
  }

  if (currentEntry) {
    currentEntry.section.items = currentEntry.section.items.filter((item) => item.id !== currentEntry.item.id);
  }

  targetSection.items = [...(Array.isArray(targetSection.items) ? targetSection.items : []), nextItem];

  const result = await saveCatalogStructureState(
    {
      sections: nextSections,
      sectionDisplayOrder: catalogState.sectionDisplayOrder,
      featuredItemId: nextFeaturedItemIds[0] || "",
      featuredItemIds: nextFeaturedItemIds,
    },
    actor,
    tenant
  );

  await clearCatalogOverrides(
    currentEntry?.item?.id ? [currentEntry.item.id, nextItem.id] : [nextItem.id],
    tenant
  );

  return {
    storageMode: result.storageMode,
    generatedAt: result.generatedAt,
    message:
      currentEntry && currentEntry.item
        ? `Prato ${nextItem.name} atualizado com sucesso.`
        : `Prato ${nextItem.name} criado com sucesso.`,
    item: await buildCatalogItemResponse(nextItem.id, { tenantContext: tenant.tenantContext }),
  };
};

const deleteCatalogItem = async (payload = {}, actor = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "catalog:admin:delete-item");
  assertStorageIsAvailable();
  const itemId = normalizeText(payload.itemId || payload.id, 160);

  if (!itemId) {
    throw buildHttpError(400, "Informe o prato que deseja remover.", "missing_catalog_item");
  }

  const catalogState = await getCatalogStructureState(tenant);
  const nextSections = cloneJson(catalogState.sections);
  const { itemMap } = buildCatalogStructureIndex(nextSections);
  const currentEntry = itemMap.get(itemId) || null;

  if (!currentEntry) {
    throw buildHttpError(404, "Nao encontrei o prato solicitado no catalogo.", "catalog_item_not_found");
  }

  currentEntry.section.items = currentEntry.section.items.filter((item) => item.id !== itemId);
  const nextFeaturedItemIds = normalizeFeaturedItemIds(catalogState).filter(
    (featuredItemId) => featuredItemId !== itemId
  );
  const result = await saveCatalogStructureState(
    {
      sections: nextSections,
      sectionDisplayOrder: catalogState.sectionDisplayOrder,
      featuredItemId: nextFeaturedItemIds[0] || "",
      featuredItemIds: nextFeaturedItemIds,
    },
    actor,
    tenant
  );

  await clearCatalogOverrides([itemId], tenant);

  return {
    storageMode: result.storageMode,
    generatedAt: result.generatedAt,
    message: `Prato ${currentEntry.item.name} removido com sucesso.`,
    itemId,
  };
};

const updateCatalogItem = async (payload = {}, actor = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "catalog:admin:update-item");
  const itemId = normalizeText(payload.itemId || payload.id, 160);

  if (!itemId) {
    throw buildHttpError(400, "Informe o item que deseja atualizar no catalogo.", "missing_catalog_item");
  }

  const currentItem = await buildCatalogItemResponse(itemId, { tenantContext: tenant.tenantContext });
  const baseCatalogItemMap = await getBaseCatalogItemMap();
  const baseItem = baseCatalogItemMap.get(itemId) || null;
  const hasHighlightValue =
    Object.prototype.hasOwnProperty.call(payload, "isHighlighted") ||
    Object.prototype.hasOwnProperty.call(payload, "isFeatured") ||
    Object.prototype.hasOwnProperty.call(payload, "isPromoted");
  const nextPrice = normalizeBoolean(payload.resetPrice, false)
    ? baseItem?.price ?? currentItem.basePrice
    : Object.prototype.hasOwnProperty.call(payload, "price")
      ? payload.price
      : currentItem.regularPrice ?? currentItem.price;

  return saveCatalogItem(
    {
      itemId,
      sectionId: currentItem.sectionId,
      name: payload.name ?? currentItem.name,
      category: payload.category ?? currentItem.category,
      description: payload.description ?? currentItem.description,
      detail: payload.detail ?? currentItem.detail,
      image: payload.image ?? currentItem.image,
      badge: payload.badge ?? currentItem.baseBadge ?? currentItem.badge,
      availabilityState: payload.availabilityState ?? currentItem.availabilityState,
      price: nextPrice,
      isHighlighted: hasHighlightValue ? payload.isHighlighted ?? payload.isFeatured ?? payload.isPromoted : currentItem.isHighlighted,
    },
    actor,
    { tenantContext: tenant.tenantContext }
  );
};

const assertValidDiscountPercent = (value, promotionName) => {
  if (!Number.isFinite(value)) {
    throw buildHttpError(
      400,
      `O desconto percentual informado para ${promotionName} e invalido.`,
      "invalid_promotion_discount"
    );
  }

  if (value <= 0 || value >= 100) {
    throw buildHttpError(
      400,
      `O desconto de ${promotionName} precisa ficar entre 0,01% e 99,99%.`,
      "invalid_promotion_discount_range"
    );
  }

  return Number(value.toFixed(2));
};

const getRegularCatalogItems = async (options = {}) => {
  const tenant = getOperationalTenant(options, "catalog:regular-items");
  const catalog = await buildMergedCatalogSections({
    includePromotions: false,
    tenantContext: tenant.tenantContext,
  });
  return catalog.sections.flatMap((section) => section.items);
};

const getPromotionTargetItems = async (scopeType, targetValue, options = {}) => {
  const items = await getRegularCatalogItems(options);

  if (scopeType === "item") {
    return items.filter((item) => item.id === targetValue);
  }

  if (scopeType === "category") {
    const normalizedTarget = normalizeCatalogTargetKey(targetValue);
    return items.filter((item) => normalizeCatalogTargetKey(item.category) === normalizedTarget);
  }

  return [];
};

const getPromotionTargetLabel = (scopeType, targetValue, targetItems) => {
  if (scopeType === "item") {
    return targetItems[0]?.name || targetValue;
  }

  if (scopeType === "category") {
    return targetItems[0]?.category || targetValue;
  }

  return targetValue;
};

const assertPromotionPriceCoherence = (promotionDraft, targetItems, promotionName) => {
  const referenceItems = targetItems.filter((item) => Number.isFinite(item.regularPrice));

  if (referenceItems.length === 0) {
    throw buildHttpError(
      400,
      `Nao encontrei preco base valido para aplicar ${promotionName}.`,
      "promotion_target_without_price"
    );
  }

  if (promotionDraft.pricingType === "fixed_price") {
    const invalidItem = referenceItems.find((item) => Number(item.regularPrice) <= Number(promotionDraft.fixedPrice));

    if (invalidItem) {
      throw buildHttpError(
        400,
        `O preco promocional de ${promotionName} precisa ser menor que o preco regular de ${invalidItem.name}.`,
        "invalid_promotion_fixed_price_conflict"
      );
    }
  }
};

const getPromotionRecordById = async (promotionId, tenant) => {
  const records = await getCatalogPromotionRecords(tenant);
  return records.find((record) => record.id === promotionId) || null;
};

const normalizePromotionMutation = async (payload = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "catalog:promotion:normalize");
  const existingPromotionId = normalizeText(payload.id, 120);
  const internalName = normalizeText(
    payload.internalName || payload.name,
    MAX_PROMOTION_NAME_LENGTH
  );
  const scopeType = normalizeText(payload.scopeType || payload.targetType, 30).toLowerCase();
  const targetValue = normalizeText(
    payload.targetValue || payload.itemId || payload.category,
    MAX_PROMOTION_TARGET_LENGTH
  );
  const pricingType = normalizeText(payload.pricingType || payload.type, 30).toLowerCase();
  const startsAt = normalizeDateTimeValue(payload.startsAt || payload.startAt || payload.startDateTime);
  const endsAt = normalizeDateTimeValue(payload.endsAt || payload.endAt || payload.endDateTime);
  const isEnabled = normalizeBoolean(payload.isEnabled, true);

  if (!internalName) {
    throw buildHttpError(400, "Informe o nome interno da promocao.", "missing_promotion_name");
  }

  if (!["item", "category"].includes(scopeType)) {
    throw buildHttpError(
      400,
      "A promocao precisa ser vinculada a um item ou categoria.",
      "invalid_promotion_scope"
    );
  }

  if (!targetValue) {
    throw buildHttpError(
      400,
      "Selecione o item ou a categoria vinculada a promocao.",
      "missing_promotion_target"
    );
  }

  if (!["fixed_price", "percent_discount"].includes(pricingType)) {
    throw buildHttpError(
      400,
      "O tipo da promocao precisa ser preco fixo ou desconto percentual.",
      "invalid_promotion_pricing_type"
    );
  }

  if (!startsAt || !endsAt) {
    throw buildHttpError(
      400,
      "Informe data e hora de inicio e termino da promocao.",
      "missing_promotion_schedule"
    );
  }

  if (new Date(startsAt).getTime() >= new Date(endsAt).getTime()) {
    throw buildHttpError(
      400,
      "A data final da promocao precisa ser posterior ao inicio.",
      "invalid_promotion_schedule_range"
    );
  }

  const fixedPrice =
    pricingType === "fixed_price"
      ? assertValidPriceOverride(
          toMoneyOrNull(payload.fixedPrice ?? payload.promotionalPrice ?? payload.price),
          internalName
        )
      : null;
  const discountPercent =
    pricingType === "percent_discount"
      ? assertValidDiscountPercent(
          normalizePositivePercent(payload.discountPercent ?? payload.percentDiscount),
          internalName
        )
      : null;

  if (pricingType === "fixed_price" && fixedPrice === null) {
    throw buildHttpError(
      400,
      "Informe o preco promocional fixo da campanha.",
      "missing_promotion_fixed_price"
    );
  }

  const targetItems = await getPromotionTargetItems(scopeType, targetValue, {
    tenantContext: tenant.tenantContext,
  });

  if (targetItems.length === 0) {
    throw buildHttpError(
      400,
      "Nao encontrei itens validos para vincular a promocao.",
      "promotion_target_not_found"
    );
  }

  const nextPromotion = {
    id: existingPromotionId || crypto.randomUUID(),
    internalName,
    scopeType,
    targetValue,
    pricingType,
    fixedPrice,
    discountPercent,
    startsAt,
    endsAt,
    isEnabled,
  };

  assertPromotionPriceCoherence(nextPromotion, targetItems, internalName);

  return {
    nextPromotion,
    targetItems,
    targetLabel: getPromotionTargetLabel(scopeType, targetValue, targetItems),
  };
};

const buildPromotionAdminRecord = (promotion, catalogItems, nowTimestamp = Date.now()) => {
  const matchedItems = catalogItems.filter((item) => getPromotionScopeMatchesItem(promotion, item));
  const appliedItems =
    getPromotionStatus(promotion, nowTimestamp) === "active"
      ? matchedItems
          .map((item) => resolveActivePromotionForItem(item, [promotion], nowTimestamp))
          .filter(Boolean)
      : [];
  const targetLabel = getPromotionTargetLabel(promotion.scopeType, promotion.targetValue, matchedItems);
  const status = getPromotionStatus(promotion, nowTimestamp);

  return {
    ...promotion,
    status,
    statusLabel: getPromotionStatusLabel(status),
    targetLabel,
    pricingLabel: getPromotionValueLabel(promotion),
    scopeLabel: promotion.scopeType === "category" ? "Categoria" : "Item",
    affectedItemsCount: matchedItems.length,
    appliedItemsCount: appliedItems.length,
    affectedItems: matchedItems.slice(0, 8).map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category || "",
      regularPrice: item.regularPrice,
      availabilityState: item.availabilityState,
    })),
    affectedItemsPreview: matchedItems.slice(0, 4).map((item) => item.name),
    activePricePreview:
      promotion.pricingType === "fixed_price"
        ? promotion.fixedPrice
        : appliedItems[0]?.promotionalPrice || null,
  };
};

const buildPromotionSummary = (promotions) => ({
  totalPromotions: promotions.length,
  activePromotions: promotions.filter((promotion) => promotion.status === "active").length,
  scheduledPromotions: promotions.filter((promotion) => promotion.status === "scheduled").length,
  endedPromotions: promotions.filter((promotion) => promotion.status === "ended").length,
  enabledPromotions: promotions.filter((promotion) => promotion.isEnabled).length,
  affectedItems: promotions.reduce((sum, promotion) => sum + Number(promotion.affectedItemsCount || 0), 0),
});

const getPromotionCatalogOptions = async (options = {}) => {
  const tenant = getOperationalTenant(options, "catalog:promotion-options");
  const catalog = await buildMergedCatalogSections({
    includePromotions: false,
    tenantContext: tenant.tenantContext,
  });
  const items = catalog.sections.flatMap((section) =>
    section.items.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category || "",
      sectionId: section.id,
      sectionTitle: section.title,
      regularPrice: item.regularPrice,
      availabilityState: item.availabilityState,
      availabilityLabel: item.availabilityLabel,
    }))
  );
  const categories = [...new Map(
    items
      .filter((item) => item.category)
      .map((item) => [
        normalizeCatalogTargetKey(item.category),
        {
          value: item.category,
          label: item.category,
          itemsCount: items.filter((entry) => normalizeCatalogTargetKey(entry.category) === normalizeCatalogTargetKey(item.category)).length,
        },
      ])
  ).values()].sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));

  return {
    items,
    categories,
  };
};

const getAdminPromotions = async (filters = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "catalog:admin:promotions");
  const storageMode = getStorageMode();
  assertStorageIsAvailable();
  const catalogItems = await getRegularCatalogItems({ tenantContext: tenant.tenantContext });
  const promotions = (await getCatalogPromotionRecords(tenant))
    .map((promotion) => buildPromotionAdminRecord(promotion, catalogItems))
    .sort((left, right) => {
      const leftPriority = left.status === "active" ? 0 : left.status === "scheduled" ? 1 : 2;
      const rightPriority = right.status === "active" ? 0 : right.status === "scheduled" ? 1 : 2;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
    });
  const catalogOptions = await getPromotionCatalogOptions({ tenantContext: tenant.tenantContext });

  return {
    storageMode,
    generatedAt: new Date().toISOString(),
    filters: {
      status: normalizeText(filters.status || "", 40).toLowerCase(),
    },
    summary: buildPromotionSummary(promotions),
    promotions,
    catalogOptions,
  };
};

const savePromotionInFileStore = async (payload = {}, actor = {}, tenant) => {
  const mutation = await normalizePromotionMutation(payload, {
    tenantContext: tenant.tenantContext,
  });
  const store = await readFileStore();
  const now = new Date().toISOString();
  const existingIndex = (Array.isArray(store.promotions) ? store.promotions : []).findIndex(
    (entry) =>
      normalizeText(entry?.id, 120) === mutation.nextPromotion.id &&
      matchesTenantScope(entry, tenant)
  );
  const nextRecord = {
    tenantId: tenant.tenantId,
    restaurantId: tenant.restaurantId,
    restaurantKey: tenant.restaurantKey,
    ...mutation.nextPromotion,
    createdAt:
      existingIndex >= 0
        ? normalizeDateTimeValue(store.promotions[existingIndex]?.createdAt)
        : now,
    updatedAt: now,
    updatedByLogin: normalizeText(actor.login, 120).toLowerCase(),
    updatedByDisplayName: normalizeText(actor.displayName, 160),
  };
  const nextPromotions = Array.isArray(store.promotions) ? store.promotions.slice() : [];

  if (existingIndex >= 0) {
    nextPromotions[existingIndex] = nextRecord;
  } else {
    nextPromotions.push(nextRecord);
  }

  await writeFileStore({
    ...store,
    version: LOCAL_STORE_VERSION,
    promotions: nextPromotions,
  });

  return {
    storageMode: "file",
    generatedAt: now,
    message: `Promocao ${mutation.nextPromotion.internalName} salva com sucesso.`,
    promotionId: mutation.nextPromotion.id,
  };
};

const savePromotionInNeon = async (payload = {}, actor = {}, tenant) => {
  const mutation = await normalizePromotionMutation(payload, {
    tenantContext: tenant.tenantContext,
  });
  await ensureCatalogSchema();
  const sql = getSql();
  const updatedByLogin = normalizeText(actor.login, 120).toLowerCase();
  const updatedByDisplayName = normalizeText(actor.displayName, 160);

  await sql`
    INSERT INTO catalog_promotions (
      id,
      tenant_id,
      restaurant_id,
      restaurant_key,
      internal_name,
      scope_type,
      target_value,
      pricing_type,
      fixed_price,
      discount_percent,
      starts_at,
      ends_at,
      is_enabled,
      created_at,
      updated_at,
      updated_by_login,
      updated_by_display_name
    )
    VALUES (
      ${mutation.nextPromotion.id},
      ${tenant.tenantId},
      ${tenant.restaurantId},
      ${tenant.restaurantKey},
      ${mutation.nextPromotion.internalName},
      ${mutation.nextPromotion.scopeType},
      ${mutation.nextPromotion.targetValue},
      ${mutation.nextPromotion.pricingType},
      ${mutation.nextPromotion.fixedPrice},
      ${mutation.nextPromotion.discountPercent},
      ${mutation.nextPromotion.startsAt},
      ${mutation.nextPromotion.endsAt},
      ${mutation.nextPromotion.isEnabled},
      COALESCE((
        SELECT created_at
        FROM catalog_promotions
        WHERE id = ${mutation.nextPromotion.id}
          AND tenant_id = ${tenant.tenantId}
          AND restaurant_id = ${tenant.restaurantId}
          AND restaurant_key = ${tenant.restaurantKey}
      ), NOW()),
      NOW(),
      ${updatedByLogin},
      ${updatedByDisplayName}
    )
    ON CONFLICT (tenant_id, restaurant_id, id) DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      restaurant_id = EXCLUDED.restaurant_id,
      restaurant_key = EXCLUDED.restaurant_key,
      internal_name = EXCLUDED.internal_name,
      scope_type = EXCLUDED.scope_type,
      target_value = EXCLUDED.target_value,
      pricing_type = EXCLUDED.pricing_type,
      fixed_price = EXCLUDED.fixed_price,
      discount_percent = EXCLUDED.discount_percent,
      starts_at = EXCLUDED.starts_at,
      ends_at = EXCLUDED.ends_at,
      is_enabled = EXCLUDED.is_enabled,
      updated_at = NOW(),
      updated_by_login = EXCLUDED.updated_by_login,
      updated_by_display_name = EXCLUDED.updated_by_display_name
  `;

  return {
    storageMode: "neon",
    generatedAt: new Date().toISOString(),
    message: `Promocao ${mutation.nextPromotion.internalName} salva com sucesso.`,
    promotionId: mutation.nextPromotion.id,
  };
};

const savePromotion = async (payload = {}, actor = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "catalog:admin:save-promotion");
  assertStorageIsAvailable();
  return getStorageMode() === "neon"
    ? savePromotionInNeon(payload, actor, tenant)
    : savePromotionInFileStore(payload, actor, tenant);
};

const togglePromotionEnabledInFileStore = async (payload = {}, actor = {}, tenant) => {
  const promotionId = normalizeText(payload.id, 120);
  const nextEnabledState = normalizeBoolean(payload.isEnabled, true);
  const store = await readFileStore();
  const promotions = Array.isArray(store.promotions) ? store.promotions.slice() : [];
  const promotionIndex = promotions.findIndex(
    (entry) => normalizeText(entry?.id, 120) === promotionId && matchesTenantScope(entry, tenant)
  );

  if (promotionIndex === -1) {
    throw buildHttpError(404, "Nao encontrei a promocao solicitada.", "promotion_not_found");
  }

  promotions[promotionIndex] = {
    ...normalizePromotionRecord(promotions[promotionIndex]),
    tenantId: tenant.tenantId,
    restaurantId: tenant.restaurantId,
    restaurantKey: tenant.restaurantKey,
    isEnabled: nextEnabledState,
    updatedAt: new Date().toISOString(),
    updatedByLogin: normalizeText(actor.login, 120).toLowerCase(),
    updatedByDisplayName: normalizeText(actor.displayName, 160),
  };

  await writeFileStore({
    ...store,
    version: LOCAL_STORE_VERSION,
    promotions,
  });

  return {
    storageMode: "file",
    generatedAt: new Date().toISOString(),
    message: `Promocao ${nextEnabledState ? "ativada" : "desativada"} com sucesso.`,
    promotionId,
  };
};

const togglePromotionEnabledInNeon = async (payload = {}, actor = {}, tenant) => {
  const promotionId = normalizeText(payload.id, 120);
  const nextEnabledState = normalizeBoolean(payload.isEnabled, true);

  if (!promotionId) {
    throw buildHttpError(400, "Informe a promocao que deseja atualizar.", "missing_promotion_id");
  }

  await ensureCatalogSchema();
  const sql = getSql();
  const rows = await sql`
    UPDATE catalog_promotions
    SET
      is_enabled = ${nextEnabledState},
      updated_at = NOW(),
      updated_by_login = ${normalizeText(actor.login, 120).toLowerCase()},
      updated_by_display_name = ${normalizeText(actor.displayName, 160)}
    WHERE id = ${promotionId}
      AND tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
    RETURNING id
  `;

  if (rows.length === 0) {
    throw buildHttpError(404, "Nao encontrei a promocao solicitada.", "promotion_not_found");
  }

  return {
    storageMode: "neon",
    generatedAt: new Date().toISOString(),
    message: `Promocao ${nextEnabledState ? "ativada" : "desativada"} com sucesso.`,
    promotionId,
  };
};

const togglePromotionEnabled = async (payload = {}, actor = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "catalog:admin:toggle-promotion");
  assertStorageIsAvailable();
  return getStorageMode() === "neon"
    ? togglePromotionEnabledInNeon(payload, actor, tenant)
    : togglePromotionEnabledInFileStore(payload, actor, tenant);
};

const deletePromotionInFileStore = async (payload = {}, tenant) => {
  const promotionId = normalizeText(payload.id, 120);
  const store = await readFileStore();
  const nextPromotions = (Array.isArray(store.promotions) ? store.promotions : []).filter(
    (entry) =>
      !(normalizeText(entry?.id, 120) === promotionId && matchesTenantScope(entry, tenant))
  );

  if (nextPromotions.length === (Array.isArray(store.promotions) ? store.promotions.length : 0)) {
    throw buildHttpError(404, "Nao encontrei a promocao solicitada.", "promotion_not_found");
  }

  await writeFileStore({
    ...store,
    version: LOCAL_STORE_VERSION,
    promotions: nextPromotions,
  });

  return {
    storageMode: "file",
    generatedAt: new Date().toISOString(),
    message: "Promocao removida com sucesso.",
    promotionId,
  };
};

const deletePromotionInNeon = async (payload = {}, tenant) => {
  const promotionId = normalizeText(payload.id, 120);
  await ensureCatalogSchema();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM catalog_promotions
    WHERE id = ${promotionId}
      AND tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
    RETURNING id
  `;

  if (rows.length === 0) {
    throw buildHttpError(404, "Nao encontrei a promocao solicitada.", "promotion_not_found");
  }

  return {
    storageMode: "neon",
    generatedAt: new Date().toISOString(),
    message: "Promocao removida com sucesso.",
    promotionId,
  };
};

const deletePromotion = async (payload = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "catalog:admin:delete-promotion");
  assertStorageIsAvailable();
  return getStorageMode() === "neon"
    ? deletePromotionInNeon(payload, tenant)
    : deletePromotionInFileStore(payload, tenant);
};

const getCatalogValidationContext = async (options = {}) => ({
  itemMap: await getCatalogItemMap({ ...options, includePromotions: true }),
});

module.exports = {
  deleteCatalogItem,
  deleteCatalogSection,
  getAdminCatalog,
  getAdminPromotions,
  getCatalogValidationContext,
  getPublicCatalogState,
  saveCatalogItem,
  saveCatalogSection,
  deletePromotion,
  savePromotion,
  togglePromotionEnabled,
  updateCatalogItem,
};
