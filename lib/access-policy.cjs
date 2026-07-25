const { buildHttpError } = require("./http.cjs");

const POLICY_VERSION = "2026.07.25";

const definePermission = (
  key,
  domain,
  module,
  action,
  description,
  { riskLevel = "LOW", dependencies = [] } = {}
) =>
  Object.freeze({
    key,
    domain,
    module,
    action,
    riskLevel,
    dependencies: Object.freeze([...dependencies]),
    description,
    version: POLICY_VERSION,
    active: true,
  });

const SYSTEM_PERMISSION_DEFINITIONS = Object.freeze([
  definePermission("system.dashboard.view", "SYSTEM", "dashboard", "view", "Visualizar o painel da plataforma."),
  definePermission("system.restaurants.view", "SYSTEM", "restaurants", "view", "Visualizar cadastros e saúde dos restaurantes."),
  definePermission(
    "system.restaurants.create",
    "SYSTEM",
    "restaurants",
    "create",
    "Cadastrar e provisionar restaurantes.",
    { riskLevel: "HIGH", dependencies: ["system.restaurants.view"] }
  ),
  definePermission(
    "system.restaurants.edit",
    "SYSTEM",
    "restaurants",
    "edit",
    "Editar metadados de plataforma de restaurantes.",
    { riskLevel: "HIGH", dependencies: ["system.restaurants.view"] }
  ),
  definePermission(
    "system.restaurants.suspend",
    "SYSTEM",
    "restaurants",
    "suspend",
    "Suspender o acesso de um restaurante.",
    { riskLevel: "CRITICAL", dependencies: ["system.restaurants.view"] }
  ),
  definePermission("system.plans.manage", "SYSTEM", "plans", "manage", "Administrar planos e recursos.", {
    riskLevel: "HIGH",
  }),
  definePermission("system.domains.manage", "SYSTEM", "domains", "manage", "Administrar domínios e certificados.", {
    riskLevel: "HIGH",
  }),
  definePermission("system.health.view", "SYSTEM", "health", "view", "Visualizar saúde técnica agregada."),
  definePermission("system.audit.view", "SYSTEM", "audit", "view", "Visualizar auditoria da plataforma.", {
    riskLevel: "MEDIUM",
  }),
  definePermission("system.users.view", "SYSTEM", "users", "view", "Visualizar usuários internos."),
  definePermission("system.users.manage", "SYSTEM", "users", "manage", "Administrar usuários internos.", {
    riskLevel: "CRITICAL",
    dependencies: ["system.users.view"],
  }),
  definePermission("system.support.start", "SYSTEM", "support", "start", "Iniciar suporte em modo de visualização.", {
    riskLevel: "HIGH",
    dependencies: ["system.restaurants.view"],
  }),
  definePermission("system.support.admin", "SYSTEM", "support", "admin", "Iniciar suporte administrativo controlado.", {
    riskLevel: "CRITICAL",
    dependencies: ["system.support.start"],
  }),
  definePermission("system.billing.view", "SYSTEM", "billing", "view", "Visualizar faturamento da plataforma."),
  definePermission("system.billing.manage", "SYSTEM", "billing", "manage", "Administrar faturamento da plataforma.", {
    riskLevel: "CRITICAL",
    dependencies: ["system.billing.view"],
  }),
]);

