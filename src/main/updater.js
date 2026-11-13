"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

// Atualização do app pelo botão "Atualizar".
//
// Onde fica a versão publicada: no Release "gestor-pdv" do GitHub, o mesmo do
// botão "Baixar Gestor" do site. Cada versão nova troca dois arquivos lá:
//   INOVAS-PDV-Setup.exe  (o instalador)
//   latest.yml            (versão, tamanho e sha512 do instalador; gerado por
//                          scripts/update-manifest.js no GitHub Actions)
//
// O app só baixa desse endereço (e dos servidores de arquivos do GitHub para
// onde ele redireciona), confere tamanho e sha512 antes de rodar o instalador
// e nunca instala sozinho: o operador clica em "Atualizar".
//
// Limite: o instalador não é assinado. O sha512 garante que o arquivo é o
// publicado no Release, não quem publicou. Com certificado de assinatura, o
// Windows passa a conferir também o autor.

const DEFAULT_FEED_URL =
  "https://github.com/Paulo-Novais/tokyo-sushi-delivery-site/releases/download/gestor-pdv";
const ALLOWED_DOWNLOAD_HOSTS = Object.freeze([
  "github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
]);
const MAX_INSTALLER_BYTES = 400 * 1024 * 1024;

class UpdateError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

// Lê só o que precisamos do latest.yml (formato do electron-builder).
const parseManifest = (text) => {
  const lines = String(text || "").split(/\r?\n/);
  const top = {};
  const files = [];
  let inFiles = false;
  let current = null;
  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const topMatch = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(raw);
    if (topMatch) {
      inFiles = topMatch[1] === "files" && topMatch[2] === "";
      current = null;
      if (!inFiles) top[topMatch[1]] = unquote(topMatch[2]);
      continue;
    }
    if (!inFiles) continue;
    const item = /^\s*-\s+([A-Za-z0-9_]+):\s*(.*)$/.exec(raw);
    const field = /^\s+([A-Za-z0-9_]+):\s*(.*)$/.exec(raw);
    if (item) {
      current = { [item[1]]: unquote(item[2]) };
      files.push(current);
    } else if (field && current) {
      current[field[1]] = unquote(field[2]);
    }
  }
  const fileName = top.path || files[0]?.url || "";
  const file = files.find((entry) => entry.url === fileName) || files[0] || {};
  const manifest = {
    version: String(top.version || ""),
    fileName: String(fileName),
    sha512: String(file.sha512 || top.sha512 || ""),
    size: Number(file.size || 0),
    releaseDate: String(top.releaseDate || ""),
  };
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new UpdateError("Versão inválida no latest.yml.", "bad_manifest");
  if (!/^[A-Za-z0-9._-]+\.exe$/.test(manifest.fileName)) throw new UpdateError("Arquivo inválido no latest.yml.", "bad_manifest");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(manifest.sha512) || manifest.sha512.length < 80) {
    throw new UpdateError("sha512 inválido no latest.yml.", "bad_manifest");
  }
  if (!Number.isFinite(manifest.size) || manifest.size <= 0 || manifest.size > MAX_INSTALLER_BYTES) {
    throw new UpdateError("Tamanho inválido no latest.yml.", "bad_manifest");
  }
  return manifest;
};

const unquote = (value) => String(value || "").trim().replace(/^(['"])(.*)\1$/, "$2");

const buildManifest = ({ version, fileName, sha512, size, releaseDate = new Date().toISOString() }) =>
  [
    `version: ${version}`,
    "files:",
    `  - url: ${fileName}`,
    `    sha512: ${sha512}`,
    `    size: ${size}`,
    `path: ${fileName}`,
    `sha512: ${sha512}`,
    `releaseDate: '${releaseDate}'`,
    "",
  ].join("\n");

const compareVersions = (a, b) => {
  const pa = String(a).split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0) ? 1 : -1;
  }
  return 0;
};

const normalizeFeedUrl = (value, { allowLocal = false } = {}) => {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    return null;
  }
  const local = ["127.0.0.1", "localhost"].includes(url.hostname);
  if (url.protocol === "https:" && ALLOWED_DOWNLOAD_HOSTS.includes(url.hostname)) {
    return url.toString().replace(/\/+$/, "");
  }
  if (allowLocal && local && url.protocol === "http:") return url.toString().replace(/\/+$/, "");
  return null;
};

