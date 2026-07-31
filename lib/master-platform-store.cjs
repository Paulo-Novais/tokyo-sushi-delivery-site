const fs = require("node:fs/promises");
const path = require("node:path");
const { neon, runWithDatabaseScope } = require("./tenant-sql.cjs");
const {
  assertMigrationManagedRelations,
} = require("./database-schema.cjs");
const {
  APP_BRANDING,
  DOMAIN_CONFIG,
  FEATURE_FLAGS,
  RESTAURANT_BRAND,
} = require("./app-branding.cjs");
const { buildHttpError } = require("./http.cjs");
const {
  RESERVED_RESTAURANT_SLUGS,
  buildRestaurantPublicUrl,
  getPublicAppHost,
  getPublicAppUrl,
  normalizeRestaurantSlug,
  validateRestaurantSlug,
} = require("./restaurant-public-url.cjs");

// -----------------------------------------------------------------------------
// Platform constants and commercial catalog
// -----------------------------------------------------------------------------

const LOCAL_STORAGE_FILE = path.join(process.cwd(), ".data", "master-platform.json");
const LOCAL_STORE_VERSION = 1;
const RESTAURANT_KEY = "default";
const PLATFORM_STATE_KEY = "inovas_food_platform";
const PLATFORM_VERSION = "1.9.0";
const DEFAULT_CREATED_AT = "2026-06-24T00:00:00.000Z";
const PENDING_CUSTOM_DOMAIN_STATUS = "PENDING_VERIFICATION";
const PENDING_CUSTOM_DOMAIN_LABEL = "Aguardando verificação";

const MASTER_MENU_MODULES = Object.freeze([
  { key: "dashboard", label: "Dashboard Geral", status: "ready" },
  { key: "restaurants", label: "Restaurantes", status: "ready" },
  { key: "users", label: "Usuários", status: "ready" },
  { key: "plans", label: "Planos", status: "ready" },
  { key: "subscriptions", label: "Assinaturas", status: "ready" },
  { key: "sellers", label: "Vendedores", status: "ready" },
  { key: "commissions", label: "Comissao", status: "prepared" },
  { key: "contracts", label: "Contratos", status: "prepared" },
  { key: "finance", label: "Receita SaaS", status: "ready" },
  { key: "commercial", label: "Comercial", status: "ready" },
  { key: "resources", label: "Recursos", status: "foundation" },
  { key: "domains", label: "Dominios", status: "foundation" },
  { key: "reports", label: "Relatorios Gerais", status: "prepared" },
  { key: "logs", label: "Logs", status: "ready" },
  { key: "audit", label: "Auditoria", status: "ready" },
  { key: "developer", label: "Desenvolvedor", status: "foundation" },
  { key: "settings", label: "Configuracoes da Plataforma", status: "ready" },
]);

const SYSTEM_USER_TYPES = Object.freeze(["MASTER", "SOCIO", "DESENVOLVEDOR", "SUPORTE", "VENDEDOR"]);
const RESTAURANT_USER_TYPES = Object.freeze(["OWNER", "GERENTE", "CAIXA", "COZINHA", "ESTOQUE", "ENTREGADOR"]);

const buildOnboardingHttpError = (statusCode, errorCode, message, extra = {}) =>
  buildHttpError(statusCode, message, errorCode, {
    publicMessage: message,
    ...extra,
  });

const PLATFORM_FEATURE_FLAGS = Object.freeze([
  "onlineMenu",
  "orders",
  "whatsappButton",
  "deliveryCalculation",
  "customDomain",
  "advancedReports",
  "crm",
  "inventory",
  "finance",
  "reviews",
  "promotions",
  "coupons",
  "scheduledOrders",
  "platformBranding",
  "whatsappAI",
]);

const COMMERCIAL_FEATURE_DEFINITIONS = Object.freeze([
  {
    key: "onlineMenu",
    label: "Cardapio online",
    description: "Site publico com cardapio digital e produtos publicados.",
    status: "ACTIVE",
    future: false,
    defaultEnabled: true,
  },
  {
    key: "orders",
    label: "Pedidos",
    description: "Recebimento e gestao de pedidos no Gestor.",
    status: "ACTIVE",
    future: false,
    defaultEnabled: true,
  },
  {
    key: "whatsappButton",
    label: "Botao WhatsApp",
    description: "Atalhos comerciais e contato via WhatsApp.",
    status: "ACTIVE",
    future: false,
    defaultEnabled: true,
  },
  {
    key: "deliveryCalculation",
    label: "Calculo de entrega",
    description: "Regras de entrega, retirada, faixas e configuracoes operacionais.",
    status: "ACTIVE",
    future: false,
    defaultEnabled: true,
  },
  {
    key: "customDomain",
    label: "Dominio proprio",
    description: "Preparacao comercial para uso de dominio personalizado.",
    status: "ACTIVE",
    future: false,
    defaultEnabled: true,
  },
  {
    key: "advancedReports",
    label: "Relatorios avancados",
    description: "Metricas, relatorios e indicadores administrativos.",
    status: "ACTIVE",
    future: false,
    defaultEnabled: true,
  },
  {
    key: "crm",
    label: "Clientes / CRM",
    description: "Base de clientes e relacionamento basico.",
    status: "ACTIVE",
    future: false,
    defaultEnabled: true,
  },
  {
    key: "inventory",
    label: "Estoque",
    description: "Controle de itens, quantidade mínima e validade.",
    status: "ACTIVE",
    future: false,
    defaultEnabled: true,
  },
  {
    key: "finance",
    label: "Financeiro",
    description: "Visao financeira, fechamento e recebimentos.",
    status: "ACTIVE",
    future: false,
    defaultEnabled: true,
  },
  {
    key: "reviews",
    label: "Avaliacoes",
    description: "Gestao de reputacao e avaliacoes do site publico.",
    status: "ACTIVE",
    future: false,
    defaultEnabled: true,
  },
  {
    key: "promotions",
    label: "Promocoes",
    description: "Campanhas promocionais e disponibilidade no site.",
    status: "ACTIVE",
    future: false,
    defaultEnabled: true,
  },
  {
    key: "coupons",
    label: "Cupons",
    description: "Recursos comerciais de cupons vinculados a campanhas.",
    status: "ACTIVE",
    future: false,
    defaultEnabled: true,
  },
  {
    key: "scheduledOrders",
    label: "Pedidos agendados",
    description: "Modulo de pedidos futuros e agenda operacional.",
    status: "ACTIVE",
    future: false,
    defaultEnabled: true,
  },
  {
    key: "platformBranding",
    label: "Rodape INOVAS Food",
    description: "Marca institucional da plataforma exibida no site publico.",
    status: "ACTIVE",
    future: false,
    defaultEnabled: true,
  },
  {
    key: "whatsappAI",
    label: "WhatsApp AI",
    description: "Automacao futura de atendimento por inteligencia artificial.",
    status: "FUTURE",
    future: true,
    defaultEnabled: false,
  },
]);

const START_PLAN_FEATURES = Object.freeze([
  "onlineMenu",
  "orders",
  "whatsappButton",
  "platformBranding",
]);
const BUSINESS_PLAN_FEATURES = Object.freeze([
  ...START_PLAN_FEATURES,
  "deliveryCalculation",
  "advancedReports",
  "crm",
  "reviews",
  "promotions",
  "coupons",
]);
const PRO_PLAN_FEATURES = Object.freeze([
  ...BUSINESS_PLAN_FEATURES,
  "inventory",
  "finance",
  "scheduledOrders",
  "customDomain",
]);
const PREMIUM_PLAN_FEATURES = Object.freeze(PRO_PLAN_FEATURES);
const VALID_SUBSCRIPTION_STATUSES = Object.freeze(["TRIAL", "ACTIVE", "EXPIRED", "BLOCKED", "CANCELED"]);
const PLAN_KEY_ALIASES = Object.freeze({
  BASICO: "START",
  BASIC: "START",
  STARTER: "START",
  START: "START",
  BUSINESS: "BUSINESS",
  NEGOCIO: "BUSINESS",
  PRO: "PRO",
  PREMIUM: "PREMIUM",
});

const DEFAULT_PLAN_DEFINITIONS = Object.freeze([
  {
    key: "START",
    name: "START",
    displayName: "Essencial",
    description: "Plano inicial para operacao digital essencial.",
    monthlyValue: 99,
    valor_mensal: 99,
    userLimit: 1,
    limite_usuarios: 1,
    color: "#FF6A00",
    order: 1,
    featured: false,
    features: START_PLAN_FEATURES,
    includedFeatures: START_PLAN_FEATURES,
    recursos_inclusos: START_PLAN_FEATURES,
    notes: "Cardápio online, pedidos, WhatsApp e 1 usuário.",
    observations: "Plano base sem cobranca real integrada.",
    status: "ACTIVE",
  },
  {
    key: "BUSINESS",
    name: "BUSINESS",
    displayName: "Intermediario",
    description: "Plano para operacao com relatorios, promocoes e CRM.",
    monthlyValue: 199,
    valor_mensal: 199,
    userLimit: 3,
    limite_usuarios: 3,
    color: "#111827",
    order: 2,
    featured: false,
    features: BUSINESS_PLAN_FEATURES,
    includedFeatures: BUSINESS_PLAN_FEATURES,
    recursos_inclusos: BUSINESS_PLAN_FEATURES,
    notes: "Tudo do START, relatorios, promocoes, avaliacoes e CRM basico.",
    observations: "Plano intermediario sem cobranca real integrada.",
    status: "ACTIVE",
  },
  {
    key: "PRO",
    name: "PRO",
    displayName: "Profissional",
    description: "Plano completo V1 para estoque, financeiro e dominio proprio.",
    monthlyValue: 349,
    valor_mensal: 349,
    userLimit: 0,
    limite_usuarios: 0,
    color: "#22C55E",
    order: 3,
    featured: true,
    features: PRO_PLAN_FEATURES,
    includedFeatures: PRO_PLAN_FEATURES,
    recursos_inclusos: PRO_PLAN_FEATURES,
    notes: "Tudo do BUSINESS, estoque, financeiro, pedidos agendados e dominio proprio.",
    observations: "Plano completo V1 sem cobranca real integrada.",
    status: "ACTIVE",
  },
  {
    key: "PREMIUM",
    name: "PREMIUM",
    displayName: "Enterprise",
    description: "Alias legado do plano PRO completo, preservado para Tokyo Sushi/default.",
    monthlyValue: 349,
    valor_mensal: 349,
    userLimit: 0,
    limite_usuarios: 0,
    color: "#F59E0B",
    order: 4,
    featured: false,
    features: PREMIUM_PLAN_FEATURES,
    includedFeatures: PREMIUM_PLAN_FEATURES,
    recursos_inclusos: PREMIUM_PLAN_FEATURES,
    notes:
      "Tudo do PRO, estoque, financeiro, entrega avançada, domínio próprio, usuários extras e suporte prioritário.",
    observations: "Tokyo Sushi usa este plano como Cliente Modelo. WhatsApp AI segue futuro e desativado.",
    status: "ACTIVE",
  },
]);

const MODULE_FEATURE_MAP = Object.freeze({
  orders: "orders",
  catalog: "onlineMenu",
  menu: "onlineMenu",
  promotions: "promotions",
  reviews: "reviews",
  "delivery-settings": "deliveryCalculation",
  deliveries: "deliveryCalculation",
  customers: "crm",
  metrics: "advancedReports",
  reports: "advancedReports",
  exports: "advancedReports",
  inventory: "inventory",
  finance: "finance",
  scheduled: "scheduledOrders",
});

const DASHBOARD_ACTION_FEATURE_MAP = Object.freeze({
  scheduled: "scheduledOrders",
  metrics: "advancedReports",
  finance: "finance",
});

let sqlClient = null;
let schemaReadyPromise = null;

// -----------------------------------------------------------------------------
// Normalization helpers
// -----------------------------------------------------------------------------

const cloneJson = (value) => JSON.parse(JSON.stringify(value));

const normalizeText = (value, fallback = "", maxLength = 360) => {
  const normalizedValue = String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
  return normalizedValue || fallback;
};

const normalizePlanKey = (value, fallback = "PREMIUM") => {
  const normalizedValue = normalizeText(value, fallback, 80).toUpperCase();
  return PLAN_KEY_ALIASES[normalizedValue] || normalizedValue || fallback;
};

const normalizeSubscriptionStatusKey = (value, fallback = "TRIAL") => {
  const normalizedValue = normalizeText(value, fallback, 80).toUpperCase();
  const aliasMap = {
    ATIVO: "ACTIVE",
    ACTIVE: "ACTIVE",
    TRIAL: "TRIAL",
    TESTE: "TRIAL",
    EXPIRED: "EXPIRED",
    VENCIDO: "EXPIRED",
    BLOCKED: "BLOCKED",
    BLOQUEADO: "BLOCKED",
    CANCELED: "CANCELED",
    CANCELLED: "CANCELED",
    CANCELADO: "CANCELED",
    PREPARED: "TRIAL",
  };

  return aliasMap[normalizedValue] || normalizedValue || fallback;
};

const assertKnownPlanKey = (planKey) => {
  const normalizedPlanKey = normalizePlanKey(planKey, "");
  const plan = DEFAULT_PLAN_DEFINITIONS.find((entry) => entry.key === normalizedPlanKey);

  if (!plan) {
    throw buildOnboardingHttpError(
      400,
      "invalid_restaurant_plan",
      "Plano inicial inválido para onboarding V1."
    );
  }

  return plan.key;
};

const assertKnownSubscriptionStatus = (status) => {
  const normalizedStatus = normalizeSubscriptionStatusKey(status, "");

  if (!VALID_SUBSCRIPTION_STATUSES.includes(normalizedStatus)) {
    throw buildOnboardingHttpError(
      400,
      "invalid_subscription_status",
      "Status de assinatura inválido para onboarding V1."
    );
  }

  return normalizedStatus;
};