const RESTAURANT_PERMISSION_DEFINITIONS = Object.freeze([
  definePermission("tenant.dashboard.view", "RESTAURANT", "dashboard", "view", "Visualizar o painel do restaurante."),
  definePermission("tenant.orders.view", "RESTAURANT", "orders", "view", "Visualizar pedidos."),
  definePermission("tenant.orders.edit", "RESTAURANT", "orders", "edit", "Atualizar pedidos.", {
    riskLevel: "HIGH",
    dependencies: ["tenant.orders.view"],
  }),
  definePermission("tenant.customers.view", "RESTAURANT", "customers", "view", "Visualizar clientes.", {
    riskLevel: "MEDIUM",
  }),
  definePermission("tenant.catalog.view", "RESTAURANT", "catalog", "view", "Visualizar o cardápio."),
  definePermission("tenant.catalog.edit", "RESTAURANT", "catalog", "edit", "Editar o cardápio.", {
    riskLevel: "HIGH",
    dependencies: ["tenant.catalog.view"],
  }),
  definePermission("tenant.inventory.view", "RESTAURANT", "inventory", "view", "Visualizar estoque."),
  definePermission("tenant.inventory.edit", "RESTAURANT", "inventory", "edit", "Editar estoque.", {
    riskLevel: "HIGH",
    dependencies: ["tenant.inventory.view"],
  }),
  definePermission("tenant.financial.view", "RESTAURANT", "financial", "view", "Visualizar dados financeiros.", {
    riskLevel: "HIGH",
  }),
  definePermission("tenant.financial.edit", "RESTAURANT", "financial", "edit", "Editar dados financeiros.", {
    riskLevel: "CRITICAL",
    dependencies: ["tenant.financial.view"],
  }),
  definePermission("tenant.delivery.view", "RESTAURANT", "delivery", "view", "Visualizar entregas."),
  definePermission("tenant.delivery.edit", "RESTAURANT", "delivery", "edit", "Administrar entregas.", {
    riskLevel: "HIGH",
    dependencies: ["tenant.delivery.view"],
  }),
  definePermission("tenant.reports.view", "RESTAURANT", "reports", "view", "Visualizar relatórios."),
  definePermission("tenant.reports.export", "RESTAURANT", "reports", "export", "Exportar relatórios.", {
    riskLevel: "HIGH",
    dependencies: ["tenant.reports.view"],
  }),
  definePermission("tenant.settings.view", "RESTAURANT", "settings", "view", "Visualizar configurações."),
  definePermission("tenant.settings.edit", "RESTAURANT", "settings", "edit", "Editar configurações.", {
    riskLevel: "CRITICAL",
    dependencies: ["tenant.settings.view"],
  }),
  definePermission("tenant.users.view", "RESTAURANT", "users", "view", "Visualizar a equipe."),
  definePermission("tenant.users.manage", "RESTAURANT", "users", "manage", "Administrar a equipe.", {
    riskLevel: "CRITICAL",
    dependencies: ["tenant.users.view"],
  }),
  definePermission("tenant.audit.view", "RESTAURANT", "audit", "view", "Visualizar auditoria do restaurante.", {
    riskLevel: "MEDIUM",
  }),
]);

const permissionKeys = (definitions) => definitions.map(({ key }) => key);
const ALL_SYSTEM_PERMISSIONS = Object.freeze(permissionKeys(SYSTEM_PERMISSION_DEFINITIONS));
const ALL_RESTAURANT_PERMISSIONS = Object.freeze(
  permissionKeys(RESTAURANT_PERMISSION_DEFINITIONS)
);

const without = (source, denied) =>
  source.filter((permission) => !new Set(denied).has(permission));

