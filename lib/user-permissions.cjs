const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { neon } = require("@neondatabase/serverless");
const { buildHttpError } = require("./http.cjs");

const LOCAL_STORAGE_FILE = path.join(process.cwd(), ".data", "admin-users.json");
const LOCAL_STORE_VERSION = 2;
const RESTAURANT_KEY = "default";
const SCRYPT_KEY_LENGTH = 64;
const MAX_TEXT_LENGTH = 320;
const MIN_PASSWORD_LENGTH = 6;
const STRONG_PASSWORD_MIN_LENGTH = 10;
const DEFAULT_INVITATION_TTL_HOURS = 48;

const USER_TYPES = Object.freeze([
  "MASTER",
  "SOCIO",
  "DESENVOLVEDOR",
  "SUPORTE",
  "VENDEDOR",
  "OWNER",
  "GERENTE",
  "SUBGERENTE",
  "CAIXA",
  "COZINHA",
  "GARCOM",
  "BAR",
  "ESTOQUE",
  "FINANCEIRO",
  "MARKETING",
  "ENTREGADOR",
  "ATENDENTE",
  "CUSTOM",
]);
const USER_STATUSES = Object.freeze(["ACTIVE", "PENDING", "BLOCKED"]);
const USER_TYPE_LABELS = Object.freeze({
  MASTER: "Master INOVAS Food",
  SOCIO: "Sócio",
  DESENVOLVEDOR: "Desenvolvedor",
  SUPORTE: "Suporte",
  VENDEDOR: "Vendedor",
  OWNER: "Dono do Restaurante",
  GERENTE: "Gerente",
  SUBGERENTE: "Subgerente",
  CAIXA: "Caixa",
  COZINHA: "Cozinha",
  GARCOM: "Garçom",
  BAR: "Bar",
  ESTOQUE: "Estoque",
  FINANCEIRO: "Financeiro",
  MARKETING: "Marketing",
  ENTREGADOR: "Entregador",
  ATENDENTE: "Atendente",
  CUSTOM: "Personalizado",
});
const USER_STATUS_LABELS = Object.freeze({
  ACTIVE: "Ativo",
  PENDING: "Pendente",
  BLOCKED: "Bloqueado",
});
const V1_1_USER_TYPES = Object.freeze([
  "MASTER",
  "SOCIO",
  "DESENVOLVEDOR",
  "SUPORTE",
  "VENDEDOR",
  "OWNER",
  "GERENTE",
  "CAIXA",
  "COZINHA",
  "GARCOM",
  "ESTOQUE",
  "FINANCEIRO",
  "MARKETING",
  "ENTREGADOR",
]);
const SYSTEM_USER_TYPES = Object.freeze([
  "MASTER",
  "SOCIO",
  "DESENVOLVEDOR",
  "SUPORTE",
  "VENDEDOR",
]);
const RESTAURANT_USER_TYPES = Object.freeze([
  "OWNER",
  "GERENTE",
  "CAIXA",
  "COZINHA",
  "GARCOM",
  "ESTOQUE",
  "FINANCEIRO",
  "MARKETING",
  "ENTREGADOR",
]);
const SYSTEM_USER_TYPE_SET = new Set(SYSTEM_USER_TYPES);
const RESTAURANT_USER_TYPE_SET = new Set(RESTAURANT_USER_TYPES);
const SYSTEM_USER_HIERARCHY = Object.freeze([
  "MASTER",
  "SOCIO",
  "DESENVOLVEDOR",
  "SUPORTE",
  "VENDEDOR",
]);
const SYSTEM_USER_MANAGEABLE_TYPES = Object.freeze({
  MASTER: Object.freeze(["SOCIO", "DESENVOLVEDOR", "SUPORTE", "VENDEDOR"]),
  SOCIO: Object.freeze(["DESENVOLVEDOR", "SUPORTE", "VENDEDOR"]),
  DESENVOLVEDOR: Object.freeze(["SUPORTE", "VENDEDOR"]),
  SUPORTE: Object.freeze(["VENDEDOR"]),
  VENDEDOR: Object.freeze([]),
});
const PERMISSION_ACTIONS = Object.freeze([
  { key: "view", label: "Visualizar" },
  { key: "create", label: "Criar" },
  { key: "edit", label: "Editar" },
  { key: "delete", label: "Excluir" },
]);
const PERMISSION_MODULES = Object.freeze([
  { key: "dashboard", label: "Dashboard" },
  { key: "orders", label: "Pedidos" },
  { key: "customers", label: "Clientes" },
  { key: "catalog", label: "Cardápio" },
  { key: "promotions", label: "Promoções" },
  { key: "reviews", label: "Avaliações" },
  { key: "reports", label: "Relatórios" },
  { key: "exports", label: "Exportações" },
  { key: "inventory", label: "Estoque" },
  { key: "financial", label: "Financeiro" },
  { key: "settings", label: "Configurações" },
  { key: "users", label: "Usuários" },
  { key: "delivery", label: "Entrega" },
  { key: "business_hours", label: "Horários" },
  { key: "special_dates", label: "Datas especiais" },
]);
const DEVELOPER_PERMISSION_KEYS = Object.freeze([
  "developer_logs_view",
  "developer_support_view",
  "developer_diagnostics_view",
]);
const MODULE_PERMISSION_KEYS = Object.freeze(
  PERMISSION_MODULES.flatMap((module) =>
    PERMISSION_ACTIONS.map((action) => `${module.key}_${action.key}`)
  )
);
const SAAS_PERMISSION_MODULES = Object.freeze([
  "users",
  "orders",
  "scheduled",
  "catalog",
  "deliveries",
  "customers",
  "promotions",
  "metrics",
  "reports",
  "finance",
  "reviews",
  "settings",
]);
const SAAS_PERMISSION_ACTIONS = Object.freeze(["read", "write"]);
const SAAS_MODULE_PERMISSIONS = Object.freeze([
  "users.read",
  "users.write",
  "orders.read",
  "orders.write",
  "scheduled.read",
  "scheduled.write",
  "catalog.read",
  "catalog.write",
  "deliveries.read",
  "deliveries.write",
  "customers.read",
  "customers.write",
  "promotions.read",
  "promotions.write",
  "metrics.read",
  "reports.read",
  "finance.read",
  "finance.write",
  "reviews.read",
  "reviews.write",
  "settings.read",
  "settings.write",
]);
const SAAS_PERMISSION_KEYS = SAAS_MODULE_PERMISSIONS;
const ALL_PERMISSION_KEYS = Object.freeze([
  ...MODULE_PERMISSION_KEYS,
  ...SAAS_PERMISSION_KEYS,
  ...DEVELOPER_PERMISSION_KEYS,
]);
const FULL_RESTAURANT_USER_TYPES = new Set(["OWNER", "GERENTE"]);
const RESTAURANT_INTERNAL_USER_TYPES = new Set([
  "GERENTE",
  "SUBGERENTE",
  "CAIXA",
  "COZINHA",
  "GARCOM",
  "BAR",
  "ESTOQUE",
  "FINANCEIRO",
  "MARKETING",
  "ENTREGADOR",
  "ATENDENTE",
  "CUSTOM",
]);

let sqlClient = null;
let schemaReadyPromise = null;

const cloneJson = (value) => JSON.parse(JSON.stringify(value));

const normalizeText = (value, maxLength = MAX_TEXT_LENGTH) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const normalizeIdentifier = (value) => normalizeText(value, 160).toLowerCase();

const normalizeRestaurantKey = (value, fallback = RESTAURANT_KEY) =>
  normalizeText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;

const buildTenantId = (restaurantKey = RESTAURANT_KEY) => {
  const normalizedRestaurantKey = normalizeRestaurantKey(restaurantKey);
  return normalizedRestaurantKey === RESTAURANT_KEY
    ? "tenant_default"
    : `tenant_${normalizedRestaurantKey.replace(/-/g, "_")}`;
};

const buildRestaurantId = (restaurantKey = RESTAURANT_KEY) => {
  const normalizedRestaurantKey = normalizeRestaurantKey(restaurantKey);
  return normalizedRestaurantKey === RESTAURANT_KEY
    ? "restaurant_default"
    : `restaurant_${normalizedRestaurantKey.replace(/-/g, "_")}`;
};

const normalizeEmail = (value) => {
  const email = normalizeIdentifier(value);
  return email.includes("@") ? email : "";
};

const normalizePhone = (value) =>
  String(value || "")
    .replace(/[^\d+]+/g, "")
    .trim()
    .slice(0, 32);

const getPhoneDigits = (value) => String(value || "").replace(/\D/g, "");

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const isValidPhone = (value) => {
  const digits = getPhoneDigits(value);
  return digits.length >= 10 && digits.length <= 15;
};

const normalizeUserType = (value, fallback = "CUSTOM") => {
  const normalizedValue = normalizeText(value, 40)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  const legacyAliases = {
    COMERCIAL: "VENDEDOR",
    GARCON: "GARCOM",
  };
  const aliasedValue = legacyAliases[normalizedValue] || normalizedValue;
  return USER_TYPES.includes(aliasedValue) ? aliasedValue : fallback;
};

const normalizeUserScope = (value, userType = "CUSTOM", platformScope = false) => {
  const normalizedValue = normalizeText(value, 40)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (["SYSTEM", "SISTEMA", "PLATFORM", "PLATAFORMA"].includes(normalizedValue)) {
    return "SYSTEM";
  }

  if (["RESTAURANT", "RESTAURANTE", "OPERACIONAL"].includes(normalizedValue)) {
    return "RESTAURANT";
  }

  return platformScope === true || SYSTEM_USER_TYPE_SET.has(userType) ? "SYSTEM" : "RESTAURANT";
};

