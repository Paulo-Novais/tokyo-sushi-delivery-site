"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createApiClient } = require("../../src/main/api-client");
const { createMemoryCookieStore } = require("../../src/main/cookies");

const SERVER = "https://inovasfood.com.br";

// fetch falso: responde conforme as rotas e registra as chamadas.
const fakeServer = (routes) => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const { pathname } = new URL(url);
    const call = { url, pathname, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : null };
    calls.push(call);
    const handler = routes[`${init.method} ${pathname}`];
    if (!handler) return response(404, { error: "nao encontrado" });
    return handler(call);
  };
  return { calls, fetchImpl };
};

const response = (status, body, setCookies = []) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { getSetCookie: () => setCookies },
  json: async () => body,
});

const client = (routes) => {
  const server = fakeServer(routes);
  const cookieStore = createMemoryCookieStore();
  const api = createApiClient({ getServerUrl: () => SERVER, cookieStore, fetchImpl: server.fetchImpl });
  return { api, cookieStore, calls: server.calls };
};

const SESSION_COOKIE = "inovas_restaurant_session=tok; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200";

test("login usa a mesma rota do Gestor, com origem do site, e guarda o cookie", async () => {
  const { api, cookieStore, calls } = client({
    "POST /api/admin/login": () => response(200, { ok: true, redirectTo: "/admin/", admin: { userScope: "RESTAURANT" } }, [SESSION_COOKIE]),
  });
  await api.login({ identifier: " ana@tokyo.com ", password: "segredo" });
  const call = calls[0];
  assert.equal(call.url, `${SERVER}/api/admin/login`);
  assert.equal(call.headers.Origin, SERVER);
  assert.deepEqual(call.body, { identifier: "ana@tokyo.com", password: "segredo", next: "/admin/" });
  assert.equal(await cookieStore.getCookieHeader(SERVER), "inovas_restaurant_session=tok");
});

test("senha errada vira mensagem em português", async () => {
  const { api } = client({
    "POST /api/admin/login": () => response(401, { error: "Login ou senha invalidos.", errorCode: "invalid_credentials" }),
  });
  await assert.rejects(api.login({ identifier: "a", password: "b" }), (error) => {
    assert.equal(error.code, "invalid_credentials");
    assert.equal(error.message, "Login ou senha inválidos.");
    return true;
  });
});

test("usuário em mais de um restaurante recebe a lista para escolher", async () => {
  const { api, calls } = client({
    "POST /api/admin/login": (call) =>
      call.body.restaurantKey
        ? response(200, { ok: true, admin: {} }, [SESSION_COOKIE])
        : response(409, {
            error: "Selecione",
            errorCode: "restaurant_selection_required",
            details: { restaurants: [{ restaurantKey: "tokyo", role: "CASHIER" }, { restaurantKey: "kasulo", role: "MANAGER" }] },
          }),
  });
  await assert.rejects(api.login({ identifier: "a", password: "b" }), (error) => {
    assert.equal(error.code, "restaurant_selection_required");
    assert.deepEqual(error.restaurants, [
      { restaurantKey: "tokyo", name: "tokyo", role: "Caixa" },
      { restaurantKey: "kasulo", name: "kasulo", role: "Gerente" },
    ]);
    return true;
  });
  await api.login({ identifier: "a", password: "b", restaurantKey: "tokyo" });
  assert.equal(calls[1].body.restaurantKey, "tokyo");
});

test("usuário da equipe INOVAS (System) não entra no app e a sessão é encerrada", async () => {
  const { api, calls, cookieStore } = client({
    "POST /api/admin/login": () =>
      response(200, { ok: true, redirectTo: "/system", admin: { userScope: "SYSTEM", platformScope: true } }, [
        "inovas_system_session=x; Path=/; HttpOnly; Max-Age=28800",
      ]),
    "POST /api/admin/logout": () => response(200, { ok: true }, ["inovas_system_session=; Path=/; Max-Age=0"]),
  });
  await assert.rejects(api.login({ identifier: "master", password: "x" }), { code: "system_user" });
  assert.equal(calls.at(-1).pathname, "/api/admin/logout");
  assert.equal(await cookieStore.getCookieHeader(SERVER), "");
});