const SYSTEM_ROLE_DEFINITIONS = Object.freeze({
  MASTER: Object.freeze({
    key: "MASTER",
    label: "Master",
    authority: 100,
    permissions: ALL_SYSTEM_PERMISSIONS,
  }),
  SOCIO: Object.freeze({
    key: "SOCIO",
    label: "Sócio",
    authority: 90,
    permissions: without(ALL_SYSTEM_PERMISSIONS, [
      "system.users.manage",
      "system.billing.manage",
    ]),
  }),
  SUPORTE: Object.freeze({
    key: "SUPORTE",
    label: "Suporte",
    authority: 50,
    permissions: Object.freeze([
      "system.dashboard.view",
      "system.restaurants.view",
      "system.health.view",
      "system.audit.view",
      "system.support.start",
    ]),
  }),
  DESENVOLVEDOR: Object.freeze({
    key: "DESENVOLVEDOR",
    label: "Desenvolvedor",
    authority: 60,
    permissions: Object.freeze([
      "system.dashboard.view",
      "system.restaurants.view",
      "system.health.view",
      "system.audit.view",
      "system.support.start",
      "system.support.admin",
    ]),
  }),
  COMERCIAL: Object.freeze({
    key: "COMERCIAL",
    label: "Comercial",
    authority: 30,
    permissions: Object.freeze([
      "system.dashboard.view",
      "system.restaurants.view",
      "system.restaurants.create",
      "system.plans.manage",
    ]),
  }),
  FINANCEIRO_INOVAS: Object.freeze({
    key: "FINANCEIRO_INOVAS",
    label: "Financeiro INOVAS",
    authority: 40,
    permissions: Object.freeze([
      "system.dashboard.view",
      "system.restaurants.view",
      "system.billing.view",
      "system.billing.manage",
    ]),
  }),
  IMPLANTACAO: Object.freeze({
    key: "IMPLANTACAO",
    label: "Implantação",
    authority: 40,
    permissions: Object.freeze([
      "system.dashboard.view",
      "system.restaurants.view",
      "system.restaurants.create",
      "system.restaurants.edit",
      "system.domains.manage",
      "system.health.view",
    ]),
  }),
  CUSTOMER_SUCCESS: Object.freeze({
    key: "CUSTOMER_SUCCESS",
    label: "Customer Success",
    authority: 35,
    permissions: Object.freeze([
      "system.dashboard.view",
      "system.restaurants.view",
      "system.health.view",
      "system.support.start",
    ]),
  }),
  AUDITOR: Object.freeze({
    key: "AUDITOR",
    label: "Auditor",
    authority: 20,
    permissions: Object.freeze([
      "system.dashboard.view",
      "system.restaurants.view",
      "system.health.view",
      "system.audit.view",
      "system.billing.view",
      "system.users.view",
    ]),
  }),
});

const RESTAURANT_ROLE_DEFINITIONS = Object.freeze({
  OWNER: Object.freeze({
    key: "OWNER",
    label: "Proprietário",
    authority: 100,
    permissions: ALL_RESTAURANT_PERMISSIONS,
  }),
  ADMIN: Object.freeze({
    key: "ADMIN",
    label: "Administrador",
    authority: 90,
    permissions: without(ALL_RESTAURANT_PERMISSIONS, ["tenant.financial.edit"]),
  }),
  MANAGER: Object.freeze({
    key: "MANAGER",
    label: "Gerente",
    authority: 75,
    permissions: without(ALL_RESTAURANT_PERMISSIONS, [
      "tenant.financial.edit",
      "tenant.settings.edit",
      "tenant.users.manage",
    ]),
  }),
  CASHIER: Object.freeze({
    key: "CASHIER",
    label: "Caixa",
    authority: 35,
    permissions: Object.freeze([
      "tenant.dashboard.view",
      "tenant.orders.view",
      "tenant.orders.edit",
      "tenant.customers.view",
      "tenant.financial.view",
    ]),
  }),
  SERVICE: Object.freeze({
    key: "SERVICE",
    label: "Atendimento",
    authority: 30,
    permissions: Object.freeze([
      "tenant.dashboard.view",
      "tenant.orders.view",
      "tenant.orders.edit",
      "tenant.customers.view",
      "tenant.delivery.view",
    ]),
  }),
  KITCHEN: Object.freeze({
    key: "KITCHEN",
    label: "Cozinha",
    authority: 25,
    permissions: Object.freeze([
      "tenant.dashboard.view",
      "tenant.orders.view",
      "tenant.orders.edit",
      "tenant.catalog.view",
    ]),
  }),
  INVENTORY: Object.freeze({
    key: "INVENTORY",
    label: "Estoque",
    authority: 30,
    permissions: Object.freeze([
      "tenant.dashboard.view",
      "tenant.catalog.view",
      "tenant.inventory.view",
      "tenant.inventory.edit",
    ]),
  }),
  FINANCE: Object.freeze({
    key: "FINANCE",
    label: "Financeiro",
    authority: 45,
    permissions: Object.freeze([
      "tenant.dashboard.view",
      "tenant.financial.view",
      "tenant.reports.view",
      "tenant.reports.export",
    ]),
  }),
  DELIVERY: Object.freeze({
    key: "DELIVERY",
    label: "Entrega",
    authority: 20,
    permissions: Object.freeze([
      "tenant.dashboard.view",
      "tenant.orders.view",
      "tenant.orders.edit",
      "tenant.delivery.view",
      "tenant.delivery.edit",
    ]),
  }),
  READ_ONLY: Object.freeze({
    key: "READ_ONLY",
    label: "Somente leitura",
    authority: 10,
    permissions: Object.freeze(
      ALL_RESTAURANT_PERMISSIONS.filter((permission) => permission.endsWith(".view"))
    ),
  }),
  CUSTOM: Object.freeze({
    key: "CUSTOM",
    label: "Personalizado",
    authority: 0,
    permissions: Object.freeze([]),
  }),
});

