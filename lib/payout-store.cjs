"use strict";

// Lançamentos e repasses semanais do pagamento online (modelo iFood).
//
// Segurança:
// - Cada função usa o restaurante do tenantContext (nunca um id vindo do
//   navegador); restaurante A não lê nem altera o restaurante B.
// - Lançar valores e fechar semana: só caminhos confiáveis do servidor
//   (painel INOVAS, aviso assinado do provedor, rotina semanal). Por isso as
//   escritas rodam no escopo "system" do banco (RLS da migration 032).
// - O restaurante só lê o próprio extrato.
// - idempotencyKey impede lançamento em dobro.

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { neon, runWithDatabaseScope } = require("./tenant-sql.cjs");
const { buildHttpError } = require("./http.cjs");
const { getOperationalTenant } = require("./tenant-context.cjs");
const {
  buildWeeklyStatement,
  getWeekPeriod,
  getWeekPeriodByKey,
  isEntryType,
} = require("./payout-ledger.cjs");
const { isOnlinePaymentMethod } = require("./payment-methods.cjs");

const MAX_DESCRIPTION = 300;

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
  String(process.env.INOVAS_PAYOUTS_FILE || "").trim() ||
  path.join(process.cwd(), ".data", "restaurant-payouts.json");

const readLocal = async () => {
  try {
    const data = JSON.parse(await fs.readFile(getLocalFile(), "utf8"));
    return { entries: data.entries || [], payouts: data.payouts || [] };
  } catch (error) {
    if (error.code === "ENOENT") return { entries: [], payouts: [] };
    throw error;
  }
};

