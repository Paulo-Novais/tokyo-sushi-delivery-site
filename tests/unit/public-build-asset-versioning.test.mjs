// Cache: o vercel.json guarda no cache por muito tempo os .js/.css/.cjs pedidos
// com "?v=". Isso só é seguro se TODO HTML publicado pedir esses arquivos com
// "?v=<hash do conteúdo>"; senão o navegador ficaria com a versão velha.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { buildPublic, versionAssetReferences } from "../../scripts/build-public.mjs";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

test("versionAssetReferences adiciona ?v em .js/.css/.cjs locais", () => {
  const html = [
    '<link rel="stylesheet" href="/admin/admin.css" />',
    '<script src="/admin/admin.js" defer></script>',
    '<script src="./script.js" defer></script>',
    '<script src="/lib/business-hours.cjs"></script>',
    '<link rel="icon" href="/admin/logo.png" />',
    '<script src="/admin/ja.js?v=old"></script>',
    '<script src="https://maps.googleapis.com/maps/api/js"></script>',
  ].join("\n");
  const out = versionAssetReferences(html, (asset) => `h${asset.length}`);
  assert.match(out, /href="\/admin\/admin\.css\?v=h16"/);
  assert.match(out, /src="\/admin\/admin\.js\?v=h15"/);
  assert.match(out, /src="\.\/script\.js\?v=h11"/);
  assert.match(out, /src="\/lib\/business-hours\.cjs\?v=h23"/);
  assert.match(out, /href="\/admin\/logo\.png"/);
  assert.match(out, /src="\/admin\/ja\.js\?v=old"/);
  assert.match(out, /src="https:\/\/maps\.googleapis\.com\/maps\/api\/js"/);
});

test("build publicado: todo .js/.css/.cjs local no HTML tem ?v igual ao hash do arquivo", () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "inovas-public-"));
  try {
    const copied = buildPublic(outDir);
    let versioned = 0;
    for (const file of copied.filter((entry) => entry.endsWith(".html"))) {
      const html = fs.readFileSync(path.join(outDir, file), "utf8");
      const refs = [...html.matchAll(/\s(?:src|href)="((?:\.\/|\/)[^"#:]+\.(?:js|css|cjs)(?:\?[^"]*)?)"/g)].map(
        (match) => match[1]
      );
      for (const ref of refs) {
        const [assetPath, query = ""] = ref.split("?");
        assert.match(query, /^v=[0-9a-f]{10}$/, `${file} pede ${ref} sem versão`);
        const assetFile = assetPath.startsWith("/")
          ? path.join(outDir, assetPath.slice(1))
          : path.resolve(path.dirname(path.join(outDir, file)), assetPath);
        const expected = crypto.createHash("sha256").update(fs.readFileSync(assetFile)).digest("hex").slice(0, 10);
        assert.equal(query, `v=${expected}`, `${file}: versão de ${assetPath} não bate com o arquivo`);
        versioned += 1;
      }
    }
    assert.ok(versioned > 30, `esperava vários arquivos versionados, achei ${versioned}`);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test("imagens otimizadas: cada item da lista tem o .webp ao lado e é menor que o original", () => {
  const optimized = require("../../lib/optimized-images.cjs");
  assert.ok(optimized.length > 0);
  for (const relativePath of optimized) {
    const original = path.join(repoRoot, relativePath);
    const webp = original.replace(/\.(png|jpe?g)$/i, ".webp");
    assert.ok(fs.existsSync(original), `original sumiu: ${relativePath}`);
    assert.ok(fs.existsSync(webp), `falta o .webp de ${relativePath}`);
    assert.ok(fs.statSync(webp).size < fs.statSync(original).size, `${relativePath}: .webp não ficou menor`);
  }
});

test("imagens otimizadas: a lista do site (script.js) é a mesma do servidor", () => {
  const optimized = require("../../lib/optimized-images.cjs");
  const script = fs.readFileSync(path.join(repoRoot, "script.js"), "utf8");
  const match = script.match(/const OPTIMIZED_IMAGE_PATHS = new Set\((\[[\s\S]*?\])\);/);
  assert.ok(match, "lista OPTIMIZED_IMAGE_PATHS não encontrada em script.js");
  assert.deepEqual(JSON.parse(match[1]), [...optimized]);
});
