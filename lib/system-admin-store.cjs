const fs = require("node:fs/promises");
const path = require("node:path");
const vm = require("node:vm");
const { performance } = require("node:perf_hooks");
const { getPlatformHealthSnapshot } = require("./platform-health-store.cjs");
const { getMasterPlatformSnapshot } = require("./master-platform-store.cjs");
const {
  getStorageMode,
  listSystemAdministrationActivity,
} = require("./identity-domain-store.cjs");
const { neon } = require("./tenant-sql.cjs");
const {
  KASULO_LOGO_URL,
  KASULO_TENANT,
  buildKasuloCatalog,
} = require("./kasulo-bootstrap.cjs");

const SCRIPT_FILE = path.join(process.cwd(), "script.js");
const CATALOG_START_MARKER = 'const SITE_IMAGES_DIRECTORY = "./site-images";';
const CATALOG_END_MARKER = "const groupMediaControllers = new Map();";
let sqlClient = null;
let tokyoCatalogCountPromise = null;

const cloneJson = (value) => JSON.parse(JSON.stringify(value));
const normalizeStatus = (value) => String(value || "").trim().toUpperCase();
const getSql = () => {
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
};

const countItems = (sections = []) =>
  sections.reduce(
    (total, section) =>
      total + (Array.isArray(section?.items) ? section.items.length : 0),
    0
  );

const getTokyoCatalogCount = async () => {
  if (tokyoCatalogCountPromise) return tokyoCatalogCountPromise;
  tokyoCatalogCountPromise = (async () => {
    const source = await fs.readFile(SCRIPT_FILE, "utf8");
    const startIndex = source.indexOf(CATALOG_START_MARKER);
    const endIndex = source.indexOf(CATALOG_END_MARKER);
    if (startIndex === -1 || endIndex <= startIndex) return null;
    const sandbox = { module: { exports: {} }, exports: {} };
    vm.runInNewContext(
      `${source.slice(startIndex, endIndex)}\nmodule.exports = { MENU_SECTIONS };`,
      sandbox,
      { timeout: 1500 }
    );
    return countItems(sandbox.module.exports.MENU_SECTIONS || []);
  })().catch(() => null);
  return tokyoCatalogCountPromise;
};

const getConfiguredValue = (names) =>
  names.some((name) => Boolean(String(process.env[name] || "").trim()));

const getRequiredConfigurationState = (names) => {
  const configured = names.filter((name) =>
    Boolean(String(process.env[name] || "").trim())
  ).length;
  if (configured === names.length) return "CONFIGURED";
  if (configured > 0) return "PARTIAL";
  return "NOT_CONFIGURED";
};

const findIntegrationHealth = (activity, keys) => {
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()));
  return (activity.integrationHealth || []).find((entry) =>
    normalizedKeys.has(String(entry.integrationKey || "").toLowerCase())
  );
};

const resolveIntegrationStatus = (configurationState, health) => {
  if (health?.status) return normalizeStatus(health.status);
  return configurationState;
};

