const { test, expect } = require("@playwright/test");
const {
  createApiContext,
  expectNoHorizontalOverflow,
  loginAdmin,
  loginMaster,
  loginTenantOwner,
  onboardRestaurant,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");

test.describe.configure({ mode: "serial" });

const masterLogin = process.env.E2E_ADMIN_LOGIN;
const masterPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe("SYSTEM × RESTAURANT security boundary", () => {
  test("SystemSession has null tenant and cannot call tenant APIs", async () => {
    const master = await loginMaster();

    try {
      const sessionResponse = await master.api.get("/api/auth/system/session");
      expect(sessionResponse.status()).toBe(200);
      const session = await sessionResponse.json();
      expect(session.authenticated).toBe(true);
      expect(session.data.session.audience).toBe("system");
      expect(session.data.session.tenantId).toBeNull();
      expect(session.data.session.restaurantId).toBeNull();
      expect(
        session.data.session.effectivePermissions.every((permission) =>
          permission.startsWith("system.")
        )
      ).toBe(true);

      const tenantResponse = await master.api.get("/api/tenant/users");
      expect([401, 403]).toContain(tenantResponse.status());

      const healthResponse = await master.api.get("/api/system/health");
      expect(healthResponse.status()).toBe(200);
      const health = await healthResponse.json();
      expect(JSON.stringify(health)).not.toContain("customerName");
      expect(JSON.stringify(health)).not.toContain("orderItems");
    } finally {
      await master.api.dispose();
    }
  });

  test("System user receives only System principal and one-time access", async () => {
    const master = await loginMaster();
    const email = `system-${uniqueKey("user")}@inovas.local`;

    try {
      const createResponse = await master.api.post("/api/system/users", {
        data: {
          name: "Analista System",
          email,
          phone: "(11) 98888-2200",
          jobTitle: "Analista de plataforma",
          department: "Tecnologia",
          internalNote: "Conta de validação automatizada.",
          role: "AUDITOR",
          credentialMode: "TEMPORARY_PASSWORD",
        },
      });
      expect(createResponse.status()).toBe(201);
      const created = await createResponse.json();
      expect(created.data.user.role).toBe("AUDITOR");
      expect(created.data.user.department).toBe("Tecnologia");
      expect(created.data.access.oneTimeDisplay).toBe(true);
      expect(created.data.access.temporaryPassword).toMatch(/[A-Za-z]/);
      expect(created.data.user.tenantId).toBeUndefined();
      expect(created.data.user.restaurantId).toBeUndefined();

      const listResponse = await master.api.get(
        `/api/system/users?search=${encodeURIComponent(email)}`
      );
      expect(listResponse.status()).toBe(200);
      const list = await listResponse.json();
      expect(list.data.users).toHaveLength(1);
      expect(JSON.stringify(list)).not.toContain(
        created.data.access.temporaryPassword
      );
    } finally {
      await master.api.dispose();
    }
  });

  test("tenant is taken from RestaurantSession and cross-tenant attempts fail", async () => {
    const master = await loginMaster();
    const restaurantA = await onboardRestaurant(master.api, {
      key: uniqueKey("boundary-a"),
      ownerPassword: "OwnerBoundaryA123!",
    });
    const restaurantB = await onboardRestaurant(master.api, {
      key: uniqueKey("boundary-b"),
      ownerPassword: "OwnerBoundaryB123!",
    });
    const ownerA = await loginTenantOwner(restaurantA);
    const ownerB = await loginTenantOwner(restaurantB);

    try {
      const sessionResponse = await ownerA.api.get("/api/tenant/session");
      expect(sessionResponse.status()).toBe(200);
      const session = await sessionResponse.json();
      expect(session.data.session.audience).toBe("restaurant");
      expect(session.data.session.restaurantKey).toBe(restaurantA.key);
      expect(
        session.data.session.effectivePermissions.every((permission) =>
          permission.startsWith("tenant.")
        )
      ).toBe(true);

      const systemResponse = await ownerA.api.get("/api/system/health");
      expect([401, 403]).toContain(systemResponse.status());

      const listBResponse = await ownerB.api.get("/api/tenant/users");
      const listB = await listBResponse.json();
      const ownerBUser = listB.data.users.find(
        (user) => user.email === restaurantB.ownerLogin
      );
      expect(ownerBUser).toBeTruthy();

      const crossEdit = await ownerA.api.patch(
        `/api/tenant/users/${encodeURIComponent(ownerBUser.id)}`,
        {
          data: {
            name: "Cross tenant denied",
            email: ownerBUser.email,
            role: "OWNER",
          },
        }
      );
      expect(crossEdit.status()).toBe(404);

      const manipulatedCreate = await ownerA.api.post("/api/tenant/users", {
        data: {
          name: "Tentativa manipulada",
          email: `spoof-${uniqueKey("tenant")}@local.test`,
          role: "CASHIER",
          credentialMode: "INVITE",
          tenantId: "tenant_forjado",
          restaurantId: "restaurant_forjado",
        },
      });
      expect(manipulatedCreate.status()).toBe(422);
      expect((await manipulatedCreate.json()).error.code).toBe(
        "tenant_input_forbidden"
      );

      const invalidDependency = await ownerA.api.post("/api/tenant/users", {
        data: {
          name: "Permissão inválida",
          email: `permission-${uniqueKey("tenant")}@local.test`,
          role: "CUSTOM",
          credentialMode: "INVITE",
          grantOverrides: ["tenant.orders.edit"],
        },
      });
      expect(invalidDependency.status()).toBe(422);
      expect((await invalidDependency.json()).error.code).toBe(
        "permission_dependency_missing"
      );
    } finally {
      await ownerA.api.dispose();
      await ownerB.api.dispose();
      await master.api.dispose();
    }
  });

  test("support VIEW is read-only, revocable and cannot be replayed", async () => {
    const master = await loginMaster();
    const restaurant = await onboardRestaurant(master.api, {
      key: uniqueKey("support-view"),
      ownerPassword: "OwnerSupportView123!",
    });

    try {
      const startResponse = await master.api.post("/api/support/start", {
        data: {
          restaurantKey: restaurant.key,
          mode: "VIEW",
          reason: "Diagnóstico automatizado de saúde do restaurante.",
          confirmed: true,
        },
      });
      expect(startResponse.status()).toBe(201);
      const started = await startResponse.json();
      expect(started.data.supportSession.mode).toBe("VIEW");
      expect(started.data.supportSession.status).toBe("ACTIVE");

      const healthResponse = await master.api.get("/api/tenant/health");
      expect(healthResponse.status()).toBe(200);
      const health = await healthResponse.json();
      expect(health.data.health.restaurantKey).toBe(restaurant.key);

      const usersResponse = await master.api.get("/api/tenant/users");
      expect(usersResponse.status()).toBe(403);

      const writeResponse = await master.api.patch("/api/tenant/settings", {
        data: { presentationText: "VIEW não pode alterar." },
      });
      expect(writeResponse.status()).toBe(403);

      const revokeResponse = await master.api.post("/api/support/revoke", {
        data: {},
      });
      expect(revokeResponse.status()).toBe(200);

      const replayResponse = await master.api.get("/api/tenant/health");
      expect([401, 403]).toContain(replayResponse.status());
    } finally {
      await master.api.dispose();
    }
  });

  test("support ADMIN requires confirmation, permits allowlisted write and expires on revoke", async () => {
    const master = await loginMaster();
    const restaurant = await onboardRestaurant(master.api, {
      key: uniqueKey("support-admin"),
      ownerPassword: "OwnerSupportAdmin123!",
    });

    try {
      const missingConfirmation = await master.api.post("/api/support/start", {
        data: {
          restaurantKey: restaurant.key,
          mode: "ADMIN",
          reason: "Correção administrativa validada em teste automatizado.",
          confirmed: false,
        },
      });
      expect(missingConfirmation.status()).toBe(422);
      expect((await missingConfirmation.json()).error.code).toBe(
        "support_confirmation_required"
      );

      const startResponse = await master.api.post("/api/support/start", {
        data: {
          restaurantKey: restaurant.key,
          mode: "ADMIN",
          reason: "Correção administrativa validada em teste automatizado.",
          confirmed: true,
        },
      });
      expect(startResponse.status()).toBe(201);

      const settingsResponse = await master.api.get("/api/tenant/settings");
      expect(
        settingsResponse.status(),
        await settingsResponse.text()
      ).toBe(200);
      const settingsPayload = await settingsResponse.json();
      const settings = settingsPayload.data.settings;

      const updateResponse = await master.api.patch("/api/tenant/settings", {
        data: {
          settings: {
            ...settings,
            presentationText: "Atualização segura por SupportSession ADMIN.",
          },
        },
      });
      expect(updateResponse.status()).toBe(200);
      expect((await updateResponse.json()).data.settings.presentationText).toBe(
        "Atualização segura por SupportSession ADMIN."
      );

      const revokeResponse = await master.api.post("/api/support/revoke", {
        data: {},
      });
      expect(revokeResponse.status()).toBe(200);

      const writeAfterRevoke = await master.api.patch("/api/tenant/settings", {
        data: { presentationText: "Replay" },
      });
      expect([401, 403]).toContain(writeAfterRevoke.status());
    } finally {
      await master.api.dispose();
    }
  });

  test("invitation is single-use, resend invalidates prior token and secrets are not stored", async () => {
    const master = await loginMaster();
    const email = `invite-${uniqueKey("system")}@inovas.local`;

    try {
      const createResponse = await master.api.post("/api/system/users", {
        data: {
          name: "Convidado System",
          email,
          role: "AUDITOR",
          credentialMode: "INVITE",
        },
      });
      expect(createResponse.status()).toBe(201);
      const created = await createResponse.json();
      const firstUrl = created.data.access.invitationUrl;
      expect(firstUrl).toContain("token=");
      const firstToken = new URL(firstUrl).searchParams.get("token");

      const resendResponse = await master.api.post(
        `/api/system/users/${encodeURIComponent(
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

      const rateLimitedResponse = await master.api.post(
        `/api/system/users/${encodeURIComponent(
          created.data.user.id
        )}/invite/resend`,
        { data: {} }
      );
      expect(rateLimitedResponse.status()).toBe(429);
      expect((await rateLimitedResponse.json()).error.code).toBe(
        "invitation_resend_rate_limited"
      );

      const oldTokenResponse = await master.api.post(
        "/api/admin/auth/accept-invite",
        {
          data: {
            token: firstToken,
            password: "ConviteAntigo123!",
            passwordConfirmation: "ConviteAntigo123!",
          },
        }
      );
      expect([400, 404, 409, 410]).toContain(oldTokenResponse.status());

      const acceptResponse = await master.api.post(
        "/api/admin/auth/accept-invite",
        {
          data: {
            token: secondToken,
            password: "ConviteNovo123!",
            passwordConfirmation: "ConviteNovo123!",
          },
        }
      );
      expect(acceptResponse.status()).toBe(200);

      const replayResponse = await master.api.post(
        "/api/admin/auth/accept-invite",
        {
          data: {
            token: secondToken,
            password: "ReplayNegado123!",
            passwordConfirmation: "ReplayNegado123!",
          },
        }
      );
      expect([400, 404, 409, 410]).toContain(replayResponse.status());

      const listResponse = await master.api.get(
        `/api/system/users?search=${encodeURIComponent(email)}`
      );
      const serialized = JSON.stringify(await listResponse.json());
      expect(serialized).not.toContain(firstToken);
      expect(serialized).not.toContain(secondToken);
      expect(serialized).not.toContain("ConviteNovo123!");
    } finally {
      await master.api.dispose();
    }
  });

  test("user lifecycle requires reason, protects the last Owner and revokes sessions", async () => {
    const master = await loginMaster();
    const restaurant = await onboardRestaurant(master.api, {
      key: uniqueKey("lifecycle"),
      ownerPassword: "OwnerLifecycle123!",
    });
    const owner = await loginTenantOwner(restaurant);
    const memberEmail = `caixa-${uniqueKey("lifecycle")}@local.test`;
    let memberApi;

    try {
      const createResponse = await owner.api.post("/api/tenant/users", {
        data: {
          name: "Caixa Ciclo de Vida",
          email: memberEmail,
          role: "CASHIER",
          credentialMode: "TEMPORARY_PASSWORD",
        },
      });
      expect(createResponse.status()).toBe(201);
      const created = await createResponse.json();
      const temporaryPassword = created.data.access.temporaryPassword;

      memberApi = await createApiContext({
        host: restaurant.host,
        origin: process.env.VALIDATION_BASE_URL,
      });
      const memberLogin = await loginAdmin(memberApi, {
        identifier: memberEmail,
        password: temporaryPassword,
      });
      expect(memberLogin.response.status()).toBe(200);
      expect((await memberApi.get("/api/tenant/session")).status()).toBe(200);

      const missingReason = await owner.api.post(
        `/api/tenant/users/${encodeURIComponent(created.data.user.id)}/block`,
        { data: {} }
      );
      expect(missingReason.status()).toBe(422);
      expect((await missingReason.json()).error.code).toBe(
        "user_status_reason_required"
      );

      const blockResponse = await owner.api.post(
        `/api/tenant/users/${encodeURIComponent(created.data.user.id)}/block`,
        {
          data: {
            reason: "Afastamento temporário validado em teste.",
            revokeSessions: true,
          },
        }
      );
      expect(blockResponse.status()).toBe(200);
      expect((await blockResponse.json()).data.user.status).toBe("BLOCKED");
      expect([401, 403]).toContain(
        (await memberApi.get("/api/tenant/session")).status()
      );

      const unblockResponse = await owner.api.post(
        `/api/tenant/users/${encodeURIComponent(created.data.user.id)}/unblock`,
        { data: {} }
      );
      expect(unblockResponse.status()).toBe(200);
      expect((await unblockResponse.json()).data.user.status).toBe("ACTIVE");

      const individualResponse = await owner.api.get(
        `/api/tenant/users/${encodeURIComponent(created.data.user.id)}`
      );
      expect(individualResponse.status()).toBe(200);
      expect((await individualResponse.json()).data.user.email).toBe(
        memberEmail
      );

      const secondLogin = await loginAdmin(memberApi, {
        identifier: memberEmail,
        password: temporaryPassword,
      });
      expect(secondLogin.response.status()).toBe(200);
      const revokeWithoutReason = await owner.api.post(
        `/api/tenant/users/${encodeURIComponent(
          created.data.user.id
        )}/sessions/revoke`,
        { data: {} }
      );
      expect(revokeWithoutReason.status()).toBe(422);
      expect((await revokeWithoutReason.json()).error.code).toBe(
        "session_revoke_reason_required"
      );
      const revokeSessionsResponse = await owner.api.post(
        `/api/tenant/users/${encodeURIComponent(
          created.data.user.id
        )}/sessions/revoke`,
        {
          data: {
            reason: "Encerramento administrativo validado em teste.",
          },
        }
      );
      expect(revokeSessionsResponse.status()).toBe(200);
      expect(
        (await revokeSessionsResponse.json()).data.revokedSessions
      ).toBeGreaterThanOrEqual(1);
      expect([401, 403]).toContain(
        (await memberApi.get("/api/tenant/session")).status()
      );

      const deactivateResponse = await owner.api.post(
        `/api/tenant/users/${encodeURIComponent(
          created.data.user.id
        )}/deactivate`,
        {
          data: {
            reason: "Desativação lógica para preservar o histórico.",
            revokeSessions: true,
          },
        }
      );
      expect(deactivateResponse.status()).toBe(200);
      expect((await deactivateResponse.json()).data.user.status).toBe(
        "INACTIVE"
      );

      const usersResponse = await owner.api.get(
        `/api/tenant/users?search=${encodeURIComponent(memberEmail)}`
      );
      const users = await usersResponse.json();
      expect(users.data.users[0].auditTrail).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: "USER_STATUS_CHANGED",
            metadata: expect.objectContaining({
              reason: "Desativação lógica para preservar o histórico.",
            }),
          }),
        ])
      );

      const ownerListResponse = await owner.api.get("/api/tenant/users");
      const ownerList = await ownerListResponse.json();
      const ownerUser = ownerList.data.users.find(
        (user) => user.email === restaurant.ownerLogin
      );
      const lastOwnerBlock = await owner.api.post(
        `/api/tenant/users/${encodeURIComponent(ownerUser.id)}/block`,
        {
          data: {
            reason: "Tentativa que deve ser negada.",
            revokeSessions: true,
          },
        }
      );
      expect([400, 409]).toContain(lastOwnerBlock.status());
      expect((await lastOwnerBlock.json()).error.code).toBe(
        "invalid_internal_user_type"
      );

      const supportStart = await master.api.post("/api/support/start", {
        data: {
          restaurantKey: restaurant.key,
          mode: "ADMIN",
          reason: "Validar proteção do último Owner ativo.",
          confirmed: true,
        },
      });
      expect(supportStart.status()).toBe(201);
      const supportOwnerBlock = await master.api.post(
        `/api/tenant/users/${encodeURIComponent(ownerUser.id)}/block`,
        {
          data: {
            reason: "Tentativa controlada sobre o último Owner.",
            revokeSessions: true,
          },
        }
      );
      expect(supportOwnerBlock.status()).toBe(409);
      expect((await supportOwnerBlock.json()).error.code).toBe(
        "last_active_owner_required"
      );
      expect((await master.api.post("/api/support/revoke", { data: {} })).status()).toBe(
        200
      );
    } finally {
      await memberApi?.dispose();
      await owner.api.dispose();
      await master.api.dispose();
    }
  });

  test("System and Restaurant user interfaces are responsive and domain-specific", async ({
    browser,
  }) => {
    const systemContext = await browser.newContext({
      viewport: { width: 1440, height: 960 },
    });
    const systemPage = await systemContext.newPage();
    const systemLogin = await systemPage.request.post("/api/admin/login", {
      data: { identifier: masterLogin, password: masterPassword },
    });
    expect(systemLogin.status()).toBe(200);
    await systemPage.goto("/system/users");
    await expect(systemPage.getByRole("heading", { name: "Usuários INOVAS" })).toBeVisible();
    await expect(systemPage.locator("body")).not.toContainText("Pedidos em rota");
    await systemPage.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(systemPage);
    await systemContext.close();

    const master = await loginMaster();
    const restaurant = await onboardRestaurant(master.api, {
      key: uniqueKey("users-ui"),
      ownerPassword: "OwnerUsersUi123!",
    });
    const restaurantContext = await browser.newContext({
      viewport: { width: 1440, height: 960 },
    });
    const restaurantPage = await restaurantContext.newPage();
    const ownerLogin = await restaurantPage.request.post("/api/admin/login", {
      data: {
        identifier: restaurant.ownerLogin,
        password: restaurant.ownerPassword,
      },
    });
    expect(ownerLogin.status()).toBe(200);
    await restaurantPage.goto("/admin/users");
    await expect(
      restaurantPage.getByRole("heading", { name: "Usuários", exact: true })
    ).toBeVisible();
    await restaurantPage.goto("/admin/users/new");
    await restaurantPage
      .locator('input[name="role"][value="CUSTOM"]')
      .check();
    await restaurantPage
      .locator('input[name="permission"][value="tenant.orders.edit"]')
      .check();
    await expect(
      restaurantPage.locator(
        'input[name="permission"][value="tenant.orders.view"]'
      )
    ).toBeChecked();
    await restaurantPage.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(restaurantPage);
    await restaurantContext.close();
    await master.api.dispose();
  });
});
