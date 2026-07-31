const path = require("node:path");
const { test, expect } = require("@playwright/test");
const {
  expectNoHorizontalOverflow,
  loginMaster,
  onboardRestaurant,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");

const workspaceRoot = path.resolve(__dirname, "../..");

test.describe.configure({ mode: "serial" });

test.describe("Caixa e Salao", () => {
  test("executa o atendimento presencial e permanece responsivo", async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    const failedResources = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
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
});
