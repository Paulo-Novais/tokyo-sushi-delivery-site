const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { neon } = require("./tenant-sql.cjs");
const { buildHttpError } = require("./http.cjs");

const LOCAL_STORAGE_FILE = path.join(
  process.cwd(),
  ".data",
  "identity-domain.json"
);
const LOCAL_STORE_VERSION = 1;
let sqlClient = null;

const cloneJson = (value) => JSON.parse(JSON.stringify(value));
const nowIso = () => new Date().toISOString();
const createId = (prefix) => `${prefix}_${crypto.randomUUID()}`;
const hashValue = (value) =>
  crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeText = (value, maxLength = 320) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const buildIdentityId = (email) =>
  `identity_${hashValue(normalizeEmail(email)).slice(0, 24)}`;

const getStorageMode = () => {
  if (String(process.env.DATABASE_URL || "").trim()) {
    return "neon";
  }
  return process.env.NODE_ENV === "production" ? "disabled" : "file";
};

const getSql = () => {
  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }
  return sqlClient;
};

const getEmptyLocalState = () => ({
  version: LOCAL_STORE_VERSION,
  identities: [],
  systemPrincipals: [],
  restaurantMemberships: [],
  sessions: [],
  supportSessions: [],
  auditEvents: [],
});

const readLocalState = async () => {
  try {
    const parsed = JSON.parse(await fs.readFile(LOCAL_STORAGE_FILE, "utf8"));
    return {
      ...getEmptyLocalState(),
      ...(parsed && typeof parsed === "object" ? parsed : {}),
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return getEmptyLocalState();
    }
    throw error;
  }
};

