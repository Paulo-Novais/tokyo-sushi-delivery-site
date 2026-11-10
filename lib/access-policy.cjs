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
  definePermission("system.integrations.view", "SYSTEM", "integrations", "view", "Visualizar integrações da plataforma."),
  definePermission("system.integrations.manage", "SYSTEM", "integrations", "manage", "Configurar integrações da plataforma.", {
    riskLevel: "CRITICAL",
    dependencies: ["system.integrations.view"],
  }),
  definePermission("system.users.view", "SYSTEM", "users", "view", "Visualizar usuários internos."),
  definePermission("system.users.manage", "SYSTEM", "users", "manage", "Administrar usuários internos.", {
    riskLevel: "CRITICAL",
    dependencies: ["system.users.view"],
  }),
  definePermission("system.roles.view", "SYSTEM", "roles", "view", "Visualizar perfis e permissões."),
  definePermission("system.roles.manage", "SYSTEM", "roles", "manage", "Administrar perfis e permissões.", {
    riskLevel: "CRITICAL",
    dependencies: ["system.roles.view"],
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
  definePermission("system.settings.view", "SYSTEM", "settings", "view", "Visualizar configurações da plataforma."),
  definePermission("system.settings.manage", "SYSTEM", "settings", "manage", "Administrar configurações da plataforma.", {
    riskLevel: "CRITICAL",
    dependencies: ["system.settings.view"],
  }),
]);

const BASE_RESTAURANT_PERMISSION_DEFINITIONS = Object.freeze([
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
  definePermission("tenant.cash_register.view", "RESTAURANT", "cash_register", "view", "Visualizar Caixa e Salão.", {
    riskLevel: "MEDIUM",
  }),
  definePermission("tenant.cash_register.configure", "RESTAURANT", "cash_register", "configure", "Configurar mesas do salão.", {
    riskLevel: "HIGH",
    dependencies: ["tenant.cash_register.view"],
  }),
  definePermission("tenant.cash_register.open", "RESTAURANT", "cash_register", "open", "Abrir caixa.", {
    riskLevel: "HIGH",
    dependencies: ["tenant.cash_register.view"],
  }),
  definePermission("tenant.cash_register.close", "RESTAURANT", "cash_register", "close", "Fechar caixa.", {
    riskLevel: "CRITICAL",
    dependencies: ["tenant.cash_register.view"],
  }),
  definePermission("tenant.cash_register.open_tab", "RESTAURANT", "cash_register", "open_tab", "Abrir comanda.", {
    riskLevel: "HIGH",
    dependencies: ["tenant.cash_register.view"],
  }),
  definePermission("tenant.cash_register.add_item", "RESTAURANT", "cash_register", "add_item", "Adicionar e editar itens da comanda.", {
    riskLevel: "HIGH",
    dependencies: ["tenant.cash_register.view"],
  }),
  definePermission("tenant.cash_register.send_order", "RESTAURANT", "cash_register", "send_order", "Enviar pedido para produção.", {
    riskLevel: "HIGH",
    dependencies: ["tenant.cash_register.view"],
  }),
  definePermission("tenant.cash_register.discount", "RESTAURANT", "cash_register", "discount", "Aplicar desconto.", {
    riskLevel: "CRITICAL",
    dependencies: ["tenant.cash_register.view"],
  }),
  definePermission("tenant.cash_register.remove_service", "RESTAURANT", "cash_register", "remove_service", "Remover taxa de serviço.", {
    riskLevel: "HIGH",
    dependencies: ["tenant.cash_register.view"],
  }),
  definePermission("tenant.cash_register.close_tab", "RESTAURANT", "cash_register", "close_tab", "Fechar conta.", {
    riskLevel: "CRITICAL",
    dependencies: ["tenant.cash_register.view"],
  }),
  definePermission("tenant.cash_register.confirm_payment", "RESTAURANT", "cash_register", "confirm_payment", "Confirmar pagamento.", {
    riskLevel: "CRITICAL",
    dependencies: ["tenant.cash_register.view"],
  }),
  definePermission("tenant.cash_register.history", "RESTAURANT", "cash_register", "history", "Visualizar histórico do caixa.", {
    riskLevel: "MEDIUM",
    dependencies: ["tenant.cash_register.view"],
  }),
]);

