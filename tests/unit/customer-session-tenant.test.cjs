// Login do cliente separado por restaurante: no domínio INOVAS todos os sites
// dividem o mesmo cookie, então a sessão precisa dizer de qual restaurante é.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

process.env.CUSTOMER_SESSION_SECRET = process.env.CUSTOMER_SESSION_SECRET || "teste-unitario-sessao-cliente-0123456789";
const auth = require(path.join(__dirname, "..", "..", "lib", "customer-auth.cjs"));

const buildRequest = ({ cookie, clientToken, customerKey }) => ({
  headers: {
    cookie,
    [auth.CUSTOMER_CLIENT_TOKEN_HEADER]: clientToken,
    [auth.CUSTOMER_KEY_HEADER]: customerKey,
  },
});

const sessionCookie = (token) => `${auth.CUSTOMER_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`;

test("sessão criada no Tokyo não vale na Kasulo (mesmo telefone, mesmo aparelho)", () => {
  const token = auth.createCustomerSessionToken({
    customerKey: "cliente-16999990000",
    clientToken: "aparelho-1",
    restaurantKey: "default",
  });
  const req = buildRequest({ cookie: sessionCookie(token), clientToken: "aparelho-1", customerKey: "cliente-16999990000" });

  assert.ok(auth.getBoundCustomerSessionFromRequest(req, { restaurantKey: "default" }));
  assert.equal(auth.getBoundCustomerSessionFromRequest(req, { restaurantKey: "kasulo-rocha-pizzaria" }), null);
});

test("sessão da Kasulo não vale no Tokyo", () => {
  const token = auth.createCustomerSessionToken({
    customerKey: "cliente-16999990000",
    clientToken: "aparelho-1",
    restaurantKey: "kasulo-rocha-pizzaria",
  });
  const req = buildRequest({ cookie: sessionCookie(token), clientToken: "aparelho-1", customerKey: "cliente-16999990000" });

  assert.ok(auth.getBoundCustomerSessionFromRequest(req, { restaurantKey: "kasulo-rocha-pizzaria" }));
  assert.equal(auth.getBoundCustomerSessionFromRequest(req, { restaurantKey: "default" }), null);
});

test("sessões antigas (sem restaurante) continuam valendo só para o Tokyo", () => {
  const token = auth.createCustomerSessionToken({ customerKey: "cliente-antigo", clientToken: "aparelho-2" });
  const req = buildRequest({ cookie: sessionCookie(token), clientToken: "aparelho-2", customerKey: "cliente-antigo" });

  assert.ok(auth.getBoundCustomerSessionFromRequest(req, { restaurantKey: "default" }));
  assert.equal(auth.getBoundCustomerSessionFromRequest(req, { restaurantKey: "kasulo-rocha-pizzaria" }), null);
});

test("código de login pedido em um restaurante não confirma login em outro", () => {
  const token = auth.createCustomerLoginChallengeToken({
    customerKey: "cliente-16999990000",
    clientToken: "aparelho-1",
    code: "123456",
    restaurantKey: "default",
  });
  const req = {
    headers: {
      cookie: `${auth.CUSTOMER_LOGIN_CHALLENGE_COOKIE_NAME}=${encodeURIComponent(token)}`,
      [auth.CUSTOMER_CLIENT_TOKEN_HEADER]: "aparelho-1",
    },
  };

  assert.ok(auth.getBoundCustomerLoginChallengeFromRequest(req, { restaurantKey: "default" }));
  assert.equal(auth.getBoundCustomerLoginChallengeFromRequest(req, { restaurantKey: "kasulo-rocha-pizzaria" }), null);
});
