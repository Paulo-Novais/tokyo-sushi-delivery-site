import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const realDataDirectory = path.join(workspaceRoot, ".data");
const auditRoot = path.join(workspaceRoot, ".tmp", "inovas-responsive-audit");
const reportJsonPath = path.join(auditRoot, "responsive-audit-report.json");

const ADMIN_THEME_STORAGE_KEY = "tokyo_admin_theme";

const PROFILE_FIXTURES = Object.freeze({
  master: { login: "usermaster@inovas.com", password: "novais753951", userType: "MASTER" },
  owner: { login: "owner.responsive@inovas.local", password: "SenhaResponsiveOwner", userType: "OWNER" },
  gerente: { login: "gerente.responsive@inovas.local", password: "SenhaResponsiveGerente", userType: "GERENTE" },
  caixa: { login: "caixa.responsive@inovas.local", password: "SenhaResponsiveCaixa", userType: "CAIXA" },
  cozinha: { login: "cozinha.responsive@inovas.local", password: "SenhaResponsiveCozinha", userType: "COZINHA" },
  estoque: { login: "estoque.responsive@inovas.local", password: "SenhaResponsiveEstoque", userType: "ESTOQUE" },
  entregador: { login: "entregador.responsive@inovas.local", password: "SenhaResponsiveEntregador", userType: "ENTREGADOR" },
  socio: { login: "socio.responsive@inovas.local", password: "SenhaResponsiveSocio", userType: "SOCIO" },
  desenvolvedor: { login: "dev.responsive@inovas.local", password: "SenhaResponsiveDev", userType: "DESENVOLVEDOR" },
  suporte: { login: "suporte.responsive@inovas.local", password: "SenhaResponsiveSuporte", userType: "SUPORTE" },
  vendedor: { login: "vendedor.responsive@inovas.local", password: "SenhaResponsiveVendedor", userType: "VENDEDOR" },
});

const REQUIRED_BREAKPOINTS = Object.freeze([
  { label: "mobile-small-320x568", width: 320, height: 568 },
  { label: "mobile-small-360x640", width: 360, height: 640 },
  { label: "mobile-small-375x667", width: 375, height: 667 },
  { label: "mobile-modern-390x844", width: 390, height: 844 },
  { label: "mobile-modern-393x873", width: 393, height: 873 },
  { label: "mobile-modern-412x915", width: 412, height: 915 },
  { label: "mobile-modern-414x896", width: 414, height: 896 },
  { label: "mobile-modern-430x932", width: 430, height: 932 },
  { label: "tablet-600x960", width: 600, height: 960 },
  { label: "tablet-768x1024", width: 768, height: 1024 },
  { label: "tablet-820x1180", width: 820, height: 1180 },
  { label: "tablet-834x1194", width: 834, height: 1194 },
  { label: "notebook-1024x768", width: 1024, height: 768 },
  { label: "notebook-1280x720", width: 1280, height: 720 },
  { label: "notebook-1280x800", width: 1280, height: 800 },
  { label: "notebook-1366x768", width: 1366, height: 768 },
  { label: "desktop-1440x900", width: 1440, height: 900 },
  { label: "desktop-1536x864", width: 1536, height: 864 },
  { label: "desktop-1600x900", width: 1600, height: 900 },
  { label: "desktop-1920x1080", width: 1920, height: 1080 },
  { label: "desktop-large-2560x1440", width: 2560, height: 1440 },
  { label: "landscape-667x375", width: 667, height: 375 },
  { label: "landscape-844x390", width: 844, height: 390 },
  { label: "landscape-1024x768", width: 1024, height: 768 },
  { label: "landscape-1180x820", width: 1180, height: 820 },
]);

const LANDING_SCREENSHOTS = Object.freeze([
  { label: "320", width: 320, height: 568 },
  { label: "375", width: 375, height: 667 },
  { label: "390", width: 390, height: 844 },
  { label: "414", width: 414, height: 896 },
  { label: "768", width: 768, height: 1024 },
  { label: "1024", width: 1024, height: 768 },
  { label: "1440", width: 1440, height: 900 },
  { label: "1920", width: 1920, height: 1080 },
]);

