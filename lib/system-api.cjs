const crypto = require("node:crypto");
const {
  SYSTEM_ROLE_DEFINITIONS,
  assertPermission,
  serializeAccessPolicy,
} = require("./access-policy.cjs");
const {
  getRequestMetadata,
  requireSystemSession,
} = require("./domain-access.cjs");
const {
  appendAuditEvent,
  revokeIdentitySessions,
  syncLegacyDomainUser,
} = require("./identity-domain-store.cjs");
const {
  assertMethod,
  getDomainActionSegments,
  sendDomainError,
  sendDomainSuccess,
} = require("./domain-api-utils.cjs");
const { getPlatformHealthSnapshot } = require("./platform-health-store.cjs");
const { getMasterPlatformSnapshot } = require("./master-platform-store.cjs");
const {
  buildUsersPayload,
  resendAdminUserInvitation,
  saveAdminUser,
  setAdminUserStatus,
} = require("./user-permissions.cjs");
const { getConfiguredAdminUsers } = require("./admin-auth.cjs");
const { enterDatabaseScope } = require("./tenant-sql.cjs");
const {
  buildHttpError,
  getRequestOrigin,
  parseJsonBody,
} = require("./http.cjs");

const normalizeRole = (value) => String(value || "").trim().toUpperCase();
const normalizeStatus = (value) => String(value || "").trim().toUpperCase();
const canExposeInvitationLink = () =>
  String(process.env.INOVAS_ALLOW_INVITE_LINK_COPY || "")
    .trim()
    .toLowerCase() === "true";

const buildActor = (session) => ({
  login: session.login,
  email: session.login,
  userType: session.role,
  tipo_usuario: session.role,
  userScope: "SYSTEM",
  platformScope: true,
  tenantId: "",
  restaurantId: "",
  restaurantKey: "",
});

const toSystemUser = (user) => ({
  id: user.id,
  identityId: user.identityId || "",
  name: user.name,
  email: user.email,
  phone: user.phone,
  jobTitle: user.jobTitle,
  department: user.department,
  internalNote: user.internalNote,
  role: user.userType,
  roleLabel: SYSTEM_ROLE_DEFINITIONS[user.userType]?.label || user.userType,
  status: user.status,
  statusLabel: user.statusLabel,
  credentialMode: user.credentialMode,
  invitation: user.invitation,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  lastAccessAt: user.lastAccessAt,
  createdBy: user.createdBy,
  source: user.source,
  auditTrail: Array.isArray(user.auditTrail) ? user.auditTrail : [],
});

const filterAndPaginate = (users, query) => {
  const search = String(query.search || "").trim().toLowerCase();
  const role = normalizeRole(query.role);
  const status = normalizeStatus(query.status);
  const sort = String(query.sort || "name").trim().toLowerCase();
  const direction = String(query.direction || "asc").trim().toLowerCase();
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(query.pageSize || 20)));
  const filtered = users.filter((user) => {
    if (
      search &&
      !`${user.name} ${user.email}`.toLowerCase().includes(search)
    ) {
      return false;
    }
    if (role && user.userType !== role) {
      return false;
    }
    if (status && user.status !== status) {
      return false;
    }
    return true;
  });
  const sortValue = (user) => {
    if (sort === "status") return user.status;
    if (sort === "role") return user.userType;
    if (sort === "updated") return user.updatedAt;
    return user.name;
  };
  filtered.sort((left, right) => {
    const comparison = String(sortValue(left) || "").localeCompare(
      String(sortValue(right) || ""),
      "pt-BR"
    );
    return direction === "desc" ? -comparison : comparison;
  });
  const offset = (page - 1) * pageSize;
  return {
    users: filtered.slice(offset, offset + pageSize),
    meta: {
      page,
      pageSize,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    },
  };
};

const getSystemUsers = async (query = {}) => {
  const payload = await buildUsersPayload(getConfiguredAdminUsers());
  const systemUsers = payload.users.filter(
    (user) => user.userScope === "SYSTEM" && user.platformScope === true
  );
  const result = filterAndPaginate(systemUsers, query);
  return {
    users: result.users.map(toSystemUser),
    meta: result.meta,
    summary: {
      total: systemUsers.length,
      active: systemUsers.filter((user) => user.status === "ACTIVE").length,
      pending: systemUsers.filter((user) => user.status === "PENDING").length,
      blocked: systemUsers.filter((user) => user.status === "BLOCKED").length,
    },
  };
};

