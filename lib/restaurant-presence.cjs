"use strict";

// "Gestor aberto": o site só aceita pedido quando o Gestor (site ou app) do
// restaurante deu sinal de vida nos últimos minutos. Assim o cliente não fica
// esperando um pedido que ninguém vai ver.
//
// - recordPresence: chamado nas leituras de pedidos do Gestor (ele consulta a
//   cada 10–20 s). Grava no máximo 1 vez a cada 30 s por restaurante.
// - getPresence: usado pelo site e pela criação de pedido.
//
// Segurança: se a tabela ainda não existir (migration não aplicada) ou o banco
// falhar na leitura, o site continua aceitando pedidos como hoje (não trava a
// venda por erro de infraestrutura). Só a sessão do restaurante grava.

const fs = require("node:fs/promises");
const path = require("node:path");
const { neon } = require("./tenant-sql.cjs");
const { getOperationalTenant } = require("./tenant-context.cjs");

const ONLINE_WINDOW_MS = Number(process.env.INOVAS_PRESENCE_WINDOW_MS || 3 * 60 * 1000);
const WRITE_INTERVAL_MS = 30 * 1000;
// "Fechar Gestor": tempos permitidos (minutos).
const PAUSE_OPTIONS_MINUTES = Object.freeze([15, 30, 60, 240]);

let sqlClient = null;
const lastWriteByTenant = new Map();

const getStorageMode = () => {
  if (String(process.env.DATABASE_URL || "").trim()) return "neon";
  return process.env.NODE_ENV === "production" ? "disabled" : "file";
};

const getSql = () => {
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
};

const getLocalFile = () =>
  String(process.env.INOVAS_PRESENCE_FILE || "").trim() ||
  path.join(process.cwd(), ".data", "restaurant-presence.json");

const keyOf = (tenant) => `${tenant.tenantId}::${tenant.restaurantId}`;

// Regra vale para TODOS os restaurantes. Só o servidor de testes local
// (scripts/local-validation-server.cjs) restringe a restaurantes de teste com
// prefixo, para os demais testes continuarem criando pedidos.
// INOVAS_PRESENCE_ENFORCE: vazio/"all" = todos | "prefix:<texto>" = só chaves com o prefixo.
const isEnforcedFor = (restaurantKey = "") => {
  const rule = String(process.env.INOVAS_PRESENCE_ENFORCE || "all").trim();
  if (rule.startsWith("prefix:")) return String(restaurantKey).startsWith(rule.slice("prefix:".length));
  return true;
};

const isMissingTable = (error) => error?.code === "42P01" || /restaurant_presence/.test(String(error?.message || "")) && /does not exist/.test(String(error?.message || ""));

