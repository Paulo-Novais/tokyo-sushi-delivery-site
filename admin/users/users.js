(() => {
  "use strict";

  const body = document.body;
  const app = document.querySelector("[data-users-app]");
  const sidebar = document.querySelector("[data-users-sidebar]");
  const toast = document.querySelector("[data-users-toast]");
  const supportBanner = document.querySelector("[data-support-banner]");
  const dialog = document.querySelector("[data-user-dialog]");
  const domain = body.dataset.userDomain === "SYSTEM" ? "SYSTEM" : "RESTAURANT";
  const view = body.dataset.userView || "list";
  const mode = body.dataset.userMode || "new";
  const isSystem = domain === "SYSTEM";
  const apiBase = isSystem ? "/api/system" : "/api/tenant";
  const listPath = isSystem ? "/system/users" : "/admin/users";
  const homePath = isSystem ? "/system" : "/admin/";
  const pageSize = 15;

  const ROLE_COPY = Object.freeze({
    OWNER: "Controle integral do restaurante e proteção de propriedade.",
    ADMIN: "Administração ampla da operação e da equipe.",
    MANAGER: "Coordenação da operação e acompanhamento gerencial.",
    CASHIER: "Pedidos, clientes e rotinas financeiras de caixa.",
    SERVICE: "Atendimento, clientes, pedidos e entregas.",
    KITCHEN: "Produção, comandas e atualização de pedidos.",
    INVENTORY: "Cardápio e controle de entradas, saídas e ajustes.",
    FINANCE: "Relatórios, dados financeiros e exportações.",
    DELIVERY: "Pedidos em rota e administração de entregas.",
    READ_ONLY: "Consulta sem ações de alteração.",
    CUSTOM: "Permissões configuradas individualmente.",
    MASTER: "Administração integral da plataforma INOVAS.",
    SOCIO: "Visão estratégica com restrições administrativas críticas.",
    SUPORTE: "Diagnóstico da plataforma e suporte controlado.",
    DESENVOLVEDOR: "Saúde técnica, auditoria e suporte administrativo.",
    COMERCIAL: "Restaurantes, planos e novos cadastros.",
    FINANCEIRO_INOVAS: "Faturamento e indicadores financeiros da plataforma.",
    IMPLANTACAO: "Provisionamento, domínios e ativação de restaurantes.",
    CUSTOMER_SUCCESS: "Saúde dos restaurantes e suporte de acompanhamento.",
    AUDITOR: "Consulta de saúde, faturamento e trilhas de auditoria.",
  });

  const MODULE_LABELS = Object.freeze({
    dashboard: "Dashboard",
    restaurants: "Restaurantes",
    plans: "Planos",
    domains: "Domínios",
    health: "Saúde",
    audit: "Auditoria",
    users: "Usuários",
    support: "Suporte",
    billing: "Faturamento",
    orders: "Pedidos",
    customers: "Clientes",
    catalog: "Cardápio",
    inventory: "Estoque",
    financial: "Financeiro",
    delivery: "Entregas",
    reports: "Relatórios",
    settings: "Configurações",
  });

  const state = {
    session: null,
    policy: null,
    users: [],
    summary: {},
    filters: {
      search: "",
      role: "",
      status: "",
      department: "",
      source: "",
      created: "",
      access: "",
      invite: "",
      customized: "",
      sort: "name",
    },
    page: 1,
    selectedUser: null,
    selectedRole: "",
    selectedPermissions: new Set(),
    submitting: false,
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const normalizeText = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim();

  const getInitials = (value) => {
    const names = normalizeText(value).split(" ").filter(Boolean);
    if (!names.length) return "US";
    return `${names[0][0] || ""}${names.length > 1 ? names.at(-1)[0] || "" : names[0][1] || ""}`
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (value, { includeTime = true } = {}) => {
    if (!value) return "Nunca acessou";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Não informado";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      ...(includeTime ? { timeStyle: "short" } : {}),
    }).format(date);
  };

  const getStatusMeta = (user) => {
    const invitationState = String(user?.invitation?.state || "").toUpperCase();
    const status = String(user?.status || "PENDING").toUpperCase();
    if (status === "BLOCKED") {
      return { key: "BLOCKED", label: "Bloqueado", className: "is-blocked" };
    }
    if (invitationState === "EXPIRED") {
      return {
        key: "INVITE_EXPIRED",
        label: "Convite expirado",
        className: "is-blocked",
      };
    }
    if (status === "PENDING" || invitationState === "PENDING") {
      return {
        key: "PENDING",
        label: "Convite pendente",
        className: "is-pending",
      };
    }
    if (status === "ACTIVE") {
      return { key: "ACTIVE", label: "Ativo", className: "is-active" };
    }
    if (status === "INACTIVE") {
      return { key: "INACTIVE", label: "Inativo", className: "" };
    }
    if (status === "PASSWORD_RESET_REQUIRED") {
      return {
        key: "PASSWORD_RESET_REQUIRED",
        label: "Redefinição obrigatória",
        className: "is-pending",
      };
    }
    return { key: status, label: "Inativo", className: "" };
  };

  const requestJson = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
      ...options,
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }
    if (!response.ok || payload.success === false) {
      const error = new Error(
        payload?.error?.message ||
          payload?.message ||
          "Não foi possível concluir a solicitação."
      );
      error.status = response.status;
      error.code = payload?.error?.code || "request_error";
      error.field = payload?.error?.field || "";
      throw error;
    }
    return payload;
  };

  const notify = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(notify.timeout);
    notify.timeout = window.setTimeout(() => {
      toast.hidden = true;
    }, 4200);
  };

  const renderSidebar = () => {
    if (!sidebar) return;
    const systemLinks = [
      ["Visão geral", "/system", "VI"],
      ["Restaurantes", "/system#restaurants", "RE"],
      ["Saúde", "/system#health", "SA"],
      ["Integrações", "/system#integrations", "IN"],
      ["Usuários INOVAS", "/system/users", "US"],
      ["Auditoria", "/system#audit", "AU"],
      ["Suporte", "/system#support", "SU"],
    ];
    const restaurantLinks = [
      ["Visão geral", "/admin/", "VI"],
      ["Pedidos", "/admin/#orders", "PE"],
      ["Cardápio", "/admin/#catalog", "CA"],
      ["Clientes", "/admin/#customers", "CL"],
      ["Estoque", "/admin/#inventory", "ES"],
      ["Financeiro", "/admin/#finance", "FI"],
      ["Usuários", "/admin/users", "US"],
      ["Configurações", "/admin/#settings", "CO"],
    ];
    const links = isSystem ? systemLinks : restaurantLinks;
    sidebar.innerHTML = `
      <a class="users-brand" href="${homePath}">
        <img src="/assets/inovas-food-logo-oficial.png" alt="INOVAS Food" />
        <span class="users-brand-copy">
          <small>${isSystem ? "Plataforma" : "Restaurante"}</small>
          <strong>${isSystem ? "Painel System" : "Administração"}</strong>
        </span>
      </a>
      <nav class="users-nav" aria-label="Navegação principal">
        ${links
          .map(
            ([label, href, icon]) => `
              <a href="${href}" ${
                label.includes("Usuários") || label === "Usuários"
                  ? 'aria-current="page"'
                  : ""
              }>
                <span class="users-nav-icon" aria-hidden="true">${icon}</span>
                ${escapeHtml(label)}
              </a>
            `
          )
          .join("")}
      </nav>
      <div class="users-sidebar-foot">
        <strong>${escapeHtml(
          state.session?.displayName || state.session?.login || "Conta autenticada"
        )}</strong><br />
        ${escapeHtml(
          isSystem
            ? `${state.session?.role || "SYSTEM"} · tenant nulo`
            : `${state.session?.role || "RESTAURANT"} · ${state.session?.restaurantKey || "tenant protegido"}`
        )}
      </div>
    `;
  };

  const renderSupportBanner = () => {
    const support = state.session?.support;
    if (!supportBanner || !support) return;
    supportBanner.hidden = false;
    supportBanner.innerHTML = `
      <div>
        <strong>Suporte ${escapeHtml(support.mode)} ativo · ${escapeHtml(
          support.restaurantName || state.session.restaurantKey
        )}</strong>
        Motivo: ${escapeHtml(support.reason)} · expira em ${escapeHtml(
          formatDate(support.expiresAt)
        )}
      </div>
      <button type="button" data-support-exit>Sair do suporte</button>
    `;
  };

  const loadSession = async () => {
    const payload = isSystem
      ? await requestJson("/api/auth/system/session")
      : await requestJson(`${apiBase}/session`);
    const session = payload?.data?.session || null;
    if (!session || (isSystem && payload.authenticated === false)) {
      const error = new Error("Sua sessão expirou. Entre novamente.");
      error.status = 401;
      throw error;
    }
    if (isSystem && (session.tenantId || session.restaurantId)) {
      throw new Error("A sessão System apresentou um escopo inválido.");
    }
    state.session = session;
  };

  const loadPolicy = async () => {
    const payload = await requestJson(`${apiBase}/permissions`);
    state.policy = payload.data;
  };

  const loadUsers = async () => {
    const payload = await requestJson(
      `${apiBase}/users?page=1&pageSize=100&sort=name&direction=asc`
    );
    state.users = Array.isArray(payload?.data?.users) ? payload.data.users : [];
    state.summary = payload?.data?.summary || {};
  };

  const renderFatal = (error) => {
    app.innerHTML = `
      <section class="users-panel users-error">
        <div>
          <span class="users-avatar" aria-hidden="true">!</span>
          <h2>Não foi possível abrir esta área</h2>
          <p>${escapeHtml(error?.message || "Tente novamente em instantes.")}</p>
          <a class="users-button users-button-primary" href="${
            error?.status === 401 ? "/admin/login.html" : window.location.href
          }">${error?.status === 401 ? "Entrar novamente" : "Tentar novamente"}</a>
        </div>
      </section>
    `;
  };

  const getRoles = () =>
    Array.isArray(state.policy?.roles) ? state.policy.roles : [];

  const getPermissions = () =>
    Array.isArray(state.policy?.permissions) ? state.policy.permissions : [];

  const getRole = (key) =>
    getRoles().find((role) => role.key === key) || null;

  const getFilteredUsers = () => {
    const search = state.filters.search.toLowerCase();
    const now = Date.now();
    const filtered = state.users.filter((user) => {
      const status = getStatusMeta(user).key;
      const invitationState = String(
        user.invitation?.state || "NOT_CREATED"
      ).toUpperCase();
      const createdAt = new Date(user.createdAt || 0).getTime();
      const lastAccessAt = user.lastAccessAt
        ? new Date(user.lastAccessAt).getTime()
        : 0;
      const customized =
        user.role === "CUSTOM" ||
        (user.grantOverrides || []).length > 0 ||
        (user.denyOverrides || []).length > 0;
      const searchable = `${user.name} ${user.email} ${user.phone || ""} ${
        user.jobTitle || ""
      } ${user.department || ""}`.toLowerCase();
      return (
        (!search || searchable.includes(search)) &&
        (!state.filters.role || user.role === state.filters.role) &&
        (!state.filters.status || status === state.filters.status) &&
        (!state.filters.department ||
          user.department === state.filters.department) &&
        (!state.filters.source || user.source === state.filters.source) &&
        (!state.filters.created ||
          (state.filters.created === "30d"
            ? createdAt >= now - 30 * 86_400_000
            : createdAt > 0 && createdAt < now - 30 * 86_400_000)) &&
        (!state.filters.access ||
          (state.filters.access === "never"
            ? !lastAccessAt
            : state.filters.access === "30d"
              ? lastAccessAt >= now - 30 * 86_400_000
              : lastAccessAt > 0 &&
                lastAccessAt < now - 90 * 86_400_000)) &&
        (!state.filters.invite ||
          invitationState === state.filters.invite) &&
        (!state.filters.customized ||
          customized === (state.filters.customized === "yes"))
      );
    });
    const sortValue = (user) => {
      if (state.filters.sort === "created") return user.createdAt || "";
      if (state.filters.sort === "access") return user.lastAccessAt || "";
      if (state.filters.sort === "status") return getStatusMeta(user).key;
      return user.name || "";
    };
    return filtered.sort((left, right) => {
      const comparison = String(sortValue(left)).localeCompare(
        String(sortValue(right)),
        "pt-BR"
      );
      return ["created", "access"].includes(state.filters.sort)
        ? -comparison
        : comparison;
    });
  };

  const getDepartments = () =>
    [...new Set(state.users.map((user) => user.department).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, "pt-BR")
    );

  const getSources = () =>
    [...new Set(state.users.map((user) => user.source).filter(Boolean))].sort();

  const renderStat = (key, label, value, helper) => `
    <button class="users-stat ${
      state.filters.status === key ? "is-active" : ""
    }" type="button" data-summary-filter="${escapeHtml(key)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value || 0))}</strong>
      <small>${escapeHtml(helper)}</small>
    </button>
  `;

  const renderList = () => {
    const filteredUsers = getFilteredUsers();
    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
    state.page = Math.min(state.page, totalPages);
    const offset = (state.page - 1) * pageSize;
    const pageUsers = filteredUsers.slice(offset, offset + pageSize);
    const activeFilters = Object.entries(state.filters).filter(
      ([key, value]) => value && key !== "sort"
    ).length;
    const ownersOrAdmins = isSystem
      ? state.users.filter((user) => ["MASTER", "SOCIO"].includes(user.role)).length
      : Number(state.summary.owners || 0);

    app.innerHTML = `
      <nav class="users-breadcrumb" aria-label="Navegação estrutural">
        <a href="${homePath}">${isSystem ? "Sistema" : "Painel"}</a>
        <span aria-hidden="true">/</span>
        <strong>${isSystem ? "Usuários INOVAS" : "Usuários"}</strong>
      </nav>
      <header class="users-page-head">
        <div>
          <span class="users-eyebrow">${
            isSystem ? "Identidades internas · SYSTEM" : "Equipe · RESTAURANT"
          }</span>
          <h1>${isSystem ? "Usuários INOVAS" : "Usuários"}</h1>
          <p>${
            isSystem
              ? "Administre exclusivamente os acessos internos da plataforma, sem vínculo operacional com restaurantes."
              : "Gerencie os acessos, perfis e permissões da equipe deste restaurante."
          }</p>
        </div>
        <a class="users-button users-button-primary" href="${listPath}/new">
          <span aria-hidden="true">＋</span> Novo usuário
        </a>
      </header>
      <section class="users-summary" aria-label="Resumo de usuários">
        ${renderStat("", "Total", state.summary.total ?? state.users.length, "Todos os cadastros")}
        ${renderStat("ACTIVE", "Ativos", state.summary.active, "Com acesso liberado")}
        ${renderStat("PENDING", "Convites pendentes", state.summary.pending, "Aguardando aceite")}
        ${renderStat("BLOCKED", "Bloqueados", state.summary.blocked, "Sem novas sessões")}
        ${renderStat(
          "__authority__",
          isSystem ? "Alta autoridade" : "Proprietários",
          ownersOrAdmins,
          isSystem ? "Master ou Sócio" : "Owners ativos"
        )}
      </section>
      <section class="users-panel">
        <div class="users-toolbar" aria-label="Busca e filtros">
          <label class="users-field">
            <span>Buscar</span>
            <input class="users-input" type="search" data-filter="search"
              value="${escapeHtml(state.filters.search)}"
              placeholder="Nome, e-mail, telefone ou cargo" />
          </label>
          <label class="users-field">
            <span>Perfil</span>
            <select class="users-input" data-filter="role">
              <option value="">Todos os perfis</option>
              ${getRoles()
                .map(
                  (role) =>
                    `<option value="${escapeHtml(role.key)}" ${
                      state.filters.role === role.key ? "selected" : ""
                    }>${escapeHtml(role.label)}</option>`
                )
                .join("")}
            </select>
          </label>
          <label class="users-field">
            <span>Status</span>
            <select class="users-input" data-filter="status">
              <option value="">Todos os status</option>
              <option value="ACTIVE" ${
                state.filters.status === "ACTIVE" ? "selected" : ""
              }>Ativo</option>
              <option value="PENDING" ${
                state.filters.status === "PENDING" ? "selected" : ""
              }>Convite pendente</option>
              <option value="BLOCKED" ${
                state.filters.status === "BLOCKED" ? "selected" : ""
              }>Bloqueado</option>
              <option value="INACTIVE" ${
                state.filters.status === "INACTIVE" ? "selected" : ""
              }>Inativo</option>
              <option value="INVITE_EXPIRED" ${
                state.filters.status === "INVITE_EXPIRED" ? "selected" : ""
              }>Convite expirado</option>
            </select>
          </label>
          <label class="users-field">
            <span>${isSystem ? "Área" : "Setor"}</span>
            <select class="users-input" data-filter="department">
              <option value="">Todos</option>
              ${getDepartments()
                .map(
                  (department) =>
                    `<option value="${escapeHtml(department)}" ${
                      state.filters.department === department ? "selected" : ""
                    }>${escapeHtml(department)}</option>`
                )
                .join("")}
            </select>
          </label>
          <label class="users-field">
            <span>Origem</span>
            <select class="users-input" data-filter="source">
              <option value="">Todas</option>
              ${getSources()
                .map(
                  (source) =>
                    `<option value="${escapeHtml(source)}" ${
                      state.filters.source === source ? "selected" : ""
                    }>${escapeHtml(source)}</option>`
                )
                .join("")}
            </select>
          </label>
          <label class="users-field">
            <span>Criação</span>
            <select class="users-input" data-filter="created">
              <option value="">Qualquer data</option>
              <option value="30d" ${
                state.filters.created === "30d" ? "selected" : ""
              }>Últimos 30 dias</option>
              <option value="older" ${
                state.filters.created === "older" ? "selected" : ""
              }>Há mais de 30 dias</option>
            </select>
          </label>
          <label class="users-field">
            <span>Último acesso</span>
            <select class="users-input" data-filter="access">
              <option value="">Qualquer período</option>
              <option value="never" ${
                state.filters.access === "never" ? "selected" : ""
              }>Nunca acessou</option>
              <option value="30d" ${
                state.filters.access === "30d" ? "selected" : ""
              }>Nos últimos 30 dias</option>
              <option value="stale" ${
                state.filters.access === "stale" ? "selected" : ""
              }>Sem acesso há 90 dias</option>
            </select>
          </label>
          <label class="users-field">
            <span>Convite</span>
            <select class="users-input" data-filter="invite">
              <option value="">Todos</option>
              <option value="PENDING" ${
                state.filters.invite === "PENDING" ? "selected" : ""
              }>Pendente</option>
              <option value="EXPIRED" ${
                state.filters.invite === "EXPIRED" ? "selected" : ""
              }>Expirado</option>
              <option value="NOT_CREATED" ${
                state.filters.invite === "NOT_CREATED" ? "selected" : ""
              }>Sem convite</option>
            </select>
          </label>
          <label class="users-field">
            <span>Permissões</span>
            <select class="users-input" data-filter="customized">
              <option value="">Todos os perfis</option>
              <option value="yes" ${
                state.filters.customized === "yes" ? "selected" : ""
              }>Personalizadas</option>
              <option value="no" ${
                state.filters.customized === "no" ? "selected" : ""
              }>Somente perfil-base</option>
            </select>
          </label>
          <label class="users-field">
            <span>Ordenar por</span>
            <select class="users-input" data-filter="sort">
              <option value="name" ${
                state.filters.sort === "name" ? "selected" : ""
              }>Nome</option>
              <option value="created" ${
                state.filters.sort === "created" ? "selected" : ""
              }>Criação mais recente</option>
              <option value="access" ${
                state.filters.sort === "access" ? "selected" : ""
              }>Último acesso</option>
              <option value="status" ${
                state.filters.sort === "status" ? "selected" : ""
              }>Status</option>
            </select>
          </label>
        </div>
        <div class="users-filter-meta">
          <span>${filteredUsers.length} resultado(s) · ${activeFilters} filtro(s) ativo(s)</span>
          <button class="users-link-button" type="button" data-clear-filters>Limpar filtros</button>
        </div>
        ${
          pageUsers.length
            ? renderUsersTable(pageUsers)
            : `
              <div class="users-empty">
                <div>
                  <span class="users-avatar" aria-hidden="true">0</span>
                  <h2>Nenhum usuário encontrado</h2>
                  <p>${
                    activeFilters
                      ? "Ajuste ou limpe os filtros para ampliar a busca."
                      : "Crie o primeiro usuário desta área para começar."
                  }</p>
                  ${
                    activeFilters
                      ? '<button class="users-button users-button-secondary" type="button" data-clear-filters>Limpar filtros</button>'
                      : `<a class="users-button users-button-primary" href="${listPath}/new">Novo usuário</a>`
                  }
                </div>
              </div>
            `
        }
        <footer class="users-pagination">
          <span>Página ${state.page} de ${totalPages}</span>
          <div class="users-actions">
            <button class="users-button users-button-secondary" type="button" data-page="${
              state.page - 1
            }" ${state.page <= 1 ? "disabled" : ""}>Anterior</button>
            <button class="users-button users-button-secondary" type="button" data-page="${
              state.page + 1
            }" ${state.page >= totalPages ? "disabled" : ""}>Próxima</button>
          </div>
        </footer>
      </section>
    `;
  };

  const renderUsersTable = (users) => `
    <div class="users-table-wrap">
      <table class="users-table">
        <thead>
          <tr>
            <th>Usuário</th>
            <th>Contato</th>
            <th>Perfil</th>
            <th>${isSystem ? "Área" : "Setor"}</th>
            <th>Status</th>
            <th>Último acesso</th>
            <th>Origem</th>
            <th><span class="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          ${users.map(renderUserRow).join("")}
        </tbody>
      </table>
    </div>
  `;

  const renderUserRow = (user) => {
    const status = getStatusMeta(user);
    const isOwner = user.role === "OWNER";
    const customized =
      user.role === "CUSTOM" ||
      (Array.isArray(user.grantOverrides) && user.grantOverrides.length > 0) ||
      (Array.isArray(user.denyOverrides) && user.denyOverrides.length > 0);
    return `
      <tr>
        <td data-label="Usuário">
          <div class="users-person">
            <span class="users-avatar" aria-hidden="true">${escapeHtml(
              getInitials(user.name)
            )}</span>
            <span>
              <strong>${escapeHtml(user.name)}</strong>
              <small>${escapeHtml(user.jobTitle || "Função não informada")}</small>
              <span class="users-badges">
                ${isOwner ? '<span class="users-badge is-owner">Owner</span>' : ""}
                ${customized ? '<span class="users-badge">Personalizado</span>' : ""}
              </span>
            </span>
          </div>
        </td>
        <td data-label="Contato">
          <span class="users-contact">
            <strong>${escapeHtml(user.email)}</strong>
            <small>${escapeHtml(user.phone || "Telefone não informado")}</small>
          </span>
        </td>
        <td data-label="Perfil">
          <span class="users-role">
            <strong>${escapeHtml(user.roleLabel || user.role)}</strong>
            <small>${escapeHtml(ROLE_COPY[user.role] || "Perfil de acesso")}</small>
          </span>
        </td>
        <td data-label="${isSystem ? "Área" : "Setor"}">${escapeHtml(
          user.department || "Não informado"
        )}</td>
        <td data-label="Status"><span class="users-status ${status.className}">${escapeHtml(
          status.label
        )}</span></td>
        <td data-label="Último acesso">${escapeHtml(formatDate(user.lastAccessAt))}</td>
        <td data-label="Origem">${escapeHtml(
          user.source === "legacy_env" ? "Configuração segura" : "Painel"
        )}</td>
        <td data-label="Ações">
          <div class="users-actions">
            <button class="users-icon-button" type="button" data-user-view-id="${escapeHtml(
              user.id
            )}" title="Ver detalhes" aria-label="Ver detalhes de ${escapeHtml(
              user.name
            )}">···</button>
            <a class="users-icon-button" href="${listPath}/${encodeURIComponent(
              user.id
            )}/edit" title="Editar" aria-label="Editar ${escapeHtml(user.name)}">✎</a>
          </div>
        </td>
      </tr>
    `;
  };

  const renderUserDialog = (user) => {
    if (!dialog) return;
    const status = getStatusMeta(user);
    const invitePending = ["PENDING", "INVITE_EXPIRED"].includes(status.key);
    const permissionCount = Array.isArray(user.effectivePermissions)
      ? user.effectivePermissions.length
      : 0;
    const recentAudit = Array.isArray(user.auditTrail)
      ? user.auditTrail.slice(-5).reverse()
      : [];
    const primaryLifecycle =
      status.key === "BLOCKED"
        ? { action: "unblock", label: "Desbloquear", danger: false }
        : status.key === "INACTIVE"
          ? { action: "activate", label: "Reativar", danger: false }
          : { action: "block", label: "Bloquear", danger: true };
    dialog.innerHTML = `
      <header class="users-dialog-head">
        <div>
          <span class="users-eyebrow">Detalhes do usuário</span>
          <h2>${escapeHtml(user.name)}</h2>
        </div>
        <button class="users-icon-button" type="button" data-dialog-close aria-label="Fechar">×</button>
      </header>
      <div class="users-dialog-body">
        <div class="users-detail-grid">
          ${[
            ["E-mail", user.email],
            ["Telefone", user.phone || "Não informado"],
            ["Perfil", user.roleLabel || user.role],
            [isSystem ? "Área" : "Setor", user.department || "Não informado"],
            ["Status", status.label],
            ["Último acesso", formatDate(user.lastAccessAt)],
            ["Criado em", formatDate(user.createdAt)],
            ["Criado por", user.createdBy || "Sistema"],
            ["Permissões efetivas", `${permissionCount} concedidas`],
            ["Convite", user.invitation?.state || "Não criado"],
          ]
            .map(
              ([label, value]) => `
                <div class="users-detail">
                  <span>${escapeHtml(label)}</span>
                  <strong>${escapeHtml(value)}</strong>
                </div>
              `
            )
            .join("")}
        </div>
        ${
          user.internalNote
            ? `<div class="users-security-note" style="margin-top:14px"><strong>Observação interna</strong><br />${escapeHtml(
                user.internalNote
              )}</div>`
            : ""
        }
        <section class="users-security-note" style="margin-top:14px">
          <strong>Eventos recentes</strong>
          ${
            recentAudit.length
              ? `<ul>${recentAudit
                  .map(
                    (event) =>
                      `<li><strong>${escapeHtml(
                        event.action || "EVENTO"
                      )}</strong> · ${escapeHtml(
                        formatDate(event.createdAt)
                      )} · ${escapeHtml(
                        event.actorLogin || "Sistema"
                      )}</li>`
                  )
                  .join("")}</ul>`
              : "<p>Nenhum evento de ciclo de vida registrado.</p>"
          }
        </section>
      </div>
      <footer class="users-dialog-actions">
        ${
          invitePending
            ? `<button class="users-button users-button-secondary" type="button" data-user-resend="${escapeHtml(
                user.id
              )}">Reenviar convite</button>`
            : ""
        }
        <button class="users-button users-button-secondary" type="button"
          data-user-sessions-revoke="${escapeHtml(user.id)}">Encerrar sessões</button>
        ${
          status.key === "ACTIVE"
            ? `<button class="users-button users-button-secondary" type="button" data-user-toggle="${escapeHtml(
                user.id
              )}" data-next-action="deactivate">Desativar</button>`
            : ""
        }
        <button class="users-button ${
          primaryLifecycle.danger
            ? "users-button-danger"
            : "users-button-secondary"
        }" type="button" data-user-toggle="${escapeHtml(
          user.id
        )}" data-next-action="${primaryLifecycle.action}">${primaryLifecycle.label}</button>
        <a class="users-button users-button-primary" href="${listPath}/${encodeURIComponent(
          user.id
        )}/edit">Editar</a>
      </footer>
    `;
    dialog.showModal();
  };

  const setFormError = (message, field = "") => {
    const alert = document.querySelector("[data-form-alert]");
    if (alert) {
      alert.textContent = message;
      alert.hidden = false;
    }
    if (field) {
      const input = document.querySelector(`[name="${CSS.escape(field)}"]`);
      input?.focus();
    }
  };

  const getEditorIdentifier = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("id")) return params.get("id");
    const match = window.location.pathname.match(/\/users\/([^/]+)\/edit\/?$/);
    return match ? decodeURIComponent(match[1]) : "";
  };

  const getSelectedRoleDefinition = () => getRole(state.selectedRole);

  const resetPermissionsForRole = (roleKey) => {
    const role = getRole(roleKey);
    state.selectedPermissions = new Set(role?.permissions || []);
  };

  const initializeEditorState = () => {
    const identifier = getEditorIdentifier();
    state.selectedUser =
      mode === "edit"
        ? state.users.find(
            (user) => user.id === identifier || user.email === identifier
          ) || null
        : null;
    if (mode === "edit" && !state.selectedUser) {
      const error = new Error("Usuário não encontrado neste escopo.");
      error.status = 404;
      throw error;
    }
    state.selectedRole =
      state.selectedUser?.role || getRoles()[0]?.key || "";
    state.selectedPermissions = new Set(
      state.selectedUser?.effectivePermissions ||
        getSelectedRoleDefinition()?.permissions ||
        []
    );
  };

  const renderRoleCards = () =>
    getRoles()
      .map(
        (role) => `
          <label class="users-role-card">
            <input type="radio" name="role" value="${escapeHtml(role.key)}" ${
              state.selectedRole === role.key ? "checked" : ""
            } />
            <span>
              <strong>${escapeHtml(role.label)}</strong>
              <small>${escapeHtml(ROLE_COPY[role.key] || "Perfil de acesso")}</small>
              <em>${role.permissions.length} permissões · autoridade ${role.authority}</em>
            </span>
          </label>
        `
      )
      .join("");

  const groupPermissions = () =>
    getPermissions().reduce((groups, permission) => {
      if (!groups[permission.module]) groups[permission.module] = [];
      groups[permission.module].push(permission);
      return groups;
    }, {});

  const renderPermissionEditor = () => {
    if (isSystem) {
      const permissions = getSelectedRoleDefinition()?.permissions || [];
      return `
        <div class="users-security-note">
          As permissões System são determinadas pelo papel selecionado e nunca incluem
          permissões operacionais de restaurante.
        </div>
        <div class="users-badges" style="margin-top:12px">
          ${permissions
            .map(
              (permission) =>
                `<span class="users-badge">${escapeHtml(permission)}</span>`
            )
            .join("")}
        </div>
      `;
    }
    const groups = groupPermissions();
    return `
      <div class="users-permission-list">
        ${Object.entries(groups)
          .map(
            ([module, permissions]) => `
              <section class="users-permission-group">
                <h3>${escapeHtml(MODULE_LABELS[module] || module)}</h3>
                ${permissions
                  .map(
                    (permission) => `
                      <label class="users-permission-option">
                        <input type="checkbox" name="permission" value="${escapeHtml(
                          permission.key
                        )}" ${
                          state.selectedPermissions.has(permission.key)
                            ? "checked"
                            : ""
                        } />
                        <span>
                          <strong>${escapeHtml(permission.action)}</strong>
                          <small>${escapeHtml(permission.description)}</small>
                        </span>
                        <span class="users-risk ${String(
                          permission.riskLevel
                        ).toLowerCase().replace(/^/, "is-")}">${escapeHtml(
                          permission.riskLevel
                        )}</span>
                      </label>
                    `
                  )
                  .join("")}
              </section>
            `
          )
          .join("")}
      </div>
    `;
  };

  const renderEditor = () => {
    const user = state.selectedUser || {};
    const isEditing = mode === "edit";
    const selectedRole = getSelectedRoleDefinition();
    const criticalCount = getPermissions().filter(
      (permission) =>
        state.selectedPermissions.has(permission.key) &&
        ["HIGH", "CRITICAL"].includes(permission.riskLevel)
    ).length;
    app.innerHTML = `
      <nav class="users-breadcrumb" aria-label="Navegação estrutural">
        <a href="${listPath}">${isSystem ? "Usuários INOVAS" : "Usuários"}</a>
        <span aria-hidden="true">/</span>
        <strong>${isEditing ? "Editar usuário" : "Novo usuário"}</strong>
      </nav>
      <header class="users-page-head users-editor-title">
        <div>
          <span class="users-eyebrow">${
            isSystem ? "Conta interna · SYSTEM" : "Vínculo da equipe · RESTAURANT"
          }</span>
          <h1>${isEditing ? "Editar usuário" : "Criar novo usuário"}</h1>
          <p>${
            isSystem
              ? "Defina identidade, área e papel da plataforma. Nenhum restaurante será associado."
              : "O restaurante e o tenant são obtidos exclusivamente da sessão autenticada."
          }</p>
        </div>
      </header>
      <form data-user-form novalidate>
        <div class="users-alert" data-form-alert hidden></div>
        <div class="users-editor-grid">
          <div class="users-editor-stack">
            <section class="users-form-card">
              <header class="users-form-head">
                <span class="users-step">1</span>
                <div>
                  <h2>Dados do usuário</h2>
                  <p>Informações de identificação e contexto profissional.</p>
                </div>
              </header>
              <div class="users-fields">
                ${renderInput("name", "Nome completo", user.name || "", {
                  required: true,
                  autocomplete: "name",
                  wide: true,
                  maxLength: 160,
                })}
                ${renderInput("email", "E-mail", user.email || "", {
                  required: true,
                  type: "email",
                  autocomplete: "email",
                  readOnly: isEditing,
                  maxLength: 320,
                })}
                ${renderInput("phone", "Telefone", user.phone || "", {
                  type: "tel",
                  autocomplete: "tel",
                  maxLength: 24,
                })}
                ${renderInput(
                  "jobTitle",
                  "Cargo ou função",
                  user.jobTitle || "",
                  { maxLength: 160 }
                )}
                ${renderInput(
                  "department",
                  isSystem ? "Área" : "Setor",
                  user.department || "",
                  {
                    maxLength: 120,
                    placeholder: isSystem
                      ? "Ex.: Tecnologia"
                      : "Ex.: Operação",
                  }
                )}
                <label class="users-field users-field-wide">
                  <span>Observação interna <small>(opcional)</small></span>
                  <textarea class="users-input" name="internalNote" maxlength="500"
                    placeholder="Contexto administrativo sem dados sensíveis">${escapeHtml(
                      user.internalNote || ""
                    )}</textarea>
                  <small class="users-field-error"></small>
                </label>
              </div>
            </section>
            <section class="users-form-card">
              <header class="users-form-head">
                <span class="users-step">2</span>
                <div>
                  <h2>Perfil de acesso</h2>
                  <p>Escolha um perfil pronto e revise as permissões reais da política ${escapeHtml(
                    state.policy?.version || ""
                  )}.</p>
                </div>
              </header>
              <fieldset style="border:0;padding:0;margin:0">
                <legend style="position:absolute;left:-9999px">Perfil</legend>
                <div class="users-role-grid">${renderRoleCards()}</div>
              </fieldset>
            </section>
            <section class="users-form-card">
              <header class="users-form-head">
                <span class="users-step">3</span>
                <div>
                  <h2>${isSystem ? "Permissões do papel" : "Matriz de permissões"}</h2>
                  <p>${
                    isSystem
                      ? "Vocabulário exclusivo system.*."
                      : "Dependências são aplicadas automaticamente e validadas novamente no servidor."
                  }</p>
                </div>
              </header>
              <div data-permission-editor>${renderPermissionEditor()}</div>
            </section>
            <section class="users-form-card">
              <header class="users-form-head">
                <span class="users-step">4</span>
                <div>
                  <h2>Status e forma de acesso</h2>
                  <p>Convites e senhas temporárias são de uso único e auditados.</p>
                </div>
              </header>
              <div class="users-choice-grid">
                ${renderChoice(
                  "credentialMode",
                  "INVITE",
                  "Convite por e-mail",
                  "Link único com expiração.",
                  !isEditing && (user.credentialMode || "INVITE") === "INVITE"
                )}
                ${renderChoice(
                  "credentialMode",
                  "TEMPORARY_PASSWORD",
                  "Senha temporária",
                  "Exige troca no primeiro acesso.",
                  !isEditing && user.credentialMode === "TEMPORARY_PASSWORD"
                )}
                ${renderChoice(
                  "status",
                  "ACTIVE",
                  "Ativo",
                  "Acesso liberado com credencial válida.",
                  isEditing && user.status === "ACTIVE"
                )}
                ${renderChoice(
                  "status",
                  "PENDING",
                  "Pendente",
                  "Aguardando ativação ou aceite.",
                  !isEditing || user.status === "PENDING"
                )}
                ${renderChoice(
                  "status",
                  "BLOCKED",
                  "Bloqueado",
                  "Sem novas autenticações.",
                  isEditing && user.status === "BLOCKED"
                )}
                ${renderChoice(
                  "status",
                  "INACTIVE",
                  "Inativo",
                  "Desativa logicamente a conta e preserva a auditoria.",
                  isEditing && user.status === "INACTIVE"
                )}
              </div>
              <div data-password-field style="margin-top:15px" hidden>
                ${renderInput(
                  "password",
                  "Senha temporária (deixe vazia para gerar)",
                  "",
                  {
                    type: "password",
                    autocomplete: "new-password",
                    maxLength: 160,
                    wide: true,
                  }
                )}
              </div>
            </section>
            <div class="users-form-actions">
              <a class="users-button users-button-secondary" href="${listPath}">Cancelar</a>
              <button class="users-button users-button-primary" type="submit" data-submit-user>
                ${isEditing ? "Salvar alterações" : "Criar usuário"}
              </button>
            </div>
          </div>
          <aside class="users-summary-card" data-editor-summary>
            ${renderEditorSummary({
              name: user.name,
              email: user.email,
              department: user.department,
              role: selectedRole,
              criticalCount,
            })}
          </aside>
        </div>
      </form>
    `;
    syncPasswordField();
  };

  const renderInput = (name, label, value, options = {}) => `
    <label class="users-field ${options.wide ? "users-field-wide" : ""}">
      <span>${escapeHtml(label)} ${options.required ? "<b>*</b>" : ""}</span>
      <input class="users-input" name="${escapeHtml(name)}"
        type="${escapeHtml(options.type || "text")}"
        value="${escapeHtml(value)}"
        ${options.required ? "required" : ""}
        ${options.readOnly ? "readonly" : ""}
        ${options.autocomplete ? `autocomplete="${escapeHtml(options.autocomplete)}"` : ""}
        ${options.maxLength ? `maxlength="${options.maxLength}"` : ""}
        ${options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : ""} />
      <small class="users-field-error" data-field-error="${escapeHtml(name)}"></small>
    </label>
  `;

  const renderChoice = (name, value, label, description, checked) => `
    <label class="users-choice">
      <input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${
        checked ? "checked" : ""
      } />
      <span>
        <strong>${escapeHtml(label)}</strong>
        <small>${escapeHtml(description)}</small>
      </span>
    </label>
  `;

  const renderEditorSummary = ({
    name,
    email,
    department,
    role,
    criticalCount,
  }) => `
    <h2>Resumo do usuário</h2>
    <div class="users-summary-person">
      <span class="users-avatar" aria-hidden="true">${escapeHtml(
        getInitials(name)
      )}</span>
      <span>
        <strong>${escapeHtml(normalizeText(name) || "Novo usuário")}</strong>
        <small>${escapeHtml(email || "E-mail ainda não informado")}</small>
      </span>
    </div>
    <div class="users-summary-list">
      <div class="users-summary-row"><span>Domínio</span><strong>${
        isSystem ? "SYSTEM" : "RESTAURANT"
      }</strong></div>
      <div class="users-summary-row"><span>Perfil</span><strong>${escapeHtml(
        role?.label || "Não selecionado"
      )}</strong></div>
      <div class="users-summary-row"><span>${
        isSystem ? "Área" : "Setor"
      }</span><strong>${escapeHtml(department || "Não informado")}</strong></div>
      <div class="users-summary-row"><span>Permissões</span><strong>${
        state.selectedPermissions.size
      } concedidas</strong></div>
      <div class="users-summary-row"><span>Sensíveis</span><strong>${criticalCount}</strong></div>
    </div>
    <div class="users-security-note">
      ${isSystem
        ? "Esta conta não receberá tenant, restaurante ou permissões tenant.*."
        : "Tenant e restaurante são vinculados pela sessão; campos enviados pelo cliente são rejeitados."}
    </div>
    ${
      criticalCount
        ? `<div class="users-sensitive-note"><strong>Atenção:</strong> ${criticalCount} permissão(ões) de risco alto ou crítico serão concedidas e auditadas.</div>`
        : ""
    }
  `;

  const updateEditorSummary = () => {
    const root = document.querySelector("[data-editor-summary]");
    const form = document.querySelector("[data-user-form]");
    if (!root || !form) return;
    const criticalCount = getPermissions().filter(
      (permission) =>
        state.selectedPermissions.has(permission.key) &&
        ["HIGH", "CRITICAL"].includes(permission.riskLevel)
    ).length;
    root.innerHTML = renderEditorSummary({
      name: form.elements.name?.value,
      email: form.elements.email?.value,
      department: form.elements.department?.value,
      role: getSelectedRoleDefinition(),
      criticalCount,
    });
  };

  const syncPermissionEditor = () => {
    const root = document.querySelector("[data-permission-editor]");
    if (root) root.innerHTML = renderPermissionEditor();
    updateEditorSummary();
  };

  const syncPasswordField = () => {
    const credential = document.querySelector(
      'input[name="credentialMode"]:checked'
    )?.value;
    const field = document.querySelector("[data-password-field]");
    if (field) field.hidden = credential !== "TEMPORARY_PASSWORD";
  };

  const applyPermissionToggle = (permissionKey, enabled) => {
    const definition = getPermissions().find(
      (permission) => permission.key === permissionKey
    );
    if (!definition) return;
    if (enabled) {
      state.selectedPermissions.add(permissionKey);
      (definition.dependencies || []).forEach((dependency) => {
        state.selectedPermissions.add(dependency);
      });
      if (definition.dependencies?.length) {
        notify("A permissão-base foi ativada automaticamente.");
      }
    } else {
      const selectedDependents = getPermissions().filter(
        (permission) =>
          state.selectedPermissions.has(permission.key) &&
          (permission.dependencies || []).includes(permissionKey)
      );
      if (
        selectedDependents.length &&
        !window.confirm(
          `Remover esta permissão-base também removerá ${selectedDependents.length} permissão(ões) dependente(s). Deseja continuar?`
        )
      ) {
        state.selectedPermissions.add(permissionKey);
        syncPermissionEditor();
        return;
      }
      state.selectedPermissions.delete(permissionKey);
      getPermissions().forEach((permission) => {
        if ((permission.dependencies || []).includes(permissionKey)) {
          state.selectedPermissions.delete(permission.key);
        }
      });
    }
    syncPermissionEditor();
  };

  const validateEditor = (form) => {
    const name = normalizeText(form.elements.name.value);
    const email = normalizeText(form.elements.email.value).toLowerCase();
    document.querySelectorAll("[data-field-error]").forEach((node) => {
      node.textContent = "";
    });
    if (name.length < 3) {
      document.querySelector('[data-field-error="name"]').textContent =
        "Informe o nome completo.";
      form.elements.name.focus();
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      document.querySelector('[data-field-error="email"]').textContent =
        "Informe um e-mail válido.";
      form.elements.email.focus();
      return false;
    }
    if (!state.selectedRole) {
      setFormError("Selecione um perfil de acesso.");
      return false;
    }
    return true;
  };

  const buildEditorPayload = (form) => {
    const role = getSelectedRoleDefinition();
    const basePermissions = new Set(role?.permissions || []);
    const selected = [...state.selectedPermissions];
    const grantOverrides = isSystem
      ? []
      : selected.filter((permission) => !basePermissions.has(permission));
    const denyOverrides = isSystem
      ? []
      : [...basePermissions].filter(
          (permission) => !state.selectedPermissions.has(permission)
        );
    const credentialMode =
      form.elements.credentialMode?.value ||
      state.selectedUser?.credentialMode ||
      "INVITE";
    return {
      name: normalizeText(form.elements.name.value),
      email: normalizeText(form.elements.email.value).toLowerCase(),
      phone: normalizeText(form.elements.phone.value),
      jobTitle: normalizeText(form.elements.jobTitle.value),
      department: normalizeText(form.elements.department.value),
      internalNote: normalizeText(form.elements.internalNote.value),
      role: state.selectedRole,
      status: form.elements.status?.value || "PENDING",
      credentialMode,
      password:
        credentialMode === "TEMPORARY_PASSWORD"
          ? form.elements.password?.value || ""
          : "",
      grantOverrides,
      denyOverrides,
    };
  };

  const submitEditor = async (form) => {
    if (state.submitting || !validateEditor(form)) return;
    state.submitting = true;
    const button = document.querySelector("[data-submit-user]");
    if (button) {
      button.disabled = true;
      button.textContent = "Salvando…";
    }
    const payload = buildEditorPayload(form);
    const identifier = state.selectedUser?.id || "";
    try {
      const response = await requestJson(
        identifier
          ? `${apiBase}/users/${encodeURIComponent(identifier)}`
          : `${apiBase}/users`,
        {
          method: identifier ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      );
      renderSuccess(response.data);
    } catch (error) {
      setFormError(error.message, error.field);
      if (button) {
        button.disabled = false;
        button.textContent = identifier ? "Salvar alterações" : "Criar usuário";
      }
    } finally {
      state.submitting = false;
    }
  };

  const renderSuccess = (data) => {
    const access = data?.access || null;
    const secret = access?.temporaryPassword || access?.invitationUrl || "";
    const secretLabel = access?.temporaryPassword
      ? "Senha temporária"
      : "Link de convite";
    app.innerHTML = `
      <nav class="users-breadcrumb"><a href="${listPath}">Usuários</a><span>/</span><strong>Concluído</strong></nav>
      <section class="users-success-panel">
        <span class="users-status is-active">Cadastro salvo</span>
        <h1>${escapeHtml(data?.user?.name || "Usuário criado")}</h1>
        <p>O vínculo, o perfil e as permissões foram validados no servidor.</p>
        ${
          secret
            ? `
              <div class="users-sensitive-note">
                <strong>Exibição única:</strong> copie agora. Este conteúdo não poderá ser recuperado em texto puro.
              </div>
              <div class="users-secret">
                <code data-one-time-secret>${escapeHtml(secret)}</code>
                <button class="users-button users-button-secondary" type="button" data-copy-secret data-secret-label="${escapeHtml(
                  secretLabel
                )}">Copiar</button>
              </div>
            `
            : `
              <div class="users-security-note">
                O convite foi registrado. O link não é exposto neste ambiente.
              </div>
            `
        }
        <div class="users-form-actions" style="margin-top:20px">
          <a class="users-button users-button-secondary" href="${listPath}">Voltar à lista</a>
          <a class="users-button users-button-primary" href="${listPath}/new">Criar outro</a>
        </div>
      </section>
    `;
  };

  const handleUserAction = async (id, action) => {
    const user = state.users.find((entry) => entry.id === id);
    if (!user) return;
    const isRestrictive = ["block", "deactivate"].includes(action);
    const actionLabel =
      {
        block: "bloquear",
        unblock: "desbloquear",
        deactivate: "desativar",
        activate: "reativar",
      }[action] || action;
    let reason = "";
    let revokeSessions = false;
    if (isRestrictive) {
      reason = normalizeText(
        window.prompt(
          `Informe o motivo para ${actionLabel} ${user.name}. Esta informação será auditada:`
        )
      );
      if (!reason) {
        notify("A ação foi cancelada: o motivo é obrigatório.");
        return;
      }
      revokeSessions = window.confirm(
        "Revogar também todas as sessões ativas deste usuário? Selecione Cancelar para manter as sessões existentes."
      );
    } else if (
      !window.confirm(
        `${actionLabel[0].toUpperCase()}${actionLabel.slice(1)} ${user.name}?`
      )
    ) {
      return;
    }
    try {
      await requestJson(
        `${apiBase}/users/${encodeURIComponent(id)}/${action}`,
        {
          method: "POST",
          body: JSON.stringify({
            reason,
            revokeSessions,
          }),
        }
      );
      dialog?.close();
      await loadUsers();
      renderList();
      notify(`Usuário ${actionLabel} com sucesso.`);
    } catch (error) {
      notify(error.message);
    }
  };

  const resendInvitation = async (id) => {
    try {
      const response = await requestJson(
        `${apiBase}/users/${encodeURIComponent(id)}/invite/resend`,
        { method: "POST", body: "{}" }
      );
      const invitationUrl =
        response?.data?.invitation?.url ||
        response?.data?.invitationUrl ||
        "";
      dialog?.close();
      await loadUsers();
      renderList();
      notify(
        invitationUrl
          ? "Novo convite gerado. Abra novamente os detalhes para copiar quando permitido."
          : "Convite reenviado e token anterior invalidado."
      );
    } catch (error) {
      notify(error.message);
    }
  };

  const revokeUserSessions = async (id) => {
    const user = state.users.find((entry) => entry.id === id);
    if (!user) return;
    const reason = normalizeText(
      window.prompt(
        `Informe o motivo para encerrar todas as sessões de ${user.name}:`
      )
    );
    if (!reason) {
      notify("A ação foi cancelada: o motivo é obrigatório.");
      return;
    }
    if (
      !window.confirm(
        "As sessões ativas serão encerradas imediatamente. Deseja continuar?"
      )
    ) {
      return;
    }
    try {
      const response = await requestJson(
        `${apiBase}/users/${encodeURIComponent(id)}/sessions/revoke`,
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        }
      );
      const count = Number(response?.data?.revokedSessions || 0);
      dialog?.close();
      notify(
        count
          ? `${count} sessão(ões) encerrada(s).`
          : "Nenhuma sessão ativa foi encontrada."
      );
    } catch (error) {
      notify(error.message);
    }
  };

  const exitSupport = async () => {
    try {
      await requestJson("/api/support/revoke", {
        method: "POST",
        body: "{}",
      });
      window.location.assign("/system");
    } catch (error) {
      notify(error.message);
    }
  };

  document.addEventListener("input", (event) => {
    const filter = event.target.closest("[data-filter]");
    if (filter) {
      state.filters[filter.dataset.filter] = filter.value;
      state.page = 1;
      renderList();
      document.querySelector(`[data-filter="${filter.dataset.filter}"]`)?.focus();
      return;
    }
    if (event.target.closest("[data-user-form]")) {
      updateEditorSummary();
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches('input[name="role"]')) {
      const previousRole = state.selectedRole;
      const nextRole = event.target.value;
      const nextPermissions = new Set(getRole(nextRole)?.permissions || []);
      const removedPermissions = [...state.selectedPermissions].filter(
        (permission) => !nextPermissions.has(permission)
      );
      if (
        mode === "edit" &&
        previousRole &&
        previousRole !== nextRole &&
        removedPermissions.length &&
        !window.confirm(
          `Alterar de ${getRole(previousRole)?.label || previousRole} para ${
            getRole(nextRole)?.label || nextRole
          } removerá ${removedPermissions.length} permissão(ões). Deseja continuar?`
        )
      ) {
        const previousInput = document.querySelector(
          `input[name="role"][value="${CSS.escape(previousRole)}"]`
        );
        if (previousInput) previousInput.checked = true;
        return;
      }
      state.selectedRole = nextRole;
      resetPermissionsForRole(state.selectedRole);
      syncPermissionEditor();
      return;
    }
    if (event.target.matches('input[name="permission"]')) {
      applyPermissionToggle(event.target.value, event.target.checked);
      return;
    }
    if (event.target.matches('input[name="credentialMode"]')) {
      syncPasswordField();
      updateEditorSummary();
    }
  });

  document.addEventListener("submit", (event) => {
    if (event.target.matches("[data-user-form]")) {
      event.preventDefault();
      submitEditor(event.target);
    }
  });

  document.addEventListener("click", async (event) => {
    const clear = event.target.closest("[data-clear-filters]");
    if (clear) {
      state.filters = {
        search: "",
        role: "",
        status: "",
        department: "",
        source: "",
        created: "",
        access: "",
        invite: "",
        customized: "",
        sort: "name",
      };
      state.page = 1;
      renderList();
      return;
    }
    const stat = event.target.closest("[data-summary-filter]");
    if (stat) {
      const key = stat.dataset.summaryFilter;
      if (key === "__authority__") {
        state.filters.role = isSystem ? "MASTER" : "OWNER";
        state.filters.status = "";
      } else {
        state.filters.status =
          state.filters.status === key ? "" : key;
        state.filters.role = "";
      }
      state.page = 1;
      renderList();
      return;
    }
    const pageButton = event.target.closest("[data-page]");
    if (pageButton) {
      state.page = Math.max(1, Number(pageButton.dataset.page || 1));
      renderList();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const viewButton = event.target.closest("[data-user-view-id]");
    if (viewButton) {
      const user = state.users.find(
        (entry) => entry.id === viewButton.dataset.userViewId
      );
      if (user) renderUserDialog(user);
      return;
    }
    if (event.target.closest("[data-dialog-close]")) {
      dialog?.close();
      return;
    }
    const toggle = event.target.closest("[data-user-toggle]");
    if (toggle) {
      await handleUserAction(
        toggle.dataset.userToggle,
        toggle.dataset.nextAction
      );
      return;
    }
    const resend = event.target.closest("[data-user-resend]");
    if (resend) {
      await resendInvitation(resend.dataset.userResend);
      return;
    }
    const revokeSessions = event.target.closest(
      "[data-user-sessions-revoke]"
    );
    if (revokeSessions) {
      await revokeUserSessions(revokeSessions.dataset.userSessionsRevoke);
      return;
    }
    if (event.target.closest("[data-support-exit]")) {
      await exitSupport();
      return;
    }
    const copy = event.target.closest("[data-copy-secret]");
    if (copy) {
      const secret = document.querySelector("[data-one-time-secret]")?.textContent;
      if (secret) {
        await navigator.clipboard.writeText(secret);
        notify(`${copy.dataset.secretLabel || "Conteúdo"} copiado.`);
      }
    }
  });

  const init = async () => {
    try {
      await loadSession();
      renderSidebar();
      renderSupportBanner();
      await Promise.all([loadPolicy(), loadUsers()]);
      if (view === "editor") {
        initializeEditorState();
        renderEditor();
      } else {
        renderList();
      }
    } catch (error) {
      renderFatal(error);
    }
  };

  init();
})();
