/* Novo Caixa INOVAS Food — Abertura, Salão, Nova comanda, PDV, Pagamento e
   Fechamento (docs/novo-caixa/ESPEC-CAIXA.md). Usa a API do Caixa v2
   (/api/admin/cash-register/*) e os componentes de admin/cash-ui.css. */
(() => {
  "use strict";

  const ui = window.InovasCashUi;

  const PAYMENT_METHODS = Object.freeze([
    { key: "CASH", label: "Dinheiro" },
    { key: "PIX", label: "Pix" },
    { key: "CREDIT_CARD", label: "Crédito" },
    { key: "DEBIT_CARD", label: "Débito" },
    { key: "MEAL_VOUCHER", label: "Vale-refeição" },
    { key: "OTHER", label: "Outro" },
  ]);
  const PAYMENT_LABELS = Object.freeze(
    Object.fromEntries(PAYMENT_METHODS.map((method) => [method.key, method.label]))
  );
  const TABLE_LOOK = Object.freeze({
    FREE: { label: "Livre", className: "is-free" },
    OCCUPIED: { label: "Ocupada", className: "is-busy" },
    AWAITING_PAYMENT: { label: "Pediu conta", className: "is-bill" },
    UNAVAILABLE: { label: "Fora de uso", className: "is-reserved" },
  });
  const TABLE_FILTERS = Object.freeze([
    { key: "all", label: "Todas" },
    { key: "FREE", label: "Livres" },
    { key: "OCCUPIED", label: "Ocupadas" },
    { key: "AWAITING_PAYMENT", label: "Pediu conta" },
  ]);
  const QUICK_NOTES = Object.freeze([
    "Sem cebolinha",
    "Pouco arroz",
    "Sem gelo",
    "Sem molho",
    "Molho à parte",
    "Prioridade",
  ]);
  const VIEW_PATHS = Object.freeze({
    floor: "/admin/caixa/salao",
    opening: "/admin/caixa/abertura",
    closing: "/admin/caixa/fechamento",
  });
  const MAX_TABLES = 200;
  const MAX_GUESTS = 100;

  const state = {
    root: null,
    context: {},
    snapshot: null,
    catalog: null,
    view: "floor",
    screen: "salao",
    tableFilter: "all",
    tableSearch: "",
    selectedTabId: "",
    modal: "",
    openTab: { tableId: "", guests: 0, customerName: "", waiterName: "" },
    people: { guests: 1, customerName: "" },
    movement: { type: "WITHDRAWAL", amount: "", reason: "" },
    opening: { tableCount: null, openingAmount: "", serviceChargeRate: "10" },
    pdv: { query: "", categoryId: "all", multiplier: 1, noteItemId: "" },
    // Pedido sem mesa: retirada no balcão ou entrega (telefone/balcão).
    counter: null,
    bill: { discount: "", serviceEnabled: true },
    payment: { mode: "equal", draft: [], method: "CASH", entry: "", shareIndex: 0, splitCount: null },
    closing: { counted: "", notes: "" },
    // Impressora deste computador (salva no navegador) e rascunho do modal.
    printerDraft: { paper: "58", label: "", detected: "", message: "", detecting: false },
    pendingPrint: null,
    receiptTab: null,
    optimistic: [],
    qtyDelta: {},
    loading: false,
    loadingPromise: null,
    busy: "",
    message: "",
    messageTone: "success",
  };

  /* ---------- utilidades ---------- */

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const money = (value) => ui.formatMoney(value);
  const cents = (value) => {
    const parsed = ui.toCents(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const reais = (value) => ui.fromCents(value);
  const two = (number) => ui.formatTableNumber(number);
  const timeOf = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "--"
      : new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
  };
  const dayLabel = (value = new Date()) => {
    const text = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(value));
    return text.charAt(0).toUpperCase() + text.slice(1);
  };
  const elapsed = (value) => {
    const start = new Date(value).getTime();
    if (!Number.isFinite(start)) return "";
    const minutes = Math.max(0, Math.round((Date.now() - start) / 60000));
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
  };
  /* Caminho da foto do cardápio ("./site-images/x.png" vira "/site-images/x.png"). */
  const mediaUrl = (value) => {
    const source = String(value || "").trim();
    if (!source) return "";
    if (/^(?:https?:|data:image\/|blob:|\/)/i.test(source)) return source;
    return `/${source.replace(/^(?:\.\/)+/, "")}`;
  };
  const normalizeSearch = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  const peopleLabel = (count) => `${count} ${Number(count) === 1 ? "pessoa" : "pessoas"}`;
  const newIdempotencyKey = () =>
    window.crypto?.randomUUID?.() || `cash-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const hasPermission = (permission) => {
    const permissions = state.context.permissions;
    if (!permissions || !Object.keys(permissions).length) return true;
    return permissions[permission] === true;
  };

  const getSnapshot = () =>
    state.snapshot || {
      register: null,
      registerSummary: null,
      lastClosedRegister: null,
      tables: [],
      activeTabs: [],
      recentTabs: [],
      auditEvents: [],
      movements: [],
    };
  const getTab = () =>
    getSnapshot().activeTabs.find((tab) => tab.id === state.selectedTabId) || null;
  const getTableOf = (tab) =>
    getSnapshot().tables.find((table) => table.id === tab?.tableId) || null;
  const tableNumber = (table) => (table?.number ? two(table.number) : table?.label || "--");

  const getCatalogItems = () => {
    const sections = Array.isArray(state.catalog?.sections) ? state.catalog.sections : [];
    let code = 0;
    return sections.flatMap((section) =>
      (Array.isArray(section.items) ? section.items : [])
        .filter((item) => item.isOrderable === true && item.isPaused !== true && item.isAvailable !== false)
        .map((item) => {
          code += 1;
          return {
            ...item,
            code,
            sectionId: item.sectionId || section.id,
            sectionTitle: item.sectionTitle || section.title,
          };
        })
    );
  };
  const getCatalogSections = () =>
    (Array.isArray(state.catalog?.sections) ? state.catalog.sections : []).filter((section) =>
      (section.items || []).some((item) => item.isOrderable === true && item.isPaused !== true)
    );

  /* ---------- servidor ---------- */

  const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      ...options,
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const error = new Error(payload?.error || "Não foi possível concluir a operação.");
      error.status = response.status;
      error.errorCode = payload?.errorCode || "request_error";
      throw error;
    }
    return payload || {};
  };

  const setMessage = (message, tone = "success") => {
    state.message = message || "";
    state.messageTone = tone;
    window.clearTimeout(setMessage.timer);
    if (message && tone === "success") {
      setMessage.timer = window.setTimeout(() => {
        state.message = "";
        render();
      }, 3500);
    }
  };

  const applySnapshot = (payload) => {
    state.snapshot = payload?.snapshot || payload;
    if (payload?.catalog) state.catalog = payload.catalog;
    const tabs = getSnapshot().activeTabs || [];
    if (state.selectedTabId && !tabs.some((tab) => tab.id === state.selectedTabId)) {
      state.selectedTabId = "";
      if (state.screen !== "salao") state.screen = "salao";
    }
  };

  const postAction = async (action, body, busyLabel, { quiet = false } = {}) => {
    state.busy = busyLabel || action;
    if (!quiet) setMessage("");
    render();
    try {
      const payload = await fetchJson(`/api/admin/cash-register/${action}`, {
        method: "POST",
        body: JSON.stringify(body || {}),
      });
      applySnapshot(payload);
      if (!quiet) setMessage(payload.message || "Feito.", "success");
      return payload;
    } catch (error) {
      if (error.status === 401) {
        window.location.href = "/admin/login.html";
        return null;
      }
      setMessage(error.message, "error");
      return null;
    } finally {
      state.busy = "";
      render();
    }
  };

  const load = async ({ force = false } = {}) => {
    if (state.loadingPromise && !force) return state.loadingPromise;
    state.loading = true;
    render();
    const task = (async () => {
      try {
        const payload = await fetchJson("/api/admin/cash-register/snapshot");
        applySnapshot(payload);
        state.context = {
          ...state.context,
          adminName: payload.admin?.displayName || payload.admin?.name || state.context.adminName || "",
          restaurantName:
            payload.admin?.restaurantName || payload.admin?.restaurant || state.context.restaurantName || "",
          permissions: payload.admin?.permissions || state.context.permissions,
          printProfile: payload.printProfile || state.context.printProfile || null,
        };
      } catch (error) {
        if (error.status === 401) {
          window.location.href = "/admin/login.html";
          return;
        }
        setMessage(error.message, "error");
      } finally {
        state.loading = false;
        state.loadingPromise = null;
        render();
      }
    })();
    state.loadingPromise = task;
    return task;
  };

  const setView = (view, { updateUrl = true } = {}) => {
    state.view = ["floor", "opening", "closing"].includes(view) ? view : "floor";
    if (state.view !== "floor") state.screen = "salao";
    state.modal = "";
    if (updateUrl && window.history?.replaceState) {
      window.history.replaceState({}, "", VIEW_PATHS[state.view]);
    }
    render();
  };

  /* ---------- pedaços comuns ---------- */

  const feedback = () =>
    state.message
      ? `<div class="cx-feedback is-${escapeHtml(state.messageTone)}" role="${
          state.messageTone === "error" ? "alert" : "status"
        }">${escapeHtml(state.message)}</div>`
      : "";

  const kpi = (label, value, helper = "") => `
    <article class="cx-kpi"><span>${escapeHtml(label)}</span><strong class="cx-big">${escapeHtml(value)}</strong>${
      helper ? `<small>${escapeHtml(helper)}</small>` : ""
    }</article>`;

  const stepper = (field, value, { min, max, label }) => `
    <div class="cx-stepper" data-cx-stepper="${field}">
      <button type="button" data-cx-step-field="${field}" data-cx-delta="-1" aria-label="Diminuir ${escapeHtml(label)}" ${
        value <= min ? "disabled" : ""
      }>−</button>
      <output aria-live="polite" aria-label="${escapeHtml(label)}">${escapeHtml(value)}</output>
      <button type="button" data-cx-step-field="${field}" data-cx-delta="1" aria-label="Aumentar ${escapeHtml(label)}" ${
        value >= max ? "disabled" : ""
      }>+</button>
    </div>`;

  const skeleton = () => `
    <div class="cx-root cash-v3">
      <div class="cx-topbar"><div class="cx-topbar-title"><h1>Caixa</h1><p>Carregando caixa, mesas e cardápio…</p></div></div>
      <div class="cx-grid-tables">${Array.from({ length: 12 }, () => '<div class="cx-skeleton"></div>').join("")}</div>
    </div>`;

  /* ---------- Tela 1 · Abertura ---------- */

  const renderOpening = () => {
    const snapshot = getSnapshot();
    const register = snapshot.register;
    if (register) {
      return `
        <section class="cx-center-card">
          <span class="cx-eyebrow">Turno em andamento</span>
          <h1>O caixa já está aberto</h1>
          <p class="cx-muted">Aberto por ${escapeHtml(register.openingUserDisplayName)} às ${escapeHtml(
        timeOf(register.openedAt)
      )} · fundo de troco ${escapeHtml(money(register.openingAmount))} · ${escapeHtml(
        snapshot.tables.length
      )} mesas.</p>
          <button class="cx-btn cx-btn-primary cx-btn-lg" type="button" data-cx-view="floor">Ir para o Salão</button>
        </section>`;
    }
    const lastCount = Math.min(MAX_TABLES, Math.max(1, Number(snapshot.lastClosedRegister?.tableCount || 0)));
    if (state.opening.tableCount === null) state.opening.tableCount = snapshot.lastClosedRegister?.tableCount ? lastCount : 12;
    const count = state.opening.tableCount;
    const presets = [10, 15, 20, 25, 30];
    return `
      <div class="cx-split cx-opening">
        <form class="cx-split-main cx-card" data-cx-form="open-register" novalidate>
          <span class="cx-eyebrow">${escapeHtml(dayLabel())}</span>
          <div class="cx-row-between">
            <h1>Abrir caixa</h1>
            ${
              snapshot.lastClosedRegister?.tableCount
                ? `<button class="cx-link" type="button" data-cx-action="use-last-count">Usar mesma quantidade do último turno (${escapeHtml(
                    lastCount
                  )})</button>`
                : ""
            }
          </div>
          <div class="cx-fields">
            <label class="cx-field"><span>Operador do caixa</span><input class="cx-input" value="${escapeHtml(
              state.context.adminName || "Operador autenticado"
            )}" disabled /></label>
            <label class="cx-field"><span>Fundo de troco (R$)</span><input class="cx-input cx-num" name="openingAmount" data-cx-field="opening.openingAmount" inputmode="decimal" placeholder="0,00" value="${escapeHtml(
              state.opening.openingAmount
            )}" /></label>
          </div>
          <div class="cx-field">
            <span>Quantidade de mesas hoje</span>
            <div class="cx-row-wrap">
              ${stepper("opening.tableCount", count, { min: 1, max: MAX_TABLES, label: "mesas" })}
              <div class="cx-chips">${presets
                .map(
                  (preset) =>
                    `<button type="button" class="cx-chip" data-cx-set="opening.tableCount" data-cx-value="${preset}" aria-pressed="${
                      preset === count
                    }">${preset}</button>`
                )
                .join("")}</div>
            </div>
          </div>
          <label class="cx-field cx-field-inline"><span>Taxa de serviço padrão (%)</span><input class="cx-input cx-num" data-cx-field="opening.serviceChargeRate" inputmode="decimal" value="${escapeHtml(
            state.opening.serviceChargeRate
          )}" /></label>
          <p class="cx-note">As mesas não têm lugares fixos: todas começam com 0 pessoas. Quantas pessoas sentaram é informado ao abrir a comanda.</p>
          <button class="cx-btn cx-btn-primary cx-btn-lg cx-btn-block" type="submit" ${state.busy ? "disabled" : ""}>${
      state.busy === "open-register" ? "Abrindo…" : `Abrir caixa com ${count} mesas`
    }</button>
        </form>
        <aside class="cx-split-side cx-card">
          <div class="cx-row-between"><h2>Prévia do salão</h2><span class="cx-muted">Todas livres · 0 pessoas</span></div>
          <div class="cx-grid-mini">${Array.from({ length: count }, (_, index) => `
            <div class="cx-mini-table"><strong>${two(index + 1)}</strong><span>Livre</span><small>0 pessoas</small></div>`).join("")}</div>
        </aside>
      </div>`;
  };

  /* ---------- Tela 2 · Salão ---------- */

  const tableCard = (table) => {
    const look = TABLE_LOOK[table.status] || TABLE_LOOK.UNAVAILABLE;
    const tab = table.activeTab;
    const line1 = tab ? `${peopleLabel(tab.guestCount)} · ${elapsed(tab.openedAt)}` : "0 pessoas";
    const line2 = tab
      ? money(tab.totalAmount)
      : table.status === "FREE"
        ? "Abrir comanda →"
        : "";
    return `
      <button type="button" class="cx-status-card ${look.className}" data-cx-table="${escapeHtml(table.id)}" aria-label="Mesa ${escapeHtml(
        tableNumber(table)
      )}, ${escapeHtml(look.label)}, ${escapeHtml(line1)}">
        <span class="cx-card-number">${escapeHtml(tableNumber(table))}</span>
        <span class="cx-card-status">${escapeHtml(look.label)}</span>
        <span class="cx-card-meta">${escapeHtml(line1)}</span>
        ${tab?.customerName ? `<span class="cx-card-meta">${escapeHtml(tab.customerName)}</span>` : ""}
        <span class="cx-card-meta cx-num"><strong>${escapeHtml(line2)}</strong></span>
      </button>`;
  };

  const renderSalao = () => {
    const snapshot = getSnapshot();
    const register = snapshot.register;
    const summary = snapshot.registerSummary || {};
    const tables = snapshot.tables;
    const counts = tables.reduce(
      (acc, table) => {
        acc.all += 1;
        acc[table.status] = (acc[table.status] || 0) + 1;
        return acc;
      },
      { all: 0 }
    );
    const occupied = tables.filter((table) => table.activeTab);
    const people = occupied.reduce((sum, table) => sum + Number(table.activeTab.guestCount || 0), 0);
    const openValue = occupied.reduce((sum, table) => sum + cents(table.activeTab.totalAmount), 0);
    const visible = tables.filter((table) => state.tableFilter === "all" || table.status === state.tableFilter);
    return `
      <header class="cx-topbar">
        <div class="cx-topbar-title">
          <h1>Caixa · ${escapeHtml(state.context.restaurantName || "Salão")}</h1>
          <p>Caixa aberto por ${escapeHtml(register.openingUserDisplayName)} às ${escapeHtml(timeOf(register.openedAt))} · Fundo ${escapeHtml(
      money(register.openingAmount)
    )}</p>
        </div>
        <div class="cx-topbar-actions">
          <label class="cx-search-table"><span class="cx-sr-only">Número da mesa</span><input class="cx-input cx-num" data-cx-field="tableSearch" data-cx-enter="open-table-number" inputmode="numeric" placeholder="Nº da mesa + Enter" value="${escapeHtml(
            state.tableSearch
          )}" /></label>
          ${
            hasPermission("cash_register_open_tab")
              ? '<button class="cx-btn" type="button" data-cx-action="new-tab">+ Nova comanda <span class="cx-kbd">F1</span></button>'
              : ""
          }
          <button class="cx-btn" type="button" data-cx-action="go-pdv">Lançar pedido <span class="cx-kbd">F3</span></button>
          ${
            hasPermission("cash_register_close")
              ? '<button class="cx-btn" type="button" data-cx-action="open-movement">Sangria / Suprimento</button>'
              : ""
          }
          <button class="cx-btn" type="button" data-cx-action="open-printer" title="Configurar a impressora deste computador">${escapeHtml(
            loadPrinter() ? `Impressora · ${PAPER_SIZES[loadPrinter().paper].label}` : "Configurar impressora"
          )}</button>
          ${
            hasPermission("cash_register_close")
              ? '<button class="cx-btn cx-btn-dark" type="button" data-cx-view="closing">Fechar caixa</button>'
              : ""
          }
        </div>
      </header>
      ${feedback()}
      <section class="cx-kpis" aria-label="Resumo do salão">
        ${kpi("Mesas ocupadas", `${occupied.length} de ${tables.length}`)}
        ${kpi("Pessoas no salão", String(people))}
        ${kpi("Em aberto nas mesas", money(reais(openValue)))}
        ${kpi("Recebido no turno", money(summary.totalSold || 0))}
      </section>
      <div class="cx-row-between cx-filters-row">
        <div class="cx-chips" role="group" aria-label="Filtrar mesas">${TABLE_FILTERS.map(
          (filter) =>
            `<button type="button" class="cx-chip" data-cx-filter="${filter.key}" aria-pressed="${
              state.tableFilter === filter.key
            }">${escapeHtml(filter.label)} · ${escapeHtml(counts[filter.key] || 0)}</button>`
        ).join("")}</div>
        <div class="cx-row-wrap">
          <span class="cx-muted cx-hide-narrow">Mesa livre abre comanda · ocupada lança itens</span>
          ${
            hasPermission("cash_register_open") && tables.length < MAX_TABLES
              ? '<button class="cx-btn cx-btn-ghost" type="button" data-cx-action="add-table">+ Mesa</button>'
              : ""
          }
        </div>
      </div>
      <div class="cx-grid-tables" data-cx-tables>${
        visible.length ? visible.map(tableCard).join("") : '<p class="cx-empty">Nenhuma mesa neste filtro.</p>'
      }</div>
      <footer class="cx-shortcuts" aria-label="Atalhos">
        <span><span class="cx-kbd">Nº + Enter</span> abre a mesa</span>
        <span><span class="cx-kbd">F1</span> nova comanda</span>
        <span><span class="cx-kbd">F3</span> lançar pedido</span>
        <span><span class="cx-kbd">Esc</span> voltar</span>
      </footer>`;
  };

  /* ---------- Tela 3 · Nova comanda (modal) ---------- */

  const renderOpenTabModal = () => {
    const free = getSnapshot().tables.filter((table) => table.status === "FREE");
    const draft = state.openTab;
    if (!free.some((table) => table.id === draft.tableId)) draft.tableId = free[0]?.id || "";
    const selected = free.find((table) => table.id === draft.tableId);
    const ready = Boolean(selected) && draft.guests >= 1;
    return `
      <div class="cx-overlay" data-cx-overlay>
        <form class="cx-dialog" role="dialog" aria-modal="true" aria-labelledby="cx-open-title" data-cx-form="open-tab" novalidate>
          <div class="cx-modal-head"><h2 id="cx-open-title">Nova comanda</h2><button class="cx-btn cx-btn-ghost" type="button" data-cx-action="close-modal">Esc</button></div>
          <div class="cx-modal-body">
            <section>
              <div class="cx-row-between"><h3>1. Escolha a mesa</h3><span class="cx-muted">Só aparecem as livres</span></div>
              ${
                free.length
                  ? `<div class="cx-grid-pick">${free
                      .map(
                        (table) =>
                          `<button type="button" class="cx-pick" data-cx-set="openTab.tableId" data-cx-value="${escapeHtml(
                            table.id
                          )}" aria-pressed="${table.id === draft.tableId}"><strong>${escapeHtml(
                            tableNumber(table)
                          )}</strong><small>0 pessoas</small></button>`
                      )
                      .join("")}</div>`
                  : '<p class="cx-hint is-error">Não há mesas livres. Use “+ Mesa” no Salão.</p>'
              }
            </section>
            <section>
              <h3>2. Quantas pessoas sentaram? <span class="cx-muted">(obrigatório)</span></h3>
              <div class="cx-row-wrap">
                ${stepper("openTab.guests", draft.guests, { min: 0, max: MAX_GUESTS, label: "pessoas" })}
                <div class="cx-chips">${[1, 2, 3, 4, 5, 6, 7, 8]
                  .map(
                    (value) =>
                      `<button type="button" class="cx-chip" data-cx-set="openTab.guests" data-cx-value="${value}" aria-pressed="${
                        value === draft.guests
                      }">${value}</button>`
                  )
                  .join("")}</div>
              </div>
              ${
                draft.guests < 1
                  ? '<p class="cx-warn" role="note">A mesa está com <strong>0 pessoas</strong>. Informe quantas sentaram para abrir a comanda.</p>'
                  : ""
              }
            </section>
            <div class="cx-fields">
              <label class="cx-field"><span>3. Nome ou apelido (opcional)</span><input class="cx-input" data-cx-field="openTab.customerName" maxlength="180" value="${escapeHtml(
                draft.customerName
              )}" placeholder="Ex.: Ana" /></label>
              <label class="cx-field"><span>Garçom</span><input class="cx-input" data-cx-field="openTab.waiterName" maxlength="120" value="${escapeHtml(
                draft.waiterName
              )}" /></label>
            </div>
          </div>
          <div class="cx-modal-actions">
            <button class="cx-btn" type="button" data-cx-action="close-modal">Cancelar <span class="cx-kbd">Esc</span></button>
            <button class="cx-btn cx-btn-primary" type="submit" data-cx-confirm ${ready && !state.busy ? "" : "disabled"}>${
      ready
        ? `Abrir mesa ${escapeHtml(tableNumber(selected))} · ${escapeHtml(peopleLabel(draft.guests))} <span class="cx-kbd">Enter</span>`
        : selected
          ? `Informe as pessoas para abrir a mesa ${escapeHtml(tableNumber(selected))}`
          : "Sem mesa livre"
    }</button>
          </div>
        </form>
      </div>`;
  };

  const renderPeopleModal = () => {
    const tab = getTab();
    if (!tab) return "";
    return `
      <div class="cx-overlay" data-cx-overlay>
        <form class="cx-dialog" role="dialog" aria-modal="true" aria-labelledby="cx-people-title" data-cx-form="update-tab" novalidate>
          <div class="cx-modal-head"><h2 id="cx-people-title">Pessoas na mesa ${escapeHtml(tableNumber(getTableOf(tab)))}</h2><button class="cx-btn cx-btn-ghost" type="button" data-cx-action="close-modal">Esc</button></div>
          <div class="cx-modal-body">
            <p class="cx-muted">Alguém chegou ou saiu? O valor por pessoa é recalculado. A alteração fica na auditoria.</p>
            ${stepper("people.guests", state.people.guests, { min: 1, max: MAX_GUESTS, label: "pessoas" })}
            <label class="cx-field"><span>Nome ou apelido (opcional)</span><input class="cx-input" data-cx-field="people.customerName" maxlength="180" value="${escapeHtml(
              state.people.customerName
            )}" /></label>
          </div>
          <div class="cx-modal-actions">
            <button class="cx-btn" type="button" data-cx-action="close-modal">Cancelar</button>
            <button class="cx-btn cx-btn-primary" type="submit" data-cx-confirm ${state.busy ? "disabled" : ""}>Salvar · ${escapeHtml(
      peopleLabel(state.people.guests)
    )}</button>
          </div>
        </form>
      </div>`;
  };

  const renderMovementModal = () => {
    const movement = state.movement;
    const amount = cents(movement.amount);
    const valid = amount > 0 && movement.reason.trim().length >= 3;
    const list = getSnapshot().movements || [];
    return `
      <div class="cx-overlay" data-cx-overlay>
        <form class="cx-dialog" role="dialog" aria-modal="true" aria-labelledby="cx-move-title" data-cx-form="movement" novalidate>
          <div class="cx-modal-head"><h2 id="cx-move-title">Sangria / Suprimento</h2><button class="cx-btn cx-btn-ghost" type="button" data-cx-action="close-modal">Esc</button></div>
          <div class="cx-modal-body">
            <div class="cx-segmented" role="group" aria-label="Tipo de movimento">
              <button type="button" data-cx-set="movement.type" data-cx-value="WITHDRAWAL" aria-pressed="${movement.type === "WITHDRAWAL"}">Sangria · tirar dinheiro</button>
              <button type="button" data-cx-set="movement.type" data-cx-value="SUPPLY" aria-pressed="${movement.type === "SUPPLY"}">Suprimento · colocar dinheiro</button>
            </div>
            <div class="cx-fields">
              <label class="cx-field"><span>Valor (R$)</span><input class="cx-input cx-num" data-cx-field="movement.amount" inputmode="decimal" placeholder="0,00" value="${escapeHtml(
                movement.amount
              )}" /></label>
              <label class="cx-field"><span>Motivo (obrigatório)</span><input class="cx-input" data-cx-field="movement.reason" maxlength="300" placeholder="${
                movement.type === "WITHDRAWAL" ? "Ex.: dinheiro para o cofre" : "Ex.: reforço de troco"
              }" value="${escapeHtml(movement.reason)}" /></label>
            </div>
            <p class="cx-muted">Dinheiro esperado na gaveta agora: <strong class="cx-num">${escapeHtml(
              money(getSnapshot().registerSummary?.expectedCash || 0)
            )}</strong></p>
            ${
              list.length
                ? `<div class="cx-list"><h3>Neste turno</h3>${list
                    .map(
                      (entry) =>
                        `<div class="cx-list-row"><span>${escapeHtml(timeOf(entry.createdAt))} · ${
                          entry.movementType === "SUPPLY" ? "Suprimento" : "Sangria"
                        } · ${escapeHtml(entry.reason)}</span><strong class="cx-num">${
                          entry.movementType === "SUPPLY" ? "+" : "−"
                        } ${escapeHtml(money(entry.amount))}</strong></div>`
                    )
                    .join("")}</div>`
                : ""
            }
          </div>
          <div class="cx-modal-actions">
            <button class="cx-btn" type="button" data-cx-action="close-modal">Cancelar</button>
            <button class="cx-btn cx-btn-primary" type="submit" data-cx-confirm ${valid && !state.busy ? "" : "disabled"}>Registrar ${
      movement.type === "SUPPLY" ? "suprimento" : "sangria"
    }${amount > 0 ? ` · ${escapeHtml(money(reais(amount)))}` : ""}</button>
          </div>
        </form>
      </div>`;
  };

  /* ---------- Tela 4 · Lançar pedido (PDV) ---------- */

  const findProductsForQuery = (query) => {
    const items = getCatalogItems();
    const text = String(query || "").trim();
    if (/^\d+$/.test(text)) {
      const byCode = items.find((item) => item.code === Number(text));
      return byCode ? [byCode] : [];
    }
    const needle = normalizeSearch(text);
    return items.filter((item) =>
      normalizeSearch(`${item.name} ${item.sectionTitle || ""} ${item.category || ""}`).includes(needle)
    );
  };

  const visibleProducts = () => {
    const query = state.pdv.query.trim();
    if (query) {
      const quick = ui.parseQuickEntry(query);
      return findProductsForQuery(quick.query).slice(0, 60);
    }
    return getCatalogItems()
      .filter((item) => state.pdv.categoryId === "all" || item.sectionId === state.pdv.categoryId)
      .slice(0, 120);
  };

  const renderProducts = () => {
    const products = visibleProducts();
    return products.length
      ? products
          .map(
            (item) => `
              <button type="button" class="cx-product" data-cx-product="${escapeHtml(item.id)}" ${state.busy === "add-item" ? "aria-busy=\"true\"" : ""}>
                ${
                  mediaUrl(item.image)
                    ? `<img class="cx-product-thumb" src="${escapeHtml(mediaUrl(item.image))}" alt="" loading="lazy" decoding="async" />`
                    : `<span class="cx-product-thumb is-empty" aria-hidden="true">${escapeHtml(String(item.name || "?").charAt(0))}</span>`
                }
                <span class="cx-product-info">
                  <span class="cx-product-code">#${escapeHtml(item.code)}</span>
                  <strong>${escapeHtml(item.name)}</strong>
                  <span class="cx-num">${escapeHtml(money(item.price))}</span>
                </span>
              </button>`
          )
          .join("")
      : '<p class="cx-empty">Nenhum produto encontrado. Confira o código ou o nome.</p>';
  };

  const itemLine = (item, editable) => `
    <div class="cx-order-line ${editable ? "is-pending" : ""}">
      <div class="cx-order-main">
        <strong>${escapeHtml(item.productName)}</strong>
        ${item.notes ? `<small>${escapeHtml(item.notes)}</small>` : ""}
        ${
          editable && !item.optimistic
            ? `<button type="button" class="cx-link" data-cx-action="toggle-note" data-cx-item="${escapeHtml(item.id)}">${
                state.pdv.noteItemId === item.id ? "Fechar observação" : "Observação"
              }</button>`
            : ""
        }
      </div>
      ${
        editable
          ? item.optimistic
        ? `<span class="cx-num cx-qty" aria-busy="true">${escapeHtml(item.quantity)}× · gravando…</span>`
        : `<div class="cx-stepper cx-stepper-sm">
              <button type="button" data-cx-qty="${escapeHtml(item.id)}" data-cx-delta="-1" aria-label="Menos ${escapeHtml(item.productName)}">−</button>
              <output>${escapeHtml(item.quantity)}</output>
              <button type="button" data-cx-qty="${escapeHtml(item.id)}" data-cx-delta="1" aria-label="Mais ${escapeHtml(item.productName)}">+</button>
            </div>`
          : `<span class="cx-num cx-qty">${escapeHtml(item.quantity)}×</span>`
      }
      <strong class="cx-num cx-line-total">${escapeHtml(money(item.totalPrice))}</strong>
    </div>
    ${
      editable && state.pdv.noteItemId === item.id
        ? `<div class="cx-note-editor">
            <div class="cx-chips">${QUICK_NOTES.map(
              (note) =>
                `<button type="button" class="cx-chip" data-cx-note-chip="${escapeHtml(note)}" data-cx-item="${escapeHtml(item.id)}" aria-pressed="${String(
                  item.notes || ""
                ).includes(note)}">${escapeHtml(note)}</button>`
            ).join("")}</div>
            <input class="cx-input" data-cx-note-input="${escapeHtml(item.id)}" maxlength="400" placeholder="Outra observação e Enter" value="${escapeHtml(
              item.notes || ""
            )}" />
          </div>`
        : ""
    }`;

  /* Itens do servidor + lançamentos otimistas ainda não confirmados. */
  const displayItems = (tab) => {
    const items = (tab.items || []).map((item) => {
      const delta = state.qtyDelta[item.id] || 0;
      if (!delta) return item;
      const quantity = Math.max(0, Number(item.quantity) + delta);
      return { ...item, quantity, totalPrice: reais(cents(item.unitPrice) * quantity) };
    }).filter((item) => item.quantity > 0);
    for (const entry of state.optimistic) {
      const match = items.find(
        (item) => item.status === "PENDING" && item.productId === entry.productId && !String(item.notes || "").trim()
      );
      if (match) {
        const index = items.indexOf(match);
        const quantity = Math.min(99, Number(match.quantity) + entry.qty);
        items[index] = { ...match, quantity, totalPrice: reais(cents(match.unitPrice) * quantity) };
      } else {
        items.push({
          id: `tmp-${entry.key}`,
          productId: entry.productId,
          productName: entry.productName,
          notes: "",
          quantity: entry.qty,
          unitPrice: entry.unitPrice,
          totalPrice: reais(cents(entry.unitPrice) * entry.qty),
          status: "PENDING",
          optimistic: true,
        });
      }
    }
    return items;
  };

  const tabTotals = (tab) => {
    const items = displayItems(tab).filter((item) => item.status !== "CANCELLED");
    const pending = items.filter((item) => item.status === "PENDING");
    const sent = items.filter((item) => item.status !== "PENDING");
    const sum = (list) => list.reduce((acc, item) => acc + cents(item.totalPrice), 0);
    const subtotal = sum(items);
    const serviceRate = Number(tab.serviceChargeRate || 0);
    const service = tab.serviceChargeEnabled === false ? 0 : Math.round((subtotal * serviceRate) / 100);
    const total = subtotal + service;
    return {
      pending,
      sent,
      pendingTotal: sum(pending),
      sentTotal: sum(sent),
      subtotal,
      service,
      serviceRate,
      total,
      perPerson: Math.round(total / Math.max(1, Number(tab.guestCount || 1))),
    };
  };

  const renderPdv = () => {
    const tab = getTab();
    const table = getTableOf(tab);
    if (!tab) {
      state.screen = "salao";
      return renderSalao();
    }
    const totals = tabTotals(tab);
    const sections = getCatalogSections();
    const locked = tab.status !== "OPEN";
    return `
      <header class="cx-topbar">
        <div class="cx-topbar-title">
          <h1>Lançar pedido · Mesa ${escapeHtml(tableNumber(table))}</h1>
          <p>${escapeHtml(peopleLabel(tab.guestCount))} · aberta há ${escapeHtml(elapsed(tab.openedAt))}${
      tab.customerName ? ` · ${escapeHtml(tab.customerName)}` : ""
    } · garçom ${escapeHtml(tab.waiterName || "--")}</p>
        </div>
        <div class="cx-topbar-actions">
          <button class="cx-btn" type="button" data-cx-action="back-salao">← Salão <span class="cx-kbd">Esc</span></button>
          <button class="cx-btn" type="button" data-cx-action="print-tab">Imprimir comanda</button>
          ${
            hasPermission("cash_register_open_tab")
              ? '<button class="cx-btn" type="button" data-cx-action="edit-people">Trocar pessoas</button>'
              : ""
          }
        </div>
      </header>
      ${feedback()}
      ${
        locked
          ? '<div class="cx-warn" role="note">Esta conta está em pagamento. Para lançar novos itens, volte ao pedido pela tela de pagamento.</div>'
          : ""
      }
      <div class="cx-split">
        <section class="cx-split-main">
          <label class="cx-search">
            <span class="cx-sr-only">Buscar produto por nome ou código</span>
            <input class="cx-input cx-input-lg" data-cx-field="pdv.query" data-cx-enter="quick-add" data-cx-autofocus placeholder="Buscar por nome ou código · 3*12 + Enter lança 3 do item 12" value="${escapeHtml(
              state.pdv.query
            )}" ${locked ? "disabled" : ""} autocomplete="off" />
          </label>
          <div class="cx-scroll-row" role="group" aria-label="Categorias">
            <button type="button" class="cx-chip" data-cx-set="pdv.categoryId" data-cx-value="all" aria-pressed="${state.pdv.categoryId === "all"}">Todos</button>
            ${sections
              .map(
                (section) =>
                  `<button type="button" class="cx-chip" data-cx-set="pdv.categoryId" data-cx-value="${escapeHtml(section.id)}" aria-pressed="${
                    state.pdv.categoryId === section.id
                  }">${escapeHtml(section.title)}</button>`
              )
              .join("")}
          </div>
          <div class="cx-row-wrap cx-multiplier" role="group" aria-label="Quantidade do próximo item">
            <span class="cx-muted">Próximo item ×</span>
            ${[1, 2, 3, 4, 5, 6]
              .map(
                (value) =>
                  `<button type="button" class="cx-chip" data-cx-set="pdv.multiplier" data-cx-value="${value}" aria-pressed="${
                    state.pdv.multiplier === value
                  }">×${value}</button>`
              )
              .join("")}
            <span class="cx-muted cx-hide-narrow">Escolha antes de clicar no item</span>
          </div>
          <div class="cx-grid-products" data-cx-products>${renderProducts()}</div>
        </section>
        <aside class="cx-split-side cx-panel cx-order" aria-label="Pedido da mesa">
          <div class="cx-order-head"><h2>Mesa ${escapeHtml(tableNumber(table))}</h2><span class="cx-muted">${escapeHtml(
      totals.pending.length
    )} ${totals.pending.length === 1 ? "item novo" : "itens novos"}</span></div>
          <div class="cx-panel-scroll">
            ${
              totals.sent.length
                ? `<h3 class="cx-order-group">Já na cozinha</h3>${totals.sent.map((item) => itemLine(item, false)).join("")}`
                : ""
            }
            <h3 class="cx-order-group">Para enviar</h3>
            ${
              totals.pending.length
                ? totals.pending.map((item) => itemLine(item, !locked)).join("")
                : '<p class="cx-empty">Clique num item ou digite o código para começar.</p>'
            }
          </div>
          <dl class="cx-totals">
            <div><dt>Itens novos</dt><dd class="cx-num">${escapeHtml(money(reais(totals.pendingTotal)))}</dd></div>
            <div><dt>Já na mesa</dt><dd class="cx-num">${escapeHtml(money(reais(totals.sentTotal)))}</dd></div>
            <div><dt>Serviço ${escapeHtml(totals.serviceRate)}%</dt><dd class="cx-num">${escapeHtml(money(reais(totals.service)))}</dd></div>
            <div class="is-total"><dt>Total da mesa</dt><dd class="cx-num">${escapeHtml(money(reais(totals.total)))}</dd></div>
            <div><dt>Por pessoa (${escapeHtml(tab.guestCount)})</dt><dd class="cx-num">${escapeHtml(money(reais(totals.perPerson)))}</dd></div>
          </dl>
          <div class="cx-order-actions">
            <button class="cx-btn" type="button" data-cx-action="clear-pending" ${!totals.pending.length || locked ? "disabled" : ""}>Limpar</button>
            ${
              hasPermission("cash_register_close_tab")
                ? `<button class="cx-btn" type="button" data-cx-action="go-payment" ${
                    !(tab.items || []).length ? "disabled" : ""
                  }>Fechar conta <span class="cx-kbd">F4</span></button>`
                : ""
            }
            <button class="cx-btn cx-btn-primary" type="button" data-cx-action="send-order" ${
              !totals.pending.length || locked || state.busy ? "disabled" : ""
            }>Enviar para a cozinha <span class="cx-kbd">F2</span></button>
          </div>
        </aside>
      </div>`;
  };

  /* ---------- Tela 4b · Pedido de retirada ou entrega (sem mesa) ---------- */

  const COUNTER_PAYMENTS = [
    ["pix", "Pix"],
    ["dinheiro", "Dinheiro"],
    ["credito", "Crédito"],
    ["debito", "Débito"],
    ["pending", "A definir"],
  ];

  const newCounter = (mode) => ({
    mode,
    items: [],
    name: "",
    phone: "",
    line: "",
    number: "",
    neighborhood: "",
    complement: "",
    reference: "",
    fee: "",
    payment: "pix",
    cashFor: "",
    notes: "",
  });

  const counterTotals = () => {
    const counter = state.counter || newCounter("pickup");
    const subtotal = counter.items.reduce((sum, item) => sum + cents(item.unitPrice) * item.quantity, 0);
    const fee = counter.mode === "delivery" ? cents(counter.fee) : 0;
    return { subtotal, fee, total: subtotal + fee };
  };

  const counterProblems = () => {
    const counter = state.counter;
    if (!counter) return ["Escolha retirada ou entrega."];
    const problems = [];
    if (!counter.items.length) problems.push("Adicione pelo menos um item.");
    if (counter.name.trim().length < 2) problems.push("Informe o nome do cliente.");
    if (counter.mode === "delivery") {
      if (counter.phone.replace(/\D/g, "").length < 10) problems.push("Informe o telefone com DDD.");
      if (counter.line.trim().length < 3 || !counter.number.trim() || counter.neighborhood.trim().length < 2) {
        problems.push("Informe rua, número e bairro.");
      }
    }
    return problems;
  };

  const counterAdd = (productId, quantity) => {
    const product = getCatalogItems().find((item) => item.id === productId);
    if (!state.counter || !product) return;
    const qty = ui.clampInteger(quantity, { min: 1, max: 99 });
    const existing = state.counter.items.find((item) => item.productId === productId && !item.notes);
    if (existing) existing.quantity = Math.min(99, existing.quantity + qty);
    else state.counter.items.push({ key: ++optimisticSeq, productId, productName: product.name, unitPrice: product.price, quantity: qty, notes: "" });
    state.pdv.multiplier = 1;
    render();
  };

  const counterField = (path, label, { type = "text", placeholder = "", required = false, inputmode = "", wide = false } = {}) => `
    <label class="cx-field${wide ? " is-wide" : ""}">
      <span>${escapeHtml(label)}${required ? ' <b class="cx-req" aria-hidden="true">*</b>' : ""}</span>
      <input class="cx-input" type="${type}" data-cx-field="counter.${path}" value="${escapeHtml(state.counter[path])}" placeholder="${escapeHtml(placeholder)}" ${inputmode ? `inputmode="${inputmode}"` : ""} ${required ? "required" : ""} autocomplete="off" />
    </label>`;

  const renderCounter = () => {
    const counter = state.counter;
    if (!counter) {
      state.screen = "salao";
      return renderSalao();
    }
    const isDelivery = counter.mode === "delivery";
    const totals = counterTotals();
    const problems = counterProblems();
    const sections = getCatalogSections();
    return `
      <header class="cx-topbar">
        <div class="cx-topbar-title">
          <h1>Lançar pedido · ${isDelivery ? "Entrega" : "Retirada no balcão"}</h1>
          <p>${isDelivery ? "Pedido por telefone ou fora do site, entregue no endereço do cliente." : "Cliente pediu no balcão e vai levar."}</p>
        </div>
        <div class="cx-topbar-actions">
          <div class="cx-segmented" role="group" aria-label="Tipo do pedido">
            <button type="button" data-cx-set="counter.mode" data-cx-value="pickup" aria-pressed="${!isDelivery}">Retirada</button>
            <button type="button" data-cx-set="counter.mode" data-cx-value="delivery" aria-pressed="${isDelivery}">Entrega</button>
          </div>
          <button class="cx-btn" type="button" data-cx-action="back-salao">← Salão <span class="cx-kbd">Esc</span></button>
        </div>
      </header>
      ${feedback()}
      <div class="cx-split">
        <section class="cx-split-main">
          <label class="cx-search">
            <span class="cx-sr-only">Buscar produto por nome ou código</span>
            <input class="cx-input cx-input-lg" data-cx-field="pdv.query" data-cx-enter="quick-add" data-cx-autofocus placeholder="Buscar por nome ou código · 3*12 + Enter lança 3 do item 12" value="${escapeHtml(
              state.pdv.query
            )}" autocomplete="off" />
          </label>
          <div class="cx-scroll-row" role="group" aria-label="Categorias">
            <button type="button" class="cx-chip" data-cx-set="pdv.categoryId" data-cx-value="all" aria-pressed="${state.pdv.categoryId === "all"}">Todos</button>
            ${sections
              .map(
                (section) =>
                  `<button type="button" class="cx-chip" data-cx-set="pdv.categoryId" data-cx-value="${escapeHtml(section.id)}" aria-pressed="${
                    state.pdv.categoryId === section.id
                  }">${escapeHtml(section.title)}</button>`
              )
              .join("")}
          </div>
          <div class="cx-row-wrap cx-multiplier" role="group" aria-label="Quantidade do próximo item">
            <span class="cx-muted">Próximo item ×</span>
            ${[1, 2, 3, 4, 5, 6]
              .map(
                (value) =>
                  `<button type="button" class="cx-chip" data-cx-set="pdv.multiplier" data-cx-value="${value}" aria-pressed="${
                    state.pdv.multiplier === value
                  }">×${value}</button>`
              )
              .join("")}
          </div>
          <div class="cx-grid-products" data-cx-products>${renderProducts()}</div>
        </section>
        <aside class="cx-split-side cx-panel cx-order" aria-label="Pedido de ${isDelivery ? "entrega" : "retirada"}">
          <div class="cx-order-head"><h2>${isDelivery ? "Entrega" : "Retirada"}</h2><span class="cx-muted">${escapeHtml(
            counter.items.reduce((sum, item) => sum + item.quantity, 0)
          )} itens</span></div>
          <div class="cx-panel-scroll">
            <div class="cx-counter-form">
              ${counterField("name", "Nome do cliente", { required: true, placeholder: "Ex.: Maria", wide: true })}
              ${counterField("phone", "Telefone", { type: "tel", inputmode: "tel", required: isDelivery, placeholder: "(16) 99999-0000", wide: true })}
              ${
                isDelivery
                  ? `${counterField("line", "Rua", { required: true, placeholder: "Rua das Flores", wide: true })}
                     ${counterField("number", "Número", { required: true, placeholder: "115", inputmode: "numeric" })}
                     ${counterField("neighborhood", "Bairro", { required: true, placeholder: "Centro" })}
                     ${counterField("complement", "Complemento", { placeholder: "Apto 12" })}
                     ${counterField("reference", "Referência", { placeholder: "Perto da praça" })}
                     ${counterField("fee", "Taxa de entrega (R$)", { inputmode: "decimal", placeholder: "0,00" })}`
                  : ""
              }
            </div>
            <h3 class="cx-order-group">Pagamento</h3>
            <div class="cx-chips" role="group" aria-label="Forma de pagamento">${COUNTER_PAYMENTS.map(
              ([value, label]) =>
                `<button type="button" class="cx-chip" data-cx-set="counter.payment" data-cx-value="${value}" aria-pressed="${counter.payment === value}">${escapeHtml(label)}</button>`
            ).join("")}</div>
            ${counter.payment === "dinheiro" ? `<div class="cx-counter-form">${counterField("cashFor", "Troco para (R$)", { inputmode: "decimal", placeholder: "Ex.: 100,00", wide: true })}</div>` : ""}
            <div class="cx-counter-form">${counterField("notes", "Observação do pedido", { placeholder: "Ex.: sem cebolinha", wide: true })}</div>
            <h3 class="cx-order-group">Itens</h3>
            ${
              counter.items.length
                ? counter.items
                    .map(
                      (item) => `
                        <div class="cx-order-line is-pending">
                          <div class="cx-order-main"><strong>${escapeHtml(item.productName)}</strong></div>
                          <div class="cx-stepper cx-stepper-sm">
                            <button type="button" data-cx-counter-qty="${item.key}" data-cx-delta="-1" aria-label="Menos ${escapeHtml(item.productName)}">−</button>
                            <output>${escapeHtml(item.quantity)}</output>
                            <button type="button" data-cx-counter-qty="${item.key}" data-cx-delta="1" aria-label="Mais ${escapeHtml(item.productName)}">+</button>
                          </div>
                          <strong class="cx-num cx-line-total">${escapeHtml(money(reais(cents(item.unitPrice) * item.quantity)))}</strong>
                        </div>`
                    )
                    .join("")
                : '<p class="cx-empty">Clique num item ou digite o código para começar.</p>'
            }
          </div>
          <dl class="cx-totals">
            <div><dt>Itens</dt><dd class="cx-num">${escapeHtml(money(reais(totals.subtotal)))}</dd></div>
            ${isDelivery ? `<div><dt>Taxa de entrega</dt><dd class="cx-num">${escapeHtml(money(reais(totals.fee)))}</dd></div>` : ""}
            <div class="is-total"><dt>Total</dt><dd class="cx-num">${escapeHtml(money(reais(totals.total)))}</dd></div>
          </dl>
          ${problems.length && counter.items.length ? `<p class="cx-counter-hint">${escapeHtml(problems[0])}</p>` : ""}
          <div class="cx-order-actions">
            <button class="cx-btn" type="button" data-cx-action="counter-clear" ${counter.items.length ? "" : "disabled"}>Limpar</button>
            <button class="cx-btn cx-btn-primary" type="button" data-cx-action="counter-send" ${problems.length || state.busy ? "disabled" : ""}>Enviar para a cozinha <span class="cx-kbd">F2</span></button>
          </div>
        </aside>
      </div>`;
  };

  const renderLaunchModal = () => `
    <div class="cx-modal-backdrop" role="presentation">
      <div class="cx-modal" role="dialog" aria-modal="true" aria-labelledby="cx-launch-title">
        <h2 id="cx-launch-title">Lançar pedido</h2>
        <p class="cx-muted">Para onde vai este pedido?</p>
        <div class="cx-launch-options">
          <button type="button" class="cx-launch" data-cx-action="launch-table"><strong>🍽️ Mesa</strong><span>Comanda de uma mesa do salão</span></button>
          <button type="button" class="cx-launch" data-cx-action="launch-pickup"><strong>🛍️ Retirada</strong><span>Cliente pediu no balcão e vai levar</span></button>
          <button type="button" class="cx-launch" data-cx-action="launch-delivery"><strong>🛵 Entrega</strong><span>Pedido por telefone, com nome, telefone e endereço</span></button>
        </div>
        <div class="cx-modal-actions">
          <button class="cx-btn" type="button" data-cx-action="close-modal">Cancelar</button>
        </div>
      </div>
    </div>`;

  /* ---------- Tela 5 · Pagamento ---------- */

  /* Em quantas partes dividir: de 1 até as pessoas da mesa (nunca mais). */
  const splitCountOf = (tab) => {
    const guests = Math.max(1, Number(tab.guestCount || 1));
    const chosen = Number(state.payment.splitCount);
    return Number.isInteger(chosen) && chosen >= 1 ? Math.min(chosen, guests) : guests;
  };

  const paymentState = (tab) => {
    const total = cents(tab.totalAmount);
    const paid = state.payment.draft.reduce((sum, entry) => sum + cents(entry.amount), 0);
    const missing = Math.max(0, total - paid);
    const shares = ui.splitEqually(reais(total), splitCountOf(tab)).map(cents);
    return { total, paid, missing, shares };
  };

  const dueNow = (tab, info) => {
    if (state.payment.mode === "equal") {
      const share = info.shares[state.payment.shareIndex] ?? 0;
      return Math.min(share, info.missing);
    }
    const typed = cents(state.payment.entry);
    return Math.min(typed > 0 ? typed : info.missing, info.missing);
  };

  /* Valores da conta antes do pagamento (desconto e serviço da tela). */
  const billValues = (tab) => {
    const totals = tabTotals(tab);
    const discount = Math.min(cents(state.bill.discount), totals.subtotal);
    const service = state.bill.serviceEnabled ? Math.round((totals.subtotal * totals.serviceRate) / 100) : 0;
    const total = Math.max(0, totals.subtotal - discount + service);
    return { totals, discount, service, total };
  };

  const renderBillStep = (tab) => {
    const table = getTableOf(tab);
    const { totals, discount, service, total } = billValues(tab);
    const canDiscount = hasPermission("cash_register_discount");
    const canService = hasPermission("cash_register_remove_service");
    const units = totals.sent.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    return `
      <div class="cx-split cx-bill">
        <section class="cx-split-main cx-card cx-bill-card">
          <div class="cx-bill-head">
            <div>
              <span class="cx-eyebrow">Conferir a conta</span>
              <h2>Mesa ${escapeHtml(tableNumber(table))}</h2>
            </div>
            <button class="cx-btn" type="button" data-cx-action="print-bill">Imprimir conta</button>
          </div>
          <div class="cx-bill-facts">
            <span><small>Pessoas</small><strong>${escapeHtml(tab.guestCount)}</strong></span>
            <span><small>Aberta há</small><strong>${escapeHtml(elapsed(tab.openedAt))}</strong></span>
            <span><small>Garçom</small><strong>${escapeHtml(tab.waiterName || "—")}</strong></span>
            <span><small>Itens</small><strong>${escapeHtml(units)}</strong></span>
          </div>
          ${
            totals.pending.length
              ? `<p class="cx-warn" role="note">Há ${escapeHtml(totals.pending.length)} item(ns) ainda não enviado(s) para a cozinha. Envie ou remova antes de fechar a conta.</p>`
              : ""
          }
          <div class="cx-bill-table" role="table" aria-label="Itens da conta">
            <div class="cx-bill-row is-head" role="row"><span role="columnheader">Qtd</span><span role="columnheader">Item</span><span role="columnheader">Unit.</span><span role="columnheader">Total</span></div>
            ${totals.sent
              .map(
                (item) => `<div class="cx-bill-row" role="row">
                  <span role="cell" class="cx-num cx-bill-qty">${escapeHtml(item.quantity)}×</span>
                  <span role="cell"><strong>${escapeHtml(item.productName)}</strong>${item.notes ? `<small>${escapeHtml(item.notes)}</small>` : ""}</span>
                  <span role="cell" class="cx-num">${escapeHtml(money(item.unitPrice))}</span>
                  <span role="cell" class="cx-num"><strong>${escapeHtml(money(item.totalPrice))}</strong></span>
                </div>`
              )
              .join("")}
          </div>
        </section>
        <aside class="cx-split-side cx-card cx-bill-summary">
          <h2>Resumo</h2>
          <div class="cx-bill-line"><span>Subtotal</span><strong class="cx-num">${escapeHtml(money(reais(totals.subtotal)))}</strong></div>
          <label class="cx-switch-row ${canService ? "" : "is-disabled"}">
            <span><strong>Taxa de serviço ${escapeHtml(totals.serviceRate)}%</strong><small>${
              state.bill.serviceEnabled ? "Incluída na conta" : "Removida desta conta"
            }</small></span>
            <span class="cx-row-wrap"><strong class="cx-num">${escapeHtml(money(reais(service)))}</strong>
            <input type="checkbox" role="switch" class="cx-switch" data-cx-toggle="bill.serviceEnabled" aria-label="Cobrar taxa de serviço" ${
              state.bill.serviceEnabled ? "checked" : ""
            } ${canService ? "" : "disabled"} /></span>
          </label>
          <div class="cx-field">
            <span>Desconto</span>
            <div class="cx-money-input"><span aria-hidden="true">R$</span><input class="cx-input cx-num" data-cx-field="bill.discount" inputmode="decimal" placeholder="0,00" aria-label="Desconto em reais" value="${escapeHtml(
              state.bill.discount
            )}" ${canDiscount ? "" : 'disabled title="Seu cargo não pode dar desconto"'} /></div>
            ${
              canDiscount
                ? `<div class="cx-chips">${[5, 10, 15]
                    .map(
                      (percent) =>
                        `<button type="button" class="cx-chip" data-cx-set="bill.discount" data-cx-value="${escapeHtml(
                          String(reais(Math.round((totals.subtotal * percent) / 100))).replace(".", ",")
                        )}">${percent}%</button>`
                    )
                    .join("")}<button type="button" class="cx-chip" data-cx-set="bill.discount" data-cx-value="">Sem desconto</button></div>`
                : ""
            }
          </div>
          ${discount ? `<div class="cx-bill-line is-discount"><span>Desconto</span><strong class="cx-num">− ${escapeHtml(money(reais(discount)))}</strong></div>` : ""}
          <div class="cx-bill-total">
            <span>Total a cobrar</span>
            <strong class="cx-num">${escapeHtml(money(reais(total)))}</strong>
            <small>${escapeHtml(money(reais(Math.round(total / Math.max(1, tab.guestCount)))))} por pessoa (${escapeHtml(tab.guestCount)})</small>
          </div>
          <button class="cx-btn cx-btn-primary cx-btn-lg cx-btn-block" type="button" data-cx-action="begin-closing" ${
            totals.pending.length || !totals.sent.length || state.busy ? "disabled" : ""
          }>Fechar conta e cobrar <span class="cx-kbd">F4</span></button>
          <button class="cx-btn cx-btn-block" type="button" data-cx-action="back-pdv">← Voltar ao pedido</button>
        </aside>
      </div>`;
  };

  const renderPayment = () => {
    const tab = getTab();
    const table = getTableOf(tab);
    if (!tab) {
      state.screen = "salao";
      return renderSalao();
    }
    const header = `
      <header class="cx-topbar">
        <div class="cx-topbar-title">
          <h1>Fechar conta · Mesa ${escapeHtml(tableNumber(table))}</h1>
          <p>${escapeHtml(peopleLabel(tab.guestCount))}${tab.customerName ? ` · ${escapeHtml(tab.customerName)}` : ""}</p>
        </div>
        <div class="cx-topbar-actions"><button class="cx-btn" type="button" data-cx-action="back-salao">← Salão</button></div>
      </header>
      ${feedback()}`;
    if (tab.status === "OPEN") return header + renderBillStep(tab);

    const info = paymentState(tab);
    const due = dueNow(tab, info);
    const isCash = state.payment.method === "CASH";
    const received = isCash ? cents(state.payment.entry) || due : due;
    const change = ui.cashChange(reais(due), reais(received));
    const paidShares = new Set(state.payment.draft.map((entry) => entry.shareIndex).filter((value) => value !== undefined));
    const canConfirm = hasPermission("cash_register_confirm_payment");
    return `${header}
      <div class="cx-split">
        <section class="cx-split-main">
          <div class="cx-card cx-pay-total">
            <div>
              <span class="cx-muted">Total da mesa</span>
              <strong class="cx-big">${escapeHtml(money(reais(info.total)))}</strong>
            </div>
            <dl>
              <div><dt>Itens</dt><dd class="cx-num">${escapeHtml(money(tab.subtotal))}</dd></div>
              <div><dt>Serviço</dt><dd class="cx-num">${escapeHtml(money(tab.serviceChargeAmount || 0))}</dd></div>
              ${Number(tab.discountAmount) ? `<div><dt>Desconto</dt><dd class="cx-num">− ${escapeHtml(money(tab.discountAmount))}</dd></div>` : ""}
              <div><dt>Recebido</dt><dd class="cx-num">${escapeHtml(money(reais(info.paid)))}</dd></div>
            </dl>
            <div class="cx-pay-progress" role="progressbar" aria-label="Quanto já foi recebido" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${
              info.total ? Math.round((info.paid / info.total) * 100) : 0
            }"><span style="width:${info.total ? Math.min(100, Math.round((info.paid / info.total) * 100)) : 0}%"></span></div>
          </div>
          <div class="cx-segmented" role="group" aria-label="Forma de divisão">
            <button type="button" data-cx-set="payment.mode" data-cx-value="equal" aria-pressed="${state.payment.mode === "equal"}">Dividir igual</button>
            <button type="button" data-cx-set="payment.mode" data-cx-value="free" aria-pressed="${state.payment.mode === "free"}">Valor livre</button>
          </div>
          ${
            state.payment.mode === "equal"
              ? (() => {
                  const guests = Math.max(1, Number(tab.guestCount || 1));
                  const parts = splitCountOf(tab);
                  const locked = state.payment.draft.length > 0;
                  const quick = [...new Set([1, 2, 3, 4, 5, 6, guests])].filter((value) => value <= guests).sort((a, b) => a - b);
                  return `<div class="cx-split-picker">
                    <span><strong>Dividir entre</strong><small>${locked ? "Remova os pagamentos lançados para mudar a divisão." : `Até ${escapeHtml(peopleLabel(guests))} da mesa.`}</small></span>
                    <div class="cx-row-wrap">
                      <div class="cx-stepper cx-stepper-sm">
                        <button type="button" data-cx-step-field="payment.splitCount" data-cx-delta="-1" aria-label="Menos uma parte" ${locked || parts <= 1 ? "disabled" : ""}>−</button>
                        <output aria-live="polite" aria-label="Partes">${escapeHtml(parts)}</output>
                        <button type="button" data-cx-step-field="payment.splitCount" data-cx-delta="1" aria-label="Mais uma parte" ${locked || parts >= guests ? "disabled" : ""}>+</button>
                      </div>
                      <div class="cx-chips">${quick
                        .map(
                          (value) =>
                            `<button type="button" class="cx-chip" data-cx-set="payment.splitCount" data-cx-value="${value}" aria-pressed="${value === parts}" ${
                              locked ? "disabled" : ""
                            }>${value === guests ? `Todos (${value})` : value}</button>`
                        )
                        .join("")}</div>
                    </div>
                  </div>`;
                })()
              : ""
          }
          <p class="cx-muted">${
            state.payment.mode === "equal"
              ? `Total dividido igualmente em ${escapeHtml(splitCountOf(tab))} ${splitCountOf(tab) === 1 ? "parte" : "partes"}. O centavo que sobra vai para a última.`
              : "Digite qualquer valor; o sistema mostra quanto ainda falta."
          }</p>
          ${
            state.payment.mode === "equal"
              ? `<div class="cx-grid-shares">${info.shares
                  .map((share, index) => {
                    const paid = paidShares.has(index);
                    const active = !paid && index === state.payment.shareIndex;
                    return `<button type="button" class="cx-share ${paid ? "is-paid" : active ? "is-active" : ""}" data-cx-set="payment.shareIndex" data-cx-value="${index}" ${
                      paid ? "disabled" : ""
                    }><span>Pessoa ${index + 1}</span><strong class="cx-num">${escapeHtml(money(reais(share)))}</strong><small>${
                      paid ? "Pago" : active ? "Recebendo agora" : "Pendente"
                    }</small></button>`;
                  })
                  .join("")}</div>`
              : ""
          }
          <div class="cx-card">
            <h3>Pagamentos lançados</h3>
            ${
              state.payment.draft.length
                ? state.payment.draft
                    .map(
                      (entry, index) =>
                        `<div class="cx-list-row"><span>${
                          entry.shareIndex !== undefined ? `Pessoa ${entry.shareIndex + 1} · ` : ""
                        }${escapeHtml(PAYMENT_LABELS[entry.method])}${
                          entry.method === "CASH" && cents(entry.receivedAmount) > cents(entry.amount)
                            ? ` · troco ${escapeHtml(money(reais(cents(entry.receivedAmount) - cents(entry.amount))))}`
                            : ""
                        }</span><span class="cx-row-wrap"><strong class="cx-num">${escapeHtml(money(entry.amount))}</strong><button type="button" class="cx-link" data-cx-remove-payment="${index}">Remover</button></span></div>`
                    )
                    .join("")
                : '<p class="cx-muted">Nenhum pagamento lançado ainda.</p>'
            }
            <div class="cx-list-row is-strong"><span>Falta receber</span><strong class="cx-num">${escapeHtml(money(reais(info.missing)))}</strong></div>
            <p class="cx-hint">Os pagamentos são gravados todos juntos ao finalizar a mesa.</p>
          </div>
        </section>
        <aside class="cx-split-side cx-card">
          <h2>Recebendo agora${state.payment.mode === "equal" && info.missing ? ` · Pessoa ${state.payment.shareIndex + 1}` : ""}</h2>
          <strong class="cx-big">${escapeHtml(money(reais(due)))}</strong>
          <div class="cx-chips" role="group" aria-label="Forma de pagamento">${PAYMENT_METHODS.map(
            (method) =>
              `<button type="button" class="cx-chip" data-cx-set="payment.method" data-cx-value="${method.key}" aria-pressed="${
                state.payment.method === method.key
              }">${escapeHtml(method.label)}</button>`
          ).join("")}</div>
          ${
            isCash || state.payment.mode === "free"
              ? `<label class="cx-field"><span>${isCash ? "Valor recebido em dinheiro" : "Valor deste pagamento"}</span><input class="cx-input cx-input-lg cx-num" data-cx-field="payment.entry" data-cx-enter="add-payment" inputmode="decimal" placeholder="${escapeHtml(
                  money(reais(due))
                )}" value="${escapeHtml(state.payment.entry)}" /></label>`
              : ""
          }
          ${
            isCash
              ? `<div class="cx-chips">${[
                  ["Exato", reais(due)],
                  ["R$ 50", 50],
                  ["R$ 80", 80],
                  ["R$ 100", 100],
                  ["R$ 200", 200],
                ]
                  .map(
                    ([label, value]) =>
                      `<button type="button" class="cx-chip" data-cx-set="payment.entry" data-cx-value="${escapeHtml(
                        String(value).replace(".", ",")
                      )}">${escapeHtml(label)}</button>`
                  )
                  .join("")}</div>
                <div class="cx-change ${change.missing ? "is-missing" : ""}"><span>${change.missing ? "Falta" : "Troco"}</span><strong class="cx-num">${escapeHtml(
                  money(change.missing || change.change)
                )}</strong></div>`
              : `<p class="cx-note">${
                  state.payment.method === "PIX"
                    ? "Mostre o QR Code ao cliente e confirme aqui quando o Pix cair."
                    : `Passe ${escapeHtml(money(reais(due)))} na maquininha e confirme quando aprovar.`
                }</p>`
          }
          <button class="cx-btn cx-btn-primary cx-btn-block" type="button" data-cx-action="add-payment" ${
            !due || (isCash && change.missing) || !canConfirm ? "disabled" : ""
          }>Confirmar pagamento <span class="cx-kbd">Enter</span></button>
          <button class="cx-btn cx-btn-dark cx-btn-lg cx-btn-block" type="button" data-cx-action="finish-payment" ${
            info.missing || !state.payment.draft.length || state.busy || !canConfirm ? "disabled" : ""
          }>${info.missing ? `Finalizar e liberar mesa (falta ${escapeHtml(money(reais(info.missing)))})` : "Finalizar e liberar mesa"}</button>
          ${
            !state.payment.draft.length
              ? '<button class="cx-btn cx-btn-block" type="button" data-cx-action="reopen-tab">← Voltar ao pedido (reabrir conta)</button>'
              : ""
          }
        </aside>
      </div>`;
  };

  /* ---------- Tela 6 · Fechamento ---------- */

  const renderClosing = () => {
    const snapshot = getSnapshot();
    const register = snapshot.register;
    if (!register) {
      const closed = snapshot.lastClosedRegister;
      return `
        <section class="cx-center-card">
          <span class="cx-eyebrow">Caixa fechado</span>
          <h1>Não há caixa aberto</h1>
          ${
            closed
              ? `<p class="cx-muted">Último fechamento às ${escapeHtml(timeOf(closed.closedAt))}: esperado ${escapeHtml(
                  money(closed.expectedCash)
                )}, contado ${escapeHtml(money(closed.countedCash))}, diferença ${escapeHtml(money(closed.differenceAmount))}.</p>`
              : ""
          }
          <button class="cx-btn cx-btn-primary cx-btn-lg" type="button" data-cx-view="opening">Abrir caixa</button>
        </section>`;
    }
    const summary = snapshot.registerSummary || {};
    const totals = summary.paymentTotals || {};
    const openTabs = snapshot.activeTabs.length;
    const movements = snapshot.movements || [];
    const expected = cents(summary.expectedCash);
    const counted = cents(state.closing.counted);
    const hasCounted = state.closing.counted.trim() !== "";
    const difference = hasCounted ? counted - expected : 0;
    const needsNotes = hasCounted && difference !== 0 && !state.closing.notes.trim();
    const canClose = !openTabs && hasCounted && !needsNotes && !state.busy;
    return `
      <header class="cx-topbar">
        <div class="cx-topbar-title"><h1>Fechar caixa</h1><p>${escapeHtml(dayLabel())} · aberto por ${escapeHtml(
      register.openingUserDisplayName
    )} às ${escapeHtml(timeOf(register.openedAt))}</p></div>
        <div class="cx-topbar-actions"><button class="cx-btn" type="button" data-cx-view="floor">← Salão</button></div>
      </header>
      ${feedback()}
      ${
        openTabs
          ? `<div class="cx-warn cx-row-between" role="alert"><span><strong>${escapeHtml(openTabs)} ${
              openTabs === 1 ? "mesa ainda está aberta" : "mesas ainda estão abertas"
            }.</strong> Feche as comandas antes de fechar o caixa.</span><button class="cx-btn" type="button" data-cx-action="show-open-tables">Ver mesas abertas</button></div>`
          : ""
      }
      <div class="cx-split">
        <section class="cx-split-main cx-card">
          <h2>Recebido no turno</h2>
          <div class="cx-list">${PAYMENT_METHODS.map(
            (method) =>
              `<div class="cx-list-row"><span>${escapeHtml(method.label)}</span><strong class="cx-num">${escapeHtml(money(totals[method.key] || 0))}</strong></div>`
          ).join("")}
            <div class="cx-list-row is-strong"><span>Total</span><strong class="cx-num">${escapeHtml(money(summary.totalSold || 0))}</strong></div>
          </div>
          <p class="cx-muted">${escapeHtml(summary.closedTabs || 0)} comandas pagas${
      summary.closedTabs ? ` · ticket médio ${escapeHtml(money(reais(Math.round(cents(summary.totalSold) / summary.closedTabs))))}` : ""
    } · descontos ${escapeHtml(money(summary.discounts || 0))} · serviço ${escapeHtml(money(summary.serviceCharges || 0))}</p>
        </section>
        <form class="cx-split-side cx-card" data-cx-form="close-register" novalidate>
          <h2>Dinheiro na gaveta</h2>
          <div class="cx-list">
            <div class="cx-list-row"><span>Fundo de troco (abertura)</span><strong class="cx-num">${escapeHtml(money(register.openingAmount))}</strong></div>
            <div class="cx-list-row"><span>Vendas em dinheiro</span><strong class="cx-num">+ ${escapeHtml(money(totals.CASH || 0))}</strong></div>
            ${movements
              .slice()
              .reverse()
              .map(
                (entry) =>
                  `<div class="cx-list-row"><span>${entry.movementType === "SUPPLY" ? "Suprimento" : "Sangria"} (${escapeHtml(
                    timeOf(entry.createdAt)
                  )}) · ${escapeHtml(entry.reason)}</span><strong class="cx-num">${entry.movementType === "SUPPLY" ? "+" : "−"} ${escapeHtml(
                    money(entry.amount)
                  )}</strong></div>`
              )
              .join("")}
            <div class="cx-list-row is-strong"><span>Esperado</span><strong class="cx-num">${escapeHtml(money(reais(expected)))}</strong></div>
          </div>
          <label class="cx-field"><span>Contado na gaveta (R$)</span><input class="cx-input cx-input-lg cx-num" data-cx-field="closing.counted" inputmode="decimal" placeholder="0,00" value="${escapeHtml(
            state.closing.counted
          )}" /></label>
          <div class="cx-change ${difference < 0 ? "is-missing" : ""}" aria-live="polite"><span>Diferença</span><strong class="cx-num">${
      hasCounted ? `${difference > 0 ? "+ " : difference < 0 ? "− " : ""}${escapeHtml(money(reais(Math.abs(difference))))}` : "—"
    }</strong></div>
          <label class="cx-field"><span>Observação ${hasCounted && difference !== 0 ? "(obrigatória: há diferença)" : "(opcional)"}</span><textarea class="cx-input" rows="3" data-cx-field="closing.notes" maxlength="600">${escapeHtml(
      state.closing.notes
    )}</textarea></label>
          ${needsNotes ? '<p class="cx-hint is-error">Explique a diferença para fechar o caixa.</p>' : ""}
          <div class="cx-row-wrap">
            <button class="cx-btn" type="button" data-cx-action="print">Imprimir relatório do turno</button>
            <button class="cx-btn cx-btn-primary" type="submit" ${canClose ? "" : "disabled"}>${
      state.busy === "close-register" ? "Fechando…" : openTabs ? "Fechar caixa (há mesas abertas)" : "Fechar caixa"
    }</button>
          </div>
        </form>
      </div>`;
  };

  /* ---------- comprovante ---------- */

  const renderReceiptModal = () => {
    const tab = state.receiptTab;
    if (!tab) return "";
    return `
      <div class="cx-overlay" data-cx-overlay>
        <div class="cx-dialog cx-print-area" role="dialog" aria-modal="true" aria-labelledby="cx-receipt-title">
          <div class="cx-modal-head"><h2 id="cx-receipt-title">Mesa liberada</h2><button class="cx-btn cx-btn-ghost cx-no-print" type="button" data-cx-action="close-modal">Esc</button></div>
          <div class="cx-modal-body">
            <p class="cx-muted">Comprovante não fiscal · ${escapeHtml(tab.publicId || "")} · ${escapeHtml(timeOf(tab.closedAt || new Date()))}</p>
            <div class="cx-list">${(tab.items || [])
              .filter((item) => item.status !== "CANCELLED")
              .map(
                (item) =>
                  `<div class="cx-list-row"><span>${escapeHtml(item.quantity)}× ${escapeHtml(item.productName)}</span><strong class="cx-num">${escapeHtml(
                    money(item.totalPrice)
                  )}</strong></div>`
              )
              .join("")}
              <div class="cx-list-row"><span>Desconto</span><strong class="cx-num">${escapeHtml(money(tab.discountAmount || 0))}</strong></div>
              <div class="cx-list-row"><span>Serviço</span><strong class="cx-num">${escapeHtml(money(tab.serviceChargeAmount || 0))}</strong></div>
              <div class="cx-list-row is-strong"><span>Total</span><strong class="cx-num">${escapeHtml(money(tab.totalAmount || 0))}</strong></div>
              ${(tab.payments || [])
                .map(
                  (payment) =>
                    `<div class="cx-list-row"><span>${escapeHtml(PAYMENT_LABELS[payment.method] || payment.method)}${
                      Number(payment.changeAmount || 0) > 0 ? ` · troco ${escapeHtml(money(payment.changeAmount))}` : ""
                    }</span><strong class="cx-num">${escapeHtml(money(payment.amount))}</strong></div>`
                )
                .join("")}
            </div>
            <p class="cx-hint">Documento sem valor fiscal · emitido pelo INOVAS Food</p>
          </div>
          <div class="cx-modal-actions cx-no-print">
            <button class="cx-btn" type="button" data-cx-action="print-receipt">Imprimir comprovante</button>
            <button class="cx-btn cx-btn-primary" type="button" data-cx-action="close-modal" data-cx-confirm>Voltar ao Salão <span class="cx-kbd">Enter</span></button>
          </div>
        </div>
      </div>`;
  };

  /* ---------- impressão térmica 80 mm (preto e branco) ---------- */

  const ticketMoney = (centsValue) => ui.formatMoney(reais(centsValue)).replace("R$ ", "");

  const ticketDate = (value) => {
    const date = new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return "--";
    const pad = (number) => String(number).padStart(2, "0");
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  /* Valores do cupom: conta aberta usa a tela; conta fechada usa o servidor. */
  const ticketValues = (tab, { closed = false } = {}) => {
    const items = (closed ? tab.items || [] : displayItems(tab)).filter((item) => item.status !== "CANCELLED");
    const subtotal = items.reduce((sum, item) => sum + cents(item.totalPrice), 0);
    if (closed || tab.status !== "OPEN") {
      return {
        items,
        subtotal,
        service: cents(tab.serviceChargeAmount),
        discount: cents(tab.discountAmount),
        total: cents(tab.totalAmount) || subtotal,
        rate: Number(tab.serviceChargeRate || 0),
      };
    }
    const bill = billValues(tab);
    return {
      items,
      subtotal,
      service: bill.service,
      discount: bill.discount,
      total: Math.max(0, subtotal - bill.discount + bill.service),
      rate: bill.totals.serviceRate,
    };
  };

  const buildTicketHtml = (tab, { title = "CONTA", closed = false } = {}) => {
    const profile = state.context.printProfile || {};
    const table = getTableOf(tab) || tab.table;
    const values = ticketValues(tab, { closed });
    const name = profile.restaurantName || state.context.restaurantName || "Restaurante";
    const cityLine = [profile.cityLine, profile.phone].filter(Boolean).join(" - ");
    return `
      <div class="tk-head">
        <div class="tk-name">${escapeHtml(name)}</div>
        ${profile.addressLine ? `<div>${escapeHtml(profile.addressLine)}</div>` : ""}
        ${cityLine ? `<div>${escapeHtml(cityLine)}</div>` : ""}
      </div>
      <div class="tk-rule"></div>
      <div class="tk-table">Mesa : ${escapeHtml(table?.number ? two(table.number) : table?.label || "--")}</div>
      <div class="tk-center">Abertura ${escapeHtml(ticketDate(tab.openedAt))}</div>
      <div class="tk-center tk-small">${escapeHtml(title)}${tab.publicId ? ` · ${escapeHtml(tab.publicId)}` : ""} · ${escapeHtml(peopleLabel(tab.guestCount || 1))}</div>
      <div class="tk-rule"></div>
      <div class="tk-row tk-cols"><span>QTD</span><span>DESCRIÇÃO</span><span>UNIT</span><span>TOTAL</span></div>
      <div class="tk-rule"></div>
      ${values.items
        .map(
          (item) => `<div class="tk-row tk-item"><span>${escapeHtml(item.quantity)}</span><span>${escapeHtml(item.productName)}${
            item.notes ? `<em>${escapeHtml(item.notes)}</em>` : ""
          }</span><span>${escapeHtml(ticketMoney(cents(item.unitPrice)))}</span><span>${escapeHtml(ticketMoney(cents(item.totalPrice)))}</span></div>`
        )
        .join("")}
      <div class="tk-rule"></div>
      <div class="tk-line"><span>SUBTOTAL</span><span>${escapeHtml(ticketMoney(values.subtotal))}</span></div>
      ${values.discount ? `<div class="tk-line"><span>DESCONTO</span><span>- ${escapeHtml(ticketMoney(values.discount))}</span></div>` : ""}
      <div class="tk-line tk-total"><span>TOTAL</span><span>R$ ${escapeHtml(ticketMoney(values.total))}</span></div>
      ${
        values.service
          ? `<div class="tk-line"><span>${loadPrinter()?.paper === "80" ? "TAXA DE SERVIÇO" : "SERVIÇO"} (${escapeHtml(values.rate)}%)</span><span>R$ ${escapeHtml(ticketMoney(values.service))}</span></div>`
          : ""
      }
      ${
        closed && (tab.payments || []).length
          ? `<div class="tk-rule"></div>${(tab.payments || [])
              .map(
                (payment) =>
                  `<div class="tk-line"><span>${escapeHtml((PAYMENT_LABELS[payment.method] || payment.method).toUpperCase())}</span><span>${escapeHtml(
                    ticketMoney(cents(payment.amount))
                  )}</span></div>${
                    Number(payment.changeAmount || 0) > 0
                      ? `<div class="tk-line"><span>TROCO</span><span>${escapeHtml(ticketMoney(cents(payment.changeAmount)))}</span></div>`
                      : ""
                  }`
              )
              .join("")}`
          : ""
      }
      <div class="tk-rule"></div>
      <div class="tk-center">Obrigado pela preferência!</div>
      <svg class="tk-icon" viewBox="0 0 48 64" aria-hidden="true"><path d="M8 4v18a6 6 0 006 6v32M14 4v18M20 4v18a6 6 0 01-6 6M38 4c-6 4-8 14-8 24h8v32" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <div class="tk-center tk-small">Documento sem valor fiscal</div>`;
  };

  /* ---------- impressora deste computador ----------
     O navegador não deixa um site listar as impressoras do Windows. Por isso:
     (1) a largura do papel fica salva neste computador (a térmica é ligada a
     ele); (2) quando o navegador permite, "Reconhecer impressora" lê o nome da
     impressora USB e sugere o papel; (3) a impressão sai já formatada e a janela
     do Windows abre com o tamanho do papel certo. */
  const PRINTER_KEY = "inovas_cx_printer_v1";
  const PAPER_SIZES = Object.freeze({
    58: { page: 58, width: 48, label: "58 mm" },
    80: { page: 80, width: 72, label: "80 mm" },
  });

  let printerInMemory = null;

  const loadPrinter = () => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(PRINTER_KEY) || "null");
      if (saved && PAPER_SIZES[saved.paper]) return saved;
    } catch {}
    return printerInMemory;
  };

  const savePrinter = (config) => {
    printerInMemory = config;
    try {
      window.localStorage.setItem(PRINTER_KEY, JSON.stringify(config));
      return true;
    } catch {
      return false;
    }
  };

  const guessPaper = (name = "") => {
    const text = String(name).toLowerCase();
    if (/\b58\b|58mm|mini|pt-?210|mtp|goojprt|i9 ?58|zj-?58|pos-?58/.test(text)) return "58";
    if (/\b80\b|80mm|tm-?t20|tm-?t88|mp-?4200|i7|i9|pos-?80|zj-?80|bematech/.test(text)) return "80";
    return "";
  };

  // O site precisa estar autorizado a usar USB (cabeçalho Permissions-Policy).
  const usbAllowed = () => {
    if (!navigator.usb) return false;
    const policy = document.permissionsPolicy || document.featurePolicy;
    try {
      return policy?.allowsFeature ? policy.allowsFeature("usb") : true;
    } catch {
      return false;
    }
  };

  const usbName = (device) =>
    [device?.manufacturerName, device?.productName].filter(Boolean).join(" ").trim() || "Impressora USB";

  const applyDetected = (device) => {
    const name = usbName(device);
    const paper = guessPaper(name);
    state.printerDraft.detected = name;
    if (paper) state.printerDraft.paper = paper;
    if (!state.printerDraft.label) state.printerDraft.label = name;
    state.printerDraft.message = paper
      ? `Reconhecida: ${name}. Papel sugerido: ${PAPER_SIZES[paper].label}.`
      : `Reconhecida: ${name}. Confira a largura do papel abaixo.`;
  };

  // Ao abrir o modal: se a impressora já foi autorizada antes, reconhece sem perguntar.
  const recognizeKnownPrinter = async () => {
    if (!usbAllowed() || !navigator.usb?.getDevices) return;
    try {
      const devices = await navigator.usb.getDevices();
      if (devices.length && !state.printerDraft.detected) {
        applyDetected(devices[0]);
        render();
      }
    } catch {}
  };

  const detectPrinter = async () => {
    if (!usbAllowed() || !navigator.usb?.requestDevice) {
      state.printerDraft.message =
        "Este navegador não permite reconhecer a impressora pelo USB. Escolha o papel abaixo; a impressora é escolhida na janela de impressão.";
      render();
      return;
    }
    state.printerDraft.detecting = true;
    state.printerDraft.message = "Escolha a impressora na janela que abriu.";
    render();
    try {
      let device;
      try {
        device = await navigator.usb.requestDevice({ filters: [{ classCode: 7 }] });
      } catch (error) {
        if (error?.name !== "NotFoundError") throw error;
        device = await navigator.usb.requestDevice({ filters: [] });
      }
      applyDetected(device);
    } catch (error) {
      state.printerDraft.message =
        error?.name === "NotFoundError"
          ? "Nenhuma impressora USB escolhida. Se ela for de rede ou Bluetooth, só escolha o papel abaixo."
          : error?.name === "SecurityError"
            ? "O navegador bloqueou o acesso ao USB. Escolha o papel abaixo."
            : "Não foi possível reconhecer a impressora. Escolha o papel abaixo.";
    } finally {
      state.printerDraft.detecting = false;
      render();
    }
  };

  const openPrinterModal = (pending = null) => {
    const current = loadPrinter();
    state.pendingPrint = pending;
    state.printerDraft = {
      paper: current?.paper || "58",
      label: current?.label || "",
      detected: current?.detected || "",
      message: current ? "" : "Primeira impressão neste computador: configure a impressora uma vez.",
      detecting: false,
    };
    state.modal = "printer";
    render();
    void recognizeKnownPrinter();
  };

  const renderPrinterModal = () => {
    const draft = state.printerDraft;
    const canDetect = usbAllowed() && Boolean(navigator.usb?.requestDevice);
    return `
      <div class="cx-overlay" data-cx-overlay>
        <form class="cx-dialog cx-printer-dialog" role="dialog" aria-modal="true" aria-labelledby="cx-printer-title" data-cx-form="printer" novalidate>
          <div class="cx-modal-head"><h2 id="cx-printer-title">Impressora da comanda</h2><button class="cx-btn cx-btn-ghost" type="button" data-cx-action="close-modal">Esc</button></div>
          <div class="cx-modal-body">
            <p class="cx-muted">Configuração deste computador. A comanda, a conta e o comprovante saem no tamanho do papel escolhido.</p>
            <div class="cx-printer-detect">
              <button class="cx-btn" type="button" data-cx-action="printer-detect" ${!canDetect || draft.detecting ? "disabled" : ""}>${
                draft.detecting ? "Reconhecendo…" : "Reconhecer impressora USB"
              }</button>
              ${draft.detected ? `<span class="cx-printer-found">${escapeHtml(draft.detected)}</span>` : ""}
            </div>
            ${draft.message ? `<p class="cx-printer-message" role="status">${escapeHtml(draft.message)}</p>` : ""}
            <div class="cx-field"><span>Largura do papel</span>
              <div class="cx-segmented" role="group" aria-label="Largura do papel">
                <button type="button" data-cx-set="printerDraft.paper" data-cx-value="58" aria-pressed="${draft.paper === "58"}">58 mm · mais comum</button>
                <button type="button" data-cx-set="printerDraft.paper" data-cx-value="80" aria-pressed="${draft.paper === "80"}">80 mm</button>
              </div>
            </div>
            <label class="cx-field"><span>Nome para lembrar (opcional)</span><input class="cx-input" data-cx-field="printerDraft.label" maxlength="60" placeholder="Ex.: Térmica do caixa" value="${escapeHtml(
              draft.label
            )}" /></label>
            <p class="cx-muted cx-printer-tip">Dica: deixe a térmica como impressora padrão do Windows. Assim a janela de impressão já abre nela e no tamanho de ${escapeHtml(
              PAPER_SIZES[draft.paper].label
            )}.</p>
          </div>
          <div class="cx-modal-actions">
            <button class="cx-btn" type="button" data-cx-action="printer-test">Imprimir teste</button>
            <button class="cx-btn cx-btn-primary" type="submit" data-cx-confirm>${state.pendingPrint ? "Salvar e imprimir" : "Salvar"}</button>
          </div>
        </form>
      </div>`;
  };

  const buildTestTicketHtml = (paper) => {
    const size = PAPER_SIZES[paper];
    const chars = paper === "58" ? 32 : 48;
    const ruler = "1234567890".repeat(5).slice(0, chars);
    const name = state.context.printProfile?.restaurantName || state.context.restaurantName || "Restaurante";
    return `
      <div class="tk-head"><div class="tk-name">${escapeHtml(name)}</div></div>
      <div class="tk-rule"></div>
      <div class="tk-table">TESTE</div>
      <div class="tk-center">Papel de ${escapeHtml(size.label)}</div>
      <div class="tk-rule"></div>
      <div class="tk-center tk-ruler">${escapeHtml(ruler)}</div>
      <div class="tk-line"><span>ESQUERDA</span><span>DIREITA</span></div>
      <div class="tk-line tk-total"><span>TOTAL</span><span>R$ 0,00</span></div>
      <div class="tk-rule"></div>
      <div class="tk-center tk-small">Se a régua e as palavras ESQUERDA e DIREITA saíram inteiras, o papel está certo.</div>`;
  };

  const printHtml = (html, paper) => {
    const size = PAPER_SIZES[paper] || PAPER_SIZES[58];
    let sheet = document.getElementById("cx-print-ticket");
    if (!sheet) {
      sheet = document.createElement("div");
      sheet.id = "cx-print-ticket";
      sheet.setAttribute("aria-hidden", "true");
      document.body.appendChild(sheet);
    }
    sheet.dataset.paper = String(size.page);
    sheet.innerHTML = html;
    // O tamanho da página vai junto, para a janela do Windows abrir no papel certo.
    let pageStyle = document.getElementById("cx-print-page");
    if (!pageStyle) {
      pageStyle = document.createElement("style");
      pageStyle.id = "cx-print-page";
      document.head.appendChild(pageStyle);
    }
    pageStyle.textContent = `@media print { @page { size: ${size.page}mm auto; margin: 0; } }`;
    document.body.classList.add("cx-printing");
    const cleanup = () => {
      document.body.classList.remove("cx-printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    window.setTimeout(cleanup, 1500);
  };

  const printTicket = (tab, options = {}) => {
    const printer = loadPrinter();
    if (!printer) {
      // Reconhece/configura a impressora antes da primeira impressão neste computador.
      openPrinterModal({ tab, options });
      return;
    }
    printHtml(buildTicketHtml(tab, options), printer.paper);
  };

  /* ---------- render ---------- */

  const captureFocus = () => {
    const active = document.activeElement;
    if (!active || !state.root?.contains(active)) return null;
    const key = active.getAttribute("data-cx-field") || active.getAttribute("data-cx-note-input");
    if (!key) return null;
    return { key, start: active.selectionStart, end: active.selectionEnd };
  };

  const restoreFocus = (focus) => {
    let target = null;
    if (focus) {
      target =
        state.root.querySelector(`[data-cx-field="${focus.key}"]`) ||
        state.root.querySelector(`[data-cx-note-input="${focus.key}"]`);
    }
    if (!target && !state.modal) target = state.root.querySelector("[data-cx-autofocus]");
    if (!target && state.modal) target = state.root.querySelector(".cx-dialog [data-cx-confirm]:not([disabled]), .cx-dialog input");
    if (!target || target.disabled) return;
    target.focus({ preventScroll: true });
    if (focus && typeof target.setSelectionRange === "function" && focus.start !== null && focus.start !== undefined) {
      try {
        target.setSelectionRange(focus.start, focus.end);
      } catch {
        // tipo de campo sem seleção
      }
    }
  };

  const render = () => {
    if (!state.root) return;
    if (state.loading && !state.snapshot) {
      state.root.innerHTML = skeleton();
      return;
    }
    const focus = captureFocus();
    const snapshot = getSnapshot();
    let content;
    if (state.view === "opening" || (!snapshot.register && state.view === "floor")) {
      content = renderOpening();
    } else if (state.view === "closing") {
      content = renderClosing();
    } else if (state.screen === "pdv") {
      content = renderPdv();
    } else if (state.screen === "counter") {
      content = renderCounter();
    } else if (state.screen === "payment") {
      content = renderPayment();
    } else {
      content = renderSalao();
    }
    const modal =
      state.modal === "open-tab"
        ? renderOpenTabModal()
        : state.modal === "people"
          ? renderPeopleModal()
          : state.modal === "movement"
            ? renderMovementModal()
            : state.modal === "receipt"
              ? renderReceiptModal()
              : state.modal === "printer"
                ? renderPrinterModal()
                : state.modal === "launch"
                  ? renderLaunchModal()
                  : "";
    const showTopFeedback =
      state.view === "opening" || (!snapshot.register && state.view === "floor");
    state.root.innerHTML = `<div class="cx-root cash-v3" data-cx-screen="${escapeHtml(
      state.view === "floor" ? state.screen : state.view
    )}">${showTopFeedback ? feedback() : ""}${content}${modal}</div>`;
    restoreFocus(focus);
  };

  const renderProductsOnly = () => {
    const container = state.root?.querySelector("[data-cx-products]");
    if (container) container.innerHTML = renderProducts();
  };

  /* ---------- ações ---------- */

  const setPath = (path, value) => {
    const [group, key] = path.split(".");
    if (key) state[group][key] = value;
    else state[group] = value;
  };
  const getPath = (path) => {
    const [group, key] = path.split(".");
    return key ? state[group][key] : state[group];
  };

  const goSalao = () => {
    state.optimistic = [];
    state.qtyDelta = {};
    state.screen = "salao";
    state.modal = "";
    state.pdv.query = "";
    state.pdv.noteItemId = "";
    render();
  };

  const openTabScreen = (tab) => {
    state.selectedTabId = tab.id;
    state.pdv.query = "";
    state.pdv.multiplier = 1;
    state.pdv.noteItemId = "";
    if (tab.status === "AWAITING_PAYMENT") {
      resetPayment(tab);
      state.screen = "payment";
    } else {
      state.screen = "pdv";
    }
    state.modal = "";
    render();
  };

  const resetPayment = (tab) => {
    state.payment = { mode: "equal", draft: [], method: "CASH", entry: "", shareIndex: 0, splitCount: null };
    state.bill = {
      discount: tab && Number(tab.discountAmount) ? String(tab.discountAmount).replace(".", ",") : "",
      serviceEnabled: tab ? tab.serviceChargeEnabled !== false : true,
    };
  };

  const startNewTab = (tableId = "") => {
    if (!hasPermission("cash_register_open_tab")) return;
    state.openTab = {
      tableId,
      guests: 0,
      customerName: "",
      waiterName: state.context.adminName || "",
    };
    state.modal = "open-tab";
    render();
  };

  const openTableByNumber = () => {
    const number = Number(String(state.tableSearch).trim());
    const table = getSnapshot().tables.find((entry) => Number(entry.number) === number);
    state.tableSearch = "";
    if (!table) {
      setMessage(`Mesa ${String(number).padStart(2, "0")} não existe neste turno.`, "error");
      render();
      return;
    }
    if (table.activeTab) openTabScreen(getSnapshot().activeTabs.find((tab) => tab.id === table.activeTab.id) || table.activeTab);
    else if (table.status === "FREE") startNewTab(table.id);
  };

  const pendingMatch = (tab, productId) =>
    (tab.items || []).find(
      (item) => item.status === "PENDING" && item.productId === productId && !String(item.notes || "").trim()
    );

  /* Lançamentos com UI otimista. A tela mostra na hora (state.optimistic e
     state.qtyDelta) e as gravações vão para o servidor uma de cada vez, sempre
     calculadas sobre o estado mais recente do servidor. Se falhar, desfaz. */
  let mutationChain = Promise.resolve();
  let optimisticSeq = 0;
  const enqueue = (job) => {
    mutationChain = mutationChain.then(job, job);
    return mutationChain;
  };

  const runMutation = async (action, body) => {
    try {
      const payload = await fetchJson(`/api/admin/cash-register/${action}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      applySnapshot(payload);
      return payload;
    } catch (error) {
      if (error.status === 401) window.location.href = "/admin/login.html";
      throw error;
    }
  };

  const addProduct = async (productId, quantity) => {
    if (state.screen === "counter") {
      counterAdd(productId, quantity);
      return;
    }
    const tab = getTab();
    const product = getCatalogItems().find((item) => item.id === productId);
    if (!tab || !product || tab.status !== "OPEN") return;
    const qty = ui.clampInteger(quantity, { min: 1, max: 99 });
    const entry = { key: ++optimisticSeq, productId, productName: product.name, unitPrice: product.price, qty };
    state.optimistic.push(entry);
    state.pdv.multiplier = 1;
    render();
    await enqueue(async () => {
      try {
        const fresh = getTab();
        if (!fresh || fresh.status !== "OPEN") throw new Error("A comanda não está mais aberta.");
        const existing = pendingMatch(fresh, productId);
        const payload = existing
          ? { itemId: existing.id, quantity: Math.min(99, Number(existing.quantity) + qty), notes: existing.notes || "" }
          : { tabId: fresh.id, productId, quantity: qty };
        state.optimistic = state.optimistic.filter((item) => item.key !== entry.key);
        await runMutation(existing ? "update-item" : "add-item", payload);
      } catch (error) {
        state.optimistic = state.optimistic.filter((item) => item.key !== entry.key);
        setMessage(`Não foi possível lançar ${product.name}; o item foi desfeito. ${error.message}`, "error");
      }
      render();
    });
  };

  const changeQuantity = async (itemId, delta) => {
    const tab = getTab();
    const item = tab?.items.find((entry) => entry.id === itemId);
    if (!item || item.status !== "PENDING") return;
    state.qtyDelta[itemId] = (state.qtyDelta[itemId] || 0) + delta;
    render();
    await enqueue(async () => {
      const pendingDelta = state.qtyDelta[itemId] || 0;
      delete state.qtyDelta[itemId];
      if (!pendingDelta) return;
      try {
        const fresh = getTab()?.items.find((entry) => entry.id === itemId);
        if (!fresh) return;
        const next = Number(fresh.quantity) + pendingDelta;
        if (next < 1) await runMutation("remove-item", { itemId });
        else await runMutation("update-item", { itemId, quantity: Math.min(99, next), notes: fresh.notes || "" });
      } catch (error) {
        setMessage(`Não foi possível alterar a quantidade; a alteração foi desfeita. ${error.message}`, "error");
      }
      render();
    });
  };

  const saveNote = async (itemId, notes) => {
    const tab = getTab();
    const item = tab?.items.find((entry) => entry.id === itemId);
    if (!item || item.status !== "PENDING" || String(item.notes || "") === notes) return;
    await postAction("update-item", { itemId, quantity: item.quantity, notes }, "update-item", { quiet: true });
  };

  const quickAdd = async () => {
    const parsed = ui.parseQuickEntry(state.pdv.query);
    if (!parsed.query) return;
    const matches = findProductsForQuery(parsed.query);
    if (!matches.length) {
      setMessage(`Nenhum produto com o código ou nome “${parsed.query}”.`, "error");
      render();
      return;
    }
    if (matches.length > 1 && !/^\d+$/.test(parsed.query)) {
      renderProductsOnly();
      return;
    }
    state.pdv.query = "";
    await addProduct(matches[0].id, parsed.quantity);
  };

  const addPaymentEntry = () => {
    const tab = getTab();
    if (!tab || tab.status !== "AWAITING_PAYMENT") return;
    const info = paymentState(tab);
    const due = dueNow(tab, info);
    if (!due) return;
    const entry = { method: state.payment.method, amount: reais(due) };
    if (entry.method === "CASH") {
      const received = cents(state.payment.entry) || due;
      if (received < due) {
        setMessage("O valor recebido é menor que o devido.", "error");
        render();
        return;
      }
      entry.receivedAmount = reais(received);
    }
    if (state.payment.mode === "equal") entry.shareIndex = state.payment.shareIndex;
    state.payment.draft.push(entry);
    state.payment.entry = "";
    if (state.payment.mode === "equal") {
      const paidShares = new Set(state.payment.draft.map((item) => item.shareIndex));
      const next = info.shares.findIndex((_, index) => !paidShares.has(index));
      state.payment.shareIndex = next === -1 ? 0 : next;
    }
    setMessage("");
    render();
  };

  const finishPayment = async () => {
    const tab = getTab();
    if (!tab) return;
    const tabSnapshot = JSON.parse(JSON.stringify(tab));
    const result = await postAction(
      "confirm-payment",
      {
        tabId: tab.id,
        idempotencyKey: newIdempotencyKey(),
        payments: state.payment.draft.map((entry) => ({
          method: entry.method,
          amount: Number(entry.amount),
          ...(entry.method === "CASH" ? { receivedAmount: Number(entry.receivedAmount) } : {}),
        })),
      },
      "confirm-payment"
    );
    if (result) {
      const recent = (getSnapshot().recentTabs || []).find((entry) => entry.id === tabSnapshot.id);
      state.receiptTab = recent || { ...tabSnapshot, payments: state.payment.draft };
      resetPayment(null);
      state.selectedTabId = "";
      state.screen = "salao";
      state.modal = "receipt";
      setMessage(`Mesa ${tableNumber(getTableOf(tabSnapshot))} liberada · 0 pessoas.`, "success");
      render();
    }
  };

  const handleAction = async (action, element) => {
    if (action === "close-modal") {
      state.modal = "";
      state.receiptTab = null;
      render();
    } else if (action === "use-last-count") {
      state.opening.tableCount = Math.min(MAX_TABLES, Math.max(1, Number(getSnapshot().lastClosedRegister?.tableCount || 12)));
      render();
    } else if (action === "new-tab") {
      startNewTab();
    } else if (action === "go-pdv") {
      state.modal = "launch";
      render();
    } else if (action === "launch-table") {
      state.modal = "";
      const tab = getTab() || getSnapshot().activeTabs.find((entry) => entry.status === "OPEN");
      if (tab) openTabScreen(tab);
      else startNewTab();
    } else if (action === "launch-pickup" || action === "launch-delivery") {
      state.modal = "";
      state.counter = newCounter(action === "launch-delivery" ? "delivery" : "pickup");
      state.pdv.query = "";
      state.pdv.multiplier = 1;
      state.screen = "counter";
      render();
    } else if (action === "counter-clear") {
      if (state.counter) state.counter.items = [];
      render();
    } else if (action === "counter-send") {
      const counter = state.counter;
      if (!counter || counterProblems().length || state.busy) return;
      const result = await postAction(
        "counter-order",
        {
          mode: counter.mode,
          customerName: counter.name.trim(),
          customerPhone: counter.phone.trim(),
          addressLine: counter.line.trim(),
          addressNumber: counter.number.trim(),
          addressNeighborhood: counter.neighborhood.trim(),
          addressComplement: counter.complement.trim(),
          addressReference: counter.reference.trim(),
          deliveryFee: counter.mode === "delivery" ? reais(cents(counter.fee)) : 0,
          paymentMethod: counter.payment,
          cashAmount: counter.payment === "dinheiro" && cents(counter.cashFor) > 0 ? reais(cents(counter.cashFor)) : 0,
          notes: counter.notes.trim(),
          items: counter.items.map((item) => ({ productId: item.productId, quantity: item.quantity, notes: item.notes })),
        },
        "counter-order"
      );
      if (result) {
        state.counter = null;
        state.screen = "salao";
        state.pdv.query = "";
        render();
      }
    } else if (action === "open-movement") {
      state.movement = { type: "WITHDRAWAL", amount: "", reason: "" };
      state.modal = "movement";
      render();
    } else if (action === "open-printer") {
      openPrinterModal(null);
    } else if (action === "printer-detect") {
      await detectPrinter();
    } else if (action === "printer-test") {
      printHtml(buildTestTicketHtml(state.printerDraft.paper), state.printerDraft.paper);
    } else if (action === "add-table") {
      await postAction("add-table", {}, "add-table");
    } else if (action === "back-salao") {
      goSalao();
    } else if (action === "back-pdv") {
      state.screen = "pdv";
      render();
    } else if (action === "edit-people") {
      const tab = getTab();
      if (!tab) return;
      state.people = { guests: Number(tab.guestCount || 1), customerName: tab.customerName || "" };
      state.modal = "people";
      render();
    } else if (action === "toggle-note") {
      const itemId = element.dataset.cxItem;
      state.pdv.noteItemId = state.pdv.noteItemId === itemId ? "" : itemId;
      render();
    } else if (action === "clear-pending") {
      const tab = getTab();
      const pending = (tab?.items || []).filter((item) => item.status === "PENDING");
      if (!pending.length || !window.confirm(`Remover os ${pending.length} itens que ainda não foram para a cozinha?`)) return;
      for (const item of pending) {
        // eslint-disable-next-line no-await-in-loop
        await postAction("remove-item", { itemId: item.id }, "remove-item", { quiet: true });
      }
    } else if (action === "send-order") {
      await mutationChain;
      const tab = getTab();
      if (tab && (tab.items || []).some((item) => item.status === "PENDING")) {
        await postAction("send-order", { tabId: tab.id }, "send-order");
      }
    } else if (action === "go-payment") {
      await mutationChain;
      const tab = getTab();
      if (!tab) return;
      resetPayment(tab);
      state.screen = "payment";
      render();
    } else if (action === "begin-closing") {
      const tab = getTab();
      if (!tab) return;
      const result = await postAction(
        "begin-closing",
        {
          tabId: tab.id,
          discountAmount: reais(cents(state.bill.discount)),
          serviceChargeEnabled: state.bill.serviceEnabled,
          serviceChargeRate: tab.serviceChargeRate,
        },
        "begin-closing"
      );
      if (result) {
        state.payment = { mode: "equal", draft: [], method: "CASH", entry: "", shareIndex: 0, splitCount: null };
        render();
      }
    } else if (action === "reopen-tab") {
      const tab = getTab();
      if (!tab) return;
      const result = await postAction("reopen-tab", { tabId: tab.id }, "reopen-tab");
      if (result) {
        state.screen = "pdv";
        render();
      }
    } else if (action === "add-payment") {
      addPaymentEntry();
    } else if (action === "finish-payment") {
      await finishPayment();
    } else if (action === "show-open-tables") {
      state.tableFilter = "OCCUPIED";
      setView("floor");
    } else if (action === "print") {
      window.print();
    } else if (action === "print-tab" || action === "print-bill") {
      const tab = getTab();
      if (tab) printTicket(tab, { title: action === "print-bill" ? "CONTA" : "COMANDA" });
    } else if (action === "print-receipt") {
      if (state.receiptTab) printTicket(state.receiptTab, { title: "COMPROVANTE", closed: true });
    } else if (action === "refresh") {
      await load({ force: true });
    }
  };

  const handleClick = async (event) => {
    const target = event.target;
    if (target.matches("[data-cx-overlay]")) {
      state.modal = "";
      state.receiptTab = null;
      render();
      return;
    }
    const viewButton = target.closest("[data-cx-view]");
    if (viewButton) {
      setView(viewButton.dataset.cxView);
      return;
    }
    const stepButton = target.closest("[data-cx-step-field]");
    if (stepButton && !stepButton.disabled) {
      const field = stepButton.dataset.cxStepField;
      const tabGuests = Math.max(1, Number(getTab()?.guestCount || 1));
      const limits =
        field === "opening.tableCount"
          ? { min: 1, max: MAX_TABLES }
          : field === "openTab.guests"
            ? { min: 0, max: MAX_GUESTS }
            : field === "payment.splitCount"
              ? { min: 1, max: tabGuests }
              : { min: 1, max: MAX_GUESTS };
      const current = field === "payment.splitCount" && getTab() ? splitCountOf(getTab()) : Number(getPath(field));
      setPath(field, ui.clampInteger(current + Number(stepButton.dataset.cxDelta), limits));
      if (field === "payment.splitCount") {
        state.payment.shareIndex = 0;
        state.payment.entry = "";
      }
      render();
      return;
    }
    const setButton = target.closest("[data-cx-set]");
    if (setButton && !setButton.disabled) {
      const path = setButton.dataset.cxSet;
      const raw = setButton.dataset.cxValue;
      const numeric = ["opening.tableCount", "openTab.guests", "pdv.multiplier", "payment.shareIndex", "payment.splitCount"].includes(path);
      setPath(path, numeric ? Number(raw) : raw);
      if (path === "payment.splitCount") state.payment.shareIndex = 0;
      if (path === "payment.method" || path === "payment.mode" || path === "payment.shareIndex" || path === "payment.splitCount") state.payment.entry = "";
      if (path === "pdv.categoryId") state.pdv.query = "";
      render();
      return;
    }
    const filter = target.closest("[data-cx-filter]");
    if (filter) {
      state.tableFilter = filter.dataset.cxFilter;
      render();
      return;
    }
    const tableButton = target.closest("[data-cx-table]");
    if (tableButton) {
      const table = getSnapshot().tables.find((entry) => entry.id === tableButton.dataset.cxTable);
      if (!table) return;
      if (table.activeTab) {
        openTabScreen(getSnapshot().activeTabs.find((tab) => tab.id === table.activeTab.id) || table.activeTab);
      } else if (table.status === "FREE") {
        startNewTab(table.id);
      }
      return;
    }
    const product = target.closest("[data-cx-product]");
    if (product) {
      await addProduct(product.dataset.cxProduct, state.pdv.multiplier);
      return;
    }
    const counterQty = target.closest("[data-cx-counter-qty]");
    if (counterQty && state.counter) {
      const item = state.counter.items.find((entry) => String(entry.key) === counterQty.dataset.cxCounterQty);
      if (item) {
        item.quantity = Math.max(0, Math.min(99, item.quantity + Number(counterQty.dataset.cxDelta)));
        state.counter.items = state.counter.items.filter((entry) => entry.quantity > 0);
        render();
      }
      return;
    }
    const qty = target.closest("[data-cx-qty]");
    if (qty) {
      await changeQuantity(qty.dataset.cxQty, Number(qty.dataset.cxDelta));
      return;
    }
    const noteChip = target.closest("[data-cx-note-chip]");
    if (noteChip) {
      const tab = getTab();
      const item = tab?.items.find((entry) => entry.id === noteChip.dataset.cxItem);
      if (!item) return;
      const note = noteChip.dataset.cxNoteChip;
      const parts = String(item.notes || "")
        .split(" · ")
        .map((part) => part.trim())
        .filter(Boolean);
      const next = parts.includes(note) ? parts.filter((part) => part !== note) : [...parts, note];
      await saveNote(item.id, next.join(" · "));
      return;
    }
    const removePayment = target.closest("[data-cx-remove-payment]");
    if (removePayment) {
      state.payment.draft.splice(Number(removePayment.dataset.cxRemovePayment), 1);
      render();
      return;
    }
    const action = target.closest("[data-cx-action]");
    if (action && !action.disabled) await handleAction(action.dataset.cxAction, action);
  };

  const handleInput = (event) => {
    const field = event.target.closest("[data-cx-field]");
    if (field) {
      setPath(field.dataset.cxField, field.value);
      if (field.dataset.cxField === "pdv.query") {
        renderProductsOnly();
        return;
      }
      if (field.dataset.cxField === "tableSearch") return;
      render();
    }
  };

  const handleChange = async (event) => {
    const toggle = event.target.closest("[data-cx-toggle]");
    if (toggle) {
      setPath(toggle.dataset.cxToggle, toggle.checked);
      render();
      return;
    }
    const noteInput = event.target.closest("[data-cx-note-input]");
    if (noteInput) await saveNote(noteInput.dataset.cxNoteInput, noteInput.value.trim());
  };

  const handleSubmit = async (event) => {
    const form = event.target.closest("[data-cx-form]");
    if (!form) return;
    event.preventDefault();
    const type = form.dataset.cxForm;
    if (type === "open-register") {
      const result = await postAction(
        "open",
        {
          openingAmount: reais(cents(state.opening.openingAmount)),
          serviceChargeRate: Number(String(state.opening.serviceChargeRate).replace(",", ".")) || 0,
          tableCount: state.opening.tableCount,
          notes: "",
        },
        "open-register"
      );
      if (result && getSnapshot().register) {
        state.opening.tableCount = null;
        setView("floor");
      }
    } else if (type === "open-tab") {
      const draft = state.openTab;
      if (!draft.tableId || draft.guests < 1) return;
      const result = await postAction(
        "open-tab",
        {
          tableId: draft.tableId,
          guestCount: draft.guests,
          waiterName: draft.waiterName || state.context.adminName || "Garçom",
          customerName: draft.customerName || "",
        },
        "open-tab"
      );
      if (result) {
        const tabId = result.tab?.id || result.tabId;
        const tab = getSnapshot().activeTabs.find((entry) => entry.id === tabId) ||
          getSnapshot().activeTabs.find((entry) => entry.tableId === draft.tableId);
        state.modal = "";
        if (tab) openTabScreen(tab);
        else render();
      }
    } else if (type === "update-tab") {
      const tab = getTab();
      if (!tab) return;
      const result = await postAction(
        "update-tab",
        { tabId: tab.id, guestCount: state.people.guests, customerName: state.people.customerName || "" },
        "update-tab"
      );
      if (result) {
        state.modal = "";
        render();
      }
    } else if (type === "printer") {
      const draft = state.printerDraft;
      const saved = savePrinter({
        paper: draft.paper,
        label: draft.label.trim(),
        detected: draft.detected,
        savedAt: new Date().toISOString(),
      });
      const pending = state.pendingPrint;
      state.pendingPrint = null;
      state.modal = "";
      if (saved) {
        setMessage(`Impressora configurada: papel de ${PAPER_SIZES[draft.paper].label}.`, "success");
      } else {
        setMessage("Não foi possível salvar neste navegador; a configuração vale só até fechar a página.", "error");
      }
      render();
      if (pending) {
        printHtml(buildTicketHtml(pending.tab, pending.options), draft.paper);
      }
    } else if (type === "movement") {
      const result = await postAction(
        "movement",
        {
          type: state.movement.type,
          amount: reais(cents(state.movement.amount)),
          reason: state.movement.reason.trim(),
        },
        "movement"
      );
      if (result) {
        state.modal = "";
        render();
      }
    } else if (type === "close-register") {
      if (!window.confirm("Fechar o caixa? Depois de fechar, não é possível lançar vendas neste turno.")) return;
      const result = await postAction(
        "close",
        { countedCash: reais(cents(state.closing.counted)), notes: state.closing.notes.trim() },
        "close-register"
      );
      if (result) state.closing = { counted: "", notes: "" };
    }
  };

  const isVisible = () => Boolean(state.root && state.root.isConnected && state.root.offsetParent !== null);

  const handleKeydown = async (event) => {
    if (!isVisible()) return;
    const target = event.target;
    if (event.key === "Enter" && target.closest?.("[data-cx-enter]")) {
      event.preventDefault();
      const enterAction = target.closest("[data-cx-enter]").dataset.cxEnter;
      if (enterAction === "open-table-number") openTableByNumber();
      else if (enterAction === "quick-add") await quickAdd();
      else if (enterAction === "add-payment") addPaymentEntry();
      return;
    }
    if (event.key === "Enter" && target.matches?.("[data-cx-note-input]")) {
      event.preventDefault();
      await saveNote(target.dataset.cxNoteInput, target.value.trim());
      return;
    }
    if (event.key === "Escape") {
      if (state.modal) {
        event.preventDefault();
        state.modal = "";
        state.receiptTab = null;
        render();
      } else if (state.view === "floor" && state.screen !== "salao") {
        event.preventDefault();
        goSalao();
      }
      return;
    }
    if (event.key === "Enter" && state.modal === "receipt") {
      event.preventDefault();
      state.modal = "";
      state.receiptTab = null;
      render();
      return;
    }
    const snapshot = getSnapshot();
    if (!snapshot.register || state.view !== "floor" || state.modal) return;
    if (event.key === "F1") {
      event.preventDefault();
      startNewTab();
    } else if (event.key === "F3") {
      event.preventDefault();
      await handleAction("go-pdv");
    } else if (event.key === "F2" && state.screen === "pdv") {
      event.preventDefault();
      await handleAction("send-order");
    } else if (event.key === "F2" && state.screen === "counter") {
      event.preventDefault();
      await handleAction("counter-send");
    } else if (event.key === "F4" && (state.screen === "pdv" || state.screen === "payment")) {
      event.preventDefault();
      const tab = getTab();
      if (!tab) return;
      if (state.screen === "pdv") await handleAction("go-payment");
      else if (tab.status === "OPEN") await handleAction("begin-closing");
    } else if (state.screen === "salao" && /^\d$/.test(event.key) && !target.closest?.("input, textarea, select")) {
      const input = state.root.querySelector('[data-cx-field="tableSearch"]');
      if (input) {
        event.preventDefault();
        input.focus();
        input.value += event.key;
        state.tableSearch = input.value;
      }
    }
  };

  const mount = (root, context = {}) => {
    if (!root) return;
    state.root = root;
    state.context = { ...state.context, ...context };
    if (root.dataset.cashRegisterBound !== "true") {
      root.dataset.cashRegisterBound = "true";
      root.addEventListener("click", handleClick);
      root.addEventListener("submit", handleSubmit);
      root.addEventListener("input", handleInput);
      root.addEventListener("change", handleChange);
      document.addEventListener("keydown", handleKeydown);
    }
    render();
  };

  window.InovasCashRegister = Object.freeze({
    getView: () => state.view,
    load,
    mount,
    render,
    setView,
  });
})();
