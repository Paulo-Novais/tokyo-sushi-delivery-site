import crypto from "node:crypto";
import { createRequire } from "node:module";
import { Pool } from "@neondatabase/serverless";

const require = createRequire(import.meta.url);
const { createPasswordHash } = require("../lib/user-permissions.cjs");

const ownerDatabaseUrl = String(
  process.env.OWNER_DATABASE_URL || ""
).trim();
const previewUrl = String(process.env.INOVAS_PREVIEW_URL || "")
  .trim()
  .replace(/\/+$/, "");
const confirmation = String(
  process.env.INOVAS_PREVIEW_SMOKE_CONFIRM || ""
).trim();
const ownerEndpoint = ownerDatabaseUrl
  ? new URL(ownerDatabaseUrl).hostname
  : "";
const previewHost = previewUrl ? new URL(previewUrl).hostname : "";

if (
  !ownerDatabaseUrl ||
  confirmation !== previewUrl ||
  ownerEndpoint !== "ep-cold-hall-ac13ibhi.sa-east-1.aws.neon.tech" ||
  !previewHost.endsWith(".vercel.app")
) {
  console.error("Authenticated Preview smoke guard rejected the request.");
  process.exit(1);
}

const ownerPool = new Pool({ connectionString: ownerDatabaseUrl });
const systemLogin = `preview-system-smoke-${crypto.randomUUID()}@inovas.invalid`;
const systemPassword = `Sys${crypto.randomBytes(24).toString("base64url")}A1!`;
let restaurantLogin = "";

const identityIdFor = (login) =>
  `identity_${crypto
    .createHash("sha256")
    .update(String(login).trim().toLowerCase())
    .digest("hex")
    .slice(0, 24)}`;

const createCookieJar = () => new Map();

const absorbCookies = (jar, response) => {
  const values =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);

  for (const value of values) {
    const pair = String(value).split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator < 1) {
      continue;
    }
    const name = pair.slice(0, separator);
    const cookieValue = pair.slice(separator + 1);
    if (cookieValue) {
      jar.set(name, cookieValue);
    } else {
      jar.delete(name);
    }
  }
};

