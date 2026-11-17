"use strict";

// Ações do Caixa com código único (operationId), para o caixa offline.
//
// O caixa local grava cada ação numa fila e, quando a internet volta, envia
// para a nuvem. Se a conexão cair no meio do envio, a mesma ação pode chegar
// duas vezes. Com o operationId a nuvem executa só uma vez:
//
//   1ª vez  -> reserva o código, executa e guarda o resultado;
//   de novo -> não executa; devolve o resultado guardado (replayed: true).
//
// Erro de regra (4xx, ex.: comanda já fechada) também fica guardado: reenviar
// devolve o mesmo erro. Erro de servidor/conexão (5xx) libera o código para
// tentar de novo. Ação sem operationId segue como sempre (sem mudança).
//
// Tudo por restaurante (tenant + restaurante) e com RLS no banco.

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { neon } = require("./tenant-sql.cjs");
const { assertMigrationManagedRelations } = require("./database-schema.cjs");
const { buildHttpError } = require("./http.cjs");
const { getOperationalTenant } = require("./tenant-context.cjs");

// Calculado na hora de usar: o servidor de testes troca de pasta ao iniciar.
const getLocalFile = () =>
  String(process.env.INOVAS_CASH_OPERATIONS_FILE || "").trim() ||
  path.join(process.cwd(), ".data", "cash-register-operations.json");
const OPERATION_ID_PATTERN = /^op_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let sqlClient = null;
let schemaChecked = null;
let localQueue = Promise.resolve();

const getStorageMode = () => {
  if (String(process.env.DATABASE_URL || "").trim()) return "neon";
  return process.env.NODE_ENV === "production" ? "disabled" : "file";
};

const getSql = () => {
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
};

const isValidOperationId = (value) => OPERATION_ID_PATTERN.test(String(value || ""));

// JSON com chaves em ordem: a mesma ação gera sempre a mesma impressão digital.
const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
};

// Impressão digital da ação: mesma ação + mesmos dados (sem o operationId).
const hashRequest = (action, body = {}) => {
  const { operationId: _ignored, ...rest } = body || {};
  return crypto.createHash("sha256").update(stableStringify([action, rest])).digest("hex");
};

// Erro de regra: guardar e repetir. Erro de servidor/conexão: deixar tentar de novo.
const isPermanentFailure = (error) => {
  const status = Number(error?.statusCode || 0);
  return status >= 400 && status < 500 && ![408, 409, 429].includes(status);
};

const toStoredError = (error) => ({
  statusCode: Number(error?.statusCode || 500),
  message: String(error?.message || "Falha na operação do Caixa.").slice(0, 500),
  errorCode: String(error?.errorCode || "cash_register_operation_failed").slice(0, 120),
});

const rethrowStored = (stored) => {
  throw buildHttpError(stored.statusCode || 400, stored.message, stored.errorCode, { replayed: true });
};

const conflict = (message, errorCode) => buildHttpError(409, message, errorCode);

/* ------------------------------ Neon ------------------------------ */

const ensureNeonSchema = async () => {
  if (!schemaChecked) {
    schemaChecked = assertMigrationManagedRelations({
      sql: getSql(),
      relations: ["cash_register_operations"],
      component: "operações do caixa offline",
    }).catch((error) => {
      schemaChecked = null;
      throw error;
    });
  }
  return schemaChecked;
};

const neonStore = {
  async reserve(tenant, record) {
    await ensureNeonSchema();
    const sql = getSql();
    const inserted = await sql`
      INSERT INTO cash_register_operations (
        tenant_id, restaurant_id, restaurant_key, operation_id, action,
        request_hash, status, actor_identity_id, actor_login
      ) VALUES (
        ${tenant.tenantId}, ${tenant.restaurantId}, ${tenant.restaurantKey},
        ${record.operationId}, ${record.action}, ${record.requestHash}, 'PENDING',
        ${record.actorIdentityId}, ${record.actorLogin}
      )
      ON CONFLICT (tenant_id, restaurant_id, operation_id) DO NOTHING
      RETURNING operation_id
    `;
    if (inserted.length) return null;
    const rows = await sql`
      SELECT action, request_hash, status, result_json, error_json
      FROM cash_register_operations
      WHERE tenant_id = ${tenant.tenantId}
        AND restaurant_id = ${tenant.restaurantId}
        AND operation_id = ${record.operationId}
    `;
    const row = rows[0];
    return row
      ? {
          action: row.action,
          requestHash: row.request_hash,
          status: row.status,
          result: row.result_json,
          error: row.error_json,
        }
      : null;
  },
  async complete(tenant, operationId, result) {
    await getSql()`
      UPDATE cash_register_operations
      SET status = 'DONE', result_json = ${JSON.stringify(result ?? null)}::jsonb, completed_at = NOW()
      WHERE tenant_id = ${tenant.tenantId} AND restaurant_id = ${tenant.restaurantId}
        AND operation_id = ${operationId}
    `;
  },
  async fail(tenant, operationId, storedError) {
    await getSql()`
      UPDATE cash_register_operations
      SET status = 'FAILED', error_json = ${JSON.stringify(storedError)}::jsonb, completed_at = NOW()
      WHERE tenant_id = ${tenant.tenantId} AND restaurant_id = ${tenant.restaurantId}
        AND operation_id = ${operationId}
    `;
  },
  async release(tenant, operationId) {
    await getSql()`
      DELETE FROM cash_register_operations
      WHERE tenant_id = ${tenant.tenantId} AND restaurant_id = ${tenant.restaurantId}
        AND operation_id = ${operationId} AND status = 'PENDING'
    `;
  },
};