const EXTRA_RESTAURANT_PERMISSION_DEFINITIONS = Object.freeze([
  definePermission("tenant.orders.create", "RESTAURANT", "orders", "create", "Criar pedidos.", { riskLevel: "HIGH", dependencies: ["tenant.orders.view"] }),
  definePermission("tenant.orders.cancel", "RESTAURANT", "orders", "cancel", "Cancelar pedidos.", { riskLevel: "HIGH", dependencies: ["tenant.orders.view"] }),
  definePermission("tenant.orders.delete", "RESTAURANT", "orders", "delete", "Excluir pedidos.", { riskLevel: "CRITICAL", dependencies: ["tenant.orders.view"] }),
  definePermission("tenant.customers.create", "RESTAURANT", "customers", "create", "Cadastrar clientes.", { dependencies: ["tenant.customers.view"] }),
  definePermission("tenant.customers.edit", "RESTAURANT", "customers", "edit", "Editar clientes.", { riskLevel: "MEDIUM", dependencies: ["tenant.customers.view"] }),
  definePermission("tenant.customers.delete", "RESTAURANT", "customers", "delete", "Excluir clientes.", { riskLevel: "HIGH", dependencies: ["tenant.customers.view"] }),
  definePermission("tenant.catalog.create", "RESTAURANT", "catalog", "create", "Criar produtos e seções.", { riskLevel: "HIGH", dependencies: ["tenant.catalog.view"] }),
  definePermission("tenant.catalog.delete", "RESTAURANT", "catalog", "delete", "Excluir produtos e seções.", { riskLevel: "CRITICAL", dependencies: ["tenant.catalog.view"] }),
  definePermission("tenant.promotions.view", "RESTAURANT", "promotions", "view", "Visualizar promoções."),
  definePermission("tenant.promotions.create", "RESTAURANT", "promotions", "create", "Criar promoções.", { riskLevel: "HIGH", dependencies: ["tenant.promotions.view"] }),
  definePermission("tenant.promotions.edit", "RESTAURANT", "promotions", "edit", "Editar promoções.", { riskLevel: "HIGH", dependencies: ["tenant.promotions.view"] }),
  definePermission("tenant.promotions.delete", "RESTAURANT", "promotions", "delete", "Excluir promoções.", { riskLevel: "CRITICAL", dependencies: ["tenant.promotions.view"] }),
  definePermission("tenant.reviews.view", "RESTAURANT", "reviews", "view", "Visualizar avaliações."),
  definePermission("tenant.reviews.edit", "RESTAURANT", "reviews", "edit", "Moderar avaliações.", { riskLevel: "MEDIUM", dependencies: ["tenant.reviews.view"] }),
  definePermission("tenant.reviews.delete", "RESTAURANT", "reviews", "delete", "Excluir avaliações.", { riskLevel: "HIGH", dependencies: ["tenant.reviews.view"] }),
  definePermission("tenant.inventory.create", "RESTAURANT", "inventory", "create", "Cadastrar itens de estoque.", { riskLevel: "HIGH", dependencies: ["tenant.inventory.view"] }),
  definePermission("tenant.inventory.delete", "RESTAURANT", "inventory", "delete", "Excluir itens de estoque.", { riskLevel: "CRITICAL", dependencies: ["tenant.inventory.view"] }),
  definePermission("tenant.financial.create", "RESTAURANT", "financial", "create", "Lançar movimentações financeiras.", { riskLevel: "HIGH", dependencies: ["tenant.financial.view"] }),
  definePermission("tenant.financial.refund", "RESTAURANT", "financial", "refund", "Estornar pagamentos.", { riskLevel: "CRITICAL", dependencies: ["tenant.financial.view"] }),
  definePermission("tenant.users.create", "RESTAURANT", "users", "create", "Criar usuários.", { riskLevel: "HIGH", dependencies: ["tenant.users.view"] }),
  definePermission("tenant.users.edit", "RESTAURANT", "users", "edit", "Editar usuários.", { riskLevel: "HIGH", dependencies: ["tenant.users.view"] }),
  definePermission("tenant.users.delete", "RESTAURANT", "users", "delete", "Excluir usuários.", { riskLevel: "CRITICAL", dependencies: ["tenant.users.view"] }),
  definePermission("tenant.users.permissions", "RESTAURANT", "users", "permissions", "Alterar perfis e permissões dos usuários.", { riskLevel: "CRITICAL", dependencies: ["tenant.users.view"] }),
  definePermission("tenant.business_hours.view", "RESTAURANT", "business_hours", "view", "Visualizar horários."),
  definePermission("tenant.business_hours.edit", "RESTAURANT", "business_hours", "edit", "Editar horários.", { riskLevel: "HIGH", dependencies: ["tenant.business_hours.view"] }),
  definePermission("tenant.special_dates.view", "RESTAURANT", "special_dates", "view", "Visualizar datas especiais."),
  definePermission("tenant.special_dates.create", "RESTAURANT", "special_dates", "create", "Criar datas especiais.", { dependencies: ["tenant.special_dates.view"] }),
  definePermission("tenant.special_dates.edit", "RESTAURANT", "special_dates", "edit", "Editar datas especiais.", { dependencies: ["tenant.special_dates.view"] }),
  definePermission("tenant.special_dates.delete", "RESTAURANT", "special_dates", "delete", "Excluir datas especiais.", { riskLevel: "HIGH", dependencies: ["tenant.special_dates.view"] }),
]);

