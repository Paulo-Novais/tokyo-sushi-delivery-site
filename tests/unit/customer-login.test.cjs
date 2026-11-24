// Login do cliente: senha com hash, link de senha expirado/reusado, código de
// volta expirado e endereço de volta proibido. Roda a Better Auth de verdade em
// memória (sem servidor), avançando o relógio para testar a validade.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "inovas-login-unit-"));
process.env.INOVAS_CUSTOMER_OUTBOX_FILE = path.join(tmp, "outbox.json");
process.env.INOVAS_CUSTOMER_SESSIONS_FILE = path.join(tmp, "sessions.json");
process.env.CUSTOMER_AUTH_URL = "http://localhost:3999";
delete process.env.CUSTOMER_AUTH_DATABASE_URL;

const identity = require("../../lib/customer-identity.cjs");

const BASE = "http://localhost:3999/api/customer/identity";
let ipCounter = 1;
const call = async (pathname, body) => {
  const auth = await identity.getCustomerAuth();
  const response = await auth.handler(
    new Request(BASE + pathname, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3999", "x-forwarded-for": `10.77.0.${ipCounter++ % 250}` },
      body: JSON.stringify(body),
    })
  );
  return { status: response.status, body: await response.text() };
};
const lastResetToken = (email) => {
  const messages = JSON.parse(fs.readFileSync(process.env.INOVAS_CUSTOMER_OUTBOX_FILE, "utf8")).messages;
  const link = messages.filter((message) => message.to === email).pop().text.match(/https?:\/\/\S+/)[0];
  return new URL(link).pathname.split("/").pop();
};

// Relógio adiantado só dentro do callback.
const withClockAhead = async (ms, callback) => {
  const RealDate = Date;
  class FutureDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(RealDate.now() + ms);
      else super(...args);
    }
    static now() {
      return RealDate.now() + ms;
    }
  }
  global.Date = FutureDate;
  try {
    return await callback();
  } finally {
    global.Date = RealDate;
  }
};

test("cadastro guarda a senha só como hash argon2id e exige telefone com DDD", async () => {
  const noPhone = await call("/sign-up/email", { name: "Sem Fone", email: "semfone@x.test", password: "SenhaForte2026!", phone: "123" });
  assert.equal(noPhone.status, 400);
  const created = await call("/sign-up/email", { name: "Ana Hash", email: "hash@x.test", password: "SenhaForte2026!", phone: "(16) 99123-4567" });
  assert.equal(created.status, 200);
  const auth = await identity.getCustomerAuth();
  const context = await auth.$context;
  const user = await context.internalAdapter.findUserByEmail("hash@x.test", { includeAccounts: true });
  const credential = user.accounts.find((account) => account.providerId === "credential");
  assert.match(credential.password, /^\$argon2id\$/);
  assert.ok(!credential.password.includes("SenhaForte2026!"));
  assert.equal(user.user.phone, "16991234567");
});

test("link de nova senha: expira em 30 minutos e não pode ser reusado", async () => {
  await call("/sign-up/email", { name: "Rita Expira", email: "expira@x.test", password: "SenhaForte2026!", phone: "16988887777" });
  const redirectTo = "http://localhost:3999/conta/entrar?modo=nova-senha";

  await call("/request-password-reset", { email: "expira@x.test", redirectTo });
  const expiredToken = lastResetToken("expira@x.test");
  const expired = await withClockAhead(31 * 60 * 1000, () => call("/reset-password", { token: expiredToken, newPassword: "NovaSenha2026!" }));
  assert.equal(expired.status, 400, "token vencido é recusado");

  await call("/request-password-reset", { email: "expira@x.test", redirectTo });
  const token = lastResetToken("expira@x.test");
  assert.equal((await call("/reset-password", { token, newPassword: "NovaSenha2026!" })).status, 200);
  assert.equal((await call("/reset-password", { token, newPassword: "OutraSenha2026!" })).status, 400, "token usado é recusado");
  assert.equal((await call("/sign-in/email", { email: "expira@x.test", password: "NovaSenha2026!" })).status, 200);
});

