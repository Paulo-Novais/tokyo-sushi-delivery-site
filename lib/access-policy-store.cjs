const {
  RESTAURANT_ROLE_DEFINITIONS,
  SYSTEM_ROLE_DEFINITIONS,
  serializeAccessPolicy,
} = require("./access-policy.cjs");
const { buildHttpError } = require("./http.cjs");
const { getDatabaseScope, neon } = require("./tenant-sql.cjs");

const POLICY_ADMIN_VERSION = "2026.08.04";
let sqlClient = null;

const getStorageMode = () =>
  String(process.env.DATABASE_URL || "").trim() ? "neon" : "static";

const getSql = () => {
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
};

const normalizeDomain = (value) =>
  String(value || "").trim().toUpperCase() === "RESTAURANT"
    ? "RESTAURANT"
    : "SYSTEM";

const normalizeRoleKey = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

const staticRoleKeys = Object.freeze({
  SYSTEM: new Set(Object.keys(SYSTEM_ROLE_DEFINITIONS)),
  RESTAURANT: new Set(Object.keys(RESTAURANT_ROLE_DEFINITIONS)),
});

const SYSTEM_MASTER_REQUIRED_PERMISSIONS = Object.freeze([
  "system.dashboard.view",
  "system.users.view",
  "system.users.manage",
  "system.roles.view",
  "system.roles.manage",
]);

const hasSystemMasterIntegrity = (roles = []) => {
  const master = roles.find((role) => role.key === "MASTER");
  const permissions = new Set(master?.permissions || []);
  return SYSTEM_MASTER_REQUIRED_PERMISSIONS.every((permission) =>
    permissions.has(permission)
  );
};

const toStaticPolicy = (domain) => ({
  ...serializeAccessPolicy(domain),
  source: "static_fallback",
});

const getAccessPolicy = async (domainValue) => {
  const domain = normalizeDomain(domainValue);
  if (getStorageMode() !== "neon") return toStaticPolicy(domain);

  const sql = getSql();
  const [permissionRows, roleRows, bindingRows] = await Promise.all([
    sql`
      SELECT key, domain, module, action, risk_level, dependencies_json,
             description, version, active
      FROM permission_definitions
      WHERE domain = ${domain} AND active = TRUE
      ORDER BY module, action, key
    `,
    sql`
      SELECT DISTINCT ON (key)
        key, domain, label, authority_level, version, active, updated_at
      FROM role_definitions
      WHERE domain = ${domain} AND active = TRUE
      ORDER BY key, updated_at DESC, version DESC
    `,
    sql`
      SELECT binding.role_key, binding.role_version, binding.permission_key
      FROM role_permission_bindings AS binding
      JOIN role_definitions AS role
        ON role.domain = binding.domain
       AND role.key = binding.role_key
       AND role.version = binding.role_version
      WHERE binding.domain = ${domain} AND role.active = TRUE
      ORDER BY binding.role_key, binding.permission_key
    `,
  ]);

  let countRows = [];
  if (getDatabaseScope().audience === "system") {
    countRows =
      domain === "SYSTEM"
        ? await sql`
            SELECT binding.role_key, COUNT(*)::int AS user_count
            FROM system_role_bindings AS binding
            JOIN system_principals AS principal ON principal.id = binding.principal_id
            WHERE binding.revoked_at IS NULL AND principal.status = 'ACTIVE'
            GROUP BY binding.role_key
          `
        : await sql`
            SELECT binding.role_key, COUNT(*)::int AS user_count
            FROM restaurant_role_bindings AS binding
            JOIN restaurant_memberships AS membership ON membership.id = binding.membership_id
            WHERE binding.revoked_at IS NULL AND membership.status = 'ACTIVE'
            GROUP BY binding.role_key
          `;
  }

  if (!permissionRows.length || !roleRows.length) return toStaticPolicy(domain);
  const permissions = permissionRows.map((row) => ({
    key: row.key,
    domain: row.domain,
    module: row.module,
    action: row.action,
    riskLevel: row.risk_level,
    dependencies: Array.isArray(row.dependencies_json)
      ? row.dependencies_json
      : [],
    description: row.description,
    version: row.version,
    active: row.active,
  }));
  const bindings = new Map();
  for (const row of bindingRows) {
    const compoundKey = `${row.role_key}:${row.role_version}`;
    if (!bindings.has(compoundKey)) bindings.set(compoundKey, []);
    bindings.get(compoundKey).push(row.permission_key);
  }
  const roles = roleRows.map((row) => ({
    key: row.key,
    label: row.label,
    authority: Number(row.authority_level || 0),
    version: row.version,
    permissions: bindings.get(`${row.key}:${row.version}`) || [],
    custom: !staticRoleKeys[domain].has(row.key),
    userCount: Number(
      countRows.find((entry) => entry.role_key === row.key)?.user_count || 0
    ),
  }));

  // A partially seeded persistent catalog must fail closed to the reviewed
  // built-in policy instead of locking every platform administrator out.
  if (domain === "SYSTEM" && !hasSystemMasterIntegrity(roles)) {
    return {
      ...toStaticPolicy(domain),
      source: "static_integrity_fallback",
    };
  }

  return {
    version: POLICY_ADMIN_VERSION,
    domain,
    permissions,
    roles,
    source: "database",
  };
};