const RESTAURANT_NAVIGATION_ITEMS = Object.freeze([
  ["dashboard", "Painel"],
  ["users", "Usuários"],
  ["cash_register", "Caixa"],
  ["orders", "Pedidos"],
  ["catalog", "Cardápio"],
  ["scheduled", "Agendamentos"],
  ["delivery", "Entregas"],
  ["customers", "Clientes"],
  ["promotions", "Promoções"],
  ["metrics", "Métricas"],
  ["reports", "Relatórios"],
  ["financial", "Financeiro"],
  ["reviews", "Avaliações"],
  ["settings", "Configurações"],
  ["inventory", "Estoque"],
  ["printing", "Impressão"],
  ["production", "Produção"],
  ["tables", "Mesas"],
  ["dining_room", "Salão"],
  ["delivery_channel", "Delivery"],
  ["loyalty", "Fidelidade"],
  ["coupons", "Cupons"],
  ["marketing", "Marketing"],
  ["api", "API"],
  ["integrations", "Integrações"],
]);

const RESTAURANT_NAVIGATION_PERMISSION_DEFINITIONS = Object.freeze(
  RESTAURANT_NAVIGATION_ITEMS.map(([key, label]) =>
    definePermission(
      `tenant.navigation.${key}`,
      "RESTAURANT",
      "navigation",
      key,
      `Exibir ${label} no menu lateral do restaurante.`
    )
  )
);

const RESTAURANT_PERMISSION_DEFINITIONS = Object.freeze([
  ...BASE_RESTAURANT_PERMISSION_DEFINITIONS,
  ...EXTRA_RESTAURANT_PERMISSION_DEFINITIONS,
  ...RESTAURANT_NAVIGATION_PERMISSION_DEFINITIONS,
]);