const normalizeStatus = (value, fallback = "ACTIVE") => {
  const normalizedValue = normalizeText(value, 40).toUpperCase();

  if (["ATIVO", "ACTIVE", "ENABLED"].includes(normalizedValue)) {
    return "ACTIVE";
  }

  if (["BLOQUEADO", "BLOCKED", "DISABLED", "INACTIVE"].includes(normalizedValue)) {
    return "BLOCKED";
  }

  if (["PENDENTE", "PENDING", "INVITED", "CONVIDADO"].includes(normalizedValue)) {
    return "PENDING";
  }

  return USER_STATUSES.includes(normalizedValue) ? normalizedValue : fallback;
};

const normalizeCredentialMode = (value, fallback = "TEMPORARY_PASSWORD") => {
  const normalizedValue = normalizeText(value, 60)
    .toUpperCase()
    .replace(/[^A-Z]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (["INVITE", "EMAIL_INVITE", "CONVITE"].includes(normalizedValue)) {
    return "INVITE";
  }

  if (["TEMPORARY_PASSWORD", "PASSWORD", "SENHA_TEMPORARIA"].includes(normalizedValue)) {
    return "TEMPORARY_PASSWORD";
  }

  return fallback;
};

const normalizeDateIso = (value) => {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const normalizePermissions = (permissions = {}) => {
  const source = permissions && typeof permissions === "object" ? permissions : {};

  return ALL_PERMISSION_KEYS.reduce((normalizedPermissions, key) => {
    normalizedPermissions[key] = source[key] === true;
    return normalizedPermissions;
  }, {});
};

const createFullRestaurantPermissions = ({ includeDeveloperPermissions = false } = {}) => {
  const permissions = [...MODULE_PERMISSION_KEYS, ...SAAS_PERMISSION_KEYS].reduce((result, key) => {
    result[key] = true;
    return result;
  }, {});

  DEVELOPER_PERMISSION_KEYS.forEach((key) => {
    permissions[key] = includeDeveloperPermissions;
  });

  return normalizePermissions(permissions);
};

const createPermissions = (keys = []) =>
  normalizePermissions(
    keys.reduce((result, key) => {
      result[key] = true;
      return result;
    }, {})
  );

const PROFILE_DEFAULT_PERMISSIONS = Object.freeze({
  SOCIO: createFullRestaurantPermissions({ includeDeveloperPermissions: false }),
  SUPORTE: createPermissions([
    "dashboard_view",
    "orders_view",
    "orders_create",
    "orders_edit",
    "customers_view",
    "customers_create",
    "customers_edit",
    "catalog_view",
    "reports_view",
    "exports_view",
    "settings_view",
    "users_view",
    "users_create",
    "users_edit",
    "users_delete",
    "delivery_view",
    "business_hours_view",
    "special_dates_view",
    "users.read",
    "users.write",
    "orders.read",
    "orders.write",
    "developer_support_view",
  ]),
  VENDEDOR: createPermissions([
    "dashboard_view",
    "customers_view",
    "reports_view",
    "exports_view",
    "settings_view",
    "users_view",
    "users.read",
  ]),
  SUBGERENTE: createPermissions([
    "dashboard_view",
    "orders_view",
    "orders_create",
    "orders_edit",
    "customers_view",
    "customers_create",
    "customers_edit",
    "catalog_view",
    "inventory_view",
    "reports_view",
    "delivery_view",
    "settings_view",
  ]),
  CAIXA: createPermissions([
    "dashboard_view",
    "orders_view",
    "orders_create",
    "orders_edit",
    "financial_view",
    "customers_view",
  ]),
  COZINHA: createPermissions([
    "dashboard_view",
    "orders_view",
    "orders_edit",
    "catalog_view",
  ]),
  BAR: createPermissions([
    "dashboard_view",
    "orders_view",
    "orders_edit",
    "catalog_view",
  ]),
  GARCOM: createPermissions([
    "dashboard_view",
    "orders_view",
    "orders_create",
    "orders_edit",
    "customers_view",
    "delivery_view",
  ]),
  ESTOQUE: createPermissions([
    "dashboard_view",
    "inventory_view",
    "inventory_create",
    "inventory_edit",
    "catalog_view",
  ]),
  FINANCEIRO: createPermissions([
    "dashboard_view",
    "financial_view",
    "financial_create",
    "financial_edit",
    "reports_view",
    "exports_view",
  ]),
  MARKETING: createPermissions([
    "dashboard_view",
    "customers_view",
    "customers_create",
    "customers_edit",
    "promotions_view",
    "promotions_create",
    "promotions_edit",
    "reviews_view",
    "reports_view",
  ]),
  ENTREGADOR: createPermissions([
    "dashboard_view",
    "orders_view",
    "orders_edit",
    "delivery_view",
  ]),
  ATENDENTE: createPermissions([
    "dashboard_view",
    "orders_view",
    "orders_create",
    "orders_edit",
    "customers_view",
    "customers_create",
    "customers_edit",
  ]),
});

const getDefaultPermissionsForType = (userType) => {
  if (userType === "MASTER") {
    return createFullRestaurantPermissions({ includeDeveloperPermissions: true });
  }

  if (userType === "DESENVOLVEDOR") {
    return createFullRestaurantPermissions({ includeDeveloperPermissions: true });
  }

  if (userType === "OWNER") {
    return createFullRestaurantPermissions({ includeDeveloperPermissions: false });
  }

  if (userType === "GERENTE") {
    return createFullRestaurantPermissions({ includeDeveloperPermissions: false });
  }

  if (PROFILE_DEFAULT_PERMISSIONS[userType]) {
    return PROFILE_DEFAULT_PERMISSIONS[userType];
  }

  return normalizePermissions({});
};

const getEffectivePermissions = (user) => {
  const userType = normalizeUserType(user?.userType || user?.tipo_usuario, "CUSTOM");

  if (
    SYSTEM_USER_TYPE_SET.has(userType) ||
    FULL_RESTAURANT_USER_TYPES.has(userType) ||
    PROFILE_DEFAULT_PERMISSIONS[userType]
  ) {
    return getDefaultPermissionsForType(userType);
  }

  return normalizePermissions(user?.permissions || {});
};

const createPasswordHash = (password, salt = crypto.randomBytes(16).toString("hex")) => {
  const derivedKey = crypto.scryptSync(String(password || ""), salt, SCRYPT_KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
};

const isStrongPassword = (password) => {
  const value = String(password || "");
  return (
    value.length >= STRONG_PASSWORD_MIN_LENGTH &&
    /[A-Za-z]/.test(value) &&
    /\d/.test(value)
  );
};

const createInvitationToken = () => crypto.randomBytes(32).toString("base64url");

const hashInvitationToken = (token) =>
  crypto.createHash("sha256").update(String(token || ""), "utf8").digest("hex");

const getInvitationTtlHours = () => {
  const configuredValue = Number(process.env.INOVAS_INVITE_TTL_HOURS || DEFAULT_INVITATION_TTL_HOURS);
  return Number.isFinite(configuredValue)
    ? Math.min(Math.max(Math.round(configuredValue), 1), 168)
    : DEFAULT_INVITATION_TTL_HOURS;
};

const buildInvitationExpiry = (now = new Date()) =>
  new Date(now.getTime() + getInvitationTtlHours() * 60 * 60 * 1000).toISOString();

const buildUserAuditEvent = ({
  action,
  actor = {},
  restaurantKey = "",
  userType = "",
  status = "",
  permissionCount = 0,
  metadata = {},
}) => ({
  id: createStableId("user_evt"),
  action: normalizeText(action, 80).toUpperCase(),
  actorLogin: normalizeIdentifier(actor.login || actor.email),
  actorType: normalizeUserType(actor.userType || actor.tipo_usuario, "CUSTOM"),
  restaurantKey: normalizeRestaurantKey(restaurantKey, RESTAURANT_KEY),
  userType: normalizeUserType(userType, "CUSTOM"),
  status: normalizeStatus(status, "PENDING"),
  permissionCount: Math.max(0, Number(permissionCount || 0)),
  metadata:
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? cloneJson(metadata)
      : {},
  createdAt: new Date().toISOString(),
});

const appendUserAuditEvent = (auditTrail = [], event) =>
  [...(Array.isArray(auditTrail) ? auditTrail : []), event]
    .filter(Boolean)
    .slice(-100);

const countEnabledPermissions = (permissions = {}) =>
  Object.values(permissions && typeof permissions === "object" ? permissions : {})
    .filter((value) => value === true)
    .length;

const assertPermissionDependencies = (permissions = {}) => {
  const normalizedPermissions = normalizePermissions(permissions);

  PERMISSION_MODULES.forEach((module) => {
    const viewPermission = `${module.key}_view`;
    const dependentPermission = PERMISSION_ACTIONS
      .filter((action) => action.key !== "view")
      .map((action) => `${module.key}_${action.key}`)
      .find((permission) => normalizedPermissions[permission] === true);

    if (dependentPermission && normalizedPermissions[viewPermission] !== true) {
      throw buildHttpError(
        400,
        `A permissao ${dependentPermission} exige ${viewPermission}.`,
        "permission_dependency_missing",
        {
          permission: dependentPermission,
          requiredPermission: viewPermission,
        }
      );
    }
  });

  SAAS_PERMISSION_MODULES.forEach((module) => {
    const writePermission = `${module}.write`;
    const readPermission = `${module}.read`;

    if (
      normalizedPermissions[writePermission] === true &&
      normalizedPermissions[readPermission] !== true
    ) {
      throw buildHttpError(
        400,
        `A permissao ${writePermission} exige ${readPermission}.`,
        "permission_dependency_missing",
        {
          permission: writePermission,
          requiredPermission: readPermission,
        }
      );
    }
  });

  return normalizedPermissions;
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

const verifyPlainPassword = (password, expectedPassword) => {
  const expectedBuffer = Buffer.from(String(expectedPassword || ""));
  const actualBuffer = Buffer.from(String(password || ""));

  if (!expectedBuffer.length || expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
};

const createStableId = (prefix = "user") =>
  `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString("hex")}`;

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

const ensureUserSchema = async () => {
  if (schemaReadyPromise) {
    return schemaReadyPromise;
  }

  const sql = getSql();
  schemaReadyPromise = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
        restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default',
        restaurant_key TEXT NOT NULL DEFAULT 'default',
        name TEXT NOT NULL DEFAULT '',
        login TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        job_title TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        user_type TEXT NOT NULL DEFAULT 'CUSTOM',
        permissions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        credential_mode TEXT NOT NULL DEFAULT 'TEMPORARY_PASSWORD',
        must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
        created_by TEXT NOT NULL DEFAULT '',
        invitation_token_hash TEXT NOT NULL DEFAULT '',
        invitation_expires_at TIMESTAMPTZ,
        invitation_created_at TIMESTAMPTZ,
        invitation_sent_at TIMESTAMPTZ,
        invitation_used_at TIMESTAMPTZ,
        audit_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        source TEXT NOT NULL DEFAULT 'managed',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_access_at TIMESTAMPTZ
      )
    `;

    await sql`
      ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default'
    `;

    await sql`
      ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default'
    `;

    await sql`
      ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT ''
    `;

    await sql`
      ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS job_title TEXT NOT NULL DEFAULT ''
    `;

    await sql`
      ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS credential_mode TEXT NOT NULL DEFAULT 'TEMPORARY_PASSWORD'
    `;

    await sql`
      ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE
    `;

    await sql`
      ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT ''
    `;

    await sql`
      ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS invitation_token_hash TEXT NOT NULL DEFAULT ''
    `;

    await sql`
      ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMPTZ
    `;

    await sql`
      ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS invitation_created_at TIMESTAMPTZ
    `;

    await sql`
      ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ
    `;

    await sql`
      ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS invitation_used_at TIMESTAMPTZ
    `;

    await sql`
      ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS audit_json JSONB NOT NULL DEFAULT '[]'::jsonb
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_lower_uidx
      ON admin_users (LOWER(email))
      WHERE email <> ''
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS admin_users_restaurant_key_idx
      ON admin_users (restaurant_key)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS admin_users_status_idx
      ON admin_users (status)
    `;
  })();

  return schemaReadyPromise;
};

const getEmptyLocalStore = () => ({
  version: LOCAL_STORE_VERSION,
  restaurantKey: RESTAURANT_KEY,
  preparedForFutureRestaurantAssociation: true,
  users: [],
});

const ensureFileStore = async () => {
  await fs.mkdir(path.dirname(LOCAL_STORAGE_FILE), { recursive: true });

  try {
    await fs.access(LOCAL_STORAGE_FILE);
  } catch (error) {
    await fs.writeFile(LOCAL_STORAGE_FILE, JSON.stringify(getEmptyLocalStore(), null, 2));
  }
};

const normalizeStoredUser = (user = {}) => {
  const now = new Date().toISOString();
  const login = normalizeIdentifier(user.login || user.identifier || user.email);
  const userType = normalizeUserType(user.userType || user.tipo_usuario, "CUSTOM");
  const explicitPlatformScope =
    user.platformScope === true ||
    user.platform_scope === true ||
    (userType === "MASTER" && user.restaurantKey === "");
  const userScope = normalizeUserScope(
    user.userScope || user.user_scope || user.scope,
    userType,
    explicitPlatformScope
  );
  const platformScope = userScope === "SYSTEM";
  const restaurantKey = platformScope
    ? ""
    : normalizeRestaurantKey(user.restaurantKey || user.restaurant_key, RESTAURANT_KEY);
  const createdAt = normalizeDateIso(user.createdAt || user.data_criacao) || now;
  const lastAccessAt = normalizeDateIso(user.lastAccessAt || user.ultimo_acesso);
  const invitationExpiresAt = normalizeDateIso(
    user.invitationExpiresAt || user.invitation_expires_at
  );
  const invitationCreatedAt = normalizeDateIso(
    user.invitationCreatedAt || user.invitation_created_at
  );
  const invitationSentAt = normalizeDateIso(
    user.invitationSentAt || user.invitation_sent_at
  );
  const invitationUsedAt = normalizeDateIso(
    user.invitationUsedAt || user.invitation_used_at
  );
  const name = normalizeText(
    user.name || user.nome || user.displayName || user.display_name || login,
    160
  );

  return {
    id: normalizeText(user.id, 120) || createStableId("user"),
    tenantId: platformScope
      ? ""
      : normalizeRestaurantKey(user.tenantId || user.tenant_id, buildTenantId(restaurantKey)),
    restaurantId: platformScope
      ? ""
      : normalizeRestaurantKey(user.restaurantId || user.restaurant_id, buildRestaurantId(restaurantKey)),
    restaurantKey,
    name,
    login,
    email: normalizeEmail(user.email) || (login.includes("@") ? login : ""),
    phone: normalizePhone(user.phone || user.telefone || user.whatsapp),
    jobTitle: normalizeText(user.jobTitle || user.job_title || user.roleDescription, 160),
    passwordHash: normalizeText(user.passwordHash || user.password_hash, 512),
    status: normalizeStatus(user.status, "ACTIVE"),
    userType,
    userScope,
    permissions: normalizePermissions(user.permissions || user.permissions_json),
    credentialMode: normalizeCredentialMode(
      user.credentialMode || user.credential_mode,
      user.invitationTokenHash || user.invitation_token_hash ? "INVITE" : "TEMPORARY_PASSWORD"
    ),
    mustChangePassword:
      user.mustChangePassword === true || user.must_change_password === true,
    createdBy: normalizeIdentifier(user.createdBy || user.created_by),
    invitationTokenHash: normalizeText(
      user.invitationTokenHash || user.invitation_token_hash,
      128
    ),
    invitationExpiresAt,
    invitationCreatedAt,
    invitationSentAt,
    invitationUsedAt,
    auditTrail: Array.isArray(user.auditTrail || user.audit_json)
      ? cloneJson(user.auditTrail || user.audit_json).slice(-100)
      : [],
    createdAt,
    updatedAt: normalizeDateIso(user.updatedAt || user.updated_at) || createdAt,
    lastAccessAt,
    source: normalizeText(user.source, 60) || "managed",
    platformScope,
  };
};

const readFileStore = async () => {
  await ensureFileStore();
  const contents = await fs.readFile(LOCAL_STORAGE_FILE, "utf8");

  try {
    const parsed = JSON.parse(contents);
    const users = Array.isArray(parsed?.users)
      ? parsed.users.map(normalizeStoredUser).filter((user) => user.login)
      : [];

    return {
      ...getEmptyLocalStore(),
      version: Number(parsed?.version || LOCAL_STORE_VERSION),
      users,
    };
  } catch (error) {
    return getEmptyLocalStore();
  }
};

const writeFileStore = async (users) => {
  await fs.mkdir(path.dirname(LOCAL_STORAGE_FILE), { recursive: true });
  await fs.writeFile(
    LOCAL_STORAGE_FILE,
    JSON.stringify(
      {
        ...getEmptyLocalStore(),
        users: users.map(normalizeStoredUser),
      },
      null,
      2
    )
  );
};

const readUsersFromNeon = async () => {
  await ensureUserSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT
      id,
      tenant_id,
      restaurant_id,
      restaurant_key,
      name,
      login,
      email,
      phone,
      job_title,
      password_hash,
      status,
      user_type,
      permissions_json,
      credential_mode,
      must_change_password,
      created_by,
      invitation_token_hash,
      invitation_expires_at,
      invitation_created_at,
      invitation_sent_at,
      invitation_used_at,
      audit_json,
      source,
      created_at,
      updated_at,
      last_access_at
    FROM admin_users
    ORDER BY created_at ASC, login ASC
  `;

  return rows.map((row) =>
    normalizeStoredUser({
      id: row.id,
      tenantId: row.tenant_id,
      restaurantId: row.restaurant_id,
      restaurantKey: row.restaurant_key,
      name: row.name,
      login: row.login,
      email: row.email,
      phone: row.phone,
      jobTitle: row.job_title,
      passwordHash: row.password_hash,
      status: row.status,
      userType: row.user_type,
      permissions: row.permissions_json,
      credentialMode: row.credential_mode,
      mustChangePassword: row.must_change_password === true,
      createdBy: row.created_by,
      invitationTokenHash: row.invitation_token_hash,
      invitationExpiresAt: row.invitation_expires_at
        ? new Date(row.invitation_expires_at).toISOString()
        : "",
      invitationCreatedAt: row.invitation_created_at
        ? new Date(row.invitation_created_at).toISOString()
        : "",
      invitationSentAt: row.invitation_sent_at
        ? new Date(row.invitation_sent_at).toISOString()
        : "",
      invitationUsedAt: row.invitation_used_at
        ? new Date(row.invitation_used_at).toISOString()
        : "",
      auditTrail: row.audit_json,
      source: row.source,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : "",
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : "",
      lastAccessAt: row.last_access_at ? new Date(row.last_access_at).toISOString() : "",
    })
  );
};

const writeUsersToNeon = async (users) => {
  await ensureUserSchema();
  const sql = getSql();
  const normalizedUsers = users.map(normalizeStoredUser);
  const configuredLegacyLogins = new Set(
    normalizedUsers
      .filter((user) => user.source === "legacy_env")
      .map((user) => user.login)
  );
  const staleLegacyUsers = await sql`
    SELECT login
    FROM admin_users
    WHERE source = 'legacy_env'
  `;

  for (const staleUser of staleLegacyUsers) {
    if (!configuredLegacyLogins.has(normalizeIdentifier(staleUser.login))) {
      await sql`
        DELETE FROM admin_users
        WHERE login = ${normalizeIdentifier(staleUser.login)}
          AND source = 'legacy_env'
      `;
    }
  }

  for (const user of normalizedUsers) {
    await sql`
      INSERT INTO admin_users (
        id,
        tenant_id,
        restaurant_id,
        restaurant_key,
        name,
        login,
        email,
        phone,
        job_title,
        password_hash,
        status,
        user_type,
        permissions_json,
        credential_mode,
        must_change_password,
        created_by,
        invitation_token_hash,
        invitation_expires_at,
        invitation_created_at,
        invitation_sent_at,
        invitation_used_at,
        audit_json,
        source,
        created_at,
        updated_at,
        last_access_at
      )
      VALUES (
        ${user.id},
        ${user.tenantId},
        ${user.restaurantId},
        ${user.restaurantKey},
        ${user.name},
        ${user.login},
        ${user.email},
        ${user.phone},
        ${user.jobTitle},
        ${user.passwordHash},
        ${user.status},
        ${user.userType},
        ${JSON.stringify(user.permissions)}::jsonb,
        ${user.credentialMode},
        ${user.mustChangePassword},
        ${user.createdBy},
        ${user.invitationTokenHash},
        ${user.invitationExpiresAt || null},
        ${user.invitationCreatedAt || null},
        ${user.invitationSentAt || null},
        ${user.invitationUsedAt || null},
        ${JSON.stringify(user.auditTrail)}::jsonb,
        ${user.source},
        ${user.createdAt},
        ${user.updatedAt},
        ${user.lastAccessAt || null}
      )
      ON CONFLICT (id)
      DO UPDATE SET
        restaurant_key = EXCLUDED.restaurant_key,
        tenant_id = EXCLUDED.tenant_id,
        restaurant_id = EXCLUDED.restaurant_id,
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        job_title = EXCLUDED.job_title,
        password_hash = EXCLUDED.password_hash,
        status = EXCLUDED.status,
        user_type = EXCLUDED.user_type,
        permissions_json = EXCLUDED.permissions_json,
        credential_mode = EXCLUDED.credential_mode,
        must_change_password = EXCLUDED.must_change_password,
        created_by = EXCLUDED.created_by,
        invitation_token_hash = EXCLUDED.invitation_token_hash,
        invitation_expires_at = EXCLUDED.invitation_expires_at,
        invitation_created_at = EXCLUDED.invitation_created_at,
        invitation_sent_at = EXCLUDED.invitation_sent_at,
        invitation_used_at = EXCLUDED.invitation_used_at,
        audit_json = EXCLUDED.audit_json,
        source = EXCLUDED.source,
        updated_at = EXCLUDED.updated_at,
        last_access_at = EXCLUDED.last_access_at
    `;
  }
};

const readStoredUsers = async () => {
  const storageMode = getStorageMode();

  if (storageMode === "neon") {
    return readUsersFromNeon();
  }

  if (storageMode === "disabled") {
    return [];
  }

  return (await readFileStore()).users;
};

const writeStoredUsers = async (users) => {
  const storageMode = getStorageMode();

  if (storageMode === "neon") {
    await writeUsersToNeon(users);
    return;
  }

  if (storageMode === "disabled") {
    throw buildHttpError(
      503,
      "Armazenamento de usuarios indisponivel. Configure DATABASE_URL para gerenciar usuarios em producao.",
      "admin_users_storage_unavailable"
    );
  }

  await writeFileStore(users);
};

const normalizeConfiguredAdminUser = (user = {}) => {
  const login = normalizeIdentifier(user.login || user.identifier || user.email || user.username);
  const passwordHash = normalizeText(user.passwordHash || user.password_hash, 512);
  const password = String(user.password || "");
  const userType = normalizeUserType(user.userType || user.tipo_usuario, "MASTER");
  const explicitPlatformScope =
    user.platformScope === true ||
    user.platform_scope === true;
  const userScope = normalizeUserScope(
    user.userScope || user.user_scope || user.scope,
    userType,
    explicitPlatformScope
  );
  const platformScope = userScope === "SYSTEM";
  const restaurantKey = platformScope
    ? ""
    : normalizeRestaurantKey(user.restaurantKey || user.restaurant_key, RESTAURANT_KEY);

  if (!login || (!passwordHash && !password)) {
    return null;
  }

  return {
    login,
    name: normalizeText(user.displayName || user.name || user.nome || login, 160),
    email: normalizeEmail(user.email || login),
    phone: normalizePhone(user.phone || user.telefone || user.whatsapp),
    tenantId: platformScope ? "" : normalizeRestaurantKey(user.tenantId || user.tenant_id, buildTenantId(restaurantKey)),
    restaurantId: platformScope
      ? ""
      : normalizeRestaurantKey(user.restaurantId || user.restaurant_id, buildRestaurantId(restaurantKey)),
    restaurantKey,
    passwordHash,
    password,
    status: normalizeStatus(user.status, "ACTIVE"),
    userType,
    userScope,
    permissions: normalizePermissions(user.permissions || user.permissions_json),
    platformScope,
  };
};

const getVirtualUsersFromConfigured = (configuredUsers = []) =>
  configuredUsers
    .map(normalizeConfiguredAdminUser)
    .filter(Boolean)
    .map((user) => ({
      ...normalizeStoredUser({
        id: `legacy_${user.login.replace(/[^a-z0-9_-]+/g, "_")}`,
        tenantId: user.tenantId,
        restaurantId: user.restaurantId,
        restaurantKey: user.restaurantKey,
        name: user.name,
        login: user.login,
        email: user.email,
        phone: user.phone,
        passwordHash: user.passwordHash,
        status: user.status,
        userType: user.userType,
        userScope: user.userScope,
        permissions: user.permissions,
        source: "legacy_env",
        platformScope: user.platformScope,
      }),
      password: user.password || "",
    }));

const resolveConfiguredPasswordHash = (configuredUser, existingUser) => {
  if (configuredUser.passwordHash) {
    return configuredUser.passwordHash;
  }

  if (!configuredUser.password) {
    return existingUser?.passwordHash || "";
  }

  if (existingUser?.passwordHash && verifyPasswordHash(configuredUser.password, existingUser.passwordHash)) {
    return existingUser.passwordHash;
  }

  return createPasswordHash(configuredUser.password);
};

const ensureConfiguredAdminUsers = async (configuredUsers = []) => {
  const storageMode = getStorageMode();
  const normalizedConfiguredUsers = configuredUsers
    .map(normalizeConfiguredAdminUser)
    .filter(Boolean);

  if (!normalizedConfiguredUsers.length || storageMode === "disabled") {
    return;
  }

  const storedUsers = await readStoredUsers();
  const configuredLogins = new Set(normalizedConfiguredUsers.map((user) => user.login));
  let changed = false;
  const nextUsers = storedUsers.filter((user) => {
    const keepUser = user.source !== "legacy_env" || configuredLogins.has(user.login);

    if (!keepUser) {
      changed = true;
    }

    return keepUser;
  });

  normalizedConfiguredUsers.forEach((configuredUser) => {
    const existingIndex = nextUsers.findIndex((user) => user.login === configuredUser.login);
    const existingUser = existingIndex === -1 ? null : nextUsers[existingIndex];
    const legacyUser = normalizeStoredUser({
      ...(existingUser || {}),
      id: existingUser?.id || `legacy_${configuredUser.login.replace(/[^a-z0-9_-]+/g, "_")}`,
      name:
        existingUser && existingUser.source !== "legacy_env"
          ? existingUser.name
          : configuredUser.name,
      login: configuredUser.login,
      email:
        existingUser && existingUser.source !== "legacy_env"
          ? existingUser.email
          : configuredUser.email,
      phone:
        existingUser && existingUser.source !== "legacy_env"
          ? existingUser.phone
          : configuredUser.phone,
      passwordHash:
        existingUser && existingUser.source !== "legacy_env"
          ? existingUser.passwordHash
          : resolveConfiguredPasswordHash(configuredUser, existingUser),
      status: configuredUser.status || existingUser?.status || "ACTIVE",
      userType:
        existingUser && existingUser.source !== "legacy_env"
          ? existingUser.userType
          : configuredUser.userType,
      userScope:
        existingUser && existingUser.source !== "legacy_env"
          ? existingUser.userScope
          : configuredUser.userScope,
      permissions:
        existingUser && existingUser.source !== "legacy_env"
          ? existingUser.permissions || {}
          : configuredUser.permissions || {},
      createdAt: existingUser?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastAccessAt: existingUser?.lastAccessAt || "",
      source: existingUser?.source || "legacy_env",
      tenantId:
        existingUser && existingUser.source !== "legacy_env"
          ? existingUser.tenantId
          : configuredUser.tenantId,
      restaurantId:
        existingUser && existingUser.source !== "legacy_env"
          ? existingUser.restaurantId
          : configuredUser.restaurantId,
      restaurantKey:
        existingUser && existingUser.source !== "legacy_env"
          ? existingUser.restaurantKey
          : configuredUser.restaurantKey,
      platformScope:
        existingUser && existingUser.source !== "legacy_env"
          ? existingUser.platformScope === true
          : configuredUser.platformScope === true,
    });

    if (existingIndex === -1) {
      nextUsers.push(legacyUser);
      changed = true;
      return;
    }

    if (
      existingUser.source === "legacy_env" &&
      JSON.stringify(existingUser) !== JSON.stringify(legacyUser)
    ) {
      nextUsers[existingIndex] = legacyUser;
      changed = true;
    }
  });

  if (changed) {
    await writeStoredUsers(nextUsers);
  }
};

const readAllUsers = async (configuredUsers = []) => {
  await ensureConfiguredAdminUsers(configuredUsers);
  const storedUsers = await readStoredUsers();
  const configuredLogins = new Set(
    configuredUsers
      .map(normalizeConfiguredAdminUser)
      .filter(Boolean)
      .map((user) => user.login)
  );
  const scopedStoredUsers = storedUsers.filter(
    (user) => user.source !== "legacy_env" || configuredLogins.has(user.login)
  );

  if (scopedStoredUsers.length) {
    return scopedStoredUsers;
  }

  return getVirtualUsersFromConfigured(configuredUsers);
};

const findUserByLogin = async (login, configuredUsers = []) => {
  const normalizedLogin = normalizeIdentifier(login);

  if (!normalizedLogin) {
    return null;
  }

  const users = await readAllUsers(configuredUsers);
  return users.find((user) => user.login === normalizedLogin) || null;
};

const serializePermissionModules = () =>
  PERMISSION_MODULES.map((module) => ({
    ...module,
    permissions: PERMISSION_ACTIONS.map((action) => ({
      ...action,
      permission: `${module.key}_${action.key}`,
    })),
  }));

const serializeSaasPermissionArchitecture = () => ({
  version: "v1.2",
  mode: "prepared",
  enforced: false,
  modules: SAAS_PERMISSION_MODULES.map((module) => ({
    key: module,
    permissions: SAAS_MODULE_PERMISSIONS
      .filter((permission) => permission.startsWith(`${module}.`))
      .map((permission) => ({
        action: permission.slice(module.length + 1),
        permission,
      })),
  })),
});

const serializeUser = (user) => {
  const normalizedUser = normalizeStoredUser(user);
  const effectivePermissions = getEffectivePermissions(normalizedUser);

  return {
    id: normalizedUser.id,
    tenantId: normalizedUser.tenantId,
    restaurantId: normalizedUser.restaurantId,
    restaurantKey: normalizedUser.restaurantKey,
    platformScope: normalizedUser.platformScope === true,
    preparedRestaurantAssociation: {
      strategy: "restaurant_key",
      value: normalizedUser.restaurantKey,
      tenantId: normalizedUser.tenantId,
      restaurantId: normalizedUser.restaurantId,
      restaurantIdImplemented: true,
    },
    name: normalizedUser.name,
    nome: normalizedUser.name,
    login: normalizedUser.login,
    email: normalizedUser.email,
    phone: normalizedUser.phone,
    telefone: normalizedUser.phone,
    jobTitle: normalizedUser.jobTitle,
    status: normalizedUser.status,
    statusLabel: USER_STATUS_LABELS[normalizedUser.status] || normalizedUser.status,
    userType: normalizedUser.userType,
    tipo_usuario: normalizedUser.userType,
    userScope: normalizedUser.userScope,
    userScopeLabel: normalizedUser.userScope === "SYSTEM" ? "Usuario do Sistema" : "Usuario de Restaurante",
    userTypeLabel: USER_TYPE_LABELS[normalizedUser.userType] || normalizedUser.userType,
    createdAt: normalizedUser.createdAt,
    data_criacao: normalizedUser.createdAt,
    updatedAt: normalizedUser.updatedAt,
    lastAccessAt: normalizedUser.lastAccessAt,
    ultimo_acesso: normalizedUser.lastAccessAt,
    permissions: normalizePermissions(normalizedUser.permissions),
    effectivePermissions,
    credentialMode: normalizedUser.credentialMode,
    mustChangePassword: normalizedUser.mustChangePassword === true,
    createdBy: normalizedUser.createdBy,
    invitation: {
      state: normalizedUser.invitationUsedAt
        ? "USED"
        : normalizedUser.invitationTokenHash &&
            normalizedUser.invitationExpiresAt &&
            new Date(normalizedUser.invitationExpiresAt).getTime() > Date.now()
          ? "PENDING"
          : normalizedUser.invitationTokenHash
            ? "EXPIRED"
            : "NOT_CREATED",
      expiresAt: normalizedUser.invitationExpiresAt,
      createdAt: normalizedUser.invitationCreatedAt,
      sentAt: normalizedUser.invitationSentAt,
      usedAt: normalizedUser.invitationUsedAt,
    },
    auditTrail: cloneJson(normalizedUser.auditTrail),
    permissionArchitecture: serializeSaasPermissionArchitecture(),
    source: normalizedUser.source,
  };
};

const serializeAccessUser = (user) => {
  const serializedUser = serializeUser(user);

  return {
    login: serializedUser.login,
    displayName: serializedUser.name,
    name: serializedUser.name,
    email: serializedUser.email,
    phone: serializedUser.phone,
    telefone: serializedUser.phone,
    status: serializedUser.status,
    userType: serializedUser.userType,
    tipo_usuario: serializedUser.tipo_usuario,
    userScope: serializedUser.userScope,
    tenantId: serializedUser.tenantId,
    restaurantId: serializedUser.restaurantId,
    restaurantKey: serializedUser.restaurantKey,
    platformScope: serializedUser.platformScope === true,
    permissions: serializedUser.effectivePermissions,
    permissionModules: serializePermissionModules(),
    permissionArchitecture: serializeSaasPermissionArchitecture(),
  };
};

const buildUsersPayload = async (configuredUsers = []) => {
  const users = await readAllUsers(configuredUsers);

  return {
    storageMode: getStorageMode(),
    restaurantKey: RESTAURANT_KEY,
    generatedAt: new Date().toISOString(),
    users: users.map(serializeUser),
    permissionModules: serializePermissionModules(),
    permissionActions: PERMISSION_ACTIONS,
    permissionArchitecture: serializeSaasPermissionArchitecture(),
    systemHierarchy: SYSTEM_USER_HIERARCHY,
    profiles: USER_TYPES.map((type) => ({
      type,
      label: USER_TYPE_LABELS[type],
      permissions: getDefaultPermissionsForType(type),
    })),
    profileGroups: {
      system: SYSTEM_USER_TYPES.map((type) => ({
        type,
        label: USER_TYPE_LABELS[type],
        permissions: getDefaultPermissionsForType(type),
      })),
      restaurant: RESTAURANT_USER_TYPES.map((type) => ({
        type,
        label: USER_TYPE_LABELS[type],
        permissions: getDefaultPermissionsForType(type),
      })),
    },
    futureRestaurantAssociation: {
      prepared: true,
      currentKey: RESTAURANT_KEY,
      restaurantIdImplemented: true,
      note:
        "Usuarios carregam tenantId, restaurantId e restaurantKey para operacao multi-restaurante piloto.",
    },
  };
};

const hasManagedAdminUsers = async (configuredUsers = []) => {
  const users = await readAllUsers(configuredUsers);
  return users.length > 0;
};

const verifyUserPassword = (password, user, configuredUsers = []) => {
  const configuredUser = configuredUsers
    .map(normalizeConfiguredAdminUser)
    .filter(Boolean)
    .find((entry) => entry.login === user?.login);

  if (user?.source === "legacy_env" && !configuredUser) {
    return false;
  }

  if (user?.passwordHash && verifyPasswordHash(password, user.passwordHash)) {
    return true;
  }

  if (configuredUser?.passwordHash && verifyPasswordHash(password, configuredUser.passwordHash)) {
    return true;
  }

  if (configuredUser?.password && verifyPlainPassword(password, configuredUser.password)) {
    return true;
  }

  return Boolean(user?.password && verifyPlainPassword(password, user.password));
};

const authenticateAdminUser = async (identifier, password, configuredUsers = []) => {
  const login = normalizeIdentifier(identifier);

  if (!login || !password) {
    return null;
  }

  const user = await findUserByLogin(login, configuredUsers);

  if (!user) {
    return null;
  }

  if (user.status !== "ACTIVE") {
    throw buildHttpError(
      403,
      user.status === "PENDING"
        ? "Seu acesso ainda esta pendente de ativacao."
        : "Usuario bloqueado.",
      user.status === "PENDING" ? "admin_user_pending" : "admin_user_blocked"
    );
  }

  if (!verifyUserPassword(password, user, configuredUsers)) {
    return null;
  }

  return serializeAccessUser(user);
};

const recordAdminUserAccess = async (login, configuredUsers = []) => {
  const storageMode = getStorageMode();

  if (storageMode === "disabled") {
    return null;
  }

  await ensureConfiguredAdminUsers(configuredUsers);
  const users = await readStoredUsers();
  const normalizedLogin = normalizeIdentifier(login);
  const userIndex = users.findIndex((user) => user.login === normalizedLogin);

  if (userIndex === -1) {
    return null;
  }

  const now = new Date().toISOString();
  users[userIndex] = {
    ...users[userIndex],
    lastAccessAt: now,
    updatedAt: now,
  };
  await writeStoredUsers(users);

  return serializeUser(users[userIndex]);
};

const assertSingleActiveMaster = (users) => {
  const masters = users.filter((user) => normalizeUserType(user.userType) === "MASTER");
  const activeMasters = masters.filter((user) => user.status === "ACTIVE");

  if (masters.length !== 1) {
    throw buildHttpError(
      400,
      "A plataforma deve manter exatamente um usuario MASTER.",
      "single_master_required"
    );
  }

  if (!activeMasters.length) {
    throw buildHttpError(
      400,
      "Ao menos um usuario MASTER ativo precisa permanecer no sistema.",
      "active_master_required"
    );
  }
};

const assertCanChangeTargetStatus = (targetUser, nextStatus, actor = {}) => {
  if (targetUser.login === normalizeIdentifier(actor.login) && nextStatus !== "ACTIVE") {
    throw buildHttpError(
      400,
      "O usuario conectado nao pode bloquear o proprio acesso.",
      "cannot_block_self"
    );
  }
};

const assertCanDeleteTargetUser = (targetUser, actor = {}) => {
  if (targetUser.login === normalizeIdentifier(actor.login)) {
    throw buildHttpError(
      400,
      "O usuario conectado nao pode excluir o proprio acesso.",
      "cannot_delete_self"
    );
  }
};

const getSystemManageableUserTypes = (actorType) =>
  SYSTEM_USER_MANAGEABLE_TYPES[normalizeUserType(actorType, "CUSTOM")] || [];

const canSystemActorManageRestaurantUsers = (actorType) =>
  ["MASTER", "SOCIO", "SUPORTE"].includes(normalizeUserType(actorType, "CUSTOM"));

const assertCanManageUser = ({
  actor = {},
  targetUser = {},
  existingUser = null,
  requestedRestaurantKey = RESTAURANT_KEY,
  operation = "write",
}) => {
  const actorType = normalizeUserType(actor.userType || actor.tipo_usuario, "CUSTOM");
  const targetType = normalizeUserType(targetUser.userType || targetUser.tipo_usuario, "CUSTOM");
  const actorRestaurantKey = normalizeRestaurantKey(actor.restaurantKey, RESTAURANT_KEY);
  const targetScope = normalizeUserScope(
    targetUser.userScope || targetUser.user_scope || existingUser?.userScope || existingUser?.user_scope,
    targetType,
    targetUser.platformScope === true || existingUser?.platformScope === true
  );
  const targetRestaurantKey = normalizeRestaurantKey(
    requestedRestaurantKey || targetUser.restaurantKey || targetUser.restaurant_key,
    RESTAURANT_KEY
  );
  const existingScope = existingUser
    ? normalizeUserScope(
        existingUser.userScope || existingUser.user_scope,
        normalizeUserType(existingUser.userType || existingUser.tipo_usuario, "CUSTOM"),
        existingUser.platformScope === true
      )
    : targetScope;

  if (targetScope === "SYSTEM" || SYSTEM_USER_TYPE_SET.has(targetType) || existingScope === "SYSTEM") {
    const manageableTypes = getSystemManageableUserTypes(actorType);

    if (actorType === "MASTER" && existingUser?.login === normalizeIdentifier(actor.login) && targetType === "MASTER") {
      return;
    }

    if (!SYSTEM_USER_TYPE_SET.has(actorType) || !manageableTypes.includes(targetType)) {
      throw buildHttpError(
        403,
        "Este perfil nao pode administrar usuarios do sistema acima da propria hierarquia.",
        "system_user_hierarchy_denied",
        {
          actorType,
          targetType,
          operation,
        }
      );
    }

    if (operation === "delete" && actorType === "DESENVOLVEDOR") {
      throw buildHttpError(
        403,
        "DESENVOLVEDOR pode criar e alterar SUPORTE e VENDEDOR, mas nao excluir usuarios do sistema.",
        "system_user_delete_denied"
      );
    }

    return;
  }

  if (SYSTEM_USER_TYPE_SET.has(actorType)) {
    if (
      actorType === "VENDEDOR" &&
      actor.onboardingScope === true &&
      targetType === "OWNER" &&
      targetRestaurantKey
    ) {
      return;
    }

    if (!canSystemActorManageRestaurantUsers(actorType)) {
      throw buildHttpError(
        403,
        "Este perfil do sistema nao pode administrar usuarios de restaurantes.",
        "system_user_restaurant_manage_denied",
        {
          actorType,
          targetType,
        }
      );
    }

    if (!RESTAURANT_USER_TYPE_SET.has(targetType) && !RESTAURANT_INTERNAL_USER_TYPES.has(targetType)) {
      throw buildHttpError(400, "Perfil operacional de restaurante invalido.", "invalid_restaurant_user_type");
    }

    if (!targetRestaurantKey) {
      throw buildHttpError(400, "Restaurante do usuario e obrigatorio.", "missing_user_restaurant");
    }

    return;
  }

  if (actorType !== "OWNER") {
    throw buildHttpError(
      403,
      "Este perfil pode apenas visualizar usuarios conforme suas permissoes.",
      "user_profile_view_only"
    );
  }

  if (targetType === "OWNER" || !RESTAURANT_INTERNAL_USER_TYPES.has(targetType)) {
    throw buildHttpError(400, "Perfil de usuario interno invalido.", "invalid_internal_user_type");
  }

  if (targetRestaurantKey !== actorRestaurantKey) {
    throw buildHttpError(
      403,
      "OWNER nao pode criar ou alterar usuarios de outro restaurante.",
      "owner_restaurant_scope_denied",
      {
        actorRestaurantKey,
        targetRestaurantKey,
      }
    );
  }

  if (existingUser && normalizeRestaurantKey(existingUser.restaurantKey, RESTAURANT_KEY) !== actorRestaurantKey) {
    throw buildHttpError(
      403,
      "OWNER nao pode alterar usuarios de outro restaurante.",
      "owner_restaurant_scope_denied"
    );
  }
};

const getUserByIdOrLogin = (users, identifier) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  return (
    users.find((user) => user.id === identifier) ||
    users.find((user) => user.login === normalizedIdentifier) ||
    null
  );
};

const saveAdminUser = async (payload = {}, actor = {}, configuredUsers = []) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw buildHttpError(400, "Informe os dados do usuario.", "invalid_user_payload");
  }

  await ensureConfiguredAdminUsers(configuredUsers);
  const users = await readStoredUsers();
  const userPayload = payload.user && typeof payload.user === "object" ? payload.user : payload;
  const id = normalizeText(userPayload.id, 120);
  const login = normalizeIdentifier(userPayload.login || userPayload.email);
  const forceCreate = payload.forceCreate === true || userPayload.forceCreate === true;
  const existingIndex = forceCreate
    ? -1
    : id
      ? users.findIndex((user) => user.id === id)
      : users.findIndex((user) => user.login === login);
  const existingUser = existingIndex === -1 ? null : users[existingIndex];
  const isCreating = !existingUser;
  const name = normalizeText(userPayload.name || userPayload.nome, 160);
  const email = normalizeEmail(userPayload.email || existingUser?.email || login);
  const phone = normalizePhone(userPayload.phone || userPayload.telefone || userPayload.whatsapp || existingUser?.phone);
  const jobTitle = normalizeText(
    userPayload.jobTitle || userPayload.job_title || userPayload.roleDescription || existingUser?.jobTitle,
    160
  );
  const userType = normalizeUserType(userPayload.userType || userPayload.tipo_usuario, "CUSTOM");
  const requestedCredentialMode = normalizeCredentialMode(
    userPayload.credentialMode || userPayload.credential_mode || userPayload.accessMode,
    existingUser?.credentialMode || "TEMPORARY_PASSWORD"
  );
  const credentialMode = isCreating ? requestedCredentialMode : existingUser?.credentialMode || requestedCredentialMode;
  const status =
    isCreating && credentialMode === "INVITE"
      ? "PENDING"
      : normalizeStatus(userPayload.status, existingUser?.status || "ACTIVE");
  const password = String(userPayload.password || userPayload.senha || "");
  const mustChangePassword =
    credentialMode === "TEMPORARY_PASSWORD" &&
    (userPayload.mustChangePassword === true ||
      userPayload.must_change_password === true ||
      userPayload.forcePasswordChange === true);
  const isGuidedCreation =
    userPayload.creationExperienceVersion === 2 ||
    payload.creationExperienceVersion === 2;
  const actorType = normalizeUserType(actor.userType || actor.tipo_usuario, "CUSTOM");
  const userScope = normalizeUserScope(
    userPayload.userScope || userPayload.user_scope || userPayload.scope || existingUser?.userScope,
    userType,
    userPayload.platformScope === true || existingUser?.platformScope === true
  );
  const requestedRestaurantKey =
    userScope === "SYSTEM"
      ? ""
      : normalizeRestaurantKey(
          userPayload.restaurantKey || userPayload.restaurant_key || payload.restaurantKey || payload.restaurant_key,
          existingUser?.restaurantKey || actor.restaurantKey || RESTAURANT_KEY
        );
  const restaurantKey =
    userScope === "SYSTEM"
      ? ""
      : canSystemActorManageRestaurantUsers(actorType) ||
        (actorType === "VENDEDOR" && actor.onboardingScope === true)
      ? requestedRestaurantKey
      : normalizeRestaurantKey(actor.restaurantKey, RESTAURANT_KEY);

  if (!login) {
    throw buildHttpError(400, "Login do usuario e obrigatorio.", "missing_user_login");
  }

  if (!name) {
    throw buildHttpError(400, "Nome do usuario e obrigatorio.", "missing_user_name");
  }

  if (!email || !isValidEmail(email)) {
    throw buildHttpError(400, "Informe um e-mail valido para o usuario.", "invalid_user_email");
  }

  if (userScope === "SYSTEM" && !SYSTEM_USER_TYPE_SET.has(userType)) {
    throw buildHttpError(
      400,
      "Usuario do sistema deve usar um perfil da plataforma INOVAS.",
      "invalid_system_user_type"
    );
  }

  if (
    userScope === "RESTAURANT" &&
    !RESTAURANT_USER_TYPE_SET.has(userType) &&
    !RESTAURANT_INTERNAL_USER_TYPES.has(userType)
  ) {
    throw buildHttpError(
      400,
      "Usuario de restaurante deve usar um perfil operacional valido.",
      "invalid_restaurant_user_type"
    );
  }

  if (userScope === "RESTAURANT" && phone && !isValidPhone(phone)) {
    throw buildHttpError(400, "Informe um telefone valido para o usuario.", "invalid_user_phone");
  }

  if (userScope === "RESTAURANT" && !restaurantKey) {
    throw buildHttpError(400, "Restaurante do usuario e obrigatorio.", "missing_user_restaurant");
  }

  if (isCreating && credentialMode !== "INVITE" && !password) {
    throw buildHttpError(400, "Senha inicial do usuario e obrigatoria.", "missing_user_password");
  }

  if (
    password &&
    (password.length < MIN_PASSWORD_LENGTH || (isGuidedCreation && !isStrongPassword(password)))
  ) {
    throw buildHttpError(
      400,
      isGuidedCreation
        ? "Use uma senha com pelo menos 10 caracteres, incluindo letras e numeros."
        : "Informe uma senha com pelo menos 6 caracteres.",
      "invalid_user_password"
    );
  }

  if (existingUser && existingUser.login !== login) {
    throw buildHttpError(
      400,
      "O login nao pode ser alterado depois da criacao do usuario.",
      "user_login_immutable"
    );
  }

  if (users.some((user) => user.login === login && user.id !== existingUser?.id)) {
    throw buildHttpError(
      409,
      login === email
        ? "Ja existe um usuario com este e-mail."
        : "Ja existe um usuario com este login.",
      login === email ? "duplicate_user_email" : "duplicate_user_login"
    );
  }

  if (users.some((user) => user.email === email && user.id !== existingUser?.id)) {
    throw buildHttpError(409, "Ja existe um usuario com este e-mail.", "duplicate_user_email");
  }

  assertCanManageUser({
    actor,
    existingUser,
    requestedRestaurantKey,
    targetUser: {
      ...userPayload,
      userType,
      userScope,
      platformScope: userScope === "SYSTEM",
      restaurantKey,
    },
  });

  const now = new Date().toISOString();
  const customPermissions =
    userType === "CUSTOM"
      ? assertPermissionDependencies(userPayload.permissions)
      : getDefaultPermissionsForType(userType);
  const invitationToken = isCreating && credentialMode === "INVITE"
    ? createInvitationToken()
    : "";
  const invitationTokenHash = invitationToken
    ? hashInvitationToken(invitationToken)
    : existingUser?.invitationTokenHash || "";
  const invitationExpiresAt = invitationToken
    ? buildInvitationExpiry(new Date(now))
    : existingUser?.invitationExpiresAt || "";
  const createdBy = existingUser?.createdBy || normalizeIdentifier(actor.login || actor.email);
  const creationAuditEvent = buildUserAuditEvent({
    action: isCreating ? "USER_CREATED" : "USER_UPDATED",
    actor,
    restaurantKey,
    userType,
    status,
    permissionCount: countEnabledPermissions(customPermissions),
    metadata: {
      credentialMode,
      customPermissions: userType === "CUSTOM",
      inviteDelivery: credentialMode === "INVITE" ? "NOT_SENT" : "NOT_APPLICABLE",
      mustChangePassword,
    },
  });
  const nextUser = normalizeStoredUser({
    ...(existingUser || {}),
    id: existingUser?.id || createStableId("user"),
    tenantId: userScope === "SYSTEM" ? "" : buildTenantId(restaurantKey),
    restaurantId: userScope === "SYSTEM" ? "" : buildRestaurantId(restaurantKey),
    restaurantKey,
    name,
    login,
    email,
    phone,
    jobTitle,
    passwordHash: password ? createPasswordHash(password) : existingUser?.passwordHash,
    status,
    userType,
    userScope,
    platformScope: userScope === "SYSTEM",
    permissions: customPermissions,
    credentialMode,
    mustChangePassword,
    createdBy,
    invitationTokenHash,
    invitationExpiresAt,
    invitationCreatedAt: invitationToken ? now : existingUser?.invitationCreatedAt || "",
    invitationSentAt: existingUser?.invitationSentAt || "",
    invitationUsedAt: invitationToken ? "" : existingUser?.invitationUsedAt || "",
    auditTrail: appendUserAuditEvent(existingUser?.auditTrail, creationAuditEvent),
    createdAt: existingUser?.createdAt || now,
    updatedAt: now,
    lastAccessAt: existingUser?.lastAccessAt || "",
    source: "managed",
  });
  const nextUsers = [...users];

  assertCanChangeTargetStatus(nextUser, nextUser.status, actor);

  if (existingIndex === -1) {
    nextUsers.push(nextUser);
  } else {
    nextUsers[existingIndex] = nextUser;
  }

  assertSingleActiveMaster(nextUsers);
  try {
    await writeStoredUsers(nextUsers);
  } catch (error) {
    if (String(error?.code || "") === "23505") {
      throw buildHttpError(
        409,
        "Ja existe um usuario com este e-mail.",
        "duplicate_user_email"
      );
    }

    throw error;
  }

  return {
    storageMode: getStorageMode(),
    generatedAt: new Date().toISOString(),
    user: serializeUser(nextUser),
    users: nextUsers.map(serializeUser),
    message: isCreating ? "Usuario criado com sucesso." : "Usuario atualizado com sucesso.",
    invitationToken,
  };
};

const deleteAdminUser = async (payload = {}, actor = {}, configuredUsers = []) => {
  await ensureConfiguredAdminUsers(configuredUsers);
  const users = await readStoredUsers();
  const identifier = normalizeText(payload.id || payload.login, 160);
  const targetUser = getUserByIdOrLogin(users, identifier);

  if (!targetUser) {
    throw buildHttpError(404, "Usuario nao encontrado.", "admin_user_not_found");
  }

  assertCanManageUser({
    actor,
    existingUser: targetUser,
    operation: "delete",
    requestedRestaurantKey: targetUser.restaurantKey,
    targetUser,
  });
  assertCanDeleteTargetUser(targetUser, actor);

  const nextUsers = users.filter((user) => user.id !== targetUser.id);

  assertSingleActiveMaster(nextUsers);
  await writeStoredUsers(nextUsers);

  return {
    storageMode: getStorageMode(),
    generatedAt: new Date().toISOString(),
    user: serializeUser(targetUser),
    users: nextUsers.map(serializeUser),
    message: "Usuario excluido com sucesso.",
  };
};

const setAdminUserStatus = async (payload = {}, actor = {}, configuredUsers = []) => {
  await ensureConfiguredAdminUsers(configuredUsers);
  const users = await readStoredUsers();
  const identifier = normalizeText(payload.id || payload.login, 160);
  const targetUser = getUserByIdOrLogin(users, identifier);
  const nextStatus = normalizeStatus(payload.status, "");

  if (!targetUser) {
    throw buildHttpError(404, "Usuario nao encontrado.", "admin_user_not_found");
  }

  if (!nextStatus) {
    throw buildHttpError(400, "Status do usuario e obrigatorio.", "missing_user_status");
  }

  assertCanManageUser({
    actor,
    existingUser: targetUser,
    requestedRestaurantKey: targetUser.restaurantKey,
    targetUser,
  });
  assertCanChangeTargetStatus(targetUser, nextStatus, actor);

  const nextUsers = users.map((user) =>
    user.id === targetUser.id
      ? {
          ...user,
          status: nextStatus,
          updatedAt: new Date().toISOString(),
          source: "managed",
          auditTrail: appendUserAuditEvent(
            user.auditTrail,
            buildUserAuditEvent({
              action: "USER_STATUS_CHANGED",
              actor,
              restaurantKey: user.restaurantKey,
              userType: user.userType,
              status: nextStatus,
              permissionCount: countEnabledPermissions(getEffectivePermissions(user)),
              metadata: {
                previousStatus: user.status,
                nextStatus,
              },
            })
          ),
        }
      : user
  );

  assertSingleActiveMaster(nextUsers);
  await writeStoredUsers(nextUsers);

  return {
    storageMode: getStorageMode(),
    generatedAt: new Date().toISOString(),
    user: serializeUser(nextUsers.find((user) => user.id === targetUser.id)),
    users: nextUsers.map(serializeUser),
    message:
      nextStatus === "ACTIVE"
        ? "Usuario ativado com sucesso."
        : nextStatus === "PENDING"
          ? "Usuario marcado como pendente."
          : "Usuario bloqueado com sucesso.",
  };
};

const resetAdminUserPassword = async (payload = {}, actor = {}, configuredUsers = []) => {
  await ensureConfiguredAdminUsers(configuredUsers);
  const users = await readStoredUsers();
  const identifier = normalizeText(payload.id || payload.login, 160);
  const password = String(payload.password || payload.senha || "");
  const targetUser = getUserByIdOrLogin(users, identifier);

  if (!targetUser) {
    throw buildHttpError(404, "Usuario nao encontrado.", "admin_user_not_found");
  }

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw buildHttpError(
      400,
      "Informe uma nova senha com pelo menos 6 caracteres.",
      "invalid_user_password"
    );
  }

  assertCanManageUser({
    actor,
    existingUser: targetUser,
    requestedRestaurantKey: targetUser.restaurantKey,
    targetUser,
  });

  const now = new Date().toISOString();
  const nextUsers = users.map((user) =>
    user.id === targetUser.id
      ? {
          ...user,
          passwordHash: createPasswordHash(password),
          credentialMode: "TEMPORARY_PASSWORD",
          mustChangePassword:
            payload.mustChangePassword === true || payload.forcePasswordChange === true,
          invitationTokenHash: "",
          invitationExpiresAt: "",
          invitationUsedAt: "",
          updatedAt: now,
          source: "managed",
          auditTrail: appendUserAuditEvent(
            user.auditTrail,
            buildUserAuditEvent({
              action: "TEMPORARY_PASSWORD_CREATED",
              actor,
              restaurantKey: user.restaurantKey,
              userType: user.userType,
              status: user.status,
              permissionCount: countEnabledPermissions(getEffectivePermissions(user)),
              metadata: {
                mustChangePassword:
                  payload.mustChangePassword === true || payload.forcePasswordChange === true,
              },
            })
          ),
        }
      : user
  );

  await writeStoredUsers(nextUsers);

  return {
    storageMode: getStorageMode(),
    generatedAt: now,
    user: serializeUser(nextUsers.find((user) => user.id === targetUser.id)),
    users: nextUsers.map(serializeUser),
    message: "Senha redefinida com sucesso.",
  };
};

