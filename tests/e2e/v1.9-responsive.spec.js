const { test, expect } = require("@playwright/test");
const {
  expectNoHorizontalOverflow,
} = require("./helpers/v1.9-fixtures.cjs");

const adminLogin = process.env.E2E_ADMIN_LOGIN;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

const ADMIN_VIEWPORTS = [
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
];

const loginThroughUi = async (page) => {
  expect(adminLogin, "E2E_ADMIN_LOGIN precisa estar configurado.").toBeTruthy();
  expect(adminPassword, "E2E_ADMIN_PASSWORD precisa estar configurado.").toBeTruthy();

  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `127.29.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`,
  });
  await page.goto("/admin/login.html?next=%2Fadmin%2F", { waitUntil: "domcontentloaded" });
  await page.locator('input[name="identifier"]').fill(adminLogin);
  await page.locator('input[name="password"]').fill(adminPassword);
  await page.locator("[data-admin-login-submit]").click();
  await expect(page).toHaveURL(/\/system\/?$/);
  await expect(page.locator(".users-shell")).toBeVisible({ timeout: 20_000 });
};

test.describe("V1.9 System responsive shell", () => {
  for (const [width, height] of ADMIN_VIEWPORTS) {
    test(`System dashboard stays usable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await loginThroughUi(page);
      await expect(
        page.getByRole("heading", { name: "Visão geral da INOVAS" })
      ).toBeVisible();
      await expect(page.locator(".system-health-grid")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }
});
