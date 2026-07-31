import crypto from "node:crypto";
import { Pool } from "@neondatabase/serverless";

const sanitizeError = (error) =>
  String(error?.message || error || "unknown")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/password=[^\s&]+/gi, "password=[REDACTED]")
    .slice(0, 500);
process.on("uncaughtException", (error) => {
  console.error(`PREVIEW_RLS_VALIDATION_FAILED;message=${sanitizeError(error)}`);
  process.exit(1);
});
process.on("unhandledRejection", (error) => {
  console.error(`PREVIEW_RLS_VALIDATION_FAILED;message=${sanitizeError(error)}`);
  process.exit(1);
});

const ownerDatabaseUrl = String(process.env.OWNER_DATABASE_URL || "").trim();
const runtimeDatabaseUrl = String(process.env.DATABASE_URL || "").trim();
const runtimeRole = String(process.env.INOVAS_RUNTIME_DB_ROLE || "").trim();
const branchId = String(process.env.NEON_BRANCH_ID || "").trim();
const confirmation = String(
  process.env.INOVAS_PREVIEW_MIGRATION_CONFIRM || ""
).trim();
const expectedEndpoint = String(
  process.env.INOVAS_PREVIEW_NEON_ENDPOINT || ""
)
  .trim()
  .toLowerCase();

if (
  !ownerDatabaseUrl ||
  !runtimeDatabaseUrl ||
  !/^[a-z_][a-z0-9_]{2,62}$/.test(runtimeRole) ||
  !branchId ||
  confirmation !== branchId ||
  String(process.env.INOVAS_ENVIRONMENT || "").toLowerCase() !== "preview"
) {
  console.error("Preview RLS test guard rejected the request.");
  process.exit(1);
}

for (const connectionString of [ownerDatabaseUrl, runtimeDatabaseUrl]) {
  const parsed = new URL(connectionString);
  if (
    !expectedEndpoint ||
    !parsed.hostname.toLowerCase().startsWith(expectedEndpoint)
  ) {
    console.error("RLS test endpoint does not match the isolated Preview endpoint.");
    process.exit(1);
  }
}

const withScope = (connectionString, scope) => {
  const parsed = new URL(connectionString);
  const options = [
    `-capp.audience=${scope.audience}`,
    `-capp.login=${scope.login || "__none__"}`,
    `-capp.tenant_id=${scope.tenantId || "__none__"}`,
    `-capp.restaurant_id=${scope.restaurantId || "__none__"}`,
    `-capp.identity_id=${scope.identityId || "__test__"}`,
    `-capp.session_id=${scope.sessionId || "__test__"}`,
    `-capp.support_session_id=${scope.supportSessionId || "__none__"}`,
    `-capp.support_mode=${scope.supportMode || "NONE"}`,
  ];
  parsed.searchParams.set("options", options.join(" "));
  return parsed.toString();
};

const queryWithScope = async (scope, text, values = []) => {
  const pool = new Pool({
    connectionString: withScope(runtimeDatabaseUrl, scope),
  });
  pool.on("error", () => {});
  try {
    return await pool.query(text, values);
  } finally {
    await pool.end();
  }
};

const withScopedClient = async (scope, callback) => {
  const pool = new Pool({
    connectionString: withScope(runtimeDatabaseUrl, scope),
  });
  pool.on("error", () => {});
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
    await pool.end();
  }
};

