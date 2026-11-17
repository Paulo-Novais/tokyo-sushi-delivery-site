// Cache do Gestor/System: o vercel.json guarda .js/.css de /admin e /system
// por muito tempo. Isso só é seguro se TODO HTML publicado pedir esses arquivos
// com "?v=<hash do conteúdo>"; senão o navegador ficaria com a versão velha.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildPublic, versionAssetReferences } from "../../scripts/build-public.mjs";

test("versionAssetReferences adiciona ?v só em .js/.css de /admin e /system", () => {
  const html = [
    '<link rel="stylesheet" href="/admin/admin.css" />',
    '<script src="/admin/admin.js" defer></script>',
    '<script src="/system/system.js"></script>',
    '<script src="/site-config.js"></script>',
    '<link rel="icon" href="/admin/logo.png" />',
    '<script src="/admin/ja.js?v=old"></script>',
  ].join("\n");
  const out = versionAssetReferences(html, (asset) => `h${asset.length}`);
  assert.match(out, /href="\/admin\/admin\.css\?v=h16"/);
  assert.match(out, /src="\/admin\/admin\.js\?v=h15"/);
  assert.match(out, /src="\/system\/system\.js\?v=h17"/);
  assert.match(out, /src="\/site-config\.js"/);
  assert.match(out, /href="\/admin\/logo\.png"/);
  assert.match(out, /src="\/admin\/ja\.js\?v=old"/);
});

test("build publicado: todo .js/.css de /admin e /system no HTML tem ?v igual ao hash do arquivo", () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "inovas-public-"));
  try {
    const copied = buildPublic(outDir);
    const htmlFiles = copied.filter((file) => file.endsWith(".html"));
    let versioned = 0;
    for (const file of htmlFiles) {
      const html = fs.readFileSync(path.join(outDir, file), "utf8");
      const refs = [...html.matchAll(/\s(?:src|href)="(\/(?:admin|system)\/[^"#]+\.(?:js|css)(?:\?[^"]*)?)"/g)].map(
        (match) => match[1]
      );
      for (const ref of refs) {
        const [assetPath, query = ""] = ref.split("?");
        assert.match(query, /^v=[0-9a-f]{10}$/, `${file} pede ${ref} sem versão`);
        const expected = crypto
          .createHash("sha256")
          .update(fs.readFileSync(path.join(outDir, assetPath.slice(1))))
          .digest("hex")
          .slice(0, 10);
        assert.equal(query, `v=${expected}`, `${file}: versão de ${assetPath} não bate com o arquivo`);
        versioned += 1;
      }
    }
    assert.ok(versioned > 10, `esperava vários arquivos versionados, achei ${versioned}`);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