const buildIntegrations = (platform, activity) => {
  const persisted = platform?.settings?.integrations || {};
  const definitions = [
    {
      key: "google_maps",
      name: "Google Maps",
      configurationState:
        getConfiguredValue(["GOOGLE_MAPS_API_KEY"]) ||
        normalizeStatus(persisted.maps) === "CURRENT"
          ? "CONFIGURED"
          : "NOT_CONFIGURED",
      configuration:
        normalizeStatus(persisted.maps) === "CURRENT"
          ? "Marcada como atual na configuração da plataforma"
          : "Chave não configurada no ambiente",
      healthKeys: ["google_maps", "maps"],
    },
    {
      key: "whatsapp",
      name: "WhatsApp",
      configurationState: getRequiredConfigurationState([
        "WHATSAPP_ACCESS_TOKEN",
        "WHATSAPP_PHONE_NUMBER_ID",
        "WHATSAPP_VERIFY_TEMPLATE_NAME",
      ]),
      configuration: "API de mensagens e modelo de verificação",
      healthKeys: ["whatsapp", "whatsapp_cloud"],
    },
    {
      key: "pix",
      name: "PIX",
      configurationState: getConfiguredValue([
        "PIX_API_KEY",
        "PIX_PROVIDER",
        "PIX_WEBHOOK_SECRET",
      ])
        ? "PARTIAL"
        : "NOT_IMPLEMENTED",
      configuration: "Provedor de pagamento ainda não integrado",
      healthKeys: ["pix", "payments"],
    },
    {
      key: "printers",
      name: "Impressoras",
      configurationState: getConfiguredValue([
        "PRINTER_ENDPOINT",
        "PRINT_SERVICE_URL",
      ])
        ? "PARTIAL"
        : "NOT_IMPLEMENTED",
      configuration: "Serviço de impressão ainda não integrado",
      healthKeys: ["printers", "printing"],
    },
    {
      key: "email",
      name: "E-mail",
      configurationState: getRequiredConfigurationState([
        "INOVAS_INVITE_EMAIL_PROVIDER",
        "INOVAS_INVITE_EMAIL_FROM",
        "INOVAS_INVITE_EMAIL_API_KEY",
      ]),
      configuration: "Envio de convites administrativos",
      healthKeys: ["email", "mail", "smtp"],
    },
    {
      key: "push",
      name: "Notificações push",
      configurationState: getConfiguredValue([
        "PUSH_PROVIDER",
        "PUSH_API_KEY",
      ])
        ? "PARTIAL"
        : "NOT_IMPLEMENTED",
      configuration: "Provedor de notificações ainda não integrado",
      healthKeys: ["push", "notifications"],
    },
    {
      key: "webhook",
      name: "Webhook",
      configurationState: getConfiguredValue([
        "WEBHOOK_URL",
        "WEBHOOK_SECRET",
      ])
        ? "PARTIAL"
        : "NOT_CONFIGURED",
      configuration: "Destino e segredo de assinatura",
      healthKeys: ["webhook", "webhooks"],
    },
  ];

  return definitions.map((definition) => {
    const health = findIntegrationHealth(activity, definition.healthKeys);
    return {
      key: definition.key,
      name: definition.name,
      status: resolveIntegrationStatus(
        definition.configurationState,
        health
      ),
      configuration: definition.configuration,
      lastSyncAt: health?.lastSuccessAt || null,
      lastFailureAt: health?.lastFailureAt || null,
      updatedAt: health?.updatedAt || null,
      errorCode: health?.errorCode || "",
    };
  });
};

const getDomainValue = (restaurant, platform) => {
  const domain = (platform.domains || []).find(
    (entry) =>
      entry.restaurantKey === restaurant.restaurantKey &&
      entry.isSimulation !== true
  );
  const value = (
    restaurant.domain ||
    domain?.customDomain ||
    domain?.primaryDomain ||
    domain?.domain ||
    ""
  );
  if (typeof value === "string") return value;
  return value?.customDomain || value?.primaryDomain || value?.domain || "";
};

const ensureKnownRestaurants = (restaurants) => {
  const next = [...restaurants];
  if (!next.some((restaurant) => restaurant.restaurantKey === KASULO_TENANT.restaurantKey)) {
    next.push({
      key: KASULO_TENANT.restaurantKey,
      ...KASULO_TENANT,
      name: KASULO_TENANT.restaurantName,
      slug: KASULO_TENANT.restaurantKey,
      status: "NOT_REGISTERED",
      statusLabel: "Não cadastrado na plataforma",
      plan: "",
      domain: "",
      publicUrl: "",
      logoUrl: KASULO_LOGO_URL,
      owner: {},
      registration: {},
    });
  }
  return next;
};

