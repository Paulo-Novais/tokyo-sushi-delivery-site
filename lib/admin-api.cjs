const {
  createAdminSessionToken,
  getAdminAuthConfig,
  getAdminAuthDiagnostics,
  getAdminSessionFromRequest,
  getConfiguredAdminUsers,
  hasAdminAuthConfig,
  normalizeIdentifier,
  serializeAdminLogoutCookie,
  serializeAdminSessionCookie,
} = require("./admin-auth.cjs");
const { requireAdminSession } = require("./admin-request.cjs");
const { buildHttpError, json, parseJsonBody } = require("./http.cjs");
const {
  deleteCatalogItem,
  deleteCatalogSection,
  deletePromotion,
  getAdminCatalog,
  getAdminPromotions,
  saveCatalogItem,
  saveCatalogSection,
  savePromotion,
  togglePromotionEnabled,
  updateCatalogItem,
} = require("./catalog-store.cjs");
const {
  getAdminDeliverySettings,
  updateDeliverySettings,
} = require("./delivery-settings-store.cjs");
const {
  getAdminRestaurantSettings,
  updateRestaurantSettings,
} = require("./restaurant-settings-store.cjs");
const { saveFinanceClosing } = require("./finance-store.cjs");
const {
  adjustInventoryStock,
  getAdminInventory,
  saveInventoryItem,
} = require("./inventory-store.cjs");
const {
  getAdminAuditLog,
  getAdminFinance,
  getAdminMetrics,
  getAdminOrderDetails,
  getAdminOrderList,
  getAdminScheduledOrders,
  updateAdminOrderStatus,
} = require("./order-store.cjs");
const {
  deleteReview,
  getAdminReviews,
  updateReviewVisibility,
} = require("./review-store.cjs");
const {
  getAdminCustomers,
  saveAdminCustomerProfile,
} = require("./customer-crm-store.cjs");
const {
  createRestaurantOnboarding,
  getMasterPlatformSnapshot,
  getPlanAccessForAdminModule,
  getRestaurantCommercialAccess,
  updateRestaurantSubscription,
} = require("./master-platform-store.cjs");
const {
  authenticateAdminUser,
  buildUsersPayload,
  getAdminAccessContext,
  hasManagedAdminUsers,
  recordAdminUserAccess,
  resetAdminUserPassword,
  saveAdminUser,
  setAdminUserStatus,
} = require("./user-permissions.cjs");
const {
  assertTenantContextMatchesSession,
  buildTenantContext,
  getRequestTenantContext,
  serializeTenantContext,
} = require("./tenant-context.cjs");
const {
  guardSecurity,
  recordSecurityEvent,
  recordSecurityFailure,
  recordSecuritySuccess,
} = require("./security-guardian.cjs");

const ADMIN_AUTH_ACTIONS = new Set(["login", "logout", "session"]);
const ADMIN_DASHBOARD_ACTIONS = new Set([
  "dashboard",
  "audit",
  "scheduled",
  "metrics",
  "finance",
]);
const ADMIN_ROUTE_GROUPS = new Set([
  "orders",
  "catalog",
  "promotions",
  "reviews",
  "delivery-settings",
  "settings",
  "finance",
  "inventory",
  "customers",
  "users",
  "exports",
  "master",
]);

const getRequestUrl = (req) => new URL(String(req.url || ""), "http://localhost");

const normalizeActionSegments = (value) =>
  String(value || "")
    .split("/")
    .map((entry) => entry.trim())
    .filter(Boolean);

const getAdminPathSegments = (req) => {
  const requestUrl = getRequestUrl(req);
  const segments = requestUrl.pathname.split("/").filter(Boolean).slice(2);
  const queryAction =
    requestUrl.searchParams.get("action") || requestUrl.searchParams.get("...action");

  if (
    queryAction &&
    (!segments.length || (segments.length === 1 && /^\[\.\.\..+\]$/.test(segments[0])))
  ) {
    return normalizeActionSegments(queryAction);
  }

  return segments;
};

const getAdminActionFromRequest = (req) => {
  const segments = getAdminPathSegments(req);
  return segments[segments.length - 1] || "";
};

const getAdminRouteGroup = (req) => {
  const segments = getAdminPathSegments(req);
  const firstSegment = segments[0] || "dashboard";

  if (firstSegment === "auth" || ADMIN_AUTH_ACTIONS.has(firstSegment)) {
    return "auth";
  }

  if (ADMIN_ROUTE_GROUPS.has(firstSegment)) {
    return firstSegment;
  }

  if (ADMIN_DASHBOARD_ACTIONS.has(firstSegment)) {
    return "dashboard";
  }

  return firstSegment;
};

const buildAdminPayload = (session, extra = {}) => {
  const { tenantContext: extraTenantContext, ...extraPayload } = extra;
  const tenantContext = session.tenantContext || extraTenantContext;
  const userType = session.userType || session.tipo_usuario || "MASTER";
  const isPlatformMaster =
    String(userType || "").trim().toUpperCase() === "MASTER" &&
    session.platformScope === true;
  const restaurantKey = isPlatformMaster ? "" : session.restaurantKey || "default";

  return {
    login: session.login,
    displayName: session.displayName,
    name: session.displayName,
    userType,
    tipo_usuario: session.tipo_usuario || session.userType || "MASTER",
    status: session.status || "ACTIVE",
    restaurantKey,
    platformScope: isPlatformMaster,
    permissions: session.permissions || {},
    permissionModules: session.permissionModules || [],
    ...(tenantContext ? { tenantContext: serializeTenantContext(tenantContext) } : {}),
    ...extraPayload,
  };
};

const getTenantStoreOptions = (session) => ({
  tenantContext: session?.tenantContext,
});

const buildAdminPayloadWithCommercialAccess = async (session, tenantContext = null) => {
  const commercialAccess = await getRestaurantCommercialAccess(
    tenantContext?.restaurantKey || session.restaurantKey || "default"
  );

  return buildAdminPayload(session, {
    commercialAccess,
    planAccess: commercialAccess,
    ...(tenantContext ? { tenantContext } : {}),
  });
};

const sendMethodNotAllowed = (res, allow) => {
  res.setHeader("Allow", allow);
  return json(res, 405, {
    error: "Metodo nao permitido.",
    errorCode: "method_not_allowed",
  });
};

const sendSecurityGuardianError = (res, error) => {
  if (error?.retryAfterSeconds) {
    res.setHeader("Retry-After", String(error.retryAfterSeconds));
  }

  return json(res, Number(error?.statusCode || 403), {
    error: error?.publicMessage || "Acesso negado.",
    errorCode: error?.errorCode || "security_access_denied",
    featureKey: error?.featureKey || undefined,
    planKey: error?.planKey || undefined,
    reason: error?.reason || undefined,
  });
};

const getSafeRedirectPath = (value) => {
  const candidate = String(value || "").trim();

  if (!candidate.startsWith("/admin")) {
    return "/admin/";
  }

  return candidate;
};

const handleAdminLogin = async (req, res) => {
  if (req.method !== "POST") {
    return sendMethodNotAllowed(res, "POST");
  }

  const configuredUsers = getConfiguredAdminUsers();
  const authConfig = getAdminAuthConfig();
  const hasConfiguredAccess =
    Boolean(authConfig.sessionSecret) &&
    (hasAdminAuthConfig() || (await hasManagedAdminUsers(configuredUsers)));

  if (!hasConfiguredAccess) {
    const diagnostics = getAdminAuthDiagnostics();
    return json(res, 503, {
      error: "O login administrativo ainda nao foi configurado no servidor.",
      errorCode: "admin_not_configured",
      missingRequirements: diagnostics.missingRequirements,
      configurationIssues: diagnostics.configurationIssues,
      acceptedEnvNames: diagnostics.acceptedEnvNames,
    });
  }

  const payload = parseJsonBody(req.body, { strict: true });
  const identifier = normalizeIdentifier(payload.identifier);
  const password = String(payload.password || "");

  if (!identifier || !password) {
    recordSecurityFailure(req, {
      routeType: "admin-auth",
      action: "login",
      reason: "missing_credentials",
      userKey: identifier,
    });
    return json(res, 400, {
      error: "Login e senha sao obrigatorios.",
      errorCode: "missing_credentials",
    });
  }

  let authenticatedAdmin = null;

  try {
    authenticatedAdmin = await authenticateAdminUser(identifier, password, configuredUsers);
  } catch (error) {
    recordSecurityFailure(req, {
      routeType: "admin-auth",
      action: "login",
      reason: error?.errorCode || "admin_login_error",
      userKey: identifier,
    });
    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || "Nao foi possivel autenticar o usuario.",
      errorCode: error?.errorCode || "admin_login_error",
    });
  }

  if (!authenticatedAdmin) {
    recordSecurityFailure(req, {
      routeType: "admin-auth",
      action: "login",
      reason: "invalid_credentials",
      userKey: identifier,
    });
    return json(res, 401, {
      error: "Login ou senha invalidos.",
      errorCode: "invalid_credentials",
    });
  }

  await recordAdminUserAccess(authenticatedAdmin.login, configuredUsers);
  recordSecuritySuccess(req, {
    routeType: "admin-auth",
    action: "login",
    reason: "admin_login_success",
    userKey: authenticatedAdmin.login,
  });

  let tenantContext;

  try {
    tenantContext = await getRequestTenantContext(req, {
      source: "admin:login",
    });
    assertTenantContextMatchesSession(tenantContext, authenticatedAdmin);
  } catch (error) {
    recordSecurityFailure(req, {
      routeType: "admin-auth",
      action: "login",
      reason: error?.errorCode || "tenant_login_mismatch",
      userKey: authenticatedAdmin.login,
    });
    return json(res, Number(error?.statusCode || 403), {
      error: "Acesso negado.",
      errorCode: error?.errorCode || "tenant_session_mismatch",
    });
  }

  const sessionToken = createAdminSessionToken({
    login: authenticatedAdmin.login,
    displayName: authenticatedAdmin.displayName,
  });

  return json(
    res,
    200,
    {
      ok: true,
      redirectTo: getSafeRedirectPath(payload.next),
      admin: await buildAdminPayloadWithCommercialAccess(authenticatedAdmin, tenantContext),
    },
    {
      "Set-Cookie": serializeAdminSessionCookie(sessionToken, req),
    }
  );
};

