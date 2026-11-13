"use strict";

// Teste de ponta a ponta: abre o app de verdade (Electron) contra o servidor
// LOCAL de validação do site (scripts/local-validation-server.cjs), com
// restaurantes descartáveis criados pelo seed. Nunca usar Preview/Production.
//
// Como rodar (Linux):
//   1) no repositório do site:
//      E2E_ADMIN_LOGIN=master.e2e@local.test E2E_ADMIN_PASSWORD='<senha local qualquer>' node scripts/local-validation-server.cjs
//   2) aqui, com as mesmas E2E_ADMIN_LOGIN e E2E_ADMIN_PASSWORD: xvfb-run -a npm run test:e2e

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { _electron: electron } = require("playwright-core");
const { seed, BASE } = require("./seed-local-gestor");

const APP_DIR = path.resolve(__dirname, "..", "..");

let data;

const launch = async (userData, env = {}) => {
  const app = await electron.launch({
    executablePath: require("electron"),
    args: [APP_DIR, "--no-sandbox", "--password-store=basic"],
    env: {
      ...process.env,
      INOVAS_PDV_SERVER: BASE,
      INOVAS_PDV_USER_DATA: userData,
      INOVAS_PDV_WINDOW_SIZE: env.size || "1366x768",
      INOVAS_PDV_TEST_ALLOW_BASIC_STORE: "1",
      ...env,
    },
  });
  const win = await app.firstWindow();
  return { app, win };
};

const login = async (win, user, { remember = true } = {}) => {
  await win.waitForSelector('body[data-phase="login"]', { timeout: 20000 });
  await win.fill("#identifier", user.login);
  await win.fill("#password", user.password);
  if (!remember) await win.uncheck("#remember");
  await win.click("#login-submit");
};

// Lê a tela do Gestor que o app desenha por cima (WebContentsView).
const gestor = (app) =>
  app.evaluate(async ({ BrowserWindow }) => {
    const [view] = BrowserWindow.getAllWindows()[0].contentView.children;
    if (!view) return null;
    const contents = view.webContents;
    let sidebar = null;
    let section = null;
    try {
      sidebar = await contents.executeJavaScript(
        "(() => { const n = document.querySelector('.admin-sidebar'); return n ? getComputedStyle(n).display : 'none'; })()"
      );
      section = await contents.executeJavaScript("document.body ? document.body.dataset.adminSection : ''");
    } catch {
      // página ainda carregando
    }
    return { url: contents.getURL(), visible: view.getVisible(), bounds: view.getBounds(), sidebar, section };
  });

