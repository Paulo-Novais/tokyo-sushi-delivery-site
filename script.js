const TOKYO_RUNTIME_CONFIG =
  typeof window === "object" && window.TOKYO_SITE_CONFIG ? window.TOKYO_SITE_CONFIG : {};
const TOKYO_APP_BRANDING = Object.freeze(TOKYO_RUNTIME_CONFIG.appBranding || {});
const TOKYO_RESTAURANT_BRAND = Object.freeze(TOKYO_RUNTIME_CONFIG.restaurantBrand || {});
const TOKYO_FEATURES = Object.freeze(TOKYO_RUNTIME_CONFIG.features || {});
const TOKYO_ASSETS = Object.freeze(TOKYO_RUNTIME_CONFIG.assets || {});
const TOKYO_IDENTIFIERS = Object.freeze(TOKYO_RUNTIME_CONFIG.identifiers || {});
const TOKYO_STORAGE_KEYS = Object.freeze(TOKYO_IDENTIFIERS.storageKeys || {});
const TOKYO_HEADER_NAMES = Object.freeze(TOKYO_IDENTIFIERS.headerNames || {});
const TOKYO_GLOBAL_NAMES = Object.freeze(TOKYO_IDENTIFIERS.globalNames || {});
const TOKYO_WHATSAPP_TEMPLATES = Object.freeze(TOKYO_RUNTIME_CONFIG.whatsappTemplates || {});
const TOKYO_PUBLIC_TEXT = Object.freeze(TOKYO_RUNTIME_CONFIG.publicText || {});
const TOKYO_SITE_APPEARANCE = Object.freeze(TOKYO_RUNTIME_CONFIG.siteAppearance || {});
const FALLBACK_WHATSAPP_NUMBER = TOKYO_APP_BRANDING.defaultWhatsapp || "5516990507398";
const CART_STORAGE_KEY = TOKYO_STORAGE_KEYS.cart || "tokyo_sushi_delivery_cart";
const AUTH_PROFILE_KEY = TOKYO_STORAGE_KEYS.authProfile || "tokyo_sushi_profile";
const AUTH_ACCOUNTS_KEY = TOKYO_STORAGE_KEYS.authAccounts || "tokyo_sushi_accounts";
const PHONE_VERIFICATION_CODE_LENGTH = 6;
const CUSTOMER_AUTH_START_ENDPOINT = "/api/customer/auth/start";
const CUSTOMER_AUTH_VERIFY_ENDPOINT = "/api/customer/auth/verify";
const CUSTOMER_AUTH_REQUEST_TIMEOUT_MS = 12000;
const ORDER_CREATE_ENDPOINT = "/api/orders/create";
const ORDER_CREATE_TIMEOUT_MS = 15000;
const CUSTOMER_ACTIVE_ORDER_ENDPOINT = "/api/customer/orders/active";
const CUSTOMER_LOGOUT_ENDPOINT = "/api/customer/logout";
const PUBLIC_CATALOG_STATE_ENDPOINT = "/api/catalog";
const PUBLIC_REVIEWS_ENDPOINT = "/api/reviews";
const PUBLIC_DELIVERY_SETTINGS_ENDPOINT = "/api/delivery-settings";
const PUBLIC_RESTAURANT_SETTINGS_ENDPOINT = "/api/restaurant-settings";
const PUBLIC_REVIEW_ROTATION_INTERVAL_MS = 6200;
const PUBLIC_REVIEW_HOME_VISIBLE_COUNT = 2;
const PUBLIC_REVIEW_SHORT_COMMENT_LENGTH = 118;
const CUSTOMER_CLIENT_TOKEN_KEY =
  TOKYO_STORAGE_KEYS.customerClientToken || "tokyo_customer_client_token";
const ORDER_HISTORY_STORAGE_KEY = TOKYO_STORAGE_KEYS.orderHistory || "tokyo_sushi_order_history";
const CART_ADDONS_STORAGE_KEY =
  TOKYO_STORAGE_KEYS.cartAddons || "tokyo_sushi_delivery_cart_addons";
const CART_CHECKOUT_STORAGE_KEY =
  TOKYO_STORAGE_KEYS.cartCheckout || "tokyo_sushi_cart_checkout";
const DELIVERY_HISTORY_STORAGE_KEY =
  TOKYO_STORAGE_KEYS.deliveryHistory || "tokyo_sushi_delivery_quotes";
const CAREER_STORAGE_KEY = TOKYO_STORAGE_KEYS.careerForms || "tokyo_sushi_career_forms";
const CATALOG_COLLAPSED_SECTIONS_STORAGE_KEY =
  TOKYO_STORAGE_KEYS.catalogCollapsedSections || "tokyo_sushi_catalog_collapsed_sections";
const CUSTOMER_CLIENT_TOKEN_HEADER =
  TOKYO_HEADER_NAMES.customerClientToken || "x-tokyo-customer-client-token";
const CUSTOMER_KEY_HEADER = TOKYO_HEADER_NAMES.customerKey || "x-tokyo-customer-key";
const SOCIAL_EMAIL_DOMAIN = TOKYO_IDENTIFIERS.socialEmailDomain || "social.tokyo";
const ORDER_HISTORY_WINDOW_DAYS = 30;
const CUSTOMER_TRACKING_REFRESH_INTERVAL_MS = 25000;
const CUSTOMER_TRACKING_PAGE_PATH = "./acompanhar.html";
const CUSTOMER_TRACKING_BASE_STATUSES = Object.freeze([
  "Recebido",
  "Aceito",
  "Em preparo",
  "Pronto",
]);
const LEGACY_FINALIZED_STATUS = "Finalizado";
const PICKUP_ESTIMATE_MINUTES = 25;
const DELIVERY_PREPARATION_TIME_MINUTES = PICKUP_ESTIMATE_MINUTES;
const DELIVERY_ROUTE_STRETCH_FACTOR = 1.22;
const DELIVERY_AVERAGE_SPEED_KMH = 22;
const DELIVERY_MIN_TRAVEL_TIME_MINUTES = 10;
const CART_PAYMENT_METHODS = Object.freeze([
  { id: "dinheiro", label: "Dinheiro" },
  { id: "credito", label: "Credito" },
  { id: "debito", label: "Debito" },
  { id: "pix", label: "Pix" },
]);
const CART_FULFILLMENT_OPTIONS = Object.freeze([
  { id: "delivery", label: "Entrega" },
  { id: "pickup", label: "Retirada" },
]);
const CART_REQUIRED_ADDONS = Object.freeze([
  {
    id: "hashi",
    name: "Hashi",
    unitPrice: 1,
    freeUnits: 1,
    defaultQuantity: 1,
  },
  {
    id: "adaptador",
    name: "Adaptador",
    unitPrice: 0.2,
    freeUnits: 0,
    defaultQuantity: 0,
  },
  {
    id: "shoyu",
    name: "Shoyu",
    unitPrice: 4,
    freeUnits: 1,
    defaultQuantity: 1,
  },
  {
    id: "tare",
    name: "Tare",
    unitPrice: 6,
    freeUnits: 0,
    defaultQuantity: 0,
  },
]);
const DELIVERY_STORE_ADDRESS =
  TOKYO_APP_BRANDING.defaultAddress?.full ||
  "Rua General Osório, 2165, Franca - SP, 14400-520, Brasil";
const DELIVERY_STORE_LABEL =
  TOKYO_APP_BRANDING.defaultAddress?.label || "R. General Osório, 2165 - CEP 14400-520";
const DELIVERY_STORE_COORDINATES = {
  lat: -20.536416983482,
  lng: -47.393922026918,
};
const normalizeStatusKey = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const resolveCanonicalOrderStatus = (status, fulfillmentMode = "") => {
  const normalizedStatus = normalizeStatusKey(status);
  const normalizedFulfillmentMode = String(fulfillmentMode || "").trim().toLowerCase();

  if (!normalizedStatus) {
    return "";
  }

  if (normalizedStatus === "novo" || normalizedStatus === "recebido") {
    return "Recebido";
  }

  if (normalizedStatus === "confirmado" || normalizedStatus === "aceito") {
    return "Aceito";
  }

  if (normalizedStatus === "em preparo") {
    return "Em preparo";
  }

  if (normalizedStatus === "pronto") {
    return "Pronto";
  }

  if (normalizedStatus === "saiu para entrega") {
    return "Saiu para entrega";
  }

  if (normalizedStatus === normalizeStatusKey(LEGACY_FINALIZED_STATUS)) {
    return normalizedFulfillmentMode === "pickup" ? "Retirada concluida" : "Entregue";
  }

  if (normalizedStatus === "entregue") {
    return "Entregue";
  }

  if (normalizedStatus === "retirada concluida") {
    return "Retirada concluida";
  }

  if (normalizedStatus === "cancelado") {
    return "Cancelado";
  }

  return "";
};

const getTrackingProgressStatuses = (order) =>
  order?.fulfillmentMode === "pickup"
    ? [...CUSTOMER_TRACKING_BASE_STATUSES, "Retirada concluida"]
    : [...CUSTOMER_TRACKING_BASE_STATUSES, "Saiu para entrega", "Entregue"];

const normalizeTrackingOrder = (order) => {
  if (!order || typeof order !== "object") {
    return order;
  }

  const fulfillmentMode = String(order.fulfillmentMode || "").trim().toLowerCase();

  return {
    ...order,
    fulfillmentMode,
    status: resolveCanonicalOrderStatus(order.status, fulfillmentMode) || String(order.status || "").trim(),
    statusHistory: Array.isArray(order.statusHistory)
      ? order.statusHistory.map((entry) => ({
          ...entry,
          status: resolveCanonicalOrderStatus(entry?.status, fulfillmentMode) || String(entry?.status || "").trim(),
        }))
      : order.statusHistory,
  };
};
const DELIVERY_SERVICE_CITY_STATE = TOKYO_APP_BRANDING.defaultAddress?.cityState || "Franca - SP";
const GOOGLE_MAPS_LANGUAGE = "pt-BR";
const GOOGLE_MAPS_REGION = "br";
const GOOGLE_MAPS_API_KEY_STORAGE_KEY =
  TOKYO_STORAGE_KEYS.googleMapsApiKey || "tokyo_google_maps_api_key";
const GOOGLE_MAPS_LOADER_TIMEOUT_MS = 12000;
const GOOGLE_MAPS_REQUEST_TIMEOUT_MS = 10000;
const DELIVERY_CEP_LOOKUP_TIMEOUT_MS = 8000;
const DELIVERY_FEE_RULES = [
  {
    maxDistanceKm: 1.9,
    fee: 9,
    bandLabel: "Ate 1,9 km",
    description: "R$ 9,00 para entregas de ate 1,9 km.",
  },
  {
    maxDistanceKm: 6.9,
    fee: 10,
    bandLabel: "Ate 6,9 km",
    description: "R$ 10,00 para entregas de ate 6,9 km.",
  },
  {
    maxDistanceKm: 10.9,
    fee: 12,
    bandLabel: "Ate 10,9 km",
    description: "R$ 12,00 para entregas de ate 10,9 km.",
  },
  {
    maxDistanceKm: 14.9,
    fee: 15,
    bandLabel: "Ate 14,9 km",
    description: "R$ 15,00 para entregas de ate 14,9 km.",
  },
];
const DELIVERY_SETTINGS_DEFAULTS = Object.freeze({
  distanceBands: DELIVERY_FEE_RULES.map((rule, index, rules) => ({
    id: `legacy-band-${index + 1}`,
    minKm: index === 0 ? 0 : rules[index - 1].maxDistanceKm,
    maxKm: rule.maxDistanceKm,
    label: rule.bandLabel,
    customerFee: rule.fee,
    courierFee: 0,
    minimumOrder: 0,
    isActive: true,
  })),
  deliveryTime: {
    minMinutes: 40,
    maxMinutes: 60,
    message: "Entrega estimada entre 40 e 60 minutos",
  },
  serviceArea: {
    maxRadiusKm: 14.9,
    servedNeighborhoods: [],
    blockedNeighborhoods: [],
    outOfAreaMessage: "No momento nao entregamos nessa regiao.",
  },
  freeShipping: {
    enabled: false,
    minimumOrder: 120,
    appliesToAllBands: true,
    bandIds: [],
  },
  pickup: {
    enabled: true,
    estimateMinutes: PICKUP_ESTIMATE_MINUTES,
    message: "Retirada disponivel em 25 minutos",
  },
  status: {
    deliveriesEnabled: true,
    pausedMessage: "Entregas pausadas temporariamente. Retirada no balcao disponivel.",
  },
  updatedAt: "",
});
const BUSINESS_SCHEDULE_DAY_KEYS = Object.freeze([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);
const BUSINESS_SCHEDULE_DAY_LABELS = Object.freeze({
  monday: "Segunda",
  tuesday: "Terca",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sabado",
  sunday: "Domingo",
});
const BUSINESS_SCHEDULE_DAY_SHORT_LABELS = Object.freeze({
  monday: "Seg",
  tuesday: "Ter",
  wednesday: "Qua",
  thursday: "Qui",
  friday: "Sex",
  saturday: "Sab",
  sunday: "Dom",
});
const createDefaultBusinessScheduleDays = () =>
  BUSINESS_SCHEDULE_DAY_KEYS.reduce((days, dayKey) => {
    days[dayKey] = {
      isOpen: true,
      openTime: "18:00",
      closeTime: "23:00",
      pauseStart: "",
      pauseEnd: "",
    };

    return days;
  }, {});
const RESTAURANT_SETTINGS_DEFAULTS = Object.freeze({
  restaurantKey: "default",
  restaurantName: TOKYO_RESTAURANT_BRAND.name || "Tokyo Sushi Delivery",
  logoUrl:
    TOKYO_RESTAURANT_BRAND.logo ||
    TOKYO_ASSETS.publicLogo ||
    "./site-images/tokyo-logo-premium-transparent.png",
  bannerUrl:
    TOKYO_RESTAURANT_BRAND.banner ||
    TOKYO_ASSETS.publicBanner ||
    "./site-images/combinado-imperial.png",
  primaryColor: TOKYO_RESTAURANT_BRAND.primaryColor || "#e83637",
  secondaryColor: TOKYO_RESTAURANT_BRAND.secondaryColor || "#f5c3d3",
  accentColor: TOKYO_SITE_APPEARANCE.colors?.accent || "#f2b649",
  gradientStart:
    TOKYO_SITE_APPEARANCE.colors?.gradientStart ||
    TOKYO_RESTAURANT_BRAND.primaryColor ||
    "#e83637",
  gradientEnd: TOKYO_SITE_APPEARANCE.colors?.gradientEnd || "#2b1214",
  useGradient: TOKYO_SITE_APPEARANCE.colors?.useGradient !== false,
  siteLayout: TOKYO_SITE_APPEARANCE.layout || "MODERN",
  siteTheme: TOKYO_SITE_APPEARANCE.theme || "DARK",
  slogan:
    TOKYO_SITE_APPEARANCE.identity?.slogan ||
    TOKYO_RESTAURANT_BRAND.slogan ||
    TOKYO_APP_BRANDING.brandTagline ||
    "Delivery Premium",
  description:
    TOKYO_SITE_APPEARANCE.identity?.description ||
    TOKYO_RESTAURANT_BRAND.description ||
    "Cada detalhe e pensado para transformar seu pedido em uma experiencia unica.",
  instagram: TOKYO_SITE_APPEARANCE.social?.instagram || "",
  facebook: TOKYO_SITE_APPEARANCE.social?.facebook || "",
  tiktok: TOKYO_SITE_APPEARANCE.social?.tiktok || "",
  site: TOKYO_SITE_APPEARANCE.social?.site || TOKYO_APP_BRANDING.companyWebsite || "",
  seoTitle: TOKYO_SITE_APPEARANCE.seo?.title || TOKYO_RESTAURANT_BRAND.name || "Tokyo Sushi Delivery",
  seoDescription:
    TOKYO_SITE_APPEARANCE.seo?.description ||
    "Tokyo Sushi Delivery com experiencia premium, cardapio sofisticado e pedidos direto pelo site.",
  seoShareImage:
    TOKYO_SITE_APPEARANCE.seo?.shareImage ||
    TOKYO_ASSETS.socialImage ||
    "/site-images/combinado-imperial.png",
  seoKeywords: Array.isArray(TOKYO_SITE_APPEARANCE.seo?.keywords)
    ? TOKYO_SITE_APPEARANCE.seo.keywords
    : ["Tokyo Sushi", "sushi delivery", "delivery japones"],
  seoOpenGraph: {
    title: TOKYO_SITE_APPEARANCE.seo?.openGraph?.title || TOKYO_SITE_APPEARANCE.seo?.title || "",
    description:
      TOKYO_SITE_APPEARANCE.seo?.openGraph?.description ||
      TOKYO_SITE_APPEARANCE.seo?.description ||
      "",
    image:
      TOKYO_SITE_APPEARANCE.seo?.openGraph?.image ||
      TOKYO_SITE_APPEARANCE.seo?.shareImage ||
      TOKYO_ASSETS.socialImage ||
      "/site-images/combinado-imperial.png",
    type: TOKYO_SITE_APPEARANCE.seo?.openGraph?.type || "website",
  },
  platformFooter: {
    showPlatformBranding: TOKYO_SITE_APPEARANCE.platformFooter?.showPlatformBranding !== false,
    brandName: TOKYO_SITE_APPEARANCE.platformFooter?.brandName || "INOVAS Food",
    logo: TOKYO_SITE_APPEARANCE.platformFooter?.logo || "./assets/inovas-food-logo-oficial.png",
    headline: TOKYO_SITE_APPEARANCE.platformFooter?.headline || "Desenvolvido por INOVAS Food",
    description:
      TOKYO_SITE_APPEARANCE.platformFooter?.description ||
      "Plataforma profissional para restaurantes",
    url: TOKYO_SITE_APPEARANCE.platformFooter?.url || "https://www.inovasfood.com.br",
    displayUrl: TOKYO_SITE_APPEARANCE.platformFooter?.displayUrl || "www.inovasfood.com.br",
  },
  whatsapp: FALLBACK_WHATSAPP_NUMBER,
  address: DELIVERY_STORE_ADDRESS,
  addressFields: {
    postalCode: TOKYO_APP_BRANDING.defaultAddress?.postalCode || "14400-520",
    street: TOKYO_APP_BRANDING.defaultAddress?.street || "Rua General Osorio",
    number: TOKYO_APP_BRANDING.defaultAddress?.number || "2165",
    complement: TOKYO_APP_BRANDING.defaultAddress?.complement || "",
    neighborhood: TOKYO_APP_BRANDING.defaultAddress?.neighborhood || "",
    city: TOKYO_APP_BRANDING.defaultAddress?.city || "Franca",
    state: TOKYO_APP_BRANDING.defaultAddress?.state || "SP",
  },
  deliveryBase: {
    latitude: null,
    longitude: null,
    maxDeliveryRadiusKm: 14.9,
    fixedDeliveryFee: DELIVERY_FEE_RULES[0]?.fee || 9,
    pricePerKm: 1,
    minimumDeliveryOrder: 0,
    pickupEnabled: true,
    deliveryEnabled: true,
  },
  businessHours: "18:00 as 23:00",
  businessSchedule: {
    timeZone: "America/Sao_Paulo",
    acceptOrdersOutsideHours: false,
    closedMessage:
      "Estamos fechados agora. Voce pode agendar seu pedido para o proximo horario de atendimento.",
    peakPreparationExtraMinutes: 0,
    specialDates: [],
    days: createDefaultBusinessScheduleDays(),
  },
  hasStructuredBusinessSchedule: true,
  defaultDeliveryFee: DELIVERY_FEE_RULES[0]?.fee || 9,
  averagePreparationTimeMinutes: PICKUP_ESTIMATE_MINUTES,
  presentationText:
    "Cada detalhe e pensado para transformar seu pedido em uma experiencia unica.",
  updatedAt: "",
});
const DELIVERY_MANUAL_FALLBACK_FEE = DELIVERY_FEE_RULES[0]?.fee || 9;
const DELIVERY_MANUAL_ROUTE_BAND = "Taxa provisoria";
const DELIVERY_MANUAL_TIME_TEXT = "Confirmar com a loja";
const BUSINESS_HOURS_API = window[TOKYO_GLOBAL_NAMES.businessHoursApi || "TokyoBusinessHours"];
const STORE_HOURS_API = window[TOKYO_GLOBAL_NAMES.storeHoursApi || "TokyoStoreHours"];
const STORE_STATUS_REFRESH_INTERVAL_MS = 60000;
const CART_ORDER_TIMING_OPTIONS = Object.freeze([
  { id: "immediate", label: "Pedido imediato" },
  { id: "scheduled", label: "Agendar pedido" },
]);
const siteHeader = document.querySelector(".site-header");
const catalogRoot = document.querySelector("[data-catalog-root]");
const MOBILE_NAV_BREAKPOINT = 860;
const MOBILE_CATALOG_BREAKPOINT = 860;
const authState = {
  view: "entry",
  socialProvider: null,
  socialStatus: "idle",
  socialTimer: 0,
  phoneCodeStatus: "idle",
  editing: false,
  error: "",
  message: "",
  draft: {},
  pendingHref: "",
  pendingIntent: "",
  phoneVerification: null,
};
const customerTrackingState = {
  loading: false,
  loaded: false,
  authenticated: false,
  activeOrder: null,
};
const reviewPageState = {
  loading: false,
  loaded: false,
  error: "",
  rotationIndex: 0,
  rotationIntervalId: 0,
  summary: {
    displayAverage: 0,
    displayAverageLabel: "Sem avaliacoes",
    publicReviewCount: 0,
    publicCountLabel: "0 avaliacoes publicadas",
    recentCountLabel: "Baseado em 0 avaliacoes recentes",
  },
  reviews: [],
};
const deliverySettingsState = {
  loading: false,
  loaded: false,
  error: "",
  summary: null,
  settings: null,
};
const restaurantSettingsState = {
  loading: false,
  loaded: false,
  error: "",
  summary: null,
  settings: null,
};
const cartUiState = {
  checkoutExpanded: false,
  orderNotice: null,
  orderSubmitting: false,
};
const SITE_IMAGES_DIRECTORY = "./site-images";
const LEGACY_SITE_IMAGE_PATH_PREFIXES = ["./assets/", "./menu_pdf_images/"];
const LEGACY_SITE_IMAGE_FIELD_NAMES = new Set(["image", "src"]);
const getSiteImagePath = (path) => {
  if (
    typeof path !== "string" ||
    !LEGACY_SITE_IMAGE_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))
  ) {
    return path;
  }

  const fileName = path.split("/").pop();
  return fileName ? `${SITE_IMAGES_DIRECTORY}/${fileName}` : path;
};
const normalizeImageFields = (value) => {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => normalizeImageFields(entry));
    return;
  }

  Object.entries(value).forEach(([key, fieldValue]) => {
    if (LEGACY_SITE_IMAGE_FIELD_NAMES.has(key)) {
      value[key] = getSiteImagePath(fieldValue);
      return;
    }

    normalizeImageFields(fieldValue);
  });
};
const TEMAKI_PREMIUM_FINAL_PRICE = 49.9;
const TEMAKI_CAMARAO_PREMIUM_FINAL_PRICE = 54.9;
const TEMAKI_IMAGE_PATHS = Object.freeze({
  salmao: "./menu_pdf_images/catalog/temaki-salmao.png",
  grelhado: "./menu_pdf_images/catalog/temaki-grelhado.png",
  hot: "./menu_pdf_images/catalog/temaki-hot.png",
  camarao: "./menu_pdf_images/catalog/temaki-camarao.png",
});
const TEPPAN_IMAGE_PATHS = Object.freeze({
  base: "./menu_pdf_images/catalog/teppan.png",
  camarao: "./menu_pdf_images/catalog/teppan-camarao.png",
  completo: "./menu_pdf_images/catalog/teppan-completo.png",
});
const SUSHI_PORTION_IMAGE_PATHS = Object.freeze({
  hot: "./menu_pdf_images/catalog/combinado-kumo.png",
  joe: "./menu_pdf_images/catalog/combinado-tenno.png",
  uramaki: "./menu_pdf_images/catalog/combinado-ryuu.png",
  nigiri: "./menu_pdf_images/catalog/combinado-sakura.png",
  camarao: "./menu_pdf_images/catalog/combinado-sora.png",
});

const MENU_COMBINADOS_CATEGORY_IMAGES = Object.freeze({
  "Categoria Sakura": {
    src: "./menu_pdf_images/page_08.jpg",
    alt: "Imagem temática da categoria Sakura",
  },
  "Categoria Oceano": {
    src: "./menu_pdf_images/page_09.jpg",
    alt: "Imagem temática da categoria Oceano",
  },
  "Categoria Samurai": {
    src: "./menu_pdf_images/combinado-imperial.png",
    alt: "Imagem temática da categoria Samurai",
  },
  "Categoria Família": {
    src: "./menu_pdf_images/page_11.jpg",
    alt: "Imagem temática da categoria Família",
  },
});

let selectedCombinadosCategoryId = null;
let selectedCombinadosComboId = null;

const getCombinadosCategories = (section) => {
  const categories = new Map();

  section.items.forEach((item) => {
    const category = item.category || "Categoria";
    if (!categories.has(category)) {
      const categoryImage = MENU_COMBINADOS_CATEGORY_IMAGES[category] || {
        src: item.image,
        alt: `Imagem temática da categoria ${category}`,
      };

      categories.set(category, {
        id: category,
        title: category.replace(/^Categoria\s*/i, "").trim() || category,
        label: category,
        image: categoryImage.src,
        alt: categoryImage.alt,
        items: [],
      });
    }

    categories.get(category).items.push(item);
  });

  return [...categories.values()];
};

const MENU_SECTIONS = [
  {
    id: "entradas-frias",
    kicker: "Entradas frias",
    title: "Carpaccios, ceviches e tartares",
    description:
      "Entradas leves e frescas para abrir o pedido.",
    items: [
      {
        id: "carpaccio-salmao",
        name: "Carpaccio de Salmao",
        category: "Carpaccio",
        description: "Laminas finas de salmao com gengibre, cebolinha, tare e limao.",
        image: "./menu_pdf_images/catalog/carpaccio-salmao-premium.jpg",
        badge: "Consulte",
      },
      {
        id: "carpaccio-especial",
        name: "Carpaccio Especial",
        category: "Carpaccio",
        description: "Salmao com rucula fresca, molho de mostarda, tare e limao.",
        image: "./menu_pdf_images/catalog/carpaccio-especial-premium.jpg",
        badge: "Consulte",
      },
      {
        id: "carpaccio-chef",
        name: "Carpaccio Chef",
        category: "Carpaccio",
        description: "Salmao com pimenta biquinho, alho-poro, molho tare e limao.",
        image: "./menu_pdf_images/catalog/carpaccio-chef-premium.jpg",
        badge: "Consulte",
      },
      {
        id: "carpaccio-saint-peter",
        name: "Carpaccio Saint Peter",
        category: "Carpaccio",
        description: "Tilapia com cebola roxa, cebolinha, molho tare e limao.",
        image: "./menu_pdf_images/catalog/carpaccio-saint-peter-premium.jpg",
        badge: "Consulte",
      },
      {
        id: "ceviche-salmao",
        name: "Ceviche Salmao",
        category: "Ceviche",
        description: "Cubos de salmao fresco marinados com molho citrico.",
        image: "./menu_pdf_images/catalog/ceviche-salmao-premium.jpg",
        badge: "Consulte",
      },
      {
        id: "ceviche-saint-peter",
        name: "Ceviche Saint Peter",
        category: "Ceviche",
        description: "Cubos de tilapia marinados com molho citrico.",
        image: "./menu_pdf_images/catalog/ceviche-saint-peter-premium.jpg",
        badge: "Consulte",
      },
      {
        id: "ceviche-misto",
        name: "Ceviche Misto",
        category: "Ceviche",
        description: "Salmao, tilapia e camarao marinados com molho citrico.",
        image: "./menu_pdf_images/catalog/ceviche-misto-premium.jpg",
        badge: "Mais pedido",
      },
      {
        id: "ceviche-camarao",
        name: "Ceviche Camarao",
        category: "Ceviche",
        description: "Camaroes grelhados marinados com molho citrico.",
        image: "./menu_pdf_images/catalog/ceviche-camarao-premium.jpg",
        badge: "Consulte",
      },
      {
        id: "tartar-salmao",
        name: "Tartar Salmao",
        category: "Tartar",
        description: "Tartar com cebolinha, tare, limao, cream cheese e amendoas.",
        image: "./menu_pdf_images/catalog/tartar-salmao-premium.jpg",
        badge: "Consulte",
      },
      {
        id: "tartar-saint-peter",
        name: "Tartar Saint Peter",
        category: "Tartar",
        description: "Proteina de tilapia com toque cremoso e fresco.",
        image: "./menu_pdf_images/catalog/tartar-saint-peter-premium.jpg",
        badge: "Consulte",
      },
      {
        id: "tartar-camarao",
        name: "Tartar Camarao",
        category: "Tartar",
        description: "Proteina de camarao com finalizacao da casa.",
        image: "./menu_pdf_images/catalog/tartar-camarao-premium.jpg",
        badge: "Consulte",
      },
      {
        id: "tartar-misto",
        name: "Salm\u00e3o e Camar\u00e3o",
        category: "Tartar",
        description: "Combinacao de salmao com camarao e toppings laminados.",
        image: "./menu_pdf_images/catalog/tartar-misto-premium.jpg",
        badge: "Consulte",
      },
      {
        id: "sunomono",
        name: "Sunomono",
        category: "Sunomono",
        detail: "Pepino japones",
        description: "Sunomono com molho especial agridoce.",
        image: "./menu_pdf_images/catalog/sunomono-premium.jpg",
        badge: "Consulte",
      },
      {
        id: "sunomono-especial",
        name: "Sunomono Especial",
        category: "Sunomono",
        detail: "Pepino japones com kani-kama",
        description: "Sunomono com molho agridoce e kani-kama.",
        image: "./menu_pdf_images/catalog/sunomono-especial-premium.jpg",
        badge: "Consulte",
      },
    ],
  },
  {
    id: "porcoes-sushis",
    kicker: "Por\u00e7\u00f5es de sushis",
    title: "Hot holls, joes e sushis da casa",
    description:
      "Por\u00e7\u00f5es para pedir por linha e montar a sele\u00e7\u00e3o do seu jeito.",
    items: [
      {
        id: "hot-roll-8",
        name: "Hot Holl",
        category: "HOT HOLLS (8 unidades)",
        detail: "8 unidades",
        description: "Porcao com 8 unidades de hot holl.",
        image: SUSHI_PORTION_IMAGE_PATHS.hot,
        badge: "Consulte",
        price: 19.99,
      },
      {
        id: "hot-couve-8",
        name: "Hot Couve",
        category: "HOT HOLLS (8 unidades)",
        detail: "8 unidades",
        description: "Porcao com 8 unidades de hot couve.",
        image: SUSHI_PORTION_IMAGE_PATHS.hot,
        badge: "Consulte",
        price: 19.99,
      },
      {
        id: "hot-temperado-8",
        name: "Hot Temperado",
        category: "HOT HOLLS (8 unidades)",
        detail: "8 unidades",
        description: "Porcao com 8 unidades de hot temperado.",
        image: SUSHI_PORTION_IMAGE_PATHS.hot,
        badge: "Consulte",
        price: 22.99,
      },
      {
        id: "hot-poro-8",
        name: "Hot Por\u00f3",
        category: "HOT HOLLS (8 unidades)",
        detail: "8 unidades",
        description: "Porcao com 8 unidades de hot poro.",
        image: SUSHI_PORTION_IMAGE_PATHS.hot,
        badge: "Consulte",
        price: 21.99,
      },
      {
        id: "joe-cream-cheese-6",
        name: "Joe Cream Cheese",
        category: "JOES (6 unidades)",
        detail: "6 unidades",
        description: "Porcao com 6 unidades de joe cream cheese.",
        image: SUSHI_PORTION_IMAGE_PATHS.joe,
        badge: "Consulte",
        price: 18.99,
      },
      {
        id: "joe-salmao-6",
        name: "Joe Salm\u00e3o",
        category: "JOES (6 unidades)",
        detail: "6 unidades",
        description: "Porcao com 6 unidades de joe salmao.",
        image: SUSHI_PORTION_IMAGE_PATHS.joe,
        badge: "Consulte",
        price: 20.99,
      },
      {
        id: "joe-poro-6",
        name: "Joe Por\u00f3",
        category: "JOES (6 unidades)",
        detail: "6 unidades",
        description: "Porcao com 6 unidades de joe poro.",
        image: SUSHI_PORTION_IMAGE_PATHS.joe,
        badge: "Consulte",
        price: 19.99,
      },
      {
        id: "joe-mostarda-6",
        name: "Joe Mostarda",
        category: "JOES (6 unidades)",
        detail: "6 unidades",
        description: "Porcao com 6 unidades de joe mostarda.",
        image: SUSHI_PORTION_IMAGE_PATHS.joe,
        badge: "Consulte",
        price: 20.99,
      },
      {
        id: "joe-rucula-6",
        name: "Joe R\u00facula",
        category: "JOES (6 unidades)",
        detail: "6 unidades",
        description: "Porcao com 6 unidades de joe rucula.",
        image: SUSHI_PORTION_IMAGE_PATHS.joe,
        badge: "Consulte",
        price: 20.99,
      },
      {
        id: "joe-tartar-6",
        name: "Joe Tartar",
        category: "JOES (6 unidades)",
        detail: "6 unidades",
        description: "Porcao com 6 unidades de joe tartar.",
        image: SUSHI_PORTION_IMAGE_PATHS.joe,
        badge: "Consulte",
        price: 21.99,
      },
      {
        id: "joe-geleia-6",
        name: "Joe Geleia",
        category: "JOES (6 unidades)",
        detail: "6 unidades",
        description: "Porcao com 6 unidades de joe geleia.",
        image: SUSHI_PORTION_IMAGE_PATHS.joe,
        badge: "Consulte",
        price: 21.99,
      },
      {
        id: "joe-flambado-6",
        name: "Joe Flambado",
        category: "JOES (6 unidades)",
        detail: "6 unidades",
        description: "Porcao com 6 unidades de joe flambado.",
        image: SUSHI_PORTION_IMAGE_PATHS.joe,
        badge: "Consulte",
        price: 22.99,
      },
      {
        id: "uramaki-skin-8",
        name: "Uramaki Skin",
        category: "URAMAKI E HOSSOMAKI (8 unidades)",
        detail: "8 unidades",
        description: "Porcao com 8 unidades de uramaki skin.",
        image: SUSHI_PORTION_IMAGE_PATHS.uramaki,
        badge: "Consulte",
        price: 19.99,
      },
      {
        id: "uramaki-salmao-8",
        name: "Uramaki Salm\u00e3o",
        category: "URAMAKI E HOSSOMAKI (8 unidades)",
        detail: "8 unidades",
        description: "Porcao com 8 unidades de uramaki salmao.",
        image: SUSHI_PORTION_IMAGE_PATHS.uramaki,
        badge: "Consulte",
        price: 22.99,
      },
      {
        id: "hossomaki-salmao-8",
        name: "Hossomaki Salm\u00e3o",
        category: "URAMAKI E HOSSOMAKI (8 unidades)",
        detail: "8 unidades",
        description: "Porcao com 8 unidades de hossomaki salmao.",
        image: SUSHI_PORTION_IMAGE_PATHS.uramaki,
        badge: "Consulte",
        price: 21.99,
      },
      {
        id: "nigiri-salmao-6",
        name: "Nigiri Salm\u00e3o",
        category: "NIGIRI (6 unidades)",
        detail: "6 unidades",
        description: "Porcao com 6 unidades de nigiri salmao.",
        image: SUSHI_PORTION_IMAGE_PATHS.nigiri,
        badge: "Consulte",
        price: 22.99,
      },
      {
        id: "nigiri-skin-6",
        name: "Nigiri Skin",
        category: "NIGIRI (6 unidades)",
        detail: "6 unidades",
        description: "Porcao com 6 unidades de nigiri skin.",
        image: SUSHI_PORTION_IMAGE_PATHS.nigiri,
        badge: "Consulte",
        price: 18.99,
      },
      {
        id: "hot-camarao-6",
        name: "Hot Camar\u00e3o",
        category: "CAMAR\u00d5ES (6 unidades)",
        detail: "6 unidades",
        description: "Porcao com 6 unidades de hot camarao.",
        image: SUSHI_PORTION_IMAGE_PATHS.camarao,
        badge: "Consulte",
        price: 26.99,
      },
      {
        id: "joe-eby-camarao-6",
        name: "Joe Eby",
        category: "CAMAR\u00d5ES (6 unidades)",
        detail: "6 unidades",
        description: "Porcao com 6 unidades de joe eby.",
        image: SUSHI_PORTION_IMAGE_PATHS.camarao,
        badge: "Consulte",
        price: 27.99,
      },
      {
        id: "joe-camarao-especial-6",
        name: "Joe Camar\u00e3o Especial",
        category: "CAMAR\u00d5ES (6 unidades)",
        detail: "6 unidades",
        description: "Porcao com 6 unidades de joe camarao especial.",
        image: SUSHI_PORTION_IMAGE_PATHS.camarao,
        badge: "Consulte",
        price: 28.99,
      },
      {
        id: "eby-especial-6",
        name: "Eby Especial",
        category: "CAMAR\u00d5ES (6 unidades)",
        detail: "6 unidades",
        description: "Porcao com 6 unidades de eby especial.",
        image: SUSHI_PORTION_IMAGE_PATHS.camarao,
        badge: "Consulte",
        price: 29.99,
      },
      {
        id: "camarao-recheado-6",
        name: "Camar\u00e3o Recheado",
        category: "CAMAR\u00d5ES (6 unidades)",
        detail: "6 unidades",
        description: "Porcao com 6 unidades de camarao recheado.",
        image: SUSHI_PORTION_IMAGE_PATHS.camarao,
        badge: "Consulte",
        price: 31.99,
      },
      {
        id: "fusion-camarao-6",
        name: "Fusion",
        category: "CAMAR\u00d5ES (6 unidades)",
        detail: "6 unidades",
        description: "Porcao com 6 unidades de fusion.",
        image: SUSHI_PORTION_IMAGE_PATHS.camarao,
        badge: "Consulte",
        price: 29.99,
      },
      {
        id: "hakusai-camarao-6",
        name: "Hakusai Camar\u00e3o",
        category: "CAMAR\u00d5ES (6 unidades)",
        detail: "6 unidades",
        description: "Porcao com 6 unidades de hakusai camarao.",
        image: SUSHI_PORTION_IMAGE_PATHS.camarao,
        badge: "Consulte",
        price: 28.99,
      },
    ],
  },
  {
    id: "entradas-quentes",
    kicker: "Entradas quentes",
    title: "Guiozas, cogumelos e petiscos",
    description:
      "Opcoes quentes e crocantes para acompanhar o pedido.",
    items: [
      {
        id: "guioza-legumes",
        name: "Guioza Legumes",
        category: "Guioza",
        description: "Guioza dourado com recheio de legumes.",
        image: "./menu_pdf_images/catalog/guioza-premium.jpg",
        badge: "Consulte",
      },
      {
        id: "guioza-suina",
        name: "Guioza Suina",
        category: "Guioza",
        description: "Guioza com recheio suino e acabamento crocante.",
        image: "./menu_pdf_images/catalog/guioza-premium.jpg",
        badge: "Consulte",
      },
      {
        id: "shimeji",
        name: "Shimeji",
        category: "Cogumelos",
        description: "Shimeji salteado com acompanhamento de arroz.",
        image: "./menu_pdf_images/catalog/cogumelos.jpg",
        badge: "Consulte",
      },
      {
        id: "shiitake",
        name: "Shiitake",
        category: "Cogumelos",
        description: "Shiitake salteado com acompanhamento de arroz.",
        image: "./menu_pdf_images/catalog/cogumelos.jpg",
        badge: "Consulte",
      },
      {
        id: "bolinho-salmao",
        name: "Bolinho Salmao",
        category: "Bolinhos",
        description: "Porcao quente e crocante de bolinhos de salmao.",
        image: "./menu_pdf_images/catalog/bolinhos-premium.jpg",
        badge: "Consulte",
      },
      {
        id: "bolinho-salmao-camarao",
        name: "Bolinho Salmao com Camarao",
        category: "Bolinhos",
        description: "Bolinho com salmao e camarao para dividir.",
        image: "./menu_pdf_images/catalog/bolinhos-premium.jpg",
        badge: "Consulte",
      },
      {
        id: "isca-salmao",
        name: "Isca Salmao",
        category: "Iscas",
        description: "Iscas quentes de salmao com textura crocante.",
        image: "./menu_pdf_images/catalog/iscas.jpg",
        badge: "Consulte",
      },
      {
        id: "isca-saint-peter",
        name: "Isca Saint Peter",
        category: "Iscas",
        description: "Iscas de saint peter para complementar o pedido.",
        image: "./menu_pdf_images/catalog/iscas.jpg",
        badge: "Consulte",
      },
    ],
  },
  {
    id: "pratos-quentes",
    kicker: "Pratos quentes",
    title: "Yakissoba, teppan e pratos da casa",
    description:
      "Pratos completos para quem quer uma refeicao mais robusta.",
    items: [
      {
        id: "yakissoba-legumes",
        name: "Yakissoba Legumes",
        category: "Yakissoba",
        description: "Macarrao com legumes e molho especial da casa.",
        image: "./menu_pdf_images/catalog/yakissoba.jpg",
        badge: "Consulte",
      },
      {
        id: "yakissoba-frango",
        name: "Yakissoba Frango",
        category: "Yakissoba",
        description: "Yakissoba com frango, legumes e molho especial.",
        image: "./menu_pdf_images/catalog/yakissoba.jpg",
        badge: "Consulte",
      },
      {
        id: "yakissoba-file-mignon",
        name: "Yakissoba Bovino",
        category: "Yakissoba",
        description: "Yakissoba com file mignon e legumes selecionados.",
        image: "./menu_pdf_images/catalog/yakissoba.jpg",
        badge: "Consulte",
      },
      {
        id: "yakissoba-camarao",
        name: "Yakissoba Camarao",
        category: "Yakissoba",
        description: "Yakissoba com camarao e vegetais salteados.",
        image: "./menu_pdf_images/catalog/yakissoba.jpg",
        badge: "Consulte",
      },
      {
        id: "yakissoba-misto",
        name: "Yakissoba Misto",
        category: "Yakissoba",
        description: "Versao mista com proteinas e molho especial.",
        image: "./menu_pdf_images/catalog/yakissoba.jpg",
        badge: "Consulte",
      },
      {
        id: "teppan-salmao",
        name: "Teppan Salmao",
        category: "Teppan",
        description: "Salmao grelhado com cenoura, brocolis e arroz.",
        image: TEPPAN_IMAGE_PATHS.base,
        badge: "Consulte",
      },
      {
        id: "teppan-saint-peter",
        name: "Teppan Saint Peter",
        category: "Teppan",
        description: "Tilapia grelhada com legumes e arroz.",
        image: TEPPAN_IMAGE_PATHS.base,
        price: 72,
        badge: "Consulte",
      },
      {
        id: "teppan-camarao",
        name: "Teppan Camarao",
        category: "Teppan",
        description: "Camarao grelhado com brocolis, cenoura e arroz.",
        image: TEPPAN_IMAGE_PATHS.camarao,
        badge: "Consulte",
      },
      {
        id: "teppan-misto",
        name: "Teppan Completo",
        category: "Teppan",
        description: "Salmao, camarao e shimeji com arroz e legumes.",
        image: TEPPAN_IMAGE_PATHS.completo,
        price: 85,
        badge: "Consulte",
      },
      {
        id: "frango-xadrez",
        name: "Frango Xadrez",
        category: "Frango Xadrez",
        description: "Frango com pimentoes, couve-flor, amendoas e arroz.",
        image: "./menu_pdf_images/catalog/frango-xadrez.jpg",
        price: 34.9,
        badge: "Consulte",
      },
      {
        id: "tonkatsu",
        name: "Tonkatsu",
        category: "Tonkatsu",
        description: "Carne de porco empanada com acelga, arroz e molho agridoce.",
        image: "./menu_pdf_images/catalog/tonkatsu.jpg",
        price: 30,
        badge: "Consulte",
      },
    ],
  },
  {
    id: "combinados",
    kicker: "Combinados",
    title: "Combos",
    description:
      "Combinados para pedir sozinho, dividir ou variar sabores.",
    items: [
      {
        id: "sakura-20",
        name: "Combinado Sakura",
        category: "Categoria Sakura",
        detail: "20 peças",
        description:
          "6x Nigiri Skin, 6x Joe Cream Cheese e 8x Uramaki Skin.",
        image: "./menu_pdf_images/catalog/combinado-sakura.png",
        price: 44.99,
        badge: "Consulte",
      },
      {
        id: "yume-24",
        name: "Combo Yume",
        category: "Categoria Sakura",
        detail: "24 peças",
        description: "08x Hot Holl, 08x Hot Couve e 08x Hot Temperado.",
        image: "./menu_pdf_images/page_08.jpg",
        price: 54.99,
        badge: "Consulte",
      },
      {
        id: "hana-18",
        name: "Combinado Hana",
        category: "Categoria Sakura",
        detail: "18 peças",
        unitsLabel: "16 unid + 2 Temakis",
        description: "08x Uramaki Skin, 08x Hot Holl e 02x Temaki Skin.",
        image: "./menu_pdf_images/page_08.jpg",
        price: 59.99,
        badge: "Consulte",
      },
      {
        id: "kumo-35",
        name: "Combinado Kumo",
        category: "Categoria Sakura",
        detail: "35 peças",
        description:
          "10x Hot Temperado, 10x Hot Holl, 10x Hot Poro e 5x Hot Couve.",
        image: "./menu_pdf_images/catalog/combinado-kumo.png",
        price: 71.99,
        badge: "Consulte",
      },
      {
        id: "ryuu-30",
        name: "Combinado Ryuu",
        category: "Categoria Oceano",
        detail: "30 peças",
        description:
          "10x Uramaki Salmão, 8x Uramaki Salmão, 6x Nigiri Salmão e 6x Joe Salmão.",
        image: "./menu_pdf_images/catalog/combinado-ryuu.png",
        price: 98.99,
        badge: "Consulte",
      },
      {
        id: "fuji-36",
        name: "Combinado Fuji",
        category: "Categoria Oceano",
        detail: "36 peças",
        description:
          "8x Uramaki Salmão, 8x Hot Holl, 8x Hot Couve, 6x Nigiri Salmão e 6x Sashimi Salmão.",
        image: "./menu_pdf_images/catalog/combinado-fuji.png",
        price: 107.99,
        badge: "Consulte",
      },
      {
        id: "sora-29",
        name: "Combinado Sora",
        category: "Categoria Oceano",
        detail: "29 peças",
        description:
          "4x Hot Holl, 4x Hot Camarão, 4x Hakusai Camarão, 4x Joe Eby, 4x Fusion, 4x Eby Especial e 5x Hakusai Grelhado.",
        image: "./menu_pdf_images/catalog/combinado-sora.png",
        price: 116.99,
        badge: "Consulte",
      },
      {
        id: "kaito-33",
        name: "Combinado Kaito",
        category: "Categoria Oceano",
        detail: "33 peças",
        description:
          "8x Uramaki Salmão, 4x Hakusai Salmão, 4x Hot Holl, 4x Hot Couve, 5x Joe Mostarda e 4x Hakusai Camarão.",
        image: "./menu_pdf_images/catalog/combinado-kaito.png",
        price: 94.99,
        badge: "Consulte",
      },
      {
        id: "ryujin-20",
        name: "Combinado Ryujin",
        category: "Categoria Oceano",
        detail: "20 peças",
        description:
          "4x Hakusai Camarão, 4x Hot Camarão, 4x Joe Eby, 4x Eby Especial e 4x Fusion.",
        image: "./menu_pdf_images/catalog/combinado-ryujin.png",
        price: 84.99,
        badge: "Consulte",
      },
      {
        id: "kaigun-28",
        name: "Combinado Kaigun",
        category: "Categoria Oceano",
        detail: "28 peças",
        description:
          "4x Hot Holl, 4x Hot Couve, 4x Nigiri Salmão, 4x Joe Poró, 4x Joe Geleia, 4x Joe Tartar e 4x Fusion.",
        image: "./menu_pdf_images/catalog/combinado-kaigun.png",
        price: 79.99,
        badge: "Consulte",
      },
      {
        id: "combinado-imperial-25",
        name: "Combinado Imperial",
        category: "Categoria Samurai",
        detail: "25 peças",
        description:
          "8x Hot Holl, 6x Eby Especial, 6x Joe Flanbado e 5x Camarão Recheado.",
        image: "./menu_pdf_images/combinado-imperial.png",
        price: 98.99,
        badge: "Consulte",
      },
      {
        id: "samurai-32",
        name: "Combinado Samurai",
        category: "Categoria Samurai",
        detail: "32 peças",
        description:
          "10x Hot Holl, 10x Hot Couve, 6x Nigiri Salmão e 6x Camarão Recheado.",
        image: "./menu_pdf_images/catalog/combinado-samurai.png",
        price: 89.99,
        badge: "Consulte",
      },
      {
        id: "shogun-30",
        name: "Combinado Shogun",
        category: "Categoria Samurai",
        detail: "30 peças",
        description:
          "12x Hot Holl, 8x Hot Temperado, 6x Hot Camarão e 4x Camarão Recheado.",
        image: "./menu_pdf_images/catalog/combinado-shogun.png",
        price: 79.99,
        badge: "Consulte",
      },
      {
        id: "tenno-30",
        name: "Combinado Tenno",
        category: "Categoria Samurai",
        detail: "30 peças",
        description:
          "6x Joe Tartar, 6x Joe Mostarda, 6x Joe Rucula, 6x Hot Temperado e 6x Camarão Recheado.",
        image: "./menu_pdf_images/catalog/combinado-tenno.png",
        price: 89.99,
        badge: "Consulte",
      },
      {
        id: "kazoku-70",
        name: "Combinado Kazoku",
        category: "Categoria Família",
        detail: "70 peças",
        description:
          "8x Uramaki Salmão, 8x Uramaki Skin, 8x Hossomaki Salmão, 8x Hot Holl, 8x Hot Couve, 4x Nigiri Salmão, 4x Nigiri Skin, 5x Hakusai Salmão, 5x Hakusai Grelhado e 12x Sashimi Salmão.",
        image: "./menu_pdf_images/catalog/combinado-kazoku.png",
        price: 179.99,
        badge: "Consulte",
      },
      {
        id: "tomodachi-64",
        name: "Combinado Tomodachi",
        category: "Categoria Família",
        detail: "64 peças",
        description:
          "6x Joe Rucula, 6x Joe Tartar, 6x Joe Especial, 6x Joe Poró, 6x Joe Salmão, 6x Joe Eby, 6x Joe Camarão Especial, 6x Eby Especial, 8x Hot Holl e 8x Hot Couve.",
        image: "./menu_pdf_images/catalog/combinado-tomodachi.png",
        price: 224.99,
        badge: "Consulte",
      },
    ],
  },
  {
    id: "temakis",
    kicker: "Temakis",
    title: "Temakis da casa",
    description:
      "Temakis classicos, grelhados e especiais.",
    items: [
      {
        id: "temaki-salmao-premium-250g",
        name: "Temaki Salmao Premium 250g",
        category: "Temaki Salmao",
        optionLabel: "Temaki Premium 250g",
        detail: "250g premium",
        description: "Versao Temaki premium de 250g apenas Completo.",
        image: TEMAKI_IMAGE_PATHS.salmao,
        badge: "Consulte",
        price: TEMAKI_PREMIUM_FINAL_PRICE,
      },
      {
        id: "temaki-salmao",
        name: "Temaki Salmao 180g",
        category: "Temaki Salmao",
        optionLabel: "Temaki 180g",
        detail: "Cone especial",
        description: "Temaki de salmao para pedido individual.",
        image: TEMAKI_IMAGE_PATHS.salmao,
        badge: "Consulte",
      },
      {
        id: "temaki-salmao-sem-cream-cheese",
        name: "Temaki Salmao Sem Cream Cheese",
        category: "Temaki Salmao",
        detail: "Sem cream cheese",
        description: "Versao sem cream cheese do temaki de salmao.",
        image: TEMAKI_IMAGE_PATHS.salmao,
        badge: "Consulte",
      },
      {
        id: "temaki-salmao-sem-arroz",
        name: "Temaki Salmao Sem Arroz",
        category: "Temaki Salmao",
        detail: "Sem arroz",
        description: "Versao sem arroz do temaki de salmao.",
        image: TEMAKI_IMAGE_PATHS.salmao,
        badge: "Consulte",
      },
      {
        id: "temaki-grelhado-premium-250g",
        name: "Temaki Grelhado Premium 250g",
        category: "Temaki Grelhado",
        optionLabel: "Temaki Premium 250g",
        detail: "250g premium",
        description: "Versao Temaki premium de 250g apenas Completo.",
        image: TEMAKI_IMAGE_PATHS.grelhado,
        badge: "Consulte",
        price: TEMAKI_PREMIUM_FINAL_PRICE,
      },
      {
        id: "temaki-grelhado",
        name: "Temaki Grelhado 180g",
        category: "Temaki Grelhado",
        optionLabel: "Temaki 180g",
        detail: "Cone especial",
        description: "Versao grelhada para quem prefere sabor mais intenso.",
        image: TEMAKI_IMAGE_PATHS.grelhado,
        badge: "Consulte",
      },
      {
        id: "temaki-grelhado-sem-cream-cheese",
        name: "Temaki Grelhado Sem Cream Cheese",
        category: "Temaki Grelhado",
        detail: "Sem cream cheese",
        description: "Versao sem cream cheese do temaki grelhado.",
        image: TEMAKI_IMAGE_PATHS.grelhado,
        badge: "Consulte",
      },
      {
        id: "temaki-grelhado-sem-arroz",
        name: "Temaki Grelhado Sem Arroz",
        category: "Temaki Grelhado",
        detail: "Sem arroz",
        description: "Versao sem arroz do temaki grelhado.",
        image: TEMAKI_IMAGE_PATHS.grelhado,
        badge: "Consulte",
      },
      {
        id: "temaki-hot-premium-250g",
        name: "Temaki Hot Premium 250g",
        category: "Temaki Hot",
        optionLabel: "Temaki Premium 250g",
        detail: "250g premium",
        description: "Versao Temaki premium de 250g apenas Completo.",
        image: TEMAKI_IMAGE_PATHS.hot,
        badge: "Consulte",
        price: TEMAKI_PREMIUM_FINAL_PRICE,
      },
      {
        id: "temaki-hot",
        name: "Temaki Hot 180g",
        category: "Temaki Hot",
        optionLabel: "Temaki 180g",
        detail: "Cone especial",
        description: "Temaki em versao quente para complementar o pedido.",
        image: TEMAKI_IMAGE_PATHS.hot,
        badge: "Consulte",
      },
      {
        id: "temaki-hot-sem-cream-cheese",
        name: "Temaki Hot Sem Cream Cheese",
        category: "Temaki Hot",
        detail: "Sem cream cheese",
        description: "Versao sem cream cheese do temaki hot.",
        image: TEMAKI_IMAGE_PATHS.hot,
        badge: "Consulte",
      },
      {
        id: "temaki-hot-sem-arroz",
        name: "Temaki Hot Sem Arroz",
        category: "Temaki Hot",
        detail: "Sem arroz",
        description: "Versao sem arroz do temaki hot.",
        image: TEMAKI_IMAGE_PATHS.hot,
        badge: "Consulte",
      },
      {
        id: "temaki-camarao-premium-250g",
        name: "Temaki Camarao Premium 250g",
        category: "Temaki Camarao",
        optionLabel: "Temaki Premium 250g",
        detail: "250g premium",
        description: "Versao Temaki premium de 250g apenas Completo.",
        image: TEMAKI_IMAGE_PATHS.camarao,
        badge: "Consulte",
        price: TEMAKI_CAMARAO_PREMIUM_FINAL_PRICE,
      },
      {
        id: "temaki-camarao",
        name: "Temaki Camarao 180g",
        category: "Temaki Camarao",
        optionLabel: "Temaki 180g",
        detail: "Cone especial",
        description: "Temaki de camarao com finalizacao da casa.",
        image: TEMAKI_IMAGE_PATHS.camarao,
        badge: "Consulte",
      },
      {
        id: "temaki-camarao-sem-cream-cheese",
        name: "Temaki Camarao Sem Cream Cheese",
        category: "Temaki Camarao",
        detail: "Sem cream cheese",
        description: "Versao sem cream cheese do temaki de camarao.",
        image: TEMAKI_IMAGE_PATHS.camarao,
        badge: "Consulte",
      },
      {
        id: "temaki-camarao-sem-arroz",
        name: "Temaki Camarao Sem Arroz",
        category: "Temaki Camarao",
        detail: "Sem arroz",
        description: "Versao sem arroz do temaki de camarao.",
        image: TEMAKI_IMAGE_PATHS.camarao,
        badge: "Consulte",
      },
    ],
  },
];

const MENU_SECTION_DISPLAY_ORDER = Object.freeze([
  "entradas-frias",
  "temakis",
  "entradas-quentes",
  "pratos-quentes",
  "combinados",
  "porcoes-sushis",
]);
let menuSectionDisplayOrder = [...MENU_SECTION_DISPLAY_ORDER];

const MENU_PRICE_DISCOUNT_RATE = 0.1;
const TEMAKI_NO_RICE_EXTRA_PRICE = 12;

const applyMenuPriceDiscount = (value) =>
  Math.round(value * (1 - MENU_PRICE_DISCOUNT_RATE) * 100) / 100;

const REFERENCE_PRICES = Object.freeze({
  "carpaccio-salmao": 65,
  "carpaccio-especial": 67,
  "carpaccio-chef": 80,
  "carpaccio-saint-peter": 65,
  "ceviche-salmao": 70,
  "ceviche-saint-peter": 70,
  "ceviche-misto": 70,
  "ceviche-camarao": 70,
  "tartar-salmao": 70,
  "tartar-saint-peter": 70,
  "tartar-camarao": 70,
  "tartar-misto": 70,
  sunomono: 10,
  "sunomono-especial": 11,
  "guioza-legumes": 30,
  "guioza-suina": 30,
  shimeji: 70,
  shiitake: 80,
  "bolinho-salmao": 50,
  "bolinho-salmao-camarao": 65,
  "isca-salmao": 60,
  "isca-saint-peter": 60,
  "yakissoba-legumes": 25,
  "yakissoba-frango": 35,
  "yakissoba-file-mignon": 50,
  "yakissoba-camarao": 55,
  "yakissoba-misto": 70,
  "teppan-salmao": 80,
  "teppan-camarao": 80,
  "temaki-salmao": 36,
  "temaki-salmao-sem-cream-cheese": 36,
  "temaki-salmao-sem-arroz": 36,
  "temaki-grelhado": 36,
  "temaki-grelhado-sem-cream-cheese": 36,
  "temaki-grelhado-sem-arroz": 36,
  "temaki-hot": 36,
  "temaki-hot-sem-cream-cheese": 36,
  "temaki-hot-sem-arroz": 36,
  "temaki-camarao": 44,
  "temaki-camarao-sem-cream-cheese": 44,
  "temaki-camarao-sem-arroz": 44,
  "joe-salmao": 5,
  "joe-poro": 5,
  "joe-biquinho": 5,
  "joe-saint-peter": 5,
  "joe-eby": 5,
  "nigiri-salmao": 10,
  "nigiri-skin": 10,
  "nigiri-camarao": 12,
  "nigiri-kani": 10,
  "nigiri-saint-peter": 10,
  "hot-holl": 5,
  "hot-couve": 5,
  "hot-poro": 5,
  "hot-camarao": 5,
  "uramaki-salmao": 40,
  "uramaki-filadelfia": 40,
  "uramaki-skin": 40,
  "uramaki-camarao": 40,
  "uramaki-grelhado": 40,
  "hossomaki-salmao": 24,
  "hossomaki-cream-cheese": 24,
  "hossomaki-saint-peter": 24,
});

MENU_SECTIONS.forEach((section) => {
  section.items.forEach((item) => {
    const price = REFERENCE_PRICES[item.id];

    if (typeof price === "number") {
      item.price = applyMenuPriceDiscount(price);

      if (item.id.endsWith("-sem-arroz")) {
        item.price = Number((item.price + TEMAKI_NO_RICE_EXTRA_PRICE).toFixed(2));
      }
    }
  });
});

const MENU_ITEM_LOOKUP = new Map(
  MENU_SECTIONS.flatMap((section) => section.items).map((item) => [item.id, item])
);

const syncMenuItemLookup = () => {
  MENU_ITEM_LOOKUP.clear();

  MENU_SECTIONS.forEach((section) => {
    (Array.isArray(section?.items) ? section.items : []).forEach((item) => {
      const itemId = String(item?.id || "").trim();

      if (itemId) {
        MENU_ITEM_LOOKUP.set(itemId, item);
      }
    });
  });
};

const normalizeMenuSectionDisplayOrder = (sectionOrder = MENU_SECTION_DISPLAY_ORDER) => {
  const validSectionIds = new Set(
    MENU_SECTIONS.map((section) => String(section?.id || "").trim()).filter(Boolean)
  );
  const preferredSectionIds = Array.isArray(sectionOrder) ? sectionOrder : MENU_SECTION_DISPLAY_ORDER;
  const normalizedSectionOrder = preferredSectionIds.filter((sectionId) => validSectionIds.has(sectionId));

  MENU_SECTIONS.forEach((section) => {
    const sectionId = String(section?.id || "").trim();

    if (sectionId && !normalizedSectionOrder.includes(sectionId)) {
      normalizedSectionOrder.push(sectionId);
    }
  });

  menuSectionDisplayOrder = normalizedSectionOrder;
};

const normalizeCollapsedCatalogSections = (sections = MENU_SECTIONS) => {
  const validSectionIds = new Set(
    (Array.isArray(sections) ? sections : [])
      .map((section) => String(section?.id || "").trim())
      .filter(Boolean)
  );
  const nextCollapsedSectionIds = [...collapsedCatalogSections].filter((sectionId) =>
    validSectionIds.has(sectionId)
  );

  if (validSectionIds.size > 0 && nextCollapsedSectionIds.length >= validSectionIds.size) {
    nextCollapsedSectionIds.length = 0;
  }

  const hasChanged =
    nextCollapsedSectionIds.length !== collapsedCatalogSections.size ||
    nextCollapsedSectionIds.some((sectionId) => !collapsedCatalogSections.has(sectionId));

  if (hasChanged) {
    collapsedCatalogSections = new Set(nextCollapsedSectionIds);
    saveStoredCollection(CATALOG_COLLAPSED_SECTIONS_STORAGE_KEY, nextCollapsedSectionIds);
  }
};

const getCatalogAvailabilityState = (item) => {
  if (item?.isPaused) {
    return "paused";
  }

  if (item?.isAvailable === false) {
    return "unavailable";
  }

  return "active";
};

const getCatalogAvailabilityLabel = (item) => {
  const state = typeof item === "string" ? item : getCatalogAvailabilityState(item);

  if (state === "paused") {
    return "Pausado";
  }

  if (state === "unavailable") {
    return "Indisponivel";
  }

  return "Ativo";
};

const isMenuItemOrderable = (itemOrId) => {
  const item =
    typeof itemOrId === "string" ? MENU_ITEM_LOOKUP.get(String(itemOrId || "").trim()) : itemOrId;

  return Boolean(item) && item.isAvailable !== false && item.isPaused !== true && typeof item.price === "number";
};

const getCatalogItemActionLabel = (item, { short = false } = {}) => {
  if (item?.isPaused) {
    return short ? "Pausado" : "Pausado no momento";
  }

  if (item?.isAvailable === false) {
    return short ? "Indisponivel" : "Indisponivel agora";
  }

  if (typeof item?.price !== "number") {
    return short ? "Sem preco" : "Preco indisponivel";
  }

  return short ? "Adicionar" : "Adicionar a sacola";
};

const hasCatalogItemOriginalPrice = (item) =>
  typeof item?.originalPrice === "number" &&
  typeof item?.price === "number" &&
  item.originalPrice > item.price;

const getCatalogItemPriceMarkup = (
  item,
  { tagName = "span", className = "catalog-option-price" } = {}
) => {
  const currentPriceLabel = getPriceLabel(item?.price);

  if (!hasCatalogItemOriginalPrice(item)) {
    return `<${tagName} class="${className}">${currentPriceLabel}</${tagName}>`;
  }

  return `
    <${tagName} class="${className} catalog-price-stack is-promotional">
      <span class="catalog-price-current">${currentPriceLabel}</span>
      <span class="catalog-price-original">${getPriceLabel(item.originalPrice)}</span>
    </${tagName}>
  `;
};

const getCatalogItemStatusMarkup = (item) => {
  if (item?.isPromoted && isMenuItemOrderable(item)) {
    return `<span class="catalog-option-status is-promoted">${escapeHtml(
      item?.activePromotion?.badgeLabel || item?.badge || "Promocao"
    )}</span>`;
  }

  if (item?.isPaused || item?.isAvailable === false || typeof item?.price !== "number") {
    return `<span class="catalog-option-status is-disabled">${escapeHtml(
      getCatalogItemActionLabel(item)
    )}</span>`;
  }

  return "";
};

const applyRuntimeCatalogState = (items = []) => {
  const stateById = new Map(
    (Array.isArray(items) ? items : [])
      .map((item) => [String(item?.id || "").trim(), item])
      .filter(([id]) => id)
  );

  MENU_SECTIONS.forEach((section) => {
    section.items.forEach((item) => {
      if (!Object.prototype.hasOwnProperty.call(item, "basePrice")) {
        item.basePrice = typeof item.price === "number" ? item.price : null;
      }

      if (!Object.prototype.hasOwnProperty.call(item, "baseBadge")) {
        item.baseBadge = item.badge || "";
      }

      const runtimeState = stateById.get(item.id) || null;

      item.price =
        runtimeState && typeof runtimeState.price === "number"
          ? Number(runtimeState.price.toFixed(2))
          : item.basePrice;
      item.regularPrice =
        runtimeState && typeof runtimeState.regularPrice === "number"
          ? Number(runtimeState.regularPrice.toFixed(2))
          : item.basePrice;
      item.originalPrice =
        runtimeState && typeof runtimeState.originalPrice === "number"
          ? Number(runtimeState.originalPrice.toFixed(2))
          : null;
      item.hasActivePromotion = Boolean(runtimeState?.hasActivePromotion);
      item.activePromotion = runtimeState?.activePromotion || null;
      item.isAvailable = runtimeState ? runtimeState.isAvailable !== false : true;
      item.isPaused = runtimeState ? runtimeState.isPaused === true : false;
      item.isPromoted = runtimeState ? runtimeState.isPromoted === true : false;
      item.availabilityState = runtimeState?.availabilityState || getCatalogAvailabilityState(item);
      item.availabilityLabel =
        runtimeState?.availabilityLabel || getCatalogAvailabilityLabel(item.availabilityState);
      item.isOrderable =
        typeof runtimeState?.isOrderable === "boolean"
          ? runtimeState.isOrderable
          : isMenuItemOrderable(item);
      item.badge =
        runtimeState?.badge ||
        (item.isPromoted
          ? "Promocao"
          : item.availabilityState === "paused"
            ? "Pausado"
            : item.availabilityState === "unavailable"
              ? "Indisponivel"
              : item.baseBadge || "");
    });
  });
};

const applyRuntimeCatalogSections = (sections = []) => {
  if (!Array.isArray(sections) || sections.length === 0) {
    return;
  }

  const localSectionsById = new Map(
    MENU_SECTIONS.map((section) => [String(section?.id || "").trim(), section])
  );
  const nextSections = [];
  const seenSectionIds = new Set();

  sections.forEach((runtimeSection) => {
    const sectionId = String(runtimeSection?.id || "").trim();

    if (!sectionId) {
      return;
    }

    const localSection = localSectionsById.get(sectionId) || null;
    const localItemsById = new Map(
      (Array.isArray(localSection?.items) ? localSection.items : []).map((item) => [
        String(item?.id || "").trim(),
        item,
      ])
    );
    const runtimeItems = Array.isArray(runtimeSection?.items) ? runtimeSection.items : [];
    const nextItemsSource =
      runtimeItems.length > 0
        ? runtimeItems
        : Array.isArray(localSection?.items)
          ? localSection.items
          : [];

    nextSections.push({
      ...(localSection || {}),
      ...runtimeSection,
      items: nextItemsSource.map((runtimeItem) => {
        const itemId = String(runtimeItem?.id || "").trim();
        const localItem = itemId ? localItemsById.get(itemId) || null : null;
        const basePrice =
          typeof runtimeItem?.basePrice === "number"
            ? Number(runtimeItem.basePrice.toFixed(2))
            : typeof localItem?.basePrice === "number"
              ? Number(localItem.basePrice.toFixed(2))
              : typeof localItem?.price === "number"
                ? Number(localItem.price.toFixed(2))
                : null;

        return {
          ...(localItem || {}),
          ...runtimeItem,
          basePrice,
          baseBadge:
            typeof runtimeItem?.baseBadge === "string"
              ? runtimeItem.baseBadge
              : typeof localItem?.baseBadge === "string"
                ? localItem.baseBadge
                : localItem?.badge || "",
        };
      }),
    });

    seenSectionIds.add(sectionId);
  });

  MENU_SECTIONS.forEach((section) => {
    const sectionId = String(section?.id || "").trim();

    if (!sectionId || seenSectionIds.has(sectionId)) {
      return;
    }

    nextSections.push(section);
  });

  MENU_SECTIONS.length = 0;
  nextSections.forEach((section) => {
    MENU_SECTIONS.push(section);
  });
  syncMenuItemLookup();
  normalizeMenuSectionDisplayOrder(menuSectionDisplayOrder);
  normalizeCollapsedCatalogSections(nextSections);
};

let catalogRuntimeHydrationPromise;
let publicReviewsHydrationPromise;
let runtimeFeaturedCatalogItem = null;
let runtimeFeaturedCatalogItems = [];
let heroFeaturedRotationItems = [];
let heroFeaturedRotationIntervalId = null;
let heroFeaturedTransitionTimeoutId = null;
let heroFeaturedActiveIndex = 0;
const HERO_FEATURED_ROTATION_INTERVAL_MS = 7800;
const HERO_FEATURED_TRANSITION_DELAY_MS = 210;

const shouldHydrateCatalogRuntimeState = () =>
  Boolean(catalogRoot) ||
  ["cardapio", "index", "inicio"].includes(String(document.body?.dataset?.page || "").trim().toLowerCase()) ||
  Boolean(document.querySelector(".hero-order-card"));

const hydrateCatalogRuntimeState = async () => {
  if (!shouldHydrateCatalogRuntimeState()) {
    return Promise.resolve();
  }

  if (catalogRuntimeHydrationPromise) {
    return catalogRuntimeHydrationPromise;
  }

  catalogRuntimeHydrationPromise = (async () => {
    try {
      const response = await fetch(PUBLIC_CATALOG_STATE_ENDPOINT, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("catalog_runtime_fetch_failed");
      }

      const payload = await response.json();
      normalizeMenuSectionDisplayOrder(payload?.sectionDisplayOrder);
      applyRuntimeCatalogSections(payload?.sections);
      applyRuntimeCatalogState(payload?.items);
      runtimeFeaturedCatalogItems = Array.isArray(payload?.featuredItems)
        ? payload.featuredItems.filter((item) => item && typeof item === "object")
        : [];
      runtimeFeaturedCatalogItem =
        runtimeFeaturedCatalogItems[0] ||
        (payload?.featuredItem && typeof payload.featuredItem === "object" ? payload.featuredItem : null);
      saveCart(loadCart());
      renderCatalog();
      renderCart();
      initComboHeroImages();
    } catch (error) {
      catalogRuntimeHydrationPromise = null;
    }
  })();

  return catalogRuntimeHydrationPromise;
};

const groupMediaControllers = new Map();
let collapsedCatalogSections = new Set();
let revealObserver;
const PLACEHOLDER_PRICE_LABEL = "R$: 00,00";
const EMPTY_GROUP_TOTAL_LABEL = "R$ 00,00";
const GROUP_MEDIA_CYCLE_MS = 2800;
const GROUP_MEDIA_FADE_MS = 620;
const TOKYO_SITE_CONFIG = TOKYO_RUNTIME_CONFIG;
const DELIVERY_DEBUG_ENABLED = Boolean(TOKYO_SITE_CONFIG.debugDelivery);
const normalizeSiteHostnameList = (value) =>
  Array.isArray(value)
    ? value
        .map((hostname) =>
          String(hostname || "")
            .trim()
            .replace(/^https?:\/\//, "")
            .replace(/\/+$/, "")
            .toLowerCase()
        )
        .filter(Boolean)
    : [];
const getBrowserOriginFallback = () => {
  const origin = String(window.location?.origin || "").trim();
  return !origin || origin === "null" ? "" : origin;
};
const SITE_PRIMARY_ORIGIN = String(
  TOKYO_SITE_CONFIG.primaryOrigin || getBrowserOriginFallback()
).trim();
const SITE_ALTERNATE_HOSTNAMES = Object.freeze(
  normalizeSiteHostnameList(TOKYO_SITE_CONFIG.alternateDomains)
);
const GOOGLE_MAPS_ALLOWED_REFERRERS = Object.freeze(
  Array.isArray(TOKYO_SITE_CONFIG.googleMapsAllowedReferrers) &&
    TOKYO_SITE_CONFIG.googleMapsAllowedReferrers.length
    ? TOKYO_SITE_CONFIG.googleMapsAllowedReferrers
        .map((referrer) => String(referrer || "").trim())
        .filter(Boolean)
    : [
        ...(SITE_PRIMARY_ORIGIN ? [`${SITE_PRIMARY_ORIGIN}/*`] : []),
        ...SITE_ALTERNATE_HOSTNAMES.map((hostname) => `https://${hostname}/*`),
      ]
);
let googleMapsLoaderPromise;
let deliveryCepLookupToken = 0;
let lastGoogleMapsApiErrorMessage = "";
let mobileExpandedCatalogSectionId = "";
let lastCatalogViewportMode = "";
const mobileCatalogSheetState = {
  sectionId: "",
  groupId: "",
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatGroupTitle = (value) => value.replace(/^Categoria\s+/i, "").trim();

const formatPrice = (value) => `R$ ${value.toFixed(2).replace(".", ",")}`;

const getCurrentPageOrigin = () => {
  const origin = String(window.location?.origin || "").trim();
  return !origin || origin === "null" ? SITE_PRIMARY_ORIGIN || "" : origin;
};

const getGoogleMapsAllowedReferrersLabel = () => GOOGLE_MAPS_ALLOWED_REFERRERS.join(" e ");

const logDeliveryDebug = (stage, payload) => {
  if (!DELIVERY_DEBUG_ENABLED) {
    return;
  }

  console.info(`[delivery] ${stage}`, payload);
};

const captureGoogleMapsApiError = (message = "") => {
  const normalizedMessage = String(message || "").replace(/\s+/g, " ").trim();

  if (!/Google Maps JavaScript API error/i.test(normalizedMessage)) {
    return;
  }

  lastGoogleMapsApiErrorMessage = normalizedMessage;
  console.warn("[delivery] maps-api-error-captured", normalizedMessage);
};

const setDeliveryCepFeedback = (form, message, state = "") => {
  const feedbackNode = form?.querySelector("[data-delivery-cep-feedback]");

  if (!feedbackNode) {
    return;
  }

  feedbackNode.textContent = normalizePortugueseText(message);
  feedbackNode.classList.remove("is-success", "is-error");

  if (state === "success" || state === "error") {
    feedbackNode.classList.add(`is-${state}`);
  }

  schedulePortugueseUiRefresh();
};

const clearDeliveryCepMetadata = (form) => {
  const fieldNames = ["delivery_neighborhood", "delivery_city", "delivery_state"];

  fieldNames.forEach((fieldName) => {
    const field = form?.elements?.namedItem(fieldName);

    if (field) {
      field.value = "";
    }
  });
};

const fillDeliveryAddressFromCep = (form, cepData) => {
  const streetField = form?.elements?.namedItem("delivery_street");
  const neighborhoodField = form?.elements?.namedItem("delivery_neighborhood");
  const cityField = form?.elements?.namedItem("delivery_city");
  const stateField = form?.elements?.namedItem("delivery_state");

  if (streetField && cepData.logradouro) {
    streetField.value = cepData.logradouro;
  }

  if (neighborhoodField) {
    neighborhoodField.value = String(cepData.bairro || "").trim();
  }

  if (cityField) {
    cityField.value = String(cepData.localidade || "").trim();
  }

  if (stateField) {
    stateField.value = String(cepData.uf || "").trim();
  }
};

const getStoredString = (storageKey, fallback = "") => {
  try {
    const value = localStorage.getItem(storageKey);
    return value == null ? fallback : String(value);
  } catch (error) {
    return fallback;
  }
};

const setStoredString = (storageKey, value) => {
  try {
    localStorage.setItem(storageKey, String(value));
    return true;
  } catch (error) {
    return false;
  }
};

const removeStoredValue = (storageKey) => {
  try {
    localStorage.removeItem(storageKey);
    return true;
  } catch (error) {
    return false;
  }
};

const generateCustomerClientToken = () => {
  try {
    const randomBytes = new Uint8Array(24);
    window.crypto.getRandomValues(randomBytes);
    return Array.from(randomBytes, (value) => value.toString(16).padStart(2, "0")).join("");
  } catch (error) {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
};

const getCustomerClientToken = () => getStoredString(CUSTOMER_CLIENT_TOKEN_KEY, "").trim();

const ensureCustomerClientToken = () => {
  const existingToken = getCustomerClientToken();

  if (existingToken) {
    return existingToken;
  }

  const generatedToken = generateCustomerClientToken();
  setStoredString(CUSTOMER_CLIENT_TOKEN_KEY, generatedToken);
  return generatedToken;
};

const clearCustomerClientToken = () => {
  removeStoredValue(CUSTOMER_CLIENT_TOKEN_KEY);
};

const lookupCepData = async (cep) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), DELIVERY_CEP_LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error("Falha ao consultar o CEP.");
    }

    const payload = await response.json();

    if (payload?.erro) {
      throw new Error("CEP nao encontrado.");
    }

    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("A consulta do CEP demorou demais para responder.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const syncDeliveryCepLookup = async (form, force = false) => {
  if (!form) {
    return;
  }

  const cepField = form.elements?.namedItem("delivery_cep");
  const cepDigits = normalizeCep(cepField?.value || "");

  if (cepDigits.length !== 8) {
    form.dataset.deliveryCepResolved = "";
    clearDeliveryCepMetadata(form);
    setDeliveryCepFeedback(form, "Digite o CEP para preencher a rua automaticamente.");
    return;
  }

  if (!force && form.dataset.deliveryCepResolved === cepDigits) {
    return;
  }

  const currentLookupToken = String(++deliveryCepLookupToken);
  form.dataset.deliveryCepLookupToken = currentLookupToken;
  setDeliveryCepFeedback(form, "Buscando endereco pelo CEP...");

  try {
    const cepData = await lookupCepData(cepDigits);

    if (form.dataset.deliveryCepLookupToken !== currentLookupToken) {
      return;
    }

    fillDeliveryAddressFromCep(form, cepData);
    form.dataset.deliveryCepResolved = cepDigits;
    setDeliveryCepFeedback(
      form,
      cepData.logradouro
        ? `Rua preenchida automaticamente: ${cepData.logradouro}.`
        : "CEP encontrado, mas sem logradouro especifico. Confira a rua manualmente.",
      cepData.logradouro ? "success" : ""
    );
  } catch (error) {
    if (form.dataset.deliveryCepLookupToken !== currentLookupToken) {
      return;
    }

    form.dataset.deliveryCepResolved = "";
    clearDeliveryCepMetadata(form);
    setDeliveryCepFeedback(
      form,
      String(error?.message || "Nao foi possivel consultar esse CEP agora."),
      "error"
    );
  }
};

const getGoogleMapsApiKey = () => {
  const googleMapsApiKeyGlobal = TOKYO_GLOBAL_NAMES.googleMapsApiKey || "TOKYO_GOOGLE_MAPS_API_KEY";
  const runtimeKey = String(window[googleMapsApiKeyGlobal] || "").trim();

  if (runtimeKey) {
    return runtimeKey;
  }

  return getStoredString(GOOGLE_MAPS_API_KEY_STORAGE_KEY, "").trim();
};

const getMaskedGoogleMapsApiKey = () => {
  const apiKey = getGoogleMapsApiKey();

  if (apiKey.length <= 8) {
    return apiKey;
  }

  return `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;
};

const buildDeliveryDestinationLabel = (street, houseNumber, cep, complement = "") => {
  const labelParts = [`${String(street || "").trim()}, ${String(houseNumber || "").trim()}`];

  if (String(complement || "").trim()) {
    labelParts.push(String(complement || "").trim());
  }

  labelParts.push(formatCepDisplay(cep));
  return labelParts.join(" - ");
};

const buildDeliveryDestinationAddress = (
  street,
  houseNumber,
  cep,
  complement = "",
  neighborhood = "",
  city = "",
  state = ""
) => {
  const addressParts = [`${String(street || "").trim()}, ${String(houseNumber || "").trim()}`];

  if (String(complement || "").trim()) {
    addressParts.push(String(complement || "").trim());
  }

  if (String(neighborhood || "").trim()) {
    addressParts.push(String(neighborhood || "").trim());
  }

  addressParts.push(
    formatCepDisplay(cep),
    String(city || "").trim() && String(state || "").trim()
      ? `${String(city).trim()} - ${String(state).trim()}`
      : DELIVERY_SERVICE_CITY_STATE,
    "Brasil"
  );
  return addressParts.join(", ");
};

const createDeliveryEstimateError = (message, mapsUrl = "", options = {}) => {
  const error = new Error(message);
  error.userMessage = message;
  error.mapsUrl = mapsUrl;
  Object.assign(error, options);
  return error;
};

const toRadians = (value) => (Number(value) * Math.PI) / 180;

const getLatValue = (location) =>
  typeof location?.lat === "function" ? Number(location.lat()) : Number(location?.lat || 0);

const getLngValue = (location) =>
  typeof location?.lng === "function" ? Number(location.lng()) : Number(location?.lng || 0);

const calculateGeodesicDistanceKm = (origin, destination) => {
  const earthRadiusKm = 6371;
  const originLatValue = getLatValue(origin);
  const destinationLatValue = getLatValue(destination);
  const originLngValue = getLngValue(origin);
  const destinationLngValue = getLngValue(destination);
  const latDifference = toRadians(destinationLatValue - originLatValue);
  const lngDifference = toRadians(destinationLngValue - originLngValue);
  const originLat = toRadians(originLatValue);
  const destinationLat = toRadians(destinationLatValue);
  const haversine =
    Math.sin(latDifference / 2) ** 2 +
    Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(lngDifference / 2) ** 2;
  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return earthRadiusKm * centralAngle;
};

const withGoogleMapsTimeout = async (promise, fallbackMessage, mapsUrl = "") => {
  let timeoutId = 0;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(createDeliveryEstimateError(fallbackMessage, mapsUrl));
        }, GOOGLE_MAPS_REQUEST_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
};

const normalizeGoogleMapsErrorMessage = (error, fallbackMessage) => {
  const rawMessage = (
    String(error?.userMessage || error?.message || error || "")
      .replace(/\s+/g, " ")
      .trim() ||
    lastGoogleMapsApiErrorMessage ||
    fallbackMessage
  ).trim();
  const currentOrigin = getCurrentPageOrigin();

  if (/BillingNotEnabledMapError/i.test(rawMessage)) {
    return "A chave do Google Maps existe, mas o faturamento do projeto ainda nao esta ativo.";
  }

  if (/RefererNotAllowedMapError/i.test(rawMessage)) {
    return currentOrigin
      ? `A chave do Google Maps nao permite o dominio atual (${currentOrigin}). Adicione ${getGoogleMapsAllowedReferrersLabel()} nas restricoes de HTTP referrer da chave.`
      : `A chave do Google Maps nao permite este dominio ou endereco local. Libere ${getGoogleMapsAllowedReferrersLabel()} nas restricoes de HTTP referrer da chave.`;
  }

  if (/InvalidKeyMapError|ApiKeyInvalid/i.test(rawMessage)) {
    return "A chave configurada do Google Maps nao e valida. Atualize a chave e tente novamente.";
  }

  if (/ApiNotActivatedMapError/i.test(rawMessage)) {
    return "Ative a Maps JavaScript API no projeto da chave do Google Maps.";
  }

  if (/REQUEST_DENIED/i.test(rawMessage)) {
    return "O Google Maps recusou a consulta do endereco. Verifique a chave, o faturamento e as APIs ativas.";
  }

  if (/ZERO_RESULTS/i.test(rawMessage)) {
    return "O Google Maps nao conseguiu localizar esse endereco com precisao suficiente.";
  }

  return rawMessage;
};

const loadGoogleMapsApi = async () => {
  if (window.google?.maps?.importLibrary) {
    logDeliveryDebug("maps-loader-ready", {
      origin: getCurrentPageOrigin(),
      source: "existing-window-google",
    });
    return window.google.maps;
  }

  const apiKey = getGoogleMapsApiKey();

  if (!apiKey) {
    throw createDeliveryEstimateError(
      `Configure uma chave do Google Maps em maps-config.js ou defina window.${TOKYO_GLOBAL_NAMES.googleMapsApiKey || "TOKYO_GOOGLE_MAPS_API_KEY"} antes de calcular a distancia.`,
      ""
    );
  }

  if (!googleMapsLoaderPromise) {
    logDeliveryDebug("maps-loader-start", {
      origin: getCurrentPageOrigin(),
      apiKey: getMaskedGoogleMapsApiKey(),
    });
    googleMapsLoaderPromise = new Promise((resolve, reject) => {
      const callbackName = "__tokyoGoogleMapsReady";
      const script = document.createElement("script");
      const previousAuthFailure = window.gm_authFailure;
      let settled = false;
      let timeoutId = 0;

      const settle = (handler, value) => {
        if (settled) {
          return;
        }

        settled = true;
        window.gm_authFailure = previousAuthFailure;
        delete window[callbackName];

        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }

        handler(value);
      };

      window[callbackName] = () => {
        logDeliveryDebug("maps-loader-callback", {
          origin: getCurrentPageOrigin(),
        });
        settle(resolve, window.google.maps);
      };

      window.gm_authFailure = () => {
        if (typeof previousAuthFailure === "function") {
          previousAuthFailure();
        }

        googleMapsLoaderPromise = null;
        logDeliveryDebug("maps-loader-auth-failure", {
          origin: getCurrentPageOrigin(),
        });
        settle(
          reject,
          createDeliveryEstimateError(
            getCurrentPageOrigin()
              ? `A autenticacao do Google Maps falhou neste dominio (${getCurrentPageOrigin()}). Verifique a chave, o faturamento e libere ${getGoogleMapsAllowedReferrersLabel()} nas restricoes de referer.`
              : "A autenticacao do Google Maps falhou. Verifique a chave, o faturamento e as restricoes de referer.",
            ""
          )
        );
      };

      script.async = true;
      script.defer = true;
      script.dataset.googleMapsLoader = "tokyo-delivery";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        apiKey
      )}&loading=async&v=weekly&callback=${callbackName}`;
      script.onerror = () => {
        googleMapsLoaderPromise = null;
        logDeliveryDebug("maps-loader-script-error", {
          origin: getCurrentPageOrigin(),
          scriptSrc: script.src,
        });
        settle(
          reject,
          createDeliveryEstimateError(
            "Nao foi possivel carregar o Google Maps para calcular a distancia agora.",
            ""
          )
        );
      };
      timeoutId = window.setTimeout(() => {
        googleMapsLoaderPromise = null;
        logDeliveryDebug("maps-loader-timeout", {
          origin: getCurrentPageOrigin(),
          timeoutMs: GOOGLE_MAPS_LOADER_TIMEOUT_MS,
        });
        settle(
          reject,
          createDeliveryEstimateError(
            "O carregamento do Google Maps expirou. Verifique a conexao, a chave e as permissoes da API.",
            ""
          )
        );
      }, GOOGLE_MAPS_LOADER_TIMEOUT_MS);

      document.head.append(script);
    });
  }

  return googleMapsLoaderPromise;
};

const getPriceLabel = (value) =>
  typeof value === "number" ? formatPrice(value) : PLACEHOLDER_PRICE_LABEL;

const getGroupTotalLabel = (value) =>
  value > 0 ? formatPrice(value) : EMPTY_GROUP_TOTAL_LABEL;

const getMenuItemsTotalAmount = (itemIds, quantityById) =>
  Number(
    itemIds
      .reduce((sum, itemId) => {
        const item = MENU_ITEM_LOOKUP.get(itemId);
        const quantity = quantityById.get(itemId) || 0;
        const price = typeof item?.price === "number" ? item.price : 0;

        return sum + price * quantity;
      }, 0)
      .toFixed(2)
  );

const normalizeCartItem = (item) => {
  const menuItem = MENU_ITEM_LOOKUP.get(item.id);

  if (!menuItem || !isMenuItemOrderable(menuItem)) {
    return null;
  }

  return {
    ...item,
    name: menuItem.name,
    category: formatGroupTitle(menuItem.category),
    price: typeof menuItem.price === "number" ? menuItem.price : item.price,
  };
};

const formatOptionLabel = (name, groupTitle) => {
  const title = formatGroupTitle(groupTitle);
  const possiblePrefixes = [title, title.replace(/s$/i, ""), "Combinado"];
  let compactName = name;

  possiblePrefixes.forEach((prefix) => {
    if (!prefix) {
      return;
    }

    compactName = compactName.replace(
      new RegExp(`^${escapeRegex(prefix)}\\s+`, "i"),
      ""
    );
  });

  compactName = compactName.replace(/^(de|do|da)\s+/i, "").trim();

  if (!compactName) {
    return name;
  }

  return compactName.charAt(0).toUpperCase() + compactName.slice(1);
};

const getCatalogOptionLabel = (item, groupTitle) =>
  item.optionLabel || formatOptionLabel(item.name, groupTitle);

const getCombinadoPriceLabel = (item) => getPriceLabel(item?.price);

const getCombinadoUnitsLabel = (source) => {
  const customUnitsLabel =
    source && typeof source === "object" ? String(source.unitsLabel || "").trim() : "";
  const detail = source && typeof source === "object" ? source.detail : source;
  const normalizedDetail = String(detail || "").trim();

  if (customUnitsLabel) {
    return customUnitsLabel;
  }

  if (!normalizedDetail) {
    return "";
  }

  const detailMatch = normalizedDetail.match(/^(\d+)\s*(?:pe[çc]as?|unid(?:ades)?)?/i);

  if (!detailMatch) {
    return normalizedDetail;
  }

  return `${detailMatch[1]} unid`;
};

const getComboContentsMarkup = (section, group) => {
  if (section.id !== "combinados" || !group.description) {
    return "";
  }

  const contents = String(group.description)
    .split(/\s*(?:,| e )\s*/)
    .map((value) => value.replace(/[\.,]$/, "").trim())
    .filter(Boolean);

  if (contents.length === 0) {
    return "";
  }

  return `<div class="catalog-combo-contents">${contents
    .map(
      (content) => `<span class="catalog-pill">${escapeHtml(content)}</span>`
    )
    .join("")}</div>`;
};

const getCombinadosMobileDetailsMarkup = (section, item) => {
  const contentsMarkup = getComboContentsMarkup(section, item);

  if (!contentsMarkup) {
    return "";
  }

  return `
    <div class="catalog-combinados-mobile-details" id="catalog-combinado-details-${item.id}">
      <p class="catalog-combinados-mobile-details-title">O combo inclui</p>
      ${contentsMarkup}
    </div>
  `;
};

const getCombinadosPreviewMarkup = (category, selectedCombo, section) => {
  if (!category) {
    return "";
  }

  if (!selectedCombo) {
    return `
      <article class="catalog-combinados-spotlight-card catalog-combinados-spotlight-card-empty">
        <div class="catalog-combinados-spotlight-empty-copy">
          <p class="catalog-combinados-spotlight-category">${category.label}</p>
          <h3>Selecione um combinado</h3>
          <p>Escolha um nome na lista para abrir a vitrine com foto, itens e valor.</p>
        </div>
      </article>
    `;
  }

  const contentsMarkup = getComboContentsMarkup(section, selectedCombo);
  const unitsLabel = getCombinadoUnitsLabel(selectedCombo);
  const categoryLabel = category.label || category.title;
  const isOrderable = isMenuItemOrderable(selectedCombo);

  return `
    <article class="catalog-combinados-spotlight-card">
      <figure class="catalog-combinados-spotlight-media">
        <img
          src="${selectedCombo.image}"
          alt="${selectedCombo.name}"
          loading="lazy"
          decoding="async"
        />
      </figure>
      <div class="catalog-combinados-spotlight-body">
          <div class="catalog-combinados-spotlight-head">
          <div class="catalog-combinados-spotlight-heading">
            <p class="catalog-combinados-spotlight-category">${categoryLabel}</p>
            <h3>${selectedCombo.name}</h3>
            ${unitsLabel ? `<p class="catalog-combinados-spotlight-units">(${unitsLabel})</p>` : ""}
          </div>
          ${getCatalogItemPriceMarkup(selectedCombo, {
            tagName: "p",
            className: "catalog-combinados-spotlight-price",
          })}
        </div>
        ${contentsMarkup ? `<div class="catalog-combinados-spotlight-contents">${contentsMarkup}</div>` : ""}
        ${getCatalogItemReviewMarkup(selectedCombo, { mode: "spotlight" })}
        <div class="catalog-card-actions catalog-combinados-spotlight-actions">
          <div
            class="catalog-option catalog-option-preview${selectedCombo.isPromoted ? " is-promoted" : ""}${!isOrderable ? " is-disabled" : ""}"
            data-item-chip
            data-item-id="${selectedCombo.id}"
            data-item-name="${escapeHtml(selectedCombo.name)}"
            data-item-category="${escapeHtml(categoryLabel)}"
          >
            <button
              class="catalog-option-main catalog-combinados-cta"
              type="button"
              data-item-button
              data-add-to-cart
              aria-pressed="false"
              aria-label="${escapeHtml(getCatalogItemActionLabel(selectedCombo))}: ${escapeHtml(selectedCombo.name)}"
              ${isOrderable ? "" : "disabled"}
            >
              <span class="catalog-option-copy">
                <span class="catalog-option-label">${escapeHtml(getCatalogItemActionLabel(selectedCombo))}</span>
                ${getCatalogItemPriceMarkup(selectedCombo, {
                  tagName: "span",
                  className: "catalog-option-price",
                })}
                ${getCatalogItemStatusMarkup(selectedCombo)}
              </span>
            </button>
            <div class="catalog-option-controls" aria-label="Controle de quantidade">
              <button
                class="catalog-stepper"
                type="button"
                data-item-decrease
                aria-label="Diminuir ${escapeHtml(selectedCombo.name)}"
              >
                -
              </button>
              <span class="catalog-option-qty" data-item-qty></span>
              <button
                class="catalog-stepper"
                type="button"
                data-item-increase
                aria-label="Aumentar ${escapeHtml(selectedCombo.name)}"
                ${isOrderable ? "" : "disabled"}
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  `;
};


const getCombinadosCategoriesMarkup = (categories, selectedCategoryId) =>
  categories
    .map(
      (category) => `
        <button
          class="catalog-combinados-item${category.id === selectedCategoryId ? " is-active" : ""}"
          type="button"
          data-combinado-category-id="${category.id}"
          data-combinado-category-items="${category.items.map((item) => item.id).join(",")}"
          aria-pressed="${category.id === selectedCategoryId ? "true" : "false"}"
        >
          <span class="catalog-combinados-item-kicker">Categoria</span>
          <div class="catalog-combinados-item-head">
            <span class="catalog-combinados-item-title">${category.title}</span>
            <span class="catalog-pill catalog-combinados-item-detail">${category.items.length > 0 ? `${category.items.length} combinados` : ""}</span>
          </div>
          <p class="catalog-combinados-item-copy">Abra a lista desta linha no painel ao lado.</p>
          <div class="catalog-combinados-item-footer">
            <span class="catalog-combinados-item-total-label">Subtotal</span>
            <strong class="catalog-combinados-item-total-value" data-combinado-category-total>${EMPTY_GROUP_TOTAL_LABEL}</strong>
          </div>
        </button>
      `
    )
    .join("");

const getCombinadosMobileFiltersMarkup = (categories, selectedCategoryId) =>
  `
    <div class="catalog-combinados-mobile-filters" aria-label="Categorias de combinados">
      ${categories
        .map((category) => {
          const isActive = category.id === selectedCategoryId;

          return `
            <button
              class="catalog-combinados-mobile-filter${isActive ? " is-active" : ""}"
              type="button"
              data-combinado-category-id="${category.id}"
              data-combinado-category-items="${category.items.map((item) => item.id).join(",")}"
              aria-pressed="${isActive ? "true" : "false"}"
            >
              <span class="catalog-combinados-mobile-filter-title">${escapeHtml(category.title)}</span>
              <span class="catalog-pill catalog-combinados-mobile-filter-count">${category.items.length} combinados</span>
            </button>
          `;
        })
        .join("")}
    </div>
  `;

const getCombinadosMobileCardsMarkup = (section, category, selectedComboId) =>
  `
    <div class="catalog-combinados-mobile-grid" aria-label="Lista de combinados da categoria ${category.title}">
      ${category.items
        .map((item) => {
          const isExpanded = item.id === selectedComboId;
          const unitsLabel = getCombinadoUnitsLabel(item);
          const detailsMarkup = getCombinadosMobileDetailsMarkup(section, item);
          const isOrderable = isMenuItemOrderable(item);

          return `
            <article
              class="catalog-combinados-mobile-card${isExpanded ? " is-open" : ""}${item.isPromoted ? " is-promoted" : ""}${!isOrderable ? " is-disabled" : ""}"
              data-combinado-mobile-card="${item.id}"
            >
              <figure class="catalog-combinados-mobile-media">
                <img
                  src="${item.image}"
                  alt="${escapeHtml(item.name)}"
                  loading="lazy"
                  decoding="async"
                />
              </figure>
              <div class="catalog-combinados-mobile-body">
                <div class="catalog-combinados-mobile-head">
                  <div class="catalog-combinados-mobile-copy">
                    <h4>${escapeHtml(item.name)}</h4>
                    ${unitsLabel ? `<p class="catalog-combinados-mobile-units">Pecas: ${escapeHtml(unitsLabel)}</p>` : ""}
                  </div>
                  ${getCatalogItemPriceMarkup(item, {
                    tagName: "p",
                    className: "catalog-combinados-mobile-price",
                  })}
                </div>
                ${getCatalogItemReviewMarkup(item, { mode: "sheet" })}
                <div class="catalog-combinados-mobile-actions">
                  <div
                    class="catalog-option catalog-option-preview catalog-combinados-mobile-purchase${item.isPromoted ? " is-promoted" : ""}${!isOrderable ? " is-disabled" : ""}"
                    data-item-chip
                    data-item-id="${item.id}"
                    data-item-name="${escapeHtml(item.name)}"
                    data-item-category="${escapeHtml(category.title)}"
                  >
                    <button
                      class="catalog-option-main catalog-combinados-cta catalog-combinados-mobile-cta"
                      type="button"
                      data-item-button
                      data-add-to-cart
                      aria-pressed="false"
                      aria-label="${escapeHtml(getCatalogItemActionLabel(item))}: ${escapeHtml(item.name)}"
                      ${isOrderable ? "" : "disabled"}
                    >
                      <span class="catalog-option-copy">
                        <span class="catalog-option-label">${escapeHtml(
                          getCatalogItemActionLabel(item, { short: true })
                        )}</span>
                        ${getCatalogItemStatusMarkup(item)}
                      </span>
                    </button>
                    <div class="catalog-option-controls" aria-label="Controle de quantidade">
                      <button
                        class="catalog-stepper"
                        type="button"
                        data-item-decrease
                        aria-label="Diminuir ${escapeHtml(item.name)}"
                      >
                        -
                      </button>
                      <span class="catalog-option-qty" data-item-qty></span>
                      <button
                        class="catalog-stepper"
                        type="button"
                        data-item-increase
                        aria-label="Aumentar ${escapeHtml(item.name)}"
                        ${isOrderable ? "" : "disabled"}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  ${
                    detailsMarkup
                      ? `
                    <button
                      class="catalog-combinados-mobile-details-toggle${isExpanded ? " is-open" : ""}"
                      type="button"
                      data-combinado-detail-toggle="${item.id}"
                      aria-expanded="${isExpanded ? "true" : "false"}"
                      aria-controls="catalog-combinado-details-${item.id}"
                    >
                      ${isExpanded ? "Ocultar detalhes" : "Ver detalhes"}
                    </button>
                    ${isExpanded ? detailsMarkup : ""}
                  `
                      : ""
                  }
                </div>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;

const getCombinadosItemsMarkup = (section, category, selectedComboId) => {
  if (isCatalogMobileViewport()) {
    return getCombinadosMobileCardsMarkup(section, category, selectedComboId);
  }

  return `
    <div class="catalog-combinados-items-panel">
      <div class="catalog-combinados-items-panel-head">
        <p class="catalog-kicker">${category.label}</p>
        <h4>Escolha um combinado</h4>
        <p>Selecione um nome para abrir o destaque do combinado selecionado.</p>
      </div>
      <div class="catalog-combinados-items-list" aria-label="Lista de combinados da categoria ${category.title}">
        ${category.items
          .map((item) => {
            const isActive = item.id === selectedComboId;

            return `
              <button
                class="catalog-combinados-combo${isActive ? " is-active" : ""}"
                type="button"
                data-combinado-item-id="${item.id}"
                aria-pressed="${isActive ? "true" : "false"}"
              >
                <div class="catalog-combinados-combo-copy">
                  <span class="catalog-combinados-combo-name">${item.name}</span>
                  <span class="catalog-combinados-combo-units">${getCombinadoUnitsLabel(item)}</span>
                  ${getCatalogItemReviewMarkup(item, { mode: "compact" })}
                </div>
                ${getCatalogItemPriceMarkup(item, {
                  tagName: "span",
                  className: "catalog-combinados-combo-price",
                })}
              </button>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
};

const isCatalogSectionCollapsed = (sectionId) =>
  isCatalogMobileViewport()
    ? mobileExpandedCatalogSectionId !== sectionId
    : collapsedCatalogSections.has(sectionId);

const getCatalogSectionToggleLabel = (sectionId) => {
  const isCollapsed = isCatalogSectionCollapsed(sectionId);

  if (isCatalogMobileViewport()) {
    return isCollapsed ? "Ver itens" : "Fechar";
  }

  return isCollapsed ? "Mostrar categoria" : "Ocultar categoria";
};

const getCatalogSectionHeadMarkup = (section) => `
  <div class="catalog-block-head reveal" data-catalog-section-head="${section.id}">
    <div class="catalog-block-head-main">
      <div>
        <p class="section-tag">${section.kicker}</p>
        <h3>${section.title}</h3>
      </div>
      <p>${section.description}</p>
    </div>
    <button
      class="catalog-section-toggle${isCatalogSectionCollapsed(section.id) ? " is-collapsed" : ""}"
      type="button"
      data-catalog-section-toggle="${section.id}"
      aria-expanded="${isCatalogSectionCollapsed(section.id) ? "false" : "true"}"
      aria-controls="catalog-section-content-${section.id}"
    >
      <span class="catalog-section-toggle-label">${getCatalogSectionToggleLabel(section.id)}</span>
      <span class="catalog-section-toggle-icon" aria-hidden="true">
        ${isCatalogSectionCollapsed(section.id) ? "+" : "-"}
      </span>
    </button>
  </div>
`;

const updateCatalogSectionVisibility = (sectionId) => {
  const isCollapsed = isCatalogSectionCollapsed(sectionId);

  document
    .querySelectorAll(`[data-catalog-section-content="${sectionId}"]`)
    .forEach((content) => {
      content.hidden = isCollapsed;
      content.classList.toggle("is-collapsed", isCollapsed);
    });

  document
    .querySelectorAll(`[data-catalog-section-toggle="${sectionId}"]`)
    .forEach((button) => {
      button.classList.toggle("is-collapsed", isCollapsed);
      button.setAttribute("aria-expanded", isCollapsed ? "false" : "true");

      const label = button.querySelector(".catalog-section-toggle-label");
      const icon = button.querySelector(".catalog-section-toggle-icon");

      if (label) {
        label.textContent = getCatalogSectionToggleLabel(sectionId);
      }

      if (icon) {
        icon.textContent = isCollapsed ? "+" : "-";
      }
    });

  const sectionNode = document.getElementById(sectionId);
  if (sectionNode) {
    sectionNode.classList.toggle("is-collapsed", isCollapsed);
  }
};

const toggleCatalogSectionVisibility = (sectionId) => {
  if (!sectionId) {
    return;
  }

  if (isCatalogMobileViewport()) {
    mobileExpandedCatalogSectionId = mobileExpandedCatalogSectionId === sectionId ? "" : sectionId;

    MENU_SECTIONS.forEach((section) => {
      updateCatalogSectionVisibility(section.id);
    });

    return;
  }

  if (collapsedCatalogSections.has(sectionId)) {
    collapsedCatalogSections.delete(sectionId);
  } else {
    collapsedCatalogSections.add(sectionId);
  }

  saveStoredCollection(CATALOG_COLLAPSED_SECTIONS_STORAGE_KEY, [...collapsedCatalogSections]);
  updateCatalogSectionVisibility(sectionId);
};

const renderCombinadosSection = (section) => {
  const categories = getCombinadosCategories(section);
  if (categories.length === 0) {
    return "";
  }

  const selectedCategory =
    categories.find((category) => category.id === selectedCombinadosCategoryId) || categories[0];
  selectedCombinadosCategoryId = selectedCategory.id;
  selectedCombinadosComboId = selectedCategory.items.some((item) => item.id === selectedCombinadosComboId)
    ? selectedCombinadosComboId
    : null;
  const selectedCombo =
    selectedCategory.items.find((item) => item.id === selectedCombinadosComboId) || null;

  if (isCatalogMobileViewport()) {
    return `
      <section class="catalog-block catalog-block-combinados" id="${section.id}">
        ${getCatalogSectionHeadMarkup(section)}
        <div
          class="catalog-block-content${isCatalogSectionCollapsed(section.id) ? " is-collapsed" : ""}"
          id="catalog-section-content-${section.id}"
          data-catalog-section-content="${section.id}"
          ${isCatalogSectionCollapsed(section.id) ? "hidden" : ""}
        >
          <div class="catalog-combinados-mobile">
            ${getCombinadosMobileFiltersMarkup(categories, selectedCombinadosCategoryId)}
            <div class="catalog-combinados-mobile-list" data-combinados-items>
              ${getCombinadosItemsMarkup(section, selectedCategory, selectedCombinadosComboId)}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  return `
    <section class="catalog-block catalog-block-combinados" id="${section.id}">
      ${getCatalogSectionHeadMarkup(section)}
      <div
        class="catalog-block-content${isCatalogSectionCollapsed(section.id) ? " is-collapsed" : ""}"
        id="catalog-section-content-${section.id}"
        data-catalog-section-content="${section.id}"
        ${isCatalogSectionCollapsed(section.id) ? "hidden" : ""}
      >
        <div class="catalog-combinados-layout">
          <aside class="catalog-combinados-list">
            ${getCombinadosCategoriesMarkup(categories, selectedCombinadosCategoryId)}
          </aside>
          <div class="catalog-combinados-main">
            <div class="catalog-combinados-main-panel${selectedCombo ? " has-selection" : ""}" data-combinados-main-panel>
              <div class="catalog-combinados-items" data-combinados-items>
                ${getCombinadosItemsMarkup(section, selectedCategory, selectedCombinadosComboId)}
              </div>
              <div class="catalog-combinados-preview-shell" data-combinados-preview-shell aria-live="polite">
                ${getCombinadosPreviewMarkup(selectedCategory, selectedCombo, section)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
};

const isTemakiPremiumOption = (item) =>
  String(item?.id || "").includes("-premium-250g");

const getSelectedCombinadosCategory = () => {
  const section = MENU_SECTIONS.find((section) => section.id === "combinados");
  if (!section) {
    return null;
  }

  const categories = getCombinadosCategories(section);
  return categories.find((category) => category.id === selectedCombinadosCategoryId) || categories[0] || null;
};

const syncCombinadosCartSelections = (quantityById) => {
  document.querySelectorAll("[data-combinado-category-id]").forEach((button) => {
    const itemIds = (button.dataset.combinadoCategoryItems || "").split(",").filter(Boolean);
    const hasItemsInCart = itemIds.some((itemId) => (quantityById.get(itemId) || 0) > 0);
    const totalNode = button.querySelector("[data-combinado-category-total]");
    const categoryTotal = getMenuItemsTotalAmount(itemIds, quantityById);

    button.classList.toggle("is-in-cart", hasItemsInCart);

    if (totalNode) {
      totalNode.textContent = getGroupTotalLabel(categoryTotal);
    }
  });

  document.querySelectorAll("[data-combinado-item-id]").forEach((button) => {
    const hasItemInCart = (quantityById.get(button.dataset.combinadoItemId) || 0) > 0;

    button.classList.toggle("is-in-cart", hasItemInCart);
  });

  document.querySelectorAll("[data-combinado-mobile-card]").forEach((card) => {
    const hasItemInCart = (quantityById.get(card.dataset.combinadoMobileCard) || 0) > 0;

    card.classList.toggle("is-in-cart", hasItemInCart);
  });
};

const updateCombinadosPreviewShell = () => {
  const section = MENU_SECTIONS.find((section) => section.id === "combinados");
  const selectedCategory = getSelectedCombinadosCategory();
  if (!section || !selectedCategory || isCatalogMobileViewport()) {
    return;
  }

  const selectedCombo = selectedCategory.items.find((item) => item.id === selectedCombinadosComboId) || null;
  const mainPanel = document.querySelector("[data-combinados-main-panel]");
  const previewShell = document.querySelector("[data-combinados-preview-shell]");
  if (!previewShell) {
    return;
  }

  if (mainPanel) {
    mainPanel.classList.toggle("has-selection", Boolean(selectedCombo));
  }

  previewShell.innerHTML = getCombinadosPreviewMarkup(selectedCategory, selectedCombo, section);
  syncCatalogSelections();
};

const updateCombinadosItemsList = () => {
  const section = MENU_SECTIONS.find((menuSection) => menuSection.id === "combinados");
  const selectedCategory = getSelectedCombinadosCategory();
  if (!section || !selectedCategory) {
    return;
  }

  const itemsContainer = document.querySelector("[data-combinados-items]");
  if (!itemsContainer) {
    return;
  }

  itemsContainer.innerHTML = getCombinadosItemsMarkup(section, selectedCategory, selectedCombinadosComboId);
  syncCatalogSelections();
};

const updateCombinadosCategorySelection = (categoryId) => {
  selectedCombinadosCategoryId = categoryId;
  selectedCombinadosComboId = null;

  document.querySelectorAll("[data-combinado-category-id]").forEach((button) => {
    const isActive = button.dataset.combinadoCategoryId === categoryId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  if (isCatalogMobileViewport()) {
    const activeCategoryButton = [...document.querySelectorAll("[data-combinado-category-id]")].find(
      (button) => button.dataset.combinadoCategoryId === categoryId
    );

    activeCategoryButton?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }

  updateCombinadosPreviewShell();
  updateCombinadosItemsList();
};

const updateCombinadosComboSelection = (comboId) => {
  selectedCombinadosComboId =
    isCatalogMobileViewport() && selectedCombinadosComboId === comboId ? null : comboId;

  document.querySelectorAll("[data-combinado-item-id]").forEach((button) => {
    const isActive = button.dataset.combinadoItemId === comboId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  updateCombinadosPreviewShell();
  updateCombinadosItemsList();
};

const GROUP_COVER_IMAGES = Object.freeze({
  Carpaccio: {
    src: "./menu_pdf_images/catalog/carpaccio-cover.jpg",
    alt: "Capa da categoria Carpaccio",
  },
  Ceviche: {
    src: "./menu_pdf_images/catalog/ceviche-cover.jpg",
    alt: "Capa da categoria Ceviche",
  },
  Sunomono: {
    src: "./menu_pdf_images/catalog/sunomono.jpg",
    alt: "Capa da categoria Sunomono",
  },
  Guioza: {
    src: "./menu_pdf_images/catalog/guioza-premium.jpg",
    alt: "Capa da categoria Guioza",
  },
  Bolinhos: {
    src: "./menu_pdf_images/catalog/bolinhos-premium.jpg",
    alt: "Capa da categoria Bolinhos",
  },
  Tartar: {
    src: "./menu_pdf_images/catalog/tartar-cover.jpg",
    alt: "Capa da categoria Tartar",
  },
  Teppan: {
    src: TEPPAN_IMAGE_PATHS.base,
    alt: "Capa da categoria Teppan",
  },
  "HOT HOLLS (8 unidades)": {
    src: SUSHI_PORTION_IMAGE_PATHS.hot,
    alt: "Capa da categoria HOT HOLLS (8 unidades)",
  },
  "JOES (6 unidades)": {
    src: SUSHI_PORTION_IMAGE_PATHS.joe,
    alt: "Capa da categoria JOES (6 unidades)",
  },
  "URAMAKI E HOSSOMAKI (8 unidades)": {
    src: SUSHI_PORTION_IMAGE_PATHS.uramaki,
    alt: "Capa da categoria URAMAKI E HOSSOMAKI (8 unidades)",
  },
  "NIGIRI (6 unidades)": {
    src: SUSHI_PORTION_IMAGE_PATHS.nigiri,
    alt: "Capa da categoria NIGIRI (6 unidades)",
  },
  "CAMAR\u00d5ES (6 unidades)": {
    src: SUSHI_PORTION_IMAGE_PATHS.camarao,
    alt: "Capa da categoria CAMAROES (6 unidades)",
  },
});

normalizeImageFields(MENU_COMBINADOS_CATEGORY_IMAGES);
normalizeImageFields(MENU_SECTIONS);
normalizeImageFields(GROUP_COVER_IMAGES);

const GROUP_MEDIA_PLACEHOLDER_SRC =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const stopGroupMediaCycle = (groupId) => {
  const controller = groupMediaControllers.get(groupId);

  if (!controller) {
    return;
  }

  if (controller.intervalId) {
    window.clearInterval(controller.intervalId);
    controller.intervalId = 0;
  }

  if (controller.timeoutId) {
    window.clearTimeout(controller.timeoutId);
    controller.timeoutId = 0;
  }

  if (controller.figure) {
    controller.figure.classList.remove("is-transitioning");

    const nextImage = controller.figure.querySelector("[data-group-media-next]");

    if (nextImage) {
      nextImage.classList.remove("is-visible");
      nextImage.src = GROUP_MEDIA_PLACEHOLDER_SRC;
      nextImage.alt = "";
      nextImage.dataset.mediaSrc = "";
    }
  }
};

const updateGroupMediaCaption = (figure, entry, selectedCount) => {
  const caption = figure.querySelector("[data-group-media-caption]");

  if (!caption || !entry) {
    return;
  }

  if (selectedCount === 0) {
    caption.textContent = `Destaque de ${figure.dataset.groupTitle}`;
    return;
  }

  if (selectedCount === 1) {
    caption.textContent = entry.label;
    return;
  }

  caption.textContent = `${entry.label} em rotacao`;
};

const showGroupMedia = (figure, controller, index) => {
  const entry = controller.entries[index];
  const activeImage = figure.querySelector("[data-group-media-active]");
  const nextImage = figure.querySelector("[data-group-media-next]");

  if (!entry || !activeImage || !nextImage) {
    return;
  }

  controller.index = index;

  if (activeImage.dataset.mediaSrc === entry.src) {
    updateGroupMediaCaption(figure, entry, controller.selectedCount);
    return;
  }

  if (controller.timeoutId) {
    window.clearTimeout(controller.timeoutId);
    controller.timeoutId = 0;
  }

  nextImage.src = entry.src;
  nextImage.alt = entry.alt;
  nextImage.dataset.mediaSrc = entry.src;

  nextImage.classList.add("is-visible");
  figure.classList.add("is-transitioning");
  updateGroupMediaCaption(figure, entry, controller.selectedCount);

  controller.timeoutId = window.setTimeout(() => {
    activeImage.src = entry.src;
    activeImage.alt = entry.alt;
    activeImage.dataset.mediaSrc = entry.src;
    nextImage.classList.remove("is-visible");
    nextImage.removeAttribute("src");
    nextImage.alt = "";
    nextImage.dataset.mediaSrc = "";
    figure.classList.remove("is-transitioning");
    controller.timeoutId = 0;
  }, GROUP_MEDIA_FADE_MS);
};

const getGroupMediaSelection = (figure, quantityById) => {
  const itemIds = (figure.dataset.groupItems || "").split(",").filter(Boolean);
  const groupTitle = figure.dataset.groupTitle || "";
  const selectedItems = itemIds
    .map((itemId) => ({
      item: MENU_ITEM_LOOKUP.get(itemId),
      quantity: quantityById.get(itemId) || 0,
    }))
    .filter(({ item, quantity }) => item && quantity > 0 && item.image);

  if (selectedItems.length === 0) {
    return {
      selectedCount: 0,
      entries: [
        {
          src: figure.dataset.groupDefaultImage,
          alt: figure.dataset.groupDefaultAlt || groupTitle,
          label: groupTitle,
        },
      ],
    };
  }

  return {
    selectedCount: selectedItems.length,
    entries: selectedItems.map(({ item }) => ({
      src: item.image,
      alt: item.name,
      label: getCatalogOptionLabel(item, groupTitle),
    })),
  };
};

const syncGroupMedia = (quantityById) => {
  document.querySelectorAll("[data-group-media]").forEach((figure) => {
    const groupId = figure.dataset.groupId;

    if (!groupId) {
      return;
    }

    const { entries, selectedCount } = getGroupMediaSelection(figure, quantityById);
    const signature = entries.map((entry) => entry.src).join("|");
    let controller = groupMediaControllers.get(groupId);

    if (!controller) {
      controller = {
        entries,
        selectedCount,
        signature: "",
        index: 0,
        intervalId: 0,
        timeoutId: 0,
      };
      groupMediaControllers.set(groupId, controller);
    }

    controller.entries = entries;
    controller.selectedCount = selectedCount;
    controller.figure = figure;

    if (controller.signature !== signature) {
      stopGroupMediaCycle(groupId);
      controller.signature = signature;
      controller.index = 0;
      showGroupMedia(figure, controller, 0);

      if (selectedCount > 1) {
        controller.intervalId = window.setInterval(() => {
          const currentController = groupMediaControllers.get(groupId);

          if (!currentController) {
            return;
          }

          currentController.index =
            (currentController.index + 1) % currentController.entries.length;
          showGroupMedia(figure, currentController, currentController.index);
        }, GROUP_MEDIA_CYCLE_MS);
      }

      return;
    }

    updateGroupMediaCaption(
      figure,
      controller.entries[controller.index] || controller.entries[0],
      selectedCount
    );

    if (selectedCount > 1 && !controller.intervalId) {
      controller.intervalId = window.setInterval(() => {
        const currentController = groupMediaControllers.get(groupId);

        if (!currentController) {
          return;
        }

        currentController.index =
          (currentController.index + 1) % currentController.entries.length;
        showGroupMedia(figure, currentController, currentController.index);
      }, GROUP_MEDIA_CYCLE_MS);
    }

    if (selectedCount <= 1 && controller.intervalId) {
      stopGroupMediaCycle(groupId);
    }
  });
};

const GROUP_COPY_SUMMARIES = Object.freeze({
  Carpaccio:
    "Fatias finas com molho da casa.",
  Ceviche:
    "Cubos marinados com toque citrico.",
  Tartar:
    "Preparos cremosos com finalizacao especial.",
  Sunomono:
    "Pepino japones agridoce para acompanhar.",
  Guioza:
    "Pasteis japoneses dourados e bem recheados.",
  Cogumelos:
    "Shimeji e shiitake salteados.",
  Bolinhos:
    "Porcoes crocantes para dividir.",
  Iscas:
    "Tiras crocantes para complementar o pedido.",
  Yakissoba:
    "Macarrao oriental com legumes e proteina.",
  Teppan:
    "Grelhados com arroz e legumes.",
  "Categoria Sakura":
    "Combinados leves e versateis.",
  "Categoria Oceano":
    "Combinados com mais salmao e camarao.",
  "Categoria Samurai":
    "Combinados especiais e mais intensos.",
  "Categoria Família":
    "Combinados maiores para dividir.",
  "HOT HOLLS (8 unidades)":
    "Porcoes quentes e crocantes para pedir por linha.",
  "JOES (6 unidades)":
    "Joes variados para montar uma selecao especial.",
  "URAMAKI E HOSSOMAKI (8 unidades)":
    "Rolinhos frios da casa em porcoes para compartilhar.",
  "NIGIRI (6 unidades)":
    "Nigiris classicos em porcoes praticas.",
  "CAMAR\u00d5ES (6 unidades)":
    "Selecao com pecas de camarao para variar o pedido.",
  Temaki:
    "Temakis frescos, grelhados e especiais.",
  Joes:
    "Joes variados para montar sua selecao.",
  Nigiri:
    "Nigiris classicos para completar o pedido.",
  "Hot Rolls":
    "Sushis quentes, crocantes e intensos.",
  Uramakis:
    "Rolinhos variados para compartilhar.",
  Hossomakis:
    "Rolinhos leves para completar o pedido.",
});

const buildGroupDescription = (section, groupTitle, items) => {
  if (items.length === 1) {
    return items[0].description;
  }

  return GROUP_COPY_SUMMARIES[groupTitle] || items[0].description;
};

const buildGroupSelectionHint = (section, groupTitle, items) => {
  const title = formatGroupTitle(groupTitle).toLowerCase();

  if (items.length === 1) {
    return `Adicione ${title} a sacola para incluir essa opcao no pedido.`;
  }

  if (section.id === "combinados") {
    return `Selecione um ou mais combinados da linha ${title} para montar seu pedido.`;
  }

  if (section.id === "temakis") {
    return `Selecione uma ou mais versoes de ${title} para montar seu pedido.`;
  }

  if (section.id === "porcoes-sushis") {
    return `Selecione uma ou mais porcoes de ${title} para montar seu pedido.`;
  }

  return `Selecione uma ou mais opcoes de ${title} para montar seu pedido.`;
};

const groupCatalogItems = (section) => {
  if (section.id === "combinados") {
    return section.items.map((item) => ({
      id: `${section.id}-${item.id}`,
      category: item.category,
      title: item.name,
      image: item.image,
      defaultAlt: item.name,
      items: [item],
      description: item.description,
      selectionHint: `Adicione este combinado à sacola para incluir no pedido.`,
      detail: item.detail,
    }));
  }

  const groupedItems = new Map();

  section.items.forEach((item) => {
    if (!groupedItems.has(item.category)) {
      groupedItems.set(item.category, []);
    }

    groupedItems.get(item.category).push(item);
  });

  return Array.from(groupedItems.entries()).map(([category, items]) => {
    const title = formatGroupTitle(category);
    const cover = GROUP_COVER_IMAGES[title];

    return {
      id: `${section.id}-${category.toLowerCase().replace(/\s+/g, "-")}`,
      category,
      title,
      image: cover?.src ?? items[0].image,
      defaultAlt: cover?.alt ?? title,
      items,
      description: buildGroupDescription(section, category, items),
      selectionHint: buildGroupSelectionHint(section, category, items),
      detail: `${items.length} opc${items.length === 1 ? "ao" : "oes"}`,
    };
  });
};

const getCatalogSectionById = (sectionId) =>
  MENU_SECTIONS.find((section) => section.id === sectionId) || null;

const getCatalogTargetItemId = () => {
  if (document.body.dataset.page !== "cardapio") {
    return "";
  }

  const itemParam = new URLSearchParams(window.location.search).get("item");
  if (itemParam) {
    return decodeURIComponent(itemParam).trim();
  }

  const hash = String(window.location.hash || "").trim();
  if (!hash.startsWith("#item-")) {
    return "";
  }

  try {
    return decodeURIComponent(hash.slice("#item-".length)).trim();
  } catch (error) {
    return hash.slice("#item-".length).trim();
  }
};

const findCatalogItemLocation = (itemId) => {
  const normalizedItemId = String(itemId || "").trim();

  if (!normalizedItemId) {
    return null;
  }

  for (const section of MENU_SECTIONS) {
    const item = section.items.find((entry) => entry.id === normalizedItemId);

    if (!item) {
      continue;
    }

    if (section.id !== "combinados") {
      return {
        item,
        section,
        category: null,
      };
    }

    const category =
      getCombinadosCategories(section).find((entry) =>
        entry.items.some((categoryItem) => categoryItem.id === normalizedItemId)
      ) || null;

    return {
      item,
      section,
      category,
    };
  }

  return null;
};

const prepareCatalogTargetItem = () => {
  const targetItemId = getCatalogTargetItemId();
  const location = findCatalogItemLocation(targetItemId);

  if (!location) {
    return null;
  }

  if (isCatalogMobileViewport()) {
    mobileExpandedCatalogSectionId = location.section.id;
  } else {
    collapsedCatalogSections.delete(location.section.id);
  }

  if (location.section.id === "combinados") {
    selectedCombinadosCategoryId = location.category?.id || location.item.category || selectedCombinadosCategoryId;
    selectedCombinadosComboId = targetItemId;
  }

  return location;
};

const getCatalogTargetSelector = (itemId) => {
  const normalizedItemId = String(itemId || "").trim();

  if (!normalizedItemId) {
    return "";
  }

  const escapedItemId =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(normalizedItemId)
      : normalizedItemId.replace(/"/g, '\\"');

  return [
    `[data-item-chip][data-item-id="${escapedItemId}"]`,
    `[data-combinado-mobile-card="${escapedItemId}"]`,
    `[data-combinado-item-id="${escapedItemId}"]`,
  ].join(", ");
};

const scrollToCatalogTargetItem = () => {
  const targetItemId = getCatalogTargetItemId();
  const selector = getCatalogTargetSelector(targetItemId);

  if (!selector) {
    return;
  }

  window.setTimeout(() => {
    const target =
      document.querySelector(selector)?.closest(
        ".catalog-combinados-spotlight-card, .catalog-mobile-sheet-card, .catalog-combinados-mobile-card, .catalog-card, [data-item-chip], [data-combinado-item-id]"
      ) || document.querySelector(selector);

    if (!target) {
      return;
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    target.classList.add("is-catalog-target");

    window.setTimeout(() => {
      target.classList.remove("is-catalog-target");
    }, 1800);
  }, 180);
};

const getMobileCatalogGroups = (section) => {
  if (!section) {
    return [];
  }

  if (section.id === "combinados") {
    return getCombinadosCategories(section).map((category) => ({
      id: category.id,
      title: category.title,
      label: category.label,
      image: category.image,
      defaultAlt: category.alt || category.title,
      items: category.items,
      description:
        GROUP_COPY_SUMMARIES[category.label] ||
        category.items[0]?.description ||
        section.description,
      detail: `${category.items.length} combinado${category.items.length === 1 ? "" : "s"}`,
    }));
  }

  return groupCatalogItems(section);
};

const getMobileCatalogSheetContext = () => {
  const section = getCatalogSectionById(mobileCatalogSheetState.sectionId);

  if (!section) {
    return {
      section: null,
      groups: [],
      activeGroup: null,
      visibleItems: [],
    };
  }

  const groups = getMobileCatalogGroups(section);
  const activeGroup =
    groups.find((group) => group.id === mobileCatalogSheetState.groupId) || null;
  const visibleItems = activeGroup ? activeGroup.items : section.items;

  return {
    section,
    groups,
    activeGroup,
    visibleItems,
  };
};

const getMobileCatalogItemGroupLabel = (item) => formatGroupTitle(String(item?.category || "").trim());

const getMobileCatalogItemDescription = (section, item) => {
  const detail = String(item?.detail || "").trim();
  const description = String(item?.description || "").trim();
  const uniqueParts = [...new Set([detail, description].filter(Boolean))];

  if (uniqueParts.length > 0) {
    return uniqueParts.join(" | ");
  }

  if (section?.description) {
    return section.description;
  }

  return "";
};

const getMobileCatalogSheetFiltersMarkup = (section, groups, activeGroup) => {
  if (!section || groups.length <= 1) {
    return "";
  }

  return `
    <div class="catalog-mobile-sheet-filters" aria-label="Filtros da categoria ${section.title}">
      <button
        class="catalog-mobile-sheet-filter${activeGroup ? "" : " is-active"}"
        type="button"
        data-mobile-catalog-sheet-filter=""
        aria-pressed="${activeGroup ? "false" : "true"}"
      >
        Todos
      </button>
      ${groups
        .map(
          (group) => `
            <button
              class="catalog-mobile-sheet-filter${activeGroup?.id === group.id ? " is-active" : ""}"
              type="button"
              data-mobile-catalog-sheet-filter="${group.id}"
              aria-pressed="${activeGroup?.id === group.id ? "true" : "false"}"
            >
              ${escapeHtml(group.title)}
            </button>
          `
        )
        .join("")}
    </div>
  `;
};

const getMobileCatalogSheetItemsMarkup = (section, visibleItems, activeGroup) => {
  if (!section || visibleItems.length === 0) {
    return `
      <div class="empty-panel">
        <strong>Nenhum item encontrado.</strong>
        <span>Abra outra categoria para continuar montando o pedido.</span>
      </div>
    `;
  }

  return `
    <div class="catalog-mobile-sheet-grid" aria-label="Produtos de ${escapeHtml(
      activeGroup?.title || section.title
    )}">
      ${visibleItems
        .map((item) => {
          const groupLabel = getMobileCatalogItemGroupLabel(item);
          const showGroupLabel = !activeGroup || activeGroup.title !== groupLabel;
          const description = getMobileCatalogItemDescription(section, item);
          const isOrderable = isMenuItemOrderable(item);

          return `
            <article class="catalog-mobile-sheet-card${item.isPromoted ? " is-promoted" : ""}${!isOrderable ? " is-disabled" : ""}">
              <figure class="catalog-mobile-sheet-media">
                <img
                  src="${item.image}"
                  alt="${escapeHtml(item.name)}"
                  loading="lazy"
                  decoding="async"
                />
              </figure>
              <div class="catalog-mobile-sheet-body">
                <div class="catalog-mobile-sheet-head">
                  <div class="catalog-mobile-sheet-copy">
                    ${
                      showGroupLabel
                        ? `<span class="catalog-pill catalog-mobile-sheet-group">${escapeHtml(groupLabel)}</span>`
                        : ""
                    }
                    <h4>${escapeHtml(item.name)}</h4>
                    ${description ? `<p>${escapeHtml(description)}</p>` : ""}
                    ${getCatalogItemReviewMarkup(item, { mode: "sheet" })}
                  </div>
                  ${getCatalogItemPriceMarkup(item, {
                    tagName: "strong",
                    className: "catalog-mobile-sheet-price",
                  })}
                </div>

                <div class="catalog-mobile-sheet-actions">
                  <div
                    class="catalog-option catalog-option-preview catalog-mobile-sheet-purchase${item.isPromoted ? " is-promoted" : ""}${!isOrderable ? " is-disabled" : ""}"
                    data-item-chip
                    data-item-id="${item.id}"
                    data-item-name="${escapeHtml(item.name)}"
                    data-item-category="${escapeHtml(groupLabel)}"
                  >
                    <button
                      class="catalog-option-main catalog-mobile-sheet-cta"
                      type="button"
                      data-item-button
                      data-add-to-cart
                      aria-pressed="false"
                      aria-label="${escapeHtml(getCatalogItemActionLabel(item))}: ${escapeHtml(item.name)}"
                      ${isOrderable ? "" : "disabled"}
                    >
                      <span class="catalog-option-copy">
                        <span class="catalog-option-label">${escapeHtml(
                          getCatalogItemActionLabel(item, { short: true })
                        )}</span>
                        ${isOrderable ? '<span class="catalog-option-price">Toque para incluir</span>' : ""}
                        ${getCatalogItemStatusMarkup(item)}
                      </span>
                    </button>
                    <div class="catalog-option-controls" aria-label="Controle de quantidade">
                      <button
                        class="catalog-stepper"
                        type="button"
                        data-item-decrease
                        aria-label="Diminuir ${escapeHtml(item.name)}"
                      >
                        -
                      </button>
                      <span class="catalog-option-qty" data-item-qty></span>
                      <button
                        class="catalog-stepper"
                        type="button"
                        data-item-increase
                        aria-label="Aumentar ${escapeHtml(item.name)}"
                        ${isOrderable ? "" : "disabled"}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
};

const renderMobileCatalogSection = (section) => {
  const groups = getMobileCatalogGroups(section);

  return `
    <section class="catalog-block catalog-mobile-block" id="${section.id}">
      <button
        class="catalog-mobile-section-head reveal"
        type="button"
        data-mobile-catalog-section-open="${section.id}"
        aria-haspopup="dialog"
        aria-controls="mobile-catalog-sheet"
      >
        <div class="catalog-mobile-section-copy">
          <div>
            <p class="section-tag">${section.kicker}</p>
            <h3>${section.title}</h3>
          </div>
          <p>${section.description}</p>
        </div>
        <span class="catalog-mobile-section-cta">Ver produtos</span>
      </button>

      <div class="catalog-mobile-group-grid" aria-label="Subcategorias de ${section.title}">
        ${groups
          .map((group) => {
            const itemIds = group.items.map((item) => item.id).join(",");

            return `
              <button
                class="catalog-mobile-group-card reveal"
                type="button"
                data-mobile-catalog-group-card
                data-mobile-catalog-group-open="${section.id}"
                data-mobile-catalog-group-id="${group.id}"
                data-mobile-catalog-group-items="${itemIds}"
                aria-haspopup="dialog"
                aria-controls="mobile-catalog-sheet"
              >
                <figure class="catalog-mobile-group-media">
                  <img
                    src="${group.image}"
                    alt="${escapeHtml(group.defaultAlt || group.title)}"
                    loading="lazy"
                    decoding="async"
                  />
                </figure>
                <div class="catalog-mobile-group-copy">
                  <div class="catalog-mobile-group-copy-top">
                    <strong>${escapeHtml(group.title)}</strong>
                    <span class="catalog-badge" data-group-total data-group-items="${itemIds}">
                      ${EMPTY_GROUP_TOTAL_LABEL}
                    </span>
                  </div>
                  <span>${escapeHtml(group.description)}</span>
                  <div class="catalog-mobile-group-footer">
                    <span class="catalog-pill">${escapeHtml(group.detail)}</span>
                    <span class="catalog-mobile-group-cta">Abrir lista</span>
                  </div>
                </div>
              </button>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
};

const updateHeaderState = () => {
  if (!siteHeader) {
    return;
  }

  siteHeader.classList.toggle("is-scrolled", window.scrollY > 18);
};

const isCatalogMobileViewport = () => window.innerWidth <= MOBILE_CATALOG_BREAKPOINT;

const getCatalogViewportMode = () => (isCatalogMobileViewport() ? "mobile" : "desktop");

const isMobileNavigationViewport = () => window.innerWidth <= MOBILE_NAV_BREAKPOINT;

const getMobileNavigationToggle = () => document.querySelector("[data-nav-toggle]");

const setMobileNavigationOpen = (open) => {
  const shouldOpen = Boolean(open) && isMobileNavigationViewport();
  const toggle = getMobileNavigationToggle();

  document.body.classList.toggle("nav-open", shouldOpen);
  siteHeader?.classList.toggle("is-nav-open", shouldOpen);

  if (!toggle) {
    return;
  }

  toggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  toggle.setAttribute("aria-label", shouldOpen ? "Fechar menu" : "Abrir menu");
};

const closeMobileNavigation = () => {
  setMobileNavigationOpen(false);
};

const toggleMobileNavigation = () => {
  setMobileNavigationOpen(!document.body.classList.contains("nav-open"));
};

const setupMobileNavigation = () => {
  const nav = document.querySelector(".nav-links");
  const navActions = document.querySelector(".nav-actions");

  if (!nav || !navActions || getMobileNavigationToggle()) {
    return;
  }

  if (!nav.id) {
    nav.id = "site-navigation";
  }

  navActions.insertAdjacentHTML(
    "afterbegin",
    `
      <button
        class="nav-toggle"
        type="button"
        data-nav-toggle
        aria-controls="${nav.id}"
        aria-expanded="false"
        aria-label="Abrir menu"
      >
        <span class="nav-toggle-icon" aria-hidden="true"></span>
      </button>
    `
  );
};

const syncMobileNavigationState = () => {
  if (!isMobileNavigationViewport()) {
    closeMobileNavigation();
  }
};

const setupReveal = () => {
  const revealItems = document.querySelectorAll(".reveal:not([data-reveal-bound])");

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      {
        threshold: 0.16,
        rootMargin: "0px 0px -40px 0px",
      }
    );
  }

  revealItems.forEach((item) => {
    item.dataset.revealBound = "true";
    revealObserver.observe(item);
  });
};

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character] || character;
  });

const PT_BR_TEXT_REPLACEMENTS = [
  [/Voltar para a pagina inicial/g, "Voltar para a página inicial"],
  [/Navegacao principal/g, "Navegação principal"],
  [/Cada detalhe e pensado/g, "Cada detalhe é pensado"],
  [/Media atual das avaliacoes/g, "Média atual das avaliações"],
  [/Formulario de avaliacao/g, "Formulário de avaliação"],
  [/Seu calculo/g, "Seu cálculo"],
  [/Seus dados ficam salvos neste aparelho para facilitar o atendimento nas proximas compras\./g, "Seus dados ficam salvos neste aparelho para facilitar o atendimento nas próximas compras."],
  [/Seu atendimento e seus pedidos pelo WhatsApp agora podem sair com identificacao completa\./g, "Seu atendimento e seus pedidos pelo WhatsApp agora podem sair com identificação completa."],
  [/\bCardapio\b/g, "Cardápio"],
  [/\bcardapio\b/g, "cardápio"],
  [/\bHistorico\b/g, "Histórico"],
  [/\bhistorico\b/g, "histórico"],
  [/\bAvaliacao\b/g, "Avaliação"],
  [/\bavaliacao\b/g, "avaliação"],
  [/\bavaliacoes\b/g, "avaliações"],
  [/\bNavegacao\b/g, "Navegação"],
  [/\bnavegacao\b/g, "navegação"],
  [/\bExperiencia\b/g, "Experiência"],
  [/\bexperiencia\b/g, "experiência"],
  [/\bJapao\b/g, "Japão"],
  [/\bjapao\b/g, "japão"],
  [/\bjapones\b/g, "japonês"],
  [/\brapido\b/g, "rápido"],
  [/\brapidos\b/g, "rápidos"],
  [/\bagil\b/g, "ágil"],
  [/\bAgil\b/g, "Ágil"],
  [/\bcomentario\b/g, "comentário"],
  [/\bcomentarios\b/g, "comentários"],
  [/\bopiniao\b/g, "opinião"],
  [/\bvoce\b/g, "você"],
  [/\bVoce\b/g, "Você"],
  [/\bnao\b/g, "não"],
  [/\bNao\b/g, "Não"],
  [/\bsao\b/g, "são"],
  [/\bSao\b/g, "São"],
  [/\bpagina\b/g, "página"],
  [/\bPagina\b/g, "Página"],
  [/\bpaginas\b/g, "páginas"],
  [/\bultimos\b/g, "últimos"],
  [/\bUltimos\b/g, "Últimos"],
  [/\bultimas\b/g, "últimas"],
  [/\bUltimas\b/g, "Últimas"],
  [/\bultima\b/g, "última"],
  [/\bUltima\b/g, "Última"],
  [/\bopcao\b/g, "opção"],
  [/\bopcoes\b/g, "opções"],
  [/\binformacao\b/g, "informação"],
  [/\binformacoes\b/g, "informações"],
  [/\bnumero\b/g, "número"],
  [/\bNumeros\b/g, "Números"],
  [/\bendereco\b/g, "endereço"],
  [/\benderecos\b/g, "endereços"],
  [/\blocalizacao\b/g, "localização"],
  [/\bdistancia\b/g, "distância"],
  [/\bdistancias\b/g, "distâncias"],
  [/\bcomparacao\b/g, "comparação"],
  [/\bsimulacao\b/g, "simulação"],
  [/\bsimulacoes\b/g, "simulações"],
  [/\bconfirmacao\b/g, "confirmação"],
  [/\bcontratacao\b/g, "contratação"],
  [/\boperacao\b/g, "operação"],
  [/\bdisponivel\b/g, "disponível"],
  [/\bdisponiveis\b/g, "disponíveis"],
  [/\bpercepcao\b/g, "percepção"],
  [/\bformulario\b/g, "formulário"],
  [/\bpreco\b/g, "preço"],
  [/\bprecos\b/g, "preços"],
  [/\bporcao\b/g, "porção"],
  [/\bporcoes\b/g, "porções"],
  [/\breferencia\b/g, "referência"],
  [/\breferencias\b/g, "referências"],
  [/\bmaximo\b/g, "máximo"],
  [/\bprevio\b/g, "prévio"],
  [/\bprevia\b/g, "prévia"],
  [/\bfamilia\b/g, "família"],
  [/\brodizio\b/g, "rodízio"],
  [/\barea\b/g, "área"],
  [/\bareas\b/g, "áreas"],
  [/\bcamarao\b/g, "camarão"],
  [/\bcamaroes\b/g, "camarões"],
  [/\bsalmao\b/g, "salmão"],
  [/\blimao\b/g, "limão"],
  [/\brucula\b/g, "rúcula"],
  [/\bamendoas\b/g, "amêndoas"],
  [/\bbrocolis\b/g, "brócolis"],
  [/\bsuina\b/g, "suína"],
  [/\bfile\b/g, "filé"],
  [/Joe Flanbado/g, "Joe Flambado"],
  [/Hot Holl/g, "Hot Roll"],
  [/\bate\b/g, "até"],
  [/\bAte\b/g, "Até"],
  [/\bmedio\b/g, "médio"],
  [/\bmedia\b/g, "média"],
  [/\beconomica\b/g, "econômica"],
  [/\bintermediario\b/g, "intermediário"],
  [/\bintermediaria\b/g, "intermediária"],
  [/\bpratico\b/g, "prático"],
  [/\bunica\b/g, "única"],
  [/\bunico\b/g, "único"],
  [/\breune\b/g, "reúne"],
  [/\bvalida\b/g, "válida"],
  [/\bcodigo\b/g, "código"],
  [/\bcodigos\b/g, "códigos"],
];

PT_BR_TEXT_REPLACEMENTS.splice(
  0,
  PT_BR_TEXT_REPLACEMENTS.length,
  [/Voltar para a pagina inicial/g, "Voltar para a p\u00e1gina inicial"],
  [/Navegacao principal/g, "Navega\u00e7\u00e3o principal"],
  [/Cada detalhe e pensado/g, "Cada detalhe \u00e9 pensado"],
  [/Media atual das avaliacoes/g, "M\u00e9dia atual das avalia\u00e7\u00f5es"],
  [/Formulario de avaliacao/g, "Formul\u00e1rio de avalia\u00e7\u00e3o"],
  [/Seu calculo/g, "Seu c\u00e1lculo"],
  [/Seus dados ficam salvos neste aparelho para facilitar o atendimento nas proximas compras\./g, "Seus dados ficam salvos neste aparelho para facilitar o atendimento nas pr\u00f3ximas compras."],
  [/Seu atendimento e seus pedidos pelo WhatsApp agora podem sair com identificacao completa\./g, "Seu atendimento e seus pedidos pelo WhatsApp agora podem sair com identifica\u00e7\u00e3o completa."],
  [/Joe Flanbado/g, "Joe Flambado"],
  [/Hot Holl/g, "Hot Roll"],
  [/\bCardapio\b/g, "Card\u00e1pio"],
  [/\bcardapio\b/g, "card\u00e1pio"],
  [/\bHistorico\b/g, "Hist\u00f3rico"],
  [/\bhistorico\b/g, "hist\u00f3rico"],
  [/\bAvaliacao\b/g, "Avalia\u00e7\u00e3o"],
  [/\bavaliacao\b/g, "avalia\u00e7\u00e3o"],
  [/\bavaliacoes\b/g, "avalia\u00e7\u00f5es"],
  [/\bNavegacao\b/g, "Navega\u00e7\u00e3o"],
  [/\bnavegacao\b/g, "navega\u00e7\u00e3o"],
  [/\bExperiencia\b/g, "Experi\u00eancia"],
  [/\bexperiencia\b/g, "experi\u00eancia"],
  [/\bJapao\b/g, "Jap\u00e3o"],
  [/\bjapao\b/g, "jap\u00e3o"],
  [/\bjapones\b/g, "japon\u00eas"],
  [/\bcomentario\b/g, "coment\u00e1rio"],
  [/\bcomentarios\b/g, "coment\u00e1rios"],
  [/\bopiniao\b/g, "opini\u00e3o"],
  [/\bvoce\b/g, "voc\u00ea"],
  [/\bVoce\b/g, "Voc\u00ea"],
  [/\bnao\b/g, "n\u00e3o"],
  [/\bNao\b/g, "N\u00e3o"],
  [/\bsao\b/g, "s\u00e3o"],
  [/\bSao\b/g, "S\u00e3o"],
  [/\bja\b/g, "j\u00e1"],
  [/\bJa\b/g, "J\u00e1"],
  [/\bate\b/g, "at\u00e9"],
  [/\bAte\b/g, "At\u00e9"],
  [/\bpagina\b/g, "p\u00e1gina"],
  [/\bPagina\b/g, "P\u00e1gina"],
  [/\bpaginas\b/g, "p\u00e1ginas"],
  [/\bultimos\b/g, "\u00faltimos"],
  [/\bUltimos\b/g, "\u00daltimos"],
  [/\bultimas\b/g, "\u00faltimas"],
  [/\bUltimas\b/g, "\u00daltimas"],
  [/\bultima\b/g, "\u00faltima"],
  [/\bUltima\b/g, "\u00daltima"],
  [/\bopcao\b/g, "op\u00e7\u00e3o"],
  [/\bOpcao\b/g, "Op\u00e7\u00e3o"],
  [/\bopcoes\b/g, "op\u00e7\u00f5es"],
  [/\bOpcoes\b/g, "Op\u00e7\u00f5es"],
  [/\binformacao\b/g, "informa\u00e7\u00e3o"],
  [/\bInformacao\b/g, "Informa\u00e7\u00e3o"],
  [/\binformacoes\b/g, "informa\u00e7\u00f5es"],
  [/\bInformacoes\b/g, "Informa\u00e7\u00f5es"],
  [/\bnumero\b/g, "n\u00famero"],
  [/\bNumero\b/g, "N\u00famero"],
  [/\bendereco\b/g, "endere\u00e7o"],
  [/\bEndereco\b/g, "Endere\u00e7o"],
  [/\benderecos\b/g, "endere\u00e7os"],
  [/\bEnderecos\b/g, "Endere\u00e7os"],
  [/\blocalizacao\b/g, "localiza\u00e7\u00e3o"],
  [/\bLocalizacao\b/g, "Localiza\u00e7\u00e3o"],
  [/\bdistancia\b/g, "dist\u00e2ncia"],
  [/\bDistancia\b/g, "Dist\u00e2ncia"],
  [/\bdistancias\b/g, "dist\u00e2ncias"],
  [/\bcomparacao\b/g, "compara\u00e7\u00e3o"],
  [/\bComparacao\b/g, "Compara\u00e7\u00e3o"],
  [/\bsimulacao\b/g, "simula\u00e7\u00e3o"],
  [/\bSimulacao\b/g, "Simula\u00e7\u00e3o"],
  [/\bsimulacoes\b/g, "simula\u00e7\u00f5es"],
  [/\bSimulacoes\b/g, "Simula\u00e7\u00f5es"],
  [/\bconfirmacao\b/g, "confirma\u00e7\u00e3o"],
  [/\bConfirmacao\b/g, "Confirma\u00e7\u00e3o"],
  [/\bcontratacao\b/g, "contrata\u00e7\u00e3o"],
  [/\bContratacao\b/g, "Contrata\u00e7\u00e3o"],
  [/\boperacao\b/g, "opera\u00e7\u00e3o"],
  [/\bOperacao\b/g, "Opera\u00e7\u00e3o"],
  [/\bverificacao\b/g, "verifica\u00e7\u00e3o"],
  [/\bVerificacao\b/g, "Verifica\u00e7\u00e3o"],
  [/\bidentificacao\b/g, "identifica\u00e7\u00e3o"],
  [/\bautenticacao\b/g, "autentica\u00e7\u00e3o"],
  [/\bconexao\b/g, "conex\u00e3o"],
  [/\bpermissoes\b/g, "permiss\u00f5es"],
  [/\bdominio\b/g, "dom\u00ednio"],
  [/\bdominios\b/g, "dom\u00ednios"],
  [/\brestricoes\b/g, "restri\u00e7\u00f5es"],
  [/\bprecisao\b/g, "precis\u00e3o"],
  [/\bdisponivel\b/g, "dispon\u00edvel"],
  [/\bdisponiveis\b/g, "dispon\u00edveis"],
  [/\bpercepcao\b/g, "percep\u00e7\u00e3o"],
  [/\bformulario\b/g, "formul\u00e1rio"],
  [/\bFormulario\b/g, "Formul\u00e1rio"],
  [/\bpreco\b/g, "pre\u00e7o"],
  [/\bPreco\b/g, "Pre\u00e7o"],
  [/\bprecos\b/g, "pre\u00e7os"],
  [/\bporcao\b/g, "por\u00e7\u00e3o"],
  [/\bPorcao\b/g, "Por\u00e7\u00e3o"],
  [/\bporcoes\b/g, "por\u00e7\u00f5es"],
  [/\bPorcoes\b/g, "Por\u00e7\u00f5es"],
  [/\breferencia\b/g, "refer\u00eancia"],
  [/\bReferencia\b/g, "Refer\u00eancia"],
  [/\breferencias\b/g, "refer\u00eancias"],
  [/\bmaximo\b/g, "m\u00e1ximo"],
  [/\bprevio\b/g, "pr\u00e9vio"],
  [/\bprevia\b/g, "pr\u00e9via"],
  [/\bfamilia\b/g, "fam\u00edlia"],
  [/\bFamilia\b/g, "Fam\u00edlia"],
  [/\brodizio\b/g, "rod\u00edzio"],
  [/\bRodizio\b/g, "Rod\u00edzio"],
  [/\barea\b/g, "\u00e1rea"],
  [/\bArea\b/g, "\u00c1rea"],
  [/\bareas\b/g, "\u00e1reas"],
  [/\bcamarao\b/g, "camar\u00e3o"],
  [/\bcamaroes\b/g, "camar\u00f5es"],
  [/\bsalmao\b/g, "salm\u00e3o"],
  [/\blimao\b/g, "lim\u00e3o"],
  [/\brucula\b/g, "r\u00facula"],
  [/\bamendoas\b/g, "am\u00eandoas"],
  [/\bbrocolis\b/g, "br\u00f3colis"],
  [/\bsuina\b/g, "su\u00edna"],
  [/\bfile\b/g, "fil\u00e9"],
  [/\bcredito\b/g, "cr\u00e9dito"],
  [/\bCredito\b/g, "Cr\u00e9dito"],
  [/\bdebito\b/g, "d\u00e9bito"],
  [/\bDebito\b/g, "D\u00e9bito"],
  [/\bcurriculo\b/g, "curr\u00edculo"],
  [/\bportfolio\b/g, "portf\u00f3lio"],
  [/\brecepcao\b/g, "recep\u00e7\u00e3o"],
  [/\bpadrao\b/g, "padr\u00e3o"],
  [/\bfinalizacao\b/g, "finaliza\u00e7\u00e3o"],
  [/\bsolicitacao\b/g, "solicita\u00e7\u00e3o"],
  [/\bnecessario\b/g, "necess\u00e1rio"],
  [/\bnecessaria\b/g, "necess\u00e1ria"],
  [/\bproximas\b/g, "pr\u00f3ximas"],
  [/\bproxima\b/g, "pr\u00f3xima"],
  [/\bproximo\b/g, "pr\u00f3ximo"],
  [/\bdigitos\b/g, "d\u00edgitos"],
  [/\bvalida\b/g, "v\u00e1lida"],
  [/\bvalido\b/g, "v\u00e1lido"],
  [/\bmedio\b/g, "m\u00e9dio"],
  [/\bmedia\b/g, "m\u00e9dia"],
  [/\beconomica\b/g, "econ\u00f4mica"],
  [/\bintermediario\b/g, "intermedi\u00e1rio"],
  [/\bintermediaria\b/g, "intermedi\u00e1ria"],
  [/\bpratico\b/g, "pr\u00e1tico"],
  [/\bunica\b/g, "\u00fanica"],
  [/\bunico\b/g, "\u00fanico"],
  [/\breune\b/g, "re\u00fane"],
  [/\bcodigo\b/g, "c\u00f3digo"],
  [/\bCodigo\b/g, "C\u00f3digo"],
  [/\bcodigos\b/g, "c\u00f3digos"],
  [/\bcalculo\b/g, "c\u00e1lculo"],
  [/\bCalculo\b/g, "C\u00e1lculo"],
  [/\bculinaria\b/g, "culin\u00e1ria"],
  [/\brapido\b/g, "r\u00e1pido"],
  [/\bRapido\b/g, "R\u00e1pido"],
  [/\brapida\b/g, "r\u00e1pida"],
  [/\bRapida\b/g, "R\u00e1pida"],
  [/\brapidos\b/g, "r\u00e1pidos"],
  [/\bagil\b/g, "\u00e1gil"],
  [/\bAgil\b/g, "\u00c1gil"],
  [/\bconcluido\b/g, "conclu\u00eddo"],
  [/\baparecera\b/g, "aparecer\u00e1"]
);

const normalizePortugueseText = (value = "") =>
  PT_BR_TEXT_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => String(text).replace(pattern, replacement),
    String(value)
  );

const normalizeUiMetadata = () => {
  document.title = normalizePortugueseText(document.title);
  const descriptionMeta = document.querySelector('meta[name="description"]');

  if (descriptionMeta) {
    descriptionMeta.setAttribute(
      "content",
      normalizePortugueseText(descriptionMeta.getAttribute("content") || "")
    );
  }
};

const normalizeUiText = (root = document.body) => {
  if (!root) {
    return;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parentTag = node.parentElement?.tagName || "";
      const currentValue = String(node.nodeValue || "");

      if (parentTag === "SCRIPT" || parentTag === "STYLE" || parentTag === "TEXTAREA") {
        return NodeFilter.FILTER_REJECT;
      }

      if (!currentValue.trim() || shouldSkipPortugueseNormalization(currentValue)) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let currentNode = walker.nextNode();

  while (currentNode) {
    const normalizedText = normalizePortugueseText(currentNode.nodeValue);

    if (normalizedText !== currentNode.nodeValue) {
      currentNode.nodeValue = normalizedText;
    }

    currentNode = walker.nextNode();
  }

  if (typeof root.matches === "function") {
    normalizeElementAttributes(root);
  }

  root.querySelectorAll?.("*").forEach((element) => {
    normalizeElementAttributes(element);
  });
};

const refreshPortugueseUi = (root = document.body) => {
  normalizeUiMetadata();
  normalizeUiText(root);
};

const shouldSkipPortugueseNormalization = (value = "") =>
  /@|https?:\/\/|wa\.me\//i.test(String(value || ""));

const shouldNormalizePlaceholder = (value = "") => {
  const trimmedValue = String(value || "").trim();

  return Boolean(trimmedValue) && !shouldSkipPortugueseNormalization(trimmedValue);
};

const normalizeElementAttributes = (element) => {
  ["aria-label", "title", "alt", "placeholder"].forEach((attributeName) => {
    const currentValue = element.getAttribute(attributeName);

    if (!currentValue) {
      return;
    }

    if (attributeName === "placeholder" && !shouldNormalizePlaceholder(currentValue)) {
      return;
    }

    const normalizedValue = normalizePortugueseText(currentValue);

    if (normalizedValue !== currentValue) {
      element.setAttribute(attributeName, normalizedValue);
    }
  });
};

let portugueseUiRefreshFrame = 0;

const schedulePortugueseUiRefresh = (root = document.body) => {
  if (portugueseUiRefreshFrame) {
    return;
  }

  portugueseUiRefreshFrame = window.requestAnimationFrame(() => {
    portugueseUiRefreshFrame = 0;
    refreshPortugueseUi(root);
  });
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const normalizePhone = (value) => String(value || "").replace(/\D/g, "").slice(0, 11);

const formatPhoneDisplay = (value) => {
  const digits = normalizePhone(value);

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return digits;
};

const normalizeCep = (value) => String(value || "").replace(/\D/g, "").slice(0, 8);

const formatCepDisplay = (value) => {
  const digits = normalizeCep(value);

  if (digits.length <= 5) {
    return digits;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

const formatDateTime = (value) => {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
};

const loadStoredCollection = (storageKey) => {
  try {
    const parsed = JSON.parse(getStoredString(storageKey, "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const saveStoredCollection = (storageKey, items) => {
  setStoredString(storageKey, JSON.stringify(items));
};

collapsedCatalogSections = new Set(
  loadStoredCollection(CATALOG_COLLAPSED_SECTIONS_STORAGE_KEY).filter(
    (sectionId) => typeof sectionId === "string" && sectionId.trim()
  )
);
normalizeMenuSectionDisplayOrder();
normalizeCollapsedCatalogSections();

const normalizeCartAddonQuantity = (value, fallback = 0) => {
  const quantity = Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback;
  return Math.max(0, quantity);
};

const getDefaultCartAddons = () =>
  CART_REQUIRED_ADDONS.map((addon) => ({
    ...addon,
    quantity: addon.defaultQuantity,
  }));

const normalizeCartAddons = (storedAddons) => {
  const quantitiesById = new Map(
    (Array.isArray(storedAddons) ? storedAddons : [])
      .map((addon) => [String(addon?.id || ""), normalizeCartAddonQuantity(addon?.quantity)])
      .filter(([id]) => id)
  );

  return CART_REQUIRED_ADDONS.map((addon) => ({
    ...addon,
    quantity: quantitiesById.has(addon.id)
      ? quantitiesById.get(addon.id)
      : addon.defaultQuantity,
  }));
};

const loadCartAddons = () => normalizeCartAddons(loadStoredCollection(CART_ADDONS_STORAGE_KEY));

const saveCartAddons = (addons) => {
  saveStoredCollection(
    CART_ADDONS_STORAGE_KEY,
    addons.map((addon) => ({
      id: addon.id,
      quantity: normalizeCartAddonQuantity(addon.quantity),
    }))
  );
};

const resetCartAddons = () => {
  saveCartAddons(getDefaultCartAddons());
};

const normalizeCartCheckoutSelection = (value, allowedValues = []) => {
  const normalizedValue = String(value || "").trim().toLowerCase();
  return allowedValues.includes(normalizedValue) ? normalizedValue : "";
};

const normalizeCartDeliveryAddress = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeCartCashChangeSelection = (value) =>
  normalizeCartCheckoutSelection(value, ["yes", "no"]);

const normalizeCartOrderTimingSelection = (value) =>
  normalizeCartCheckoutSelection(
    value,
    CART_ORDER_TIMING_OPTIONS.map((option) => option.id)
  );

const normalizeCartScheduleDate = (value) => {
  const normalizedValue = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalizedValue) ? normalizedValue : "";
};

const normalizeCartScheduleTime = (value) => {
  const normalizedValue = String(value || "").trim();
  return /^\d{2}:\d{2}$/.test(normalizedValue) ? normalizedValue : "";
};

const normalizeCurrencyInput = (value) =>
  String(value || "")
    .replace(/[^\d,.-]/g, "")
    .slice(0, 18);

const parseCurrencyAmount = (value) => {
  let normalizedValue = normalizeCurrencyInput(value);

  if (!/\d/.test(normalizedValue)) {
    return null;
  }

  const hasComma = normalizedValue.includes(",");
  const hasDot = normalizedValue.includes(".");

  if (hasComma && hasDot) {
    if (normalizedValue.lastIndexOf(",") > normalizedValue.lastIndexOf(".")) {
      normalizedValue = normalizedValue.replace(/\./g, "").replace(",", ".");
    } else {
      normalizedValue = normalizedValue.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalizedValue = normalizedValue.replace(/\./g, "").replace(",", ".");
  } else {
    normalizedValue = normalizedValue.replace(/,/g, "");
  }

  const amount = Number(normalizedValue);
  return Number.isFinite(amount) && amount >= 0 ? Number(amount.toFixed(2)) : null;
};

const getStoreOperatingContext = (now = new Date()) => {
  const structuredContext = getPublicBusinessScheduleStatus(now);

  if (structuredContext) {
    return structuredContext;
  }

  const context = STORE_HOURS_API?.getCurrentContext?.(now) || {
    isOpen: true,
    acceptsImmediateOrders: true,
    statusTone: "open",
    statusLabel: "Loja aberta",
    shortStatusLabel: "Aberta agora",
    businessWindowLabel: "18:00 as 23:00",
    nowDateValue: "",
    nowTimeValue: "",
    nextOpeningDateValue: "",
    nextOpeningTimeValue: "",
    nextOpeningLabel: "18:00",
    detail: "Pedidos imediatos liberados ate 23:00.",
  };

  return {
    ...context,
    businessWindowLabel: getPublicBusinessHoursLabel(context.businessWindowLabel),
  };
};

const getStoreDefaultSchedule = (now = new Date()) =>
  getPublicBusinessScheduleDefaultSchedule(now) ||
  STORE_HOURS_API?.getDefaultSchedule?.(now) || {
    dateValue: "",
    timeValue: "",
  };

const getStoreScheduleConstraints = (selectedDate = "", now = new Date()) =>
  getPublicBusinessScheduleConstraints(selectedDate, now) ||
  STORE_HOURS_API?.getScheduleConstraints?.(selectedDate, now) || {
    minDate: "",
    timeMin: "18:00",
    timeMax: "23:00",
    stepSeconds: 300,
    defaultDate: "",
    defaultTime: "",
    selectedDateAvailable: true,
  };

const validateStoreScheduledOrder = (schedule, now = new Date()) =>
  validatePublicBusinessScheduleOrder(schedule, now) ||
  STORE_HOURS_API?.validateSchedule?.(schedule, now) || {
    isValid: Boolean(schedule?.dateValue && schedule?.timeValue),
    reason: schedule?.dateValue && schedule?.timeValue ? "" : "missing_time",
  };

const formatStoreScheduleLabel = (dateValue, timeValue, now = new Date()) =>
  STORE_HOURS_API?.formatScheduleLabel?.(dateValue, timeValue, now) ||
  [dateValue, timeValue].filter(Boolean).join(" ");

const getCartOrderTimingLabel = (id) =>
  CART_ORDER_TIMING_OPTIONS.find((option) => option.id === id)?.label || "";

const resolveCartScheduleFields = (
  {
    timingMode = "",
    scheduledDate = "",
    scheduledTime = "",
  } = {},
  now = new Date()
) => {
  if (timingMode !== "scheduled") {
    return {
      scheduledDate: "",
      scheduledTime: "",
    };
  }

  const defaultSchedule = getStoreDefaultSchedule(now);
  const normalizedDate = normalizeCartScheduleDate(scheduledDate) || defaultSchedule.dateValue || "";
  const normalizedTime = normalizeCartScheduleTime(scheduledTime) || defaultSchedule.timeValue || "";
  const constraints = getStoreScheduleConstraints(normalizedDate, now);
  const effectiveDate = constraints.selectedDateAvailable ? normalizedDate : constraints.defaultDate;
  const effectiveTime =
    normalizeCartScheduleTime(normalizedTime) ||
    constraints.defaultTime ||
    defaultSchedule.timeValue ||
    "";
  const validatedSchedule = validateStoreScheduledOrder(
    {
      dateValue: effectiveDate,
      timeValue: effectiveTime,
    },
    now
  );

  if (validatedSchedule.isValid) {
    return {
      scheduledDate: effectiveDate,
      scheduledTime: effectiveTime,
    };
  }

  return {
    scheduledDate: constraints.defaultDate || effectiveDate || "",
    scheduledTime: constraints.defaultTime || effectiveTime || "",
  };
};

const getCartScheduledOrderSummary = (checkout, now = new Date()) => {
  if (checkout.timingMode !== "scheduled" || !checkout.scheduledDate || !checkout.scheduledTime) {
    return "";
  }

  return `Pedido agendado para ${formatStoreScheduleLabel(
    checkout.scheduledDate,
    checkout.scheduledTime,
    now
  )}.`;
};

const normalizeCartCheckout = (storedCheckout = {}) => {
  const paymentMethod = normalizeCartCheckoutSelection(
    storedCheckout?.paymentMethod,
    CART_PAYMENT_METHODS.map((method) => method.id)
  );
  const fulfillmentMode = normalizeCartCheckoutSelection(
    storedCheckout?.fulfillmentMode,
    CART_FULFILLMENT_OPTIONS.map((option) => option.id)
  );
  const deliveryAddress = normalizeCartDeliveryAddress(
    storedCheckout?.deliveryAddress
  );
  const cashChangeRequired =
    paymentMethod === "dinheiro"
      ? normalizeCartCashChangeSelection(storedCheckout?.cashChangeRequired)
      : "";
  const cashAmountProvided =
    paymentMethod === "dinheiro" && cashChangeRequired === "yes"
      ? normalizeCurrencyInput(storedCheckout?.cashAmountProvided)
      : "";
  const storeContext = getStoreOperatingContext();
  let timingMode = normalizeCartOrderTimingSelection(storedCheckout?.timingMode);

  if (!timingMode) {
    timingMode = storeContext.acceptsImmediateOrders ? "immediate" : "scheduled";
  }

  if (!storeContext.acceptsImmediateOrders && timingMode === "immediate") {
    timingMode = "scheduled";
  }

  const scheduleFields = resolveCartScheduleFields(
    {
      timingMode,
      scheduledDate: storedCheckout?.scheduledDate,
      scheduledTime: storedCheckout?.scheduledTime,
    },
    new Date()
  );

  return {
    paymentMethod,
    fulfillmentMode,
    deliveryAddress,
    cashChangeRequired,
    cashAmountProvided,
    timingMode,
    scheduledDate: scheduleFields.scheduledDate,
    scheduledTime: scheduleFields.scheduledTime,
    customerNotes: String(storedCheckout?.customerNotes || "").trim().slice(0, 280),
  };
};

const loadCartCheckout = () => {
  try {
    const parsed = JSON.parse(getStoredString(CART_CHECKOUT_STORAGE_KEY, "{}"));
    return normalizeCartCheckout(parsed && typeof parsed === "object" ? parsed : {});
  } catch (error) {
    return normalizeCartCheckout();
  }
};

const saveCartCheckout = (checkout) => {
  setStoredString(CART_CHECKOUT_STORAGE_KEY, JSON.stringify(normalizeCartCheckout(checkout)));
};

const getCartPaymentMethodLabel = (id) =>
  CART_PAYMENT_METHODS.find((method) => method.id === id)?.label || "";

const getCartFulfillmentLabel = (id) =>
  CART_FULFILLMENT_OPTIONS.find((option) => option.id === id)?.label || "";

const getPickupEstimateText = () =>
  getDeliverySettings().pickup?.message ||
  `Retirada prevista em ate ${getPublicAveragePreparationMinutes()} minutos, conforme o prazo mostrado no site.`;

const isManualDeliveryQuote = (quote) => Boolean(quote?.isManualEstimate);

const getDeliveryQuoteFeeText = (quote) => {
  if (!quote) {
    return "";
  }

  if (quote.freeShippingApplied) {
    return "Gratis";
  }

  const feeText = formatPrice(Number(quote.fee || 0));
  return isManualDeliveryQuote(quote) ? `${feeText} minimo` : feeText;
};

const getCartGrandTotalAmount = (
  cart,
  addons = loadCartAddons(),
  checkout = loadCartCheckout(),
  profile = loadAuthProfile(),
  deliveryQuote = getLatestSavedDeliveryQuote(profile)
) => {
  const baseTotal = getCartTotalAmount(cart, addons);

  if (typeof baseTotal !== "number") {
    return null;
  }

  if (checkout.fulfillmentMode === "delivery" && !deliveryQuote) {
    return null;
  }

  const deliveryFee =
    checkout.fulfillmentMode === "delivery" ? Number(deliveryQuote?.fee || 0) : 0;

  return Number((baseTotal + deliveryFee).toFixed(2));
};

const getCartCashChangeDetails = ({
  cart,
  addons = loadCartAddons(),
  checkout = loadCartCheckout(),
  profile = loadAuthProfile(),
  deliveryQuote = getLatestSavedDeliveryQuote(profile),
} = {}) => {
  const totalAmount = getCartGrandTotalAmount(cart, addons, checkout, profile, deliveryQuote);
  const amountProvided = parseCurrencyAmount(checkout.cashAmountProvided);
  const changeAmount =
    typeof totalAmount === "number" && typeof amountProvided === "number"
      ? Number(Math.max(0, amountProvided - totalAmount).toFixed(2))
      : null;
  const hasEnoughAmount =
    typeof totalAmount === "number" &&
    typeof amountProvided === "number" &&
    amountProvided >= totalAmount;

  return {
    totalAmount,
    amountProvided,
    changeAmount,
    hasEnoughAmount,
    needsAnswer:
      checkout.paymentMethod === "dinheiro" &&
      !["yes", "no"].includes(checkout.cashChangeRequired),
    needsAmount:
      checkout.paymentMethod === "dinheiro" &&
      checkout.cashChangeRequired === "yes" &&
      typeof amountProvided !== "number",
  };
};

const formatDeliveryMinutesLabel = (minutes) => `${Math.max(0, Math.round(minutes || 0))} min`;

const calculateEstimatedDeliveryTravelMinutes = (distanceKm) => {
  const safeDistanceKm = Math.max(0, Number(distanceKm) || 0);
  const adjustedRouteDistanceKm = safeDistanceKm * DELIVERY_ROUTE_STRETCH_FACTOR;
  const estimatedMinutes = Math.round((adjustedRouteDistanceKm / DELIVERY_AVERAGE_SPEED_KMH) * 60);

  return Math.max(DELIVERY_MIN_TRAVEL_TIME_MINUTES, estimatedMinutes);
};

const getDeliveryQuoteSummaryText = (quote) => {
  if (!quote) {
    return "";
  }

  if (isManualDeliveryQuote(quote)) {
    return [
      quote.routeBand || DELIVERY_MANUAL_ROUTE_BAND,
      getDeliveryQuoteFeeText(quote),
      quote.totalEstimateText || DELIVERY_MANUAL_TIME_TEXT,
    ]
      .filter(Boolean)
      .join(" | ");
  }

  return [
    quote.distanceText || "Distancia calculada",
    quote.routeBand,
    getDeliveryQuoteFeeText(quote),
    quote.totalEstimateText || "Prazo aproximado",
  ]
    .filter(Boolean)
    .join(" | ");
};

const getScheduledOrderValidationMessage = (reason, storeContext) => {
  if (reason === "missing_date") {
    return "Escolha a data para agendar o pedido.";
  }

  if (reason === "missing_time") {
    return "Escolha o horario do agendamento.";
  }

  if (reason === "invalid_time") {
    return "Informe um horario valido para o agendamento.";
  }

  if (reason === "outside_window") {
    return `O agendamento so aceita horarios entre ${storeContext.businessWindowLabel}.`;
  }

  if (reason === "closed_day") {
    return "Esse dia esta marcado como fechado. Escolha outro dia de atendimento.";
  }

  if (reason === "pause") {
    return `Esse horario cai em uma pausa de atendimento. Escolha outro horario dentro de ${storeContext.businessWindowLabel}.`;
  }

  if (reason === "past") {
    return `Escolha um horario futuro dentro do funcionamento diario (${storeContext.businessWindowLabel}).`;
  }

  return "Revise a data e o horario do agendamento para continuar.";
};

const getImmediateOrderUnavailableMessage = (storeContext) =>
  storeContext.warningMessage ||
  `Loja fechada agora. Agende seu pedido entre ${storeContext.businessWindowLabel}. Proxima abertura: ${storeContext.nextOpeningLabel}.`;

const getCartCheckoutValidation = (
  cart,
  addons = loadCartAddons(),
  checkout,
  profile = loadAuthProfile(),
  deliveryQuote = getLatestSavedDeliveryQuote(profile)
) => {
  const storeContext = getStoreOperatingContext();

  if (cart.length === 0) {
    return {
      isValid: false,
      tone: "neutral",
      message: "Adicione itens do cardapio para liberar a finalizacao do pedido.",
    };
  }

  if (!checkout.paymentMethod) {
    return {
      isValid: false,
      tone: "warning",
      message: "Escolha a forma de pagamento antes de finalizar.",
    };
  }

  if (!checkout.fulfillmentMode) {
    return {
      isValid: false,
      tone: "warning",
      message: "Escolha se o pedido sera retirada ou entrega antes de finalizar.",
    };
  }

  if (checkout.fulfillmentMode === "delivery") {
    const deliveryAvailability = getFulfillmentOptionAvailability("delivery");

    if (!deliveryAvailability.available) {
      return {
        isValid: false,
        tone: "warning",
        message: deliveryAvailability.message || "Entrega indisponivel no momento.",
      };
    }
  }

  if (checkout.fulfillmentMode === "pickup") {
    const pickupAvailability = getFulfillmentOptionAvailability("pickup");

    if (!pickupAvailability.available) {
      return {
        isValid: false,
        tone: "warning",
        message: pickupAvailability.message || "Retirada indisponivel no momento.",
      };
    }
  }

  if (!checkout.timingMode) {
    return {
      isValid: false,
      tone: "warning",
      message: storeContext.acceptsImmediateOrders
        ? "Escolha se o pedido sera imediato ou agendado."
        : `A loja esta fechada agora. Agende um horario entre ${storeContext.businessWindowLabel}.`,
    };
  }

  if (checkout.timingMode === "immediate" && !storeContext.acceptsImmediateOrders) {
    return {
      isValid: false,
      tone: "warning",
      message: getImmediateOrderUnavailableMessage(storeContext),
    };
  }

  if (checkout.timingMode === "scheduled") {
    const scheduleValidation = validateStoreScheduledOrder({
      dateValue: checkout.scheduledDate,
      timeValue: checkout.scheduledTime,
    });

    if (!scheduleValidation.isValid) {
      return {
        isValid: false,
        tone: "warning",
        message: getScheduledOrderValidationMessage(scheduleValidation.reason, storeContext),
      };
    }
  }

  if (checkout.fulfillmentMode === "delivery") {
    if (!deliveryQuote) {
      return {
        isValid: false,
        tone: "warning",
        message: profile
          ? "Calcule a entrega na aba Entrega para salvar os dados nesta conta antes de finalizar."
          : "Abra a aba Entrega para calcular a taxa e salvar os dados da entrega antes de finalizar.",
      };
    }

    if (deliveryQuote.deliveryUnavailableMessage) {
      return {
        isValid: false,
        tone: "warning",
        message: deliveryQuote.deliveryUnavailableMessage,
      };
    }

    if (deliveryQuote.isMinimumOrderMet === false) {
      return {
        isValid: false,
        tone: "warning",
        message:
          deliveryQuote.minimumOrderMessage ||
          "O pedido ainda nao atingiu o minimo da faixa de entrega.",
      };
    }
  }

  if (checkout.paymentMethod === "dinheiro") {
    const cashDetails = getCartCashChangeDetails({
      cart,
      addons,
      checkout,
      profile,
      deliveryQuote,
    });

    if (cashDetails.needsAnswer) {
      return {
        isValid: false,
        tone: "warning",
        message: "Informe se precisa de troco para pagamento em dinheiro.",
      };
    }

    if (checkout.cashChangeRequired === "yes" && cashDetails.totalAmount === null) {
      return {
        isValid: false,
        tone: "warning",
        message: "Nao foi possivel calcular o troco porque o total do pedido ainda nao esta fechado.",
      };
    }

    if (cashDetails.needsAmount) {
      return {
        isValid: false,
        tone: "warning",
        message: "Informe o valor em dinheiro para calcular o troco.",
      };
    }

    if (checkout.cashChangeRequired === "yes" && !cashDetails.hasEnoughAmount) {
      return {
        isValid: false,
        tone: "warning",
        message:
          typeof cashDetails.totalAmount === "number"
            ? `O valor informado precisa ser igual ou maior que ${formatPrice(cashDetails.totalAmount)}.`
            : "O valor informado em dinheiro precisa cobrir o total do pedido.",
      };
    }
  }

  if (checkout.fulfillmentMode === "delivery") {
    if (isManualDeliveryQuote(deliveryQuote)) {
      return {
        isValid: true,
        tone: "success",
        message:
          checkout.timingMode === "scheduled"
            ? `${getCartScheduledOrderSummary(checkout)} Entrega salva em modo provisorio: ${getDeliveryQuoteSummaryText(
                deliveryQuote
              )}. A taxa final sera confirmada no atendimento.`
            : `Entrega salva em modo provisorio: ${getDeliveryQuoteSummaryText(
                deliveryQuote
              )}. A taxa final sera confirmada no atendimento.`,
      };
    }

    return {
      isValid: true,
      tone: "success",
      message:
        checkout.timingMode === "scheduled"
          ? `${getCartScheduledOrderSummary(checkout)} Entrega pronta: ${getDeliveryQuoteSummaryText(
              deliveryQuote
            )}.`
          : `Entrega pronta: ${getDeliveryQuoteSummaryText(deliveryQuote)}.`,
    };
  }

  return {
    isValid: true,
    tone: "success",
    message:
      checkout.timingMode === "scheduled"
        ? `${getCartScheduledOrderSummary(checkout)} Retirada dentro do horario de funcionamento.`
        : getPickupEstimateText(),
  };
};

const setCartCheckoutExpanded = (expanded) => {
  cartUiState.checkoutExpanded = Boolean(expanded);

  const shell = document.querySelector("[data-cart-checkout-shell]");
  const panel = document.querySelector("[data-cart-checkout-panel]");
  const toggle = document.querySelector("[data-cart-checkout-toggle]");
  const icon = document.querySelector("[data-cart-checkout-icon]");

  if (shell) {
    shell.classList.toggle("is-expanded", cartUiState.checkoutExpanded);
  }

  if (panel) {
    panel.hidden = !cartUiState.checkoutExpanded;
  }

  if (toggle) {
    toggle.setAttribute("aria-expanded", String(cartUiState.checkoutExpanded));
  }

  if (icon) {
    icon.textContent = cartUiState.checkoutExpanded ? "-" : "+";
  }
};

const getCartCheckoutToggleStatus = ({ cart, checkout, validation }) => {
  if (cart.length === 0) {
    return "Adicione itens primeiro";
  }

  if (cartUiState.checkoutExpanded) {
    return "Toque para ocultar";
  }

  if (validation.isValid) {
    const selectedParts = [
      getCartPaymentMethodLabel(checkout.paymentMethod),
      getCartFulfillmentLabel(checkout.fulfillmentMode),
      getCartOrderTimingLabel(checkout.timingMode),
    ].filter(Boolean);

    return selectedParts.length ? selectedParts.join(" | ") : "Pronto para finalizar";
  }

  if (!checkout.paymentMethod && !checkout.fulfillmentMode && !checkout.timingMode) {
    return "Toque para preencher";
  }

  if (!checkout.paymentMethod || !checkout.fulfillmentMode || !checkout.timingMode) {
    return "Faltam escolhas";
  }

  if (checkout.timingMode === "scheduled") {
    return "Confirme o agendamento";
  }

  if (checkout.fulfillmentMode === "delivery") {
    return "Confirme a entrega";
  }

  return "Revise para finalizar";
};

const syncCartCheckoutDock = ({
  cart = loadCart(),
  addons = loadCartAddons(),
  checkout = loadCartCheckout(),
  validation = getCartCheckoutValidation(cart, addons, checkout),
} = {}) => {
  const shell = document.querySelector("[data-cart-checkout-shell]");
  const toggle = document.querySelector("[data-cart-checkout-toggle]");
  const status = document.querySelector("[data-cart-checkout-status]");

  if (!shell || !toggle || !status) {
    return;
  }

  if (cart.length === 0 && cartUiState.checkoutExpanded) {
    setCartCheckoutExpanded(false);
  } else {
    setCartCheckoutExpanded(cartUiState.checkoutExpanded);
  }

  shell.classList.toggle("is-complete", validation.isValid);
  toggle.classList.toggle("is-complete", validation.isValid);
  toggle.disabled = cart.length === 0;
  status.textContent = getCartCheckoutToggleStatus({ cart, checkout, validation });
};

const openCartCheckoutPanel = () => {
  setCartCheckoutExpanded(true);
  syncCartCheckoutDock();

  window.setTimeout(() => {
    const firstField = document.querySelector(
      "[data-cart-checkout-panel] input:not([disabled]), [data-cart-checkout-panel] a.button"
    );

    firstField?.focus();
  }, 30);
};

const getCartAddonChargeQuantity = (addon) => Math.max(0, addon.quantity - addon.freeUnits);

const getCartAddonTotal = (addon) =>
  Number((getCartAddonChargeQuantity(addon) * addon.unitPrice).toFixed(2));

const getCartAddonsTotalAmount = (addons) =>
  Number(
    addons.reduce((sum, addon) => sum + getCartAddonTotal(addon), 0).toFixed(2)
  );

const getSelectedCartAddons = (addons) => addons.filter((addon) => addon.quantity > 0);

const formatCartAddonMeta = (addon) => {
  const chargedQuantity = getCartAddonChargeQuantity(addon);
  const selectedLabel =
    addon.quantity === 0
      ? "Nenhum selecionado"
      : `${addon.quantity} selecionado${addon.quantity === 1 ? "" : "s"}`;
  const freeApplied = Math.min(addon.quantity, addon.freeUnits);

  if (addon.freeUnits > 0) {
    if (chargedQuantity === 0) {
      return freeApplied > 0 ? `${selectedLabel} | gratis` : selectedLabel;
    }

    return `${selectedLabel} | ${chargedQuantity} cobrado${
      chargedQuantity === 1 ? "" : "s"
    }`;
  }

  return selectedLabel;
};

const getCartAddonRuleText = (addon) => {
  if (addon.freeUnits > 0) {
    return `${addon.freeUnits} gratis, depois ${formatPrice(addon.unitPrice)}/unid`;
  }

  return `${formatPrice(addon.unitPrice)}/unid`;
};

const formatCartAddonWhatsappLine = (addon) => {
  const chargedQuantity = getCartAddonChargeQuantity(addon);
  const subtotal = getCartAddonTotal(addon);

  if (addon.freeUnits > 0) {
    if (chargedQuantity === 0) {
      return `${addon.quantity}x ${addon.name} - gratis`;
    }

    return `${addon.quantity}x ${addon.name} - ${addon.freeUnits} gratis + ${chargedQuantity} cobrado${
      chargedQuantity === 1 ? "" : "s"
    } (${formatPrice(subtotal)})`;
  }

  return `${addon.quantity}x ${addon.name} - ${formatPrice(subtotal)}`;
};

const getCompactCartAddons = (addons) =>
  getSelectedCartAddons(addons).map((addon) => ({
    id: `addon-${addon.id}`,
    name: addon.name,
    category: "Complemento do pedido",
    quantity: addon.quantity,
    price: getCartAddonTotal(addon),
  }));

const getCartAddonSummaryMeta = (addon) => {
  const chargedQuantity = getCartAddonChargeQuantity(addon);

  if (addon.freeUnits > 0) {
    const freeApplied = Math.min(addon.quantity, addon.freeUnits);

    if (chargedQuantity === 0) {
      return freeApplied > 0 ? `${freeApplied} gratis` : `${addon.quantity}x`;
    }

    return `${freeApplied} gratis | ${chargedQuantity} cobrado${chargedQuantity === 1 ? "" : "s"}`;
  }

  return `${addon.quantity} unidade${addon.quantity === 1 ? "" : "s"}`;
};

const getCartAddonsSummaryMarkup = (addons) => {
  const selectedAddons = getSelectedCartAddons(addons);

  if (selectedAddons.length === 0) {
    return "";
  }

  return `
    <section class="cart-addons-summary" aria-label="Complementos selecionados">
      <div class="cart-addons-summary-head">
        <strong>Complementos</strong>
        <span class="cart-addons-summary-total">${formatPrice(
          getCartAddonsTotalAmount(selectedAddons)
        )}</span>
      </div>
      <ul class="cart-addons-summary-list">
        ${selectedAddons
          .map(
            (addon) => `
              <li class="cart-addons-summary-item">
                <div class="cart-addons-summary-copy">
                  <span class="cart-addons-summary-name">${addon.quantity}x ${addon.name}</span>
                  <span class="cart-addons-summary-meta">${getCartAddonSummaryMeta(addon)}</span>
                </div>
                <span class="cart-addons-summary-price">${
                  getCartAddonTotal(addon) > 0 ? formatPrice(getCartAddonTotal(addon)) : "gratis"
                }</span>
              </li>
            `
          )
          .join("")}
      </ul>
    </section>
  `;
};

const getProfileStorageKey = (profile) =>
  normalizePhone(profile?.phone) || normalizeEmail(profile?.email) || String(profile?.id || "");

const buildCustomerSessionKey = (profile) => {
  const normalizedPhone = normalizePhone(profile?.phone);
  const normalizedEmail = normalizeEmail(profile?.email);
  const normalizedProfileId = String(profile?.id || "").trim();

  if (normalizedPhone) {
    return `phone:${normalizedPhone}`;
  }

  if (normalizedEmail) {
    return `email:${normalizedEmail}`;
  }

  return normalizedProfileId ? `profile:${normalizedProfileId}` : "";
};

const setResultCardState = (node, state) => {
  if (!node) {
    return;
  }

  node.classList.remove("is-success", "is-error");

  if (state === "success") {
    node.classList.add("is-success");
  }

  if (state === "error") {
    node.classList.add("is-error");
  }
};

const buildRatingStars = (rating) => {
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  return `${"&#9733;".repeat(safeRating)}${"&#9734;".repeat(5 - safeRating)}`;
};

const normalizePublicReviewText = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const getPublicReviewCount = () => {
  const summaryCount = Number(reviewPageState.summary?.publicReviewCount);

  if (Number.isFinite(summaryCount) && summaryCount >= 0) {
    return summaryCount;
  }

  return Array.isArray(reviewPageState.reviews) ? reviewPageState.reviews.length : 0;
};

const formatPublicReviewCountLabel = (count) =>
  `${count} avaliac${count === 1 ? "ao publicada" : "oes publicadas"}`;

const getPublicReviewAverageLabel = () => {
  const average = Number(reviewPageState.summary?.displayAverage || 0);

  if (!Number.isFinite(average) || average <= 0 || getPublicReviewCount() <= 0) {
    return "Sem avaliacoes";
  }

  return `${average.toFixed(1)} \u2605`;
};

const getPublicReviewCountLabel = () =>
  reviewPageState.summary?.publicCountLabel || formatPublicReviewCountLabel(getPublicReviewCount());

const getPublicReviews = () =>
  (Array.isArray(reviewPageState.reviews) ? reviewPageState.reviews : []).filter(
    (review) => review && typeof review === "object" && normalizePublicReviewText(review.message)
  );

const getPublicReviewerName = (name = "") => {
  const parts = normalizePublicReviewText(name).split(" ").filter(Boolean);

  if (parts.length === 0) {
    return "Cliente";
  }

  if (parts.length === 1) {
    return parts[0];
  }

  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
};

const getPublicReviewerInitial = (name = "") =>
  (getPublicReviewerName(name).match(/[A-Za-zÀ-ÿ0-9]/)?.[0] || "T").toUpperCase();

const getShortPublicReviewMessage = (message = "", maxLength = PUBLIC_REVIEW_SHORT_COMMENT_LENGTH) => {
  const normalizedMessage = normalizePublicReviewText(message);

  if (normalizedMessage.length <= maxLength) {
    return normalizedMessage;
  }

  const compactMessage = normalizedMessage.slice(0, maxLength + 1);
  const lastSpaceIndex = compactMessage.lastIndexOf(" ");
  const trimmedMessage = compactMessage.slice(0, lastSpaceIndex > 72 ? lastSpaceIndex : maxLength).trim();

  return `${trimmedMessage.replace(/[.,;:!?]$/, "")}...`;
};

const getPublicReviewWindow = (reviews = getPublicReviews(), offset = 0, limit = 1) => {
  if (!reviews.length || limit <= 0) {
    return [];
  }

  const visibleCount = Math.min(limit, reviews.length);
  return Array.from({ length: visibleCount }, (_, index) => reviews[(offset + index) % reviews.length]);
};

const normalizeCatalogReviewTargetId = (value = "") =>
  normalizePublicReviewText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const publicReviewTargetsItem = (review, item) => {
  const itemId = normalizeCatalogReviewTargetId(item?.id);
  const itemName = normalizeCatalogReviewTargetId(item?.name);
  const target = review?.target && typeof review.target === "object" ? review.target : {};
  const targetIds = Array.isArray(target.itemIds) ? target.itemIds : [target.itemId];
  const normalizedTargetIds = targetIds.map(normalizeCatalogReviewTargetId).filter(Boolean);
  const targetName = normalizeCatalogReviewTargetId(target.itemName);

  return Boolean(
    (itemId && normalizedTargetIds.includes(itemId)) ||
      (itemName && targetName && targetName === itemName)
  );
};

const publicReviewHasItemTarget = (review) => {
  const target = review?.target && typeof review.target === "object" ? review.target : {};
  return Boolean(
    normalizePublicReviewText(target.itemId) ||
      (Array.isArray(target.itemIds) && target.itemIds.some((itemId) => normalizePublicReviewText(itemId))) ||
      normalizePublicReviewText(target.itemName)
  );
};

const getCatalogReviewForItem = (item) => {
  const reviews = getPublicReviews();

  if (!reviews.length) {
    return null;
  }

  const itemReview = reviews.find((review) => publicReviewTargetsItem(review, item));

  if (itemReview) {
    return {
      review: itemReview,
      source: "item",
    };
  }

  return {
    review: reviews.find((review) => !publicReviewHasItemTarget(review)) || reviews[0],
    source: "general",
  };
};

const getCatalogItemReviewMarkup = (item, { mode = "inline" } = {}) => {
  const reviewContext = getCatalogReviewForItem(item);

  if (!reviewContext?.review) {
    return "";
  }

  const { review, source } = reviewContext;
  const reviewerName = getPublicReviewerName(review.name);
  const commentLimit = mode === "spotlight" ? 132 : 76;
  const sourceLabel = source === "item" ? "Avaliacao do item" : "Avaliacao geral";

  return `
    <div class="catalog-item-review catalog-item-review-${mode}${source === "general" ? " is-general" : ""}">
      <div class="catalog-item-review-top">
        <span class="catalog-item-review-stars">${buildRatingStars(review.rating)}</span>
        <span class="catalog-item-review-source">${sourceLabel}</span>
      </div>
      <p>
        <strong>${escapeHtml(reviewerName)}</strong>
        <span>${escapeHtml(getShortPublicReviewMessage(review.message, commentLimit))}</span>
      </p>
    </div>
  `;
};

const setActiveNavigation = () => {
  const currentPage = document.body.dataset.page || "";

  document.querySelectorAll("[data-nav-page]").forEach((link) => {
    const isCurrent = link.dataset.navPage === currentPage;
    link.classList.toggle("is-active", isCurrent);

    if (isCurrent) {
      link.setAttribute("aria-current", "page");
      return;
    }

    link.removeAttribute("aria-current");
  });
};

const getHeroFeaturedItemComposition = (item) => {
  const rawDescription = String(item?.description || "").trim();

  if (!rawDescription) {
    return [];
  }

  const normalizedEntries = rawDescription
    .replace(/\s+e\s+/gi, ", ")
    .split(/\s*,\s*/)
    .map((entry) =>
      entry
        .replace(/^[\u2022\-]\s*/, "")
        .replace(/\.$/, "")
        .trim()
    )
    .filter(Boolean);

  if (normalizedEntries.length > 1) {
    return normalizedEntries.slice(0, 8);
  }

  return [rawDescription.replace(/\.$/, "").trim()];
};

const clearHeroFeaturedRotationTimers = () => {
  if (heroFeaturedRotationIntervalId) {
    window.clearInterval(heroFeaturedRotationIntervalId);
    heroFeaturedRotationIntervalId = null;
  }

  if (heroFeaturedTransitionTimeoutId) {
    window.clearTimeout(heroFeaturedTransitionTimeoutId);
    heroFeaturedTransitionTimeoutId = null;
  }
};

const getHomeFeaturedCatalogItems = () => {
  const runtimeItems = [];

  (Array.isArray(runtimeFeaturedCatalogItems) ? runtimeFeaturedCatalogItems : []).forEach((item) => {
    const itemKey = String(item?.id || item?.name || "").trim();

    if (!item || typeof item !== "object" || !itemKey || runtimeItems.some((entry) => entry.id === itemKey)) {
      return;
    }

    runtimeItems.push({
      ...item,
      id: itemKey,
    });
  });

  if (runtimeItems.length > 0) {
    return runtimeItems.slice(0, 3);
  }

  if (runtimeFeaturedCatalogItem && typeof runtimeFeaturedCatalogItem === "object") {
    return [runtimeFeaturedCatalogItem];
  }

  const comboSection = MENU_SECTIONS.find((section) => section.id === "combinados");
  const fallbackItem =
    comboSection?.items.find((item) => item.id === "sakura-20") ||
    comboSection?.items.find((item) => item.image);

  return fallbackItem ? [fallbackItem] : [];
};

const getCatalogItemDeepLink = (itemId) => {
  const normalizedItemId = String(itemId || "").trim();
  return normalizedItemId
    ? `./cardapio.html#item-${encodeURIComponent(normalizedItemId)}`
    : "./cardapio.html#catalogo";
};

const renderHeroFeaturedIndicators = (items, activeIndex) => {
  const navRoot = document.querySelector("[data-hero-featured-nav]");
  const dotsRoot = navRoot?.querySelector("[data-hero-featured-dots]");
  const counterNode = navRoot?.querySelector("[data-hero-featured-counter]");

  if (!navRoot || !dotsRoot || !counterNode) {
    return;
  }

  navRoot.hidden = items.length <= 1;

  if (items.length <= 1) {
    dotsRoot.innerHTML = "";
    counterNode.textContent = "";
    return;
  }

  dotsRoot.innerHTML = items
    .map(
      (_, index) => `
        <button
          class="hero-featured-dot${index === activeIndex ? " is-active" : ""}"
          type="button"
          data-hero-featured-dot="${index}"
          aria-label="Mostrar destaque ${index + 1} de ${items.length}"
          aria-pressed="${index === activeIndex ? "true" : "false"}"
        ></button>
      `
    )
    .join("");
  counterNode.textContent = `${activeIndex + 1} / ${items.length}`;

  if (!navRoot.dataset.rotationBound) {
    navRoot.dataset.rotationBound = "true";
    navRoot.addEventListener("click", (event) => {
      const button = event.target.closest("[data-hero-featured-dot]");

      if (!button) {
        return;
      }

      event.preventDefault();
      const nextIndex = Number(button.dataset.heroFeaturedDot || 0);
      setHeroFeaturedIndex(nextIndex, { animate: true, force: true });
      startHeroFeaturedRotation();
    });
  }
};

const applyHeroFeaturedItem = (item) => {
  const heroImage = document.querySelector(".hero-image img");
  const heroCategory = document.querySelector(".hero-order-card .section-tag");
  const heroTitle = document.querySelector(".hero-order-card h2");
  const heroPrice = document.querySelector("[data-hero-featured-link]");
  const heroOrderList = document.querySelector(".hero-order-list");
  const compositionEntries = getHeroFeaturedItemComposition(item);
  const portionLabel = String(item?.detail || item?.unitsLabel || "").trim();

  if (!heroImage || !heroCategory || !heroTitle || !heroPrice || !heroOrderList) {
    return;
  }

  heroImage.src = item.image;
  heroImage.alt = (TOKYO_PUBLIC_TEXT.menuItemAltTemplate || "{itemName} do Tokyo Sushi Delivery").replace(
    "{itemName}",
    item.name
  );
  heroCategory.textContent = item.category || "Destaque do cardapio";
  heroTitle.innerHTML = portionLabel
    ? `${item.name} <span class="portion-label">(${portionLabel})</span>`
    : item.name;
  heroPrice.textContent = "Consulte";
  heroPrice.href = getCatalogItemDeepLink(item.id);
  heroPrice.setAttribute("aria-label", `Consultar ${item.name} no cardapio`);
  heroOrderList.innerHTML = compositionEntries
    .map((entry) => `<span>${escapeHtml(entry)}</span>`)
    .join("");
};

const setHeroFeaturedIndex = (nextIndex, options = {}) => {
  const items = heroFeaturedRotationItems;
  const phoneCard = document.querySelector(".phone-card");

  if (!items.length) {
    return;
  }

  const normalizedIndex = ((Number(nextIndex) || 0) + items.length) % items.length;
  const shouldAnimate =
    options.animate !== false &&
    Boolean(phoneCard?.dataset.heroFeaturedReady) &&
    (options.force === true || heroFeaturedActiveIndex !== normalizedIndex);
  const nextItem = items[normalizedIndex];

  heroFeaturedActiveIndex = normalizedIndex;
  renderHeroFeaturedIndicators(items, heroFeaturedActiveIndex);

  if (!nextItem) {
    return;
  }

  if (!shouldAnimate || !phoneCard) {
    applyHeroFeaturedItem(nextItem);
    if (phoneCard) {
      phoneCard.dataset.heroFeaturedReady = "true";
    }
    return;
  }

  if (heroFeaturedTransitionTimeoutId) {
    window.clearTimeout(heroFeaturedTransitionTimeoutId);
  }

  phoneCard.classList.add("is-featured-transitioning");
  heroFeaturedTransitionTimeoutId = window.setTimeout(() => {
    applyHeroFeaturedItem(nextItem);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        phoneCard.classList.remove("is-featured-transitioning");
      });
    });
  }, HERO_FEATURED_TRANSITION_DELAY_MS);
};

const startHeroFeaturedRotation = () => {
  if (heroFeaturedRotationIntervalId) {
    window.clearInterval(heroFeaturedRotationIntervalId);
    heroFeaturedRotationIntervalId = null;
  }

  if (heroFeaturedRotationItems.length <= 1) {
    return;
  }

  heroFeaturedRotationIntervalId = window.setInterval(() => {
    setHeroFeaturedIndex(heroFeaturedActiveIndex + 1, { animate: true });
  }, HERO_FEATURED_ROTATION_INTERVAL_MS);
};

const initComboHeroImages = () => {
  const currentPage = document.body.dataset.page || "";
  if (currentPage !== "index" && currentPage !== "inicio") {
    clearHeroFeaturedRotationTimers();
    return;
  }

  const featuredItems = getHomeFeaturedCatalogItems();

  if (!featuredItems.length) {
    clearHeroFeaturedRotationTimers();
    return;
  }

  if (!document.querySelector(".hero-image img")) {
    return;
  }

  const previousItemId = heroFeaturedRotationItems[heroFeaturedActiveIndex]?.id || "";
  const preservedIndex = previousItemId
    ? featuredItems.findIndex((item) => item.id === previousItemId)
    : -1;

  heroFeaturedRotationItems = featuredItems;
  heroFeaturedActiveIndex = preservedIndex >= 0 ? preservedIndex : 0;

  setHeroFeaturedIndex(heroFeaturedActiveIndex, {
    animate: Boolean(document.querySelector(".phone-card")?.dataset.heroFeaturedReady),
    force: true,
  });
  startHeroFeaturedRotation();
};

const prefillProfileForms = () => {
  const profile = loadAuthProfile();
  const displayEmail = getDisplayEmail(profile);

  const reviewNameInput = document.querySelector("[name='review_name']");
  if (reviewNameInput && !reviewNameInput.value && profile?.name) {
    reviewNameInput.value = profile.name;
  }

  const reviewContactInput = document.querySelector("[name='review_contact']");
  if (reviewContactInput && !reviewContactInput.value) {
    reviewContactInput.value = displayEmail || formatPhoneDisplay(profile?.phone || "");
  }

  const careerNameInput = document.querySelector("[name='career_name']");
  if (careerNameInput && !careerNameInput.value && profile?.name) {
    careerNameInput.value = profile.name;
  }

  const careerPhoneInput = document.querySelector("[name='career_phone']");
  if (careerPhoneInput && !careerPhoneInput.value && profile?.phone) {
    careerPhoneInput.value = formatPhoneDisplay(profile.phone);
  }

  const careerEmailInput = document.querySelector("[name='career_email']");
  if (careerEmailInput && !careerEmailInput.value && displayEmail) {
    careerEmailInput.value = displayEmail;
  }
};

const getInitials = (name) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "U";
  }

  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
};

const getFirstName = (name) => String(name || "").trim().split(/\s+/).filter(Boolean)[0] || "Cliente";

const ACCOUNT_ICON_MARKUP = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 12a4.5 4.5 0 1 0 0-9a4.5 4.5 0 0 0 0 9Zm0 2.1c-4.36 0-7.9 2.84-7.9 6.35c0 .3.24.55.55.55h14.7c.3 0 .55-.25.55-.55c0-3.51-3.54-6.35-7.9-6.35Z" />
  </svg>
`;

const getAuthProviderLabel = (provider) => {
  if (provider === "phone") {
    return "Telefone verificado por WhatsApp";
  }

  if (provider === "google") {
    return "Google";
  }

  if (provider === "facebook") {
    return "Facebook";
  }

  if (provider === "instagram") {
    return "Instagram";
  }

  return TOKYO_PUBLIC_TEXT.authAccessLabel || "Acesso Tokyo";
};

const getDisplayEmail = (profile) => {
  const email = normalizeEmail(profile?.email);

  if (!email || email.endsWith(`@${SOCIAL_EMAIL_DOMAIN}`)) {
    return "";
  }

  return email;
};

const maskPhoneDisplay = (value) => {
  const digits = normalizePhone(value);

  if (digits.length < 4) {
    return formatPhoneDisplay(digits);
  }

  const visibleTail = digits.slice(-2);

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) *****-${digits.slice(7, 9)}${visibleTail}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ****-${digits.slice(6, 8)}${visibleTail}`;
  }

  return `***${visibleTail}`;
};

const normalizeWhatsappPhone = (value) => {
  const digits = normalizePhone(value);

  if (!digits) {
    return "";
  }

  return digits.length >= 10 ? `55${digits}` : digits;
};

const generateNumericCode = (length) => {
  let code = "";

  while (code.length < length) {
    code += String(Math.floor(Math.random() * 10));
  }

  return code.slice(0, length);
};

const getAuthProviderIconMarkup = (provider) => {
  const icons = {
    google: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path fill="#EA4335" d="M12.24 10.285V14.4h5.88c-.258 1.324-1.548 3.885-5.88 3.885a6.48 6.48 0 0 1 0-12.96c1.935 0 3.227.825 3.969 1.536l2.7-2.615C17.16 2.6 14.91 1.715 12.24 1.715c-5.505 0-9.97 4.466-9.97 9.97 0 5.505 4.465 9.97 9.97 9.97 5.76 0 9.57-4.05 9.57-9.76 0-.66-.075-1.155-.165-1.61H12.24Z"/>
        <path fill="#4285F4" d="M3.42 7.95 6.66 10.33a5.985 5.985 0 0 1 5.58-4.005c1.935 0 3.227.825 3.969 1.536l2.7-2.615C17.16 2.6 14.91 1.715 12.24 1.715 8.41 1.715 5.08 3.91 3.42 7.95Z"/>
        <path fill="#34A853" d="M12.24 21.655c2.625 0 4.83-.87 6.435-2.355l-3.15-2.445c-.87.615-2.01 1.035-3.285 1.035-2.985 0-5.52-2.01-6.42-4.71l-3.345 2.58c1.65 3.27 5.04 5.895 9.765 5.895Z"/>
        <path fill="#FBBC05" d="M5.82 13.18a6.09 6.09 0 0 1 0-3.71L2.475 6.89a9.955 9.955 0 0 0 0 8.87l3.345-2.58Z"/>
      </svg>
    `,
    facebook: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.024 4.388 11.018 10.125 11.927v-8.438H7.078v-3.49h3.047V9.413c0-3.021 1.792-4.69 4.533-4.69 1.313 0 2.686.235 2.686.235v2.965H15.83c-1.49 0-1.955.931-1.955 1.887v2.262h3.328l-.532 3.49h-2.796V24C19.612 23.091 24 18.097 24 12.073Z"/>
      </svg>
    `,
    instagram: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.8A3.95 3.95 0 0 0 3.8 7.75v8.5a3.95 3.95 0 0 0 3.95 3.95h8.5a3.95 3.95 0 0 0 3.95-3.95v-8.5a3.95 3.95 0 0 0-3.95-3.95h-8.5Zm8.95 1.35a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4ZM12 7.1A4.9 4.9 0 1 1 7.1 12 4.91 4.91 0 0 1 12 7.1Zm0 1.8A3.1 3.1 0 1 0 15.1 12 3.104 3.104 0 0 0 12 8.9Z"/>
      </svg>
    `,
  };

  return icons[provider] || "";
};

const postJsonWithTimeout = async (
  url,
  payload,
  timeoutMs = CUSTOMER_AUTH_REQUEST_TIMEOUT_MS,
  requestOptions = {}
) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(requestOptions.headers || {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      credentials: requestOptions.credentials || "same-origin",
    });
    let data = null;

    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    if (!response.ok) {
      const requestError = new Error(
        data?.error || "Nao consegui enviar o codigo automaticamente pelo WhatsApp."
      );
      requestError.status = response.status;
      requestError.code = data?.errorCode || "request_failed";
      throw requestError;
    }

    return data || {};
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const getJsonWithTimeout = async (
  url,
  timeoutMs = CUSTOMER_AUTH_REQUEST_TIMEOUT_MS,
  requestOptions = {}
) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(requestOptions.headers || {}),
      },
      signal: controller.signal,
      credentials: requestOptions.credentials || "same-origin",
    });
    let data = null;

    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    if (!response.ok) {
      const requestError = new Error(
        data?.error || "Nao foi possivel carregar os dados do seu pedido."
      );
      requestError.status = response.status;
      requestError.code = data?.errorCode || "request_failed";
      throw requestError;
    }

    return data || {};
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const normalizePublicSettingsText = (value, fallback = "", maxLength = 420) => {
  const normalizedValue = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return normalizedValue || fallback;
};

const normalizePublicAssetUrl = (value, fallback = "") => {
  const normalizedValue = normalizePublicSettingsText(value, "", 2048);

  if (!normalizedValue) {
    return fallback;
  }

  if (
    normalizedValue.startsWith("./") ||
    normalizedValue.startsWith("/") ||
    /^https?:\/\//i.test(normalizedValue) ||
    /^[\w./-]+\.(png|jpe?g|webp|gif|svg)$/i.test(normalizedValue) ||
    /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/i.test(normalizedValue)
  ) {
    return normalizedValue;
  }

  return fallback;
};

const normalizePublicHexColor = (value, fallback) => {
  const normalizedValue = normalizePublicSettingsText(value, "", 32).toLowerCase();

  if (/^#[0-9a-f]{6}$/i.test(normalizedValue)) {
    return normalizedValue;
  }

  if (/^#[0-9a-f]{3}$/i.test(normalizedValue)) {
    return `#${normalizedValue
      .slice(1)
      .split("")
      .map((character) => `${character}${character}`)
      .join("")}`;
  }

  return fallback;
};

const normalizePublicSettingsNumber = (value, fallback = 0, precision = 2, maximum = 9999) => {
  const normalizedValue = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=.*\.)/g, "")
    .replace(",", ".");
  const numericValue = Number(normalizedValue);
  const resolvedValue = Number.isFinite(numericValue) ? numericValue : Number(fallback || 0);

  return Number(Math.max(0, Math.min(maximum, resolvedValue)).toFixed(precision));
};

const normalizePublicBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  const normalizedValue = String(value || "").trim().toLowerCase();

  if (["true", "1", "yes", "sim", "on"].includes(normalizedValue)) {
    return true;
  }

  if (["false", "0", "no", "nao", "off"].includes(normalizedValue)) {
    return false;
  }

  return fallback;
};

const normalizePublicObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const normalizePublicOption = (value, allowedValues, fallback) => {
  const normalizedValue = normalizePublicSettingsText(value, "", 40).toUpperCase();
  return allowedValues.includes(normalizedValue) ? normalizedValue : fallback;
};

const normalizePublicKeywords = (value, fallback = []) => {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((entry) => entry.trim());
  const keywords = source
    .map((entry) => normalizePublicSettingsText(entry, "", 48))
    .filter(Boolean)
    .slice(0, 16);

  return keywords.length ? keywords : [...fallback];
};

const normalizePublicMultilineText = (value, fallback = "", maxLength = 900) => {
  const normalizedValue = String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);

  return normalizedValue || fallback;
};

const normalizePublicSeoSettings = (source = {}, defaults = RESTAURANT_SETTINGS_DEFAULTS) => {
  const seo = normalizePublicObject(source.seo || source.appearance?.seo);
  const openGraph = normalizePublicObject(source.seoOpenGraph || seo.openGraph);
  const title = normalizePublicSettingsText(
    source.seoTitle || seo.title,
    defaults.seoTitle || defaults.restaurantName,
    180
  );
  const description = normalizePublicMultilineText(
    source.seoDescription || seo.description,
    defaults.seoDescription || defaults.description || defaults.presentationText,
    320
  );
  const shareImage = normalizePublicAssetUrl(
    source.seoShareImage || source.seoImage || seo.shareImage || seo.image,
    defaults.seoShareImage || defaults.bannerUrl
  );

  return {
    title,
    description,
    shareImage,
    keywords: normalizePublicKeywords(source.seoKeywords || seo.keywords, defaults.seoKeywords),
    openGraph: {
      title: normalizePublicSettingsText(openGraph.title, title, 180),
      description: normalizePublicMultilineText(openGraph.description, description, 320),
      image: normalizePublicAssetUrl(openGraph.image, shareImage),
      type: normalizePublicSettingsText(openGraph.type, defaults.seoOpenGraph?.type || "website", 60),
    },
  };
};

const normalizePublicPlatformFooter = (source = {}, defaults = RESTAURANT_SETTINGS_DEFAULTS) => {
  const footer = normalizePublicObject(source.platformFooter || source.appearance?.platformFooter);
  const fallback = defaults.platformFooter || {};

  return {
    showPlatformBranding: normalizePublicBoolean(
      footer.showPlatformBranding,
      fallback.showPlatformBranding !== false
    ),
    brandName: normalizePublicSettingsText(footer.brandName, fallback.brandName || "INOVAS Food", 80),
    logo: normalizePublicAssetUrl(
      footer.logo,
      fallback.logo || "./assets/inovas-food-logo-oficial.png"
    ),
    headline: normalizePublicSettingsText(
      footer.headline,
      fallback.headline || "Desenvolvido por INOVAS Food",
      120
    ),
    description: normalizePublicSettingsText(
      footer.description,
      fallback.description || "Plataforma profissional para restaurantes",
      180
    ),
    url: normalizePublicSettingsText(
      footer.url,
      fallback.url || "https://www.inovasfood.com.br",
      2048
    ),
    displayUrl: normalizePublicSettingsText(
      footer.displayUrl,
      fallback.displayUrl || "www.inovasfood.com.br",
      120
    ),
  };
};

const normalizePublicAppearance = (source = {}, defaults = RESTAURANT_SETTINGS_DEFAULTS) => {
  const appearance = normalizePublicObject(source.appearance);
  const colorsSource = normalizePublicObject(appearance.colors || source.colors);
  const identitySource = normalizePublicObject(appearance.identity || source.identity);
  const socialSource = normalizePublicObject(appearance.social || source.social);
  const colors = {
    primary: normalizePublicHexColor(
      source.primaryColor || colorsSource.primary,
      defaults.primaryColor
    ),
    secondary: normalizePublicHexColor(
      source.secondaryColor || colorsSource.secondary,
      defaults.secondaryColor
    ),
    accent: normalizePublicHexColor(source.accentColor || colorsSource.accent, defaults.accentColor),
    gradientStart: normalizePublicHexColor(
      source.gradientStart || colorsSource.gradientStart,
      defaults.gradientStart
    ),
    gradientEnd: normalizePublicHexColor(
      source.gradientEnd || colorsSource.gradientEnd,
      defaults.gradientEnd
    ),
    useGradient: normalizePublicBoolean(
      source.useGradient ?? colorsSource.useGradient,
      defaults.useGradient
    ),
  };

  return {
    layout: normalizePublicOption(
      source.siteLayout || source.layout || appearance.layout,
      ["MODERN", "CATALOGO", "PREMIUM"],
      defaults.siteLayout
    ),
    theme: normalizePublicOption(
      source.siteTheme || source.theme || appearance.theme,
      ["LIGHT", "DARK", "AUTO"],
      defaults.siteTheme
    ),
    colors,
    identity: {
      slogan: normalizePublicSettingsText(
        source.slogan || identitySource.slogan,
        defaults.slogan,
        140
      ),
      description: normalizePublicMultilineText(
        source.description || identitySource.description || source.presentationText,
        defaults.description || defaults.presentationText,
        900
      ),
    },
    social: {
      instagram: normalizePublicSettingsText(source.instagram || socialSource.instagram, "", 2048),
      facebook: normalizePublicSettingsText(source.facebook || socialSource.facebook, "", 2048),
      tiktok: normalizePublicSettingsText(source.tiktok || socialSource.tiktok, "", 2048),
      site: normalizePublicSettingsText(source.site || socialSource.site, defaults.site, 2048),
    },
    seo: normalizePublicSeoSettings(source, defaults),
    platformFooter: normalizePublicPlatformFooter(source, defaults),
  };
};

const normalizePublicPostalCode = (value, fallback = "") => {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);

  if (digits.length !== 8) {
    return fallback;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

const normalizePublicStateCode = (value, fallback = "") => {
  const normalizedValue = normalizePublicSettingsText(value, "", 2)
    .replace(/[^a-z]/gi, "")
    .toUpperCase();

  return normalizedValue.length === 2 ? normalizedValue : fallback;
};

const normalizePublicCoordinate = (value, minimum, maximum) => {
  const normalizedValue = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=.*\.)/g, "")
    .replace(",", ".");
  const numericValue = Number(normalizedValue);

  if (!Number.isFinite(numericValue) || numericValue < minimum || numericValue > maximum) {
    return null;
  }

  return Number(numericValue.toFixed(8));
};

const normalizePublicAddressFields = (addressFields = {}, fallback = RESTAURANT_SETTINGS_DEFAULTS.addressFields) => {
  const source = addressFields && typeof addressFields === "object" ? addressFields : {};

  return {
    postalCode: normalizePublicPostalCode(source.postalCode || source.cep, fallback.postalCode),
    street: normalizePublicSettingsText(source.street || source.rua, fallback.street, 160),
    number: normalizePublicSettingsText(source.number || source.numero, fallback.number, 40),
    complement: normalizePublicSettingsText(source.complement || source.complemento, "", 120),
    neighborhood: normalizePublicSettingsText(
      source.neighborhood || source.bairro,
      fallback.neighborhood,
      120
    ),
    city: normalizePublicSettingsText(source.city || source.cidade, fallback.city, 120),
    state: normalizePublicStateCode(source.state || source.estado, fallback.state),
  };
};

const buildPublicFriendlyAddress = (addressFields = {}, fallback = "") => {
  const primaryLine = [addressFields.street, addressFields.number].filter(Boolean).join(", ");
  const address = [
    primaryLine,
    addressFields.complement,
    addressFields.neighborhood,
    [addressFields.city, addressFields.state].filter(Boolean).join(" - "),
    addressFields.postalCode ? `CEP ${addressFields.postalCode}` : "",
    "Brasil",
  ]
    .filter(Boolean)
    .join(", ");

  return address || fallback;
};

const normalizePublicDeliveryBase = (deliveryBase = {}, fallback = RESTAURANT_SETTINGS_DEFAULTS.deliveryBase) => {
  const source = deliveryBase && typeof deliveryBase === "object" ? deliveryBase : {};

  return {
    latitude: normalizePublicCoordinate(source.latitude, -90, 90),
    longitude: normalizePublicCoordinate(source.longitude, -180, 180),
    maxDeliveryRadiusKm: normalizePublicSettingsNumber(
      source.maxDeliveryRadiusKm,
      fallback.maxDeliveryRadiusKm,
      2,
      999
    ),
    fixedDeliveryFee: normalizePublicSettingsNumber(
      source.fixedDeliveryFee ?? source.defaultDeliveryFee,
      fallback.fixedDeliveryFee,
      2,
      500
    ),
    pricePerKm: normalizePublicSettingsNumber(source.pricePerKm, fallback.pricePerKm, 2, 500),
    minimumDeliveryOrder: normalizePublicSettingsNumber(
      source.minimumDeliveryOrder,
      fallback.minimumDeliveryOrder,
      2,
      5000
    ),
    pickupEnabled: normalizePublicBoolean(source.pickupEnabled, fallback.pickupEnabled),
    deliveryEnabled: normalizePublicBoolean(source.deliveryEnabled, fallback.deliveryEnabled),
  };
};

const normalizePublicTimeValue = (value, fallback = "") => {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return fallback;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return fallback;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const parsePublicTimeToMinutes = (value) => {
  if (BUSINESS_HOURS_API?.parseTimeToMinutes) {
    return BUSINESS_HOURS_API.parseTimeToMinutes(value);
  }

  const normalizedTime = normalizePublicTimeValue(value, "");

  if (!normalizedTime) {
    return NaN;
  }

  const [hours, minutes] = normalizedTime.split(":").map((part) => Number(part));
  return hours * 60 + minutes;
};

const formatPublicMinutesAsTime = (totalMinutes) => {
  if (BUSINESS_HOURS_API?.formatMinutesAsTime) {
    return BUSINESS_HOURS_API.formatMinutesAsTime(totalMinutes);
  }

  const safeMinutes = Math.max(0, Math.min(23 * 60 + 59, Math.round(Number(totalMinutes) || 0)));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const normalizePublicBusinessScheduleDay = (
  day = {},
  fallback = { isOpen: true, openTime: "18:00", closeTime: "23:00", pauseStart: "", pauseEnd: "" }
) => {
  const source = day && typeof day === "object" ? day : {};
  const fallbackOpenTime = normalizePublicTimeValue(fallback.openTime, "18:00");
  const fallbackCloseTime = normalizePublicTimeValue(fallback.closeTime, "23:00");
  const openTime = normalizePublicTimeValue(
    source.openTime || source.openingTime || source.abertura,
    fallbackOpenTime
  );
  let closeTime = normalizePublicTimeValue(
    source.closeTime || source.closingTime || source.fechamento,
    fallbackCloseTime
  );

  if (parsePublicTimeToMinutes(closeTime) <= parsePublicTimeToMinutes(openTime)) {
    closeTime = fallbackCloseTime;
  }

  let pauseStart = normalizePublicTimeValue(
    source.pauseStart || source.breakStart || source.pause1Start || source.pausaInicio,
    fallback.pauseStart || ""
  );
  let pauseEnd = normalizePublicTimeValue(
    source.pauseEnd || source.breakEnd || source.pause1End || source.pausaFim,
    fallback.pauseEnd || ""
  );
  const pauseStartMinutes = parsePublicTimeToMinutes(pauseStart);
  const pauseEndMinutes = parsePublicTimeToMinutes(pauseEnd);
  const openMinutes = parsePublicTimeToMinutes(openTime);
  const closeMinutes = parsePublicTimeToMinutes(closeTime);

  if (
    !pauseStart ||
    !pauseEnd ||
    pauseStartMinutes < openMinutes ||
    pauseEndMinutes > closeMinutes ||
    pauseEndMinutes <= pauseStartMinutes
  ) {
    pauseStart = "";
    pauseEnd = "";
  }

  return {
    isOpen: normalizePublicBoolean(source.isOpen ?? source.open ?? source.aberto, fallback.isOpen !== false),
    openTime,
    closeTime,
    pauseStart,
    pauseEnd,
  };
};

const normalizePublicDateValue = (value, fallback = "") => {
  const normalizedValue = String(value || "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return normalizedValue;
  }

  return fallback;
};

const normalizePublicBusinessSpecialDate = (entry = {}) => {
  const source = entry && typeof entry === "object" ? entry : {};
  const date = normalizePublicDateValue(source.date || source.dateValue, "");

  if (!date) {
    return null;
  }

  const normalizedDay = normalizePublicBusinessScheduleDay(source, {
    isOpen: false,
    openTime: "18:00",
    closeTime: "23:00",
    pauseStart: "",
    pauseEnd: "",
  });

  return {
    id: normalizePublicSettingsText(source.id, `special-${date}`, 80),
    date,
    name: normalizePublicSettingsText(source.name || source.description || source.descricao, "", 120),
    ...normalizedDay,
    message: normalizePublicSettingsText(
      source.message || source.customerMessage || source.mensagem,
      "",
      360
    ),
  };
};

const normalizePublicBusinessSpecialDates = (specialDates = []) => {
  if (!Array.isArray(specialDates)) {
    return [];
  }

  const byDate = new Map();

  specialDates.forEach((entry) => {
    const normalizedEntry = normalizePublicBusinessSpecialDate(entry);

    if (normalizedEntry) {
      byDate.set(normalizedEntry.date, normalizedEntry);
    }
  });

  return Array.from(byDate.values()).sort((left, right) => left.date.localeCompare(right.date));
};

const normalizePublicBusinessSchedule = (
  businessSchedule = {},
  fallback = RESTAURANT_SETTINGS_DEFAULTS.businessSchedule
) => {
  const source = businessSchedule && typeof businessSchedule === "object" ? businessSchedule : {};
  const sourceDays =
    source.days && typeof source.days === "object"
      ? source.days
      : source.weekdays && typeof source.weekdays === "object"
        ? source.weekdays
        : {};
  const fallbackDays = fallback.days || createDefaultBusinessScheduleDays();
  const days = BUSINESS_SCHEDULE_DAY_KEYS.reduce((normalizedDays, dayKey) => {
    normalizedDays[dayKey] = normalizePublicBusinessScheduleDay(
      sourceDays[dayKey],
      fallbackDays[dayKey] || RESTAURANT_SETTINGS_DEFAULTS.businessSchedule.days[dayKey]
    );

    return normalizedDays;
  }, {});

  return {
    timeZone: normalizePublicSettingsText(
      source.timeZone || source.timezone,
      fallback.timeZone || "America/Sao_Paulo",
      80
    ),
    acceptOrdersOutsideHours: normalizePublicBoolean(
      source.acceptOrdersOutsideHours ?? source.acceptOutsideHours,
      fallback.acceptOrdersOutsideHours
    ),
    closedMessage: normalizePublicSettingsText(
      source.closedMessage,
      fallback.closedMessage,
      360
    ),
    peakPreparationExtraMinutes: Math.round(
      normalizePublicSettingsNumber(
        source.peakPreparationExtraMinutes,
        fallback.peakPreparationExtraMinutes,
        0,
        240
      )
    ),
    specialDates: normalizePublicBusinessSpecialDates(
      source.specialDates || source.exceptionDates || source.holidays
    ),
    days,
  };
};

const formatPublicBusinessDayHours = (day = {}) => {
  if (day.isOpen === false) {
    return "Fechado";
  }

  const pauseLabel =
    day.pauseStart && day.pauseEnd ? ` (pausa ${day.pauseStart} as ${day.pauseEnd})` : "";

  return `${day.openTime || "18:00"} as ${day.closeTime || "23:00"}${pauseLabel}`;
};

const getPublicBusinessDaySignature = (day = {}) =>
  day.isOpen === false
    ? "closed"
    : [
        day.openTime || "",
        day.closeTime || "",
        day.pauseStart || "",
        day.pauseEnd || "",
      ].join("|");

const formatPublicBusinessDayRange = (startKey, endKey) =>
  startKey === endKey
    ? BUSINESS_SCHEDULE_DAY_SHORT_LABELS[startKey] || startKey
    : `${BUSINESS_SCHEDULE_DAY_SHORT_LABELS[startKey] || startKey} a ${
        BUSINESS_SCHEDULE_DAY_SHORT_LABELS[endKey] || endKey
      }`;

const formatPublicBusinessScheduleLabel = (schedule = {}) => {
  const days = schedule.days || {};
  const groups = [];

  BUSINESS_SCHEDULE_DAY_KEYS.forEach((dayKey) => {
    const day = days[dayKey] || {};
    const signature = getPublicBusinessDaySignature(day);
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.signature === signature) {
      lastGroup.endKey = dayKey;
      return;
    }

    groups.push({
      signature,
      startKey: dayKey,
      endKey: dayKey,
      label: formatPublicBusinessDayHours(day),
    });
  });

  if (groups.length === 1) {
    return `Todos os dias: ${groups[0].label}`;
  }

  return groups
    .map((group) => `${formatPublicBusinessDayRange(group.startKey, group.endKey)}: ${group.label}`)
    .join("; ");
};

const buildPublicDateFromDateValue = (dateValue) => {
  const [year, month, day] = String(dateValue || "")
    .split("-")
    .map((part) => Number(part));

  if (!year || !month || !day) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
};

const addDaysToPublicDateValue = (dateValue, days) => {
  if (BUSINESS_HOURS_API?.addDaysToDateValue) {
    return BUSINESS_HOURS_API.addDaysToDateValue(dateValue, days);
  }

  const baseDate = buildPublicDateFromDateValue(dateValue);

  if (!baseDate) {
    return "";
  }

  const nextDate = new Date(baseDate);
  nextDate.setUTCDate(nextDate.getUTCDate() + Number(days || 0));

  return [
    nextDate.getUTCFullYear(),
    String(nextDate.getUTCMonth() + 1).padStart(2, "0"),
    String(nextDate.getUTCDate()).padStart(2, "0"),
  ].join("-");
};

const formatPublicDateValue = (dateValue) => {
  if (BUSINESS_HOURS_API?.formatDateValue) {
    return BUSINESS_HOURS_API.formatDateValue(dateValue);
  }

  const date = buildPublicDateFromDateValue(dateValue);

  if (!date) {
    return dateValue;
  }

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "UTC",
      dateStyle: "short",
    }).format(date);
  } catch (error) {
    return dateValue;
  }
};

const getPublicNowParts = (now = new Date(), timeZone = "America/Sao_Paulo") => {
  if (BUSINESS_HOURS_API?.getNowParts) {
    return BUSINESS_HOURS_API.getNowParts(now, timeZone);
  }

  let formatter;

  try {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch (error) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  }

  const parts = formatter.formatToParts(now).reduce((accumulator, part) => {
    if (part.type !== "literal") {
      accumulator[part.type] = part.value;
    }

    return accumulator;
  }, {});
  const year = parts.year || "0000";
  const month = parts.month || "01";
  const day = parts.day || "01";
  const hour = parts.hour || "00";
  const minute = parts.minute || "00";
  const second = parts.second || "00";
  const hoursNumber = Number(hour);
  const minutesNumber = Number(minute);
  const secondsNumber = Number(second);

  return {
    dateValue: `${year}-${month}-${day}`,
    timeValue: `${hour}:${minute}`,
    hours: hoursNumber,
    minutes: minutesNumber,
    seconds: secondsNumber,
    minuteOfDay: hoursNumber * 60 + minutesNumber,
    dateTimeKey: `${year}-${month}-${day}T${hour}:${minute}`,
  };
};

const getPublicWeekdayKeyForDateValue = (dateValue, timeZone = "America/Sao_Paulo") => {
  if (BUSINESS_HOURS_API?.getWeekdayKeyForDateValue) {
    return BUSINESS_HOURS_API.getWeekdayKeyForDateValue(dateValue, timeZone);
  }

  const date = buildPublicDateFromDateValue(dateValue);

  if (!date) {
    return "monday";
  }

  try {
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
    })
      .format(date)
      .toLowerCase();

    return BUSINESS_SCHEDULE_DAY_KEYS.includes(weekday) ? weekday : "monday";
  } catch (error) {
    return "monday";
  }
};

const formatPublicRelativeDateLabel = (dateValue, nowParts) => {
  if (!dateValue) {
    return "";
  }

  if (dateValue === nowParts.dateValue) {
    return "hoje";
  }

  if (dateValue === addDaysToPublicDateValue(nowParts.dateValue, 1)) {
    return "amanha";
  }

  return formatPublicDateValue(dateValue);
};

const getPublicSpecialDateForDate = (schedule = {}, dateValue = "") =>
  BUSINESS_HOURS_API?.getSpecialDateForDate
    ? BUSINESS_HOURS_API.getSpecialDateForDate(schedule, dateValue)
    : (Array.isArray(schedule.specialDates) ? schedule.specialDates : []).find(
        (entry) => entry.date === dateValue
      ) || null;

const getPublicBusinessDayForDate = (schedule = {}, dateValue = "") => {
  if (BUSINESS_HOURS_API?.getBusinessDayForDate) {
    const result = BUSINESS_HOURS_API.getBusinessDayForDate(schedule, dateValue, schedule.timeZone);
    return {
      dayKey: result.dayKey,
      day: result.day,
      specialDate: result.activeSpecialDate,
    };
  }

  const dayKey = getPublicWeekdayKeyForDateValue(dateValue, schedule.timeZone);
  const specialDate = getPublicSpecialDateForDate(schedule, dateValue);

  return {
    dayKey,
    day: specialDate || schedule.days?.[dayKey] || null,
    specialDate,
  };
};

const getPublicNextBusinessOpening = (schedule = {}, now = new Date(), nowParts = null) => {
  if (BUSINESS_HOURS_API?.getNextOpening) {
    const result = BUSINESS_HOURS_API.getNextOpening(schedule, now, nowParts, {
      includeCurrentOpenUntil: true,
    });

    return {
      dateValue: result.dateValue,
      timeValue: result.timeValue,
    };
  }

  const effectiveNowParts = nowParts || getPublicNowParts(now, schedule.timeZone);

  for (let offset = 0; offset < 14; offset += 1) {
    const dateValue = addDaysToPublicDateValue(effectiveNowParts.dateValue, offset);
    const { day } = getPublicBusinessDayForDate(schedule, dateValue);

    if (!day || day.isOpen === false) {
      continue;
    }

    const openMinutes = parsePublicTimeToMinutes(day.openTime);
    const closeMinutes = parsePublicTimeToMinutes(day.closeTime);
    const pauseStartMinutes = parsePublicTimeToMinutes(day.pauseStart);
    const pauseEndMinutes = parsePublicTimeToMinutes(day.pauseEnd);

    if (!Number.isFinite(openMinutes) || !Number.isFinite(closeMinutes)) {
      continue;
    }

    if (offset === 0) {
      if (effectiveNowParts.minuteOfDay < openMinutes) {
        return { dateValue, timeValue: day.openTime };
      }

      if (
        Number.isFinite(pauseStartMinutes) &&
        Number.isFinite(pauseEndMinutes) &&
        effectiveNowParts.minuteOfDay >= pauseStartMinutes &&
        effectiveNowParts.minuteOfDay < pauseEndMinutes
      ) {
        return { dateValue, timeValue: day.pauseEnd };
      }

      if (effectiveNowParts.minuteOfDay >= closeMinutes) {
        continue;
      }

      return { dateValue, timeValue: day.closeTime };
    }

    return { dateValue, timeValue: day.openTime };
  }

  return {
    dateValue: "",
    timeValue: "",
  };
};

const getPublicBusinessScheduleStatus = (now = new Date()) => {
  const settings = getRestaurantSettings();

  if (!settings.hasStructuredBusinessSchedule || !settings.businessSchedule) {
    return null;
  }

  const schedule = settings.businessSchedule;
  const status = BUSINESS_HOURS_API?.getBusinessHoursStatus
    ? BUSINESS_HOURS_API.getBusinessHoursStatus(schedule, now, schedule.timeZone, {
        includeCurrentOpenUntil: true,
      })
    : null;

  if (!status) {
    return null;
  }

  const nowParts = {
    dateValue: status.localDate,
    timeValue: status.localTime,
  };
  const { dayKey, day, specialDate } = {
    dayKey: status.dayKey,
    day: status.day,
    specialDate: status.activeSpecialDate,
  };
  const todayLabel = specialDate?.name || BUSINESS_SCHEDULE_DAY_LABELS[dayKey] || "Hoje";
  const todayHoursLabel = day ? formatPublicBusinessDayHours(day) : settings.businessHours;
  const isOpen = Boolean(status.isOpen);
  const closedReason = status.closedReason || (specialDate ? "special_date_closed" : "closed_day");
  const closeTimeLabel =
    closedReason === "pause" ? day?.pauseEnd || "" : day?.closeTime || status.closeTime || "";
  const nextOpening = {
    dateValue: status.nextOpeningDate,
    timeValue: status.nextOpeningTime,
  };
  const nextOpeningLabel =
    nextOpening.dateValue && nextOpening.timeValue
      ? `${formatPublicRelativeDateLabel(nextOpening.dateValue, nowParts)} as ${nextOpening.timeValue}`
      : "sem horario cadastrado";
  const closedMessage =
    specialDate?.message ||
    schedule.closedMessage ||
    RESTAURANT_SETTINGS_DEFAULTS.businessSchedule.closedMessage;
  const acceptsOutsideHours = schedule.acceptOrdersOutsideHours === true;
  const acceptsImmediateOrders = isOpen || acceptsOutsideHours;
  const specialDateLabel = specialDate
    ? specialDate.name
      ? `Data especial: ${specialDate.name}.`
      : "Data especial ativa."
    : "";
  const specialDateNotice = [specialDateLabel, specialDate?.message || ""]
    .filter(Boolean)
    .join(" ");
  const closedDetail =
    closedReason === "pause"
      ? `Estamos em pausa agora. Retorno previsto: ${nextOpeningLabel}.`
      : `${closedMessage} Proxima abertura: ${nextOpeningLabel}.`;

  return {
    isOpen,
    isSpecialDateActive: Boolean(specialDate),
    specialDate: specialDate
      ? {
          date: specialDate.date,
          name: specialDate.name || "",
          message: specialDate.message || "",
          isOpen: specialDate.isOpen !== false,
          openTime: specialDate.openTime || "",
          closeTime: specialDate.closeTime || "",
          pauseStart: specialDate.pauseStart || "",
          pauseEnd: specialDate.pauseEnd || "",
        }
      : null,
    specialDateNotice,
    acceptsImmediateOrders,
    acceptsOrdersOutsideHours: acceptsOutsideHours,
    statusTone: isOpen ? "open" : "closed",
    statusLabel: isOpen ? "Loja aberta" : "Loja fechada",
    shortStatusLabel: isOpen ? "Aberta agora" : "Fechada agora",
    businessWindowLabel: todayHoursLabel,
    businessScheduleLabel: formatPublicBusinessScheduleLabel(schedule),
    todayLabel,
    todayHoursLabel,
    nowDateValue: nowParts.dateValue,
    nowTimeValue: nowParts.timeValue,
    nextOpeningDateValue: nextOpening.dateValue,
    nextOpeningTimeValue: nextOpening.timeValue,
    nextOpeningLabel,
    closeTimeLabel,
    closedReason,
    closedMessage,
    warningMessage: isOpen ? "" : closedDetail,
    detail: isOpen
      ? `${specialDateNotice ? `${specialDateNotice} ` : ""}Pedidos imediatos liberados ate ${closeTimeLabel}.`
      : acceptsOutsideHours
        ? `${specialDateLabel ? `${specialDateLabel} ` : ""}${closedDetail} Ainda aceitamos pedidos fora do horario.`
        : `${specialDateLabel ? `${specialDateLabel} ` : ""}${closedDetail}`,
  };
};

const getPublicBusinessScheduleDefaultSchedule = (now = new Date()) => {
  const status = getPublicBusinessScheduleStatus(now);

  if (!status) {
    return null;
  }

  const settings = getRestaurantSettings();
  const schedule = settings.businessSchedule;
  const nowParts = getPublicNowParts(now, schedule.timeZone);
  const { day } = getPublicBusinessDayForDate(schedule, nowParts.dateValue);
  const step = 5;

  if (status.isOpen && day) {
    const closeMinutes = parsePublicTimeToMinutes(day.closeTime);
    const pauseStartMinutes = parsePublicTimeToMinutes(day.pauseStart);
    const pauseEndMinutes = parsePublicTimeToMinutes(day.pauseEnd);
    let nextMinutes = Math.ceil((nowParts.minuteOfDay + 1) / step) * step;

    if (
      Number.isFinite(pauseStartMinutes) &&
      Number.isFinite(pauseEndMinutes) &&
      nextMinutes >= pauseStartMinutes &&
      nextMinutes < pauseEndMinutes
    ) {
      nextMinutes = pauseEndMinutes;
    }

    if (nextMinutes <= closeMinutes) {
      return {
        dateValue: nowParts.dateValue,
        timeValue: formatPublicMinutesAsTime(nextMinutes),
      };
    }
  }

  return {
    dateValue: status.nextOpeningDateValue,
    timeValue: status.nextOpeningTimeValue,
  };
};

const getPublicBusinessScheduleConstraints = (selectedDate = "", now = new Date()) => {
  const status = getPublicBusinessScheduleStatus(now);

  if (!status) {
    return null;
  }

  const settings = getRestaurantSettings();
  const schedule = settings.businessSchedule;
  const nowParts = getPublicNowParts(now, schedule.timeZone);
  const defaultSchedule = getPublicBusinessScheduleDefaultSchedule(now);
  const effectiveDate = selectedDate || defaultSchedule.dateValue;
  const { day } = getPublicBusinessDayForDate(schedule, effectiveDate);
  const stepSeconds = 300;

  if (!day || day.isOpen === false) {
    return {
      minDate: nowParts.dateValue,
      timeMin: defaultSchedule.timeValue || "",
      timeMax: defaultSchedule.timeValue || "",
      stepSeconds,
      defaultDate: defaultSchedule.dateValue,
      defaultTime: defaultSchedule.timeValue,
      selectedDateAvailable: false,
    };
  }

  const openMinutes = parsePublicTimeToMinutes(day.openTime);
  const closeMinutes = parsePublicTimeToMinutes(day.closeTime);
  const pauseStartMinutes = parsePublicTimeToMinutes(day.pauseStart);
  const pauseEndMinutes = parsePublicTimeToMinutes(day.pauseEnd);
  let timeMin = day.openTime;
  let selectedDateAvailable = true;

  if (effectiveDate === nowParts.dateValue) {
    let nextTodayMinutes = Math.max(openMinutes, Math.ceil((nowParts.minuteOfDay + 1) / 5) * 5);

    if (
      Number.isFinite(pauseStartMinutes) &&
      Number.isFinite(pauseEndMinutes) &&
      nextTodayMinutes >= pauseStartMinutes &&
      nextTodayMinutes < pauseEndMinutes
    ) {
      nextTodayMinutes = pauseEndMinutes;
    }

    if (nextTodayMinutes > closeMinutes) {
      selectedDateAvailable = false;
    } else {
      timeMin = formatPublicMinutesAsTime(nextTodayMinutes);
    }
  }

  return {
    minDate: nowParts.dateValue,
    timeMin,
    timeMax: day.closeTime,
    stepSeconds,
    defaultDate: defaultSchedule.dateValue,
    defaultTime: defaultSchedule.timeValue,
    selectedDateAvailable,
  };
};

const validatePublicBusinessScheduleOrder = ({ dateValue = "", timeValue = "" } = {}, now = new Date()) => {
  const status = getPublicBusinessScheduleStatus(now);

  if (!status) {
    return null;
  }

  if (!dateValue) {
    return { isValid: false, reason: "missing_date" };
  }

  if (!timeValue) {
    return { isValid: false, reason: "missing_time" };
  }

  const settings = getRestaurantSettings();
  const schedule = settings.businessSchedule;
  const nowParts = getPublicNowParts(now, schedule.timeZone);
  const minutes = parsePublicTimeToMinutes(timeValue);

  if (!Number.isFinite(minutes)) {
    return { isValid: false, reason: "invalid_time" };
  }

  const { day } = getPublicBusinessDayForDate(schedule, dateValue);

  if (!day || day.isOpen === false) {
    return { isValid: false, reason: "closed_day" };
  }

  const openMinutes = parsePublicTimeToMinutes(day.openTime);
  const closeMinutes = parsePublicTimeToMinutes(day.closeTime);
  const pauseStartMinutes = parsePublicTimeToMinutes(day.pauseStart);
  const pauseEndMinutes = parsePublicTimeToMinutes(day.pauseEnd);

  if (minutes < openMinutes || minutes > closeMinutes) {
    return { isValid: false, reason: "outside_window" };
  }

  if (
    Number.isFinite(pauseStartMinutes) &&
    Number.isFinite(pauseEndMinutes) &&
    minutes >= pauseStartMinutes &&
    minutes < pauseEndMinutes
  ) {
    return { isValid: false, reason: "pause" };
  }

  if (`${dateValue}T${timeValue}` <= nowParts.dateTimeKey) {
    return { isValid: false, reason: "past" };
  }

  return { isValid: true, reason: "" };
};

const normalizePublicRestaurantSettingsPayload = (settings = {}) => {
  const source = settings && typeof settings === "object" ? settings : {};
  const defaults = RESTAURANT_SETTINGS_DEFAULTS;
  const hasStructuredAddressSource =
    Boolean(source.addressFields && typeof source.addressFields === "object") ||
    ["postalCode", "cep", "street", "rua", "number", "numero", "city", "cidade", "state", "estado"].some(
      (fieldName) => normalizePublicSettingsText(source[fieldName], "", 160)
    );
  const addressFields = normalizePublicAddressFields(
    hasStructuredAddressSource ? source.addressFields : defaults.addressFields,
    defaults.addressFields
  );
  const deliveryBase = normalizePublicDeliveryBase(
    {
      ...(source.deliveryBase && typeof source.deliveryBase === "object" ? source.deliveryBase : {}),
      fixedDeliveryFee:
        source.deliveryBase?.fixedDeliveryFee ?? source.defaultDeliveryFee ?? undefined,
    },
    defaults.deliveryBase
  );
  const hasStructuredBusinessSchedule =
    Boolean(source.businessSchedule && typeof source.businessSchedule === "object") ||
    Boolean(source.weeklySchedule && typeof source.weeklySchedule === "object") ||
    source.hasStructuredBusinessSchedule === true;
  const businessSchedule = normalizePublicBusinessSchedule(
    source.businessSchedule || source.weeklySchedule || defaults.businessSchedule,
    defaults.businessSchedule
  );
  const structuredAddress = buildPublicFriendlyAddress(addressFields, defaults.address);
  const address = normalizePublicSettingsText(
    source.address,
    hasStructuredAddressSource ? structuredAddress : defaults.address,
    260
  );
  const appearance = normalizePublicAppearance(source, defaults);

  return {
    restaurantKey: "default",
    restaurantName: normalizePublicSettingsText(source.restaurantName, defaults.restaurantName, 120),
    logoUrl: normalizePublicAssetUrl(source.logoUrl, defaults.logoUrl),
    bannerUrl: normalizePublicAssetUrl(source.bannerUrl, defaults.bannerUrl),
    primaryColor: appearance.colors.primary,
    secondaryColor: appearance.colors.secondary,
    accentColor: appearance.colors.accent,
    gradientStart: appearance.colors.gradientStart,
    gradientEnd: appearance.colors.gradientEnd,
    useGradient: appearance.colors.useGradient,
    siteLayout: appearance.layout,
    siteTheme: appearance.theme,
    slogan: appearance.identity.slogan,
    description: appearance.identity.description,
    instagram: appearance.social.instagram,
    facebook: appearance.social.facebook,
    tiktok: appearance.social.tiktok,
    site: appearance.social.site,
    seoTitle: appearance.seo.title,
    seoDescription: appearance.seo.description,
    seoShareImage: appearance.seo.shareImage,
    seoKeywords: [...appearance.seo.keywords],
    seoOpenGraph: { ...appearance.seo.openGraph },
    platformFooter: { ...appearance.platformFooter },
    appearance,
    whatsapp:
      String(source.whatsapp || defaults.whatsapp || "")
        .replace(/\D/g, "")
        .slice(0, 18) || defaults.whatsapp,
    address,
    addressFields,
    deliveryBase,
    businessHours: normalizePublicSettingsText(source.businessHours, defaults.businessHours, 160),
    businessSchedule,
    hasStructuredBusinessSchedule,
    defaultDeliveryFee: normalizePublicSettingsNumber(
      source.defaultDeliveryFee ?? deliveryBase.fixedDeliveryFee,
      deliveryBase.fixedDeliveryFee,
      2,
      500
    ),
    averagePreparationTimeMinutes: Math.round(
      normalizePublicSettingsNumber(
        source.averagePreparationTimeMinutes,
        defaults.averagePreparationTimeMinutes,
        0,
        360
      )
    ),
    presentationText: String(
      source.presentationText || appearance.identity.description || defaults.presentationText || ""
    )
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 900),
    updatedAt: normalizePublicSettingsText(source.updatedAt, "", 80),
  };
};

const getRestaurantSettings = () =>
  restaurantSettingsState.settings ||
  normalizePublicRestaurantSettingsPayload(RESTAURANT_SETTINGS_DEFAULTS);

const getPublicRestaurantName = () => getRestaurantSettings().restaurantName;
const getPublicStoreAddress = () => getRestaurantSettings().address || DELIVERY_STORE_ADDRESS;
const getPublicStoreLabel = () => getPublicStoreAddress();
const getPublicBusinessHoursLabel = (fallback = "18:00 as 23:00") => {
  const settings = getRestaurantSettings();

  if (settings.hasStructuredBusinessSchedule && settings.businessSchedule) {
    return formatPublicBusinessScheduleLabel(settings.businessSchedule) || settings.businessHours || fallback;
  }

  return settings.businessHours || fallback;
};
const getPublicWhatsappNumber = () => getRestaurantSettings().whatsapp || FALLBACK_WHATSAPP_NUMBER;
const getPublicWhatsappSupportHref = () => {
  const settings = getRestaurantSettings();
  const template =
    TOKYO_WHATSAPP_TEMPLATES.orderSupport ||
    "Ola, quero fazer um pedido no {restaurantName}.";
  const message = template.replace("{restaurantName}", settings.restaurantName);

  return `https://wa.me/${getPublicWhatsappNumber()}?text=${encodeURIComponent(message)}`;
};
const getPublicDefaultDeliveryFee = () =>
  Number(
    getRestaurantSettings().deliveryBase?.fixedDeliveryFee ||
      getRestaurantSettings().defaultDeliveryFee ||
      DELIVERY_MANUAL_FALLBACK_FEE
  );
const getPublicDeliveryPricePerKm = () =>
  Number(getRestaurantSettings().deliveryBase?.pricePerKm || 0);
const getPublicMinimumDeliveryOrder = () =>
  Number(getRestaurantSettings().deliveryBase?.minimumDeliveryOrder || 0);
const getPublicMaxDeliveryRadiusKm = () =>
  Number(getRestaurantSettings().deliveryBase?.maxDeliveryRadiusKm || 0);
const getPublicAveragePreparationMinutes = () =>
  Number(getRestaurantSettings().averagePreparationTimeMinutes || PICKUP_ESTIMATE_MINUTES);
const isPublicPickupEnabled = () => getRestaurantSettings().deliveryBase?.pickupEnabled !== false;
const isPublicDeliveryEnabled = () => getRestaurantSettings().deliveryBase?.deliveryEnabled !== false;
const getConfiguredPublicStoreCoordinates = () => {
  const deliveryBase = getRestaurantSettings().deliveryBase || {};
  const latitude = Number(deliveryBase.latitude);
  const longitude = Number(deliveryBase.longitude);

  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  ) {
    return {
      lat: latitude,
      lng: longitude,
    };
  }

  return null;
};
const getPublicStoreCoordinates = () =>
  getConfiguredPublicStoreCoordinates() || DELIVERY_STORE_COORDINATES;

const hexToRgba = (hexColor, alpha = 1) => {
  const normalizedColor = normalizePublicHexColor(hexColor, "#000000").slice(1);
  const red = Number.parseInt(normalizedColor.slice(0, 2), 16);
  const green = Number.parseInt(normalizedColor.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedColor.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, Number(alpha) || 0))})`;
};

const resolvePublicAssetUrl = (value) => {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue || normalizedValue.startsWith("/") || /^[a-z]+:\/\//i.test(normalizedValue)) {
    return normalizedValue;
  }

  return normalizedValue;
};

const setNodeText = (selector, value) => {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value;
  });
};

const setMetaContent = (selector, value, createOptions = null) => {
  if (!value) {
    return;
  }

  let nodes = Array.from(document.querySelectorAll(selector));

  if (!nodes.length && createOptions) {
    const meta = document.createElement("meta");
    Object.entries(createOptions).forEach(([key, optionValue]) => {
      meta.setAttribute(key, optionValue);
    });
    document.head.appendChild(meta);
    nodes = [meta];
  }

  nodes.forEach((node) => node.setAttribute("content", value));
};

const applyRestaurantMetaTags = (settings) => {
  const restaurantName = settings.restaurantName || RESTAURANT_SETTINGS_DEFAULTS.restaurantName;
  const pageTitle = document.title || restaurantName;
  const seo = settings.appearance?.seo || {
    title: settings.seoTitle,
    description: settings.seoDescription,
    shareImage: settings.seoShareImage,
    keywords: settings.seoKeywords,
    openGraph: settings.seoOpenGraph,
  };
  const seoTitle = seo.title || restaurantName;
  const seoDescription = seo.description || settings.description || settings.presentationText || "";
  const seoImage = seo.openGraph?.image || seo.shareImage || settings.bannerUrl;

  document
    .querySelectorAll('meta[name="application-name"], meta[property="og:site_name"]')
    .forEach((node) => node.setAttribute("content", restaurantName));

  const themeColor = document.querySelector('meta[name="theme-color"]');

  if (themeColor) {
    themeColor.setAttribute("content", settings.primaryColor);
  }

  if (document.body?.dataset.page === "inicio") {
    document.title = seoTitle;
  } else {
    const legacySiteName = TOKYO_RUNTIME_CONFIG.siteName || "Tokyo Sushi Delivery";

    if (pageTitle.includes(legacySiteName)) {
      document.title = pageTitle.replace(new RegExp(escapeRegex(legacySiteName), "g"), seoTitle);
    } else if (pageTitle.includes(restaurantName)) {
      document.title = pageTitle.replace(new RegExp(escapeRegex(restaurantName), "g"), seoTitle);
    }
  }

  setMetaContent('meta[name="description"]', seoDescription, { name: "description" });
  setMetaContent('meta[name="twitter:description"]', seoDescription, {
    name: "twitter:description",
  });
  setMetaContent('meta[property="og:description"]', seo.openGraph?.description || seoDescription, {
    property: "og:description",
  });
  setMetaContent('meta[property="og:title"], meta[name="twitter:title"]', seo.openGraph?.title || seoTitle);
  setMetaContent('meta[property="og:type"]', seo.openGraph?.type || "website", {
    property: "og:type",
  });
  setMetaContent('meta[name="keywords"]', (seo.keywords || []).join(", "), {
    name: "keywords",
  });
  setMetaContent('meta[property="og:image"], meta[name="twitter:image"]', seoImage);
};

const resolvePublicTheme = (theme) => {
  const normalizedTheme = String(theme || "").trim().toUpperCase();

  if (normalizedTheme === "LIGHT" || normalizedTheme === "DARK") {
    return normalizedTheme;
  }

  return window.matchMedia?.("(prefers-color-scheme: light)")?.matches ? "LIGHT" : "DARK";
};

const applyPublicSiteAppearance = (settings) => {
  const appearance = settings.appearance || normalizePublicAppearance(settings);
  const layout = String(appearance.layout || settings.siteLayout || "MODERN").toLowerCase();
  const themeMode = String(appearance.theme || settings.siteTheme || "DARK").toLowerCase();
  const resolvedTheme = resolvePublicTheme(appearance.theme || settings.siteTheme).toLowerCase();
  const colors = appearance.colors || {};
  const root = document.documentElement;

  root.dataset.siteLayout = layout;
  root.dataset.siteTheme = resolvedTheme;
  root.dataset.siteThemeMode = themeMode;
  root.style.setProperty("--primary", colors.primary || settings.primaryColor);
  root.style.setProperty("--primary-dark", colors.primary || settings.primaryColor);
  root.style.setProperty("--gold", colors.secondary || settings.secondaryColor);
  root.style.setProperty("--gold-soft", hexToRgba(colors.secondary || settings.secondaryColor, 0.18));
  root.style.setProperty("--site-primary", colors.primary || settings.primaryColor);
  root.style.setProperty("--site-secondary", colors.secondary || settings.secondaryColor);
  root.style.setProperty("--site-accent", colors.accent || settings.accentColor);
  root.style.setProperty("--site-gradient-start", colors.gradientStart || settings.gradientStart);
  root.style.setProperty("--site-gradient-end", colors.gradientEnd || settings.gradientEnd);
};

const syncRestaurantBranding = (settings) => {
  document.documentElement.style.setProperty("--primary", settings.primaryColor);
  document.documentElement.style.setProperty("--primary-dark", settings.primaryColor);
  document.documentElement.style.setProperty("--gold", settings.secondaryColor);
  document.documentElement.style.setProperty("--gold-soft", hexToRgba(settings.secondaryColor, 0.18));

  const logoUrl = resolvePublicAssetUrl(settings.logoUrl);
  const restaurantName = settings.restaurantName || RESTAURANT_SETTINGS_DEFAULTS.restaurantName;

  document.querySelectorAll(".brand-mark img").forEach((image) => {
    if (logoUrl) {
      image.src = logoUrl;
    }

    image.alt = `Logo ${restaurantName}`;
  });

  setNodeText(".brand-meta strong", restaurantName);
  setNodeText(".brand-meta small", settings.slogan || TOKYO_APP_BRANDING.brandTagline || "Delivery Premium");
  setNodeText("[data-public-restaurant-name]", restaurantName);
  setNodeText("[data-public-slogan]", settings.slogan || "");
};

const syncRestaurantBanner = (settings) => {
  const bannerUrl = resolvePublicAssetUrl(settings.bannerUrl);

  if (!bannerUrl) {
    return;
  }

  const heroCopy = document.querySelector(".hero-copy");

  if (heroCopy) {
    let banner = heroCopy.querySelector("[data-public-hero-banner]");

    if (!banner) {
      banner = document.createElement("figure");
      banner.className = "hero-brand-banner";
      banner.dataset.publicHeroBanner = "true";
      banner.innerHTML = '<img alt="" loading="lazy" decoding="async" />';
      const heroParagraph = heroCopy.querySelector("p");
      heroParagraph?.insertAdjacentElement("afterend", banner);
    }

    const image = banner.querySelector("img");

    if (image) {
      image.src = bannerUrl;
      image.alt = `${settings.restaurantName} - banner principal`;
    }
  }

  const catalogCopy = document.querySelector(".catalog-hero-copy");

  if (catalogCopy) {
    let banner = catalogCopy.querySelector("[data-public-catalog-banner]");

    if (!banner) {
      banner = document.createElement("figure");
      banner.className = "catalog-brand-banner";
      banner.dataset.publicCatalogBanner = "true";
      banner.innerHTML = '<img alt="" loading="lazy" decoding="async" />';
      catalogCopy.appendChild(banner);
    }

    const image = banner.querySelector("img");

    if (image) {
      image.src = bannerUrl;
      image.alt = `${settings.restaurantName} - banner do cardapio`;
    }
  }
};

const syncRestaurantCopy = (settings) => {
  const presentationText =
    settings.presentationText ||
    settings.description ||
    RESTAURANT_SETTINGS_DEFAULTS.presentationText;
  const businessHours = getPublicBusinessHoursLabel();
  const address = getPublicStoreAddress();

  setNodeText(".hero-copy > p", presentationText);
  setNodeText(".site-footer-copy", presentationText);
  setNodeText("[data-public-description]", settings.description || presentationText);
  setNodeText("[data-public-address]", address);
  setNodeText("[data-public-business-hours]", businessHours);

  const footerAddress = document.querySelector(
    '.site-footer-column[aria-labelledby="footer-location-title"] .site-footer-info-list p:first-child'
  );
  if (footerAddress) {
    footerAddress.textContent = address;
  }

  const footerHours = document.querySelector(
    '.site-footer-column[aria-labelledby="footer-location-title"] .site-footer-info-list p:nth-child(2)'
  );
  if (footerHours) {
    footerHours.textContent = `Funcionamento: ${businessHours}`;
  }

  const deliveryOriginNote = document.querySelector(".delivery-origin-note span");
  if (deliveryOriginNote) {
    deliveryOriginNote.textContent = address;
  }

  const deliveryOriginMetric = document.querySelector(".page-metrics article:first-child span");
  if (deliveryOriginMetric && document.body?.dataset.page === "entrega") {
    deliveryOriginMetric.textContent = address;
  }

  const footerBottom = document.querySelector("[data-public-footer-bottom-address]");
  if (footerBottom) {
    footerBottom.textContent = address;
  }

  const legacyFooterBottom = document.querySelector(".site-footer-bottom span:last-child");
  if (legacyFooterBottom) {
    legacyFooterBottom.textContent = address;
  }

  const footerCopyright = document.querySelector(".site-footer-bottom span:first-child");
  if (footerCopyright) {
    footerCopyright.textContent = `\u00a9 ${new Date().getFullYear()} ${settings.restaurantName}.`;
  }
};

const syncRestaurantWhatsappLinks = (settings) => {
  const href = getPublicWhatsappSupportHref();

  document.querySelectorAll('a[href*="wa.me"]').forEach((link) => {
    link.href = href;
    link.dataset.baseHref = href;
  });
};

const normalizePublicExternalHref = (value) => {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "";
  }

  if (/^(https?:|mailto:|tel:)/i.test(normalizedValue)) {
    return normalizedValue;
  }

  if (normalizedValue.startsWith("@")) {
    return `https://instagram.com/${normalizedValue.slice(1)}`;
  }

  return `https://${normalizedValue.replace(/^\/+/, "")}`;
};

const renderPublicSocialLinks = (settings) => {
  const links = [
    { label: "Instagram", href: settings.instagram },
    { label: "Facebook", href: settings.facebook },
    { label: "TikTok", href: settings.tiktok },
    { label: "Site", href: settings.site },
  ]
    .map((link) => ({
      ...link,
      href: normalizePublicExternalHref(link.href),
    }))
    .filter((link) => link.href);

  if (!links.length) {
    return '<p class="site-footer-info">Redes sociais ainda nao configuradas.</p>';
  }

  return links
    .map(
      (link) => `
        <a class="site-footer-link" href="${escapeHtml(link.href)}" target="_blank" rel="noreferrer">
          ${escapeHtml(link.label)}
        </a>
      `
    )
    .join("");
};

const syncRestaurantSocialLinks = (settings) => {
  document.querySelectorAll("[data-public-social-links]").forEach((node) => {
    node.innerHTML = renderPublicSocialLinks(settings);
  });
};

const getPublicPlatformFooter = (settings) =>
  settings.platformFooter || settings.appearance?.platformFooter || RESTAURANT_SETTINGS_DEFAULTS.platformFooter;

const syncPlatformFooter = (settings) => {
  const footer = getPublicPlatformFooter(settings);

  document.querySelectorAll("[data-platform-branding]").forEach((node) => {
    node.hidden = false;
    const headline = node.querySelector("[data-platform-branding-headline]");
    const logo = node.querySelector("[data-platform-branding-logo]");
    const description = node.querySelector("[data-platform-branding-description]");
    const link = node.querySelector("[data-platform-branding-link]");

    if (headline) {
      headline.textContent = footer.headline || "Desenvolvido por INOVAS Food";
    }

    if (logo) {
      logo.src = footer.logo || "./assets/inovas-food-logo-oficial.png";
      logo.alt = footer.brandName || "INOVAS Food";
    }

    if (description) {
      description.textContent = footer.description || "Plataforma profissional para restaurantes";
    }

    if (link) {
      link.textContent = footer.displayUrl || "www.inovasfood.com.br";
      link.href = normalizePublicExternalHref(footer.url || "https://www.inovasfood.com.br");
    }
  });
};

const syncPublicLayoutNavigation = () => {
  const catalogContainer = document.querySelector(".catalog-section .container");

  if (!catalogContainer || !Array.isArray(MENU_SECTIONS) || !MENU_SECTIONS.length) {
    return;
  }

  let nav = catalogContainer.querySelector("[data-public-layout-nav]");

  if (!nav) {
    nav = document.createElement("nav");
    nav.className = "public-layout-nav";
    nav.dataset.publicLayoutNav = "true";
    nav.setAttribute("aria-label", "Categorias do cardapio");
    const heading = catalogContainer.querySelector(".section-heading");
    heading?.insertAdjacentElement("afterend", nav);
  }

  nav.innerHTML = MENU_SECTIONS.map(
    (section) => `
      <a href="#${escapeHtml(section.id)}">
        <span>${escapeHtml(section.kicker || "Categoria")}</span>
        <strong>${escapeHtml(section.title || section.id)}</strong>
      </a>
    `
  ).join("");
};

const applyRestaurantSettingsToPublicSite = () => {
  const settings = getRestaurantSettings();

  applyPublicSiteAppearance(settings);
  applyRestaurantMetaTags(settings);
  syncRestaurantBranding(settings);
  syncRestaurantBanner(settings);
  syncRestaurantCopy(settings);
  syncRestaurantWhatsappLinks(settings);
  syncRestaurantSocialLinks(settings);
  syncPlatformFooter(settings);
  syncPublicLayoutNavigation();
  refreshStoreStatusUi({ rerenderCartUi: false });
};

const loadPublicRestaurantSettings = async ({ force = false } = {}) => {
  if (restaurantSettingsState.loading && !force) {
    return;
  }

  if (restaurantSettingsState.loaded && !force) {
    return;
  }

  restaurantSettingsState.loading = true;
  restaurantSettingsState.error = "";

  try {
    const payload = await getJsonWithTimeout(
      PUBLIC_RESTAURANT_SETTINGS_ENDPOINT,
      CUSTOMER_AUTH_REQUEST_TIMEOUT_MS
    );

    restaurantSettingsState.summary = payload.summary || null;
    restaurantSettingsState.settings = normalizePublicRestaurantSettingsPayload(payload.settings || {});
    restaurantSettingsState.loaded = true;
  } catch (error) {
    restaurantSettingsState.settings = normalizePublicRestaurantSettingsPayload(
      RESTAURANT_SETTINGS_DEFAULTS
    );
    restaurantSettingsState.error = error?.message || "Nao foi possivel carregar o restaurante.";
  } finally {
    restaurantSettingsState.loading = false;
    if (deliverySettingsState.settings) {
      deliverySettingsState.settings = normalizeDeliverySettingsPayload(deliverySettingsState.settings);
    } else if (deliverySettingsState.error && !deliverySettingsState.loaded) {
      deliverySettingsState.settings = normalizeDeliverySettingsPayload(DELIVERY_SETTINGS_DEFAULTS);
    }
    applyRestaurantSettingsToPublicSite();
    renderCart();
  }
};

const cloneDeliverySettingsDefaults = () => {
  const defaults = JSON.parse(JSON.stringify(DELIVERY_SETTINGS_DEFAULTS));
  const restaurantSettings = getRestaurantSettings();
  const defaultDeliveryFee = getPublicDefaultDeliveryFee();
  const averagePreparationMinutes = getPublicAveragePreparationMinutes();
  const maxDeliveryRadiusKm = getPublicMaxDeliveryRadiusKm();

  defaults.distanceBands = defaults.distanceBands.map((band, index) =>
    index === 0
      ? {
          ...band,
          customerFee: defaultDeliveryFee,
          minimumOrder: getPublicMinimumDeliveryOrder(),
        }
      : band
  );
  defaults.serviceArea = {
    ...defaults.serviceArea,
    maxRadiusKm: maxDeliveryRadiusKm || defaults.serviceArea.maxRadiusKm,
  };
  defaults.deliveryTime = {
    ...defaults.deliveryTime,
    minMinutes: averagePreparationMinutes,
    maxMinutes: Math.max(averagePreparationMinutes, Number(defaults.deliveryTime.maxMinutes || 0)),
  };
  defaults.pickup = {
    ...defaults.pickup,
    enabled: isPublicPickupEnabled(),
    estimateMinutes: averagePreparationMinutes,
    message: `Retirada disponivel em ${averagePreparationMinutes} minutos`,
  };
  defaults.status = {
    ...defaults.status,
    deliveriesEnabled: isPublicDeliveryEnabled(),
  };

  if (restaurantSettings.averagePreparationTimeMinutes) {
    defaults.deliveryTime.message = `Entrega estimada a partir de ${averagePreparationMinutes} minutos`;
  }

  return defaults;
};

const normalizeDeliverySettingsNumber = (value, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const normalizedValue = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=.*\.)/g, "")
    .replace(",", ".");
  const numericValue = Number(normalizedValue);

  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const normalizeDeliverySettingsBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  const normalizedValue = String(value || "").trim().toLowerCase();

  if (["true", "1", "yes", "sim", "on"].includes(normalizedValue)) {
    return true;
  }

  if (["false", "0", "no", "nao", "off"].includes(normalizedValue)) {
    return false;
  }

  return fallback;
};

const normalizeDeliverySettingsTextList = (value) => {
  const source = Array.isArray(value) ? value : String(value || "").split(/\r?\n|;|,/g);

  return [
    ...new Set(
      source
        .map((entry) => String(entry || "").replace(/^[-*]\s*/, "").trim())
        .filter(Boolean)
    ),
  ];
};

const normalizeDeliverySettingsPayload = (settings = {}) => {
  const defaults = cloneDeliverySettingsDefaults();
  const source = settings && typeof settings === "object" ? settings : {};
  const distanceBands = (
    Array.isArray(source.distanceBands) ? source.distanceBands : defaults.distanceBands
  )
    .map((band, index) => {
      const defaultBand = defaults.distanceBands[index] || {};
      const minKm = Math.max(0, normalizeDeliverySettingsNumber(band?.minKm, defaultBand.minKm || 0));
      const rawMaxKm =
        band?.maxKm === null || typeof band?.maxKm === "undefined" || band?.maxKm === ""
          ? null
          : normalizeDeliverySettingsNumber(band.maxKm, defaultBand.maxKm || minKm);
      const maxKm = rawMaxKm === null ? null : Math.max(minKm, rawMaxKm);

      return {
        id: String(band?.id || defaultBand.id || `band-${index + 1}`).trim(),
        minKm,
        maxKm,
        label: String(band?.label || "").trim(),
        customerFee: Math.max(
          0,
          normalizeDeliverySettingsNumber(band?.customerFee, defaultBand.customerFee || 0)
        ),
        courierFee: Math.max(
          0,
          normalizeDeliverySettingsNumber(band?.courierFee, defaultBand.courierFee || 0)
        ),
        minimumOrder: Math.max(
          0,
          normalizeDeliverySettingsNumber(band?.minimumOrder, defaultBand.minimumOrder || 0)
        ),
        isActive: normalizeDeliverySettingsBoolean(band?.isActive, defaultBand.isActive !== false),
      };
    })
    .filter((band) => band.id)
    .sort((left, right) => left.minKm - right.minKm || (left.maxKm ?? 9999) - (right.maxKm ?? 9999));
  const deliveryTime = source.deliveryTime && typeof source.deliveryTime === "object" ? source.deliveryTime : {};
  const serviceArea = source.serviceArea && typeof source.serviceArea === "object" ? source.serviceArea : {};
  const freeShipping = source.freeShipping && typeof source.freeShipping === "object" ? source.freeShipping : {};
  const pickup = source.pickup && typeof source.pickup === "object" ? source.pickup : {};
  const status = source.status && typeof source.status === "object" ? source.status : {};
  const maxDeliveryRadiusKm = getPublicMaxDeliveryRadiusKm();
  const minMinutes = Math.max(
    0,
    Math.round(normalizeDeliverySettingsNumber(deliveryTime.minMinutes, defaults.deliveryTime.minMinutes))
  );
  const maxMinutes = Math.max(
    minMinutes,
    Math.round(normalizeDeliverySettingsNumber(deliveryTime.maxMinutes, defaults.deliveryTime.maxMinutes))
  );

  return {
    distanceBands: distanceBands.length ? distanceBands : defaults.distanceBands,
    deliveryTime: {
      minMinutes,
      maxMinutes,
      message: String(deliveryTime.message || defaults.deliveryTime.message || "").trim(),
    },
    serviceArea: {
      maxRadiusKm:
        maxDeliveryRadiusKm > 0
          ? maxDeliveryRadiusKm
          : Math.max(
              0,
              normalizeDeliverySettingsNumber(serviceArea.maxRadiusKm, defaults.serviceArea.maxRadiusKm)
            ),
      servedNeighborhoods: normalizeDeliverySettingsTextList(serviceArea.servedNeighborhoods),
      blockedNeighborhoods: normalizeDeliverySettingsTextList(serviceArea.blockedNeighborhoods),
      outOfAreaMessage:
        String(serviceArea.outOfAreaMessage || defaults.serviceArea.outOfAreaMessage || "").trim(),
    },
    freeShipping: {
      enabled: normalizeDeliverySettingsBoolean(freeShipping.enabled, defaults.freeShipping.enabled),
      minimumOrder: Math.max(
        0,
        normalizeDeliverySettingsNumber(freeShipping.minimumOrder, defaults.freeShipping.minimumOrder)
      ),
      appliesToAllBands: normalizeDeliverySettingsBoolean(
        freeShipping.appliesToAllBands,
        defaults.freeShipping.appliesToAllBands
      ),
      bandIds: normalizeDeliverySettingsTextList(freeShipping.bandIds),
    },
    pickup: {
      enabled:
        isPublicPickupEnabled() &&
        normalizeDeliverySettingsBoolean(pickup.enabled, defaults.pickup.enabled),
      estimateMinutes: Math.max(
        0,
        Math.round(normalizeDeliverySettingsNumber(pickup.estimateMinutes, defaults.pickup.estimateMinutes))
      ),
      message: String(pickup.message || defaults.pickup.message || "").trim(),
    },
    status: {
      deliveriesEnabled:
        isPublicDeliveryEnabled() &&
        normalizeDeliverySettingsBoolean(
          status.deliveriesEnabled,
          defaults.status.deliveriesEnabled
        ),
      pausedMessage: String(status.pausedMessage || defaults.status.pausedMessage || "").trim(),
    },
    updatedAt: String(source.updatedAt || "").trim(),
  };
};

const getDeliverySettings = () =>
  deliverySettingsState.settings || normalizeDeliverySettingsPayload(DELIVERY_SETTINGS_DEFAULTS);

const getDeliveryTimeText = () => {
  const settings = getDeliverySettings();
  const message = String(settings.deliveryTime?.message || "").trim();
  const minMinutes = Number(settings.deliveryTime?.minMinutes || 0);
  const maxMinutes = Number(settings.deliveryTime?.maxMinutes || minMinutes || 0);

  if (message) {
    return message
      .replace(/\{min\}/g, String(minMinutes))
      .replace(/\{max\}/g, String(maxMinutes));
  }

  return `Entrega estimada entre ${minMinutes} e ${maxMinutes} minutos`;
};

const getDeliveryAreaKey = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const getDeliveryBandLabel = (band) => {
  if (band?.label) {
    return band.label;
  }

  const minKm = Number(band?.minKm || 0);
  const maxKm =
    band?.maxKm === null || typeof band?.maxKm === "undefined" ? null : Number(band.maxKm);

  if (maxKm === null || !Number.isFinite(maxKm)) {
    return `Acima de ${String(minKm).replace(".", ",")} km`;
  }

  if (minKm <= 0) {
    return `Ate ${String(maxKm).replace(".", ",")} km`;
  }

  return `${String(minKm).replace(".", ",")} a ${String(maxKm).replace(".", ",")} km`;
};

const getActiveDeliveryBands = (settings = getDeliverySettings()) =>
  (Array.isArray(settings.distanceBands) ? settings.distanceBands : [])
    .filter((band) => band?.isActive !== false)
    .sort((left, right) => left.minKm - right.minKm || (left.maxKm ?? 9999) - (right.maxKm ?? 9999));

const findDeliveryBandForDistance = (distanceKm, settings = getDeliverySettings()) => {
  const numericDistance = Math.max(0, Number(distanceKm) || 0);

  return (
    getActiveDeliveryBands(settings).find((band) => {
      const minKm = Math.max(0, Number(band.minKm || 0));
      const maxKm =
        band.maxKm === null || typeof band.maxKm === "undefined" ? null : Number(band.maxKm);

      return numericDistance + 0.0001 >= minKm && (maxKm === null || numericDistance <= maxKm + 0.0001);
    }) || null
  );
};

const getDeliveryOutOfAreaMessage = (settings = getDeliverySettings()) =>
  settings.serviceArea?.outOfAreaMessage || "No momento nao entregamos nessa regiao.";

const getDeliveryOperationalMessage = () => {
  const settings = getDeliverySettings();

  if (!isPublicDeliveryEnabled()) {
    return "Entregas indisponiveis no momento.";
  }

  if (settings.status?.deliveriesEnabled === false) {
    return settings.status?.pausedMessage || "Entregas pausadas temporariamente.";
  }

  return "";
};

const getFulfillmentOptionAvailability = (optionId) => {
  const settings = getDeliverySettings();

  if (optionId === "delivery" && !isPublicDeliveryEnabled()) {
    return {
      available: false,
      message: "Entregas indisponiveis no momento.",
    };
  }

  if (optionId === "delivery" && settings.status?.deliveriesEnabled === false) {
    return {
      available: false,
      message: getDeliveryOperationalMessage(),
    };
  }

  if (optionId === "pickup" && !isPublicPickupEnabled()) {
    return {
      available: false,
      message: "Retirada no balcao indisponivel no momento.",
    };
  }

  if (optionId === "pickup" && settings.pickup?.enabled === false) {
    return {
      available: false,
      message: "Retirada no balcao indisponivel no momento.",
    };
  }

  return {
    available: true,
    message: "",
  };
};

const isFreeShippingApplicable = (band, cartSubtotal, settings = getDeliverySettings()) => {
  const freeShipping = settings.freeShipping || {};
  const minimumOrder = Number(freeShipping.minimumOrder || 0);

  if (!freeShipping.enabled || !Number.isFinite(cartSubtotal) || cartSubtotal < minimumOrder) {
    return false;
  }

  if (freeShipping.appliesToAllBands !== false) {
    return true;
  }

  return (Array.isArray(freeShipping.bandIds) ? freeShipping.bandIds : []).includes(band?.id);
};

const resolveConfiguredDeliveryPricing = ({
  distanceKm,
  neighborhood = "",
  cartSubtotal = getCartTotalAmount(loadCart(), loadCartAddons()),
  settings = getDeliverySettings(),
} = {}) => {
  if (!isPublicDeliveryEnabled()) {
    return {
      deliverable: false,
      reason: "restaurant_delivery_disabled",
      message: getDeliveryOperationalMessage(),
    };
  }

  if (settings.status?.deliveriesEnabled === false) {
    return {
      deliverable: false,
      reason: "paused",
      message: getDeliveryOperationalMessage(),
    };
  }

  const numericDistance = Math.max(0, Number(distanceKm) || 0);
  const serviceArea = settings.serviceArea || {};
  const outOfAreaMessage = getDeliveryOutOfAreaMessage(settings);
  const configuredMaxRadiusKm = getPublicMaxDeliveryRadiusKm();
  const maxRadiusKm = Number(configuredMaxRadiusKm || serviceArea.maxRadiusKm || 0);

  if (maxRadiusKm > 0 && numericDistance > maxRadiusKm + 0.0001) {
    return {
      deliverable: false,
      reason: "out_of_radius",
      message: outOfAreaMessage,
    };
  }

  const neighborhoodKey = getDeliveryAreaKey(neighborhood);
  const blockedNeighborhoodKeys = normalizeDeliverySettingsTextList(serviceArea.blockedNeighborhoods).map(
    getDeliveryAreaKey
  );
  const servedNeighborhoodKeys = normalizeDeliverySettingsTextList(serviceArea.servedNeighborhoods).map(
    getDeliveryAreaKey
  );

  if (neighborhoodKey && blockedNeighborhoodKeys.includes(neighborhoodKey)) {
    return {
      deliverable: false,
      reason: "blocked_neighborhood",
      message: outOfAreaMessage,
    };
  }

  if (servedNeighborhoodKeys.length > 0 && (!neighborhoodKey || !servedNeighborhoodKeys.includes(neighborhoodKey))) {
    return {
      deliverable: false,
      reason: "not_served_neighborhood",
      message: outOfAreaMessage,
    };
  }

  const band = findDeliveryBandForDistance(numericDistance, settings);
  const buildMatchedPricing = ({
    matchedBand,
    bandLabel,
    regularFee,
    courierFee = 0,
    minimumOrder = 0,
  }) => {
    const effectiveMinimumOrder = Math.max(
      Number(minimumOrder || 0),
      getPublicMinimumDeliveryOrder()
    );
    const isMinimumOrderMet =
      !effectiveMinimumOrder ||
      (Number.isFinite(cartSubtotal) && cartSubtotal >= effectiveMinimumOrder);
    const minimumOrderDifference = isMinimumOrderMet
      ? 0
      : Number((effectiveMinimumOrder - (Number.isFinite(cartSubtotal) ? cartSubtotal : 0)).toFixed(2));
    const freeShippingApplied = isFreeShippingApplicable(matchedBand, cartSubtotal, settings);

    return {
      deliverable: true,
      reason: "matched",
      band: matchedBand,
      bandLabel,
      regularFee,
      fee: freeShippingApplied ? 0 : regularFee,
      courierFee,
      minimumOrder: effectiveMinimumOrder,
      isMinimumOrderMet,
      minimumOrderDifference,
      minimumOrderMessage:
        effectiveMinimumOrder > 0
          ? isMinimumOrderMet
            ? `Pedido minimo para entrega atingido (${formatPrice(effectiveMinimumOrder)}).`
            : `Pedido minimo para entrega: ${formatPrice(effectiveMinimumOrder)}. Faltam ${formatPrice(
                minimumOrderDifference
              )}.`
          : "",
      freeShippingApplied,
      freeShippingMessage: freeShippingApplied
        ? `Frete gratis aplicado em pedidos acima de ${formatPrice(settings.freeShipping?.minimumOrder || 0)}.`
        : "",
    };
  };

  if (!band) {
    const fixedDeliveryFee = getPublicDefaultDeliveryFee();
    const pricePerKm = getPublicDeliveryPricePerKm();

    if (fixedDeliveryFee > 0 || pricePerKm > 0) {
      const regularFee = Number((fixedDeliveryFee + numericDistance * pricePerKm).toFixed(2));
      const fallbackBand = {
        id: "restaurant-base-price-per-km",
        minKm: 0,
        maxKm: maxRadiusKm || null,
        label:
          pricePerKm > 0
            ? `Taxa base + ${formatPrice(pricePerKm)} por km`
            : "Taxa fixa padrao",
        customerFee: regularFee,
        courierFee: 0,
        minimumOrder: getPublicMinimumDeliveryOrder(),
        isActive: true,
      };

      return buildMatchedPricing({
        matchedBand: fallbackBand,
        bandLabel: fallbackBand.label,
        regularFee,
        courierFee: 0,
        minimumOrder: fallbackBand.minimumOrder,
      });
    }

    return {
      deliverable: false,
      reason: "no_band",
      message: outOfAreaMessage,
    };
  }

  return buildMatchedPricing({
    matchedBand: band,
    bandLabel: getDeliveryBandLabel(band),
    regularFee: Number(band.customerFee || 0),
    courierFee: Number(band.courierFee || 0),
    minimumOrder: Number(band.minimumOrder || 0),
  });
};

const applyDeliveryPricingToQuote = (quote) => {
  if (!quote) {
    return null;
  }

  const cartSubtotal = getCartTotalAmount(loadCart(), loadCartAddons());
  const pricing = resolveConfiguredDeliveryPricing({
    distanceKm: Number(quote.distanceKm || 0),
    neighborhood: quote.neighborhood || "",
    cartSubtotal,
  });

  if (!pricing.deliverable) {
    return {
      ...quote,
      deliveryUnavailableMessage: pricing.message,
      deliveryUnavailableReason: pricing.reason,
      isMinimumOrderMet: false,
    };
  }

  return {
    ...quote,
    routeBand: pricing.bandLabel,
    fee: pricing.fee,
    regularFee: pricing.regularFee,
    courierFee: pricing.courierFee,
    minimumOrder: pricing.minimumOrder,
    isMinimumOrderMet: pricing.isMinimumOrderMet,
    minimumOrderDifference: pricing.minimumOrderDifference,
    minimumOrderMessage: pricing.minimumOrderMessage,
    freeShippingApplied: pricing.freeShippingApplied,
    freeShippingMessage: pricing.freeShippingMessage,
    pricingRuleLabel: pricing.freeShippingApplied
      ? pricing.freeShippingMessage
      : `${pricing.bandLabel}: ${formatPrice(pricing.regularFee)}.`,
    totalEstimateText: getDeliveryTimeText(),
    deliverySettingsUpdatedAt: getDeliverySettings().updatedAt || "",
    deliveryUnavailableMessage: "",
    deliveryUnavailableReason: "",
  };
};

const reconcileCartFulfillmentSelection = () => {
  const checkout = loadCartCheckout();

  if (checkout.fulfillmentMode === "delivery" && !getFulfillmentOptionAvailability("delivery").available) {
    saveCartCheckout({
      ...checkout,
      fulfillmentMode: getFulfillmentOptionAvailability("pickup").available ? "pickup" : "",
    });
    return;
  }

  if (checkout.fulfillmentMode === "pickup" && !getFulfillmentOptionAvailability("pickup").available) {
    saveCartCheckout({
      ...checkout,
      fulfillmentMode: getFulfillmentOptionAvailability("delivery").available ? "delivery" : "",
    });
  }
};

const loadPublicDeliverySettings = async ({ force = false } = {}) => {
  if (deliverySettingsState.loading && !force) {
    return;
  }

  if (deliverySettingsState.loaded && !force) {
    return;
  }

  deliverySettingsState.loading = true;
  deliverySettingsState.error = "";

  try {
    const payload = await getJsonWithTimeout(PUBLIC_DELIVERY_SETTINGS_ENDPOINT, CUSTOMER_AUTH_REQUEST_TIMEOUT_MS);

    deliverySettingsState.summary = payload.summary || null;
    deliverySettingsState.settings = normalizeDeliverySettingsPayload(payload.settings || {});
    deliverySettingsState.loaded = true;
  } catch (error) {
    deliverySettingsState.settings = normalizeDeliverySettingsPayload(DELIVERY_SETTINGS_DEFAULTS);
    deliverySettingsState.error = error?.message || "Nao foi possivel carregar as entregas.";
  } finally {
    deliverySettingsState.loading = false;
    reconcileCartFulfillmentSelection();
    renderDeliveryHistory();
    renderCart();
  }
};

const requestPhoneVerificationDelivery = async (verification) => {
  const customerClientToken = ensureCustomerClientToken();
  const response = await postJsonWithTimeout(
    CUSTOMER_AUTH_START_ENDPOINT,
    {
      name: verification.name,
      phone: verification.phone,
    },
    CUSTOMER_AUTH_REQUEST_TIMEOUT_MS,
    {
      headers: {
        [CUSTOMER_CLIENT_TOKEN_HEADER]: customerClientToken,
      },
    }
  );

  return {
    mode: response.deliveryMode || "whatsapp-api",
    notice:
      response.notice ||
      `Codigo enviado pelo WhatsApp para ${maskPhoneDisplay(verification.phone)}.`,
    previewCode: response.previewCode || "",
  };
};

const getAuthProviderConfig = (provider) => {
  const configs = {
    google: {
      label: "Google",
      className: "auth-social-icon-google",
      launchLabel: "Abrir Google para verificar",
      description: "Abrimos a verificacao do Google para autenticar voce sem formulario extra.",
      actionLabel: "Continuar com Google",
      href: "https://accounts.google.com/",
    },
    facebook: {
      label: "Facebook",
      className: "auth-social-icon-facebook",
      launchLabel: "Abrir Facebook para verificar",
      description: "Abrimos a verificacao do Facebook para autenticar voce sem formulario extra.",
      actionLabel: "Continuar com Facebook",
      href: "https://www.facebook.com/",
    },
    instagram: {
      label: "Instagram",
      className: "auth-social-icon-instagram",
      launchLabel: "Abrir Instagram para verificar",
      description: "Abrimos a verificacao do Instagram para autenticar voce sem formulario extra.",
      actionLabel: "Continuar com Instagram",
      href: "https://www.instagram.com/",
    },
  };

  return configs[provider] || null;
};

const loadAuthAccounts = () => {
  try {
    const parsed = JSON.parse(getStoredString(AUTH_ACCOUNTS_KEY, "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const saveAuthAccounts = (accounts) => {
  setStoredString(AUTH_ACCOUNTS_KEY, JSON.stringify(accounts));
};

const loadAuthProfile = () => {
  try {
    const parsed = JSON.parse(getStoredString(AUTH_PROFILE_KEY, "null"));

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const email = normalizeEmail(parsed.email);
    const phone = normalizePhone(parsed.phone);
    const name = String(parsed.name || "").trim();

    if (!name || (!email && !phone)) {
      return null;
    }

    return {
      id: parsed.id || `profile_${email || phone}`,
      name,
      email,
      phone,
      provider: parsed.provider || "phone",
    };
  } catch (error) {
    return null;
  }
};

const saveAuthProfile = (profile) => {
  setStoredString(
    AUTH_PROFILE_KEY,
    JSON.stringify({
      id: profile.id,
      name: profile.name,
      email: normalizeEmail(profile.email || ""),
      phone: normalizePhone(profile.phone),
      provider: profile.provider || "phone",
    })
  );
};

const createSocialAccountProfile = (provider) => {
  const config = getAuthProviderConfig(provider);
  const accounts = loadAuthAccounts();
  const existingAccount = accounts
    .filter((account) => account.provider === provider)
    .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")))[0];

  if (existingAccount) {
    return {
      id: existingAccount.id,
      name: existingAccount.name,
      email: existingAccount.email,
      phone: existingAccount.phone,
      provider: existingAccount.provider,
    };
  }

  const now = new Date().toISOString();
  const timestamp = Date.now();
  const account = {
    id: `social_${provider}_${timestamp}`,
    name: `Conta ${config?.label || "Social"}`,
    email: `${provider}.${timestamp}@${SOCIAL_EMAIL_DOMAIN}`,
    phone: "",
    provider,
    password: "",
    createdAt: now,
    updatedAt: now,
  };

  saveAuthAccounts([...accounts, account]);

  return {
    id: account.id,
    name: account.name,
    email: account.email,
    phone: account.phone,
    provider: account.provider,
  };
};

const clearAuthProfile = () => {
  removeStoredValue(AUTH_PROFILE_KEY);
};

const upsertPhoneAccountProfile = (name, phone) => {
  const accounts = loadAuthAccounts();
  const now = new Date().toISOString();
  const existingAccount = accounts.find(
    (account) => account.provider === "phone" && normalizePhone(account.phone) === phone
  );

  const account = existingAccount
    ? {
        ...existingAccount,
        name,
        phone,
        updatedAt: now,
      }
    : {
        id: `phone_${phone}`,
        name,
        email: "",
        phone,
        provider: "phone",
        password: "",
        createdAt: now,
        updatedAt: now,
      };

  const savedAccounts = accounts.filter((item) => item.id !== account.id);
  savedAccounts.push(account);
  saveAuthAccounts(savedAccounts);

  return {
    id: account.id,
    name: account.name,
    email: account.email || "",
    phone: account.phone,
    provider: account.provider,
  };
};

const serializeDraft = (formData) => {
  const draft = {};

  Array.from(formData.entries()).forEach(([key, value]) => {
    draft[key] = String(value || "");
  });

  return draft;
};

const createAuthShell = () => {
  if (document.querySelector("[data-auth-shell]")) {
    return;
  }

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div class="auth-shell" data-auth-shell aria-hidden="true">
        <div class="auth-backdrop" data-auth-close></div>
        <section class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <button class="auth-close" type="button" data-auth-close aria-label="Fechar login">&times;</button>
          <figure class="auth-media">
            <img
              src="${escapeHtml(TOKYO_ASSETS.loginCover || "./site-images/login-cover-floating.png")}"
              alt="${escapeHtml(TOKYO_PUBLIC_TEXT.loginCoverAlt || "Arte de login Tokyo Sushi com cerejeiras, logo e combinado de sushi")}"
            />
          </figure>
          <div class="auth-panel" data-auth-panel></div>
        </section>
      </div>
    `
  );

  schedulePortugueseUiRefresh();
};

const updateAuthTriggers = () => {
  const profile = loadAuthProfile();
  const isAuthenticated = Boolean(profile);
  const firstName = isAuthenticated ? getFirstName(profile.name) : "Entrar";

  document.body.classList.toggle("is-authenticated", isAuthenticated);

  document.querySelectorAll("[data-auth-open]").forEach((button) => {
    const avatar = button.querySelector("[data-auth-avatar]");
    const label = button.querySelector("[data-auth-label]");
    const subtitle = button.querySelector("[data-auth-subtitle]");

    button.classList.toggle("is-authenticated", isAuthenticated);
    button.setAttribute(
      "aria-label",
      isAuthenticated ? `Abrir conta de ${firstName}` : "Abrir login"
    );

    if (avatar) {
      avatar.innerHTML = ACCOUNT_ICON_MARKUP;
    }

    if (label) {
      label.textContent = firstName;
    }

    if (subtitle) {
      subtitle.textContent = "";
      subtitle.hidden = true;
    }
  });

  syncHeaderOrderCta();
};

const renderAuthPanel = () => {
  const panel = document.querySelector("[data-auth-panel]");
  const profile = loadAuthProfile();

  if (!panel) {
    return;
  }

  if (profile && !authState.editing) {
    panel.dataset.authView = "profile";
    const displayEmail = getDisplayEmail(profile);

    panel.innerHTML = `
      <div class="auth-panel-head">
        <p class="section-tag">Login ativo</p>
        <h2 id="auth-title">Seus dados ja estao prontos</h2>
        <p>Seu atendimento e seus pedidos pelo WhatsApp agora podem sair com identificacao completa.</p>
      </div>

      <div class="auth-profile-card glass-card">
        <div class="auth-profile-top">
          <span class="auth-profile-avatar">${escapeHtml(getInitials(profile.name))}</span>
          <div>
            <strong>${escapeHtml(profile.name)}</strong>
            <small>${escapeHtml(getAuthProviderLabel(profile.provider))}</small>
          </div>
        </div>

        <div class="auth-profile-list">
          <div>
            <span>Nome</span>
            <strong>${escapeHtml(profile.name)}</strong>
          </div>
          ${
            displayEmail
              ? `
                <div>
                  <span>E-mail</span>
                  <strong>${escapeHtml(displayEmail)}</strong>
                </div>
              `
              : ""
          }
          <div>
            <span>Telefone</span>
            <strong>${escapeHtml(formatPhoneDisplay(profile.phone) || "Nao informado")}</strong>
          </div>
        </div>
      </div>

      <div class="auth-profile-actions">
        <button class="button button-primary" type="button" data-auth-edit>Editar dados</button>
        <button class="button button-outline" type="button" data-auth-logout>Sair</button>
      </div>

      ${
        authState.message
          ? `<div class="auth-message auth-message-note">${escapeHtml(authState.message)}</div>`
          : ""
      }
    `;

    schedulePortugueseUiRefresh();
    return;
  }

  const socialConfig = authState.socialProvider
    ? getAuthProviderConfig(authState.socialProvider)
    : null;

  if (authState.view === "social" && socialConfig) {
    panel.dataset.authView = "social";
    const isProcessing = authState.socialStatus === "processing";
    const socialIconMarkup = getAuthProviderIconMarkup(authState.socialProvider);

    panel.innerHTML = `
      <div class="auth-panel-head">
        <p class="section-tag">Verificacao no app</p>
        <h2 id="auth-title">Confirme seu acesso com ${socialConfig.label}</h2>
        <p>${socialConfig.description}</p>
      </div>

      <div class="auth-social-verify glass-card">
        <div class="auth-social-verify-top">
          <span class="auth-social-icon ${socialConfig.className}">${socialIconMarkup}</span>
          <div>
            <strong>${socialConfig.label}</strong>
            <small>Sem necessidade de formulario manual</small>
          </div>
        </div>

        <div class="auth-social-steps">
          <div>
            <span>1</span>
            <p>Abrimos a solicitacao de verificacao.</p>
          </div>
          <div>
            <span>2</span>
            <p>Voce confirma o acesso no app ou na conta do ${socialConfig.label}.</p>
          </div>
          <div>
            <span>3</span>
            <p>Voltamos com seu acesso liberado neste aparelho.</p>
          </div>
        </div>

        ${
          isProcessing
            ? `
              <div class="auth-social-processing">
                <div class="auth-social-progress-bar">
                  <span></span>
                </div>
                <p>Aguardando confirmacao do ${socialConfig.label}. Assim que concluir, liberamos seu acesso.</p>
              </div>
            `
            : `
              <div class="auth-social-actions">
                <button class="button button-primary" type="button" data-auth-start-social>
                  ${socialConfig.launchLabel}
                </button>
                <button class="button button-outline" type="button" data-auth-entry>
                  Voltar
                </button>
              </div>
            `
        }
      </div>

      ${
        authState.message
          ? `<div class="auth-message auth-message-note">${escapeHtml(authState.message)}</div>`
          : ""
      }
      ${
        authState.error
          ? `<div class="auth-message auth-message-error">${escapeHtml(authState.error)}</div>`
          : ""
      }
    `;

    schedulePortugueseUiRefresh();
    return;
  }

  if (authState.view === "phone-verify" && authState.phoneVerification) {
    panel.dataset.authView = "phone-verify";
    const verification = authState.phoneVerification;
    const isSendingCode = authState.phoneCodeStatus === "sending";
    const usesWhatsappDelivery = verification.deliveryMode === "whatsapp-api";
    const usesDevicePreview = verification.deliveryMode === "device-preview";
    const titleText = usesWhatsappDelivery
      ? "Confirme o codigo enviado"
      : usesDevicePreview
        ? "Confirme o codigo provisorio"
        : "Preparando seu codigo";
    const helperText = usesWhatsappDelivery
      ? `Digite o codigo de ${PHONE_VERIFICATION_CODE_LENGTH} digitos enviado pelo WhatsApp para ${escapeHtml(maskPhoneDisplay(verification.phone))}.`
      : usesDevicePreview
        ? "No momento o envio automatico pelo WhatsApp ficou indisponivel. Para nao travar o acesso, use o codigo provisorio mostrado abaixo neste aparelho."
        : `Estamos preparando o envio do codigo para ${escapeHtml(maskPhoneDisplay(verification.phone))}.`;
    const primaryStepText = usesWhatsappDelivery
      ? "Enviamos o codigo pelo WhatsApp para o numero informado."
      : usesDevicePreview
        ? "Geramos um codigo provisorio neste aparelho enquanto o envio automatico nao responde."
        : "Estamos tentando disparar o codigo automaticamente para o WhatsApp informado.";
    const inputLabel = usesWhatsappDelivery ? "Codigo recebido no WhatsApp" : "Codigo de verificacao";

    panel.innerHTML = `
      <div class="auth-panel-head">
        <p class="section-tag">Verificacao de telefone</p>
        <h2 id="auth-title">${titleText}</h2>
        <p>${helperText}</p>
      </div>

      <div class="auth-social-verify glass-card">
        <div class="auth-social-verify-top">
          <span class="auth-profile-avatar">${escapeHtml(getInitials(verification.name))}</span>
          <div>
            <strong>${escapeHtml(verification.name)}</strong>
            <small>${escapeHtml(formatPhoneDisplay(verification.phone))}</small>
          </div>
        </div>

        <div class="auth-social-steps">
          <div>
            <span>1</span>
            <p>${primaryStepText}</p>
          </div>
          <div>
            <span>2</span>
            <p>Digite os ${PHONE_VERIFICATION_CODE_LENGTH} digitos para liberar seu acesso rapidamente.</p>
          </div>
        </div>

        ${
          usesDevicePreview
            ? `
              <div class="auth-code-preview" aria-live="polite">
                <span>Codigo provisorio</span>
                <strong>${escapeHtml(verification.previewCode || "")}</strong>
                <small>Use esse codigo somente neste aparelho.</small>
              </div>
            `
            : ""
        }

        <form class="auth-form" data-auth-form data-auth-phone-verify-form>
          <label class="auth-field">
            <span>${inputLabel}</span>
            <input
              class="auth-input auth-code-input"
              type="text"
              name="phone_code"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="${PHONE_VERIFICATION_CODE_LENGTH}"
              placeholder="000000"
              value="${escapeHtml(authState.draft.phone_code || "")}"
              required
            />
          </label>

          <button class="button button-primary full-width auth-submit" type="submit"${
            isSendingCode ? " disabled" : ""
          }>
            Verificar e entrar
          </button>
        </form>

        <div class="auth-social-actions">
          <button class="button button-outline" type="button" data-auth-phone-resend${
            isSendingCode ? " disabled" : ""
          }>
            Reenviar codigo
          </button>
          <button class="button button-outline" type="button" data-auth-entry${
            isSendingCode ? " disabled" : ""
          }>
            Alterar telefone
          </button>
        </div>
      </div>

      ${
        authState.message
          ? `<div class="auth-message auth-message-note">${escapeHtml(authState.message)}</div>`
          : ""
      }
      ${
        authState.error
          ? `<div class="auth-message auth-message-error">${escapeHtml(authState.error)}</div>`
          : ""
      }
    `;

    schedulePortugueseUiRefresh();
    return;
  }

  const draft = authState.draft;
  const fallbackProfile = authState.editing && profile ? profile : null;
  const entryName = draft.entry_name ?? fallbackProfile?.name ?? "";
  const entryPhone = draft.entry_phone ?? fallbackProfile?.phone ?? "";
  panel.dataset.authView = authState.editing ? "entry-edit" : "entry";

  panel.innerHTML = `
    <div class="auth-panel-head">
      <p class="section-tag">${authState.editing ? "Editar dados" : TOKYO_PUBLIC_TEXT.authAccessLabel || "Acesso Tokyo"}</p>
      <h2 id="auth-title">${
        authState.editing ? "Atualize seu nome e telefone" : "Bem-vindo de volta!"
      }</h2>
      <p>${
        authState.editing
          ? "Revise os dados salvos neste aparelho e receba um novo codigo pelo WhatsApp."
          : "Entre com seu nome e telefone para continuar com mais rapidez e receber seu codigo pelo WhatsApp."
      }</p>
    </div>

    <form class="auth-form" data-auth-form data-auth-phone-form>
      <label class="auth-field">
        <span>Nome</span>
        <input
          class="auth-input"
          type="text"
          name="entry_name"
          autocomplete="name"
          placeholder="Nome"
          value="${escapeHtml(entryName)}"
          required
        />
      </label>

      <label class="auth-field">
        <span>Telefone</span>
        <input
          class="auth-input"
          type="tel"
          name="entry_phone"
          autocomplete="tel"
          inputmode="numeric"
          placeholder="Telefone"
          value="${escapeHtml(formatPhoneDisplay(entryPhone))}"
          required
        />
      </label>

      <button class="button button-primary full-width auth-submit" type="submit">
        ${authState.editing ? "Salvar e enviar codigo por WhatsApp" : "Enviar codigo por WhatsApp"}
      </button>
    </form>

    ${
      authState.error
        ? `<div class="auth-message auth-message-error">${escapeHtml(authState.error)}</div>`
        : authState.message
          ? `<div class="auth-message auth-message-note">${escapeHtml(authState.message)}</div>`
          : ""
    }
  `;

  schedulePortugueseUiRefresh();
};

const openAuth = (view = null, pendingHref = "") => {
  const shell = document.querySelector("[data-auth-shell]");

  if (!shell) {
    return;
  }

  if (pendingHref) {
    authState.pendingHref = pendingHref;
    authState.message = "Entre para enviar o pedido com seus dados.";
  }

  if (view) {
    authState.view = view;
  }

  if (!loadAuthProfile()) {
    authState.editing = false;
  }

  closeMobileNavigation();
  closeMobileCatalogSheet();
  closeCart();
  renderAuthPanel();
  shell.classList.add("is-open");
  shell.setAttribute("aria-hidden", "false");
  document.body.classList.add("auth-open");

  window.setTimeout(() => {
    const focusTarget = shell.querySelector(
      "input, button[data-auth-social], button[data-auth-edit], button[data-auth-start-social]"
    );

    focusTarget?.focus();
  }, 40);
};

const closeAuth = () => {
  const shell = document.querySelector("[data-auth-shell]");

  if (!shell) {
    return;
  }

  if (authState.socialTimer) {
    window.clearTimeout(authState.socialTimer);
    authState.socialTimer = 0;
  }

  shell.classList.remove("is-open");
  shell.setAttribute("aria-hidden", "true");
  document.body.classList.remove("auth-open");
  authState.error = "";
  authState.message = "";
  authState.editing = false;
  authState.phoneCodeStatus = "idle";
  authState.socialProvider = null;
  authState.socialStatus = "idle";
  authState.pendingHref = "";
  authState.pendingIntent = "";
  authState.phoneVerification = null;
  authState.draft = {};
  authState.view = "entry";
  renderAuthPanel();
};

const runPendingAuthAction = () => {
  if (!authState.pendingHref) {
    return;
  }

  const pendingHref = appendProfileToWhatsappHref(authState.pendingHref);

  authState.pendingHref = "";
  authState.pendingIntent = "";
  closeAuth();
  window.location.href = pendingHref;
};

const finalizeAuth = (profile, message) => {
  if (authState.socialTimer) {
    window.clearTimeout(authState.socialTimer);
    authState.socialTimer = 0;
  }

  saveAuthProfile(profile);
  ensureCustomerClientToken();
  authState.error = "";
  authState.message = message;
  authState.editing = false;
  authState.phoneCodeStatus = "idle";
  authState.socialProvider = null;
  authState.socialStatus = "idle";
  authState.draft = {};
  authState.phoneVerification = null;
  authState.view = "entry";
  updateAuthTriggers();
  renderAuthPanel();
  renderCart();
  renderDeliveryHistory();
  renderOrderHistoryPage();
  void refreshCustomerTrackingState({ renderPage: true });
  void loadReviewPage();
  prefillProfileForms();

  if (authState.pendingHref) {
    runPendingAuthAction();
    return;
  }

  window.setTimeout(() => {
    closeAuth();
  }, 160);
};

const formatProfileLines = (profile) => {
  if (!profile) {
    return [];
  }

  const lines = [`Nome: ${profile.name}`];
  const displayEmail = getDisplayEmail(profile);
  const displayPhone = formatPhoneDisplay(profile.phone) || profile.phone;

  if (displayEmail) {
    lines.push(`Email: ${displayEmail}`);
  }

  if (displayPhone) {
    lines.push(`Telefone: ${displayPhone}`);
  }

  return lines;
};

const appendProfileToWhatsappHref = (href) => {
  const profile = loadAuthProfile();

  if (!profile || !href) {
    return href;
  }

  try {
    const url = new URL(href);
    const currentText = url.searchParams.get("text") || "";

    if (/Nome:/i.test(currentText)) {
      return url.toString();
    }

    const mergedText = [currentText.trim(), "", ...formatProfileLines(profile)]
      .filter(Boolean)
      .join("\n");

    url.searchParams.set("text", mergedText);
    return url.toString();
  } catch (error) {
    return href;
  }
};

const deliverPhoneVerificationCode = async (verification, options = {}) => {
  if (!verification) {
    return;
  }

  authState.phoneCodeStatus = "sending";
  authState.error = "";
  authState.message = options.resent
    ? "Reenviando o codigo para o WhatsApp informado..."
    : "Enviando o codigo para o WhatsApp informado...";
  renderAuthPanel();

  try {
    const delivery = await requestPhoneVerificationDelivery(verification);

    if (authState.phoneVerification !== verification) {
      return;
    }

    authState.phoneCodeStatus = "idle";
    authState.phoneVerification = {
      ...verification,
      deliveryMode: delivery.mode,
      previewCode: delivery.previewCode || "",
    };
    authState.error = "";
    authState.message = delivery.notice;
    renderAuthPanel();
  } catch (error) {
    if (authState.phoneVerification !== verification) {
      return;
    }

    authState.phoneCodeStatus = "idle";
    authState.error =
      error?.message || "Nao foi possivel iniciar a verificacao do seu telefone agora.";
    authState.message = "";
    renderAuthPanel();
  }
};

const startSocialVerification = () => {
  const config = getAuthProviderConfig(authState.socialProvider);

  if (!config) {
    return;
  }

  if (authState.socialTimer) {
    window.clearTimeout(authState.socialTimer);
  }

  authState.socialStatus = "processing";
  authState.error = "";
  authState.message = `Verificacao iniciada com ${config.label}. Confirme no app para continuar.`;
  renderAuthPanel();

  const popup = window.open(config.href, "_blank", "noopener");

  if (!popup) {
    authState.message =
      `Nao consegui abrir o app automaticamente. Continue a verificacao do ${config.label} no navegador e volte para concluir.`;
    renderAuthPanel();
  }

  authState.socialTimer = window.setTimeout(() => {
    const profile = createSocialAccountProfile(authState.socialProvider);

    finalizeAuth(
      profile,
      `Verificacao com ${config.label} concluida. Seu acesso foi liberado.`
    );
  }, 1600);
};

const startPhoneVerification = async (name, phone, options = {}) => {
  const verification = {
    name,
    phone,
    previewCode: "",
    deliveryMode: "pending",
  };
  authState.phoneVerification = verification;
  authState.view = "phone-verify";
  authState.phoneCodeStatus = "idle";
  authState.error = "";
  authState.message = "Preparando envio do codigo pelo WhatsApp...";
  authState.draft = {
    ...authState.draft,
    entry_name: name,
    entry_phone: formatPhoneDisplay(phone),
    phone_code: "",
  };
  renderAuthPanel();
  await deliverPhoneVerificationCode(verification, options);
};

const confirmPhoneVerification = async (code) => {
  const verification = authState.phoneVerification;

  if (!verification) {
    authState.error = "Nao encontrei uma verificacao de telefone em andamento.";
    authState.message = "";
    authState.view = "entry";
    renderAuthPanel();
    return;
  }

  const sanitizedCode = String(code || "").replace(/\D/g, "").slice(0, PHONE_VERIFICATION_CODE_LENGTH);
  const codeSourceLabel =
    verification.deliveryMode === "whatsapp-api" ? "recebidos no WhatsApp" : "do codigo exibido";

  if (sanitizedCode.length !== PHONE_VERIFICATION_CODE_LENGTH) {
    authState.error = `Digite os ${PHONE_VERIFICATION_CODE_LENGTH} digitos ${codeSourceLabel}.`;
    authState.message = "";
    renderAuthPanel();
    return;
  }

  authState.phoneCodeStatus = "sending";
  authState.error = "";
  authState.message = "Validando o codigo e liberando seu acesso...";
  renderAuthPanel();

  try {
    const customerClientToken = ensureCustomerClientToken();
    await postJsonWithTimeout(
      CUSTOMER_AUTH_VERIFY_ENDPOINT,
      {
        code: sanitizedCode,
      },
      CUSTOMER_AUTH_REQUEST_TIMEOUT_MS,
      {
          headers: {
            [CUSTOMER_CLIENT_TOKEN_HEADER]: customerClientToken,
          },
      }
    );

    const profile = upsertPhoneAccountProfile(verification.name, verification.phone);
    authState.phoneVerification = null;

    finalizeAuth(profile, `Telefone verificado com sucesso para ${getFirstName(profile.name)}.`);
  } catch (error) {
    authState.phoneCodeStatus = "idle";
    authState.error =
      error?.message ||
      `Codigo invalido. Confira os ${PHONE_VERIFICATION_CODE_LENGTH} digitos ${codeSourceLabel} e tente novamente.`;
    authState.message = "";
    renderAuthPanel();
  }
};

const loadCart = () => {
  try {
    const parsed = JSON.parse(getStoredString(CART_STORAGE_KEY, "[]"));
    return Array.isArray(parsed) ? parsed.map(normalizeCartItem).filter(Boolean) : [];
  } catch (error) {
    return [];
  }
};

const saveCart = (cart) => {
  setStoredString(CART_STORAGE_KEY, JSON.stringify(cart));
};

const getCartItemCount = (cart) =>
  cart.reduce((total, item) => total + item.quantity, 0);

const getOpenOrderShortcutHref = () => "./cardapio.html#catalogo";

const getClosedOrderShortcutHref = () => "./cardapio.html#catalogo";

const getCustomerTrackingRequestHeaders = (profile = loadAuthProfile()) => {
  const customerKey = buildCustomerSessionKey(profile);
  const clientToken = getCustomerClientToken();

  if (!customerKey || !clientToken) {
    return null;
  }

  return {
    [CUSTOMER_KEY_HEADER]: customerKey,
    [CUSTOMER_CLIENT_TOKEN_HEADER]: clientToken,
  };
};

const syncHeaderOrderCta = () => {
  const profile = loadAuthProfile();
  const hasActiveOrder = Boolean(customerTrackingState.activeOrder) && Boolean(profile);
  const href = hasActiveOrder ? CUSTOMER_TRACKING_PAGE_PATH : getOpenOrderShortcutHref();
  const label = hasActiveOrder ? "Acompanhar Pedido" : "Pedir Agora";

  document.querySelectorAll("[data-order-cta]").forEach((link) => {
    link.href = href;
    link.textContent = label;
    link.setAttribute("aria-label", label);
    link.classList.toggle("is-tracking-active", hasActiveOrder);
  });
};

const getTrackingStatusLead = (order) => {
  if (!order) {
    return "";
  }

  if (order.status === "Recebido") {
    return "Recebemos seu pedido e ele ja entrou na fila da loja.";
  }

  if (order.status === "Aceito") {
    return "Seu pedido foi confirmado e entrou oficialmente em andamento.";
  }

  if (order.status === "Em preparo") {
    return "Nossa equipe esta preparando seu pedido agora.";
  }

  if (order.status === "Pronto") {
    return order.fulfillmentMode === "pickup"
      ? "Seu pedido esta pronto para retirada na loja."
      : "Seu pedido esta pronto e aguardando saida para entrega.";
  }

  if (order.status === "Saiu para entrega") {
    return "Seu pedido saiu para entrega e esta a caminho.";
  }

  if (order.status === "Entregue") {
    return "Pedido entregue com sucesso.";
  }

  if (order.status === "Retirada concluida") {
    return "Retirada concluida com sucesso.";
  }

  if (order.status === "Cancelado") {
    return "Pedido cancelado. Se precisar, nossa equipe pode ajudar pelo WhatsApp.";
  }

  return "Estamos acompanhando seu pedido em tempo real.";
};

const buildTrackingProgressSteps = (order) => {
  const progressStatuses = getTrackingProgressStatuses(order);
  const currentIndex = progressStatuses.indexOf(order?.status);

  return progressStatuses.map((status, index) => ({
    status,
    isDone: currentIndex > index,
    isCurrent: currentIndex === index,
    isPending: currentIndex !== -1 ? currentIndex < index : true,
  }));
};

const renderTrackingItems = (items, itemType) => {
  const filteredItems = Array.isArray(items) ? items.filter((item) => item.type === itemType) : [];

  if (filteredItems.length === 0) {
    return `
      <div class="tracking-inline-empty">
        <span>Nenhum item nesta secao.</span>
      </div>
    `;
  }

  return filteredItems
    .map(
      (item) => {
        const promotionLabel =
          item.type === "product" && item?.metadata?.promotion?.name
            ? [
                `Promocao: ${item.metadata.promotion.name}`,
                typeof item.metadata.promotion.promotionalUnitPrice === "number"
                  ? `Unitario ${formatPrice(Number(item.metadata.promotion.promotionalUnitPrice || 0))}`
                  : "",
              ]
                .filter(Boolean)
                .join(" | ")
            : "";
        const secondaryLabel = [item.category || (item.type === "addon" ? "Complemento" : "Item principal"), promotionLabel]
          .filter(Boolean)
          .join(" | ");

        return `
          <article class="tracking-item-card">
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <small>${escapeHtml(secondaryLabel)}</small>
            </div>
            <div class="tracking-item-meta">
              <span>${escapeHtml(`${item.quantity}x`)}</span>
              <strong>${escapeHtml(formatPrice(Number(item.totalPrice || 0)))}</strong>
            </div>
          </article>
        `;
      }
    )
    .join("");
};

const renderTrackingPage = () => {
  const trackingRoot = document.querySelector("[data-tracking-root]");
  const trackingSummary = document.querySelector("[data-tracking-summary]");

  if (!trackingRoot) {
    return;
  }

  const profile = loadAuthProfile();

  if (!profile) {
    if (trackingSummary) {
      trackingSummary.textContent =
        "Entre com sua conta para acompanhar o pedido que esta em andamento neste aparelho.";
    }

    trackingRoot.innerHTML = `
      <div class="history-lock tracking-lock">
        <strong>Login necessario para acompanhar seu pedido.</strong>
        <span>Assim que voce entrar, o site verifica se existe um pedido ativo vinculado a sua conta.</span>
        <div class="history-actions">
          <button class="button button-primary" type="button" data-auth-open>Entrar para acompanhar</button>
          <a class="button button-secondary" href="./cardapio.html#catalogo">Ir para o cardapio</a>
        </div>
      </div>
    `;
    schedulePortugueseUiRefresh();
    return;
  }

  if (!customerTrackingState.loaded) {
    if (trackingSummary) {
      trackingSummary.textContent = `Procurando pedido ativo para ${getFirstName(profile.name)}...`;
    }

    trackingRoot.innerHTML = `
      <div class="empty-panel tracking-loading-panel">
        <strong>Buscando seu pedido</strong>
        <span>Estamos consultando o backend para trazer o status mais atual da operacao.</span>
      </div>
    `;
    schedulePortugueseUiRefresh();
    return;
  }

  if (!customerTrackingState.authenticated) {
    if (trackingSummary) {
      trackingSummary.textContent = `Confirme seu telefone para liberar o acompanhamento de ${getFirstName(profile.name)} neste aparelho.`;
    }

    trackingRoot.innerHTML = `
      <div class="history-lock tracking-lock">
        <strong>Sessao do cliente ainda nao validada no backend.</strong>
        <span>Entre novamente e confirme o codigo enviado por WhatsApp para liberar apenas o pedido vinculado ao seu telefone neste aparelho.</span>
        <div class="history-actions">
          <button class="button button-primary" type="button" data-auth-open>Confirmar telefone</button>
          <a class="button button-secondary" href="./cardapio.html#catalogo">Ir para o cardapio</a>
        </div>
      </div>
    `;
    schedulePortugueseUiRefresh();
    return;
  }

  const order = customerTrackingState.activeOrder;

  if (!order) {
    if (trackingSummary) {
      trackingSummary.textContent = `Nenhum pedido em andamento encontrado para ${getFirstName(profile.name)} neste aparelho.`;
    }

    trackingRoot.innerHTML = `
      <div class="empty-panel tracking-empty-panel">
        <strong>Nenhum pedido ativo no momento.</strong>
        <span>Quando voce finalizar um pedido pelo site, o acompanhamento aparece aqui automaticamente.</span>
        <div class="history-actions">
          <a class="button button-primary" href="./cardapio.html#catalogo">Fazer um novo pedido</a>
          <a class="button button-secondary" href="./historico.html">Ver historico local</a>
        </div>
      </div>
    `;
    schedulePortugueseUiRefresh();
    return;
  }

  const progressSteps = buildTrackingProgressSteps(order);
  const latestHistory = Array.isArray(order.statusHistory) ? order.statusHistory[0] : null;

  if (trackingSummary) {
    trackingSummary.textContent = `${getTrackingStatusLead(order)} Atualizado em ${formatDateTime(
      latestHistory?.createdAt || order.updatedAt || order.createdAt
    )}.`;
  }

  trackingRoot.innerHTML = `
    <div class="tracking-page-grid">
      <section class="tracking-hero-card glass-card">
        <div class="tracking-hero-top">
          <div>
            <p class="section-tag">Pedido em andamento</p>
            <h2>${escapeHtml(order.publicId)}</h2>
            <p>${escapeHtml(getTrackingStatusLead(order))}</p>
          </div>
          <span class="tracking-status-pill is-${escapeHtml(
            order.status.toLowerCase().replace(/\s+/g, "-")
          )}">
            ${escapeHtml(order.status)}
          </span>
        </div>

        <div class="tracking-progress" role="list" aria-label="Linha de progresso do pedido">
          ${progressSteps
            .map(
              (step) => `
                <div
                  class="tracking-progress-step${step.isDone ? " is-done" : ""}${
                    step.isCurrent ? " is-current" : ""
                  }${order.status === "Cancelado" ? " is-disabled" : ""}"
                  role="listitem"
                >
                  <span class="tracking-progress-dot" aria-hidden="true"></span>
                  <strong>${escapeHtml(step.status)}</strong>
                </div>
              `
            )
            .join("")}
        </div>

        <div class="tracking-meta-grid">
          <article>
            <span>Horario do pedido</span>
            <strong>${escapeHtml(formatDateTime(order.createdAt))}</strong>
          </article>
          <article>
            <span>Tipo do pedido</span>
            <strong>${escapeHtml(
              order.orderType === "scheduled"
                ? "Agendamento"
                : order.fulfillmentMode === "pickup"
                  ? "Retirada"
                  : "Entrega"
            )}</strong>
          </article>
          <article>
            <span>Horario solicitado</span>
            <strong>${escapeHtml(order.scheduledLabel || "Pedido imediato")}</strong>
          </article>
          <article>
            <span>Previsao estimada</span>
            <strong>${escapeHtml(order.deliveryEstimateText || "Acompanhando pela loja")}</strong>
          </article>
        </div>
      </section>

      <section class="tracking-detail-card glass-card">
        <div class="tracking-detail-head">
          <div>
            <p class="section-tag">Resumo do pedido</p>
            <h3>Informacoes principais</h3>
          </div>
          <small>${escapeHtml(order.latestStatusNote || "Atualizacao operacional registrada pela loja.")}</small>
        </div>

        <div class="tracking-info-list">
          <div>
            <span>Forma de pagamento</span>
            <strong>${escapeHtml(getCartPaymentMethodLabel(order.paymentMethod))}</strong>
          </div>
          <div>
            <span>Valor total</span>
            <strong>${escapeHtml(formatPrice(Number(order.totalAmount || 0)))}</strong>
          </div>
          <div>
            <span>Endereco de entrega</span>
            <strong>${escapeHtml(order.addressFull || "Retirada no local")}</strong>
          </div>
          <div>
            <span>Complemento e referencia</span>
            <strong>${escapeHtml(
              [order.addressComplement, order.addressReference].filter(Boolean).join(" | ") ||
                "Sem complemento informado"
            )}</strong>
          </div>
          <div>
            <span>Observacoes</span>
            <strong>${escapeHtml(order.customerNotes || "Sem observacoes relevantes.")}</strong>
          </div>
          <div>
            <span>Mensagem util</span>
            <strong>${escapeHtml(getTrackingStatusLead(order))}</strong>
          </div>
        </div>
      </section>

      <section class="tracking-detail-card glass-card">
        <div class="tracking-detail-head">
          <div>
            <p class="section-tag">Itens</p>
            <h3>Seu pedido</h3>
          </div>
          <small>${escapeHtml(`${order.itemCount || 0} item(ns) registrados`)}</small>
        </div>

        <div class="tracking-item-section">
          <h4>Itens principais</h4>
          <div class="tracking-item-list">${renderTrackingItems(order.items, "product")}</div>
        </div>

        <div class="tracking-item-section">
          <h4>Complementos e adicionais</h4>
          <div class="tracking-item-list">${renderTrackingItems(order.items, "addon")}</div>
        </div>

        <div class="tracking-total-strip">
          <span>Subtotal: ${escapeHtml(formatPrice(Number(order.subtotal || 0)))}</span>
          <span>Taxa de entrega: ${escapeHtml(formatPrice(Number(order.deliveryFee || 0)))}</span>
          <strong>Total: ${escapeHtml(formatPrice(Number(order.totalAmount || 0)))}</strong>
        </div>
      </section>

      <section class="tracking-detail-card glass-card">
        <div class="tracking-detail-head">
          <div>
            <p class="section-tag">Atualizacoes</p>
            <h3>Historico do andamento</h3>
          </div>
          <small>Sincronizado com o painel do gestor</small>
        </div>

        <div class="tracking-update-list">
          ${(Array.isArray(order.statusHistory) ? order.statusHistory : [])
            .map(
              (entry) => `
                <article class="tracking-update-card">
                  <div class="tracking-update-top">
                    <strong>${escapeHtml(entry.status)}</strong>
                    <span>${escapeHtml(formatDateTime(entry.createdAt))}</span>
                  </div>
                  <p>${escapeHtml(entry.note || "Atualizacao registrada no sistema.")}</p>
                </article>
              `
            )
            .join("")}
        </div>
      </section>
    </div>
  `;

  schedulePortugueseUiRefresh();
};

const refreshCustomerTrackingState = async ({ renderPage = true } = {}) => {
  const profile = loadAuthProfile();

  if (!profile) {
    customerTrackingState.loading = false;
    customerTrackingState.loaded = true;
    customerTrackingState.authenticated = false;
    customerTrackingState.activeOrder = null;
    syncHeaderOrderCta();

    if (renderPage) {
      renderTrackingPage();
    }

    return;
  }

  ensureCustomerClientToken();
  const requestHeaders = getCustomerTrackingRequestHeaders(profile);

  if (!requestHeaders) {
    customerTrackingState.loading = false;
    customerTrackingState.loaded = true;
    customerTrackingState.authenticated = false;
    customerTrackingState.activeOrder = null;
    syncHeaderOrderCta();

    if (renderPage) {
      renderTrackingPage();
    }

    return;
  }

  customerTrackingState.loading = true;

  if (renderPage) {
    renderTrackingPage();
  }

  try {
    const response = await getJsonWithTimeout(
      CUSTOMER_ACTIVE_ORDER_ENDPOINT,
      ORDER_CREATE_TIMEOUT_MS,
      {
        headers: requestHeaders,
      }
    );

    customerTrackingState.loading = false;
    customerTrackingState.loaded = true;
    customerTrackingState.authenticated = Boolean(response.authenticated);
    customerTrackingState.activeOrder = response.hasActiveOrder
      ? normalizeTrackingOrder(response.order || null)
      : null;
  } catch (error) {
    customerTrackingState.loading = false;
    customerTrackingState.loaded = true;
    customerTrackingState.authenticated = false;
    customerTrackingState.activeOrder = null;
  }

  syncHeaderOrderCta();

  if (renderPage) {
    renderTrackingPage();
  }
};

const createStoreStatusStrip = () => {
  if (!siteHeader || document.querySelector("[data-store-status-strip]")) {
    return;
  }

  siteHeader.insertAdjacentHTML(
    "afterend",
    `
      <section class="store-status-strip" data-store-status-strip aria-live="polite">
        <div class="container">
          <div class="store-status-strip-shell" data-store-status-shell>
            <div class="store-status-pill" data-store-status-pill>
              <span class="store-status-pill-dot" data-store-status-dot aria-hidden="true"></span>
              <strong data-store-status-label>Loja aberta</strong>
            </div>
            <p class="store-status-strip-copy" data-store-status-copy>
              Funcionamento: 18:00 as 23:00.
            </p>
          </div>
        </div>
      </section>
    `
  );
};

const syncStoreStatusStrip = (storeContext = getStoreOperatingContext()) => {
  createStoreStatusStrip();

  const shell = document.querySelector("[data-store-status-shell]");
  const pill = document.querySelector("[data-store-status-pill]");
  const label = document.querySelector("[data-store-status-label]");
  const copy = document.querySelector("[data-store-status-copy]");

  if (shell) {
    shell.classList.toggle("is-open", storeContext.statusTone === "open");
    shell.classList.toggle("is-closed", storeContext.statusTone === "closed");
  }

  if (pill) {
    pill.classList.toggle("is-open", storeContext.statusTone === "open");
    pill.classList.toggle("is-closed", storeContext.statusTone === "closed");
  }

  if (label) {
    label.textContent = storeContext.shortStatusLabel;
  }

  if (copy) {
    const scheduleLabel = storeContext.isSpecialDateActive
      ? `${storeContext.todayLabel || "Data especial"}: ${storeContext.todayHoursLabel || storeContext.businessWindowLabel}`
      : storeContext.businessScheduleLabel || storeContext.businessWindowLabel;
    copy.textContent = `Funcionamento: ${scheduleLabel}. ${storeContext.detail}`;
  }
};

const syncStoreHeroStatus = (storeContext = getStoreOperatingContext()) => {
  const chip = document.querySelector("[data-store-hero-chip]");
  const dot = document.querySelector("[data-store-hero-dot]");

  if (chip) {
    chip.textContent = storeContext.shortStatusLabel;
    chip.classList.toggle("is-closed", storeContext.statusTone === "closed");
  }

  if (dot) {
    dot.classList.toggle("is-closed", storeContext.statusTone === "closed");
  }
};

const syncOrderShortcutLinks = (storeContext = getStoreOperatingContext()) => {
  const openHref = getOpenOrderShortcutHref();
  const closedHref = getClosedOrderShortcutHref();

  document.querySelectorAll("[data-order-shortcut]").forEach((link) => {
    const openLabel = link.dataset.orderOpenLabel || "";
    const closedLabel = link.dataset.orderClosedLabel || openLabel;
    const isOpen = storeContext.acceptsImmediateOrders;

    if (link.matches(".support-avatar-link")) {
      const supportHref = getPublicWhatsappSupportHref();
      link.href = supportHref;
      link.dataset.baseHref = supportHref;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.setAttribute("aria-label", "Falar no WhatsApp");
      return;
    }

    link.href = isOpen ? openHref : closedHref;
    link.removeAttribute("target");
    link.removeAttribute("rel");

    if (openLabel && closedLabel) {
      link.textContent = isOpen ? openLabel : closedLabel;
    }

  });

  document.querySelectorAll("[data-store-footer-status]").forEach((node) => {
    node.textContent = storeContext.shortStatusLabel;
    node.classList.toggle("is-closed", storeContext.statusTone === "closed");
  });
};

const refreshStoreStatusUi = ({ rerenderCartUi = true } = {}) => {
  const storeContext = getStoreOperatingContext();
  syncStoreStatusStrip(storeContext);
  syncStoreHeroStatus(storeContext);
  syncOrderShortcutLinks(storeContext);
  schedulePortugueseUiRefresh();

  if (rerenderCartUi) {
    renderCart();
  }
};

const startStoreStatusRefresh = () => {
  window.setInterval(() => {
    refreshStoreStatusUi();
  }, STORE_STATUS_REFRESH_INTERVAL_MS);
};

const createSiteFooter = () => {
  if (document.querySelector("[data-site-footer]")) {
    return;
  }

  const currentPage = document.body.dataset.page || "inicio";
  const restaurantSettings = getRestaurantSettings();
  const restaurantName = getPublicRestaurantName();
  const publicAddress = getPublicStoreAddress();
  const publicAddressFields = restaurantSettings.addressFields || RESTAURANT_SETTINGS_DEFAULTS.addressFields;
  const footerStreetLine =
    TOKYO_APP_BRANDING.defaultAddress?.footerStreetLine ||
    [publicAddressFields.street, publicAddressFields.number].filter(Boolean).join(", ");
  const footerCityLine =
    TOKYO_APP_BRANDING.defaultAddress?.footerCityLine ||
    `${publicAddressFields.city} - ${publicAddressFields.state}, CEP ${publicAddressFields.postalCode}`;
  const footerBottomAddress =
    TOKYO_APP_BRANDING.defaultAddress?.footerBottomLine ||
    `${footerStreetLine} - ${publicAddressFields.city} - ${publicAddressFields.state}.`;
  const logoUrl = resolvePublicAssetUrl(restaurantSettings.logoUrl);
  const presentationText =
    restaurantSettings.presentationText || RESTAURANT_SETTINGS_DEFAULTS.presentationText;
  const platformFooter = getPublicPlatformFooter(restaurantSettings);
  const footerNavLinks = [
    { href: "./index.html", label: "Inicio", page: "inicio" },
    { href: "./cardapio.html", label: "Cardapio", page: "cardapio" },
    { href: "./entrega.html", label: "Entrega", page: "entrega" },
    { href: "./historico.html", label: "Historico", page: "historico" },
    { href: "./avaliar.html", label: "Avaliar", page: "avaliar" },
    { href: "./trabalhe-conosco.html", label: "Trabalhe Conosco", page: "trabalhe" },
  ];
  const whatsappHref = getOpenOrderShortcutHref();
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    publicAddress
  )}`;
  const navMarkup = footerNavLinks
    .map(
      (link) => `
        <a class="site-footer-link${currentPage === link.page ? " is-current" : ""}" href="${link.href}">
          ${link.label}
        </a>
      `
    )
    .join("");

  const markup = `
    <footer class="site-footer" data-site-footer>
      <div class="container">
        <div class="site-footer-shell">
          <div class="site-footer-top">
            <div class="site-footer-branding">
              <a class="footer-brand" href="./index.html" aria-label="Voltar para a pagina inicial">
                <span class="brand-mark">
                  <img
                    src="${escapeHtml(logoUrl || RESTAURANT_SETTINGS_DEFAULTS.logoUrl)}"
                    alt="Logo ${escapeHtml(restaurantName)}"
                  />
                </span>
                <span class="brand-meta">
                  <strong>${escapeHtml(restaurantName)}</strong>
                  <small>${escapeHtml(TOKYO_APP_BRANDING.brandTagline || "Delivery Premium")}</small>
                </span>
              </a>
              <p class="site-footer-copy">
                ${escapeHtml(presentationText)}
              </p>
              <div class="site-footer-badges" aria-label="Destaques do atendimento">
                <span>Cardapio digital</span>
                <span>Entrega por distancia</span>
                <span>Gestor web de pedidos</span>
                <span data-store-footer-status>Loja aberta</span>
              </div>
            </div>

            <div class="site-footer-actions">
              <a
                class="button button-primary"
                href="${whatsappHref}"
                data-order-shortcut
                data-order-open-label="Pedir agora"
                data-order-closed-label="Agendar pedido"
              >
                Pedir agora
              </a>
              <a class="button button-secondary" href="./cardapio.html">
                Abrir cardapio
              </a>
            </div>
          </div>

          <div class="site-footer-grid">
            <section class="site-footer-column" aria-labelledby="footer-nav-title">
              <p class="site-footer-title" id="footer-nav-title">Navegacao</p>
              <div class="site-footer-links">
                ${navMarkup}
              </div>
            </section>

            <section class="site-footer-column" aria-labelledby="footer-service-title">
              <p class="site-footer-title" id="footer-service-title">Atendimento</p>
              <div class="site-footer-links">
                <a
                  class="site-footer-link"
                  href="${whatsappHref}"
                  data-order-shortcut
                  data-order-open-label="Abrir cardapio para pedir"
                  data-order-closed-label="Agendar pedido no cardapio"
                >
                  Abrir cardapio para pedir
                </a>
                <a class="site-footer-link" href="./entrega.html">
                  Calcular taxa e distancia da entrega
                </a>
                <a class="site-footer-link" href="./historico.html">
                  Consultar pedidos recentes neste aparelho
                </a>
              </div>
            </section>

            <section class="site-footer-column" aria-labelledby="footer-location-title">
              <p class="site-footer-title" id="footer-location-title">Endereco</p>
              <div class="site-footer-info-list">
                <p class="site-footer-info">${escapeHtml(footerStreetLine || "Rua General Osório, 2165")}</p>
                <p class="site-footer-info">${escapeHtml(footerCityLine || "Franca - SP, CEP 14400-520")}</p>
                <p class="site-footer-info">Origem fixa usada no calculo da entrega.</p>
                <a class="site-footer-link" href="${mapsHref}" target="_blank" rel="noreferrer">
                  Abrir localizacao no Google Maps
                </a>
              </div>
            </section>

            <section class="site-footer-column" aria-labelledby="footer-site-title">
              <p class="site-footer-title" id="footer-site-title">Redes e site</p>
              <div class="site-footer-links" data-public-social-links>
                ${renderPublicSocialLinks(restaurantSettings)}
              </div>
            </section>
          </div>

          <div class="site-footer-bottom">
            <span>&copy; ${new Date().getFullYear()} ${escapeHtml(TOKYO_APP_BRANDING.footerPoweredBy || "Tokyo Sushi Delivery Premium")}.</span>
            <span>${escapeHtml(footerBottomAddress || "Rua General Osório, 2165 - Franca - SP.")}</span>
          </div>
          <div class="inovas-platform-footer" data-platform-branding>
            <div class="inovas-platform-brand">
              <img src="${escapeHtml(platformFooter.logo || "./assets/inovas-food-logo-oficial.png")}" alt="${escapeHtml(platformFooter.brandName || "INOVAS Food")}" data-platform-branding-logo />
              <div>
                <strong data-platform-branding-headline>${escapeHtml(platformFooter.headline || "Desenvolvido por INOVAS Food")}</strong>
                <span data-platform-branding-description>${escapeHtml(platformFooter.description || "Plataforma profissional para restaurantes")}</span>
              </div>
            </div>
            <a href="${escapeHtml(normalizePublicExternalHref(platformFooter.url || "https://www.inovasfood.com.br"))}" target="_blank" rel="noreferrer" data-platform-branding-link>
              ${escapeHtml(platformFooter.displayUrl || "www.inovasfood.com.br")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  `;

  const whatsappWidget = document.querySelector(".whatsapp-widget");

  if (whatsappWidget) {
    whatsappWidget.insertAdjacentHTML("beforebegin", markup);
    schedulePortugueseUiRefresh();
    return;
  }

  document.body.insertAdjacentHTML("beforeend", markup);
  schedulePortugueseUiRefresh();
};

const setupWhatsappBubble = () => {
  const bubble = document.querySelector(".whatsapp-bubble");

  if (!bubble || bubble.dataset.bubbleReady === "true") {
    return;
  }

  bubble.dataset.bubbleReady = "true";
  bubble.hidden = false;

  window.setTimeout(() => {
    bubble.classList.add("is-visible");
  }, 120);

  window.setTimeout(() => {
    bubble.classList.add("is-leaving");
  }, 10120);

  window.setTimeout(() => {
    bubble.classList.remove("is-visible", "is-leaving");
    bubble.hidden = true;
  }, 10620);
};

const createMobileCatalogSheetShell = () => {
  if (!catalogRoot || document.querySelector("[data-mobile-catalog-sheet]")) {
    return;
  }

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div class="catalog-mobile-sheet-overlay" data-mobile-catalog-sheet-close></div>
      <aside
        class="catalog-mobile-sheet"
        id="mobile-catalog-sheet"
        data-mobile-catalog-sheet
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-catalog-sheet-title"
      >
        <div class="catalog-mobile-sheet-handle" aria-hidden="true"></div>
        <div class="catalog-mobile-sheet-header">
          <div class="catalog-mobile-sheet-header-copy">
            <p class="catalog-kicker" data-mobile-catalog-sheet-kicker></p>
            <h3 id="mobile-catalog-sheet-title" data-mobile-catalog-sheet-title></h3>
            <p data-mobile-catalog-sheet-description></p>
          </div>
          <button
            class="catalog-mobile-sheet-close"
            type="button"
            data-mobile-catalog-sheet-close
            aria-label="Fechar lista de produtos"
          >
            &times;
          </button>
        </div>
        <div data-mobile-catalog-sheet-filters></div>
        <div class="catalog-mobile-sheet-content" data-mobile-catalog-sheet-content></div>
      </aside>
    `
  );

  schedulePortugueseUiRefresh();
};

const closeMobileCatalogSheet = () => {
  mobileCatalogSheetState.sectionId = "";
  mobileCatalogSheetState.groupId = "";
  document.body.classList.remove("catalog-sheet-open");
};

const closeMobileCatalogSheetAfterCartSelection = (triggerNode) => {
  if (
    isCatalogMobileViewport() &&
    triggerNode?.closest?.("[data-mobile-catalog-sheet]")
  ) {
    closeMobileCatalogSheet();
  }
};

const renderMobileCatalogSheet = () => {
  const sheet = document.querySelector("[data-mobile-catalog-sheet]");
  const kickerNode = document.querySelector("[data-mobile-catalog-sheet-kicker]");
  const titleNode = document.querySelector("[data-mobile-catalog-sheet-title]");
  const descriptionNode = document.querySelector("[data-mobile-catalog-sheet-description]");
  const filtersNode = document.querySelector("[data-mobile-catalog-sheet-filters]");
  const contentNode = document.querySelector("[data-mobile-catalog-sheet-content]");

  if (!sheet || !kickerNode || !titleNode || !descriptionNode || !filtersNode || !contentNode) {
    return;
  }

  const { section, groups, activeGroup, visibleItems } = getMobileCatalogSheetContext();

  if (!section) {
    closeMobileCatalogSheet();
    return;
  }

  kickerNode.textContent = section.kicker;
  titleNode.textContent = activeGroup?.title || section.title;
  descriptionNode.textContent = activeGroup?.description || section.description;
  filtersNode.innerHTML = getMobileCatalogSheetFiltersMarkup(section, groups, activeGroup);
  contentNode.innerHTML = getMobileCatalogSheetItemsMarkup(section, visibleItems, activeGroup);
  syncCatalogSelections();
  schedulePortugueseUiRefresh(sheet);
};

const openMobileCatalogSheet = (sectionId, groupId = "") => {
  if (!isCatalogMobileViewport()) {
    return;
  }

  createMobileCatalogSheetShell();

  if (!getCatalogSectionById(sectionId)) {
    return;
  }

  closeMobileNavigation();
  closeCart();
  mobileCatalogSheetState.sectionId = sectionId;
  mobileCatalogSheetState.groupId = groupId;
  renderMobileCatalogSheet();
  document.body.classList.add("catalog-sheet-open");

  window.setTimeout(() => {
    document.querySelector("[data-mobile-catalog-sheet-close]")?.focus();
  }, 30);
};

const setMobileCatalogSheetGroup = (groupId = "") => {
  if (!mobileCatalogSheetState.sectionId) {
    return;
  }

  mobileCatalogSheetState.groupId = groupId;
  renderMobileCatalogSheet();
};

const createCartShell = () => {
  if (document.querySelector("[data-cart-drawer]")) {
    return;
  }

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div class="cart-overlay" data-cart-close></div>
      <aside class="cart-drawer" data-cart-drawer aria-labelledby="cart-title">
        <div class="cart-drawer-header">
          <div class="cart-drawer-title">
            <h2 id="cart-title">Sua sacola</h2>
            <span class="cart-title-total" data-cart-total>R$ 0,00</span>
          </div>
          <button class="cart-close" type="button" data-cart-close aria-label="Fechar sacola">&times;</button>
        </div>
        <div class="cart-drawer-body">
          <div data-cart-items></div>
        </div>
        <div class="cart-drawer-footer">
          <section class="cart-checkout-dock" data-cart-checkout-shell>
            <button
              class="cart-checkout-toggle"
              type="button"
              data-cart-checkout-toggle
              aria-expanded="false"
            >
              <span class="cart-checkout-toggle-copy">
                <strong>Informacoes obrigatorias</strong>
                <small data-cart-checkout-status>Toque para preencher</small>
              </span>
              <span class="cart-checkout-toggle-icon" data-cart-checkout-icon aria-hidden="true">+</span>
            </button>
            <div class="cart-checkout-panel" data-cart-checkout-panel hidden>
              <div data-cart-checkout></div>
            </div>
          </section>
          <button class="button button-primary full-width cart-submit" type="button" data-cart-submit>
            Finalizar pedido
          </button>
          <div class="cart-summary">
            <strong data-cart-summary>0 itens do cardapio</strong>
            <button class="cart-clear" type="button" data-cart-clear>Limpar</button>
          </div>
          <p class="cart-note" data-cart-note>
            Os valores finais e a disponibilidade podem ser confirmados no atendimento.
          </p>
          <div class="cart-order-feedback" data-cart-order-feedback hidden></div>
        </div>
      </aside>
    `
  );

  schedulePortugueseUiRefresh();
};

const WHATSAPP_MESSAGE_SECTION_DIVIDER = "\u2501".repeat(15);

const appendWhatsappSection = (lines, emoji, title, contentLines = []) => {
  const sectionLines = contentLines.filter((line) => typeof line === "string" && line.trim());

  if (!sectionLines.length) {
    return;
  }

  lines.push("", WHATSAPP_MESSAGE_SECTION_DIVIDER, `${emoji} *${title}*`, ...sectionLines);
};

const getWhatsappPaymentMethodLabel = (paymentMethod) => {
  if (paymentMethod === "credito") {
    return "Cr\u00e9dito";
  }

  if (paymentMethod === "debito") {
    return "D\u00e9bito";
  }

  return getCartPaymentMethodLabel(paymentMethod);
};

const getWhatsappOrderSummaryLabel = (checkout, now = new Date()) => {
  if (checkout?.timingMode !== "scheduled") {
    return "Pedido imediato";
  }

  if (!checkout?.scheduledDate || !checkout?.scheduledTime) {
    return "Agendamento a confirmar";
  }

  const scheduleLabel = formatStoreScheduleLabel(
    checkout.scheduledDate,
    checkout.scheduledTime,
    now
  ).replace(/ as /i, " \u00e0s ");

  return `Agendado para ${scheduleLabel}`;
};

const formatWhatsappCartItemLine = (item) => {
  const quantity = Math.max(1, Number(item?.quantity) || 0);
  const lineTotal =
    typeof item?.price === "number" ? Number((item.price * quantity).toFixed(2)) : null;

  return `\u2022 ${quantity}x ${item.name}${
    lineTotal !== null ? ` - ${formatPrice(lineTotal)}` : ""
  }`;
};

const formatWhatsappAddonLine = (addon) => {
  const quantity = Math.max(0, Number(addon?.quantity) || 0);
  const quantityLabel = quantity > 1 ? `${quantity}x ` : "";
  const chargedQuantity = getCartAddonChargeQuantity(addon);
  const subtotal = getCartAddonTotal(addon);
  const freeApplied = Math.min(quantity, addon.freeUnits);

  if (addon.freeUnits > 0 && chargedQuantity === 0) {
    return `\u2022 ${quantityLabel}${addon.name} - gr\u00e1tis`;
  }

  if (addon.freeUnits > 0 && freeApplied > 0) {
    return `\u2022 ${quantityLabel}${addon.name} - ${formatPrice(subtotal)} (${freeApplied} gr\u00e1tis)`;
  }

  return `\u2022 ${quantityLabel}${addon.name} - ${formatPrice(subtotal)}`;
};

const getWhatsappDeliveryAddressLines = (deliveryQuote) => {
  if (!deliveryQuote) {
    return [];
  }

  const lines = [];
  const street = String(deliveryQuote.street || "").trim();
  const houseNumber = String(deliveryQuote.houseNumber || "").trim();
  const complement = String(deliveryQuote.complement || "").trim();
  const primaryLine = [
    [street, houseNumber].filter(Boolean).join(", "),
    complement,
  ]
    .filter(Boolean)
    .join(" - ");

  if (primaryLine) {
    lines.push(primaryLine);
  }

  const addressSource = String(
    deliveryQuote.geocodedAddress || deliveryQuote.destinationLabel || ""
  ).trim();

  if (!addressSource) {
    return lines;
  }

  const addressParts = addressSource
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^(brasil|brazil)$/i.test(part));

  if (street && addressParts[0] && addressParts[0].toLowerCase().includes(street.toLowerCase())) {
    addressParts.shift();
  }

  if (houseNumber && addressParts[0]) {
    addressParts[0] = addressParts[0]
      .replace(new RegExp(`^${escapeRegex(houseNumber)}\\s*-?\\s*`, "i"), "")
      .trim();

    if (!addressParts[0]) {
      addressParts.shift();
    }
  }

  if (addressParts.length) {
    lines.push(addressParts.join(" - "));
  }

  return Array.from(new Set(lines.filter(Boolean)));
};

const formatWhatsappMessage = (
  cart,
  addons = loadCartAddons(),
  checkout = loadCartCheckout()
) => {
  const profile = loadAuthProfile();
  const deliveryQuote = getLatestSavedDeliveryQuote(profile);
  const selectedAddons = getSelectedCartAddons(addons);
  const cashDetails = getCartCashChangeDetails({
    cart,
    addons,
    checkout,
    profile,
    deliveryQuote,
  });
  const grandTotalAmount = getCartGrandTotalAmount(
    cart,
    addons,
    checkout,
    profile,
    deliveryQuote
  );
  const baseTotalAmount = getCartTotalAmount(cart, addons);
  const totalLabel =
    typeof grandTotalAmount === "number"
      ? formatPrice(grandTotalAmount)
      : typeof baseTotalAmount === "number"
        ? formatPrice(baseTotalAmount)
        : "A confirmar";
  const displayPhone = formatPhoneDisplay(profile?.phone) || profile?.phone || "";
  const displayEmail = getDisplayEmail(profile);
  const lines = [`\u{1F363} *NOVO PEDIDO - ${getPublicRestaurantName()}*`];

  appendWhatsappSection(lines, "\u{1F9FE}", "RESUMO", [
    `Pedido: ${getWhatsappOrderSummaryLabel(checkout)}`,
    `Total: ${totalLabel}`,
    checkout.fulfillmentMode === "pickup" ? "Retirada" : "Entrega",
  ]);

  appendWhatsappSection(lines, "\u{1F464}", "CLIENTE", [
    profile?.name ? `Nome: ${profile.name}` : "",
    displayPhone ? `Telefone: ${displayPhone}` : "",
    !displayPhone && displayEmail ? `Email: ${displayEmail}` : "",
  ]);

  appendWhatsappSection(
    lines,
    "\u{1F363}",
    "ITENS DO PEDIDO",
    cart.map((item) => formatWhatsappCartItemLine(item))
  );

  appendWhatsappSection(
    lines,
    "\u{1F9C2}",
    "COMPLEMENTOS",
    selectedAddons.map((addon) => formatWhatsappAddonLine(addon))
  );

  if (checkout.fulfillmentMode === "delivery" && deliveryQuote) {
    const deliveryLines = ["Endere\u00e7o:", ...getWhatsappDeliveryAddressLines(deliveryQuote)];
    const deliveryFeeLabel = formatPrice(Number(deliveryQuote.fee || 0));

    deliveryLines.push(
      `Taxa: ${deliveryFeeLabel}${isManualDeliveryQuote(deliveryQuote) ? " (provis\u00f3ria)" : ""}`
    );

    appendWhatsappSection(lines, "\u{1F69A}", "ENTREGA", deliveryLines);
  } else if (checkout.fulfillmentMode === "pickup") {
    appendWhatsappSection(lines, "\u{1F3EA}", "RETIRADA", [
      "Local: Retirada no balc\u00e3o",
      checkout.timingMode === "scheduled"
        ? `Hor\u00e1rio: ${formatStoreScheduleLabel(
            checkout.scheduledDate,
            checkout.scheduledTime
          ).replace(/ as /i, " \u00e0s ")}`
        : `Previs\u00e3o: at\u00e9 ${getPublicAveragePreparationMinutes()} min`,
    ]);
  }

  if (checkout.paymentMethod) {
    const paymentLines = [`Forma: ${getWhatsappPaymentMethodLabel(checkout.paymentMethod)}`];

    if (checkout.paymentMethod === "dinheiro") {
      if (typeof cashDetails.amountProvided === "number") {
        paymentLines.push(`Valor pago: ${formatPrice(cashDetails.amountProvided)}`);
      }

      if (typeof cashDetails.changeAmount === "number") {
        paymentLines.push(`Troco: ${formatPrice(cashDetails.changeAmount)}`);
      } else if (checkout.cashChangeRequired === "no") {
        paymentLines.push("Troco: N\u00e3o precisa");
      }
    }

    appendWhatsappSection(lines, "\u{1F4B0}", "PAGAMENTO", paymentLines);
  }

  const observationLines = [];

  if (checkout.fulfillmentMode === "delivery" && deliveryQuote && isManualDeliveryQuote(deliveryQuote)) {
    observationLines.push("Taxa final e prazo ser\u00e3o confirmados no atendimento.");
  }

  if (cart.some((item) => typeof item.price !== "number")) {
    observationLines.push("Valores finais ser\u00e3o confirmados no atendimento.");
  }

  appendWhatsappSection(lines, "\u{1F4CC}", "OBSERVA\u00c7\u00c3O", observationLines);

  lines.push(
    "",
    WHATSAPP_MESSAGE_SECTION_DIVIDER,
    cart.some((item) => typeof item.price !== "number")
      ? "\u2705 Pode confirmar os valores finais, o pedido e a disponibilidade?"
      : "\u2705 Pode confirmar o pedido e disponibilidade?"
  );

  return `https://wa.me/${getPublicWhatsappNumber()}?text=${encodeURIComponent(
    normalizePortugueseText(lines.join("\n"))
  )}`;
};

const renderCartAddons = (node, addons) => {
  if (!node) {
    return;
  }

  node.innerHTML = addons
    .map(
      (addon) => `
        <article class="catalog-addon-card">
          <div class="catalog-addon-copy">
            <div class="catalog-addon-top">
              <p class="catalog-addon-title">${addon.name}</p>
              <span class="catalog-addon-badge">${formatPrice(getCartAddonTotal(addon))}</span>
            </div>
            <span class="catalog-addon-rule">${getCartAddonRuleText(addon)}</span>
            <span class="catalog-addon-meta">${formatCartAddonMeta(addon)}</span>
          </div>
          <div class="catalog-addon-controls">
            <button
              class="catalog-stepper"
              type="button"
              data-cart-addon-change="${addon.id}"
              data-delta="-1"
              aria-label="Diminuir ${addon.name}"
            >
              -
            </button>
            <span class="catalog-addon-qty">${addon.quantity}</span>
            <button
              class="catalog-stepper"
              type="button"
              data-cart-addon-change="${addon.id}"
              data-delta="1"
              aria-label="Aumentar ${addon.name}"
            >
              +
            </button>
          </div>
        </article>
      `
    )
    .join("");
};

const renderCartCheckout = (node, checkout, cart, addons, profile = loadAuthProfile()) => {
  if (!node) {
    return;
  }

  const deliveryQuote = getLatestSavedDeliveryQuote(profile);
  const validation = getCartCheckoutValidation(cart, addons, checkout, profile, deliveryQuote);
  const cashDetails = getCartCashChangeDetails({
    cart,
    addons,
    checkout,
    profile,
    deliveryQuote,
  });
  const storeContext = getStoreOperatingContext();
  const scheduleConstraints = getStoreScheduleConstraints(checkout.scheduledDate);
  const scheduledSummary = getCartScheduledOrderSummary(checkout);
  const feedbackClass =
    validation.tone === "success"
      ? " is-success"
      : validation.tone === "warning"
        ? " is-warning"
        : "";
  const shouldShowCheckoutFeedback = !(
    validation.tone === "success" &&
    checkout.fulfillmentMode === "pickup" &&
    checkout.timingMode === "immediate"
  );
  const timingSummaryText =
    checkout.timingMode === "scheduled"
      ? scheduledSummary
        ? `${scheduledSummary} O horario precisa ficar entre ${storeContext.businessWindowLabel}.`
        : `Agende um horario valido entre ${storeContext.businessWindowLabel}.`
      : storeContext.acceptsImmediateOrders
        ? storeContext.isOpen
          ? `Pedidos imediatos liberados ate ${storeContext.closeTimeLabel || storeContext.businessWindowLabel.split(" as ").pop()}.`
          : storeContext.warningMessage || storeContext.detail
        : getImmediateOrderUnavailableMessage(storeContext);
  const fulfillmentOptions = CART_FULFILLMENT_OPTIONS.map((option) => ({
    ...option,
    availability: getFulfillmentOptionAvailability(option.id),
  }));
  const fulfillmentNotice = fulfillmentOptions
    .map((option) => option.availability)
    .find((availability) => !availability.available && availability.message)?.message;

  node.innerHTML = `
    <section class="cart-required-section">
      <div class="cart-fulfillment-note cart-store-status is-${storeContext.statusTone}">
        <strong>${escapeHtml(storeContext.shortStatusLabel)}</strong>
        <span>Funcionamento: ${escapeHtml(
          storeContext.businessScheduleLabel || storeContext.businessWindowLabel
        )}. ${escapeHtml(
          storeContext.detail
        )}</span>
      </div>

      <div class="cart-checkout-group">
        <span class="cart-checkout-label">Forma de pagamento</span>
        <div class="cart-choice-grid">
          ${CART_PAYMENT_METHODS.map(
            (method) => `
              <label class="cart-choice-pill${checkout.paymentMethod === method.id ? " is-selected" : ""}">
                <input
                  class="cart-choice-input"
                  type="radio"
                  name="cart_payment_method"
                  value="${method.id}"
                  ${checkout.paymentMethod === method.id ? "checked" : ""}
                />
                <span>${method.label}</span>
              </label>
            `
          ).join("")}
        </div>
      </div>

      <div class="cart-checkout-group">
        <span class="cart-checkout-label">Momento do pedido</span>
        <div class="cart-choice-grid cart-choice-grid-compact">
          ${CART_ORDER_TIMING_OPTIONS.map(
            (option) => `
              <label class="cart-choice-pill${checkout.timingMode === option.id ? " is-selected" : ""}${
                option.id === "immediate" && !storeContext.acceptsImmediateOrders ? " is-disabled" : ""
              }">
                <input
                  class="cart-choice-input"
                  type="radio"
                  name="cart_timing_mode"
                  value="${option.id}"
                  ${checkout.timingMode === option.id ? "checked" : ""}
                  ${option.id === "immediate" && !storeContext.acceptsImmediateOrders ? "disabled" : ""}
                />
                <span>${option.label}</span>
              </label>
            `
          ).join("")}
        </div>

        <div class="cart-cash-summary${
          checkout.timingMode === "scheduled"
            ? " is-neutral"
            : storeContext.acceptsImmediateOrders
              ? " is-success"
              : " is-warning"
        }">
          <strong>${
            checkout.timingMode === "scheduled" ? "Horario escolhido" : "Status do pedido imediato"
          }</strong>
          <span>${escapeHtml(timingSummaryText)}</span>
        </div>

        ${
          checkout.timingMode === "scheduled"
            ? `
              <div class="cart-schedule-grid">
                <label class="cart-schedule-field">
                  <span>Data</span>
                  <input
                    class="cart-schedule-input"
                    type="date"
                    name="cart_scheduled_date"
                    min="${escapeHtml(scheduleConstraints.minDate || "")}"
                    value="${escapeHtml(checkout.scheduledDate || "")}"
                  />
                </label>

                <label class="cart-schedule-field">
                  <span>Horario</span>
                  <input
                    class="cart-schedule-input"
                    type="time"
                    name="cart_scheduled_time"
                    min="${escapeHtml(scheduleConstraints.timeMin || "18:00")}"
                    max="${escapeHtml(scheduleConstraints.timeMax || "23:00")}"
                    step="${escapeHtml(String(scheduleConstraints.stepSeconds || 300))}"
                    value="${escapeHtml(checkout.scheduledTime || "")}"
                  />
                </label>
              </div>
            `
            : ""
        }
      </div>

      ${
        checkout.paymentMethod === "dinheiro"
          ? `
            <div class="cart-checkout-group">
              <span class="cart-checkout-label">Troco</span>
              <div class="cart-choice-grid cart-choice-grid-compact">
                ${[
                  { id: "no", label: "Sem troco" },
                  { id: "yes", label: "Precisa de troco" },
                ]
                  .map(
                    (option) => `
                      <label class="cart-choice-pill${checkout.cashChangeRequired === option.id ? " is-selected" : ""}">
                        <input
                          class="cart-choice-input"
                          type="radio"
                          name="cart_cash_change_required"
                          value="${option.id}"
                          ${checkout.cashChangeRequired === option.id ? "checked" : ""}
                        />
                        <span>${option.label}</span>
                      </label>
                    `
                  )
                  .join("")}
              </div>

              <div class="cart-cash-summary">
                <strong>Total considerado para pagamento</strong>
                <span>${
                  typeof cashDetails.totalAmount === "number"
                    ? formatPrice(cashDetails.totalAmount)
                    : "Valor final a confirmar"
                }</span>
              </div>

              ${
                checkout.cashChangeRequired === "yes"
                  ? `
                    <label class="cart-cash-field">
                      <span>Qual valor voce tem em dinheiro?</span>
                      <input
                        class="cart-cash-input"
                        type="text"
                        name="cart_cash_amount"
                        inputmode="decimal"
                        placeholder="100,00"
                        value="${escapeHtml(checkout.cashAmountProvided || "")}"
                      />
                    </label>

                    <div class="cart-cash-summary${
                      checkout.cashAmountProvided && !cashDetails.hasEnoughAmount
                        ? " is-warning"
                        : cashDetails.hasEnoughAmount
                          ? " is-success"
                          : ""
                    }">
                      <strong>Troco calculado</strong>
                      <span>${
                        typeof cashDetails.changeAmount === "number"
                          ? formatPrice(cashDetails.changeAmount)
                          : "Informe o valor para calcular"
                      }</span>
                    </div>
                  `
                  : checkout.cashChangeRequired === "no"
                    ? `
                      <div class="cart-cash-summary is-neutral">
                        <strong>Pagamento em dinheiro</strong>
                        <span>Sem necessidade de troco.</span>
                      </div>
                    `
                    : ""
              }
            </div>
          `
          : ""
      }

      <div class="cart-checkout-group">
        <span class="cart-checkout-label">Recebimento</span>
        <div class="cart-choice-grid cart-choice-grid-compact">
          ${fulfillmentOptions.map(
            (option) => `
              <label class="cart-choice-pill${checkout.fulfillmentMode === option.id ? " is-selected" : ""}${
                !option.availability.available ? " is-disabled" : ""
              }">
                <input
                  class="cart-choice-input"
                  type="radio"
                  name="cart_fulfillment_mode"
                  value="${option.id}"
                  ${checkout.fulfillmentMode === option.id ? "checked" : ""}
                  ${!option.availability.available ? "disabled" : ""}
                />
                <span>${option.label}</span>
              </label>
            `
          ).join("")}
        </div>
        ${
          fulfillmentNotice
            ? `
              <div class="cart-cash-summary is-warning">
                <strong>Status da entrega</strong>
                <span>${escapeHtml(fulfillmentNotice)}</span>
              </div>
            `
            : ""
        }
      </div>

      ${
        checkout.fulfillmentMode === "delivery"
          ? `
            <div class="cart-checkout-group">
              ${
                deliveryQuote
                  ? `
                    <div class="cart-delivery-summary">
                      <div class="cart-delivery-summary-top">
                        <div>
                          <strong>${
                            isManualDeliveryQuote(deliveryQuote)
                              ? "Entrega salva em modo provisorio"
                              : "Entrega calculada"
                          }</strong>
                          <span>${escapeHtml(getDeliveryQuoteSummaryText(deliveryQuote))}</span>
                        </div>
                        <span class="cart-delivery-fee">${getDeliveryQuoteFeeText(deliveryQuote)}</span>
                      </div>
                      <p class="cart-delivery-address">${escapeHtml(
                        deliveryQuote.geocodedAddress || deliveryQuote.destinationLabel || ""
                      )}</p>
                      ${
                        deliveryQuote.freeShippingApplied || deliveryQuote.minimumOrderMessage
                          ? `
                            <div class="cart-delivery-rule-note${
                              deliveryQuote.isMinimumOrderMet === false ? " is-warning" : " is-success"
                            }">
                              ${escapeHtml(
                                deliveryQuote.freeShippingApplied
                                  ? deliveryQuote.freeShippingMessage || "Frete gratis aplicado."
                                  : deliveryQuote.minimumOrderMessage || ""
                              )}
                            </div>
                          `
                          : ""
                      }
                      <a class="button button-secondary cart-delivery-link" href="./entrega.html">
                        Atualizar na aba Entrega
                      </a>
                    </div>
                  `
                  : `
                    <div class="cart-fulfillment-note">
                      <strong>Entrega ainda nao calculada</strong>
                      <span>${
                        profile
                          ? "Abra a aba Entrega, calcule a taxa e salve os dados nesta conta para finalizar."
                          : "Abra a aba Entrega para calcular a taxa e salvar os dados da entrega antes de finalizar."
                      }</span>
                      <a class="button button-secondary cart-delivery-link" href="./entrega.html">
                        Ir para Entrega
                      </a>
                    </div>
                  `
              }
            </div>
          `
          : checkout.fulfillmentMode === "pickup"
            ? `
              <div class="cart-fulfillment-note is-pickup">
                <strong>${checkout.timingMode === "scheduled" ? "Retirada agendada" : "Retirada no local"}</strong>
                <span>${
                  checkout.timingMode === "scheduled" && scheduledSummary
                    ? `${scheduledSummary} Compareca dentro do horario de funcionamento.`
                    : getPickupEstimateText()
                }</span>
              </div>
            `
            : `
              <div class="cart-fulfillment-note">
                <span>Depois da escolha, a sacola mostra as instrucoes certas para entrega ou retirada.</span>
              </div>
            `
      }

      <div class="cart-checkout-group">
        <label class="cart-cash-field">
          <span>Observacoes do pedido</span>
          <textarea
            class="cart-notes-input"
            name="cart_customer_notes"
            rows="3"
            placeholder="Ex.: sem cebolinha, retirar molho, interfone 12..."
          >${escapeHtml(checkout.customerNotes || "")}</textarea>
        </label>
      </div>

      ${
        shouldShowCheckoutFeedback
          ? `
            <div class="cart-checkout-feedback${feedbackClass}" data-cart-checkout-feedback>
              ${escapeHtml(validation.message)}
            </div>
          `
          : ""
      }
    </section>
  `;
};

const syncCartCheckoutUi = ({
  cart = loadCart(),
  addons = loadCartAddons(),
  checkout = loadCartCheckout(),
  profile = loadAuthProfile(),
} = {}) => {
  const submitButton = document.querySelector("[data-cart-submit]");
  const cartNoteNode = document.querySelector("[data-cart-note]");
  const checkoutFeedbackNode = document.querySelector("[data-cart-checkout-feedback]");
  const orderFeedbackNode = document.querySelector("[data-cart-order-feedback]");
  const deliveryQuote = getLatestSavedDeliveryQuote(profile);
  const validation = getCartCheckoutValidation(cart, addons, checkout, profile, deliveryQuote);

  syncCartCheckoutDock({ cart, addons, checkout, validation });

  if (checkoutFeedbackNode) {
    checkoutFeedbackNode.textContent = validation.message;
    checkoutFeedbackNode.classList.toggle("is-success", validation.tone === "success");
    checkoutFeedbackNode.classList.toggle("is-warning", validation.tone === "warning");
  }

  if (orderFeedbackNode) {
    const notice = cartUiState.orderNotice;
    orderFeedbackNode.hidden = !notice?.message;
    orderFeedbackNode.textContent = notice?.message || "";
    orderFeedbackNode.classList.toggle("is-success", notice?.tone === "success");
    orderFeedbackNode.classList.toggle("is-error", notice?.tone === "error");
  }

  if (!submitButton) {
    return;
  }

  const actionLabel = checkout.timingMode === "scheduled" ? "Agendar pedido" : "Finalizar pedido";
  const authLabel =
    checkout.timingMode === "scheduled" ? "Entrar para agendar" : "Entrar para finalizar";

  if (cart.length === 0) {
    submitButton.disabled = true;
    submitButton.textContent = "Finalizar pedido";
    submitButton.classList.add("is-disabled");

    if (cartNoteNode) {
      cartNoteNode.textContent =
        "Os complementos sao ajustados no painel do cardapio. O pedido so libera envio quando houver itens na sacola.";
    }
    return;
  }

  if (!validation.isValid) {
    submitButton.disabled = false;
    submitButton.textContent = actionLabel;
    submitButton.classList.add("is-disabled");

    if (cartNoteNode) {
      cartNoteNode.textContent =
        `${validation.message} Os complementos continuam no painel do cardapio.`;
    }
    return;
  }

  submitButton.disabled = cartUiState.orderSubmitting;
  submitButton.textContent = cartUiState.orderSubmitting
    ? "Enviando pedido..."
    : profile
      ? actionLabel
      : authLabel;
  submitButton.classList.toggle("is-disabled", cartUiState.orderSubmitting);
  submitButton.setAttribute("aria-busy", String(cartUiState.orderSubmitting));

  if (cartNoteNode) {
    cartNoteNode.textContent = profile
      ? checkout.timingMode === "scheduled"
        ? checkout.fulfillmentMode === "delivery"
          ? deliveryQuote
            ? `${getCartScheduledOrderSummary(checkout)} ${
                isManualDeliveryQuote(deliveryQuote)
                  ? "Entrega salva em modo provisorio"
                  : "Entrega pronta"
              }: ${getDeliveryQuoteSummaryText(
                deliveryQuote
              )}. O pedido segue direto para o gestor administrativo.`
            : `${getCartScheduledOrderSummary(
                checkout
              )} Abra a aba Entrega para calcular e salvar os dados desta conta.`
          : `${getCartScheduledOrderSummary(checkout)} Retirada pronta para envio direto ao gestor.`
        : checkout.fulfillmentMode === "delivery"
          ? deliveryQuote
            ? `${
                isManualDeliveryQuote(deliveryQuote)
                  ? "Entrega salva em modo provisorio"
                  : "Entrega pronta"
              }: ${getDeliveryQuoteSummaryText(
                deliveryQuote
              )}. O pedido sera enviado direto para o gestor.`
            : "Abra a aba Entrega para calcular e salvar os dados desta conta antes de finalizar."
          : `${getPickupEstimateText()} O pedido sera enviado direto para o gestor.`
      : `${validation.message} Entre para enviar o pedido com seus dados.`;
  }
};

const renderCart = () => {
  const cart = loadCart();
  const addons = loadCartAddons();
  const checkout = loadCartCheckout();
  const count = getCartItemCount(cart);
  const countNodes = document.querySelectorAll("[data-cart-count]");
  const cartAddonsPanelNode = document.querySelector("[data-cart-addons-panel]");
  const cartAddonsTotalNode = document.querySelector("[data-cart-addons-total]");
  const cartCheckoutNode = document.querySelector("[data-cart-checkout]");
  const cartItemsNode = document.querySelector("[data-cart-items]");
  const cartTotalNode = document.querySelector("[data-cart-total]");
  const cartSummaryNode = document.querySelector("[data-cart-summary]");
  const profile = loadAuthProfile();
  const totalAmount = getCartTotalAmount(cart, addons);
  const addonsTotalAmount = getCartAddonsTotalAmount(addons);
  const cartAddonsSummaryMarkup = getCartAddonsSummaryMarkup(addons);

  countNodes.forEach((node) => {
    node.textContent = String(count);
    node.classList.toggle("is-empty", count === 0);
  });

  renderCartAddons(cartAddonsPanelNode, addons);
  renderCartCheckout(cartCheckoutNode, checkout, cart, addons, profile);

  if (cartAddonsTotalNode) {
    cartAddonsTotalNode.textContent = formatPrice(addonsTotalAmount);
  }

  if (cartTotalNode) {
    cartTotalNode.textContent =
      typeof totalAmount === "number" ? formatPrice(totalAmount) : "Consulte valores";
  }

  if (!cartItemsNode || !cartSummaryNode) {
    syncCartCheckoutUi({ cart, addons, checkout, profile });
    syncCatalogSelections();
    schedulePortugueseUiRefresh();
    return;
  }

  cartSummaryNode.textContent = `${count} item${count === 1 ? "" : "s"} do cardapio`;

  if (cart.length === 0) {
    cartItemsNode.innerHTML = `
      <div class="cart-empty">
        Sua sacola esta vazia. Abra o cardapio e toque nas opcoes dos cards para guardar os itens aqui.
      </div>
    `;
    syncCartCheckoutUi({ cart, addons, checkout, profile });
    syncCatalogSelections();
    schedulePortugueseUiRefresh();
    return;
  }

  cartItemsNode.innerHTML = `
    <ul class="cart-list">
      ${cart
        .map(
          (item) => `
            <li class="cart-item">
              <div>
                <p class="cart-item-title">${item.name}</p>
                <span class="cart-item-meta">${item.category}${
                  typeof item.price === "number" ? ` | ${formatPrice(item.price)}` : ""
                }</span>
              </div>
              <div class="cart-item-controls">
                <button class="cart-qty-btn" type="button" data-cart-change="${item.id}" data-delta="-1">-</button>
                <span class="cart-qty">${item.quantity}</span>
                <button class="cart-qty-btn" type="button" data-cart-change="${item.id}" data-delta="1">+</button>
              </div>
            </li>
          `
        )
        .join("")}
    </ul>
    ${cartAddonsSummaryMarkup}
  `;

  syncCartCheckoutUi({ cart, addons, checkout, profile });
  syncCatalogSelections();
  schedulePortugueseUiRefresh();
};

const openCart = () => {
  closeMobileNavigation();
  closeMobileCatalogSheet();
  document.body.classList.add("cart-open");
};

const closeCart = () => {
  document.body.classList.remove("cart-open");
};

const addItemToCart = (item) => {
  setCartOrderNotice("");
  const menuItem = MENU_ITEM_LOOKUP.get(item.id);

  if (!menuItem || !isMenuItemOrderable(menuItem)) {
    setCartOrderNotice(
      `${menuItem?.name || "Este item"} nao esta disponivel para pedido agora.`,
      "error"
    );
    renderCart();
    return;
  }

  const cart = loadCart();
  const existingItem = cart.find((cartItem) => cartItem.id === item.id);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: menuItem.id,
      name: menuItem.name,
      category: formatGroupTitle(menuItem.category),
      price: menuItem.price,
      quantity: 1,
    });
  }

  saveCart(cart);
  renderCart();
};

const changeCartQuantity = (id, delta) => {
  setCartOrderNotice("");
  const cart = loadCart()
    .map((item) =>
      item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
    )
    .filter((item) => item.quantity > 0);

  saveCart(cart);

  if (cart.length === 0) {
    resetCartAddons();
  }

  renderCart();
};

const changeCartAddonQuantity = (id, delta) => {
  setCartOrderNotice("");
  const addons = loadCartAddons().map((addon) =>
    addon.id === id
      ? { ...addon, quantity: Math.max(0, addon.quantity + delta) }
      : addon
  );

  saveCartAddons(addons);
  renderCart();
};

const clearCart = () => {
  setCartOrderNotice("");
  saveCart([]);
  resetCartAddons();
  renderCart();
};

const resetCartAfterCheckout = ({ keepOpen = false } = {}) => {
  saveCart([]);
  saveCartAddons(
    CART_REQUIRED_ADDONS.map((addon) => ({
      id: addon.id,
      quantity: 0,
    }))
  );
  saveCartCheckout({});
  setCartCheckoutExpanded(false);
  renderCart();

  if (!keepOpen) {
    closeCart();
  }
};

const getCartTotalAmount = (cart, addons = loadCartAddons()) => {
  if (cart.length === 0) {
    return 0;
  }

  if (cart.some((item) => typeof item.price !== "number")) {
    return null;
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return Number((cartTotal + getCartAddonsTotalAmount(addons)).toFixed(2));
};

const normalizeOrderHistoryEntry = (order) =>
  normalizeTrackingOrder({
    ...order,
    status: resolveCanonicalOrderStatus(order?.status, order?.fulfillmentMode) || String(order?.status || "").trim(),
  });

const loadOrderHistory = () => loadStoredCollection(ORDER_HISTORY_STORAGE_KEY).map(normalizeOrderHistoryEntry);

const saveOrderHistory = (orders) => {
  saveStoredCollection(
    ORDER_HISTORY_STORAGE_KEY,
    orders.slice(0, 50).map(normalizeOrderHistoryEntry)
  );
};

const setCartOrderNotice = (message = "", tone = "success") => {
  cartUiState.orderNotice = message
    ? {
        message,
        tone,
      }
    : null;
};

const shouldUseManualWhatsappOrderFallback = (error) => {
  const status = Number(error?.status || 0);
  const code = String(error?.code || "").trim().toLowerCase();

  if (error?.name === "AbortError") {
    return true;
  }

  if (!status) {
    return true;
  }

  if (status >= 500) {
    return true;
  }

  return ["internal_error", "request_failed"].includes(code);
};

const triggerManualWhatsappOrderFallback = ({
  cart = loadCart(),
  addons = loadCartAddons(),
  checkout = loadCartCheckout(),
  error = null,
} = {}) => {
  const fallbackUrl = formatWhatsappMessage(cart, addons, checkout);

  if (!fallbackUrl) {
    return false;
  }

  console.error("[order-submit] automatic-flow-unavailable", {
    status: Number(error?.status || 0),
    code: String(error?.code || ""),
    message: String(error?.message || ""),
    fallback: "manual_whatsapp",
  });

  window.setTimeout(() => {
    window.location.assign(fallbackUrl);
  }, 180);

  return true;
};

const getSelectedCartAddonPayload = (addons = loadCartAddons()) =>
  getSelectedCartAddons(addons).map((addon) => ({
    id: addon.id,
    name: addon.name,
    quantity: addon.quantity,
    unitPrice: addon.unitPrice,
    freeUnits: addon.freeUnits,
    chargedQuantity: getCartAddonChargeQuantity(addon),
    totalPrice: getCartAddonTotal(addon),
  }));

const buildCartOrderSubmissionPayload = ({
  cart = loadCart(),
  addons = loadCartAddons(),
  checkout = loadCartCheckout(),
  profile = loadAuthProfile(),
} = {}) => {
  const deliveryQuote = getLatestSavedDeliveryQuote(profile);

  return {
    profile,
    items: cart.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      price: item.price,
    })),
    addons: getSelectedCartAddonPayload(addons),
    checkout: {
      ...checkout,
      customerNotes: checkout.customerNotes || "",
    },
    deliveryQuote: deliveryQuote
      ? {
          ...deliveryQuote,
          reference: deliveryQuote.reference || "",
          neighborhood: deliveryQuote.neighborhood || "",
          city: deliveryQuote.city || "",
          state: deliveryQuote.state || "",
        }
      : null,
  };
};

const recordSubmittedOrderLocally = ({
  profile = loadAuthProfile(),
  cart = loadCart(),
  addons = loadCartAddons(),
  checkout = loadCartCheckout(),
  apiOrder = null,
} = {}) => {
  if (!profile || cart.length === 0 || !apiOrder?.publicId) {
    return false;
  }

  const deliveryQuote = getLatestSavedDeliveryQuote(profile);
  const profileKey = getProfileStorageKey(profile);
  const compactItems = cart.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    price: typeof item.price === "number" ? item.price : null,
  }));
  const compactAddons = getCompactCartAddons(addons);
  const orders = loadOrderHistory();
  const duplicateOrder = orders.find((entry) => entry.publicId === apiOrder.publicId);

  if (duplicateOrder) {
    return true;
  }

  orders.unshift({
    id: apiOrder.publicId,
    publicId: apiOrder.publicId,
    profileKey,
    profileName: profile.name,
    itemCount: Number(apiOrder.itemCount || getCartItemCount(cart)),
    totalAmount: Number(
      apiOrder.totalAmount ||
        getCartGrandTotalAmount(cart, addons, checkout, profile, deliveryQuote) ||
        0
    ),
    createdAt: apiOrder.createdAt || new Date().toISOString(),
    status: resolveCanonicalOrderStatus(apiOrder.status, checkout.fulfillmentMode) || "Recebido",
    items: [...compactItems, ...compactAddons],
    paymentMethod: checkout.paymentMethod || "",
    fulfillmentMode: checkout.fulfillmentMode || "",
    timingMode: checkout.timingMode || "",
    scheduledDate: checkout.timingMode === "scheduled" ? checkout.scheduledDate || "" : "",
    scheduledTime: checkout.timingMode === "scheduled" ? checkout.scheduledTime || "" : "",
    scheduledLabel:
      checkout.timingMode === "scheduled"
        ? formatStoreScheduleLabel(checkout.scheduledDate, checkout.scheduledTime)
        : "",
    deliveryAddress:
      checkout.fulfillmentMode === "delivery"
        ? normalizeCartDeliveryAddress(
            deliveryQuote?.geocodedAddress || deliveryQuote?.destinationLabel || ""
          )
        : "",
    deliveryFee: checkout.fulfillmentMode === "delivery" ? Number(deliveryQuote?.fee || 0) : 0,
    deliveryDistance:
      checkout.fulfillmentMode === "delivery" ? deliveryQuote?.distanceText || "" : "",
    deliveryBand: checkout.fulfillmentMode === "delivery" ? deliveryQuote?.routeBand || "" : "",
    deliveryPreparationTime:
      checkout.fulfillmentMode === "delivery" ? deliveryQuote?.preparationTimeText || "" : "",
    deliveryTravelTime:
      checkout.fulfillmentMode === "delivery" ? deliveryQuote?.travelTimeText || "" : "",
    deliveryTotalTime:
      checkout.fulfillmentMode === "delivery" ? deliveryQuote?.totalEstimateText || "" : "",
    cashChangeRequired: checkout.paymentMethod === "dinheiro" ? checkout.cashChangeRequired : "",
    cashAmountProvided:
      checkout.paymentMethod === "dinheiro" ? checkout.cashAmountProvided || "" : "",
    customerNotes: checkout.customerNotes || "",
    deliveryReference:
      checkout.fulfillmentMode === "delivery" ? deliveryQuote?.reference || "" : "",
  });

  saveOrderHistory(orders);
  renderOrderHistoryPage();
  return true;
};

const submitCartOrder = async () => {
  const profile = loadAuthProfile();
  const cart = loadCart();
  const addons = loadCartAddons();
  const checkout = loadCartCheckout();
  const deliveryQuote = getLatestSavedDeliveryQuote(profile);
  const validation = getCartCheckoutValidation(cart, addons, checkout, profile, deliveryQuote);

  if (cartUiState.orderSubmitting) {
    return;
  }

  if (!profile) {
    openAuth("entry");
    return;
  }

  if (!validation.isValid) {
    openCartCheckoutPanel();
    return;
  }

  cartUiState.orderSubmitting = true;
  setCartOrderNotice("");
  renderCart();

  try {
    const customerClientToken = ensureCustomerClientToken();
    const response = await postJsonWithTimeout(
      ORDER_CREATE_ENDPOINT,
      buildCartOrderSubmissionPayload({
        cart,
        addons,
        checkout,
        profile,
      }),
      ORDER_CREATE_TIMEOUT_MS,
      {
        headers: {
          [CUSTOMER_CLIENT_TOKEN_HEADER]: customerClientToken,
          [CUSTOMER_KEY_HEADER]: buildCustomerSessionKey(profile),
        },
      }
    );

    recordSubmittedOrderLocally({
      profile,
      cart,
      addons,
      checkout,
      apiOrder: response.order,
    });

    resetCartAfterCheckout({
      keepOpen: true,
    });

    setCartOrderNotice(
      response.created
        ? `Pedido ${response.order.publicId} enviado para o gestor.`
        : `Pedido ${response.order.publicId} ja estava registrado e segue em processamento.`,
      "success"
    );
    await refreshCustomerTrackingState({ renderPage: true });
  } catch (error) {
    const fallbackTriggered = shouldUseManualWhatsappOrderFallback(error)
      ? triggerManualWhatsappOrderFallback({
          cart,
          addons,
          checkout,
          error,
        })
      : false;

    setCartOrderNotice(
      fallbackTriggered
        ? "O envio automatico ficou indisponivel. Vamos abrir o WhatsApp com a mensagem do seu pedido pronta para voce nao perder o atendimento."
        : error?.message || "Nao foi possivel enviar o pedido agora. Tente novamente em instantes.",
      "error"
    );
    openCart();
  } finally {
    cartUiState.orderSubmitting = false;
    renderCart();
  }
};

const getRecentOrdersForProfile = (profile) => {
  const profileKey = getProfileStorageKey(profile);
  const cutoff = Date.now() - ORDER_HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  return loadOrderHistory().filter((entry) => {
    if (entry.profileKey !== profileKey) {
      return false;
    }

    return new Date(entry.createdAt).getTime() >= cutoff;
  });
};

const renderOrderHistoryPage = () => {
  const historyRoot = document.querySelector("[data-history-root]");
  const summaryNode = document.querySelector("[data-history-summary]");

  if (!historyRoot) {
    return;
  }

  const profile = loadAuthProfile();

  if (!profile) {
    if (summaryNode) {
      summaryNode.textContent =
        "Entre com sua conta para abrir os pedidos salvos pela sacola do site nos ultimos 30 dias.";
    }

    historyRoot.innerHTML = `
      <div class="history-lock">
        <strong>Login necessario para liberar o historico.</strong>
        <span>Assim que voce entrar, os pedidos ligados a este aparelho aparecem aqui automaticamente.</span>
        <div class="history-actions">
          <button class="button button-primary" type="button" data-auth-open>Entrar para ver historico</button>
          <a class="button button-secondary" href="./cardapio.html">Ir para o cardapio</a>
        </div>
      </div>
    `;
    schedulePortugueseUiRefresh();
    return;
  }

  const recentOrders = getRecentOrdersForProfile(profile);

  if (summaryNode) {
    summaryNode.textContent = recentOrders.length
      ? `${recentOrders.length} pedido${recentOrders.length === 1 ? "" : "s"} encontrado${recentOrders.length === 1 ? "" : "s"} para ${getFirstName(profile.name)} nos ultimos 30 dias.`
      : `Nenhum pedido salvo para ${getFirstName(profile.name)} nos ultimos 30 dias neste aparelho.`;
  }

  if (recentOrders.length === 0) {
    historyRoot.innerHTML = `
      <div class="empty-panel">
        <strong>Nenhum pedido salvo ainda.</strong>
        <span>Quando voce finalizar um pedido no site, ele ficara registrado aqui para consulta.</span>
      </div>
    `;
    schedulePortugueseUiRefresh();
    return;
  }

  historyRoot.innerHTML = `
    <div class="history-list">
      ${recentOrders
        .map(
          (order) => `
            <article class="history-card">
              <div class="history-card-top">
                <div>
                  <strong>Pedido com ${order.itemCount} item${order.itemCount === 1 ? "" : "s"}</strong>
                  <p class="history-meta">${escapeHtml(formatDateTime(order.createdAt))}</p>
                </div>
                <span class="catalog-badge">${
                  typeof order.totalAmount === "number" ? formatPrice(order.totalAmount) : "Consulte valores"
                }</span>
              </div>

              <div class="history-badges">
                <span>Cliente: ${escapeHtml(getFirstName(order.profileName))}</span>
                ${
                  order.fulfillmentMode
                    ? `<span>${escapeHtml(getCartFulfillmentLabel(order.fulfillmentMode))}</span>`
                    : ""
                }
                ${
                  order.timingMode
                    ? `<span>${escapeHtml(getCartOrderTimingLabel(order.timingMode))}</span>`
                    : ""
                }
                ${
                  order.paymentMethod
                    ? `<span>Pagamento: ${escapeHtml(getCartPaymentMethodLabel(order.paymentMethod))}</span>`
                    : ""
                }
                <span>Janela: 30 dias</span>
              </div>

              ${
                order.timingMode === "scheduled" && order.scheduledLabel
                  ? `<p class="history-order-note">Agendado: ${escapeHtml(order.scheduledLabel)}</p>`
                  : ""
              }

              ${
                order.fulfillmentMode === "delivery" && order.deliveryAddress
                  ? `<p class="history-order-note">Entrega: ${escapeHtml(order.deliveryAddress)}${
                      order.deliveryDistance || order.deliveryFee
                        ? ` | ${escapeHtml(order.deliveryDistance || "")}${
                            order.deliveryFee ? ` | ${formatPrice(Number(order.deliveryFee))}` : ""
                          }${order.deliveryBand ? ` | ${escapeHtml(order.deliveryBand)}` : ""}${
                            order.deliveryTotalTime
                              ? ` | ${escapeHtml(order.deliveryTotalTime)}`
                              : ""
                          }`
                        : ""
                    }</p>`
                  : order.fulfillmentMode === "pickup"
                    ? `<p class="history-order-note">${escapeHtml(getPickupEstimateText())}</p>`
                    : ""
              }

              <ul class="history-items">
                ${order.items
                  .map(
                    (item) => `
                      <li>
                        <span>${escapeHtml(item.quantity)}x ${escapeHtml(item.name)}</span>
                        <strong>${escapeHtml(item.category)}</strong>
                      </li>
                    `
                  )
                  .join("")}
              </ul>
            </article>
          `
        )
        .join("")}
    </div>
  `;

  schedulePortugueseUiRefresh();
};

const loadDeliveryHistory = () => loadStoredCollection(DELIVERY_HISTORY_STORAGE_KEY);

const saveDeliveryHistory = (quotes) => {
  saveStoredCollection(DELIVERY_HISTORY_STORAGE_KEY, quotes.slice(0, 6));
};

const getDeliveryHistoryForProfile = (profile = loadAuthProfile()) => {
  const quotes = loadDeliveryHistory();

  if (!profile) {
    return quotes.filter((quote) => !quote?.profileKey);
  }

  const profileKey = getProfileStorageKey(profile);
  return quotes.filter((quote) => quote?.profileKey === profileKey);
};

const getLatestSavedDeliveryQuote = (profile = loadAuthProfile()) =>
  applyDeliveryPricingToQuote(getDeliveryHistoryForProfile(profile)[0] || null);

const getDeliveryFeeRule = (distanceKm) => {
  const matchedRule = DELIVERY_FEE_RULES.find((rule) => distanceKm <= rule.maxDistanceKm);

  if (matchedRule) {
    return matchedRule;
  }

  return {
    fee: Number(distanceKm.toFixed(2)),
    bandLabel: "Acima de 15 km",
    description: "Acima de 15 km, a cobranca passa a ser de R$ 1,00 por km rodado.",
  };
};

const geocodeDeliveryAddress = async (address, fallbackMessage) => {
  logDeliveryDebug("geocode-start", {
    origin: getCurrentPageOrigin(),
    address,
  });
  const { Geocoder } = await google.maps.importLibrary("geocoding");
  const geocoder = new Geocoder();
  const response = await withGoogleMapsTimeout(
    geocoder.geocode({
      address,
      region: GOOGLE_MAPS_REGION,
    }),
    fallbackMessage
  );
  const result = response?.results?.[0];

  if (!result?.geometry?.location) {
    logDeliveryDebug("geocode-empty-result", {
      origin: getCurrentPageOrigin(),
      address,
      response,
    });
    throw createDeliveryEstimateError(
      "O Google Maps nao conseguiu localizar esse endereco com precisao suficiente."
    );
  }

  logDeliveryDebug("geocode-success", {
    origin: getCurrentPageOrigin(),
    address,
    formattedAddress: result.formatted_address || address,
    partialMatch: Boolean(result.partial_match),
  });

  return {
    formattedAddress: result.formatted_address || address,
    location: result.geometry.location,
    partialMatch: Boolean(result.partial_match),
  };
};

const buildDeliveryEstimateResult = ({
  cepDigits,
  streetLabel,
  numericHouseNumber,
  complementLabel,
  referenceLabel = "",
  neighborhoodLabel = "",
  cityLabel = "",
  stateLabel = "",
  destinationLabel,
  geocodedAddress,
  distanceKmRaw,
  distanceText,
  partialMatch = false,
}) => {
  const distanceKm = Number(distanceKmRaw.toFixed(1));
  const cartSubtotal = getCartTotalAmount(loadCart(), loadCartAddons());
  const pricingRule = resolveConfiguredDeliveryPricing({
    distanceKm: distanceKmRaw,
    neighborhood: neighborhoodLabel,
    cartSubtotal,
  });

  if (!pricingRule.deliverable) {
    throw createDeliveryEstimateError(pricingRule.message, "", {
      preventManualFallback: true,
      deliveryReason: pricingRule.reason,
    });
  }

  const deliverySettings = getDeliverySettings();
  const preparationMinutes = Number(
    deliverySettings.deliveryTime?.minMinutes || getPublicAveragePreparationMinutes()
  );
  const travelMinutes = calculateEstimatedDeliveryTravelMinutes(distanceKmRaw);
  const totalEstimateMinutes = Number(deliverySettings.deliveryTime?.maxMinutes || preparationMinutes + travelMinutes);
  const preparationTimeText = formatDeliveryMinutesLabel(preparationMinutes);
  const travelTimeText = formatDeliveryMinutesLabel(travelMinutes);
  const totalEstimateText = getDeliveryTimeText();
  const originSourceLabel = getConfiguredPublicStoreCoordinates()
    ? "Origem configurada do delivery"
    : "Origem legada do delivery";
  const routeSteps = [
    `${originSourceLabel}: ${getPublicStoreLabel()}.`,
    `Destino informado: ${destinationLabel}.`,
    `Endereco confirmado pelo Google Maps: ${geocodedAddress}.`,
    `Distancia calculada entre a loja e o cliente: ${distanceText}.`,
    pricingRule.freeShippingApplied
      ? pricingRule.freeShippingMessage
      : `${pricingRule.bandLabel}: taxa de entrega de ${formatPrice(pricingRule.regularFee)}.`,
    pricingRule.minimumOrderMessage,
    `Tempo estimado de preparo: ${preparationTimeText}.`,
    `Tempo estimado de deslocamento ate o cliente: ${travelTimeText}.`,
    `Mensagem de prazo exibida no checkout: ${totalEstimateText}.`,
    "Em dias chuvosos, o prazo total pode aumentar por causa do deslocamento.",
  ].filter(Boolean);

  if (partialMatch) {
    routeSteps.push(
      "O Google Maps encontrou uma correspondencia parcial para o endereco. Vale conferir o numero, rua e CEP informados."
    );
  }

  return {
    cep: formatCepDisplay(cepDigits),
    street: streetLabel,
    houseNumber: numericHouseNumber,
    complement: complementLabel,
    reference: referenceLabel,
    neighborhood: neighborhoodLabel,
    city: cityLabel,
    state: stateLabel,
    destinationLabel,
    routeBand: pricingRule.bandLabel,
    distanceKm,
    distanceText,
    fee: pricingRule.fee,
    regularFee: pricingRule.regularFee,
    courierFee: pricingRule.courierFee,
    minimumOrder: pricingRule.minimumOrder,
    isMinimumOrderMet: pricingRule.isMinimumOrderMet,
    minimumOrderDifference: pricingRule.minimumOrderDifference,
    minimumOrderMessage: pricingRule.minimumOrderMessage,
    freeShippingApplied: pricingRule.freeShippingApplied,
    freeShippingMessage: pricingRule.freeShippingMessage,
    pricingRuleLabel: pricingRule.freeShippingApplied
      ? pricingRule.freeShippingMessage
      : `${pricingRule.bandLabel}: ${formatPrice(pricingRule.regularFee)}.`,
    preparationMinutes,
    preparationTimeText,
    travelMinutes,
    travelTimeText,
    totalEstimateMinutes,
    totalEstimateText,
    geocodedAddress,
    routeSteps,
    deliverySettingsUpdatedAt: deliverySettings.updatedAt || "",
  };
};

const buildManualDeliveryEstimateResult = ({
  cepDigits,
  streetLabel,
  numericHouseNumber,
  complementLabel,
  referenceLabel = "",
  neighborhoodLabel = "",
  cityLabel = "",
  stateLabel = "",
  destinationLabel,
  destinationAddress,
}) => {
  const deliverySettings = getDeliverySettings();
  const activeBand = getActiveDeliveryBands(deliverySettings)[0] || null;
  const pricingRule = activeBand
    ? resolveConfiguredDeliveryPricing({
        distanceKm: Number(activeBand.minKm || 0),
        neighborhood: neighborhoodLabel,
        cartSubtotal: getCartTotalAmount(loadCart(), loadCartAddons()),
        settings: deliverySettings,
      })
    : null;
  const manualFallbackFee = getPublicDefaultDeliveryFee();
  const fee = pricingRule?.deliverable ? pricingRule.fee : manualFallbackFee;
  const regularFee = pricingRule?.deliverable ? pricingRule.regularFee : manualFallbackFee;
  const routeBand = pricingRule?.deliverable ? pricingRule.bandLabel : DELIVERY_MANUAL_ROUTE_BAND;
  const totalEstimateText = pricingRule?.deliverable ? getDeliveryTimeText() : DELIVERY_MANUAL_TIME_TEXT;
  const originSourceLabel = getConfiguredPublicStoreCoordinates()
    ? "Origem configurada do delivery"
    : "Origem legada do delivery";
  const routeSteps = [
    `${originSourceLabel}: ${getPublicStoreLabel()}.`,
    `Destino informado: ${destinationLabel}.`,
    `Endereco salvo para atendimento: ${destinationAddress}.`,
    pricingRule?.deliverable && pricingRule.freeShippingApplied
      ? pricingRule.freeShippingMessage
      : `Taxa provisoria mostrada no site: ${formatPrice(fee)}.`,
    pricingRule?.deliverable ? pricingRule.minimumOrderMessage : "",
    "A taxa final e o prazo exato serao confirmados pelo atendimento no WhatsApp antes do envio.",
  ].filter(Boolean);

  return {
    cep: formatCepDisplay(cepDigits),
    street: streetLabel,
    houseNumber: numericHouseNumber,
    complement: complementLabel,
    reference: referenceLabel,
    neighborhood: neighborhoodLabel,
    city: cityLabel,
    state: stateLabel,
    destinationLabel,
    routeBand,
    distanceKm: Number(activeBand?.minKm || 0),
    distanceText: "Distancia em confirmacao",
    fee,
    regularFee,
    courierFee: pricingRule?.deliverable ? pricingRule.courierFee : 0,
    minimumOrder: pricingRule?.deliverable ? pricingRule.minimumOrder : 0,
    isMinimumOrderMet: pricingRule?.deliverable ? pricingRule.isMinimumOrderMet : true,
    minimumOrderDifference: pricingRule?.deliverable ? pricingRule.minimumOrderDifference : 0,
    minimumOrderMessage: pricingRule?.deliverable ? pricingRule.minimumOrderMessage : "",
    freeShippingApplied: pricingRule?.deliverable ? pricingRule.freeShippingApplied : false,
    freeShippingMessage: pricingRule?.deliverable ? pricingRule.freeShippingMessage : "",
    pricingRuleLabel: pricingRule?.deliverable
      ? pricingRule.freeShippingApplied
        ? pricingRule.freeShippingMessage
        : `${pricingRule.bandLabel}: ${formatPrice(regularFee)}.`
      : `Taxa minima provisoria de ${formatPrice(
          manualFallbackFee
        )} enquanto o Google Maps estiver indisponivel.`,
    preparationMinutes: Number(
      deliverySettings.deliveryTime?.minMinutes || getPublicAveragePreparationMinutes()
    ),
    preparationTimeText: DELIVERY_MANUAL_TIME_TEXT,
    travelMinutes: 0,
    travelTimeText: DELIVERY_MANUAL_TIME_TEXT,
    totalEstimateMinutes: Number(
      deliverySettings.deliveryTime?.maxMinutes || getPublicAveragePreparationMinutes()
    ),
    totalEstimateText,
    geocodedAddress: destinationAddress,
    routeSteps,
    isManualEstimate: true,
    deliverySettingsUpdatedAt: deliverySettings.updatedAt || "",
  };
};

const saveDeliveryEstimate = (estimate, profile = loadAuthProfile()) => {
  const quotes = loadDeliveryHistory();
  const profileKey = profile ? getProfileStorageKey(profile) : "";

  quotes.unshift({
    ...estimate,
    profileKey,
    profileName: profile?.name || "",
    createdAt: new Date().toISOString(),
  });

  saveDeliveryHistory(quotes);
};

const renderDeliveryEstimateResultCard = (resultNode, estimate) => {
  if (!resultNode) {
    return;
  }

  const isManual = isManualDeliveryQuote(estimate);
  const feeLabel = getDeliveryQuoteFeeText(estimate);
  const summaryLabel = isManual ? "Modo provisorio ativo" : "Estimativa atual";
  const addressLabel = estimate.geocodedAddress || estimate.destinationLabel || "";
  const metaLines = isManual
    ? [
        "Endereco salvo",
        addressLabel,
        estimate.routeBand,
        estimate.freeShippingApplied ? "Frete gratis aplicado" : `Taxa minima: ${feeLabel}`,
        estimate.minimumOrderMessage,
        `Prazo: ${estimate.totalEstimateText || DELIVERY_MANUAL_TIME_TEXT}`,
      ]
    : [
        "Distancia calculada",
        estimate.distanceText,
        estimate.routeBand,
        estimate.freeShippingApplied ? "Frete gratis aplicado" : "",
        estimate.minimumOrderMessage,
        `Preparo: ${estimate.preparationTimeText}`,
        `Deslocamento: ${estimate.travelTimeText}`,
        `Prazo total: ${estimate.totalEstimateText}`,
      ];
  const visibleMetaLines = metaLines.filter(Boolean);

  resultNode.innerHTML = `
    <div class="delivery-summary">
      <div class="delivery-top">
        <div>
          <span class="section-tag">${summaryLabel}</span>
          <strong>${feeLabel}</strong>
        </div>
        <span class="catalog-badge">${escapeHtml(estimate.routeBand)}</span>
      </div>

      <p>${escapeHtml(
        isManual
          ? "Seu endereco foi salvo mesmo sem o Google Maps. O atendimento confirma taxa final e prazo no WhatsApp."
          : `Endereco confirmado: ${addressLabel}.`
      )}</p>

      <div class="delivery-meta">
        ${visibleMetaLines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
      </div>

      <ul class="delivery-route">
        ${estimate.routeSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
      </ul>
    </div>
  `;
};

const calculateDeliveryEstimate = async ({
  street,
  cep,
  houseNumber,
  complement = "",
  reference = "",
  neighborhood = "",
  city = "",
  state = "",
}) => {
  const cepDigits = normalizeCep(cep);
  const streetLabel = String(street || "").trim();
  const numericHouseNumber = String(houseNumber || "").replace(/\D/g, "");
  const complementLabel = String(complement || "").trim();
  const referenceLabel = String(reference || "").trim();
  const neighborhoodLabel = String(neighborhood || "").trim();
  const cityLabel = String(city || "").trim();
  const stateLabel = String(state || "").trim();
  const destinationLabel = buildDeliveryDestinationLabel(
    streetLabel,
    numericHouseNumber,
    cepDigits,
    complementLabel
  );
  const destinationAddress = buildDeliveryDestinationAddress(
    streetLabel,
    numericHouseNumber,
    cepDigits,
    complementLabel,
    neighborhood,
    city,
    state
  );
  const deliveryAvailability = getFulfillmentOptionAvailability("delivery");

  if (!deliveryAvailability.available) {
    throw createDeliveryEstimateError(
      deliveryAvailability.message || "Entrega indisponivel no momento.",
      "",
      { preventManualFallback: true, deliveryReason: "paused" }
    );
  }

  lastGoogleMapsApiErrorMessage = "";
  logDeliveryDebug("delivery-calc-start", {
    origin: getCurrentPageOrigin(),
    destinationLabel,
    destinationAddress,
    cep: formatCepDisplay(cepDigits),
  });

  try {
    await loadGoogleMapsApi();
  } catch (error) {
    console.error("[delivery] maps-init-error", error);
    throw createDeliveryEstimateError(
      normalizeGoogleMapsErrorMessage(
        error,
        "Nao foi possivel inicializar o Google Maps para calcular a distancia."
      ),
      ""
    );
  }

  try {
    const customerGeocode = await geocodeDeliveryAddress(
      destinationAddress,
      "O Google Maps demorou demais para localizar o endereco do cliente."
    );
    const storeCoordinates = getPublicStoreCoordinates();
    const distanceKmRaw = calculateGeodesicDistanceKm(
      storeCoordinates,
      customerGeocode.location
    );
    const distanceText = `${String(Number(distanceKmRaw.toFixed(1))).replace(".", ",")} km`;
    logDeliveryDebug("delivery-calc-success", {
      origin: getCurrentPageOrigin(),
      destinationAddress,
      storeCoordinates,
      usesConfiguredStoreCoordinates: Boolean(getConfiguredPublicStoreCoordinates()),
      geocodedAddress: customerGeocode.formattedAddress,
      partialMatch: customerGeocode.partialMatch,
      distanceKmRaw,
      distanceText,
    });

    return buildDeliveryEstimateResult({
      cepDigits,
      streetLabel,
      numericHouseNumber,
      complementLabel,
      referenceLabel,
      neighborhoodLabel,
      cityLabel,
      stateLabel,
      destinationLabel,
      geocodedAddress: customerGeocode.formattedAddress,
      distanceKmRaw,
      distanceText,
      partialMatch: customerGeocode.partialMatch,
    });
  } catch (error) {
    console.error("[delivery] distance-calc-error", {
      origin: getCurrentPageOrigin(),
      destinationAddress,
      error,
    });
    throw createDeliveryEstimateError(
      normalizeGoogleMapsErrorMessage(
        error,
        "Nao foi possivel calcular a distancia entre a loja e o endereco informado."
      ),
      ""
    );
  }
};

const renderDeliveryHistory = () => {
  const historyRoot = document.querySelector("[data-delivery-history]");

  if (!historyRoot) {
    return;
  }

  const profile = loadAuthProfile();
  const quotes = getDeliveryHistoryForProfile(profile);

  if (quotes.length === 0) {
    historyRoot.innerHTML = `
      <div class="empty-panel">
        <strong>Nenhuma simulacao feita ainda.</strong>
        <span>${
          profile
            ? "A primeira simulacao salva nesta conta aparecera aqui depois do calculo."
            : "Seu calculo de entrega aparecera aqui depois do primeiro envio."
        }</span>
      </div>
    `;
    schedulePortugueseUiRefresh();
    return;
  }

  historyRoot.innerHTML = quotes
    .map(
      (quote) => `
        <article class="timeline-entry">
          <div class="timeline-entry-top">
            <div>
              <strong>${escapeHtml(
                quote.destinationLabel || `${quote.cep} - numero ${quote.houseNumber}`
              )}</strong>
              <span>${escapeHtml(formatDateTime(quote.createdAt))}</span>
            </div>
            <span class="catalog-badge">${formatPrice(Number(quote.fee || 0))}</span>
          </div>
          <span>${escapeHtml(quote.routeBand)} | ${escapeHtml(
            quote.distanceText || `${String(quote.distanceKm || 0)} km`
          )} | ${escapeHtml(quote.totalEstimateText || "Prazo aproximado")}</span>
        </article>
      `
    )
    .join("");

  schedulePortugueseUiRefresh();
};

const submitDeliveryForm = async (form) => {
  const resultNode = document.querySelector("[data-delivery-result]");
  const submitButton = form.querySelector('button[type="submit"]');
  const cepField = form.elements?.namedItem("delivery_cep");
  const streetField = form.elements?.namedItem("delivery_street");
  const cityField = form.elements?.namedItem("delivery_city");

  if (
    normalizeCep(cepField?.value || "").length === 8 &&
    (!String(streetField?.value || "").trim() || !String(cityField?.value || "").trim())
  ) {
    await syncDeliveryCepLookup(form, true);
  }

  const formData = new FormData(form);
  const street = String(formData.get("delivery_street") || "").trim();
  const cep = normalizeCep(formData.get("delivery_cep"));
  const houseNumber = String(formData.get("delivery_number") || "").replace(/\D/g, "");
  const complement = String(formData.get("delivery_complement") || "").trim();
  const reference = String(formData.get("delivery_reference") || "").trim();
  const neighborhood = String(formData.get("delivery_neighborhood") || "").trim();
  const city = String(formData.get("delivery_city") || "").trim();
  const state = String(formData.get("delivery_state") || "").trim();

  if (!street || cep.length !== 8 || !houseNumber) {
    setResultCardState(resultNode, "error");

    if (resultNode) {
      resultNode.innerHTML =
        "<p>Informe rua, CEP valido e numero da casa para calcular a distancia da entrega.</p>";
    }

    schedulePortugueseUiRefresh();
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Calculando rota...";
  }

  if (resultNode) {
    setResultCardState(resultNode, "");
    resultNode.innerHTML =
      "<p>Calculando a entrega automaticamente. Se o Google Maps nao responder, o site salva seu endereco em modo provisorio.</p>";
  }

  schedulePortugueseUiRefresh();

  try {
    const estimate = await calculateDeliveryEstimate({
      street,
      cep,
      houseNumber,
      complement,
      reference,
      neighborhood,
      city,
      state,
    });
    const profile = loadAuthProfile();
    saveDeliveryEstimate(estimate, profile);
    setResultCardState(resultNode, "success");
    renderDeliveryEstimateResultCard(resultNode, estimate);

    renderDeliveryHistory();
    renderCart();
    schedulePortugueseUiRefresh();
  } catch (error) {
    if (error?.preventManualFallback) {
      setResultCardState(resultNode, "error");

      if (resultNode) {
        resultNode.innerHTML = `<p>${escapeHtml(
          error.userMessage || error.message || "Entrega indisponivel para este endereco."
        )}</p>`;
      }

      schedulePortugueseUiRefresh();
      return;
    }

    const estimate = buildManualDeliveryEstimateResult({
      cepDigits: cep,
      streetLabel: street,
      numericHouseNumber: houseNumber,
      complementLabel: complement,
      referenceLabel: reference,
      neighborhoodLabel: neighborhood,
      cityLabel: city,
      stateLabel: state,
      destinationLabel: buildDeliveryDestinationLabel(street, houseNumber, cep, complement),
      destinationAddress: buildDeliveryDestinationAddress(
        street,
        houseNumber,
        cep,
        complement,
        neighborhood,
        city,
        state
      ),
    });
    const profile = loadAuthProfile();
    saveDeliveryEstimate(estimate, profile);
    setResultCardState(resultNode, "success");
    renderDeliveryEstimateResultCard(resultNode, estimate);
    console.warn("[delivery] manual-fallback-enabled", {
      origin: getCurrentPageOrigin(),
      error,
    });
    renderDeliveryHistory();
    renderCart();
    schedulePortugueseUiRefresh();
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Calcular entrega";
    }
  }
};

const clearPublicReviewRotation = () => {
  if (reviewPageState.rotationIntervalId) {
    window.clearInterval(reviewPageState.rotationIntervalId);
    reviewPageState.rotationIntervalId = 0;
  }
};

const renderHomeSocialProof = () => {
  const root = document.querySelector("[data-home-social-proof]");
  const reviewListNode = document.querySelector("[data-home-review-list]");
  const reviewCount = getPublicReviewCount();
  const reviews = getPublicReviews();
  const averageLabel = getPublicReviewAverageLabel();
  const countLabel = getPublicReviewCountLabel();

  document.querySelectorAll("[data-home-review-average]").forEach((node) => {
    node.textContent = reviewCount > 0 ? averageLabel : "--";
  });

  document.querySelectorAll("[data-home-review-count]").forEach((node) => {
    node.textContent = reviewCount > 0 ? countLabel : "Avaliacoes reais";
  });

  if (!root || !reviewListNode) {
    clearPublicReviewRotation();
    return;
  }

  if (!reviews.length || reviewCount <= 0) {
    root.hidden = true;
    reviewListNode.innerHTML = "";
    clearPublicReviewRotation();
    schedulePortugueseUiRefresh(document.body);
    return;
  }

  const visibleReviews = getPublicReviewWindow(
    reviews,
    reviewPageState.rotationIndex,
    PUBLIC_REVIEW_HOME_VISIBLE_COUNT
  );

  root.hidden = false;
  root.querySelectorAll("[data-home-social-average]").forEach((node) => {
    node.textContent = averageLabel;
  });
  root.querySelectorAll("[data-home-social-count]").forEach((node) => {
    node.textContent = countLabel;
  });
  reviewListNode.innerHTML = visibleReviews
    .map(
      (review) => `
        <article class="hero-social-review">
          <span class="hero-social-avatar" aria-hidden="true">${escapeHtml(
            getPublicReviewerInitial(review.name)
          )}</span>
          <div class="hero-social-review-copy">
            <div class="hero-social-review-top">
              <strong>${escapeHtml(getPublicReviewerName(review.name))}</strong>
              <span class="review-stars">${buildRatingStars(review.rating)}</span>
            </div>
            <p>${escapeHtml(getShortPublicReviewMessage(review.message, 96))}</p>
          </div>
        </article>
      `
    )
    .join("");

  schedulePortugueseUiRefresh(document.body);
};

const startPublicReviewRotation = () => {
  const root = document.querySelector("[data-home-social-proof]");
  const reviews = getPublicReviews();

  clearPublicReviewRotation();

  if (!root || reviews.length <= PUBLIC_REVIEW_HOME_VISIBLE_COUNT) {
    return;
  }

  reviewPageState.rotationIntervalId = window.setInterval(() => {
    const currentReviews = getPublicReviews();

    if (currentReviews.length <= PUBLIC_REVIEW_HOME_VISIBLE_COUNT) {
      clearPublicReviewRotation();
      renderHomeSocialProof();
      return;
    }

    reviewPageState.rotationIndex = (reviewPageState.rotationIndex + 1) % currentReviews.length;
    renderHomeSocialProof();
  }, PUBLIC_REVIEW_ROTATION_INTERVAL_MS);
};

const renderPublicReviewSurfaces = ({ rerenderCatalog = false, restartRotation = false } = {}) => {
  renderReviewPage();
  renderHomeSocialProof();

  if (restartRotation) {
    startPublicReviewRotation();
  }

  if (rerenderCatalog && catalogRoot) {
    renderCatalog();
    renderMobileCatalogSheet();
  }
};

const renderReviewPage = () => {
  const averageNode = document.querySelector("[data-review-average]");
  const averageCopyNode = document.querySelector("[data-review-average-copy]");
  const countNode = document.querySelector("[data-review-count]");
  const countCopyNode = document.querySelector("[data-review-count-copy]");
  const listRoot = document.querySelector("[data-review-list]");
  const publicReviewCount = getPublicReviewCount();
  const publicReviews = getPublicReviews();

  if (!averageNode && !countNode && !listRoot) {
    return;
  }

  if (averageNode) {
    averageNode.textContent =
      publicReviewCount > 0 ? getPublicReviewAverageLabel() : "Sem avaliacoes";
  }

  if (averageCopyNode) {
    averageCopyNode.textContent = "Media das avaliacoes publicadas";
  }

  if (countNode) {
    countNode.textContent = getPublicReviewCountLabel();
  }

  if (countCopyNode) {
    countCopyNode.textContent = "Somente avaliacoes visiveis no site";
  }

  if (!listRoot) {
    return;
  }

  if (reviewPageState.loading && publicReviews.length === 0) {
    listRoot.innerHTML = `
      <div class="empty-panel">
        <strong>Carregando avaliacoes</strong>
        <span>Estamos buscando as publicacoes reais do site.</span>
      </div>
    `;
    schedulePortugueseUiRefresh();
    return;
  }

  if (publicReviews.length === 0) {
    listRoot.innerHTML = `
      <div class="empty-panel">
        <strong>Nenhuma avaliacao publicada ainda.</strong>
        <span>Quando as primeiras respostas entrarem na janela ativa, elas aparecerao aqui.</span>
      </div>
    `;
    schedulePortugueseUiRefresh();
    return;
  }

  listRoot.innerHTML = publicReviews
    .map(
      (entry) => `
        <article class="review-card">
          <div class="review-card-top">
            <div>
              <strong>${escapeHtml(getPublicReviewerName(entry.name))}</strong>
              <p>${escapeHtml(formatDateTime(entry.createdAt))}</p>
            </div>
            <span class="review-stars">${buildRatingStars(entry.rating)}</span>
          </div>
          <p>${escapeHtml(getShortPublicReviewMessage(entry.message, 180))}</p>
        </article>
      `
    )
    .join("");

  schedulePortugueseUiRefresh();
};

const shouldLoadPublicReviews = () =>
  Boolean(
    document.querySelector("[data-review-average]") ||
      document.querySelector("[data-review-count]") ||
      document.querySelector("[data-review-list]") ||
      document.querySelector("[data-home-social-proof]") ||
      document.querySelector("[data-home-review-average]") ||
      catalogRoot
  );

const loadReviewPage = async ({ force = false } = {}) => {
  if (!shouldLoadPublicReviews()) {
    return;
  }

  if (publicReviewsHydrationPromise && !force) {
    return publicReviewsHydrationPromise;
  }

  if (reviewPageState.loaded && !force) {
    renderPublicReviewSurfaces();
    return;
  }

  reviewPageState.loading = true;
  reviewPageState.error = "";
  renderPublicReviewSurfaces();

  publicReviewsHydrationPromise = (async () => {
    try {
      const payload = await getJsonWithTimeout(PUBLIC_REVIEWS_ENDPOINT);

      reviewPageState.summary = payload.summary || {
        displayAverage: 0,
        displayAverageLabel: "Sem avaliacoes",
        publicReviewCount: 0,
        publicCountLabel: "0 avaliacoes publicadas",
        recentCountLabel: "Baseado em 0 avaliacoes recentes",
      };
      reviewPageState.reviews = Array.isArray(payload.reviews) ? payload.reviews : [];
      reviewPageState.loaded = true;
      reviewPageState.rotationIndex = 0;
    } catch (error) {
      reviewPageState.summary = {
        displayAverage: 0,
        displayAverageLabel: "Sem avaliacoes",
        publicReviewCount: 0,
        publicCountLabel: "0 avaliacoes publicadas",
        recentCountLabel: "Baseado em 0 avaliacoes recentes",
      };
      reviewPageState.reviews = [];
      reviewPageState.error = error?.message || "Nao foi possivel carregar as avaliacoes.";
    } finally {
      reviewPageState.loading = false;
      publicReviewsHydrationPromise = null;
      renderPublicReviewSurfaces({
        rerenderCatalog: Boolean(catalogRoot),
        restartRotation: true,
      });
    }
  })();

  return publicReviewsHydrationPromise;
};

const submitReviewForm = async (form) => {
  const feedbackNode = document.querySelector("[data-review-feedback]");
  const formData = new FormData(form);
  const profile = loadAuthProfile();
  const submitButton = form.querySelector("button[type='submit']");
  const rating = Number(formData.get("review_rating") || 0);
  const name = String(formData.get("review_name") || profile?.name || "").trim();
  const contact = String(formData.get("review_contact") || "").trim();
  const message = String(formData.get("review_message") || "").trim();

  if (!name || !message || rating < 1 || rating > 5) {
    setResultCardState(feedbackNode, "error");

    if (feedbackNode) {
      feedbackNode.innerHTML =
        "<p>Preencha seu nome, escolha de 1 a 5 estrelas e escreva um comentario.</p>";
    }

    schedulePortugueseUiRefresh();
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Enviando avaliacao...";
  }

  try {
    const payload = await postJsonWithTimeout(PUBLIC_REVIEWS_ENDPOINT, {
      name,
      contact,
      rating,
      message,
      profile: profile
        ? {
            id: profile.id || "",
            phone: profile.phone || "",
            email: profile.email || "",
            customerKey:
              normalizePhone(profile?.phone) ||
              normalizeEmail(profile?.email) ||
              String(profile?.id || ""),
          }
        : {},
    });

    reviewPageState.summary = payload.summary || reviewPageState.summary;
    reviewPageState.reviews = Array.isArray(payload.reviews) ? payload.reviews : reviewPageState.reviews;
    reviewPageState.loaded = true;
    reviewPageState.rotationIndex = 0;
    setResultCardState(feedbackNode, "success");

    if (feedbackNode) {
      feedbackNode.innerHTML = `
        <p>
          Avaliacao enviada com sucesso. Obrigado por dar ${rating} estrela${rating === 1 ? "" : "s"} para o site.
        </p>
      `;
    }

    form.reset();
    renderPublicReviewSurfaces({
      rerenderCatalog: Boolean(catalogRoot),
      restartRotation: true,
    });
    prefillProfileForms();
    schedulePortugueseUiRefresh();
  } catch (error) {
    setResultCardState(feedbackNode, "error");

    if (feedbackNode) {
      feedbackNode.innerHTML = `<p>${escapeHtml(
        error?.message || "Nao foi possivel enviar sua avaliacao agora."
      )}</p>`;
    }

    schedulePortugueseUiRefresh();
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Enviar avaliacao";
    }
  }
};

const submitCareerForm = (form) => {
  const feedbackNode = document.querySelector("[data-career-feedback]");
  const formData = new FormData(form);
  const name = String(formData.get("career_name") || "").trim();
  const phone = normalizePhone(formData.get("career_phone"));
  const email = normalizeEmail(formData.get("career_email"));
  const area = String(formData.get("career_area") || "").trim();
  const experience = String(formData.get("career_experience") || "").trim();
  const schedule = String(formData.get("career_schedule") || "").trim();
  const link = String(formData.get("career_link") || "").trim();
  const message = String(formData.get("career_message") || "").trim();

  if (!name || phone.length < 10 || !email || !area || !experience || !schedule || !message) {
    setResultCardState(feedbackNode, "error");

    if (feedbackNode) {
      feedbackNode.innerHTML =
        "<p>Preencha todos os campos principais para enviar a candidatura.</p>";
    }

    schedulePortugueseUiRefresh();
    return;
  }

  const applications = loadStoredCollection(CAREER_STORAGE_KEY);
  applications.unshift({
    id: `career_${Date.now()}`,
    name,
    phone,
    email,
    area,
    experience,
    schedule,
    link,
    message,
    createdAt: new Date().toISOString(),
  });
  saveStoredCollection(CAREER_STORAGE_KEY, applications.slice(0, 20));
  setResultCardState(feedbackNode, "success");

  if (feedbackNode) {
    feedbackNode.innerHTML = `
      <p>
        Candidatura enviada com sucesso para a area de ${escapeHtml(area)}. A equipe ja pode revisar seus dados neste aparelho.
      </p>
    `;
  }

  form.reset();
  prefillProfileForms();
  schedulePortugueseUiRefresh();
};

const flashAddedState = (button) => {
  const optionNode = button.closest?.("[data-item-chip]") || button;

  if (optionNode.classList.contains("catalog-option")) {
    optionNode.classList.add("is-added");

    window.setTimeout(() => {
      optionNode.classList.remove("is-added");
    }, 900);

    return;
  }

  const originalLabel = button.textContent;
  button.textContent = "Adicionado";
  button.classList.add("is-added");

  window.setTimeout(() => {
    button.textContent = originalLabel;
    button.classList.remove("is-added");
  }, 900);
};

const syncCatalogSelections = () => {
  const quantityById = new Map(loadCart().map((item) => [item.id, item.quantity]));
  const hasItemsByGroup = (itemIds = []) =>
    itemIds.some((itemId) => (quantityById.get(itemId) || 0) > 0);

  document.querySelectorAll("[data-item-chip]").forEach((chip) => {
    const quantity = quantityById.get(chip.dataset.itemId) || 0;
    const quantityNode = chip.querySelector("[data-item-qty]");
    const actionNode = chip.querySelector("[data-item-button]");

    chip.classList.toggle("is-selected", quantity > 0);

    if (actionNode) {
      actionNode.setAttribute("aria-pressed", quantity > 0 ? "true" : "false");
    }

    if (quantityNode) {
      quantityNode.textContent = quantity > 0 ? String(quantity) : "";
    }
  });

  document.querySelectorAll("[data-mobile-catalog-group-card]").forEach((card) => {
    const itemIds = (card.dataset.mobileCatalogGroupItems || "").split(",").filter(Boolean);
    card.classList.toggle("is-in-cart", hasItemsByGroup(itemIds));
  });

  syncCombinadosCartSelections(quantityById);

  document.querySelectorAll("[data-group-total]").forEach((badge) => {
    const itemIds = (badge.dataset.groupItems || "").split(",").filter(Boolean);
    const total = getMenuItemsTotalAmount(itemIds, quantityById);

    badge.textContent = getGroupTotalLabel(total);
  });

  syncGroupMedia(quantityById);
};

const renderCatalog = () => {
  if (!catalogRoot) {
    return;
  }

  lastCatalogViewportMode = getCatalogViewportMode();
  normalizeMenuSectionDisplayOrder();
  normalizeCollapsedCatalogSections(MENU_SECTIONS);
  prepareCatalogTargetItem();

  const sectionOrder = new Map(
    menuSectionDisplayOrder.map((sectionId, index) => [sectionId, index])
  );
  const orderedSections = [...MENU_SECTIONS].sort(
    (left, right) =>
      (sectionOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (sectionOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)
  );

  groupMediaControllers.forEach((_, groupId) => {
    stopGroupMediaCycle(groupId);
  });
  groupMediaControllers.clear();

  catalogRoot.innerHTML = orderedSections
    .map((section) => {
      if (isCatalogMobileViewport()) {
        return renderMobileCatalogSection(section);
      }

      if (section.id === "combinados") {
        return renderCombinadosSection(section);
      }

      return `
      <section class="catalog-block" id="${section.id}">
        ${getCatalogSectionHeadMarkup(section)}
        <div
          class="catalog-block-content${isCatalogSectionCollapsed(section.id) ? " is-collapsed" : ""}"
          id="catalog-section-content-${section.id}"
          data-catalog-section-content="${section.id}"
          ${isCatalogSectionCollapsed(section.id) ? "hidden" : ""}
        >
          <div class="catalog-grid">
            ${groupCatalogItems(section)
              .map((group) => {
                const groupItemIds = group.items.map((item) => item.id).join(",");
                const mediaMarkup =
                  section.id === "porcoes-sushis"
                    ? ""
                    : `
                  <figure
                    class="catalog-media"
                    data-group-media
                    data-group-id="${group.id}"
                    data-group-title="${group.title}"
                    data-group-items="${groupItemIds}" 
                    data-group-default-image="${group.image}"
                    data-group-default-alt="${group.defaultAlt}"
                  >
                    <img
                      class="catalog-media-image is-active"
                      data-group-media-active
                      data-media-src="${group.image}"
                      src="${group.image}"
                      alt="${group.defaultAlt}"
                      loading="lazy"
                      decoding="async"
                    />
                    <img
                      class="catalog-media-image"
                      data-group-media-next
                      data-media-src=""
                      src="${GROUP_MEDIA_PLACEHOLDER_SRC}"
                      alt=""
                      aria-hidden="true"
                    />
                    <figcaption class="catalog-media-caption" data-group-media-caption>
                      Destaque de ${group.title}
                    </figcaption>
                  </figure>`;

                return `
                <article class="catalog-card catalog-card-group reveal">
                  ${mediaMarkup}
                  <div class="catalog-card-top">
                    <div>
                      <p class="catalog-kicker">${section.kicker}</p>
                      <h4>${group.title}</h4>
                    </div>
                    <span
                      class="catalog-badge"
                      data-group-total
                      data-group-items="${groupItemIds}" 
                    >
                      ${EMPTY_GROUP_TOTAL_LABEL}
                    </span>
                  </div>
                  ${section.id === "combinados" ? getComboContentsMarkup(section, group) : `<p>${group.description}</p>`}
                  <div class="catalog-options" aria-label="Opcoes de ${group.title}">
                    ${group.items
                      .map((item) => {
                        const isOrderable = isMenuItemOrderable(item);

                        return `
                          <div
                            class="catalog-option${isTemakiPremiumOption(item) ? " catalog-option-premium" : ""}${item.isPromoted ? " is-promoted" : ""}${!isOrderable ? " is-disabled" : ""}"
                            data-item-chip
                            data-item-id="${item.id}"
                            data-item-name="${escapeHtml(item.name)}"
                            data-item-category="${escapeHtml(group.title)}"
                          >
                            <button
                              class="catalog-option-main"
                              type="button"
                              data-item-button
                              data-add-to-cart
                              aria-pressed="false"
                              aria-label="${escapeHtml(getCatalogItemActionLabel(item))}: ${escapeHtml(item.name)}"
                              ${isOrderable ? "" : "disabled"}
                            >
                              <span class="catalog-option-copy">
                                <span class="catalog-option-label">${getCatalogOptionLabel(
                                  item,
                                  group.title
                                )}</span>
                                ${getCatalogItemPriceMarkup(item, {
                                  tagName: "span",
                                  className: "catalog-option-price",
                                })}
                                ${getCatalogItemStatusMarkup(item)}
                                ${getCatalogItemReviewMarkup(item)}
                              </span>
                            </button>
                            <div class="catalog-option-controls" aria-label="Controle de quantidade">
                              <button
                                class="catalog-stepper"
                                type="button"
                                data-item-decrease
                                aria-label="Diminuir ${escapeHtml(item.name)}"
                              >
                                -
                              </button>
                              <span class="catalog-option-qty" data-item-qty></span>
                              <button
                                class="catalog-stepper"
                                type="button"
                                data-item-increase
                                aria-label="Aumentar ${escapeHtml(item.name)}"
                                ${isOrderable ? "" : "disabled"}
                              >
                                +
                              </button>
                            </div>
                          </div>
                          ${
                            section.id === "temakis" && isTemakiPremiumOption(item)
                              ? '<div class="catalog-option-divider" aria-hidden="true"></div>'
                              : ""
                          }
                        `;
                      })
                      .join("")}
                  </div>
                  <div class="catalog-footer catalog-footer-group">
                    <span class="catalog-pill">${group.detail}</span>
                    <span class="catalog-selection-hint">${group.selectionHint}</span>
                  </div>
                </article>
              `;
              })
              .join("")}
          </div>
        </div>
      </section>
    `;
    })
    .join("");

  syncCatalogSelections();
  syncPublicLayoutNavigation();
  setupReveal();
  scrollToCatalogTargetItem();
  schedulePortugueseUiRefresh();
};

const syncCatalogResponsiveLayout = () => {
  if (!catalogRoot) {
    return;
  }

  if (getCatalogViewportMode() !== lastCatalogViewportMode) {
    closeMobileCatalogSheet();
    renderCatalog();
    return;
  }

  if (!isCatalogMobileViewport()) {
    closeMobileCatalogSheet();
  }

  if (isCatalogMobileViewport()) {
    MENU_SECTIONS.forEach((section) => {
      updateCatalogSectionVisibility(section.id);
    });
  }
};

const handleDocumentInput = (event) => {
  if (event.target.name === "entry_phone" || event.target.name === "career_phone") {
    const digits = normalizePhone(event.target.value);
    event.target.value = formatPhoneDisplay(digits);
  }

  if (event.target.name === "phone_code") {
    event.target.value = String(event.target.value || "")
      .replace(/\D/g, "")
      .slice(0, PHONE_VERIFICATION_CODE_LENGTH);
  }

  if (event.target.name === "cart_cash_amount") {
    event.target.value = normalizeCurrencyInput(event.target.value);
    return;
  }

  if (event.target.name === "delivery_cep") {
    event.target.value = formatCepDisplay(event.target.value);
    const deliveryForm = event.target.closest("[data-delivery-form]");

    if (deliveryForm) {
      const cepDigits = normalizeCep(event.target.value);

      if (cepDigits.length === 8) {
        syncDeliveryCepLookup(deliveryForm);
      } else {
        deliveryForm.dataset.deliveryCepResolved = "";
        clearDeliveryCepMetadata(deliveryForm);
        setDeliveryCepFeedback(
          deliveryForm,
          "Digite o CEP para preencher a rua automaticamente."
        );
      }
    }
  }

  if (
    event.target.name === "cart_payment_method" ||
    event.target.name === "cart_fulfillment_mode" ||
    event.target.name === "cart_cash_change_required" ||
    event.target.name === "cart_timing_mode"
  ) {
    if (event.target.name === "cart_fulfillment_mode") {
      const availability = getFulfillmentOptionAvailability(event.target.value);

      if (!availability.available) {
        setCartOrderNotice(availability.message || "Esta opcao esta indisponivel agora.", "error");
        renderCart();
        return;
      }
    }

    const checkout = loadCartCheckout();
    const nextCheckout = {
      ...checkout,
      paymentMethod:
        event.target.name === "cart_payment_method" ? event.target.value : checkout.paymentMethod,
      fulfillmentMode:
        event.target.name === "cart_fulfillment_mode"
          ? event.target.value
          : checkout.fulfillmentMode,
      cashChangeRequired:
        event.target.name === "cart_cash_change_required"
          ? event.target.value
          : checkout.cashChangeRequired,
      timingMode:
        event.target.name === "cart_timing_mode" ? event.target.value : checkout.timingMode,
    };

    setCartOrderNotice("");
    saveCartCheckout(nextCheckout);
    renderCart();
    return;
  }

  if (
    event.target.name === "cart_scheduled_date" ||
    event.target.name === "cart_scheduled_time"
  ) {
    const checkout = loadCartCheckout();

    setCartOrderNotice("");
    saveCartCheckout({
      ...checkout,
      timingMode: "scheduled",
      scheduledDate:
        event.target.name === "cart_scheduled_date" ? event.target.value : checkout.scheduledDate,
      scheduledTime:
        event.target.name === "cart_scheduled_time" ? event.target.value : checkout.scheduledTime,
    });
    renderCart();
    return;
  }

  if (event.target.name === "cart_customer_notes") {
    const checkout = loadCartCheckout();

    setCartOrderNotice("");
    saveCartCheckout({
      ...checkout,
      customerNotes: event.target.value,
    });
    renderCart();
    return;
  }

  const authForm = event.target.closest("[data-auth-form]");

  if (!authForm || !event.target.name) {
    return;
  }

  authState.draft[event.target.name] = event.target.value;
};

const handleDocumentFocusOut = (event) => {
  if (event.target.name === "cart_cash_amount") {
    const checkout = loadCartCheckout();

    setCartOrderNotice("");
    saveCartCheckout({
      ...checkout,
      cashAmountProvided: event.target.value,
    });
    renderCart();
    return;
  }

  if (
    event.target.name === "cart_scheduled_date" ||
    event.target.name === "cart_scheduled_time"
  ) {
    const checkout = loadCartCheckout();

    setCartOrderNotice("");
    saveCartCheckout({
      ...checkout,
      timingMode: "scheduled",
      scheduledDate:
        event.target.name === "cart_scheduled_date" ? event.target.value : checkout.scheduledDate,
      scheduledTime:
        event.target.name === "cart_scheduled_time" ? event.target.value : checkout.scheduledTime,
    });
    renderCart();
    return;
  }

  if (event.target.name !== "delivery_cep") {
    return;
  }

  const deliveryForm = event.target.closest("[data-delivery-form]");

  if (!deliveryForm) {
    return;
  }

  const cepDigits = normalizeCep(event.target.value);

  if (cepDigits.length === 8) {
    syncDeliveryCepLookup(deliveryForm, true);
  }
};

const handleDocumentSubmit = async (event) => {
  const deliveryForm = event.target.closest("[data-delivery-form]");

  if (deliveryForm) {
    event.preventDefault();
    submitDeliveryForm(deliveryForm);
    return;
  }

  const reviewForm = event.target.closest("[data-review-form]");

  if (reviewForm) {
    event.preventDefault();
    submitReviewForm(reviewForm);
    return;
  }

  const careerForm = event.target.closest("[data-career-form]");

  if (careerForm) {
    event.preventDefault();
    submitCareerForm(careerForm);
    return;
  }

  const phoneForm = event.target.closest("[data-auth-phone-form]");

  if (phoneForm) {
    event.preventDefault();
    const formData = new FormData(phoneForm);
    const name = String(formData.get("entry_name") || "").trim();
    const phone = normalizePhone(formData.get("entry_phone"));

    authState.draft = serializeDraft(formData);

    if (!name || phone.length < 10) {
      authState.error = "Preencha nome e telefone valido para continuar.";
      authState.message = "";
      renderAuthPanel();
      return;
    }

    await startPhoneVerification(name, phone);
    return;
  }

  const phoneVerifyForm = event.target.closest("[data-auth-phone-verify-form]");

  if (!phoneVerifyForm) {
    return;
  }

  event.preventDefault();
  const formData = new FormData(phoneVerifyForm);
  const code = String(formData.get("phone_code") || "").trim();

  authState.draft = {
    ...authState.draft,
    ...serializeDraft(formData),
  };

  await confirmPhoneVerification(code);
};

const handleDocumentClick = (event) => {
  const navToggleButton = event.target.closest("[data-nav-toggle]");
  if (navToggleButton) {
    event.preventDefault();
    toggleMobileNavigation();
    return;
  }

  if (document.body.classList.contains("nav-open")) {
    const navLink = event.target.closest(".nav-links a");

    if (navLink) {
      closeMobileNavigation();
      return;
    }

    if (!event.target.closest(".nav-shell")) {
      closeMobileNavigation();
    }
  }

  const authOpenButton = event.target.closest("[data-auth-open]");
  if (authOpenButton) {
    openAuth(loadAuthProfile() ? "profile" : "entry");
    return;
  }

  const authCloseButton = event.target.closest("[data-auth-close]");
  if (authCloseButton) {
    closeAuth();
    return;
  }

  const authSocialButton = event.target.closest("[data-auth-social]");
  if (authSocialButton) {
    authState.view = "social";
    authState.socialProvider = authSocialButton.dataset.authSocial || null;
    authState.socialStatus = "idle";
    authState.editing = false;
    authState.error = "";
    authState.message = `Pronto para verificar sua conta com ${getAuthProviderLabel(
      authState.socialProvider
    )}.`;
    renderAuthPanel();
    return;
  }

  const authEntryButton = event.target.closest("[data-auth-entry]");
  if (authEntryButton) {
    authState.view = "entry";
    authState.phoneCodeStatus = "idle";
    authState.socialProvider = null;
    authState.socialStatus = "idle";
    authState.phoneVerification = null;
    authState.error = "";
    authState.message = "";
    renderAuthPanel();
    return;
  }

  const authStartSocial = event.target.closest("[data-auth-start-social]");
  if (authStartSocial) {
    startSocialVerification();
    return;
  }

  const authPhoneResend = event.target.closest("[data-auth-phone-resend]");
  if (authPhoneResend && authState.phoneVerification) {
    void startPhoneVerification(authState.phoneVerification.name, authState.phoneVerification.phone, {
      resent: true,
    });
    return;
  }

  const authEditButton = event.target.closest("[data-auth-edit]");
  if (authEditButton) {
    const profile = loadAuthProfile();
    authState.view = "entry";
    authState.editing = true;
    authState.phoneCodeStatus = "idle";
    authState.socialProvider = null;
    authState.socialStatus = "idle";
    authState.error = "";
    authState.message = "Atualize nome e telefone e confirme novamente o numero.";
    authState.draft = {};
    renderAuthPanel();
    return;
  }

  const authLogoutButton = event.target.closest("[data-auth-logout]");
  if (authLogoutButton) {
    void postJsonWithTimeout(CUSTOMER_LOGOUT_ENDPOINT, {}, 8000).catch(() => {});
    clearAuthProfile();
    clearCustomerClientToken();
    customerTrackingState.loading = false;
    customerTrackingState.loaded = true;
    customerTrackingState.authenticated = false;
    customerTrackingState.activeOrder = null;
    authState.view = "entry";
    authState.socialProvider = null;
    authState.socialStatus = "idle";
    authState.editing = false;
    authState.phoneCodeStatus = "idle";
    authState.error = "";
    authState.message = "Voce saiu da conta neste aparelho.";
    authState.draft = {};
    updateAuthTriggers();
    renderAuthPanel();
    renderCart();
    renderDeliveryHistory();
    renderOrderHistoryPage();
    renderTrackingPage();
    void loadReviewPage();
    prefillProfileForms();
    return;
  }

  const mobileCatalogSheetClose = event.target.closest("[data-mobile-catalog-sheet-close]");
  if (mobileCatalogSheetClose) {
    closeMobileCatalogSheet();
    return;
  }

  const mobileCatalogSectionButton = event.target.closest("[data-mobile-catalog-section-open]");
  if (mobileCatalogSectionButton) {
    openMobileCatalogSheet(mobileCatalogSectionButton.dataset.mobileCatalogSectionOpen);
    return;
  }

  const mobileCatalogGroupButton = event.target.closest("[data-mobile-catalog-group-open]");
  if (mobileCatalogGroupButton) {
    openMobileCatalogSheet(
      mobileCatalogGroupButton.dataset.mobileCatalogGroupOpen,
      mobileCatalogGroupButton.dataset.mobileCatalogGroupId || ""
    );
    return;
  }

  const mobileCatalogFilterButton = event.target.closest("[data-mobile-catalog-sheet-filter]");
  if (mobileCatalogFilterButton) {
    setMobileCatalogSheetGroup(mobileCatalogFilterButton.dataset.mobileCatalogSheetFilter || "");
    return;
  }

  const cartSubmitButton = event.target.closest("[data-cart-submit]");
  if (cartSubmitButton) {
    void submitCartOrder();
    return;
  }

  const whatsappLink = event.target.closest("a[href*='wa.me']");
  if (whatsappLink) {
    event.preventDefault();
    const profile = loadAuthProfile();
    authState.pendingIntent = "";

    if (!profile) {
      openAuth("entry", whatsappLink.href);
      return;
    }

    const baseHref = whatsappLink.dataset.baseHref || whatsappLink.href;
    const preparedHref = appendProfileToWhatsappHref(baseHref);

    whatsappLink.dataset.baseHref = baseHref;
    authState.pendingIntent = "";

    if (whatsappLink.target === "_blank") {
      const popup = window.open(preparedHref, "_blank", "noopener");

      if (!popup) {
        window.location.href = preparedHref;
      }

      return;
    }

    window.location.href = preparedHref;
    return;
  }

  const toggleButton = event.target.closest("[data-cart-toggle]");
  if (toggleButton) {
    openCart();
    return;
  }

  const closeButton = event.target.closest("[data-cart-close]");
  if (closeButton) {
    closeCart();
    return;
  }

  const clearButton = event.target.closest("[data-cart-clear]");
  if (clearButton) {
    clearCart();
    return;
  }

  const checkoutToggleButton = event.target.closest("[data-cart-checkout-toggle]");
  if (checkoutToggleButton) {
    setCartCheckoutExpanded(!cartUiState.checkoutExpanded);
    syncCartCheckoutDock();
    return;
  }

  const catalogSectionToggleButton = event.target.closest("[data-catalog-section-toggle]");
  if (catalogSectionToggleButton) {
    toggleCatalogSectionVisibility(catalogSectionToggleButton.dataset.catalogSectionToggle);
    return;
  }

  const catalogSectionHead = event.target.closest("[data-catalog-section-head]");
  if (
    catalogSectionHead &&
    isCatalogMobileViewport() &&
    !event.target.closest("button, a, input, select, textarea, label")
  ) {
    toggleCatalogSectionVisibility(catalogSectionHead.dataset.catalogSectionHead);
    return;
  }

  const increaseButton = event.target.closest("[data-item-increase]");
  if (increaseButton) {
    const itemChip = increaseButton.closest("[data-item-chip]");

    if (itemChip) {
      addItemToCart({
        id: itemChip.dataset.itemId,
      });
      flashAddedState(increaseButton);
      closeMobileCatalogSheetAfterCartSelection(increaseButton);
    }
    return;
  }

  const decreaseButton = event.target.closest("[data-item-decrease]");
  if (decreaseButton) {
    const itemChip = decreaseButton.closest("[data-item-chip]");

    if (itemChip) {
      changeCartQuantity(itemChip.dataset.itemId, -1);
    }
    return;
  }

  const combinadoCategoryButton = event.target.closest("[data-combinado-category-id]");
  if (combinadoCategoryButton) {
    const categoryId = combinadoCategoryButton.dataset.combinadoCategoryId;
    updateCombinadosCategorySelection(categoryId);
    return;
  }

  const combinadoItemButton = event.target.closest("[data-combinado-item-id]");
  if (combinadoItemButton) {
    const comboId = combinadoItemButton.dataset.combinadoItemId;
    updateCombinadosComboSelection(comboId);
    return;
  }

  const combinadoDetailsButton = event.target.closest("[data-combinado-detail-toggle]");
  if (combinadoDetailsButton) {
    updateCombinadosComboSelection(combinadoDetailsButton.dataset.combinadoDetailToggle);
    return;
  }

  const addButton = event.target.closest("[data-add-to-cart]");
  if (addButton) {
    const itemChip = addButton.closest("[data-item-chip]");

    if (!itemChip) {
      return;
    }

    addItemToCart({
      id: itemChip.dataset.itemId,
    });
    flashAddedState(addButton);
    closeMobileCatalogSheetAfterCartSelection(addButton);
    return;
  }

  const quantityButton = event.target.closest("[data-cart-change]");
  if (quantityButton) {
    changeCartQuantity(
      quantityButton.dataset.cartChange,
      Number(quantityButton.dataset.delta || 0)
    );
    return;
  }

  const addonQuantityButton = event.target.closest("[data-cart-addon-change]");
  if (addonQuantityButton) {
    changeCartAddonQuantity(
      addonQuantityButton.dataset.cartAddonChange,
      Number(addonQuantityButton.dataset.delta || 0)
    );
    return;
  }
};

document.addEventListener("click", handleDocumentClick);
document.addEventListener("input", handleDocumentInput);
document.addEventListener("focusout", handleDocumentFocusOut);
document.addEventListener("submit", handleDocumentSubmit);
window.addEventListener(
  "error",
  (event) => {
    captureGoogleMapsApiError(event.message);
  },
  true
);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMobileNavigation();
    closeAuth();
    closeMobileCatalogSheet();
    closeCart();
  }
});

renderCatalog();
createMobileCatalogSheetShell();
createCartShell();
createAuthShell();
createSiteFooter();
applyRestaurantSettingsToPublicSite();
refreshStoreStatusUi({ rerenderCartUi: false });
setupMobileNavigation();
updateAuthTriggers();
renderAuthPanel();
renderCart();
void loadPublicRestaurantSettings();
void loadPublicDeliverySettings();
void hydrateCatalogRuntimeState();
setActiveNavigation();
initComboHeroImages();
renderDeliveryHistory();
renderOrderHistoryPage();
renderTrackingPage();
void refreshCustomerTrackingState({ renderPage: true });
void loadReviewPage();
prefillProfileForms();
setupReveal();
updateHeaderState();
refreshPortugueseUi(document.body);
setupWhatsappBubble();
startStoreStatusRefresh();
window.setInterval(() => {
  void refreshCustomerTrackingState({
    renderPage: Boolean(document.querySelector("[data-tracking-root]")),
  });
}, CUSTOMER_TRACKING_REFRESH_INTERVAL_MS);
window.addEventListener("scroll", updateHeaderState, { passive: true });
window.addEventListener(
  "resize",
  () => {
    syncMobileNavigationState();
    syncCatalogResponsiveLayout();
  },
  { passive: true }
);
