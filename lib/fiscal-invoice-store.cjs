"use strict";

// Notas fiscais (NFC-e) de cada restaurante. Só o servidor usa, sempre com o
// restaurante explícito; no banco só o escopo "system" lê e grava.
// Sem a tabela (migração 037 ainda não aplicada) responde "não ativada".

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { neon, runWithDatabaseScope } = require("./tenant-sql.cjs");
const { buildHttpError } = require("./http.cjs");

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

const getLocalFile = () =>
  String(process.env.INOVAS_FISCAL_INVOICES_FILE || "").trim() || path.join(process.cwd(), ".data", "fiscal-invoices.json");

const readLocal = async () => {
  try {
    const data = JSON.parse(await fs.readFile(getLocalFile(), "utf8"));
    return { invoices: data.invoices || [] };
  } catch (error) {
    if (error.code === "ENOENT") return { invoices: [] };
    throw error;
  }
};

const withLocal = (mutate) => {
  const run = fileQueue.then(async () => {
    const data = await readLocal();
    const result = await mutate(data);
    const file = getLocalFile();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    return result;
  });
  fileQueue = run.catch(() => {});
  return run;
};

const disabled = () => buildHttpError(503, "Nota fiscal ainda não ativada.", "fiscal_storage_unavailable");

const asSystem = (tenant, callback) =>
  runWithDatabaseScope(
    { audience: "system", tenantId: tenant.tenantId, restaurantId: tenant.restaurantId, restaurantKey: tenant.restaurantKey },
    async () => {
      try {
        return await callback(getSql());
      } catch (error) {
        if (error?.code === "42P01" || (/fiscal_invoices/.test(String(error?.message || "")) && /does not exist/.test(String(error?.message || "")))) {
          throw disabled();
        }
        throw error;
      }
    }
  );

const fromRow = (row) => ({
  id: row.id,
  tenantId: row.tenant_id ?? row.tenantId,
  restaurantId: row.restaurant_id ?? row.restaurantId,
  restaurantKey: row.restaurant_key ?? row.restaurantKey,
  orderId: row.order_id ?? row.orderId,
  orderPublicId: row.order_public_id ?? row.orderPublicId ?? "",
  providerRef: row.provider_ref ?? row.providerRef,
  provider: row.provider,
  environment: row.environment,
  status: row.status,
  amountCents: Number(row.amount_cents ?? row.amountCents ?? 0),
  number: row.number || "",
  series: row.series || "",
  accessKey: row.access_key ?? row.accessKey ?? "",
  danfeUrl: row.danfe_url ?? row.danfeUrl ?? "",
  xmlUrl: row.xml_url ?? row.xmlUrl ?? "",
  qrcodeUrl: row.qrcode_url ?? row.qrcodeUrl ?? "",
  message: row.message || "",
  requestedBy: row.requested_by ?? row.requestedBy ?? "",
  createdAt: row.created_at ?? row.createdAt,
  updatedAt: row.updated_at ?? row.updatedAt,
  authorizedAt: row.authorized_at ?? row.authorizedAt ?? null,
  canceledAt: row.canceled_at ?? row.canceledAt ?? null,
});

const sameTenant = (row, tenant) => row.tenantId === tenant.tenantId && row.restaurantId === tenant.restaurantId;

const createInvoice = async (tenant, fields) => {
  const mode = getStorageMode();
  if (mode === "disabled") throw disabled();
  const now = new Date().toISOString();
  const row = {
    id: `nfce_${crypto.randomUUID()}`,
    tenantId: tenant.tenantId,
    restaurantId: tenant.restaurantId,
    restaurantKey: tenant.restaurantKey,
    orderId: String(fields.orderId),
    orderPublicId: String(fields.orderPublicId || ""),
    providerRef: String(fields.providerRef),
    provider: fields.provider,
    environment: fields.environment,
    status: "PROCESSING",
    amountCents: Math.max(0, Math.round(Number(fields.amountCents || 0))),
    number: "",
    series: "",
    accessKey: "",
    danfeUrl: "",
    xmlUrl: "",
    qrcodeUrl: "",
    message: "",
    requestedBy: String(fields.requestedBy || "").slice(0, 160),
    createdAt: now,
    updatedAt: now,
    authorizedAt: null,
    canceledAt: null,
  };
  if (mode === "file") {
    return withLocal((data) => {
      data.invoices.push(row);
      return { ...row };
    });
  }
  return asSystem(tenant, async (sql) => {
    const rows = await sql`
      INSERT INTO fiscal_invoices (id, tenant_id, restaurant_id, restaurant_key, order_id, order_public_id, provider_ref,
        provider, environment, status, amount_cents, requested_by)
      VALUES (${row.id}, ${row.tenantId}, ${row.restaurantId}, ${row.restaurantKey}, ${row.orderId}, ${row.orderPublicId},
        ${row.providerRef}, ${row.provider}, ${row.environment}, 'PROCESSING', ${row.amountCents}, ${row.requestedBy})
      RETURNING *`;
    return fromRow(rows[0]);
  });
};

