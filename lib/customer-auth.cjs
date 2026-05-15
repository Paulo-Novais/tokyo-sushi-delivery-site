const crypto = require("node:crypto");
const { shouldUseSecureAdminCookie } = require("./admin-auth.cjs");
const { getRequestHeader } = require("./http.cjs");

const CUSTOMER_SESSION_COOKIE_NAME = "tokyo_customer_session";
const CUSTOMER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const CUSTOMER_LOGIN_CHALLENGE_COOKIE_NAME = "tokyo_customer_login_challenge";
const CUSTOMER_LOGIN_CHALLENGE_TTL_SECONDS = 60 * 10;
const CUSTOMER_CLIENT_TOKEN_HEADER = "x-tokyo-customer-client-token";
const CUSTOMER_KEY_HEADER = "x-tokyo-customer-key";
const CUSTOMER_VERIFICATION_CODE_LENGTH = 6;

const deriveCustomerSessionSecret = (adminSecret) =>
  crypto.createHash("sha256").update(`customer-session:${String(adminSecret || "").trim()}`).digest("hex");

const readCustomerSessionSecret = () => {
  const customerSecret = String(process.env.CUSTOMER_SESSION_SECRET || "").trim();

  if (customerSecret) {
    return customerSecret;
  }

  const adminSecret = String(process.env.ADMIN_SESSION_SECRET || "").trim();
  return adminSecret ? deriveCustomerSessionSecret(adminSecret) : "";
};

const hasCustomerSessionConfig = () => Boolean(readCustomerSessionSecret());

const hashCustomerClientToken = (value) =>
  crypto.createHash("sha256").update(String(value || "")).digest("hex");

const normalizeCustomerVerificationCode = (value) =>
  String(value || "").replace(/\D/g, "").slice(0, CUSTOMER_VERIFICATION_CODE_LENGTH);

const hashCustomerVerificationCode = (value) =>
  crypto
    .createHash("sha256")
    .update(normalizeCustomerVerificationCode(value))
    .digest("hex");

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

const createCustomerSessionToken = ({ customerKey, clientToken, issuedAt = Date.now() }) => {
  const secret = readCustomerSessionSecret();

  if (!secret) {
    throw new Error("CUSTOMER_SESSION_SECRET is not configured.");
  }

  const payload = {
    customerKey: String(customerKey || "").trim(),
    clientTokenHash: hashCustomerClientToken(clientToken),
    iat: issuedAt,
    exp: issuedAt + CUSTOMER_SESSION_TTL_SECONDS * 1000,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signSessionPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
};

const createCustomerLoginChallengeToken = ({
  customerKey,
  clientToken,
  code,
  issuedAt = Date.now(),
}) => {
  const secret = readCustomerSessionSecret();

  if (!secret) {
    throw new Error("CUSTOMER_SESSION_SECRET is not configured.");
  }

  const payload = {
    customerKey: String(customerKey || "").trim(),
    clientTokenHash: hashCustomerClientToken(clientToken),
    codeHash: hashCustomerVerificationCode(code),
    iat: issuedAt,
    exp: issuedAt + CUSTOMER_LOGIN_CHALLENGE_TTL_SECONDS * 1000,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signSessionPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
};

const verifyCustomerSessionToken = (token) => {
  const secret = readCustomerSessionSecret();

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

    if (
      !payload?.customerKey ||
      !payload?.clientTokenHash ||
      Number(payload?.exp || 0) < Date.now()
    ) {
      return null;
    }

    return {
      customerKey: String(payload.customerKey || "").trim(),
      clientTokenHash: String(payload.clientTokenHash || "").trim(),
      issuedAt: Number(payload.iat || 0),
      expiresAt: Number(payload.exp || 0),
    };
  } catch (error) {
    return null;
  }
};

const verifyCustomerLoginChallengeToken = (token) => {
  const secret = readCustomerSessionSecret();

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

    if (
      !payload?.customerKey ||
      !payload?.clientTokenHash ||
      !payload?.codeHash ||
      Number(payload?.exp || 0) < Date.now()
    ) {
      return null;
    }

    return {
      customerKey: String(payload.customerKey || "").trim(),
      clientTokenHash: String(payload.clientTokenHash || "").trim(),
      codeHash: String(payload.codeHash || "").trim(),
      issuedAt: Number(payload.iat || 0),
      expiresAt: Number(payload.exp || 0),
    };
  } catch (error) {
    return null;
  }
};

const buildCustomerCookieAttributes = (req, maxAge) =>
  [
    "Path=/",
    "HttpOnly",
    shouldUseSecureAdminCookie(req) ? "Secure" : "",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ]
    .filter(Boolean)
    .join("; ");

