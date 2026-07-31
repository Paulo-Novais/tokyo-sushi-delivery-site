const { buildHttpError, getRequestHeader } = require("./http.cjs");
const {
  RESTAURANT_KEY,
  normalizeDomainHost,
  resolveRestaurantBySlug,
  resolveRestaurantByHost,
} = require("./master-platform-store.cjs");
const {
  RESTAURANT_ROUTE_COOKIE,
  isPublicAppHost,
} = require("./restaurant-public-url.cjs");
const {
  enterDatabaseScope,
  getDatabaseScope,
} = require("./tenant-sql.cjs");

const DEFAULT_ORGANIZATION_KEY = "default";
const DEFAULT_TENANT_MODE = "default_only";
const DEFAULT_TENANT_ID = "tenant_default";
const DEFAULT_RESTAURANT_ID = "restaurant_default";

const normalizeText = (value, fallback = "", maxLength = 240) => {
  const normalizedValue = String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
  return normalizedValue || fallback;
};

const normalizeTenantMode = (value) => {
  const normalizedValue = normalizeText(value, DEFAULT_TENANT_MODE, 80)
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
  return process.env.NODE_ENV === "production" &&
    configuredMode === DEFAULT_TENANT_MODE
    ? "strict"
    : configuredMode;
};

const isStrictTenantMode = () => getTenantMode() === "strict";

const isPilotTenantMode = () => getTenantMode() === "pilot";

const normalizePhysicalId = (value, fallback = "", maxLength = 120) => {
  const normalizedValue = normalizeText(value, "", maxLength)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalizedValue || fallback;
};

const buildFallbackTenantId = (restaurantKey = RESTAURANT_KEY) => {
  const normalizedRestaurantKey = normalizePhysicalId(restaurantKey, RESTAURANT_KEY, 80);
  return normalizedRestaurantKey === RESTAURANT_KEY
    ? DEFAULT_TENANT_ID
    : `tenant_${normalizedRestaurantKey}`;
};

const buildFallbackRestaurantId = (restaurantKey = RESTAURANT_KEY) => {
  const normalizedRestaurantKey = normalizePhysicalId(restaurantKey, RESTAURANT_KEY, 80);
  return normalizedRestaurantKey === RESTAURANT_KEY
    ? DEFAULT_RESTAURANT_ID
    : `restaurant_${normalizedRestaurantKey}`;
};

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
  const host = forwardedHost || getRequestHeader(req, "host") || getHostFromRequestUrl(req);

  return normalizeDomainHost(host, "localhost");
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

const isPathTenantHost = (host = "") =>
  isPublicAppHost(host) ||
  ["localhost", "127.0.0.1", "::1"].includes(host) ||
  host.endsWith(".vercel.app") ||
  host.endsWith(".vercel.sh");

const buildTenantContext = (resolution, options = {}) => {
  const tenantMode = getTenantMode();
  const restaurant = resolution?.restaurant || {};
  const restaurantKey = normalizeText(
    resolution?.restaurantKey || restaurant.restaurantKey || restaurant.key,
    RESTAURANT_KEY,
    120
  );
  const organizationKey = normalizeText(
    restaurant.organizationKey || restaurant.organization_key,
    DEFAULT_ORGANIZATION_KEY,
    120
  );
  const tenantId = normalizePhysicalId(
    resolution?.tenantId || resolution?.tenant_id || restaurant.tenantId || restaurant.tenant_id,
    buildFallbackTenantId(restaurantKey),
    120
  );
  const restaurantId = normalizePhysicalId(
    restaurant.restaurantId || restaurant.restaurant_id || restaurant.id || resolution?.restaurantId || resolution?.restaurant_id,
    buildFallbackRestaurantId(restaurantKey),
    120
  );

  return Object.freeze({
    tenantId,
    tenantMode,
    source: normalizeText(options.source, "request", 120),
    resolvedAt: new Date().toISOString(),
    host: normalizeText(resolution?.host || options.host, "localhost", 240),
    organizationId: normalizeText(restaurant.organizationId || restaurant.organization_id, "", 120),
    organizationKey,
    restaurantId,
    restaurantKey,
    legacyRestaurantKey: normalizeText(
      restaurant.legacyRestaurantKey || restaurant.legacy_restaurant_key,
      restaurantKey,
      120
    ),
    restaurantName: normalizeText(resolution?.restaurantName || restaurant.name, "", 180),
    matchedDomain: resolution?.matched === true,
    resolutionMode: normalizeText(resolution?.resolutionMode, tenantMode, 80),
    multiRestaurantActive: resolution?.multiRestaurantActive === true,
    fallbackRestaurantKey: normalizeText(
      resolution?.fallbackRestaurantKey,
      RESTAURANT_KEY,
      120
    ),
    domain: resolution?.domain || null,
    domainResolution: resolution || null,
  });
};

