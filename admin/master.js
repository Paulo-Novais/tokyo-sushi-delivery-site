(() => {
  const MASTER_DEFAULT_MENU = [
    { key: "dashboard", label: "Dashboard Geral", status: "ready" },
    { key: "restaurants", label: "Restaurantes", status: "foundation" },
    { key: "users", label: "Usuarios", status: "ready" },
    { key: "plans", label: "Planos", status: "foundation" },
    { key: "resources", label: "Recursos", status: "foundation" },
    { key: "domains", label: "Dominios", status: "foundation" },
    { key: "subscriptions", label: "Assinaturas", status: "prepared" },
    { key: "reports", label: "Relatorios Gerais", status: "prepared" },
    { key: "logs", label: "Logs", status: "foundation" },
    { key: "audit", label: "Auditoria", status: "foundation" },
    { key: "developer", label: "Desenvolvedor", status: "foundation" },
    { key: "settings", label: "Configuracoes da Plataforma", status: "foundation" },
  ];

  const SECTION_META = {
    dashboard: {
      chip: "Dashboard Geral",
      title: "Dashboard Geral",
      subtitle: "Leitura consolidada da plataforma.",
    },
    restaurants: {
      chip: "Restaurantes",
      title: "Restaurantes",
      subtitle: "Cadastro superior preparado para a carteira INovas Food.",
    },
    users: {
      chip: "Usuarios",
      title: "Usuarios",
      subtitle: "Base administrativa consolidada.",
    },
    plans: {
      chip: "Planos",
      title: "Planos",
      subtitle: "Estrutura comercial sem cobranca ativa.",
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
      subtitle: "Painel Master exclusivo para usuario MASTER.",
    },
  };

  const state = {
    activeSection: "dashboard",
    snapshot: null,
    isLoading: true,
    error: "",
  };

  const numberFormatter = new Intl.NumberFormat("pt-BR");
  const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

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

  const formatNumber = (value) => numberFormatter.format(Number(value || 0));
  const formatCurrency = (value) => currencyFormatter.format(Number(value || 0));

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

  const getMenu = () => asArray(state.snapshot?.menu).length ? state.snapshot.menu : MASTER_DEFAULT_MENU;

  const renderNav = () => {
    const navRoot = query("[data-master-nav]");

    if (!navRoot) {
      return;
    }

    if (state.error && !state.snapshot) {
      navRoot.innerHTML = `
        <div class="master-nav-denied">
          <strong>Acesso restrito</strong>
          <small>Entre com um usuario MASTER para ver os modulos da plataforma.</small>
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
    const meta =
      state.error && !state.snapshot
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

    const dashboard = state.snapshot?.dashboard || {};
    const kpis = [
      ["Restaurantes", formatNumber(dashboard.totalRestaurants)],
      ["Usuarios", formatNumber(dashboard.totalUsers)],
      ["Pedidos", formatNumber(dashboard.totalOrders)],
      ["Clientes", formatNumber(dashboard.totalCustomers)],
      ["Avaliacoes", formatNumber(dashboard.totalReviews)],
      ["Faturamento", formatCurrency(dashboard.totalRevenue)],
      ["Acessos", formatNumber(dashboard.totalAccesses)],
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
    const plans = asArray(state.snapshot?.plans);
    const modules = getMenu();
    const flags = state.snapshot?.restaurantFeatureFlags?.default || {};

    return `
      <div class="master-panel-grid">
        <article class="master-panel">
          <h2>Plataforma</h2>
          ${renderFieldGrid([
            { label: "Nome", value: state.snapshot?.platform?.platformName || "INovas Food" },
            { label: "Versao", value: state.snapshot?.platform?.version || "--" },
            {
              label: "Modo manutencao",
              value: state.snapshot?.platform?.maintenanceMode ? "Ativo" : "Inativo",
            },
          ])}
        </article>
        <article class="master-panel">
          <h2>Cliente Modelo</h2>
          ${renderFieldGrid([
            { label: "Restaurante", value: restaurants[0]?.name || "Tokyo Sushi Delivery" },
            { label: "Plano", value: restaurants[0]?.plan || "PREMIUM" },
            { label: "Status", value: restaurants[0]?.statusLabel || restaurants[0]?.status || "Cliente Modelo" },
          ])}
        </article>
      </div>
      <div class="master-panel-grid">
        <article class="master-panel">
          <h2>Modulos Master</h2>
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
          <h2>Feature Flags</h2>
          <div class="master-list">
            ${Object.entries(flags)
              .map(
                ([key, enabled]) => `
                  <div class="master-list-row">
                    <strong>${escapeHtml(key)}</strong>
                    ${renderStatus(enabled ? "ON" : "OFF")}
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
      </div>
      <div class="master-panel">
        <h2>Planos Preparados</h2>
        <div class="master-card-grid">
          ${plans
            .map(
              (plan) => `
                <article class="master-card">
                  <span>${escapeHtml(plan.status)}</span>
                  <strong>${escapeHtml(plan.name)}</strong>
                  <small>${escapeHtml(plan.description)}</small>
                </article>
              `
            )
            .join("")}
        </div>
      </div>
    `;
  };

  const renderRestaurants = () => {
    const rows = asArray(state.snapshot?.restaurants).map(
      (restaurant) => `
        <tr>
          <td>${escapeHtml(restaurant.name)}</td>
          <td>${escapeHtml(restaurant.slug)}</td>
          <td>${renderStatus(restaurant.statusLabel || restaurant.status)}</td>
          <td>${escapeHtml(restaurant.plan)}</td>
          <td>${escapeHtml(restaurant.domain)}</td>
          <td>${escapeHtml(formatDateTime(restaurant.createdAt))}</td>
          <td>${escapeHtml(restaurant.notes)}</td>
        </tr>
      `
    );

    return `
      <article class="master-panel">
        <h2>Cadastro de Restaurantes</h2>
        ${renderTable(
          ["Nome", "Slug", "Status", "Plano", "Dominio", "Data de criacao", "Observacoes"],
          rows,
          "Nenhum restaurante cadastrado."
        )}
      </article>
    `;
  };

  const renderUsers = () => {
    const rows = asArray(state.snapshot?.users).map(
      (user) => `
        <tr>
          <td>${escapeHtml(user.name || user.nome)}</td>
          <td>${escapeHtml(user.login)}</td>
          <td>${escapeHtml(user.userType || user.tipo_usuario)}</td>
          <td>${renderStatus(user.statusLabel || user.status)}</td>
          <td>${escapeHtml(formatDateTime(user.lastAccessAt || user.ultimo_acesso))}</td>
        </tr>
      `
    );

    return `
      <article class="master-panel">
        <h2>Usuarios da Plataforma</h2>
        ${renderTable(["Nome", "Login", "Tipo", "Status", "Ultimo acesso"], rows, "Nenhum usuario cadastrado.")}
      </article>
    `;
  };

  const renderPlans = () => `
    <div class="master-card-grid">
      ${asArray(state.snapshot?.plans)
        .map(
          (plan) => `
            <article class="master-card">
              <span>${escapeHtml(plan.status)}</span>
              <strong>${escapeHtml(plan.name)}</strong>
              <small>${escapeHtml(plan.description)}</small>
              <div class="master-list">
                <div class="master-list-row">
                  <strong>Valor mensal</strong>
                  <span>${escapeHtml(formatCurrency(plan.monthlyValue || plan.valor_mensal))}</span>
                </div>
                <div class="master-list-row">
                  <strong>Limite de usuarios</strong>
                  <span>${escapeHtml(
                    Number(plan.userLimit || plan.limite_usuarios || 0)
                      ? `${plan.userLimit || plan.limite_usuarios} usuarios`
                      : "Usuarios extras preparados"
                  )}</span>
                </div>
                <div class="master-list-row">
                  <strong>Edicao</strong>
                  <span>Valor, descricao e status preparados</span>
                </div>
              </div>
              <div class="master-token-list">
                ${asArray(plan.recursos_inclusos || plan.includedFeatures || plan.features)
                  .map((feature) => `<em>${escapeHtml(feature)}</em>`)
                  .join("")}
              </div>
              <small>${escapeHtml(plan.notes || plan.observations || "Sem observacoes.")}</small>
            </article>
          `
        )
        .join("")}
    </div>
  `;

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
          <td>${escapeHtml(formatCurrency(subscription.monthlyValue || subscription.valor_mensal))}</td>
          <td>${renderStatus(subscription.status)}</td>
          <td>${escapeHtml(subscription.dueDate || subscription.data_vencimento || `Dia ${subscription.dueDay || subscription.dia_vencimento || "--"}`)}</td>
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
          ["Restaurante", "Plano", "Valor", "Status", "Vencimento", "Recursos liberados", "Observacoes"],
          rows,
          "Nenhum contrato cadastrado."
        )}
      </article>
    `;
  };

  const renderReports = () => `
    <article class="master-panel">
      <h2>Relatorios Gerais</h2>
      ${renderFieldGrid([
        { label: "Preparado", value: state.snapshot?.reports?.prepared ? "Sim" : "Nao" },
        { label: "Escopo atual", value: "Tokyo Sushi / default" },
        { label: "Consolidacao", value: "Futura carteira INovas Food" },
      ])}
    </article>
  `;

  const renderEvents = (key) => {
    const rows = asArray(state.snapshot?.[key]).map(
      (event) => `
        <tr>
          <td>${escapeHtml(event.actorName || event.actorLogin || "--")}</td>
          <td>${escapeHtml(event.target || "--")}</td>
          <td>${escapeHtml(formatDateTime(event.changedAt))}</td>
          <td>${escapeHtml(event.origin || "--")}</td>
          <td>${escapeHtml(event.actionType || "--")}</td>
        </tr>
      `
    );

    return `
      <article class="master-panel">
        <h2>${key === "logs" ? "Logs" : "Auditoria"}</h2>
        ${renderTable(["Quem alterou", "O que alterou", "Quando", "Origem", "Tipo de acao"], rows, "Sem registros novos.")}
      </article>
    `;
  };

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
          { label: "Site", value: settings.site || "--" },
          { label: "Email", value: settings.email || "--" },
          { label: "WhatsApp", value: settings.whatsapp || "--" },
          { label: "Rodape padrao", value: settings.defaultFooter },
          { label: "Marca exibida nos clientes", value: settings.customerBrandName },
          { label: "Modo manutencao", value: settings.maintenanceMode ? "Ativo" : "Inativo" },
          { label: "Versao", value: settings.version },
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
      reports: renderReports,
      logs: () => renderEvents("logs"),
      audit: () => renderEvents("audit"),
      developer: renderDeveloper,
      settings: renderSettings,
    };

    contentRoot.innerHTML = (renderers[state.activeSection] || renderDashboard)();
  };

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
        state.error = "Este acesso e exclusivo para usuario MASTER.";
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
          ? "Seu usuario nao possui permissao MASTER para esta area."
          : error.message || "Nao foi possivel carregar o Painel Master.";
    } finally {
      state.isLoading = false;
      render();
    }
  };

  const initMasterPanel = () => {
    const navRoot = query("[data-master-nav]");
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
        render();
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
