"use strict";

// Medição de tempo por pedido da API: total e quanto foi gasto no banco.
// Vai no cabeçalho Server-Timing (aparece na aba Rede do navegador), sem
// nenhum dado de cliente ou restaurante. Serve para achar a parte lenta.
const { AsyncLocalStorage } = require("node:async_hooks");

const timingStorage = new AsyncLocalStorage();

const now = () => Number(process.hrtime.bigint()) / 1e6;

const recordDatabaseTime = (milliseconds) => {
  const store = timingStorage.getStore();
  if (!store) return;
  store.dbCount += 1;
  store.dbMs += milliseconds;
};

const buildServerTimingHeader = (store) => {
  const total = Math.max(0, now() - store.startedAt);
  return [
    `db;dur=${store.dbMs.toFixed(1)};desc="banco (${store.dbCount} ${store.dbCount === 1 ? "consulta" : "consultas"})"`,
    `app;dur=${Math.max(0, total - store.dbMs).toFixed(1)};desc="servidor"`,
    `total;dur=${total.toFixed(1)}`,
  ].join(", ");
};

const withRequestTiming = (handler) => {
  if (typeof handler !== "function" || handler.__withRequestTiming) return handler;

  const timedHandler = (req, res) => {
    // Pedido já medido por outro handler (ex.: /api/reviews chama o catálogo).
    if (timingStorage.getStore()) return handler(req, res);

    const store = { startedAt: now(), dbMs: 0, dbCount: 0 };
    if (res && typeof res.writeHead === "function" && typeof res.setHeader === "function") {
      const originalWriteHead = res.writeHead;
      res.writeHead = function writeHeadWithTiming(...args) {
        try {
          if (!res.headersSent && !res.getHeader("Server-Timing")) {
            res.setHeader("Server-Timing", buildServerTimingHeader(store));
          }
        } catch {
          // Medição nunca pode derrubar a resposta.
        }
        return originalWriteHead.apply(this, args);
      };
    }
    return timingStorage.run(store, () => handler(req, res));
  };

  timedHandler.__withRequestTiming = true;
  Object.assign(timedHandler, handler);
  return timedHandler;
};

module.exports = {
  buildServerTimingHeader,
  recordDatabaseTime,
  withRequestTiming,
};
