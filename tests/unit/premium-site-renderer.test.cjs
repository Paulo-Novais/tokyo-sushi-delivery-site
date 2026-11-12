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
