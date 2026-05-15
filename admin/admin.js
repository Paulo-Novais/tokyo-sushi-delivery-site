const ADMIN_DASHBOARD_REFRESH_MS = 20000;
const ORDER_STATUSES = [
  "Novo",
  "Confirmado",
  "Em preparo",
  "Saiu para entrega",
  "Finalizado",
  "Cancelado",
];

const adminState = {
  activeFilter: "all",
  orders: [],
  selectedOrder: null,
  selectedOrderId: "",
  stats: null,
  generatedAt: "",
  storageMode: "",
  isLoadingOrders: false,
  isLoadingOrderDetails: false,
  isUpdatingStatus: false,
};

let detailRequestSequence = 0;

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatMoney = (value) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));

const formatDateTime = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Horario indisponivel";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

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

  let data = null;

  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    const requestError = new Error(data?.error || "Nao foi possivel concluir a operacao.");
    requestError.status = response.status;
    requestError.payload = data;
    throw requestError;
  }

  return data || {};
};

const setFeedback = (node, message, tone = "error") => {
  if (!node) {
    return;
  }

  if (!message) {
    node.hidden = true;
    node.textContent = "";
    node.classList.remove("is-error", "is-success");
    return;
  }

  node.hidden = false;
  node.textContent = message;
  node.classList.toggle("is-error", tone === "error");
  node.classList.toggle("is-success", tone === "success");
};

const getSafeAdminRedirect = () => {
  const nextParam = new URLSearchParams(window.location.search).get("next");

  if (nextParam && nextParam.startsWith("/admin")) {
    return nextParam;
  }

  return "/admin/";
};

const redirectToLogin = () => {
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.href = `/admin/login.html?next=${encodeURIComponent(next)}`;
};

const buildStorageLabel = (storageMode) => {
  if (storageMode === "neon") {
    return "Banco Neon conectado";
  }

  if (storageMode === "file") {
    return "Modo local de desenvolvimento";
  }

  return "Configuracao pendente";
};

const getOrderTypeLabel = (order) => {
  if (order.orderType === "scheduled" || order.timingMode === "scheduled") {
    return "Agendamento";
  }

  return order.fulfillmentMode === "pickup" ? "Retirada" : "Entrega";
};

const getTimingLabel = (order) => {
  if (order.timingMode === "scheduled" && order.scheduledLabel) {
    return order.scheduledLabel;
  }

  return "Pedido imediato";
};

const getPaymentLabel = (paymentMethod) => {
  switch (paymentMethod) {
    case "dinheiro":
      return "Dinheiro";
    case "credito":
      return "Cartao de credito";
    case "debito":
      return "Cartao de debito";
    case "pix":
      return "Pix";
    default:
      return "Nao informado";
  }
};

const getStatusClassName = (status) => {
  const normalizedStatus = String(status || "").toLowerCase();

  if (normalizedStatus === "novo") {
    return "admin-order-status is-new";
  }

  if (normalizedStatus === "confirmado") {
    return "admin-order-status is-confirmed";
  }

  if (normalizedStatus === "em preparo") {
    return "admin-order-status is-preparing";
  }

  if (normalizedStatus === "saiu para entrega") {
    return "admin-order-status is-delivering";
  }

  if (normalizedStatus === "finalizado") {
    return "admin-order-status is-finished";
  }

  if (normalizedStatus === "cancelado") {
    return "admin-order-status is-cancelled";
  }

  return "admin-order-status";
};

const pickOrderSummary = (order) => ({
  id: order.id,
  publicId: order.publicId,
  status: order.status,
  customerName: order.customerName,
  customerPhone: order.customerPhone,
  customerEmail: order.customerEmail,
  orderType: order.orderType,
  fulfillmentMode: order.fulfillmentMode,
  timingMode: order.timingMode,
  scheduledFor: order.scheduledFor,
  scheduledLabel: order.scheduledLabel,
  paymentMethod: order.paymentMethod,
  itemCount: order.itemCount,
  subtotal: order.subtotal,
  deliveryFee: order.deliveryFee,
  totalAmount: order.totalAmount,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  addressFull: order.addressFull,
  latestStatusNote: order.latestStatusNote,
});

const getFilteredOrders = () => {
  if (adminState.activeFilter === "all") {
    return adminState.orders;
  }

  return adminState.orders.filter((order) => order.status === adminState.activeFilter);
};