const buildRestaurants = async (platform, health, activity) => {
  const tokyoCatalogCount = await getTokyoCatalogCount();
  const kasuloCatalogCount = countItems(buildKasuloCatalog().sections);
  const membershipsByRestaurant = new Map();
  for (const membership of activity.memberships || []) {
    if (!membershipsByRestaurant.has(membership.restaurantKey)) {
      membershipsByRestaurant.set(membership.restaurantKey, []);
    }
    membershipsByRestaurant.get(membership.restaurantKey).push(membership);
  }

  const provisionedRestaurantKeys = new Set(
    (platform.restaurants || []).map((restaurant) => restaurant.restaurantKey || restaurant.key)
  );
  return ensureKnownRestaurants(platform.restaurants || []).map((restaurant) => {
    const key = restaurant.restaurantKey || restaurant.key;
    const memberships = membershipsByRestaurant.get(key) || [];
    const ownerMembership = memberships.find(
      (membership) =>
        normalizeStatus(membership.restaurantRole) === "OWNER" &&
        normalizeStatus(membership.status) === "ACTIVE"
    );
    const subscription = (platform.subscriptions || []).find(
      (entry) => entry.restaurantKey === key
    );
    const tenantHealth = (health.tenantHealth || []).find(
      (entry) => entry.restaurantKey === key
    );
    const productCount =
      key === KASULO_TENANT.restaurantKey
        ? kasuloCatalogCount
        : key === "default"
          ? tokyoCatalogCount
          : null;
    return {
      restaurantKey: key,
      tenantId: restaurant.tenantId || "",
      restaurantId: restaurant.restaurantId || "",
      name: restaurant.name || restaurant.restaurantName || key,
      slug: restaurant.slug || key,
      plan: subscription?.plan || restaurant.plan || "",
      domain: getDomainValue(restaurant, platform),
      publicUrl: restaurant.publicUrl || "",
      status: restaurant.status || "UNKNOWN",
      statusLabel: restaurant.statusLabel || "",
      owner:
        ownerMembership?.displayName ||
        restaurant.registration?.ownerFullName ||
        restaurant.owner?.fullName ||
        restaurant.owner?.name ||
        "",
      ownerLogin:
        ownerMembership?.login ||
        restaurant.registration?.email ||
        restaurant.owner?.email ||
        "",
      userCount: memberships.length,
      activeUserCount: memberships.filter(
        (membership) => normalizeStatus(membership.status) === "ACTIVE"
      ).length,
      productCount,
      productCountSource:
        productCount === null
          ? ""
          : key === KASULO_TENANT.restaurantKey
            ? "Catálogo provisionado do restaurante"
            : "Catálogo-base publicado",
      health: tenantHealth
        ? {
            status: tenantHealth.status,
            score: tenantHealth.score,
            domainStatus: tenantHealth.domainStatus,
            lastHeartbeatAt: tenantHealth.lastHeartbeatAt,
            failedIntegrations: tenantHealth.failedIntegrations ?? 0,
            pendingJobs: tenantHealth.pendingJobs ?? 0,
            criticalErrors: tenantHealth.criticalErrors ?? 0,
            backupStatus: tenantHealth.backupStatus || "",
            version: tenantHealth.version || "",
          }
        : null,
      logo:
        restaurant.logoUrl ||
        restaurant.logo ||
        (key === KASULO_TENANT.restaurantKey
          ? KASULO_LOGO_URL
          : "/assets/tokyo-logo-official.png"),
      updatedAt: restaurant.updatedAt || restaurant.createdAt || null,
      administrativeActions: {
        supportAvailable: provisionedRestaurantKeys.has(key),
      },
    };
  });
};

const probeDatabase = async () => {
  const startedAt = performance.now();
  if (!String(process.env.DATABASE_URL || "").trim()) {
    return {
      status: "NOT_CONFIGURED",
      latencyMs: null,
      detail: "Execução local sem DATABASE_URL.",
    };
  }
  try {
    const rows = await getSql()`SELECT NOW() AS checked_at`;
    return {
      status: rows?.length ? "HEALTHY" : "DEGRADED",
      latencyMs: Math.round(performance.now() - startedAt),
      detail: rows?.length
        ? "Conexão e consulta concluídas."
        : "A consulta não retornou confirmação.",
      checkedAt: rows?.[0]?.checked_at || null,
    };
  } catch (error) {
    return {
      status: "DEGRADED",
      latencyMs: Math.round(performance.now() - startedAt),
      detail: "Falha na verificação de conectividade do banco.",
      errorCode: String(error?.code || "database_probe_failed"),
    };
  }
};

