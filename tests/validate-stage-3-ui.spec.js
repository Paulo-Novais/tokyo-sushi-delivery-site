const { test, expect, request } = require("@playwright/test");

const baseURL = process.env.BASE_URL || process.env.VALIDATION_BASE_URL || "http://127.0.0.1:3000";
const baseHost = new URL(baseURL).hostname.toLowerCase();
const previewRestaurantSlug =
  process.env.E2E_PUBLIC_RESTAURANT_SLUG || "tokyo-sushi";
const isVercelPreview = baseHost.endsWith(".vercel.app");

const isVercelPreviewToolbarCspError = (message) =>
  message.includes("https://vercel.live/_next-live/feedback/feedback.js") &&
  message.includes("Content Security Policy");

const getFutureScheduledDate = () => {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
};

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

const buildOrderPayload = (nonce, catalogItem, profile) => ({
  profile: {
    id: profile.id,
    name: profile.name,
    phone: profile.phone,
    email: profile.email,
  },
  checkout: {
    paymentMethod: "pix",
    fulfillmentMode: "delivery",
    timingMode: "scheduled",
    scheduledDate: getFutureScheduledDate(),
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

test("ETAPA 3 publica: login, tracking, botao dinamico e logout", async ({
  page,
}) => {
  const nonce = Date.now();
  const phoneSuffix = String(nonce).slice(-8).padStart(8, "0");
  const testCustomer = {
    ...customer,
    id: `profile-ui-stage3-${nonce}`,
    phone: `(11) 9${phoneSuffix.slice(0, 4)}-${phoneSuffix.slice(4)}`,
    email: `cliente-ui-${nonce}@teste.invalid`,
  };
  const customerKey = buildCustomerKey(testCustomer);
  const orderCreationClientToken = "ui-create-device-token";
  const trackingClientToken = "ui-track-device-token";

  const publicApi = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      origin: baseURL,
      accept: "application/json",
      ...(isVercelPreview
        ? { cookie: `inovas_restaurant_slug=${previewRestaurantSlug}` }
        : {}),
    },
  });

  if (isVercelPreview) {
    await page.context().addCookies([
      {
        name: "inovas_restaurant_slug",
        value: previewRestaurantSlug,
        domain: baseHost,
        path: "/",
        secure: true,
        sameSite: "Lax",
      },
    ]);
  }

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
    data: buildOrderPayload(nonce, catalogItem, testCustomer),
  });
  expect(createOrderResponse.ok()).toBeTruthy();
  const createdOrder = await createOrderResponse.json();
  const publicId = createdOrder.order.publicId;

  await page.addInitScript((clientToken) => {
    window.localStorage.setItem("tokyo_customer_client_token", clientToken);
  }, trackingClientToken);

  const consoleErrors = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !isVercelPreviewToolbarCspError(message.text())
    ) {
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
  const phoneForm = page.locator("[data-auth-phone-form]").filter({ has: page.locator('input[name="entry_phone"]') });
  await expect(phoneForm).toBeVisible({ timeout: 15000 });
  const nameInput = phoneForm.locator('input[name="entry_name"]');
  const phoneInput = phoneForm.locator('input[name="entry_phone"]');
  await nameInput.fill("");
  await phoneInput.fill("");
  await nameInput.fill(testCustomer.name);
  await phoneInput.fill(testCustomer.phone);
  await expect(phoneInput).toHaveValue(testCustomer.phone);
  await phoneForm.locator(".auth-submit").click();

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
