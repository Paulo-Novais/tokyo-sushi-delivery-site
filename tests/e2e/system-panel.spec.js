const { test, expect } = require("@playwright/test");
const {
  createApiContext,
  expectNoHorizontalOverflow,
  loginMaster,
  loginTenantOwner,
  onboardRestaurant,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");

test.describe.configure({ mode: "serial" });

const masterLogin = process.env.E2E_ADMIN_LOGIN;
const masterPassword = process.env.E2E_ADMIN_PASSWORD;

const SCREENS = [
  ["/system", "Visão geral da INOVAS"],
  ["/system#restaurantes", "Restaurantes"],
  ["/system#suporte", "Suporte auditado"],
  ["/system#auditoria", "Auditoria"],
  ["/system/users", "Usuários INOVAS"],
  ["/system#perfis", "Perfis e menus"],
];

const loginSystemPage = async (page, identifier, password) => {
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `127.31.${Math.floor(Math.random() * 200) + 1}.${
      Math.floor(Math.random() * 200) + 1
    }`,
  });
  await page.goto("/system/login.html");
  await page.locator('input[name="identifier"]').fill(identifier);
  await page.locator('input[name="password"]').fill(password);
  await page.locator("[data-system-login-submit]").click();
  await expect(page).toHaveURL(/\/system\/?$/);
};

