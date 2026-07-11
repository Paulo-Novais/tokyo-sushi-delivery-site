const { test, expect } = require("@playwright/test");
const {
  createApiContext,
  loginAdmin,
  loginMaster,
} = require("./helpers/v1.9-fixtures.cjs");

test.describe("V1.9 auth and security headers", () => {
  test("admin auth rejects malformed credentials and creates protected session cookie", async () => {
    const api = await createApiContext();

    try {
      const anonymousSession = await api.get("/api/admin/session");
      expect(anonymousSession.status()).toBe(200);
      expect((await anonymousSession.json()).authenticated).toBe(false);

      const missingCredentials = await api.post("/api/admin/login", {
        data: { identifier: "", password: "" },
      });
      expect(missingCredentials.status()).toBe(400);
      expect((await missingCredentials.json()).errorCode).toBe("missing_credentials");

      const invalidCredentials = await api.post("/api/admin/login", {
        data: { identifier: "nobody@example.test", password: "wrong-password" },
      });
      expect(invalidCredentials.status()).toBe(401);
      expect((await invalidCredentials.json()).errorCode).toBe("invalid_credentials");
    } finally {
      await api.dispose();
    }

    const master = await loginMaster();

    try {
      const setCookie = master.response
        .headersArray()
        .find((header) => header.name.toLowerCase() === "set-cookie")?.value || "";
      expect(setCookie).toContain("HttpOnly");
      expect(setCookie).toContain("SameSite=Lax");

      const session = await master.api.get("/api/admin/session");
      expect(session.status()).toBe(200);
      const payload = await session.json();
      expect(payload.authenticated).toBe(true);
      expect(payload.admin.userType).toBe("MASTER");
    } finally {
      await master.api.dispose();
    }
  });

  test("public and admin surfaces expose security headers locally", async () => {
    const api = await createApiContext();

    try {
      const publicPage = await api.get("/inovas");
      expect(publicPage.status()).toBe(200);
      expect(publicPage.headers()["strict-transport-security"]).toContain("max-age=31536000");
      expect(publicPage.headers()["x-content-type-options"]).toBe("nosniff");
      expect(publicPage.headers()["x-frame-options"]).toBe("DENY");
      expect(publicPage.headers()["permissions-policy"]).toContain("camera=()");
      expect(publicPage.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");

      const adminLogin = await api.get("/admin/login.html");
      expect(adminLogin.status()).toBe(200);
      expect(adminLogin.headers()["cache-control"]).toContain("no-store");
      expect(adminLogin.headers()["x-robots-tag"]).toContain("noindex");
      expect(adminLogin.headers()["content-security-policy"]).toContain("object-src 'none'");
    } finally {
      await api.dispose();
    }
  });
});
