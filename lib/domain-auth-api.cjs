const crypto = require("node:crypto");
const {
  SESSION_AUDIENCES,
  SESSION_TTL_SECONDS,
  createDomainSessionToken,
  getDomainSessionFromRequest,
  serializeDomainLogoutCookie,
  serializeDomainSessionCookie,
} = require("./domain-sessions.cjs");
const {
  getRequestMetadata,
  requireDirectRestaurantSession,
  requireSystemSession,
} = require("./domain-access.cjs");
const {
  buildIdentityId,
  createPersistentSession,
  revokePersistentSession,
  syncLegacyDomainUser,
} = require("./identity-domain-store.cjs");
const { enterDatabaseScope } = require("./tenant-sql.cjs");
const {
  assertTenantContextMatchesSession,
  getRequestTenantContext,
} = require("./tenant-context.cjs");
const {
  authenticateAdminUser,
  recordAdminUserAccess,
} = require("./user-permissions.cjs");
const { getConfiguredAdminUsers } = require("./admin-auth.cjs");
const {
  guardSecurity,
  recordSecurityFailure,
  recordSecuritySuccess,
} = require("./security-guardian.cjs");
const { json, parseJsonBody } = require("./http.cjs");

const getAction = (req, audience) => {
  const queryAction = Array.isArray(req?.query?.action)
    ? req.query.action.join("/")
    : String(req?.query?.action || "");

  if (queryAction) {
    return queryAction.split("/").filter(Boolean).pop().toLowerCase();
  }

  const pathname = new URL(String(req?.url || "/"), "http://localhost")
    .pathname;
  const prefix = `/api/auth/${audience}/`;
  return pathname.startsWith(prefix)
    ? pathname.slice(prefix.length).split("/").filter(Boolean)[0] || "session"
    : "session";
};

const sendError = (res, error, requestId = "") => {
  const statusCode = Number(error?.statusCode || 500);
  const code =
    error?.errorCode || (statusCode >= 500 ? "internal_error" : "request_error");
  return json(res, statusCode, {
    success: false,
    authenticated: false,
    error: {
      code,
      message:
        statusCode >= 500
          ? "Não foi possível concluir a autenticação."
          : error?.message || "Acesso negado.",
      field: error?.field || undefined,
    },
    requestId,
  });
};

const buildPublicSession = (session) => ({
  identityId: session.identityId,
  audience: session.audience || session.aud,
  login: session.login,
  displayName: session.displayName,
  role: session.role,
  tenantId: session.tenantId ?? null,
  restaurantId: session.restaurantId ?? null,
  restaurantKey: session.restaurantKey ?? null,
  expiresAt:
    typeof session.expiresAt === "number"
      ? new Date(session.expiresAt).toISOString()
      : session.expiresAt,
  effectivePermissions: session.effectivePermissions || [],
});