const updateInvoice = async (tenant, id, result = {}) => {
  const mode = getStorageMode();
  if (mode === "disabled") throw disabled();
  const now = new Date().toISOString();
  const patch = {
    status: result.status,
    number: String(result.number || "").slice(0, 20),
    series: String(result.series || "").slice(0, 10),
    accessKey: String(result.accessKey || "").replace(/\D/g, "").slice(0, 44),
    danfeUrl: String(result.danfeUrl || "").slice(0, 600),
    xmlUrl: String(result.xmlUrl || "").slice(0, 600),
    qrcodeUrl: String(result.qrcodeUrl || "").slice(0, 1200),
    message: String(result.message || "").slice(0, 500),
  };
  if (mode === "file") {
    return withLocal((data) => {
      const row = data.invoices.find((entry) => entry.id === id && sameTenant(entry, tenant));
      if (!row) return null;
      Object.entries(patch).forEach(([key, value]) => {
        if (value !== "" || key === "message") row[key] = value || row[key] || "";
      });
      row.status = patch.status;
      row.updatedAt = now;
      if (patch.status === "AUTHORIZED" && !row.authorizedAt) row.authorizedAt = now;
      if (patch.status === "CANCELED") row.canceledAt = now;
      return { ...row };
    });
  }
  return asSystem(tenant, async (sql) => {
    const rows = await sql`
      UPDATE fiscal_invoices SET
        status = ${patch.status},
        number = COALESCE(NULLIF(${patch.number}, ''), number),
        series = COALESCE(NULLIF(${patch.series}, ''), series),
        access_key = COALESCE(NULLIF(${patch.accessKey}, ''), access_key),
        danfe_url = COALESCE(NULLIF(${patch.danfeUrl}, ''), danfe_url),
        xml_url = COALESCE(NULLIF(${patch.xmlUrl}, ''), xml_url),
        qrcode_url = COALESCE(NULLIF(${patch.qrcodeUrl}, ''), qrcode_url),
        message = ${patch.message},
        updated_at = NOW(),
        authorized_at = CASE WHEN ${patch.status} = 'AUTHORIZED' AND authorized_at IS NULL THEN NOW() ELSE authorized_at END,
        canceled_at = CASE WHEN ${patch.status} = 'CANCELED' THEN NOW() ELSE canceled_at END
      WHERE id = ${id} AND tenant_id = ${tenant.tenantId} AND restaurant_id = ${tenant.restaurantId}
      RETURNING *`;
    return rows[0] ? fromRow(rows[0]) : null;
  });
};

const listInvoicesForOrder = async (tenant, orderId) => {
  const mode = getStorageMode();
  if (mode === "disabled") throw disabled();
  if (mode === "file") {
    const data = await readLocal();
    return data.invoices
      .filter((row) => sameTenant(row, tenant) && row.orderId === String(orderId))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  return asSystem(tenant, async (sql) => {
    const rows = await sql`
      SELECT * FROM fiscal_invoices
      WHERE tenant_id = ${tenant.tenantId} AND restaurant_id = ${tenant.restaurantId} AND order_id = ${String(orderId)}
      ORDER BY created_at DESC`;
    return rows.map(fromRow);
  });
};

const listRecentInvoices = async (tenant, limit = 30) => {
  const mode = getStorageMode();
  if (mode === "disabled") throw disabled();
  const size = Math.min(100, Math.max(1, Number(limit) || 30));
  if (mode === "file") {
    const data = await readLocal();
    return data.invoices
      .filter((row) => sameTenant(row, tenant))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, size);
  }
  return asSystem(tenant, async (sql) => {
    const rows = await sql`
      SELECT * FROM fiscal_invoices
      WHERE tenant_id = ${tenant.tenantId} AND restaurant_id = ${tenant.restaurantId}
      ORDER BY created_at DESC LIMIT ${size}`;
    return rows.map(fromRow);
  });
};

module.exports = { createInvoice, listInvoicesForOrder, listRecentInvoices, updateInvoice };
