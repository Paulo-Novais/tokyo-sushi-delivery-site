"use strict";

const path = require("node:path");
const {
  BrowserWindow,
  Menu,
  WebContentsView,
  app,
  ipcMain,
  net,
  powerMonitor,
  protocol,
  safeStorage,
  session,
  shell,
} = require("electron");

const { createApiClient } = require("./api-client");
const { createConfig } = require("./config");
const { createCredentialStore } = require("./credentials");
const { createElectronCookieStore } = require("./electron-cookie-store");
const GESTOR_APP_CSS = require("./gestor-view.css.js");
const {
  ALLOWED_GESTOR_SECTIONS,
  MODULE_HINTS,
  MODULE_ROUTES,
  buildModules,
  catalogAccess,
  classifyGestorNavigation,
  firstAvailableModule,
  initialsOf,
  isCatalogImagePath,
  routeFor,
  shouldRenewSession,
} = require("../shared/modules");

// Pasta de dados separada para testes automatizados (nunca usar em produção).
if (process.env.INOVAS_PDV_USER_DATA) {
  app.setPath("userData", path.resolve(process.env.INOVAS_PDV_USER_DATA));
}

const PARTITION = "persist:inovas-pdv";
const debug = (...args) => {
  if (process.env.INOVAS_PDV_DEBUG) console.log("[pdv]", ...args);
};
const SESSION_CHECK_MS = Number(process.env.INOVAS_PDV_SESSION_CHECK_MS || 5 * 60 * 1000);
const OFFLINE_RETRY_MS = 15 * 1000;
const RENDERER_DIR = path.join(__dirname, "..", "renderer");
const EXTERNAL_LINK_HOSTS = ["wa.me", "api.whatsapp.com", "web.whatsapp.com", "www.google.com", "maps.google.com"];

protocol.registerSchemesAsPrivileged([
  { scheme: "pdvimg", privileges: { standard: true, secure: true, supportFetchAPI: false } },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let config;
let credentials;
let api;
let gestorSession;
let mainWindow = null;
let gestorView = null;
let stageBounds = { x: 0, y: 0, width: 0, height: 0 };
let sessionTimer = null;
let offlineTimer = null;
let renewing = null;

const state = {
  phase: "starting", // starting | login | connecting | app
  message: "",
  messageTone: "info",
  user: null,
  modules: [],
  activeModule: null,
  activeRoute: null,
  connection: "ok", // ok | renewing | offline
  remember: true,
  rememberAvailable: false,
  server: "",
  serverLocked: false,
  restaurants: null,
  catalogAccess: "none",
  version: app.getVersion(),
};

const publicState = () => ({
  ...state,
  user: state.user
    ? {
        displayName: state.user.displayName,
        initials: initialsOf(state.user.displayName),
        roleLabel: state.user.roleLabel,
        restaurantName: state.user.restaurantName,
        login: state.user.login,
      }
    : null,
  routes: state.activeModule ? MODULE_ROUTES[state.activeModule] : [],
  hint: state.activeModule ? MODULE_HINTS[state.activeModule] : "",
});

const broadcast = () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("pdv:state", publicState());
    const restaurant = state.user?.restaurantName ? ` · ${state.user.restaurantName}` : "";
    mainWindow.setTitle(`INOVAS PDV${restaurant}`);
  }
  syncGestorVisibility();
};

const setState = (patch) => {
  Object.assign(state, patch);
  broadcast();
};

/* ---------------- Tela do Gestor (WebContentsView) ---------------- */

const isGestorModule = (moduleId) => ["pedidos", "caixa", "comandas"].includes(moduleId);

const syncGestorVisibility = () => {
  if (!gestorView) return;
  const visible =
    state.phase === "app" && isGestorModule(state.activeModule) && stageBounds.width > 0 && stageBounds.height > 0;
  gestorView.setVisible(visible);
  if (visible) gestorView.setBounds(stageBounds);
};

const gestorUrlFor = (moduleId, routeId) => {
  const route = routeFor(moduleId, routeId);
  return route ? `${config.getServerUrl()}${route.path}` : null;
};

const destroyGestorView = () => {
  if (!gestorView) return;
  try {
    mainWindow?.contentView.removeChildView(gestorView);
  } catch {
    // janela já fechada
  }
  try {
    gestorView.webContents.close();
  } catch {
    // ignora
  }
  gestorView = null;
};

const openExternalIfAllowed = (rawUrl) => {
  try {
    const url = new URL(rawUrl);
    const isMaps = url.hostname !== "www.google.com" || url.pathname.startsWith("/maps");
    if (url.protocol === "https:" && EXTERNAL_LINK_HOSTS.includes(url.hostname) && isMaps) {
      void shell.openExternal(url.toString());
    }
  } catch {
    // ignora
  }
};

