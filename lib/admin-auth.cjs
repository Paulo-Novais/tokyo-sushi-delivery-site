const crypto = require("node:crypto");
const { ADMIN_BRANDING, IDENTIFIERS } = require("./app-branding.cjs");
const { getRequestHeader } = require("./http.cjs");

const ADMIN_SESSION_COOKIE_NAME =
  IDENTIFIERS.cookieNames?.adminSession || "tokyo_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12;
const SCRYPT_KEY_LENGTH = 64;
const ADMIN_USERS_ENV_NAME = "ADMIN_USERS";

const normalizeIdentifier = (value) => String(value || "").trim().toLowerCase();

const readAdminLogin = () =>
  String(
    process.env.ADMIN_LOGIN || process.env.ADMIN_EMAIL || process.env.ADMIN_USERNAME || ""
  ).trim();

const readAdminDisplayName = () =>
  String(process.env.ADMIN_DISPLAY_NAME || ADMIN_BRANDING.displayNameFallback || "Gestor INOVAS").trim();

const readAdminPasswordHash = () => String(process.env.ADMIN_PASSWORD_HASH || "").trim();

const readAdminPassword = () => String(process.env.ADMIN_PASSWORD || "").trim();

const readSessionSecret = () => String(process.env.ADMIN_SESSION_SECRET || "").trim();

const readAdminUsersRaw = () => String(process.env[ADMIN_USERS_ENV_NAME] || "").trim();

const normalizeAdminUser = (value, index = 0) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const login = normalizeIdentifier(
    value.login || value.identifier || value.email || value.username || ""
  );
  const passwordHash = String(value.passwordHash || value.password_hash || "").trim();
  const password = String(value.password || "").trim();
  const displayName = String(value.displayName || value.name || login || `Gestor ${index + 1}`).trim();

  if (!login || (!passwordHash && !password)) {
    return null;
  }

  return {
    login,
    displayName,
    name: String(value.name || value.nome || displayName).trim() || displayName,
    email: String(value.email || login).trim().toLowerCase(),
    passwordHash,
    password,
    userType: String(value.userType || value.tipo_usuario || "MASTER").trim().toUpperCase(),
    tipo_usuario: String(value.tipo_usuario || value.userType || "MASTER").trim().toUpperCase(),
    tenantId: String(value.tenantId || value.tenant_id || "").trim(),
    restaurantId: String(value.restaurantId || value.restaurant_id || "").trim(),
    restaurantKey: String(value.restaurantKey || value.restaurant_key || "").trim(),
    platformScope: value.platformScope === true || value.platform_scope === true,
    permissions:
      value.permissions && typeof value.permissions === "object" && !Array.isArray(value.permissions)
        ? value.permissions
        : {},
  };
};

const parseAdminUsersEnv = () => {
  const raw = readAdminUsersRaw();

  if (!raw) {
    return {
      present: false,
      valid: true,
      users: [],
      issues: [],
    };
  }

  try {
    const parsed = JSON.parse(raw);
    const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.users) ? parsed.users : null;

    if (!records) {
      return {
        present: true,
        valid: false,
        users: [],
        issues: [
          {
            code: "invalid_shape",
            message: "ADMIN_USERS precisa ser um array JSON ou um objeto com a chave users.",
          },
        ],
      };
    }

    const normalizedUsers = [];
    const issues = [];
    const seenLogins = new Set();

    records.forEach((entry, index) => {
      const normalizedUser = normalizeAdminUser(entry, index);

      if (!normalizedUser) {
        issues.push({
          code: "invalid_user_entry",
          index,
          message:
            "Cada admin precisa ter login e pelo menos um entre passwordHash ou password.",
        });
        return;
      }

      if (seenLogins.has(normalizedUser.login)) {
        issues.push({
          code: "duplicate_login",
          index,
          login: normalizedUser.login,
          message: `Login administrativo duplicado: ${normalizedUser.login}.`,
        });
        return;
      }

      seenLogins.add(normalizedUser.login);
      normalizedUsers.push(normalizedUser);
    });

    return {
      present: true,
      valid: issues.length === 0,
      users: issues.length === 0 ? normalizedUsers : [],
      issues,
    };
  } catch (error) {
    return {
      present: true,
      valid: false,
      users: [],
      issues: [
        {
          code: "invalid_json",
          message: "ADMIN_USERS nao contem um JSON valido.",
        },
      ],
    };
  }
};

const getLegacyAdminUser = () => {
  const login = normalizeIdentifier(readAdminLogin());
  const passwordHash = readAdminPasswordHash();
  const password = readAdminPassword();

  if (!login || (!passwordHash && !password)) {
    return null;
  }

  return {
    login,
    displayName: readAdminDisplayName(),
    passwordHash,
    password,
  };
};