const normalizeWhatsappDigits = (value) => String(value || "").replace(/\D+/g, "");

const assertOptionalWhatsapp = (value) => {
  const digits = normalizeWhatsappDigits(value);

  if (!digits) {
    return "";
  }

  if (digits.length < 10 || digits.length > 15) {
    throw buildOnboardingHttpError(
      400,
      "invalid_restaurant_whatsapp",
      "WhatsApp informado no onboarding é inválido."
    );
  }

  return digits;
};

const normalizeDocument = (value) => String(value || "").replace(/\D+/g, "").slice(0, 14);

const normalizePostalCode = (value) => String(value || "").replace(/\D+/g, "").slice(0, 8);

const normalizeDateInput = (value, fallback = "") => {
  const normalizedValue = normalizeText(value, "", 80);

  if (!normalizedValue) {
    return fallback;
  }

  const date = new Date(normalizedValue);
  return Number.isNaN(date.getTime()) ? normalizedValue : date.toISOString();
};

const getOnboardingField = (restaurantPayload = {}, address = {}, keys = []) => {
  for (const key of keys) {
    if (restaurantPayload[key] !== undefined && restaurantPayload[key] !== null) {
      return restaurantPayload[key];
    }

    if (address[key] !== undefined && address[key] !== null) {
      return address[key];
    }
  }

  return "";
};

const buildV11RegistrationData = (restaurantPayload = {}, adminUser = null) => {
  const address = restaurantPayload.address && typeof restaurantPayload.address === "object"
    ? restaurantPayload.address
    : {};
  const ownerPayload = restaurantPayload.owner && typeof restaurantPayload.owner === "object"
    ? restaurantPayload.owner
    : {};
  const document = normalizeDocument(
    getOnboardingField(restaurantPayload, ownerPayload, ["document", "taxId", "cnpj", "mei", "cnpjMei"])
  );
  const ownerName = normalizeText(
    ownerPayload.fullName ||
      ownerPayload.name ||
      restaurantPayload.ownerFullName ||
      restaurantPayload.ownerName ||
      adminUser?.name ||
      adminUser?.displayName,
    "",
    160
  );
  const tradeName = normalizeText(
    restaurantPayload.tradeName ||
      restaurantPayload.nomeFantasia ||
      restaurantPayload.fantasyName ||
      restaurantPayload.restaurantName ||
      restaurantPayload.name,
    "",
    160
  );
  const city = normalizeText(getOnboardingField(restaurantPayload, address, ["city", "cidade"]), "", 120);
  const postalCode = normalizePostalCode(
    getOnboardingField(restaurantPayload, address, ["postalCode", "zipCode", "cep"])
  );
  const establishmentNumber = normalizeText(
    getOnboardingField(restaurantPayload, address, ["number", "numero", "establishmentNumber"]),
    "",
    40
  );
  const email = normalizeText(
    restaurantPayload.email ||
      ownerPayload.email ||
      adminUser?.email ||
      adminUser?.login,
    "",
    160
  ).toLowerCase();
  const phone = normalizeWhatsappDigits(
    restaurantPayload.phone ||
      restaurantPayload.telefone ||
      ownerPayload.phone ||
      ownerPayload.telefone ||
      restaurantPayload.whatsapp
  );
  const adhesionDate = normalizeDateInput(
    restaurantPayload.adhesionDate ||
      restaurantPayload.dataAdesao ||
      restaurantPayload.joinedAt ||
      restaurantPayload.createdAt,
    new Date().toISOString()
  );

  return {
    document,
    taxId: document,
    cnpjMei: document,
    ownerFullName: ownerName,
    tradeName,
    city,
    postalCode,
    cep: postalCode,
    establishmentNumber,
    email,
    phone,
    telefone: phone,
    plan: normalizePlanKey(restaurantPayload.plan || restaurantPayload.initialPlan || "START", "START"),
    adhesionDate,
    dataAdesao: adhesionDate,
  };
};

const assertV11RegistrationData = (registration = {}) => {
  const missing = [];

  if (![11, 14].includes(String(registration.document || "").length)) {
    missing.push("CNPJ ou MEI");
  }

  [
    ["ownerFullName", "nome completo do proprietario"],
    ["tradeName", "nome fantasia do estabelecimento"],
    ["city", "cidade"],
    ["postalCode", "CEP"],
    ["establishmentNumber", "numero do estabelecimento"],
    ["email", "e-mail"],
    ["phone", "telefone"],
    ["plan", "tipo de plano"],
    ["adhesionDate", "data de adesao"],
  ].forEach(([key, label]) => {
    if (!registration[key]) {
      missing.push(label);
    }
  });

  if (registration.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registration.email)) {
    missing.push("e-mail valido");
  }

  if (registration.phone && (registration.phone.length < 10 || registration.phone.length > 15)) {
    missing.push("telefone valido");
  }

  if (registration.postalCode && registration.postalCode.length !== 8) {
    missing.push("CEP valido");
  }

  if (missing.length) {
    const error = new Error(`Cadastro V1.1 incompleto: ${Array.from(new Set(missing)).join(", ")}.`);
    error.statusCode = 400;
    error.errorCode = "v1_1_registration_required";
    error.missingFields = Array.from(new Set(missing));
    throw error;
  }
};

const normalizeSlug = (value, fallback = "restaurante", maxLength = 120) => {
  const normalizedValue = normalizeText(value, "", maxLength)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalizedValue || fallback;
};

const buildTenantId = (restaurantKey = RESTAURANT_KEY) => {
  const normalizedRestaurantKey = normalizeSlug(restaurantKey, RESTAURANT_KEY, 80);
  return normalizedRestaurantKey === RESTAURANT_KEY
    ? "tenant_default"
    : `tenant_${normalizedRestaurantKey.replace(/-/g, "_")}`;
};

const buildRestaurantId = (restaurantKey = RESTAURANT_KEY) => {
  const normalizedRestaurantKey = normalizeSlug(restaurantKey, RESTAURANT_KEY, 80);
  return normalizedRestaurantKey === RESTAURANT_KEY
    ? "restaurant_default"
    : `restaurant_${normalizedRestaurantKey.replace(/-/g, "_")}`;
};

const normalizeTenantMode = (value) => {
  const normalizedValue = normalizeText(value, "default_only", 80)
    .toLowerCase()
    .replace(/-/g, "_");

  if (["pilot", "tenant_pilot", "multi_restaurant_pilot"].includes(normalizedValue)) {
    return "pilot";
  }

  if (["strict", "tenant_strict", "multi_tenant"].includes(normalizedValue)) {
    return "strict";
  }

  return "default_only";
};

const getTenantMode = () =>
  normalizeTenantMode(process.env.INOVAS_TENANT_MODE || process.env.TENANT_CONTEXT_MODE);

const isRealTenantMode = () => ["pilot", "strict"].includes(getTenantMode());

