const assert = require("node:assert/strict");
const test = require("node:test");

const {
  hasSystemMasterIntegrity,
} = require("../../lib/access-policy-store.cjs");

test("rejects a partially seeded MASTER policy", () => {
  assert.equal(
    hasSystemMasterIntegrity([
      {
        key: "MASTER",
        permissions: [
          "system.integrations.view",
          "system.integrations.manage",
          "system.roles.view",
          "system.roles.manage",
        ],
      },
    ]),
    false
  );
});

test("accepts the critical MASTER permission set", () => {
  assert.equal(
    hasSystemMasterIntegrity([
      {
        key: "MASTER",
        permissions: [
          "system.dashboard.view",
          "system.users.view",
          "system.users.manage",
          "system.roles.view",
          "system.roles.manage",
        ],
      },
    ]),
    true
  );
});
