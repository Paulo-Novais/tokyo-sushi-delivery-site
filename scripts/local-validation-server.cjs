const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "inovas-local-server-"));
const tempDataRoot = path.join(tempRoot, ".data");

fs.mkdirSync(tempDataRoot, { recursive: true });
fs.copyFileSync(path.join(workspaceRoot, "script.js"), path.join(tempRoot, "script.js"));
process.chdir(tempRoot);

const port = Number(process.env.PORT || process.env.E2E_PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
const baseURL = process.env.BASE_URL || process.env.VALIDATION_BASE_URL || `http://${host}:${port}`;
const adminLogin = process.env.E2E_ADMIN_LOGIN || "admin.e2e@local.test";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || crypto.randomBytes(24).toString("base64url");
const sessionSecret = process.env.E2E_SESSION_SECRET || crypto.randomBytes(32).toString("base64url");

process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.INOVAS_TENANT_MODE = process.env.INOVAS_TENANT_MODE || "pilot";
process.env.ADMIN_LOGIN = adminLogin;
process.env.ADMIN_PASSWORD = adminPassword;
process.env.ADMIN_DISPLAY_NAME = process.env.E2E_ADMIN_DISPLAY_NAME || "Admin E2E";
process.env.ADMIN_SESSION_SECRET = sessionSecret;
process.env.CUSTOMER_SESSION_SECRET =
  process.env.CUSTOMER_SESSION_SECRET || crypto.randomBytes(32).toString("base64url");
process.env.ALLOWED_PUBLIC_ORIGINS =
  process.env.ALLOWED_PUBLIC_ORIGINS ||
  [
    baseURL,
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ].join(",");

const adminApi = require(path.join(workspaceRoot, "api", "admin", "[...action].js"));
const customerApi = require(path.join(workspaceRoot, "api", "customer", "[...action].js"));
const catalogApi = require(path.join(workspaceRoot, "api", "catalog.js"));
const deliverySettingsApi = require(path.join(workspaceRoot, "api", "delivery-settings.js"));
const restaurantSettingsApi = require(path.join(workspaceRoot, "api", "restaurant-settings.js"));
const orderCreateApi = require(path.join(workspaceRoot, "api", "orders", "create.js"));
const whatsappCodeApi = require(path.join(workspaceRoot, "api", "auth", "send-whatsapp-code.js"));
const { getAdminSessionFromRequest } = require(path.join(workspaceRoot, "lib", "admin-auth.cjs"));

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".cjs", "application/javascript; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"],
  [".xml", "application/xml; charset=utf-8"],
]);

const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline' https://maps.googleapis.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://maps.gstatic.com https://maps.googleapis.com; connect-src 'self' https://maps.googleapis.com https://graph.facebook.com; font-src 'self' data:; form-action 'self'; upgrade-insecure-requests",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()",
  "X-Frame-Options": "DENY",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

const setSecurityHeaders = (res) => {
  Object.entries(SECURITY_HEADERS).forEach(([name, value]) => {
    if (!res.hasHeader(name)) {
      res.setHeader(name, value);
    }
  });
};

const readRequestBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("error", reject);
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });

const createApiResponse = (res) => ({
  setHeader(name, value) {
    res.setHeader(name, value);
  },
  status(code) {
    res.statusCode = code;
    return this;
  },
  json(payload) {
    setSecurityHeaders(res);
    if (!res.hasHeader("Content-Type")) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.end(JSON.stringify(payload));
    return payload;
  },
});

const runApi = async (handler, req, res) => {
  req.body = await readRequestBody(req);
  req.headers["x-forwarded-proto"] = req.headers["x-forwarded-proto"] || "http";
  setSecurityHeaders(res);
  await handler(req, createApiResponse(res));
};

const sendText = (res, status, body) => {
  setSecurityHeaders(res);
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
};

const sendRedirect = (res, status, location) => {
  setSecurityHeaders(res);
  res.writeHead(status, { Location: location });
  res.end();
};

const isPublicAdminAsset = (pathname) =>
  pathname === "/admin/login.html" ||
  pathname === "/admin/admin.css" ||
  pathname === "/admin/design-system.css" ||
  pathname === "/admin/admin.js" ||
  pathname === "/admin/master.js";

