"use strict";

// Botão "Atualizar" do app, contra um servidor local que imita o Release
// gestor-pdv do GitHub. No teste o instalador é baixado e conferido, mas não é
// executado (INOVAS_PDV_UPDATE_DRY_RUN=1, só fora do app empacotado).

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { _electron: electron } = require("playwright-core");
const { buildManifest } = require("../../src/main/updater");
const { version: currentVersion } = require("../../package.json");

const APP_DIR = path.resolve(__dirname, "..", "..");
const payload = crypto.randomBytes(512 * 1024);

const startFeed = (version, data = payload) =>
  new Promise((resolve) => {
    const manifest = buildManifest({
      version,
      fileName: "INOVAS-PDV-Setup.exe",
      sha512: crypto.createHash("sha512").update(payload).digest("base64"),
      size: payload.length,
    });
    const server = http.createServer((req, res) => {
      const url = req.url.split("?")[0];
      if (url === "/gestor-pdv/latest.yml") return res.end(manifest);
      if (url === "/gestor-pdv/INOVAS-PDV-Setup.exe") {
        res.writeHead(200, { "Content-Length": data.length });
        return res.end(data);
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });

const launch = async (server) => {
  const app = await electron.launch({
    executablePath: require("electron"),
    args: [APP_DIR, "--no-sandbox", "--password-store=basic"],
    env: {
      ...process.env,
      // Servidor do Gestor inexistente: o teste não precisa de login.
      INOVAS_PDV_SERVER: "http://127.0.0.1:9",
      INOVAS_PDV_USER_DATA: fs.mkdtempSync(path.join(os.tmpdir(), "pdv-upd-e2e-")),
      INOVAS_PDV_WINDOW_SIZE: "1366x768",
      INOVAS_PDV_UPDATE_URL: `http://127.0.0.1:${server.address().port}/gestor-pdv`,
      INOVAS_PDV_UPDATE_FIRST_CHECK_MS: "300",
      INOVAS_PDV_UPDATE_DRY_RUN: "1",
    },
  });
  const win = await app.firstWindow();
  return { app, win };
};

const appState = (win) => win.evaluate(() => window.pdv.getState());

const waitUpdate = async (win, status, timeout = 20000) => {
  const end = Date.now() + timeout;
  let state;
  while (Date.now() < end) {
    state = await appState(win);
    if (state.update.status === status) return state;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Atualização não chegou em "${status}". Último estado: ${JSON.stringify(state?.update)}`);
};

test("versão nova aparece, o operador confirma e o app baixa e confere o instalador", async () => {
  const server = await startFeed("9.9.9");
  const { app, win } = await launch(server);
  try {
    // Sem servidor do Gestor o app fica na tela de "sem conexão"; o aviso de
    // atualização também precisa funcionar ali e na tela de login.
    const state = await waitUpdate(win, "available");
    assert.equal(state.update.latestVersion, "9.9.9");
    assert.equal(state.version, currentVersion);

    // Força a tela de login para ver o botão (o app não tem servidor aqui).
    await win.evaluate(() => (document.body.dataset.phase = "login"));
    await win.waitForSelector("#login-update:not([hidden])");
    assert.equal(await win.textContent("#login-update"), "Atualizar para 9.9.9");

    await win.click("#login-update");
    await win.waitForSelector("#confirm-update[open]");
    assert.equal(await win.textContent("#confirm-update-version"), "9.9.9");
    await win.click('#confirm-update button[value="ok"]');

    const done = await waitUpdate(win, "ready");
    assert.equal(done.update.progress, 100);
    assert.ok(fs.readFileSync(done.update.message).equals(payload), "instalador baixado é o publicado");
  } finally {
    await app.close();
    server.close();
  }
});

test("'Verificar atualização' avisa quando já está na versão mais recente", async () => {
  const server = await startFeed(currentVersion);
  const { app, win } = await launch(server);
  try {
    await win.evaluate(() => (document.body.dataset.phase = "login"));
    await win.click(".login-foot [data-update-check]");
    await win.waitForFunction(() => /versão mais recente/.test(document.querySelector("#toast").textContent));
    assert.equal((await appState(win)).update.status, "uptodate");
    assert.equal(await win.isHidden("#login-update"), true);
  } finally {
    await app.close();
    server.close();
  }
});

test("arquivo adulterado no servidor não é instalado", async () => {
  const tampered = Buffer.from(payload);
  tampered[0] ^= 0xff;
  const server = await startFeed("9.9.9", tampered);
  const { app, win } = await launch(server);
  try {
    await waitUpdate(win, "available");
    await win.evaluate(() => window.pdv.installUpdate());
    const state = await appState(win);
    assert.equal(state.update.status, "error");
    assert.match(state.update.message, /não confere/);
  } finally {
    await app.close();
    server.close();
  }
});