const permissionKeys = (definitions) => definitions.map(({ key }) => key);
const ALL_SYSTEM_PERMISSIONS = Object.freeze(permissionKeys(SYSTEM_PERMISSION_DEFINITIONS));
const ALL_RESTAURANT_OPERATION_PERMISSIONS = Object.freeze(
  permissionKeys([
    ...BASE_RESTAURANT_PERMISSION_DEFINITIONS,
    ...EXTRA_RESTAURANT_PERMISSION_DEFINITIONS,
  ])
);
const ALL_RESTAURANT_PERMISSIONS = Object.freeze(
  permissionKeys(RESTAURANT_PERMISSION_DEFINITIONS)
);

const without = (source, denied) =>
  source.filter((permission) => !new Set(denied).has(permission));

const navigationPermissions = (items) =>
  items.map((item) => `tenant.navigation.${item}`);

const SYSTEM_ROLE_DEFINITIONS = Object.freeze({
  MASTER: Object.freeze({
    key: "MASTER",
    label: "Master",
    authority: 100,
    permissions: ALL_SYSTEM_PERMISSIONS,
  }),
  ADMINISTRADOR: Object.freeze({
    key: "ADMINISTRADOR",
    label: "Administrador",
    authority: 90,
    permissions: without(ALL_SYSTEM_PERMISSIONS, [
      "system.users.manage",
      "system.roles.manage",
      "system.billing.manage",
      "system.settings.manage",
    ]),
  }),
  SOCIO: Object.freeze({
    key: "SOCIO",
    label: "Sócio",
    authority: 90,
    permissions: without(ALL_SYSTEM_PERMISSIONS, [
      "system.users.manage",
      "system.billing.manage",
      "system.roles.manage",
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
    label: "Financeiro",
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
    label: "Sucesso do cliente",
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
    label: "Auditoria",
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
    permissions: Object.freeze([
      ...without(ALL_RESTAURANT_OPERATION_PERMISSIONS, [
        "tenant.financial.edit",
        "tenant.financial.create",
        "tenant.financial.refund",
      ]),
      ...navigationPermissions([
        "dashboard", "users", "cash_register", "orders", "catalog",
        "scheduled", "delivery", "customers", "promotions", "metrics",
        "reports", "financial", "reviews", "settings", "inventory",
        "printing", "production", "tables", "dining_room",
        "delivery_channel", "loyalty", "coupons", "marketing", "api",
        "integrations",
      ]),
    ]),
  }),
  MANAGER: Object.freeze({
    key: "MANAGER",
    label: "Gerente",
    authority: 75,
    permissions: Object.freeze([
      ...without(ALL_RESTAURANT_OPERATION_PERMISSIONS, [
        "tenant.financial.edit",
        "tenant.financial.create",
        "tenant.financial.refund",
        "tenant.settings.edit",
        "tenant.users.manage",
        "tenant.users.create",
        "tenant.users.edit",
        "tenant.users.delete",
        "tenant.users.permissions",
      ]),
      ...navigationPermissions([
        "dashboard", "users", "cash_register", "orders", "catalog",
        "scheduled", "delivery", "customers", "promotions", "metrics",
        "reports", "reviews", "inventory", "production", "tables",
        "dining_room", "integrations",
      ]),
    ]),
  }),
  OPERATOR: Object.freeze({
    key: "OPERATOR",
    label: "Operador",
    authority: 35,
    permissions: Object.freeze([
      "tenant.dashboard.view",
      "tenant.orders.view",
      "tenant.orders.edit",
      "tenant.orders.create",
      "tenant.cash_register.view",
      "tenant.cash_register.open_tab",
      "tenant.cash_register.add_item",
      "tenant.cash_register.send_order",
      "tenant.cash_register.history",
      ...navigationPermissions(["dashboard", "cash_register", "orders"]),
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
      "tenant.orders.create",
      "tenant.customers.view",
      "tenant.financial.view",
      "tenant.cash_register.view",
      "tenant.cash_register.open",
      "tenant.cash_register.close",
      "tenant.cash_register.open_tab",
      "tenant.cash_register.add_item",
      "tenant.cash_register.send_order",
      "tenant.cash_register.remove_service",
      "tenant.cash_register.close_tab",
      "tenant.cash_register.confirm_payment",
      "tenant.cash_register.history",
      ...navigationPermissions([
        "dashboard", "cash_register", "orders", "customers", "financial",
      ]),
    ]),
  }),
  SERVICE: Object.freeze({
    key: "SERVICE",
    label: "Operador (legado)",
    authority: 30,
    permissions: Object.freeze([
      "tenant.dashboard.view",
      "tenant.orders.view",
      "tenant.orders.edit",
      "tenant.orders.create",
      "tenant.customers.view",
      "tenant.delivery.view",
      "tenant.cash_register.view",
      "tenant.cash_register.open_tab",
      "tenant.cash_register.add_item",
      "tenant.cash_register.send_order",
      "tenant.cash_register.history",
      ...navigationPermissions(["dashboard", "cash_register", "orders"]),
    ]),
  }),
  WAITER: Object.freeze({
    key: "WAITER",
    label: "Garçom",
    authority: 30,
    permissions: Object.freeze([
      "tenant.dashboard.view",
      "tenant.orders.view",
      "tenant.orders.edit",
      "tenant.orders.create",
      "tenant.cash_register.view",
      "tenant.cash_register.open_tab",
      "tenant.cash_register.add_item",
      "tenant.cash_register.send_order",
      ...navigationPermissions(["dashboard", "orders", "tables", "dining_room"]),
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
      ...navigationPermissions(["dashboard", "orders", "production"]),
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
      "tenant.inventory.create",
      ...navigationPermissions(["dashboard", "catalog", "inventory"]),
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
      ...navigationPermissions(["dashboard", "financial", "reports"]),
    ]),
  }),
  DELIVERY: Object.freeze({
    key: "DELIVERY",
    label: "Entregador",
    authority: 20,
    permissions: Object.freeze([
      "tenant.dashboard.view",
      "tenant.orders.view",
      "tenant.orders.edit",
      "tenant.delivery.view",
      "tenant.delivery.edit",
      ...navigationPermissions([
        "dashboard", "orders", "delivery", "delivery_channel",
      ]),
    ]),
  }),
  READ_ONLY: Object.freeze({
    key: "READ_ONLY",
    label: "Somente leitura",
    authority: 10,
    permissions: Object.freeze(
      [
        ...ALL_RESTAURANT_OPERATION_PERMISSIONS.filter((permission) => permission.endsWith(".view")),
        ...navigationPermissions(["dashboard", "reports"]),
      ]
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
  ADMINISTRADOR: "ADMINISTRADOR",
  VENDEDOR: "COMERCIAL",
  COMERCIAL: "COMERCIAL",
});

const LEGACY_RESTAURANT_ROLE_MAP = Object.freeze({
  OWNER: "OWNER",
  GERENTE: "MANAGER",
  SUBGERENTE: "MANAGER",
  CAIXA: "CASHIER",
  OPERADOR: "OPERATOR",
  GARCOM: "WAITER",
  ATENDENTE: "OPERATOR",
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
  OPERATOR: "OPERADOR",
  WAITER: "GARCOM",
  KITCHEN: "COZINHA",
  INVENTORY: "ESTOQUE",
  FINANCE: "FINANCEIRO",
  DELIVERY: "ENTREGADOR",
  READ_ONLY: "CUSTOM",
  CUSTOM: "CUSTOM",
});

const SYSTEM_ROLE_LEGACY_MAP = Object.freeze({
  MASTER: "MASTER",
  ADMINISTRADOR: "ADMINISTRADOR",
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
  orders_create: "tenant.orders.create",
  orders_edit: "tenant.orders.edit",
  orders_delete: "tenant.orders.delete",
  customers_view: "tenant.customers.view",
  customers_create: "tenant.customers.create",
  customers_edit: "tenant.customers.edit",
  customers_delete: "tenant.customers.delete",
  catalog_view: "tenant.catalog.view",
  catalog_create: "tenant.catalog.create",
  catalog_edit: "tenant.catalog.edit",
  catalog_delete: "tenant.catalog.delete",
  promotions_view: "tenant.promotions.view",
  promotions_create: "tenant.promotions.create",
  promotions_edit: "tenant.promotions.edit",
  promotions_delete: "tenant.promotions.delete",
  reviews_view: "tenant.reviews.view",
  reviews_edit: "tenant.reviews.edit",
  reviews_delete: "tenant.reviews.delete",
  inventory_view: "tenant.inventory.view",
  inventory_create: "tenant.inventory.create",
  inventory_edit: "tenant.inventory.edit",
  inventory_delete: "tenant.inventory.delete",
  financial_view: "tenant.financial.view",
  financial_create: "tenant.financial.create",
  financial_edit: "tenant.financial.edit",
  delivery_view: "tenant.delivery.view",
  delivery_edit: "tenant.delivery.edit",
  reports_view: "tenant.reports.view",
  exports_view: "tenant.reports.export",
  settings_view: "tenant.settings.view",
  settings_edit: "tenant.settings.edit",
  users_view: "tenant.users.view",
  users_edit: "tenant.users.edit",
  users_create: "tenant.users.create",
  users_delete: "tenant.users.delete",
  business_hours_view: "tenant.business_hours.view",
  business_hours_edit: "tenant.business_hours.edit",
  special_dates_view: "tenant.special_dates.view",
  special_dates_create: "tenant.special_dates.create",
  special_dates_edit: "tenant.special_dates.edit",
  special_dates_delete: "tenant.special_dates.delete",
  cash_register_view: "tenant.cash_register.view",
  cash_register_configure: "tenant.cash_register.configure",
  cash_register_open: "tenant.cash_register.open",
  cash_register_close: "tenant.cash_register.close",
  cash_register_open_tab: "tenant.cash_register.open_tab",
  cash_register_add_item: "tenant.cash_register.add_item",
  cash_register_send_order: "tenant.cash_register.send_order",
  cash_register_discount: "tenant.cash_register.discount",
  cash_register_remove_service: "tenant.cash_register.remove_service",
  cash_register_close_tab: "tenant.cash_register.close_tab",
  cash_register_confirm_payment: "tenant.cash_register.confirm_payment",
  cash_register_history_view: "tenant.cash_register.history",
  menu_dashboard_view: "tenant.navigation.dashboard",
  menu_users_view: "tenant.navigation.users",
  menu_cash_register_view: "tenant.navigation.cash_register",
  menu_orders_view: "tenant.navigation.orders",
  menu_catalog_view: "tenant.navigation.catalog",
  menu_scheduled_view: "tenant.navigation.scheduled",
  menu_delivery_view: "tenant.navigation.delivery",
  menu_customers_view: "tenant.navigation.customers",
  menu_promotions_view: "tenant.navigation.promotions",
  menu_metrics_view: "tenant.navigation.metrics",
  menu_reports_view: "tenant.navigation.reports",
  menu_financial_view: "tenant.navigation.financial",
  menu_reviews_view: "tenant.navigation.reviews",
  menu_settings_view: "tenant.navigation.settings",
  menu_inventory_view: "tenant.navigation.inventory",
  menu_printing_view: "tenant.navigation.printing",
  menu_production_view: "tenant.navigation.production",
  menu_tables_view: "tenant.navigation.tables",
  menu_dining_room_view: "tenant.navigation.dining_room",
  menu_delivery_channel_view: "tenant.navigation.delivery_channel",
  menu_loyalty_view: "tenant.navigation.loyalty",
  menu_coupons_view: "tenant.navigation.coupons",
  menu_marketing_view: "tenant.navigation.marketing",
  menu_api_view: "tenant.navigation.api",
  menu_integrations_view: "tenant.navigation.integrations",
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
