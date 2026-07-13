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
const { buildTenantContext } = require("../lib/tenant-context.cjs");

const defaultTenantContext = buildTenantContext(
  {
    host: "localhost",
    restaurantKey: "default",
    restaurantName: "Tokyo Sushi",
    matched: true,
    resolutionMode: "local-validation",
    multiRestaurantActive: false,
  },
  {
    source: "validate:site-layouts-local",
  }
);
const defaultTenantOptions = { tenantContext: defaultTenantContext };

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
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
]);

const getDirectoryFingerprint = async (directoryPath) => {
  const stats = await fs.stat(directoryPath).catch(() => null);

  if (!stats) {
    return { exists: false, entries: [] };
  }

  assert.ok(stats.isDirectory(), ".data real deveria ser diretorio quando existir.");
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

const handleApiRequest = async (handler, req, res) => {
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

  await handler(req, apiResponse);
};

const createStaticServer = (rootDirectory, restaurantSettingsHandler) =>
  http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || "/", "http://127.0.0.1");

      if (requestUrl.pathname === "/api/restaurant-settings") {
        await handleApiRequest(restaurantSettingsHandler, req, res);
        return;
      }

      if (requestUrl.pathname.startsWith("/api/")) {
        res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }

      let pathname = decodeURIComponent(requestUrl.pathname);

      if (pathname === "/") {
        pathname = "/index.html";
      }

      const requestedPath = path.resolve(rootDirectory, `.${pathname}`);

      if (!requestedPath.startsWith(rootDirectory)) {
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
      res.end(error?.message || "Internal server error");
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
  new Promise((resolve) => {
    server.close(() => resolve());
  });

const saveAppearance = async (store, patch) => {
  const defaults = store.getDefaultRestaurantSettings();

  return store.updateRestaurantSettings(
    {
      settings: {
        ...defaults,
        ...patch,
      },
    },
    {
      login: "usermaster@inovas.com",
      displayName: "MASTER INOVAS Food",
    },
    defaultTenantOptions
  );
};

const validateStaticContracts = async () => {
  const siteConfig = JSON.parse(await fs.readFile(path.join(workspaceRoot, "site.config.json"), "utf8"));
  const adminJs = await fs.readFile(path.join(workspaceRoot, "admin", "admin.js"), "utf8");
  const publicJs = await fs.readFile(path.join(workspaceRoot, "script.js"), "utf8");

  assert.equal(siteConfig.primaryDomain, "tokyosushidelivery.com.br", "Dominio principal nao deve mudar.");
  assert.equal(siteConfig.companyWebsite, "https://tokyosushidelivery.com.br");
  assert.equal(siteConfig.siteAppearance.layout, "MODERN");
  assert.equal(siteConfig.siteAppearance.platformFooter.showPlatformBranding, true);
  assert.ok(adminJs.includes("data-site-appearance-preview"), "Gestor deve possuir preview de aparencia.");
  assert.ok(publicJs.includes("data-platform-branding"), "Site publico deve renderizar rodape INOVAS.");
};

const validateStoreContracts = async (store) => {
  const defaults = store.getDefaultRestaurantSettings();

  assert.equal(defaults.restaurantKey, "default");
  assert.equal(defaults.siteLayout, "MODERN");
  assert.equal(defaults.siteTheme, "DARK");
  assert.equal(defaults.platformFooter.showPlatformBranding, true);

  const saved = await saveAppearance(store, {
    siteLayout: "CATALOGO",
    siteTheme: "DARK",
    primaryColor: "#123456",
    secondaryColor: "#abcdef",
    accentColor: "#fedcba",
    gradientStart: "#123456",
    gradientEnd: "#654321",
    useGradient: true,
    slogan: "Sabor modelo",
    description: "Restaurante modelo da futura plataforma INOVAS Food.",
    instagram: "https://instagram.com/tokyo.layout",
    facebook: "https://facebook.com/tokyo.layout",
    tiktok: "https://tiktok.com/@tokyo.layout",
    site: "https://tokyosushidelivery.com.br",
    seoTitle: "Tokyo Layout Test",
    seoDescription: "Descricao SEO da validacao de layouts.",
    seoShareImage: "/site-images/combinado-imperial.png",
    seoKeywords: ["layout", "tema", "inovas"],
    seoOpenGraph: {
      title: "OpenGraph Layout Test",
      description: "OpenGraph da validacao.",
      image: "/site-images/combinado-imperial.png",
      type: "website",
    },
  });

  assert.equal(saved.settings.restaurantKey, "default");
  assert.equal(saved.settings.siteLayout, "CATALOGO");
  assert.equal(saved.settings.appearance.layout, "CATALOGO");
  assert.equal(saved.settings.appearance.colors.accent, "#fedcba");

  const publicPayload = await store.getPublicRestaurantSettings(defaultTenantOptions);

  assert.equal(publicPayload.settings.restaurantKey, "default");
  assert.equal(publicPayload.settings.siteLayout, "CATALOGO");
  assert.equal(publicPayload.settings.siteTheme, "DARK");
  assert.equal(publicPayload.settings.seoTitle, "Tokyo Layout Test");
  assert.equal(publicPayload.settings.platformFooter.brandName, "INOVAS Food");
};

const validateBrowserContracts = async ({ baseUrl, store }) => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

  try {
    await page.goto(`${baseUrl}/cardapio.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.siteLayout === "catalogo");

    let state = await page.evaluate(() => ({
      layout: document.documentElement.dataset.siteLayout,
      theme: document.documentElement.dataset.siteTheme,
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || "",
      keywords: document.querySelector('meta[name="keywords"]')?.content || "",
      footer: document.querySelector("[data-platform-branding]")?.textContent || "",
      navCount: document.querySelectorAll("[data-public-layout-nav] a").length,
    }));

    assert.equal(state.layout, "catalogo");
    assert.equal(state.theme, "dark");
    assert.ok(state.title.includes("Tokyo Layout Test"));
    assert.equal(state.description, "Descricao SEO da validacao de layouts.");
    assert.ok(state.keywords.includes("inovas"));
    assert.ok(state.footer.includes("Desenvolvido por INOVAS Food"));
    assert.ok(state.navCount > 3, "Navegacao de categorias deve existir.");

    await saveAppearance(store, {
      siteLayout: "PREMIUM",
      siteTheme: "LIGHT",
      seoTitle: "Tokyo Premium Test",
      seoDescription: "Descricao SEO premium.",
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.siteLayout === "premium");

    state = await page.evaluate(() => ({
      layout: document.documentElement.dataset.siteLayout,
      theme: document.documentElement.dataset.siteTheme,
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || "",
      footer: document.querySelector("[data-platform-branding]")?.textContent || "",
    }));

    assert.equal(state.layout, "premium");
    assert.equal(state.theme, "light");
    assert.ok(state.title.includes("Tokyo Premium Test"));
    assert.equal(state.description, "Descricao SEO premium.");
    assert.ok(state.footer.includes("Plataforma profissional para restaurantes"));
  } finally {
    await browser.close();
  }
};

const main = async () => {
  const originalCwd = process.cwd();
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const beforeFingerprint = await getDirectoryFingerprint(realDataDirectory);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tokyo-site-layouts-"));
  let server = null;

  try {
    process.chdir(tempRoot);
    process.env.NODE_ENV = "test";
    delete process.env.DATABASE_URL;

    const store = require("../lib/restaurant-settings-store.cjs");
    const restaurantSettingsHandler = require("../api/restaurant-settings.js");

    await validateStaticContracts();
    await validateStoreContracts(store);

    server = createStaticServer(workspaceRoot, restaurantSettingsHandler);
    const address = await listen(server);
    await validateBrowserContracts({
      baseUrl: `http://${address.host}:${address.port}`,
      store,
    });
  } finally {
    if (server) {
      await closeServer(server);
    }

    process.chdir(originalCwd);

    if (typeof originalNodeEnv === "undefined") {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (typeof originalDatabaseUrl === "undefined") {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    await fs.rm(tempRoot, { recursive: true, force: true });
  }

  const afterFingerprint = await getDirectoryFingerprint(realDataDirectory);
  assert.deepEqual(afterFingerprint, beforeFingerprint, "Validacao nao deve tocar .data real.");

  console.log("validate:site-layouts-local OK");
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
