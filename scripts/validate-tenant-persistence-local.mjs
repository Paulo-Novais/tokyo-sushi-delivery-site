import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const realDataDirectory = path.join(workspaceRoot, ".data");

const actor = {
  login: "tenant-persistence@inovas.local",
  displayName: "Tenant Persistence Validator",
};

const getDirectoryFingerprint = async (directoryPath) => {
  const stats = await fs.stat(directoryPath).catch(() => null);

  if (!stats) {
    return { exists: false, entries: [] };
  }

  const entries = [];
  const visit = async (currentPath, relativeBase = "") => {
    const children = await fs.readdir(currentPath, { withFileTypes: true });

    for (const child of children) {
      const childPath = path.join(currentPath, child.name);
      const relativePath = path.join(relativeBase, child.name).replace(/\\/g, "/");
      const childStats = await fs.stat(childPath);

      entries.push({
        path: relativePath,
        type: child.isDirectory() ? "dir" : "file",
        size: childStats.size,
        mtimeMs: Math.round(childStats.mtimeMs),
      });

      if (child.isDirectory()) {
        await visit(childPath, relativePath);
      }
    }
  };

  await visit(directoryPath);
  entries.sort((left, right) => left.path.localeCompare(right.path));
  return { exists: true, entries };
};

const buildTenant = (buildTenantContext, restaurantKey, label) =>
  buildTenantContext(
    {
      host: `${restaurantKey}.tenant-persistence.local`,
      restaurantKey,
      restaurantName: label,
      matched: true,
      resolutionMode: "local-validation",
      multiRestaurantActive: false,
    },
    {
      source: "validate:tenant-persistence-local",
    }
  );

const readTempJson = async (tempRoot, relativePath, fallbackValue = {}) => {
  try {
    return JSON.parse(await fs.readFile(path.join(tempRoot, relativePath), "utf8"));
  } catch (error) {
    return fallbackValue;
  }
};

const scopeValue = (record = {}, camelKey, snakeKey) => record?.[camelKey] || record?.[snakeKey] || "";

const assertScope = (record = {}, tenant, label) => {
  assert.ok(record && typeof record === "object", `${label} deve existir`);
  assert.equal(scopeValue(record, "tenantId", "tenant_id"), tenant.tenantId, `${label}: tenantId`);
  assert.equal(scopeValue(record, "restaurantId", "restaurant_id"), tenant.restaurantId, `${label}: restaurantId`);
  assert.equal(scopeValue(record, "restaurantKey", "restaurant_key"), tenant.restaurantKey, `${label}: restaurantKey`);
};

const assertAllScoped = (records = [], label) => {
  for (const [index, record] of records.entries()) {
    assert.ok(scopeValue(record, "tenantId", "tenant_id"), `${label}[${index}] deve persistir tenantId`);
    assert.ok(scopeValue(record, "restaurantId", "restaurant_id"), `${label}[${index}] deve persistir restaurantId`);
    assert.ok(scopeValue(record, "restaurantKey", "restaurant_key"), `${label}[${index}] deve persistir restaurantKey`);
  }
};