const updateDashboardMeta = () => {
  const generatedAtNode = document.querySelector("[data-admin-generated-at]");
  const storageNode = document.querySelector("[data-admin-storage-mode]");
  const listSummaryNode = document.querySelector("[data-admin-list-summary]");

  if (generatedAtNode) {
    generatedAtNode.textContent = adminState.generatedAt
      ? `Atualizado em ${formatDateTime(adminState.generatedAt)}.`
      : "Atualizando lista operacional...";
  }

  if (storageNode) {
    storageNode.textContent = buildStorageLabel(adminState.storageMode);
  }

  if (listSummaryNode) {
    const visibleOrders = getFilteredOrders().length;
    const filterLabel =
      adminState.activeFilter === "all" ? "todos os status" : `status ${adminState.activeFilter}`;
    listSummaryNode.textContent = `${visibleOrders} pedido(s) visiveis em ${filterLabel}.`;
  }
};

const renderDashboardStats = (stats) => {
  const statsRoot = document.querySelector("[data-admin-stats]");

  if (!statsRoot) {
    return;
  }

  const cards = [
    {
      label: "Total",
      value: stats?.totalOrders ?? 0,
      helper: "Pedidos registrados",
    },
    {
      label: "Novos",
      value: stats?.newOrders ?? 0,
      helper: "Aguardando primeira acao",
    },
    {
      label: "Ativos",
      value: stats?.activeOrders ?? 0,
      helper: "Ainda em operacao",
    },
    {
      label: "Agendados",
      value: stats?.scheduledOrders ?? 0,
      helper: "Com horario solicitado",
    },
  ];

  statsRoot.innerHTML = cards
    .map(
      (card) => `
        <article class="admin-stat-card">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(String(card.value))}</strong>
          <small>${escapeHtml(card.helper)}</small>
        </article>
      `
    )
    .join("");
};

const renderStatusFilters = () => {
  const filtersRoot = document.querySelector("[data-admin-status-filters]");

  if (!filtersRoot) {
    return;
  }

  const counts = adminState.stats?.byStatus || {};
  const filters = [
    {
      key: "all",
      label: "Todos",
      count: adminState.stats?.totalOrders ?? adminState.orders.length,
    },
    ...ORDER_STATUSES.map((status) => ({
      key: status,
      label: status,
      count: Number(counts[status] || 0),
    })),
  ];

  filtersRoot.innerHTML = filters
    .map(
      (filter) => `
        <button
          class="admin-filter-chip${adminState.activeFilter === filter.key ? " is-active" : ""}${
            filter.key === "Novo" ? " is-new-filter" : ""
          }"
          type="button"
          data-filter-status="${escapeHtml(filter.key)}"
        >
          <span>${escapeHtml(filter.label)}</span>
          <strong>${escapeHtml(String(filter.count))}</strong>
        </button>
      `
    )
    .join("");
};

const renderOrderList = () => {
  const listRoot = document.querySelector("[data-admin-order-list]");

  if (!listRoot) {
    return;
  }

  const orders = getFilteredOrders();

  if (adminState.isLoadingOrders && adminState.orders.length === 0) {
    listRoot.innerHTML = `
      <div class="admin-empty-state">
        <strong>Carregando pedidos</strong>
        <span>Estamos sincronizando a fila operacional do gestor.</span>
      </div>
    `;
    return;
  }

  if (orders.length === 0) {
    listRoot.innerHTML = `
      <div class="admin-empty-state">
        <strong>Nenhum pedido nesta visao.</strong>
        <span>Assim que novos pedidos entrarem ou o filtro mudar, eles aparecem aqui.</span>
      </div>
    `;
    return;
  }

  listRoot.innerHTML = orders
    .map((order) => {
      const isSelected = adminState.selectedOrderId === order.id;
      const isNewOrder = order.status === "Novo";

      return `
        <button
          class="admin-order-card${isNewOrder ? " is-new" : ""}${isSelected ? " is-selected" : ""}"
          type="button"
          data-order-id="${escapeHtml(order.id)}"
        >
          <div class="admin-order-top">
            <div class="admin-order-meta">
              <strong>${escapeHtml(order.publicId)}</strong>
              <small>${escapeHtml(formatDateTime(order.createdAt))}</small>
            </div>
            <span class="${getStatusClassName(order.status)}">${escapeHtml(order.status)}</span>
          </div>

          <div class="admin-order-grid">
            <span>
              <strong>Cliente</strong>
              ${escapeHtml(order.customerName)}
            </span>
            <span>
              <strong>Tipo</strong>
              ${escapeHtml(getOrderTypeLabel(order))}
            </span>
            <span>
              <strong>Horario</strong>
              ${escapeHtml(getTimingLabel(order))}
            </span>
            <span>
              <strong>Pagamento</strong>
              ${escapeHtml(getPaymentLabel(order.paymentMethod))}
            </span>
          </div>

          <div class="admin-order-footer">
            <small>${escapeHtml(order.latestStatusNote || "Sem observacao operacional.")}</small>
            <strong>${escapeHtml(formatMoney(order.totalAmount || 0))}</strong>
          </div>
        </button>
      `;
    })
    .join("");
};