const requireSystemUserTarget = async (identifier) => {
  const payload = await buildUsersPayload(getConfiguredAdminUsers());
  const target = payload.users.find(
    (user) =>
      (user.id === identifier ||
        user.login === String(identifier || "").toLowerCase()) &&
      user.userScope === "SYSTEM" &&
      user.platformScope === true
  );

  if (!target) {
    throw buildHttpError(
      404,
      "Usuário System não encontrado.",
      "system_user_not_found"
    );
  }

  return target;
};

const createTemporaryPassword = () =>
  `${crypto.randomBytes(12).toString("base64url")}A1!`;

const validateSystemUserPayload = (payload) => {
  const role = normalizeRole(payload.role || payload.userType);

  if (
    payload.tenantId ||
    payload.restaurantId ||
    payload.restaurantKey ||
    payload.membership
  ) {
    throw buildHttpError(
      422,
      "Usuários System não recebem restaurante ou tenant.",
      "system_user_tenant_forbidden"
    );
  }

  if (!SYSTEM_ROLE_DEFINITIONS[role]) {
    throw buildHttpError(422, "Perfil System inválido.", "system_role_invalid", {
      field: "role",
    });
  }

  return role;
};

const saveSystemUser = async ({ req, session, identifier = "" }) => {
  const payload = parseJsonBody(req.body, { strict: true });
  const role = validateSystemUserPayload(payload);
  const existingTarget = identifier
    ? await requireSystemUserTarget(identifier)
    : null;
  if (
    existingTarget &&
    payload.status &&
    normalizeStatus(payload.status) !== existingTarget.status
  ) {
    throw buildHttpError(
      422,
      "Altere o status pelas ações de ciclo de vida auditadas.",
      "user_status_action_required",
      { field: "status" }
    );
  }
  const credentialMode = String(
    payload.credentialMode || "INVITE"
  ).toUpperCase();
  const generatedPassword =
    credentialMode === "TEMPORARY_PASSWORD" && !payload.password
      ? createTemporaryPassword()
      : "";
  const result = await saveAdminUser(
    {
      user: {
        id: identifier || payload.id,
        name: payload.name,
        email: payload.email,
        login: payload.email,
        phone: payload.phone,
        jobTitle: payload.jobTitle,
        department: payload.department,
        internalNote: payload.internalNote,
        userType: role,
        userScope: "SYSTEM",
        platformScope: true,
        credentialMode,
        password: generatedPassword || payload.password,
        mustChangePassword: credentialMode === "TEMPORARY_PASSWORD",
        status: existingTarget?.status || undefined,
        creationExperienceVersion: 2,
      },
      creationExperienceVersion: 2,
    },
    buildActor(session),
    getConfiguredAdminUsers()
  );
  const domainUser = await syncLegacyDomainUser(result.user);
  const metadata = getRequestMetadata(req);
  await appendAuditEvent({
    actorIdentityId: session.identityId,
    actorType: "SYSTEM",
    targetIdentityId: domainUser.identity.id,
    eventType: identifier ? "SYSTEM_USER_UPDATED" : "SYSTEM_USER_CREATED",
    result: "SUCCESS",
    requestId: metadata.requestId,
    after: {
      id: result.user.id,
      email: result.user.email,
      role,
      status: result.user.status,
      credentialMode,
    },
  });
  const invitationUrl = result.invitationToken && canExposeInvitationLink()
    ? `${getRequestOrigin(req)}/admin/convite.html?token=${encodeURIComponent(
        result.invitationToken
      )}`
    : "";

  return {
    user: toSystemUser(result.user),
    access:
      generatedPassword || invitationUrl
        ? {
            oneTimeDisplay: true,
            temporaryPassword: generatedPassword || undefined,
            invitationUrl: invitationUrl || undefined,
          }
        : null,
  };
};

