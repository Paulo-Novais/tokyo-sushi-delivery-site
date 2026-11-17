"""Gera versões WebP leves das imagens pesadas do site público.

Para cada .png/.jpg acima de MIN_BYTES em site-images/, menu_pdf_images/ e
assets/, cria ao lado um .webp com no máximo MAX_WIDTH de largura. O original
continua no lugar (links antigos, prévia de redes sociais, Gestor).

Depois atualiza a lista OPTIMIZED_IMAGE_PATHS dentro de script.js (entre os
marcadores) e lib/optimized-images.cjs (usado pelo servidor), para o site
trocar a imagem pela versão .webp.

Uso: python3 scripts/optimize-images.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DIRECTORIES = ["site-images", "menu_pdf_images", "assets"]
EXTENSIONS = {".png", ".jpg", ".jpeg"}
MIN_BYTES = 100 * 1024
MAX_WIDTH = 1200
QUALITY = 80
MIN_SAVING = 0.30  # só usa o .webp se ficar ao menos 30% menor

SCRIPT = ROOT / "script.js"
START = "// <optimized-images>"
END = "// </optimized-images>"


def optimize(path: Path) -> bool:
    target = path.with_suffix(".webp")
    if target.exists() and target.stat().st_mtime >= path.stat().st_mtime:
        return target.stat().st_size <= path.stat().st_size * (1 - MIN_SAVING)
    with Image.open(path) as image:
        image.load()
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
        if image.width > MAX_WIDTH:
            height = round(image.height * MAX_WIDTH / image.width)
            image = image.resize((MAX_WIDTH, height), Image.LANCZOS)
        image.save(target, "WEBP", quality=QUALITY, method=6)
    if target.stat().st_size > path.stat().st_size * (1 - MIN_SAVING):
        target.unlink()
        return False
    return True


def main() -> None:
    optimized: list[str] = []
    before = after = 0
    for directory in DIRECTORIES:
        for path in sorted((ROOT / directory).rglob("*")):
            if path.suffix.lower() not in EXTENSIONS or path.stat().st_size < MIN_BYTES:
                continue
            if optimize(path):
                relative = path.relative_to(ROOT).as_posix()
                optimized.append(relative)
                before += path.stat().st_size
                after += path.with_suffix(".webp").stat().st_size

    block = (
        f"{START}\n"
        "// Gerado por scripts/optimize-images.py. Não editar à mão.\n"
        f"const OPTIMIZED_IMAGE_PATHS = new Set({json.dumps(optimized, indent=2)});\n"
        f"{END}"
    )
    source = SCRIPT.read_text(encoding="utf-8")
    pattern = re.compile(re.escape(START) + r".*?" + re.escape(END), re.S)
    if not pattern.search(source):
        raise SystemExit(f"Marcadores {START} / {END} não encontrados em script.js")
    SCRIPT.write_text(pattern.sub(lambda _: block, source), encoding="utf-8")
    (ROOT / "lib" / "optimized-images.cjs").write_text(
        '"use strict";\n\n'
        "// Gerado por scripts/optimize-images.py. Não editar à mão.\n"
        "// Imagens que têm versão .webp leve ao lado do original.\n"
        f"module.exports = Object.freeze({json.dumps(optimized, indent=2)});\n",
        encoding="utf-8",
    )
    print(f"{len(optimized)} imagens: {before // 1024} KB -> {after // 1024} KB")


if __name__ == "__main__":
    main()
