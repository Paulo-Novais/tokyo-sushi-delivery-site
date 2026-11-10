(() => {
  "use strict";

  // Painel System INOVAS. Toda permissão é conferida no servidor; aqui o menu
  // só deixa de mostrar o que a sessão não pode usar (esconder não é proteger).

  const shell = document.querySelector("[data-system-shell]");
  const app = document.querySelector("[data-system-app]");
  const sidebar = document.querySelector("[data-system-sidebar]");
  const bottomNav = document.querySelector("[data-system-bottomnav]");
  const toast = document.querySelector("[data-system-toast]");
  const dialog = document.querySelector("[data-system-dialog]");

  if (!shell || !app || !sidebar) {
    return;
  }

  const ICONS = {
    overview: "M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z",
    restaurants:
      "M3 9l1.5-5h15L21 9v1a3 3 0 01-6 0 3 3 0 01-6 0 3 3 0 01-6 0V9z M5 13v8h14v-8",
    support:
      "M4 14v-2a8 8 0 0116 0v2 M4 14h3v5H5a1 1 0 01-1-1v-4z M20 14h-3v5h2a1 1 0 001-1v-4z",
    audit:
      "M14 3H6a1 1 0 00-1 1v16a1 1 0 001 1h12a1 1 0 001-1V8l-5-5z M14 3v5h5 M8 13h8 M8 17h6",
    users:
      "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M22 21v-2a4 4 0 00-3-3.9 M16 3.1a4 4 0 010 7.8",
    roles:
      "M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6",
    check: "M20 6L9 17l-5-5",
    alert:
      "M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z M12 9v4 M12 17h.01",
    search: "M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4.3-4.3",
    lock: "M6 11h12v9H6z M8 11V8a4 4 0 018 0v3",
    menu: "M4 7h16 M4 12h16 M4 17h16",
  };

  // Menu desta interface: cada item exige uma permissão system.* da sessão.
  const NAV = [
    {
      key: "overview",
      label: "Visão geral",
      short: "Início",
      group: "Plataforma",
      href: "/system",
      permission: "system.dashboard.view",
      bottom: true,
    },
    {
      key: "restaurants",
      label: "Restaurantes",
      href: "/system#restaurantes",
      hash: "restaurantes",
      permission: "system.restaurants.view",
      bottom: true,
    },
    {
      key: "support",
      label: "Suporte",
      group: "Operação",
      href: "/system#suporte",
      hash: "suporte",
      permission: "system.support.start",
      bottom: true,
    },
    {
      key: "audit",
      label: "Auditoria",
      href: "/system#auditoria",
      hash: "auditoria",
      permission: "system.audit.view",
      bottom: true,
    },
    {
      key: "users",
      label: "Usuários INOVAS",
      group: "Equipe INOVAS",
      href: "/system/users",
      permission: "system.users.view",
    },
    {
      key: "roles",
      label: "Perfis e menus",
      href: "/system#perfis",
      hash: "perfis",
      permission: "system.users.view",
    },
  ];

  const state = {
    session: null,
    policy: null,
    view: "",
    renderToken: 0,
    timers: [],
    restaurants: { search: "", status: "", plan: "", domain: "", selected: "" },
    users: { search: "", role: "", status: "" },
    support: { restaurantKey: "", mode: "VIEW", reason: "", confirmed: false },
  };

  /* ---------- utilitários ---------- */
  const esc = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const icon = (name, size = 20, width = 2) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[name]}"></path></svg>`;

  const pill = (label, tone = "", dot = false) =>
    `<span class="sys-pill${dot ? " sys-pill-dot" : ""}"${
      tone ? ` data-tone="${tone}"` : ""
    }>${esc(label)}</span>`;

  const bar = (percent, tone, extraClass = "") =>
    `<span class="sys-bar ${extraClass}" data-tone="${tone}" aria-hidden="true"><span style="width:${Math.max(
      0,
      Math.min(100, Number(percent) || 0)
    )}%"></span></span>`;

  const can = (permission) =>
    !permission ||
    (state.session?.effectivePermissions || []).includes(permission);

  const api = async (url, { method = "GET", body } = {}) => {
    const response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let payload = {};
    try {
      payload = await response.json();
    } catch {}
    if (!response.ok || payload.success === false) {
      const error = new Error(
        payload?.error?.message ||
          (typeof payload?.error === "string" ? payload.error : "") ||
          "Não foi possível concluir a operação."
      );
      error.status = response.status;
      error.code = payload?.error?.code || "";
      throw error;
    }
    return payload;
  };

  const formatDateTime = (value) => {
    const date = new Date(value);
    return !value || Number.isNaN(date.getTime())
      ? "Não informado"
      : new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(date);
  };

  const formatDate = (value) => {
    const date = new Date(value);
    return !value || Number.isNaN(date.getTime())
      ? "Não informado"
      : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
  };

  const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

  const initials = (name) =>
    String(name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] || "")
      .join("")
      .toUpperCase() || "?";

  const showToast = (message, kind = "") => {
    if (!toast) return;
    toast.textContent = message;
    toast.dataset.kind = kind;
    toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.hidden = true;
    }, 5000);
  };

  const roleLabel = (role) =>
    (state.policy?.roles || []).find((entry) => entry.key === role)?.label ||
    role ||
    "";

  const HEALTH = {
    ONLINE: { label: "Online", tone: "ok" },
    DEGRADED: { label: "Degradado", tone: "warn" },
    OFFLINE: { label: "Offline", tone: "" },
  };

  const healthInfo = (status) =>
    HEALTH[status] || { label: "Sem dados", tone: "" };

  const scoreTone = (health) =>
    !health || health.status === "OFFLINE"
      ? ""
      : health.score >= 80
        ? "ok"
        : health.score >= 40
          ? "warn"
          : "crit";

  const scoreWord = (tone) =>
    tone === "ok"
      ? "Bom"
      : tone === "warn"
        ? "Atenção"
        : tone === "crit"
          ? "Crítico"
          : "Offline";

  const domainLabel = (health) =>
    !health
      ? "Sem dados"
      : health.status === "OFFLINE"
        ? "Inativo"
        : health.domainStatus === "HEALTHY"
          ? "Ativo"
          : "Verificação pendente";

  /* ---------- estados de tela ---------- */
  const pageHead = ({ eyebrow, title, description, actions = "" }) => `
    <header class="sys-pagehead">
      <div class="sys-pagehead-copy">
        <span class="sys-eyebrow">${esc(eyebrow)}</span>
        <h1>${esc(title)}</h1>
        <p>${description}</p>
      </div>
      ${actions ? `<div class="sys-pagehead-actions">${actions}</div>` : ""}
    </header>`;

  const stateCard = (title, text, { busy = false, role = "status" } = {}) => `
    <div class="sys-card sys-state" role="${role}" ${
      busy ? 'aria-busy="true"' : ""
    }>
      ${busy ? '<span class="sys-spinner" aria-hidden="true"></span>' : ""}
      <strong>${esc(title)}</strong>
      ${text ? `<span>${esc(text)}</span>` : ""}
    </div>`;

  const loadingCard = (text) => stateCard(text, "", { busy: true });

  const errorCard = (error) =>
    error?.status === 403
      ? stateCard(
          "Sem permissão",
          "O seu perfil não tem acesso a estes dados. Fale com um usuário Master se precisar.",
          { role: "alert" }
        )
      : `<div class="sys-card sys-state" role="alert">
          <strong>Não foi possível carregar</strong>
          <span>${esc(error?.message || "Tente novamente em instantes.")}</span>
          <button class="sys-btn" type="button" data-action="reload">Tentar de novo</button>
        </div>`;

  /* ---------- menu ---------- */
  const visibleNav = () => NAV.filter((item) => can(item.permission));

  const renderChrome = () => {
    const session = state.session;
    let lastGroup = "";
    const links = visibleNav()
      .map((item) => {
        const heading =
          item.group && item.group !== lastGroup
            ? `<span class="sys-nav-group">${esc(item.group)}</span>`
            : "";
        lastGroup = item.group || lastGroup;
        return `${heading}<a href="${item.href}" data-nav="${item.key}" ${
          item.key === state.view ? 'aria-current="page"' : ""
        }>${icon(item.key)}${esc(item.label)}</a>`;
      })
      .join("");
    const name = session.displayName || session.login || "Usuário";

    sidebar.innerHTML = `
      <a class="sys-logo" href="/system"><img src="/assets/inovas-food-logo-oficial.png" alt="INOVAS Food" /></a>
      <div class="sys-product"><span>INOVAS Food</span><strong>Plataforma</strong></div>
      <nav class="sys-nav" aria-label="Navegação principal">${links}</nav>
      <div class="sys-userbox">
        <div class="sys-userbox-id">
          <span class="sys-avatar" aria-hidden="true">${esc(initials(name))}</span>
          <span class="sys-userbox-copy">
            <strong>${esc(name)}</strong>
            <span>${esc(roleLabel(session.role))} · sem restaurante</span>
          </span>
        </div>
        <button class="sys-btn" type="button" data-action="logout">Sair</button>
      </div>`;

    if (bottomNav) {
      bottomNav.innerHTML = visibleNav()
        .filter((item) => item.bottom)
        .map(
          (item) =>
            `<a href="${item.href}" data-nav="${item.key}" ${
              item.key === state.view ? 'aria-current="page"' : ""
            }>${icon(item.key, 22)}${esc(item.short || item.label)}</a>`
        )
        .join("");
    }
  };

  const setMenuOpen = (open) => {
    shell.dataset.menuOpen = open ? "true" : "false";
    document
      .querySelector("[data-action='menu']")
      ?.setAttribute("aria-expanded", open ? "true" : "false");
  };

  /* ---------- Visão geral ---------- */
  const buildAttention = (tenantHealth) => {
    const items = [];
    for (const health of tenantHealth) {
      if (health.criticalErrors > 0) {
        items.push({
          tone: "crit",
          level: "Crítico",
          title: plural(health.criticalErrors, "erro crítico", "erros críticos"),
          health,
        });
      }
      if (health.failedIntegrations > 0) {
        items.push({
          tone: "warn",
          level: "Atenção",
          title: plural(
            health.failedIntegrations,
            "integração com falha",
            "integrações com falha"
          ),
          health,
        });
      }
      if (health.status !== "OFFLINE" && health.domainStatus !== "HEALTHY") {
        items.push({
          tone: "warn",
          level: "Atenção",
          title: "Domínio aguardando verificação",
          health,
        });
      }
      if (health.status === "OFFLINE") {
        items.push({
          tone: "",
          level: "Offline",
          title: "Restaurante offline ou inativo",
          health,
        });
      }
    }
    return items;
  };

  const sessionCard = (session, { manageHref = "" } = {}) => {
    const expires = new Date(session.expiresAt).getTime();
    const started = new Date(session.createdAt).getTime();
    const total =
      Number.isFinite(started) && expires > started
        ? expires - started
        : (session.mode === "ADMIN" ? 15 : 30) * 60000;
    const left = Math.max(0, expires - Date.now());
    const minutes = Math.ceil(left / 60000);
    return `
      <div class="sys-session">
        <div class="sys-rowline">
          <strong>${esc(session.restaurantName || session.restaurantKey)}</strong>
          ${pill(session.mode === "ADMIN" ? "Administrativo" : "Visualização")}
        </div>
        <span class="sys-muted">Aberta por você · iniciada em ${esc(
          formatDateTime(session.createdAt)
        )}</span>
        ${
          manageHref
            ? '<span class="sys-muted">Motivo registrado na auditoria.</span>'
            : `<span>Motivo: ${esc(session.reason || "não informado")}</span>`
        }
        ${bar((left / total) * 100, "brand", "sys-bar-thin")}
        <div class="sys-rowline">
          <strong>${esc(plural(minutes, "min restante", "min restantes"))}</strong>
          ${
            manageHref
              ? `<a class="sys-btn" href="${manageHref}">Gerenciar</a>`
              : `<span class="sys-actions">
                  <a class="sys-btn" href="/admin">Abrir Gestor em suporte</a>
                  <button class="sys-btn sys-btn-danger" type="button" data-action="support-revoke">Encerrar agora</button>
                </span>`
          }
        </div>
      </div>`;
  };

  const loadSupportSession = async () => {
    try {
      const payload = await api("/api/support/session");
      return payload.data?.active ? payload.data.supportSession : null;
    } catch {
      return null;
    }
  };

  const renderOverview = async (token) => {
    const head = pageHead({
      eyebrow: "Plataforma · saúde agregada",
      title: "Visão geral da INOVAS",
      description:
        "Estado técnico e operacional agregado. Nenhum pedido, cliente ou valor financeiro de restaurante aparece nesta tela.",
      actions: can("system.support.start")
        ? '<a class="sys-btn sys-btn-primary" href="/system#suporte">Iniciar suporte</a>'
        : "",
    });
    app.innerHTML = head + loadingCard("Carregando saúde da plataforma…");

    let health;
    let supportSession;
    try {
      const [dashboard, support] = await Promise.all([
        api("/api/system/dashboard"),
        loadSupportSession(),
      ]);
      health = dashboard.data?.health || {};
      supportSession = support;
    } catch (error) {
      if (token !== state.renderToken) return;
      app.innerHTML = head + errorCard(error);
      return;
    }
    if (token !== state.renderToken) return;

    const summary = health.summary || {};
    const tenantHealth = Array.isArray(health.tenantHealth)
      ? health.tenantHealth
      : [];
    const attention = buildAttention(tenantHealth);
    const degraded = Number(summary.degradedRestaurants || 0);
    const failures = Number(summary.integrationFailures || 0);
    const critical = Number(summary.criticalAlerts || 0);
    const healthy =
      summary.status === "HEALTHY" && !degraded && !failures && !critical;
    const calm = healthy && attention.length === 0;
    const bannerTone = critical > 0 ? "crit" : calm ? "ok" : "warn";
    const bannerText = calm
      ? "<strong>Plataforma saudável.</strong> Nenhum restaurante degradado e nenhuma falha de integração."
      : healthy
        ? `<strong>Plataforma operando com atenção.</strong> ${esc(
            plural(attention.length, "item precisa", "itens precisam")
          )} de acompanhamento.`
        : `<strong>Plataforma operando com atenção.</strong> ${esc(
          plural(degraded, "restaurante degradado", "restaurantes degradados")
        )}, ${esc(
          plural(failures, "falha de integração", "falhas de integração")
        )} e ${esc(plural(critical, "alerta crítico", "alertas críticos"))}.`;

    const kpis = [
      ["Estado da plataforma", calm ? "Saudável" : "Atenção", "Saúde global"],
      [
        "Restaurantes ativos",
        summary.activeRestaurants ?? 0,
        plural(Number(summary.totalRestaurants || 0), "cadastrado", "cadastrados"),
      ],
      ["Degradados", degraded, "Requerem acompanhamento"],
      [
        "Alertas críticos",
        critical,
        plural(failures, "falha de integração", "falhas de integração"),
      ],
    ]
      .map(
        ([label, value, hint]) => `
          <article class="sys-card sys-kpi">
            <span>${esc(label)}</span><strong>${esc(value)}</strong><span>${esc(hint)}</span>
          </article>`
      )
      .join("");

    const attentionRows = attention.length
      ? attention
          .map(
            (item) => `
              <div class="sys-attn-row">
                ${pill(item.level, item.tone)}
                <span class="sys-attn-copy">
                  <strong>${esc(item.title)}</strong>
                  <span>${esc(item.health.restaurantName)}</span>
                </span>
                ${
                  can("system.restaurants.view")
                    ? `<a class="sys-btn" href="/system#restaurantes" data-open-restaurant="${esc(
                        item.health.restaurantKey
                      )}">Abrir restaurante</a>`
                    : ""
                }
              </div>`
          )
          .join("")
      : '<div class="sys-attn-row"><span class="sys-muted">Nada precisa de atenção agora.</span></div>';

    const healthRows = tenantHealth
      .map((entry) => {
        const info = healthInfo(entry.status);
        const tone = scoreTone(entry);
        return `
          <tr>
            <td><span class="sys-cell-stack"><strong>${esc(
              entry.restaurantName
            )}</strong><small>${esc(entry.restaurantKey)}</small></span></td>
            <td>${pill(info.label, info.tone, true)}</td>
            <td><span class="sys-score"><strong>${esc(entry.score)}</strong>${bar(
              entry.score,
              tone
            )}</span></td>
            <td>${esc(domainLabel(entry))}</td>
          </tr>`;
      })
      .join("");

    const healthMobile = tenantHealth
      .map((entry) => {
        const tone = scoreTone(entry);
        return `<div class="sys-mrow"><span>${esc(entry.restaurantName)}</span>${bar(
          entry.score,
          tone
        )}<strong>${esc(entry.score)} · ${esc(scoreWord(tone))}</strong></div>`;
      })
      .join("");

    const boundary = [
      "Sessão System sem tenant e sem restaurante.",
      "Sem acesso a pedidos, clientes ou financeiro de restaurantes.",
      "Permissões apenas do vocabulário system.*",
      "Acesso operacional só por sessão de suporte explícita e auditada.",
      "Cookies e APIs separados por domínio.",
    ]
      .map((text) => `<li>${icon("check", 18, 2.4)}<span>${esc(text)}</span></li>`)
      .join("");

    app.innerHTML = `
      ${head}
      <div class="sys-banner" role="status" data-tone="${bannerTone}">
        ${icon(calm ? "check" : "alert")}<span>${bannerText}</span>
      </div>
      <section class="sys-kpis system-health-grid" aria-label="Indicadores de saúde">${kpis}</section>
      <section class="sys-card sys-card-flush" aria-labelledby="sys-attn">
        <div class="sys-card-head">
          <h2 id="sys-attn">Precisa de atenção</h2>
          ${pill(plural(attention.length, "item", "itens"))}
        </div>
        ${attentionRows}
      </section>
      <div class="sys-columns">
        <section class="sys-card sys-card-flush sys-col-main" aria-labelledby="sys-health">
          <div class="sys-card-head">
            <h2 id="sys-health">Health Score por restaurante</h2>
            <span class="sys-muted">Atualizado em ${esc(
              formatDateTime(summary.generatedAt)
            )}</span>
          </div>
          ${
            tenantHealth.length
              ? `<div class="sys-table-wrap sys-only-desktop">
                  <table class="sys-table">
                    <thead><tr><th scope="col">Restaurante</th><th scope="col">Estado</th><th scope="col">Health Score</th><th scope="col">Domínio</th></tr></thead>
                    <tbody>${healthRows}</tbody>
                  </table>
                </div>
                <div class="sys-only-mobile">${healthMobile}</div>`
              : '<div class="sys-state"><strong>Nenhum restaurante cadastrado</strong></div>'
          }
        </section>
        <div class="sys-col-side">
          <section class="sys-card sys-card-pad" aria-labelledby="sys-sessions">
            <h2 id="sys-sessions">Sessões de suporte ativas</h2>
            ${
              supportSession
                ? sessionCard(supportSession, { manageHref: "/system#suporte" })
                : '<span class="sys-muted">Você não tem sessão de suporte aberta.</span>'
            }
          </section>
          <section class="sys-card sys-card-pad system-boundary" aria-labelledby="sys-boundary">
            <h2 id="sys-boundary">Fronteira System ativa</h2>
            <ul class="sys-checklist">${boundary}</ul>
          </section>
        </div>
      </div>`;
  };

  /* ---------- Restaurantes ---------- */
  const STATUS_LABELS = {
    ACTIVE: "Ativo",
    ATIVO: "Ativo",
    CLIENTE_MODELO: "Cliente modelo",
    PILOT: "Piloto",
    TRIAL: "Em teste",
    SUSPENDED: "Suspenso",
    INACTIVE: "Inativo",
    BLOCKED: "Bloqueado",
  };

  const publicPath = (restaurant) => {
    try {
      return new URL(restaurant.publicUrl).pathname || "/";
    } catch {
      return restaurant.slug ? `/${restaurant.slug}` : "Não informado";
    }
  };

  const renderRestaurants = async (token) => {
    const head = pageHead({
      eyebrow: "Plataforma · cadastros",
      title: "Restaurantes",
      description:
        "Cadastro, plano, domínio e saúde de cada restaurante. Dados operacionais só por sessão de suporte.",
    });
    app.innerHTML = head + loadingCard("Carregando restaurantes…");

    let restaurants;
    let healthByKey = new Map();
    try {
      const [list, dashboard] = await Promise.all([
        api("/api/system/restaurants"),
        can("system.health.view")
          ? api("/api/system/health").catch(() => null)
          : Promise.resolve(null),
      ]);
      restaurants = list.data?.restaurants || [];
      for (const entry of dashboard?.data?.health?.tenantHealth || []) {
        healthByKey.set(entry.restaurantKey, entry);
      }
    } catch (error) {
      if (token !== state.renderToken) return;
      app.innerHTML = head + errorCard(error);
      return;
    }
    if (token !== state.renderToken) return;

    const filters = state.restaurants;
    const plans = [...new Set(restaurants.map((entry) => entry.plan).filter(Boolean))];
    const option = (value, label, current) =>
      `<option value="${esc(value)}" ${value === current ? "selected" : ""}>${esc(
        label
      )}</option>`;

    app.innerHTML = `
      ${head}
      <div class="sys-filters">
        <label class="sys-search">
          <span class="sys-sr">Buscar por nome ou identificador</span>
          ${icon("search", 18)}
          <input class="sys-input" type="search" placeholder="Buscar por nome ou identificador" value="${esc(
            filters.search
          )}" data-filter="search" />
        </label>
        <select class="sys-select sys-select-chip" aria-label="Filtrar por estado" data-filter="status">
          ${option("", "Estado: todos", filters.status)}
          ${option("ONLINE", "Estado: online", filters.status)}
          ${option("DEGRADED", "Estado: degradado", filters.status)}
          ${option("OFFLINE", "Estado: offline", filters.status)}
        </select>
        <select class="sys-select sys-select-chip" aria-label="Filtrar por plano" data-filter="plan">
          ${option("", "Plano: todos", filters.plan)}
          ${plans.map((plan) => option(plan, `Plano: ${plan}`, filters.plan)).join("")}
        </select>
        <select class="sys-select sys-select-chip" aria-label="Filtrar por domínio" data-filter="domain">
          ${option("", "Domínio: todos", filters.domain)}
          ${option("Ativo", "Domínio: ativo", filters.domain)}
          ${option("Verificação pendente", "Domínio: verificação pendente", filters.domain)}
          ${option("Inativo", "Domínio: inativo", filters.domain)}
        </select>
      </div>
      <div class="sys-columns">
        <section class="sys-card sys-card-flush sys-col-main" data-restaurant-list aria-label="Lista de restaurantes"></section>
        <aside class="sys-card sys-col-side" data-restaurant-detail aria-live="polite"></aside>
      </div>`;

    const listNode = app.querySelector("[data-restaurant-list]");
    const detailNode = app.querySelector("[data-restaurant-detail]");

    const paint = () => {
      const search = filters.search.trim().toLowerCase();
      const rows = restaurants.filter((entry) => {
        const health = healthByKey.get(entry.restaurantKey);
        if (
          search &&
          !`${entry.name} ${entry.slug} ${entry.restaurantKey}`
            .toLowerCase()
            .includes(search)
        ) {
          return false;
        }
        if (filters.status && health?.status !== filters.status) return false;
        if (filters.plan && entry.plan !== filters.plan) return false;
        if (filters.domain && domainLabel(health) !== filters.domain) return false;
        return true;
      });
      if (!rows.some((entry) => entry.restaurantKey === filters.selected)) {
        filters.selected = rows[0]?.restaurantKey || "";
      }

      listNode.innerHTML = rows.length
        ? `<div class="sys-card-head"><span>${esc(
            plural(rows.length, "restaurante", "restaurantes")
          )} · clique em uma linha para ver os detalhes</span></div>
          <div class="sys-table-wrap">
            <table class="sys-table">
              <thead><tr><th scope="col">Restaurante</th><th scope="col">Estado</th><th scope="col">Plano</th><th scope="col">Domínio</th></tr></thead>
              <tbody>${rows
                .map((entry) => {
                  const health = healthByKey.get(entry.restaurantKey);
                  const info = healthInfo(health?.status);
                  return `
                    <tr data-selectable data-restaurant="${esc(
                      entry.restaurantKey
                    )}" tabindex="0" aria-selected="${
                      entry.restaurantKey === filters.selected
                    }">
                      <td><span class="sys-cell-stack"><strong>${esc(
                        entry.name
                      )}</strong><small>${esc(entry.slug || entry.restaurantKey)}</small></span></td>
                      <td>${pill(info.label, info.tone, true)}</td>
                      <td>${esc(entry.plan || "Não informado")}</td>
                      <td>${esc(domainLabel(health))}</td>
                    </tr>`;
                })
                .join("")}</tbody>
            </table>
          </div>`
        : `<div class="sys-state"><strong>${
            restaurants.length
              ? "Nenhum restaurante com esses filtros"
              : "Nenhum restaurante cadastrado"
          }</strong></div>`;

      const selected = restaurants.find(
        (entry) => entry.restaurantKey === filters.selected
      );
      if (!selected) {
        detailNode.innerHTML =
          '<div class="sys-state"><span>Selecione um restaurante para ver os detalhes.</span></div>';
        return;
      }
      const health = healthByKey.get(selected.restaurantKey);
      const info = healthInfo(health?.status);
      const tone = scoreTone(health);
      const backup =
        health?.backupStatus && health.backupStatus !== "UNKNOWN"
          ? health.backupStatus === "OK"
            ? pill("OK", "ok")
            : pill(health.backupStatus, "warn")
          : pill("Sem dados");

      detailNode.innerHTML = `
        <div class="sys-detail">
          <span class="sys-overline">Restaurante selecionado</span>
          <h2>${esc(selected.name)}</h2>
          <div>${pill(info.label, info.tone, true)}</div>
          <dl class="sys-facts">
            <div><dt>Identificador</dt><dd>${esc(selected.slug || selected.restaurantKey)}</dd></div>
            <div><dt>Endereço público</dt><dd>${esc(publicPath(selected))}</dd></div>
            <div><dt>Situação do cadastro</dt><dd>${esc(
              STATUS_LABELS[selected.status] || selected.status || "Não informado"
            )}</dd></div>
            <div><dt>Plano</dt><dd>${esc(selected.plan || "Não informado")}</dd></div>
            <div><dt>Domínio</dt><dd>${esc(selected.domain || "Não informado")} · ${esc(
              domainLabel(health)
            )}</dd></div>
            <div><dt>Atualizado em</dt><dd>${esc(formatDate(selected.updatedAt))}</dd></div>
          </dl>
          ${
            health
              ? `<div class="sys-detail-score"><span>Health Score</span><strong>${esc(
                  health.score
                )}</strong></div>${bar(health.score, tone, "sys-bar-thin")}
                <strong>Integrações e rotinas</strong>
                <div class="sys-rowline"><span>Integrações</span>${
                  health.failedIntegrations > 0
                    ? pill(`${health.failedIntegrations} com falha`, "warn")
                    : pill("OK", "ok")
                }</div>
                <div class="sys-rowline"><span>Backup</span>${backup}</div>`
              : '<span class="sys-muted">Saúde técnica não disponível para o seu perfil.</span>'
          }
          <div class="sys-note">${icon(
            "lock",
            18
          )}<span>Pedidos, clientes e financeiro deste restaurante não aparecem aqui. Para ver, abra uma sessão de suporte; o motivo fica registrado.</span></div>
          ${
            can("system.support.start")
              ? `<a class="sys-btn sys-btn-primary sys-btn-block" href="/system#suporte" data-support-for="${esc(
                  selected.restaurantKey
                )}">Iniciar suporte (visualização)</a>`
              : '<button class="sys-btn sys-btn-block" type="button" disabled>Iniciar suporte (visualização)</button>'
          }
          <span class="sys-hint">Requer system.support.start</span>
          <button class="sys-btn sys-btn-block" type="button" disabled>Editar dados de plataforma</button>
          <span class="sys-hint">Requer system.restaurants.edit · ainda não disponível nesta versão</span>
          <button class="sys-btn sys-btn-block" type="button" disabled>Suspender acesso</button>
          <span class="sys-hint">Ação crítica · requer system.restaurants.suspend e motivo · ainda não disponível nesta versão</span>
        </div>`;
    };

    paint();

    app.querySelectorAll("[data-filter]").forEach((field) => {
      field.addEventListener("input", () => {
        filters[field.dataset.filter] = field.value;
        paint();
      });
    });
    const selectRow = (target) => {
      const row = target.closest("[data-restaurant]");
      if (!row) return;
      filters.selected = row.dataset.restaurant;
      paint();
    };
    listNode.addEventListener("click", (event) => selectRow(event.target));
    listNode.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const key = event.target.closest("[data-restaurant]")?.dataset.restaurant;
        selectRow(event.target);
        listNode.querySelector(`[data-restaurant="${CSS.escape(key || "")}"]`)?.focus();
      }
    });
    detailNode.addEventListener("click", (event) => {
      const link = event.target.closest("[data-support-for]");
      if (link) {
        state.support.restaurantKey = link.dataset.supportFor;
        state.support.mode = "VIEW";
      }
    });
  };

  /* ---------- Suporte ---------- */
  const renderSupport = async (token) => {
    const head = pageHead({
      eyebrow: "Operação · acesso temporário",
      title: "Suporte auditado",
      description:
        "O único caminho para ver dados de um restaurante. Toda sessão tem modo, motivo e prazo, e fica registrada na auditoria.",
    });
    app.innerHTML = head + loadingCard("Carregando suporte…");

    let restaurants;
    let active;
    try {
      const [list, support] = await Promise.all([
        api("/api/system/restaurants"),
        loadSupportSession(),
      ]);
      restaurants = list.data?.restaurants || [];
      active = support;
    } catch (error) {
      if (token !== state.renderToken) return;
      app.innerHTML = head + errorCard(error);
      return;
    }
    if (token !== state.renderToken) return;

    const form = state.support;
    const canView = can("system.support.start");
    const canAdmin = can("system.support.admin");
    if (form.mode === "ADMIN" && !canAdmin) form.mode = "VIEW";
    if (!restaurants.some((entry) => entry.restaurantKey === form.restaurantKey)) {
      form.restaurantKey = "";
    }

    app.innerHTML = `
      ${head}
      <div class="sys-columns">
        <form class="sys-card sys-form sys-col-main" data-support-form novalidate>
          <h2>Iniciar sessão de suporte</h2>
          <label class="sys-field">
            <span>Restaurante</span>
            <select class="sys-select" name="restaurantKey" required>
              <option value="">Selecione um restaurante</option>
              ${restaurants
                .map(
                  (entry) =>
                    `<option value="${esc(entry.restaurantKey)}" ${
                      entry.restaurantKey === form.restaurantKey ? "selected" : ""
                    }>${esc(entry.name)}</option>`
                )
                .join("")}
            </select>
          </label>
          <fieldset class="sys-field" style="border:0;margin:0;padding:0;min-width:0">
            <legend class="sys-label" style="padding:0;margin-bottom:6px">Modo de acesso</legend>
            <div class="sys-modes">
              <label class="sys-mode">
                <input type="radio" name="mode" value="VIEW" ${
                  form.mode === "VIEW" ? "checked" : ""
                } ${canView ? "" : "disabled"} />
                <strong>Visualização</strong>
                <span>Leitura dos dados do restaurante, sem alterar nada.</span>
                <small>30 min · requer system.support.start</small>
              </label>
              <label class="sys-mode">
                <input type="radio" name="mode" value="ADMIN" ${
                  form.mode === "ADMIN" ? "checked" : ""
                } ${canAdmin ? "" : "disabled"} />
                <strong>Administrativo</strong>
                <span>Permite ajustes controlados, com mais rastreio.</span>
                <small>15 min · requer system.support.admin · crítico${
                  canAdmin ? "" : " · o seu perfil não tem esta permissão"
                }</small>
              </label>
            </div>
          </fieldset>
          <div class="sys-banner" data-admin-warning hidden>
            ${icon("alert")}<span>O modo administrativo permite alterar dados do restaurante. Use só quando a visualização não resolver; a sessão dura menos.</span>
          </div>
          <label class="sys-field">
            <span>Motivo do acesso</span>
            <textarea class="sys-textarea" name="reason" maxlength="500" aria-describedby="sys-reason-count" placeholder="Descreva por que este acesso é necessário">${esc(
              form.reason
            )}</textarea>
            <span class="sys-muted" id="sys-reason-count" data-reason-count></span>
          </label>
          <label class="sys-check">
            <input type="checkbox" name="confirmed" ${form.confirmed ? "checked" : ""} />
            <span>Confirmo que este acesso é necessário e que ele será registrado na auditoria.</span>
          </label>
          <p class="sys-error" role="alert" data-support-error hidden></p>
          <button class="sys-btn sys-btn-primary sys-btn-lg sys-btn-block" type="submit" data-support-submit disabled>Iniciar sessão</button>
        </form>
        <div class="sys-col-side">
          <section class="sys-card sys-card-pad" aria-labelledby="sys-active">
            <h2 id="sys-active">Sessões ativas</h2>
            ${
              active
                ? sessionCard(active)
                : '<span class="sys-muted">Você não tem sessão de suporte aberta.</span>'
            }
          </section>
          <section class="sys-card sys-card-pad" aria-labelledby="sys-closed">
            <h2 id="sys-closed">Encerradas recentemente</h2>
            <span class="sys-muted">O histórico de sessões encerradas fica na auditoria. A consulta pelo painel ainda não está disponível nesta versão.</span>
            ${
              can("system.audit.view")
                ? '<a href="/system#auditoria"><strong>Ver auditoria</strong></a>'
                : ""
            }
          </section>
        </div>
      </div>`;

    const formNode = app.querySelector("[data-support-form]");
    const submit = formNode.querySelector("[data-support-submit]");
    const counter = formNode.querySelector("[data-reason-count]");
    const warning = formNode.querySelector("[data-admin-warning]");
    const errorNode = formNode.querySelector("[data-support-error]");

    const sync = () => {
      const data = new FormData(formNode);
      form.restaurantKey = String(data.get("restaurantKey") || "");
      form.mode = String(data.get("mode") || "VIEW");
      form.reason = String(data.get("reason") || "");
      form.confirmed = data.get("confirmed") === "on";
      const length = form.reason.trim().length;
      counter.textContent = `${length} de 10 caracteres no mínimo`;
      warning.hidden = form.mode !== "ADMIN";
      const allowed = form.mode === "ADMIN" ? canAdmin : canView;
      submit.disabled = !(
        allowed &&
        form.restaurantKey &&
        length >= 10 &&
        form.confirmed
      );
      submit.textContent = `Iniciar sessão — ${form.mode === "ADMIN" ? 15 : 30} min`;
    };
    formNode.addEventListener("input", sync);
    formNode.addEventListener("change", sync);
    sync();

    formNode.addEventListener("submit", async (event) => {
      event.preventDefault();
      sync();
      if (submit.disabled) return;
      submit.disabled = true;
      errorNode.hidden = true;
      try {
        await api("/api/support/start", {
          method: "POST",
          body: {
            restaurantKey: form.restaurantKey,
            mode: form.mode,
            reason: form.reason.trim(),
            confirmed: true,
          },
        });
        state.support = { restaurantKey: "", mode: "VIEW", reason: "", confirmed: false };
        showToast("Sessão de suporte iniciada e registrada na auditoria.");
        render();
      } catch (error) {
        errorNode.textContent = error.message;
        errorNode.hidden = false;
        sync();
      }
    });

    if (active) {
      state.timers.push(
        window.setInterval(() => {
          if (new Date(active.expiresAt).getTime() <= Date.now()) {
            showToast("A sessão de suporte expirou.");
            render();
          }
        }, 30000)
      );
    }
  };

  /* ---------- Usuários INOVAS ---------- */
  const USER_STATUS = {
    ACTIVE: { label: "Ativo", tone: "ok" },
    PENDING: { label: "Convite pendente", tone: "warn" },
    BLOCKED: { label: "Bloqueado", tone: "crit" },
    INACTIVE: { label: "Inativo", tone: "" },
  };

  const USER_ACTIONS = {
    sessions: {
      label: "Encerrar sessões",
      title: (name) => `Encerrar as sessões de ${name}?`,
      confirm: "Encerrar sessões",
      path: "sessions/revoke",
      reason: true,
      done: "Sessões encerradas.",
    },
    block: {
      label: "Bloquear",
      danger: true,
      title: (name) => `Bloquear ${name}?`,
      confirm: "Bloquear usuário",
      path: "block",
      reason: true,
      revoke: true,
      done: "Usuário bloqueado.",
    },
    deactivate: {
      label: "Desativar",
      danger: true,
      title: (name) => `Desativar ${name}?`,
      confirm: "Desativar usuário",
      path: "deactivate",
      reason: true,
      revoke: true,
      done: "Usuário desativado.",
    },
    unblock: {
      label: "Desbloquear",
      title: (name) => `Desbloquear ${name}?`,
      confirm: "Desbloquear usuário",
      path: "unblock",
      done: "Usuário desbloqueado.",
    },
    activate: {
      label: "Ativar",
      title: (name) => `Ativar ${name}?`,
      confirm: "Ativar usuário",
      path: "activate",
      done: "Usuário ativado.",
    },
    invite: {
      label: "Reenviar convite",
      title: (name) => `Reenviar o convite de ${name}?`,
      confirm: "Reenviar convite",
      path: "invite/resend",
      done: "Convite reenviado.",
    },
  };

  const actionsForStatus = (status) =>
    ({
      ACTIVE: ["sessions", "block"],
      PENDING: ["invite", "deactivate"],
      BLOCKED: ["unblock"],
      INACTIVE: ["activate"],
    })[status] || [];

  const openUserAction = (user, actionKey) => {
    const action = USER_ACTIONS[actionKey];
    if (!dialog || !action) return;
    dialog.innerHTML = `
      <form method="dialog" novalidate>
        <span class="sys-overline">Confirmação</span>
        <h2>${esc(action.title(user.name))}</h2>
        ${
          action.reason
            ? `<label class="sys-field"><span>Motivo</span>
                <textarea class="sys-textarea" name="reason" maxlength="500" required placeholder="Obrigatório; fica registrado na auditoria"></textarea></label>`
            : '<p class="sys-muted">Esta ação fica registrada na auditoria.</p>'
        }
        ${
          action.revoke
            ? '<label class="sys-check"><input type="checkbox" name="revokeSessions" checked /><span>Encerrar as sessões ativas deste usuário agora.</span></label>'
            : ""
        }
        <p class="sys-error" role="alert" data-dialog-error hidden></p>
        <div class="sys-dialog-actions">
          <button class="sys-btn" type="button" data-dialog-cancel>Cancelar</button>
          <button class="sys-btn ${
            action.danger ? "sys-btn-danger-solid" : "sys-btn-primary"
          }" type="submit">${esc(action.confirm)}</button>
        </div>
      </form>`;
    const form = dialog.querySelector("form");
    const errorNode = dialog.querySelector("[data-dialog-error]");
    dialog.querySelector("[data-dialog-cancel]").addEventListener("click", () =>
      dialog.close()
    );
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const reason = String(data.get("reason") || "").trim();
      if (action.reason && !reason) {
        errorNode.textContent = "Informe o motivo.";
        errorNode.hidden = false;
        form.querySelector("textarea")?.focus();
        return;
      }
      const submit = form.querySelector("[type='submit']");
      submit.disabled = true;
      try {
        const payload = await api(
          `/api/system/users/${encodeURIComponent(user.id)}/${action.path}`,
          {
            method: "POST",
            body: {
              reason,
              ...(action.revoke
                ? { revokeSessions: data.get("revokeSessions") === "on" }
                : {}),
            },
          }
        );
        const inviteUrl = payload.data?.invitation?.url;
        if (inviteUrl) {
          dialog.innerHTML = `
            <form method="dialog">
              <h2>Convite reenviado</h2>
              <p>Este link aparece uma única vez. Copie e envie para a pessoa.</p>
              <p class="sys-onetime">${esc(inviteUrl)}</p>
              <div class="sys-dialog-actions"><button class="sys-btn sys-btn-primary" type="submit">Fechar</button></div>
            </form>`;
        } else {
          dialog.close();
        }
        showToast(action.done);
        render();
      } catch (error) {
        errorNode.textContent = error.message;
        errorNode.hidden = false;
        submit.disabled = false;
      }
    });
    dialog.showModal();
  };

  const renderUsers = async (token) => {
    const manage = can("system.users.manage");
    const head = pageHead({
      eyebrow: "Equipe INOVAS · acesso interno",
      title: "Usuários INOVAS",
      description:
        "Quem da equipe acessa o painel System, com qual perfil e em que estado. Ações sensíveis pedem motivo e ficam na auditoria.",
      actions: manage
        ? '<a class="sys-btn sys-btn-primary" href="/system/users/new">Novo usuário</a>'
        : "",
    });
    app.innerHTML = head + loadingCard("Carregando usuários INOVAS…");

    let users;
    try {
      const payload = await api("/api/system/users?pageSize=100");
      users = payload.data?.users || [];
    } catch (error) {
      if (token !== state.renderToken) return;
      app.innerHTML = head + errorCard(error);
      return;
    }
    if (token !== state.renderToken) return;

    const filters = state.users;
    const count = (status) => users.filter((user) => user.status === status).length;
    const roles = [...new Map(users.map((user) => [user.role, user.roleLabel])).entries()];
    const option = (value, label, current) =>
      `<option value="${esc(value)}" ${value === current ? "selected" : ""}>${esc(
        label
      )}</option>`;

    app.innerHTML = `
      ${head}
      <section class="sys-kpis" aria-label="Resumo de usuários">
        ${[
          ["Ativos", count("ACTIVE")],
          ["Convite pendente", count("PENDING")],
          ["Bloqueados", count("BLOCKED")],
          ["Inativos", count("INACTIVE")],
        ]
          .map(
            ([label, value]) =>
              `<article class="sys-card sys-kpi sys-kpi-compact"><span>${esc(
                label
              )}</span><strong>${esc(value)}</strong></article>`
          )
          .join("")}
      </section>
      <div class="sys-filters">
        <label class="sys-search">
          <span class="sys-sr">Buscar por nome ou e-mail</span>
          ${icon("search", 18)}
          <input class="sys-input" type="search" placeholder="Buscar por nome ou e-mail" value="${esc(
            filters.search
          )}" data-filter="search" />
        </label>
        <select class="sys-select sys-select-chip" aria-label="Filtrar por perfil" data-filter="role">
          ${option("", "Perfil: todos", filters.role)}
          ${roles.map(([key, label]) => option(key, `Perfil: ${label}`, filters.role)).join("")}
        </select>
        <select class="sys-select sys-select-chip" aria-label="Filtrar por estado" data-filter="status">
          ${option("", "Estado: todos", filters.status)}
          ${Object.entries(USER_STATUS)
            .map(([key, info]) => option(key, `Estado: ${info.label.toLowerCase()}`, filters.status))
            .join("")}
        </select>
      </div>
      <section class="sys-card sys-card-flush" data-user-list aria-label="Lista de usuários"></section>
      <section class="sys-card sys-card-pad">
        <h2>Regras desta tela</h2>
        <ul class="sys-checklist">
          ${[
            "Bloquear, desativar e encerrar sessões exigem um motivo.",
            "Bloquear ou desativar encerra as sessões ativas, salvo escolha em contrário.",
            "Convite expirado precisa ser reenviado antes de ativar o usuário.",
            "Senha temporária e link de convite aparecem uma única vez.",
            "Só quem tem system.users.manage altera usuários; os demais, no máximo, visualizam.",
          ]
            .map((text) => `<li>${icon("check", 18, 2.4)}<span>${esc(text)}</span></li>`)
            .join("")}
        </ul>
      </section>`;

    const listNode = app.querySelector("[data-user-list]");
    const paint = () => {
      const search = filters.search.trim().toLowerCase();
      const rows = users.filter(
        (user) =>
          (!search || `${user.name} ${user.email}`.toLowerCase().includes(search)) &&
          (!filters.role || user.role === filters.role) &&
          (!filters.status || user.status === filters.status)
      );
      listNode.innerHTML = rows.length
        ? `<div class="sys-table-wrap"><table class="sys-table">
            <thead><tr><th scope="col">Usuário</th><th scope="col">Perfil</th><th scope="col">Estado</th><th scope="col">Último acesso</th>${
              manage ? '<th scope="col">Ações</th>' : ""
            }</tr></thead>
            <tbody>${rows
              .map((user) => {
                const info = USER_STATUS[user.status] || {
                  label: user.statusLabel || user.status,
                  tone: "",
                };
                return `
                  <tr>
                    <td><span class="sys-cell-stack">${
                      manage
                        ? `<a href="/system/users/${encodeURIComponent(
                            user.id
                          )}/edit"><strong>${esc(user.name)}</strong></a>`
                        : `<strong>${esc(user.name)}</strong>`
                    }<small>${esc(user.email)}</small></span></td>
                    <td>${esc(user.roleLabel || user.role)}</td>
                    <td>${pill(info.label, info.tone, true)}</td>
                    <td>${esc(user.lastAccessAt ? formatDateTime(user.lastAccessAt) : "Nunca")}</td>
                    ${
                      manage
                        ? `<td><span class="sys-actions">${actionsForStatus(user.status)
                            .map(
                              (key) =>
                                `<button class="sys-btn ${
                                  USER_ACTIONS[key].danger ? "sys-btn-danger" : ""
                                }" type="button" data-user-action="${key}" data-user-id="${esc(
                                  user.id
                                )}">${esc(USER_ACTIONS[key].label)}</button>`
                            )
                            .join("")}</span></td>`
                        : ""
                    }
                  </tr>`;
              })
              .join("")}</tbody></table></div>`
        : `<div class="sys-state"><strong>${
            users.length ? "Nenhum usuário com esses filtros" : "Nenhum usuário cadastrado"
          }</strong></div>`;
    };
    paint();

    app.querySelectorAll("[data-filter]").forEach((field) => {
      field.addEventListener("input", () => {
        filters[field.dataset.filter] = field.value;
        paint();
      });
    });
    listNode.addEventListener("click", (event) => {
      const button = event.target.closest("[data-user-action]");
      if (!button) return;
      const user = users.find((entry) => entry.id === button.dataset.userId);
      if (user) openUserAction(user, button.dataset.userAction);
    });
  };

  /* ---------- Perfis e menus ---------- */
  const RISK = {
    MEDIUM: { label: "Médio", tone: "" },
    HIGH: { label: "Alto", tone: "warn" },
    CRITICAL: { label: "Crítico", tone: "crit" },
  };

  const renderRoles = async (token) => {
    const head = pageHead({
      eyebrow: "Equipe INOVAS · controle de acesso",
      title: "Perfis e menus",
      description:
        "Quais permissões <strong>system.*</strong> cada perfil da equipe tem hoje e quais menus isso libera. Nomes de perfis e permissões vêm da política do servidor; a tela é só de leitura.",
    });
    app.innerHTML = head + loadingCard("Carregando política de acesso…");

    let policy;
    try {
      policy = (await api("/api/system/permissions")).data;
      state.policy = policy;
    } catch (error) {
      if (token !== state.renderToken) return;
      app.innerHTML = head + errorCard(error);
      return;
    }
    if (token !== state.renderToken) return;

    const roles = [...(policy.roles || [])].sort(
      (left, right) => right.authority - left.authority
    );
    const permissions = (policy.permissions || []).filter(
      (permission) => permission.active !== false
    );
    const mark = (has) =>
      has
        ? `${icon("check", 18, 2.4)}<span class="sys-sr">Sim</span>`
        : '<span class="sys-no" aria-hidden="true">—</span><span class="sys-sr">Não</span>';
    const roleHeads = (withLevel) =>
      roles
        .map(
          (role) =>
            `<th scope="col">${esc(role.label)}${
              withLevel ? `<small>nível ${esc(role.authority)}</small>` : ""
            }</th>`
        )
        .join("");
    const holders = (key) =>
      roles
        .filter((role) => (role.permissions || []).includes(key))
        .map((role) => role.label)
        .join(", ") || "Nenhum perfil";

    const critical = permissions.filter(
      (permission) => permission.riskLevel === "CRITICAL"
    );

    app.innerHTML = `
      ${head}
      <section class="sys-kpis" aria-label="Permissões críticas">
        ${critical
          .map(
            (permission) => `
              <article class="sys-card sys-kpi">
                <strong style="font-size:14px;line-height:1.4">${esc(permission.description)}</strong>
                <span>Perfis com acesso: ${esc(holders(permission.key))}.</span>
              </article>`
          )
          .join("")}
      </section>
      <section class="sys-card sys-card-flush" aria-labelledby="sys-perm">
        <div class="sys-card-head">
          <h2 id="sys-perm">Permissões por perfil</h2>
          <span class="sys-muted">Perfis ordenados por nível de autoridade (maior à esquerda) · política ${esc(
            policy.version || ""
          )}</span>
        </div>
        <div class="sys-table-wrap">
          <table class="sys-table sys-matrix">
            <thead><tr><th scope="col">Permissão</th>${roleHeads(true)}</tr></thead>
            <tbody>${permissions
              .map((permission) => {
                const risk = RISK[permission.riskLevel];
                return `<tr>
                  <td><span class="sys-cell-stack"><span class="sys-perm-name">${esc(
                    permission.description
                  )}${risk ? pill(risk.label, risk.tone) : ""}</span><small>${esc(
                    permission.key
                  )}</small></span></td>
                  ${roles
                    .map(
                      (role) =>
                        `<td>${mark((role.permissions || []).includes(permission.key))}</td>`
                    )
                    .join("")}
                </tr>`;
              })
              .join("")}</tbody>
          </table>
        </div>
      </section>
      <section class="sys-card sys-card-flush" aria-labelledby="sys-menus">
        <div class="sys-card-head">
          <h2 id="sys-menus">Menus visíveis por perfil</h2>
          <span class="sys-muted">Cada menu deste painel aparece só se o perfil tiver a permissão ligada a ele. O servidor confere a permissão de novo em cada consulta.</span>
        </div>
        <div class="sys-table-wrap">
          <table class="sys-table sys-matrix">
            <thead><tr><th scope="col">Menu</th>${roleHeads(false)}</tr></thead>
            <tbody>${NAV.map(
              (item) => `<tr>
                <td><span class="sys-cell-stack"><strong>${esc(item.label)}</strong><small>exige ${esc(
                  item.permission
                )}</small></span></td>
                ${roles
                  .map(
                    (role) =>
                      `<td>${mark((role.permissions || []).includes(item.permission))}</td>`
                  )
                  .join("")}
              </tr>`
            ).join("")}</tbody>
          </table>
        </div>
      </section>`;
  };

  /* ---------- Auditoria ---------- */
  const renderAudit = async () => {
    app.innerHTML = `
      ${pageHead({
        eyebrow: "Operação · rastreabilidade",
        title: "Auditoria",
        description:
          "Quem fez o quê, em quem e por quê. Somente leitura: nenhum evento pode ser editado ou apagado por aqui.",
      })}
      <section class="sys-card sys-card-flush" aria-label="Eventos de auditoria">
        <div class="sys-table-wrap">
          <table class="sys-table">
            <thead><tr><th scope="col">Quando</th><th scope="col">Evento</th><th scope="col">Ator</th><th scope="col">Alvo</th><th scope="col">Resultado</th><th scope="col">Motivo</th></tr></thead>
          </table>
        </div>
        <div class="sys-state" role="status">
          <strong>Consulta ainda não disponível</strong>
          <span>Os eventos continuam sendo gravados pelo servidor (bloqueios, sessões encerradas, convites, sessões de suporte e acessos negados), mas esta versão do System ainda não tem a consulta pelo painel.</span>
        </div>
      </section>`;
  };

  /* ---------- roteamento ---------- */
  const VIEWS = {
    overview: renderOverview,
    restaurants: renderRestaurants,
    support: renderSupport,
    audit: renderAudit,
    users: renderUsers,
    roles: renderRoles,
  };

  const resolveView = () => {
    if (document.body.dataset.systemView === "users") return "users";
    const hash = window.location.hash.replace(/^#/, "");
    return NAV.find((item) => item.hash && item.hash === hash)?.key || "overview";
  };

  const render = () => {
    state.timers.forEach((timer) => window.clearInterval(timer));
    state.timers = [];
    state.view = resolveView();
    state.renderToken += 1;
    const item = NAV.find((entry) => entry.key === state.view);
    renderChrome();
    setMenuOpen(false);
    document.title = `${item?.label || "Plataforma"} | INOVAS Food`;
    if (item && !can(item.permission)) {
      app.innerHTML = stateCard(
        "Sem permissão",
        "O seu perfil não tem acesso a esta área.",
        { role: "alert" }
      );
      return;
    }
    VIEWS[state.view](state.renderToken);
  };

  document.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    const openRestaurant = event.target.closest("[data-open-restaurant]");
    if (openRestaurant) {
      state.restaurants.selected = openRestaurant.dataset.openRestaurant;
    }
    if (action === "menu") {
      setMenuOpen(shell.dataset.menuOpen !== "true");
    } else if (action === "menu-close") {
      setMenuOpen(false);
    } else if (action === "reload") {
      if (state.session) render();
      else boot();
    } else if (action === "logout") {
      try {
        await api("/api/auth/system/logout", { method: "POST" });
      } catch {}
      window.location.assign("/system/login.html");
    } else if (action === "support-revoke") {
      try {
        await api("/api/support/revoke", { method: "POST" });
        showToast("Sessão de suporte encerrada.");
      } catch (error) {
        showToast(error.message, "error");
      }
      render();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenuOpen(false);
  });

  window.addEventListener("hashchange", render);

  async function boot() {
    app.innerHTML = loadingCard("Carregando a plataforma…");
    try {
      const [sessionPayload, policyPayload] = await Promise.all([
        api("/api/auth/system/session"),
        api("/api/system/permissions").catch(() => null),
      ]);
      if (!sessionPayload.authenticated || !sessionPayload.data?.session) {
        const error = new Error("Sessão encerrada.");
        error.status = 401;
        throw error;
      }
      state.session = sessionPayload.data.session;
      state.policy = policyPayload?.data || null;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        window.location.assign(
          `/system/login.html?next=${encodeURIComponent(
            window.location.pathname
          )}`
        );
        return;
      }
      app.innerHTML = errorCard(error);
      return;
    }
    render();
  }

  boot();
})();