const createUpdater = ({
  feedUrl = DEFAULT_FEED_URL,
  currentVersion,
  fetchImpl = globalThis.fetch,
  downloadDir,
  allowLocal = false,
}) => {
  const base = normalizeFeedUrl(feedUrl, { allowLocal });
  if (!base) throw new UpdateError("Endereço de atualização não permitido.", "bad_feed");

  const checkHost = (rawUrl) => {
    const url = new URL(rawUrl);
    const local = allowLocal && ["127.0.0.1", "localhost"].includes(url.hostname) && url.protocol === "http:";
    if (!local && !(url.protocol === "https:" && ALLOWED_DOWNLOAD_HOSTS.includes(url.hostname))) {
      throw new UpdateError(`Download recusado: ${url.hostname} não é um servidor permitido.`, "bad_host");
    }
  };

  const get = async (url) => {
    let response;
    try {
      response = await fetchImpl(url, { redirect: "follow", cache: "no-store" });
    } catch {
      throw new UpdateError("Sem conexão para procurar atualização.", "offline");
    }
    checkHost(response.url || url);
    if (!response.ok) throw new UpdateError(`Servidor de atualização respondeu ${response.status}.`, "http_error");
    return response;
  };

  let latest = null;

  const check = async () => {
    const response = await get(`${base}/latest.yml?t=${Date.now()}`);
    latest = parseManifest(await response.text());
    return {
      currentVersion,
      latestVersion: latest.version,
      available: compareVersions(latest.version, currentVersion) > 0,
    };
  };

  const download = async (onProgress = () => {}) => {
    if (!latest) await check();
    const manifest = latest;
    const response = await get(`${base}/${encodeURIComponent(manifest.fileName)}`);
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared && declared !== manifest.size) {
      throw new UpdateError("O instalador publicado não bate com o latest.yml (tamanho).", "size_mismatch");
    }
    fs.mkdirSync(downloadDir, { recursive: true });
    const target = path.join(downloadDir, `INOVAS-PDV-Setup-${manifest.version}.exe`);
    const partial = `${target}.part`;
    const hash = crypto.createHash("sha512");
    const out = fs.createWriteStream(partial);
    let received = 0;
    try {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.length;
        if (received > manifest.size) throw new UpdateError("Download maior que o esperado.", "size_mismatch");
        hash.update(value);
        if (!out.write(Buffer.from(value))) await new Promise((resolve) => out.once("drain", resolve));
        onProgress(Math.min(99, Math.floor((received / manifest.size) * 100)));
      }
      await new Promise((resolve, reject) => out.end((error) => (error ? reject(error) : resolve())));
    } catch (error) {
      out.destroy();
      fs.rmSync(partial, { force: true });
      throw error instanceof UpdateError ? error : new UpdateError("O download foi interrompido.", "download_failed");
    }
    if (received !== manifest.size || hash.digest("base64") !== manifest.sha512) {
      fs.rmSync(partial, { force: true });
      throw new UpdateError("O arquivo baixado não confere com o publicado (sha512). Nada foi instalado.", "hash_mismatch");
    }
    fs.renameSync(partial, target);
    onProgress(100);
    return { filePath: target, version: manifest.version };
  };

  return { check, download, getLatest: () => latest };
};

// Argumentos do instalador NSIS do electron-builder: silencioso, marcado como
// atualização e abrindo o app no final.
const INSTALLER_ARGS = Object.freeze(["--updated", "/S", "--force-run"]);

module.exports = {
  ALLOWED_DOWNLOAD_HOSTS,
  DEFAULT_FEED_URL,
  INSTALLER_ARGS,
  UpdateError,
  buildManifest,
  compareVersions,
  createUpdater,
  normalizeFeedUrl,
  parseManifest,
};
