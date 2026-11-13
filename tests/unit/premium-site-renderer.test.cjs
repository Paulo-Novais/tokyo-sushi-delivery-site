const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderPremiumPage } = require(path.join(__dirname, "..", "..", "lib", "premium-site-renderer.cjs"));

const PAGES = ["inicio", "cardapio", "entrega", "historico", "avaliar", "trabalhe-conosco", "acompanhar"];
const KASULO = Object.freeze({
  restaurantKey: "kasulo-rocha-pizzaria",
  restaurantName: "Kasulo Rocha Pizzaria",
  slogan: "Pizzaria Delivery",
  logoUrl: "https://blogger.googleusercontent.com/kasulinho.png",
  whatsapp: "5516900000000",
  seoTitle: "Kasulo Rocha Pizzaria",
  seoDescription: "Pizzas artesanais com entrega.",
  averagePreparationTimeMinutes: 40,
  premiumContent: { heroEyebrow: "Pizzaria artesanal", heroTitleLines: ["Pizza quentinha,", "direto na sua casa."] },
});
const KASULO_CATALOG = {
  sections: [
    {
      id: "pizzas-salgadas",
      title: "Pizzas Salgadas",
      items: [
        { id: "a", name: "Marguerita", image: "https://blogger.googleusercontent.com/marguerita.png", description: "Molho, muçarela e manjericão." },
        { id: "b", name: "Frango Caipira", image: "https://blogger.googleusercontent.com/frango.png", isHighlighted: true, description: "Frango caipira e catupiry." },
      ],
    },
    { id: "bebidas", title: "Bebidas", items: [{ id: "c", name: "Coca-Cola 2L", image: "" }] },
  ],
};

const render = (pageKey, overrides = {}) =>
  renderPremiumPage({
    pageKey,
    basePath: "/kasulo-rocha-pizzaria",
    origin: "https://inovasfood.com.br",
    slug: "kasulo-rocha-pizzaria",
    settings: KASULO,
    catalog: KASULO_CATALOG,
    ...overrides,
  });

const visibleText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

test("canonical, título e Open Graph usam a URL e a identidade da Kasulo em todas as páginas", () => {
  for (const pageKey of PAGES) {
    const html = render(pageKey);
    const expectedUrl =
      pageKey === "inicio"
        ? "https://inovasfood.com.br/kasulo-rocha-pizzaria"
        : `https://inovasfood.com.br/kasulo-rocha-pizzaria/${pageKey}`;
    assert.match(html, new RegExp(`<link rel="canonical" href="${expectedUrl}" />`), pageKey);
    assert.match(html, new RegExp(`<meta property="og:url" content="${expectedUrl}" />`), pageKey);
    assert.match(html, /<meta property="og:locale" content="pt_BR" \/>/);
    assert.match(html, /<meta name="robots" content="index,follow" \/>/);
    assert.match(html, /<title>[^<]*Kasulo Rocha Pizzaria<\/title>/, pageKey);
    assert.match(html, /og:image" content="https:\/\/blogger\.googleusercontent\.com\/frango\.png"/, "imagem do produto destaque");
    assert.doesNotMatch(html, /tokyosushidelivery\.com\.br/, `${pageKey}: link para o domínio do Tokyo`);
  }
  assert.match(render("cardapio"), /<title>Cardápio \| Kasulo Rocha Pizzaria<\/title>/);
});

test("nenhum texto visível nem WhatsApp do Tokyo na página da Kasulo", () => {
  for (const pageKey of PAGES) {
    const html = render(pageKey);
    const text = visibleText(html);
    assert.doesNotMatch(text, /tokyo|sushi|japon|hashi|shoyu|samurai/i, `${pageKey}: ${text.match(/.{0,40}(tokyo|sushi|japon|hashi|shoyu|samurai).{0,40}/i)?.[0]}`);
    assert.doesNotMatch(html, /5516990507398/, `${pageKey}: WhatsApp do Tokyo`);
    assert.doesNotMatch(html, /General Os[oó]rio|14400-520/, `${pageKey}: endereço do Tokyo`);
    assert.doesNotMatch(html, /alt="[^"]*Tokyo/i, `${pageKey}: alt com Tokyo`);
  }
});

test("links internos ficam sob /kasulo-rocha-pizzaria", () => {
  const html = render("inicio");
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  for (const href of hrefs) {
    assert.doesNotMatch(href, /\.html/, `link antigo: ${href}`);
  }
  for (const page of ["cardapio", "entrega", "historico", "avaliar", "trabalhe-conosco"]) {
    assert.ok(hrefs.includes(`/kasulo-rocha-pizzaria/${page}`), `menu sem /${page}`);
  }
  assert.ok(hrefs.includes("/kasulo-rocha-pizzaria/cardapio#catalogo"));
  assert.ok(hrefs.includes("/kasulo-rocha-pizzaria"), "logo volta para a home do restaurante");
});

