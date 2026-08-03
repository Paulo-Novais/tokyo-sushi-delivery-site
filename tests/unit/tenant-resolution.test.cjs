const assert = require("node:assert/strict");
const test = require("node:test");

const masterPlatformStore = require("../../lib/master-platform-store.cjs");
const domainTopology = require("../../lib/domain-topology.cjs");
const tenantResolution = require("../../lib/tenant-resolution.cjs");

const originalLookup = masterPlatformStore.findPublicRestaurantRoute;
const originalEnvironment = {
  INOVAS_TENANT_MODE: process.env.INOVAS_TENANT_MODE,
  NODE_ENV: process.env.NODE_ENV,
  VERCEL: process.env.VERCEL,
  PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
  INOVAS_PUBLIC_APP_URL: process.env.INOVAS_PUBLIC_APP_URL,
  INOVAS_PLATFORM_HOSTS: process.env.INOVAS_PLATFORM_HOSTS,
};

const routes = [
  {
    tenant_id: "tenant_default",
    restaurant_id: "restaurant_default",
    restaurant_key: "default",
    restaurant_name: "Tokyo Sushi",
    slug: "tokyo-sushi",
    domain_host: "tokyosushidelivery.com.br",
    status: "ACTIVE",
    domain_status: "ACTIVE",
  },
  {
    tenant_id: "tenant_pilot_a",
    restaurant_id: "restaurant_pilot_a",
    restaurant_key: "pilot-a",
    restaurant_name: "Piloto A",
    slug: "pilot-a",
    domain_host: "pilot-a.localhost",
    status: "PILOT",
    domain_status: "ACTIVE",
  },
  {
    tenant_id: "tenant_pending",
    restaurant_id: "restaurant_pending",
    restaurant_key: "pending",
    restaurant_name: "Pendente",
    slug: "pending",
    domain_host: "pending.example",
    status: "PILOT",
    domain_status: "PENDING_VERIFICATION",
  },
  {
    tenant_id: "tenant_inactive",
    restaurant_id: "restaurant_inactive",
    restaurant_key: "inactive",
    restaurant_name: "Inativo",
    slug: "inactive",
    domain_host: "inactive.example",
    status: "INACTIVE",
    domain_status: "ACTIVE",
  },
];

const installRouteRepository = (lookup = null) => {
  masterPlatformStore.findPublicRestaurantRoute = async (selector = {}) => {
    if (lookup) {
      return lookup(selector);
    }

    return routes.find((route) =>
      selector.restaurantKey
        ? route.restaurant_key === selector.restaurantKey
        : selector.slug
          ? route.slug === selector.slug
          : route.domain_host === tenantResolution.normalizeTenantHost(selector.host)
    ) || null;
  };
};

const request = ({ host, cookie = "", url = "/api/catalog" } = {}) => ({
  url: `https://${host}${url}`,
  headers: {
    host,
    ...(cookie ? { cookie } : {}),
  },
});

test.beforeEach(() => {
  process.env.NODE_ENV = "development";
  process.env.INOVAS_TENANT_MODE = "pilot";
  delete process.env.VERCEL;
  delete process.env.PUBLIC_APP_URL;
  delete process.env.INOVAS_PUBLIC_APP_URL;
  delete process.env.INOVAS_PLATFORM_HOSTS;
  installRouteRepository();
});

test.after(() => {
  masterPlatformStore.findPublicRestaurantRoute = originalLookup;
  Object.entries(originalEnvironment).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });
});

test("resolves exact domains, www aliases and registered subdomains", async () => {
  const exact = await tenantResolution.resolveRestaurantByHost("pilot-a.localhost");
  const alias = await tenantResolution.resolveRestaurantByHost("www.pilot-a.localhost");

  assert.equal(exact.restaurantKey, "pilot-a");
  assert.equal(alias.restaurantKey, "pilot-a");
  assert.equal(exact.hostKind, tenantResolution.HOST_KINDS.CUSTOM_DOMAIN);
  assert.equal(exact.cachePolicy, "request_only");
});

