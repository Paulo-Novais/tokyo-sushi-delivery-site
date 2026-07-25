const crypto = require("node:crypto");
const { assertPermission } = require("./access-policy.cjs");
const {
  getRequestMetadata,
  requireSupportContext,
  requireSystemSession,
} = require("./domain-access.cjs");
const {
  SESSION_AUDIENCES,
  createDomainSessionToken,
  serializeDomainLogoutCookie,
  serializeDomainSessionCookie,
} = require("./domain-sessions.cjs");
const {
  appendAuditEvent,
  createSupportSession,
  revokeSupportSession,
} = require("./identity-domain-store.cjs");
const {
  assertMethod,
  getDomainActionSegments,
  sendDomainError,
  sendDomainSuccess,
} = require("./domain-api-utils.cjs");
const { getMasterPlatformSnapshot } = require("./master-platform-store.cjs");
const { enterDatabaseScope } = require("./tenant-sql.cjs");
const { buildHttpError, parseJsonBody } = require("./http.cjs");

const findRestaurantScope = async (payload) => {
  const snapshot = await getMasterPlatformSnapshot({
    metrics: {},
    usersPayload: { users: [] },
  });
  const restaurant = snapshot.restaurants.find((entry) => {
    if (payload.restaurantId) {
      return entry.restaurantId === payload.restaurantId;
    }
    if (payload.tenantId && payload.restaurantKey) {
      return (
        entry.tenantId === payload.tenantId &&
        entry.restaurantKey === payload.restaurantKey
      );
    }
    return entry.restaurantKey === payload.restaurantKey;
  });

  if (
    !restaurant ||
    (payload.tenantId && restaurant.tenantId !== payload.tenantId) ||
    (payload.restaurantId && restaurant.restaurantId !== payload.restaurantId)
  ) {
    throw buildHttpError(
      404,
      "Restaurante não encontrado para suporte.",
      "support_restaurant_not_found"
    );
  }

  return restaurant;
};

const serializeSupportSession = (session) => ({
  id: session.id || session.supportSessionId,
  restaurantName: session.restaurantName,
  restaurantKey: session.restaurantKey,
  tenantId: session.tenantId,
  restaurantId: session.restaurantId,
  mode: session.mode || session.supportMode,
  reason: session.reason,
  createdAt: session.createdAt,
  expiresAt:
    typeof session.expiresAt === "number"
      ? new Date(session.expiresAt).toISOString()
      : session.expiresAt,
  status: session.status || "ACTIVE",
});

const handleSupportApi = async (req, res) => {
  const metadata = getRequestMetadata(req);

  try {
    const segments = getDomainActionSegments(req, "support");
    const action = segments[0] || "session";

    if (action === "start") {
      assertMethod(req, "POST");
      const systemSession = await requireSystemSession(req);
      const payload = parseJsonBody(req.body, { strict: true });
      const mode = String(payload.mode || "").trim().toUpperCase();
      assertPermission(
        systemSession,
        mode === "ADMIN"
          ? "system.support.admin"
          : "system.support.start"
      );
      const restaurant = await findRestaurantScope(payload);
      const supportSession = await createSupportSession({
        systemIdentityId: systemSession.identityId,
        systemSessionId: systemSession.sessionId,
        tenantId: restaurant.tenantId,
        restaurantId: restaurant.restaurantId,
        restaurantKey: restaurant.restaurantKey,
        restaurantName: restaurant.name,
        mode,
        reason: payload.reason,
        confirmed: payload.confirmed === true,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        requestId: metadata.requestId,
      });
      const token = createDomainSessionToken({
        audience: SESSION_AUDIENCES.SUPPORT,
        sessionId: systemSession.sessionId,
        jti: crypto.randomUUID(),
        identityId: systemSession.identityId,
        login: systemSession.login,
        displayName: systemSession.displayName,
        role: systemSession.role,
        tenantId: supportSession.tenantId,
        restaurantId: supportSession.restaurantId,
        restaurantKey: supportSession.restaurantKey,
        supportMode: supportSession.mode,
        supportSessionId: supportSession.id,
        expiresAt: new Date(supportSession.expiresAt).getTime(),
      });
      await appendAuditEvent({
        actorIdentityId: systemSession.identityId,
        actorType: "SYSTEM",
        tenantId: supportSession.tenantId,
        restaurantId: supportSession.restaurantId,
        eventType: "SUPPORT_SESSION_STARTED",
        result: "SUCCESS",
        reason: supportSession.reason,
        requestId: metadata.requestId,
        supportSessionId: supportSession.id,
        metadata: {
          mode: supportSession.mode,
        },
      });

      res.setHeader(
        "Set-Cookie",
        serializeDomainSessionCookie(
          SESSION_AUDIENCES.SUPPORT,
          token,
          req,
          Math.max(
            1,
            Math.floor(
              (new Date(supportSession.expiresAt).getTime() - Date.now()) / 1000
            )
          )
        )
      );
      return sendDomainSuccess(
        res,
        {
          supportSession: serializeSupportSession(supportSession),
          redirectTo: "/admin",
        },
        {
          statusCode: 201,
          requestId: metadata.requestId,
        }
      );
    }

    if (action === "session") {
      assertMethod(req, "GET");
      const supportSession = await requireSupportContext(req);
      if (!supportSession) {
        return sendDomainSuccess(
          res,
          { active: false, supportSession: null },
          { requestId: metadata.requestId }
        );
      }
      return sendDomainSuccess(
        res,
        {
          active: true,
          supportSession: serializeSupportSession(supportSession),
        },
        { requestId: metadata.requestId }
      );
    }

    if (["revoke", "exit"].includes(action)) {
      assertMethod(req, ["POST", "DELETE"]);
      const supportContext = await requireSupportContext(req);
      if (!supportContext) {
        throw buildHttpError(
          404,
          "Nenhuma sessão de suporte ativa.",
          "support_session_not_found"
        );
      }
      enterDatabaseScope({
        audience: "system",
        identityId: supportContext.identityId,
        sessionId: supportContext.systemSessionId,
      });
      await revokeSupportSession({
        id: supportContext.supportSessionId,
        systemIdentityId: supportContext.identityId,
        revokedBy: supportContext.identityId,
      });
      await appendAuditEvent({
        actorIdentityId: supportContext.identityId,
        actorType: "SYSTEM",
        tenantId: supportContext.tenantId,
        restaurantId: supportContext.restaurantId,
        eventType: "SUPPORT_SESSION_REVOKED",
        result: "SUCCESS",
        reason: supportContext.reason,
        requestId: metadata.requestId,
        supportSessionId: supportContext.supportSessionId,
      });
      const payload = {
        success: true,
        data: {
          revoked: true,
          redirectTo: "/system",
        },
        requestId: metadata.requestId,
      };
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.setHeader(
        "Set-Cookie",
        serializeDomainLogoutCookie(SESSION_AUDIENCES.SUPPORT, req)
      );
      return res.status(200).json(payload);
    }

    throw buildHttpError(
      404,
      "Operação de suporte não encontrada.",
      "support_action_not_found"
    );
  } catch (error) {
    return sendDomainError(res, error, metadata.requestId);
  }
};

module.exports = handleSupportApi;
