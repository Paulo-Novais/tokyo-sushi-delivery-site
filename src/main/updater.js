"use strict";

// Atualização automática do INOVAS PDV (Windows).
//
// 1. De tempos em tempos lê o versao.json do Release gestor-pdv
//    ({ version, sha256, size, file }).
// 2. Se a versão for maior que a instalada, baixa o instalador em segundo
//    plano e confere o SHA-256.
// 3. Avisa na tela: "Atualizar agora" ou "Mais tarde".
//    - Agora: fecha o app, instala por cima em silêncio e abre de novo.
//    - Mais tarde: instala quando o app for fechado (a atualização é
//      obrigatória) e o aviso volta depois de um tempo.
//
// O instalador é o mesmo NSIS de sempre (/S = silencioso). As configurações
// e o login salvo ficam na pasta do usuário e não são apagados.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");

const RELEASE_BASE_URL = "https://github.com/Paulo-Novais/tokyo-sushi-delivery-site/releases/download/gestor-pdv";
const MANIFEST_URL = `${RELEASE_BASE_URL}/versao.json`;
const FIRST_CHECK_DELAY_MS = 20 * 1000;
const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const REMIND_AFTER_MS = 2 * 60 * 60 * 1000;

const parseVersion = (value) => {
  const match = String(value || "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1, 4).map(Number) : null;
};

// > 0 quando "a" é mais nova que "b". Versão inválida nunca é "mais nova".
const compareVersions = (a, b) => {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
};

const validateManifest = (manifest) => {
  if (!manifest || typeof manifest !== "object") return null;
  const version = String(manifest.version || "").trim();
  const sha256 = String(manifest.sha256 || "").trim().toLowerCase();
  const size = Number(manifest.size);
  const file = String(manifest.file || "INOVAS-PDV-Setup.exe").trim();
  if (!parseVersion(version)) return null;
  if (!/^[0-9a-f]{64}$/.test(sha256)) return null;
  if (!Number.isFinite(size) || size <= 0) return null;
  if (!/^[A-Za-z0-9._-]+\.exe$/.test(file)) return null;
  return { version, sha256, size, file };
};

const sha256OfFile = async (filePath) => {
  const hash = crypto.createHash("sha256");
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest("hex");
};

const createUpdater = ({
  currentVersion,
  downloadDir,
  enabled,
  onChange = () => {},
  log = () => {},
  manifestUrl = MANIFEST_URL,
  releaseBaseUrl = RELEASE_BASE_URL,
  fetchImpl = globalThis.fetch,
  spawnImpl = spawn,
  now = () => Date.now(),
  firstCheckDelayMs = FIRST_CHECK_DELAY_MS,
}) => {
  const state = {
    available: null, // { version } quando o instalador já foi baixado e conferido
    remindAt: 0,
    checking: false,
    installing: false,
  };
  let installerPath = null;
  let timer = null;
  let firstTimer = null;

  const publicState = () =>
    state.available
      ? {
          version: state.available.version,
          visible: now() >= state.remindAt,
        }
      : null;

  const emit = () => onChange(publicState());

  const download = async (manifest) => {
    fs.mkdirSync(downloadDir, { recursive: true });
    const target = path.join(downloadDir, `INOVAS-PDV-Setup-${manifest.version}.exe`);
    if (fs.existsSync(target) && (await sha256OfFile(target)) === manifest.sha256) return target;
    const partial = `${target}.part`;
    const response = await fetchImpl(`${releaseBaseUrl}/${manifest.file}`, { cache: "no-store" });
    if (!response.ok || !response.body) throw new Error(`download ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(partial));
    const digest = await sha256OfFile(partial);
    if (digest !== manifest.sha256 || fs.statSync(partial).size !== manifest.size) {
      fs.rmSync(partial, { force: true });
      throw new Error("instalador baixado não confere com o versao.json");
    }
    fs.renameSync(partial, target);
    return target;
  };

  const check = async () => {
    if (!enabled || state.checking || state.installing) return publicState();
    state.checking = true;
    try {
      const response = await fetchImpl(`${manifestUrl}?t=${now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`versao.json ${response.status}`);
      const manifest = validateManifest(await response.json());
      if (!manifest) throw new Error("versao.json inválido");
      if (compareVersions(manifest.version, currentVersion) <= 0) return publicState();
      if (state.available?.version === manifest.version) return publicState();
      installerPath = await download(manifest);
      state.available = { version: manifest.version };
      state.remindAt = 0;
      log("atualização pronta", manifest.version);
      emit();
    } catch (error) {
      log("verificação de atualização falhou", error?.message || String(error));
    } finally {
      state.checking = false;
    }
    return publicState();
  };

  const runInstaller = ({ relaunch }) => {
    if (!installerPath || state.installing) return false;
    state.installing = true;
    // /S silencioso. --updated e --force-run são do instalador do
    // electron-builder: --force-run abre o app de novo ao terminar.
    const args = ["/S", "--updated", ...(relaunch ? ["--force-run"] : [])];
    let child;
    try {
      child = spawnImpl(installerPath, args, { detached: true, stdio: "ignore" });
    } catch (error) {
      state.installing = false;
      log("instalador não abriu", error?.message || String(error));
      return false;
    }
    // Erro ao abrir o instalador nunca pode derrubar o app.
    child.on?.("error", (error) => log("instalador não abriu", error?.message || String(error)));
    child.unref?.();
    log("instalador iniciado", relaunch ? "(abre de novo)" : "(ao fechar)");
    return true;
  };

  return {
    start() {
      if (!enabled) return;
      firstTimer = setTimeout(() => void check(), firstCheckDelayMs);
      timer = setInterval(() => {
        void check();
        if (state.available && now() >= state.remindAt) emit();
      }, CHECK_INTERVAL_MS);
    },
    stop() {
      clearTimeout(firstTimer);
      clearInterval(timer);
    },
    check,
    getState: publicState,
    // "Atualizar agora": devolve true se o instalador foi aberto (o app deve fechar).
    installNow: () => runInstaller({ relaunch: true }),
    // "Mais tarde": esconde o aviso por um tempo; instala ao fechar o app.
    later() {
      if (!state.available) return publicState();
      state.remindAt = now() + REMIND_AFTER_MS;
      emit();
      return publicState();
    },
    // Chamado ao fechar o app: atualização pendente é obrigatória.
    installOnQuit: () => (state.available && !state.installing ? runInstaller({ relaunch: false }) : false),
  };
};

module.exports = {
  CHECK_INTERVAL_MS,
  MANIFEST_URL,
  REMIND_AFTER_MS,
  compareVersions,
  createUpdater,
  validateManifest,
};