const renderOrderItems = (items, itemType) => {
  const filteredItems = Array.isArray(items) ? items.filter((item) => item.type === itemType) : [];

  if (filteredItems.length === 0) {
    return `
      <div class="admin-empty-inline">
        <span>Nenhum item desta categoria.</span>
      </div>
    `;
  }

  return filteredItems
    .map((item) => {
      const metadata = item.metadata || {};
      const extraInfo =
        item.type === "addon"
          ? `Cobrados: ${Number(metadata.chargedQuantity || 0)} | Gratis: ${Number(
              metadata.freeUnits || 0
            )}`
          : item.category || "Item principal";

      return `
        <article class="admin-detail-item">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <small>${escapeHtml(extraInfo)}</small>
          </div>
          <div class="admin-detail-item-meta">
            <span>${escapeHtml(`${item.quantity}x`)}</span>
            <strong>${escapeHtml(formatMoney(item.totalPrice || 0))}</strong>
          </div>
        </article>
      `;
    })
    .join("");
};

const renderStatusHistory = (history) => {
  if (!Array.isArray(history) || history.length === 0) {
    return `
      <div class="admin-empty-inline">
        <span>Sem atualizacoes registradas ate o momento.</span>
      </div>
    `;
  }

  return history
    .map(
      (entry) => `
        <article class="admin-status-event">
          <div class="admin-status-event-top">
            <span class="${getStatusClassName(entry.status)}">${escapeHtml(entry.status)}</span>
            <small>${escapeHtml(formatDateTime(entry.createdAt))}</small>
          </div>
          <p>${escapeHtml(entry.note || "Atualizacao registrada no sistema.")}</p>
        </article>
      `
    )
    .join("");
};

