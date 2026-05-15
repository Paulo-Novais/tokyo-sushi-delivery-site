const { test, expect, request } = require("@playwright/test");

const baseURL = process.env.VALIDATION_BASE_URL || "http://localhost:3000";

const normalizePhone = (value) => String(value || "").replace(/\D/g, "").slice(-11);

const buildCustomerKey = ({ phone, email = "", profileId = "" }) => {
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedProfileId = String(profileId || "").trim();

  if (normalizedPhone) {
    return `phone:${normalizedPhone}`;
  }

  if (normalizedEmail) {
    return `email:${normalizedEmail}`;
  }

  return `profile:${normalizedProfileId}`;
};

const customer = {
  id: "profile-ui-stage3",
  name: "Cliente UI Tracking",
  phone: "(11) 96666-3311",
  email: "cliente-ui@teste.com",
};

const buildOrderPayload = (nonce) => ({
  profile: {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
  },
  checkout: {
    paymentMethod: "pix",
    fulfillmentMode: "delivery",
    timingMode: "scheduled",
    scheduledDate: "2026-04-12",
    scheduledTime: "20:45",
    cashChangeRequired: "",
    cashAmountProvided: "",
    customerNotes: `Sem cebolinha. Validacao UI ${nonce}.`,
  },
  items: [
    {
      id: `combo-ui-stage3-${nonce}`,
      name: "Combinado UI Tracking",
      category: "Combinados",
      quantity: 1,
      price: 84.9,
    },
  ],
  addons: [
    {
      id: "addon-ui-stage3",
      name: "Molho especial",
      quantity: 1,
      chargedQuantity: 1,
      freeUnits: 0,
      unitPrice: 3.5,
      totalPrice: 3.5,
    },
  ],
  deliveryQuote: {
    street: "Rua das Flores",
    houseNumber: "123",
    complement: "Apto 21",
    reference: "Portao preto",
    cep: "01310-100",
    neighborhood: "Centro",
    city: "Sao Paulo",
    state: "SP",
    geocodedAddress: "Rua das Flores, 123 - Centro, Sao Paulo - SP",
    destinationLabel: "Rua das Flores, 123 - Centro, Sao Paulo - SP",
    distanceText: "4,2 km",
    routeBand: "Centro expandido",
    totalEstimateText: "45-60 min",
    fee: 9.9,
  },
});

test.describe.configure({ mode: "serial" });

test("ETAPA 3 publica: login, tracking sincronizado, botao dinamico e logout", async ({
  page,
}) => {
  const nonce = Date.now();
  const customerKey = buildCustomerKey(customer);
  const orderCreationClientToken = "ui-create-device-token";
  const trackingClientToken = "ui-track-device-token";

  const publicApi = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      origin: baseURL,
      accept: "application/json",
    },
  });

  const createOrderResponse = await publicApi.post("/api/orders/create", {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-tokyo-customer-client-token": orderCreationClientToken,
      "x-tokyo-customer-key": customerKey,
    },
    data: buildOrderPayload(nonce),
  });
  expect(createOrderResponse.ok()).toBeTruthy();
  const createdOrder = await createOrderResponse.json();
  const publicId = createdOrder.order.publicId;

  await page.addInitScript((clientToken) => {
    window.localStorage.setItem("tokyo_customer_client_token", clientToken);
  }, trackingClientToken);

  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto(`${baseURL}/acompanhar.html`, {
    waitUntil: "networkidle",
  });

  await expect(page.locator("[data-order-cta]").first()).toHaveText("Pedir Agora");
  await expect(page.locator("[data-tracking-root]")).toContainText("Login necessário", {
    timeout: 15000,
  });

  await page.locator("[data-auth-open]").first().click();
  await page.locator('input[name="entry_name"]').fill(customer.name);
  await page.locator('input[name="entry_phone"]').fill(customer.phone);
  await page.locator("[data-auth-phone-form] .auth-submit").click();

  const previewCodeNode = page.locator(".auth-code-preview strong");
  await expect(previewCodeNode).toBeVisible({ timeout: 15000 });
  const previewCode = (await previewCodeNode.textContent())?.trim() || "";
  expect(previewCode).toMatch(/^\d{6}$/);

  await page.locator('input[name="phone_code"]').fill(previewCode);
  await page.locator("[data-auth-phone-verify-form] .auth-submit").click();

  await expect(page.locator("[data-tracking-root]")).toContainText(publicId, {
    timeout: 15000,
  });
  await expect(page.locator("[data-order-cta]").first()).toHaveText("Acompanhar Pedido", {
    timeout: 15000,
  });
  await expect(page.locator("[data-tracking-root]")).toContainText("Novo");

  const adminApi = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      origin: baseURL,
      accept: "application/json",
      "content-type": "application/json; charset=utf-8",
    },
  });

  const adminLoginResponse = await adminApi.post("/api/admin/login", {
    data: {
      identifier: "admin@tokyo.test",
      password: "senha-segura",
      next: "/admin/",
    },
  });
  expect(adminLoginResponse.ok()).toBeTruthy();

  const adminStatusResponse = await adminApi.post("/api/admin/orders/status", {
    data: {
      orderId: createdOrder.order.id,
      status: "Em preparo",
      note: "Pedido entrou na cozinha.",
    },
  });
  expect(adminStatusResponse.ok()).toBeTruthy();

  await expect(page.locator("[data-tracking-root]")).toContainText("Em preparo", {
    timeout: 35000,
  });

  await page.locator("[data-auth-open]").first().click();
  await page.locator("[data-auth-logout]").click();

  await expect(page.locator("[data-order-cta]").first()).toHaveText("Pedir Agora", {
    timeout: 15000,
  });
  await expect(page.locator("[data-tracking-root]")).toContainText("Login necessário", {
    timeout: 15000,
  });

  expect(consoleErrors).toEqual([]);
});
