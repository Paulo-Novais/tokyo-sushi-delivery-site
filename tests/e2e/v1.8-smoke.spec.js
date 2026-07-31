const { test, expect, request } = require("@playwright/test");

const baseURL = process.env.BASE_URL || process.env.VALIDATION_BASE_URL || "http://127.0.0.1:3000";
const adminLogin = process.env.E2E_ADMIN_LOGIN;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

const PUBLIC_VIEWPORTS = [
  [320, 720],
  [375, 760],
  [390, 844],
  [430, 932],
  [768, 1024],
  [820, 1180],
  [912, 1180],
  [1024, 768],
  [1280, 800],
  [1366, 768],
  [1440, 900],
];

const KANBAN_VIEWPORTS = [
  [1024, 768],
  [1280, 800],
  [1366, 768],
  [1440, 900],
];

const isVercelPreviewToolbarCspError = (message) =>
  message.includes("https://vercel.live/_next-live/feedback/feedback.js") &&
  message.includes("Content Security Policy");

const collectPageSignals = (page) => {
  const consoleErrors = [];
  const pageErrors = [];
  const failedResponses = [];

  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !isVercelPreviewToolbarCspError(message.text())
    ) {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(String(error?.message || error));
  });
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 400) {
      failedResponses.push(`${status} ${response.request().resourceType()} ${response.url()}`);
    }
  });

  return { consoleErrors, pageErrors, failedResponses };
};

const expectNoCriticalSignals = (signals) => {
  expect(signals.consoleErrors).toEqual([]);
  expect(signals.pageErrors).toEqual([]);
  expect(signals.failedResponses).toEqual([]);
};

