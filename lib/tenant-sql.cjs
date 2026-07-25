const { AsyncLocalStorage } = require("node:async_hooks");
const { neon: createNeonClient } = require("@neondatabase/serverless");

const databaseScopeStorage = new AsyncLocalStorage();
const clientCache = new Map();
const ALLOWED_AUDIENCES = new Set([
  "none",
  "public",
  "restaurant",
  "support",
  "system",
  "provisioning",
  "migration",
]);
const ALLOWED_SUPPORT_MODES = new Set(["NONE", "VIEW", "ADMIN"]);

const normalizeSetting = (value, maxLength = 160) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_.:@-]+/g, "_")
    .slice(0, maxLength);

const normalizeDatabaseScope = (scope = {}) => {
  const audience = String(scope.audience || "none").trim().toLowerCase();
  const supportMode = String(scope.supportMode || "NONE").trim().toUpperCase();

  return Object.freeze({
    audience: ALLOWED_AUDIENCES.has(audience) ? audience : "none",
    tenantId: normalizeSetting(scope.tenantId),
    restaurantId: normalizeSetting(scope.restaurantId),
    restaurantKey: normalizeSetting(scope.restaurantKey),
    identityId: normalizeSetting(scope.identityId),
    sessionId: normalizeSetting(scope.sessionId),
    supportSessionId: normalizeSetting(scope.supportSessionId),
    supportMode: ALLOWED_SUPPORT_MODES.has(supportMode) ? supportMode : "NONE",
  });
};

const getDatabaseScope = () =>
  databaseScopeStorage.getStore() || normalizeDatabaseScope();

const runWithDatabaseScope = (scope, callback) =>
  databaseScopeStorage.run(normalizeDatabaseScope(scope), callback);

const enterDatabaseScope = (scope) => {
  const normalizedScope = normalizeDatabaseScope(scope);
  databaseScopeStorage.enterWith(normalizedScope);
  return normalizedScope;
};

const buildScopedDatabaseUrl = (databaseUrl, scope = getDatabaseScope()) => {
  const parsed = new URL(String(databaseUrl || ""));
  const normalizedScope = normalizeDatabaseScope(scope);
  const options = [
    `-capp.audience=${normalizedScope.audience}`,
    `-capp.tenant_id=${normalizedScope.tenantId || "__none__"}`,
    `-capp.restaurant_id=${normalizedScope.restaurantId || "__none__"}`,
    `-capp.identity_id=${normalizedScope.identityId || "__anonymous__"}`,
    `-capp.session_id=${normalizedScope.sessionId || "__none__"}`,
    `-capp.support_session_id=${normalizedScope.supportSessionId || "__none__"}`,
    `-capp.support_mode=${normalizedScope.supportMode}`,
  ];
  parsed.searchParams.set("options", options.join(" "));
  parsed.searchParams.set(
    "application_name",
    `inovas_${normalizedScope.audience}`.slice(0, 60)
  );
  return parsed.toString();
};

const getScopedClient = (databaseUrl, options) => {
  const scope = getDatabaseScope();
  const scopedUrl = buildScopedDatabaseUrl(databaseUrl, scope);
  const cacheKey = `${scopedUrl}\n${JSON.stringify(options || {})}`;

  if (!clientCache.has(cacheKey)) {
    clientCache.set(cacheKey, createNeonClient(scopedUrl, options));
  }

  return clientCache.get(cacheKey);
};

const neon = (databaseUrl, options) => {
  const dynamicTag = (...args) =>
    getScopedClient(databaseUrl, options)(...args);

  return new Proxy(dynamicTag, {
    get(target, property, receiver) {
      if (Reflect.has(target, property)) {
        return Reflect.get(target, property, receiver);
      }

      const client = getScopedClient(databaseUrl, options);
      const value = client[property];
      return typeof value === "function" ? value.bind(client) : value;
    },
  });
};

const clearTenantSqlClientCache = () => clientCache.clear();

module.exports = {
  buildScopedDatabaseUrl,
  clearTenantSqlClientCache,
  enterDatabaseScope,
  getDatabaseScope,
  neon,
  normalizeDatabaseScope,
  runWithDatabaseScope,
};
