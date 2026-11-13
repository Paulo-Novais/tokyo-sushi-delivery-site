// Cria, no servidor LOCAL de validação do site (scripts/local-validation-server.cjs),
// dois restaurantes descartáveis com dono e um usuário CAIXA cada.
// Nunca apontar para Preview ou Production: o script recusa qualquer host que não seja local.
"use strict";

const BASE = process.env.GESTOR_BASE_URL || "http://127.0.0.1:3000";
// Mesmas variáveis usadas para subir o servidor local de validação do site.
const MASTER_LOGIN = process.env.E2E_ADMIN_LOGIN || "";
const MASTER_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

const assertLocal = () => {
  const { hostname } = new URL(BASE);
  if (!["127.0.0.1", "localhost"].includes(hostname)) {
    throw new Error(`Seed só roda contra servidor local (recebi ${hostname}).`);
  }
};

const client = () => {
  let cookie = "";
  return async (path, { method = "GET", body } = {}) => {
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Origin: BASE,
        Referer: `${BASE}/`,
        "x-forwarded-for": `127.18.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookies = response.headers.getSetCookie?.() || [];
    if (setCookies.length) {
      const jar = new Map(cookie.split("; ").filter(Boolean).map((p) => [p.split("=")[0], p]));
      for (const raw of setCookies) {
        const pair = raw.split(";")[0];
        jar.set(pair.split("=")[0], pair);
      }
      cookie = [...jar.values()].join("; ");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`${method} ${path} -> ${response.status} ${JSON.stringify(data).slice(0, 300)}`);
      error.status = response.status;
      throw error;
    }
    return data;
  };
};

const uniqueKey = (prefix) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toLowerCase();

const documentFor = (key) => {
  const hash = key.split("").reduce((t, c) => (t * 31 + c.charCodeAt(0)) % 1000000000000, 0);
  return `12${String(hash).padStart(12, "0")}`.slice(0, 14);
};

const onboard = async (master, key, name) => {
  const ownerLogin = `dono@${key}.local`;
  const ownerPassword = "SenhaDono123!";
  const document = documentFor(key);
  await master("/api/admin/master/onboard-restaurant", {
    method: "POST",
    body: {
      restaurantName: name, tradeName: name, name, slug: key, restaurantKey: key,
      domain: `${key}.localhost`, document, ownerFullName: `Dono ${name}`, email: ownerLogin,
      city: "Sao Paulo", postalCode: "01000000", establishmentNumber: "10",
      registration: { legalName: `${name} LTDA`, document, city: "Sao Paulo", state: "SP" },
      phone: "5511999999999", adhesionDate: "2026-11-01", whatsapp: "5511999999999",
      address: { street: "Rua Teste", number: "10", neighborhood: "Centro", city: "Sao Paulo", state: "SP", postalCode: "01000000" },
      businessSchedule: { acceptOrdersOutsideHours: true },
      delivery: { radiusKm: 8, fee: 9, minimumOrder: 35, deliveriesEnabled: true },
      paymentMethods: ["pix", "card", "cash"], plan: "PRO", subscriptionStatus: "ACTIVE",
      adminUser: { login: ownerLogin, email: ownerLogin, name: `Dono ${name}`, password: ownerPassword },
    },
  });
  return { key, name, ownerLogin, ownerPassword };
};

const createTenantUser = async (owner, key, role, label) => {
  const email = `${label}@${key}.local`;
  const body = await owner("/api/tenant/users", {
    method: "POST",
    body: { name: `${label} ${role}`, email, phone: "(11) 97777-1100", role, credentialMode: "TEMPORARY_PASSWORD" },
  });
  return { login: email, password: body?.data?.access?.temporaryPassword, role };
};

const seed = async () => {
  assertLocal();
  if (!MASTER_LOGIN || !MASTER_PASSWORD) {
    throw new Error("Defina E2E_ADMIN_LOGIN e E2E_ADMIN_PASSWORD (os mesmos do servidor local de validação).");
  }
  const master = client();
  await master("/api/admin/login", { method: "POST", body: { identifier: MASTER_LOGIN, password: MASTER_PASSWORD } });

  const result = {};
  for (const [slot, prefix, name] of [["a", "pdv-a", "Restaurante A"], ["b", "pdv-b", "Restaurante B"]]) {
    const restaurant = await onboard(master, uniqueKey(prefix), name);
    const owner = client();
    await owner("/api/admin/login", { method: "POST", body: { identifier: restaurant.ownerLogin, password: restaurant.ownerPassword } });
    restaurant.cashier = await createTenantUser(owner, restaurant.key, "CASHIER", "ana");
    restaurant.manager = await createTenantUser(owner, restaurant.key, "MANAGER", "gerente");
    result[slot] = restaurant;
  }
  result.master = { login: MASTER_LOGIN, password: MASTER_PASSWORD };
  return result;
};

module.exports = { seed, BASE };

if (require.main === module) {
  seed()
    .then((data) => console.log(JSON.stringify(data, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