const resendAdminUserInvitation = async (payload = {}, actor = {}, configuredUsers = []) => {
  await ensureConfiguredAdminUsers(configuredUsers);
  const users = await readStoredUsers();
  const identifier = normalizeText(payload.id || payload.login, 160);
  const targetUser = getUserByIdOrLogin(users, identifier);

  if (!targetUser) {
    throw buildHttpError(404, "Usuario nao encontrado.", "admin_user_not_found");
  }

  if (targetUser.status !== "PENDING" || targetUser.credentialMode !== "INVITE") {
    throw buildHttpError(
      400,
      "Somente usuarios pendentes criados por convite podem receber um novo convite.",
      "user_invitation_not_available"
    );
  }

  assertCanManageUser({
    actor,
    existingUser: targetUser,
    requestedRestaurantKey: targetUser.restaurantKey,
    targetUser,
  });

  const now = new Date().toISOString();
  const invitationToken = createInvitationToken();
  const nextUsers = users.map((user) =>
    user.id === targetUser.id
      ? {
          ...user,
          invitationTokenHash: hashInvitationToken(invitationToken),
          invitationExpiresAt: buildInvitationExpiry(new Date(now)),
          invitationCreatedAt: now,
          invitationSentAt: "",
          invitationUsedAt: "",
          updatedAt: now,
          auditTrail: appendUserAuditEvent(
            user.auditTrail,
            buildUserAuditEvent({
              action: "INVITATION_REISSUED",
              actor,
              restaurantKey: user.restaurantKey,
              userType: user.userType,
              status: user.status,
              permissionCount: countEnabledPermissions(getEffectivePermissions(user)),
              metadata: {
                delivery: "NOT_SENT",
              },
            })
          ),
        }
      : user
  );

  await writeStoredUsers(nextUsers);

  return {
    storageMode: getStorageMode(),
    generatedAt: now,
    user: serializeUser(nextUsers.find((user) => user.id === targetUser.id)),
    invitationToken,
    message: "Novo convite gerado. O envio por e-mail ainda depende de configuracao.",
  };
};

