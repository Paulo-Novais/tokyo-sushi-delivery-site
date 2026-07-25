const crypto = require("node:crypto");
const { defineConfig, devices } = require("@playwright/test");

const port = Number(process.env.PORT || process.env.E2E_PORT || 3000);
const localBaseURL = `http://127.0.0.1:${port}`;
const baseURL = process.env.BASE_URL || process.env.VALIDATION_BASE_URL || localBaseURL;
const isLocalServer =
  /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(baseURL);

process.env.PORT = String(port);
process.env.VALIDATION_BASE_URL = baseURL;
process.env.E2E_ADMIN_LOGIN = process.env.E2E_ADMIN_LOGIN || "admin.e2e@local.test";
process.env.E2E_ADMIN_PASSWORD =
  process.env.E2E_ADMIN_PASSWORD || crypto.randomBytes(24).toString("base64url");
process.env.INOVAS_ALLOW_INVITE_LINK_COPY =
  process.env.INOVAS_ALLOW_INVITE_LINK_COPY || "true";

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: isLocalServer
    ? {
        command: "node scripts/local-validation-server.cjs",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
