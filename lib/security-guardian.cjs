const { getAdminSessionFromRequest, getConfiguredAdminUsers } = require("./admin-auth.cjs");
const { buildHttpError, getRequestHeader } = require("./http.cjs");
const { getPlanAccessForAdminModule } = require("./master-platform-store.cjs");
const {
  assertTenantContextMatchesSession,
  getRequestTenantContext,
} = require("./tenant-context.cjs");
const { getAdminAccessContext } = require("./user-permissions.cjs");

const MAX_SECURITY_EVENTS = 500;
const SENSITIVE_ROUTE_GROUPS = Object.freeze({
  admin: [
    "dashboard",
    "orders",
    "catalog",
    "promotions",
    "reviews",
    "customers",
    "delivery-settings",
    "settings",
    "inventory",
    "finance",
    "users",
    "master",
  ],
  auth: ["login", "session", "logout", "customer-auth", "whatsapp-code"],
  publicWrite: ["orders:create", "reviews:create"],
  operational: ["finance", "inventory", "settings", "reports", "exports", "integrations", "webhooks"],
});

const RATE_LIMIT_PROFILES = Object.freeze({
  adminLogin: {
    limit: 5,
    windowMs: 5 * 60 * 1000,
    blockMs: 15 * 60 * 1000,
  },
  customerAuth: {
    limit: 8,
    windowMs: 5 * 60 * 1000,
    blockMs: 10 * 60 * 1000,
  },
  publicWrite: {
    limit: 30,
    windowMs: 60 * 1000,
    blockMs: 5 * 60 * 1000,
  },
  adminApi: {
    limit: 120,
    windowMs: 60 * 1000,
    blockMs: 5 * 60 * 1000,
  },
});

const PREVIEW_RATE_LIMIT_ENV = Object.freeze({
  adminLogin: "INOVAS_PREVIEW_ADMIN_LOGIN_RATE_LIMIT",
  customerAuth: "INOVAS_PREVIEW_CUSTOMER_AUTH_RATE_LIMIT",
  publicWrite: "INOVAS_PREVIEW_PUBLIC_WRITE_RATE_LIMIT",
  adminApi: "INOVAS_PREVIEW_ADMIN_API_RATE_LIMIT",
});

const SECRET_KEY_PATTERN = /(password|senha|token|cookie|secret|authorization|auth|session)/i;
const rateLimitBuckets = new Map();
const failureBuckets = new Map();
const temporaryBlocks = new Map();
const sessionFingerprints = new Map();
const securityEvents = [];
const securityAuditTrail = [];

const normalizeText = (value, maxLength = 240) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const getRequestUrl = (req) => new URL(String(req?.url || "/"), "http://localhost");

const getRequestIp = (req) => {
  const forwardedFor = getRequestHeader(req, "x-forwarded-for")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)[0];

  return (
    forwardedFor ||
    getRequestHeader(req, "x-real-ip") ||
    normalizeText(req?.socket?.remoteAddress || req?.connection?.remoteAddress, 80) ||
    "unknown"
  );
};

const getUserAgent = (req) => normalizeText(getRequestHeader(req, "user-agent"), 260);

const getTenantKey = (tenantContext) => normalizeText(tenantContext?.restaurantKey, 120) || "unknown";

const pushLimited = (target, entry) => {
  target.push(entry);

  while (target.length > MAX_SECURITY_EVENTS) {
    target.shift();
  }
};

const sanitizeForSecurityLog = (value, depth = 0) => {
  if (depth > 4) {
    return "[truncated]";
  }

  if (value === null || typeof value === "undefined") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 25).map((entry) => sanitizeForSecurityLog(entry, depth + 1));
  }

  if (typeof value === "object") {
    return Object.entries(value).reduce((result, [key, entryValue]) => {
      if (SECRET_KEY_PATTERN.test(key)) {
        result[key] = "[redacted]";
        return result;
      }

      result[key] = sanitizeForSecurityLog(entryValue, depth + 1);
      return result;
    }, {});
  }

  if (typeof value === "string") {
    return SECRET_KEY_PATTERN.test(value) ? "[redacted]" : value.slice(0, 500);
  }

  return value;
};

