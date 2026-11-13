"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const {
  DEFAULT_FEED_URL,
  buildManifest,
  compareVersions,
  createUpdater,
  normalizeFeedUrl,
  parseManifest,
} = require("../../src/main/updater");

const installer = crypto.randomBytes(256 * 1024);
const sha512 = (data) => crypto.createHash("sha512").update(data).digest("base64");

// Servidor local que imita o Release do GitHub (latest.yml + instalador).
const startServer = (routes) =>
  new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const route = routes[req.url.split("?")[0]];
      if (!route) {
        res.writeHead(404);
        res.end();
        return;
      }
      route(req, res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });

const feedFor = (server) => `http://127.0.0.1:${server.address().port}/gestor-pdv`;

const manifestFor = (data, version = "0.3.0") =>
  buildManifest({ version, fileName: "INOVAS-PDV-Setup.exe", sha512: sha512(data), size: data.length });

const serve = (manifest, data) => ({
  "/gestor-pdv/latest.yml": (_req, res) => res.end(manifest),
  "/gestor-pdv/INOVAS-PDV-Setup.exe": (_req, res) => {
    res.writeHead(200, { "Content-Length": data.length });
    res.end(data);
  },
});

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "pdv-upd-"));

test("latest.yml do electron-builder é lido e o gerado pelo app é válido", () => {
  const yml = [
    "version: 0.2.1",
    "files:",
    "  - url: INOVAS-PDV-Setup.exe",
    `    sha512: ${sha512(installer)}`,
    `    size: ${installer.length}`,
    "path: INOVAS-PDV-Setup.exe",
    `sha512: ${sha512(installer)}`,
    "releaseDate: '2026-11-13T18:00:00.000Z'",
  ].join("\n");
  assert.deepEqual(parseManifest(yml), {
    version: "0.2.1",
    fileName: "INOVAS-PDV-Setup.exe",
    sha512: sha512(installer),
    size: installer.length,
    releaseDate: "2026-11-13T18:00:00.000Z",
  });
  assert.equal(parseManifest(manifestFor(installer)).version, "0.3.0");
});

test("latest.yml malformado ou com arquivo suspeito é recusado", () => {
  const ok = manifestFor(installer);
  assert.throws(() => parseManifest(ok.replace("version: 0.3.0", "version: lixo")), { code: "bad_manifest" });
  assert.throws(() => parseManifest(ok.replaceAll("INOVAS-PDV-Setup.exe", "../../x.exe")), { code: "bad_manifest" });
  assert.throws(() => parseManifest(ok.replaceAll("INOVAS-PDV-Setup.exe", "setup.ps1")), { code: "bad_manifest" });
  assert.throws(() => parseManifest(ok.replace(/size: \d+/, "size: 0")), { code: "bad_manifest" });
});

test("comparação de versões", () => {
  assert.equal(compareVersions("0.2.0", "0.1.1"), 1);
  assert.equal(compareVersions("0.1.1", "0.1.1"), 0);
  assert.equal(compareVersions("0.1.10", "0.1.9"), 1);
  assert.equal(compareVersions("1.0.0", "0.99.99"), 1);
  assert.equal(compareVersions("0.1.0", "0.2.0"), -1);
});

test("só baixa do Release do GitHub (ou de servidor local nos testes)", () => {
  assert.equal(normalizeFeedUrl(DEFAULT_FEED_URL), DEFAULT_FEED_URL);
  assert.equal(normalizeFeedUrl("http://github.com/x"), null);
  assert.equal(normalizeFeedUrl("https://evil.example.com/x"), null);
  assert.equal(normalizeFeedUrl("http://127.0.0.1:9/x"), null);
  assert.equal(normalizeFeedUrl("http://127.0.0.1:9/x", { allowLocal: true }), "http://127.0.0.1:9/x");
  assert.throws(() => createUpdater({ feedUrl: "https://evil.example.com/x", currentVersion: "0.2.0" }), {
    code: "bad_feed",
  });
});

test("avisa quando há versão nova e não avisa quando já está atualizado", async () => {
  const server = await startServer(serve(manifestFor(installer, "0.3.0"), installer));
  try {
    const feedUrl = feedFor(server);
    const newer = createUpdater({ feedUrl, currentVersion: "0.2.0", downloadDir: tempDir(), allowLocal: true });
    assert.deepEqual(await newer.check(), { currentVersion: "0.2.0", latestVersion: "0.3.0", available: true });
    const same = createUpdater({ feedUrl, currentVersion: "0.3.0", downloadDir: tempDir(), allowLocal: true });
    assert.equal((await same.check()).available, false);
    const ahead = createUpdater({ feedUrl, currentVersion: "0.4.0", downloadDir: tempDir(), allowLocal: true });
    assert.equal((await ahead.check()).available, false, "nunca volta para versão mais antiga");
  } finally {
    server.close();
  }
});

test("baixa, confere sha512 e entrega o instalador", async () => {
  const server = await startServer(serve(manifestFor(installer), installer));
  try {
    const updater = createUpdater({ feedUrl: feedFor(server), currentVersion: "0.2.0", downloadDir: tempDir(), allowLocal: true });
    const progress = [];
    const result = await updater.download((value) => progress.push(value));
    assert.equal(result.version, "0.3.0");
    assert.ok(fs.readFileSync(result.filePath).equals(installer));
    assert.equal(progress.at(-1), 100);
  } finally {
    server.close();
  }
});

test("arquivo diferente do publicado (sha512) não é entregue", async () => {
  const tampered = Buffer.from(installer);
  tampered[10] ^= 0xff;
  const server = await startServer(serve(manifestFor(installer), tampered));
  const dir = tempDir();
  try {
    const updater = createUpdater({ feedUrl: feedFor(server), currentVersion: "0.2.0", downloadDir: dir, allowLocal: true });
    await assert.rejects(updater.download(), { code: "hash_mismatch" });
    assert.deepEqual(fs.readdirSync(dir), [], "nenhum arquivo fica na pasta");
  } finally {
    server.close();
  }
});

test("tamanho diferente do latest.yml é recusado", async () => {
  const server = await startServer(serve(manifestFor(installer), Buffer.concat([installer, Buffer.from("x")])));
  try {
    const updater = createUpdater({ feedUrl: feedFor(server), currentVersion: "0.2.0", downloadDir: tempDir(), allowLocal: true });
    await assert.rejects(updater.download(), { code: "size_mismatch" });
  } finally {
    server.close();
  }
});

test("redirecionamento para servidor não permitido é recusado", async () => {
  const fakeFetch = async (url) => ({
    ok: true,
    status: 200,
    url: "https://evil.example.com/latest.yml",
    text: async () => manifestFor(installer),
    headers: new Map(),
  });
  const updater = createUpdater({ currentVersion: "0.2.0", fetchImpl: fakeFetch, downloadDir: tempDir() });
  await assert.rejects(updater.check(), { code: "bad_host" });
});

test("sem internet vira erro 'offline'", async () => {
  const updater = createUpdater({
    currentVersion: "0.2.0",
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    },
    downloadDir: tempDir(),
  });
  await assert.rejects(updater.check(), { code: "offline" });
});