const renderOrderDetails = () => {
  const detailRoot = document.querySelector("[data-admin-order-detail]");
  const detailTitle = document.querySelector("[data-admin-detail-title]");
  const detailSubtitle = document.querySelector("[data-admin-detail-subtitle]");

  if (!detailRoot) {
    return;
  }

  if (adminState.isLoadingOrderDetails && !adminState.selectedOrder) {
    if (detailTitle) {
      detailTitle.textContent = "Carregando pedido";
    }

    if (detailSubtitle) {
      detailSubtitle.textContent = "Buscando dados completos da operacao.";
    }

    detailRoot.innerHTML = `
      <div class="admin-empty-state admin-empty-state-soft">
        <strong>Carregando detalhes</strong>
        <span>Assim que o pedido responder, mostramos os dados completos aqui.</span>
      </div>
    `;
    return;
  }

  const order = adminState.selectedOrder;

  if (!order) {
    if (detailTitle) {
      detailTitle.textContent = "Selecione um pedido";
    }

    if (detailSubtitle) {
      detailSubtitle.textContent = "Abra um pedido da lista para ver os detalhes operacionais.";
    }

    detailRoot.innerHTML = `
      <div class="admin-empty-state admin-empty-state-soft">
        <strong>Nenhum pedido aberto</strong>
        <span>Escolha um pedido na lista para confirmar dados, revisar itens e alterar o status.</span>
      </div>
    `;
    return;
  }

  if (detailTitle) {
    detailTitle.textContent = order.publicId;
  }

  if (detailSubtitle) {
    detailSubtitle.textContent = `${getOrderTypeLabel(order)} | ${formatDateTime(order.createdAt)}`;
  }

  detailRoot.innerHTML = `
    <section class="admin-detail-hero">
      <div>
        <span class="admin-chip">Status atual</span>
        <div class="admin-detail-hero-main">
          <strong>${escapeHtml(order.publicId)}</strong>
          <span class="${getStatusClassName(order.status)}">${escapeHtml(order.status)}</span>
        </div>
        <p>${escapeHtml(order.latestStatusNote || "Pedido em acompanhamento operacional.")}</p>
      </div>
      <div class="admin-detail-hero-meta">
        <span><strong>Criado:</strong> ${escapeHtml(formatDateTime(order.createdAt))}</span>
        <span><strong>Atualizado:</strong> ${escapeHtml(formatDateTime(order.updatedAt))}</span>
      </div>
    </section>

    <form class="admin-status-form" data-admin-status-form>
      <label class="admin-field">
        <span>Atualizar status do pedido</span>
        <select class="admin-input" name="status" data-admin-status-select ${
          adminState.isUpdatingStatus ? "disabled" : ""
        }>
          ${ORDER_STATUSES.map(
            (status) => `
              <option value="${escapeHtml(status)}" ${
                status === order.status ? "selected" : ""
              }>
                ${escapeHtml(status)}
              </option>
            `
          ).join("")}
        </select>
      </label>

      <button
        class="admin-button admin-button-primary"
        type="submit"
        data-admin-status-save
        ${adminState.isUpdatingStatus ? "disabled" : ""}
      >
        ${adminState.isUpdatingStatus ? "Salvando..." : "Salvar status"}
      </button>
    </form>

    <div class="admin-detail-grid">
      <section class="admin-detail-card">
        <h3>Cliente</h3>
        <div class="admin-detail-fields">
          <span><strong>Nome</strong>${escapeHtml(order.customerName)}</span>
          <span><strong>Telefone</strong>${escapeHtml(order.customerPhone || "Nao informado")}</span>
          <span><strong>E-mail</strong>${escapeHtml(order.customerEmail || "Nao informado")}</span>
          <span><strong>Tipo</strong>${escapeHtml(getOrderTypeLabel(order))}</span>
          <span><strong>Horario</strong>${escapeHtml(getTimingLabel(order))}</span>
          <span><strong>Forma de pagamento</strong>${escapeHtml(
            getPaymentLabel(order.paymentMethod)
          )}</span>
          <span><strong>Dinheiro informado</strong>${escapeHtml(
            order.cashAmount !== null ? formatMoney(order.cashAmount) : "Nao se aplica"
          )}</span>
          <span><strong>Troco</strong>${escapeHtml(
            order.changeAmount !== null ? formatMoney(order.changeAmount) : "Nao se aplica"
          )}</span>
        </div>
      </section>

      <section class="admin-detail-card">
        <h3>Entrega e observacoes</h3>
        <div class="admin-detail-fields">
          <span><strong>Endereco</strong>${escapeHtml(order.addressFull || "Retirada no local")}</span>
          <span><strong>Rua</strong>${escapeHtml(order.addressLine || "Nao se aplica")}</span>
          <span><strong>Numero</strong>${escapeHtml(order.addressNumber || "Nao se aplica")}</span>
          <span><strong>Complemento</strong>${escapeHtml(
            order.addressComplement || "Nao informado"
          )}</span>
          <span><strong>Referencia</strong>${escapeHtml(
            order.addressReference || "Nao informado"
          )}</span>
          <span><strong>Bairro</strong>${escapeHtml(order.addressNeighborhood || "Nao informado")}</span>
          <span><strong>Cidade</strong>${escapeHtml(order.addressCity || "Nao informado")}</span>
          <span><strong>Observacoes</strong>${escapeHtml(
            order.customerNotes || "Sem observacoes do cliente."
          )}</span>
        </div>
      </section>
    </div>

    <section class="admin-detail-card">
      <h3>Itens do pedido</h3>
      <div class="admin-detail-section">
        <h4>Itens principais</h4>
        <div class="admin-detail-list">${renderOrderItems(order.items, "product")}</div>
      </div>
      <div class="admin-detail-section">
        <h4>Adicionais e complementos</h4>
        <div class="admin-detail-list">${renderOrderItems(order.items, "addon")}</div>
      </div>
    </section>

    <section class="admin-detail-card">
      <h3>Resumo financeiro</h3>
      <div class="admin-detail-totals">
        <span><strong>Subtotal</strong>${escapeHtml(formatMoney(order.subtotal || 0))}</span>
        <span><strong>Taxa de entrega</strong>${escapeHtml(
          formatMoney(order.deliveryFee || 0)
        )}</span>
        <span><strong>Complementos</strong>${escapeHtml(formatMoney(order.addonsTotal || 0))}</span>
        <span class="is-total"><strong>Total</strong>${escapeHtml(
          formatMoney(order.totalAmount || 0)
        )}</span>
      </div>
    </section>

    <section class="admin-detail-card">
      <h3>Historico de status</h3>
      <div class="admin-status-history">${renderStatusHistory(order.statusHistory)}</div>
    </section>
  `;

  const statusForm = detailRoot.querySelector("[data-admin-status-form]");

  if (statusForm) {
    statusForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const statusField = statusForm.elements.namedItem("status");
      const nextStatus = String(statusField?.value || "").trim();

      if (!nextStatus || !adminState.selectedOrderId) {
        return;
      }

      await updateOrderStatus(adminState.selectedOrderId, nextStatus);
    });
  }
};