const LEGACY_SYSTEM_ROLE_MAP = Object.freeze({
  MASTER: "MASTER",
  SOCIO: "SOCIO",
  SUPORTE: "SUPORTE",
  DESENVOLVEDOR: "DESENVOLVEDOR",
  VENDEDOR: "COMERCIAL",
  COMERCIAL: "COMERCIAL",
});

const LEGACY_RESTAURANT_ROLE_MAP = Object.freeze({
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
});

const RESTAURANT_ROLE_LEGACY_MAP = Object.freeze({
  OWNER: "OWNER",
  ADMIN: "GERENTE",
  MANAGER: "GERENTE",
  CASHIER: "CAIXA",
  SERVICE: "ATENDENTE",
  KITCHEN: "COZINHA",
  INVENTORY: "ESTOQUE",
  FINANCE: "FINANCEIRO",
  DELIVERY: "ENTREGADOR",
  READ_ONLY: "CUSTOM",
  CUSTOM: "CUSTOM",
});

const SYSTEM_ROLE_LEGACY_MAP = Object.freeze({
  MASTER: "MASTER",
  SOCIO: "SOCIO",
  SUPORTE: "SUPORTE",
  DESENVOLVEDOR: "DESENVOLVEDOR",
  COMERCIAL: "VENDEDOR",
  FINANCEIRO_INOVAS: "CUSTOM",
  IMPLANTACAO: "CUSTOM",
  CUSTOMER_SUCCESS: "CUSTOM",
  AUDITOR: "CUSTOM",
});

const LEGACY_RESTAURANT_PERMISSION_MAP = Object.freeze({
  dashboard_view: "tenant.dashboard.view",
  orders_view: "tenant.orders.view",
  orders_edit: "tenant.orders.edit",
  customers_view: "tenant.customers.view",
  catalog_view: "tenant.catalog.view",
  catalog_edit: "tenant.catalog.edit",
  inventory_view: "tenant.inventory.view",
  inventory_edit: "tenant.inventory.edit",
  financial_view: "tenant.financial.view",
  financial_edit: "tenant.financial.edit",
  delivery_view: "tenant.delivery.view",
  delivery_edit: "tenant.delivery.edit",
  reports_view: "tenant.reports.view",
  exports_view: "tenant.reports.export",
  settings_view: "tenant.settings.view",
  settings_edit: "tenant.settings.edit",
  users_view: "tenant.users.view",
  users_edit: "tenant.users.manage",
  users_create: "tenant.users.manage",
  users_delete: "tenant.users.manage",
});

const getRoleDefinition = (domain, role) => {
  const normalizedDomain = String(domain || "").trim().toUpperCase();
  const normalizedRole = String(role || "").trim().toUpperCase();
  const roles =
    normalizedDomain === "SYSTEM"
      ? SYSTEM_ROLE_DEFINITIONS
      : RESTAURANT_ROLE_DEFINITIONS;
  return roles[normalizedRole] || null;
};

const normalizePermissionSet = (domain, permissions = []) => {
  const allowed = new Set(
    domain === "SYSTEM" ? ALL_SYSTEM_PERMISSIONS : ALL_RESTAURANT_PERMISSIONS
  );
  return [...new Set(Array.isArray(permissions) ? permissions : [])].filter(
    (permission) => allowed.has(permission)
  );
};

