"use strict";

// Sessões do CLIENTE em cada restaurante (site de pedidos).
//
// A identidade de login (Google ou e-mail e senha) é única na plataforma, mas a
// sessão vale para UM restaurante: o cookie do site do Tokyo não abre o site
// do Kasulo. A sessão fica guardada no servidor (só o hash do token), então
// "Sair" e a troca de senha derrubam a sessão de verdade.
//
// Armazenamento: Neon (tabela customer_sessions, com RLS por restaurante) ou
// arquivo local nos testes. Em produção sem banco, falha fechado.

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { buildHttpError } = require("./http.cjs");
const { neon, runWithDatabaseScope } = require("./tenant-sql.cjs");

const SESSION_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 dias, renovados com o uso
const SESSION_RENEW_AFTER_MS = 24 * 60 * 60 * 1000; // renova no máximo 1x por dia

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
const localFile = () =>
  String(process.env.INOVAS_CUSTOMER_SESSIONS_FILE || "").trim() ||
  path.join(process.cwd(), ".data", "customer-sessions.json");

const readLocal = async () => {
  try {
    return JSON.parse(await fs.readFile(localFile(), "utf8")).sessions || [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
};
const writeLocal = async (sessions) => {
  await fs.mkdir(path.dirname(localFile()), { recursive: true });
  await fs.writeFile(localFile(), `${JSON.stringify({ sessions }, null, 2)}\n`, "utf8");
};
const withFileLock = (task) => {
  const run = fileQueue.then(task, task);
  fileQueue = run.catch(() => {});
  return run;
};

const hashSessionToken = (token) =>
  crypto.createHash("sha256").update(String(token || "")).digest("hex");
const createSessionToken = () => crypto.randomBytes(32).toString("base64url");

// Sem restaurante não existe sessão de cliente.
const assertTenant = (tenantContext) => {
  const tenantId = String(tenantContext?.tenantId || "").trim();
  const restaurantId = String(tenantContext?.restaurantId || "").trim();
  const restaurantKey = String(tenantContext?.restaurantKey || "").trim();
  if (!tenantId || !restaurantId || !restaurantKey) {
    throw buildHttpError(400, "Restaurante nao identificado.", "tenant_context_required");
  }
  return { tenantId, restaurantId, restaurantKey };
};

const assertStorage = () => {
  const mode = getStorageMode();
  if (mode === "disabled") {
    throw buildHttpError(503, "Login de clientes ainda nao ativado.", "customer_sessions_not_configured");
  }
  return mode;
};

const translate = (error) =>
  error?.code === "42P01" || /customer_sessions/.test(String(error?.message || ""))
    ? buildHttpError(503, "Login de clientes ainda nao ativado.", "customer_sessions_not_configured")
    : error;

// Consultas no escopo "public" DO restaurante: o RLS só deixa ver as linhas dele.
const asRestaurant = (tenant, callback) =>
  runWithDatabaseScope(
    { audience: "public", tenantId: tenant.tenantId, restaurantId: tenant.restaurantId, restaurantKey: tenant.restaurantKey },
    async () => {
      try {
        return await callback(getSql());
      } catch (error) {
        throw translate(error);
      }
    }
  );

const fromRow = (row) => ({
  tokenHash: row.token_hash ?? row.tokenHash,
  tenantId: row.tenant_id ?? row.tenantId,
  restaurantId: row.restaurant_id ?? row.restaurantId,
  restaurantKey: row.restaurant_key ?? row.restaurantKey,
  identityId: row.identity_id ?? row.identityId,
  customerKey: row.customer_key ?? row.customerKey,
  name: row.customer_name ?? row.name ?? "",
  phone: row.customer_phone ?? row.phone ?? "",
  email: row.customer_email ?? row.email ?? "",
  createdAt: new Date(row.created_at ?? row.createdAt).toISOString(),
  lastSeenAt: new Date(row.last_seen_at ?? row.lastSeenAt).toISOString(),
  expiresAt: new Date(row.expires_at ?? row.expiresAt).toISOString(),
  revokedAt: row.revoked_at ?? row.revokedAt ?? null,
});

const isActive = (session, now = Date.now()) =>
  Boolean(session) && !session.revokedAt && new Date(session.expiresAt).getTime() > now;

// Cria a sessão do cliente neste restaurante e devolve o token (vai só no cookie).
const createCustomerSession = async (tenantContext, customer) => {
  const tenant = assertTenant(tenantContext);
  const identityId = String(customer?.identityId || "").trim();
  const customerKey = String(customer?.customerKey || "").trim();
  if (!identityId || !customerKey) {
    throw buildHttpError(400, "Cliente nao identificado.", "customer_identity_required");
  }
  const token = createSessionToken();
  const now = new Date();
  const record = {
    tokenHash: hashSessionToken(token),
    ...tenant,
    identityId,
    customerKey,
    name: String(customer.name || "").slice(0, 160),
    phone: String(customer.phone || "").slice(0, 32),
    email: String(customer.email || "").slice(0, 320).toLowerCase(),
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    revokedAt: null,
  };
  const mode = assertStorage();
  if (mode === "file") {
    await withFileLock(async () => {
      const sessions = (await readLocal()).filter((entry) => isActive(entry));
      sessions.push(record);
      await writeLocal(sessions);
    });
  } else {
    await asRestaurant(tenant, (sql) => sql`
      INSERT INTO customer_sessions (
        token_hash, tenant_id, restaurant_id, restaurant_key, identity_id, customer_key,
        customer_name, customer_phone, customer_email, created_at, last_seen_at, expires_at
      ) VALUES (
        ${record.tokenHash}, ${tenant.tenantId}, ${tenant.restaurantId}, ${tenant.restaurantKey},
        ${record.identityId}, ${record.customerKey}, ${record.name}, ${record.phone}, ${record.email},
        ${record.createdAt}, ${record.lastSeenAt}, ${record.expiresAt}
      )
    `);
  }
  return { token, session: record };
};

// Lê a sessão do token, SÓ dentro do restaurante da requisição. Renova a validade com o uso.
const findCustomerSession = async (tenantContext, token) => {
  if (!token) return null;
  const tenant = assertTenant(tenantContext);
  const tokenHash = hashSessionToken(token);
  const mode = assertStorage();
  const now = Date.now();
  let session = null;
  if (mode === "file") {
    session = (await readLocal()).find(
      (entry) =>
        entry.tokenHash === tokenHash &&
        entry.tenantId === tenant.tenantId &&
        entry.restaurantId === tenant.restaurantId &&
        entry.restaurantKey === tenant.restaurantKey
    );
  } else {
    const rows = await asRestaurant(tenant, (sql) => sql`
      SELECT * FROM customer_sessions
      WHERE token_hash = ${tokenHash}
        AND tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
      LIMIT 1
    `);
    session = rows[0] ? fromRow(rows[0]) : null;
  }
  if (!isActive(session, now)) return null;
  if (now - new Date(session.lastSeenAt).getTime() > SESSION_RENEW_AFTER_MS) {
    await touchCustomerSession(tenant, tokenHash, now).catch(() => {});
  }
  return session;
};

const touchCustomerSession = async (tenant, tokenHash, now = Date.now()) => {
  const lastSeenAt = new Date(now).toISOString();
  const expiresAt = new Date(now + SESSION_TTL_MS).toISOString();
  if (getStorageMode() === "file") {
    return withFileLock(async () => {
      const sessions = await readLocal();
      const target = sessions.find((entry) => entry.tokenHash === tokenHash && entry.tenantId === tenant.tenantId);
      if (target && isActive(target)) {
        target.lastSeenAt = lastSeenAt;
        target.expiresAt = expiresAt;
        await writeLocal(sessions);
      }
    });
  }
  return asRestaurant(tenant, (sql) => sql`
    UPDATE customer_sessions SET last_seen_at = ${lastSeenAt}, expires_at = ${expiresAt}
    WHERE token_hash = ${tokenHash} AND tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId} AND revoked_at IS NULL
  `);
};

// Atualiza nome/telefone guardados na sessão (ex.: telefone pedido depois do login com Google).
const updateCustomerSessionProfile = async (tenantContext, token, profile = {}) => {
  const tenant = assertTenant(tenantContext);
  const tokenHash = hashSessionToken(token);
  const name = String(profile.name || "").slice(0, 160);
  const phone = String(profile.phone || "").slice(0, 32);
  const customerKey = String(profile.customerKey || "").trim();
  if (getStorageMode() === "file") {
    return withFileLock(async () => {
      const sessions = await readLocal();
      const target = sessions.find((entry) => entry.tokenHash === tokenHash && entry.tenantId === tenant.tenantId);
      if (target && isActive(target)) {
        if (name) target.name = name;
        if (phone) target.phone = phone;
        if (customerKey) target.customerKey = customerKey;
        await writeLocal(sessions);
      }
    });
  }
  return asRestaurant(tenant, (sql) => sql`
    UPDATE customer_sessions SET
      customer_name = CASE WHEN ${name} = '' THEN customer_name ELSE ${name} END,
      customer_phone = CASE WHEN ${phone} = '' THEN customer_phone ELSE ${phone} END,
      customer_key = CASE WHEN ${customerKey} = '' THEN customer_key ELSE ${customerKey} END
    WHERE token_hash = ${tokenHash} AND tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId} AND revoked_at IS NULL
  `);
};

// "Sair": derruba esta sessão neste restaurante.
const revokeCustomerSession = async (tenantContext, token) => {
  if (!token) return;
  const tenant = assertTenant(tenantContext);
  const tokenHash = hashSessionToken(token);
  const revokedAt = new Date().toISOString();
  if (getStorageMode() === "file") {
    return withFileLock(async () => {
      const sessions = await readLocal();
      const target = sessions.find((entry) => entry.tokenHash === tokenHash && entry.tenantId === tenant.tenantId);
      if (target) {
        target.revokedAt = revokedAt;
        await writeLocal(sessions);
      }
    });
  }
  return asRestaurant(tenant, (sql) => sql`
    UPDATE customer_sessions SET revoked_at = ${revokedAt}
    WHERE token_hash = ${tokenHash} AND tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId} AND revoked_at IS NULL
  `);
};

// Troca de senha: derruba as sessões desta pessoa em TODOS os restaurantes.
// Única operação entre restaurantes; roda no escopo "system" (só o servidor).
const revokeAllSessionsForIdentity = async (identityId) => {
  const id = String(identityId || "").trim();
  if (!id) return;
  const revokedAt = new Date().toISOString();
  const mode = getStorageMode();
  if (mode === "disabled") return;
  if (mode === "file") {
    return withFileLock(async () => {
      const sessions = await readLocal();
      let changed = false;
      sessions.forEach((entry) => {
        if (entry.identityId === id && !entry.revokedAt) {
          entry.revokedAt = revokedAt;
          changed = true;
        }
      });
      if (changed) await writeLocal(sessions);
    });
  }
  return runWithDatabaseScope({ audience: "system" }, async () => {
    try {
      await getSql()`UPDATE customer_sessions SET revoked_at = ${revokedAt} WHERE identity_id = ${id} AND revoked_at IS NULL`;
    } catch (error) {
      throw translate(error);
    }
  });
};

module.exports = {
  SESSION_TTL_MS,
  createCustomerSession,
  findCustomerSession,
  hashSessionToken,
  revokeAllSessionsForIdentity,
  revokeCustomerSession,
  updateCustomerSessionProfile,
};
