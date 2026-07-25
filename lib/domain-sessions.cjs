const crypto = require("node:crypto");
const { getRequestHeader } = require("./http.cjs");

const SESSION_ISSUER = "inovas-food";
const SESSION_AUDIENCES = Object.freeze({
  SYSTEM: "system",
  RESTAURANT: "restaurant",
  SUPPORT: "support",
});
const SESSION_COOKIE_NAMES = Object.freeze({
  system: "inovas_system_session",
  restaurant: "inovas_restaurant_session",
  support: "inovas_support_context",
});
const SESSION_TTL_SECONDS = Object.freeze({
  system: 60 * 60 * 8,
  restaurant: 60 * 60 * 12,
  support: 60 * 30,
});

const toBase64Url = (value) => Buffer.from(value).toString("base64url");
const fromBase64Url = (value) => Buffer.from(String(value || ""), "base64url");

const normalizeAudience = (value) => {
  const audience = String(value || "").trim().toLowerCase();
  return Object.values(SESSION_AUDIENCES).includes(audience) ? audience : "";
};

const readSessionSecret = (audience) => {
  const normalizedAudience = normalizeAudience(audience);
  const environmentName = {
    system: "SYSTEM_SESSION_SECRET",
    restaurant: "RESTAURANT_SESSION_SECRET",
    support: "SUPPORT_SESSION_SECRET",
  }[normalizedAudience];
  return String(
    process.env[environmentName] || process.env.ADMIN_SESSION_SECRET || ""
  ).trim();
};

const sign = (encodedPayload, secret) =>
  crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");

const createDomainSessionToken = ({
  audience,
  sessionId,
  identityId,
  principalId = "",
  membershipId = "",
  login,
  displayName,
  role,
  tenantId = "",
  restaurantId = "",
  restaurantKey = "",
  supportMode = "",
  supportSessionId = "",
  issuedAt = Date.now(),
  expiresAt,
  jti = crypto.randomUUID(),
}) => {
  const normalizedAudience = normalizeAudience(audience);
  const secret = readSessionSecret(normalizedAudience);

  if (!normalizedAudience || !secret) {
    throw new Error("Session audience or secret is not configured.");
  }

  const ttlSeconds = SESSION_TTL_SECONDS[normalizedAudience];
  const resolvedExpiresAt =
    Number(expiresAt || 0) || issuedAt + ttlSeconds * 1000;
  const isSystem = normalizedAudience === SESSION_AUDIENCES.SYSTEM;
  const isRestaurant = normalizedAudience === SESSION_AUDIENCES.RESTAURANT;
  const payload = {
    iss: SESSION_ISSUER,
    aud: normalizedAudience,
    sub: String(identityId || "").trim(),
    sid: String(sessionId || "").trim(),
    jti: String(jti || "").trim(),
    login: String(login || "").trim().toLowerCase(),
    displayName: String(displayName || "").trim(),
    role: String(role || "").trim().toUpperCase(),
    principalId: isSystem ? String(principalId || "").trim() : "",
    membershipId: isRestaurant ? String(membershipId || "").trim() : "",
    tenantId: isSystem ? null : String(tenantId || "").trim() || null,
    restaurantId: isSystem ? null : String(restaurantId || "").trim() || null,
    restaurantKey: isSystem ? null : String(restaurantKey || "").trim() || null,
    supportMode:
      normalizedAudience === SESSION_AUDIENCES.SUPPORT
        ? String(supportMode || "").trim().toUpperCase()
        : null,
    supportSessionId:
      normalizedAudience === SESSION_AUDIENCES.SUPPORT
        ? String(supportSessionId || "").trim()
        : null,
    iat: issuedAt,
    exp: resolvedExpiresAt,
  };

  if (!payload.sub || !payload.sid || !payload.jti || !payload.login) {
    throw new Error("Session identity, id, jti and login are required.");
  }

  if (
    normalizedAudience === SESSION_AUDIENCES.RESTAURANT &&
    (!payload.membershipId ||
      !payload.tenantId ||
      !payload.restaurantId ||
      !payload.restaurantKey)
  ) {
    throw new Error("Restaurant sessions require a complete membership scope.");
  }

  if (
    normalizedAudience === SESSION_AUDIENCES.SUPPORT &&
    (!payload.supportSessionId ||
      !payload.tenantId ||
      !payload.restaurantId ||
      !["VIEW", "ADMIN"].includes(payload.supportMode))
  ) {
    throw new Error("Support sessions require a complete persisted scope.");
  }

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
};

