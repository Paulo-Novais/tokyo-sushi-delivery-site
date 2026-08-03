const {
  RESTAURANT_KEY,
} = require("./master-platform-store.cjs");
const { buildHttpError } = require("./http.cjs");
const {
  DEFAULT_TENANT_MODE,
  getRequestHost,
  getTenantMode,
  resolveTenantRequest,
} = require("./tenant-resolution.cjs");
const {
  enterDatabaseScope,
  getDatabaseScope,
} = require("./tenant-sql.cjs");

const DEFAULT_ORGANIZATION_KEY = "default";
const DEFAULT_TENANT_ID = "tenant_default";
const DEFAULT_RESTAURANT_ID = "restaurant_default";

const normalizeText = (value, fallback = "", maxLength = 240) => {
  const normalizedValue = String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
  return normalizedValue || fallback;
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
      "tenant_host_not_found",
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
      "tenant_host_not_found",
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

const throwResolutionError = (resolution = {}) => {
  const errorCode = resolution.errorCode || "tenant_context_required";
  const mismatch = errorCode === "tenant_session_mismatch";
  const inactive = errorCode === "tenant_route_inactive";
  const statusCode = mismatch ? 403 : inactive ? 403 : 404;
  const message = mismatch
    ? "Sessao administrativa nao pertence ao restaurante desta requisicao."
    : inactive
      ? "Restaurante ou dominio desativado."
      : "Nao foi possivel resolver o restaurante desta requisicao.";

  throw buildHttpError(statusCode, message, errorCode, {
    tenantHost: resolution.host || "",
    resolutionMode: resolution.resolutionMode || "",
  });
};

const getRequestTenantContext = async (req, options = {}) => {
  if (req?.tenantContext) {
    return req.tenantContext;
  }

  const authenticatedSession = options.authenticatedSession || null;
  if (
    authenticatedSession &&
    (authenticatedSession.audience === "system" ||
      authenticatedSession.aud === "system")
  ) {
    throw buildHttpError(
      403,
      "A sessao System nao possui contexto de restaurante.",
      "system_tenant_context_forbidden"
    );
  }

  const resolution = await resolveTenantRequest(req, {
    authenticatedSession,
    slug: options.slug,
  });

  if (!resolution?.ok) {
    throwResolutionError(resolution);
  }

  const tenantContext = buildTenantContext(resolution, {
    ...options,
    host: resolution.host,
    source: authenticatedSession
      ? authenticatedSession.audience === "support"
        ? "support:session"
        : "restaurant:session"
      : resolution.source || options.source,
  });

  assertTenantContext(tenantContext);

  if (authenticatedSession) {
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
  } else if (["none", "public"].includes(getDatabaseScope().audience)) {
    enterDatabaseScope({
      audience: "public",
      tenantId: tenantContext.tenantId,
      restaurantId: tenantContext.restaurantId,
      restaurantKey: tenantContext.restaurantKey,
    });
  }

  if (req && typeof req === "object") {
    req.tenantResolution = resolution;
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