const RESPONSIVE_SCREENSHOTS = Object.freeze([
  { area: "plataforma", name: "dashboard-desktop", path: "/admin/master.html", section: "dashboard", surface: "master", profile: "master", width: 1440, height: 900 },
  { area: "plataforma", name: "dashboard-tablet", path: "/admin/master.html", section: "dashboard", surface: "master", profile: "master", width: 768, height: 1024 },
  { area: "plataforma", name: "dashboard-mobile", path: "/admin/master.html", section: "dashboard", surface: "master", profile: "master", width: 390, height: 844 },
  { area: "plataforma", name: "usuarios-desktop", path: "/admin/master.html", section: "users", surface: "master", profile: "master", width: 1440, height: 900 },
  { area: "plataforma", name: "usuarios-mobile", path: "/admin/master.html", section: "users", surface: "master", profile: "master", width: 390, height: 844 },
  { area: "plataforma", name: "restaurantes-desktop", path: "/admin/master.html", section: "restaurants", surface: "master", profile: "master", width: 1440, height: 900 },
  { area: "plataforma", name: "restaurantes-mobile", path: "/admin/master.html", section: "restaurants", surface: "master", profile: "master", width: 390, height: 844 },
  { area: "plataforma", name: "financeiro-desktop", path: "/admin/master.html", section: "finance", surface: "master", profile: "master", width: 1440, height: 900 },
  { area: "plataforma", name: "financeiro-mobile", path: "/admin/master.html", section: "finance", surface: "master", profile: "master", width: 390, height: 844 },
  { area: "gestor", name: "dashboard-light-desktop", path: "/admin/", section: "dashboard", surface: "admin", profile: "owner", theme: "light", width: 1440, height: 900 },
  { area: "gestor", name: "dashboard-light-mobile", path: "/admin/", section: "dashboard", surface: "admin", profile: "owner", theme: "light", width: 390, height: 844 },
  { area: "gestor", name: "dashboard-dark-desktop", path: "/admin/", section: "dashboard", surface: "admin", profile: "owner", theme: "dark", width: 1440, height: 900 },
  { area: "gestor", name: "dashboard-dark-mobile", path: "/admin/", section: "dashboard", surface: "admin", profile: "owner", theme: "dark", width: 390, height: 844 },
  { area: "gestor", name: "pedidos-light-desktop", path: "/admin/", section: "orders", surface: "admin", profile: "owner", theme: "light", width: 1440, height: 900 },
  { area: "gestor", name: "pedidos-light-mobile", path: "/admin/", section: "orders", surface: "admin", profile: "owner", theme: "light", width: 390, height: 844 },
  { area: "gestor", name: "pedidos-dark-desktop", path: "/admin/", section: "orders", surface: "admin", profile: "owner", theme: "dark", width: 1440, height: 900 },
  { area: "gestor", name: "pedidos-dark-mobile", path: "/admin/", section: "orders", surface: "admin", profile: "owner", theme: "dark", width: 390, height: 844 },
  { area: "gestor", name: "usuarios-light-desktop", path: "/admin/", section: "users", surface: "admin", profile: "owner", theme: "light", width: 1440, height: 900 },
  { area: "gestor", name: "usuarios-light-mobile", path: "/admin/", section: "users", surface: "admin", profile: "owner", theme: "light", width: 390, height: 844 },
  { area: "gestor", name: "usuarios-dark-desktop", path: "/admin/", section: "users", surface: "admin", profile: "owner", theme: "dark", width: 1440, height: 900 },
  { area: "gestor", name: "usuarios-dark-mobile", path: "/admin/", section: "users", surface: "admin", profile: "owner", theme: "dark", width: 390, height: 844 },
  { area: "gestor", name: "configuracoes-desktop", path: "/admin/", section: "settings", surface: "admin", profile: "owner", theme: "light", width: 1440, height: 900 },
  { area: "gestor", name: "configuracoes-mobile", path: "/admin/", section: "settings", surface: "admin", profile: "owner", theme: "light", width: 390, height: 844 },
]);

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
  [".mjs", "application/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"],
  [".xml", "application/xml; charset=utf-8"],
]);