const applySelectedOrderToList = (order) => {
  adminState.orders = adminState.orders.map((entry) =>
    entry.id === order.id ? { ...entry, ...pickOrderSummary(order) } : entry
  );
};

const loadOrderDetails = async (orderId, { showLoading = true } = {}) => {
  adminState.selectedOrderId = orderId;

  if (showLoading) {
    adminState.isLoadingOrderDetails = true;
    renderOrderList();
    renderOrderDetails();
  }

  const requestId = ++detailRequestSequence;

  try {
    const payload = await fetchJson(`/api/admin/orders/details?orderId=${encodeURIComponent(orderId)}`);

    if (requestId !== detailRequestSequence) {
      return;
    }

    adminState.selectedOrder = payload.order || null;
    adminState.isLoadingOrderDetails = false;
    adminState.storageMode = payload.storageMode || adminState.storageMode;

    if (adminState.selectedOrder) {
      applySelectedOrderToList(adminState.selectedOrder);
    }

    renderOrderList();
    renderOrderDetails();
    updateDashboardMeta();
  } catch (error) {
    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.isLoadingOrderDetails = false;
    renderOrderDetails();
  }
};

const loadDashboard = async ({ preserveSelection = true } = {}) => {
  const welcomeNode = document.querySelector("[data-admin-welcome]");

  adminState.isLoadingOrders = true;
  renderOrderList();
  updateDashboardMeta();

  try {
    const payload = await fetchJson("/api/admin/orders/list?limit=60");

    adminState.orders = Array.isArray(payload.orders)
      ? payload.orders
      : Array.isArray(payload.recentOrders)
        ? payload.recentOrders
        : [];
    adminState.stats = payload.stats || null;
    adminState.generatedAt = payload.generatedAt || "";
    adminState.storageMode = payload.storageMode || "";
    adminState.isLoadingOrders = false;

    if (welcomeNode) {
      welcomeNode.textContent = `Sessao ativa para ${payload.admin?.displayName || "Gestor Tokyo"}.`;
    }

    const orderStillExists =
      preserveSelection &&
      adminState.selectedOrderId &&
      adminState.orders.some((order) => order.id === adminState.selectedOrderId);
    const nextSelectedId =
      (orderStillExists && adminState.selectedOrderId) || adminState.orders[0]?.id || "";

    if (!adminState.selectedOrder || !orderStillExists) {
      adminState.selectedOrder = null;
    }

    adminState.selectedOrderId = nextSelectedId;

    renderDashboardStats(adminState.stats);
    renderStatusFilters();
    renderOrderList();
    renderOrderDetails();
    updateDashboardMeta();

    if (nextSelectedId) {
      await loadOrderDetails(nextSelectedId, {
        showLoading: !orderStillExists || !adminState.selectedOrder,
      });
    }
  } catch (error) {
    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    adminState.isLoadingOrders = false;
    renderOrderList();
    updateDashboardMeta();
  }
};

