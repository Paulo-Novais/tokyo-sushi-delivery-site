const crypto = require("node:crypto");
const {
  LEGACY_RESTAURANT_PERMISSION_MAP,
  RESTAURANT_ROLE_DEFINITIONS,
  RESTAURANT_ROLE_LEGACY_MAP,
  assertPermission,
  assertPermissionDependencies,
  buildEffectivePermissionSet,
  serializeAccessPolicy,
} = require("./access-policy.cjs");
const {
  assertSupportActionAllowed,
  getRequestMetadata,
  requireRestaurantAccess,
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
const {
  buildUsersPayload,
  resendAdminUserInvitation,
  saveAdminUser,
  setAdminUserStatus,
} = require("./user-permissions.cjs");
const { getConfiguredAdminUsers } = require("./admin-auth.cjs");
const {
  getAdminRestaurantSettings,
  updateRestaurantSettings,
} = require("./restaurant-settings-store.cjs");
const { getAdminAuditLog } = require("./order-store.cjs");
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

const toModernRestaurantRole = (user) => {
  const persistedRole = normalizeRole(user.baseRole);
  if (RESTAURANT_ROLE_DEFINITIONS[persistedRole]) {
    return persistedRole;
  }
  const legacyRole = normalizeRole(user.userType);
  const aliases = {
    OWNER: "OWNER",
    GERENTE: "MANAGER",
    SUBGERENTE: "MANAGER",
    CAIXA: "CASHIER",
    GARCOM: "SERVICE",
    ATENDENTE: "SERVICE",
    COZINHA: "KITCHEN",
    BAR: "KITCHEN",
    ESTOQUE: "INVENTORY",
    FINANCEIRO: "FINANCE",
    ENTREGADOR: "DELIVERY",
    CUSTOM: "CUSTOM",
  };
  return aliases[legacyRole] || "CUSTOM";
};

const toTenantUser = (user) => {
  const role = toModernRestaurantRole(user);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    jobTitle: user.jobTitle,
    department: user.department,
    internalNote: user.internalNote,
    role,
    roleLabel: RESTAURANT_ROLE_DEFINITIONS[role]?.label || role,
    status: user.status,
    statusLabel: user.statusLabel,
    credentialMode: user.credentialMode,
    invitation: user.invitation,
    baseRole: role,
    grantOverrides: user.grantOverrides || [],
    denyOverrides: user.denyOverrides || [],
    profileVersion: user.profileVersion || "",
    effectivePermissions: buildEffectivePermissionSet({
      domain: "RESTAURANT",
      role,
      grantOverrides: user.grantOverrides || [],
      denyOverrides: user.denyOverrides || [],
    }),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastAccessAt: user.lastAccessAt,
    createdBy: user.createdBy,
    source: user.source,
    auditTrail: Array.isArray(user.auditTrail) ? user.auditTrail : [],
  };
};

