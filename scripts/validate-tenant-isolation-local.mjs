import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const realDataDirectory = path.join(workspaceRoot, ".data");

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
      host: `${restaurantKey}.tenant-isolation.local`,
      restaurantKey,
      restaurantName: label,
      matched: true,
      resolutionMode: "local-validation",
      multiRestaurantActive: false,
    },
    {
      source: "validate:tenant-isolation-local",
    }
  );

const actor = {
  login: "tenant-isolation@inovas.local",
  displayName: "Tenant Isolation Validator",
};

const assertRejectsWithoutTenant = async (label, fn) => {
  await assert.rejects(
    fn,
    (error) => error?.errorCode === "tenant_context_required",
    `${label} deve falhar sem tenantContext`
  );
};

const findByName = (items = [], name) => items.find((item) => item.name === name);
const hasName = (items = [], name) => Boolean(findByName(items, name));
const flattenCatalogItems = (catalog) =>
  (Array.isArray(catalog?.sections) ? catalog.sections : []).flatMap((section) => section.items || []);

const buildOrderPayload = (label) => ({
  profile: {
    id: `profile-${label}`,
    name: `Cliente ${label}`,
    phone: "(11) 98888-7777",
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
    customerNotes: "pedido tenant isolation",
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

const readTempJson = async (tempRoot, relativePath, fallbackValue = {}) => {
  try {
    return JSON.parse(await fs.readFile(path.join(tempRoot, relativePath), "utf8"));
  } catch (error) {
    return fallbackValue;
  }
};

const getScopeValue = (record = {}, camelKey, snakeKey) => record?.[camelKey] || record?.[snakeKey] || "";

const assertPhysicalScope = (record = {}, tenant, label) => {
  assert.equal(getScopeValue(record, "tenantId", "tenant_id"), tenant.tenantId, `${label}: tenantId`);
  assert.equal(getScopeValue(record, "restaurantId", "restaurant_id"), tenant.restaurantId, `${label}: restaurantId`);
  assert.equal(getScopeValue(record, "restaurantKey", "restaurant_key"), tenant.restaurantKey, `${label}: restaurantKey`);
};

const assertEveryScopedRecord = (records = [], label) => {
  for (const [index, record] of records.entries()) {
    assert.ok(getScopeValue(record, "tenantId", "tenant_id"), `${label}[${index}] deve persistir tenantId`);
    assert.ok(getScopeValue(record, "restaurantId", "restaurant_id"), `${label}[${index}] deve persistir restaurantId`);
    assert.ok(getScopeValue(record, "restaurantKey", "restaurant_key"), `${label}[${index}] deve persistir restaurantKey`);
  }
};

const assertTenantContainerScope = (container = {}, tenant, label) => {
  assert.ok(container && typeof container === "object", `${label} deve existir`);
  assertPhysicalScope(container, tenant, label);
};

const assertPhysicalPersistence = async ({ tempRoot, tenantA, tenantB, defaultTenant }) => {
  const ordersStore = await readTempJson(tempRoot, path.join(".data", "orders.json"), { orders: [], customers: [] });
  assertEveryScopedRecord(ordersStore.orders, "orders.orders");
  assertEveryScopedRecord(ordersStore.customers, "orders.customers");

  const orderA = ordersStore.orders.find((order) => order.customerEmail === "cliente-a@tenant.test");
  const orderB = ordersStore.orders.find((order) => order.customerEmail === "cliente-b@tenant.test");
  assertPhysicalScope(orderA, tenantA, "pedido tenant A");
  assertPhysicalScope(orderB, tenantB, "pedido tenant B");
  assertEveryScopedRecord(orderA.items || [], "pedido tenant A itens");
  assertEveryScopedRecord(orderB.items || [], "pedido tenant B itens");
  assertEveryScopedRecord(orderA.auditTrail || [], "pedido tenant A auditoria");
  assertEveryScopedRecord(orderB.auditTrail || [], "pedido tenant B auditoria");

  const crmStore = await readTempJson(tempRoot, path.join(".data", "customer-crm.json"), { profiles: [] });
  assertEveryScopedRecord(crmStore.profiles, "customer-crm.profiles");
  assert.ok(
    crmStore.profiles.some((profile) => profile.notes === "Cliente A isolado" && profile.tenantId === tenantA.tenantId),
    "CRM deve gravar perfil A com tenant fisico"
  );
  assert.ok(
    crmStore.profiles.some((profile) => profile.notes === "Cliente B isolado" && profile.tenantId === tenantB.tenantId),
    "CRM deve gravar perfil B com tenant fisico"
  );

  const financeStore = await readTempJson(tempRoot, path.join(".data", "finance-closings.json"), { closings: [] });
  assertEveryScopedRecord(financeStore.closings, "finance.closings");
  assert.ok(
    financeStore.closings.some((closing) => closing.notes === "Fechamento A" && closing.tenantId === tenantA.tenantId),
    "financeiro deve gravar fechamento A com tenant fisico"
  );
  assert.ok(
    financeStore.closings.some((closing) => closing.notes === "Fechamento B" && closing.tenantId === tenantB.tenantId),
    "financeiro deve gravar fechamento B com tenant fisico"
  );

  const reviewsStore = await readTempJson(tempRoot, path.join(".data", "reviews.json"), { reviews: [] });
  assertEveryScopedRecord(reviewsStore.reviews, "reviews.reviews");
  assert.ok(
    reviewsStore.reviews.some((review) => review.message === "Avaliacao tenant B" && review.tenantId === tenantB.tenantId),
    "reviews deve manter avaliacao B com tenant fisico apos exclusao isolada de A"
  );

  const inventoryStore = await readTempJson(tempRoot, path.join(".data", "inventory-store.json"), { tenants: {} });
  assertPhysicalScope(inventoryStore, defaultTenant, "inventory default");
  assertTenantContainerScope(inventoryStore.tenants?.[tenantA.restaurantKey], tenantA, "inventory tenant A");
  assertTenantContainerScope(inventoryStore.tenants?.[tenantB.restaurantKey], tenantB, "inventory tenant B");

  const deliveryStore = await readTempJson(tempRoot, path.join(".data", "delivery-settings.json"), { tenants: {} });
  assertPhysicalScope(deliveryStore, defaultTenant, "delivery default");
  assertTenantContainerScope(deliveryStore.tenants?.[tenantA.restaurantKey], tenantA, "delivery tenant A");
  assertTenantContainerScope(deliveryStore.tenants?.[tenantB.restaurantKey], tenantB, "delivery tenant B");

  const restaurantStore = await readTempJson(tempRoot, path.join(".data", "restaurant-settings.json"), { tenants: {} });
  assertPhysicalScope(restaurantStore, defaultTenant, "restaurant settings default");
  assertTenantContainerScope(restaurantStore.tenants?.[tenantA.restaurantKey], tenantA, "restaurant settings tenant A");
  assertTenantContainerScope(restaurantStore.tenants?.[tenantB.restaurantKey], tenantB, "restaurant settings tenant B");

  const catalogStore = await readTempJson(tempRoot, path.join(".data", "catalog-overrides.json"), { tenants: {}, items: [], promotions: [] });
  assertPhysicalScope(catalogStore, defaultTenant, "catalog default");
  assertTenantContainerScope(catalogStore.tenants?.[tenantA.restaurantKey], tenantA, "catalog tenant A");
  assertTenantContainerScope(catalogStore.tenants?.[tenantB.restaurantKey], tenantB, "catalog tenant B");
  assertEveryScopedRecord(catalogStore.items || [], "catalog.items");
  assertEveryScopedRecord(catalogStore.promotions || [], "catalog.promotions");
};

const validateSettingsIsolation = async ({ restaurantSettings, deliverySettings, tenantA, tenantB, optionsA, optionsB }) => {
  await restaurantSettings.updateRestaurantSettings(
    {
      restaurantName: "Tenant A Sushi",
      whatsapp: "5511999900001",
      seoTitle: "Tenant A SEO",
    },
    actor,
    optionsA
  );
  await restaurantSettings.updateRestaurantSettings(
    {
      restaurantName: "Tenant B Sushi",
      whatsapp: "5511999900002",
      seoTitle: "Tenant B SEO",
    },
    actor,
    optionsB
  );

  const publicRestaurantA = await restaurantSettings.getPublicRestaurantSettings(optionsA);
  const publicRestaurantB = await restaurantSettings.getPublicRestaurantSettings(optionsB);
  assert.equal(publicRestaurantA.settings.restaurantName, "Tenant A Sushi");
  assert.equal(publicRestaurantB.settings.restaurantName, "Tenant B Sushi");
  assert.equal(publicRestaurantA.settings.restaurantKey, tenantA.restaurantKey);
  assert.equal(publicRestaurantB.settings.restaurantKey, tenantB.restaurantKey);

  await deliverySettings.updateDeliverySettings(
    {
      status: {
        deliveriesEnabled: true,
        pausedMessage: "Entrega A",
      },
      distanceBands: [
        {
          id: "tenant-a-band",
          minKm: 0,
          maxKm: 3,
          customerFee: 7,
          courierFee: 4,
          minimumOrder: 20,
          isActive: true,
        },
      ],
    },
    actor,
    optionsA
  );
  await deliverySettings.updateDeliverySettings(
    {
      status: {
        deliveriesEnabled: false,
        pausedMessage: "Retirada B",
      },
      distanceBands: [
        {
          id: "tenant-b-band",
          minKm: 0,
          maxKm: 5,
          customerFee: 11,
          courierFee: 5,
          minimumOrder: 30,
          isActive: true,
        },
      ],
    },
    actor,
    optionsB
  );

  const deliveryA = await deliverySettings.getPublicDeliverySettings(optionsA);
  const deliveryB = await deliverySettings.getPublicDeliverySettings(optionsB);
  assert.equal(deliveryA.settings.status.pausedMessage, "Entrega A");
  assert.equal(deliveryB.settings.status.pausedMessage, "Retirada B");
  assert.equal(deliveryA.settings.distanceBands[0].customerFee, 7);
  assert.equal(deliveryB.settings.distanceBands[0].customerFee, 11);
};

const validateCatalogIsolation = async ({ catalog, optionsA, optionsB }) => {
  const sectionA = await catalog.saveCatalogSection(
    {
      title: "Tenant A Exclusivos",
      description: "Categoria apenas A",
    },
    actor,
    optionsA
  );
  const sectionB = await catalog.saveCatalogSection(
    {
      title: "Tenant B Exclusivos",
      description: "Categoria apenas B",
    },
    actor,
    optionsB
  );

  const itemA = await catalog.saveCatalogItem(
    {
      sectionId: sectionA.sectionId,
      name: "Uramaki Tenant A",
      category: "Tenant A Exclusivos",
      price: 41.5,
      availabilityState: "active",
    },
    actor,
    optionsA
  );
  const itemB = await catalog.saveCatalogItem(
    {
      sectionId: sectionB.sectionId,
      name: "Uramaki Tenant B",
      category: "Tenant B Exclusivos",
      price: 43.5,
      availabilityState: "active",
    },
    actor,
    optionsB
  );

  let catalogA = await catalog.getAdminCatalog({}, optionsA);
  let catalogB = await catalog.getAdminCatalog({}, optionsB);
  assert.ok(hasName(flattenCatalogItems(catalogA), "Uramaki Tenant A"));
  assert.ok(!hasName(flattenCatalogItems(catalogA), "Uramaki Tenant B"));
  assert.ok(hasName(flattenCatalogItems(catalogB), "Uramaki Tenant B"));
  assert.ok(!hasName(flattenCatalogItems(catalogB), "Uramaki Tenant A"));

  await catalog.updateCatalogItem(
    {
      itemId: itemA.item.id,
      name: "Uramaki Tenant A Editado",
      price: 45,
      availabilityState: "paused",
    },
    actor,
    optionsA
  );
  catalogA = await catalog.getAdminCatalog({}, optionsA);
  catalogB = await catalog.getAdminCatalog({}, optionsB);
  assert.ok(hasName(flattenCatalogItems(catalogA), "Uramaki Tenant A Editado"));
  assert.ok(!hasName(flattenCatalogItems(catalogB), "Uramaki Tenant A Editado"));

  await catalog.deleteCatalogItem({ itemId: itemA.item.id }, actor, optionsA);
  catalogA = await catalog.getAdminCatalog({}, optionsA);
  catalogB = await catalog.getAdminCatalog({}, optionsB);
  assert.ok(!hasName(flattenCatalogItems(catalogA), "Uramaki Tenant A Editado"));
  assert.ok(hasName(flattenCatalogItems(catalogB), "Uramaki Tenant B"));

  await catalog.deleteCatalogSection({ sectionId: sectionA.sectionId }, actor, optionsA);
  await catalog.deleteCatalogSection({ sectionId: sectionB.sectionId }, actor, optionsB);
};

const validateInventoryIsolation = async ({ inventory, optionsA, optionsB }) => {
  const savedA = await inventory.saveInventoryItem(
    {
      name: "Wasabi Tenant A",
      category: "Teste Tenant",
      quantity: 10,
      unit: "kg",
      minimumQuantity: 2,
    },
    actor,
    optionsA
  );
  const savedB = await inventory.saveInventoryItem(
    {
      name: "Wasabi Tenant B",
      category: "Teste Tenant",
      quantity: 20,
      unit: "kg",
      minimumQuantity: 3,
    },
    actor,
    optionsB
  );

  await inventory.adjustInventoryStock(
    {
      itemId: savedA.itemId,
      mode: "remove",
      amount: 4,
    },
    actor,
    optionsA
  );

  const inventoryA = await inventory.getAdminInventory({}, optionsA);
  const inventoryB = await inventory.getAdminInventory({}, optionsB);
  assert.equal(findByName(inventoryA.items, "Wasabi Tenant A")?.quantity, 6);
  assert.ok(!hasName(inventoryA.items, "Wasabi Tenant B"));
  assert.equal(findByName(inventoryB.items, "Wasabi Tenant B")?.quantity, 20);
  assert.ok(!hasName(inventoryB.items, "Wasabi Tenant A"));
  assert.ok(savedB.itemId, "item B criado para validar caminho de criacao");
};

const validateOrderCustomerFinanceIsolation = async ({
  catalog,
  orderPayload,
  orders,
  customers,
  finance,
  optionsA,
  optionsB,
}) => {
  const catalogContextA = await catalog.getCatalogValidationContext(optionsA);
  const catalogContextB = await catalog.getCatalogValidationContext(optionsB);
  const normalizedA = orderPayload.normalizeOrderSubmission(buildOrderPayload("a"), catalogContextA);
  const normalizedB = orderPayload.normalizeOrderSubmission(buildOrderPayload("b"), catalogContextB);

  const createdA = await orders.createOrder(normalizedA, optionsA);
  const createdB = await orders.createOrder(normalizedB, optionsB);
  assert.equal(createdA.created, true, "pedido A deve ser criado");
  assert.equal(createdB.created, true, "pedido B deve ser criado mesmo com mesmo telefone/customerKey");

  const duplicateA = await orders.createOrder(normalizedA, optionsA);
  assert.equal(duplicateA.created, false, "deduplicacao deve ocorrer apenas dentro do tenant A");

  const listA = await orders.getAdminOrderList(100, optionsA);
  const listB = await orders.getAdminOrderList(100, optionsB);
  assert.ok(listA.orders.some((order) => order.publicId === createdA.order.publicId));
  assert.ok(!listA.orders.some((order) => order.publicId === createdB.order.publicId));
  assert.ok(listB.orders.some((order) => order.publicId === createdB.order.publicId));
  assert.ok(!listB.orders.some((order) => order.publicId === createdA.order.publicId));

  await assert.rejects(
    () => orders.getAdminOrderDetails(createdB.order.publicId, optionsA),
    (error) => error?.errorCode === "order_not_found",
    "tenant A nao pode abrir pedido do tenant B"
  );

  await orders.updateAdminOrderStatus(createdA.order.publicId, "Aceito", "aceito A", {
    ...optionsA,
    actor,
  });
  await assert.rejects(
    () =>
      orders.updateAdminOrderStatus(createdB.order.publicId, "Aceito", "tentativa cruzada", {
        ...optionsA,
        actor,
      }),
    (error) => error?.errorCode === "order_not_found",
    "tenant A nao pode atualizar pedido do tenant B"
  );

  const activeA = await orders.getCustomerActiveOrder(normalizedA.customer.key, optionsA);
  const activeB = await orders.getCustomerActiveOrder(normalizedB.customer.key, optionsB);
  assert.equal(activeA.order.publicId, createdA.order.publicId);
  assert.equal(activeB.order.publicId, createdB.order.publicId);

  await customers.saveAdminCustomerProfile(
    {
      customerKey: normalizedA.customer.key,
      notes: "Cliente A isolado",
      tags: ["vip"],
    },
    actor,
    optionsA
  );
  await customers.saveAdminCustomerProfile(
    {
      customerKey: normalizedB.customer.key,
      notes: "Cliente B isolado",
      tags: ["atencao"],
    },
    actor,
    optionsB
  );

  const customersA = await customers.getAdminCustomers({}, optionsA);
  const customersB = await customers.getAdminCustomers({}, optionsB);
  assert.equal(customersA.summary.totalCustomers, 1);
  assert.equal(customersB.summary.totalCustomers, 1);
  assert.equal(customersA.customers[0].notes, "Cliente A isolado");
  assert.equal(customersB.customers[0].notes, "Cliente B isolado");

  await finance.saveFinanceClosing(
    {
      periodKey: "tenant-ab:test-period",
      periodStartDate: "2026-06-01",
      periodEndDate: "2026-06-01",
      countedCash: 123,
      notes: "Fechamento A",
    },
    actor,
    optionsA
  );
  await finance.saveFinanceClosing(
    {
      periodKey: "tenant-ab:test-period",
      periodStartDate: "2026-06-01",
      periodEndDate: "2026-06-01",
      countedCash: 456,
      notes: "Fechamento B",
    },
    actor,
    optionsB
  );

  const closingA = await finance.getFinanceClosing("tenant-ab:test-period", optionsA);
  const closingB = await finance.getFinanceClosing("tenant-ab:test-period", optionsB);
  assert.equal(closingA.countedCash, 123);
  assert.equal(closingB.countedCash, 456);
};

const validateReviewIsolation = async ({ reviews, optionsA, optionsB }) => {
  const reviewA = await reviews.createPublicReview(
    {
      name: "Cliente Review A",
      rating: 5,
      message: "Avaliacao tenant A",
      source: "site",
    },
    optionsA
  );
  const reviewB = await reviews.createPublicReview(
    {
      name: "Cliente Review B",
      rating: 4,
      message: "Avaliacao tenant B",
      source: "site",
    },
    optionsB
  );

  let publicA = await reviews.getPublicReviewsSnapshot(optionsA);
  let publicB = await reviews.getPublicReviewsSnapshot(optionsB);
  assert.ok(publicA.reviews.some((review) => review.id === reviewA.reviewId));
  assert.ok(!publicA.reviews.some((review) => review.id === reviewB.reviewId));
  assert.ok(publicB.reviews.some((review) => review.id === reviewB.reviewId));
  assert.ok(!publicB.reviews.some((review) => review.id === reviewA.reviewId));

  await reviews.updateReviewVisibility({ id: reviewA.reviewId, visibilityState: "hidden" }, actor, optionsA);
  publicA = await reviews.getPublicReviewsSnapshot(optionsA);
  publicB = await reviews.getPublicReviewsSnapshot(optionsB);
  assert.ok(!publicA.reviews.some((review) => review.id === reviewA.reviewId));
  assert.ok(publicB.reviews.some((review) => review.id === reviewB.reviewId));

  await reviews.deleteReview({ id: reviewA.reviewId }, optionsA);
  const adminA = await reviews.getAdminReviews(optionsA);
  const adminB = await reviews.getAdminReviews(optionsB);
  assert.ok(!adminA.reviews.some((review) => review.id === reviewA.reviewId));
  assert.ok(adminB.reviews.some((review) => review.id === reviewB.reviewId));
};

const validateDefaultOnlyCompatibility = async ({ restaurantSettings, catalog, orders, defaultOptions }) => {
  const settings = await restaurantSettings.getPublicRestaurantSettings(defaultOptions);
  assert.equal(settings.settings.restaurantKey, "default");
  assert.ok(settings.settings.name || settings.settings.restaurantName, "tenant default deve manter configuracao Tokyo");

  const publicCatalog = await catalog.getPublicCatalogState(defaultOptions);
  assert.ok(publicCatalog.sections.length > 0, "catalogo default_only deve continuar carregando o catalogo Tokyo");

  const orderList = await orders.getAdminOrderList(10, defaultOptions);
  assert.equal(Array.isArray(orderList.orders), true, "lista de pedidos default deve continuar respondendo");
};

const runValidation = async () => {
  const originalCwd = process.cwd();
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    INOVAS_TENANT_MODE: process.env.INOVAS_TENANT_MODE,
  };
  const beforeFingerprint = await getDirectoryFingerprint(realDataDirectory);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tokyo-tenant-isolation-"));

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

    await Promise.all([
      assertRejectsWithoutTenant("orders:list", () => orders.getAdminOrderList(1)),
      assertRejectsWithoutTenant("orders:create", () => orders.createOrder({})),
      assertRejectsWithoutTenant("customers:list", () => customers.getAdminCustomers({})),
      assertRejectsWithoutTenant("catalog:public", () => catalog.getPublicCatalogState()),
      assertRejectsWithoutTenant("inventory:list", () => inventory.getAdminInventory({})),
      assertRejectsWithoutTenant("finance:get", () => finance.getFinanceClosing("tenant-ab:test-period")),
      assertRejectsWithoutTenant("reviews:list", () => reviews.getAdminReviews()),
      assertRejectsWithoutTenant("delivery:public", () => deliverySettings.getPublicDeliverySettings()),
      assertRejectsWithoutTenant("restaurant:public", () => restaurantSettings.getPublicRestaurantSettings()),
    ]);

    await validateSettingsIsolation({
      restaurantSettings,
      deliverySettings,
      tenantA,
      tenantB,
      optionsA,
      optionsB,
    });
    await validateCatalogIsolation({ catalog, optionsA, optionsB });
    await validateInventoryIsolation({ inventory, optionsA, optionsB });
    await validateOrderCustomerFinanceIsolation({
      catalog,
      orderPayload,
      orders,
      customers,
      finance,
      optionsA,
      optionsB,
    });
    await validateReviewIsolation({ reviews, optionsA, optionsB });
    await validateDefaultOnlyCompatibility({
      restaurantSettings,
      catalog,
      orders,
      defaultOptions,
    });
    await assertPhysicalPersistence({
      tempRoot,
      tenantA,
      tenantB,
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
    console.log("validate:tenant-isolation-local OK");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
