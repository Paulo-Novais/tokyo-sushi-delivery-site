const { test, expect } = require("@playwright/test");
const {
  buildRestaurantPayload,
  loginMaster,
  loginTenantOwner,
  onboardRestaurant,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");
const {
  RESERVED_RESTAURANT_SLUGS,
  buildRestaurantPublicUrl,
  validateRestaurantSlug,
} = require("../../lib/restaurant-public-url.cjs");

test.describe("Endereço INOVAS por slug", () => {
  test("centraliza URL e rejeita sintaxe inválida ou rotas reservadas", async () => {
    expect(buildRestaurantPublicUrl("tokyosushidelivery")).toBe(
      "https://www.inovasfood.com.br/tokyosushidelivery"
    );
    expect(validateRestaurantSlug("restaurante-123").ok).toBe(true);

    for (const invalidSlug of [
      "TokyoSushi",
      "tokyo sushi",
      "tókyosushi",
      "-tokyosushi",
      "tokyosushi-",
      "tokyo/sushi",
      "tokyosushi?admin=true",
    ]) {
      expect(validateRestaurantSlug(invalidSlug).ok, invalidSlug).toBe(false);
    }

    for (const reservedSlug of [
      "admin",
      "api",
      "login",
      "gestor",
      "master",
      "usuarios",
      "configuracoes",
      "dashboard",
      "suporte",
      "assets",
      "static",
      "favicon.ico",
    ]) {
      expect(RESERVED_RESTAURANT_SLUGS).toContain(reservedSlug);
      expect(validateRestaurantSlug(reservedSlug).errorCode).toBe(
        "restaurant_slug_reserved"
      );
    }
  });

  test("backend bloqueia slug reservado e slug adulterado", async () => {
    const master = await loginMaster();

    try {
      const reservedResponse = await master.api.post(
        "/api/admin/master/onboard-restaurant",
        {
          data: buildRestaurantPayload({
            key: "admin",
            ownerLogin: `owner-${uniqueKey("reserved")}@tenant.local`,
          }),
        }
      );
      expect(reservedResponse.status()).toBe(400);
      expect((await reservedResponse.json()).errorCode).toBe(
        "restaurant_slug_reserved"
      );

      const invalidPayload = buildRestaurantPayload({
        key: "slug-invalido",
        ownerLogin: `owner-${uniqueKey("invalid")}@tenant.local`,
      });
      invalidPayload.slug = "slug/invalido";
      invalidPayload.restaurantKey = "slug/invalido";
      const invalidResponse = await master.api.post(
        "/api/admin/master/onboard-restaurant",
        { data: invalidPayload }
      );
      expect(invalidResponse.status()).toBe(400);
      expect((await invalidResponse.json()).errorCode).toBe(
        "invalid_restaurant_slug"
      );
    } finally {
      await master.api.dispose();
    }
  });

  test("rota limpa resolve e isola tenants; rota legada redireciona", async ({
    browser,
  }) => {
    const master = await loginMaster();
    const tenantA = await onboardRestaurant(master.api, {
      key: uniqueKey("rota-a"),
      ownerPassword: "OwnerRouteA123!",
    });
    const tenantB = await onboardRestaurant(master.api, {
      key: uniqueKey("rota-b"),
      ownerPassword: "OwnerRouteB123!",
    });
    expect(tenantA.payload.restaurant.publicUrl).toBe(
      `https://www.inovasfood.com.br/${tenantA.key}`
    );
    expect(tenantB.payload.tenant.publicUrl).toBe(
      `https://www.inovasfood.com.br/${tenantB.key}`
    );
    const ownerA = await loginTenantOwner(tenantA);
    const ownerB = await loginTenantOwner(tenantB);
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      const settingsAResponse = await ownerA.api.post(
        "/api/admin/settings/save",
        {
          data: {
            settings: {
              restaurantName: `Restaurante ${tenantA.key}`,
              slogan: "Identidade A",
            },
          },
        }
      );
      expect(settingsAResponse.status()).toBe(200);
      const settingsBResponse = await ownerB.api.post(
        "/api/admin/settings/save",
        {
          data: {
            settings: {
              restaurantName: `Restaurante ${tenantB.key}`,
              slogan: "Identidade B",
            },
          },
        }
      );
      expect(settingsBResponse.status()).toBe(200);

      const firstResponse = await page.goto(`/${tenantA.key}?origem=teste`, {
        waitUntil: "networkidle",
      });
      expect(firstResponse?.status()).toBe(200);
      expect(new URL(page.url()).pathname).toBe(`/${tenantA.key}`);
      expect(new URL(page.url()).searchParams.get("origem")).toBe("teste");
      await expect(page).toHaveTitle(/Tokyo Sushi/i);

      const catalogA = await page.request.get("/api/catalog");
      expect(catalogA.status()).toBe(200);
      expect((await catalogA.json()).tenantContext.restaurantKey).toBe(
        tenantA.key
      );
      const publicSettingsA = await page.request.get(
        "/api/restaurant-settings"
      );
      expect(publicSettingsA.status()).toBe(200);
      const publicSettingsABody = await publicSettingsA.json();
      expect(publicSettingsABody.tenantContext.restaurantKey).toBe(tenantA.key);
      expect(publicSettingsABody.settings.restaurantName).toBe(
        `Restaurante ${tenantA.key}`
      );

      await page.goto(`/${tenantB.key}`, { waitUntil: "networkidle" });
      const catalogB = await page.request.get("/api/catalog");
      expect(catalogB.status()).toBe(200);
      expect((await catalogB.json()).tenantContext.restaurantKey).toBe(
        tenantB.key
      );
      const publicSettingsB = await page.request.get(
        "/api/restaurant-settings"
      );
      expect(publicSettingsB.status()).toBe(200);
      const publicSettingsBBody = await publicSettingsB.json();
      expect(publicSettingsBBody.tenantContext.restaurantKey).toBe(tenantB.key);
      expect(publicSettingsBBody.settings.restaurantName).toBe(
        `Restaurante ${tenantB.key}`
      );

      const legacyResponse = await page.request.get(
        `/r/${tenantA.key}/?utm_source=legado`,
        { maxRedirects: 0 }
      );
      expect(legacyResponse.status()).toBe(308);
      const legacyLocation = new URL(
        legacyResponse.headers().location,
        page.url()
      );
      expect(legacyLocation.pathname).toBe(`/${tenantA.key}`);
      expect(legacyLocation.searchParams.get("utm_source")).toBe("legado");

      const unknownSlug = uniqueKey("restaurante-inexistente");
      const notFoundResponse = await page.goto(`/${unknownSlug}`);
      expect(notFoundResponse?.status()).toBe(404);
      await expect(page.getByText("Restaurante nao encontrado.")).toBeVisible();

      const invalidSlugResponse = await page.goto("/Slug-Invalido");
      expect(invalidSlugResponse?.status()).toBe(404);
      await expect(page.getByText("Restaurante nao encontrado.")).toBeVisible();
    } finally {
      await context.close();
      await ownerA.api.dispose();
      await ownerB.api.dispose();
      await master.api.dispose();
    }
  });
});