const filterAndPaginate = (users, query) => {
  const search = String(query.search || "").trim().toLowerCase();
  const role = normalizeRole(query.role);
  const status = normalizeStatus(query.status);
  const sort = String(query.sort || "name").trim().toLowerCase();
  const direction = String(query.direction || "asc").trim().toLowerCase();
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(query.pageSize || 20)));
  const filtered = users.filter((user) => {
    const modernRole = toModernRestaurantRole(user);
    if (
      search &&
      !`${user.name} ${user.email}`.toLowerCase().includes(search)
    ) {
      return false;
    }
    if (role && modernRole !== role) {
      return false;
    }
    if (status && user.status !== status) {
      return false;
    }
    return true;
  });
  const value = (user) => {
    if (sort === "status") return user.status;
    if (sort === "role") return toModernRestaurantRole(user);
    if (sort === "updated") return user.updatedAt;
    return user.name;
  };
  filtered.sort((left, right) => {
    const comparison = String(value(left) || "").localeCompare(
      String(value(right) || ""),
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

const getTenantUsers = async (session, query = {}) => {
  const payload = await buildUsersPayload(getConfiguredAdminUsers());
  const tenantUsers = payload.users.filter(
    (user) =>
      user.userScope === "RESTAURANT" &&
      user.platformScope !== true &&
      user.tenantId === session.tenantId &&
      user.restaurantId === session.restaurantId &&
      user.restaurantKey === session.restaurantKey
  );
  const result = filterAndPaginate(tenantUsers, query);
  return {
    users: result.users.map(toTenantUser),
    meta: result.meta,
    summary: {
      total: tenantUsers.length,
      active: tenantUsers.filter((user) => user.status === "ACTIVE").length,
      pending: tenantUsers.filter((user) => user.status === "PENDING").length,
      blocked: tenantUsers.filter((user) => user.status === "BLOCKED").length,
      owners: tenantUsers.filter(
        (user) =>
          toModernRestaurantRole(user) === "OWNER" && user.status === "ACTIVE"
      ).length,
    },
  };
};

const requireTenantUserTarget = async (session, identifier) => {
  const payload = await buildUsersPayload(getConfiguredAdminUsers());
  const target = payload.users.find(
    (user) =>
      (user.id === identifier || user.login === String(identifier).toLowerCase()) &&
      user.userScope === "RESTAURANT" &&
      user.platformScope !== true &&
      user.tenantId === session.tenantId &&
      user.restaurantId === session.restaurantId &&
      user.restaurantKey === session.restaurantKey
  );

  if (!target) {
    throw buildHttpError(
      404,
      "Usuário não encontrado neste restaurante.",
      "tenant_user_not_found"
    );
  }

  return target;
};

const assertTenantInputAbsent = (payload) => {
  const forbiddenKeys = [
    "tenantId",
    "tenant_id",
    "restaurantId",
    "restaurant_id",
    "restaurantKey",
    "restaurant_key",
  ];
  const manipulatedKey = forbiddenKeys.find(
    (key) =>
      Object.prototype.hasOwnProperty.call(payload, key) &&
      payload[key] !== undefined &&
      payload[key] !== ""
  );

  if (manipulatedKey) {
    throw buildHttpError(
      422,
      "O tenant é definido exclusivamente pela sessão autenticada.",
      "tenant_input_forbidden",
      {
        field: manipulatedKey,
      }
    );
  }
};

const toLegacyPermissionObject = (permissions = []) => {
  const selected = new Set(permissions);
  return Object.entries(LEGACY_RESTAURANT_PERMISSION_MAP).reduce(
    (result, [legacyPermission, modernPermission]) => {
      result[legacyPermission] = selected.has(modernPermission);
      return result;
    },
    {}
  );
};

const createTemporaryPassword = () =>
  `${crypto.randomBytes(12).toString("base64url")}A1!`;

const buildActor = (session) => {
  if (session.audience === "support") {
    return {
      login: session.login,
      email: session.login,
      userType: "SUPORTE",
      tipo_usuario: "SUPORTE",
      userScope: "SYSTEM",
      platformScope: true,
      restaurantKey: session.restaurantKey,
      supportSessionId: session.supportSessionId,
    };
  }

  return {
    login: session.login,
    email: session.login,
    userType:
      RESTAURANT_ROLE_LEGACY_MAP[session.role] || session.role || "CUSTOM",
    tipo_usuario:
      RESTAURANT_ROLE_LEGACY_MAP[session.role] || session.role || "CUSTOM",
    userScope: "RESTAURANT",
    platformScope: false,
    tenantId: session.tenantId,
    restaurantId: session.restaurantId,
    restaurantKey: session.restaurantKey,
  };
};

const saveTenantUser = async ({ req, session, identifier = "" }) => {
  const payload = parseJsonBody(req.body, { strict: true });
  assertTenantInputAbsent(payload);
  const role = normalizeRole(payload.role || payload.baseRole);
  const existingTarget = identifier
    ? await requireTenantUserTarget(session, identifier)
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

  if (!RESTAURANT_ROLE_DEFINITIONS[role]) {
    throw buildHttpError(
      422,
      "Perfil do restaurante inválido.",
      "restaurant_role_invalid",
      { field: "role" }
    );
  }

  if (role === "OWNER" && session.role !== "OWNER") {
    throw buildHttpError(
      403,
      "Somente um Owner pode provisionar outro Owner por fluxo de transferência.",
      "owner_assignment_denied"
    );
  }

  const grants = Array.isArray(payload.grantOverrides)
    ? payload.grantOverrides
    : [];
  const denies = Array.isArray(payload.denyOverrides)
    ? payload.denyOverrides
    : [];
  const samePermissionList = (left, right) =>
    JSON.stringify([...(left || [])].sort()) ===
    JSON.stringify([...(right || [])].sort());
  if (
    existingTarget?.login === String(session.login || "").toLowerCase() &&
    (role !== toModernRestaurantRole(existingTarget) ||
      !samePermissionList(grants, existingTarget.grantOverrides) ||
      !samePermissionList(denies, existingTarget.denyOverrides))
  ) {
    throw buildHttpError(
      403,
      "O usuário conectado não pode alterar o próprio perfil ou permissões.",
      "self_permission_change_denied"
    );
  }
  const effectivePermissions = assertPermissionDependencies(
    "RESTAURANT",
    buildEffectivePermissionSet({
      domain: "RESTAURANT",
      role,
      grantOverrides: grants,
      denyOverrides: denies,
    })
  );

  if (session.audience !== "support") {
    const actorPermissions = new Set(session.effectivePermissions || []);
    const excessivePermission = effectivePermissions.find(
      (permission) => !actorPermissions.has(permission)
    );
    if (excessivePermission) {
      throw buildHttpError(
        403,
        "Não é permitido conceder permissões que o ator não possui.",
        "permission_escalation_denied",
        {
          details: {
            permission: excessivePermission,
          },
        }
      );
    }
  }

  const legacyRole = role === "OWNER" ? "OWNER" : "CUSTOM";
  const customLegacyPermissions =
    role === "OWNER"
      ? undefined
      : toLegacyPermissionObject(effectivePermissions);
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
        userType: legacyRole,
        userScope: "RESTAURANT",
        restaurantKey: session.restaurantKey,
        credentialMode,
        password: generatedPassword || payload.password,
        mustChangePassword: credentialMode === "TEMPORARY_PASSWORD",
        status: existingTarget?.status || undefined,
        permissions: customLegacyPermissions,
        baseRole: role,
        grantOverrides: grants,
        denyOverrides: denies,
        profileVersion: "2026.07.25",
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
    actorType: session.audience === "support" ? "SUPPORT" : "RESTAURANT",
    targetIdentityId: domainUser.identity.id,
    tenantId: session.tenantId,
    restaurantId: session.restaurantId,
    eventType: identifier ? "TENANT_USER_UPDATED" : "TENANT_USER_CREATED",
    result: "SUCCESS",
    requestId: metadata.requestId,
    supportSessionId: session.supportSessionId || "",
    after: {
      id: result.user.id,
      email: result.user.email,
      role,
      status: result.user.status,
      credentialMode,
      grantOverrides: grants,
      denyOverrides: denies,
    },
  });
  const invitationUrl = result.invitationToken && canExposeInvitationLink()
    ? `${getRequestOrigin(req)}/admin/convite.html?token=${encodeURIComponent(
        result.invitationToken
      )}`
    : "";

  return {
    user: toTenantUser(result.user),
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

const handleTenantApi = async (req, res) => {
  const metadata = getRequestMetadata(req);

  try {
    const session = await requireRestaurantAccess(req);
    const segments = getDomainActionSegments(req, "tenant");
    const resource = segments[0] || "session";
    const identifier = segments[1] || "";
    const action = segments[2] || "";

    if (resource === "session") {
      assertMethod(req, "GET");
      return sendDomainSuccess(
        res,
        {
          session: {
            audience: session.audience,
            identityId: session.identityId,
            displayName: session.displayName,
            role: session.role,
            tenantId: session.tenantId,
            restaurantId: session.restaurantId,
            restaurantKey: session.restaurantKey,
            effectivePermissions: session.effectivePermissions || [],
            support:
              session.audience === "support"
                ? {
                    id: session.supportSessionId,
                    mode: session.supportMode,
                    reason: session.reason,
                    restaurantName: session.restaurantName,
                    expiresAt: new Date(session.expiresAt).toISOString(),
                  }
                : null,
          },
        },
        { requestId: metadata.requestId }
      );
    }

    if (resource === "permissions") {
      assertMethod(req, "GET");
      return sendDomainSuccess(
        res,
        serializeAccessPolicy("RESTAURANT"),
        { requestId: metadata.requestId }
      );
    }

    if (resource === "health") {
      assertMethod(req, "GET");
      if (session.audience === "support") {
        assertSupportActionAllowed(session, "tenant.health.read");
      } else {
        assertPermission(session, "tenant.dashboard.view");
      }
      return sendDomainSuccess(
        res,
        {
          health: {
            status: "AVAILABLE",
            tenantId: session.tenantId,
            restaurantId: session.restaurantId,
            restaurantKey: session.restaurantKey,
            checkedAt: new Date().toISOString(),
          },
        },
        { requestId: metadata.requestId }
      );
    }

    if (resource === "settings") {
      if (req.method === "GET") {
        if (session.audience === "support") {
          assertSupportActionAllowed(session, "tenant.settings.read");
        } else {
          assertPermission(session, "tenant.settings.view");
        }
        const result = await getAdminRestaurantSettings({
          tenantContext: session,
        });
        return sendDomainSuccess(
          res,
          { settings: result.settings, summary: result.summary },
          { requestId: metadata.requestId }
        );
      }

      assertMethod(req, ["PATCH", "PUT"]);
      if (session.audience === "support") {
        assertSupportActionAllowed(session, "tenant.settings.update");
      } else {
        assertPermission(session, "tenant.settings.edit");
      }
      const payload = parseJsonBody(req.body, { strict: true });
      assertTenantInputAbsent(payload);
      const result = await updateRestaurantSettings(payload, buildActor(session), {
        tenantContext: session,
      });
      await appendAuditEvent({
        actorIdentityId: session.identityId,
        actorType: session.audience === "support" ? "SUPPORT" : "RESTAURANT",
        tenantId: session.tenantId,
        restaurantId: session.restaurantId,
        eventType: "TENANT_SETTINGS_UPDATED",
        result: "SUCCESS",
        requestId: metadata.requestId,
        supportSessionId: session.supportSessionId || "",
      });
      return sendDomainSuccess(
        res,
        { settings: result.settings, summary: result.summary },
        { requestId: metadata.requestId }
      );
    }

    if (resource === "integrations") {
      assertMethod(req, "GET");
      if (session.audience === "support") {
        assertSupportActionAllowed(session, "tenant.integrations.read");
      } else {
        assertPermission(session, "tenant.settings.view");
      }
      return sendDomainSuccess(
        res,
        {
          integrations: [],
          scope: {
            tenantId: session.tenantId,
            restaurantId: session.restaurantId,
          },
        },
        { requestId: metadata.requestId }
      );
    }

    if (resource === "audit") {
      assertMethod(req, "GET");
      if (session.audience === "support") {
        assertSupportActionAllowed(session, "tenant.audit.read");
      } else {
        assertPermission(session, "tenant.audit.view");
      }
      const result = await getAdminAuditLog(req.query || {}, {
        tenantContext: session,
      });
      return sendDomainSuccess(res, { audit: result }, {
        requestId: metadata.requestId,
      });
    }

    if (resource === "users") {
      if (req.method === "GET" && !identifier) {
        if (session.audience === "support") {
          assertSupportActionAllowed(session, "tenant.users.read");
        } else {
          assertPermission(session, "tenant.users.view");
        }
        const result = await getTenantUsers(session, req.query || {});
        return sendDomainSuccess(
          res,
          { users: result.users, summary: result.summary },
          { meta: result.meta, requestId: metadata.requestId }
        );
      }

      if (req.method === "GET" && identifier) {
        if (session.audience === "support") {
          assertSupportActionAllowed(session, "tenant.users.read");
        } else {
          assertPermission(session, "tenant.users.view");
        }
        const target = await requireTenantUserTarget(session, identifier);
        return sendDomainSuccess(
          res,
          { user: toTenantUser(target) },
          { requestId: metadata.requestId }
        );
      }

      if (session.audience === "support") {
        assertSupportActionAllowed(session, "tenant.users.update");
      } else {
        assertPermission(session, "tenant.users.manage");
      }

      if (req.method === "POST" && !identifier) {
        const result = await saveTenantUser({ req, session });
        return sendDomainSuccess(res, result, {
          statusCode: 201,
          requestId: metadata.requestId,
        });
      }

      if (["PATCH", "PUT"].includes(req.method) && identifier) {
        await requireTenantUserTarget(session, identifier);
        const result = await saveTenantUser({ req, session, identifier });
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
        const target = await requireTenantUserTarget(session, identifier);
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
          audience: "restaurant",
          tenantId: session.tenantId,
          restaurantId: session.restaurantId,
          revokedBy: session.identityId,
        });
        await appendAuditEvent({
          actorIdentityId: session.identityId,
          actorType:
            session.audience === "support" ? "SUPPORT" : "RESTAURANT",
          targetIdentityId: domainUser.identity.id,
          tenantId: session.tenantId,
          restaurantId: session.restaurantId,
          eventType: "TENANT_USER_SESSIONS_REVOKED",
          result: "SUCCESS",
          reason,
          requestId: metadata.requestId,
          supportSessionId: session.supportSessionId || "",
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
        const target = await requireTenantUserTarget(session, identifier);
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
        if (
          result.user.tenantId !== session.tenantId ||
          result.user.restaurantId !== session.restaurantId
        ) {
          throw buildHttpError(
            403,
            "Usuário fora do tenant autenticado.",
            "tenant_user_scope_denied"
          );
        }
        const domainUser = await syncLegacyDomainUser(result.user);
        const shouldRevokeSessions =
          ["block", "deactivate"].includes(action) &&
          payload.revokeSessions !== false;
        const revokedSessions = shouldRevokeSessions
          ? await revokeIdentitySessions({
              identityId: domainUser.identity.id,
              audience: "restaurant",
              tenantId: session.tenantId,
              restaurantId: session.restaurantId,
              revokedBy: session.identityId,
            })
          : 0;
        await appendAuditEvent({
          actorIdentityId: session.identityId,
          actorType: session.audience === "support" ? "SUPPORT" : "RESTAURANT",
          targetIdentityId: domainUser.identity.id,
          tenantId: session.tenantId,
          restaurantId: session.restaurantId,
          eventType:
            nextStatus === "BLOCKED"
              ? "TENANT_USER_BLOCKED"
              : nextStatus === "INACTIVE"
                ? "TENANT_USER_DEACTIVATED"
                : nextStatus === "PENDING"
                  ? "TENANT_USER_INVITE_RESTORED"
                  : "TENANT_USER_ACTIVATED",
          result: "SUCCESS",
          reason,
          requestId: metadata.requestId,
          supportSessionId: session.supportSessionId || "",
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
        return sendDomainSuccess(
          res,
          { user: toTenantUser(result.user) },
          { requestId: metadata.requestId }
        );
      }

      if (
        req.method === "POST" &&
        identifier &&
        action === "invite" &&
        segments[3] === "resend"
      ) {
        await requireTenantUserTarget(session, identifier);
        const result = await resendAdminUserInvitation(
          { id: identifier },
          buildActor(session),
          getConfiguredAdminUsers()
        );
        if (
          result.user.tenantId !== session.tenantId ||
          result.user.restaurantId !== session.restaurantId
        ) {
          throw buildHttpError(
            403,
            "Usuário fora do tenant autenticado.",
            "tenant_user_scope_denied"
          );
        }
        const domainUser = await syncLegacyDomainUser(result.user);
        await appendAuditEvent({
          actorIdentityId: session.identityId,
          actorType:
            session.audience === "support" ? "SUPPORT" : "RESTAURANT",
          targetIdentityId: domainUser.identity.id,
          tenantId: session.tenantId,
          restaurantId: session.restaurantId,
          eventType: "TENANT_USER_INVITATION_REISSUED",
          result: "SUCCESS",
          requestId: metadata.requestId,
          supportSessionId: session.supportSessionId || "",
          after: {
            id: result.user.id,
            invitationExpiresAt: result.user.invitation?.expiresAt || "",
          },
        });
        return sendDomainSuccess(
          res,
          {
            user: toTenantUser(result.user),
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

    throw buildHttpError(
      404,
      "Recurso Restaurant não encontrado.",
      "tenant_resource_not_found"
    );
  } catch (error) {
    if (Number(error?.statusCode || 500) >= 500) {
      console.error("[tenant-api]", {
        errorCode: error?.errorCode || "internal_error",
        message: error?.message || "Unexpected tenant API error.",
        method: req.method,
        requestId: metadata.requestId,
      });
    }
    return sendDomainError(res, error, metadata.requestId);
  }
};

module.exports = handleTenantApi;
