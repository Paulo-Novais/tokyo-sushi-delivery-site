const { test, expect } = require("@playwright/test");
const {
  baseURL,
  createApiContext,
  expectNoHorizontalOverflow,
  loginAdmin,
  loginMaster,
  loginTenantOwner,
  onboardRestaurant,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");
const {
  getRestaurantAccessAddress,
} = require("../../lib/admin-api.cjs");

const masterLogin = process.env.E2E_ADMIN_LOGIN;
const masterPassword = process.env.E2E_ADMIN_PASSWORD;

const loginMasterInBrowser = async (page, next = "/admin/usuarios/novo") => {
  await page.goto(`/admin/login.html?next=${encodeURIComponent(next)}`);
  await page.locator('input[name="identifier"]').fill(masterLogin);
  await page.locator('input[name="password"]').fill(masterPassword);
  await page.locator("[data-admin-login-submit]").click();
  await page.waitForURL("**/admin/usuarios/novo");
  await expect(page.locator("[data-user-form]")).toBeVisible();
};

const buildGuidedUser = ({
  email,
  restaurantKey,
  credentialMode = "TEMPORARY_PASSWORD",
  status = "ACTIVE",
  userType = "CAIXA",
  password = "Temporaria123!",
  permissions = {},
} = {}) => ({
  creationExperienceVersion: 2,
  name: "Pessoa Validacao",
  login: email,
  email,
  phone: "(11) 98888-7766",
  jobTitle: "Turno de validacao",
  restaurantKey,
  tenantId: "tenant_tampered",
  restaurantId: "restaurant_tampered",
  userScope: "RESTAURANT",
  userType,
  status,
  credentialMode,
  password: credentialMode === "INVITE" ? "" : password,
  mustChangePassword: credentialMode === "TEMPORARY_PASSWORD",
  permissions,
});

test.describe("Criação guiada de usuário", () => {
  test("domínio próprio só fica ativo com DNS e SSL confirmados", async () => {
    const restaurant = {
      restaurantKey: "custom-domain-active",
      domain: "custom-domain-active.inovasfood.com.br",
    };
    const activeDomain = getRestaurantAccessAddress(restaurant, [
      {
        restaurantKey: "custom-domain-active",
        domain: "cliente.example.test",
        customDomain: "cliente.example.test",
        primaryDomain: "custom-domain-active.inovasfood.com.br",
        status: "ACTIVE",
        dnsIntegrated: true,
        sslIntegrated: true,
        isSimulation: false,
      },
    ]);

    expect(activeDomain.type).toBe("CUSTOM_DOMAIN");
    expect(activeDomain.status).toBe("ACTIVE");
    expect(activeDomain.statusLabel).toBe("Ativo");
    expect(activeDomain.dnsStatus).toBe("VERIFIED");
    expect(activeDomain.sslStatus).toBe("ACTIVE");
    expect(activeDomain.finalUrl).toBe("https://cliente.example.test");

    const unverifiedDomain = getRestaurantAccessAddress(restaurant, [
      {
        restaurantKey: "custom-domain-active",
        domain: "cliente.example.test",
        customDomain: "cliente.example.test",
        primaryDomain: "custom-domain-active.inovasfood.com.br",
        status: "ACTIVE",
        dnsIntegrated: false,
        sslIntegrated: true,
        isSimulation: false,
      },
    ]);

    expect(unverifiedDomain.status).toBe("PENDING_VERIFICATION");
    expect(unverifiedDomain.finalUrl).toBe(
      "https://www.inovasfood.com.br/custom-domain-active"
    );
  });

  test("rota protegida, perfis prontos, permissões dependentes e resumo responsivo", async ({
    browser,
  }) => {
    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    await anonymousPage.goto("/admin/usuarios/novo");
    await expect(anonymousPage).toHaveURL(/\/admin\/login\.html/);
    await anonymousContext.close();

    const authenticatedContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await authenticatedContext.newPage();
    await loginMasterInBrowser(page);

    await expect(page.locator('select[name="restaurantKey"]')).toBeVisible();
    await page.locator('select[name="restaurantKey"]').selectOption("default");
    await expect(page.locator("[data-access-address]")).toContainText(
      "https://www.inovasfood.com.br/tokyo-sushi"
    );
    await expect(page.locator("[data-summary-address]")).toContainText(
      "www.inovasfood.com.br/tokyo-sushi"
    );

    const profileInputs = page.locator('input[name="userType"]');
    expect(await profileInputs.count()).toBeGreaterThanOrEqual(8);
    await expect(page.locator('input[name="userType"][value="GERENTE"]')).toBeChecked();
    await expect(page.locator("[data-custom-permissions]")).toBeHidden();

    await page.locator('label.user-profile-card:has(input[value="CUSTOM"])').click();
    await expect(page.locator("[data-custom-permissions]")).toBeVisible();
    await page.locator('[data-permission="orders_edit"]').check();
    await expect(page.locator('[data-permission="orders_view"]')).toBeChecked();
    await page.locator('[data-permission="orders_view"]').uncheck();
    await expect(page.locator('[data-permission="orders_edit"]')).not.toBeChecked();

    await page.locator('input[name="name"]').fill("  Ana   da   Silva  ");
    await page.locator('input[name="email"]').fill("EMAIL-INVALIDO");
    await page.locator("[data-submit-button]").click();
    await expect(page.locator('[data-field-error="email"]')).toContainText(
      "endereço de e-mail válido"
    );
    await expect(page.locator("[data-summary-name]")).toHaveText("Ana da Silva");

    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    const layout = await page.evaluate(() => {
      const form = document.querySelector(".user-create-sections");
      const summary = document.querySelector(".user-summary");
      const formTop = form?.getBoundingClientRect().top || 0;
      const summaryTop = summary?.getBoundingClientRect().top || 0;
      return { formTop, summaryTop };
    });
    expect(layout.summaryTop).toBeGreaterThan(layout.formTop);

    let createRequests = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/admin/users/create"
      ) {
        createRequests += 1;
      }
    });
    await page.locator('input[name="email"]').fill(
      `ui-${uniqueKey("person")}@tenant.local`
    );
    await page.locator('label.user-profile-card:has(input[value="CAIXA"])').click();
    await page
      .locator('label.user-choice-card:has(input[value="TEMPORARY_PASSWORD"])')
      .click();
    await page.locator('input[name="password"]').fill("InterfaceSegura123!");
    await page.locator("[data-submit-button]").dblclick();
    await expect(page.locator("[data-success-state]")).toBeVisible();
    expect(createRequests).toBe(1);
    await expect(page.locator("[data-success-secret]")).toBeVisible();
    await authenticatedContext.close();
  });

  test("convite persiste pendência, aceita uma vez e não expõe segredos", async () => {
    const master = await loginMaster();
    const tenant = await onboardRestaurant(master.api, {
      key: uniqueKey("user-invite"),
      ownerPassword: "OwnerInvite123!",
    });
    const email = `invite-${uniqueKey("person")}@tenant.local`;

    try {
      const contextResponse = await master.api.get("/api/admin/users/create-context");
      expect(contextResponse.status()).toBe(200);
      const context = await contextResponse.json();
      const contextRestaurant = context.restaurants.find(
        (restaurant) => restaurant.key === tenant.key
      );
      expect(context.canSelectRestaurant).toBe(true);
      expect(contextRestaurant.selectable).toBe(true);
      expect(contextRestaurant.accessAddress.type).toBe("INOVAS_ADDRESS");
      expect(contextRestaurant.accessAddress.url).toBe(
        `https://www.inovasfood.com.br/${tenant.key}`
      );
      expect(contextRestaurant.accessAddress.managementLabel).toBe(
        "Gerenciado pelo INOVAS Food"
      );

      const createResponse = await master.api.post("/api/admin/users/create", {
        data: {
          creationExperienceVersion: 2,
          user: buildGuidedUser({
            email,
            restaurantKey: tenant.key,
            credentialMode: "INVITE",
            status: "ACTIVE",
          }),
        },
      });
      expect(createResponse.status()).toBe(200);
      const created = await createResponse.json();
      const serializedCreate = JSON.stringify(created);

      expect(created.user.status).toBe("PENDING");
      expect(created.user.credentialMode).toBe("INVITE");
      expect(created.user.tenantId).not.toBe("tenant_tampered");
      expect(created.user.restaurantId).not.toBe("restaurant_tampered");
      expect(created.user.createdBy).toBe(masterLogin.toLowerCase());
      expect(created.user.auditTrail.some((event) => event.action === "USER_CREATED")).toBe(
        true
      );
      expect(serializedCreate).not.toContain("passwordHash");
      expect(serializedCreate).not.toContain("invitationTokenHash");
      expect(serializedCreate).not.toContain("Temporaria123!");
      expect(created.invitation.emailSent).toBe(false);
      expect(created.invitation.invitationUrl).toContain("/admin/convite.html?token=");
      expect(created.invitation.restaurantAccessUrl).toBe(
        `https://www.inovasfood.com.br/${tenant.key}`
      );

      const duplicateResponse = await master.api.post("/api/admin/users/create", {
        data: {
          creationExperienceVersion: 2,
          user: buildGuidedUser({
            email: email.toUpperCase(),
            restaurantKey: tenant.key,
            credentialMode: "INVITE",
          }),
        },
      });
      expect(duplicateResponse.status()).toBe(409);
      expect((await duplicateResponse.json()).errorCode).toBe("duplicate_user_email");

      const firstInvitationUrl = new URL(created.invitation.invitationUrl);
      const firstToken = firstInvitationUrl.searchParams.get("token");
      const resendResponse = await master.api.post("/api/admin/users/resend-invite", {
        data: { id: created.user.id, login: created.user.login },
      });
      expect(resendResponse.status()).toBe(200);
      const resent = await resendResponse.json();
      expect(
        resent.user.auditTrail.some((event) => event.action === "INVITATION_REISSUED")
      ).toBe(true);
      expect(resent.invitation.emailSent).toBe(false);

      const invitationUrl = new URL(resent.invitation.invitationUrl);
      const token = invitationUrl.searchParams.get("token");
      expect(token).toBeTruthy();
      const publicApi = await createApiContext({ host: tenant.host });
      const invitePassword = "ConviteSeguro123!";

      try {
        const invalidatedResponse = await publicApi.post(
          "/api/admin/auth/accept-invite",
          {
            data: { token: firstToken, password: invitePassword },
          }
        );
        expect(invalidatedResponse.status()).toBe(400);

        const acceptResponse = await publicApi.post("/api/admin/auth/accept-invite", {
          data: { token, password: invitePassword },
        });
        expect(acceptResponse.status()).toBe(200);
        const accepted = await acceptResponse.json();
        expect(accepted.user.status).toBe("ACTIVE");
        expect(JSON.stringify(accepted)).not.toContain("passwordHash");
        expect(JSON.stringify(accepted)).not.toContain(token);

        const reuseResponse = await publicApi.post("/api/admin/auth/accept-invite", {
          data: { token, password: invitePassword },
        });
        expect(reuseResponse.status()).toBe(400);

        const login = await loginAdmin(publicApi, {
          identifier: email,
          password: invitePassword,
        });
        expect(login.response.status()).toBe(200);
      } finally {
        await publicApi.dispose();
      }
    } finally {
      await master.api.dispose();
    }
  });

  test("senha temporária, dependências no backend e isolamento entre restaurantes", async () => {
    const master = await loginMaster();
    const tenantA = await onboardRestaurant(master.api, {
      key: uniqueKey("user-a"),
      ownerPassword: "OwnerTenantA123!",
    });
    const tenantB = await onboardRestaurant(master.api, {
      key: uniqueKey("user-b"),
      ownerPassword: "OwnerTenantB123!",
    });

    try {
      const email = `temporary-${uniqueKey("person")}@tenant.local`;
      const createResponse = await master.api.post("/api/admin/users/create", {
        data: {
          creationExperienceVersion: 2,
          user: buildGuidedUser({
            email,
            restaurantKey: tenantA.key,
            credentialMode: "TEMPORARY_PASSWORD",
            status: "ACTIVE",
          }),
        },
      });
      expect(createResponse.status()).toBe(200);
      const created = await createResponse.json();
      expect(created.user.status).toBe("ACTIVE");
      expect(created.user.mustChangePassword).toBe(true);
      expect(created.user.restaurantKey).toBe(tenantA.key);
      expect(created.user.auditTrail[0].metadata.mustChangePassword).toBe(true);
      expect(JSON.stringify(created)).not.toContain("Temporaria123!");
      expect(JSON.stringify(created)).not.toContain("passwordHash");

      const blockResponse = await master.api.post("/api/admin/users/status", {
        data: { id: created.user.id, login: email, status: "BLOCKED" },
      });
      expect(blockResponse.status()).toBe(200);
      const blocked = await blockResponse.json();
      expect(blocked.user.status).toBe("BLOCKED");
      expect(
        blocked.user.auditTrail.some((event) => event.action === "USER_STATUS_CHANGED")
      ).toBe(true);
      const blockedApi = await createApiContext({ host: tenantA.host });
      try {
        const blockedLogin = await loginAdmin(blockedApi, {
          identifier: email,
          password: "Temporaria123!",
        });
        expect(blockedLogin.response.status()).toBe(403);
        expect(blockedLogin.payload.errorCode).toBe("admin_user_blocked");
      } finally {
        await blockedApi.dispose();
      }

      const dependencyEmail = `dependency-${uniqueKey("person")}@tenant.local`;
      const dependencyResponse = await master.api.post("/api/admin/users/create", {
        data: {
          creationExperienceVersion: 2,
          user: buildGuidedUser({
            email: dependencyEmail,
            restaurantKey: tenantA.key,
            userType: "CUSTOM",
            permissions: { orders_edit: true },
          }),
        },
      });
      expect(dependencyResponse.status()).toBe(400);
      expect((await dependencyResponse.json()).errorCode).toBe(
        "permission_dependency_missing"
      );

      const ownerA = await loginTenantOwner(tenantA);
      try {
        const ownerContextResponse = await ownerA.api.get(
          "/api/admin/users/create-context"
        );
        expect(ownerContextResponse.status()).toBe(200);
        const ownerContext = await ownerContextResponse.json();
        expect(ownerContext.canSelectRestaurant).toBe(false);
        expect(ownerContext.fixedRestaurantKey).toBe(tenantA.key);
        expect(ownerContext.restaurants.map((restaurant) => restaurant.key)).toEqual([
          tenantA.key,
        ]);
        expect(ownerContext.profiles.some((profile) => profile.type === "OWNER")).toBe(
          false
        );

        const crossTenantResponse = await ownerA.api.post("/api/admin/users/create", {
          data: {
            creationExperienceVersion: 2,
            user: buildGuidedUser({
              email: `cross-${uniqueKey("person")}@tenant.local`,
              restaurantKey: tenantB.key,
            }),
          },
        });
        expect(crossTenantResponse.status()).toBe(403);
        const crossTenantBody = await crossTenantResponse.json();
        expect(crossTenantBody.errorCode).toBe("owner_restaurant_scope_denied");
        expect(JSON.stringify(crossTenantBody)).not.toContain(tenantB.ownerLogin);
      } finally {
        await ownerA.api.dispose();
      }
    } finally {
      await master.api.dispose();
    }
  });

  test("domínio próprio pendente nunca é apresentado como ativo", async () => {
    const master = await loginMaster();
    const key = uniqueKey("domain-pending");
    const ownerLogin = `owner@${key}.local`;
    const customDomain = `${key}.example.test`;
    const documentDigits = String(Date.now()).replace(/\D/g, "").padStart(14, "7").slice(-14);

    try {
      const onboardingResponse = await master.api.post(
        "/api/admin/master/onboard-restaurant",
        {
          data: {
            restaurantName: `Pending ${key}`,
            tradeName: `Pending ${key}`,
            name: `Pending ${key}`,
            slug: key,
            restaurantKey: key,
            customDomain,
            menuAddress: { type: "custom", customDomain },
            document: documentDigits,
            ownerFullName: "Owner Pending",
            email: ownerLogin,
            phone: "5511999922222",
            whatsapp: "5511999922222",
            city: "Sao Paulo",
            postalCode: "01000000",
            establishmentNumber: "100",
            adhesionDate: "2026-07-25",
            address: {
              street: "Rua Pending",
              number: "100",
              neighborhood: "Centro",
              city: "Sao Paulo",
              state: "SP",
              postalCode: "01000000",
            },
            delivery: {
              radiusKm: 5,
              fee: 8,
              minimumOrder: 30,
              deliveriesEnabled: true,
            },
            paymentMethods: ["pix"],
            plan: "PRO",
            subscriptionStatus: "TRIAL",
            adminUser: {
              login: ownerLogin,
              email: ownerLogin,
              name: "Owner Pending",
              password: "OwnerPending123!",
            },
          },
        }
      );
      expect(onboardingResponse.status()).toBe(200);

      const contextResponse = await master.api.get("/api/admin/users/create-context");
      expect(contextResponse.status()).toBe(200);
      const context = await contextResponse.json();
      const restaurant = context.restaurants.find((entry) => entry.key === key);
      expect(restaurant.accessAddress.type).toBe("CUSTOM_DOMAIN");
      expect(restaurant.accessAddress.displayUrl).toBe(customDomain);
      expect(restaurant.accessAddress.status).toBe("PENDING_VERIFICATION");
      expect(restaurant.accessAddress.statusLabel).toBe("Aguardando verificacao");
      expect(restaurant.accessAddress.finalUrl).toBe(
        `https://www.inovasfood.com.br/${key}`
      );
    } finally {
      await master.api.dispose();
    }
  });
});
