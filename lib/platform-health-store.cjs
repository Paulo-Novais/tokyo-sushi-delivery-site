const fs = require("node:fs/promises");
const path = require("node:path");
const { neon } = require("./tenant-sql.cjs");
const {
  getMasterPlatformSnapshot,
} = require("./master-platform-store.cjs");

const LOCAL_STORAGE_FILE = path.join(
  process.cwd(),
  ".data",
  "platform-health.json"
);
let sqlClient = null;

const getStorageMode = () => {
  if (String(process.env.DATABASE_URL || "").trim()) {
    return "neon";
  }
  return process.env.NODE_ENV === "production" ? "disabled" : "file";
};

const getSql = () => {
  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }
  return sqlClient;
};

const normalizeStatus = (value) =>
  String(value || "").trim().toUpperCase();

const buildHealthScore = ({ restaurant, domain }) => {
  const status = normalizeStatus(restaurant.status);
  const active = ["ACTIVE", "ATIVO", "CLIENTE_MODELO", "PILOT", "TRIAL"].includes(
    status
  );
  const domainHealthy =
    !domain ||
    domain.isSimulation === true ||
    (domain.dnsIntegrated === true && domain.sslIntegrated === true);
  const integrations = Array.isArray(restaurant.integrations)
    ? restaurant.integrations
    : [];
  const failedIntegrations = integrations.filter(
    (integration) =>
      ["ERROR", "FAILED", "DEGRADED"].includes(
        normalizeStatus(integration.status)
      )
  ).length;
  const score = Math.max(
    0,
    Math.min(
      100,
      (active ? 60 : 10) +
        (domainHealthy ? 25 : 5) +
        (failedIntegrations ? 0 : 15)
    )
  );

  return {
    tenantId: restaurant.tenantId,
    restaurantId: restaurant.restaurantId,
    restaurantKey: restaurant.restaurantKey,
    restaurantName: restaurant.name,
    status:
      !active || score < 40 ? "OFFLINE" : score < 80 ? "DEGRADED" : "ONLINE",
    score,
    lastHeartbeatAt:
      restaurant.lastHeartbeatAt ||
      restaurant.heartbeatAt ||
      restaurant.updatedAt ||
      "",
    version: restaurant.version || "",
    domainStatus: domainHealthy ? "HEALTHY" : "DEGRADED",
    failedIntegrations,
    pendingJobs: Number(restaurant.pendingJobs || 0),
    criticalErrors: Number(restaurant.criticalErrors || 0),
    backupStatus: restaurant.backupStatus || "UNKNOWN",
  };
};

const persistHealthSnapshot = async (summary, tenantHealth) => {
  const mode = getStorageMode();
  const generatedAt = new Date().toISOString();

  if (mode === "disabled") {
    return;
  }

  if (mode === "file") {
    await fs.mkdir(path.dirname(LOCAL_STORAGE_FILE), { recursive: true });
    await fs.writeFile(
      LOCAL_STORAGE_FILE,
      `${JSON.stringify({ generatedAt, summary, tenantHealth }, null, 2)}\n`,
      "utf8"
    );
    return;
  }

  const sql = getSql();
  await sql`
    INSERT INTO platform_health_snapshots (
      id,
      captured_at,
      status,
      active_restaurants,
      suspended_restaurants,
      degraded_restaurants,
      integration_failures,
      critical_alerts,
      metrics_json
    )
    VALUES (
      ${`health_${Date.now()}`},
      ${generatedAt},
      ${summary.status},
      ${summary.activeRestaurants},
      ${summary.suspendedRestaurants},
      ${summary.degradedRestaurants},
      ${summary.integrationFailures},
      ${summary.criticalAlerts},
      ${JSON.stringify(summary)}::jsonb
    )
  `;

  for (const health of tenantHealth) {
    await sql`
      INSERT INTO tenant_health_scores (
        tenant_id,
        restaurant_id,
        restaurant_key,
        health_status,
        health_score,
        last_heartbeat_at,
        domain_status,
        failed_integrations,
        pending_jobs,
        critical_errors,
        backup_status,
        version,
        captured_at
      )
      VALUES (
        ${health.tenantId},
        ${health.restaurantId},
        ${health.restaurantKey},
        ${health.status},
        ${health.score},
        ${health.lastHeartbeatAt || null},
        ${health.domainStatus},
        ${health.failedIntegrations},
        ${health.pendingJobs},
        ${health.criticalErrors},
        ${health.backupStatus},
        ${health.version},
        ${generatedAt}
      )
      ON CONFLICT (tenant_id, restaurant_id) DO UPDATE SET
        restaurant_key = EXCLUDED.restaurant_key,
        health_status = EXCLUDED.health_status,
        health_score = EXCLUDED.health_score,
        last_heartbeat_at = EXCLUDED.last_heartbeat_at,
        domain_status = EXCLUDED.domain_status,
        failed_integrations = EXCLUDED.failed_integrations,
        pending_jobs = EXCLUDED.pending_jobs,
        critical_errors = EXCLUDED.critical_errors,
        backup_status = EXCLUDED.backup_status,
        version = EXCLUDED.version,
        captured_at = EXCLUDED.captured_at
    `;
  }
};

const getPlatformHealthSnapshot = async ({ persist = true } = {}) => {
  const platform = await getMasterPlatformSnapshot({
    metrics: {},
    usersPayload: {
      users: [],
    },
  });
  const restaurants = Array.isArray(platform.restaurants)
    ? platform.restaurants
    : [];
  const domains = Array.isArray(platform.domains) ? platform.domains : [];
  const tenantHealth = restaurants.map((restaurant) =>
    buildHealthScore({
      restaurant,
      domain:
        domains.find(
          (domain) => domain.restaurantKey === restaurant.restaurantKey
        ) || null,
    })
  );
  const activeRestaurants = tenantHealth.filter(
    (health) => health.status !== "OFFLINE"
  ).length;
  const suspendedRestaurants = restaurants.filter((restaurant) =>
    ["SUSPENDED", "INACTIVE", "BLOCKED"].includes(
      normalizeStatus(restaurant.status)
    )
  ).length;
  const degradedRestaurants = tenantHealth.filter(
    (health) => health.status === "DEGRADED"
  ).length;
  const integrationFailures = tenantHealth.reduce(
    (total, health) => total + health.failedIntegrations,
    0
  );
  const criticalAlerts = tenantHealth.reduce(
    (total, health) => total + health.criticalErrors,
    0
  );
  const summary = {
    status:
      criticalAlerts > 0 || suspendedRestaurants > 0
        ? "DEGRADED"
        : "HEALTHY",
    totalRestaurants: restaurants.length,
    activeRestaurants,
    suspendedRestaurants,
    degradedRestaurants,
    integrationFailures,
    criticalAlerts,
    generatedAt: new Date().toISOString(),
  };

  if (persist) {
    await persistHealthSnapshot(summary, tenantHealth);
  }

  return {
    summary,
    tenantHealth,
  };
};

module.exports = {
  getPlatformHealthSnapshot,
};
