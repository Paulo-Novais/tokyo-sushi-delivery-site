/* Painel System INOVAS Food — telas Visão geral, Restaurantes, Suporte e
   Auditoria. Dados reais vêm de /api/system/* e /api/support/*; o menu é
   filtrado pelas permissões da sessão, mas toda permissão é checada no
   servidor. */
(() => {
  "use strict";

  const shell = window.InovasSystemShell;
  const app = document.querySelector("[data-system-app]");
  const toast = document.querySelector("[data-system-toast]");
  const dialog = document.querySelector("[data-system-dialog]");
  if (!shell || !app) return;

  const { icon, escapeHtml, translateRole, getInitials } = shell;

  const ROUTES = Object.freeze({
    overview: { key: "overview", label: "Visão geral", permission: "system.dashboard.view", endpoint: "/api/system/overview" },
    restaurants: { key: "restaurants", label: "Restaurantes", permission: "system.restaurants.view", endpoint: "/api/system/restaurants" },
    support: { key: "support", label: "Suporte", permission: "system.support.start", endpoint: "/api/system/support" },
    audit: { key: "audit", label: "Auditoria", permission: "system.audit.view", endpoint: "/api/system/audit" },
  });

  // Rotas antigas (Saúde, Integrações, Configurações) foram absorvidas.
  const ROUTE_ALIASES = Object.freeze({
    dashboard: "overview",
    health: "overview",
    settings: "overview",
    integrations: "restaurants",
  });

  const EVENT_LABELS = Object.freeze({
    SUPPORT_SESSION_STARTED: "Sessão de suporte iniciada",
    SUPPORT_SESSION_REVOKED: "Sessão de suporte encerrada",
    SYSTEM_USER_CREATED: "Usuário criado",
    SYSTEM_USER_UPDATED: "Usuário atualizado",
    SYSTEM_USER_BLOCKED: "Usuário bloqueado",
    SYSTEM_USER_DEACTIVATED: "Usuário desativado",
    SYSTEM_USER_ACTIVATED: "Usuário ativado",
    SYSTEM_USER_SESSIONS_REVOKED: "Sessões encerradas",
    SYSTEM_USER_INVITATION_REISSUED: "Convite reenviado",
    SYSTEM_ACCESS_DENIED: "Acesso negado",
    ROLE_CREATED: "Perfil criado",
    ROLE_UPDATED: "Perfil atualizado",
    ROLE_DUPLICATED: "Perfil duplicado",
    ROLE_DEACTIVATED: "Perfil removido",
    IDENTITY_SCOPE_RECOVERED: "Vínculo de identidade restaurado",
    SYSTEM_MASTER_RBAC_REPAIRED: "Permissões do perfil Master restauradas",
    LOGIN_SUCCESS: "Login realizado",
    LOGIN_FAILED: "Falha de login",
    LOGOUT: "Saída da sessão",
  });

  const HEALTH_LABELS = Object.freeze({
    ONLINE: ["Online", "ok"],
    HEALTHY: ["Online", "ok"],
    DEGRADED: ["Degradado", "warn"],
    OFFLINE: ["Offline", "crit"],
  });

  const DOMAIN_LABELS = Object.freeze({
    ACTIVE: "Ativo",
    ATIVO: "Ativo",
    HEALTHY: "Ativo",
    VERIFIED: "Ativo",
    PENDING: "Verificação pendente",
    PENDING_VERIFICATION: "Verificação pendente",
    PENDING_DNS: "Verificação pendente",
    INACTIVE: "Inativo",
    DISABLED: "Inativo",
    NOT_CONFIGURED: "Não configurado",
    SIMULATED: "Simulado",
    SIMULATION: "Simulado",
    OK: "Ativo",
    DEGRADED: "Degradado",
    ERROR: "Com falha",
    FAILED: "Com falha",
    UNKNOWN: "Não informado",
  });

  const RESTAURANT_STATUS_LABELS = Object.freeze({
    ACTIVE: "Ativo",
    ATIVO: "Ativo",
    CLIENTE_MODELO: "Cliente modelo",
    PILOT: "Piloto",
    TRIAL: "Avaliação",
    CONFIGURED: "Configurado",
    SUSPENDED: "Suspenso",
    INACTIVE: "Inativo",
    BLOCKED: "Bloqueado",
    NOT_REGISTERED: "Não cadastrado",
    PENDING: "Pendente",
  });

  const PLAN_LABELS = Object.freeze({
    PREMIUM: "Premium",
    TRIAL: "Avaliação",
    FREE: "Gratuito",
    BASIC: "Básico",
    START: "Start",
    BUSINESS: "Business",
    PRO: "Pro",
    ENTERPRISE: "Empresarial",
  });

  const RESULT_LABELS = Object.freeze({
    SUCCESS: ["Sucesso", "ok"],
    DENIED: ["Negado", "crit"],
    FAILED: ["Falhou", "crit"],
    FAILURE: ["Falhou", "crit"],
    ERROR: ["Erro", "crit"],
    REVOKED: ["Encerrado", "neutral"],
  });

  const state = {
    session: null,
    route: "overview",
    query: new URLSearchParams(),
    data: null,
    selectedRestaurantKey: "",
    selectedAuditId: "",
    filters: {
      restaurants: { search: "", status: "", plan: "", domain: "" },
      audit: { search: "", period: "30", event: "", result: "", scope: "all" },
    },
    support: { restaurantKey: "", mode: "VIEW", reason: "", confirmed: false },
  };

  /* ---------- utilidades ---------- */

  const normalize = (value) => String(value || "").trim().toUpperCase();
  const getPermissions = () => new Set(state.session?.effectivePermissions || []);
  const hasPermission = (permission) => getPermissions().has(permission);

  const translateHealth = (value) => HEALTH_LABELS[normalize(value)] || ["Não aferido", "neutral"];
  const humanize = (value) => {
    const text = String(value || "").trim().toLowerCase().replace(/_/g, " ");
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Não informado";
  };
  const translateDomain = (value) => DOMAIN_LABELS[normalize(value)] || humanize(value);
  const translateRestaurantStatus = (value) => RESTAURANT_STATUS_LABELS[normalize(value)] || humanize(value);
  const translatePlan = (value) => PLAN_LABELS[normalize(value)] || (value ? humanize(value) : "Sem plano");
  const translateEvent = (value) => EVENT_LABELS[normalize(value)] || "Evento administrativo";
  const translateResult = (value) => RESULT_LABELS[normalize(value)] || [humanize(value), "neutral"];
  const translateMode = (value) => (normalize(value) === "ADMIN" ? "Administrativo" : "Visualização");

  const scoreTone = (score) => {
    const value = Number(score);
    if (!Number.isFinite(value)) return "neutral";
    if (value >= 80) return "ok";
    if (value >= 50) return "warn";
    return "crit";
  };

  const pad = (value) => String(value).padStart(2, "0");

  const parseDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const formatShort = (value) => {
    const date = parseDate(value);
    if (!date) return "—";
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const formatDay = (value) => {
    const date = parseDate(value);
    if (!date) return "—";
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  };

  const formatFull = (value) => {
    const date = parseDate(value);
    if (!date) return "—";
    return `${formatDay(date)}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const formatTime = (value) => {
    const date = parseDate(value);
    return date ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : "—";
  };

  const minutesLeft = (value) => {
    const date = parseDate(value);
    if (!date) return 0;
    return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 60000));
  };

  const plural = (count, singular, pluralForm) => `${count} ${count === 1 ? singular : pluralForm}`;

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
      error.code = payload?.error?.code || "";
      throw error;
    }
    return payload;
  };

  const notify = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => {
      toast.hidden = true;
    }, 4200);
  };

  const parseHash = () => {
    const raw = window.location.hash.replace(/^#/, "");
    const [path, queryString = ""] = raw.split("?");
    const key = path.trim() || "overview";
    return { key: ROUTE_ALIASES[key] || key, query: new URLSearchParams(queryString) };
  };

  const statusPill = (label, tone, { dot = true } = {}) =>
    `<span class="${dot ? "sys-status" : "sys-pill"} is-${tone}">${escapeHtml(label)}</span>`;

  const meter = (score) => {
    const value = Math.max(0, Math.min(100, Number(score) || 0));
    return `<span class="sys-meter" role="img" aria-label="Health Score ${value} de 100"><span class="is-${scoreTone(score)}" style="width:${value}%"></span></span>`;
  };

  const renderHead = ({ eyebrow, title, description, actions = "" }) => `
    <header class="sys-page-head">
      <div>
        <span class="sys-eyebrow">${escapeHtml(eyebrow)}</span>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
      </div>
      ${actions ? `<div class="sys-page-actions">${actions}</div>` : ""}
    </header>`;

  const renderEmpty = (title, text) => `
    <div class="sys-empty"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p></div>`;

  const renderLoading = (label) => {
    app.innerHTML = `<div class="sys-loading"><span class="sys-spinner" aria-hidden="true"></span><span>Carregando ${escapeHtml(label.toLowerCase())}…</span></div>`;
  };

  const renderError = (error) => {
    const forbidden = error?.status === 403;
    app.innerHTML = `
      <section class="sys-card sys-error">
        <span class="sys-eyebrow">${forbidden ? "Sem permissão" : "Falha ao carregar"}</span>
        <h2>${forbidden ? "Seu perfil não tem acesso a esta área" : "Não foi possível abrir esta área"}</h2>
        <p>${escapeHtml(error?.message || "Tente novamente em instantes.")}</p>
        <div class="sys-actions">
          <button class="sys-btn sys-btn-primary" type="button" data-system-retry>Tentar novamente</button>
          <a class="sys-btn sys-btn-secondary" href="/system">Voltar à visão geral</a>
        </div>
      </section>`;
  };

  /* ---------- Visão geral ---------- */

  const buildAttentionItems = (data) => {
    const items = [];
    const tenantHealth = data.health?.tenantHealth || [];
    for (const tenant of tenantHealth) {
      const health = normalize(tenant.status);
      if (health === "OFFLINE") {
        items.push({ tone: "crit", label: "Crítico", title: "Restaurante fora do ar", subtitle: `${tenant.restaurantName} · Health Score ${tenant.score}`, key: tenant.restaurantKey });
      } else if (health === "DEGRADED") {
        items.push({ tone: "warn", label: "Atenção", title: "Restaurante degradado", subtitle: `${tenant.restaurantName} · Health Score ${tenant.score}`, key: tenant.restaurantKey });
      }
      if (["PENDING", "PENDING_VERIFICATION", "PENDING_DNS"].includes(normalize(tenant.domainStatus))) {
        items.push({ tone: "warn", label: "Atenção", title: "Domínio aguardando verificação", subtitle: tenant.restaurantName, key: tenant.restaurantKey });
      }
      if (Number(tenant.failedIntegrations) > 0) {
        items.push({ tone: "warn", label: "Atenção", title: plural(Number(tenant.failedIntegrations), "integração com falha", "integrações com falha"), subtitle: tenant.restaurantName, key: tenant.restaurantKey });
      }
      if (Number(tenant.criticalErrors) > 0) {
        items.push({ tone: "crit", label: "Crítico", title: plural(Number(tenant.criticalErrors), "erro crítico", "erros críticos"), subtitle: tenant.restaurantName, key: tenant.restaurantKey });
      }
    }
    const platformFailures = Number(data.overview?.integrations?.attention || 0);
    if (platformFailures > 0) {
      items.push({ tone: "warn", label: "Atenção", title: plural(platformFailures, "integração da plataforma com falha", "integrações da plataforma com falha"), subtitle: "Conectores globais da INOVAS Food", key: "" });
    }
    return items;
  };

  const renderSupportSessionCard = (session) => {
    const total = Math.max(1, (parseDate(session.expiresAt)?.getTime() || 0) - (parseDate(session.createdAt)?.getTime() || 0));
    const left = Math.max(0, (parseDate(session.expiresAt)?.getTime() || 0) - Date.now());
    const percent = Math.max(0, Math.min(100, Math.round((left / total) * 100)));
    return `
      <article class="sys-card" style="box-shadow:none">
        <div class="sys-card-body" style="display:grid;gap:8px">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
            <strong>${escapeHtml(session.restaurantName || session.restaurantKey || "Restaurante")}</strong>
            ${statusPill(translateMode(session.mode), normalize(session.mode) === "ADMIN" ? "warn" : "neutral", { dot: false })}
          </div>
          <span class="sys-hint">Aberta por ${escapeHtml(session.displayName || session.login || "usuário da equipe")} · motivo registrado na auditoria</span>
          <span class="sys-meter" aria-hidden="true"><span style="width:${percent}%;background:#ff6a00"></span></span>
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
            <span><strong>${minutesLeft(session.expiresAt)} min restantes</strong></span>
            <a class="sys-btn sys-btn-secondary sys-btn-sm" href="/system#support">Gerenciar</a>
          </div>
        </div>
      </article>`;
  };

  const renderOverview = (data) => {
    const summary = data.health?.summary || {};
    const overview = data.overview || {};
    const tenantHealth = data.health?.tenantHealth || [];
    const degraded = Number(summary.degradedRestaurants || overview.restaurants?.degraded || 0);
    const critical = Number(summary.criticalAlerts || 0);
    const failures = Number(summary.integrationFailures || 0) + Number(overview.integrations?.attention || 0);
    const attention = buildAttentionItems(data);
    const supportSessions = data.activeSupportSessions || [];

    let bannerTone = "ok";
    let bannerText = "<strong>Plataforma operando normalmente.</strong> Nenhum restaurante degradado e nenhuma falha de integração no momento.";
    if (critical > 0) {
      bannerTone = "crit";
      bannerText = `<strong>Plataforma com alerta crítico.</strong> ${plural(critical, "alerta crítico precisa", "alertas críticos precisam")} de ação imediata.`;
    } else if (degraded > 0 || failures > 0) {
      bannerTone = "warn";
      bannerText = `<strong>Plataforma operando com atenção.</strong> ${plural(degraded, "restaurante degradado", "restaurantes degradados")} e ${plural(failures, "falha de integração", "falhas de integração")} precisam de acompanhamento.`;
    }
    const platformState = bannerTone === "crit" ? "Crítico" : bannerTone === "warn" ? "Atenção" : "Normal";

    app.innerHTML = `
      ${renderHead({
        eyebrow: "Plataforma · saúde agregada",
        title: "Visão geral da INOVAS",
        description: "Estado técnico e operacional agregado. Nenhum pedido, cliente ou valor financeiro de restaurante aparece nesta tela.",
        actions: hasPermission("system.support.start") ? '<a class="sys-btn sys-btn-primary" href="/system#support">Iniciar suporte</a>' : "",
      })}
      <div class="sys-banner is-${bannerTone}" role="status">${icon(bannerTone === "ok" ? "check" : "warning")}<span>${bannerText}</span></div>
      <section class="sys-kpis system-health-grid" aria-label="Indicadores de saúde">
        <article class="sys-kpi"><span>Estado da plataforma</span><strong>${platformState}</strong><small>Saúde global</small></article>
        <article class="sys-kpi"><span>Restaurantes ativos</span><strong>${escapeHtml(String(summary.activeRestaurants ?? overview.restaurants?.active ?? 0))}</strong><small>${escapeHtml(String(summary.totalRestaurants ?? overview.restaurants?.total ?? 0))} cadastrados</small></article>
        <article class="sys-kpi"><span>Degradados</span><strong>${degraded}</strong><small>Requerem acompanhamento</small></article>
        <article class="sys-kpi"><span>Alertas críticos</span><strong>${critical}</strong><small>${plural(failures, "falha de integração", "falhas de integração")}</small></article>
      </section>
      <section class="sys-card" aria-labelledby="atencao" style="margin-bottom:20px">
        <div class="sys-card-head"><h2 id="atencao">Precisa de atenção</h2><span class="sys-pill">${plural(attention.length, "item", "itens")}</span></div>
        ${attention.length ? `<div class="sys-list">${attention
          .map(
            (item) => `<div class="sys-list-item">${statusPill(item.label, item.tone, { dot: false })}<div class="sys-list-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.subtitle)}</span></div>${item.key && hasPermission("system.restaurants.view") ? `<a class="sys-btn sys-btn-secondary sys-btn-sm" href="/system#restaurants?key=${encodeURIComponent(item.key)}">Abrir restaurante</a>` : ""}</div>`
          )
          .join("")}</div>` : renderEmpty("Nada pendente", "Nenhum restaurante ou integração precisa de acompanhamento agora.")}
      </section>
      <div class="sys-split">
        <section class="sys-card" aria-labelledby="saude">
          <div class="sys-card-head"><h2 id="saude">Health Score por restaurante</h2><span>Atualizado em ${escapeHtml(formatFull(data.health?.generatedAt))}</span></div>
          ${tenantHealth.length ? `<div class="sys-table-wrap"><table class="sys-table is-stack" aria-label="Health Score por restaurante"><thead><tr><th>Restaurante</th><th>Estado</th><th>Health Score</th><th>Domínio</th></tr></thead><tbody>
            ${tenantHealth
              .map((tenant) => {
                const [healthLabel, tone] = translateHealth(tenant.status);
                return `<tr><td data-label="Restaurante"><strong>${escapeHtml(tenant.restaurantName)}</strong><small>${escapeHtml(tenant.restaurantKey)}</small></td><td data-label="Estado">${statusPill(healthLabel, tone)}</td><td data-label="Health Score"><span class="sys-score"><strong>${escapeHtml(String(tenant.score))}</strong>${meter(tenant.score)}</span></td><td data-label="Domínio">${escapeHtml(translateDomain(tenant.domainStatus))}</td></tr>`;
              })
              .join("")}
          </tbody></table></div>` : renderEmpty("Nenhum restaurante aferido", "A saúde aparecerá após o primeiro restaurante ser provisionado.")}
        </section>
        <div class="sys-stack">
          <section class="sys-card" aria-labelledby="sessoes">
            <div class="sys-card-head"><h2 id="sessoes">Sessões de suporte ativas</h2></div>
            <div class="sys-card-body" style="display:grid;gap:12px">
              ${supportSessions.length ? supportSessions.map(renderSupportSessionCard).join("") : '<p class="sys-hint" style="margin:0">Nenhuma sessão de suporte ativa para esta conta.</p>'}
            </div>
          </section>
          <section class="sys-card" aria-labelledby="fronteira">
            <div class="sys-card-head"><h2 id="fronteira">Fronteira System ativa</h2></div>
            <div class="sys-card-body">
              <ul class="sys-checklist">
                ${[
                  "Sessão System sem tenant e sem restaurante.",
                  "Sem acesso a pedidos, clientes ou financeiro de restaurantes.",
                  "Permissões apenas do vocabulário system.*",
                  "Acesso operacional só por sessão de suporte explícita e auditada.",
                  "Cookies e APIs separados por domínio.",
                ]
                  .map((text) => `<li>${icon("check", 18, "#16a34a")}<span>${escapeHtml(text)}</span></li>`)
                  .join("")}
              </ul>
            </div>
          </section>
        </div>
      </div>`;
  };

  /* ---------- Restaurantes ---------- */

  const restaurantMatches = (restaurant, filters) => {
    const search = filters.search.trim().toLowerCase();
    if (search && !`${restaurant.name} ${restaurant.slug} ${restaurant.restaurantKey} ${restaurant.owner || ""}`.toLowerCase().includes(search)) return false;
    if (filters.status && normalize(restaurant.health?.status || "UNKNOWN") !== filters.status) return false;
    if (filters.plan && normalize(restaurant.plan || "NONE") !== filters.plan) return false;
    if (filters.domain && normalize(restaurant.health?.domainStatus || "UNKNOWN") !== filters.domain) return false;
    return true;
  };

  const renderRestaurantDetail = (restaurant) => {
    if (!restaurant) {
      return `<aside class="sys-card sys-detail">${renderEmpty("Nenhum restaurante selecionado", "Clique em uma linha da lista para ver os detalhes.")}</aside>`;
    }
    const [healthLabel, tone] = translateHealth(restaurant.health?.status);
    const health = restaurant.health || {};
    const failed = Number(health.failedIntegrations || 0);
    const pendingJobs = Number(health.pendingJobs || 0);
    const backup = normalize(health.backupStatus);
    const canSupport = hasPermission("system.support.start") && restaurant.administrativeActions?.supportAvailable;
    return `
      <aside class="sys-card sys-detail" aria-label="Restaurante selecionado">
        <div>
          <span class="sys-eyebrow">Restaurante selecionado</span>
          <h2>${escapeHtml(restaurant.name)}</h2>
          ${statusPill(healthLabel, tone)} ${statusPill(translateRestaurantStatus(restaurant.status), "neutral", { dot: false })}
        </div>
        <dl class="sys-facts">
          <div class="sys-fact"><span>Identificador</span><strong>${escapeHtml(restaurant.restaurantKey)}</strong></div>
          <div class="sys-fact"><span>Endereço público</span><strong>${escapeHtml(restaurant.publicUrl || `/${restaurant.slug || restaurant.restaurantKey}`)}</strong></div>
          <div class="sys-fact"><span>Plano</span><strong>${escapeHtml(translatePlan(restaurant.plan))}</strong></div>
          <div class="sys-fact"><span>Domínio</span><strong>${escapeHtml(translateDomain(health.domainStatus))}${restaurant.domain ? `<br><small class="sys-hint">${escapeHtml(restaurant.domain)}</small>` : ""}</strong></div>
          <div class="sys-fact"><span>Responsável</span><strong>${escapeHtml(restaurant.owner || "Não informado")}</strong></div>
          <div class="sys-fact"><span>Usuários</span><strong>${escapeHtml(String(restaurant.activeUserCount ?? 0))} ativos de ${escapeHtml(String(restaurant.userCount ?? 0))}</strong></div>
          <div class="sys-fact"><span>Atualizado em</span><strong>${escapeHtml(formatDay(restaurant.updatedAt))}</strong></div>
        </dl>
        <div>
          <div style="display:flex;justify-content:space-between;align-items:baseline"><strong>Health Score</strong><strong style="font-size:20px">${escapeHtml(String(health.score ?? "—"))}</strong></div>
          ${meter(health.score)}
        </div>
        <div>
          <h3 class="sys-subhead">Integrações e rotinas</h3>
          <dl class="sys-facts">
            <div class="sys-fact"><span>Integrações</span>${failed > 0 ? statusPill(`${failed} com falha`, "warn", { dot: false }) : statusPill("OK", "ok", { dot: false })}</div>
            <div class="sys-fact"><span>Rotinas pendentes</span>${pendingJobs > 0 ? statusPill(`${pendingJobs} pendentes`, "warn", { dot: false }) : statusPill("Nenhuma", "ok", { dot: false })}</div>
            <div class="sys-fact"><span>Backup</span>${backup && !["OK", "HEALTHY", "CURRENT", "SUCCESS"].includes(backup) ? statusPill(backup === "UNKNOWN" ? "Não aferido" : "Atenção", backup === "UNKNOWN" ? "neutral" : "warn", { dot: false }) : statusPill("OK", "ok", { dot: false })}</div>
          </dl>
        </div>
        <div class="sys-note">${icon("lock", 18)}<span>Pedidos, clientes e financeiro deste restaurante não aparecem aqui. Para ver, abra uma sessão de suporte; o motivo fica registrado.</span></div>
        <div class="sys-action-stack">
          ${canSupport
            ? `<a class="sys-btn sys-btn-primary" href="/system#support?key=${encodeURIComponent(restaurant.restaurantKey)}">Iniciar suporte (visualização)</a>`
            : '<button class="sys-btn sys-btn-primary" type="button" disabled>Iniciar suporte (visualização)</button>'}
          <p class="sys-action-help">Requer system.support.start${restaurant.administrativeActions?.supportAvailable ? "" : " · restaurante não provisionado"}</p>
          <button class="sys-btn sys-btn-secondary" type="button" disabled aria-disabled="true">Editar dados de plataforma</button>
          <p class="sys-action-help">Requer system.restaurants.edit · ainda não disponível nesta versão</p>
          <button class="sys-btn sys-btn-danger" type="button" disabled aria-disabled="true">Suspender acesso</button>
          <p class="sys-action-help">Ação crítica · requer system.restaurants.suspend e motivo · ainda não disponível nesta versão</p>
        </div>
      </aside>`;
  };

  const renderRestaurantsList = () => {
    const root = document.querySelector("[data-restaurant-list]");
    const detailRoot = document.querySelector("[data-restaurant-detail]");
    if (!root || !state.data) return;
    const filters = state.filters.restaurants;
    const restaurants = (state.data.restaurants || []).filter((restaurant) => restaurantMatches(restaurant, filters));
    if (!restaurants.some((restaurant) => restaurant.restaurantKey === state.selectedRestaurantKey)) {
      state.selectedRestaurantKey = restaurants[0]?.restaurantKey || "";
    }
    root.innerHTML = restaurants.length
      ? `<div class="sys-table-caption">${plural(restaurants.length, "restaurante", "restaurantes")} · clique em uma linha para ver os detalhes</div>
        <div class="sys-table-wrap"><table class="sys-table is-stack" aria-label="Restaurantes"><thead><tr><th>Restaurante</th><th>Estado</th><th>Plano</th><th>Domínio</th></tr></thead><tbody>
        ${restaurants
          .map((restaurant) => {
            const [healthLabel, tone] = translateHealth(restaurant.health?.status);
            const selected = restaurant.restaurantKey === state.selectedRestaurantKey;
            return `<tr class="is-clickable ${selected ? "is-selected" : ""}" data-restaurant-row="${escapeHtml(restaurant.restaurantKey)}" tabindex="0" role="button" aria-pressed="${selected}"><td data-label="Restaurante"><strong>${escapeHtml(restaurant.name)}</strong><small>${escapeHtml(restaurant.slug || restaurant.restaurantKey)}</small></td><td data-label="Estado">${statusPill(healthLabel, tone)}</td><td data-label="Plano">${escapeHtml(translatePlan(restaurant.plan))}</td><td data-label="Domínio">${escapeHtml(translateDomain(restaurant.health?.domainStatus))}</td></tr>`;
          })
          .join("")}
        </tbody></table></div>`
      : renderEmpty("Nenhum restaurante encontrado", "Ajuste a busca ou os filtros para ampliar a lista.");
    if (detailRoot) {
      detailRoot.innerHTML = renderRestaurantDetail(restaurants.find((restaurant) => restaurant.restaurantKey === state.selectedRestaurantKey));
    }
  };

  const renderRestaurants = (data) => {
    const restaurants = data.restaurants || [];
    const options = (values, translate) =>
      [...new Set(values.filter(Boolean).map(normalize))].map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(translate(value))}</option>`).join("");
    app.innerHTML = `
      ${renderHead({
        eyebrow: "Plataforma · cadastros",
        title: "Restaurantes",
        description: "Cadastro, plano, domínio e saúde de cada restaurante. Dados operacionais só por sessão de suporte.",
      })}
      <div class="sys-toolbar">
        <label class="sys-search"><span class="sr-only">Buscar por nome ou identificador</span>${icon("search", 18, "#6b7280")}<input class="sys-input" type="search" data-restaurant-filter="search" placeholder="Buscar por nome ou identificador" value="${escapeHtml(state.filters.restaurants.search)}" /></label>
        <label><span class="sr-only">Estado</span><select class="sys-select" data-restaurant-filter="status"><option value="">Estado: todos</option>${options(restaurants.map((item) => item.health?.status), (value) => translateHealth(value)[0])}</select></label>
        <label><span class="sr-only">Plano</span><select class="sys-select" data-restaurant-filter="plan"><option value="">Plano: todos</option>${options(restaurants.map((item) => item.plan), translatePlan)}</select></label>
        <label><span class="sr-only">Domínio</span><select class="sys-select" data-restaurant-filter="domain"><option value="">Domínio: todos</option>${options(restaurants.map((item) => item.health?.domainStatus), translateDomain)}</select></label>
      </div>
      <div class="sys-rest-layout">
        <section class="sys-card" data-restaurant-list aria-label="Lista de restaurantes"></section>
        <div data-restaurant-detail></div>
      </div>`;
    for (const select of app.querySelectorAll("select[data-restaurant-filter]")) {
      select.value = state.filters.restaurants[select.dataset.restaurantFilter] || "";
    }
    renderRestaurantsList();
  };

  /* ---------- Suporte ---------- */

  const supportIsValid = () => {
    const support = state.support;
    return Boolean(support.restaurantKey) && support.reason.trim().length >= 10 && support.confirmed && (support.mode !== "ADMIN" || hasPermission("system.support.admin"));
  };

  const syncSupportForm = () => {
    const form = document.querySelector("[data-support-form]");
    if (!form) return;
    const support = state.support;
    for (const choice of form.querySelectorAll("[data-support-mode]")) {
      choice.classList.toggle("is-selected", choice.dataset.supportMode === support.mode);
    }
    const warning = form.querySelector("[data-support-admin-warning]");
    if (warning) warning.hidden = support.mode !== "ADMIN";
    const counter = form.querySelector("[data-support-counter]");
    if (counter) {
      const length = support.reason.trim().length;
      counter.textContent = `${length} de 10 caracteres no mínimo`;
      counter.classList.toggle("is-error", length > 0 && length < 10);
    }
    const submit = form.querySelector("[data-support-submit]");
    if (submit) {
      submit.disabled = !supportIsValid();
      submit.textContent = `Iniciar sessão — ${support.mode === "ADMIN" ? "15" : "30"} min`;
    }
  };

  const renderSupport = (data) => {
    const restaurants = (data.restaurants || []).filter((restaurant) => restaurant.administrativeActions?.supportAvailable !== false);
    const active = data.activeSupportSessions || [];
    const ended = (data.history || []).filter((event) => normalize(event.eventType) === "SUPPORT_SESSION_REVOKED").slice(0, 5);
    if (!restaurants.some((restaurant) => restaurant.restaurantKey === state.support.restaurantKey)) {
      const requested = state.query.get("key");
      state.support.restaurantKey = requested && restaurants.some((restaurant) => restaurant.restaurantKey === requested) ? requested : restaurants[0]?.restaurantKey || "";
    }
    const canAdmin = hasPermission("system.support.admin");
    if (!canAdmin && state.support.mode === "ADMIN") state.support.mode = "VIEW";

    app.innerHTML = `
      ${renderHead({
        eyebrow: "Operação · acesso temporário",
        title: "Suporte auditado",
        description: "O único caminho para ver dados de um restaurante. Toda sessão tem modo, motivo e prazo, e fica registrada na auditoria.",
      })}
      <div class="sys-support-layout">
        <section class="sys-card">
          <div class="sys-card-body">
            <h2 style="margin-bottom:16px">Iniciar sessão de suporte</h2>
            <form class="sys-form" data-support-form novalidate>
              <label class="sys-field">
                <span>Restaurante</span>
                <select class="sys-input" name="restaurantKey" data-support-field="restaurantKey" ${restaurants.length ? "" : "disabled"}>
                  ${restaurants.length ? restaurants.map((restaurant) => `<option value="${escapeHtml(restaurant.restaurantKey)}" ${restaurant.restaurantKey === state.support.restaurantKey ? "selected" : ""}>${escapeHtml(restaurant.name)}</option>`).join("") : '<option value="">Nenhum restaurante disponível</option>'}
                </select>
              </label>
              <fieldset class="sys-field" style="border:0;padding:0;margin:0">
                <legend style="font-weight:600;padding:0;margin-bottom:6px">Modo de acesso</legend>
                <div class="sys-choices">
                  <label class="sys-choice ${state.support.mode === "VIEW" ? "is-selected" : ""}" data-support-mode="VIEW">
                    <input class="sr-only" type="radio" name="mode" value="VIEW" ${state.support.mode === "VIEW" ? "checked" : ""} />
                    <strong>Visualização</strong><span>Leitura dos dados do restaurante, sem alterar nada.</span><small>30 min · requer system.support.start</small>
                  </label>
                  <label class="sys-choice ${state.support.mode === "ADMIN" ? "is-selected" : ""} ${canAdmin ? "" : "is-disabled"}" data-support-mode="ADMIN">
                    <input class="sr-only" type="radio" name="mode" value="ADMIN" ${state.support.mode === "ADMIN" ? "checked" : ""} ${canAdmin ? "" : "disabled"} />
                    <strong>Administrativo</strong><span>Permite ajustes controlados, com mais rastreio.</span><small>15 min · requer system.support.admin · crítico${canAdmin ? "" : " · seu perfil não tem esta permissão"}</small>
                  </label>
                </div>
              </fieldset>
              <div class="sys-banner is-warn is-compact" data-support-admin-warning ${state.support.mode === "ADMIN" ? "" : "hidden"}>${icon("warning", 18)}<span>O modo administrativo permite alterar dados do restaurante. Use só quando a visualização não resolver; a sessão dura menos.</span></div>
              <label class="sys-field">
                <span>Motivo do acesso</span>
                <textarea class="sys-textarea" name="reason" data-support-field="reason" minlength="10" maxlength="500" placeholder="Descreva o que precisa verificar ou ajustar">${escapeHtml(state.support.reason)}</textarea>
                <span class="sys-hint" data-support-counter aria-live="polite">0 de 10 caracteres no mínimo</span>
              </label>
              <label class="sys-check">
                <input type="checkbox" name="confirmed" data-support-field="confirmed" ${state.support.confirmed ? "checked" : ""} />
                <span>Confirmo que este acesso é necessário e que ele será registrado na auditoria.</span>
              </label>
              <div class="sys-banner is-crit is-compact" data-support-error hidden></div>
              <button class="sys-btn sys-btn-primary sys-btn-block" type="submit" data-support-submit disabled>Iniciar sessão — 30 min</button>
            </form>
          </div>
        </section>
        <div class="sys-stack">
          <section class="sys-card" aria-labelledby="sessoes-ativas">
            <div class="sys-card-head"><h2 id="sessoes-ativas">Sessões ativas</h2></div>
            <div class="sys-card-body" style="display:grid;gap:12px">
              ${active.length
                ? active
                    .map(
                      (session) => `
                        <article class="sys-card" style="box-shadow:none"><div class="sys-card-body" style="display:grid;gap:8px">
                          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><strong>${escapeHtml(session.restaurantName || session.restaurantKey)}</strong>${statusPill(translateMode(session.mode), normalize(session.mode) === "ADMIN" ? "warn" : "neutral", { dot: false })}</div>
                          <span class="sys-hint">${escapeHtml(session.displayName || session.login || "Equipe INOVAS")} · iniciada às ${escapeHtml(formatTime(session.createdAt))}</span>
                          <span>Motivo: ${escapeHtml(session.reason || "registrado na auditoria")}</span>
                          <span class="sys-meter" aria-hidden="true"><span style="width:${Math.max(0, Math.min(100, Math.round((minutesLeft(session.expiresAt) / (normalize(session.mode) === "ADMIN" ? 15 : 30)) * 100)))}%;background:#ff6a00"></span></span>
                          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><strong>${minutesLeft(session.expiresAt)} min restantes</strong><button class="sys-btn sys-btn-danger sys-btn-sm" type="button" data-support-revoke="${escapeHtml(session.id || session.supportSessionId || "")}">Encerrar agora</button></div>
                        </div></article>`
                    )
                    .join("")
                : '<p class="sys-hint" style="margin:0">Nenhuma sessão de suporte ativa para esta conta.</p>'}
            </div>
          </section>
          <section class="sys-card" aria-labelledby="encerradas">
            <div class="sys-card-head"><h2 id="encerradas">Encerradas recentemente</h2></div>
            <div class="sys-list">
              ${ended.length
                ? ended
                    .map(
                      (event) => `<div class="sys-list-item"><div class="sys-list-copy"><strong>${escapeHtml(event.restaurantName || event.targetName || "Restaurante")}</strong><span>${escapeHtml(event.metadata?.mode ? translateMode(event.metadata.mode) : "Sessão de suporte")} · ${escapeHtml(event.actorName || event.actorLogin || "Equipe INOVAS")}</span><span>${escapeHtml(event.reason || "Encerrada")}</span></div><span class="sys-hint">${escapeHtml(formatShort(event.createdAt))}</span></div>`
                    )
                    .join("")
                : '<div class="sys-list-item"><span class="sys-hint">Nenhuma sessão encerrada recentemente.</span></div>'}
              ${hasPermission("system.audit.view") ? '<div class="sys-list-item"><a class="sys-link" href="/system#audit?event=SUPPORT_SESSION_STARTED">Ver todos os eventos na auditoria</a></div>' : ""}
            </div>
          </section>
        </div>
      </div>`;
    syncSupportForm();
  };

  const startSupport = async (form) => {
    const errorNode = form.querySelector("[data-support-error]");
    const submit = form.querySelector("[data-support-submit]");
    if (!supportIsValid()) return;
    errorNode.hidden = true;
    submit.disabled = true;
    submit.textContent = "Iniciando sessão…";
    try {
      const payload = await requestJson("/api/support/start", {
        method: "POST",
        body: JSON.stringify({
          restaurantKey: state.support.restaurantKey,
          mode: state.support.mode,
          reason: state.support.reason.trim(),
          confirmed: state.support.confirmed === true,
        }),
      });
      const session = payload.data?.supportSession || {};
      state.support = { restaurantKey: state.support.restaurantKey, mode: "VIEW", reason: "", confirmed: false };
      notify("Sessão de suporte criada e registrada na auditoria.");
      if (dialog) {
        dialog.innerHTML = `
          <div class="sys-dialog-head"><div><span class="sys-eyebrow">Suporte auditado</span><h2>Sessão criada</h2></div><button class="sys-icon-btn" type="button" data-dialog-close aria-label="Fechar">${icon("close")}</button></div>
          <div class="sys-dialog-body">
            <p style="margin:0">Acesso ${escapeHtml(translateMode(session.mode).toLowerCase())} a <strong>${escapeHtml(session.restaurantName || "restaurante")}</strong> até ${escapeHtml(formatFull(session.expiresAt))}. O acesso é temporário, restrito a este restaurante e registrado na auditoria.</p>
          </div>
          <div class="sys-dialog-actions"><button class="sys-btn sys-btn-secondary" type="button" data-dialog-close>Fechar</button><a class="sys-btn sys-btn-primary" href="${escapeHtml(payload.data?.redirectTo || "/admin")}">Abrir restaurante em suporte</a></div>`;
        dialog.showModal();
      }
      await loadRoute();
    } catch (error) {
      errorNode.textContent = error.message;
      errorNode.hidden = false;
      submit.disabled = false;
      syncSupportForm();
    }
  };

  const revokeSupport = async () => {
    try {
      await requestJson("/api/support/revoke", { method: "POST" });
      notify("Sessão de suporte encerrada.");
      await loadRoute();
    } catch (error) {
      notify(error.status === 404 ? "Só é possível encerrar por aqui a sessão aberta neste navegador. As demais expiram sozinhas." : error.message);
    }
  };

  /* ---------- Auditoria ---------- */

  const describeTarget = (event) =>
    event.targetName ||
    event.restaurantName ||
    event.targetLogin ||
    event.metadata?.path ||
    event.metadata?.target ||
    (event.restaurantId ? "Restaurante" : "") ||
    (event.targetIdentityId ? "Usuário" : "") ||
    "Plataforma";

  // Nível do evento, como no esboço: Sensível, Alteração ou Rotina.
  const auditLevel = (event) => {
    const type = normalize(event.eventType);
    const result = normalize(event.result);
    if (["DENIED", "FAILED", "FAILURE", "ERROR"].includes(result)) return ["Negado", "crit"];
    if (/SUPPORT_SESSION_STARTED|PASSWORD|RESET|SUSPEND|BLOCK|DELETE|REMOVED|ROLE/.test(type)) return ["Sensível", "crit"];
    if (/CREATED|UPDATED|CHANGED|INVITE|PLAN|MODULE|DUPLICATED|ACTIVATED|DEACTIVATED/.test(type)) return ["Alteração", "warn"];
    return ["Rotina", "neutral"];
  };

  const auditRestaurant = (event) =>
    event.restaurantName || event.metadata?.restaurantName || event.restaurantKey || event.metadata?.restaurantKey || "";

  const AUDIT_SCOPES = Object.freeze([
    ["all", "Tudo"],
    ["support", "Sessões de suporte"],
    ["restaurants", "Restaurantes"],
    ["team", "Equipe INOVAS"],
    ["sensitive", "Só sensíveis"],
  ]);

  const auditScopeMatches = (event, scope) => {
    const type = normalize(event.eventType);
    if (scope === "support") return type.includes("SUPPORT");
    if (scope === "restaurants") return Boolean(auditRestaurant(event) || event.restaurantId);
    if (scope === "team") return !auditRestaurant(event) && !event.restaurantId && !type.includes("SUPPORT");
    if (scope === "sensitive") return auditLevel(event)[1] === "crit";
    return true;
  };

  const auditMatches = (event, filters) => {
    if (!auditScopeMatches(event, filters.scope || "all")) return false;
    const search = filters.search.trim().toLowerCase();
    if (search && !`${translateEvent(event.eventType)} ${event.eventType} ${event.actorName || ""} ${event.actorLogin || ""} ${describeTarget(event)} ${event.reason || ""} ${event.requestId || ""}`.toLowerCase().includes(search)) return false;
    if (filters.event && normalize(event.eventType) !== filters.event) return false;
    if (filters.result && normalize(event.result) !== filters.result) return false;
    if (filters.period && filters.period !== "all") {
      const date = parseDate(event.createdAt);
      if (!date || Date.now() - date.getTime() > Number(filters.period) * 86400000) return false;
    }
    return true;
  };

  const renderKeyValues = (value) => {
    if (!value || typeof value !== "object" || !Object.keys(value).length) return '<p class="sys-hint" style="margin:0">Sem dados registrados.</p>';
    return Object.entries(value)
      .slice(0, 12)
      .map(([key, entry]) => `<div><span>${escapeHtml(key)}</span><strong>${escapeHtml(typeof entry === "object" && entry !== null ? JSON.stringify(entry) : String(entry ?? "—"))}</strong></div>`)
      .join("");
  };

  const renderAuditDetail = (event) => {
    const root = document.querySelector("[data-audit-detail]");
    if (!root) return;
    if (!event) {
      root.innerHTML = "";
      return;
    }
    const [resultLabel] = translateResult(event.result);
    root.innerHTML = `
      <section class="sys-card" aria-label="Detalhe do evento destacado">
        <div class="sys-card-head"><div><span class="sys-eyebrow">Detalhe do evento destacado</span><h2>${escapeHtml(translateEvent(event.eventType))} · ${escapeHtml(formatShort(event.createdAt))}</h2></div><span>Request ID: ${escapeHtml(event.requestId || "—")}</span></div>
        <div class="sys-card-body sys-audit-detail">
          <div class="sys-kv"><h3>Antes</h3>${renderKeyValues(event.before)}</div>
          <div class="sys-kv"><h3>Depois</h3>${renderKeyValues(event.after)}</div>
          <div class="sys-kv"><h3>Contexto</h3>
            <p><span>Ator:</span> ${escapeHtml(event.actorName || event.actorLogin || "Sistema")}${event.actorType ? ` (${escapeHtml(translateRole(event.actorType))})` : ""}</p>
            <p><span>Alvo:</span> ${escapeHtml(describeTarget(event))}</p>
            <p><span>Resultado:</span> ${escapeHtml(resultLabel)}</p>
            <p><span>Motivo:</span> ${escapeHtml(event.reason || "—")}</p>
            ${event.supportSessionId ? `<p><span>Sessão de suporte:</span> ${escapeHtml(event.supportSessionId)}</p>` : ""}
            ${event.metadata && Object.keys(event.metadata).length ? renderKeyValues(event.metadata) : ""}
          </div>
        </div>
      </section>`;
  };

  const renderAuditRows = () => {
    const root = document.querySelector("[data-audit-results]");
    if (!root || !state.data) return;
    const events = (state.data.events || []).filter((event) => auditMatches(event, state.filters.audit));
    if (!events.some((event) => event.id === state.selectedAuditId)) state.selectedAuditId = events[0]?.id || "";
    state.auditVisible = events;
    root.innerHTML = events.length
      ? `<div class="sys-table-wrap"><table class="sys-table is-stack sys-audit-table" aria-label="Eventos de auditoria"><thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Restaurante</th><th>Motivo</th><th>Nível</th></tr></thead><tbody>
        ${events
          .slice(0, 100)
          .map((event) => {
            const [levelLabel, tone] = auditLevel(event);
            const selected = event.id === state.selectedAuditId;
            return `<tr class="is-clickable ${selected ? "is-selected" : ""}" data-audit-row="${escapeHtml(event.id)}" tabindex="0" role="button" aria-pressed="${selected}"><td data-label="Quando">${escapeHtml(formatShort(event.createdAt))}</td><td data-label="Quem"><strong>${escapeHtml(event.actorName || event.actorLogin || "Sistema")}</strong></td><td data-label="Ação"><strong>${escapeHtml(translateEvent(event.eventType))}</strong><code>${escapeHtml(event.eventType)}</code></td><td data-label="Restaurante">${escapeHtml(auditRestaurant(event) || "—")}</td><td data-label="Motivo">${escapeHtml(event.reason || "—")}</td><td data-label="Nível">${statusPill(levelLabel, tone, { dot: false })}</td></tr>`;
          })
          .join("")}
        </tbody></table></div>${events.length > 100 ? `<div class="sys-table-caption">Mostrando 100 de ${events.length} eventos. Refine os filtros para ver os demais.</div>` : ""}`
      : renderEmpty("Nenhum evento encontrado", "Ajuste o período ou os filtros para ampliar a busca.");
    renderAuditDetail(events.find((event) => event.id === state.selectedAuditId));
  };

  const renderAudit = (data) => {
    const events = data.events || [];
    if (state.query.get("event")) state.filters.audit.event = normalize(state.query.get("event"));
    const eventTypes = [...new Set(events.map((event) => normalize(event.eventType)))].sort();
    const active = Array.isArray(data.activeSupportSessions) ? data.activeSupportSessions : [];
    const scope = state.filters.audit.scope || "all";
    app.innerHTML = `
      ${renderHead({
        eyebrow: "Equipe INOVAS · rastreabilidade",
        title: "Auditoria e sessões de suporte",
        description: "Tudo o que a equipe INOVAS fez nos restaurantes e no System: quem, quando, onde e por quê. Os registros não podem ser editados nem apagados.",
        actions: `<button class="sys-btn sys-btn-secondary" type="button" data-audit-export>${icon("audit", 16)}Exportar CSV</button>`,
      })}
      <section class="sys-live-sessions" aria-labelledby="sessoes-andamento">
        <div class="sys-live-head"><h2 id="sessoes-andamento"><span class="sys-live-dot" aria-hidden="true"></span>Sessões de suporte em andamento</h2><span>Encerram sozinhas no prazo</span></div>
        ${active.length
          ? active
              .map(
                (session) => `
                  <div class="sys-live-row">
                    <span class="sys-avatar" aria-hidden="true">${escapeHtml(getInitials(session.displayName || session.login || "IN"))}</span>
                    <div class="sys-live-copy"><strong>${escapeHtml(session.displayName || session.login || "Equipe INOVAS")} → ${escapeHtml(session.restaurantName || session.restaurantKey || "Restaurante")}</strong><span>Motivo: ${escapeHtml(session.reason || "registrado na auditoria")}</span></div>
                    <span class="sys-live-mode">${escapeHtml(normalize(session.mode) === "ADMIN" ? "Administrativo" : "Somente leitura")}</span>
                    <span class="sys-live-time">${icon("clock", 16)}termina em ${escapeHtml(String(minutesLeft(session.expiresAt)))} min</span>
                    <button class="sys-btn sys-btn-sm sys-live-end" type="button" data-support-revoke="${escapeHtml(session.id || session.supportSessionId || "")}">Encerrar agora</button>
                  </div>`
              )
              .join("")
          : '<p class="sys-live-empty">Nenhuma sessão de suporte aberta agora.</p>'}
      </section>
      <section class="sys-card sys-audit-card" aria-label="Eventos">
        <div class="sys-audit-toolbar">
          <div class="sys-chips" role="tablist" aria-label="Filtrar eventos">
            ${AUDIT_SCOPES.map(([key, label]) => `<button type="button" role="tab" class="sys-chip ${scope === key ? "is-active" : ""}" aria-selected="${scope === key}" data-audit-scope="${key}">${escapeHtml(label)}</button>`).join("")}
            ${state.filters.audit.event ? `<button type="button" class="sys-chip is-filter" data-audit-clear-event>${escapeHtml(translateEvent(state.filters.audit.event))} ✕</button>` : ""}
          </div>
          <div class="sys-audit-tools">
            <label class="sys-search"><span class="sr-only">Buscar por pessoa, ação ou motivo</span>${icon("search", 16, "#6b7280")}<input class="sys-input" type="search" data-audit-filter="search" placeholder="Buscar" value="${escapeHtml(state.filters.audit.search)}" /></label>
            <label><span class="sr-only">Período</span><select class="sys-select" data-audit-filter="period"><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="all">Todo o período</option></select></label>
          </div>
        </div>
        <div data-audit-results></div>
      </section>
      <div data-audit-detail></div>`;
    void eventTypes;
    for (const select of app.querySelectorAll("select[data-audit-filter]")) {
      select.value = state.filters.audit[select.dataset.auditFilter] || "";
      if (select.value !== (state.filters.audit[select.dataset.auditFilter] || "")) {
        state.filters.audit[select.dataset.auditFilter] = select.value;
      }
    }
    renderAuditRows();
  };

  // Exporta só o que está filtrado na tela, gerado no navegador.
  const exportAuditCsv = () => {
    const events = state.auditVisible || [];
    if (!events.length) return notify("Nenhum evento para exportar com esses filtros.");
    const cell = (value) => {
      let text = String(value ?? "");
      if (/^[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const header = ["Quando", "Quem", "Ação", "Código", "Restaurante", "Motivo", "Nível", "Resultado"];
    const lines = events.map((event) =>
      [
        event.createdAt || "",
        event.actorName || event.actorLogin || "Sistema",
        translateEvent(event.eventType),
        event.eventType || "",
        auditRestaurant(event),
        event.reason || "",
        auditLevel(event)[0],
        translateResult(event.result)[0],
      ].map(cell).join(";")
    );
    const blob = new Blob([`﻿${header.map(cell).join(";")}\n${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `auditoria-inovas-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  /* ---------- roteamento ---------- */

  const renderers = { overview: renderOverview, restaurants: renderRestaurants, support: renderSupport, audit: renderAudit };

  const firstAllowedRoute = () => Object.values(ROUTES).find((route) => hasPermission(route.permission));

  const loadRoute = async () => {
    const { key, query } = parseHash();
    const route = ROUTES[key];
    if (!route || !hasPermission(route.permission)) {
      const fallback = firstAllowedRoute();
      if (fallback && fallback.key !== key) {
        window.location.replace(fallback.key === "overview" ? "/system" : `/system#${fallback.key}`);
        return;
      }
      const error = new Error("Seu perfil não possui acesso a esta área.");
      error.status = 403;
      throw error;
    }
    state.route = route.key;
    state.query = query;
    if (route.key === "restaurants" && query.get("key")) state.selectedRestaurantKey = query.get("key");
    if (route.key === "restaurants" && query.has("search")) state.filters.restaurants.search = query.get("search") || "";
    shell.mount({ session: state.session, activeKey: route.key, logoutAttribute: "data-system-logout" });
    renderLoading(route.label);
    const payload = await requestJson(route.endpoint);
    state.data = payload.data || {};
    renderers[route.key](state.data);
    document.title = `${route.label} | Painel System INOVAS`;
  };

  const clearAuthenticationState = () => {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      try {
        for (let index = storage.length - 1; index >= 0; index -= 1) {
          const key = storage.key(index) || "";
          if (/auth|session|token|support/i.test(key)) storage.removeItem(key);
        }
      } catch {
        // armazenamento indisponível
      }
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
    clearAuthenticationState();
    window.location.replace("/system/login.html");
  };

  /* ---------- eventos ---------- */

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-system-logout]")) return void logout();
    if (event.target.closest("[data-system-retry]")) return void loadRoute().catch(renderError);
    if (event.target.closest("[data-dialog-close]")) return dialog?.close();
    const revoke = event.target.closest("[data-support-revoke]");
    if (revoke) return void revokeSupport();
    const restaurantRow = event.target.closest("[data-restaurant-row]");
    if (restaurantRow) {
      state.selectedRestaurantKey = restaurantRow.dataset.restaurantRow;
      renderRestaurantsList();
      return;
    }
    const auditScope = event.target.closest("[data-audit-scope]");
    if (auditScope) {
      state.filters.audit.scope = auditScope.dataset.auditScope;
      for (const chip of document.querySelectorAll("[data-audit-scope]")) {
        const on = chip === auditScope;
        chip.classList.toggle("is-active", on);
        chip.setAttribute("aria-selected", String(on));
      }
      renderAuditRows();
      return;
    }
    if (event.target.closest("[data-audit-clear-event]")) {
      state.filters.audit.event = "";
      event.target.closest("[data-audit-clear-event]").remove();
      renderAuditRows();
      return;
    }
    if (event.target.closest("[data-audit-export]")) return void exportAuditCsv();
    const auditRow = event.target.closest("[data-audit-row]");
    if (auditRow) {
      state.selectedAuditId = auditRow.dataset.auditRow;
      renderAuditRows();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target.closest("[data-restaurant-row], [data-audit-row]");
    if (!row) return;
    event.preventDefault();
    row.click();
  });

  document.addEventListener("input", (event) => {
    const restaurantFilter = event.target.closest("[data-restaurant-filter]");
    if (restaurantFilter) {
      state.filters.restaurants[restaurantFilter.dataset.restaurantFilter] = restaurantFilter.value;
      renderRestaurantsList();
      return;
    }
    const auditFilter = event.target.closest("[data-audit-filter]");
    if (auditFilter) {
      state.filters.audit[auditFilter.dataset.auditFilter] = auditFilter.value;
      renderAuditRows();
      return;
    }
    const supportField = event.target.closest("[data-support-field]");
    if (supportField) {
      const field = supportField.dataset.supportField;
      state.support[field] = field === "confirmed" ? supportField.checked : supportField.value;
      syncSupportForm();
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.name === "mode" && event.target.closest("[data-support-form]")) {
      state.support.mode = event.target.value === "ADMIN" && hasPermission("system.support.admin") ? "ADMIN" : "VIEW";
      syncSupportForm();
      return;
    }
    const supportField = event.target.closest("[data-support-field]");
    if (supportField) {
      const field = supportField.dataset.supportField;
      state.support[field] = field === "confirmed" ? supportField.checked : supportField.value;
      syncSupportForm();
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
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) void init();
  });
  void init();
})();
