const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const {
  buildPremiumPageUrl,
  isRootPremiumTemplatePath,
  resolvePremiumSuffix,
} = require(path.join(__dirname, "..", "..", "lib", "premium-site-routes.cjs"));
const { validateRestaurantSlug } = require(path.join(__dirname, "..", "..", "lib", "restaurant-public-url.cjs"));

test("páginas do Modelo Premium têm endereço limpo sob o slug", () => {
  assert.deepEqual(resolvePremiumSuffix(""), { kind: "page", pageKey: "inicio" });
  for (const page of ["cardapio", "entrega", "historico", "avaliar", "trabalhe-conosco", "acompanhar"]) {
    assert.deepEqual(resolvePremiumSuffix(`/${page}`), { kind: "page", pageKey: page });
  }
});

test("endereços antigos com .html e barra final redirecionam para o limpo", () => {
  assert.deepEqual(resolvePremiumSuffix("/cardapio.html"), { kind: "redirect", pagePath: "/cardapio" });
  assert.deepEqual(resolvePremiumSuffix("/cardapio/"), { kind: "redirect", pagePath: "/cardapio" });
  assert.deepEqual(resolvePremiumSuffix("/tokyo.html"), { kind: "redirect", pagePath: "" });
  assert.deepEqual(resolvePremiumSuffix("/index.html"), { kind: "redirect", pagePath: "" });
  assert.deepEqual(resolvePremiumSuffix("/"), { kind: "redirect", pagePath: "" });
});

test("só arquivos públicos do site passam como asset; o resto é 404", () => {
  assert.deepEqual(resolvePremiumSuffix("/styles.css"), { kind: "asset", path: "/styles.css" });
  assert.deepEqual(resolvePremiumSuffix("/site-images/logo.png"), { kind: "asset", path: "/site-images/logo.png" });
  for (const blocked of ["/admin/", "/api/catalog", "/lib/tenant-context.cjs", "/package.json", "/.env", "/gestor"]) {
    assert.equal(resolvePremiumSuffix(blocked).kind, "not_found", blocked);
  }
});

test("links internos ficam sob o slug (nada de link para a raiz do Tokyo)", () => {
  assert.equal(buildPremiumPageUrl("/kasulo-rocha-pizzaria", "inicio"), "/kasulo-rocha-pizzaria");
  assert.equal(buildPremiumPageUrl("/kasulo-rocha-pizzaria", "cardapio"), "/kasulo-rocha-pizzaria/cardapio");
  assert.equal(buildPremiumPageUrl("", "inicio"), "/");
  assert.equal(buildPremiumPageUrl("", "entrega"), "/entrega");
});

test("slug não colide com rotas do INOVAS nem com páginas do modelo", () => {
  for (const reserved of ["gestor", "admin", "api", "system", "login", "cardapio", "entrega", "historico", "avaliar", "trabalhe-conosco", "acompanhar", "inovas"]) {
    assert.equal(validateRestaurantSlug(reserved).ok, false, reserved);
  }
  assert.equal(validateRestaurantSlug("kasulo-rocha-pizzaria").ok, true);
});

test("arquivos-modelo na raiz são reconhecidos para bloqueio fora do domínio do Tokyo", () => {
  assert.equal(isRootPremiumTemplatePath("/cardapio.html"), true);
  assert.equal(isRootPremiumTemplatePath("/tokyo.html"), true);
  assert.equal(isRootPremiumTemplatePath("/inovas.html"), false);
});

test("restaurante da página (cabeçalho) vale mais que o cookie compartilhado do domínio", () => {
  const { getRequestRestaurantSlug } = require(path.join(__dirname, "..", "..", "lib", "tenant-resolution.cjs"));
  const req = {
    headers: {
      host: "inovasfood.com.br",
      cookie: "inovas_restaurant_slug=tokyosushidelivery",
      "x-inovas-restaurant-slug": "kasulo-rocha-pizzaria",
    },
  };
  assert.equal(getRequestRestaurantSlug(req, "inovasfood.com.br"), "kasulo-rocha-pizzaria");
  assert.equal(
    getRequestRestaurantSlug({ headers: { cookie: "inovas_restaurant_slug=tokyosushidelivery" } }, "inovasfood.com.br"),
    "tokyosushidelivery"
  );
  assert.equal(
    getRequestRestaurantSlug({ headers: { "x-inovas-restaurant-slug": "kasulo-rocha-pizzaria" } }, "tokyosushidelivery.com.br"),
    "",
    "domínio próprio ignora slug enviado pelo navegador"
  );
});