const buildMockResponse = () => {
  const headers = {};

  return {
    statusCode: 200,
    payload: null,
    headers,
    setHeader(name, value) {
      headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return payload;
    },
  };
};

const getDirectoryFingerprint = async (directoryPath) => {
  const stats = await fs.stat(directoryPath).catch(() => null);

  if (!stats) {
    return { exists: false, entries: [] };
  }

  assert.ok(stats.isDirectory(), ".data real deve ser diretorio quando existir.");
  const entries = [];

  const visit = async (currentPath, relativeBase = "") => {
    const children = await fs.readdir(currentPath, { withFileTypes: true });

    for (const child of children) {
      const childPath = path.join(currentPath, child.name);
      const relativePath = path.join(relativeBase, child.name).replace(/\\/g, "/");
      const childStats = await fs.stat(childPath);

      entries.push({
        path: relativePath,
        type: child.isDirectory() ? "dir" : "file",
        size: childStats.size,
        mtimeMs: Math.round(childStats.mtimeMs),
      });

      if (child.isDirectory()) {
        await visit(childPath, relativePath);
      }
    }
  };

  await visit(directoryPath);
  entries.sort((left, right) => left.path.localeCompare(right.path));

  return { exists: true, entries };
};

const readRequestBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => chunks.push(chunk));
    req.on("error", reject);
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });

const handleAdminApiRequest = async (adminApi, req, res) => {
  req.body = await readRequestBody(req);
  req.headers["x-forwarded-proto"] = req.headers["x-forwarded-proto"] || "http";
  const apiResponse = {
    setHeader(name, value) {
      res.setHeader(name, value);
    },
    status(code) {
      res.statusCode = code;
      return this;
    },
    json(payload) {
      if (!res.hasHeader("Content-Type")) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      }

      res.end(JSON.stringify(payload));
      return payload;
    },
  };

  await adminApi(req, apiResponse);
};

const writeJson = (res, payload, status = 200) => {
  res.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
};

const buildRestaurantSettingsPayload = () => ({
  ok: true,
  storageMode: "responsive-mock",
  settings: {
    restaurantKey: "default",
    restaurantName: "Tokyo Sushi Delivery",
    logoUrl: "./site-images/tokyo-logo-premium-transparent.png",
    bannerUrl: "./site-images/combinado-imperial.png",
    primaryColor: "#e83637",
    secondaryColor: "#f5c3d3",
    whatsapp: "5516990507398",
    siteTheme: "DARK",
    siteLayout: "MODERN",
    platformFooter: {
      showPlatformBranding: true,
      headline: "Desenvolvido por INOVAS Food",
      description: "Plataforma profissional para restaurantes",
      displayUrl: "inovasfood.com.br",
      url: "https://inovasfood.com.br",
    },
  },
});

const createStaticServer = (rootDirectory, adminApi) =>
  http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || "/", "http://127.0.0.1");

      if (requestUrl.pathname.startsWith("/api/admin")) {
        await handleAdminApiRequest(adminApi, req, res);
        return;
      }

      if (requestUrl.pathname === "/api/restaurant-settings") {
        writeJson(res, buildRestaurantSettingsPayload());
        return;
      }

      if (requestUrl.pathname === "/api/catalog") {
        writeJson(res, { ok: true, sections: [], items: [], featuredItems: [], sectionDisplayOrder: [] });
        return;
      }

      if (requestUrl.pathname === "/api/reviews") {
        writeJson(res, { ok: true, summary: { displayAverage: 5 }, reviews: [] });
        return;
      }

      if (requestUrl.pathname === "/api/delivery-settings") {
        writeJson(res, { ok: true, settings: { deliveryEnabled: true, pickupEnabled: true } });
        return;
      }

      if (requestUrl.pathname === "/api/customer/orders/active") {
        writeJson(res, { ok: true, authenticated: false, hasActiveOrder: false, order: null });
        return;
      }

      if (requestUrl.pathname.startsWith("/api/")) {
        writeJson(res, { ok: false, error: "Endpoint nao mockado na validacao responsiva." }, 404);
        return;
      }

      let pathname = decodeURIComponent(requestUrl.pathname);

      if (pathname === "/favicon.ico") {
        res.writeHead(204, { "Cache-Control": "no-store" });
        res.end();
        return;
      }

      if (pathname === "/") {
        pathname = "/index.html";
      }

      if (pathname === "/inovas") {
        pathname = "/inovas.html";
      }

      if (pathname === "/admin/" || pathname === "/admin") {
        pathname = "/admin/index.html";
      }

      if (pathname === "/admin/master") {
        pathname = "/admin/master.html";
      }

      const requestedPath = path.resolve(rootDirectory, `.${pathname}`);

      if (requestedPath !== rootDirectory && !requestedPath.startsWith(`${rootDirectory}${path.sep}`)) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Forbidden");
        return;
      }

      const stats = await fs.stat(requestedPath).catch(() => null);

      if (!stats || !stats.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }

      const extension = path.extname(requestedPath).toLowerCase();
      const contentType = MIME_TYPES.get(extension) || "application/octet-stream";
      const body = await fs.readFile(requestedPath);

      res.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": contentType,
      });
      res.end(body);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(String(error?.stack || error?.message || "Internal server error"));
    }
  });

