const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { neon } = require("./tenant-sql.cjs");
const {
  assertMigrationManagedRelations,
} = require("./database-schema.cjs");
const { buildHttpError } = require("./http.cjs");
const { getOperationalTenant } = require("./tenant-context.cjs");

const LOCAL_STORAGE_FILE = path.join(process.cwd(), ".data", "delivery-settings.json");
const LOCAL_STORE_VERSION = 1;
const SETTINGS_KEY = "default";
const MAX_TEXT_LENGTH = 360;
const COURIER_PAYOUT_MODES = new Set(["fixed_by_band", "percentage_fee", "manual"]);

let sqlClient = null;
let schemaReadyPromise = null;

const cloneJson = (value) => JSON.parse(JSON.stringify(value));

const DEFAULT_DELIVERY_SETTINGS = Object.freeze({
  distanceBands: [
    {
      id: "band-up-to-1-9",
      minKm: 0,
      maxKm: 1.9,
      customerFee: 9,
      courierFee: 0,
      minimumOrder: 0,
      isActive: true,
    },
    {
      id: "band-up-to-6-9",
      minKm: 1.9,
      maxKm: 6.9,
      customerFee: 10,
      courierFee: 0,
      minimumOrder: 0,
      isActive: true,
    },
    {
      id: "band-up-to-10-9",
      minKm: 6.9,
      maxKm: 10.9,
      customerFee: 12,
      courierFee: 0,
      minimumOrder: 0,
      isActive: true,
    },
    {
      id: "band-up-to-14-9",
      minKm: 10.9,
      maxKm: 14.9,
      customerFee: 15,
      courierFee: 0,
      minimumOrder: 0,
      isActive: true,
    },
  ],
  deliveryTime: {
    minMinutes: 40,
    maxMinutes: 60,
    message: "Entrega estimada entre 40 e 60 minutos",
  },
  serviceArea: {
    maxRadiusKm: 14.9,
    servedNeighborhoods: [],
    blockedNeighborhoods: [],
    outOfAreaMessage: "No momento nao entregamos nessa regiao.",
  },
  freeShipping: {
    enabled: false,
    minimumOrder: 120,
    appliesToAllBands: true,
    bandIds: [],
  },
  pickup: {
    enabled: true,
    estimateMinutes: 25,
    message: "Retirada disponivel em 25 minutos",
  },
  status: {
    deliveriesEnabled: true,
    pausedMessage: "Entregas pausadas temporariamente. Retirada no balcao disponivel.",
  },
  couriers: [],
  courierPayout: {
    mode: "fixed_by_band",
    percentage: 0,
    manualAmount: 0,
  },
  updatedAt: "",
  updatedByLogin: "",
  updatedByDisplayName: "",
});

const getDefaultDeliverySettings = () => cloneJson(DEFAULT_DELIVERY_SETTINGS);

const getEmptyLocalStore = () => ({
  version: LOCAL_STORE_VERSION,
  tenantId: "tenant_default",
  restaurantId: "restaurant_default",
  restaurantKey: "default",
  settings: getDefaultDeliverySettings(),
  tenants: {},
});

const getScopedSettingsKey = (tenant) =>
  tenant.isDefaultTenant ? SETTINGS_KEY : `${tenant.restaurantKey}:${SETTINGS_KEY}`;

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
      "DATABASE_URL ainda nao foi configurada. As configuracoes de entrega precisam de armazenamento persistente.",
      "delivery_settings_storage_unavailable"
    );
  }
};

const getSql = () => {
  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }

  return sqlClient;
};

const ensureDeliverySettingsSchema = async () => {
  if (schemaReadyPromise) {
    return schemaReadyPromise;
  }

  const sql = getSql();
  schemaReadyPromise = (async () => {
    if (
      await assertMigrationManagedRelations({
        sql,
        relations: ["delivery_settings"],
        component: "configuracoes de entrega",
      })
    ) {
      return;
    }

    await sql`
      CREATE TABLE IF NOT EXISTS delivery_settings (
        settings_key TEXT NOT NULL,
        tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
        restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default',
        restaurant_key TEXT NOT NULL DEFAULT 'default',
        settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by_login TEXT NOT NULL DEFAULT '',
        updated_by_display_name TEXT NOT NULL DEFAULT ''
      )
    `;

    await sql`
      ALTER TABLE delivery_settings
      ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default'
    `;

    await sql`
      ALTER TABLE delivery_settings
      ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default'
    `;

    await sql`
      ALTER TABLE delivery_settings
      ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default'
    `;

    await sql`
      ALTER TABLE delivery_settings
      DROP CONSTRAINT IF EXISTS delivery_settings_pkey
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS delivery_settings_updated_at_idx
      ON delivery_settings (updated_at DESC)
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS delivery_settings_tenant_restaurant_settings_uidx
      ON delivery_settings (tenant_id, restaurant_id, settings_key)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS delivery_settings_tenant_restaurant_updated_idx
      ON delivery_settings (tenant_id, restaurant_id, updated_at DESC)
    `;
  })();

  return schemaReadyPromise;
};