const normalizeDomainHost = (value, fallback = "") => {
  const rawValue = normalizeText(value, fallback, 240).toLowerCase();

  if (!rawValue) {
    return fallback;
  }

  try {
    return new URL(rawValue.includes("://") ? rawValue : `https://${rawValue}`).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch (error) {
    return rawValue
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .split(":")[0]
      .trim()
      .toLowerCase() || fallback;
  }
};

const normalizeOptionalText = (value, maxLength = 80) => {
  const normalizedValue = normalizeText(value, "", maxLength);
  return normalizedValue || null;
};

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

const normalizeBoolean = (value, fallback = false) =>
  typeof value === "boolean" ? value : fallback;

const normalizeNumber = (value, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const normalizeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const getStorageMode = () => {
  if (String(process.env.DATABASE_URL || "").trim()) {
    return "neon";
  }

  return process.env.NODE_ENV === "production" ? "disabled" : "file";
};

const getSql = () => {
  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }

  return sqlClient;
};

const ensureMasterSchema = async () => {
  if (schemaReadyPromise) {
    return schemaReadyPromise;
  }

  const sql = getSql();
  schemaReadyPromise = (async () => {
    if (
      await assertMigrationManagedRelations({
        sql,
        relations: ["master_platform_state", "public_restaurant_routes"],
        component: "plataforma",
      })
    ) {
      return;
    }

    await sql`
      CREATE TABLE IF NOT EXISTS master_platform_state (
        state_key TEXT PRIMARY KEY,
        restaurant_key TEXT NOT NULL DEFAULT 'default',
        state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS master_platform_state_restaurant_key_idx
      ON master_platform_state (restaurant_key)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS public_restaurant_routes (
        restaurant_key TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        restaurant_id TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        restaurant_name TEXT NOT NULL,
        domain_host TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        public_url TEXT NOT NULL DEFAULT '',
        dns_integrated BOOLEAN NOT NULL DEFAULT FALSE,
        ssl_integrated BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS public_restaurant_routes_domain_host_idx
      ON public_restaurant_routes (domain_host)
      WHERE domain_host <> ''
    `;
  })().catch((error) => {
    schemaReadyPromise = null;
    throw error;
  });

  return schemaReadyPromise;
};

const getCurrentDomain = () => DOMAIN_CONFIG.primaryDomain;

// -----------------------------------------------------------------------------
// Default platform state
// -----------------------------------------------------------------------------

const getFeatureDefinition = (featureKey) =>
  COMMERCIAL_FEATURE_DEFINITIONS.find((feature) => feature.key === featureKey) || null;

const getDefaultResources = () => cloneJson(COMMERCIAL_FEATURE_DEFINITIONS);

const getDefaultPlanDefinition = (planKey = "PREMIUM") =>
  DEFAULT_PLAN_DEFINITIONS.find(
    (plan) => plan.key === normalizePlanKey(planKey, "PREMIUM")
  ) || DEFAULT_PLAN_DEFINITIONS.find((plan) => plan.key === "PREMIUM");

const normalizeFeatureList = (features = [], fallback = []) => {
  const commercialKeys = new Set(PLATFORM_FEATURE_FLAGS);
  const normalizedFeatures = normalizeArray(features)
    .map((feature) => normalizeText(feature, "", 120))
    .filter((feature) => commercialKeys.has(feature));

  return normalizedFeatures.length
    ? Array.from(new Set(normalizedFeatures))
    : Array.from(new Set(normalizeArray(fallback)));
};

const getDefaultFeatureFlags = () =>
  PLATFORM_FEATURE_FLAGS.reduce((flags, key) => {
    const definition = getFeatureDefinition(key);
    flags[key] =
      key === "whatsappAI"
        ? false
        : FEATURE_FLAGS[key] === true || definition?.defaultEnabled === true;
    return flags;
  }, {});

const getDefaultRestaurant = () => ({
  key: RESTAURANT_KEY,
  tenantId: "tenant_default",
  restaurantId: "restaurant_default",
  restaurantKey: RESTAURANT_KEY,
  name: RESTAURANT_BRAND.name || "Tokyo Sushi Delivery",
  slug: "tokyo-sushi",
  status: "CLIENTE_MODELO",
  statusLabel: "Cliente Modelo",
  plan: "PREMIUM",
  domain: getCurrentDomain(),
  createdAt: DEFAULT_CREATED_AT,
  registration: {
    document: "",
    taxId: "",
    cnpjMei: "",
    ownerFullName: "Paulo Novais",
    tradeName: RESTAURANT_BRAND.name || "Tokyo Sushi Delivery",
    city: "Sao Paulo",
    postalCode: "",
    cep: "",
    establishmentNumber: "",
    email: "",
    phone: APP_BRANDING.defaultWhatsapp || "",
    telefone: APP_BRANDING.defaultWhatsapp || "",
    plan: "PREMIUM",
    adhesionDate: DEFAULT_CREATED_AT,
    dataAdesao: DEFAULT_CREATED_AT,
  },
  owner: {
    fullName: "Paulo Novais",
    email: "",
    phone: APP_BRANDING.defaultWhatsapp || "",
  },
  notes:
    "Cliente Modelo criado automaticamente para validar a base INOVAS Food sem ativar multi-restaurante.",
  futureAssociation: {
    currentStrategy: "restaurant_key",
    currentValue: RESTAURANT_KEY,
    multiRestaurantActive: false,
  },
});

const getDefaultDomains = () => [
  {
    key: "default-primary-domain",
    restaurantKey: RESTAURANT_KEY,
    restaurantName: RESTAURANT_BRAND.name || "Tokyo Sushi Delivery",
    domain: getCurrentDomain(),
    primaryDomain: getCurrentDomain(),
    customDomain: "",
    status: "ACTIVE",
    statusLabel: "Ativo",
    sslStatus: "CURRENT",
    ssl_status: "CURRENT",
    sslStatusLabel: "SSL atual",
    createdAt: DEFAULT_CREATED_AT,
    created_at: DEFAULT_CREATED_AT,
    notes: "Dominio atual preservado. DNS e SSL reais seguem sem integracao nesta etapa.",
    observations: "Dominio atual preservado. DNS e SSL reais seguem sem integracao nesta etapa.",
    isSimulation: false,
    dnsIntegrated: false,
    sslIntegrated: false,
  },
  {
    key: "simulation-pizzaria-do-joao",
    restaurantKey: RESTAURANT_KEY,
    restaurantName: RESTAURANT_BRAND.name || "Tokyo Sushi Delivery",
    domain: "pizzariadojoao.com.br",
    primaryDomain: getCurrentDomain(),
    customDomain: "pizzariadojoao.com.br",
    status: "SIMULATION",
    statusLabel: "Simulacao",
    sslStatus: "NOT_INTEGRATED",
    ssl_status: "NOT_INTEGRATED",
    sslStatusLabel: "Nao integrado",
    createdAt: DEFAULT_CREATED_AT,
    created_at: DEFAULT_CREATED_AT,
    notes:
      "Dominio ficticio para validar cadastro futuro. O resolver ainda aponta para Tokyo Sushi/default.",
    observations:
      "Dominio ficticio para validar cadastro futuro. O resolver ainda aponta para Tokyo Sushi/default.",
    isSimulation: true,
    dnsIntegrated: false,
    sslIntegrated: false,
  },
  {
    key: "simulation-burguer-prime",
    restaurantKey: RESTAURANT_KEY,
    restaurantName: RESTAURANT_BRAND.name || "Tokyo Sushi Delivery",
    domain: "burguerprime.com.br",
    primaryDomain: getCurrentDomain(),
    customDomain: "burguerprime.com.br",
    status: "SIMULATION",
    statusLabel: "Simulacao",
    sslStatus: "NOT_INTEGRATED",
    ssl_status: "NOT_INTEGRATED",
    sslStatusLabel: "Nao integrado",
    createdAt: DEFAULT_CREATED_AT,
    created_at: DEFAULT_CREATED_AT,
    notes:
      "Dominio ficticio para validar cadastro futuro. O resolver ainda aponta para Tokyo Sushi/default.",
    observations:
      "Dominio ficticio para validar cadastro futuro. O resolver ainda aponta para Tokyo Sushi/default.",
    isSimulation: true,
    dnsIntegrated: false,
    sslIntegrated: false,
  },
];

const getDefaultSubscriptions = () => [
  {
    key: RESTAURANT_KEY,
    restaurantKey: RESTAURANT_KEY,
    restaurantName: RESTAURANT_BRAND.name || "Tokyo Sushi Delivery",
    restaurant: RESTAURANT_BRAND.name || "Tokyo Sushi Delivery",
    plan: "PREMIUM",
    planName: "PREMIUM",
    monthlyValue: getDefaultPlanDefinition("PREMIUM").monthlyValue,
    valor_mensal: getDefaultPlanDefinition("PREMIUM").valor_mensal,
    status: "ACTIVE",
    status_contrato: "ATIVO",
    contractStatus: "ACTIVE",
    billingStatus: "NOT_INTEGRATED",
    billingIntegrated: false,
    startedAt: DEFAULT_CREATED_AT,
    data_inicio: DEFAULT_CREATED_AT,
    nextBillingAt: "",
    dueDate: "",
    data_vencimento: "",
    dueDay: 10,
    dia_vencimento: 10,
    releasedFeatures: normalizeFeatureList(PREMIUM_PLAN_FEATURES),
    recursos_liberados: normalizeFeatureList(PREMIUM_PLAN_FEATURES),
    blockedModules: [],
    modulos_bloqueados: [],
    notes:
      "Tokyo Sushi cadastrado como Cliente Modelo em PREMIUM. Cobranca nao implementada nesta etapa.",
    observations:
      "Contrato preparado para assinatura futura, sem gateway de pagamento e sem multi-restaurante ativo.",
  },
];

const getDefaultPlatformSettings = () => ({
  platformName: "INOVAS Food",
  logo: "/assets/inovas-food-logo-oficial.png",
  site: getPublicAppUrl(),
  domain: getPublicAppHost(),
  email: "",
  emails: {
    support: "",
    financial: "",
    commercial: "",
  },
  whatsapp: APP_BRANDING.defaultWhatsapp || "",
  social: {
    instagram: "",
    facebook: "",
    linkedin: "",
  },
  smtp: {
    status: "PREPARED",
    host: "",
    from: "",
  },
  integrations: {
    payments: "PREPARED",
    whatsapp: "PREPARED",
    maps: "CURRENT",
  },
  api: {
    status: "PREPARED",
    publicBaseUrl: "",
  },
  tokens: {
    status: "PREPARED",
    rotationPolicy: "manual",
  },
  defaultFooter: "INOVAS Food",
  customerBrandName: "INOVAS Food",
  maintenanceMode: false,
  version: PLATFORM_VERSION,
});

const getDefaultMasterState = () => ({
  version: LOCAL_STORE_VERSION,
  restaurantKey: RESTAURANT_KEY,
  platform: getDefaultPlatformSettings(),
  restaurants: [getDefaultRestaurant()],
  plans: cloneJson(DEFAULT_PLAN_DEFINITIONS),
  resources: getDefaultResources(),
  featureFlags: getDefaultFeatureFlags(),
  restaurantFeatureFlags: {
    [RESTAURANT_KEY]: getDefaultFeatureFlags(),
  },
  domains: getDefaultDomains(),
  subscriptions: getDefaultSubscriptions(),
  contracts: getDefaultSubscriptions(),
  logs: [],
  audit: [],
  reports: {
    prepared: true,
    note: "Relatorios gerais preparados para consolidacao futura entre restaurantes.",
  },
  developer: {
    platformVersion: PLATFORM_VERSION,
    diagnostics: [],
    validations: [
      "validate:business-hours",
      "validate:admin-local",
      "validate:stage-3-ui-local",
      "validate:permissions-local",
      "validate:master-panel-local",
      "validate:platform-integration-local",
      "validate:site-layouts-local",
      "validate:domains-local",
      "validate:plans-contracts-local",
      "validate:v1-3-platform-local",
    ],
    integrations: [
      { key: "dns", label: "DNS personalizado", status: "not_integrated" },
      { key: "ssl", label: "SSL personalizado", status: "not_integrated" },
      { key: "billing", label: "Cobranca", status: "not_integrated" },
      { key: "whatsappAI", label: "WhatsApp AI", status: "prepared" },
    ],
    domainResolution: {
      activeMode: "default_only",
      fallbackRestaurantKey: RESTAURANT_KEY,
      dnsIntegrated: false,
      sslIntegrated: false,
      multiRestaurantActive: false,
    },
  },
});

// -----------------------------------------------------------------------------
// Restaurants
// -----------------------------------------------------------------------------

const normalizeRestaurant = (restaurant = {}) => {
  const fallback = getDefaultRestaurant();
  const key = normalizeSlug(
    restaurant.restaurantKey || restaurant.key || restaurant.slug || restaurant.name,
    fallback.key,
    120
  );
  const restaurantKey = key;

  return {
    key,
    tenantId: normalizeSlug(restaurant.tenantId || restaurant.tenant_id, buildTenantId(restaurantKey), 120),
    restaurantId: normalizeSlug(
      restaurant.restaurantId || restaurant.restaurant_id || restaurant.id,
      buildRestaurantId(restaurantKey),
      120
    ),
    restaurantKey,
    name: normalizeText(restaurant.name, fallback.name, 160),
    slug: normalizeSlug(restaurant.slug || restaurant.name || restaurantKey, fallback.slug, 120),
    status: normalizeText(restaurant.status, fallback.status, 80).toUpperCase(),
    statusLabel: normalizeText(restaurant.statusLabel, fallback.statusLabel, 120),
    plan: normalizePlanKey(restaurant.plan, fallback.plan),
    domain: normalizeText(restaurant.domain, fallback.domain, 180),
    subdomain: normalizeDomainHost(restaurant.subdomain, ""),
    whatsapp: normalizeText(restaurant.whatsapp, "", 80),
    seller_id: normalizeText(restaurant.seller_id || restaurant.sellerId, "", 160),
    sellerId: normalizeText(restaurant.sellerId || restaurant.seller_id, "", 160),
    address: restaurant.address && typeof restaurant.address === "object" ? cloneJson(restaurant.address) : {},
    registration:
      restaurant.registration && typeof restaurant.registration === "object"
        ? {
            ...cloneJson(fallback.registration || {}),
            ...cloneJson(restaurant.registration),
          }
        : cloneJson(fallback.registration || {}),
    owner:
      restaurant.owner && typeof restaurant.owner === "object"
        ? {
            ...cloneJson(fallback.owner || {}),
            ...cloneJson(restaurant.owner),
          }
        : cloneJson(fallback.owner || {}),
    onboarding: restaurant.onboarding && typeof restaurant.onboarding === "object" ? cloneJson(restaurant.onboarding) : {},
    createdAt: normalizeText(restaurant.createdAt, fallback.createdAt, 80),
    notes: normalizeText(restaurant.notes, fallback.notes, 500),
    futureAssociation: {
      currentStrategy: "restaurant_key",
      currentValue: restaurantKey,
      tenantId: normalizeSlug(restaurant.tenantId || restaurant.tenant_id, buildTenantId(restaurantKey), 120),
      restaurantId: normalizeSlug(
        restaurant.restaurantId || restaurant.restaurant_id || restaurant.id,
        buildRestaurantId(restaurantKey),
        120
      ),
      multiRestaurantActive: restaurantKey !== RESTAURANT_KEY,
      ...(restaurant.futureAssociation && typeof restaurant.futureAssociation === "object"
        ? restaurant.futureAssociation
        : {}),
    },
  };
};

// -----------------------------------------------------------------------------
// Entity normalizers
// -----------------------------------------------------------------------------

const normalizePlan = (plan = {}) => {
  const key = normalizePlanKey(plan.key || plan.name, "CUSTOM");
  const fallback = getDefaultPlanDefinition(key) || {};
  const features = normalizeFeatureList(
    plan.recursos_inclusos || plan.includedFeatures || plan.features,
    fallback.features || []
  );
  const monthlyValue = normalizeNumber(
    plan.monthlyValue || plan.valor_mensal || plan.value || plan.price,
    fallback.monthlyValue || 0
  );
  const userLimit = normalizeNumber(
    plan.userLimit || plan.limite_usuarios || plan.usersLimit,
    fallback.userLimit || 0
  );
  const notes = normalizeText(plan.notes || plan.observations || fallback.notes, "", 500);

  return {
    key,
    name: normalizeText(plan.name || fallback.name, key, 120).toUpperCase(),
    displayName: normalizeText(plan.displayName || plan.nome_comercial || fallback.displayName, key, 120),
    description: normalizeText(plan.description || fallback.description, "", 360),
    monthlyValue,
    valor_mensal: monthlyValue,
    userLimit,
    limite_usuarios: userLimit,
    color: normalizeText(plan.color || plan.cor || fallback.color, "#FF6A00", 40),
    order: normalizeNumber(plan.order || plan.ordem, fallback.order || 99),
    featured: normalizeBoolean(plan.featured ?? plan.highlight ?? plan.destaque, fallback.featured === true),
    features,
    includedFeatures: features,
    recursos_inclusos: features,
    status: normalizeText(plan.status || fallback.status, "ACTIVE", 80).toUpperCase(),
    notes,
    observations: notes,
  };
};

const normalizeResource = (resource = {}) => {
  const key = normalizeText(resource.key || resource.name, "", 120);
  const fallback = getFeatureDefinition(key) || {};
  const normalizedKey = key || fallback.key || "unknownFeature";
  const future = normalizeBoolean(resource.future, fallback.future === true);
  const status = normalizeText(
    resource.status || fallback.status || (future ? "FUTURE" : "ACTIVE"),
    "ACTIVE",
    80
  ).toUpperCase();

  return {
    key: normalizedKey,
    name: normalizeText(resource.name || resource.label || fallback.label, normalizedKey, 120),
    label: normalizeText(resource.label || resource.name || fallback.label, normalizedKey, 120),
    description: normalizeText(resource.description || fallback.description, "", 500),
    status,
    future,
    isFuture: future,
    defaultEnabled: normalizeBoolean(resource.defaultEnabled, fallback.defaultEnabled === true),
  };
};

const normalizeFeatureFlags = (flags = {}) =>
  PLATFORM_FEATURE_FLAGS.reduce((normalizedFlags, key) => {
    normalizedFlags[key] = normalizeBoolean(flags[key], getDefaultFeatureFlags()[key]);
    return normalizedFlags;
  }, {});

const normalizeDomain = (domain = {}) => {
  const fallback = getDefaultDomains()[0];
  const restaurantKey = normalizeSlug(domain.restaurantKey || domain.restaurant_key, RESTAURANT_KEY, 120);
  const hasExplicitPrimaryDomain = hasOwn(domain, "primaryDomain") || hasOwn(domain, "primary_domain");
  const primaryDomain = normalizeDomainHost(
    domain.primaryDomain || domain.primary_domain,
    hasExplicitPrimaryDomain ? "" : fallback.primaryDomain
  );
  const customDomain = normalizeDomainHost(domain.customDomain, "");
  const resolvedDomain = normalizeDomainHost(domain.domain, customDomain || primaryDomain);
  const sslStatus = normalizeText(
    domain.sslStatus || domain.ssl_status || domain.ssl,
    fallback.sslStatus,
    80
  ).toUpperCase();
  const notes = normalizeText(domain.notes || domain.observations, fallback.notes, 500);

  return {
    key: normalizeText(domain.key || domain.domain || domain.customDomain || domain.restaurantKey, fallback.key, 120),
    tenantId: normalizeSlug(domain.tenantId || domain.tenant_id, buildTenantId(restaurantKey), 120),
    restaurantId: normalizeSlug(domain.restaurantId || domain.restaurant_id, buildRestaurantId(restaurantKey), 120),
    restaurantKey,
    restaurantName: normalizeText(domain.restaurantName, fallback.restaurantName, 160),
    domain: resolvedDomain,
    primaryDomain,
    customDomain,
    status: normalizeText(domain.status, fallback.status, 80).toUpperCase(),
    statusLabel: normalizeText(domain.statusLabel, fallback.statusLabel, 120),
    sslStatus,
    ssl_status: sslStatus,
    ssl: sslStatus,
    sslStatusLabel: normalizeText(domain.sslStatusLabel || domain.sslLabel, fallback.sslStatusLabel, 120),
    createdAt: normalizeText(domain.createdAt || domain.created_at, fallback.createdAt, 80),
    created_at: normalizeText(domain.createdAt || domain.created_at, fallback.createdAt, 80),
    verifiedAt: normalizeOptionalText(domain.verifiedAt || domain.verified_at, 80),
    verified_at: normalizeOptionalText(domain.verifiedAt || domain.verified_at, 80),
    activatedAt: normalizeOptionalText(domain.activatedAt || domain.activated_at, 80),
    activated_at: normalizeOptionalText(domain.activatedAt || domain.activated_at, 80),
    notes,
    observations: notes,
    isSimulation: normalizeBoolean(domain.isSimulation, fallback.isSimulation),
    dnsIntegrated: normalizeBoolean(domain.dnsIntegrated, false),
    sslIntegrated: normalizeBoolean(domain.sslIntegrated, false),
  };
};

const normalizeSubscription = (subscription = {}) => {
  const fallback = getDefaultSubscriptions()[0];
  const restaurantKey = normalizeSlug(subscription.restaurantKey || subscription.restaurant_key || subscription.key, RESTAURANT_KEY, 120);
  const plan = normalizePlanKey(subscription.plan || fallback.plan, fallback.plan);
  const planDefinition = getDefaultPlanDefinition(plan);
  const releasedFeatures = normalizeFeatureList(
    subscription.releasedFeatures || subscription.recursos_liberados || subscription.features,
    planDefinition.features || []
  );
  const blockedModules = normalizeArray(
    subscription.blockedModules || subscription.modulos_bloqueados || subscription.modulesBlocked
  )
    .map((moduleKey) => normalizeText(moduleKey, "", 120))
    .filter(Boolean);
  const contractStatus = normalizeSubscriptionStatusKey(
    subscription.contractStatus || subscription.status_contrato || subscription.status,
    fallback.contractStatus || fallback.status
  );
  const monthlyValue = normalizeNumber(
    subscription.monthlyValue || subscription.valor_mensal || subscription.value,
    planDefinition.monthlyValue || fallback.monthlyValue || 0
  );
  const notes = normalizeText(
    subscription.notes || subscription.observations,
    fallback.notes,
    500
  );

  return {
    key: restaurantKey,
    tenantId: normalizeSlug(subscription.tenantId || subscription.tenant_id, buildTenantId(restaurantKey), 120),
    restaurantId: normalizeSlug(subscription.restaurantId || subscription.restaurant_id, buildRestaurantId(restaurantKey), 120),
    restaurantKey,
    restaurantName: normalizeText(subscription.restaurantName, fallback.restaurantName, 160),
    restaurant: normalizeText(subscription.restaurant || subscription.restaurantName, fallback.restaurant, 160),
    plan,
    planName: normalizeText(subscription.planName || planDefinition.name, plan, 120),
    monthlyValue,
    valor_mensal: monthlyValue,
    status: contractStatus,
    contractStatus,
    status_contrato: contractStatus === "ACTIVE" ? "ATIVO" : contractStatus,
    billingStatus: normalizeText(subscription.billingStatus, fallback.billingStatus, 80).toUpperCase(),
    billingIntegrated: normalizeBoolean(subscription.billingIntegrated, false),
    startedAt: normalizeText(subscription.startedAt || subscription.data_inicio, fallback.startedAt, 80),
    data_inicio: normalizeText(subscription.startedAt || subscription.data_inicio, fallback.startedAt, 80),
    nextBillingAt: normalizeText(subscription.nextBillingAt, "", 80),
    dueDate: normalizeText(subscription.dueDate || subscription.data_vencimento, "", 80),
    data_vencimento: normalizeText(subscription.dueDate || subscription.data_vencimento, "", 80),
    dueDay: normalizeNumber(subscription.dueDay || subscription.dia_vencimento, fallback.dueDay || 10),
    dia_vencimento: normalizeNumber(subscription.dueDay || subscription.dia_vencimento, fallback.dueDay || 10),
    releasedFeatures,
    recursos_liberados: releasedFeatures,
    blockedModules,
    modulos_bloqueados: blockedModules,
    notes,
    observations: normalizeText(subscription.observations || subscription.notes, fallback.observations, 500),
  };
};

const normalizeEvent = (event = {}) => ({
  id: normalizeText(event.id, "", 120),
  actorLogin: normalizeText(event.actorLogin || event.who, "", 160),
  actorName: normalizeText(event.actorName, "", 160),
  target: normalizeText(event.target || event.what, "", 240),
  changedAt: normalizeText(event.changedAt || event.when, "", 80),
  origin: normalizeText(event.origin, "", 120),
  actionType: normalizeText(event.actionType || event.action, "", 120),
  metadata: event.metadata && typeof event.metadata === "object" ? cloneJson(event.metadata) : {},
});

const ensureDefaultPlans = (plans) => {
  const normalizedPlans = normalizeArray(plans).map(normalizePlan);
  const planIndexes = new Map(normalizedPlans.map((plan, index) => [plan.key, index]));

  DEFAULT_PLAN_DEFINITIONS.forEach((plan) => {
    if (planIndexes.has(plan.key)) {
      const index = planIndexes.get(plan.key);
      normalizedPlans[index] = normalizePlan({
        ...plan,
        ...normalizedPlans[index],
      });
    } else {
      normalizedPlans.push(normalizePlan(plan));
    }
  });

  return normalizedPlans;
};

const ensureDefaultResources = (resources) => {
  const normalizedResources = normalizeArray(resources).map(normalizeResource);
  const resourceIndexes = new Map(normalizedResources.map((resource, index) => [resource.key, index]));

  COMMERCIAL_FEATURE_DEFINITIONS.forEach((resource) => {
    if (resourceIndexes.has(resource.key)) {
      const index = resourceIndexes.get(resource.key);
      normalizedResources[index] = normalizeResource({
        ...resource,
        ...normalizedResources[index],
      });
    } else {
      normalizedResources.push(normalizeResource(resource));
    }
  });

  return normalizedResources.filter((resource) => PLATFORM_FEATURE_FLAGS.includes(resource.key));
};

const ensureDefaultSubscriptions = (subscriptions) => {
  const normalizedSubscriptions = normalizeArray(subscriptions).map(normalizeSubscription);
  const hasDefaultSubscription = normalizedSubscriptions.some(
    (subscription) => subscription.key === RESTAURANT_KEY
  );

  return hasDefaultSubscription
    ? normalizedSubscriptions
    : [normalizeSubscription(getDefaultSubscriptions()[0]), ...normalizedSubscriptions];
};

const ensureDefaultDomains = (domains) => {
  const normalizedDomains = normalizeArray(domains).map(normalizeDomain);
  const domainKeys = new Set(normalizedDomains.map((domain) => domain.key));
  const domainHosts = new Set(
    normalizedDomains.flatMap((domain) => [
      normalizeDomainHost(domain.domain),
      normalizeDomainHost(domain.primaryDomain),
      normalizeDomainHost(domain.customDomain),
    ]).filter(Boolean)
  );

  getDefaultDomains().forEach((domain) => {
    const normalizedDomain = normalizeDomain(domain);
    const hosts = [
      normalizeDomainHost(normalizedDomain.domain),
      normalizeDomainHost(normalizedDomain.primaryDomain),
      normalizeDomainHost(normalizedDomain.customDomain),
    ].filter(Boolean);
    const alreadyRegistered =
      domainKeys.has(normalizedDomain.key) || hosts.some((host) => domainHosts.has(host));

    if (!alreadyRegistered) {
      normalizedDomains.push(normalizedDomain);
      domainKeys.add(normalizedDomain.key);
      hosts.forEach((host) => domainHosts.add(host));
    }
  });

  return normalizedDomains;
};

const normalizeMasterState = (state = {}) => {
  const defaults = getDefaultMasterState();
  const restaurants = normalizeArray(state.restaurants).map(normalizeRestaurant);
  const hasDefaultRestaurant = restaurants.some((restaurant) => restaurant.key === RESTAURANT_KEY);
  const domains = ensureDefaultDomains(state.domains);
  const contractSource = normalizeArray(state.contracts).length
    ? state.contracts
    : state.subscriptions;
  const contracts = ensureDefaultSubscriptions(contractSource);
  const resolvedRestaurants = hasDefaultRestaurant ? restaurants : [getDefaultRestaurant(), ...restaurants];
  const restaurantFeatureFlags = resolvedRestaurants.reduce((flags, restaurant) => {
    flags[restaurant.restaurantKey] = normalizeFeatureFlags(
      state.restaurantFeatureFlags?.[restaurant.restaurantKey] ||
        state.restaurantFeatureFlags?.[restaurant.key] ||
        defaults.restaurantFeatureFlags?.[RESTAURANT_KEY]
    );
    return flags;
  }, {});

  return {
    ...defaults,
    ...cloneJson(state || {}),
    version: Number(state.version || LOCAL_STORE_VERSION),
    restaurantKey: RESTAURANT_KEY,
    platform: {
      ...defaults.platform,
      ...(state.platform && typeof state.platform === "object" ? state.platform : {}),
      site: getPublicAppUrl(),
      domain: getPublicAppHost(),
      version: normalizeText(state.platform?.version, defaults.platform.version, 80),
      maintenanceMode: normalizeBoolean(
        state.platform?.maintenanceMode,
        defaults.platform.maintenanceMode
      ),
    },
    restaurants: resolvedRestaurants,
    plans: ensureDefaultPlans(state.plans),
    resources: ensureDefaultResources(state.resources),
    featureFlags: normalizeFeatureFlags(state.featureFlags),
    restaurantFeatureFlags,
    domains,
    subscriptions: contracts,
    contracts,
    logs: normalizeArray(state.logs).map(normalizeEvent),
    audit: normalizeArray(state.audit).map(normalizeEvent),
    reports: {
      ...defaults.reports,
      ...(state.reports && typeof state.reports === "object" ? state.reports : {}),
    },
    developer: {
      ...defaults.developer,
      ...(state.developer && typeof state.developer === "object" ? state.developer : {}),
      platformVersion: PLATFORM_VERSION,
    },
  };
};

// -----------------------------------------------------------------------------
// Persistence adapters
// -----------------------------------------------------------------------------

const ensureFileStore = async () => {
  await fs.mkdir(path.dirname(LOCAL_STORAGE_FILE), { recursive: true });

  try {
    await fs.access(LOCAL_STORAGE_FILE);
  } catch (error) {
    await fs.writeFile(
      LOCAL_STORAGE_FILE,
      JSON.stringify(normalizeMasterState(getDefaultMasterState()), null, 2)
    );
  }
};

const readFileStore = async () => {
  await ensureFileStore();

  try {
    const contents = await fs.readFile(LOCAL_STORAGE_FILE, "utf8");
    return normalizeMasterState(JSON.parse(contents));
  } catch (error) {
    return normalizeMasterState(getDefaultMasterState());
  }
};

const readNeonStore = async () => {
  await ensureMasterSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT state_json
    FROM master_platform_state
    WHERE state_key = ${PLATFORM_STATE_KEY}
    LIMIT 1
  `;

  return normalizeMasterState(rows[0]?.state_json || getDefaultMasterState());
};

const buildPublicRouteProjection = (state) =>
  normalizeArray(state.restaurants)
    .map((restaurant) => {
      const restaurantKey = normalizeSlug(
        restaurant.restaurantKey || restaurant.key || restaurant.slug,
        "",
        120
      );
      const slug = normalizeRestaurantSlug(restaurant.slug || restaurantKey);
      const domain =
        normalizeArray(state.domains).find(
          (entry) =>
            entry.restaurantKey === restaurantKey &&
            entry.isSimulation !== true
        ) || null;
      const domainHost = domain
        ? normalizeDomainHost(
            domain.customDomain || domain.primaryDomain || domain.domain,
            ""
          )
        : "";

      if (!restaurantKey || !slug || !restaurant.tenantId || !restaurant.restaurantId) {
        return null;
      }

      return {
        restaurantKey,
        tenantId: restaurant.tenantId,
        restaurantId: restaurant.restaurantId,
        slug,
        restaurantName: normalizeText(restaurant.name, restaurantKey, 160),
        domainHost,
        status: normalizeText(restaurant.status, "ACTIVE", 80).toUpperCase(),
        publicUrl: buildRestaurantPublicUrl(slug),
        dnsIntegrated: domain?.dnsIntegrated === true,
        sslIntegrated: domain?.sslIntegrated === true,
      };
    })
    .filter(Boolean);

const syncPublicRouteProjection = async (sql, state) => {
  const routes = buildPublicRouteProjection(state);

  for (const route of routes) {
    await sql`
      INSERT INTO public_restaurant_routes (
        restaurant_key,
        tenant_id,
        restaurant_id,
        slug,
        restaurant_name,
        domain_host,
        status,
        public_url,
        dns_integrated,
        ssl_integrated,
        created_at,
        updated_at
      )
      VALUES (
        ${route.restaurantKey},
        ${route.tenantId},
        ${route.restaurantId},
        ${route.slug},
        ${route.restaurantName},
        ${route.domainHost},
        ${route.status},
        ${route.publicUrl},
        ${route.dnsIntegrated},
        ${route.sslIntegrated},
        NOW(),
        NOW()
      )
      ON CONFLICT (restaurant_key)
      DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        restaurant_id = EXCLUDED.restaurant_id,
        slug = EXCLUDED.slug,
        restaurant_name = EXCLUDED.restaurant_name,
        domain_host = EXCLUDED.domain_host,
        status = EXCLUDED.status,
        public_url = EXCLUDED.public_url,
        dns_integrated = EXCLUDED.dns_integrated,
        ssl_integrated = EXCLUDED.ssl_integrated,
        updated_at = NOW()
    `;
  }

  await sql`
    DELETE FROM public_restaurant_routes
    WHERE restaurant_key NOT IN (
      SELECT value->>'restaurantKey'
      FROM jsonb_array_elements(${JSON.stringify(routes)}::jsonb)
    )
  `;
};

const readPublicRoute = async ({
  slug = "",
  host = "",
  restaurantKey = "",
} = {}) => {
  await ensureMasterSchema();
  const sql = getSql();
  const normalizedSlug = normalizeRestaurantSlug(slug);
  const normalizedHost = normalizeDomainHost(host, "");
  const normalizedRestaurantKey = normalizeSlug(restaurantKey, "", 120);
  const rows = normalizedRestaurantKey
    ? await sql`
        SELECT *
        FROM public_restaurant_routes
        WHERE restaurant_key = ${normalizedRestaurantKey}
        LIMIT 1
      `
    : normalizedSlug
    ? await sql`
        SELECT *
        FROM public_restaurant_routes
        WHERE slug = ${normalizedSlug}
        LIMIT 1
      `
    : await sql`
        SELECT *
        FROM public_restaurant_routes
        WHERE domain_host = ${normalizedHost}
        LIMIT 1
      `;

  return rows[0] || null;
};

const readMasterState = async () => {
  const storageMode = getStorageMode();

  if (storageMode === "neon") {
    return readNeonStore();
  }

  if (storageMode === "disabled") {
    return normalizeMasterState(getDefaultMasterState());
  }

  return readFileStore();
};

const writeFileStore = async (state) => {
  await fs.mkdir(path.dirname(LOCAL_STORAGE_FILE), { recursive: true });
  await fs.writeFile(
    LOCAL_STORAGE_FILE,
    JSON.stringify(normalizeMasterState(state), null, 2)
  );
};

const writeNeonStore = async (state) => {
  await ensureMasterSchema();
  const sql = getSql();
  const normalizedState = normalizeMasterState(state);

  await sql`
    INSERT INTO master_platform_state (
      state_key,
      restaurant_key,
      state_json,
      created_at,
      updated_at
    )
    VALUES (
      ${PLATFORM_STATE_KEY},
      ${RESTAURANT_KEY},
      ${JSON.stringify(normalizedState)}::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT (state_key)
    DO UPDATE SET
      restaurant_key = EXCLUDED.restaurant_key,
      state_json = EXCLUDED.state_json,
      updated_at = NOW()
  `;
  await syncPublicRouteProjection(sql, normalizedState);
};

const writeMasterState = async (state) => {
  const storageMode = getStorageMode();

  if (storageMode === "neon") {
    await writeNeonStore(state);
    return normalizeMasterState(state);
  }

  if (storageMode === "disabled") {
    throw new Error("Master platform storage unavailable in production without DATABASE_URL.");
  }

  await writeFileStore(state);
  return normalizeMasterState(state);
};

const getPlanFromState = (state, planKey = "PREMIUM") => {
  const normalizedPlanKey = normalizePlanKey(planKey, "PREMIUM");
  return (
    normalizeArray(state.plans).find((plan) => plan.key === normalizedPlanKey) ||
    normalizePlan(getDefaultPlanDefinition(normalizedPlanKey))
  );
};

// -----------------------------------------------------------------------------
// Plan, subscription and tenant access helpers
// -----------------------------------------------------------------------------

const getContractFromState = (state, restaurantKey = RESTAURANT_KEY) =>
  normalizeArray(state.contracts || state.subscriptions).find(
    (contract) => contract.restaurantKey === restaurantKey || contract.key === restaurantKey
  ) || normalizeSubscription(getDefaultSubscriptions()[0]);

const getCommercialFeatureForAdminRoute = (group = "", action = "") => {
  const normalizedGroup = normalizeText(group, "", 120);
  const normalizedAction = normalizeText(action, "", 120);

  if (normalizedGroup === "dashboard") {
    return DASHBOARD_ACTION_FEATURE_MAP[normalizedAction] || "";
  }

  return MODULE_FEATURE_MAP[normalizedGroup] || MODULE_FEATURE_MAP[normalizedAction] || "";
};

const buildRestaurantCommercialAccess = (state, restaurantKey = RESTAURANT_KEY) => {
  const contract = getContractFromState(state, restaurantKey);
  const plan = getPlanFromState(state, contract.plan);
  const featureFlags = normalizeFeatureFlags(state.restaurantFeatureFlags?.[restaurantKey]);
  const planFeatures = normalizeFeatureList(plan.includedFeatures || plan.recursos_inclusos || plan.features);
  const releasedFeatures = normalizeFeatureList(
    contract.releasedFeatures || contract.recursos_liberados,
    planFeatures
  );
  const effectiveFeatures = releasedFeatures.filter(
    (featureKey) => planFeatures.includes(featureKey) && featureFlags[featureKey] === true
  );
  const blockedModules = normalizeArray(contract.blockedModules || contract.modulos_bloqueados)
    .map((moduleKey) => normalizeText(moduleKey, "", 120))
    .filter(Boolean);
  const featureMap = COMMERCIAL_FEATURE_DEFINITIONS.reduce((features, feature) => {
    const enabled =
      effectiveFeatures.includes(feature.key) &&
      featureFlags[feature.key] === true &&
      feature.future !== true;
    features[feature.key] = {
      key: feature.key,
      label: feature.label,
      status: feature.status,
      future: feature.future === true,
      enabled,
      allowedByPlan: planFeatures.includes(feature.key),
      released: releasedFeatures.includes(feature.key),
    };
    return features;
  }, {});

  return {
    restaurantKey,
    planKey: plan.key,
    planName: plan.name,
    contractStatus: contract.contractStatus || contract.status,
    status_contrato: contract.status_contrato,
    monthlyValue: contract.monthlyValue,
    valor_mensal: contract.valor_mensal,
    userLimit: plan.userLimit,
    limite_usuarios: plan.limite_usuarios,
    planFeatures,
    releasedFeatures: effectiveFeatures,
    recursos_liberados: effectiveFeatures,
    blockedModules,
    modulos_bloqueados: blockedModules,
    features: featureMap,
    billingIntegrated: false,
    billingStatus: contract.billingStatus || "NOT_INTEGRATED",
    note:
      "Acesso comercial calculado por contrato + plano + feature flag. Multi-restaurante e cobranca real seguem inativos.",
  };
};

const getRestaurantCommercialAccess = async (restaurantKey = RESTAURANT_KEY) => {
  const state = await readMasterState();
  return buildRestaurantCommercialAccess(state, restaurantKey);
};

const getPlanAccessForAdminModule = async ({ group = "", action = "", restaurantKey = RESTAURANT_KEY } = {}) => {
  const state = await readMasterState();
  const commercialAccess = buildRestaurantCommercialAccess(state, restaurantKey);
  const featureKey = getCommercialFeatureForAdminRoute(group, action);

  if (!featureKey) {
    return {
      allowed: true,
      featureKey: "",
      commercialAccess,
      reason: "",
    };
  }

  const feature = commercialAccess.features[featureKey];
  const contractActive = ["ACTIVE", "ATIVO", "TRIAL"].includes(
    normalizeText(commercialAccess.contractStatus, "ACTIVE", 80).toUpperCase()
  );
  const explicitlyBlocked =
    commercialAccess.blockedModules.includes(featureKey) ||
    commercialAccess.blockedModules.includes(group) ||
    commercialAccess.blockedModules.includes(action);
  const allowed = Boolean(contractActive && feature?.enabled && !explicitlyBlocked);

  return {
    allowed,
    featureKey,
    feature,
    commercialAccess,
    reason: allowed
      ? ""
      : explicitlyBlocked
        ? "blocked_module"
        : contractActive
          ? "feature_not_available"
          : "contract_inactive",
  };
};

const getDomainCandidates = (domain = {}) =>
  [domain.domain, domain.primaryDomain, domain.customDomain]
    .map((value) => normalizeDomainHost(value))
    .filter(Boolean);

const isResolvableDomain = (domain = {}) =>
  ["ACTIVE", "PILOT", "VERIFIED"].includes(normalizeText(domain.status, "", 80).toUpperCase()) &&
  domain.isSimulation !== true;

const resolveRestaurantByHost = async (host = "") => {
  const tenantMode = getTenantMode();
  const normalizedHost = normalizeDomainHost(host, getCurrentDomain());
  if (getStorageMode() === "neon") {
    const matchedRoute = await readPublicRoute({ host: normalizedHost });
    const defaultRoute =
      matchedRoute || (await readPublicRoute({ restaurantKey: RESTAURANT_KEY }));
    const route =
      matchedRoute ||
      defaultRoute || {
        tenant_id: `tenant-${RESTAURANT_KEY}`,
        restaurant_id: `restaurant-${RESTAURANT_KEY}`,
        restaurant_key: RESTAURANT_KEY,
        restaurant_name: RESTAURANT_KEY,
        slug: RESTAURANT_KEY,
        status: "FALLBACK",
        public_url: buildRestaurantPublicUrl(RESTAURANT_KEY),
        dns_integrated: false,
        ssl_integrated: false,
      };
    const matched =
      Boolean(matchedRoute) &&
      (tenantMode === "default_only" ||
        (isRealTenantMode() &&
          PUBLIC_RESTAURANT_STATUSES.has(String(route.status || "").toUpperCase())));
    const resolvedRoute = matched ? matchedRoute : defaultRoute || route;

    return {
      ok: true,
      host: normalizedHost,
      matched,
      tenantId: resolvedRoute.tenant_id,
      restaurantId: resolvedRoute.restaurant_id,
      restaurantKey: resolvedRoute.restaurant_key,
      restaurantName: resolvedRoute.restaurant_name,
      restaurant: {
        tenantId: resolvedRoute.tenant_id,
        restaurantId: resolvedRoute.restaurant_id,
        restaurantKey: resolvedRoute.restaurant_key,
        key: resolvedRoute.restaurant_key,
        slug: resolvedRoute.slug,
        name: resolvedRoute.restaurant_name,
        status: resolvedRoute.status,
      },
      domain: matchedRoute
        ? {
            restaurantKey: matchedRoute.restaurant_key,
            domain: matchedRoute.domain_host,
            status: matchedRoute.status,
            dnsIntegrated: matchedRoute.dns_integrated === true,
            sslIntegrated: matchedRoute.ssl_integrated === true,
          }
        : null,
      resolutionMode: matched
        ? tenantMode
        : tenantMode === "strict"
          ? "strict_unmatched"
          : "default_only",
      fallbackRestaurantKey: RESTAURANT_KEY,
      multiRestaurantActive:
        matched && resolvedRoute.restaurant_key !== RESTAURANT_KEY,
      dnsIntegrated: matchedRoute?.dns_integrated === true,
      sslIntegrated: matchedRoute?.ssl_integrated === true,
      note: matched
        ? "Host resolvido pela projecao publica isolada."
        : "Host sem correspondencia; aplicado somente o fallback publico.",
    };
  }

  const state = await readMasterState();
  const registeredDomain =
    state.domains.find((domain) => getDomainCandidates(domain).includes(normalizedHost)) || null;
  const matchedDomain =
    tenantMode === "default_only"
      ? registeredDomain
      : registeredDomain && isResolvableDomain(registeredDomain)
        ? registeredDomain
        : null;
  const defaultRestaurant =
    state.restaurants.find((restaurant) => restaurant.restaurantKey === RESTAURANT_KEY) ||
    getDefaultRestaurant();
  const matchedRestaurant =
    matchedDomain && isRealTenantMode()
      ? state.restaurants.find(
          (restaurant) => restaurant.restaurantKey === matchedDomain.restaurantKey || restaurant.key === matchedDomain.restaurantKey
        ) || null
      : null;
  const resolvedRestaurant = matchedRestaurant || defaultRestaurant;
  const matched =
    tenantMode === "default_only"
      ? Boolean(matchedDomain)
      : Boolean(matchedDomain && matchedRestaurant && isRealTenantMode());
  const domain = matchedDomain || normalizeDomain({
    key: "fallback-default-domain",
    restaurantName: defaultRestaurant.name,
    domain: normalizedHost,
    primaryDomain: getCurrentDomain(),
    customDomain: normalizedHost === getCurrentDomain() ? "" : normalizedHost,
    status: "FALLBACK",
    statusLabel: "Fallback",
    sslStatus: "NOT_INTEGRATED",
    sslStatusLabel: "Nao integrado",
    createdAt: DEFAULT_CREATED_AT,
    notes: "Host resolvido pelo fallback default enquanto multi-restaurante nao esta ativo.",
    isSimulation: true,
  });

  return {
    ok: true,
    host: normalizedHost,
    matched,
    tenantId: resolvedRestaurant.tenantId,
    restaurantId: resolvedRestaurant.restaurantId,
    restaurantKey: resolvedRestaurant.restaurantKey,
    restaurantName: resolvedRestaurant.name,
    restaurant: cloneJson(resolvedRestaurant),
    domain: cloneJson(domain),
    resolutionMode: matched ? tenantMode : tenantMode === "strict" ? "strict_unmatched" : "default_only",
    fallbackRestaurantKey: RESTAURANT_KEY,
    multiRestaurantActive: matched && resolvedRestaurant.restaurantKey !== RESTAURANT_KEY,
    dnsIntegrated: false,
    sslIntegrated: false,
    note:
      matched
        ? "Host resolvido para restaurante real em modo piloto/strict."
        : "Host resolvido pelo fallback default enquanto multi-restaurante real nao esta ativo para este dominio.",
  };
};

const PUBLIC_RESTAURANT_STATUSES = new Set([
  "ACTIVE",
  "ATIVO",
  "CLIENTE_MODELO",
  "PILOT",
  "TRIAL",
  "VERIFIED",
]);

const isPublicRestaurantActive = (restaurant = {}) =>
  PUBLIC_RESTAURANT_STATUSES.has(
    normalizeText(restaurant.status, "", 80).toUpperCase()
  );

const resolveRestaurantBySlug = async (slug = "") => {
  const validation = validateRestaurantSlug(slug);
  const publicHost = getPublicAppHost();

  if (!validation.ok) {
    return {
      ok: false,
      matched: false,
      slug: validation.slug,
      host: publicHost,
      errorCode: validation.errorCode,
      resolutionMode: "public_path_invalid",
    };
  }

  if (getStorageMode() === "neon") {
    const route = await runWithDatabaseScope(
      { audience: "public" },
      () => readPublicRoute({ slug: validation.slug })
    );
    const active =
      route &&
      PUBLIC_RESTAURANT_STATUSES.has(String(route.status || "").toUpperCase());

    if (!active) {
      return {
        ok: false,
        matched: false,
        slug: validation.slug,
        host: publicHost,
        errorCode: "restaurant_slug_not_found",
        resolutionMode: "public_path_unmatched",
      };
    }

    return {
      ok: true,
      matched: true,
      matchedSlug: true,
      slug: route.slug,
      host: publicHost,
      tenantId: route.tenant_id,
      restaurantId: route.restaurant_id,
      restaurantKey: route.restaurant_key,
      restaurantName: route.restaurant_name,
      restaurant: {
        tenantId: route.tenant_id,
        restaurantId: route.restaurant_id,
        restaurantKey: route.restaurant_key,
        key: route.restaurant_key,
        slug: route.slug,
        name: route.restaurant_name,
        status: route.status,
      },
      domain: route.domain_host
        ? {
            restaurantKey: route.restaurant_key,
            domain: route.domain_host,
            status: route.status,
            dnsIntegrated: route.dns_integrated === true,
            sslIntegrated: route.ssl_integrated === true,
          }
        : null,
      resolutionMode: "public_path",
      fallbackRestaurantKey: RESTAURANT_KEY,
      multiRestaurantActive: route.restaurant_key !== RESTAURANT_KEY,
      publicUrl: route.public_url || buildRestaurantPublicUrl(route.slug),
      dnsIntegrated: route.dns_integrated === true,
      sslIntegrated: route.ssl_integrated === true,
      note: "Restaurante resolvido pela projecao publica isolada.",
    };
  }

  const state = await readMasterState();
  const restaurant =
    state.restaurants.find(
      (entry) =>
        normalizeRestaurantSlug(entry.slug) === validation.slug &&
        isPublicRestaurantActive(entry)
    ) || null;

  if (!restaurant) {
    return {
      ok: false,
      matched: false,
      slug: validation.slug,
      host: publicHost,
      errorCode: "restaurant_slug_not_found",
      resolutionMode: "public_path_unmatched",
    };
  }

  const domain =
    state.domains.find(
      (entry) =>
        entry.restaurantKey === restaurant.restaurantKey &&
        entry.isSimulation !== true
    ) || null;

  return {
    ok: true,
    matched: true,
    matchedSlug: true,
    slug: validation.slug,
    host: publicHost,
    tenantId: restaurant.tenantId,
    restaurantId: restaurant.restaurantId,
    restaurantKey: restaurant.restaurantKey,
    restaurantName: restaurant.name,
    restaurant: cloneJson(restaurant),
    domain: domain ? cloneJson(domain) : null,
    resolutionMode: "public_path",
    fallbackRestaurantKey: RESTAURANT_KEY,
    multiRestaurantActive: restaurant.restaurantKey !== RESTAURANT_KEY,
    publicUrl: buildRestaurantPublicUrl(validation.slug),
    dnsIntegrated: domain?.dnsIntegrated === true,
    sslIntegrated: domain?.sslIntegrated === true,
    note: "Restaurante resolvido pelo slug publico persistido.",
  };
};

const resolveRestaurantNameByKey = async (restaurantKey = RESTAURANT_KEY) => {
  const key = normalizeSlug(restaurantKey, "", 120);

  if (!key) {
    return "";
  }

  const state = await readMasterState();
  const restaurant =
    state.restaurants.find(
      (entry) => entry.restaurantKey === key || entry.key === key
    ) || null;

  if (restaurant?.name) {
    return restaurant.name;
  }

  const subscription =
    normalizeArray(state.subscriptions || state.contracts).find(
      (entry) => entry.restaurantKey === key || entry.key === key
    ) || null;
  const subscriptionName = normalizeText(
    subscription?.restaurantName || subscription?.restaurant,
    "",
    160
  );

  if (subscriptionName) {
    return subscriptionName;
  }

  if (key === RESTAURANT_KEY) {
    return getDefaultRestaurant().name;
  }

  return key;
};

const buildEvent = (actionType, actor = {}, target = "", metadata = {}) => ({
  id: `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
  actorLogin: normalizeText(actor.login, "", 160).toLowerCase(),
  actorName: normalizeText(actor.displayName || actor.name, "", 160),
  target: normalizeText(target, "", 240),
  changedAt: new Date().toISOString(),
  origin: "master-platform",
  actionType,
  metadata: cloneJson(metadata || {}),
});

// -----------------------------------------------------------------------------
// Restaurant onboarding
// -----------------------------------------------------------------------------

const buildOnboardingDomain = ({ restaurantKey, restaurantName, domain, subdomain, customDomain }) => {
  const requestedCustomDomain = normalizeDomainHost(customDomain, "");
  const isCustomDomainRequest = Boolean(requestedCustomDomain);
  const resolvedDomain = normalizeDomainHost(
    requestedCustomDomain || domain || subdomain || `${restaurantKey}.inovasfood.local`,
    `${restaurantKey}.inovasfood.local`
  );
  const now = new Date().toISOString();

  return normalizeDomain({
    key: `domain-${restaurantKey}`,
    tenantId: buildTenantId(restaurantKey),
    restaurantId: buildRestaurantId(restaurantKey),
    restaurantKey,
    restaurantName,
    domain: resolvedDomain,
    primaryDomain: isCustomDomainRequest ? "" : resolvedDomain,
    customDomain: isCustomDomainRequest ? requestedCustomDomain : "",
    status: isCustomDomainRequest ? PENDING_CUSTOM_DOMAIN_STATUS : "ACTIVE",
    statusLabel: isCustomDomainRequest ? PENDING_CUSTOM_DOMAIN_LABEL : "Ativo",
    sslStatus: "NOT_INTEGRATED",
    sslStatusLabel: "Nao integrado",
    createdAt: now,
    verifiedAt: null,
    activatedAt: isCustomDomainRequest ? null : now,
    notes: isCustomDomainRequest
      ? "Domínio próprio solicitado no onboarding e aguardando verificação manual."
      : "Dominio/subdominio habilitado para piloto V1.",
    isSimulation: false,
    dnsIntegrated: false,
    sslIntegrated: false,
  });
};

const getRequestedCustomDomain = (restaurantPayload = {}) => {
  const menuAddress = restaurantPayload.menuAddress && typeof restaurantPayload.menuAddress === "object"
    ? restaurantPayload.menuAddress
    : {};
  const explicitCustomDomain = normalizeDomainHost(
    restaurantPayload.customDomain || menuAddress.customDomain,
    ""
  );

  if (explicitCustomDomain) {
    return explicitCustomDomain;
  }

  return normalizeText(menuAddress.type, "", 40).toLowerCase() === "custom"
    ? normalizeDomainHost(restaurantPayload.domain, "")
    : "";
};

const isCustomDomainMode = (restaurantPayload = {}) => {
  const menuAddress = restaurantPayload.menuAddress && typeof restaurantPayload.menuAddress === "object"
    ? restaurantPayload.menuAddress
    : {};

  return Boolean(restaurantPayload.customDomain || menuAddress.customDomain) ||
    normalizeText(menuAddress.type, "", 40).toLowerCase() === "custom";
};

const isValidDomainHost = (value) =>
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
    normalizeDomainHost(value, "")
  );

