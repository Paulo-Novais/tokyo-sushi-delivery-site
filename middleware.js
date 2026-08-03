import { next, rewrite } from "@vercel/functions";
import adminAuth from "./lib/admin-auth.cjs";
import appBranding from "./lib/app-branding.cjs";
import restaurantPublicUrl from "./lib/restaurant-public-url.cjs";
import tenantResolution from "./lib/tenant-resolution.cjs";
import userPermissions from "./lib/user-permissions.cjs";
import domainSessions from "./lib/domain-sessions.cjs";
import domainTopology from "./lib/domain-topology.cjs";

const PUBLIC_ADMIN_PATHS = new Set([
  "/admin/login.html",
  "/admin/convite.html",
  "/api/admin/login",
  "/api/admin/logout",
  "/api/admin/session",
  "/api/admin/auth/accept-invite",
]);
const PUBLIC_ADMIN_ASSET_PATTERN =
  /^\/admin\/.+\.(css|js|map|png|jpg|jpeg|svg|webp|gif|ico)$/i;
const MASTER_ADMIN_HTML_PATHS = new Set(["/admin/master.html", "/admin/master"]);
const USER_CREATION_HTML_PATHS = new Set([
  "/admin/usuarios/novo",
  "/admin/usuarios/novo.html",
]);
const PUBLIC_SYSTEM_PATHS = new Set([
  "/system/login.html",
  "/api/auth/system/login",
  "/api/auth/system/session",
  "/api/auth/system/logout",
  "/api/auth/restaurant/login",
  "/api/auth/restaurant/session",
  "/api/auth/restaurant/logout",
]);
const SYSTEM_ASSET_PATTERN =
  /^\/system\/.+\.(css|js|map|png|jpg|jpeg|svg|webp|gif|ico)$/i;
const SYSTEM_CONTROLLED_PATTERN = /^\/(?:system(?:\/|$)|api\/system(?:\/|$)|api\/support(?:\/|$))/;
const TENANT_API_PATTERN = /^\/api\/tenant(?:\/|$)/;
const {
  SESSION_AUDIENCES,
  getDomainSessionFromRequest,
} = domainSessions;
const DOMAIN_CONFIG = appBranding.DOMAIN_CONFIG || {};
const {
  RESTAURANT_ROUTE_COOKIE,
} = restaurantPublicUrl;
const {
  HOST_TYPES,
  PLATFORM_HOST_VARIANTS,
  buildCanonicalPlatformUrl,
  classifyDomainHost,
  isPlatformApiPath,
  isPlatformOnlyPath,
} = domainTopology;
const {
  HOST_KINDS,
  classifyTenantHost,
  isPathTenantHost,
  normalizeTenantHost,
  parsePublicRestaurantPath,
  resolveRestaurantByHost,
  resolveRestaurantBySlug,
} = tenantResolution;
const PUBLIC_RESTAURANT_PAGES = new Set([
  "acompanhar.html",
  "avaliar.html",
  "cardapio.html",
  "entrega.html",
  "historico.html",
  "trabalhe-conosco.html",
]);
const PUBLIC_RESTAURANT_ROOT_ASSETS = new Set([
  "maps-config.js",
  "script.js",
  "site-config.js",
  "store-hours.js",
  "styles.css",
  "tokyo.webmanifest",
]);

const normalizePolicyHost = normalizeTenantHost;
const RESTAURANT_PRIMARY_HOST = normalizeTenantHost(DOMAIN_CONFIG.primaryDomain);

const isPublicAdminPath = (pathname) =>
  PUBLIC_ADMIN_PATHS.has(pathname) || PUBLIC_ADMIN_ASSET_PATTERN.test(pathname);

const isMasterAdminHtmlPath = (pathname) => MASTER_ADMIN_HTML_PATHS.has(pathname);

const isAdminControlledPath = (pathname) =>
  pathname === "/admin" ||
  pathname.startsWith("/admin/") ||
  pathname === "/gestor" ||
  pathname === "/gestor/" ||
  pathname.startsWith("/gestor/") ||
  pathname.startsWith("/api/admin/");

