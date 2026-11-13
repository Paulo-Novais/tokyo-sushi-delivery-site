"use strict";

const fs = require("node:fs");
const path = require("node:path");

// "Manter conectado neste computador" (ponte até a sessão de dispositivo da fase 3).
//
// Hoje o servidor encerra a sessão em 12 h e o site não pode ser alterado agora.
// Para o app não deslogar sozinho, ele guarda o login criptografado pelo
// sistema operacional (Windows: DPAPI, ligado ao usuário do Windows; macOS:
// Keychain; Linux: chaveiro do sistema) e renova a sessão em silêncio.
// Sem criptografia do sistema disponível, NADA é gravado e o app volta a pedir
// a senha quando a sessão expirar.
//
// Sair apaga este arquivo. Quando a fase 3 (token de dispositivo) existir, este
// módulo deve ser trocado pelo token e a senha deixa de ser guardada.

const createCredentialStore = ({ safeStorage, directory, fileName = "login.bin", allowBasicText = false }) => {
  const filePath = path.join(directory, fileName);

  const isAvailable = async () => {
    try {
      if (!safeStorage) return false;
      // No Linux sem chaveiro, o Electron usa uma chave fixa ("basic_text"):
      // isso não protege nada, então não guardamos a senha.
      if (
        process.platform === "linux" &&
        typeof safeStorage.getSelectedStorageBackend === "function" &&
        safeStorage.getSelectedStorageBackend() === "basic_text" &&
        !allowBasicText
      ) {
        return false;
      }
      if (typeof safeStorage.isAsyncEncryptionAvailable === "function") {
        return Boolean(await safeStorage.isAsyncEncryptionAvailable());
      }
      return Boolean(safeStorage.isEncryptionAvailable());
    } catch {
      return false;
    }
  };

  const encrypt = (text) =>
    typeof safeStorage.encryptStringAsync === "function"
      ? safeStorage.encryptStringAsync(text)
      : Promise.resolve(safeStorage.encryptString(text));

  const decrypt = async (buffer) => {
    if (typeof safeStorage.decryptStringAsync === "function") {
      const { result } = await safeStorage.decryptStringAsync(buffer);
      return result;
    }
    return safeStorage.decryptString(buffer);
  };

  const clear = () => {
    try {
      fs.rmSync(filePath, { force: true });
    } catch {
      // ignora
    }
  };

  const save = async ({ identifier, password, restaurantKey = "", server = "" }) => {
    if (!(await isAvailable())) return false;
    const payload = JSON.stringify({ v: 1, identifier, password, restaurantKey, server, savedAt: new Date().toISOString() });
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(filePath, await encrypt(payload), { mode: 0o600 });
    return true;
  };

  const load = async () => {
    if (!fs.existsSync(filePath) || !(await isAvailable())) return null;
    try {
      const data = JSON.parse(await decrypt(fs.readFileSync(filePath)));
      if (!data || !data.identifier || !data.password) return null;
      return {
        identifier: data.identifier,
        password: data.password,
        restaurantKey: data.restaurantKey || "",
        server: data.server || "",
      };
    } catch {
      // Arquivo de outro usuário do Windows ou corrompido: descarta.
      clear();
      return null;
    }
  };

  const exists = () => fs.existsSync(filePath);

  return { clear, exists, isAvailable, load, save };
};

module.exports = { createCredentialStore };
