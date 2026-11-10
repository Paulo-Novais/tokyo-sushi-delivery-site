(() => {
  "use strict";

  const PAYMENT_LABELS = Object.freeze({
    CASH: "Dinheiro",
    PIX: "PIX",
    DEBIT_CARD: "Cartao de debito",
    CREDIT_CARD: "Cartao de credito",
    MEAL_VOUCHER: "Vale-refeicao",
    OTHER: "Outros",
  });
  const TABLE_FILTERS = Object.freeze([
    { key: "all", label: "Todas" },
    { key: "FREE", label: "Livres" },
    { key: "OCCUPIED", label: "Ocupadas" },
    { key: "AWAITING_PAYMENT", label: "Aguardando" },
    { key: "UNAVAILABLE", label: "Fechadas" },
  ]);
  const VIEW_PATHS = Object.freeze({
    floor: "/admin/caixa/salao",
    opening: "/admin/caixa/abertura",
    closing: "/admin/caixa/fechamento",
  });
  const state = {
    root: null,
    context: {},
    snapshot: null,
    catalog: null,
    view: "floor",
    tableFilter: "all",
    tableQuery: "",
    productQuery: "",
    categoryId: "all",
    tablesCollapsed: false,
    selectedTabId: "",
    selectedPane: "consumption",
    openTableId: "",
    paymentDraft: [],
    closingDraft: null,
    loading: false,
    loadingPromise: null,
    busyAction: "",
    message: "",
    messageTone: "success",
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const mediaUrl = (value) => {
    const source = String(value || "").trim();
    if (!source) return "";
    if (/^(?:https?:|data:|blob:|\/)/i.test(source)) return source;
    return `/${source.replace(/^(?:\.\/)+/, "")}`;
  };
  const money = (value) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(value || 0));
  const dateTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  };
  const elapsed = (value) => {
    const start = new Date(value).getTime();
    if (!Number.isFinite(start)) return "";
    const minutes = Math.max(0, Math.round((Date.now() - start) / 60000));
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
  };
  const normalizeSearch = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const toNumber = (value) => {
    const normalized = String(value ?? "")
      .replace(/[^\d,.\-]/g, "")
      .replace(",", ".");
    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  };
  const newIdempotencyKey = () =>
    window.crypto?.randomUUID?.() ||
    `cash-${Date.now()}-${Math.random().toString(16).slice(2)}`;

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
    };
  const getActiveTab = () => {
    const snapshot = getSnapshot();
    const selected = snapshot.activeTabs.find(
      (tab) => tab.id === state.selectedTabId
    );
    return selected || snapshot.activeTabs[0] || null;
  };
  const getSelectedTable = () => {
    const tab = getActiveTab();
    return getSnapshot().tables.find((table) => table.id === tab?.tableId) || null;
  };
  const getCatalogSections = () =>
    Array.isArray(state.catalog?.sections) ? state.catalog.sections : [];
  const getCatalogItems = () =>
    getCatalogSections().flatMap((section) =>
      (Array.isArray(section.items) ? section.items : []).map((item) => ({
        ...item,
        sectionId: item.sectionId || section.id,
        sectionTitle: item.sectionTitle || section.title,
      }))
    );

  const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
      ...options,
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }
    if (!response.ok) {
      const requestError = new Error(
        payload?.error || "Nao foi possivel concluir a operacao."
      );
      requestError.status = response.status;
      requestError.errorCode = payload?.errorCode || "request_error";
      requestError.payload = payload;
      throw requestError;
    }
    return payload || {};
  };

  const setMessage = (message, tone = "success") => {
    state.message = message || "";
    state.messageTone = tone;
  };
  const syncSelection = () => {
    const tabs = getSnapshot().activeTabs || [];
    if (!tabs.some((tab) => tab.id === state.selectedTabId)) {
      state.selectedTabId = tabs[0]?.id || "";
      state.paymentDraft = [];
      state.closingDraft = null;
    }
  };
  const getClosingDraft = (tab) => {
    if (!tab) {
      return {
        discountAmount: 0,
        serviceChargeEnabled: false,
      };
    }
    if (!state.closingDraft || state.closingDraft.tabId !== tab.id) {
      state.closingDraft = {
        tabId: tab.id,
        discountAmount: Number(tab.discountAmount || 0),
        serviceChargeEnabled: tab.serviceChargeEnabled !== false,
      };
    }
    return state.closingDraft;
  };
  const applySnapshot = (payload) => {
    state.snapshot = payload?.snapshot || payload;
    if (payload?.catalog) state.catalog = payload.catalog;
    syncSelection();
  };
  const postAction = async (action, body, busyLabel) => {
    state.busyAction = busyLabel || action;
    setMessage("");
    render();
    try {
      const payload = await fetchJson(`/api/admin/cash-register/${action}`, {
        method: "POST",
        body: JSON.stringify(body || {}),
      });
      applySnapshot(payload);
      setMessage(payload.message || "Operacao concluida.", "success");
      return payload;
    } catch (error) {
      if (error.status === 401) {
        window.location.href = "/admin/login.html";
        return null;
      }
      setMessage(error.message, "error");
      return null;
    } finally {
      state.busyAction = "";
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
          adminName:
            payload.admin?.displayName ||
            payload.admin?.name ||
            state.context.adminName ||
            "",
          restaurantName:
            payload.admin?.restaurantName ||
            payload.admin?.restaurant ||
            state.context.restaurantName ||
            "",
          permissions: payload.admin?.permissions || state.context.permissions,
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
    if (updateUrl && window.history?.replaceState) {
      window.history.replaceState({}, "", VIEW_PATHS[state.view]);
    }
    render();
  };

  const renderFeedback = () =>
    state.message
      ? `<div class="cash-feedback is-${escapeHtml(
          state.messageTone
        )}" role="status">${escapeHtml(state.message)}</div>`
      : "";
  const renderLoading = () => `
    <section class="cash-loading" aria-live="polite">
      <span class="cash-loading-mark"></span>
      <strong>Sincronizando Caixa e Salao</strong>
      <p>Buscando caixa, mesas, comandas e cardapio deste restaurante.</p>
    </section>
  `;
  const renderHeader = () => {
    const snapshot = getSnapshot();
    const register = snapshot.register;
    const restaurantName =
      state.context.restaurantName || "Restaurante selecionado";
    return `
      <header class="cash-header">
        <div class="cash-header-title">
          <div>
            <span class="cash-kicker">${escapeHtml(restaurantName)}</span>
            <h2>Caixa - Salao</h2>
          </div>
          <span class="cash-register-status ${
            register ? "is-open" : "is-closed"
          }">${register ? "CAIXA ABERTO" : "CAIXA FECHADO"}</span>
        </div>
        <div class="cash-register-meta">
          <span><small>Operador</small><strong>${escapeHtml(
            register?.openingUserDisplayName || "--"
          )}</strong></span>
          <span><small>Abertura</small><strong>${escapeHtml(
            register ? dateTime(register.openedAt) : "--"
          )}</strong></span>
          <span><small>Valor inicial</small><strong>${escapeHtml(
            register ? money(register.openingAmount) : "--"
          )}</strong></span>
          <button class="cash-icon-button" type="button" data-cash-action="refresh" aria-label="Atualizar Caixa" title="Atualizar Caixa">
            <svg viewBox="0 0 24 24" fill="none"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </header>
    `;
  };

  const renderOpeningView = () => {
    const snapshot = getSnapshot();
    const register = snapshot.register;
    if (register) {
      return `
        <section class="cash-focused-view">
          <article class="cash-focused-card is-success">
            <span class="cash-focused-icon">✓</span>
            <span class="cash-kicker">Turno em andamento</span>
            <h3>O caixa esta aberto</h3>
            <p>Aberto por ${escapeHtml(
              register.openingUserDisplayName
            )} em ${escapeHtml(dateTime(register.openedAt))}.</p>
            <dl class="cash-definition-grid">
              <div><dt>Valor inicial</dt><dd>${escapeHtml(
                money(register.openingAmount)
              )}</dd></div>
              <div><dt>Taxa de servico</dt><dd>${escapeHtml(
                `${register.serviceChargeRate}%`
              )}</dd></div>
              <div><dt>Observacao</dt><dd>${escapeHtml(
                register.openingNotes || "Sem observacao"
              )}</dd></div>
            </dl>
            <button class="cash-primary-button" type="button" data-cash-view="floor">Ir para o Salao</button>
          </article>
        </section>
      `;
    }
    return `
      <section class="cash-focused-view">
        <form class="cash-focused-card" data-cash-form="open-register">
          <span class="cash-kicker">Abertura de Caixa</span>
          <h3>Iniciar o turno</h3>
          <p>O operador autenticado sera registrado automaticamente na auditoria.</p>
          <div class="cash-form-grid">
            <label>
              <span>Operador</span>
              <input value="${escapeHtml(
                state.context.adminName || "Operador autenticado"
              )}" disabled />
            </label>
            <label>
              <span>Valor inicial</span>
              <input name="openingAmount" type="number" min="0" step="0.01" value="0.00" required />
            </label>
            <label>
              <span>Taxa de servico (%)</span>
              <input name="serviceChargeRate" type="number" min="0" max="30" step="0.01" value="10.00" required />
            </label>
            <label class="is-wide">
              <span>Observacao opcional</span>
              <textarea name="notes" rows="3" maxlength="600" placeholder="Ex.: Fundo de troco conferido."></textarea>
            </label>
          </div>
          <button class="cash-primary-button" type="submit" ${
            state.busyAction ? "disabled" : ""
          }>${state.busyAction === "open-register" ? "Abrindo..." : "Abrir Caixa"}</button>
        </form>
      </section>
    `;
  };

  const renderClosingView = () => {
    const snapshot = getSnapshot();
    const register = snapshot.register;
    const summary = snapshot.registerSummary;
    const closed = snapshot.lastClosedRegister;
    if (!register) {
      return `
        <section class="cash-focused-view">
          <article class="cash-focused-card">
            <span class="cash-kicker">Fechamento de Caixa</span>
            <h3>Nao ha caixa aberto</h3>
            <p>${
              closed
                ? `O ultimo caixa foi fechado em ${escapeHtml(
                    dateTime(closed.closedAt)
                  )}.`
                : "Abra um caixa para iniciar a operacao."
            }</p>
            ${
              closed
                ? `<dl class="cash-definition-grid">
                    <div><dt>Valor esperado</dt><dd>${escapeHtml(
                      money(closed.expectedCash)
                    )}</dd></div>
                    <div><dt>Valor informado</dt><dd>${escapeHtml(
                      money(closed.countedCash)
                    )}</dd></div>
                    <div><dt>Diferenca</dt><dd class="${
                      Number(closed.differenceAmount || 0) === 0
                        ? "is-positive"
                        : "is-negative"
                    }">${escapeHtml(money(closed.differenceAmount))}</dd></div>
                  </dl>`
                : ""
            }
            <button class="cash-primary-button" type="button" data-cash-view="opening">Abrir Caixa</button>
          </article>
        </section>
      `;
    }
    const paymentTotals = summary?.paymentTotals || {};
    const activeCount = snapshot.activeTabs.length;
    return `
      <section class="cash-closing-layout">
        <article class="cash-closing-summary">
          <div class="cash-section-heading">
            <div><span class="cash-kicker">Conferencia do turno</span><h3>Resumo do caixa</h3></div>
            <span>${escapeHtml(dateTime(register.openedAt))}</span>
          </div>
          <div class="cash-closing-kpis">
            <div><small>Valor inicial</small><strong>${escapeHtml(
              money(register.openingAmount)
            )}</strong></div>
            <div><small>Total vendido</small><strong>${escapeHtml(
              money(summary?.totalSold)
            )}</strong></div>
            <div><small>Dinheiro esperado</small><strong>${escapeHtml(
              money(summary?.expectedCash)
            )}</strong></div>
            <div><small>Comandas abertas</small><strong>${escapeHtml(
              activeCount
            )}</strong></div>
          </div>
          <div class="cash-payment-breakdown">
            ${Object.entries(PAYMENT_LABELS)
              .map(
                ([method, label]) => `
                  <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(
                    money(paymentTotals[method])
                  )}</strong></div>
                `
              )
              .join("")}
            <div><span>Descontos</span><strong>${escapeHtml(
              money(summary?.discounts)
            )}</strong></div>
            <div><span>Taxa de servico</span><strong>${escapeHtml(
              money(summary?.serviceCharges)
            )}</strong></div>
          </div>
        </article>
        <form class="cash-focused-card cash-close-form" data-cash-form="close-register">
          <span class="cash-kicker">Contagem final</span>
          <h3>Fechar Caixa</h3>
          <p>A operacao sera bloqueada depois da confirmacao.</p>
          ${
            activeCount
              ? `<div class="cash-inline-warning">Finalize ${escapeHtml(
                  activeCount
                )} comanda(s) antes de fechar.</div>`
              : ""
          }
          <label>
            <span>Valor informado em dinheiro</span>
            <input name="countedCash" type="number" min="0" step="0.01" value="${escapeHtml(
              Number(summary?.expectedCash || 0).toFixed(2)
            )}" required />
          </label>
          <label>
            <span>Observacao opcional</span>
            <textarea name="notes" rows="4" maxlength="600"></textarea>
          </label>
          <button class="cash-danger-button" type="submit" ${
            activeCount || state.busyAction ? "disabled" : ""
          }>${state.busyAction === "close-register" ? "Fechando..." : "Confirmar Fechamento"}</button>
        </form>
      </section>
    `;
  };

  const tableStatusLabel = (status) =>
    ({
      FREE: "Livre",
      OCCUPIED: "Ocupada",
      AWAITING_PAYMENT: "Aguardando",
      UNAVAILABLE: "Fechada",
    }[status] || status);
  const renderTablePanel = () => {
    const snapshot = getSnapshot();
    const query = normalizeSearch(state.tableQuery);
    const tables = snapshot.tables.filter((table) => {
      const matchesFilter =
        state.tableFilter === "all" || table.status === state.tableFilter;
      const matchesQuery =
        !query || normalizeSearch(`${table.label} ${table.number || ""}`).includes(query);
      return matchesFilter && matchesQuery;
    });
    const counts = snapshot.tables.reduce(
      (summary, table) => {
        summary.all += 1;
        summary[table.status] = (summary[table.status] || 0) + 1;
        return summary;
      },
      { all: 0 }
    );
    return `
      <aside class="cash-tables-panel ${state.tablesCollapsed ? "is-collapsed" : ""}">
        <div class="cash-section-heading">
          <div><span class="cash-kicker">Salao</span><h3>Mesas</h3></div>
          <div class="cash-table-panel-controls">
            <strong>${escapeHtml(snapshot.tables.length)}</strong>
            <button class="cash-mobile-collapse" type="button" data-cash-action="toggle-tables" aria-expanded="${
              state.tablesCollapsed ? "false" : "true"
            }">${state.tablesCollapsed ? "Mostrar" : "Recolher"}</button>
          </div>
        </div>
        <label class="cash-search">
          <svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          <input type="search" data-cash-input="table-search" value="${escapeHtml(
            state.tableQuery
          )}" placeholder="Buscar mesa..." />
        </label>
        <div class="cash-table-filters">
          ${TABLE_FILTERS.map(
            (filter) => `
              <button type="button" class="${
                state.tableFilter === filter.key ? "is-active" : ""
              }" data-cash-table-filter="${filter.key}">
                ${escapeHtml(filter.label)}
                <span>${escapeHtml(counts[filter.key] || 0)}</span>
              </button>
            `
          ).join("")}
        </div>
        <div class="cash-table-grid">
          ${
            tables.length
              ? tables
                  .map((table) => {
                    const tab = table.activeTab;
                    return `
                      <button type="button" class="cash-table-card is-${escapeHtml(
                        table.status.toLowerCase()
                      )} ${
                        tab?.id === state.selectedTabId ? "is-selected" : ""
                      }" data-cash-table="${escapeHtml(table.id)}">
                        <span class="cash-table-number">${escapeHtml(
                          table.number || table.label
                        )}</span>
                        <span class="cash-table-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none"><path d="M4 11h16M6 11v6M18 11v6M8 8h8v3H8z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </span>
                        <strong>${escapeHtml(tableStatusLabel(table.status))}</strong>
                        ${
                          tab
                            ? `<b>${escapeHtml(money(tab.totalAmount))}</b>
                               <small>${escapeHtml(
                                 `${tab.guestCount} pessoa(s) · ${elapsed(
                                   tab.openedAt
                                 )}`
                               )}</small>`
                            : `<small>${escapeHtml(
                                `${table.capacity} lugares`
                              )}</small>`
                        }
                      </button>
                    `;
                  })
                  .join("")
              : `<div class="cash-empty-compact">Nenhuma mesa neste filtro.</div>`
          }
        </div>
        <footer class="cash-table-legend">
          <span><i class="is-free"></i>Livre</span>
          <span><i class="is-occupied"></i>Ocupada</span>
          <span><i class="is-waiting"></i>Aguardando</span>
        </footer>
      </aside>
    `;
  };

  const itemStatusLabel = (status) =>
    ({
      PENDING: "Pendente",
      SENT: "Enviado",
      IN_PREPARATION: "Em preparo",
      READY: "Pronto",
      DELIVERED: "Entregue",
      CANCELLED: "Cancelado",
    }[status] || status);
  const renderConsumption = (tab) => {
    if (!tab.items.length) {
      return `
        <div class="cash-command-empty">
          <span>+</span><strong>Comanda vazia</strong>
          <p>Escolha um produto do cardapio abaixo para iniciar o consumo.</p>
        </div>
      `;
    }
    return `
      <div class="cash-items-head">
        <span>Item</span><span>Qtd.</span><span>Unit.</span><span>Total</span><span>Status</span><span></span>
      </div>
      <div class="cash-items-list">
        ${tab.items
          .map(
            (item) => `
              <article class="cash-item-row">
                <div class="cash-item-product">
                  ${
                    item.imageUrl
                      ? `<img src="${escapeHtml(
                          mediaUrl(item.imageUrl)
                        )}" alt="" loading="lazy" />`
                      : `<span class="cash-item-placeholder">${escapeHtml(
                          item.productName.slice(0, 1)
                        )}</span>`
                  }
                  <div><strong>${escapeHtml(item.productName)}</strong><small>${escapeHtml(
                    item.category || ""
                  )}</small>
                  ${
                    item.status === "PENDING"
                      ? `<input data-cash-item-note="${escapeHtml(
                          item.id
                        )}" value="${escapeHtml(
                          item.notes || ""
                        )}" maxlength="400" placeholder="Adicionar observacao..." />`
                      : item.notes
                        ? `<em>${escapeHtml(item.notes)}</em>`
                        : ""
                  }</div>
                </div>
                <div class="cash-quantity-control">
                  ${
                    item.status === "PENDING" && tab.status === "OPEN"
                      ? `<button type="button" data-cash-quantity="${escapeHtml(
                          item.id
                        )}" data-delta="-1" aria-label="Diminuir">−</button>`
                      : ""
                  }
                  <strong>${escapeHtml(item.quantity)}</strong>
                  ${
                    item.status === "PENDING" && tab.status === "OPEN"
                      ? `<button type="button" data-cash-quantity="${escapeHtml(
                          item.id
                        )}" data-delta="1" aria-label="Aumentar">+</button>`
                      : ""
                  }
                </div>
                <span>${escapeHtml(money(item.unitPrice))}</span>
                <strong>${escapeHtml(money(item.totalPrice))}</strong>
                <span class="cash-item-status is-${escapeHtml(
                  item.status.toLowerCase()
                )}">${escapeHtml(itemStatusLabel(item.status))}</span>
                ${
                  item.status === "PENDING" && tab.status === "OPEN"
                    ? `<button class="cash-remove-item" type="button" data-cash-remove-item="${escapeHtml(
                        item.id
                      )}" aria-label="Remover item">×</button>`
                    : `<span></span>`
                }
              </article>
            `
          )
          .join("")}
      </div>
    `;
  };
  const renderOrdersPane = (tab) => `
    <div class="cash-batch-list">
      ${
        tab.batches.length
          ? tab.batches
              .map(
                (batch) => `
                  <article>
                    <span>${escapeHtml(`Pedido ${batch.batchNumber}`)}</span>
                    <strong>${escapeHtml(
                      batch.orderPublicId || batch.orderId
                    )}</strong>
                    <small>${escapeHtml(
                      `${itemStatusLabel(
                        ({
                          Recebido: "SENT",
                          Aceito: "SENT",
                          "Em preparo": "IN_PREPARATION",
                          Pronto: "READY",
                          Entregue: "DELIVERED",
                        })[batch.orderStatus] || batch.orderStatus
                      )} · ${dateTime(batch.sentAt)}`
                    )}</small>
                  </article>
                `
              )
              .join("")
          : `<div class="cash-command-empty"><strong>Nenhum pedido enviado</strong><p>Os lotes enviados aparecem aqui sem duplicar itens anteriores.</p></div>`
      }
    </div>
  `;
  const renderHistoryPane = (tab) => {
    const events = getSnapshot().auditEvents.filter(
      (event) => event.tabId === tab.id
    );
    return `
      <div class="cash-history-list">
        ${
          events.length
            ? events
                .map(
                  (event) => `
                    <article><i></i><div><strong>${escapeHtml(
                      event.eventType.replace(/_/g, " ")
                    )}</strong><small>${escapeHtml(
                      `${event.actorDisplayName} · ${dateTime(event.createdAt)}`
                    )}</small></div></article>
                  `
                )
                .join("")
            : `<div class="cash-command-empty"><strong>Sem eventos</strong></div>`
        }
      </div>
    `;
  };

  const renderProductBrowser = (tab) => {
    if (tab.status !== "OPEN") return "";
    const sections = getCatalogSections();
    const query = normalizeSearch(state.productQuery);
    const items = getCatalogItems()
      .filter((item) => item.isOrderable === true)
      .filter(
        (item) =>
          state.categoryId === "all" || item.sectionId === state.categoryId
      )
      .filter(
        (item) =>
          !query ||
          normalizeSearch(
            `${item.name} ${item.category || ""} ${item.sectionTitle || ""} ${
              item.id
            }`
          ).includes(query)
      )
      .slice(0, 18);
    return `
      <section class="cash-product-browser">
        <div class="cash-product-browser-head">
          <div><strong>Adicionar item</strong><small>Produtos disponiveis deste restaurante</small></div>
          <label class="cash-search"><input type="search" data-cash-input="product-search" value="${escapeHtml(
            state.productQuery
          )}" placeholder="Buscar produto ou codigo..." /></label>
        </div>
        <div class="cash-category-tabs">
          <button type="button" class="${
            state.categoryId === "all" ? "is-active" : ""
          }" data-cash-category="all">Todos</button>
          ${sections
            .slice(0, 8)
            .map(
              (section) => `
                <button type="button" class="${
                  state.categoryId === section.id ? "is-active" : ""
                }" data-cash-category="${escapeHtml(section.id)}">${escapeHtml(
                  section.title
                )}</button>
              `
            )
            .join("")}
        </div>
        <div class="cash-product-grid">
          ${
            items.length
              ? items
                  .map(
                    (item) => `
                      <button type="button" class="cash-product-card" data-cash-product="${escapeHtml(
                        item.id
                      )}" ${state.busyAction ? "disabled" : ""}>
                        ${
                          item.image
                            ? `<img src="${escapeHtml(
                                mediaUrl(item.image)
                              )}" alt="" loading="lazy" />`
                            : `<span class="cash-product-placeholder">${escapeHtml(
                                item.name.slice(0, 1)
                              )}</span>`
                        }
                        <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(
                          money(item.price)
                        )}</small></span>
                      </button>
                    `
                  )
                  .join("")
              : `<div class="cash-empty-compact">Nenhum produto disponivel neste filtro.</div>`
          }
        </div>
      </section>
    `;
  };

  const renderRecentReceipt = (tab) => `
    <main class="cash-command-panel cash-receipt">
      <header>
        <div>
          <span class="cash-kicker">Pagamento confirmado</span>
          <h3>Comprovante nao fiscal</h3>
          <p>${escapeHtml(
            `${tab.table?.label || "Mesa"} · ${tab.publicId} · ${dateTime(
              tab.closedAt
            )}`
          )}</p>
        </div>
        <button class="cash-print-button cash-receipt-actions" type="button" data-cash-action="print">
          Imprimir comprovante
        </button>
      </header>
      <div class="cash-receipt-lines">
        ${(tab.items || [])
          .filter((item) => item.status !== "CANCELLED")
          .map(
            (item) => `
              <div><span>${escapeHtml(
                `${item.quantity}x ${item.productName}`
              )}</span><strong>${escapeHtml(money(item.totalPrice))}</strong></div>
            `
          )
          .join("")}
      </div>
      <dl class="cash-receipt-totals">
        <div><dt>Subtotal</dt><dd>${escapeHtml(money(tab.subtotal))}</dd></div>
        <div><dt>Desconto</dt><dd>${escapeHtml(
          money(tab.discountAmount)
        )}</dd></div>
        <div><dt>Taxa de servico</dt><dd>${escapeHtml(
          money(tab.serviceChargeAmount)
        )}</dd></div>
        <div class="is-total"><dt>Total</dt><dd>${escapeHtml(
          money(tab.totalAmount)
        )}</dd></div>
      </dl>
      <section class="cash-receipt-payments">
        <strong>Pagamentos</strong>
        ${(tab.payments || [])
          .map(
            (payment) => `
              <div><span>${escapeHtml(
                PAYMENT_LABELS[payment.method] || payment.method
              )}</span><strong>${escapeHtml(money(payment.amount))}</strong></div>
              ${
                Number(payment.changeAmount || 0) > 0
                  ? `<small>Troco: ${escapeHtml(
                      money(payment.changeAmount)
                    )}</small>`
                  : ""
              }
            `
          )
          .join("")}
      </section>
      <p class="cash-receipt-footer">Documento sem valor fiscal · emitido pelo INOVAS Food</p>
    </main>
  `;

  const renderCommandPanel = () => {
    const tab = getActiveTab();
    const table = getSelectedTable();
    if (!tab || !table) {
      const recentTab = getSnapshot().recentTabs?.[0];
      if (recentTab?.status === "CLOSED" && recentTab.payments?.length) {
        return renderRecentReceipt(recentTab);
      }
      return `
        <main class="cash-command-panel is-empty">
          <div class="cash-command-empty">
            <span>⌁</span><strong>Selecione uma mesa</strong>
            <p>Mesas livres abrem uma nova comanda. Mesas ocupadas carregam o consumo atual.</p>
          </div>
        </main>
      `;
    }
    const pendingCount = tab.items.filter((item) => item.status === "PENDING").length;
    const paneContent =
      state.selectedPane === "orders"
        ? renderOrdersPane(tab)
        : state.selectedPane === "history"
          ? renderHistoryPane(tab)
          : renderConsumption(tab);
    return `
      <main class="cash-command-panel">
        <header class="cash-command-header">
          <div>
            <span class="cash-command-table">${escapeHtml(table.label)}</span>
            <span class="cash-command-status is-${escapeHtml(
              tab.status.toLowerCase()
            )}">${escapeHtml(
              tab.status === "AWAITING_PAYMENT" ? "Aguardando pagamento" : "Ocupada"
            )}</span>
          </div>
          <button class="cash-print-button" type="button" data-cash-action="print">Imprimir comanda</button>
          <dl>
            <div><dt>Comanda</dt><dd>${escapeHtml(tab.publicId)}</dd></div>
            <div><dt>Aberta em</dt><dd>${escapeHtml(dateTime(tab.openedAt))}</dd></div>
            <div><dt>Garcom</dt><dd>${escapeHtml(tab.waiterName)}</dd></div>
            <div><dt>Clientes</dt><dd>${escapeHtml(tab.guestCount)}</dd></div>
          </dl>
        </header>
        <nav class="cash-command-tabs">
          <button type="button" class="${
            state.selectedPane === "consumption" ? "is-active" : ""
          }" data-cash-pane="consumption">Consumo</button>
          <button type="button" class="${
            state.selectedPane === "orders" ? "is-active" : ""
          }" data-cash-pane="orders">Pedidos <span>${escapeHtml(
            tab.batches.length
          )}</span></button>
          <button type="button" class="${
            state.selectedPane === "history" ? "is-active" : ""
          }" data-cash-pane="history">Historico</button>
        </nav>
        <section class="cash-command-content">${paneContent}</section>
        ${state.selectedPane === "consumption" ? renderProductBrowser(tab) : ""}
        ${
          tab.status === "OPEN"
            ? `<footer class="cash-command-actions">
                <button class="cash-secondary-button" type="button" data-cash-action="print">Mais opcoes</button>
                <button class="cash-send-button" type="button" data-cash-action="send-order" ${
                  !pendingCount || state.busyAction ? "disabled" : ""
                }>Enviar Pedido ${pendingCount ? `<span>${pendingCount}</span>` : ""}</button>
              </footer>`
            : ""
        }
      </main>
    `;
  };

  const getPaymentTotal = () =>
    state.paymentDraft.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const renderPaymentPanel = () => {
    const tab = getActiveTab();
    if (!tab) {
      return `
        <aside class="cash-payment-panel">
          <div class="cash-command-empty"><strong>Resumo da conta</strong><p>Selecione uma comanda para visualizar os valores.</p></div>
        </aside>
      `;
    }
    const isAwaiting = tab.status === "AWAITING_PAYMENT";
    const paymentTotal = getPaymentTotal();
    const remaining = Math.max(0, Number((tab.totalAmount - paymentTotal).toFixed(2)));
    const canDiscount = hasPermission("cash_register_discount");
    const canRemoveService = hasPermission("cash_register_remove_service");
    const closingDraft = getClosingDraft(tab);
    const previewDiscount = Math.min(
      Number(tab.subtotal || 0),
      Math.max(0, Number(closingDraft.discountAmount || 0))
    );
    const previewServiceAmount = closingDraft.serviceChargeEnabled
      ? Number(
          (
            (Number(tab.subtotal || 0) * Number(tab.serviceChargeRate || 0)) /
            100
          ).toFixed(2)
        )
      : 0;
    const previewTotal = Number(
      Math.max(
        0,
        Number(tab.subtotal || 0) -
          previewDiscount +
          previewServiceAmount +
          Number(tab.additionAmount || 0)
      ).toFixed(2)
    );
    return `
      <aside class="cash-payment-panel">
        <section class="cash-account-summary">
          <h3>Resumo da conta</h3>
          <div><span>Subtotal</span><strong>${escapeHtml(money(tab.subtotal))}</strong></div>
          <label class="cash-summary-control">
            <span>Desconto</span>
            ${
              isAwaiting
                ? `<strong>${escapeHtml(money(tab.discountAmount))}</strong>`
                : `<input type="number" min="0" step="0.01" value="${escapeHtml(
                    Number(closingDraft.discountAmount || 0).toFixed(2)
                  )}" data-cash-input="discount" ${canDiscount ? "" : "disabled"} />`
            }
          </label>
          <label class="cash-summary-control">
            <span>Taxa de servico (${escapeHtml(tab.serviceChargeRate)}%)</span>
            ${
              isAwaiting
                ? `<strong>${escapeHtml(money(tab.serviceChargeAmount))}</strong>`
                : `<span class="cash-service-toggle"><input type="checkbox" data-cash-input="service-enabled" ${
                    closingDraft.serviceChargeEnabled ? "checked" : ""
                  } ${canRemoveService ? "" : "disabled"} /><strong>${escapeHtml(
                    money(previewServiceAmount)
                  )}</strong></span>`
            }
          </label>
          <div><span>Acrescimos</span><strong>${escapeHtml(
            money(tab.additionAmount)
          )}</strong></div>
          <div class="cash-account-total"><span>Total</span><strong>${escapeHtml(
            money(isAwaiting ? tab.totalAmount : previewTotal)
          )}</strong></div>
        </section>
        ${
          isAwaiting
            ? `
              <section class="cash-payment-methods">
                <div class="cash-section-heading"><div><span class="cash-kicker">Recebimento</span><h3>Pagamentos</h3></div><strong>${escapeHtml(
                  money(remaining)
                )}</strong></div>
                <div class="cash-payment-method-grid">
                  ${Object.entries(PAYMENT_LABELS)
                    .map(
                      ([method, label]) => `
                        <button type="button" data-cash-payment-method="${method}">
                          <span>${escapeHtml(label.slice(0, 1))}</span>${escapeHtml(label)}
                        </button>
                      `
                    )
                    .join("")}
                </div>
                <div class="cash-payment-draft">
                  ${
                    state.paymentDraft.length
                      ? state.paymentDraft
                          .map(
                            (payment, index) => `
                              <article>
                                <div><strong>${escapeHtml(
                                  PAYMENT_LABELS[payment.method]
                                )}</strong><button type="button" data-cash-remove-payment="${index}">Remover</button></div>
                                <label><span>Valor</span><input type="number" min="0.01" step="0.01" value="${escapeHtml(
                                  Number(payment.amount || 0).toFixed(2)
                                )}" data-cash-payment-amount="${index}" /></label>
                                ${
                                  payment.method === "CASH"
                                    ? `<label><span>Valor recebido</span><input type="number" min="0" step="0.01" value="${escapeHtml(
                                        Number(
                                          payment.receivedAmount ||
                                            payment.amount ||
                                            0
                                        ).toFixed(2)
                                      )}" data-cash-payment-received="${index}" /></label>
                                      <small>Troco: ${escapeHtml(
                                        money(
                                          Math.max(
                                            0,
                                            Number(payment.receivedAmount || 0) -
                                              Number(payment.amount || 0)
                                          )
                                        )
                                      )}</small>`
                                    : ""
                                }
                              </article>
                            `
                          )
                          .join("")
                      : `<p>Escolha uma ou mais formas de pagamento.</p>`
                  }
                </div>
                <div class="cash-payment-balance">
                  <span>Informado <strong>${escapeHtml(
                    money(paymentTotal)
                  )}</strong></span>
                  <span>Restante <strong>${escapeHtml(
                    money(remaining)
                  )}</strong></span>
                </div>
                <button class="cash-confirm-button" type="button" data-cash-action="confirm-payment" ${
                  remaining !== 0 || !state.paymentDraft.length || state.busyAction
                    ? "disabled"
                    : ""
                }>Confirmar Pagamento</button>
                <button class="cash-link-button" type="button" data-cash-action="reopen-tab">Reabrir comanda</button>
              </section>
            `
            : `
              <section class="cash-payment-start">
                <p>Ao fechar a conta, novos itens ficam bloqueados ate uma reabertura explicita.</p>
                <button class="cash-close-account-button" type="button" data-cash-action="begin-closing" ${
                  !tab.items.length || state.busyAction ? "disabled" : ""
                }>Fechar Conta</button>
              </section>
            `
        }
      </aside>
    `;
  };

  const renderConfigureTables = () => `
    <section class="cash-focused-view cash-setup-view">
      <form class="cash-focused-card" data-cash-form="configure-tables">
        <span class="cash-kicker">Configuracao inicial</span>
        <h3>Configure as mesas reais do salao</h3>
        <p>Nenhuma mesa foi cadastrada para este restaurante. Esta configuracao sera persistida no tenant atual.</p>
        <div class="cash-form-grid">
          <label><span>Quantidade de mesas</span><input name="count" type="number" min="1" max="80" value="12" required /></label>
          <label><span>Lugares por mesa</span><input name="capacity" type="number" min="1" max="50" value="4" required /></label>
        </div>
        <button class="cash-primary-button" type="submit" ${
          state.busyAction ? "disabled" : ""
        }>Configurar Salao</button>
      </form>
    </section>
  `;

  const renderOpenTableModal = () => {
    const table = getSnapshot().tables.find(
      (entry) => entry.id === state.openTableId
    );
    if (!table) return "";
    return `
      <div class="cash-modal" role="presentation">
        <button type="button" class="cash-modal-backdrop" data-cash-action="close-modal" aria-label="Fechar"></button>
        <form class="cash-modal-dialog" data-cash-form="open-tab">
          <input type="hidden" name="tableId" value="${escapeHtml(table.id)}" />
          <span class="cash-kicker">Nova comanda</span>
          <h3>${escapeHtml(table.label)}</h3>
          <p>${escapeHtml(`${table.capacity} lugares disponiveis`)}</p>
          <label><span>Quantidade de clientes</span><input name="guestCount" type="number" min="1" max="100" value="2" required /></label>
          <label><span>Garcom responsavel</span><input name="waiterName" value="${escapeHtml(
            state.context.adminName || ""
          )}" required /></label>
          <label><span>Cliente (opcional)</span><input name="customerName" maxlength="180" placeholder="Nome do cliente" /></label>
          <div class="cash-modal-actions">
            <button class="cash-secondary-button" type="button" data-cash-action="close-modal">Cancelar</button>
            <button class="cash-primary-button" type="submit">Abrir Comanda</button>
          </div>
        </form>
      </div>
    `;
  };

  const renderFloorView = () => {
    const snapshot = getSnapshot();
    if (!snapshot.tables.length) return renderConfigureTables();
    return `
      <section class="cash-floor-layout">
        ${renderTablePanel()}
        ${renderCommandPanel()}
        ${renderPaymentPanel()}
      </section>
      ${
        snapshot.register
          ? ""
          : `<div class="cash-register-blocker">
              <div><span>!</span><strong>Caixa fechado</strong><p>Abra o caixa para iniciar comandas e registrar vendas.</p>
              <button class="cash-primary-button" type="button" data-cash-view="opening">Abrir Caixa</button></div>
            </div>`
      }
      ${renderOpenTableModal()}
    `;
  };

  const render = () => {
    if (!state.root) return;
    if (state.loading && !state.snapshot) {
      state.root.innerHTML = renderLoading();
      return;
    }
    const content =
      state.view === "opening"
        ? renderOpeningView()
        : state.view === "closing"
          ? renderClosingView()
          : renderFloorView();
    state.root.innerHTML = `
      <div class="cash-register-module">
        ${renderHeader()}
        ${renderFeedback()}
        ${content}
      </div>
    `;
  };

  const handleClick = async (event) => {
    const viewButton = event.target.closest("[data-cash-view]");
    if (viewButton) {
      setView(viewButton.dataset.cashView);
      return;
    }
    const filter = event.target.closest("[data-cash-table-filter]");
    if (filter) {
      state.tableFilter = filter.dataset.cashTableFilter;
      render();
      return;
    }
    const category = event.target.closest("[data-cash-category]");
    if (category) {
      state.categoryId = category.dataset.cashCategory;
      render();
      return;
    }
    const pane = event.target.closest("[data-cash-pane]");
    if (pane) {
      state.selectedPane = pane.dataset.cashPane;
      render();
      return;
    }
    const tableButton = event.target.closest("[data-cash-table]");
    if (tableButton) {
      const table = getSnapshot().tables.find(
        (entry) => entry.id === tableButton.dataset.cashTable
      );
      if (table?.activeTab) {
        state.selectedTabId = table.activeTab.id;
        state.paymentDraft = [];
        state.closingDraft = null;
        render();
      } else if (table?.status === "FREE" && getSnapshot().register) {
        state.openTableId = table.id;
        render();
      }
      return;
    }
    const productButton = event.target.closest("[data-cash-product]");
    if (productButton) {
      const tab = getActiveTab();
      if (!tab) return;
      await postAction(
        "add-item",
        { tabId: tab.id, productId: productButton.dataset.cashProduct, quantity: 1 },
        "add-item"
      );
      return;
    }
    const quantityButton = event.target.closest("[data-cash-quantity]");
    if (quantityButton) {
      const tab = getActiveTab();
      const item = tab?.items.find(
        (entry) => entry.id === quantityButton.dataset.cashQuantity
      );
      if (!item) return;
      const nextQuantity = Math.max(
        1,
        Number(item.quantity) + Number(quantityButton.dataset.delta || 0)
      );
      await postAction(
        "update-item",
        { itemId: item.id, quantity: nextQuantity, notes: item.notes || "" },
        "update-item"
      );
      return;
    }
    const removeItem = event.target.closest("[data-cash-remove-item]");
    if (removeItem) {
      await postAction(
        "remove-item",
        { itemId: removeItem.dataset.cashRemoveItem },
        "remove-item"
      );
      return;
    }
    const methodButton = event.target.closest("[data-cash-payment-method]");
    if (methodButton) {
      const tab = getActiveTab();
      if (!tab) return;
      const remaining = Math.max(
        0,
        Number((tab.totalAmount - getPaymentTotal()).toFixed(2))
      );
      if (remaining <= 0) {
        setMessage("O total da conta ja foi distribuido.", "error");
        render();
        return;
      }
      state.paymentDraft.push({
        method: methodButton.dataset.cashPaymentMethod,
        amount: remaining,
        receivedAmount: remaining,
      });
      render();
      return;
    }
    const removePayment = event.target.closest("[data-cash-remove-payment]");
    if (removePayment) {
      state.paymentDraft.splice(Number(removePayment.dataset.cashRemovePayment), 1);
      render();
      return;
    }
    const actionButton = event.target.closest("[data-cash-action]");
    if (!actionButton) return;
    const action = actionButton.dataset.cashAction;
    if (action === "refresh") {
      await load({ force: true });
    } else if (action === "toggle-tables") {
      state.tablesCollapsed = !state.tablesCollapsed;
      render();
    } else if (action === "close-modal") {
      state.openTableId = "";
      render();
    } else if (action === "print") {
      window.print();
    } else if (action === "send-order") {
      const tab = getActiveTab();
      if (tab) await postAction("send-order", { tabId: tab.id }, "send-order");
    } else if (action === "begin-closing") {
      const tab = getActiveTab();
      if (!tab) return;
      const discountInput = state.root.querySelector('[data-cash-input="discount"]');
      const serviceInput = state.root.querySelector(
        '[data-cash-input="service-enabled"]'
      );
      const closingDraft = getClosingDraft(tab);
      await postAction(
        "begin-closing",
        {
          tabId: tab.id,
          discountAmount: toNumber(
            discountInput?.value ?? closingDraft.discountAmount ?? 0
          ),
          serviceChargeEnabled:
            serviceInput?.checked ?? closingDraft.serviceChargeEnabled,
          serviceChargeRate: tab.serviceChargeRate,
        },
        "begin-closing"
      );
      state.paymentDraft = [];
    } else if (action === "reopen-tab") {
      const tab = getActiveTab();
      if (tab) {
        await postAction("reopen-tab", { tabId: tab.id }, "reopen-tab");
        state.paymentDraft = [];
        state.closingDraft = null;
      }
    } else if (action === "confirm-payment") {
      const tab = getActiveTab();
      if (!tab) return;
      const payload = {
        tabId: tab.id,
        idempotencyKey: newIdempotencyKey(),
        payments: state.paymentDraft.map((payment) => ({
          method: payment.method,
          amount: Number(payment.amount),
          ...(payment.method === "CASH"
            ? { receivedAmount: Number(payment.receivedAmount) }
            : {}),
        })),
      };
      const result = await postAction(
        "confirm-payment",
        payload,
        "confirm-payment"
      );
      if (result) state.paymentDraft = [];
    }
  };

  const handleSubmit = async (event) => {
    const form = event.target.closest("[data-cash-form]");
    if (!form) return;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const type = form.dataset.cashForm;
    if (type === "configure-tables") {
      await postAction(
        "configure-tables",
        { count: Number(data.count), capacity: Number(data.capacity) },
        "configure-tables"
      );
    } else if (type === "open-register") {
      await postAction(
        "open",
        {
          openingAmount: toNumber(data.openingAmount),
          serviceChargeRate: toNumber(data.serviceChargeRate),
          notes: data.notes || "",
        },
        "open-register"
      );
      if (getSnapshot().register) setView("floor");
    } else if (type === "open-tab") {
      const result = await postAction(
        "open-tab",
        {
          tableId: data.tableId,
          guestCount: Number(data.guestCount),
          waiterName: data.waiterName,
          customerName: data.customerName || "",
        },
        "open-tab"
      );
      if (result) {
        state.openTableId = "";
        state.selectedTabId = result.tab?.id || result.tabId || state.selectedTabId;
        state.closingDraft = null;
      }
    } else if (type === "close-register") {
      if (
        !window.confirm(
          "Confirmar o fechamento do caixa? Novas vendas ficarao bloqueadas ate a proxima abertura."
        )
      ) {
        return;
      }
      await postAction(
        "close",
        {
          countedCash: toNumber(data.countedCash),
          notes: data.notes || "",
        },
        "close-register"
      );
    }
  };

  const handleInput = (event) => {
    const input = event.target;
    if (input.matches('[data-cash-input="table-search"]')) {
      state.tableQuery = input.value;
      render();
      state.root
        ?.querySelector('[data-cash-input="table-search"]')
        ?.focus();
    } else if (input.matches('[data-cash-input="product-search"]')) {
      state.productQuery = input.value;
      render();
      const replacement = state.root?.querySelector(
        '[data-cash-input="product-search"]'
      );
      replacement?.focus();
      replacement?.setSelectionRange(
        replacement.value.length,
        replacement.value.length
      );
    } else if (input.matches("[data-cash-payment-amount]")) {
      const index = Number(input.dataset.cashPaymentAmount);
      if (state.paymentDraft[index]) {
        state.paymentDraft[index].amount = toNumber(input.value);
      }
    } else if (input.matches("[data-cash-payment-received]")) {
      const index = Number(input.dataset.cashPaymentReceived);
      if (state.paymentDraft[index]) {
        state.paymentDraft[index].receivedAmount = toNumber(input.value);
      }
    }
  };

  const handleChange = async (event) => {
    const noteInput = event.target.closest("[data-cash-item-note]");
    if (noteInput) {
      const tab = getActiveTab();
      const item = tab?.items.find(
        (entry) => entry.id === noteInput.dataset.cashItemNote
      );
      if (item && noteInput.value !== item.notes) {
        await postAction(
          "update-item",
          {
            itemId: item.id,
            quantity: item.quantity,
            notes: noteInput.value,
          },
          "update-item"
        );
      }
      return;
    }
    if (
      event.target.matches("[data-cash-payment-amount]") ||
      event.target.matches("[data-cash-payment-received]")
    ) {
      render();
      return;
    }
    if (
      event.target.matches('[data-cash-input="discount"]') ||
      event.target.matches('[data-cash-input="service-enabled"]')
    ) {
      const closingDraft = getClosingDraft(getActiveTab());
      if (event.target.matches('[data-cash-input="discount"]')) {
        closingDraft.discountAmount = toNumber(event.target.value);
      } else {
        closingDraft.serviceChargeEnabled = event.target.checked;
      }
      render();
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
