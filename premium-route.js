// Modelo Premium: em qual restaurante esta página está.
// No domínio INOVAS (inovasfood.com.br/<slug>) todos os restaurantes dividem o
// mesmo endereço, então o slug vai junto em toda chamada /api e separa o que
// fica salvo no aparelho (login, sacola, histórico) por restaurante.
// No domínio próprio do Tokyo (páginas estáticas) não há slug e nada muda.
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root && root.document) {
    api.install(root);
  }
})(typeof window === "object" ? window : null, function () {
  var SLUG_HEADER = "x-inovas-restaurant-slug";
  var SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
  var PAGE_PATHS = {
    inicio: "",
    cardapio: "cardapio",
    entrega: "entrega",
    historico: "historico",
    avaliar: "avaliar",
    "trabalhe-conosco": "trabalhe-conosco",
    acompanhar: "acompanhar",
  };
  var FILE_TO_PAGE = {
    "index.html": "inicio",
    "tokyo.html": "inicio",
    "cardapio.html": "cardapio",
    "entrega.html": "entrega",
    "historico.html": "historico",
    "avaliar.html": "avaliar",
    "trabalhe-conosco.html": "trabalhe-conosco",
    "acompanhar.html": "acompanhar",
  };

  var createRoute = function (slug, basePath) {
    var cleanSlug = SLUG_PATTERN.test(String(slug || "")) ? String(slug) : "";
    var cleanBase = cleanSlug ? String(basePath || "").replace(/\/+$/, "") : "";

    var pageUrl = function (pageKey) {
      var pagePath = PAGE_PATHS[pageKey];
      if (pagePath === undefined) return "";
      if (!cleanBase) {
        return pageKey === "inicio" ? "./index.html" : "./" + pagePath + ".html";
      }
      return pagePath ? cleanBase + "/" + pagePath : cleanBase;
    };

    // "./acompanhar.html?pedido=1#x" -> "/<slug>/acompanhar?pedido=1#x" (no domínio INOVAS).
    var resolveHref = function (href) {
      var value = String(href || "");
      if (!cleanBase) return value;
      var match = value.match(/^\.?\/?([a-z0-9-]+\.html)([?#].*)?$/i);
      if (!match || !FILE_TO_PAGE[match[1]]) return value;
      return pageUrl(FILE_TO_PAGE[match[1]]) + (match[2] || "");
    };

    return {
      slug: cleanSlug,
      basePath: cleanBase,
      header: SLUG_HEADER,
      pageUrl: pageUrl,
      resolveHref: resolveHref,
      scopeStorageKey: function (key) {
        return cleanSlug ? String(key) + "::" + cleanSlug : String(key);
      },
    };
  };

  var readMeta = function (doc, name) {
    var node = doc.querySelector('meta[name="' + name + '"]');
    return node ? node.getAttribute("content") || "" : "";
  };

  var install = function (win) {
    var doc = win.document;
    var route = createRoute(readMeta(doc, "inovas-restaurant-slug"), readMeta(doc, "inovas-base-path"));
    win.INOVAS_PUBLIC_ROUTE = route;

    if (!route.slug) return route;

    // Links montados pelo script (./cardapio.html, ./acompanhar.html...) ficam sob o slug.
    var fixLinks = function (scope) {
      if (!scope || !scope.querySelectorAll) return;
      var anchors = scope.matches && scope.matches("a[href]") ? [scope] : [];
      anchors = anchors.concat(Array.prototype.slice.call(scope.querySelectorAll("a[href]")));
      anchors.forEach(function (anchor) {
        var href = anchor.getAttribute("href");
        var next = route.resolveHref(href);
        if (next !== href) anchor.setAttribute("href", next);
      });
    };
    var startObserver = function () {
      fixLinks(doc.body);
      if (typeof win.MutationObserver !== "function") return;
      new win.MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          if (mutation.type === "attributes") {
            fixLinks(mutation.target);
          } else {
            Array.prototype.forEach.call(mutation.addedNodes, function (node) {
              if (node.nodeType === 1) fixLinks(node);
            });
          }
        });
      }).observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });
    };
    if (doc.body) startObserver();
    else doc.addEventListener("DOMContentLoaded", startObserver);

    if (typeof win.fetch !== "function") return route;

    var originalFetch = win.fetch.bind(win);
    win.fetch = function (input, init) {
      try {
        var url = new URL(typeof input === "string" ? input : input.url, win.location.href);
        if (url.origin === win.location.origin && url.pathname.indexOf("/api/") === 0) {
          var options = init ? Object.assign({}, init) : {};
          var headers = new Headers(options.headers || (typeof input === "string" ? undefined : input.headers));
          headers.set(SLUG_HEADER, route.slug);
          options.headers = headers;
          return originalFetch(input, options);
        }
      } catch (error) {
        // URL inválida: segue sem cabeçalho.
      }
      return originalFetch(input, init);
    };

    return route;
  };

  return { createRoute: createRoute, install: install, SLUG_HEADER: SLUG_HEADER };
});
