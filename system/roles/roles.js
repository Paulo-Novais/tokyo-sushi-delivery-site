(() => {
  "use strict";

  const app = document.querySelector("[data-roles-app]");
  const sidebar = document.querySelector("[data-roles-sidebar]");
  const toast = document.querySelector("[data-roles-toast]");
  const state = {
    session: null,
    domain: "SYSTEM",
    policy: null,
    selectedKey: "",
    editingNew: false,
    search: "",
  };

  const MODULE_LABELS = Object.freeze({
    dashboard: "Painel",
    restaurants: "Restaurantes",
    plans: "Planos",
    domains: "Domínios",
    health: "Saúde",
    audit: "Auditoria",
    integrations: "Integrações",
    users: "Usuários",
    roles: "Perfis e permissões",
    support: "Suporte",
    billing: "Faturamento",
    settings: "Configurações",
    orders: "Pedidos",
    customers: "Clientes",
    catalog: "Cardápio",
    promotions: "Promoções",
    reviews: "Avaliações",
    inventory: "Estoque",
    financial: "Financeiro",
    delivery: "Entregas",
    reports: "Relatórios",
    cash_register: "Caixa",
    business_hours: "Horários de funcionamento",
    special_dates: "Datas especiais",
  });

  const ACTION_LABELS = Object.freeze({
    view: "Visualizar",
    manage: "Administrar",
    create: "Criar",
    edit: "Editar",
    delete: "Excluir",
    suspend: "Suspender",
    start: "Iniciar",
    admin: "Administrar",
    export: "Exportar",
    refund: "Estornar",
    cancel: "Cancelar",
    configure: "Configurar",
    open: "Abrir",
    close: "Fechar",
    open_tab: "Abrir comanda",
    add_item: "Adicionar item",
    send_order: "Enviar pedido",
    discount: "Aplicar desconto",
    remove_service: "Remover serviço",
    close_tab: "Fechar conta",
    confirm_payment: "Confirmar pagamento",
    history: "Visualizar histórico",
    permissions: "Alterar permissões",
  });

  const NAVIGATION_LABELS = Object.freeze({
    dashboard: "Painel",
    users: "Usuários",
    cash_register: "Caixa",
    orders: "Pedidos",
    catalog: "Cardápio",
    scheduled: "Agendamentos",
    delivery: "Entregas",
    customers: "Clientes",
    promotions: "Promoções",
    metrics: "Métricas",
    reports: "Relatórios",
    financial: "Financeiro",
    reviews: "Avaliações",
    settings: "Configurações",
    inventory: "Estoque",
    printing: "Impressão",
    production: "Produção",
    tables: "Mesas",
    dining_room: "Salão",
    delivery_channel: "Delivery",
    loyalty: "Fidelidade",
    coupons: "Cupons",
    marketing: "Marketing",
    api: "API",
    integrations: "Integrações",
  });

  const ROLE_LABELS = Object.freeze({
    MASTER: "Master",
    ADMINISTRADOR: "Administrador",
    SOCIO: "Sócio",
    SUPORTE: "Suporte",
    FINANCEIRO_INOVAS: "Financeiro",
    DESENVOLVEDOR: "Desenvolvedor",
    AUDITOR: "Auditoria",
  });

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const requestJson = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      const error = new Error(
        payload?.error?.message || payload?.error || "Não foi possível concluir a operação."
      );
      error.status = response.status;
      throw error;
    }
    return payload;
  };

  const notify = (message) => {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => {
      toast.hidden = true;
    }, 3600);
  };

  const hasPermission = (permission) =>
    new Set(state.session?.effectivePermissions || []).has(permission);

  const renderSidebar = () => {
    const links = [
      ["Visão geral", "/system", "VI", "system.dashboard.view"],
      ["Restaurantes", "/system#restaurants", "RE", "system.restaurants.view"],
      ["Saúde", "/system#health", "SA", "system.health.view"],
      ["Integrações", "/system#integrations", "IN", "system.integrations.view"],
      ["Usuários INOVAS", "/system/users", "US", "system.users.view"],
      ["Perfis e permissões", "/system/roles", "PE", "system.roles.view"],
      ["Auditoria", "/system#audit", "AU", "system.audit.view"],
      ["Suporte", "/system#support", "SU", "system.support.start"],
      ["Configurações", "/system#settings", "CO", "system.settings.view"],
    ];
    sidebar.innerHTML = `
      <a class="users-brand" href="/system">
        <img src="/assets/inovas-food-logo-oficial.png" alt="INOVAS Food" />
        <span class="users-brand-copy"><small>Plataforma</small><strong>Painel System</strong></span>
      </a>
      <nav class="users-nav" aria-label="Navegação principal">
        ${links.filter(([, , , permission]) => hasPermission(permission))
          .map(
            ([label, href, icon]) => `
              <a href="${href}" ${label === "Perfis e permissões" ? 'aria-current="page"' : ""}>
                <span class="users-nav-icon" aria-hidden="true">${icon}</span>${escapeHtml(label)}
              </a>`
          )
          .join("")}
      </nav>
      <div class="users-sidebar-foot">
        <div class="users-sidebar-account">
          <strong>${escapeHtml(state.session.displayName || state.session.login)}</strong>
          <span>${escapeHtml(ROLE_LABELS[state.session.role] || "Perfil administrativo")} · sem restaurante vinculado</span>
        </div>
        <button class="users-logout" type="button" data-roles-logout>
          <span class="users-nav-icon" aria-hidden="true">↪</span><span>Sair</span>
        </button>
      </div>`;
  };

  const selectedRole = () =>
    state.policy?.roles?.find((role) => role.key === state.selectedKey) || null;

  const groupPermissions = () => {
    const groups = new Map();
    for (const permission of state.policy?.permissions || []) {
      if (!groups.has(permission.module)) groups.set(permission.module, []);
      groups.get(permission.module).push(permission);
    }
    return groups;
  };

  const render = () => {
    const role = selectedRole();
    const selected = new Set(role?.permissions || []);
    const query = state.search.toLowerCase();
    const canManage = hasPermission("system.roles.manage");
    app.innerHTML = `
      <nav class="users-breadcrumb"><a href="/system">Sistema</a><span>/</span><strong>Perfis e permissões</strong></nav>
      <header class="users-page-head">
        <div>
          <span class="users-eyebrow">Controle de acesso · matriz administrável</span>
          <h1>Perfis e permissões</h1>
          <p>Perfis agrupam permissões independentes. Alterações passam a valer na próxima validação de sessão.</p>
        </div>
        ${canManage ? '<button class="users-button users-button-primary" type="button" data-role-new>+ Novo perfil</button>' : ""}
      </header>
      <div class="roles-domain-tabs" role="tablist" aria-label="Grupo de usuários">
        <button type="button" data-role-domain="SYSTEM" class="${state.domain === "SYSTEM" ? "is-active" : ""}">Usuários INOVAS</button>
        <button type="button" data-role-domain="RESTAURANT" class="${state.domain === "RESTAURANT" ? "is-active" : ""}">Usuários de restaurante</button>
      </div>
      <div class="roles-layout">
        <aside class="users-panel roles-list">
          <div class="users-filter-meta"><strong>${state.domain === "SYSTEM" ? "Perfis INOVAS" : "Perfis de restaurante"}</strong><span>${state.policy?.roles?.length || 0}</span></div>
          ${(state.policy?.roles || [])
            .map(
              (entry) => `
                <button type="button" data-role-select="${escapeHtml(entry.key)}" class="roles-list-item ${entry.key === state.selectedKey ? "is-active" : ""}">
                  <span><strong>${escapeHtml(entry.label)}</strong><small>${entry.custom ? "Perfil personalizado" : "Perfil padrão"}</small></span>
                  <span><b>${entry.userCount || 0}</b><small>usuário(s)</small></span>
                </button>`
            )
            .join("")}
        </aside>
        <form class="users-panel roles-editor" data-role-form>
          <div class="roles-editor-head">
            <div><span class="users-eyebrow">${state.editingNew ? "Novo perfil" : canManage ? "Editar perfil" : "Consultar perfil"}</span><h2>${escapeHtml(role?.label || "Novo perfil")}</h2></div>
            ${role && canManage ? `<button class="users-button users-button-secondary" type="button" data-role-duplicate>Duplicar</button>` : ""}
          </div>
          <div class="users-form-grid">
            ${role && !state.editingNew ? `<input type="hidden" name="key" value="${escapeHtml(role.key)}" /><label class="users-field"><span>Identificador interno</span><input value="Mantido pelo sistema" readonly /></label>` : '<label class="users-field"><span>Identificador interno</span><input name="key" placeholder="EX.: GERENTE_REGIONAL" required /></label>'}
            <label class="users-field"><span>Nome</span><input name="label" value="${escapeHtml(role?.label || "")}" placeholder="Nome do perfil" ${canManage ? "" : "readonly"} required /></label>
            <label class="users-field"><span>Nível de autoridade (0–100)</span><input name="authority" type="number" min="0" max="100" value="${escapeHtml(role?.authority ?? 10)}" ${canManage ? "" : "readonly"} required /></label>
            <label class="users-field"><span>Pesquisar permissão</span><input name="permissionSearch" value="${escapeHtml(state.search)}" placeholder="Módulo, ação ou descrição" /></label>
          </div>
          ${state.domain === "RESTAURANT" ? `
            <section class="roles-navigation-permissions">
              <div class="roles-section-heading"><div><span class="users-eyebrow">Visibilidade do menu</span><h3>Menus visíveis no restaurante</h3><p>Marcado: o menu aparece para o usuário. Desmarcado: o menu fica oculto.</p></div><span>${(state.policy?.permissions || []).filter((permission) => permission.module === "navigation").length} itens</span></div>
              <div class="roles-navigation-grid">
                ${(state.policy?.permissions || []).filter((permission) => permission.module === "navigation").map((permission) => `<label class="roles-navigation-option"><input type="checkbox" name="permission" value="${escapeHtml(permission.key)}" ${selected.has(permission.key) ? "checked" : ""} ${canManage ? "" : "disabled"} /><span><strong>${escapeHtml(NAVIGATION_LABELS[permission.action] || "Item de menu")}</strong><small>${escapeHtml(permission.description)}</small></span></label>`).join("")}
              </div>
            </section>` : ""}
          <div class="roles-section-heading"><div><span class="users-eyebrow">Permissões funcionais</span><h3>${state.domain === "SYSTEM" ? "Permissões do Sistema" : "Permissões do restaurante"}</h3><p>Controlam as ações permitidas dentro de cada área.</p></div></div>
          <div class="roles-permission-groups">
            ${[...groupPermissions().entries()]
              .filter(([module]) => module !== "navigation")
              .map(([module, permissions]) => {
                const visible = permissions.filter((permission) =>
                  `${module} ${permission.action} ${permission.key} ${permission.description}`.toLowerCase().includes(query)
                );
                if (!visible.length) return "";
                return `<fieldset><legend>${escapeHtml(MODULE_LABELS[module] || "Área administrativa")}</legend>${visible
                  .map(
                    (permission) => `<label class="roles-permission" data-permission-search="${escapeHtml(`${module} ${permission.action} ${permission.key} ${permission.description}`.toLowerCase())}"><input type="checkbox" name="permission" value="${escapeHtml(permission.key)}" data-dependencies="${escapeHtml(JSON.stringify(permission.dependencies || []))}" ${selected.has(permission.key) ? "checked" : ""} ${canManage ? "" : "disabled"} /><span><strong>${escapeHtml(ACTION_LABELS[permission.action] || "Ação administrativa")}</strong><small>${escapeHtml(permission.description)}</small></span></label>`
                  )
                  .join("")}</fieldset>`;
              })
              .join("")}
          </div>
          <div class="roles-actions">
            ${canManage && role?.custom ? `<button class="users-button users-button-secondary" type="button" data-role-remove>Remover perfil</button>` : "<span></span>"}
            ${canManage ? '<button class="users-button users-button-primary" type="submit">Salvar permissões</button>' : '<span class="users-security-note">Consulta permitida; alterações exigem permissão administrativa.</span>'}
          </div>
        </form>
      </div>`;
  };

  const loadPolicy = async (domain = state.domain) => {
    state.domain = domain;
    const payload = await requestJson(`/api/system/roles?domain=${encodeURIComponent(domain)}`);
    state.policy = payload.data;
    if (!state.policy.roles.some((role) => role.key === state.selectedKey)) {
      state.selectedKey = state.policy.roles[0]?.key || "";
    }
    state.editingNew = false;
    render();
  };

  const submitRole = async (form) => {
    if (!hasPermission("system.roles.manage")) {
      notify("Seu perfil possui acesso somente para consulta.");
      return;
    }
    const data = new FormData(form);
    const key = String(data.get("key") || "").trim().toUpperCase();
    const body = {
      key,
      label: String(data.get("label") || "").trim(),
      authority: Number(data.get("authority") || 0),
      permissions: data.getAll("permission"),
    };
    const editing = !state.editingNew && Boolean(selectedRole());
    await requestJson(
      editing
        ? `/api/system/roles/${encodeURIComponent(state.selectedKey)}?domain=${state.domain}`
        : `/api/system/roles?domain=${state.domain}`,
      { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) }
    );
    state.selectedKey = key;
    await loadPolicy();
    notify("Perfil e matriz de permissões salvos.");
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index) || "";
        if (/auth|session|token|support/i.test(key)) storage.removeItem(key);
      }
    }
    window.location.replace("/system/login.html");
  };

  document.addEventListener("click", async (event) => {
    const domain = event.target.closest("[data-role-domain]");
    if (domain) return void loadPolicy(domain.dataset.roleDomain);
    const select = event.target.closest("[data-role-select]");
    if (select) {
      state.selectedKey = select.dataset.roleSelect;
      state.editingNew = false;
      return render();
    }
    if (event.target.closest("[data-role-new]")) {
      if (!hasPermission("system.roles.manage")) return;
      state.selectedKey = "";
      state.editingNew = true;
      return render();
    }
    if (event.target.closest("[data-role-duplicate]")) {
      if (!hasPermission("system.roles.manage")) return;
      const role = selectedRole();
      const key = window.prompt("Chave do novo perfil", `${role.key}_COPIA`);
      if (!key) return;
      const label = window.prompt("Nome do novo perfil", `${role.label} (cópia)`);
      if (!label) return;
      await requestJson(`/api/system/roles/${encodeURIComponent(role.key)}/duplicate?domain=${state.domain}`, {
        method: "POST",
        body: JSON.stringify({ key, label }),
      });
      state.selectedKey = key.trim().toUpperCase();
      await loadPolicy();
      return notify("Perfil duplicado.");
    }
    if (event.target.closest("[data-role-remove]")) {
      if (!hasPermission("system.roles.manage")) return;
      const role = selectedRole();
      if (!role || !window.confirm(`Remover o perfil personalizado ${role.label}?`)) return;
      await requestJson(`/api/system/roles/${encodeURIComponent(role.key)}?domain=${state.domain}`, { method: "DELETE" });
      state.selectedKey = "";
      await loadPolicy();
      return notify("Perfil personalizado removido.");
    }
    if (event.target.closest("[data-roles-logout]")) return void logout();
  });

  document.addEventListener("input", (event) => {
    if (event.target.name === "permissionSearch") {
      state.search = event.target.value.toLowerCase();
      document.querySelectorAll(".roles-permission").forEach((permission) => {
        permission.hidden = !permission.dataset.permissionSearch.includes(state.search);
      });
      document.querySelectorAll(".roles-permission-groups fieldset").forEach((group) => {
        group.hidden = !group.querySelector(".roles-permission:not([hidden])");
      });
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.name !== "permission" || !event.target.checked) return;
    const dependencies = JSON.parse(event.target.dataset.dependencies || "[]");
    for (const dependency of dependencies) {
      const checkbox = document.querySelector(`input[name="permission"][value="${CSS.escape(dependency)}"]`);
      if (checkbox) checkbox.checked = true;
    }
  });

  document.addEventListener("submit", async (event) => {
    if (!event.target.matches("[data-role-form]")) return;
    event.preventDefault();
    try {
      await submitRole(event.target);
    } catch (error) {
      notify(error.message);
    }
  });

  const init = async () => {
    try {
      const sessionPayload = await requestJson("/api/auth/system/session");
      state.session = sessionPayload?.data?.session;
      if (!sessionPayload.authenticated || !state.session) throw Object.assign(new Error("Sessão administrativa obrigatória."), { status: 401 });
      renderSidebar();
      await loadPolicy();
    } catch (error) {
      if (error.status === 401) return window.location.replace("/system/login.html");
      app.innerHTML = `<section class="users-panel users-error"><div><span class="users-avatar">!</span><h2>Não foi possível abrir a matriz</h2><p>${escapeHtml(error.message)}</p></div></section>`;
    }
  };

  void init();
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) void init();
  });
})();
