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
  test("executa o atendimento presencial no Novo Caixa em várias resoluções", async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && !isVercelPreviewToolbarCspError(message.text())) {
        consoleErrors.push(message.text());
      }
    });
    const master = await loginMaster();
    const restaurant = await onboardRestaurant(master.api, {
      key: uniqueKey("cash-ui"),
      name: "Kasulo",
      ownerPassword: "OwnerCashUi123!",
    });
    const shots = path.join(workspaceRoot, "artifacts", "novo-caixa", "telas");
    await fs.mkdir(shots, { recursive: true });
    const shot = async (name) => {
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true });
    };
    const root = page.locator(".cash-v3");

    try {
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.setExtraHTTPHeaders({ "x-forwarded-for": "127.31.41.51" });
      await page.goto("/admin/login.html?next=%2Fadmin%2Fcaixa%2Fsalao", { waitUntil: "domcontentloaded" });
      await page.locator('input[name="identifier"]').fill(restaurant.ownerLogin);
      await page.locator('input[name="password"]').fill(restaurant.ownerPassword);
      await page.locator("[data-admin-login-submit]").click();
      await expect(page).toHaveURL(/\/admin\/caixa\/salao$/);

      // Tela 1 · Abertura (caixa fechado leva direto para a abertura)
      await expect(root.getByRole("heading", { name: "Abrir caixa" })).toBeVisible({ timeout: 20_000 });
      await root.locator('[data-cx-set="opening.tableCount"][data-cx-value="10"]').click();
      await root.locator('[data-cx-step-field="opening.tableCount"][data-cx-delta="1"]').click();
      await root.locator('[data-cx-step-field="opening.tableCount"][data-cx-delta="1"]').click();
      await expect(root.locator(".cx-mini-table")).toHaveCount(12);
      await root.locator('[data-cx-field="opening.openingAmount"]').fill("200");
      await shot("1-abertura-1366");
      await root.getByRole("button", { name: "Abrir caixa com 12 mesas" }).click();

      // Tela 2 · Salão: 12 mesas, todas Livre · 0 pessoas (ESPEC teste 1)
      await expect(root.locator("[data-cx-table]")).toHaveCount(12);
      await expect(root.locator(".cx-status-card.is-free")).toHaveCount(12);
      await expect(root.locator("[data-cx-table]").first()).toContainText("0 pessoas");
      await shot("2-salao-1366");

      // Tela 3 · Abrir comanda: 0 pessoas bloqueia (ESPEC teste 2)
      await root.locator('[data-cx-field="tableSearch"]').fill("5");
      await root.locator('[data-cx-field="tableSearch"]').press("Enter");
      const dialog = root.locator('[data-cx-form="open-tab"]');
      await expect(dialog).toBeVisible();
      const confirm = dialog.locator("[data-cx-confirm]");
      await expect(confirm).toBeDisabled();
      await expect(dialog).toContainText("0 pessoas");
      await shot("3-nova-comanda-bloqueada");
      await dialog.locator('[data-cx-set="openTab.guests"][data-cx-value="4"]').click();
      await dialog.locator('[data-cx-field="openTab.customerName"]').fill("Ana");
      await expect(confirm).toHaveText(/Abrir mesa 05 · 4 pessoas/);
      await shot("3-nova-comanda-1366");
      await confirm.click();

      // Tela 4 · PDV (ESPEC teste 3: mesa 05 ocupada com 4 pessoas)
      await expect(root.getByRole("heading", { name: "Lançar pedido · Mesa 05" })).toBeVisible();
      const search = root.locator('[data-cx-field="pdv.query"]');
      await expect(search).toBeFocused();
      await search.fill("3*1");
      await search.press("Enter");
      const pending = root.locator(".cx-order-line.is-pending");
      await expect(pending).toHaveCount(1);
      await expect(pending.first().locator("output")).toHaveText("3");
      // Mesmo item soma na mesma linha (ESPEC teste 5)
      await root.locator('[data-cx-set="pdv.multiplier"][data-cx-value="2"]').click();
      await root.locator("[data-cx-product]").first().click();
      await expect(pending).toHaveCount(1);
      await expect(pending.first().locator("output")).toHaveText("5");
      await root.locator("[data-cx-product]").nth(1).click();
      await expect(pending).toHaveCount(2);
      await shot("4-pdv-1366");
      // Enviar para a cozinha com F2 (ESPEC teste 6)
      await page.keyboard.press("F2");
      await expect(root.locator(".cx-order-line.is-pending")).toHaveCount(0);
      await expect(root.locator(".cx-order-group", { hasText: "Já na cozinha" })).toBeVisible();

      // Trocar pessoas da comanda
      await root.getByRole("button", { name: "Trocar pessoas" }).click();
      await root.locator('[data-cx-step-field="people.guests"][data-cx-delta="-1"]').click();
      await root.locator('[data-cx-form="update-tab"] [data-cx-confirm]').click();
      await expect(root.getByText(/3 pessoas · aberta há/)).toBeVisible();
      await root.locator('[data-cx-step-field="people.guests"]').count();

      // Resolução: PDV em 1024x768 e 1920x1080
      await page.setViewportSize({ width: 1024, height: 768 });
      await expect(root.getByRole("button", { name: /Enviar para a cozinha/ })).toBeVisible();
      await shot("4-pdv-1024");
      await page.setViewportSize({ width: 1920, height: 1080 });
      await shot("4-pdv-1920");
      await page.setViewportSize({ width: 1366, height: 768 });

      // Tela 5 · Pagamento: conferir conta, dividir igual e pagamento misto
      await page.keyboard.press("F4");
      await expect(root.getByRole("heading", { name: "Conferir a conta" })).toBeVisible();
      await root.getByRole("button", { name: /Fechar conta e cobrar/ }).click();
      await expect(root.locator(".cx-share")).toHaveCount(3);
      await shot("5-pagamento-1366");
      await root.locator('[data-cx-set="payment.method"][data-cx-value="PIX"]').click();
      await root.locator('[data-cx-action="add-payment"]').click();
      await root.locator('[data-cx-set="payment.method"][data-cx-value="CREDIT_CARD"]').click();
      await root.locator('[data-cx-action="add-payment"]').click();
      await root.locator('[data-cx-set="payment.method"][data-cx-value="CASH"]').click();
      await root.locator('[data-cx-set="payment.entry"][data-cx-value="200"]').click();
      await expect(root.locator(".cx-change")).toContainText("Troco");
      await root.locator('[data-cx-action="add-payment"]').click();
      await expect(root.locator(".cx-list-row.is-strong", { hasText: "Falta receber" })).toContainText("R$ 0,00");
      await shot("5-pagamento-quitado-1366");
      await root.locator('[data-cx-action="finish-payment"]').click();
      await expect(root.getByRole("heading", { name: "Mesa liberada" })).toBeVisible();
      await page.keyboard.press("Enter");
      // ESPEC teste 8: mesa volta a Livre · 0 pessoas
      const table5 = root.locator("[data-cx-table]").nth(4);
      await expect(table5).toContainText("Livre");
      await expect(table5).toContainText("0 pessoas");

      // Sangria e suprimento (ESPEC 3.9)
      await root.getByRole("button", { name: "Sangria / Suprimento" }).click();
      const movement = root.locator('[data-cx-form="movement"]');
      await movement.locator('[data-cx-set="movement.type"][data-cx-value="SUPPLY"]').click();
      await movement.locator('[data-cx-field="movement.amount"]').fill("50");
      await movement.locator('[data-cx-field="movement.reason"]').fill("Reforço de troco");
      await shot("2-sangria-suprimento");
      await movement.locator("[data-cx-confirm]").click();
      await expect(movement).toHaveCount(0);

      // Tela 6 · Fechamento: diferença exige observação
      await root.getByRole("button", { name: "Fechar caixa" }).click();
      await expect(root.getByRole("heading", { name: "Fechar caixa" })).toBeVisible();
      await expect(root.locator(".cx-list-row", { hasText: "Reforço de troco" })).toBeVisible();
      await root.locator('[data-cx-field="closing.counted"]').fill("1");
      await expect(root.getByText("Explique a diferença para fechar o caixa.")).toBeVisible();
      await expect(root.locator('[data-cx-form="close-register"] button[type="submit"]')).toBeDisabled();
      await shot("6-fechamento-1366");
      await page.setViewportSize({ width: 1024, height: 768 });
      await shot("6-fechamento-1024");

      for (const [width, height] of [[1024, 768], [1366, 768], [1920, 1080]]) {
        await page.setViewportSize({ width, height });
        await root.getByRole("button", { name: "← Salão" }).click();
        await expect(root.locator("[data-cx-table]")).toHaveCount(12);
        await shot(`2-salao-${width}`);
        await root.getByRole("button", { name: "Fechar caixa" }).click();
      }

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
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