const expectNoHorizontalOverflow = async (page) => {
  const metrics = await page.evaluate(() => {
    const root = document.scrollingElement || document.documentElement;
    return {
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 2);
};

const expectElementVisibleAndOpaque = async (locator, label) => {
  await expect(locator, `${label} deve estar visivel.`).toBeVisible();
  await locator.scrollIntoViewIfNeeded();
  await expect.poll(
    async () =>
      locator.evaluate((node) => Number(window.getComputedStyle(node).opacity || 0)),
    { message: `${label} deve concluir o reveal visual.` }
  ).toBeGreaterThan(0);

  const metrics = await locator.evaluate((node) => {
    const styles = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return {
      opacity: Number(styles.opacity || 0),
      visibility: styles.visibility,
      display: styles.display,
      width: rect.width,
      height: rect.height,
    };
  });

  expect(metrics.display, `${label} nao pode estar display none.`).not.toBe("none");
  expect(metrics.visibility, `${label} nao pode estar hidden.`).not.toBe("hidden");
  expect(metrics.width, `${label} deve ocupar largura real.`).toBeGreaterThan(0);
  expect(metrics.height, `${label} deve ocupar altura real.`).toBeGreaterThan(0);
};

const loginAdmin = async (page, next = "/admin/") => {
  expect(adminLogin, "E2E_ADMIN_LOGIN precisa estar configurado.").toBeTruthy();
  expect(adminPassword, "E2E_ADMIN_PASSWORD precisa estar configurado.").toBeTruthy();

  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `127.18.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`,
  });
  await page.goto(`/admin/login.html?next=${encodeURIComponent(next)}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator("[data-admin-login-form]")).toBeVisible();
  await page.locator('input[name="identifier"]').fill(adminLogin);
  await page.locator('input[name="password"]').fill(adminPassword);
  await page.locator("[data-admin-login-submit]").click();
};

test.describe("V1.8 public smoke", () => {
  test("INOVAS platform home and legacy landing load without critical errors", async ({ page }) => {
    for (const pathname of ["/", "/inovas"]) {
      const signals = collectPageSignals(page);
      const response = await page.goto(pathname, { waitUntil: "networkidle" });
      expect(response?.status(), `${pathname} deve responder 200.`).toBe(200);
      await expectNoHorizontalOverflow(page);
      await expect(page).toHaveTitle(/INOVAS Food/i);
      await expect(page).not.toHaveTitle(/Tokyo Sushi/i);

      if (pathname === "/" || pathname === "/inovas") {
        await expectElementVisibleAndOpaque(page.locator(".if-footer"), "rodape INOVAS");
        await expectElementVisibleAndOpaque(page.locator(".if-newsletter"), "newsletter INOVAS");
        await expectElementVisibleAndOpaque(page.locator(".if-button").first(), "CTA INOVAS");
      } else {
        await expectElementVisibleAndOpaque(page.locator("[data-site-footer]"), "rodape publico");
        await expectElementVisibleAndOpaque(
          page.getByRole("link", { name: /Agendar pedido|Pedir Agora|Ver Card[a\u00e1]pio/i }).first(),
          "CTA publico"
        );
      }

      expectNoCriticalSignals(signals);
    }
  });

  test("Tokyo Sushi tenant route preserves restaurant storefront", async ({ page }) => {
    const signals = collectPageSignals(page);
    const response = await page.goto("/r/tokyo-sushi/", { waitUntil: "networkidle" });
    expect(response?.status(), "rota tenant do Tokyo deve responder 200.").toBe(200);
    await expectNoHorizontalOverflow(page);
    await expect(page).toHaveTitle(/Tokyo Sushi/i);
    await expectElementVisibleAndOpaque(page.locator("[data-site-footer]"), "rodape Tokyo tenant");
    await expectElementVisibleAndOpaque(
      page.getByRole("link", { name: /Agendar pedido|Pedir Agora|Ver Card[a\u00e1]pio/i }).first(),
      "CTA Tokyo tenant"
    );
    expectNoCriticalSignals(signals);
  });

  for (const [width, height] of PUBLIC_VIEWPORTS) {
    test(`public responsive viewport ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const response = await page.goto("/", { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);
      await expectNoHorizontalOverflow(page);
      await expectElementVisibleAndOpaque(page.locator(".if-footer"), `rodape INOVAS ${width}`);
      await expectElementVisibleAndOpaque(page.locator(".if-newsletter"), `newsletter INOVAS ${width}`);
    });
  }

  test("footer remains visible with reduced motion", async ({ browser }) => {
    const context = await browser.newContext({
      baseURL,
      reducedMotion: "reduce",
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    try {
      await page.goto("/", { waitUntil: "networkidle" });
      await expectNoHorizontalOverflow(page);
      await expectElementVisibleAndOpaque(page.locator(".if-footer"), "rodape INOVAS com reduced motion");
    } finally {
      await context.close();
    }
  });
});

test.describe("V1.8 protected surfaces and System health smoke", () => {
  test("admin routes require session", async ({ page }) => {
    const api = await request.newContext({ baseURL });
    const session = await api.get("/api/admin/session");
    expect(session.status()).toBe(200);
    const sessionPayload = await session.json();
    expect(sessionPayload.authenticated).toBe(false);

    const protectedOrders = await api.get("/api/admin/orders/list");
    expect(protectedOrders.status()).toBe(401);

    const missingApi = await api.get("/api/route-that-does-not-exist");
    expect(missingApi.status()).toBe(404);

    await page.goto("/admin/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-admin-login-form]")).toBeVisible();

    await page.goto("/gestor", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-admin-login-form]")).toBeVisible();
    await api.dispose();
  });

  for (const [width, height] of KANBAN_VIEWPORTS) {
    test(`System health dashboard accessible at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await loginAdmin(page);
      await expect(page).toHaveURL(/\/system\/?$/);
      await expect(
        page.getByRole("heading", { name: "Visão geral da INOVAS" })
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.locator(".system-health-grid")).toBeVisible();
      await expect(page.locator(".system-boundary")).toContainText(
        "SystemSession sem tenant"
      );
      await expectNoHorizontalOverflow(page);
    });
  }
});