const writeLocalState = async (state) => {
  await fs.mkdir(path.dirname(LOCAL_STORAGE_FILE), { recursive: true });
  const temporaryPath = `${LOCAL_STORAGE_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(
    temporaryPath,
    `${JSON.stringify({ ...state, version: LOCAL_STORE_VERSION }, null, 2)}\n`,
    {
      encoding: "utf8",
      mode: 0o600,
    }
  );
  await fs.rename(temporaryPath, LOCAL_STORAGE_FILE);
};

const upsertById = (records, record) => {
  const index = records.findIndex((entry) => entry.id === record.id);
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = { ...records[index], ...record };
  }
};

const normalizeLegacyDomainUser = (user = {}) => {
  const email = normalizeEmail(user.email || user.login);
  const userScope = String(user.userScope || "").trim().toUpperCase();
  const identityId = buildIdentityId(email);
  const updatedAt = normalizeText(user.updatedAt, 80) || nowIso();
  const createdAt = normalizeText(user.createdAt, 80) || updatedAt;
  const status = String(user.status || "ACTIVE").trim().toUpperCase();
  const role = String(
    user.baseRole || user.base_role || user.userType || user.tipo_usuario || "CUSTOM"
  )
    .trim()
    .toUpperCase();
  const isSystem = userScope === "SYSTEM" || user.platformScope === true;

  return {
    identity: {
      id: identityId,
      email,
      login: normalizeEmail(user.login || email),
      displayName: normalizeText(user.name || user.nome || user.displayName, 160),
      credentialStatus: status,
      createdAt,
      updatedAt,
    },
    principal: isSystem
      ? {
          id: `system_principal_${hashValue(identityId).slice(0, 24)}`,
          identityId,
          systemRole: role,
          status,
          createdBy: normalizeEmail(user.createdBy),
          createdAt,
          updatedAt,
        }
      : null,
    membership: isSystem
      ? null
      : {
          id: `membership_${hashValue(
            `${identityId}:${user.tenantId}:${user.restaurantId}`
          ).slice(0, 24)}`,
          identityId,
          tenantId: normalizeText(user.tenantId, 160),
          restaurantId: normalizeText(user.restaurantId, 160),
          restaurantKey: normalizeText(user.restaurantKey, 120),
          restaurantRole: role,
          status,
          invitedBy: normalizeEmail(user.createdBy),
          createdAt,
          updatedAt,
        },
  };
};

const syncLegacyDomainUser = async (user = {}) => {
  const normalized = normalizeLegacyDomainUser(user);

  if (!normalized.identity.email) {
    throw buildHttpError(422, "E-mail da identidade é obrigatório.", "identity_email_required");
  }

  const mode = getStorageMode();

  if (mode === "disabled") {
    throw buildHttpError(
      503,
      "Armazenamento de identidades indisponível.",
      "identity_storage_unavailable"
    );
  }

  if (mode === "file") {
    const state = await readLocalState();
    upsertById(state.identities, normalized.identity);
    if (normalized.principal) {
      upsertById(state.systemPrincipals, normalized.principal);
    }
    if (normalized.membership) {
      upsertById(state.restaurantMemberships, normalized.membership);
    }
    await writeLocalState(state);
    return cloneJson(normalized);
  }

  const sql = getSql();
  const identity = normalized.identity;
  if (normalized.membership) {
    const visibleIdentity = await sql`
      SELECT id
      FROM identities
      WHERE id = ${identity.id}
      LIMIT 1
    `;

    if (!visibleIdentity.length) {
      await sql`
        INSERT INTO identities (
          id,
          email,
          login,
          display_name,
          credential_status,
          created_at,
          updated_at
        )
        VALUES (
          ${identity.id},
          ${identity.email},
          ${identity.login},
          ${identity.displayName},
          ${identity.credentialStatus},
          ${identity.createdAt},
          ${identity.updatedAt}
        )
      `;
    }
  } else {
    await sql`
      INSERT INTO identities (
        id,
        email,
        login,
        display_name,
        credential_status,
        created_at,
        updated_at
      )
      VALUES (
        ${identity.id},
        ${identity.email},
        ${identity.login},
        ${identity.displayName},
        ${identity.credentialStatus},
        ${identity.createdAt},
        ${identity.updatedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        login = EXCLUDED.login,
        display_name = EXCLUDED.display_name,
        credential_status = EXCLUDED.credential_status,
        updated_at = EXCLUDED.updated_at
    `;
  }

  if (normalized.principal) {
    const principal = normalized.principal;
    await sql`
      INSERT INTO system_principals (
        id,
        identity_id,
        system_role,
        status,
        created_by,
        created_at,
        updated_at
      )
      VALUES (
        ${principal.id},
        ${principal.identityId},
        ${principal.systemRole},
        ${principal.status},
        ${principal.createdBy},
        ${principal.createdAt},
        ${principal.updatedAt}
      )
      ON CONFLICT (identity_id) DO UPDATE SET
        system_role = EXCLUDED.system_role,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
    `;
  }

  if (normalized.membership) {
    const membership = normalized.membership;
    await sql`
      INSERT INTO restaurant_memberships (
        id,
        identity_id,
        tenant_id,
        restaurant_id,
        restaurant_key,
        restaurant_role,
        status,
        invited_by,
        created_at,
        updated_at
      )
      VALUES (
        ${membership.id},
        ${membership.identityId},
        ${membership.tenantId},
        ${membership.restaurantId},
        ${membership.restaurantKey},
        ${membership.restaurantRole},
        ${membership.status},
        ${membership.invitedBy},
        ${membership.createdAt},
        ${membership.updatedAt}
      )
      ON CONFLICT (identity_id, tenant_id, restaurant_id) DO UPDATE SET
        restaurant_key = EXCLUDED.restaurant_key,
        restaurant_role = EXCLUDED.restaurant_role,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
    `;

    await sql`
      UPDATE identities
      SET
        email = ${identity.email},
        login = ${identity.login},
        display_name = ${identity.displayName},
        credential_status = ${identity.credentialStatus},
        updated_at = ${identity.updatedAt}
      WHERE id = ${identity.id}
    `;
  }

  return cloneJson(normalized);
};

const syncLegacyDomainUsers = async (users = []) => {
  const results = [];
  for (const user of Array.isArray(users) ? users : []) {
    results.push(await syncLegacyDomainUser(user));
  }
  return results;
};

const createPersistentSession = async ({
  id = createId("session"),
  identityId,
  audience,
  jti,
  principalId = "",
  membershipId = "",
  tenantId = "",
  restaurantId = "",
  issuedAt = nowIso(),
  expiresAt,
  ipAddress = "",
  userAgent = "",
  metadata = {},
}) => {
  if (!identityId || !audience || !jti || !expiresAt) {
    throw buildHttpError(422, "Sessão incompleta.", "invalid_session_record");
  }

  const record = {
    id,
    identityId,
    audience: String(audience).toLowerCase(),
    jtiHash: hashValue(jti),
    principalId,
    membershipId,
    tenantId,
    restaurantId,
    status: "ACTIVE",
    issuedAt,
    expiresAt,
    revokedAt: "",
    revokedBy: "",
    ipAddress: normalizeText(ipAddress, 160),
    userAgent: normalizeText(userAgent, 500),
    metadata: cloneJson(metadata || {}),
  };

  if (getStorageMode() === "file") {
    const state = await readLocalState();
    state.sessions.push(record);
    await writeLocalState(state);
    return cloneJson(record);
  }

  if (getStorageMode() === "disabled") {
    throw buildHttpError(503, "Sessões indisponíveis.", "session_storage_unavailable");
  }

  const sql = getSql();
  await sql`
    INSERT INTO auth_sessions (
      id,
      identity_id,
      audience,
      jti_hash,
      principal_id,
      membership_id,
      tenant_id,
      restaurant_id,
      status,
      issued_at,
      expires_at,
      ip_address,
      user_agent,
      metadata_json
    )
    VALUES (
      ${record.id},
      ${record.identityId},
      ${record.audience},
      ${record.jtiHash},
      ${record.principalId || null},
      ${record.membershipId || null},
      ${record.tenantId || null},
      ${record.restaurantId || null},
      ${record.status},
      ${record.issuedAt},
      ${record.expiresAt},
      ${record.ipAddress},
      ${record.userAgent},
      ${JSON.stringify(record.metadata)}::jsonb
    )
  `;
  return record;
};

const getActivePersistentSession = async ({ id, audience, jti }) => {
  if (!id || !audience || !jti) {
    return null;
  }
  const jtiHash = hashValue(jti);
  const now = Date.now();

  if (getStorageMode() === "file") {
    const state = await readLocalState();
    const record = state.sessions.find(
      (entry) =>
        entry.id === id &&
        entry.audience === audience &&
        entry.jtiHash === jtiHash &&
        entry.status === "ACTIVE" &&
        !entry.revokedAt &&
        new Date(entry.expiresAt).getTime() > now
    );
    return record ? cloneJson(record) : null;
  }

  if (getStorageMode() === "disabled") {
    return null;
  }

  const sql = getSql();
  const rows = await sql`
    SELECT
      id,
      identity_id,
      audience,
      principal_id,
      membership_id,
      tenant_id,
      restaurant_id,
      status,
      issued_at,
      expires_at,
      revoked_at,
      metadata_json
    FROM auth_sessions
    WHERE id = ${id}
      AND audience = ${audience}
      AND jti_hash = ${jtiHash}
      AND status = 'ACTIVE'
      AND revoked_at IS NULL
      AND expires_at > NOW()
    LIMIT 1
  `;
  const row = rows[0];
  return row
    ? {
        id: row.id,
        identityId: row.identity_id,
        audience: row.audience,
        principalId: row.principal_id || "",
        membershipId: row.membership_id || "",
        tenantId: row.tenant_id || "",
        restaurantId: row.restaurant_id || "",
        status: row.status,
        issuedAt: row.issued_at,
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at || "",
        metadata: row.metadata_json || {},
      }
    : null;
};

const revokePersistentSession = async ({ id, revokedBy = "" }) => {
  const revokedAt = nowIso();

  if (getStorageMode() === "file") {
    const state = await readLocalState();
    const session = state.sessions.find((entry) => entry.id === id);
    if (session) {
      session.status = "REVOKED";
      session.revokedAt = revokedAt;
      session.revokedBy = normalizeText(revokedBy, 160);
      await writeLocalState(state);
    }
    return Boolean(session);
  }

  if (getStorageMode() === "disabled") {
    return false;
  }

  const sql = getSql();
  const rows = await sql`
    UPDATE auth_sessions
    SET
      status = 'REVOKED',
      revoked_at = ${revokedAt},
      revoked_by = ${normalizeText(revokedBy, 160)}
    WHERE id = ${id}
      AND revoked_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
};

const revokeIdentitySessions = async ({
  identityId,
  audience = "",
  tenantId = "",
  restaurantId = "",
  revokedBy = "",
}) => {
  const normalizedIdentityId = normalizeText(identityId, 160);
  const normalizedAudience = String(audience || "").trim().toLowerCase();
  const normalizedTenantId = normalizeText(tenantId, 160);
  const normalizedRestaurantId = normalizeText(restaurantId, 160);
  const revokedAt = nowIso();

  if (!normalizedIdentityId) {
    throw buildHttpError(
      422,
      "Identidade da sessão é obrigatória.",
      "session_identity_required"
    );
  }

  if (getStorageMode() === "file") {
    const state = await readLocalState();
    let revokedCount = 0;
    state.sessions = state.sessions.map((session) => {
      const matches =
        session.identityId === normalizedIdentityId &&
        (!normalizedAudience || session.audience === normalizedAudience) &&
        (!normalizedTenantId || session.tenantId === normalizedTenantId) &&
        (!normalizedRestaurantId ||
          session.restaurantId === normalizedRestaurantId) &&
        session.status === "ACTIVE" &&
        !session.revokedAt;

      if (!matches) {
        return session;
      }

      revokedCount += 1;
      return {
        ...session,
        status: "REVOKED",
        revokedAt,
        revokedBy: normalizeText(revokedBy, 160),
      };
    });
    await writeLocalState(state);
    return revokedCount;
  }

  if (getStorageMode() === "disabled") {
    return 0;
  }

  const sql = getSql();
  const rows = await sql`
    UPDATE auth_sessions
    SET
      status = 'REVOKED',
      revoked_at = ${revokedAt},
      revoked_by = ${normalizeText(revokedBy, 160)}
    WHERE identity_id = ${normalizedIdentityId}
      AND (${normalizedAudience} = '' OR audience = ${normalizedAudience})
      AND (${normalizedTenantId} = '' OR tenant_id = ${normalizedTenantId})
      AND (
        ${normalizedRestaurantId} = ''
        OR restaurant_id = ${normalizedRestaurantId}
      )
      AND status = 'ACTIVE'
      AND revoked_at IS NULL
    RETURNING id
  `;
  return rows.length;
};

const createSupportSession = async ({
  systemIdentityId,
  systemSessionId,
  tenantId,
  restaurantId,
  restaurantKey,
  restaurantName,
  mode,
  reason,
  confirmed,
  ipAddress = "",
  userAgent = "",
  requestId = "",
}) => {
  const normalizedMode = String(mode || "").trim().toUpperCase();
  const normalizedReason = normalizeText(reason, 500);

  if (!["VIEW", "ADMIN"].includes(normalizedMode)) {
    throw buildHttpError(422, "Modo de suporte inválido.", "support_mode_invalid");
  }
  if (normalizedReason.length < 10) {
    throw buildHttpError(
      422,
      "Informe uma justificativa com pelo menos 10 caracteres.",
      "support_reason_required"
    );
  }
  if (confirmed !== true) {
    throw buildHttpError(
      422,
      "A confirmação explícita é obrigatória.",
      "support_confirmation_required"
    );
  }
  if (!systemIdentityId || !systemSessionId || !tenantId || !restaurantId) {
    throw buildHttpError(422, "Escopo de suporte incompleto.", "support_scope_invalid");
  }

  const createdAt = nowIso();
  const ttlMinutes = normalizedMode === "ADMIN" ? 15 : 30;
  const expiresAt = new Date(
    Date.now() + ttlMinutes * 60 * 1000
  ).toISOString();
  const record = {
    id: createId("support"),
    systemIdentityId,
    systemSessionId,
    tenantId,
    restaurantId,
    restaurantKey: normalizeText(restaurantKey, 120),
    restaurantName: normalizeText(restaurantName, 160),
    mode: normalizedMode,
    reason: normalizedReason,
    createdAt,
    expiresAt,
    revokedAt: "",
    revokedBy: "",
    confirmationAt: createdAt,
    ipAddress: normalizeText(ipAddress, 160),
    userAgent: normalizeText(userAgent, 500),
    requestId: normalizeText(requestId, 160),
    status: "ACTIVE",
  };

  if (getStorageMode() === "file") {
    const state = await readLocalState();
    state.supportSessions.push(record);
    await writeLocalState(state);
    return cloneJson(record);
  }

  if (getStorageMode() === "disabled") {
    throw buildHttpError(503, "Suporte indisponível.", "support_storage_unavailable");
  }

  const sql = getSql();
  await sql`
    INSERT INTO system_support_sessions (
      id,
      system_identity_id,
      system_session_id,
      tenant_id,
      restaurant_id,
      restaurant_key,
      restaurant_name,
      mode,
      reason,
      created_at,
      expires_at,
      confirmation_at,
      ip_address,
      user_agent,
      request_id,
      status
    )
    VALUES (
      ${record.id},
      ${record.systemIdentityId},
      ${record.systemSessionId},
      ${record.tenantId},
      ${record.restaurantId},
      ${record.restaurantKey},
      ${record.restaurantName},
      ${record.mode},
      ${record.reason},
      ${record.createdAt},
      ${record.expiresAt},
      ${record.confirmationAt},
      ${record.ipAddress},
      ${record.userAgent},
      ${record.requestId},
      ${record.status}
    )
  `;
  return record;
};

const getActiveSupportSession = async ({ id, systemIdentityId }) => {
  if (!id || !systemIdentityId) {
    return null;
  }
  const now = Date.now();

  if (getStorageMode() === "file") {
    const state = await readLocalState();
    const record = state.supportSessions.find(
      (entry) =>
        entry.id === id &&
        entry.systemIdentityId === systemIdentityId &&
        entry.status === "ACTIVE" &&
        !entry.revokedAt &&
        new Date(entry.expiresAt).getTime() > now
    );
    return record ? cloneJson(record) : null;
  }

  if (getStorageMode() === "disabled") {
    return null;
  }

  const sql = getSql();
  const rows = await sql`
    SELECT
      id,
      system_identity_id,
      system_session_id,
      tenant_id,
      restaurant_id,
      restaurant_key,
      restaurant_name,
      mode,
      reason,
      created_at,
      expires_at,
      revoked_at,
      revoked_by,
      confirmation_at,
      request_id,
      status
    FROM system_support_sessions
    WHERE id = ${id}
      AND system_identity_id = ${systemIdentityId}
      AND status = 'ACTIVE'
      AND revoked_at IS NULL
      AND expires_at > NOW()
    LIMIT 1
  `;
  const row = rows[0];
  return row
    ? {
        id: row.id,
        systemIdentityId: row.system_identity_id,
        systemSessionId: row.system_session_id,
        tenantId: row.tenant_id,
        restaurantId: row.restaurant_id,
        restaurantKey: row.restaurant_key,
        restaurantName: row.restaurant_name,
        mode: row.mode,
        reason: row.reason,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at || "",
        revokedBy: row.revoked_by || "",
        confirmationAt: row.confirmation_at,
        requestId: row.request_id,
        status: row.status,
      }
    : null;
};

const revokeSupportSession = async ({
  id,
  systemIdentityId,
  revokedBy = "",
}) => {
  const revokedAt = nowIso();

  if (getStorageMode() === "file") {
    const state = await readLocalState();
    const record = state.supportSessions.find(
      (entry) =>
        entry.id === id && entry.systemIdentityId === systemIdentityId
    );
    if (record && !record.revokedAt) {
      record.status = "REVOKED";
      record.revokedAt = revokedAt;
      record.revokedBy = normalizeText(revokedBy, 160);
      await writeLocalState(state);
    }
    return record ? cloneJson(record) : null;
  }

  if (getStorageMode() === "disabled") {
    return null;
  }

  const sql = getSql();
  const rows = await sql`
    UPDATE system_support_sessions
    SET
      status = 'REVOKED',
      revoked_at = ${revokedAt},
      revoked_by = ${normalizeText(revokedBy, 160)}
    WHERE id = ${id}
      AND system_identity_id = ${systemIdentityId}
      AND revoked_at IS NULL
    RETURNING id
  `;
  return rows[0] || null;
};

const appendAuditEvent = async ({
  actorIdentityId = "",
  actorType,
  targetIdentityId = "",
  tenantId = "",
  restaurantId = "",
  eventType,
  result = "SUCCESS",
  reason = "",
  before = null,
  after = null,
  requestId = "",
  supportSessionId = "",
  metadata = {},
}) => {
  const record = {
    id: createId("audit"),
    actorIdentityId,
    actorType: normalizeText(actorType, 80),
    targetIdentityId,
    tenantId,
    restaurantId,
    eventType: normalizeText(eventType, 120).toUpperCase(),
    result: normalizeText(result, 40).toUpperCase(),
    reason: normalizeText(reason, 500),
    before: before ? cloneJson(before) : null,
    after: after ? cloneJson(after) : null,
    requestId: normalizeText(requestId, 160),
    supportSessionId,
    metadata: cloneJson(metadata || {}),
    createdAt: nowIso(),
  };

  if (getStorageMode() === "file") {
    const state = await readLocalState();
    state.auditEvents.push(record);
    state.auditEvents = state.auditEvents.slice(-5000);
    await writeLocalState(state);
    return cloneJson(record);
  }

  if (getStorageMode() === "disabled") {
    return null;
  }

  const sql = getSql();
  await sql`
    INSERT INTO user_audit_events (
      id,
      actor_identity_id,
      actor_type,
      target_identity_id,
      tenant_id,
      restaurant_id,
      event_type,
      result,
      reason,
      before_json,
      after_json,
      request_id,
      support_session_id,
      metadata_json,
      created_at
    )
    VALUES (
      ${record.id},
      ${record.actorIdentityId || null},
      ${record.actorType},
      ${record.targetIdentityId || null},
      ${record.tenantId || null},
      ${record.restaurantId || null},
      ${record.eventType},
      ${record.result},
      ${record.reason},
      ${JSON.stringify(record.before)}::jsonb,
      ${JSON.stringify(record.after)}::jsonb,
      ${record.requestId},
      ${record.supportSessionId || null},
      ${JSON.stringify(record.metadata)}::jsonb,
      ${record.createdAt}
    )
  `;
  return record;
};

module.exports = {
  appendAuditEvent,
  buildIdentityId,
  createPersistentSession,
  createSupportSession,
  getActivePersistentSession,
  getActiveSupportSession,
  getStorageMode,
  revokeIdentitySessions,
  revokePersistentSession,
  revokeSupportSession,
  syncLegacyDomainUser,
  syncLegacyDomainUsers,
};
