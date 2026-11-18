"use strict";

// Pagamentos online e conta de recebimento (recebedor) de cada restaurante.
// Só o servidor usa este módulo (checkout, aviso do provedor, rotina semanal),
// sempre com o restaurante explícito; o banco aceita só o escopo "system".

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { neon, runWithDatabaseScope } = require("./tenant-sql.cjs");
const { buildHttpError } = require("./http.cjs");

const PAYMENT_STATUSES = Object.freeze(["PENDING", "PAID", "FAILED", "REFUNDED", "ORDER_FAILED"]);

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
  String(process.env.INOVAS_ONLINE_PAYMENTS_FILE || "").trim() ||
  path.join(process.cwd(), ".data", "online-payments.json");

const readLocal = async () => {
  try {
    const data = JSON.parse(await fs.readFile(getLocalFile(), "utf8"));
    return { payments: data.payments || [], accounts: data.accounts || [] };
  } catch (error) {
    if (error.code === "ENOENT") return { payments: [], accounts: [] };
    throw error;
  }
};

const writeLocal = async (data) => {
  const file = getLocalFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

const withLocal = (mutate) => {
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
    throw buildHttpError(503, "Pagamento online ainda nao ativado.", "online_payment_disabled");
  }
  return mode;
};

const translate = (error) => {
  if (error?.code === "42P01" || (/online_payments|restaurant_payment_accounts/.test(String(error?.message || "")) && /does not exist/.test(String(error?.message || "")))) {
    return buildHttpError(503, "Pagamento online ainda nao ativado.", "online_payment_disabled");
  }
  return error;
};

const asSystem = (tenant, callback) =>
  runWithDatabaseScope(
    { audience: "system", tenantId: tenant.tenantId, restaurantId: tenant.restaurantId, restaurantKey: tenant.restaurantKey },
    async () => {
      try {
        return await callback(getSql());
      } catch (error) {
        throw translate(error);
      }
    }
  );

const fromRow = (row) => ({
  id: row.id,
  tenantId: row.tenant_id ?? row.tenantId,
  restaurantId: row.restaurant_id ?? row.restaurantId,
  restaurantKey: row.restaurant_key ?? row.restaurantKey,
  status: row.status,
  method: row.payment_method ?? row.method,
  amountCents: Number(row.amount_cents ?? row.amountCents ?? 0),
  orderPayload: row.order_payload ?? row.orderPayload ?? null,
  customerKey: row.customer_key ?? row.customerKey ?? "",
  provider: row.provider,
  providerOrderId: row.provider_order_id ?? row.providerOrderId ?? "",
  providerChargeId: row.provider_charge_id ?? row.providerChargeId ?? "",
  checkoutUrl: row.checkout_url ?? row.checkoutUrl ?? "",
  feeCents: row.fee_cents === null || row.fee_cents === undefined ? row.feeCents ?? null : Number(row.fee_cents),
  orderId: row.order_id ?? row.orderId ?? "",
  orderPublicId: row.order_public_id ?? row.orderPublicId ?? "",
  failureReason: row.failure_reason ?? row.failureReason ?? "",
  createdAt: row.created_at ?? row.createdAt,
  paidAt: row.paid_at ?? row.paidAt ?? null,
  refundedAt: row.refunded_at ?? row.refundedAt ?? null,
});

const tenantOf = (row) => ({ tenantId: row.tenantId, restaurantId: row.restaurantId, restaurantKey: row.restaurantKey });

const createPayment = async (tenant, { method, amountCents, orderPayload, customerKey, provider }) => {
  const mode = assertStorage();
  const now = new Date().toISOString();
  const row = {
    id: `pgto_${crypto.randomUUID()}`,
    ...tenant,
    status: "PENDING",
    method,
    amountCents,
    orderPayload,
    customerKey: String(customerKey || "").slice(0, 200),
    provider,
    providerOrderId: "",
    providerChargeId: "",
    checkoutUrl: "",
    feeCents: null,
    orderId: "",
    orderPublicId: "",
    failureReason: "",
    createdAt: now,
    paidAt: null,
    refundedAt: null,
  };
  if (mode === "file") {
    return withLocal((data) => {
      data.payments.push(row);
      return { ...row };
    });
  }
  return asSystem(tenant, async (sql) => {
    const rows = await sql`
      INSERT INTO online_payments (
        id, tenant_id, restaurant_id, restaurant_key, status, payment_method, amount_cents,
        order_payload, customer_key, provider
      ) VALUES (
        ${row.id}, ${tenant.tenantId}, ${tenant.restaurantId}, ${tenant.restaurantKey}, 'PENDING', ${method}, ${amountCents},
        ${JSON.stringify(orderPayload)}::jsonb, ${row.customerKey}, ${provider}
      ) RETURNING *
    `;
    return fromRow(rows[0]);
  });
};

