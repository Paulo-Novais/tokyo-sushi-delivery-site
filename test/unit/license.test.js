"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateLicense, formatCountdown } = require("../../src/shared/license");

const HOUR = 60 * 60 * 1000;
const T0 = Date.UTC(2026, 10, 17, 20);
const lease = { issuedAt: T0, expiresAt: T0 + 24 * HOUR };

test("com internet: sem contagem na tela", () => {
  const result = evaluateLicense({ lease, online: true, now: T0 + HOUR, lastSeenAt: T0 + HOUR });
  assert.equal(result.state, "online");
  assert.equal(result.blocked, false);
  assert.equal(result.label, "");
});

test("internet caiu: contagem regressiva a partir do último passe", () => {
  const result = evaluateLicense({ lease, online: false, now: T0 + 60000, lastSeenAt: T0 + 60000 });
  assert.equal(result.state, "offline");
  assert.equal(result.label, "23h59");
  assert.equal(result.level, "info");
});

test("avisos: menos de 12 h fica laranja, menos de 2 h fica vermelho", () => {
  assert.equal(evaluateLicense({ lease, online: false, now: T0 + 13 * HOUR }).level, "warn");
  assert.equal(evaluateLicense({ lease, online: false, now: T0 + 22.5 * HOUR }).level, "urgent");
  assert.equal(evaluateLicense({ lease, online: false, now: T0 + 22.5 * HOUR }).label, "1h30");
});

test("zerou: bloqueia (e o app faz logout)", () => {
  const result = evaluateLicense({ lease, online: false, now: T0 + 24 * HOUR });
  assert.equal(result.state, "expired");
  assert.equal(result.blocked, true);
  assert.equal(result.label, "0h00");
});

test("atrasar o relógio do Windows não dá mais tempo: bloqueia", () => {
  const result = evaluateLicense({ lease, online: false, now: T0 + HOUR, lastSeenAt: T0 + 20 * HOUR });
  assert.equal(result.state, "expired");
  assert.equal(result.reason, "clock");
});

test("pequena diferença de relógio (até 5 min) é tolerada e conta pelo maior horário", () => {
  const result = evaluateLicense({ lease, online: false, now: T0 + 10 * HOUR, lastSeenAt: T0 + 10 * HOUR + 2 * 60000 });
  assert.equal(result.state, "offline");
  assert.equal(result.label, "13h58");
});

test("sem passe (nunca conectou): bloqueado até conectar", () => {
  assert.equal(evaluateLicense({ lease: null, online: false, now: T0 }).state, "missing");
  assert.equal(evaluateLicense({ lease: null, online: true, now: T0 }).blocked, true);
});

test("formato da contagem", () => {
  assert.equal(formatCountdown(24 * HOUR), "24h00");
  assert.equal(formatCountdown(5 * 60000 + 59000), "0h05");
  assert.equal(formatCountdown(-1), "0h00");
});