const serializeCustomerSessionCookie = (sessionToken, req) =>
  `${CUSTOMER_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}; ${buildCustomerCookieAttributes(
    req,
    CUSTOMER_SESSION_TTL_SECONDS
  )}`;

const serializeCustomerLoginChallengeCookie = (challengeToken, req) =>
  `${CUSTOMER_LOGIN_CHALLENGE_COOKIE_NAME}=${encodeURIComponent(
    challengeToken
  )}; ${buildCustomerCookieAttributes(req, CUSTOMER_LOGIN_CHALLENGE_TTL_SECONDS)}`;

const serializeCustomerLogoutCookie = (req) =>
  `${CUSTOMER_SESSION_COOKIE_NAME}=; ${buildCustomerCookieAttributes(req, 0)}`;

const serializeCustomerLoginChallengeClearCookie = (req) =>
  `${CUSTOMER_LOGIN_CHALLENGE_COOKIE_NAME}=; ${buildCustomerCookieAttributes(req, 0)}`;

const getCustomerSessionFromCookieHeader = (cookieHeader) => {
  const token = String(cookieHeader || "")
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${CUSTOMER_SESSION_COOKIE_NAME}=`));

  if (!token) {
    return null;
  }

  return verifyCustomerSessionToken(token.slice(CUSTOMER_SESSION_COOKIE_NAME.length + 1));
};

const getCustomerLoginChallengeFromCookieHeader = (cookieHeader) => {
  const token = String(cookieHeader || "")
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${CUSTOMER_LOGIN_CHALLENGE_COOKIE_NAME}=`));

  if (!token) {
    return null;
  }

  return verifyCustomerLoginChallengeToken(
    token.slice(CUSTOMER_LOGIN_CHALLENGE_COOKIE_NAME.length + 1)
  );
};

const getCustomerSessionFromRequest = (req) =>
  getCustomerSessionFromCookieHeader(getRequestHeader(req, "cookie"));

const getCustomerLoginChallengeFromRequest = (req) =>
  getCustomerLoginChallengeFromCookieHeader(getRequestHeader(req, "cookie"));

const readCustomerClientToken = (req) =>
  String(getRequestHeader(req, CUSTOMER_CLIENT_TOKEN_HEADER) || "").trim();

const readCustomerKeyHeader = (req) =>
  String(getRequestHeader(req, CUSTOMER_KEY_HEADER) || "").trim();

const getBoundCustomerSessionFromRequest = (req) => {
  const session = getCustomerSessionFromRequest(req);
  const clientToken = readCustomerClientToken(req);
  const customerKey = readCustomerKeyHeader(req);

  if (!session || !clientToken || !customerKey) {
    return null;
  }

  if (hashCustomerClientToken(clientToken) !== session.clientTokenHash) {
    return null;
  }

  if (customerKey !== session.customerKey) {
    return null;
  }

  return session;
};

const getBoundCustomerLoginChallengeFromRequest = (req) => {
  const challenge = getCustomerLoginChallengeFromRequest(req);
  const clientToken = readCustomerClientToken(req);

  if (!challenge || !clientToken) {
    return null;
  }

  if (hashCustomerClientToken(clientToken) !== challenge.clientTokenHash) {
    return null;
  }

  return challenge;
};

module.exports = {
  CUSTOMER_CLIENT_TOKEN_HEADER,
  CUSTOMER_LOGIN_CHALLENGE_COOKIE_NAME,
  CUSTOMER_LOGIN_CHALLENGE_TTL_SECONDS,
  CUSTOMER_KEY_HEADER,
  CUSTOMER_SESSION_COOKIE_NAME,
  CUSTOMER_SESSION_TTL_SECONDS,
  CUSTOMER_VERIFICATION_CODE_LENGTH,
  createCustomerLoginChallengeToken,
  createCustomerSessionToken,
  getBoundCustomerLoginChallengeFromRequest,
  getBoundCustomerSessionFromRequest,
  getCustomerLoginChallengeFromCookieHeader,
  getCustomerLoginChallengeFromRequest,
  getCustomerSessionFromCookieHeader,
  getCustomerSessionFromRequest,
  hasCustomerSessionConfig,
  hashCustomerClientToken,
  hashCustomerVerificationCode,
  normalizeCustomerVerificationCode,
  readCustomerClientToken,
  readCustomerKeyHeader,
  serializeCustomerLoginChallengeClearCookie,
  serializeCustomerLoginChallengeCookie,
  serializeCustomerLogoutCookie,
  serializeCustomerSessionCookie,
  verifyCustomerLoginChallengeToken,
  verifyCustomerSessionToken,
};
