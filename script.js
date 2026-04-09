const WHATSAPP_NUMBER = "5516990507398";
const CART_STORAGE_KEY = "tokyo_sushi_delivery_cart";
const AUTH_PROFILE_KEY = "tokyo_sushi_profile";
const AUTH_ACCOUNTS_KEY = "tokyo_sushi_accounts";
const PHONE_VERIFICATION_CODE_LENGTH = 6;
const ORDER_HISTORY_STORAGE_KEY = "tokyo_sushi_order_history";
const CART_ADDONS_STORAGE_KEY = "tokyo_sushi_delivery_cart_addons";
const CART_CHECKOUT_STORAGE_KEY = "tokyo_sushi_cart_checkout";
const DELIVERY_HISTORY_STORAGE_KEY = "tokyo_sushi_delivery_quotes";
const REVIEW_STORAGE_KEY = "tokyo_sushi_site_reviews";
const CAREER_STORAGE_KEY = "tokyo_sushi_career_forms";
const CATALOG_COLLAPSED_SECTIONS_STORAGE_KEY = "tokyo_sushi_catalog_collapsed_sections";
const ORDER_HISTORY_WINDOW_DAYS = 30;
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
const DELIVERY_STORE_ADDRESS = "Rua General Osório, 2165, Franca - SP, 14400-520, Brasil";
const DELIVERY_STORE_LABEL = "R. General Osório, 2165 - CEP 14400-520";
const DELIVERY_STORE_COORDINATES = {
  lat: -20.536416983482,
  lng: -47.393922026918,
};
const DELIVERY_SERVICE_CITY_STATE = "Franca - SP";
const GOOGLE_MAPS_LANGUAGE = "pt-BR";
const GOOGLE_MAPS_REGION = "br";
const GOOGLE_MAPS_API_KEY_STORAGE_KEY = "tokyo_google_maps_api_key";
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
const DELIVERY_MANUAL_FALLBACK_FEE = DELIVERY_FEE_RULES[0]?.fee || 9;
const DELIVERY_MANUAL_ROUTE_BAND = "Taxa provisoria";
const DELIVERY_MANUAL_TIME_TEXT = "Confirmar no WhatsApp";
const siteHeader = document.querySelector(".site-header");
const catalogRoot = document.querySelector("[data-catalog-root]");
const authState = {
  view: "entry",
  socialProvider: null,
  socialStatus: "idle",
  socialTimer: 0,
  editing: false,
  error: "",
  message: "",
  draft: {},
  pendingHref: "",
  pendingIntent: "",
  phoneVerification: null,
};
const cartUiState = {
  checkoutExpanded: false,
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

const groupMediaControllers = new Map();
let collapsedCatalogSections = new Set();
let revealObserver;
const PLACEHOLDER_PRICE_LABEL = "R$: 00,00";
const EMPTY_GROUP_TOTAL_LABEL = "R$ 00,00";
const GROUP_MEDIA_CYCLE_MS = 2800;
const GROUP_MEDIA_FADE_MS = 620;
const SITE_PRIMARY_ORIGIN = "https://tokyosushidelivery.com.br";
const SITE_ALTERNATE_HOSTNAMES = Object.freeze(["www.tokyosushidelivery.com.br"]);
const GOOGLE_MAPS_ALLOWED_REFERRERS = Object.freeze([
  `${SITE_PRIMARY_ORIGIN}/*`,
  ...SITE_ALTERNATE_HOSTNAMES.map((hostname) => `https://${hostname}/*`),
]);
let googleMapsLoaderPromise;
let deliveryCepLookupToken = 0;
let lastGoogleMapsApiErrorMessage = "";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatGroupTitle = (value) => value.replace(/^Categoria\s+/i, "").trim();

const formatPrice = (value) => `R$ ${value.toFixed(2).replace(".", ",")}`;

const getCurrentPageOrigin = () => {
  const origin = String(window.location?.origin || "").trim();
  return !origin || origin === "null" ? SITE_PRIMARY_ORIGIN : origin;
};

const getGoogleMapsAllowedReferrersLabel = () => GOOGLE_MAPS_ALLOWED_REFERRERS.join(" e ");

const logDeliveryDebug = (stage, payload) => {
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
  const runtimeKey = String(window.TOKYO_GOOGLE_MAPS_API_KEY || "").trim();

  if (runtimeKey) {
    return runtimeKey;
  }

  try {
    return String(localStorage.getItem(GOOGLE_MAPS_API_KEY_STORAGE_KEY) || "").trim();
  } catch (error) {
    return "";
  }
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

const createDeliveryEstimateError = (message, mapsUrl = "") => {
  const error = new Error(message);
  error.userMessage = message;
  error.mapsUrl = mapsUrl;
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
      "Configure uma chave do Google Maps em maps-config.js ou defina window.TOKYO_GOOGLE_MAPS_API_KEY antes de calcular a distancia.",
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

  if (!menuItem) {
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
          <p class="catalog-combinados-spotlight-price">${getCombinadoPriceLabel(selectedCombo)}</p>
        </div>
        ${contentsMarkup ? `<div class="catalog-combinados-spotlight-contents">${contentsMarkup}</div>` : ""}
        <div class="catalog-card-actions catalog-combinados-spotlight-actions">
          <div
            class="catalog-option catalog-option-preview"
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
              aria-label="Adicionar ${escapeHtml(selectedCombo.name)} a sacola"
            >
              <span class="catalog-option-copy">
                <span class="catalog-option-label">Adicionar a Sacola</span>
                <span class="catalog-option-price">${getCombinadoPriceLabel(selectedCombo)}</span>
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
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  `;

  const isComboSelected = Boolean(selectedCombo);
  const previewImage = selectedCombo?.image || category.image;
  const previewAlt = selectedCombo ? selectedCombo.name : category.alt;
  const previewTitle = isComboSelected ? selectedCombo.name : category.title;
  const previewDetail = isComboSelected ? selectedCombo.detail : category.detail;
  const previewHint = isComboSelected
    ? `Unidades: ${selectedCombo.detail}`
    : `Selecione um combinado da categoria ${category.title} para ver a imagem e unidades`;
  const previewDetails = isComboSelected ? getComboContentsMarkup(section, selectedCombo) : "";

  return `
    <article class="catalog-card catalog-card-combinados-preview reveal${isComboSelected ? " catalog-card-combinados-preview-selected" : ""}" data-combinados-preview>
      <figure class="catalog-combined-preview-media">
        <img
          src="${previewImage}"
          alt="${previewAlt}"
          loading="lazy"
          decoding="async"
        />
      </figure>
      <div class="catalog-combined-preview-units-row${isComboSelected ? "" : " is-placeholder"}">
        <span class="catalog-pill">${previewHint}</span>
      </div>
      <div class="catalog-card-top catalog-combined-preview-top${isComboSelected ? " catalog-combined-preview-top-selected" : ""}">
        <div>
          <p class="catalog-kicker">${section.kicker}</p>
          ${isComboSelected ? `<h2>${previewTitle}</h2>` : `<h4>${previewTitle}</h4>`}
        </div>
        ${isComboSelected ? `<span class="catalog-badge">${selectedCombo.badge || "Consulte"}</span>` : ""}
      </div>
      ${isComboSelected ? `
        <div class="catalog-combo-hero-copy">
          <p class="catalog-kicker catalog-kicker-small">Categoria ${category.title}</p>
          <div class="catalog-combo-contents combo-contents-hero">
            ${previewDetails}
          </div>
        </div>
      ` : previewDetails}
      ${isComboSelected
        ? `
      <div class="catalog-card-actions">
        <div class="catalog-option catalog-option-preview" data-item-chip data-item-id="${selectedCombo.id}" data-item-name="${escapeHtml(selectedCombo.name)}" data-item-category="${escapeHtml(category.title)}">
          <button class="catalog-option-main catalog-combinados-cta" type="button" data-item-button data-add-to-cart aria-pressed="false" aria-label="Adicionar ${escapeHtml(selectedCombo.name)} a sacola">
            <span class="catalog-option-copy">
              <span class="catalog-option-label">Adicionar a Sacola</span>
              <span class="catalog-option-price">${getPriceLabel(selectedCombo.price)}</span>
            </span>
          </button>
          <div class="catalog-option-controls" aria-label="Controle de quantidade">
            <button class="catalog-stepper" type="button" data-item-decrease aria-label="Diminuir ${escapeHtml(selectedCombo.name)}">-</button>
            <span class="catalog-option-qty" data-item-qty></span>
            <button class="catalog-stepper" type="button" data-item-increase aria-label="Aumentar ${escapeHtml(selectedCombo.name)}">+</button>
          </div>
        </div>
      </div>
      `
        : ""}
      <div class="catalog-footer catalog-footer-group">
        <span class="catalog-pill catalog-combined-preview-units-label">${previewDetail}</span>
        <span class="catalog-selection-hint">${isComboSelected ? "Adicione este combinado à sacola para incluir no pedido." : "Selecione um combinado para ver a imagem temática da categoria."}</span>
      </div>
    </article>
  `;
};

const getCombinadosSidebarInfoMarkup = (selectedCombo, selectedCategory, section) => {
  if (!selectedCombo) {
    return "";
  }

  const contentsMarkup = getComboContentsMarkup(section, selectedCombo);

  return `
    <div class="catalog-combinados-sidebar-info-card">
      <figure class="catalog-combinados-sidebar-image">
        <img
          src="${selectedCombo.image}"
          alt="${selectedCombo.name}"
          loading="lazy"
          decoding="async"
        />
      </figure>
      <div class="catalog-combinados-sidebar-content">
        <p class="catalog-combinados-sidebar-category">${section.kicker}</p>
        <h3 class="catalog-combinados-sidebar-title">${selectedCombo.name}</h3>
        <p class="catalog-combinados-sidebar-units">${selectedCombo.detail}</p>
        <p class="catalog-combinados-sidebar-price">${getPriceLabel(selectedCombo.price)}</p>
        ${contentsMarkup ? `<div class="catalog-combinados-sidebar-contents">${contentsMarkup}</div>` : ""}
      </div>
    </div>
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

const getCombinadosItemsMarkup = (category, selectedComboId) =>
  `
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
                </div>
                <span class="catalog-combinados-combo-price">${getCombinadoPriceLabel(item)}</span>
              </button>
            `;
          })
          .join("")}
      </div>
    </div>
  `;

const isCatalogSectionCollapsed = (sectionId) => collapsedCatalogSections.has(sectionId);

const getCatalogSectionToggleLabel = (sectionId) =>
  isCatalogSectionCollapsed(sectionId) ? "Mostrar categoria" : "Ocultar categoria";

const getCatalogSectionHeadMarkup = (section) => `
  <div class="catalog-block-head reveal">
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

  const selectedCategory = categories[0];
  selectedCombinadosCategoryId = selectedCategory.id;
  selectedCombinadosComboId = null;

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
            <div class="catalog-combinados-main-panel" data-combinados-main-panel>
              <div class="catalog-combinados-items" data-combinados-items>
                ${getCombinadosItemsMarkup(selectedCategory, selectedCombinadosComboId)}
              </div>
              <div class="catalog-combinados-preview-shell" data-combinados-preview-shell aria-live="polite">
                ${getCombinadosPreviewMarkup(selectedCategory, null, section)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
};

const updateCombinadosPreview = (groupId) => {
  updateCombinadosComboSelection(groupId);
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
};

const updateCombinadosPreviewShell = () => {
  const section = MENU_SECTIONS.find((section) => section.id === "combinados");
  const selectedCategory = getSelectedCombinadosCategory();
  if (!section || !selectedCategory) {
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

const updateCombinadosSidebarInfo = () => {};

const updateCombinadosItemsList = () => {
  const selectedCategory = getSelectedCombinadosCategory();
  if (!selectedCategory) {
    return;
  }

  const itemsContainer = document.querySelector("[data-combinados-items]");
  if (!itemsContainer) {
    return;
  }

  itemsContainer.innerHTML = getCombinadosItemsMarkup(selectedCategory, selectedCombinadosComboId);
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

  updateCombinadosPreviewShell();
  updateCombinadosSidebarInfo();
  updateCombinadosItemsList();
};

const updateCombinadosComboSelection = (comboId) => {
  selectedCombinadosComboId = comboId;

  document.querySelectorAll("[data-combinado-item-id]").forEach((button) => {
    const isActive = button.dataset.combinadoItemId === comboId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  updateCombinadosPreviewShell();
  updateCombinadosSidebarInfo();
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
      nextImage.removeAttribute("src");
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

const updateHeaderState = () => {
  if (!siteHeader) {
    return;
  }

  siteHeader.classList.toggle("is-scrolled", window.scrollY > 18);
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
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const saveStoredCollection = (storageKey, items) => {
  localStorage.setItem(storageKey, JSON.stringify(items));
};

collapsedCatalogSections = new Set(
  loadStoredCollection(CATALOG_COLLAPSED_SECTIONS_STORAGE_KEY).filter(
    (sectionId) => typeof sectionId === "string" && sectionId.trim()
  )
);

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

  return {
    paymentMethod,
    fulfillmentMode,
    deliveryAddress,
    cashChangeRequired,
    cashAmountProvided,
  };
};

const loadCartCheckout = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_CHECKOUT_STORAGE_KEY) || "{}");
    return normalizeCartCheckout(parsed && typeof parsed === "object" ? parsed : {});
  } catch (error) {
    return normalizeCartCheckout();
  }
};

const saveCartCheckout = (checkout) => {
  localStorage.setItem(CART_CHECKOUT_STORAGE_KEY, JSON.stringify(normalizeCartCheckout(checkout)));
};

const getCartPaymentMethodLabel = (id) =>
  CART_PAYMENT_METHODS.find((method) => method.id === id)?.label || "";

const getCartFulfillmentLabel = (id) =>
  CART_FULFILLMENT_OPTIONS.find((option) => option.id === id)?.label || "";

const getPickupEstimateText = () =>
  `Retirada prevista em ate ${PICKUP_ESTIMATE_MINUTES} minutos, conforme o prazo mostrado no site.`;

const isManualDeliveryQuote = (quote) => Boolean(quote?.isManualEstimate);

const getDeliveryQuoteFeeText = (quote) => {
  if (!quote) {
    return "";
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

const getCartCheckoutValidation = (
  cart,
  addons = loadCartAddons(),
  checkout,
  profile = loadAuthProfile(),
  deliveryQuote = getLatestSavedDeliveryQuote(profile)
) => {
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
    if (!deliveryQuote) {
      return {
        isValid: false,
        tone: "warning",
        message: profile
          ? "Calcule a entrega na aba Entrega para salvar os dados nesta conta antes de finalizar."
          : "Abra a aba Entrega para calcular a taxa e salvar os dados da entrega antes de finalizar.",
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
        message: `Entrega salva em modo provisorio: ${getDeliveryQuoteSummaryText(
          deliveryQuote
        )}. A taxa final sera confirmada no atendimento.`,
      };
    }

    return {
      isValid: true,
      tone: "success",
      message: `Entrega pronta: ${getDeliveryQuoteSummaryText(deliveryQuote)}.`,
    };
  }

  return {
    isValid: true,
    tone: "success",
    message: getPickupEstimateText(),
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
    ].filter(Boolean);

    return selectedParts.length ? selectedParts.join(" | ") : "Pronto para finalizar";
  }

  if (!checkout.paymentMethod && !checkout.fulfillmentMode) {
    return "Toque para preencher";
  }

  if (!checkout.paymentMethod || !checkout.fulfillmentMode) {
    return "Faltam escolhas";
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

const initComboHeroImages = () => {
  const currentPage = document.body.dataset.page || "";
  if (currentPage !== "index" && currentPage !== "inicio") {
    return;
  }

  const comboSection = MENU_SECTIONS.find((section) => section.id === "combinados");
  if (!comboSection) {
    return;
  }

  const featuredCombo =
    comboSection.items.find((item) => item.id === "sakura-20") ||
    comboSection.items.find((item) => item.image);
  if (!featuredCombo) {
    return;
  }

  const heroImage = document.querySelector(".hero-image img");
  const heroCategory = document.querySelector(".hero-order-card .section-tag");
  const heroTitle = document.querySelector(".hero-order-card h2");
  const heroPrice = document.querySelector(".hero-order-card strong");

  if (!heroImage || !heroCategory || !heroTitle || !heroPrice) {
    return;
  }

  heroImage.src = featuredCombo.image;
  heroImage.alt = `${featuredCombo.name} do Tokyo Sushi Delivery`;
  heroCategory.textContent = featuredCombo.category;
  heroTitle.innerHTML = `${featuredCombo.name} <span class="portion-label">(${featuredCombo.detail})</span>`;
  heroPrice.textContent = featuredCombo.badge || "Consulte";
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

  return "Acesso Tokyo";
};

const getDisplayEmail = (profile) => {
  const email = normalizeEmail(profile?.email);

  if (!email || email.endsWith("@social.tokyo")) {
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

const buildPhoneVerificationWhatsappHref = (name, phone, code) => {
  const whatsappPhone = normalizeWhatsappPhone(phone);

  if (!whatsappPhone) {
    return "";
  }

  const message = normalizePortugueseText([
    "Tokyo Sushi Delivery Premium",
    `Ola, ${getFirstName(name)}!`,
    `Seu codigo de verificacao e: ${code}`,
    `Digite os ${PHONE_VERIFICATION_CODE_LENGTH} digitos no login para concluir o acesso.`,
  ].join("\n"));

  return `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
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
    const parsed = JSON.parse(localStorage.getItem(AUTH_ACCOUNTS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const saveAuthAccounts = (accounts) => {
  localStorage.setItem(AUTH_ACCOUNTS_KEY, JSON.stringify(accounts));
};

const loadAuthProfile = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(AUTH_PROFILE_KEY) || "null");

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
  localStorage.setItem(
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
    email: `${provider}.${timestamp}@social.tokyo`,
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
  localStorage.removeItem(AUTH_PROFILE_KEY);
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
              src="./site-images/login-cover-floating.png"
              alt="Arte de login Tokyo Sushi com cerejeiras, logo e combinado de sushi"
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

    panel.innerHTML = `
      <div class="auth-panel-head">
        <p class="section-tag">Verificacao de telefone</p>
        <h2 id="auth-title">Confirme o codigo enviado</h2>
        <p>Digite o codigo de ${PHONE_VERIFICATION_CODE_LENGTH} digitos enviado pelo WhatsApp para ${escapeHtml(maskPhoneDisplay(verification.phone))}.</p>
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
            <p>Enviamos o codigo pelo WhatsApp para o numero informado.</p>
          </div>
          <div>
            <span>2</span>
            <p>Digite os ${PHONE_VERIFICATION_CODE_LENGTH} digitos para liberar seu acesso rapidamente.</p>
          </div>
        </div>

        <form class="auth-form" data-auth-form data-auth-phone-verify-form>
          <label class="auth-field">
            <span>Codigo de verificacao</span>
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

          <button class="button button-primary full-width auth-submit" type="submit">
            Verificar e entrar
          </button>
        </form>

        <div class="auth-social-actions">
          <button class="button button-primary" type="button" data-auth-phone-open-whatsapp>
            Abrir WhatsApp
          </button>
          <button class="button button-outline" type="button" data-auth-phone-resend>
            Reenviar codigo
          </button>
          <button class="button button-outline" type="button" data-auth-entry>
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
      <p class="section-tag">${authState.editing ? "Editar dados" : "Acesso Tokyo"}</p>
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

  const isCartWhatsappIntent = authState.pendingIntent === "cart-whatsapp";

  if (authState.pendingIntent === "cart-whatsapp") {
    maybeRecordOrderFromCart();
  }

  const pendingHref = appendProfileToWhatsappHref(authState.pendingHref);

  if (isCartWhatsappIntent) {
    resetCartAfterCheckout();
  }

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
  authState.error = "";
  authState.message = message;
  authState.editing = false;
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
  renderReviewPage();
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

const openPhoneVerificationWhatsapp = (verification, options = {}) => {
  if (!verification?.whatsappHref) {
    authState.error = "Nao consegui preparar o envio do codigo pelo WhatsApp.";
    authState.message = "";
    renderAuthPanel();
    return false;
  }

  const popup = window.open(verification.whatsappHref, "_blank", "noopener");

  authState.error = "";
  authState.message = popup
    ? `${options.resent ? "WhatsApp reaberto com um novo codigo de 6 digitos" : "WhatsApp aberto com o codigo de 6 digitos"} para ${maskPhoneDisplay(
        verification.phone
      )}.`
    : `Nao consegui abrir o WhatsApp automaticamente. Toque em "Abrir WhatsApp" para enviar o codigo para ${maskPhoneDisplay(
        verification.phone
      )}.`;
  renderAuthPanel();

  return Boolean(popup);
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

const startPhoneVerification = (name, phone, options = {}) => {
  authState.phoneVerification = {
    name,
    phone,
    code: generateNumericCode(PHONE_VERIFICATION_CODE_LENGTH),
  };
  authState.phoneVerification.whatsappHref = buildPhoneVerificationWhatsappHref(
    authState.phoneVerification.name,
    authState.phoneVerification.phone,
    authState.phoneVerification.code
  );
  authState.view = "phone-verify";
  authState.error = "";
  authState.message = "Preparando envio do codigo pelo WhatsApp...";
  authState.draft = {
    ...authState.draft,
    entry_name: name,
    entry_phone: formatPhoneDisplay(phone),
    phone_code: "",
  };
  renderAuthPanel();
  openPhoneVerificationWhatsapp(authState.phoneVerification, options);
};

const confirmPhoneVerification = (code) => {
  const verification = authState.phoneVerification;

  if (!verification) {
    authState.error = "Nao encontrei uma verificacao de telefone em andamento.";
    authState.message = "";
    authState.view = "entry";
    renderAuthPanel();
    return;
  }

  const sanitizedCode = String(code || "").replace(/\D/g, "").slice(0, PHONE_VERIFICATION_CODE_LENGTH);

  if (sanitizedCode.length !== PHONE_VERIFICATION_CODE_LENGTH) {
    authState.error = `Digite os ${PHONE_VERIFICATION_CODE_LENGTH} digitos recebidos no WhatsApp.`;
    authState.message = "";
    renderAuthPanel();
    return;
  }

  if (sanitizedCode !== verification.code) {
    authState.error = `Codigo invalido. Confira os ${PHONE_VERIFICATION_CODE_LENGTH} digitos recebidos e tente novamente.`;
    authState.message = "";
    renderAuthPanel();
    return;
  }

  const profile = upsertPhoneAccountProfile(verification.name, verification.phone);
  authState.phoneVerification = null;

  finalizeAuth(profile, `Telefone verificado com sucesso para ${getFirstName(profile.name)}.`);
};

const loadCart = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeCartItem).filter(Boolean) : [];
  } catch (error) {
    return [];
  }
};

const saveCart = (cart) => {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
};

const getCartItemCount = (cart) =>
  cart.reduce((total, item) => total + item.quantity, 0);

const createSiteFooter = () => {
  if (document.querySelector("[data-site-footer]")) {
    return;
  }

  const currentPage = document.body.dataset.page || "inicio";
  const footerNavLinks = [
    { href: "./index.html", label: "Inicio", page: "inicio" },
    { href: "./cardapio.html", label: "Cardapio", page: "cardapio" },
    { href: "./entrega.html", label: "Entrega", page: "entrega" },
    { href: "./historico.html", label: "Historico", page: "historico" },
    { href: "./avaliar.html", label: "Avaliar", page: "avaliar" },
    { href: "./trabalhe-conosco.html", label: "Trabalhe Conosco", page: "trabalhe" },
  ];
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    normalizePortugueseText("Ola, quero falar com a equipe do Tokyo Sushi Delivery.")
  )}`;
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    DELIVERY_STORE_ADDRESS
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
    <footer class="site-footer reveal" data-site-footer>
      <div class="container">
        <div class="site-footer-shell">
          <div class="site-footer-top">
            <div class="site-footer-branding">
              <a class="footer-brand" href="./index.html" aria-label="Voltar para a pagina inicial">
                <span class="brand-mark">
                  <img
                    src="./site-images/tokyo-logo-premium-transparent.png"
                    alt="Logo Tokyo Sushi Delivery Premium"
                  />
                </span>
                <span class="brand-meta">
                  <strong>Tokyo Sushi</strong>
                  <small>Delivery Premium</small>
                </span>
              </a>
              <p class="site-footer-copy">
                Delivery premium de culinaria japonesa em Franca, com cardapio digital,
                calculo de entrega e pedido rapido pelo WhatsApp.
              </p>
              <div class="site-footer-badges" aria-label="Destaques do atendimento">
                <span>Cardapio digital</span>
                <span>Entrega por distancia</span>
                <span>Atendimento via WhatsApp</span>
              </div>
            </div>

            <div class="site-footer-actions">
              <a class="button button-primary" href="${whatsappHref}" target="_blank" rel="noreferrer">
                Pedir pelo WhatsApp
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
                <a class="site-footer-link" href="${whatsappHref}" target="_blank" rel="noreferrer">
                  Pedidos e suporte pelo WhatsApp
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
                <p class="site-footer-info">Rua General Osório, 2165</p>
                <p class="site-footer-info">Franca - SP, CEP 14400-520</p>
                <p class="site-footer-info">Origem fixa usada no calculo da entrega.</p>
                <a class="site-footer-link" href="${mapsHref}" target="_blank" rel="noreferrer">
                  Abrir localizacao no Google Maps
                </a>
              </div>
            </section>

            <section class="site-footer-column" aria-labelledby="footer-site-title">
              <p class="site-footer-title" id="footer-site-title">Experiencia do site</p>
              <div class="site-footer-info-list">
                <p class="site-footer-info">Login local para agilizar pedidos e historico.</p>
                <p class="site-footer-info">Complementos, sacola e envio direto pelo WhatsApp.</p>
                <p class="site-footer-info">Informacoes sujeitas a confirmacao final no atendimento.</p>
              </div>
            </section>
          </div>

          <div class="site-footer-bottom">
            <span>&copy; ${new Date().getFullYear()} Tokyo Sushi Delivery Premium.</span>
            <span>Rua General Osório, 2165 - Franca - SP.</span>
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
          <a class="button button-primary full-width cart-whatsapp" data-cart-whatsapp href="#">
            Finalizar pedido
          </a>
          <div class="cart-summary">
            <strong data-cart-summary>0 itens do cardapio</strong>
            <button class="cart-clear" type="button" data-cart-clear>Limpar</button>
          </div>
          <p class="cart-note" data-cart-note>
            Os valores finais e a disponibilidade podem ser confirmados no atendimento.
          </p>
        </div>
      </aside>
    `
  );

  schedulePortugueseUiRefresh();
};

const getCartCheckoutWhatsappLines = (
  checkout,
  cart = loadCart(),
  addons = loadCartAddons(),
  profile = loadAuthProfile(),
  deliveryQuote = getLatestSavedDeliveryQuote(profile)
) => {
  const lines = [];
  const cashDetails = getCartCashChangeDetails({
    cart,
    addons,
    checkout,
    profile,
    deliveryQuote,
  });

  if (checkout.paymentMethod) {
    lines.push(`Forma de pagamento: ${getCartPaymentMethodLabel(checkout.paymentMethod)}`);

    if (checkout.paymentMethod === "dinheiro") {
      if (typeof cashDetails.totalAmount === "number") {
        lines.push(`Total considerado para troco: ${formatPrice(cashDetails.totalAmount)}`);
      }

      if (checkout.cashChangeRequired === "yes") {
        lines.push("Precisa de troco: Sim");

        if (typeof cashDetails.amountProvided === "number") {
          lines.push(`Valor em dinheiro: ${formatPrice(cashDetails.amountProvided)}`);
        }

        if (typeof cashDetails.changeAmount === "number") {
          lines.push(`Troco calculado: ${formatPrice(cashDetails.changeAmount)}`);
        }
      } else if (checkout.cashChangeRequired === "no") {
        lines.push("Precisa de troco: Nao");
      }
    }
  }

  if (checkout.fulfillmentMode === "delivery") {
    lines.push("Recebimento: Entrega");

    if (deliveryQuote) {
      lines.push(
        `${isManualDeliveryQuote(deliveryQuote) ? "Endereco informado" : "Endereco confirmado"}: ${
          deliveryQuote.geocodedAddress || deliveryQuote.destinationLabel
        }`
      );
      lines.push(
        `${isManualDeliveryQuote(deliveryQuote) ? "Taxa provisoria no site" : "Taxa de entrega"}: ${getDeliveryQuoteFeeText(
          deliveryQuote
        )}`
      );
      lines.push(
        `${isManualDeliveryQuote(deliveryQuote) ? "Status da distancia" : "Distancia calculada"}: ${
          deliveryQuote.distanceText || "-"
        }`
      );
      lines.push(`Faixa aplicada: ${deliveryQuote.routeBand || "-"}`);
      lines.push(`Preparo estimado: ${deliveryQuote.preparationTimeText || "-"}`);
      lines.push(`Deslocamento estimado: ${deliveryQuote.travelTimeText || "-"}`);
      lines.push(`Prazo total aproximado: ${deliveryQuote.totalEstimateText || "-"}`);

      if (isManualDeliveryQuote(deliveryQuote)) {
        lines.push("Observacao: taxa final e prazo exato serao confirmados no atendimento.");
      }
    }
  } else if (checkout.fulfillmentMode === "pickup") {
    lines.push("Recebimento: Retirada no local");
    lines.push(`Tempo previsto no site: ate ${PICKUP_ESTIMATE_MINUTES} minutos.`);
  }

  return lines;
};

const formatWhatsappMessage = (
  cart,
  addons = loadCartAddons(),
  checkout = loadCartCheckout()
) => {
  const profile = loadAuthProfile();
  const deliveryQuote = getLatestSavedDeliveryQuote(profile);
  const lines = [
    "Ola, quero fazer um pedido no Tokyo Sushi Delivery:",
    "",
  ];

  if (profile) {
    lines.push(...formatProfileLines(profile));
    lines.push("");
  }

  const checkoutLines = getCartCheckoutWhatsappLines(
    checkout,
    cart,
    addons,
    profile,
    deliveryQuote
  );

  if (checkoutLines.length) {
    lines.push("Dados para finalizar:");
    lines.push(...checkoutLines);
    lines.push("");
  }

  cart.forEach((item) => {
    const priceLabel = typeof item.price === "number" ? ` - ${formatPrice(item.price)}` : "";
    lines.push(`${item.quantity}x ${item.name} - ${item.category}${priceLabel}`);
  });

  const selectedAddons = getSelectedCartAddons(addons);

  if (selectedAddons.length) {
    lines.push("");
    lines.push("Complementos do pedido:");
    selectedAddons.forEach((addon) => {
      lines.push(formatCartAddonWhatsappLine(addon));
    });
  }

  const totalAmount = getCartTotalAmount(cart, addons);

  if (typeof totalAmount === "number") {
    lines.push("");
    lines.push(`Total atual da sacola: ${formatPrice(totalAmount)}`);
  }

  lines.push("");

  if (cart.some((item) => typeof item.price !== "number")) {
    lines.push("Pode me confirmar os valores finais e a disponibilidade?");
  } else {
    lines.push("Pode confirmar esses valores de referencia e a disponibilidade?");
  }

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
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

const renderCartCheckout = (node, checkout, cart, profile = loadAuthProfile()) => {
  if (!node) {
    return;
  }

  const addons = loadCartAddons();
  const deliveryQuote = getLatestSavedDeliveryQuote(profile);
  const validation = getCartCheckoutValidation(cart, addons, checkout, profile, deliveryQuote);
  const cashDetails = getCartCashChangeDetails({
    cart,
    addons,
    checkout,
    profile,
    deliveryQuote,
  });
  const feedbackClass =
    validation.tone === "success"
      ? " is-success"
      : validation.tone === "warning"
        ? " is-warning"
        : "";
  const shouldShowCheckoutFeedback = !(
    validation.tone === "success" && checkout.fulfillmentMode === "pickup"
  );

  node.innerHTML = `
    <section class="cart-required-section">
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
          ${CART_FULFILLMENT_OPTIONS.map(
            (option) => `
              <label class="cart-choice-pill${checkout.fulfillmentMode === option.id ? " is-selected" : ""}">
                <input
                  class="cart-choice-input"
                  type="radio"
                  name="cart_fulfillment_mode"
                  value="${option.id}"
                  ${checkout.fulfillmentMode === option.id ? "checked" : ""}
                />
                <span>${option.label}</span>
              </label>
            `
          ).join("")}
        </div>
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
                <strong>Retirada no local</strong>
                <span>${getPickupEstimateText()}</span>
              </div>
            `
            : `
              <div class="cart-fulfillment-note">
                <span>Depois da escolha, a sacola mostra as instrucoes certas para entrega ou retirada.</span>
              </div>
            `
      }

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
  const whatsappLink = document.querySelector("[data-cart-whatsapp]");
  const cartNoteNode = document.querySelector("[data-cart-note]");
  const checkoutFeedbackNode = document.querySelector("[data-cart-checkout-feedback]");
  const deliveryQuote = getLatestSavedDeliveryQuote(profile);
  const validation = getCartCheckoutValidation(cart, addons, checkout, profile, deliveryQuote);

  syncCartCheckoutDock({ cart, addons, checkout, validation });

  if (checkoutFeedbackNode) {
    checkoutFeedbackNode.textContent = validation.message;
    checkoutFeedbackNode.classList.toggle("is-success", validation.tone === "success");
    checkoutFeedbackNode.classList.toggle("is-warning", validation.tone === "warning");
  }

  if (!whatsappLink) {
    return;
  }

  whatsappLink.removeAttribute("data-base-href");

  if (cart.length === 0) {
    whatsappLink.href = "#";
    whatsappLink.textContent = "Finalizar pedido";
    whatsappLink.classList.add("is-disabled");

    if (cartNoteNode) {
      cartNoteNode.textContent =
        "Os complementos sao ajustados no painel do cardapio. O pedido so libera envio quando houver itens na sacola.";
    }
    return;
  }

  if (!validation.isValid) {
    whatsappLink.href = "#";
    whatsappLink.textContent = "Finalizar pedido";
    whatsappLink.classList.add("is-disabled");

    if (cartNoteNode) {
      cartNoteNode.textContent =
        `${validation.message} Os complementos continuam no painel do cardapio.`;
    }
    return;
  }

  whatsappLink.href = formatWhatsappMessage(cart, addons, checkout);
  whatsappLink.textContent = profile ? "Finalizar pedido" : "Entrar para finalizar";
  whatsappLink.classList.remove("is-disabled");

  if (cartNoteNode) {
    cartNoteNode.textContent = profile
      ? checkout.fulfillmentMode === "delivery"
        ? deliveryQuote
          ? `${
              isManualDeliveryQuote(deliveryQuote)
                ? "Entrega salva em modo provisorio"
                : "Entrega vinculada"
            }: ${getDeliveryQuoteSummaryText(
              deliveryQuote
            )}. Os detalhes podem ser atualizados na aba Entrega.`
          : "Abra a aba Entrega para calcular e salvar os dados desta conta antes de finalizar."
        : getPickupEstimateText()
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
  renderCartCheckout(cartCheckoutNode, checkout, cart, profile);

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
  syncCartCheckoutDock({
    cart,
    addons,
    checkout,
    validation: getCartCheckoutValidation(cart, addons, checkout, profile),
  });
  schedulePortugueseUiRefresh();
};

const openCart = () => {
  document.body.classList.add("cart-open");
};

const closeCart = () => {
  document.body.classList.remove("cart-open");
};

const addItemToCart = (item) => {
  const cart = loadCart();
  const existingItem = cart.find((cartItem) => cartItem.id === item.id);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ ...item, quantity: 1 });
  }

  saveCart(cart);
  renderCart();
};