const applyPreviewRateLimitOverride = (profileName, profile) => {
  if (
    String(process.env.INOVAS_ENVIRONMENT || "").trim().toLowerCase() !==
      "preview" ||
    String(process.env.INOVAS_ENABLE_PREVIEW_E2E_OVERRIDES || "").trim() !==
      "1"
  ) {
    return profile;
  }

  const environmentName = PREVIEW_RATE_LIMIT_ENV[profileName];
  const configuredLimit = Number(
    environmentName ? process.env[environmentName] : NaN
  );
  if (
    !Number.isSafeInteger(configuredLimit) ||
    configuredLimit < profile.limit ||
    configuredLimit > 1000
  ) {
    return profile;
  }

  return { ...profile, limit: configuredLimit };
};

const getRateLimitProfile = (options = {}) => {
  let profileName = "";

  if (options.rateLimitProfile && RATE_LIMIT_PROFILES[options.rateLimitProfile]) {
    profileName = options.rateLimitProfile;
  }

  if (!profileName && options.routeType === "admin-auth" && options.action === "login") {
    profileName = "adminLogin";
  }

  if (!profileName && options.routeType === "customer-auth") {
    profileName = "customerAuth";
  }

  if (!profileName && options.routeType === "public-write") {
    profileName = "publicWrite";
  }

  if (!profileName && options.routeType === "admin") {
    profileName = "adminApi";
  }

  return profileName
    ? applyPreviewRateLimitOverride(profileName, RATE_LIMIT_PROFILES[profileName])
    : null;
};

const buildBucketKey = (context = {}, suffix = "") =>
  [
    suffix || "security",
    context.routeType || "route",
    context.ip || "unknown",
    context.tenantKey || "unknown",
    context.userKey || "",
  ].join(":");

const checkTemporaryBlock = (context = {}) => {
  const now = Date.now();
  const keys = [
    buildBucketKey(context, "block"),
    buildBucketKey({ ...context, userKey: "" }, "block"),
  ];

  for (const key of keys) {
    const block = temporaryBlocks.get(key);

    if (!block) {
      continue;
    }

    if (block.until <= now) {
      temporaryBlocks.delete(key);
      continue;
    }

    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((block.until - now) / 1000)),
      reason: block.reason || "temporary_block",
    };
  }

  return { blocked: false };
};

const checkRateLimit = (context = {}, options = {}) => {
  const profile = getRateLimitProfile(options);

  if (!profile) {
    return {
      allowed: true,
      count: 0,
      limit: 0,
      retryAfterSeconds: 0,
    };
  }

  const now = Date.now();
  const key = buildBucketKey(context, "rate");
  const current = rateLimitBuckets.get(key);
  const bucket =
    current && current.resetAt > now
      ? current
      : {
          count: 0,
          resetAt: now + profile.windowMs,
          blockedUntil: 0,
        };

  if (bucket.blockedUntil > now) {
    rateLimitBuckets.set(key, bucket);
    return {
      allowed: false,
      count: bucket.count,
      limit: profile.limit,
      retryAfterSeconds: Math.ceil((bucket.blockedUntil - now) / 1000),
      reason: "rate_limited",
    };
  }

  bucket.count += 1;

  if (bucket.count > profile.limit) {
    bucket.blockedUntil = now + profile.blockMs;
    rateLimitBuckets.set(key, bucket);
    return {
      allowed: false,
      count: bucket.count,
      limit: profile.limit,
      retryAfterSeconds: Math.ceil(profile.blockMs / 1000),
      reason: "rate_limited",
    };
  }

  rateLimitBuckets.set(key, bucket);
  return {
    allowed: true,
    count: bucket.count,
    limit: profile.limit,
    retryAfterSeconds: 0,
  };
};