const acceptAdminUserInvitation = async (payload = {}, configuredUsers = []) => {
  const token = String(payload.token || "").trim();
  const password = String(payload.password || payload.senha || "");

  if (!token) {
    throw buildHttpError(400, "Convite invalido.", "invalid_user_invitation");
  }

  if (!isStrongPassword(password)) {
    throw buildHttpError(
      400,
      "Use uma senha com pelo menos 10 caracteres, incluindo letras e numeros.",
      "invalid_user_password"
    );
  }

  await ensureConfiguredAdminUsers(configuredUsers);
  const users = await readStoredUsers();
  const tokenHash = hashInvitationToken(token);
  const targetUser = users.find(
    (user) =>
      user.invitationTokenHash &&
      user.invitationTokenHash.length === tokenHash.length &&
      crypto.timingSafeEqual(
        Buffer.from(user.invitationTokenHash, "utf8"),
        Buffer.from(tokenHash, "utf8")
      )
  );

  if (!targetUser) {
    throw buildHttpError(
      400,
      "Este convite e invalido ou ja foi utilizado.",
      "invalid_user_invitation"
    );
  }

  if (
    targetUser.invitationUsedAt ||
    !targetUser.invitationExpiresAt ||
    new Date(targetUser.invitationExpiresAt).getTime() <= Date.now()
  ) {
    throw buildHttpError(
      410,
      "Este convite expirou. Solicite um novo convite ao administrador.",
      "expired_user_invitation"
    );
  }

  const now = new Date().toISOString();
  const nextUsers = users.map((user) =>
    user.id === targetUser.id
      ? {
          ...user,
          passwordHash: createPasswordHash(password),
          status: "ACTIVE",
          mustChangePassword: false,
          invitationTokenHash: "",
          invitationUsedAt: now,
          updatedAt: now,
          auditTrail: appendUserAuditEvent(
            user.auditTrail,
            buildUserAuditEvent({
              action: "INVITATION_ACCEPTED",
              actor: {
                login: user.login,
                userType: user.userType,
              },
              restaurantKey: user.restaurantKey,
              userType: user.userType,
              status: "ACTIVE",
              permissionCount: countEnabledPermissions(getEffectivePermissions(user)),
              metadata: {
                previousStatus: user.status,
              },
            })
          ),
        }
      : user
  );

  await writeStoredUsers(nextUsers);

  return {
    storageMode: getStorageMode(),
    generatedAt: now,
    user: serializeUser(nextUsers.find((user) => user.id === targetUser.id)),
    message: "Senha definida e acesso ativado com sucesso.",
  };
};