const probeStorage = async () => {
  const startedAt = performance.now();
  const mode = getStorageMode();
  if (mode === "neon") {
    return {
      status: "HEALTHY",
      latencyMs: Math.round(performance.now() - startedAt),
      detail: "Persistência principal configurada no banco.",
      mode,
    };
  }
  if (mode === "disabled") {
    return {
      status: "DEGRADED",
      latencyMs: Math.round(performance.now() - startedAt),
      detail: "Persistência desativada neste ambiente.",
      mode,
    };
  }
  try {
    await fs.access(path.join(process.cwd(), ".data"));
    return {
      status: "HEALTHY",
      latencyMs: Math.round(performance.now() - startedAt),
      detail: "Armazenamento local acessível.",
      mode,
    };
  } catch {
    return {
      status: "NOT_CONFIGURED",
      latencyMs: Math.round(performance.now() - startedAt),
      detail: "Diretório local de persistência ainda não criado.",
      mode,
    };
  }
};

const buildHealth = async ({
  session,
  health,
  activity,
  integrations,
  startedAt,
}) => {
  const [database, storage] = await Promise.all([
    probeDatabase(),
    probeStorage(),
  ]);
  const integrationFailures = integrations.filter((integration) =>
    ["ERROR", "FAILED", "DEGRADED"].includes(integration.status)
  ).length;
  const configuredIntegrations = integrations.filter((integration) =>
    ["CONFIGURED", "HEALTHY", "ONLINE", "CURRENT"].includes(integration.status)
  ).length;
  const apiLatencyMs = Math.round(performance.now() - startedAt);
  const cacheConfigured = getConfiguredValue([
    "REDIS_URL",
    "UPSTASH_REDIS_REST_URL",
    "KV_REST_API_URL",
  ]);
  const components = [
    {
      key: "api",
      name: "API",
      status: "HEALTHY",
      latencyMs: apiLatencyMs,
      detail: "A verificação autenticada foi processada.",
    },
    { key: "database", name: "Banco", ...database },
    { key: "storage", name: "Armazenamento", ...storage },
    {
      key: "authentication",
      name: "Autenticação",
      status: session?.identityId ? "HEALTHY" : "DEGRADED",
      latencyMs: null,
      detail: session?.identityId
        ? "Sessão administrativa validada com identidade persistente."
        : "Identidade da sessão não confirmada.",
    },
    {
      key: "sessions",
      name: "Sessões",
      status: activity.storageMode === "disabled" ? "DEGRADED" : "HEALTHY",
      latencyMs: null,
      detail: `${activity.sessions.length} sessão(ões) administrativa(s) ativa(s) desta conta.`,
      value: activity.sessions.length,
    },
    {
      key: "cache",
      name: "Cache",
      status: cacheConfigured ? "CONFIGURED" : "NOT_CONFIGURED",
      latencyMs: null,
      detail: cacheConfigured
        ? "Serviço de cache declarado no ambiente; teste ativo não disponível."
        : "Nenhum cache de aplicação foi configurado.",
    },
    {
      key: "integrations",
      name: "Integrações",
      status: integrationFailures
        ? "DEGRADED"
        : configuredIntegrations
          ? "HEALTHY"
          : "NOT_CONFIGURED",
      latencyMs: null,
      detail: integrationFailures
        ? `${integrationFailures} integração(ões) com falha registrada.`
        : configuredIntegrations
          ? `${configuredIntegrations} integração(ões) configurada(s), sem falhas registradas.`
          : "Nenhuma integração externa está configurada.",
      value: integrations.length,
    },
  ];
  const measured = components
    .map((component) => component.latencyMs)
    .filter(Number.isFinite);
  return {
    summary: cloneJson(health.summary || {}),
    tenantHealth: cloneJson(health.tenantHealth || []),
    components,
    averageResponseMs: measured.length
      ? Math.round(measured.reduce((total, value) => total + value, 0) / measured.length)
      : null,
    generatedAt: new Date().toISOString(),
  };
};