test("sessão traz papel, restaurante e permissões do servidor", async () => {
  const { api } = client({
    "GET /api/auth/restaurant/session": () =>
      response(200, {
        success: true,
        authenticated: true,
        data: {
          session: {
            login: "ana@tokyo.com",
            displayName: "Ana Souza",
            role: "CASHIER",
            restaurantKey: "tokyo",
            expiresAt: "2026-11-14T00:00:00.000Z",
            effectivePermissions: ["tenant.orders.view"],
          },
        },
      }),
    "GET /api/admin/session": () =>
      response(200, { authenticated: true, admin: { restaurantName: "Tokyo Sushi" } }),
  });
  const info = await api.fetchSession();
  assert.equal(info.authenticated, true);
  assert.equal(info.user.roleLabel, "Caixa");
  assert.equal(info.user.restaurantName, "Tokyo Sushi");
  assert.deepEqual(info.user.permissions, ["tenant.orders.view"]);
  assert.equal(info.user.expiresAt, "2026-11-14T00:00:00.000Z");
});

test("sem sessão no servidor", async () => {
  const { api } = client({
    "GET /api/auth/restaurant/session": () => response(200, { success: true, authenticated: false, data: { session: null } }),
    "GET /api/admin/session": () => response(200, { authenticated: false }),
  });
  assert.deepEqual(await api.fetchSession(), { authenticated: false });
});

test("pausar envia SÓ o id do prato e o estado", async () => {
  const { api, calls } = client({
    "POST /api/admin/catalog/update": () => response(200, { ok: true }),
  });
  await api.setAvailability("hot-roll-8", "paused");
  assert.deepEqual(calls[0].body, { itemId: "hot-roll-8", availabilityState: "paused" });
  await api.setAvailability("hot-roll-8", "active");
  assert.deepEqual(calls[1].body, { itemId: "hot-roll-8", availabilityState: "active" });
  await assert.rejects(api.setAvailability("hot-roll-8", "unavailable"), { code: "invalid_state" });
  assert.equal(calls.length, 2);
});

test("403 ao pausar chega como erro com status", async () => {
  const { api } = client({
    "POST /api/admin/catalog/update": () => response(403, { error: "Sem permissão.", errorCode: "forbidden" }),
  });
  await assert.rejects(api.setAvailability("x", "paused"), (error) => error.status === 403);
});

test("sem internet vira erro 'offline'", async () => {
  const cookieStore = createMemoryCookieStore();
  const api = createApiClient({
    getServerUrl: () => SERVER,
    cookieStore,
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    },
  });
  await assert.rejects(api.fetchSession(), { code: "offline" });
});

test("Sair chama o logout do Gestor e apaga os cookies mesmo sem internet", async () => {
  const cookieStore = createMemoryCookieStore();
  await cookieStore.storeSetCookies(SERVER, [SESSION_COOKIE]);
  const api = createApiClient({
    getServerUrl: () => SERVER,
    cookieStore,
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    },
  });
  await api.logout();
  assert.equal(await cookieStore.getCookieHeader(SERVER), "");
});

test("lista do cardápio vem enxuta (sem descrição)", async () => {
  const { api } = client({
    "GET /api/admin/catalog/list": () =>
      response(200, {
        ok: true,
        sections: [
          { id: "s1", title: "Hot rolls", items: [{ id: "hot", name: "Hot Roll", category: "Hot", price: 19.99, image: "./site-images/x.webp", availabilityState: "paused", description: "longa" }] },
        ],
      }),
  });
  const sections = await api.listCatalog();
  assert.deepEqual(sections, [
    { id: "s1", title: "Hot rolls", items: [{ id: "hot", name: "Hot Roll", category: "Hot", price: 19.99, image: "./site-images/x.webp", availabilityState: "paused" }] },
  ]);
});
