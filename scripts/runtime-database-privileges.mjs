export const runtimeTablePrivileges = Object.freeze({
  admin_users: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  auth_sessions: ["SELECT", "INSERT", "UPDATE"],
  cash_payment_sets: ["SELECT", "INSERT"],
  cash_payments: ["SELECT", "INSERT"],
  cash_register_audit_events: ["SELECT", "INSERT"],
  cash_register_movements: ["SELECT", "INSERT"],
  cash_register_sessions: ["SELECT", "INSERT", "UPDATE"],
  cash_register_table_assignments: ["SELECT", "INSERT"],
  catalog_item_overrides: ["SELECT", "DELETE"],
  catalog_promotions: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  catalog_runtime_state: ["SELECT", "INSERT", "UPDATE"],
  customer_crm_profiles: ["SELECT", "INSERT", "UPDATE"],
  customer_reviews: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  customers: ["SELECT", "INSERT", "UPDATE"],
  delivery_settings: ["SELECT", "INSERT", "UPDATE"],
  dining_order_batches: ["SELECT", "INSERT"],
  dining_tab_items: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  dining_tables: ["SELECT", "INSERT", "UPDATE"],
  dining_tabs: ["SELECT", "INSERT", "UPDATE"],
  finance_closings: ["SELECT", "INSERT", "UPDATE"],
  identities: ["SELECT", "INSERT", "UPDATE"],
  inventory_runtime_state: ["SELECT", "INSERT", "UPDATE"],
  master_platform_state: ["SELECT", "INSERT", "UPDATE"],
  order_items: ["SELECT", "INSERT"],
  order_status_events: ["SELECT", "INSERT"],
  orders: ["SELECT", "INSERT", "UPDATE"],
  permission_definitions: ["SELECT"],
  permission_overrides: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  platform_health_snapshots: ["INSERT"],
  public_restaurant_routes: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  restaurant_memberships: ["SELECT", "INSERT", "UPDATE"],
  restaurant_role_bindings: ["SELECT", "INSERT", "UPDATE"],
  restaurant_settings: ["SELECT", "INSERT", "UPDATE"],
  role_definitions: ["SELECT", "INSERT", "UPDATE"],
  role_permission_bindings: ["SELECT", "INSERT", "DELETE"],
  system_principals: ["SELECT", "INSERT", "UPDATE"],
  system_role_bindings: ["SELECT", "INSERT", "UPDATE"],
  system_support_sessions: ["SELECT", "INSERT", "UPDATE"],
  tenant_health_scores: ["SELECT", "INSERT", "UPDATE"],
  user_audit_events: ["INSERT"],
});

export const runtimeSequencePrivileges = Object.freeze({});
export const runtimeFunctionPrivileges = Object.freeze({});

export const runtimeReferencedTables = Object.freeze(
  Object.keys(runtimeTablePrivileges).sort()
);
