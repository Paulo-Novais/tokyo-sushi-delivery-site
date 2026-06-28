const fs = require("node:fs/promises");
const path = require("node:path");
const { neon } = require("@neondatabase/serverless");
const { buildHttpError } = require("./http.cjs");
const { getOperationalTenant, matchesTenantScope } = require("./tenant-context.cjs");

const LOCAL_STORAGE_FILE = path.join(process.cwd(), ".data", "finance-closings.json");
const LOCAL_STORE_VERSION = 1;
const MAX_NOTES_LENGTH = 1000;

let sqlClient = null;
let schemaReadyPromise = null;

const getStorageMode = () => {
  if (String(process.env.DATABASE_URL || "").trim()) {
    return "neon";
  }

  return process.env.NODE_ENV === "production" ? "disabled" : "file";
};

const getSql = () => {
  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }

  return sqlClient;
};

const ensureFinanceClosingSchema = async () => {
  if (schemaReadyPromise) {
    return schemaReadyPromise;
  }

  const sql = getSql();
  schemaReadyPromise = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS finance_closings (
        period_key TEXT NOT NULL,
        tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
        restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default',
        restaurant_key TEXT NOT NULL DEFAULT 'default',
        period_start_date TEXT NOT NULL DEFAULT '',
        period_end_date TEXT NOT NULL DEFAULT '',
        counted_cash NUMERIC(10, 2),
        notes TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by_login TEXT NOT NULL DEFAULT '',
        updated_by_display_name TEXT NOT NULL DEFAULT ''
      )
    `;

    await sql`
      ALTER TABLE finance_closings
      ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default'
    `;

    await sql`
      ALTER TABLE finance_closings
      ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default'
    `;

    await sql`
      ALTER TABLE finance_closings
      ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default'
    `;

    await sql`
      ALTER TABLE finance_closings
      DROP CONSTRAINT IF EXISTS finance_closings_pkey
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS finance_closings_restaurant_key_period_idx
      ON finance_closings (restaurant_key, period_key)
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS finance_closings_tenant_restaurant_period_uidx
      ON finance_closings (tenant_id, restaurant_id, period_key)
    `;
  })();

  return schemaReadyPromise;
};

const normalizeText = (value, maxLength = 240) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const toMoneyOrNull = (value) => {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }

  const normalizedValue =
    typeof value === "string" ? value.replace(/[^\d,.\-]/g, "").replace(",", ".") : value;
  const numericValue = Number(normalizedValue);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Number(Math.max(numericValue, 0).toFixed(2));
};

const normalizePeriodKey = (value) => normalizeText(value, 160);

const normalizeClosingRecord = (record = {}) => {
  const countedCash = toMoneyOrNull(record.countedCash ?? record.counted_cash);

  return {
    periodKey: normalizePeriodKey(record.periodKey || record.period_key),
    tenantId: normalizeText(record.tenantId || record.tenant_id, 120) || "tenant_default",
    restaurantId: normalizeText(record.restaurantId || record.restaurant_id, 120) || "restaurant_default",
    restaurantKey: normalizeText(record.restaurantKey || record.restaurant_key, 120) || "default",
    periodStartDate: normalizeText(record.periodStartDate || record.period_start_date, 20),
    periodEndDate: normalizeText(record.periodEndDate || record.period_end_date, 20),
    countedCash,
    notes: normalizeText(record.notes, MAX_NOTES_LENGTH),
    updatedAt: record.updatedAt || record.updated_at || "",
    updatedByLogin: normalizeText(record.updatedByLogin || record.updated_by_login, 120).toLowerCase(),
    updatedByDisplayName: normalizeText(record.updatedByDisplayName || record.updated_by_display_name, 160),
  };
};

const getEmptyLocalStore = () => ({
  version: LOCAL_STORE_VERSION,
  closings: [],
});

const readFileStore = async () => {
  try {
    const raw = await fs.readFile(LOCAL_STORAGE_FILE, "utf8");
    const parsed = JSON.parse(raw);

    return {
      version: LOCAL_STORE_VERSION,
      closings: Array.isArray(parsed?.closings) ? parsed.closings.map(normalizeClosingRecord) : [],
    };
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    return getEmptyLocalStore();
  }
};

const writeFileStore = async (store) => {
  await fs.mkdir(path.dirname(LOCAL_STORAGE_FILE), { recursive: true });
  await fs.writeFile(
    LOCAL_STORAGE_FILE,
    `${JSON.stringify(
      {
        version: LOCAL_STORE_VERSION,
        closings: Array.isArray(store?.closings) ? store.closings.map(normalizeClosingRecord) : [],
      },
      null,
      2
    )}\n`,
    "utf8"
  );
};

const getFinanceClosing = async (periodKey, options = {}) => {
  const tenant = getOperationalTenant(options, "finance:closing:get");
  const normalizedPeriodKey = normalizePeriodKey(periodKey);

  if (!normalizedPeriodKey) {
    return null;
  }

  const storageMode = getStorageMode();

  if (storageMode === "disabled") {
    return null;
  }

  if (storageMode === "neon") {
    await ensureFinanceClosingSchema();
    const rows = await getSql()`
      SELECT
        period_key,
        restaurant_key,
        period_start_date,
        period_end_date,
        counted_cash,
        notes,
        updated_at,
        updated_by_login,
        updated_by_display_name
      FROM finance_closings
      WHERE period_key = ${normalizedPeriodKey}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND restaurant_key = ${tenant.restaurantKey}
      LIMIT 1
    `;

    return rows[0] ? normalizeClosingRecord(rows[0]) : null;
  }

  const store = await readFileStore();
  return (
    store.closings.find(
      (closing) =>
        closing.periodKey === normalizedPeriodKey && matchesTenantScope(closing, tenant)
    ) || null
  );
};

const saveFinanceClosing = async (payload = {}, actor = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "finance:closing:save");
  const periodKey = normalizePeriodKey(payload.periodKey);

  if (!periodKey) {
    throw buildHttpError(400, "Informe o periodo do fechamento financeiro.", "missing_finance_period");
  }

  const closing = normalizeClosingRecord({
    periodKey,
    tenantId: tenant.tenantId,
    restaurantId: tenant.restaurantId,
    restaurantKey: tenant.restaurantKey,
    periodStartDate: payload.periodStartDate,
    periodEndDate: payload.periodEndDate,
    countedCash: payload.countedCash,
    notes: payload.notes,
    updatedAt: new Date().toISOString(),
    updatedByLogin: actor.login,
    updatedByDisplayName: actor.displayName,
  });
  const storageMode = getStorageMode();

  if (storageMode === "disabled") {
    throw buildHttpError(
      503,
      "DATABASE_URL ainda nao foi configurada. O fechamento financeiro precisa de armazenamento persistente.",
      "finance_storage_unavailable"
    );
  }

  if (storageMode === "neon") {
    await ensureFinanceClosingSchema();
    await getSql()`
      INSERT INTO finance_closings (
        period_key,
        tenant_id,
        restaurant_id,
        restaurant_key,
        period_start_date,
        period_end_date,
        counted_cash,
        notes,
        updated_at,
        updated_by_login,
        updated_by_display_name
      )
      VALUES (
        ${closing.periodKey},
        ${tenant.tenantId},
        ${tenant.restaurantId},
        ${tenant.restaurantKey},
        ${closing.periodStartDate},
        ${closing.periodEndDate},
        ${closing.countedCash},
        ${closing.notes},
        ${closing.updatedAt},
        ${closing.updatedByLogin},
        ${closing.updatedByDisplayName}
      )
      ON CONFLICT (tenant_id, restaurant_id, period_key)
      DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        restaurant_id = EXCLUDED.restaurant_id,
        restaurant_key = EXCLUDED.restaurant_key,
        period_start_date = EXCLUDED.period_start_date,
        period_end_date = EXCLUDED.period_end_date,
        counted_cash = EXCLUDED.counted_cash,
        notes = EXCLUDED.notes,
        updated_at = EXCLUDED.updated_at,
        updated_by_login = EXCLUDED.updated_by_login,
        updated_by_display_name = EXCLUDED.updated_by_display_name
    `;

    return {
      storageMode: "neon",
      closing,
    };
  }

  const store = await readFileStore();
  const nextClosings = store.closings.filter(
    (entry) => !(entry.periodKey === closing.periodKey && matchesTenantScope(entry, tenant))
  );
  nextClosings.push(closing);
  await writeFileStore({
    version: LOCAL_STORE_VERSION,
    closings: nextClosings,
  });

  return {
    storageMode: "file",
    closing,
  };
};

module.exports = {
  getFinanceClosing,
  saveFinanceClosing,
};