const ownerPool = new Pool({ connectionString: ownerDatabaseUrl });
ownerPool.on("error", () => {});
const fixtureSuffix = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
const tenantA = {
  tenant_id: `tenant_rls_a_${fixtureSuffix}`,
  restaurant_id: `restaurant_rls_a_${fixtureSuffix}`,
  restaurant_key: `rls-a-${fixtureSuffix}`,
  identity_id: `identity_rls_a_${fixtureSuffix}`,
  membership_id: `membership_rls_a_${fixtureSuffix}`,
  admin_user_id: `admin_rls_a_${fixtureSuffix}`,
  login: `rls-a-${fixtureSuffix}@preview.invalid`,
};
const tenantB = {
  tenant_id: `tenant_rls_b_${fixtureSuffix}`,
  restaurant_id: `restaurant_rls_b_${fixtureSuffix}`,
  restaurant_key: `rls-b-${fixtureSuffix}`,
  identity_id: `identity_rls_b_${fixtureSuffix}`,
  membership_id: `membership_rls_b_${fixtureSuffix}`,
  admin_user_id: `admin_rls_b_${fixtureSuffix}`,
  login: `rls-b-${fixtureSuffix}@preview.invalid`,
};
const systemIdentityId = `identity_rls_system_${fixtureSuffix}`;
const systemPrincipalId = `principal_rls_system_${fixtureSuffix}`;