const handleAdminLogout = async (req, res) => {
  if (!["POST", "GET"].includes(req.method)) {
    return sendMethodNotAllowed(res, "GET, POST");
  }

  return json(
    res,
    200,
    {
      ok: true,
    },
    {
      "Set-Cookie": serializeAdminLogoutCookie(req),
    }
  );
};

const handleAdminSession = async (req, res) => {
  if (req.method !== "GET") {
    return sendMethodNotAllowed(res, "GET");
  }

  const configuredUsers = getConfiguredAdminUsers();
  const authConfig = getAdminAuthConfig();
  const hasConfiguredAccess =
    Boolean(authConfig.sessionSecret) &&
    (hasAdminAuthConfig() || (await hasManagedAdminUsers(configuredUsers)));

  if (!hasConfiguredAccess) {
    const diagnostics = getAdminAuthDiagnostics();
    return json(res, 503, {
      authenticated: false,
      configured: false,
      error: "O login administrativo ainda nao foi configurado no servidor.",
      errorCode: "admin_not_configured",
      missingRequirements: diagnostics.missingRequirements,
      configurationIssues: diagnostics.configurationIssues,
      acceptedEnvNames: diagnostics.acceptedEnvNames,
    });
  }

  const session = getAdminSessionFromRequest(req);

  if (!session) {
    return json(res, 200, {
      authenticated: false,
      configured: true,
    });
  }

  try {
    const accessContext = await getAdminAccessContext(session, [], configuredUsers);
    const tenantContext = await getRequestTenantContext(req, {
      source: "admin:session",
    });
    assertTenantContextMatchesSession(tenantContext, accessContext.session);
    const scopedSession = {
      ...accessContext.session,
      tenantContext,
    };

    return json(res, 200, {
      authenticated: true,
      configured: true,
      admin: await buildAdminPayloadWithCommercialAccess(scopedSession, tenantContext),
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    return json(res, Number(error?.statusCode || 403), {
      authenticated: false,
      configured: true,
      error: error?.message || "Sessao administrativa sem permissao.",
      errorCode: error?.errorCode || "admin_session_forbidden",
    });
  }
};

const handleAdminAuth = async (req, res) => {
  const action = getAdminActionFromRequest(req);

  if (action === "login") {
    return handleAdminLogin(req, res);
  }

  if (action === "logout") {
    return handleAdminLogout(req, res);
  }

  if (action === "session") {
    return handleAdminSession(req, res);
  }

  return json(res, 404, {
    error: "Operacao administrativa de autenticacao nao encontrada.",
    errorCode: "admin_auth_action_not_found",
  });
};

const resolveAdminDashboardAction = (req) => {
  const requestUrl = getRequestUrl(req);
  const segments = getAdminPathSegments(req);
  const pathAction = ADMIN_DASHBOARD_ACTIONS.has(segments[0]) ? segments[0] : "";

  return {
    requestUrl,
    action: String(requestUrl.searchParams.get("adminView") || pathAction || "dashboard")
      .trim()
      .toLowerCase(),
  };
};

const resolveDashboardPermission = (req) => {
  const { action } = resolveAdminDashboardAction(req);

  if (action === "audit") {
    return "developer_logs_view";
  }

  if (action === "scheduled") {
    return "orders_view";
  }

  if (action === "metrics") {
    return "reports_view";
  }

  if (action === "finance") {
    return "financial_view";
  }

  return "dashboard_view";
};

const resolveAdminRequiredPermissions = (req, group) => {
  const action = getAdminActionFromRequest(req);

  if (group === "auth") {
    return [];
  }

  if (group === "master") {
    return [];
  }

  if (group === "dashboard") {
    return resolveDashboardPermission(req);
  }

  if (group === "orders") {
    return action === "status" ? "orders_edit" : "orders_view";
  }

  if (group === "catalog") {
    if (action === "delete-item" || action === "delete-section") {
      return "catalog_delete";
    }

    if (action === "update") {
      return "catalog_edit";
    }

    if (action === "save-item" || action === "save-section") {
      return ["catalog_create", "catalog_edit"];
    }

    return "catalog_view";
  }

  if (group === "promotions") {
    if (action === "delete") {
      return "promotions_delete";
    }

    if (action === "toggle") {
      return "promotions_edit";
    }

    if (action === "save") {
      return ["promotions_create", "promotions_edit"];
    }

    return "promotions_view";
  }

  if (group === "reviews") {
    if (action === "delete") {
      return "reviews_delete";
    }

    if (action === "visibility") {
      return "reviews_edit";
    }

    return "reviews_view";
  }

  if (group === "customers") {
    return action === "save" ? "customers_edit" : "customers_view";
  }

  if (group === "delivery-settings") {
    return action === "save" ? "delivery_edit" : "delivery_view";
  }

  if (group === "settings") {
    return action === "save" ? "settings_edit" : "settings_view";
  }

  if (group === "inventory") {
    if (action === "save-item") {
      return ["inventory_create", "inventory_edit"];
    }

    if (action === "adjust-stock") {
      return "inventory_edit";
    }

    return "inventory_view";
  }

  if (group === "finance") {
    return req.method === "POST" ? "financial_edit" : "financial_view";
  }

  if (group === "exports") {
    return "exports_view";
  }

  if (group === "users") {
    if (action === "save") {
      return ["users_create", "users_edit"];
    }

    if (["status", "reset-password"].includes(action)) {
      return "users_edit";
    }

    return "users_view";
  }

  return "dashboard_view";
};

const requireAdminAccessForRequest = async (req, requiredPermissions = []) => {
  const session = getAdminSessionFromRequest(req);
  const accessContext = await getAdminAccessContext(
    session,
    requiredPermissions,
    getConfiguredAdminUsers()
  );
  const tenantContext = await getRequestTenantContext(req, {
    source: "admin:api",
  });
  assertTenantContextMatchesSession(tenantContext, accessContext.session);

  req.adminSession = {
    ...accessContext.session,
    tenantContext,
  };
  req.adminUser = accessContext.user;

  return req.adminSession;
};

const requireMasterAccessForRequest = async (req) => {
  const session = await requireAdminAccessForRequest(req, []);
  const userType = String(session.userType || session.tipo_usuario || "").trim().toUpperCase();

  if (userType !== "MASTER") {
    throw buildHttpError(
      403,
      "Acesso exclusivo para MASTER da plataforma.",
      "master_access_required"
    );
  }

  return session;
};

const requirePlanAccessForRequest = async (req, group) => {
  const session = requireAdminSession(req);
  const action =
    group === "dashboard"
      ? resolveAdminDashboardAction(req).action
      : getAdminActionFromRequest(req);
  const planAccess = await getPlanAccessForAdminModule({
    group,
    action,
    restaurantKey: session.restaurantKey || "default",
  });

  if (!planAccess.allowed) {
    throw buildHttpError(
      403,
      "Este modulo nao esta disponivel no plano atual.",
      "plan_feature_forbidden",
      {
        featureKey: planAccess.featureKey,
        planKey: planAccess.commercialAccess?.planKey,
        reason: planAccess.reason,
      }
    );
  }

  req.planAccess = planAccess;
  return planAccess;
};

const handleAdminDashboard = async (req, res) => {
  if (req.method !== "GET") {
    return sendMethodNotAllowed(res, "GET");
  }

  try {
    const session = requireAdminSession(req);
    const tenantOptions = getTenantStoreOptions(session);
    const { action, requestUrl } = resolveAdminDashboardAction(req);
    let payload;

    if (action === "audit") {
      payload = await getAdminAuditLog(
        {
          adminLogin: String(requestUrl.searchParams.get("adminLogin") || "").trim(),
          action: String(requestUrl.searchParams.get("action") || "").trim(),
          orderQuery: String(requestUrl.searchParams.get("orderQuery") || "").trim(),
          limit: String(requestUrl.searchParams.get("limit") || "").trim(),
        },
        tenantOptions
      );
    } else if (action === "scheduled") {
      payload = await getAdminScheduledOrders(
        {
          date: String(requestUrl.searchParams.get("date") || "").trim(),
          fulfillmentMode: String(requestUrl.searchParams.get("fulfillmentMode") || "").trim(),
        },
        tenantOptions
      );
    } else if (action === "metrics") {
      payload = await getAdminMetrics(
        {
          period: String(requestUrl.searchParams.get("period") || "").trim(),
          startDate: String(requestUrl.searchParams.get("startDate") || "").trim(),
          endDate: String(requestUrl.searchParams.get("endDate") || "").trim(),
          adminLogin: String(requestUrl.searchParams.get("adminLogin") || "").trim(),
          status: String(requestUrl.searchParams.get("status") || "").trim(),
          flow: String(requestUrl.searchParams.get("flow") || "").trim(),
        },
        tenantOptions
      );
    } else if (action === "finance") {
      payload = await getAdminFinance(
        {
          period: String(requestUrl.searchParams.get("period") || "").trim(),
          startDate: String(requestUrl.searchParams.get("startDate") || "").trim(),
          endDate: String(requestUrl.searchParams.get("endDate") || "").trim(),
        },
        tenantOptions
      );
    } else {
      payload = await getAdminOrderList(40, tenantOptions);
    }

    return json(res, 200, {
      ok: true,
      admin: buildAdminPayload(session),
      ...payload,
    });
  } catch (error) {
    return json(res, Number(error?.statusCode || 500), {
      error:
        error?.message ||
        "Nao foi possivel carregar os dados administrativos solicitados.",
      errorCode:
        error?.errorCode ||
        (error?.statusCode ? "dashboard_error" : "internal_error"),
    });
  }
};

const parseLimit = (value) => {
  const numericValue = Number.parseInt(String(value || ""), 10);

  if (!Number.isFinite(numericValue)) {
    return 40;
  }

  return Math.min(Math.max(numericValue, 1), 100);
};

const handleOrderList = async (req, res, session, requestUrl) => {
  const payload = await getAdminOrderList(
    parseLimit(requestUrl.searchParams.get("limit")),
    getTenantStoreOptions(session)
  );

  return json(res, 200, {
    ok: true,
    admin: buildAdminPayload(session),
    ...payload,
  });
};

const handleOrderDetails = async (req, res, session, requestUrl) => {
  const orderId = String(
    requestUrl.searchParams.get("orderId") || requestUrl.searchParams.get("id") || ""
  ).trim();

  if (!orderId) {
    throw buildHttpError(400, "Informe o pedido que deseja abrir.", "missing_order_identifier");
  }

  const payload = await getAdminOrderDetails(orderId, getTenantStoreOptions(session));

  return json(res, 200, {
    ok: true,
    admin: buildAdminPayload(session),
    ...payload,
  });
};

const handleOrderStatus = async (req, res, session) => {
  const payload = parseJsonBody(req.body, { strict: true });
  const orderId = String(payload.orderId || payload.id || "").trim();
  const status = String(payload.status || "").trim();
  const note = String(payload.note || "").trim();
  const manual = Boolean(payload.manual);

  if (!orderId) {
    throw buildHttpError(400, "Informe o pedido que deseja atualizar.", "missing_order_identifier");
  }

  if (!status) {
    throw buildHttpError(400, "Informe o novo status do pedido.", "missing_order_status");
  }

  const result = await updateAdminOrderStatus(orderId, status, note, {
    manual,
    tenantContext: session.tenantContext,
    actor: buildAdminPayload(session),
  });

  return json(res, 200, {
    ok: true,
    admin: buildAdminPayload(session),
    ...result,
  });
};

const handleAdminOrders = async (req, res) => {
  try {
    const session = requireAdminSession(req);
    const action = getAdminActionFromRequest(req);
    const requestUrl = getRequestUrl(req);

    if (action === "list") {
      if (req.method !== "GET") {
        return sendMethodNotAllowed(res, "GET");
      }

      return await handleOrderList(req, res, session, requestUrl);
    }

    if (action === "details") {
      if (req.method !== "GET") {
        return sendMethodNotAllowed(res, "GET");
      }

      return await handleOrderDetails(req, res, session, requestUrl);
    }

    if (action === "status") {
      if (req.method !== "POST") {
        return sendMethodNotAllowed(res, "POST");
      }

      return await handleOrderStatus(req, res, session);
    }

    return json(res, 404, {
      error: "Operacao administrativa nao encontrada.",
      errorCode: "admin_order_action_not_found",
    });
  } catch (error) {
    const action = getAdminActionFromRequest(req);
    const fallbackMessages = {
      list: "Nao foi possivel listar os pedidos do gestor.",
      details: "Nao foi possivel carregar os detalhes do pedido.",
      status: "Nao foi possivel atualizar o status do pedido.",
    };
    const fallbackErrorCodes = {
      list: "admin_orders_error",
      details: "admin_order_details_error",
      status: "admin_order_status_error",
    };

    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || fallbackMessages[action] || "Nao foi possivel concluir a operacao.",
      errorCode:
        error?.errorCode ||
        (error?.statusCode ? fallbackErrorCodes[action] || "admin_orders_error" : "internal_error"),
    });
  }
};