const writeLocal = async (data) => {
  const file = getLocalFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

const withLocalMutation = (mutate) => {
  const run = fileQueue.then(async () => {
    const data = await readLocal();
    const result = await mutate(data);
    await writeLocal(data);
    return result;
  });
  fileQueue = run.catch(() => {});
  return run;
};

const assertStorage = () => {
  const mode = getStorageMode();
  if (mode === "disabled") {
    throw buildHttpError(503, "Pagamento online ainda nao ativado.", "payouts_not_configured");
  }
  return mode;
};

const translateDatabaseError = (error) => {
  if (error?.code === "42P01" || /restaurant_(ledger_entries|payouts)/.test(String(error?.message || "")) && /does not exist/.test(String(error?.message || ""))) {
    return buildHttpError(503, "Pagamento online ainda nao ativado.", "payouts_not_configured");
  }
  return error;
};

const asSystem = (tenant, callback) =>
  runWithDatabaseScope(
    {
      audience: "system",
      tenantId: tenant.tenantId,
      restaurantId: tenant.restaurantId,
      restaurantKey: tenant.restaurantKey,
    },
    callback
  );

const sameRestaurant = (row, tenant) =>
  row.tenantId === tenant.tenantId && row.restaurantId === tenant.restaurantId;

const fromEntryRow = (row) => ({
  id: row.id,
  type: row.entry_type ?? row.type,
  method: row.payment_method ?? row.method ?? "",
  amountCents: Number(row.amount_cents ?? row.amountCents ?? 0),
  description: row.description || "",
  orderId: row.order_id ?? row.orderId ?? "",
  orderPublicId: row.order_public_id ?? row.orderPublicId ?? "",
  paymentId: row.payment_id ?? row.paymentId ?? "",
  occurredAt: new Date(row.occurred_at ?? row.occurredAt).toISOString(),
  createdBy: row.created_by ?? row.createdBy ?? "",
});

const fromPayoutRow = (row) => ({
  id: row.id,
  weekKey: String(row.week_key instanceof Date ? row.week_key.toISOString().slice(0, 10) : row.week_key ?? row.weekKey).slice(0, 10),
  payoutDate: String(row.payout_date instanceof Date ? row.payout_date.toISOString().slice(0, 10) : row.payout_date ?? row.payoutDate).slice(0, 10),
  grossSalesCents: Number(row.gross_sales_cents ?? row.grossSalesCents ?? 0),
  netCents: Number(row.net_cents ?? row.netCents ?? 0),
  payoutCents: Number(row.payout_cents ?? row.payoutCents ?? 0),
  carryOverCents: Number(row.carry_over_cents ?? row.carryOverCents ?? 0),
  status: row.status,
  statement: row.statement_json ?? row.statement ?? null,
  providerTransferId: row.provider_transfer_id ?? row.providerTransferId ?? "",
  closedAt: row.closed_at ?? row.closedAt ?? null,
  paidAt: row.paid_at ?? row.paidAt ?? null,
});

const normalizeEntryInput = (input = {}) => {
  const type = String(input.type || "").toUpperCase();
  if (!isEntryType(type)) {
    throw buildHttpError(400, "Tipo de lancamento invalido.", "ledger_entry_type_invalid");
  }
  const amountCents = Number(input.amountCents);
  if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > 100_000_000) {
    throw buildHttpError(400, "Valor do lancamento invalido (centavos, maior que zero).", "ledger_entry_amount_invalid");
  }
  const method = String(input.method || "");
  if ((type === "SALE" || type === "PROCESSING_FEE") && !isOnlinePaymentMethod(method)) {
    throw buildHttpError(400, "Forma de pagamento invalida para venda/taxa.", "ledger_entry_method_invalid");
  }
  const description = String(input.description || "").replace(/\s+/g, " ").trim().slice(0, MAX_DESCRIPTION);
  if ((type === "DEBT" || type === "CREDIT") && !description) {
    throw buildHttpError(400, "Descreva o debito/credito (aparece no extrato do restaurante).", "ledger_entry_description_required");
  }
  const idempotencyKey = String(input.idempotencyKey || "").trim();
  if (idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    throw buildHttpError(400, "Chave de idempotencia obrigatoria.", "ledger_entry_idempotency_required");
  }
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
  if (!Number.isFinite(occurredAt.getTime())) {
    throw buildHttpError(400, "Data do lancamento invalida.", "ledger_entry_date_invalid");
  }
  return {
    type,
    method,
    amountCents,
    description,
    orderId: String(input.orderId || "").slice(0, 160),
    orderPublicId: String(input.orderPublicId || "").slice(0, 60),
    paymentId: String(input.paymentId || "").slice(0, 160),
    idempotencyKey,
    occurredAt: occurredAt.toISOString(),
  };
};

// Lança um valor no extrato do restaurante. Repetir a mesma idempotencyKey
// devolve o lançamento existente (não duplica).
const recordLedgerEntry = async (options, input, { actorLogin = "" } = {}) => {
  const mode = assertStorage();
  const tenant = getOperationalTenant(options, "payouts:record");
  const entry = normalizeEntryInput(input);
  const id = `led_${crypto.randomUUID()}`;
  const createdBy = String(actorLogin || "").slice(0, 160);

  if (mode === "file") {
    return withLocalMutation(async (data) => {
      const existing = data.entries.find(
        (row) => sameRestaurant(row, tenant) && row.idempotencyKey === entry.idempotencyKey
      );
      if (existing) return { entry: fromEntryRow(existing), replayed: true };
      const row = { id, tenantId: tenant.tenantId, restaurantId: tenant.restaurantId, restaurantKey: tenant.restaurantKey, ...entry, createdBy };
      data.entries.push(row);
      return { entry: fromEntryRow(row), replayed: false };
    });
  }

  try {
    return await asSystem(tenant, async () => {
      const sql = getSql();
      const inserted = await sql`
        INSERT INTO restaurant_ledger_entries (
          id, tenant_id, restaurant_id, restaurant_key, entry_type, payment_method,
          amount_cents, description, order_id, order_public_id, payment_id,
          idempotency_key, occurred_at, created_by
        ) VALUES (
          ${id}, ${tenant.tenantId}, ${tenant.restaurantId}, ${tenant.restaurantKey}, ${entry.type}, ${entry.method},
          ${entry.amountCents}, ${entry.description}, ${entry.orderId}, ${entry.orderPublicId}, ${entry.paymentId},
          ${entry.idempotencyKey}, ${entry.occurredAt}, ${createdBy}
        )
        ON CONFLICT (tenant_id, restaurant_id, idempotency_key) DO NOTHING
        RETURNING *
      `;
      if (inserted[0]) return { entry: fromEntryRow(inserted[0]), replayed: false };
      const existing = await sql`
        SELECT * FROM restaurant_ledger_entries
        WHERE tenant_id = ${tenant.tenantId} AND restaurant_id = ${tenant.restaurantId}
          AND idempotency_key = ${entry.idempotencyKey}
      `;
      return { entry: fromEntryRow(existing[0]), replayed: true };
    });
  } catch (error) {
    throw translateDatabaseError(error);
  }
};