try {
  const roleResult = await ownerPool.query(`
    SELECT rolsuper, rolbypassrls
    FROM pg_roles
    WHERE rolname = $1
  `, [runtimeRole]);
  const role = roleResult.rows[0];
  if (!role || role.rolsuper || role.rolbypassrls) {
    throw new Error("Runtime role bypasses the intended RLS boundary.");
  }

  const fixtureClient = await ownerPool.connect();
  try {
    await fixtureClient.query("BEGIN");
    await fixtureClient.query(
      `
        INSERT INTO identities (id, email, login, display_name, credential_status)
        VALUES ($1, $2, $2, 'RLS System Fixture', 'ACTIVE')
      `,
      [systemIdentityId, `rls-system-${fixtureSuffix}@preview.invalid`]
    );
    await fixtureClient.query(
      `
        INSERT INTO system_principals (
          id, identity_id, system_role, status, created_by
        )
        VALUES ($1, $2, 'PLATFORM_OWNER', 'ACTIVE', 'rls_validation')
      `,
      [systemPrincipalId, systemIdentityId]
    );
    for (const tenant of [tenantA, tenantB]) {
      await fixtureClient.query(
        `
          INSERT INTO identities (
            id, email, login, display_name, credential_status
          )
          VALUES ($1, $2, $2, 'RLS Tenant Fixture', 'ACTIVE')
        `,
        [tenant.identity_id, tenant.login]
      );
      await fixtureClient.query(
        `
          INSERT INTO restaurant_memberships (
            id, identity_id, tenant_id, restaurant_id, restaurant_key,
            restaurant_role, status, invited_by
          )
          VALUES ($1, $2, $3, $4, $5, 'OWNER', 'ACTIVE', 'rls_validation')
        `,
        [
          tenant.membership_id,
          tenant.identity_id,
          tenant.tenant_id,
          tenant.restaurant_id,
          tenant.restaurant_key,
        ]
      );
      await fixtureClient.query(
        `
          INSERT INTO admin_users (
            id, tenant_id, restaurant_id, restaurant_key, name, login, email,
            password_hash, status, user_type, credential_mode,
            must_change_password, source, profile_version
          )
          VALUES (
            $1, $2, $3, $4, 'RLS Tenant Fixture', $5, $5,
            'disabled-test-hash', 'ACTIVE', 'OWNER', 'TEMPORARY_PASSWORD',
            TRUE, 'managed', '2026.07.31'
          )
        `,
        [
          tenant.admin_user_id,
          tenant.tenant_id,
          tenant.restaurant_id,
          tenant.restaurant_key,
          tenant.login,
        ]
      );
    }
    await fixtureClient.query("COMMIT");
  } catch (error) {
    await fixtureClient.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    fixtureClient.release();
  }
  const tenantMembershipId = tenantA.membership_id;
  const tenantIdentityId = tenantA.identity_id;
  const tenantAdminUserId = tenantA.admin_user_id;
  const tenantAdminUserLogin = tenantA.login;

  const noContext = await queryWithScope(
    { audience: "none" },
    "SELECT count(*)::integer AS count FROM admin_users"
  );
  const systemOperational = await queryWithScope(
    { audience: "system" },
    "SELECT count(*)::integer AS count FROM orders"
  );
  const systemRestaurantUsers = await queryWithScope(
    { audience: "system" },
    "SELECT count(*)::integer AS count FROM admin_users WHERE restaurant_key <> ''"
  );
  const tenantOwn = await queryWithScope(
    {
      audience: "restaurant",
      tenantId: tenantA.tenant_id,
      restaurantId: tenantA.restaurant_id,
    },
    "SELECT count(*)::integer AS count FROM admin_users"
  );
  const tenantCrossRead = await queryWithScope(
    {
      audience: "restaurant",
      tenantId: tenantA.tenant_id,
      restaurantId: tenantA.restaurant_id,
    },
    `
      SELECT count(*)::integer AS count
      FROM admin_users
      WHERE tenant_id = $1 AND restaurant_id = $2
    `,
    [tenantB.tenant_id, tenantB.restaurant_id]
  );
  const tenantCrossWrite = await queryWithScope(
    {
      audience: "restaurant",
      tenantId: tenantA.tenant_id,
      restaurantId: tenantA.restaurant_id,
    },
    `
      UPDATE admin_users
      SET updated_at = updated_at
      WHERE tenant_id = $1 AND restaurant_id = $2
    `,
    [tenantB.tenant_id, tenantB.restaurant_id]
  );
  const publicMasterState = await queryWithScope(
    { audience: "public" },
    "SELECT count(*)::integer AS count FROM master_platform_state"
  );
  const publicRoutes = await queryWithScope(
    { audience: "public" },
    "SELECT count(*)::integer AS count FROM public_restaurant_routes"
  );
  const tenantIdentityVisible = await queryWithScope(
    {
      audience: "restaurant",
      tenantId: tenantA.tenant_id,
      restaurantId: tenantA.restaurant_id,
    },
    "SELECT count(*)::integer AS count FROM identities WHERE id = $1",
    [tenantIdentityId]
  );
  const tenantSystemIdentityHidden = await queryWithScope(
    {
      audience: "restaurant",
      tenantId: tenantA.tenant_id,
      restaurantId: tenantA.restaurant_id,
    },
    "SELECT count(*)::integer AS count FROM identities WHERE id = $1",
    [systemIdentityId]
  );
  const supportViewIdentityWrite = await queryWithScope(
    {
      audience: "support",
      tenantId: tenantA.tenant_id,
      restaurantId: tenantA.restaurant_id,
      supportMode: "VIEW",
    },
    "UPDATE identities SET updated_at = updated_at WHERE id = $1",
    [tenantIdentityId]
  );
  const authenticationOwnUser = await queryWithScope(
    {
      audience: "authentication",
      login: tenantAdminUserLogin,
      identityId: tenantIdentityId,
    },
    "SELECT count(*)::integer AS count FROM admin_users"
  );
  const authenticationOtherUser = await queryWithScope(
    {
      audience: "authentication",
      login: `missing-${crypto.randomUUID()}@preview.invalid`,
    },
    "SELECT count(*)::integer AS count FROM admin_users"
  );
  const authenticationWrite = await queryWithScope(
    {
      audience: "authentication",
      login: tenantAdminUserLogin,
      identityId: tenantIdentityId,
    },
    "UPDATE admin_users SET updated_at = updated_at WHERE id = $1",
    [tenantAdminUserId]
  );
  const supportViewUsers = await queryWithScope(
    {
      audience: "support",
      tenantId: tenantA.tenant_id,
      restaurantId: tenantA.restaurant_id,
      supportMode: "VIEW",
    },
    "SELECT count(*)::integer AS count FROM admin_users"
  );
  const supportViewUserWrite = await queryWithScope(
    {
      audience: "support",
      tenantId: tenantA.tenant_id,
      restaurantId: tenantA.restaurant_id,
      supportMode: "VIEW",
    },
    "UPDATE admin_users SET updated_at = updated_at WHERE id = $1",
    [tenantAdminUserId]
  );
  const supportViewMembershipWrite = await queryWithScope(
    {
      audience: "support",
      tenantId: tenantA.tenant_id,
      restaurantId: tenantA.restaurant_id,
      supportMode: "VIEW",
    },
    "UPDATE restaurant_memberships SET updated_at = updated_at WHERE id = $1",
    [tenantMembershipId]
  );
  const supportAdminMembershipWrite = await withScopedClient(
    {
      audience: "support",
      tenantId: tenantA.tenant_id,
      restaurantId: tenantA.restaurant_id,
      supportMode: "ADMIN",
    },
    async (client) => {
      await client.query("BEGIN");
      try {
        return await client.query(
          "UPDATE restaurant_memberships SET updated_at = updated_at WHERE id = $1",
          [tenantMembershipId]
        );
      } finally {
        await client.query("ROLLBACK");
      }
    }
  );
  const supportAdminIdentityWrite = await withScopedClient(
    {
      audience: "support",
      tenantId: tenantA.tenant_id,
      restaurantId: tenantA.restaurant_id,
      supportMode: "ADMIN",
    },
    async (client) => {
      await client.query("BEGIN");
      try {
        return await client.query(
          "UPDATE identities SET updated_at = updated_at WHERE id = $1",
          [tenantIdentityId]
        );
      } finally {
        await client.query("ROLLBACK");
      }
    }
  );
  const temporaryIdentityProvisioned = await withScopedClient(
    {
      audience: "restaurant",
      tenantId: tenantA.tenant_id,
      restaurantId: tenantA.restaurant_id,
      identityId: tenantIdentityId,
    },
    async (client) => {
      const suffix = crypto.randomUUID();
      const identityId = `identity_rls_${suffix}`;
      const membershipId = `membership_rls_${suffix}`;
      const email = `rls-${suffix}@preview.invalid`;
      await client.query("BEGIN");
      try {
        await client.query(
          `
            INSERT INTO identities (
              id, email, login, display_name, credential_status
            )
            VALUES ($1, $2, $2, 'RLS validation', 'ACTIVE')
          `,
          [identityId, email]
        );
        await client.query(
          `
            INSERT INTO restaurant_memberships (
              id,
              identity_id,
              tenant_id,
              restaurant_id,
              restaurant_key,
              restaurant_role,
              status
            )
            VALUES ($1, $2, $3, $4, $5, 'CASHIER', 'ACTIVE')
          `,
          [
            membershipId,
            identityId,
            tenantA.tenant_id,
            tenantA.restaurant_id,
            tenantA.restaurant_key,
          ]
        );
        const visible = await client.query(
          "SELECT count(*)::integer AS count FROM identities WHERE id = $1",
          [identityId]
        );
        return visible.rows[0].count === 1;
      } finally {
        await client.query("ROLLBACK");
      }
    }
  );
  const supportAdminIdentityProvisioned = await withScopedClient(
    {
      audience: "support",
      tenantId: tenantA.tenant_id,
      restaurantId: tenantA.restaurant_id,
      supportMode: "ADMIN",
    },
    async (client) => {
      const suffix = crypto.randomUUID();
      const identityId = `identity_support_rls_${suffix}`;
      const membershipId = `membership_support_rls_${suffix}`;
      const email = `support-rls-${suffix}@preview.invalid`;
      await client.query("BEGIN");
      try {
        await client.query(
          `
            INSERT INTO identities (
              id, email, login, display_name, credential_status
            )
            VALUES ($1, $2, $2, 'Support RLS validation', 'ACTIVE')
          `,
          [identityId, email]
        );
        await client.query(
          `
            INSERT INTO restaurant_memberships (
              id,
              identity_id,
              tenant_id,
              restaurant_id,
              restaurant_key,
              restaurant_role,
              status
            )
            VALUES ($1, $2, $3, $4, $5, 'MANAGER', 'ACTIVE')
          `,
          [
            membershipId,
            identityId,
            tenantA.tenant_id,
            tenantA.restaurant_id,
            tenantA.restaurant_key,
          ]
        );
        const updated = await client.query(
          `
            UPDATE identities
            SET display_name = 'Support RLS validation linked'
            WHERE id = $1
          `,
          [identityId]
        );
        const visible = await client.query(
          "SELECT count(*)::integer AS count FROM identities WHERE id = $1",
          [identityId]
        );
        return updated.rowCount === 1 && visible.rows[0].count === 1;
      } finally {
        await client.query("ROLLBACK");
      }
    }
  );

  const assertions = {
    noContextDenied: noContext.rows[0].count === 0,
    systemOperationalDenied: systemOperational.rows[0].count === 0,
    systemRestaurantUsersDenied: systemRestaurantUsers.rows[0].count === 0,
    tenantOwnVisible: tenantOwn.rows[0].count > 0,
    tenantCrossReadDenied: tenantCrossRead.rows[0].count === 0,
    tenantCrossWriteDenied: tenantCrossWrite.rowCount === 0,
    publicMasterStateDenied: publicMasterState.rows[0].count === 0,
    publicRouteProjectionVisible: publicRoutes.rows[0].count > 0,
    tenantIdentityVisible: tenantIdentityVisible.rows[0].count === 1,
    tenantSystemIdentityHidden:
      tenantSystemIdentityHidden.rows[0].count === 0,
    authenticationOwnUserVisible:
      authenticationOwnUser.rows[0].count === 1,
    authenticationOtherUsersDenied:
      authenticationOtherUser.rows[0].count === 0,
    authenticationWriteDenied: authenticationWrite.rowCount === 0,
    supportViewIdentityWriteDenied: supportViewIdentityWrite.rowCount === 0,
    supportViewUsersDenied: supportViewUsers.rows[0].count === 0,
    supportViewUserWriteDenied: supportViewUserWrite.rowCount === 0,
    supportViewMembershipWriteDenied:
      supportViewMembershipWrite.rowCount === 0,
    supportAdminIdentityWriteAllowed:
      supportAdminIdentityWrite.rowCount === 1,
    supportAdminMembershipWriteAllowed:
      supportAdminMembershipWrite.rowCount === 1,
    tenantIdentityProvisioningAllowed: temporaryIdentityProvisioned,
    supportAdminIdentityProvisioningAllowed:
      supportAdminIdentityProvisioned,
  };
  const failed = Object.entries(assertions)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  console.log(
    JSON.stringify({
      validated: failed.length === 0,
      branchId,
      assertions,
      testedDistinctTenantScopes: 2,
    })
  );

  if (failed.length) {
    throw new Error(`RLS assertions failed: ${failed.join(", ")}`);
  }
} finally {
  const cleanupClient = await ownerPool.connect();
  try {
    await cleanupClient.query("BEGIN");
    await cleanupClient.query(
      "DELETE FROM admin_users WHERE id = ANY($1::text[])",
      [[tenantA.admin_user_id, tenantB.admin_user_id]]
    );
    await cleanupClient.query(
      "DELETE FROM system_principals WHERE id = $1",
      [systemPrincipalId]
    );
    await cleanupClient.query(
      "DELETE FROM restaurant_memberships WHERE id = ANY($1::text[])",
      [[tenantA.membership_id, tenantB.membership_id]]
    );
    await cleanupClient.query(
      "DELETE FROM identities WHERE id = ANY($1::text[])",
      [[systemIdentityId, tenantA.identity_id, tenantB.identity_id]]
    );
    await cleanupClient.query("COMMIT");
  } catch (error) {
    await cleanupClient.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    cleanupClient.release();
  }
  await ownerPool.end();
}
