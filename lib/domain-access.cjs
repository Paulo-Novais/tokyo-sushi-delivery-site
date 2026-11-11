const {
  SUPPORT_ADMIN_ACTION_ALLOWLIST,
  SUPPORT_VIEW_ACTION_ALLOWLIST,
  LEGACY_RESTAURANT_ROLE_MAP,
  LEGACY_SYSTEM_ROLE_MAP,
} = require("./access-policy.cjs");
const {
  resolveEffectivePermissionSet,
} = require("./access-policy-store.cjs");
const { getConfiguredAdminUsers } = require("./admin-auth.cjs");
const { getAdminUserAccessProfile } = require("./user-permissions.cjs");
const {
  SESSION_AUDIENCES,
  getDomainSessionFromRequest,
} = require("./domain-sessions.cjs");
const {
  getActivePersistentSession,
  getActiveSupportSession,
} = require("./identity-domain-store.cjs");
const { enterDatabaseScope } = require("./tenant-sql.cjs");
const { buildHttpError, getRequestHeader } = require("./http.cjs");

const getRequestMetadata = (req) => ({
  requestId:
    getRequestHeader(req, "x-vercel-id") ||
    getRequestHeader(req, "x-request-id") ||
    "",
  ipAddress:
    getRequestHeader(req, "x-forwarded-for").split(",")[0].trim() ||
    getRequestHeader(req, "x-real-ip"),
  userAgent: getRequestHeader(req, "user-agent"),
});

const normalizeSystemRole = (role) =>
  LEGACY_SYSTEM_ROLE_MAP[String(role || "").trim().toUpperCase()] ||
  String(role || "").trim().toUpperCase();

const normalizeRestaurantRole = (role) =>
  LEGACY_RESTAURANT_ROLE_MAP[String(role || "").trim().toUpperCase()] ||
  String(role || "").trim().toUpperCase();

const validatePersistentSession = async (tokenSession) => {
  const persisted = await getActivePersistentSession({
    id: tokenSession.sessionId,
    audience: tokenSession.aud,
    jti: tokenSession.jti,
  });

  if (
    !persisted ||
    persisted.identityId !== tokenSession.identityId ||
    (tokenSession.aud === SESSION_AUDIENCES.RESTAURANT &&
      (persisted.tenantId !== tokenSession.tenantId ||
        persisted.restaurantId !== tokenSession.restaurantId))
  ) {
    throw buildHttpError(
      401,
      "Sessão inválida, expirada ou revogada.",
      "domain_session_revoked"
    );
  }

  return persisted;
};

const requireSystemSession = async (req) => {
  const tokenSession = getDomainSessionFromRequest(
    req,
    SESSION_AUDIENCES.SYSTEM
  );

  if (!tokenSession) {
    throw buildHttpError(
      401,
      "Sessão System obrigatória.",
      "system_session_required"
    );
  }

  enterDatabaseScope({
    audience: "system",
    identityId: tokenSession.identityId,
    sessionId: tokenSession.sessionId,
  });
  const persisted = await validatePersistentSession(tokenSession);
  const role = normalizeSystemRole(tokenSession.role);
  const accessProfile = await getAdminUserAccessProfile(
    tokenSession.login,
    getConfiguredAdminUsers()
  );
  const profileMatchesSystem =
    accessProfile?.userScope === "SYSTEM" &&
    !accessProfile.tenantId &&
    !accessProfile.restaurantId &&
    !accessProfile.restaurantKey;

  return {
    ...tokenSession,
    ...persisted,
    audience: SESSION_AUDIENCES.SYSTEM,
    role,
    tenantId: null,
    restaurantId: null,
    restaurantKey: null,
    effectivePermissions: await resolveEffectivePermissionSet({
      domain: "SYSTEM",
      role,
      grantOverrides: profileMatchesSystem ? accessProfile.grantOverrides : [],
      denyOverrides: profileMatchesSystem ? accessProfile.denyOverrides : [],
    }),
  };
};

const requireDirectRestaurantSession = async (req) => {
  const tokenSession = getDomainSessionFromRequest(
    req,
    SESSION_AUDIENCES.RESTAURANT
  );

  if (!tokenSession) {
    return null;
  }

  enterDatabaseScope({
    audience: "restaurant",
    tenantId: tokenSession.tenantId,
    restaurantId: tokenSession.restaurantId,
    restaurantKey: tokenSession.restaurantKey,
    identityId: tokenSession.identityId,
    sessionId: tokenSession.sessionId,
  });
  const persisted = await validatePersistentSession(tokenSession);
  const role = normalizeRestaurantRole(tokenSession.role);
  const accessProfile = await getAdminUserAccessProfile(
    tokenSession.login,
    getConfiguredAdminUsers()
  );
  const profileMatchesTenant =
    accessProfile?.userScope === "RESTAURANT" &&
    accessProfile.tenantId === tokenSession.tenantId &&
    accessProfile.restaurantId === tokenSession.restaurantId &&
    accessProfile.restaurantKey === tokenSession.restaurantKey;

  return {
    ...tokenSession,
    ...persisted,
    audience: SESSION_AUDIENCES.RESTAURANT,
    role,
    effectivePermissions: await resolveEffectivePermissionSet({
      domain: "RESTAURANT",
      role,
      grantOverrides: profileMatchesTenant ? accessProfile.grantOverrides : [],
      denyOverrides: profileMatchesTenant ? accessProfile.denyOverrides : [],
    }),
  };
};