const getRestaurantDocumentCandidates = (restaurant = {}) =>
  [
    restaurant.document,
    restaurant.taxId,
    restaurant.cnpjMei,
    restaurant.registration?.document,
    restaurant.registration?.taxId,
    restaurant.registration?.cnpjMei,
    restaurant.owner?.document,
  ]
    .map((value) => normalizeDocument(value))
    .filter(Boolean);

const getRestaurantEmailCandidates = (restaurant = {}) =>
  [
    restaurant.email,
    restaurant.registration?.email,
    restaurant.owner?.email,
    restaurant.onboarding?.registration?.email,
  ]
    .map((value) => normalizeText(value, "", 160).toLowerCase())
    .filter(Boolean);

const getRestaurantSlugCandidates = (restaurant = {}) =>
  [restaurant.restaurantKey, restaurant.key, restaurant.slug]
    .map((value) => normalizeSlug(value, "", 120))
    .filter(Boolean);

const getStateDomainCandidates = (state = {}) => {
  const domainEntries = normalizeArray(state.domains).flatMap(getDomainCandidates);
  const restaurantEntries = normalizeArray(state.restaurants).flatMap((restaurant) => [
    restaurant.domain,
    restaurant.subdomain,
    restaurant.onboarding?.menuAddress?.customDomain,
  ]);

  return new Set(
    [...domainEntries, ...restaurantEntries]
      .map((value) => normalizeDomainHost(value, ""))
      .filter(Boolean)
  );
};