const ensureFileStore = async () => {
  await fs.mkdir(path.dirname(LOCAL_STORAGE_FILE), { recursive: true });

  try {
    await fs.access(LOCAL_STORAGE_FILE);
  } catch (error) {
    await fs.writeFile(LOCAL_STORAGE_FILE, JSON.stringify(getEmptyLocalStore(), null, 2));
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
      settings: normalizeDeliverySettings(parsed?.settings || {}),
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
  await fs.mkdir(path.dirname(LOCAL_STORAGE_FILE), { recursive: true });
  await fs.writeFile(
    LOCAL_STORAGE_FILE,
    JSON.stringify(
      {
        ...getEmptyLocalStore(),
        ...(store && typeof store === "object" ? store : {}),
        tenantId: normalizeText(store?.tenantId || store?.tenant_id, 120) || "tenant_default",
        restaurantId: normalizeText(store?.restaurantId || store?.restaurant_id, 120) || "restaurant_default",
        restaurantKey: normalizeText(store?.restaurantKey || store?.restaurant_key, 120) || "default",
        settings: normalizeDeliverySettings(store?.settings || {}),
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

const normalizeText = (value, maxLength = MAX_TEXT_LENGTH) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const normalizeListText = (value, maxLength = 120) =>
  normalizeText(value, maxLength)
    .replace(/^[-*]\s*/, "")
    .trim();

const normalizeTextList = (value) => {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/\r?\n|;/g)
        .flatMap((entry) => entry.split(","));

  return [
    ...new Set(
      source
        .map((entry) => normalizeListText(entry))
        .filter(Boolean)
    ),
  ].slice(0, 80);
};

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  const normalizedValue = String(value || "").trim().toLowerCase();

  if (["true", "1", "yes", "sim", "on"].includes(normalizedValue)) {
    return true;
  }

  if (["false", "0", "no", "nao", "off"].includes(normalizedValue)) {
    return false;
  }

  return fallback;
};

const toNumberOrNull = (value) => {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const normalizedValue = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=.*\.)/g, "")
    .replace(",", ".");
  const numericValue = Number(normalizedValue);

  return Number.isFinite(numericValue) ? numericValue : null;
};

const toNonNegativeNumber = (value, fallback = 0, precision = 2, maximum = 9999) => {
  const numericValue = toNumberOrNull(value);
  const resolvedValue = numericValue === null ? Number(fallback || 0) : numericValue;

  return Number(Math.max(0, Math.min(maximum, resolvedValue)).toFixed(precision));
};

const toPositiveInteger = (value, fallback = 0, maximum = 9999) => {
  const numericValue = toNumberOrNull(value);
  const resolvedValue = numericValue === null ? Number(fallback || 0) : numericValue;

  return Math.max(0, Math.min(maximum, Math.round(resolvedValue)));
};

const createStableId = (prefix) =>
  `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString("hex")}`;

const normalizeId = (value, fallbackPrefix) => {
  const normalizedValue = normalizeText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalizedValue || createStableId(fallbackPrefix);
};

const getDistanceBandLabel = (band) => {
  const minKm = Number(band?.minKm || 0);
  const maxKm = band?.maxKm === null || typeof band?.maxKm === "undefined" ? null : Number(band.maxKm);

  if (maxKm === null || !Number.isFinite(maxKm)) {
    return `Acima de ${String(minKm).replace(".", ",")} km`;
  }

  if (minKm <= 0) {
    return `Ate ${String(maxKm).replace(".", ",")} km`;
  }

  return `${String(minKm).replace(".", ",")} a ${String(maxKm).replace(".", ",")} km`;
};

const normalizeDistanceBand = (record = {}, index = 0) => {
  const defaultBand = DEFAULT_DELIVERY_SETTINGS.distanceBands[index] || {};
  const minKm = toNonNegativeNumber(record.minKm, defaultBand.minKm || 0, 2, 999);
  const rawMaxKm = toNumberOrNull(record.maxKm);
  const maxKm =
    rawMaxKm === null ? null : Number(Math.max(minKm, Math.min(999, rawMaxKm)).toFixed(2));

  return {
    id: normalizeId(record.id || defaultBand.id, "band"),
    minKm,
    maxKm,
    label: getDistanceBandLabel({ minKm, maxKm }),
    customerFee: toNonNegativeNumber(record.customerFee, defaultBand.customerFee || 0, 2, 500),
    courierFee: toNonNegativeNumber(record.courierFee, defaultBand.courierFee || 0, 2, 500),
    minimumOrder: toNonNegativeNumber(record.minimumOrder, defaultBand.minimumOrder || 0, 2, 5000),
    isActive: normalizeBoolean(record.isActive, defaultBand.isActive !== false),
  };
};

const normalizeCourier = (record = {}) => ({
  id: normalizeId(record.id, "courier"),
  name: normalizeText(record.name, 120),
  phone: String(record.phone || "").replace(/[^\d+() -]/g, "").trim().slice(0, 40),
  isActive: normalizeBoolean(record.isActive, true),
  defaultFee: toNonNegativeNumber(record.defaultFee, 0, 2, 500),
});

const normalizeDeliverySettings = (settings = {}) => {
  const defaults = getDefaultDeliverySettings();
  const source = settings && typeof settings === "object" ? settings : {};
  const distanceBandSource = Array.isArray(source.distanceBands)
    ? source.distanceBands
    : defaults.distanceBands;
  const normalizedBands = distanceBandSource
    .map(normalizeDistanceBand)
    .filter((band) => band.id)
    .sort((left, right) => left.minKm - right.minKm || (left.maxKm ?? 9999) - (right.maxKm ?? 9999));
  const couriers = (Array.isArray(source.couriers) ? source.couriers : [])
    .map(normalizeCourier)
    .filter((courier) => courier.name || courier.phone);
  const deliveryTimeSource =
    source.deliveryTime && typeof source.deliveryTime === "object" ? source.deliveryTime : {};
  const serviceAreaSource =
    source.serviceArea && typeof source.serviceArea === "object" ? source.serviceArea : {};
  const freeShippingSource =
    source.freeShipping && typeof source.freeShipping === "object" ? source.freeShipping : {};
  const pickupSource = source.pickup && typeof source.pickup === "object" ? source.pickup : {};
  const statusSource = source.status && typeof source.status === "object" ? source.status : {};
  const courierPayoutSource =
    source.courierPayout && typeof source.courierPayout === "object" ? source.courierPayout : {};
  const payoutMode = normalizeText(courierPayoutSource.mode, 40);

  return {
    distanceBands: normalizedBands.length ? normalizedBands : defaults.distanceBands,
    deliveryTime: {
      minMinutes: toPositiveInteger(
        deliveryTimeSource.minMinutes,
        defaults.deliveryTime.minMinutes,
        360
      ),
      maxMinutes: toPositiveInteger(
        Math.max(
          Number(deliveryTimeSource.minMinutes || defaults.deliveryTime.minMinutes || 0),
          Number(deliveryTimeSource.maxMinutes || defaults.deliveryTime.maxMinutes || 0)
        ),
        defaults.deliveryTime.maxMinutes,
        360
      ),
      message:
        normalizeText(deliveryTimeSource.message, 180) || defaults.deliveryTime.message,
    },
    serviceArea: {
      maxRadiusKm: toNonNegativeNumber(
        serviceAreaSource.maxRadiusKm,
        defaults.serviceArea.maxRadiusKm,
        2,
        999
      ),
      servedNeighborhoods: normalizeTextList(serviceAreaSource.servedNeighborhoods),
      blockedNeighborhoods: normalizeTextList(serviceAreaSource.blockedNeighborhoods),
      outOfAreaMessage:
        normalizeText(serviceAreaSource.outOfAreaMessage, 180) ||
        defaults.serviceArea.outOfAreaMessage,
    },
    freeShipping: {
      enabled: normalizeBoolean(freeShippingSource.enabled, defaults.freeShipping.enabled),
      minimumOrder: toNonNegativeNumber(
        freeShippingSource.minimumOrder,
        defaults.freeShipping.minimumOrder,
        2,
        5000
      ),
      appliesToAllBands: normalizeBoolean(
        freeShippingSource.appliesToAllBands,
        defaults.freeShipping.appliesToAllBands
      ),
      bandIds: [
        ...new Set(
          (Array.isArray(freeShippingSource.bandIds) ? freeShippingSource.bandIds : [])
            .map((bandId) => normalizeText(bandId, 120))
            .filter(Boolean)
        ),
      ],
    },
    pickup: {
      enabled: normalizeBoolean(pickupSource.enabled, defaults.pickup.enabled),
      estimateMinutes: toPositiveInteger(
        pickupSource.estimateMinutes,
        defaults.pickup.estimateMinutes,
        360
      ),
      message: normalizeText(pickupSource.message, 180) || defaults.pickup.message,
    },
    status: {
      deliveriesEnabled: normalizeBoolean(
        statusSource.deliveriesEnabled,
        defaults.status.deliveriesEnabled
      ),
      pausedMessage:
        normalizeText(statusSource.pausedMessage, 220) || defaults.status.pausedMessage,
    },
    couriers,
    courierPayout: {
      mode: COURIER_PAYOUT_MODES.has(payoutMode) ? payoutMode : defaults.courierPayout.mode,
      percentage: toNonNegativeNumber(courierPayoutSource.percentage, 0, 2, 100),
      manualAmount: toNonNegativeNumber(courierPayoutSource.manualAmount, 0, 2, 500),
    },
    updatedAt: normalizeText(source.updatedAt, 80),
    updatedByLogin: normalizeText(source.updatedByLogin, 120).toLowerCase(),
    updatedByDisplayName: normalizeText(source.updatedByDisplayName, 160),
  };
};

const buildDeliverySummary = (settings) => ({
  totalBands: settings.distanceBands.length,
  activeBands: settings.distanceBands.filter((band) => band.isActive).length,
  inactiveBands: settings.distanceBands.filter((band) => !band.isActive).length,
  activeCouriers: settings.couriers.filter((courier) => courier.isActive).length,
  totalCouriers: settings.couriers.length,
  deliveriesEnabled: settings.status.deliveriesEnabled,
  pickupEnabled: settings.pickup.enabled,
  freeShippingEnabled: settings.freeShipping.enabled,
  maxRadiusKm: settings.serviceArea.maxRadiusKm,
});

const getPublicSettings = (settings) => ({
  distanceBands: settings.distanceBands.map((band) => ({
    id: band.id,
    minKm: band.minKm,
    maxKm: band.maxKm,
    label: band.label,
    customerFee: band.customerFee,
    courierFee: band.courierFee,
    minimumOrder: band.minimumOrder,
    isActive: band.isActive,
  })),
  deliveryTime: { ...settings.deliveryTime },
  serviceArea: { ...settings.serviceArea },
  freeShipping: { ...settings.freeShipping },
  pickup: { ...settings.pickup },
  status: { ...settings.status },
  updatedAt: settings.updatedAt,
});

const readSettingsFromNeon = async (tenant) => {
  await ensureDeliverySettingsSchema();
  const sql = getSql();
  const settingsKey = getScopedSettingsKey(tenant);
  const rows = await sql`
    SELECT settings_json, updated_at, updated_by_login, updated_by_display_name
    FROM delivery_settings
    WHERE settings_key = ${settingsKey}
      AND tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
    LIMIT 1
  `;
  const row = rows[0];

  if (!row) {
    return getDefaultDeliverySettings();
  }

  return normalizeDeliverySettings({
    ...(row.settings_json && typeof row.settings_json === "object" ? row.settings_json : {}),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : "",
    updatedByLogin: row.updated_by_login || "",
    updatedByDisplayName: row.updated_by_display_name || "",
  });
};

const readSettings = async (tenant) => {
  const storageMode = getStorageMode();

  if (storageMode === "neon") {
    return readSettingsFromNeon(tenant);
  }

  if (storageMode === "disabled") {
    return getDefaultDeliverySettings();
  }

  const store = await readFileStore();

  if (tenant.isDefaultTenant) {
    return normalizeDeliverySettings(store.settings);
  }

  return normalizeDeliverySettings(store.tenants?.[tenant.restaurantKey]?.settings || {});
};

const saveSettingsToFile = async (settings, actor = {}, tenant) => {
  const updatedAt = new Date().toISOString();
  const nextSettings = normalizeDeliverySettings({
    ...settings,
    updatedAt,
    updatedByLogin: normalizeText(actor.login, 120).toLowerCase(),
    updatedByDisplayName: normalizeText(actor.displayName, 160),
  });
  const store = await readFileStore();

  if (tenant.isDefaultTenant) {
    await writeFileStore({
      ...store,
      version: LOCAL_STORE_VERSION,
      tenantId: tenant.tenantId,
      restaurantId: tenant.restaurantId,
      restaurantKey: tenant.restaurantKey,
      settings: nextSettings,
    });
  } else {
    await writeFileStore({
      ...store,
      version: LOCAL_STORE_VERSION,
      tenants: {
        ...(store.tenants || {}),
        [tenant.restaurantKey]: {
          ...(store.tenants?.[tenant.restaurantKey] || {}),
          tenantId: tenant.tenantId,
          restaurantId: tenant.restaurantId,
          restaurantKey: tenant.restaurantKey,
          settings: nextSettings,
        },
      },
    });
  }

  return {
    storageMode: "file",
    settings: nextSettings,
  };
};

const saveSettingsToNeon = async (settings, actor = {}, tenant) => {
  await ensureDeliverySettingsSchema();
  const sql = getSql();
  const settingsKey = getScopedSettingsKey(tenant);
  const updatedAt = new Date().toISOString();
  const updatedByLogin = normalizeText(actor.login, 120).toLowerCase();
  const updatedByDisplayName = normalizeText(actor.displayName, 160);
  const nextSettings = normalizeDeliverySettings({
    ...settings,
    updatedAt,
    updatedByLogin,
    updatedByDisplayName,
  });

  await sql`
    INSERT INTO delivery_settings (
      settings_key,
      tenant_id,
      restaurant_id,
      restaurant_key,
      settings_json,
      updated_at,
      updated_by_login,
      updated_by_display_name
    )
    VALUES (
      ${settingsKey},
      ${tenant.tenantId},
      ${tenant.restaurantId},
      ${tenant.restaurantKey},
      ${JSON.stringify(nextSettings)}::jsonb,
      ${updatedAt},
      ${updatedByLogin},
      ${updatedByDisplayName}
    )
    ON CONFLICT (tenant_id, restaurant_id, settings_key)
    DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      restaurant_id = EXCLUDED.restaurant_id,
      restaurant_key = EXCLUDED.restaurant_key,
      settings_json = EXCLUDED.settings_json,
      updated_at = EXCLUDED.updated_at,
      updated_by_login = EXCLUDED.updated_by_login,
      updated_by_display_name = EXCLUDED.updated_by_display_name
  `;

  return {
    storageMode: "neon",
    settings: nextSettings,
  };
};

const getAdminDeliverySettings = async (options = {}) => {
  const tenant = getOperationalTenant(options, "delivery-settings:admin:list");
  const settings = await readSettings(tenant);
  const storageMode = getStorageMode();

  return {
    storageMode,
    generatedAt: new Date().toISOString(),
    summary: buildDeliverySummary(settings),
    settings,
  };
};

const getPublicDeliverySettings = async (options = {}) => {
  const tenant = getOperationalTenant(options, "delivery-settings:public:list");
  const settings = await readSettings(tenant);
  const storageMode = getStorageMode();

  return {
    storageMode,
    generatedAt: new Date().toISOString(),
    summary: buildDeliverySummary(settings),
    settings: getPublicSettings(settings),
  };
};

const updateDeliverySettings = async (payload = {}, actor = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "delivery-settings:admin:update");
  assertStorageIsAvailable();

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw buildHttpError(400, "Informe as configuracoes de entrega.", "invalid_delivery_settings");
  }

  const settings = normalizeDeliverySettings(payload.settings || payload);
  const storageMode = getStorageMode();
  const result =
    storageMode === "neon"
      ? await saveSettingsToNeon(settings, actor, tenant)
      : await saveSettingsToFile(settings, actor, tenant);

  return {
    storageMode: result.storageMode,
    generatedAt: new Date().toISOString(),
    summary: buildDeliverySummary(result.settings),
    settings: result.settings,
    message: "Configuracoes de entrega salvas com sucesso.",
  };
};

module.exports = {
  getAdminDeliverySettings,
  getDefaultDeliverySettings,
  getPublicDeliverySettings,
  normalizeDeliverySettings,
  updateDeliverySettings,
};
