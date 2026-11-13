"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { normalizeServerUrl } = require("../shared/modules");

// Servidor padrão: o Gestor de produção. Para usar o Preview ou um servidor
// local de teste, troque na tela de login (link "Servidor") ou rode o app com
// INOVAS_PDV_SERVER=<url>.
const DEFAULT_SERVER_URL = "https://inovasfood.com.br";

const createConfig = ({ directory, env = process.env }) => {
  const filePath = path.join(directory, "config.json");
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(filePath, "utf8")) || {};
  } catch {
    data = {};
  }

  const persist = () => {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  };

  const envServer = normalizeServerUrl(env.INOVAS_PDV_SERVER);

  return {
    getServerUrl: () => envServer || normalizeServerUrl(data.serverUrl) || DEFAULT_SERVER_URL,
    isServerLocked: () => Boolean(envServer),
    setServerUrl(value) {
      const url = normalizeServerUrl(value);
      if (!url) return null;
      data.serverUrl = url;
      persist();
      return url;
    },
    get(key, fallback) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : fallback;
    },
    set(key, value) {
      data[key] = value;
      persist();
    },
  };
};

module.exports = { DEFAULT_SERVER_URL, createConfig };