const getFailureBucket = (context = {}, subject = "") => {
  const now = Date.now();
  const key = [
    "failures",
    context.routeType || "route",
    context.ip || "unknown",
    context.tenantKey || "unknown",
    normalizeText(subject || context.userKey || "", 160),
  ].join(":");
  const current = failureBuckets.get(key);

  if (current && current.resetAt > now) {
    return { key, bucket: current };
  }

  return {
    key,
    bucket: {
      count: 0,
      resetAt: now + 15 * 60 * 1000,
    },
  };
};

const getRecentFailureCount = (context = {}) => {
  const now = Date.now();
  let total = 0;

  for (const [key, bucket] of failureBuckets.entries()) {
    if (bucket.resetAt <= now) {
      failureBuckets.delete(key);
      continue;
    }

    if (key.includes(`:${context.ip || "unknown"}:`) && key.includes(`:${context.tenantKey || "unknown"}:`)) {
      total += bucket.count;
    }
  }

  return total;
};

const classifySecurityRisk = (signals = {}) => {
  let score = 0;
  const reasons = [];

  const add = (amount, reason) => {
    score += amount;
    reasons.push(reason);
  };

  if (signals.sensitiveRoute) {
    add(15, "sensitive_route");
  }

  if (signals.writeOperation) {
    add(15, "write_operation");
  }

  if (signals.missingTenant) {
    add(90, "missing_tenant");
  }

  if (signals.invalidTenant) {
    add(90, "invalid_tenant");
  }

  if (signals.missingSession) {
    add(45, "missing_session");
  }

  if (signals.tenantMismatch) {
    add(45, "tenant_session_mismatch");
  }

  if (signals.permissionDenied) {
    add(40, "permission_denied");
  }

  if (signals.planDenied) {
    add(40, "plan_denied");
  }

  if (signals.rateLimited || signals.temporaryBlock) {
    add(95, "blocked_attempts");
  }

  if (signals.changedIp) {
    add(25, "changed_ip");
  }

  if (signals.changedUserAgent) {
    add(20, "changed_user_agent");
  }

  if (signals.emptyUserAgent) {
    add(10, "empty_user_agent");
  }

  if (signals.recentFailures >= 5) {
    add(30, "many_recent_failures");
  } else if (signals.recentFailures >= 2) {
    add(15, "recent_failures");
  }

  if (signals.unusualHour) {
    add(10, "unusual_hour");
  }

  const level = score >= 90 ? "critical" : score >= 70 ? "high" : score >= 30 ? "medium" : "low";

  return {
    score: Math.min(score, 100),
    level,
    reasons,
  };
};

const isSensitiveOperation = (options = {}) => {
  if (typeof options.sensitive === "boolean") {
    return options.sensitive;
  }

  if (options.routeType === "admin" || options.routeType === "admin-auth") {
    return true;
  }

  return ["customer-auth", "public-write", "integration", "webhook"].includes(options.routeType);
};

const isWriteOperation = (req) => !["GET", "HEAD", "OPTIONS"].includes(String(req?.method || "GET").toUpperCase());

const recordSecurityEvent = (event = {}) => {
  const safeEvent = sanitizeForSecurityLog({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    ...event,
  });

  pushLimited(securityEvents, safeEvent);

  if (["allowed_logged", "denied", "blocked", "critical", "audit"].includes(safeEvent.outcome || safeEvent.severity)) {
    pushLimited(securityAuditTrail, safeEvent);
  }

  if (process.env.SECURITY_GUARDIAN_CONSOLE_LOGS === "1") {
    const writer = safeEvent.riskLevel === "critical" || safeEvent.outcome === "denied" ? console.warn : console.info;
    writer("[security-guardian]", JSON.stringify(safeEvent));
  }

  return safeEvent;
};