const buildOrderPayload = () => ({
  profile: {
    id: "profile-shared",
    name: "Cliente Persistencia Compartilhado",
    phone: "(11) 97777-5555",
    email: "cliente-compartilhado@tenant.test",
  },
  checkout: {
    paymentMethod: "pix",
    fulfillmentMode: "pickup",
    timingMode: "immediate",
    scheduledDate: "",
    scheduledTime: "",
    cashChangeRequired: "",
    cashAmountProvided: "",
    customerNotes: "pedido tenant persistence",
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

const createTenantData = async ({
  tenant,
  options,
  label,
  catalog,
  deliverySettings,
  restaurantSettings,
  inventory,
  orderPayload,
  orders,
  customers,
  finance,
  reviews,
}) => {
  await restaurantSettings.updateRestaurantSettings(
    {
      restaurantName: `Persistencia ${label}`,
      whatsapp: label === "A" ? "5511977700001" : "5511977700002",
      seoTitle: `Persistencia ${label} SEO`,
    },
    actor,
    options
  );

  await deliverySettings.updateDeliverySettings(
    {
      status: {
        deliveriesEnabled: label === "A",
        pausedMessage: `Delivery persistente ${label}`,
      },
      distanceBands: [
        {
          id: "shared-distance-band",
          minKm: 0,
          maxKm: 4,
          customerFee: label === "A" ? 8 : 12,
          courierFee: 5,
          minimumOrder: 30,
          isActive: true,
        },
      ],
    },
    actor,
    options
  );

  const section = await catalog.saveCatalogSection(
    {
      title: "Persistencia Compartilhada",
      description: `Categoria gravada pelo tenant ${label}`,
    },
    actor,
    options
  );

  const item = await catalog.saveCatalogItem(
    {
      sectionId: section.sectionId,
      name: "Hot Roll Persistente",
      category: "Persistencia Compartilhada",
      price: label === "A" ? 39 : 47,
      availabilityState: "active",
    },
    actor,
    options
  );

  await catalog.savePromotion(
    {
      id: "shared-promotion-id",
      internalName: `Promocao persistente ${label}`,
      scopeType: "item",
      targetValue: item.item.id,
      pricingType: "percent_discount",
      discountPercent: label === "A" ? 10 : 15,
      startsAt: "2026-06-01T10:00",
      endsAt: "2026-07-31T22:00",
      isEnabled: true,
    },
    actor,
    options
  );

  await inventory.saveInventoryItem(
    {
      name: "Insumo Compartilhado",
      category: "Persistencia",
      quantity: label === "A" ? 11 : 22,
      unit: "kg",
      minimumQuantity: 2,
    },
    actor,
    options
  );

  const catalogContext = await catalog.getCatalogValidationContext(options);
  const normalizedOrder = orderPayload.normalizeOrderSubmission(buildOrderPayload(), catalogContext);
  const createdOrder = await orders.createOrder(normalizedOrder, options);
  assert.equal(createdOrder.created, true, `pedido ${label} deve ser criado mesmo com payload compartilhado`);

  await orders.updateAdminOrderStatus(createdOrder.order.publicId, "Aceito", `aceito ${label}`, {
    ...options,
    actor,
  });

  await customers.saveAdminCustomerProfile(
    {
      customerKey: normalizedOrder.customer.key,
      notes: `Perfil persistente ${label}`,
      tags: label === "A" ? ["vip"] : ["atencao"],
    },
    actor,
    options
  );

  await finance.saveFinanceClosing(
    {
      periodKey: "shared-period-key",
      periodStartDate: "2026-06-28",
      periodEndDate: "2026-06-28",
      countedCash: label === "A" ? 100 : 200,
      notes: `Fechamento persistente ${label}`,
    },
    actor,
    options
  );

  const review = await reviews.createPublicReview(
    {
      name: "Cliente Persistente",
      rating: label === "A" ? 5 : 4,
      message: `Review persistente ${label}`,
      source: "site",
    },
    options
  );

  const dashboard = await orders.getAdminDashboard(50, options);
  assert.ok(
    dashboard.orders.some((order) => order.publicId === createdOrder.order.publicId),
    `dashboard ${label} deve listar apenas pedido do proprio tenant`
  );

  const financeReport = await orders.getAdminFinance({}, options);
  assert.ok(
    financeReport.orders.some((order) => order.publicId === createdOrder.order.publicId),
    `financeiro ${label} deve listar pedido do proprio tenant`
  );

  const promotions = await catalog.getAdminPromotions({}, options);
  assert.ok(
    promotions.promotions.some((promotion) => promotion.id === "shared-promotion-id" && promotion.internalName === `Promocao persistente ${label}`),
    `promocoes ${label} devem respeitar tenant fisico`
  );

  return {
    tenant,
    label,
    sectionId: section.sectionId,
    itemId: item.item.id,
    orderPublicId: createdOrder.order.publicId,
    customerKey: normalizedOrder.customer.key,
    reviewId: review.reviewId,
  };
};

const assertPersistedData = async ({ tempRoot, tenantA, tenantB, createdA, createdB, defaultTenant }) => {
  assert.equal(createdA.sectionId, createdB.sectionId, "slugs/IDs de categoria iguais devem coexistir entre tenants");
  assert.equal(createdA.itemId, createdB.itemId, "slugs/IDs de item iguais devem coexistir entre tenants");
  assert.equal(createdA.customerKey, createdB.customerKey, "customerKey igual deve coexistir entre tenants");

  const ordersStore = await readTempJson(tempRoot, path.join(".data", "orders.json"), { orders: [], customers: [] });
  assertAllScoped(ordersStore.orders, "orders.orders");
  assertAllScoped(ordersStore.customers, "orders.customers");
  const orderA = ordersStore.orders.find((order) => order.publicId === createdA.orderPublicId);
  const orderB = ordersStore.orders.find((order) => order.publicId === createdB.orderPublicId);
  assertScope(orderA, tenantA, "pedido A persistido");
  assertScope(orderB, tenantB, "pedido B persistido");
  assertAllScoped(orderA.items || [], "pedido A itens");
  assertAllScoped(orderB.items || [], "pedido B itens");
  assertAllScoped(orderA.auditTrail || [], "pedido A auditoria");
  assertAllScoped(orderB.auditTrail || [], "pedido B auditoria");

  const crmStore = await readTempJson(tempRoot, path.join(".data", "customer-crm.json"), { profiles: [] });
  assertAllScoped(crmStore.profiles, "customer-crm.profiles");
  assertScope(crmStore.profiles.find((profile) => profile.notes === "Perfil persistente A"), tenantA, "perfil CRM A");
  assertScope(crmStore.profiles.find((profile) => profile.notes === "Perfil persistente B"), tenantB, "perfil CRM B");

  const financeStore = await readTempJson(tempRoot, path.join(".data", "finance-closings.json"), { closings: [] });
  assertAllScoped(financeStore.closings, "finance.closings");
  assertScope(financeStore.closings.find((closing) => closing.notes === "Fechamento persistente A"), tenantA, "fechamento A");
  assertScope(financeStore.closings.find((closing) => closing.notes === "Fechamento persistente B"), tenantB, "fechamento B");

  const reviewsStore = await readTempJson(tempRoot, path.join(".data", "reviews.json"), { reviews: [] });
  assertAllScoped(reviewsStore.reviews, "reviews.reviews");
  assertScope(reviewsStore.reviews.find((review) => review.id === createdA.reviewId), tenantA, "review A");
  assertScope(reviewsStore.reviews.find((review) => review.id === createdB.reviewId), tenantB, "review B");

  const catalogStore = await readTempJson(tempRoot, path.join(".data", "catalog-overrides.json"), { promotions: [], tenants: {} });
  assertScope(catalogStore, defaultTenant, "catalog default");
  assertScope(catalogStore.tenants?.[tenantA.restaurantKey], tenantA, "catalog tenant A");
  assertScope(catalogStore.tenants?.[tenantB.restaurantKey], tenantB, "catalog tenant B");
  assertAllScoped(catalogStore.promotions, "catalog.promotions");
  assertScope(
    catalogStore.promotions.find((promotion) => promotion.id === "shared-promotion-id" && promotion.internalName === "Promocao persistente A"),
    tenantA,
    "promocao A"
  );
  assertScope(
    catalogStore.promotions.find((promotion) => promotion.id === "shared-promotion-id" && promotion.internalName === "Promocao persistente B"),
    tenantB,
    "promocao B"
  );

  const inventoryStore = await readTempJson(tempRoot, path.join(".data", "inventory-store.json"), { tenants: {} });
  assertScope(inventoryStore, defaultTenant, "inventory default");
  assertScope(inventoryStore.tenants?.[tenantA.restaurantKey], tenantA, "inventory tenant A");
  assertScope(inventoryStore.tenants?.[tenantB.restaurantKey], tenantB, "inventory tenant B");
  assert.equal(
    inventoryStore.tenants?.[tenantA.restaurantKey]?.items?.find((item) => item.name === "Insumo Compartilhado")?.quantity,
    11,
    "estoque A deve manter quantidade propria"
  );
  assert.equal(
    inventoryStore.tenants?.[tenantB.restaurantKey]?.items?.find((item) => item.name === "Insumo Compartilhado")?.quantity,
    22,
    "estoque B deve manter quantidade propria"
  );

  const deliveryStore = await readTempJson(tempRoot, path.join(".data", "delivery-settings.json"), { tenants: {} });
  assertScope(deliveryStore, defaultTenant, "delivery default");
  assertScope(deliveryStore.tenants?.[tenantA.restaurantKey], tenantA, "delivery tenant A");
  assertScope(deliveryStore.tenants?.[tenantB.restaurantKey], tenantB, "delivery tenant B");

  const restaurantStore = await readTempJson(tempRoot, path.join(".data", "restaurant-settings.json"), { tenants: {} });
  assertScope(restaurantStore, defaultTenant, "restaurant settings default");
  assertScope(restaurantStore.tenants?.[tenantA.restaurantKey], tenantA, "restaurant settings tenant A");
  assertScope(restaurantStore.tenants?.[tenantB.restaurantKey], tenantB, "restaurant settings tenant B");
};

const runValidation = async () => {
  const originalCwd = process.cwd();
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    INOVAS_TENANT_MODE: process.env.INOVAS_TENANT_MODE,
  };
  const beforeFingerprint = await getDirectoryFingerprint(realDataDirectory);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tokyo-tenant-persistence-"));

  try {
    await fs.mkdir(path.join(tempRoot, ".data"), { recursive: true });
    await fs.copyFile(path.join(workspaceRoot, "script.js"), path.join(tempRoot, "script.js"));
    process.chdir(tempRoot);
    process.env.NODE_ENV = "development";
    process.env.INOVAS_TENANT_MODE = "default_only";
    delete process.env.DATABASE_URL;

    const { buildTenantContext } = require(path.join(workspaceRoot, "lib/tenant-context.cjs"));
    const tenantA = buildTenant(buildTenantContext, "tenant-a", "Tenant A Sushi");
    const tenantB = buildTenant(buildTenantContext, "tenant-b", "Tenant B Sushi");
    const defaultTenant = buildTenant(buildTenantContext, "default", "Tokyo Sushi");
    const optionsA = { tenantContext: tenantA };
    const optionsB = { tenantContext: tenantB };
    const defaultOptions = { tenantContext: defaultTenant };

    const restaurantSettings = require(path.join(workspaceRoot, "lib/restaurant-settings-store.cjs"));
    const deliverySettings = require(path.join(workspaceRoot, "lib/delivery-settings-store.cjs"));
    const catalog = require(path.join(workspaceRoot, "lib/catalog-store.cjs"));
    const inventory = require(path.join(workspaceRoot, "lib/inventory-store.cjs"));
    const orderPayload = require(path.join(workspaceRoot, "lib/order-payload.cjs"));
    const orders = require(path.join(workspaceRoot, "lib/order-store.cjs"));
    const customers = require(path.join(workspaceRoot, "lib/customer-crm-store.cjs"));
    const finance = require(path.join(workspaceRoot, "lib/finance-store.cjs"));
    const reviews = require(path.join(workspaceRoot, "lib/review-store.cjs"));

    const createdA = await createTenantData({
      tenant: tenantA,
      options: optionsA,
      label: "A",
      catalog,
      deliverySettings,
      restaurantSettings,
      inventory,
      orderPayload,
      orders,
      customers,
      finance,
      reviews,
    });
    const createdB = await createTenantData({
      tenant: tenantB,
      options: optionsB,
      label: "B",
      catalog,
      deliverySettings,
      restaurantSettings,
      inventory,
      orderPayload,
      orders,
      customers,
      finance,
      reviews,
    });

    const dashboardA = await orders.getAdminDashboard(50, optionsA);
    const dashboardB = await orders.getAdminDashboard(50, optionsB);
    assert.ok(!dashboardA.orders.some((order) => order.publicId === createdB.orderPublicId), "dashboard A nao pode listar pedido B");
    assert.ok(!dashboardB.orders.some((order) => order.publicId === createdA.orderPublicId), "dashboard B nao pode listar pedido A");

    const financeA = await orders.getAdminFinance({}, optionsA);
    const financeB = await orders.getAdminFinance({}, optionsB);
    assert.ok(!financeA.orders.some((order) => order.publicId === createdB.orderPublicId), "financeiro A nao pode listar pedido B");
    assert.ok(!financeB.orders.some((order) => order.publicId === createdA.orderPublicId), "financeiro B nao pode listar pedido A");

    const defaultCatalog = await catalog.getPublicCatalogState(defaultOptions);
    const defaultSettings = await restaurantSettings.getPublicRestaurantSettings(defaultOptions);
    assert.ok(defaultCatalog.sections.length > 0, "default_only deve continuar carregando catalogo Tokyo");
    assert.equal(defaultSettings.settings.restaurantKey, "default", "default_only deve manter Tokyo/default");

    await assertPersistedData({
      tempRoot,
      tenantA,
      tenantB,
      createdA,
      createdB,
      defaultTenant,
    });
  } finally {
    process.chdir(originalCwd);

    if (typeof originalEnv.NODE_ENV === "undefined") {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalEnv.NODE_ENV;
    }

    if (typeof originalEnv.DATABASE_URL === "undefined") {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalEnv.DATABASE_URL;
    }

    if (typeof originalEnv.INOVAS_TENANT_MODE === "undefined") {
      delete process.env.INOVAS_TENANT_MODE;
    } else {
      process.env.INOVAS_TENANT_MODE = originalEnv.INOVAS_TENANT_MODE;
    }

    await fs.rm(tempRoot, { recursive: true, force: true });
  }

  const afterFingerprint = await getDirectoryFingerprint(realDataDirectory);
  assert.deepEqual(afterFingerprint, beforeFingerprint, "Validacao nao deve tocar .data real.");
};

runValidation()
  .then(() => {
    console.log("validate:tenant-persistence-local OK");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
