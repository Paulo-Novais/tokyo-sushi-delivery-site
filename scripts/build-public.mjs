// Builds ./public with ONLY the files the browser needs (allowlist from
// lib/public-surface-policy.cjs). Vercel serves static content from
// "outputDirectory": "public"; serverless functions in /api still bundle
// ./lib from the repository root.
//
// Usage: node scripts/build-public.mjs [--out <dir>]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { isPublicBuildFile } = require("../lib/public-surface-policy.cjs");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outArgIndex = process.argv.indexOf("--out");
const outDir = path.resolve(
  repoRoot,
  outArgIndex > -1 ? process.argv[outArgIndex + 1] : "public"
);

const SKIP_WALK = new Set([".git", "node_modules", ".vercel", ".data", ".tmp", "public"]);

const walk = (dir, results = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_WALK.has(entry.name) && dir === repoRoot) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) walk(absolute, results);
    else if (entry.isFile()) results.push(path.relative(repoRoot, absolute).split(path.sep).join("/"));
  }
  return results;
};

export const buildPublic = (targetDir = outDir) => {
  if (path.resolve(targetDir) === repoRoot) {
    throw new Error("Refusing to build public output into the repository root.");
  }
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });

  const copied = [];
  for (const relativePath of walk(repoRoot)) {
    if (!isPublicBuildFile(relativePath)) continue;
    const destination = path.join(targetDir, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, relativePath), destination);
    copied.push(relativePath);
  }
  return copied;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const copied = buildPublic();
  console.log(`[build-public] ${copied.length} arquivos publicos em ${path.relative(repoRoot, outDir) || "."}`);
}
