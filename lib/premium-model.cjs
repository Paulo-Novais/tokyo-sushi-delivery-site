// Modelo Premium do INOVAS Food (decisão de 12/11/2026).
//
// O site do Tokyo Sushi é a referência oficial: layout, páginas e fluxos são os
// mesmos para todo restaurante que usa este modelo. Por restaurante só mudam os
// dados e a identidade, que vêm das configurações (restaurant_settings), nunca do
// HTML. Este módulo é a única fonte dos textos do modelo e do que é do Tokyo.
const PREMIUM_SITE_MODEL_KEY = "PREMIUM";
const REFERENCE_RESTAURANT_KEY = "default"; // Tokyo Sushi
const REFERENCE_PUBLIC_URL = "https://tokyosushidelivery.com.br";

// Páginas do modelo: nome limpo na URL -> arquivo-modelo.
const PREMIUM_PAGES = Object.freeze({
  inicio: Object.freeze({ file: "tokyo.html", path: "", title: "" }),
  cardapio: Object.freeze({ file: "cardapio.html", path: "cardapio", title: "Cardápio" }),
  entrega: Object.freeze({ file: "entrega.html", path: "entrega", title: "Entrega" }),
  historico: Object.freeze({ file: "historico.html", path: "historico", title: "Histórico" }),
  avaliar: Object.freeze({ file: "avaliar.html", path: "avaliar", title: "Avaliar" }),
  "trabalhe-conosco": Object.freeze({
    file: "trabalhe-conosco.html",
    path: "trabalhe-conosco",
    title: "Trabalhe Conosco",
  }),
  acompanhar: Object.freeze({ file: "acompanhar.html", path: "acompanhar", title: "Acompanhar Pedido" }),
});

const PREMIUM_PAGE_BY_FILE = Object.freeze(
  Object.fromEntries(Object.entries(PREMIUM_PAGES).map(([key, page]) => [page.file, key]))
);

const SITE_MODELS = Object.freeze({
  [PREMIUM_SITE_MODEL_KEY]: Object.freeze({
    key: PREMIUM_SITE_MODEL_KEY,
    label: "Modelo Premium",
    description:
      "Tema escuro premium do Tokyo Sushi: Cardápio, Entrega, Histórico, Avaliar e Trabalhe Conosco.",
    referenceRestaurantKey: REFERENCE_RESTAURANT_KEY,
    referenceRestaurantName: "Tokyo Sushi Delivery",
    referenceUrl: REFERENCE_PUBLIC_URL,
    themeColor: "#080505",
    pages: Object.keys(PREMIUM_PAGES),
  }),
});

const WHATSAPP_MESSAGE_KEYS = Object.freeze(["pedido", "entrega", "historico", "avaliar", "vagas"]);

// Conteúdo do Tokyo, igual ao que estava escrito no HTML/JS (referência do modelo).
const TOKYO_PREMIUM_CONTENT = Object.freeze({
  heroEyebrow: "Experiência premium de delivery japonês",
  heroTitleLines: Object.freeze(["O sabor do Japão,", "direto na sua casa."]),
  metricsDeliveryLabel: "Entrega ágil",
  metricsItemsLabel: "Combos e especialidades",
  pageTags: Object.freeze({
    cardapio: "Cardápio digital Tokyo",
    entrega: "Entrega Tokyo",
    historico: "Historico Tokyo",
    "trabalhe-conosco": "Time Tokyo",
    acompanhar: "Acompanhamento Tokyo",
  }),
  addonsIntro:
    "1 Hashi e 1 Shoyu são grátis. Extras entram no total conforme a quantidade escolhida.",
  cartAddons: Object.freeze([
    Object.freeze({ id: "hashi", name: "Hashi", unitPrice: 1, freeUnits: 1, defaultQuantity: 1 }),
    Object.freeze({ id: "adaptador", name: "Adaptador", unitPrice: 0.2, freeUnits: 0, defaultQuantity: 0 }),
    Object.freeze({ id: "shoyu", name: "Shoyu", unitPrice: 4, freeUnits: 1, defaultQuantity: 1 }),
    Object.freeze({ id: "tare", name: "Tare", unitPrice: 6, freeUnits: 0, defaultQuantity: 0 }),
  ]),
  // Mesmos textos de lib/app-branding.cjs (whatsappTemplates) do Tokyo.
  whatsappMessages: Object.freeze({
    pedido: "Ola, quero fazer um pedido no {restaurantName}.",
    entrega: "Olá, quero tirar uma dúvida sobre a entrega.",
    historico: "Olá, quero ajuda com meu historico de pedidos.",
    avaliar: "Olá, quero falar sobre minha avaliacao do site.",
    vagas: "Olá, quero falar sobre uma vaga no Tokyo Sushi.",
  }),
});

