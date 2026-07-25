const { test, expect } = require("@playwright/test");
const {
  expectNoHorizontalOverflow,
  loginMaster,
  loginTenantOwner,
  onboardRestaurant,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");
const { getRestaurantAccessAddress } = require("../../lib/admin-api.cjs");

test.describe.configure({ mode: "serial" });

test.describe("Criação profissional de usuário", () => {
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
    expect(activeDomain.finalUrl).toBe("https://cliente.example.test");

    const pendingDomain = getRestaurantAccessAddress(restaurant, [
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
    expect(pendingDomain.status).toBe("PENDING_VERIFICATION");
    expect(pendingDomain.finalUrl).toBe(
      "https://www.inovasfood.com.br/custom-domain-active"
    );
  });

  test("página dedicada usa perfis reais, dependências e resumo responsivo", async ({
    browser,
  }) => {
    const master = await loginMaster();
    const restaurant = await onboardRestaurant(master.api, {
      key: uniqueKey("user-create-ui"),
      ownerPassword: "OwnerCreateUi123!",
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
    });
    const page = await context.newPage();

    try {
      const login = await page.request.post("/api/admin/login", {
        data: {
          identifier: restaurant.ownerLogin,
          password: restaurant.ownerPassword,
        },
      });
      expect(login.status()).toBe(200);
      await page.goto("/admin/users/new");
      await expect(
        page.getByRole("heading", { name: "Criar novo usuário" })
      ).toBeVisible();
      expect(await page.locator('input[name="role"]').count()).toBeGreaterThanOrEqual(
        10
      );

      await page.locator('input[name="role"][value="CUSTOM"]').check();
      await page
        .locator('input[name="permission"][value="tenant.orders.edit"]')
        .check();
      await expect(
        page.locator(
          'input[name="permission"][value="tenant.orders.view"]'
        )
      ).toBeChecked();
      page.once("dialog", async (dialog) => {
        expect(dialog.message()).toContain("permissão(ões) dependente(s)");
        await dialog.accept();
      });
      await page
        .locator('input[name="permission"][value="tenant.orders.view"]')
        .uncheck();
      await expect(
        page.locator(
          'input[name="permission"][value="tenant.orders.edit"]'
        )
      ).not.toBeChecked();

      await page.locator('input[name="name"]').fill("Ana da Silva");
      await page
        .locator('input[name="email"]')
        .fill(`ana-${uniqueKey("ui")}@tenant.local`);
      await page.locator('input[name="department"]').fill("Atendimento");
      await expect(page.locator("[data-editor-summary]")).toContainText(
        "Ana da Silva"
      );
      await expect(page.locator("[data-editor-summary]")).toContainText(
        "Atendimento"
      );

      await page.setViewportSize({ width: 390, height: 844 });
      await expectNoHorizontalOverflow(page);
    } finally {
      await context.close();
      await master.api.dispose();
    }
  });

  test("convite persiste somente como hash, reenvio invalida o anterior e aceite é único", async () => {
    const master = await loginMaster();
    const restaurant = await onboardRestaurant(master.api, {
      key: uniqueKey("user-invite"),
      ownerPassword: "OwnerInvite123!",
    });
    const owner = await loginTenantOwner(restaurant);
    const email = `invite-${uniqueKey("person")}@tenant.local`;

    try {
      const createResponse = await owner.api.post("/api/tenant/users", {
        data: {
          name: "Pessoa Convidada",
          email,
          role: "CASHIER",
          credentialMode: "INVITE",
        },
      });
      expect(createResponse.status()).toBe(201);
      const created = await createResponse.json();
      expect(created.data.user.status).toBe("PENDING");
      const firstToken = new URL(created.data.access.invitationUrl).searchParams.get(
        "token"
      );

      const resendResponse = await owner.api.post(
        `/api/tenant/users/${encodeURIComponent(
          created.data.user.id
        )}/invite/resend`,
        { data: {} }
      );
      expect(resendResponse.status()).toBe(200);
      const resent = await resendResponse.json();
      const secondToken = new URL(resent.data.invitation.url).searchParams.get(
        "token"
      );
      expect(secondToken).not.toBe(firstToken);

      const oldAcceptance = await owner.api.post(
        "/api/admin/auth/accept-invite",
        {
          data: {
            token: firstToken,
            password: "ConviteAntigo123!",
            passwordConfirmation: "ConviteAntigo123!",
          },
        }
      );
      expect([400, 404, 409, 410]).toContain(oldAcceptance.status());

      const acceptance = await owner.api.post(
        "/api/admin/auth/accept-invite",
        {
          data: {
            token: secondToken,
            password: "ConviteValido123!",
            passwordConfirmation: "ConviteValido123!",
          },
        }
      );
      expect(acceptance.status()).toBe(200);
      const replay = await owner.api.post("/api/admin/auth/accept-invite", {
        data: {
          token: secondToken,
          password: "ReplayNegado123!",
          passwordConfirmation: "ReplayNegado123!",
        },
      });
      expect([400, 404, 409, 410]).toContain(replay.status());

      const list = await owner.api.get(
        `/api/tenant/users?search=${encodeURIComponent(email)}`
      );
      const serialized = JSON.stringify(await list.json());
      expect(serialized).not.toContain(firstToken);
      expect(serialized).not.toContain(secondToken);
      expect(serialized).not.toContain("ConviteValido123!");
    } finally {
      await owner.api.dispose();
      await master.api.dispose();
    }
  });

  test("senha temporária é exibida uma vez e tenant forjado é rejeitado", async () => {
    const master = await loginMaster();
    const restaurant = await onboardRestaurant(master.api, {
      key: uniqueKey("user-password"),
      ownerPassword: "OwnerPassword123!",
    });
    const owner = await loginTenantOwner(restaurant);
    const email = `temp-${uniqueKey("person")}@tenant.local`;

    try {
      const createResponse = await owner.api.post("/api/tenant/users", {
        data: {
          name: "Pessoa Temporária",
          email,
          role: "SERVICE",
          credentialMode: "TEMPORARY_PASSWORD",
          department: "Atendimento",
        },
      });
      expect(createResponse.status()).toBe(201);
      const created = await createResponse.json();
      expect(created.data.access.temporaryPassword).toBeTruthy();
      expect(created.data.user.department).toBe("Atendimento");

      const list = await owner.api.get(
        `/api/tenant/users?search=${encodeURIComponent(email)}`
      );
      expect(JSON.stringify(await list.json())).not.toContain(
        created.data.access.temporaryPassword
      );

      const spoof = await owner.api.post("/api/tenant/users", {
        data: {
          name: "Tenant Forjado",
          email: `spoof-${uniqueKey("person")}@tenant.local`,
          role: "SERVICE",
          credentialMode: "INVITE",
          restaurantKey: "outro-restaurante",
        },
      });
      expect(spoof.status()).toBe(422);
      expect((await spoof.json()).error.code).toBe("tenant_input_forbidden");
    } finally {
      await owner.api.dispose();
      await master.api.dispose();
    }
  });
});
