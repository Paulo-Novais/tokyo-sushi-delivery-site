const { expect, request } = require("@playwright/test");

const baseURL = process.env.BASE_URL || process.env.VALIDATION_BASE_URL || "http://127.0.0.1:3000";
const masterLogin = process.env.E2E_ADMIN_LOGIN;
const masterPassword = process.env.E2E_ADMIN_PASSWORD;
const isVercelPreview = new URL(baseURL).hostname.endsWith(".vercel.app");

const uniqueKey = (prefix) => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return `${prefix}-${suffix}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 72);
};

const hostForKey = (restaurantKey) => `${restaurantKey}.localhost`;

const buildDocumentForRestaurantKey = (key = "default") => {
  const hash = String(key || "default")
    .split("")
    .reduce((total, character) => (total * 31 + character.charCodeAt(0)) % 1000000000000, 0);

  return `12${String(hash).padStart(12, "0")}`.slice(0, 14);
};

const createApiContext = async ({ host, cookie, ip, origin } = {}) => {
  const extraHTTPHeaders = {
    "x-forwarded-for": ip || `127.19.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`,
  };
  const cookiePairs = [];

  if (host) {
    if (isVercelPreview) {
      const restaurantSlug = host.replace(/\.localhost$/, "");
      cookiePairs.push(["inovas_restaurant_slug", restaurantSlug]);
    } else {
      extraHTTPHeaders["x-forwarded-host"] = host;
    }
  }

  for (const pair of String(cookie || "").split(";")) {
    const separator = pair.indexOf("=");
    if (separator > 0) {
      cookiePairs.push([
        pair.slice(0, separator).trim(),
        pair.slice(separator + 1).trim(),
      ]);
    }
  }

  if (origin) {
    extraHTTPHeaders.origin = origin;
    extraHTTPHeaders.referer = `${origin}/`;
  }

  return request.newContext({
    baseURL,
    extraHTTPHeaders,
    ...(cookiePairs.length
      ? {
          storageState: {
            cookies: cookiePairs.map(([name, value]) => ({
              name,
              value,
              domain: new URL(baseURL).hostname,
              path: "/",
              expires: -1,
              httpOnly: false,
              secure: new URL(baseURL).protocol === "https:",
              sameSite: "Lax",
            })),
            origins: [],
          },
        }
      : {}),
  });
};

const createTenantBrowserContext = async (
  browser,
  { host, extraHTTPHeaders: requestedHeaders = {}, ...options } = {}
) => {
  const extraHTTPHeaders = { ...requestedHeaders };

  if (host && !isVercelPreview) {
    extraHTTPHeaders["x-forwarded-host"] = host;
  }

  const context = await browser.newContext({
    ...options,
    ...(Object.keys(extraHTTPHeaders).length ? { extraHTTPHeaders } : {}),
  });

  if (host && isVercelPreview) {
    await context.addCookies([
      {
        name: "inovas_restaurant_slug",
        value: host.replace(/\.localhost$/, ""),
        url: baseURL,
      },
    ]);
  }

  return context;
};

const extractCookieHeader = (response) =>
  response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === "set-cookie")
    .map((header) => header.value.split(";")[0])
    .filter(Boolean)
    .join("; ");

const loginAdmin = async (api, { identifier, password, next = "/admin/" }) => {
  const response = await api.post("/api/admin/login", {
    data: { identifier, password, next },
  });
  const payload = await response.json().catch(() => ({}));

  return {
    response,
    payload,
    cookie: extractCookieHeader(response),
  };
};

const loginMaster = async () => {
  expect(masterLogin, "E2E_ADMIN_LOGIN precisa estar configurado.").toBeTruthy();
  expect(masterPassword, "E2E_ADMIN_PASSWORD precisa estar configurado.").toBeTruthy();

  const api = await createApiContext();
  const session = await loginAdmin(api, {
    identifier: masterLogin,
    password: masterPassword,
  });

  expect(
    session.response.status(),
    `master login failed: ${JSON.stringify(session.payload)}`
  ).toBe(200);
  expect(session.cookie).toContain("=");
  return { api, ...session };
};

const buildRestaurantPayload = ({
  key,
  name = `V19 ${key}`,
  plan = "PRO",
  status = "ACTIVE",
  ownerLogin = `owner@${key}.local`,
  ownerPassword = "SenhaOwner19",
} = {}) => {
  const document = buildDocumentForRestaurantKey(key);

  return {
    restaurantName: name,
    tradeName: name,
    name,
    slug: key,
    restaurantKey: key,
    domain: `${key}.localhost`,
    document,
    ownerFullName: `Owner ${name}`,
    email: ownerLogin,
    city: "Sao Paulo",
    postalCode: "01000000",
    establishmentNumber: "190",
    registration: {
      legalName: `${name} LTDA`,
      document,
      city: "Sao Paulo",
      state: "SP",
    },
    phone: "5511999999999",
    adhesionDate: "2026-07-11",
    whatsapp: "5511999999999",
    address: {
      street: "Rua V19",
      number: "190",
      neighborhood: "Centro",
      city: "Sao Paulo",
      state: "SP",
      postalCode: "01000000",
    },
    businessSchedule: {
      acceptOrdersOutsideHours: true,
    },
    delivery: {
      radiusKm: 8,
      fee: 9,
      minimumOrder: 35,
      deliveriesEnabled: true,
    },
    paymentMethods: ["pix", "card", "cash"],
    plan,
    subscriptionStatus: status,
    adminUser: {
      login: ownerLogin,
      email: ownerLogin,
      name: `Owner ${name}`,
      password: ownerPassword,
    },
  };
};

const onboardRestaurant = async (masterApi, options = {}) => {
  const key = options.key || uniqueKey("v19");
  const payload = buildRestaurantPayload({ ...options, key });
  const response = await masterApi.post("/api/admin/master/onboard-restaurant", {
    data: payload,
  });
  const body = await response.json().catch(() => ({}));

  expect(
    response.status(),
    `onboarding ${key}: ${JSON.stringify({
      error: body.error,
      errorCode: body.errorCode,
    })}`
  ).toBe(200);
  expect(body.restaurant?.restaurantKey).toBe(key);

  return {
    key,
    host: hostForKey(key),
    ownerLogin: payload.adminUser.login,
    ownerPassword: payload.adminUser.password,
    payload: body,
  };
};

const loginTenantOwner = async ({ host, ownerLogin, ownerPassword }) => {
  const api = await createApiContext({ origin: baseURL });
  const session = await loginAdmin(api, {
    identifier: ownerLogin,
    password: ownerPassword,
  });

  expect(session.response.status(), `owner login ${host}`).toBe(200);
  expect(session.payload.admin?.tenantContext?.restaurantKey).toBe(host.replace(/\.localhost$/, ""));

  return { api, ...session };
};

const createAdminUser = async (masterApi, user) => {
  const response = await masterApi.post("/api/admin/users/save", {
    data: { user },
  });
  const body = await response.json().catch(() => ({}));

  expect(response.status(), `create user ${user.login}`).toBe(200);
  expect(body.user?.login).toBe(user.login.toLowerCase());
  return body.user;
};

const orderPayload = (label) => ({
  profile: {
    id: `profile-${label}`,
    name: `Cliente ${label}`,
    phone: "(11) 96666-1111",
    email: `cliente-${label}@tenant.test`,
  },
  checkout: {
    paymentMethod: "pix",
    fulfillmentMode: "pickup",
    timingMode: "immediate",
    scheduledDate: "",
    scheduledTime: "",
    cashChangeRequired: "",
    cashAmountProvided: "",
    customerNotes: `pedido validacao ${label}`,
  },
  items: [
    {
      id: "carpaccio-salmao",
      name: "Carpaccio de Salmao",
      category: "Carpaccio",
      quantity: 1,
      price: 58.5,
    },
  ],
  addons: [],
  deliveryQuote: null,
});

// ---------- Cliente logado (login novo: e-mail e senha no login central) ----------
// Desde 19/11/2026 o pedido no site exige cliente logado no restaurante. Este
// ajudante cria (ou reaproveita) a conta do cliente no login central, gera o
// código de uso único para o restaurante e troca pela sessão do restaurante.
const extractRestaurantSessionCookie = (response) =>
  response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === "set-cookie")
    .map((header) => header.value.split(";")[0])
    .find((pair) => pair.startsWith("inovas_cliente_sessao=")) || "";

// Login central do cliente: no servidor local é http://localhost:<porta>
// (outra origem que não 127.0.0.1, como login.inovasfood.com.br em produção).
const customerAuthOrigin =
  process.env.CUSTOMER_AUTH_URL || baseURL.replace("://127.0.0.1", "://localhost");

const loginCustomerForRestaurant = async ({
  host,
  label = uniqueKey("cliente"),
  name = `Cliente ${label}`,
  phone = "(11) 96666-1111",
  email = `cliente-${label}@tenant.test`.toLowerCase(),
  password = "SenhaCliente2026!",
} = {}) => {
  const central = await createApiContext({ origin: customerAuthOrigin });
  try {
    await central.post("/api/customer/identity/sign-up/email", { data: { name, phone, email, password } });
    const signIn = await central.post("/api/customer/identity/sign-in/email", { data: { email, password } });
    expect(signIn.status(), `login do cliente ${email}`).toBe(200);
    // O teste fala com 127.0.0.1 e informa o restaurante no x-forwarded-host (sem porta).
    const restaurantOrigin = `${new URL(baseURL).protocol}//${host}`;
    const handoff = await central.post("/api/customer/account/handoff", {
      data: { restaurantKey: host.replace(/\.localhost$/, ""), returnUrl: `${restaurantOrigin}/` },
    });
    const handoffBody = await handoff.json();
    expect(handoff.status(), `codigo do login ${JSON.stringify(handoffBody)}`).toBe(200);
    const code = new URL(handoffBody.redirectUrl).searchParams.get("login_code");
    const site = await createApiContext({ host, origin: restaurantOrigin });
    try {
      const exchange = await site.post("/api/customer/auth/exchange", { data: { code } });
      expect(exchange.status(), "troca do codigo pela sessao do restaurante").toBe(200);
      return { cookie: extractRestaurantSessionCookie(exchange), name, phone, email, password };
    } finally {
      await site.dispose();
    }
  } finally {
    await central.dispose();
  }
};