const createGestorView = () => {
  if (gestorView) return gestorView;
  gestorView = new WebContentsView({
    webPreferences: {
      partition: PARTITION,
      preload: path.join(__dirname, "..", "preload", "gestor-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      // Mantém sons de novo pedido e atualizações rodando mesmo quando o
      // operador está na tela de Cardápio.
      backgroundThrottling: false,
      // Som de novo pedido toca sem precisar de um clique antes (no navegador
      // o Gestor pede "Clique aqui para ativar o som").
      autoplayPolicy: "no-user-gesture-required",
    },
  });
  gestorView.setBackgroundColor("#f3f4f6");
  mainWindow.contentView.addChildView(gestorView);
  const contents = gestorView.webContents;
  contents.setZoomFactor(Number(config.get("zoom", 1)) || 1);

  const guard = (event, url) => {
    const verdict = classifyGestorNavigation(url, config.getServerUrl());
    if (verdict === "allow") return;
    event.preventDefault();
    if (verdict === "login") {
      void handleSessionLost("O Gestor pediu login de novo.");
    } else {
      openExternalIfAllowed(url);
    }
  };
  contents.on("will-navigate", guard);
  contents.on("will-redirect", guard);
  contents.on("did-navigate", (_event, url) => {
    debug("did-navigate", url);
    const verdict = classifyGestorNavigation(url, config.getServerUrl());
    if (verdict === "login") void handleSessionLost("O Gestor pediu login de novo.");
    else if (verdict === "block") void openModule(firstAvailableModule(state.modules), null, { force: true });
  });
  contents.setWindowOpenHandler(({ url }) => {
    openExternalIfAllowed(url);
    return { action: "deny" };
  });
  contents.on("dom-ready", () => {
    void contents.insertCSS(GESTOR_APP_CSS, { cssOrigin: "user" }).catch(() => {});
  });
  contents.on("did-fail-load", (_event, errorCode, _description, _url, isMainFrame) => {
    if (isMainFrame && errorCode !== -3 /* ABORTED */) {
      setState({ connection: "offline" });
      scheduleOfflineRetry();
    }
  });
  contents.on("did-finish-load", () => {
    if (state.connection === "offline") setState({ connection: "ok" });
    // O Gestor só liga o som de novo pedido depois do primeiro clique na página
    // (regra do navegador). No app o som já é liberado (autoplayPolicy), então
    // simulamos esse primeiro toque. Em admin.js só o desbloqueio do som escuta
    // "pointerdown" no document, então isto não aciona mais nada.
    void contents
      .executeJavaScript('document.dispatchEvent(new PointerEvent("pointerdown"))', true)
      .catch(() => {});
  });
  contents.on("render-process-gone", () => {
    setTimeout(() => {
      if (gestorView && state.phase === "app" && isGestorModule(state.activeModule)) {
        void contents.loadURL(gestorUrlFor(state.activeModule, state.activeRoute));
      }
    }, 1000);
  });
  contents.on("before-input-event", (event, input) => handleShortcut(event, input));
  return gestorView;
};

const openModule = async (moduleId, routeId, { force = false } = {}) => {
  debug("openModule", moduleId, routeId || "");
  const target = state.modules.find((module) => module.id === moduleId);
  if (!target || !target.available) return publicState();
  const route = routeFor(moduleId, routeId);
  const previousUrl = isGestorModule(state.activeModule)
    ? gestorUrlFor(state.activeModule, state.activeRoute)
    : null;
  setState({ activeModule: moduleId, activeRoute: route ? route.id : null });
  if (isGestorModule(moduleId)) {
    const view = createGestorView();
    const url = gestorUrlFor(moduleId, route.id);
    const current = view.webContents.getURL();
    if (
      force ||
      !current ||
      url !== previousUrl ||
      classifyGestorNavigation(current, config.getServerUrl()) !== "allow"
    ) {
      await view.webContents.loadURL(url).catch(() => {});
    }
    syncGestorVisibility();
  }
  return publicState();
};

/* ---------------- Sessão ---------------- */

const applySession = async (sessionInfo, { keepModule = false } = {}) => {
  const user = sessionInfo.user;
  const modules = buildModules(user.permissions);
  const keep = keepModule && modules.some((module) => module.id === state.activeModule && module.available);
  setState({
    phase: "app",
    message: "",
    user,
    modules,
    restaurants: null,
    connection: "ok",
    catalogAccess: catalogAccess(user.permissions),
  });
  if (keep) {
    if (isGestorModule(state.activeModule) && gestorView) {
      gestorView.webContents.reload();
    }
  } else {
    await openModule(firstAvailableModule(modules));
  }
};

const savedCredentialsForServer = async () => {
  const saved = await credentials.load();
  if (!saved) return null;
  if (saved.server && saved.server !== config.getServerUrl()) return null;
  return saved;
};

// Faz login de novo com o login guardado neste computador.
const silentRelogin = async () => {
  if (renewing) return renewing;
  renewing = (async () => {
    const saved = await savedCredentialsForServer();
    if (!saved) {
      renewing = null;
      return { ok: false, reason: "no_credentials" };
    }
    try {
      await api.login(saved);
      return { ok: true };
    } catch (error) {
      if (error.code === "offline" || (error.status && error.status >= 500)) {
        return { ok: false, reason: "offline" };
      }
      if (["invalid_credentials", "user_blocked", "user_inactive"].includes(error.code) || error.status === 401 || error.status === 403) {
        credentials.clear();
        return { ok: false, reason: "rejected", message: error.message };
      }
      return { ok: false, reason: "error", message: error.message };
    } finally {
      renewing = null;
    }
  })();
  return renewing;
};

const goToLogin = (message, tone = "info") => {
  destroyGestorView();
  setState({
    phase: "login",
    message,
    messageTone: tone,
    user: null,
    modules: [],
    activeModule: null,
    activeRoute: null,
    connection: "ok",
    restaurants: null,
  });
};

const handleSessionLost = async (reason) => {
  if (state.phase !== "app") return;
  setState({ connection: "renewing" });
  const result = await silentRelogin();
  if (result.ok) {
    try {
      const info = await api.fetchSession();
      if (info.authenticated) {
        await applySession(info, { keepModule: true });
        return;
      }
    } catch {
      // cai para os casos abaixo
    }
  }
  if (result.reason === "offline") {
    setState({ connection: "offline" });
    scheduleOfflineRetry();
    return;
  }
  if (result.reason === "rejected") {
    goToLogin("Não foi possível reconectar: a senha mudou ou o usuário foi bloqueado. Entre de novo.", "error");
    return;
  }
  goToLogin(reason ? `${reason} Sua sessão terminou. Entre de novo.` : "Sua sessão terminou. Entre de novo.");
};

const checkSession = async () => {
  if (state.phase !== "app") return;
  let info;
  try {
    info = await api.fetchSession();
  } catch (error) {
    if (error.code === "offline") {
      setState({ connection: "offline" });
      scheduleOfflineRetry();
    }
    return;
  }
  if (!info.authenticated) {
    await handleSessionLost("");
    return;
  }
  if (state.connection !== "ok") setState({ connection: "ok" });
  // Renova antes de expirar para não interromper o caixa no meio de uma comanda.
  if (shouldRenewSession(info.user.expiresAt) && (await savedCredentialsForServer())) {
    const result = await silentRelogin();
    if (result.reason === "rejected") {
      goToLogin("Não foi possível reconectar: a senha mudou ou o usuário foi bloqueado. Entre de novo.", "error");
    }
  }
  // Papel ou permissões mudaram no Gestor: atualiza o menu sem recarregar a tela.
  const changed =
    JSON.stringify(info.user.permissions) !== JSON.stringify(state.user?.permissions) ||
    info.user.role !== state.user?.role;
  if (changed) {
    const modules = buildModules(info.user.permissions);
    setState({ user: info.user, modules, catalogAccess: catalogAccess(info.user.permissions) });
    if (!modules.some((module) => module.id === state.activeModule && module.available)) {
      await openModule(firstAvailableModule(modules));
    }
  }
};

const scheduleOfflineRetry = () => {
  if (offlineTimer) return;
  offlineTimer = setTimeout(async () => {
    offlineTimer = null;
    if (state.phase === "connecting") {
      await startup();
    } else if (state.phase === "app" && state.connection === "offline") {
      await checkSession();
      if (state.connection === "ok" && gestorView && isGestorModule(state.activeModule)) {
        gestorView.webContents.reload();
      }
    }
  }, OFFLINE_RETRY_MS);
};

const startup = async () => {
  setState({
    server: config.getServerUrl(),
    serverLocked: config.isServerLocked(),
    rememberAvailable: await credentials.isAvailable(),
  });
  try {
    let info = await api.fetchSession();
    if (!info.authenticated) {
      const result = await silentRelogin();
      if (result.ok) info = await api.fetchSession();
      else if (result.reason === "offline") throw Object.assign(new Error("offline"), { code: "offline" });
      else if (result.reason === "rejected") {
        goToLogin("A senha mudou ou o usuário foi bloqueado. Entre de novo.", "error");
        return;
      }
    }
    if (info.authenticated) {
      await applySession(info);
    } else {
      goToLogin("");
    }
  } catch (error) {
    if (error.code === "offline") {
      setState({
        phase: "connecting",
        message: "Sem conexão com o servidor. Tentando de novo a cada 15 segundos…",
        messageTone: "error",
      });
      scheduleOfflineRetry();
    } else {
      goToLogin(error.message || "Não foi possível abrir o app.", "error");
    }
  }
};

/* ---------------- Atalhos ---------------- */

const setZoom = (factor) => {
  const value = Math.min(1.6, Math.max(0.7, Math.round(factor * 10) / 10));
  config.set("zoom", value);
  gestorView?.webContents.setZoomFactor(value);
};

const handleShortcut = (event, input) => {
  if (input.type !== "keyDown") return;
  const ctrl = input.control || input.meta;
  if (input.key === "F5" || (ctrl && input.key.toLowerCase() === "r")) {
    event.preventDefault();
    gestorView?.webContents.reload();
  } else if (ctrl && (input.key === "=" || input.key === "+")) {
    event.preventDefault();
    setZoom((Number(config.get("zoom", 1)) || 1) + 0.1);
  } else if (ctrl && input.key === "-") {
    event.preventDefault();
    setZoom((Number(config.get("zoom", 1)) || 1) - 0.1);
  } else if (ctrl && input.key === "0") {
    event.preventDefault();
    setZoom(1);
  } else if (!app.isPackaged && ctrl && input.shift && input.key.toLowerCase() === "i") {
    event.preventDefault();
    gestorView?.webContents.openDevTools({ mode: "detach" });
  }
};

/* ---------------- IPC ---------------- */

const fromShell = (event) =>
  mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents;

const handle = (channel, fn) => {
  ipcMain.handle(channel, async (event, payload) => {
    if (!fromShell(event)) throw new Error("Origem não autorizada.");
    return fn(payload || {});
  });
};

const registerIpc = () => {
  handle("pdv:get-state", () => publicState());

  handle("pdv:login", async ({ identifier, password, remember, restaurantKey }) => {
    try {
      await api.login({ identifier, password, restaurantKey });
    } catch (error) {
      if (error.code === "restaurant_selection_required") {
        setState({ restaurants: error.restaurants || [], message: error.message, messageTone: "info" });
        return { ok: false, code: error.code, message: error.message, restaurants: error.restaurants || [] };
      }
      return { ok: false, code: error.code, message: error.message };
    }
    const info = await api.fetchSession().catch(() => ({ authenticated: false }));
    if (!info.authenticated) {
      return { ok: false, code: "session_missing", message: "Login aceito, mas a sessão não abriu. Tente de novo." };
    }
    credentials.clear();
    let remembered = false;
    if (remember) {
      remembered = await credentials.save({
        identifier: String(identifier || "").trim(),
        password: String(password || ""),
        restaurantKey: restaurantKey || "",
        server: config.getServerUrl(),
      });
    }
    setState({ remember: Boolean(remember) });
    await applySession(info);
    return { ok: true, remembered };
  });

  handle("pdv:logout", async () => {
    credentials.clear();
    await api.logout();
    await gestorSession.clearStorageData({ storages: ["cookies"] }).catch(() => {});
    goToLogin("Você saiu. Este computador não está mais conectado.");
    return publicState();
  });

  handle("pdv:open", ({ moduleId, routeId }) => openModule(moduleId, routeId));

  handle("pdv:reload", () => {
    gestorView?.webContents.reload();
    return true;
  });

  handle("pdv:retry", async () => {
    if (offlineTimer) {
      clearTimeout(offlineTimer);
      offlineTimer = null;
    }
    if (state.phase === "connecting") await startup();
    else await checkSession();
    return publicState();
  });

  handle("pdv:set-server", async ({ url }) => {
    if (config.isServerLocked()) return { ok: false, message: "Servidor definido pela instalação." };
    if (state.phase === "app") return { ok: false, message: "Saia do app antes de trocar o servidor." };
    const previous = config.getServerUrl();
    const next = config.setServerUrl(url);
    if (!next) return { ok: false, message: "Endereço inválido. Use https://..." };
    if (next !== previous) {
      credentials.clear();
      await gestorSession.clearStorageData({ storages: ["cookies"] }).catch(() => {});
    }
    setState({ server: next });
    return { ok: true, server: next };
  });

  handle("pdv:catalog:list", async () => {
    if (state.phase !== "app") return { ok: false, message: "Entre no app primeiro." };
    try {
      return { ok: true, sections: await api.listCatalog() };
    } catch (error) {
      if (error.status === 401) void handleSessionLost("");
      return { ok: false, code: error.code, status: error.status, message: error.message };
    }
  });

  handle("pdv:catalog:set", async ({ itemId, state: nextState }) => {
    if (state.phase !== "app") return { ok: false, message: "Entre no app primeiro." };
    try {
      await api.setAvailability(itemId, nextState);
      return { ok: true };
    } catch (error) {
      if (error.status === 401) void handleSessionLost("");
      return { ok: false, code: error.code, status: error.status, message: error.message };
    }
  });

  ipcMain.on("pdv:stage-bounds", (event, rect) => {
    if (!fromShell(event) || !rect) return;
    stageBounds = {
      x: Math.max(0, Math.round(Number(rect.x) || 0)),
      y: Math.max(0, Math.round(Number(rect.y) || 0)),
      width: Math.max(0, Math.round(Number(rect.width) || 0)),
      height: Math.max(0, Math.round(Number(rect.height) || 0)),
    };
    syncGestorVisibility();
  });

  ipcMain.on("gestor:section", (event, section) => {
    if (!gestorView || event.sender !== gestorView.webContents) return;
    debug("gestor:section", section);
    if (section && !ALLOWED_GESTOR_SECTIONS.includes(section)) {
      void openModule(firstAvailableModule(state.modules), null, { force: true });
    }
  });
};

/* ---------------- Imagens do cardápio ---------------- */

// As imagens do site têm Cross-Origin-Resource-Policy: same-origin, então a tela
// local do Cardápio não consegue carregá-las direto. Este protocolo busca só
// imagens públicas do cardápio no servidor configurado.
const registerImageProtocol = () => {
  protocol.handle("pdvimg", async (request) => {
    const url = new URL(request.url);
    const imagePath = decodeURIComponent(url.pathname);
    if (!isCatalogImagePath(imagePath)) return new Response("", { status: 404 });
    try {
      const response = await net.fetch(`${config.getServerUrl()}${imagePath}`);
      if (!response.ok) return new Response("", { status: 404 });
      const type = response.headers.get("content-type") || "";
      if (!type.startsWith("image/")) return new Response("", { status: 404 });
      return new Response(await response.arrayBuffer(), {
        status: 200,
        headers: { "content-type": type, "cache-control": "max-age=3600" },
      });
    } catch {
      return new Response("", { status: 404 });
    }
  });
};

/* ---------------- Janela ---------------- */

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    backgroundColor: "#f3f4f6",
    title: "INOVAS PDV",
    icon: path.join(RENDERER_DIR, "assets", "icon-128.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "shell-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  if (process.env.INOVAS_PDV_WINDOW_SIZE) {
    const [width, height] = process.env.INOVAS_PDV_WINDOW_SIZE.split("x").map(Number);
    if (width && height) mainWindow.setContentSize(width, height);
  } else {
    mainWindow.maximize();
  }
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("before-input-event", (event, input) => handleShortcut(event, input));
  mainWindow.on("closed", () => {
    mainWindow = null;
    gestorView = null;
  });
  void mainWindow.loadFile(path.join(RENDERER_DIR, "shell.html"));
};

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  config = createConfig({ directory: app.getPath("userData") });
  credentials = createCredentialStore({
    safeStorage,
    directory: app.getPath("userData"),
    // Só para testes automatizados no Linux sem chaveiro.
    allowBasicText: !app.isPackaged && process.env.INOVAS_PDV_TEST_ALLOW_BASIC_STORE === "1",
  });
  gestorSession = session.fromPartition(PARTITION);
  gestorSession.setPermissionRequestHandler((_contents, permission, callback) => {
    // O Gestor só precisa tocar som (autoplay não pede permissão) e imprimir.
    callback(["clipboard-sanitized-write", "fullscreen"].includes(permission));
  });
  api = createApiClient({
    getServerUrl: () => config.getServerUrl(),
    cookieStore: createElectronCookieStore(gestorSession),
  });
  registerImageProtocol();
  registerIpc();
  createWindow();
  mainWindow.webContents.once("did-finish-load", () => {
    void startup();
  });
  sessionTimer = setInterval(() => void checkSession(), SESSION_CHECK_MS);
  powerMonitor.on("resume", () => void checkSession());
  powerMonitor.on("unlock-screen", () => void checkSession());
});

app.on("window-all-closed", () => {
  if (sessionTimer) clearInterval(sessionTimer);
  app.quit();
});
