"use strict";

// CSS aplicado às telas do Gestor quando abertas dentro do app.
// - Esconde a navegação do Gestor: o app tem o próprio menu (Pedidos, Caixa,
//   Comandas, Cardápio).
// - Esconde os indicadores do painel do Gestor (Pedidos do dia, Faturamento,
//   Valor bruto vendido, Ticket médio...). No HTML do Gestor eles aparecem com
//   "--" enquanto a sessão carrega e no Painel; no app só fica a barra de
//   status de Pedidos (Recebidos, Aceitos, Em preparo...), que o Gestor marca
//   com a classe .is-stage-bar.
// Isto NÃO é controle de acesso; quem bloqueia de verdade é o servidor.
module.exports = `
html body.admin-body .admin-sidebar{display:none!important}
html body.admin-body .admin-shell{grid-template-columns:minmax(0,1fr)!important;width:100%!important;max-width:none!important;margin:0!important}
html body.admin-body .admin-main-shell{grid-column:1/-1!important;margin-left:0!important}
html body.admin-body [data-admin-logout]{display:none!important}
html body.admin-body [data-admin-stats]:not(.is-stage-bar){display:none!important}
html body.admin-body [data-admin-ops-ribbon],
html body.admin-body [data-admin-turn-panel],
html body.admin-body [data-admin-search-dashboard-summary]{display:none!important}
`;