// Conteúdo neutro para qualquer outro restaurante até ele configurar o próprio.
// Nada aqui pode citar o Tokyo, sushi ou números/avaliações fictícios.
const NEUTRAL_PREMIUM_CONTENT = Object.freeze({
  heroEyebrow: "Delivery próprio",
  heroTitleLines: Object.freeze(["{restaurantName},", "direto na sua casa."]),
  metricsDeliveryLabel: "Tempo médio de preparo",
  metricsItemsLabel: "Itens no cardápio",
  pageTags: Object.freeze({
    cardapio: "Cardápio digital",
    entrega: "Entrega",
    historico: "Histórico",
    "trabalhe-conosco": "Trabalhe conosco",
    acompanhar: "Acompanhamento",
  }),
  addonsIntro: "Escolha os complementos do seu pedido. Extras entram no total.",
  cartAddons: Object.freeze([]),
  whatsappMessages: Object.freeze({
    pedido: "Olá, quero fazer um pedido no {restaurantName}.",
    entrega: "Olá, quero tirar uma dúvida sobre a entrega do {restaurantName}.",
    historico: "Olá, quero ajuda com um pedido anterior no {restaurantName}.",
    avaliar: "Olá, quero falar sobre minha experiência no {restaurantName}.",
    vagas: "Olá, quero falar sobre uma vaga no {restaurantName}.",
  }),
});

const isReferenceRestaurant = (restaurantKey = "") =>
  String(restaurantKey || REFERENCE_RESTAURANT_KEY).trim() === REFERENCE_RESTAURANT_KEY;

const getDefaultPremiumContent = (restaurantKey = REFERENCE_RESTAURANT_KEY) =>
  JSON.parse(
    JSON.stringify(isReferenceRestaurant(restaurantKey) ? TOKYO_PREMIUM_CONTENT : NEUTRAL_PREMIUM_CONTENT)
  );

const cleanText = (value, maxLength = 160) =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const toMoney = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 999
    ? Math.round(number * 100) / 100
    : fallback;
};

const toCount = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 50 ? number : fallback;
};

const normalizeCartAddons = (addons, fallback = []) => {
  if (!Array.isArray(addons)) {
    return JSON.parse(JSON.stringify(fallback));
  }

  const seen = new Set();
  return addons
    .map((addon) => {
      const name = cleanText(addon?.name, 60);
      const id = cleanText(addon?.id || name, 60)
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (!id || !name || seen.has(id)) return null;
      seen.add(id);
      const freeUnits = toCount(addon?.freeUnits, 0);
      return {
        id,
        name,
        unitPrice: toMoney(addon?.unitPrice, 0),
        freeUnits,
        defaultQuantity: toCount(addon?.defaultQuantity, 0),
      };
    })
    .filter(Boolean)
    .slice(0, 20);
};

const normalizePremiumContent = (source, restaurantKey = REFERENCE_RESTAURANT_KEY) => {
  const defaults = getDefaultPremiumContent(restaurantKey);
  const input = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  const titleLines = Array.isArray(input.heroTitleLines)
    ? input.heroTitleLines.map((line) => cleanText(line, 60)).filter(Boolean).slice(0, 2)
    : [];
  const pageTags = { ...defaults.pageTags };
  Object.keys(pageTags).forEach((pageKey) => {
    const value = cleanText(input.pageTags?.[pageKey], 60);
    if (value) pageTags[pageKey] = value;
  });
  const whatsappMessages = { ...defaults.whatsappMessages };
  WHATSAPP_MESSAGE_KEYS.forEach((key) => {
    const value = cleanText(input.whatsappMessages?.[key], 240);
    if (value) whatsappMessages[key] = value;
  });

  return {
    heroEyebrow: cleanText(input.heroEyebrow, 80) || defaults.heroEyebrow,
    heroTitleLines: titleLines.length ? titleLines : defaults.heroTitleLines,
    metricsDeliveryLabel: cleanText(input.metricsDeliveryLabel, 40) || defaults.metricsDeliveryLabel,
    metricsItemsLabel: cleanText(input.metricsItemsLabel, 40) || defaults.metricsItemsLabel,
    pageTags,
    addonsIntro: cleanText(input.addonsIntro, 240) || defaults.addonsIntro,
    cartAddons: normalizeCartAddons(input.cartAddons, defaults.cartAddons),
    whatsappMessages,
  };
};

const fillRestaurantName = (template = "", restaurantName = "") =>
  String(template || "").split("{restaurantName}").join(String(restaurantName || "").trim());

module.exports = {
  NEUTRAL_PREMIUM_CONTENT,
  PREMIUM_PAGES,
  PREMIUM_PAGE_BY_FILE,
  PREMIUM_SITE_MODEL_KEY,
  REFERENCE_PUBLIC_URL,
  REFERENCE_RESTAURANT_KEY,
  SITE_MODELS,
  TOKYO_PREMIUM_CONTENT,
  WHATSAPP_MESSAGE_KEYS,
  fillRestaurantName,
  getDefaultPremiumContent,
  isReferenceRestaurant,
  normalizeCartAddons,
  normalizePremiumContent,
};