const requireSupportContext = async (req) => {
  const systemToken = getDomainSessionFromRequest(req, SESSION_AUDIENCES.SYSTEM);
  const supportToken = getDomainSessionFromRequest(
    req,
    SESSION_AUDIENCES.SUPPORT
  );

  if (!systemToken || !supportToken) {
    return null;
  }

  if (systemToken.identityId !== supportToken.identityId) {
    throw buildHttpError(
      403,
      "O contexto de suporte não pertence à sessão System.",
      "support_identity_mismatch"
    );
  }

  enterDatabaseScope({
    audience: "system",
    identityId: systemToken.identityId,
    sessionId: systemToken.sessionId,
  });
  await validatePersistentSession(systemToken);
  const supportSession = await getActiveSupportSession({
    id: supportToken.supportSessionId,
    systemIdentityId: systemToken.identityId,
  });

  if (
    !supportSession ||
    supportSession.systemSessionId !== systemToken.sessionId ||
    supportSession.tenantId !== supportToken.tenantId ||
    supportSession.restaurantId !== supportToken.restaurantId ||
    supportSession.mode !== supportToken.supportMode
  ) {
    throw buildHttpError(
      401,
      "Sessão de suporte inválida, expirada ou revogada.",
      "support_session_revoked"
    );
  }

  enterDatabaseScope({
    audience: "support",
    tenantId: supportSession.tenantId,
    restaurantId: supportSession.restaurantId,
    restaurantKey: supportSession.restaurantKey,
    identityId: systemToken.identityId,
    sessionId: systemToken.sessionId,
    supportSessionId: supportSession.id,
    supportMode: supportSession.mode,
  });

  return {
    ...supportToken,
    audience: SESSION_AUDIENCES.SUPPORT,
    identityId: systemToken.identityId,
    // Perfil da pessoa da INOVAS que abriu o suporte (ex.: só o Master altera permissões).
    systemRole: normalizeSystemRole(systemToken.role),
    systemSessionId: systemToken.sessionId,
    tenantId: supportSession.tenantId,
    restaurantId: supportSession.restaurantId,
    restaurantKey: supportSession.restaurantKey,
    restaurantName: supportSession.restaurantName,
    matchedDomain: true,
    resolutionMode: "support_session",
    source: "support_session",
    host: `support:${supportSession.restaurantKey}`,
    supportSessionId: supportSession.id,
    supportMode: supportSession.mode,
    reason: supportSession.reason,
    createdAt: supportSession.createdAt,
    expiresAt: new Date(supportSession.expiresAt).getTime(),
  };
};

const requireRestaurantAccess = async (req) => {
  const directSession = await requireDirectRestaurantSession(req);
  if (directSession) {
    return directSession;
  }

  const supportContext = await requireSupportContext(req);
  if (supportContext) {
    return supportContext;
  }

  if (getDomainSessionFromRequest(req, SESSION_AUDIENCES.SYSTEM)) {
    throw buildHttpError(
      403,
      "A sessão System não concede acesso operacional. Inicie uma sessão de suporte.",
      "system_session_not_tenant_session"
    );
  }

  throw buildHttpError(
    401,
    "Sessão Restaurant ou Support obrigatória.",
    "restaurant_session_required"
  );
};

const assertSupportActionAllowed = (session, action) => {
  if (session?.audience !== SESSION_AUDIENCES.SUPPORT) {
    return;
  }

  const allowlist =
    session.supportMode === "ADMIN"
      ? SUPPORT_ADMIN_ACTION_ALLOWLIST
      : SUPPORT_VIEW_ACTION_ALLOWLIST;

  if (!allowlist.includes(action)) {
    throw buildHttpError(
      403,
      "Esta ação não está autorizada na sessão de suporte.",
      "support_action_denied",
      {
        action,
        supportMode: session.supportMode,
      }
    );
  }
};

// Regra do dono da plataforma: só o usuário Master define o que cada usuário
// pode fazer (matriz de perfis, perfil da equipe INOVAS e permissões
// individuais). Vale mesmo que outra pessoa tenha a permissão por engano.
const isPlatformMaster = (session = {}) => {
  if (session.audience === SESSION_AUDIENCES.SYSTEM) return normalizeSystemRole(session.role) === "MASTER";
  if (session.audience === SESSION_AUDIENCES.SUPPORT) return normalizeSystemRole(session.systemRole) === "MASTER";
  return false;
};

const assertPlatformMaster = (session, message = "Somente o usuário Master da INOVAS pode alterar permissões.") => {
  if (!isPlatformMaster(session)) {
    throw buildHttpError(403, message, "platform_master_required");
  }
};

module.exports = {
  assertPlatformMaster,
  isPlatformMaster,
  assertSupportActionAllowed,
  getRequestMetadata,
  normalizeRestaurantRole,
  normalizeSystemRole,
  requireDirectRestaurantSession,
  requireRestaurantAccess,
  requireSupportContext,
  requireSystemSession,
};