// Atualiza campos permitidos de um pagamento (sempre do mesmo restaurante).
const UPDATABLE = {
  status: "status",
  providerOrderId: "provider_order_id",
  providerChargeId: "provider_charge_id",
  checkoutUrl: "checkout_url",
  feeCents: "fee_cents",
  orderId: "order_id",
  orderPublicId: "order_public_id",
  failureReason: "failure_reason",
  paidAt: "paid_at",
  refundedAt: "refunded_at",
};

const updatePayment = async (payment, changes) => {
  const mode = assertStorage();
  const patch = Object.fromEntries(Object.entries(changes).filter(([key]) => key in UPDATABLE));
  if (patch.status && !PAYMENT_STATUSES.includes(patch.status)) throw new Error("Status de pagamento invalido.");
  if (mode === "file") {
    return withLocal((data) => {
      const row = data.payments.find((entry) => entry.id === payment.id && entry.tenantId === payment.tenantId && entry.restaurantId === payment.restaurantId);
      if (!row) throw buildHttpError(404, "Pagamento nao encontrado.", "payment_not_found");
      Object.assign(row, patch);
      return fromRow(row);
    });
  }
  return asSystem(tenantOf(payment), async (sql) => {
    const current = (await sql`SELECT * FROM online_payments WHERE id = ${payment.id} AND tenant_id = ${payment.tenantId} AND restaurant_id = ${payment.restaurantId}`)[0];
    if (!current) throw buildHttpError(404, "Pagamento nao encontrado.", "payment_not_found");
    const next = { ...fromRow(current), ...patch };
    const rows = await sql`
      UPDATE online_payments SET
        status = ${next.status},
        provider_order_id = ${next.providerOrderId},
        provider_charge_id = ${next.providerChargeId},
        checkout_url = ${next.checkoutUrl},
        fee_cents = ${next.feeCents},
        order_id = ${next.orderId},
        order_public_id = ${next.orderPublicId},
        failure_reason = ${next.failureReason},
        paid_at = ${next.paidAt},
        refunded_at = ${next.refundedAt},
        updated_at = NOW()
      WHERE id = ${payment.id} AND tenant_id = ${payment.tenantId} AND restaurant_id = ${payment.restaurantId}
      RETURNING *
    `;
    return fromRow(rows[0]);
  });
};

// Muda o status só se ainda estiver no esperado (evita processar o mesmo
// pagamento duas vezes quando chegam avisos repetidos ao mesmo tempo).
const claimPaymentTransition = async (payment, fromStatus, toStatus) => {
  const mode = assertStorage();
  if (mode === "file") {
    return withLocal((data) => {
      const row = data.payments.find((entry) => entry.id === payment.id && entry.tenantId === payment.tenantId);
      if (!row || row.status !== fromStatus) return false;
      row.status = toStatus;
      return true;
    });
  }
  return asSystem(tenantOf(payment), async (sql) => {
    const rows = await sql`
      UPDATE online_payments SET status = ${toStatus}, updated_at = NOW()
      WHERE id = ${payment.id} AND tenant_id = ${payment.tenantId} AND restaurant_id = ${payment.restaurantId}
        AND status = ${fromStatus}
      RETURNING id
    `;
    return rows.length === 1;
  });
};

const getPaymentById = async (tenant, paymentId) => {
  const mode = assertStorage();
  const id = String(paymentId || "");
  if (!/^pgto_[0-9a-f-]{36}$/.test(id)) return null;
  if (mode === "file") {
    const row = (await readLocal()).payments.find((entry) => entry.id === id && entry.tenantId === tenant.tenantId && entry.restaurantId === tenant.restaurantId);
    return row ? fromRow(row) : null;
  }
  return asSystem(tenant, async (sql) => {
    const rows = await sql`SELECT * FROM online_payments WHERE id = ${id} AND tenant_id = ${tenant.tenantId} AND restaurant_id = ${tenant.restaurantId}`;
    return rows[0] ? fromRow(rows[0]) : null;
  });
};

