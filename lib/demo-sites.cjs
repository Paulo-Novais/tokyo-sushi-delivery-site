"use strict";

// Sites de demonstração para restaurantes que ainda não são clientes
// (proposta comercial). Abrem em inovasfood.com.br/<slug> com uma página
// estática de /demo/<slug>/ — só enquanto NENHUM restaurante cadastrado usar
// esse endereço (quando o restaurante virar cliente, o site real entra no
// lugar sozinho). Para tirar uma demonstração do ar, remova daqui.
// Usado pelo middleware.js e pelo servidor de testes local.

const DEMO_RESTAURANT_SITES = Object.freeze({
  aesfiharia: "/demo/aesfiharia/index.html",
});

// Página da demonstração para o endereço (só a página inicial do slug).
const resolveDemoSitePage = (slug = "", suffix = "") => {
  const page = DEMO_RESTAURANT_SITES[String(slug || "").toLowerCase()];
  if (!page) return "";
  return suffix === "" || suffix === "/" || suffix === "/index.html" ? page : "";
};

module.exports = { DEMO_RESTAURANT_SITES, resolveDemoSitePage };
