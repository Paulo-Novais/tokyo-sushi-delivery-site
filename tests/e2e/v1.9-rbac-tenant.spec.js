const { test, expect } = require("@playwright/test");
const {
  createAdminUser,
  createApiContext,
  createPublicOrder,
  loginAdmin,
  loginMaster,
  loginTenantOwner,
  onboardRestaurant,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");

test.describe("V1.9 RBAC and tenant isolation", () => {
  test("OWNER and custom users are constrained by platform RBAC", async () => {
    const master = await loginMaster();

    try {
      const tenant = await onboardRestaurant(master.api, {
        key: uniqueKey("v19-rbac"),
        ownerPassword: "SenhaOwnerRbac19",
      });
      const owner = await loginTenantOwner(tenant);

      try {
        const masterOverview = await owner.api.get("/api/admin/master/overview");
        expect(masterOverview.status()).toBe(403);
        expect((await masterOverview.json()).errorCode).toBe("master_access_required");
      } finally {
        await owner.api.dispose();
      }

      const customLogin = `orders-${tenant.key}@tenant.local`;
      const customPassword = "SenhaOrders19";
      await createAdminUser(master.api, {
        login: customLogin,
        email: customLogin,
        name: "Orders Only",
        password: customPassword,
        userType: "CUSTOM",
        restaurantKey: tenant.key,
        permissions: { orders_view: true },
      });

      const customApi = await createApiContext({ host: tenant.host });
      const customSession = await loginAdmin(customApi, {
        identifier: customLogin,
        password: customPassword,
      });
      expect(customSession.response.status()).toBe(200);

      try {
        const orders = await customApi.get("/api/admin/orders/list");
        expect(orders.status()).toBe(200);

        const catalogWrite = await customApi.post("/api/admin/catalog/save-section", {
          data: { id: `cat-${tenant.key}`, title: "Restrita V19" },
        });
        expect(catalogWrite.status()).toBe(403);

        const usersList = await customApi.get("/api/admin/users/list");
        expect(usersList.status()).toBe(403);
      } finally {
        await customApi.dispose();
      }
    } finally {
      await master.api.dispose();
    }
  });

  test("tenant hosts isolate orders, sessions and details across restaurants", async () => {
    const master = await loginMaster();

    try {
      const tenantA = await onboardRestaurant(master.api, {
        key: uniqueKey("v19-ta"),
        ownerPassword: "SenhaTenantA19",
      });
      const tenantB = await onboardRestaurant(master.api, {
        key: uniqueKey("v19-tb"),
        ownerPassword: "SenhaTenantB19",
      });

      const ownerA = await loginTenantOwner(tenantA);
      const ownerB = await loginTenantOwner(tenantB);

      try {
        const orderA = await createPublicOrder({ host: tenantA.host, label: tenantA.key });
        const orderB = await createPublicOrder({ host: tenantB.host, label: tenantB.key });

        const listA = await ownerA.api.get("/api/admin/orders/list");
        expect(listA.status()).toBe(200);
        const listAPayload = await listA.json();
        const serializedA = JSON.stringify(listAPayload);
        expect(serializedA).toContain(orderA.publicId || orderA.id);
        expect(serializedA).not.toContain(orderB.publicId || orderB.id);

        const listB = await ownerB.api.get("/api/admin/orders/list");
        expect(listB.status()).toBe(200);
        const listBPayload = await listB.json();
        const serializedB = JSON.stringify(listBPayload);
        expect(serializedB).toContain(orderB.publicId || orderB.id);
        expect(serializedB).not.toContain(orderA.publicId || orderA.id);

        const detailsFromWrongTenant = await ownerA.api.get(
          `/api/admin/orders/details?orderId=${encodeURIComponent(orderB.id || orderB.publicId)}`
        );
        expect([403, 404, 500]).toContain(detailsFromWrongTenant.status());

        const ownerACookie = ownerA.cookie;
        const wrongHostApi = await createApiContext({ host: tenantB.host, cookie: ownerACookie });
        try {
          const mismatch = await wrongHostApi.get("/api/admin/orders/list");
          expect(mismatch.status()).toBe(403);
          expect(["tenant_session_mismatch", "security_access_denied"]).toContain(
            (await mismatch.json()).errorCode
          );
        } finally {
          await wrongHostApi.dispose();
        }
      } finally {
        await ownerA.api.dispose();
        await ownerB.api.dispose();
      }
    } finally {
      await master.api.dispose();
    }
  });
});