/* ---------------------- Arquivo local (dev/testes/caixa local) ---------------------- */

const readLocal = async () => {
  try {
    const parsed = JSON.parse(await fs.readFile(getLocalFile(), "utf8"));
    return parsed && typeof parsed === "object" && parsed.scopes ? parsed : { version: 1, scopes: {} };
  } catch (error) {
    if (error.code === "ENOENT") return { version: 1, scopes: {} };
    throw error;
  }
};

const writeLocal = async (data) => {
  const file = getLocalFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(temporary, file);
};

const withLocal = (tenant, callback) => {
  const run = async () => {
    const data = await readLocal();
    const key = `${tenant.tenantId}::${tenant.restaurantId}`;
    data.scopes[key] = data.scopes[key] || {};
    const result = await callback(data.scopes[key]);
    await writeLocal(data);
    return result;
  };
  const task = localQueue.then(run, run);
  localQueue = task.catch(() => undefined);
  return task;
};

const localStore = {
  reserve: (tenant, record) =>
    withLocal(tenant, (scope) => {
      const existing = scope[record.operationId];
      if (existing) return { ...existing };
      scope[record.operationId] = {
        action: record.action,
        requestHash: record.requestHash,
        status: "PENDING",
        result: null,
        error: null,
        createdAt: new Date().toISOString(),
      };
      return null;
    }),
  complete: (tenant, operationId, result) =>
    withLocal(tenant, (scope) => {
      if (scope[operationId]) Object.assign(scope[operationId], { status: "DONE", result: result ?? null });
    }),
  fail: (tenant, operationId, storedError) =>
    withLocal(tenant, (scope) => {
      if (scope[operationId]) Object.assign(scope[operationId], { status: "FAILED", error: storedError });
    }),
  release: (tenant, operationId) =>
    withLocal(tenant, (scope) => {
      if (scope[operationId]?.status === "PENDING") delete scope[operationId];
    }),
};

/* ------------------------------ Execução ------------------------------ */

// execute(): roda a ação do caixa e devolve o resultado (o mesmo de hoje).
// Sempre devolve { result, replayed }.
const runCashOperation = async ({ operationId, action, body, actor = {}, options = {}, execute }) => {
  if (operationId === undefined || operationId === null || operationId === "") {
    return { result: await execute(), replayed: false };
  }
  if (!isValidOperationId(operationId)) {
    throw buildHttpError(400, "Código da operação inválido.", "cash_operation_id_invalid");
  }
  const mode = getStorageMode();
  if (mode === "disabled") return { result: await execute(), replayed: false };
  const tenant = getOperationalTenant(options, `cash-register:operation:${action}`);
  const store = mode === "neon" ? neonStore : localStore;
  const record = {
    operationId,
    action,
    requestHash: hashRequest(action, body),
    actorIdentityId: String(actor.identityId || "").slice(0, 160),
    actorLogin: String(actor.login || actor.email || "").slice(0, 160),
  };

  const existing = await store.reserve(tenant, record);
  if (existing) {
    if (existing.action !== action || existing.requestHash !== record.requestHash) {
      throw conflict("Este código de operação já foi usado em outra ação.", "cash_operation_conflict");
    }
    if (existing.status === "DONE") return { result: existing.result, replayed: true };
    if (existing.status === "FAILED") rethrowStored(existing.error || {});
    throw conflict("Esta operação ainda está sendo processada. Tente de novo em instantes.", "cash_operation_in_progress");
  }

  let result;
  try {
    result = await execute();
  } catch (error) {
    if (isPermanentFailure(error)) {
      await store.fail(tenant, operationId, toStoredError(error));
    } else {
      await store.release(tenant, operationId).catch(() => undefined);
    }
    throw error;
  }
  await store.complete(tenant, operationId, result);
  return { result, replayed: false };
};

module.exports = {
  OPERATION_ID_PATTERN,
  hashRequest,
  isValidOperationId,
  runCashOperation,
};
