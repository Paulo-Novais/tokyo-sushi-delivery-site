"use strict";

// Pedidos e Caixa só no app INOVAS PDV (desktop), não no navegador.
//
// O app marca todas as chamadas: cabeçalho X-Inovas-Client:
// inovas-pdv-desktop e "InovasPDV/<versão>" no User-Agent. Para a equipe do
// restaurante, o servidor recusa pelo navegador: todo o Caixa e a mudança de
// status de pedidos. Painel, relatórios e financeiro seguem no navegador;
// suporte da INOVAS não é afetado.
//
// É regra de produto, não barreira de segurança: quem forjar o cabeçalho
// continua sujeito a login, permissões e isolamento por restaurante.
//
// Chave INOVAS_REQUIRE_PDV_APP (vale para todos os restaurantes):
//   vazio/"off" = desligado (padrão até o app novo chegar aos restaurantes)
//   "on"        = todos os restaurantes
//   "prefix:x"  = só restaurantes com chave começando em "x" (testes locais)

const { getRequestHeader } = require("./http.cjs");

const PDV_CLIENT_HEADER_VALUE = "inovas-pdv-desktop";
const PDV_USER_AGENT_PATTERN = /\bInovasPDV\/\d+\.\d+\.\d+\b/;

const isPdvAppRequest = (req) =>
  getRequestHeader(req, "x-inovas-client").toLowerCase() === PDV_CLIENT_HEADER_VALUE ||
  PDV_USER_AGENT_PATTERN.test(getRequestHeader(req, "user-agent"));

const isPdvAppRequiredFor = (restaurantKey = "") => {
  const rule = String(process.env.INOVAS_REQUIRE_PDV_APP || "").trim().toLowerCase();
  if (!rule || rule === "off" || rule === "false") return false;
  if (rule.startsWith("prefix:")) return String(restaurantKey).startsWith(rule.slice("prefix:".length));
  return rule === "on" || rule === "true" || rule === "all";
};

module.exports = {
  PDV_CLIENT_HEADER_VALUE,
  isPdvAppRequest,
  isPdvAppRequiredFor,
};