test("textos e indicadores vêm da configuração e do cardápio", () => {
  const html = render("inicio");
  assert.match(html, /Pizzaria artesanal/);
  assert.match(html, /Pizza quentinha,/);
  assert.match(html, /data-premium-metric-time>40min</);
  assert.match(html, /data-premium-metric-items>3</, "3 itens contados do cardápio");
  assert.match(html, /data-premium-featured-name>Frango Caipira</);
  assert.match(html, /wa\.me\/5516900000000\?text=Ol%C3%A1%2C%20quero%20fazer%20um%20pedido%20no%20Kasulo%20Rocha%20Pizzaria/);
  const careers = render("trabalhe-conosco");
  assert.match(careers, /uma%20vaga%20no%20Kasulo%20Rocha%20Pizzaria/, "mensagem de WhatsApp da página de vagas");
  const menu = render("cardapio");
  assert.match(menu, /<a href="#pizzas-salgadas">Pizzas Salgadas<\/a>/);
  assert.doesNotMatch(menu, /#temakis/);
});

test("sem WhatsApp configurado o botão some (nunca cai no número do Tokyo)", () => {
  const html = render("inicio", { settings: { ...KASULO, whatsapp: "" } });
  assert.match(html, /<div class="whatsapp-widget" hidden/);
  assert.doesNotMatch(html, /wa\.me/);
});

test("valores da configuração são escapados", () => {
  const html = render("inicio", { settings: { ...KASULO, restaurantName: '<script>alert(1)</script>"' } });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;&quot;/);
});

test("Entrega usa endereço e faixas do restaurante, nunca os do Tokyo", () => {
  const html = render("entrega", {
    settings: {
      ...KASULO,
      address: "Rua Batatais, 1106 - Centro, Franca - SP",
      deliveryBase: { pricePerKm: 2 },
    },
    deliverySettings: {
      distanceBands: [
        { minKm: 0, maxKm: 3, customerFee: 7, isActive: true },
        { minKm: 3, maxKm: 8, customerFee: 11.5, isActive: true },
        { minKm: 8, maxKm: 12, customerFee: 99, isActive: false },
      ],
      serviceArea: { maxRadiusKm: 8 },
    },
  });
  assert.doesNotMatch(html, /General Os[oó]rio|14400-520/, "endereço do Tokyo na Entrega");
  assert.match(html, /Rua Batatais, 1106/);
  assert.match(html, /R\$ 7,00 até 3 km/);
  assert.match(html, /R\$ 11,50 até 8 km/);
  assert.doesNotMatch(html, /R\$ 99,00/, "faixa inativa não aparece");
  assert.doesNotMatch(html, /R\$ 9,00 até 1,9 km/, "faixa do Tokyo");
  assert.match(html, /acréscimo de R\$ 2,00 por km adicional/);
});

test("cores e tema do restaurante já vêm no HTML (sem piscar o vermelho do Tokyo)", () => {
  const html = render("inicio", {
    settings: {
      ...KASULO,
      primaryColor: "#ff8c00",
      secondaryColor: "#2f6f3e",
      accentColor: "#ffd166",
      gradientStart: "#ff8c00",
      gradientEnd: "#fff3e0",
      siteLayout: "MODERN",
      siteTheme: "LIGHT",
    },
  });
  const htmlTag = html.match(/<html[^>]*>/)[0];
  assert.match(htmlTag, /data-site-theme="light"/);
  assert.match(htmlTag, /data-site-theme-mode="light"/);
  assert.match(htmlTag, /data-site-layout="modern"/);
  // As variáveis vêm num <style> DEPOIS do styles.css (na cascata, o último :root vence)
  // e ainda dentro do <head>, para a primeira pintura já ser a certa.
  const styleIndex = html.indexOf("--primary: #ff8c00");
  const sheetIndex = html.indexOf('href="/styles.css"');
  const headEnd = html.indexOf("</head>");
  assert.ok(sheetIndex > 0 && styleIndex > sheetIndex && styleIndex < headEnd, "estilo inline depois do styles.css, dentro do head");
  assert.match(html, /--primary-dark: #ff8c00/);
  assert.match(html, /--gold: #2f6f3e/);
  assert.match(html, /--gold-soft: rgba\(47, 111, 62, 0\.18\)/);
  assert.match(html, /--site-accent: #ffd166/);
  assert.match(html, /--site-gradient-end: #fff3e0/);
  assert.match(html, /<meta name="theme-color" content="#ff8c00" \/>/);
  assert.doesNotMatch(html, /#e83637/);
});

test("tema automático deixa a escolha claro/escuro para o navegador", () => {
  const html = render("inicio", { settings: { ...KASULO, primaryColor: "#ff8c00", siteTheme: "AUTO" } });
  const htmlTag = html.match(/<html[^>]*>/)[0];
  assert.doesNotMatch(htmlTag, /data-site-theme="/);
  assert.match(htmlTag, /data-site-theme-mode="auto"/);
});
