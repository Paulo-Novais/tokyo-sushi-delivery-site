const fs = require("node:fs");
const path = require("node:path");

const CONFIG_PATH = path.join(__dirname, "..", "site.config.json");

const cloneJson = (value) => JSON.parse(JSON.stringify(value));

const readSiteConfig = () => {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch (error) {
    return {};
  }
};

const siteConfig = readSiteConfig();

const DEFAULT_ADDRESS = Object.freeze({
  full: "Rua General Osorio, 2165, Franca - SP, 14400-520, Brasil",
  label: "R. General Osorio, 2165 - CEP 14400-520",
  postalCode: "14400-520",
  street: "Rua General Osorio",
  number: "2165",
  complement: "",
  neighborhood: "",
  city: "Franca",
  state: "SP",
  cityState: "Franca - SP",
  footerStreetLine: "Rua General Osório, 2165",
  footerCityLine: "Franca - SP, CEP 14400-520",
  footerBottomLine: "Rua General Osório, 2165 - Franca - SP.",
});

const DEFAULT_FEATURES = Object.freeze({
  deliveryCalculation: true,
  advancedReports: true,
  crm: true,
  inventory: true,
  finance: true,
  reviews: true,
  promotions: true,
  scheduledOrders: true,
});

const DEFAULT_ASSETS = Object.freeze({
  siteIcon: "./site-images/site-icon.png",
  publicLogo: "./site-images/tokyo-logo-premium-transparent.png",
  publicBanner: "./site-images/combinado-imperial.png",
  socialImage: "/site-images/combinado-imperial.png",
  supportAvatar: "./site-images/support-avatar-duo.webp",
  loginCover: "./site-images/login-cover-floating.png",
  adminSidebarLogo: "../assets/inovas-food-logo-oficial.png",
});

const DEFAULT_IDENTIFIERS = Object.freeze({
  storageKeys: {
    cart: "tokyo_sushi_delivery_cart",
    authProfile: "tokyo_sushi_profile",
    authAccounts: "tokyo_sushi_accounts",
    customerClientToken: "tokyo_customer_client_token",
    orderHistory: "tokyo_sushi_order_history",
    cartAddons: "tokyo_sushi_delivery_cart_addons",
    cartCheckout: "tokyo_sushi_cart_checkout",
    deliveryHistory: "tokyo_sushi_delivery_quotes",
    careerForms: "tokyo_sushi_career_forms",
    catalogCollapsedSections: "tokyo_sushi_catalog_collapsed_sections",
    googleMapsApiKey: "tokyo_google_maps_api_key",
    adminTheme: "tokyo_admin_theme",
  },
  cookieNames: {
    adminSession: "tokyo_admin_session",
    customerSession: "tokyo_customer_session",
    customerLoginChallenge: "tokyo_customer_login_challenge",
  },
  headerNames: {
    customerClientToken: "x-tokyo-customer-client-token",
    customerKey: "x-tokyo-customer-key",
  },
  globalNames: {
    siteConfig: "TOKYO_SITE_CONFIG",
    businessHoursApi: "TokyoBusinessHours",
    storeHoursApi: "TokyoStoreHours",
    googleMapsApiKey: "TOKYO_GOOGLE_MAPS_API_KEY",
  },
  socialEmailDomain: "social.tokyo",
});

const DEFAULT_ADMIN_BRANDING = Object.freeze({
  indexTitle: "Gestor | INovas Food",
  loginTitle: "Login | INovas Food",
  privateAreaLabel: "Area privada",
  loginHeadline: "Gestor web administrativo INovas Food",
  loginPlaceholder: "seuemail@exemplo.com",
  sidebarEyebrow: "INovas Food",
  sidebarTitle: "Painel Operacional",
  sidebarSubtitle: "Gestor de pedidos",
  displayNameFallback: "Gestor INovas",
});