const listen = (server) =>
  new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        host: "127.0.0.1",
        port: Number(address.port),
      });
    });
  });

const closeServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

const runAdminApi = async (adminApi, { method = "GET", url, body = null, cookie = "", ip = "127.0.18.1" }) => {
  const req = {
    method,
    url,
    headers: {
      host: "localhost:3000",
      "x-forwarded-for": ip,
      "x-forwarded-proto": "http",
      accept: "application/json",
      "user-agent": "validate-responsive-platform-local",
      ...(cookie ? { cookie } : {}),
    },
    socket: { remoteAddress: ip },
    body: body === null ? "" : JSON.stringify(body),
  };
  const res = buildMockResponse();

  await adminApi(req, res);
  return res;
};

const extractCookieHeader = (response) => {
  const setCookie = String(response.headers["Set-Cookie"] || response.headers["set-cookie"] || "");
  return setCookie.split(";")[0];
};

const parseCookieHeader = (cookieHeader) => {
  const [name, ...valueParts] = String(cookieHeader || "").split("=");
  return {
    name,
    value: valueParts.join("="),
  };
};

const loginApi = async (adminApi, profile, next = "/admin/", ip = "127.0.18.1") => {
  const response = await runAdminApi(adminApi, {
    method: "POST",
    url: "http://localhost:3000/api/admin/login",
    ip,
    body: {
      identifier: profile.login,
      password: profile.password,
      next,
    },
  });

  assert.equal(response.statusCode, 200, `Login responsivo deveria funcionar para ${profile.login}.`);
  const cookie = extractCookieHeader(response);

  assert.ok(cookie, `Login responsivo deveria emitir cookie para ${profile.login}.`);

  return { response, cookie };
};

const createManagedUser = async (adminApi, sessionCookie, profile) => {
  const restaurantUserTypes = new Set(["OWNER", "GERENTE", "CAIXA", "COZINHA", "ESTOQUE", "ENTREGADOR"]);
  const phoneSuffix = String(Math.abs(profile.login.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0))).slice(0, 4).padStart(4, "0");
  const response = await runAdminApi(adminApi, {
    method: "POST",
    url: "http://localhost:3000/api/admin/users/save",
    cookie: sessionCookie,
    body: {
      user: {
        login: profile.login,
        email: profile.login,
        name: `${profile.userType} Responsive`,
        password: profile.password,
        phone: restaurantUserTypes.has(profile.userType) ? `55119999${phoneSuffix}` : "",
        restaurantKey: restaurantUserTypes.has(profile.userType) ? "default" : "",
        status: "ACTIVE",
        userType: profile.userType,
      },
    },
  });

  assert.equal(response.statusCode, 200, `Usuario ${profile.userType} deveria ser criado.`);
  return response.payload?.user || null;
};