const assertPermissionDependencies = (domain, permissions = []) => {
  const normalized = normalizePermissionSet(domain, permissions);
  const selected = new Set(normalized);
  const definitions =
    domain === "SYSTEM"
      ? SYSTEM_PERMISSION_DEFINITIONS
      : RESTAURANT_PERMISSION_DEFINITIONS;

  definitions.forEach((definition) => {
    if (!selected.has(definition.key)) {
      return;
    }

    const missingDependency = definition.dependencies.find(
      (dependency) => !selected.has(dependency)
    );

    if (missingDependency) {
      throw buildHttpError(
        422,
        `A permissão ${definition.key} exige ${missingDependency}.`,
        "permission_dependency_missing",
        {
          permission: definition.key,
          requiredPermission: missingDependency,
        }
      );
    }
  });

  return normalized;
};

const buildEffectivePermissionSet = ({
  domain,
  role,
  grantOverrides = [],
  denyOverrides = [],
}) => {
  const roleDefinition = getRoleDefinition(domain, role);
  const basePermissions = roleDefinition?.permissions || [];
  const grants = normalizePermissionSet(domain, grantOverrides);
  const denies = new Set(normalizePermissionSet(domain, denyOverrides));
  return assertPermissionDependencies(
    domain,
    [...new Set([...basePermissions, ...grants])].filter(
      (permission) => !denies.has(permission)
    )
  );
};

const assertPermission = (principal, requiredPermission) => {
  const permission = String(requiredPermission || "").trim();
  const effectivePermissions = new Set(
    principal?.effectivePermissions || principal?.permissions || []
  );

  if (!permission || !effectivePermissions.has(permission)) {
    throw buildHttpError(403, "Acesso negado.", "permission_denied", {
      requiredPermission: permission,
    });
  }
};

const assertCanManageRole = ({ domain, actorRole, targetRole }) => {
  const actor = getRoleDefinition(domain, actorRole);
  const target = getRoleDefinition(domain, targetRole);

  if (!actor || !target || actor.authority <= target.authority) {
    throw buildHttpError(
      403,
      "Não é permitido atribuir ou administrar um perfil de autoridade igual ou superior.",
      "role_authority_denied",
      {
        actorRole,
        targetRole,
      }
    );
  }
};

const serializeAccessPolicy = (domain) => {
  const normalizedDomain = String(domain || "").trim().toUpperCase();
  const definitions =
    normalizedDomain === "SYSTEM"
      ? SYSTEM_PERMISSION_DEFINITIONS
      : RESTAURANT_PERMISSION_DEFINITIONS;
  const roles =
    normalizedDomain === "SYSTEM"
      ? SYSTEM_ROLE_DEFINITIONS
      : RESTAURANT_ROLE_DEFINITIONS;

  return {
    version: POLICY_VERSION,
    domain: normalizedDomain,
    permissions: definitions,
    roles: Object.values(roles),
  };
};

const SUPPORT_VIEW_ACTION_ALLOWLIST = Object.freeze([
  "tenant.health.read",
  "tenant.integrations.read",
  "tenant.settings.read",
  "tenant.audit.read",
]);

const SUPPORT_ADMIN_ACTION_ALLOWLIST = Object.freeze([
  ...SUPPORT_VIEW_ACTION_ALLOWLIST,
  "tenant.settings.update",
  "tenant.integrations.retry",
  "tenant.users.read",
  "tenant.users.update",
]);

module.exports = {
  ALL_RESTAURANT_PERMISSIONS,
  ALL_SYSTEM_PERMISSIONS,
  LEGACY_RESTAURANT_PERMISSION_MAP,
  LEGACY_RESTAURANT_ROLE_MAP,
  LEGACY_SYSTEM_ROLE_MAP,
  POLICY_VERSION,
  RESTAURANT_PERMISSION_DEFINITIONS,
  RESTAURANT_ROLE_DEFINITIONS,
  RESTAURANT_ROLE_LEGACY_MAP,
  SUPPORT_ADMIN_ACTION_ALLOWLIST,
  SUPPORT_VIEW_ACTION_ALLOWLIST,
  SYSTEM_PERMISSION_DEFINITIONS,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_LEGACY_MAP,
  assertCanManageRole,
  assertPermission,
  assertPermissionDependencies,
  buildEffectivePermissionSet,
  getRoleDefinition,
  normalizePermissionSet,
  serializeAccessPolicy,
};
