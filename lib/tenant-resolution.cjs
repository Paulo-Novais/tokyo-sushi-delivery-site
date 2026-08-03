const { getRequestHeader } = require("./http.cjs");
const {
  DOMAIN_CONFIG,
} = require("./app-branding.cjs");
const {
  RESTAURANT_ROUTE_COOKIE,
  getPublicAppHost,
  isPublicAppHost,
  normalizeRequestHost,
  validateRestaurantSlug,
} = require("./restaurant-public-url.cjs");
const masterPlatformStore = require("./master-platform-store.cjs");

const DEFAULT_TENANT_MODE = "default_only";
const ACTIVE_ROUTE_STATUSES = new Set([
  "ACTIVE",
  "ATIVO",
  "CLIENTE_MODELO",
  "PILOT",
  "TRIAL",
  "VERIFIED",
]);
const ACTIVE_DOMAIN_STATUSES = new Set([
  "ACTIVE",
  "ATIVO",
  "PILOT",
  "VERIFIED",
]);
const HOST_KINDS = Object.freeze({
  CUSTOM_DOMAIN: "custom_domain",
  LOCAL_PLATFORM: "local_platform",
  PLATFORM: "platform",
  VERCEL_PREVIEW: "vercel_preview",
});
const RESOLUTION_SOURCES = Object.freeze({
  DEFAULT_FALLBACK: "default_fallback",
  HOST: "host",
  SESSION: "session",
  SLUG: "slug",
});

const normalizeTenantMode = (value) => {
  const normalizedValue = String(value || DEFAULT_TENANT_MODE)
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");

  if (["pilot", "tenant_pilot", "multi_restaurant_pilot"].includes(normalizedValue)) {
    return "pilot";
  }

  if (["strict", "tenant_strict", "multi_tenant"].includes(normalizedValue)) {
    return "strict";
  }

  return DEFAULT_TENANT_MODE;
};

const getTenantMode = () => {
  const configuredMode = normalizeTenantMode(
    process.env.INOVAS_TENANT_MODE || process.env.TENANT_CONTEXT_MODE
  );

  return process.env.NODE_ENV === "production" && configuredMode === DEFAULT_TENANT_MODE
    ? "strict"
    : configuredMode;
};

const normalizeTenantHost = (value = "") =>
  normalizeRequestHost(value).replace(/^www\./, "");

const getConfiguredTenantAliases = () => {
  const primaryHost = normalizeTenantHost(DOMAIN_CONFIG.primaryDomain);
  const aliases = new Map();

  [
    DOMAIN_CONFIG.primaryDomain,
    ...(Array.isArray(DOMAIN_CONFIG.alternateDomains)
      ? DOMAIN_CONFIG.alternateDomains
      : []),
    ...(Array.isArray(DOMAIN_CONFIG.allowedHostnames)
      ? DOMAIN_CONFIG.allowedHostnames
      : []),
  ]
    .map(normalizeTenantHost)
    .filter(Boolean)
    .forEach((host) => aliases.set(host, primaryHost || host));

  return aliases;
};

const classifyTenantHost = (value = "") => {
  const host = normalizeTenantHost(value);

  if (["localhost", "127.0.0.1", "::1"].includes(host)) {
    return HOST_KINDS.LOCAL_PLATFORM;
  }

  if (host.endsWith(".vercel.app") || host.endsWith(".vercel.sh")) {
    return HOST_KINDS.VERCEL_PREVIEW;
  }

  if (isPublicAppHost(host)) {
    return HOST_KINDS.PLATFORM;
  }

  return HOST_KINDS.CUSTOM_DOMAIN;
};

const isPathTenantHost = (value = "") =>
  classifyTenantHost(value) !== HOST_KINDS.CUSTOM_DOMAIN;

const getHostFromRequestUrl = (req) => {
  try {
    return new URL(String(req?.url || ""), "http://localhost").host;
  } catch (error) {
    return "";
  }
};

const getRequestHost = (req) => {
  const forwardedHost = getRequestHeader(req, "x-forwarded-host")
    .split(",")[0]
    .trim();
  const directHost = getRequestHeader(req, "host");
  // Vercel and the local validation reverse proxy both preserve the original
  // tenant host in x-forwarded-host. Cross-tenant spoofing is still rejected by
  // the route-to-session equality check below this transport boundary.
  const host = forwardedHost || directHost || getHostFromRequestUrl(req);

  return normalizeTenantHost(host || "localhost");
};