// Contexto de API do site do restaurante com o cliente já logado.
const createCustomerApiContext = async ({ host, label, ...profile } = {}) => {
  const login = await loginCustomerForRestaurant({ host, label, ...profile });
  const api = await createApiContext({ host, cookie: login.cookie });
  api.customerLogin = login;
  return api;
};

const createPublicOrder = async ({ host, label }) => {
  const api = await createCustomerApiContext({ host, label });

  try {
    const response = await api.post("/api/orders/create", {
      headers: {
        Origin: baseURL,
        Referer: `${baseURL}/`,
      },
      data: orderPayload(label),
    });
    const body = await response.json().catch(() => ({}));

    expect(response.status(), `public order ${label}: ${JSON.stringify(body)}`).toBe(200);
    expect(body.tenantContext?.restaurantKey).toBe(host.replace(/\.localhost$/, ""));
    expect(body.order?.id || body.order?.publicId).toBeTruthy();
    return body.order;
  } finally {
    await api.dispose();
  }
};

const expectNoHorizontalOverflow = async (page) => {
  const metrics = await page.evaluate(() => {
    const root = document.scrollingElement || document.documentElement;
    return {
      bodyScrollWidth: document.body.scrollWidth,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 2);
};

module.exports = {
  baseURL,
  buildRestaurantPayload,
  customerAuthOrigin,
  createAdminUser,
  createApiContext,
  createCustomerApiContext,
  createPublicOrder,
  createTenantBrowserContext,
  expectNoHorizontalOverflow,
  hostForKey,
  isVercelPreview,
  loginAdmin,
  loginCustomerForRestaurant,
  loginMaster,
  loginTenantOwner,
  onboardRestaurant,
  orderPayload,
  uniqueKey,
};
