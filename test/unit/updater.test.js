"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { compareVersions, createUpdater, validateManifest } = require("../../src/main/updater");

const installer = Buffer.from("instalador de teste INOVAS PDV");
const goodManifest = (version = "0.3.0", data = installer) => ({
  version,
  sha256: crypto.createHash("sha256").update(data).digest("hex"),
  size: data.length,
  file: "INOVAS-PDV-Setup.exe",
});

const fakeFetch = (manifest, data = installer) => {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    if (url.includes("versao.json")) {
      return { ok: true, json: async () => manifest };
    }
    return { ok: true, body: new Blob([data]).stream() };
  };
  impl.calls = calls;
  return impl;
};

const fakeSpawn = () => {
  const calls = [];
  const impl = (file, args) => {
    calls.push({ file, args });
    return { unref() {} };
  };
  impl.calls = calls;
  return impl;
};

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "pdv-update-"));

test("compara versões", () => {
  assert.ok(compareVersions("0.3.0", "0.2.0") > 0);
  assert.ok(compareVersions("0.10.0", "0.9.9") > 0);
  assert.equal(compareVersions("0.2.0", "0.2.0"), 0);
  assert.ok(compareVersions("0.1.9", "0.2.0") < 0);
  assert.equal(compareVersions("lixo", "0.2.0"), 0, "versão inválida nunca é mais nova");
});

test("versao.json inválido é recusado", () => {
  assert.equal(validateManifest(null), null);
  assert.equal(validateManifest({ ...goodManifest(), sha256: "abc" }), null);
  assert.equal(validateManifest({ ...goodManifest(), version: "nova" }), null);
  assert.equal(validateManifest({ ...goodManifest(), file: "../../evil.exe" }), null);
  assert.equal(validateManifest({ ...goodManifest(), size: 0 }), null);
  assert.ok(validateManifest(goodManifest()));
});

test("versão nova: baixa, confere e avisa; Atualizar agora roda o instalador silencioso e reabre", async () => {
  const changes = [];
  const spawn = fakeSpawn();
  const dir = tempDir();
  const updater = createUpdater({
    currentVersion: "0.2.0",
    downloadDir: dir,
    enabled: true,
    fetchImpl: fakeFetch(goodManifest("0.3.0")),
    spawnImpl: spawn,
    onChange: (state) => changes.push(state),
  });
  const state = await updater.check();
  assert.deepEqual(state, { version: "0.3.0", visible: true, phase: "ready", progress: 100 });
  assert.deepEqual(changes.at(-1), { version: "0.3.0", visible: true, phase: "ready", progress: 100 });
  // Durante o download a tela recebeu o progresso.
  assert.ok(changes.some((change) => change?.phase === "downloading"));
  assert.equal(updater.installNow(), true);
  assert.equal(spawn.calls.length, 1);
  assert.deepEqual(spawn.calls[0].args, ["/S", "--updated", "--force-run"]);
  assert.equal(fs.readFileSync(spawn.calls[0].file, "utf8"), installer.toString());
  assert.equal(updater.installOnQuit(), false, "não roda o instalador duas vezes");
});

test("Mais tarde: esconde o aviso e instala ao fechar (obrigatória)", async () => {
  let clock = 1_000;
  const spawn = fakeSpawn();
  const updater = createUpdater({
    currentVersion: "0.2.0",
    downloadDir: tempDir(),
    enabled: true,
    fetchImpl: fakeFetch(goodManifest("0.2.1")),
    spawnImpl: spawn,
    now: () => clock,
  });
  await updater.check();
  assert.deepEqual(updater.later(), { version: "0.2.1", visible: false, phase: "ready", progress: 100 });
  clock += 3 * 60 * 60 * 1000;
  assert.deepEqual(updater.getState(), { version: "0.2.1", visible: true, phase: "ready", progress: 100 }, "aviso volta depois de um tempo");
  assert.equal(updater.installOnQuit(), true);
  assert.deepEqual(spawn.calls[0].args, ["/S", "--updated"], "ao fechar: instala sem reabrir");
});

test("mesma versão ou mais velha: nada acontece", async () => {
  for (const version of ["0.2.0", "0.1.9"]) {
    const fetchImpl = fakeFetch(goodManifest(version));
    const updater = createUpdater({ currentVersion: "0.2.0", downloadDir: tempDir(), enabled: true, fetchImpl, spawnImpl: fakeSpawn() });
    assert.equal(await updater.check(), null);
    assert.equal(fetchImpl.calls.length, 1, "não baixa instalador");
    assert.equal(updater.installOnQuit(), false);
  }
});

test("instalador que não confere com o SHA-256 é descartado", async () => {
  const dir = tempDir();
  const updater = createUpdater({
    currentVersion: "0.2.0",
    downloadDir: dir,
    enabled: true,
    fetchImpl: fakeFetch(goodManifest("0.3.0"), Buffer.from("arquivo adulterado!!!!!!!!!!!!")),
    spawnImpl: fakeSpawn(),
  });
  assert.equal(await updater.check(), null);
  assert.deepEqual(fs.readdirSync(dir), [], "arquivo ruim é apagado");
  assert.equal(updater.installNow(), false);
});

test("desligado (fora do Windows instalado): não consulta nada", async () => {
  const fetchImpl = fakeFetch(goodManifest("9.9.9"));
  const updater = createUpdater({ currentVersion: "0.2.0", downloadDir: tempDir(), enabled: false, fetchImpl, spawnImpl: fakeSpawn() });
  assert.equal(await updater.check(), null);
  assert.equal(fetchImpl.calls.length, 0);
});

test("Verificar atualização: diz se já está na versão nova ou se deu erro", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pdv-upd-"));
  const same = createUpdater({ currentVersion: "0.3.0", downloadDir: dir, enabled: true, fetchImpl: fakeFetch(goodManifest("0.3.0")), spawnImpl: fakeSpawn() });
  assert.deepEqual(await same.checkNow(), { status: "uptodate" });
  const broken = createUpdater({ currentVersion: "0.3.0", downloadDir: dir, enabled: true, fetchImpl: async () => ({ ok: false, status: 404 }), spawnImpl: fakeSpawn() });
  assert.deepEqual(await broken.checkNow(), { status: "error" });
  const newer = createUpdater({ currentVersion: "0.3.0", downloadDir: dir, enabled: true, fetchImpl: fakeFetch(goodManifest("0.3.2")), spawnImpl: fakeSpawn() });
  const result = await newer.checkNow();
  assert.equal(result.status, "ready");
  assert.equal(result.update.version, "0.3.2");
  const off = createUpdater({ currentVersion: "0.3.0", downloadDir: dir, enabled: false });
  assert.deepEqual(await off.checkNow(), { status: "disabled" });
});
