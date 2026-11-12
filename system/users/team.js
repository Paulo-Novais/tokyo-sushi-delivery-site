/* Usuários INOVAS (Painel System), conforme o "Esboço Painel System INOVAS v2".
   Lista a equipe interna, mostra indicadores reais e permite convidar um
   membro com um perfil. Só dados que o servidor realmente tem: não há
   verificação em 2 etapas nem escopo por restaurante, então essas partes
   do esboço não aparecem. Toda regra continua sendo checada na API. */
(() => {
  "use strict";

  const shell = window.InovasSystemShell;
  const app = document.querySelector("[data-team-app]");
  const toast = document.querySelector("[data-team-toast]");
  const { icon, escapeHtml, translateRole, getInitials } = shell;

  const state = {
    session: null,
    users: [],
    policy: null,
    audit: null,
    search: "",
    inviteRole: "",
    inviteResult: null,
    sending: false,
  };

  // Permissões que vale mostrar como "não pode" quando o perfil não tem.
  const KEY_LIMITS = Object.freeze([
    "system.restaurants.suspend",
    "system.users.manage",
    "system.roles.manage",
    "system.support.admin",
    "system.billing.manage",
  ]);

  const normalize = (value) => String(value || "").trim().toUpperCase();
  const permissions = () => new Set(state.session?.effectivePermissions || []);
  const can = (permission) => permissions().has(permission);

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
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => {
      toast.hidden = true;
    }, 4200);
  };

  const parseDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const pad = (value) => String(value).padStart(2, "0");

  const formatLastAccess = (value) => {
    const date = parseDate(value);
    if (!date) return "nunca";
    const diff = Date.now() - date.getTime();
    if (diff < 5 * 60000) return "agora";
    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);
    if (date.toDateString() === today.toDateString()) return `hoje, ${time}`;
    if (date.toDateString() === yesterday.toDateString()) return `ontem, ${time}`;
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}, ${time}`;
  };

  const formatDateTime = (value) => {
    const date = parseDate(value);
    if (!date) return "";
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} às ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const roles = () =>
    [...(state.policy?.roles || [])].sort(
      (left, right) => Number(right.authority || 0) - Number(left.authority || 0)
    );

  const roleOf = (key) => roles().find((role) => role.key === normalize(key)) || null;
  const roleLabel = (key) => roleOf(key)?.label || translateRole(key);

  const permissionText = (key) =>
    (state.policy?.permissions || []).find((permission) => permission.key === key)?.description || key;

  const statusOf = (user) => {
    const status = normalize(user.status);
    const invitation = normalize(user.invitation?.state);
    if (status === "ACTIVE") return ["Ativo", "ok"];
    if (status === "BLOCKED") return ["Bloqueado", "crit"];
    if (status === "INACTIVE") return ["Inativo", "neutral"];
    if (status === "INVITE_EXPIRED" || invitation === "EXPIRED") return ["Convite expirado", "warn"];
    if (status === "PENDING" || invitation === "PENDING") return ["Convite pendente", "warn"];
    return [user.statusLabel || "Pendente", "neutral"];
  };

  const isPendingInvite = (user) => statusOf(user)[0] === "Convite pendente";

  const roleTone = (key) => {
    const authority = Number(roleOf(key)?.authority || 0);
    if (normalize(key) === "MASTER") return "is-master";
    if (authority >= 60) return "is-high";
    if (authority >= 40) return "is-mid";
    return "is-low";
  };

  /* ---------- indicadores ---------- */

  const renderKpis = () => {
    const active = state.users.filter((user) => normalize(user.status) === "ACTIVE").length;
    const pending = state.users.filter(isPendingInvite).length;
    const high = state.users.filter((user) => Number(roleOf(user.role)?.authority || 0) >= 90);
    const usedRoles = [...new Set(state.users.map((user) => normalize(user.role)))];
    const allRoles = roles();
    const kpi = (label, value, hint, iconName) => `
      <article class="sys-team-kpi">
        <div class="sys-team-kpi-head"><span>${escapeHtml(label)}</span><span class="sys-team-kpi-icon" aria-hidden="true">${icon(iconName, 16)}</span></div>
        <strong>${escapeHtml(String(value))}</strong>
        <small>${escapeHtml(hint)}</small>
      </article>`;
    let supportCard = "";
    if (state.audit) {
      const since = Date.now() - 30 * 86400000;
      const started = (state.audit.events || []).filter(
        (event) =>
          normalize(event.eventType) === "SUPPORT_SESSION_STARTED" &&
          (parseDate(event.createdAt)?.getTime() || 0) >= since
      );
      const withReason = started.filter((event) => String(event.reason || "").trim()).length;
      supportCard = kpi(
        "Sessões de suporte (30 dias)",
        started.length,
        started.length
          ? withReason === started.length
            ? "Todas com motivo registrado"
            : `${withReason} de ${started.length} com motivo registrado`
          : "Nenhuma sessão aberta no período",
        "support"
      );
    }
    return `
      <section class="sys-team-kpis" aria-label="Indicadores da equipe">
        ${kpi("Membros ativos", active, pending ? `${pending} convite${pending > 1 ? "s" : ""} pendente${pending > 1 ? "s" : ""}` : "Nenhum convite pendente", "users")}
        ${kpi("Acesso alto", high.length, "Perfis com nível 90 ou mais", "shield")}
        ${supportCard}
        ${allRoles.length ? kpi("Perfis em uso", `${usedRoles.length} de ${allRoles.length}`, usedRoles.map(roleLabel).join(", ") || "Nenhum", "lock") : ""}
      </section>`;
  };

  /* ---------- tabela ---------- */

  const filteredUsers = () => {
    const query = state.search.trim().toLowerCase();
    return state.users.filter(
      (user) => !query || `${user.name || ""} ${user.email || ""}`.toLowerCase().includes(query)
    );
  };

  const renderRows = () => {
    const root = app.querySelector("[data-team-rows]");
    if (!root) return;
    const users = filteredUsers();
    const manage = can("system.users.manage");
    root.innerHTML = users.length
      ? users
          .map((user) => {
            const [statusLabel, statusTone] = statusOf(user);
            const self = user.identityId && user.identityId === state.session?.identityId;
            const pending = isPendingInvite(user);
            return `
              <tr>
                <td data-label="Membro"><div class="sys-team-member"><span class="sys-team-avatar ${self ? "is-self" : ""} ${pending ? "is-pending" : ""}" aria-hidden="true">${escapeHtml(pending && !user.name ? "?" : getInitials(user.name || user.email))}</span><span><strong>${escapeHtml(pending && !user.lastAccessAt ? user.name || "Convite enviado" : user.name || user.email)}</strong><small>${escapeHtml(user.email || "")}</small></span></div></td>
                <td data-label="Perfil"><span class="sys-role-badge ${roleTone(user.role)}">${escapeHtml(user.roleLabel || roleLabel(user.role))}</span></td>
                <td data-label="Último acesso">${escapeHtml(formatLastAccess(user.lastAccessAt))}</td>
                <td data-label="Status"><span class="sys-pill is-${statusTone}">${escapeHtml(statusLabel)}</span></td>
                <td class="sys-team-action"><a class="sys-btn sys-btn-secondary sys-btn-sm" href="/system/users/${encodeURIComponent(user.id)}/edit">${manage ? "Gerenciar" : "Ver"}</a></td>
              </tr>`;
          })
          .join("")
      : `<tr><td colspan="5" class="sys-team-empty">Nenhum membro encontrado para "${escapeHtml(state.search)}".</td></tr>`;
  };

  /* ---------- convite ---------- */

  // O que cada perfil faz, em uma linha (o cartão do esboço). Perfis novos caem no texto genérico.
  const ROLE_SUMMARY = {
    MASTER: "Tudo no System, inclusive usuários, planos e domínios.",
    ADMINISTRADOR: "Quase tudo, sem mexer em usuários, perfis, cobrança e ajustes da plataforma.",
    SOCIO: "Visão completa do negócio, sem gerenciar usuários, perfis e cobrança.",
    DESENVOLVEDOR: "Suporte técnico, saúde do sistema e auditoria.",
    SUPORTE: "Abre sessões de suporte temporárias nos restaurantes.",
    CUSTOMER_SUCCESS: "Acompanha os restaurantes e abre suporte quando precisam.",
    IMPLANTACAO: "Cadastra restaurantes, domínios e acompanha a implantação.",
    FINANCEIRO_INOVAS: "Cobrança e faturas dos restaurantes.",
    COMERCIAL: "Cadastro e plano dos restaurantes, sem dados operacionais.",
    AUDITOR: "Só visualiza auditoria, cobrança, usuários e saúde da plataforma.",
  };
  const roleSummary = (role) => {
    const known = ROLE_SUMMARY[normalize(role.key)];
    if (known) return known;
    const count = (role.permissions || []).filter((key) => !key.startsWith("tenant.")).length;
    return `${count} permissão(ões) no System.`;
  };

  // Convidar = escolher o perfil da pessoa: exclusivo do usuário Master.
  const isMaster = () => normalize(state.session?.role) === "MASTER";

  const openInvite = () => {
    const dialog = app.querySelector("[data-invite-dialog]");
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('input[name="name"]')?.focus();
  };

  const closeInvite = () => {
    const dialog = app.querySelector("[data-invite-dialog]");
    if (dialog?.open) dialog.close();
    state.inviteResult = null;
  };

  const renderInviteResult = () => {
    const result = state.inviteResult;
    const expires = formatDateTime(result.user?.invitation?.expiresAt);
    const link = result.access?.invitationUrl || "";
    return `
      <div class="sys-inv-done" role="status">
        <span class="sys-inv-done-icon">${icon("check", 22)}</span>
        <strong>Convite registrado para ${escapeHtml(result.user?.email || "")}</strong>
        <span>${expires ? `Vale até ${escapeHtml(expires)}.` : "O prazo segue a configuração da plataforma."} Fica registrado na Auditoria.</span>
        ${
          link
            ? `<label class="sys-inv-link"><span>Link do convite (aparece só uma vez)</span><input readonly value="${escapeHtml(link)}" data-invite-link /></label>
               <button type="button" class="sys-btn sys-btn-secondary" data-invite-copy>Copiar link</button>`
            : "<span>O link não é exibido neste ambiente; a pessoa recebe pelo canal configurado.</span>"
        }
      </div>
      <div class="sys-inv-actions"><button type="button" class="sys-btn sys-btn-primary" data-invite-close>Fechar</button></div>`;
  };

  const renderInvite = () => {
    if (!can("system.users.manage") || !isMaster()) return "";
    const available = [...roles()].sort((left, right) => Number(right.authority || 0) - Number(left.authority || 0));
    if (!state.inviteRole || !roleOf(state.inviteRole)) {
      state.inviteRole =
        (available.find((role) => normalize(role.key) === "SUPORTE") ||
          available.find((role) => normalize(role.key) !== "MASTER") ||
          available[0] ||
          {}).key || "";
    }
    return `
      <dialog class="sys-inv-dialog" data-invite-dialog aria-labelledby="convidar-titulo">
        <header class="sys-inv-head">
          <div>
            <span class="sys-inv-eyebrow">Equipe INOVAS</span>
            <h2 id="convidar-titulo">Convidar usuário</h2>
            <p>A pessoa recebe um link e cria a própria senha.</p>
          </div>
          <button type="button" class="sys-inv-close" aria-label="Fechar" data-invite-close>${icon("close", 18)}</button>
        </header>
        ${
          state.inviteResult
            ? renderInviteResult()
            : `<form class="sys-inv-form" data-invite-form novalidate>
                <div class="sys-inv-row">
                  <label class="sys-inv-field"><span>Nome</span><input name="name" autocomplete="off" placeholder="Nome completo" required /></label>
                  <label class="sys-inv-field"><span>E-mail</span><input name="email" type="email" autocomplete="off" placeholder="nome@inovasfood.com.br" required data-invite-email /></label>
                </div>
                <fieldset class="sys-inv-roles">
                  <legend>Perfil</legend>
                  ${available
                    .map(
                      (role) => `
                        <label class="sys-inv-role ${role.key === state.inviteRole ? "is-active" : ""}">
                          <input type="radio" name="role" value="${escapeHtml(role.key)}" ${role.key === state.inviteRole ? "checked" : ""} data-invite-role />
                          <span><strong>${escapeHtml(role.label)}</strong><small>${escapeHtml(roleSummary(role))}</small></span>
                        </label>`
                    )
                    .join("")}
                </fieldset>
                <div class="sys-inv-options">
                  <label class="sys-inv-ttl"><span>Validade do convite</span>
                    <select name="ttl"><option value="48" selected>48 horas</option><option value="168">7 dias</option></select>
                  </label>
                </div>
                <p class="sys-inv-note">O convite e o perfil escolhido ficam registrados na Auditoria. Ninguém da equipe entra num restaurante sem sessão de suporte.</p>
                <p class="sys-invite-error" data-invite-error hidden></p>
                <div class="sys-inv-actions">
                  <button type="button" class="sys-btn sys-btn-secondary" data-invite-close>Cancelar</button>
                  <button class="sys-btn sys-btn-primary" type="submit" ${state.sending ? "disabled" : ""}>${state.sending ? "Enviando…" : "Enviar convite"}</button>
                </div>
              </form>`
        }
      </dialog>`;
  };


  /* ---------- página ---------- */

  const render = () => {
    const manage = can("system.users.manage") && isMaster();
    app.innerHTML = `
      <header class="sys-page-head">
        <div>
          <span class="sys-eyebrow">Equipe INOVAS · acessos</span>
          <h1>Usuários INOVAS</h1>
          <p>Quem da INOVAS acessa o System e com qual perfil. Nenhum usuário daqui entra num restaurante sem sessão de suporte.</p>
          <div class="sys-head-buttons">
            ${can("system.roles.view") ? `<a class="sys-btn sys-btn-secondary" href="/system/roles">${icon("shield", 16)}Perfis e permissões</a>` : ""}
            ${manage ? `<button class="sys-btn sys-btn-primary" type="button" data-invite-focus>${icon("userPlus", 16)}Convidar membro</button>` : ""}
          </div>
        </div>
      </header>
      ${renderKpis()}
      <div class="sys-team-layout is-single">
        <section class="sys-card sys-team-card" aria-labelledby="equipe-titulo">
          <div class="sys-team-card-head">
            <h2 id="equipe-titulo">Equipe <span class="sys-team-count">${state.users.length}</span></h2>
            <label class="sys-search sys-team-search"><span class="sr-only">Buscar por nome ou e-mail</span>${icon("search", 16, "#6b7280")}<input class="sys-input" type="search" placeholder="Nome ou e-mail" value="${escapeHtml(state.search)}" data-team-search /></label>
          </div>
          <div class="sys-table-wrap">
            <table class="sys-table is-stack sys-team-table" aria-label="Membros da equipe INOVAS">
              <thead><tr><th>Membro</th><th>Perfil</th><th>Último acesso</th><th>Status</th><th><span class="sr-only">Ações</span></th></tr></thead>
              <tbody data-team-rows></tbody>
            </table>
          </div>
        </section>
      </div>
      ${renderInvite()}`;
    renderRows();
  };

  const renderFatal = (error) => {
    const unauthorized = error?.status === 401;
    app.innerHTML = `
      <section class="sys-card sys-error">
        <div class="sys-card-body">
          <h2>${error?.status === 403 ? "Seu perfil não tem acesso a esta área" : "Não foi possível abrir esta área"}</h2>
          <p>${escapeHtml(error?.message || "Tente novamente em instantes.")}</p>
          <a class="sys-btn sys-btn-primary" href="${unauthorized ? "/system/login.html" : "/system/users"}">${unauthorized ? "Entrar novamente" : "Tentar novamente"}</a>
        </div>
      </section>`;
  };

  const loadUsers = async () => {
    const payload = await requestJson("/api/system/users?page=1&pageSize=100&sort=name&direction=asc");
    state.users = Array.isArray(payload?.data?.users) ? payload.data.users : [];
  };

  const loadPolicy = async () => {
    const url = can("system.roles.view") ? "/api/system/roles?domain=SYSTEM" : "/api/system/permissions";
    const payload = await requestJson(url);
    state.policy = payload.data || null;
  };

  const loadAudit = async () => {
    if (!can("system.audit.view")) return;
    try {
      const payload = await requestJson("/api/system/audit");
      state.audit = payload.data || null;
    } catch {
      state.audit = null;
    }
  };

  const sendInvite = async (form) => {
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const role = String(data.get("role") || state.inviteRole || "");
    const errorNode = form.querySelector("[data-invite-error]");
    const fail = (message) => {
      errorNode.textContent = message;
      errorNode.hidden = false;
    };
    errorNode.hidden = true;
    if (!name) return fail("Informe o nome da pessoa.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Informe um e-mail válido.");
    if (!role) return fail("Escolha um perfil.");
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Enviando…";
    try {
      const payload = await requestJson("/api/system/users", {
        method: "POST",
        body: JSON.stringify({ name, email, role, credentialMode: "INVITE", invitationTtlHours: Number(data.get("ttl") || 48) }),
      });
      state.inviteResult = payload.data || null;
      notify("Convite registrado e enviado para a auditoria.");
      await loadUsers();
      render();
      openInvite();
    } catch (error) {
      button.disabled = false;
      button.textContent = "Enviar convite";
      fail(error.message);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
    } catch {}
    for (const storage of [window.localStorage, window.sessionStorage]) {
      try {
        for (let index = storage.length - 1; index >= 0; index -= 1) {
          const key = storage.key(index) || "";
          if (/auth|session|token|support/i.test(key)) storage.removeItem(key);
        }
      } catch {}
    }
    window.location.replace("/system/login.html");
  };

  document.addEventListener("input", (event) => {
    if (event.target.matches("[data-team-search]")) {
      state.search = event.target.value;
      renderRows();
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-invite-role]")) {
      state.inviteRole = event.target.value;
      for (const card of app.querySelectorAll(".sys-inv-role")) {
        card.classList.toggle("is-active", card.querySelector("input")?.checked === true);
      }
    }
  });

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-invite-form]");
    if (!form) return;
    event.preventDefault();
    sendInvite(form);
  });

  document.addEventListener("click", async (event) => {
    if (event.target.closest("[data-team-logout]")) return void logout();
    if (event.target.closest("[data-invite-focus]")) {
      state.inviteResult = null;
      render();
      openInvite();
      return;
    }
    if (event.target.closest("[data-invite-close]")) {
      closeInvite();
      return;
    }
    // Clique fora da janela fecha.
    if (event.target instanceof HTMLDialogElement && event.target.matches("[data-invite-dialog]")) {
      closeInvite();
      return;
    }
    if (event.target.closest("[data-invite-copy]")) {
      const input = app.querySelector("[data-invite-link]");
      if (!input) return;
      try {
        await navigator.clipboard.writeText(input.value);
        notify("Link copiado.");
      } catch {
        input.select();
        notify("Selecione e copie o link manualmente.");
      }
    }
  });

  const start = async () => {
    try {
      const payload = await requestJson("/api/auth/system/session");
      const session = payload?.data?.session || null;
      if (!session || payload.authenticated === false) {
        const error = new Error("Sua sessão expirou. Entre novamente.");
        error.status = 401;
        throw error;
      }
      if (session.tenantId || session.restaurantId) {
        throw new Error("A sessão System apresentou um escopo inválido.");
      }
      state.session = session;
      shell.mount({ session, activeKey: "users", logoutAttribute: "data-team-logout" });
      if (!can("system.users.view")) {
        const error = new Error("Peça a um Master para liberar a visualização da equipe.");
        error.status = 403;
        throw error;
      }
      await Promise.all([loadUsers(), loadPolicy(), loadAudit()]);
      render();
    } catch (error) {
      if (error?.status === 401) {
        window.location.replace("/system/login.html");
        return;
      }
      renderFatal(error);
    }
  };

  start();
})();
