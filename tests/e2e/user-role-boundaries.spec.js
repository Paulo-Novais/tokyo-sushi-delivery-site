// RBAC boundaries for user management: MASTER, SOCIO, OWNER, GERENTE (MANAGER)
// and a common restaurant user (CAIXA / CASHIER). Uses the real domain APIs
// (/api/system/*, /api/tenant/*) and the legacy admin UI path
// (/api/admin/users/save). Every escalation or cross-tenant attempt must fail.
const { test, expect } = require("@playwright/test");
const {
  createApiContext,
  loginAdmin,
  loginMaster,
  loginTenantOwner,
  onboardRestaurant,
  uniqueKey,
} = require("./helpers/v1.9-fixtures.cjs");

test.describe.configure({ mode: "serial" });

const baseURL =
  process.env.BASE_URL || process.env.VALIDATION_BASE_URL || "http://127.0.0.1:3000";

const loginWith = async (identifier, password) => {
  const api = await createApiContext({ origin: baseURL });
  const session = await loginAdmin(api, { identifier, password });
  expect(session.response.status(), `login ${identifier}`).toBe(200);
  return { api, ...session };
};

const createTenantUser = async (ownerApi, { role, label }) => {
  const email = `${label}-${uniqueKey("role")}@local.test`;
  const response = await ownerApi.post("/api/tenant/users", {
    data: {
      name: `${role} boundary`,
      email,
      phone: "(11) 97777-1100",
      role,
      credentialMode: "TEMPORARY_PASSWORD",
    },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body, email, password: body?.data?.access?.temporaryPassword };
};

test.describe("RBAC de gestão de usuários por perfil", () => {
  test("MASTER cria SOCIO; SOCIO não sobe na hierarquia nem acessa o tenant", async () => {
    const master = await loginMaster();
    const email = `socio-${uniqueKey("role")}@inovas.local`;
    let socio;
    try {
      const created = await master.api.post("/api/system/users", {
        data: { name: "Sócio boundary", email, role: "SOCIO", credentialMode: "TEMPORARY_PASSWORD" },
      });
      expect(created.status()).toBe(201);
      const body = await created.json();
      expect(body.data.user.role).toBe("SOCIO");
      expect(body.data.user.tenantId).toBeUndefined();

      socio = await loginWith(email, body.data.access.temporaryPassword);

      const createMaster = await socio.api.post("/api/system/users", {
        data: { name: "Escalada", email: `novo-master-${uniqueKey("x")}@inovas.local`, role: "MASTER", credentialMode: "INVITE" },
      });
      expect([401, 403]).toContain(createMaster.status());

      const tenantAccess = await socio.api.get("/api/tenant/users");
      expect([401, 403]).toContain(tenantAccess.status());
    } finally {
      await socio?.api.dispose();
      await master.api.dispose();
    }
  });

  test("OWNER cria GERENTE e CAIXA no próprio tenant; GERENTE e CAIXA respeitam suas fronteiras", async () => {
    const master = await loginMaster();
    const restaurantA = await onboardRestaurant(master.api, { key: uniqueKey("roles-a"), ownerPassword: "OwnerRolesA123!" });
    const restaurantB = await onboardRestaurant(master.api, { key: uniqueKey("roles-b"), ownerPassword: "OwnerRolesB123!" });
    const ownerA = await loginTenantOwner(restaurantA);
    const ownerB = await loginTenantOwner(restaurantB);
    let manager;
    let cashier;

    try {
      // --- OWNER: criação legítima, vínculo ao tenant da sessão
      const gerente = await createTenantUser(ownerA.api, { role: "MANAGER", label: "gerente" });
      expect(gerente.response.status(), JSON.stringify(gerente.body?.error || "")).toBe(201);
      expect(gerente.body.data.user.role).toBe("MANAGER");
      expect(gerente.body.data.user.restaurantKey ?? restaurantA.key).toBe(restaurantA.key);

      const caixa = await createTenantUser(ownerA.api, { role: "CASHIER", label: "caixa" });
      expect(caixa.response.status()).toBe(201);

      // --- OWNER: escaladas negadas
      const ownerCreatesOwner = await createTenantUser(ownerA.api, { role: "OWNER", label: "owner2" });
      expect(ownerCreatesOwner.response.status(), "OWNER não deve criar outro OWNER").not.toBe(201);
      const ownerCreatesMaster = await createTenantUser(ownerA.api, { role: "MASTER", label: "master" });
      expect([400, 403, 422]).toContain(ownerCreatesMaster.response.status());

      // --- GERENTE
      manager = await loginWith(gerente.email, gerente.password);
      const managerSession = await (await manager.api.get("/api/tenant/session")).json();
      expect(managerSession.data.session.restaurantKey).toBe(restaurantA.key);
      expect(managerSession.data.session.effectivePermissions.every((p) => p.startsWith("tenant."))).toBe(true);
      expect(managerSession.data.session.effectivePermissions).not.toContain("tenant.users.create");

      const managerCreates = await createTenantUser(manager.api, { role: "CASHIER", label: "pelo-gerente" });
      expect([401, 403]).toContain(managerCreates.response.status());

      const managerList = await manager.api.get("/api/tenant/users");
      expect(managerList.status()).toBe(200);
      const listed = await managerList.json();
      expect(JSON.stringify(listed)).not.toContain(restaurantB.ownerLogin);
      const self = listed.data.users.find((user) => user.email === gerente.email);
      expect(self).toBeTruthy();

      const promoteSelf = await manager.api.patch(`/api/tenant/users/${encodeURIComponent(self.id)}`, {
        data: { name: self.name || "Gerente", email: gerente.email, role: "OWNER" },
      });
      expect([401, 403]).toContain(promoteSelf.status());

      const managerSystem = await manager.api.get("/api/system/health");
      expect([401, 403]).toContain(managerSystem.status());

      // --- CAIXA (usuário comum)
      cashier = await loginWith(caixa.email, caixa.password);
      const cashierList = await cashier.api.get("/api/tenant/users");
      expect([401, 403]).toContain(cashierList.status());
      const cashierCreates = await createTenantUser(cashier.api, { role: "CASHIER", label: "pelo-caixa" });
      expect([401, 403]).toContain(cashierCreates.response.status());
    } finally {
      await cashier?.api.dispose();
      await manager?.api.dispose();
      await ownerA.api.dispose();
      await ownerB.api.dispose();
      await master.api.dispose();
    }
  });

  test("caminho legado da interface exige escopo explícito e bloqueia escalada", async () => {
    const master = await loginMaster();
    const restaurant = await onboardRestaurant(master.api, { key: uniqueKey("roles-legacy"), ownerPassword: "OwnerLegacy123!" });
    const owner = await loginTenantOwner(restaurant);
    const save = (user) => owner.api.post("/api/admin/users/save", { data: { user } });
    const base = (login) => ({
      login, email: login, name: "Gerente legado", password: "GerenteLegado123", phone: "5511999990000",
      status: "ACTIVE", userType: "GERENTE", restaurantKey: restaurant.key,
    });

    try {
      const withScope = await save({ ...base(`gerente-legacy-${uniqueKey("l")}@local.test`), userScope: "RESTAURANT" });
      expect(withScope.status()).toBe(200);
      const created = (await withScope.json()).user;
      expect(created.userScope).toBe("RESTAURANT");
      expect(created.platformScope).not.toBe(true);
      expect(created.restaurantKey).toBe(restaurant.key);

      const withoutScope = await save(base(`sem-escopo-${uniqueKey("l")}@local.test`));
      expect(withoutScope.status()).toBe(422);
      expect((await withoutScope.json()).errorCode).toBe("identity_scope_required");

      const escalation = await save({
        ...base(`escalada-${uniqueKey("l")}@local.test`), userType: "MASTER", userScope: "SYSTEM", restaurantKey: "",
      });
      expect([400, 403]).toContain(escalation.status());

      const otherTenant = await save({
        ...base(`outro-${uniqueKey("l")}@local.test`), userScope: "RESTAURANT", restaurantKey: "restaurante-alheio",
      });
      if (otherTenant.status() === 200) {
        expect((await otherTenant.json()).user.restaurantKey).toBe(restaurant.key);
      } else {
        expect([400, 403, 404]).toContain(otherTenant.status());
      }
    } finally {
      await owner.api.dispose();
      await master.api.dispose();
    }
  });
});