const getRequestCookie = (req, cookieName) => {
  const cookieHeader = getRequestHeader(req, "cookie");
  const encodedName = `${encodeURIComponent(cookieName)}=`;
  const cookieEntry = cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(encodedName));

  if (!cookieEntry) {
    return "";
  }

  try {
    return decodeURIComponent(cookieEntry.slice(encodedName.length));
  } catch (error) {
    return "";
  }
};

const getRequestRestaurantSlug = (req, host = getRequestHost(req)) =>
  isPathTenantHost(host)
    ? getRequestCookie(req, RESTAURANT_ROUTE_COOKIE)
    : "";

const normalizeRoute = (route = null) => {
  if (!route) {
    return null;
  }

  return Object.freeze({
    tenantId: String(route.tenant_id || route.tenantId || "").trim(),
    restaurantId: String(route.restaurant_id || route.restaurantId || "").trim(),
    restaurantKey: String(
      route.restaurant_key || route.restaurantKey || route.key || ""
    ).trim(),
    restaurantName: String(
      route.restaurant_name || route.restaurantName || route.name || ""
    ).trim(),
    slug: String(route.slug || "").trim(),
    domainHost: normalizeTenantHost(route.domain_host || route.domainHost || ""),
    status: String(route.status || "").trim().toUpperCase(),
    domainStatus: String(
      route.domain_status || route.domainStatus || ""
    ).trim().toUpperCase(),
    domainIsSimulation:
      route.domain_is_simulation === true || route.domainIsSimulation === true,
    publicUrl: String(route.public_url || route.publicUrl || "").trim(),
    dnsIntegrated:
      route.dns_integrated === true || route.dnsIntegrated === true,
    sslIntegrated:
      route.ssl_integrated === true || route.sslIntegrated === true,
  });
};

const isRouteActive = (route) =>
  Boolean(route && ACTIVE_ROUTE_STATUSES.has(route.status));

const isDomainRouteActive = (route) =>
  Boolean(
    isRouteActive(route) &&
      route.domainHost &&
      route.domainIsSimulation !== true &&
      (!route.domainStatus || ACTIVE_DOMAIN_STATUSES.has(route.domainStatus))
  );

const buildResolution = ({
  route = null,
  host = "",
  hostKind = classifyTenantHost(host),
  matched = false,
  matchedSlug = false,
  source = RESOLUTION_SOURCES.HOST,
  errorCode = "",
  resolutionMode = "",
  fallbackApplied = false,
} = {}) => {
  const normalizedRoute = normalizeRoute(route);

  return Object.freeze({
    ok: Boolean(normalizedRoute) && !errorCode,
    matched,
    matchedSlug,
    host: normalizeTenantHost(host),
    hostKind,
    source,
    slug: normalizedRoute?.slug || "",
    tenantId: normalizedRoute?.tenantId || "",
    restaurantId: normalizedRoute?.restaurantId || "",
    restaurantKey: normalizedRoute?.restaurantKey || "",
    restaurantName: normalizedRoute?.restaurantName || "",
    restaurant: normalizedRoute
      ? Object.freeze({
          tenantId: normalizedRoute.tenantId,
          restaurantId: normalizedRoute.restaurantId,
          restaurantKey: normalizedRoute.restaurantKey,
          key: normalizedRoute.restaurantKey,
          slug: normalizedRoute.slug,
          name: normalizedRoute.restaurantName,
          status: normalizedRoute.status,
        })
      : null,
    domain: normalizedRoute?.domainHost
      ? Object.freeze({
          restaurantKey: normalizedRoute.restaurantKey,
          domain: normalizedRoute.domainHost,
          status: normalizedRoute.domainStatus || normalizedRoute.status,
          dnsIntegrated: normalizedRoute.dnsIntegrated,
          sslIntegrated: normalizedRoute.sslIntegrated,
        })
      : null,
    errorCode,
    resolutionMode:
      resolutionMode || (matchedSlug ? "public_path" : getTenantMode()),
    fallbackRestaurantKey: masterPlatformStore.RESTAURANT_KEY,
    fallbackApplied,
    multiRestaurantActive:
      matched &&
      normalizedRoute?.restaurantKey !== masterPlatformStore.RESTAURANT_KEY &&
      getTenantMode() !== DEFAULT_TENANT_MODE,
    publicUrl: normalizedRoute?.publicUrl || "",
    dnsIntegrated: normalizedRoute?.dnsIntegrated === true,
    sslIntegrated: normalizedRoute?.sslIntegrated === true,
    cachePolicy: "request_only",
  });
};