const DEFAULT_WHATSAPP_TEMPLATES = Object.freeze({
  orderSupport: "Ola, quero fazer um pedido no {restaurantName}.",
  deliverySupport: "Olá, quero tirar uma dúvida sobre a entrega.",
  reviewSupport: "Olá, quero falar sobre minha avaliacao do site.",
  careerSupport: "Olá, quero falar sobre uma vaga no Tokyo Sushi.",
  historySupport: "Olá, quero ajuda com meu historico de pedidos.",
  trackingSupport: "Olá, quero ajuda com meu pedido.",
  verificationTemplateText:
    "Seu codigo Tokyo Sushi Delivery e {{1}}. Digite no site para concluir o login.",
});

const DEFAULT_PUBLIC_TEXT = Object.freeze({
  authAccessLabel: "Acesso Tokyo",
  menuItemAltTemplate: "{itemName} do Tokyo Sushi Delivery",
  loginCoverAlt: "Arte de login Tokyo Sushi com cerejeiras, logo e combinado de sushi",
});

const DEFAULT_SITE_APPEARANCE = Object.freeze({
  layout: "MODERN",
  theme: "DARK",
  layouts: ["MODERN", "CATALOGO", "PREMIUM"],
  themes: ["LIGHT", "DARK", "AUTO"],
  colors: {
    primary: "#e83637",
    secondary: "#f5c3d3",
    accent: "#f2b649",
    gradientStart: "#e83637",
    gradientEnd: "#2b1214",
    useGradient: true,
  },
  identity: {
    slogan: "Delivery Premium",
    description: "Cada detalhe e pensado para transformar seu pedido em uma experiencia unica.",
  },
  social: {
    instagram: "",
    facebook: "",
    tiktok: "",
    site: "https://tokyosushidelivery.com.br",
  },
  seo: {
    title: "Tokyo Sushi Delivery",
    description:
      "Tokyo Sushi Delivery com experiencia premium, cardapio sofisticado e pedidos direto pelo site.",
    shareImage: "/site-images/combinado-imperial.png",
    keywords: ["Tokyo Sushi", "sushi delivery", "delivery japones", "Franca SP"],
    openGraph: {
      title: "Tokyo Sushi Delivery",
      description:
        "Tokyo Sushi Delivery com experiencia premium, cardapio sofisticado e pedidos direto pelo site.",
      image: "/site-images/combinado-imperial.png",
      type: "website",
    },
  },
  platformFooter: {
    showPlatformBranding: true,
    brandName: "INovas Food",
    headline: "Desenvolvido por INovas Food",
    description: "Plataforma profissional para restaurantes",
    url: "https://www.inovasfood.com.br",
    displayUrl: "www.inovasfood.com.br",
  },
});

const normalizeText = (value, fallback = "") => {
  const normalizedValue = String(value || "").trim();
  return normalizedValue || fallback;
};

const normalizeObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const mergeObject = (fallback, value) => ({
  ...fallback,
  ...normalizeObject(value),
});

const mergeNestedObject = (fallback, value) => {
  const source = normalizeObject(value);

  return Object.entries(fallback).reduce((result, [key, fallbackValue]) => {
    if (fallbackValue && typeof fallbackValue === "object" && !Array.isArray(fallbackValue)) {
      result[key] = mergeObject(fallbackValue, source[key]);
      return result;
    }

    result[key] = normalizeText(source[key], fallbackValue);
    return result;
  }, {});
};

const defaultAddress = Object.freeze({
  ...DEFAULT_ADDRESS,
  ...normalizeObject(siteConfig.defaultAddress),
});

