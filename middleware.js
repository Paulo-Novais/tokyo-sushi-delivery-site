import { next } from "@vercel/functions";
import adminAuth from "./lib/admin-auth.cjs";

const PUBLIC_ADMIN_PATHS = new Set([
  "/admin/login.html",
  "/api/admin/login",
  "/api/admin/logout",
  "/api/admin/session",
]);
const PUBLIC_ADMIN_ASSET_PATTERN =
  /^\/admin\/.+\.(css|js|map|png|jpg|jpeg|svg|webp|gif|ico)$/i;

const isPublicAdminPath = (pathname) =>
  PUBLIC_ADMIN_PATHS.has(pathname) || PUBLIC_ADMIN_ASSET_PATTERN.test(pathname);

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

export default function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const session = adminAuth.getAdminSessionFromCookieHeader(
    request.headers.get("cookie") || ""
  );

  if (pathname === "/admin/login.html" && session) {
    return Response.redirect(new URL("/admin/", request.url), 307);
  }

  if (isPublicAdminPath(pathname)) {
    return next();
  }

  if (session) {
    return next();
  }

  if (pathname.startsWith("/api/admin/")) {
    return buildUnauthorizedApiResponse();
  }

  const loginUrl = new URL("/admin/login.html", request.url);
  loginUrl.searchParams.set("next", `${pathname}${url.search}`);
  return Response.redirect(loginUrl, 307);
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
  runtime: "nodejs",
};
