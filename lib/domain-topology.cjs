const DEFAULT_PLATFORM_URL = "https://inovasfood.com.br";

const { getRequestHeader } = require("./http.cjs");

const HOST_TYPES = Object.freeze({
  PLATFORM: "PLATFORM",
  RESTAURANT: "RESTAURANT",
});

const PLATFORM_HOST_VARIANTS = Object.freeze({
  ALIAS: "alias",
  CANONICAL: "canonical",
  LOCAL: "local",
  VERCEL: "vercel",
});

const normalizeHost = (value = "") => {
  const rawValue = String(value || "").split(",")[0].trim().toLowerCase();

  if (!rawValue) {
    return "";
  }

  try {
    return new URL(rawValue.includes("://") ? rawValue : `https://${rawValue}`)
      .hostname
      .toLowerCase()
      .replace(/^\[|\]$/g, "");
  } catch (error) {
    if (rawValue === "::1") {
      return rawValue;
    }

    const bracketedIpv6 = rawValue.match(/^\[([^\]]+)\](?::\d+)?$/);
    return bracketedIpv6
      ? bracketedIpv6[1]
      : rawValue.split(":")[0].replace(/^\[|\]$/g, "");
  }
};

const normalizePlatformUrl = (value = "") => {
  const candidate = String(value || "").trim() || DEFAULT_PLATFORM_URL;

  try {
    const parsed = new URL(candidate);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return DEFAULT_PLATFORM_URL;
    }

    if (parsed.hostname.replace(/^www\./i, "") !== "inovasfood.com.br") {
      return DEFAULT_PLATFORM_URL;
    }

    parsed.hostname = "inovasfood.com.br";

    return parsed.origin.replace(/\/+$/, "");
  } catch (error) {
    return DEFAULT_PLATFORM_URL;
  }
};

const getPlatformUrl = () =>
  normalizePlatformUrl(
    process.env.PUBLIC_APP_URL ||
      process.env.INOVAS_PUBLIC_APP_URL ||
      DEFAULT_PLATFORM_URL
  );

const getPlatformHost = () => normalizeHost(getPlatformUrl());

const getPlatformHosts = () => {
  const canonicalHost = getPlatformHost();
  const apexHost = canonicalHost.replace(/^www\./, "");
  const configuredAliases = String(process.env.INOVAS_PLATFORM_HOSTS || "")
    .split(",")
    .map(normalizeHost)
    .filter(Boolean);

  return Object.freeze(
    Array.from(
      new Set([
        canonicalHost,
        apexHost,
        apexHost ? `www.${apexHost}` : "",
        ...configuredAliases,
      ].filter(Boolean))
    )
  );
};

const isLocalPlatformHost = (value = "") =>
  ["localhost", "127.0.0.1", "::1"].includes(normalizeHost(value));

const isVercelPlatformHost = (value = "") => {
  const host = normalizeHost(value);
  return host.endsWith(".vercel.app") || host.endsWith(".vercel.sh");
};

const isConfiguredPlatformHost = (value = "") =>
  getPlatformHosts().includes(normalizeHost(value));

const classifyDomainHost = (value = "") => {
  const host = normalizeHost(value);
  const canonicalHost = getPlatformHost();
  let type = HOST_TYPES.RESTAURANT;
  let variant = "custom";

  if (isLocalPlatformHost(host)) {
    type = HOST_TYPES.PLATFORM;
    variant = PLATFORM_HOST_VARIANTS.LOCAL;
  } else if (isVercelPlatformHost(host)) {
    type = HOST_TYPES.PLATFORM;
    variant = PLATFORM_HOST_VARIANTS.VERCEL;
  } else if (isConfiguredPlatformHost(host)) {
    type = HOST_TYPES.PLATFORM;
    variant =
      host === canonicalHost
        ? PLATFORM_HOST_VARIANTS.CANONICAL
        : PLATFORM_HOST_VARIANTS.ALIAS;
  }

  return Object.freeze({
    host,
    type,
    variant,
    canonicalHost,
    canonicalUrl: getPlatformUrl(),
  });
};

const getRequestDomainHost = (req) => {
  const forwardedHost = getRequestHeader(req, "x-forwarded-host")
    .split(",")[0]
    .trim();
  const directHost = getRequestHeader(req, "host");
  let requestUrlHost = "";

  try {
    requestUrlHost = new URL(String(req?.url || ""), "http://localhost").host;
  } catch (error) {
    requestUrlHost = "";
  }

  return normalizeHost(forwardedHost || directHost || requestUrlHost);
};

const classifyRequestDomainHost = (req) =>
  classifyDomainHost(getRequestDomainHost(req));

const isPlatformHost = (value = "") =>
  classifyDomainHost(value).type === HOST_TYPES.PLATFORM;

const isPlatformOnlyPath = (pathname = "") => {
  const path = String(pathname || "/");

  return (
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/gestor" ||
    path.startsWith("/gestor/") ||
    path === "/master" ||
    path.startsWith("/master/") ||
    path === "/system" ||
    path.startsWith("/system/") ||
    path === "/api/admin" ||
    path.startsWith("/api/admin/") ||
    path === "/api/system" ||
    path.startsWith("/api/system/") ||
    path === "/api/tenant" ||
    path.startsWith("/api/tenant/") ||
    path === "/api/support" ||
    path.startsWith("/api/support/") ||
    path === "/api/auth/system" ||
    path.startsWith("/api/auth/system/") ||
    path === "/api/auth/restaurant" ||
    path.startsWith("/api/auth/restaurant/")
  );
};

const isPlatformApiPath = (pathname = "") =>
  String(pathname || "").startsWith("/api/") && isPlatformOnlyPath(pathname);

const buildCanonicalPlatformUrl = (requestUrl, pathname = "") => {
  const destination = new URL(String(requestUrl || getPlatformUrl()), getPlatformUrl());
  const platformOrigin = new URL(getPlatformUrl());
  destination.protocol = platformOrigin.protocol;
  destination.host = platformOrigin.host;

  if (pathname) {
    destination.pathname = pathname;
  }

  return destination;
};

module.exports = {
  DEFAULT_PLATFORM_URL,
  HOST_TYPES,
  PLATFORM_HOST_VARIANTS,
  buildCanonicalPlatformUrl,
  classifyDomainHost,
  classifyRequestDomainHost,
  getPlatformHost,
  getPlatformHosts,
  getPlatformUrl,
  getRequestDomainHost,
  isConfiguredPlatformHost,
  isLocalPlatformHost,
  isPlatformApiPath,
  isPlatformHost,
  isPlatformOnlyPath,
  isVercelPlatformHost,
  normalizeHost,
  normalizePlatformUrl,
};
