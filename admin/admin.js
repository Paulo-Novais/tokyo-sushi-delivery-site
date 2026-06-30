const ADMIN_DASHBOARD_REFRESH_MS = 20000;
const BOARD_VISIBLE_CARD_LIMIT = 3;
const SCHEDULE_DUE_SOON_WINDOW_MS = 45 * 60 * 1000;
const ADMIN_RUNTIME_CONFIG =
  typeof window === "object" && window.TOKYO_SITE_CONFIG ? window.TOKYO_SITE_CONFIG : {};
const ADMIN_APP_BRANDING = Object.freeze(ADMIN_RUNTIME_CONFIG.appBranding || {});
const ADMIN_RESTAURANT_BRAND = Object.freeze(ADMIN_RUNTIME_CONFIG.restaurantBrand || {});
const ADMIN_SITE_APPEARANCE = Object.freeze(ADMIN_RUNTIME_CONFIG.siteAppearance || {});
const ADMIN_ASSETS = Object.freeze(ADMIN_RUNTIME_CONFIG.assets || {});
const ADMIN_IDENTIFIERS = Object.freeze(ADMIN_RUNTIME_CONFIG.identifiers || {});
const ADMIN_BRANDING = Object.freeze(ADMIN_RUNTIME_CONFIG.adminBranding || {});
const ADMIN_DEFAULT_ADDRESS = Object.freeze(ADMIN_APP_BRANDING.defaultAddress || {});
const ADMIN_STORAGE_KEYS = Object.freeze(ADMIN_IDENTIFIERS.storageKeys || {});
const ADMIN_THEME_STORAGE_KEY = ADMIN_STORAGE_KEYS.adminTheme || "tokyo_admin_theme";
const ADMIN_THEME_DEFAULT = "light";
const ADMIN_THEME_OPTIONS = new Set(["light"]);
const PUBLIC_SITE_LAYOUT_OPTIONS = Object.freeze([
  { key: "MODERN", label: "MODERN", helper: "Tokyo atual, banner grande, categorias horizontais e cards modernos." },
  { key: "CATALOGO", label: "CATALOGO", helper: "Menu lateral, produtos em lista e navegacao rapida." },
  { key: "PREMIUM", label: "PREMIUM", helper: "Banner maior, fotos maiores e acabamento visual mais sofisticado." },
]);
const PUBLIC_SITE_THEME_OPTIONS = Object.freeze([
  { key: "LIGHT", label: "Tema Claro" },
  { key: "DARK", label: "Tema Escuro" },
  { key: "AUTO", label: "Tema Automatico" },
]);
const ORDER_STATUSES = [
  "Recebido",
  "Aceito",
  "Em preparo",
  "Pronto",
  "Saiu para entrega",
  "Entregue",
  "Retirada concluida",
  "Cancelado",
];
const LEGACY_FINALIZED_STATUS = "Finalizado";
const FINAL_ORDER_STATUSES = new Set(["Entregue", "Retirada concluida", "Cancelado"]);
const CUSTOMER_CRM_TAG_OPTIONS = [
  { key: "", label: "Todas as tags" },
  { key: "vip", label: "VIP" },
  { key: "recorrente", label: "Recorrente" },
  { key: "atencao", label: "Atencao" },
  { key: "bloqueado", label: "Bloqueado" },
];
const CUSTOMER_CRM_INACTIVE_FILTERS = [
  { key: "", label: "Qualquer recencia" },
  { key: "15", label: "Sem comprar ha 15 dias" },
  { key: "30", label: "Sem comprar ha 30 dias" },
  { key: "60", label: "Sem comprar ha 60 dias" },
  { key: "90", label: "Sem comprar ha 90 dias" },
];
const CUSTOMER_CRM_SORT_OPTIONS = [
  { key: "recent", label: "Ultima compra" },
  { key: "spend-desc", label: "Maior gasto" },
  { key: "orders-desc", label: "Mais pedidos" },
  { key: "lapsed-desc", label: "Mais tempo sem compra" },
];
const RESTAURANT_NAV_SECTIONS = Object.freeze([
  { key: "dashboard", label: "Dashboard", helper: "Resumo do turno" },
  { key: "orders", label: "Pedidos", helper: "Fila operacional" },
  { key: "scheduled", label: "Agendamentos", helper: "Pedidos futuros" },
  { key: "menu", label: "Cardapio", helper: "Produtos e combos" },
  { key: "deliveries", label: "Entregas", helper: "Motoboys e rotas" },
  { key: "customers", label: "Clientes", helper: "Base recorrente" },
  { key: "promotions", label: "Promocoes", helper: "Campanhas e cupons" },
  { key: "metrics", label: "Metricas", helper: "Performance por admin" },
  { key: "reports", label: "Relatorios", helper: "Indicadores" },
  { key: "inventory", label: "Estoque", helper: "Itens e validade" },
  { key: "finance", label: "Financeiro", helper: "Recebimentos" },
  { key: "reviews", label: "Avaliacoes", helper: "Feedback do cliente" },
  { key: "settings", label: "Configuracoes", helper: "Ajustes do sistema" },
]);
const SYSTEM_NAV_SECTIONS = Object.freeze([
  { key: "users", label: "Usuarios", helper: "Acessos da plataforma" },
  { key: "orders", label: "Pedidos", helper: "Pesquisa por restaurante" },
  { key: "scheduled", label: "Agendados", helper: "Agenda por restaurante" },
  { key: "menu", label: "Cardapio", helper: "Catalogos por restaurante" },
  { key: "deliveries", label: "Entregas", helper: "Operacao por restaurante" },
  { key: "customers", label: "Clientes", helper: "Base por restaurante" },
  { key: "promotions", label: "Promocoes", helper: "Campanhas por restaurante" },
  { key: "metrics", label: "Metricas", helper: "Consolidado ou restaurante" },
  { key: "reports", label: "Relatorios", helper: "Consolidado ou restaurante" },
  { key: "finance", label: "Financeiro", helper: "Consolidado ou restaurante" },
  { key: "reviews", label: "Avaliacoes", helper: "Feedback por restaurante" },
  { key: "settings", label: "Configuracoes", helper: "Ajustes da plataforma" },
]);
const NAV_SECTIONS = Object.freeze([
  ...RESTAURANT_NAV_SECTIONS,
  ...SYSTEM_NAV_SECTIONS.filter(
    (systemSection) => !RESTAURANT_NAV_SECTIONS.some((section) => section.key === systemSection.key)
  ),
]);
const IMPLEMENTED_SECTIONS = new Set([
  "dashboard",
  "orders",
  "scheduled",
  "menu",
  "promotions",
  "reviews",
  "deliveries",
  "customers",
  "finance",
  "metrics",
  "reports",
  "inventory",
  "settings",
  "users",
]);
const SECTION_PERMISSION_MAP = Object.freeze({
  dashboard: "dashboard_view",
  orders: "orders_view",
  scheduled: "orders_view",
  menu: "catalog_view",
  deliveries: "delivery_view",
  customers: "customers_view",
  promotions: "promotions_view",
  metrics: "reports_view",
  reports: "reports_view",
  inventory: "inventory_view",
  finance: "financial_view",
  reviews: "reviews_view",
  settings: "settings_view",
  users: "users_view",
  audit: "developer_logs_view",
});
const SECTION_FEATURE_MAP = Object.freeze({
  orders: "orders",
  scheduled: "scheduledOrders",
  menu: "onlineMenu",
  deliveries: "deliveryCalculation",
  customers: "crm",
  promotions: "promotions",
  metrics: "advancedReports",
  reports: "advancedReports",
  inventory: "inventory",
  finance: "finance",
  reviews: "reviews",
});
const SYSTEM_GLOBAL_FILTERS = Object.freeze({
  orders: Object.freeze([
    { key: "restaurant", label: "Restaurante", placeholder: "Todos os restaurantes" },
    { key: "order", label: "Pedido", placeholder: "ID ou codigo" },
    { key: "customer", label: "Cliente", placeholder: "Nome ou telefone" },
    { key: "status", label: "Status", placeholder: "Todos" },
    { key: "date", label: "Data", type: "date", placeholder: "" },
  ]),
  scheduled: Object.freeze([
    { key: "restaurant", label: "Restaurante", placeholder: "Todos os restaurantes" },
    { key: "order", label: "Pedido", placeholder: "ID ou codigo" },
    { key: "customer", label: "Cliente", placeholder: "Nome ou telefone" },
    { key: "date", label: "Data", type: "date", placeholder: "" },
  ]),
  customers: Object.freeze([{ key: "restaurant", label: "Restaurante", placeholder: "Todos os restaurantes" }]),
  menu: Object.freeze([{ key: "restaurant", label: "Restaurante", placeholder: "Todos os restaurantes" }]),
  deliveries: Object.freeze([{ key: "restaurant", label: "Restaurante", placeholder: "Todos os restaurantes" }]),
  promotions: Object.freeze([{ key: "restaurant", label: "Restaurante", placeholder: "Todos os restaurantes" }]),
  reviews: Object.freeze([{ key: "restaurant", label: "Restaurante", placeholder: "Todos os restaurantes" }]),
  finance: Object.freeze([{ key: "restaurant", label: "Restaurante", placeholder: "Consolidado da plataforma" }]),
  reports: Object.freeze([{ key: "restaurant", label: "Restaurante", placeholder: "Consolidado da plataforma" }]),
  metrics: Object.freeze([{ key: "restaurant", label: "Restaurante", placeholder: "Consolidado da plataforma" }]),
});
const USER_TYPE_OPTIONS = Object.freeze([
  { key: "MASTER", label: "MASTER" },
  { key: "SOCIO", label: "SOCIO" },
  { key: "DESENVOLVEDOR", label: "Desenvolvedor" },
  { key: "SUPORTE", label: "Suporte" },
  { key: "VENDEDOR", label: "Vendedor" },
  { key: "OWNER", label: "OWNER" },
  { key: "GERENTE", label: "Gerente" },
  { key: "CAIXA", label: "Caixa" },
  { key: "COZINHA", label: "Cozinha" },
  { key: "ESTOQUE", label: "Estoque" },
  { key: "ENTREGADOR", label: "Entregador" },
]);
const SYSTEM_USER_TYPE_OPTIONS = Object.freeze([
  { key: "MASTER", label: "MASTER" },
  { key: "SOCIO", label: "SOCIO" },
  { key: "DESENVOLVEDOR", label: "Desenvolvedor" },
  { key: "SUPORTE", label: "Suporte" },
  { key: "VENDEDOR", label: "Vendedor" },
]);
const RESTAURANT_USER_TYPE_OPTIONS = Object.freeze([
  { key: "OWNER", label: "OWNER" },
  { key: "GERENTE", label: "Gerente" },
  { key: "CAIXA", label: "Caixa" },
  { key: "COZINHA", label: "Cozinha" },
  { key: "ESTOQUE", label: "Estoque" },
  { key: "ENTREGADOR", label: "Entregador" },
]);
const OWNER_USER_TYPE_OPTIONS = Object.freeze(
  RESTAURANT_USER_TYPE_OPTIONS.filter((option) => option.key !== "OWNER")
);
const USER_SCOPE_OPTIONS = Object.freeze([
  { key: "SYSTEM", label: "Usuario do Sistema" },
  { key: "RESTAURANT", label: "Usuario de Restaurante" },
]);
const SYSTEM_USER_TYPES = Object.freeze(SYSTEM_USER_TYPE_OPTIONS.map((option) => option.key));
const RESTAURANT_USER_TYPES = Object.freeze(RESTAURANT_USER_TYPE_OPTIONS.map((option) => option.key));
const SYSTEM_USER_TYPE_SET = new Set(SYSTEM_USER_TYPES);
const RESTAURANT_USER_TYPE_SET = new Set(RESTAURANT_USER_TYPES);
const SYSTEM_USER_HIERARCHY = Object.freeze(["MASTER", "SOCIO", "DESENVOLVEDOR", "SUPORTE", "VENDEDOR"]);
const SYSTEM_USER_MANAGEABLE_TYPES = Object.freeze({
  MASTER: Object.freeze(["SOCIO", "DESENVOLVEDOR", "SUPORTE", "VENDEDOR"]),
  SOCIO: Object.freeze(["DESENVOLVEDOR", "SUPORTE", "VENDEDOR"]),
  DESENVOLVEDOR: Object.freeze(["SUPORTE", "VENDEDOR"]),
  SUPORTE: Object.freeze(["VENDEDOR"]),
  VENDEDOR: Object.freeze([]),
});
const USER_TYPE_LABELS = Object.freeze(
  USER_TYPE_OPTIONS.reduce((labels, option) => {
    labels[option.key] = option.label;
    return labels;
  }, {})
);
const USER_STATUS_OPTIONS = Object.freeze([
  { key: "ACTIVE", label: "Ativo" },
  { key: "BLOCKED", label: "Bloqueado" },
]);
const NEW_ADMIN_USER_LOGIN = "__new_admin_user__";
const USER_PAGE_SIZE_OPTIONS = Object.freeze([10, 20, 50]);
const USER_TABLE_COLUMNS = Object.freeze([
  { key: "id", label: "ID", sortable: true },
  { key: "name", label: "Nome", sortable: true },
  { key: "restaurant", label: "Restaurante", sortable: true },
  { key: "plan", label: "Plano", sortable: true },
  { key: "profile", label: "Perfil", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "actions", label: "Acoes", sortable: false },
]);
const USER_PERMISSION_ACTIONS_FALLBACK = Object.freeze([
  { key: "view", label: "Visualizar" },
  { key: "create", label: "Criar" },
  { key: "edit", label: "Editar" },
  { key: "delete", label: "Excluir" },
]);
const USER_PERMISSION_MODULES_FALLBACK = Object.freeze([
  { key: "dashboard", label: "Dashboard" },
  { key: "orders", label: "Pedidos" },
  { key: "customers", label: "Clientes" },
  { key: "catalog", label: "Cardapio" },
  { key: "promotions", label: "Promocoes" },
  { key: "reviews", label: "Avaliacoes" },
  { key: "reports", label: "Relatorios" },
  { key: "inventory", label: "Estoque" },
  { key: "financial", label: "Financeiro" },
  { key: "settings", label: "Configuracoes" },
  { key: "users", label: "Usuarios" },
  { key: "delivery", label: "Entrega" },
  { key: "business_hours", label: "Horarios" },
  { key: "special_dates", label: "Datas especiais" },
]);
const SECTION_TITLES = {
  dashboard: {
    chip: "Dashboard gerencial",
    title: "Resumo do turno e indicadores",
    description:
      "Leitura executiva da operacao com volume, receita, conclusoes e sinais de atencao do turno.",
    focus: "Visao gerencial do turno",
  },
  orders: {
    chip: "Pedidos operacionais",
    title: "Kanban e execucao dos pedidos",
    description: "Fila operacional viva com kanban central e painel lateral dedicado para cada pedido.",
    focus: "Sala de operacao",
  },
  scheduled: {
    chip: "Agendamentos",
    title: "Agenda operacional de pedidos futuros",
    description: "Pedidos agendados com leitura por data, modalidade e proximidade do horario programado.",
    focus: "Fila futura do gestor",
  },
  menu: {
    chip: "Cardapio",
    title: "Painel operacional do cardapio do site",
    description: "Crie categorias, ajuste pratos, fotos, precos e disponibilidade do que aparece para o cliente.",
    focus: "Controle vivo do cardapio",
  },
  promotions: {
    chip: "Promocoes administrativas",
    title: "Campanhas, validade e preco promocional",
    description:
      "Gerencie promocoes com periodo, ativacao automatica, reflexo no site e preco valido no fechamento do pedido.",
    focus: "Campanhas vivas do gestor",
  },
  reviews: {
    chip: "Avaliacoes operacionais",
    title: "Reputacao do site e publicacao automatica",
    description:
      "Acompanhe notas, comentarios, janela de publicacao e o que fica visivel no site em tempo real.",
    focus: "Reputacao do site",
  },
  deliveries: {
    chip: "Central de entregas",
    title: "Configuracao operacional de entregas",
    description: "Taxas, area atendida, retirada, entregadores e status do delivery em um so lugar.",
    focus: "Regras do checkout",
  },
  customers: {
    chip: "Base de clientes",
    title: "Recorrencia e relacionamento",
    description: "Veja historico recente, recorrencia e clientes que mais movem a operacao.",
    focus: "Leitura da carteira",
  },
  finance: {
    chip: "Financeiro",
    title: "Financeiro",
    description: "Visao de faturamento, repasses, taxas e fechamento.",
    focus: "Caixa do turno",
  },
  metrics: {
    chip: "Metricas operacionais",
    title: "Desempenho do fluxo e dos admins",
    description: "Leitura gerencial baseada na trilha real de auditoria e nos pedidos do periodo.",
    focus: "Indicadores vivos da operacao",
  },
  reports: {
    chip: "Relatorios operacionais",
    title: "Performance do turno e gargalos",
    description: "Acompanhe volume, status, canais e sinais para tomada rapida de decisao.",
    focus: "Inteligencia operacional",
  },
  audit: {
    chip: "Auditoria operacional",
    title: "Trilha de acoes do gestor",
    description: "Consulte quem executou cada movimento critico na operacao e em qual pedido.",
    focus: "Rastro da operacao",
  },
  inventory: {
    chip: "Estoque operacional",
    title: "Controle rapido de estoque",
    description:
      "Acompanhe quantidades, minimos e validade dos insumos para a rotina diaria do restaurante.",
    focus: "Itens e validade",
  },
  settings: {
    chip: "Configuracoes do site",
    title: "Personalizacao publica do restaurante",
    description:
      "Ajuste marca, contato, cores e textos que aparecem somente no site publico do cliente.",
    focus: "Identidade do site",
  },
  users: {
    chip: "Usuarios e permissoes",
    title: "Usuarios",
    description: "Gerencie acessos, status e permissoes granulares do Gestor.",
    focus: "Controle de acesso",
  },
};
const NAV_ICON_SVGS = {
  dashboard:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M4 5h7v6H4zM13 5h7v10h-7zM4 13h7v6H4zM13 17h7v2h-7z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  orders:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M7 4h10l3 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8l2-4zm0 0v4h10V4M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  scheduled:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm6 7v4l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  menu:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M7 4v8M11 4v8M7 8h4M16 4c1.7 0 3 1.3 3 3 0 1.2-.7 2.3-1.8 2.8L17 20M5 20h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  deliveries:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M3 7h11v8H3zM14 10h3l3 3v2h-6M7 18a1.5 1.5 0 1 1 0 .01zm11 0a1.5 1.5 0 1 1 0 .01z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  customers:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M15 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 3a3 3 0 1 0 0-6m4 12v-1a4 4 0 0 0-3-3.87" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  promotions:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-7M12 3l3.5 3.5L12 10 8.5 6.5 12 3zm0 7v10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  metrics:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M4 19h16M7 15l3-3 3 2 4-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="15" r="1"/><circle cx="10" cy="12" r="1"/><circle cx="13" cy="14" r="1"/><circle cx="17" cy="9" r="1"/></svg>',
  reports:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M5 19V9M12 19V5M19 19v-7M4 19h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  audit:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3zm0 6v3l2 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  inventory:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7.5 12 3l8 4.5-8 4.5-8-4.5Zm0 0V16l8 5 8-5V7.5M12 12v9M7.5 10 16 5.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  finance:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3v18M16 7.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.8 3 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  reviews:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M12 17.3 6.1 20l1.1-6.4L2.5 9l6.5-.9L12 2l3 6.1 6.5.9-4.7 4.6 1.1 6.4z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  settings:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm7.4 3-1.3-.7.1-1.5-1.5-.9-1 .9-1.4-.6-.4-1.4h-1.8l-.4 1.4-1.4.6-1-.9-1.5.9.1 1.5-1.3.7v1.8l1.3.7-.1 1.5 1.5.9 1-.9 1.4.6.4 1.4h1.8l.4-1.4 1.4-.6 1 .9 1.5-.9-.1-1.5 1.3-.7v-1.8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  users:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M15 19v-1.2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V19M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm9.5 3.5 1.5 1.5 2.5-3M17 7.5a3 3 0 1 0 0 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const BOARD_COLUMNS = [
  {
    key: "received",
    label: "Recebidos",
    helper: "Entraram pelo site e aguardam a primeira acao.",
    accentClass: "is-new-column",
  },
  {
    key: "accepted",
    label: "Aceitos",
    helper: "Pedidos validados e prontos para entrar em preparo.",
    accentClass: "is-accepted-column",
  },
  {
    key: "preparing",
    label: "Em preparo",
    helper: "Pedidos em producao na cozinha.",
    accentClass: "is-preparing-column",
  },
  {
    key: "ready",
    label: "Prontos",
    helper: "Aguardando motoboy ou retirada.",
    accentClass: "is-ready-column",
  },
  {
    key: "delivery",
    label: "Saiu para entrega",
    helper: "Pedidos em rota com o entregador.",
    accentClass: "is-delivery-column",
  },
];
const ACTION_NOTES = {
  Aceito: "Pedido aceito pela operacao.",
  "Em preparo": "Pedido encaminhado para a cozinha.",
  Pronto: "Pedido finalizado na cozinha e pronto para expedicao.",
  "Saiu para entrega": "Pedido despachado para entrega.",
  Entregue: "Entrega concluida no gestor.",
  "Retirada concluida": "Retirada concluida no gestor.",
  Cancelado: "Pedido cancelado pelo gestor.",
};
const AUDIT_ACTION_LABELS = {
  order_created: "Pedido criado",
  order_accepted: "Pedido aceito",
  order_marked_preparing: "Pedido em preparo",
  order_marked_ready: "Pedido pronto",
  order_out_for_delivery: "Saiu para entrega",
  order_marked_picked_up: "Retirada concluida",
  order_finalized: "Pedido entregue",
  order_cancelled: "Pedido cancelado",
  status_updated: "Status atualizado",
  manual_order_update: "Alteracao manual",
};
const DASHBOARD_REVENUE_PERIODS = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
];
const MENU_HOME_HIGHLIGHT_LIMIT = 3;
const DELIVERY_PAYOUT_MODES = Object.freeze([
  { id: "fixed_by_band", label: "Valor fixo por faixa" },
  { id: "percentage_fee", label: "Percentual da taxa" },
  { id: "manual", label: "Valor manual" },
]);
const FINANCE_PERIOD_FALLBACK_OPTIONS = Object.freeze([
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "month_current", label: "Mes atual" },
  { key: "custom", label: "Personalizado" },
]);
const FINANCE_STATUS_FILTER_OPTIONS = Object.freeze([
  { key: "all", label: "Todos" },
  { key: "paid", label: "Pago" },
  { key: "pending", label: "Pendente" },
  { key: "cancelled", label: "Cancelado" },
]);
const FINANCE_PAYMENT_FILTER_OPTIONS = Object.freeze([
  { key: "all", label: "Todas formas" },
  { key: "dinheiro", label: "Dinheiro" },
  { key: "pix", label: "Pix" },
  { key: "cartao", label: "Cartao" },
  { key: "online_outros", label: "Online/outros" },
]);
const INVENTORY_NEW_ITEM_ID = "__new_inventory_item__";
const INVENTORY_STATUS_OPTIONS = Object.freeze([
  { key: "", label: "Todos os status" },
  { key: "ok", label: "OK" },
  { key: "low", label: "Baixo" },
  { key: "critical", label: "Critico" },
]);
const INVENTORY_STATUS_META = Object.freeze({
  ok: {
    label: "OK",
    helper: "Acima do minimo",
    className: "is-ok",
  },
  low: {
    label: "Baixo",
    helper: "Proximo do minimo",
    className: "is-low",
  },
  critical: {
    label: "Critico",
    helper: "Abaixo do minimo",
    className: "is-critical",
  },
});
const DELIVERY_SETTINGS_DEFAULT_DRAFT = Object.freeze({
  distanceBands: [
    {
      id: "band-up-to-1-9",
      minKm: 0,
      maxKm: 1.9,
      customerFee: 9,
      courierFee: 0,
      minimumOrder: 0,
      isActive: true,
    },
    {
      id: "band-up-to-6-9",
      minKm: 1.9,
      maxKm: 6.9,
      customerFee: 10,
      courierFee: 0,
      minimumOrder: 0,
      isActive: true,
    },
    {
      id: "band-up-to-10-9",
      minKm: 6.9,
      maxKm: 10.9,
      customerFee: 12,
      courierFee: 0,
      minimumOrder: 0,
      isActive: true,
    },
    {
      id: "band-up-to-14-9",
      minKm: 10.9,
      maxKm: 14.9,
      customerFee: 15,
      courierFee: 0,
      minimumOrder: 0,
      isActive: true,
    },
  ],
  deliveryTime: {
    minMinutes: 40,
    maxMinutes: 60,
    message: "Entrega estimada entre 40 e 60 minutos",
  },
  serviceArea: {
    maxRadiusKm: 14.9,
    servedNeighborhoods: [],
    blockedNeighborhoods: [],
    outOfAreaMessage: "No momento nao entregamos nessa regiao.",
  },
  freeShipping: {
    enabled: false,
    minimumOrder: 120,
    appliesToAllBands: true,
    bandIds: [],
  },
  pickup: {
    enabled: true,
    estimateMinutes: 25,
    message: "Retirada disponivel em 25 minutos",
  },
  status: {
    deliveriesEnabled: true,
    pausedMessage: "Entregas pausadas temporariamente. Retirada no balcao disponivel.",
  },
  couriers: [],
  courierPayout: {
    mode: "fixed_by_band",
    percentage: 0,
    manualAmount: 0,
  },
  updatedAt: "",
  updatedByLogin: "",
  updatedByDisplayName: "",
});
const BUSINESS_SCHEDULE_DAY_KEYS = Object.freeze([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);
const BUSINESS_SCHEDULE_DAY_LABELS = Object.freeze({
  monday: "Segunda",
  tuesday: "Terca",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sabado",
  sunday: "Domingo",
});
const createDefaultBusinessScheduleDays = () =>
  BUSINESS_SCHEDULE_DAY_KEYS.reduce((days, dayKey) => {
    days[dayKey] = {
      isOpen: true,
      openTime: "18:00",
      closeTime: "23:00",
      pauseStart: "",
      pauseEnd: "",
    };

    return days;
  }, {});
const RESTAURANT_SETTINGS_DEFAULT_DRAFT = Object.freeze({
  restaurantKey: "default",
  restaurantName: ADMIN_RESTAURANT_BRAND.name || "Tokyo Sushi Delivery",
  logoUrl:
    ADMIN_RESTAURANT_BRAND.logo ||
    ADMIN_ASSETS.publicLogo ||
    "./site-images/tokyo-logo-premium-transparent.png",
  bannerUrl:
    ADMIN_RESTAURANT_BRAND.banner ||
    ADMIN_ASSETS.publicBanner ||
    "./site-images/combinado-imperial.png",
  primaryColor: ADMIN_RESTAURANT_BRAND.primaryColor || "#e83637",
  secondaryColor: ADMIN_RESTAURANT_BRAND.secondaryColor || "#f5c3d3",
  accentColor: ADMIN_SITE_APPEARANCE.colors?.accent || "#f2b649",
  gradientStart:
    ADMIN_SITE_APPEARANCE.colors?.gradientStart ||
    ADMIN_RESTAURANT_BRAND.primaryColor ||
    "#e83637",
  gradientEnd: ADMIN_SITE_APPEARANCE.colors?.gradientEnd || "#2b1214",
  useGradient: ADMIN_SITE_APPEARANCE.colors?.useGradient !== false,
  siteLayout: ADMIN_SITE_APPEARANCE.layout || "MODERN",
  siteTheme: ADMIN_SITE_APPEARANCE.theme || "DARK",
  slogan:
    ADMIN_SITE_APPEARANCE.identity?.slogan ||
    ADMIN_RESTAURANT_BRAND.slogan ||
    ADMIN_APP_BRANDING.brandTagline ||
    "Delivery Premium",
  description:
    ADMIN_SITE_APPEARANCE.identity?.description ||
    ADMIN_RESTAURANT_BRAND.description ||
    "Cada detalhe e pensado para transformar seu pedido em uma experiencia unica.",
  instagram: ADMIN_SITE_APPEARANCE.social?.instagram || "",
  facebook: ADMIN_SITE_APPEARANCE.social?.facebook || "",
  tiktok: ADMIN_SITE_APPEARANCE.social?.tiktok || "",
  site: ADMIN_SITE_APPEARANCE.social?.site || ADMIN_APP_BRANDING.companyWebsite || "",
  seoTitle: ADMIN_SITE_APPEARANCE.seo?.title || ADMIN_RESTAURANT_BRAND.name || "Tokyo Sushi Delivery",
  seoDescription:
    ADMIN_SITE_APPEARANCE.seo?.description ||
    "Tokyo Sushi Delivery com experiencia premium, cardapio sofisticado e pedidos direto pelo site.",
  seoShareImage:
    ADMIN_SITE_APPEARANCE.seo?.shareImage ||
    ADMIN_ASSETS.socialImage ||
    "/site-images/combinado-imperial.png",
  seoKeywords: Array.isArray(ADMIN_SITE_APPEARANCE.seo?.keywords)
    ? ADMIN_SITE_APPEARANCE.seo.keywords
    : ["Tokyo Sushi", "sushi delivery", "delivery japones"],
  seoOpenGraph: {
    title: ADMIN_SITE_APPEARANCE.seo?.openGraph?.title || ADMIN_SITE_APPEARANCE.seo?.title || "",
    description:
      ADMIN_SITE_APPEARANCE.seo?.openGraph?.description ||
      ADMIN_SITE_APPEARANCE.seo?.description ||
      "",
    image:
      ADMIN_SITE_APPEARANCE.seo?.openGraph?.image ||
      ADMIN_SITE_APPEARANCE.seo?.shareImage ||
      ADMIN_ASSETS.socialImage ||
      "/site-images/combinado-imperial.png",
    type: ADMIN_SITE_APPEARANCE.seo?.openGraph?.type || "website",
  },
  platformFooter: {
    showPlatformBranding: ADMIN_SITE_APPEARANCE.platformFooter?.showPlatformBranding !== false,
    brandName: ADMIN_SITE_APPEARANCE.platformFooter?.brandName || "INovas Food",
    headline: ADMIN_SITE_APPEARANCE.platformFooter?.headline || "Desenvolvido por INovas Food",
    description:
      ADMIN_SITE_APPEARANCE.platformFooter?.description ||
      "Plataforma profissional para restaurantes",
    url: ADMIN_SITE_APPEARANCE.platformFooter?.url || "https://www.inovasfood.com.br",
    displayUrl: ADMIN_SITE_APPEARANCE.platformFooter?.displayUrl || "www.inovasfood.com.br",
  },
  whatsapp: ADMIN_APP_BRANDING.defaultWhatsapp || "5516990507398",
  address:
    ADMIN_DEFAULT_ADDRESS.full ||
    "Rua General Osorio, 2165, Franca - SP, 14400-520, Brasil",
  addressFields: {
    postalCode: ADMIN_DEFAULT_ADDRESS.postalCode || "14400-520",
    street: ADMIN_DEFAULT_ADDRESS.street || "Rua General Osorio",
    number: ADMIN_DEFAULT_ADDRESS.number || "2165",
    complement: ADMIN_DEFAULT_ADDRESS.complement || "",
    neighborhood: ADMIN_DEFAULT_ADDRESS.neighborhood || "",
    city: ADMIN_DEFAULT_ADDRESS.city || "Franca",
    state: ADMIN_DEFAULT_ADDRESS.state || "SP",
  },
  deliveryBase: {
    latitude: null,
    longitude: null,
    maxDeliveryRadiusKm: 14.9,
    fixedDeliveryFee: 9,
    pricePerKm: 1,
    minimumDeliveryOrder: 0,
    pickupEnabled: true,
    deliveryEnabled: true,
  },
  businessHours: "18:00 as 23:00",
  businessSchedule: {
    timeZone: "America/Sao_Paulo",
    acceptOrdersOutsideHours: false,
    closedMessage:
      "Estamos fechados agora. Voce pode agendar seu pedido para o proximo horario de atendimento.",
    peakPreparationExtraMinutes: 0,
    specialDates: [],
    days: createDefaultBusinessScheduleDays(),
  },
  hasStructuredBusinessSchedule: true,
  defaultDeliveryFee: 9,
  averagePreparationTimeMinutes: 25,
  presentationText:
    "Cada detalhe e pensado para transformar seu pedido em uma experiencia unica.",
  updatedAt: "",
  updatedByLogin: "",
  updatedByDisplayName: "",
});

const adminState = {
  activeSection: "orders",
  searchQuery: "",
  orders: [],
  auditEvents: [],
  auditAdminOptions: [],
  auditActionOptions: Object.entries(AUDIT_ACTION_LABELS).map(([key, label]) => ({ key, label })),
  auditFilters: {
    adminLogin: "",
    action: "",
    orderQuery: "",
    limit: 60,
  },
  selectedOrder: null,
  selectedOrderId: "",
  expandedBoardColumnKey: "",
  selectedCustomerKey: "",
  customersSnapshot: null,
  customerFilters: {
    tag: "",
    inactiveDays: "",
    sortBy: "recent",
  },
  stats: null,
  metricsSnapshot: null,
  financeSnapshot: null,
  inventorySnapshot: null,
  adminDisplayName: "",
  adminUserType: "MASTER",
  adminRestaurantKey: "default",
  adminRestaurantName: "",
  adminPlatformScope: false,
  adminPermissions: null,
  adminPermissionModules: USER_PERMISSION_MODULES_FALLBACK,
  commercialAccess: null,
  theme: ADMIN_THEME_DEFAULT,
  publicCatalogItems: null,
  isLoadingPublicCatalog: false,
  metricsFilters: {
    period: "7d",
    startDate: "",
    endDate: "",
    adminLogin: "",
    status: "",
    flow: "",
  },
  financeFilters: {
    period: "today",
    startDate: "",
    endDate: "",
  },
  financeTableFilters: {
    status: "all",
    paymentMethod: "all",
  },
  inventoryFilters: {
    category: "",
    status: "",
  },
  selectedInventoryItemId: "",
  generatedAt: "",
  storageMode: "",
  scheduledSnapshot: null,
  scheduledFilters: {
    date: "",
    fulfillmentMode: "",
  },
  isLoadingScheduled: false,
  menuSnapshot: null,
  menuFilters: {
    sectionId: "",
    availabilityState: "",
  },
  isLoadingMenu: false,
  menuSavingItemId: "",
  menuBusyKey: "",
  promotionsSnapshot: null,
  promotionsFilters: {
    status: "",
  },
  selectedPromotionId: "",
  isLoadingPromotions: false,
  promotionSaving: false,
  promotionBusyId: "",
  reviewsSnapshot: null,
  reviewsFilters: {
    status: "",
    rating: "",
  },
  selectedReviewId: "",
  isLoadingReviews: false,
  reviewBusyId: "",
  deliverySettingsSnapshot: null,
  deliverySettingsDraft: null,
  isLoadingDeliverySettings: false,
  deliverySettingsSaving: false,
  restaurantSettingsSnapshot: null,
  restaurantSettingsDraft: null,
  usersSnapshot: null,
  isLoadingRestaurantSettings: false,
  restaurantSettingsSaving: false,
  isLoadingUsers: false,
  userSaving: false,
  userBusyLogin: "",
  selectedUserLogin: "",
  userDraft: null,
  userDialogMode: "",
  userFilters: {
    restaurant: "",
    profile: "",
    status: "",
  },
  systemFilters: Object.keys(SYSTEM_GLOBAL_FILTERS).reduce((filters, sectionKey) => {
    filters[sectionKey] = SYSTEM_GLOBAL_FILTERS[sectionKey].reduce((sectionFilters, filter) => {
      sectionFilters[filter.key] = "";
      return sectionFilters;
    }, {});
    return filters;
  }, {}),
  userSort: {
    key: "id",
    direction: "asc",
  },
  userPage: 1,
  userPageSize: 10,
  isLoadingFinance: false,
  isSavingFinanceClosing: false,
  isLoadingInventory: false,
  isLoadingCustomers: false,
  isSavingCustomerProfile: false,
  inventoryBusyKey: "",
  isLoadingOrders: false,
  isLoadingOrderDetails: false,
  isLoadingAudit: false,
  isLoadingMetrics: false,
  isUpdatingStatus: false,
  dashboardRevenuePeriod: "today",
  dashboardRevenueMenuOpen: false,
  actionMessage: "",
  actionTone: "success",
};

let detailRequestSequence = 0;

const normalizeStatusKey = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const resolveCanonicalOrderStatus = (status, fulfillmentMode = "") => {
  const normalizedStatus = normalizeStatusKey(status);
  const normalizedFulfillmentMode = String(fulfillmentMode || "").trim().toLowerCase();

  if (!normalizedStatus) {
    return "";
  }

  if (normalizedStatus === "novo" || normalizedStatus === "recebido") {
    return "Recebido";
  }

  if (normalizedStatus === "confirmado" || normalizedStatus === "aceito") {
    return "Aceito";
  }

  if (normalizedStatus === "em preparo") {
    return "Em preparo";
  }

  if (normalizedStatus === "pronto") {
    return "Pronto";
  }

  if (normalizedStatus === "saiu para entrega") {
    return "Saiu para entrega";
  }

  if (normalizedStatus === normalizeStatusKey(LEGACY_FINALIZED_STATUS)) {
    return normalizedFulfillmentMode === "pickup" ? "Retirada concluida" : "Entregue";
  }

  if (normalizedStatus === "entregue") {
    return "Entregue";
  }

  if (normalizedStatus === "retirada concluida") {
    return "Retirada concluida";
  }

  if (normalizedStatus === "cancelado") {
    return "Cancelado";
  }

  return "";
};

const getStoredAdminTheme = () => {
  return ADMIN_THEME_DEFAULT;
};

const syncThemeToggle = () => {
  const themeToggleButton = document.querySelector("[data-admin-theme-toggle]");

  if (!themeToggleButton) {
    return;
  }

  themeToggleButton.setAttribute("aria-pressed", "false");
  themeToggleButton.setAttribute("aria-label", "Tema claro oficial INovas Food");
  themeToggleButton.setAttribute("title", "Tema claro oficial INovas Food");
};

const applyAdminTheme = (theme, { persist = true } = {}) => {
  const resolvedTheme = ADMIN_THEME_OPTIONS.has(theme) ? theme : ADMIN_THEME_DEFAULT;
  adminState.theme = resolvedTheme;

  if (document.documentElement) {
    document.documentElement.style.colorScheme = resolvedTheme;
  }

  if (document.body) {
    document.body.dataset.adminTheme = resolvedTheme;
  }

  if (persist) {
    try {
      window.localStorage.removeItem(ADMIN_THEME_STORAGE_KEY);
    } catch (error) {
      // Ignoramos falhas de persistencia local para nao bloquear a interface.
    }
  }

  syncThemeToggle();
};

const initializeAdminTheme = () => {
  if (typeof window === "undefined") {
    return;
  }

  applyAdminTheme(getStoredAdminTheme(), { persist: false });
};

const normalizeAdminPermissionsPayload = (permissions) => {
  if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) {
    return null;
  }

  const entries = Object.entries(permissions);

  if (!entries.length) {
    return null;
  }

  return entries.reduce((normalizedPermissions, [key, value]) => {
    normalizedPermissions[String(key)] = value === true;
    return normalizedPermissions;
  }, {});
};

const syncAdminAccessFromPayload = (admin = {}) => {
  if (!admin || typeof admin !== "object") {
    return;
  }

  if (admin.displayName || admin.name) {
    adminState.adminDisplayName = admin.displayName || admin.name;
  }

  if (admin.userType || admin.tipo_usuario) {
    adminState.adminUserType = admin.userType || admin.tipo_usuario;
  }

  if (Object.prototype.hasOwnProperty.call(admin, "platformScope")) {
    adminState.adminPlatformScope = admin.platformScope === true;
  } else if (admin.userScope) {
    adminState.adminPlatformScope = String(admin.userScope || "").toUpperCase() === "SYSTEM";
  }

  if (Object.prototype.hasOwnProperty.call(admin, "restaurantKey")) {
    adminState.adminRestaurantKey = adminState.adminPlatformScope ? "" : admin.restaurantKey || "default";
  }

  if (adminState.adminPlatformScope) {
    adminState.adminRestaurantName = "";
  } else if (admin.restaurantName || admin.restaurant) {
    adminState.adminRestaurantName = admin.restaurantName || admin.restaurant;
  }

  const permissions = normalizeAdminPermissionsPayload(admin.permissions);

  if (permissions) {
    adminState.adminPermissions = permissions;
  }

  if (Array.isArray(admin.permissionModules) && admin.permissionModules.length) {
    adminState.adminPermissionModules = admin.permissionModules;
  }

  if (admin.commercialAccess && typeof admin.commercialAccess === "object") {
    adminState.commercialAccess = admin.commercialAccess;
  } else if (admin.planAccess && typeof admin.planAccess === "object") {
    adminState.commercialAccess = admin.planAccess;
  }
};

const hasAdminPermission = (permissionKey) => {
  const normalizedPermissionKey = String(permissionKey || "").trim();

  if (!normalizedPermissionKey || !adminState.adminPermissions) {
    return true;
  }

  return adminState.adminPermissions[normalizedPermissionKey] === true;
};

const hasPlanFeatureForSection = (sectionKey) => {
  const featureKey = SECTION_FEATURE_MAP[sectionKey];

  if (!featureKey || !adminState.commercialAccess) {
    return true;
  }

  const blockedModules = Array.isArray(adminState.commercialAccess.blockedModules)
    ? adminState.commercialAccess.blockedModules
    : Array.isArray(adminState.commercialAccess.modulos_bloqueados)
      ? adminState.commercialAccess.modulos_bloqueados
      : [];
  const releasedFeatures = Array.isArray(adminState.commercialAccess.releasedFeatures)
    ? adminState.commercialAccess.releasedFeatures
    : Array.isArray(adminState.commercialAccess.recursos_liberados)
      ? adminState.commercialAccess.recursos_liberados
      : [];
  const feature = adminState.commercialAccess.features?.[featureKey] || null;

  if (
    blockedModules.includes(sectionKey) ||
    blockedModules.includes(featureKey)
  ) {
    return false;
  }

  if (feature) {
    return feature.enabled === true && feature.future !== true;
  }

  return releasedFeatures.includes(featureKey);
};

const canAccessAdminSection = (sectionKey) =>
  hasAdminPermission(SECTION_PERMISSION_MAP[sectionKey] || "") && hasPlanFeatureForSection(sectionKey);

const getNavigationSectionsForActor = () =>
  isSystemAdminActor() ? SYSTEM_NAV_SECTIONS : RESTAURANT_NAV_SECTIONS;

const getNavigationSectionByKey = (sectionKey) =>
  getNavigationSectionsForActor().find((section) => section.key === sectionKey) ||
  NAV_SECTIONS.find((section) => section.key === sectionKey) ||
  null;

const getVisibleNavSections = () =>
  getNavigationSectionsForActor().filter((section) => canAccessAdminSection(section.key));

const ensureActiveSectionAllowed = () => {
  if (
    getVisibleNavSections().some((section) => section.key === adminState.activeSection) &&
    canAccessAdminSection(adminState.activeSection)
  ) {
    return;
  }

  adminState.activeSection =
    getVisibleNavSections().find((section) => IMPLEMENTED_SECTIONS.has(section.key))?.key ||
    (isSystemAdminActor() ? "users" : "orders");
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatMoney = (value) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));

const resolveAdminAssetUrl = (value) => {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "";
  }

  if (
    normalizedValue.startsWith("/") ||
    normalizedValue.startsWith("data:") ||
    /^[a-z]+:\/\//i.test(normalizedValue)
  ) {
    return normalizedValue;
  }

  return normalizedValue.startsWith("./")
    ? `/${normalizedValue.slice(2)}`
    : `/${normalizedValue.replace(/^\.?\//, "")}`;
};

const normalizeDecimalInput = (value) => {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return "";
  }

  const sanitizedValue = rawValue.replace(/[^\d,.\-]/g, "");

  if (sanitizedValue.includes(",") && sanitizedValue.includes(".")) {
    return sanitizedValue.lastIndexOf(",") > sanitizedValue.lastIndexOf(".")
      ? sanitizedValue.replace(/\./g, "").replace(",", ".")
      : sanitizedValue.replace(/,/g, "");
  }

  if (sanitizedValue.includes(",")) {
    return sanitizedValue.replace(",", ".");
  }

  return sanitizedValue;
};

const formatDateTime = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Horario indisponivel";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

const formatTime = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--/--/----";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(date);
};

const formatPercent = (value) => {
  const numericValue = Number(value || 0);

  if (!Number.isFinite(numericValue)) {
    return "0%";
  }

  const hasDecimals = Math.abs(numericValue % 1) > 0.01;
  return `${numericValue.toFixed(hasDecimals ? 1 : 0)}%`;
};

const formatDuration = (valueMs) => {
  const numericValue = Number(valueMs || 0);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "--";
  }

  const totalMinutes = Math.round(numericValue / 60000);

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours < 24) {
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (remainingHours > 0) {
    return `${days}d ${remainingHours}h`;
  }

  return `${days}d`;
};

const normalizeStatusHistoryEntry = (entry, fulfillmentMode = "") => ({
  ...entry,
  status: resolveCanonicalOrderStatus(entry?.status, fulfillmentMode) || String(entry?.status || "").trim(),
});

const normalizeOrderItem = (item) => ({
  ...item,
  sortOrder: Number(item?.sortOrder || 0),
  type: String(item?.type || item?.itemType || "product").trim().toLowerCase(),
  name: String(item?.name || "").trim(),
  category: String(item?.category || "").trim(),
  quantity: Number(item?.quantity || 0),
  unitPrice: Number(item?.unitPrice || 0),
  totalPrice: Number(item?.totalPrice || 0),
  metadata: item?.metadata && typeof item.metadata === "object" ? item.metadata : {},
});

const normalizeOrderRecord = (order) => {
  if (!order || typeof order !== "object") {
    return order;
  }

  const fulfillmentMode = String(order.fulfillmentMode || "").trim().toLowerCase();

  return {
    ...order,
    fulfillmentMode,
    status: resolveCanonicalOrderStatus(order.status, fulfillmentMode) || String(order.status || "").trim(),
    auditTrail: Array.isArray(order.auditTrail)
      ? order.auditTrail.map((entry) => normalizeStatusHistoryEntry(entry, fulfillmentMode))
      : order.auditTrail,
    statusHistory: Array.isArray(order.statusHistory)
      ? order.statusHistory.map((entry) => normalizeStatusHistoryEntry(entry, fulfillmentMode))
      : order.statusHistory,
    items: Array.isArray(order.items) ? order.items.map(normalizeOrderItem) : [],
  };
};

const normalizeCustomerTags = (tags) =>
  (Array.isArray(tags) ? tags : [])
    .map((tag) => String(tag || "").trim().toLowerCase())
    .filter((tag, index, list) =>
      tag && CUSTOMER_CRM_TAG_OPTIONS.some((option) => option.key === tag) && list.indexOf(tag) === index
    );

const normalizeCustomerCrmRecord = (customer = {}) => ({
  ...customer,
  key: String(customer.key || customer.customerKey || "").trim(),
  customerKey: String(customer.customerKey || customer.key || "").trim(),
  customerName: String(customer.customerName || "Cliente sem nome").trim(),
  customerPhone: String(customer.customerPhone || "").trim(),
  customerEmail: String(customer.customerEmail || "").trim(),
  whatsappUrl: String(customer.whatsappUrl || "").trim(),
  ordersCount: Number(customer.ordersCount || 0),
  revenueOrderCount: Number(customer.revenueOrderCount || 0),
  activeOrders: Number(customer.activeOrders || 0),
  cancelledOrders: Number(customer.cancelledOrders || 0),
  totalSpent: Number(customer.totalSpent || 0),
  averageTicket: Number(customer.averageTicket || 0),
  totalItems: Number(customer.totalItems || 0),
  lastOrderAt: String(customer.lastOrderAt || "").trim(),
  lastPurchaseAt: String(customer.lastPurchaseAt || customer.lastOrderAt || "").trim(),
  daysSinceLastPurchase:
    typeof customer.daysSinceLastPurchase === "number" ? customer.daysSinceLastPurchase : null,
  lastOrderPublicId: String(customer.lastOrderPublicId || "").trim(),
  lastStatus: String(customer.lastStatus || "").trim(),
  mostUsedAddress: String(customer.mostUsedAddress || "").trim(),
  topItems: Array.isArray(customer.topItems) ? customer.topItems : [],
  orders: Array.isArray(customer.orders) ? customer.orders.map(normalizeOrderRecord).filter(Boolean) : [],
  notes: String(customer.notes || "").trim(),
  tags: normalizeCustomerTags(customer.tags),
  updatedAt: String(customer.updatedAt || "").trim(),
  updatedByDisplayName: String(customer.updatedByDisplayName || "").trim(),
  isRecurring: Boolean(customer.isRecurring || Number(customer.ordersCount || 0) >= 2),
  isLapsed: Boolean(customer.isLapsed),
  suggestedAction: String(customer.suggestedAction || "Mandar mensagem no WhatsApp").trim(),
});

const normalizeCustomerCrmSnapshot = (payload = {}) => ({
  summary: {
    totalCustomers: Number(payload.summary?.totalCustomers || 0),
    recurringCustomers: Number(payload.summary?.recurringCustomers || 0),
    vipCustomers: Number(payload.summary?.vipCustomers || 0),
    attentionCustomers: Number(payload.summary?.attentionCustomers || 0),
    blockedCustomers: Number(payload.summary?.blockedCustomers || 0),
    lapsedCustomers: Number(payload.summary?.lapsedCustomers || 0),
    totalOrders: Number(payload.summary?.totalOrders || 0),
    totalSpent: Number(payload.summary?.totalSpent || 0),
    averageTicket: Number(payload.summary?.averageTicket || 0),
    inactiveDays: Number(payload.summary?.inactiveDays || 30),
  },
  tagOptions: Array.isArray(payload.tagOptions) && payload.tagOptions.length > 0
    ? payload.tagOptions
    : CUSTOMER_CRM_TAG_OPTIONS.filter((option) => option.key),
  customers: Array.isArray(payload.customers) ? payload.customers.map(normalizeCustomerCrmRecord) : [],
});

const normalizeAuditLogEntry = (entry) => ({
  ...entry,
  status:
    resolveCanonicalOrderStatus(
      entry?.status,
      entry?.metadata?.fulfillmentMode || entry?.metadata?.fulfillment_mode || ""
    ) ||
    String(entry?.status || "").trim(),
});

const normalizeInventoryItem = (item = {}) => {
  const statusKey = String(item?.status?.key || item?.status || "ok").trim().toLowerCase();
  const statusMeta = INVENTORY_STATUS_META[statusKey] || INVENTORY_STATUS_META.ok;
  const expiration = item?.expiration && typeof item.expiration === "object" ? item.expiration : {};

  return {
    id: String(item.id || "").trim(),
    name: String(item.name || "").trim(),
    category: String(item.category || "Sem categoria").trim(),
    quantity: Number(item.quantity || 0),
    unit: String(item.unit || "unidade").trim(),
    minimumQuantity: Number(item.minimumQuantity || 0),
    expirationDate: String(item.expirationDate || "").trim(),
    source: String(item.source || "manual").trim(),
    createdAt: String(item.createdAt || "").trim(),
    updatedAt: String(item.updatedAt || "").trim(),
    status: {
      ...statusMeta,
      ...(item?.status && typeof item.status === "object" ? item.status : {}),
      key: statusKey in INVENTORY_STATUS_META ? statusKey : "ok",
    },
    expiration: {
      key: String(expiration.key || "none").trim(),
      label: String(expiration.label || "Sem validade").trim(),
      daysToExpire:
        typeof expiration.daysToExpire === "number" && Number.isFinite(expiration.daysToExpire)
          ? expiration.daysToExpire
          : null,
      isExpired: Boolean(expiration.isExpired),
      isExpiringSoon: Boolean(expiration.isExpiringSoon),
    },
  };
};

const getEmptyInventorySnapshot = () => ({
  summary: {
    totalItems: 0,
    totalCategories: 0,
    okItems: 0,
    lowItems: 0,
    criticalItems: 0,
    expiringSoonItems: 0,
    expiredItems: 0,
    importedItems: 0,
  },
  categories: [],
  items: [],
  seedSummary: {
    categories: 0,
    items: 0,
  },
  sourceDocument: "",
});

const normalizeInventorySnapshot = (payload = {}) => {
  const emptySnapshot = getEmptyInventorySnapshot();
  const items = Array.isArray(payload.items) ? payload.items.map(normalizeInventoryItem) : [];
  const categories = Array.isArray(payload.categories)
    ? payload.categories.map((category) => String(category || "").trim()).filter(Boolean)
    : [...new Set(items.map((item) => item.category).filter(Boolean))];

  return {
    ...emptySnapshot,
    ...payload,
    summary: {
      ...emptySnapshot.summary,
      ...(payload.summary || {}),
    },
    seedSummary: {
      ...emptySnapshot.seedSummary,
      ...(payload.seedSummary || {}),
    },
    sourceDocument: String(payload.sourceDocument || "").trim(),
    categories,
    items,
  };
};

const normalizeStatsPayload = (stats) => {
  if (!stats || typeof stats !== "object") {
    return stats;
  }

  const byStatus = ORDER_STATUSES.reduce((summary, status) => {
    summary[status] = Number(stats?.byStatus?.[status] || 0);
    return summary;
  }, {});

  return {
    ...stats,
    byStatus,
    newOrders: Number(stats.newOrders || byStatus.Recebido || 0),
    activeOrders: Number(stats.activeOrders || 0),
    scheduledOrders: Number(stats.scheduledOrders || 0),
    preparingOrders: Number(stats.preparingOrders || byStatus["Em preparo"] || 0),
    readyOrders: Number(stats.readyOrders || byStatus.Pronto || 0),
    deliveryOrders: Number(stats.deliveryOrders || byStatus["Saiu para entrega"] || 0),
  };
};

const formatMetricUnitValue = (value, unit = "count") => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "--";
  }

  if (unit === "currency") {
    return formatMoney(numericValue);
  }

  if (unit === "percent") {
    return formatPercent(numericValue);
  }

  if (unit === "duration") {
    return formatDuration(numericValue);
  }

  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: numericValue % 1 === 0 ? 0 : 1,
  }).format(numericValue);
};

const formatMetricDeltaPercent = (metric) => {
  const deltaPercent = metric?.deltaPercent;
  const numericValue = typeof deltaPercent === "number" ? deltaPercent : NaN;

  if (Number.isFinite(numericValue)) {
    const sign = numericValue > 0 ? "+" : "";
    return `${sign}${numericValue.toFixed(1)}%`;
  }

  if (Number(metric?.currentValue || 0) > 0 && Number(metric?.previousValue || 0) === 0) {
    return "Novo";
  }

  return "0%";
};

const getMetricToneClass = (metric) => {
  if (metric?.tone === "positive") {
    return "is-positive";
  }

  if (metric?.tone === "negative") {
    return "is-negative";
  }

  return "is-neutral";
};

const getMetricDirectionLabel = (metric) => {
  if (metric?.direction === "up") {
    return "Alta";
  }

  if (metric?.direction === "down") {
    return "Queda";
  }

  return "Estavel";
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;

  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    const requestError = new Error(data?.error || "Nao foi possivel concluir a operacao.");
    requestError.status = response.status;
    requestError.errorCode = data?.errorCode || "request_error";
    requestError.payload = data;
    throw requestError;
  }

  return data || {};
};

const setFeedback = (node, message, tone = "error") => {
  if (!node) {
    return;
  }

  if (!message) {
    node.hidden = true;
    node.textContent = "";
    node.classList.remove("is-error", "is-success");
    return;
  }

  node.hidden = false;
  node.textContent = message;
  node.classList.toggle("is-error", tone === "error");
  node.classList.toggle("is-success", tone === "success");
};

const formatMissingAdminRequirement = (requirement) => {
  const envNames = Array.isArray(requirement?.acceptedEnvNames)
    ? requirement.acceptedEnvNames.filter(Boolean)
    : [];

  if (!envNames.length) {
    return "";
  }

  return envNames.join(" ou ");
};

const formatAdminLoginError = (error) => {
  if (!error) {
    return "Nao foi possivel concluir a operacao.";
  }

  if (error.errorCode === "admin_not_configured") {
    const missingRequirements = Array.isArray(error?.payload?.missingRequirements)
      ? error.payload.missingRequirements
      : [];
    const missingLabels = missingRequirements
      .map((requirement) => formatMissingAdminRequirement(requirement))
      .filter(Boolean);

    if (missingLabels.length) {
      return `Login administrativo nao configurado. Configure: ${missingLabels.join("; ")}.`;
    }

    return "Login administrativo nao configurado no servidor.";
  }

  return error.message || "Nao foi possivel concluir a operacao.";
};

const getSafeAdminRedirect = () => {
  const nextParam = new URLSearchParams(window.location.search).get("next");

  if (nextParam && nextParam.startsWith("/admin")) {
    return nextParam;
  }

  return "/admin/";
};

const redirectToLogin = () => {
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.href = `/admin/login.html?next=${encodeURIComponent(next)}`;
};

const buildStorageLabel = (storageMode) => {
  if (storageMode === "neon") {
    return "Banco Neon conectado";
  }

  if (storageMode === "file") {
    return "Modo local de desenvolvimento";
  }

  return "Configuracao pendente";
};

const getAdminDisplayInitials = (value) => {
  const tokens = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return "A";
  }

  return tokens
    .slice(0, 2)
    .map((token) => token.charAt(0).toUpperCase())
    .join("");
};

const getOrdersNotificationCount = () =>
  getVisibleOperationalOrders().filter((order) => order.status === "Recebido").length;

const buildCatalogLookupKeys = (item = {}) => {
  const keys = new Set();
  const sourceItemId = String(item.sourceItemId || item.id || "").trim();
  const itemName = String(item.name || "").trim().toLowerCase();
  const itemCategory = String(item.category || "").trim().toLowerCase();

  if (sourceItemId) {
    keys.add(sourceItemId);
  }

  if (itemName && itemCategory) {
    keys.add(`${itemName}::${itemCategory}`);
  }

  if (itemName) {
    keys.add(itemName);
  }

  return [...keys];
};

const getOrderItemThumbnailUrl = (item) => {
  const directImage = resolveAdminAssetUrl(
    item?.image || item?.metadata?.image || item?.metadata?.thumbnail || item?.metadata?.thumb || ""
  );

  if (directImage) {
    return directImage;
  }

  if (!(adminState.publicCatalogItems instanceof Map)) {
    return "";
  }

  for (const key of buildCatalogLookupKeys(item)) {
    const catalogItem = adminState.publicCatalogItems.get(key);
    const catalogImage = resolveAdminAssetUrl(catalogItem?.image || "");

    if (catalogImage) {
      return catalogImage;
    }
  }

  return "";
};

const getOrderTypeLabel = (order) => {
  if (order.orderType === "scheduled" || order.timingMode === "scheduled") {
    return "Agendamento";
  }

  return order.fulfillmentMode === "pickup" ? "Retirada" : "Entrega";
};

const getTimingLabel = (order) => {
  if (order.timingMode === "scheduled" && order.scheduledLabel) {
    return `Agendado: ${order.scheduledLabel}`;
  }

  return "Pedido imediato";
};

const OPERATIONAL_STATUS_REASON_LABELS = {
  closed_day: "Dia fechado",
  special_date_closed: "Data especial fechada",
  before_open: "Antes da abertura",
  after_close: "Apos o fechamento",
  pause: "Durante a pausa",
  invalid_window: "Horario configurado invalido",
};

const getOrderOperationalStatusSnapshot = (order) => {
  const rawPayload = order?.rawPayload && typeof order.rawPayload === "object" ? order.rawPayload : {};
  const snapshot = rawPayload.operationalStatus || order?.operationalStatus || null;

  return snapshot && typeof snapshot === "object" ? snapshot : null;
};

const getOperationalStatusLabel = (snapshot) => {
  if (!snapshot) {
    return "";
  }

  if (snapshot.isOpen) {
    return "Aberto no momento do pedido";
  }

  if (snapshot.acceptsOrdersOutsideHours || snapshot.acceptsImmediateOrders) {
    return "Fechado, liberado pela configuracao";
  }

  if (snapshot.orderTimingMode === "scheduled" && !snapshot.immediateValidationApplied) {
    return "Agendado, sem bloqueio nesta etapa";
  }

  return "Fechado, bloqueio aplicado";
};

const getOperationalValidationLabel = (snapshot) => {
  if (!snapshot) {
    return "";
  }

  if (snapshot.immediateValidationApplied || snapshot.validationApplied) {
    return "Pedido imediato validado";
  }

  if (snapshot.orderTimingMode === "scheduled") {
    return "Pedido agendado preservado";
  }

  return "Snapshot informativo";
};

const getOperationalReasonLabel = (snapshot) => {
  const closedReason = String(snapshot?.closedReason || "").trim();

  if (!closedReason) {
    return snapshot?.isOpen ? "Dentro do horario" : "Sem motivo registrado";
  }

  return OPERATIONAL_STATUS_REASON_LABELS[closedReason] || closedReason;
};

const getOperationalSpecialDateLabel = (snapshot) => {
  const specialDate =
    snapshot?.activeSpecialDate && typeof snapshot.activeSpecialDate === "object"
      ? snapshot.activeSpecialDate
      : snapshot?.specialDate && typeof snapshot.specialDate === "object"
        ? snapshot.specialDate
        : null;

  if (!snapshot?.isSpecialDateActive && !specialDate) {
    return "Nao";
  }

  return [specialDate?.name, specialDate?.date].filter(Boolean).join(" | ") || "Sim";
};

const getOperationalLocalDateTimeLabel = (snapshot) =>
  [snapshot?.localDate, snapshot?.localTime].filter(Boolean).join(" ") ||
  (snapshot?.checkedAt ? formatDateTime(snapshot.checkedAt) : "Nao informado");

const renderOrderOperationalStatusCard = (order) => {
  const snapshot = getOrderOperationalStatusSnapshot(order);

  if (!snapshot) {
    return "";
  }

  const optionalRows = [
    snapshot.nextOpeningLabel
      ? `<span class="admin-detail-summary-item"><strong>Proxima abertura</strong><span>${escapeHtml(snapshot.nextOpeningLabel)}</span></span>`
      : "",
    snapshot.message || snapshot.specialDateNotice
      ? `<span class="admin-detail-summary-item"><strong>Mensagem</strong><span>${escapeHtml(
          snapshot.message || snapshot.specialDateNotice
        )}</span></span>`
      : "",
  ].join("");

  return `
    <section class="admin-detail-card admin-detail-card-operational-status">
      <div class="admin-detail-card-head">
        <h3>Funcionamento aplicado</h3>
        <span>${escapeHtml(getOperationalValidationLabel(snapshot))}</span>
      </div>
      <div class="admin-detail-summary-list">
        <span class="admin-detail-summary-item"><strong>Status</strong><span>${escapeHtml(
          getOperationalStatusLabel(snapshot)
        )}</span></span>
        <span class="admin-detail-summary-item"><strong>Data/hora local</strong><span>${escapeHtml(
          getOperationalLocalDateTimeLabel(snapshot)
        )}</span></span>
        <span class="admin-detail-summary-item"><strong>Horario</strong><span>${escapeHtml(
          snapshot.todayHoursLabel || [snapshot.openTime, snapshot.closeTime].filter(Boolean).join(" as ") || "Nao informado"
        )}</span></span>
        <span class="admin-detail-summary-item"><strong>Data especial</strong><span>${escapeHtml(
          getOperationalSpecialDateLabel(snapshot)
        )}</span></span>
        <span class="admin-detail-summary-item"><strong>Fora do horario</strong><span>${escapeHtml(
          snapshot.acceptsOrdersOutsideHours ? "Aceita" : "Nao aceita"
        )}</span></span>
        <span class="admin-detail-summary-item"><strong>Motivo</strong><span>${escapeHtml(
          getOperationalReasonLabel(snapshot)
        )}</span></span>
        ${optionalRows}
      </div>
    </section>
  `;
};

const getDetailHeaderTimingValue = (order) => {
  if (order.timingMode === "scheduled" && order.scheduledLabel) {
    return order.scheduledLabel;
  }

  return formatTime(order.createdAt);
};

const getPaymentLabel = (paymentMethod) => {
  switch (paymentMethod) {
    case "dinheiro":
      return "Dinheiro";
    case "credito":
      return "Cartao de credito";
    case "debito":
      return "Cartao de debito";
    case "pix":
      return "Pix";
    default:
      return "Nao informado";
  }
};

const getStatusClassName = (status) => {
  const normalizedStatus = normalizeStatusKey(status);

  if (normalizedStatus === "recebido" || normalizedStatus === "novo") {
    return "admin-order-status is-new";
  }

  if (normalizedStatus === "aceito" || normalizedStatus === "confirmado") {
    return "admin-order-status is-confirmed";
  }

  if (normalizedStatus === "em preparo") {
    return "admin-order-status is-preparing";
  }

  if (normalizedStatus === "pronto") {
    return "admin-order-status is-ready";
  }

  if (normalizedStatus === "saiu para entrega") {
    return "admin-order-status is-delivering";
  }

  if (
    normalizedStatus === "entregue" ||
    normalizedStatus === "retirada concluida" ||
    normalizedStatus === normalizeStatusKey(LEGACY_FINALIZED_STATUS)
  ) {
    return "admin-order-status is-finished";
  }

  if (normalizedStatus === "cancelado") {
    return "admin-order-status is-cancelled";
  }

  return "admin-order-status";
};

const getAuditActionLabel = (action, status = "") => {
  const normalizedAction = String(action || "").trim();
  const canonicalStatus = resolveCanonicalOrderStatus(status) || String(status || "").trim();

  if (normalizedAction === "order_finalized" && canonicalStatus === "Retirada concluida") {
    return "Retirada concluida";
  }

  return AUDIT_ACTION_LABELS[normalizedAction] || (canonicalStatus ? `Status ${canonicalStatus}` : "Atualizacao operacional");
};

const getAuditActorLabel = (entry) =>
  entry?.adminDisplayName || entry?.adminLogin || (entry?.source === "system" ? "Sistema" : "Gestor");

const getNowTimestamp = () => Date.now();

const getCustomerInitials = (name) => {
  const parts = String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "TK";
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
};

const getSectionMeta = () => SECTION_TITLES[adminState.activeSection] || SECTION_TITLES.orders;

const normalizeInventorySearchValue = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const getInventorySnapshot = () => normalizeInventorySnapshot(adminState.inventorySnapshot || {});

const getInventoryStatusMeta = (status) => {
  const statusKey = String(status?.key || status || "ok").trim().toLowerCase();
  return INVENTORY_STATUS_META[statusKey] || INVENTORY_STATUS_META.ok;
};

const formatInventoryQuantity = (value) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(value || 0));

const getVisibleInventoryItems = () => {
  const snapshot = getInventorySnapshot();
  const query = normalizeInventorySearchValue(adminState.searchQuery);
  const categoryFilter = normalizeInventorySearchValue(adminState.inventoryFilters.category);
  const statusFilter = String(adminState.inventoryFilters.status || "").trim().toLowerCase();

  return snapshot.items.filter((item) => {
    const itemSearchValue = normalizeInventorySearchValue(
      `${item.name} ${item.category} ${item.unit} ${item.status?.label || ""}`
    );
    const matchesQuery = !query || itemSearchValue.includes(query);
    const matchesCategory =
      !categoryFilter || normalizeInventorySearchValue(item.category) === categoryFilter;
    const matchesStatus = !statusFilter || item.status.key === statusFilter;

    return matchesQuery && matchesCategory && matchesStatus;
  });
};

const getSelectedInventoryItem = () => {
  if (adminState.selectedInventoryItemId === INVENTORY_NEW_ITEM_ID) {
    return null;
  }

  const snapshot = getInventorySnapshot();
  return snapshot.items.find((item) => item.id === adminState.selectedInventoryItemId) || null;
};

const getInventoryGroups = () => {
  const groups = new Map();

  getVisibleInventoryItems().forEach((item) => {
    const category = item.category || "Sem categoria";

    if (!groups.has(category)) {
      groups.set(category, []);
    }

    groups.get(category).push(item);
  });

  return Array.from(groups.entries()).map(([category, items]) => ({
    category,
    items: items.sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
  }));
};

const buildCustomerRecordKey = (order) => {
  const phone = String(order.customerPhone || "").replace(/\D/g, "");
  const email = String(order.customerEmail || "").trim().toLowerCase();
  const name = String(order.customerName || "").trim().toLowerCase();
  return phone || email || name || order.id;
};

const isClosedOrder = (order) => FINAL_ORDER_STATUSES.has(resolveCanonicalOrderStatus(order?.status, order?.fulfillmentMode));

const isCompletedOrder = (order) => {
  const status = resolveCanonicalOrderStatus(order?.status, order?.fulfillmentMode);
  return status === "Entregue" || status === "Retirada concluida";
};

const getOrderScheduledTimestamp = (order) => {
  const timestamp = new Date(order?.scheduledFor || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
};

const isScheduledAwaitingActivation = (order, nowTimestamp = getNowTimestamp()) => {
  if (!order || isClosedOrder(order)) {
    return false;
  }

  if (String(order.timingMode || "").trim().toLowerCase() !== "scheduled") {
    return false;
  }

  const scheduledTimestamp = getOrderScheduledTimestamp(order);
  return Number.isFinite(scheduledTimestamp) && scheduledTimestamp > nowTimestamp;
};

const isScheduledDueSoon = (order, nowTimestamp = getNowTimestamp()) => {
  if (!isScheduledAwaitingActivation(order, nowTimestamp)) {
    return false;
  }

  return getOrderScheduledTimestamp(order) - nowTimestamp <= SCHEDULE_DUE_SOON_WINDOW_MS;
};

const getScheduledStatusLabel = (order) =>
  isScheduledDueSoon(order) ? "Proximo do horario" : "Agendado";

const getScheduledTimeDistanceLabel = (order) => {
  const scheduledTimestamp = getOrderScheduledTimestamp(order);

  if (!Number.isFinite(scheduledTimestamp) || scheduledTimestamp === Number.MAX_SAFE_INTEGER) {
    return "Horario nao informado";
  }

  const remainingMs = Math.max(0, scheduledTimestamp - getNowTimestamp());
  return remainingMs === 0 ? "Liberando agora" : `Faltam ${formatDuration(remainingMs)}`;
};

const getOrderWaitDurationMs = (order) => {
  const startedAt = new Date(order?.createdAt || 0).getTime();

  if (!Number.isFinite(startedAt)) {
    return 0;
  }

  const isClosed = isClosedOrder(order);
  const endedAt = isClosed ? new Date(order?.updatedAt || order?.createdAt || 0).getTime() : Date.now();

  if (!Number.isFinite(endedAt) || endedAt <= startedAt) {
    return 0;
  }

  return endedAt - startedAt;
};

const getOrderWaitLabel = (order) => {
  const waitLabel = formatDuration(getOrderWaitDurationMs(order));
  return waitLabel === "--" ? "Agora" : waitLabel;
};

const getOrderQuickNote = (order) =>
  String(order?.customerNotes || order?.latestStatusNote || "").replace(/\s+/g, " ").trim() ||
  "Sem observacoes rapidas.";

const getNonCancelledOrders = () => adminState.orders.filter((order) => order.status !== "Cancelado");

const getClosedOrders = () =>
  adminState.orders
    .filter((order) => isClosedOrder(order) && matchesSearchQuery(order))
    .sort((left, right) => new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt));

const getCompletedOrders = () => getClosedOrders().filter(isCompletedOrder);

const getCancelledOrders = () => getClosedOrders().filter((order) => order.status === "Cancelado");

const getReadyForDispatchOrders = () =>
  adminState.orders.filter(
    (order) =>
      matchesSearchQuery(order) &&
      order.status === "Pronto" &&
      order.fulfillmentMode === "delivery"
  );

const getPickupReadyOrders = () =>
  adminState.orders.filter(
    (order) =>
      matchesSearchQuery(order) &&
      order.status === "Pronto" &&
      order.fulfillmentMode === "pickup"
  );

const getRouteOrders = () =>
  adminState.orders.filter(
    (order) => matchesSearchQuery(order) && order.status === "Saiu para entrega"
  );

const getScheduledDeliveryOrders = () =>
  adminState.orders.filter(
    (order) =>
      matchesSearchQuery(order) &&
      order.timingMode === "scheduled" &&
      order.fulfillmentMode === "delivery" &&
      isScheduledAwaitingActivation(order)
  );

const getScheduledSnapshot = () =>
  adminState.scheduledSnapshot || {
    summary: {
      totalOrders: 0,
      deliveryOrders: 0,
      pickupOrders: 0,
      dueSoonOrders: 0,
      nextScheduledAt: "",
    },
    orders: [],
  };

const getVisibleScheduledOrders = () =>
  getScheduledSnapshot().orders.filter((order) => matchesSearchQuery(order));

const getVisibleMenuSections = () => {
  const menuSnapshot = adminState.menuSnapshot || { sections: [] };
  const sectionFilter = String(adminState.menuFilters.sectionId || "").trim();
  const availabilityFilter = String(adminState.menuFilters.availabilityState || "").trim().toLowerCase();
  const query = String(adminState.searchQuery || "").trim().toLowerCase();

  return menuSnapshot.sections
    .filter((section) => !sectionFilter || section.id === sectionFilter)
    .map((section) => ({
      ...section,
      items: (Array.isArray(section.items) ? section.items : []).filter((item) => {
        if (availabilityFilter && item.availabilityState !== availabilityFilter) {
          return false;
        }

        if (!query) {
          return true;
        }

        const searchableValue = [
          item.id,
          item.name,
          item.category,
          item.description,
          section.title,
          item.availabilityLabel,
        ]
          .join(" ")
          .toLowerCase();

        return searchableValue.includes(query);
      }),
    }))
    .filter((section) => section.items.length > 0 || (!query && !availabilityFilter && !sectionFilter));
};

const getPromotionsSnapshot = () =>
  adminState.promotionsSnapshot || {
    summary: {
      totalPromotions: 0,
      activePromotions: 0,
      scheduledPromotions: 0,
      endedPromotions: 0,
      enabledPromotions: 0,
      affectedItems: 0,
    },
    promotions: [],
    catalogOptions: {
      items: [],
      categories: [],
    },
  };

const getVisiblePromotions = () => {
  const snapshot = getPromotionsSnapshot();
  const statusFilter = String(adminState.promotionsFilters.status || "").trim().toLowerCase();
  const query = String(adminState.searchQuery || "").trim().toLowerCase();

  return snapshot.promotions.filter((promotion) => {
    if (statusFilter && promotion.status !== statusFilter) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchableValue = [
      promotion.internalName,
      promotion.statusLabel,
      promotion.targetLabel,
      promotion.pricingLabel,
      promotion.scopeLabel,
      promotion.startsAt,
      promotion.endsAt,
      ...(Array.isArray(promotion.affectedItemsPreview) ? promotion.affectedItemsPreview : []),
    ]
      .join(" ")
      .toLowerCase();

    return searchableValue.includes(query);
  });
};

const getSelectedPromotion = () => {
  const snapshot = getPromotionsSnapshot();
  return (
    getVisiblePromotions().find((promotion) => promotion.id === adminState.selectedPromotionId) ||
    snapshot.promotions.find((promotion) => promotion.id === adminState.selectedPromotionId) ||
    null
  );
};

const getReviewsSnapshot = () =>
  adminState.reviewsSnapshot || {
    summary: {
      totalReviews: 0,
      publishedReviews: 0,
      hiddenReviews: 0,
      expiredReviews: 0,
      recentReviews: 0,
      internalAverage: 0,
      displayAverage: 0,
    },
    reviews: [],
  };

const buildReviewStars = (rating) => {
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  return `${"★".repeat(safeRating)}${"☆".repeat(Math.max(0, 5 - safeRating))}`;
};

const getReviewStatusClassName = (status) => {
  if (status === "published") {
    return "admin-inline-chip is-promo";
  }

  if (status === "hidden") {
    return "admin-inline-chip is-warning";
  }

  return "admin-inline-chip";
};

const getVisibleReviews = () => {
  const snapshot = getReviewsSnapshot();
  const statusFilter = String(adminState.reviewsFilters.status || "").trim().toLowerCase();
  const ratingFilter = String(adminState.reviewsFilters.rating || "").trim();
  const query = String(adminState.searchQuery || "").trim().toLowerCase();

  return snapshot.reviews.filter((review) => {
    if (statusFilter) {
      if (statusFilter === "recent" && !review.isRecent) {
        return false;
      }

      if (statusFilter !== "recent" && review.status !== statusFilter) {
        return false;
      }
    }

    if (ratingFilter && String(review.rating || "") !== ratingFilter) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchableValue = [
      review.customerName,
      review.customerContact,
      review.customerPhone,
      review.customerEmail,
      review.message,
      review.statusLabel,
      review.publicationLabel,
      review.source,
    ]
      .join(" ")
      .toLowerCase();

    return searchableValue.includes(query);
  });
};

const getSelectedReview = () => {
  const snapshot = getReviewsSnapshot();
  return (
    getVisibleReviews().find((review) => review.id === adminState.selectedReviewId) ||
    snapshot.reviews.find((review) => review.id === adminState.selectedReviewId) ||
    null
  );
};

const getDateTimeInputValue = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getPromotionStatusClassName = (status) => {
  if (status === "active") {
    return "admin-inline-chip is-promo";
  }

  if (status === "scheduled") {
    return "admin-inline-chip is-due-soon";
  }

  return "admin-inline-chip is-warning";
};

const getPromotionPricingValueLabel = (promotion) => {
  if (promotion.pricingType === "percent_discount") {
    return `${Number(promotion.discountPercent || 0)}% OFF`;
  }

  return typeof promotion.fixedPrice === "number"
    ? formatMoney(promotion.fixedPrice)
    : "Preco fixo";
};

const getPromotionPricePreviewLabel = (promotion) => {
  if (typeof promotion.activePricePreview === "number") {
    return formatMoney(promotion.activePricePreview);
  }

  return promotion.pricingType === "fixed_price" ? "Preco fixo" : "Desconto variavel";
};

const getPromotionDateRangeLabel = (promotion) =>
  `${formatDateTime(promotion.startsAt)} ate ${formatDateTime(promotion.endsAt)}`;

const createPromotionDraft = () => ({
  id: "",
  internalName: "",
  scopeType: "item",
  targetValue: "",
  pricingType: "fixed_price",
  fixedPrice: null,
  discountPercent: null,
  startsAt: "",
  endsAt: "",
  isEnabled: true,
});

const getCustomerRecords = () => {
  const groupedCustomers = new Map();

  adminState.orders.filter(matchesSearchQuery).forEach((order) => {
    const key = buildCustomerRecordKey(order);
    const currentRecord = groupedCustomers.get(key) || {
      key,
      customerName: order.customerName,
      customerPhone: order.customerPhone || "",
      customerEmail: order.customerEmail || "",
      ordersCount: 0,
      activeOrders: 0,
      cancelledOrders: 0,
      totalRevenue: 0,
      totalItems: 0,
      paymentMethods: new Set(),
      lastOrderAt: "",
      lastOrderPublicId: "",
      lastStatus: "",
      favoriteFulfillment: "",
      orders: [],
    };

    currentRecord.ordersCount += 1;
    currentRecord.totalItems += Number(order.itemCount || 0);
    currentRecord.totalRevenue += order.status === "Cancelado" ? 0 : Number(order.totalAmount || 0);

    if (!isClosedOrder(order)) {
      currentRecord.activeOrders += 1;
    }

    if (order.status === "Cancelado") {
      currentRecord.cancelledOrders += 1;
    }

    if (order.paymentMethod) {
      currentRecord.paymentMethods.add(order.paymentMethod);
    }

    currentRecord.orders.push(order);

    if (!currentRecord.lastOrderAt || new Date(order.createdAt) > new Date(currentRecord.lastOrderAt)) {
      currentRecord.lastOrderAt = order.createdAt;
      currentRecord.lastOrderPublicId = order.publicId;
      currentRecord.lastStatus = order.status;
      currentRecord.favoriteFulfillment = getOrderTypeLabel(order);
      currentRecord.customerName = order.customerName;
      currentRecord.customerPhone = order.customerPhone || currentRecord.customerPhone;
      currentRecord.customerEmail = order.customerEmail || currentRecord.customerEmail;
    }

    groupedCustomers.set(key, currentRecord);
  });

  return Array.from(groupedCustomers.values())
    .map((record) => ({
      ...record,
      averageTicket: record.ordersCount > 0 ? record.totalRevenue / record.ordersCount : 0,
      paymentSummary: Array.from(record.paymentMethods).map(getPaymentLabel).join(", ") || "Nao informado",
      orders: record.orders.sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)),
    }))
    .sort((left, right) => {
      if (right.activeOrders !== left.activeOrders) {
        return right.activeOrders - left.activeOrders;
      }

      if (right.ordersCount !== left.ordersCount) {
        return right.ordersCount - left.ordersCount;
      }

      return new Date(right.lastOrderAt || 0) - new Date(left.lastOrderAt || 0);
    });
};

const getSelectedCustomerRecord = () => {
  const customers = getCustomerRecords();

  if (customers.length === 0) {
    return null;
  }

  return (
    customers.find((customer) => customer.key === adminState.selectedCustomerKey) || customers[0] || null
  );
};

const getCustomerCrmSnapshot = () =>
  adminState.customersSnapshot || {
    summary: {
      totalCustomers: 0,
      recurringCustomers: 0,
      vipCustomers: 0,
      attentionCustomers: 0,
      blockedCustomers: 0,
      lapsedCustomers: 0,
      totalOrders: 0,
      totalSpent: 0,
      averageTicket: 0,
      inactiveDays: 30,
    },
    tagOptions: CUSTOMER_CRM_TAG_OPTIONS.filter((option) => option.key),
    customers: [],
  };

const getCustomerTagLabel = (tagKey) =>
  CUSTOMER_CRM_TAG_OPTIONS.find((option) => option.key === tagKey)?.label || tagKey;

const getCustomerDaysSinceLabel = (customer) => {
  if (typeof customer?.daysSinceLastPurchase !== "number") {
    return "Sem compra registrada";
  }

  if (customer.daysSinceLastPurchase === 0) {
    return "Comprou hoje";
  }

  if (customer.daysSinceLastPurchase === 1) {
    return "1 dia sem comprar";
  }

  return `${customer.daysSinceLastPurchase} dias sem comprar`;
};

const customerMatchesCrmSearch = (customer, query) => {
  if (!query) {
    return true;
  }

  const searchableValue = normalizeInventorySearchValue(
    [
      customer.customerName,
      customer.customerPhone,
      customer.customerEmail,
      customer.mostUsedAddress,
      customer.lastOrderPublicId,
      customer.tags.join(" "),
    ].join(" ")
  );

  return searchableValue.includes(query);
};

const customerMatchesCrmTag = (customer, tag) => {
  if (!tag) {
    return true;
  }

  if (tag === "recorrente") {
    return customer.isRecurring || customer.tags.includes(tag);
  }

  return customer.tags.includes(tag);
};

const sortCustomerCrmRecords = (customers) => {
  const sortBy = String(adminState.customerFilters.sortBy || "recent").trim();

  return customers.slice().sort((left, right) => {
    if (sortBy === "spend-desc" && right.totalSpent !== left.totalSpent) {
      return right.totalSpent - left.totalSpent;
    }

    if (sortBy === "orders-desc" && right.ordersCount !== left.ordersCount) {
      return right.ordersCount - left.ordersCount;
    }

    if (sortBy === "lapsed-desc") {
      return Number(right.daysSinceLastPurchase || 0) - Number(left.daysSinceLastPurchase || 0);
    }

    return new Date(right.lastPurchaseAt || right.lastOrderAt || 0) - new Date(left.lastPurchaseAt || left.lastOrderAt || 0);
  });
};

const getVisibleCustomerCrmRecords = () => {
  const snapshot = getCustomerCrmSnapshot();
  const query = normalizeInventorySearchValue(adminState.searchQuery);
  const tagFilter = String(adminState.customerFilters.tag || "").trim().toLowerCase();
  const inactiveDays = Number.parseInt(String(adminState.customerFilters.inactiveDays || ""), 10);

  return sortCustomerCrmRecords(
    snapshot.customers.filter((customer) => {
      if (!customerMatchesCrmSearch(customer, query)) {
        return false;
      }

      if (!customerMatchesCrmTag(customer, tagFilter)) {
        return false;
      }

      if (Number.isFinite(inactiveDays)) {
        return (
          typeof customer.daysSinceLastPurchase === "number" &&
          customer.daysSinceLastPurchase >= inactiveDays
        );
      }

      return true;
    })
  );
};

const getSelectedCustomerCrmRecord = () => {
  const customers = getVisibleCustomerCrmRecords();

  if (customers.length === 0) {
    return null;
  }

  return customers.find((customer) => customer.key === adminState.selectedCustomerKey) || customers[0] || null;
};

const buildCustomerTagChips = (customer) => {
  const automaticTags = [];

  if (customer.isRecurring && !customer.tags.includes("recorrente")) {
    automaticTags.push("Recorrente");
  }

  if (customer.isLapsed) {
    automaticTags.push("Sumiu");
  }

  const manualTags = customer.tags.map(getCustomerTagLabel);
  const allTags = [...manualTags, ...automaticTags];

  if (allTags.length === 0) {
    return '<span class="admin-inline-chip">Sem tag</span>';
  }

  return allTags
    .map((tag) => `<span class="admin-inline-chip">${escapeHtml(tag)}</span>`)
    .join("");
};

const getOrderProductRevenue = (order) =>
  Math.max(0, Number(order?.totalAmount || 0) - Number(order?.deliveryFee || 0));

const getFinancialOverview = () => {
  const visibleOrders = adminState.orders.filter(matchesSearchQuery);
  const nonCancelledOrders = visibleOrders.filter((order) => order.status !== "Cancelado");
  const finalOrders = visibleOrders.filter(isCompletedOrder);
  const cancelledOrders = visibleOrders.filter((order) => order.status === "Cancelado");
  const paymentBreakdown = ["pix", "credito", "debito", "dinheiro"].map((paymentMethod) => {
    const filteredOrders = nonCancelledOrders.filter((order) => order.paymentMethod === paymentMethod);
    return {
      key: paymentMethod,
      label: getPaymentLabel(paymentMethod),
      count: filteredOrders.length,
      total: filteredOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
    };
  });

  return {
    netRevenue: nonCancelledOrders.reduce((sum, order) => sum + getOrderProductRevenue(order), 0),
    grossRevenue: nonCancelledOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
    closedRevenue: finalOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
    cancelledRevenue: cancelledOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
    deliveryFees: nonCancelledOrders.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0),
    averageTicket:
      nonCancelledOrders.length > 0
        ? nonCancelledOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0) /
          nonCancelledOrders.length
        : 0,
    paymentBreakdown,
    transactions: visibleOrders
      .slice()
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)),
  };
};

const getEmptyFinanceSnapshot = () => ({
  generatedAt: "",
  storageMode: "",
  filters: {
    period: adminState.financeFilters.period || "today",
    periodLabel:
      FINANCE_PERIOD_FALLBACK_OPTIONS.find((entry) => entry.key === adminState.financeFilters.period)?.label ||
      "Hoje",
    startDate: adminState.financeFilters.startDate || "",
    endDate: adminState.financeFilters.endDate || "",
    rangeLabel: "Aguardando dados financeiros",
    periodKey: "",
  },
  periodOptions: FINANCE_PERIOD_FALLBACK_OPTIONS,
  overview: {
    grossRevenue: 0,
    netRevenue: 0,
    receivedRevenue: 0,
    deliveryFees: 0,
    deliveryPayout: 0,
    averageTicket: 0,
    paidOrders: 0,
    cancelledOrders: 0,
    pendingAmount: 0,
    pendingOrders: 0,
    discountAmount: 0,
    validOrders: 0,
  },
  paymentBreakdown: [],
  closing: {
    totalExpected: 0,
    totalReceived: 0,
    difference: 0,
    cashExpected: 0,
    pixReceived: 0,
    cardReceived: 0,
    otherReceived: 0,
    countedCash: null,
    notes: "",
  },
  charts: {
    revenueTrend: [],
    paymentMethods: [],
    hourlyOrders: [],
    fulfillment: [],
  },
  deliveryPayoutSettings: {
    mode: "fixed_by_band",
    percentage: 0,
    manualAmount: 0,
  },
  orders: [],
  transactions: [],
});

const getFinanceSnapshot = () => adminState.financeSnapshot || getEmptyFinanceSnapshot();

const getFinanceStatusLabel = (status) => {
  if (status === "paid") {
    return "Pago";
  }

  if (status === "cancelled") {
    return "Cancelado";
  }

  return "Pendente";
};

const getFinanceStatusClassName = (status) => {
  if (status === "paid") {
    return "admin-order-status is-finished";
  }

  if (status === "cancelled") {
    return "admin-order-status is-cancelled";
  }

  return "admin-order-status is-preparing";
};

const getFinancePaymentGroup = (paymentMethod) => {
  if (paymentMethod === "dinheiro") {
    return "dinheiro";
  }

  if (paymentMethod === "pix") {
    return "pix";
  }

  if (paymentMethod === "credito" || paymentMethod === "debito") {
    return "cartao";
  }

  return "online_outros";
};

const getFinancePaymentGroupLabel = (paymentMethod) => {
  const group = getFinancePaymentGroup(paymentMethod);
  const option = FINANCE_PAYMENT_FILTER_OPTIONS.find((entry) => entry.key === group);

  return group === "cartao" ? getPaymentLabel(paymentMethod) : option?.label || "Online/outros";
};

const getFilteredFinanceOrders = () => {
  const snapshot = getFinanceSnapshot();
  const statusFilter = adminState.financeTableFilters.status || "all";
  const paymentFilter = adminState.financeTableFilters.paymentMethod || "all";

  return (Array.isArray(snapshot.orders) ? snapshot.orders : []).filter((order) => {
    if (statusFilter !== "all" && order.financialStatus !== statusFilter) {
      return false;
    }

    if (paymentFilter !== "all" && getFinancePaymentGroup(order.paymentMethod) !== paymentFilter) {
      return false;
    }

    return true;
  });
};

const getFinancePayoutRuleLabel = (settings = {}) => {
  if (settings.mode === "percentage_fee") {
    return `${Number(settings.percentage || 0).toFixed(2).replace(".", ",")}% da taxa`;
  }

  if (settings.mode === "manual") {
    return `${formatMoney(settings.manualAmount || 0)} por entrega`;
  }

  return "Faixa de entrega";
};

const getChartMax = (entries, key = "total") =>
  Math.max(...(Array.isArray(entries) ? entries : []).map((entry) => Number(entry?.[key] || 0)), 0);

const getFinanceBarStyle = (value, max) => {
  const percent = max > 0 ? Math.max(3, Math.min(100, (Number(value || 0) / max) * 100)) : 0;
  return `--bar-size:${percent.toFixed(2)}%`;
};

const escapeCsvValue = (value) => {
  const text = String(value ?? "");

  if (/[",\n;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
};

const downloadTextFile = (filename, content, type = "text/plain;charset=utf-8") => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const exportFinanceCsv = () => {
  const rows = getFilteredFinanceOrders();
  const header = [
    "codigo",
    "cliente",
    "horario",
    "pagamento",
    "subtotal_produtos",
    "entrega",
    "desconto",
    "total",
    "status_financeiro",
  ];
  const csvRows = [
    header.join(";"),
    ...rows.map((order) =>
      [
        order.publicId,
        order.customerName,
        formatDateTime(order.occurredAt || order.createdAt),
        getFinancePaymentGroupLabel(order.paymentMethod),
        Number(order.subtotal || order.productRevenue || 0).toFixed(2),
        Number(order.deliveryFee || 0).toFixed(2),
        Number(order.discountAmount || 0).toFixed(2),
        Number(order.totalAmount || 0).toFixed(2),
        getFinanceStatusLabel(order.financialStatus),
      ]
        .map(escapeCsvValue)
        .join(";")
    ),
  ];
  const snapshot = getFinanceSnapshot();
  downloadTextFile(
    `financeiro-${snapshot.filters.startDate || "periodo"}-${snapshot.filters.endDate || "atual"}.csv`,
    csvRows.join("\n"),
    "text/csv;charset=utf-8"
  );
};

const exportFinanceClosingSummary = () => {
  const snapshot = getFinanceSnapshot();
  const overview = snapshot.overview || {};
  const closing = snapshot.closing || {};
  const lines = [
    "Resumo do fechamento financeiro",
    `Periodo: ${snapshot.filters?.rangeLabel || ""}`,
    `Faturamento bruto: ${formatMoney(overview.grossRevenue || 0)}`,
    `Faturamento liquido: ${formatMoney(overview.netRevenue || 0)}`,
    `Valor de entrega: ${formatMoney(overview.deliveryFees || 0)}`,
    `Repasse entregadores: ${formatMoney(overview.deliveryPayout || 0)}`,
    `Pedidos pagos: ${overview.paidOrders || 0}`,
    `Cancelamentos: ${overview.cancelledOrders || 0}`,
    `Pendente: ${formatMoney(overview.pendingAmount || 0)}`,
    `Total esperado: ${formatMoney(closing.totalExpected || 0)}`,
    `Total recebido: ${formatMoney(closing.totalReceived || 0)}`,
    `Diferenca: ${formatMoney(closing.difference || 0)}`,
    `Dinheiro a conferir: ${formatMoney(closing.cashExpected || 0)}`,
    `Pix recebido: ${formatMoney(closing.pixReceived || 0)}`,
    `Cartao recebido: ${formatMoney(closing.cardReceived || 0)}`,
    `Observacoes: ${closing.notes || "Sem observacoes internas."}`,
  ];

  downloadTextFile(
    `fechamento-${snapshot.filters.startDate || "periodo"}-${snapshot.filters.endDate || "atual"}.txt`,
    lines.join("\n")
  );
};

const getDashboardOverview = () => {
  const stats = getStatsSnapshot();
  const finance = getFinancialOverview();
  const visibleOrders = adminState.orders.filter(matchesSearchQuery);
  const validOrders = visibleOrders.filter((order) => order.status !== "Cancelado");
  const finalizados = visibleOrders.filter(isCompletedOrder).length;
  const cancelados = visibleOrders.filter((order) => order.status === "Cancelado").length;
  const referenceDate = adminState.generatedAt ? new Date(adminState.generatedAt) : new Date();
  const sameDashboardDayOrders = validOrders.filter((order) => {
    const createdAt = new Date(order.createdAt);

    return (
      !Number.isNaN(createdAt.getTime()) &&
      createdAt.getFullYear() === referenceDate.getFullYear() &&
      createdAt.getMonth() === referenceDate.getMonth() &&
      createdAt.getDate() === referenceDate.getDate()
    );
  });
  const dashboardStats = {
    ...stats,
    todayRevenue: sameDashboardDayOrders.reduce((sum, order) => sum + getOrderProductRevenue(order), 0),
  };
  const visibleFlowOrders = visibleOrders.filter((order) => !isScheduledAwaitingActivation(order));
  const activeOrders = visibleOrders.filter(
    (order) => !isClosedOrder(order) && !isScheduledAwaitingActivation(order)
  ).length;
  const statusTotal = Math.max(visibleOrders.length, 1);
  const statusBreakdown = [
    {
      label: "Recebidos",
      tone: "received",
      value: visibleFlowOrders.filter((order) => order.status === "Recebido").length,
    },
    {
      label: "Aceitos",
      tone: "accepted",
      value: visibleFlowOrders.filter((order) => order.status === "Aceito").length,
    },
    {
      label: "Em preparo",
      tone: "preparing",
      value: visibleFlowOrders.filter((order) => order.status === "Em preparo").length,
    },
    {
      label: "Prontos",
      tone: "ready",
      value: visibleFlowOrders.filter((order) => order.status === "Pronto").length,
    },
    {
      label: "Em rota",
      tone: "delivery",
      value: visibleFlowOrders.filter((order) => order.status === "Saiu para entrega").length,
    },
    {
      label: "Entregues",
      tone: "delivered",
      value: visibleOrders.filter(
        (order) => order.status === "Entregue" || order.status === "Retirada concluida"
      ).length,
    },
    {
      label: "Cancelados",
      tone: "cancelled",
      value: cancelados,
    },
  ].map((entry) => ({
    ...entry,
    percent: Math.round((entry.value / statusTotal) * 100),
  }));
  const flowBreakdown = [
    {
      key: "delivery",
      label: "Entrega",
      value: validOrders.filter((order) => order.fulfillmentMode === "delivery").length,
      helper: "Pedidos com envio para cliente",
    },
    {
      key: "pickup",
      label: "Retirada",
      value: validOrders.filter((order) => order.fulfillmentMode === "pickup").length,
      helper: "Pedidos para retirada no balcao",
    },
    {
      key: "active",
      label: "Ativos",
      value: activeOrders,
      helper: "Pedidos ainda em andamento",
    },
    {
      key: "scheduled",
      label: "Agendados",
      value: visibleOrders.filter((order) => isScheduledAwaitingActivation(order)).length,
      helper: "Pedidos com horario futuro",
    },
  ];

  return {
    stats: dashboardStats,
    finance,
    visibleOrders,
    validOrders,
    finalizados,
    cancelados,
    activeOrders,
    statusBreakdown,
    statusTotal,
    flowBreakdown,
  };
};

const getReportOverview = () => {
  const visibleOrders = adminState.orders.filter(matchesSearchQuery);
  const fulfillmentBreakdown = [
    {
      label: "Entrega",
      value: visibleOrders.filter((order) => order.fulfillmentMode === "delivery").length,
    },
    {
      label: "Retirada",
      value: visibleOrders.filter((order) => order.fulfillmentMode === "pickup").length,
    },
    {
      label: "Agendados",
      value: visibleOrders.filter((order) => order.timingMode === "scheduled").length,
    },
  ];
  const hourlyBreakdown = Array.from({ length: 6 }, (_, index) => {
    const startHour = 11 + index * 2;
    const endHour = startHour + 1;
    const value = visibleOrders.filter((order) => {
      const createdAt = new Date(order.createdAt);
      const hour = createdAt.getHours();
      return hour >= startHour && hour <= endHour;
    }).length;

    return {
      label: `${String(startHour).padStart(2, "0")}h-${String(endHour).padStart(2, "0")}h`,
      value,
    };
  });

  const statusBreakdown = ORDER_STATUSES.map((status) => ({
    label: status,
    value: visibleOrders.filter((order) => order.status === status).length,
  }));

  return {
    fulfillmentBreakdown,
    hourlyBreakdown,
    statusBreakdown,
    visibleOrders,
  };
};

const getFilteredAuditEvents = () => adminState.auditEvents.slice();

const getAuditOverview = () => {
  const events = getFilteredAuditEvents();
  const uniqueAdmins = new Set(
    events
      .map((entry) => String(entry.adminLogin || "").trim().toLowerCase())
      .filter(Boolean)
  );
  const uniqueOrders = new Set(events.map((entry) => String(entry.orderId || "").trim()).filter(Boolean));

  return {
    totalEvents: events.length,
    uniqueAdmins: uniqueAdmins.size,
    uniqueOrders: uniqueOrders.size,
    lastEventAt: events[0]?.createdAt || "",
  };
};

const getMetricsSnapshot = () => adminState.metricsSnapshot || null;

const getMetricStage = (key) =>
  getMetricsSnapshot()?.stageMetrics?.find((entry) => entry.key === key) || null;

const getMetricsHeadlineStats = () => {
  const snapshot = getMetricsSnapshot();
  const overview = snapshot?.overview || {};

  return {
    totalOrders: Number(overview.totalOrders || 0),
    totalFinalized: Number(overview.totalFinalized || 0),
    totalCancelled: Number(overview.totalCancelled || 0),
    totalPickedUp: Number(overview.totalPickedUp || 0),
    totalInDelivery: Number(overview.totalInDelivery || 0),
    completionRate: Number(overview.completionRate || 0),
    cancellationRate: Number(overview.cancellationRate || 0),
    responseAverageMs: Number(getMetricStage("firstResponse")?.averageMs || 0),
  };
};

const getModuleHeadlineStats = () => {
  const stats = getStatsSnapshot();
  const customerRecords = getCustomerRecords();
  const finance = getFinancialOverview();

  return {
    activeOrders: stats.activeOrders ?? 0,
    deliveries: getRouteOrders().length,
    customers: customerRecords.length,
    recurringCustomers: customerRecords.filter((customer) => customer.ordersCount > 1).length,
    finance,
  };
};

const syncAdminSectionState = () => {
  if (!document.body) {
    return;
  }

  document.body.dataset.adminSection = adminState.activeSection;
};

const renderSectionChrome = () => {
  ensureActiveSectionAllowed();
  syncAdminSectionState();

  const sectionMeta = getSectionMeta();
  const chipNode = document.querySelector("[data-admin-main-chip]");
  const titleNode = document.querySelector("[data-admin-main-title]");
  const welcomeNode = document.querySelector("[data-admin-welcome]");
  const searchCard = document.querySelector("[data-admin-search-card]");
  const searchLabelNode = document.querySelector("[data-admin-search-label]");
  const searchInputNode = document.querySelector("[data-admin-search-input]");
  const searchSummaryNode = document.querySelector("[data-admin-search-summary]");
  const dashboardSummaryRoot = document.querySelector("[data-admin-search-dashboard-summary]");
  const dashboardSummaryPrimaryNode = document.querySelector("[data-admin-search-dashboard-primary]");
  const dashboardSummarySecondaryNode = document.querySelector("[data-admin-search-dashboard-secondary]");
  const turnPanelRoot = document.querySelector("[data-admin-turn-panel]");
  const turnPanelPrimaryNode = document.querySelector("[data-admin-turn-panel-primary]");
  const turnPanelSecondaryNode = document.querySelector("[data-admin-turn-panel-secondary]");
  const detailChipNode = document.querySelector(".admin-detail-head .admin-chip");
  const notificationCountNode = document.querySelector("[data-admin-alert-count]");
  const dashboardOverview = getDashboardOverview();
  const isDashboardSection = adminState.activeSection === "dashboard";
  const isOrdersSection = adminState.activeSection === "orders";
  const isScheduledSection = adminState.activeSection === "scheduled";
  const isMenuSection = adminState.activeSection === "menu";
  const isPromotionsSection = adminState.activeSection === "promotions";
  const isReviewsSection = adminState.activeSection === "reviews";
  const isInventorySection = adminState.activeSection === "inventory";
  const isCustomersSection = adminState.activeSection === "customers";
  const isUsersSection = adminState.activeSection === "users";
  const isMasterPlatformHeader = getAdminUserActorType() === "MASTER" && isSystemAdminActor();
  const restaurantHeaderName = !isSystemAdminActor()
    ? String(adminState.adminRestaurantName || "").trim()
    : "";

  if (chipNode) {
    chipNode.textContent = isMasterPlatformHeader
      ? "Painel Administrativo"
      : restaurantHeaderName
      ? restaurantHeaderName
      : isDashboardSection
      ? "Dashboard gerencial"
      : isOrdersSection
        ? "Operacao em tempo real"
        : sectionMeta.chip;
  }

  if (titleNode) {
    titleNode.textContent = isMasterPlatformHeader
      ? "INovas Food"
      : isDashboardSection
      ? "Resumo do turno e indicadores"
      : isOrdersSection
        ? "Pedidos"
        : sectionMeta.title;
  }

  if (welcomeNode) {
    welcomeNode.textContent = isMasterPlatformHeader
      ? "Administrador do Sistema"
      : isDashboardSection
      ? "Acompanhe em tempo real o desempenho do turno, pedidos e entregas. Dados atualizados automaticamente."
      : isOrdersSection
        ? "Acompanhe e gerencie todos os pedidos em tempo real, com a proxima acao sempre visivel para a operacao."
        : sectionMeta.description;
  }

  if (searchLabelNode) {
    searchLabelNode.textContent = isDashboardSection
      ? "Resumo do turno"
      : isOrdersSection
        ? "Busca operacional"
      : isScheduledSection
        ? "Busca de agenda"
      : isMenuSection
        ? "Buscar item"
      : isInventorySection
        ? "Buscar estoque"
      : isCustomersSection
        ? "Buscar cliente"
      : isUsersSection
        ? "Buscar usuario"
      : isPromotionsSection
        ? "Buscar promocao"
        : isReviewsSection
            ? "Buscar avaliacao"
            : "Buscar pedido";
  }

  if (searchInputNode) {
    searchInputNode.hidden = false;
    searchInputNode.setAttribute("aria-hidden", "false");
    searchInputNode.placeholder = isDashboardSection
      ? "Ctrl + K"
      : isOrdersSection
      ? "Buscar pedido, cliente, telefone..."
      : isScheduledSection
        ? "Buscar por numero, cliente, telefone ou horario"
      : isMenuSection
        ? "Buscar por item, categoria ou id"
      : isInventorySection
        ? "Buscar por insumo, categoria, unidade ou status"
      : isCustomersSection
        ? "Buscar por nome ou telefone"
      : isUsersSection
        ? "Buscar por nome, login, email ou tipo"
      : isPromotionsSection
        ? "Buscar por promocao, item, categoria ou validade"
        : isReviewsSection
          ? "Buscar por cliente, comentario ou contato"
          : "Filtrar a leitura operacional";
  }

  if (dashboardSummaryRoot) {
    dashboardSummaryRoot.hidden = !isDashboardSection;
  }

  if (dashboardSummaryPrimaryNode) {
    dashboardSummaryPrimaryNode.textContent = `${dashboardOverview.activeOrders} pedido(s) ativos agora`;
  }

  if (dashboardSummarySecondaryNode) {
    dashboardSummarySecondaryNode.textContent = `Atualizado em ${
      adminState.generatedAt ? formatDateTime(adminState.generatedAt) : "sincronizacao inicial"
    } com ${dashboardOverview.finalizados} finalizado(s) e ${dashboardOverview.cancelados} cancelado(s).`;
  }

  if (turnPanelRoot) {
    turnPanelRoot.hidden = !isDashboardSection;
  }

  if (isDashboardSection) {
    const dashboardDateSource = adminState.generatedAt
      ? new Date(adminState.generatedAt)
      : new Date();
    const turnOrders = dashboardOverview.visibleOrders
      .filter((order) => {
        const createdAt = new Date(order.createdAt);
        return (
          !Number.isNaN(createdAt.getTime()) &&
          createdAt.getFullYear() === dashboardDateSource.getFullYear() &&
          createdAt.getMonth() === dashboardDateSource.getMonth() &&
          createdAt.getDate() === dashboardDateSource.getDate()
        );
      })
      .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));
    const turnStartedAt = turnOrders[0]?.createdAt || adminState.generatedAt || "";

    if (turnPanelPrimaryNode) {
      turnPanelPrimaryNode.textContent = turnStartedAt
        ? `Turno ativo desde ${formatDateTime(turnStartedAt)}`
        : "Turno ativo no gestor";
    }

    if (turnPanelSecondaryNode) {
      turnPanelSecondaryNode.textContent = adminState.generatedAt
        ? `Ultima sincronizacao: ${formatDateTime(adminState.generatedAt)}`
        : "Aguardando a primeira sincronizacao do turno.";
    }
  }

  if (searchCard) {
    searchCard.setAttribute(
      "aria-label",
      isDashboardSection
        ? "Resumo gerencial do turno"
        : isScheduledSection
          ? "Busca operacional de agendamentos"
        : isMenuSection
          ? "Busca operacional de itens do cardapio"
        : isInventorySection
          ? "Busca operacional de estoque"
        : isCustomersSection
          ? "Busca operacional de clientes"
        : isUsersSection
          ? "Busca administrativa de usuarios"
        : isPromotionsSection
            ? "Busca operacional de promocoes"
            : isReviewsSection
              ? "Busca operacional de avaliacoes"
              : "Busca operacional de pedidos"
    );
  }

  if (searchSummaryNode && !isDashboardSection) {
    searchSummaryNode.textContent = adminState.searchQuery
      ? isMenuSection
        ? `Filtrando itens por: ${adminState.searchQuery}`
        : isScheduledSection
          ? `Filtrando agendamentos por: ${adminState.searchQuery}`
        : isInventorySection
          ? `Filtrando estoque por: ${adminState.searchQuery}`
        : isCustomersSection
          ? `Filtrando clientes por: ${adminState.searchQuery}`
        : isUsersSection
          ? `Filtrando usuarios por: ${adminState.searchQuery}`
        : isPromotionsSection
          ? `Filtrando promocoes por: ${adminState.searchQuery}`
          : isReviewsSection
            ? `Filtrando avaliacoes por: ${adminState.searchQuery}`
        : `Filtrando pedidos por: ${adminState.searchQuery}`
      : isMenuSection
        ? "Buscando no catalogo administrativo e nas categorias do site."
        : isScheduledSection
          ? "Buscando na agenda futura por numero, cliente, telefone e horario."
        : isInventorySection
          ? "Buscando em insumos, categorias, validade e status de estoque."
        : isCustomersSection
          ? "Buscando na carteira por nome, telefone, tags e endereco."
        : isUsersSection
          ? "Buscando por nome, login, email, status e tipo."
        : isPromotionsSection
          ? "Buscando em campanhas, periodos e itens vinculados."
          : isReviewsSection
            ? "Buscando em clientes, comentarios, notas e janelas de publicacao."
        : "Buscando na operacao ativa e nos pedidos recentes.";
  }

  if (detailChipNode) {
    detailChipNode.textContent = isOrdersSection
      ? "Detalhes do pedido"
      : isInventorySection
        ? "Estoque"
        : isUsersSection
          ? "Usuarios"
        : "Painel gerencial";
  }

  if (notificationCountNode) {
    const notificationCount = getOrdersNotificationCount();
    notificationCountNode.textContent = String(notificationCount);
    notificationCountNode.hidden = !isOrdersSection || notificationCount <= 0;
  }
};

const syncSelectionForActiveSection = () => {
  if (adminState.activeSection === "customers") {
    adminState.selectedCustomerKey =
      getSelectedCustomerCrmRecord()?.key || getVisibleCustomerCrmRecords()[0]?.key || "";
    return;
  }

  if (adminState.activeSection === "dashboard") {
    return;
  }

  if (adminState.activeSection === "menu") {
    adminState.selectedOrderId = "";
    adminState.selectedOrder = null;
    return;
  }

  if (adminState.activeSection === "promotions") {
    const visiblePromotions = getVisiblePromotions();
    const allPromotions = getPromotionsSnapshot().promotions || [];
    const selectedPromotionStillVisible = visiblePromotions.some(
      (promotion) => promotion.id === adminState.selectedPromotionId
    );
    const selectedPromotionStillAvailable = allPromotions.some(
      (promotion) => promotion.id === adminState.selectedPromotionId
    );
    const preferredPromotion = selectedPromotionStillVisible
      ? allPromotions.find((promotion) => promotion.id === adminState.selectedPromotionId) || null
      : visiblePromotions[0] ||
        (selectedPromotionStillAvailable
          ? allPromotions.find((promotion) => promotion.id === adminState.selectedPromotionId) || null
          : null) ||
        allPromotions[0] ||
        null;

    adminState.selectedOrderId = "";
    adminState.selectedOrder = null;

    if (!preferredPromotion) {
      adminState.selectedPromotionId = "";
      return;
    }

    if (adminState.selectedPromotionId !== preferredPromotion.id) {
      adminState.selectedPromotionId = preferredPromotion.id;
    }
    return;
  }

  if (adminState.activeSection === "reviews") {
    const visibleReviews = getVisibleReviews();
    const allReviews = getReviewsSnapshot().reviews || [];
    const selectedReviewStillVisible = visibleReviews.some(
      (review) => review.id === adminState.selectedReviewId
    );
    const selectedReviewStillAvailable = allReviews.some(
      (review) => review.id === adminState.selectedReviewId
    );
    const preferredReview = selectedReviewStillVisible
      ? allReviews.find((review) => review.id === adminState.selectedReviewId) || null
      : visibleReviews[0] ||
        (selectedReviewStillAvailable
          ? allReviews.find((review) => review.id === adminState.selectedReviewId) || null
          : null) ||
        allReviews[0] ||
        null;

    adminState.selectedOrderId = "";
    adminState.selectedOrder = null;

    if (!preferredReview) {
      adminState.selectedReviewId = "";
      return;
    }

    if (adminState.selectedReviewId !== preferredReview.id) {
      adminState.selectedReviewId = preferredReview.id;
    }
    return;
  }

  if (adminState.activeSection === "scheduled") {
    const preferredOrder = getVisibleScheduledOrders()[0] || getScheduledSnapshot().orders[0] || null;

    if (!preferredOrder) {
      adminState.selectedOrderId = "";
      adminState.selectedOrder = null;
      return;
    }

    if (adminState.selectedOrderId !== preferredOrder.id) {
      adminState.selectedOrderId = preferredOrder.id;
      adminState.selectedOrder =
        adminState.selectedOrder?.id === preferredOrder.id ? adminState.selectedOrder : null;
    }
    return;
  }

  if (adminState.activeSection === "deliveries") {
    adminState.selectedOrderId = "";
    adminState.selectedOrder = null;
    return;
  }

  if (adminState.activeSection === "metrics") {
    adminState.selectedOrderId = "";
    adminState.selectedOrder = null;
    return;
  }

  if (adminState.activeSection === "finance") {
    adminState.selectedOrderId = "";
    adminState.selectedOrder = null;
    return;
  }

  if (adminState.activeSection === "inventory") {
    const visibleItems = getVisibleInventoryItems();
    const allItems = getInventorySnapshot().items || [];
    const selectedItemStillVisible = visibleItems.some(
      (item) => item.id === adminState.selectedInventoryItemId
    );
    const selectedItemStillAvailable = allItems.some(
      (item) => item.id === adminState.selectedInventoryItemId
    );

    adminState.selectedOrderId = "";
    adminState.selectedOrder = null;

    if (adminState.selectedInventoryItemId === INVENTORY_NEW_ITEM_ID) {
      return;
    }

    const preferredItem = selectedItemStillVisible
      ? allItems.find((item) => item.id === adminState.selectedInventoryItemId) || null
      : visibleItems[0] ||
        (selectedItemStillAvailable
          ? allItems.find((item) => item.id === adminState.selectedInventoryItemId) || null
          : null) ||
        allItems[0] ||
        null;

    adminState.selectedInventoryItemId = preferredItem?.id || INVENTORY_NEW_ITEM_ID;
    return;
  }

  if (adminState.activeSection === "users") {
    normalizeUsersPage();
    adminState.selectedOrderId = "";
    adminState.selectedOrder = null;

    if (adminState.selectedUserLogin === NEW_ADMIN_USER_LOGIN) {
      return;
    }

    const users = Array.isArray(getUsersSnapshot().users) ? getUsersSnapshot().users : [];
    const visibleUsers = getPaginatedAdminUsers();
    const selectedUserStillVisible = visibleUsers.some((user) => user.login === adminState.selectedUserLogin);
    const selectedUserStillAvailable = users.some((user) => user.login === adminState.selectedUserLogin);
    const preferredUser = selectedUserStillVisible
      ? users.find((user) => user.login === adminState.selectedUserLogin) || null
      : visibleUsers[0] ||
        (selectedUserStillAvailable
          ? users.find((user) => user.login === adminState.selectedUserLogin) || null
          : null) ||
        getSortedAdminUsers()[0] ||
        users[0] ||
        null;

    adminState.selectedUserLogin = preferredUser?.login || "";
    return;
  }

  if (adminState.activeSection === "audit") {
    const preferredAuditOrderId = getFilteredAuditEvents()[0]?.orderId || "";

    if (preferredAuditOrderId && adminState.selectedOrderId !== preferredAuditOrderId) {
      adminState.selectedOrderId = preferredAuditOrderId;
      adminState.selectedOrder =
        adminState.selectedOrder?.id === preferredAuditOrderId ? adminState.selectedOrder : null;
    }
    return;
  }

  if (adminState.activeSection === "orders") {
    const preferredOrder = getVisibleOperationalOrders()[0] || adminState.orders[0] || null;

    if (preferredOrder && adminState.selectedOrderId !== preferredOrder.id) {
      adminState.selectedOrderId = preferredOrder.id;
      adminState.selectedOrder =
        adminState.selectedOrder?.id === preferredOrder.id ? adminState.selectedOrder : null;
    }
  }
};

const matchesSearchQuery = (order) => {
  const query = String(adminState.searchQuery || "")
    .trim()
    .toLowerCase();

  if (!query) {
    return true;
  }

  const searchableValue = [
    order.publicId,
    order.customerName,
    order.customerPhone,
    order.customerEmail,
    order.addressFull,
    order.itemPreview,
    order.latestStatusNote,
  ]
    .join(" ")
    .toLowerCase();

  return searchableValue.includes(query);
};

const getBoardColumnKey = (order) => {
  if (!order || isClosedOrder(order) || isScheduledAwaitingActivation(order)) {
    return "";
  }

  if (order.status === "Recebido") {
    return "received";
  }

  if (order.status === "Aceito") {
    return "accepted";
  }

  if (order.status === "Em preparo") {
    return "preparing";
  }

  if (order.status === "Pronto") {
    return "ready";
  }

  if (order.status === "Saiu para entrega") {
    return "delivery";
  }

  return "";
};

const getVisibleOperationalOrders = () =>
  adminState.orders.filter((order) => matchesSearchQuery(order) && getBoardColumnKey(order));

const getBoardColumnDefinition = (columnKey) =>
  BOARD_COLUMNS.find((column) => column.key === columnKey) || null;

const formatOrderCountLabel = (count) => `${count} pedido${count === 1 ? "" : "s"}`;

const getBoardOrderStageTimestamp = (order) => {
  const timestamp = new Date(order?.updatedAt || order?.createdAt || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
};

const getOrderedBoardColumnOrders = (columnKey, orders = getVisibleOperationalOrders()) =>
  orders
    .map((order, index) => ({ order, index }))
    .filter((entry) => getBoardColumnKey(entry.order) === columnKey)
    .sort((left, right) => {
      const timestampDiff =
        getBoardOrderStageTimestamp(left.order) - getBoardOrderStageTimestamp(right.order);

      if (timestampDiff !== 0) {
        return timestampDiff;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.order);

const getNavIconSvg = (sectionKey) => NAV_ICON_SVGS[sectionKey] || NAV_ICON_SVGS.dashboard;

const getOrderActions = (order) => {
  if (!order || isClosedOrder(order)) {
    return [];
  }

  const actions = [];

  if (order.status === "Recebido") {
    actions.push({
      label: "Aceitar pedido",
      status: "Aceito",
      tone: "primary",
      note: ACTION_NOTES.Aceito,
    });
  }

  if (order.status === "Aceito") {
    actions.push({
      label: "Iniciar preparo",
      status: "Em preparo",
      tone: "primary",
      note: ACTION_NOTES["Em preparo"],
    });
  }

  if (order.status === "Em preparo") {
    actions.push({
      label: "Marcar como pronto",
      status: "Pronto",
      tone: "success",
      note: ACTION_NOTES.Pronto,
    });
  }

  if (order.status === "Pronto") {
    actions.push({
      label: order.fulfillmentMode === "pickup" ? "Concluir retirada" : "Despachar",
      status: order.fulfillmentMode === "pickup" ? "Retirada concluida" : "Saiu para entrega",
      tone: order.fulfillmentMode === "pickup" ? "success" : "info",
      note:
        order.fulfillmentMode === "pickup"
          ? ACTION_NOTES["Retirada concluida"]
          : ACTION_NOTES["Saiu para entrega"],
    });
  }

  if (order.status === "Saiu para entrega") {
    actions.push({
      label: "Concluir entrega",
      status: "Entregue",
      tone: "success",
      note: ACTION_NOTES.Entregue,
    });
  }

  actions.push({
    label: "Cancelar",
    status: "Cancelado",
    tone: "danger",
    note: ACTION_NOTES.Cancelado,
  });

  return actions;
};

const getPrimaryAction = (order) => getOrderActions(order).find((action) => action.tone !== "danger") || null;

const getOrderFlowStages = (order) => {
  if (!order) {
    return [];
  }

  if (order.status === "Cancelado") {
    return [{ label: "Cancelado", state: "cancelled" }];
  }

  const stages = ["Recebido", "Aceito", "Em preparo", "Pronto"];

  if (order.fulfillmentMode === "pickup") {
    stages.push("Retirada concluida");
  } else {
    stages.push("Saiu para entrega", "Entregue");
  }

  const currentStatus = resolveCanonicalOrderStatus(order.status, order.fulfillmentMode) || order.status;
  const currentIndex = stages.indexOf(currentStatus);

  return stages.map((status, index) => ({
    label: status,
    state:
      currentIndex === -1
        ? "upcoming"
        : index < currentIndex
          ? "done"
          : index === currentIndex
            ? "current"
            : "upcoming",
  }));
};

const renderOrderFlowStages = (order) =>
  getOrderFlowStages(order)
    .map(
      (stage) => `
        <span class="admin-detail-flow-step is-${escapeHtml(stage.state)}">${escapeHtml(stage.label)}</span>
      `
    )
    .join("");

const getManualStatusOptions = (order) =>
  ORDER_STATUSES.filter((status) => {
    if (status === "Saiu para entrega" && order?.fulfillmentMode === "pickup") {
      return false;
    }

    if (status === "Retirada concluida" && order?.fulfillmentMode !== "pickup") {
      return false;
    }

    if (status === "Entregue" && order?.fulfillmentMode === "pickup") {
      return false;
    }

    return true;
  });

const buildClientSideStats = (orders) => {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const todayOrders = orders.filter((order) => {
    const orderDate = new Date(order.createdAt);

    if (Number.isNaN(orderDate.getTime())) {
      return false;
    }

    const orderKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(orderDate.getDate()).padStart(2, "0")}`;
    return orderKey === todayKey;
  });

  const byStatus = ORDER_STATUSES.reduce((summary, status) => {
    summary[status] = orders.filter((order) => order.status === status).length;
    return summary;
  }, {});

  return {
    totalOrders: orders.length,
    activeOrders: orders.filter(
      (order) => !isClosedOrder(order) && !isScheduledAwaitingActivation(order)
    ).length,
    scheduledOrders: orders.filter(
      (order) => order.timingMode === "scheduled" && isScheduledAwaitingActivation(order)
    ).length,
    todayOrders: todayOrders.length,
    preparingOrders: byStatus["Em preparo"] || 0,
    readyOrders: byStatus.Pronto || 0,
    deliveryOrders: byStatus["Saiu para entrega"] || 0,
    todayRevenue: todayOrders
      .filter((order) => order.status !== "Cancelado")
      .reduce((sum, order) => sum + getOrderProductRevenue(order), 0),
    byStatus,
  };
};

const getStatsSnapshot = () => {
  const fallback = buildClientSideStats(adminState.orders);

  return {
    ...fallback,
    ...(adminState.stats || {}),
  };
};

const updateSidebarMeta = () => {
  const generatedAtNode = document.querySelector("[data-admin-generated-at]");
  const storageNode = document.querySelector("[data-admin-storage-mode]");
  const listSummaryNode = document.querySelector("[data-admin-list-summary]");
  const boardTotalNode = document.querySelector("[data-admin-board-total]");
  const boardFocusNode = document.querySelector("[data-admin-board-focus]");
  const searchSummaryNode = document.querySelector("[data-admin-search-summary]");
  const opsRibbonRoot = document.querySelector("[data-admin-ops-ribbon]");
  const visibleOrders = getVisibleOperationalOrders();
  const hasSearch = Boolean(String(adminState.searchQuery || "").trim());
  const sectionMeta = getSectionMeta();
  const dashboardOverview = getDashboardOverview();
  const headlineStats = getModuleHeadlineStats();
  const metricsHeadline = getMetricsHeadlineStats();
  const metricsSnapshot = getMetricsSnapshot();
  const metricsFilters = metricsSnapshot?.filters || adminState.metricsFilters;
  const financeSnapshot = getFinanceSnapshot();
  const financeOverview = financeSnapshot.overview || {};
  const scheduledOrders = getVisibleScheduledOrders();
  const menuSections = getVisibleMenuSections();
  const promotions = getVisiblePromotions();
  const menuItemsCount = menuSections.reduce((sum, section) => sum + (section.items?.length || 0), 0);
  const userNameNode = document.querySelector("[data-admin-user-name]");
  const userInitialsNode = document.querySelector("[data-admin-user-initials]");

  if (generatedAtNode) {
    generatedAtNode.textContent = adminState.generatedAt
      ? `Atualizado em ${formatDateTime(adminState.generatedAt)}.`
      : "Atualizando leitura operacional...";
  }

  if (storageNode) {
    storageNode.textContent = buildStorageLabel(adminState.storageMode);
  }

  if (userNameNode) {
    userNameNode.textContent = adminState.adminDisplayName || "Administrador";
  }

  if (userInitialsNode) {
    userInitialsNode.textContent = getAdminDisplayInitials(adminState.adminDisplayName || "Administrador");
  }

  if (boardTotalNode) {
    boardTotalNode.textContent =
      adminState.activeSection === "dashboard"
        ? `${dashboardOverview.activeOrders} pedido(s) ativos e ${dashboardOverview.finalizados} concluido(s) no recorte atual.`
        : adminState.activeSection === "scheduled"
        ? `${scheduledOrders.length} pedido(s) agendado(s) aguardando liberacao para o fluxo ativo.`
        : adminState.activeSection === "menu"
        ? `${menuItemsCount} item(ns) visiveis para controle operacional do cardapio.`
        : adminState.activeSection === "promotions"
        ? `${promotions.length} promocao(oes) visivel(is) no gestor.`
        : adminState.activeSection === "metrics" && metricsSnapshot
        ? `${metricsHeadline.totalOrders} pedido(s) analisado(s) no periodo.`
        : adminState.activeSection === "finance"
        ? `${financeOverview.paidOrders || 0} pedido(s) pago(s), ${financeOverview.pendingOrders || 0} pendente(s) e ${financeOverview.cancelledOrders || 0} cancelado(s).`
        : visibleOrders.length > 0
          ? `${visibleOrders.length} pedido(s) ativos em operacao.`
          : "Nenhum pedido ativo no kanban.";
  }

  if (boardFocusNode) {
    boardFocusNode.textContent = hasSearch
      ? `Filtro ativo: ${adminState.searchQuery}`
      : adminState.activeSection === "dashboard"
        ? "Resumo executivo do turno com foco em volume, receita e conclusao."
      : adminState.activeSection === "metrics" && metricsSnapshot
        ? `${metricsSnapshot.filters.periodLabel} | ${metricsFilters.startDate} ate ${metricsFilters.endDate}`
      : adminState.activeSection === "finance"
        ? financeSnapshot.filters?.rangeLabel || "Periodo financeiro"
      : sectionMeta.focus;
  }

  if (listSummaryNode) {
    listSummaryNode.textContent = hasSearch
      ? adminState.activeSection === "menu"
        ? `${menuItemsCount} item(ns) encontrados com o filtro atual.`
        : adminState.activeSection === "scheduled"
          ? `${scheduledOrders.length} agendamento(s) encontrados com o filtro atual.`
          : adminState.activeSection === "promotions"
            ? `${promotions.length} promocao(oes) encontrada(s) com o filtro atual.`
          : `${visibleOrders.length} pedido(s) encontrado(s) com o filtro atual.`
      : adminState.activeSection === "dashboard"
        ? `Pedidos do dia, receita e fechamento consolidados para ${adminState.adminDisplayName || "o turno atual"}.`
      : adminState.activeSection === "scheduled"
        ? `${sectionMeta.title} com entrega, retirada e horarios futuros separados da fila imediata.`
      : adminState.activeSection === "menu"
        ? `${sectionMeta.title} sincronizado com o site publico e com a criacao de pedidos.`
      : adminState.activeSection === "promotions"
        ? `${sectionMeta.title} com vigencia automatica, reflexo publico e preco valido no fechamento.`
      : adminState.activeSection === "metrics" && metricsSnapshot
        ? `${metricsHeadline.totalFinalized} concluidos, ${metricsHeadline.totalCancelled} cancelados e ${metricsHeadline.totalPickedUp} retirados no recorte atual.`
      : adminState.activeSection === "finance"
        ? `Fechamento com ${formatMoney(financeOverview.receivedRevenue || 0)} recebido e ${formatMoney(financeOverview.deliveryPayout || 0)} em repasses.`
      : `${sectionMeta.title} sincronizado com os pedidos reais do gestor.`;
  }

  if (searchSummaryNode) {
    searchSummaryNode.textContent = hasSearch
      ? `Filtrando por: ${adminState.searchQuery}`
      : adminState.activeSection === "dashboard"
        ? "Os indicadores abaixo mostram uma leitura consolidada do turno."
      : adminState.activeSection === "scheduled"
        ? "Filtre por data para trabalhar a agenda futura sem misturar com pedidos imediatos."
      : adminState.activeSection === "menu"
        ? "A busca global encontra itens, categorias e estados operacionais do cardapio."
      : adminState.activeSection === "promotions"
        ? "A busca global encontra campanhas, periodos, categorias e itens afetados."
      : adminState.activeSection === "metrics" && metricsSnapshot
        ? "Os filtros deste modulo leem pedidos reais e trilha de auditoria do periodo."
      : adminState.activeSection === "finance"
        ? "Os filtros desta aba recalculam faturamento, pagamentos, repasses e fechamento."
      : "Buscando na operacao ativa e nos pedidos recentes.";
  }

  if (opsRibbonRoot) {
    opsRibbonRoot.hidden = false;
    opsRibbonRoot.classList.toggle("is-dashboard-executive", adminState.activeSection === "dashboard");
    opsRibbonRoot.innerHTML =
      adminState.activeSection === "dashboard"
        ? renderDashboardExecutiveRow(dashboardOverview)
        : adminState.activeSection === "metrics" && metricsSnapshot
        ? `
          <article class="admin-ribbon-card is-accent">
            <span class="admin-chip">${escapeHtml(sectionMeta.chip)}</span>
            <strong>${escapeHtml(sectionMeta.title)}</strong>
            <p>${escapeHtml(sectionMeta.description)}</p>
          </article>
          <article class="admin-ribbon-card">
            <span>Conclusao</span>
            <strong>${escapeHtml(formatPercent(metricsHeadline.completionRate))}</strong>
            <p>${escapeHtml(String(metricsHeadline.totalFinalized))} pedido(s) concluidos no periodo.</p>
          </article>
          <article class="admin-ribbon-card">
            <span>Cancelamento</span>
            <strong>${escapeHtml(formatPercent(metricsHeadline.cancellationRate))}</strong>
            <p>${escapeHtml(String(metricsHeadline.totalCancelled))} cancelamento(s) no recorte atual.</p>
          </article>
          <article class="admin-ribbon-card">
            <span>Resposta inicial</span>
            <strong>${escapeHtml(formatDuration(metricsHeadline.responseAverageMs))}</strong>
            <p>Tempo medio do primeiro toque administrativo.</p>
          </article>
          <article class="admin-ribbon-card">
            <span>Receita valida</span>
            <strong>${escapeHtml(formatMoney(metricsSnapshot.overview?.totalRevenue || 0))}</strong>
            <p>Ticket medio de ${escapeHtml(formatMoney(metricsSnapshot.overview?.averageTicket || 0))}.</p>
          </article>
        `
        : adminState.activeSection === "finance"
        ? `
          <article class="admin-ribbon-card is-accent">
            <span class="admin-chip">Financeiro</span>
            <strong>${escapeHtml(formatMoney(financeOverview.grossRevenue || 0))}</strong>
            <p>${escapeHtml(financeSnapshot.filters?.rangeLabel || "Periodo financeiro atual")}.</p>
          </article>
          <article class="admin-ribbon-card">
            <span>Liquido</span>
            <strong>${escapeHtml(formatMoney(financeOverview.netRevenue || 0))}</strong>
            <p>Produtos apos taxas de entrega e descontos estimados.</p>
          </article>
          <article class="admin-ribbon-card">
            <span>Recebido</span>
            <strong>${escapeHtml(formatMoney(financeOverview.receivedRevenue || 0))}</strong>
            <p>${escapeHtml(String(financeOverview.paidOrders || 0))} pedido(s) pago(s) no periodo.</p>
          </article>
          <article class="admin-ribbon-card">
            <span>Repasse</span>
            <strong>${escapeHtml(formatMoney(financeOverview.deliveryPayout || 0))}</strong>
            <p>Calculado pela regra configurada em Entregas.</p>
          </article>
          <article class="admin-ribbon-card">
            <span>Pendente</span>
            <strong>${escapeHtml(formatMoney(financeOverview.pendingAmount || 0))}</strong>
            <p>Pedidos em aberto separados do fechamento recebido.</p>
          </article>
        `
        : `
          <article class="admin-ribbon-card is-accent">
            <span class="admin-chip">${escapeHtml(sectionMeta.chip)}</span>
            <strong>${escapeHtml(sectionMeta.title)}</strong>
            <p>Leitura rapida do fluxo principal com foco no kanban e no painel lateral.</p>
          </article>
          <article class="admin-ribbon-card">
            <span>Prontos</span>
            <strong>${escapeHtml(String(getStatsSnapshot().readyOrders ?? 0))}</strong>
            <p>Pedidos aguardando retirada ou saida para entrega.</p>
          </article>
          <article class="admin-ribbon-card">
            <span>Agendados</span>
            <strong>${escapeHtml(String(getStatsSnapshot().scheduledOrders ?? 0))}</strong>
            <p>Pedidos futuros separados da fila imediata.</p>
          </article>
          <article class="admin-ribbon-card">
            <span>Atualizacao</span>
            <strong>${escapeHtml(
              adminState.generatedAt ? formatTime(adminState.generatedAt) : "--:--"
            )}</strong>
            <p>${escapeHtml(
              adminState.generatedAt
                ? `Sincronizado em ${formatDateTime(adminState.generatedAt)}.`
                : "Sincronizando a leitura do gestor."
            )}</p>
          </article>
          <article class="admin-ribbon-card">
            <span>Busca</span>
            <strong>${escapeHtml(hasSearch ? "Filtro ativo" : "Sem filtro")}</strong>
            <p>${escapeHtml(
              hasSearch ? `Resultados para: ${adminState.searchQuery}` : "Toda a operacao visivel no momento."
            )}</p>
          </article>
        `;
  }
};

const renderSidebarNav = () => {
  const navRoot = document.querySelector("[data-admin-nav]");
  const stats = getStatsSnapshot();
  const customerRecords = getCustomerRecords();
  const finance = getFinancialOverview();
  const dashboardOverview = getDashboardOverview();

  if (!navRoot) {
    return;
  }

  ensureActiveSectionAllowed();

  navRoot.innerHTML = getVisibleNavSections().map((section) => {
    const isActive = adminState.activeSection === section.key;
    const isImplemented = IMPLEMENTED_SECTIONS.has(section.key);
    const badgeValue = (() => {
      if (section.key === "dashboard") {
        return String(dashboardOverview.stats.todayOrders ?? 0);
      }

      if (section.key === "orders") {
        return String(stats.activeOrders ?? 0);
      }

      if (section.key === "scheduled") {
        return String(stats.scheduledOrders ?? 0);
      }

      if (section.key === "menu") {
        return String(adminState.menuSnapshot?.summary?.totalItems || 0);
      }

      if (section.key === "promotions") {
        return String(adminState.promotionsSnapshot?.summary?.activePromotions || 0);
      }

      if (section.key === "reviews") {
        return String(adminState.reviewsSnapshot?.summary?.publishedReviews || 0);
      }

      if (section.key === "deliveries") {
        return String(getRouteOrders().length + getReadyForDispatchOrders().length + getPickupReadyOrders().length);
      }

      if (section.key === "customers") {
        return String(customerRecords.length);
      }

      if (section.key === "finance") {
        const roundedRevenue = Math.round(Number(finance.grossRevenue || 0));
        return `R$${roundedRevenue}`;
      }

      if (section.key === "metrics") {
        return String(getMetricsSnapshot()?.overview?.totalOrders || adminState.orders.length || 0);
      }

      if (section.key === "reports") {
        return String(adminState.orders.length);
      }

      if (section.key === "inventory") {
        return String(getInventorySnapshot().summary.totalItems || 0);
      }

      if (section.key === "settings") {
        return "Site";
      }

      if (section.key === "users") {
        return String(getUsersSnapshot().users?.length || 0);
      }

      if (section.key === "audit") {
        return String(adminState.auditEvents.length || 0);
      }

      return "Em breve";
    })();

    return `
      <button
        class="admin-nav-item${isActive ? " is-active" : ""}${!isImplemented ? " is-disabled" : ""}"
        type="button"
        data-admin-section="${escapeHtml(section.key)}"
        ${isActive ? 'aria-current="page"' : ""}
      >
        <span class="admin-nav-icon" aria-hidden="true">${getNavIconSvg(section.key)}</span>
        <div>
          <strong>${escapeHtml(section.label)}</strong>
          <small>${escapeHtml(section.helper)}</small>
        </div>
        <span class="admin-nav-badge">${escapeHtml(badgeValue)}</span>
      </button>
    `;
  }).join("");
};

const renderDashboardStats = () => {
  const statsRoot = document.querySelector("[data-admin-stats]");
  const overview = getDashboardOverview();
  const isDashboardSection = adminState.activeSection === "dashboard";
  const isOrdersSection = adminState.activeSection === "orders";

  if (!statsRoot) {
    return;
  }

  const renderStatIcon = (iconKey) => {
    const icons = {
      received:
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 6.5h10M8 4h8l1 2.5V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V6.5L8 4Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /><path d="M9.5 11h5M9.5 15h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>',
      accepted:
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m8 12 2.5 2.5L16 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8" /></svg>',
      preparing:
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 14h10M6 10h12M9 6h6M8 18h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /><path d="M5 18h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>',
      ready:
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8.5 12.5 11 15l4.5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /><path d="M19 8.5V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8.5M9 5h6l1 3H8l1-3Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>',
      delivery:
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 7.5h11v8H3zM14 10h3.5l2.5 2.5v3H14z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /><circle cx="8" cy="18" r="1.8" stroke="currentColor" stroke-width="1.8" /><circle cx="18" cy="18" r="1.8" stroke="currentColor" stroke-width="1.8" /></svg>',
      finished:
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /><rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" stroke-width="1.8" /></svg>',
      revenue:
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v16M16 7.5c0-1.38-1.79-2.5-4-2.5s-4 1.12-4 2.5 1.79 2.5 4 2.5 4 1.12 4 2.5-1.79 2.5-4 2.5-4-1.12-4-2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>',
    };

    return icons[iconKey] || icons.received;
  };

  const cards = isOrdersSection
    ? (() => {
        const visibleOrders = getVisibleOperationalOrders();
        const buildStageStat = (status, config) => {
          const orders = visibleOrders.filter((order) => order.status === status);
          return {
            ...config,
            value: orders.length,
            helper: formatMoney(orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0)),
          };
        };

        return [
          buildStageStat("Recebido", {
            label: "Recebidos",
            toneClass: "is-neutral",
            iconKey: "received",
            summary: "Aguardando aceite",
          }),
          buildStageStat("Aceito", {
            label: "Aceitos",
            toneClass: "is-revenue",
            iconKey: "accepted",
            summary: "Fila confirmada",
          }),
          buildStageStat("Em preparo", {
            label: "Em preparo",
            toneClass: "is-preparing",
            iconKey: "preparing",
            summary: "Execucao da cozinha",
          }),
          buildStageStat("Pronto", {
            label: "Prontos",
            toneClass: "is-ready",
            iconKey: "ready",
            summary: "Liberados para saida",
          }),
          buildStageStat("Saiu para entrega", {
            label: "Saiu para entrega",
            toneClass: "is-delivery",
            iconKey: "delivery",
            summary: "Pedidos em rota",
          }),
          {
            label: "Finalizados hoje",
            value: overview.finalizados,
            helper: formatMoney(overview.finance.closedRevenue || 0),
            summary: "Concluidos no recorte",
            toneClass: "is-revenue",
            iconKey: "finished",
          },
        ];
      })()
    : isDashboardSection
      ? [
        {
          label: "Pedidos do dia",
          value: overview.stats.todayOrders ?? 0,
          helper: "volume monitorado hoje",
          toneClass: "is-neutral",
          iconKey: "received",
        },
        {
          label: "Em preparo",
          value: overview.stats.preparingOrders ?? 0,
          helper: "na cozinha agora",
          toneClass: "is-preparing",
          iconKey: "preparing",
        },
        {
          label: "Em rota",
          value: overview.stats.deliveryOrders ?? 0,
          helper: "com motoboy",
          toneClass: "is-delivery",
          iconKey: "delivery",
        },
        {
          label: "Faturamento hoje",
          value: formatMoney(overview.stats.todayRevenue ?? 0),
          helper: "receita valida hoje",
          toneClass: "is-revenue",
          iconKey: "revenue",
        },
      ]
      : [
          {
            label: "Pedidos do dia",
            value: overview.stats.todayOrders ?? 0,
            helper: "volume monitorado hoje",
            toneClass: "is-neutral",
            iconKey: "received",
          },
          {
            label: "Em preparo",
            value: overview.stats.preparingOrders ?? 0,
            helper: "na cozinha agora",
            toneClass: "is-preparing",
            iconKey: "preparing",
          },
          {
            label: "Em rota",
            value: overview.stats.deliveryOrders ?? 0,
            helper: "com motoboy",
            toneClass: "is-delivery",
            iconKey: "delivery",
          },
          {
            label: "Faturamento",
            value: formatMoney(overview.stats.todayRevenue ?? 0),
            helper: "receita valida hoje",
            toneClass: "is-revenue",
            iconKey: "revenue",
          },
          {
            label: "Valor bruto vendido",
            value: formatMoney(overview.finance.grossRevenue || 0),
            helper: "pedidos nao cancelados",
            toneClass: "is-neutral",
            iconKey: "revenue",
          },
          {
            label: "Finalizados",
            value: overview.finalizados,
            helper: "pedidos concluidos",
            toneClass: "is-ready",
            iconKey: "finished",
          },
          {
            label: "Cancelados",
            value: overview.cancelados,
            helper: "perdas operacionais",
            toneClass: "is-danger",
            iconKey: "accepted",
          },
          {
            label: "Ticket medio",
            value: formatMoney(overview.finance.averageTicket || 0),
            helper: "media por pedido valido",
            toneClass: "is-revenue",
            iconKey: "revenue",
          },
        ];

  statsRoot.classList.toggle("is-orders-layout", isOrdersSection);

  statsRoot.innerHTML = cards
    .map(
      (card) => `
        <article class="admin-stat-card ${card.toneClass}">
          <div class="admin-stat-card-topline">
            <span class="admin-stat-card-icon" aria-hidden="true">${renderStatIcon(card.iconKey)}</span>
            <span>${escapeHtml(card.label)}</span>
          </div>
          <strong>${escapeHtml(String(card.value))}</strong>
          <small>${escapeHtml(card.helper)}</small>
          ${card.summary ? `<em class="admin-stat-card-summary">${escapeHtml(card.summary)}</em>` : ""}
        </article>
      `
    )
    .join("");
};

const renderDashboardSummaryBars = (items, maxValue) =>
  items
    .map(
      (item) => `
        <div class="admin-dashboard-status-row is-${escapeHtml(item.tone || "neutral")}">
          <strong>${escapeHtml(item.label)}</strong>
          <span>${escapeHtml(`${item.value} pedido(s)`)}</span>
          <div class="admin-dashboard-status-track">
            <span style="width: ${escapeHtml(String(Math.max(0, Math.min(100, item.percent || 0))))}%"></span>
          </div>
          <strong>${escapeHtml(formatPercent(item.percent || 0))}</strong>
        </div>
      `
    )
    .join("");

const renderDashboardFlowRows = (items) =>
  items
    .map(
      (item) => `
        <div class="admin-dashboard-flow-row is-${escapeHtml(item.key || "default")}">
          <span class="admin-dashboard-flow-row-icon" aria-hidden="true">${renderDashboardFlowIcon(
            item.key
          )}</span>
          <div class="admin-dashboard-flow-row-copy">
            <strong>${escapeHtml(item.label)}</strong>
            <small>${escapeHtml(item.helper)}</small>
          </div>
          <strong class="admin-dashboard-flow-row-value">${escapeHtml(String(item.value))}</strong>
        </div>
      `
    )
    .join("");

const renderDashboardFlowIcon = (key) => {
  const icons = {
    delivery:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7.5h10v8H4zM14 10h3l3 3v2h-6z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /><circle cx="8" cy="18" r="1.6" stroke="currentColor" stroke-width="1.8" /><circle cx="18" cy="18" r="1.6" stroke="currentColor" stroke-width="1.8" /></svg>',
    pickup:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 11h10l-1 8H8l-1-8Zm2-3V6a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>',
    active:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 17c2.1-3.7 4.5-5.5 7-5.5S16.9 13.3 19 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /><path d="m9 14 2.2-4 1.6 2 2.2-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>',
    scheduled:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm6 7v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /><circle cx="12" cy="12" r="0.9" fill="currentColor" /></svg>',
  };

  return icons[key] || icons.delivery;
};

const renderDashboardExecutiveRow = (overview) => {
  const cancellationPercent = Math.round((overview.cancelados / Math.max(overview.visibleOrders.length, 1)) * 100);

  return `
    <article class="admin-dashboard-block admin-dashboard-summary-block">
      <div class="admin-dashboard-block-head">
        <h3>Resumo do turno</h3>
      </div>
      <div class="admin-dashboard-summary-grid">
        <article class="admin-dashboard-summary-card is-green">
          <div class="admin-dashboard-summary-card-head">
            <span class="admin-dashboard-summary-card-icon" aria-hidden="true">${renderDashboardMetricIcon("revenue")}</span>
            <span>Receita validada</span>
          </div>
          <strong>${escapeHtml(formatMoney(overview.finance.grossRevenue || 0))}</strong>
          <small>Pedidos validados no recorte</small>
        </article>
        <article class="admin-dashboard-summary-card is-blue">
          <div class="admin-dashboard-summary-card-head">
            <span class="admin-dashboard-summary-card-icon" aria-hidden="true">${renderDashboardMetricIcon("ticket")}</span>
            <span>Ticket medio</span>
          </div>
          <strong>${escapeHtml(formatMoney(overview.finance.averageTicket || 0))}</strong>
          <small>Media por pedido valido</small>
        </article>
        <article class="admin-dashboard-summary-card is-purple">
          <div class="admin-dashboard-summary-card-head">
            <span class="admin-dashboard-summary-card-icon" aria-hidden="true">${renderDashboardMetricIcon("completed")}</span>
            <span>Pedidos concluidos</span>
          </div>
          <strong>${escapeHtml(String(overview.finalizados))}</strong>
          <small>Encerrados com sucesso</small>
        </article>
        <article class="admin-dashboard-summary-card is-red">
          <div class="admin-dashboard-summary-card-head">
            <span class="admin-dashboard-summary-card-icon" aria-hidden="true">${renderDashboardMetricIcon("cancelled")}</span>
            <span>Cancelados</span>
          </div>
          <strong>${escapeHtml(String(overview.cancelados))}</strong>
          <small>${escapeHtml(`${formatPercent(cancellationPercent)} do total`)}</small>
        </article>
      </div>
    </article>
    <article class="admin-dashboard-block admin-dashboard-distribution-block">
      <div class="admin-dashboard-block-head">
        <h3>Distribuicao por status</h3>
        <span>${escapeHtml(`${overview.visibleOrders.length} pedido(s) no recorte`)}</span>
      </div>
      <div class="admin-dashboard-status-list">
        ${renderDashboardSummaryBars(overview.statusBreakdown, overview.statusTotal)}
      </div>
    </article>
  `;
};

const renderDashboardMetricIcon = (key) => {
  const icons = {
    revenue:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v16M16 7.5c0-1.38-1.79-2.5-4-2.5s-4 1.12-4 2.5 1.79 2.5 4 2.5 4 1.12 4 2.5-1.79 2.5-4 2.5-4-1.12-4-2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>',
    ticket:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v16M8.5 8.5A3.5 3.5 0 0 1 12 5c1.93 0 3.5 1.12 3.5 2.5S13.93 10 12 10s-3.5 1.12-3.5 2.5S10.07 15 12 15a3.5 3.5 0 0 0 3.5-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>',
    completed:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m8.5 12.5 2.2 2.2 4.8-5.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8" /></svg>',
    cancelled:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 9 6 6M15 9l-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8" /></svg>',
  };

  return icons[key] || icons.revenue;
};

const formatDashboardAxisValue = (value) => {
  const numericValue = Number(value || 0);

  if (numericValue <= 0) {
    return "R$ 0";
  }

  if (numericValue >= 1000) {
    const compactValue = numericValue / 1000;
    const hasDecimal = Math.abs(compactValue % 1) > 0.01;
    return `R$ ${String(compactValue.toFixed(hasDecimal ? 1 : 0)).replace(".", ",")}k`;
  }

  return `R$ ${Math.round(numericValue)}`;
};

const getDashboardRevenuePeriodMeta = (periodKey) =>
  DASHBOARD_REVENUE_PERIODS.find((period) => period.key === periodKey) || DASHBOARD_REVENUE_PERIODS[0];

const buildDashboardRevenueXAxisTicks = (labels) => {
  if (labels.length <= 5) {
    return labels;
  }

  const indexes = Array.from(
    new Set([
      0,
      Math.round((labels.length - 1) * 0.25),
      Math.round((labels.length - 1) * 0.5),
      Math.round((labels.length - 1) * 0.75),
      labels.length - 1,
    ])
  );

  return indexes.map((index) => labels[index]);
};

const formatDashboardDayLabel = (value) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(value);

const buildDashboardRevenueTrend = (orders, periodKey = adminState.dashboardRevenuePeriod) => {
  const referenceDate = adminState.generatedAt ? new Date(adminState.generatedAt) : new Date();
  const normalizedReferenceDate = new Date(referenceDate);
  normalizedReferenceDate.setHours(0, 0, 0, 0);
  const period = getDashboardRevenuePeriodMeta(periodKey);
  let chartValues = [];
  let xAxisLabels = [];
  let periodRevenue = 0;

  if (period.key === "today") {
    const hourlyRevenue = Array.from({ length: 24 }, () => 0);

    orders
      .filter((order) => order.status !== "Cancelado")
      .forEach((order) => {
        const createdAt = new Date(order.createdAt);

        if (
          Number.isNaN(createdAt.getTime()) ||
          createdAt.getFullYear() !== referenceDate.getFullYear() ||
          createdAt.getMonth() !== referenceDate.getMonth() ||
          createdAt.getDate() !== referenceDate.getDate()
        ) {
          return;
        }

        hourlyRevenue[createdAt.getHours()] += getOrderProductRevenue(order);
      });

    chartValues = [];
    hourlyRevenue.reduce((sum, amount) => {
      const nextValue = sum + amount;
      chartValues.push(nextValue);
      return nextValue;
    }, 0);
    periodRevenue = chartValues[chartValues.length - 1] || 0;
    xAxisLabels = ["00h", "06h", "12h", "18h", "23h"];
  } else {
    const totalDays = period.key === "7d" ? 7 : 30;
    const startDate = new Date(normalizedReferenceDate);
    startDate.setDate(startDate.getDate() - (totalDays - 1));
    const dayRevenue = Array.from({ length: totalDays }, () => 0);
    const dayLabels = Array.from({ length: totalDays }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      return formatDashboardDayLabel(date);
    });

    orders
      .filter((order) => order.status !== "Cancelado")
      .forEach((order) => {
        const createdAt = new Date(order.createdAt);

        if (Number.isNaN(createdAt.getTime())) {
          return;
        }

        const normalizedCreatedAt = new Date(createdAt);
        normalizedCreatedAt.setHours(0, 0, 0, 0);

        if (normalizedCreatedAt < startDate || normalizedCreatedAt > normalizedReferenceDate) {
          return;
        }

        const dayIndex = Math.floor(
          (normalizedCreatedAt.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
        );

        if (dayIndex < 0 || dayIndex >= totalDays) {
          return;
        }

        dayRevenue[dayIndex] += getOrderProductRevenue(order);
      });

    chartValues = dayRevenue;
    periodRevenue = dayRevenue.reduce((sum, value) => sum + value, 0);
    xAxisLabels = buildDashboardRevenueXAxisTicks(dayLabels);
  }

  const chartWidth = 440;
  const chartHeight = 182;
  const maxValue = Math.max(...chartValues, 0);
  const scaledMax = maxValue > 0 ? Math.ceil(maxValue / 500) * 500 : 3000;
  const points = chartValues.map((value, index) => {
    const denominator = Math.max(chartValues.length - 1, 1);
    const x = Number(((index / denominator) * chartWidth).toFixed(2));
    const y = Number((chartHeight - (value / Math.max(scaledMax, 1)) * chartHeight).toFixed(2));
    return { x, y, value };
  });
  const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = `M0 ${chartHeight} ${points
    .map((point) => `L${point.x} ${point.y}`)
    .join(" ")} L${chartWidth} ${chartHeight} Z`;
  const yAxis = Array.from({ length: 6 }, (_, index) => {
    const ratio = 1 - index / 5;
    return {
      label: formatDashboardAxisValue(scaledMax * ratio),
      offset: Number((ratio * chartHeight).toFixed(2)),
    };
  });

  return {
    period,
    chartWidth,
    chartHeight,
    areaPath,
    polylinePoints,
    scaledMax,
    currentValue: periodRevenue,
    xAxisLabels,
    yAxis,
  };
};

const renderDashboardModule = () => {
  const moduleRoot = document.querySelector("[data-admin-module-content]");
  const overview = getDashboardOverview();

  if (!moduleRoot) {
    return;
  }

  const revenueTrend = buildDashboardRevenueTrend(overview.visibleOrders, adminState.dashboardRevenuePeriod);

  moduleRoot.innerHTML = `
    <section class="admin-dashboard-bottom-grid">
      <article class="admin-dashboard-block admin-dashboard-flow-panel">
        <div class="admin-dashboard-block-head">
          <div>
            <h3>Fluxo do turno</h3>
            <small>${escapeHtml(`${overview.validOrders.length} pedido(s) validos`)}</small>
          </div>
        </div>
        <div class="admin-dashboard-flow-list">
          ${renderDashboardFlowRows(overview.flowBreakdown)}
        </div>
      </article>

      <article class="admin-dashboard-block admin-dashboard-revenue-panel">
        <div class="admin-dashboard-block-head">
          <h3>Receita e fechamento</h3>
          <span>${escapeHtml(`${overview.finalizados} finalizado(s)`)}</span>
        </div>
        <div class="admin-dashboard-revenue-grid">
          <article class="admin-dashboard-revenue-card">
            <span>Faturamento</span>
            <strong>${escapeHtml(formatMoney(overview.stats.todayRevenue || 0))}</strong>
          </article>
          <article class="admin-dashboard-revenue-card">
            <span>Bruto vendido</span>
            <strong>${escapeHtml(formatMoney(overview.finance.grossRevenue || 0))}</strong>
          </article>
          <article class="admin-dashboard-revenue-card">
            <span>Ticket medio</span>
            <strong>${escapeHtml(formatMoney(overview.finance.averageTicket || 0))}</strong>
          </article>
          <article class="admin-dashboard-revenue-card">
            <span>Valor de entrega</span>
            <strong>${escapeHtml(formatMoney(overview.finance.deliveryFees || 0))}</strong>
          </article>
        </div>
      </article>

      <article class="admin-dashboard-block admin-dashboard-notes-panel">
        <div class="admin-dashboard-block-head">
          <h3>Leitura rapida</h3>
          <span>${escapeHtml(adminState.searchQuery ? "Filtro ativo" : "Visao completa")}</span>
        </div>
        <div class="admin-dashboard-note-list">
          <article class="admin-dashboard-note-card">
            <span class="admin-dashboard-note-icon" aria-hidden="true">i</span>
            <div>
              <strong>Pedidos do dia</strong>
              <small>${escapeHtml(`${overview.stats.todayOrders || 0} pedido(s) entraram hoje no gestor.`)}</small>
            </div>
            <span class="admin-dashboard-note-arrow" aria-hidden="true">›</span>
          </article>
          <article class="admin-dashboard-note-card">
            <span class="admin-dashboard-note-icon" aria-hidden="true">i</span>
            <div>
              <strong>Fila ativa</strong>
              <small>${escapeHtml(`${overview.activeOrders} pedido(s) seguem em andamento no turno atual.`)}</small>
            </div>
            <span class="admin-dashboard-note-arrow" aria-hidden="true">›</span>
          </article>
          <article class="admin-dashboard-note-card">
            <span class="admin-dashboard-note-icon" aria-hidden="true">i</span>
            <div>
              <strong>Dados sincronizados</strong>
              <small>${escapeHtml(
                adminState.generatedAt
                  ? `Dados sincronizados em ${formatDateTime(adminState.generatedAt)}.`
                  : "Aguardando sincronizacao inicial do turno."
              )}</small>
            </div>
            <span class="admin-dashboard-note-arrow" aria-hidden="true">›</span>
          </article>
        </div>
      </article>

      <article class="admin-dashboard-block admin-dashboard-chart-panel">
        <div class="admin-dashboard-block-head">
          <h3>Evolucao do faturamento</h3>
          <div class="admin-dashboard-chart-period" data-dashboard-period-dropdown>
            <button
              class="admin-dashboard-chart-filter"
              type="button"
              data-dashboard-period-toggle
              aria-haspopup="menu"
              aria-expanded="${adminState.dashboardRevenueMenuOpen ? "true" : "false"}"
            >
              <span>${escapeHtml(revenueTrend.period.label)}</span>
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="m5 7.5 5 5 5-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            ${
              adminState.dashboardRevenueMenuOpen
                ? `
                  <div class="admin-dashboard-chart-menu" role="menu">
                    ${DASHBOARD_REVENUE_PERIODS.map(
                      (period) => `
                        <button
                          class="admin-dashboard-chart-menu-option${
                            period.key === revenueTrend.period.key ? " is-active" : ""
                          }"
                          type="button"
                          role="menuitemradio"
                          aria-checked="${period.key === revenueTrend.period.key ? "true" : "false"}"
                          data-dashboard-period-option="${escapeHtml(period.key)}"
                        >
                          ${escapeHtml(period.label)}
                        </button>
                      `
                    ).join("")}
                  </div>
                `
                : ""
            }
          </div>
        </div>
        <div class="admin-dashboard-chart">
          <div class="admin-dashboard-chart-y-axis">
            ${revenueTrend.yAxis
              .map(
                (tick) => `
                  <span style="bottom:${escapeHtml(String(tick.offset))}px">${escapeHtml(tick.label)}</span>
                `
              )
              .join("")}
          </div>
          <div class="admin-dashboard-chart-plot">
            <svg viewBox="0 0 ${escapeHtml(String(revenueTrend.chartWidth))} ${escapeHtml(
              String(revenueTrend.chartHeight)
            )}" preserveAspectRatio="none" aria-hidden="true">
              <g class="admin-dashboard-chart-grid">
                <line x1="0" y1="0" x2="${escapeHtml(String(revenueTrend.chartWidth))}" y2="0"></line>
                <line x1="0" y1="36.4" x2="${escapeHtml(String(revenueTrend.chartWidth))}" y2="36.4"></line>
                <line x1="0" y1="72.8" x2="${escapeHtml(String(revenueTrend.chartWidth))}" y2="72.8"></line>
                <line x1="0" y1="109.2" x2="${escapeHtml(String(revenueTrend.chartWidth))}" y2="109.2"></line>
                <line x1="0" y1="145.6" x2="${escapeHtml(String(revenueTrend.chartWidth))}" y2="145.6"></line>
                <line x1="0" y1="${escapeHtml(String(revenueTrend.chartHeight))}" x2="${escapeHtml(
                  String(revenueTrend.chartWidth)
                )}" y2="${escapeHtml(String(revenueTrend.chartHeight))}"></line>
              </g>
              <path class="admin-dashboard-chart-area" d="${escapeHtml(revenueTrend.areaPath)}"></path>
              <polyline class="admin-dashboard-chart-line" points="${escapeHtml(
                revenueTrend.polylinePoints
              )}"></polyline>
            </svg>
            <div class="admin-dashboard-chart-x-axis">
              ${revenueTrend.xAxisLabels
                .map((label) => `<span>${escapeHtml(label)}</span>`)
                .join("")}
            </div>
          </div>
        </div>
        <div class="admin-dashboard-chart-total">
          <span>Faturamento atual</span>
          <strong>${escapeHtml(formatMoney(revenueTrend.currentValue || 0))}</strong>
        </div>
      </article>
    </section>
  `;
};

const renderOrdersModuleShell = () => {
  const moduleRoot = document.querySelector("[data-admin-module-content]");
  const completedOrders = getCompletedOrders().length;
  const cancelledOrders = getCancelledOrders().length;

  if (!moduleRoot) {
    return;
  }

  moduleRoot.innerHTML = `
    <div class="admin-board" data-admin-board></div>

    <section class="admin-closed-panel">
      <div class="admin-module-head">
        <div>
          <span class="admin-chip">Encerrados</span>
          <h3>Consulta de encerrados</h3>
          <p>Pedidos concluidos e cancelados saem do kanban ativo e ficam separados para consulta.</p>
        </div>
        <div class="admin-module-head-meta">
          <span>Total encerrado</span>
          <strong>${escapeHtml(String(getClosedOrders().length))}</strong>
        </div>
      </div>
      <div class="admin-closed-groups">
        <article class="admin-module-card">
          <div class="admin-module-card-head">
            <h3>Finalizados</h3>
            <span>${escapeHtml(String(completedOrders))}</span>
          </div>
          <div class="admin-closed-list" data-admin-completed-orders></div>
        </article>
        <article class="admin-module-card">
          <div class="admin-module-card-head">
            <h3>Cancelados</h3>
            <span>${escapeHtml(String(cancelledOrders))}</span>
          </div>
          <div class="admin-closed-list" data-admin-cancelled-orders></div>
        </article>
      </div>
    </section>
  `;
};

const renderClosedOrders = () => {
  const completedRoot = document.querySelector("[data-admin-completed-orders]");
  const cancelledRoot = document.querySelector("[data-admin-cancelled-orders]");

  if (!completedRoot || !cancelledRoot) {
    return;
  }

  const renderClosedList = (root, orders, emptyTitle, emptyCopy) => {
    root.innerHTML = orders.length === 0
      ? `
      <div class="admin-empty-state admin-empty-state-inline">
        <strong>${escapeHtml(emptyTitle)}</strong>
        <span>${escapeHtml(emptyCopy)}</span>
      </div>
    `
      : orders
          .map(
            (order) => `
        <button
          class="admin-closed-card${adminState.selectedOrderId === order.id ? " is-selected" : ""}"
          type="button"
          data-order-select="${escapeHtml(order.id)}"
        >
          <div>
            <strong>${escapeHtml(order.publicId)}</strong>
            <small>${escapeHtml(order.customerName)}</small>
          </div>
          <div class="admin-closed-card-meta">
            <span class="${getStatusClassName(order.status)}">${escapeHtml(order.status)}</span>
            <small>${escapeHtml(formatDateTime(order.updatedAt || order.createdAt))}</small>
          </div>
          <div class="admin-closed-card-summary">
            <span>${escapeHtml(getOrderTypeLabel(order))}</span>
            <span>${escapeHtml(`${formatMoney(order.totalAmount || 0)} | ${getOrderWaitLabel(order)}`)}</span>
          </div>
        </button>
      `
          )
          .join("");
  };

  renderClosedList(
    completedRoot,
    getCompletedOrders(),
    "Nenhum pedido finalizado",
    "Entregas concluidas e retiradas finalizadas aparecem aqui."
  );
  renderClosedList(
    cancelledRoot,
    getCancelledOrders(),
    "Nenhum pedido cancelado",
    "Quando houver cancelamentos, eles ficam separados para consulta rapida."
  );
};

const renderScheduledOrderCard = (order) => {
  const isSelected = adminState.selectedOrderId === order.id;
  const scheduleState = getScheduledStatusLabel(order);
  const scheduleDistance = getScheduledTimeDistanceLabel(order);
  const quickNote = getOrderQuickNote(order);
  const orderTypeLabel = order.fulfillmentMode === "pickup" ? "Retirada" : "Entrega";

  return `
    <button
      class="admin-scheduled-card${isSelected ? " is-selected" : ""}${order.isDueSoon ? " is-due-soon" : ""}"
      type="button"
      data-order-select="${escapeHtml(order.id)}"
    >
      <div class="admin-scheduled-card-top">
        <div>
          <strong>${escapeHtml(order.publicId)}</strong>
          <small>${escapeHtml(order.customerName)}</small>
        </div>
        <span class="admin-inline-chip${order.isDueSoon ? " is-due-soon" : ""}">${escapeHtml(
          scheduleState
        )}</span>
      </div>

      <div class="admin-scheduled-card-grid">
        <span><strong>Horario</strong>${escapeHtml(order.scheduledLabel || formatDateTime(order.scheduledFor))}</span>
        <span><strong>Fluxo</strong>${escapeHtml(orderTypeLabel)}</span>
        <span><strong>Pagamento</strong>${escapeHtml(getPaymentLabel(order.paymentMethod))}</span>
        <span><strong>Total</strong>${escapeHtml(formatMoney(order.totalAmount || 0))}</span>
      </div>

      <div class="admin-scheduled-card-footer">
        <small>${escapeHtml(quickNote)}</small>
        <strong>${escapeHtml(scheduleDistance)}</strong>
      </div>
    </button>
  `;
};

const renderScheduledModule = () => {
  const moduleRoot = document.querySelector("[data-admin-module-content]");
  const snapshot = getScheduledSnapshot();
  const visibleOrders = getVisibleScheduledOrders();
  const deliveryOrders = visibleOrders.filter((order) => order.fulfillmentMode === "delivery");
  const pickupOrders = visibleOrders.filter((order) => order.fulfillmentMode === "pickup");

  if (!moduleRoot) {
    return;
  }

  if (adminState.isLoadingScheduled && !snapshot.orders.length) {
    moduleRoot.innerHTML = `
      <div class="admin-empty-state admin-empty-state-loading">
        <strong>Carregando agendamentos</strong>
        <span>O gestor esta buscando os pedidos futuros com persistencia real.</span>
      </div>
    `;
    return;
  }

  moduleRoot.innerHTML = `
    <header class="admin-module-head">
      <div>
        <span class="admin-chip">Agendamentos</span>
        <h2>Pedidos futuros fora do fluxo imediato</h2>
        <p>Use a agenda para acompanhar entrega, retirada e o momento exato em que cada pedido entra na fila ativa.</p>
      </div>
      <div class="admin-module-head-meta">
        <span>Proximo horario</span>
        <strong>${escapeHtml(
          snapshot.summary?.nextScheduledAt ? formatDateTime(snapshot.summary.nextScheduledAt) : "Sem agenda futura"
        )}</strong>
      </div>
    </header>

    <section class="admin-module-kpis">
      <article class="admin-mini-stat is-blue">
        <span>Total futuro</span>
        <strong>${escapeHtml(String(snapshot.summary?.totalOrders || 0))}</strong>
      </article>
      <article class="admin-mini-stat is-warm">
        <span>Proximos do horario</span>
        <strong>${escapeHtml(String(snapshot.summary?.dueSoonOrders || 0))}</strong>
      </article>
      <article class="admin-mini-stat is-cyan">
        <span>Entrega</span>
        <strong>${escapeHtml(String(snapshot.summary?.deliveryOrders || 0))}</strong>
      </article>
      <article class="admin-mini-stat is-green">
        <span>Retirada</span>
        <strong>${escapeHtml(String(snapshot.summary?.pickupOrders || 0))}</strong>
      </article>
    </section>

    <section class="admin-module-card admin-scheduled-toolbar">
      <label class="admin-field">
        <span>Data programada</span>
        <input
          class="admin-input"
          type="date"
          value="${escapeHtml(adminState.scheduledFilters.date || "")}"
          data-scheduled-filter="date"
        />
      </label>

      <label class="admin-field">
        <span>Modalidade</span>
        <select class="admin-input" data-scheduled-filter="fulfillmentMode">
          <option value="">Entrega e retirada</option>
          <option value="delivery" ${adminState.scheduledFilters.fulfillmentMode === "delivery" ? "selected" : ""}>Entrega</option>
          <option value="pickup" ${adminState.scheduledFilters.fulfillmentMode === "pickup" ? "selected" : ""}>Retirada</option>
        </select>
      </label>
    </section>

    <section class="admin-scheduled-grid">
      <article class="admin-module-card">
        <div class="admin-module-card-head">
          <h3>Entrega agendada</h3>
          <span>${escapeHtml(String(deliveryOrders.length))}</span>
        </div>
        <div class="admin-scheduled-list">
          ${
            deliveryOrders.length > 0
              ? deliveryOrders.map(renderScheduledOrderCard).join("")
              : `
                <div class="admin-empty-inline">
                  <span>Nenhuma entrega agendada no filtro atual.</span>
                </div>
              `
          }
        </div>
      </article>

      <article class="admin-module-card">
        <div class="admin-module-card-head">
          <h3>Retirada agendada</h3>
          <span>${escapeHtml(String(pickupOrders.length))}</span>
        </div>
        <div class="admin-scheduled-list">
          ${
            pickupOrders.length > 0
              ? pickupOrders.map(renderScheduledOrderCard).join("")
              : `
                <div class="admin-empty-inline">
                  <span>Nenhuma retirada agendada no filtro atual.</span>
                </div>
              `
          }
        </div>
      </article>
    </section>
  `;
};

const getMenuItemStateCopy = (item) => {
  if (item.availabilityState === "paused") {
    return "Pausado";
  }

  if (item.availabilityState === "unavailable") {
    return "Indisponivel";
  }

  return "Ativo";
};

const getMenuItemPriceLabel = (value) =>
  typeof value === "number" ? formatMoney(value) : "Sem preco";

const getMenuSnapshot = () =>
  adminState.menuSnapshot || {
    summary: {
      totalSections: 0,
      totalItems: 0,
      activeItems: 0,
      pausedItems: 0,
      unavailableItems: 0,
      highlightedItems: 0,
      itemsWithoutPrice: 0,
    },
    sections: [],
    featuredItemId: "",
    featuredItemIds: [],
    catalogOptions: {
      sections: [],
      categories: [],
    },
  };

const getMenuFeaturedItemIds = (snapshot = getMenuSnapshot()) => {
  const featuredItemIds = Array.isArray(snapshot?.featuredItemIds)
    ? snapshot.featuredItemIds
    : [];

  if (featuredItemIds.length > 0) {
    return featuredItemIds;
  }

  const featuredItemId = String(snapshot?.featuredItemId || "").trim();
  return featuredItemId ? [featuredItemId] : [];
};

const getMenuBusyKey = (type, value = "") => `${type}:${value || "new"}`;

const renderMenuItemPreview = (item) => {
  const imageUrl = resolveAdminAssetUrl(item.image || "");

  if (!imageUrl) {
    return '<div class="admin-menu-item-media admin-menu-item-media-empty"><span>Sem foto</span></div>';
  }

  return `
    <div class="admin-menu-item-media">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.name || "Prato do cardapio")}" loading="lazy" decoding="async" />
    </div>
  `;
};

const renderMenuItemCard = (item, section, options = {}) => {
  const isNew = options.isNew === true;
  const busyKey = getMenuBusyKey("item", isNew ? `new-${section.id}` : item.id);
  const isBusy = adminState.menuBusyKey === busyKey;
  const itemId = isNew ? "" : item.id;
  const featuredItemIds = getMenuFeaturedItemIds();
  const highlightPosition = itemId ? featuredItemIds.indexOf(itemId) : -1;
  const itemName = isNew ? "" : item.name;
  const itemCategory = isNew ? section.title : item.category;
  const itemDescription = isNew ? "" : item.description || "";
  const itemDetail = isNew ? "" : item.detail || "";
  const itemBadge = isNew ? "Consulte" : item.baseBadge || item.badge || "Consulte";
  const itemPrice = isNew ? "" : typeof item.regularPrice === "number" ? item.regularPrice.toFixed(2) : typeof item.price === "number" ? item.price.toFixed(2) : "";
  const availabilityState = isNew ? "active" : item.availabilityState || "active";
  const isHighlighted = isNew ? false : item.isHighlighted === true;
  const canSelectHighlight = isHighlighted || featuredItemIds.length < MENU_HOME_HIGHLIGHT_LIMIT;
  const highlightDisabled = isBusy || !canSelectHighlight;
  const highlightHelpCopy = isHighlighted
    ? `Este prato participa da rotacao da home na posicao ${highlightPosition + 1}.`
    : featuredItemIds.length >= MENU_HOME_HIGHLIGHT_LIMIT
      ? `Limite de ${MENU_HOME_HIGHLIGHT_LIMIT} destaques atingido. Remova um destaque atual para incluir outro prato.`
      : `Voce pode destacar ate ${MENU_HOME_HIGHLIGHT_LIMIT} pratos para rotacionar na home.`;
  const imageValue = isNew ? "" : item.image || "";
  const imageTextValue = imageValue.startsWith("data:") ? "" : imageValue;

  return `
    <form class="admin-menu-item-card${isNew ? " is-new" : ""}" data-menu-item-form="${escapeHtml(itemId || `new-${section.id}`)}">
      <input type="hidden" name="sectionId" value="${escapeHtml(section.id)}" />
      <input type="hidden" name="itemId" value="${escapeHtml(itemId)}" />

      <div class="admin-menu-item-main">
        ${renderMenuItemPreview({
          image: imageValue,
          name: itemName || `${section.title} novo item`,
        })}

        <div class="admin-menu-item-copy">
          <div class="admin-menu-item-copy-top">
            <div>
              <strong>${escapeHtml(isNew ? "Novo prato" : itemName)}</strong>
              <small>${escapeHtml(isNew ? `sera criado em ${section.title}` : `${itemCategory || "Categoria"} | ${item.id}`)}</small>
            </div>
            <div class="admin-menu-item-badges">
              ${
                isNew
                  ? '<span class="admin-inline-chip">Novo</span>'
                  : `<span class="admin-inline-chip">${escapeHtml(getMenuItemStateCopy(item))}</span>`
              }
              ${
                !isNew && item.isHighlighted
                  ? `<span class="admin-inline-chip is-promo">Destaque ${escapeHtml(String(highlightPosition + 1))}/${MENU_HOME_HIGHLIGHT_LIMIT}</span>`
                  : ""
              }
              ${
                !isNew && typeof item.price !== "number"
                  ? '<span class="admin-inline-chip is-warning">Sem preco</span>'
                  : ""
              }
            </div>
          </div>

          <div class="admin-menu-item-form-grid">
            <label class="admin-field">
              <span>Nome do prato</span>
              <input class="admin-input" type="text" name="name" value="${escapeHtml(itemName)}" placeholder="Ex.: Combinado Sakura" ${isBusy ? "disabled" : ""} />
            </label>

            <label class="admin-field">
              <span>Categoria</span>
              <input class="admin-input" type="text" name="category" value="${escapeHtml(itemCategory)}" placeholder="Ex.: Combinados" ${isBusy ? "disabled" : ""} />
            </label>

            <label class="admin-field admin-field-wide">
              <span>Descricao</span>
              <textarea class="admin-input admin-textarea" name="description" placeholder="Descreva o prato para o site." ${isBusy ? "disabled" : ""}>${escapeHtml(itemDescription)}</textarea>
            </label>

            <label class="admin-field">
              <span>Preco</span>
              <input class="admin-input" type="text" name="price" inputmode="decimal" value="${escapeHtml(itemPrice)}" placeholder="Ex.: 39.90" ${isBusy ? "disabled" : ""} />
            </label>

            <label class="admin-field">
              <span>Detalhe curto</span>
              <input class="admin-input" type="text" name="detail" value="${escapeHtml(itemDetail)}" placeholder="Ex.: 20 pecas" ${isBusy ? "disabled" : ""} />
            </label>

            <label class="admin-field">
              <span>Badge</span>
              <input class="admin-input" type="text" name="badge" value="${escapeHtml(itemBadge)}" placeholder="Ex.: Consulte" ${isBusy ? "disabled" : ""} />
            </label>

            <label class="admin-field">
              <span>Estado operacional</span>
              <select class="admin-input" name="availabilityState" ${isBusy ? "disabled" : ""}>
                <option value="active" ${availabilityState === "active" ? "selected" : ""}>Ativo</option>
                <option value="paused" ${availabilityState === "paused" ? "selected" : ""}>Pausado</option>
                <option value="unavailable" ${availabilityState === "unavailable" ? "selected" : ""}>Indisponivel</option>
              </select>
            </label>

            <label class="admin-field admin-field-wide">
              <span>Foto do prato</span>
              <input class="admin-input" type="text" name="image" value="${escapeHtml(imageTextValue)}" placeholder="Cole uma URL/caminho ou envie um arquivo abaixo." ${isBusy ? "disabled" : ""} />
            </label>
          </div>

          <div class="admin-menu-item-upload-row">
            <label class="admin-field admin-field-wide">
              <span>Enviar nova foto</span>
              <input class="admin-input admin-menu-file-input" type="file" accept="image/*" data-menu-image-upload ${isBusy ? "disabled" : ""} />
            </label>
          </div>

          <div class="admin-menu-item-footer">
            <div class="admin-menu-price-meta">
              <span><strong>Preco atual</strong>${escapeHtml(isNew ? "Sera definido ao salvar" : getMenuItemPriceLabel(item.price))}</span>
              <span><strong>Base original</strong>${escapeHtml(isNew ? "Novo item" : getMenuItemPriceLabel(item.basePrice))}</span>
              <span><strong>Ultima alteracao</strong>${escapeHtml(
                !isNew && item.overrideUpdatedAt ? formatDateTime(item.overrideUpdatedAt) : "Catalogo atual"
              )}</span>
            </div>

            <div class="admin-menu-item-controls">
              <label class="admin-menu-checkbox">
                <input
                  type="checkbox"
                  name="isHighlighted"
                  ${isHighlighted ? "checked" : ""}
                  ${highlightDisabled ? "disabled" : ""}
                  title="${escapeHtml(highlightHelpCopy)}"
                />
                <span>Destacar</span>
              </label>
              <small class="admin-menu-highlight-note">${escapeHtml(highlightHelpCopy)}</small>

              <div class="admin-menu-item-actions">
                <button class="admin-button admin-button-primary" type="submit" name="intent" value="save-item" ${isBusy ? "disabled" : ""}>
                  ${isBusy ? "Salvando..." : isNew ? "Criar prato" : "Salvar prato"}
                </button>
                ${
                  isNew
                    ? ""
                    : `<button class="admin-button admin-button-secondary" type="submit" name="intent" value="delete-item" ${isBusy ? "disabled" : ""}>Remover prato</button>`
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  `;
};

const renderMenuSectionCard = (section) => {
  const busyKey = getMenuBusyKey("section", section.id);
  const isBusy = adminState.menuBusyKey === busyKey;
  const categories = [...new Set((section.items || []).map((item) => item.category).filter(Boolean))];

  return `
    <article class="admin-module-card admin-menu-section-card">
      <form class="admin-menu-section-editor" data-menu-section-form="${escapeHtml(section.id)}">
        <input type="hidden" name="sectionId" value="${escapeHtml(section.id)}" />

        <div class="admin-module-card-head">
          <div>
            <h3>${escapeHtml(section.title)}</h3>
            <p>${escapeHtml(section.description || "Categoria operacional do site e do cardapio publico.")}</p>
          </div>
          <span>${escapeHtml(`${section.items.length} item(ns)`)}</span>
        </div>

        <div class="admin-menu-section-form-grid">
          <label class="admin-field">
            <span>Nome da categoria</span>
            <input class="admin-input" type="text" name="title" value="${escapeHtml(section.title)}" ${isBusy ? "disabled" : ""} />
          </label>

          <label class="admin-field">
            <span>Badge/apoio</span>
            <input class="admin-input" type="text" name="kicker" value="${escapeHtml(section.kicker || "")}" placeholder="Ex.: Especialidades" ${isBusy ? "disabled" : ""} />
          </label>

          <label class="admin-field admin-field-wide">
            <span>Descricao da categoria</span>
            <textarea class="admin-input admin-textarea" name="description" placeholder="Explique rapidamente o setor no site." ${isBusy ? "disabled" : ""}>${escapeHtml(section.description || "")}</textarea>
          </label>
        </div>

        <div class="admin-menu-section-meta">
          <div class="admin-menu-categories">
            ${categories.length > 0 ? categories.map((category) => `<span class="admin-inline-chip">${escapeHtml(category)}</span>`).join("") : '<span class="admin-inline-chip">Sem categorias internas</span>'}
          </div>

          <div class="admin-menu-item-actions">
            <button class="admin-button admin-button-secondary" type="submit" name="intent" value="delete-section" ${isBusy ? "disabled" : ""}>Remover categoria</button>
            <button class="admin-button admin-button-primary" type="submit" name="intent" value="save-section" ${isBusy ? "disabled" : ""}>
              ${isBusy ? "Salvando..." : "Salvar categoria"}
            </button>
          </div>
        </div>
      </form>

      <div class="admin-menu-item-list">
        ${(section.items || []).map((item) => renderMenuItemCard(item, section)).join("")}
        ${renderMenuItemCard({}, section, { isNew: true })}
      </div>
    </article>
  `;
};

const renderMenuModule = () => {
  const moduleRoot = document.querySelector("[data-admin-module-content]");
  const snapshot = getMenuSnapshot();
  const visibleSections = getVisibleMenuSections();
  const newSectionBusy = adminState.menuBusyKey === getMenuBusyKey("section", "new");
  const featuredItemIds = getMenuFeaturedItemIds(snapshot);
  const featuredSelectionCopy =
    featuredItemIds.length === 0
      ? `Escolha ate ${MENU_HOME_HIGHLIGHT_LIMIT} pratos para rotacionar no card principal da home do cliente.`
      : featuredItemIds.length >= MENU_HOME_HIGHLIGHT_LIMIT
        ? `Limite de ${MENU_HOME_HIGHLIGHT_LIMIT} destaques ativo. Remova um prato atual para incluir outro.`
        : `${featuredItemIds.length} de ${MENU_HOME_HIGHLIGHT_LIMIT} destaques ativos na rotacao principal da home.`;

  if (!moduleRoot) {
    return;
  }

  if (adminState.isLoadingMenu && !snapshot.sections.length) {
    moduleRoot.innerHTML = `
      <div class="admin-empty-state admin-empty-state-loading">
        <strong>Carregando catalogo</strong>
        <span>O gestor esta preparando categorias, pratos, fotos e controles do cardapio publico.</span>
      </div>
    `;
    return;
  }

  moduleRoot.innerHTML = `
    <header class="admin-module-head">
      <div>
        <span class="admin-chip">Cardapio</span>
        <h2>Controle vivo do cardapio do site</h2>
        <p>Crie categorias, cadastre pratos, ajuste foto, preco, descricao, pausa e destaque o item que vai aparecer na capa do cliente.</p>
      </div>
      <div class="admin-module-head-meta">
        <span>Itens publicados</span>
        <strong>${escapeHtml(String(snapshot.summary?.totalItems || 0))}</strong>
      </div>
    </header>

    <section class="admin-module-kpis admin-module-kpis-wide admin-menu-kpis">
      <article class="admin-mini-stat is-blue">
        <span>Categorias</span>
        <strong>${escapeHtml(String(snapshot.summary?.totalSections || snapshot.sections.length || 0))}</strong>
      </article>
      <article class="admin-mini-stat is-green">
        <span>Ativos</span>
        <strong>${escapeHtml(String(snapshot.summary?.activeItems || 0))}</strong>
      </article>
      <article class="admin-mini-stat is-warm">
        <span>Pausados</span>
        <strong>${escapeHtml(String(snapshot.summary?.pausedItems || 0))}</strong>
      </article>
      <article class="admin-mini-stat is-danger">
        <span>Indisponiveis</span>
        <strong>${escapeHtml(String(snapshot.summary?.unavailableItems || 0))}</strong>
      </article>
      <article class="admin-mini-stat is-cyan">
        <span>Destaques na home</span>
        <strong>${escapeHtml(String(snapshot.summary?.highlightedItems || 0))}</strong>
      </article>
      <article class="admin-mini-stat is-gold">
        <span>Sem preco</span>
        <strong>${escapeHtml(String(snapshot.summary?.itemsWithoutPrice || 0))}</strong>
      </article>
    </section>

    <section class="admin-module-card admin-menu-toolbar-card">
      <div class="admin-menu-toolbar">
        <label class="admin-field">
          <span>Categoria</span>
          <select class="admin-input" data-menu-filter="sectionId">
            <option value="">Todas as categorias</option>
            ${(snapshot.sections || [])
              .map(
                (section) => `
                  <option value="${escapeHtml(section.id)}" ${section.id === adminState.menuFilters.sectionId ? "selected" : ""}>
                    ${escapeHtml(section.title)}
                  </option>
                `
              )
              .join("")}
          </select>
        </label>

        <label class="admin-field">
          <span>Estado</span>
          <select class="admin-input" data-menu-filter="availabilityState">
            <option value="">Todos</option>
            <option value="active" ${adminState.menuFilters.availabilityState === "active" ? "selected" : ""}>Ativos</option>
            <option value="paused" ${adminState.menuFilters.availabilityState === "paused" ? "selected" : ""}>Pausados</option>
            <option value="unavailable" ${adminState.menuFilters.availabilityState === "unavailable" ? "selected" : ""}>Indisponiveis</option>
          </select>
        </label>
      </div>

      <div class="admin-menu-toolbar-copy">
        <strong>${escapeHtml(featuredSelectionCopy)}</strong>
        <p>Itens pausados somem do site do cliente, mas continuam aqui para reativacao posterior. O card principal sempre mostra apenas Consulte e pode alternar entre ate 3 destaques.</p>
      </div>
    </section>

    <section class="admin-module-card admin-menu-create-section">
      <form class="admin-menu-section-editor is-new" data-menu-section-form="new">
        <div class="admin-module-card-head">
          <div>
            <h3>Nova categoria</h3>
            <p>Crie um novo setor do cardapio sem editar o codigo do site.</p>
          </div>
          <span>Nova</span>
        </div>

        <div class="admin-menu-section-form-grid">
          <label class="admin-field">
            <span>Nome da categoria</span>
            <input class="admin-input" type="text" name="title" placeholder="Ex.: Temakis especiais" ${newSectionBusy ? "disabled" : ""} />
          </label>

          <label class="admin-field">
            <span>Badge/apoio</span>
            <input class="admin-input" type="text" name="kicker" placeholder="Ex.: Novidades" ${newSectionBusy ? "disabled" : ""} />
          </label>

          <label class="admin-field admin-field-wide">
            <span>Descricao</span>
            <textarea class="admin-input admin-textarea" name="description" placeholder="Explique rapidamente essa categoria para o site." ${newSectionBusy ? "disabled" : ""}></textarea>
          </label>
        </div>

        <div class="admin-menu-item-actions">
          <button class="admin-button admin-button-primary" type="submit" name="intent" value="save-section" ${newSectionBusy ? "disabled" : ""}>
            ${newSectionBusy ? "Salvando..." : "Criar categoria"}
          </button>
        </div>
      </form>
    </section>

    <section class="admin-menu-grid">
      ${
        visibleSections.length > 0
          ? visibleSections.map(renderMenuSectionCard).join("")
          : `
            <div class="admin-empty-state">
              <strong>Nenhum item encontrado</strong>
              <span>Ajuste a busca global ou os filtros do cardapio para ampliar a lista.</span>
            </div>
          `
      }
    </section>
  `;
};

const syncPromotionFormVisibility = (form) => {
  if (!form) {
    return;
  }

  const scopeType = String(form.elements.scopeType?.value || "item").trim();
  const pricingType = String(form.elements.pricingType?.value || "fixed_price").trim();

  form.querySelectorAll("[data-promotion-target-group]").forEach((node) => {
    const shouldShow = node.dataset.promotionTargetGroup === scopeType;
    node.hidden = !shouldShow;
    node.querySelectorAll("select, input").forEach((field) => {
      field.disabled = !shouldShow && field.name !== "scopeType" && field.name !== "pricingType";
    });
  });

  form.querySelectorAll("[data-promotion-pricing-group]").forEach((node) => {
    const shouldShow = node.dataset.promotionPricingGroup === pricingType;
    node.hidden = !shouldShow;
    node.querySelectorAll("select, input").forEach((field) => {
      field.disabled = !shouldShow && field.name !== "scopeType" && field.name !== "pricingType";
    });
  });
};

const renderPromotionCard = (promotion) => {
  const isSelected = adminState.selectedPromotionId === promotion.id;
  const previewNames = Array.isArray(promotion.affectedItemsPreview)
    ? promotion.affectedItemsPreview.slice(0, 3).join(" | ")
    : "";

  return `
    <article class="admin-promotion-card${isSelected ? " is-selected" : ""}">
      <button
        class="admin-promotion-card-select"
        type="button"
        data-promotion-select="${escapeHtml(promotion.id)}"
      >
        <div class="admin-promotion-card-top">
          <div>
            <strong>${escapeHtml(promotion.internalName)}</strong>
            <small>${escapeHtml(`${promotion.scopeLabel}: ${promotion.targetLabel}`)}</small>
          </div>
          <span class="${getPromotionStatusClassName(promotion.status)}">${escapeHtml(
            promotion.statusLabel
          )}</span>
        </div>

        <div class="admin-promotion-card-grid">
          <span><strong>Tipo</strong>${escapeHtml(promotion.pricingLabel)}</span>
          <span><strong>Valor</strong>${escapeHtml(getPromotionPricingValueLabel(promotion))}</span>
          <span><strong>Preco final</strong>${escapeHtml(getPromotionPricePreviewLabel(promotion))}</span>
          <span><strong>Validade</strong>${escapeHtml(getPromotionDateRangeLabel(promotion))}</span>
        </div>

        <div class="admin-promotion-card-footer">
          <small>${escapeHtml(
            previewNames || "Sem itens vinculados visiveis no recorte atual."
          )}</small>
          <strong>${escapeHtml(
            `${promotion.appliedItemsCount || 0}/${promotion.affectedItemsCount || 0} item(ns) afetado(s)`
          )}</strong>
        </div>
      </button>

      <div class="admin-promotion-card-actions">
        <button
          class="admin-button admin-button-secondary"
          type="button"
          data-promotion-select="${escapeHtml(promotion.id)}"
          ${adminState.promotionSaving ? "disabled" : ""}
        >
          Editar
        </button>
        <button
          class="admin-button admin-button-secondary"
          type="button"
          data-promotion-toggle="${escapeHtml(promotion.id)}"
          data-promotion-enabled="${promotion.isEnabled ? "false" : "true"}"
          ${adminState.promotionSaving || adminState.promotionBusyId === promotion.id ? "disabled" : ""}
        >
          ${promotion.isEnabled ? "Desativar" : "Ativar"}
        </button>
        <button
          class="admin-button admin-button-secondary"
          type="button"
          data-promotion-delete="${escapeHtml(promotion.id)}"
          ${adminState.promotionSaving || adminState.promotionBusyId === promotion.id ? "disabled" : ""}
        >
          Remover
        </button>
      </div>
    </article>
  `;
};

const renderPromotionsModule = () => {
  const moduleRoot = document.querySelector("[data-admin-module-content]");
  const snapshot = getPromotionsSnapshot();
  const visiblePromotions = getVisiblePromotions();
  const selectedPromotion = getSelectedPromotion();
  const promotionDraft = selectedPromotion || createPromotionDraft();

  if (!moduleRoot) {
    return;
  }

  if (adminState.isLoadingPromotions && !snapshot.promotions.length) {
    moduleRoot.innerHTML = `
      <div class="admin-empty-state admin-empty-state-loading">
        <strong>Carregando promocoes</strong>
        <span>O gestor esta preparando campanhas, vigencia e reflexo operacional no site.</span>
      </div>
    `;
    return;
  }

  moduleRoot.innerHTML = `
    <header class="admin-module-head">
      <div>
        <span class="admin-chip">Promocoes</span>
        <h2>Campanhas com validade e preco aplicado no pedido</h2>
        <p>Crie promocoes por item ou categoria com ativacao automatica, expiração por periodo e valor valido no fechamento.</p>
      </div>
      <div class="admin-module-head-meta">
        <span>Promocoes ativas</span>
        <strong>${escapeHtml(String(snapshot.summary?.activePromotions || 0))}</strong>
      </div>
    </header>

    <section class="admin-module-kpis">
      <article class="admin-mini-stat is-green">
        <span>Ativas</span>
        <strong>${escapeHtml(String(snapshot.summary?.activePromotions || 0))}</strong>
      </article>
      <article class="admin-mini-stat is-blue">
        <span>Agendadas</span>
        <strong>${escapeHtml(String(snapshot.summary?.scheduledPromotions || 0))}</strong>
      </article>
      <article class="admin-mini-stat is-danger">
        <span>Encerradas</span>
        <strong>${escapeHtml(String(snapshot.summary?.endedPromotions || 0))}</strong>
      </article>
      <article class="admin-mini-stat is-cyan">
        <span>Itens afetados</span>
        <strong>${escapeHtml(String(snapshot.summary?.affectedItems || 0))}</strong>
      </article>
    </section>

    <section class="admin-module-card admin-promotion-toolbar">
      <label class="admin-field">
        <span>Status</span>
        <select class="admin-input" data-promotion-filter="status">
          <option value="">Todas</option>
          <option value="active" ${adminState.promotionsFilters.status === "active" ? "selected" : ""}>Ativas</option>
          <option value="scheduled" ${adminState.promotionsFilters.status === "scheduled" ? "selected" : ""}>Agendadas</option>
          <option value="ended" ${adminState.promotionsFilters.status === "ended" ? "selected" : ""}>Encerradas</option>
        </select>
      </label>

      <div class="admin-promotion-toolbar-actions">
        <button
          class="admin-button admin-button-primary"
          type="button"
          data-promotion-new
          ${adminState.promotionSaving ? "disabled" : ""}
        >
          Nova promocao
        </button>
      </div>
    </section>

    <section class="admin-promotion-layout">
      <article class="admin-module-card">
        <div class="admin-module-card-head">
          <div>
            <h3>Promocoes cadastradas</h3>
            <p>Veja validade, escopo, itens afetados e estado operacional de cada campanha.</p>
          </div>
          <span>${escapeHtml(`${visiblePromotions.length} registro(s)`)}</span>
        </div>

        <div class="admin-promotion-list">
          ${
            visiblePromotions.length > 0
              ? visiblePromotions.map(renderPromotionCard).join("")
              : `
                <div class="admin-empty-state admin-empty-state-inline">
                  <strong>Nenhuma promocao encontrada</strong>
                  <span>Ajuste a busca, altere o filtro ou cadastre uma nova campanha.</span>
                </div>
              `
          }
        </div>
      </article>

      <article class="admin-module-card">
        <div class="admin-module-card-head">
          <div>
            <h3>${escapeHtml(selectedPromotion ? "Editar promocao" : "Nova promocao")}</h3>
            <p>Defina validade, escopo e valor promocional sem quebrar o preco operacional do cardapio.</p>
          </div>
          <span>${escapeHtml(selectedPromotion ? selectedPromotion.statusLabel : "Rascunho")}</span>
        </div>

        <form class="admin-form admin-promotion-form" data-promotion-form>
          <input type="hidden" name="id" value="${escapeHtml(promotionDraft.id || "")}" />

          <label class="admin-field admin-field-wide">
            <span>Nome interno</span>
            <input
              class="admin-input"
              type="text"
              name="internalName"
              value="${escapeHtml(promotionDraft.internalName || "")}"
              placeholder="Ex.: Combo executivo almoco"
              ${adminState.promotionSaving ? "disabled" : ""}
            />
          </label>

          <label class="admin-field">
            <span>Vincular em</span>
            <select class="admin-input" name="scopeType" data-promotion-form-toggle ${adminState.promotionSaving ? "disabled" : ""}>
              <option value="item" ${promotionDraft.scopeType === "item" ? "selected" : ""}>Item</option>
              <option value="category" ${promotionDraft.scopeType === "category" ? "selected" : ""}>Categoria</option>
            </select>
          </label>

          <label class="admin-field">
            <span>Tipo da promocao</span>
            <select class="admin-input" name="pricingType" data-promotion-form-toggle ${adminState.promotionSaving ? "disabled" : ""}>
              <option value="fixed_price" ${promotionDraft.pricingType === "fixed_price" ? "selected" : ""}>Preco fixo</option>
              <option value="percent_discount" ${promotionDraft.pricingType === "percent_discount" ? "selected" : ""}>Desconto percentual</option>
            </select>
          </label>

          <label class="admin-field admin-field-wide" data-promotion-target-group="item">
            <span>Item vinculado</span>
            <select class="admin-input" name="itemId" ${adminState.promotionSaving ? "disabled" : ""}>
              <option value="">Selecione um item</option>
              ${(snapshot.catalogOptions?.items || [])
                .map(
                  (item) => `
                    <option value="${escapeHtml(item.id)}" ${
                      promotionDraft.scopeType === "item" && promotionDraft.targetValue === item.id ? "selected" : ""
                    }>
                      ${escapeHtml(`${item.name} | ${item.category || item.sectionTitle || item.id}`)}
                    </option>
                  `
                )
                .join("")}
            </select>
          </label>

          <label class="admin-field admin-field-wide" data-promotion-target-group="category">
            <span>Categoria vinculada</span>
            <select class="admin-input" name="category" ${adminState.promotionSaving ? "disabled" : ""}>
              <option value="">Selecione uma categoria</option>
              ${(snapshot.catalogOptions?.categories || [])
                .map(
                  (category) => `
                    <option value="${escapeHtml(category.value)}" ${
                      promotionDraft.scopeType === "category" && promotionDraft.targetValue === category.value ? "selected" : ""
                    }>
                      ${escapeHtml(`${category.label} | ${category.itemsCount} item(ns)`)}
                    </option>
                  `
                )
                .join("")}
            </select>
          </label>

          <label class="admin-field" data-promotion-pricing-group="fixed_price">
            <span>Preco promocional</span>
            <input
              class="admin-input"
              type="text"
              name="fixedPrice"
              inputmode="decimal"
              value="${escapeHtml(
                typeof promotionDraft.fixedPrice === "number" ? String(promotionDraft.fixedPrice.toFixed(2)) : ""
              )}"
              placeholder="Ex.: 29.90"
              ${adminState.promotionSaving ? "disabled" : ""}
            />
          </label>

          <label class="admin-field" data-promotion-pricing-group="percent_discount">
            <span>Desconto percentual</span>
            <input
              class="admin-input"
              type="text"
              name="discountPercent"
              inputmode="decimal"
              value="${escapeHtml(
                typeof promotionDraft.discountPercent === "number"
                  ? String(promotionDraft.discountPercent.toFixed(2))
                  : ""
              )}"
              placeholder="Ex.: 15"
              ${adminState.promotionSaving ? "disabled" : ""}
            />
          </label>

          <label class="admin-field">
            <span>Inicio</span>
            <input
              class="admin-input"
              type="datetime-local"
              name="startsAt"
              value="${escapeHtml(getDateTimeInputValue(promotionDraft.startsAt))}"
              ${adminState.promotionSaving ? "disabled" : ""}
            />
          </label>

          <label class="admin-field">
            <span>Termino</span>
            <input
              class="admin-input"
              type="datetime-local"
              name="endsAt"
              value="${escapeHtml(getDateTimeInputValue(promotionDraft.endsAt))}"
              ${adminState.promotionSaving ? "disabled" : ""}
            />
          </label>

          <label class="admin-menu-checkbox admin-field-wide">
            <input type="checkbox" name="isEnabled" ${promotionDraft.isEnabled !== false ? "checked" : ""} ${adminState.promotionSaving ? "disabled" : ""} />
            <span>Promocao habilitada para ativar automaticamente no periodo valido</span>
          </label>

          <div class="admin-menu-item-actions admin-field-wide">
            <button class="admin-button admin-button-primary" type="submit" ${adminState.promotionSaving ? "disabled" : ""}>
              ${adminState.promotionSaving ? "Salvando..." : selectedPromotion ? "Salvar promocao" : "Criar promocao"}
            </button>
            <button class="admin-button admin-button-secondary" type="button" data-promotion-new ${adminState.promotionSaving ? "disabled" : ""}>
              Limpar formulario
            </button>
          </div>
        </form>
      </article>
    </section>
  `;

  syncPromotionFormVisibility(moduleRoot.querySelector("[data-promotion-form]"));
};

const renderReviewCard = (review) => {
  const isSelected = adminState.selectedReviewId === review.id;
  const isManuallyHidden = review.visibilityState === "hidden";
  const contactLabel =
    review.customerContact || review.customerPhone || review.customerEmail || "Contato opcional";

  return `
    <article class="admin-review-card${isSelected ? " is-selected" : ""}">
      <button
        class="admin-review-card-select"
        type="button"
        data-review-select="${escapeHtml(review.id)}"
      >
        <div class="admin-review-card-top">
          <div>
            <strong>${escapeHtml(review.customerName || "Cliente sem nome")}</strong>
            <small>${escapeHtml(formatDateTime(review.createdAt))}</small>
          </div>
          <span class="${getReviewStatusClassName(review.status)}">${escapeHtml(
            review.statusLabel || "Avaliacao"
          )}</span>
        </div>

        <div class="admin-review-card-meta">
          <span class="admin-review-stars">${escapeHtml(buildReviewStars(review.rating))}</span>
          <span>${escapeHtml(`${review.rating || 0}/5`)}</span>
          <span>${escapeHtml(review.publicationLabel || "Janela automatica")}</span>
        </div>

        <p class="admin-review-card-message">${escapeHtml(review.message || "Sem comentario.")}</p>

        <div class="admin-review-card-footer">
          <small>${escapeHtml(contactLabel)}</small>
          <strong>${escapeHtml(review.remainingLabel || "Sem janela ativa")}</strong>
        </div>
      </button>

      <div class="admin-review-card-actions">
        <button
          class="admin-button admin-button-secondary"
          type="button"
          data-review-select="${escapeHtml(review.id)}"
          ${adminState.reviewBusyId === review.id ? "disabled" : ""}
        >
          Detalhes
        </button>
        <button
          class="admin-button admin-button-secondary"
          type="button"
          data-review-visibility="${escapeHtml(review.id)}"
          data-review-next-visibility="${isManuallyHidden ? "automatic" : "hidden"}"
          ${adminState.reviewBusyId === review.id ? "disabled" : ""}
        >
          ${isManuallyHidden ? "Restaurar" : "Ocultar"}
        </button>
        <button
          class="admin-button admin-button-secondary"
          type="button"
          data-review-delete="${escapeHtml(review.id)}"
          ${adminState.reviewBusyId === review.id ? "disabled" : ""}
        >
          Remover
        </button>
      </div>
    </article>
  `;
};

const renderReviewsModule = () => {
  const moduleRoot = document.querySelector("[data-admin-module-content]");
  const snapshot = getReviewsSnapshot();
  const visibleReviews = getVisibleReviews();

  if (!moduleRoot) {
    return;
  }

  if (adminState.isLoadingReviews && !snapshot.reviews.length) {
    moduleRoot.innerHTML = `
      <div class="admin-empty-state admin-empty-state-loading">
        <strong>Carregando avaliacoes</strong>
        <span>O gestor esta buscando feedbacks reais, janela de publicacao e leitura recente do site.</span>
      </div>
    `;
    return;
  }

  moduleRoot.innerHTML = `
    <header class="admin-module-head">
      <div>
        <span class="admin-chip">Avaliacoes</span>
        <h2>Feedback real com publicacao automatica no site</h2>
        <p>Consulte as notas recebidas, a janela de exibicao por estrelas e o que esta visivel agora para o cliente.</p>
      </div>
      <div class="admin-module-head-meta">
        <span>Media visual</span>
        <strong>${escapeHtml(String(Number(snapshot.summary?.displayAverage || 0).toFixed(1)))}</strong>
      </div>
    </header>

    <section class="admin-module-kpis admin-module-kpis-wide">
      <article class="admin-mini-stat is-green">
        <span>Publicadas</span>
        <strong>${escapeHtml(String(snapshot.summary?.publishedReviews || 0))}</strong>
      </article>
      <article class="admin-mini-stat is-warm">
        <span>Ocultas</span>
        <strong>${escapeHtml(String(snapshot.summary?.hiddenReviews || 0))}</strong>
      </article>
      <article class="admin-mini-stat is-blue">
        <span>Recentes 60d</span>
        <strong>${escapeHtml(String(snapshot.summary?.recentReviews || 0))}</strong>
      </article>
      <article class="admin-mini-stat is-cyan">
        <span>Media interna</span>
        <strong>${escapeHtml(String(Number(snapshot.summary?.internalAverage || 0).toFixed(1)))}</strong>
      </article>
      <article class="admin-mini-stat is-danger">
        <span>Encerradas</span>
        <strong>${escapeHtml(String(snapshot.summary?.expiredReviews || 0))}</strong>
      </article>
    </section>

    <section class="admin-module-card admin-review-toolbar">
      <label class="admin-field">
        <span>Status</span>
        <select class="admin-input" data-review-filter="status">
          <option value="">Todas</option>
          <option value="published" ${adminState.reviewsFilters.status === "published" ? "selected" : ""}>Publicadas</option>
          <option value="hidden" ${adminState.reviewsFilters.status === "hidden" ? "selected" : ""}>Ocultas</option>
          <option value="expired" ${adminState.reviewsFilters.status === "expired" ? "selected" : ""}>Encerradas</option>
          <option value="recent" ${adminState.reviewsFilters.status === "recent" ? "selected" : ""}>Recentes 60d</option>
        </select>
      </label>

      <label class="admin-field">
        <span>Nota</span>
        <select class="admin-input" data-review-filter="rating">
          <option value="">Todas</option>
          ${[5, 4, 3, 2, 1]
            .map(
              (rating) => `
                <option value="${escapeHtml(String(rating))}" ${
                  adminState.reviewsFilters.rating === String(rating) ? "selected" : ""
                }>
                  ${escapeHtml(`${rating} estrela${rating === 1 ? "" : "s"}`)}
                </option>
              `
            )
            .join("")}
        </select>
      </label>
    </section>

    <section class="admin-review-layout">
      <article class="admin-module-card">
        <div class="admin-module-card-head">
          <div>
            <h3>Avaliacoes registradas</h3>
            <p>O site publica automaticamente conforme a nota e o admin pode ocultar ou remover quando necessario.</p>
          </div>
          <span>${escapeHtml(`${visibleReviews.length} registro(s)`)}</span>
        </div>

        <div class="admin-review-list">
          ${
            visibleReviews.length > 0
              ? visibleReviews.map(renderReviewCard).join("")
              : `
                <div class="admin-empty-state admin-empty-state-inline">
                  <strong>Nenhuma avaliacao encontrada</strong>
                  <span>Ajuste a busca global ou altere os filtros para ampliar a consulta.</span>
                </div>
              `
          }
        </div>
      </article>
    </section>
  `;
};

const cloneDeliverySettingsDraft = (settings = DELIVERY_SETTINGS_DEFAULT_DRAFT) =>
  JSON.parse(JSON.stringify(settings || DELIVERY_SETTINGS_DEFAULT_DRAFT));

const getDeliverySettingsDraft = () => {
  if (!adminState.deliverySettingsDraft) {
    adminState.deliverySettingsDraft = cloneDeliverySettingsDraft();
  }

  return adminState.deliverySettingsDraft;
};

const getDeliverySettingsSnapshot = () =>
  adminState.deliverySettingsSnapshot || {
    summary: {
      totalBands: DELIVERY_SETTINGS_DEFAULT_DRAFT.distanceBands.length,
      activeBands: DELIVERY_SETTINGS_DEFAULT_DRAFT.distanceBands.length,
      inactiveBands: 0,
      activeCouriers: 0,
      totalCouriers: 0,
      deliveriesEnabled: true,
      pickupEnabled: true,
      freeShippingEnabled: false,
      maxRadiusKm: 14.9,
    },
    settings: cloneDeliverySettingsDraft(),
  };

const normalizeAdminNumber = (value, fallback = 0) => {
  const normalizedValue = normalizeDecimalInput(value);
  const numericValue = Number(normalizedValue);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const formatAdminNumberValue = (value) => {
  if (value === null || typeof value === "undefined" || value === "") {
    return "";
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? String(numericValue) : "";
};

const createDeliveryDraftId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const formatDeliveryBandLabel = (band) => {
  const minKm = Number(band?.minKm || 0);
  const maxKm =
    band?.maxKm === null || typeof band?.maxKm === "undefined" || band?.maxKm === ""
      ? null
      : Number(band.maxKm);

  if (maxKm === null || !Number.isFinite(maxKm)) {
    return `Acima de ${String(minKm).replace(".", ",")} km`;
  }

  if (minKm <= 0) {
    return `Ate ${String(maxKm).replace(".", ",")} km`;
  }

  return `${String(minKm).replace(".", ",")} a ${String(maxKm).replace(".", ",")} km`;
};

const splitDeliveryAdminList = (value) =>
  String(value || "")
    .split(/\r?\n|;/g)
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);

const joinDeliveryAdminList = (entries = []) =>
  (Array.isArray(entries) ? entries : []).map((entry) => String(entry || "").trim()).filter(Boolean).join("\n");

const getDeliveryField = (root, fieldName) =>
  root?.querySelector(`[data-delivery-field="${fieldName}"]`) || null;

const readDeliverySettingsDraftFromDom = () => {
  const root = document.querySelector("[data-delivery-settings-root]");
  const currentDraft = cloneDeliverySettingsDraft(getDeliverySettingsDraft());

  if (!root) {
    return currentDraft;
  }

  const distanceBands = Array.from(root.querySelectorAll("[data-delivery-band-row]")).map(
    (row, index) => {
      const getBandField = (fieldName) =>
        row.querySelector(`[data-delivery-band-field="${fieldName}"]`);
      const minKm = Math.max(0, normalizeAdminNumber(getBandField("minKm")?.value, 0));
      const maxValue = String(getBandField("maxKm")?.value || "").trim();
      const maxKm = maxValue ? Math.max(minKm, normalizeAdminNumber(maxValue, minKm)) : null;

      return {
        id: String(row.dataset.deliveryBandId || "").trim() || createDeliveryDraftId("band"),
        minKm,
        maxKm,
        customerFee: Math.max(0, normalizeAdminNumber(getBandField("customerFee")?.value, 0)),
        courierFee: Math.max(0, normalizeAdminNumber(getBandField("courierFee")?.value, 0)),
        minimumOrder: Math.max(0, normalizeAdminNumber(getBandField("minimumOrder")?.value, 0)),
        isActive: Boolean(getBandField("isActive")?.checked),
      };
    }
  );
  const freeShippingBandIds = Array.from(root.querySelectorAll("[data-delivery-free-band]"))
    .filter((field) => field.checked)
    .map((field) => String(field.value || "").trim())
    .filter(Boolean);
  const couriers = Array.from(root.querySelectorAll("[data-delivery-courier-row]"))
    .map((row) => {
      const getCourierField = (fieldName) =>
        row.querySelector(`[data-delivery-courier-field="${fieldName}"]`);

      return {
        id: String(row.dataset.deliveryCourierId || "").trim() || createDeliveryDraftId("courier"),
        name: String(getCourierField("name")?.value || "").trim(),
        phone: String(getCourierField("phone")?.value || "").trim(),
        defaultFee: Math.max(0, normalizeAdminNumber(getCourierField("defaultFee")?.value, 0)),
        isActive: Boolean(getCourierField("isActive")?.checked),
      };
    })
    .filter((courier) => courier.name || courier.phone);

  return {
    ...currentDraft,
    distanceBands,
    deliveryTime: {
      minMinutes: Math.max(0, Math.round(normalizeAdminNumber(getDeliveryField(root, "deliveryTime.minMinutes")?.value, 0))),
      maxMinutes: Math.max(0, Math.round(normalizeAdminNumber(getDeliveryField(root, "deliveryTime.maxMinutes")?.value, 0))),
      message: String(getDeliveryField(root, "deliveryTime.message")?.value || "").trim(),
    },
    serviceArea: {
      maxRadiusKm: Math.max(0, normalizeAdminNumber(getDeliveryField(root, "serviceArea.maxRadiusKm")?.value, 0)),
      servedNeighborhoods: splitDeliveryAdminList(getDeliveryField(root, "serviceArea.servedNeighborhoods")?.value),
      blockedNeighborhoods: splitDeliveryAdminList(getDeliveryField(root, "serviceArea.blockedNeighborhoods")?.value),
      outOfAreaMessage: String(getDeliveryField(root, "serviceArea.outOfAreaMessage")?.value || "").trim(),
    },
    freeShipping: {
      enabled: Boolean(getDeliveryField(root, "freeShipping.enabled")?.checked),
      minimumOrder: Math.max(0, normalizeAdminNumber(getDeliveryField(root, "freeShipping.minimumOrder")?.value, 0)),
      appliesToAllBands: String(getDeliveryField(root, "freeShipping.appliesToAllBands")?.value || "true") === "true",
      bandIds: freeShippingBandIds,
    },
    pickup: {
      enabled: Boolean(getDeliveryField(root, "pickup.enabled")?.checked),
      estimateMinutes: Math.max(0, Math.round(normalizeAdminNumber(getDeliveryField(root, "pickup.estimateMinutes")?.value, 0))),
      message: String(getDeliveryField(root, "pickup.message")?.value || "").trim(),
    },
    status: {
      deliveriesEnabled: Boolean(getDeliveryField(root, "status.deliveriesEnabled")?.checked),
      pausedMessage: String(getDeliveryField(root, "status.pausedMessage")?.value || "").trim(),
    },
    couriers,
    courierPayout: {
      mode: String(getDeliveryField(root, "courierPayout.mode")?.value || "fixed_by_band").trim(),
      percentage: Math.max(0, normalizeAdminNumber(getDeliveryField(root, "courierPayout.percentage")?.value, 0)),
      manualAmount: Math.max(0, normalizeAdminNumber(getDeliveryField(root, "courierPayout.manualAmount")?.value, 0)),
    },
  };
};

const syncDeliverySettingsDraftFromDom = () => {
  adminState.deliverySettingsDraft = readDeliverySettingsDraftFromDom();
  return adminState.deliverySettingsDraft;
};

const renderDeliveryField = ({
  label,
  field,
  value,
  type = "text",
  step = "",
  placeholder = "",
  disabled = false,
}) => `
  <label class="admin-delivery-field">
    <span>${escapeHtml(label)}</span>
    <input
      class="admin-input"
      type="${escapeHtml(type)}"
      ${step ? `step="${escapeHtml(step)}"` : ""}
      data-delivery-field="${escapeHtml(field)}"
      value="${escapeHtml(value)}"
      placeholder="${escapeHtml(placeholder)}"
      ${disabled ? "disabled" : ""}
    />
  </label>
`;

const renderDeliveryTextarea = ({ label, field, value, placeholder = "", disabled = false }) => `
  <label class="admin-delivery-field is-wide">
    <span>${escapeHtml(label)}</span>
    <textarea
      class="admin-input admin-textarea"
      data-delivery-field="${escapeHtml(field)}"
      placeholder="${escapeHtml(placeholder)}"
      ${disabled ? "disabled" : ""}
    >${escapeHtml(value)}</textarea>
  </label>
`;

const renderDeliveryToggle = ({ label, field, checked, disabled = false }) => `
  <label class="admin-delivery-toggle">
    <input
      type="checkbox"
      data-delivery-field="${escapeHtml(field)}"
      ${checked ? "checked" : ""}
      ${disabled ? "disabled" : ""}
    />
    <span>${escapeHtml(label)}</span>
  </label>
`;

const renderDeliveryBandRow = (band, index, { isBusy = false } = {}) => `
  <article class="admin-delivery-band-row" data-delivery-band-row data-delivery-band-id="${escapeHtml(band.id)}">
    <div class="admin-delivery-row-title">
      <strong>Faixa ${escapeHtml(String(index + 1))}</strong>
      <span>${escapeHtml(formatDeliveryBandLabel(band))}</span>
    </div>
    <label class="admin-delivery-field">
      <span>Km inicial</span>
      <input class="admin-input" type="number" step="0.1" data-delivery-band-field="minKm" value="${escapeHtml(formatAdminNumberValue(band.minKm))}" ${isBusy ? "disabled" : ""} />
    </label>
    <label class="admin-delivery-field">
      <span>Km final</span>
      <input class="admin-input" type="number" step="0.1" data-delivery-band-field="maxKm" value="${escapeHtml(formatAdminNumberValue(band.maxKm))}" placeholder="Sem limite" ${isBusy ? "disabled" : ""} />
    </label>
    <label class="admin-delivery-field">
      <span>Valor cliente</span>
      <input class="admin-input" type="number" step="0.01" data-delivery-band-field="customerFee" value="${escapeHtml(formatAdminNumberValue(band.customerFee))}" ${isBusy ? "disabled" : ""} />
    </label>
    <label class="admin-delivery-field">
      <span>Repasse entregador</span>
      <input class="admin-input" type="number" step="0.01" data-delivery-band-field="courierFee" value="${escapeHtml(formatAdminNumberValue(band.courierFee))}" ${isBusy ? "disabled" : ""} />
    </label>
    <label class="admin-delivery-field">
      <span>Pedido minimo</span>
      <input class="admin-input" type="number" step="0.01" data-delivery-band-field="minimumOrder" value="${escapeHtml(formatAdminNumberValue(band.minimumOrder))}" ${isBusy ? "disabled" : ""} />
    </label>
    <label class="admin-delivery-toggle">
      <input type="checkbox" data-delivery-band-field="isActive" ${band.isActive !== false ? "checked" : ""} ${isBusy ? "disabled" : ""} />
      <span>Ativa</span>
    </label>
    <button class="admin-button admin-button-secondary" type="button" data-delivery-settings-action="remove-band" data-delivery-band-id="${escapeHtml(band.id)}" ${isBusy ? "disabled" : ""}>
      Remover
    </button>
  </article>
`;

const renderDeliveryCourierRow = (courier, index, { isBusy = false } = {}) => `
  <article class="admin-delivery-courier-row" data-delivery-courier-row data-delivery-courier-id="${escapeHtml(courier.id)}">
    <div class="admin-delivery-row-title">
      <strong>Entregador ${escapeHtml(String(index + 1))}</strong>
      <span>${escapeHtml(courier.isActive === false ? "Inativo" : "Ativo")}</span>
    </div>
    <label class="admin-delivery-field">
      <span>Nome</span>
      <input class="admin-input" type="text" data-delivery-courier-field="name" value="${escapeHtml(courier.name || "")}" ${isBusy ? "disabled" : ""} />
    </label>
    <label class="admin-delivery-field">
      <span>Telefone</span>
      <input class="admin-input" type="text" data-delivery-courier-field="phone" value="${escapeHtml(courier.phone || "")}" ${isBusy ? "disabled" : ""} />
    </label>
    <label class="admin-delivery-field">
      <span>Taxa padrao</span>
      <input class="admin-input" type="number" step="0.01" data-delivery-courier-field="defaultFee" value="${escapeHtml(formatAdminNumberValue(courier.defaultFee))}" ${isBusy ? "disabled" : ""} />
    </label>
    <label class="admin-delivery-toggle">
      <input type="checkbox" data-delivery-courier-field="isActive" ${courier.isActive !== false ? "checked" : ""} ${isBusy ? "disabled" : ""} />
      <span>Ativo</span>
    </label>
    <button class="admin-button admin-button-secondary" type="button" data-delivery-settings-action="remove-courier" data-delivery-courier-id="${escapeHtml(courier.id)}" ${isBusy ? "disabled" : ""}>
      Remover
    </button>
  </article>
`;

const renderDeliveriesModule = () => {
  const moduleRoot = document.querySelector("[data-admin-module-content]");

  if (!moduleRoot) {
    return;
  }

  const snapshot = getDeliverySettingsSnapshot();
  const summary = snapshot.summary || {};
  const draft = getDeliverySettingsDraft();
  const isBusy = adminState.isLoadingDeliverySettings || adminState.deliverySettingsSaving;
  const bandIdsWithFreeShipping = new Set(draft.freeShipping?.bandIds || []);
  const updatedLabel = draft.updatedAt ? formatDateTime(draft.updatedAt) : "Ainda nao salvo";

  moduleRoot.innerHTML = `
    <header class="admin-module-head">
      <div>
        <span class="admin-chip">Central de entregas</span>
        <h2>Configuracao operacional de entregas</h2>
        <p>Controle de taxas, prazos, area atendida, retirada, pausa temporaria e entregadores usados pelo checkout.</p>
      </div>
      <div class="admin-module-head-meta">
        <span>Ultima atualizacao</span>
        <strong>${escapeHtml(adminState.isLoadingDeliverySettings ? "Carregando..." : updatedLabel)}</strong>
      </div>
    </header>

    <section class="admin-module-kpis">
      <article class="admin-mini-stat is-blue">
        <span>Faixas ativas</span>
        <strong>${escapeHtml(String(summary.activeBands ?? draft.distanceBands.length))}</strong>
      </article>
      <article class="admin-mini-stat is-cyan">
        <span>Raio maximo</span>
        <strong>${escapeHtml(String(draft.serviceArea?.maxRadiusKm || 0).replace(".", ","))} km</strong>
      </article>
      <article class="admin-mini-stat is-gold">
        <span>Frete gratis</span>
        <strong>${escapeHtml(draft.freeShipping?.enabled ? "Ativo" : "Inativo")}</strong>
      </article>
      <article class="admin-mini-stat is-warm">
        <span>Entregadores</span>
        <strong>${escapeHtml(String(summary.activeCouriers ?? 0))}</strong>
      </article>
    </section>

    <section class="admin-delivery-settings" data-delivery-settings-root>
      ${
        adminState.actionMessage
          ? `<div class="admin-feedback is-${escapeHtml(adminState.actionTone || "success")}">${escapeHtml(adminState.actionMessage)}</div>`
          : ""
      }

      <div class="admin-delivery-savebar">
        <div>
          <strong>Regras publicadas no checkout/site</strong>
          <span>${escapeHtml(draft.status?.deliveriesEnabled === false ? "Entrega pausada" : "Entrega ativa")} | ${escapeHtml(draft.pickup?.enabled === false ? "Retirada desativada" : "Retirada ativa")}</span>
        </div>
        <div class="admin-delivery-savebar-actions">
          <button class="admin-button admin-button-secondary" type="button" data-delivery-settings-action="reset" ${isBusy ? "disabled" : ""}>Descartar alteracoes</button>
          <button class="admin-button admin-button-primary" type="button" data-delivery-settings-action="save" ${isBusy ? "disabled" : ""}>
            ${adminState.deliverySettingsSaving ? "Salvando..." : "Salvar entregas"}
          </button>
        </div>
      </div>

      <article class="admin-delivery-card is-wide">
        <header class="admin-delivery-card-head">
          <div>
            <span class="admin-chip">Taxas por distancia</span>
            <h3>Faixas de entrega</h3>
            <p>O checkout usa a primeira faixa ativa compativel com a distancia calculada do cliente.</p>
          </div>
          <button class="admin-button admin-button-secondary" type="button" data-delivery-settings-action="add-band" ${isBusy ? "disabled" : ""}>Adicionar faixa</button>
        </header>
        <div class="admin-delivery-band-list">
          ${
            draft.distanceBands.length
              ? draft.distanceBands.map((band, index) => renderDeliveryBandRow(band, index, { isBusy })).join("")
              : '<div class="admin-empty-inline"><span>Nenhuma faixa configurada.</span></div>'
          }
        </div>
      </article>

      <article class="admin-delivery-card">
        <header class="admin-delivery-card-head">
          <div>
            <span class="admin-chip">Tempo de entrega</span>
            <h3>Prazo exibido ao cliente</h3>
          </div>
        </header>
        <div class="admin-delivery-form-grid">
          ${renderDeliveryField({ label: "Tempo minimo", field: "deliveryTime.minMinutes", value: formatAdminNumberValue(draft.deliveryTime?.minMinutes), type: "number", step: "1", disabled: isBusy })}
          ${renderDeliveryField({ label: "Tempo maximo", field: "deliveryTime.maxMinutes", value: formatAdminNumberValue(draft.deliveryTime?.maxMinutes), type: "number", step: "1", disabled: isBusy })}
          ${renderDeliveryTextarea({ label: "Mensagem exibida", field: "deliveryTime.message", value: draft.deliveryTime?.message || "", placeholder: "Entrega estimada entre 40 e 60 minutos", disabled: isBusy })}
        </div>
      </article>

      <article class="admin-delivery-card">
        <header class="admin-delivery-card-head">
          <div>
            <span class="admin-chip">Area de entrega</span>
            <h3>Raio e bairros</h3>
          </div>
        </header>
        <div class="admin-delivery-form-grid">
          ${renderDeliveryField({ label: "Raio maximo (km)", field: "serviceArea.maxRadiusKm", value: formatAdminNumberValue(draft.serviceArea?.maxRadiusKm), type: "number", step: "0.1", disabled: isBusy })}
          ${renderDeliveryTextarea({ label: "Bairros atendidos", field: "serviceArea.servedNeighborhoods", value: joinDeliveryAdminList(draft.serviceArea?.servedNeighborhoods), placeholder: "Um bairro por linha. Vazio libera pelo raio.", disabled: isBusy })}
          ${renderDeliveryTextarea({ label: "Bairros bloqueados", field: "serviceArea.blockedNeighborhoods", value: joinDeliveryAdminList(draft.serviceArea?.blockedNeighborhoods), placeholder: "Um bairro por linha.", disabled: isBusy })}
          ${renderDeliveryTextarea({ label: "Mensagem fora da area", field: "serviceArea.outOfAreaMessage", value: draft.serviceArea?.outOfAreaMessage || "", placeholder: "No momento nao entregamos nessa regiao.", disabled: isBusy })}
        </div>
      </article>

      <article class="admin-delivery-card">
        <header class="admin-delivery-card-head">
          <div>
            <span class="admin-chip">Frete gratis</span>
            <h3>Regra promocional de entrega</h3>
          </div>
        </header>
        <div class="admin-delivery-form-grid">
          ${renderDeliveryToggle({ label: "Frete gratis ativo", field: "freeShipping.enabled", checked: draft.freeShipping?.enabled === true, disabled: isBusy })}
          ${renderDeliveryField({ label: "Valor minimo do pedido", field: "freeShipping.minimumOrder", value: formatAdminNumberValue(draft.freeShipping?.minimumOrder), type: "number", step: "0.01", disabled: isBusy })}
          <label class="admin-delivery-field">
            <span>Aplicacao</span>
            <select class="admin-input" data-delivery-field="freeShipping.appliesToAllBands" ${isBusy ? "disabled" : ""}>
              <option value="true" ${draft.freeShipping?.appliesToAllBands !== false ? "selected" : ""}>Todas as faixas</option>
              <option value="false" ${draft.freeShipping?.appliesToAllBands === false ? "selected" : ""}>Apenas faixas escolhidas</option>
            </select>
          </label>
          <div class="admin-delivery-checkbox-stack is-wide">
            ${draft.distanceBands
              .map(
                (band) => `
                  <label class="admin-delivery-toggle">
                    <input type="checkbox" data-delivery-free-band value="${escapeHtml(band.id)}" ${bandIdsWithFreeShipping.has(band.id) ? "checked" : ""} ${isBusy ? "disabled" : ""} />
                    <span>${escapeHtml(formatDeliveryBandLabel(band))}</span>
                  </label>
                `
              )
              .join("")}
          </div>
        </div>
      </article>

      <article class="admin-delivery-card">
        <header class="admin-delivery-card-head">
          <div>
            <span class="admin-chip">Retirada</span>
            <h3>Balcao</h3>
          </div>
        </header>
        <div class="admin-delivery-form-grid">
          ${renderDeliveryToggle({ label: "Retirada habilitada", field: "pickup.enabled", checked: draft.pickup?.enabled !== false, disabled: isBusy })}
          ${renderDeliveryField({ label: "Tempo estimado", field: "pickup.estimateMinutes", value: formatAdminNumberValue(draft.pickup?.estimateMinutes), type: "number", step: "1", disabled: isBusy })}
          ${renderDeliveryTextarea({ label: "Mensagem exibida", field: "pickup.message", value: draft.pickup?.message || "", placeholder: "Retirada disponivel em 25 minutos", disabled: isBusy })}
        </div>
      </article>

      <article class="admin-delivery-card">
        <header class="admin-delivery-card-head">
          <div>
            <span class="admin-chip">Status da entrega</span>
            <h3>Pausa temporaria</h3>
          </div>
        </header>
        <div class="admin-delivery-form-grid">
          ${renderDeliveryToggle({ label: "Entregas habilitadas", field: "status.deliveriesEnabled", checked: draft.status?.deliveriesEnabled !== false, disabled: isBusy })}
          ${renderDeliveryTextarea({ label: "Mensagem quando pausado", field: "status.pausedMessage", value: draft.status?.pausedMessage || "", placeholder: "Entregas pausadas temporariamente. Retirada no balcao disponivel.", disabled: isBusy })}
        </div>
      </article>

      <article class="admin-delivery-card is-wide">
        <header class="admin-delivery-card-head">
          <div>
            <span class="admin-chip">Entregadores</span>
            <h3>Cadastro basico</h3>
            <p>Cadastro preparado para uso operacional e financeiro, sem rastreamento em tempo real nesta etapa.</p>
          </div>
          <button class="admin-button admin-button-secondary" type="button" data-delivery-settings-action="add-courier" ${isBusy ? "disabled" : ""}>Cadastrar entregador</button>
        </header>
        <div class="admin-delivery-courier-list">
          ${
            draft.couriers?.length
              ? draft.couriers.map((courier, index) => renderDeliveryCourierRow(courier, index, { isBusy })).join("")
              : '<div class="admin-empty-inline"><span>Nenhum entregador cadastrado.</span></div>'
          }
        </div>
      </article>

      <article class="admin-delivery-card is-wide">
        <header class="admin-delivery-card-head">
          <div>
            <span class="admin-chip">Repasse ao entregador</span>
            <h3>Regra financeira</h3>
            <p>Esta regra fica salva para o Dashboard/Financeiro consumir depois.</p>
          </div>
        </header>
        <div class="admin-delivery-form-grid">
          <label class="admin-delivery-field">
            <span>Modelo de repasse</span>
            <select class="admin-input" data-delivery-field="courierPayout.mode" ${isBusy ? "disabled" : ""}>
              ${DELIVERY_PAYOUT_MODES.map(
                (mode) => `<option value="${escapeHtml(mode.id)}" ${draft.courierPayout?.mode === mode.id ? "selected" : ""}>${escapeHtml(mode.label)}</option>`
              ).join("")}
            </select>
          </label>
          ${renderDeliveryField({ label: "Percentual da taxa", field: "courierPayout.percentage", value: formatAdminNumberValue(draft.courierPayout?.percentage), type: "number", step: "0.01", disabled: isBusy })}
          ${renderDeliveryField({ label: "Valor manual", field: "courierPayout.manualAmount", value: formatAdminNumberValue(draft.courierPayout?.manualAmount), type: "number", step: "0.01", disabled: isBusy })}
        </div>
      </article>
    </section>
  `;
};

const renderCustomerModule = () => {
  const moduleRoot = document.querySelector("[data-admin-module-content]");

  if (!moduleRoot) {
    return;
  }

  if (adminState.isLoadingCustomers && !adminState.customersSnapshot) {
    moduleRoot.innerHTML = `
      <div class="admin-empty-state admin-empty-state-loading">
        <strong>Carregando clientes</strong>
        <span>Consolidando pedidos, recorrencia, gastos e historico de relacionamento.</span>
      </div>
    `;
    return;
  }

  const snapshot = getCustomerCrmSnapshot();
  const summary = snapshot.summary || {};
  const customers = getVisibleCustomerCrmRecords();
  const selectedCustomer = getSelectedCustomerCrmRecord();

  moduleRoot.innerHTML = `
    <header class="admin-module-head">
      <div>
        <span class="admin-chip">CRM simples</span>
        <h2>Relacionamento e fidelizacao</h2>
        <p>Clientes consolidados a partir dos pedidos, com sinais de recorrencia, sumico e acao sugerida.</p>
      </div>
      <div class="admin-module-head-meta">
        <span>Clientes na base</span>
        <strong>${escapeHtml(String(summary.totalCustomers || 0))}</strong>
      </div>
    </header>

    <section class="admin-module-kpis">
      <article class="admin-mini-stat is-warm">
        <span>Recorrentes</span>
        <strong>${escapeHtml(String(summary.recurringCustomers || 0))}</strong>
      </article>
      <article class="admin-mini-stat is-green">
        <span>VIP</span>
        <strong>${escapeHtml(String(summary.vipCustomers || 0))}</strong>
      </article>
      <article class="admin-mini-stat is-blue">
        <span>Sumidos</span>
        <strong>${escapeHtml(String(summary.lapsedCustomers || 0))}</strong>
      </article>
      <article class="admin-mini-stat is-cyan">
        <span>Gasto total</span>
        <strong>${escapeHtml(formatMoney(summary.totalSpent || 0))}</strong>
      </article>
    </section>

    <section class="admin-customer-toolbar">
      <label>
        <span>Tag</span>
        <select class="admin-input" data-customer-filter="tag">
          ${CUSTOMER_CRM_TAG_OPTIONS.map(
            (option) => `<option value="${escapeHtml(option.key)}" ${adminState.customerFilters.tag === option.key ? "selected" : ""}>${escapeHtml(option.label)}</option>`
          ).join("")}
        </select>
      </label>
      <label>
        <span>Recencia</span>
        <select class="admin-input" data-customer-filter="inactiveDays">
          ${CUSTOMER_CRM_INACTIVE_FILTERS.map(
            (option) => `<option value="${escapeHtml(option.key)}" ${String(adminState.customerFilters.inactiveDays || "") === option.key ? "selected" : ""}>${escapeHtml(option.label)}</option>`
          ).join("")}
        </select>
      </label>
      <label>
        <span>Ordenar</span>
        <select class="admin-input" data-customer-filter="sortBy">
          ${CUSTOMER_CRM_SORT_OPTIONS.map(
            (option) => `<option value="${escapeHtml(option.key)}" ${adminState.customerFilters.sortBy === option.key ? "selected" : ""}>${escapeHtml(option.label)}</option>`
          ).join("")}
        </select>
      </label>
    </section>

    <section class="admin-customer-list">
      ${
        customers.length > 0
          ? customers
              .map(
                (customer) => `
                  <button
                    class="admin-customer-card${customer.key === selectedCustomer?.key ? " is-selected" : ""}${customer.isLapsed ? " is-lapsed" : ""}"
                    type="button"
                    data-customer-key="${escapeHtml(customer.key)}"
                  >
                    <div class="admin-customer-card-top">
                      <div>
                        <strong>${escapeHtml(customer.customerName)}</strong>
                        <small>${escapeHtml(customer.customerPhone || customer.customerEmail || "Sem contato")}</small>
                      </div>
                      <span>${escapeHtml(String(customer.ordersCount))} pedidos</span>
                    </div>
                    <div class="admin-customer-card-tags">
                      ${buildCustomerTagChips(customer)}
                    </div>
                    <div class="admin-customer-card-grid">
                      <span><strong>Ultima compra</strong>${escapeHtml(formatDateTime(customer.lastPurchaseAt || ""))}</span>
                      <span><strong>Total gasto</strong>${escapeHtml(formatMoney(customer.totalSpent || 0))}</span>
                      <span><strong>Ticket medio</strong>${escapeHtml(formatMoney(customer.averageTicket || 0))}</span>
                      <span><strong>Endereco</strong>${escapeHtml(customer.mostUsedAddress || "Nao informado")}</span>
                    </div>
                    <div class="admin-customer-action-line">
                      <small>${escapeHtml(getCustomerDaysSinceLabel(customer))}</small>
                      <strong>${escapeHtml(customer.suggestedAction || "Mandar mensagem no WhatsApp")}</strong>
                    </div>
                  </button>
                `
              )
              .join("")
          : `
            <div class="admin-empty-state">
              <strong>Nenhum cliente encontrado</strong>
              <span>Ajuste busca e filtros ou aguarde novos pedidos para alimentar o CRM.</span>
            </div>
          `
      }
    </section>
  `;
};

const renderFinanceModule = () => {
  const moduleRoot = document.querySelector("[data-admin-module-content]");

  if (!moduleRoot) {
    return;
  }

  if (adminState.isLoadingFinance && !adminState.financeSnapshot) {
    moduleRoot.innerHTML = `
      <div class="admin-empty-state admin-empty-state-loading">
        <strong>Carregando financeiro</strong>
        <span>Consolidando pedidos, formas de pagamento, taxas e fechamento.</span>
      </div>
    `;
    return;
  }

  const snapshot = getFinanceSnapshot();
  const overview = snapshot.overview || {};
  const closing = snapshot.closing || {};
  const periodOptions = Array.isArray(snapshot.periodOptions) && snapshot.periodOptions.length
    ? snapshot.periodOptions
    : FINANCE_PERIOD_FALLBACK_OPTIONS;
  const filteredOrders = getFilteredFinanceOrders();
  const revenueTrend = Array.isArray(snapshot.charts?.revenueTrend) ? snapshot.charts.revenueTrend : [];
  const paymentBreakdown = Array.isArray(snapshot.paymentBreakdown) ? snapshot.paymentBreakdown : [];
  const hourlyOrders = Array.isArray(snapshot.charts?.hourlyOrders) ? snapshot.charts.hourlyOrders : [];
  const fulfillmentBreakdown = Array.isArray(snapshot.charts?.fulfillment) ? snapshot.charts.fulfillment : [];
  const maxRevenue = getChartMax(revenueTrend, "total");
  const maxPayment = getChartMax(paymentBreakdown, "total");
  const maxHourly = getChartMax(hourlyOrders, "count");
  const maxFulfillment = getChartMax(fulfillmentBreakdown, "count");
  const countedCashValue =
    typeof closing.countedCash === "number" ? String(closing.countedCash.toFixed(2)) : "";
  const payoutRuleLabel = getFinancePayoutRuleLabel(snapshot.deliveryPayoutSettings || {});
  const kpis = [
    {
      label: "Faturamento bruto",
      value: formatMoney(overview.grossRevenue || 0),
      helper: `${overview.validOrders || 0} pedido(s) validos`,
      tone: "is-green",
    },
    {
      label: "Faturamento liquido",
      value: formatMoney(overview.netRevenue || 0),
      helper: "Bruto menos entrega e descontos",
      tone: "is-blue",
    },
    {
      label: "Valor de entrega",
      value: formatMoney(overview.deliveryFees || 0),
      helper: "Taxas cobradas no periodo",
      tone: "is-warm",
    },
    {
      label: "Repasse entregadores",
      value: formatMoney(overview.deliveryPayout || 0),
      helper: payoutRuleLabel,
      tone: "is-purple",
    },
    {
      label: "Ticket medio",
      value: formatMoney(overview.averageTicket || 0),
      helper: "Media dos pedidos validos",
      tone: "is-blue",
    },
    {
      label: "Total de pedidos pagos",
      value: String(overview.paidOrders || 0),
      helper: formatMoney(overview.receivedRevenue || 0),
      tone: "is-green",
    },
    {
      label: "Cancelamentos",
      value: String(overview.cancelledOrders || 0),
      helper: formatMoney(overview.cancelledRevenue || 0),
      tone: "is-danger",
    },
    {
      label: "Dinheiro pendente",
      value: formatMoney(overview.pendingAmount || 0),
      helper: `${overview.pendingOrders || 0} pedido(s) em aberto`,
      tone: "is-warm",
    },
  ];

  moduleRoot.innerHTML = `
    <header class="admin-module-head admin-finance-head">
      <div class="admin-finance-head-copy">
        <span class="admin-chip">Financeiro</span>
        <h2>Financeiro</h2>
        <p>Visao de faturamento, repasses, taxas e fechamento.</p>
        <small>${escapeHtml(snapshot.filters?.rangeLabel || "Periodo financeiro")}</small>
      </div>
      <div class="admin-finance-actions" aria-label="Exportacoes financeiras">
        <button class="admin-button admin-button-secondary" type="button" data-finance-export="csv">Exportar CSV</button>
        <button class="admin-button admin-button-secondary" type="button" data-finance-export="closing">Exportar resumo do fechamento</button>
      </div>
    </header>

    <section class="admin-finance-period-card" aria-label="Filtros de periodo financeiro">
      <div class="admin-finance-period-tabs">
        ${periodOptions
          .map(
            (option) => `
              <button
                class="admin-finance-period-button${snapshot.filters?.period === option.key ? " is-active" : ""}"
                type="button"
                data-finance-period="${escapeHtml(option.key)}"
              >
                ${escapeHtml(option.label)}
              </button>
            `
          )
          .join("")}
      </div>
      <div class="admin-finance-custom-range${snapshot.filters?.period === "custom" ? " is-active" : ""}">
        <label class="admin-field admin-finance-date-field">
          <span>Inicio</span>
          <input
            class="admin-input"
            type="date"
            value="${escapeHtml(snapshot.filters?.startDate || adminState.financeFilters.startDate || "")}"
            data-finance-filter="startDate"
          />
        </label>
        <label class="admin-field admin-finance-date-field">
          <span>Fim</span>
          <input
            class="admin-input"
            type="date"
            value="${escapeHtml(snapshot.filters?.endDate || adminState.financeFilters.endDate || "")}"
            data-finance-filter="endDate"
          />
        </label>
      </div>
    </section>

    <section class="admin-finance-kpi-grid">
      ${kpis
        .map(
          (kpi) => `
            <article class="admin-finance-kpi ${kpi.tone}">
              <span>${escapeHtml(kpi.label)}</span>
              <strong>${escapeHtml(kpi.value)}</strong>
              <small>${escapeHtml(kpi.helper)}</small>
            </article>
          `
        )
        .join("")}
    </section>

    <section class="admin-finance-grid">
      <article class="admin-module-card admin-finance-card">
        <div class="admin-module-card-head">
          <h3>Meios de pagamento</h3>
          <span>Quantidade, total recebido e participacao</span>
        </div>
        <div class="admin-finance-payment-list">
          ${paymentBreakdown
            .map(
              (entry) => `
                <div class="admin-finance-payment-row">
                  <div>
                    <strong>${escapeHtml(entry.label)}</strong>
                    <small>${escapeHtml(String(entry.count))} pedido(s)</small>
                  </div>
                  <div class="admin-finance-payment-total">
                    <strong>${escapeHtml(formatMoney(entry.total || 0))}</strong>
                    <span>${escapeHtml(formatPercent(entry.percent || 0))}</span>
                  </div>
                  <div class="admin-finance-row-track" aria-hidden="true">
                    <span style="${escapeHtml(getFinanceBarStyle(entry.total || 0, maxPayment))}"></span>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </article>

      <article class="admin-module-card admin-finance-card">
        <div class="admin-module-card-head">
          <h3>Fechamento de caixa</h3>
          <span>${closing.updatedAt ? `Salvo em ${escapeHtml(formatDateTime(closing.updatedAt))}` : "Aguardando conferencia"}</span>
        </div>
        <form class="admin-finance-closing" data-finance-closing-form>
          <div class="admin-finance-closing-grid">
            <span><strong>Total esperado</strong>${escapeHtml(formatMoney(closing.totalExpected || 0))}</span>
            <span><strong>Total recebido</strong>${escapeHtml(formatMoney(closing.totalReceived || 0))}</span>
            <span class="${Number(closing.difference || 0) < 0 ? "is-negative" : "is-positive"}"><strong>Diferenca</strong>${escapeHtml(formatMoney(closing.difference || 0))}</span>
            <span><strong>Dinheiro a conferir</strong>${escapeHtml(formatMoney(closing.cashExpected || 0))}</span>
            <span><strong>Pix recebido</strong>${escapeHtml(formatMoney(closing.pixReceived || 0))}</span>
            <span><strong>Cartao recebido</strong>${escapeHtml(formatMoney(closing.cardReceived || 0))}</span>
          </div>
          <label class="admin-field">
            <span>Valor contado em dinheiro</span>
            <input
              class="admin-input"
              type="text"
              inputmode="decimal"
              name="countedCash"
              value="${escapeHtml(countedCashValue)}"
              placeholder="${escapeHtml(formatMoney(closing.cashExpected || 0))}"
            />
          </label>
          <label class="admin-field">
            <span>Observacoes internas</span>
            <textarea class="admin-input admin-textarea" name="notes" rows="4" placeholder="Registre divergencias, sangrias, comprovantes ou contexto do fechamento.">${escapeHtml(closing.notes || "")}</textarea>
          </label>
          <div class="admin-finance-closing-actions">
            <button class="admin-button admin-button-primary" type="submit" ${adminState.isSavingFinanceClosing ? "disabled" : ""}>
              ${adminState.isSavingFinanceClosing ? "Salvando..." : "Salvar fechamento"}
            </button>
          </div>
        </form>
      </article>
    </section>

    <section class="admin-finance-chart-grid">
      <article class="admin-module-card admin-finance-chart-card">
        <div class="admin-module-card-head">
          <h3>Evolucao do faturamento</h3>
          <span>Receita recebida por dia</span>
        </div>
        <div class="admin-finance-bars is-revenue">
          ${
            revenueTrend.length
              ? revenueTrend
                  .map(
                    (entry) => `
                      <div class="admin-finance-bar-row">
                        <span>${escapeHtml(entry.label)}</span>
                        <div class="admin-finance-bar-track"><span style="${escapeHtml(getFinanceBarStyle(entry.total || 0, maxRevenue))}"></span></div>
                        <strong>${escapeHtml(formatMoney(entry.total || 0))}</strong>
                      </div>
                    `
                  )
                  .join("")
              : `<div class="admin-empty-state admin-empty-state-soft"><strong>Sem receita no periodo</strong><span>Quando houver pedidos pagos, a curva aparece aqui.</span></div>`
          }
        </div>
      </article>

      <article class="admin-module-card admin-finance-chart-card">
        <div class="admin-module-card-head">
          <h3>Pedidos por horario</h3>
          <span>Volume de pedidos validos</span>
        </div>
        <div class="admin-finance-bars">
          ${
            hourlyOrders.length
              ? hourlyOrders
                  .map(
                    (entry) => `
                      <div class="admin-finance-bar-row">
                        <span>${escapeHtml(entry.label)}</span>
                        <div class="admin-finance-bar-track"><span style="${escapeHtml(getFinanceBarStyle(entry.count || 0, maxHourly))}"></span></div>
                        <strong>${escapeHtml(String(entry.count || 0))}</strong>
                      </div>
                    `
                  )
                  .join("")
              : `<div class="admin-empty-state admin-empty-state-soft"><strong>Sem pedidos no periodo</strong><span>O volume por horario depende dos pedidos validos do filtro.</span></div>`
          }
        </div>
      </article>

      <article class="admin-module-card admin-finance-chart-card">
        <div class="admin-module-card-head">
          <h3>Receita por forma de pagamento</h3>
          <span>Distribuicao recebida</span>
        </div>
        <div class="admin-finance-donut-list">
          ${paymentBreakdown
            .map(
              (entry) => `
                <div class="admin-finance-donut-row">
                  <span>${escapeHtml(entry.label)}</span>
                  <strong>${escapeHtml(formatMoney(entry.total || 0))}</strong>
                  <small>${escapeHtml(formatPercent(entry.percent || 0))}</small>
                </div>
              `
            )
            .join("")}
        </div>
      </article>

      <article class="admin-module-card admin-finance-chart-card">
        <div class="admin-module-card-head">
          <h3>Entregas x retirada</h3>
          <span>Mix operacional financeiro</span>
        </div>
        <div class="admin-finance-bars">
          ${fulfillmentBreakdown
            .map(
              (entry) => `
                <div class="admin-finance-bar-row">
                  <span>${escapeHtml(entry.label)}</span>
                  <div class="admin-finance-bar-track"><span style="${escapeHtml(getFinanceBarStyle(entry.count || 0, maxFulfillment))}"></span></div>
                  <strong>${escapeHtml(String(entry.count || 0))}</strong>
                </div>
              `
            )
            .join("")}
        </div>
      </article>
    </section>

    <section class="admin-module-card admin-finance-table-card">
      <div class="admin-finance-table-head">
        <div>
          <h3>Relatorio por pedidos</h3>
          <span>${escapeHtml(String(filteredOrders.length))} pedido(s) no filtro atual</span>
        </div>
        <div class="admin-finance-table-filters">
          <label class="admin-field">
            <span>Status financeiro</span>
            <select class="admin-input" data-finance-table-filter="status">
              ${FINANCE_STATUS_FILTER_OPTIONS.map(
                (option) => `
                  <option value="${escapeHtml(option.key)}" ${adminState.financeTableFilters.status === option.key ? "selected" : ""}>${escapeHtml(option.label)}</option>
                `
              ).join("")}
            </select>
          </label>
          <label class="admin-field">
            <span>Forma de pagamento</span>
            <select class="admin-input" data-finance-table-filter="paymentMethod">
              ${FINANCE_PAYMENT_FILTER_OPTIONS.map(
                (option) => `
                  <option value="${escapeHtml(option.key)}" ${adminState.financeTableFilters.paymentMethod === option.key ? "selected" : ""}>${escapeHtml(option.label)}</option>
                `
              ).join("")}
            </select>
          </label>
        </div>
      </div>
      <div class="admin-finance-table-wrap">
        <table class="admin-finance-table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Horario</th>
              <th>Pagamento</th>
              <th>Produtos</th>
              <th>Entrega</th>
              <th>Desconto</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${
              filteredOrders.length
                ? filteredOrders
                    .map(
                      (order) => `
                        <tr>
                          <td><button type="button" data-order-select="${escapeHtml(order.id)}">${escapeHtml(order.publicId || order.id)}</button></td>
                          <td>${escapeHtml(order.customerName || "Cliente")}</td>
                          <td>${escapeHtml(formatDateTime(order.occurredAt || order.createdAt))}</td>
                          <td>${escapeHtml(getFinancePaymentGroupLabel(order.paymentMethod))}</td>
                          <td>${escapeHtml(formatMoney(order.subtotal || order.productRevenue || 0))}</td>
                          <td>${escapeHtml(formatMoney(order.deliveryFee || 0))}</td>
                          <td>${escapeHtml(formatMoney(order.discountAmount || 0))}</td>
                          <td>${escapeHtml(formatMoney(order.totalAmount || 0))}</td>
                          <td><span class="${escapeHtml(getFinanceStatusClassName(order.financialStatus))}">${escapeHtml(getFinanceStatusLabel(order.financialStatus))}</span></td>
                        </tr>
                      `
                    )
                    .join("")
                : `
                  <tr>
                    <td colspan="9">
                      <div class="admin-empty-state admin-empty-state-soft">
                        <strong>Nenhum pedido no filtro</strong>
                        <span>Ajuste periodo, status financeiro ou forma de pagamento.</span>
                      </div>
                    </td>
                  </tr>
                `
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
};

const renderReportsModule = () => {
  const moduleRoot = document.querySelector("[data-admin-module-content]");
  const reports = getReportOverview();

  if (!moduleRoot) {
    return;
  }

  moduleRoot.innerHTML = `
    <header class="admin-module-head">
      <div>
        <span class="admin-chip">Relatorios</span>
        <h2>Performance do turno e gargalos</h2>
        <p>Panorama de volume, status, canal de atendimento e distribuicao ao longo do turno.</p>
      </div>
      <div class="admin-module-head-meta">
        <span>Pedidos analisados</span>
        <strong>${escapeHtml(String(reports.visibleOrders.length))}</strong>
      </div>
    </header>

    <section class="admin-reports-grid">
      <article class="admin-module-card">
        <div class="admin-module-card-head">
          <h3>Distribuicao por status</h3>
          <span>Onde o fluxo trava</span>
        </div>
        <div class="admin-report-bars">
          ${reports.statusBreakdown
            .map((entry) => {
              const percent = reports.visibleOrders.length
                ? Math.round((entry.value / reports.visibleOrders.length) * 100)
                : 0;
              return `
                <div class="admin-report-bar-row">
                  <div>
                    <strong>${escapeHtml(entry.label)}</strong>
                    <small>${escapeHtml(String(entry.value))} pedido(s)</small>
                  </div>
                  <div class="admin-report-bar">
                    <span style="width:${escapeHtml(String(percent))}%"></span>
                  </div>
                  <strong>${escapeHtml(`${percent}%`)}</strong>
                </div>
              `;
            })
            .join("")}
        </div>
      </article>

      <article class="admin-module-card">
        <div class="admin-module-card-head">
          <h3>Canal e modalidade</h3>
          <span>Entrega x retirada</span>
        </div>
        <div class="admin-dual-metric-list">
          ${reports.fulfillmentBreakdown
            .map(
              (entry) => `
                <div class="admin-dual-metric-row">
                  <strong>${escapeHtml(entry.label)}</strong>
                  <span>${escapeHtml(String(entry.value))}</span>
                </div>
              `
            )
            .join("")}
        </div>

        <div class="admin-module-card-head admin-module-card-head-secondary">
          <h3>Faixas de horario</h3>
          <span>Picos recentes</span>
        </div>
        <div class="admin-dual-metric-list">
          ${reports.hourlyBreakdown
            .map(
              (entry) => `
                <div class="admin-dual-metric-row">
                  <strong>${escapeHtml(entry.label)}</strong>
                  <span>${escapeHtml(String(entry.value))}</span>
                </div>
              `
            )
            .join("")}
        </div>
      </article>
    </section>
  `;
};

const renderMetricsStageList = (stageMetrics) => {
  if (!Array.isArray(stageMetrics) || stageMetrics.length === 0) {
    return `
      <div class="admin-empty-inline">
        Nenhuma etapa com amostragem suficiente neste recorte.
      </div>
    `;
  }

  return `
    <div class="admin-metrics-stage-list">
      ${stageMetrics
        .map(
          (entry) => `
            <div class="admin-metrics-stage-row">
              <div>
                <strong>${escapeHtml(entry.label)}</strong>
                <small>${escapeHtml(String(entry.sampleCount || 0))} amostra(s)</small>
              </div>
              <strong>${escapeHtml(formatDuration(entry.averageMs))}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;
};

const renderMetricsHighlights = (snapshot) => {
  const highlights = snapshot?.highlights || {};

  return `
    <div class="admin-metrics-highlight-grid">
      <article class="admin-metrics-highlight-card">
        <span>Admin mais ativo</span>
        <strong>${escapeHtml(highlights.mostActiveAdmin?.adminDisplayName || "Sem leitura")}</strong>
        <small>${
          highlights.mostActiveAdmin
            ? escapeHtml(`${highlights.mostActiveAdmin.totalActions} acao(oes) no periodo`)
            : "Ainda nao ha acoes suficientes para ranquear."
        }</small>
      </article>

      <article class="admin-metrics-highlight-card">
        <span>Melhor resposta inicial</span>
        <strong>${escapeHtml(highlights.bestResponseAdmin?.adminDisplayName || "Sem leitura")}</strong>
        <small>${
          highlights.bestResponseAdmin
            ? escapeHtml(formatDuration(highlights.bestResponseAdmin.averageMs))
            : "Sem base suficiente para comparar resposta inicial."
        }</small>
      </article>

      <article class="admin-metrics-highlight-card">
        <span>Lider de conclusoes</span>
        <strong>${escapeHtml(highlights.completionLeader?.adminDisplayName || "Sem leitura")}</strong>
        <small>${
          highlights.completionLeader
            ? escapeHtml(`${highlights.completionLeader.finalizedOrders} pedido(s) encerrados`)
            : "Nenhuma conclusao atribuida no periodo."
        }</small>
      </article>

      <article class="admin-metrics-highlight-card">
        <span>Cobertura de auditoria</span>
        <strong>${escapeHtml(formatPercent(highlights.auditCoverageRate || 0))}</strong>
        <small>${escapeHtml(formatPercent(highlights.responseCoverageRate || 0))} com resposta inicial rastreavel.</small>
      </article>
    </div>
  `;
};

const renderMetricsAdminRows = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return `
      <div class="admin-empty-state admin-empty-state-soft">
        <strong>Sem leitura por admin neste recorte</strong>
        <span>Ajuste periodo, fluxo ou usuario para carregar a participacao operacional.</span>
      </div>
    `;
  }

  return `
    <div class="admin-metrics-admin-table">
      <div class="admin-metrics-admin-row is-head">
        <span>Admin</span>
        <span>Acoes</span>
        <span>Aceitos</span>
        <span>Concluidos</span>
        <span>Cancelados</span>
        <span>Resposta</span>
        <span>Participacao</span>
      </div>
      ${rows
        .map(
          (entry) => `
            <div class="admin-metrics-admin-row">
              <div class="admin-metrics-admin-cell">
                <strong>${escapeHtml(entry.adminDisplayName || entry.adminLogin)}</strong>
                <small>${escapeHtml(entry.adminLogin)}</small>
              </div>
              <span>${escapeHtml(String(entry.totalActions || 0))}</span>
              <span>${escapeHtml(String(entry.acceptedOrders || 0))}</span>
              <span>${escapeHtml(String(entry.finalizedOrders || 0))}</span>
              <span>${escapeHtml(String(entry.cancelledOrders || 0))}</span>
              <span>${escapeHtml(formatDuration(entry.initialResponseAverageMs))}</span>
              <strong>${escapeHtml(formatPercent(entry.participationRate || 0))}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;
};

const renderMetricsBreakdownRows = (rows, formatter = (value) => String(value)) => `
  <div class="admin-metrics-breakdown">
    ${rows
      .map(
        (entry) => `
          <div class="admin-metrics-breakdown-row">
            <span>${escapeHtml(entry.label)}</span>
            <strong>${escapeHtml(formatter(entry.value))}</strong>
          </div>
        `
      )
      .join("")}
  </div>
`;

const renderMetricsComparisonCards = (comparison) => {
  const metrics = comparison?.metrics || {};
  const timeMetric =
    Number.isFinite(metrics.completionTime?.currentValue) || Number.isFinite(metrics.completionTime?.previousValue)
      ? metrics.completionTime
      : metrics.firstResponse;
  const cards = [
    metrics.totalOrders,
    metrics.totalRevenue,
    metrics.cancellationRate,
    timeMetric,
  ].filter(Boolean);

  return `
    <section class="admin-metrics-trend-grid">
      ${cards
        .map(
          (metric) => `
            <article class="admin-metrics-trend-card ${getMetricToneClass(metric)}">
              <div class="admin-metrics-trend-top">
                <span>${escapeHtml(metric.label)}</span>
                <strong>${escapeHtml(formatMetricUnitValue(metric.currentValue, metric.unit))}</strong>
              </div>
              <div class="admin-metrics-trend-meta">
                <small>${escapeHtml(comparison.currentRangeLabel || "Periodo atual")}</small>
                <span class="admin-metrics-trend-pill ${getMetricToneClass(metric)}">
                  ${escapeHtml(getMetricDirectionLabel(metric))} ${escapeHtml(formatMetricDeltaPercent(metric))}
                </span>
              </div>
              <p>
                Periodo anterior: ${escapeHtml(formatMetricUnitValue(metric.previousValue, metric.unit))} em
                ${escapeHtml(comparison.previousRangeLabel || "periodo anterior")}.
              </p>
            </article>
          `
        )
        .join("")}
    </section>
  `;
};

const renderMetricsLineChart = (currentSeries = [], previousSeries = [], options = {}) => {
  const currentValues = currentSeries.map((entry) => Number(entry.value || 0));
  const previousValues = previousSeries.map((entry) => Number(entry.value || 0));
  const maxValue = Math.max(1, ...currentValues, ...previousValues);
  const width = 640;
  const height = 220;
  const paddingX = 24;
  const paddingY = 18;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingY * 2;
  const currentPoints = currentSeries.map((entry, index) => {
    const x =
      currentSeries.length <= 1 ? width / 2 : paddingX + (index * plotWidth) / (currentSeries.length - 1);
    const y = height - paddingY - ((Number(entry.value || 0) / maxValue) * plotHeight || 0);
    return { ...entry, x, y };
  });
  const previousPoints = previousSeries.map((entry, index) => {
    const x =
      previousSeries.length <= 1 ? width / 2 : paddingX + (index * plotWidth) / (previousSeries.length - 1);
    const y = height - paddingY - ((Number(entry.value || 0) / maxValue) * plotHeight || 0);
    return { ...entry, x, y };
  });
  const currentPolyline = currentPoints.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const previousPolyline = previousPoints.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const currentArea = currentPoints.length
    ? `M ${currentPoints[0].x.toFixed(1)} ${(height - paddingY).toFixed(1)} L ${currentPoints
        .map((point) => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
        .join(" L ")} L ${currentPoints[currentPoints.length - 1].x.toFixed(1)} ${(height - paddingY).toFixed(
        1
      )} Z`
    : "";
  const labelIndexes = Array.from(
    new Set([0, Math.floor((currentSeries.length - 1) / 2), Math.max(currentSeries.length - 1, 0)])
  ).filter((index) => index >= 0 && index < currentSeries.length);
  const currentTotal = currentValues.reduce((sum, value) => sum + value, 0);
  const previousTotal = previousValues.reduce((sum, value) => sum + value, 0);

  return `
    <div class="admin-metrics-chart-shell">
      <div class="admin-metrics-chart-legend">
        <span><i class="is-current"></i>${escapeHtml(options.currentLabel || "Periodo atual")}</span>
        <span><i class="is-previous"></i>${escapeHtml(options.previousLabel || "Periodo anterior")}</span>
      </div>
      <svg class="admin-metrics-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(
        options.title || "Grafico operacional"
      )}">
        <defs>
          <linearGradient id="adminMetricsArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="rgba(79, 132, 255, 0.28)"></stop>
            <stop offset="100%" stop-color="rgba(79, 132, 255, 0)"></stop>
          </linearGradient>
        </defs>
        ${[0.25, 0.5, 0.75].map((ratio) => {
          const y = paddingY + plotHeight * ratio;
          return `<line x1="${paddingX}" y1="${y.toFixed(1)}" x2="${width - paddingX}" y2="${y.toFixed(
            1
          )}" class="admin-metrics-grid-line" />`;
        }).join("")}
        ${
          currentArea
            ? `<path d="${currentArea}" fill="url(#adminMetricsArea)" class="admin-metrics-area-path"></path>`
            : ""
        }
        ${
          previousPolyline
            ? `<polyline points="${previousPolyline}" class="admin-metrics-line admin-metrics-line-previous"></polyline>`
            : ""
        }
        ${
          currentPolyline
            ? `<polyline points="${currentPolyline}" class="admin-metrics-line admin-metrics-line-current"></polyline>`
            : ""
        }
        ${currentPoints
          .map(
            (point) => `
              <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4" class="admin-metrics-point"></circle>
            `
          )
          .join("")}
      </svg>
      <div class="admin-metrics-chart-footer">
        ${labelIndexes
          .map(
            (index) => `
              <span>${escapeHtml(currentSeries[index]?.label || "--/--")}</span>
            `
          )
          .join("")}
      </div>
      <div class="admin-metrics-chart-summary">
        <span>Atual: <strong>${escapeHtml(String(currentTotal))}</strong></span>
        <span>Anterior: <strong>${escapeHtml(String(previousTotal))}</strong></span>
        <span>Pico: <strong>${escapeHtml(String(maxValue))}</strong></span>
      </div>
    </div>
  `;
};

const renderMetricsDistributionChart = (rows = []) => {
  const maxValue = Math.max(1, ...rows.map((entry) => Number(entry.value || 0)));
  const total = rows.reduce((sum, entry) => sum + Number(entry.value || 0), 0);

  return `
    <div class="admin-metrics-distribution">
      ${rows
        .map((entry) => {
          const value = Number(entry.value || 0);
          const widthPercent = Math.max(4, Math.round((value / maxValue) * 100));
          const share = total > 0 ? Math.round((value / total) * 100) : 0;
          return `
            <div class="admin-metrics-distribution-row">
              <div class="admin-metrics-distribution-copy">
                <strong>${escapeHtml(entry.label)}</strong>
                <small>${escapeHtml(`${share}% do recorte`)}</small>
              </div>
              <div class="admin-metrics-distribution-bar">
                <span style="width:${escapeHtml(String(widthPercent))}%"></span>
              </div>
              <strong>${escapeHtml(String(value))}</strong>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
};

const renderMetricsModule = () => {
  const moduleRoot = document.querySelector("[data-admin-module-content]");
  const snapshot = getMetricsSnapshot();
  const comparison = snapshot?.comparison || null;
  const charts = snapshot?.charts || {};
  const filters = snapshot?.filters || adminState.metricsFilters;
  const periodOptions = Array.isArray(snapshot?.periodOptions)
    ? snapshot.periodOptions
    : [
        { key: "today", label: "Hoje" },
        { key: "7d", label: "Ultimos 7 dias" },
        { key: "30d", label: "Ultimos 30 dias" },
        { key: "custom", label: "Periodo customizado" },
      ];
  const adminOptions = Array.isArray(snapshot?.adminOptions) ? snapshot.adminOptions : [];
  const statusOptions = Array.isArray(snapshot?.statusOptions)
    ? snapshot.statusOptions
    : [{ key: "", label: "Todos os status" }, ...ORDER_STATUSES.map((status) => ({ key: status, label: status }))];
  const flowOptions = Array.isArray(snapshot?.flowOptions)
    ? snapshot.flowOptions
    : [
        { key: "", label: "Todos os fluxos" },
        { key: "delivery", label: "Entrega" },
        { key: "pickup", label: "Retirada" },
        { key: "scheduled", label: "Agendados" },
      ];

  if (!moduleRoot) {
    return;
  }

  if (adminState.isLoadingMetrics && !snapshot) {
    moduleRoot.innerHTML = `
      <div class="admin-empty-state admin-empty-state-loading">
        <strong>Carregando metricas operacionais</strong>
        <span>Consolidando pedidos e trilha de auditoria para montar a leitura gerencial.</span>
      </div>
    `;
    return;
  }

  moduleRoot.innerHTML = `
    <header class="admin-module-head">
      <div>
        <span class="admin-chip">Metricas</span>
        <h2>Desempenho operacional por periodo e por admin</h2>
        <p>Indicadores reais calculados a partir dos pedidos do recorte e da trilha de auditoria do gestor.</p>
      </div>
      <div class="admin-module-head-meta">
        <span>Escopo atual</span>
        <strong>${escapeHtml(snapshot?.filters?.periodLabel || "Ultimos 7 dias")}</strong>
      </div>
    </header>

    <section class="admin-metrics-toolbar">
      <label class="admin-field">
        <span>Periodo</span>
        <select class="admin-input" data-metrics-filter="period">
          ${periodOptions
            .map(
              (option) => `
                <option value="${escapeHtml(option.key)}" ${option.key === filters.period ? "selected" : ""}>
                  ${escapeHtml(option.label)}
                </option>
              `
            )
            .join("")}
        </select>
      </label>

      <label class="admin-field">
        <span>Admin</span>
        <select class="admin-input" data-metrics-filter="adminLogin">
          <option value="">Todos os admins</option>
          ${adminOptions
            .map(
              (option) => `
                <option value="${escapeHtml(option.login)}" ${option.login === filters.adminLogin ? "selected" : ""}>
                  ${escapeHtml(option.displayName || option.login)}
                </option>
              `
            )
            .join("")}
        </select>
      </label>

      <label class="admin-field">
        <span>Status</span>
        <select class="admin-input" data-metrics-filter="status">
          ${statusOptions
            .map(
              (option) => `
                <option value="${escapeHtml(option.key)}" ${option.key === filters.status ? "selected" : ""}>
                  ${escapeHtml(option.label)}
                </option>
              `
            )
            .join("")}
        </select>
      </label>

      <label class="admin-field">
        <span>Fluxo</span>
        <select class="admin-input" data-metrics-filter="flow">
          ${flowOptions
            .map(
              (option) => `
                <option value="${escapeHtml(option.key)}" ${option.key === filters.flow ? "selected" : ""}>
                  ${escapeHtml(option.label)}
                </option>
              `
            )
            .join("")}
        </select>
      </label>

      <label class="admin-field">
        <span>Data inicial</span>
        <input class="admin-input" type="date" value="${escapeHtml(filters.startDate || "")}" data-metrics-filter="startDate" />
      </label>

      <label class="admin-field">
        <span>Data final</span>
        <input class="admin-input" type="date" value="${escapeHtml(filters.endDate || "")}" data-metrics-filter="endDate" />
      </label>
    </section>

    ${
      !snapshot || Number(snapshot.overview?.totalOrders || 0) === 0
        ? `
          <div class="admin-empty-state">
            <strong>Nenhum pedido encontrado neste recorte</strong>
            <span>Ajuste periodo, fluxo ou admin para consultar outra faixa da operacao.</span>
          </div>
        `
        : `
          <section class="admin-module-kpis admin-metrics-kpis">
            <article class="admin-mini-stat is-warm">
              <span>Total de pedidos</span>
              <strong>${escapeHtml(String(snapshot.overview.totalOrders || 0))}</strong>
            </article>
            <article class="admin-mini-stat is-green">
              <span>Finalizados</span>
              <strong>${escapeHtml(String(snapshot.overview.totalFinalized || 0))}</strong>
            </article>
            <article class="admin-mini-stat is-danger">
              <span>Cancelados</span>
              <strong>${escapeHtml(String(snapshot.overview.totalCancelled || 0))}</strong>
            </article>
            <article class="admin-mini-stat is-cyan">
              <span>Retirados</span>
              <strong>${escapeHtml(String(snapshot.overview.totalPickedUp || 0))}</strong>
            </article>
            <article class="admin-mini-stat is-blue">
              <span>Em entrega</span>
              <strong>${escapeHtml(String(snapshot.overview.totalInDelivery || 0))}</strong>
            </article>
            <article class="admin-mini-stat is-gold">
              <span>Taxa de conclusao</span>
              <strong>${escapeHtml(formatPercent(snapshot.overview.completionRate || 0))}</strong>
            </article>
          </section>

          ${comparison ? renderMetricsComparisonCards(comparison) : ""}

          <section class="admin-metrics-chart-grid">
            <article class="admin-module-card">
              <div class="admin-module-card-head">
                <h3>Pedidos por dia</h3>
                <span>Atual x periodo anterior</span>
              </div>
              ${renderMetricsLineChart(charts.ordersByDay?.current || [], charts.ordersByDay?.previous || [], {
                title: "Pedidos por dia",
                currentLabel: comparison?.currentRangeLabel || "Periodo atual",
                previousLabel: comparison?.previousRangeLabel || "Periodo anterior",
              })}
            </article>

            <article class="admin-module-card">
              <div class="admin-module-card-head">
                <h3>Evolucao do periodo</h3>
                <span>Crescimento acumulado</span>
              </div>
              ${renderMetricsLineChart(
                charts.cumulativeOrders?.current || [],
                charts.cumulativeOrders?.previous || [],
                {
                  title: "Evolucao acumulada dos pedidos",
                  currentLabel: comparison?.currentRangeLabel || "Periodo atual",
                  previousLabel: comparison?.previousRangeLabel || "Periodo anterior",
                }
              )}
            </article>
          </section>

          <section class="admin-metrics-chart-grid">
            <article class="admin-module-card">
              <div class="admin-module-card-head">
                <h3>Status dos pedidos</h3>
                <span>Distribuicao visual do recorte</span>
              </div>
              ${renderMetricsDistributionChart(charts.status || [])}
            </article>

            <article class="admin-module-card">
              <div class="admin-module-card-head">
                <h3>Volume por fluxo</h3>
                <span>Entrega, retirada e agendados</span>
              </div>
              ${renderMetricsDistributionChart(charts.flows || [])}
            </article>
          </section>

          <section class="admin-metrics-grid">
            <article class="admin-module-card">
              <div class="admin-module-card-head">
                <h3>Tempo medio entre etapas</h3>
                <span>Base real do fluxo</span>
              </div>
              ${renderMetricsStageList(snapshot.stageMetrics || [])}
            </article>

            <article class="admin-module-card">
              <div class="admin-module-card-head">
                <h3>Destaques de desempenho</h3>
                <span>Quem puxou a operacao</span>
              </div>
              ${renderMetricsHighlights(snapshot)}
            </article>
          </section>

          <section class="admin-metrics-grid">
            <article class="admin-module-card admin-metrics-admin-card">
              <div class="admin-module-card-head">
                <h3>Ranking operacional por admin</h3>
                <span>${escapeHtml(String((snapshot.byAdmin || []).length))} usuario(s) no periodo</span>
              </div>
              ${renderMetricsAdminRows(snapshot.byAdmin || [])}
            </article>

            <article class="admin-module-card">
              <div class="admin-module-card-head">
                <h3>Leitura do recorte</h3>
                <span>Status, fluxo e cobertura</span>
              </div>

              <div class="admin-module-card-head admin-module-card-head-secondary">
                <h3>Status atual</h3>
                <span>Pedidos criados no periodo</span>
              </div>
              ${renderMetricsBreakdownRows(snapshot.statusBreakdown || [])}

              <div class="admin-module-card-head admin-module-card-head-secondary">
                <h3>Fluxos</h3>
                <span>Entrega x retirada x agendamento</span>
              </div>
              ${renderMetricsBreakdownRows(snapshot.flowBreakdown || [])}

              <div class="admin-module-card-head admin-module-card-head-secondary">
                <h3>Efetividade</h3>
                <span>Leitura gerencial rapida</span>
              </div>
              <div class="admin-metrics-breakdown">
                <div class="admin-metrics-breakdown-row">
                  <span>Taxa de cancelamento</span>
                  <strong>${escapeHtml(formatPercent(snapshot.overview.cancellationRate || 0))}</strong>
                </div>
                <div class="admin-metrics-breakdown-row">
                  <span>Cobertura de auditoria</span>
                  <strong>${escapeHtml(formatPercent(snapshot.highlights?.auditCoverageRate || 0))}</strong>
                </div>
                <div class="admin-metrics-breakdown-row">
                  <span>Receita valida</span>
                  <strong>${escapeHtml(formatMoney(snapshot.overview.totalRevenue || 0))}</strong>
                </div>
                <div class="admin-metrics-breakdown-row">
                  <span>Ticket medio</span>
                  <strong>${escapeHtml(formatMoney(snapshot.overview.averageTicket || 0))}</strong>
                </div>
              </div>
            </article>
          </section>
        `
    }
  `;
};

const renderInventoryStatusBadge = (item) => {
  const statusMeta = getInventoryStatusMeta(item.status);

  return `
    <span class="admin-inventory-status ${escapeHtml(statusMeta.className)}">
      <span class="admin-inventory-status-dot" aria-hidden="true"></span>
      ${escapeHtml(statusMeta.label)}
    </span>
  `;
};

const renderInventoryValidity = (item) => {
  const expiration = item.expiration || {};
  const validityClass = expiration.isExpired
    ? "is-expired"
    : expiration.isExpiringSoon
      ? "is-soon"
      : "is-neutral";

  return `
    <span class="admin-inventory-validity ${escapeHtml(validityClass)}">
      ${escapeHtml(expiration.label || "Sem validade")}
    </span>
  `;
};

const renderInventoryItemCard = (item) => {
  const isSelected = adminState.selectedInventoryItemId === item.id;
  const statusMeta = getInventoryStatusMeta(item.status);

  return `
    <article class="admin-inventory-item ${escapeHtml(statusMeta.className)}${isSelected ? " is-selected" : ""}">
      <button
        class="admin-inventory-item-main"
        type="button"
        data-inventory-select="${escapeHtml(item.id)}"
      >
        <div class="admin-inventory-item-top">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <small>${escapeHtml(item.category)}</small>
          </div>
          ${renderInventoryStatusBadge(item)}
        </div>
        <div class="admin-inventory-quantity-row">
          <span>
            <strong>${escapeHtml(formatInventoryQuantity(item.quantity))}</strong>
            ${escapeHtml(item.unit)}
          </span>
          <small>Minimo: ${escapeHtml(formatInventoryQuantity(item.minimumQuantity))} ${escapeHtml(item.unit)}</small>
        </div>
        <div class="admin-inventory-item-footer">
          ${renderInventoryValidity(item)}
          <span>${escapeHtml(item.source === "docx" ? "Importado do checklist" : "Manual")}</span>
        </div>
      </button>
      <div class="admin-inventory-card-actions">
        <button
          class="admin-action-button is-compact is-primary"
          type="button"
          data-inventory-adjust-start="${escapeHtml(item.id)}"
          data-inventory-adjust-intent="add"
        >
          Adicionar estoque
        </button>
        <button
          class="admin-action-button is-compact admin-button-secondary"
          type="button"
          data-inventory-adjust-start="${escapeHtml(item.id)}"
          data-inventory-adjust-intent="remove"
        >
          Dar baixa
        </button>
      </div>
    </article>
  `;
};

const renderInventoryGroups = () => {
  const groups = getInventoryGroups();

  if (adminState.isLoadingInventory && getInventorySnapshot().items.length === 0) {
    return `
      <div class="admin-empty-state admin-empty-state-soft admin-empty-state-loading">
        <strong>Carregando estoque</strong>
        <span>Sincronizando itens, quantidades e validade.</span>
      </div>
    `;
  }

  if (groups.length === 0) {
    return `
      <div class="admin-empty-state admin-empty-state-soft">
        <strong>Nenhum item encontrado</strong>
        <span>Ajuste busca, categoria ou status para ver os itens do estoque.</span>
      </div>
    `;
  }

  return groups
    .map(
      (group) => `
        <section class="admin-inventory-category">
          <div class="admin-inventory-category-head">
            <div>
              <span class="admin-chip">Categoria</span>
              <h3>${escapeHtml(group.category)}</h3>
            </div>
            <strong>${escapeHtml(String(group.items.length))} item(ns)</strong>
          </div>
          <div class="admin-inventory-grid">
            ${group.items.map(renderInventoryItemCard).join("")}
          </div>
        </section>
      `
    )
    .join("");
};

const renderInventoryModule = () => {
  const moduleRoot = document.querySelector("[data-admin-module-content]");
  const snapshot = getInventorySnapshot();
  const summary = snapshot.summary || {};

  if (!moduleRoot) {
    return;
  }

  moduleRoot.innerHTML = `
    <header class="admin-module-head admin-inventory-head">
      <div>
        <span class="admin-chip">Estoque</span>
        <h2>Controle diario de insumos</h2>
        <p>Entradas, baixas manuais, minimo por item e validade em leitura rapida.</p>
      </div>
      <button
        class="admin-button admin-button-primary"
        type="button"
        data-inventory-new
      >
        Novo item
      </button>
    </header>

    <section class="admin-module-kpis admin-module-kpis-wide">
      <article class="admin-mini-stat is-blue">
        <span>Total de itens</span>
        <strong>${escapeHtml(String(summary.totalItems || 0))}</strong>
      </article>
      <article class="admin-mini-stat is-green">
        <span>OK</span>
        <strong>${escapeHtml(String(summary.okItems || 0))}</strong>
      </article>
      <article class="admin-mini-stat is-gold">
        <span>Baixo</span>
        <strong>${escapeHtml(String(summary.lowItems || 0))}</strong>
      </article>
      <article class="admin-mini-stat is-danger">
        <span>Critico</span>
        <strong>${escapeHtml(String(summary.criticalItems || 0))}</strong>
      </article>
      <article class="admin-mini-stat is-warm">
        <span>Validade proxima</span>
        <strong>${escapeHtml(String(summary.expiringSoonItems || 0))}</strong>
      </article>
    </section>

    <section class="admin-inventory-toolbar">
      <label class="admin-field">
        <span>Categoria</span>
        <select class="admin-input" data-inventory-filter="category">
          <option value="">Todas as categorias</option>
          ${snapshot.categories
            .map(
              (category) => `
                <option
                  value="${escapeHtml(category)}"
                  ${category === adminState.inventoryFilters.category ? "selected" : ""}
                >
                  ${escapeHtml(category)}
                </option>
              `
            )
            .join("")}
        </select>
      </label>

      <label class="admin-field">
        <span>Status</span>
        <select class="admin-input" data-inventory-filter="status">
          ${INVENTORY_STATUS_OPTIONS.map(
            (option) => `
              <option
                value="${escapeHtml(option.key)}"
                ${option.key === adminState.inventoryFilters.status ? "selected" : ""}
              >
                ${escapeHtml(option.label)}
              </option>
            `
          ).join("")}
        </select>
      </label>

      <article class="admin-inventory-seed-note">
        <span>Base inicial</span>
        <strong>${escapeHtml(String(snapshot.seedSummary?.items || 0))} produtos do DOCX</strong>
        <small>${escapeHtml(snapshot.sourceDocument || "Checklist importado")}</small>
      </article>
    </section>

    ${adminState.actionMessage ? `<div class="admin-feedback is-${escapeHtml(adminState.actionTone || "success")}">${escapeHtml(adminState.actionMessage)}</div>` : ""}

    <section class="admin-inventory-list">
      ${renderInventoryGroups()}
    </section>
  `;
};

const renderAuditModule = () => {
  const moduleRoot = document.querySelector("[data-admin-module-content]");
  const auditOverview = getAuditOverview();
  const auditEvents = getFilteredAuditEvents();

  if (!moduleRoot) {
    return;
  }

  moduleRoot.innerHTML = `
    <header class="admin-module-head">
      <div>
        <span class="admin-chip">Auditoria</span>
        <h2>Logs operacionais por usuario</h2>
        <p>Trilha real de acoes do gestor conectada aos pedidos em producao.</p>
      </div>
      <div class="admin-module-head-meta">
        <span>Eventos carregados</span>
        <strong>${escapeHtml(String(auditOverview.totalEvents))}</strong>
      </div>
    </header>

    <section class="admin-module-kpis">
      <article class="admin-mini-stat is-blue">
        <span>Usuarios ativos</span>
        <strong>${escapeHtml(String(auditOverview.uniqueAdmins))}</strong>
      </article>
      <article class="admin-mini-stat is-cyan">
        <span>Pedidos auditados</span>
        <strong>${escapeHtml(String(auditOverview.uniqueOrders))}</strong>
      </article>
      <article class="admin-mini-stat is-warm">
        <span>Ultimo evento</span>
        <strong>${escapeHtml(
          auditOverview.lastEventAt ? formatTime(auditOverview.lastEventAt) : "--:--"
        )}</strong>
      </article>
      <article class="admin-mini-stat is-green">
        <span>Limite atual</span>
        <strong>${escapeHtml(String(adminState.auditFilters.limit || 60))}</strong>
      </article>
    </section>

    <section class="admin-audit-toolbar">
      <label class="admin-field">
        <span>Usuario</span>
        <select class="admin-input" name="adminLogin" data-audit-filter="adminLogin">
          <option value="">Todos os usuarios</option>
          ${adminState.auditAdminOptions
            .map(
              (entry) => `
                <option
                  value="${escapeHtml(entry.login)}"
                  ${entry.login === adminState.auditFilters.adminLogin ? "selected" : ""}
                >
                  ${escapeHtml(entry.displayName || entry.login)}
                </option>
              `
            )
            .join("")}
        </select>
      </label>

      <label class="admin-field">
        <span>Acao</span>
        <select class="admin-input" name="action" data-audit-filter="action">
          <option value="">Todas as acoes</option>
          ${adminState.auditActionOptions
            .map(
              (entry) => `
                <option
                  value="${escapeHtml(entry.key)}"
                  ${entry.key === adminState.auditFilters.action ? "selected" : ""}
                >
                  ${escapeHtml(entry.label)}
                </option>
              `
            )
            .join("")}
        </select>
      </label>

      <label class="admin-field">
        <span>Pedido</span>
        <input
          class="admin-input"
          type="search"
          value="${escapeHtml(adminState.auditFilters.orderQuery || "")}"
          placeholder="Buscar por numero, id ou cliente"
          data-audit-filter="orderQuery"
        />
      </label>

      <label class="admin-field">
        <span>Limite</span>
        <select class="admin-input" name="limit" data-audit-filter="limit">
          ${[40, 60, 80, 120].map((value) => `
            <option value="${escapeHtml(String(value))}" ${Number(adminState.auditFilters.limit) === value ? "selected" : ""}>
              ${escapeHtml(String(value))}
            </option>
          `).join("")}
        </select>
      </label>
    </section>

    <section class="admin-module-card admin-audit-panel">
      <div class="admin-module-card-head">
        <h3>Eventos recentes</h3>
        <span>${adminState.isLoadingAudit ? "Atualizando..." : `${auditOverview.totalEvents} registro(s)`}</span>
      </div>
      <div class="admin-audit-list">
        ${adminState.isLoadingAudit && auditEvents.length === 0
          ? `
            <div class="admin-empty-state admin-empty-state-soft admin-empty-state-loading">
              <strong>Carregando auditoria</strong>
              <span>Buscando os eventos reais mais recentes do gestor.</span>
            </div>
          `
          : renderAuditList(auditEvents)}
      </div>
    </section>
  `;
};

const cloneRestaurantSettingsDraft = (settings = RESTAURANT_SETTINGS_DEFAULT_DRAFT) =>
  JSON.parse(JSON.stringify(settings || RESTAURANT_SETTINGS_DEFAULT_DRAFT));

const getRestaurantSettingsDraft = () => {
  if (!adminState.restaurantSettingsDraft) {
    adminState.restaurantSettingsDraft = cloneRestaurantSettingsDraft();
  }

  return adminState.restaurantSettingsDraft;
};

const getRestaurantSettingsSnapshot = () =>
  adminState.restaurantSettingsSnapshot || {
    summary: {
      restaurantKey: RESTAURANT_SETTINGS_DEFAULT_DRAFT.restaurantKey,
      restaurantName: RESTAURANT_SETTINGS_DEFAULT_DRAFT.restaurantName,
      hasLogo: true,
      hasBanner: true,
      whatsappConfigured: true,
      defaultDeliveryFee: RESTAURANT_SETTINGS_DEFAULT_DRAFT.defaultDeliveryFee,
      maxDeliveryRadiusKm: RESTAURANT_SETTINGS_DEFAULT_DRAFT.deliveryBase.maxDeliveryRadiusKm,
      fixedDeliveryFee: RESTAURANT_SETTINGS_DEFAULT_DRAFT.deliveryBase.fixedDeliveryFee,
      pricePerKm: RESTAURANT_SETTINGS_DEFAULT_DRAFT.deliveryBase.pricePerKm,
      minimumDeliveryOrder: RESTAURANT_SETTINGS_DEFAULT_DRAFT.deliveryBase.minimumDeliveryOrder,
      pickupEnabled: RESTAURANT_SETTINGS_DEFAULT_DRAFT.deliveryBase.pickupEnabled,
      deliveryEnabled: RESTAURANT_SETTINGS_DEFAULT_DRAFT.deliveryBase.deliveryEnabled,
      hasDeliveryCoordinates: false,
      averagePreparationTimeMinutes:
        RESTAURANT_SETTINGS_DEFAULT_DRAFT.averagePreparationTimeMinutes,
      businessHours: RESTAURANT_SETTINGS_DEFAULT_DRAFT.businessHours,
      hasStructuredBusinessSchedule: RESTAURANT_SETTINGS_DEFAULT_DRAFT.hasStructuredBusinessSchedule,
      acceptOrdersOutsideHours:
        RESTAURANT_SETTINGS_DEFAULT_DRAFT.businessSchedule.acceptOrdersOutsideHours,
      peakPreparationExtraMinutes:
        RESTAURANT_SETTINGS_DEFAULT_DRAFT.businessSchedule.peakPreparationExtraMinutes,
      updatedAt: "",
    },
    settings: cloneRestaurantSettingsDraft(),
  };

const getRestaurantSettingsField = (root, fieldName) =>
  root?.querySelector(`[data-restaurant-settings-field="${fieldName}"]`) || null;

const normalizeAdminTimeValue = (value, fallback = "") => {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return fallback;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return fallback;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const normalizeAdminDateValue = (value, fallback = "") => {
  const normalizedValue = String(value || "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return normalizedValue;
  }

  return fallback;
};

const createRestaurantSpecialDateDraft = () => ({
  id: createDeliveryDraftId("special-date"),
  date: "",
  name: "",
  isOpen: false,
  openTime: "18:00",
  closeTime: "23:00",
  pauseStart: "",
  pauseEnd: "",
  message: "",
});

const readRestaurantSpecialDatesDraftFromDom = (root, currentSchedule = {}) => {
  const fallbackSpecialDates = Array.isArray(currentSchedule.specialDates)
    ? currentSchedule.specialDates
    : [];

  return Array.from(root?.querySelectorAll("[data-restaurant-special-date-id]") || [])
    .map((row, index) => {
      const fallbackEntry = fallbackSpecialDates[index] || createRestaurantSpecialDateDraft();
      const getSpecialField = (fieldName) =>
        row.querySelector(`[data-restaurant-special-date-field="${fieldName}"]`);

      return {
        id: String(row.dataset.restaurantSpecialDateId || fallbackEntry.id || "").trim() ||
          createDeliveryDraftId("special-date"),
        date: normalizeAdminDateValue(getSpecialField("date")?.value, fallbackEntry.date || ""),
        name: String(getSpecialField("name")?.value || "").trim(),
        isOpen: Boolean(getSpecialField("isOpen")?.checked),
        openTime: normalizeAdminTimeValue(getSpecialField("openTime")?.value, fallbackEntry.openTime || "18:00"),
        closeTime: normalizeAdminTimeValue(getSpecialField("closeTime")?.value, fallbackEntry.closeTime || "23:00"),
        pauseStart: normalizeAdminTimeValue(getSpecialField("pauseStart")?.value, ""),
        pauseEnd: normalizeAdminTimeValue(getSpecialField("pauseEnd")?.value, ""),
        message: String(getSpecialField("message")?.value || "").trim(),
      };
    })
    .sort((left, right) => {
      if (!left.date || !right.date) {
        return left.date ? -1 : right.date ? 1 : 0;
      }

      return left.date.localeCompare(right.date);
    });
};

const readRestaurantBusinessScheduleDraftFromDom = (root, currentSchedule = {}) => {
  const fallbackSchedule =
    currentSchedule && typeof currentSchedule === "object"
      ? currentSchedule
      : RESTAURANT_SETTINGS_DEFAULT_DRAFT.businessSchedule;
  const fallbackDays = fallbackSchedule.days || RESTAURANT_SETTINGS_DEFAULT_DRAFT.businessSchedule.days;
  const days = BUSINESS_SCHEDULE_DAY_KEYS.reduce((scheduleDays, dayKey) => {
    const fallbackDay = fallbackDays[dayKey] || RESTAURANT_SETTINGS_DEFAULT_DRAFT.businessSchedule.days[dayKey];

    scheduleDays[dayKey] = {
      isOpen: Boolean(getRestaurantSettingsField(root, `businessSchedule.days.${dayKey}.isOpen`)?.checked),
      openTime: normalizeAdminTimeValue(
        getRestaurantSettingsField(root, `businessSchedule.days.${dayKey}.openTime`)?.value,
        fallbackDay.openTime
      ),
      closeTime: normalizeAdminTimeValue(
        getRestaurantSettingsField(root, `businessSchedule.days.${dayKey}.closeTime`)?.value,
        fallbackDay.closeTime
      ),
      pauseStart: normalizeAdminTimeValue(
        getRestaurantSettingsField(root, `businessSchedule.days.${dayKey}.pauseStart`)?.value,
        ""
      ),
      pauseEnd: normalizeAdminTimeValue(
        getRestaurantSettingsField(root, `businessSchedule.days.${dayKey}.pauseEnd`)?.value,
        ""
      ),
    };

    return scheduleDays;
  }, {});

  return {
    ...fallbackSchedule,
    acceptOrdersOutsideHours: Boolean(
      getRestaurantSettingsField(root, "businessSchedule.acceptOrdersOutsideHours")?.checked
    ),
    closedMessage: String(
      getRestaurantSettingsField(root, "businessSchedule.closedMessage")?.value || ""
    ).trim(),
    peakPreparationExtraMinutes: Math.max(
      0,
      Math.round(
        normalizeAdminNumber(
          getRestaurantSettingsField(root, "businessSchedule.peakPreparationExtraMinutes")?.value,
          0
        )
      )
    ),
    specialDates: readRestaurantSpecialDatesDraftFromDom(root, fallbackSchedule),
    days,
  };
};

const readRestaurantSettingsDraftFromDom = () => {
  const root = document.querySelector("[data-restaurant-settings-root]");
  const currentDraft = cloneRestaurantSettingsDraft(getRestaurantSettingsDraft());

  if (!root) {
    return currentDraft;
  }

  return {
    ...currentDraft,
    restaurantName: String(getRestaurantSettingsField(root, "restaurantName")?.value || "").trim(),
    logoUrl: String(getRestaurantSettingsField(root, "logoUrl")?.value || "").trim(),
    bannerUrl: String(getRestaurantSettingsField(root, "bannerUrl")?.value || "").trim(),
    primaryColor: String(getRestaurantSettingsField(root, "primaryColor")?.value || "").trim(),
    secondaryColor: String(getRestaurantSettingsField(root, "secondaryColor")?.value || "").trim(),
    accentColor: String(getRestaurantSettingsField(root, "accentColor")?.value || "").trim(),
    gradientStart: String(getRestaurantSettingsField(root, "gradientStart")?.value || "").trim(),
    gradientEnd: String(getRestaurantSettingsField(root, "gradientEnd")?.value || "").trim(),
    useGradient: Boolean(getRestaurantSettingsField(root, "useGradient")?.checked),
    siteLayout: String(getRestaurantSettingsField(root, "siteLayout")?.value || "MODERN").trim(),
    siteTheme: String(getRestaurantSettingsField(root, "siteTheme")?.value || "DARK").trim(),
    slogan: String(getRestaurantSettingsField(root, "slogan")?.value || "").trim(),
    description: String(getRestaurantSettingsField(root, "description")?.value || "").trim(),
    instagram: String(getRestaurantSettingsField(root, "instagram")?.value || "").trim(),
    facebook: String(getRestaurantSettingsField(root, "facebook")?.value || "").trim(),
    tiktok: String(getRestaurantSettingsField(root, "tiktok")?.value || "").trim(),
    site: String(getRestaurantSettingsField(root, "site")?.value || "").trim(),
    seoTitle: String(getRestaurantSettingsField(root, "seoTitle")?.value || "").trim(),
    seoDescription: String(getRestaurantSettingsField(root, "seoDescription")?.value || "").trim(),
    seoShareImage: String(getRestaurantSettingsField(root, "seoShareImage")?.value || "").trim(),
    seoKeywords: String(getRestaurantSettingsField(root, "seoKeywords")?.value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
    seoOpenGraph: {
      ...(currentDraft.seoOpenGraph || RESTAURANT_SETTINGS_DEFAULT_DRAFT.seoOpenGraph),
      title: String(getRestaurantSettingsField(root, "seoOpenGraph.title")?.value || "").trim(),
      description: String(getRestaurantSettingsField(root, "seoOpenGraph.description")?.value || "").trim(),
      image: String(getRestaurantSettingsField(root, "seoOpenGraph.image")?.value || "").trim(),
      type: String(getRestaurantSettingsField(root, "seoOpenGraph.type")?.value || "website").trim(),
    },
    platformFooter: {
      ...(currentDraft.platformFooter || RESTAURANT_SETTINGS_DEFAULT_DRAFT.platformFooter),
      showPlatformBranding: true,
      brandName: String(getRestaurantSettingsField(root, "platformFooter.brandName")?.value || "").trim(),
      headline: String(getRestaurantSettingsField(root, "platformFooter.headline")?.value || "").trim(),
      description: String(getRestaurantSettingsField(root, "platformFooter.description")?.value || "").trim(),
      url: String(getRestaurantSettingsField(root, "platformFooter.url")?.value || "").trim(),
      displayUrl: String(getRestaurantSettingsField(root, "platformFooter.displayUrl")?.value || "").trim(),
    },
    whatsapp: String(getRestaurantSettingsField(root, "whatsapp")?.value || "").trim(),
    addressFields: {
      ...(currentDraft.addressFields || {}),
      postalCode: String(getRestaurantSettingsField(root, "addressFields.postalCode")?.value || "").trim(),
      street: String(getRestaurantSettingsField(root, "addressFields.street")?.value || "").trim(),
      number: String(getRestaurantSettingsField(root, "addressFields.number")?.value || "").trim(),
      complement: String(getRestaurantSettingsField(root, "addressFields.complement")?.value || "").trim(),
      neighborhood: String(getRestaurantSettingsField(root, "addressFields.neighborhood")?.value || "").trim(),
      city: String(getRestaurantSettingsField(root, "addressFields.city")?.value || "").trim(),
      state: String(getRestaurantSettingsField(root, "addressFields.state")?.value || "").trim(),
    },
    deliveryBase: {
      ...(currentDraft.deliveryBase || {}),
      latitude: String(getRestaurantSettingsField(root, "deliveryBase.latitude")?.value || "").trim(),
      longitude: String(getRestaurantSettingsField(root, "deliveryBase.longitude")?.value || "").trim(),
      maxDeliveryRadiusKm: Math.max(
        0,
        normalizeAdminNumber(getRestaurantSettingsField(root, "deliveryBase.maxDeliveryRadiusKm")?.value, 0)
      ),
      fixedDeliveryFee: Math.max(
        0,
        normalizeAdminNumber(getRestaurantSettingsField(root, "deliveryBase.fixedDeliveryFee")?.value, 0)
      ),
      pricePerKm: Math.max(
        0,
        normalizeAdminNumber(getRestaurantSettingsField(root, "deliveryBase.pricePerKm")?.value, 0)
      ),
      minimumDeliveryOrder: Math.max(
        0,
        normalizeAdminNumber(getRestaurantSettingsField(root, "deliveryBase.minimumDeliveryOrder")?.value, 0)
      ),
      pickupEnabled: Boolean(getRestaurantSettingsField(root, "deliveryBase.pickupEnabled")?.checked),
      deliveryEnabled: Boolean(getRestaurantSettingsField(root, "deliveryBase.deliveryEnabled")?.checked),
    },
    businessHours: String(getRestaurantSettingsField(root, "businessHours")?.value || "").trim(),
    businessSchedule: readRestaurantBusinessScheduleDraftFromDom(
      root,
      currentDraft.businessSchedule || RESTAURANT_SETTINGS_DEFAULT_DRAFT.businessSchedule
    ),
    hasStructuredBusinessSchedule: true,
    defaultDeliveryFee: Math.max(
      0,
      normalizeAdminNumber(getRestaurantSettingsField(root, "deliveryBase.fixedDeliveryFee")?.value, 0)
    ),
    averagePreparationTimeMinutes: Math.max(
      0,
      Math.round(
        normalizeAdminNumber(
          getRestaurantSettingsField(root, "averagePreparationTimeMinutes")?.value,
          0
        )
      )
    ),
    presentationText: String(getRestaurantSettingsField(root, "presentationText")?.value || "").trim(),
  };
};

const syncRestaurantSettingsDraftFromDom = () => {
  adminState.restaurantSettingsDraft = readRestaurantSettingsDraftFromDom();
  return adminState.restaurantSettingsDraft;
};

const renderRestaurantSettingsField = ({
  label,
  field,
  value,
  type = "text",
  step = "",
  placeholder = "",
  disabled = false,
}) => `
  <label class="admin-delivery-field">
    <span>${escapeHtml(label)}</span>
    <input
      class="admin-input"
      type="${escapeHtml(type)}"
      ${step ? `step="${escapeHtml(step)}"` : ""}
      data-restaurant-settings-field="${escapeHtml(field)}"
      value="${escapeHtml(value)}"
      placeholder="${escapeHtml(placeholder)}"
      ${disabled ? "disabled" : ""}
    />
  </label>
`;

const renderRestaurantSettingsSelect = ({
  label,
  field,
  value,
  options = [],
  disabled = false,
}) => `
  <label class="admin-delivery-field">
    <span>${escapeHtml(label)}</span>
    <select
      class="admin-input"
      data-restaurant-settings-field="${escapeHtml(field)}"
      ${disabled ? "disabled" : ""}
    >
      ${options
        .map(
          (option) => `
            <option value="${escapeHtml(option.key)}" ${option.key === value ? "selected" : ""}>
              ${escapeHtml(option.label)}
            </option>
          `
        )
        .join("")}
    </select>
  </label>
`;

const renderRestaurantSettingsTextarea = ({
  label,
  field,
  value,
  placeholder = "",
  disabled = false,
}) => `
  <label class="admin-delivery-field is-wide">
    <span>${escapeHtml(label)}</span>
    <textarea
      class="admin-input admin-textarea"
      data-restaurant-settings-field="${escapeHtml(field)}"
      placeholder="${escapeHtml(placeholder)}"
      ${disabled ? "disabled" : ""}
    >${escapeHtml(value)}</textarea>
  </label>
`;

const renderRestaurantSettingsToggle = ({ label, field, checked, disabled = false }) => `
  <label class="admin-delivery-toggle">
    <input
      type="checkbox"
      data-restaurant-settings-field="${escapeHtml(field)}"
      ${checked ? "checked" : ""}
      ${disabled ? "disabled" : ""}
    />
    <span>${escapeHtml(label)}</span>
  </label>
`;

const renderRestaurantScheduleDayRow = (dayKey, day = {}, isBusy = false) => `
  <div class="admin-settings-schedule-row">
    <div class="admin-settings-schedule-day">
      <strong>${escapeHtml(BUSINESS_SCHEDULE_DAY_LABELS[dayKey] || dayKey)}</strong>
      ${renderRestaurantSettingsToggle({
        label: "Aberto",
        field: `businessSchedule.days.${dayKey}.isOpen`,
        checked: day.isOpen !== false,
        disabled: isBusy,
      })}
    </div>
    ${renderRestaurantSettingsField({
      label: "Abertura",
      field: `businessSchedule.days.${dayKey}.openTime`,
      value: day.openTime || "18:00",
      type: "time",
      disabled: isBusy,
    })}
    ${renderRestaurantSettingsField({
      label: "Fechamento",
      field: `businessSchedule.days.${dayKey}.closeTime`,
      value: day.closeTime || "23:00",
      type: "time",
      disabled: isBusy,
    })}
    ${renderRestaurantSettingsField({
      label: "Pausa 1 inicio",
      field: `businessSchedule.days.${dayKey}.pauseStart`,
      value: day.pauseStart || "",
      type: "time",
      disabled: isBusy,
    })}
    ${renderRestaurantSettingsField({
      label: "Pausa 1 fim",
      field: `businessSchedule.days.${dayKey}.pauseEnd`,
      value: day.pauseEnd || "",
      type: "time",
      disabled: isBusy,
    })}
  </div>
`;

const renderRestaurantSpecialDateRow = (entry = {}, index = 0, isBusy = false) => {
  const specialDateId =
    String(entry.id || "").trim() || `special-date-render-${index}`;

  return `
    <div class="admin-settings-special-date-row" data-restaurant-special-date-id="${escapeHtml(specialDateId)}">
      ${renderRestaurantSettingsField({
        label: "Data",
        field: `businessSchedule.specialDates.${index}.date`,
        value: entry.date || "",
        type: "date",
        disabled: isBusy,
      }).replace(
        "data-restaurant-settings-field",
        "data-restaurant-special-date-field"
      ).replace(
        `businessSchedule.specialDates.${index}.date`,
        "date"
      )}
      ${renderRestaurantSettingsField({
        label: "Nome/descricao",
        field: `businessSchedule.specialDates.${index}.name`,
        value: entry.name || "",
        placeholder: "Feriado, evento, manutencao...",
        disabled: isBusy,
      }).replace(
        "data-restaurant-settings-field",
        "data-restaurant-special-date-field"
      ).replace(
        `businessSchedule.specialDates.${index}.name`,
        "name"
      )}
      ${renderRestaurantSettingsToggle({
        label: "Aberto nesta data",
        field: `businessSchedule.specialDates.${index}.isOpen`,
        checked: entry.isOpen === true,
        disabled: isBusy,
      }).replace(
        "data-restaurant-settings-field",
        "data-restaurant-special-date-field"
      ).replace(
        `businessSchedule.specialDates.${index}.isOpen`,
        "isOpen"
      )}
      ${renderRestaurantSettingsField({
        label: "Abertura especial",
        field: `businessSchedule.specialDates.${index}.openTime`,
        value: entry.openTime || "18:00",
        type: "time",
        disabled: isBusy,
      }).replace(
        "data-restaurant-settings-field",
        "data-restaurant-special-date-field"
      ).replace(
        `businessSchedule.specialDates.${index}.openTime`,
        "openTime"
      )}
      ${renderRestaurantSettingsField({
        label: "Fechamento especial",
        field: `businessSchedule.specialDates.${index}.closeTime`,
        value: entry.closeTime || "23:00",
        type: "time",
        disabled: isBusy,
      }).replace(
        "data-restaurant-settings-field",
        "data-restaurant-special-date-field"
      ).replace(
        `businessSchedule.specialDates.${index}.closeTime`,
        "closeTime"
      )}
      ${renderRestaurantSettingsField({
        label: "Pausa especial inicio",
        field: `businessSchedule.specialDates.${index}.pauseStart`,
        value: entry.pauseStart || "",
        type: "time",
        disabled: isBusy,
      }).replace(
        "data-restaurant-settings-field",
        "data-restaurant-special-date-field"
      ).replace(
        `businessSchedule.specialDates.${index}.pauseStart`,
        "pauseStart"
      )}
      ${renderRestaurantSettingsField({
        label: "Pausa especial fim",
        field: `businessSchedule.specialDates.${index}.pauseEnd`,
        value: entry.pauseEnd || "",
        type: "time",
        disabled: isBusy,
      }).replace(
        "data-restaurant-settings-field",
        "data-restaurant-special-date-field"
      ).replace(
        `businessSchedule.specialDates.${index}.pauseEnd`,
        "pauseEnd"
      )}
      <button
        class="admin-button admin-button-secondary"
        type="button"
        data-restaurant-settings-action="remove-special-date"
        data-restaurant-special-date-id="${escapeHtml(specialDateId)}"
        ${isBusy ? "disabled" : ""}
      >
        Remover
      </button>
      ${renderRestaurantSettingsTextarea({
        label: "Mensagem especial para o cliente",
        field: `businessSchedule.specialDates.${index}.message`,
        value: entry.message || "",
        placeholder: "Mensagem exibida no site quando esta data estiver ativa.",
        disabled: isBusy,
      }).replace(
        "data-restaurant-settings-field",
        "data-restaurant-special-date-field"
      ).replace(
        `businessSchedule.specialDates.${index}.message`,
        "message"
      )}
    </div>
  `;
};

const getRestaurantSettingsAppearancePreviewDraft = () => {
  const draft = getRestaurantSettingsDraft();

  return {
    layout: String(draft.siteLayout || RESTAURANT_SETTINGS_DEFAULT_DRAFT.siteLayout || "MODERN").toUpperCase(),
    theme: String(draft.siteTheme || RESTAURANT_SETTINGS_DEFAULT_DRAFT.siteTheme || "DARK").toUpperCase(),
    restaurantName: draft.restaurantName || RESTAURANT_SETTINGS_DEFAULT_DRAFT.restaurantName,
    slogan: draft.slogan || RESTAURANT_SETTINGS_DEFAULT_DRAFT.slogan,
    description:
      draft.description ||
      draft.presentationText ||
      RESTAURANT_SETTINGS_DEFAULT_DRAFT.description,
    logoUrl: resolveAdminAssetUrl(draft.logoUrl || RESTAURANT_SETTINGS_DEFAULT_DRAFT.logoUrl),
    bannerUrl: resolveAdminAssetUrl(draft.bannerUrl || RESTAURANT_SETTINGS_DEFAULT_DRAFT.bannerUrl),
    primaryColor: draft.primaryColor || RESTAURANT_SETTINGS_DEFAULT_DRAFT.primaryColor,
    secondaryColor: draft.secondaryColor || RESTAURANT_SETTINGS_DEFAULT_DRAFT.secondaryColor,
    accentColor: draft.accentColor || RESTAURANT_SETTINGS_DEFAULT_DRAFT.accentColor,
    gradientStart: draft.gradientStart || RESTAURANT_SETTINGS_DEFAULT_DRAFT.gradientStart,
    gradientEnd: draft.gradientEnd || RESTAURANT_SETTINGS_DEFAULT_DRAFT.gradientEnd,
    useGradient: draft.useGradient !== false,
    footer:
      draft.platformFooter ||
      RESTAURANT_SETTINGS_DEFAULT_DRAFT.platformFooter,
  };
};

const refreshRestaurantSettingsAppearancePreview = () => {
  const preview = document.querySelector("[data-site-appearance-preview]");

  if (!preview) {
    return;
  }

  const draft = getRestaurantSettingsAppearancePreviewDraft();
  preview.dataset.previewLayout = draft.layout.toLowerCase();
  preview.dataset.previewTheme = draft.theme.toLowerCase();
  preview.style.setProperty("--preview-primary", draft.primaryColor);
  preview.style.setProperty("--preview-secondary", draft.secondaryColor);
  preview.style.setProperty("--preview-accent", draft.accentColor);
  preview.style.setProperty("--preview-gradient-start", draft.gradientStart);
  preview.style.setProperty("--preview-gradient-end", draft.gradientEnd);
  preview.classList.toggle("uses-gradient", draft.useGradient);

  const logo = preview.querySelector("[data-preview-logo]");
  const banner = preview.querySelector("[data-preview-banner]");

  if (logo) {
    logo.src = draft.logoUrl;
    logo.alt = `Logo ${draft.restaurantName}`;
  }

  if (banner) {
    banner.src = draft.bannerUrl;
    banner.alt = `Banner ${draft.restaurantName}`;
  }

  const setText = (selector, value) => {
    const node = preview.querySelector(selector);

    if (node) {
      node.textContent = value;
    }
  };

  setText("[data-preview-layout]", draft.layout);
  setText("[data-preview-theme]", draft.theme);
  setText("[data-preview-name]", draft.restaurantName);
  setText("[data-preview-slogan]", draft.slogan);
  setText("[data-preview-description]", draft.description);
  setText("[data-preview-footer-headline]", draft.footer.headline || "Desenvolvido por INovas Food");
  setText(
    "[data-preview-footer-description]",
    draft.footer.description || "Plataforma profissional para restaurantes"
  );
};

const renderRestaurantAppearancePreview = () => {
  const draft = getRestaurantSettingsAppearancePreviewDraft();

  return `
    <div
      class="admin-site-appearance-preview uses-gradient"
      data-site-appearance-preview
      data-preview-layout="${escapeHtml(draft.layout.toLowerCase())}"
      data-preview-theme="${escapeHtml(draft.theme.toLowerCase())}"
      style="--preview-primary:${escapeHtml(draft.primaryColor)};--preview-secondary:${escapeHtml(draft.secondaryColor)};--preview-accent:${escapeHtml(draft.accentColor)};--preview-gradient-start:${escapeHtml(draft.gradientStart)};--preview-gradient-end:${escapeHtml(draft.gradientEnd)};"
    >
      <div class="admin-site-preview-hero">
        <img src="${escapeHtml(draft.bannerUrl)}" alt="Previa do banner publico" data-preview-banner loading="lazy" />
        <div>
          <span data-preview-layout>${escapeHtml(draft.layout)}</span>
          <strong data-preview-name>${escapeHtml(draft.restaurantName)}</strong>
          <small data-preview-slogan>${escapeHtml(draft.slogan)}</small>
        </div>
      </div>
      <div class="admin-site-preview-body">
        <img src="${escapeHtml(draft.logoUrl)}" alt="Previa do logo publico" data-preview-logo loading="lazy" />
        <p data-preview-description>${escapeHtml(draft.description)}</p>
        <div class="admin-site-preview-swatches" aria-label="Paleta configurada">
          <span style="background:${escapeHtml(draft.primaryColor)}"></span>
          <span style="background:${escapeHtml(draft.secondaryColor)}"></span>
          <span style="background:${escapeHtml(draft.accentColor)}"></span>
        </div>
        <div class="admin-site-preview-theme">
          <span>Tema</span>
          <strong data-preview-theme>${escapeHtml(draft.theme)}</strong>
        </div>
      </div>
      <footer class="admin-site-preview-footer">
        <strong data-preview-footer-headline>${escapeHtml(draft.footer.headline || "Desenvolvido por INovas Food")}</strong>
        <span data-preview-footer-description>${escapeHtml(draft.footer.description || "Plataforma profissional para restaurantes")}</span>
      </footer>
    </div>
  `;
};

const renderRestaurantSettingsModule = () => {
  const moduleRoot = document.querySelector("[data-admin-module-content]");

  if (!moduleRoot) {
    return;
  }

  const snapshot = getRestaurantSettingsSnapshot();
  const summary = snapshot.summary || {};
  const draft = getRestaurantSettingsDraft();
  const isBusy = adminState.isLoadingRestaurantSettings || adminState.restaurantSettingsSaving;
  const updatedLabel = draft.updatedAt ? formatDateTime(draft.updatedAt) : "Ainda nao salvo";
  const logoPreview = resolveAdminAssetUrl(draft.logoUrl || RESTAURANT_SETTINGS_DEFAULT_DRAFT.logoUrl);
  const bannerPreview = resolveAdminAssetUrl(draft.bannerUrl || RESTAURANT_SETTINGS_DEFAULT_DRAFT.bannerUrl);
  const addressFields = draft.addressFields || RESTAURANT_SETTINGS_DEFAULT_DRAFT.addressFields;
  const deliveryBase = draft.deliveryBase || RESTAURANT_SETTINGS_DEFAULT_DRAFT.deliveryBase;
  const businessSchedule =
    draft.businessSchedule || RESTAURANT_SETTINGS_DEFAULT_DRAFT.businessSchedule;
  const businessScheduleDays =
    businessSchedule.days || RESTAURANT_SETTINGS_DEFAULT_DRAFT.businessSchedule.days;
  const specialDates = Array.isArray(businessSchedule.specialDates)
    ? businessSchedule.specialDates
    : [];
  const friendlyAddress =
    draft.address ||
    [
      [addressFields.street, addressFields.number].filter(Boolean).join(", "),
      addressFields.complement,
      addressFields.neighborhood,
      [addressFields.city, addressFields.state].filter(Boolean).join(" - "),
      addressFields.postalCode ? `CEP ${addressFields.postalCode}` : "",
    ]
      .filter(Boolean)
      .join(", ");

  moduleRoot.innerHTML = `
    <header class="admin-module-head">
      <div>
        <span class="admin-chip">Configuracoes do site publico</span>
        <h2>Personalizacao do restaurante</h2>
        <p>Esses ajustes afetam somente o site do cliente. O painel administrativo mantem sua identidade visual fixa.</p>
      </div>
      <div class="admin-module-head-meta">
        <span>Ultima atualizacao</span>
        <strong>${escapeHtml(adminState.isLoadingRestaurantSettings ? "Carregando..." : updatedLabel)}</strong>
      </div>
    </header>

    <section class="admin-module-kpis">
      <article class="admin-mini-stat is-blue">
        <span>Restaurante</span>
        <strong>${escapeHtml(summary.restaurantName || draft.restaurantName || "Site")}</strong>
      </article>
      <article class="admin-mini-stat is-cyan">
        <span>Chave atual</span>
        <strong>${escapeHtml(summary.restaurantKey || draft.restaurantKey || "default")}</strong>
      </article>
      <article class="admin-mini-stat is-gold">
        <span>Raio maximo</span>
        <strong>${escapeHtml(String(deliveryBase.maxDeliveryRadiusKm || 0).replace(".", ","))} km</strong>
      </article>
      <article class="admin-mini-stat is-warm">
        <span>Pedidos fora do horario</span>
        <strong>${escapeHtml(businessSchedule.acceptOrdersOutsideHours ? "Aceita" : "Nao aceita")}</strong>
      </article>
    </section>

    <section class="admin-delivery-settings admin-restaurant-settings" data-restaurant-settings-root>
      ${
        adminState.actionMessage
          ? `<div class="admin-feedback is-${escapeHtml(adminState.actionTone || "success")}">${escapeHtml(adminState.actionMessage)}</div>`
          : ""
      }

      <div class="admin-delivery-savebar">
        <div>
          <strong>Fonte de personalizacao do site publico</strong>
          <span>Preparado para futura migracao: restaurant_key ${escapeHtml(draft.restaurantKey || "default")}</span>
        </div>
        <div class="admin-delivery-savebar-actions">
          <button class="admin-button admin-button-secondary" type="button" data-restaurant-settings-action="reset" ${isBusy ? "disabled" : ""}>Descartar alteracoes</button>
          <button class="admin-button admin-button-primary" type="button" data-restaurant-settings-action="save" ${isBusy ? "disabled" : ""}>
            ${adminState.restaurantSettingsSaving ? "Salvando..." : "Salvar configuracoes"}
          </button>
        </div>
      </div>

      <article class="admin-delivery-card is-wide">
        <header class="admin-delivery-card-head">
          <div>
            <span class="admin-chip">Identidade</span>
            <h3>Marca e imagens principais</h3>
            <p>Use caminhos locais, URLs HTTPS ou imagens hospedadas. Estes campos aparecem apenas no site publico.</p>
          </div>
        </header>
        <div class="admin-delivery-form-grid">
          ${renderRestaurantSettingsField({ label: "Nome do restaurante", field: "restaurantName", value: draft.restaurantName || "", placeholder: RESTAURANT_SETTINGS_DEFAULT_DRAFT.restaurantName, disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Logo", field: "logoUrl", value: draft.logoUrl || "", placeholder: "./site-images/logo.png", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Banner principal", field: "bannerUrl", value: draft.bannerUrl || "", placeholder: "./site-images/banner.png", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Slogan", field: "slogan", value: draft.slogan || "", placeholder: RESTAURANT_SETTINGS_DEFAULT_DRAFT.slogan, disabled: isBusy })}
          ${renderRestaurantSettingsTextarea({ label: "Descricao publica", field: "description", value: draft.description || "", placeholder: "Descricao institucional exibida no site publico.", disabled: isBusy })}
          ${renderRestaurantSettingsTextarea({ label: "Texto de apresentacao", field: "presentationText", value: draft.presentationText || "", placeholder: "Texto exibido na home e no rodape do site.", disabled: isBusy })}
        </div>
        <div class="admin-settings-preview-grid">
          <figure class="admin-settings-media-preview">
            <span>Logo atual</span>
            <img src="${escapeHtml(logoPreview)}" alt="Previa do logo configurado" loading="lazy" />
          </figure>
          <figure class="admin-settings-media-preview is-banner">
            <span>Banner atual</span>
            <img src="${escapeHtml(bannerPreview)}" alt="Previa do banner configurado" loading="lazy" />
          </figure>
        </div>
      </article>

      <article class="admin-delivery-card is-wide">
        <header class="admin-delivery-card-head">
          <div>
            <span class="admin-chip">Aparencia do Site</span>
            <h3>Layouts, tema e preview</h3>
            <p>Selecione a experiencia publica do restaurante. O Gestor permanece com a identidade administrativa atual.</p>
          </div>
        </header>
        <div class="admin-appearance-grid">
          <div class="admin-delivery-form-grid">
            ${renderRestaurantSettingsSelect({ label: "Layout publico", field: "siteLayout", value: draft.siteLayout || RESTAURANT_SETTINGS_DEFAULT_DRAFT.siteLayout, options: PUBLIC_SITE_LAYOUT_OPTIONS, disabled: isBusy })}
            ${renderRestaurantSettingsSelect({ label: "Tema publico", field: "siteTheme", value: draft.siteTheme || RESTAURANT_SETTINGS_DEFAULT_DRAFT.siteTheme, options: PUBLIC_SITE_THEME_OPTIONS, disabled: isBusy })}
            <div class="admin-settings-layout-help is-wide">
              ${PUBLIC_SITE_LAYOUT_OPTIONS.map((option) => `
                <article>
                  <strong>${escapeHtml(option.label)}</strong>
                  <span>${escapeHtml(option.helper)}</span>
                </article>
              `).join("")}
            </div>
          </div>
          ${renderRestaurantAppearancePreview()}
        </div>
      </article>

      <article class="admin-delivery-card">
        <header class="admin-delivery-card-head">
          <div>
            <span class="admin-chip">Cores do site</span>
            <h3>Paleta publica</h3>
          </div>
        </header>
        <div class="admin-delivery-form-grid">
          ${renderRestaurantSettingsField({ label: "Cor principal", field: "primaryColor", value: draft.primaryColor || "", type: "color", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Cor secundaria", field: "secondaryColor", value: draft.secondaryColor || "", type: "color", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Cor destaque", field: "accentColor", value: draft.accentColor || RESTAURANT_SETTINGS_DEFAULT_DRAFT.accentColor, type: "color", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Gradiente inicio", field: "gradientStart", value: draft.gradientStart || RESTAURANT_SETTINGS_DEFAULT_DRAFT.gradientStart, type: "color", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Gradiente fim", field: "gradientEnd", value: draft.gradientEnd || RESTAURANT_SETTINGS_DEFAULT_DRAFT.gradientEnd, type: "color", disabled: isBusy })}
          ${renderRestaurantSettingsToggle({ label: "Usar gradiente no destaque visual", field: "useGradient", checked: draft.useGradient !== false, disabled: isBusy })}
          <div class="admin-settings-color-preview is-wide">
            <span style="background:${escapeHtml(draft.primaryColor || RESTAURANT_SETTINGS_DEFAULT_DRAFT.primaryColor)}"></span>
            <span style="background:${escapeHtml(draft.secondaryColor || RESTAURANT_SETTINGS_DEFAULT_DRAFT.secondaryColor)}"></span>
            <span style="background:${escapeHtml(draft.accentColor || RESTAURANT_SETTINGS_DEFAULT_DRAFT.accentColor)}"></span>
            <span style="background:linear-gradient(135deg, ${escapeHtml(draft.gradientStart || RESTAURANT_SETTINGS_DEFAULT_DRAFT.gradientStart)}, ${escapeHtml(draft.gradientEnd || RESTAURANT_SETTINGS_DEFAULT_DRAFT.gradientEnd)})"></span>
            <strong>As cores sao aplicadas no site publico apos salvar.</strong>
          </div>
        </div>
      </article>

      <article class="admin-delivery-card">
        <header class="admin-delivery-card-head">
          <div>
            <span class="admin-chip">Contato e local</span>
            <h3>Atendimento e funcionamento</h3>
          </div>
        </header>
        <div class="admin-delivery-form-grid">
          ${renderRestaurantSettingsField({ label: "WhatsApp", field: "whatsapp", value: draft.whatsapp || "", placeholder: "5516999999999", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Horario em texto (fallback)", field: "businessHours", value: draft.businessHours || "", placeholder: "18:00 as 23:00", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Instagram", field: "instagram", value: draft.instagram || "", placeholder: "https://instagram.com/restaurante", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Facebook", field: "facebook", value: draft.facebook || "", placeholder: "https://facebook.com/restaurante", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "TikTok", field: "tiktok", value: draft.tiktok || "", placeholder: "https://tiktok.com/@restaurante", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Site", field: "site", value: draft.site || "", placeholder: "https://restaurante.com.br", disabled: isBusy })}
        </div>
      </article>

      <article class="admin-delivery-card is-wide">
        <header class="admin-delivery-card-head">
          <div>
            <span class="admin-chip">SEO</span>
            <h3>Titulo, compartilhamento e OpenGraph</h3>
            <p>Configura metadados do site publico sem alterar URLs, dominio ou rotas existentes.</p>
          </div>
        </header>
        <div class="admin-delivery-form-grid">
          ${renderRestaurantSettingsField({ label: "Titulo da pagina", field: "seoTitle", value: draft.seoTitle || "", placeholder: RESTAURANT_SETTINGS_DEFAULT_DRAFT.seoTitle, disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Imagem de compartilhamento", field: "seoShareImage", value: draft.seoShareImage || "", placeholder: "/site-images/combinado-imperial.png", disabled: isBusy })}
          ${renderRestaurantSettingsTextarea({ label: "Descricao SEO", field: "seoDescription", value: draft.seoDescription || "", placeholder: "Descricao exibida em buscadores e compartilhamentos.", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Keywords", field: "seoKeywords", value: (draft.seoKeywords || []).join(", "), placeholder: "sushi, delivery, restaurante", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "OpenGraph titulo", field: "seoOpenGraph.title", value: draft.seoOpenGraph?.title || "", placeholder: draft.seoTitle || RESTAURANT_SETTINGS_DEFAULT_DRAFT.seoTitle, disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "OpenGraph imagem", field: "seoOpenGraph.image", value: draft.seoOpenGraph?.image || "", placeholder: draft.seoShareImage || RESTAURANT_SETTINGS_DEFAULT_DRAFT.seoShareImage, disabled: isBusy })}
          ${renderRestaurantSettingsTextarea({ label: "OpenGraph descricao", field: "seoOpenGraph.description", value: draft.seoOpenGraph?.description || "", placeholder: "Descricao usada ao compartilhar o site.", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "OpenGraph tipo", field: "seoOpenGraph.type", value: draft.seoOpenGraph?.type || "website", placeholder: "website", disabled: isBusy })}
        </div>
      </article>

      <article class="admin-delivery-card is-wide">
        <header class="admin-delivery-card-head">
          <div>
            <span class="admin-chip">Rodape INovas</span>
            <h3>Marca institucional da plataforma</h3>
            <p>A marca permanece sempre visivel nesta etapa. A flag showPlatformBranding fica preparada para uso futuro.</p>
          </div>
        </header>
        <div class="admin-delivery-form-grid">
          ${renderRestaurantSettingsField({ label: "Nome da plataforma", field: "platformFooter.brandName", value: draft.platformFooter?.brandName || "", placeholder: "INovas Food", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Chamada do rodape", field: "platformFooter.headline", value: draft.platformFooter?.headline || "", placeholder: "Desenvolvido por INovas Food", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "URL", field: "platformFooter.url", value: draft.platformFooter?.url || "", placeholder: "https://www.inovasfood.com.br", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "URL exibida", field: "platformFooter.displayUrl", value: draft.platformFooter?.displayUrl || "", placeholder: "www.inovasfood.com.br", disabled: isBusy })}
          ${renderRestaurantSettingsTextarea({ label: "Descricao institucional", field: "platformFooter.description", value: draft.platformFooter?.description || "", placeholder: "Plataforma profissional para restaurantes", disabled: isBusy })}
        </div>
      </article>

      <article class="admin-delivery-card is-wide">
        <header class="admin-delivery-card-head">
          <div>
            <span class="admin-chip">Horario estruturado</span>
            <h3>Funcionamento por dia da semana</h3>
            <p>O site publico usa esta grade para identificar loja aberta ou fechada. O texto acima continua como fallback.</p>
          </div>
        </header>
        <div class="admin-settings-schedule-list">
          ${BUSINESS_SCHEDULE_DAY_KEYS.map((dayKey) =>
            renderRestaurantScheduleDayRow(dayKey, businessScheduleDays[dayKey], isBusy)
          ).join("")}
        </div>
        <div class="admin-delivery-form-grid">
          ${renderRestaurantSettingsToggle({
            label: "Aceitar pedidos fora do horario",
            field: "businessSchedule.acceptOrdersOutsideHours",
            checked: businessSchedule.acceptOrdersOutsideHours === true,
            disabled: isBusy,
          })}
          ${renderRestaurantSettingsField({
            label: "Tempo extra de preparo em pico",
            field: "businessSchedule.peakPreparationExtraMinutes",
            value: formatAdminNumberValue(businessSchedule.peakPreparationExtraMinutes),
            type: "number",
            step: "1",
            disabled: isBusy,
          })}
          ${renderRestaurantSettingsTextarea({
            label: "Mensagem quando estiver fechado",
            field: "businessSchedule.closedMessage",
            value: businessSchedule.closedMessage || "",
            placeholder: "Estamos fechados agora. Voce pode agendar seu pedido para o proximo horario.",
            disabled: isBusy,
          })}
        </div>
      </article>

      <article class="admin-delivery-card is-wide">
        <header class="admin-delivery-card-head">
          <div>
            <span class="admin-chip">Datas especiais</span>
            <h3>Excecoes de funcionamento</h3>
            <p>Estas datas tem prioridade sobre a grade semanal para feriados, eventos, folgas, manutencoes ou horarios especiais.</p>
          </div>
          <button class="admin-button admin-button-secondary" type="button" data-restaurant-settings-action="add-special-date" ${isBusy ? "disabled" : ""}>
            Adicionar data
          </button>
        </header>
        <div class="admin-settings-special-date-list">
          ${
            specialDates.length
              ? specialDates
                  .map((entry, index) => renderRestaurantSpecialDateRow(entry, index, isBusy))
                  .join("")
              : `
                <div class="admin-empty-state admin-empty-state-soft">
                  <strong>Nenhuma data especial cadastrada</strong>
                  <span>Adicione excecoes para feriados, eventos, folgas, manutencoes ou atendimento em horario diferente.</span>
                </div>
              `
          }
        </div>
      </article>

      <article class="admin-delivery-card is-wide">
        <header class="admin-delivery-card-head">
          <div>
            <span class="admin-chip">Endereco estruturado</span>
            <h3>Base fisica do restaurante</h3>
            <p>O site exibe um endereco amigavel a partir destes campos. A chave permanece restaurant_key default nesta etapa.</p>
          </div>
        </header>
        <div class="admin-delivery-form-grid">
          ${renderRestaurantSettingsField({ label: "CEP", field: "addressFields.postalCode", value: addressFields.postalCode || "", placeholder: "14400-520", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Rua", field: "addressFields.street", value: addressFields.street || "", placeholder: RESTAURANT_SETTINGS_DEFAULT_DRAFT.addressFields.street, disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Numero", field: "addressFields.number", value: addressFields.number || "", placeholder: RESTAURANT_SETTINGS_DEFAULT_DRAFT.addressFields.number, disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Complemento", field: "addressFields.complement", value: addressFields.complement || "", placeholder: "Loja, sala, ponto de referencia", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Bairro", field: "addressFields.neighborhood", value: addressFields.neighborhood || "", placeholder: "Centro", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Cidade", field: "addressFields.city", value: addressFields.city || "", placeholder: "Franca", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Estado", field: "addressFields.state", value: addressFields.state || "", placeholder: "SP", disabled: isBusy })}
          <div class="admin-settings-color-preview is-wide">
            <strong>Endereco exibido: ${escapeHtml(friendlyAddress || "Complete os campos para gerar o endereco publico.")}</strong>
          </div>
        </div>
      </article>

      <article class="admin-delivery-card is-wide">
        <header class="admin-delivery-card-head">
          <div>
            <span class="admin-chip">Base de entrega</span>
            <h3>Coordenadas, raio e regras padrao</h3>
            <p>Latitude e longitude passam a ser a origem prioritaria do calculo. Se ficarem vazias, o site usa a origem legada.</p>
          </div>
        </header>
        <div class="admin-delivery-form-grid">
          ${renderRestaurantSettingsField({ label: "Latitude", field: "deliveryBase.latitude", value: formatAdminNumberValue(deliveryBase.latitude), type: "number", step: "0.000001", placeholder: "-20.536416", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Longitude", field: "deliveryBase.longitude", value: formatAdminNumberValue(deliveryBase.longitude), type: "number", step: "0.000001", placeholder: "-47.393922", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Raio maximo de entrega (km)", field: "deliveryBase.maxDeliveryRadiusKm", value: formatAdminNumberValue(deliveryBase.maxDeliveryRadiusKm), type: "number", step: "0.1", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Taxa fixa padrao", field: "deliveryBase.fixedDeliveryFee", value: formatAdminNumberValue(deliveryBase.fixedDeliveryFee), type: "number", step: "0.01", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Valor por km", field: "deliveryBase.pricePerKm", value: formatAdminNumberValue(deliveryBase.pricePerKm), type: "number", step: "0.01", disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Pedido minimo para entrega", field: "deliveryBase.minimumDeliveryOrder", value: formatAdminNumberValue(deliveryBase.minimumDeliveryOrder), type: "number", step: "0.01", disabled: isBusy })}
          ${renderRestaurantSettingsToggle({ label: "Permitir retirada no local", field: "deliveryBase.pickupEnabled", checked: deliveryBase.pickupEnabled !== false, disabled: isBusy })}
          ${renderRestaurantSettingsToggle({ label: "Permitir entrega", field: "deliveryBase.deliveryEnabled", checked: deliveryBase.deliveryEnabled !== false, disabled: isBusy })}
          ${renderRestaurantSettingsField({ label: "Tempo medio de preparo", field: "averagePreparationTimeMinutes", value: formatAdminNumberValue(draft.averagePreparationTimeMinutes), type: "number", step: "1", disabled: isBusy })}
        </div>
      </article>
    </section>
  `;
};

const getUsersSnapshot = () =>
  adminState.usersSnapshot || {
    users: [],
    permissionModules: adminState.adminPermissionModules || USER_PERMISSION_MODULES_FALLBACK,
    permissionActions: USER_PERMISSION_ACTIONS_FALLBACK,
    profiles: [],
    futureRestaurantAssociation: {
      currentKey: "default",
      restaurantIdImplemented: false,
    },
  };

const getUserPermissionModules = () => {
  const snapshot = getUsersSnapshot();
  const modules = Array.isArray(snapshot.permissionModules) && snapshot.permissionModules.length
    ? snapshot.permissionModules
    : USER_PERMISSION_MODULES_FALLBACK;

  return modules.map((module) => {
    const permissions = Array.isArray(module.permissions) && module.permissions.length
      ? module.permissions
      : USER_PERMISSION_ACTIONS_FALLBACK.map((action) => ({
          ...action,
          permission: `${module.key}_${action.key}`,
        }));

    return {
      ...module,
      permissions,
    };
  });
};

const getUserProfilePermissions = (userType) => {
  const profile = getUsersSnapshot().profiles?.find((entry) => entry.type === userType);
  return profile?.permissions && typeof profile.permissions === "object" ? profile.permissions : {};
};

const getAdminUserActorType = () => String(adminState.adminUserType || "").trim().toUpperCase();

const isSystemUserType = (userType) => SYSTEM_USER_TYPE_SET.has(String(userType || "").trim().toUpperCase());

const normalizeAdminUserScope = (value, userType = "") => {
  const normalizedValue = String(value || "").trim().toUpperCase();

  if (["SYSTEM", "SISTEMA", "PLATFORM", "PLATAFORMA"].includes(normalizedValue)) {
    return "SYSTEM";
  }

  if (["RESTAURANT", "RESTAURANTE", "OPERACIONAL"].includes(normalizedValue)) {
    return "RESTAURANT";
  }

  return isSystemUserType(userType) ? "SYSTEM" : "RESTAURANT";
};

const getAdminUserScope = (user = {}) =>
  normalizeAdminUserScope(
    user.userScope || user.user_scope || (user.platformScope === true ? "SYSTEM" : ""),
    user.userType || user.tipo_usuario
  );

const isSystemAdminActor = () =>
  adminState.adminPlatformScope === true || isSystemUserType(getAdminUserActorType());

const getManageableSystemUserTypesForActor = () =>
  SYSTEM_USER_MANAGEABLE_TYPES[getAdminUserActorType()] || [];

const canManageSystemUsers = () => getManageableSystemUserTypesForActor().length > 0;

const canManageRestaurantUsers = () => ["MASTER", "SOCIO", "SUPORTE", "OWNER"].includes(getAdminUserActorType());

const canManageAdminUsers = () => canManageSystemUsers() || canManageRestaurantUsers();

const canManagePlatformUsers = () => canManageSystemUsers();

const canManageUserScopes = () => isSystemAdminActor() && (canManageSystemUsers() || canManageRestaurantUsers());

const canCreateAdminUsers = () => canManageAdminUsers() && hasAdminPermission("users_create");

const canEditAdminUsers = () => canManageAdminUsers() && hasAdminPermission("users_edit");

const canDeleteAdminUsers = () => canManageAdminUsers() && hasAdminPermission("users_delete");

const getAdminUserTypeOptions = (selectedType = "GERENTE", userScope = "") => {
  const normalizedSelectedType = String(selectedType || "GERENTE").trim().toUpperCase();
  const normalizedScope = normalizeAdminUserScope(userScope, normalizedSelectedType);
  const actorType = getAdminUserActorType();
  const baseOptions =
    normalizedScope === "SYSTEM"
      ? SYSTEM_USER_TYPE_OPTIONS.filter((option) =>
          getManageableSystemUserTypesForActor().includes(option.key)
        )
      : actorType === "OWNER"
        ? OWNER_USER_TYPE_OPTIONS
        : canManageRestaurantUsers()
          ? RESTAURANT_USER_TYPE_OPTIONS
          : [];
  const options = [...baseOptions];

  if (normalizedSelectedType && !options.some((option) => option.key === normalizedSelectedType)) {
    options.unshift({
      key: normalizedSelectedType,
      label: normalizedSelectedType,
    });
  }

  return options;
};

const canSubmitSelectedAdminUser = (user) => {
  const userType = String(user?.userType || user?.tipo_usuario || "GERENTE").trim().toUpperCase();
  const userScope = getAdminUserScope(user);
  const actorType = getAdminUserActorType();

  if (!getAdminUserTypeOptions(userType, userScope).some((option) => option.key === userType)) {
    return false;
  }

  if (userScope === "SYSTEM") {
    return getManageableSystemUserTypesForActor().includes(userType);
  }

  if (actorType === "OWNER") {
    const targetRestaurant = String(user?.restaurantKey || getCurrentUsersRestaurantKey()).trim();
    return (
      RESTAURANT_USER_TYPE_SET.has(userType) &&
      userType !== "OWNER" &&
      targetRestaurant === getCurrentUsersRestaurantKey()
    );
  }

  return canManageRestaurantUsers() && RESTAURANT_USER_TYPE_SET.has(userType);
};

const getCurrentUsersRestaurantKey = () => {
  if (isSystemAdminActor()) {
    return "";
  }

  const users = Array.isArray(getUsersSnapshot().users) ? getUsersSnapshot().users : [];
  const firstRestaurantKey = users.find((user) => user.restaurantKey)?.restaurantKey || "";

  return (
    adminState.adminRestaurantKey ||
    getUsersSnapshot().restaurantKey ||
    adminState.commercialAccess?.restaurantKey ||
    adminState.commercialAccess?.key ||
    firstRestaurantKey ||
    "default"
  );
};

const getAdminUserId = (user = {}) => user.id || user.directoryId || user.login || "";

const getAdminUserRestaurantName = (user = {}) => {
  const type = String(user.userType || user.tipo_usuario || "").toUpperCase();
  const scope = getAdminUserScope(user);

  if (scope === "SYSTEM" || (type === "MASTER" && user.platformScope === true)) {
    return "Plataforma INovas Food";
  }

  return user.restaurantName || user.restaurant || user.tradeName || user.restaurantKey || getCurrentUsersRestaurantKey();
};

const getAdminUserPlan = (user = {}) => {
  const type = String(user.userType || user.tipo_usuario || "").toUpperCase();
  const scope = getAdminUserScope(user);

  if (scope === "SYSTEM" || (type === "MASTER" && user.platformScope === true)) {
    return "PLATAFORMA";
  }

  return (
    user.planName ||
    user.plan ||
    adminState.commercialAccess?.planName ||
    adminState.commercialAccess?.planKey ||
    adminState.commercialAccess?.plan ||
    "--"
  );
};

const getAdminUserCnpj = (user = {}) => user.cnpjMei || user.taxId || user.document || "";

const getAdminUserProfileLabel = (user = {}) => {
  const userType = String(user.userType || user.tipo_usuario || "").trim().toUpperCase();
  return user.userTypeLabel || USER_TYPE_LABELS[userType] || userType || "--";
};

const getAdminUserInitials = (user = {}) => {
  const name = String(user.name || user.nome || user.email || user.login || "").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2);
  return initials.toUpperCase() || "US";
};

const getAdminUserSearchText = (user = {}) =>
  normalizeInventorySearchValue(
    [
      user.searchIndex,
      getAdminUserId(user),
      user.name,
      user.nome,
      getAdminUserRestaurantName(user),
      user.restaurantKey,
      user.email,
      user.login,
      user.phone,
      user.telefone,
      getAdminUserCnpj(user),
      getAdminUserPlan(user),
      user.userType,
      user.tipo_usuario,
      user.status,
      user.statusLabel,
    ].join(" ")
  );

const getFilteredAdminUsers = () => {
  const query = normalizeInventorySearchValue(adminState.searchQuery);
  const restaurantFilter = String(adminState.userFilters.restaurant || "").trim();
  const profileFilter = String(adminState.userFilters.profile || "").trim().toUpperCase();
  const statusFilter = String(adminState.userFilters.status || "").trim().toUpperCase();
  const users = Array.isArray(getUsersSnapshot().users) ? getUsersSnapshot().users : [];

  return users.filter((user) => {
    const userType = String(user.userType || user.tipo_usuario || "").trim().toUpperCase();
    const userStatus = String(user.status || "").trim().toUpperCase();
    const userRestaurant = String(user.restaurantKey || "").trim();
    const matchesSearch = !query || getAdminUserSearchText(user).includes(query);
    const matchesRestaurant = !restaurantFilter || userRestaurant === restaurantFilter;
    const matchesProfile = !profileFilter || userType === profileFilter;
    const matchesStatus = !statusFilter || userStatus === statusFilter;

    return matchesSearch && matchesRestaurant && matchesProfile && matchesStatus;
  });
};

const getAdminUserSortValue = (user = {}, key = "id") => {
  if (key === "name") {
    return user.name || user.nome || user.email || user.login || "";
  }

  if (key === "restaurant") {
    return getAdminUserRestaurantName(user);
  }

  if (key === "plan") {
    return getAdminUserPlan(user);
  }

  if (key === "profile") {
    return getAdminUserProfileLabel(user);
  }

  if (key === "status") {
    return user.statusLabel || user.status || "";
  }

  return getAdminUserId(user);
};

const getSortedAdminUsers = () => {
  const sortKey = USER_TABLE_COLUMNS.some((column) => column.key === adminState.userSort.key)
    ? adminState.userSort.key
    : "id";
  const direction = adminState.userSort.direction === "desc" ? -1 : 1;

  return [...getFilteredAdminUsers()].sort((left, right) =>
    String(getAdminUserSortValue(left, sortKey)).localeCompare(
      String(getAdminUserSortValue(right, sortKey)),
      "pt-BR",
      { numeric: true, sensitivity: "base" }
    ) * direction
  );
};

const getUsersPageCount = () => {
  const total = getSortedAdminUsers().length;
  return Math.max(1, Math.ceil(total / adminState.userPageSize));
};

const normalizeUsersPage = () => {
  const pageCount = getUsersPageCount();
  adminState.userPage = Math.min(Math.max(1, Number(adminState.userPage || 1)), pageCount);
};

const getPaginatedAdminUsers = () => {
  normalizeUsersPage();
  const sortedUsers = getSortedAdminUsers();
  const start = (adminState.userPage - 1) * adminState.userPageSize;
  return sortedUsers.slice(start, start + adminState.userPageSize);
};

const getBlankAdminUser = () => ({
  id: "",
  name: "",
  login: "",
  email: "",
  phone: "",
  telefone: "",
  restaurantKey: isSystemAdminActor() && canManageSystemUsers() ? "" : getCurrentUsersRestaurantKey(),
  status: "ACTIVE",
  userScope: isSystemAdminActor() && canManageSystemUsers() ? "SYSTEM" : "RESTAURANT",
  userType: isSystemAdminActor() && canManageSystemUsers()
    ? getManageableSystemUserTypesForActor()[0] || "VENDEDOR"
    : "GERENTE",
  tipo_usuario: isSystemAdminActor() && canManageSystemUsers()
    ? getManageableSystemUserTypesForActor()[0] || "VENDEDOR"
    : "GERENTE",
  permissions: {},
  effectivePermissions: {},
  createdAt: "",
  lastAccessAt: "",
});

const getSelectedAdminUser = () => {
  if (adminState.selectedUserLogin === NEW_ADMIN_USER_LOGIN) {
    return {
      ...getBlankAdminUser(),
      ...(adminState.userDraft || {}),
    };
  }

  const users = Array.isArray(getUsersSnapshot().users) ? getUsersSnapshot().users : [];
  const selectedUser =
    users.find((user) => user.login === adminState.selectedUserLogin) ||
    getPaginatedAdminUsers()[0] ||
    getSortedAdminUsers()[0] ||
    users[0] ||
    null;

  if (selectedUser) {
    adminState.selectedUserLogin = selectedUser.login;
    return selectedUser;
  }

  return getBlankAdminUser();
};

const renderAdminUserStatus = (user) => {
  const isBlocked = user.status === "BLOCKED";
  const isActive = user.status === "ACTIVE";
  const statusClass = isBlocked ? "is-blocked" : isActive ? "is-active" : "is-inactive";

  return `
    <span class="admin-user-status ${statusClass}">
      <span class="admin-user-status-dot" aria-hidden="true"></span>
      ${escapeHtml(user.statusLabel || (isBlocked ? "Bloqueado" : isActive ? "Ativo" : "Inativo"))}
    </span>
  `;
};

const renderAdminUserSortButton = (column) => {
  if (!column.sortable) {
    return escapeHtml(column.label);
  }

  const isActive = adminState.userSort.key === column.key;
  const direction = adminState.userSort.direction === "desc" ? "desc" : "asc";
  const indicator = isActive ? (direction === "desc" ? "v" : "^") : "";

  return `
    <button class="admin-users-sort-button" type="button" data-user-sort="${escapeHtml(column.key)}">
      <span>${escapeHtml(column.label)}</span>
      <span aria-hidden="true">${escapeHtml(indicator)}</span>
    </button>
  `;
};

const renderAdminUserIcon = (icon) => {
  const icons = {
    view: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.8 12s3.3-6 9.2-6 9.2 6 9.2 6-3.3 6-9.2 6-9.2-6-9.2-6Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.7" stroke="currentColor" stroke-width="1.8"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m4 20 4.7-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Zm11.2-13.2 3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    delete: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  return icons[icon] || "";
};

const renderAdminUserActions = (user) => {
  const login = user.login || "";
  const canEditUser = canEditAdminUsers() && canSubmitSelectedAdminUser(user);
  const canDeleteUser = canDeleteAdminUsers() && canSubmitSelectedAdminUser(user);
  const isBusy = adminState.userBusyLogin === login || adminState.userSaving;

  return `
    <div class="admin-user-row-actions">
      <button class="admin-user-icon-button" type="button" data-user-view="${escapeHtml(login)}" aria-label="Visualizar usuario" title="Visualizar usuario">
        ${renderAdminUserIcon("view")}
      </button>
      <button class="admin-user-icon-button" type="button" data-user-select="${escapeHtml(login)}" aria-label="Editar usuario" title="Editar usuario" ${!canEditUser ? "disabled" : ""}>
        ${renderAdminUserIcon("edit")}
      </button>
      <button
        class="admin-user-icon-button is-danger"
        type="button"
        data-user-delete="${escapeHtml(login)}"
        aria-label="Excluir usuario"
        title="Excluir usuario"
        ${isBusy || !canDeleteUser ? "disabled" : ""}
      >
        ${renderAdminUserIcon("delete")}
      </button>
    </div>
  `;
};

const renderAdminUserRow = (user) => {
  const isSelected = adminState.selectedUserLogin === user.login;
  const profileKey = String(user.userType || user.tipo_usuario || "").trim().toLowerCase();
  const plan = getAdminUserPlan(user) || "--";

  return `
    <tr class="${isSelected ? "is-selected" : ""}" data-user-row="${escapeHtml(user.login || "")}">
      <td>
        <strong>${escapeHtml(getAdminUserId(user) || "--")}</strong>
      </td>
      <td>
        <div class="admin-user-identity">
          <span class="admin-user-avatar" aria-hidden="true">${escapeHtml(getAdminUserInitials(user))}</span>
          <span>
            <strong>${escapeHtml(user.name || user.nome || user.email || "--")}</strong>
            <small>${escapeHtml(user.email || "Sem e-mail")}</small>
          </span>
        </div>
      </td>
      <td>
        <strong>${escapeHtml(getAdminUserRestaurantName(user) || "--")}</strong>
        <small>${escapeHtml(user.phone || user.telefone || getAdminUserCnpj(user) || "--")}</small>
      </td>
      <td>
        <span class="admin-user-badge is-plan">${escapeHtml(plan)}</span>
      </td>
      <td>
        <span class="admin-user-badge is-profile is-${escapeHtml(profileKey)}">${escapeHtml(getAdminUserProfileLabel(user))}</span>
      </td>
      <td>${renderAdminUserStatus(user)}</td>
      <td>${renderAdminUserActions(user)}</td>
    </tr>
  `;
};

const renderPermissionCheckbox = ({ permission, label, checked, disabled }) => `
  <label class="admin-permission-check">
    <input
      type="checkbox"
      data-user-permission="${escapeHtml(permission)}"
      ${checked ? "checked" : ""}
      ${disabled ? "disabled" : ""}
    />
    <span>${escapeHtml(label)}</span>
  </label>
`;

const renderAdminUserPermissions = (user, isBusy = false) => {
  const userType = user.userType || user.tipo_usuario || "CUSTOM";
  const isCustom = userType === "CUSTOM";
  const sourcePermissions = isCustom
    ? user.permissions || {}
    : getUserProfilePermissions(userType);
  const fallbackEffectivePermissions = user.effectivePermissions || {};
  const permissions = {
    ...fallbackEffectivePermissions,
    ...sourcePermissions,
  };

  return `
    <div class="admin-permission-grid">
      ${getUserPermissionModules()
        .map((module) => `
          <article class="admin-permission-module">
            <header>
              <strong>${escapeHtml(module.label || module.key)}</strong>
            </header>
            <div>
              ${module.permissions
                .map((entry) =>
                  renderPermissionCheckbox({
                    permission: entry.permission,
                    label: entry.label,
                    checked: permissions[entry.permission] === true,
                    disabled: isBusy || !isCustom,
                  })
                )
                .join("")}
            </div>
          </article>
        `)
        .join("")}
    </div>
  `;
};

const renderAdminUsersTable = () => {
  const paginatedUsers = getPaginatedAdminUsers();

  return `
    <div class="admin-users-table-wrap">
      <table class="admin-users-table">
        <thead>
          <tr>
            ${USER_TABLE_COLUMNS.map((column) => `<th scope="col">${renderAdminUserSortButton(column)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${
            paginatedUsers.length
              ? paginatedUsers.map(renderAdminUserRow).join("")
              : `
                <tr>
                  <td colspan="${escapeHtml(String(USER_TABLE_COLUMNS.length))}">
                    <div class="admin-empty-state admin-empty-state-soft">
                      <strong>Nenhum usuario encontrado</strong>
                      <span>Ajuste a busca ou os filtros ativos.</span>
                    </div>
                  </td>
                </tr>
              `
          }
        </tbody>
      </table>
    </div>
  `;
};

const renderAdminUsersPagination = () => {
  const filteredCount = getFilteredAdminUsers().length;
  const pageCount = getUsersPageCount();
  const start = filteredCount ? (adminState.userPage - 1) * adminState.userPageSize + 1 : 0;
  const end = Math.min(filteredCount, adminState.userPage * adminState.userPageSize);

  return `
    <footer class="admin-users-pagination">
      <div>
        <strong>${escapeHtml(String(start))}-${escapeHtml(String(end))}</strong>
        <span>de ${escapeHtml(String(filteredCount))}</span>
      </div>
      <label>
        <span>Por pagina</span>
        <select class="admin-input" data-user-page-size>
          ${USER_PAGE_SIZE_OPTIONS.map((size) => `
            <option value="${escapeHtml(String(size))}" ${size === adminState.userPageSize ? "selected" : ""}>
              ${escapeHtml(String(size))}
            </option>
          `).join("")}
        </select>
      </label>
      <div class="admin-users-page-actions">
        <button class="admin-action-button is-compact" type="button" data-user-page="prev" ${adminState.userPage <= 1 ? "disabled" : ""}>
          Anterior
        </button>
        <span>${escapeHtml(String(adminState.userPage))}/${escapeHtml(String(pageCount))}</span>
        <button class="admin-action-button is-compact" type="button" data-user-page="next" ${adminState.userPage >= pageCount ? "disabled" : ""}>
          Proxima
        </button>
      </div>
    </footer>
  `;
};

const getAdminUsersRestaurantFilterOptions = () => {
  const users = Array.isArray(getUsersSnapshot().users) ? getUsersSnapshot().users : [];
  const options = new Map();

  users.forEach((user) => {
    const restaurantKey = String(user.restaurantKey || "").trim();

    if (restaurantKey) {
      options.set(restaurantKey, getAdminUserRestaurantName(user));
    }
  });

  return [...options.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR", { sensitivity: "base" }));
};

const renderAdminUsersFilters = () => `
  <div class="admin-users-toolbar" aria-label="Filtros de usuarios">
    <label class="admin-delivery-field">
      <span>Busca</span>
      <input
        class="admin-input"
        type="search"
        value="${escapeHtml(adminState.searchQuery)}"
        placeholder="ID, nome, restaurante, e-mail, telefone ou CNPJ"
        data-user-inline-search
      />
    </label>
    <label class="admin-delivery-field">
      <span>Restaurante</span>
      <select class="admin-input" data-user-filter="restaurant">
        <option value="">Todos</option>
        ${getAdminUsersRestaurantFilterOptions().map((option) => `
          <option value="${escapeHtml(option.key)}" ${adminState.userFilters.restaurant === option.key ? "selected" : ""}>
            ${escapeHtml(option.label)}
          </option>
        `).join("")}
      </select>
    </label>
    <label class="admin-delivery-field">
      <span>Perfil</span>
      <select class="admin-input" data-user-filter="profile">
        <option value="">Todos</option>
        ${USER_TYPE_OPTIONS.map((option) => `
          <option value="${escapeHtml(option.key)}" ${adminState.userFilters.profile === option.key ? "selected" : ""}>
            ${escapeHtml(option.label)}
          </option>
        `).join("")}
      </select>
    </label>
    <label class="admin-delivery-field">
      <span>Status</span>
      <select class="admin-input" data-user-filter="status">
        <option value="">Todos</option>
        ${USER_STATUS_OPTIONS.map((option) => `
          <option value="${escapeHtml(option.key)}" ${adminState.userFilters.status === option.key ? "selected" : ""}>
            ${escapeHtml(option.label)}
          </option>
        `).join("")}
      </select>
    </label>
    <button class="admin-button admin-button-secondary admin-users-clear-filters" type="button" data-user-clear-filters>
      Limpar filtros
    </button>
  </div>
`;

const renderAdminUserScopeField = ({ userScope, disabled }) => {
  if (!canManagePlatformUsers()) {
    return `
      <input type="hidden" name="userScope" value="RESTAURANT" />
      <div class="admin-user-scope-readonly">
        <span>Tipo de usuario</span>
        <strong>Usuario de Restaurante</strong>
      </div>
    `;
  }

  return `
    <fieldset class="admin-user-scope-group">
      <legend>Tipo de usuario</legend>
      ${USER_SCOPE_OPTIONS.map((option) => `
        <label class="admin-user-scope-option">
          <input
            type="radio"
            name="userScope"
            value="${escapeHtml(option.key)}"
            data-user-scope
            ${option.key === userScope ? "checked" : ""}
            ${disabled ? "disabled" : ""}
          />
          <span>${escapeHtml(option.label)}</span>
        </label>
      `).join("")}
    </fieldset>
  `;
};

const renderAdminUserDialog = () => {
  if (!adminState.userDialogMode) {
    return "";
  }

  const selectedUser = getSelectedAdminUser();
  const isCreating = adminState.selectedUserLogin === NEW_ADMIN_USER_LOGIN || !selectedUser.login;
  const isViewing = adminState.userDialogMode === "view";
  const isBusy = adminState.isLoadingUsers || adminState.userSaving;
  const userScope = getAdminUserScope(selectedUser);
  const selectedUserType = selectedUser.userType || selectedUser.tipo_usuario || (userScope === "SYSTEM" ? "MASTER" : "GERENTE");
  const selectedUserCanSubmit =
    (isCreating ? canCreateAdminUsers() : canEditAdminUsers()) && canSubmitSelectedAdminUser(selectedUser);
  const formDisabled = isViewing || isBusy || !selectedUserCanSubmit;
  const selectedRestaurantKey = userScope === "SYSTEM" ? "" : selectedUser.restaurantKey || getCurrentUsersRestaurantKey();
  const dialogTitle = isViewing
    ? selectedUser.name || selectedUser.login || "Visualizar usuario"
    : isCreating
      ? "Novo usuario"
      : selectedUser.name || selectedUser.login || "Editar usuario";

  return `
    <div class="admin-users-modal" role="presentation">
      <button class="admin-users-modal-backdrop" type="button" data-user-dialog-close aria-label="Fechar formulario"></button>
      <aside class="admin-users-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-user-dialog-title">
        <header class="admin-users-dialog-head">
          <div>
            <span class="admin-chip">${escapeHtml(isViewing ? "Visualizacao" : isCreating ? "Cadastro" : "Edicao")}</span>
            <h3 id="admin-user-dialog-title">${escapeHtml(dialogTitle)}</h3>
            <p>${escapeHtml(userScope === "SYSTEM" ? "Usuario da plataforma INovas Food." : "Usuario vinculado a um restaurante.")}</p>
          </div>
          <button class="admin-user-icon-button" type="button" data-user-dialog-close aria-label="Fechar" title="Fechar">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
        </header>

        <form class="admin-users-form-card" data-user-form>
          <input type="hidden" name="id" value="${escapeHtml(selectedUser.id || "")}" />
          <input type="hidden" name="login" value="${escapeHtml(selectedUser.login || "")}" />

          ${renderAdminUserScopeField({ userScope, disabled: isViewing || isBusy || !canManageUserScopes() })}

          <div class="admin-users-form-grid">
            <label class="admin-delivery-field">
              <span>Nome</span>
              <input class="admin-input" name="name" value="${escapeHtml(selectedUser.name || selectedUser.nome || "")}" ${formDisabled ? "disabled" : ""} required />
            </label>
            <label class="admin-delivery-field">
              <span>E-mail</span>
              <input class="admin-input" name="email" type="email" value="${escapeHtml(selectedUser.email || "")}" ${formDisabled ? "disabled" : ""} required />
            </label>
            <label class="admin-delivery-field">
              <span>Telefone</span>
              <input class="admin-input" name="phone" inputmode="tel" value="${escapeHtml(selectedUser.phone || selectedUser.telefone || "")}" ${formDisabled ? "disabled" : ""} required />
            </label>
            ${
              userScope === "RESTAURANT"
                ? `
                  <label class="admin-delivery-field">
                    <span>Restaurante</span>
                    <input
                      class="admin-input"
                      name="restaurantKey"
                      value="${escapeHtml(selectedRestaurantKey)}"
                      ${formDisabled ? "disabled" : ""}
                      ${isSystemAdminActor() && canManageRestaurantUsers() ? "" : "readonly"}
                      required
                    />
                  </label>
                `
                : `<input type="hidden" name="restaurantKey" value="" />`
            }
            <label class="admin-delivery-field">
              <span>Perfil</span>
              <select class="admin-input" name="userType" ${formDisabled ? "disabled" : ""} required>
                ${getAdminUserTypeOptions(selectedUserType, userScope).map((option) => `
                  <option value="${escapeHtml(option.key)}" ${option.key === selectedUserType ? "selected" : ""}>${escapeHtml(option.label)}</option>
                `).join("")}
              </select>
            </label>
            <label class="admin-delivery-field">
              <span>Status</span>
              <select class="admin-input" name="status" ${formDisabled ? "disabled" : ""}>
                ${USER_STATUS_OPTIONS.map((option) => `
                  <option value="${escapeHtml(option.key)}" ${option.key === (selectedUser.status || "ACTIVE") ? "selected" : ""}>${escapeHtml(option.label)}</option>
                `).join("")}
              </select>
            </label>
            <label class="admin-delivery-field">
              <span>${isCreating ? "Senha inicial" : "Nova senha"}</span>
              <input class="admin-input" name="password" type="password" minlength="6" autocomplete="new-password" placeholder="${isCreating ? "Obrigatoria" : "Preencha para redefinir"}" ${formDisabled ? "disabled" : ""} ${isCreating ? "required" : ""} />
            </label>
          </div>

          <section class="admin-users-permissions" hidden aria-hidden="true">
            <header class="admin-users-card-head">
              <div>
                <span class="admin-chip">Permissoes</span>
                <h3>Modulos e acoes</h3>
              </div>
              <small>${selectedUserType === "CUSTOM" ? "Permissoes individuais" : "Perfil padrao aplicado automaticamente"}</small>
            </header>
            ${
              selectedUserCanSubmit
                ? ""
                : `
                  <div class="admin-feedback is-error">
                    Este perfil e protegido ou esta fora do seu escopo de administracao.
                  </div>
                `
            }
            <details class="admin-users-permission-details">
              <summary>Personalizar permissoes</summary>
              ${renderAdminUserPermissions(selectedUser, isBusy)}
            </details>
          </section>

          <div class="admin-delivery-savebar">
            <div>
              <strong>${escapeHtml(getAdminUserProfileLabel({ ...selectedUser, userType: selectedUserType }))}</strong>
              <span>${escapeHtml(userScope === "SYSTEM" ? "Administracao da plataforma" : `Restaurante ${selectedRestaurantKey || "nao informado"}`)}</span>
            </div>
            <div class="admin-delivery-savebar-actions">
              <button class="admin-button admin-button-secondary" type="button" data-user-dialog-close>
                ${isViewing ? "Fechar" : "Cancelar"}
              </button>
              ${
                isViewing && canEditAdminUsers() && canSubmitSelectedAdminUser(selectedUser)
                  ? `<button class="admin-button admin-button-primary" type="button" data-user-select="${escapeHtml(selectedUser.login || "")}">Editar</button>`
                  : ""
              }
              ${
                !isViewing && !isCreating
                  ? `<button class="admin-button admin-button-secondary" type="button" data-user-reset-password ${formDisabled ? "disabled" : ""}>Redefinir senha</button>`
                  : ""
              }
              ${
                !isViewing
                  ? `<button class="admin-button admin-button-primary" type="submit" ${formDisabled ? "disabled" : ""}>
                      ${adminState.userSaving ? "Salvando..." : "Salvar usuario"}
                    </button>`
                  : ""
              }
            </div>
          </div>
        </form>
      </aside>
    </div>
  `;
};

const renderUsersModule = () => {
  const moduleRoot = document.querySelector("[data-admin-module-content]");

  if (!moduleRoot) {
    return;
  }

  const snapshot = getUsersSnapshot();
  const users = Array.isArray(snapshot.users) ? snapshot.users : [];
  const isBusy = adminState.isLoadingUsers || adminState.userSaving;
  const activeCount = users.filter((user) => user.status === "ACTIVE").length;
  const inactiveCount = users.filter((user) => user.status !== "ACTIVE" && user.status !== "BLOCKED").length;
  const blockedCount = users.filter((user) => user.status === "BLOCKED").length;

  moduleRoot.innerHTML = `
    <header class="admin-users-page-head">
      <div>
        <h2>Usuarios</h2>
        <p>Gerencie os usuarios e permissoes do sistema por escopo.</p>
      </div>
      ${
        canCreateAdminUsers()
          ? `
            <button class="admin-button admin-button-primary admin-users-new-button" type="button" data-user-new ${isBusy ? "disabled" : ""}>
              <span aria-hidden="true">+</span>
              Novo usuario
            </button>
          `
          : ""
      }
    </header>

    <section class="admin-users-summary-grid" aria-label="Resumo de usuarios">
      <article class="admin-users-summary-card is-total">
        <span class="admin-users-summary-icon" aria-hidden="true">${renderAdminUserIcon("view")}</span>
        <div>
          <span>Total de usuarios</span>
          <strong>${escapeHtml(String(users.length))}</strong>
          <small>Todos os usuarios</small>
        </div>
      </article>
      <article class="admin-users-summary-card is-active">
        <span class="admin-users-summary-icon" aria-hidden="true">${renderAdminUserIcon("view")}</span>
        <div>
          <span>Ativos</span>
          <strong>${escapeHtml(String(activeCount))}</strong>
          <small>Usuarios ativos</small>
        </div>
      </article>
      <article class="admin-users-summary-card is-inactive">
        <span class="admin-users-summary-icon" aria-hidden="true">${renderAdminUserIcon("view")}</span>
        <div>
          <span>Inativos</span>
          <strong>${escapeHtml(String(inactiveCount))}</strong>
          <small>Usuarios inativos</small>
        </div>
      </article>
      <article class="admin-users-summary-card is-blocked">
        <span class="admin-users-summary-icon" aria-hidden="true">${renderAdminUserIcon("delete")}</span>
        <div>
          <span>Bloqueados</span>
          <strong>${escapeHtml(String(blockedCount))}</strong>
          <small>Usuarios bloqueados</small>
        </div>
      </article>
    </section>

    <section class="admin-users-layout" data-users-root>
      ${
        adminState.actionMessage
          ? `<div class="admin-feedback is-${escapeHtml(adminState.actionTone || "success")}">${escapeHtml(adminState.actionMessage)}</div>`
          : ""
      }

      <article class="admin-users-list-card">
        ${renderAdminUsersFilters()}

        ${
          adminState.isLoadingUsers
            ? `
              <div class="admin-empty-state admin-empty-state-loading">
                <strong>Carregando usuarios</strong>
                <span>Sincronizando acessos do gestor.</span>
              </div>
            `
            : `
              ${renderAdminUsersTable()}
              ${renderAdminUsersPagination()}
            `
        }
      </article>
    </section>

    ${renderAdminUserDialog()}
  `;
};

const renderPlaceholderModule = () => {
  const moduleRoot = document.querySelector("[data-admin-module-content]");
  const section = getNavigationSectionByKey(adminState.activeSection);
  const roadmapLabel = ["scheduled", "menu", "promotions", "reviews", "settings"].includes(
    adminState.activeSection
  )
    ? "Fase 2 do gestor"
    : "Proxima fase";

  if (!moduleRoot) {
    return;
  }

  moduleRoot.innerHTML = `
    <div class="admin-empty-state">
      <strong>${escapeHtml(section?.label || "Modulo")} em preparacao</strong>
      <span>${escapeHtml(
        `${roadmapLabel}: este modulo entra depois da consolidacao do fluxo principal de pedidos. A base de navegacao ja esta pronta para evoluir sem refazer o gestor.`
      )}</span>
    </div>
  `;
};

const renderPlanBlockedModule = () => {
  const moduleRoot = document.querySelector("[data-admin-module-content]");
  const section = getNavigationSectionByKey(adminState.activeSection);
  const featureKey = SECTION_FEATURE_MAP[adminState.activeSection] || "";

  if (!moduleRoot) {
    return;
  }

  moduleRoot.innerHTML = `
    <div class="admin-empty-state" data-admin-plan-blocked>
      <strong>Este modulo nao esta disponivel no plano atual.</strong>
      <span>${escapeHtml(
        featureKey
          ? `${section?.label || "Modulo"} depende do recurso comercial ${featureKey}.`
          : `${section?.label || "Modulo"} nao esta liberado no contrato atual.`
      )}</span>
    </div>
  `;
};

const renderModuleContentBody = () => {
  if (!hasPlanFeatureForSection(adminState.activeSection)) {
    renderPlanBlockedModule();
    adminState.expandedBoardColumnKey = "";
    renderBoardColumnModal();
    return;
  }

  if (adminState.activeSection === "dashboard") {
    renderDashboardModule();
    adminState.expandedBoardColumnKey = "";
    renderBoardColumnModal();
    return;
  }

  if (adminState.activeSection === "orders") {
    renderOrdersModuleShell();
    renderBoard();
    renderClosedOrders();
    renderBoardColumnModal();
    return;
  }

  adminState.expandedBoardColumnKey = "";
  renderBoardColumnModal();

  if (adminState.activeSection === "scheduled") {
    renderScheduledModule();
    return;
  }

  if (adminState.activeSection === "menu") {
    renderMenuModule();
    return;
  }

  if (adminState.activeSection === "promotions") {
    renderPromotionsModule();
    return;
  }

  if (adminState.activeSection === "reviews") {
    renderReviewsModule();
    return;
  }

  if (adminState.activeSection === "deliveries") {
    renderDeliveriesModule();
    return;
  }

  if (adminState.activeSection === "customers") {
    renderCustomerModule();
    return;
  }

  if (adminState.activeSection === "finance") {
    renderFinanceModule();
    return;
  }

  if (adminState.activeSection === "metrics") {
    renderMetricsModule();
    return;
  }

  if (adminState.activeSection === "reports") {
    renderReportsModule();
    return;
  }

  if (adminState.activeSection === "inventory") {
    renderInventoryModule();
    return;
  }

  if (adminState.activeSection === "settings") {
    renderRestaurantSettingsModule();
    return;
  }

  if (adminState.activeSection === "users") {
    renderUsersModule();
    return;
  }

  if (adminState.activeSection === "audit") {
    renderAuditModule();
    return;
  }

  renderPlaceholderModule();
};

const getSystemFilterValuesForSection = (sectionKey = adminState.activeSection) =>
  adminState.systemFilters?.[sectionKey] || {};

const renderSystemGlobalFilters = () => {
  const moduleRoot = document.querySelector("[data-admin-module-content]");
  const filters = SYSTEM_GLOBAL_FILTERS[adminState.activeSection];

  if (!moduleRoot || !isSystemAdminActor() || !filters) {
    return;
  }

  const values = getSystemFilterValuesForSection();
  const sectionLabel = getNavigationSectionByKey(adminState.activeSection)?.label || "Modulo";
  const isConsolidatedSection = ["finance", "reports", "metrics"].includes(adminState.activeSection);

  moduleRoot.querySelector("[data-system-global-filters]")?.remove();
  moduleRoot.insertAdjacentHTML("afterbegin", `
    <section class="admin-system-filter-bar" data-system-global-filters data-system-section="${escapeHtml(adminState.activeSection)}">
      <div class="admin-system-filter-title">
        <span>${escapeHtml(sectionLabel)}</span>
        <strong>${escapeHtml(isConsolidatedSection && !values.restaurant ? "Consolidado da plataforma" : "Filtros da plataforma")}</strong>
      </div>
      <div class="admin-system-filter-grid">
        ${filters.map((filter) => `
          <label class="admin-system-filter-field">
            <span>${escapeHtml(filter.label)}</span>
            <input
              class="admin-input"
              type="${escapeHtml(filter.type || "search")}"
              data-system-filter="${escapeHtml(filter.key)}"
              value="${escapeHtml(values[filter.key] || "")}"
              placeholder="${escapeHtml(filter.placeholder || "")}"
            />
          </label>
        `).join("")}
      </div>
    </section>
  `);
};

const renderModuleContent = () => {
  renderModuleContentBody();
  renderSystemGlobalFilters();
};

const renderBoard = () => {
  const boardRoot = document.querySelector("[data-admin-board]");

  if (!boardRoot) {
    return;
  }

  const visibleOrders = getVisibleOperationalOrders();

  if (adminState.isLoadingOrders && adminState.orders.length === 0) {
    boardRoot.innerHTML = `
      <div class="admin-board-loading">
        <div class="admin-empty-state admin-empty-state-loading">
          <strong>Carregando pedidos</strong>
          <span>Estamos sincronizando a operacao do gestor com a base de pedidos.</span>
        </div>
      </div>
    `;
    return;
  }

  boardRoot.innerHTML = BOARD_COLUMNS.map((column) => {
    const columnOrders = getOrderedBoardColumnOrders(column.key, visibleOrders);
    const visibleColumnOrders = columnOrders.slice(0, BOARD_VISIBLE_CARD_LIMIT);
    const hiddenCount = Math.max(columnOrders.length - BOARD_VISIBLE_CARD_LIMIT, 0);
    const columnTotal = columnOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const columnStateClassName = columnOrders.length === 0 ? " is-empty" : "";

    return `
      <article class="admin-board-column ${column.accentClass}${columnStateClassName}">
        <header class="admin-board-column-head">
          <div>
            <strong>${escapeHtml(column.label)}</strong>
            <p>${escapeHtml(column.helper)}</p>
          </div>
          <div class="admin-board-column-meta">
            <span>${escapeHtml(String(columnOrders.length))}</span>
            <small>${escapeHtml(formatMoney(columnTotal))}</small>
          </div>
        </header>

        <div class="admin-board-stack">
          ${
            columnOrders.length === 0
              ? `
                <div class="admin-empty-state admin-empty-state-inline">
                  <strong>Sem pedidos nesta etapa</strong>
                  <span>Novas entradas aparecem aqui automaticamente.</span>
                </div>
              `
              : visibleColumnOrders.map(renderOrderCard).join("")
          }
        </div>

        ${
          hiddenCount > 0
            ? `
              <div class="admin-board-overflow">
                <p class="admin-board-overflow-count">+ ${escapeHtml(formatOrderCountLabel(hiddenCount))}</p>
                <button
                  class="admin-board-overflow-button"
                  type="button"
                  data-board-column-open="${escapeHtml(column.key)}"
                >
                  Ver todos (${escapeHtml(String(columnOrders.length))})
                </button>
              </div>
            `
            : ""
        }
      </article>
    `;
  }).join("");
};

const renderOrderCard = (order) => {
  const isSelected = adminState.selectedOrderId === order.id;
  const timingValue =
    order.timingMode === "scheduled" ? formatTime(order.scheduledFor || order.createdAt) : formatTime(order.createdAt);
  const orderFlowLabel = order.fulfillmentMode === "pickup" ? "Retirada" : "Entrega";
  const paymentLabel = getPaymentLabel(order.paymentMethod);
  const primaryAction = getPrimaryAction(order);
  const isScheduled = order.timingMode === "scheduled";
  const primaryItems = Array.isArray(order.items)
    ? order.items.filter((item) => item.type !== "addon" && item.name)
    : [];
  const fallbackItems = String(order.itemPreview || "")
    .split(",")
    .map((entry) => entry.replace(/\+\d+\s*item\(ns\)/i, "").trim())
    .filter(Boolean);
  const visibleItemLimit = 2;
  const visiblePrimaryItems = primaryItems.slice(0, visibleItemLimit);
  const visibleFallbackItems = fallbackItems.slice(0, visibleItemLimit);
  const displayItems =
    visiblePrimaryItems.length > 0
      ? visiblePrimaryItems.map((item) => ({
          label: item.name,
        }))
      : visibleFallbackItems.map((label) => ({
          label,
        }));
  const hiddenItemsCount =
    primaryItems.length > 0
      ? Math.max(primaryItems.length - visiblePrimaryItems.length, 0)
      : Math.max(fallbackItems.length - visibleFallbackItems.length, 0);
  const isReceived = order.status === "Recebido";
  const secondaryLine = [getOrderTypeLabel(order), orderFlowLabel].filter(Boolean).join(" • ");
  const statusKey = normalizeStatusKey(order.status);
  const visibleRowsCount = displayItems.length + (hiddenItemsCount > 0 ? 1 : 0);
  const reservedRowsCount = Math.max(visibleRowsCount, 3);
  const placeholderRowsCount = Math.max(reservedRowsCount - visibleRowsCount, 0);

  return `
    <article
      class="admin-order-card${isSelected ? " is-selected" : ""}"
      data-order-status-key="${escapeHtml(statusKey)}"
    >
      <button
        class="admin-order-card-select"
        type="button"
        data-order-select="${escapeHtml(order.id)}"
      >
        <div class="admin-order-card-top">
          ${
            isReceived
              ? `<span class="admin-order-card-state-chip">${escapeHtml("Novo")}</span>`
              : `<span class="admin-order-card-state-chip is-muted">${escapeHtml(isScheduled ? "Agendamento" : orderFlowLabel)}</span>`
          }
          <strong class="admin-order-card-time">${escapeHtml(timingValue)}</strong>
        </div>
        <div class="admin-order-card-customer">
          <strong>${escapeHtml(`Cliente: ${order.customerName}`)}</strong>
        </div>

        <div class="admin-order-card-copy">
          <p class="admin-order-card-line is-soft">${escapeHtml(secondaryLine)}</p>
          <strong class="admin-order-card-value">${escapeHtml(formatMoney(order.totalAmount || 0))}</strong>
        </div>

        <div class="admin-order-card-meta">
          <span>${escapeHtml(`${order.itemCount || 0} itens`)}</span>
          <span>${escapeHtml(paymentLabel)}</span>
        </div>

        <div class="admin-order-card-items${displayItems.length > 0 ? "" : " is-empty"}">
          ${displayItems
            .map(
              (item) => `
                <div class="admin-order-card-item-row">
                  <span>${escapeHtml(item.label)}</span>
                </div>
              `
            )
            .join("")}
          ${
            hiddenItemsCount > 0
              ? `
                <div class="admin-order-card-item-row is-more">
                  <span>${escapeHtml(`+ ${hiddenItemsCount} outro(s) item(ns)`)}</span>
                </div>
              `
              : ""
          }
          ${Array.from({ length: placeholderRowsCount })
            .map(
              () => `
                <div class="admin-order-card-item-row is-placeholder" aria-hidden="true">
                  <span>&nbsp;</span>
                </div>
              `
            )
            .join("")}
        </div>

        <div class="admin-order-card-footer">
          <small>${escapeHtml(getOrderWaitLabel(order))}</small>
          <span class="admin-order-card-action-hint">${escapeHtml(order.status)}</span>
        </div>
      </button>

      ${
        primaryAction
          ? `
            <div class="admin-order-card-actions">
              <button
                class="admin-action-button admin-order-card-primary-action is-${escapeHtml(primaryAction.tone)}"
                type="button"
                data-order-action="${escapeHtml(order.id)}"
                data-next-status="${escapeHtml(primaryAction.status)}"
                data-action-note="${escapeHtml(primaryAction.note)}"
                ${adminState.isUpdatingStatus ? "disabled" : ""}
              >
                ${escapeHtml(primaryAction.label)}
              </button>
            </div>
          `
          : ""
      }
    </article>
  `;
};

const renderDetailActionButtons = (order, actions) =>
  actions.length > 0
    ? actions
        .map(
          (action) => `
            <button
              class="admin-action-button admin-detail-action-button is-${escapeHtml(action.tone)}${
                action.tone === "danger" ? " is-secondary" : " is-highlighted"
              }"
              type="button"
              data-order-action="${escapeHtml(order.id)}"
              data-next-status="${escapeHtml(action.status)}"
              data-action-note="${escapeHtml(action.note)}"
              ${adminState.isUpdatingStatus ? "disabled" : ""}
            >
              ${escapeHtml(action.label)}
            </button>
          `
        )
        .join("")
    : `
      <div class="admin-inline-note">
        <strong>Pedido encerrado</strong>
        <span>Este pedido ja saiu da operacao ativa.</span>
      </div>
    `;

const renderOrderDetailHistoryMeta = (order) => `
  <span><strong>Status atual</strong>${escapeHtml(order.status)}</span>
  <span><strong>Criado em</strong>${escapeHtml(formatDateTime(order.createdAt))}</span>
  <span><strong>Atualizado em</strong>${escapeHtml(formatDateTime(order.updatedAt))}</span>
  <span><strong>Ultima observacao</strong>${escapeHtml(order.latestStatusNote || "Sem observacao operacional.")}</span>
`;

const renderOrderNotesBlock = (order) => `
  <section class="admin-detail-card admin-detail-card-notes">
    <div class="admin-detail-card-head">
      <h3>Observacoes</h3>
    </div>
    <div class="admin-detail-note-block">
      <p>${escapeHtml(order.customerNotes || order.latestStatusNote || "Sem observacoes registradas para este pedido.")}</p>
    </div>
  </section>
`;

const getOrderDisplayItems = (order) => {
  const items = Array.isArray(order?.items) ? order.items.filter((item) => item.name) : [];

  if (items.length > 0) {
    return items;
  }

  return String(order?.itemPreview || "")
    .split(",")
    .map((label, index) => ({
      id: `fallback-${index + 1}`,
      name: label.replace(/\+\d+\s*item\(ns\)/i, "").trim(),
      quantity: 1,
      totalPrice: 0,
      type: "product",
    }))
    .filter((item) => item.name);
};

const ensurePublicCatalogItems = async () => {
  if (adminState.publicCatalogItems instanceof Map || adminState.isLoadingPublicCatalog) {
    return;
  }

  adminState.isLoadingPublicCatalog = true;

  try {
    const payload = await fetchJson("/api/catalog");
    const catalogItems = [
      ...(Array.isArray(payload.items) ? payload.items : []),
      ...(Array.isArray(payload.sections)
        ? payload.sections.flatMap((section) => (Array.isArray(section?.items) ? section.items : []))
        : []),
    ];
    const catalogMap = new Map();

    catalogItems.forEach((item) => {
      if (!item || typeof item !== "object") {
        return;
      }

      buildCatalogLookupKeys(item).forEach((key) => {
        if (key && !catalogMap.has(key)) {
          catalogMap.set(key, item);
        }
      });
    });

    adminState.publicCatalogItems = catalogMap;
  } catch (error) {
    adminState.publicCatalogItems = new Map();
  } finally {
    adminState.isLoadingPublicCatalog = false;

    if (adminState.activeSection === "orders" && adminState.selectedOrder) {
      renderOrderDetails();
    }
  }
};

const renderOrderDetailItemsList = (order) => {
  const items = getOrderDisplayItems(order);

  if (items.length === 0) {
    return `
      <div class="admin-empty-inline">
        <span>Nenhum item encontrado neste pedido.</span>
      </div>
    `;
  }

  return items
    .map(
      (item) => `
        <article class="admin-detail-order-item">
          <span class="admin-detail-order-item-thumb" aria-hidden="true">
            ${
              getOrderItemThumbnailUrl(item)
                ? `<img src="${escapeHtml(getOrderItemThumbnailUrl(item))}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" />`
                : `<span class="admin-detail-order-item-badge">${escapeHtml(
                    String(item.name || "?").trim().charAt(0).toUpperCase() || "?"
                  )}</span>`
            }
          </span>
          <div class="admin-detail-order-item-copy">
            <strong>${escapeHtml(item.name)}</strong>
          </div>
          <span class="admin-detail-order-item-qty">${escapeHtml(`x${Number(item.quantity || 0) || 1}`)}</span>
          <strong class="admin-detail-order-item-price">${escapeHtml(
            Number(item.totalPrice || 0) > 0 ? formatMoney(item.totalPrice || 0) : "Incluso"
          )}</strong>
        </article>
      `
    )
    .join("");
};

const getOrderActionIconSvg = (status) => {
  switch (status) {
    case "Aceito":
      return '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5 9.2 17 19 7.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    case "Em preparo":
      return '<svg viewBox="0 0 24 24" fill="none"><path d="m13 3-7 10h5l-1 8 8-12h-5l0-6Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    case "Pronto":
      return '<svg viewBox="0 0 24 24" fill="none"><path d="M7 8h10M9 4h6M6 8v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8M10 12h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    case "Saiu para entrega":
    case "Retirada concluida":
      return '<svg viewBox="0 0 24 24" fill="none"><path d="M3 7h11v8H3zM14 10h3l3 3v2h-6M7 18a1.5 1.5 0 1 1 0 .01zm11 0a1.5 1.5 0 1 1 0 .01z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    case "Cancelado":
      return '<svg viewBox="0 0 24 24" fill="none"><path d="M9 9 15 15M15 9l-6 6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M5 7h14M10 7V5a2 2 0 0 1 4 0v2m-7 0 1 11a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    default:
      return '<svg viewBox="0 0 24 24" fill="none"><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.7"/></svg>';
  }
};

const renderOrderActionGrid = (order) => {
  const enabledActions = getOrderActions(order);
  const enabledByStatus = new Map(enabledActions.map((action) => [action.status, action]));
  const actionStages = [
    {
      label: "Aceitar pedido",
      status: "Aceito",
      tone: "success",
    },
    {
      label: "Em preparo",
      status: "Em preparo",
      tone: "primary",
    },
    {
      label: "Pronto",
      status: "Pronto",
      tone: "warning",
    },
    {
      label: order.fulfillmentMode === "pickup" ? "Concluir retirada" : "Saiu para entrega",
      status: order.fulfillmentMode === "pickup" ? "Retirada concluida" : "Saiu para entrega",
      tone: "info",
    },
  ];
  const cancelAction = enabledActions.find((action) => action.status === "Cancelado") || null;

  return `
    <div class="admin-detail-actions admin-detail-actions-grid">
      ${actionStages
        .map((stage) => {
          const enabledAction = enabledByStatus.get(stage.status) || null;

          if (!enabledAction) {
            return `
              <button
                class="admin-action-button admin-detail-action-button is-${escapeHtml(stage.tone)} is-disabled"
                type="button"
                disabled
              >
                <span class="admin-detail-action-content">
                  <span class="admin-detail-action-icon" aria-hidden="true">${getOrderActionIconSvg(stage.status)}</span>
                  <span>${escapeHtml(stage.label)}</span>
                </span>
              </button>
            `;
          }

          return `
            <button
              class="admin-action-button admin-detail-action-button is-${escapeHtml(stage.tone)}${
                stage.status === (getPrimaryAction(order)?.status || "") ? " is-highlighted" : ""
              }"
              type="button"
              data-order-action="${escapeHtml(order.id)}"
              data-next-status="${escapeHtml(enabledAction.status)}"
              data-action-note="${escapeHtml(enabledAction.note)}"
              ${adminState.isUpdatingStatus ? "disabled" : ""}
            >
              <span class="admin-detail-action-content">
                <span class="admin-detail-action-icon" aria-hidden="true">${getOrderActionIconSvg(stage.status)}</span>
                <span>${escapeHtml(stage.label)}</span>
              </span>
            </button>
          `;
        })
        .join("")}
    </div>
    ${
      cancelAction
        ? `
          <button
            class="admin-action-button admin-detail-action-button admin-detail-action-cancel is-secondary"
            type="button"
            data-order-action="${escapeHtml(order.id)}"
            data-next-status="${escapeHtml(cancelAction.status)}"
            data-action-note="${escapeHtml(cancelAction.note)}"
            ${adminState.isUpdatingStatus ? "disabled" : ""}
          >
            <span class="admin-detail-action-content">
              <span class="admin-detail-action-icon" aria-hidden="true">${getOrderActionIconSvg("Cancelado")}</span>
              <span>${escapeHtml("Cancelar pedido")}</span>
            </span>
          </button>
        `
        : ""
    }
  `;
};

const renderBoardModalOrderRow = (order) => `
  <button
    class="admin-board-modal-row"
    type="button"
    data-board-modal-order-select="${escapeHtml(order.id)}"
  >
    <div class="admin-board-modal-row-top">
      <div>
        <strong>${escapeHtml(`Cliente: ${order.customerName}`)}</strong>
        <small>${escapeHtml(order.publicId)}</small>
      </div>
      <span class="${getStatusClassName(order.status)}">${escapeHtml(order.status)}</span>
    </div>

    <div class="admin-board-modal-row-meta">
      <span>
        <small>Horario</small>
        <strong>${escapeHtml(
          order.timingMode === "scheduled" ? order.scheduledLabel || "--" : formatTime(order.createdAt)
        )}</strong>
      </span>
      <span>
        <small>Valor</small>
        <strong>${escapeHtml(formatMoney(order.totalAmount || 0))}</strong>
      </span>
      <span>
        <small>Fluxo</small>
        <strong>${escapeHtml(order.fulfillmentMode === "pickup" ? "Retirada" : "Entrega")}</strong>
      </span>
    </div>
  </button>
`;

const renderBoardColumnModal = () => {
  const modalRoot = document.querySelector("[data-admin-board-modal]");

  if (!modalRoot) {
    return;
  }

  const canShowBoardModal =
    adminState.activeSection === "dashboard" || adminState.activeSection === "orders";
  const columnKey = canShowBoardModal ? adminState.expandedBoardColumnKey : "";
  const column = getBoardColumnDefinition(columnKey);
  const columnOrders = column ? getOrderedBoardColumnOrders(column.key) : [];
  const modalTitle = modalRoot.querySelector("[data-admin-board-modal-title]");
  const modalChip = modalRoot.querySelector("[data-admin-board-modal-chip]");
  const modalSubtitle = modalRoot.querySelector("[data-admin-board-modal-subtitle]");
  const modalSummary = modalRoot.querySelector("[data-admin-board-modal-summary]");
  const modalList = modalRoot.querySelector("[data-admin-board-modal-list]");
  const dialog = modalRoot.querySelector(".admin-board-modal-dialog");

  if (!column || columnOrders.length <= BOARD_VISIBLE_CARD_LIMIT) {
    modalRoot.hidden = true;
    modalRoot.setAttribute("aria-hidden", "true");
    document.body.classList.remove("admin-modal-open");

    if (dialog) {
      dialog.className = "admin-board-modal-dialog";
    }

    if (modalSummary) {
      modalSummary.innerHTML = "";
    }

    if (modalList) {
      modalList.innerHTML = "";
    }

    return;
  }

  if (dialog) {
    dialog.className = `admin-board-modal-dialog ${column.accentClass}`;
  }

  if (modalChip) {
    modalChip.textContent = `${column.label} em foco`;
  }

  if (modalTitle) {
    modalTitle.textContent = `Todos os pedidos de ${column.label.toLowerCase()}`;
  }

  if (modalSubtitle) {
    modalSubtitle.textContent = `Mostrando ${formatOrderCountLabel(
      columnOrders.length
    )} ordenados do mais antigo para o mais recente nesta etapa.`;
  }

  if (modalSummary) {
    modalSummary.innerHTML = `
      <span>
        <strong>${escapeHtml(String(columnOrders.length))}</strong>
        <small>${escapeHtml(formatOrderCountLabel(columnOrders.length))}</small>
      </span>
      <span>
        <strong>${escapeHtml(formatMoney(
          columnOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0)
        ))}</strong>
        <small>Total visivel desta etapa</small>
      </span>
      <span>
        <strong>${escapeHtml(
          columnOrders[0]
            ? columnOrders[0].timingMode === "scheduled"
              ? columnOrders[0].scheduledLabel || "--"
              : formatTime(columnOrders[0].createdAt)
            : "--"
        )}</strong>
        <small>Pedido mais antigo</small>
      </span>
    `;
  }

  if (modalList) {
    modalList.innerHTML = columnOrders.map(renderBoardModalOrderRow).join("");
  }

  modalRoot.hidden = false;
  modalRoot.setAttribute("aria-hidden", "false");
  document.body.classList.add("admin-modal-open");
};

const closeBoardColumnModal = () => {
  if (!adminState.expandedBoardColumnKey) {
    return;
  }

  adminState.expandedBoardColumnKey = "";
  renderBoardColumnModal();
};

const renderOrderItems = (items, itemType) => {
  const filteredItems = Array.isArray(items) ? items.filter((item) => item.type === itemType) : [];

  if (filteredItems.length === 0) {
    return `
      <div class="admin-empty-inline">
        <span>Nenhum item nesta secao.</span>
      </div>
    `;
  }

  return filteredItems
    .map((item) => {
      const metadata = item.metadata || {};
      const promotionLabel =
        item.type === "product" && metadata?.promotion?.name
          ? [
              `Promocao: ${metadata.promotion.name}`,
              typeof metadata.promotion.promotionalUnitPrice === "number"
                ? `Unitario ${formatMoney(metadata.promotion.promotionalUnitPrice)}`
                : "",
            ]
              .filter(Boolean)
              .join(" | ")
          : "";
      const extraInfo =
        item.type === "addon"
          ? `Cobrados: ${Number(metadata.chargedQuantity || 0)} | Gratis: ${Number(
              metadata.freeUnits || 0
            )}`
          : [item.category || "Item principal", promotionLabel].filter(Boolean).join(" | ");

      return `
        <article class="admin-detail-item">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <small>${escapeHtml(extraInfo)}</small>
          </div>
          <div class="admin-detail-item-meta">
            <span>${escapeHtml(`${item.quantity}x`)}</span>
            <strong>${escapeHtml(formatMoney(item.totalPrice || 0))}</strong>
          </div>
        </article>
      `;
    })
    .join("");
};

const renderStatusHistory = (history) => {
  if (!Array.isArray(history) || history.length === 0) {
    return `
      <div class="admin-empty-inline">
        <span>Sem atualizacoes registradas ate o momento.</span>
      </div>
    `;
  }

  return history
    .map(
      (entry) => `
        <article class="admin-status-event">
          <div class="admin-status-event-top">
            <div class="admin-status-event-title">
              <strong>${escapeHtml(
                entry.actionLabel || getAuditActionLabel(entry.action, entry.status)
              )}</strong>
              <small class="admin-status-event-date-inline">${escapeHtml(`${formatDate(entry.createdAt)} ${formatTime(entry.createdAt)}`)}</small>
            </div>
          </div>
          <p>${escapeHtml(
            [getAuditActorLabel(entry), entry.note || "Atualizacao operacional registrada."]
              .filter(Boolean)
              .join(" | ")
          )}</p>
        </article>
      `
    )
    .join("");
};

const renderAuditList = (events) => {
  if (!Array.isArray(events) || events.length === 0) {
    return `
      <div class="admin-empty-state admin-empty-state-soft">
        <strong>Nenhum evento encontrado</strong>
        <span>Ajuste os filtros para ampliar a consulta da auditoria operacional.</span>
      </div>
    `;
  }

  return events
    .map(
      (entry) => `
        <button class="admin-audit-event" type="button" data-order-select="${escapeHtml(entry.orderId)}">
          <div class="admin-audit-event-top">
            <div>
              <span class="admin-chip">${escapeHtml(entry.publicId || entry.orderId)}</span>
              <strong>${escapeHtml(entry.actionLabel || getAuditActionLabel(entry.action, entry.status))}</strong>
            </div>
            <small>${escapeHtml(formatDateTime(entry.createdAt))}</small>
          </div>
          <div class="admin-audit-event-meta">
            <span>${escapeHtml(getAuditActorLabel(entry))}</span>
            <span>${escapeHtml(entry.customerName || "Pedido operacional")}</span>
            <span>${escapeHtml(entry.status || "Sem status")}</span>
          </div>
          <p>${escapeHtml(entry.note || "Atualizacao operacional registrada.")}</p>
        </button>
      `
    )
    .join("");
};

const renderCustomerDetails = () => {
  const detailRoot = document.querySelector("[data-admin-order-detail]");
  const detailTitle = document.querySelector("[data-admin-detail-title]");
  const detailSubtitle = document.querySelector("[data-admin-detail-subtitle]");
  const customer = getSelectedCustomerCrmRecord();

  if (!detailRoot) {
    return;
  }

  if (adminState.isLoadingCustomers && !adminState.customersSnapshot) {
    if (detailTitle) {
      detailTitle.textContent = "Carregando CRM";
    }

    if (detailSubtitle) {
      detailSubtitle.textContent = "Buscando clientes nos pedidos.";
    }

    detailRoot.innerHTML = `
      <div class="admin-empty-state admin-empty-state-loading">
        <strong>Carregando perfil</strong>
        <span>A carteira de clientes esta sendo consolidada.</span>
      </div>
    `;
    return;
  }

  if (!customer) {
    if (detailTitle) {
      detailTitle.textContent = "Selecione um cliente";
    }

    if (detailSubtitle) {
      detailSubtitle.textContent = "Os detalhes do cliente aparecem aqui conforme a carteira for carregada.";
    }

    detailRoot.innerHTML = `
      <div class="admin-empty-state admin-empty-state-soft">
        <strong>Nenhum cliente selecionado</strong>
        <span>Escolha um cliente no modulo para ver recorrencia, receita e pedidos recentes.</span>
      </div>
    `;
    return;
  }

  if (detailTitle) {
    detailTitle.textContent = customer.customerName;
  }

  if (detailSubtitle) {
    detailSubtitle.textContent = `${customer.ordersCount} pedido(s) | ${getCustomerDaysSinceLabel(customer)}`;
  }

  detailRoot.innerHTML = `
    <section class="admin-detail-hero">
      <div class="admin-detail-hero-main">
        <div>
          <span class="admin-chip">Cliente selecionado</span>
          <h3>${escapeHtml(customer.customerName)}</h3>
          <p>${escapeHtml(customer.customerPhone || customer.customerEmail || "Contato nao informado")}</p>
        </div>
        <span class="admin-order-status ${customer.isLapsed ? "is-cancelled" : "is-confirmed"}">${escapeHtml(
          customer.isLapsed ? "Sumiu" : customer.isRecurring ? "Recorrente" : "Cliente"
        )}</span>
      </div>

      <div class="admin-detail-hero-meta">
        <span><strong>Pedidos</strong>${escapeHtml(String(customer.ordersCount))}</span>
        <span><strong>Total gasto</strong>${escapeHtml(formatMoney(customer.totalSpent || 0))}</span>
        <span><strong>Ticket medio</strong>${escapeHtml(formatMoney(customer.averageTicket || 0))}</span>
      </div>
    </section>

    ${
      adminState.actionMessage
        ? `<div class="admin-feedback is-${escapeHtml(adminState.actionTone || "success")}">${escapeHtml(adminState.actionMessage)}</div>`
        : ""
    }

    <section class="admin-detail-card">
      <div class="admin-detail-card-head">
        <h3>Perfil do cliente</h3>
        <span>${escapeHtml(customer.suggestedAction || "Mandar mensagem no WhatsApp")}</span>
      </div>
      <div class="admin-detail-fields">
        <span><strong>Telefone</strong>${escapeHtml(customer.customerPhone || "Nao informado")}</span>
        <span><strong>E-mail</strong>${escapeHtml(customer.customerEmail || "Nao informado")}</span>
        <span><strong>Ultima compra</strong>${escapeHtml(formatDateTime(customer.lastPurchaseAt || ""))}</span>
        <span><strong>Ultimo status</strong>${escapeHtml(customer.lastStatus || "Nao informado")}</span>
        <span><strong>Endereco mais usado</strong>${escapeHtml(customer.mostUsedAddress || "Nao informado")}</span>
        <span><strong>Pedido recente</strong>${escapeHtml(customer.lastOrderPublicId || "Nao informado")}</span>
      </div>
      <div class="admin-customer-profile-actions">
        ${
          customer.whatsappUrl
            ? `<a class="admin-action-button is-primary" href="${escapeHtml(customer.whatsappUrl)}" target="_blank" rel="noopener" data-customer-whatsapp>WhatsApp</a>`
            : '<button class="admin-action-button is-primary" type="button" disabled>WhatsApp</button>'
        }
      </div>
    </section>

    <section class="admin-detail-card">
      <div class="admin-detail-card-head">
        <h3>Tags e observacoes</h3>
        <span>${customer.updatedAt ? `Salvo em ${escapeHtml(formatDateTime(customer.updatedAt))}` : "Sem anotacao salva"}</span>
      </div>
      <div class="admin-customer-tag-toggle-list">
        ${CUSTOMER_CRM_TAG_OPTIONS.filter((option) => option.key)
          .map(
            (option) => `
              <button
                class="admin-customer-tag-toggle${customer.tags.includes(option.key) ? " is-active" : ""}"
                type="button"
                data-customer-tag-toggle="${escapeHtml(option.key)}"
                data-customer-key="${escapeHtml(customer.customerKey)}"
                ${adminState.isSavingCustomerProfile ? "disabled" : ""}
              >
                ${escapeHtml(option.label)}
              </button>
            `
          )
          .join("")}
      </div>
      <form class="admin-customer-notes-form" data-customer-notes-form>
        <input type="hidden" name="customerKey" value="${escapeHtml(customer.customerKey)}" />
        <textarea class="admin-input admin-textarea" name="notes" rows="5" placeholder="Observacoes internas para a equipe." ${adminState.isSavingCustomerProfile ? "disabled" : ""}>${escapeHtml(customer.notes || "")}</textarea>
        <button class="admin-button admin-button-primary" type="submit" ${adminState.isSavingCustomerProfile ? "disabled" : ""}>
          ${adminState.isSavingCustomerProfile ? "Salvando..." : "Salvar observacao"}
        </button>
      </form>
    </section>

    <section class="admin-detail-card">
      <div class="admin-detail-card-head">
        <h3>Itens mais pedidos</h3>
        <span>${escapeHtml(String(customer.topItems.length))} item(ns)</span>
      </div>
      <div class="admin-customer-top-items">
        ${
          customer.topItems.length > 0
            ? customer.topItems
                .map(
                  (item) => `
                    <div class="admin-customer-top-item">
                      <div>
                        <strong>${escapeHtml(item.name || "Item")}</strong>
                        <small>${escapeHtml(item.category || "Sem categoria")}</small>
                      </div>
                      <span>${escapeHtml(String(item.quantity || item.ordersCount || 0))}x</span>
                    </div>
                  `
                )
                .join("")
            : '<div class="admin-empty-state admin-empty-state-soft"><strong>Sem itens agregados</strong><span>Os itens aparecem quando os pedidos trouxerem detalhes do carrinho.</span></div>'
        }
      </div>
    </section>

    <section class="admin-detail-card">
      <div class="admin-detail-card-head">
        <h3>Historico de pedidos</h3>
        <span>${escapeHtml(String(customer.orders.length))} registro(s)</span>
      </div>
      <div class="admin-status-history">
        ${customer.orders
          .slice(0, 12)
          .map(
            (order) => `
              <button class="admin-history-order" type="button" data-order-select="${escapeHtml(order.id)}">
                <div>
                  <strong>${escapeHtml(order.publicId)}</strong>
                  <small>${escapeHtml(formatDateTime(order.createdAt))}</small>
                </div>
                <div class="admin-history-order-meta">
                  <span class="${getStatusClassName(order.status)}">${escapeHtml(order.status)}</span>
                  <strong>${escapeHtml(formatMoney(order.totalAmount || 0))}</strong>
                </div>
                <small class="admin-customer-order-items">${escapeHtml(
                  (Array.isArray(order.items) && order.items.length > 0
                    ? order.items
                        .slice(0, 3)
                        .map((item) => `${item.quantity || 1}x ${item.name}`)
                        .join(" | ")
                    : order.itemPreview || "Sem itens detalhados")
                )}</small>
              </button>
            `
          )
          .join("")}
      </div>
    </section>
  `;
};

const renderReviewDetails = () => {
  const detailRoot = document.querySelector("[data-admin-order-detail]");
  const detailTitle = document.querySelector("[data-admin-detail-title]");
  const detailSubtitle = document.querySelector("[data-admin-detail-subtitle]");
  const review = getSelectedReview();
  const summary = getReviewsSnapshot().summary || {};

  if (!detailRoot) {
    return;
  }

  if (!review) {
    if (detailTitle) {
      detailTitle.textContent = "Selecione uma avaliacao";
    }

    if (detailSubtitle) {
      detailSubtitle.textContent = "Abra um registro para ver comentario, contato e janela de publicacao.";
    }

    detailRoot.innerHTML = `
      <section class="admin-detail-hero">
        <div class="admin-detail-hero-main">
          <div>
            <span class="admin-chip">Reputacao do site</span>
            <h3>${escapeHtml(String(summary.totalReviews || 0))} avaliacoes no gestor</h3>
            <p>Use os filtros para separar feedback publicado, oculto, encerrado e o recorte recente de 60 dias.</p>
          </div>
          <span class="admin-order-status is-confirmed">Avaliacoes</span>
        </div>
        <div class="admin-detail-hero-meta">
          <span><strong>Publicadas</strong>${escapeHtml(String(summary.publishedReviews || 0))}</span>
          <span><strong>Ocultas</strong>${escapeHtml(String(summary.hiddenReviews || 0))}</span>
          <span><strong>Media</strong>${escapeHtml(String(Number(summary.displayAverage || 0).toFixed(1)))}</span>
        </div>
      </section>
    `;
    return;
  }

  if (detailTitle) {
    detailTitle.textContent = review.customerName || "Avaliacao selecionada";
  }

  if (detailSubtitle) {
    detailSubtitle.innerHTML = `
      <span class="${getReviewStatusClassName(review.status)}">${escapeHtml(
        review.statusLabel || "Avaliacao"
      )}</span>
      <span class="admin-detail-head-meta-item">
        <strong>Nota</strong>
        <span>${escapeHtml(`${review.rating || 0}/5`)}</span>
      </span>
      <span class="admin-detail-head-meta-item">
        <strong>Janela</strong>
        <span>${escapeHtml(review.publicationLabel || "Automatica")}</span>
      </span>
      <span class="admin-detail-head-meta-item">
        <strong>Recebida</strong>
        <span>${escapeHtml(formatDateTime(review.createdAt))}</span>
      </span>
    `;
  }

  detailRoot.innerHTML = `
    <section class="admin-detail-hero">
      <div class="admin-detail-hero-main">
        <div>
          <span class="admin-chip">Avaliacao selecionada</span>
          <h3>${escapeHtml(buildReviewStars(review.rating))}</h3>
          <p>${escapeHtml(review.remainingLabel || "Sem janela ativa")}</p>
        </div>
        <span class="${getReviewStatusClassName(review.status)}">${escapeHtml(
          review.statusLabel || "Avaliacao"
        )}</span>
      </div>

      <div class="admin-detail-hero-meta">
        <span><strong>Nota</strong>${escapeHtml(`${review.rating || 0}/5`)}</span>
        <span><strong>Publicacao</strong>${escapeHtml(review.publicationLabel || "Automatica")}</span>
        <span><strong>Site</strong>${escapeHtml(review.isVisibleNow ? "Visivel" : "Fora do site")}</span>
      </div>
    </section>

    <section class="admin-detail-card">
      <div class="admin-detail-card-head">
        <h3>Comentario</h3>
        <span>${escapeHtml(formatDateTime(review.createdAt))}</span>
      </div>
      <div class="admin-detail-section">
        <div class="admin-empty-inline admin-empty-inline-review">
          <span>${escapeHtml(review.message || "Sem comentario informado.")}</span>
        </div>
      </div>
    </section>

    <section class="admin-detail-card">
      <div class="admin-detail-card-head">
        <h3>Cliente e origem</h3>
        <span>${escapeHtml(review.source || "site")}</span>
      </div>
      <div class="admin-detail-fields">
        <span><strong>Nome</strong>${escapeHtml(review.customerName || "Nao informado")}</span>
        <span><strong>Contato</strong>${escapeHtml(
          review.customerContact || review.customerPhone || review.customerEmail || "Nao informado"
        )}</span>
        <span><strong>Telefone</strong>${escapeHtml(review.customerPhone || "Nao informado")}</span>
        <span><strong>E-mail</strong>${escapeHtml(review.customerEmail || "Nao informado")}</span>
        <span><strong>Cliente vinculado</strong>${escapeHtml(review.customerKey || "Nao informado")}</span>
        <span><strong>Perfil</strong>${escapeHtml(review.profileId || "Nao informado")}</span>
      </div>
    </section>

    <section class="admin-detail-card">
      <div class="admin-detail-card-head">
        <h3>Publicacao automatica</h3>
        <span>${escapeHtml(review.statusLabel || "Avaliacao")}</span>
      </div>
      <div class="admin-detail-fields">
        <span><strong>Status</strong>${escapeHtml(review.statusLabel || "Nao informado")}</span>
        <span><strong>Recebida em</strong>${escapeHtml(formatDateTime(review.createdAt))}</span>
        <span><strong>Atualizada em</strong>${escapeHtml(formatDateTime(review.updatedAt))}</span>
        <span><strong>Vai ate</strong>${escapeHtml(formatDateTime(review.publishUntil))}</span>
        <span><strong>Regra por nota</strong>${escapeHtml(review.publicationLabel || "Nao informado")}</span>
        <span><strong>Recente 60d</strong>${escapeHtml(review.isRecent ? "Sim" : "Nao")}</span>
      </div>
    </section>

    <section class="admin-detail-card admin-detail-card-actions">
      <div class="admin-detail-card-head">
        <h3>Acoes da avaliacao</h3>
        <span>Controle operacional</span>
      </div>
      <section class="admin-detail-actions admin-detail-actions-final">
        <button
          class="admin-action-button is-info"
          type="button"
          data-review-visibility="${escapeHtml(review.id)}"
          data-review-next-visibility="${review.visibilityState === "hidden" ? "automatic" : "hidden"}"
          ${adminState.reviewBusyId === review.id ? "disabled" : ""}
        >
          ${escapeHtml(
            review.visibilityState === "hidden" ? "Restaurar publicacao" : "Ocultar do site"
          )}
        </button>
        <button
          class="admin-action-button is-danger"
          type="button"
          data-review-delete="${escapeHtml(review.id)}"
          ${adminState.reviewBusyId === review.id ? "disabled" : ""}
        >
          Remover avaliacao
        </button>
      </section>
    </section>
  `;
};

const renderInventoryDetails = () => {
  const detailRoot = document.querySelector("[data-admin-order-detail]");
  const detailTitle = document.querySelector("[data-admin-detail-title]");
  const detailSubtitle = document.querySelector("[data-admin-detail-subtitle]");
  const snapshot = getInventorySnapshot();
  const summary = snapshot.summary || {};
  const selectedItem = getSelectedInventoryItem();
  const isNewItem = adminState.selectedInventoryItemId === INVENTORY_NEW_ITEM_ID || !selectedItem;
  const draftItem = selectedItem || {
    id: "",
    name: "",
    category: adminState.inventoryFilters.category || snapshot.categories[0] || "",
    quantity: 0,
    unit: "unidade",
    minimumQuantity: 0,
    expirationDate: "",
    status: INVENTORY_STATUS_META.ok,
    expiration: { label: "Sem validade" },
  };
  const isBusy = Boolean(adminState.inventoryBusyKey);

  if (!detailRoot) {
    return;
  }

  if (detailTitle) {
    detailTitle.textContent = isNewItem ? "Novo item de estoque" : draftItem.name;
  }

  if (detailSubtitle) {
    detailSubtitle.textContent = isNewItem
      ? "Cadastre um item manual sem duplicar os produtos importados do checklist."
      : `${draftItem.category} | ${formatInventoryQuantity(draftItem.quantity)} ${draftItem.unit}`;
  }

  detailRoot.innerHTML = `
    <section class="admin-detail-hero admin-inventory-detail-hero">
      <div class="admin-detail-hero-main">
        <div>
          <span class="admin-chip">Estoque ativo</span>
          <h3>${escapeHtml(String(summary.totalItems || 0))} itens</h3>
          <p>${escapeHtml(
            `${summary.criticalItems || 0} critico(s), ${summary.lowItems || 0} baixo(s), ${summary.expiringSoonItems || 0} perto de vencer.`
          )}</p>
        </div>
        <span class="admin-order-status is-confirmed">Estoque</span>
      </div>
      <div class="admin-detail-hero-meta">
        <span><strong>Categorias</strong>${escapeHtml(String(summary.totalCategories || 0))}</span>
        <span><strong>Importados</strong>${escapeHtml(String(summary.importedItems || 0))}</span>
        <span><strong>Vencidos</strong>${escapeHtml(String(summary.expiredItems || 0))}</span>
      </div>
    </section>

    <section class="admin-detail-card">
      <div class="admin-detail-card-head">
        <h3>${escapeHtml(isNewItem ? "Criar item" : "Editar item")}</h3>
        <span>${escapeHtml(isNewItem ? "Cadastro manual" : draftItem.status?.label || "OK")}</span>
      </div>
      <form class="admin-inventory-form" data-inventory-item-form>
        <input type="hidden" name="itemId" value="${escapeHtml(draftItem.id)}" />
        <label class="admin-field admin-field-wide">
          <span>Nome</span>
          <input class="admin-input" name="name" value="${escapeHtml(draftItem.name)}" required />
        </label>
        <label class="admin-field">
          <span>Categoria</span>
          <input
            class="admin-input"
            name="category"
            list="inventory-category-options"
            value="${escapeHtml(draftItem.category)}"
            required
          />
        </label>
        <label class="admin-field">
          <span>Unidade</span>
          <input class="admin-input" name="unit" value="${escapeHtml(draftItem.unit)}" placeholder="kg, g, unidade..." />
        </label>
        <label class="admin-field">
          <span>Quantidade atual</span>
          <input class="admin-input" name="quantity" type="number" min="0" step="0.001" value="${escapeHtml(String(draftItem.quantity || 0))}" />
        </label>
        <label class="admin-field">
          <span>Quantidade minima</span>
          <input class="admin-input" name="minimumQuantity" type="number" min="0" step="0.001" value="${escapeHtml(String(draftItem.minimumQuantity || 0))}" />
        </label>
        <label class="admin-field admin-field-wide">
          <span>Validade</span>
          <input class="admin-input" name="expirationDate" type="date" value="${escapeHtml(draftItem.expirationDate || "")}" />
        </label>
        <datalist id="inventory-category-options">
          ${snapshot.categories.map((category) => `<option value="${escapeHtml(category)}"></option>`).join("")}
        </datalist>
        <button class="admin-button admin-button-primary" type="submit" ${isBusy ? "disabled" : ""}>
          Salvar item
        </button>
      </form>
    </section>

    ${
      selectedItem
        ? `
          <section class="admin-detail-card">
            <div class="admin-detail-card-head">
              <h3>Movimentar estoque</h3>
              <span>${escapeHtml(`${formatInventoryQuantity(selectedItem.quantity)} ${selectedItem.unit}`)}</span>
            </div>
            <div class="admin-inventory-adjust-grid">
              <form class="admin-inventory-adjust-card is-add" data-inventory-adjust-form data-inventory-adjust-mode="add">
                <input type="hidden" name="itemId" value="${escapeHtml(selectedItem.id)}" />
                <label class="admin-field">
                  <span>Entrada</span>
                  <input class="admin-input" name="amount" type="number" min="0.001" step="0.001" placeholder="Ex: 2" required />
                </label>
                <button class="admin-action-button is-primary" type="submit" ${isBusy ? "disabled" : ""}>
                  Adicionar estoque
                </button>
              </form>
              <form class="admin-inventory-adjust-card is-remove" data-inventory-adjust-form data-inventory-adjust-mode="remove">
                <input type="hidden" name="itemId" value="${escapeHtml(selectedItem.id)}" />
                <label class="admin-field">
                  <span>Saida</span>
                  <input class="admin-input" name="amount" type="number" min="0.001" step="0.001" placeholder="Ex: 0.5" required />
                </label>
                <button class="admin-action-button is-danger" type="submit" ${isBusy ? "disabled" : ""}>
                  Dar baixa
                </button>
              </form>
            </div>
          </section>
        `
        : ""
    }

    ${adminState.actionMessage ? `<div class="admin-feedback is-${escapeHtml(adminState.actionTone || "success")}">${escapeHtml(adminState.actionMessage)}</div>` : ""}
  `;
};

const renderOrderDetails = () => {
  const detailRoot = document.querySelector("[data-admin-order-detail]");
  const detailTitle = document.querySelector("[data-admin-detail-title]");
  const detailSubtitle = document.querySelector("[data-admin-detail-subtitle]");
  const sectionMeta = getSectionMeta();

  if (!detailRoot) {
    return;
  }

  if (adminState.activeSection === "customers") {
    renderCustomerDetails();
    return;
  }

  if (adminState.activeSection === "reviews") {
    renderReviewDetails();
    return;
  }

  if (adminState.activeSection === "inventory") {
    renderInventoryDetails();
    return;
  }

  if (adminState.isLoadingOrderDetails && !adminState.selectedOrder) {
    if (detailTitle) {
      detailTitle.textContent = "Carregando pedido";
    }

    if (detailSubtitle) {
      detailSubtitle.textContent = "Buscando os dados completos da operacao.";
    }

    detailRoot.innerHTML = `
      <div class="admin-empty-state admin-empty-state-soft admin-empty-state-loading">
        <strong>Carregando detalhes</strong>
        <span>Assim que a API responder, os detalhes completos aparecem aqui.</span>
      </div>
    `;
    return;
  }

  const order = adminState.selectedOrder;

  if (!order) {
    if (detailTitle) {
      detailTitle.textContent =
        adminState.activeSection === "finance" ||
        adminState.activeSection === "reports" ||
        adminState.activeSection === "metrics" ||
        adminState.activeSection === "scheduled" ||
        adminState.activeSection === "menu" ||
        adminState.activeSection === "promotions"
          ? sectionMeta.title
          : "Selecione um pedido";
    }

    if (detailSubtitle) {
      detailSubtitle.textContent =
        adminState.activeSection === "finance" ||
        adminState.activeSection === "reports" ||
        adminState.activeSection === "metrics" ||
        adminState.activeSection === "scheduled" ||
        adminState.activeSection === "menu" ||
        adminState.activeSection === "promotions"
          ? sectionMeta.description
          : "Abra um card do kanban para acompanhar a operacao.";
    }

    if (adminState.activeSection === "finance") {
      const snapshot = getFinanceSnapshot();
      const overview = snapshot.overview || {};
      const closing = snapshot.closing || {};
      detailRoot.innerHTML = `
        <section class="admin-detail-hero">
          <div class="admin-detail-hero-main">
            <div>
              <span class="admin-chip">Fechamento</span>
              <h3>${escapeHtml(formatMoney(closing.totalExpected || overview.receivedRevenue || 0))}</h3>
              <p>${escapeHtml(snapshot.filters?.rangeLabel || "Periodo financeiro atual")}</p>
            </div>
            <span class="admin-order-status is-finished">Financeiro</span>
          </div>
          <div class="admin-detail-hero-meta">
            <span><strong>Liquido</strong>${escapeHtml(formatMoney(overview.netRevenue || 0))}</span>
            <span><strong>Repasse</strong>${escapeHtml(formatMoney(overview.deliveryPayout || 0))}</span>
            <span><strong>Diferenca</strong>${escapeHtml(formatMoney(closing.difference || 0))}</span>
          </div>
        </section>
      `;
      return;
    }

    if (adminState.activeSection === "reports") {
      const reports = getReportOverview();
      detailRoot.innerHTML = `
        <section class="admin-detail-hero">
          <div class="admin-detail-hero-main">
            <div>
              <span class="admin-chip">Leitura do turno</span>
              <h3>${escapeHtml(String(reports.visibleOrders.length))} pedidos</h3>
              <p>Resumo de operacao baseado no conjunto visivel do gestor.</p>
            </div>
            <span class="admin-order-status is-confirmed">Relatorios</span>
          </div>
          <div class="admin-detail-hero-meta">
            <span><strong>Entrega</strong>${escapeHtml(
              String(reports.fulfillmentBreakdown.find((entry) => entry.label === "Entrega")?.value || 0)
            )}</span>
            <span><strong>Retirada</strong>${escapeHtml(
              String(reports.fulfillmentBreakdown.find((entry) => entry.label === "Retirada")?.value || 0)
            )}</span>
            <span><strong>Agendados</strong>${escapeHtml(
              String(reports.fulfillmentBreakdown.find((entry) => entry.label === "Agendados")?.value || 0)
            )}</span>
          </div>
        </section>
      `;
      return;
    }

    if (adminState.activeSection === "metrics") {
      const metricsSnapshot = getMetricsSnapshot();
      const metricsOverview = metricsSnapshot?.overview || {};
      const firstResponseMetric = getMetricStage("firstResponse");
      detailRoot.innerHTML = `
        <section class="admin-detail-hero">
          <div class="admin-detail-hero-main">
            <div>
              <span class="admin-chip">Leitura gerencial</span>
              <h3>${escapeHtml(String(metricsOverview.totalOrders || 0))} pedidos no recorte</h3>
              <p>Use os filtros do modulo para alternar periodo, admin, status e fluxo sem sair do gestor.</p>
            </div>
            <span class="admin-order-status is-confirmed">Metricas</span>
          </div>
          <div class="admin-detail-hero-meta">
            <span><strong>Conclusao</strong>${escapeHtml(formatPercent(metricsOverview.completionRate || 0))}</span>
            <span><strong>Cancelamento</strong>${escapeHtml(formatPercent(metricsOverview.cancellationRate || 0))}</span>
            <span><strong>Resposta</strong>${escapeHtml(formatDuration(firstResponseMetric?.averageMs || 0))}</span>
          </div>
        </section>
      `;
      return;
    }

    if (adminState.activeSection === "audit") {
      const auditOverview = getAuditOverview();
      detailRoot.innerHTML = `
        <section class="admin-detail-hero">
          <div class="admin-detail-hero-main">
            <div>
              <span class="admin-chip">Auditoria ativa</span>
              <h3>${escapeHtml(String(auditOverview.totalEvents))} eventos</h3>
              <p>Selecione um evento para abrir o pedido correspondente e seguir a trilha operacional.</p>
            </div>
            <span class="admin-order-status is-confirmed">Auditoria</span>
          </div>
          <div class="admin-detail-hero-meta">
            <span><strong>Usuarios</strong>${escapeHtml(String(auditOverview.uniqueAdmins))}</span>
            <span><strong>Pedidos</strong>${escapeHtml(String(auditOverview.uniqueOrders))}</span>
            <span><strong>Ultimo</strong>${escapeHtml(
              auditOverview.lastEventAt ? formatDateTime(auditOverview.lastEventAt) : "Sem eventos"
            )}</span>
          </div>
        </section>
      `;
      return;
    }

    if (adminState.activeSection === "scheduled") {
      const scheduledSnapshot = getScheduledSnapshot();
      detailRoot.innerHTML = `
        <section class="admin-detail-hero">
          <div class="admin-detail-hero-main">
            <div>
              <span class="admin-chip">Agenda ativa</span>
              <h3>${escapeHtml(String(scheduledSnapshot.summary?.totalOrders || 0))} pedidos futuros</h3>
              <p>Os pedidos agendados ficam aqui ate o horario programado e depois entram sozinhos no fluxo ativo.</p>
            </div>
            <span class="admin-order-status is-confirmed">Agendados</span>
          </div>
          <div class="admin-detail-hero-meta">
            <span><strong>Entrega</strong>${escapeHtml(String(scheduledSnapshot.summary?.deliveryOrders || 0))}</span>
            <span><strong>Retirada</strong>${escapeHtml(String(scheduledSnapshot.summary?.pickupOrders || 0))}</span>
            <span><strong>Proximos</strong>${escapeHtml(String(scheduledSnapshot.summary?.dueSoonOrders || 0))}</span>
          </div>
        </section>
      `;
      return;
    }

    if (adminState.activeSection === "menu") {
      const menuSummary = adminState.menuSnapshot?.summary || {};
      detailRoot.innerHTML = `
        <section class="admin-detail-hero">
          <div class="admin-detail-hero-main">
            <div>
              <span class="admin-chip">Cardapio vivo</span>
              <h3>${escapeHtml(String(menuSummary.totalItems || 0))} itens gerenciados</h3>
              <p>O painel controla categorias, fotos, destaque da home e disponibilidade do site sem editar o codigo do cardapio.</p>
            </div>
            <span class="admin-order-status is-confirmed">Cardapio</span>
          </div>
          <div class="admin-detail-hero-meta">
            <span><strong>Ativos</strong>${escapeHtml(String(menuSummary.activeItems || 0))}</span>
            <span><strong>Pausados</strong>${escapeHtml(String(menuSummary.pausedItems || 0))}</span>
            <span><strong>Destaques</strong>${escapeHtml(String(menuSummary.highlightedItems || 0))}</span>
          </div>
        </section>
      `;
      return;
    }

    if (adminState.activeSection === "promotions") {
      const promotionsSummary = getPromotionsSnapshot().summary || {};
      const selectedPromotion = getSelectedPromotion();

      if (selectedPromotion) {
        if (detailTitle) {
          detailTitle.textContent = selectedPromotion.internalName;
        }

        if (detailSubtitle) {
          detailSubtitle.textContent = `${selectedPromotion.statusLabel} | ${selectedPromotion.targetLabel}`;
        }

        detailRoot.innerHTML = `
          <section class="admin-detail-hero">
            <div class="admin-detail-hero-main">
              <div>
                <span class="admin-chip">Promocao selecionada</span>
                <h3>${escapeHtml(selectedPromotion.internalName)}</h3>
                <p>${escapeHtml(getPromotionDateRangeLabel(selectedPromotion))}</p>
              </div>
              <span class="${getPromotionStatusClassName(selectedPromotion.status)}">${escapeHtml(
                selectedPromotion.statusLabel
              )}</span>
            </div>
            <div class="admin-detail-hero-meta">
              <span><strong>Escopo</strong>${escapeHtml(selectedPromotion.scopeLabel)}</span>
              <span><strong>Vinculo</strong>${escapeHtml(selectedPromotion.targetLabel)}</span>
              <span><strong>Valor</strong>${escapeHtml(getPromotionPricingValueLabel(selectedPromotion))}</span>
            </div>
          </section>

          <section class="admin-detail-card">
            <div class="admin-detail-card-head">
              <h3>Operacao da campanha</h3>
              <span>${escapeHtml(`${selectedPromotion.appliedItemsCount || 0} item(ns) aplicando agora`)}</span>
            </div>
            <div class="admin-detail-fields">
              <span><strong>Status</strong>${escapeHtml(selectedPromotion.statusLabel)}</span>
              <span><strong>Periodo</strong>${escapeHtml(getPromotionDateRangeLabel(selectedPromotion))}</span>
              <span><strong>Preco final</strong>${escapeHtml(getPromotionPricePreviewLabel(selectedPromotion))}</span>
              <span><strong>Itens afetados</strong>${escapeHtml(String(selectedPromotion.affectedItemsCount || 0))}</span>
              <span><strong>Habilitada</strong>${escapeHtml(selectedPromotion.isEnabled ? "Sim" : "Nao")}</span>
              <span><strong>Ultima alteracao</strong>${escapeHtml(
                selectedPromotion.updatedAt ? formatDateTime(selectedPromotion.updatedAt) : "Sem registro"
              )}</span>
            </div>
          </section>

          <section class="admin-detail-card">
            <div class="admin-detail-card-head">
              <h3>Itens vinculados</h3>
              <span>${escapeHtml(String(selectedPromotion.affectedItemsCount || 0))} item(ns)</span>
            </div>
            <div class="admin-detail-list">
              ${
                Array.isArray(selectedPromotion.affectedItems) && selectedPromotion.affectedItems.length > 0
                  ? selectedPromotion.affectedItems
                      .map(
                        (item) => `
                          <article class="admin-detail-item">
                            <div>
                              <strong>${escapeHtml(item.name)}</strong>
                              <small>${escapeHtml(item.category || "Categoria")}</small>
                            </div>
                            <div class="admin-detail-item-meta">
                              <span>${escapeHtml(item.availabilityState || "active")}</span>
                              <strong>${escapeHtml(
                                typeof item.regularPrice === "number" ? formatMoney(item.regularPrice) : "Sem preco"
                              )}</strong>
                            </div>
                          </article>
                        `
                      )
                      .join("")
                  : `
                    <div class="admin-empty-inline">
                      <span>Nenhum item vinculado a esta promocao.</span>
                    </div>
                  `
              }
            </div>
          </section>
        `;
        return;
      }

      detailRoot.innerHTML = `
        <section class="admin-detail-hero">
          <div class="admin-detail-hero-main">
            <div>
              <span class="admin-chip">Campanhas ativas</span>
              <h3>${escapeHtml(String(promotionsSummary.totalPromotions || 0))} promocoes registradas</h3>
              <p>Crie campanhas com vigencia automatica e reflexo consistente no site e no fechamento do pedido.</p>
            </div>
            <span class="admin-order-status is-confirmed">Promocoes</span>
          </div>
          <div class="admin-detail-hero-meta">
            <span><strong>Ativas</strong>${escapeHtml(String(promotionsSummary.activePromotions || 0))}</span>
            <span><strong>Agendadas</strong>${escapeHtml(String(promotionsSummary.scheduledPromotions || 0))}</span>
            <span><strong>Encerradas</strong>${escapeHtml(String(promotionsSummary.endedPromotions || 0))}</span>
          </div>
        </section>
      `;
      return;
    }

    detailRoot.innerHTML = `
      <div class="admin-empty-state admin-empty-state-soft">
        <strong>Nenhum pedido aberto</strong>
        <span>Escolha um card para ver endereco, itens, pagamento e historico do pedido.</span>
      </div>
    `;
    return;
  }

  if (detailTitle) {
    detailTitle.textContent = "Detalhes do pedido";
  }

  if (!(adminState.publicCatalogItems instanceof Map) && !adminState.isLoadingPublicCatalog) {
    void ensurePublicCatalogItems();
  }

  const publicIdLabel = String(order.publicId || "").trim().startsWith("#")
    ? String(order.publicId || "").trim()
    : `#${String(order.publicId || "").trim()}`;
  const customerPhoneDigits = String(order.customerPhone || "").replace(/\D/g, "");
  const whatsappLink =
    customerPhoneDigits.length >= 10 ? `https://wa.me/55${escapeHtml(customerPhoneDigits)}` : "";

  if (detailSubtitle) {
    detailSubtitle.innerHTML = `
      <span class="admin-detail-head-code">${escapeHtml(`Pedido ${publicIdLabel}`)}</span>
    `;
  }

  const topScheduleLabel = order.timingMode === "scheduled" ? getDetailHeaderTimingValue(order) : formatTime(order.createdAt);
  const topRemainingLabel =
    order.timingMode === "scheduled" ? getScheduledTimeDistanceLabel(order) : getOrderWaitLabel(order);

  detailRoot.innerHTML = `
    <section class="admin-detail-identity">
      <div class="admin-detail-identity-copy">
        <h3 class="admin-detail-customer-title">${escapeHtml(order.customerName)}</h3>
        <div class="admin-detail-identity-meta">
          <span class="${getStatusClassName(order.status)}">${escapeHtml(order.status)}</span>
          <span class="admin-detail-head-type">${escapeHtml(
            order.timingMode === "scheduled" ? "Agendamento" : getOrderTypeLabel(order)
          )}</span>
          <span class="admin-detail-order-code">${escapeHtml(`Pedido ${publicIdLabel}`)}</span>
        </div>
      </div>
      <p class="admin-detail-customer-subtitle">${escapeHtml(
        [
          order.timingMode === "scheduled" ? "Agendamento" : getOrderTypeLabel(order),
          order.fulfillmentMode === "pickup" ? "Retirada" : "Delivery",
        ]
          .filter(Boolean)
          .join(" • ")
      )}</p>
    </section>

    <section class="admin-detail-card admin-detail-card-top-summary">
      <div class="admin-detail-summary-grid admin-detail-summary-grid-top">
        <article class="admin-detail-summary-tile">
          <strong>${escapeHtml(order.timingMode === "scheduled" ? "Agendado para" : "Horario do pedido")}</strong>
          ${escapeHtml(topScheduleLabel)}
        </article>
        <article class="admin-detail-summary-tile is-emphasis">
          <strong>${escapeHtml(order.timingMode === "scheduled" ? "Tempo restante" : "Tempo de espera")}</strong>
          ${escapeHtml(topRemainingLabel)}
        </article>
      </div>
    </section>

    <section class="admin-detail-card admin-detail-card-customer">
      <div class="admin-detail-card-head">
        <h3>Cliente</h3>
      </div>
      <div class="admin-detail-customer-stack">
        <div class="admin-detail-customer-row">
          <div class="admin-detail-customer-field">
            <span class="admin-detail-field-label">Cliente</span>
            <strong class="admin-detail-customer-name">${escapeHtml(order.customerName)}</strong>
          </div>
          <div class="admin-detail-customer-field admin-detail-customer-since">
            <span class="admin-detail-field-label">Cliente desde</span>
            <strong>${escapeHtml(formatDate(order.createdAt))}</strong>
          </div>
        </div>
        <div class="admin-detail-customer-row is-contact">
          <div class="admin-detail-customer-field admin-detail-customer-phone">
            <span class="admin-detail-field-label">Telefone</span>
            <div class="admin-detail-customer-inline">
              ${
                whatsappLink
                  ? `<a href="${whatsappLink}" target="_blank" rel="noreferrer">${escapeHtml(
                      order.customerPhone || "Nao informado"
                    )}<span class="admin-detail-whatsapp-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M20 11.9A8 8 0 0 1 8.4 19L4 20l1.2-4A8 8 0 1 1 20 11.9Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                        <path d="M9.7 9.5c.2-.4.5-.4.7-.4h.5c.2 0 .4 0 .5.4l.6 1.5c.1.3 0 .4-.1.6l-.3.4c-.1.1-.2.2-.1.4.2.4.8 1.3 1.8 2 .4.3.7.5 1 .6.2.1.3 0 .4-.1l.5-.6c.1-.1.3-.2.5-.1l1.4.6c.2.1.4.2.4.5v.4c0 .3-.2.7-.5.9-.5.3-1.1.4-1.7.3-1-.2-2-.7-3.1-1.7-1.2-1.2-2-2.4-2.2-3.6-.1-.6.1-1.2.4-1.7Z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </span></a>`
                  : escapeHtml(order.customerPhone || "Nao informado")
              }
            </div>
            ${
              order.addressReference
                ? `<small class="admin-detail-customer-reference">${escapeHtml(order.addressReference)}</small>`
                : ""
            }
          </div>
        </div>
      </div>
    </section>

    <section class="admin-detail-card admin-detail-card-summary">
      <div class="admin-detail-card-head">
        <h3>Resumo do pedido</h3>
      </div>
      <div class="admin-detail-summary-list">
        <span class="admin-detail-summary-item"><strong>Tipo</strong><span>${escapeHtml(getOrderTypeLabel(order))}</span></span>
        <span class="admin-detail-summary-item"><strong>Total</strong><span>${escapeHtml(formatMoney(order.totalAmount || 0))}</span></span>
        <span class="admin-detail-summary-item"><strong>Entrega</strong><span>${escapeHtml(
          order.fulfillmentMode === "pickup" ? "Balcao" : "Delivery"
        )}</span></span>
        <span class="admin-detail-summary-item"><strong>Itens</strong><span>${escapeHtml(
          String(order.itemCount || 0)
        )}</span></span>
        <span class="admin-detail-summary-item"><strong>Pagamento</strong><span>${escapeHtml(
          getPaymentLabel(order.paymentMethod)
        )}</span></span>
        <span class="admin-detail-summary-item"><strong>Taxa entrega</strong><span>${escapeHtml(
          formatMoney(order.deliveryFee || 0)
        )}</span></span>
      </div>
    </section>

    ${renderOrderOperationalStatusCard(order)}

    <section class="admin-detail-card admin-detail-card-items">
      <div class="admin-detail-card-head">
        <h3>${escapeHtml(`Itens do pedido (${order.itemCount || 0})`)}</h3>
      </div>
      <div class="admin-detail-order-items-list">${renderOrderDetailItemsList(order)}</div>
      <div class="admin-detail-inline-link">Ver todos os itens</div>
    </section>

    ${renderOrderNotesBlock(order)}

    <section class="admin-detail-card admin-detail-card-history">
      <div class="admin-detail-card-head">
        <h3>Historico do pedido</h3>
      </div>
      <div class="admin-status-history">${renderStatusHistory(order.auditTrail)}</div>
    </section>

    <section class="admin-detail-card admin-detail-card-actions">
      <div class="admin-detail-card-head">
        <h3>Acoes</h3>
      </div>
      ${renderOrderActionGrid(order)}
      <div
        class="admin-feedback admin-detail-feedback"
        data-admin-detail-feedback
        ${adminState.actionMessage ? "" : "hidden"}
      >${escapeHtml(adminState.actionMessage || "")}</div>
    </section>
  `;

  const feedbackNode = detailRoot.querySelector("[data-admin-detail-feedback]");
  setFeedback(feedbackNode, adminState.actionMessage, adminState.actionTone);
};

const applySelectedOrderToList = (order) => {
  adminState.orders = adminState.orders.map((entry) =>
    entry.id === order.id ? normalizeOrderRecord({ ...entry, ...order }) : entry
  );
};

const pickDefaultOrderId = () => {
  if (adminState.activeSection === "scheduled") {
    return getVisibleScheduledOrders()[0]?.id || getScheduledSnapshot().orders[0]?.id || "";
  }

  if (adminState.activeSection === "menu") {
    return "";
  }

  if (adminState.activeSection === "promotions") {
    return "";
  }

  const firstOperationalOrder = getVisibleOperationalOrders()[0];

  if (firstOperationalOrder) {
    return firstOperationalOrder.id;
  }

  return adminState.orders[0]?.id || "";
};

const loadOrderDetails = async (orderId, { showLoading = true } = {}) => {
  adminState.selectedOrderId = orderId;

  if (showLoading) {
    adminState.isLoadingOrderDetails = true;
    renderModuleContent();
    renderOrderDetails();
  }

  const requestId = ++detailRequestSequence;

  try {
    const payload = await fetchJson(`/api/admin/orders/details?orderId=${encodeURIComponent(orderId)}`);

    if (requestId !== detailRequestSequence) {
      return;
    }

    adminState.selectedOrder = normalizeOrderRecord(payload.order || null);
    adminState.isLoadingOrderDetails = false;
    adminState.storageMode = payload.storageMode || adminState.storageMode;

    if (adminState.selectedOrder) {
      applySelectedOrderToList(adminState.selectedOrder);
    }

    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  } catch (error) {
    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.isLoadingOrderDetails = false;
    adminState.actionMessage = error.message || "Nao foi possivel carregar o pedido selecionado.";
    adminState.actionTone = "error";
    renderOrderDetails();
  }
};

const loadAuditLog = async ({ preserveSelection = true, silent = false } = {}) => {
  adminState.isLoadingAudit = !silent;

  if (!silent && adminState.activeSection === "audit") {
    renderModuleContent();
  }

  try {
    const query = new URLSearchParams();
    query.set("limit", String(adminState.auditFilters.limit || 60));

    if (adminState.auditFilters.adminLogin) {
      query.set("adminLogin", adminState.auditFilters.adminLogin);
    }

    if (adminState.auditFilters.action) {
      query.set("action", adminState.auditFilters.action);
    }

    if (adminState.auditFilters.orderQuery) {
      query.set("orderQuery", adminState.auditFilters.orderQuery);
    }

    const payload = await fetchJson(`/api/admin/audit?${query.toString()}`);

    adminState.auditEvents = Array.isArray(payload.events)
      ? payload.events.map(normalizeAuditLogEntry)
      : [];
    adminState.auditAdminOptions = Array.isArray(payload.adminOptions) ? payload.adminOptions : [];
    adminState.auditActionOptions = Array.isArray(payload.actionOptions) && payload.actionOptions.length > 0
      ? payload.actionOptions
      : Object.entries(AUDIT_ACTION_LABELS).map(([key, label]) => ({ key, label }));
    adminState.isLoadingAudit = false;

    const selectedOrderStillVisible =
      preserveSelection &&
      adminState.selectedOrderId &&
      adminState.auditEvents.some((entry) => entry.orderId === adminState.selectedOrderId);

    if (adminState.activeSection === "audit" && !selectedOrderStillVisible) {
      adminState.selectedOrderId = adminState.auditEvents[0]?.orderId || adminState.selectedOrderId;
      if (adminState.selectedOrder?.id !== adminState.selectedOrderId) {
        adminState.selectedOrder = null;
      }
    }

    renderSidebarNav();

    if (adminState.activeSection === "audit") {
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
    }
  } catch (error) {
    adminState.isLoadingAudit = false;

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel carregar a auditoria operacional.";
    adminState.actionTone = "error";

    if (adminState.activeSection === "audit") {
      renderModuleContent();
      renderOrderDetails();
    }
  }
};

const loadMetrics = async ({ silent = false } = {}) => {
  adminState.isLoadingMetrics = !silent;

  if (!silent && adminState.activeSection === "metrics") {
    renderModuleContent();
  }

  try {
    const query = new URLSearchParams();
    query.set("period", String(adminState.metricsFilters.period || "7d"));

    if (adminState.metricsFilters.startDate) {
      query.set("startDate", String(adminState.metricsFilters.startDate || "").trim());
    }

    if (adminState.metricsFilters.endDate) {
      query.set("endDate", String(adminState.metricsFilters.endDate || "").trim());
    }

    if (adminState.metricsFilters.adminLogin) {
      query.set("adminLogin", String(adminState.metricsFilters.adminLogin || "").trim());
    }

    if (adminState.metricsFilters.status) {
      query.set("status", String(adminState.metricsFilters.status || "").trim());
    }

    if (adminState.metricsFilters.flow) {
      query.set("flow", String(adminState.metricsFilters.flow || "").trim());
    }

    const payload = await fetchJson(`/api/admin/metrics?${query.toString()}`);
    adminState.metricsSnapshot = payload;
    adminState.metricsFilters = {
      period: payload.filters?.period || adminState.metricsFilters.period || "7d",
      startDate: payload.filters?.startDate || "",
      endDate: payload.filters?.endDate || "",
      adminLogin: payload.filters?.adminLogin || "",
      status: payload.filters?.status || "",
      flow: payload.filters?.flow || "",
    };
    adminState.generatedAt = payload.generatedAt || adminState.generatedAt;
    adminState.storageMode = payload.storageMode || adminState.storageMode;
    adminState.isLoadingMetrics = false;

    if (adminState.activeSection === "metrics") {
      renderSidebarNav();
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
    }
  } catch (error) {
    adminState.isLoadingMetrics = false;

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel carregar as metricas operacionais.";
    adminState.actionTone = "error";

    if (adminState.activeSection === "metrics") {
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
    }
  }
};

const loadScheduledOrders = async ({ preserveSelection = true, silent = false } = {}) => {
  adminState.isLoadingScheduled = !silent;

  if (!silent && adminState.activeSection === "scheduled") {
    renderModuleContent();
  }

  try {
    const query = new URLSearchParams();

    if (adminState.scheduledFilters.date) {
      query.set("date", String(adminState.scheduledFilters.date || "").trim());
    }

    if (adminState.scheduledFilters.fulfillmentMode) {
      query.set(
        "fulfillmentMode",
        String(adminState.scheduledFilters.fulfillmentMode || "").trim()
      );
    }

    const payload = await fetchJson(`/api/admin/scheduled?${query.toString()}`);

    adminState.scheduledSnapshot = {
      summary: payload.summary || {
        totalOrders: 0,
        deliveryOrders: 0,
        pickupOrders: 0,
        dueSoonOrders: 0,
        nextScheduledAt: "",
      },
      filters: payload.filters || { ...adminState.scheduledFilters },
      orders: Array.isArray(payload.orders) ? payload.orders.map(normalizeOrderRecord) : [],
    };
    adminState.scheduledFilters = {
      date: payload.filters?.date || "",
      fulfillmentMode: payload.filters?.fulfillmentMode || "",
    };
    adminState.generatedAt = payload.generatedAt || adminState.generatedAt;
    adminState.storageMode = payload.storageMode || adminState.storageMode;
    adminState.isLoadingScheduled = false;

    const selectionStillVisible =
      preserveSelection &&
      adminState.selectedOrderId &&
      adminState.scheduledSnapshot.orders.some((order) => order.id === adminState.selectedOrderId);

    if (adminState.activeSection === "scheduled" && !selectionStillVisible) {
      adminState.selectedOrderId = getVisibleScheduledOrders()[0]?.id || adminState.scheduledSnapshot.orders[0]?.id || "";

      if (adminState.selectedOrder?.id !== adminState.selectedOrderId) {
        adminState.selectedOrder = null;
      }
    }

    renderSidebarNav();

    if (adminState.activeSection === "scheduled") {
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
    }
  } catch (error) {
    adminState.isLoadingScheduled = false;

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel carregar os pedidos agendados.";
    adminState.actionTone = "error";

    if (adminState.activeSection === "scheduled") {
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
    }
  }
};

const loadMenuCatalog = async ({ silent = false } = {}) => {
  adminState.isLoadingMenu = !silent;

  if (!silent && adminState.activeSection === "menu") {
    renderModuleContent();
  }

  try {
    const payload = await fetchJson("/api/admin/catalog/list");

    adminState.menuSnapshot = {
      summary: payload.summary || {
        totalSections: 0,
        totalItems: 0,
        activeItems: 0,
        pausedItems: 0,
        unavailableItems: 0,
        promotedItems: 0,
        highlightedItems: 0,
        itemsWithoutPrice: 0,
      },
      sections: Array.isArray(payload.sections) ? payload.sections : [],
      sectionDisplayOrder: Array.isArray(payload.sectionDisplayOrder) ? payload.sectionDisplayOrder : [],
      featuredItemId: String(payload.featuredItemId || "").trim(),
      featuredItemIds: Array.isArray(payload.featuredItemIds)
        ? payload.featuredItemIds.map((itemId) => String(itemId || "").trim()).filter(Boolean)
        : [],
      catalogOptions: payload.catalogOptions || {
        sections: [],
        categories: [],
      },
    };
    adminState.generatedAt = payload.generatedAt || adminState.generatedAt;
    adminState.storageMode = payload.storageMode || adminState.storageMode;
    adminState.isLoadingMenu = false;

    renderSidebarNav();

    if (adminState.activeSection === "menu") {
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
    }
  } catch (error) {
    adminState.isLoadingMenu = false;

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel carregar o catalogo administrativo.";
    adminState.actionTone = "error";

    if (adminState.activeSection === "menu") {
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
    }
  }
};

const loadPromotions = async ({ preserveSelection = true, silent = false, preferredPromotionId = "" } = {}) => {
  adminState.isLoadingPromotions = !silent;

  if (!silent && adminState.activeSection === "promotions") {
    renderModuleContent();
  }

  try {
    const payload = await fetchJson("/api/admin/promotions/list");
    const promotions = Array.isArray(payload.promotions) ? payload.promotions : [];
    const nextSelectedPromotionId = String(preferredPromotionId || adminState.selectedPromotionId || "").trim();
    const selectedPromotionStillVisible =
      preserveSelection &&
      nextSelectedPromotionId &&
      promotions.some((promotion) => promotion.id === nextSelectedPromotionId);

    adminState.promotionsSnapshot = {
      summary: payload.summary || {
        totalPromotions: 0,
        activePromotions: 0,
        scheduledPromotions: 0,
        endedPromotions: 0,
        enabledPromotions: 0,
        affectedItems: 0,
      },
      promotions,
      catalogOptions: payload.catalogOptions || {
        items: [],
        categories: [],
      },
    };
    adminState.generatedAt = payload.generatedAt || adminState.generatedAt;
    adminState.storageMode = payload.storageMode || adminState.storageMode;
    adminState.isLoadingPromotions = false;

    if (adminState.activeSection === "promotions") {
      adminState.selectedPromotionId = selectedPromotionStillVisible
        ? nextSelectedPromotionId
        : getVisiblePromotions()[0]?.id || promotions[0]?.id || "";
      renderSidebarNav();
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
      return;
    }

    renderSidebarNav();
    updateSidebarMeta();
  } catch (error) {
    adminState.isLoadingPromotions = false;

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel carregar as promocoes administrativas.";
    adminState.actionTone = "error";

    if (adminState.activeSection === "promotions") {
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
      return;
    }

    updateSidebarMeta();
  }
};

const loadReviews = async ({ preserveSelection = true, silent = false, preferredReviewId = "" } = {}) => {
  adminState.isLoadingReviews = !silent;

  if (!silent && adminState.activeSection === "reviews") {
    renderModuleContent();
  }

  try {
    const payload = await fetchJson("/api/admin/reviews/list");
    const reviews = Array.isArray(payload.reviews) ? payload.reviews : [];
    const nextSelectedReviewId = String(preferredReviewId || adminState.selectedReviewId || "").trim();
    const selectedReviewStillVisible =
      preserveSelection &&
      nextSelectedReviewId &&
      reviews.some((review) => review.id === nextSelectedReviewId);

    adminState.reviewsSnapshot = {
      summary: payload.summary || {
        totalReviews: 0,
        publishedReviews: 0,
        hiddenReviews: 0,
        expiredReviews: 0,
        recentReviews: 0,
        internalAverage: 0,
        displayAverage: 0,
      },
      reviews,
    };
    adminState.generatedAt = payload.generatedAt || adminState.generatedAt;
    adminState.storageMode = payload.storageMode || adminState.storageMode;
    adminState.isLoadingReviews = false;

    if (adminState.activeSection === "reviews") {
      adminState.selectedReviewId = selectedReviewStillVisible
        ? nextSelectedReviewId
        : getVisibleReviews()[0]?.id || reviews[0]?.id || "";
      renderSidebarNav();
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
      return;
    }

    renderSidebarNav();
    updateSidebarMeta();
  } catch (error) {
    adminState.isLoadingReviews = false;

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel carregar as avaliacoes administrativas.";
    adminState.actionTone = "error";

    if (adminState.activeSection === "reviews") {
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
      return;
    }

    updateSidebarMeta();
  }
};

const loadDeliverySettings = async ({ silent = false } = {}) => {
  adminState.isLoadingDeliverySettings = !silent;

  if (!silent && adminState.activeSection === "deliveries") {
    renderModuleContent();
  }

  try {
    const payload = await fetchJson("/api/admin/delivery-settings/list");
    const settings = cloneDeliverySettingsDraft(payload.settings || DELIVERY_SETTINGS_DEFAULT_DRAFT);

    adminState.deliverySettingsSnapshot = {
      summary: payload.summary || {},
      settings,
    };
    adminState.deliverySettingsDraft = cloneDeliverySettingsDraft(settings);
    adminState.generatedAt = payload.generatedAt || adminState.generatedAt;
    adminState.storageMode = payload.storageMode || adminState.storageMode;
    adminState.isLoadingDeliverySettings = false;

    if (adminState.activeSection === "deliveries") {
      renderSidebarNav();
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
      return;
    }

    renderSidebarNav();
    updateSidebarMeta();
  } catch (error) {
    adminState.isLoadingDeliverySettings = false;

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel carregar as configuracoes de entrega.";
    adminState.actionTone = "error";

    if (adminState.activeSection === "deliveries") {
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
      return;
    }

    updateSidebarMeta();
  }
};

const loadRestaurantSettings = async ({ silent = false } = {}) => {
  adminState.isLoadingRestaurantSettings = !silent;

  if (!silent && adminState.activeSection === "settings") {
    renderModuleContent();
  }

  try {
    const payload = await fetchJson("/api/admin/settings/list");
    const settings = cloneRestaurantSettingsDraft(
      payload.settings || RESTAURANT_SETTINGS_DEFAULT_DRAFT
    );

    adminState.restaurantSettingsSnapshot = {
      summary: payload.summary || {},
      settings,
    };
    adminState.restaurantSettingsDraft = cloneRestaurantSettingsDraft(settings);
    adminState.generatedAt = payload.generatedAt || adminState.generatedAt;
    adminState.storageMode = payload.storageMode || adminState.storageMode;
    adminState.isLoadingRestaurantSettings = false;

    if (adminState.activeSection === "settings") {
      renderSidebarNav();
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
      return;
    }

    renderSidebarNav();
    updateSidebarMeta();
  } catch (error) {
    adminState.isLoadingRestaurantSettings = false;

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel carregar as configuracoes.";
    adminState.actionTone = "error";

    if (adminState.activeSection === "settings") {
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
      return;
    }

    updateSidebarMeta();
  }
};

const loadUsers = async ({ preserveSelection = true, silent = false } = {}) => {
  adminState.isLoadingUsers = !silent;

  if (!silent && adminState.activeSection === "users") {
    renderModuleContent();
  }

  try {
    const payload = await fetchJson("/api/admin/users/list");
    syncAdminAccessFromPayload(payload.admin);

    adminState.usersSnapshot = payload;
    adminState.generatedAt = payload.generatedAt || adminState.generatedAt;
    adminState.storageMode = payload.storageMode || adminState.storageMode;
    adminState.isLoadingUsers = false;

    const users = Array.isArray(payload.users) ? payload.users : [];
    const selectedUserStillExists =
      preserveSelection &&
      adminState.selectedUserLogin &&
      users.some((user) => user.login === adminState.selectedUserLogin);

    if (!selectedUserStillExists && adminState.selectedUserLogin !== NEW_ADMIN_USER_LOGIN) {
      adminState.selectedUserLogin = users[0]?.login || "";
    }

    renderSidebarNav();

    if (adminState.activeSection === "users") {
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
      return;
    }

    updateSidebarMeta();
  } catch (error) {
    adminState.isLoadingUsers = false;

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel carregar os usuarios.";
    adminState.actionTone = "error";

    if (adminState.activeSection === "users") {
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
      return;
    }

    updateSidebarMeta();
  }
};

const loadFinance = async ({ silent = false } = {}) => {
  adminState.isLoadingFinance = !silent;

  if (!silent && adminState.activeSection === "finance") {
    renderModuleContent();
  }

  try {
    const query = new URLSearchParams();
    query.set("period", String(adminState.financeFilters.period || "today"));

    if (adminState.financeFilters.startDate) {
      query.set("startDate", String(adminState.financeFilters.startDate || "").trim());
    }

    if (adminState.financeFilters.endDate) {
      query.set("endDate", String(adminState.financeFilters.endDate || "").trim());
    }

    const payload = await fetchJson(`/api/admin/finance?${query.toString()}`);

    adminState.financeSnapshot = payload;
    adminState.financeFilters = {
      period: payload.filters?.period || adminState.financeFilters.period || "today",
      startDate: payload.filters?.startDate || "",
      endDate: payload.filters?.endDate || "",
    };
    adminState.generatedAt = payload.generatedAt || adminState.generatedAt;
    adminState.storageMode = payload.storageMode || adminState.storageMode;
    adminState.isLoadingFinance = false;

    if (adminState.activeSection === "finance") {
      renderSidebarNav();
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
    }
  } catch (error) {
    adminState.isLoadingFinance = false;

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel carregar o financeiro.";
    adminState.actionTone = "error";

    if (adminState.activeSection === "finance") {
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
    }
  }
};

const loadInventory = async ({ preserveSelection = true, silent = false } = {}) => {
  adminState.isLoadingInventory = !silent;

  if (!silent && adminState.activeSection === "inventory") {
    renderModuleContent();
  }

  try {
    const payload = await fetchJson("/api/admin/inventory/list");

    adminState.inventorySnapshot = normalizeInventorySnapshot(payload);
    adminState.generatedAt = payload.generatedAt || adminState.generatedAt;
    adminState.storageMode = payload.storageMode || adminState.storageMode;
    adminState.isLoadingInventory = false;

    const selectedItemStillAvailable =
      preserveSelection &&
      adminState.selectedInventoryItemId &&
      getInventorySnapshot().items.some((item) => item.id === adminState.selectedInventoryItemId);
    const isCreatingInventoryItem = adminState.selectedInventoryItemId === INVENTORY_NEW_ITEM_ID;

    if (adminState.activeSection === "inventory" && !selectedItemStillAvailable && !isCreatingInventoryItem) {
      adminState.selectedInventoryItemId = getVisibleInventoryItems()[0]?.id || INVENTORY_NEW_ITEM_ID;
    }

    renderSidebarNav();

    if (adminState.activeSection === "inventory") {
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
    }
  } catch (error) {
    adminState.isLoadingInventory = false;

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel carregar o estoque.";
    adminState.actionTone = "error";

    if (adminState.activeSection === "inventory") {
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
    }
  }
};

const loadCustomers = async ({ preserveSelection = true, silent = false } = {}) => {
  adminState.isLoadingCustomers = !silent;

  if (!silent && adminState.activeSection === "customers") {
    renderModuleContent();
    renderOrderDetails();
  }

  try {
    const payload = await fetchJson("/api/admin/customers/list");
    const nextSnapshot = normalizeCustomerCrmSnapshot(payload);
    const nextSelectedKey = String(adminState.selectedCustomerKey || "").trim();

    adminState.customersSnapshot = nextSnapshot;
    adminState.generatedAt = payload.generatedAt || adminState.generatedAt;
    adminState.storageMode = payload.storageMode || adminState.storageMode;
    adminState.isLoadingCustomers = false;

    const selectionStillAvailable =
      preserveSelection &&
      nextSelectedKey &&
      nextSnapshot.customers.some((customer) => customer.key === nextSelectedKey);

    if (adminState.activeSection === "customers") {
      adminState.selectedCustomerKey = selectionStillAvailable
        ? nextSelectedKey
        : getVisibleCustomerCrmRecords()[0]?.key || nextSnapshot.customers[0]?.key || "";
      renderSidebarNav();
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
      return;
    }

    renderSidebarNav();
    updateSidebarMeta();
  } catch (error) {
    adminState.isLoadingCustomers = false;

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel carregar o CRM de clientes.";
    adminState.actionTone = "error";

    if (adminState.activeSection === "customers") {
      renderModuleContent();
      renderOrderDetails();
      updateSidebarMeta();
      return;
    }

    updateSidebarMeta();
  }
};

const getCustomerNotesDraftFromDom = () => {
  const notesField = document.querySelector("[data-customer-notes-form] textarea[name='notes']");
  return notesField ? String(notesField.value || "").trim() : "";
};

const saveCustomerProfile = async ({ customerKey, notes, tags } = {}) => {
  const selectedCustomer = getSelectedCustomerCrmRecord();
  const targetCustomerKey = String(customerKey || selectedCustomer?.customerKey || "").trim();

  if (!targetCustomerKey) {
    return;
  }

  adminState.isSavingCustomerProfile = true;
  adminState.actionMessage = "";
  adminState.actionTone = "success";
  renderOrderDetails();

  try {
    const response = await fetchJson("/api/admin/customers/save", {
      method: "POST",
      body: JSON.stringify({
        customerKey: targetCustomerKey,
        notes: typeof notes === "string" ? notes : selectedCustomer?.notes || "",
        tags: Array.isArray(tags) ? tags : selectedCustomer?.tags || [],
      }),
    });

    adminState.customersSnapshot = normalizeCustomerCrmSnapshot(response);
    adminState.selectedCustomerKey = targetCustomerKey;
    adminState.generatedAt = response.generatedAt || adminState.generatedAt;
    adminState.storageMode = response.storageMode || adminState.storageMode;
    adminState.isSavingCustomerProfile = false;
    adminState.actionMessage = response.message || "Perfil do cliente salvo com sucesso.";
    adminState.actionTone = "success";

    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  } catch (error) {
    adminState.isSavingCustomerProfile = false;
    adminState.actionMessage = error.message || "Nao foi possivel salvar o perfil do cliente.";
    adminState.actionTone = "error";

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  }
};

const saveFinanceClosing = async (form) => {
  const formData = new FormData(form);

  adminState.isSavingFinanceClosing = true;
  adminState.actionMessage = "";
  adminState.actionTone = "success";
  renderModuleContent();

  try {
    const response = await fetchJson("/api/admin/finance", {
      method: "POST",
      body: JSON.stringify({
        filters: adminState.financeFilters,
        closing: {
          countedCash: normalizeDecimalInput(formData.get("countedCash")),
          notes: String(formData.get("notes") || "").trim(),
        },
      }),
    });

    adminState.financeSnapshot = response;
    adminState.financeFilters = {
      period: response.filters?.period || adminState.financeFilters.period || "today",
      startDate: response.filters?.startDate || "",
      endDate: response.filters?.endDate || "",
    };
    adminState.generatedAt = response.generatedAt || adminState.generatedAt;
    adminState.storageMode = response.storageMode || adminState.storageMode;
    adminState.isSavingFinanceClosing = false;
    adminState.actionMessage = response.message || "Fechamento financeiro salvo com sucesso.";
    adminState.actionTone = "success";

    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  } catch (error) {
    adminState.isSavingFinanceClosing = false;
    adminState.actionMessage = error.message || "Nao foi possivel salvar o fechamento financeiro.";
    adminState.actionTone = "error";

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  }
};

const saveDeliverySettings = async () => {
  const draft = syncDeliverySettingsDraftFromDom();

  adminState.deliverySettingsSaving = true;
  adminState.actionMessage = "";
  adminState.actionTone = "success";
  renderModuleContent();

  try {
    const response = await fetchJson("/api/admin/delivery-settings/save", {
      method: "POST",
      body: JSON.stringify({ settings: draft }),
    });
    const settings = cloneDeliverySettingsDraft(response.settings || draft);

    adminState.deliverySettingsSnapshot = {
      summary: response.summary || {},
      settings,
    };
    adminState.deliverySettingsDraft = cloneDeliverySettingsDraft(settings);
    adminState.generatedAt = response.generatedAt || adminState.generatedAt;
    adminState.storageMode = response.storageMode || adminState.storageMode;
    adminState.deliverySettingsSaving = false;
    adminState.actionMessage = response.message || "Configuracoes de entrega salvas com sucesso.";
    adminState.actionTone = "success";

    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  } catch (error) {
    adminState.deliverySettingsSaving = false;
    adminState.actionMessage = error.message || "Nao foi possivel salvar as configuracoes de entrega.";
    adminState.actionTone = "error";

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  }
};

const saveRestaurantSettings = async () => {
  const draft = syncRestaurantSettingsDraftFromDom();

  adminState.restaurantSettingsSaving = true;
  adminState.actionMessage = "";
  adminState.actionTone = "success";
  renderModuleContent();

  try {
    const response = await fetchJson("/api/admin/settings/save", {
      method: "POST",
      body: JSON.stringify({ settings: draft }),
    });
    const settings = cloneRestaurantSettingsDraft(response.settings || draft);

    adminState.restaurantSettingsSnapshot = {
      summary: response.summary || {},
      settings,
    };
    adminState.restaurantSettingsDraft = cloneRestaurantSettingsDraft(settings);
    adminState.generatedAt = response.generatedAt || adminState.generatedAt;
    adminState.storageMode = response.storageMode || adminState.storageMode;
    adminState.restaurantSettingsSaving = false;
    adminState.actionMessage = response.message || "Configuracoes salvas com sucesso.";
    adminState.actionTone = "success";

    renderSidebarNav();
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  } catch (error) {
    adminState.restaurantSettingsSaving = false;
    adminState.actionMessage = error.message || "Nao foi possivel salvar as configuracoes.";
    adminState.actionTone = "error";

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  }
};

const readAdminUserFormPayload = (form) => {
  const formData = new FormData(form);
  const selectedUser = getSelectedAdminUser();
  const email = String(formData.get("email") || "").trim();
  const userType = String(formData.get("userType") || selectedUser.userType || "GERENTE").trim();
  const userScope = normalizeAdminUserScope(formData.get("userScope") || selectedUser.userScope, userType);
  const permissions = {};

  form.querySelectorAll("[data-user-permission]").forEach((input) => {
    const permission = String(input.getAttribute("data-user-permission") || "").trim();

    if (permission) {
      permissions[permission] = input.checked === true;
    }
  });

  return {
    id: String(formData.get("id") || selectedUser.id || "").trim(),
    name: String(formData.get("name") || "").trim(),
    login: String(formData.get("login") || selectedUser.login || email).trim(),
    email,
    phone: String(formData.get("phone") || "").trim(),
    restaurantKey: userScope === "SYSTEM"
      ? ""
      : String(formData.get("restaurantKey") || selectedUser.restaurantKey || getCurrentUsersRestaurantKey()).trim(),
    status: String(formData.get("status") || selectedUser.status || "ACTIVE").trim(),
    userScope,
    platformScope: userScope === "SYSTEM",
    userType,
    password: String(formData.get("password") || ""),
    permissions: userType === "CUSTOM" ? permissions : {},
  };
};

const isValidAdminUserEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const isValidAdminUserPhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
};

const validateAdminUserFormPayload = (user, { isCreating = false } = {}) => {
  const users = Array.isArray(getUsersSnapshot().users) ? getUsersSnapshot().users : [];
  const userType = String(user.userType || "").trim().toUpperCase();
  const userScope = normalizeAdminUserScope(user.userScope, userType);
  const currentId = String(user.id || "").trim();
  const currentLogin = String(user.login || "").trim().toLowerCase();
  const currentEmail = String(user.email || "").trim().toLowerCase();

  if (!user.name) {
    return "Informe o nome do usuario.";
  }

  if (!currentEmail || !isValidAdminUserEmail(currentEmail)) {
    return "Informe um e-mail valido.";
  }

  if (!user.phone || !isValidAdminUserPhone(user.phone)) {
    return "Informe um telefone valido com DDD.";
  }

  if (userScope === "SYSTEM" && !SYSTEM_USER_TYPE_SET.has(userType)) {
    return "Usuario do sistema deve usar um perfil da plataforma INovas.";
  }

  if (userScope === "RESTAURANT" && !RESTAURANT_USER_TYPE_SET.has(userType)) {
    return "Usuario de restaurante deve usar um perfil operacional valido.";
  }

  if (userScope === "RESTAURANT" && !user.restaurantKey) {
    return "Informe o restaurante do usuario.";
  }

  if (!userType || !getAdminUserTypeOptions(userType, userScope).some((option) => option.key === userType)) {
    return "Selecione um perfil valido.";
  }

  if (isCreating && !user.password) {
    return "Informe a senha inicial do usuario.";
  }

  if (user.password && user.password.length < 6) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }

  const duplicateUser = users.find((entry) => {
    const sameRecord =
      (currentId && String(entry.id || "") === currentId) ||
      (currentLogin && String(entry.login || "").toLowerCase() === currentLogin);

    if (sameRecord) {
      return false;
    }

    return (
      String(entry.login || "").toLowerCase() === currentEmail ||
      String(entry.email || "").toLowerCase() === currentEmail
    );
  });

  return duplicateUser ? "Ja existe um usuario com este e-mail." : "";
};

const saveAdminUserSettings = async (form) => {
  const user = readAdminUserFormPayload(form);
  const validationMessage = validateAdminUserFormPayload(user, {
    isCreating: adminState.selectedUserLogin === NEW_ADMIN_USER_LOGIN,
  });

  if (validationMessage) {
    adminState.actionMessage = validationMessage;
    adminState.actionTone = "error";
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
    return;
  }

  adminState.userSaving = true;
  adminState.actionMessage = "";
  renderModuleContent();
  renderOrderDetails();

  try {
    const response = await fetchJson("/api/admin/users/save", {
      method: "POST",
      body: JSON.stringify({ user }),
    });

    syncAdminAccessFromPayload(response.admin);
    adminState.usersSnapshot = response;
    adminState.userSaving = false;
    adminState.selectedUserLogin = response.user?.login || user.login || "";
    adminState.userDraft = null;
    adminState.userDialogMode = "";
    adminState.actionMessage = response.message || "Usuario salvo com sucesso.";
    adminState.actionTone = "success";

    renderSidebarNav();
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  } catch (error) {
    adminState.userSaving = false;

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel salvar o usuario.";
    adminState.actionTone = "error";
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  }
};

const updateAdminUserStatus = async ({ login, status }) => {
  const normalizedLogin = String(login || "").trim();
  const nextStatus = String(status || "").trim();

  if (!normalizedLogin || !nextStatus) {
    return;
  }

  adminState.userBusyLogin = normalizedLogin;
  adminState.actionMessage = "";
  renderModuleContent();

  try {
    const response = await fetchJson("/api/admin/users/status", {
      method: "POST",
      body: JSON.stringify({
        login: normalizedLogin,
        status: nextStatus,
      }),
    });

    syncAdminAccessFromPayload(response.admin);
    adminState.usersSnapshot = response;
    adminState.userBusyLogin = "";
    adminState.selectedUserLogin = response.user?.login || normalizedLogin;
    adminState.userDraft = null;
    adminState.actionMessage = response.message || "Status atualizado com sucesso.";
    adminState.actionTone = "success";

    renderSidebarNav();
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  } catch (error) {
    adminState.userBusyLogin = "";

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel alterar o status do usuario.";
    adminState.actionTone = "error";
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  }
};

const resetAdminUserPassword = async (form) => {
  const user = readAdminUserFormPayload(form);

  if (!user.login || !user.password) {
    adminState.actionMessage = "Informe uma nova senha para redefinir.";
    adminState.actionTone = "error";
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
    return;
  }

  adminState.userSaving = true;
  adminState.actionMessage = "";
  renderModuleContent();

  try {
    const response = await fetchJson("/api/admin/users/reset-password", {
      method: "POST",
      body: JSON.stringify({
        id: user.id,
        login: user.login,
        password: user.password,
      }),
    });

    syncAdminAccessFromPayload(response.admin);
    adminState.usersSnapshot = response;
    adminState.userSaving = false;
    adminState.selectedUserLogin = response.user?.login || user.login;
    adminState.userDraft = null;
    adminState.actionMessage = response.message || "Senha redefinida com sucesso.";
    adminState.actionTone = "success";

    renderSidebarNav();
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  } catch (error) {
    adminState.userSaving = false;

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel redefinir a senha.";
    adminState.actionTone = "error";
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  }
};

const deleteAdminUserSettings = async ({ login }) => {
  const normalizedLogin = String(login || "").trim();
  const targetUser = (Array.isArray(getUsersSnapshot().users) ? getUsersSnapshot().users : []).find(
    (user) => user.login === normalizedLogin
  );

  if (!normalizedLogin || !targetUser) {
    adminState.actionMessage = "Usuario nao encontrado para exclusao.";
    adminState.actionTone = "error";
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
    return;
  }

  const targetName = targetUser.name || targetUser.nome || targetUser.email || normalizedLogin;
  const confirmed = window.confirm(`Excluir o usuario ${targetName}? Esta acao nao pode ser desfeita.`);

  if (!confirmed) {
    return;
  }

  adminState.userBusyLogin = normalizedLogin;
  adminState.actionMessage = "";
  renderModuleContent();

  try {
    const response = await fetchJson("/api/admin/users/delete", {
      method: "POST",
      body: JSON.stringify({
        id: targetUser.id,
        login: normalizedLogin,
      }),
    });

    syncAdminAccessFromPayload(response.admin);
    adminState.usersSnapshot = response;
    adminState.userBusyLogin = "";
    adminState.selectedUserLogin =
      response.users?.find((user) => user.login === adminState.selectedUserLogin)?.login ||
      response.users?.[0]?.login ||
      "";
    adminState.userDraft = null;
    adminState.userDialogMode = "";
    adminState.actionMessage = response.message || "Usuario excluido com sucesso.";
    adminState.actionTone = "success";
    normalizeUsersPage();

    renderSidebarNav();
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  } catch (error) {
    adminState.userBusyLogin = "";

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel excluir o usuario.";
    adminState.actionTone = "error";
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  }
};

const loadInitialAdminSession = async () => {
  const session = await fetchJson("/api/admin/session");

  if (!session.authenticated) {
    redirectToLogin();
    return false;
  }

  syncAdminAccessFromPayload(session.admin);
  ensureActiveSectionAllowed();
  renderSectionChrome();
  renderSidebarNav();
  renderModuleContent();
  updateSidebarMeta();
  return true;
};

const loadActiveAdminSection = async ({ preserveSelection = true } = {}) => {
  ensureActiveSectionAllowed();

  if (adminState.activeSection === "users") {
    await loadUsers({ preserveSelection });
    return;
  }

  if (adminState.activeSection === "settings") {
    await loadRestaurantSettings();
    return;
  }

  if (adminState.activeSection === "deliveries") {
    await loadDeliverySettings();
    return;
  }

  if (adminState.activeSection === "finance") {
    await loadFinance();
    return;
  }

  if (adminState.activeSection === "inventory") {
    await loadInventory({ preserveSelection });
    return;
  }

  if (adminState.activeSection === "customers") {
    await loadCustomers({ preserveSelection });
    return;
  }

  if (adminState.activeSection === "menu") {
    await loadMenuCatalog();
    return;
  }

  if (adminState.activeSection === "promotions") {
    await loadPromotions({ preserveSelection });
    return;
  }

  if (adminState.activeSection === "reviews") {
    await loadReviews({ preserveSelection });
    return;
  }

  if (adminState.activeSection === "metrics") {
    await loadMetrics();
    return;
  }

  if (adminState.activeSection === "scheduled") {
    await loadScheduledOrders({ preserveSelection });
    return;
  }

  if (adminState.activeSection === "audit") {
    await loadAuditLog({ preserveSelection });
    return;
  }

  if (hasAdminPermission("orders_view") || adminState.activeSection === "dashboard") {
    await loadDashboard({ preserveSelection });
    return;
  }

  renderSectionChrome();
  renderSidebarNav();
  renderDashboardStats();
  renderModuleContent();
  renderOrderDetails();
  updateSidebarMeta();
};

const loadDashboard = async ({ preserveSelection = true } = {}) => {
  adminState.isLoadingOrders = true;
  renderSectionChrome();
  renderSidebarNav();
  renderDashboardStats();
  renderModuleContent();
  updateSidebarMeta();

  try {
    const dashboardEndpoint = hasAdminPermission("orders_view") && hasPlanFeatureForSection("orders")
      ? "/api/admin/orders/list?limit=80"
      : "/api/admin/dashboard";
    const payload = await fetchJson(dashboardEndpoint);
    syncAdminAccessFromPayload(payload.admin);

    adminState.orders = Array.isArray(payload.orders)
      ? payload.orders.map(normalizeOrderRecord)
      : Array.isArray(payload.recentOrders)
        ? payload.recentOrders.map(normalizeOrderRecord)
        : [];
    adminState.stats = normalizeStatsPayload(payload.stats || null);
    adminState.generatedAt = payload.generatedAt || "";
    adminState.storageMode = payload.storageMode || "";
    adminState.adminDisplayName =
      payload.admin?.displayName ||
      adminState.adminDisplayName ||
      ADMIN_BRANDING.displayNameFallback ||
      "Gestor INovas";
    adminState.isLoadingOrders = false;

    void ensurePublicCatalogItems();

    const orderStillExists =
      preserveSelection &&
      adminState.selectedOrderId &&
      adminState.orders.some((order) => order.id === adminState.selectedOrderId);
    const nextSelectedId = (orderStillExists && adminState.selectedOrderId) || pickDefaultOrderId();

    if (!adminState.selectedOrder || !orderStillExists) {
      adminState.selectedOrder = null;
    }

    adminState.selectedOrderId = nextSelectedId;
    adminState.selectedCustomerKey = getSelectedCustomerRecord()?.key || getCustomerRecords()[0]?.key || "";
    syncSelectionForActiveSection();

    renderSectionChrome();
    renderSidebarNav();
    renderDashboardStats();
    renderModuleContent();

    if (adminState.activeSection !== "dashboard") {
      renderOrderDetails();
    }

    updateSidebarMeta();

    if (hasAdminPermission("inventory_view") && hasPlanFeatureForSection("inventory")) {
      await loadInventory({ preserveSelection: true, silent: true });
    }

    if (
      adminState.activeSection === "customers" &&
      hasAdminPermission("customers_view") &&
      hasPlanFeatureForSection("customers")
    ) {
      await loadCustomers({ preserveSelection: true, silent: true });
    }

    if (
      adminState.activeSection === "metrics" &&
      hasAdminPermission("reports_view") &&
      hasPlanFeatureForSection("metrics")
    ) {
      await loadMetrics({ silent: true });
    }

    if (
      adminState.activeSection === "scheduled" &&
      hasAdminPermission("orders_view") &&
      hasPlanFeatureForSection("scheduled")
    ) {
      await loadScheduledOrders({ preserveSelection, silent: true });
    }

    if (
      adminState.activeSection === "menu" &&
      hasAdminPermission("catalog_view") &&
      hasPlanFeatureForSection("menu")
    ) {
      await loadMenuCatalog({ silent: true });
    }

    if (
      adminState.activeSection === "promotions" &&
      hasAdminPermission("promotions_view") &&
      hasPlanFeatureForSection("promotions")
    ) {
      await loadPromotions({ preserveSelection: true, silent: true });
    }

    if (
      adminState.activeSection === "reviews" &&
      hasAdminPermission("reviews_view") &&
      hasPlanFeatureForSection("reviews")
    ) {
      await loadReviews({ preserveSelection: true, silent: true });
    }

    if (
      adminState.activeSection === "deliveries" &&
      hasAdminPermission("delivery_view") &&
      hasPlanFeatureForSection("deliveries")
    ) {
      await loadDeliverySettings({ silent: true });
    }

    if (
      adminState.activeSection === "finance" &&
      hasAdminPermission("financial_view") &&
      hasPlanFeatureForSection("finance")
    ) {
      await loadFinance({ silent: true });
    }

    const selectedIdForLoad = adminState.selectedOrderId;

    if (
      selectedIdForLoad &&
      hasAdminPermission("orders_view") &&
      hasPlanFeatureForSection("orders") &&
      !["customers", "dashboard", "deliveries", "inventory", "settings", "users"].includes(adminState.activeSection)
    ) {
      await loadOrderDetails(selectedIdForLoad, {
        showLoading: !orderStillExists || !adminState.selectedOrder || selectedIdForLoad !== nextSelectedId,
      });
    }
  } catch (error) {
    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.isLoadingOrders = false;
    adminState.actionMessage = error.message || "Nao foi possivel atualizar o painel do gestor.";
    adminState.actionTone = "error";
    renderSectionChrome();
    renderModuleContent();

    if (adminState.activeSection !== "dashboard") {
      renderOrderDetails();
    }

    updateSidebarMeta();
  }
};

const updateOrderStatus = async (orderId, nextStatus, note = "", options = {}) => {
  adminState.isUpdatingStatus = true;
  adminState.actionMessage = "";
  adminState.actionTone = "success";

  renderModuleContent();
  renderOrderDetails();

  try {
    const payload = await fetchJson("/api/admin/orders/status", {
      method: "POST",
      body: JSON.stringify({
        orderId,
        status: nextStatus,
        note,
        manual: Boolean(options.manual),
      }),
    });

    adminState.selectedOrder = normalizeOrderRecord(payload.order || adminState.selectedOrder);
    adminState.storageMode = payload.storageMode || adminState.storageMode;
    adminState.isUpdatingStatus = false;
    adminState.actionMessage = payload.message || `Status atualizado para ${nextStatus}.`;
    adminState.actionTone = "success";

    if (adminState.selectedOrder) {
      adminState.selectedOrderId = adminState.selectedOrder.id;
      applySelectedOrderToList(adminState.selectedOrder);
    }

    renderModuleContent();
    renderOrderDetails();
    await loadAuditLog({ preserveSelection: true, silent: true });
    await loadDashboard({ preserveSelection: true });

    if (adminState.activeSection === "scheduled") {
      await loadScheduledOrders({ preserveSelection: true, silent: true });
    }
  } catch (error) {
    adminState.isUpdatingStatus = false;
    adminState.actionMessage = error.message || "Nao foi possivel atualizar o status deste pedido.";
    adminState.actionTone = "error";

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    renderModuleContent();
    renderOrderDetails();
  }
};

const updateCatalogItemSettings = async (payload = {}) => {
  const itemId = String(payload.itemId || "").trim();

  if (!itemId) {
    return;
  }

  adminState.menuSavingItemId = itemId;
  adminState.actionMessage = "";
  adminState.actionTone = "success";
  renderModuleContent();
  renderOrderDetails();

  try {
    const response = await fetchJson("/api/admin/catalog/update", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    adminState.menuSavingItemId = "";
    adminState.storageMode = response.storageMode || adminState.storageMode;
    adminState.generatedAt = response.generatedAt || adminState.generatedAt;
    adminState.actionMessage = response.message || "Item do catalogo atualizado com sucesso.";
    adminState.actionTone = "success";

    await loadMenuCatalog({ silent: true });
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  } catch (error) {
    adminState.menuSavingItemId = "";

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel atualizar este item do catalogo.";
    adminState.actionTone = "error";
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  }
};

const runCatalogMutation = async ({
  action,
  payload = {},
  busyKey = "",
  successMessage = "Catalogo atualizado com sucesso.",
  errorMessage = "Nao foi possivel atualizar o catalogo.",
}) => {
  adminState.menuBusyKey = busyKey;
  adminState.actionMessage = "";
  adminState.actionTone = "success";
  renderModuleContent();
  renderOrderDetails();

  try {
    const response = await fetchJson(`/api/admin/catalog/${action}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    adminState.menuBusyKey = "";
    adminState.storageMode = response.storageMode || adminState.storageMode;
    adminState.generatedAt = response.generatedAt || adminState.generatedAt;
    adminState.actionMessage = response.message || successMessage;
    adminState.actionTone = "success";
    adminState.publicCatalogItems = null;

    await loadMenuCatalog({ silent: true });
    void ensurePublicCatalogItems();
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  } catch (error) {
    adminState.menuBusyKey = "";

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || errorMessage;
    adminState.actionTone = "error";
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  }
};

const saveInventoryItem = async (form) => {
  const formData = new FormData(form);
  const itemId = String(formData.get("itemId") || "").trim();
  const busyKey = `inventory-save-${itemId || "new"}`;

  adminState.inventoryBusyKey = busyKey;
  adminState.actionMessage = "";
  adminState.actionTone = "success";
  renderModuleContent();
  renderOrderDetails();

  try {
    const response = await fetchJson("/api/admin/inventory/save-item", {
      method: "POST",
      body: JSON.stringify({
        itemId,
        name: String(formData.get("name") || "").trim(),
        category: String(formData.get("category") || "").trim(),
        quantity: normalizeDecimalInput(formData.get("quantity")),
        unit: String(formData.get("unit") || "").trim(),
        minimumQuantity: normalizeDecimalInput(formData.get("minimumQuantity")),
        expirationDate: String(formData.get("expirationDate") || "").trim(),
      }),
    });

    adminState.inventoryBusyKey = "";
    adminState.selectedInventoryItemId = String(response.itemId || itemId || "").trim();
    adminState.storageMode = response.storageMode || adminState.storageMode;
    adminState.generatedAt = response.generatedAt || adminState.generatedAt;
    adminState.actionMessage = response.message || "Item do estoque salvo com sucesso.";
    adminState.actionTone = "success";

    await loadInventory({ preserveSelection: true, silent: true });
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  } catch (error) {
    adminState.inventoryBusyKey = "";

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel salvar o item do estoque.";
    adminState.actionTone = "error";
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  }
};

const adjustInventoryStock = async (form) => {
  const formData = new FormData(form);
  const itemId = String(formData.get("itemId") || "").trim();
  const mode = String(form.dataset.inventoryAdjustMode || "").trim();
  const busyKey = `inventory-adjust-${itemId}-${mode}`;

  if (!itemId || !mode) {
    return;
  }

  adminState.inventoryBusyKey = busyKey;
  adminState.actionMessage = "";
  adminState.actionTone = "success";
  renderModuleContent();
  renderOrderDetails();

  try {
    const response = await fetchJson("/api/admin/inventory/adjust-stock", {
      method: "POST",
      body: JSON.stringify({
        itemId,
        mode,
        amount: normalizeDecimalInput(formData.get("amount")),
      }),
    });

    adminState.inventoryBusyKey = "";
    adminState.selectedInventoryItemId = String(response.itemId || itemId).trim();
    adminState.storageMode = response.storageMode || adminState.storageMode;
    adminState.generatedAt = response.generatedAt || adminState.generatedAt;
    adminState.actionMessage = response.message || "Estoque movimentado com sucesso.";
    adminState.actionTone = "success";

    await loadInventory({ preserveSelection: true, silent: true });
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  } catch (error) {
    adminState.inventoryBusyKey = "";

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel movimentar o estoque.";
    adminState.actionTone = "error";
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  }
};

const readAdminFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    if (!(file instanceof File)) {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Nao foi possivel carregar a imagem selecionada."));
    reader.readAsDataURL(file);
  });

const savePromotionSettings = async (payload = {}) => {
  adminState.promotionSaving = true;
  adminState.actionMessage = "";
  adminState.actionTone = "success";
  renderModuleContent();
  renderOrderDetails();

  try {
    const response = await fetchJson("/api/admin/promotions/save", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    adminState.promotionSaving = false;
    adminState.storageMode = response.storageMode || adminState.storageMode;
    adminState.generatedAt = response.generatedAt || adminState.generatedAt;
    adminState.actionMessage = response.message || "Promocao salva com sucesso.";
    adminState.actionTone = "success";
    adminState.selectedPromotionId = String(response.promotionId || payload.id || "").trim();

    await loadPromotions({
      preserveSelection: true,
      silent: true,
      preferredPromotionId: adminState.selectedPromotionId,
    });
  } catch (error) {
    adminState.promotionSaving = false;

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel salvar esta promocao.";
    adminState.actionTone = "error";
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  }
};

const togglePromotionStatus = async (payload = {}) => {
  const promotionId = String(payload.id || "").trim();

  if (!promotionId) {
    return;
  }

  adminState.promotionBusyId = promotionId;
  adminState.actionMessage = "";
  adminState.actionTone = "success";
  renderModuleContent();
  renderOrderDetails();

  try {
    const response = await fetchJson("/api/admin/promotions/toggle", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    adminState.promotionBusyId = "";
    adminState.storageMode = response.storageMode || adminState.storageMode;
    adminState.generatedAt = response.generatedAt || adminState.generatedAt;
    adminState.actionMessage = response.message || "Status da promocao atualizado com sucesso.";
    adminState.actionTone = "success";

    await loadPromotions({
      preserveSelection: true,
      silent: true,
      preferredPromotionId: promotionId,
    });
  } catch (error) {
    adminState.promotionBusyId = "";

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel atualizar o status desta promocao.";
    adminState.actionTone = "error";
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  }
};

const removePromotion = async (payload = {}) => {
  const promotionId = String(payload.id || "").trim();

  if (!promotionId) {
    return;
  }

  adminState.promotionBusyId = promotionId;
  adminState.actionMessage = "";
  adminState.actionTone = "success";
  renderModuleContent();
  renderOrderDetails();

  try {
    const response = await fetchJson("/api/admin/promotions/delete", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    adminState.promotionBusyId = "";
    adminState.storageMode = response.storageMode || adminState.storageMode;
    adminState.generatedAt = response.generatedAt || adminState.generatedAt;
    adminState.actionMessage = response.message || "Promocao removida com sucesso.";
    adminState.actionTone = "success";

    if (adminState.selectedPromotionId === promotionId) {
      adminState.selectedPromotionId = "";
    }

    await loadPromotions({ preserveSelection: false, silent: true });
  } catch (error) {
    adminState.promotionBusyId = "";

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel remover esta promocao.";
    adminState.actionTone = "error";
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  }
};

const updateReviewVisibility = async (payload = {}) => {
  const reviewId = String(payload.id || "").trim();

  if (!reviewId) {
    return;
  }

  adminState.reviewBusyId = reviewId;
  adminState.actionMessage = "";
  adminState.actionTone = "success";
  renderModuleContent();
  renderOrderDetails();

  try {
    const response = await fetchJson("/api/admin/reviews/visibility", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    adminState.reviewBusyId = "";
    adminState.storageMode = response.storageMode || adminState.storageMode;
    adminState.generatedAt = response.generatedAt || adminState.generatedAt;
    adminState.actionMessage = response.message || "Visibilidade da avaliacao atualizada com sucesso.";
    adminState.actionTone = "success";

    await loadReviews({
      preserveSelection: true,
      silent: true,
      preferredReviewId: reviewId,
    });
  } catch (error) {
    adminState.reviewBusyId = "";

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel atualizar esta avaliacao.";
    adminState.actionTone = "error";
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  }
};

const removeReview = async (payload = {}) => {
  const reviewId = String(payload.id || "").trim();

  if (!reviewId) {
    return;
  }

  adminState.reviewBusyId = reviewId;
  adminState.actionMessage = "";
  adminState.actionTone = "success";
  renderModuleContent();
  renderOrderDetails();

  try {
    const response = await fetchJson("/api/admin/reviews/delete", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    adminState.reviewBusyId = "";
    adminState.storageMode = response.storageMode || adminState.storageMode;
    adminState.generatedAt = response.generatedAt || adminState.generatedAt;
    adminState.actionMessage = response.message || "Avaliacao removida com sucesso.";
    adminState.actionTone = "success";

    if (adminState.selectedReviewId === reviewId) {
      adminState.selectedReviewId = "";
    }

    await loadReviews({ preserveSelection: false, silent: true });
  } catch (error) {
    adminState.reviewBusyId = "";

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.actionMessage = error.message || "Nao foi possivel remover esta avaliacao.";
    adminState.actionTone = "error";
    renderModuleContent();
    renderOrderDetails();
    updateSidebarMeta();
  }
};

const initDashboardPage = () => {
  const refreshButtons = Array.from(document.querySelectorAll("[data-admin-refresh]"));
  const logoutButton = document.querySelector("[data-admin-logout]");
  const navRoot = document.querySelector("[data-admin-nav]");
  const moduleRoot = document.querySelector("[data-admin-module-content]");
  const detailRoot = document.querySelector("[data-admin-order-detail]");
  const searchInput = document.querySelector("[data-admin-search-input]");
  const boardModalRoot = document.querySelector("[data-admin-board-modal]");
  const themeToggleButton = document.querySelector("[data-admin-theme-toggle]");

  renderSectionChrome();
  syncThemeToggle();

  refreshButtons.forEach((refreshButton) => {
    refreshButton.addEventListener("click", () => {
      void loadActiveAdminSection({ preserveSelection: true });
    });
  });

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      try {
        await fetchJson("/api/admin/logout", {
          method: "POST",
        });
      } catch (error) {
        // Mesmo que o logout falhe, seguimos para a tela de login.
      }

      window.location.href = "/admin/login.html";
    });
  }

  if (themeToggleButton) {
    themeToggleButton.addEventListener("click", () => {
      applyAdminTheme(ADMIN_THEME_DEFAULT);
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", async (event) => {
      adminState.searchQuery = String(event.target.value || "").trim();
      if (adminState.activeSection === "users") {
        adminState.userPage = 1;
      }
      adminState.selectedCustomerKey =
        adminState.activeSection === "customers"
          ? getSelectedCustomerCrmRecord()?.key || getVisibleCustomerCrmRecords()[0]?.key || ""
          : getSelectedCustomerRecord()?.key || getCustomerRecords()[0]?.key || "";
      syncSelectionForActiveSection();
      renderSectionChrome();
      renderSidebarNav();
      renderModuleContent();

      if (adminState.activeSection !== "dashboard") {
        renderOrderDetails();
      }

      updateSidebarMeta();

      if (
        !["customers", "dashboard", "inventory"].includes(adminState.activeSection) &&
        adminState.selectedOrderId &&
        adminState.selectedOrder?.id !== adminState.selectedOrderId
      ) {
        await loadOrderDetails(adminState.selectedOrderId, { showLoading: false });
      }
    });
  }

  if (navRoot) {
    navRoot.addEventListener("click", async (event) => {
      const navButton = event.target.closest("[data-admin-section]");

      if (!navButton) {
        return;
      }

      const nextSection = String(navButton.dataset.adminSection || "").trim();

      if (!nextSection || !IMPLEMENTED_SECTIONS.has(nextSection) || !canAccessAdminSection(nextSection)) {
        return;
      }

      adminState.activeSection = nextSection;

      if (nextSection === "dashboard" || nextSection === "menu") {
        adminState.searchQuery = "";

        if (searchInput) {
          searchInput.value = "";
        }
      }

      if (nextSection !== "dashboard") {
        adminState.dashboardRevenueMenuOpen = false;
      }

      if (nextSection !== "orders") {
        closeBoardColumnModal();
      }

      if (
        nextSection === "finance" ||
        nextSection === "reports" ||
        nextSection === "metrics" ||
        nextSection === "inventory" ||
        nextSection === "menu" ||
        nextSection === "promotions" ||
        nextSection === "reviews" ||
        nextSection === "deliveries" ||
        nextSection === "settings" ||
        nextSection === "customers" ||
        nextSection === "users"
      ) {
        adminState.selectedOrderId = "";
        adminState.selectedOrder = null;
      }

      adminState.selectedCustomerKey =
        nextSection === "customers"
          ? getSelectedCustomerCrmRecord()?.key || getVisibleCustomerCrmRecords()[0]?.key || ""
          : getSelectedCustomerRecord()?.key || getCustomerRecords()[0]?.key || "";
      syncSelectionForActiveSection();
      renderSectionChrome();
      renderSidebarNav();
      renderDashboardStats();
      renderModuleContent();

      if (nextSection !== "dashboard") {
        renderOrderDetails();
      }

      updateSidebarMeta();

      if (nextSection === "audit") {
        await loadAuditLog({ preserveSelection: true });
      }

      if (nextSection === "inventory") {
        await loadInventory({ preserveSelection: true });
      }

      if (nextSection === "metrics") {
        await loadMetrics();
      }

      if (nextSection === "scheduled") {
        await loadScheduledOrders({ preserveSelection: true });
      }

      if (nextSection === "menu") {
        await loadMenuCatalog();
      }

      if (nextSection === "promotions") {
        await loadPromotions({ preserveSelection: true });
      }

      if (nextSection === "reviews") {
        await loadReviews({ preserveSelection: true });
      }

      if (nextSection === "deliveries") {
        await loadDeliverySettings();
      }

      if (nextSection === "settings") {
        await loadRestaurantSettings();
      }

      if (nextSection === "customers") {
        await loadCustomers({ preserveSelection: true });
      }

      if (nextSection === "finance") {
        await loadFinance();
      }

      if (nextSection === "users") {
        await loadUsers({ preserveSelection: true });
      }

      if (
        !["customers", "dashboard", "deliveries", "inventory", "settings", "users"].includes(adminState.activeSection) &&
        adminState.selectedOrderId &&
        adminState.selectedOrder?.id !== adminState.selectedOrderId
      ) {
        await loadOrderDetails(adminState.selectedOrderId, { showLoading: false });
      }
    });
  }

  if (moduleRoot) {
    moduleRoot.addEventListener("input", (event) => {
      const userInlineSearch = event.target.closest("[data-user-inline-search]");
      const systemFilterField = event.target.closest("[data-system-filter]");

      if (userInlineSearch) {
        const cursorPosition = userInlineSearch.selectionStart;
        adminState.searchQuery = String(userInlineSearch.value || "").trim();
        adminState.userPage = 1;
        syncSelectionForActiveSection();
        renderSectionChrome();
        renderSidebarNav();
        renderModuleContent();
        renderOrderDetails();
        updateSidebarMeta();
        const nextSearch = document.querySelector("[data-user-inline-search]");

        if (nextSearch) {
          nextSearch.focus();
          if (typeof cursorPosition === "number") {
            nextSearch.setSelectionRange(cursorPosition, cursorPosition);
          }
        }
      }

      if (systemFilterField) {
        const sectionKey = adminState.activeSection;
        const filterKey = String(systemFilterField.dataset.systemFilter || "").trim();
        const cursorPosition = systemFilterField.selectionStart;

        if (SYSTEM_GLOBAL_FILTERS[sectionKey]?.some((filter) => filter.key === filterKey)) {
          adminState.systemFilters = {
            ...adminState.systemFilters,
            [sectionKey]: {
              ...(adminState.systemFilters?.[sectionKey] || {}),
              [filterKey]: String(systemFilterField.value || "").trim(),
            },
          };
          renderModuleContent();

          const nextField = document.querySelector(
            `[data-system-global-filters] [data-system-filter="${CSS.escape(filterKey)}"]`
          );

          if (nextField) {
            nextField.focus();
            if (typeof cursorPosition === "number" && nextField.type !== "date") {
              nextField.setSelectionRange(cursorPosition, cursorPosition);
            }
          }
        }
      }
    });

    moduleRoot.addEventListener("click", (event) => {
      const dashboardPeriodOptionButton = event.target.closest("[data-dashboard-period-option]");

      if (dashboardPeriodOptionButton) {
        const nextPeriod = String(dashboardPeriodOptionButton.dataset.dashboardPeriodOption || "").trim();
        const periodExists = DASHBOARD_REVENUE_PERIODS.some((period) => period.key === nextPeriod);

        if (!periodExists) {
          return;
        }

        adminState.dashboardRevenuePeriod = nextPeriod;
        adminState.dashboardRevenueMenuOpen = false;
        renderModuleContent();
        return;
      }

      const dashboardPeriodToggleButton = event.target.closest("[data-dashboard-period-toggle]");

      if (dashboardPeriodToggleButton) {
        adminState.dashboardRevenueMenuOpen = !adminState.dashboardRevenueMenuOpen;
        renderModuleContent();
        return;
      }

      const userNewButton = event.target.closest("[data-user-new]");

      if (userNewButton) {
        adminState.selectedUserLogin = NEW_ADMIN_USER_LOGIN;
        adminState.userDraft = getBlankAdminUser();
        adminState.userDialogMode = "create";
        adminState.actionMessage = "";
        renderModuleContent();
        renderOrderDetails();
        updateSidebarMeta();
        return;
      }

      const userDialogCloseButton = event.target.closest("[data-user-dialog-close]");

      if (userDialogCloseButton) {
        adminState.userDialogMode = "";
        adminState.userDraft = null;
        adminState.actionMessage = "";
        renderModuleContent();
        renderOrderDetails();
        updateSidebarMeta();
        return;
      }

      const userViewButton = event.target.closest("[data-user-view]");

      if (userViewButton) {
        adminState.selectedUserLogin = String(userViewButton.dataset.userView || "").trim();
        adminState.userDraft = null;
        adminState.userDialogMode = "view";
        adminState.actionMessage = "";
        renderModuleContent();
        renderOrderDetails();
        updateSidebarMeta();
        return;
      }

      const userSelectButton = event.target.closest("[data-user-select]");

      if (userSelectButton) {
        adminState.selectedUserLogin = String(userSelectButton.dataset.userSelect || "").trim();
        adminState.userDraft = null;
        adminState.userDialogMode = "edit";
        adminState.actionMessage = "";
        renderModuleContent();
        renderOrderDetails();
        updateSidebarMeta();
        return;
      }

      const userClearFiltersButton = event.target.closest("[data-user-clear-filters]");

      if (userClearFiltersButton) {
        adminState.searchQuery = "";
        adminState.userFilters = {
          restaurant: "",
          profile: "",
          status: "",
        };
        adminState.userPage = 1;
        renderModuleContent();
        renderOrderDetails();
        updateSidebarMeta();
        return;
      }

      const userStatusToggleButton = event.target.closest("[data-user-status-toggle]");

      if (userStatusToggleButton) {
        void updateAdminUserStatus({
          login: String(userStatusToggleButton.dataset.userStatusToggle || "").trim(),
          status: String(userStatusToggleButton.dataset.userNextStatus || "").trim(),
        });
        return;
      }

      const userResetPasswordButton = event.target.closest("[data-user-reset-password]");

      if (userResetPasswordButton) {
        const userForm = userResetPasswordButton.closest("[data-user-form]");

        if (userForm) {
          void resetAdminUserPassword(userForm);
        }

        return;
      }

      const userDeleteButton = event.target.closest("[data-user-delete]");

      if (userDeleteButton) {
        void deleteAdminUserSettings({
          login: String(userDeleteButton.dataset.userDelete || "").trim(),
        });
        return;
      }

      const userSortButton = event.target.closest("[data-user-sort]");

      if (userSortButton) {
        const sortKey = String(userSortButton.dataset.userSort || "").trim();

        if (!USER_TABLE_COLUMNS.some((column) => column.key === sortKey && column.sortable)) {
          return;
        }

        adminState.userSort = {
          key: sortKey,
          direction:
            adminState.userSort.key === sortKey && adminState.userSort.direction === "asc"
              ? "desc"
              : "asc",
        };
        adminState.userPage = 1;
        renderModuleContent();
        renderOrderDetails();
        updateSidebarMeta();
        return;
      }

      const userPageButton = event.target.closest("[data-user-page]");

      if (userPageButton) {
        const direction = String(userPageButton.dataset.userPage || "").trim();

        adminState.userPage += direction === "next" ? 1 : -1;
        normalizeUsersPage();
        renderModuleContent();
        renderOrderDetails();
        updateSidebarMeta();
        return;
      }

      const financePeriodButton = event.target.closest("[data-finance-period]");

      if (financePeriodButton) {
        const nextPeriod = String(financePeriodButton.dataset.financePeriod || "").trim();

        if (!FINANCE_PERIOD_FALLBACK_OPTIONS.some((option) => option.key === nextPeriod)) {
          return;
        }

        adminState.financeFilters = {
          ...adminState.financeFilters,
          period: nextPeriod,
        };
        void loadFinance();
        return;
      }

      const financeExportButton = event.target.closest("[data-finance-export]");

      if (financeExportButton) {
        const exportType = String(financeExportButton.dataset.financeExport || "").trim();

        if (exportType === "csv") {
          exportFinanceCsv();
          return;
        }

        if (exportType === "closing") {
          exportFinanceClosingSummary();
          return;
        }
      }

      const deliverySettingsActionButton = event.target.closest("[data-delivery-settings-action]");

      if (deliverySettingsActionButton) {
        const action = String(deliverySettingsActionButton.dataset.deliverySettingsAction || "").trim();
        const draft = syncDeliverySettingsDraftFromDom();

        if (action === "add-band") {
          const lastBand = draft.distanceBands[draft.distanceBands.length - 1] || {
            minKm: 0,
            maxKm: 0,
            customerFee: 0,
          };
          const minKm =
            lastBand.maxKm === null || typeof lastBand.maxKm === "undefined"
              ? Number(lastBand.minKm || 0)
              : Number(lastBand.maxKm || 0);

          draft.distanceBands.push({
            id: createDeliveryDraftId("band"),
            minKm,
            maxKm: Number((minKm + 2).toFixed(1)),
            customerFee: Number(lastBand.customerFee || 0),
            courierFee: Number(lastBand.courierFee || 0),
            minimumOrder: Number(lastBand.minimumOrder || 0),
            isActive: true,
          });
          adminState.deliverySettingsDraft = draft;
          renderModuleContent();
          return;
        }

        if (action === "remove-band") {
          const bandId = String(deliverySettingsActionButton.dataset.deliveryBandId || "").trim();
          adminState.deliverySettingsDraft = {
            ...draft,
            distanceBands: draft.distanceBands.filter((band) => band.id !== bandId),
            freeShipping: {
              ...draft.freeShipping,
              bandIds: (draft.freeShipping?.bandIds || []).filter((id) => id !== bandId),
            },
          };
          renderModuleContent();
          return;
        }

        if (action === "add-courier") {
          draft.couriers = Array.isArray(draft.couriers) ? draft.couriers : [];
          draft.couriers.push({
            id: createDeliveryDraftId("courier"),
            name: "",
            phone: "",
            defaultFee: 0,
            isActive: true,
          });
          adminState.deliverySettingsDraft = draft;
          renderModuleContent();
          return;
        }

        if (action === "remove-courier") {
          const courierId = String(deliverySettingsActionButton.dataset.deliveryCourierId || "").trim();
          adminState.deliverySettingsDraft = {
            ...draft,
            couriers: (draft.couriers || []).filter((courier) => courier.id !== courierId),
          };
          renderModuleContent();
          return;
        }

        if (action === "reset") {
          adminState.deliverySettingsDraft = cloneDeliverySettingsDraft(
            getDeliverySettingsSnapshot().settings || DELIVERY_SETTINGS_DEFAULT_DRAFT
          );
          adminState.actionMessage = "";
          renderModuleContent();
          return;
        }

        if (action === "save") {
          void saveDeliverySettings();
          return;
        }
      }

      const restaurantSettingsActionButton = event.target.closest("[data-restaurant-settings-action]");

      if (restaurantSettingsActionButton) {
        const action = String(
          restaurantSettingsActionButton.dataset.restaurantSettingsAction || ""
        ).trim();
        const draft = syncRestaurantSettingsDraftFromDom();

        if (action === "add-special-date") {
          draft.businessSchedule = {
            ...(draft.businessSchedule || RESTAURANT_SETTINGS_DEFAULT_DRAFT.businessSchedule),
            specialDates: [
              ...(draft.businessSchedule?.specialDates || []),
              createRestaurantSpecialDateDraft(),
            ],
          };
          adminState.restaurantSettingsDraft = draft;
          adminState.actionMessage = "";
          renderModuleContent();
          return;
        }

        if (action === "remove-special-date") {
          const specialDateId = String(
            restaurantSettingsActionButton.dataset.restaurantSpecialDateId || ""
          ).trim();

          adminState.restaurantSettingsDraft = {
            ...draft,
            businessSchedule: {
              ...(draft.businessSchedule || RESTAURANT_SETTINGS_DEFAULT_DRAFT.businessSchedule),
              specialDates: (draft.businessSchedule?.specialDates || []).filter(
                (entry) => entry.id !== specialDateId
              ),
            },
          };
          adminState.actionMessage = "";
          renderModuleContent();
          return;
        }

        if (action === "reset") {
          adminState.restaurantSettingsDraft = cloneRestaurantSettingsDraft(
            getRestaurantSettingsSnapshot().settings || RESTAURANT_SETTINGS_DEFAULT_DRAFT
          );
          adminState.actionMessage = "";
          renderModuleContent();
          return;
        }

        if (action === "save") {
          void saveRestaurantSettings();
          return;
        }
      }

      const boardColumnButton = event.target.closest("[data-board-column-open]");

      if (boardColumnButton) {
        adminState.expandedBoardColumnKey = String(boardColumnButton.dataset.boardColumnOpen || "").trim();
        renderBoardColumnModal();
        return;
      }

      const actionButton = event.target.closest("[data-order-action]");

      if (actionButton) {
        const orderId = String(actionButton.dataset.orderAction || "").trim();
        const nextStatus = String(actionButton.dataset.nextStatus || "").trim();
        const note = String(actionButton.dataset.actionNote || "").trim();

        if (!orderId || !nextStatus) {
          return;
        }

        adminState.selectedOrderId = orderId;
        void updateOrderStatus(orderId, nextStatus, note);
        return;
      }

      const selectButton = event.target.closest("[data-order-select]");

      if (selectButton) {
        const orderId = String(selectButton.dataset.orderSelect || "").trim();

        if (!orderId || orderId === adminState.selectedOrderId) {
          return;
        }

        adminState.actionMessage = "";
        void loadOrderDetails(orderId);
        return;
      }

      const customerButton = event.target.closest("[data-customer-key]");

      if (customerButton) {
        adminState.selectedCustomerKey = String(customerButton.dataset.customerKey || "").trim();
        adminState.actionMessage = "";
        renderModuleContent();
        renderOrderDetails();
        updateSidebarMeta();
        return;
      }

      const promotionSelectButton = event.target.closest("[data-promotion-select]");

      if (promotionSelectButton) {
        adminState.selectedPromotionId = String(promotionSelectButton.dataset.promotionSelect || "").trim();
        renderModuleContent();
        renderOrderDetails();
        updateSidebarMeta();
        return;
      }

      const promotionNewButton = event.target.closest("[data-promotion-new]");

      if (promotionNewButton) {
        adminState.selectedPromotionId = "";
        renderModuleContent();
        renderOrderDetails();
        updateSidebarMeta();
        return;
      }

      const inventoryNewButton = event.target.closest("[data-inventory-new]");

      if (inventoryNewButton) {
        adminState.selectedInventoryItemId = INVENTORY_NEW_ITEM_ID;
        adminState.actionMessage = "";
        renderModuleContent();
        renderOrderDetails();
        updateSidebarMeta();
        return;
      }

      const inventorySelectButton = event.target.closest("[data-inventory-select]");

      if (inventorySelectButton) {
        adminState.selectedInventoryItemId = String(inventorySelectButton.dataset.inventorySelect || "").trim();
        adminState.actionMessage = "";
        renderModuleContent();
        renderOrderDetails();
        updateSidebarMeta();
        return;
      }

      const inventoryAdjustButton = event.target.closest("[data-inventory-adjust-start]");

      if (inventoryAdjustButton) {
        const itemId = String(inventoryAdjustButton.dataset.inventoryAdjustStart || "").trim();
        const intent = String(inventoryAdjustButton.dataset.inventoryAdjustIntent || "add").trim();

        if (!itemId) {
          return;
        }

        adminState.selectedInventoryItemId = itemId;
        adminState.actionMessage = "";
        renderModuleContent();
        renderOrderDetails();
        updateSidebarMeta();
        window.setTimeout(() => {
          document
            .querySelector(`[data-inventory-adjust-mode="${intent}"] input[name="amount"]`)
            ?.focus();
        }, 0);
        return;
      }

      const promotionToggleButton = event.target.closest("[data-promotion-toggle]");

      if (promotionToggleButton) {
        const promotionId = String(promotionToggleButton.dataset.promotionToggle || "").trim();
        const isEnabled = String(promotionToggleButton.dataset.promotionEnabled || "").trim() === "true";

        if (!promotionId) {
          return;
        }

        void togglePromotionStatus({
          id: promotionId,
          isEnabled,
        });
        return;
      }

      const promotionDeleteButton = event.target.closest("[data-promotion-delete]");

      if (promotionDeleteButton) {
        const promotionId = String(promotionDeleteButton.dataset.promotionDelete || "").trim();
        const selectedPromotion = getPromotionsSnapshot().promotions.find(
          (promotion) => promotion.id === promotionId
        );

        if (!promotionId) {
          return;
        }

        if (
          !window.confirm(
            `Remover a promocao ${selectedPromotion?.internalName || "selecionada"}? Esta acao nao pode ser desfeita.`
          )
        ) {
          return;
        }

        void removePromotion({ id: promotionId });
        return;
      }

      const reviewSelectButton = event.target.closest("[data-review-select]");

      if (reviewSelectButton) {
        adminState.selectedReviewId = String(reviewSelectButton.dataset.reviewSelect || "").trim();
        renderModuleContent();
        renderOrderDetails();
        updateSidebarMeta();
        return;
      }

      const reviewVisibilityButton = event.target.closest("[data-review-visibility]");

      if (reviewVisibilityButton) {
        const reviewId = String(reviewVisibilityButton.dataset.reviewVisibility || "").trim();
        const nextVisibility = String(
          reviewVisibilityButton.dataset.reviewNextVisibility || ""
        ).trim();

        if (!reviewId) {
          return;
        }

        void updateReviewVisibility({
          id: reviewId,
          visibilityState: nextVisibility || "hidden",
        });
        return;
      }

      const reviewDeleteButton = event.target.closest("[data-review-delete]");

      if (reviewDeleteButton) {
        const reviewId = String(reviewDeleteButton.dataset.reviewDelete || "").trim();
        const selectedReview = getReviewsSnapshot().reviews.find((review) => review.id === reviewId);

        if (!reviewId) {
          return;
        }

        if (
          !window.confirm(
            `Remover a avaliacao de ${selectedReview?.customerName || "cliente"}? Esta acao nao pode ser desfeita.`
          )
        ) {
          return;
        }

        void removeReview({ id: reviewId });
      }
    });

    moduleRoot.addEventListener("change", (event) => {
      const restaurantSettingsField = event.target.closest("[data-restaurant-settings-field]");

      if (restaurantSettingsField && event.target.closest("[data-restaurant-settings-root]")) {
        syncRestaurantSettingsDraftFromDom();
        refreshRestaurantSettingsAppearancePreview();
        return;
      }

      const scheduledFilterField = event.target.closest("[data-scheduled-filter]");
      const userFilterField = event.target.closest("[data-user-filter]");
      const userPageSizeField = event.target.closest("[data-user-page-size]");

      const userTypeField = event.target.closest('[data-user-form] select[name="userType"]');
      const userScopeField = event.target.closest('[data-user-form] input[name="userScope"]');

      if (userFilterField) {
        const filterKey = String(userFilterField.dataset.userFilter || "").trim();

        if (["restaurant", "profile", "status"].includes(filterKey)) {
          adminState.userFilters = {
            ...adminState.userFilters,
            [filterKey]: String(userFilterField.value || "").trim(),
          };
          adminState.userPage = 1;
          syncSelectionForActiveSection();
          renderModuleContent();
          renderOrderDetails();
          updateSidebarMeta();
        }

        return;
      }

      if (userPageSizeField) {
        const nextPageSize = Number(userPageSizeField.value || adminState.userPageSize || 10);

        if (USER_PAGE_SIZE_OPTIONS.includes(nextPageSize)) {
          adminState.userPageSize = nextPageSize;
          adminState.userPage = 1;
          renderModuleContent();
          renderOrderDetails();
          updateSidebarMeta();
        }

        return;
      }

      if (userTypeField || userScopeField) {
        const userForm = (userTypeField || userScopeField).closest("[data-user-form]");
        const currentPayload = readAdminUserFormPayload(userForm);
        const users = Array.isArray(getUsersSnapshot().users) ? getUsersSnapshot().users : [];
        const existingIndex = users.findIndex((user) => user.login === currentPayload.login);
        const normalizedScope = normalizeAdminUserScope(currentPayload.userScope, currentPayload.userType);
        const normalizedType =
          normalizedScope === "SYSTEM" && !SYSTEM_USER_TYPE_SET.has(currentPayload.userType)
            ? getManageableSystemUserTypesForActor()[0] || "VENDEDOR"
            : normalizedScope === "RESTAURANT" && !RESTAURANT_USER_TYPE_SET.has(currentPayload.userType)
              ? isSystemAdminActor() && canManageRestaurantUsers()
                ? "OWNER"
                : "GERENTE"
              : currentPayload.userType;
        const nextUser = {
          ...(existingIndex === -1 ? getBlankAdminUser() : users[existingIndex]),
          ...currentPayload,
          userScope: normalizedScope,
          platformScope: normalizedScope === "SYSTEM",
          userType: normalizedType,
          tipo_usuario: normalizedType,
          restaurantKey: normalizedScope === "SYSTEM" ? "" : currentPayload.restaurantKey,
        };

        if (adminState.selectedUserLogin === NEW_ADMIN_USER_LOGIN || existingIndex === -1) {
          adminState.selectedUserLogin = NEW_ADMIN_USER_LOGIN;
          adminState.userDraft = nextUser;
          renderModuleContent();
          return;
        }

        adminState.usersSnapshot = {
          ...getUsersSnapshot(),
          users: users.map((user, index) => (index === existingIndex ? nextUser : user)),
        };
        renderModuleContent();
        return;
      }

      if (scheduledFilterField) {
        const filterKey = String(scheduledFilterField.dataset.scheduledFilter || "").trim();

        if (!filterKey) {
          return;
        }

        adminState.scheduledFilters = {
          ...adminState.scheduledFilters,
          [filterKey]: String(scheduledFilterField.value || "").trim(),
        };

        void loadScheduledOrders({ preserveSelection: false });
        return;
      }

      const menuFilterField = event.target.closest("[data-menu-filter]");

      if (menuFilterField) {
        const filterKey = String(menuFilterField.dataset.menuFilter || "").trim();

        if (!filterKey) {
          return;
        }

        adminState.menuFilters = {
          ...adminState.menuFilters,
          [filterKey]: String(menuFilterField.value || "").trim(),
        };

        renderModuleContent();
        renderOrderDetails();
        updateSidebarMeta();
        return;
      }

      const menuImageUpload = event.target.closest("[data-menu-image-upload]");

      if (menuImageUpload) {
        const menuImageForm = menuImageUpload.closest("form");
        const imageField = menuImageForm?.elements?.image;
        const selectedFile = menuImageUpload.files?.[0] || null;

        if (!imageField || !menuImageForm || !selectedFile) {
          return;
        }

        void (async () => {
          try {
            menuImageForm.dataset.pendingImage = await readAdminFileAsDataUrl(selectedFile);
            imageField.value = "";
          } catch (error) {
            adminState.actionMessage = error.message || "Nao foi possivel carregar a imagem escolhida.";
            adminState.actionTone = "error";
            renderOrderDetails();
            updateSidebarMeta();
          }
        })();

        return;
      }

      const promotionFilterField = event.target.closest("[data-promotion-filter]");

      if (promotionFilterField) {
        const filterKey = String(promotionFilterField.dataset.promotionFilter || "").trim();

        if (!filterKey) {
          return;
        }

        adminState.promotionsFilters = {
          ...adminState.promotionsFilters,
          [filterKey]: String(promotionFilterField.value || "").trim(),
        };
        syncSelectionForActiveSection();
        renderModuleContent();
        renderOrderDetails();
        updateSidebarMeta();
        return;
      }

      const reviewFilterField = event.target.closest("[data-review-filter]");

      if (reviewFilterField) {
        const filterKey = String(reviewFilterField.dataset.reviewFilter || "").trim();

        if (!filterKey) {
          return;
        }

        adminState.reviewsFilters = {
          ...adminState.reviewsFilters,
          [filterKey]: String(reviewFilterField.value || "").trim(),
        };
        syncSelectionForActiveSection();
        renderModuleContent();
        renderOrderDetails();
        updateSidebarMeta();
        return;
      }

      const promotionFormToggleField = event.target.closest("[data-promotion-form-toggle]");

      if (promotionFormToggleField) {
        syncPromotionFormVisibility(promotionFormToggleField.closest("[data-promotion-form]"));
        return;
      }

      const metricsFilterField = event.target.closest("[data-metrics-filter]");

      const financeFilterField = event.target.closest("[data-finance-filter]");

      if (financeFilterField) {
        const filterKey = String(financeFilterField.dataset.financeFilter || "").trim();

        if (!filterKey) {
          return;
        }

        adminState.financeFilters = {
          ...adminState.financeFilters,
          period: "custom",
          [filterKey]: String(financeFilterField.value || "").trim(),
        };

        void loadFinance();
        return;
      }

      const financeTableFilterField = event.target.closest("[data-finance-table-filter]");

      if (financeTableFilterField) {
        const filterKey = String(financeTableFilterField.dataset.financeTableFilter || "").trim();

        if (!filterKey) {
          return;
        }

        adminState.financeTableFilters = {
          ...adminState.financeTableFilters,
          [filterKey]: String(financeTableFilterField.value || "").trim(),
        };
        renderModuleContent();
        renderOrderDetails();
        updateSidebarMeta();
        return;
      }

      if (metricsFilterField) {
        const filterKey = String(metricsFilterField.dataset.metricsFilter || "").trim();

        if (!filterKey) {
          return;
        }

        adminState.metricsFilters = {
          ...adminState.metricsFilters,
          ...(filterKey === "startDate" || filterKey === "endDate" ? { period: "custom" } : {}),
          [filterKey]: String(metricsFilterField.value || "").trim(),
        };

        void loadMetrics();
        return;
      }

      const inventoryFilterField = event.target.closest("[data-inventory-filter]");

      if (inventoryFilterField) {
        const filterKey = String(inventoryFilterField.dataset.inventoryFilter || "").trim();

        if (!filterKey) {
          return;
        }

        adminState.inventoryFilters = {
          ...adminState.inventoryFilters,
          [filterKey]: String(inventoryFilterField.value || "").trim(),
        };
        syncSelectionForActiveSection();
        renderModuleContent();
        renderOrderDetails();
        updateSidebarMeta();
        return;
      }

      const customerFilterField = event.target.closest("[data-customer-filter]");

      if (customerFilterField) {
        const filterKey = String(customerFilterField.dataset.customerFilter || "").trim();

        if (!filterKey) {
          return;
        }

        adminState.customerFilters = {
          ...adminState.customerFilters,
          [filterKey]: String(customerFilterField.value || "").trim(),
        };
        syncSelectionForActiveSection();
        renderModuleContent();
        renderOrderDetails();
        updateSidebarMeta();
        return;
      }

      const auditFilterField = event.target.closest("[data-audit-filter]");

      if (!auditFilterField) {
        return;
      }

      const filterKey = String(auditFilterField.dataset.auditFilter || "").trim();

      if (!filterKey) {
        return;
      }

      adminState.auditFilters = {
        ...adminState.auditFilters,
        [filterKey]:
          filterKey === "limit"
            ? Number(auditFilterField.value || adminState.auditFilters.limit || 60)
            : String(auditFilterField.value || "").trim(),
      };

      void loadAuditLog({ preserveSelection: false });
    });

    moduleRoot.addEventListener("submit", (event) => {
      const userForm = event.target.closest("[data-user-form]");

      if (userForm) {
        event.preventDefault();
        void saveAdminUserSettings(userForm);
        return;
      }

      const financeClosingForm = event.target.closest("[data-finance-closing-form]");

      if (financeClosingForm) {
        event.preventDefault();
        void saveFinanceClosing(financeClosingForm);
        return;
      }

      const promotionForm = event.target.closest("[data-promotion-form]");

      if (promotionForm) {
        event.preventDefault();
        const formData = new FormData(promotionForm);
        const scopeType = String(formData.get("scopeType") || "item").trim();
        const pricingType = String(formData.get("pricingType") || "fixed_price").trim();
        const payload = {
          id: String(formData.get("id") || "").trim(),
          internalName: String(formData.get("internalName") || "").trim(),
          scopeType,
          targetValue:
            scopeType === "category"
              ? String(formData.get("category") || "").trim()
              : String(formData.get("itemId") || "").trim(),
          pricingType,
          fixedPrice:
            pricingType === "fixed_price" ? normalizeDecimalInput(formData.get("fixedPrice")) : "",
          discountPercent:
            pricingType === "percent_discount"
              ? normalizeDecimalInput(formData.get("discountPercent"))
              : "",
          startsAt: String(formData.get("startsAt") || "").trim(),
          endsAt: String(formData.get("endsAt") || "").trim(),
          isEnabled: formData.get("isEnabled") === "on",
        };

        void savePromotionSettings(payload);
        return;
      }

      const menuSectionForm = event.target.closest("[data-menu-section-form]");

      if (menuSectionForm) {
        event.preventDefault();
        const formData = new FormData(menuSectionForm);
        const sectionId = String(formData.get("sectionId") || "").trim();
        const intent = String(event.submitter?.value || "save-section").trim();
        const busyKey = getMenuBusyKey("section", sectionId || "new");

        if (intent === "delete-section") {
          void runCatalogMutation({
            action: "delete-section",
            payload: { sectionId },
            busyKey,
            successMessage: "Categoria removida com sucesso.",
            errorMessage: "Nao foi possivel remover esta categoria.",
          });
          return;
        }

        void runCatalogMutation({
          action: "save-section",
          payload: {
            sectionId,
            title: String(formData.get("title") || "").trim(),
            kicker: String(formData.get("kicker") || "").trim(),
            description: String(formData.get("description") || "").trim(),
          },
          busyKey,
          successMessage: "Categoria salva com sucesso.",
          errorMessage: "Nao foi possivel salvar esta categoria.",
        });
        return;
      }

      const menuItemForm = event.target.closest("[data-menu-item-form]");

      if (!menuItemForm) {
        return;
      }

      event.preventDefault();
      const formData = new FormData(menuItemForm);
      const intent = String(event.submitter?.value || "save-item").trim();
      const itemId = String(formData.get("itemId") || "").trim();
      const sectionId = String(formData.get("sectionId") || "").trim();
      const busyKey = getMenuBusyKey("item", itemId || `new-${sectionId}`);
      const imageValue = String(formData.get("image") || "").trim() || String(menuItemForm.dataset.pendingImage || "").trim();
      const featuredItemIds = getMenuFeaturedItemIds();
      const isAlreadyHighlighted = itemId ? featuredItemIds.includes(itemId) : false;
      const wantsHighlight = formData.get("isHighlighted") === "on";

      if (wantsHighlight && !isAlreadyHighlighted && featuredItemIds.length >= MENU_HOME_HIGHLIGHT_LIMIT) {
        adminState.actionMessage = `Limite de ${MENU_HOME_HIGHLIGHT_LIMIT} destaques atingido. Remova um destaque atual antes de incluir outro prato na home.`;
        adminState.actionTone = "error";
        renderModuleContent();
        renderOrderDetails();
        updateSidebarMeta();
        return;
      }

      if (intent === "delete-item") {
        void runCatalogMutation({
          action: "delete-item",
          payload: { itemId },
          busyKey,
          successMessage: "Prato removido com sucesso.",
          errorMessage: "Nao foi possivel remover este prato.",
        });
        return;
      }

      void runCatalogMutation({
        action: "save-item",
        payload: {
          itemId,
          sectionId,
          name: String(formData.get("name") || "").trim(),
          category: String(formData.get("category") || "").trim(),
          description: String(formData.get("description") || "").trim(),
          detail: String(formData.get("detail") || "").trim(),
          badge: String(formData.get("badge") || "").trim(),
          price: normalizeDecimalInput(formData.get("price")),
          availabilityState: String(formData.get("availabilityState") || "").trim(),
          isHighlighted: wantsHighlight,
          ...(imageValue ? { image: imageValue } : {}),
        },
        busyKey,
        successMessage: "Prato salvo com sucesso.",
        errorMessage: "Nao foi possivel salvar este prato.",
      });
    });

    moduleRoot.addEventListener("input", (event) => {
      const restaurantSettingsField = event.target.closest("[data-restaurant-settings-field]");

      if (restaurantSettingsField && event.target.closest("[data-restaurant-settings-root]")) {
        syncRestaurantSettingsDraftFromDom();
        refreshRestaurantSettingsAppearancePreview();
        return;
      }

      const metricsFilterField = event.target.closest("[data-metrics-filter]");

      if (
        metricsFilterField &&
        (metricsFilterField.dataset.metricsFilter === "startDate" ||
          metricsFilterField.dataset.metricsFilter === "endDate")
      ) {
        const filterKey = String(metricsFilterField.dataset.metricsFilter || "").trim();

        adminState.metricsFilters = {
          ...adminState.metricsFilters,
          period: "custom",
          [filterKey]: String(metricsFilterField.value || "").trim(),
        };

        return;
      }

      const auditFilterField = event.target.closest("[data-audit-filter]");

      if (!auditFilterField || auditFilterField.dataset.auditFilter !== "orderQuery") {
        return;
      }

      adminState.auditFilters = {
        ...adminState.auditFilters,
        orderQuery: String(auditFilterField.value || "").trim(),
      };

      void loadAuditLog({ preserveSelection: false, silent: true });
    });
  }

  if (boardModalRoot) {
    boardModalRoot.addEventListener("click", (event) => {
      const boardModalOrderButton = event.target.closest("[data-board-modal-order-select]");

      if (boardModalOrderButton) {
        const orderId = String(boardModalOrderButton.dataset.boardModalOrderSelect || "").trim();

        if (!orderId) {
          return;
        }

        closeBoardColumnModal();
        adminState.actionMessage = "";

        if (orderId === adminState.selectedOrderId) {
          renderOrderDetails();
          return;
        }

        void loadOrderDetails(orderId);
        return;
      }

      if (event.target.closest("[data-admin-board-modal-close]")) {
        closeBoardColumnModal();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && adminState.dashboardRevenueMenuOpen) {
      adminState.dashboardRevenueMenuOpen = false;
      renderModuleContent();
      return;
    }

    if (event.key !== "Escape" || !adminState.expandedBoardColumnKey) {
      return;
    }

    closeBoardColumnModal();
  });

  if (detailRoot) {
    detailRoot.addEventListener("submit", (event) => {
      const customerNotesForm = event.target.closest("[data-customer-notes-form]");

      if (customerNotesForm) {
        event.preventDefault();
        const formData = new FormData(customerNotesForm);
        const customer = getSelectedCustomerCrmRecord();

        void saveCustomerProfile({
          customerKey: String(formData.get("customerKey") || customer?.customerKey || "").trim(),
          notes: String(formData.get("notes") || "").trim(),
          tags: customer?.tags || [],
        });
        return;
      }

      const inventoryItemForm = event.target.closest("[data-inventory-item-form]");

      if (inventoryItemForm) {
        event.preventDefault();
        void saveInventoryItem(inventoryItemForm);
        return;
      }

      const inventoryAdjustForm = event.target.closest("[data-inventory-adjust-form]");

      if (inventoryAdjustForm) {
        event.preventDefault();
        void adjustInventoryStock(inventoryAdjustForm);
      }
    });

    detailRoot.addEventListener("click", (event) => {
      const customerTagButton = event.target.closest("[data-customer-tag-toggle]");

      if (customerTagButton) {
        const tag = String(customerTagButton.dataset.customerTagToggle || "").trim().toLowerCase();
        const customer = getSelectedCustomerCrmRecord();

        if (!tag || !customer) {
          return;
        }

        const currentTags = normalizeCustomerTags(customer.tags || []);
        const nextTags = currentTags.includes(tag)
          ? currentTags.filter((entry) => entry !== tag)
          : [...currentTags, tag];

        void saveCustomerProfile({
          customerKey: customer.customerKey,
          notes: getCustomerNotesDraftFromDom(),
          tags: nextTags,
        });
        return;
      }

      const orderSelectButton = event.target.closest("[data-order-select]");

      if (orderSelectButton) {
        const orderId = String(orderSelectButton.dataset.orderSelect || "").trim();

        if (!orderId) {
          return;
        }

        adminState.activeSection = "orders";
        renderSectionChrome();
        renderSidebarNav();
        renderDashboardStats();
        renderModuleContent();
        updateSidebarMeta();
        void loadOrderDetails(orderId);
        return;
      }

      const actionButton = event.target.closest("[data-order-action]");

      if (!actionButton) {
        return;
      }

      const orderId = String(actionButton.dataset.orderAction || "").trim();
      const nextStatus = String(actionButton.dataset.nextStatus || "").trim();
      const note = String(actionButton.dataset.actionNote || "").trim();

      if (!orderId || !nextStatus) {
        return;
      }

      void updateOrderStatus(orderId, nextStatus, note);
    });
  }

  void (async () => {
    if (await loadInitialAdminSession()) {
      await loadActiveAdminSection({ preserveSelection: false });
    }
  })();
  window.setInterval(() => {
    void loadActiveAdminSection({ preserveSelection: true });
  }, ADMIN_DASHBOARD_REFRESH_MS);
};

const initLoginPage = async () => {
  const form = document.querySelector("[data-admin-login-form]");
  const submitButton = document.querySelector("[data-admin-login-submit]");
  const feedbackNode = document.querySelector("[data-admin-login-feedback]");

  if (!form) {
    return;
  }

  const nextField = form.elements.namedItem("next");

  if (nextField) {
    nextField.value = getSafeAdminRedirect();
  }

  try {
    const session = await fetchJson("/api/admin/session");

    if (session.authenticated) {
      window.location.href = getSafeAdminRedirect();
      return;
    }
  } catch (error) {
    setFeedback(feedbackNode, formatAdminLoginError(error));
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const identifier = String(formData.get("identifier") || "").trim();
    const password = String(formData.get("password") || "");
    const next = String(formData.get("next") || "/admin/");

    if (!identifier || !password) {
      setFeedback(feedbackNode, "Preencha login e senha para continuar.");
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Entrando...";
    }

    setFeedback(feedbackNode, "");

    try {
      const payload = await fetchJson("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({
          identifier,
          password,
          next,
        }),
      });

      setFeedback(feedbackNode, "Login validado. Abrindo painel...", "success");
      window.location.href = payload.redirectTo || "/admin/";
    } catch (error) {
      setFeedback(feedbackNode, formatAdminLoginError(error));
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Entrar no gestor";
      }
    }
  });
};

const syncAdminStaticBranding = () => {
  const page = document.body.dataset.adminPage;

  if (page === "login") {
    document.title = ADMIN_BRANDING.loginTitle || "Login | INovas Food";
    const eyebrow = document.querySelector(".admin-login-hero .admin-eyebrow");
    const headline = document.querySelector(".admin-login-hero h1");
    const loginInput = document.querySelector('[data-admin-login-form] input[name="identifier"]');

    if (eyebrow) {
      eyebrow.textContent = ADMIN_BRANDING.privateAreaLabel || "Area privada";
    }

    if (headline) {
      headline.textContent =
        ADMIN_BRANDING.loginHeadline || "Gestor web administrativo INovas Food";
    }

    if (loginInput) {
      loginInput.placeholder =
        ADMIN_BRANDING.loginPlaceholder || "seuemail@exemplo.com";
    }

    return;
  }

  if (page === "dashboard") {
    document.title = ADMIN_BRANDING.indexTitle || "Gestor | INovas Food";
    const logo = document.querySelector(".admin-brand-logo");
    const eyebrow = document.querySelector(".admin-brand-copy .admin-eyebrow");
    const title = document.querySelector(".admin-brand-copy strong");
    const subtitle = document.querySelector(".admin-brand-copy small");

    if (logo) {
      logo.src = ADMIN_ASSETS.adminSidebarLogo || "../assets/inovas-food-logo-oficial.png";
      logo.alt = ADMIN_BRANDING.sidebarTitle || "INovas Food";
    }

    if (eyebrow) {
      eyebrow.textContent = ADMIN_BRANDING.sidebarEyebrow || "INovas Food";
    }

    if (title) {
      title.textContent = ADMIN_BRANDING.sidebarTitle || "Painel Operacional";
    }

    if (subtitle) {
      subtitle.textContent = ADMIN_BRANDING.sidebarSubtitle || "Gestor de pedidos";
    }
  }
};

const currentPage = document.body.dataset.adminPage;

syncAdminStaticBranding();
initializeAdminTheme();

if (currentPage === "login") {
  void initLoginPage();
}

if (currentPage === "dashboard") {
  initDashboardPage();
}