const APP_BRANDING = Object.freeze({
  appName: normalizeText(siteConfig.appName, normalizeText(siteConfig.siteName, "Tokyo Sushi Delivery")),
  appShortName: normalizeText(siteConfig.appShortName, "Tokyo Sushi"),
  brandTagline: normalizeText(siteConfig.brandTagline, "Delivery Premium"),
  supportEmail: normalizeText(siteConfig.supportEmail, "admin@tokyosushidelivery.com.br"),
  supportPhone: normalizeText(siteConfig.supportPhone, normalizeText(siteConfig.defaultWhatsapp, "5516990507398")),
  companyName: normalizeText(siteConfig.companyName, "Tokyo Sushi Delivery"),
  companyWebsite: normalizeText(siteConfig.companyWebsite, "https://tokyosushidelivery.com.br"),
  footerPoweredBy: normalizeText(siteConfig.footerPoweredBy, "Tokyo Sushi Delivery Premium"),
  platformName: normalizeText(siteConfig.platformName, "Tokyo Sushi Delivery"),
  platformVersion: normalizeText(siteConfig.platformVersion, "1.0.0"),
  defaultWhatsapp: normalizeText(siteConfig.defaultWhatsapp, "5516990507398"),
  defaultAddress,
  publicOrderPrefix: normalizeText(siteConfig.publicOrderPrefix, "TKY"),
});

const platformBrandConfig = normalizeObject(siteConfig.platformBrand);
const restaurantBrandConfig = normalizeObject(siteConfig.restaurantBrand);
const siteAppearanceConfig = normalizeObject(siteConfig.siteAppearance);

const PLATFORM_BRAND = Object.freeze({
  name: normalizeText(platformBrandConfig.name, APP_BRANDING.platformName),
  logo: normalizeText(platformBrandConfig.logo, "./site-images/tokyo-logo-premium-transparent.png"),
  primaryColor: normalizeText(platformBrandConfig.primaryColor, "#e83637"),
  secondaryColor: normalizeText(platformBrandConfig.secondaryColor, "#f5c3d3"),
});

const RESTAURANT_BRAND = Object.freeze({
  name: normalizeText(restaurantBrandConfig.name, APP_BRANDING.appName),
  logo: normalizeText(restaurantBrandConfig.logo, PLATFORM_BRAND.logo),
  banner: normalizeText(restaurantBrandConfig.banner, "./site-images/combinado-imperial.png"),
  primaryColor: normalizeText(restaurantBrandConfig.primaryColor, PLATFORM_BRAND.primaryColor),
  secondaryColor: normalizeText(restaurantBrandConfig.secondaryColor, PLATFORM_BRAND.secondaryColor),
  slogan: normalizeText(
    restaurantBrandConfig.slogan,
    normalizeText(siteAppearanceConfig.identity?.slogan, APP_BRANDING.brandTagline)
  ),
  description: normalizeText(
    restaurantBrandConfig.description,
    normalizeText(
      siteAppearanceConfig.identity?.description,
      DEFAULT_SITE_APPEARANCE.identity.description
    )
  ),
});

const siteAppearanceColors = mergeObject(DEFAULT_SITE_APPEARANCE.colors, siteAppearanceConfig.colors);
const siteAppearanceIdentity = mergeObject(DEFAULT_SITE_APPEARANCE.identity, {
  ...siteAppearanceConfig.identity,
  slogan: normalizeText(siteAppearanceConfig.identity?.slogan, RESTAURANT_BRAND.slogan),
  description: normalizeText(
    siteAppearanceConfig.identity?.description,
    RESTAURANT_BRAND.description
  ),
});
const siteAppearanceSeo = {
  ...mergeObject(DEFAULT_SITE_APPEARANCE.seo, siteAppearanceConfig.seo),
  keywords: Array.isArray(siteAppearanceConfig.seo?.keywords)
    ? siteAppearanceConfig.seo.keywords
    : DEFAULT_SITE_APPEARANCE.seo.keywords,
  openGraph: mergeObject(
    DEFAULT_SITE_APPEARANCE.seo.openGraph,
    siteAppearanceConfig.seo?.openGraph
  ),
};