const assertTenantContext = (tenantContext) => {
  if (!tenantContext?.restaurantKey) {
    throw buildHttpError(
      403,
      "Nao foi possivel resolver o restaurante desta requisicao.",
      "tenant_context_required"
    );
  }

  if (isStrictTenantMode() && tenantContext.matchedDomain !== true) {
    throw buildHttpError(
      404,
      "Dominio nao vinculado a um restaurante ativo.",
      "tenant_domain_not_found",
      {
        tenantHost: tenantContext.host,
      }
    );
  }
};

const getTenantRestaurantKey = (tenantContext) => {
  assertTenantContext(tenantContext);
  return normalizeText(tenantContext.restaurantKey, "", 120);
};

const assertOperationalTenantContext = (tenantContext, options = {}) => {
  const restaurantKey = getTenantRestaurantKey(tenantContext);
  const tenantId = getTenantPhysicalId(tenantContext);
  const restaurantId = getTenantRestaurantId(tenantContext);

  if (!restaurantKey) {
    throw buildHttpError(
      403,
      options.message || "Operacao operacional sem restaurante resolvido.",
      "tenant_context_required",
      {
        operation: options.operation || "",
      }
    );
  }

  if (isStrictTenantMode() && tenantContext.matchedDomain !== true) {
    throw buildHttpError(
      404,
      "Dominio nao vinculado a um restaurante ativo.",
      "tenant_domain_not_found",
      {
        tenantHost: tenantContext.host,
        operation: options.operation || "",
      }
    );
  }

  return {
    tenantContext,
    tenantId,
    restaurantKey,
    restaurantId,
    isDefaultTenant: restaurantKey === RESTAURANT_KEY,
  };
};

const getOperationalTenant = (options = {}, operation = "") =>
  assertOperationalTenantContext(options?.tenantContext, { operation });

const matchesTenantKey = (record = {}, restaurantKey = RESTAURANT_KEY) => {
  const recordRestaurantKey = normalizeText(
    record.restaurantKey || record.restaurant_key || record.legacyRestaurantKey,
    RESTAURANT_KEY,
    120
  );

  return recordRestaurantKey === restaurantKey;
};

const getTenantPhysicalId = (tenantContext) => {
  assertTenantContext(tenantContext);
  return normalizePhysicalId(tenantContext.tenantId || tenantContext.tenant_id, buildFallbackTenantId(tenantContext.restaurantKey), 120);
};

const getTenantRestaurantId = (tenantContext) => {
  assertTenantContext(tenantContext);
  return normalizePhysicalId(
    tenantContext.restaurantId || tenantContext.restaurant_id,
    buildFallbackRestaurantId(tenantContext.restaurantKey),
    120
  );
};

const getRecordPhysicalScope = (record = {}) => {
  const restaurantKey = normalizeText(
    record.restaurantKey || record.restaurant_key || record.legacyRestaurantKey,
    RESTAURANT_KEY,
    120
  );

  return {
    tenantId: normalizePhysicalId(record.tenantId || record.tenant_id, buildFallbackTenantId(restaurantKey), 120),
    restaurantId: normalizePhysicalId(
      record.restaurantId || record.restaurant_id,
      buildFallbackRestaurantId(restaurantKey),
      120
    ),
    restaurantKey,
  };
};

