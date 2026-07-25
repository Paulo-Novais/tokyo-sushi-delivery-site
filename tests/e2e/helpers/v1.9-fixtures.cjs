const { expect, request } = require("@playwright/test");

const baseURL = process.env.BASE_URL || process.env.VALIDATION_BASE_URL || "http://127.0.0.1:3000";
const masterLogin = process.env.E2E_ADMIN_LOGIN;
const masterPassword = process.env.E2E_ADMIN_PASSWORD;

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

  if (host) {
    extraHTTPHeaders["x-forwarded-host"] = host;
  }

  if (cookie) {
    extraHTTPHeaders.cookie = cookie;
  }

  if (origin) {
    extraHTTPHeaders.origin = origin;
    extraHTTPHeaders.referer = `${origin}/`;
  }

  return request.newContext({ baseURL, extraHTTPHeaders });
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

  expect(response.status(), `onboarding ${key}`).toBe(200);
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
  const api = await createApiContext({ host, origin: baseURL });
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

const createPublicOrder = async ({ host, label }) => {
  const api = await createApiContext({ host });

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
  createAdminUser,
  createApiContext,
  createPublicOrder,
  expectNoHorizontalOverflow,
  hostForKey,
  loginAdmin,
  loginMaster,
  loginTenantOwner,
  onboardRestaurant,
  uniqueKey,
};