const buildSecurityContext = async (req, options = {}) => {
  const requestUrl = getRequestUrl(req);
  const routeType = normalizeText(options.routeType || "route", 80);
  const action = normalizeText(options.action || requestUrl.pathname, 160);
  const ip = getRequestIp(req);
  const userAgent = getUserAgent(req);
  const session = options.session || getAdminSessionFromRequest(req);
  let tenantContext = req?.tenantContext || options.tenantContext || null;
  let tenantError = null;

  if (options.requireTenant !== false) {
    try {
      tenantContext = await getRequestTenantContext(req, {
        source: options.source || `security:${routeType}:${action}`,
      });
    } catch (error) {
      tenantError = error;
    }
  }

  return {
    action,
    group: normalizeText(options.group || "", 80),
    ip,
    method: String(req?.method || "GET").toUpperCase(),
    path: requestUrl.pathname,
    queryKeys: [...requestUrl.searchParams.keys()].slice(0, 20),
    routeType,
    session,
    tenantContext,
    tenantError,
    tenantKey: getTenantKey(tenantContext),
    userAgent,
    userKey: normalizeText(session?.login || options.userKey || "", 160),
  };
};

const updateSessionFingerprintSignals = (context = {}) => {
  if (!context.userKey) {
    return {
      changedIp: false,
      changedUserAgent: false,
    };
  }

  const previous = sessionFingerprints.get(context.userKey);
  const next = {
    ip: context.ip,
    userAgent: context.userAgent,
    lastSeenAt: Date.now(),
  };

  sessionFingerprints.set(context.userKey, next);

  if (!previous) {
    return {
      changedIp: false,
      changedUserAgent: false,
    };
  }

  return {
    changedIp: previous.ip && previous.ip !== context.ip,
    changedUserAgent: previous.userAgent && previous.userAgent !== context.userAgent,
  };
};

const buildGuardianError = (statusCode, message, errorCode, extra = {}) =>
  buildHttpError(statusCode, message, errorCode, {
    publicMessage: message,
    ...extra,
  });

const denyRequest = (context, risk, reason, statusCode = 403, errorCode = "security_access_denied", extra = {}) => {
  recordSecurityEvent({
    type: "security_guardian_decision",
    outcome: risk.level === "critical" ? "blocked" : "denied",
    reason,
    riskLevel: risk.level,
    riskScore: risk.score,
    riskReasons: risk.reasons,
    routeType: context.routeType,
    group: context.group,
    action: context.action,
    method: context.method,
    path: context.path,
    ip: context.ip,
    userAgent: context.userAgent,
    tenant: context.tenantKey,
    user: context.userKey,
    metadata: extra,
  });

  if (
    risk.level === "critical" &&
    [
      "missing_tenant",
      "invalid_tenant",
      "rate_limited",
      "temporary_block",
      "tenant_context_required",
      "tenant_host_not_found",
    ].includes(reason)
  ) {
    temporaryBlocks.set(buildBucketKey(context, "block"), {
      until: Date.now() + 10 * 60 * 1000,
      reason,
    });
  }

  throw buildGuardianError(statusCode, extra.retryAfterSeconds ? "Muitas tentativas. Aguarde e tente novamente." : "Acesso negado.", errorCode, extra);
};