const normalizeMasterAuditEvent = (event) => ({
  id: event.id || event.key || "",
  before: event.before || null,
  after: event.after || null,
  metadata: event.metadata || {},
  targetIdentityId: event.targetIdentityId || "",
  supportSessionId: event.supportSessionId || "",
  actorType: event.actorType || event.actor || "PLATFORM",
  actorName: event.actorName || event.actorDisplayName || "Plataforma",
  actorLogin: event.actorLogin || event.login || "",
  targetName: event.targetName || "",
  tenantId: event.tenantId || "",
  restaurantId: event.restaurantId || "",
  eventType: event.eventType || event.actionType || event.action || "PLATFORM_EVENT",
  result: event.result || event.status || "SUCCESS",
  reason: event.reason || event.description || "",
  requestId: event.requestId || "",
  createdAt: event.createdAt || event.updatedAt || null,
});

const buildAudit = (platform, activity) => {
  const restaurantNames = new Map(
    (platform.restaurants || []).flatMap((restaurant) => {
      const name = restaurant.name || restaurant.restaurantName || "";
      return [restaurant.restaurantId, restaurant.restaurantKey || restaurant.key]
        .filter(Boolean)
        .map((key) => [key, name]);
    })
  );
  const withRestaurantName = (event) => ({
    ...event,
    restaurantName:
      event.restaurantName ||
      restaurantNames.get(event.restaurantId) ||
      restaurantNames.get(event.restaurantKey) ||
      "",
  });
  const combined = [
    ...(activity.auditEvents || []).map(withRestaurantName),
    ...(platform.audit || []).map(normalizeMasterAuditEvent),
    ...(platform.logs || []).map(normalizeMasterAuditEvent),
  ];
  const seen = new Set();
  return combined
    .filter((event) => {
      const key = event.id || `${event.eventType}:${event.createdAt}:${event.requestId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(
      (left, right) =>
        new Date(right.createdAt || 0).getTime() -
        new Date(left.createdAt || 0).getTime()
    )
    .slice(0, 250);
};

const buildSettings = (platform) => ({
  platformName: platform.settings?.platformName || "INOVAS Food",
  site: platform.settings?.site || "",
  domain: platform.settings?.domain || "",
  supportEmail: platform.settings?.emails?.support || "",
  financialEmail: platform.settings?.emails?.financial || "",
  commercialEmail: platform.settings?.emails?.commercial || "",
  whatsapp: platform.settings?.whatsapp || "",
  maintenanceMode: platform.settings?.maintenanceMode === true,
  version: platform.settings?.version || "",
  storageMode: platform.storageMode || "",
  tenantMode: platform.futureArchitecture?.domainResolutionMode || "",
  generatedAt: platform.generatedAt || null,
});

const getSystemAdministrationContext = async (session) => {
  const startedAt = performance.now();
  const [platform, health, activity] = await Promise.all([
    getMasterPlatformSnapshot({ metrics: {}, usersPayload: { users: [] } }),
    getPlatformHealthSnapshot({ persist: true }),
    listSystemAdministrationActivity({
      identityId: session.identityId,
      limit: 250,
    }),
  ]);
  const integrations = buildIntegrations(platform, activity);
  const restaurants = await buildRestaurants(platform, health, activity);
  const healthDetails = await buildHealth({
    session,
    health,
    activity,
    integrations,
    startedAt,
  });
  const auditEvents = buildAudit(platform, activity);
  return {
    platform,
    restaurants,
    integrations,
    health: healthDetails,
    auditEvents,
    activity,
    settings: buildSettings(platform),
  };
};

module.exports = {
  getSystemAdministrationContext,
};
