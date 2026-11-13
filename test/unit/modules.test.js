"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const m = require("../../src/shared/modules");

// Permissões reais dos papéis, copiadas de lib/access-policy.cjs do site (commit d46b320).
const CASHIER = [
  "tenant.dashboard.view", "tenant.orders.view", "tenant.orders.edit", "tenant.orders.create",
  "tenant.customers.view", "tenant.financial.view", "tenant.cash_register.view",
  "tenant.cash_register.open", "tenant.cash_register.close", "tenant.cash_register.open_tab",
  "tenant.cash_register.add_item", "tenant.cash_register.send_order",
  "tenant.cash_register.remove_service", "tenant.cash_register.close_tab",
  "tenant.cash_register.confirm_payment", "tenant.cash_register.history",
];
const WAITER = [
  "tenant.dashboard.view", "tenant.orders.view", "tenant.orders.edit", "tenant.orders.create",
  "tenant.cash_register.view", "tenant.cash_register.open_tab", "tenant.cash_register.add_item",
  "tenant.cash_register.send_order",
];
const KITCHEN = ["tenant.dashboard.view", "tenant.orders.view", "tenant.orders.edit", "tenant.catalog.view"];
const MANAGER_LIKE = [...CASHIER, "tenant.catalog.view", "tenant.catalog.edit"];

const available = (permissions) =>
  m.buildModules(permissions).filter((module) => module.available).map((module) => module.id);

test("CAIXA vê Pedidos, Caixa, Comandas e Cardápio (sem poder pausar)", () => {
  assert.deepEqual(available(CASHIER), ["pedidos", "caixa", "comandas", "cardapio"]);
  assert.equal(m.catalogAccess(CASHIER), "none");
  assert.equal(m.firstAvailableModule(m.buildModules(CASHIER)), "pedidos");
});

test("GARÇOM não abre/fecha caixa, mas lança comanda", () => {
  assert.deepEqual(available(WAITER), ["pedidos", "comandas", "cardapio"]);
});

test("COZINHA vê pedidos e consulta cardápio", () => {
  assert.deepEqual(available(KITCHEN), ["pedidos", "cardapio"]);
  assert.equal(m.catalogAccess(KITCHEN), "view");
});

test("quem tem tenant.catalog.edit pode pausar", () => {
  assert.equal(m.catalogAccess(MANAGER_LIKE), "pause");
});

test("sem permissão nenhuma, sobra só o Cardápio (que explica o bloqueio)", () => {
  assert.deepEqual(available([]), ["cardapio"]);
  assert.equal(m.firstAvailableModule(m.buildModules([])), "cardapio");
});

test("rótulos de papel em português", () => {
  assert.equal(m.roleLabel("CASHIER"), "Caixa");
  assert.equal(m.roleLabel("waiter"), "Garçom");
  assert.equal(m.roleLabel("MANAGER"), "Gerente");
  assert.equal(m.roleLabel(""), "Equipe");
});

test("navegação dentro da tela do Gestor", () => {
  const server = "https://inovasfood.com.br";
  const c = (url) => m.classifyGestorNavigation(url, server);
  assert.equal(c("https://inovasfood.com.br/admin/?section=orders"), "allow");
  assert.equal(c("https://inovasfood.com.br/admin/caixa/salao"), "allow");
  assert.equal(c("https://inovasfood.com.br/admin/caixa/fechamento"), "allow");
  assert.equal(c("https://inovasfood.com.br/admin/index.html?section=cash-register&cashView=floor"), "allow");
  assert.equal(c("https://inovasfood.com.br/login?next=%2Fadmin%2F"), "login");
  assert.equal(c("https://inovasfood.com.br/admin/login.html"), "login");
  assert.equal(c("https://inovasfood.com.br/admin/?section=finance"), "block");
  assert.equal(c("https://inovasfood.com.br/admin/?section=dashboard"), "block");
  assert.equal(c("https://inovasfood.com.br/admin/users"), "block");
  assert.equal(c("https://inovasfood.com.br/system"), "block");
  assert.equal(c("https://outro-site.com/admin/"), "block");
  assert.equal(c("http://inovasfood.com.br/admin/"), "block");
  assert.equal(c("lixo"), "block");
});