test.describe("Painel System redesenhado", () => {
  test("login não diz se é System ou restaurante e não vaza se o e-mail existe", async ({
    page,
  }) => {
    await page.goto("/system/login.html");
    await expect(
      page.getByRole("heading", { name: "Acesso à plataforma" })
    ).toBeVisible();
    const text = (await page.locator("body").textContent()) || "";
    expect(text).not.toMatch(/System|Gestor|Protótipo/);

    await page.locator('input[name="identifier"]').fill("ninguem@local.test");
    await page.locator('input[name="password"]').fill("senha-incorreta-123");
    await page.locator("[data-system-login-submit]").click();
    const feedback = page.locator("[data-system-login-feedback]");
    await expect(feedback).toBeVisible();
    await expect(feedback).not.toContainText(/não existe|não encontrad/i);
    await expect(page).toHaveURL(/\/system\/login\.html/);
  });

  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    test(`todas as telas abrem em ${width}px sem erro nem rolagem lateral`, async ({
      page,
    }) => {
      const problems = [];
      page.on("pageerror", (error) => problems.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") problems.push(message.text());
      });
      await page.setViewportSize({ width, height });
      await loginSystemPage(page, masterLogin, masterPassword);

      for (const [url, heading] of SCREENS) {
        await page.goto(url);
        await expect(
          page.locator("[data-system-app]").getByRole("heading", {
            level: 1,
            name: heading,
          })
        ).toBeVisible();
        await expect(page.locator("[data-system-app] [aria-busy]")).toHaveCount(0);
        await expect(page.locator("body")).not.toContainText("Protótipo");
        await expectNoHorizontalOverflow(page);
      }

      if (width <= 900) {
        await expect(page.locator("[data-system-bottomnav] a")).toHaveCount(4);
      } else {
        await expect(
          page.locator('[data-system-sidebar] a[aria-current="page"]')
        ).toHaveText("Perfis e menus");
      }
      expect(problems).toEqual([]);
    });
  }

  test("suporte exige restaurante, motivo de 10 caracteres e confirmação", async ({
    page,
  }) => {
    await loginSystemPage(page, masterLogin, masterPassword);
    await page.goto("/system#suporte");
    const submit = page.locator("[data-support-submit]");
    await expect(submit).toBeDisabled();

    await page.locator('select[name="restaurantKey"]').selectOption({ index: 1 });
    await page.locator('textarea[name="reason"]').fill("curto");
    await page.locator('input[name="confirmed"]').check();
    await expect(submit).toBeDisabled();

    await page
      .locator('textarea[name="reason"]')
      .fill("Verificar configuração a pedido do restaurante.");
    await expect(submit).toBeEnabled();
    await expect(submit).toContainText("30 min");

    await page.locator('input[name="mode"][value="ADMIN"]').check({ force: true });
    await expect(submit).toContainText("15 min");
    await page.locator('input[name="mode"][value="VIEW"]').check({ force: true });

    await page.locator('input[name="confirmed"]').uncheck();
    await expect(submit).toBeDisabled();
    await page.locator('input[name="confirmed"]').check();

    await submit.click();
    const revoke = page.locator('[data-action="support-revoke"]');
    await expect(revoke).toBeVisible();
    await expect(page.locator(".sys-session")).toContainText("Visualização");

    await revoke.click();
    await expect(revoke).toHaveCount(0);
  });

  test("API de suporte recusa motivo curto e falta de confirmação", async () => {
    const master = await loginMaster();
    try {
      const restaurants = await (
        await master.api.get("/api/system/restaurants")
      ).json();
      const restaurantKey = restaurants.data.restaurants[0].restaurantKey;

      const shortReason = await master.api.post("/api/support/start", {
        data: { restaurantKey, mode: "VIEW", reason: "curto", confirmed: true },
      });
      expect(shortReason.status()).toBe(422);

      const unconfirmed = await master.api.post("/api/support/start", {
        data: {
          restaurantKey,
          mode: "VIEW",
          reason: "Motivo com tamanho suficiente.",
          confirmed: false,
        },
      });
      expect(unconfirmed.status()).toBe(422);
    } finally {
      await master.api.dispose();
    }
  });

  test("perfil sem permissão não vê o menu e recebe 403 na API", async ({
    page,
  }) => {
    const master = await loginMaster();
    const email = `auditor-${uniqueKey("painel")}@inovas.local`;
    let password;
    let restaurantKey;
    try {
      const created = await master.api.post("/api/system/users", {
        data: {
          name: "Auditor Painel",
          email,
          role: "AUDITOR",
          credentialMode: "TEMPORARY_PASSWORD",
        },
      });
      expect(created.status()).toBe(201);
      password = (await created.json()).data.access.temporaryPassword;
      const restaurants = await (
        await master.api.get("/api/system/restaurants")
      ).json();
      restaurantKey = restaurants.data.restaurants[0].restaurantKey;
    } finally {
      await master.api.dispose();
    }

    await loginSystemPage(page, email, password);
    const sidebar = page.locator("[data-system-sidebar]");
    await expect(sidebar.getByRole("link", { name: "Auditoria" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Suporte" })).toHaveCount(0);

    await page.goto("/system#suporte");
    await expect(page.locator("[data-system-app]")).toContainText("Sem permissão");
    await expect(page.locator("[data-support-form]")).toHaveCount(0);

    await page.goto("/system/users");
    await expect(
      page.getByRole("heading", { name: "Usuários INOVAS" })
    ).toBeVisible();
    await expect(page.locator("[data-user-action]")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Novo usuário" })).toHaveCount(0);

    const start = await page.request.post("/api/support/start", {
      data: {
        restaurantKey,
        mode: "VIEW",
        reason: "Tentativa sem permissão de suporte.",
        confirmed: true,
      },
    });
    expect(start.status()).toBe(403);

    const block = await page.request.post(
      "/api/system/users/qualquer/block",
      { data: { reason: "Tentativa sem permissão." } }
    );
    expect(block.status()).toBe(403);
  });

  test("contas de dois restaurantes nunca alcançam o System", async () => {
    const master = await loginMaster();
    const restaurantA = await onboardRestaurant(master.api, {
      key: uniqueKey("painel-a"),
      ownerPassword: "OwnerPainelA123!",
    });
    const restaurantB = await onboardRestaurant(master.api, {
      key: uniqueKey("painel-b"),
      ownerPassword: "OwnerPainelB123!",
    });
    await master.api.dispose();

    for (const restaurant of [restaurantA, restaurantB]) {
      const owner = await loginTenantOwner(restaurant);
      try {
        for (const path of [
          "/api/system/dashboard",
          "/api/system/restaurants",
          "/api/system/users",
          "/api/system/permissions",
        ]) {
          const response = await owner.api.get(path);
          expect([401, 403], `${restaurant.key} ${path}`).toContain(
            response.status()
          );
        }
        const systemLogin = await owner.api.post("/api/auth/system/login", {
          data: {
            identifier: restaurant.ownerLogin,
            password: restaurant.ownerPassword,
          },
        });
        expect(systemLogin.status()).toBe(403);
      } finally {
        await owner.api.dispose();
      }
    }

    const anonymous = await createApiContext();
    try {
      expect((await anonymous.get("/api/system/dashboard")).status()).toBe(401);
    } finally {
      await anonymous.dispose();
    }
  });
});
