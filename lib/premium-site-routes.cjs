// Rotas públicas do Modelo Premium, iguais na Vercel (middleware.js) e no
// servidor local de validação. Uma página de restaurante nunca é servida sem
// restaurante identificado: nada de cair no Tokyo como padrão.
const { PREMIUM_PAGES, PREMIUM_PAGE_BY_FILE } = require("./premium-model.cjs");

// Arquivos que o HTML do modelo carrega com caminho relativo ("./styles.css").
const PREMIUM_ROOT_ASSETS = new Set([
  "maps-config.js",
  "premium-route.js",
  "script.js",
  "site-config.js",
  "store-hours.js",
  "styles.css",
  "tokyo.webmanifest",
]);

// Arquivos-modelo das páginas do restaurante (servidos na raiz só no domínio do Tokyo).
const PREMIUM_TEMPLATE_FILES = new Set(Object.values(PREMIUM_PAGES).map((page) => page.file));

const pagePathFor = (pageKey) => {
  const page = PREMIUM_PAGES[pageKey];
  return page ? (page.path ? `/${page.path}` : "") : null;
};

const buildPremiumPageUrl = (basePath = "", pageKey = "inicio") => {
  const pagePath = pagePathFor(pageKey);
  if (pagePath === null) return "";
  const url = `${String(basePath || "").replace(/\/+$/, "")}${pagePath}`;
  return url || "/";
};

// suffix: o que vem depois de /<slug> (ou o caminho inteiro num domínio próprio).
// Retorna { kind: "page" | "redirect" | "asset" | "not_found", ... }.
const resolvePremiumSuffix = (suffix = "") => {
  const clean = String(suffix || "").replace(/\/{2,}/g, "/");

  if (clean === "" ) {
    return { kind: "page", pageKey: "inicio" };
  }

  if (clean === "/" || clean === "/index.html" || clean === "/tokyo.html") {
    return { kind: "redirect", pagePath: "" };
  }

  const relative = clean.replace(/^\/+/, "");
  const withoutSlash = relative.replace(/\/+$/, "");

  const pageEntry = Object.entries(PREMIUM_PAGES).find(
    ([, page]) => page.path && page.path === withoutSlash
  );
  if (pageEntry) {
    return relative.endsWith("/")
      ? { kind: "redirect", pagePath: `/${pageEntry[1].path}` }
      : { kind: "page", pageKey: pageEntry[0] };
  }

  const legacyPageKey = PREMIUM_PAGE_BY_FILE[relative];
  if (legacyPageKey) {
    return { kind: "redirect", pagePath: pagePathFor(legacyPageKey) };
  }

  if (
    PREMIUM_ROOT_ASSETS.has(relative) ||
    relative.startsWith("assets/") ||
    relative.startsWith("site-images/")
  ) {
    return { kind: "asset", path: `/${relative}` };
  }

  return { kind: "not_found" };
};

// Caminho na raiz que é página de restaurante ("/cardapio.html", "/tokyo.html"...).
const isRootPremiumTemplatePath = (pathname = "") =>
  PREMIUM_TEMPLATE_FILES.has(String(pathname || "").replace(/^\/+/, ""));

module.exports = {
  PREMIUM_ROOT_ASSETS,
  PREMIUM_TEMPLATE_FILES,
  buildPremiumPageUrl,
  isRootPremiumTemplatePath,
  resolvePremiumSuffix,
};
