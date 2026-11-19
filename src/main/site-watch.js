"use strict";

// Percebe quando o site do Gestor foi publicado de novo (o arquivo
// /admin/admin.js mudou) para o app recarregar a tela sozinho, sem precisar
// fechar e abrir. Lê só o cabeçalho (ETag / Last-Modified), sem baixar o arquivo.
//
// O recarregamento espera o operador ficar parado (sem tecla nem clique) para
// não apagar algo que ele está digitando.

const DEFAULT_INTERVAL_MS = 3 * 60 * 1000;
const DEFAULT_IDLE_MS = 60 * 1000;

const fingerprintOf = (response) => {
  const headers = response?.headers;
  const read = (name) => (headers && typeof headers.get === "function" ? headers.get(name) : "") || "";
  const etag = read("etag").replace(/^W\//, "");
  if (etag) return `etag:${etag}`;
  const modified = read("last-modified");
  if (modified) return `modified:${modified}`;
  return "";
};

const createSiteWatcher = ({
  fetchImpl,
  getUrl,
  onChange,
  intervalMs = DEFAULT_INTERVAL_MS,
  log = () => {},
  setTimer = setInterval,
  clearTimer = clearInterval,
} = {}) => {
  let baseline = "";
  let timer = null;

  const check = async () => {
    const url = typeof getUrl === "function" ? getUrl() : "";
    if (!url) return false;
    try {
      const response = await fetchImpl(url, { method: "HEAD", cache: "no-store" });
      if (!response || !response.ok) return false;
      const fingerprint = fingerprintOf(response);
      if (!fingerprint) return false;
      if (!baseline) {
        baseline = fingerprint;
        return false;
      }
      if (fingerprint === baseline) return false;
      log("site publicado de novo", baseline, "->", fingerprint);
      baseline = fingerprint;
      onChange?.();
      return true;
    } catch (error) {
      log("falha ao conferir o site", error?.message || error);
      return false;
    }
  };

  return {
    check,
    // Depois de recarregar a tela, a versão carregada passa a ser a base.
    reset: () => {
      baseline = "";
    },
    start: () => {
      if (timer) return;
      void check();
      timer = setTimer(() => void check(), intervalMs);
      if (timer && typeof timer.unref === "function") timer.unref();
    },
    stop: () => {
      if (timer) clearTimer(timer);
      timer = null;
    },
  };
};

// Decide se já dá para recarregar: tem atualização pendente e o operador
// está parado há tempo suficiente (ou a tela do Gestor nem está visível).
const shouldReloadNow = ({ pending, lastInputAt, now, idleMs = DEFAULT_IDLE_MS, gestorVisible = true }) => {
  if (!pending) return false;
  if (!gestorVisible) return true;
  return now - (Number(lastInputAt) || 0) >= idleMs;
};

module.exports = { DEFAULT_IDLE_MS, DEFAULT_INTERVAL_MS, createSiteWatcher, fingerprintOf, shouldReloadNow };