const handleCatalogList = async (req, res, session, requestUrl) => {
  const payload = await getAdminCatalog(
    {
      query: String(requestUrl.searchParams.get("query") || "").trim(),
      sectionId: String(requestUrl.searchParams.get("sectionId") || "").trim(),
      availabilityState: String(requestUrl.searchParams.get("availabilityState") || "").trim(),
    },
    getTenantStoreOptions(session)
  );

  return json(res, 200, {
    ok: true,
    admin: buildAdminPayload(session),
    ...payload,
  });
};

const handleCatalogUpdate = async (req, res, session) => {
  const payload = parseJsonBody(req.body, { strict: true });

  if (!payload || typeof payload !== "object") {
    throw buildHttpError(400, "Informe os dados do item que deseja atualizar.", "invalid_catalog_payload");
  }

  const result = await updateCatalogItem(payload, buildAdminPayload(session), getTenantStoreOptions(session));

  return json(res, 200, {
    ok: true,
    admin: buildAdminPayload(session),
    ...result,
  });
};

const readCatalogPayload = (req, fallbackMessage) => {
  const payload = parseJsonBody(req.body, { strict: true });

  if (!payload || typeof payload !== "object") {
    throw buildHttpError(400, fallbackMessage, "invalid_catalog_payload");
  }

  return payload;
};

const handleCatalogSaveSection = async (req, res, session) => {
  const result = await saveCatalogSection(
    readCatalogPayload(req, "Informe os dados da categoria que deseja salvar."),
    buildAdminPayload(session),
    getTenantStoreOptions(session)
  );

  return json(res, 200, {
    ok: true,
    admin: buildAdminPayload(session),
    ...result,
  });
};

const handleCatalogDeleteSection = async (req, res, session) => {
  const result = await deleteCatalogSection(
    readCatalogPayload(req, "Informe a categoria que deseja remover."),
    buildAdminPayload(session),
    getTenantStoreOptions(session)
  );

  return json(res, 200, {
    ok: true,
    admin: buildAdminPayload(session),
    ...result,
  });
};

const handleCatalogSaveItem = async (req, res, session) => {
  const result = await saveCatalogItem(
    readCatalogPayload(req, "Informe os dados do prato que deseja salvar."),
    buildAdminPayload(session),
    getTenantStoreOptions(session)
  );

  return json(res, 200, {
    ok: true,
    admin: buildAdminPayload(session),
    ...result,
  });
};