const matchesTenantScope = (record = {}, tenant = {}) => {
  const tenantContext = tenant.tenantContext || tenant;
  const restaurantKey = tenant.restaurantKey || getTenantRestaurantKey(tenantContext);
  const tenantId = tenant.tenantId || getTenantPhysicalId(tenantContext);
  const restaurantId = tenant.restaurantId || getTenantRestaurantId(tenantContext);
  const recordScope = getRecordPhysicalScope(record);

  return (
    recordScope.restaurantKey === restaurantKey &&
    recordScope.tenantId === tenantId &&
    recordScope.restaurantId === restaurantId
  );
};

const withTenantKey = (record = {}, tenantContext) => {
  const restaurantKey = getTenantRestaurantKey(tenantContext);

  return {
    ...record,
    restaurantKey,
  };
};

const withTenantScope = (record = {}, tenantContext) => ({
  ...record,
  tenantId: getTenantPhysicalId(tenantContext),
  restaurantId: getTenantRestaurantId(tenantContext),
  restaurantKey: getTenantRestaurantKey(tenantContext),
});

const getRequestTenantContext = async (req, options = {}) => {
  if (req?.tenantContext) {
    return req.tenantContext;
  }

  const authenticatedSession = options.authenticatedSession || null;
  if (authenticatedSession) {
    if (
      authenticatedSession.audience === "system" ||
      authenticatedSession.aud === "system"
    ) {
      throw buildHttpError(
        403,
        "A sessão System não possui contexto de restaurante.",
        "system_tenant_context_forbidden"
      );
    }

    const requestHost = getRequestHost(req);
    if (!isPathTenantHost(requestHost)) {
      const hostResolution = await resolveRestaurantByHost(requestHost);
      if (hostResolution?.matched === true) {
        const hostTenantContext = buildTenantContext(hostResolution, {
          host: requestHost,
          source: "authenticated_host",
        });
        assertTenantContextMatchesSession(
          hostTenantContext,
          authenticatedSession
        );
      }
    }

    const tenantContext = buildTenantContext(
      {
        host: requestHost,
        matched: true,
        tenantId: authenticatedSession.tenantId,
        restaurantId: authenticatedSession.restaurantId,
        restaurantKey: authenticatedSession.restaurantKey,
        restaurantName: authenticatedSession.restaurantName || "",
        restaurant: {
          tenantId: authenticatedSession.tenantId,
          restaurantId: authenticatedSession.restaurantId,
          restaurantKey: authenticatedSession.restaurantKey,
          name: authenticatedSession.restaurantName || "",
        },
        resolutionMode:
          authenticatedSession.audience === "support"
            ? "support_session"
            : "restaurant_membership",
        multiRestaurantActive: true,
      },
      {
        source:
          authenticatedSession.audience === "support"
            ? "support:session"
            : "restaurant:session",
      }
    );
    assertTenantContext(tenantContext);
    enterDatabaseScope({
      audience:
        authenticatedSession.audience === "support"
          ? "support"
          : "restaurant",
      tenantId: tenantContext.tenantId,
      restaurantId: tenantContext.restaurantId,
      restaurantKey: tenantContext.restaurantKey,
      identityId: authenticatedSession.identityId,
      sessionId:
        authenticatedSession.sessionId ||
        authenticatedSession.systemSessionId,
      supportSessionId: authenticatedSession.supportSessionId,
      supportMode: authenticatedSession.supportMode,
    });
    if (req && typeof req === "object") {
      req.tenantContext = tenantContext;
    }
    return tenantContext;
  }

  const host = getRequestHost(req);
  const routeSlug = isPathTenantHost(host)
    ? getRequestCookie(req, RESTAURANT_ROUTE_COOKIE)
    : "";
  const resolution = routeSlug
    ? await resolveRestaurantBySlug(routeSlug)
    : await resolveRestaurantByHost(host);

  if (routeSlug && resolution?.matched !== true) {
    throw buildHttpError(
      404,
      "Restaurante nao encontrado.",
      "tenant_restaurant_not_found"
    );
  }

  const tenantContext = buildTenantContext(resolution, {
    ...options,
    host,
    source: routeSlug ? "public_path_cookie" : options.source,
  });

  assertTenantContext(tenantContext);

  if (
    ["none", "public"].includes(getDatabaseScope().audience)
  ) {
    enterDatabaseScope({
      audience: "public",
      tenantId: tenantContext.tenantId,
      restaurantId: tenantContext.restaurantId,
      restaurantKey: tenantContext.restaurantKey,
    });
  }

  if (req && typeof req === "object") {
    req.tenantContext = tenantContext;
  }

  return tenantContext;
};

