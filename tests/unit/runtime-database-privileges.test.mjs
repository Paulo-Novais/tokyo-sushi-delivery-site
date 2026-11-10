import assert from "node:assert/strict";
import test from "node:test";

import {
  runtimeReferencedTables,
  runtimeTablePrivileges,
} from "../../scripts/runtime-database-privileges.mjs";

const RBAC_TABLES = [
  "permission_definitions",
  "permission_overrides",
  "restaurant_role_bindings",
  "role_definitions",
  "role_permission_bindings",
  "system_role_bindings",
];

test("runtime can read every persisted RBAC relation", () => {
  for (const table of RBAC_TABLES) {
    assert.ok(runtimeReferencedTables.includes(table), `${table} is referenced`);
    assert.ok(runtimeTablePrivileges[table].includes("SELECT"), `${table} is readable`);
  }
});

test("permission catalog remains read-only for the runtime", () => {
  assert.deepEqual(runtimeTablePrivileges.permission_definitions, ["SELECT"]);
});