const getDefaultRoute = async () =>
  normalizeRoute(
    await masterPlatformStore.findPublicRestaurantRoute({
      restaurantKey: masterPlatformStore.RESTAURANT_KEY,
    })
  );

const resolveDefaultFallback = async ({ host = "", matched = false } = {}) => {
  const route = await getDefaultRoute();

  return buildResolution({
    route,
    host,
    matched,
    source: RESOLUTION_SOURCES.DEFAULT_FALLBACK,
    resolutionMode: DEFAULT_TENANT_MODE,
    fallbackApplied: !matched,
    errorCode: route ? "" : "tenant_default_route_missing",
  });
};

const resolveLocalDevelopmentDefault = async (host) => {
  const route = await getDefaultRoute();

  return buildResolution({
    route,
    host,
    hostKind: HOST_KINDS.LOCAL_PLATFORM,
    matched: Boolean(route),
    source: RESOLUTION_SOURCES.DEFAULT_FALLBACK,
    resolutionMode: "local_development_default",
    errorCode: route ? "" : "tenant_default_route_missing",
  });
};

const resolveRestaurantByHost = async (value = "") => {
  const host = normalizeTenantHost(value);
  const hostKind = classifyTenantHost(host);
  const aliases = getConfiguredTenantAliases();
  const lookupHost = aliases.get(host) || host;
  const matchedRoute = normalizeRoute(
    await masterPlatformStore.findPublicRestaurantRoute({ host: lookupHost })
  );
  const tenantMode = getTenantMode();

  if (tenantMode === DEFAULT_TENANT_MODE) {
    return resolveDefaultFallback({
      host,
      matched: Boolean(matchedRoute),
    });
  }

  if (!isDomainRouteActive(matchedRoute)) {
    return buildResolution({
      route: null,
      host,
      hostKind,
      source: RESOLUTION_SOURCES.HOST,
      errorCode: matchedRoute ? "tenant_route_inactive" : "tenant_host_not_found",
      resolutionMode: matchedRoute ? "host_inactive" : "host_unmatched",
    });
  }

  return buildResolution({
    route: matchedRoute,
    host,
    hostKind,
    matched: true,
    source: RESOLUTION_SOURCES.HOST,
    resolutionMode: "host",
  });
};

const resolveRestaurantBySlug = async (value = "") => {
  const validation = validateRestaurantSlug(value);
  const host = normalizeTenantHost(getPublicAppHost());

  if (!validation.ok) {
    return buildResolution({
      host,
      hostKind: HOST_KINDS.PLATFORM,
      source: RESOLUTION_SOURCES.SLUG,
      errorCode: validation.errorCode,
      resolutionMode: "public_path_invalid",
    });
  }

  const route = normalizeRoute(
    await masterPlatformStore.findPublicRestaurantRoute({
      slug: validation.slug,
    })
  );

  if (!isRouteActive(route)) {
    return buildResolution({
      host,
      hostKind: HOST_KINDS.PLATFORM,
      source: RESOLUTION_SOURCES.SLUG,
      errorCode: route ? "tenant_route_inactive" : "restaurant_slug_not_found",
      resolutionMode: route ? "public_path_inactive" : "public_path_unmatched",
    });
  }

  return buildResolution({
    route,
    host,
    hostKind: HOST_KINDS.PLATFORM,
    matched: true,
    matchedSlug: true,
    source: RESOLUTION_SOURCES.SLUG,
    resolutionMode: "public_path",
  });
};

const sessionMatchesResolution = (session = {}, resolution = {}) =>
  Boolean(
    session.restaurantKey &&
      session.tenantId &&
      session.restaurantId &&
      session.restaurantKey === resolution.restaurantKey &&
      session.tenantId === resolution.tenantId &&
      session.restaurantId === resolution.restaurantId
  );