const validateAdminSecurity = async (req, context, options, signals) => {
  if (!options.requireSession) {
    return null;
  }

  if (!context.session) {
    signals.missingSession = true;
    return null;
  }

  try {
    const accessContext = await getAdminAccessContext(
      context.session,
      options.requiredPermissions || [],
      getConfiguredAdminUsers()
    );

    if (context.tenantContext) {
      assertTenantContextMatchesSession(context.tenantContext, accessContext.session);
    }

    if (options.requireMaster) {
      const userType = String(accessContext.session.userType || accessContext.session.tipo_usuario || "")
        .trim()
        .toUpperCase();

      if (userType !== "MASTER") {
        signals.masterDenied = true;
        signals.permissionDenied = true;
        return null;
      }
    }

    req.adminSession = {
      ...accessContext.session,
      tenantContext: context.tenantContext,
    };
    req.adminUser = accessContext.user;
    context.userKey = accessContext.session.login;

    if (options.requirePlan) {
      const planAccess = await getPlanAccessForAdminModule({
        group: options.group,
        action: options.planAction || options.action,
        restaurantKey: context.tenantContext?.restaurantKey || accessContext.session.restaurantKey || "default",
      });

      if (!planAccess.allowed) {
        signals.planDenied = true;
        signals.planDeniedDetails = {
          featureKey: planAccess.featureKey,
          planKey: planAccess.commercialAccess?.planKey,
          reason: planAccess.reason,
        };
        return null;
      }

      req.planAccess = planAccess;
    }

    return accessContext;
  } catch (error) {
    if (error?.errorCode === "tenant_session_mismatch") {
      signals.tenantMismatch = true;
    } else if (error?.errorCode === "admin_permission_denied") {
      signals.permissionDenied = true;
    } else if (error?.errorCode === "admin_session_required") {
      signals.missingSession = true;
    } else {
      signals.permissionDenied = true;
    }

    return null;
  }
};

const guardSecurity = async (req, options = {}) => {
  const context = await buildSecurityContext(req, options);
  const temporaryBlock = checkTemporaryBlock(context);
  const rate = checkRateLimit(context, options);
  const fingerprintSignals = updateSessionFingerprintSignals(context);
  const now = new Date();
  const signals = {
    sensitiveRoute: isSensitiveOperation(options),
    writeOperation: isWriteOperation(req),
    missingTenant: options.requireTenant !== false && !context.tenantContext,
    invalidTenant: Boolean(context.tenantError),
    temporaryBlock: temporaryBlock.blocked,
    rateLimited: !rate.allowed,
    emptyUserAgent: !context.userAgent,
    recentFailures: getRecentFailureCount(context),
    unusualHour: now.getHours() < 5,
    ...fingerprintSignals,
  };

  if (options.routeType === "admin") {
    await validateAdminSecurity(req, context, options, signals);
  }

  const risk = classifySecurityRisk(signals);

  req.securityGuardian = {
    context: sanitizeForSecurityLog(context),
    risk,
  };

  if (temporaryBlock.blocked) {
    denyRequest(context, risk, temporaryBlock.reason, 429, "security_temporary_block", {
      retryAfterSeconds: temporaryBlock.retryAfterSeconds,
    });
  }

  if (!rate.allowed) {
    denyRequest(context, risk, rate.reason || "rate_limited", 429, "security_rate_limited", {
      retryAfterSeconds: rate.retryAfterSeconds,
      rateLimit: {
        count: rate.count,
        limit: rate.limit,
      },
    });
  }

  if (signals.missingTenant || signals.invalidTenant) {
    denyRequest(context, risk, context.tenantError?.errorCode || "tenant_context_required", 403, "tenant_context_required");
  }

  if (
    signals.missingSession ||
    signals.tenantMismatch ||
    signals.permissionDenied ||
    signals.planDenied ||
    risk.level === "high" ||
    risk.level === "critical"
  ) {
    const statusCode = signals.missingSession ? 401 : 403;
    const errorCode = signals.missingSession
      ? "admin_session_required"
      : signals.planDenied
        ? "plan_feature_forbidden"
        : signals.masterDenied
          ? "master_access_required"
        : signals.permissionDenied
          ? "admin_permission_denied"
          : "security_access_denied";
    denyRequest(context, risk, errorCode, statusCode, errorCode, {
      ...(signals.permissionDenied ? { requiredPermissions: options.requiredPermissions || undefined } : {}),
      ...(signals.planDeniedDetails || {}),
    });
  }

  recordSecurityEvent({
    type: "security_guardian_decision",
    outcome: risk.level === "medium" ? "allowed_logged" : "allowed",
    riskLevel: risk.level,
    riskScore: risk.score,
    riskReasons: risk.reasons,
    routeType: context.routeType,
    group: context.group,
    action: context.action,
    method: context.method,
    path: context.path,
    ip: context.ip,
    userAgent: context.userAgent,
    tenant: context.tenantKey,
    user: context.userKey,
  });

  return {
    allowed: true,
    context,
    risk,
  };
};

