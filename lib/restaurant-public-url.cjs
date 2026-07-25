const DEFAULT_PUBLIC_APP_URL = "https://www.inovasfood.com.br";
const RESTAURANT_ROUTE_COOKIE = "inovas_restaurant_slug";

const RESERVED_RESTAURANT_SLUGS = Object.freeze([
  "acompanhar",
  "admin",
  "api",
  "assets",
  "avaliar",
  "cardapio",
  "configuracoes",
  "dashboard",
  "default",
  "docs",
  "entrega",
  "favicon.ico",
  "gestor",
  "historico",
  "index.html",
  "inovas",
  "lib",
  "login",
  "logout",
  "master",
  "r",
  "robots.txt",
  "scripts",
  "site-images",
  "sitemap.xml",
  "static",
  "suporte",
  "trabalhe-conosco",
  "usuarios",
]);

const RESERVED_RESTAURANT_SLUG_SET = new Set(RESERVED_RESTAURANT_SLUGS);

const normalizePublicAppUrl = (value = "") => {
  const candidate = String(value || "").trim() || DEFAULT_PUBLIC_APP_URL;

  try {
    const parsed = new URL(candidate);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return DEFAULT_PUBLIC_APP_URL;
    }

    return parsed.origin.replace(/\/+$/, "");
  } catch (error) {
    return DEFAULT_PUBLIC_APP_URL;
  }
};

const getPublicAppUrl = () =>
  normalizePublicAppUrl(
    process.env.PUBLIC_APP_URL ||
      process.env.INOVAS_PUBLIC_APP_URL ||
      DEFAULT_PUBLIC_APP_URL
  );

const getPublicAppHost = () => new URL(getPublicAppUrl()).hostname.toLowerCase();

const normalizeRestaurantSlug = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

const validateRestaurantSlug = (value = "") => {
  const rawValue = String(value || "").trim();
  const normalizedSlug = normalizeRestaurantSlug(rawValue);

  if (!rawValue || rawValue.length < 3 || rawValue.length > 120) {
    return {
      ok: false,
      slug: normalizedSlug,
      errorCode: "invalid_restaurant_slug",
      message: "Informe um slug com 3 a 120 caracteres.",
    };
  }

  if (RESERVED_RESTAURANT_SLUG_SET.has(rawValue.toLowerCase())) {
    return {
      ok: false,
      slug: normalizedSlug,
      errorCode: "restaurant_slug_reserved",
      message: "Este endereco e reservado pelo sistema. Escolha outro slug.",
    };
  }

  if (
    rawValue !== normalizedSlug ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(rawValue)
  ) {
    return {
      ok: false,
      slug: normalizedSlug,
      errorCode: "invalid_restaurant_slug",
      message:
        "Use apenas letras minusculas, numeros e hifen, sem espacos, acentos, barras ou caracteres especiais.",
    };
  }

  return {
    ok: true,
    slug: normalizedSlug,
    errorCode: "",
    message: "",
  };
};

const buildRestaurantPublicUrl = (slug = "") => {
  const validation = validateRestaurantSlug(slug);
  return validation.ok ? `${getPublicAppUrl()}/${validation.slug}` : "";
};

const buildRestaurantPublicDisplayUrl = (slug = "") =>
  buildRestaurantPublicUrl(slug).replace(/^https?:\/\//i, "");

const normalizeRequestHost = (value = "") => {
  const rawValue = String(value || "").split(",")[0].trim().toLowerCase();

  if (!rawValue) {
    return "";
  }

  try {
    return new URL(rawValue.includes("://") ? rawValue : `https://${rawValue}`)
      .hostname
      .toLowerCase();
  } catch (error) {
    return rawValue.split(":")[0].replace(/^\[|\]$/g, "");
  }
};

const isPublicAppHost = (value = "") => {
  const requestHost = normalizeRequestHost(value);
  const configuredHost = getPublicAppHost();

  return (
    requestHost === configuredHost ||
    requestHost.replace(/^www\./, "") === configuredHost.replace(/^www\./, "")
  );
};

module.exports = {
  DEFAULT_PUBLIC_APP_URL,
  RESERVED_RESTAURANT_SLUGS,
  RESTAURANT_ROUTE_COOKIE,
  buildRestaurantPublicDisplayUrl,
  buildRestaurantPublicUrl,
  getPublicAppHost,
  getPublicAppUrl,
  isPublicAppHost,
  normalizePublicAppUrl,
  normalizeRequestHost,
  normalizeRestaurantSlug,
  validateRestaurantSlug,
};
