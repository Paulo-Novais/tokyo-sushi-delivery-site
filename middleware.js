import { next } from "@vercel/functions";
import adminAuth from "./lib/admin-auth.cjs";
import appBranding from "./lib/app-branding.cjs";
import userPermissions from "./lib/user-permissions.cjs";

const PUBLIC_ADMIN_PATHS = new Set([
  "/admin/login.html",
  "/api/admin/login",
  "/api/admin/logout",
  "/api/admin/session",
]);
const PUBLIC_ADMIN_ASSET_PATTERN =
  /^\/admin\/.+\.(css|js|map|png|jpg|jpeg|svg|webp|gif|ico)$/i;
const MASTER_ADMIN_HTML_PATHS = new Set(["/admin/master.html", "/admin/master"]);
const DOMAIN_CONFIG = appBranding.DOMAIN_CONFIG || {};
const SITE_APPEARANCE = appBranding.SITE_APPEARANCE || {};

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
  ]
    .map(normalizePolicyHost)
    .filter(Boolean)
);

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

export default async function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const policyHost = getRequestPolicyHost(request, url);

  if (!isAllowedPublicHost(policyHost)) {
    return buildUnknownHostResponse();
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

  return next();
}

export const config = {
  matcher: ["/:path*"],
  runtime: "nodejs",
};