const getConfiguredAdminUsers = () => {
  const adminUsersEnv = parseAdminUsersEnv();

  if (adminUsersEnv.present) {
    return adminUsersEnv.users;
  }

  const legacyUser = getLegacyAdminUser();
  return legacyUser ? [legacyUser] : [];
};

const getDefaultAdminDisplayName = () =>
  getConfiguredAdminUsers()[0]?.displayName || readAdminDisplayName();

const hasAdminAuthConfig = () => Boolean(readSessionSecret() && getConfiguredAdminUsers().length > 0);

const getAdminAuthDiagnostics = () => {
  const adminUsersEnv = parseAdminUsersEnv();
  const legacyLogin = readAdminLogin();
  const legacyPasswordHash = readAdminPasswordHash();
  const legacyPassword = readAdminPassword();
  const sessionSecret = readSessionSecret();
  const missingRequirements = [];

  if (adminUsersEnv.present) {
    if (!adminUsersEnv.valid || !adminUsersEnv.users.length) {
      missingRequirements.push({
        key: "admin_users",
        acceptedEnvNames: [ADMIN_USERS_ENV_NAME],
      });
    }
  } else {
    if (!legacyLogin) {
      missingRequirements.push({
        key: "login",
        acceptedEnvNames: ["ADMIN_LOGIN", "ADMIN_EMAIL", "ADMIN_USERNAME"],
      });
    }

    if (!legacyPasswordHash && !legacyPassword) {
      missingRequirements.push({
        key: "password",
        acceptedEnvNames: ["ADMIN_PASSWORD_HASH", "ADMIN_PASSWORD"],
      });
    }
  }

  if (!sessionSecret) {
    missingRequirements.push({
      key: "session_secret",
      acceptedEnvNames: ["ADMIN_SESSION_SECRET"],
    });
  }

  return {
    configured: missingRequirements.length === 0,
    missingRequirements,
    configurationIssues: adminUsersEnv.present && !adminUsersEnv.valid ? adminUsersEnv.issues : [],
    acceptedEnvNames: {
      users: [ADMIN_USERS_ENV_NAME],
      login: ["ADMIN_LOGIN", "ADMIN_EMAIL", "ADMIN_USERNAME"],
      password: ["ADMIN_PASSWORD_HASH", "ADMIN_PASSWORD"],
      sessionSecret: ["ADMIN_SESSION_SECRET"],
      optional: ["ADMIN_DISPLAY_NAME"],
    },
  };
};

const getAdminAuthConfig = () => {
  const configuredUsers = getConfiguredAdminUsers();
  const primaryUser = configuredUsers[0] || null;

  return {
    login: primaryUser?.login || "",
    displayName: primaryUser?.displayName || readAdminDisplayName(),
    passwordHash: primaryUser?.passwordHash || "",
    password: primaryUser?.password || "",
    sessionSecret: readSessionSecret(),
    users: configuredUsers.map((user) => ({
      login: user.login,
      displayName: user.displayName,
    })),
  };
};

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

const verifyAdminPassword = (password, adminUser = null) => {
  const resolvedAdminUser = adminUser || getConfiguredAdminUsers()[0] || getLegacyAdminUser();
  const passwordHash = String(resolvedAdminUser?.passwordHash || "").trim();
  const fallbackPassword = String(resolvedAdminUser?.password || "");

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

const getAdminUserByIdentifier = (identifier) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);

  if (!normalizedIdentifier) {
    return null;
  }

  return getConfiguredAdminUsers().find((user) => user.login === normalizedIdentifier) || null;
};

const authenticateAdminUser = (identifier, password) => {
  const adminUser = getAdminUserByIdentifier(identifier);

  if (!adminUser || !verifyAdminPassword(password, adminUser)) {
    return null;
  }

  return adminUser;
};

const createAdminSessionToken = ({ login, displayName, issuedAt = Date.now() }) => {
  const secret = readSessionSecret();

  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not configured.");
  }

  const payload = {
    login: normalizeIdentifier(login),
    displayName: String(displayName || "").trim() || getDefaultAdminDisplayName(),
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
    const configuredAdmin = getAdminUserByIdentifier(payload?.login);

    if (!payload?.login || Number(payload?.exp || 0) < Date.now()) {
      return null;
    }

    return {
      login: normalizeIdentifier(payload.login),
      displayName:
        String(payload.displayName || "").trim() ||
        configuredAdmin.displayName ||
        getDefaultAdminDisplayName(),
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
  authenticateAdminUser,
  createAdminSessionToken,
  createPasswordHash,
  getAdminAuthConfig,
  getAdminAuthDiagnostics,
  getAdminUserByIdentifier,
  getAdminSessionFromCookieHeader,
  getAdminSessionFromRequest,
  getConfiguredAdminUsers,
  hasAdminAuthConfig,
  normalizeIdentifier,
  shouldUseSecureAdminCookie,
  serializeAdminLogoutCookie,
  serializeAdminSessionCookie,
  verifyAdminPassword,
  verifyAdminSessionToken,
};
