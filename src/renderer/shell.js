"use strict";

(() => {
  const pdv = window.pdv;
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

  const ICONS = {
    pedidos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h12l2 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z"/><path d="M4 6h16"/><path d="M9 11h6"/><path d="M9 15h6"/></svg>',
    caixa: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/></svg>',
    comandas: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6"/><path d="M9 12h6"/></svg>',
    cardapio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 9h8"/><path d="M8 13h5"/></svg>',
  };
  const MODULE_LABELS = { pedidos: "Pedidos", caixa: "Caixa", comandas: "Comandas", cardapio: "Cardápio" };

  let current = null;
  let catalog = null;
  let catalogFilter = "all";
  let catalogLoading = false;
  const busyItems = new Set();

  /* ---------- utilidades ---------- */

  let toastTimer = null;
  const toast = (message, tone = "info") => {
    const node = $("#toast");
    node.textContent = message;
    node.dataset.tone = tone;
    node.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("show"), 3200);
  };

  const setFeedback = (message, tone = "info") => {
    const node = $("#login-feedback");
    node.hidden = !message;
    node.textContent = message || "";
    node.dataset.tone = tone;
  };

  const reportStage = () => {
    const stage = $("#stage");
    if (!stage || document.body.dataset.phase !== "app") {
      pdv.setStageBounds({ x: 0, y: 0, width: 0, height: 0 });
      return;
    }
    const rect = stage.getBoundingClientRect();
    pdv.setStageBounds({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
  };

  const money = (value) =>
    Number.isFinite(value) ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";

  const imageSrc = (image) => {
    const raw = String(image || "").trim();
    if (!raw || /^https?:/i.test(raw) || raw.startsWith("data:")) return "";
    const path = `/${raw.replace(/^\.?\/+/, "")}`;
    return `pdvimg://img${path.split("/").map(encodeURIComponent).join("/")}`;
  };

  /* ---------- estado ---------- */

  const render = (state) => {
    const previous = current;
    current = state;
    document.body.dataset.phase = state.phase;
    $("#app-version").textContent = state.version ? `v${state.version}` : "";
    document.querySelectorAll("[data-app-version]").forEach((node) => (node.textContent = state.version || ""));
    renderUpdate(state, previous);

    // Abertura / sem conexão
    if (state.phase === "starting" || state.phase === "connecting") {
      $("#splash-message").textContent = state.message || "Abrindo o INOVAS PDV…";
      $("#splash-retry").hidden = state.phase !== "connecting";
    }

    // Login
    if (state.phase === "login") {
      $("#server-label").textContent = (state.server || "").replace(/^https:\/\//, "");
      $("#server-edit").hidden = Boolean(state.serverLocked);
      $("#remember-row").hidden = !state.rememberAvailable;
      if (previous?.phase !== "login" || state.message !== previous?.message) {
        setFeedback(state.message, state.messageTone);
      }
      renderRestaurants(state.restaurants);
      if (previous?.phase !== "login") {
        setTimeout(() => ($("#identifier").value ? $("#password") : $("#identifier")).focus(), 50);
      }
    }

    // App
    if (state.phase === "app" && state.user) {
      $("#top-restaurant").textContent = state.user.restaurantName || "";
      $("#op-initials").textContent = state.user.initials;
      $("#op-name").textContent = state.user.displayName;
      $("#op-role").textContent = state.user.roleLabel;
      const conn = $("#conn");
      conn.dataset.state = state.connection;
      $("#conn-label").textContent =
        state.connection === "offline"
          ? "Sem conexão. Tentando de novo…"
          : state.connection === "renewing"
            ? "Reconectando…"
            : "Conectado neste computador";
      conn.title = $("#conn-label").textContent;
      renderNav(state);
      renderSteps(state);
      const onCardapio = state.activeModule === "cardapio";
      $("#cardapio").hidden = !onCardapio;
      $("#stage-loading").hidden = onCardapio;
      if (onCardapio && (previous?.activeModule !== "cardapio" || previous?.catalogAccess !== state.catalogAccess)) {
        void loadCatalog();
      }
    }

    requestAnimationFrame(reportStage);
  };

  /* ---------- atualização do app ---------- */

  const UPDATE_SHORT = {
    available: () => "Atualizar",
    downloading: (u) => `${u.progress || 0}%`,
    installing: () => "Instalando…",
    ready: () => "Baixado",
  };

  const UPDATE_LABELS = {
    available: (u) => `Atualizar para ${u.latestVersion}`,
    downloading: (u) => `Baixando ${u.progress || 0}%`,
    installing: () => "Instalando…",
    ready: () => "Atualização baixada",
  };

  const renderUpdate = (state, previous) => {
    const update = state.update || {};
    const label = UPDATE_LABELS[update.status];
    const button = $("#update-btn");
    button.hidden = !label;
    button.dataset.status = update.status || "";
    button.disabled = update.status !== "available";
    if (label) {
      $("#update-label").textContent = label(update);
      $("#update-short").textContent = UPDATE_SHORT[update.status](update);
      button.title = label(update);
    }
    const loginUpdate = $("#login-update");
    loginUpdate.hidden = !label;
    loginUpdate.textContent = label ? label(update) : "";
    loginUpdate.disabled = update.status !== "available";
    const before = previous?.update?.status;
    if (before === "checking" && update.status === "uptodate") {
      toast(`Você já está na versão mais recente (${state.version}).`);
    } else if (before === "checking" && update.status === "available") {
      toast(`Versão ${update.latestVersion} disponível. Clique em "Atualizar".`);
    } else if (update.status === "error" && before !== "error") {
      toast(update.message || "Não foi possível atualizar agora.", "error");
    }
  };

  const updateDialog = $("#confirm-update");
  const askUpdate = () => {
    if (current?.update?.status !== "available") return;
    $("#confirm-update-version").textContent = current.update.latestVersion;
    pdv.setStageBounds({ x: 0, y: 0, width: 0, height: 0 });
    updateDialog.showModal();
  };
  $("#update-btn").addEventListener("click", askUpdate);
  $("#login-update").addEventListener("click", askUpdate);
  updateDialog.addEventListener("close", () => {
    reportStage();
    if (updateDialog.returnValue === "ok") void pdv.installUpdate();
  });
  document.querySelectorAll("[data-update-check]").forEach((node) =>
    node.addEventListener("click", () => void pdv.checkUpdate())
  );

  const renderNav = (state) => {
    $("#nav-items").innerHTML = state.modules
      .map(
        (module) => `
        <button type="button" class="nav-item" data-module="${escapeHtml(module.id)}"
          ${module.id === state.activeModule ? 'aria-current="page"' : ""}
          ${module.available ? "" : 'disabled title="Seu usuário não tem acesso a este módulo."'}
          aria-label="${escapeHtml(module.label)}">
          ${ICONS[module.id] || ""}<span>${escapeHtml(module.label)}</span>
        </button>`
      )
      .join("");
  };

  const renderSteps = (state) => {
    const routes = state.routes || [];
    const label = MODULE_LABELS[state.activeModule] || "";
    const steps =
      routes.length > 1
        ? routes
            .map(
              (route) =>
                `<button type="button" class="step" data-route="${escapeHtml(route.id)}" aria-pressed="${route.id === state.activeRoute}">${escapeHtml(route.label)}</button>`
            )
            .join("")
        : "";
    const reload =
      state.activeModule && state.activeModule !== "cardapio"
        ? '<button type="button" class="btn reload" data-action="reload" title="Recarregar a tela (F5)">Recarregar</button>'
        : "";
    $("#steps").innerHTML = `<span class="lbl">${escapeHtml(label)}</span>${steps}${
      state.hint ? `<span class="hint">${escapeHtml(state.hint)}</span>` : ""
    }${reload}`;
  };

  const renderRestaurants = (restaurants) => {
    const box = $("#restaurants");
    if (!Array.isArray(restaurants) || !restaurants.length) {
      box.hidden = true;
      $("#restaurant-list").innerHTML = "";
      return;
    }
    box.hidden = false;
    $("#restaurant-list").innerHTML = restaurants
      .map(
        (restaurant) => `
        <button type="button" class="restaurant-option" data-restaurant="${escapeHtml(restaurant.restaurantKey)}">
          <span>${escapeHtml(restaurant.name || restaurant.restaurantKey)}</span><small>${escapeHtml(restaurant.role)}</small>
        </button>`
      )
      .join("");
  };

  /* ---------- login ---------- */

  const submitLogin = async (restaurantKey = "") => {
    const identifier = $("#identifier").value.trim();
    const password = $("#password").value;
    if (!identifier || !password) {
      setFeedback("Preencha login e senha para continuar.", "error");
      return;
    }
    const button = $("#login-submit");
    button.disabled = true;
    button.textContent = "Entrando…";
    setFeedback("");
    try {
      const result = await pdv.login({
        identifier,
        password,
        remember: $("#remember").checked && current?.rememberAvailable,
        restaurantKey,
      });
      if (!result.ok) {
        setFeedback(result.message || "Não foi possível entrar.", result.restaurants ? "info" : "error");
        if (!result.restaurants) $("#password").select();
      } else {
        $("#password").value = "";
      }
    } finally {
      button.disabled = false;
      button.textContent = "Entrar";
    }
  };

  $("#login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void submitLogin();
  });
  $("#restaurant-list").addEventListener("click", (event) => {
    const option = event.target.closest("[data-restaurant]");
    if (option) void submitLogin(option.dataset.restaurant);
  });
  $("#eye").addEventListener("click", () => {
    const input = $("#password");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    $("#eye").setAttribute("aria-pressed", String(show));
    $("#eye").setAttribute("aria-label", show ? "Esconder senha" : "Mostrar senha");
    input.focus();
  });
  $("#server-edit").addEventListener("click", () => {
    const form = $("#server-form");
    form.hidden = !form.hidden;
    if (!form.hidden) {
      $("#server-input").value = current?.server || "";
      $("#server-input").focus();
    }
  });
  $("#server-save").addEventListener("click", async () => {
    const result = await pdv.setServer($("#server-input").value);
    if (result.ok) {
      $("#server-form").hidden = true;
      setFeedback(`Servidor alterado para ${result.server}.`, "success");
    } else {
      setFeedback(result.message, "error");
    }
  });
  $("#splash-retry").addEventListener("click", () => void pdv.retry());

  /* ---------- app ---------- */

  $("#nav-items").addEventListener("click", (event) => {
    const item = event.target.closest("[data-module]");
    if (item && !item.disabled) void pdv.open(item.dataset.module);
  });
  $("#steps").addEventListener("click", (event) => {
    const step = event.target.closest("[data-route]");
    if (step && current) {
      void pdv.open(current.activeModule, step.dataset.route);
      return;
    }
    if (event.target.closest('[data-action="reload"]')) void pdv.reload();
  });

  // O diálogo fica por cima da tela do Gestor: o app esconde a tela enquanto ele está aberto.
  const dialog = $("#confirm-logout");
  $("#logout").addEventListener("click", () => {
    pdv.setStageBounds({ x: 0, y: 0, width: 0, height: 0 });
    dialog.showModal();
  });
  dialog.addEventListener("close", async () => {
    if (dialog.returnValue === "ok") {
      await pdv.logout();
    } else {
      reportStage();
    }
  });

  /* ---------- cardápio ---------- */

  const showCatalogMessage = (html, tone = "info") => {
    const node = $("#cd-message");
    node.hidden = !html;
    node.innerHTML = html || "";
    node.dataset.tone = tone;
  };

  const loadCatalog = async () => {
    if (catalogLoading) return;
    if (current?.catalogAccess === "none") {
      catalog = null;
      renderCatalog();
      showCatalogMessage(
        "<strong>Seu usuário ainda não pode pausar pratos.</strong>Peça ao dono ou gerente para liberar o Cardápio para o seu usuário no Gestor (Usuários). Enquanto isso, a pausa pode ser feita por eles no Gestor.",
        "locked"
      );
      return;
    }
    catalogLoading = true;
    showCatalogMessage("Carregando cardápio…");
    try {
      const result = await pdv.listCatalog();
      if (!result.ok) {
        catalog = null;
        renderCatalog();
        showCatalogMessage(
          result.status === 403
            ? "<strong>Seu usuário ainda não pode ver o cardápio.</strong>Peça ao dono ou gerente para liberar o Cardápio para o seu usuário no Gestor."
            : `<strong>Não foi possível carregar o cardápio.</strong>${escapeHtml(result.message || "")}`,
          result.status === 403 ? "locked" : "error"
        );
        return;
      }
      catalog = result.sections;
      showCatalogMessage(
        current?.catalogAccess === "view"
          ? "<strong>Somente consulta.</strong>Seu usuário vê o cardápio, mas não pode pausar pratos. Peça ao dono ou gerente para liberar."
          : "",
        "locked"
      );
      renderCatalog();
    } finally {
      catalogLoading = false;
    }
  };

  const normalize = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();

  const renderCatalog = () => {
    const list = $("#cd-list");
    if (!catalog) {
      list.innerHTML = "";
      $("#cd-on").textContent = "0";
      $("#cd-off").textContent = "0";
      return;
    }
    const all = catalog.flatMap((section) => section.items);
    $("#cd-on").textContent = String(all.filter((item) => item.availabilityState === "active").length);
    $("#cd-off").textContent = String(all.filter((item) => item.availabilityState === "paused").length);
    const query = normalize($("#cd-search").value.trim());
    const canPause = current?.catalogAccess === "pause";
    const html = catalog
      .map((section) => {
        const items = section.items.filter((item) => {
          if (catalogFilter === "active" && item.availabilityState !== "active") return false;
          if (catalogFilter === "paused" && item.availabilityState !== "paused") return false;
          return !query || normalize(`${item.name} ${item.category}`).includes(query);
        });
        if (!items.length) return "";
        return `
          <section class="sec">
            <h2>${escapeHtml(section.title)} <small>${items.length} ${items.length === 1 ? "prato" : "pratos"}</small></h2>
            ${items
              .map((item) => {
                const paused = item.availabilityState === "paused";
                const active = item.availabilityState === "active";
                const busy = busyItems.has(item.id);
                const src = imageSrc(item.image);
                const stateLabel = active ? "No site" : paused ? "Pausado" : "Indisponível";
                const stateClass = active ? "on" : paused ? "off" : "other";
                const button = !canPause
                  ? ""
                  : active || paused
                    ? `<button type="button" class="toggle ${paused ? "is-resume" : "is-pause"}" data-item="${escapeHtml(item.id)}" data-next="${paused ? "active" : "paused"}" ${busy ? "disabled" : ""}>${busy ? "Salvando…" : paused ? "Reativar" : "Pausar"}</button>`
                    : `<button type="button" class="toggle" disabled title="Prato indisponível: só o Gestor muda.">Indisponível</button>`;
                return `
                  <div class="row ${paused ? "is-paused" : ""}" data-row="${escapeHtml(item.id)}">
                    ${src ? `<img class="thumb" src="${escapeHtml(src)}" alt="" loading="lazy" />` : '<span class="thumb" aria-hidden="true"></span>'}
                    <div class="name"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)}</small></div>
                    <span class="price">${escapeHtml(money(item.price))}</span>
                    <span class="state ${stateClass}">${stateLabel}</span>
                    ${button}
                  </div>`;
              })
              .join("")}
          </section>`;
      })
      .join("");
    list.innerHTML = html || '<div class="sec"><p class="empty">Nenhum prato encontrado.</p></div>';
  };

  $("#cd-search").addEventListener("input", () => renderCatalog());
  document.querySelector(".cd-chips").addEventListener("click", (event) => {
    const chip = event.target.closest("[data-filter]");
    if (!chip) return;
    catalogFilter = chip.dataset.filter;
    document.querySelectorAll(".cd-chips .chip").forEach((node) =>
      node.setAttribute("aria-pressed", String(node === chip))
    );
    renderCatalog();
  });
  $("#cd-refresh").addEventListener("click", () => void loadCatalog());
  $("#cd-list").addEventListener("error", (event) => {
    if (event.target.matches?.("img.thumb")) event.target.removeAttribute("src");
  }, true);

  $("#cd-list").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-item]");
    if (!button || !catalog) return;
    const itemId = button.dataset.item;
    const next = button.dataset.next;
    const item = catalog.flatMap((section) => section.items).find((entry) => entry.id === itemId);
    if (!item) return;
    busyItems.add(itemId);
    renderCatalog();
    const result = await pdv.setAvailability(itemId, next);
    busyItems.delete(itemId);
    if (result.ok) {
      item.availabilityState = next;
      toast(next === "paused" ? `${item.name} pausado. Saiu do site.` : `${item.name} reativado. Voltou para o site.`);
    } else {
      toast(result.message || "Não foi possível alterar este prato.", "error");
    }
    renderCatalog();
  });

  /* ---------- início ---------- */

  new ResizeObserver(() => reportStage()).observe($("#stage"));
  window.addEventListener("resize", reportStage);
  pdv.onState(render);
  void pdv.getState().then(render);
})();
