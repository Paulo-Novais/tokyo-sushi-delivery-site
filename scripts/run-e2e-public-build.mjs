// Runs the Playwright suite against the production static build (./public),
// so navigation/login are verified with exactly what Vercel will publish.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPublic } from "./build-public.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const copied = buildPublic(path.join(repoRoot, "public"));
console.log(`[e2e:public-build] ${copied.length} arquivos publicos; servindo de ./public`);

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const args = ["playwright", "test", ...process.argv.slice(2)];
const result = spawnSync(process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : npx,
  process.platform === "win32" ? ["/d", "/s", "/c", [npx, ...args].join(" ")] : args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, INOVAS_STATIC_ROOT: "public" },
  });
process.exit(result.status ?? 1);
