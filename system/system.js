(() => {
  "use strict";

  const app = document.querySelector("[data-system-app]");
  const sidebar = document.querySelector("[data-system-sidebar]");
  const toast = document.querySelector("[data-users-toast]");
  const dialog = document.querySelector("[data-system-dialog]");
  const state = { session: null, routeData: null };

  const NAVIGATION = Object.freeze([
    { key: "overview", label: "Visão geral", href: "/system", icon: "VI", permission: "system.dashboard.view", endpoint: "/api/system/overview" },
    { key: "restaurants", label: "Restaurantes", href: "/system#restaurants", icon: "RE", permission: "system.restaurants.view", endpoint: "/api/system/restaurants" },
    { key: "health", label: "Saúde", href: "/system#health", icon: "SA", permission: "system.health.view", endpoint: "/api/system/health" },
    { key: "integrations", label: "Integrações", href: "/system#integrations", icon: "IN", permission: "system.integrations.view", endpoint: "/api/system/integrations" },
    { key: "users", label: "Usuários INOVAS", href: "/system/users", icon: "US", permission: "system.users.view", external: true },
    { key: "roles", label: "Perfis e permissões", href: "/system/roles", icon: "PE", permission: "system.roles.view", external: true },
    { key: "audit", label: "Auditoria", href: "/system#audit", icon: "AU", permission: "system.audit.view", endpoint: "/api/system/audit" },
    { key: "support", label: "Suporte", href: "/system#support", icon: "SU", permission: "system.support.start", endpoint: "/api/system/support" },
    { key: "settings", label: "Configurações", href: "/system#settings", icon: "CO", permission: "system.settings.view", endpoint: "/api/system/settings" },
  ]);

  const STATUS_LABELS = Object.freeze({
    HEALTHY: "Saudável",
    ONLINE: "Online",
    DEGRADED: "Degradado",
    OFFLINE: "Fora do ar",
    ACTIVE: "Ativo",
    ATIVO: "Ativo",
    INACTIVE: "Inativo",
    BLOCKED: "Bloqueado",
    PENDING: "Pendente",
    PENDING_VERIFICATION: "Aguardando verificação",
    CLIENTE_MODELO: "Cliente modelo",
    PILOT: "Piloto",
    TRIAL: "Avaliação",
    CONFIGURED: "Configurado",
    CURRENT: "Atual",
    PARTIAL: "Parcial",
    NOT_CONFIGURED: "Não configurado",
    NOT_REGISTERED: "Não cadastrado",
    NOT_IMPLEMENTED: "Não implementado",
    UNKNOWN: "Não informado",
    SUCCESS: "Concluído",
    FAILED: "Falhou",
    ERROR: "Erro",
    REVOKED: "Encerrado",
    VIEW: "Visualização",
    ADMIN: "Administrativo",
    FILE: "Arquivo local",
    NEON: "Banco Neon",
    DISABLED: "Desativado",
  });

  const EVENT_LABELS = Object.freeze({
    SUPPORT_SESSION_STARTED: "Sessão de suporte iniciada",
    SUPPORT_SESSION_REVOKED: "Sessão de suporte encerrada",
    SYSTEM_USER_CREATED: "Usuário INOVAS criado",
    SYSTEM_USER_UPDATED: "Usuário INOVAS atualizado",
    SYSTEM_USER_BLOCKED: "Usuário INOVAS bloqueado",
    SYSTEM_USER_DEACTIVATED: "Usuário INOVAS desativado",
    SYSTEM_USER_ACTIVATED: "Usuário INOVAS ativado",
    SYSTEM_USER_SESSIONS_REVOKED: "Sessões do usuário encerradas",
    SYSTEM_USER_INVITATION_REISSUED: "Convite do usuário reenviado",
    ROLE_CREATED: "Perfil criado",
    ROLE_UPDATED: "Perfil atualizado",
    ROLE_DUPLICATED: "Perfil duplicado",
    ROLE_DEACTIVATED: "Perfil removido",
    IDENTITY_SCOPE_RECOVERED: "Vínculo de identidade restaurado",
    SYSTEM_MASTER_RBAC_REPAIRED: "Permissões do perfil Master restauradas",
  });

  const ROLE_LABELS = Object.freeze({
    MASTER: "Master",
    ADMINISTRADOR: "Administrador",
    SUPORTE: "Suporte",
    FINANCEIRO_INOVAS: "Financeiro",
    DESENVOLVEDOR: "Desenvolvedor",
    AUDITOR: "Auditoria",
    SYSTEM: "Sistema",
    RESTAURANT: "Restaurante",
    SUPPORT: "Suporte",
    MIGRATION: "Migração",
    PLATFORM: "Plataforma",
  });

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const normalizeStatus = (value) => String(value || "UNKNOWN").trim().toUpperCase();
  const translateStatus = (value) => STATUS_LABELS[normalizeStatus(value)] || "Não informado";
  const translateRole = (value) => ROLE_LABELS[normalizeStatus(value)] || String(value || "Perfil personalizado");
  const translateEvent = (value) => EVENT_LABELS[normalizeStatus(value)] || "Evento administrativo";
  const translatePlan = (value) => ({ PREMIUM: "Premium", TRIAL: "Avaliação", FREE: "Gratuito", BASIC: "Básico", ENTERPRISE: "Empresarial" })[normalizeStatus(value)] || String(value || "Não informado");
  const translateRestaurantMode = (value) => ({ DEFAULT_ONLY: "Somente restaurante padrão", PATH_PRIMARY: "Endereço por caminho", CUSTOM_DOMAIN: "Domínio personalizado", SUBDOMAIN: "Subdomínio" })[normalizeStatus(value)] || (value ? "Modo configurado" : "Não informado");
  const statusClass = (value) => {
    const status = normalizeStatus(value);
    if (["HEALTHY", "ONLINE", "ACTIVE", "ATIVO", "CONFIGURED", "CURRENT", "SUCCESS", "CLIENTE_MODELO", "PILOT", "TRIAL"].includes(status)) return "is-active";
    if (["DEGRADED", "PARTIAL", "PENDING", "PENDING_VERIFICATION"].includes(status)) return "is-pending";
    if (["FAILED", "ERROR", "OFFLINE", "BLOCKED"].includes(status)) return "is-blocked";
    return "";
  };

  const formatDate = (value) => {
    if (!value) return "Nunca";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Não informado"
      : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
  };

  const getInitials = (value) =>
    String(value || "RE")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase();

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
      const error = new Error(payload?.error?.message || "Não foi possível concluir a solicitação.");
      error.status = response.status;
      throw error;
    }
    return payload;
  };

  const notify = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => { toast.hidden = true; }, 4200);
  };

  const getPermissions = () => new Set(state.session?.effectivePermissions || []);
  const hasPermission = (permission) => getPermissions().has(permission);
  const visibleNavigation = () => NAVIGATION.filter((item) => hasPermission(item.permission));
  const getRouteKey = () => {
    const key = window.location.hash.replace(/^#/, "").split("?")[0].trim();
    return key || "overview";
  };

  const renderSidebar = () => {
    const routeKey = getRouteKey();
    sidebar.innerHTML = `
      <a class="users-brand" href="/system">
        <img src="/assets/inovas-food-logo-oficial.png" alt="INOVAS Food" />
        <span class="users-brand-copy"><small>Plataforma</small><strong>Painel System</strong></span>
      </a>
      <nav class="users-nav" aria-label="Navegação principal">
        ${visibleNavigation().map((item) => `
          <a href="${item.href}" ${item.key === routeKey || (item.key === "overview" && routeKey === "") ? 'aria-current="page"' : ""}>
            <span class="users-nav-icon" aria-hidden="true">${item.icon}</span>${escapeHtml(item.label)}
          </a>`).join("")}
      </nav>
      <div class="users-sidebar-foot">
        <div class="users-sidebar-account">
          <strong>${escapeHtml(state.session.displayName || state.session.login)}</strong>
          <span>${escapeHtml(translateRole(state.session.role))} · sem restaurante vinculado</span>
        </div>
        <button class="users-logout" type="button" data-system-logout>
          <span class="users-nav-icon" aria-hidden="true">↪</span><span>Sair</span>
        </button>
      </div>`;
  };

  const renderLoading = (label) => {
    app.innerHTML = `<div class="users-loading"><span class="users-spinner" aria-hidden="true"></span><span>Carregando ${escapeHtml(label.toLowerCase())}…</span></div>`;
  };

  const renderPageHead = ({ eyebrow, title, description, action = "" }) => `
    <nav class="users-breadcrumb"><a href="/system">Sistema</a><span>/</span><strong>${escapeHtml(title)}</strong></nav>
    <header class="users-page-head">
      <div><span class="users-eyebrow">${escapeHtml(eyebrow)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>
      ${action}
    </header>`;

  const renderStatus = (status) => `<span class="users-status ${statusClass(status)}">${escapeHtml(translateStatus(status))}</span>`;

  const renderAuditRows = (events, limit = events.length) => {
    const visible = events.slice(0, limit);
    if (!visible.length) return '<div class="users-empty"><div><h2>Nenhum evento registrado</h2><p>A trilha aparecerá quando ocorrer uma ação administrativa.</p></div></div>';
    return `<div class="system-table-wrap"><table class="system-table"><thead><tr><th>Data</th><th>Evento</th><th>Responsável</th><th>Escopo</th><th>Resultado</th></tr></thead><tbody>
      ${visible.map((event) => `<tr>
        <td>${escapeHtml(formatDate(event.createdAt))}</td>
        <td><strong>${escapeHtml(translateEvent(event.eventType))}</strong>${event.reason ? `<small>${escapeHtml(event.reason)}</small>` : ""}</td>
        <td>${escapeHtml(event.actorName || event.actorLogin || translateRole(event.actorType))}</td>
        <td>${escapeHtml(event.restaurantId ? "Restaurante" : "Plataforma")}</td>
        <td>${renderStatus(event.result)}</td>
      </tr>`).join("")}</tbody></table></div>`;
  };

  const renderOverview = (data) => {
    const summary = data.health?.summary || {};
    const overview = data.overview || {};
    app.innerHTML = `
      ${renderPageHead({ eyebrow: "Plataforma · visão administrativa", title: "Visão geral", description: "Acompanhamento administrativo e técnico da INOVAS Food, sem conteúdo operacional dos restaurantes.", action: hasPermission("system.users.view") ? '<a class="users-button users-button-primary" href="/system/users">Usuários INOVAS</a>' : "" })}
      <section class="system-health-grid" aria-label="Indicadores da plataforma">
        ${[
          ["Estado da plataforma", translateStatus(summary.status), "Última verificação consolidada"],
          ["Restaurantes", overview.restaurants?.total || 0, `${overview.restaurants?.active || 0} ativos`],
          ["Integrações configuradas", overview.integrations?.configured || 0, `${overview.integrations?.attention || 0} requerem atenção`],
          ["Sessões de suporte", overview.activeSupportSessions || 0, "Ativas para esta conta"],
        ].map(([label, value, helper]) => `<article class="system-health-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(helper)}</small></article>`).join("")}
      </section>
      <div class="system-dashboard-grid">
        <section class="users-panel">
          <div class="users-filter-meta"><strong>Acessos rápidos</strong><span>Somente áreas permitidas</span></div>
          <div class="system-quick-grid">${visibleNavigation().filter((item) => !item.external && item.key !== "overview").map((item) => `<a href="${item.href}"><span class="users-nav-icon">${item.icon}</span><strong>${escapeHtml(item.label)}</strong><small>Abrir área administrativa</small></a>`).join("")}</div>
        </section>
        <section class="users-panel">
          <div class="users-filter-meta"><strong>Atividade recente</strong>${hasPermission("system.audit.view") ? '<a href="/system#audit">Ver auditoria</a>' : ""}</div>
          ${renderAuditRows(overview.recentAuditEvents || [], 6)}
        </section>
      </div>`;
  };

  const renderRestaurants = (data) => {
    const restaurants = data.restaurants || [];
    app.innerHTML = `
      ${renderPageHead({ eyebrow: "Restaurantes · administração", title: "Restaurantes", description: "Cadastro, responsável, plano e saúde cadastral dos restaurantes existentes." })}
      <section class="system-restaurant-grid">
        ${restaurants.map((restaurant) => `<article class="users-panel system-restaurant-card">
          <header><span class="system-restaurant-logo"><span aria-hidden="true">${escapeHtml(getInitials(restaurant.name))}</span><img src="${escapeHtml(restaurant.logo)}" alt="Logo de ${escapeHtml(restaurant.name)}" hidden onload="this.hidden=false" onerror="this.hidden=true" /></span><div><span class="users-eyebrow">${escapeHtml(restaurant.slug)}</span><h2>${escapeHtml(restaurant.name)}</h2><div class="users-badges">${renderStatus(restaurant.status)}${restaurant.health ? renderStatus(restaurant.health.status) : '<span class="users-status">Saúde não aferida</span>'}</div></div></header>
          <dl class="system-detail-list">
            <div><dt>Slug</dt><dd>${escapeHtml(restaurant.slug || "Não informado")}</dd></div>
            <div><dt>Plano</dt><dd>${escapeHtml(translatePlan(restaurant.plan))}</dd></div>
            <div><dt>Domínio</dt><dd>${escapeHtml(restaurant.domain || "Não configurado")}</dd></div>
            <div><dt>Proprietário</dt><dd>${escapeHtml(restaurant.owner || "Não informado")}</dd></div>
            <div><dt>Usuários</dt><dd>${escapeHtml(String(restaurant.userCount ?? 0))} (${escapeHtml(String(restaurant.activeUserCount ?? 0))} ativos)</dd></div>
            <div><dt>Produtos</dt><dd>${restaurant.productCount === null ? "Não disponível" : escapeHtml(String(restaurant.productCount))}<small>${escapeHtml(restaurant.productCountSource || "")}</small></dd></div>
            <div><dt>Saúde</dt><dd>${restaurant.health ? `${escapeHtml(String(restaurant.health.score))}/100 · ${escapeHtml(translateStatus(restaurant.health.status))}` : "Não aferida"}</dd></div>
            <div><dt>Identificador</dt><dd>${escapeHtml(restaurant.restaurantKey)}</dd></div>
          </dl>
          <footer class="system-card-actions">
            <button class="users-button users-button-secondary" type="button" data-copy-value="${escapeHtml(restaurant.slug)}">Copiar slug</button>
            ${hasPermission("system.support.start") && restaurant.administrativeActions?.supportAvailable ? `<button class="users-button users-button-primary" type="button" data-support-start="${escapeHtml(restaurant.restaurantKey)}">Iniciar suporte</button>` : ""}
            ${restaurant.publicUrl ? `<a class="users-button users-button-secondary" href="${escapeHtml(restaurant.publicUrl)}" target="_blank" rel="noreferrer">Abrir endereço público</a>` : ""}
          </footer>
        </article>`).join("") || '<div class="users-empty"><div><h2>Nenhum restaurante cadastrado</h2><p>O cadastro aparecerá após o provisionamento administrativo.</p></div></div>'}
      </section>`;
  };

  const renderHealth = (data) => {
    const health = data.health || {};
    app.innerHTML = `
      ${renderPageHead({ eyebrow: "Diagnóstico · dados verificados", title: "Saúde", description: "Verificações executadas nesta solicitação. Serviços ausentes são informados como não configurados." })}
      <section class="system-health-grid">
        ${[
          ["Estado geral", translateStatus(health.summary?.status), "Saúde agregada"],
          ["Tempo médio de resposta", Number.isFinite(health.averageResponseMs) ? `${health.averageResponseMs} ms` : "Não aferido", "Média das verificações atuais"],
          ["Restaurantes ativos", health.summary?.activeRestaurants || 0, `${health.summary?.totalRestaurants || 0} cadastrados`],
          ["Alertas críticos", health.summary?.criticalAlerts || 0, `${health.summary?.integrationFailures || 0} falhas de integração`],
        ].map(([label, value, helper]) => `<article class="system-health-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(helper)}</small></article>`).join("")}
      </section>
      <section class="users-panel">
        <div class="users-filter-meta"><strong>Componentes da plataforma</strong><span>Verificado em ${escapeHtml(formatDate(health.generatedAt))}</span></div>
        <div class="system-component-grid">${(health.components || []).map((component) => `<article><span class="system-component-icon">${escapeHtml(component.name.slice(0, 2).toUpperCase())}</span><div><strong>${escapeHtml(component.name)}</strong><small>${escapeHtml(component.detail)}</small></div><div>${renderStatus(component.status)}<small>${Number.isFinite(component.latencyMs) ? `${component.latencyMs} ms` : "Sem medição de latência"}</small></div></article>`).join("")}</div>
      </section>
      <section class="users-panel system-section-gap">
        <div class="users-filter-meta"><strong>Saúde por restaurante</strong><span>Indicador cadastral e de domínio</span></div>
        <div class="system-health-list">${(health.tenantHealth || []).map((tenant) => `<article class="system-tenant-health"><span><strong>${escapeHtml(tenant.restaurantName)}</strong><small>${escapeHtml(tenant.restaurantKey)}</small></span>${renderStatus(tenant.status)}<div class="system-score"><strong>${escapeHtml(String(tenant.score))}</strong><span class="system-score-meter"><span style="width:${Math.max(0, Math.min(100, Number(tenant.score || 0)))}%"></span></span></div><span><small>Domínio</small><strong>${escapeHtml(translateStatus(tenant.domainStatus))}</strong></span></article>`).join("") || '<p class="system-inline-empty">Nenhum indicador de restaurante disponível.</p>'}</div>
      </section>`;
  };

  const renderIntegrations = (data) => {
    const integrations = data.integrations || [];
    app.innerHTML = `
      ${renderPageHead({ eyebrow: "Conectores · configuração", title: "Integrações", description: "Estado real das integrações configuradas e estrutura preparada para os conectores futuros." })}
      <section class="users-panel">
        <div class="users-filter-meta"><strong>${integrations.length} integrações mapeadas</strong><span>Atualizado em ${escapeHtml(formatDate(data.generatedAt))}</span></div>
        <div class="system-integration-grid">${integrations.map((integration) => `<article><header><span class="system-component-icon">${escapeHtml(integration.name.slice(0, 2).toUpperCase())}</span><div><h2>${escapeHtml(integration.name)}</h2><small>${escapeHtml(integration.configuration)}</small></div>${renderStatus(integration.status)}</header><dl><div><dt>Última sincronização</dt><dd>${escapeHtml(formatDate(integration.lastSyncAt))}</dd></div><div><dt>Última falha</dt><dd>${escapeHtml(formatDate(integration.lastFailureAt))}</dd></div></dl>${integration.errorCode ? '<p class="system-warning">A integração registrou uma falha.</p>' : ""}</article>`).join("")}</div>
      </section>`;
  };

  const renderAudit = (data) => {
    const events = data.events || [];
    app.innerHTML = `
      ${renderPageHead({ eyebrow: "Conformidade · histórico", title: "Auditoria", description: "Trilha administrativa real de identidades, perfis, sessões e suporte." })}
      <section class="users-panel">
        <div class="system-toolbar"><label class="users-field"><span>Pesquisar evento</span><input class="users-input" type="search" data-audit-search placeholder="Evento, responsável ou motivo" /></label><span>${events.length} evento(s)</span></div>
        <div data-audit-results>${renderAuditRows(events)}</div>
      </section>`;
  };

  const renderSupportSearchResults = (query = "") => {
    const root = document.querySelector("[data-support-results]");
    if (!root || !state.routeData) return;
    const search = query.trim().toLowerCase();
    if (!search) {
      root.innerHTML = '<p class="system-inline-empty">Digite um nome, e-mail, slug ou restaurante para pesquisar.</p>';
      return;
    }
    const users = (state.routeData.users || []).filter((user) => `${user.name} ${user.email} ${user.roleLabel}`.toLowerCase().includes(search));
    const restaurants = (state.routeData.restaurants || []).filter((restaurant) => `${restaurant.name} ${restaurant.slug} ${restaurant.owner} ${restaurant.ownerLogin}`.toLowerCase().includes(search));
    root.innerHTML = `<div class="system-search-results">${users.map((user) => `<article><span class="users-avatar">${escapeHtml((user.name || "US").slice(0, 2).toUpperCase())}</span><div><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)} · ${escapeHtml(user.roleLabel || translateRole(user.role))}</small></div><a href="/system/users/${encodeURIComponent(user.id)}/edit">Abrir usuário</a></article>`).join("")}${restaurants.map((restaurant) => `<article><img src="${escapeHtml(restaurant.logo)}" alt="" /><div><strong>${escapeHtml(restaurant.name)}</strong><small>${escapeHtml(restaurant.slug)} · ${escapeHtml(restaurant.owner || "Responsável não informado")}</small></div>${restaurant.administrativeActions?.supportAvailable ? `<button type="button" data-support-start="${escapeHtml(restaurant.restaurantKey)}">Iniciar suporte</button>` : ""}</article>`).join("")}${!users.length && !restaurants.length ? '<p class="system-inline-empty">Nenhum resultado encontrado.</p>' : ""}</div>`;
  };

  const renderSupport = (data) => {
    app.innerHTML = `
      ${renderPageHead({ eyebrow: "Atendimento · acesso controlado", title: "Suporte", description: "Pesquisa administrativa, sessões ativas e histórico auditado de suporte." })}
      <section class="system-health-grid">
        <article class="system-health-card"><span>Chamados</span><strong>${data.ticketing?.available ? escapeHtml(String(data.ticketing.total || 0)) : "Não integrado"}</strong><small>${escapeHtml(data.ticketing?.message || "Sem provedor configurado")}</small></article>
        <article class="system-health-card"><span>Sessões administrativas</span><strong>${escapeHtml(String(data.activeSystemSessions?.length || 0))}</strong><small>Ativas para esta conta</small></article>
        <article class="system-health-card"><span>Sessões de suporte</span><strong>${escapeHtml(String(data.activeSupportSessions?.length || 0))}</strong><small>Ativas para esta conta</small></article>
        <article class="system-health-card"><span>Histórico</span><strong>${escapeHtml(String(data.history?.length || 0))}</strong><small>Eventos de suporte registrados</small></article>
      </section>
      <section class="users-panel">
        <div class="system-toolbar"><label class="users-field"><span>Pesquisar usuário ou restaurante</span><input class="users-input" type="search" data-support-search placeholder="Nome, e-mail, slug ou restaurante" /></label><span>Busca administrativa</span></div>
        <div data-support-results><p class="system-inline-empty">Digite um nome, e-mail, slug ou restaurante para pesquisar.</p></div>
      </section>
      <section class="users-panel system-section-gap"><div class="users-filter-meta"><strong>Sessões ativas</strong><span>Acesso temporário e auditado</span></div><div class="system-session-list">${(data.activeSupportSessions || []).map((session) => `<article><div><strong>${escapeHtml(session.restaurantName)}</strong><small>${escapeHtml(translateStatus(session.mode))} · ${escapeHtml(session.reason)}</small></div><div>${renderStatus(session.status)}<small>Expira em ${escapeHtml(formatDate(session.expiresAt))}</small></div></article>`).join("") || '<p class="system-inline-empty">Nenhuma sessão de suporte ativa.</p>'}</div></section>
      <section class="users-panel system-section-gap"><div class="users-filter-meta"><strong>Histórico de suporte</strong><span>Eventos mais recentes</span></div>${renderAuditRows(data.history || [])}</section>`;
  };

  const renderSettings = (data) => {
    const settings = data.settings || {};
    app.innerHTML = `
      ${renderPageHead({ eyebrow: "Plataforma · leitura segura", title: "Configurações", description: "Resumo das configurações administrativas sem exibir segredos ou credenciais." })}
      <section class="users-panel"><div class="system-settings-grid">${[
        ["Nome da plataforma", settings.platformName || "Não informado"],
        ["Domínio", settings.domain || "Não configurado"],
        ["Endereço do site", settings.site || "Não configurado"],
        ["E-mail de suporte", settings.supportEmail || "Não configurado"],
        ["E-mail financeiro", settings.financialEmail || "Não configurado"],
        ["WhatsApp", settings.whatsapp || "Não configurado"],
        ["Modo de manutenção", settings.maintenanceMode ? "Ativo" : "Inativo"],
        ["Versão", settings.version || "Não informada"],
        ["Persistência", translateStatus(settings.storageMode)],
        ["Modo de restaurantes", translateRestaurantMode(settings.tenantMode)],
      ].map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("")}</div></section>`;
  };

  const renderers = { overview: renderOverview, restaurants: renderRestaurants, health: renderHealth, integrations: renderIntegrations, audit: renderAudit, support: renderSupport, settings: renderSettings };

  const renderError = (error) => {
    app.innerHTML = `<section class="users-panel users-error"><div><span class="users-avatar">!</span><h2>Não foi possível abrir esta área</h2><p>${escapeHtml(error.message)}</p><button class="users-button users-button-primary" type="button" data-system-retry>Tentar novamente</button></div></section>`;
  };

  const loadRoute = async () => {
    const routeKey = getRouteKey();
    const route = NAVIGATION.find((item) => item.key === routeKey && !item.external);
    if (!route || !hasPermission(route.permission)) {
      const first = visibleNavigation().find((item) => !item.external);
      if (first && first.key !== routeKey) {
        window.location.replace(first.href);
        return;
      }
      throw new Error("Seu perfil não possui acesso a esta área.");
    }
    renderSidebar();
    renderLoading(route.label);
    const payload = await requestJson(route.endpoint);
    state.routeData = payload.data || {};
    renderers[route.key](state.routeData);
    document.title = `${route.label} | Painel System INOVAS`;
  };

  const clearAuthenticationState = () => {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index) || "";
        if (/auth|session|token|support/i.test(key)) storage.removeItem(key);
      }
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
    clearAuthenticationState();
    window.location.replace("/system/login.html");
  };

  const openSupportDialog = (restaurantKey) => {
    const restaurant = (state.routeData?.restaurants || []).find((entry) => entry.restaurantKey === restaurantKey);
    if (!restaurant || !dialog) return;
    dialog.innerHTML = `<form method="dialog" data-support-form data-restaurant-key="${escapeHtml(restaurant.restaurantKey)}"><header class="users-dialog-head"><div><span class="users-eyebrow">Suporte controlado</span><h2>${escapeHtml(restaurant.name)}</h2></div><button class="users-icon-button" value="cancel" aria-label="Fechar">×</button></header><div class="users-dialog-body"><label class="users-field"><span>Modo de acesso</span><select class="users-input" name="mode"><option value="VIEW">Somente visualização</option>${hasPermission("system.support.admin") ? '<option value="ADMIN">Administrativo controlado</option>' : ""}</select></label><label class="users-field" style="margin-top:14px"><span>Motivo do suporte</span><textarea class="users-input" name="reason" minlength="10" maxlength="500" required placeholder="Descreva o chamado ou diagnóstico"></textarea></label><label class="system-confirm"><input type="checkbox" name="confirmed" required /><span>Confirmo o acesso temporário, com escopo e auditoria.</span></label><div class="users-alert" data-support-error hidden></div></div><footer class="users-dialog-actions"><button class="users-button users-button-secondary" value="cancel">Cancelar</button><button class="users-button users-button-primary" type="submit">Criar sessão de suporte</button></footer></form>`;
    dialog.showModal();
  };

  const startSupport = async (form) => {
    const data = new FormData(form);
    const errorNode = form.querySelector("[data-support-error]");
    try {
      const payload = await requestJson("/api/support/start", {
        method: "POST",
        body: JSON.stringify({
          restaurantKey: form.dataset.restaurantKey,
          mode: data.get("mode"),
          reason: String(data.get("reason") || "").trim(),
          confirmed: data.get("confirmed") === "on",
        }),
      });
      dialog.innerHTML = `<div class="users-dialog-body users-success-panel"><h2>Sessão de suporte criada</h2><p>O acesso é temporário, restrito ao restaurante selecionado e registrado na auditoria.</p><div class="users-dialog-actions"><button class="users-button users-button-secondary" type="button" data-dialog-close>Fechar</button><a class="users-button users-button-primary" href="${escapeHtml(payload.data?.redirectTo || "/admin")}">Abrir suporte</a></div></div>`;
      notify("Sessão de suporte criada com sucesso.");
    } catch (error) {
      errorNode.textContent = error.message;
      errorNode.hidden = false;
    }
  };

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-system-logout]")) return void logout();
    if (event.target.closest("[data-system-retry]")) return void loadRoute().catch(renderError);
    if (event.target.closest("[data-dialog-close]")) return dialog?.close();
    const supportButton = event.target.closest("[data-support-start]");
    if (supportButton) return openSupportDialog(supportButton.dataset.supportStart);
    const copyButton = event.target.closest("[data-copy-value]");
    if (copyButton) {
      navigator.clipboard?.writeText(copyButton.dataset.copyValue || "").then(() => notify("Slug copiado.")).catch(() => notify("Não foi possível copiar o slug."));
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches("[data-support-search]")) renderSupportSearchResults(event.target.value);
    if (event.target.matches("[data-audit-search]")) {
      const query = event.target.value.trim().toLowerCase();
      const events = (state.routeData?.events || []).filter((item) => `${translateEvent(item.eventType)} ${item.actorName || ""} ${item.actorLogin || ""} ${item.reason || ""}`.toLowerCase().includes(query));
      const root = document.querySelector("[data-audit-results]");
      if (root) root.innerHTML = renderAuditRows(events);
    }
  });

  document.addEventListener("submit", (event) => {
    if (!event.target.matches("[data-support-form]")) return;
    event.preventDefault();
    void startSupport(event.target);
  });

  const init = async () => {
    try {
      const payload = await requestJson("/api/auth/system/session");
      state.session = payload?.data?.session;
      if (!payload.authenticated || !state.session) throw Object.assign(new Error("Sua sessão expirou."), { status: 401 });
      if (state.session.tenantId || state.session.restaurantId) throw new Error("A sessão da plataforma apresentou escopo inválido.");
      await loadRoute();
    } catch (error) {
      if (error.status === 401) return window.location.replace("/system/login.html");
      renderError(error);
    }
  };

  window.addEventListener("hashchange", () => void loadRoute().catch(renderError));
  window.addEventListener("pageshow", (event) => { if (event.persisted) void init(); });
  void init();
})();
