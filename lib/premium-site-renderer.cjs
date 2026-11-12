// Monta uma página do Modelo Premium para um restaurante a partir do HTML-modelo
// (o site do Tokyo). Roda no servidor para que título, canonical e Open Graph
// já saiam com a identidade certa (robôs do WhatsApp/Facebook não rodam JS).
const fs = require("node:fs");
const path = require("node:path");
const {
  PREMIUM_PAGES,
  PREMIUM_PAGE_BY_FILE,
  SITE_MODELS,
  PREMIUM_SITE_MODEL_KEY,
  fillRestaurantName,
  isReferenceRestaurant,
  normalizePremiumContent,
} = require("./premium-model.cjs");
const { buildPremiumPageUrl } = require("./premium-site-routes.cjs");

const TEMPLATE_ROOT = path.resolve(__dirname, "..");
const templateCache = new Map();

const PAGE_DESCRIPTIONS = Object.freeze({
  cardapio: "Monte sua sacola no cardápio completo do {restaurantName}.",
  entrega: "Veja a estimativa da entrega do {restaurantName} e as regras de atendimento.",
  historico: "Consulte seus pedidos dos últimos 30 dias no {restaurantName}.",
  avaliar: "Avalie o {restaurantName} com nota de 1 a 5 estrelas e envie sua opinião.",
  "trabalhe-conosco": "Envie seu interesse para trabalhar no {restaurantName}.",
  acompanhar: "Acompanhe o andamento do seu pedido no {restaurantName}.",
});

const PAGE_WHATSAPP_MESSAGE = Object.freeze({
  inicio: "pedido",
  cardapio: "pedido",
  entrega: "entrega",
  historico: "historico",
  acompanhar: "historico",
  avaliar: "avaliar",
  "trabalhe-conosco": "vagas",
});

const escapeHtml = (value = "") =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const loadPremiumTemplate = (pageKey) => {
  const page = PREMIUM_PAGES[pageKey];
  if (!page) {
    throw new Error(`Página do Modelo Premium desconhecida: ${pageKey}`);
  }
  if (!templateCache.has(page.file)) {
    templateCache.set(page.file, fs.readFileSync(path.join(TEMPLATE_ROOT, page.file), "utf8"));
  }
  return templateCache.get(page.file);
};

const toAbsoluteUrl = (origin, value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^data:/i.test(raw)) return "";
  return `${String(origin || "").replace(/\/+$/, "")}/${raw.replace(/^\.?\/+/, "")}`;
};

const toSiteAssetUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(https?:|data:)/i.test(raw)) return raw;
  return `/${raw.replace(/^\.?\/+/, "")}`;
};

// Troca o conteúdo do primeiro elemento que tem o atributo informado.
const replaceElementInner = (html, attribute, inner) => {
  const pattern = new RegExp(
    `(<([a-z0-9]+)\\b[^>]*\\s${attribute}(?:=["'][^"']*["'])?[^>]*>)([\\s\\S]*?)(</\\2>)`,
    "i"
  );
  return html.replace(pattern, (match, open, tag, current, close) => `${open}${inner}${close}`);
};

const setElementAttribute = (html, attribute, name, value) => {
  const pattern = new RegExp(`(<[a-z0-9]+\\b[^>]*\\s${attribute}\\b[^>]*>)`, "i");
  return html.replace(pattern, (tag) => {
    const attrPattern = new RegExp(`\\s${name}="[^"]*"`, "i");
    const nextAttr = ` ${name}="${escapeHtml(value)}"`;
    return attrPattern.test(tag) ? tag.replace(attrPattern, nextAttr) : tag.replace(/\s*\/?>$/, (end) => `${nextAttr}${end}`);
  });
};

