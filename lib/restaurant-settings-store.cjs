const fs = require("node:fs/promises");
const path = require("node:path");
const { neon } = require("@neondatabase/serverless");
const { APP_BRANDING, RESTAURANT_BRAND, SITE_APPEARANCE } = require("./app-branding.cjs");
const { buildHttpError } = require("./http.cjs");
const { getOperationalTenant } = require("./tenant-context.cjs");

const LOCAL_STORAGE_FILE = path.join(process.cwd(), ".data", "restaurant-settings.json");
const LOCAL_STORE_VERSION = 1;
const RESTAURANT_KEY = "default";
const MAX_TEXT_LENGTH = 420;
const BUSINESS_SCHEDULE_DAY_KEYS = Object.freeze([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

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

let sqlClient = null;
let schemaReadyPromise = null;

const cloneJson = (value) => JSON.parse(JSON.stringify(value));
const DEFAULT_BRANDING_ADDRESS = APP_BRANDING.defaultAddress || {};
const SITE_LAYOUT_OPTIONS = Object.freeze(["MODERN", "CATALOGO", "PREMIUM"]);
const SITE_THEME_OPTIONS = Object.freeze(["LIGHT", "DARK", "AUTO"]);
const DEFAULT_APPEARANCE_COLORS = SITE_APPEARANCE.colors || {};
const DEFAULT_APPEARANCE_IDENTITY = SITE_APPEARANCE.identity || {};
const DEFAULT_APPEARANCE_SOCIAL = SITE_APPEARANCE.social || {};
const DEFAULT_APPEARANCE_SEO = SITE_APPEARANCE.seo || {};
const DEFAULT_PLATFORM_FOOTER = SITE_APPEARANCE.platformFooter || {};
const DEFAULT_SITE_APPEARANCE_SETTINGS = Object.freeze({
  layout: SITE_LAYOUT_OPTIONS.includes(String(SITE_APPEARANCE.layout || "").toUpperCase())
    ? String(SITE_APPEARANCE.layout).toUpperCase()
    : "MODERN",
  theme: SITE_THEME_OPTIONS.includes(String(SITE_APPEARANCE.theme || "").toUpperCase())
    ? String(SITE_APPEARANCE.theme).toUpperCase()
    : "DARK",
  colors: {
    primary: DEFAULT_APPEARANCE_COLORS.primary || RESTAURANT_BRAND.primaryColor || "#e83637",
    secondary:
      DEFAULT_APPEARANCE_COLORS.secondary || RESTAURANT_BRAND.secondaryColor || "#f5c3d3",
    accent: DEFAULT_APPEARANCE_COLORS.accent || "#f2b649",
    gradientStart:
      DEFAULT_APPEARANCE_COLORS.gradientStart ||
      DEFAULT_APPEARANCE_COLORS.primary ||
      RESTAURANT_BRAND.primaryColor ||
      "#e83637",
    gradientEnd: DEFAULT_APPEARANCE_COLORS.gradientEnd || "#2b1214",
    useGradient: DEFAULT_APPEARANCE_COLORS.useGradient !== false,
  },
  identity: {
    slogan: DEFAULT_APPEARANCE_IDENTITY.slogan || RESTAURANT_BRAND.slogan || "Delivery Premium",
    description:
      DEFAULT_APPEARANCE_IDENTITY.description ||
      RESTAURANT_BRAND.description ||
      "Cada detalhe e pensado para transformar seu pedido em uma experiencia unica.",
  },
  social: {
    instagram: DEFAULT_APPEARANCE_SOCIAL.instagram || "",
    facebook: DEFAULT_APPEARANCE_SOCIAL.facebook || "",
    tiktok: DEFAULT_APPEARANCE_SOCIAL.tiktok || "",
    site: DEFAULT_APPEARANCE_SOCIAL.site || APP_BRANDING.companyWebsite || "",
  },
  seo: {
    title: DEFAULT_APPEARANCE_SEO.title || RESTAURANT_BRAND.name || APP_BRANDING.appName,
    description:
      DEFAULT_APPEARANCE_SEO.description ||
      DEFAULT_APPEARANCE_IDENTITY.description ||
      RESTAURANT_BRAND.description ||
      "",
    shareImage:
      DEFAULT_APPEARANCE_SEO.shareImage ||
      RESTAURANT_BRAND.banner ||
      "/site-images/combinado-imperial.png",
    keywords: Array.isArray(DEFAULT_APPEARANCE_SEO.keywords)
      ? DEFAULT_APPEARANCE_SEO.keywords
      : ["Tokyo Sushi", "sushi delivery", "delivery japones"],
    openGraph: {
      title:
        DEFAULT_APPEARANCE_SEO.openGraph?.title ||
        DEFAULT_APPEARANCE_SEO.title ||
        RESTAURANT_BRAND.name ||
        APP_BRANDING.appName,
      description:
        DEFAULT_APPEARANCE_SEO.openGraph?.description ||
        DEFAULT_APPEARANCE_SEO.description ||
        DEFAULT_APPEARANCE_IDENTITY.description ||
        "",
      image:
        DEFAULT_APPEARANCE_SEO.openGraph?.image ||
        DEFAULT_APPEARANCE_SEO.shareImage ||
        RESTAURANT_BRAND.banner ||
        "/site-images/combinado-imperial.png",
      type: DEFAULT_APPEARANCE_SEO.openGraph?.type || "website",
    },
  },
  platformFooter: {
    showPlatformBranding: DEFAULT_PLATFORM_FOOTER.showPlatformBranding !== false,
    brandName: DEFAULT_PLATFORM_FOOTER.brandName || "INovas Food",
    headline: DEFAULT_PLATFORM_FOOTER.headline || "Desenvolvido por INovas Food",
    description:
      DEFAULT_PLATFORM_FOOTER.description || "Plataforma profissional para restaurantes",
    url: DEFAULT_PLATFORM_FOOTER.url || "https://www.inovasfood.com.br",
    displayUrl: DEFAULT_PLATFORM_FOOTER.displayUrl || "www.inovasfood.com.br",
  },
});

const DEFAULT_RESTAURANT_SETTINGS = Object.freeze({
  tenantId: "tenant_default",
  restaurantId: "restaurant_default",
  restaurantKey: RESTAURANT_KEY,
  restaurantName: RESTAURANT_BRAND.name,
  logoUrl: RESTAURANT_BRAND.logo,
  bannerUrl: RESTAURANT_BRAND.banner,
  primaryColor: DEFAULT_SITE_APPEARANCE_SETTINGS.colors.primary,
  secondaryColor: DEFAULT_SITE_APPEARANCE_SETTINGS.colors.secondary,
  accentColor: DEFAULT_SITE_APPEARANCE_SETTINGS.colors.accent,
  gradientStart: DEFAULT_SITE_APPEARANCE_SETTINGS.colors.gradientStart,
  gradientEnd: DEFAULT_SITE_APPEARANCE_SETTINGS.colors.gradientEnd,
  useGradient: DEFAULT_SITE_APPEARANCE_SETTINGS.colors.useGradient,
  siteLayout: DEFAULT_SITE_APPEARANCE_SETTINGS.layout,
  siteTheme: DEFAULT_SITE_APPEARANCE_SETTINGS.theme,
  slogan: DEFAULT_SITE_APPEARANCE_SETTINGS.identity.slogan,
  description: DEFAULT_SITE_APPEARANCE_SETTINGS.identity.description,
  instagram: DEFAULT_SITE_APPEARANCE_SETTINGS.social.instagram,
  facebook: DEFAULT_SITE_APPEARANCE_SETTINGS.social.facebook,
  tiktok: DEFAULT_SITE_APPEARANCE_SETTINGS.social.tiktok,
  site: DEFAULT_SITE_APPEARANCE_SETTINGS.social.site,
  seoTitle: DEFAULT_SITE_APPEARANCE_SETTINGS.seo.title,
  seoDescription: DEFAULT_SITE_APPEARANCE_SETTINGS.seo.description,
  seoShareImage: DEFAULT_SITE_APPEARANCE_SETTINGS.seo.shareImage,
  seoKeywords: [...DEFAULT_SITE_APPEARANCE_SETTINGS.seo.keywords],
  seoOpenGraph: { ...DEFAULT_SITE_APPEARANCE_SETTINGS.seo.openGraph },
  platformFooter: { ...DEFAULT_SITE_APPEARANCE_SETTINGS.platformFooter },
  appearance: cloneJson(DEFAULT_SITE_APPEARANCE_SETTINGS),
  whatsapp: APP_BRANDING.defaultWhatsapp,
  address: DEFAULT_BRANDING_ADDRESS.full,
  addressFields: {
    postalCode: DEFAULT_BRANDING_ADDRESS.postalCode,
    street: DEFAULT_BRANDING_ADDRESS.street,
    number: DEFAULT_BRANDING_ADDRESS.number,
    complement: DEFAULT_BRANDING_ADDRESS.complement,
    neighborhood: DEFAULT_BRANDING_ADDRESS.neighborhood,
    city: DEFAULT_BRANDING_ADDRESS.city,
    state: DEFAULT_BRANDING_ADDRESS.state,
  },
  deliveryBase: {
    latitude: null,
    longitude: null,
    maxDeliveryRadiusKm: 14.9,
    fixedDeliveryFee: 9,
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
  defaultDeliveryFee: 9,
  averagePreparationTimeMinutes: 25,
  presentationText:
    "Cada detalhe e pensado para transformar seu pedido em uma experiencia unica.",
  updatedAt: "",
  updatedByLogin: "",
  updatedByDisplayName: "",
});

const getDefaultRestaurantSettings = () => cloneJson(DEFAULT_RESTAURANT_SETTINGS);

const getEmptyLocalStore = () => ({
  version: LOCAL_STORE_VERSION,
  tenantId: "tenant_default",
  restaurantId: "restaurant_default",
  restaurantKey: RESTAURANT_KEY,
  settings: getDefaultRestaurantSettings(),
  tenants: {},
});

const getStorageMode = () => {
  if (String(process.env.DATABASE_URL || "").trim()) {
    return "neon";
  }

  return process.env.NODE_ENV === "production" ? "disabled" : "file";
};

const assertStorageIsAvailable = () => {
  if (getStorageMode() === "disabled") {
    throw buildHttpError(
      503,
      "DATABASE_URL ainda nao foi configurada. As configuracoes do restaurante precisam de armazenamento persistente.",
      "restaurant_settings_storage_unavailable"
    );
  }
};

const getSql = () => {
  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }

  return sqlClient;
};

const ensureRestaurantSettingsSchema = async () => {
  if (schemaReadyPromise) {
    return schemaReadyPromise;
  }

  const sql = getSql();
  schemaReadyPromise = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS restaurant_settings (
        restaurant_key TEXT NOT NULL,
        tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
        restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default',
        settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by_login TEXT NOT NULL DEFAULT '',
        updated_by_display_name TEXT NOT NULL DEFAULT ''
      )
    `;

    await sql`
      ALTER TABLE restaurant_settings
      ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default'
    `;

    await sql`
      ALTER TABLE restaurant_settings
      ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default'
    `;

    await sql`
      ALTER TABLE restaurant_settings
      DROP CONSTRAINT IF EXISTS restaurant_settings_pkey
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS restaurant_settings_updated_at_idx
      ON restaurant_settings (updated_at DESC)
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS restaurant_settings_tenant_restaurant_key_uidx
      ON restaurant_settings (tenant_id, restaurant_id, restaurant_key)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS restaurant_settings_tenant_restaurant_updated_idx
      ON restaurant_settings (tenant_id, restaurant_id, updated_at DESC)
    `;
  })();

  return schemaReadyPromise;
};

const ensureFileStore = async () => {
  await fs.mkdir(path.dirname(LOCAL_STORAGE_FILE), { recursive: true });

  try {
    await fs.access(LOCAL_STORAGE_FILE);
  } catch (error) {
    await fs.writeFile(LOCAL_STORAGE_FILE, JSON.stringify(getEmptyLocalStore(), null, 2));
  }
};

const normalizeText = (value, maxLength = MAX_TEXT_LENGTH) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const normalizeMultilineText = (value, maxLength = 900) =>
  String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);

const normalizeAssetUrl = (value, fallback = "") => {
  const normalizedValue = normalizeText(value, 2048);

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

const normalizeColor = (value, fallback) => {
  const normalizedValue = normalizeText(value, 32).toLowerCase();

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

const normalizeWhatsapp = (value, fallback = DEFAULT_RESTAURANT_SETTINGS.whatsapp) => {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 18);
  return digits.length >= 10 ? digits : fallback;
};

const normalizePostalCode = (value, fallback = "") => {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);

  if (digits.length !== 8) {
    return fallback;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

const normalizeStateCode = (value, fallback = "") => {
  const normalizedValue = normalizeText(value, 2).replace(/[^a-z]/gi, "").toUpperCase();
  return normalizedValue.length === 2 ? normalizedValue : fallback;
};

const normalizeBoolean = (value, fallback = false) => {
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

const normalizeObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const normalizeOption = (value, allowedValues, fallback) => {
  const normalizedValue = normalizeText(value, 40).toUpperCase();
  return allowedValues.includes(normalizedValue) ? normalizedValue : fallback;
};

const normalizeKeywords = (value, fallback = []) => {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((entry) => entry.trim());

  const keywords = source
    .map((entry) => normalizeText(entry, 48))
    .filter(Boolean)
    .slice(0, 16);

  return keywords.length ? keywords : [...fallback];
};

const normalizeLinkValue = (value, fallback = "") =>
  normalizeText(value, 2048) || normalizeText(fallback, 2048);

const normalizeSeoSettings = (settings = {}, fallback = DEFAULT_SITE_APPEARANCE_SETTINGS.seo) => {
  const source = normalizeObject(settings);
  const seo = normalizeObject(source.seo || source.appearance?.seo);
  const openGraphSource = normalizeObject(source.seoOpenGraph || seo.openGraph);
  const title = normalizeText(source.seoTitle || seo.title, 180) || fallback.title;
  const description =
    normalizeMultilineText(source.seoDescription || seo.description, 320) ||
    fallback.description;
  const shareImage = normalizeAssetUrl(
    source.seoShareImage || source.seoImage || seo.shareImage || seo.image,
    fallback.shareImage
  );

  return {
    title,
    description,
    shareImage,
    keywords: normalizeKeywords(source.seoKeywords || seo.keywords, fallback.keywords),
    openGraph: {
      title: normalizeText(openGraphSource.title, 180) || title,
      description: normalizeMultilineText(openGraphSource.description, 320) || description,
      image: normalizeAssetUrl(openGraphSource.image, shareImage),
      type: normalizeText(openGraphSource.type, 60) || fallback.openGraph?.type || "website",
    },
  };
};

const normalizePlatformFooter = (
  settings = {},
  fallback = DEFAULT_SITE_APPEARANCE_SETTINGS.platformFooter
) => {
  const source = normalizeObject(settings.platformFooter || settings.appearance?.platformFooter);

  return {
    showPlatformBranding: normalizeBoolean(
      source.showPlatformBranding,
      fallback.showPlatformBranding !== false
    ),
    brandName: normalizeText(source.brandName, 80) || fallback.brandName,
    headline: normalizeText(source.headline, 120) || fallback.headline,
    description: normalizeText(source.description, 180) || fallback.description,
    url: normalizeLinkValue(source.url, fallback.url),
    displayUrl: normalizeText(source.displayUrl, 120) || fallback.displayUrl,
  };
};

const normalizeAppearance = (
  settings = {},
  fallback = DEFAULT_SITE_APPEARANCE_SETTINGS
) => {
  const source = normalizeObject(settings);
  const appearanceSource = normalizeObject(source.appearance);
  const colorSource = normalizeObject(appearanceSource.colors || source.colors);
  const identitySource = normalizeObject(appearanceSource.identity || source.identity);
  const socialSource = normalizeObject(appearanceSource.social || source.social);
  const colors = {
    primary: normalizeColor(
      source.primaryColor || colorSource.primary,
      fallback.colors.primary
    ),
    secondary: normalizeColor(
      source.secondaryColor || colorSource.secondary,
      fallback.colors.secondary
    ),
    accent: normalizeColor(source.accentColor || colorSource.accent, fallback.colors.accent),
    gradientStart: normalizeColor(
      source.gradientStart || colorSource.gradientStart,
      fallback.colors.gradientStart
    ),
    gradientEnd: normalizeColor(
      source.gradientEnd || colorSource.gradientEnd,
      fallback.colors.gradientEnd
    ),
    useGradient: normalizeBoolean(
      source.useGradient ?? colorSource.useGradient,
      fallback.colors.useGradient !== false
    ),
  };
  const identity = {
    slogan:
      normalizeText(source.slogan || identitySource.slogan, 140) ||
      fallback.identity.slogan,
    description:
      normalizeMultilineText(
        source.description || identitySource.description || source.presentationText,
        900
      ) || fallback.identity.description,
  };
  const social = {
    instagram: normalizeLinkValue(source.instagram || socialSource.instagram),
    facebook: normalizeLinkValue(source.facebook || socialSource.facebook),
    tiktok: normalizeLinkValue(source.tiktok || socialSource.tiktok),
    site: normalizeLinkValue(source.site || socialSource.site, fallback.social.site),
  };

  return {
    layout: normalizeOption(
      source.siteLayout || source.layout || appearanceSource.layout,
      SITE_LAYOUT_OPTIONS,
      fallback.layout
    ),
    theme: normalizeOption(
      source.siteTheme || source.theme || appearanceSource.theme,
      SITE_THEME_OPTIONS,
      fallback.theme
    ),
    colors,
    identity,
    social,
    seo: normalizeSeoSettings(source, fallback.seo),
    platformFooter: normalizePlatformFooter(source, fallback.platformFooter),
  };
};

const toNumberOrNull = (value) => {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const normalizedValue = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=.*\.)/g, "")
    .replace(",", ".");
  const numericValue = Number(normalizedValue);

  return Number.isFinite(numericValue) ? numericValue : null;
};

const toNonNegativeNumber = (value, fallback = 0, precision = 2, maximum = 9999) => {
  const numericValue = toNumberOrNull(value);
  const resolvedValue = numericValue === null ? Number(fallback || 0) : numericValue;

  return Number(Math.max(0, Math.min(maximum, resolvedValue)).toFixed(precision));
};

const toPositiveInteger = (value, fallback = 0, maximum = 9999) => {
  const numericValue = toNumberOrNull(value);
  const resolvedValue = numericValue === null ? Number(fallback || 0) : numericValue;

  return Math.max(0, Math.min(maximum, Math.round(resolvedValue)));
};

const normalizeCoordinate = (value, minimum, maximum) => {
  const numericValue = toNumberOrNull(value);

  if (numericValue === null || numericValue < minimum || numericValue > maximum) {
    return null;
  }

  return Number(numericValue.toFixed(8));
};

const normalizeAddressFields = (addressFields = {}, fallback = DEFAULT_RESTAURANT_SETTINGS.addressFields) => {
  const source = addressFields && typeof addressFields === "object" ? addressFields : {};

  return {
    postalCode: normalizePostalCode(source.postalCode || source.cep, fallback.postalCode),
    street: normalizeText(source.street || source.rua, 160) || fallback.street,
    number: normalizeText(source.number || source.numero, 40) || fallback.number,
    complement: normalizeText(source.complement || source.complemento, 120),
    neighborhood:
      normalizeText(source.neighborhood || source.bairro, 120) || fallback.neighborhood,
    city: normalizeText(source.city || source.cidade, 120) || fallback.city,
    state: normalizeStateCode(source.state || source.estado, fallback.state),
  };
};

const buildFriendlyAddress = (addressFields = {}, fallback = "") => {
  const primaryLine = [addressFields.street, addressFields.number]
    .map((part) => normalizeText(part, 160))
    .filter(Boolean)
    .join(", ");
  const details = [
    addressFields.complement,
    addressFields.neighborhood,
    [addressFields.city, addressFields.state].filter(Boolean).join(" - "),
    addressFields.postalCode ? `CEP ${addressFields.postalCode}` : "",
    "Brasil",
  ]
    .map((part) => normalizeText(part, 160))
    .filter(Boolean);
  const address = [primaryLine, ...details].filter(Boolean).join(", ");

  return address || normalizeText(fallback, 260);
};

const normalizeDeliveryBase = (deliveryBase = {}, fallback = DEFAULT_RESTAURANT_SETTINGS.deliveryBase) => {
  const source = deliveryBase && typeof deliveryBase === "object" ? deliveryBase : {};

  return {
    latitude: normalizeCoordinate(source.latitude, -90, 90),
    longitude: normalizeCoordinate(source.longitude, -180, 180),
    maxDeliveryRadiusKm: toNonNegativeNumber(
      source.maxDeliveryRadiusKm,
      fallback.maxDeliveryRadiusKm,
      2,
      999
    ),
    fixedDeliveryFee: toNonNegativeNumber(
      source.fixedDeliveryFee ?? source.defaultDeliveryFee,
      fallback.fixedDeliveryFee,
      2,
      500
    ),
    pricePerKm: toNonNegativeNumber(source.pricePerKm, fallback.pricePerKm, 2, 500),
    minimumDeliveryOrder: toNonNegativeNumber(
      source.minimumDeliveryOrder,
      fallback.minimumDeliveryOrder,
      2,
      5000
    ),
    pickupEnabled: normalizeBoolean(source.pickupEnabled, fallback.pickupEnabled),
    deliveryEnabled: normalizeBoolean(source.deliveryEnabled, fallback.deliveryEnabled),
  };
};

const normalizeTimeValue = (value, fallback = "") => {
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

const parseTimeToMinutes = (value) => {
  const normalizedTime = normalizeTimeValue(value, "");

  if (!normalizedTime) {
    return NaN;
  }

  const [hours, minutes] = normalizedTime.split(":").map((part) => Number(part));
  return hours * 60 + minutes;
};

const normalizeDateValue = (value) => {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return "";
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
};

const normalizeBusinessScheduleDay = (day = {}, fallback = {}) => {
  const source = day && typeof day === "object" ? day : {};
  const fallbackOpenTime = normalizeTimeValue(fallback.openTime, "18:00");
  const fallbackCloseTime = normalizeTimeValue(fallback.closeTime, "23:00");
  const openTime = normalizeTimeValue(
    source.openTime || source.openingTime || source.abertura,
    fallbackOpenTime
  );
  let closeTime = normalizeTimeValue(
    source.closeTime || source.closingTime || source.fechamento,
    fallbackCloseTime
  );

  if (parseTimeToMinutes(closeTime) <= parseTimeToMinutes(openTime)) {
    closeTime = fallbackCloseTime;
  }

  let pauseStart = normalizeTimeValue(
    source.pauseStart || source.breakStart || source.pause1Start || source.pausaInicio,
    fallback.pauseStart || ""
  );
  let pauseEnd = normalizeTimeValue(
    source.pauseEnd || source.breakEnd || source.pause1End || source.pausaFim,
    fallback.pauseEnd || ""
  );
  const pauseStartMinutes = parseTimeToMinutes(pauseStart);
  const pauseEndMinutes = parseTimeToMinutes(pauseEnd);
  const openMinutes = parseTimeToMinutes(openTime);
  const closeMinutes = parseTimeToMinutes(closeTime);

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
    isOpen: normalizeBoolean(source.isOpen ?? source.open ?? source.aberto, fallback.isOpen !== false),
    openTime,
    closeTime,
    pauseStart,
    pauseEnd,
  };
};

const normalizeBusinessSpecialDate = (entry = {}, fallback = {}) => {
  const source = entry && typeof entry === "object" ? entry : {};
  const date = normalizeDateValue(source.date || source.dateValue || fallback.date);

  if (!date) {
    return null;
  }

  const fallbackOpenTime = normalizeTimeValue(fallback.openTime, "18:00");
  const fallbackCloseTime = normalizeTimeValue(fallback.closeTime, "23:00");
  const openTime = normalizeTimeValue(
    source.openTime || source.openingTime || source.abertura,
    fallbackOpenTime
  );
  let closeTime = normalizeTimeValue(
    source.closeTime || source.closingTime || source.fechamento,
    fallbackCloseTime
  );

  if (parseTimeToMinutes(closeTime) <= parseTimeToMinutes(openTime)) {
    closeTime = fallbackCloseTime;
  }

  let pauseStart = normalizeTimeValue(
    source.pauseStart || source.breakStart || source.pause1Start || source.pausaInicio,
    fallback.pauseStart || ""
  );
  let pauseEnd = normalizeTimeValue(
    source.pauseEnd || source.breakEnd || source.pause1End || source.pausaFim,
    fallback.pauseEnd || ""
  );
  const pauseStartMinutes = parseTimeToMinutes(pauseStart);
  const pauseEndMinutes = parseTimeToMinutes(pauseEnd);
  const openMinutes = parseTimeToMinutes(openTime);
  const closeMinutes = parseTimeToMinutes(closeTime);

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
    id: normalizeText(source.id, 80) || `special-${date}`,
    date,
    name: normalizeText(source.name || source.description || source.descricao, 120),
    isOpen: normalizeBoolean(source.isOpen ?? source.open ?? source.aberto, fallback.isOpen === true),
    openTime,
    closeTime,
    pauseStart,
    pauseEnd,
    message: normalizeMultilineText(source.message || source.customerMessage || source.mensagem, 360),
  };
};

const normalizeBusinessSpecialDates = (specialDates = []) => {
  if (!Array.isArray(specialDates)) {
    return [];
  }

  const byDate = new Map();

  specialDates.forEach((entry) => {
    const normalizedEntry = normalizeBusinessSpecialDate(entry);

    if (normalizedEntry) {
      byDate.set(normalizedEntry.date, normalizedEntry);
    }
  });

  return Array.from(byDate.values()).sort((left, right) => left.date.localeCompare(right.date));
};

const normalizeBusinessSchedule = (
  businessSchedule = {},
  fallback = DEFAULT_RESTAURANT_SETTINGS.businessSchedule
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
    normalizedDays[dayKey] = normalizeBusinessScheduleDay(
      sourceDays[dayKey],
      fallbackDays[dayKey] || {
        isOpen: true,
        openTime: "18:00",
        closeTime: "23:00",
        pauseStart: "",
        pauseEnd: "",
      }
    );

    return normalizedDays;
  }, {});

  return {
    timeZone:
      normalizeText(source.timeZone || source.timezone, 80) ||
      fallback.timeZone ||
      "America/Sao_Paulo",
    acceptOrdersOutsideHours: normalizeBoolean(
      source.acceptOrdersOutsideHours ?? source.acceptOutsideHours,
      fallback.acceptOrdersOutsideHours
    ),
    closedMessage:
      normalizeMultilineText(source.closedMessage, 360) || fallback.closedMessage,
    peakPreparationExtraMinutes: toPositiveInteger(
      source.peakPreparationExtraMinutes,
      fallback.peakPreparationExtraMinutes,
      240
    ),
    specialDates: normalizeBusinessSpecialDates(source.specialDates || source.exceptionDates || source.holidays),
    days,
  };
};

const normalizeRestaurantSettings = (settings = {}) => {
  const defaults = getDefaultRestaurantSettings();
  const source = settings && typeof settings === "object" ? settings : {};
  const hasStructuredAddressSource =
    Boolean(source.addressFields && typeof source.addressFields === "object") ||
    ["postalCode", "cep", "street", "rua", "number", "numero", "city", "cidade", "state", "estado"].some(
      (fieldName) => normalizeText(source[fieldName], 160)
    );
  const addressFields = normalizeAddressFields(
    hasStructuredAddressSource
      ? source.addressFields || {
      postalCode: source.postalCode,
      street: source.street,
      number: source.number,
      complement: source.complement,
      neighborhood: source.neighborhood,
      city: source.city,
      state: source.state,
        }
      : defaults.addressFields,
    defaults.addressFields
  );
  const deliveryBase = normalizeDeliveryBase(
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
  const businessSchedule = normalizeBusinessSchedule(
    source.businessSchedule || source.weeklySchedule || defaults.businessSchedule,
    defaults.businessSchedule
  );
  const appearance = normalizeAppearance(source, defaults.appearance);
  const restaurantName =
    normalizeText(source.restaurantName, 120) || defaults.restaurantName;
  const logoUrl = normalizeAssetUrl(source.logoUrl, defaults.logoUrl);
  const bannerUrl = normalizeAssetUrl(source.bannerUrl, defaults.bannerUrl);
  const presentationText =
    normalizeMultilineText(source.presentationText || appearance.identity.description, 900) ||
    defaults.presentationText;

  return {
    tenantId: normalizeText(source.tenantId || source.tenant_id, 120) || "tenant_default",
    restaurantId: normalizeText(source.restaurantId || source.restaurant_id, 120) || "restaurant_default",
    restaurantKey: normalizeText(source.restaurantKey || source.restaurant_key, 120) || RESTAURANT_KEY,
    restaurantName,
    logoUrl,
    bannerUrl,
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
    whatsapp: normalizeWhatsapp(source.whatsapp, defaults.whatsapp),
    address: hasStructuredAddressSource
      ? buildFriendlyAddress(addressFields, normalizeText(source.address, 260) || defaults.address)
      : normalizeText(source.address, 260) || defaults.address,
    addressFields,
    deliveryBase,
    businessHours: normalizeText(source.businessHours, 160) || defaults.businessHours,
    businessSchedule,
    hasStructuredBusinessSchedule,
    defaultDeliveryFee: toNonNegativeNumber(
      source.defaultDeliveryFee ?? deliveryBase.fixedDeliveryFee,
      deliveryBase.fixedDeliveryFee,
      2,
      500
    ),
    averagePreparationTimeMinutes: toPositiveInteger(
      source.averagePreparationTimeMinutes,
      defaults.averagePreparationTimeMinutes,
      360
    ),
    presentationText,
    updatedAt: normalizeText(source.updatedAt, 80),
    updatedByLogin: normalizeText(source.updatedByLogin, 120).toLowerCase(),
    updatedByDisplayName: normalizeText(source.updatedByDisplayName, 160),
  };
};

const readFileStore = async () => {
  await ensureFileStore();
  const contents = await fs.readFile(LOCAL_STORAGE_FILE, "utf8");

  try {
    const parsed = JSON.parse(contents);

    return {
      version: Number(parsed?.version || LOCAL_STORE_VERSION),
      tenantId: normalizeText(parsed?.tenantId || parsed?.tenant_id, 120) || "tenant_default",
      restaurantId: normalizeText(parsed?.restaurantId || parsed?.restaurant_id, 120) || "restaurant_default",
      restaurantKey: normalizeText(parsed?.restaurantKey || parsed?.restaurant_key, 120) || RESTAURANT_KEY,
      settings: normalizeRestaurantSettings(parsed?.settings || {}),
      tenants:
        parsed?.tenants && typeof parsed.tenants === "object" && !Array.isArray(parsed.tenants)
          ? parsed.tenants
          : {},
    };
  } catch (error) {
    return getEmptyLocalStore();
  }
};

const writeFileStore = async (store) => {
  await fs.mkdir(path.dirname(LOCAL_STORAGE_FILE), { recursive: true });
  await fs.writeFile(
    LOCAL_STORAGE_FILE,
    JSON.stringify(
      {
        ...getEmptyLocalStore(),
        ...(store && typeof store === "object" ? store : {}),
        tenantId: normalizeText(store?.tenantId || store?.tenant_id, 120) || "tenant_default",
        restaurantId: normalizeText(store?.restaurantId || store?.restaurant_id, 120) || "restaurant_default",
        restaurantKey: normalizeText(store?.restaurantKey || store?.restaurant_key, 120) || RESTAURANT_KEY,
        settings: normalizeRestaurantSettings(store?.settings || {}),
        tenants:
          store?.tenants && typeof store.tenants === "object" && !Array.isArray(store.tenants)
            ? store.tenants
            : {},
      },
      null,
      2
    )
  );
};

const readSettingsFromNeon = async (tenant) => {
  await ensureRestaurantSettingsSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT settings_json, updated_at, updated_by_login, updated_by_display_name
    FROM restaurant_settings
    WHERE tenant_id = ${tenant.tenantId}
      AND restaurant_id = ${tenant.restaurantId}
      AND restaurant_key = ${tenant.restaurantKey}
    LIMIT 1
  `;
  const row = rows[0];

  if (!row) {
    return getDefaultRestaurantSettings();
  }

  return normalizeRestaurantSettings({
    ...(row.settings_json && typeof row.settings_json === "object" ? row.settings_json : {}),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : "",
    updatedByLogin: row.updated_by_login || "",
    updatedByDisplayName: row.updated_by_display_name || "",
  });
};

const readSettings = async (tenant) => {
  const storageMode = getStorageMode();

  if (storageMode === "neon") {
    return readSettingsFromNeon(tenant);
  }

  if (storageMode === "disabled") {
    return getDefaultRestaurantSettings();
  }

  const store = await readFileStore();

  if (tenant.isDefaultTenant) {
    return normalizeRestaurantSettings(store.settings);
  }

  return normalizeRestaurantSettings({
    ...(store.tenants?.[tenant.restaurantKey]?.settings || {}),
    tenantId: tenant.tenantId,
    restaurantId: tenant.restaurantId,
    restaurantKey: tenant.restaurantKey,
  });
};

const saveSettingsToFile = async (settings, actor = {}, tenant) => {
  const updatedAt = new Date().toISOString();
  const nextSettings = normalizeRestaurantSettings({
    ...settings,
    tenantId: tenant.tenantId,
    restaurantId: tenant.restaurantId,
    restaurantKey: tenant.restaurantKey,
    updatedAt,
    updatedByLogin: normalizeText(actor.login, 120).toLowerCase(),
    updatedByDisplayName: normalizeText(actor.displayName, 160),
  });
  const store = await readFileStore();

  if (tenant.isDefaultTenant) {
    await writeFileStore({
      ...store,
      version: LOCAL_STORE_VERSION,
      tenantId: tenant.tenantId,
      restaurantId: tenant.restaurantId,
      restaurantKey: tenant.restaurantKey,
      settings: nextSettings,
    });
  } else {
    await writeFileStore({
      ...store,
      version: LOCAL_STORE_VERSION,
      tenants: {
        ...(store.tenants || {}),
        [tenant.restaurantKey]: {
          ...(store.tenants?.[tenant.restaurantKey] || {}),
          tenantId: tenant.tenantId,
          restaurantId: tenant.restaurantId,
          restaurantKey: tenant.restaurantKey,
          settings: nextSettings,
        },
      },
    });
  }

  return {
    storageMode: "file",
    settings: nextSettings,
  };
};

const saveSettingsToNeon = async (settings, actor = {}, tenant) => {
  await ensureRestaurantSettingsSchema();
  const sql = getSql();
  const updatedAt = new Date().toISOString();
  const updatedByLogin = normalizeText(actor.login, 120).toLowerCase();
  const updatedByDisplayName = normalizeText(actor.displayName, 160);
  const nextSettings = normalizeRestaurantSettings({
    ...settings,
    tenantId: tenant.tenantId,
    restaurantId: tenant.restaurantId,
    restaurantKey: tenant.restaurantKey,
    updatedAt,
    updatedByLogin,
    updatedByDisplayName,
  });

  await sql`
    INSERT INTO restaurant_settings (
      tenant_id,
      restaurant_id,
      restaurant_key,
      settings_json,
      updated_at,
      updated_by_login,
      updated_by_display_name
    )
    VALUES (
      ${tenant.tenantId},
      ${tenant.restaurantId},
      ${tenant.restaurantKey},
      ${JSON.stringify(nextSettings)}::jsonb,
      ${updatedAt},
      ${updatedByLogin},
      ${updatedByDisplayName}
    )
    ON CONFLICT (tenant_id, restaurant_id, restaurant_key)
    DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      restaurant_id = EXCLUDED.restaurant_id,
      settings_json = EXCLUDED.settings_json,
      updated_at = EXCLUDED.updated_at,
      updated_by_login = EXCLUDED.updated_by_login,
      updated_by_display_name = EXCLUDED.updated_by_display_name
  `;

  return {
    storageMode: "neon",
    settings: nextSettings,
  };
};

const buildRestaurantSummary = (settings) => ({
  restaurantKey: settings.restaurantKey || RESTAURANT_KEY,
  restaurantName: settings.restaurantName,
  hasLogo: Boolean(settings.logoUrl),
  hasBanner: Boolean(settings.bannerUrl),
  whatsappConfigured: Boolean(settings.whatsapp),
  defaultDeliveryFee: settings.defaultDeliveryFee,
  maxDeliveryRadiusKm: settings.deliveryBase.maxDeliveryRadiusKm,
  fixedDeliveryFee: settings.deliveryBase.fixedDeliveryFee,
  pricePerKm: settings.deliveryBase.pricePerKm,
  minimumDeliveryOrder: settings.deliveryBase.minimumDeliveryOrder,
  pickupEnabled: settings.deliveryBase.pickupEnabled,
  deliveryEnabled: settings.deliveryBase.deliveryEnabled,
  hasDeliveryCoordinates:
    settings.deliveryBase.latitude !== null && settings.deliveryBase.longitude !== null,
  averagePreparationTimeMinutes: settings.averagePreparationTimeMinutes,
  businessHours: settings.businessHours,
  hasStructuredBusinessSchedule: settings.hasStructuredBusinessSchedule,
  acceptOrdersOutsideHours: settings.businessSchedule.acceptOrdersOutsideHours,
  peakPreparationExtraMinutes: settings.businessSchedule.peakPreparationExtraMinutes,
  specialDatesCount: Array.isArray(settings.businessSchedule.specialDates)
    ? settings.businessSchedule.specialDates.length
    : 0,
  siteLayout: settings.siteLayout,
  siteTheme: settings.siteTheme,
  showPlatformBranding: settings.platformFooter?.showPlatformBranding !== false,
  updatedAt: settings.updatedAt,
});

const getPublicSettings = (settings) => ({
  restaurantKey: settings.restaurantKey,
  restaurantName: settings.restaurantName,
  logoUrl: settings.logoUrl,
  bannerUrl: settings.bannerUrl,
  primaryColor: settings.primaryColor,
  secondaryColor: settings.secondaryColor,
  accentColor: settings.accentColor,
  gradientStart: settings.gradientStart,
  gradientEnd: settings.gradientEnd,
  useGradient: settings.useGradient,
  siteLayout: settings.siteLayout,
  siteTheme: settings.siteTheme,
  slogan: settings.slogan,
  description: settings.description,
  instagram: settings.instagram,
  facebook: settings.facebook,
  tiktok: settings.tiktok,
  site: settings.site,
  seoTitle: settings.seoTitle,
  seoDescription: settings.seoDescription,
  seoShareImage: settings.seoShareImage,
  seoKeywords: [...settings.seoKeywords],
  seoOpenGraph: { ...settings.seoOpenGraph },
  platformFooter: { ...settings.platformFooter },
  appearance: cloneJson(settings.appearance),
  whatsapp: settings.whatsapp,
  address: settings.address,
  addressFields: { ...settings.addressFields },
  deliveryBase: { ...settings.deliveryBase },
  businessHours: settings.businessHours,
  businessSchedule: cloneJson(settings.businessSchedule),
  hasStructuredBusinessSchedule: settings.hasStructuredBusinessSchedule,
  defaultDeliveryFee: settings.defaultDeliveryFee,
  averagePreparationTimeMinutes: settings.averagePreparationTimeMinutes,
  presentationText: settings.presentationText,
  updatedAt: settings.updatedAt,
});

const getAdminRestaurantSettings = async (options = {}) => {
  const tenant = getOperationalTenant(options, "restaurant-settings:admin:list");
  const settings = await readSettings(tenant);
  const storageMode = getStorageMode();

  return {
    storageMode,
    generatedAt: new Date().toISOString(),
    summary: buildRestaurantSummary(settings),
    settings,
  };
};

const getPublicRestaurantSettings = async (options = {}) => {
  const tenant = getOperationalTenant(options, "restaurant-settings:public:list");
  const settings = await readSettings(tenant);
  const storageMode = getStorageMode();

  return {
    storageMode,
    generatedAt: new Date().toISOString(),
    summary: buildRestaurantSummary(settings),
    settings: getPublicSettings(settings),
  };
};

const updateRestaurantSettings = async (payload = {}, actor = {}, options = {}) => {
  const tenant = getOperationalTenant(options, "restaurant-settings:admin:update");
  assertStorageIsAvailable();

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw buildHttpError(
      400,
      "Informe as configuracoes do restaurante.",
      "invalid_restaurant_settings"
    );
  }

  const settings = normalizeRestaurantSettings(payload.settings || payload);
  const storageMode = getStorageMode();
  const result =
    storageMode === "neon"
      ? await saveSettingsToNeon(settings, actor, tenant)
      : await saveSettingsToFile(settings, actor, tenant);

  return {
    storageMode: result.storageMode,
    generatedAt: new Date().toISOString(),
    summary: buildRestaurantSummary(result.settings),
    settings: result.settings,
    message: "Configuracoes do restaurante salvas com sucesso.",
  };
};

module.exports = {
  getAdminRestaurantSettings,
  getDefaultRestaurantSettings,
  getPublicRestaurantSettings,
  normalizeRestaurantSettings,
  updateRestaurantSettings,
};