// Aviso do provedor: acha o pagamento pelo id do pedido no provedor (sem
// saber o restaurante ainda). Só leitura, escopo sistema.
const findPaymentByProviderOrderId = async (providerOrderId) => {
  const mode = assertStorage();
  const id = String(providerOrderId || "");
  if (!id) return null;
  if (mode === "file") {
    const row = (await readLocal()).payments.find((entry) => entry.providerOrderId === id);
    return row ? fromRow(row) : null;
  }
  return runWithDatabaseScope({ audience: "system" }, async () => {
    try {
      const rows = await getSql()`SELECT * FROM online_payments WHERE provider_order_id = ${id} LIMIT 1`;
      return rows[0] ? fromRow(rows[0]) : null;
    } catch (error) {
      throw translate(error);
    }
  });
};

const findPaymentByOrderId = async (tenant, orderId) => {
  const mode = assertStorage();
  const id = String(orderId || "");
  if (!id) return null;
  if (mode === "file") {
    const row = (await readLocal()).payments.find((entry) => entry.orderId === id && entry.tenantId === tenant.tenantId && entry.restaurantId === tenant.restaurantId);
    return row ? fromRow(row) : null;
  }
  return asSystem(tenant, async (sql) => {
    const rows = await sql`SELECT * FROM online_payments WHERE order_id = ${id} AND tenant_id = ${tenant.tenantId} AND restaurant_id = ${tenant.restaurantId} LIMIT 1`;
    return rows[0] ? fromRow(rows[0]) : null;
  });
};

/* -------- Conta de recebimento (recebedor) do restaurante -------- */

const RECIPIENT_PATTERN = /^[A-Za-z0-9_-]{4,80}$/;

const setRecipient = async (tenant, { provider, recipientId, actorLogin = "" }) => {
  const mode = assertStorage();
  const id = String(recipientId || "").trim();
  if (id && !RECIPIENT_PATTERN.test(id)) {
    throw buildHttpError(400, "Codigo do recebedor invalido.", "payment_recipient_invalid");
  }
  const record = { ...tenant, provider, recipientId: id, recipientStatus: id ? "ACTIVE" : "NOT_SUBMITTED", recipientMessage: "", updatedBy: String(actorLogin).slice(0, 160), updatedAt: new Date().toISOString() };
  if (mode === "file") {
    return withLocal((data) => {
      const current = data.accounts.find((entry) => entry.tenantId === tenant.tenantId && entry.restaurantId === tenant.restaurantId) || {};
      data.accounts = data.accounts.filter((entry) => entry !== current);
      data.accounts.push({ ...current, ...record });
      return { ...current, ...record };
    });
  }
  return asSystem(tenant, async (sql) => {
    await sql`
      INSERT INTO restaurant_payment_accounts (tenant_id, restaurant_id, restaurant_key, provider, recipient_id, recipient_status, updated_by)
      VALUES (${tenant.tenantId}, ${tenant.restaurantId}, ${tenant.restaurantKey}, ${provider}, ${id}, ${id ? "ACTIVE" : "NOT_SUBMITTED"}, ${record.updatedBy})
      ON CONFLICT (tenant_id, restaurant_id) DO UPDATE SET
        provider = EXCLUDED.provider, recipient_id = EXCLUDED.recipient_id,
        recipient_status = EXCLUDED.recipient_status, recipient_message = '',
        updated_by = EXCLUDED.updated_by, updated_at = NOW()
    `;
    return record;
  });
};

const getRecipient = async (tenant) => {
  const mode = assertStorage();
  if (mode === "file") {
    return (await readLocal()).accounts.find((entry) => entry.tenantId === tenant.tenantId && entry.restaurantId === tenant.restaurantId) || null;
  }
  return asSystem(tenant, async (sql) => {
    const rows = await sql`SELECT * FROM restaurant_payment_accounts WHERE tenant_id = ${tenant.tenantId} AND restaurant_id = ${tenant.restaurantId}`;
    return rows[0] ? fromAccountRow(rows[0]) : null;
  });
};

const listRecipients = async () => {
  const mode = assertStorage();
  if (mode === "file") return (await readLocal()).accounts.filter((entry) => entry.recipientId && (entry.recipientStatus || "ACTIVE") === "ACTIVE");
  return runWithDatabaseScope({ audience: "system" }, async () => {
    try {
      const rows = await getSql()`SELECT * FROM restaurant_payment_accounts WHERE recipient_id <> '' AND recipient_status = 'ACTIVE'`;
      return rows.map(fromAccountRow);
    } catch (error) {
      throw translate(error);
    }
  });
};