const handleSystemApi = async (req, res) => {
  const metadata = getRequestMetadata(req);

  try {
    const session = await requireSystemSession(req);
    enterDatabaseScope({
      audience: "system",
      identityId: session.identityId,
      sessionId: session.sessionId,
    });
    const segments = getDomainActionSegments(req, "system");
    const resource = segments[0] || "dashboard";
    const identifier = segments[1] || "";
    const action = segments[2] || "";

    if (resource === "permissions") {
      assertMethod(req, "GET");
      return sendDomainSuccess(
        res,
        serializeAccessPolicy("SYSTEM"),
        { requestId: metadata.requestId }
      );
    }

    if (["dashboard", "health", "overview"].includes(resource)) {
      assertMethod(req, "GET");
      assertPermission(
        session,
        resource === "dashboard"
          ? "system.dashboard.view"
          : "system.health.view"
      );
      const health = await getPlatformHealthSnapshot({ persist: true });
      return sendDomainSuccess(
        res,
        {
          health,
          session: {
            identityId: session.identityId,
            displayName: session.displayName,
            role: session.role,
            tenantId: null,
            restaurantId: null,
          },
        },
        { requestId: metadata.requestId }
      );
    }

    if (resource === "restaurants") {
      assertMethod(req, "GET");
      assertPermission(session, "system.restaurants.view");
      const snapshot = await getMasterPlatformSnapshot({
        metrics: {},
        usersPayload: { users: [] },
      });
      const restaurants = snapshot.restaurants.map((restaurant) => ({
        restaurantKey: restaurant.restaurantKey,
        tenantId: restaurant.tenantId,
        restaurantId: restaurant.restaurantId,
        name: restaurant.name,
        slug: restaurant.slug,
        publicUrl: restaurant.publicUrl,
        status: restaurant.status,
        plan: restaurant.plan,
        domain: restaurant.domain,
        updatedAt: restaurant.updatedAt,
      }));
      return sendDomainSuccess(
        res,
        {
          restaurants,
        },
        { requestId: metadata.requestId }
      );
    }

    if (resource === "users") {
      if (req.method === "GET" && !identifier) {
        assertPermission(session, "system.users.view");
        const result = await getSystemUsers(req.query || {});
        return sendDomainSuccess(res, { users: result.users, summary: result.summary }, {
          meta: result.meta,
          requestId: metadata.requestId,
        });
      }

      if (req.method === "GET" && identifier) {
        assertPermission(session, "system.users.view");
        const target = await requireSystemUserTarget(identifier);
        return sendDomainSuccess(
          res,
          { user: toSystemUser(target) },
          { requestId: metadata.requestId }
        );
      }

      assertPermission(session, "system.users.manage");

      if (req.method === "POST" && !identifier) {
        const result = await saveSystemUser({ req, session });
        return sendDomainSuccess(res, result, {
          statusCode: 201,
          requestId: metadata.requestId,
        });
      }

      if (["PATCH", "PUT"].includes(req.method) && identifier) {
        const result = await saveSystemUser({ req, session, identifier });
        return sendDomainSuccess(res, result, {
          requestId: metadata.requestId,
        });
      }

      if (
        req.method === "POST" &&
        identifier &&
        action === "sessions" &&
        segments[3] === "revoke"
      ) {
        const target = await requireSystemUserTarget(identifier);
        const payload = parseJsonBody(req.body, { strict: true });
        const reason = String(payload.reason || "").trim();
        if (!reason) {
          throw buildHttpError(
            422,
            "Informe o motivo para encerrar as sessões.",
            "session_revoke_reason_required",
            { field: "reason" }
          );
        }
        const domainUser = await syncLegacyDomainUser(target);
        const revokedSessions = await revokeIdentitySessions({
          identityId: domainUser.identity.id,
          audience: "system",
          revokedBy: session.identityId,
        });
        await appendAuditEvent({
          actorIdentityId: session.identityId,
          actorType: "SYSTEM",
          targetIdentityId: domainUser.identity.id,
          eventType: "SYSTEM_USER_SESSIONS_REVOKED",
          result: "SUCCESS",
          reason,
          requestId: metadata.requestId,
          after: {
            id: target.id,
            revokedSessions,
          },
        });
        return sendDomainSuccess(
          res,
          { revokedSessions },
          { requestId: metadata.requestId }
        );
      }

      if (
        req.method === "POST" &&
        identifier &&
        ["block", "unblock", "deactivate", "activate"].includes(action)
      ) {
        const target = await requireSystemUserTarget(identifier);
        const payload = parseJsonBody(req.body, { strict: true });
        const reason = String(payload.reason || "").trim();
        if (["block", "deactivate"].includes(action) && !reason) {
          throw buildHttpError(
            422,
            "Informe o motivo desta alteração de acesso.",
            "user_status_reason_required",
            { field: "reason" }
          );
        }
        if (
          ["unblock", "activate"].includes(action) &&
          target.credentialMode === "INVITE" &&
          target.invitation?.state === "EXPIRED"
        ) {
          throw buildHttpError(
            409,
            "Reenvie o convite expirado antes de ativar este usuário.",
            "expired_invitation_cannot_activate"
          );
        }
        const nextStatus =
          action === "block"
            ? "BLOCKED"
            : action === "deactivate"
              ? "INACTIVE"
              : target.credentialMode === "INVITE" &&
                  target.invitation?.state !== "USED"
                ? "PENDING"
                : "ACTIVE";
        const result = await setAdminUserStatus(
          { id: identifier, status: nextStatus, reason },
          buildActor(session),
          getConfiguredAdminUsers()
        );
        const domainUser = await syncLegacyDomainUser(result.user);
        const shouldRevokeSessions =
          ["block", "deactivate"].includes(action) &&
          payload.revokeSessions !== false;
        const revokedSessions = shouldRevokeSessions
          ? await revokeIdentitySessions({
              identityId: domainUser.identity.id,
              audience: "system",
              revokedBy: session.identityId,
            })
          : 0;
        await appendAuditEvent({
          actorIdentityId: session.identityId,
          actorType: "SYSTEM",
          targetIdentityId: domainUser.identity.id,
          eventType:
            nextStatus === "BLOCKED"
              ? "SYSTEM_USER_BLOCKED"
              : nextStatus === "INACTIVE"
                ? "SYSTEM_USER_DEACTIVATED"
                : nextStatus === "PENDING"
                  ? "SYSTEM_USER_INVITE_RESTORED"
                  : "SYSTEM_USER_ACTIVATED",
          result: "SUCCESS",
          reason,
          requestId: metadata.requestId,
          before: {
            id: target.id,
            status: target.status,
          },
          after: {
            id: result.user.id,
            status: result.user.status,
            revokedSessions,
          },
        });
        return sendDomainSuccess(res, { user: toSystemUser(result.user) }, {
          requestId: metadata.requestId,
        });
      }

      if (
        req.method === "POST" &&
        identifier &&
        action === "invite" &&
        segments[3] === "resend"
      ) {
        const result = await resendAdminUserInvitation(
          { id: identifier },
          buildActor(session),
          getConfiguredAdminUsers()
        );
        const domainUser = await syncLegacyDomainUser(result.user);
        await appendAuditEvent({
          actorIdentityId: session.identityId,
          actorType: "SYSTEM",
          targetIdentityId: domainUser.identity.id,
          eventType: "SYSTEM_USER_INVITATION_REISSUED",
          result: "SUCCESS",
          requestId: metadata.requestId,
          after: {
            id: result.user.id,
            invitationExpiresAt: result.user.invitation?.expiresAt || "",
          },
        });
        return sendDomainSuccess(
          res,
          {
            user: toSystemUser(result.user),
            invitation: {
              oneTimeDisplay: canExposeInvitationLink(),
              url: canExposeInvitationLink()
                ? `${getRequestOrigin(
                    req
                  )}/admin/convite.html?token=${encodeURIComponent(
                    result.invitationToken
                  )}`
                : undefined,
            },
          },
          { requestId: metadata.requestId }
        );
      }
    }

    throw buildHttpError(404, "Recurso System não encontrado.", "system_resource_not_found");
  } catch (error) {
    return sendDomainError(res, error, metadata.requestId);
  }
};

module.exports = handleSystemApi;