const assertTenantContextMatchesSession = (tenantContext, session = {}) => {
  assertTenantContext(tenantContext);

  const sessionRestaurantKey = normalizeText(session.restaurantKey, "", 120);
  const sessionTenantId = normalizePhysicalId(session.tenantId, "", 120);
  const sessionRestaurantId = normalizePhysicalId(
    session.restaurantId,
    "",
    120
  );

  if (
    !sessionRestaurantKey ||
    !sessionTenantId ||
    !sessionRestaurantId ||
    sessionRestaurantKey !== tenantContext.restaurantKey ||
    sessionTenantId !== tenantContext.tenantId ||
    sessionRestaurantId !== tenantContext.restaurantId
  ) {
    throw buildHttpError(
      403,
      "Sessao administrativa nao pertence ao restaurante desta requisicao.",
      "tenant_session_mismatch",
      {
        tenantRestaurantKey: tenantContext.restaurantKey,
        sessionRestaurantKey,
      }
    );
  }
};

const serializeTenantContext = (tenantContext) => {
  if (!tenantContext) {
    return null;
  }

  return {
    tenantMode: tenantContext.tenantMode,
    tenantId: tenantContext.tenantId,
    source: tenantContext.source,
    resolvedAt: tenantContext.resolvedAt,
    host: tenantContext.host,
    organizationId: tenantContext.organizationId,
    organizationKey: tenantContext.organizationKey,
    restaurantId: tenantContext.restaurantId,
    restaurantKey: tenantContext.restaurantKey,
    legacyRestaurantKey: tenantContext.legacyRestaurantKey,
    restaurantName: tenantContext.restaurantName,
    matchedDomain: tenantContext.matchedDomain,
    resolutionMode: tenantContext.resolutionMode,
    multiRestaurantActive: tenantContext.multiRestaurantActive,
    defaultOnly: tenantContext.multiRestaurantActive !== true,
    fallbackRestaurantKey: tenantContext.fallbackRestaurantKey,
  };
};

const withTenantContextPayload = (payload = {}, tenantContext) => ({
  ...payload,
  tenantContext: serializeTenantContext(tenantContext),
});

module.exports = {
  DEFAULT_ORGANIZATION_KEY,
  DEFAULT_RESTAURANT_ID,
  DEFAULT_TENANT_ID,
  DEFAULT_TENANT_MODE,
  assertTenantContext,
  assertTenantContextMatchesSession,
  assertOperationalTenantContext,
  buildTenantContext,
  getOperationalTenant,
  getRequestHost,
  getRequestTenantContext,
  getTenantPhysicalId,
  getTenantRestaurantId,
  getTenantRestaurantKey,
  getTenantMode,
  isStrictTenantMode,
  isPilotTenantMode,
  matchesTenantKey,
  matchesTenantScope,
  serializeTenantContext,
  withTenantKey,
  withTenantScope,
  withTenantContextPayload,
};