const listEntries = async (tenant, mode, { from, to }) => {
  if (mode === "file") {
    const data = await readLocal();
    return data.entries
      .filter((row) => sameRestaurant(row, tenant))
      .filter((row) => new Date(row.occurredAt) >= new Date(from) && new Date(row.occurredAt) < new Date(to))
      .map(fromEntryRow);
  }
  const rows = await getSql()`
    SELECT * FROM restaurant_ledger_entries
    WHERE tenant_id = ${tenant.tenantId} AND restaurant_id = ${tenant.restaurantId}
      AND occurred_at >= ${from} AND occurred_at < ${to}
    ORDER BY occurred_at
  `;
  return rows.map(fromEntryRow);
};

const listPayoutRows = async (tenant, mode) => {
  if (mode === "file") {
    const data = await readLocal();
    return data.payouts.filter((row) => sameRestaurant(row, tenant)).map(fromPayoutRow);
  }
  const rows = await getSql()`
    SELECT * FROM restaurant_payouts
    WHERE tenant_id = ${tenant.tenantId} AND restaurant_id = ${tenant.restaurantId}
    ORDER BY week_key DESC
    LIMIT 104
  `;
  return rows.map(fromPayoutRow);
};

// Saldo devedor que vem de semanas anteriores: o do último repasse fechado.
const openingBalanceFor = (payouts, weekKey) => {
  const previous = payouts
    .filter((payout) => payout.weekKey < weekKey)
    .sort((left, right) => (left.weekKey < right.weekKey ? 1 : -1))[0];
  return previous ? previous.carryOverCents : 0;
};

// Extrato da semana (aberta ou fechada) do restaurante logado.
const getWeeklyStatement = async (options, { weekKey } = {}) => {
  const mode = assertStorage();
  const tenant = getOperationalTenant(options, "payouts:statement");
  const period = weekKey ? getWeekPeriodByKey(weekKey) : getWeekPeriod(new Date());
  try {
    const payouts = await listPayoutRows(tenant, mode);
    const closed = payouts.find((payout) => payout.weekKey === period.weekKey) || null;
    if (closed?.statement?.lines) {
      return { ...closed.statement, status: closed.status, payout: closed, closed: true };
    }
    const entries = await listEntries(tenant, mode, { from: period.periodStart, to: period.periodEnd });
    const statement = buildWeeklyStatement({
      entries,
      period,
      openingBalanceCents: openingBalanceFor(payouts, period.weekKey),
    });
    return { ...statement, status: "OPEN", payout: null, closed: false };
  } catch (error) {
    throw translateDatabaseError(error);
  }
};

const listPayouts = async (options) => {
  const mode = assertStorage();
  const tenant = getOperationalTenant(options, "payouts:list");
  try {
    const payouts = await listPayoutRows(tenant, mode);
    return payouts.map(({ statement, ...payout }) => payout);
  } catch (error) {
    throw translateDatabaseError(error);
  }
};

