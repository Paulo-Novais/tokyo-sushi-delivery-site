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
    billing: { key: "billing", label: "Mensalidades e repasses", permission: "system.billing.view", endpoint: "/api/system/billing" },
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
    SUPPORT_ACTION_PERFORMED: "Ação no restaurante em suporte",
    SYSTEM_USER_CREATED: "Usuário criado",
    SYSTEM_USER_UPDATED: "Usuário atualizado",
    SYSTEM_USER_BLOCKED: "Usuário bloqueado",
    SYSTEM_USER_DEACTIVATED: "Usuário desativado",
    SYSTEM_USER_ACTIVATED: "Usuário ativado",
    SYSTEM_USER_SESSIONS_REVOKED: "Sessões encerradas",
    SYSTEM_USER_INVITATION_REISSUED: "Convite reenviado",
    SYSTEM_ACCESS_DENIED: "Acesso negado",
    SYSTEM_RESTAURANT_SUSPENDED: "Restaurante suspenso",
    SYSTEM_RESTAURANT_REACTIVATED: "Restaurante reativado",
    SYSTEM_RESTAURANT_UPDATED: "Dados do restaurante alterados",
    SYSTEM_RESTAURANT_DOMAIN_UPDATED: "Domínio do restaurante alterado",
    SYSTEM_RESTAURANT_SITE_PUBLISHED: "Site do restaurante publicado",
    SYSTEM_RESTAURANT_SITE_UNPUBLISHED: "Site do restaurante tirado do ar",
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
    PREMIUM: "Completo",
    TRIAL: "Avaliação",
    FREE: "Grátis",
    BASIC: "Essencial",
    START: "Essencial",
    BUSINESS: "Profissional",
    PRO: "Completo",
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
    support: { restaurantKey: "", mode: "ADMIN", reason: "", confirmed: false },
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
  const translateMode = (value) => (normalize(value) === "ADMIN" ? "Acesso total" : "Visualização");

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

  const restaurantSiteIsLive = (restaurant) =>
    restaurant.publicSiteEnabled !== false &&
    !["SUSPENDED", "BLOCKED", "INACTIVE", "NOT_REGISTERED"].includes(normalize(restaurant.status));

  const isRestaurantSuspended = (restaurant) => ["SUSPENDED", "BLOCKED"].includes(normalize(restaurant.status));

  const actionButton = (label, attrs, { tone = "secondary", permission, help = "" } = {}) => {
    const allowed = hasPermission(permission);
    return `<button class="sys-btn sys-btn-${tone}" type="button" ${attrs} ${allowed ? "" : 'disabled aria-disabled="true"'}>${escapeHtml(label)}</button>
          <p class="sys-action-help">${escapeHtml(allowed ? help : `Requer ${permission}`)}</p>`;
  };

  const renderRestaurantAdminActions = (restaurant) => {
    const key = escapeHtml(restaurant.restaurantKey);
    if (!restaurant.administrativeActions?.supportAvailable) {
      return '<p class="sys-action-help">Restaurante ainda não cadastrado na plataforma.</p>';
    }
    const suspended = isRestaurantSuspended(restaurant);
    return [
      actionButton(
        restaurant.publicSiteEnabled === false ? "Publicar site" : "Tirar site do ar",
        `data-restaurant-action="site" data-key="${key}"`,
        { permission: "system.restaurants.edit", help: restaurant.publicSiteEnabled === false ? "Coloca o endereço INOVAS no ar." : "O endereço INOVAS deixa de abrir." }
      ),
      actionButton("Editar dados de plataforma", `data-restaurant-action="edit" data-key="${key}"`, {
        permission: "system.restaurants.edit",
        help: "Nome e plano.",
      }),
      actionButton(restaurant.customDomain ? "Gerenciar domínio próprio" : "Vincular domínio próprio", `data-restaurant-action="domain" data-key="${key}"`, {
        permission: "system.domains.manage",
        help: "Opcional · + R$ 40/mês.",
      }),
      actionButton(suspended ? "Reativar acesso" : "Suspender acesso", `data-restaurant-action="status" data-key="${key}"`, {
        tone: suspended ? "primary" : "danger",
        permission: "system.restaurants.suspend",
        help: suspended ? "Libera Gestor e site de novo." : "Ação crítica · bloqueia Gestor e site · exige motivo.",
      }),
    ].join("\n          ");
  };

  const findRestaurant = (key) => (state.data?.restaurants || []).find((restaurant) => restaurant.restaurantKey === key);

  const slugify = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

  const openDialog = (html, { wide = false } = {}) => {
    if (!dialog) return;
    dialog.innerHTML = html;
    dialog.classList.toggle("is-wide", wide);
    dialog.showModal();
  };

  const dialogHead = (eyebrow, title) =>
    `<div class="sys-dialog-head"><div><span class="sys-eyebrow">${escapeHtml(eyebrow)}</span><h2>${escapeHtml(title)}</h2></div><button class="sys-icon-btn" type="button" data-dialog-close aria-label="Fechar">${icon("close")}</button></div>`;

  const field = (label, input, hint = "") =>
    `<label class="sys-field"><span>${escapeHtml(label)}</span>${input}${hint ? `<small class="sys-hint">${escapeHtml(hint)}</small>` : ""}</label>`;

  const planOptions = (selected) =>
    ["START", "BUSINESS", "PRO", "PREMIUM"]
      .map((plan) => `<option value="${plan}" ${normalize(selected) === plan ? "selected" : ""}>${escapeHtml(translatePlan(plan))}</option>`)
      .join("");

  // ---------- Cadastro novo de restaurante (8 etapas numa tela só) ----------
  const WIZ_PLANS = [
    ["FREE", "Grátis", 0, "até 50 pedidos/mês"],
    ["START", "Essencial", 49.9, "site + pedidos"],
    ["BUSINESS", "Profissional", 149.9, "salão, estoque, financeiro"],
    ["PRO", "Completo", 219.9, "tudo + domínio próprio"],
  ];
  const WIZ_ADDON_PLANS = ["BUSINESS", "PRO"];
  const WIZ_NFCE_PRICE = 49.9;
  const WIZ_CATEGORIES = [
    ["DELIVERY", "Delivery", "até 50/dia", "Só entrega e retirada (dark kitchen, lanchonete).", "Conta compartilhada INOVAS"],
    ["RESTAURANT", "Restaurante", "50 a 120/dia", "Salão + delivery + retirada. Caixa, mesas e app do garçom.", "Conta compartilhada INOVAS"],
    ["SUPER", "Super Restaurante", "+120/dia", "Alto volume, almoço e jantar.", "Brasil NFe (ilimitada)"],
  ];
  const WIZ_CYCLES = [
    ["MONTHLY", "Mensal", 1],
    ["QUARTERLY", "Trimestral", 3],
    ["SEMIANNUAL", "Semestral", 6],
    ["ANNUAL", "Anual", 12],
  ];
  const WIZ_COLORS = [["#c8102e", "Vermelho"], ["#ff6a00", "Laranja"], ["#0f766e", "Verde"], ["#1d4ed8", "Azul"], ["#111827", "Preto"]];
  const wizMoney = (value) => `R$ ${Number(value || 0).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  // Igual a lib/billing-cycles.cjs: trimestral e semestral R$ 5 a menos por mês; anual 8%.
  const wizCycleCharge = (monthly, cycle) => {
    const months = (WIZ_CYCLES.find((entry) => entry[0] === cycle) || WIZ_CYCLES[0])[2];
    const cents = Math.round(monthly * 100) * months;
    if (cycle === "QUARTERLY" || cycle === "SEMIANNUAL") return Math.max(0, cents - 500 * months) / 100;
    if (cycle === "ANNUAL") return Math.round(cents * 0.92) / 100;
    return cents / 100;
  };
  const wizSuggestCategory = (orders, dining) => (orders > 120 ? "SUPER" : orders > 50 || dining ? "RESTAURANT" : "DELIVERY");

  const renderCreateWizard = () => {
    const today = new Date().toISOString().slice(0, 10);
    const steps = [
      ["empresa", "Empresa", "CNPJ, endereço, impostos"],
      ["dono", "Dono", "Acesso ao Gestor"],
      ["categoria", "Categoria", "Delivery, Restaurante ou Super"],
      ["plano", "Plano e cobrança", "Plano, ciclo, adicionais"],
      ["site", "Site e domínio", "Endereço e cor"],
      ["nota", "Nota fiscal", "Serviço e próximos passos"],
      ["pagamento", "Pagamento online", "Pix e crédito"],
      ["revisao", "Revisão", "Contrato e publicar"],
    ];
    const box = (id, title, sub, body) =>
      `<section class="sys-wiz-section" id="wiz-${id}" data-wiz-section="${id}"><div class="sys-wiz-head"><h3>${escapeHtml(title)}</h3>${sub ? `<p>${escapeHtml(sub)}</p>` : ""}</div>${body}</section>`;
    return `
      <form class="sys-dialog-form sys-wiz" data-restaurant-form="create">
        ${dialogHead("Painel INOVAS · cadastro", "Novo restaurante")}
        <div class="sys-wiz-layout">
          <nav class="sys-wiz-nav" aria-label="Etapas do cadastro">
            ${steps.map(([id, title, sub], index) => `<a href="#wiz-${id}" data-wiz-step="${id}"><span class="sys-wiz-dot">${index + 1}</span><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(sub)}</small></span></a>`).join("")}
          </nav>
          <div class="sys-wiz-body">
            ${box("empresa", "1. Empresa", "Comece pelo CNPJ (MEI também tem): os dados da Receita Federal são preenchidos sozinhos.", `
              <div class="sys-wiz-cnpj">
                <label class="sys-field"><span>CNPJ</span><span class="sys-wiz-inline"><input class="sys-input" name="document" required inputmode="numeric" autocomplete="off" maxlength="18" placeholder="00.000.000/0000-00" data-wiz-cnpj /><button class="sys-btn sys-btn-secondary" type="button" data-wiz-lookup="cnpj">Buscar de novo</button></span></label>
                <div class="sys-wiz-receita" data-wiz-receita hidden></div>
              </div>
              <div class="sys-wiz-grid">
                ${field("Nome do restaurante (fantasia)", '<input class="sys-input" name="name" required maxlength="120" data-slug-source />')}
                ${field("Razão social", '<input class="sys-input" name="legalName" maxlength="180" />')}
                ${field("Inscrição estadual", '<input class="sys-input" name="stateRegistration" maxlength="40" inputmode="numeric" />', "Necessária para a nota fiscal. Deixe vazio se for isento.")}
                ${field("Regime de impostos", '<select class="sys-select" name="taxRegime"><option value="SIMPLES">Simples Nacional</option><option value="MEI">MEI</option><option value="PRESUMIDO">Lucro Presumido</option><option value="REAL">Lucro Real</option></select>')}
                ${field("WhatsApp do restaurante", '<input class="sys-input" name="whatsapp" required inputmode="tel" placeholder="16 99999-9999" />')}
              </div>
              <div class="sys-wiz-grid is-address">
                <label class="sys-field"><span>CEP</span><span class="sys-wiz-inline"><input class="sys-input" name="postalCode" required inputmode="numeric" /><button class="sys-btn sys-btn-secondary" type="button" data-wiz-lookup="cep">Buscar</button></span></label>
                ${field("Rua", '<input class="sys-input" name="street" required />')}
                ${field("Número", '<input class="sys-input" name="number" required />')}
                ${field("Complemento", '<input class="sys-input" name="complement" />')}
                ${field("Bairro", '<input class="sys-input" name="neighborhood" />')}
                ${field("Cidade", '<input class="sys-input" name="city" required />')}
                ${field("Estado (UF)", '<input class="sys-input" name="state" required maxlength="2" />')}
              </div>
              <p class="sys-hint" data-wiz-lookup-status hidden></p>`)}
            ${box("dono", "2. Dono (acesso ao Gestor)", "O dono entra no Gestor com este e-mail. Mande a senha inicial pelo WhatsApp e peça para trocar no primeiro acesso.", `
              <div class="sys-wiz-grid">
                ${field("Nome completo", '<input class="sys-input" name="ownerName" required maxlength="160" />')}
                ${field("CPF do dono", '<input class="sys-input" name="ownerCpf" inputmode="numeric" />', "Para o contrato e o recebedor do pagamento online.")}
                ${field("E-mail (login do Gestor)", '<input class="sys-input" type="email" name="email" required />')}
                <label class="sys-field"><span>Senha inicial</span><span class="sys-wiz-inline"><input class="sys-input" type="text" name="password" required minlength="10" autocomplete="new-password" spellcheck="false" /><button class="sys-btn sys-btn-secondary" type="button" data-wiz-generate-password>Gerar</button></span><small class="sys-hint">Mínimo de 10 caracteres.</small></label>
              </div>`)}
            ${box("categoria", "3. Categoria", "Define as telas do restaurante e, por baixo, o serviço de nota fiscal mais barato. O restaurante não vê essa escolha.", `
              <div class="sys-wiz-grid">
                ${field("Pedidos por dia (média)", '<input class="sys-input" type="number" min="0" max="5000" name="expectedDailyOrders" value="40" />', "Acima de 120 por dia, o sistema sugere Super Restaurante.")}
                <fieldset class="sys-wiz-checks"><legend>Como atende</legend>
                  <label><input type="checkbox" name="serviceModes" value="delivery" checked />Delivery</label>
                  <label><input type="checkbox" name="serviceModes" value="pickup" checked />Retirada</label>
                  <label><input type="checkbox" name="serviceModes" value="dining" />Salão (mesas e garçom)</label>
                  <label><input type="checkbox" name="serviceModes" value="twoShifts" />Almoço e jantar</label>
                </fieldset>
              </div>
              <div class="sys-wiz-cards" role="radiogroup" aria-label="Categoria">
                ${WIZ_CATEGORIES.map(([key, label, tag, desc, nfe]) => `
                  <label class="sys-wiz-card" data-wiz-category-card="${key}">
                    <input type="radio" name="category" value="${key}" ${key === "DELIVERY" ? "checked" : ""} />
                    <span class="sys-wiz-card-top"><strong>${escapeHtml(label)}</strong><em>${escapeHtml(tag)}</em></span>
                    <span>${escapeHtml(desc)}</span>
                    <small>Nota fiscal: <b>${escapeHtml(nfe)}</b></small>
                  </label>`).join("")}
              </div>
              <p class="sys-hint" data-wiz-category-hint></p>`)}
            ${box("plano", "4. Plano e cobrança", "", `
              <div class="sys-wiz-cards is-plans" role="radiogroup" aria-label="Plano">
                ${WIZ_PLANS.map(([key, label, price, sub]) => `
                  <label class="sys-wiz-card">
                    <input type="radio" name="plan" value="${key}" ${key === "BUSINESS" ? "checked" : ""} />
                    <strong>${escapeHtml(label)}</strong>
                    <span class="sys-wiz-price">${escapeHtml(wizMoney(price))}</span>
                    <small>${escapeHtml(sub)}</small>
                  </label>`).join("")}
              </div>
              <div class="sys-wiz-grid">
                <label class="sys-field"><span>Ciclo de cobrança</span><select class="sys-select" name="billingCycle" data-wiz-cycle>${WIZ_CYCLES.map(([key, label]) => `<option value="${key}">${escapeHtml(label)}</option>`).join("")}</select></label>
                ${field("Início do contrato", `<input class="sys-input" type="date" name="adhesionDate" value="${today}" required />`)}
              </div>
              <label class="sys-wiz-addon" data-wiz-addon="nfce">
                <span><input type="checkbox" name="addons" value="nfce" /><span><strong>Nota fiscal automática (NFC-e)</strong><small data-wiz-addon-note>Profissional e Completo · notas ilimitadas para o restaurante</small></span></span>
                <strong>+ ${escapeHtml(wizMoney(WIZ_NFCE_PRICE))}/mês</strong>
              </label>
              <div class="sys-wiz-total"><span data-wiz-total-label>Total</span><strong data-wiz-total>—</strong></div>`)}
            ${box("site", "5. Site e domínio", "O site entra no ar assim que o cadastro termina.", `
              <div class="sys-wiz-grid">
                <label class="sys-field"><span>Endereço INOVAS</span><span class="sys-wiz-prefix"><span>inovasfood.com.br/</span><input class="sys-input" name="slug" required pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?" minlength="3" maxlength="60" data-slug-target /></span><small class="sys-hint" data-wiz-slug-status></small></label>
                <label class="sys-field" data-wiz-domain><span>Domínio próprio (opcional)</span><input class="sys-input" name="customDomain" placeholder="www.restaurante.com.br" /><small class="sys-hint" data-wiz-domain-note>Incluído no Completo. Nos outros planos, vincule depois no detalhe do restaurante (+ R$ 40/mês).</small></label>
              </div>
              <fieldset class="sys-wiz-colors"><legend>Cor principal do site</legend>
                ${WIZ_COLORS.map(([hex, label], index) => `<label><input type="radio" name="primaryColor" value="${hex}" ${index === 0 ? "checked" : ""} /><span style="background:${hex}" aria-hidden="true"></span>${escapeHtml(label)}</label>`).join("")}
              </fieldset>
              <p class="sys-hint">Logo e foto de capa: o dono envia em Gestor → Configurações → Aparência.</p>`)}
            ${box("nota", "6. Nota fiscal (NFC-e)", "", `
              <div class="sys-wiz-info" data-wiz-nfce-off>Sem nota fiscal automática. Dá para ligar depois, nos planos Profissional e Completo.</div>
              <div class="sys-wiz-info is-on" data-wiz-nfce-on hidden>
                <strong>Serviço: <span data-wiz-nfce-provider>—</span></strong>
                <span>O dono completa no Gestor: certificado digital A1 (arquivo .pfx e senha), CSC da Sefaz e os códigos fiscais do cardápio (sugeridos pelo sistema, conferidos pelo contador dele). A nota só começa a sair depois disso.</span>
              </div>`)}
            ${box("pagamento", "7. Pagamento online e repasse", "A conta bancária é do dono: ele cadastra em Gestor → Configurações → Pagamentos (obrigatório).", `
              <div class="sys-wiz-pay">
                <div><strong>Pix</strong><small>Taxa INOVAS 0%</small></div>
                <div><strong>Crédito</strong><small>Taxa INOVAS 1,5%</small></div>
                <div class="is-soon"><strong>Débito e VR/VA</strong><small>Em breve · aceitos na entrega</small></div>
              </div>
              <p class="sys-hint">Repasse toda quarta-feira, com extrato de vendas, taxas e mensalidade.</p>`)}
            ${box("revisao", "8. Revisão e contrato", "", `
              <dl class="sys-wiz-summary" data-wiz-summary></dl>
              <label class="sys-wiz-accept"><input type="checkbox" name="contractAccepted" required />O dono aceitou o contrato INOVAS e a política de taxas.</label>
              <p class="sys-alert is-error" data-dialog-error hidden role="alert"></p>`)}
          </div>
        </div>
        <div class="sys-dialog-actions"><button class="sys-btn sys-btn-secondary" type="button" data-dialog-close>Cancelar</button><button class="sys-btn sys-btn-primary" type="submit">Cadastrar e publicar site</button></div>
      </form>`;
  };

  // Atualiza sugestão de categoria, total, nota fiscal e resumo enquanto digita.
  const updateCreateWizard = (form) => {
    if (!form || form.dataset.restaurantForm !== "create" || !form.classList.contains("sys-wiz")) return;
    const get = (name) => form.elements[name];
    const orders = Number(get("expectedDailyOrders")?.value || 0);
    const modes = [...form.querySelectorAll('input[name="serviceModes"]:checked')].map((input) => input.value);
    const suggested = wizSuggestCategory(orders, modes.includes("dining"));
    if (!form.dataset.categoryTouched) {
      const radio = form.querySelector(`input[name="category"][value="${suggested}"]`);
      if (radio) radio.checked = true;
    }
    const category = form.querySelector('input[name="category"]:checked')?.value || suggested;
    const hint = form.querySelector("[data-wiz-category-hint]");
    if (hint) {
      const label = (WIZ_CATEGORIES.find((entry) => entry[0] === suggested) || [])[1];
      hint.textContent = category === suggested ? `Sugerido pelo volume: ${label}.` : `Sugerido pelo volume: ${label}. Você escolheu outra categoria.`;
    }
    const plan = form.querySelector('input[name="plan"]:checked')?.value || "BUSINESS";
    const planPrice = (WIZ_PLANS.find((entry) => entry[0] === plan) || [])[2] || 0;
    const addonAllowed = WIZ_ADDON_PLANS.includes(plan);
    const addonInput = form.querySelector('input[name="addons"][value="nfce"]');
    if (addonInput) {
      addonInput.disabled = !addonAllowed;
      if (!addonAllowed) addonInput.checked = false;
      form.querySelector("[data-wiz-addon]")?.classList.toggle("is-disabled", !addonAllowed);
    }
    const nfce = Boolean(addonInput?.checked);
    const monthly = planPrice + (nfce ? WIZ_NFCE_PRICE : 0);
    const cycle = get("billingCycle")?.value || "MONTHLY";
    const cycleEntry = WIZ_CYCLES.find((entry) => entry[0] === cycle) || WIZ_CYCLES[0];
    const charge = wizCycleCharge(monthly, cycle);
    const totalNode = form.querySelector("[data-wiz-total]");
    const totalLabel = form.querySelector("[data-wiz-total-label]");
    if (totalNode) totalNode.textContent = cycle === "MONTHLY" ? `${wizMoney(monthly)}/mês` : `${wizMoney(charge)} a cada ${cycleEntry[2]} meses`;
    if (totalLabel) totalLabel.textContent = cycle === "MONTHLY" ? "Total mensal" : `Total ${cycleEntry[1].toLowerCase()} (com desconto)`;
    const domainField = form.querySelector("[data-wiz-domain]");
    const domainInput = get("customDomain");
    if (domainInput) {
      domainInput.disabled = plan !== "PRO";
      if (plan !== "PRO") domainInput.value = "";
    }
    domainField?.classList.toggle("is-disabled", plan !== "PRO");
    const providerLabel = category === "SUPER" ? "Brasil NFe (ilimitada)" : "Conta compartilhada INOVAS";
    form.querySelector("[data-wiz-nfce-off]")?.toggleAttribute("hidden", nfce);
    form.querySelector("[data-wiz-nfce-on]")?.toggleAttribute("hidden", !nfce);
    const providerNode = form.querySelector("[data-wiz-nfce-provider]");
    if (providerNode) providerNode.textContent = providerLabel;
    const slug = slugify(get("slug")?.value || "");
    const taken = slug && (state.data?.restaurants || []).some((restaurant) => [restaurant.slug, restaurant.restaurantKey].includes(slug));
    const slugStatus = form.querySelector("[data-wiz-slug-status]");
    if (slugStatus) {
      slugStatus.textContent = !slug ? "" : taken ? "Já está em uso. Escolha outro." : `Site: inovasfood.com.br/${slug}`;
      slugStatus.classList.toggle("is-error", Boolean(taken));
    }
    const summary = form.querySelector("[data-wiz-summary]");
    if (summary) {
      const rows = [
        ["Restaurante", get("name")?.value || "—"],
        ["Categoria", (WIZ_CATEGORIES.find((entry) => entry[0] === category) || [])[1] || "—"],
        ["Plano", `${(WIZ_PLANS.find((entry) => entry[0] === plan) || [])[1]} · ${cycleEntry[1].toLowerCase()}`],
        ["Adicionais", nfce ? "Nota fiscal automática" : "Nenhum"],
        ["Cobrança", totalNode?.textContent || "—"],
        ["Site", slug ? `inovasfood.com.br/${slug}` : "—"],
        ["Domínio próprio", get("customDomain")?.value || "Não"],
        ["Nota fiscal", nfce ? providerLabel : "Desligada"],
        ["Dono", get("email")?.value || "—"],
      ];
      summary.innerHTML = rows.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
    }
  };

  const runWizardLookup = async (form, kind) => {
    const status = form.querySelector("[data-wiz-lookup-status]");
    const show = (text, isError = false) => {
      if (!status) return;
      status.hidden = false;
      status.textContent = text;
      status.classList.toggle("is-error", isError);
    };
    const value = onlyDigits(form.elements[kind === "cnpj" ? "document" : "postalCode"]?.value);
    show(kind === "cnpj" ? "Buscando CNPJ na Receita…" : "Buscando CEP…");
    try {
      const payload = await requestJson(`/api/system/lookup/${kind}/${value}`);
      const result = (payload.data || payload)[kind] || {};
      // Dados da empresa vêm da Receita (sobrescreve); do dono, só se vazio.
      const set = (name, next, { overwrite = kind === "cnpj" } = {}) => {
        const input = form.elements[name];
        if (input && next && (overwrite || !input.value)) input.value = next;
      };
      const address = kind === "cnpj" ? result.address || {} : result;
      if (kind === "cnpj") {
        set("legalName", result.legalName);
        const fantasy = result.tradeName || result.legalName;
        if (fantasy && !form.elements.name.value) {
          form.elements.name.value = fantasy.replace(/\b\w+/g, (word) => word.charAt(0) + word.slice(1).toLowerCase());
          form.elements.name.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (result.mei) form.elements.taxRegime.value = "MEI";
        else if (result.simples) form.elements.taxRegime.value = "SIMPLES";
        set("number", address.number);
        set("complement", address.complement);
        set("whatsapp", result.phone, { overwrite: false });
        set("ownerName", (result.partners || [])[0], { overwrite: false });
        form.dataset.cnpjChecked = onlyDigits(result.cnpj || value);
        form.dataset.cnpjBlocked = result.active === false ? result.status || "irregular" : "";
        const card = form.querySelector("[data-wiz-receita]");
        if (card) {
          card.hidden = false;
          card.classList.toggle("is-blocked", result.active === false);
          card.innerHTML = `
            <strong>${escapeHtml(result.legalName || "Empresa")}</strong>
            <span>Situação na Receita: <b>${escapeHtml(result.status || "—")}</b>${result.mei ? " · MEI" : result.simples ? " · Simples Nacional" : ""}</span>
            ${result.mainActivity ? `<span>Atividade: ${escapeHtml(result.mainActivity)}</span>` : ""}
            ${(result.partners || []).length ? `<span>Sócios: ${escapeHtml(result.partners.join(", "))}</span>` : ""}
            ${result.active === false ? "<span><b>Este CNPJ não está ativo. O cadastro fica bloqueado.</b></span>" : ""}`;
        }
      }
      set("postalCode", address.postalCode);
      set("street", address.street);
      set("neighborhood", address.neighborhood);
      set("city", address.city);
      set("state", address.state);
      show(kind === "cnpj" ? (result.active === false ? `CNPJ com situação ${result.status} na Receita.` : `Encontrado na Receita: ${result.legalName || "empresa"}. Confira os dados abaixo.`) : "Endereço preenchido. Confira o número.", result.active === false);
      updateCreateWizard(form);
    } catch (error) {
      show(error.message || "Não foi possível buscar agora. Preencha à mão.", true);
    }
  };

  const isValidCnpjDigits = (cnpj) => {
    if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
    const calc = (length) => {
      const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const rest = weights.reduce((total, weight, index) => total + Number(cnpj[index]) * weight, 0) % 11;
      return rest < 2 ? 0 : 11 - rest;
    };
    return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
  };
  const formatCnpj = (digits) =>
    digits
      .slice(0, 14)
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");

  // Digitou os 14 números: confere e busca na Receita sozinho.
  const onWizardCnpjInput = (input) => {
    const form = input.form;
    const digits = onlyDigits(input.value).slice(0, 14);
    const formatted = formatCnpj(digits);
    if (input.value !== formatted) input.value = formatted;
    const status = form.querySelector("[data-wiz-lookup-status]");
    if (digits.length < 14) {
      form.dataset.cnpjChecked = "";
      form.dataset.cnpjBlocked = "";
      if (status) status.hidden = true;
      return;
    }
    if (!isValidCnpjDigits(digits)) {
      if (status) {
        status.hidden = false;
        status.textContent = "CNPJ inválido. Confira os números.";
        status.classList.add("is-error");
      }
      return;
    }
    if (form.dataset.cnpjChecked === digits || form.dataset.cnpjLookingUp === digits) return;
    form.dataset.cnpjLookingUp = digits;
    void runWizardLookup(form, "cnpj").finally(() => {
      form.dataset.cnpjLookingUp = "";
    });
  };

  const generateWizardPassword = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const bytes = new Uint32Array(14);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
  };

  const openRestaurantDialog = (action, key) => {
    const restaurant = findRestaurant(key);
    if (action === "create") {
      openDialog(renderCreateWizard(), { wide: true });
      updateCreateWizard(dialog?.querySelector('form[data-restaurant-form="create"]'));
      return;
    }
    if (!restaurant) return;
    const name = escapeHtml(restaurant.name);
    if (action === "edit") {
      return openDialog(`
        <form class="sys-dialog-form" data-restaurant-form="edit" data-key="${escapeHtml(key)}">
          ${dialogHead("Dados de plataforma", name)}
          <div class="sys-dialog-body">
            ${field("Nome do restaurante", `<input class="sys-input" name="name" required maxlength="160" value="${name}" />`)}
            ${hasPermission("system.plans.manage") ? field("Plano", `<select class="sys-select" name="plan">${planOptions(restaurant.plan)}</select>`) : ""}
            <p class="sys-hint">O endereço INOVAS (/${escapeHtml(restaurant.slug || key)}) não muda para não quebrar links já divulgados.</p>
            <p class="sys-alert is-error" data-dialog-error hidden role="alert"></p>
          </div>
          <div class="sys-dialog-actions"><button class="sys-btn sys-btn-secondary" type="button" data-dialog-close>Cancelar</button><button class="sys-btn sys-btn-primary" type="submit">Salvar</button></div>
        </form>`);
    }
    if (action === "domain") {
      const current = restaurant.customDomain;
      const verified = normalize(current?.status) === "VERIFIED";
      return openDialog(`
        <form class="sys-dialog-form" data-restaurant-form="domain" data-key="${escapeHtml(key)}">
          ${dialogHead("Domínio próprio · + R$ 40/mês", name)}
          <div class="sys-dialog-body">
            ${field("Domínio", `<input class="sys-input" name="customDomain" placeholder="minhapizzaria.com.br" value="${escapeHtml(current?.host || "")}" />`, "Deixe em branco e salve para desvincular.")}
            <div class="sys-note">${icon("lock", 18)}<span>Para o domínio abrir o site: 1) adicionar o domínio no projeto da Vercel; 2) no registro do domínio (ex.: Registro.br), apontar <strong>A @ → 76.76.21.21</strong> e <strong>CNAME www → cname.vercel-dns.com</strong>; 3) quando a Vercel mostrar o domínio como válido, clicar em "Confirmar DNS". Enquanto isso o site segue no endereço INOVAS.</span></div>
            ${current ? `<p>Situação: ${statusPill(verified ? "Ativo" : "Aguardando DNS", verified ? "ok" : "warn", { dot: false })}</p>` : ""}
            <p class="sys-alert is-error" data-dialog-error hidden role="alert"></p>
          </div>
          <div class="sys-dialog-actions">
            <button class="sys-btn sys-btn-secondary" type="button" data-dialog-close>Cancelar</button>
            ${current && !verified ? '<button class="sys-btn sys-btn-secondary" type="button" data-domain-verify>Confirmar DNS</button>' : ""}
            <button class="sys-btn sys-btn-primary" type="submit">Salvar domínio</button>
          </div>
        </form>`);
    }
    if (action === "site") {
      const publish = restaurant.publicSiteEnabled === false;
      return openDialog(`
        <form class="sys-dialog-form" data-restaurant-form="site" data-key="${escapeHtml(key)}" data-publish="${publish}">
          ${dialogHead(publish ? "Publicar site" : "Tirar site do ar", name)}
          <div class="sys-dialog-body"><p style="margin:0">${publish ? `O site passa a abrir em <strong>${escapeHtml(restaurant.publicUrl || "")}</strong>.` : "O endereço INOVAS deixa de abrir até ser publicado de novo. O Gestor continua funcionando."}</p><p class="sys-alert is-error" data-dialog-error hidden role="alert"></p></div>
          <div class="sys-dialog-actions"><button class="sys-btn sys-btn-secondary" type="button" data-dialog-close>Cancelar</button><button class="sys-btn ${publish ? "sys-btn-primary" : "sys-btn-danger"}" type="submit">${publish ? "Publicar site" : "Tirar do ar"}</button></div>
        </form>`);
    }
    if (action === "status") {
      const suspended = isRestaurantSuspended(restaurant);
      return openDialog(`
        <form class="sys-dialog-form" data-restaurant-form="status" data-key="${escapeHtml(key)}" data-next="${suspended ? "ACTIVE" : "SUSPENDED"}">
          ${dialogHead(suspended ? "Reativar acesso" : "Ação crítica", suspended ? `Reativar ${restaurant.name}` : `Suspender ${restaurant.name}`)}
          <div class="sys-dialog-body">
            <p style="margin:0">${suspended ? "Gestor e site voltam a funcionar." : "Enquanto suspenso, o Gestor fica bloqueado e o site sai do ar. Nenhum dado é apagado."}</p>
            ${field("Motivo", '<textarea class="sys-input" name="reason" required minlength="10" rows="3" placeholder="Ex.: mensalidade de novembro em atraso"></textarea>', "Mínimo de 10 caracteres. Fica registrado na auditoria.")}
            <label class="sys-check"><input type="checkbox" name="confirmed" required /> <span>Confirmo ${suspended ? "a reativação" : "a suspensão"} de ${name}.</span></label>
            <p class="sys-alert is-error" data-dialog-error hidden role="alert"></p>
          </div>
          <div class="sys-dialog-actions"><button class="sys-btn sys-btn-secondary" type="button" data-dialog-close>Cancelar</button><button class="sys-btn ${suspended ? "sys-btn-primary" : "sys-btn-danger"}" type="submit">${suspended ? "Reativar acesso" : "Suspender acesso"}</button></div>
        </form>`);
    }
  };

  const onlyDigits = (value) => String(value || "").replace(/\D/g, "");

  const submitRestaurantForm = async (form, extra = {}) => {
    const kind = form.dataset.restaurantForm;
    const key = form.dataset.key || "";
    const data = Object.fromEntries(new FormData(form).entries());
    const errorNode = form.querySelector("[data-dialog-error]");
    const buttons = form.querySelectorAll("button");
    if (errorNode) errorNode.hidden = true;
    buttons.forEach((button) => { button.disabled = true; });
    try {
      let message = "Alteração salva e registrada na auditoria.";
      if (kind === "create") {
        if (!isValidCnpjDigits(onlyDigits(data.document))) throw new Error("Informe um CNPJ válido para criar o cadastro.");
        if (form.dataset.cnpjBlocked) throw new Error(`CNPJ com situação ${form.dataset.cnpjBlocked} na Receita. Não é possível cadastrar.`);
        const slug = slugify(data.slug);
        const phone = onlyDigits(data.whatsapp);
        const whatsapp = phone.startsWith("55") ? phone : `55${phone}`;
        const formData = new FormData(form);
        const serviceModes = formData.getAll("serviceModes");
        const addons = formData.getAll("addons");
        const address = {
          street: data.street, number: data.number, complement: data.complement || "", neighborhood: data.neighborhood,
          city: data.city, state: String(data.state || "").toUpperCase(), postalCode: onlyDigits(data.postalCode),
        };
        const payload = {
          restaurantName: data.name, tradeName: data.name, name: data.name,
          slug, restaurantKey: slug, document: onlyDigits(data.document), requireCnpj: true,
          companyName: data.legalName || "", stateRegistration: data.stateRegistration || "", taxRegime: data.taxRegime,
          ownerFullName: data.ownerName, ownerDocument: onlyDigits(data.ownerCpf), email: data.email,
          city: data.city, postalCode: onlyDigits(data.postalCode), establishmentNumber: data.number,
          registration: { legalName: data.legalName || data.name, document: onlyDigits(data.document), city: data.city, state: data.state },
          phone: whatsapp, whatsapp, adhesionDate: data.adhesionDate,
          address,
          category: data.category, expectedDailyOrders: Number(data.expectedDailyOrders || 0), serviceModes,
          plan: data.plan, billingCycle: data.billingCycle, addons, subscriptionStatus: "ACTIVE",
          ...(data.customDomain ? { customDomain: String(data.customDomain).trim().toLowerCase() } : {}),
          appearance: { primaryColor: data.primaryColor || "" },
          pickupEnabled: serviceModes.includes("pickup"),
          delivery: { deliveriesEnabled: serviceModes.includes("delivery") },
          adminUser: { login: data.email, email: data.email, name: data.ownerName, password: data.password },
        };
        const response = await fetch("/api/admin/master/onboard-restaurant", {
          method: "POST",
          credentials: "same-origin",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || body?.error?.message || "Não foi possível cadastrar o restaurante.");
        state.selectedRestaurantKey = slug;
        message = `Restaurante cadastrado. Site no ar em inovasfood.com.br/${slug}.`;
      } else {
        let payload = {};
        if (kind === "edit") payload = { name: data.name, ...(data.plan ? { plan: data.plan } : {}) };
        if (kind === "domain") payload = extra.verify ? { domainStatus: "VERIFIED" } : { customDomain: data.customDomain || "" };
        if (kind === "site") payload = { publicSiteEnabled: form.dataset.publish === "true" };
        if (kind === "status") payload = { accessStatus: form.dataset.next, reason: data.reason };
        await requestJson(`/api/system/restaurants/${encodeURIComponent(key)}/update`, { method: "POST", body: JSON.stringify(payload) });
        if (kind === "status") message = form.dataset.next === "SUSPENDED" ? "Restaurante suspenso. Gestor e site bloqueados." : "Restaurante reativado.";
        if (kind === "site") message = form.dataset.publish === "true" ? "Site publicado." : "Site tirado do ar.";
      }
      dialog?.close();
      notify(message);
      await loadRoute();
    } catch (error) {
      if (errorNode) {
        errorNode.textContent = error.message;
        errorNode.hidden = false;
      }
      buttons.forEach((button) => { button.disabled = false; });
    }
  };

  // ---------- Pagamentos e repasses do restaurante (pagamento online) ----------
  const sysPayments = { byKey: {}, loading: {} };
  const PAY_STATUS = {
    NOT_SUBMITTED: ["Conta bancária não cadastrada", "crit"],
    PENDING: ["Conta em análise", "warn"],
    ACTIVE: ["Conta ativa", "ok"],
    REFUSED: ["Conta recusada", "crit"],
  };
  const PAYOUT_STATUS = {
    SCHEDULED: ["Agendado", "warn"],
    NOTHING_TO_PAY: ["Nada a repassar", "neutral"],
    PAID: ["Pago", "ok"],
    FAILED: ["Falhou", "crit"],
  };
  const brl = (cents) => (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dayLabel = (iso) => {
    const date = new Date(`${String(iso).slice(0, 10)}T12:00:00-03:00`);
    return Number.isFinite(date.getTime()) ? date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
  };

  const loadSysPayments = async (key) => {
    if (!key || sysPayments.loading[key]) return;
    sysPayments.loading[key] = true;
    try {
      const [account, payouts] = await Promise.all([
        requestJson(`/api/system/restaurants/${encodeURIComponent(key)}/payment-account`),
        requestJson(`/api/system/restaurants/${encodeURIComponent(key)}/payouts`),
      ]);
      sysPayments.byKey[key] = account.data?.unavailable
        ? { error: "Restaurante ainda não provisionado para pagamento online." }
        : { account: account.data || {}, payouts: payouts.data || {}, error: "" };
    } catch (error) {
      sysPayments.byKey[key] = {
        error: error.code === "payouts_not_configured" || error.code === "online_payment_disabled"
          ? "Pagamento online ainda não ativado (falta aplicar as atualizações do banco)."
          : error.message,
      };
    } finally {
      sysPayments.loading[key] = false;
      const slot = document.querySelector(`[data-sys-payments="${CSS.escape(key)}"]`);
      if (slot) slot.innerHTML = renderSysPayments(key);
    }
  };

  const renderSysPayments = (key) => {
    const entry = sysPayments.byKey[key];
    if (!entry) {
      void loadSysPayments(key);
      return '<h3 class="sys-subhead">Pagamentos e repasses</h3><p class="sys-hint">Carregando…</p>';
    }
    if (entry.error) {
      return `<h3 class="sys-subhead">Pagamentos e repasses</h3><p class="sys-hint">${escapeHtml(entry.error)}</p>`;
    }
    const settings = entry.account.settings || {};
    const [accountLabel, accountTone] = PAY_STATUS[settings.status] || PAY_STATUS.NOT_SUBMITTED;
    const methods = (settings.methods || []).filter((method) => (settings.enabledMethods || []).includes(method.id));
    const statement = entry.payouts.statement || {};
    const payouts = (entry.payouts.payouts || []).slice(0, 6);
    const canManage = hasPermission("system.billing.manage");
    const bank = settings.bankAccount;
    return `
      <h3 class="sys-subhead">Pagamentos e repasses</h3>
      <dl class="sys-facts">
        <div class="sys-fact"><span>Conta de recebimento</span>${statusPill(accountLabel, accountTone, { dot: false })}</div>
        <div class="sys-fact"><span>Conta bancária</span><strong>${bank ? `${escapeHtml(bank.holderName)}<br><small class="sys-hint">${escapeHtml(bank.holderDocument)} · banco ${escapeHtml(bank.bankCode)} · ag. ${escapeHtml(bank.branch)} · conta ${escapeHtml(bank.account)}</small>` : "Não cadastrada"}</strong></div>
        <div class="sys-fact"><span>Formas online ativas</span><strong>${methods.length ? escapeHtml(methods.map((method) => method.shortLabel).join(", ")) : "Nenhuma"}</strong></div>
        <div class="sys-fact"><span>Código do recebedor</span><strong>${escapeHtml(entry.account.recipientId || "—")}</strong></div>
        <div class="sys-fact"><span>Semana atual (até agora)</span><strong>${escapeHtml(brl(statement.netCents))}${Number(statement.carryOverCents || 0) < 0 ? ' <small class="sys-hint">(saldo devedor)</small>' : ""}</strong></div>
      </dl>
      <div class="sys-table-wrap"><table class="sys-table" aria-label="Repasses"><thead><tr><th>Semana</th><th>Repasse</th><th>Valor</th><th>Situação</th><th></th></tr></thead><tbody>
        ${payouts.length
          ? payouts
              .map((payout) => {
                const [label, tone] = PAYOUT_STATUS[payout.status] || [payout.status, "neutral"];
                return `<tr><td>${escapeHtml(dayLabel(payout.weekKey))}</td><td>${escapeHtml(dayLabel(payout.payoutDate))}</td><td>${escapeHtml(brl(payout.payoutCents))}</td><td>${statusPill(label, tone, { dot: false })}</td><td>${
                  payout.status === "FAILED" && canManage
                    ? `<button class="sys-btn sys-btn-secondary sys-btn-sm" type="button" data-sys-pay-retry="${escapeHtml(key)}" data-week="${escapeHtml(payout.weekKey)}">Tentar de novo</button>`
                    : ""
                }</td></tr>`;
              })
              .join("")
          : '<tr><td colspan="5">Nenhum repasse fechado ainda.</td></tr>'}
      </tbody></table></div>
      ${canManage
        ? `<form class="sys-pay-form" data-sys-pay-entry="${escapeHtml(key)}">
            <strong>Lançar no extrato do restaurante</strong>
            <div class="sys-pay-grid">
              <label><span>Tipo</span><select class="sys-select" name="type"><option value="DEBT">Débito (desconta do repasse)</option><option value="CREDIT">Crédito (soma no repasse)</option><option value="SUBSCRIPTION">Mensalidade</option></select></label>
              <label><span>Valor (R$)</span><input class="sys-input" name="amount" inputmode="decimal" placeholder="0,00" required /></label>
              <label class="is-wide"><span>Descrição (aparece para o restaurante)</span><input class="sys-input" name="description" maxlength="120" placeholder="Ex.: Taxa de adesão (1/3)" required /></label>
            </div>
            <button class="sys-btn sys-btn-primary sys-btn-sm" type="submit">Lançar</button>
          </form>
          <form class="sys-pay-form" data-sys-pay-recipient="${escapeHtml(key)}">
            <strong>Vincular recebedor da Stone/Pagar.me</strong>
            <p class="sys-hint">Use quando o cadastro ficar "em análise" e for concluído no painel da Pagar.me.</p>
            <div class="sys-pay-grid"><label class="is-wide"><span>Código do recebedor (re_...)</span><input class="sys-input" name="recipientId" value="${escapeHtml(entry.account.recipientId || "")}" /></label></div>
            <button class="sys-btn sys-btn-secondary sys-btn-sm" type="submit">Salvar recebedor</button>
          </form>`
        : ""}`;
  };

  const refreshSysPayments = (key) => {
    delete sysPayments.byKey[key];
    const slot = document.querySelector(`[data-sys-payments="${CSS.escape(key)}"]`);
    if (slot) slot.innerHTML = renderSysPayments(key);
  };

  document.addEventListener("submit", async (event) => {
    const entryForm = event.target.closest("[data-sys-pay-entry]");
    const recipientForm = event.target.closest("[data-sys-pay-recipient]");
    if (!entryForm && !recipientForm) return;
    event.preventDefault();
    const form = entryForm || recipientForm;
    const key = entryForm ? entryForm.dataset.sysPayEntry : recipientForm.dataset.sysPayRecipient;
    const data = new FormData(form);
    try {
      if (entryForm) {
        const amountCents = Math.round(Number(String(data.get("amount") || "").replace(/\./g, "").replace(",", ".")) * 100);
        if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Informe um valor maior que zero.");
        await requestJson(`/api/system/restaurants/${encodeURIComponent(key)}/ledger`, {
          method: "POST",
          body: JSON.stringify({
            type: data.get("type"),
            amountCents,
            description: String(data.get("description") || "").trim(),
            idempotencyKey: `painel:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
          }),
        });
        notify("Lançamento feito. Aparece no extrato do restaurante.");
      } else {
        await requestJson(`/api/system/restaurants/${encodeURIComponent(key)}/payment-account`, {
          method: "POST",
          body: JSON.stringify({ recipientId: String(data.get("recipientId") || "").trim() }),
        });
        notify("Recebedor salvo.");
      }
      refreshSysPayments(key);
    } catch (error) {
      notify(error.message || "Não foi possível salvar.");
    }
  });

  document.addEventListener("click", async (event) => {
    const retry = event.target.closest("[data-sys-pay-retry]");
    if (!retry) return;
    retry.disabled = true;
    try {
      const result = await requestJson(`/api/system/restaurants/${encodeURIComponent(retry.dataset.sysPayRetry)}/payouts`, {
        method: "POST",
        body: JSON.stringify({ action: "retry", weekKey: retry.dataset.week }),
      });
      notify(result.data?.status === "PAID" ? "Repasse pago." : "O repasse falhou de novo. Confira a conta bancária do restaurante.");
    } catch (error) {
      notify(error.message || "Não foi possível tentar de novo.");
    }
    refreshSysPayments(retry.dataset.sysPayRetry);
  });

  // ---------- Mensalidades e repasses (todos os restaurantes) ----------
  const BILLING_SITUATION = {
    PAID_UP: ["Em dia", "ok"],
    DUE: ["A vencer", "warn"],
    OVERDUE: ["Em atraso", "crit"],
    CONTRACT_TRIAL: ["Em teste", "neutral"],
    CONTRACT_BLOCKED: ["Bloqueado", "crit"],
    CONTRACT_CANCELED: ["Cancelado", "neutral"],
    CONTRACT_EXPIRED: ["Contrato vencido", "crit"],
  };
  const billingFilter = { value: "" };
  const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

  const renderBillingRows = (data) => {
    const rows = (data.restaurants || []).filter((row) => !billingFilter.value || row.situation === billingFilter.value);
    const canManage = hasPermission("system.billing.manage");
    if (!rows.length) return renderEmpty("Nenhum restaurante neste filtro", "Troque o filtro para ver os demais.");
    const canPlan = hasPermission("system.plans.manage");
    const cycleOption = (row, key, label) => {
      const monthly = row.monthlyValueCents;
      const months = { MONTHLY: 1, QUARTERLY: 3, SEMIANNUAL: 6, ANNUAL: 12 }[key];
      const gross = monthly * months;
      const discount = key === "ANNUAL" ? Math.round(gross * 0.08) : key === "MONTHLY" ? 0 : 500 * months;
      return `<option value="${key}" ${row.billingCycle === key ? "selected" : ""}>${label} · ${brl(gross - discount)}${discount ? ` (−${brl(discount)})` : ""}</option>`;
    };
    return `<div class="sys-table-wrap"><table class="sys-table is-stack" aria-label="Mensalidades"><thead><tr><th>Restaurante</th><th>Plano</th><th>Mensalidade</th><th>Ciclo de cobrança</th><th>Situação</th><th>Devendo</th><th>Última cobrança</th><th>Último pagamento</th><th></th></tr></thead><tbody>
      ${rows
        .map((row) => {
          const [label, tone] = BILLING_SITUATION[row.situation] || [row.situation, "neutral"];
          return `<tr data-billing-row="${escapeHtml(row.restaurantKey)}">
            <td data-label="Restaurante"><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.restaurantKey)}${row.onlinePayment ? " · pagamento online" : ""}</small></td>
            <td data-label="Plano">${escapeHtml(translatePlan(row.plan))}</td>
            <td data-label="Mensalidade">${escapeHtml(brl(row.monthlyValueCents))}</td>
            <td data-label="Ciclo de cobrança">${
              canPlan
                ? `<select class="sys-select" data-billing-cycle="${escapeHtml(row.restaurantKey)}" aria-label="Ciclo de cobrança de ${escapeHtml(row.name)}">${cycleOption(row, "MONTHLY", "Mensal")}${cycleOption(row, "QUARTERLY", "Trimestral")}${cycleOption(row, "SEMIANNUAL", "Semestral")}${cycleOption(row, "ANNUAL", "Anual")}</select>`
                : `${escapeHtml(row.cycleCharge?.label || "Mensal")} · ${escapeHtml(brl(row.cycleCharge?.totalCents))}`
            }</td>
            <td data-label="Situação">${statusPill(label, tone, { dot: false })}</td>
            <td data-label="Devendo"><strong>${row.owedCents ? escapeHtml(brl(row.owedCents)) : "—"}</strong>${row.owedCents && row.onlinePayment ? '<small class="sys-hint">desconta do repasse</small>' : ""}</td>
            <td data-label="Última cobrança">${escapeHtml(formatDate(row.lastChargeAt))}</td>
            <td data-label="Último pagamento">${escapeHtml(formatDate(row.lastPaymentAt))}</td>
            <td>${
              canManage && row.owedCents
                ? `<button class="sys-btn sys-btn-secondary sys-btn-sm" type="button" data-billing-pay="${escapeHtml(row.restaurantKey)}" data-owed="${row.owedCents}">Registrar pagamento</button>`
                : ""
            }</td>
          </tr>`;
        })
        .join("")}
    </tbody></table></div>`;
  };

  const renderBilling = (data) => {
    const summary = data.summary || {};
    app.innerHTML = `
      ${renderHead({
        eyebrow: "Plataforma",
        title: "Mensalidades e repasses",
        description: "Quem está em dia e quem está em atraso com a mensalidade INOVAS. Quem usa pagamento online tem a mensalidade descontada do repasse semanal; os demais pagam por fora e o pagamento é registrado aqui.",
      })}
      ${data.ledgerAvailable === false ? `<div class="sys-note">${icon("warning", 18)}<span>O extrato ainda não está ativo no banco (faltam as atualizações 032–034). Os valores devidos aparecem depois disso.</span></div>` : ""}
      <section class="sys-kpis">
        <article class="sys-kpi"><span>Em dia</span><strong>${escapeHtml(String(summary.paidUp ?? 0))}</strong><small>de ${escapeHtml(String(summary.total ?? 0))} restaurantes</small></article>
        <article class="sys-kpi"><span>Em atraso</span><strong>${escapeHtml(String(summary.overdue ?? 0))}</strong><small>${escapeHtml(String(summary.due ?? 0))} a vencer</small></article>
        <article class="sys-kpi"><span>Total devido</span><strong>${escapeHtml(brl(summary.owedCents))}</strong><small>somando todos</small></article>
        <article class="sys-kpi"><span>Receita mensal</span><strong>${escapeHtml(brl(summary.monthlyRevenueCents))}</strong><small>contratos ativos</small></article>
      </section>
      <div class="sys-filters" role="group" aria-label="Filtrar por situação">
        ${[["", "Todos"], ["OVERDUE", "Em atraso"], ["DUE", "A vencer"], ["PAID_UP", "Em dia"]]
          .map(([value, label]) => `<button type="button" class="sys-btn sys-btn-sm ${billingFilter.value === value ? "sys-btn-primary" : "sys-btn-secondary"}" data-billing-filter="${value}" aria-pressed="${billingFilter.value === value}">${label}</button>`)
          .join("")}
      </div>
      <div data-billing-list>${renderBillingRows(data)}</div>`;
  };

  // Ciclo de cobrança: mensal, trimestral (−R$ 15), semestral (−R$ 30), anual (−8%).
  document.addEventListener("change", async (event) => {
    const select = event.target.closest("[data-billing-cycle]");
    if (!select) return;
    select.disabled = true;
    try {
      await requestJson("/api/admin/master/subscription", {
        method: "POST",
        body: JSON.stringify({ restaurantKey: select.dataset.billingCycle, billingCycle: select.value }),
      }).catch(async (error) => {
        // A rota do Gestor responde no formato antigo ({ ok }); só falha de verdade conta.
        if (error.status && error.status >= 400) throw error;
      });
      notify("Ciclo de cobrança atualizado. A próxima cobrança já usa o novo valor.");
      state.data = (await requestJson("/api/system/billing")).data;
      renderBilling(state.data);
    } catch (error) {
      notify(error.message || "Não foi possível mudar o ciclo.");
      select.disabled = false;
    }
  });

  document.addEventListener("click", async (event) => {
    const filter = event.target.closest("[data-billing-filter]");
    if (filter && state.data) {
      billingFilter.value = filter.dataset.billingFilter;
      renderBilling(state.data);
      return;
    }
    const pay = event.target.closest("[data-billing-pay]");
    if (!pay) return;
    const owed = Number(pay.dataset.owed || 0);
    const typed = window.prompt(
      `Valor recebido (R$). Devendo: ${brl(owed)}`,
      (owed / 100).toFixed(2).replace(".", ",")
    );
    if (typed === null) return;
    const amountCents = Math.round(Number(String(typed).replace(/\./g, "").replace(",", ".")) * 100);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      notify("Valor inválido.");
      return;
    }
    pay.disabled = true;
    try {
      await requestJson(`/api/system/restaurants/${encodeURIComponent(pay.dataset.billingPay)}/ledger`, {
        method: "POST",
        body: JSON.stringify({
          type: "CREDIT",
          amountCents,
          description: "Pagamento da mensalidade recebido",
          idempotencyKey: `mensalidade-paga:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
        }),
      });
      notify("Pagamento registrado.");
      state.data = (await requestJson("/api/system/billing")).data;
      renderBilling(state.data);
    } catch (error) {
      notify(error.message || "Não foi possível registrar.");
      pay.disabled = false;
    }
  });

  const renderRestaurantDetail = (restaurant) => {
    if (!restaurant) {
      return `<aside class="sys-card sys-detail">${renderEmpty("Nenhum restaurante selecionado", "Clique em uma linha da lista para ver os detalhes.")}</aside>`;
    }
    const [healthLabel, tone] = translateHealth(restaurant.health?.status);
    const health = restaurant.health || {};
    const failed = Number(health.failedIntegrations || 0);
    const pendingJobs = Number(health.pendingJobs || 0);
    const backup = normalize(health.backupStatus);
    const canSupport = hasPermission("system.support.admin") && restaurant.administrativeActions?.supportAvailable;
    return `
      <aside class="sys-card sys-detail" aria-label="Restaurante selecionado">
        <div>
          <span class="sys-eyebrow">Restaurante selecionado</span>
          <h2>${escapeHtml(restaurant.name)}</h2>
          ${statusPill(healthLabel, tone)} ${statusPill(translateRestaurantStatus(restaurant.status), "neutral", { dot: false })}
        </div>
        <dl class="sys-facts">
          <div class="sys-fact"><span>Identificador</span><strong>${escapeHtml(restaurant.restaurantKey)}</strong></div>
          <div class="sys-fact"><span>Site INOVAS</span><strong>${restaurant.publicUrl ? `<a href="${escapeHtml(restaurant.publicUrl)}" target="_blank" rel="noreferrer">${escapeHtml(restaurant.publicUrl.replace(/^https?:\/\//, ""))}</a>` : escapeHtml(`/${restaurant.slug || restaurant.restaurantKey}`)}<br>${restaurantSiteIsLive(restaurant) ? statusPill("No ar", "ok", { dot: false }) : statusPill(restaurant.publicSiteEnabled === false ? "Fora do ar" : "Indisponível", "crit", { dot: false })}</strong></div>
          <div class="sys-fact"><span>Domínio próprio</span><strong>${restaurant.customDomain ? `${escapeHtml(restaurant.customDomain.host)}<br>${statusPill(normalize(restaurant.customDomain.status) === "VERIFIED" ? "Ativo" : "Aguardando DNS", normalize(restaurant.customDomain.status) === "VERIFIED" ? "ok" : "warn", { dot: false })}` : "Não vinculado <small class=\"sys-hint\">(+ R$ 40/mês)</small>"}</strong></div>
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
        ${hasPermission("system.billing.view") ? `<div data-sys-payments="${escapeHtml(restaurant.restaurantKey)}">${renderSysPayments(restaurant.restaurantKey)}</div>` : ""}
        <div class="sys-note">${icon("lock", 18)}<span>Pedidos, clientes e financeiro deste restaurante não aparecem aqui. Para ver, abra uma sessão de suporte; o motivo fica registrado.</span></div>
        <div class="sys-action-stack">
          ${canSupport
            ? `<a class="sys-btn sys-btn-primary" href="/system#support?key=${encodeURIComponent(restaurant.restaurantKey)}">Entrar no restaurante (suporte)</a>`
            : '<button class="sys-btn sys-btn-primary" type="button" disabled>Entrar no restaurante (suporte)</button>'}
          <p class="sys-action-help">Acesso total como proprietário · 60 min · alterações gravadas com o seu usuário${restaurant.administrativeActions?.supportAvailable ? "" : " · restaurante não provisionado"}</p>
          ${renderRestaurantAdminActions(restaurant)}
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
      ${hasPermission("system.restaurants.create") ? '<div class="sys-page-actions"><button class="sys-btn sys-btn-primary" type="button" data-restaurant-action="create">+ Novo restaurante</button></div>' : ""}
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
    return Boolean(support.restaurantKey) && support.reason.trim().length >= 10 && support.confirmed && hasPermission("system.support.admin");
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
      submit.textContent = "Entrar no restaurante — 60 min";
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
    state.support.mode = "ADMIN";

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
              <div class="sys-banner is-warn is-compact">${icon("warning", 18)}<span><strong>Acesso total ao restaurante</strong>, como o proprietário: pedidos, cardápio, caixa, clientes e configurações. Tudo o que você alterar fica gravado com <strong>o seu usuário</strong> (não o do dono) e na auditoria. A sessão dura 60 minutos.</span></div>
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
              <button class="sys-btn sys-btn-primary sys-btn-block" type="submit" data-support-submit disabled>Entrar no restaurante — 60 min</button>
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
      state.support = { restaurantKey: state.support.restaurantKey, mode: "ADMIN", reason: "", confirmed: false };
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

  const renderers = { overview: renderOverview, restaurants: renderRestaurants, billing: renderBilling, support: renderSupport, audit: renderAudit };

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
    const restaurantAction = event.target.closest("[data-restaurant-action]");
    if (restaurantAction && !restaurantAction.disabled) {
      openRestaurantDialog(restaurantAction.dataset.restaurantAction, restaurantAction.dataset.key || "");
      return;
    }
    const domainVerify = event.target.closest("[data-domain-verify]");
    if (domainVerify) {
      void submitRestaurantForm(domainVerify.closest("form"), { verify: true });
      return;
    }
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

  // Cadastro novo: buscar CNPJ/CEP, gerar senha e recalcular a tela.
  document.addEventListener("click", (event) => {
    const lookup = event.target.closest?.("[data-wiz-lookup]");
    if (lookup) {
      event.preventDefault();
      void runWizardLookup(lookup.form || lookup.closest("form"), lookup.dataset.wizLookup);
      return;
    }
    const generate = event.target.closest?.("[data-wiz-generate-password]");
    if (generate) {
      event.preventDefault();
      const input = generate.closest("form")?.elements.password;
      if (input) input.value = generateWizardPassword();
    }
  });
  const onWizardChange = (event) => {
    const form = event.target.closest?.("form.sys-wiz");
    if (!form) return;
    if (event.target.name === "category") form.dataset.categoryTouched = "true";
    updateCreateWizard(form);
  };
  document.addEventListener("change", onWizardChange);

  document.addEventListener("input", (event) => {
    if (event.target.matches?.("[data-wiz-cnpj]")) onWizardCnpjInput(event.target);
    if (event.target.closest?.("form.sys-wiz")) setTimeout(() => updateCreateWizard(event.target.closest("form.sys-wiz")), 0);
    if (event.target.matches("[data-slug-source]")) {
      const target = event.target.form?.querySelector("[data-slug-target]");
      if (target && !target.dataset.touched) target.value = slugify(event.target.value);
      return;
    }
    if (event.target.matches("[data-slug-target]")) {
      event.target.dataset.touched = "true";
      return;
    }
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
    if (event.target.matches("[data-restaurant-form]")) {
      event.preventDefault();
      void submitRestaurantForm(event.target);
      return;
    }
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