const buildSessionResolution = (session = {}, host = "") =>
  buildResolution({
    route: {
      tenantId: session.tenantId,
      restaurantId: session.restaurantId,
      restaurantKey: session.restaurantKey,
      restaurantName: session.restaurantName || "",
      slug: session.restaurantSlug || "",
      status: "ACTIVE",
    },
    host,
    hostKind: classifyTenantHost(host),
    matched: true,
    source: RESOLUTION_SOURCES.SESSION,
    resolutionMode:
      session.audience === "support" ? "support_session" : "restaurant_membership",
  });

const buildSessionMismatch = (resolution, host) =>
  buildResolution({
    route: null,
    host,
    hostKind: classifyTenantHost(host),
    source: RESOLUTION_SOURCES.SESSION,
    errorCode: "tenant_session_mismatch",
    resolutionMode: "session_mismatch",
  });

const resolveTenantRequest = async (req, options = {}) => {
  const host = getRequestHost(req);
  const hostKind = classifyTenantHost(host);
  const authenticatedSession = options.authenticatedSession || null;
  const routeSlug = options.slug || getRequestRestaurantSlug(req, host);

  if (authenticatedSession) {
    if (hostKind === HOST_KINDS.CUSTOM_DOMAIN) {
      const hostResolution = await resolveRestaurantByHost(host);
      return hostResolution.matched && sessionMatchesResolution(authenticatedSession, hostResolution)
        ? buildSessionResolution(authenticatedSession, host)
        : hostResolution.matched
          ? buildSessionMismatch(hostResolution, host)
          : hostResolution;
    }

    if (routeSlug) {
      const slugResolution = await resolveRestaurantBySlug(routeSlug);
      return slugResolution.matched && sessionMatchesResolution(authenticatedSession, slugResolution)
        ? buildSessionResolution(authenticatedSession, host)
        : slugResolution.matched
          ? buildSessionMismatch(slugResolution, host)
          : slugResolution;
    }

    return buildSessionResolution(authenticatedSession, host);
  }

  if (hostKind === HOST_KINDS.CUSTOM_DOMAIN) {
    return resolveRestaurantByHost(host);
  }

  if (routeSlug) {
    return resolveRestaurantBySlug(routeSlug);
  }

  if (
    hostKind === HOST_KINDS.LOCAL_PLATFORM &&
    process.env.NODE_ENV !== "production"
  ) {
    return resolveLocalDevelopmentDefault(host);
  }

  return getTenantMode() === DEFAULT_TENANT_MODE
    ? resolveDefaultFallback({ host })
    : buildResolution({
        host,
        hostKind,
        source: RESOLUTION_SOURCES.HOST,
        errorCode: "tenant_route_required",
        resolutionMode: "platform_route_required",
      });
};

const parsePublicRestaurantPath = (pathname = "") => {
  const legacyMatch = String(pathname).match(/^\/r\/([^/]+)(\/.*)?$/);
  const cleanMatch = String(pathname).match(/^\/([^/]+)(\/.*)?$/);
  const routeMatch = legacyMatch || cleanMatch;

  if (!routeMatch) {
    return Object.freeze({ recognized: false });
  }

  const validation = validateRestaurantSlug(routeMatch[1]);

  if (
    !validation.ok &&
    !legacyMatch &&
    (validation.errorCode === "restaurant_slug_reserved" || routeMatch[1].includes("."))
  ) {
    return Object.freeze({ recognized: false });
  }

  return Object.freeze({
    recognized: true,
    legacy: Boolean(legacyMatch),
    valid: validation.ok,
    errorCode: validation.errorCode,
    slug: validation.slug,
    suffix: String(routeMatch[2] || ""),
  });
};

module.exports = {
  ACTIVE_DOMAIN_STATUSES,
  ACTIVE_ROUTE_STATUSES,
  DEFAULT_TENANT_MODE,
  HOST_KINDS,
  RESOLUTION_SOURCES,
  classifyTenantHost,
  getRequestHost,
  getRequestRestaurantSlug,
  getTenantMode,
  isPathTenantHost,
  normalizeTenantHost,
  normalizeTenantMode,
  parsePublicRestaurantPath,
  resolveRestaurantByHost,
  resolveRestaurantBySlug,
  resolveTenantRequest,
};
