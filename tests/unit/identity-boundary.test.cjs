const assert = require("node:assert/strict");
const test = require("node:test");

const {
  normalizeUserScope,
} = require("../../lib/user-permissions.cjs");
const {
  buildLoginCookieHeaders,
} = require("../../lib/domain-auth-api.cjs");

test("roles never infer whether an identity belongs to System or a restaurant", () => {
  assert.equal(normalizeUserScope("", "MASTER", false), "UNASSIGNED");
  assert.equal(normalizeUserScope("", "COMERCIAL", false), "UNASSIGNED");
  assert.equal(normalizeUserScope("", "OWNER", false), "UNASSIGNED");
});

test("only explicit domain markers resolve an identity environment", () => {
  assert.equal(normalizeUserScope("SYSTEM", "CUSTOM", false), "SYSTEM");
  assert.equal(
    normalizeUserScope("RESTAURANT", "MASTER", false),
    "RESTAURANT"
  );
  assert.equal(normalizeUserScope("", "CUSTOM", true), "SYSTEM");
});

test("login preserves the session cookie from the opposite domain", () => {
  const req = {
    headers: {
      host: "inovasfood.com.br",
      "x-forwarded-proto": "https",
    },
  };
  const systemHeaders = buildLoginCookieHeaders("system", "system-token", req);
  const restaurantHeaders = buildLoginCookieHeaders(
    "restaurant",
    "restaurant-token",
    req
  );

  assert.match(systemHeaders.join("\n"), /inovas_system_session=/);
  assert.doesNotMatch(systemHeaders.join("\n"), /inovas_restaurant_session=/);
  assert.match(restaurantHeaders.join("\n"), /inovas_restaurant_session=/);
  assert.doesNotMatch(restaurantHeaders.join("\n"), /inovas_system_session=/);
});
