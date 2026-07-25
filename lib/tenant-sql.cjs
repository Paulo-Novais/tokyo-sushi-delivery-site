const { AsyncLocalStorage } = require("node:async_hooks");
const { neon: createNeonClient } = require("@neondatabase/serverless");

const databaseScopeStorage = new AsyncLocalStorage();
const clientCache = new Map();
const QUERY_DESCRIPTOR = Symbol("inovas.scoped-query");
const ALLOWED_AUDIENCES = new Set([
  "none",
  "authentication",
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

const normalizeLogin = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\u0000-\u001f\u007f\s]+/g, "")
    .slice(0, 320);

const normalizeDatabaseScope = (scope = {}) => {
  const audience = String(scope.audience || "none").trim().toLowerCase();
  const supportMode = String(scope.supportMode || "NONE").trim().toUpperCase();

  return Object.freeze({
    audience: ALLOWED_AUDIENCES.has(audience) ? audience : "none",
    login: normalizeLogin(scope.login),
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
    `-capp.login=${normalizedScope.login || "__none__"}`,
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

const getClient = (databaseUrl, options) => {
  const cacheKey = `${databaseUrl}\n${JSON.stringify(options || {})}`;

  if (!clientCache.has(cacheKey)) {
    clientCache.set(cacheKey, createNeonClient(databaseUrl, options));
  }

  return clientCache.get(cacheKey);
};

const buildScopeQuery = (client, scope) => client`
  SELECT
    set_config('app.audience', ${scope.audience}, true),
    set_config('app.login', ${scope.login || "__none__"}, true),
    set_config('app.tenant_id', ${scope.tenantId || "__none__"}, true),
    set_config('app.restaurant_id', ${scope.restaurantId || "__none__"}, true),
    set_config('app.identity_id', ${scope.identityId || "__anonymous__"}, true),
    set_config('app.session_id', ${scope.sessionId || "__none__"}, true),
    set_config(
      'app.support_session_id',
      ${scope.supportSessionId || "__none__"},
      true
    ),
    set_config('app.support_mode', ${scope.supportMode}, true)
`;

const executeScopedQueries = async (
  databaseUrl,
  options,
  scope,
  queryArguments,
  transactionOptions
) => {
  const client = getClient(databaseUrl, options);
  const queries = [
    buildScopeQuery(client, normalizeDatabaseScope(scope)),
    ...queryArguments.map((args) => client(...args)),
  ];
  const results = transactionOptions
    ? await client.transaction(queries, transactionOptions)
    : await client.transaction(queries);

  return results.slice(1);
};

const createQueryDescriptor = (databaseUrl, options, scope, args) => {
  let executionPromise = null;
  const execute = () => {
    if (!executionPromise) {
      executionPromise = executeScopedQueries(
        databaseUrl,
        options,
        scope,
        [args]
      ).then(([result]) => result);
    }
    return executionPromise;
  };

  return {
    [QUERY_DESCRIPTOR]: true,
    databaseUrl,
    options,
    scope,
    args,
    then(onFulfilled, onRejected) {
      return execute().then(onFulfilled, onRejected);
    },
    catch(onRejected) {
      return execute().catch(onRejected);
    },
    finally(onFinally) {
      return execute().finally(onFinally);
    },
    get [Symbol.toStringTag]() {
      return "Promise";
    },
  };
};

const neon = (databaseUrl, options) => {
  const dynamicTag = (...args) =>
    createQueryDescriptor(
      databaseUrl,
      options,
      getDatabaseScope(),
      args
    );

  dynamicTag.transaction = async (queries, transactionOptions) => {
    if (!Array.isArray(queries) || !queries.length) {
      throw new TypeError("Scoped transaction requires at least one query.");
    }

    const descriptors = queries.map((query) => {
      if (
        !query?.[QUERY_DESCRIPTOR] ||
        query.databaseUrl !== databaseUrl ||
        query.options !== options
      ) {
        throw new TypeError(
          "Scoped transaction received a query from another SQL client."
        );
      }
      return query;
    });
    const scope = descriptors[0].scope;

    if (
      descriptors.some(
        (descriptor) =>
          JSON.stringify(descriptor.scope) !== JSON.stringify(scope)
      )
    ) {
      throw new TypeError(
        "Scoped transaction cannot combine different security contexts."
      );
    }

    return executeScopedQueries(
      databaseUrl,
      options,
      scope,
      descriptors.map((descriptor) => descriptor.args),
      transactionOptions
    );
  };

  return dynamicTag;
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
