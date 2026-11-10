const assert = require("node:assert/strict");
const test = require("node:test");

const {
  translateRestaurantPermissionsForLegacyUi,
} = require("../../lib/admin-api.cjs");
const {
  RESTAURANT_PERMISSION_DEFINITIONS,
  RESTAURANT_ROLE_DEFINITIONS,
} = require("../../lib/access-policy.cjs");

test("restaurant menu catalog exposes every administrative visibility option", () => {
  const navigation = RESTAURANT_PERMISSION_DEFINITIONS.filter(
    (permission) => permission.module === "navigation"
  );

  assert.equal(navigation.length, 25);
  assert.equal(new Set(navigation.map((permission) => permission.key)).size, 25);
  assert.ok(navigation.every((permission) => permission.domain === "RESTAURANT"));
});

test("OWNER receives the complete Tokyo operational menu model", () => {
  const permissions = translateRestaurantPermissionsForLegacyUi(
    RESTAURANT_ROLE_DEFINITIONS.OWNER.permissions,
    { cash_register_view: false, catalog_view: false }
  );

  for (const permission of [
    "dashboard_view",
    "cash_register_view",
    "orders_view",
    "catalog_view",
    "inventory_view",
    "financial_view",
    "reports_view",
    "settings_view",
    "users_view",
  ]) {
    assert.equal(permissions[permission], true, permission);
  }
  assert.equal(permissions.menu_visibility_enforced, true);
  assert.equal(permissions.menu_dashboard_view, true);
  assert.equal(permissions.menu_integrations_view, true);
});

test("restaurant roles keep their own operational restrictions", () => {
  const kitchen = translateRestaurantPermissionsForLegacyUi(
    RESTAURANT_ROLE_DEFINITIONS.KITCHEN.permissions,
    { cash_register_view: true }
  );

  assert.equal(kitchen.orders_view, true);
  assert.equal(kitchen.catalog_view, true);
  assert.equal(kitchen.cash_register_view, false);
  assert.equal(kitchen.users_view, false);
  assert.equal(kitchen.menu_production_view, true);
  assert.equal(kitchen.menu_cash_register_view, false);
});

test("Operador sees only Painel, Caixa and Pedidos in the restaurant menu", () => {
  const permissions = translateRestaurantPermissionsForLegacyUi(
    RESTAURANT_ROLE_DEFINITIONS.OPERATOR.permissions
  );

  assert.equal(permissions.menu_dashboard_view, true);
  assert.equal(permissions.menu_cash_register_view, true);
  assert.equal(permissions.menu_orders_view, true);
  assert.equal(permissions.menu_catalog_view, false);
  assert.equal(permissions.menu_financial_view, false);
});

test("Garçom receives Painel, Pedidos, Mesas e Salão without unrelated menus", () => {
  const permissions = translateRestaurantPermissionsForLegacyUi(
    RESTAURANT_ROLE_DEFINITIONS.WAITER.permissions
  );

  assert.equal(permissions.menu_dashboard_view, true);
  assert.equal(permissions.menu_orders_view, true);
  assert.equal(permissions.menu_tables_view, true);
  assert.equal(permissions.menu_dining_room_view, true);
  assert.equal(permissions.menu_cash_register_view, false);
  assert.equal(permissions.menu_catalog_view, false);
});

test("legacy policies preserve their previous menu until visibility is configured", () => {
  const permissions = translateRestaurantPermissionsForLegacyUi([
    "tenant.dashboard.view",
    "tenant.orders.view",
  ]);

  assert.equal(permissions.menu_visibility_enforced, false);
  assert.equal(permissions.dashboard_view, true);
  assert.equal(permissions.orders_view, true);
});