const handleLogin = async (req, res, audience) => {
  const metadata = getRequestMetadata(req);
  if (req.domainSecurityValidated !== true) {
    await guardSecurity(req, {
      routeType: "admin-auth",
      action: `${audience}:login`,
      requireTenant: false,
      requireSession: false,
      rateLimitProfile: "adminLogin",
    });
  }
  const payload = parseJsonBody(req.body, { strict: true });
  const identifier = String(payload.identifier || payload.email || "")
    .trim()
    .toLowerCase();
  const password = String(payload.password || "");

  if (!identifier || !password) {
    const error = new Error("E-mail e senha são obrigatórios.");
    error.statusCode = 400;
    error.errorCode = "missing_credentials";
    throw error;
  }

  const requestTenantContext =
    audience === SESSION_AUDIENCES.RESTAURANT
      ? await getRequestTenantContext(req, {
          source: "restaurant_login",
        })
      : null;

  const configuredUsers = getConfiguredAdminUsers();
  enterDatabaseScope({
    audience: "authentication",
    login: identifier,
    identityId: buildIdentityId(identifier),
  });
  const authenticatedUser = await authenticateAdminUser(
    identifier,
    password,
    configuredUsers
  );

  if (!authenticatedUser) {
    recordSecurityFailure(req, {
      routeType: "admin-auth",
      action: `${audience}:login`,
      reason: "invalid_credentials",
      userKey: identifier,
    });
    const error = new Error("E-mail ou senha inválidos.");
    error.statusCode = 401;
    error.errorCode = "invalid_credentials";
    throw error;
  }

  const userScope = String(authenticatedUser.userScope || "")
    .trim()
    .toUpperCase();
  const expectedScope =
    audience === SESSION_AUDIENCES.SYSTEM ? "SYSTEM" : "RESTAURANT";

  if (userScope !== expectedScope) {
    recordSecurityFailure(req, {
      routeType: "admin-auth",
      action: `${audience}:login`,
      reason: "session_audience_mismatch",
      userKey: identifier,
    });
    const error = new Error(
      expectedScope === "SYSTEM"
        ? "Esta conta não pertence à plataforma INOVAS."
        : "Esta conta não possui vínculo com um restaurante."
    );
    error.statusCode = 403;
    error.errorCode = "session_audience_mismatch";
    throw error;
  }

  if (requestTenantContext) {
    assertTenantContextMatchesSession(
      requestTenantContext,
      authenticatedUser
    );
  }

  const preliminaryIdentityId = buildIdentityId(
    authenticatedUser.email || authenticatedUser.login
  );
  enterDatabaseScope({
    audience,
    identityId: preliminaryIdentityId,
    tenantId:
      audience === SESSION_AUDIENCES.RESTAURANT
        ? authenticatedUser.tenantId
        : "",
    restaurantId:
      audience === SESSION_AUDIENCES.RESTAURANT
        ? authenticatedUser.restaurantId
        : "",
    restaurantKey:
      audience === SESSION_AUDIENCES.RESTAURANT
        ? authenticatedUser.restaurantKey
        : "",
  });
  const domainUser = await syncLegacyDomainUser(authenticatedUser);
  const identityId = domainUser.identity.id;
  const sessionId = `session_${crypto.randomUUID()}`;
  const jti = crypto.randomUUID();
  const issuedAt = Date.now();
  const expiresAt =
    issuedAt + SESSION_TTL_SECONDS[audience] * 1000;
  const principal = domainUser.principal;
  const membership = domainUser.membership;
  const sessionScope =
    audience === SESSION_AUDIENCES.SYSTEM
      ? {
          audience: "system",
          identityId,
          sessionId,
        }
      : {
          audience: "restaurant",
          identityId,
          sessionId,
          tenantId: membership.tenantId,
          restaurantId: membership.restaurantId,
          restaurantKey: membership.restaurantKey,
        };
  enterDatabaseScope(sessionScope);

  await createPersistentSession({
    id: sessionId,
    identityId,
    audience,
    jti,
    principalId: principal?.id || "",
    membershipId: membership?.id || "",
    tenantId: membership?.tenantId || "",
    restaurantId: membership?.restaurantId || "",
    issuedAt: new Date(issuedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
    metadata: {
      role:
        principal?.systemRole ||
        membership?.restaurantRole ||
        authenticatedUser.userType,
    },
  });

  const role =
    principal?.systemRole ||
    membership?.restaurantRole ||
    authenticatedUser.userType;
  const token = createDomainSessionToken({
    audience,
    sessionId,
    jti,
    identityId,
    principalId: principal?.id || "",
    membershipId: membership?.id || "",
    login: authenticatedUser.login,
    displayName: authenticatedUser.displayName || authenticatedUser.name,
    role,
    tenantId: membership?.tenantId || "",
    restaurantId: membership?.restaurantId || "",
    restaurantKey: membership?.restaurantKey || "",
    issuedAt,
    expiresAt,
  });
  await recordAdminUserAccess(authenticatedUser.login, configuredUsers);
  recordSecuritySuccess(req, {
    routeType: "admin-auth",
    action: `${audience}:login`,
    reason: "domain_login_success",
    userKey: authenticatedUser.login,
  });

  const oppositeAudience =
    audience === SESSION_AUDIENCES.SYSTEM
      ? SESSION_AUDIENCES.RESTAURANT
      : SESSION_AUDIENCES.SYSTEM;
  const cookieHeaders = [
    serializeDomainSessionCookie(audience, token, req),
    serializeDomainLogoutCookie(oppositeAudience, req),
    serializeDomainLogoutCookie(SESSION_AUDIENCES.SUPPORT, req),
  ];
  const session = {
    identityId,
    audience,
    login: authenticatedUser.login,
    displayName: authenticatedUser.displayName || authenticatedUser.name,
    role,
    tenantId: membership?.tenantId || null,
    restaurantId: membership?.restaurantId || null,
    restaurantKey: membership?.restaurantKey || null,
    expiresAt,
  };

  return json(
    res,
    200,
    {
      success: true,
      authenticated: true,
      data: {
        session: buildPublicSession(session),
        redirectTo:
          audience === SESSION_AUDIENCES.SYSTEM ? "/system" : "/admin",
      },
      requestId: metadata.requestId,
    },
    {
      "Set-Cookie": cookieHeaders,
    }
  );
};

const handleSession = async (req, res, audience) => {
  const metadata = getRequestMetadata(req);
  const session =
    audience === SESSION_AUDIENCES.SYSTEM
      ? await requireSystemSession(req)
      : await requireDirectRestaurantSession(req);

  if (!session) {
    return json(res, 200, {
      success: true,
      authenticated: false,
      data: {
        session: null,
      },
      requestId: metadata.requestId,
    });
  }

  return json(res, 200, {
    success: true,
    authenticated: true,
    data: {
      session: buildPublicSession(session),
    },
    requestId: metadata.requestId,
  });
};

const handleLogout = async (req, res, audience) => {
  const metadata = getRequestMetadata(req);
  const tokenSession = getDomainSessionFromRequest(req, audience);

  if (tokenSession) {
    enterDatabaseScope({
      audience,
      identityId: tokenSession.identityId,
      sessionId: tokenSession.sessionId,
      tenantId: tokenSession.tenantId || "",
      restaurantId: tokenSession.restaurantId || "",
      restaurantKey: tokenSession.restaurantKey || "",
    });
    await revokePersistentSession({
      id: tokenSession.sessionId,
      revokedBy: tokenSession.identityId,
    });
  }

  return json(
    res,
    200,
    {
      success: true,
      data: {
        loggedOut: true,
      },
      requestId: metadata.requestId,
    },
    {
      "Set-Cookie": [
        serializeDomainLogoutCookie(audience, req),
        ...(audience === SESSION_AUDIENCES.SYSTEM
          ? [serializeDomainLogoutCookie(SESSION_AUDIENCES.SUPPORT, req)]
          : []),
      ],
    }
  );
};

const createDomainAuthHandler = (audience) => async (req, res) => {
  const metadata = getRequestMetadata(req);
  const action = getAction(req, audience);

  try {
    if (action === "login") {
      if (req.method !== "POST") {
        const error = new Error("Método não permitido.");
        error.statusCode = 405;
        error.errorCode = "method_not_allowed";
        throw error;
      }
      return await handleLogin(req, res, audience);
    }

    if (action === "session") {
      if (req.method !== "GET") {
        const error = new Error("Método não permitido.");
        error.statusCode = 405;
        error.errorCode = "method_not_allowed";
        throw error;
      }
      return await handleSession(req, res, audience);
    }

    if (action === "logout") {
      if (!["GET", "POST"].includes(req.method)) {
        const error = new Error("Método não permitido.");
        error.statusCode = 405;
        error.errorCode = "method_not_allowed";
        throw error;
      }
      return await handleLogout(req, res, audience);
    }

    const error = new Error("Operação de autenticação não encontrada.");
    error.statusCode = 404;
    error.errorCode = "auth_action_not_found";
    throw error;
  } catch (error) {
    if (Number(error?.statusCode || 500) >= 500) {
      console.error("[domain-auth]", {
        audience,
        action,
        errorCode: error?.errorCode || "internal_error",
        message: error instanceof Error ? error.message : "Unknown error",
        requestId: metadata.requestId,
      });
    }
    return sendError(res, error, metadata.requestId);
  }
};

module.exports = {
  createDomainAuthHandler,
};
