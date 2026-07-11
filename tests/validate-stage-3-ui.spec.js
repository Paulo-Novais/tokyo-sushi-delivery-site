const { test, expect, request } = require("@playwright/test");

const baseURL = process.env.BASE_URL || process.env.VALIDATION_BASE_URL || "http://127.0.0.1:3000";
const adminLogin = process.env.E2E_ADMIN_LOGIN;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

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

const findOrderableCatalogItem = (catalogPayload) => {
  const sectionItems = (catalogPayload.sections || []).flatMap((section) =>
    (section.items || []).map((item) => ({
      ...item,
      sectionId: item.sectionId || section.id || "",
      sectionTitle: item.sectionTitle || section.title || "",
    }))
  );
  return sectionItems.find((item) => item.id && item.name && item.isOrderable !== false) || null;
};

const buildOrderPayload = (nonce, catalogItem) => ({
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
      id: catalogItem.id,
      name: catalogItem.name,
      category: catalogItem.category || catalogItem.sectionTitle || "Cardapio",
      quantity: 1,
      price: Number(catalogItem.price || catalogItem.regularPrice || 1),
    },
  ],
  addons: [],
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

  expect(adminLogin, "E2E_ADMIN_LOGIN precisa estar configurado.").toBeTruthy();
  expect(adminPassword, "E2E_ADMIN_PASSWORD precisa estar configurado.").toBeTruthy();

  const publicApi = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      origin: baseURL,
      accept: "application/json",
    },
  });

  const catalogResponse = await publicApi.get("/api/catalog");
  expect(catalogResponse.ok()).toBeTruthy();
  const catalogPayload = await catalogResponse.json();
  const catalogItem = findOrderableCatalogItem(catalogPayload);
  expect(catalogItem, "O catalogo publico precisa expor ao menos um item compravel.").toBeTruthy();

  const createOrderResponse = await publicApi.post("/api/orders/create", {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-tokyo-customer-client-token": orderCreationClientToken,
      "x-tokyo-customer-key": customerKey,
    },
    data: buildOrderPayload(nonce, catalogItem),
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
  await expect(page.locator("[data-tracking-root]")).toContainText("Recebido");

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
      identifier: adminLogin,
      password: adminPassword,
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