const changeCartQuantity = (id, delta) => {
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
  const addons = loadCartAddons().map((addon) =>
    addon.id === id
      ? { ...addon, quantity: Math.max(0, addon.quantity + delta) }
      : addon
  );

  saveCartAddons(addons);
  renderCart();
};

const clearCart = () => {
  saveCart([]);
  resetCartAddons();
  renderCart();
};

const resetCartAfterCheckout = () => {
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
  closeCart();
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

const loadOrderHistory = () => loadStoredCollection(ORDER_HISTORY_STORAGE_KEY);

const saveOrderHistory = (orders) => {
  saveStoredCollection(ORDER_HISTORY_STORAGE_KEY, orders.slice(0, 50));
};

const maybeRecordOrderFromCart = () => {
  const profile = loadAuthProfile();
  const cart = loadCart();
  const addons = loadCartAddons();
  const checkout = loadCartCheckout();
  const deliveryQuote = getLatestSavedDeliveryQuote(profile);
  const validation = getCartCheckoutValidation(cart, addons, checkout, profile, deliveryQuote);
  const cashDetails = getCartCashChangeDetails({
    cart,
    addons,
    checkout,
    profile,
    deliveryQuote,
  });

  if (!profile || cart.length === 0 || !validation.isValid) {
    return false;
  }

  const profileKey = getProfileStorageKey(profile);
  const now = new Date().toISOString();
  const compactItems = cart.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    price: typeof item.price === "number" ? item.price : null,
  }));
  const compactAddons = getCompactCartAddons(addons);
  const signature = JSON.stringify({
    items: compactItems.map((item) => [item.id, item.quantity, item.price ?? "consultar"]),
    addons: compactAddons.map((addon) => [addon.id, addon.quantity, addon.price]),
    paymentMethod: checkout.paymentMethod || "",
    fulfillmentMode: checkout.fulfillmentMode || "",
    deliveryAddress:
      checkout.fulfillmentMode === "delivery"
        ? normalizeCartDeliveryAddress(
            deliveryQuote?.geocodedAddress || deliveryQuote?.destinationLabel || ""
          )
        : "",
    deliveryFee: checkout.fulfillmentMode === "delivery" ? Number(deliveryQuote?.fee || 0) : 0,
    deliveryDistance:
      checkout.fulfillmentMode === "delivery" ? deliveryQuote?.distanceText || "" : "",
    cashChangeRequired: checkout.paymentMethod === "dinheiro" ? checkout.cashChangeRequired : "",
    cashAmountProvided:
      checkout.paymentMethod === "dinheiro" ? checkout.cashAmountProvided || "" : "",
    cashChangeAmount:
      checkout.paymentMethod === "dinheiro" && typeof cashDetails.changeAmount === "number"
        ? cashDetails.changeAmount
        : null,
  });
  const orders = loadOrderHistory();
  const duplicateOrder = orders.find((entry) => {
    if (entry.profileKey !== profileKey || entry.signature !== signature) {
      return false;
    }

    return Date.now() - new Date(entry.createdAt).getTime() < 120000;
  });

  if (duplicateOrder) {
    return false;
  }

  orders.unshift({
    id: `order_${Date.now()}`,
    profileKey,
    profileName: profile.name,
    itemCount: getCartItemCount(cart),
    totalAmount: getCartTotalAmount(cart, addons),
    createdAt: now,
    items: [...compactItems, ...compactAddons],
    paymentMethod: checkout.paymentMethod || "",
    fulfillmentMode: checkout.fulfillmentMode || "",
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
    cashChangeAmount:
      checkout.paymentMethod === "dinheiro" && typeof cashDetails.changeAmount === "number"
        ? cashDetails.changeAmount
        : null,
    signature,
  });

  saveOrderHistory(orders);
  renderOrderHistoryPage();
  return true;
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
        <span>Quando voce enviar a sacola pelo WhatsApp, o pedido ficara registrado aqui para consulta.</span>
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
                  order.paymentMethod
                    ? `<span>Pagamento: ${escapeHtml(getCartPaymentMethodLabel(order.paymentMethod))}</span>`
                    : ""
                }
                <span>Janela: 30 dias</span>
              </div>

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
  getDeliveryHistoryForProfile(profile)[0] || null;

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
  destinationLabel,
  geocodedAddress,
  distanceKmRaw,
  distanceText,
  partialMatch = false,
}) => {
  const distanceKm = Number(distanceKmRaw.toFixed(1));
  const pricingRule = getDeliveryFeeRule(distanceKmRaw);
  const preparationMinutes = DELIVERY_PREPARATION_TIME_MINUTES;
  const travelMinutes = calculateEstimatedDeliveryTravelMinutes(distanceKmRaw);
  const totalEstimateMinutes = preparationMinutes + travelMinutes;
  const preparationTimeText = formatDeliveryMinutesLabel(preparationMinutes);
  const travelTimeText = formatDeliveryMinutesLabel(travelMinutes);
  const totalEstimateText = `${formatDeliveryMinutesLabel(totalEstimateMinutes)} aprox.`;
  const routeSteps = [
    `Origem fixa do delivery: ${DELIVERY_STORE_LABEL}.`,
    `Destino informado: ${destinationLabel}.`,
    `Endereco confirmado pelo Google Maps: ${geocodedAddress}.`,
    `Distancia calculada entre a loja e o cliente: ${distanceText}.`,
    pricingRule.description,
    `Tempo estimado de preparo: ${preparationTimeText}.`,
    `Tempo estimado de deslocamento ate o cliente: ${travelTimeText}.`,
    `Prazo total aproximado considerando preparo + entrega: ${totalEstimateText}.`,
    "Em dias chuvosos, o prazo total pode aumentar por causa do deslocamento.",
  ];

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
    destinationLabel,
    routeBand: pricingRule.bandLabel,
    distanceKm,
    distanceText,
    fee: pricingRule.fee,
    pricingRuleLabel: pricingRule.description,
    preparationMinutes,
    preparationTimeText,
    travelMinutes,
    travelTimeText,
    totalEstimateMinutes,
    totalEstimateText,
    geocodedAddress,
    routeSteps,
  };
};