const normalizeRequiredPermissionKeys = (requiredPermissions) => {
  if (!requiredPermissions) {
    return [];
  }

  const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
  return permissions.map((permission) => normalizeText(permission, 120)).filter(Boolean);
};

const assertUserHasPermission = (user, requiredPermissions) => {
  const permissionKeys = normalizeRequiredPermissionKeys(requiredPermissions);

  if (!permissionKeys.length) {
    return;
  }

  const effectivePermissions = getEffectivePermissions(user);
  const allowed = permissionKeys.some((permission) => effectivePermissions[permission] === true);

  if (!allowed) {
    throw buildHttpError(
      403,
      "Acesso negado para este modulo.",
      "admin_permission_denied",
      {
        requiredPermissions: permissionKeys,
      }
    );
  }
};

const getAdminAccessContext = async (session, requiredPermissions = [], configuredUsers = []) => {
  if (!session?.login) {
    throw buildHttpError(
      401,
      "Sessao administrativa invalida ou expirada.",
      "admin_session_required"
    );
  }

  const user = await findUserByLogin(session.login, configuredUsers);

  if (!user) {
    throw buildHttpError(
      401,
      "Usuario administrativo nao encontrado.",
      "admin_user_not_found"
    );
  }

  if (user.status !== "ACTIVE") {
    throw buildHttpError(
      403,
      user.status === "PENDING"
        ? "Seu acesso ainda esta pendente de ativacao."
        : "Usuario bloqueado.",
      user.status === "PENDING" ? "admin_user_pending" : "admin_user_blocked"
    );
  }

  assertUserHasPermission(user, requiredPermissions);

  return {
    user: serializeUser(user),
    session: {
      ...session,
      login: user.login,
      displayName: user.name || session.displayName,
      userType: user.userType,
      tipo_usuario: user.userType,
      userScope: user.userScope,
      status: user.status,
      tenantId: user.tenantId,
      restaurantId: user.restaurantId,
      restaurantKey: user.restaurantKey,
      platformScope: user.platformScope === true,
      permissions: getEffectivePermissions(user),
      permissionModules: serializePermissionModules(),
      permissionArchitecture: serializeSaasPermissionArchitecture(),
    },
  };
};