const handleCatalogDeleteItem = async (req, res, session) => {
  const result = await deleteCatalogItem(
    readCatalogPayload(req, "Informe o prato que deseja remover."),
    buildAdminPayload(session),
    getTenantStoreOptions(session)
  );

  return json(res, 200, {
    ok: true,
    admin: buildAdminPayload(session),
    ...result,
  });
};

const handleAdminCatalog = async (req, res) => {
  try {
    const session = requireAdminSession(req);
    const action = getAdminActionFromRequest(req);
    const requestUrl = getRequestUrl(req);

    if (action === "list") {
      if (req.method !== "GET") {
        return sendMethodNotAllowed(res, "GET");
      }

      return handleCatalogList(req, res, session, requestUrl);
    }

    if (action === "update") {
      if (req.method !== "POST") {
        return sendMethodNotAllowed(res, "POST");
      }

      return handleCatalogUpdate(req, res, session);
    }

    if (action === "save-section") {
      if (req.method !== "POST") {
        return sendMethodNotAllowed(res, "POST");
      }

      return handleCatalogSaveSection(req, res, session);
    }

    if (action === "delete-section") {
      if (req.method !== "POST") {
        return sendMethodNotAllowed(res, "POST");
      }

      return handleCatalogDeleteSection(req, res, session);
    }

    if (action === "save-item") {
      if (req.method !== "POST") {
        return sendMethodNotAllowed(res, "POST");
      }

      return handleCatalogSaveItem(req, res, session);
    }

    if (action === "delete-item") {
      if (req.method !== "POST") {
        return sendMethodNotAllowed(res, "POST");
      }

      return handleCatalogDeleteItem(req, res, session);
    }

    return json(res, 404, {
      error: "Operacao administrativa do catalogo nao encontrada.",
      errorCode: "admin_catalog_action_not_found",
    });
  } catch (error) {
    const action = getAdminActionFromRequest(req);
    const fallbackMessages = {
      "delete-item": "Nao foi possivel remover o prato do catalogo.",
      "delete-section": "Nao foi possivel remover a categoria do catalogo.",
      list: "Nao foi possivel carregar o catalogo administrativo.",
      "save-item": "Nao foi possivel salvar o prato do catalogo.",
      "save-section": "Nao foi possivel salvar a categoria do catalogo.",
      update: "Nao foi possivel atualizar o item do catalogo.",
    };
    const fallbackErrorCodes = {
      "delete-item": "admin_catalog_delete_item_error",
      "delete-section": "admin_catalog_delete_section_error",
      list: "admin_catalog_error",
      "save-item": "admin_catalog_save_item_error",
      "save-section": "admin_catalog_save_section_error",
      update: "admin_catalog_update_error",
    };

    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || fallbackMessages[action] || "Nao foi possivel concluir a operacao.",
      errorCode:
        error?.errorCode ||
        (error?.statusCode ? fallbackErrorCodes[action] || "admin_catalog_error" : "internal_error"),
    });
  }
};

const handlePromotionList = async (req, res, session, requestUrl) => {
  const payload = await getAdminPromotions(
    {
      status: String(requestUrl.searchParams.get("status") || "").trim(),
    },
    getTenantStoreOptions(session)
  );

  return json(res, 200, {
    ok: true,
    admin: buildAdminPayload(session),
    ...payload,
  });
};

const handlePromotionSave = async (req, res, session) => {
  const payload = parseJsonBody(req.body, { strict: true });

  if (!payload || typeof payload !== "object") {
    throw buildHttpError(400, "Informe os dados da promocao que deseja salvar.", "invalid_promotion_payload");
  }

  const result = await savePromotion(payload, buildAdminPayload(session), getTenantStoreOptions(session));

  return json(res, 200, {
    ok: true,
    admin: buildAdminPayload(session),
    ...result,
  });
};

const handlePromotionToggle = async (req, res, session) => {
  const payload = parseJsonBody(req.body, { strict: true });

  if (!payload || typeof payload !== "object") {
    throw buildHttpError(400, "Informe a promocao que deseja ativar ou desativar.", "invalid_promotion_payload");
  }

  const result = await togglePromotionEnabled(payload, buildAdminPayload(session), getTenantStoreOptions(session));

  return json(res, 200, {
    ok: true,
    admin: buildAdminPayload(session),
    ...result,
  });
};

const handlePromotionDelete = async (req, res, session) => {
  const payload = parseJsonBody(req.body, { strict: true });

  if (!payload || typeof payload !== "object") {
    throw buildHttpError(400, "Informe a promocao que deseja remover.", "invalid_promotion_payload");
  }

  const result = await deletePromotion(payload, getTenantStoreOptions(session));

  return json(res, 200, {
    ok: true,
    ...result,
  });
};

const handleAdminPromotions = async (req, res) => {
  try {
    const session = requireAdminSession(req);
    const action = getAdminActionFromRequest(req);
    const requestUrl = getRequestUrl(req);

    if (action === "list") {
      if (req.method !== "GET") {
        return sendMethodNotAllowed(res, "GET");
      }

      return handlePromotionList(req, res, session, requestUrl);
    }

    if (action === "save") {
      if (req.method !== "POST") {
        return sendMethodNotAllowed(res, "POST");
      }

      return handlePromotionSave(req, res, session);
    }

    if (action === "toggle") {
      if (req.method !== "POST") {
        return sendMethodNotAllowed(res, "POST");
      }

      return handlePromotionToggle(req, res, session);
    }

    if (action === "delete") {
      if (req.method !== "POST") {
        return sendMethodNotAllowed(res, "POST");
      }

      return handlePromotionDelete(req, res, session);
    }

    return json(res, 404, {
      error: "Operacao administrativa de promocao nao encontrada.",
      errorCode: "admin_promotion_action_not_found",
    });
  } catch (error) {
    const action = getAdminActionFromRequest(req);
    const fallbackMessages = {
      list: "Nao foi possivel carregar as promocoes administrativas.",
      save: "Nao foi possivel salvar a promocao.",
      toggle: "Nao foi possivel atualizar o status da promocao.",
      delete: "Nao foi possivel remover a promocao.",
    };
    const fallbackErrorCodes = {
      list: "admin_promotions_error",
      save: "admin_promotions_save_error",
      toggle: "admin_promotions_toggle_error",
      delete: "admin_promotions_delete_error",
    };

    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || fallbackMessages[action] || "Nao foi possivel concluir a operacao.",
      errorCode:
        error?.errorCode ||
        (error?.statusCode
          ? fallbackErrorCodes[action] || "admin_promotions_error"
          : "internal_error"),
    });
  }
};

const handleReviewList = async (req, res, session) => {
  const payload = await getAdminReviews(getTenantStoreOptions(session));

  return json(res, 200, {
    ok: true,
    admin: buildAdminPayload(session),
    ...payload,
  });
};

const handleReviewVisibility = async (req, res, session) => {
  const payload = parseJsonBody(req.body, { strict: true });

  if (!payload || typeof payload !== "object") {
    throw buildHttpError(400, "Informe a avaliacao que deseja atualizar.", "invalid_review_payload");
  }

  const result = await updateReviewVisibility(payload, buildAdminPayload(session), getTenantStoreOptions(session));

  return json(res, 200, {
    ok: true,
    admin: buildAdminPayload(session),
    ...result,
  });
};

const handleReviewDelete = async (req, res, session) => {
  const payload = parseJsonBody(req.body, { strict: true });

  if (!payload || typeof payload !== "object") {
    throw buildHttpError(400, "Informe a avaliacao que deseja remover.", "invalid_review_payload");
  }

  return json(res, 200, {
    ok: true,
    ...(await deleteReview(payload, getTenantStoreOptions(session))),
  });
};

const handleAdminReviews = async (req, res) => {
  try {
    const session = requireAdminSession(req);
    const action = getAdminActionFromRequest(req);

    if (action === "list") {
      if (req.method !== "GET") {
        return sendMethodNotAllowed(res, "GET");
      }

      return handleReviewList(req, res, session);
    }

    if (action === "visibility") {
      if (req.method !== "POST") {
        return sendMethodNotAllowed(res, "POST");
      }

      return handleReviewVisibility(req, res, session);
    }

    if (action === "delete") {
      if (req.method !== "POST") {
        return sendMethodNotAllowed(res, "POST");
      }

      return handleReviewDelete(req, res, session);
    }

    return json(res, 404, {
      error: "Operacao administrativa de avaliacao nao encontrada.",
      errorCode: "admin_reviews_action_not_found",
    });
  } catch (error) {
    const action = getAdminActionFromRequest(req);
    const fallbackMessages = {
      list: "Nao foi possivel carregar as avaliacoes administrativas.",
      visibility: "Nao foi possivel atualizar a visibilidade da avaliacao.",
      delete: "Nao foi possivel remover a avaliacao.",
    };
    const fallbackErrorCodes = {
      list: "admin_reviews_error",
      visibility: "admin_reviews_visibility_error",
      delete: "admin_reviews_delete_error",
    };

    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || fallbackMessages[action] || "Nao foi possivel concluir a operacao.",
      errorCode:
        error?.errorCode ||
        (error?.statusCode ? fallbackErrorCodes[action] || "admin_reviews_error" : "internal_error"),
    });
  }
};