const assertDependencies = (policy, permissions) => {
  const allowed = new Set(policy.permissions.map((entry) => entry.key));
  const selected = new Set(
    [...new Set(Array.isArray(permissions) ? permissions : [])].filter((key) =>
      allowed.has(key)
    )
  );
  for (const definition of policy.permissions) {
    if (!selected.has(definition.key)) continue;
    const missing = (definition.dependencies || []).find(
      (dependency) => !selected.has(dependency)
    );
    if (missing) {
      throw buildHttpError(
        422,
        `A permissão ${definition.key} exige ${missing}.`,
        "permission_dependency_missing",
        { permission: definition.key, requiredPermission: missing }
      );
    }
  }
  return [...selected];
};

const resolveEffectivePermissionSet = async ({
  domain,
  role,
  grantOverrides = [],
  denyOverrides = [],
}) => {
  const policy = await getAccessPolicy(domain);
  const roleDefinition = policy.roles.find(
    (entry) => entry.key === normalizeRoleKey(role)
  );
  if (!roleDefinition) return [];
  const denied = new Set(denyOverrides);
  return assertDependencies(
    policy,
    [...new Set([...roleDefinition.permissions, ...grantOverrides])].filter(
      (permission) => !denied.has(permission)
    )
  );
};

const saveRoleDefinition = async ({
  domain: domainValue,
  key: rawKey,
  label,
  authority = 0,
  permissions = [],
}) => {
  if (getStorageMode() !== "neon") {
    throw buildHttpError(
      503,
      "A edição de perfis exige o banco configurado.",
      "role_storage_unavailable"
    );
  }
  const domain = normalizeDomain(domainValue);
  const key = normalizeRoleKey(rawKey);
  const normalizedLabel = String(label || "").trim().slice(0, 120);
  const authorityLevel = Math.max(0, Math.min(100, Number(authority || 0)));
  if (!key || !normalizedLabel) {
    throw buildHttpError(422, "Chave e nome do perfil são obrigatórios.", "role_invalid");
  }
  const policy = await getAccessPolicy(domain);
  const selectedPermissions = assertDependencies(policy, permissions);
  if (
    domain === "SYSTEM" &&
    key === "MASTER" &&
    !["system.dashboard.view", "system.users.manage", "system.roles.view", "system.roles.manage"].every(
      (permission) => selectedPermissions.includes(permission)
    )
  ) {
    throw buildHttpError(
      409,
      "O perfil MASTER deve preservar as permissões críticas de administração.",
      "master_role_invariant"
    );
  }

  const sql = getSql();
  const queries = [
    sql`
      INSERT INTO role_definitions (
        key, domain, label, authority_level, version, active, created_at, updated_at
      ) VALUES (
        ${key}, ${domain}, ${normalizedLabel}, ${authorityLevel},
        ${POLICY_ADMIN_VERSION}, TRUE, NOW(), NOW()
      )
      ON CONFLICT (domain, key, version)
      DO UPDATE SET
        label = EXCLUDED.label,
        authority_level = EXCLUDED.authority_level,
        active = TRUE,
        updated_at = NOW()
    `,
    sql`
      DELETE FROM role_permission_bindings
      WHERE domain = ${domain}
        AND role_key = ${key}
        AND role_version = ${POLICY_ADMIN_VERSION}
    `,
    ...selectedPermissions.map(
      (permission) => sql`
        INSERT INTO role_permission_bindings (
          domain, role_key, role_version, permission_key, created_at
        ) VALUES (
          ${domain}, ${key}, ${POLICY_ADMIN_VERSION}, ${permission}, NOW()
        )
        ON CONFLICT DO NOTHING
      `
    ),
  ];
  await sql.transaction(queries);
  return getAccessPolicy(domain);
};

const deactivateCustomRole = async ({ domain: domainValue, key: rawKey }) => {
  const domain = normalizeDomain(domainValue);
  const key = normalizeRoleKey(rawKey);
  if (staticRoleKeys[domain].has(key)) {
    throw buildHttpError(
      409,
      "Perfis padrão podem ser editados, mas não removidos.",
      "default_role_removal_denied"
    );
  }
  const sql = getSql();
  await sql`
    UPDATE role_definitions
    SET active = FALSE, updated_at = NOW()
    WHERE domain = ${domain} AND key = ${key}
  `;
  return getAccessPolicy(domain);
};

module.exports = {
  POLICY_ADMIN_VERSION,
  deactivateCustomRole,
  getAccessPolicy,
  hasSystemMasterIntegrity,
  resolveEffectivePermissionSet,
  saveRoleDefinition,
};