const buildOnboardingSubscription = ({ restaurantKey, restaurantName, plan, status }) => {
  const normalizedPlan = assertKnownPlanKey(plan || "START");
  const normalizedStatus = assertKnownSubscriptionStatus(status || "TRIAL");
  const planDefinition = getDefaultPlanDefinition(normalizedPlan);

  return normalizeSubscription({
    key: restaurantKey,
    tenantId: buildTenantId(restaurantKey),
    restaurantId: buildRestaurantId(restaurantKey),
    restaurantKey,
    restaurantName,
    restaurant: restaurantName,
    plan: planDefinition.key,
    planName: planDefinition.name,
    monthlyValue: planDefinition.monthlyValue,
    status: normalizedStatus,
    contractStatus: normalizedStatus,
    billingStatus: "NOT_INTEGRATED",
    billingIntegrated: false,
    startedAt: new Date().toISOString(),
    dueDay: 10,
    releasedFeatures: planDefinition.features,
    blockedModules: [],
    notes: "Assinatura piloto criada no onboarding V1.",
  });
};

const createRestaurantOnboarding = async (payload = {}, actor = {}) => {
  const restaurantPayload = payload.restaurant && typeof payload.restaurant === "object"
    ? payload.restaurant
    : payload;
  const adminUser = payload.adminUser || payload.admin || restaurantPayload.adminUser || null;
  const restaurantName = normalizeText(
    restaurantPayload.name || restaurantPayload.restaurantName,
    "",
    160
  );
  const rawSlug = String(
    restaurantPayload.slug || normalizeRestaurantSlug(restaurantName)
  ).trim();
  const slugValidation = validateRestaurantSlug(rawSlug);
  const slug = slugValidation.slug;
  const requestedRestaurantKey = String(
    restaurantPayload.restaurantKey || slug
  ).trim();
  const restaurantKey = slug;
  const plan = assertKnownPlanKey(restaurantPayload.plan || restaurantPayload.initialPlan || "START");
  const subscriptionStatus = assertKnownSubscriptionStatus(
    restaurantPayload.subscriptionStatus || restaurantPayload.statusAssinatura || "TRIAL"
  );
  const whatsapp = assertOptionalWhatsapp(restaurantPayload.whatsapp);
  const requestedCustomDomain = getRequestedCustomDomain(restaurantPayload);
  const customDomainMode = isCustomDomainMode(restaurantPayload);
  const registration = {
    ...buildV11RegistrationData(restaurantPayload, adminUser),
    companyName: normalizeText(
      restaurantPayload.companyName || restaurantPayload.razaoSocial || restaurantPayload.legalName,
      "",
      180
    ),
    stateRegistration: normalizeText(
      restaurantPayload.stateRegistration || restaurantPayload.inscricaoEstadual,
      "",
      80
    ),
    responsible: normalizeText(
      restaurantPayload.responsible || restaurantPayload.responsavel,
      "",
      160
    ),
  };
  const actorType = normalizeText(actor.userType || actor.tipo_usuario, "", 80).toUpperCase();
  const sellerId = normalizeText(
    actorType === "VENDEDOR"
      ? actor.id || actor.login || actor.email || actor.displayName
      : restaurantPayload.seller_id || restaurantPayload.sellerId,
    "",
    160
  );
  assertV11RegistrationData(registration);

  if (!restaurantName) {
    throw buildOnboardingHttpError(
      400,
      "missing_restaurant_name",
      "Nome do restaurante é obrigatório para onboarding."
    );
  }

  if (!slugValidation.ok || requestedRestaurantKey !== slug) {
    throw buildOnboardingHttpError(
      400,
      slugValidation.errorCode || "invalid_restaurant_slug",
      slugValidation.message || "Slug/restaurantKey do restaurante piloto é inválido."
    );
  }

  if (customDomainMode && (!requestedCustomDomain || !isValidDomainHost(requestedCustomDomain))) {
    throw buildOnboardingHttpError(
      400,
      "invalid_restaurant_domain",
      "Informe um domínio válido para o restaurante."
    );
  }

  const state = await readMasterState();
  const restaurantExists = state.restaurants.some(
    (restaurant) => {
      const candidates = getRestaurantSlugCandidates(restaurant);
      return candidates.includes(restaurantKey) || candidates.includes(slug);
    }
  );

  if (restaurantExists) {
    throw buildOnboardingHttpError(
      409,
      "restaurant_slug_already_exists",
      "Este endereço INOVAS já está sendo utilizado."
    );
  }

  const documentExists = registration.document && state.restaurants.some(
    (restaurant) => getRestaurantDocumentCandidates(restaurant).includes(registration.document)
  );

  if (documentExists) {
    throw buildOnboardingHttpError(
      409,
      "restaurant_cnpj_already_exists",
      "Já existe um restaurante cadastrado com este CNPJ."
    );
  }

  const emailExists = registration.email && state.restaurants.some(
    (restaurant) => getRestaurantEmailCandidates(restaurant).includes(registration.email)
  );

  if (emailExists) {
    throw buildOnboardingHttpError(
      409,
      "restaurant_email_already_exists",
      "Já existe um restaurante cadastrado com este e-mail."
    );
  }

  const domain = buildOnboardingDomain({
    restaurantKey,
    restaurantName,
    domain: restaurantPayload.domain || restaurantPayload.customDomain,
    subdomain: restaurantPayload.subdomain,
    customDomain: requestedCustomDomain,
  });
  const domainHosts = new Set(getDomainCandidates(domain));
  const stateDomainHosts = getStateDomainCandidates(state);
  const domainExists = [...domainHosts].some((candidate) => stateDomainHosts.has(candidate));

  if (domainExists) {
    throw buildOnboardingHttpError(
      409,
      "restaurant_domain_already_exists",
      "Este domínio já está vinculado ou solicitado por outro restaurante."
    );
  }

  const restaurant = normalizeRestaurant({
    key: restaurantKey,
    tenantId: buildTenantId(restaurantKey),
    restaurantId: buildRestaurantId(restaurantKey),
    restaurantKey,
    name: restaurantName,
    slug,
    status: "PILOT",
    statusLabel: "Piloto",
    plan,
    domain: domain.domain,
    subdomain: restaurantPayload.subdomain || "",
    whatsapp,
    seller_id: sellerId,
    sellerId,
    address: {
      ...(restaurantPayload.address || {}),
      city: restaurantPayload.address?.city || registration.city,
      postalCode: restaurantPayload.address?.postalCode || registration.postalCode,
      number: restaurantPayload.address?.number || registration.establishmentNumber,
    },
    registration,
    owner: {
      fullName: registration.ownerFullName,
      email: registration.email,
      phone: registration.phone,
      document: registration.document,
    },
    onboarding: {
      whatsapp,
      registration,
      address: {
        ...(restaurantPayload.address || {}),
        city: restaurantPayload.address?.city || registration.city,
        postalCode: restaurantPayload.address?.postalCode || registration.postalCode,
        number: restaurantPayload.address?.number || registration.establishmentNumber,
      },
      businessSchedule: restaurantPayload.businessSchedule || restaurantPayload.hours || {},
      delivery: restaurantPayload.delivery || {},
      paymentMethods: restaurantPayload.paymentMethods || [],
      menuAddress: {
        ...(restaurantPayload.menuAddress &&
        typeof restaurantPayload.menuAddress === "object"
          ? cloneJson(restaurantPayload.menuAddress)
          : {}),
        type: customDomainMode ? "custom" : "inovas",
        slug,
        internalUrl: buildRestaurantPublicUrl(slug),
        publicUrl: buildRestaurantPublicUrl(slug),
      },
      features: normalizeArray(restaurantPayload.features),
      appearance:
        restaurantPayload.appearance && typeof restaurantPayload.appearance === "object"
          ? cloneJson(restaurantPayload.appearance)
          : {},
    },
    createdAt: new Date().toISOString(),
    notes: "Restaurante real cadastrado em modo piloto V1.",
  });
  const subscription = buildOnboardingSubscription({
    restaurantKey,
    restaurantName,
    plan,
    status: subscriptionStatus,
  });
  const planDefinition = getPlanFromState(state, subscription.plan);
  const nextState = normalizeMasterState({
    ...state,
    restaurants: [...state.restaurants, restaurant],
    domains: [...state.domains, domain],
    contracts: [
      ...state.contracts.filter((contract) => contract.restaurantKey !== restaurantKey),
      subscription,
    ],
    subscriptions: [
      ...state.subscriptions.filter((contract) => contract.restaurantKey !== restaurantKey),
      subscription,
    ],
    restaurantFeatureFlags: {
      ...state.restaurantFeatureFlags,
      [restaurantKey]: normalizeFeatureFlags(
        planDefinition.features.reduce((flags, featureKey) => {
          flags[featureKey] = true;
          return flags;
        }, {})
      ),
    },
    logs: [
      buildEvent("restaurant_onboarded", actor, restaurantKey, {
        restaurantKey,
        plan: subscription.plan,
        status: subscription.contractStatus,
        seller_id: sellerId,
      }),
      ...state.logs,
    ],
    audit: [
      buildEvent("restaurant_onboarded", actor, restaurantKey, {
        restaurantKey,
        domain: domain.domain,
        seller_id: sellerId,
      }),
      ...state.audit,
    ],
  });

  await writeMasterState(nextState);

  return {
    storageMode: getStorageMode(),
    generatedAt: new Date().toISOString(),
    restaurant: {
      ...restaurant,
      publicUrl: buildRestaurantPublicUrl(restaurant.slug),
    },
    domain,
    subscription,
    tenant: {
      tenantId: restaurant.tenantId,
      restaurantId: restaurant.restaurantId,
      restaurantKey: restaurant.restaurantKey,
      restaurantName: restaurant.name,
      publicUrl: buildRestaurantPublicUrl(restaurant.slug),
    },
    registration,
    adminUser,
    message: "Restaurante cadastrado em modo piloto com sucesso.",
  };
};