const isSystemControlledPath = (pathname) =>
  SYSTEM_CONTROLLED_PATTERN.test(pathname);

const getRequestPolicyHost = (request, requestUrl) =>
  normalizePolicyHost(
    request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      requestUrl.host
  );

const getRawRequestHost = (request, requestUrl) =>
  String(
    request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      requestUrl.host ||
      ""
  )
    .split(",")[0]
    .trim()
    .toLowerCase();

const buildUnknownHostResponse = () =>
  new Response("Dominio nao vinculado a este projeto.", {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });

const buildRewriteResponse = (requestUrl, destination) =>
  rewrite(new URL(destination, requestUrl));

const getRestaurantRouteCookie = (requestUrl, slug) => {
  const secure = new URL(requestUrl).protocol === "https:";
  return `${RESTAURANT_ROUTE_COOKIE}=${encodeURIComponent(
    slug
  )}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
};

const attachRestaurantRouteCookie = (response, requestUrl, slug) => {
  response.headers.append(
    "Set-Cookie",
    getRestaurantRouteCookie(requestUrl, slug)
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
};

const buildRestaurantNotFoundResponse = () =>
  new Response(
    `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <title>Restaurante não encontrado | INOVAS Food</title>
      </head>
      <body>
        <main>
          <h1>Restaurante não encontrado</h1>
          <p>Confira o endereço informado ou volte para o INOVAS Food.</p>
          <a href="/">Voltar ao início</a>
        </main>
      </body>
    </html>`,
    {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
      },
    }
  );

const buildPermanentRestaurantRedirect = (requestUrl, pathname, slug) => {
  const destination = new URL(requestUrl);
  destination.pathname = pathname;
  const response = new Response(null, {
    status: 308,
    headers: {
      Location: destination.toString(),
    },
  });
  return attachRestaurantRouteCookie(response, requestUrl, slug);
};

const isPublicRestaurantAssetPath = (suffix = "") => {
  const normalizedSuffix = String(suffix || "").replace(/^\/+/, "");

  return (
    PUBLIC_RESTAURANT_PAGES.has(normalizedSuffix) ||
    PUBLIC_RESTAURANT_ROOT_ASSETS.has(normalizedSuffix) ||
    normalizedSuffix.startsWith("assets/") ||
    normalizedSuffix.startsWith("site-images/")
  );
};

const resolvePublicRestaurantPath = async (request, pathname, rawHost) => {
  if (!isPathTenantHost(rawHost)) {
    return null;
  }

  const route = parsePublicRestaurantPath(pathname);

  if (!route.recognized) {
    return null;
  }

  if (!route.valid) {
    return buildRestaurantNotFoundResponse();
  }

  const resolution = await resolveRestaurantBySlug(route.slug);

  if (resolution?.matched !== true) {
    return buildRestaurantNotFoundResponse();
  }

  const canonicalSlug = resolution.slug;
  const suffix = route.suffix;

  if (route.legacy) {
    const canonicalSuffix =
      suffix === "/" || suffix === "/index.html" ? "" : suffix;
    return buildPermanentRestaurantRedirect(
      request.url,
      `/${canonicalSlug}${canonicalSuffix}`,
      canonicalSlug
    );
  }

  if (suffix === "/" || suffix === "/index.html") {
    return buildPermanentRestaurantRedirect(
      request.url,
      `/${canonicalSlug}`,
      canonicalSlug
    );
  }

  const destination = suffix
    ? isPublicRestaurantAssetPath(suffix)
      ? `/${suffix.replace(/^\/+/, "")}`
      : ""
    : "/tokyo.html";

  if (!destination) {
    return buildRestaurantNotFoundResponse();
  }

  return attachRestaurantRouteCookie(
    buildRewriteResponse(request.url, destination),
    request.url,
    canonicalSlug
  );
};

const resolvePublicAppCanonicalRedirect = (request, rawHost) => {
  const classification = classifyDomainHost(rawHost);

  if (
    classification.type !== HOST_TYPES.PLATFORM ||
    classification.variant !== PLATFORM_HOST_VARIANTS.ALIAS
  ) {
    return null;
  }

  return Response.redirect(buildCanonicalPlatformUrl(request.url), 308);
};

const buildPlatformHostRequiredResponse = () =>
  new Response(
    JSON.stringify({
      error: "Esta rota pertence a plataforma INOVAS Food.",
      errorCode: "platform_host_required",
    }),
    {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
      },
    }
  );

const resolvePlatformSurfaceBoundary = (request, pathname, hostClassification) => {
  if (
    hostClassification.type !== HOST_TYPES.RESTAURANT ||
    !isPlatformOnlyPath(pathname)
  ) {
    return null;
  }

  if (
    isPlatformApiPath(pathname) ||
    !["GET", "HEAD"].includes(String(request.method || "GET").toUpperCase())
  ) {
    return buildPlatformHostRequiredResponse();
  }

  return Response.redirect(buildCanonicalPlatformUrl(request.url), 308);
};

const resolveRestaurantHostRewrite = (
  request,
  pathname,
  policyHost,
  hostResolution
) => {
  if (hostResolution?.matched !== true) {
    return null;
  }

  if (policyHost === RESTAURANT_PRIMARY_HOST && pathname === "/robots.txt") {
    return buildRewriteResponse(request.url, "/tokyo-robots.txt");
  }

  if (policyHost === RESTAURANT_PRIMARY_HOST && pathname === "/sitemap.xml") {
    return buildRewriteResponse(request.url, "/tokyo-sitemap.xml");
  }

  if (pathname === "/" || pathname === "/index.html") {
    return buildRewriteResponse(request.url, "/tokyo.html");
  }

  const legacyPrefix = `/r/${hostResolution.slug}`;

  if (pathname === `${legacyPrefix}/` || pathname === `${legacyPrefix}/index.html`) {
    return buildRewriteResponse(request.url, "/tokyo.html");
  }

  if (pathname.startsWith(`${legacyPrefix}/`)) {
    return buildRewriteResponse(request.url, `/${pathname.slice(legacyPrefix.length + 1)}`);
  }

  return null;
};

const buildGestorRedirectUrl = (requestUrl) => {
  const url = new URL(requestUrl);
  const suffix = url.pathname.replace(/^\/gestor\/?/, "");
  const targetPath = suffix ? `/admin/${suffix}` : "/admin/";
  const target = new URL(targetPath, requestUrl);
  target.search = url.search;
  return target;
};

const buildMasterRedirectUrl = (requestUrl) => {
  const url = new URL(requestUrl);
  const suffix = url.pathname.replace(/^\/master\/?/, "");
  const target = new URL(suffix ? `/system/${suffix}` : "/system", requestUrl);
  target.search = url.search;
  return target;
};

const buildUnauthorizedApiResponse = () =>
  new Response(
    JSON.stringify({
      error: "Sessao administrativa invalida ou expirada.",
      errorCode: "admin_session_required",
    }),
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
      },
    }
  );

const buildForbiddenMasterResponse = () =>
  new Response("Acesso negado ao Painel Master.", {
    status: 403,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });

const buildForbiddenUserCreationResponse = () =>
  new Response("Acesso negado para criacao de usuarios.", {
    status: 403,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });

const resolveAdminSessionUserType = async (session) => {
  try {
    const accessContext = await userPermissions.getAdminAccessContext(
      session,
      [],
      adminAuth.getConfiguredAdminUsers()
    );

    return String(
      accessContext.session?.userType || accessContext.session?.tipo_usuario || ""
    )
      .trim()
      .toUpperCase();
  } catch (error) {
    return "";
  }
};

const canAccessUserCreation = async (session) => {
  try {
    await userPermissions.getAdminAccessContext(
      session,
      ["users_create"],
      adminAuth.getConfiguredAdminUsers()
    );
    return true;
  } catch (error) {
    return false;
  }
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const policyHost = getRequestPolicyHost(request, url);
  const rawHost = getRawRequestHost(request, url);
  const hostClassification = classifyDomainHost(rawHost);
  const hostKind = classifyTenantHost(policyHost);
  const hostResolution =
    hostKind === HOST_KINDS.CUSTOM_DOMAIN
      ? await resolveRestaurantByHost(policyHost)
      : null;

  if (hostKind === HOST_KINDS.CUSTOM_DOMAIN && hostResolution?.matched !== true) {
    return buildUnknownHostResponse();
  }

  const canonicalRedirect = resolvePublicAppCanonicalRedirect(request, rawHost);

  if (canonicalRedirect) {
    return canonicalRedirect;
  }

  const platformSurfaceBoundary = resolvePlatformSurfaceBoundary(
    request,
    pathname,
    hostClassification
  );

  if (platformSurfaceBoundary) {
    return platformSurfaceBoundary;
  }

  const publicRestaurantPath = await resolvePublicRestaurantPath(
    request,
    pathname,
    rawHost
  );

  if (publicRestaurantPath) {
    return publicRestaurantPath;
  }

  const restaurantRewrite = resolveRestaurantHostRewrite(
    request,
    pathname,
    policyHost,
    hostResolution
  );

  if (restaurantRewrite) {
    return restaurantRewrite;
  }

  if (pathname === "/gestor" || pathname === "/gestor/" || pathname.startsWith("/gestor/")) {
    return Response.redirect(buildGestorRedirectUrl(request.url), 307);
  }

  if (pathname === "/master" || pathname === "/master/" || pathname.startsWith("/master/")) {
    return Response.redirect(buildMasterRedirectUrl(request.url), 307);
  }

  const systemSession = getDomainSessionFromRequest(
    request,
    SESSION_AUDIENCES.SYSTEM
  );
  const restaurantSession = getDomainSessionFromRequest(
    request,
    SESSION_AUDIENCES.RESTAURANT
  );
  const supportSession = getDomainSessionFromRequest(
    request,
    SESSION_AUDIENCES.SUPPORT
  );
  const validSupportContext = Boolean(systemSession && supportSession);

  if (PUBLIC_SYSTEM_PATHS.has(pathname) || SYSTEM_ASSET_PATTERN.test(pathname)) {
    if (pathname === "/system/login.html" && systemSession) {
      return Response.redirect(new URL("/system", request.url), 307);
    }
    return next();
  }

  if (isSystemControlledPath(pathname)) {
    if (!systemSession) {
      if (pathname.startsWith("/api/")) {
        return buildUnauthorizedApiResponse();
      }
      const systemLogin = new URL("/system/login.html", request.url);
      systemLogin.searchParams.set("next", `${pathname}${url.search}`);
      return Response.redirect(systemLogin, 307);
    }
    return next();
  }

  if (TENANT_API_PATTERN.test(pathname)) {
    return restaurantSession || validSupportContext
      ? next()
      : buildUnauthorizedApiResponse();
  }

  if (!isAdminControlledPath(pathname)) {
    return next();
  }

  if (pathname === "/admin/login.html") {
    if (restaurantSession) {
      return Response.redirect(new URL("/admin/", request.url), 307);
    }
    if (systemSession) {
      return Response.redirect(new URL("/system", request.url), 307);
    }
    return next();
  }

  if (isPublicAdminPath(pathname)) {
    return next();
  }

  if (isMasterAdminHtmlPath(pathname)) {
    return Response.redirect(new URL("/system", request.url), 307);
  }

  if (pathname.startsWith("/api/admin/master")) {
    return systemSession ? next() : buildUnauthorizedApiResponse();
  }

  const loginUrl = new URL("/admin/login.html", request.url);
  loginUrl.searchParams.set("next", `${pathname}${url.search}`);

  if (!restaurantSession && !validSupportContext) {
    if (pathname.startsWith("/api/admin/")) {
      return buildUnauthorizedApiResponse();
    }
    if (systemSession) {
      return Response.redirect(new URL("/system", request.url), 307);
    }
    return Response.redirect(loginUrl, 307);
  }

  return next();
}

export const config = {
  matcher: ["/:path*"],
  runtime: "nodejs",
};