const updateOrderStatus = async (orderId, nextStatus) => {
  adminState.isUpdatingStatus = true;
  renderOrderDetails();

  try {
    const payload = await fetchJson("/api/admin/orders/status", {
      method: "POST",
      body: JSON.stringify({
        orderId,
        status: nextStatus,
      }),
    });

    adminState.selectedOrder = payload.order || adminState.selectedOrder;
    adminState.storageMode = payload.storageMode || adminState.storageMode;
    adminState.isUpdatingStatus = false;

    if (adminState.selectedOrder) {
      adminState.selectedOrderId = adminState.selectedOrder.id;
      applySelectedOrderToList(adminState.selectedOrder);
    }

    renderOrderList();
    renderOrderDetails();
    await loadDashboard({ preserveSelection: true });
  } catch (error) {
    adminState.isUpdatingStatus = false;

    if (error.status === 401) {
      redirectToLogin();
      return;
    }

    renderOrderDetails();
  }
};

const initDashboardPage = () => {
  const refreshButton = document.querySelector("[data-admin-refresh]");
  const logoutButton = document.querySelector("[data-admin-logout]");
  const listRoot = document.querySelector("[data-admin-order-list]");
  const filtersRoot = document.querySelector("[data-admin-status-filters]");

  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      void loadDashboard({ preserveSelection: true });
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      try {
        await fetchJson("/api/admin/logout", {
          method: "POST",
        });
      } catch (error) {
        // Mesmo que o logout falhe, seguimos para a tela de login para encerrar a sessao local.
      }

      window.location.href = "/admin/login.html";
    });
  }

  if (filtersRoot) {
    filtersRoot.addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter-status]");

      if (!button) {
        return;
      }

      adminState.activeFilter = String(button.dataset.filterStatus || "all");
      renderStatusFilters();
      renderOrderList();
      updateDashboardMeta();

      const filteredOrders = getFilteredOrders();

      if (filteredOrders.length === 0) {
        adminState.selectedOrderId = "";
        adminState.selectedOrder = null;
        renderOrderDetails();
        return;
      }

      const selectedOrderStillVisible = filteredOrders.some(
        (order) => order.id === adminState.selectedOrderId
      );

      if (!selectedOrderStillVisible) {
        void loadOrderDetails(filteredOrders[0].id);
      }
    });
  }

  if (listRoot) {
    listRoot.addEventListener("click", (event) => {
      const button = event.target.closest("[data-order-id]");

      if (!button) {
        return;
      }

      const orderId = String(button.dataset.orderId || "").trim();

      if (!orderId || orderId === adminState.selectedOrderId) {
        return;
      }

      void loadOrderDetails(orderId);
    });
  }

  void loadDashboard({ preserveSelection: false });
  window.setInterval(() => {
    void loadDashboard({ preserveSelection: true });
  }, ADMIN_DASHBOARD_REFRESH_MS);
};

const initLoginPage = async () => {
  const form = document.querySelector("[data-admin-login-form]");
  const submitButton = document.querySelector("[data-admin-login-submit]");
  const feedbackNode = document.querySelector("[data-admin-login-feedback]");

  if (!form) {
    return;
  }

  const nextField = form.elements.namedItem("next");

  if (nextField) {
    nextField.value = getSafeAdminRedirect();
  }

  try {
    const session = await fetchJson("/api/admin/session");

    if (session.authenticated) {
      window.location.href = getSafeAdminRedirect();
      return;
    }
  } catch (error) {
    setFeedback(feedbackNode, error.message);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const identifier = String(formData.get("identifier") || "").trim();
    const password = String(formData.get("password") || "");
    const next = String(formData.get("next") || "/admin/");

    if (!identifier || !password) {
      setFeedback(feedbackNode, "Preencha login e senha para continuar.");
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Entrando...";
    }

    setFeedback(feedbackNode, "");

    try {
      const payload = await fetchJson("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({
          identifier,
          password,
          next,
        }),
      });

      setFeedback(feedbackNode, "Login validado. Abrindo painel...", "success");
      window.location.href = payload.redirectTo || "/admin/";
    } catch (error) {
      setFeedback(feedbackNode, error.message || "Nao foi possivel entrar no gestor.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Entrar no gestor";
      }
    }
  });
};

const currentPage = document.body.dataset.adminPage;

if (currentPage === "login") {
  void initLoginPage();
}

if (currentPage === "dashboard") {
  initDashboardPage();
}