const handleAdminCustomers = async (req, res) => {
  const action = getAdminActionFromRequest(req);

  try {
    const session = requireAdminSession(req);
    const requestUrl = getRequestUrl(req);

    if (action === "list") {
      if (req.method !== "GET") {
        return sendMethodNotAllowed(res, "GET");
      }

      const payload = await getAdminCustomers(
        {
          query: String(requestUrl.searchParams.get("query") || "").trim(),
          tag: String(requestUrl.searchParams.get("tag") || "").trim(),
          inactiveDays: String(requestUrl.searchParams.get("inactiveDays") || "").trim(),
          sortBy: String(requestUrl.searchParams.get("sortBy") || "").trim(),
        },
        getTenantStoreOptions(session)
      );

      return json(res, 200, {
        ok: true,
        admin: buildAdminPayload(session),
        ...payload,
      });
    }

    if (action === "save") {
      if (req.method !== "POST") {
        return sendMethodNotAllowed(res, "POST");
      }

      const payload = parseJsonBody(req.body, { strict: true });
      const result = await saveAdminCustomerProfile(
        payload,
        buildAdminPayload(session),
        getTenantStoreOptions(session)
      );

      return json(res, 200, {
        ok: true,
        admin: buildAdminPayload(session),
        ...result,
      });
    }

    return json(res, 404, {
      error: "Operacao administrativa de clientes nao encontrada.",
      errorCode: "admin_customers_action_not_found",
    });
  } catch (error) {
    const fallbackMessages = {
      list: "Nao foi possivel carregar o CRM de clientes.",
      save: "Nao foi possivel salvar o perfil do cliente.",
    };
    const fallbackErrorCodes = {
      list: "admin_customers_error",
      save: "admin_customer_save_error",
    };

    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || fallbackMessages[action] || "Nao foi possivel concluir a operacao.",
      errorCode:
        error?.errorCode ||
        (error?.statusCode ? fallbackErrorCodes[action] || "admin_customers_error" : "internal_error"),
    });
  }
};

const handleDeliverySettingsList = async (req, res, session) =>
  json(res, 200, {
    ok: true,
    admin: buildAdminPayload(session),
    ...(await getAdminDeliverySettings(getTenantStoreOptions(session))),
  });

const handleDeliverySettingsSave = async (req, res, session) => {
  const payload = parseJsonBody(req.body, { strict: true });

  return json(res, 200, {
    ok: true,
    admin: buildAdminPayload(session),
    ...(await updateDeliverySettings(payload, buildAdminPayload(session), getTenantStoreOptions(session))),
  });
};

const handleAdminDeliverySettings = async (req, res) => {
  const action = getAdminActionFromRequest(req);

  try {
    const session = requireAdminSession(req);

    if (action === "list") {
      if (req.method !== "GET") {
        return sendMethodNotAllowed(res, "GET");
      }

      return handleDeliverySettingsList(req, res, session);
    }

    if (action === "save") {
      if (req.method !== "POST") {
        return sendMethodNotAllowed(res, "POST");
      }

      return handleDeliverySettingsSave(req, res, session);
    }

    return json(res, 404, {
      error: "Operacao administrativa de entrega nao encontrada.",
      errorCode: "admin_delivery_settings_action_not_found",
    });
  } catch (error) {
    const fallbackMessages = {
      list: "Nao foi possivel carregar as configuracoes de entrega.",
      save: "Nao foi possivel salvar as configuracoes de entrega.",
    };
    const fallbackErrorCodes = {
      list: "admin_delivery_settings_error",
      save: "admin_delivery_settings_save_error",
    };

    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || fallbackMessages[action] || "Nao foi possivel concluir a operacao.",
      errorCode:
        error?.errorCode ||
        (error?.statusCode ? fallbackErrorCodes[action] || "admin_delivery_settings_error" : "internal_error"),
    });
  }
};

const handleRestaurantSettingsList = async (req, res, session) =>
  json(res, 200, {
    ok: true,
    admin: buildAdminPayload(session),
    ...(await getAdminRestaurantSettings(getTenantStoreOptions(session))),
  });

const handleRestaurantSettingsSave = async (req, res, session) => {
  const payload = parseJsonBody(req.body, { strict: true });

  return json(res, 200, {
    ok: true,
    admin: buildAdminPayload(session),
    ...(await updateRestaurantSettings(payload, buildAdminPayload(session), getTenantStoreOptions(session))),
  });
};

const handleAdminRestaurantSettings = async (req, res) => {
  const action = getAdminActionFromRequest(req);

  try {
    const session = requireAdminSession(req);

    if (action === "list") {
      if (req.method !== "GET") {
        return sendMethodNotAllowed(res, "GET");
      }

      return handleRestaurantSettingsList(req, res, session);
    }

    if (action === "save") {
      if (req.method !== "POST") {
        return sendMethodNotAllowed(res, "POST");
      }

      return handleRestaurantSettingsSave(req, res, session);
    }

    return json(res, 404, {
      error: "Operacao administrativa de configuracoes nao encontrada.",
      errorCode: "admin_restaurant_settings_action_not_found",
    });
  } catch (error) {
    const fallbackMessages = {
      list: "Nao foi possivel carregar as configuracoes do restaurante.",
      save: "Nao foi possivel salvar as configuracoes do restaurante.",
    };
    const fallbackErrorCodes = {
      list: "admin_restaurant_settings_error",
      save: "admin_restaurant_settings_save_error",
    };

    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || fallbackMessages[action] || "Nao foi possivel concluir a operacao.",
      errorCode:
        error?.errorCode ||
        (error?.statusCode
          ? fallbackErrorCodes[action] || "admin_restaurant_settings_error"
          : "internal_error"),
    });
  }
};

const handleInventoryList = async (req, res, session, requestUrl) =>
  json(res, 200, {
    ok: true,
    admin: buildAdminPayload(session),
    ...(await getAdminInventory(
      {
        query: String(requestUrl.searchParams.get("query") || "").trim(),
        category: String(requestUrl.searchParams.get("category") || "").trim(),
        status: String(requestUrl.searchParams.get("status") || "").trim(),
      },
      getTenantStoreOptions(session)
    )),
  });

const handleInventorySaveItem = async (req, res, session) => {
  const payload = parseJsonBody(req.body, { strict: true });

  if (!payload || typeof payload !== "object") {
    throw buildHttpError(400, "Informe os dados do item do estoque.", "invalid_inventory_payload");
  }

  return json(res, 200, {
    ok: true,
    admin: buildAdminPayload(session),
    ...(await saveInventoryItem(payload, buildAdminPayload(session), getTenantStoreOptions(session))),
  });
};

const handleInventoryAdjustStock = async (req, res, session) => {
  const payload = parseJsonBody(req.body, { strict: true });

  if (!payload || typeof payload !== "object") {
    throw buildHttpError(400, "Informe a movimentacao do estoque.", "invalid_inventory_adjustment_payload");
  }

  return json(res, 200, {
    ok: true,
    admin: buildAdminPayload(session),
    ...(await adjustInventoryStock(payload, buildAdminPayload(session), getTenantStoreOptions(session))),
  });
};

const handleAdminInventory = async (req, res) => {
  const action = getAdminActionFromRequest(req);

  try {
    const session = requireAdminSession(req);
    const requestUrl = getRequestUrl(req);

    if (action === "list") {
      if (req.method !== "GET") {
        return sendMethodNotAllowed(res, "GET");
      }

      return handleInventoryList(req, res, session, requestUrl);
    }

    if (action === "save-item") {
      if (req.method !== "POST") {
        return sendMethodNotAllowed(res, "POST");
      }

      return handleInventorySaveItem(req, res, session);
    }

    if (action === "adjust-stock") {
      if (req.method !== "POST") {
        return sendMethodNotAllowed(res, "POST");
      }

      return handleInventoryAdjustStock(req, res, session);
    }

    return json(res, 404, {
      error: "Operacao administrativa de estoque nao encontrada.",
      errorCode: "admin_inventory_action_not_found",
    });
  } catch (error) {
    const fallbackMessages = {
      list: "Nao foi possivel carregar o estoque administrativo.",
      "save-item": "Nao foi possivel salvar o item do estoque.",
      "adjust-stock": "Nao foi possivel movimentar o estoque.",
    };
    const fallbackErrorCodes = {
      list: "admin_inventory_error",
      "save-item": "admin_inventory_save_item_error",
      "adjust-stock": "admin_inventory_adjust_stock_error",
    };

    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || fallbackMessages[action] || "Nao foi possivel concluir a operacao.",
      errorCode:
        error?.errorCode ||
        (error?.statusCode ? fallbackErrorCodes[action] || "admin_inventory_error" : "internal_error"),
    });
  }
};

