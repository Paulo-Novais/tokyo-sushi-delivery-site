(() => {
  "use strict";

  const app = document.querySelector("[data-system-app]");
  const sidebar = document.querySelector("[data-system-sidebar]");

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const requestJson = async (url) => {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    let payload = {};
    try {
      payload = await response.json();
    } catch {}
    if (!response.ok || payload.success === false) {
      const error = new Error(
        payload?.error?.message || "Não foi possível carregar a plataforma."
      );
      error.status = response.status;
      throw error;
    }
    return payload;
  };

  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Não informado"
      : new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(date);
  };

  const renderSidebar = (session) => {
    sidebar.innerHTML = `
      <a class="users-brand" href="/system">
        <img src="/assets/inovas-food-logo-oficial.png" alt="INOVAS Food" />
        <span class="users-brand-copy"><small>Plataforma</small><strong>Painel System</strong></span>
      </a>
      <nav class="users-nav" aria-label="Navegação principal">
        ${[
          ["Visão geral", "/system", "VI", true],
          ["Restaurantes", "#restaurants", "RE"],
          ["Saúde", "#health", "SA"],
          ["Integrações", "#integrations", "IN"],
          ["Usuários INOVAS", "/system/users", "US"],
          ["Auditoria", "#audit", "AU"],
          ["Suporte", "#support", "SU"],
        ]
          .map(
            ([label, href, icon, current]) => `
              <a href="${href}" ${current ? 'aria-current="page"' : ""}>
                <span class="users-nav-icon" aria-hidden="true">${icon}</span>${escapeHtml(label)}
              </a>
            `
          )
          .join("")}
      </nav>
      <div class="users-sidebar-foot">
        <strong>${escapeHtml(session.displayName || session.login)}</strong><br />
        ${escapeHtml(session.role)} · tenant nulo
      </div>
    `;
  };

  const render = (session, health) => {
    const summary = health?.summary || {};
    const tenantHealth = Array.isArray(health?.tenantHealth)
      ? health.tenantHealth
      : [];
    app.innerHTML = `
      <nav class="users-breadcrumb"><strong>Sistema</strong><span>/</span><span>Visão geral</span></nav>
      <header class="users-page-head">
        <div>
          <span class="users-eyebrow">Plataforma · saúde agregada</span>
          <h1>Visão geral da INOVAS</h1>
          <p>Estado técnico e operacional agregado, sem conteúdo de pedidos, clientes ou dados financeiros de restaurantes.</p>
        </div>
        <a class="users-button users-button-primary" href="/system/users">Usuários INOVAS</a>
      </header>
      <section class="system-health-grid" aria-label="Indicadores de saúde">
        ${[
          ["Estado", summary.status || "UNKNOWN", "Saúde global"],
          ["Restaurantes ativos", summary.activeRestaurants || 0, `${summary.totalRestaurants || 0} cadastrados`],
          ["Degradados", summary.degradedRestaurants || 0, "Requerem acompanhamento"],
          ["Alertas críticos", summary.criticalAlerts || 0, `${summary.integrationFailures || 0} falhas de integração`],
        ]
          .map(
            ([label, value, helper]) => `
              <article class="system-health-card">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
                <small>${escapeHtml(helper)}</small>
              </article>
            `
          )
          .join("")}
      </section>
      <div class="system-health-layout">
        <section class="users-panel" id="health">
          <div class="users-filter-meta">
            <strong>Health Score por restaurante</strong>
            <span>Atualizado em ${escapeHtml(formatDate(summary.generatedAt))}</span>
          </div>
          <div class="system-health-list">
            ${
              tenantHealth.length
                ? tenantHealth
                    .map(
                      (tenant) => `
                        <article class="system-tenant-health">
                          <span><strong>${escapeHtml(tenant.restaurantName)}</strong><small>${escapeHtml(
                            tenant.restaurantKey
                          )}</small></span>
                          <span class="users-status ${
                            tenant.status === "ONLINE"
                              ? "is-active"
                              : tenant.status === "DEGRADED"
                                ? "is-pending"
                                : "is-blocked"
                          }">${escapeHtml(tenant.status)}</span>
                          <div class="system-score"><strong>${escapeHtml(
                            tenant.score
                          )}</strong><span class="system-score-meter"><span style="width:${Math.max(
                            0,
                            Math.min(100, Number(tenant.score || 0))
                          )}%"></span></span></div>
                          <span><small>Domínio</small><strong>${escapeHtml(
                            tenant.domainStatus
                          )}</strong></span>
                        </article>
                      `
                    )
                    .join("")
                : '<div class="users-empty"><div><h2>Sem restaurantes cadastrados</h2><p>A saúde aparecerá após o primeiro provisionamento.</p></div></div>'
            }
          </div>
        </section>
        <aside class="users-panel system-boundary">
          <h2>Fronteira System ativa</h2>
          <ul>
            <li>SystemSession sem tenant e sem restaurante.</li>
            <li>Nenhuma store de pedidos ou clientes nesta página.</li>
            <li>Permissões limitadas ao vocabulário system.*.</li>
            <li>Acesso operacional somente por SupportSession explícita.</li>
            <li>Cookies e APIs separados por domínio.</li>
          </ul>
        </aside>
      </div>
    `;
  };

  const renderError = (error) => {
    app.innerHTML = `
      <section class="users-panel users-error"><div>
        <span class="users-avatar">!</span>
        <h2>Não foi possível abrir o Painel System</h2>
        <p>${escapeHtml(error.message)}</p>
        <a class="users-button users-button-primary" href="/admin/login.html">Entrar novamente</a>
      </div></section>
    `;
  };

  const init = async () => {
    try {
      const sessionPayload = await requestJson("/api/auth/system/session");
      const session = sessionPayload?.data?.session;
      if (!sessionPayload.authenticated || !session) {
        const error = new Error("Sua sessão System expirou.");
        error.status = 401;
        throw error;
      }
      if (session.tenantId || session.restaurantId) {
        throw new Error("A sessão System apresentou escopo de tenant inválido.");
      }
      renderSidebar(session);
      const healthPayload = await requestJson("/api/system/health");
      render(session, healthPayload?.data?.health);
    } catch (error) {
      renderError(error);
    }
  };

  init();
})();