const waitFor = async (fn, { timeout = 15000, interval = 250, message = "condição" } = {}) => {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Tempo esgotado esperando ${message}. Último valor: ${JSON.stringify(last)}`);
};

const tempUserData = () => fs.mkdtempSync(path.join(os.tmpdir(), "pdv-e2e-"));

const restaurantSession = async (user) => {
  const response = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ identifier: user.login, password: user.password }),
  });
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .filter((pair) => !pair.endsWith("="))
    .join("; ");
  return async (pathname) => {
    const result = await fetch(`${BASE}${pathname}`, { headers: { Cookie: cookie } });
    return { status: result.status, body: await result.json().catch(() => ({})) };
  };
};

test.before(async () => {
  data = await seed();
});

test("CAIXA entra com o login do Gestor e vê só os 4 módulos, sem o menu do Gestor", async () => {
  const userData = tempUserData();
  const { app, win } = await launch(userData);
  try {
    await login(win, data.a.cashier);
    await win.waitForSelector('body[data-phase="app"]', { timeout: 20000 });
    assert.equal(await win.textContent("#top-restaurant"), "Restaurante A");
    assert.equal(await win.textContent("#op-role"), "Caixa");
    const labels = await win.$$eval("#nav-items .nav-item:not([disabled])", (nodes) => nodes.map((n) => n.dataset.module));
    assert.deepEqual(labels, ["pedidos", "caixa", "comandas", "cardapio"]);

    const pedidos = await waitFor(async () => {
      const info = await gestor(app);
      return info && info.section === "orders" && info.visible ? info : null;
    }, { message: "tela de Pedidos" });
    assert.match(pedidos.url, /\/admin\/\?section=orders$/);
    assert.equal(pedidos.sidebar, "none", "menu lateral do Gestor precisa ficar escondido");
    assert.ok(pedidos.bounds.x >= 72 && pedidos.bounds.y >= 56, "tela do Gestor fica dentro da área do app");

    await win.click('[data-module="caixa"]');
    const caixa = await waitFor(async () => {
      const info = await gestor(app);
      return info && /\/admin\/caixa\//.test(info.url) && info.section === "cash-register" ? info : null;
    }, { message: "tela do Caixa" });
    assert.equal(caixa.sidebar, "none");

    await win.click('[data-module="cardapio"]');
    await win.waitForSelector("#cd-message[data-tone='locked']");
    assert.match(await win.textContent("#cd-message"), /ainda não pode pausar/);
    const hidden = await gestor(app);
    assert.equal(hidden.visible, false, "tela do Gestor some no Cardápio");
  } finally {
    await app.close();
  }
});

test("app continua logado depois de fechar e abrir; renova sozinho quando a sessão expira; Sair desconecta", async () => {
  const userData = tempUserData();
  let { app, win } = await launch(userData);
  await login(win, data.a.cashier, { remember: true });
  await win.waitForSelector('body[data-phase="app"]', { timeout: 20000 });
  await app.close();

  // Reabre: entra direto, sem pedir senha.
  ({ app, win } = await launch(userData, { INOVAS_PDV_SESSION_CHECK_MS: "1500" }));
  try {
    await win.waitForSelector('body[data-phase="app"]', { timeout: 20000 });
    assert.equal(await win.textContent("#op-role"), "Caixa");

    // Simula as 12 h do servidor passando: apaga o cookie da sessão.
    await app.evaluate(async ({ session }) => {
      const s = session.fromPartition("persist:inovas-pdv");
      for (const cookie of await s.cookies.get({})) {
        await s.cookies.remove(`http://${cookie.domain}`, cookie.name).catch(() => {});
        await s.cookies.remove("http://127.0.0.1:3000", cookie.name).catch(() => {});
      }
    });
    await waitFor(
      () =>
        app.evaluate(async ({ session }) =>
          (await session.fromPartition("persist:inovas-pdv").cookies.get({ name: "inovas_restaurant_session" })).length > 0
        ),
      { message: "o app renovar a sessão em silêncio" }
    );
    assert.equal(await win.getAttribute("body", "data-phase"), "app", "não pode cair no login");

    // Sair: confirma e volta para o login.
    await win.click("#logout");
    await win.click('#confirm-logout button[value="ok"]');
    await win.waitForSelector('body[data-phase="login"]');
    assert.equal(fs.existsSync(path.join(userData, "login.bin")), false, "login guardado precisa ser apagado");
  } finally {
    await app.close();
  }

  // Depois de Sair, reabrir pede login.
  ({ app, win } = await launch(userData));
  try {
    await win.waitForSelector('body[data-phase="login"]', { timeout: 20000 });
  } finally {
    await app.close();
  }
});

test("senha errada mostra erro e equipe INOVAS (System) não entra no app", async () => {
  const { app, win } = await launch(tempUserData());
  try {
    await login(win, { login: data.a.cashier.login, password: "senha-errada-123" });
    await win.waitForSelector("#login-feedback:not([hidden])");
    assert.match(await win.textContent("#login-feedback"), /inválidos/);

    await win.fill("#identifier", data.master.login);
    await win.fill("#password", data.master.password);
    await win.click("#login-submit");
    await waitFor(async () => /equipe do restaurante/.test(await win.textContent("#login-feedback")), {
      message: "recusa do usuário System",
    });
    assert.equal(await win.getAttribute("body", "data-phase"), "login");
  } finally {
    await app.close();
  }
});