test("endereço do servidor: só https (ou http local para testes)", () => {
  assert.equal(m.normalizeServerUrl("https://inovasfood.com.br/qualquer"), "https://inovasfood.com.br");
  assert.equal(m.normalizeServerUrl("http://127.0.0.1:3000"), "http://127.0.0.1:3000");
  assert.equal(m.normalizeServerUrl("http://inovasfood.com.br"), null);
  assert.equal(m.normalizeServerUrl("https://user:pass@inovasfood.com.br"), null);
  assert.equal(m.normalizeServerUrl("javascript:alert(1)"), null);
  assert.equal(m.normalizeServerUrl(""), null);
});

test("renovação da sessão começa 2 h antes de expirar", () => {
  const now = Date.parse("2026-11-13T12:00:00Z");
  assert.equal(m.shouldRenewSession("2026-11-13T23:00:00Z", now), false);
  assert.equal(m.shouldRenewSession("2026-11-13T13:30:00Z", now), true);
  assert.equal(m.shouldRenewSession(null, now), true);
});

test("protocolo de imagens só aceita imagens do cardápio", () => {
  assert.equal(m.isCatalogImagePath("/site-images/combinado-sakura.webp"), true);
  assert.equal(m.isCatalogImagePath("/site-images/a/b.jpg"), true);
  assert.equal(m.isCatalogImagePath("/api/admin/finance"), false);
  assert.equal(m.isCatalogImagePath("/site-images/../api/x.png"), false);
  assert.equal(m.isCatalogImagePath("/admin/admin.js"), false);
});

test("iniciais do operador", () => {
  assert.equal(m.initialsOf("Ana Paula Souza"), "AS");
  assert.equal(m.initialsOf("Ana"), "AN");
  assert.equal(m.initialsOf(""), "?");
});

test("rotas dos módulos apontam para telas existentes do Gestor", () => {
  assert.equal(m.routeFor("pedidos").path, "/admin/?section=orders");
  assert.equal(m.routeFor("caixa", "fechamento").path, "/admin/caixa/fechamento");
  assert.equal(m.routeFor("caixa", "nao-existe").path, "/admin/caixa/salao");
  assert.equal(m.routeFor("cardapio"), null);
  for (const routes of Object.values(m.MODULE_ROUTES)) {
    for (const route of routes) {
      assert.equal(m.classifyGestorNavigation(`https://x.test${route.path}`, "https://x.test"), "allow", route.path);
    }
  }
});

test("cada tela do app diz qual seção do Gestor e qual tela do Caixa ela é", () => {
  for (const [moduleId, routes] of Object.entries(m.MODULE_ROUTES)) {
    for (const route of routes) {
      assert.ok(m.ALLOWED_GESTOR_SECTIONS.includes(route.section), `${moduleId}/${route.id}`);
      if (route.section === "cash-register") assert.ok(m.ALLOWED_CASH_VIEWS.includes(route.cashView), route.id);
      else assert.equal(route.cashView, "");
    }
  }
  assert.equal(m.routeFor("caixa", "abertura").cashView, "opening");
  assert.equal(m.routeFor("comandas").cashView, "floor");
});

test("troca de tela na página só aceita seções do app", () => {
  const script = m.buildInPageSwitchScript(m.routeFor("caixa", "fechamento"));
  assert.match(script, /data-admin-section="cash-register"/);
  assert.match(script, /setView\("closing"\)/);
  const orders = m.buildInPageSwitchScript(m.routeFor("pedidos"));
  assert.doesNotMatch(orders, /InovasCashRegister/);
  assert.throws(() => m.buildInPageSwitchScript({ section: "finance", cashView: "" }), /não permitida/);
  assert.throws(() => m.buildInPageSwitchScript({ section: "dashboard" }), /não permitida/);
  assert.throws(() => m.buildInPageSwitchScript({ section: "cash-register", cashView: '"); alert(1); ("' }), /inválida/);
});
