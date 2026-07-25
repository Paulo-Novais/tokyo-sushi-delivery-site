import { next, rewrite } from "@vercel/functions";
import adminAuth from "./lib/admin-auth.cjs";
import appBranding from "./lib/app-branding.cjs";
import masterPlatformStore from "./lib/master-platform-store.cjs";
import restaurantPublicUrl from "./lib/restaurant-public-url.cjs";
import userPermissions from "./lib/user-permissions.cjs";

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
const DOMAIN_CONFIG = appBranding.DOMAIN_CONFIG || {};
const SITE_APPEARANCE = appBranding.SITE_APPEARANCE || {};
const {
  RESTAURANT_ROUTE_COOKIE,
  getPublicAppHost,
  getPublicAppUrl,
  isPublicAppHost,
  validateRestaurantSlug,
} = restaurantPublicUrl;
const { resolveRestaurantBySlug } = masterPlatformStore;
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

const normalizePolicyHost = (value) => {
  const rawValue = String(value || "")
    .split(",")[0]
    .trim()
    .toLowerCase();

  if (!rawValue) {
    return "";
  }

  try {
    return new URL(rawValue.includes("://") ? rawValue : `https://${rawValue}`).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch (error) {
    return rawValue
      .replace(/^https?:\/\//, "")
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .split("/")[0]
      .split(":")[0]
      .replace(/^www\./, "")
      .trim()
      .toLowerCase();
  }
};

const PUBLIC_ALLOWED_HOSTS = new Set(
  [
    DOMAIN_CONFIG.primaryDomain,
    ...(Array.isArray(DOMAIN_CONFIG.alternateDomains) ? DOMAIN_CONFIG.alternateDomains : []),
    ...(Array.isArray(DOMAIN_CONFIG.allowedHostnames) ? DOMAIN_CONFIG.allowedHostnames : []),
    SITE_APPEARANCE.platformFooter?.url,
    SITE_APPEARANCE.platformFooter?.displayUrl,
    getPublicAppUrl(),
    getPublicAppHost(),
  ]
    .map(normalizePolicyHost)
    .filter(Boolean)
);
const RESTAURANT_PRIMARY_HOST = normalizePolicyHost(DOMAIN_CONFIG.primaryDomain);

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

const isLocalHost = (host) =>
  ["localhost", "127.0.0.1", "::1"].includes(host);

const isVercelPreviewHost = (host) =>
  host.endsWith(".vercel.app") || host.endsWith(".vercel.sh");

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

const isAllowedPublicHost = (host) =>
  !host || isLocalHost(host) || isVercelPreviewHost(host) || PUBLIC_ALLOWED_HOSTS.has(host);

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
  if (
    !(
      isPublicAppHost(rawHost) ||
      isLocalHost(normalizePolicyHost(rawHost)) ||
      isVercelPreviewHost(normalizePolicyHost(rawHost))
    )
  ) {
    return null;
  }

  const legacyMatch = pathname.match(/^\/r\/([^/]+)(\/.*)?$/);
  const cleanMatch = pathname.match(/^\/([^/]+)(\/.*)?$/);
  const routeMatch = legacyMatch || cleanMatch;

  if (!routeMatch) {
    return null;
  }

  const slugValidation = validateRestaurantSlug(routeMatch[1]);

  if (!slugValidation.ok) {
    if (
      !legacyMatch &&
      (slugValidation.errorCode === "restaurant_slug_reserved" ||
        routeMatch[1].includes("."))
    ) {
      return null;
    }

    return buildRestaurantNotFoundResponse();
  }

  const resolution = await resolveRestaurantBySlug(slugValidation.slug);

  if (resolution?.matched !== true) {
    return buildRestaurantNotFoundResponse();
  }

  const canonicalSlug = resolution.slug;
  const suffix = String(routeMatch[2] || "");

  if (legacyMatch) {
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
  const normalizedRawHost = String(rawHost || "")
    .split(":")[0]
    .toLowerCase();
  const configuredHost = getPublicAppHost();

  if (!isPublicAppHost(normalizedRawHost) || normalizedRawHost === configuredHost) {
    return null;
  }

  const destination = new URL(request.url);
  const publicOrigin = new URL(getPublicAppUrl());
  destination.protocol = publicOrigin.protocol;
  destination.host = publicOrigin.host;
  return Response.redirect(destination, 308);
};

const resolveRestaurantHostRewrite = (request, pathname, policyHost) => {
  if (policyHost !== RESTAURANT_PRIMARY_HOST) {
    return null;
  }

  if (getRawRequestHost(request, new URL(request.url)).replace(/^https?:\/\//, "").startsWith("www.")) {
    return null;
  }

  if (pathname === "/robots.txt") {
    return buildRewriteResponse(request.url, "/tokyo-robots.txt");
  }

  if (pathname === "/sitemap.xml") {
    return buildRewriteResponse(request.url, "/tokyo-sitemap.xml");
  }

  if (pathname === "/" || pathname === "/index.html") {
    return buildRewriteResponse(request.url, "/tokyo.html");
  }

  if (pathname === "/r/tokyo-sushi/" || pathname === "/r/tokyo-sushi/index.html") {
    return buildRewriteResponse(request.url, "/tokyo.html");
  }

  if (pathname.startsWith("/r/tokyo-sushi/")) {
    return buildRewriteResponse(request.url, `/${pathname.slice("/r/tokyo-sushi/".length)}`);
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

  if (!isAllowedPublicHost(policyHost)) {
    return buildUnknownHostResponse();
  }

  const canonicalRedirect = resolvePublicAppCanonicalRedirect(request, rawHost);

  if (canonicalRedirect) {
    return canonicalRedirect;
  }

  const publicRestaurantPath = await resolvePublicRestaurantPath(
    request,
    pathname,
    rawHost
  );

  if (publicRestaurantPath) {
    return publicRestaurantPath;
  }

  const restaurantRewrite = resolveRestaurantHostRewrite(request, pathname, policyHost);

  if (restaurantRewrite) {
    return restaurantRewrite;
  }

  if (pathname === "/gestor" || pathname === "/gestor/" || pathname.startsWith("/gestor/")) {
    return Response.redirect(buildGestorRedirectUrl(request.url), 307);
  }

  if (!isAdminControlledPath(pathname)) {
    return next();
  }

  const session = adminAuth.getAdminSessionFromCookieHeader(
    request.headers.get("cookie") || ""
  );

  if (pathname === "/admin/login.html" && session) {
    return Response.redirect(new URL("/admin/", request.url), 307);
  }

  if (isPublicAdminPath(pathname)) {
    return next();
  }

  const loginUrl = new URL("/admin/login.html", request.url);
  loginUrl.searchParams.set("next", `${pathname}${url.search}`);

  if (!session) {
    if (pathname.startsWith("/api/admin/")) {
      return buildUnauthorizedApiResponse();
    }

    return Response.redirect(loginUrl, 307);
  }

  if (isMasterAdminHtmlPath(pathname)) {
    const userType = await resolveAdminSessionUserType(session);

    if (userType !== "MASTER") {
      return buildForbiddenMasterResponse();
    }
  }

  if (USER_CREATION_HTML_PATHS.has(pathname) && !(await canAccessUserCreation(session))) {
    return buildForbiddenUserCreationResponse();
  }

  return next();
}

export const config = {
  matcher: ["/:path*"],
  runtime: "nodejs",
};