test("seção fora do PDV (financeiro) dentro do Gestor faz o app voltar para Pedidos", async () => {
  const { app, win } = await launch(tempUserData());
  try {
    await login(win, data.a.cashier);
    await win.waitForSelector('body[data-phase="app"]', { timeout: 20000 });
    await waitFor(async () => (await gestor(app))?.section === "orders", { message: "Pedidos" });
    // Alguém chega no financeiro pelo próprio Gestor (botão escondido do menu).
    await app.evaluate(async ({ BrowserWindow }) => {
      const [view] = BrowserWindow.getAllWindows()[0].contentView.children;
      await view.webContents.executeJavaScript(
        "document.querySelector('[data-admin-section=\"finance\"]')?.click(); document.body.dataset.adminSection = 'finance';"
      );
    });
    await waitFor(async () => {
      const info = await gestor(app);
      return info && info.section === "orders" && /section=orders/.test(info.url);
    }, { message: "voltar para Pedidos" });
  } finally {
    await app.close();
  }
});

test("GERENTE pausa e reativa prato pelo Cardápio, sem afetar outro restaurante", async () => {
  const { app, win } = await launch(tempUserData());
  try {
    await login(win, data.a.manager);
    await win.waitForSelector('body[data-phase="app"]', { timeout: 20000 });
    assert.equal(await win.textContent("#op-role"), "Gerente");
    await win.click('[data-module="cardapio"]');
    await win.waitForSelector(".row [data-next='paused']", { timeout: 20000 });

    const itemId = await win.getAttribute(".row [data-next='paused']", "data-item");
    await win.click(`.toggle[data-item="${itemId}"]`);
    await win.waitForSelector(`.toggle[data-item="${itemId}"][data-next="active"]`);
    assert.match(await win.textContent("#toast"), /pausado/);
    assert.equal(await win.textContent("#cd-off"), "1");

    const findItem = async (user) => {
      const get = await restaurantSession(user);
      const { body } = await get("/api/admin/catalog/list");
      return body.sections.flatMap((section) => section.items).find((item) => item.id === itemId);
    };
    assert.equal((await findItem(data.a.manager)).availabilityState, "paused", "pausado no servidor do restaurante A");
    assert.equal((await findItem(data.b.manager)).availabilityState, "active", "restaurante B não muda");

    // Filtro "Pausados" e busca.
    await win.click('.chip[data-filter="paused"]');
    assert.equal(await win.$$eval(".row", (rows) => rows.length), 1);
    await win.click('.chip[data-filter="all"]');

    await win.click(`.toggle[data-item="${itemId}"]`);
    await win.waitForSelector(`.toggle[data-item="${itemId}"][data-next="paused"]`);
    assert.equal((await findItem(data.a.manager)).availabilityState, "active", "reativado no servidor");
  } finally {
    await app.close();
  }
});

for (const size of ["1024x768", "1366x768", "1920x1080"]) {
  test(`layout cabe em ${size}`, async () => {
    const { app, win } = await launch(tempUserData(), { size });
    try {
      await login(win, data.a.cashier);
      await win.waitForSelector('body[data-phase="app"]', { timeout: 20000 });
      const info = await waitFor(async () => {
        const g = await gestor(app);
        return g && g.visible && g.section === "orders" ? g : null;
      }, { message: "Pedidos visível" });
      const [width, height] = size.split("x").map(Number);
      const overflow = await win.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      assert.equal(overflow, false, "sem rolagem horizontal na casca");
      assert.ok(info.bounds.x + info.bounds.width <= width + 1, "tela do Gestor dentro da largura");
      assert.ok(info.bounds.y + info.bounds.height <= height + 1, "tela do Gestor dentro da altura");
    } finally {
      await app.close();
    }
  });
}