const buildManualDeliveryEstimateResult = ({
  cepDigits,
  streetLabel,
  numericHouseNumber,
  complementLabel,
  destinationLabel,
  destinationAddress,
}) => ({
  cep: formatCepDisplay(cepDigits),
  street: streetLabel,
  houseNumber: numericHouseNumber,
  complement: complementLabel,
  destinationLabel,
  routeBand: DELIVERY_MANUAL_ROUTE_BAND,
  distanceKm: 0,
  distanceText: "Distancia em confirmacao",
  fee: DELIVERY_MANUAL_FALLBACK_FEE,
  pricingRuleLabel: `Taxa minima provisoria de ${formatPrice(
    DELIVERY_MANUAL_FALLBACK_FEE
  )} enquanto o Google Maps estiver indisponivel.`,
  preparationMinutes: DELIVERY_PREPARATION_TIME_MINUTES,
  preparationTimeText: DELIVERY_MANUAL_TIME_TEXT,
  travelMinutes: 0,
  travelTimeText: DELIVERY_MANUAL_TIME_TEXT,
  totalEstimateMinutes: DELIVERY_PREPARATION_TIME_MINUTES,
  totalEstimateText: DELIVERY_MANUAL_TIME_TEXT,
  geocodedAddress: destinationAddress,
  routeSteps: [
    `Origem fixa do delivery: ${DELIVERY_STORE_LABEL}.`,
    `Destino informado: ${destinationLabel}.`,
    `Endereco salvo para atendimento: ${destinationAddress}.`,
    `Taxa minima provisoria mostrada no site: ${formatPrice(DELIVERY_MANUAL_FALLBACK_FEE)}.`,
    "A taxa final e o prazo exato serao confirmados pelo atendimento no WhatsApp antes do envio.",
  ],
  isManualEstimate: true,
});

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
        `Taxa minima: ${feeLabel}`,
        `Prazo: ${estimate.totalEstimateText || DELIVERY_MANUAL_TIME_TEXT}`,
      ]
    : [
        "Distancia calculada",
        estimate.distanceText,
        estimate.routeBand,
        `Preparo: ${estimate.preparationTimeText}`,
        `Deslocamento: ${estimate.travelTimeText}`,
        `Prazo total: ${estimate.totalEstimateText}`,
      ];

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
        ${metaLines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
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
  neighborhood = "",
  city = "",
  state = "",
}) => {
  const cepDigits = normalizeCep(cep);
  const streetLabel = String(street || "").trim();
  const numericHouseNumber = String(houseNumber || "").replace(/\D/g, "");
  const complementLabel = String(complement || "").trim();
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
    const distanceKmRaw = calculateGeodesicDistanceKm(
      DELIVERY_STORE_COORDINATES,
      customerGeocode.location
    );
    const distanceText = `${String(Number(distanceKmRaw.toFixed(1))).replace(".", ",")} km`;
    logDeliveryDebug("delivery-calc-success", {
      origin: getCurrentPageOrigin(),
      destinationAddress,
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
    const estimate = buildManualDeliveryEstimateResult({
      cepDigits: cep,
      streetLabel: street,
      numericHouseNumber: houseNumber,
      complementLabel: complement,
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

const loadReviews = () => loadStoredCollection(REVIEW_STORAGE_KEY);

const saveReviews = (reviews) => {
  saveStoredCollection(REVIEW_STORAGE_KEY, reviews.slice(0, 12));
};

const renderReviewPage = () => {
  const averageNode = document.querySelector("[data-review-average]");
  const countNode = document.querySelector("[data-review-count]");
  const listRoot = document.querySelector("[data-review-list]");
  const reviews = loadReviews();
  const average = reviews.length
    ? (
        reviews.reduce((sum, entry) => sum + Number(entry.rating || 0), 0) / reviews.length
      ).toFixed(1)
    : "0.0";

  if (averageNode) {
    averageNode.textContent = average;
  }

  if (countNode) {
    countNode.textContent = String(reviews.length);
  }

  if (!listRoot) {
    return;
  }

  if (reviews.length === 0) {
    listRoot.innerHTML = `
      <div class="empty-panel">
        <strong>Nenhuma avaliacao enviada ainda.</strong>
        <span>Quando o primeiro formulario for preenchido, ele aparecera aqui.</span>
      </div>
    `;
    schedulePortugueseUiRefresh();
    return;
  }

  listRoot.innerHTML = reviews
    .map(
      (entry) => `
        <article class="review-card">
          <div class="review-card-top">
            <div>
              <strong>${escapeHtml(entry.name)}</strong>
              <p>${escapeHtml(formatDateTime(entry.createdAt))}</p>
            </div>
            <span class="review-stars">${buildRatingStars(entry.rating)}</span>
          </div>
          <p>${escapeHtml(entry.message)}</p>
        </article>
      `
    )
    .join("");

  schedulePortugueseUiRefresh();
};

const submitReviewForm = (form) => {
  const feedbackNode = document.querySelector("[data-review-feedback]");
  const formData = new FormData(form);
  const profile = loadAuthProfile();
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

  const reviews = loadReviews();
  reviews.unshift({
    id: `review_${Date.now()}`,
    name,
    contact,
    rating,
    message,
    createdAt: new Date().toISOString(),
  });
  saveReviews(reviews);
  setResultCardState(feedbackNode, "success");

  if (feedbackNode) {
    feedbackNode.innerHTML = `
      <p>
        Avaliacao enviada com sucesso. Obrigado por dar ${rating} estrela${rating === 1 ? "" : "s"} para o site.
      </p>
    `;
  }

  form.reset();
  renderReviewPage();
  prefillProfileForms();
  schedulePortugueseUiRefresh();
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

  const sectionOrder = new Map(
    MENU_SECTION_DISPLAY_ORDER.map((sectionId, index) => [sectionId, index])
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
                    <img class="catalog-media-image" data-group-media-next data-media-src="" alt="" />
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
                      .map(
                        (item) => `
                          <div
                            class="catalog-option${isTemakiPremiumOption(item) ? " catalog-option-premium" : ""}"
                            data-item-chip
                            data-item-id="${item.id}"
                            data-item-name="${item.name}"
                            data-item-category="${group.title}"
                          >
                            <button
                              class="catalog-option-main"
                              type="button"
                              data-item-button
                              data-add-to-cart
                              aria-pressed="false"
                              aria-label="Adicionar ${item.name} a sacola"
                            >
                              <span class="catalog-option-copy">
                                <span class="catalog-option-label">${getCatalogOptionLabel(
                                  item,
                                  group.title
                                )}</span>
                                <span class="catalog-option-price">${getPriceLabel(
                                  item.price
                                )}</span>
                              </span>
                            </button>
                            <div class="catalog-option-controls" aria-label="Controle de quantidade">
                              <button
                                class="catalog-stepper"
                                type="button"
                                data-item-decrease
                                aria-label="Diminuir ${item.name}"
                              >
                                -
                              </button>
                              <span class="catalog-option-qty" data-item-qty></span>
                              <button
                                class="catalog-stepper"
                                type="button"
                                data-item-increase
                                aria-label="Aumentar ${item.name}"
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
                        `
                      )
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
  schedulePortugueseUiRefresh();
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
    event.target.name === "cart_cash_change_required"
  ) {
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
    };

    saveCartCheckout(nextCheckout);
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

    saveCartCheckout({
      ...checkout,
      cashAmountProvided: event.target.value,
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

const handleDocumentSubmit = (event) => {
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

    startPhoneVerification(name, phone);
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

  confirmPhoneVerification(code);
};

const handleDocumentClick = (event) => {
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
    startPhoneVerification(authState.phoneVerification.name, authState.phoneVerification.phone, {
      resent: true,
    });
    return;
  }

  const authPhoneOpenWhatsapp = event.target.closest("[data-auth-phone-open-whatsapp]");
  if (authPhoneOpenWhatsapp && authState.phoneVerification) {
    openPhoneVerificationWhatsapp(authState.phoneVerification, { resent: false });
    return;
  }

  const authEditButton = event.target.closest("[data-auth-edit]");
  if (authEditButton) {
    const profile = loadAuthProfile();
    authState.view = "entry";
    authState.editing = true;
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
    clearAuthProfile();
    authState.view = "entry";
    authState.socialProvider = null;
    authState.socialStatus = "idle";
    authState.editing = false;
    authState.error = "";
    authState.message = "Voce saiu da conta neste aparelho.";
    authState.draft = {};
    updateAuthTriggers();
    renderAuthPanel();
    renderCart();
    renderDeliveryHistory();
    renderOrderHistoryPage();
    renderReviewPage();
    prefillProfileForms();
    return;
  }

  const whatsappLink = event.target.closest("a[href*='wa.me']");
  if (whatsappLink) {
    event.preventDefault();
    const profile = loadAuthProfile();
    const isCartWhatsappIntent = whatsappLink.matches("[data-cart-whatsapp]");

    authState.pendingIntent = isCartWhatsappIntent ? "cart-whatsapp" : "";

    if (!profile) {
      openAuth("entry", whatsappLink.href);
      return;
    }

    if (isCartWhatsappIntent) {
      maybeRecordOrderFromCart();
    }

    const baseHref = whatsappLink.dataset.baseHref || whatsappLink.href;
    const preparedHref = appendProfileToWhatsappHref(baseHref);

    whatsappLink.dataset.baseHref = baseHref;
    authState.pendingIntent = "";

    if (isCartWhatsappIntent) {
      resetCartAfterCheckout();
    }

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

  const increaseButton = event.target.closest("[data-item-increase]");
  if (increaseButton) {
    const itemChip = increaseButton.closest("[data-item-chip]");

    if (itemChip) {
      addItemToCart({
        id: itemChip.dataset.itemId,
      });
      flashAddedState(increaseButton);
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

  const disabledWhatsapp = event.target.closest("[data-cart-whatsapp].is-disabled");
  if (disabledWhatsapp) {
    event.preventDefault();
    openCartCheckoutPanel();
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
    closeAuth();
    closeCart();
  }
});

renderCatalog();
createCartShell();
createAuthShell();
createSiteFooter();
updateAuthTriggers();
renderAuthPanel();
renderCart();
setActiveNavigation();
initComboHeroImages();
renderDeliveryHistory();
renderOrderHistoryPage();
renderReviewPage();
prefillProfileForms();
setupReveal();
updateHeaderState();
refreshPortugueseUi(document.body);
window.addEventListener("scroll", updateHeaderState, { passive: true });