test("classifies the canonical platform, its alias, Preview, localhost and restaurant hosts", () => {
  assert.equal(domainTopology.getPlatformUrl(), "https://inovasfood.com.br");
  assert.deepEqual(
    {
      type: domainTopology.classifyDomainHost("inovasfood.com.br").type,
      variant: domainTopology.classifyDomainHost("inovasfood.com.br").variant,
    },
    {
      type: domainTopology.HOST_TYPES.PLATFORM,
      variant: domainTopology.PLATFORM_HOST_VARIANTS.CANONICAL,
    }
  );
  assert.equal(
    domainTopology.classifyDomainHost("www.inovasfood.com.br").variant,
    domainTopology.PLATFORM_HOST_VARIANTS.ALIAS
  );
  assert.equal(
    domainTopology.classifyDomainHost("tenant-preview.vercel.app").type,
    domainTopology.HOST_TYPES.PLATFORM
  );
  assert.equal(
    domainTopology.classifyDomainHost("localhost:3000").type,
    domainTopology.HOST_TYPES.PLATFORM
  );
  assert.equal(
    domainTopology.classifyDomainHost("[::1]:3000").type,
    domainTopology.HOST_TYPES.PLATFORM
  );
  assert.equal(
    domainTopology.classifyDomainHost("tokyosushidelivery.com.br").type,
    domainTopology.HOST_TYPES.RESTAURANT
  );
});

test("does not let legacy or restaurant URL configuration redefine the canonical platform", () => {
  process.env.PUBLIC_APP_URL = "https://www.inovasfood.com.br";
  assert.equal(domainTopology.getPlatformUrl(), "https://inovasfood.com.br");

  process.env.PUBLIC_APP_URL = "https://tokyosushidelivery.com.br";
  assert.equal(domainTopology.getPlatformUrl(), "https://inovasfood.com.br");
  assert.equal(
    domainTopology.classifyDomainHost("tokyosushidelivery.com.br").type,
    domainTopology.HOST_TYPES.RESTAURANT
  );
});

test("keeps administrative surfaces on the platform and storefront APIs public", () => {
  [
    "/admin/",
    "/admin/caixa/salao",
    "/master/",
    "/system/users",
    "/api/admin/login",
    "/api/auth/restaurant/login",
  ].forEach((pathname) => {
    assert.equal(domainTopology.isPlatformOnlyPath(pathname), true, pathname);
  });

  ["/", "/cardapio.html", "/api/catalog", "/api/orders/create"].forEach(
    (pathname) => {
      assert.equal(domainTopology.isPlatformOnlyPath(pathname), false, pathname);
    }
  );
});

test("builds one-way platform canonical redirects without losing path or query", () => {
  const destination = domainTopology.buildCanonicalPlatformUrl(
    "https://www.inovasfood.com.br/admin/?next=%2Fadmin%2Fcaixa%2Fsalao"
  );

  assert.equal(destination.origin, "https://inovasfood.com.br");
  assert.equal(destination.pathname, "/admin/");
  assert.equal(destination.searchParams.get("next"), "/admin/caixa/salao");
});

test("uses the original forwarded host behind Vercel and the local proxy", () => {
  const host = tenantResolution.getRequestHost({
    url: "http://127.0.0.1:3000/api/catalog",
    headers: {
      host: "127.0.0.1:3000",
      "x-forwarded-host": "pilot-a.localhost",
    },
  });

  assert.equal(host, "pilot-a.localhost");
});

test("resolves slugs consistently on localhost and Vercel Preview", async () => {
  const cookie = "inovas_restaurant_slug=pilot-a";
  const local = await tenantResolution.resolveTenantRequest(
    request({ host: "localhost:3000", cookie })
  );
  const preview = await tenantResolution.resolveTenantRequest(
    request({ host: "tenant-git-main.vercel.app", cookie })
  );

  assert.equal(local.restaurantKey, "pilot-a");
  assert.equal(preview.restaurantKey, "pilot-a");
  assert.equal(preview.matchedSlug, true);
});

