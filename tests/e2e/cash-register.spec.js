const path = require("node:path");
const { test, expect } = require("@playwright/test");
const {
  expectNoHorizontalOverflow,
  loginMaster,
  loginTenantOwner,
  onboardRestaurant,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");

const workspaceRoot = path.resolve(__dirname, "../..");
const isVercelPreviewToolbarCspError = (message) =>
  message.includes("https://vercel.live/_next-live/feedback/feedback.js") &&
  message.includes("Content Security Policy");

const postCashAction = async (api, action, data = {}) => {
  const response = await api.post(`/api/admin/cash-register/${action}`, {
    data,
  });
  const payload = await response.json().catch(() => ({}));
  expect(
    response.status(),
    `${action} failed: ${JSON.stringify(payload)}`
  ).toBe(200);
  return payload;
};

const expectCashFailure = async (api, action, data, errorCode) => {
  const response = await api.post(`/api/admin/cash-register/${action}`, {
    data,
  });
  const payload = await response.json().catch(() => ({}));
  expect(response.status(), `${action} should fail`).toBeGreaterThanOrEqual(400);
  expect(response.status(), `${action} should not fail as 500`).toBeLessThan(500);
  expect(payload.errorCode).toBe(errorCode);
  return payload;
};

test.describe.configure({ mode: "serial" });

test.describe("Caixa e Salao", () => {
  test("executa o atendimento presencial e permanece responsivo", async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    const failedResources = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !isVercelPreviewToolbarCspError(message.text())
      ) {
        consoleErrors.push(message.text());
      }
    });
    page.on("response", (response) => {
      if (response.status() >= 400) {
        failedResources.push(`${response.status()} ${response.url()}`);
      }
    });
    const master = await loginMaster();
    const restaurant = await onboardRestaurant(master.api, {
      key: uniqueKey("cash-ui"),
      name: "Restaurante Caixa UI",
      ownerPassword: "OwnerCashUi123!",
    });

    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.setExtraHTTPHeaders({
        "x-forwarded-host": restaurant.host,
        "x-forwarded-for": "127.31.41.51",
      });
      await page.goto(
        "/admin/login.html?next=%2Fadmin%2Fcaixa%2Fsalao",
        { waitUntil: "domcontentloaded" }
      );
      await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
      await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
      await page.locator("[data-admin-login-submit]").click();
      await expect(page).toHaveURL(/\/admin\/caixa\/salao$/);
      await expect(page.locator(".cash-register-module")).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText("Configure as mesas reais do salao")).toBeVisible();

      await page.locator('[data-cash-form="configure-tables"] input[name="count"]').fill("6");
      await page
        .locator('[data-cash-form="configure-tables"] input[name="capacity"]')
        .fill("4");
      await page
        .locator('[data-cash-form="configure-tables"] button[type="submit"]')
        .click();
      await expect(page.locator(".cash-table-card")).toHaveCount(6);
      await expect(page.getByText("Caixa fechado", { exact: true })).toBeVisible();

      await page.locator('[data-cash-view="opening"]').click();
      await expect(page).toHaveURL(/\/admin\/caixa\/abertura$/);
      await page
        .locator('[data-cash-form="open-register"] input[name="openingAmount"]')
        .fill("100");
      await page
        .locator('[data-cash-form="open-register"] textarea[name="notes"]')
        .fill("Abertura do teste E2E");
      await page
        .locator('[data-cash-form="open-register"] button[type="submit"]')
        .click();
      await expect(page).toHaveURL(/\/admin\/caixa\/salao$/);
      await expect(page.getByText("CAIXA ABERTO", { exact: true })).toBeVisible();

      await page.locator(".cash-table-card").first().click();
      await expect(page.locator('[data-cash-form="open-tab"]')).toBeVisible();
      await page
        .locator('[data-cash-form="open-tab"] input[name="guestCount"]')
        .fill("2");
      await page
        .locator('[data-cash-form="open-tab"] input[name="waiterName"]')
        .fill("Garcom E2E");
      await page
        .locator('[data-cash-form="open-tab"] input[name="customerName"]')
        .fill("Cliente Presencial");
      await page
        .locator('[data-cash-form="open-tab"] button[type="submit"]')
        .click();
      await expect(page.getByText("Comanda vazia")).toBeVisible();

      const productButtons = page.locator("[data-cash-product]");
      expect(await productButtons.count()).toBeGreaterThan(1);
      await productButtons.first().click();
      await expect(page.locator(".cash-item-row")).toHaveCount(1);
      await page.locator("[data-cash-item-note]").fill("Sem cebolinha");
      await page.locator("[data-cash-item-note]").press("Tab");
      await expect(page.locator("[data-cash-item-note]")).toHaveValue("Sem cebolinha");
      await page.locator('[data-cash-action="send-order"]').click();
      await expect(page.getByText("Pedido 1 enviado para producao.")).toBeVisible();

      await productButtons.first().click();
      await expect(page.locator(".cash-item-row")).toHaveCount(2);
      await page.locator('[data-cash-action="send-order"]').click();
      await expect(page.getByText("Pedido 2 enviado para producao.")).toBeVisible();
      await page.locator('[data-cash-pane="orders"]').click();
      await expect(page.locator(".cash-batch-list article")).toHaveCount(2);
      await page.locator('[data-cash-pane="consumption"]').click();

      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: path.join(workspaceRoot, "_tmp_cash_register_desktop.png"),
        fullPage: true,
      });

      await page.setViewportSize({ width: 1024, height: 768 });
      await expect(page.locator(".cash-payment-panel")).toBeVisible();
      expect(
        (await page.locator(".admin-sidebar").boundingBox())?.width || Infinity
      ).toBeLessThanOrEqual(220);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: path.join(workspaceRoot, "_tmp_cash_register_tablet.png"),
        fullPage: true,
      });

      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator(".cash-mobile-collapse")).toBeVisible();
      expect(
        (await page.locator(".cash-register-module").boundingBox())?.y || Infinity
      ).toBeLessThan(350);
      await page.locator(".cash-mobile-collapse").click();
      await expect(page.locator(".cash-tables-panel")).toHaveClass(/is-collapsed/);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: path.join(workspaceRoot, "_tmp_cash_register_mobile.png"),
        fullPage: true,
      });

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.locator('[data-cash-action="begin-closing"]').click();
      await expect(page.getByText("Conta calculada e aguardando pagamento.")).toBeVisible();
      await page.locator('[data-cash-payment-method="PIX"]').click();
      await expect(page.locator('[data-cash-action="confirm-payment"]')).toBeEnabled();
      await page.locator('[data-cash-action="confirm-payment"]').click();
      await expect(page.getByText("Pagamento confirmado e mesa liberada.")).toBeVisible();
      await expect(page.locator(".cash-table-card.is-free")).toHaveCount(6);
      await expect(page.getByText("Comprovante nao fiscal")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Imprimir comprovante" })
      ).toBeVisible();

      await page.locator('[data-cash-register-subview="closing"]').click();
      await expect(page).toHaveURL(/\/admin\/caixa\/fechamento$/);
      await expect(page.getByText("Resumo do caixa")).toBeVisible();
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .locator('[data-cash-form="close-register"] button[type="submit"]')
        .click();
      await expect(page.getByText("Caixa fechado com sucesso.")).toBeVisible();
      await expect(page.getByText("Nao ha caixa aberto")).toBeVisible();

      expect(pageErrors).toEqual([]);
      expect(
        consoleErrors,
        `Recursos com falha: ${failedResources.join(", ")}`
      ).toEqual([]);
    } finally {
      await master.api.dispose();
    }
  });

  test("valida pagamentos, concorrencia, auditoria e isolamento no banco Preview", async () => {
    const master = await loginMaster();
    const restaurantA = await onboardRestaurant(master.api, {
      key: uniqueKey("cash-api-a"),
      name: "Restaurante Caixa API A",
      ownerPassword: "OwnerCashApiA123!",
    });
    const restaurantB = await onboardRestaurant(master.api, {
      key: uniqueKey("cash-api-b"),
      name: "Restaurante Caixa API B",
      ownerPassword: "OwnerCashApiB123!",
    });
    const ownerA = await loginTenantOwner(restaurantA);
    const ownerB = await loginTenantOwner(restaurantB);

    try {
      await postCashAction(ownerA.api, "configure-tables", {
        count: 3,
        capacity: 4,
      });
      await postCashAction(ownerB.api, "configure-tables", {
        count: 2,
        capacity: 6,
      });
      const opened = await postCashAction(ownerA.api, "open", {
        openingAmount: 150,
        serviceChargeRate: 10,
        notes: "Turno E2E API",
      });
      expect(opened.snapshot.register.status).toBe("OPEN");
      await expectCashFailure(
        ownerA.api,
        "open",
        { openingAmount: 0 },
        "cash_register_already_open"
      );

      const snapshotResponse = await ownerA.api.get(
        "/api/admin/cash-register/snapshot"
      );
      expect(snapshotResponse.status()).toBe(200);
      const snapshot = await snapshotResponse.json();
      const products = snapshot.catalog.sections
        .flatMap((section) => section.items || [])
        .filter(
          (item) =>
            item.isOrderable === true &&
            item.isAvailable !== false &&
            item.isPaused !== true &&
            Number(item.price) > 0
        );
      expect(products.length).toBeGreaterThanOrEqual(2);
      const [productOne, productTwo] = products;
      const [tableOne, tableTwo] = snapshot.tables;

      const openedTab = await postCashAction(ownerA.api, "open-tab", {
        tableId: tableOne.id,
        waiterName: "Garcom API",
        waiterLogin: "garcom.api",
        guestCount: 2,
        customerName: "Cliente API",
      });
      const tabId = openedTab.tab.id;
      await expectCashFailure(
        ownerA.api,
        "open-tab",
        { tableId: tableOne.id, waiterName: "Outro", guestCount: 1 },
        "dining_table_already_has_tab"
      );

      const added = await postCashAction(ownerA.api, "add-item", {
        tabId,
        productId: productOne.id,
        quantity: 2,
        notes: "Sem cebolinha",
      });
      await postCashAction(ownerA.api, "update-item", {
        itemId: added.item.id,
        quantity: 3,
        notes: "Sem cebolinha e sem molho",
      });
      const removable = await postCashAction(ownerA.api, "add-item", {
        tabId,
        productId: productTwo.id,
        quantity: 1,
      });
      await postCashAction(ownerA.api, "remove-item", {
        itemId: removable.item.id,
      });

      const firstBatch = await postCashAction(ownerA.api, "send-order", {
        tabId,
      });
      expect(firstBatch.batch.batchNumber).toBe(1);
      expect(firstBatch.order.id).toBeTruthy();
      await expectCashFailure(
        ownerA.api,
        "send-order",
        { tabId },
        "dining_no_pending_items"
      );
      await expectCashFailure(
        ownerA.api,
        "update-item",
        { itemId: added.item.id, quantity: 4 },
        "dining_item_not_editable"
      );

      await postCashAction(ownerA.api, "add-item", {
        tabId,
        productId: productTwo.id,
        quantity: 1,
      });
      const secondBatch = await postCashAction(ownerA.api, "send-order", {
        tabId,
      });
      expect(secondBatch.batch.batchNumber).toBe(2);
      await expectCashFailure(
        ownerA.api,
        "close",
        { countedCash: 150 },
        "cash_register_has_open_tabs"
      );

      const closing = await postCashAction(ownerA.api, "begin-closing", {
        tabId,
        discountAmount: 1,
        serviceChargeEnabled: false,
        additionAmount: 2,
      });
      expect(closing.tab.status).toBe("AWAITING_PAYMENT");
      expect(closing.tab.serviceChargeAmount).toBe(0);
      await expectCashFailure(
        ownerA.api,
        "confirm-payment",
        {
          tabId,
          idempotencyKey: uniqueKey("payment-mismatch"),
          payments: [
            { method: "PIX", amount: closing.tab.totalAmount - 0.01 },
          ],
        },
        "cash_register_payment_total_mismatch"
      );

      const pixAmount = Number((closing.tab.totalAmount / 2).toFixed(2));
      const cashAmount = Number((closing.tab.totalAmount - pixAmount).toFixed(2));
      const idempotencyKey = uniqueKey("payment-split");
      const paymentPayload = {
        tabId,
        idempotencyKey,
        payments: [
          { method: "PIX", amount: pixAmount },
          {
            method: "CASH",
            amount: cashAmount,
            receivedAmount: cashAmount + 10,
          },
        ],
      };
      const payment = await postCashAction(
        ownerA.api,
        "confirm-payment",
        paymentPayload
      );
      expect(payment.payments).toHaveLength(2);
      expect(payment.payments[1].changeAmount).toBe(10);
      const duplicatePayment = await postCashAction(
        ownerA.api,
        "confirm-payment",
        paymentPayload
      );
      expect(duplicatePayment.alreadyProcessed).toBe(true);

      const secondTab = await postCashAction(ownerA.api, "open-tab", {
        tableId: tableTwo.id,
        waiterName: "Garcom Segundo",
        guestCount: 1,
      });
      await postCashAction(ownerA.api, "add-item", {
        tabId: secondTab.tab.id,
        productId: productOne.id,
        quantity: 1,
      });
      await postCashAction(ownerA.api, "send-order", {
        tabId: secondTab.tab.id,
      });
      const secondClosing = await postCashAction(
        ownerA.api,
        "begin-closing",
        {
          tabId: secondTab.tab.id,
          discountAmount: 0,
          serviceChargeEnabled: true,
        }
      );
      const singlePayment = await postCashAction(
        ownerA.api,
        "confirm-payment",
        {
          tabId: secondTab.tab.id,
          idempotencyKey: uniqueKey("payment-single"),
          payments: [
            { method: "PIX", amount: secondClosing.tab.totalAmount },
          ],
        }
      );
      expect(singlePayment.payments).toHaveLength(1);
      expect(singlePayment.payments[0].method).toBe("PIX");

      const finalSnapshotResponse = await ownerA.api.get(
        "/api/admin/cash-register/snapshot"
      );
      const finalSnapshot = await finalSnapshotResponse.json();
      expect(finalSnapshot.activeTabs).toHaveLength(0);
      expect(finalSnapshot.tables.every((table) => table.status === "FREE")).toBe(
        true
      );
      expect(finalSnapshot.registerSummary.closedTabs).toBe(2);
      expect(finalSnapshot.registerSummary.totalSold).toBeGreaterThan(0);
      const auditTypes = new Set(
        finalSnapshot.auditEvents.map((event) => event.eventType)
      );
      [
        "REGISTER_OPENED",
        "TAB_OPENED",
        "ITEM_ADDED",
        "ORDER_SENT",
        "TAB_AWAITING_PAYMENT",
        "PAYMENT_CONFIRMED",
        "TABLE_RELEASED",
      ].forEach((eventType) => expect(auditTypes.has(eventType)).toBe(true));
      expect(
        finalSnapshot.auditEvents.some(
          (event) =>
            event.eventType === "PAYMENT_CONFIRMED" &&
            event.metadata?.inventoryStrategy ===
              "existing_manual_inventory_without_recipe_mapping"
        )
      ).toBe(true);

      const isolatedResponse = await ownerB.api.get(
        "/api/admin/cash-register/snapshot"
      );
      expect(isolatedResponse.status()).toBe(200);
      const isolated = await isolatedResponse.json();
      expect(isolated.register).toBeNull();
      expect(isolated.tables).toHaveLength(2);
      expect(isolated.activeTabs).toHaveLength(0);

      const closed = await postCashAction(ownerA.api, "close", {
        countedCash: finalSnapshot.registerSummary.expectedCash,
        notes: "Conferencia E2E sem diferenca",
      });
      expect(closed.register.status).toBe("CLOSED");
      expect(closed.register.differenceAmount).toBe(0);
      await expectCashFailure(
        ownerA.api,
        "close",
        { countedCash: 0 },
        "cash_register_not_open"
      );
    } finally {
      await ownerA.api.dispose();
      await ownerB.api.dispose();
      await master.api.dispose();
    }
  });
});
