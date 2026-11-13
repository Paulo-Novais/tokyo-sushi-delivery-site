"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createCredentialStore } = require("../../src/main/credentials");

// safeStorage falso: "criptografa" invertendo os bytes e marca o prefixo.
const fakeSafeStorage = (available = true) => ({
  isAsyncEncryptionAvailable: async () => available,
  encryptStringAsync: async (text) => Buffer.concat([Buffer.from("ENC:"), Buffer.from(text).reverse()]),
  decryptStringAsync: async (buffer) => {
    if (!buffer.subarray(0, 4).equals(Buffer.from("ENC:"))) throw new Error("bad");
    return { result: Buffer.from(buffer.subarray(4)).reverse().toString(), shouldReEncrypt: false };
  },
});

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "pdv-cred-"));

test("guarda criptografado, lê de volta e apaga no Sair", async () => {
  const directory = tempDir();
  const store = createCredentialStore({ safeStorage: fakeSafeStorage(), directory });
  assert.equal(await store.save({ identifier: "ana", password: "segredo", server: "https://x.test" }), true);
  const raw = fs.readFileSync(path.join(directory, "login.bin"));
  assert.equal(raw.includes(Buffer.from("segredo")), false, "senha não pode ficar em texto puro");
  assert.deepEqual(await store.load(), { identifier: "ana", password: "segredo", restaurantKey: "", server: "https://x.test" });
  store.clear();
  assert.equal(await store.load(), null);
  assert.equal(store.exists(), false);
});

test("sem criptografia do sistema não grava nada", async () => {
  const directory = tempDir();
  const store = createCredentialStore({ safeStorage: fakeSafeStorage(false), directory });
  assert.equal(await store.save({ identifier: "ana", password: "segredo" }), false);
  assert.equal(fs.existsSync(path.join(directory, "login.bin")), false);
});

test("arquivo corrompido ou de outro usuário é descartado", async () => {
  const directory = tempDir();
  fs.writeFileSync(path.join(directory, "login.bin"), "lixo");
  const store = createCredentialStore({ safeStorage: fakeSafeStorage(), directory });
  assert.equal(await store.load(), null);
  assert.equal(store.exists(), false);
});

test("Linux sem chaveiro (basic_text) não guarda senha", { skip: process.platform !== "linux" }, async () => {
  const directory = tempDir();
  const safeStorage = { ...fakeSafeStorage(), getSelectedStorageBackend: () => "basic_text" };
  const store = createCredentialStore({ safeStorage, directory });
  assert.equal(await store.isAvailable(), false);
  assert.equal(await store.save({ identifier: "a", password: "b" }), false);
});
