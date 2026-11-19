"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createSiteWatcher, fingerprintOf, shouldReloadNow } = require("../../src/main/site-watch");

const response = (headers, ok = true) => ({ ok, headers: { get: (name) => headers[name.toLowerCase()] || null } });

test("usa ETag (ignorando W/) e, sem ele, Last-Modified", () => {
  assert.equal(fingerprintOf(response({ etag: 'W/"abc"' })), 'etag:"abc"');
  assert.equal(fingerprintOf(response({ "last-modified": "Thu, 19 Nov 2026 10:00:00 GMT" })), "modified:Thu, 19 Nov 2026 10:00:00 GMT");
  assert.equal(fingerprintOf(response({})), "");
});

test("avisa só quando o site muda depois da primeira leitura", async () => {
  let etag = '"v1"';
  const calls = [];
  let changes = 0;
  const watcher = createSiteWatcher({
    fetchImpl: async (url, options) => {
      calls.push([url, options.method]);
      return response({ etag });
    },
    getUrl: () => "https://inovasfood.com.br/admin/admin.js",
    onChange: () => {
      changes += 1;
    },
  });
  assert.equal(await watcher.check(), false); // primeira leitura vira a base
  assert.equal(await watcher.check(), false); // nada mudou
  etag = '"v2"';
  assert.equal(await watcher.check(), true); // publicado de novo
  assert.equal(await watcher.check(), false); // já avisado
  assert.equal(changes, 1);
  assert.deepEqual(calls[0], ["https://inovasfood.com.br/admin/admin.js", "HEAD"]);
});

test("sem login (sem URL), erro de rede ou resposta ruim não avisa", async () => {
  let changes = 0;
  const onChange = () => {
    changes += 1;
  };
  const noUrl = createSiteWatcher({ fetchImpl: async () => response({ etag: "x" }), getUrl: () => "", onChange });
  assert.equal(await noUrl.check(), false);
  const offline = createSiteWatcher({ fetchImpl: async () => { throw new Error("sem internet"); }, getUrl: () => "u", onChange });
  assert.equal(await offline.check(), false);
  const bad = createSiteWatcher({ fetchImpl: async () => response({ etag: "x" }, false), getUrl: () => "u", onChange });
  assert.equal(await bad.check(), false);
  assert.equal(changes, 0);
});

test("recarrega só com operador parado (ou tela do Gestor escondida)", () => {
  const now = 1_000_000;
  assert.equal(shouldReloadNow({ pending: false, lastInputAt: 0, now }), false);
  assert.equal(shouldReloadNow({ pending: true, lastInputAt: now - 5_000, now }), false);
  assert.equal(shouldReloadNow({ pending: true, lastInputAt: now - 61_000, now }), true);
  assert.equal(shouldReloadNow({ pending: true, lastInputAt: now - 5_000, now, gestorVisible: false }), true);
});