const readLocal = async () => {
  try {
    return JSON.parse(await fs.readFile(getLocalFile(), "utf8")) || {};
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
};

const writeLocal = async (data) => {
  const file = getLocalFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

// Sinal de vida do Gestor. Nunca derruba a requisição que chamou.
const recordPresence = async (options = {}, { source = "gestor", now = Date.now(), force = false } = {}) => {
  try {
    const mode = getStorageMode();
    if (mode === "disabled") return false;
    const tenant = getOperationalTenant(options, "presence:record");
    const key = keyOf(tenant);
    if (!force && now - (lastWriteByTenant.get(key) || 0) < WRITE_INTERVAL_MS) return false;
    lastWriteByTenant.set(key, now);
    const safeSource = String(source || "").slice(0, 40);
    if (mode === "file") {
      const data = await readLocal();
      // Mantém a pausa ("Fechar Gestor"): só atualiza o sinal de vida.
      data[key] = { ...(data[key] || {}), lastSeenAt: new Date(now).toISOString(), source: safeSource, restaurantKey: tenant.restaurantKey };
      await writeLocal(data);
      return true;
    }
    await getSql()`
      INSERT INTO restaurant_presence (tenant_id, restaurant_id, restaurant_key, last_seen_at, last_source)
      VALUES (${tenant.tenantId}, ${tenant.restaurantId}, ${tenant.restaurantKey}, ${new Date(now).toISOString()}, ${safeSource})
      ON CONFLICT (tenant_id, restaurant_id)
      DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at, last_source = EXCLUDED.last_source
    `;
    return true;
  } catch (error) {
    if (!isMissingTable(error)) console.warn("[presence] falha ao registrar sinal do Gestor:", error?.message || error);
    return false;
  }
};

// { online, known, lastSeenAt }. known=false: sem dado confiável (tabela
// ausente/erro) -> online=true para não bloquear vendas por falha técnica.
const getPresence = async (options = {}, { now = Date.now() } = {}) => {
  const mode = getStorageMode();
  if (mode === "disabled") return { online: true, known: false, lastSeenAt: "" };
  let tenant;
  try {
    tenant = getOperationalTenant(options, "presence:read");
  } catch {
    return { online: true, known: false, lastSeenAt: "" };
  }
  if (!isEnforcedFor(tenant.restaurantKey)) return { online: true, known: false, lastSeenAt: "" };
  try {
    let lastSeenAt = "";
    let pausedUntil = "";
    if (mode === "file") {
      const entry = (await readLocal())[keyOf(tenant)] || {};
      lastSeenAt = entry.lastSeenAt || "";
      pausedUntil = entry.pausedUntil || "";
    } else {
      const rows = await getSql()`
        SELECT last_seen_at, paused_until FROM restaurant_presence
        WHERE tenant_id = ${tenant.tenantId} AND restaurant_id = ${tenant.restaurantId}
      `;
      lastSeenAt = rows[0]?.last_seen_at ? new Date(rows[0].last_seen_at).toISOString() : "";
      pausedUntil = rows[0]?.paused_until ? new Date(rows[0].paused_until).toISOString() : "";
    }
    const seen = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
    const pauseEnds = pausedUntil ? new Date(pausedUntil).getTime() : 0;
    const paused = pauseEnds > now;
    const gestorSeen = Boolean(seen) && now - seen <= ONLINE_WINDOW_MS;
    return {
      online: gestorSeen && !paused,
      gestorSeen,
      paused,
      pausedUntil: paused ? pausedUntil : "",
      known: true,
      lastSeenAt,
    };
  } catch (error) {
    if (!isMissingTable(error)) console.warn("[presence] falha ao ler sinal do Gestor:", error?.message || error);
    return { online: true, known: false, lastSeenAt: "" };
  }
};

// "Fechar Gestor" por N minutos (15/30/60/240) ou reabrir (minutes = 0).
const setPause = async (options = {}, { minutes = 0, actorLogin = "", now = Date.now() } = {}) => {
  const value = Number(minutes);
  if (value !== 0 && !PAUSE_OPTIONS_MINUTES.includes(value)) {
    throw Object.assign(new Error("Tempo de fechamento invalido."), {
      statusCode: 400,
      errorCode: "presence_pause_invalid",
    });
  }
  const mode = getStorageMode();
  if (mode === "disabled") throw Object.assign(new Error("Armazenamento indisponivel."), { statusCode: 503 });
  const tenant = getOperationalTenant(options, "presence:pause");
  const pausedUntil = value ? new Date(now + value * 60000).toISOString() : null;
  const login = String(actorLogin || "").slice(0, 160);
  if (mode === "file") {
    const data = await readLocal();
    const key = keyOf(tenant);
    data[key] = {
      ...(data[key] || { lastSeenAt: new Date(now).toISOString(), source: "gestor" }),
      restaurantKey: tenant.restaurantKey,
      pausedUntil: pausedUntil || "",
      pausedBy: login,
    };
    await writeLocal(data);
  } else {
    await getSql()`
      INSERT INTO restaurant_presence (tenant_id, restaurant_id, restaurant_key, last_seen_at, last_source, paused_until, paused_by_login)
      VALUES (${tenant.tenantId}, ${tenant.restaurantId}, ${tenant.restaurantKey}, ${new Date(now).toISOString()}, 'gestor', ${pausedUntil}, ${login})
      ON CONFLICT (tenant_id, restaurant_id)
      DO UPDATE SET paused_until = EXCLUDED.paused_until, paused_by_login = EXCLUDED.paused_by_login
    `;
  }
  return { pausedUntil: pausedUntil || "" };
};

const resetPresenceThrottle = () => lastWriteByTenant.clear();

module.exports = {
  ONLINE_WINDOW_MS,
  PAUSE_OPTIONS_MINUTES,
  setPause,
  WRITE_INTERVAL_MS,
  getPresence,
  recordPresence,
  resetPresenceThrottle,
};