const seedUsersAndSessions = async (adminApi) => {
  const sessions = {};
  const master = await loginApi(adminApi, PROFILE_FIXTURES.master, "/admin/master.html", "127.0.18.1");
  const owner = await loginApi(adminApi, PROFILE_FIXTURES.owner, "/admin/", "127.0.18.2");
  const systemUserTypes = new Set(["MASTER", "SOCIO", "DESENVOLVEDOR", "SUPORTE", "VENDEDOR"]);

  sessions.master = master.cookie;
  sessions.owner = owner.cookie;

  let profileIndex = 3;
  for (const [key, profile] of Object.entries(PROFILE_FIXTURES)) {
    if (["master", "owner"].includes(key)) {
      continue;
    }

    if (!systemUserTypes.has(profile.userType)) {
      await createManagedUser(adminApi, owner.cookie, profile);
    }
    sessions[key] = (await loginApi(adminApi, profile, "/admin/", `127.0.18.${profileIndex}`)).cookie;
    profileIndex += 1;
  }

  return sessions;
};

const attachCollectors = (page, baseURL) => {
  const state = {
    consoleErrors: [],
    pageErrors: [],
    failedResponses: [],
  };

  page.on("console", (message) => {
    if (message.type() === "error") {
      state.consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    state.pageErrors.push(String(error?.message || error));
  });
  page.on("response", (response) => {
    const url = response.url();

    if (url.startsWith(baseURL) && response.status() >= 400) {
      state.failedResponses.push(`${response.status()} ${url}`);
    }
  });

  return state;
};

const waitForSettled = async (page) => {
  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(350);
};

const clickAdminSection = async (page, section) => {
  if (!section) {
    return;
  }

  const currentSection = await page.evaluate(() => document.body.dataset.adminSection || "").catch(() => "");

  if (currentSection === section) {
    await waitForSettled(page);
    return;
  }

  const selector = `[data-admin-nav] [data-admin-section="${section}"]`;
  await page.locator(selector).first().waitFor({ state: "visible", timeout: 12000 });
  await page.locator(selector).first().click({ force: true });
  await page.waitForFunction((expectedSection) => document.body.dataset.adminSection === expectedSection, section, {
    timeout: 12000,
  });
  await waitForSettled(page);
};

const clickMasterSection = async (page, section) => {
  if (!section) {
    return false;
  }

  const selector = `[data-master-section-button="${section}"]`;
  let recoveredRestrictedState = false;
  const hasInitialButtons = await page
    .waitForFunction(() => document.querySelectorAll("[data-master-section-button]").length > 0, null, {
      timeout: 5000,
    })
    .then(() => true)
    .catch(() => false);

  if (!hasInitialButtons) {
    const overview = await page
      .evaluate(async () => {
        const response = await fetch("/api/admin/master/overview", { credentials: "include" });
        const payload = await response.json().catch(() => null);
        return { status: response.status, menuCount: payload?.menu?.length || 0 };
      })
      .catch(() => null);

    if (overview?.status === 200 && overview.menuCount > 0) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForSettled(page);
      recoveredRestrictedState = true;
    }
  }

  await page.waitForFunction(
    () => document.querySelectorAll("[data-master-section-button]").length > 0,
    null,
    { timeout: 15000 }
  );
  await page.locator(selector).first().waitFor({ state: "attached", timeout: 12000 });
  await page.locator(selector).first().evaluate((button) => button.click());
  await page.waitForFunction((expectedSection) => document.body.dataset.masterSection === expectedSection, section, {
    timeout: 12000,
  });
  await waitForSettled(page);
  return recoveredRestrictedState;
};

const getCriticalSelectors = (surface) => {
  if (surface === "landing") {
    return [".if-header", ".if-brand img", ".if-hero", ".if-hero-actions", ".if-footer"];
  }

  if (surface === "master") {
    return [".master-sidebar", ".master-main", "[data-master-content]", ".master-topbar"];
  }

  return [".admin-sidebar", ".admin-main-shell", "[data-admin-module-content]", "[data-admin-main-intro]"];
};

