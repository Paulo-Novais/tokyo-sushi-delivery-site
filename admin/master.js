(() => {
  // ---------------------------------------------------------------------------
  // Initial state and section metadata
  // ---------------------------------------------------------------------------

  const MASTER_DEFAULT_MENU = [
    { key: "dashboard", label: "Dashboard Geral", status: "ready" },
    { key: "restaurants", label: "Restaurantes", status: "ready" },
    { key: "users", label: "Usuários", status: "ready" },
    { key: "plans", label: "Planos", status: "ready" },
    { key: "subscriptions", label: "Assinaturas", status: "ready" },
    { key: "sellers", label: "Vendedores", status: "ready" },
    { key: "commissions", label: "Comissao", status: "prepared" },
    { key: "contracts", label: "Contratos", status: "prepared" },
    { key: "finance", label: "Receita SaaS", status: "ready" },
    { key: "commercial", label: "Comercial", status: "ready" },
    { key: "resources", label: "Recursos", status: "foundation" },
    { key: "domains", label: "Dominios", status: "foundation" },
    { key: "reports", label: "Relatorios Gerais", status: "prepared" },
    { key: "logs", label: "Logs", status: "ready" },
    { key: "audit", label: "Auditoria", status: "ready" },
    { key: "developer", label: "Desenvolvedor", status: "foundation" },
    { key: "settings", label: "Configuracoes da Plataforma", status: "ready" },
  ];

  const SECTION_META = {
    dashboard: {
      chip: "Dashboard Plataforma",
      title: "Dashboard Plataforma",
      subtitle: "Leitura global da INOVAS Food, sem dependencia de restaurante unico.",
    },
    restaurants: {
      chip: "Restaurantes",
      title: "Restaurantes",
      subtitle: "Cadastro superior preparado para a carteira INOVAS Food.",
    },
    users: {
      chip: "Usuários",
      title: "Usuários",
      subtitle: "Base administrativa consolidada.",
    },
    plans: {
      chip: "Planos",
      title: "Planos",
      subtitle: "Estrutura comercial sem cobranca ativa.",
    },
    subscriptions: {
      chip: "Assinaturas",
      title: "Assinaturas",
      subtitle: "Situacao contratual dos restaurantes, sem gateway de pagamento.",
    },
    sellers: {
      chip: "Vendedores",
      title: "Vendedores",
      subtitle: "Carteira comercial e vinculos preparados por vendedor.",
    },
    commissions: {
      chip: "Comissao",
      title: "Comissao",
      subtitle: "Base preparada para calculo futuro de comissoes.",
    },
    contracts: {
      chip: "Contratos",
      title: "Contratos",
      subtitle: "Contratos e assinaturas preparados para integracao futura.",
    },
    finance: {
      chip: "Financeiro Plataforma",
      title: "Financeiro Plataforma",
      subtitle: "Indicadores financeiros consolidados da plataforma.",
    },
    commercial: {
      chip: "Comercial",
      title: "Dashboard Comercial",
      subtitle: "Acompanhamento comercial de leads, clientes e vendedores.",
    },
    resources: {
      chip: "Recursos",
      title: "Recursos",
      subtitle: "Feature flags comerciais preparadas para liberacao por plano.",
    },
    domains: {
      chip: "Dominios",
      title: "Dominios",
      subtitle: "Cadastro tecnico sem integracao DNS.",
    },
    subscriptions: {
      chip: "Assinaturas",
      title: "Assinaturas",
      subtitle: "Base preparada para cobranca futura.",
    },
    reports: {
      chip: "Relatorios Gerais",
      title: "Relatorios Gerais",
      subtitle: "Consolidacao preparada para multiplos restaurantes.",
    },
    logs: {
      chip: "Logs",
      title: "Logs",
      subtitle: "Eventos tecnicos da plataforma.",
    },
    audit: {
      chip: "Auditoria",
      title: "Auditoria",
      subtitle: "Rastro de alteracoes administrativas.",
    },
    developer: {
      chip: "Desenvolvedor",
      title: "Desenvolvedor",
      subtitle: "Diagnostico e status tecnico.",
    },
    settings: {
      chip: "Configuracoes",
      title: "Configuracoes da Plataforma",
      subtitle: "Marca e parametros globais preparados.",
    },
    restricted: {
      chip: "Acesso restrito",
      title: "Acesso restrito",
      subtitle: "Painel Master exclusivo para usuário MASTER.",
    },
  };

  const state = {
    activeSection: "dashboard",
    snapshot: null,
    isLoading: true,
    error: "",
    userSearch: "",
    selectedUserId: "",
    userMode: "list",
    userFilters: {
      restaurant: "",
      profile: "",
      status: "",
    },
    userFeedback: "",
    userFeedbackType: "info",
    isUserSubmitting: false,
    restaurantFilters: {
      name: "",
      city: "",
      state: "",
      plan: "",
      status: "",
      responsible: "",
      domain: "",
    },
    selectedRestaurantKey: "",
    selectedRestaurantTab: "info",
    restaurantOnboardingTouchedSlug: false,
  };

  const ONBOARDING_INTERNAL_HOST = "inovasfood.com.br";
  const ONBOARDING_INTERNAL_BASE_URL = `https://${ONBOARDING_INTERNAL_HOST}`;
  const ONBOARDING_PLAN_ORDER = ["START", "BUSINESS", "PRO"];
  const ONBOARDING_PLAN_COPY = Object.freeze({
    START: {
      label: "START",
      description: "Operacao inicial com cardapio online, pedidos e WhatsApp.",
    },
    BUSINESS: {
      label: "BUSINESS",
      description: "Rotina comercial com delivery, CRM, promocoes e relatorios.",
    },
    PRO: {
      label: "PRO",
      description: "Operacao completa com estoque, financeiro, dominio proprio e recursos avancados.",
    },
  });
  const ONBOARDING_RESOURCE_OPTIONS = Object.freeze([
    { key: "delivery", label: "Delivery" },
    { key: "pickup", label: "Retirada" },
    { key: "localConsumption", label: "Consumo Local" },
    { key: "tabs", label: "Comandas" },
    { key: "tables", label: "Mesas" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "finance", label: "Financeiro" },
    { key: "inventory", label: "Estoque" },
    { key: "autoPrint", label: "Impressao automatica" },
  ]);
  const MASTER_USER_PROFILE_ORDER = Object.freeze([
    "MASTER",
    "OWNER",
    "GERENTE",
    "CAIXA",
    "COZINHA",
    "GARCOM",
    "ENTREGADOR",
    "ESTOQUE",
    "FINANCEIRO",
    "MARKETING",
    "CUSTOM",
  ]);
  const MASTER_USER_PROFILE_COPY = Object.freeze({
    MASTER: {
      label: "MASTER",
      helper: "Acesso total da plataforma.",
      can: [
        "Administrar a plataforma",
        "Gerenciar restaurantes",
        "Gerenciar usuários",
        "Editar planos e configurações",
        "Auditar operações",
      ],
      cannot: ["Criar outro MASTER ativo nesta versão"],
    },
    OWNER: {
      label: "OWNER",
      helper: "Proprietário do restaurante.",
      can: [
        "Gerenciar pedidos",
        "Alterar cardápio",
        "Gerenciar usuários do restaurante",
        "Ver financeiro",
        "Editar configurações",
      ],
      cannot: ["Acessar outros restaurantes", "Gerenciar usuários MASTER", "Alterar planos da plataforma"],
    },
    GERENTE: {
      label: "GERENTE",
      helper: "Gestão operacional completa.",
      can: [
        "Gerenciar pedidos",
        "Alterar cardápio",
        "Ver relatórios",
        "Gerenciar clientes",
        "Aprovar promoções",
        "Acompanhar financeiro",
      ],
      cannot: ["Configurações da plataforma", "Cobranças SaaS", "Restaurantes", "Usuários MASTER"],
    },
    CAIXA: {
      label: "CAIXA",
      helper: "Atendimento e recebimentos.",
      can: ["Abrir pedidos", "Editar pedidos", "Ver clientes", "Consultar financeiro"],
      cannot: ["Configurar sistema", "Excluir usuários", "Alterar planos"],
    },
    COZINHA: {
      label: "COZINHA",
      helper: "Produção e preparo.",
      can: ["Ver pedidos", "Atualizar preparo", "Consultar cardápio"],
      cannot: ["Ver financeiro", "Alterar usuários", "Configurar restaurante"],
    },
    GARCOM: {
      label: "Garçom",
      helper: "Atendimento de salão.",
      can: ["Abrir pedidos", "Editar pedidos", "Consultar clientes", "Acompanhar mesas"],
      cannot: ["Ver financeiro", "Alterar cardápio", "Configurar sistema"],
    },
    ENTREGADOR: {
      label: "ENTREGADOR",
      helper: "Entrega e rotas.",
      can: ["Ver entregas", "Atualizar status da entrega", "Consultar pedidos atribuídos"],
      cannot: ["Editar cardápio", "Ver relatórios", "Gerenciar usuários"],
    },
    ESTOQUE: {
      label: "ESTOQUE",
      helper: "Itens e validade.",
      can: ["Ver estoque", "Criar itens", "Editar quantidades", "Consultar cardápio"],
      cannot: ["Gerenciar financeiro", "Alterar usuários", "Configurar plataforma"],
    },
    FINANCEIRO: {
      label: "FINANCEIRO",
      helper: "Recebimentos e relatórios.",
      can: ["Ver financeiro", "Editar lançamentos", "Exportar relatórios", "Acompanhar pedidos"],
      cannot: ["Alterar cardápio", "Gerenciar usuários MASTER", "Configurar plataforma"],
    },
    MARKETING: {
      label: "MARKETING",
      helper: "Campanhas e relacionamento.",
      can: ["Gerenciar promoções", "Ver clientes", "Acompanhar avaliações", "Ver relatórios"],
      cannot: ["Ver cobranças", "Alterar usuários", "Configurar plataforma"],
    },
    CUSTOM: {
      label: "Personalizado",
      helper: "Permissões escolhidas manualmente.",
      can: ["Apenas os módulos marcados em Permissões Avançadas"],
      cannot: ["Qualquer módulo não marcado"],
    },
  });
  const MASTER_USER_PERMISSION_FALLBACK_MODULES = Object.freeze([
    {
      key: "orders",
      label: "Pedidos",
      permissions: [
        { action: "view", label: "Ver", permission: "orders_view" },
        { action: "create", label: "Criar", permission: "orders_create" },
        { action: "edit", label: "Editar", permission: "orders_edit" },
        { action: "delete", label: "Cancelar", permission: "orders_delete" },
      ],
    },
    {
      key: "customers",
      label: "Clientes",
      permissions: [
        { action: "view", label: "Ver", permission: "customers_view" },
        { action: "create", label: "Criar", permission: "customers_create" },
        { action: "edit", label: "Editar", permission: "customers_edit" },
      ],
    },
    {
      key: "catalog",
      label: "Produtos",
      permissions: [
        { action: "view", label: "Ver", permission: "catalog_view" },
        { action: "create", label: "Criar", permission: "catalog_create" },
        { action: "edit", label: "Editar", permission: "catalog_edit" },
      ],
    },
  ]);

  const numberFormatter = new Intl.NumberFormat("pt-BR");
  const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  // ---------------------------------------------------------------------------
  // DOM and formatting helpers
  // ---------------------------------------------------------------------------

  const query = (selector) => document.querySelector(selector);
  const queryAll = (selector) => Array.from(document.querySelectorAll(selector));

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const asArray = (value) => (Array.isArray(value) ? value : []);

  const normalizeSearch = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const formatNumber = (value) => numberFormatter.format(Number(value || 0));
  const formatCurrency = (value) => currencyFormatter.format(Number(value || 0));
  const formatPercent = (value) => `${formatNumber(value)}%`;

  const formatDateTime = (value) => {
    if (!value) {
      return "--";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  };

  const getInitials = (value) => {
    const tokens = String(value || "Master")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return tokens
      .slice(0, 2)
      .map((token) => token.charAt(0).toUpperCase())
      .join("") || "M";
  };

  const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(payload.error || "Nao foi possivel concluir a operacao.");
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  };

  const redirectToLogin = () => {
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/admin/login.html?next=${encodeURIComponent(next)}`;
  };

  const renderStatus = (status) => {
    const label = String(status || "PREPARED");
    const statusKey =
      label
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "prepared";

    return `<span class="master-status master-status-${escapeHtml(statusKey)}">${escapeHtml(label)}</span>`;
  };

  const renderFeedback = () => {
    if (!state.userFeedback) {
      return "";
    }

    return `
      <div class="admin-feedback ${
        state.userFeedbackType === "success" ? "is-success" : state.userFeedbackType === "error" ? "is-error" : ""
      }" data-master-user-feedback>
        ${escapeHtml(state.userFeedback)}
      </div>
    `;
  };

  // ---------------------------------------------------------------------------
  // Shared render helpers
  // ---------------------------------------------------------------------------

  const renderTable = (headers, rows, emptyLabel) => `
    <div class="master-table-wrap">
      <table class="master-table">
        <thead>
          <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows.join("")
              : `<tr><td colspan="${headers.length}">${escapeHtml(emptyLabel)}</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;

  const renderFieldGrid = (entries) => `
    <div class="master-field-grid">
      ${entries
        .map(
          (entry) => `
            <article class="master-field">
              <span>${escapeHtml(entry.label)}</span>
              <strong>${escapeHtml(entry.value || "--")}</strong>
            </article>
          `
        )
        .join("")}
    </div>
  `;

  const renderActionButton = (label, action, id = "") => `
    <button class="admin-action-button is-compact" type="button" data-master-prepared-action="${escapeHtml(action)}" data-master-action-id="${escapeHtml(id)}">
      ${escapeHtml(label)}
    </button>
  `;

  const renderDangerActionButton = (label, action, id = "") => `
    <button class="admin-action-button is-compact is-danger" type="button" data-master-prepared-action="${escapeHtml(action)}" data-master-action-id="${escapeHtml(id)}">
      ${escapeHtml(label)}
    </button>
  `;

  const getRestaurantByKey = (restaurantKey) =>
    asArray(state.snapshot?.restaurants).find(
      (restaurant) => String(restaurant.restaurantKey || restaurant.key || "") === String(restaurantKey || "")
    ) || null;

  const getRestaurantUsers = (restaurantKey) =>
    asArray(state.snapshot?.users).filter((user) => user.restaurantKey === restaurantKey);

  const getMenu = () => asArray(state.snapshot?.menu).length ? state.snapshot.menu : MASTER_DEFAULT_MENU;

  // ---------------------------------------------------------------------------
  // Shell, menu and platform KPIs
  // ---------------------------------------------------------------------------

  const renderNav = () => {
    const navRoot = query("[data-master-nav]");

    if (!navRoot) {
      return;
    }

    if (state.error && !state.snapshot) {
      navRoot.innerHTML = `
        <div class="master-nav-denied">
          <strong>Acesso restrito</strong>
          <small>Entre com um usuário MASTER para ver os módulos da plataforma.</small>
        </div>
      `;
      return;
    }

    navRoot.innerHTML = getMenu()
      .map(
        (item) => `
          <button
            class="master-nav-item ${state.activeSection === item.key ? "is-active" : ""}"
            type="button"
            data-master-section-button="${escapeHtml(item.key)}"
          >
            <span>${escapeHtml(item.label)}</span>
            <small>${escapeHtml(item.status || "prepared")}</small>
          </button>
        `
      )
      .join("");
  };

  const renderChrome = () => {
    document.body.dataset.masterSection = state.activeSection;
    const isRestaurantOnboarding =
      state.activeSection === "restaurants" && state.userMode === "new-restaurant";
    const isUserCreation = state.activeSection === "users" && state.userMode === "new-user";
    const meta = isRestaurantOnboarding
      ? {
          chip: "Cadastro",
          title: "Cadastro de Restaurante",
          subtitle: "Formulário limpo para criar o cliente e preparar o cardápio online.",
        }
      : isUserCreation
      ? {
          chip: "Usuários > Novo usuário",
          title: "Novo usuário",
          subtitle: "Cadastre um usuário para acessar o restaurante.",
        }
      : state.error && !state.snapshot
      ? SECTION_META.restricted
      : SECTION_META[state.activeSection] || SECTION_META.dashboard;
    const chip = query("[data-master-chip]");
    const title = query("[data-master-title]");
    const subtitle = query("[data-master-subtitle]");
    const storageMode = query("[data-master-storage-mode]");
    const userName = query("[data-master-user-name]");
    const userType = query("[data-master-user-type]");
    const userInitials = query("[data-master-user-initials]");
    const admin = state.snapshot?.admin || {};

    if (chip) {
      chip.textContent = meta.chip;
    }

    if (title) {
      title.textContent = meta.title;
    }

    if (subtitle) {
      subtitle.textContent = meta.subtitle;
    }

    if (storageMode) {
      storageMode.textContent = state.snapshot?.storageMode || "Carregando";
    }

    if (userName) {
      userName.textContent = admin.displayName || admin.name || "Master";
    }

    if (userType) {
      userType.textContent = admin.userType || admin.tipo_usuario || "MASTER";
    }

    if (userInitials) {
      userInitials.textContent = getInitials(admin.displayName || admin.name || "Master");
    }
  };

  const renderKpis = () => {
    const kpiRoot = query("[data-master-kpis]");

    if (!kpiRoot) {
      return;
    }

    if (
      (state.activeSection === "restaurants" && state.userMode === "new-restaurant") ||
      state.activeSection === "users"
    ) {
      kpiRoot.hidden = true;
      kpiRoot.innerHTML = "";
      return;
    }

    kpiRoot.hidden = false;
    const dashboard = state.snapshot?.platformDashboard || state.snapshot?.dashboard || {};
    const kpis = [
      ["Total Restaurantes", formatNumber(dashboard.totalRestaurants)],
      ["Ativos", formatNumber(dashboard.activeRestaurants)],
      ["Bloqueados", formatNumber(dashboard.blockedRestaurants)],
      ["Usuários Sistema", formatNumber(dashboard.systemUsers)],
      ["Usuários Restaurantes", formatNumber(dashboard.restaurantUsers)],
      ["Pedidos Hoje", formatNumber(dashboard.ordersToday)],
      ["Pedidos Mes", formatNumber(dashboard.ordersMonth)],
      ["Clientes Totais", formatNumber(dashboard.totalCustomers)],
      ["Faturamento Total", formatCurrency(dashboard.totalRevenue)],
      ["Faturamento Mensal", formatCurrency(dashboard.monthlyRevenue)],
      ["Novos Restaurantes", formatNumber(dashboard.newRestaurants)],
      ["Assinaturas Ativas", formatNumber(dashboard.activeSubscriptions)],
      ["Assinaturas Vencendo", formatNumber(dashboard.expiringSubscriptions)],
      ["Uso Medio Plataforma", formatPercent(dashboard.averagePlatformUsage)],
      ["Chamados", formatNumber(dashboard.supportTickets)],
      ["Erros", formatNumber(dashboard.errors)],
      ["Performance", `${formatNumber(dashboard.performanceScore)}%`],
    ];

    kpiRoot.innerHTML = kpis
      .map(
        ([label, value]) => `
          <article class="master-kpi-card">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </article>
        `
      )
      .join("");
  };

  const renderDashboard = () => {
    const restaurants = asArray(state.snapshot?.restaurants);
    const plans = asArray(state.snapshot?.platformPlans || state.snapshot?.plans);
    const modules = getMenu();
    const dashboard = state.snapshot?.platformDashboard || state.snapshot?.dashboard || {};
    const finance = state.snapshot?.financeDashboard || {};
    const commercial = state.snapshot?.commercialDashboard || {};

    return `
      <div class="master-panel-grid">
        <article class="master-panel">
          <h2>Plataforma</h2>
          ${renderFieldGrid([
            { label: "Nome", value: state.snapshot?.platform?.platformName || "INOVAS Food" },
            { label: "Versao", value: state.snapshot?.platform?.version || "--" },
            {
              label: "Modo manutencao",
              value: state.snapshot?.platform?.maintenanceMode ? "Ativo" : "Inativo",
            },
            { label: "Performance", value: dashboard.performanceStatus || "Estavel" },
            { label: "Uso medio", value: formatPercent(dashboard.averagePlatformUsage) },
            { label: "Chamados", value: formatNumber(dashboard.supportTickets) },
          ])}
        </article>
        <article class="master-panel">
          <h2>Consolidado SaaS</h2>
          ${renderFieldGrid([
            { label: "Restaurantes", value: formatNumber(dashboard.totalRestaurants) },
            { label: "Assinaturas ativas", value: formatNumber(dashboard.activeSubscriptions) },
            { label: "MRR", value: formatCurrency(finance.mrr) },
            { label: "Receita anual", value: formatCurrency(finance.annualRevenue) },
            { label: "Vendedores", value: formatNumber(commercial.sellers) },
            { label: "Clientes pagantes", value: formatNumber(finance.payingCustomers) },
          ])}
        </article>
      </div>
      <div class="master-panel-grid">
        <article class="master-panel">
          <h2>Modulos da Plataforma</h2>
          <div class="master-list">
            ${modules
              .map(
                (module) => `
                  <div class="master-list-row">
                    <strong>${escapeHtml(module.label)}</strong>
                    ${renderStatus(module.status)}
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
        <article class="master-panel">
          <h2>Restaurantes Recentes</h2>
          <div class="master-list">
            ${restaurants
              .slice(0, 6)
              .map(
                (restaurant) => `
                  <div class="master-list-row">
                    <strong>${escapeHtml(restaurant.name || restaurant.restaurantKey)}</strong>
                    ${renderStatus(restaurant.statusLabel || restaurant.status)}
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
      </div>
      <div class="master-panel">
        <h2>Planos Oficiais</h2>
        <div class="master-card-grid">
          ${plans
            .map(
              (plan) => `
                <article class="master-card">
                  <span>${escapeHtml(plan.status)}</span>
                  <strong>${escapeHtml(plan.displayName || plan.name)}</strong>
                  <small>${escapeHtml(plan.description)}</small>
                  <div class="master-list-row">
                    <strong>Valor</strong>
                    <span>${escapeHtml(formatCurrency(plan.monthlyValue || plan.valor_mensal))}</span>
                  </div>
                </article>
              `
            )
            .join("")}
        </div>
      </div>
    `;
  };

  // ---------------------------------------------------------------------------
  // Restaurants
  // ---------------------------------------------------------------------------

  const renderRestaurants = () => {
    if (state.userMode === "new-restaurant") {
      return renderRestaurantRegistrationForm();
    }

    const filters = state.restaurantFilters || {};
    const filterValue = (key) => normalizeSearch(filters[key]);
    const restaurants = asArray(state.snapshot?.restaurants);
    const filteredRestaurants = restaurants.filter((restaurant) => {
      const registration = restaurant.registration || {};
      const owner = restaurant.owner || {};
      const city = registration.city || restaurant.address?.city || restaurant.onboarding?.address?.city || "";
      const stateValue = registration.state || restaurant.address?.state || restaurant.onboarding?.address?.state || "";
      const responsible = registration.ownerFullName || owner.fullName || owner.name || "";
      const haystacks = {
        name: `${restaurant.name || ""} ${restaurant.restaurantKey || ""}`,
        city,
        state: stateValue,
        plan: restaurant.plan,
        status: `${restaurant.status || ""} ${restaurant.statusLabel || ""}`,
        responsible,
        domain: restaurant.domain,
      };

      return Object.keys(filters).every((key) => {
        const value = filterValue(key);
        return !value || normalizeSearch(haystacks[key]).includes(value);
      });
    });
    const rows = filteredRestaurants.map(
      (restaurant) => `
        <tr>
          <td>${escapeHtml(restaurant.restaurantId || restaurant.restaurantKey || restaurant.key)}</td>
          <td>
            <img class="master-brand-logo" src="${escapeHtml(restaurant.logo || "../assets/inovas-food-logo-oficial.png")}" alt="${escapeHtml(restaurant.name || "Restaurante")}" />
          </td>
          <td>
            <strong>${escapeHtml(restaurant.name)}</strong>
            <small>${escapeHtml(restaurant.slug || restaurant.restaurantKey)}</small>
          </td>
          <td>${escapeHtml(restaurant.domain || "--")}</td>
          <td>${escapeHtml(restaurant.plan || "--")}</td>
          <td>${renderStatus(restaurant.statusLabel || restaurant.status)}</td>
          <td>${escapeHtml(restaurant.registration?.city || restaurant.address?.city || restaurant.onboarding?.address?.city || "--")}</td>
          <td>${escapeHtml(restaurant.registration?.state || restaurant.address?.state || restaurant.onboarding?.address?.state || "--")}</td>
          <td>${escapeHtml(restaurant.registration?.ownerFullName || restaurant.owner?.fullName || "--")}</td>
          <td>${escapeHtml(restaurant.registration?.phone || restaurant.owner?.phone || restaurant.whatsapp || "--")}</td>
          <td>${escapeHtml(formatDateTime(restaurant.createdAt))}</td>
          <td>${escapeHtml(formatDateTime(getRestaurantUsers(restaurant.restaurantKey).map((user) => user.lastAccessAt || user.ultimo_acesso).filter(Boolean).sort().pop()))}</td>
          <td>
            <div class="master-row-actions">
              <button class="admin-action-button is-compact" type="button" data-master-restaurant-action="view" data-master-restaurant-key="${escapeHtml(restaurant.restaurantKey)}">Visualizar</button>
              ${renderActionButton("Editar", "restaurant-edit", restaurant.restaurantKey)}
              ${renderActionButton("Bloquear", "restaurant-block", restaurant.restaurantKey)}
              ${renderActionButton("Suspender", "restaurant-suspend", restaurant.restaurantKey)}
              ${renderActionButton("Reativar", "restaurant-reactivate", restaurant.restaurantKey)}
              ${renderDangerActionButton("Excluir", "restaurant-soft-delete", restaurant.restaurantKey)}
            </div>
          </td>
        </tr>
      `
    );

    return `
      <article class="master-panel">
        <header class="master-panel-head">
          <div>
            <h2>Gestao de Restaurantes</h2>
            <p>${escapeHtml(String(filteredRestaurants.length))} de ${escapeHtml(String(restaurants.length))} restaurantes exibidos. Consultas globais preparadas para paginacao.</p>
          </div>
          <button class="admin-button admin-button-primary" type="button" data-master-user-action="new-restaurant">
            Novo restaurante
          </button>
        </header>
        <div class="master-registration-form">
          ${["name", "city", "state", "plan", "status", "responsible", "domain"]
            .map(
              (key) => `
                <label>
                  <span>${escapeHtml({
                    name: "Nome",
                    city: "Cidade",
                    state: "Estado",
                    plan: "Plano",
                    status: "Status",
                    responsible: "Responsavel",
                    domain: "Dominio",
                  }[key])}</span>
                  <input class="admin-input" value="${escapeHtml(filters[key] || "")}" data-master-restaurant-filter="${escapeHtml(key)}" />
                </label>
              `
            )
            .join("")}
        </div>
        ${renderTable(
          [
            "ID",
            "Logo",
            "Nome",
            "Dominio",
            "Plano",
            "Status",
            "Cidade",
            "Estado",
            "Responsavel",
            "Telefone",
            "Data Cadastro",
            "Ultimo Login",
            "Acoes",
          ],
          rows,
          "Nenhum restaurante cadastrado."
        )}
      </article>
      ${renderRestaurantPage()}
    `;
  };

  const renderRestaurantPage = () => {
    const restaurant = getRestaurantByKey(state.selectedRestaurantKey);

    if (!restaurant) {
      return "";
    }

    const users = getRestaurantUsers(restaurant.restaurantKey);
    const subscription = asArray(state.snapshot?.subscriptions).find(
      (entry) => entry.restaurantKey === restaurant.restaurantKey
    ) || {};
    const tabs = [
      ["info", "Informacoes"],
      ["media", "Logo/Banner"],
      ["plan", "Plano"],
      ["users", "Usuários"],
      ["finance", "Financeiro"],
      ["orders", "Pedidos"],
      ["customers", "Clientes"],
      ["catalog", "Cardapio"],
      ["inventory", "Estoque"],
      ["metrics", "Metricas"],
      ["reviews", "Avaliacoes"],
      ["settings", "Configuracoes"],
    ];
    const activeTab = state.selectedRestaurantTab || "info";
    const tabContent = {
      info: renderFieldGrid([
        { label: "ID", value: restaurant.restaurantId || restaurant.restaurantKey },
        { label: "Nome", value: restaurant.name },
        { label: "Dominio", value: restaurant.domain },
        { label: "Cidade", value: restaurant.registration?.city || restaurant.address?.city },
        { label: "Estado", value: restaurant.registration?.state || restaurant.address?.state },
        { label: "Responsavel", value: restaurant.registration?.ownerFullName || restaurant.owner?.fullName },
      ]),
      media: renderFieldGrid([
        { label: "Logo", value: restaurant.logo || "Logo do restaurante preparada" },
        { label: "Banner", value: restaurant.banner || "Banner do restaurante preparado" },
        { label: "Branding", value: "Separado da marca INOVAS Food" },
      ]),
      plan: renderFieldGrid([
        { label: "Plano", value: subscription.plan || restaurant.plan },
        { label: "Status", value: subscription.contractStatus || subscription.status },
        { label: "Mensalidade", value: formatCurrency(subscription.monthlyValue || subscription.valor_mensal) },
      ]),
      users: renderTable(
        ["Nome", "Perfil", "Status"],
        users.map(
          (user) => `
            <tr>
              <td>${escapeHtml(user.name || user.login)}</td>
              <td>${escapeHtml(user.userType || user.tipo_usuario)}</td>
              <td>${renderStatus(user.statusLabel || user.status)}</td>
            </tr>
          `
        ),
        "Nenhum usuário vinculado."
      ),
      finance: renderFieldGrid([
        { label: "Mensalidade", value: formatCurrency(subscription.monthlyValue || subscription.valor_mensal) },
        { label: "Forma pagamento", value: "Nao integrado" },
        { label: "Historico", value: "Preparado para integracao futura" },
      ]),
      orders: renderFieldGrid([
        { label: "Pedidos", value: formatNumber(state.snapshot?.dashboard?.totalOrders) },
        { label: "Escopo", value: restaurant.restaurantKey },
      ]),
      customers: renderFieldGrid([
        { label: "Clientes", value: formatNumber(state.snapshot?.dashboard?.totalCustomers) },
        { label: "Escopo", value: restaurant.restaurantKey },
      ]),
      catalog: renderFieldGrid([{ label: "Cardapio", value: "Preparado para consulta por restaurante" }]),
      inventory: renderFieldGrid([{ label: "Estoque", value: "Preparado para consulta por restaurante" }]),
      metrics: renderFieldGrid([{ label: "Metricas", value: "Preparado para consolidado por restaurante" }]),
      reviews: renderFieldGrid([{ label: "Avaliacoes", value: formatNumber(state.snapshot?.dashboard?.totalReviews) }]),
      settings: renderFieldGrid([{ label: "Configuracoes", value: "Preparadas por tenant/restaurante" }]),
    }[activeTab] || "";

    return `
      <article class="master-panel" data-master-restaurant-page>
        <header class="master-panel-head">
          <div>
            <span class="admin-chip">Pagina Restaurante</span>
            <h2>${escapeHtml(restaurant.name)}</h2>
            <p>Todas as abas usam dados escopados por restaurante e preservam a marca INOVAS separada.</p>
          </div>
          <button class="admin-action-button is-compact" type="button" data-master-restaurant-action="close">Fechar</button>
        </header>
        <div class="master-token-list">
          ${tabs
            .map(
              ([key, label]) => `
                <button class="admin-action-button is-compact ${activeTab === key ? "is-primary" : ""}" type="button" data-master-restaurant-tab="${escapeHtml(key)}">
                  ${escapeHtml(label)}
                </button>
              `
            )
            .join("")}
        </div>
        ${tabContent}
      </article>
    `;
  };

  const getMasterUsers = () => asArray(state.snapshot?.users);

  // ---------------------------------------------------------------------------
  // Users and restaurant onboarding
  // ---------------------------------------------------------------------------

  const getMasterUserById = (id) => {
    const targetId = String(id || "").trim();

    if (!targetId) {
      return null;
    }

    return (
      getMasterUsers().find(
        (user) =>
          String(user.id || "") === targetId ||
          String(user.directoryId || "") === targetId ||
          String(user.login || "") === targetId
      ) || null
    );
  };

  const getPlanOptions = () => {
    const plans = asArray(state.snapshot?.plans)
      .map((plan) => ({
        key: String(plan.key || plan.plan || plan.name || "").trim(),
        label: String(plan.name || plan.key || plan.plan || "").trim(),
        description: String(plan.description || ONBOARDING_PLAN_COPY[plan.key]?.description || "").trim(),
      }))
      .filter((plan) => plan.key);
    const plansByKey = new Map(plans.map((plan) => [plan.key.toUpperCase(), plan]));

    return ONBOARDING_PLAN_ORDER.map((key) => {
      const plan = plansByKey.get(key) || {};
      return {
        key,
        label: ONBOARDING_PLAN_COPY[key]?.label || plan.label || key,
        description: plan.description || ONBOARDING_PLAN_COPY[key]?.description || "",
      };
    });
  };

  const normalizeDomainForForm = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "")
      .replace(/^www\./, "");

  const getExistingSlugSet = () =>
    new Set(
      asArray(state.snapshot?.restaurants)
        .flatMap((restaurant) => [
          restaurant.slug,
          restaurant.restaurantKey,
          restaurant.key,
        ])
        .map((value) => toSlug(value))
        .filter(Boolean)
    );

  const getExistingDomainSet = () =>
    new Set(
      [
        ...asArray(state.snapshot?.domains).flatMap((domain) => [
          domain.domain,
          domain.primaryDomain,
          domain.customDomain,
        ]),
        ...asArray(state.snapshot?.restaurants).map((restaurant) => restaurant.domain),
      ]
        .map((value) => normalizeDomainForForm(value))
        .filter(Boolean)
    );

  const isValidEmail = (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim().toLowerCase());

  const getDigits = (value) => String(value || "").replace(/\D+/g, "");

  const isValidPhone = (value) => {
    const digits = getDigits(value);
    return digits.length >= 10 && digits.length <= 15;
  };

  const isValidDomain = (value) => {
    const domain = normalizeDomainForForm(value);
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain);
  };

  const isValidCnpj = (value) => {
    const digits = getDigits(value);

    if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) {
      return false;
    }

    const calculateDigit = (base) => {
      const weights = base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const sum = base
        .split("")
        .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
      const rest = sum % 11;
      return rest < 2 ? "0" : String(11 - rest);
    };

    const firstDigit = calculateDigit(digits.slice(0, 12));
    const secondDigit = calculateDigit(`${digits.slice(0, 12)}${firstDigit}`);

    return digits.endsWith(`${firstDigit}${secondDigit}`);
  };

  const getSlugAvailability = (slugValue) => {
    const slug = toSlug(slugValue);

    if (!slug || slug.length < 3) {
      return { status: "empty", label: "Informe um slug com pelo menos 3 caracteres." };
    }

    if (getExistingSlugSet().has(slug)) {
      return { status: "invalid", label: "Ja utilizado" };
    }

    return { status: "valid", label: "Disponivel" };
  };

  const getDomainAvailability = (domainValue) => {
    const domain = normalizeDomainForForm(domainValue);

    if (!domain) {
      return { status: "empty", label: "Informe o domínio desejado." };
    }

    if (!isValidDomain(domain)) {
      return { status: "invalid", label: "Domínio inválido" };
    }

    if (getExistingDomainSet().has(domain)) {
      return { status: "invalid", label: "Já utilizado" };
    }

    return { status: "valid", label: "Aguardando verificação" };
  };

  const renderOnboardingField = ({
    label,
    name,
    type = "text",
    placeholder = "",
    required = false,
    autocomplete = "",
    inputmode = "",
    value = "",
    wide = false,
    minLength = "",
  }) => `
    <label class="${wide ? "master-onboarding-field is-wide" : "master-onboarding-field"}">
      <span>${escapeHtml(label)}${required ? " *" : ""}</span>
      <input
        class="admin-input"
        name="${escapeHtml(name)}"
        type="${escapeHtml(type)}"
        value="${escapeHtml(value)}"
        placeholder="${escapeHtml(placeholder)}"
        ${required ? "required" : ""}
        ${autocomplete ? `autocomplete="${escapeHtml(autocomplete)}"` : ""}
        ${inputmode ? `inputmode="${escapeHtml(inputmode)}"` : ""}
        ${minLength ? `minlength="${escapeHtml(minLength)}"` : ""}
        data-master-onboarding-input
      />
      <small data-master-onboarding-validation="${escapeHtml(name)}"></small>
    </label>
  `;

  const renderOnboardingAccordion = ({ number, title, helper = "", open = false, body = "" }) => `
    <details class="master-onboarding-accordion" ${open ? "open" : ""}>
      <summary>
        <span class="master-onboarding-step">${escapeHtml(number)}</span>
        <span>
          <strong>${escapeHtml(title)}</strong>
          ${helper ? `<small>${escapeHtml(helper)}</small>` : ""}
        </span>
      </summary>
      <div class="master-onboarding-body">
        ${body}
      </div>
    </details>
  `;

  const getMasterUserProfileCopy = (profile) =>
    MASTER_USER_PROFILE_COPY[String(profile || "").toUpperCase()] || MASTER_USER_PROFILE_COPY.CUSTOM;

  const getMasterUserTypeOptions = () =>
    MASTER_USER_PROFILE_ORDER.map((key) => ({
      key,
      label: getMasterUserProfileCopy(key).label,
      helper: getMasterUserProfileCopy(key).helper,
      disabled: key === "MASTER",
    }));

  const getRestaurantOptionsForUserForm = () =>
    asArray(state.snapshot?.restaurants)
      .map((restaurant) => ({
        key: String(restaurant.restaurantKey || restaurant.key || "").trim(),
        label: String(restaurant.name || restaurant.tradeName || restaurant.restaurantKey || "").trim(),
        plan: String(restaurant.plan || "").trim(),
        status: String(restaurant.statusLabel || restaurant.status || "").trim(),
      }))
      .filter((restaurant) => restaurant.key);

  const getRestaurantOptionLabel = (restaurantKey) => {
    const option = getRestaurantOptionsForUserForm().find(
      (restaurant) => restaurant.key === String(restaurantKey || "")
    );

    return option?.label || (restaurantKey ? String(restaurantKey) : "Aguardando restaurante");
  };

  const renderMasterUserAvatar = (user) => {
    const label = user.name || user.nome || user.login || "Usuário";

    return `<span class="master-user-avatar">${escapeHtml(getInitials(label))}</span>`;
  };

  const renderMasterUserProfileBadge = (profile) => {
    const key = String(profile || "CUSTOM").toUpperCase();
    const copy = getMasterUserProfileCopy(key);

    return `<span class="master-user-profile-badge" data-profile="${escapeHtml(key)}">${escapeHtml(copy.label)}</span>`;
  };

  const renderMasterUserPlanBadge = (plan) => {
    const label = String(plan || "--").trim() || "--";

    return `<span class="master-user-plan-badge">${escapeHtml(label)}</span>`;
  };

  const renderMasterUserStatusDot = (status) => {
    const normalizedStatus = String(status || "").toUpperCase();
    const label = normalizedStatus === "BLOCKED" ? "Bloqueado" : normalizedStatus === "ACTIVE" ? "Ativo" : "Inativo";

    return `
      <span class="master-user-status-dotline" data-status="${escapeHtml(normalizedStatus || "INACTIVE")}">
        <i></i>${escapeHtml(label)}
      </span>
    `;
  };

  const getMasterUserStats = () => {
    const users = getMasterUsers();
    const active = users.filter((user) => String(user.status || "").toUpperCase() === "ACTIVE").length;
    const blocked = users.filter((user) => String(user.status || "").toUpperCase() === "BLOCKED").length;
    const inactive = users.filter((user) => {
      const status = String(user.status || "").toUpperCase();
      return status && status !== "ACTIVE" && status !== "BLOCKED";
    }).length;

    return {
      total: users.length,
      active,
      inactive,
      blocked,
    };
  };

  const hasActiveMasterUserFilters = () =>
    Boolean(
      state.userSearch ||
        Object.values(state.userFilters || {}).some((value) => String(value || "").trim())
    );

  const getFilteredMasterUsers = () => {
    const search = normalizeSearch(state.userSearch);
    const filters = state.userFilters || {};

    return getMasterUsers().filter((user) => {
      const searchIndex = normalizeSearch(
        [
          user.searchIndex,
          user.id,
          user.directoryId,
          user.name,
          user.nome,
          user.login,
          user.email,
          user.phone,
          user.telefone,
          user.restaurantName,
          user.restaurant,
          user.restaurantKey,
          user.taxId,
          user.cnpjMei,
          user.ownerFullName,
          user.tradeName,
        ].join(" ")
      );
      const profile = String(user.userType || user.tipo_usuario || "CUSTOM").toUpperCase();
      const status = String(user.status || "").toUpperCase();
      const restaurantValue = String(filters.restaurant || "");
      const profileValue = String(filters.profile || "").toUpperCase();
      const statusValue = String(filters.status || "").toUpperCase();
      const restaurantMatches =
        !restaurantValue ||
        (restaurantValue === "platform"
          ? user.isPlatformUser || !user.restaurantKey
          : String(user.restaurantKey || "") === restaurantValue);

      return (
        (!search || searchIndex.includes(search)) &&
        restaurantMatches &&
        (!profileValue || profile === profileValue) &&
        (!statusValue || status === statusValue)
      );
    });
  };

  const renderMasterUserActionButtons = (user) => {
    const id = user.id || user.directoryId || user.login;
    const isBlocked = user.status === "BLOCKED";

    return `
      <div class="master-row-actions">
        <button class="admin-action-button is-compact" type="button" data-master-user-action="view" data-master-user-id="${escapeHtml(id)}">
          Ver
        </button>
        <button class="admin-action-button is-compact" type="button" data-master-user-action="edit" data-master-user-id="${escapeHtml(id)}">
          Editar
        </button>
        <button class="admin-action-button is-compact ${isBlocked ? "" : "is-danger"}" type="button" data-master-user-action="toggle" data-master-user-id="${escapeHtml(id)}" data-master-next-status="${isBlocked ? "ACTIVE" : "BLOCKED"}">
          ${isBlocked ? "Desbloquear" : "Bloquear"}
        </button>
      </div>
    `;
  };

  const renderMasterUsersTable = () => {
    const users = getFilteredMasterUsers();
    const rows = users.map((user, index) => {
      const id = user.id || user.directoryId || user.login;
      const profile = String(user.userType || user.tipo_usuario || "CUSTOM").toUpperCase();

      return `
        <tr data-master-user-row>
          <td>
            <strong title="${escapeHtml(id)}">${escapeHtml(String(index + 1))}</strong>
          </td>
          <td>
            <div class="master-user-identity">
              ${renderMasterUserAvatar(user)}
              <span>
                <strong>${escapeHtml(user.name || user.nome || user.login || "--")}</strong>
                <small>${escapeHtml(user.email || user.login || "Sem e-mail")}</small>
              </span>
            </div>
          </td>
          <td>
            <strong>${escapeHtml(user.restaurantName || user.restaurant || "--")}</strong>
            <small>${escapeHtml(user.cnpjMei || user.taxId || user.restaurantKey || "--")}</small>
          </td>
          <td>${renderMasterUserPlanBadge(user.planName || user.plan || "--")}</td>
          <td>${renderMasterUserProfileBadge(profile)}</td>
          <td>${renderMasterUserStatusDot(user.status)}</td>
          <td>${renderMasterUserActionButtons(user)}</td>
        </tr>
      `;
    });

    return `
      <article class="master-users-table-card">
        ${renderTable(
          ["ID", "Nome", "Restaurante", "Plano", "Perfil", "Status", "Ações"],
          rows,
          "Nenhum usuário encontrado."
        )}
        <footer class="master-users-pagination">
          <span>Mostrando 1 a ${escapeHtml(String(users.length))} de ${escapeHtml(String(users.length))} usuários</span>
          <div>
            <label>
              <span>Itens por página</span>
              <select class="admin-input" disabled>
                <option>10</option>
              </select>
            </label>
            <button class="admin-action-button is-compact" type="button" disabled>&lt;</button>
            <button class="admin-action-button is-compact is-primary" type="button" disabled>1</button>
            <button class="admin-action-button is-compact" type="button" disabled>&gt;</button>
          </div>
        </footer>
      </article>
    `;
  };

  const renderMasterUserDetails = (user) => {
    if (!user) {
      return "";
    }

    return `
      <article class="master-panel master-user-drawer" data-master-user-drawer>
        <header class="master-panel-head">
          <div>
            <span class="admin-chip">Visualizacao</span>
            <h2>${escapeHtml(user.name || user.nome || user.login)}</h2>
          </div>
          <button class="admin-action-button is-compact" type="button" data-master-user-action="close">
            Fechar
          </button>
        </header>
        ${renderFieldGrid([
          { label: "ID", value: user.id || user.directoryId || user.login },
          { label: "Login", value: user.login },
          { label: "E-mail", value: user.email },
          { label: "Restaurante", value: user.restaurantName || user.restaurant },
          { label: "Plano", value: user.planName || user.plan },
          { label: "Perfil", value: user.userTypeLabel || user.userType || user.tipo_usuario },
          { label: "CNPJ/MEI", value: user.cnpjMei || user.taxId },
          { label: "Telefone", value: user.phone || user.telefone },
          { label: "Cidade", value: user.city },
          { label: "Data de adesao", value: user.adhesionDate ? formatDateTime(user.adhesionDate) : "" },
        ])}
      </article>
    `;
  };

  const renderMasterUserEditForm = (user) => {
    if (!user) {
      return "";
    }

    const selectedType = String(user.userType || user.tipo_usuario || "CUSTOM").toUpperCase();

    return `
      <form class="master-panel master-user-drawer" data-master-user-edit-form>
        <header class="master-panel-head">
          <div>
            <span class="admin-chip">Editar usuário</span>
            <h2>${escapeHtml(user.name || user.login)}</h2>
          </div>
          <button class="admin-action-button is-compact" type="button" data-master-user-action="close">
            Fechar
          </button>
        </header>
        <input type="hidden" name="id" value="${escapeHtml(user.id || "")}" />
        <input type="hidden" name="login" value="${escapeHtml(user.login || "")}" />
        <input type="hidden" name="restaurantKey" value="${escapeHtml(user.restaurantKey || "")}" />
        <div class="master-registration-form">
          <label>
            <span>Nome</span>
            <input class="admin-input" name="name" value="${escapeHtml(user.name || user.nome || "")}" required />
          </label>
          <label>
            <span>E-mail</span>
            <input class="admin-input" name="email" type="email" value="${escapeHtml(user.email || "")}" />
          </label>
          <label>
            <span>Telefone</span>
            <input class="admin-input" name="phone" inputmode="tel" value="${escapeHtml(user.phone || user.telefone || "")}" />
          </label>
          <label>
            <span>Perfil</span>
            <select class="admin-input" name="userType">
              ${getMasterUserTypeOptions()
                .map(
                  (option) => `
                    <option value="${escapeHtml(option.key)}" ${option.key === selectedType ? "selected" : ""}>
                      ${escapeHtml(option.label)}
                    </option>
                  `
                )
                .join("")}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select class="admin-input" name="status">
              <option value="ACTIVE" ${user.status === "ACTIVE" ? "selected" : ""}>Ativo</option>
              <option value="BLOCKED" ${user.status === "BLOCKED" ? "selected" : ""}>Bloqueado</option>
            </select>
          </label>
          <label class="master-registration-form-wide">
            <span>Nova senha</span>
            <input class="admin-input" name="password" type="password" autocomplete="new-password" placeholder="Preencha apenas para redefinir" />
          </label>
        </div>
        <div class="master-form-actions">
          <button class="admin-button admin-button-secondary" type="button" data-master-user-action="close">
            Cancelar
          </button>
          <button class="admin-button admin-button-primary" type="submit" ${state.isUserSubmitting ? "disabled" : ""}>
            ${state.isUserSubmitting ? "Salvando..." : "Salvar usuário"}
          </button>
        </div>
      </form>
    `;
  };

  const renderMasterUserField = ({
    label,
    name,
    type = "text",
    placeholder = "",
    required = false,
    autocomplete = "",
    inputmode = "",
    value = "",
    wide = false,
    minLength = "",
  }) => `
    <label class="${wide ? "master-onboarding-field is-wide" : "master-onboarding-field"}">
      <span>${escapeHtml(label)}${required ? " *" : ""}</span>
      <input
        class="admin-input"
        name="${escapeHtml(name)}"
        type="${escapeHtml(type)}"
        value="${escapeHtml(value)}"
        placeholder="${escapeHtml(placeholder)}"
        ${required ? "required" : ""}
        ${autocomplete ? `autocomplete="${escapeHtml(autocomplete)}"` : ""}
        ${inputmode ? `inputmode="${escapeHtml(inputmode)}"` : ""}
        ${minLength ? `minlength="${escapeHtml(minLength)}"` : ""}
        data-master-user-create-input
      />
      <small data-master-onboarding-validation="${escapeHtml(name)}"></small>
    </label>
  `;

  const renderMasterUserPreviewList = (entries = []) =>
    entries.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("");

  const renderMasterUserProfilePreview = (profile) => {
    const copy = getMasterUserProfileCopy(profile);

    return `
      <div class="master-user-permission-preview">
        <div>
          <strong>Esse usuário poderá:</strong>
          <ul data-master-user-profile-can>${renderMasterUserPreviewList(copy.can)}</ul>
        </div>
        <div>
          <strong>Esse usuário NÃO poderá:</strong>
          <ul data-master-user-profile-cannot>${renderMasterUserPreviewList(copy.cannot)}</ul>
        </div>
      </div>
    `;
  };

  const getMasterUserPermissionModules = () => {
    const modules = asArray(state.snapshot?.permissionModules).filter(
      (module) => module?.key && asArray(module.permissions).length
    );

    return modules.length ? modules : MASTER_USER_PERMISSION_FALLBACK_MODULES;
  };

  const renderMasterUserPermissionsGrid = () => `
    <div class="master-user-permissions-grid" data-master-user-permissions-grid>
      ${getMasterUserPermissionModules()
        .map(
          (module) => `
            <fieldset class="master-user-permission-module">
              <legend>${escapeHtml(module.label || module.key)}</legend>
              ${asArray(module.permissions)
                .map(
                  (permission) => `
                    <label class="master-onboarding-check">
                      <input
                        type="checkbox"
                        name="permission"
                        value="${escapeHtml(permission.permission)}"
                        data-master-user-create-input
                        disabled
                      />
                      <span>${escapeHtml(permission.label || permission.action || permission.permission)}</span>
                    </label>
                  `
                )
                .join("")}
            </fieldset>
          `
        )
        .join("")}
    </div>
  `;

  const renderMasterUserProfileCards = () => `
    <div class="master-user-profile-grid">
      ${getMasterUserTypeOptions()
        .map((option) => {
          const isDefault = option.key === "GERENTE";
          const disabledReason = option.disabled
            ? "Perfil único do sistema. Para esta versão, mantenha o MASTER existente."
            : option.helper;

          return `
            <label class="master-onboarding-radio-card master-user-profile-card ${option.disabled ? "is-disabled" : ""}">
              <input
                type="radio"
                name="userType"
                value="${escapeHtml(option.key)}"
                ${isDefault ? "checked" : ""}
                ${option.disabled ? "disabled" : ""}
                data-master-user-create-input
              />
              <span>
                <strong>${escapeHtml(option.label)}</strong>
                <small>${escapeHtml(disabledReason)}</small>
              </span>
            </label>
          `;
        })
        .join("")}
    </div>
  `;

  const renderMasterUserRestaurantOptions = () => {
    const restaurants = getRestaurantOptionsForUserForm();

    return restaurants
      .map(
        (restaurant, index) => `
          <option
            value="${escapeHtml(restaurant.key)}"
            ${index === 0 ? "selected" : ""}
          >
            ${escapeHtml(restaurant.label)}
          </option>
        `
      )
      .join("");
  };

  const renderMasterUserCreateForm = () => {
    const restaurants = getRestaurantOptionsForUserForm();
    const defaultRestaurant = restaurants[0]?.label || "Aguardando restaurante";

    return `
      <form class="master-panel master-user-create-page master-restaurant-onboarding" data-master-user-create-form novalidate>
        <header class="master-panel-head">
          <div>
            <span class="admin-chip">Usuários &gt; Novo usuário</span>
            <h2>Novo usuário</h2>
            <p>Cadastre um usuário para acessar o restaurante com perfil pronto ou permissões personalizadas.</p>
          </div>
          <button class="admin-action-button is-compact" type="button" data-master-user-action="close">
            Voltar
          </button>
        </header>
        <div class="admin-feedback" data-master-onboarding-feedback hidden></div>

        <div class="master-onboarding-layout">
          <div class="master-onboarding-sections">
            ${renderOnboardingAccordion({
              number: "1",
              title: "Dados Básicos",
              helper: "Identificação pessoal e contato principal.",
              open: true,
              body: `
                <div class="master-onboarding-grid">
                  ${renderMasterUserField({ label: "Nome", name: "firstName", required: true, placeholder: "Joao" })}
                  ${renderMasterUserField({ label: "Sobrenome", name: "lastName", placeholder: "Silva" })}
                  ${renderMasterUserField({ label: "CPF", name: "document", inputmode: "numeric", placeholder: "000.000.000-00" })}
                  ${renderMasterUserField({ label: "Telefone", name: "phone", inputmode: "tel", required: true, placeholder: "(11) 99999-9999" })}
                  ${renderMasterUserField({ label: "Email", name: "email", type: "email", required: true, placeholder: "joao@restaurante.com.br" })}
                  ${renderMasterUserField({ label: "Nascimento", name: "birthDate", type: "date" })}
                </div>
              `,
            })}

            ${renderOnboardingAccordion({
              number: "2",
              title: "Login",
              helper: "Credenciais iniciais e convite.",
              body: `
                <div class="master-onboarding-grid">
                  ${renderMasterUserField({ label: "Usuário", name: "login", placeholder: "joao.silva", autocomplete: "username" })}
                  ${renderMasterUserField({ label: "Senha", name: "password", type: "password", required: true, minLength: "6", autocomplete: "new-password" })}
                  ${renderMasterUserField({ label: "Confirmar senha", name: "passwordConfirm", type: "password", required: true, minLength: "6", autocomplete: "new-password" })}
                </div>
                <div class="master-onboarding-check-grid">
                  <label class="master-onboarding-check">
                    <input type="checkbox" name="forcePasswordChange" checked data-master-user-create-input />
                    <span>Primeiro acesso obriga alterar senha</span>
                  </label>
                  <label class="master-onboarding-check">
                    <input type="checkbox" name="sendInvite" data-master-user-create-input />
                    <span>Enviar convite por e-mail</span>
                  </label>
                </div>
                <p class="master-form-note">Convite e troca obrigatória ficam preparados para integração de e-mail e política de senha.</p>
              `,
            })}

            ${renderOnboardingAccordion({
              number: "3",
              title: "Restaurante",
              helper: "Escopo de acesso do usuário.",
              body: `
                <div class="master-onboarding-address-choice">
                  <label class="master-onboarding-radio-card">
                    <input type="radio" name="accessScope" value="restaurant" checked data-master-user-create-input />
                    <span>
                      <strong>Apenas um restaurante</strong>
                      <small>Usuário vinculado a uma unidade específica.</small>
                    </span>
                  </label>
                  <label class="master-onboarding-radio-card master-user-platform-scope">
                    <input type="radio" name="accessScope" value="all" data-master-user-create-input />
                    <span>
                      <strong>Todos os restaurantes</strong>
                      <small>Disponível apenas para escopo MASTER da plataforma.</small>
                    </span>
                  </label>
                </div>
                <label class="master-onboarding-field is-wide" data-master-user-restaurant-field>
                  <span>Selecionar restaurante</span>
                  <select class="admin-input" name="restaurantKey" data-master-user-create-input ${restaurants.length ? "" : "disabled"}>
                    ${renderMasterUserRestaurantOptions()}
                  </select>
                  <small data-master-onboarding-validation="restaurantKey"></small>
                </label>
                <p class="master-form-note" data-master-user-platform-note hidden>
                  O Painel Master preserva um único usuário MASTER ativo. Para outros perfis de plataforma, use a hierarquia técnica atual.
                </p>
              `,
            })}

            ${renderOnboardingAccordion({
              number: "4",
              title: "Cargo",
              helper: "Perfil pronto aplica permissões automáticas.",
              body: `
                ${renderMasterUserProfileCards()}
                ${renderMasterUserProfilePreview("GERENTE")}
              `,
            })}

            ${renderOnboardingAccordion({
              number: "5",
              title: "Permissões Avançadas",
              helper: "Fechado por padrão. Use apenas quando o perfil pronto não atender.",
              body: `
                <label class="master-onboarding-check master-user-customize-toggle">
                  <input type="checkbox" name="customizePermissions" data-master-user-create-input />
                  <span>Personalizar permissões</span>
                </label>
                <p class="master-form-note" data-master-user-permission-note>
                  Perfil pronto usa permissões automáticas. Marcar personalização muda o cargo para Personalizado e libera os detalhes.
                </p>
                ${renderMasterUserPermissionsGrid()}
              `,
            })}

            ${renderOnboardingAccordion({
              number: "6",
              title: "Segurança",
              helper: "Status inicial e controles futuros.",
              body: `
                <div class="master-onboarding-check-grid">
                  <label class="master-onboarding-check">
                    <input type="checkbox" name="active" checked data-master-user-create-input />
                    <span>Usuário ativo</span>
                  </label>
                  <label class="master-onboarding-check">
                    <input type="checkbox" name="blocked" data-master-user-create-input />
                    <span>Bloquear acesso</span>
                  </label>
                  <label class="master-onboarding-check is-disabled">
                    <input type="checkbox" name="twoFactor" disabled />
                    <span>2FA</span>
                  </label>
                  <label class="master-onboarding-check is-disabled">
                    <input type="checkbox" name="restrictIp" disabled />
                    <span>Restringir IP</span>
                  </label>
                </div>
                <div class="master-onboarding-grid">
                  <label class="master-onboarding-field">
                    <span>Expiração da senha</span>
                    <select class="admin-input" name="passwordExpiration" disabled>
                      <option>Sem expiração definida</option>
                    </select>
                    <small>Preparado para política futura.</small>
                  </label>
                </div>
              `,
            })}

            <div class="master-onboarding-actions">
              <button class="admin-button admin-button-secondary" type="button" data-master-user-action="close">
                Cancelar
              </button>
              <button class="admin-button admin-button-primary" type="submit" ${state.isUserSubmitting ? "disabled" : ""}>
                ${state.isUserSubmitting ? "Salvando..." : "Salvar usuário"}
              </button>
            </div>
          </div>

          <aside class="master-onboarding-summary">
            <h3>Resumo</h3>
            <dl>
              <div>
                <dt>Nome</dt>
                <dd data-master-user-summary="name">Aguardando nome</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd data-master-user-summary="email">Aguardando email</dd>
              </div>
              <div>
                <dt>Restaurante</dt>
                <dd data-master-user-summary="restaurant">${escapeHtml(defaultRestaurant)}</dd>
              </div>
              <div>
                <dt>Perfil</dt>
                <dd data-master-user-summary="profile">GERENTE</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd data-master-user-summary="status">Ativo</dd>
              </div>
            </dl>
            <div class="master-onboarding-summary-note">
              Perfil pronto aplica permissões automáticas. Personalizado libera as permissões detalhadas.
            </div>
          </aside>
        </div>
      </form>
    `;
  };

  const renderRestaurantRegistrationForm = () => {
    const today = new Date().toISOString().slice(0, 10);
    const planOptions = getPlanOptions();
    const selectedPlan = planOptions.some((plan) => plan.key === "BUSINESS")
      ? "BUSINESS"
      : planOptions[0]?.key || "START";
    const defaultResources = new Set(["delivery", "pickup", "whatsapp"]);

    return `
      <form class="master-panel master-user-drawer master-restaurant-onboarding" data-master-restaurant-form novalidate>
        <header class="master-panel-head">
          <div>
            <span class="admin-chip">Novo cadastro</span>
            <h2>Cadastro de Restaurante</h2>
            <p>Fluxo limpo para cadastrar o restaurante, preparar o cardapio online e criar o OWNER inicial.</p>
          </div>
          <button class="admin-action-button is-compact" type="button" data-master-user-action="close">
            Fechar
          </button>
        </header>
        <div class="admin-feedback" data-master-onboarding-feedback hidden></div>

        <div class="master-onboarding-layout">
          <div class="master-onboarding-sections">
            ${renderOnboardingAccordion({
              number: "1",
              title: "Dados Básicos",
              helper: "Identificacao comercial e contato principal.",
              open: true,
              body: `
                <div class="master-onboarding-grid">
                  ${renderOnboardingField({ label: "Nome Fantasia", name: "tradeName", required: true, placeholder: "Tokyo Sushi Delivery" })}
                  ${renderOnboardingField({ label: "Razao Social", name: "companyName", placeholder: "Tokyo Sushi Delivery LTDA" })}
                  ${renderOnboardingField({ label: "CNPJ", name: "document", inputmode: "numeric", required: true, placeholder: "00.000.000/0001-00" })}
                  ${renderOnboardingField({ label: "Inscricao Estadual", name: "stateRegistration", placeholder: "Isento" })}
                  ${renderOnboardingField({ label: "Responsavel", name: "responsible", required: true, placeholder: "Paulo Novais" })}
                  ${renderOnboardingField({ label: "Email", name: "email", type: "email", required: true, placeholder: "contato@restaurante.com.br" })}
                  ${renderOnboardingField({ label: "Telefone", name: "phone", inputmode: "tel", required: true, placeholder: "(11) 4002-8922" })}
                  ${renderOnboardingField({ label: "WhatsApp", name: "whatsapp", inputmode: "tel", placeholder: "(11) 99999-9999" })}
                </div>
              `,
            })}

            ${renderOnboardingAccordion({
              number: "2",
              title: "Endereco do Restaurante",
              helper: "Localizacao fisica do cliente.",
              body: `
                <div class="master-onboarding-grid">
                  ${renderOnboardingField({ label: "CEP", name: "postalCode", inputmode: "numeric", required: true, placeholder: "00000-000" })}
                  ${renderOnboardingField({ label: "Rua", name: "street", required: true, placeholder: "Rua das Flores" })}
                  ${renderOnboardingField({ label: "Numero", name: "establishmentNumber", required: true, placeholder: "120" })}
                  ${renderOnboardingField({ label: "Bairro", name: "neighborhood", required: true, placeholder: "Centro" })}
                  ${renderOnboardingField({ label: "Cidade", name: "city", required: true, placeholder: "Sao Paulo" })}
                  ${renderOnboardingField({ label: "Estado", name: "state", required: true, placeholder: "SP" })}
                </div>
              `,
            })}

            ${renderOnboardingAccordion({
              number: "3",
              title: "Endereco do Cardapio",
              helper: "Escolha apenas uma opcao publica para o restaurante.",
              body: `
                <div class="master-onboarding-address-choice">
                  <label class="master-onboarding-radio-card">
                    <input type="radio" name="menuAddressType" value="inovas" checked data-master-onboarding-input />
                    <span>
                      <strong>Endereco INOVAS</strong>
                      <small>Incluso no plano</small>
                    </span>
                  </label>
                  <label class="master-onboarding-radio-card">
                    <input type="radio" name="menuAddressType" value="custom" data-master-onboarding-input />
                    <span>
                      <strong>Dominio Proprio</strong>
                      <small>Opcional</small>
                    </span>
                  </label>
                </div>

                <div class="master-onboarding-url-row">
                  ${renderOnboardingField({ label: "Slug", name: "slug", required: true, placeholder: "tokyosushidelivery", wide: true })}
                  <span class="master-onboarding-pill" data-master-onboarding-slug-status>Informe um slug</span>
                </div>
                <div class="master-onboarding-preview-line">
                  <span>Seu restaurante ficará disponível em:</span>
                  <strong data-master-onboarding-menu-url>${ONBOARDING_INTERNAL_BASE_URL}/restaurante</strong>
                </div>

                <div class="master-onboarding-domain-fields" data-master-onboarding-custom-domain hidden>
                  ${renderOnboardingField({ label: "Domínio desejado", name: "domain", placeholder: "www.tokyosushidelivery.com.br", wide: true })}
                  <span class="master-onboarding-pill" data-master-onboarding-domain-status>Opcional</span>
                  <div class="master-onboarding-domain-status">
                    <strong>Domínio solicitado</strong>
                    <span>Aguardando verificação</span>
                  </div>
                  <p>A disponibilidade do domínio será verificada pela equipe INOVAS após o cadastro. O domínio possui custo de registro e renovação. Mesmo utilizando domínio próprio, o endereço interno do INOVAS continuará funcionando.</p>
                </div>
              `,
            })}

            ${renderOnboardingAccordion({
              number: "4",
              title: "Plano",
              helper: "Plano comercial inicial.",
              body: `
                <div class="master-plan-options">
                  ${planOptions
                    .map(
                      (plan) => `
                        <label class="master-plan-option">
                          <input
                            type="radio"
                            name="plan"
                            value="${escapeHtml(plan.key)}"
                            ${plan.key === selectedPlan ? "checked" : ""}
                            data-master-onboarding-input
                          />
                          <span>
                            <strong>${escapeHtml(plan.label)}</strong>
                            <small>${escapeHtml(plan.description)}</small>
                          </span>
                        </label>
                      `
                    )
                    .join("")}
                </div>
              `,
            })}

            ${renderOnboardingAccordion({
              number: "5",
              title: "Recursos",
              helper: "Recursos liberados para a operacao inicial.",
              body: `
                <div class="master-onboarding-check-grid">
                  ${ONBOARDING_RESOURCE_OPTIONS
                    .map(
                      (option) => `
                        <label class="master-onboarding-check">
                          <input
                            type="checkbox"
                            name="features"
                            value="${escapeHtml(option.key)}"
                            ${defaultResources.has(option.key) ? "checked" : ""}
                            data-master-onboarding-input
                          />
                          <span>${escapeHtml(option.label)}</span>
                        </label>
                      `
                    )
                    .join("")}
                </div>
              `,
            })}

            ${renderOnboardingAccordion({
              number: "6",
              title: "Usuários",
              helper: "Criacao do proprietario do restaurante.",
              body: `
                <div class="master-onboarding-grid">
                  ${renderOnboardingField({ label: "Nome", name: "ownerName", required: true, placeholder: "Paulo Novais" })}
                  ${renderOnboardingField({ label: "Email", name: "ownerEmail", type: "email", required: true, placeholder: "paulo@restaurante.com.br" })}
                  ${renderOnboardingField({ label: "Senha", name: "ownerPassword", type: "password", autocomplete: "new-password", required: true, minLength: "6" })}
                  ${renderOnboardingField({ label: "Confirmar senha", name: "ownerPasswordConfirm", type: "password", autocomplete: "new-password", required: true, minLength: "6" })}
                  ${renderOnboardingField({ label: "Cargo", name: "ownerRole", value: "Proprietario", wide: true })}
                </div>
              `,
            })}

            ${renderOnboardingAccordion({
              number: "7",
              title: "Aparencia",
              helper: "Primeira camada visual do cardapio.",
              body: `
                <div class="master-onboarding-grid">
                  ${renderOnboardingField({ label: "Logo", name: "logoUrl", type: "url", placeholder: "/assets/logo-restaurante.png" })}
                  ${renderOnboardingField({ label: "Banner", name: "bannerUrl", type: "url", placeholder: "/assets/banner-restaurante.jpg" })}
                  <label class="master-onboarding-field">
                    <span>Cor Primaria</span>
                    <input class="admin-input master-color-input" name="primaryColor" type="color" value="#ff5a00" data-master-onboarding-input />
                  </label>
                  <label class="master-onboarding-field">
                    <span>Cor Secundaria</span>
                    <input class="admin-input master-color-input" name="secondaryColor" type="color" value="#111827" data-master-onboarding-input />
                  </label>
                </div>
                <div class="master-brand-preview">
                  <span class="master-brand-preview-logo" data-master-onboarding-brand-mark>IF</span>
                  <div>
                    <strong data-master-onboarding-brand-name>Nome do restaurante</strong>
                    <small data-master-onboarding-brand-url>${ONBOARDING_INTERNAL_BASE_URL}/restaurante</small>
                  </div>
                </div>
              `,
            })}

            ${renderOnboardingAccordion({
              number: "8",
              title: "Configuracoes Avancadas",
              helper: "Itens tecnicos mantidos fora do caminho principal.",
              body: `
                <div class="master-onboarding-grid">
                  <label class="master-onboarding-field">
                    <span>Status inicial</span>
                    <select class="admin-input" name="subscriptionStatus" data-master-onboarding-input>
                      <option value="TRIAL" selected>Trial</option>
                      <option value="ACTIVE">Ativo</option>
                      <option value="BLOCKED">Bloqueado</option>
                    </select>
                  </label>
                  ${renderOnboardingField({ label: "Data de adesao", name: "adhesionDate", type: "date", value: today, required: true })}
                  ${renderOnboardingField({ label: "Raio de entrega (km)", name: "deliveryRadiusKm", type: "number", value: "5" })}
                  ${renderOnboardingField({ label: "Taxa fixa de entrega", name: "deliveryFee", type: "number", value: "0" })}
                  ${renderOnboardingField({ label: "Pedido minimo", name: "minimumOrder", type: "number", value: "0" })}
                  ${renderOnboardingField({ label: "Horario comercial", name: "businessHours", placeholder: "Seg a Sab, 18h as 23h" })}
                  ${renderOnboardingField({ label: "Observacoes internas", name: "notes", wide: true })}
                </div>
              `,
            })}

            <div class="master-onboarding-actions">
              <button class="admin-button admin-button-secondary" type="button" data-master-user-action="close">
                Cancelar
              </button>
              <button class="admin-button admin-button-primary" type="submit" ${state.isUserSubmitting ? "disabled" : ""}>
                ${state.isUserSubmitting ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>

          <aside class="master-onboarding-summary" aria-label="Resumo do cadastro">
            <span class="admin-chip">Resumo</span>
            <h3>Conferencia</h3>
            <dl>
              <div>
                <dt>Restaurante</dt>
                <dd data-master-onboarding-summary="restaurant">Aguardando nome</dd>
              </div>
              <div>
                <dt>Plano</dt>
                <dd data-master-onboarding-summary="plan">${escapeHtml(selectedPlan)}</dd>
              </div>
              <div>
                <dt>Endereco</dt>
                <dd data-master-onboarding-summary="address">${ONBOARDING_INTERNAL_BASE_URL}/restaurante</dd>
              </div>
              <div>
                <dt>Responsavel</dt>
                <dd data-master-onboarding-summary="responsible">Aguardando responsavel</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd data-master-onboarding-summary="status">Cadastro em andamento</dd>
              </div>
            </dl>
            <div class="master-onboarding-summary-note">
              Apos salvar, o OWNER inicial sera criado junto com o restaurante.
            </div>
          </aside>
        </div>
      </form>
    `;
  };

  const renderMasterUsersSidePanel = () => {
    const selectedUser = getMasterUserById(state.selectedUserId);

    if (state.userMode === "new-restaurant") {
      return renderRestaurantRegistrationForm();
    }

    if (state.userMode === "edit-user") {
      return renderMasterUserEditForm(selectedUser);
    }

    if (state.userMode === "view-user") {
      return renderMasterUserDetails(selectedUser);
    }

    return "";
  };

  const renderMasterUserKpis = () => {
    const stats = getMasterUserStats();
    const cards = [
      { key: "total", label: "Total de usuários", value: stats.total, helper: "Todos os usuários" },
      { key: "active", label: "Ativos", value: stats.active, helper: "Usuários ativos" },
      { key: "inactive", label: "Inativos", value: stats.inactive, helper: "Usuários inativos" },
      { key: "blocked", label: "Bloqueados", value: stats.blocked, helper: "Usuários bloqueados" },
    ];

    return `
      <section class="master-users-summary-grid">
        ${cards
          .map(
            (card) => `
              <article class="master-user-summary-card" data-card="${escapeHtml(card.key)}">
                <span class="master-user-summary-icon">${escapeHtml(card.label.charAt(0))}</span>
                <div>
                  <small>${escapeHtml(card.label)}</small>
                  <strong>${escapeHtml(formatNumber(card.value))}</strong>
                  <em>${escapeHtml(card.helper)}</em>
                </div>
              </article>
            `
          )
          .join("")}
      </section>
    `;
  };

  const renderMasterUserFilters = () => {
    const filters = state.userFilters || {};
    const restaurants = getRestaurantOptionsForUserForm();
    const profiles = getMasterUserTypeOptions().filter((option) => option.key !== "MASTER" || getMasterUsers().some((user) => String(user.userType || user.tipo_usuario || "").toUpperCase() === "MASTER"));

    return `
      <section class="master-users-filter-card">
        <label>
          <span>Buscar</span>
          <input
            class="admin-input"
            type="search"
            value="${escapeHtml(state.userSearch)}"
            placeholder="ID, nome, e-mail ou telefone..."
            data-master-user-filter="search"
          />
        </label>
        <label>
          <span>Restaurante</span>
          <select class="admin-input" data-master-user-filter="restaurant">
            <option value="">Todos</option>
            <option value="platform" ${filters.restaurant === "platform" ? "selected" : ""}>Plataforma INOVAS Food</option>
            ${restaurants
              .map(
                (restaurant) => `
                  <option value="${escapeHtml(restaurant.key)}" ${filters.restaurant === restaurant.key ? "selected" : ""}>
                    ${escapeHtml(restaurant.label)}
                  </option>
                `
              )
              .join("")}
          </select>
        </label>
        <label>
          <span>Perfil</span>
          <select class="admin-input" data-master-user-filter="profile">
            <option value="">Todos</option>
            ${profiles
              .map(
                (profile) => `
                  <option value="${escapeHtml(profile.key)}" ${filters.profile === profile.key ? "selected" : ""}>
                    ${escapeHtml(profile.label)}
                  </option>
                `
              )
              .join("")}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select class="admin-input" data-master-user-filter="status">
            <option value="">Todos</option>
            <option value="ACTIVE" ${filters.status === "ACTIVE" ? "selected" : ""}>Ativo</option>
            <option value="INACTIVE" ${filters.status === "INACTIVE" ? "selected" : ""}>Inativo</option>
            <option value="BLOCKED" ${filters.status === "BLOCKED" ? "selected" : ""}>Bloqueado</option>
          </select>
        </label>
        <button class="admin-button admin-button-secondary" type="button" data-master-user-action="clear-filters">
          Limpar filtros
        </button>
      </section>
    `;
  };

  const renderUsers = () => {
    const totalUsers = getMasterUsers().length;
    const visibleUsers = getFilteredMasterUsers().length;

    if (state.userMode === "new-user") {
      return renderMasterUserCreateForm();
    }

    return `
      <section class="master-users-page">
        <header class="master-users-page-head">
          <div>
            <h2>Usuários</h2>
            <p>Gerencie os usuários e permissões do sistema por restaurante.</p>
          </div>
          <button class="admin-button admin-button-primary" type="button" data-master-user-action="new-user">
            + Novo usuário
          </button>
        </header>
        ${renderFeedback()}
        ${renderMasterUserKpis()}
        ${renderMasterUserFilters()}
        ${renderMasterUsersTable()}
        <div class="admin-empty-state admin-empty-state-soft master-user-filter-empty" data-master-user-empty-filter ${visibleUsers > 0 || !hasActiveMasterUserFilters() ? "hidden" : ""}>
          <strong>Nenhum usuário encontrado</strong>
          <span>Revise o ID, nome, restaurante, e-mail, telefone ou CNPJ/MEI pesquisado.</span>
        </div>
        <p class="master-users-result-note">${escapeHtml(String(visibleUsers))} de ${escapeHtml(String(totalUsers))} usuários exibidos.</p>
      </section>
      ${renderMasterUsersSidePanel()}
    `;
  };

  const renderPlans = () => {
    const plans = asArray(state.snapshot?.platformPlans || state.snapshot?.plans);
    const rows = plans.map(
      (plan) => `
        <tr>
          <td>
            <strong>${escapeHtml(plan.displayName || plan.name)}</strong>
            <small>${escapeHtml(plan.key)}</small>
          </td>
          <td>${escapeHtml(formatCurrency(plan.monthlyValue || plan.valor_mensal))}</td>
          <td>${escapeHtml(plan.description)}</td>
          <td>
            <div class="master-token-list">
              ${asArray(plan.recursos_inclusos || plan.includedFeatures || plan.features)
                .slice(0, 8)
                .map((feature) => `<em>${escapeHtml(feature)}</em>`)
                .join("")}
            </div>
          </td>
          <td>${renderStatus(plan.status)}</td>
          <td><span class="master-status">${escapeHtml(plan.color || "#FF6A00")}</span></td>
          <td>${escapeHtml(String(plan.order || "--"))}</td>
          <td>${escapeHtml(plan.featured ? "Sim" : "Nao")}</td>
          <td>
            <div class="master-row-actions">
              ${renderActionButton("Editar", "plan-edit", plan.key)}
              ${renderActionButton("Duplicar", "plan-duplicate", plan.key)}
            </div>
          </td>
        </tr>
      `
    );

    return `
      <article class="master-panel">
        <header class="master-panel-head">
          <div>
            <h2>Gestao dos Planos</h2>
            <p>Planos oficiais V1.3: Essencial, Profissional e Enterprise. Pagamento real nao integrado.</p>
          </div>
          ${renderActionButton("Novo plano", "plan-create")}
        </header>
        ${renderTable(
          ["Nome", "Valor", "Descricao", "Funcionalidades", "Status", "Cor", "Ordem", "Destaque", "Acoes"],
          rows,
          "Nenhum plano cadastrado."
        )}
      </article>
    `;
  };

  // ---------------------------------------------------------------------------
  // Platform commercial modules
  // ---------------------------------------------------------------------------

  const renderResources = () => {
    const rows = asArray(state.snapshot?.resources || state.snapshot?.commercialFeatures).map(
      (resource) => `
        <tr>
          <td>
            <strong>${escapeHtml(resource.label || resource.name || resource.key)}</strong>
            <small>${escapeHtml(resource.key)}</small>
          </td>
          <td>${renderStatus(resource.status || (resource.future ? "FUTURE" : "ACTIVE"))}</td>
          <td>${escapeHtml(resource.future || resource.isFuture ? "Futuro" : "Ativo")}</td>
          <td>${escapeHtml(resource.defaultEnabled ? "Liberavel" : "Desativado por padrao")}</td>
          <td>${escapeHtml(resource.description || "--")}</td>
        </tr>
      `
    );

    return `
      <article class="master-panel">
        <h2>Recursos</h2>
        ${renderTable(
          ["Recurso", "Status", "Tipo", "Padrao", "Descricao"],
          rows,
          "Nenhum recurso cadastrado."
        )}
      </article>
    `;
  };

  const renderDomains = () => {
    const rows = asArray(state.snapshot?.domains).map(
      (domain) => `
        <tr>
          <td>
            <strong>${escapeHtml(domain.customDomain || domain.primaryDomain || domain.domain)}</strong>
            <small>${escapeHtml(domain.customDomain ? `Principal: ${domain.primaryDomain}` : "Dominio principal")}</small>
          </td>
          <td>${escapeHtml(domain.restaurantName)}</td>
          <td>${renderStatus(domain.statusLabel || domain.status)}</td>
          <td>${renderStatus(domain.sslStatusLabel || domain.sslStatus || domain.ssl)}</td>
          <td>${escapeHtml(domain.observations || domain.notes)}</td>
        </tr>
      `
    );
    const resolver = state.snapshot?.domainResolver || {};

    return `
      <article class="master-panel">
        <h2>Dominios</h2>
        ${renderTable(
          ["Dominio", "Restaurante", "Status", "SSL", "Observacoes"],
          rows,
          "Nenhum dominio cadastrado."
        )}
      </article>
      <article class="master-panel">
        <h2>Resolver de Host</h2>
        ${renderFieldGrid([
          { label: "Modo atual", value: resolver.activeMode || "default_only" },
          { label: "Fallback", value: resolver.fallbackRestaurantKey || "default" },
          { label: "DNS real", value: resolver.dnsIntegrated ? "Integrado" : "Nao integrado" },
          { label: "SSL real", value: resolver.sslIntegrated ? "Integrado" : "Nao integrado" },
          {
            label: "Amostra",
            value: `${resolver.sampleHost || "--"} -> ${resolver.sampleResolution?.restaurantKey || "default"}`,
          },
        ])}
      </article>
    `;
  };

  const renderSubscriptions = () => {
    const rows = asArray(state.snapshot?.contracts || state.snapshot?.subscriptions).map(
      (subscription) => `
        <tr>
          <td>${escapeHtml(subscription.restaurantName)}</td>
          <td>${escapeHtml(subscription.plan)}</td>
          <td>${renderStatus(subscription.contractStatus || subscription.status)}</td>
          <td>${escapeHtml(subscription.nextBillingAt || subscription.dueDate || subscription.data_vencimento || `Dia ${subscription.dueDay || subscription.dia_vencimento || "--"}`)}</td>
          <td>${escapeHtml(subscription.paymentMethod || "Nao integrado")}</td>
          <td>${escapeHtml(subscription.history || "Preparado para integracao futura")}</td>
          <td>${renderStatus(subscription.status)}</td>
          <td>
            <div class="master-token-list">
              ${asArray(subscription.releasedFeatures || subscription.recursos_liberados)
                .slice(0, 8)
                .map((feature) => `<em>${escapeHtml(feature)}</em>`)
                .join("")}
            </div>
          </td>
          <td>${escapeHtml(subscription.notes || subscription.observations)}</td>
        </tr>
      `
    );

    return `
      <article class="master-panel">
        <h2>Assinaturas / Contratos</h2>
        ${renderTable(
          [
            "Restaurante",
            "Plano",
            "Situacao",
            "Proximo Vencimento",
            "Forma Pagamento",
            "Historico",
            "Status",
            "Recursos liberados",
            "Observacoes",
          ],
          rows,
          "Nenhum contrato cadastrado."
        )}
      </article>
    `;
  };

  const renderSellers = () => {
    const rows = asArray(state.snapshot?.sellers).map(
      (seller) => `
        <tr>
          <td>
            <strong>${escapeHtml(seller.name)}</strong>
            <small>${escapeHtml(seller.id)}</small>
          </td>
          <td>${escapeHtml(seller.phone || "--")}</td>
          <td>${escapeHtml(seller.email || "--")}</td>
          <td>${escapeHtml(formatNumber(seller.clients))}</td>
          <td>${escapeHtml(formatNumber(seller.restaurants))}</td>
          <td>${escapeHtml(String(seller.commissionRate || "Preparado"))}</td>
          <td>${renderStatus(seller.status)}</td>
          <td>
            <div class="master-row-actions">
              ${renderActionButton("Cadastrar", "seller-create", seller.id)}
              ${renderActionButton("Editar", "seller-edit", seller.id)}
              ${renderActionButton("Bloquear", "seller-block", seller.id)}
              ${renderDangerActionButton("Excluir", "seller-delete", seller.id)}
              ${renderActionButton("Ver Clientes", "seller-customers", seller.id)}
              ${renderActionButton("Ver Restaurantes", "seller-restaurants", seller.id)}
            </div>
          </td>
        </tr>
      `
    );

    return `
      <article class="master-panel">
        <header class="master-panel-head">
          <div>
            <h2>Vendedores</h2>
            <p>Carteira comercial vinculada por seller_id, sem calculo automatico de comissao nesta versao.</p>
          </div>
          ${renderActionButton("Cadastrar vendedor", "seller-create")}
        </header>
        ${renderTable(
          ["Nome", "Telefone", "Email", "Clientes", "Restaurantes", "Comissao", "Status", "Acoes"],
          rows,
          "Nenhum vendedor cadastrado."
        )}
      </article>
    `;
  };

  const renderCommissions = () => {
    const rows = asArray(state.snapshot?.commissions).map(
      (commission) => `
        <tr>
          <td>${escapeHtml(commission.restaurantName || "--")}</td>
          <td>${escapeHtml(commission.plan || "--")}</td>
          <td>${escapeHtml(formatCurrency(commission.monthlyValue))}</td>
          <td>${escapeHtml(commission.sellerName || "--")}</td>
          <td>${escapeHtml(commission.percentage || "A definir")}</td>
          <td>${escapeHtml(String(commission.value || "A calcular"))}</td>
          <td>${renderStatus(commission.status)}</td>
        </tr>
      `
    );

    return `
      <article class="master-panel">
        <h2>Comissao</h2>
        <p>Estrutura preparada para comissao futura. Nenhum valor e calculado automaticamente nesta versao.</p>
        ${renderTable(
          ["Restaurante", "Plano", "Mensalidade", "Vendedor", "Percentual", "Valor", "Status"],
          rows,
          "Nenhuma comissao preparada."
        )}
      </article>
    `;
  };

  const renderContracts = () => {
    const rows = asArray(state.snapshot?.platformContracts).map(
      (contract) => `
        <tr>
          <td>${escapeHtml(contract.contract)}</td>
          <td>${escapeHtml(contract.plan)}</td>
          <td>${escapeHtml(contract.restaurantName)}</td>
          <td>${renderStatus(contract.status)}</td>
          <td>${escapeHtml(contract.signedLabel || (contract.signed ? "Sim" : "Nao"))}</td>
          <td>${escapeHtml(formatDateTime(contract.date))}</td>
          <td>${escapeHtml(contract.download || "Preparado")}</td>
        </tr>
      `
    );

    return `
      <article class="master-panel">
        <h2>Contratos</h2>
        <p>Modulo preparado para assinatura e download futuro. Sem integracao externa nesta etapa.</p>
        ${renderTable(["Contrato", "Plano", "Restaurante", "Status", "Assinado", "Data", "Download"], rows, "Nenhum contrato preparado.")}
      </article>
    `;
  };

  const renderFinance = () => {
    const finance = state.snapshot?.financeDashboard || {};
    const renderBreakdown = (title, values = {}) => `
      <article class="master-panel">
        <h2>${escapeHtml(title)}</h2>
        <div class="master-list">
          ${Object.entries(values)
            .map(
              ([key, value]) => `
                <div class="master-list-row">
                  <strong>${escapeHtml(key)}</strong>
                  <span>${escapeHtml(formatCurrency(value))}</span>
                </div>
              `
            )
            .join("") || "<div class=\"master-list-row\"><strong>Sem dados</strong><span>R$ 0,00</span></div>"}
        </div>
      </article>
    `;

    return `
      <div class="master-panel-grid">
        <article class="master-panel">
          <h2>Dashboard Financeiro</h2>
          ${renderFieldGrid([
            { label: "MRR", value: formatCurrency(finance.mrr) },
            { label: "Receita Mensal", value: formatCurrency(finance.monthlyRevenue) },
            { label: "Receita Anual", value: formatCurrency(finance.annualRevenue) },
            { label: "Clientes Pagantes", value: formatNumber(finance.payingCustomers) },
            { label: "Inadimplentes", value: formatNumber(finance.overdueCustomers) },
            { label: "Ticket Medio", value: formatCurrency(finance.averageTicket) },
          ])}
        </article>
        ${renderBreakdown("Receita por Plano", finance.revenueByPlan)}
      </div>
      <div class="master-panel-grid">
        ${renderBreakdown("Receita por Cidade", finance.revenueByCity)}
        ${renderBreakdown("Receita por Estado", finance.revenueByState)}
      </div>
    `;
  };

  const renderCommercial = () => {
    const commercial = state.snapshot?.commercialDashboard || {};

    return `
      <div class="master-panel-grid">
        <article class="master-panel">
          <h2>Dashboard Comercial</h2>
          ${renderFieldGrid([
            { label: "Leads", value: formatNumber(commercial.leads) },
            { label: "Novos Clientes", value: formatNumber(commercial.newCustomers) },
            { label: "Conversao", value: formatPercent(commercial.conversionRate) },
            { label: "Restaurantes", value: formatNumber(commercial.restaurants) },
            { label: "Vendedores", value: formatNumber(commercial.sellers) },
            { label: "Vendedores Ativos", value: formatNumber(commercial.activeSellers) },
          ])}
        </article>
        <article class="master-panel">
          <h2>Melhores vendedores</h2>
          <div class="master-list">
            ${asArray(commercial.topSellers)
              .map(
                (seller) => `
                  <div class="master-list-row">
                    <strong>${escapeHtml(seller.name)}</strong>
                    <span>${escapeHtml(formatNumber(seller.restaurants))} restaurantes</span>
                  </div>
                `
              )
              .join("") || "<div class=\"master-list-row\"><strong>Sem vendedores</strong><span>0 restaurantes</span></div>"}
          </div>
        </article>
      </div>
    `;
  };

  const renderReports = () => `
    <article class="master-panel">
      <h2>Relatorios Gerais</h2>
      ${renderFieldGrid([
        { label: "Preparado", value: state.snapshot?.reports?.prepared ? "Sim" : "Nao" },
        { label: "Escopo atual", value: "Global Plataforma" },
        { label: "Consolidacao", value: "Futura carteira INOVAS Food" },
      ])}
    </article>
  `;

  const renderEvents = (key) => {
    const rows = asArray(state.snapshot?.[key]).map(
      (event) => `
        <tr>
          <td>${escapeHtml(event.actorName || event.actorLogin || "--")}</td>
          <td>${escapeHtml(formatDateTime(event.changedAt))}</td>
          <td>${escapeHtml(event.actionType || "--")}</td>
          <td>${escapeHtml(event.metadata?.ip || "--")}</td>
          <td>${escapeHtml(event.metadata?.restaurantKey || event.target || "--")}</td>
          <td>${escapeHtml(event.origin || "platform")}</td>
          <td>${escapeHtml(key === "audit" ? JSON.stringify(event.metadata?.before || {}) : "--")}</td>
          <td>${escapeHtml(key === "audit" ? JSON.stringify(event.metadata?.after || event.metadata || {}) : "--")}</td>
        </tr>
      `
    );

    return `
      <article class="master-panel">
        <h2>${key === "logs" ? "Logs" : "Auditoria"}</h2>
        <div class="master-registration-form">
          <label>
            <span>Usuário</span>
            <input class="admin-input" placeholder="Filtro preparado" disabled />
          </label>
          <label>
            <span>Restaurante/Sistema</span>
            <input class="admin-input" placeholder="Filtro preparado" disabled />
          </label>
        </div>
        ${renderTable(
          ["Usuário", "Data", "Ação", "IP", "Restaurante", "Sistema", "Antes", "Depois"],
          rows,
          "Sem registros novos."
        )}
      </article>
    `;
  };

  // ---------------------------------------------------------------------------
  // Logs, audit, developer diagnostics and settings
  // ---------------------------------------------------------------------------

  const renderDeveloper = () => {
    const developer = state.snapshot?.developer || {};
    const diagnostics = asArray(developer.diagnostics);
    const modules = asArray(developer.moduleStatuses);
    const integrations = asArray(developer.integrations);
    const flags = developer.featureFlags || {};

    return `
      <div class="master-panel-grid">
        <article class="master-panel">
          <h2>Diagnostico</h2>
          <div class="master-list">
            ${diagnostics
              .map(
                (entry) => `
                  <div class="master-list-row">
                    <strong>${escapeHtml(entry.label)}</strong>
                    <span>${escapeHtml(entry.value)}</span>
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
        <article class="master-panel">
          <h2>Validacoes</h2>
          <div class="master-list">
            ${asArray(developer.validations)
              .map(
                (validation) => `
                  <div class="master-list-row">
                    <strong>${escapeHtml(validation)}</strong>
                    ${renderStatus("AVAILABLE")}
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
      </div>
      <div class="master-panel-grid">
        <article class="master-panel">
          <h2>Status dos Modulos</h2>
          <div class="master-list">
            ${modules
              .map(
                (module) => `
                  <div class="master-list-row">
                    <strong>${escapeHtml(module.label)}</strong>
                    ${renderStatus(module.status)}
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
        <article class="master-panel">
          <h2>Integracoes</h2>
          <div class="master-list">
            ${integrations
              .map(
                (integration) => `
                  <div class="master-list-row">
                    <strong>${escapeHtml(integration.label)}</strong>
                    ${renderStatus(integration.status)}
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
      </div>
      <article class="master-panel">
        <h2>Feature Flags</h2>
        <div class="master-token-list">
          ${Object.entries(flags)
            .map(([key, enabled]) => `<em>${escapeHtml(key)}: ${enabled ? "ON" : "OFF"}</em>`)
            .join("")}
        </div>
      </article>
    `;
  };

  const renderSettings = () => {
    const settings = state.snapshot?.settings || {};

    return `
      <article class="master-panel">
        <h2>Configuracoes da Plataforma</h2>
        ${renderFieldGrid([
          { label: "Nome da plataforma", value: settings.platformName },
          { label: "Logo", value: settings.logo || "--" },
          { label: "Dominio", value: settings.domain || "--" },
          { label: "Site", value: settings.site || "--" },
          { label: "Email", value: settings.email || "--" },
          { label: "Email suporte", value: settings.emails?.support || "--" },
          { label: "Email financeiro", value: settings.emails?.financial || "--" },
          { label: "Email comercial", value: settings.emails?.commercial || "--" },
          { label: "WhatsApp", value: settings.whatsapp || "--" },
          { label: "Instagram", value: settings.social?.instagram || "--" },
          { label: "Facebook", value: settings.social?.facebook || "--" },
          { label: "LinkedIn", value: settings.social?.linkedin || "--" },
          { label: "SMTP", value: settings.smtp?.status || "PREPARED" },
          { label: "Integracoes", value: Object.values(settings.integrations || {}).join(" / ") || "PREPARED" },
          { label: "API", value: settings.api?.status || "PREPARED" },
          { label: "Tokens", value: settings.tokens?.status || "PREPARED" },
          { label: "Rodape padrao", value: settings.defaultFooter },
          { label: "Marca exibida nos clientes", value: settings.customerBrandName },
          { label: "Modo manutencao", value: settings.maintenanceMode ? "Ativo" : "Inativo" },
          { label: "Versao", value: settings.version },
        ])}
      </article>
      <article class="master-panel">
        <h2>Branding</h2>
        ${renderFieldGrid([
          { label: "Marca plataforma", value: "INOVAS Food" },
          { label: "Marca restaurante", value: "Configurada por restaurante" },
          { label: "Regra", value: "Nunca misturar marca INOVAS com marca do restaurante" },
        ])}
      </article>
    `;
  };

  const renderContent = () => {
    const contentRoot = query("[data-master-content]");

    if (!contentRoot) {
      return;
    }

    if (state.isLoading) {
      contentRoot.innerHTML = `
        <div class="admin-empty-state">
          <strong>Carregando Painel Master</strong>
          <span>Sincronizando dados da plataforma.</span>
        </div>
      `;
      return;
    }

    if (state.error) {
      contentRoot.innerHTML = `
        <div class="admin-empty-state">
          <strong>Acesso ao Painel Master indisponivel</strong>
          <span>${escapeHtml(state.error)}</span>
        </div>
      `;
      return;
    }

    const renderers = {
      dashboard: renderDashboard,
      restaurants: renderRestaurants,
      users: renderUsers,
      plans: renderPlans,
      resources: renderResources,
      domains: renderDomains,
      subscriptions: renderSubscriptions,
      sellers: renderSellers,
      commissions: renderCommissions,
      contracts: renderContracts,
      finance: renderFinance,
      commercial: renderCommercial,
      reports: renderReports,
      logs: () => renderEvents("logs"),
      audit: () => renderEvents("audit"),
      developer: renderDeveloper,
      settings: renderSettings,
    };

    const sectionBody = (renderers[state.activeSection] || renderDashboard)();
    contentRoot.innerHTML = `${state.activeSection === "users" ? "" : renderFeedback()}${sectionBody}`;
    updateRestaurantOnboardingPreview(contentRoot.querySelector("[data-master-restaurant-form]"));
    updateMasterUserCreatePreview(contentRoot.querySelector("[data-master-user-create-form]"));
  };

  // ---------------------------------------------------------------------------
  // Data loading and form submissions
  // ---------------------------------------------------------------------------

  const render = () => {
    renderChrome();
    renderNav();
    renderKpis();
    renderContent();
  };

  const loadMasterPanel = async () => {
    state.isLoading = true;
    state.error = "";
    render();

    try {
      const snapshot = await fetchJson("/api/admin/master/overview");
      const userType = String(snapshot.admin?.userType || snapshot.admin?.tipo_usuario || "").toUpperCase();

      if (userType !== "MASTER") {
        state.error = "Este acesso é exclusivo para usuário MASTER.";
        return;
      }

      state.snapshot = snapshot;
    } catch (error) {
      if (error.status === 401) {
        redirectToLogin();
        return;
      }

      state.error =
        error.status === 403
          ? "Seu usuário não possui permissão MASTER para esta área."
          : error.message || "Nao foi possivel carregar o Painel Master.";
    } finally {
      state.isLoading = false;
      render();
    }
  };

  const getFormValue = (form, name) =>
    String(new FormData(form).get(name) || "").trim();

  const toSlug = (value) =>
    normalizeSearch(value)
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const applyMasterUserSearchFilter = () => {
    const rows = queryAll("[data-master-user-row]");
    const queryValue = normalizeSearch(state.userSearch);
    let visibleCount = 0;

    rows.forEach((row) => {
      const matches = !queryValue || String(row.dataset.masterUserRowSearch || "").includes(queryValue);
      row.hidden = !matches;

      if (matches) {
        visibleCount += 1;
      }
    });

    const counter = query("[data-master-users-visible]");
    const emptyState = query("[data-master-user-empty-filter]");

    if (counter) {
      counter.textContent = String(visibleCount);
    }

    if (emptyState) {
      emptyState.hidden = visibleCount > 0 || !queryValue;
    }
  };

  const getOnboardingValue = (form, name) =>
    String(new FormData(form).get(name) || "").trim();

  const getOnboardingFeatures = (form) =>
    new FormData(form)
      .getAll("features")
      .map((feature) => String(feature || "").trim())
      .filter(Boolean);

  const buildInternalMenuUrl = (slug) =>
    `${ONBOARDING_INTERNAL_BASE_URL}/${toSlug(slug) || "restaurante"}`;

  const readRestaurantOnboardingDraft = (form) => {
    const tradeName = getOnboardingValue(form, "tradeName");
    const responsible = getOnboardingValue(form, "responsible");
    const email = getOnboardingValue(form, "email").toLowerCase();
    const phone = getOnboardingValue(form, "phone");
    const whatsapp = getOnboardingValue(form, "whatsapp") || phone;
    const slug = toSlug(getOnboardingValue(form, "slug") || tradeName);
    const menuAddressType = getOnboardingValue(form, "menuAddressType") || "inovas";
    const customDomain = normalizeDomainForForm(getOnboardingValue(form, "domain"));
    const publicMenuUrl = buildInternalMenuUrl(slug);
    const selectedPlan = getOnboardingValue(form, "plan") || "BUSINESS";
    const ownerName = getOnboardingValue(form, "ownerName") || responsible;
    const ownerEmail = (getOnboardingValue(form, "ownerEmail") || email).toLowerCase();
    const domainForSummary =
      menuAddressType === "custom" && customDomain ? `https://${customDomain}` : publicMenuUrl;

    return {
      tradeName,
      companyName: getOnboardingValue(form, "companyName"),
      document: getOnboardingValue(form, "document"),
      stateRegistration: getOnboardingValue(form, "stateRegistration"),
      responsible,
      email,
      phone,
      whatsapp,
      postalCode: getOnboardingValue(form, "postalCode"),
      street: getOnboardingValue(form, "street"),
      establishmentNumber: getOnboardingValue(form, "establishmentNumber"),
      neighborhood: getOnboardingValue(form, "neighborhood"),
      city: getOnboardingValue(form, "city"),
      state: getOnboardingValue(form, "state"),
      slug,
      menuAddressType,
      customDomain,
      publicMenuUrl,
      domainForSummary,
      selectedPlan,
      features: getOnboardingFeatures(form),
      ownerName,
      ownerEmail,
      ownerPassword: getOnboardingValue(form, "ownerPassword"),
      ownerPasswordConfirm: getOnboardingValue(form, "ownerPasswordConfirm"),
      ownerRole: getOnboardingValue(form, "ownerRole") || "Proprietario",
      logoUrl: getOnboardingValue(form, "logoUrl"),
      bannerUrl: getOnboardingValue(form, "bannerUrl"),
      primaryColor: getOnboardingValue(form, "primaryColor") || "#ff5a00",
      secondaryColor: getOnboardingValue(form, "secondaryColor") || "#111827",
      subscriptionStatus: getOnboardingValue(form, "subscriptionStatus") || "TRIAL",
      adhesionDate: getOnboardingValue(form, "adhesionDate"),
      deliveryRadiusKm: getOnboardingValue(form, "deliveryRadiusKm"),
      deliveryFee: getOnboardingValue(form, "deliveryFee"),
      minimumOrder: getOnboardingValue(form, "minimumOrder"),
      businessHours: getOnboardingValue(form, "businessHours"),
      notes: getOnboardingValue(form, "notes"),
    };
  };

  const setOnboardingText = (form, selector, value) => {
    const element = form?.querySelector(selector);

    if (element) {
      element.textContent = value;
    }
  };

  const setOnboardingPill = (element, availability) => {
    if (!element || !availability) {
      return;
    }

    element.textContent = availability.label;
    element.dataset.status = availability.status;
  };

  const setOnboardingFieldValidation = (form, name, status = "", message = "") => {
    const messageNode = form?.querySelector(`[data-master-onboarding-validation="${name}"]`);
    const control = form?.querySelector(`[name="${name}"]`);
    const field = control?.closest(".master-onboarding-field");

    if (messageNode) {
      messageNode.textContent = message;
      messageNode.dataset.status = status;
    }

    if (field) {
      field.dataset.status = status;
    }

    if (control) {
      control.setAttribute("aria-invalid", status === "invalid" ? "true" : "false");
    }
  };

  const showOnboardingFeedback = (form, message = "", type = "info") => {
    const feedback = form?.querySelector("[data-master-onboarding-feedback]");

    if (!feedback) {
      return;
    }

    feedback.hidden = !message;
    feedback.textContent = message;
    feedback.className = `admin-feedback ${
      type === "success" ? "is-success" : type === "error" ? "is-error" : ""
    }`;
  };

  const setOnboardingSubmitting = (form, isSubmitting) => {
    const submitButton = form?.querySelector('button[type="submit"]');

    if (!submitButton) {
      return;
    }

    submitButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting ? "Salvando..." : "Salvar";
  };

  const updateRestaurantOnboardingPreview = (form) => {
    if (!form) {
      return null;
    }

    const draft = readRestaurantOnboardingDraft(form);
    const slugAvailability = getSlugAvailability(draft.slug);
    const domainAvailability = getDomainAvailability(draft.customDomain);
    const customDomainRoot = form.querySelector("[data-master-onboarding-custom-domain]");
    const slugStatus = form.querySelector("[data-master-onboarding-slug-status]");
    const domainStatus = form.querySelector("[data-master-onboarding-domain-status]");
    const brandMark = form.querySelector("[data-master-onboarding-brand-mark]");

    if (customDomainRoot) {
      customDomainRoot.hidden = draft.menuAddressType !== "custom";
    }

    setOnboardingPill(slugStatus, slugAvailability);
    setOnboardingPill(domainStatus, draft.menuAddressType === "custom" ? domainAvailability : {
      status: "empty",
      label: "Opcional",
    });
    setOnboardingText(form, "[data-master-onboarding-menu-url]", draft.publicMenuUrl);
    setOnboardingText(form, '[data-master-onboarding-summary="restaurant"]', draft.tradeName || "Aguardando nome");
    setOnboardingText(form, '[data-master-onboarding-summary="plan"]', draft.selectedPlan || "BUSINESS");
    setOnboardingText(form, '[data-master-onboarding-summary="address"]', draft.domainForSummary);
    setOnboardingText(
      form,
      '[data-master-onboarding-summary="responsible"]',
      draft.ownerName || draft.responsible || "Aguardando responsavel"
    );
    setOnboardingText(form, '[data-master-onboarding-summary="status"]', "Cadastro em andamento");
    setOnboardingText(form, "[data-master-onboarding-brand-name]", draft.tradeName || "Nome do restaurante");
    setOnboardingText(form, "[data-master-onboarding-brand-url]", draft.publicMenuUrl);

    if (brandMark) {
      brandMark.textContent = getInitials(draft.tradeName || "IF");
      brandMark.style.background = draft.primaryColor;
      brandMark.style.color = "#ffffff";
    }

    setOnboardingFieldValidation(
      form,
      "document",
      draft.document ? (isValidCnpj(draft.document) ? "valid" : "invalid") : "",
      draft.document ? (isValidCnpj(draft.document) ? "CNPJ válido" : "CNPJ inválido") : ""
    );
    setOnboardingFieldValidation(
      form,
      "email",
      draft.email ? (isValidEmail(draft.email) ? "valid" : "invalid") : "",
      draft.email ? (isValidEmail(draft.email) ? "E-mail válido" : "E-mail inválido") : ""
    );
    setOnboardingFieldValidation(
      form,
      "phone",
      draft.phone ? (isValidPhone(draft.phone) ? "valid" : "invalid") : "",
      draft.phone ? (isValidPhone(draft.phone) ? "Telefone válido" : "Telefone inválido") : ""
    );
    setOnboardingFieldValidation(
      form,
      "ownerEmail",
      draft.ownerEmail ? (isValidEmail(draft.ownerEmail) ? "valid" : "invalid") : "",
      draft.ownerEmail ? (isValidEmail(draft.ownerEmail) ? "E-mail válido" : "E-mail inválido") : ""
    );
    setOnboardingFieldValidation(
      form,
      "ownerPasswordConfirm",
      draft.ownerPasswordConfirm || draft.ownerPassword
        ? (draft.ownerPassword && draft.ownerPassword === draft.ownerPasswordConfirm ? "valid" : "invalid")
        : "",
      draft.ownerPasswordConfirm || draft.ownerPassword
        ? (draft.ownerPassword === draft.ownerPasswordConfirm ? "Senhas conferem" : "Senhas diferentes")
        : ""
    );

    return draft;
  };

  const getMasterUserCreateValue = (form, name) =>
    String(new FormData(form).get(name) || "").trim();

  const isMasterUserCreateChecked = (form, name) =>
    new FormData(form).get(name) !== null;

  const getMasterUserCreatePermissions = (form) =>
    new FormData(form)
      .getAll("permission")
      .map((permission) => String(permission || "").trim())
      .filter(Boolean)
      .reduce((permissions, permission) => {
        permissions[permission] = true;
        return permissions;
      }, {});

  const readMasterUserCreateDraft = (form) => {
    const firstName = getMasterUserCreateValue(form, "firstName");
    const lastName = getMasterUserCreateValue(form, "lastName");
    const email = getMasterUserCreateValue(form, "email").toLowerCase();
    const phone = getMasterUserCreateValue(form, "phone");
    const login = (getMasterUserCreateValue(form, "login") || email).toLowerCase();
    const selectedProfile = String(getMasterUserCreateValue(form, "userType") || "GERENTE").toUpperCase();
    const customizePermissions = isMasterUserCreateChecked(form, "customizePermissions") || selectedProfile === "CUSTOM";
    const active = isMasterUserCreateChecked(form, "active");
    const blocked = isMasterUserCreateChecked(form, "blocked");
    let accessScope = getMasterUserCreateValue(form, "accessScope") || "restaurant";
    let userType = customizePermissions ? "CUSTOM" : selectedProfile;

    if (userType === "MASTER") {
      accessScope = "all";
    }

    if (accessScope === "all") {
      userType = "MASTER";
    }

    return {
      firstName,
      lastName,
      name: [firstName, lastName].filter(Boolean).join(" "),
      document: getMasterUserCreateValue(form, "document"),
      phone,
      email,
      birthDate: getMasterUserCreateValue(form, "birthDate"),
      login,
      password: getMasterUserCreateValue(form, "password"),
      passwordConfirm: getMasterUserCreateValue(form, "passwordConfirm"),
      forcePasswordChange: isMasterUserCreateChecked(form, "forcePasswordChange"),
      sendInvite: isMasterUserCreateChecked(form, "sendInvite"),
      accessScope,
      restaurantKey: accessScope === "all" ? "" : getMasterUserCreateValue(form, "restaurantKey"),
      userType,
      customizePermissions,
      permissions: customizePermissions ? getMasterUserCreatePermissions(form) : {},
      status: blocked || !active ? "BLOCKED" : "ACTIVE",
    };
  };

  const setMasterUserCreateText = (form, selector, value) => {
    const element = form?.querySelector(selector);

    if (element) {
      element.textContent = value;
    }
  };

  const updateMasterUserPermissionPreview = (form, profile) => {
    const copy = getMasterUserProfileCopy(profile);
    const canList = form?.querySelector("[data-master-user-profile-can]");
    const cannotList = form?.querySelector("[data-master-user-profile-cannot]");

    if (canList) {
      canList.innerHTML = renderMasterUserPreviewList(copy.can);
    }

    if (cannotList) {
      cannotList.innerHTML = renderMasterUserPreviewList(copy.cannot);
    }
  };

  const updateMasterUserCreatePreview = (form) => {
    if (!form) {
      return null;
    }

    const draft = readMasterUserCreateDraft(form);
    const restaurantField = form.querySelector("[data-master-user-restaurant-field]");
    const platformNote = form.querySelector("[data-master-user-platform-note]");
    const permissionGrid = form.querySelector("[data-master-user-permissions-grid]");
    const permissionNote = form.querySelector("[data-master-user-permission-note]");
    const activeInput = form.querySelector('[name="active"]');
    const blockedInput = form.querySelector('[name="blocked"]');

    if (restaurantField) {
      restaurantField.hidden = draft.accessScope === "all";
    }

    if (platformNote) {
      platformNote.hidden = draft.accessScope !== "all";
    }

    if (permissionGrid) {
      permissionGrid.dataset.enabled = draft.customizePermissions ? "true" : "false";
      permissionGrid
        .querySelectorAll('input[name="permission"]')
        .forEach((input) => {
          input.disabled = !draft.customizePermissions;
        });
    }

    if (permissionNote) {
      permissionNote.textContent = draft.customizePermissions
        ? "Permissões detalhadas liberadas para perfil Personalizado."
        : "Perfil pronto usa permissões automáticas. Marcar personalização muda o cargo para Personalizado e libera os detalhes.";
    }

    if (activeInput && blockedInput) {
      if (blockedInput.checked) {
        activeInput.checked = false;
      } else if (!activeInput.checked) {
        blockedInput.checked = true;
      }
    }

    updateMasterUserPermissionPreview(form, draft.userType);
    setMasterUserCreateText(form, '[data-master-user-summary="name"]', draft.name || "Aguardando nome");
    setMasterUserCreateText(form, '[data-master-user-summary="email"]', draft.email || "Aguardando email");
    setMasterUserCreateText(
      form,
      '[data-master-user-summary="restaurant"]',
      draft.accessScope === "all" ? "Todos os restaurantes" : getRestaurantOptionLabel(draft.restaurantKey)
    );
    setMasterUserCreateText(
      form,
      '[data-master-user-summary="profile"]',
      getMasterUserProfileCopy(draft.userType).label
    );
    setMasterUserCreateText(
      form,
      '[data-master-user-summary="status"]',
      draft.status === "ACTIVE" ? "Ativo" : "Bloqueado"
    );

    setOnboardingFieldValidation(
      form,
      "email",
      draft.email ? (isValidEmail(draft.email) ? "valid" : "invalid") : "",
      draft.email ? (isValidEmail(draft.email) ? "E-mail válido" : "E-mail inválido") : ""
    );
    setOnboardingFieldValidation(
      form,
      "phone",
      draft.phone ? (isValidPhone(draft.phone) ? "valid" : "invalid") : "",
      draft.phone ? (isValidPhone(draft.phone) ? "Telefone válido" : "Telefone inválido") : ""
    );
    setOnboardingFieldValidation(
      form,
      "passwordConfirm",
      draft.passwordConfirm || draft.password
        ? (draft.password && draft.password === draft.passwordConfirm ? "valid" : "invalid")
        : "",
      draft.passwordConfirm || draft.password
        ? (draft.password === draft.passwordConfirm ? "Senhas conferem" : "Senhas diferentes")
        : ""
    );

    return draft;
  };

  const syncMasterUserCreateInput = (target) => {
    const input = target?.closest?.("[data-master-user-create-input]");

    if (!input) {
      return false;
    }

    const form = input.closest("[data-master-user-create-form]");

    if (!form) {
      return false;
    }

    if (input.name === "email") {
      const loginInput = form.querySelector('[name="login"]');

      if (loginInput && !loginInput.value.trim()) {
        loginInput.value = String(input.value || "").trim().toLowerCase();
      }
    }

    if (input.name === "customizePermissions" && input.checked) {
      const customProfile = form.querySelector('[name="userType"][value="CUSTOM"]');
      const restaurantScope = form.querySelector('[name="accessScope"][value="restaurant"]');

      if (customProfile) {
        customProfile.checked = true;
      }

      if (restaurantScope) {
        restaurantScope.checked = true;
      }
    }

    if (input.name === "userType") {
      const customizeInput = form.querySelector('[name="customizePermissions"]');

      if (customizeInput) {
        customizeInput.checked = input.value === "CUSTOM";
      }

      if (input.value === "MASTER") {
        const platformScope = form.querySelector('[name="accessScope"][value="all"]');

        if (platformScope) {
          platformScope.checked = true;
        }
      } else {
        const restaurantScope = form.querySelector('[name="accessScope"][value="restaurant"]');

        if (restaurantScope) {
          restaurantScope.checked = true;
        }
      }
    }

    if (input.name === "accessScope" && input.value === "all") {
      const masterProfile = form.querySelector('[name="userType"][value="MASTER"]');
      const customizeInput = form.querySelector('[name="customizePermissions"]');

      if (masterProfile) {
        masterProfile.checked = true;
      }

      if (customizeInput) {
        customizeInput.checked = false;
      }
    }

    if (input.name === "active" && input.checked) {
      const blockedInput = form.querySelector('[name="blocked"]');

      if (blockedInput) {
        blockedInput.checked = false;
      }
    }

    if (input.name === "blocked" && input.checked) {
      const activeInput = form.querySelector('[name="active"]');

      if (activeInput) {
        activeInput.checked = false;
      }
    }

    updateMasterUserCreatePreview(form);
    return true;
  };

  const syncRestaurantOnboardingInput = (target) => {
    const input = target?.closest?.("[data-master-onboarding-input]");

    if (!input) {
      return false;
    }

    const form = input.closest("[data-master-restaurant-form]");

    if (!form) {
      return false;
    }

    if (input.name === "slug") {
      state.restaurantOnboardingTouchedSlug = true;
      input.value = toSlug(input.value);
    }

    if (input.name === "tradeName" && !state.restaurantOnboardingTouchedSlug) {
      const slugInput = form.querySelector('[name="slug"]');

      if (slugInput) {
        slugInput.value = toSlug(input.value);
      }
    }

    if (input.name === "responsible") {
      const ownerNameInput = form.querySelector('[name="ownerName"]');

      if (ownerNameInput && !ownerNameInput.value.trim()) {
        ownerNameInput.value = input.value;
      }
    }

    if (input.name === "email") {
      const ownerEmailInput = form.querySelector('[name="ownerEmail"]');

      if (ownerEmailInput && !ownerEmailInput.value.trim()) {
        ownerEmailInput.value = input.value;
      }
    }

    if (input.name === "domain") {
      input.value = normalizeDomainForForm(input.value);
    }

    showOnboardingFeedback(form, "");
    updateRestaurantOnboardingPreview(form);
    return true;
  };

  const validateRestaurantOnboardingForm = (form) => {
    const draft = updateRestaurantOnboardingPreview(form);
    const errors = [];
    const requireField = (name, label, value) => {
      if (!String(value || "").trim()) {
        errors.push(label);
        setOnboardingFieldValidation(form, name, "invalid", "Obrigatorio");
      }
    };

    requireField("tradeName", "Nome Fantasia", draft.tradeName);
    requireField("document", "CNPJ", draft.document);
    requireField("responsible", "Responsavel", draft.responsible);
    requireField("email", "Email", draft.email);
    requireField("phone", "Telefone", draft.phone);
    requireField("postalCode", "CEP", draft.postalCode);
    requireField("street", "Rua", draft.street);
    requireField("establishmentNumber", "Numero", draft.establishmentNumber);
    requireField("neighborhood", "Bairro", draft.neighborhood);
    requireField("city", "Cidade", draft.city);
    requireField("state", "Estado", draft.state);
    requireField("slug", "Slug", draft.slug);
    requireField("ownerName", "Nome do proprietario", draft.ownerName);
    requireField("ownerEmail", "Email do proprietario", draft.ownerEmail);
    requireField("ownerPassword", "Senha", draft.ownerPassword);
    requireField("ownerPasswordConfirm", "Confirmar senha", draft.ownerPasswordConfirm);
    requireField("adhesionDate", "Data de adesao", draft.adhesionDate);

    if (draft.document && !isValidCnpj(draft.document)) {
      errors.push("CNPJ válido");
      setOnboardingFieldValidation(form, "document", "invalid", "CNPJ inválido");
    }

    if (draft.email && !isValidEmail(draft.email)) {
      errors.push("E-mail válido");
      setOnboardingFieldValidation(form, "email", "invalid", "E-mail inválido");
    }

    if (draft.phone && !isValidPhone(draft.phone)) {
      errors.push("Telefone válido");
      setOnboardingFieldValidation(form, "phone", "invalid", "Telefone inválido");
    }

    if (draft.ownerEmail && !isValidEmail(draft.ownerEmail)) {
      errors.push("E-mail do proprietário válido");
      setOnboardingFieldValidation(form, "ownerEmail", "invalid", "E-mail inválido");
    }

    if (draft.postalCode && getDigits(draft.postalCode).length !== 8) {
      errors.push("CEP válido");
      setOnboardingFieldValidation(form, "postalCode", "invalid", "CEP inválido");
    }

    if (getSlugAvailability(draft.slug).status !== "valid") {
      errors.push("Slug disponivel");
      setOnboardingFieldValidation(form, "slug", "invalid", "Slug indisponivel");
    }

    if (draft.menuAddressType === "custom" && getDomainAvailability(draft.customDomain).status !== "valid") {
      errors.push("Domínio próprio válido");
      setOnboardingFieldValidation(form, "domain", "invalid", "Domínio inválido ou indisponível");
    }

    if (draft.ownerPassword.length < 6) {
      errors.push("Senha com pelo menos 6 caracteres");
      setOnboardingFieldValidation(form, "ownerPassword", "invalid", "Mínimo de 6 caracteres");
    }

    if (draft.ownerPassword !== draft.ownerPasswordConfirm) {
      errors.push("Senhas iguais");
      setOnboardingFieldValidation(form, "ownerPasswordConfirm", "invalid", "Senhas diferentes");
    }

    if (errors.length) {
      const uniqueErrors = Array.from(new Set(errors));
      showOnboardingFeedback(form, `Revise: ${uniqueErrors.slice(0, 4).join(", ")}.`, "error");
      return null;
    }

    showOnboardingFeedback(form, "");
    return draft;
  };

  const submitRestaurantRegistration = async (form) => {
    const draft = validateRestaurantOnboardingForm(form);

    if (!draft) {
      return;
    }

    state.isUserSubmitting = true;
    state.userFeedback = "";
    setOnboardingSubmitting(form, true);

    try {
      const response = await fetchJson("/api/admin/master/onboard-restaurant", {
        method: "POST",
        body: JSON.stringify({
          restaurantName: draft.tradeName,
          tradeName: draft.tradeName,
          name: draft.tradeName,
          slug: draft.slug,
          restaurantKey: draft.slug,
          domain: draft.menuAddressType === "custom" ? draft.customDomain : "",
          customDomain: draft.menuAddressType === "custom" ? draft.customDomain : "",
          document: draft.document,
          companyName: draft.companyName,
          stateRegistration: draft.stateRegistration,
          ownerFullName: draft.ownerName,
          responsible: draft.responsible,
          city: draft.city,
          state: draft.state,
          postalCode: getDigits(draft.postalCode),
          establishmentNumber: draft.establishmentNumber,
          email: draft.email,
          phone: draft.phone,
          whatsapp: draft.whatsapp,
          plan: draft.selectedPlan,
          adhesionDate: draft.adhesionDate,
          subscriptionStatus: draft.subscriptionStatus,
          features: draft.features,
          menuAddress: {
            type: draft.menuAddressType,
            slug: draft.slug,
            internalUrl: draft.publicMenuUrl,
            customDomain: draft.customDomain,
          },
          appearance: {
            logoUrl: draft.logoUrl,
            bannerUrl: draft.bannerUrl,
            primaryColor: draft.primaryColor,
            secondaryColor: draft.secondaryColor,
          },
          address: {
            postalCode: getDigits(draft.postalCode),
            street: draft.street,
            number: draft.establishmentNumber,
            neighborhood: draft.neighborhood,
            city: draft.city,
            state: draft.state,
          },
          delivery: {
            radiusKm: Number(draft.deliveryRadiusKm || 5),
            fee: Number(draft.deliveryFee || 0),
            minimumOrder: Number(draft.minimumOrder || 0),
            deliveriesEnabled: draft.features.includes("delivery"),
          },
          pickupEnabled: draft.features.includes("pickup"),
          businessHours: draft.businessHours,
          notes: draft.notes,
          paymentMethods: ["pix", "card", "cash"],
          adminUser: {
            login: draft.ownerEmail,
            email: draft.ownerEmail,
            name: draft.ownerName,
            role: draft.ownerRole,
            password: draft.ownerPassword,
          },
        }),
      });

      state.userFeedback = response.message || "Restaurante cadastrado com sucesso.";
      state.userFeedbackType = "success";
      state.userMode = "view-user";
      state.selectedUserId =
        response.restaurantAdmin?.id || response.restaurantAdmin?.login || response.adminUser?.login || "";
      state.isUserSubmitting = false;
      await loadMasterPanel();
    } catch (error) {
      state.isUserSubmitting = false;
      state.userFeedback = error.message || "Nao foi possivel cadastrar o restaurante.";
      state.userFeedbackType = "error";
      setOnboardingSubmitting(form, false);
      showOnboardingFeedback(form, state.userFeedback, "error");
    }
  };

  const setMasterUserCreateSubmitting = (form, isSubmitting) => {
    const submitButton = form?.querySelector('button[type="submit"]');

    if (!submitButton) {
      return;
    }

    submitButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting ? "Salvando..." : "Salvar usuário";
  };

  const submitMasterUserCreate = async (form) => {
    const draft = updateMasterUserCreatePreview(form);
    const errors = [];

    if (!draft.name) {
      errors.push("Informe o nome do usuário.");
      setOnboardingFieldValidation(form, "firstName", "invalid", "Nome obrigatório");
    }

    if (!draft.email || !isValidEmail(draft.email)) {
      errors.push("Informe um e-mail válido.");
      setOnboardingFieldValidation(form, "email", "invalid", "E-mail inválido");
    }

    if (!draft.phone || !isValidPhone(draft.phone)) {
      errors.push("Informe um telefone válido.");
      setOnboardingFieldValidation(form, "phone", "invalid", "Telefone inválido");
    }

    if (!draft.password || draft.password.length < 6) {
      errors.push("Informe uma senha com pelo menos 6 caracteres.");
      setOnboardingFieldValidation(form, "password", "invalid", "Senha mínima: 6 caracteres");
    }

    if (draft.password !== draft.passwordConfirm) {
      errors.push("Confirme a senha corretamente.");
      setOnboardingFieldValidation(form, "passwordConfirm", "invalid", "Senhas diferentes");
    }

    if (draft.accessScope === "restaurant" && !draft.restaurantKey) {
      errors.push("Selecione o restaurante do usuário.");
      setOnboardingFieldValidation(form, "restaurantKey", "invalid", "Restaurante obrigatório");
    }

    if (draft.userType === "MASTER") {
      errors.push("A plataforma preserva um único usuário MASTER ativo. Edite o MASTER existente ou use um perfil operacional.");
    }

    if (errors.length) {
      showOnboardingFeedback(form, errors[0], "error");
      return;
    }

    state.isUserSubmitting = true;
    state.userFeedback = "";
    setMasterUserCreateSubmitting(form, true);
    showOnboardingFeedback(form, "", "info");

    try {
      const response = await fetchJson("/api/admin/users/save", {
        method: "POST",
        body: JSON.stringify({
          user: {
            login: draft.login,
            name: draft.name,
            email: draft.email,
            phone: draft.phone,
            password: draft.password,
            status: draft.status,
            userType: draft.userType,
            userScope: draft.accessScope === "all" ? "SYSTEM" : "RESTAURANT",
            platformScope: draft.accessScope === "all",
            restaurantKey: draft.restaurantKey,
            permissions: draft.permissions,
            document: draft.document,
            birthDate: draft.birthDate,
            forcePasswordChange: draft.forcePasswordChange,
            sendInvite: draft.sendInvite,
          },
        }),
      });

      state.userFeedback = response.message || "Usuário criado com sucesso.";
      state.userFeedbackType = "success";
      state.userMode = "view-user";
      state.selectedUserId = response.user?.id || response.user?.login || draft.login;
      state.isUserSubmitting = false;
      await loadMasterPanel();
    } catch (error) {
      state.isUserSubmitting = false;
      state.userFeedback = error.message || "Não foi possível criar o usuário.";
      state.userFeedbackType = "error";
      setMasterUserCreateSubmitting(form, false);
      showOnboardingFeedback(form, state.userFeedback, "error");
    }
  };

  const submitMasterUserEdit = async (form) => {
    const selectedUser = getMasterUserById(state.selectedUserId);

    if (!selectedUser) {
      return;
    }

    const password = getFormValue(form, "password");
    const user = {
      id: getFormValue(form, "id") || selectedUser.id,
      login: getFormValue(form, "login") || selectedUser.login,
      name: getFormValue(form, "name"),
      email: getFormValue(form, "email"),
      phone: getFormValue(form, "phone") || selectedUser.phone || selectedUser.telefone || "",
      status: getFormValue(form, "status") || selectedUser.status || "ACTIVE",
      userType: getFormValue(form, "userType") || selectedUser.userType || selectedUser.tipo_usuario || "CUSTOM",
      restaurantKey: getFormValue(form, "restaurantKey") || selectedUser.restaurantKey || "",
      permissions: selectedUser.permissions || {},
    };

    if (password) {
      user.password = password;
    }

    state.isUserSubmitting = true;
    state.userFeedback = "";
    renderContent();

    try {
      const response = await fetchJson("/api/admin/users/save", {
        method: "POST",
        body: JSON.stringify({ user }),
      });

      state.userFeedback = response.message || "Usuário salvo com sucesso.";
      state.userFeedbackType = "success";
      state.userMode = "view-user";
      state.selectedUserId = response.user?.id || response.user?.login || selectedUser.id || selectedUser.login || "";
      state.isUserSubmitting = false;
      await loadMasterPanel();
    } catch (error) {
      state.isUserSubmitting = false;
      state.userFeedback = error.message || "Não foi possível salvar o usuário.";
      state.userFeedbackType = "error";
      renderContent();
    }
  };

  const toggleMasterUserStatus = async (button) => {
    const userId = String(button?.dataset.masterUserId || "").trim();
    const nextStatus = String(button?.dataset.masterNextStatus || "").trim();
    const user = getMasterUserById(userId);

    if (!user || !nextStatus) {
      return;
    }

    state.isUserSubmitting = true;
    state.userFeedback = "";
    renderContent();

    try {
      const response = await fetchJson("/api/admin/users/status", {
        method: "POST",
        body: JSON.stringify({
          id: user.id,
          login: user.login,
          status: nextStatus,
        }),
      });

      state.userFeedback = response.message || "Status do usuário atualizado.";
      state.userFeedbackType = "success";
      state.selectedUserId = response.user?.id || response.user?.login || user.id || user.login || "";
      state.userMode = "view-user";
      state.isUserSubmitting = false;
      await loadMasterPanel();
    } catch (error) {
      state.isUserSubmitting = false;
      state.userFeedback = error.message || "Não foi possível alterar o status do usuário.";
      state.userFeedbackType = "error";
      renderContent();
    }
  };

  const initMasterPanel = () => {
    // Platform RC keeps all writes behind the existing backend; prepared actions
    // only inform the operator that the module contract exists.
    const navRoot = query("[data-master-nav]");
    const contentRoot = query("[data-master-content]");
    const refreshButtons = queryAll("[data-master-refresh]");
    const logoutButton = query("[data-master-logout]");

    if (navRoot) {
      navRoot.addEventListener("click", (event) => {
        const button = event.target.closest("[data-master-section-button]");

        if (!button) {
          return;
        }

        const nextSection = String(button.dataset.masterSectionButton || "").trim();

        if (!nextSection) {
          return;
        }

        state.activeSection = nextSection;
        if (nextSection !== "restaurants" && state.userMode === "new-restaurant") {
          state.userMode = "list";
        }
        if (nextSection !== "users" && state.userMode === "new-user") {
          state.userMode = "list";
        }
        state.userFeedback = "";
        render();
      });
    }

    if (contentRoot) {
      contentRoot.addEventListener("input", (event) => {
        if (syncMasterUserCreateInput(event.target)) {
          return;
        }

        if (syncRestaurantOnboardingInput(event.target)) {
          return;
        }

        const userFilter = event.target.closest("[data-master-user-filter]");
        const restaurantFilter = event.target.closest("[data-master-restaurant-filter]");

        if (restaurantFilter) {
          const filterKey = String(restaurantFilter.dataset.masterRestaurantFilter || "").trim();

          if (filterKey) {
            state.restaurantFilters = {
              ...state.restaurantFilters,
              [filterKey]: String(restaurantFilter.value || ""),
            };
            renderContent();
          }
          return;
        }

        if (!userFilter) {
          return;
        }

        const filterKey = String(userFilter.dataset.masterUserFilter || "").trim();

        if (filterKey === "search") {
          state.userSearch = String(userFilter.value || "");
        } else if (filterKey) {
          state.userFilters = {
            ...state.userFilters,
            [filterKey]: String(userFilter.value || ""),
          };
        }

        renderContent();
      });

      contentRoot.addEventListener("change", (event) => {
        if (syncMasterUserCreateInput(event.target)) {
          return;
        }

        if (syncRestaurantOnboardingInput(event.target)) {
          return;
        }

        const userFilter = event.target.closest("[data-master-user-filter]");

        if (!userFilter) {
          return;
        }

        const filterKey = String(userFilter.dataset.masterUserFilter || "").trim();

        if (filterKey && filterKey !== "search") {
          state.userFilters = {
            ...state.userFilters,
            [filterKey]: String(userFilter.value || ""),
          };
          renderContent();
        }
      });

      contentRoot.addEventListener("click", (event) => {
        const actionButton = event.target.closest("[data-master-user-action]");
        const restaurantActionButton = event.target.closest("[data-master-restaurant-action]");
        const restaurantTabButton = event.target.closest("[data-master-restaurant-tab]");
        const preparedActionButton = event.target.closest("[data-master-prepared-action]");

        if (restaurantTabButton) {
          state.selectedRestaurantTab = String(restaurantTabButton.dataset.masterRestaurantTab || "info").trim() || "info";
          renderContent();
          return;
        }

        if (restaurantActionButton) {
          const action = String(restaurantActionButton.dataset.masterRestaurantAction || "").trim();

          if (action === "view") {
            state.selectedRestaurantKey = String(restaurantActionButton.dataset.masterRestaurantKey || "").trim();
            state.selectedRestaurantTab = "info";
            renderContent();
            return;
          }

          if (action === "close") {
            state.selectedRestaurantKey = "";
            state.selectedRestaurantTab = "info";
            renderContent();
            return;
          }
        }

        if (preparedActionButton) {
          const action = String(preparedActionButton.dataset.masterPreparedAction || "").trim();
          state.userFeedback = `Acao ${action} preparada para a Plataforma V1.3. Escrita real ainda nao foi executada.`;
          state.userFeedbackType = "info";
          renderContent();
          return;
        }

        if (!actionButton) {
          return;
        }

        const action = String(actionButton.dataset.masterUserAction || "").trim();
        const userId = String(actionButton.dataset.masterUserId || "").trim();

        if (action === "new-restaurant") {
          state.activeSection = "restaurants";
          state.userMode = "new-restaurant";
          state.selectedUserId = "";
          state.userFeedback = "";
          state.restaurantOnboardingTouchedSlug = false;
          render();
          return;
        }

        if (action === "new-user") {
          state.activeSection = "users";
          state.userMode = "new-user";
          state.selectedUserId = "";
          state.userFeedback = "";
          render();
          return;
        }

        if (action === "clear-filters") {
          state.userSearch = "";
          state.userFilters = {
            restaurant: "",
            profile: "",
            status: "",
          };
          renderContent();
          return;
        }

        if (action === "close") {
          const wasRestaurantOnboarding = state.userMode === "new-restaurant";
          const wasUserCreation = state.userMode === "new-user";
          state.userMode = "list";
          state.selectedUserId = "";
          if (wasRestaurantOnboarding || wasUserCreation) {
            render();
          } else {
            renderContent();
          }
          return;
        }

        if (action === "view" || action === "edit") {
          state.userMode = action === "view" ? "view-user" : "edit-user";
          state.selectedUserId = userId;
          state.userFeedback = "";
          renderContent();
          return;
        }

        if (action === "toggle") {
          void toggleMasterUserStatus(actionButton);
        }
      });

      contentRoot.addEventListener("submit", (event) => {
        const restaurantForm = event.target.closest("[data-master-restaurant-form]");
        const createUserForm = event.target.closest("[data-master-user-create-form]");
        const editForm = event.target.closest("[data-master-user-edit-form]");

        if (!restaurantForm && !createUserForm && !editForm) {
          return;
        }

        event.preventDefault();

        if (restaurantForm) {
          void submitRestaurantRegistration(restaurantForm);
          return;
        }

        if (createUserForm) {
          void submitMasterUserCreate(createUserForm);
          return;
        }

        void submitMasterUserEdit(editForm);
      });
    }

    refreshButtons.forEach((button) => {
      button.addEventListener("click", () => {
        void loadMasterPanel();
      });
    });

    if (logoutButton) {
      logoutButton.addEventListener("click", async () => {
        try {
          await fetchJson("/api/admin/logout", { method: "POST" });
        } catch (error) {
          // A saida local deve voltar para o login mesmo se a API responder tarde.
        }

        window.location.href = "/admin/login.html";
      });
    }

    void loadMasterPanel();
  };

  initMasterPanel();
})();