const summarizeCatalog = (catalog = {}) => {
  const sections = (Array.isArray(catalog.sections) ? catalog.sections : []).filter(
    (section) => Array.isArray(section.items) && section.items.length
  );
  const items = sections.flatMap((section) =>
    section.items.map((item) => ({ ...item, sectionTitle: section.title || section.category || "" }))
  );
  const featured =
    items.find((item) => item.isHighlighted === true && item.image) ||
    items.find((item) => item.image) ||
    items[0] ||
    null;

  return {
    itemCount: items.length,
    sections: sections.map((section) => ({
      id: String(section.id || "").trim(),
      title: String(section.title || section.category || "").trim(),
    })).filter((section) => section.id && section.title),
    featured: featured
      ? {
          name: String(featured.name || "").trim(),
          image: String(featured.image || "").trim(),
          category: String(featured.sectionTitle || featured.category || "").trim(),
          description: String(featured.description || "").trim(),
        }
      : null,
  };
};

const formatItemsMetric = (itemCount) => {
  const count = Number(itemCount) || 0;
  if (count <= 0) return "Novo";
  if (count < 10) return String(count);
  return `+${Math.floor(count / 10) * 10}`;
};

const buildHead = ({ title, description, name, canonicalUrl, imageUrl, imageAlt, iconUrl, isReference, slug, basePath, themeColor }) => {
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="robots" content="index,follow" />`,
    `<meta name="theme-color" content="${escapeHtml(themeColor)}" />`,
    `<meta name="application-name" content="${escapeHtml(name)}" />`,
    `<meta name="inovas-restaurant-slug" content="${escapeHtml(slug)}" />`,
    `<meta name="inovas-base-path" content="${escapeHtml(basePath)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    iconUrl ? `<link rel="icon" href="${escapeHtml(iconUrl)}" />` : "",
    iconUrl ? `<link rel="apple-touch-icon" href="${escapeHtml(iconUrl)}" />` : "",
    isReference ? `<link rel="manifest" href="/tokyo.webmanifest" />` : "",
    `<meta property="og:locale" content="pt_BR" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(name)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}" />` : "",
    imageUrl ? `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />` : "",
    `<meta name="twitter:card" content="${imageUrl ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    imageUrl ? `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />` : "",
    `<script src="/premium-route.js"></script>`,
  ];
  return `${tags.filter(Boolean).join("\n    ")}\n    `;
};

const formatMoney = (value) =>
  `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;
const formatKm = (value) => String(Number(value || 0)).replace(".", ",");

// Faixas de entrega do restaurante (configuração de entrega do Gestor).
const buildDeliveryBandsHtml = (deliverySettings = {}) => {
  const bands = (Array.isArray(deliverySettings.distanceBands) ? deliverySettings.distanceBands : [])
    .filter((band) => band && band.isActive !== false && Number(band.maxKm) > 0)
    .sort((a, b) => Number(a.maxKm) - Number(b.maxKm));
  if (!bands.length) {
    return `\n                <article>\n                  <strong>Taxa conforme a distância</strong>\n                  <span>O valor é confirmado pela loja no pedido.</span>\n                </article>\n              `;
  }
  return (
    bands
      .map(
        (band) => `\n                <article>\n                  <strong>${escapeHtml(`${formatMoney(band.customerFee)} até ${formatKm(band.maxKm)} km`)}</strong>\n                  <span>${escapeHtml(`Entregas de ${formatKm(band.minKm || 0)} a ${formatKm(band.maxKm)} km.`)}</span>\n                </article>`
      )
      .join("") + "\n              "
  );
};

const buildWhatsappHref = (whatsapp, message) =>
  `https://wa.me/${encodeURIComponent(whatsapp)}?text=${encodeURIComponent(message)}`;

/**
 * @param {object} input
 * @param {string} input.pageKey  inicio | cardapio | entrega | historico | avaliar | trabalhe-conosco | acompanhar
 * @param {string} input.basePath "/kasulo-rocha-pizzaria" no domínio INOVAS, "" num domínio próprio
 * @param {string} input.origin   "https://inovasfood.com.br" ou o domínio próprio ativo
 * @param {string} input.slug
 * @param {object} input.settings configurações públicas do restaurante
 * @param {object} [input.catalog] cardápio público ({ sections })
 * @param {object} [input.deliverySettings] configuração pública de entrega (faixas)
 * @param {string} [input.template] HTML-modelo (padrão: arquivo do repositório)
 */
const renderPremiumPage = ({
  pageKey,
  basePath = "",
  origin,
  slug = "",
  settings = {},
  catalog = {},
  deliverySettings = {},
  template,
}) => {
  const page = PREMIUM_PAGES[pageKey];
  if (!page) {
    throw new Error(`Página do Modelo Premium desconhecida: ${pageKey}`);
  }
  const model = SITE_MODELS[PREMIUM_SITE_MODEL_KEY];
  const restaurantKey = String(settings.restaurantKey || "").trim();
  const isReference = isReferenceRestaurant(restaurantKey);
  const content = normalizePremiumContent(settings.premiumContent, restaurantKey);
  const name = String(settings.restaurantName || "").trim() || "Restaurante";
  const fill = (text) => fillRestaurantName(text, name);
  const summary = summarizeCatalog(catalog);
  const canonicalUrl = `${String(origin || "").replace(/\/+$/, "")}${buildPremiumPageUrl(basePath, pageKey)}`;
  const seoTitle = String(settings.seoTitle || "").trim() || name;
  const title = page.title ? `${page.title} | ${name}` : seoTitle;
  const description = page.title
    ? fill(PAGE_DESCRIPTIONS[pageKey] || "")
    : String(settings.seoDescription || settings.description || "").trim() || `${name}: cardápio, pedidos online e entrega.`;
  const imageSource =
    settings.seoOpenGraph?.image || settings.seoShareImage || summary.featured?.image || settings.bannerUrl || settings.logoUrl;
  const imageUrl = toAbsoluteUrl(origin, imageSource);
  const logoUrl = toSiteAssetUrl(settings.logoUrl);
  const whatsapp = String(settings.whatsapp || "").replace(/\D/g, "");
  const whatsappMessage = fill(content.whatsappMessages[PAGE_WHATSAPP_MESSAGE[pageKey]] || content.whatsappMessages.pedido);

  let html = template || loadPremiumTemplate(pageKey);

  // 1. Cabeçalho do documento (SEO por página).
  html = html.replace(
    /<title>[\s\S]*?(?=<script defer src="\.\/site-config\.js">)/,
    buildHead({
      title,
      description,
      name,
      canonicalUrl,
      imageUrl,
      imageAlt:
        summary.featured?.name && imageSource === summary.featured.image
          ? `${summary.featured.name} - ${name}`
          : name,
      iconUrl: logoUrl || (isReference ? "/site-images/site-icon.png" : ""),
      isReference,
      slug,
      basePath,
      themeColor: model.themeColor,
    })
  );

  // 2. Links internos sob o slug; arquivos do site pela raiz.
  html = html.replace(/href="\.\/([a-z0-9-]+)\.html(#[^"]*)?"/gi, (match, file, hash = "") => {
    const key = file === "index" ? "inicio" : PREMIUM_PAGE_BY_FILE[`${file}.html`];
    return key ? `href="${escapeHtml(buildPremiumPageUrl(basePath, key))}${hash}"` : match;
  });
  html = html.replace(/(\s(?:src|href))="\.\//g, '$1="/');

  // 3. Identidade no topo.
  html = html.replace(
    /(<span class="brand-mark">\s*<img)\s+src="[^"]*"\s+alt="[^"]*"/,
    logoUrl
      ? `$1 src="${escapeHtml(logoUrl)}" alt="${escapeHtml(`Logo ${name}`)}"`
      : `$1 src="" alt="${escapeHtml(`Logo ${name}`)}" hidden`
  );
  html = html.replace(
    /(<span class="brand-meta">\s*<strong>)[\s\S]*?(<\/strong>\s*<small>)[\s\S]*?(<\/small>)/,
    `$1${escapeHtml(name)}$2${escapeHtml(settings.slogan || "Delivery Premium")}$3`
  );

  // 4. Textos do modelo vindos da configuração.
  html = replaceElementInner(
    html,
    "data-premium-hero-eyebrow",
    `\n              <span></span>\n              ${escapeHtml(fill(content.heroEyebrow))}\n            `
  );
  html = replaceElementInner(
    html,
    "data-premium-hero-title",
    content.heroTitleLines
      .map((line) => `\n              <span class="hero-title-line">${escapeHtml(fill(line))}</span>`)
      .join("") + "\n            "
  );
  if (content.pageTags[pageKey]) {
    html = replaceElementInner(
      html,
      `data-premium-page-tag="${pageKey}"`,
      `\n              <span></span>\n              ${escapeHtml(fill(content.pageTags[pageKey]))}\n            `
    );
  }
  html = replaceElementInner(html, "data-premium-metric-time", escapeHtml(`${Number(settings.averagePreparationTimeMinutes) || 25}min`));
  html = replaceElementInner(html, "data-premium-metric-time-label", escapeHtml(content.metricsDeliveryLabel));
  html = replaceElementInner(html, "data-premium-metric-items", escapeHtml(formatItemsMetric(summary.itemCount)));
  html = replaceElementInner(html, "data-premium-metric-items-label", escapeHtml(content.metricsItemsLabel));
  html = replaceElementInner(html, "data-premium-addons-intro", `\n              ${escapeHtml(fill(content.addonsIntro))}\n            `);
  html = replaceElementInner(html, "data-premium-review-title", escapeHtml(fill(content.reviewTitle)));

  // 5. Conteúdo que no HTML-modelo é do Tokyo: só troca para os outros restaurantes.
  if (!isReference) {
    const featured = summary.featured;
    html = replaceElementInner(html, "data-premium-featured-category", escapeHtml(featured?.category || "Destaque"));
    html = replaceElementInner(html, "data-premium-featured-name", escapeHtml(featured?.name || "Cardápio completo"));
    html = replaceElementInner(
      html,
      "data-premium-featured-list",
      featured?.description ? `\n                <span>${escapeHtml(featured.description)}</span>\n              ` : ""
    );
    const featuredImage = toSiteAssetUrl(featured?.image || settings.bannerUrl || "");
    html = setElementAttribute(html, "data-premium-featured-image", "src", featuredImage);
    html = setElementAttribute(html, "data-premium-featured-image", "alt", featured?.name ? `${featured.name} - ${name}` : name);
    // Entrega: endereço de origem e faixas do restaurante (no HTML-modelo são do Tokyo).
    const storeAddress = String(settings.address || "").trim() || "endereço da loja (a confirmar)";
    html = replaceElementInner(html, "data-premium-store-address", escapeHtml(storeAddress));
    html = replaceElementInner(html, "data-premium-store-address-note", escapeHtml(storeAddress));
    html = replaceElementInner(
      html,
      "data-premium-origin-copy",
      `\n              Toda simulação parte de ${escapeHtml(storeAddress)},\n              para manter o cálculo alinhado com a operação do delivery.\n            `
    );
    html = replaceElementInner(html, "data-premium-delivery-bands", buildDeliveryBandsHtml(deliverySettings));
    const pricePerKm = Number(settings.deliveryBase?.pricePerKm || 0);
    const bands = (deliverySettings.distanceBands || []).filter((band) => band && band.isActive !== false);
    const lastKm = bands.length ? Math.max(...bands.map((band) => Number(band.maxKm) || 0)) : 0;
    html = replaceElementInner(
      html,
      "data-premium-delivery-extra",
      escapeHtml(
        pricePerKm > 0 && lastKm > 0
          ? `Entregas acima de ${formatKm(lastKm)} km possuem acréscimo de ${formatMoney(pricePerKm)} por km adicional.`
          : "Entregas fora das faixas são combinadas com a loja."
      )
    );
    html = replaceElementInner(
      html,
      "data-premium-quick-links",
      summary.sections
        .slice(0, 6)
        .map((section) => `\n              <a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a>`)
        .join("") + "\n            "
    );
  }

  // 6. WhatsApp do restaurante com a mensagem desta página (sem número = sem botão).
  html = html.replace(/href="https:\/\/wa\.me\/[^"]*"/g, `href="${escapeHtml(whatsapp ? buildWhatsappHref(whatsapp, whatsappMessage) : "#")}"`);
  if (!whatsapp) {
    html = html.replace(/<div class="whatsapp-widget"/, '<div class="whatsapp-widget" hidden');
  }

  return html;
};

module.exports = {
  escapeHtml,
  formatItemsMetric,
  loadPremiumTemplate,
  renderPremiumPage,
  summarizeCatalog,
};