const handleAdminFinance = async (req, res) => {
  try {
    const session = requireAdminSession(req);
    const requestUrl = getRequestUrl(req);
    const tenantOptions = getTenantStoreOptions(session);

    if (req.method === "GET") {
      const payload = await getAdminFinance(
        {
          period: String(requestUrl.searchParams.get("period") || "").trim(),
          startDate: String(requestUrl.searchParams.get("startDate") || "").trim(),
          endDate: String(requestUrl.searchParams.get("endDate") || "").trim(),
        },
        tenantOptions
      );

      return json(res, 200, {
        ok: true,
        admin: buildAdminPayload(session),
        ...payload,
      });
    }

    if (req.method === "POST") {
      const body = parseJsonBody(req.body, { strict: true });
      const financeFilters = body.filters || {};
      const snapshot = await getAdminFinance(financeFilters, tenantOptions);
      const closingPayload = body.closing || body;
      const result = await saveFinanceClosing(
        {
          periodKey: snapshot.filters.periodKey,
          periodStartDate: snapshot.filters.startDate,
          periodEndDate: snapshot.filters.endDate,
          countedCash: closingPayload.countedCash,
          notes: closingPayload.notes,
        },
        buildAdminPayload(session),
        tenantOptions
      );
      const updatedSnapshot = await getAdminFinance(snapshot.filters, tenantOptions);

      return json(res, 200, {
        ok: true,
        admin: buildAdminPayload(session),
        message: "Fechamento financeiro salvo com sucesso.",
        storageMode: result.storageMode,
        ...updatedSnapshot,
      });
    }

    return sendMethodNotAllowed(res, "GET, POST");
  } catch (error) {
    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || "Nao foi possivel processar o financeiro.",
      errorCode:
        error?.errorCode ||
        (error?.statusCode ? "admin_finance_error" : "internal_error"),
    });
  }
};

const EXPORT_SCOPE_ACCESS = Object.freeze({
  orders: { permission: "orders_view", group: "orders", action: "list" },
  customers: { permission: "customers_view", group: "customers", action: "list" },
  catalog: { permission: "catalog_view", group: "catalog", action: "list" },
  products: { permission: "catalog_view", group: "catalog", action: "list" },
  inventory: { permission: "inventory_view", group: "inventory", action: "list" },
  stock: { permission: "inventory_view", group: "inventory", action: "list" },
  finance: { permission: "financial_view", group: "finance", action: "finance" },
  settings: { permission: "settings_view", group: "settings", action: "list" },
});
const EXPORT_SCOPE_ALIASES = Object.freeze({
  all: ["orders", "customers", "catalog", "inventory", "finance", "settings"],
  orders: ["orders"],
  pedidos: ["orders"],
  customers: ["customers"],
  clientes: ["customers"],
  catalog: ["catalog"],
  products: ["catalog"],
  produtos: ["catalog"],
  inventory: ["inventory"],
  stock: ["inventory"],
  estoque: ["inventory"],
  finance: ["finance"],
  financeiro: ["finance"],
  settings: ["settings"],
  configuracoes: ["settings"],
});

const normalizeExportScopes = (value) => {
  const requestedScopes = String(value || "all")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const resolvedScopes = [];

  (requestedScopes.length ? requestedScopes : ["all"]).forEach((scope) => {
    const scopeList = EXPORT_SCOPE_ALIASES[scope];

    if (!scopeList) {
      throw buildHttpError(400, "Escopo de exportacao invalido.", "invalid_export_scope");
    }

    scopeList.forEach((entry) => {
      if (!resolvedScopes.includes(entry)) {
        resolvedScopes.push(entry);
      }
    });
  });

  return resolvedScopes;
};

const assertExportScopeAccess = async (session, scopes) => {
  const permissions = session.permissions || {};

  for (const scope of scopes) {
    const access = EXPORT_SCOPE_ACCESS[scope];

    if (access?.permission && permissions[access.permission] !== true) {
      throw buildHttpError(403, "Acesso negado para este modulo.", "admin_permission_denied", {
        requiredPermissions: [access.permission],
      });
    }

    if (access?.group) {
      const planAccess = await getPlanAccessForAdminModule({
        group: access.group,
        action: access.action,
        restaurantKey: session.restaurantKey || "default",
      });

      if (!planAccess.allowed) {
        throw buildHttpError(
          403,
          "Este modulo nao esta disponivel no plano atual.",
          "plan_feature_forbidden",
          {
            featureKey: planAccess.featureKey,
            planKey: planAccess.commercialAccess?.planKey,
            reason: planAccess.reason,
          }
        );
      }
    }
  }
};

const buildExportData = async (scopes, tenantOptions, requestUrl) => {
  const data = {};
  const limit = parseLimit(requestUrl.searchParams.get("limit") || "500");

  if (scopes.includes("orders")) {
    const payload = await getAdminOrderList(limit, tenantOptions);
    data.orders = payload.orders || [];
    data.ordersSummary = payload.summary || null;
  }

  if (scopes.includes("customers")) {
    const payload = await getAdminCustomers({}, tenantOptions);
    data.customers = payload.customers || [];
  }

  if (scopes.includes("catalog")) {
    const payload = await getAdminCatalog({}, tenantOptions);
    data.catalog = {
      sections: payload.sections || [],
      items: payload.items || [],
      promotions: payload.promotions || [],
    };
  }

  if (scopes.includes("inventory")) {
    const payload = await getAdminInventory({}, tenantOptions);
    data.inventory = payload.items || [];
    data.inventorySummary = payload.summary || null;
  }

  if (scopes.includes("finance")) {
    const payload = await getAdminFinance(
      {
        period: String(requestUrl.searchParams.get("period") || "").trim(),
        startDate: String(requestUrl.searchParams.get("startDate") || "").trim(),
        endDate: String(requestUrl.searchParams.get("endDate") || "").trim(),
      },
      tenantOptions
    );
    data.finance = {
      filters: payload.filters || {},
      overview: payload.overview || {},
      paymentBreakdown: payload.paymentBreakdown || [],
      orders: payload.orders || [],
      closing: payload.closing || null,
    };
  }

  if (scopes.includes("settings")) {
    const [restaurantSettings, deliverySettings] = await Promise.all([
      getAdminRestaurantSettings(tenantOptions),
      getAdminDeliverySettings(tenantOptions),
    ]);
    data.settings = {
      restaurant: restaurantSettings.settings || {},
      delivery: deliverySettings.settings || {},
    };
  }

  return data;
};

const handleAdminExports = async (req, res) => {
  if (req.method !== "GET") {
    return sendMethodNotAllowed(res, "GET");
  }

  try {
    const session = requireAdminSession(req);
    const requestUrl = getRequestUrl(req);
    const scopes = normalizeExportScopes(requestUrl.searchParams.get("scope"));

    await assertExportScopeAccess(session, scopes);

    const tenantOptions = getTenantStoreOptions(session);
    const data = await buildExportData(scopes, tenantOptions, requestUrl);

    recordSecurityEvent({
      severity: "audit",
      outcome: "audit",
      routeType: "admin",
      group: "exports",
      action: "export_created",
      method: req.method,
      path: requestUrl.pathname,
      tenant: session.tenantContext?.restaurantKey || session.restaurantKey || "default",
      tenantId: session.tenantContext?.tenantId || session.tenantId || "",
      restaurantId: session.tenantContext?.restaurantId || session.restaurantId || "",
      user: session.login,
      metadata: {
        scopes,
        format: "json",
      },
    });

    return json(res, 200, {
      ok: true,
      admin: buildAdminPayload(session),
      tenantContext: serializeTenantContext(session.tenantContext),
      exportedAt: new Date().toISOString(),
      format: "json",
      scopes,
      data,
    });
  } catch (error) {
    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || "Nao foi possivel gerar a exportacao.",
      errorCode:
        error?.errorCode || (error?.statusCode ? "admin_export_error" : "internal_error"),
      requiredPermissions: error?.requiredPermissions || undefined,
      featureKey: error?.featureKey || undefined,
      planKey: error?.planKey || undefined,
      reason: error?.reason || undefined,
    });
  }
};