const verifyDomainSessionToken = (token, expectedAudience) => {
  const audience = normalizeAudience(expectedAudience);
  const secret = readSessionSecret(audience);
  const [encodedPayload, providedSignature, extra] = String(token || "").split(".");

  if (
    !audience ||
    !secret ||
    !encodedPayload ||
    !providedSignature ||
    extra !== undefined
  ) {
    return null;
  }

  const expectedSignature = sign(encodedPayload, secret);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8"));

    if (
      payload?.iss !== SESSION_ISSUER ||
      payload?.aud !== audience ||
      !payload?.sub ||
      !payload?.sid ||
      !payload?.jti ||
      !payload?.login ||
      Number(payload?.exp || 0) <= Date.now()
    ) {
      return null;
    }

    if (
      audience === SESSION_AUDIENCES.SYSTEM &&
      (payload.tenantId !== null ||
        payload.restaurantId !== null ||
        payload.restaurantKey !== null)
    ) {
      return null;
    }

    if (
      audience === SESSION_AUDIENCES.RESTAURANT &&
      (!payload.membershipId ||
        !payload.tenantId ||
        !payload.restaurantId ||
        !payload.restaurantKey)
    ) {
      return null;
    }

    if (
      audience === SESSION_AUDIENCES.SUPPORT &&
      (!payload.supportSessionId ||
        !payload.tenantId ||
        !payload.restaurantId ||
        !["VIEW", "ADMIN"].includes(payload.supportMode))
    ) {
      return null;
    }

    return {
      ...payload,
      identityId: payload.sub,
      sessionId: payload.sid,
      issuedAt: Number(payload.iat || 0),
      expiresAt: Number(payload.exp || 0),
    };
  } catch {
    return null;
  }
};

const parseCookies = (cookieHeader) =>
  Object.fromEntries(
    String(cookieHeader || "")
      .split(";")
      .map((entry) => entry.trim())
      .filter((entry) => entry.includes("="))
      .map((entry) => {
        const index = entry.indexOf("=");
        const name = entry.slice(0, index);
        const rawValue = entry.slice(index + 1);
        try {
          return [name, decodeURIComponent(rawValue)];
        } catch {
          return [name, ""];
        }
      })
  );

const getDomainSessionFromRequest = (req, audience) => {
  const normalizedAudience = normalizeAudience(audience);
  const cookieName = SESSION_COOKIE_NAMES[normalizedAudience];
  const cookies = parseCookies(
    req?.headers?.cookie || getRequestHeader(req, "cookie")
  );
  return verifyDomainSessionToken(cookies[cookieName], normalizedAudience);
};

const normalizeHost = (value) =>
  String(value || "")
    .split(",")[0]
    .trim()
    .replace(/:\d+$/, "")
    .toLowerCase();

const shouldUseSecureCookie = (req) => {
  const host = normalizeHost(
    getRequestHeader(req, "x-forwarded-host") ||
      getRequestHeader(req, "host")
  );

  if (["localhost", "127.0.0.1", "::1"].includes(host)) {
    return false;
  }

  const forwardedProto = getRequestHeader(req, "x-forwarded-proto")
    .split(",")[0]
    .trim()
    .toLowerCase();
  return forwardedProto
    ? forwardedProto === "https"
    : process.env.NODE_ENV === "production";
};

const buildCookieAttributes = (req, maxAge) =>
  [
    "Path=/",
    "HttpOnly",
    shouldUseSecureCookie(req) ? "Secure" : "",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Number(maxAge || 0))}`,
  ]
    .filter(Boolean)
    .join("; ");

const serializeDomainSessionCookie = (audience, token, req, maxAge) => {
  const normalizedAudience = normalizeAudience(audience);
  const cookieName = SESSION_COOKIE_NAMES[normalizedAudience];
  const ttl =
    maxAge === undefined
      ? SESSION_TTL_SECONDS[normalizedAudience]
      : Number(maxAge || 0);
  return `${cookieName}=${encodeURIComponent(token)}; ${buildCookieAttributes(
    req,
    ttl
  )}`;
};

const serializeDomainLogoutCookie = (audience, req) =>
  serializeDomainSessionCookie(audience, "", req, 0);

module.exports = {
  SESSION_AUDIENCES,
  SESSION_COOKIE_NAMES,
  SESSION_ISSUER,
  SESSION_TTL_SECONDS,
  createDomainSessionToken,
  getDomainSessionFromRequest,
  parseCookies,
  serializeDomainLogoutCookie,
  serializeDomainSessionCookie,
  verifyDomainSessionToken,
};