const collectMetrics = async (page, criticalSelectors) =>
  page.evaluate((selectors) => {
    const isVisibleNode = (node) => {
      if (!(node instanceof HTMLElement) && !(node instanceof SVGElement)) {
        return false;
      }

      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);

      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0
      );
    };

    const rectFor = (selector) => {
      const node = document.querySelector(selector);

      if (!node) {
        return { selector, exists: false };
      }

      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);

      return {
        selector,
        exists: true,
        visible: isVisibleNode(node),
        x: Number(rect.x.toFixed(2)),
        y: Number(rect.y.toFixed(2)),
        right: Number(rect.right.toFixed(2)),
        bottom: Number(rect.bottom.toFixed(2)),
        width: Number(rect.width.toFixed(2)),
        height: Number(rect.height.toFixed(2)),
        display: style.display,
        opacity: Number(style.opacity),
        visibility: style.visibility,
        position: style.position,
      };
    };

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);

    const wideElements = Array.from(document.body.querySelectorAll("*"))
      .filter((node) => isVisibleNode(node))
      .map((node) => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        const label =
          node.getAttribute("data-admin-section") ||
          node.getAttribute("data-master-section-button") ||
          node.getAttribute("class") ||
          node.tagName.toLowerCase();

        return {
          tagName: node.tagName.toLowerCase(),
          label: String(label).slice(0, 120),
          position: style.position,
          left: Number(rect.left.toFixed(2)),
          right: Number(rect.right.toFixed(2)),
          width: Number(rect.width.toFixed(2)),
        };
      })
      .filter((entry) => entry.position !== "fixed" && (entry.left < -2 || entry.right > viewportWidth + 2))
      .slice(0, 15);

    const smallTargets = Array.from(
      document.querySelectorAll(
        'a, button, input, select, textarea, label, [role="button"], [tabindex]:not([tabindex="-1"])'
      )
    )
      .filter((node) => isVisibleNode(node))
      .filter((node) => !(node instanceof HTMLInputElement && node.type === "hidden"))
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          tagName: node.tagName.toLowerCase(),
          label:
            node.getAttribute("aria-label") ||
            node.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) ||
            node.getAttribute("href") ||
            String(node.getAttribute("class") || "").slice(0, 80),
          width: Number(rect.width.toFixed(2)),
          height: Number(rect.height.toFixed(2)),
        };
      })
      .filter((entry) => entry.width > 0 && entry.height > 0 && (entry.width < 36 || entry.height < 36))
      .slice(0, 20);

    return {
      url: window.location.pathname,
      title: document.title,
      bodyClass: document.body.className,
      dataset: { ...document.body.dataset },
      viewportWidth,
      viewportHeight,
      scrollWidth,
      scrollHeight,
      horizontalOverflow: scrollWidth > viewportWidth + 2,
      critical: selectors.map(rectFor),
      wideElements,
      smallTargets,
    };
  }, criticalSelectors);

const assertResponsiveResult = (result) => {
  assert.equal(
    result.metrics.horizontalOverflow,
    false,
    `${result.label} gerou overflow horizontal: scrollWidth=${result.metrics.scrollWidth}, viewport=${result.metrics.viewportWidth}. Elementos: ${JSON.stringify(result.metrics.wideElements)}`
  );

  for (const item of result.metrics.critical) {
    assert.equal(item.exists, true, `${result.label} nao encontrou elemento critico ${item.selector}.`);
    assert.equal(
      item.visible,
      true,
      `${result.label} deixou elemento critico invisivel ${item.selector}: ${JSON.stringify(item)}.`
    );
  }

  assert.deepEqual(result.consoleErrors, [], `${result.label} gerou console.error.`);
  assert.deepEqual(result.pageErrors, [], `${result.label} gerou pageerror.`);
  assert.deepEqual(result.failedResponses, [], `${result.label} teve resposta local 4xx/5xx.`);
};