const protectAdminHtml = (req, res, pathname) => {
  if (!pathname.startsWith("/admin/") || isPublicAdminAsset(pathname)) {
    return true;
  }

  if (!pathname.endsWith(".html") && pathname !== "/admin/" && pathname !== "/admin") {
    return true;
  }

  const session = getAdminSessionFromRequest(req);

  if (!session) {
    const next = encodeURIComponent(pathname);
    setSecurityHeaders(res);
    res.writeHead(302, {
      Location: `/admin/login.html?next=${next}`,
      "Cache-Control": "no-store, max-age=0",
    });
    res.end();
    return false;
  }

  if ((pathname === "/admin/master.html" || pathname === "/admin/master") && session.userType !== "MASTER") {
    sendText(res, 403, "Acesso negado ao Painel Master.");
    return false;
  }

  return true;
};

const resolveStaticPathname = (pathname) => {
  if (pathname === "/") return "/index.html";
  if (pathname === "/inovas") return "/inovas.html";
  if (pathname === "/r/tokyo-sushi/" || pathname === "/r/tokyo-sushi/index.html") return "/tokyo.html";
  if (pathname.startsWith("/r/tokyo-sushi/")) return `/${pathname.slice("/r/tokyo-sushi/".length)}`;
  if (pathname === "/admin" || pathname === "/admin/") return "/admin/index.html";
  if (pathname === "/admin/master") return "/admin/master.html";
  return pathname;
};

const resolveLocalRedirect = (pathname, search) => {
  if (pathname === "/gestor" || pathname === "/gestor/") {
    return `/admin/${search}`;
  }

  if (pathname.startsWith("/gestor/")) {
    return `/admin/${pathname.slice("/gestor/".length)}${search}`;
  }

  if (pathname === "/r/tokyo-sushi") {
    return `/r/tokyo-sushi/${search}`;
  }

  return null;
};

const serveStatic = async (req, res, pathname) => {
  const staticPathname = resolveStaticPathname(pathname);

  if (!protectAdminHtml(req, res, staticPathname)) {
    return;
  }

  const requestedPath = path.resolve(workspaceRoot, `.${staticPathname}`);

  if (!requestedPath.startsWith(workspaceRoot)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  const stats = await fs.promises.stat(requestedPath).catch(() => null);

  if (!stats || !stats.isFile()) {
    sendText(res, 404, "Not found");
    return;
  }

  const extension = path.extname(requestedPath).toLowerCase();
  const contentType = MIME_TYPES.get(extension) || "application/octet-stream";
  const body = await fs.promises.readFile(requestedPath);

  setSecurityHeaders(res);
  if (staticPathname.startsWith("/admin/")) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
  }
  res.writeHead(200, {
    "Cache-Control": staticPathname.startsWith("/admin/") ? "no-store, max-age=0" : "public, max-age=0, must-revalidate",
    "Content-Type": contentType,
  });
  res.end(body);
};

const handleApi = async (req, res, pathname) => {
  if (pathname.startsWith("/api/admin")) return runApi(adminApi, req, res);
  if (pathname.startsWith("/api/customer")) return runApi(customerApi, req, res);
  if (pathname === "/api/orders/create") return runApi(orderCreateApi, req, res);
  if (pathname === "/api/catalog") return runApi(catalogApi, req, res);
  if (pathname === "/api/reviews") {
    const separator = req.url.includes("?") ? "&" : "?";
    req.url = `${req.url}${separator}publicView=reviews`;
    return runApi(catalogApi, req, res);
  }
  if (pathname === "/api/delivery-settings") return runApi(deliverySettingsApi, req, res);
  if (pathname === "/api/restaurant-settings") return runApi(restaurantSettingsApi, req, res);
  if (pathname === "/api/auth/send-whatsapp-code") return runApi(whatsappCodeApi, req, res);
  sendText(res, 404, "API route not found");
};

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || "/", baseURL);
    const pathname = decodeURIComponent(requestUrl.pathname);
    const redirectLocation = resolveLocalRedirect(pathname, requestUrl.search);

    if (redirectLocation) {
      sendRedirect(res, 302, redirectLocation);
      return;
    }

    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname);
      return;
    }

    await serveStatic(req, res, pathname);
  } catch (error) {
    sendText(res, 500, error?.message || "Internal server error");
  }
});

const cleanup = () => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
};

process.once("exit", cleanup);
process.once("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.once("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

server.listen(port, host, () => {
  console.log(`INOVAS validation server ready at http://${host}:${port}`);
});
