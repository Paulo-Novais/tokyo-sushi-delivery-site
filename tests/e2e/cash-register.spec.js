const path = require("node:path");
const fs = require("node:fs/promises");
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
      name: "Kasulo",
      ownerPassword: "OwnerCashUi123!",
    });

    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.setExtraHTTPHeaders({
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
      await expect(page.getByText("Abra o Caixa para configurar o Salao")).toBeVisible();

      await page.locator('[data-cash-view="opening"]').click();
      await expect(page).toHaveURL(/\/admin\/caixa\/abertura$/);
      await page
        .locator('[data-cash-form="open-register"] input[name="openingAmount"]')
        .fill("100");
      await page
        .locator('[data-cash-form="open-register"] input[name="tableCount"]')
        .fill("12");
      await page
        .locator('[data-cash-form="open-register"] textarea[name="notes"]')
        .fill("Abertura do teste E2E");
      await page
        .locator('[data-cash-form="open-register"] button[type="submit"]')
        .click();
      await expect(page).toHaveURL(/\/admin\/caixa\/salao$/);
      await expect(page.getByText("CAIXA ABERTO", { exact: true })).toBeVisible();
      await expect(page.locator(".cash-table-card")).toHaveCount(12);
      for (let index = 0; index < 5; index += 1) {
        await page.locator('[data-cash-action="add-table"]').click();
        await expect(page.locator(".cash-table-card")).toHaveCount(13 + index);
      }
      await expect(page.getByText("Mesa 17", { exact: true })).toBeVisible();

      await page.locator(".cash-table-card").first().click();
      await expect(page.locator('[data-cash-form="open-tab"]')).toBeVisible();
      const guestCountInput = page.locator(
        '[data-cash-form="open-tab"] input[name="guestCount"]'
      );
      await guestCountInput.fill("");
      await page
        .locator('[data-cash-form="open-tab"] button[type="submit"]')
        .click();
      await expect(guestCountInput).toBeFocused();
      await expect(page.locator('[data-cash-form="open-tab"]')).toBeVisible();
      await guestCountInput.fill("5");
      await page
        .locator('[data-cash-form="open-tab"] input[name="waiterName"]')
        .fill("Garcom E2E");
      await page
        .locator('[data-cash-form="open-tab"] input[name="customerName"]')
        .fill("Daniel");
      await page
        .locator('[data-cash-form="open-tab"] button[type="submit"]')
        .click();
      await expect(page.getByText("Comanda vazia")).toBeVisible();
      await expect(page.locator(".cash-table-number", { hasText: "Daniel" })).toBeVisible();
      await page.locator('[data-cash-action="edit-occupancy"]').click();
      await page
        .locator('[data-cash-form="update-tab"] input[name="guestCount"]')
        .fill("6");
      await page
        .locator('[data-cash-form="update-tab"] input[name="customerName"]')
        .fill("Daniel Editado");
      await page
        .locator('[data-cash-form="update-tab"] button[type="submit"]')
        .click();
      await expect(page.getByText("Mesa 1 · 6 pessoas", { exact: true })).toBeVisible();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        page.locator(".cash-table-number", { hasText: "Daniel Editado" })
      ).toBeVisible();
      await expect(page.getByText("Mesa 1 · 6 pessoas", { exact: true })).toBeVisible();

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
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        page.locator(".cash-table-number", { hasText: "Daniel Editado" })
      ).toBeVisible();

      const screenshotDirectory = path.join(
        workspaceRoot,
        "artifacts",
        "cash-register-shift-tables"
      );
      await fs.mkdir(screenshotDirectory, { recursive: true });
      const responsiveViewports = [
        { width: 1366, height: 768, screenshot: "caixa-1366x768.png" },
        { width: 1280, height: 720, screenshot: "caixa-1280x720.png" },
        { width: 1024, height: 768, screenshot: "caixa-1024x768.png" },
        { width: 1280, height: 800 },
        { width: 1440, height: 900 },
        { width: 1920, height: 1080 },
      ];
      for (const viewport of responsiveViewports) {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await expect(page.locator(".cash-payment-panel")).toBeVisible();
        await expect(page.locator('[data-cash-action="add-table"]')).toBeVisible();
        await expect(page.locator('[data-cash-action="edit-occupancy"]')).toBeVisible();
        await expect(page.locator('[data-cash-action="begin-closing"]')).toBeVisible();
        await expectNoHorizontalOverflow(page);
        if (viewport.screenshot) {
          await page.screenshot({
            path: path.join(screenshotDirectory, viewport.screenshot),
            fullPage: true,
          });
        }
      }

      await page.setViewportSize({ width: 1180, height: 820 });
      await expectNoHorizontalOverflow(page);

      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator(".cash-mobile-collapse")).toBeVisible();
      expect(
        (await page.locator(".cash-register-module").boundingBox())?.y || Infinity
      ).toBeLessThan(350);
      await page.locator(".cash-mobile-collapse").click();
      await expect(page.locator(".cash-tables-panel")).toHaveClass(/is-collapsed/);
      await expectNoHorizontalOverflow(page);
      await expect(page.locator('[data-cash-action="add-table"]')).toBeVisible();

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.locator('[data-cash-action="begin-closing"]').click();
      await expect(page.getByText("Conta calculada e aguardando pagamento.")).toBeVisible();
      await page.locator('[data-cash-payment-method="PIX"]').click();
      await expect(page.locator('[data-cash-action="confirm-payment"]')).toBeEnabled();
      await page.locator('[data-cash-action="confirm-payment"]').click();
      await expect(page.getByText("Pagamento confirmado e mesa liberada.")).toBeVisible();
      await expect(page.locator(".cash-table-card.is-free")).toHaveCount(17);
      await expect(page.getByText("Mesa 1", { exact: true })).toBeVisible();
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

      await page.locator('[data-cash-register-subview="opening"]').click();
      const nextOpeningTableCount = page.locator(
        '[data-cash-form="open-register"] input[name="tableCount"]'
      );
      await expect(nextOpeningTableCount).toHaveValue("17");
      await nextOpeningTableCount.fill("8");
      await page
        .locator('[data-cash-form="open-register"] button[type="submit"]')
        .click();
      await expect(page.locator(".cash-table-card")).toHaveCount(8);
      await expect(page.getByText("Mesa 8", { exact: true })).toBeVisible();
      await expect(page.getByText("Mesa 9", { exact: true })).toHaveCount(0);
      await page.locator('[data-cash-register-subview="closing"]').click();
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .locator('[data-cash-form="close-register"] button[type="submit"]')
        .click();
      await expect(page.getByText("Caixa fechado com sucesso.")).toBeVisible();

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
      const opened = await postCashAction(ownerA.api, "open", {
        openingAmount: 150,
        serviceChargeRate: 10,
        tableCount: 3,
        notes: "Turno E2E API",
      });
      expect(opened.snapshot.register.status).toBe("OPEN");
      await postCashAction(ownerA.api, "add-table");
      expect(opened.snapshot.tables).toHaveLength(3);
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
      const tabId =
        openedTab.tab?.id ||
        openedTab.tabId ||
        openedTab.snapshot?.activeTabs?.[0]?.id;
      expect(tabId).toBeTruthy();
      const updatedOccupancy = await postCashAction(ownerA.api, "update-tab", {
        tabId,
        guestCount: 5,
        customerName: "Daniel",
      });
      expect(updatedOccupancy.snapshot.activeTabs[0].customerName).toBe("Daniel");
      expect(updatedOccupancy.snapshot.activeTabs[0].guestCount).toBe(5);
      await expectCashFailure(
        ownerA.api,
        "update-tab",
        { tabId, guestCount: 101, customerName: "Daniel" },
        "cash_register_invalid_integer"
      );
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

      await expectCashFailure(
        ownerA.api,
        "open-tab",
        { tableId: tableTwo.id, waiterName: "Garcom Segundo", guestCount: 101 },
        "cash_register_invalid_integer"
      );
      const secondTab = await postCashAction(ownerA.api, "open-tab", {
        tableId: tableTwo.id,
        waiterName: "Garcom Segundo",
        guestCount: 100,
      });
      const secondTabId =
        secondTab.tab?.id ||
        secondTab.tabId ||
        secondTab.snapshot?.activeTabs?.find(
          (tab) => tab.tableId === tableTwo.id
        )?.id;
      expect(secondTabId).toBeTruthy();
      expect(
        secondTab.snapshot.activeTabs.find((tab) => tab.id === secondTabId)
          ?.customerName
      ).toBe("");
      expect(
        secondTab.snapshot.activeTabs.find((tab) => tab.id === secondTabId)
          ?.guestCount
      ).toBe(100);
      await postCashAction(ownerA.api, "add-item", {
        tabId: secondTabId,
        productId: productOne.id,
        quantity: 1,
      });
      await postCashAction(ownerA.api, "send-order", {
        tabId: secondTabId,
      });
      const secondClosing = await postCashAction(
        ownerA.api,
        "begin-closing",
        {
          tabId: secondTabId,
          discountAmount: 0,
          serviceChargeEnabled: true,
        }
      );
      const singlePayment = await postCashAction(
        ownerA.api,
        "confirm-payment",
        {
          tabId: secondTabId,
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
        "TABLES_CONFIGURED",
        "TABLE_ADDED",
        "TAB_OPENED",
        "TAB_OCCUPANCY_UPDATED",
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
      expect(isolated.tables).toHaveLength(0);
      expect(isolated.activeTabs).toHaveLength(0);

      await expectCashFailure(
        ownerB.api,
        "open",
        { openingAmount: 0, serviceChargeRate: 10, tableCount: 201 },
        "cash_register_invalid_integer"
      );
      const limitOpened = await postCashAction(ownerB.api, "open", {
        openingAmount: 0,
        serviceChargeRate: 10,
        tableCount: 200,
      });
      expect(limitOpened.snapshot.tables).toHaveLength(200);
      await expectCashFailure(
        ownerB.api,
        "add-table",
        {},
        "cash_register_table_limit_reached"
      );
      await postCashAction(ownerB.api, "close", { countedCash: 0 });

      const closed = await postCashAction(ownerA.api, "close", {
        countedCash: finalSnapshot.registerSummary.expectedCash,
        notes: "Conferencia E2E sem diferenca",
      });
      expect(closed.snapshot).toBeTruthy();
      expect(closed.snapshot.register).toBeNull();
      expect(closed.totals.expectedCash).toBe(
        finalSnapshot.registerSummary.expectedCash
      );
      expect(closed.register?.differenceAmount ?? 0).toBe(0);
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