const updateRestaurantSubscription = async (payload = {}, actor = {}) => {
  const restaurantKey = normalizeSlug(payload.restaurantKey || payload.key, "", 120);
  const requestedPlan = payload.plan || payload.planKey || payload.planName;
  const requestedStatus = payload.status || payload.contractStatus || payload.status_contrato;

  if (!restaurantKey) {
    throw new Error("restaurantKey e obrigatorio para atualizar assinatura.");
  }

  if (requestedPlan) {
    assertKnownPlanKey(requestedPlan);
  }

  if (requestedStatus) {
    assertKnownSubscriptionStatus(requestedStatus);
  }

  const state = await readMasterState();
  const restaurant = state.restaurants.find((entry) => entry.restaurantKey === restaurantKey);

  if (!restaurant) {
    throw new Error("Restaurante nao encontrado para assinatura.");
  }

  const existing = getContractFromState(state, restaurantKey);
  const nextPlanKey = requestedPlan ? assertKnownPlanKey(requestedPlan) : existing.plan;
  const nextPlanDefinition = getPlanFromState(state, nextPlanKey);
  const explicitReleasedFeatures =
    payload.releasedFeatures || payload.recursos_liberados || payload.features;
  const nextSubscription = normalizeSubscription({
    ...existing,
    ...payload,
    key: restaurantKey,
    restaurantKey,
    restaurantName: restaurant.name,
    plan: nextPlanDefinition.key,
    planName: nextPlanDefinition.name,
    releasedFeatures: explicitReleasedFeatures || nextPlanDefinition.features,
    recursos_liberados: explicitReleasedFeatures || nextPlanDefinition.features,
    status: payload.status || payload.contractStatus || existing.contractStatus,
    contractStatus: payload.contractStatus || payload.status || existing.contractStatus,
  });
  const nextState = normalizeMasterState({
    ...state,
    contracts: state.contracts.map((contract) =>
      contract.restaurantKey === restaurantKey ? nextSubscription : contract
    ),
    subscriptions: state.subscriptions.map((contract) =>
      contract.restaurantKey === restaurantKey ? nextSubscription : contract
    ),
    restaurantFeatureFlags: {
      ...state.restaurantFeatureFlags,
      [restaurantKey]: normalizeFeatureFlags(
        nextPlanDefinition.features.reduce((flags, featureKey) => {
          flags[featureKey] = true;
          return flags;
        }, {})
      ),
    },
    logs: [
      buildEvent("subscription_updated", actor, restaurantKey, {
        restaurantKey,
        status: nextSubscription.contractStatus,
        plan: nextSubscription.plan,
      }),
      ...state.logs,
    ],
    audit: [
      buildEvent("subscription_updated", actor, restaurantKey, {
        restaurantKey,
        status: nextSubscription.contractStatus,
      }),
      ...state.audit,
    ],
  });

  await writeMasterState(nextState);

  return {
    storageMode: getStorageMode(),
    generatedAt: new Date().toISOString(),
    subscription: nextSubscription,
    message: "Assinatura atualizada com sucesso.",
  };
};

const toNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

// -----------------------------------------------------------------------------
// Platform dashboard snapshot
// -----------------------------------------------------------------------------

const isActiveRestaurantStatus = (status = "") =>
  ["ACTIVE", "ATIVO", "TRIAL", "PILOT", "CLIENTE_MODELO"].includes(
    normalizeText(status, "", 80).toUpperCase()
  );

const isBlockedRestaurantStatus = (status = "") =>
  ["BLOCKED", "BLOQUEADO", "SUSPENDED", "SUSPENSO", "INACTIVE", "INATIVO", "CANCELED", "CANCELADO"].includes(
    normalizeText(status, "", 80).toUpperCase()
  );

const isActiveSubscriptionStatus = (status = "") =>
  ["ACTIVE", "ATIVO", "TRIAL"].includes(normalizeSubscriptionStatusKey(status, "TRIAL"));

const isExpiringSubscription = (subscription = {}, now = new Date()) => {
  const dueDateValue = normalizeText(
    subscription.nextBillingAt || subscription.dueDate || subscription.data_vencimento,
    "",
    80
  );

  if (!dueDateValue) {
    return false;
  }

  const dueDate = new Date(dueDateValue);

  if (Number.isNaN(dueDate.getTime())) {
    return false;
  }

  const diffMs = dueDate.getTime() - now.getTime();
  return diffMs >= 0 && diffMs <= 1000 * 60 * 60 * 24 * 15;
};

const getRestaurantCity = (restaurant = {}) =>
  normalizeText(
    restaurant.registration?.city || restaurant.address?.city || restaurant.onboarding?.address?.city,
    "",
    120
  );

const getRestaurantState = (restaurant = {}) =>
  normalizeText(
    restaurant.registration?.state ||
      restaurant.address?.state ||
      restaurant.onboarding?.address?.state ||
      restaurant.onboarding?.address?.uf,
    "",
    40
  );

const getRestaurantResponsible = (restaurant = {}) =>
  normalizeText(
    restaurant.registration?.ownerFullName || restaurant.owner?.fullName || restaurant.owner?.name,
    "",
    160
  );

const getRestaurantPhone = (restaurant = {}) =>
  normalizeText(
    restaurant.registration?.phone ||
      restaurant.registration?.telefone ||
      restaurant.owner?.phone ||
      restaurant.whatsapp,
    "",
    80
  );

const getRestaurantLastLogin = (restaurant = {}, users = []) => {
  const user = users
    .filter((entry) => entry.restaurantKey === restaurant.restaurantKey)
    .sort((left, right) => String(right.lastAccessAt || "").localeCompare(String(left.lastAccessAt || "")))[0];

  return normalizeText(user?.lastAccessAt || user?.ultimo_acesso, "", 80);
};

const buildDashboard = (state, metrics = {}, users = [], userDirectory = []) => {
  const restaurants = normalizeArray(state.restaurants);
  const contracts = normalizeArray(state.contracts || state.subscriptions);
  const activeContracts = contracts.filter((contract) =>
    isActiveSubscriptionStatus(contract.contractStatus || contract.status)
  );
  const monthlyRecurringRevenue = activeContracts.reduce(
    (total, contract) => total + toNumber(contract.monthlyValue || contract.valor_mensal),
    0
  );
  const systemUsers = normalizeArray(userDirectory).filter((user) => user.isPlatformUser);
  const restaurantUsers = normalizeArray(userDirectory).filter((user) => !user.isPlatformUser);
  const accessRate = userDirectory.length
    ? Math.round((toNumber(metrics.totalAccesses) / Math.max(userDirectory.length, 1)) * 100)
    : 0;
  const errorCount = normalizeArray(state.logs).filter((event) =>
    normalizeText(event.actionType || event.action, "", 120).toLowerCase().includes("error")
  ).length;

  return {
    totalRestaurants: restaurants.length,
    activeRestaurants: restaurants.filter((restaurant) => isActiveRestaurantStatus(restaurant.status)).length,
    blockedRestaurants: restaurants.filter((restaurant) => isBlockedRestaurantStatus(restaurant.status)).length,
    systemUsers: systemUsers.length,
    restaurantUsers: restaurantUsers.length,
    totalUsers: users.length,
    totalDomains: state.domains.length,
    totalOrders: toNumber(metrics.totalOrders),
    ordersToday: toNumber(metrics.ordersToday || metrics.totalOrders),
    ordersMonth: toNumber(metrics.ordersMonth || metrics.totalOrders),
    totalCustomers: toNumber(metrics.totalCustomers),
    totalReviews: toNumber(metrics.totalReviews),
    totalRevenue: toNumber(metrics.totalRevenue),
    monthlyRevenue: toNumber(metrics.monthlyRevenue || metrics.totalRevenue || monthlyRecurringRevenue),
    monthlyRecurringRevenue,
    annualRecurringRevenue: monthlyRecurringRevenue * 12,
    newRestaurants: restaurants.filter((restaurant) => restaurant.restaurantKey !== RESTAURANT_KEY).length,
    activeSubscriptions: activeContracts.length,
    expiringSubscriptions: contracts.filter((contract) => isExpiringSubscription(contract)).length,
    averagePlatformUsage: accessRate,
    supportTickets: toNumber(metrics.supportTickets),
    errors: errorCount,
    performanceScore: errorCount > 0 ? 92 : 99,
    performanceStatus: errorCount > 0 ? "Atencao" : "Estavel",
    totalAccesses: toNumber(metrics.totalAccesses),
  };
};

const buildPlatformPlans = (plans = []) => {
  const preferredKeys = ["START", "PRO", "PREMIUM"];
  const normalizedPlans = normalizeArray(plans);
  const selectedPlans = preferredKeys
    .map((key) => normalizedPlans.find((plan) => plan.key === key))
    .filter(Boolean);
  const fallbackPlans = selectedPlans.length ? selectedPlans : normalizedPlans;
  const officialNames = {
    START: "Essencial",
    PRO: "Profissional",
    PREMIUM: "Enterprise",
  };

  return fallbackPlans
    .map((plan, index) => ({
      ...cloneJson(plan),
      displayName: officialNames[plan.key] || plan.displayName || plan.name,
      color: plan.color || ["#FF6A00", "#111827", "#22C55E", "#F59E0B"][index % 4],
      order: Number(plan.order || index + 1),
      featured: plan.featured === true || plan.key === "PRO",
      editable: true,
      canCreateNewPlan: true,
    }))
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
};

