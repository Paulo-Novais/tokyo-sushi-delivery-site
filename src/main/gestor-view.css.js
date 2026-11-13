"use strict";

// CSS aplicado às telas do Gestor quando abertas dentro do app.
// Só esconde a navegação do Gestor: o app tem o próprio menu (Pedidos, Caixa,
// Comandas, Cardápio). Isto NÃO é controle de acesso; quem bloqueia é o servidor.
module.exports = `
html body.admin-body .admin-sidebar{display:none!important}
html body.admin-body .admin-shell{grid-template-columns:minmax(0,1fr)!important;width:100%!important;max-width:none!important;margin:0!important}
html body.admin-body .admin-main-shell{grid-column:1/-1!important;margin-left:0!important}
html body.admin-body [data-admin-logout]{display:none!important}
`;