const normalizeAdminUserType = (value) => String(value || "").trim().toUpperCase();

const normalizeAdminRestaurantKey = (value) =>
  String(value || "default")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "default";

const scopeUsersPayloadForActor = (usersPayload = {}, actor = {}) => {
  const actorType = normalizeAdminUserType(actor.userType || actor.tipo_usuario);

  if (actorType === "MASTER") {
    return usersPayload;
  }

  const actorRestaurantKey = normalizeAdminRestaurantKey(actor.restaurantKey);

  return {
    ...usersPayload,
    users: Array.isArray(usersPayload.users)
      ? usersPayload.users.filter(
          (user) => normalizeAdminRestaurantKey(user.restaurantKey) === actorRestaurantKey
        )
      : [],
  };
};

const assertUsersCommercialAccess = async (payload = {}, actor = {}, usersPayload = {}) => {
  const userPayload = payload.user && typeof payload.user === "object" ? payload.user : payload;
  const actorType = normalizeAdminUserType(actor.userType || actor.tipo_usuario);
  const targetType = normalizeAdminUserType(userPayload.userType || userPayload.tipo_usuario || "CUSTOM");
  const requestedRestaurantKey = userPayload.restaurantKey || userPayload.restaurant_key || "";

  if (targetType === "MASTER") {
    return;
  }

  const restaurantKey =
    actorType === "MASTER"
      ? normalizeAdminRestaurantKey(requestedRestaurantKey || actor.restaurantKey)
      : normalizeAdminRestaurantKey(actor.restaurantKey);
  const commercialAccess = await getRestaurantCommercialAccess(restaurantKey);
  const contractActive = ["ACTIVE", "ATIVO", "TRIAL"].includes(
    String(commercialAccess.contractStatus || "").trim().toUpperCase()
  );

  if (!contractActive) {
    throw buildHttpError(
      403,
      "Assinatura do restaurante nao permite gerenciar usuarios.",
      "subscription_inactive_for_users",
      {
        planKey: commercialAccess.planKey,
        reason: "contract_inactive",
      }
    );
  }

  const existingUsers = Array.isArray(usersPayload.users) ? usersPayload.users : [];
  const targetIdentifier = String(userPayload.id || userPayload.login || "").trim().toLowerCase();
  const isCreating = !existingUsers.some(
    (user) =>
      String(user.id || "").trim() === targetIdentifier ||
      String(user.login || "").trim().toLowerCase() === targetIdentifier
  );
  const userLimit = Number(commercialAccess.userLimit || commercialAccess.limite_usuarios || 0);

  if (isCreating && userLimit > 0) {
    const currentRestaurantUsers = existingUsers.filter(
      (user) => normalizeAdminRestaurantKey(user.restaurantKey) === restaurantKey
    );

    if (currentRestaurantUsers.length >= userLimit) {
      throw buildHttpError(
        403,
        "Limite de usuarios do plano atingido.",
        "plan_user_limit_exceeded",
        {
          planKey: commercialAccess.planKey,
          limit: userLimit,
        }
      );
    }
  }
};

const handleAdminUsers = async (req, res) => {
  const action = getAdminActionFromRequest(req);
  const configuredUsers = getConfiguredAdminUsers();

  try {
    const session = requireAdminSession(req);
    const actor = buildAdminPayload(session);

    if (action === "list") {
      if (req.method !== "GET") {
        return sendMethodNotAllowed(res, "GET");
      }

      return json(res, 200, {
        ok: true,
        admin: actor,
        ...scopeUsersPayloadForActor(await buildUsersPayload(configuredUsers), actor),
      });
    }

    if (action === "save") {
      if (req.method !== "POST") {
        return sendMethodNotAllowed(res, "POST");
      }

      const payload = parseJsonBody(req.body, { strict: true });
      const usersPayload = await buildUsersPayload(configuredUsers);
      await assertUsersCommercialAccess(payload, actor, usersPayload);
      const result = await saveAdminUser(payload, actor, configuredUsers);

      return json(res, 200, {
        ok: true,
        admin: actor,
        ...scopeUsersPayloadForActor(await buildUsersPayload(configuredUsers), actor),
        user: result.user,
        message: result.message,
      });
    }

    if (action === "status") {
      if (req.method !== "POST") {
        return sendMethodNotAllowed(res, "POST");
      }

      const payload = parseJsonBody(req.body, { strict: true });
      const result = await setAdminUserStatus(payload, actor, configuredUsers);

      return json(res, 200, {
        ok: true,
        admin: actor,
        ...scopeUsersPayloadForActor(await buildUsersPayload(configuredUsers), actor),
        user: result.user,
        message: result.message,
      });
    }

    if (action === "reset-password") {
      if (req.method !== "POST") {
        return sendMethodNotAllowed(res, "POST");
      }

      const payload = parseJsonBody(req.body, { strict: true });
      const result = await resetAdminUserPassword(payload, actor, configuredUsers);

      return json(res, 200, {
        ok: true,
        admin: actor,
        ...scopeUsersPayloadForActor(await buildUsersPayload(configuredUsers), actor),
        user: result.user,
        message: result.message,
      });
    }

    return json(res, 404, {
      error: "Operacao administrativa de usuarios nao encontrada.",
      errorCode: "admin_users_action_not_found",
    });
  } catch (error) {
    const fallbackMessages = {
      list: "Nao foi possivel carregar os usuarios.",
      save: "Nao foi possivel salvar o usuario.",
      status: "Nao foi possivel alterar o status do usuario.",
      "reset-password": "Nao foi possivel redefinir a senha do usuario.",
    };
    const fallbackErrorCodes = {
      list: "admin_users_error",
      save: "admin_users_save_error",
      status: "admin_users_status_error",
      "reset-password": "admin_users_password_error",
    };

    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || fallbackMessages[action] || "Nao foi possivel concluir a operacao.",
      errorCode:
        error?.errorCode ||
        (error?.statusCode ? fallbackErrorCodes[action] || "admin_users_error" : "internal_error"),
    });
  }
};

const MASTER_PANEL_ACTIONS = new Set([
  "master",
  "overview",
  "dashboard",
  "restaurants",
  "users",
  "plans",
  "resources",
  "domains",
  "subscriptions",
  "reports",
  "logs",
  "audit",
  "developer",
  "settings",
]);

const readMasterMetric = async (resolver) => {
  try {
    const value = await resolver();
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
  } catch (error) {
    return 0;
  }
};

const buildMasterMetricsSnapshot = async (usersPayload = {}, tenantContext = null) => {
  const users = Array.isArray(usersPayload.users) ? usersPayload.users : [];
  const tenantOptions = { tenantContext };
  const [
    totalOrders,
    totalCustomers,
    totalReviews,
    totalRevenue,
  ] = await Promise.all([
    readMasterMetric(async () => {
      const payload = await getAdminOrderList(100, tenantOptions);
      return payload?.stats?.totalOrders || payload?.orders?.length || payload?.recentOrders?.length || 0;
    }),
    readMasterMetric(async () => {
      const payload = await getAdminCustomers({}, tenantOptions);
      return payload?.summary?.totalCustomers || payload?.customers?.length || 0;
    }),
    readMasterMetric(async () => {
      const payload = await getAdminReviews(tenantOptions);
      return payload?.summary?.totalReviews || payload?.reviews?.length || 0;
    }),
    readMasterMetric(async () => {
      const payload = await getAdminFinance({}, tenantOptions);
      return payload?.overview?.grossRevenue || payload?.summary?.grossRevenue || 0;
    }),
  ]);

  return {
    totalUsers: users.length,
    totalOrders,
    totalCustomers,
    totalReviews,
    totalRevenue,
    totalAccesses: users.filter((user) => user.lastAccessAt || user.ultimo_acesso).length,
  };
};

const buildOnboardedTenantContext = (onboarding) =>
  buildTenantContext(
    {
      host: onboarding.domain?.domain || "localhost",
      matched: true,
      tenantId: onboarding.restaurant.tenantId,
      restaurantId: onboarding.restaurant.restaurantId,
      restaurantKey: onboarding.restaurant.restaurantKey,
      restaurantName: onboarding.restaurant.name,
      restaurant: onboarding.restaurant,
      domain: onboarding.domain,
      resolutionMode: "pilot",
      multiRestaurantActive: true,
    },
    {
      source: "master:onboard-restaurant",
    }
  );

