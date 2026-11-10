"use strict";

// Single source of truth for what the INOVAS deployment may serve as static
// content. Used by:
//   - scripts/build-public.mjs        (allowlist copy into ./public)
//   - scripts/validate-public-build.mjs (automated audit of the build output)
//   - middleware.js                    (defense in depth: 404 for private paths)
//   - scripts/local-validation-server.cjs (tests see the same surface)
// Serverless functions in /api keep bundling ./lib from the repository root;
// nothing here restricts what functions can require.

const PUBLIC_DIRECTORIES = Object.freeze([
  "admin",
  "system",
  "assets",
  "site-images",
  "menu_pdf_images",
]);

// Browser-facing modules that intentionally live in lib/.
const PUBLIC_LIB_FILES = Object.freeze(["lib/business-hours.cjs"]);

const PUBLIC_ROOT_EXTENSIONS = Object.freeze([
  ".html",
  ".css",
  ".js",
  ".txt",
  ".xml",
  ".webmanifest",
  ".ico",
  ".png",
  ".svg",
  ".jpg",
  ".jpeg",
  ".webp",
]);

// Root-level files that match a public extension but are server/tooling code.
const PRIVATE_ROOT_FILES = Object.freeze([
  "middleware.js",
  "playwright.config.cjs",
]);

const PRIVATE_PREFIXES = Object.freeze([
  "lib/",
  "scripts/",
  "docs/",
  "migrations/",
  "tests/",
  "node_modules/",
  "artifacts/",
  "test-results/",
  "playwright-report/",
  "menu_pdf_crops/",
]);

const PRIVATE_EXTENSIONS = Object.freeze([
  ".md",
  ".sql",
  ".patch",
  ".log",
  ".env",
  ".pem",
  ".key",
  ".mjs",
]);

const PRIVATE_EXACT_FILES = Object.freeze([
  "package.json",
  "package-lock.json",
  "vercel.json",
  "site.config.json",
  "playwright.config.cjs",
  "middleware.js",
]);

const normalizeRelativePath = (value) => {
  let decoded = String(value || "");
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // keep raw value; malformed escapes are treated as private below
  }
  return decoded
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/");
};

const extensionOf = (relativePath) => {
  const base = relativePath.split("/").pop() || "";
  const index = base.lastIndexOf(".");
  return index > 0 ? base.slice(index).toLowerCase() : "";
};

// /.well-known/ is reserved for domain/certificate verification and stays reachable.
const hasHiddenOrTemporarySegment = (relativePath) =>
  relativePath
    .split("/")
    .some(
      (segment, index) =>
        (segment.startsWith(".") && !(index === 0 && segment === ".well-known")) ||
        segment.toLowerCase().startsWith("_tmp")
    );

// True when a URL pathname must never be served as a static file.
const isPrivateStaticPath = (pathname) => {
  const relativePath = normalizeRelativePath(pathname);
  const lower = relativePath.toLowerCase();

  if (!relativePath) return false;
  if (relativePath.includes("..")) return true;
  if (PUBLIC_LIB_FILES.includes(lower)) return false;
  if (lower.startsWith("api/")) return false; // serverless functions, never static
  if (hasHiddenOrTemporarySegment(relativePath)) return true;
  if (PRIVATE_PREFIXES.some((prefix) => lower === prefix.slice(0, -1) || lower.startsWith(prefix))) {
    return true;
  }
  if (PRIVATE_EXACT_FILES.includes(lower)) return true;
  if (PRIVATE_EXTENSIONS.includes(extensionOf(lower))) return true;
  return false;
};

// True when a repository file (relative path) belongs in the public build.
const isPublicBuildFile = (relativeFilePath) => {
  const relativePath = normalizeRelativePath(relativeFilePath);
  const lower = relativePath.toLowerCase();

  if (!relativePath || isPrivateStaticPath(relativePath)) return false;
  if (PUBLIC_LIB_FILES.includes(lower)) return true;

  if (!relativePath.includes("/")) {
    return (
      PUBLIC_ROOT_EXTENSIONS.includes(extensionOf(lower)) &&
      !PRIVATE_ROOT_FILES.includes(lower)
    );
  }

  const [topLevel] = relativePath.split("/");
  return PUBLIC_DIRECTORIES.includes(topLevel);
};

module.exports = {
  PUBLIC_DIRECTORIES,
  PUBLIC_LIB_FILES,
  PRIVATE_PREFIXES,
  PRIVATE_EXACT_FILES,
  isPrivateStaticPath,
  isPublicBuildFile,
  normalizeRelativePath,
};