const fromAccountRow = (row = {}) => ({
  tenantId: row.tenant_id ?? row.tenantId,
  restaurantId: row.restaurant_id ?? row.restaurantId,
  restaurantKey: row.restaurant_key ?? row.restaurantKey,
  provider: row.provider,
  recipientId: row.recipient_id ?? row.recipientId ?? "",
  recipientStatus: row.recipient_status ?? row.recipientStatus ?? "NOT_SUBMITTED",
  recipientMessage: row.recipient_message ?? row.recipientMessage ?? "",
  enabledMethods: Array.isArray(row.enabled_methods ?? row.enabledMethods) ? row.enabled_methods ?? row.enabledMethods : [],
  holderName: row.holder_name ?? row.holderName ?? "",
  holderDocument: row.holder_document ?? row.holderDocument ?? "",
  holderEmail: row.holder_email ?? row.holderEmail ?? "",
  holderPhone: row.holder_phone ?? row.holderPhone ?? "",
  bankCode: row.bank_code ?? row.bankCode ?? "",
  branchNumber: row.branch_number ?? row.branchNumber ?? "",
  branchCheckDigit: row.branch_check_digit ?? row.branchCheckDigit ?? "",
  accountNumber: row.account_number ?? row.accountNumber ?? "",
  accountCheckDigit: row.account_check_digit ?? row.accountCheckDigit ?? "",
  accountType: row.account_type ?? row.accountType ?? "checking",
  updatedAt: row.updated_at ?? row.updatedAt ?? null,
  updatedBy: row.updated_by ?? row.updatedBy ?? "",
});

// Grava a configuração do restaurante (formas aceitas e/ou conta bancária).
const savePaymentAccount = async (tenant, patch, { actorLogin = "" } = {}) => {
  const mode = assertStorage();
  const updatedBy = String(actorLogin || "").slice(0, 160);
  if (mode === "file") {
    return withLocal((data) => {
      let row = data.accounts.find((entry) => entry.tenantId === tenant.tenantId && entry.restaurantId === tenant.restaurantId);
      if (!row) {
        row = { ...tenant, provider: patch.provider || "pagarme", recipientId: "", recipientStatus: "NOT_SUBMITTED", enabledMethods: [] };
        data.accounts.push(row);
      }
      Object.assign(row, patch, { updatedBy, updatedAt: new Date().toISOString() });
      return fromAccountRow(row);
    });
  }
  return asSystem(tenant, async (sql) => {
    const current = (await sql`SELECT * FROM restaurant_payment_accounts WHERE tenant_id = ${tenant.tenantId} AND restaurant_id = ${tenant.restaurantId}`)[0];
    const next = { ...fromAccountRow(current || { provider: patch.provider || "pagarme" }), ...patch };
    const rows = await sql`
      INSERT INTO restaurant_payment_accounts (
        tenant_id, restaurant_id, restaurant_key, provider, recipient_id, recipient_status, recipient_message,
        enabled_methods, holder_name, holder_document, holder_email, holder_phone, bank_code, branch_number,
        branch_check_digit, account_number, account_check_digit, account_type, updated_by
      ) VALUES (
        ${tenant.tenantId}, ${tenant.restaurantId}, ${tenant.restaurantKey}, ${next.provider}, ${next.recipientId}, ${next.recipientStatus}, ${next.recipientMessage},
        ${JSON.stringify(next.enabledMethods)}::jsonb, ${next.holderName}, ${next.holderDocument}, ${next.holderEmail}, ${next.holderPhone}, ${next.bankCode}, ${next.branchNumber},
        ${next.branchCheckDigit}, ${next.accountNumber}, ${next.accountCheckDigit}, ${next.accountType}, ${updatedBy}
      )
      ON CONFLICT (tenant_id, restaurant_id) DO UPDATE SET
        provider = EXCLUDED.provider, recipient_id = EXCLUDED.recipient_id, recipient_status = EXCLUDED.recipient_status,
        recipient_message = EXCLUDED.recipient_message, enabled_methods = EXCLUDED.enabled_methods,
        holder_name = EXCLUDED.holder_name, holder_document = EXCLUDED.holder_document, holder_email = EXCLUDED.holder_email,
        holder_phone = EXCLUDED.holder_phone, bank_code = EXCLUDED.bank_code, branch_number = EXCLUDED.branch_number,
        branch_check_digit = EXCLUDED.branch_check_digit, account_number = EXCLUDED.account_number,
        account_check_digit = EXCLUDED.account_check_digit, account_type = EXCLUDED.account_type,
        updated_by = EXCLUDED.updated_by, updated_at = NOW()
      RETURNING *
    `;
    return fromAccountRow(rows[0]);
  });
};

module.exports = {
  PAYMENT_STATUSES,
  claimPaymentTransition,
  createPayment,
  findPaymentByOrderId,
  findPaymentByProviderOrderId,
  getPaymentById,
  getRecipient,
  listRecipients,
  savePaymentAccount,
  setRecipient,
  updatePayment,
};