test("allows only the explicit default tenant on local development without a slug", async () => {
  const local = await tenantResolution.resolveTenantRequest(
    request({ host: "localhost:3000" })
  );
  const preview = await tenantResolution.resolveTenantRequest(
    request({ host: "tenant-git-main.vercel.app" })
  );

  assert.equal(local.restaurantKey, "default");
  assert.equal(local.resolutionMode, "local_development_default");
  assert.equal(preview.ok, false);
  assert.equal(preview.errorCode, "tenant_route_required");
});

test("fails closed for unknown, pending and inactive routes", async () => {
  const unknown = await tenantResolution.resolveRestaurantByHost("unknown.example");
  const pending = await tenantResolution.resolveRestaurantByHost("pending.example");
  const inactiveSlug = await tenantResolution.resolveRestaurantBySlug("inactive");

  assert.equal(unknown.errorCode, "tenant_host_not_found");
  assert.equal(pending.errorCode, "tenant_route_inactive");
  assert.equal(inactiveSlug.errorCode, "tenant_route_inactive");
  assert.equal(unknown.matched, false);
});

test("binds authenticated custom-domain requests to the persisted session scope", async () => {
  const session = {
    audience: "restaurant",
    tenantId: "tenant_pilot_a",
    restaurantId: "restaurant_pilot_a",
    restaurantKey: "pilot-a",
  };
  const valid = await tenantResolution.resolveTenantRequest(
    request({ host: "pilot-a.localhost" }),
    { authenticatedSession: session }
  );
  const mismatch = await tenantResolution.resolveTenantRequest(
    request({ host: "tokyosushidelivery.com.br" }),
    { authenticatedSession: session }
  );

  assert.equal(valid.restaurantKey, "pilot-a");
  assert.equal(valid.source, tenantResolution.RESOLUTION_SOURCES.SESSION);
  assert.equal(mismatch.errorCode, "tenant_session_mismatch");
});

test("keeps default_only fallback deterministic without exposing another tenant", async () => {
  process.env.INOVAS_TENANT_MODE = "default_only";
  const known = await tenantResolution.resolveRestaurantByHost("pilot-a.localhost");
  const unknown = await tenantResolution.resolveRestaurantByHost("unknown.example");

  assert.equal(known.restaurantKey, "default");
  assert.equal(known.matched, true);
  assert.equal(known.multiRestaurantActive, false);
  assert.equal(unknown.restaurantKey, "default");
  assert.equal(unknown.matched, false);
  assert.equal(unknown.fallbackApplied, true);
});

test("forces strict resolution in Production even when configuration is omitted", async () => {
  process.env.NODE_ENV = "production";
  process.env.INOVAS_TENANT_MODE = "default_only";
  const result = await tenantResolution.resolveRestaurantByHost("unknown.example");

  assert.equal(tenantResolution.getTenantMode(), "strict");
  assert.equal(result.errorCode, "tenant_host_not_found");
  assert.equal(result.restaurantKey, "");
});

test("does not retain shared route data between calls", async () => {
  let status = "ACTIVE";
  let reads = 0;
  installRouteRepository((selector) => {
    reads += 1;
    const route = routes.find((entry) => entry.slug === selector.slug);
    return route ? { ...route, status } : null;
  });

  const active = await tenantResolution.resolveRestaurantBySlug("pilot-a");
  status = "INACTIVE";
  const inactive = await tenantResolution.resolveRestaurantBySlug("pilot-a");

  assert.equal(active.matched, true);
  assert.equal(inactive.errorCode, "tenant_route_inactive");
  assert.equal(reads, 2);
});

test("uses one parser for canonical and legacy public paths", () => {
  assert.deepEqual(
    tenantResolution.parsePublicRestaurantPath("/r/pilot-a/cardapio.html"),
    {
      recognized: true,
      legacy: true,
      valid: true,
      errorCode: "",
      slug: "pilot-a",
      suffix: "/cardapio.html",
    }
  );
  assert.equal(
    tenantResolution.parsePublicRestaurantPath("/admin/login.html").recognized,
    false
  );
});
