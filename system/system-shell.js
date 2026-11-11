/* Shell compartilhado do Painel System (sidebar, barra superior e navegação
   inferior no celular). Carregado antes de system.js, users.js e roles.js.
   Esconder um item do menu NÃO protege nada: toda rota e API continuam
   checando permissão no servidor. */
(() => {
  "use strict";

  const ICONS = Object.freeze({
    overview: "M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z",
    restaurants: "M3 9l1.5-5h15L21 9v1a3 3 0 01-6 0 3 3 0 01-6 0 3 3 0 01-6 0V9z M5 13v8h14v-8",
    support: "M4 14v-2a8 8 0 0116 0v2 M4 14h3v5H5a1 1 0 01-1-1v-4z M20 14h-3v5h2a1 1 0 001-1v-4z",
    audit: "M14 3H6a1 1 0 00-1 1v16a1 1 0 001 1h12a1 1 0 001-1V8l-5-5z M14 3v5h5 M8 13h8 M8 17h6",
    users: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M22 21v-2a4 4 0 00-3-3.9 M16 3.1a4 4 0 010 7.8",
    roles: "M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6",
    menu: "M3 6h18 M3 12h18 M3 18h18",
    close: "M18 6L6 18 M6 6l12 12",
    check: "M20 6L9 17l-5-5",
    lock: "M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z M7 11V7a5 5 0 0110 0v4",
    search: "M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4.3-4.3",
    warning: "M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z M12 9v4 M12 17h.01",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4",
    clock: "M12 6v6l4 2 M12 22a10 10 0 100-20 10 10 0 000 20z",
    userPlus: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M19 8v6 M22 11h-6",
  });

  const NAVIGATION = Object.freeze([
    { key: "overview", group: "Plataforma", label: "Visão geral", short: "Início", href: "/system", permission: "system.dashboard.view", mobile: true },
    { key: "restaurants", group: "Plataforma", label: "Restaurantes", short: "Restaurantes", href: "/system#restaurants", permission: "system.restaurants.view", mobile: true },
    { key: "support", group: "Comercial", label: "Suporte", short: "Suporte", href: "/system#support", permission: "system.support.start", mobile: true },
    { key: "users", group: "Equipe INOVAS", label: "Usuários INOVAS", short: "Equipe", href: "/system/users", permission: "system.users.view", mobile: false },
    { key: "roles", group: "Equipe INOVAS", label: "Perfis e permissões", short: "Perfis", href: "/system/roles", permission: "system.roles.view", mobile: false },
    { key: "audit", group: "Equipe INOVAS", label: "Auditoria", short: "Auditoria", href: "/system#audit", permission: "system.audit.view", mobile: true },
  ]);

  const ROLE_LABELS = Object.freeze({
    MASTER: "Master",
    SOCIO: "Sócio",
    DESENVOLVEDOR: "Desenvolvedor",
    SUPORTE: "Suporte",
    FINANCEIRO_INOVAS: "Financeiro INOVAS",
    IMPLANTACAO: "Implantação",
    CUSTOMER_SUCCESS: "Customer Success",
    COMERCIAL: "Comercial",
    AUDITOR: "Auditor",
    ADMINISTRADOR: "Administrador",
  });

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const icon = (name, size = 20, color = "currentColor") =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[name] || ""}"></path></svg>`;

  const translateRole = (value) => {
    const key = String(value || "").trim().toUpperCase();
    if (ROLE_LABELS[key]) return ROLE_LABELS[key];
    if (!key) return "Perfil";
    return key
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const getInitials = (value) =>
    String(value || "IN")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "IN";

  const permissionsOf = (session) => new Set(session?.effectivePermissions || []);

  const visibleNavigation = (session) => {
    const permissions = permissionsOf(session);
    return NAVIGATION.filter((item) => permissions.has(item.permission));
  };

  const renderSidebar = (container, { session, activeKey, logoutAttribute = "data-system-logout" } = {}) => {
    if (!container) return;
    const items = visibleNavigation(session);
    const groups = [];
    for (const item of items) {
      let group = groups.find((entry) => entry.name === item.group);
      if (!group) {
        group = { name: item.group, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    }
    const name = session?.displayName || session?.login || "Conta autenticada";
    container.innerHTML = `
      <button type="button" class="sys-icon-btn sys-sidebar-close" data-sys-menu-close aria-label="Fechar menu">${icon("close")}</button>
      <a class="sys-brand" href="/system"><img src="/assets/inovas-food-logo-menu.png" alt="INOVAS Food" /></a>
      <div class="sys-brand-copy"><span>System · Console</span></div>
      <nav class="sys-nav" aria-label="Navegação principal">
        ${groups
          .map(
            (group) => `
              <span class="sys-nav-group">${escapeHtml(group.name)}</span>
              ${group.items
                .map(
                  (item) => `<a class="sys-nav-link" href="${item.href}" ${item.key === activeKey ? 'aria-current="page"' : ""}>${icon(item.key)}${escapeHtml(item.label)}</a>`
                )
                .join("")}`
          )
          .join("")}
      </nav>
      <div class="sys-account">
        <div class="sys-account-row">
          <span class="sys-avatar" aria-hidden="true">${escapeHtml(getInitials(name))}</span>
          <span><strong>${escapeHtml(name)}</strong><span>${escapeHtml(translateRole(session?.role))} · sem restaurante</span></span>
        </div>
        <button class="sys-logout" type="button" ${logoutAttribute}>Sair</button>
      </div>`;
  };

  const renderBottomNav = (container, { session, activeKey } = {}) => {
    if (!container) return;
    const items = visibleNavigation(session).filter((item) => item.mobile);
    if (!items.length) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
    container.innerHTML = items
      .map(
        (item) => `<a href="${item.href}" ${item.key === activeKey ? 'aria-current="page"' : ""}>${icon(item.key, 22)}<span>${escapeHtml(item.short)}</span></a>`
      )
      .join("");
  };

  const setMenuOpen = (open) => {
    const shellNode = document.querySelector(".sys-shell");
    const toggle = document.querySelector("[data-sys-menu-toggle]");
    if (!shellNode) return;
    shellNode.classList.toggle("is-menu-open", open);
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      const first = shellNode.querySelector(".sys-nav-link");
      if (first) first.focus();
    } else if (toggle) {
      toggle.focus();
    }
  };

  let menuBound = false;
  const bindMenu = () => {
    if (menuBound) return;
    menuBound = true;
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-sys-menu-toggle]")) {
        const shellNode = document.querySelector(".sys-shell");
        setMenuOpen(!(shellNode && shellNode.classList.contains("is-menu-open")));
        return;
      }
      if (event.target.closest("[data-sys-menu-close], [data-sys-backdrop]")) {
        setMenuOpen(false);
        return;
      }
      if (event.target.closest(".sys-sidebar .sys-nav-link")) {
        setMenuOpen(false);
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        const shellNode = document.querySelector(".sys-shell");
        if (shellNode && shellNode.classList.contains("is-menu-open")) setMenuOpen(false);
      }
    });
  };

  // Ambiente mostrado na barra superior; deduzido do endereço, nunca de segredo.
  const environmentLabel = () => {
    const host = String(window.location.hostname || "").toLowerCase();
    if (/^(localhost|127\.|0\.0\.0\.0)/.test(host)) return ["Local", "is-local"];
    if (host.endsWith(".vercel.app")) return ["Preview", "is-preview"];
    return ["Produção", "is-prod"];
  };

  const renderDesktopTop = ({ activeKey, crumbs } = {}) => {
    const main = document.querySelector(".sys-main");
    if (!main) return;
    let bar = main.querySelector("[data-sys-desktop-top]");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "sys-desktop-top";
      bar.setAttribute("data-sys-desktop-top", "");
      const mobileTop = main.querySelector(".sys-topbar");
      main.insertBefore(bar, mobileTop ? mobileTop.nextSibling : main.firstChild);
    }
    const item = NAVIGATION.find((entry) => entry.key === activeKey);
    const trail = crumbs || (item ? (item.key === "overview" ? [item.label] : [item.group, item.label]) : []);
    const [envLabel, envTone] = environmentLabel();
    bar.innerHTML = `
      <nav class="sys-crumbs" aria-label="Você está em"><span>System</span>${trail
        .map((part, index) => `<span aria-hidden="true">/</span>${index === trail.length - 1 ? `<strong>${escapeHtml(part)}</strong>` : `<span>${escapeHtml(part)}</span>`}`)
        .join("")}</nav>
      <form class="sys-quick-search" role="search" data-sys-quick-search>
        ${icon("search", 16)}
        <label class="sr-only" for="sys-quick-search-input">Buscar restaurante</label>
        <input id="sys-quick-search-input" type="search" name="q" placeholder="Buscar restaurante" autocomplete="off" />
        <kbd>Ctrl K</kbd>
      </form>
      <span class="sys-env ${envTone}"><span aria-hidden="true"></span>${escapeHtml(envLabel)}</span>`;
  };

  let quickSearchBound = false;
  const bindQuickSearch = () => {
    if (quickSearchBound) return;
    quickSearchBound = true;
    document.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-sys-quick-search]");
      if (!form) return;
      event.preventDefault();
      const term = String(new FormData(form).get("q") || "").trim();
      const hash = `restaurants${term ? `?search=${encodeURIComponent(term)}` : ""}`;
      if (window.location.pathname.replace(/\/$/, "") === "/system") {
        window.location.hash = hash;
      } else {
        window.location.assign(`/system#${hash}`);
      }
    });
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === "k") {
        const input = document.querySelector("#sys-quick-search-input");
        if (input) {
          event.preventDefault();
          input.focus();
        }
      }
    });
  };

  const mount = ({ session, activeKey, logoutAttribute, crumbs } = {}) => {
    renderSidebar(document.querySelector("[data-sys-sidebar]"), { session, activeKey, logoutAttribute });
    renderDesktopTop({ activeKey, crumbs });
    bindQuickSearch();
    renderBottomNav(document.querySelector("[data-sys-bottomnav]"), { session, activeKey });
    bindMenu();
  };

  window.InovasSystemShell = Object.freeze({
    ICONS,
    NAVIGATION,
    ROLE_LABELS,
    icon,
    escapeHtml,
    translateRole,
    getInitials,
    visibleNavigation,
    renderSidebar,
    renderBottomNav,
    renderDesktopTop,
    mount,
    setMenuOpen,
  });
})();