const SITE_APPEARANCE = Object.freeze({
  ...DEFAULT_SITE_APPEARANCE,
  ...siteAppearanceConfig,
  layout: normalizeText(siteAppearanceConfig.layout, DEFAULT_SITE_APPEARANCE.layout).toUpperCase(),
  theme: normalizeText(siteAppearanceConfig.theme, DEFAULT_SITE_APPEARANCE.theme).toUpperCase(),
  layouts: Array.isArray(siteAppearanceConfig.layouts)
    ? siteAppearanceConfig.layouts
    : DEFAULT_SITE_APPEARANCE.layouts,
  themes: Array.isArray(siteAppearanceConfig.themes)
    ? siteAppearanceConfig.themes
    : DEFAULT_SITE_APPEARANCE.themes,
  colors: siteAppearanceColors,
  identity: siteAppearanceIdentity,
  social: mergeObject(DEFAULT_SITE_APPEARANCE.social, siteAppearanceConfig.social),
  seo: siteAppearanceSeo,
  platformFooter: mergeObject(
    DEFAULT_SITE_APPEARANCE.platformFooter,
    siteAppearanceConfig.platformFooter
  ),
});

const FEATURE_FLAGS = Object.freeze({
  ...DEFAULT_FEATURES,
  ...normalizeObject(siteConfig.features),
});

const ASSETS = Object.freeze(mergeObject(DEFAULT_ASSETS, siteConfig.assets));
const IDENTIFIERS = Object.freeze(mergeNestedObject(DEFAULT_IDENTIFIERS, siteConfig.identifiers));
const ADMIN_BRANDING = Object.freeze(mergeObject(DEFAULT_ADMIN_BRANDING, siteConfig.adminBranding));
const WHATSAPP_TEMPLATES = Object.freeze(
  mergeObject(DEFAULT_WHATSAPP_TEMPLATES, siteConfig.whatsappTemplates)
);
const PUBLIC_TEXT = Object.freeze(mergeObject(DEFAULT_PUBLIC_TEXT, siteConfig.publicText));
const PAGE_CONTENT = Object.freeze(normalizeObject(siteConfig.pages));
const prefixConfig = normalizeObject(siteConfig.prefixes);
const ORDER_PREFIXES = Object.freeze({
  publicOrder: normalizeText(prefixConfig.publicOrder, APP_BRANDING.publicOrderPrefix),
  customer: normalizeText(prefixConfig.customer, normalizeText(siteConfig.customerPrefix, "tokyo_customer")),
  promotion: normalizeText(
    prefixConfig.promotion,
    normalizeText(siteConfig.promotionPrefix, "tokyo_promotion")
  ),
  coupon: normalizeText(prefixConfig.coupon, normalizeText(siteConfig.couponPrefix, "TKY")),
});

module.exports = {
  ADMIN_BRANDING,
  APP_BRANDING,
  ASSETS,
  FEATURE_FLAGS,
  IDENTIFIERS,
  ORDER_PREFIXES,
  PAGE_CONTENT,
  PLATFORM_BRAND,
  PUBLIC_TEXT,
  RESTAURANT_BRAND,
  SITE_APPEARANCE,
  WHATSAPP_TEMPLATES,
  getAdminBranding: () => cloneJson(ADMIN_BRANDING),
  getAppBranding: () => cloneJson(APP_BRANDING),
  getAssets: () => cloneJson(ASSETS),
  getFeatureFlags: () => cloneJson(FEATURE_FLAGS),
  getIdentifiers: () => cloneJson(IDENTIFIERS),
  getOrderPrefixes: () => cloneJson(ORDER_PREFIXES),
  getPageContent: () => cloneJson(PAGE_CONTENT),
  getPlatformBrand: () => cloneJson(PLATFORM_BRAND),
  getPublicText: () => cloneJson(PUBLIC_TEXT),
  getRestaurantBrand: () => cloneJson(RESTAURANT_BRAND),
  getSiteAppearance: () => cloneJson(SITE_APPEARANCE),
  getWhatsappTemplates: () => cloneJson(WHATSAPP_TEMPLATES),
};