const request = async (jar, path, options = {}) => {
  const headers = new Headers(options.headers || {});
  if (jar.size) {
    headers.set(
      "Cookie",
      [...jar].map(([key, value]) => `${key}=${value}`).join("; ")
    );
  }
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${previewUrl}${path}`, {
    ...options,
    headers,
    redirect: "manual",
  });
  absorbCookies(jar, response);
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
};

const getErrorCode = (response) =>
  response.payload?.error?.code ||
  response.payload?.errorCode ||
  "unknown_error";

const requireStatus = (response, expected, label) => {
  if (response.status !== expected) {
    throw new Error(
      `${label} failed (${response.status}:${getErrorCode(response)}).`
    );
  }
};

const retireTechnicalIdentity = async (login) => {
  if (!login) {
    return;
  }
  const identityId = identityIdFor(login);
  const client = await ownerPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
        UPDATE auth_sessions
        SET
          status = 'REVOKED',
          revoked_at = COALESCE(revoked_at, NOW()),
          revoked_by = 'preview_smoke_cleanup'
        WHERE identity_id = $1
      `,
      [identityId]
    );
    await client.query(
      `
        UPDATE system_principals
        SET status = 'BLOCKED', updated_at = NOW()
        WHERE identity_id = $1
      `,
      [identityId]
    );
    await client.query(
      `
        UPDATE restaurant_memberships
        SET status = 'DISABLED', updated_at = NOW()
        WHERE identity_id = $1
      `,
      [identityId]
    );
    await client.query(
      `
        UPDATE identities
        SET credential_status = 'DISABLED', updated_at = NOW()
        WHERE id = $1
      `,
      [identityId]
    );
    await client.query(
      "DELETE FROM admin_users WHERE LOWER(login) = LOWER($1)",
      [login]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

const run = async () => {
  const statuses = {};
  const systemJar = createCookieJar();
  const restaurantJar = createCookieJar();
  let supportActive = false;
  let tenantUserId = "";
  let workflowError = null;

  try {
    await ownerPool.query(
      `
        INSERT INTO admin_users (
          id,
          tenant_id,
          restaurant_id,
          restaurant_key,
          name,
          login,
          email,
          password_hash,
          status,
          user_type,
          credential_mode,
          must_change_password,
          source,
          profile_version,
          created_at,
          updated_at
        )
        VALUES (
          $1, '', '', '', 'Preview System Smoke', $2, $2, $3, 'ACTIVE',
          'DESENVOLVEDOR', 'TEMPORARY_PASSWORD', TRUE, 'managed',
          '2026.07.25', NOW(), NOW()
        )
      `,
      [
        `preview_system_smoke_${crypto.randomUUID()}`,
        systemLogin,
        createPasswordHash(systemPassword),
      ]
    );

    let response = await request(systemJar, "/api/auth/system/login", {
      method: "POST",
      body: JSON.stringify({
        identifier: systemLogin,
        password: systemPassword,
      }),
    });
    statuses.systemLogin = response.status;
    requireStatus(response, 200, "System login");

    response = await request(systemJar, "/api/auth/system/session");
    statuses.systemSession = response.status;
    requireStatus(response, 200, "System session");
    if (response.payload?.data?.session?.audience !== "system") {
      throw new Error("System session returned another audience.");
    }

    response = await request(systemJar, "/api/system/health");
    statuses.systemHealth = response.status;
    requireStatus(response, 200, "System health");

    response = await request(systemJar, "/api/tenant/users");
    statuses.systemTenantDenied = response.status;
    if (![401, 403].includes(response.status)) {
      throw new Error("System session crossed the Restaurant boundary.");
    }

    response = await request(systemJar, "/api/support/start", {
      method: "POST",
      body: JSON.stringify({
        restaurantKey: "default",
        mode: "ADMIN",
        reason: "Smoke autenticado do Preview após publicação.",
        confirmed: true,
      }),
    });
    statuses.supportAdminStart = response.status;
    requireStatus(response, 201, "Support ADMIN start");
    supportActive = true;

    restaurantLogin =
      `preview-restaurant-smoke-${crypto.randomUUID()}@inovas.invalid`;
    response = await request(systemJar, "/api/tenant/users", {
      method: "POST",
      body: JSON.stringify({
        name: "Smoke Preview",
        email: restaurantLogin,
        role: "MANAGER",
        credentialMode: "TEMPORARY_PASSWORD",
        internalNote:
          "Conta técnica temporária do smoke de publicação.",
      }),
    });
    statuses.tenantUserCreate = response.status;
    requireStatus(response, 201, "Tenant user create");
    tenantUserId = response.payload?.data?.user?.id || "";
    const temporaryPassword =
      response.payload?.data?.access?.temporaryPassword || "";
    if (!tenantUserId || !temporaryPassword) {
      throw new Error("Temporary access was not returned exactly once.");
    }

    response = await request(systemJar, "/api/support/revoke", {
      method: "POST",
      body: "{}",
    });
    statuses.supportRevoke = response.status;
    requireStatus(response, 200, "Support revoke");
    supportActive = false;

    response = await request(
      restaurantJar,
      "/api/auth/restaurant/login",
      {
        method: "POST",
        body: JSON.stringify({
          identifier: restaurantLogin,
          password: temporaryPassword,
        }),
      }
    );
    statuses.restaurantLogin = response.status;
    requireStatus(response, 200, "Restaurant login");

    response = await request(
      restaurantJar,
      "/api/auth/restaurant/session"
    );
    statuses.restaurantSession = response.status;
    requireStatus(response, 200, "Restaurant session");
    if (response.payload?.data?.session?.audience !== "restaurant") {
      throw new Error("Restaurant session returned another audience.");
    }

    response = await request(restaurantJar, "/api/tenant/users");
    statuses.restaurantUsers = response.status;
    requireStatus(response, 200, "Restaurant users");

    response = await request(restaurantJar, "/api/system/health");
    statuses.restaurantSystemDenied = response.status;
    if (![401, 403].includes(response.status)) {
      throw new Error("Restaurant session crossed the System boundary.");
    }

    response = await request(systemJar, "/api/support/start", {
      method: "POST",
      body: JSON.stringify({
        restaurantKey: "default",
        mode: "ADMIN",
        reason: "Desativação da conta técnica após smoke do Preview.",
        confirmed: true,
      }),
    });
    requireStatus(response, 201, "Cleanup support start");
    supportActive = true;

    response = await request(
      systemJar,
      `/api/tenant/users/${encodeURIComponent(tenantUserId)}/deactivate`,
      {
        method: "POST",
        body: JSON.stringify({
          reason: "Conta técnica do smoke concluído.",
          revokeSessions: true,
        }),
      }
    );
    statuses.cleanupDeactivate = response.status;
    requireStatus(response, 200, "Cleanup deactivate");

    response = await request(systemJar, "/api/support/revoke", {
      method: "POST",
      body: "{}",
    });
    statuses.cleanupSupportRevoke = response.status;
    requireStatus(response, 200, "Cleanup support revoke");
    supportActive = false;
  } catch (error) {
    workflowError = error;
  } finally {
    if (supportActive) {
      await request(systemJar, "/api/support/revoke", {
        method: "POST",
        body: "{}",
      }).catch(() => {});
    }
    await retireTechnicalIdentity(restaurantLogin).catch(() => {});
    await retireTechnicalIdentity(systemLogin);
    await ownerPool.end();
  }

  if (workflowError) {
    throw workflowError;
  }

  console.log(
    JSON.stringify({
      validated: true,
      statuses,
      temporaryUsersRetired: true,
    })
  );
};

run().catch((error) => {
  console.error(
    JSON.stringify({
      validated: false,
      error: error.message,
    })
  );
  process.exitCode = 1;
});
