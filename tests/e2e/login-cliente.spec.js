const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const {
  baseURL,
  createApiContext,
  customerAuthOrigin,
  hostForKey,
  loginCustomerForRestaurant,
  loginMaster,
  onboardRestaurant,
  orderPayload,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");
const { buildFakeGoogleCode } = require("../../scripts/fake-google-oauth.cjs");

// Login do CLIENTE nos sites dos restaurantes (19/11/2026):
// Google ou e-mail e senha no login central; volta ao restaurante com código
// de uso único; sessão por restaurante; pedido só com cliente logado.
// O login central roda em http://localhost:<porta> e os restaurantes em
// http://127.0.0.1:<porta>/<slug> (origens diferentes, como em produção).

const OUTBOX = path.join(__dirname, "..", "..", ".data", `customer-outbox-${new URL(baseURL).port || 3000}.json`);
const PASSWORD = "SenhaForte2026!";
const randomIp = () => `10.${Math.floor(Math.random() * 200) + 20}.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200) + 1}`;

const centralApi = (ip = randomIp()) => createApiContext({ origin: customerAuthOrigin, ip });
const post = (api, url, data, headers = {}) => api.post(url, { data, headers, maxRedirects: 0 });
const readResetLinks = (email) => {
  try {
    return (JSON.parse(fs.readFileSync(OUTBOX, "utf8")).messages || [])
      .filter((message) => message.to === email && message.kind === "password_reset")
      .map((message) => message.text.match(/https?:\/\/\S+/)?.[0])
      .filter(Boolean);
  } catch {
    return [];
  }
};
const tokenFromResetLink = (link) => new URL(link).pathname.split("/").pop();

// Login com Google (simulado no servidor local) pela API, com cookies de estado.
const googleSignIn = async (api, profile, callbackPath = "/conta/entrar?continuar=1") => {
  const start = await post(api, "/api/customer/identity/sign-in/social", {
    provider: "google",
    callbackURL: `${customerAuthOrigin}${callbackPath}`,
    errorCallbackURL: `${customerAuthOrigin}/conta/entrar?erro=google`,
  });
  expect(start.status(), await start.text()).toBe(200);
  const googleUrl = new URL((await start.json()).url);
  expect(googleUrl.hostname).toBe("accounts.google.com");
  const state = googleUrl.searchParams.get("state");
  const callback = await api.get(
    `/api/customer/identity/callback/google?state=${encodeURIComponent(state)}&code=${buildFakeGoogleCode(profile)}`,
    { maxRedirects: 0 }
  );
  return { status: callback.status(), location: callback.headers().location || "" };
};

let restaurantA;
let restaurantB;

test.beforeAll(async () => {
  const master = await loginMaster();
  restaurantA = await onboardRestaurant(master.api, { key: uniqueKey("logina"), name: "Restaurante Login A", ownerPassword: "OwnerLoginA123!" });
  restaurantB = await onboardRestaurant(master.api, { key: uniqueKey("loginb"), name: "Restaurante Login B", ownerPassword: "OwnerLoginB123!" });
});

test("navegador: criar conta no login central, voltar ao restaurante e fazer pedido", async ({ page }) => {
  test.setTimeout(120_000);
  const email = `nav-${restaurantA.key}@cliente.test`;
  await page.goto(`/${restaurantA.key}/cardapio`, { waitUntil: "networkidle" });
  // "Entrar" leva direto para a tela de login (sem janela intermediária).
  await page.locator("[data-auth-open]").first().click();
  await expect(page).toHaveURL(new RegExp(`^${customerAuthOrigin}/conta/entrar`));
  await expect(page.locator("[data-conta-title]")).toHaveText("Que bom te ver!");
  await page.locator('[data-conta-tab="criar"]').click();
  await expect(page.locator("[data-conta-title]")).toHaveText("Crie sua conta");
  const form = page.locator('[data-conta-form="criar"]');
  await form.locator('input[name="name"]').fill("Mariana Navegador");
  await form.locator('input[name="phone"]').fill("(16) 99123-4567");
  await form.locator('input[name="email"]').fill(email);
  await form.locator('input[name="password"]').fill(PASSWORD);
  await form.locator('button[type="submit"]').click();

  // Volta ao restaurante já logada; o código some da barra de endereço.
  await page.waitForURL(new RegExp(`^${baseURL}/${restaurantA.key}/cardapio`));
  await expect(page.locator("[data-auth-label]").first()).toHaveText("Mariana");
  expect(page.url()).not.toContain("login_code");

  // Pedido com cliente logado.
  await page.locator("[data-add-to-cart]").first().click();
  await page.locator("[data-cart-toggle]").first().click();
  await page.locator("[data-cart-checkout-toggle]").click();
  await page.locator("label").filter({ has: page.locator('input[name=cart_payment_method][value=pix]') }).first().click();
  await page.locator("label").filter({ has: page.locator('input[name=cart_fulfillment_mode][value=pickup]') }).first().click();
  await page.locator("[data-cart-submit]").click();
  await expect(page.locator("[data-cart-order-feedback]")).toContainText("enviado para o gestor", { timeout: 15_000 });

  // Sair: derruba a sessão no restaurante e no login central, e volta ao site.
  await page.keyboard.press("Escape"); // fecha a sacola
  await page.locator("[data-auth-open]").first().click();
  await page.locator("[data-auth-logout]").click();
  await page.waitForURL(new RegExp(`^${baseURL}/${restaurantA.key}/cardapio`));
  await expect(page.locator("[data-auth-label]").first()).toHaveText("Entrar");
});

test("navegador: entrar com Google pede o telefone uma vez e volta ao restaurante", async ({ page }) => {
  test.setTimeout(120_000);
  const email = `google-${restaurantA.key}@gmail.test`;
  // O "Google" é simulado: a página do Google devolve direto para o retorno com um código.
  await page.route("https://accounts.google.com/**", (route) => {
    const google = new URL(route.request().url());
    const back = new URL(google.searchParams.get("redirect_uri"));
    back.searchParams.set("state", google.searchParams.get("state"));
    back.searchParams.set("code", buildFakeGoogleCode({ sub: `g-${restaurantA.key}`, email, email_verified: true, name: "Gabriel Google" }));
    return route.fulfill({ status: 302, headers: { location: back.toString() } });
  });
  await page.goto(`/${restaurantA.key}/cardapio`, { waitUntil: "networkidle" });
  await page.locator("[data-auth-open]").first().click();
  await expect(page).toHaveURL(new RegExp(`^${customerAuthOrigin}/conta/entrar`));
  await page.locator("[data-conta-google]").click();

  // Primeiro acesso pelo Google: pede o telefone.
  await expect(page.locator("[data-conta-title]")).toHaveText("Seu WhatsApp");
  await page.locator('[data-conta-form="telefone"] input[name="phone"]').fill("(16) 98888-7777");
  await page.locator('[data-conta-form="telefone"] button[type="submit"]').click();
  await page.waitForURL(new RegExp(`^${baseURL}/${restaurantA.key}/cardapio`));
  await expect(page.locator("[data-auth-label]").first()).toHaveText("Gabriel");

  // Segundo acesso: não pede o telefone de novo.
  const api = await centralApi();
  try {
    await googleSignIn(api, { sub: `g-${restaurantA.key}`, email, email_verified: true, name: "Gabriel Google" });
    const me = await (await api.get("/api/customer/account/me")).json();
    expect(me.user).toMatchObject({ email, phone: "16988887777", needsPhone: false });
  } finally {
    await api.dispose();
  }
});

test("vínculo: mesmo e-mail por senha e pelo Google é a mesma conta (só com e-mail verificado)", async () => {
  const email = `vinculo-${restaurantA.key}@gmail.test`;
  const api = await centralApi();
  try {
    expect((await post(api, "/api/customer/identity/sign-up/email", { name: "Vera Vínculo", phone: "16977776666", email, password: PASSWORD })).status()).toBe(200);
    expect((await post(api, "/api/customer/identity/sign-in/email", { email, password: PASSWORD })).status()).toBe(200);
    await post(api, "/api/customer/identity/sign-out", {});

    // Google com e-mail NÃO verificado: não vincula.
    const unverified = await googleSignIn(api, { sub: "g-unverified", email, email_verified: false, name: "Outra Pessoa" });
    expect(unverified.location).toContain("erro=google");
    expect((await (await api.get("/api/customer/account/me")).json()).authenticated).toBe(false);

    // Google com e-mail verificado: vincula à MESMA conta (mantém o telefone).
    const verified = await googleSignIn(api, { sub: "g-verified", email, email_verified: true, name: "Vera Vínculo" });
    expect(verified.status).toBe(302);
    expect(verified.location).not.toContain("erro=");
    const me = await (await api.get("/api/customer/account/me")).json();
    expect(me.user).toMatchObject({ email, phone: "16977776666" });

    // A senha criada sem e-mail confirmado foi desativada (proteção contra quem
    // cadastrou o e-mail de outra pessoa).
    await post(api, "/api/customer/identity/sign-out", {});
    expect((await post(api, "/api/customer/identity/sign-in/email", { email, password: PASSWORD })).status()).toBe(401);

    // Conta só do Google + "criar conta" com o mesmo e-mail: resposta genérica, sem conta nova.
    const dup = await post(api, "/api/customer/identity/sign-up/email", { name: "Intruso", phone: "16911112222", email, password: "OutraSenha2026!" });
    expect(dup.status()).toBe(200);
    expect((await post(api, "/api/customer/identity/sign-in/email", { email, password: "OutraSenha2026!" })).status()).toBe(401);
  } finally {
    await api.dispose();
  }
});

test("esqueci minha senha: link de uso único, sem revelar se o e-mail existe", async () => {
  const email = `reset-${restaurantA.key}@cliente.test`;
  const api = await centralApi();
  try {
    await post(api, "/api/customer/identity/sign-up/email", { name: "Rita Reset", phone: "16966665555", email, password: PASSWORD });
    const redirectTo = `${customerAuthOrigin}/conta/entrar?modo=nova-senha`;
    const known = await post(api, "/api/customer/identity/request-password-reset", { email, redirectTo });
    const unknown = await post(api, "/api/customer/identity/request-password-reset", { email: `ninguem-${restaurantA.key}@cliente.test`, redirectTo });
    expect(known.status()).toBe(200);
    expect(unknown.status()).toBe(200);
    expect(await known.json()).toEqual(await unknown.json());

    await expect.poll(() => readResetLinks(email).length, { timeout: 5_000 }).toBeGreaterThan(0);
    const links = readResetLinks(email);
    const token = tokenFromResetLink(links[links.length - 1]);
    expect((await post(api, "/api/customer/identity/reset-password", { token, newPassword: "NovaSenha2026!" })).status()).toBe(200);
    // Reutilizar o mesmo link: recusado.
    expect((await post(api, "/api/customer/identity/reset-password", { token, newPassword: "OutraNova2026!" })).status()).toBe(400);
    expect((await post(api, "/api/customer/identity/sign-in/email", { email, password: PASSWORD })).status()).toBe(401);
    expect((await post(api, "/api/customer/identity/sign-in/email", { email, password: "NovaSenha2026!" })).status()).toBe(200);
  } finally {
    await api.dispose();
  }
});

test("limite de tentativas: senha errada repetida é bloqueada; mensagens não revelam o e-mail", async () => {
  const email = `limite-${restaurantA.key}@cliente.test`;
  const setup = await centralApi();
  await post(setup, "/api/customer/identity/sign-up/email", { name: "Luis Limite", phone: "16955554444", email, password: PASSWORD });
  await setup.dispose();

  // Mesmo IP: 5 tentativas por minuto.
  const sameIp = await centralApi("10.250.1.1");
  try {
    const statuses = [];
    for (let i = 0; i < 7; i += 1) {
      statuses.push((await post(sameIp, "/api/customer/identity/sign-in/email", { email, password: `errada-${i}-xyz` })).status());
    }
    expect(statuses.slice(0, 5).every((status) => status === 401)).toBe(true);
    expect(statuses).toContain(429);
  } finally {
    await sameIp.dispose();
  }

  // Mesmo e-mail por IPs diferentes: no máximo 10 tentativas em 15 minutos.
  let blocked = false;
  for (let i = 0; i < 12 && !blocked; i += 1) {
    const api = await centralApi();
    blocked = (await post(api, "/api/customer/identity/sign-in/email", { email, password: `errada-ip-${i}` })).status() === 429;
    await api.dispose();
  }
  expect(blocked).toBe(true);

  // Senha errada e e-mail inexistente: mesma resposta.
  const api = await centralApi();
  try {
    const wrong = await post(api, "/api/customer/identity/sign-in/email", { email: `outro-${restaurantA.key}@cliente.test`, password: "errada-123" });
    const unknown = await post(api, "/api/customer/identity/sign-in/email", { email: `naoexiste-${restaurantA.key}@cliente.test`, password: "errada-123" });
    expect(wrong.status()).toBe(unknown.status());
    expect(await wrong.json()).toEqual(await unknown.json());
  } finally {
    await api.dispose();
  }
});

test("isolamento: a mesma pessoa em dois restaurantes; sessão de A não vale em B", async () => {
  const same = { email: `mesma-${restaurantA.key}@cliente.test`, phone: "(11) 95555-4444", name: "Mesma Pessoa" };
  const loginA = await loginCustomerForRestaurant({ host: restaurantA.host, ...same });
  const loginB = await loginCustomerForRestaurant({ host: restaurantB.host, ...same });
  const siteA = await createApiContext({ host: restaurantA.host, cookie: loginA.cookie });
  const siteBWithCookieA = await createApiContext({ host: restaurantB.host, cookie: loginA.cookie });
  const siteB = await createApiContext({ host: restaurantB.host, cookie: loginB.cookie });
  try {
    expect((await (await siteA.get("/api/customer/me")).json()).authenticated).toBe(true);
    // Cookie de A no restaurante B: não é sessão.
    expect((await (await siteBWithCookieA.get("/api/customer/me")).json()).authenticated).toBe(false);
    const orderB = await siteBWithCookieA.post("/api/orders/create", {
      headers: { Origin: baseURL, Referer: `${baseURL}/` },
      data: orderPayload("cookie-de-a"),
    });
    expect(orderB.status()).toBe(401);

    // Pedido em A não aparece no acompanhamento de B (mesmo telefone).
    const orderA = await siteA.post("/api/orders/create", { headers: { Origin: baseURL, Referer: `${baseURL}/` }, data: orderPayload("so-em-a") });
    expect(orderA.status()).toBe(200);
    const activeA = await (await siteA.get("/api/customer/orders/active")).json();
    const activeB = await (await siteB.get("/api/customer/orders/active")).json();
    expect(activeA.hasActiveOrder).toBe(true);
    expect(activeB.hasActiveOrder).toBe(false);
  } finally {
    await Promise.all([siteA.dispose(), siteBWithCookieA.dispose(), siteB.dispose()]);
  }
});

test("pedido: sem login é recusado; com login usa os dados da conta, não os do navegador", async () => {
  const anonymous = await createApiContext({ host: restaurantA.host });
  const login = await loginCustomerForRestaurant({ host: restaurantA.host, name: "Dona Conta", phone: "(16) 94444-3333", email: `pedido-${restaurantA.key}@cliente.test` });
  const site = await createApiContext({ host: restaurantA.host, cookie: login.cookie });
  try {
    const refused = await anonymous.post("/api/orders/create", { headers: { Origin: baseURL, Referer: `${baseURL}/` }, data: orderPayload("anonimo") });
    expect(refused.status()).toBe(401);
    expect((await refused.json()).errorCode).toBe("customer_login_required");

    const payload = orderPayload("forjado");
    payload.profile = { id: "x", name: "Nome Forjado", phone: "(11) 90000-0000", email: "forjado@x.test" };
    const created = await site.post("/api/orders/create", { headers: { Origin: baseURL, Referer: `${baseURL}/` }, data: payload });
    expect(created.status()).toBe(200);
    const order = (await created.json()).order;
    expect(order.customerName).toBe("Dona Conta");
    expect(order.customerPhone).toBe("16944443333");

    // Sair derruba a sessão de verdade: o mesmo cookie não serve mais.
    const restaurantOrigin = `${new URL(baseURL).protocol}//${restaurantA.host}`;
    const logoutApi = await createApiContext({ host: restaurantA.host, cookie: login.cookie, origin: restaurantOrigin });
    expect((await logoutApi.post("/api/customer/logout", { data: {} })).status()).toBe(200);
    await logoutApi.dispose();
    expect((await (await site.get("/api/customer/me")).json()).authenticated).toBe(false);
    const after = await site.post("/api/orders/create", { headers: { Origin: baseURL, Referer: `${baseURL}/` }, data: orderPayload("depois-de-sair") });
    expect(after.status()).toBe(401);
  } finally {
    await Promise.all([anonymous.dispose(), site.dispose()]);
  }
});

test("segurança do retorno: sem open redirect e sem restaurante padrão; WhatsApp desativado", async () => {
  const email = `retorno-${restaurantA.key}@cliente.test`;
  const api = await centralApi();
  try {
    await post(api, "/api/customer/identity/sign-up/email", { name: "Renato Retorno", phone: "16933332222", email, password: PASSWORD });
    await post(api, "/api/customer/identity/sign-in/email", { email, password: PASSWORD });
    const handoff = (returnUrl, restaurantKey = restaurantA.key) =>
      post(api, "/api/customer/account/handoff", { restaurantKey, returnUrl });
    expect((await handoff("https://evil.example/")).status()).toBe(400);
    expect((await handoff(`http://${hostForKey(restaurantB.key)}/`)).status()).toBe(400); // site de outro restaurante
    expect((await handoff(`${baseURL}/`)).status()).toBe(400); // raiz da plataforma (sem restaurante)
    expect((await handoff(`${baseURL}/${restaurantB.key}/cardapio`)).status()).toBe(400);
    expect((await handoff("javascript:alert(1)")).status()).toBe(400);
    expect((await handoff(`${baseURL}/${restaurantA.key}/cardapio`)).status()).toBe(200);
    const check = await (await api.get(`/api/customer/account/return-url?r=${restaurantA.key}&volta=${encodeURIComponent("https://evil.example/")}`)).json();
    expect(check.url).toBe("");

    // Outro site não consegue disparar ações com o cookie do cliente.
    const evil = await createApiContext({ origin: "https://evil.example" });
    const stolenCookie = (await api.storageState()).cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    const evilHandoff = await evil.post("/api/customer/account/handoff", {
      headers: { cookie: stolenCookie },
      data: { restaurantKey: restaurantA.key, returnUrl: `${baseURL}/${restaurantA.key}/cardapio` },
    });
    expect(evilHandoff.status()).toBe(403);
    await evil.dispose();
  } finally {
    await api.dispose();
  }

  const site = await createApiContext({ host: restaurantA.host, origin: baseURL });
  try {
    const start = await site.post("/api/customer/auth/start", { data: { name: "X", phone: "16999999999" } });
    expect(start.status()).toBe(410);
  } finally {
    await site.dispose();
  }
});