const buildSellerDirectory = (restaurants = [], users = []) => {
  const sellerUsers = normalizeArray(users).filter((user) => {
    const userType = normalizeText(user.userType || user.tipo_usuario, "", 80).toUpperCase();
    return userType === "VENDEDOR";
  });

  return sellerUsers.map((seller) => {
    const sellerId = normalizeText(seller.id || seller.login || seller.email, "", 160);
    const linkedRestaurants = normalizeArray(restaurants).filter(
      (restaurant) => normalizeText(restaurant.sellerId || restaurant.seller_id, "", 160) === sellerId
    );

    return {
      id: sellerId,
      name: seller.name || seller.nome || seller.login,
      phone: seller.phone || seller.telefone || "",
      email: seller.email || seller.login || "",
      clients: linkedRestaurants.length,
      restaurants: linkedRestaurants.length,
      commissionRate: seller.commissionRate || "Preparado",
      status: seller.status || "ACTIVE",
      linkedRestaurantKeys: linkedRestaurants.map((restaurant) => restaurant.restaurantKey),
    };
  });
};

const buildCommissions = (state, sellers = []) => {
  const sellersById = new Map(sellers.map((seller) => [seller.id, seller]));
  const restaurantsByKey = new Map(state.restaurants.map((restaurant) => [restaurant.restaurantKey, restaurant]));

  return normalizeArray(state.contracts || state.subscriptions).map((contract) => {
    const restaurant = restaurantsByKey.get(contract.restaurantKey) || {};
    const sellerId = normalizeText(restaurant.sellerId || restaurant.seller_id, "", 160);
    const seller = sellersById.get(sellerId) || null;

    return {
      restaurantKey: contract.restaurantKey,
      restaurantName: contract.restaurantName || restaurant.name,
      plan: contract.plan,
      monthlyValue: contract.monthlyValue || contract.valor_mensal,
      sellerId,
      sellerName: seller?.name || (sellerId ? sellerId : "Sem vendedor vinculado"),
      percentage: sellerId ? "A definir" : "Nao aplicado",
      value: "A calcular",
      status: "PREPARED",
    };
  });
};

const buildContracts = (state) =>
  normalizeArray(state.contracts || state.subscriptions).map((contract) => ({
    id: `contract-${contract.restaurantKey}`,
    contract: `Contrato ${contract.restaurantName || contract.restaurantKey}`,
    plan: contract.plan,
    restaurantName: contract.restaurantName || contract.restaurant,
    status: contract.contractStatus || contract.status,
    signed: false,
    signedLabel: "Preparado",
    date: contract.startedAt || contract.data_inicio,
    download: "Preparado",
    paymentMethod: "Nao integrado",
    history: "Estrutura preparada para integracao futura.",
  }));

const buildFinanceDashboard = (dashboard, state) => {
  const contracts = normalizeArray(state.contracts || state.subscriptions);
  const activeContracts = contracts.filter((contract) =>
    isActiveSubscriptionStatus(contract.contractStatus || contract.status)
  );
  const overdueContracts = contracts.filter(
    (contract) => normalizeSubscriptionStatusKey(contract.contractStatus || contract.status, "") === "EXPIRED"
  );
  const payingCustomers = activeContracts.length;
  const mrr = dashboard.monthlyRecurringRevenue;
  const ticketAverage = payingCustomers ? mrr / payingCustomers : 0;
  const restaurantsByKey = new Map(state.restaurants.map((restaurant) => [restaurant.restaurantKey, restaurant]));
  const revenueByPlan = activeContracts.reduce((entries, contract) => {
    const key = contract.plan || "SEM_PLANO";
    entries[key] = (entries[key] || 0) + toNumber(contract.monthlyValue || contract.valor_mensal);
    return entries;
  }, {});
  const revenueByCity = activeContracts.reduce((entries, contract) => {
    const restaurant = restaurantsByKey.get(contract.restaurantKey) || {};
    const key = getRestaurantCity(restaurant) || "Nao informado";
    entries[key] = (entries[key] || 0) + toNumber(contract.monthlyValue || contract.valor_mensal);
    return entries;
  }, {});
  const revenueByState = activeContracts.reduce((entries, contract) => {
    const restaurant = restaurantsByKey.get(contract.restaurantKey) || {};
    const key = getRestaurantState(restaurant) || "Nao informado";
    entries[key] = (entries[key] || 0) + toNumber(contract.monthlyValue || contract.valor_mensal);
    return entries;
  }, {});

  return {
    mrr,
    monthlyRevenue: dashboard.monthlyRevenue,
    annualRevenue: dashboard.annualRecurringRevenue,
    payingCustomers,
    overdueCustomers: overdueContracts.length,
    averageTicket: ticketAverage,
    revenueByPlan,
    revenueByCity,
    revenueByState,
  };
};

const buildCommercialDashboard = (state, sellers = []) => {
  const realRestaurants = state.restaurants.filter((restaurant) => restaurant.restaurantKey !== RESTAURANT_KEY);
  const activeSellers = sellers.filter((seller) => normalizeText(seller.status, "", 80).toUpperCase() === "ACTIVE");
  const leads = 0;
  const newCustomers = realRestaurants.length;

  return {
    leads,
    newCustomers,
    conversionRate: leads ? Math.round((newCustomers / leads) * 100) : 0,
    restaurants: state.restaurants.length,
    sellers: sellers.length,
    activeSellers: activeSellers.length,
    topSellers: sellers
      .slice()
      .sort((left, right) => Number(right.restaurants || 0) - Number(left.restaurants || 0))
      .slice(0, 5),
  };
};

const buildDeveloperArea = (state, metrics = {}) => ({
  ...state.developer,
  platformVersion: PLATFORM_VERSION,
  diagnostics: [
    { key: "storageMode", label: "Armazenamento", value: getStorageMode() },
    { key: "nodeEnv", label: "Ambiente Node", value: process.env.NODE_ENV || "development" },
    { key: "restaurantKey", label: "Restaurant key atual", value: RESTAURANT_KEY },
    { key: "restaurants", label: "Restaurantes cadastrados", value: String(state.restaurants.length) },
    { key: "users", label: "Usuários cadastrados", value: String(metrics.totalUsers || 0) },
  ],
  moduleStatuses: MASTER_MENU_MODULES.map((module) => ({
    key: module.key,
    label: module.label,
    status: module.status,
  })),
  featureFlags: state.restaurantFeatureFlags[RESTAURANT_KEY],
});

// -----------------------------------------------------------------------------
// User directory and final snapshot
// -----------------------------------------------------------------------------

const buildUserDirectory = (state, users = []) => {
  const restaurantsByKey = new Map(
    normalizeArray(state.restaurants).map((restaurant) => [restaurant.restaurantKey, restaurant])
  );
  const subscriptionsByRestaurant = new Map(
    normalizeArray(state.subscriptions || state.contracts).map((subscription) => [
      subscription.restaurantKey,
      subscription,
    ])
  );

  return normalizeArray(users).map((user) => {
    const restaurant = restaurantsByKey.get(user.restaurantKey) || null;
    const subscription = subscriptionsByRestaurant.get(user.restaurantKey) || null;
    const registration = restaurant?.registration || restaurant?.onboarding?.registration || {};
    const userType = String(user.userType || user.tipo_usuario || "").toUpperCase();
    const isPlatformUser = SYSTEM_USER_TYPES.includes(userType);
    const restaurantName = isPlatformUser
      ? "Plataforma INOVAS Food"
      : restaurant?.name || user.restaurantKey || RESTAURANT_KEY;
    const plan = isPlatformUser
      ? "PLATAFORMA"
      : subscription?.plan || restaurant?.plan || "--";
    const status = user.status || "ACTIVE";

    return {
      ...cloneJson(user),
      directoryId: user.id || user.login,
      id: user.id || user.login,
      name: user.name || user.nome || user.login,
      userType,
      isPlatformUser,
      isRestaurantUser: RESTAURANT_USER_TYPES.includes(userType),
      restaurantName,
      restaurant: restaurantName,
      restaurantKey: isPlatformUser ? "" : user.restaurantKey,
      plan,
      planName: subscription?.planName || plan,
      status,
      statusLabel: status === "ACTIVE" ? "Ativo" : status === "BLOCKED" ? "Bloqueado" : status,
      email: user.email || (String(user.login || "").includes("@") ? user.login : ""),
      phone: registration.phone || registration.telefone || restaurant?.whatsapp || "",
      taxId: registration.document || registration.taxId || registration.cnpjMei || "",
      cnpjMei: registration.cnpjMei || registration.document || registration.taxId || "",
      ownerFullName: registration.ownerFullName || restaurant?.owner?.fullName || "",
      tradeName: registration.tradeName || restaurant?.name || "",
      city: registration.city || restaurant?.address?.city || "",
      postalCode: registration.postalCode || registration.cep || restaurant?.address?.postalCode || "",
      adhesionDate: registration.adhesionDate || registration.dataAdesao || restaurant?.createdAt || "",
      actions: {
        view: true,
        edit: true,
        toggleStatus: true,
      },
      searchIndex: [
        user.id,
        user.login,
        user.email,
        user.name,
        user.nome,
        restaurantName,
        user.restaurantKey,
        registration.document,
        registration.taxId,
        registration.cnpjMei,
        registration.phone,
        registration.telefone,
        restaurant?.whatsapp,
      ]
        .map((value) => normalizeText(value, "", 240).toLowerCase())
        .filter(Boolean)
        .join(" "),
    };
  });
};

const getMasterPlatformSnapshot = async ({ metrics = {}, usersPayload = {} } = {}) => {
  const state = await readMasterState();
  const tenantMode = getTenantMode();
  const users = Array.isArray(usersPayload.users) ? usersPayload.users : [];
  const userDirectory = buildUserDirectory(state, users);
  const defaultDomainResolution = await resolveRestaurantByHost(getCurrentDomain());
  const commercialAccess = buildRestaurantCommercialAccess(state, RESTAURANT_KEY);
  const dashboard = buildDashboard(
    state,
    {
      ...metrics,
      totalUsers: users.length,
    },
    users,
    userDirectory
  );
  const platformPlans = buildPlatformPlans(state.plans);
  const sellers = buildSellerDirectory(state.restaurants, userDirectory);
  const commissions = buildCommissions(state, sellers);
  const platformContracts = buildContracts(state);
  const financeDashboard = buildFinanceDashboard(dashboard, state);
  const commercialDashboard = buildCommercialDashboard(state, sellers);

  return {
    ok: true,
    storageMode: getStorageMode(),
    restaurantKey: RESTAURANT_KEY,
    generatedAt: new Date().toISOString(),
    menu: cloneJson(MASTER_MENU_MODULES),
    dashboard,
    platformDashboard: cloneJson(dashboard),
    platform: {
      ...cloneJson(state.platform),
      site: getPublicAppUrl(),
      domain: getPublicAppHost(),
    },
    settings: {
      ...cloneJson(state.platform),
      site: getPublicAppUrl(),
      domain: getPublicAppHost(),
    },
    publicAppUrl: getPublicAppUrl(),
    restaurantRouting: {
      strategy: "official_domain_path_slug",
      publicAppUrl: getPublicAppUrl(),
      reservedSlugs: [...RESERVED_RESTAURANT_SLUGS],
    },
    restaurants: cloneJson(
      state.restaurants.map((restaurant) => ({
        ...restaurant,
        publicUrl: buildRestaurantPublicUrl(restaurant.slug),
      }))
    ),
    plans: cloneJson(state.plans),
    platformPlans: cloneJson(platformPlans),
    resources: cloneJson(state.resources),
    commercialFeatures: cloneJson(state.resources),
    featureFlags: cloneJson(state.featureFlags),
    restaurantFeatureFlags: cloneJson(state.restaurantFeatureFlags),
    domains: cloneJson(state.domains),
    domainResolver: {
      activeMode: tenantMode,
      fallbackRestaurantKey: RESTAURANT_KEY,
      sampleHost: getCurrentDomain(),
      sampleResolution: defaultDomainResolution,
      preparedForCustomDomains: true,
      dnsIntegrated: false,
      sslIntegrated: false,
      note:
        tenantMode === "default_only"
          ? "Resolucao host -> restaurante preparada. default_only preserva Tokyo/default."
          : "Resolucao host -> restaurante ativa para dominios cadastrados em modo piloto/strict.",
    },
    subscriptions: cloneJson(state.subscriptions),
    contracts: cloneJson(state.contracts),
    platformContracts: cloneJson(platformContracts),
    sellers: cloneJson(sellers),
    commissions: cloneJson(commissions),
    financeDashboard: cloneJson(financeDashboard),
    commercialDashboard: cloneJson(commercialDashboard),
    commercialAccess: cloneJson(commercialAccess),
    reports: cloneJson(state.reports),
    logs: cloneJson(state.logs),
    audit: cloneJson(state.audit),
    developer: buildDeveloperArea(state, {
      ...metrics,
      totalUsers: users.length,
    }),
    users: userDirectory,
    rawUsers: users,
    permissionModules: usersPayload.permissionModules || [],
    futureArchitecture: {
      preparedForInovasFood: true,
      preparedForMultiRestaurant: true,
      preparedForCustomDomains: true,
      preparedForPlans: true,
      preparedForSubscriptions: true,
      multiRestaurantActive: tenantMode !== "default_only",
      billingIntegrated: false,
      currentRestaurantKey: RESTAURANT_KEY,
      domainResolutionMode: tenantMode,
      note:
        tenantMode === "default_only"
          ? "default_only preserva a operacao atual usando restaurant_key default."
          : "Modo piloto/strict permite operar restaurantes reais por TenantContext.",
    },
  };
};

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

module.exports = {
  COMMERCIAL_FEATURE_DEFINITIONS,
  MASTER_MENU_MODULES,
  PLATFORM_FEATURE_FLAGS,
  PLATFORM_VERSION,
  RESTAURANT_KEY,
  createRestaurantOnboarding,
  getCommercialFeatureForAdminRoute,
  getMasterPlatformSnapshot,
  getPlanAccessForAdminModule,
  getRestaurantCommercialAccess,
  resolveRestaurantNameByKey,
  getStorageMode,
  normalizeDomainHost,
  resolveRestaurantBySlug,
  resolveRestaurantByHost,
  updateRestaurantSubscription,
};
