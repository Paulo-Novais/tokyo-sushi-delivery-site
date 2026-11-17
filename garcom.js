// INOVAS Garçom: tela do celular do garçom (usada pelo app Android e também
// abre no navegador do celular). Só faz: login, mesas, abrir comanda,
// lançar itens do cardápio e enviar para a cozinha. Fechar conta, pagamento
// e caixa ficam no Gestor do PC (o servidor recusa essas ações aqui).
(() => {
  "use strict";

  const CLIENT_HEADER = "inovas-garcom-android";
  const REFRESH_MS = 15000;
  const root = document.querySelector("[data-gc-root]");
  const toastNode = document.querySelector("[data-gc-toast]");

  const state = {
    screen: "boot", // boot | login | tables | tab | denied
    waiter: null,
    snapshot: null,
    catalog: null,
    tabId: "",
    view: "menu", // menu | order
    search: "",
    sectionId: "",
    sheet: null,
    busy: "",
    login: { identifier: "", error: "", restaurants: [], restaurantKey: "" },
    deniedMessage: "",
    offline: false,
  };

  /* ---------- utilidades ---------- */

  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);
  const money = (value) =>
    Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const normalizeSearch = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  const mediaUrl = (value) => {
    const source = String(value || "").trim();
    if (!source) return "";
    if (/^(?:https?:|data:image\/|\/)/i.test(source)) return source;
    return `/${source.replace(/^(?:\.\/)+/, "")}`;
  };
  const newOperationId = () => {
    if (window.crypto?.randomUUID) return `op_${window.crypto.randomUUID()}`;
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `op_${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const toast = (message, tone = "ok") => {
    if (!toastNode) return;
    toastNode.textContent = message;
    toastNode.dataset.tone = tone;
    toastNode.hidden = false;
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => {
      toastNode.hidden = true;
    }, tone === "error" ? 5000 : 2500);
  };

  /* ---------- servidor ---------- */

  const api = async (path, { method = "GET", body } = {}) => {
    const response = await fetch(path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "X-Inovas-Client": CLIENT_HEADER,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const error = new Error(payload?.error || "Não foi possível concluir. Tente de novo.");
      error.status = response.status;
      error.errorCode = payload?.errorCode || "";
      error.payload = payload;
      throw error;
    }
    return payload || {};
  };

  const isRetryable = (error) => !error.status || error.status >= 500;

  const handleAuthError = (error) => {
    if (error.status === 401) {
      // Primeira abertura: só mostra o login, sem aviso de sessão.
      if (state.screen !== "boot") state.login.error = "Sua sessão terminou. Entre de novo.";
      state.screen = "login";
      state.sheet = null;
      render();
      return true;
    }
    if (error.status === 403 && /permission|forbidden|access|plan|denied|not_allowed/i.test(error.errorCode)) {
      state.screen = "denied";
      state.deniedMessage = error.message;
      render();
      return true;
    }
    return false;
  };

  const applyPayload = (payload) => {
    if (payload.snapshot) state.snapshot = payload.snapshot;
    if (payload.catalog) state.catalog = payload.catalog;
    if (payload.waiter) state.waiter = payload.waiter;
    if (state.tabId && !getTab()) {
      state.tabId = "";
      if (state.screen === "tab") state.screen = "tables";
    }
  };

  const loadSnapshot = async ({ quiet = false } = {}) => {
    try {
      const payload = await api("/api/admin/cash-register/snapshot");
      applyPayload(payload);
      state.offline = false;
      if (state.screen === "boot" || state.screen === "login") state.screen = "tables";
      render();
      return true;
    } catch (error) {
      if (handleAuthError(error)) return false;
      if (!error.status) {
        state.offline = true;
        if (state.screen === "boot") state.screen = "tables";
        render();
        if (!quiet) toast("Sem conexão. Tentando de novo…", "error");
        return false;
      }
      if (!quiet) toast(error.message, "error");
      render();
      return false;
    }
  };

  // Ação do garçom. O mesmo código de operação é reenviado se a rede falhar:
  // o servidor grava uma vez só (não duplica item nem pedido na cozinha).
  const runAction = async (action, body, busy = action) => {
    if (state.busy) return null;
    state.busy = busy;
    render();
    const operationId = newOperationId();
    try {
      for (let attempt = 1; ; attempt += 1) {
        try {
          const payload = await api(`/api/admin/cash-register/${action}`, {
            method: "POST",
            body: { ...body, operationId },
          });
          state.offline = false;
          applyPayload(payload);
          return payload;
        } catch (error) {
          if (attempt < 4 && isRetryable(error)) {
            state.offline = !error.status;
            await wait(800 * attempt);
            continue;
          }
          throw error;
        }
      }
    } catch (error) {
      if (error.status === 401) handleAuthError(error);
      else toast(error.status ? error.message : "Sem conexão. Confira o Wi-Fi e tente de novo.", "error");
      return null;
    } finally {
      state.busy = "";
      render();
    }
  };

  /* ---------- dados ---------- */

  const getSnapshot = () => state.snapshot || { tables: [], activeTabs: [], register: null };
  const getTab = () => getSnapshot().activeTabs.find((tab) => tab.id === state.tabId) || null;
  const getTable = (tableId) => getSnapshot().tables.find((table) => table.id === tableId) || null;
  const tableName = (table) =>
    table ? table.label || `Mesa ${table.number}` : "Mesa";
  const getSections = () =>
    (state.catalog?.sections || [])
      .map((section) => ({
        ...section,
        items: (section.items || []).filter(
          (item) => item.isOrderable === true && item.isPaused !== true && item.isAvailable !== false
        ),
      }))
      .filter((section) => section.items.length);
  const getProducts = () =>
    getSections().flatMap((section) =>
      section.items.map((item) => ({ ...item, sectionId: section.id, sectionTitle: section.title }))
    );
  const pendingItems = (tab) => (tab?.items || []).filter((item) => item.status === "PENDING");
  const sentItems = (tab) => (tab?.items || []).filter((item) => item.status !== "PENDING");

  const ITEM_STATUS = {
    SENT: "Na cozinha",
    IN_PREPARATION: "Em preparo",
    READY: "Pronto",
    DELIVERED: "Entregue",
    CANCELLED: "Cancelado",
  };

  /* ---------- telas ---------- */

  const renderHeader = ({ title, subtitle = "", back = false }) => `
    <header class="gc-header">
      ${back ? '<button type="button" class="gc-icon-btn" data-gc-action="back" aria-label="Voltar">‹</button>' : ""}
      <div class="gc-header-text">
        <strong>${escapeHtml(title)}</strong>
        ${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""}
      </div>
      ${
        back
          ? '<button type="button" class="gc-icon-btn" data-gc-action="refresh" aria-label="Atualizar">⟳</button>'
          : '<button type="button" class="gc-link-btn" data-gc-action="logout">Sair</button>'
      }
    </header>
    ${state.offline ? '<div class="gc-offline">Sem conexão com a internet. Os dados podem estar desatualizados.</div>' : ""}
  `;

  const renderLogin = () => {
    const { login } = state;
    root.innerHTML = `
      <section class="gc-login">
        <div class="gc-brand">
          <span class="gc-logo" aria-hidden="true">🍣</span>
          <h1>INOVAS Garçom</h1>
          <p>Entre com o usuário e a senha criados no Gestor.</p>
        </div>
        <form class="gc-card gc-form" data-gc-form="login" novalidate>
          <label>Usuário ou e-mail
            <input name="identifier" autocomplete="username" autocapitalize="none" inputmode="email" required value="${escapeHtml(login.identifier)}" />
          </label>
          <label>Senha
            <input name="password" type="password" autocomplete="current-password" required />
          </label>
          ${
            login.restaurants.length
              ? `<fieldset class="gc-restaurants"><legend>Escolha o restaurante</legend>${login.restaurants
                  .map(
                    (restaurant) => `<label class="gc-radio"><input type="radio" name="restaurantKey" value="${escapeHtml(
                      restaurant.restaurantKey
                    )}" ${restaurant.restaurantKey === login.restaurantKey ? "checked" : ""} /> ${escapeHtml(
                      restaurant.restaurantName || restaurant.name || restaurant.restaurantKey
                    )}</label>`
                  )
                  .join("")}</fieldset>`
              : ""
          }
          ${login.error ? `<p class="gc-error" role="alert">${escapeHtml(login.error)}</p>` : ""}
          <button class="gc-btn gc-btn-primary gc-btn-block" type="submit" ${state.busy ? "disabled" : ""}>
            ${state.busy === "login" ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </section>
    `;
  };

  const renderDenied = () => {
    root.innerHTML = `
      ${renderHeader({ title: "INOVAS Garçom" })}
      <section class="gc-empty">
        <h2>Sem acesso</h2>
        <p>${escapeHtml(state.deniedMessage || "Seu usuário não tem acesso às comandas.")}</p>
        <p>Peça ao responsável para liberar no Gestor (Usuários).</p>
      </section>
    `;
  };

  const renderTables = () => {
    const snapshot = getSnapshot();
    const tables = snapshot.tables || [];
    const restaurant = state.waiter?.restaurantName || "Mesas";
    const who = state.waiter?.displayName ? `Garçom: ${state.waiter.displayName}` : "";
    let body;
    if (!state.snapshot) {
      body = '<section class="gc-empty"><p>Carregando mesas…</p></section>';
    } else if (!snapshot.register) {
      body = `<section class="gc-empty">
        <h2>Caixa fechado</h2>
        <p>Peça para abrir o caixa no Gestor do PC. Depois toque em atualizar.</p>
        <button type="button" class="gc-btn gc-btn-primary" data-gc-action="refresh">Atualizar</button>
      </section>`;
    } else if (!tables.length) {
      body = '<section class="gc-empty"><p>Nenhuma mesa cadastrada no caixa.</p></section>';
    } else {
      body = `<section class="gc-tables">${tables
        .map((table) => {
          const tab = table.activeTab;
          const status = tab ? (tab.status === "AWAITING_PAYMENT" ? "closing" : "busy") : "free";
          const label = status === "free" ? "Livre" : status === "closing" ? "Fechando conta" : `${tab.guestCount} pessoa${tab.guestCount === 1 ? "" : "s"}`;
          return `<button type="button" class="gc-table is-${status}" data-gc-table="${escapeHtml(table.id)}">
            <strong>${escapeHtml(table.number ?? "")}</strong>
            <span>${escapeHtml(label)}</span>
            ${tab?.customerName ? `<small>${escapeHtml(tab.customerName)}</small>` : ""}
          </button>`;
        })
        .join("")}</section>
        <p class="gc-legend"><span class="is-free"></span>Livre <span class="is-busy"></span>Ocupada <span class="is-closing"></span>Fechando</p>`;
    }
    root.innerHTML = `${renderHeader({ title: restaurant, subtitle: who })}${body}`;
  };

  const renderMenu = (tab) => {
    const sections = getSections();
    const needle = normalizeSearch(state.search);
    const products = getProducts().filter((item) => {
      if (needle) return normalizeSearch(`${item.name} ${item.sectionTitle} ${item.description || ""}`).includes(needle);
      return !state.sectionId || item.sectionId === state.sectionId;
    });
    const pendingByProduct = new Map();
    pendingItems(tab).forEach((item) => {
      pendingByProduct.set(item.productId, (pendingByProduct.get(item.productId) || 0) + item.quantity);
    });
    return `
      <div class="gc-menu-tools">
        <input class="gc-search" type="search" placeholder="Buscar no cardápio" data-gc-field="search" value="${escapeHtml(state.search)}" />
        ${
          needle
            ? ""
            : `<nav class="gc-chips">
              <button type="button" class="gc-chip ${state.sectionId ? "" : "is-active"}" data-gc-section="">Tudo</button>
              ${sections
                .map(
                  (section) => `<button type="button" class="gc-chip ${state.sectionId === section.id ? "is-active" : ""}" data-gc-section="${escapeHtml(section.id)}">${escapeHtml(section.title)}</button>`
                )
                .join("")}
            </nav>`
        }
      </div>
      <section class="gc-products">
        ${
          products.length
            ? products
                .map((item) => {
                  const count = pendingByProduct.get(item.id) || 0;
                  const image = mediaUrl(item.image);
                  return `<div class="gc-product">
                    <button type="button" class="gc-product-main" data-gc-product="${escapeHtml(item.id)}">
                      ${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async" />` : `<span class="gc-thumb" aria-hidden="true">${escapeHtml(String(item.name || "?").charAt(0))}</span>`}
                      <span class="gc-product-info">
                        <strong>${escapeHtml(item.name)}</strong>
                        <span>${escapeHtml(money(item.price))}</span>
                      </span>
                    </button>
                    <button type="button" class="gc-add" data-gc-quick="${escapeHtml(item.id)}" aria-label="Adicionar 1 ${escapeHtml(item.name)}" ${state.busy ? "disabled" : ""}>
                      ${count ? `<b>${count}</b>` : "+"}
                    </button>
                  </div>`;
                })
                .join("")
            : '<p class="gc-muted">Nenhum item encontrado.</p>'
        }
      </section>
    `;
  };

  const renderOrder = (tab) => {
    const pending = pendingItems(tab);
    const sent = sentItems(tab);
    const editable = tab.status === "OPEN";
    return `
      <section class="gc-order">
        <h2>Para enviar</h2>
        ${
          pending.length
            ? pending
                .map(
                  (item) => `<div class="gc-line">
                    <div class="gc-line-info">
                      <strong>${escapeHtml(item.productName)}</strong>
                      ${item.notes ? `<small>Obs.: ${escapeHtml(item.notes)}</small>` : ""}
                      <span>${escapeHtml(money(item.totalPrice))}</span>
                    </div>
                    ${
                      editable
                        ? `<div class="gc-stepper">
                          <button type="button" data-gc-qty="${escapeHtml(item.id)}" data-delta="-1" aria-label="Diminuir" ${state.busy ? "disabled" : ""}>−</button>
                          <b>${item.quantity}</b>
                          <button type="button" data-gc-qty="${escapeHtml(item.id)}" data-delta="1" aria-label="Aumentar" ${state.busy ? "disabled" : ""}>+</button>
                        </div>`
                        : `<b>${item.quantity}×</b>`
                    }
                  </div>`
                )
                .join("")
            : '<p class="gc-muted">Nenhum item novo. Adicione pelo cardápio.</p>'
        }
        <h2>Já enviados</h2>
        ${
          sent.length
            ? sent
                .map(
                  (item) => `<div class="gc-line is-sent">
                    <div class="gc-line-info">
                      <strong>${item.quantity}× ${escapeHtml(item.productName)}</strong>
                      ${item.notes ? `<small>Obs.: ${escapeHtml(item.notes)}</small>` : ""}
                    </div>
                    <span class="gc-badge is-${escapeHtml(String(item.status).toLowerCase())}">${escapeHtml(ITEM_STATUS[item.status] || item.status)}</span>
                  </div>`
                )
                .join("")
            : '<p class="gc-muted">Nada enviado ainda.</p>'
        }
      </section>
    `;
  };

  const renderTab = () => {
    const tab = getTab();
    if (!tab) {
      state.screen = "tables";
      renderTables();
      return;
    }
    const table = getTable(tab.tableId);
    const pending = pendingItems(tab);
    const pendingCount = pending.reduce((sum, item) => sum + item.quantity, 0);
    const subtitle = [
      `${tab.guestCount} pessoa${tab.guestCount === 1 ? "" : "s"}`,
      tab.customerName,
    ]
      .filter(Boolean)
      .join(" · ");
    const closing = tab.status !== "OPEN";
    root.innerHTML = `
      ${renderHeader({ title: tableName(table), subtitle, back: true })}
      ${closing ? '<div class="gc-warn">Conta em fechamento no caixa. Não dá para lançar itens.</div>' : ""}
      <nav class="gc-tabs" role="tablist">
        <button type="button" role="tab" aria-selected="${state.view === "menu"}" class="${state.view === "menu" ? "is-active" : ""}" data-gc-view="menu">Cardápio</button>
        <button type="button" role="tab" aria-selected="${state.view === "order"}" class="${state.view === "order" ? "is-active" : ""}" data-gc-view="order">Pedido${pendingCount ? ` <b>${pendingCount}</b>` : ""}</button>
      </nav>
      <div class="gc-scroll">
        ${state.view === "menu" && !closing ? renderMenu(tab) : renderOrder(tab)}
      </div>
      ${
        !closing
          ? `<footer class="gc-footer">
            <button type="button" class="gc-btn gc-btn-primary gc-btn-block" data-gc-action="send" ${pendingCount && !state.busy ? "" : "disabled"}>
              ${state.busy === "send-order" ? "Enviando…" : pendingCount ? `Enviar para a cozinha (${pendingCount})` : "Nada para enviar"}
            </button>
          </footer>`
          : ""
      }
    `;
  };

  const renderSheet = () => {
    document.querySelector("[data-gc-sheet]")?.remove();
    const sheet = state.sheet;
    if (!sheet) return;
    let content = "";
    if (sheet.type === "open") {
      content = `
        <form data-gc-form="open-tab" novalidate>
          <h2>Abrir ${escapeHtml(tableName(sheet.table))}</h2>
          <label>Pessoas na mesa</label>
          <div class="gc-stepper gc-stepper-lg">
            <button type="button" data-gc-guests="-1" aria-label="Menos pessoas">−</button>
            <b data-gc-guests-value>${sheet.guests}</b>
            <button type="button" data-gc-guests="1" aria-label="Mais pessoas">+</button>
          </div>
          <label>Nome do cliente (opcional)
            <input name="customerName" maxlength="80" autocomplete="off" value="${escapeHtml(sheet.customerName || "")}" />
          </label>
          <div class="gc-sheet-actions">
            <button type="button" class="gc-btn" data-gc-action="close-sheet">Cancelar</button>
            <button type="submit" class="gc-btn gc-btn-primary" ${state.busy ? "disabled" : ""}>${state.busy === "open-tab" ? "Abrindo…" : "Abrir mesa"}</button>
          </div>
        </form>`;
    } else if (sheet.type === "product") {
      const product = sheet.product;
      content = `
        <form data-gc-form="add-item" novalidate>
          <h2>${escapeHtml(product.name)}</h2>
          ${product.description ? `<p class="gc-muted">${escapeHtml(product.description)}</p>` : ""}
          <p class="gc-price">${escapeHtml(money(product.price))}</p>
          <label>Quantidade</label>
          <div class="gc-stepper gc-stepper-lg">
            <button type="button" data-gc-sheet-qty="-1" aria-label="Diminuir">−</button>
            <b data-gc-sheet-qty-value>${sheet.qty}</b>
            <button type="button" data-gc-sheet-qty="1" aria-label="Aumentar">+</button>
          </div>
          <label>Observação (opcional)
            <textarea name="notes" rows="2" maxlength="200" placeholder="Ex.: sem cebolinha">${escapeHtml(sheet.notes || "")}</textarea>
          </label>
          <div class="gc-sheet-actions">
            <button type="button" class="gc-btn" data-gc-action="close-sheet">Cancelar</button>
            <button type="submit" class="gc-btn gc-btn-primary" ${state.busy ? "disabled" : ""}>${state.busy === "add-item" ? "Adicionando…" : "Adicionar"}</button>
          </div>
        </form>`;
    } else if (sheet.type === "confirm-send") {
      const tab = getTab();
      const items = pendingItems(tab);
      content = `
        <div>
          <h2>Enviar para a cozinha?</h2>
          <ul class="gc-confirm-list">${items
            .map((item) => `<li><b>${item.quantity}×</b> ${escapeHtml(item.productName)}${item.notes ? ` <small>(${escapeHtml(item.notes)})</small>` : ""}</li>`)
            .join("")}</ul>
          <div class="gc-sheet-actions">
            <button type="button" class="gc-btn" data-gc-action="close-sheet">Voltar</button>
            <button type="button" class="gc-btn gc-btn-primary" data-gc-action="confirm-send" ${state.busy ? "disabled" : ""}>${state.busy === "send-order" ? "Enviando…" : "Enviar"}</button>
          </div>
        </div>`;
    }
    const wrapper = document.createElement("div");
    wrapper.className = "gc-sheet-backdrop";
    wrapper.setAttribute("data-gc-sheet", "");
    wrapper.innerHTML = `<div class="gc-sheet" role="dialog" aria-modal="true">${content}</div>`;
    document.body.appendChild(wrapper);
  };

  const render = () => {
    const active = document.activeElement;
    const keepSearchFocus = active?.matches?.('[data-gc-field="search"]');
    const caret = keepSearchFocus ? active.selectionStart : null;
    if (state.screen === "boot") root.innerHTML = '<div class="gc-boot">Carregando…</div>';
    else if (state.screen === "login") renderLogin();
    else if (state.screen === "denied") renderDenied();
    else if (state.screen === "tab") renderTab();
    else renderTables();
    if (state.screen === "login" || state.screen === "denied") state.sheet = null;
    renderSheet();
    if (keepSearchFocus) {
      const input = root.querySelector('[data-gc-field="search"]');
      if (input) {
        input.focus();
        if (caret !== null) input.setSelectionRange(caret, caret);
      }
    }
  };

  /* ---------- ações ---------- */

  const openTable = (tableId) => {
    const table = getTable(tableId);
    if (!table) return;
    if (table.activeTab) {
      state.tabId = table.activeTab.id;
      state.screen = "tab";
      state.view = table.activeTab.status === "OPEN" ? "menu" : "order";
      state.search = "";
      render();
      window.scrollTo(0, 0);
      return;
    }
    state.sheet = { type: "open", table, guests: 2, customerName: "" };
    render();
  };

  const addProduct = async (productId, qty, notes = "") => {
    const tab = getTab();
    const product = getProducts().find((item) => item.id === productId);
    if (!tab || !product || tab.status !== "OPEN") return false;
    const cleanNotes = String(notes || "").trim();
    // Mesmo produto, sem observação diferente: soma na linha que ainda não foi enviada.
    const existing = pendingItems(tab).find(
      (item) => item.productId === productId && String(item.notes || "").trim() === cleanNotes
    );
    const payload = existing
      ? await runAction(
          "update-item",
          { itemId: existing.id, quantity: Math.min(99, existing.quantity + qty), notes: existing.notes || "" },
          "add-item"
        )
      : await runAction(
          "add-item",
          { tabId: tab.id, productId, quantity: qty, ...(cleanNotes ? { notes: cleanNotes } : {}) },
          "add-item"
        );
    if (payload) toast(`${qty}× ${product.name} adicionado`);
    return Boolean(payload);
  };

  const changeQuantity = async (itemId, delta) => {
    const tab = getTab();
    const item = pendingItems(tab).find((entry) => entry.id === itemId);
    if (!item) return;
    const next = item.quantity + delta;
    if (next < 1) await runAction("remove-item", { itemId }, "remove-item");
    else await runAction("update-item", { itemId, quantity: Math.min(99, next), notes: item.notes || "" }, "update-item");
  };

  const sendOrder = async () => {
    const tab = getTab();
    if (!tab || !pendingItems(tab).length) return;
    const payload = await runAction("send-order", { tabId: tab.id }, "send-order");
    if (payload) {
      state.sheet = null;
      toast("Pedido enviado para a cozinha ✓");
      state.tabId = "";
      state.screen = "tables";
      render();
    }
  };

  const submitLogin = async (form) => {
    const data = new FormData(form);
    const identifier = String(data.get("identifier") || "").trim();
    const password = String(data.get("password") || "");
    const restaurantKey = String(data.get("restaurantKey") || state.login.restaurantKey || "");
    state.login.identifier = identifier;
    if (!identifier || !password) {
      state.login.error = "Preencha usuário e senha.";
      render();
      return;
    }
    state.busy = "login";
    state.login.error = "";
    render();
    try {
      await api("/api/admin/login", {
        method: "POST",
        body: { identifier, password, next: "/garcom", ...(restaurantKey ? { restaurantKey } : {}) },
      });
      state.login = { identifier, error: "", restaurants: [], restaurantKey: "" };
      state.busy = "";
      state.screen = "tables";
      state.snapshot = null;
      render();
      await loadSnapshot();
    } catch (error) {
      state.busy = "";
      const restaurants = error.payload?.details?.restaurants;
      if (error.errorCode === "restaurant_selection_required" && Array.isArray(restaurants) && restaurants.length) {
        state.login.restaurants = restaurants;
        state.login.restaurantKey = restaurants[0].restaurantKey;
        state.login.error = "Escolha o restaurante e toque em Entrar.";
      } else {
        state.login.error = error.status ? error.message : "Sem conexão. Confira o Wi-Fi.";
      }
      render();
    }
  };

  const logout = async () => {
    try {
      await api("/api/admin/logout", { method: "POST", body: {} });
    } catch {
      // Sai da tela mesmo sem conexão.
    }
    state.screen = "login";
    state.snapshot = null;
    state.catalog = null;
    state.waiter = null;
    state.tabId = "";
    state.sheet = null;
    render();
  };

  /* ---------- eventos ---------- */

  document.addEventListener("click", async (event) => {
    const target = event.target.closest("button");
    if (!target || target.disabled) return;

    const action = target.dataset.gcAction;
    if (action === "back") {
      state.tabId = "";
      state.screen = "tables";
      render();
      loadSnapshot({ quiet: true });
    } else if (action === "refresh") {
      await loadSnapshot();
    } else if (action === "logout") {
      await logout();
    } else if (action === "close-sheet") {
      state.sheet = null;
      render();
    } else if (action === "send") {
      state.sheet = { type: "confirm-send" };
      render();
    } else if (action === "confirm-send") {
      await sendOrder();
    } else if (target.dataset.gcTable) {
      openTable(target.dataset.gcTable);
    } else if (target.dataset.gcView) {
      state.view = target.dataset.gcView;
      render();
    } else if (typeof target.dataset.gcSection === "string") {
      state.sectionId = target.dataset.gcSection;
      render();
    } else if (target.dataset.gcQuick) {
      await addProduct(target.dataset.gcQuick, 1);
    } else if (target.dataset.gcProduct) {
      const product = getProducts().find((item) => item.id === target.dataset.gcProduct);
      if (product) {
        state.sheet = { type: "product", product, qty: 1, notes: "" };
        render();
      }
    } else if (target.dataset.gcQty) {
      await changeQuantity(target.dataset.gcQty, Number(target.dataset.delta));
    } else if (target.dataset.gcGuests && state.sheet?.type === "open") {
      state.sheet.guests = Math.min(50, Math.max(1, state.sheet.guests + Number(target.dataset.gcGuests)));
      const name = document.querySelector('[data-gc-sheet] [name="customerName"]');
      if (name) state.sheet.customerName = name.value;
      render();
    } else if (target.dataset.gcSheetQty && state.sheet?.type === "product") {
      state.sheet.qty = Math.min(99, Math.max(1, state.sheet.qty + Number(target.dataset.gcSheetQty)));
      const notes = document.querySelector('[data-gc-sheet] [name="notes"]');
      if (notes) state.sheet.notes = notes.value;
      render();
    }
  });

  document.addEventListener("click", (event) => {
    if (event.target.matches?.(".gc-sheet-backdrop") && !state.busy) {
      state.sheet = null;
      render();
    }
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-gc-form]");
    if (!form) return;
    event.preventDefault();
    const type = form.dataset.gcForm;
    if (type === "login") {
      await submitLogin(form);
    } else if (type === "open-tab" && state.sheet?.type === "open") {
      const table = state.sheet.table;
      const customerName = String(new FormData(form).get("customerName") || "").trim();
      const payload = await runAction(
        "open-tab",
        { tableId: table.id, guestCount: state.sheet.guests, customerName },
        "open-tab"
      );
      if (payload) {
        const tab =
          getSnapshot().activeTabs.find((entry) => entry.id === payload.tabId) ||
          getSnapshot().activeTabs.find((entry) => entry.tableId === table.id);
        state.sheet = null;
        if (tab) {
          state.tabId = tab.id;
          state.screen = "tab";
          state.view = "menu";
          state.search = "";
        }
        render();
      }
    } else if (type === "add-item" && state.sheet?.type === "product") {
      const notes = String(new FormData(form).get("notes") || "");
      const { product, qty } = state.sheet;
      state.sheet.notes = notes;
      const ok = await addProduct(product.id, qty, notes);
      if (ok) {
        state.sheet = null;
        render();
      }
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches('[data-gc-field="search"]')) {
      state.search = event.target.value;
      render();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.sheet && !state.busy) {
      state.sheet = null;
      render();
    }
  });

  // Atualiza mesas e status da cozinha enquanto a tela está aberta.
  window.setInterval(() => {
    if (document.hidden || state.busy || state.sheet) return;
    if (state.screen === "tables" || state.screen === "tab") loadSnapshot({ quiet: true });
  }, REFRESH_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && (state.screen === "tables" || state.screen === "tab")) loadSnapshot({ quiet: true });
  });
  window.addEventListener("online", () => loadSnapshot({ quiet: true }));

  // Botão "voltar" do Android: sai da folha ou da mesa antes de sair do app.
  window.addEventListener("popstate", () => {
    if (state.sheet) {
      state.sheet = null;
      render();
    } else if (state.screen === "tab") {
      state.tabId = "";
      state.screen = "tables";
      render();
    }
    window.history.pushState({ gc: true }, "");
  });
  window.history.pushState({ gc: true }, "");

  // Botão "voltar" do app Android: devolve true se tratou (fechou folha ou
  // voltou para as mesas); false = pode minimizar o app.
  const handleBack = () => {
    if (state.sheet && !state.busy) {
      state.sheet = null;
      render();
      return true;
    }
    if (state.screen === "tab") {
      state.tabId = "";
      state.screen = "tables";
      render();
      loadSnapshot({ quiet: true });
      return true;
    }
    return false;
  };

  window.InovasGarcom = { state, back: handleBack };

  loadSnapshot({ quiet: true }).then((ok) => {
    if (!ok && state.screen === "boot") {
      state.screen = "login";
      render();
    }
  });
})();