const openResponsivePage = async ({
  browser,
  baseURL,
  sessions,
  path: pathname,
  viewport,
  profile,
  theme = "light",
  surface,
  section,
  screenshotPath = "",
  label,
}) => {
  const context = await browser.newContext({
    baseURL,
    deviceScaleFactor: 1,
    hasTouch: viewport.width < 900,
    isMobile: viewport.width < 900,
    serviceWorkers: "block",
    viewport: {
      width: viewport.width,
      height: viewport.height,
    },
  });

  await context.addInitScript(
    ({ themeValue, storageKey }) => {
      window.localStorage.setItem(storageKey, themeValue);
    },
    { themeValue: theme, storageKey: ADMIN_THEME_STORAGE_KEY }
  );

  const cookie = sessions?.[profile] || "";
  if (cookie) {
    const parsedCookie = parseCookieHeader(cookie);
    await context.addCookies([
      {
        name: parsedCookie.name,
        value: parsedCookie.value,
        url: baseURL,
      },
    ]);
  }

  const page = await context.newPage();
  const collectors = attachCollectors(page, baseURL);

  try {
    const response = await page.goto(`${baseURL}${pathname}`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    assert.ok(response?.ok(), `${label} falhou ao carregar ${pathname}.`);
    await waitForSettled(page);

    if (surface === "master") {
      await page.locator("[data-master-nav]").waitFor({ state: "visible", timeout: 12000 });
      const recoveredMasterState = await clickMasterSection(page, section);
      if (recoveredMasterState) {
        collectors.consoleErrors.length = 0;
        collectors.pageErrors.length = 0;
        collectors.failedResponses.length = 0;
      }
    } else if (surface === "admin") {
      await page.locator("[data-admin-nav]").waitFor({ state: "visible", timeout: 12000 });
      await clickAdminSection(page, section);
    }

    if (screenshotPath) {
      await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: true, animations: "disabled" });
    }

    const metrics = await collectMetrics(page, getCriticalSelectors(surface));
    const result = {
      label,
      area: surface,
      path: pathname,
      section: section || "",
      theme,
      profile: profile || "",
      viewport,
      screenshot: screenshotPath ? path.relative(workspaceRoot, screenshotPath).replace(/\\/g, "/") : "",
      metrics,
      ...collectors,
    };

    try {
      assertResponsiveResult(result);
    } catch (error) {
      const failureName = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const failureScreenshot = path.join(auditRoot, "failures", `${failureName}.png`);
      await fs.mkdir(path.dirname(failureScreenshot), { recursive: true });
      await page.screenshot({ path: failureScreenshot, fullPage: true, animations: "disabled" }).catch(() => {});
      error.message = `${error.message} Screenshot: ${path.relative(workspaceRoot, failureScreenshot).replace(/\\/g, "/")}`;
      throw error;
    }

    return result;
  } finally {
    await context.close();
  }
};

const runMatrix = async ({ browser, baseURL, sessions }) => {
  const results = [];

  for (const viewport of REQUIRED_BREAKPOINTS) {
    results.push(
      await openResponsivePage({
        browser,
        baseURL,
        sessions,
        path: "/inovas.html",
        viewport,
        profile: "",
        surface: "landing",
        label: `matrix landing ${viewport.label}`,
      })
    );

    results.push(
      await openResponsivePage({
        browser,
        baseURL,
        sessions,
        path: "/admin/master.html",
        viewport,
        profile: "master",
        surface: "master",
        section: "dashboard",
        label: `matrix plataforma dashboard ${viewport.label}`,
      })
    );

    for (const theme of ["light", "dark"]) {
      results.push(
        await openResponsivePage({
          browser,
          baseURL,
          sessions,
          path: "/admin/",
          viewport,
          profile: "owner",
          surface: "admin",
          section: "orders",
          theme,
          label: `matrix gestor pedidos ${theme} ${viewport.label}`,
        })
      );
    }
  }

  return results;
};

const runScreenshots = async ({ browser, baseURL, sessions }) => {
  const results = [];

  for (const viewport of LANDING_SCREENSHOTS) {
    results.push(
      await openResponsivePage({
        browser,
        baseURL,
        sessions,
        path: "/inovas.html",
        viewport,
        profile: "",
        surface: "landing",
        screenshotPath: path.join(auditRoot, "landing", `landing-${viewport.label}.png`),
        label: `screenshot landing ${viewport.label}`,
      })
    );
  }

  for (const item of RESPONSIVE_SCREENSHOTS) {
    results.push(
      await openResponsivePage({
        browser,
        baseURL,
        sessions,
        path: item.path,
        viewport: { width: item.width, height: item.height },
        profile: item.profile,
        surface: item.surface,
        section: item.section,
        theme: item.theme || "light",
        screenshotPath: path.join(auditRoot, item.area, `${item.name}.png`),
        label: `screenshot ${item.area} ${item.name}`,
      })
    );
  }

  return results;
};