const buildDeliverySettingsFromOnboarding = (payload = {}) => {
  const delivery = payload.delivery && typeof payload.delivery === "object" ? payload.delivery : {};
  const radius = Number(delivery.radiusKm || delivery.maxDeliveryRadiusKm || payload.deliveryRadiusKm || 5);
  const fee = Number(delivery.fee || delivery.fixedDeliveryFee || payload.deliveryFee || 0);

  return {
    status: {
      deliveriesEnabled: delivery.deliveriesEnabled !== false,
      pausedMessage: "",
    },
    distanceBands: Array.isArray(delivery.distanceBands) && delivery.distanceBands.length
      ? delivery.distanceBands
      : [
          {
            id: "onboarding-default-band",
            minKm: 0,
            maxKm: Number.isFinite(radius) && radius > 0 ? radius : 5,
            customerFee: Number.isFinite(fee) && fee >= 0 ? fee : 0,
            courierFee: 0,
            minimumOrder: Number(delivery.minimumOrder || 0),
            isActive: true,
          },
        ],
  };
};

const isValidOnboardingEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim().toLowerCase());

const handleMasterOnboardRestaurant = async (req, res, session) => {
  const payload = parseJsonBody(req.body, { strict: true });
  const actor = buildAdminPayload(session);
  const adminUser = payload.adminUser || payload.admin || payload.restaurant?.adminUser || null;

  if (!adminUser?.login || !adminUser?.password) {
    throw buildHttpError(
      400,
      "Informe login e senha do administrador do restaurante.",
      "missing_restaurant_admin_user"
    );
  }

  if (!isValidOnboardingEmail(adminUser.email || adminUser.login)) {
    throw buildHttpError(
      400,
      "Informe um e-mail valido para o administrador do restaurante.",
      "invalid_restaurant_admin_email"
    );
  }

  const onboarding = await createRestaurantOnboarding(payload, actor);
  const tenantContext = buildOnboardedTenantContext(onboarding);
  const restaurantPayload = payload.restaurant && typeof payload.restaurant === "object" ? payload.restaurant : payload;
  const restaurantSettingsPayload = {
    restaurantName: onboarding.restaurant.name,
    whatsapp: restaurantPayload.whatsapp || "",
    addressFields: restaurantPayload.address || {},
    businessSchedule: restaurantPayload.businessSchedule || restaurantPayload.hours || {},
    deliveryBase: {
      maxDeliveryRadiusKm: restaurantPayload.delivery?.radiusKm || restaurantPayload.delivery?.maxDeliveryRadiusKm,
      fixedDeliveryFee: restaurantPayload.delivery?.fee || restaurantPayload.delivery?.fixedDeliveryFee,
      minimumDeliveryOrder: restaurantPayload.delivery?.minimumOrder,
      deliveryEnabled: restaurantPayload.delivery?.deliveriesEnabled !== false,
      pickupEnabled: restaurantPayload.pickupEnabled !== false,
    },
    businessHours: restaurantPayload.businessHours || "",
  };
  const [restaurantSettingsResult, deliverySettingsResult, adminUserResult] = await Promise.all([
    updateRestaurantSettings(restaurantSettingsPayload, actor, { tenantContext }),
    updateDeliverySettings(buildDeliverySettingsFromOnboarding(restaurantPayload), actor, { tenantContext }),
    saveAdminUser(
      {
        user: {
          login: adminUser.login,
          name: adminUser.name || adminUser.displayName || `Admin ${onboarding.restaurant.name}`,
          email: adminUser.email || adminUser.login,
          password: adminUser.password,
          status: "ACTIVE",
          userType: "OWNER",
          restaurantKey: onboarding.restaurant.restaurantKey,
          tenantId: onboarding.restaurant.tenantId,
          restaurantId: onboarding.restaurant.restaurantId,
        },
      },
      actor,
      getConfiguredAdminUsers()
    ),
  ]);

  return json(res, 200, {
    ok: true,
    admin: actor,
    ...onboarding,
    tenantContext: serializeTenantContext(tenantContext),
    restaurantSettings: restaurantSettingsResult.settings,
    deliverySettings: deliverySettingsResult.settings,
    restaurantAdmin: adminUserResult.user,
  });
};

const handleMasterSubscriptionUpdate = async (req, res, session) => {
  const payload = parseJsonBody(req.body, { strict: true });
  const result = await updateRestaurantSubscription(payload, buildAdminPayload(session));

  return json(res, 200, {
    ok: true,
    admin: buildAdminPayload(session),
    ...result,
  });
};

const handleAdminMaster = async (req, res) => {
  const action = getAdminActionFromRequest(req) || "overview";

  try {
    const session = requireAdminSession(req);

    if (req.method === "POST") {
      if (["onboard-restaurant", "onboarding", "restaurants"].includes(action)) {
        return await handleMasterOnboardRestaurant(req, res, session);
      }

      if (["subscription", "subscriptions"].includes(action)) {
        return await handleMasterSubscriptionUpdate(req, res, session);
      }

      return json(res, 404, {
        error: "Operacao Master de escrita nao encontrada.",
        errorCode: "master_write_action_not_found",
      });
    }

    if (req.method !== "GET") {
      return sendMethodNotAllowed(res, "GET, POST");
    }

    if (!MASTER_PANEL_ACTIONS.has(action)) {
      return json(res, 404, {
        error: "Modulo do Painel Master nao encontrado.",
        errorCode: "master_panel_action_not_found",
      });
    }

    const usersPayload = await buildUsersPayload(getConfiguredAdminUsers());
    const metrics = await buildMasterMetricsSnapshot(usersPayload, session.tenantContext);
    const snapshot = await getMasterPlatformSnapshot({
      metrics,
      usersPayload,
    });

    return json(res, 200, {
      ...snapshot,
      admin: buildAdminPayload(session),
      activeModule: action === "master" ? "overview" : action,
    });
  } catch (error) {
    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || "Nao foi possivel carregar o Painel Master.",
      errorCode:
        error?.errorCode ||
        (error?.statusCode ? "master_panel_error" : "internal_error"),
    });
  }
};

const handleAdminApi = async (req, res) => {
  const group = getAdminRouteGroup(req);
  const action = getAdminActionFromRequest(req) || group;

  if (group === "auth") {
    try {
      await guardSecurity(req, {
        routeType: "admin-auth",
        group,
        action,
        requireTenant: true,
        requireSession: false,
      });
    } catch (error) {
      return sendSecurityGuardianError(res, error);
    }

    return handleAdminAuth(req, res);
  }

  try {
    const requiredPermissions = resolveAdminRequiredPermissions(req, group);
    await guardSecurity(req, {
      routeType: "admin",
      group,
      action,
      planAction: group === "dashboard" ? resolveAdminDashboardAction(req).action : action,
      requireTenant: true,
      requireSession: true,
      requireMaster: group === "master",
      requirePlan: group !== "master",
      requiredPermissions,
    });

    if (group === "master") {
      await requireMasterAccessForRequest(req);
    } else {
      await requireAdminAccessForRequest(req, requiredPermissions);
      await requirePlanAccessForRequest(req, group);
    }
  } catch (error) {
    if (
      error?.publicMessage ||
      [
        "admin_permission_denied",
        "admin_session_required",
        "plan_feature_forbidden",
        "security_access_denied",
        "security_rate_limited",
        "security_temporary_block",
        "tenant_context_required",
      ].includes(error?.errorCode)
    ) {
      return sendSecurityGuardianError(res, error);
    }

    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || "Acesso administrativo negado.",
      errorCode:
        error?.errorCode ||
        (error?.statusCode ? "admin_access_denied" : "internal_error"),
      requiredPermissions: error?.requiredPermissions || undefined,
      featureKey: error?.featureKey || undefined,
      planKey: error?.planKey || undefined,
      reason: error?.reason || undefined,
    });
  }

  if (group === "master") {
    return handleAdminMaster(req, res);
  }

  if (group === "dashboard") {
    return handleAdminDashboard(req, res);
  }

  if (group === "orders") {
    return handleAdminOrders(req, res);
  }

  if (group === "catalog") {
    return handleAdminCatalog(req, res);
  }

  if (group === "promotions") {
    return handleAdminPromotions(req, res);
  }

  if (group === "reviews") {
    return handleAdminReviews(req, res);
  }

  if (group === "customers") {
    return handleAdminCustomers(req, res);
  }

  if (group === "delivery-settings") {
    return handleAdminDeliverySettings(req, res);
  }

  if (group === "settings") {
    return handleAdminRestaurantSettings(req, res);
  }

  if (group === "inventory") {
    return handleAdminInventory(req, res);
  }

  if (group === "finance") {
    return handleAdminFinance(req, res);
  }

  if (group === "exports") {
    return handleAdminExports(req, res);
  }

  if (group === "users") {
    return handleAdminUsers(req, res);
  }

  return json(res, 404, {
    error: "Operacao administrativa nao encontrada.",
    errorCode: "admin_action_not_found",
  });
};

module.exports = handleAdminApi;
