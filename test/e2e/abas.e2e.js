"use strict";

// Bug de 13/11/2026: no app, Caixa e Comandas ficavam em "Carregando modulo",
// o app voltava sozinho para Pedidos (mostrando os KPIs fixos do Gestor) e
// Pedidos recarregava do zero a cada troca de aba.
// Só acontecia com a sessão do Gestor lenta (Production). Aqui a resposta de
// /api/admin/session é atrasada de propósito para reproduzir.
//
// Como rodar: veja test/e2e/app.e2e.js (servidor local do site + seed).

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { _electron: electron } = require("playwright-core");
const { seed, BASE } = require("./seed-local-gestor");

const APP_DIR = path.resolve(__dirname, "..", "..");
const SESSION_DELAY_MS = 2500;
let data;

const launch = async () => {
  const app = await electron.launch({
    executablePath: require("electron"),
    args: [APP_DIR, "--no-sandbox", "--password-store=basic"],
    env: {
      ...process.env,
      INOVAS_PDV_SERVER: BASE,
      INOVAS_PDV_USER_DATA: fs.mkdtempSync(path.join(os.tmpdir(), "pdv-abas-")),
      INOVAS_PDV_WINDOW_SIZE: "1366x768",
      INOVAS_PDV_TEST_ALLOW_BASIC_STORE: "1",
    },
  });
  // Sessão do Gestor lenta, como em Production, e contador de recargas da tela do Gestor.
  await app.evaluate(({ app: electronApp, session }, delay) => {
    const s = session.fromPartition("persist:inovas-pdv");
    s.webRequest.onBeforeRequest({ urls: ["http://127.0.0.1/api/admin/session*"] }, (_details, callback) =>
      setTimeout(() => callback({}), delay)
    );
    globalThis.__gestorLoads = [];
    electronApp.on("web-contents-created", (_event, contents) => {
      contents.on("did-navigate", (_e, url) => {
        if (url.includes("/admin")) globalThis.__gestorLoads.push(url);
      });
    });
  }, SESSION_DELAY_MS);
  const win = await app.firstWindow();
  return { app, win };
};

const gestor = (app) =>
  app.evaluate(async ({ BrowserWindow }) => {
    const [view] = BrowserWindow.getAllWindows()[0].contentView.children;
    if (!view) return null;
    try {
      const page = await view.webContents.executeJavaScript(`(() => {
        const stats = document.querySelector("[data-admin-stats]");
        const statsVisible = stats && getComputedStyle(stats).display !== "none" ? stats.innerText : "";
        return {
          section: document.body ? document.body.dataset.adminSection : "",
          loading: /Carregando modulo/.test(document.body ? document.body.innerText : ""),
          kpis: /Faturamento|Ticket médio|Valor bruto vendido/.test(statsVisible),
          cashView: window.InovasCashRegister ? window.InovasCashRegister.getView() : "",
        };
      })()`);
      return { ...page, visible: view.getVisible(), url: view.webContents.getURL() };
    } catch {
      return { visible: view.getVisible(), url: view.webContents.getURL() };
    }
  });

const activeMenu = (win) => win.getAttribute('.nav-item[aria-current="page"]', "data-module");
const loads = (app) => app.evaluate(() => globalThis.__gestorLoads.length);

// Espera a condição e, durante a espera, confere que o app não voltou sozinho
// para outro módulo nem mostrou os KPIs do painel.
const settle = async (app, win, expected, check, { timeout = 15000, stableMs = 3500 } = {}) => {
  const end = Date.now() + timeout;
  let okSince = 0;
  let last;
  while (Date.now() < end) {
    const menu = await activeMenu(win);
    last = await gestor(app);
    assert.equal(menu, expected, `menu ativo mudou sozinho para ${menu} (esperado ${expected})`);
    assert.ok(!last?.kpis, "KPIs do painel do Gestor apareceram no app");
    if (check(last)) {
      okSince ||= Date.now();
      if (Date.now() - okSince >= stableMs) return last;
    } else {
      okSince = 0;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Módulo ${expected} não carregou. Último estado: ${JSON.stringify(last)}`);
};

const cashLoaded = (g) => g && g.visible && g.section === "cash-register" && !g.loading;
const ordersLoaded = (g) => g && g.visible && g.section === "orders" && !g.loading;

test.before(async () => {
  data = await seed();
});

for (const who of ["owner", "cashier"]) {
  test(`${who}: Caixa e Comandas abrem com a sessão lenta e não voltam sozinhos para Pedidos`, async () => {
    const user =
      who === "owner" ? { login: data.a.ownerLogin, password: data.a.ownerPassword } : data.a.cashier;
    const { app, win } = await launch();
    try {
      await win.waitForSelector('body[data-phase="login"]', { timeout: 20000 });
      await win.fill("#identifier", user.login);
      await win.fill("#password", user.password);
      await win.click("#login-submit");
      await win.waitForSelector('body[data-phase="app"]', { timeout: 20000 });
      await settle(app, win, "pedidos", ordersLoaded);

      await win.click('[data-module="caixa"]');
      await settle(app, win, "caixa", cashLoaded);

      await win.click('[data-module="comandas"]');
      const comandas = await settle(app, win, "comandas", cashLoaded);
      assert.equal(comandas.cashView, "floor");
    } finally {
      await app.close();
    }
  });
}

test("Pedidos → Caixa → Comandas → Cardápio → Pedidos sem recarregar a tela do Gestor", async () => {
  const { app, win } = await launch();
  try {
    await win.waitForSelector('body[data-phase="login"]', { timeout: 20000 });
    await win.fill("#identifier", data.a.ownerLogin);
    await win.fill("#password", data.a.ownerPassword);
    await win.click("#login-submit");
    await win.waitForSelector('body[data-phase="app"]', { timeout: 20000 });
    await settle(app, win, "pedidos", ordersLoaded);
    const before = await loads(app);

    await win.click('[data-module="caixa"]');
    await settle(app, win, "caixa", cashLoaded, { stableMs: 1500 });
    await win.click('.step[data-route="fechamento"]');
    await settle(app, win, "caixa", (g) => cashLoaded(g) && g.cashView === "closing", { stableMs: 1000 });
    await win.click('[data-module="comandas"]');
    await settle(app, win, "comandas", (g) => cashLoaded(g) && g.cashView === "floor", { stableMs: 1000 });

    await win.click('[data-module="cardapio"]');
    await win.waitForSelector("#cardapio:not([hidden])");
    assert.equal(await activeMenu(win), "cardapio");
    assert.equal((await gestor(app)).visible, false);

    await win.click('[data-module="pedidos"]');
    await settle(app, win, "pedidos", ordersLoaded, { stableMs: 1500 });

    assert.equal(await loads(app), before, "a tela do Gestor foi recarregada ao trocar de aba");
  } finally {
    await app.close();
  }
});
