"use strict";

// Regras do app INOVAS PDV que não dependem do Electron (testadas em test/unit).
// Atenção: nada aqui é controle de acesso. Quem bloqueia de verdade é o servidor.
// Isto só decide o que o app mostra.

const ROLE_LABELS = Object.freeze({
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  OPERATOR: "Operador",
  CASHIER: "Caixa",
  SERVICE: "Atendente",
  WAITER: "Garçom",
  KITCHEN: "Cozinha",
  INVENTORY: "Estoque",
  FINANCE: "Financeiro",
  DELIVERY: "Entregador",
  READ_ONLY: "Somente leitura",
  CUSTOM: "Personalizado",
});

const roleLabel = (role) => {
  const key = String(role || "").trim().toUpperCase();
  return ROLE_LABELS[key] || (key ? key.charAt(0) + key.slice(1).toLowerCase() : "Equipe");
};

const has = (permissions, permission) =>
  Array.isArray(permissions) && permissions.includes(permission);

// "Caixa" e "Comandas" eram dois itens que abriam a mesma tela (o Salão).
// Agora são um módulo só, "Caixa e Comandas", com abas por permissão:
// garçom vê só Mesas e comandas; quem opera o caixa vê as três.
const MODULE_IDS = Object.freeze(["pedidos", "caixa", "cardapio"]);

// Ids antigos (app 0.1.0) que podem chegar de atalhos ou estado salvo.
const LEGACY_MODULE_IDS = Object.freeze({ comandas: "caixa" });
const LEGACY_ROUTE_IDS = Object.freeze({ salao: "mesas" });

// Telas do Gestor que cada módulo abre. Caminhos relativos ao servidor.
// "access" diz quem vê a aba: "tab" (comandas), "cash" (caixa) ou ambos.
const MODULE_ROUTES = Object.freeze({
  pedidos: Object.freeze([{ id: "fila", label: "Fila de pedidos", path: "/admin/?section=orders" }]),
  caixa: Object.freeze([
    Object.freeze({ id: "mesas", label: "Mesas e comandas", path: "/admin/caixa/salao", access: ["tab", "cash"] }),
    Object.freeze({ id: "abertura", label: "Abertura", path: "/admin/caixa/abertura", access: ["cash"] }),
    Object.freeze({ id: "fechamento", label: "Fechamento", path: "/admin/caixa/fechamento", access: ["cash"] }),
  ]),
  cardapio: Object.freeze([]),
});

const MODULE_HINTS = Object.freeze({
  pedidos: "",
  caixa: "F1 nova comanda · F2 enviar à cozinha · F4 conferir conta · Sangria e suprimento em Mesas e comandas",
  cardapio: "",
});

const cashAccessOf = (permissions = []) => ({
  // Opera o caixa: abre, fecha, recebe, sangria e suprimento.
  cash:
    has(permissions, "tenant.cash_register.view") &&
    (has(permissions, "tenant.cash_register.open") || has(permissions, "tenant.cash_register.close")),
  // Trabalha com comandas: abre comanda e lança itens.
  tab: has(permissions, "tenant.cash_register.open_tab") || has(permissions, "tenant.cash_register.add_item"),
});

const allowedRoutes = (moduleId, permissions = []) => {
  const routes = MODULE_ROUTES[moduleId] || [];
  if (moduleId !== "caixa") return routes.slice();
  const access = cashAccessOf(permissions);
  return routes.filter((route) => route.access.some((kind) => access[kind]));
};

const buildModules = (permissions = []) => {
  const caixaRoutes = allowedRoutes("caixa", permissions);
  return [
    {
      id: "pedidos",
      label: "Pedidos",
      available: has(permissions, "tenant.orders.view"),
      routes: allowedRoutes("pedidos", permissions),
    },
    {
      id: "caixa",
      label: "Caixa e Comandas",
      available: caixaRoutes.length > 0,
      routes: caixaRoutes,
    },
    {
      id: "cardapio",
      label: "Cardápio",
      // O módulo aparece sempre. Sem permissão, a tela explica o que falta.
      available: true,
      routes: [],
    },
  ];
};

