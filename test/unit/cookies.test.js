"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createMemoryCookieStore, parseSetCookie } = require("../../src/main/cookies");

test("lê o cookie de sessão do Gestor", () => {
  const now = 1_000_000;
  const cookie = parseSetCookie(
    "inovas_restaurant_session=abc.def; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200",
    now
  );
  assert.equal(cookie.name, "inovas_restaurant_session");
  assert.equal(cookie.value, "abc.def");
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.secure, true);
  assert.equal(cookie.sameSite, "lax");
  assert.equal(cookie.expiresAt, now + 43200 * 1000);
  assert.equal(cookie.remove, false);
});

test("Max-Age=0 apaga o cookie", () => {
  assert.equal(parseSetCookie("inovas_support_context=; Path=/; HttpOnly; Max-Age=0").remove, true);
});

test("cofre em memória guarda, substitui e apaga", async () => {
  const store = createMemoryCookieStore();
  await store.storeSetCookies("https://x.test/", ["a=1; Path=/; Max-Age=60", "b=2; Path=/; Max-Age=60"]);
  assert.equal(await store.getCookieHeader("https://x.test/"), "a=1; b=2");
  await store.storeSetCookies("https://x.test/", ["a=3; Path=/; Max-Age=60", "b=; Path=/; Max-Age=0"]);
  assert.equal(await store.getCookieHeader("https://x.test/"), "a=3");
  await store.clear();
  assert.equal(await store.getCookieHeader("https://x.test/"), "");
});