module.exports = {
  ALL_PERMISSION_KEYS,
  DEVELOPER_PERMISSION_KEYS,
  MODULE_PERMISSION_KEYS,
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  RESTAURANT_KEY,
  RESTAURANT_USER_TYPES,
  SAAS_MODULE_PERMISSIONS,
  SAAS_PERMISSION_ACTIONS,
  SAAS_PERMISSION_KEYS,
  SAAS_PERMISSION_MODULES,
  SYSTEM_USER_TYPES,
  SYSTEM_USER_HIERARCHY,
  SYSTEM_USER_MANAGEABLE_TYPES,
  USER_STATUSES,
  USER_STATUS_LABELS,
  USER_TYPES,
  USER_TYPE_LABELS,
  V1_1_USER_TYPES,
  acceptAdminUserInvitation,
  authenticateAdminUser,
  buildUsersPayload,
  createPasswordHash,
  deleteAdminUser,
  getAdminAccessContext,
  getDefaultPermissionsForType,
  getEffectivePermissions,
  hasManagedAdminUsers,
  normalizeIdentifier,
  recordAdminUserAccess,
  resendAdminUserInvitation,
  resetAdminUserPassword,
  saveAdminUser,
  serializePermissionModules,
  serializeSaasPermissionArchitecture,
  setAdminUserStatus,
  verifyPasswordHash,
};