test("pedido de nova senha: no máximo 3 por hora por e-mail, sempre com a mesma resposta", async () => {
  await call("/sign-up/email", { name: "Lia Limite", email: "limite-reset@x.test", password: "SenhaForte2026!", phone: "16977776666" });
  const redirectTo = "http://localhost:3999/conta/entrar?modo=nova-senha";
  const before = fs.existsSync(process.env.INOVAS_CUSTOMER_OUTBOX_FILE)
    ? JSON.parse(fs.readFileSync(process.env.INOVAS_CUSTOMER_OUTBOX_FILE, "utf8")).messages.filter((m) => m.to === "limite-reset@x.test").length
    : 0;
  const statuses = [];
  for (let i = 0; i < 5; i += 1) statuses.push((await call("/request-password-reset", { email: "limite-reset@x.test", redirectTo })).status);
  assert.deepEqual(statuses, [200, 200, 200, 200, 200]);
  const sent = JSON.parse(fs.readFileSync(process.env.INOVAS_CUSTOMER_OUTBOX_FILE, "utf8")).messages.filter((m) => m.to === "limite-reset@x.test").length;
  assert.equal(sent - before, 3, "só 3 e-mails saíram");
});

test("código de volta ao restaurante: uso único, vale 60 segundos e só no restaurante certo", async () => {
  await call("/sign-up/email", { name: "Caio Codigo", email: "codigo@x.test", password: "SenhaForte2026!", phone: "16966665555" });
  const auth = await identity.getCustomerAuth();
  const user = (await (await auth.$context).internalAdapter.findUserByEmail("codigo@x.test")).user;
  const returnUrl = new URL("https://restaurante-a.example/cardapio");

  const late = await identity.createHandoffCode({ user, restaurantKey: "a", returnUrl });
  const lateResult = await withClockAhead(61 * 1000, () => identity.redeemHandoffCode({ code: late, restaurantKey: "a", origin: returnUrl.origin }));
  assert.equal(lateResult, null, "código vencido não vale");

  const otherRestaurant = await identity.createHandoffCode({ user, restaurantKey: "a", returnUrl });
  assert.equal(await identity.redeemHandoffCode({ code: otherRestaurant, restaurantKey: "b", origin: returnUrl.origin }), null, "código de A não vale em B");

  const otherOrigin = await identity.createHandoffCode({ user, restaurantKey: "a", returnUrl });
  assert.equal(await identity.redeemHandoffCode({ code: otherOrigin, restaurantKey: "a", origin: "https://evil.example" }), null, "código de outra origem não vale");

  const good = await identity.createHandoffCode({ user, restaurantKey: "a", returnUrl });
  assert.equal((await identity.redeemHandoffCode({ code: good, restaurantKey: "a", origin: returnUrl.origin }))?.id, user.id);
  assert.equal(await identity.redeemHandoffCode({ code: good, restaurantKey: "a", origin: returnUrl.origin }), null, "segunda vez não vale");
});

test("endereço de volta: recusa domínio desconhecido, http em produção, usuário na URL e restaurante vazio", async () => {
  assert.equal(await identity.validateReturnUrl("https://evil.example/", "a"), null);
  assert.equal(await identity.validateReturnUrl("javascript:alert(1)", "a"), null);
  assert.equal(await identity.validateReturnUrl("https://user:pass@evil.example/", "a"), null);
  assert.equal(await identity.validateReturnUrl("https://evil.example/", ""), null);
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.equal(await identity.validateReturnUrl("http://a.localhost/", "a"), null, "http não vale em produção");
  } finally {
    process.env.NODE_ENV = previous;
  }
});

test("telefone: só com DDD; vira a chave do cliente no restaurante", () => {
  assert.equal(identity.customerKeyFromPhone("(16) 99123-4567"), "phone:16991234567");
  assert.equal(identity.customerKeyFromPhone("12345"), "");
  assert.equal(identity.normalizePhoneDigits("+55 (16) 99123-4567"), "5516991234567");
});

test("sem configuração em produção, o login falha fechado", async () => {
  const previous = { env: process.env.NODE_ENV, url: process.env.CUSTOMER_AUTH_URL, secret: process.env.CUSTOMER_AUTH_SECRET };
  delete require.cache[require.resolve("../../lib/customer-identity.cjs")];
  process.env.NODE_ENV = "production";
  delete process.env.CUSTOMER_AUTH_SECRET;
  try {
    const fresh = require("../../lib/customer-identity.cjs");
    await assert.rejects(() => fresh.getCustomerAuth(), (error) => error.errorCode === "customer_auth_not_configured");
  } finally {
    process.env.NODE_ENV = previous.env;
    process.env.CUSTOMER_AUTH_URL = previous.url;
    if (previous.secret) process.env.CUSTOMER_AUTH_SECRET = previous.secret;
    delete require.cache[require.resolve("../../lib/customer-identity.cjs")];
  }
});