const writeAuditReport = async (payload) => {
  await fs.mkdir(auditRoot, { recursive: true });
  await fs.writeFile(reportJsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

const run = async () => {
  const originalCwd = process.cwd();
  const originalEnv = {
    ADMIN_LOGIN: process.env.ADMIN_LOGIN,
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_DISPLAY_NAME: process.env.ADMIN_DISPLAY_NAME,
    ADMIN_USERS: process.env.ADMIN_USERS,
    ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
    NODE_ENV: process.env.NODE_ENV,
  };
  const beforeRealData = await getDirectoryFingerprint(realDataDirectory);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tokyo-responsive-validation-"));

  let server;
  let browser;

  try {
    await fs.rm(auditRoot, { recursive: true, force: true });
    await fs.mkdir(path.join(tempRoot, ".data"), { recursive: true });
    process.chdir(tempRoot);
    process.env.NODE_ENV = "development";
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.ADMIN_USERS;
    delete process.env.ADMIN_PASSWORD;

    const adminAuth = require(path.join(workspaceRoot, "lib/admin-auth.cjs"));

    process.env.ADMIN_LOGIN = PROFILE_FIXTURES.master.login;
    process.env.ADMIN_PASSWORD_HASH = adminAuth.createPasswordHash(PROFILE_FIXTURES.master.password);
    process.env.ADMIN_DISPLAY_NAME = "Master INOVAS Food";
    process.env.ADMIN_SESSION_SECRET = "segredo-local-responsive-platform";
    const configuredProfileKeys = [
      "master",
      "owner",
      "socio",
      "desenvolvedor",
      "suporte",
      "vendedor",
    ];
    process.env.ADMIN_USERS = JSON.stringify(
      configuredProfileKeys.map((key) => {
        const profile = PROFILE_FIXTURES[key];
        const restaurantUser = key === "owner";
        return {
          login: profile.login,
          displayName: `${profile.userType} Responsive`,
          passwordHash: adminAuth.createPasswordHash(profile.password),
          userType: profile.userType,
          platformScope: !restaurantUser,
          ...(restaurantUser
            ? {
                restaurantKey: "default",
                tenantId: "tenant_default",
                restaurantId: "restaurant_default",
              }
            : {}),
        };
      })
    );

    const adminApi = require(path.join(workspaceRoot, "lib/admin-api.cjs"));
    const sessions = await seedUsersAndSessions(adminApi);

    server = createStaticServer(workspaceRoot, adminApi);
    const address = await listen(server);
    const baseURL = `http://${address.host}:${address.port}`;
    browser = await chromium.launch({ headless: true });

    const startedAt = new Date().toISOString();
    const matrixResults = await runMatrix({ browser, baseURL, sessions });
    const screenshotResults = await runScreenshots({ browser, baseURL, sessions });
    const afterRealData = await getDirectoryFingerprint(realDataDirectory);

    assert.deepEqual(afterRealData, beforeRealData, "Validacao responsiva nao deve alterar .data real.");

    const payload = {
      ok: true,
      generatedAt: new Date().toISOString(),
      startedAt,
      breakpoints: REQUIRED_BREAKPOINTS,
      summary: {
        matrixScenarios: matrixResults.length,
        screenshotScenarios: screenshotResults.length,
        screenshots: screenshotResults.filter((item) => item.screenshot).length,
        consoleErrors: 0,
        pageErrors: 0,
        failedResponses: 0,
        horizontalOverflow: 0,
      },
      matrixResults,
      screenshotResults,
    };

    await writeAuditReport(payload);
    console.log(
      `validate:responsive-platform-local OK - ${matrixResults.length} cenarios de matriz, ${screenshotResults.length} evidencias e ${payload.summary.screenshots} screenshots.`
    );
  } catch (error) {
    await writeAuditReport({
      ok: false,
      generatedAt: new Date().toISOString(),
      error: String(error?.stack || error?.message || error),
    }).catch(() => {});
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }

    if (server) {
      await closeServer(server);
    }

    process.chdir(originalCwd);

    Object.entries(originalEnv).forEach(([key, value]) => {
      if (typeof value === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });

    await fs.rm(tempRoot, { recursive: true, force: true });
  }
};

run().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