// Fecha a semana: congela o extrato e agenda o repasse (ou registra "nada a
// repassar", levando o saldo devedor). Fechar de novo devolve o mesmo
// fechamento. Só depois do fim da semana.
const closeWeek = async (options, { weekKey, actorLogin = "", now = new Date() } = {}) => {
  const mode = assertStorage();
  const tenant = getOperationalTenant(options, "payouts:close");
  const period = getWeekPeriodByKey(weekKey);
  if (new Date(now).getTime() < new Date(period.periodEnd).getTime()) {
    throw buildHttpError(409, "A semana ainda nao terminou.", "payout_week_not_finished");
  }
  const closedBy = String(actorLogin || "").slice(0, 160);

  const build = (entries, payouts) => {
    const statement = buildWeeklyStatement({
      entries,
      period,
      openingBalanceCents: openingBalanceFor(payouts, period.weekKey),
    });
    return {
      id: `pay_${crypto.randomUUID()}`,
      weekKey: period.weekKey,
      payoutDate: period.payoutDate,
      grossSalesCents: statement.totals.grossSalesCents,
      netCents: statement.netCents,
      payoutCents: statement.payoutCents,
      carryOverCents: statement.carryOverCents,
      status: statement.payoutCents > 0 ? "SCHEDULED" : "NOTHING_TO_PAY",
      statement,
    };
  };

  if (mode === "file") {
    return withLocalMutation(async (data) => {
      const existing = data.payouts.find((row) => sameRestaurant(row, tenant) && row.weekKey === period.weekKey);
      if (existing) return { payout: fromPayoutRow(existing), replayed: true };
      const payouts = data.payouts.filter((row) => sameRestaurant(row, tenant)).map(fromPayoutRow);
      const entries = data.entries
        .filter((row) => sameRestaurant(row, tenant))
        .map(fromEntryRow);
      const payout = build(entries, payouts);
      const row = {
        ...payout,
        tenantId: tenant.tenantId,
        restaurantId: tenant.restaurantId,
        restaurantKey: tenant.restaurantKey,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        closedBy,
        closedAt: new Date().toISOString(),
        paidAt: null,
        providerTransferId: "",
      };
      data.payouts.push(row);
      return { payout: fromPayoutRow(row), replayed: false };
    });
  }

  try {
    return await asSystem(tenant, async () => {
      const payouts = await listPayoutRows(tenant, mode);
      const existing = payouts.find((payout) => payout.weekKey === period.weekKey);
      if (existing) return { payout: existing, replayed: true };
      const entries = await listEntries(tenant, mode, { from: period.periodStart, to: period.periodEnd });
      const payout = build(entries, payouts);
      const inserted = await getSql()`
        INSERT INTO restaurant_payouts (
          id, tenant_id, restaurant_id, restaurant_key, week_key, period_start, period_end,
          payout_date, gross_sales_cents, net_cents, payout_cents, carry_over_cents,
          status, statement_json, closed_by
        ) VALUES (
          ${payout.id}, ${tenant.tenantId}, ${tenant.restaurantId}, ${tenant.restaurantKey},
          ${period.weekKey}, ${period.periodStart}, ${period.periodEnd}, ${period.payoutDate},
          ${payout.grossSalesCents}, ${payout.netCents}, ${payout.payoutCents}, ${payout.carryOverCents},
          ${payout.status}, ${JSON.stringify(payout.statement)}::jsonb, ${closedBy}
        )
        ON CONFLICT (tenant_id, restaurant_id, week_key) DO NOTHING
        RETURNING *
      `;
      if (inserted[0]) return { payout: fromPayoutRow(inserted[0]), replayed: false };
      const again = await listPayoutRows(tenant, mode);
      return { payout: again.find((row) => row.weekKey === period.weekKey), replayed: true };
    });
  } catch (error) {
    throw translateDatabaseError(error);
  }
};

module.exports = {
  closeWeek,
  getWeeklyStatement,
  listPayouts,
  recordLedgerEntry,
};