const recordSecurityFailure = (req, details = {}) => {
  const context = req?.securityGuardian?.context || {
    routeType: normalizeText(details.routeType || "unknown", 80),
    action: normalizeText(details.action || "unknown", 160),
    ip: getRequestIp(req),
    method: String(req?.method || "GET").toUpperCase(),
    path: getRequestUrl(req).pathname,
    tenantKey: normalizeText(details.tenantKey || req?.tenantContext?.restaurantKey, 120) || "unknown",
    userAgent: getUserAgent(req),
    userKey: normalizeText(details.userKey || "", 160),
  };
  const { key, bucket } = getFailureBucket(context, details.subject || details.userKey || "");

  bucket.count += 1;
  failureBuckets.set(key, bucket);

  if (bucket.count >= 5) {
    temporaryBlocks.set(buildBucketKey(context, "block"), {
      until: Date.now() + 15 * 60 * 1000,
      reason: details.reason || "brute_force",
    });
  }

  return recordSecurityEvent({
    type: "security_failure",
    outcome: "denied",
    severity: details.severity || "high",
    reason: details.reason || "security_failure",
    routeType: context.routeType,
    action: context.action,
    method: context.method,
    path: context.path,
    ip: context.ip,
    userAgent: context.userAgent,
    tenant: context.tenantKey,
    user: details.userKey || context.userKey,
    metadata: details.metadata || {},
    failureCount: bucket.count,
  });
};

const recordSecuritySuccess = (req, details = {}) => {
  const context = req?.securityGuardian?.context || {
    routeType: normalizeText(details.routeType || "unknown", 80),
    action: normalizeText(details.action || "unknown", 160),
    ip: getRequestIp(req),
    method: String(req?.method || "GET").toUpperCase(),
    path: getRequestUrl(req).pathname,
    tenantKey: normalizeText(details.tenantKey || req?.tenantContext?.restaurantKey, 120) || "unknown",
    userAgent: getUserAgent(req),
    userKey: normalizeText(details.userKey || "", 160),
  };

  const { key } = getFailureBucket(context, details.subject || details.userKey || "");
  failureBuckets.delete(key);

  return recordSecurityEvent({
    type: "security_success",
    outcome: "allowed",
    severity: "low",
    reason: details.reason || "security_success",
    routeType: context.routeType,
    action: context.action,
    method: context.method,
    path: context.path,
    ip: context.ip,
    userAgent: context.userAgent,
    tenant: context.tenantKey,
    user: details.userKey || context.userKey,
  });
};

const getSecurityEvents = () => securityEvents.slice();

const getSecurityAuditTrail = () => securityAuditTrail.slice();

const resetSecurityGuardianForTests = () => {
  rateLimitBuckets.clear();
  failureBuckets.clear();
  temporaryBlocks.clear();
  sessionFingerprints.clear();
  securityEvents.length = 0;
  securityAuditTrail.length = 0;
};

module.exports = {
  RATE_LIMIT_PROFILES,
  SENSITIVE_ROUTE_GROUPS,
  checkRateLimit,
  classifySecurityRisk,
  getSecurityAuditTrail,
  getSecurityEvents,
  guardSecurity,
  recordSecurityEvent,
  recordSecurityFailure,
  recordSecuritySuccess,
  resetSecurityGuardianForTests,
  sanitizeForSecurityLog,
};
