const crypto = require("node:crypto");
const { getRequestHeader } = require("./http.cjs");

const ADMIN_SESSION_COOKIE_NAME = "tokyo_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12;
const SCRYPT_KEY_LENGTH = 64;

const normalizeIdentifier = (value) => String(value || "").trim().toLowerCase();

const readAdminLogin = () =>
  String(
    process.env.ADMIN_LOGIN || process.env.ADMIN_EMAIL || process.env.ADMIN_USERNAME || ""
  ).trim();

const readAdminDisplayName = () =>
  String(process.env.ADMIN_DISPLAY_NAME || "Gestor Tokyo").trim();

const readAdminPasswordHash = () => String(process.env.ADMIN_PASSWORD_HASH || "").trim();

const readAdminPassword = () => String(process.env.ADMIN_PASSWORD || "").trim();

const readSessionSecret = () => String(process.env.ADMIN_SESSION_SECRET || "").trim();

const hasAdminAuthConfig = () =>
  Boolean(readAdminLogin() && readSessionSecret() && (readAdminPasswordHash() || readAdminPassword()));

const getAdminAuthConfig = () => ({
  login: readAdminLogin(),
  displayName: readAdminDisplayName(),
  passwordHash: readAdminPasswordHash(),
  password: readAdminPassword(),
  sessionSecret: readSessionSecret(),
});

const toBase64Url = (value) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const fromBase64Url = (value) => {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64");
};

const signSessionPayload = (payload, secret) =>
  crypto.createHmac("sha256", secret).update(payload).digest("base64url");

const normalizeHost = (value) => {
  const host = String(value || "").trim();

  if (!host) {
    return "";
  }

  try {
    return new URL(`http://${host}`).hostname.toLowerCase();
  } catch (error) {
    return host
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .split(":")[0]
      .toLowerCase();
  }
};

const isLocalHost = (value) => {
  const host = normalizeHost(value);
  return ["localhost", "127.0.0.1", "::1"].includes(host);
};

const createPasswordHash = (password, salt = crypto.randomBytes(16).toString("hex")) => {
  const derivedKey = crypto.scryptSync(String(password || ""), salt, SCRYPT_KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
};

const verifyPasswordHash = (password, storedHash) => {
  const [algorithm, salt, expectedHash] = String(storedHash || "").split("$");

  if (algorithm !== "scrypt" || !salt || !expectedHash) {
    return false;
  }

  const derivedKey = crypto
    .scryptSync(String(password || ""), salt, SCRYPT_KEY_LENGTH)
    .toString("hex");

  const expectedBuffer = Buffer.from(expectedHash, "hex");
  const actualBuffer = Buffer.from(derivedKey, "hex");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
};

const verifyAdminPassword = (password) => {
  const { passwordHash, password: fallbackPassword } = getAdminAuthConfig();

  if (passwordHash) {
    return verifyPasswordHash(password, passwordHash);
  }

  if (!fallbackPassword) {
    return false;
  }

  const expectedBuffer = Buffer.from(fallbackPassword);
  const actualBuffer = Buffer.from(String(password || ""));

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
};

const createAdminSessionToken = ({ login, displayName, issuedAt = Date.now() }) => {
  const secret = readSessionSecret();

  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not configured.");
  }

  const payload = {
    login: normalizeIdentifier(login),
    displayName: String(displayName || "").trim() || readAdminDisplayName(),
    iat: issuedAt,
    exp: issuedAt + ADMIN_SESSION_TTL_SECONDS * 1000,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signSessionPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
};

const verifyAdminSessionToken = (token) => {
  const secret = readSessionSecret();

  if (!secret || typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split(".");
  const expectedSignature = signSessionPayload(encodedPayload, secret);
  const providedBuffer = Buffer.from(String(providedSignature || ""));
  const expectedBuffer = Buffer.from(String(expectedSignature || ""));

  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8"));

    if (!payload?.login || Number(payload?.exp || 0) < Date.now()) {
      return null;
    }

    return {
      login: normalizeIdentifier(payload.login),
      displayName: String(payload.displayName || "").trim() || readAdminDisplayName(),
      issuedAt: Number(payload.iat || 0),
      expiresAt: Number(payload.exp || 0),
    };
  } catch (error) {
    return null;
  }
};

const shouldUseSecureAdminCookie = (req) => {
  const forwardedHost = getRequestHeader(req, "x-forwarded-host");
  const host = forwardedHost || getRequestHeader(req, "host");

  if (host && isLocalHost(host)) {
    return false;
  }

  const forwardedProto = getRequestHeader(req, "x-forwarded-proto")
    .split(",")[0]
    .trim()
    .toLowerCase();

  if (forwardedProto) {
    return forwardedProto === "https";
  }

  try {
    const requestUrl = new URL(String(req?.url || ""));

    if (isLocalHost(requestUrl.hostname)) {
      return false;
    }

    return requestUrl.protocol === "https:";
  } catch (error) {
    return process.env.NODE_ENV === "production";
  }
};

const buildCookieAttributes = (req, maxAge) =>
  [
    "Path=/",
    "HttpOnly",
    shouldUseSecureAdminCookie(req) ? "Secure" : "",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ]
    .filter(Boolean)
    .join("; ");

const serializeAdminSessionCookie = (sessionToken, req) =>
  `${ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}; ${buildCookieAttributes(
    req,
    ADMIN_SESSION_TTL_SECONDS
  )}`;

const serializeAdminLogoutCookie = (req) =>
  `${ADMIN_SESSION_COOKIE_NAME}=; ${buildCookieAttributes(req, 0)}`;

const getAdminSessionFromCookieHeader = (cookieHeader) => {
  const token = String(cookieHeader || "")
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${ADMIN_SESSION_COOKIE_NAME}=`));

  if (!token) {
    return null;
  }

  return verifyAdminSessionToken(token.slice(ADMIN_SESSION_COOKIE_NAME.length + 1));
};

const getAdminSessionFromRequest = (req) =>
  getAdminSessionFromCookieHeader(String(req?.headers?.cookie || ""));

module.exports = {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSessionToken,
  createPasswordHash,
  getAdminAuthConfig,
  getAdminSessionFromCookieHeader,
  getAdminSessionFromRequest,
  hasAdminAuthConfig,
  normalizeIdentifier,
  shouldUseSecureAdminCookie,
  serializeAdminLogoutCookie,
  serializeAdminSessionCookie,
  verifyAdminPassword,
  verifyAdminSessionToken,
};