const normalizeModuleId = (moduleId) => LEGACY_MODULE_IDS[moduleId] || moduleId;
const normalizeRouteId = (routeId) => LEGACY_ROUTE_IDS[routeId] || routeId;

const catalogAccess = (permissions = []) => {
  if (has(permissions, "tenant.catalog.edit")) return "pause";
  if (has(permissions, "tenant.catalog.view")) return "view";
  return "none";
};

const firstAvailableModule = (modules) => {
  const found = modules.find((module) => module.available && module.id !== "cardapio");
  return found ? found.id : "cardapio";
};

// Aba a abrir. Com "routes" (as abas permitidas do módulo), nunca devolve
// uma aba que a pessoa não pode ver.
const routeFor = (moduleId, routeId, routes = MODULE_ROUTES[normalizeModuleId(moduleId)] || []) => {
  const wanted = normalizeRouteId(routeId);
  return routes.find((route) => route.id === wanted) || routes[0] || null;
};

// Seções do Gestor que podem aparecer dentro do app. Qualquer outra (painel,
// financeiro, relatórios...) faz o app voltar para Pedidos.
const ALLOWED_GESTOR_SECTIONS = Object.freeze(["orders", "cash-register", "scheduled"]);

const ALLOWED_GESTOR_PATHS = Object.freeze([
  "/admin",
  "/admin/",
  "/admin/index.html",
  "/admin/caixa/salao",
  "/admin/caixa/abertura",
  "/admin/caixa/fechamento",
]);

const normalizeServerUrl = (value) => {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    return null;
  }
  const isLocal = ["127.0.0.1", "localhost"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) return null;
  if (url.username || url.password) return null;
  return url.origin;
};

// Classifica uma navegação dentro da janela do Gestor.
//  - "allow": tela permitida no app
//  - "login": o Gestor mandou para o login (sessão caiu)
//  - "block": qualquer outra coisa
const classifyGestorNavigation = (rawUrl, serverOrigin) => {
  let url;
  try {
    url = new URL(String(rawUrl || ""));
  } catch {
    return "block";
  }
  if (url.origin !== serverOrigin) return "block";
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/login" || path === "/admin/login.html" || path === "/admin/login") return "login";
  const normalized = ALLOWED_GESTOR_PATHS.includes(url.pathname) ? url.pathname : path;
  if (!ALLOWED_GESTOR_PATHS.includes(normalized)) return "block";
  const section = url.searchParams.get("section");
  if (section && !ALLOWED_GESTOR_SECTIONS.includes(section)) return "block";
  return "allow";
};

// Renova a sessão quando faltar menos que `thresholdMs` para expirar.
const shouldRenewSession = (expiresAt, now = Date.now(), thresholdMs = 2 * 60 * 60 * 1000) => {
  const expires = new Date(expiresAt || 0).getTime();
  if (!Number.isFinite(expires) || expires <= 0) return true;
  return expires - now <= thresholdMs;
};

const initialsOf = (name) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] || "";
  return `${first}${last}`.toUpperCase();
};

// Só imagens do próprio cardápio podem passar pelo protocolo de imagens do app.
const isCatalogImagePath = (path) =>
  typeof path === "string" &&
  /^\/(site-images|menu_pdf_images|menu_pdf_crops|assets)\/[A-Za-z0-9._\-/]+\.(webp|png|jpe?g|gif|avif)$/i.test(path) &&
  !path.includes("..");

module.exports = {
  ALLOWED_GESTOR_SECTIONS,
  MODULE_HINTS,
  MODULE_IDS,
  MODULE_ROUTES,
  allowedRoutes,
  normalizeModuleId,
  ROLE_LABELS,
  buildModules,
  catalogAccess,
  classifyGestorNavigation,
  firstAvailableModule,
  initialsOf,
  isCatalogImagePath,
  normalizeServerUrl,
  roleLabel,
  routeFor,
  shouldRenewSession,
};
