"use strict";

// Gera dist/latest.yml para o botão "Atualizar" do app, a partir do instalador
// dist/INOVAS-PDV-Setup.exe e da versão do package.json.
// Publicar uma versão nova = trocar no Release "gestor-pdv" do GitHub:
//   INOVAS-PDV-Setup.exe e latest.yml
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { buildManifest, parseManifest } = require("../src/main/updater");

const root = path.resolve(__dirname, "..");
const { version } = require(path.join(root, "package.json"));
const fileName = "INOVAS-PDV-Setup.exe";
const installer = path.join(root, "dist", fileName);

if (!fs.existsSync(installer)) {
  console.error(`Instalador não encontrado: ${installer}. Rode npm run dist:win antes.`);
  process.exit(1);
}

const data = fs.readFileSync(installer);
const manifest = buildManifest({
  version,
  fileName,
  sha512: crypto.createHash("sha512").update(data).digest("base64"),
  size: data.length,
});
parseManifest(manifest); // confere o que foi gerado
fs.writeFileSync(path.join(root, "dist", "latest.yml"), manifest);
console.log(manifest);
