from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
HTML_FILES = [
    "index.html",
    "cardapio.html",
    "entrega.html",
    "historico.html",
    "avaliar.html",
    "trabalhe-conosco.html",
    "404.html",
]
SITEMAP_FILES = [file_name for file_name in HTML_FILES if file_name != "404.html"]


def read_json(file_path: Path) -> dict:
    return json.loads(file_path.read_text(encoding="utf-8"))


def normalize_domain(value: object) -> str:
    domain = str(value or "").strip().lower()
    domain = re.sub(r"^https?://", "", domain)
    return domain.rstrip("/")


def normalize_domain_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []

    return [domain for domain in (normalize_domain(item) for item in value) if domain]


def normalize_pathname(value: object) -> str:
    pathname = str(value or "/").strip()

    if not pathname or pathname == "/":
        return "/"

    return pathname if pathname.startswith("/") else f"/{pathname}"


def build_origin(domain: str) -> str:
    return f"https://{domain}"


def build_url(origin: str, pathname: str) -> str:
    normalized_pathname = normalize_pathname(pathname)
    return f"{origin}/" if normalized_pathname == "/" else f"{origin}{normalized_pathname}"


def get_page_pathname(file_name: str) -> str:
    if file_name in {"index.html", "404.html"}:
        return "/"

    return f"/{file_name}"


def replace_or_raise(
    text: str,
    pattern: str,
    replacement: str,
    label: str,
    file_name: str,
    flags: int = 0,
) -> str:
    updated_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)

    if count == 0:
        raise RuntimeError(f"Nao encontrei {label} em {file_name}.")

    return updated_text


def write_generated_file(relative_path: str, content: str) -> None:
    (ROOT_DIR / relative_path).write_text(content, encoding="utf-8")


def build_runtime_config(site_config: dict) -> dict:
    primary_domain = normalize_domain(site_config.get("primaryDomain"))

    if not primary_domain:
        raise RuntimeError("site.config.json precisa definir primaryDomain.")

    alternate_domains = [
        domain
        for domain in normalize_domain_list(site_config.get("alternateDomains"))
        if domain != primary_domain
    ]
    social_image_path = normalize_pathname(site_config.get("socialImagePath"))
    primary_origin = build_origin(primary_domain)

    return {
        "siteName": str(site_config.get("siteName") or "").strip(),
        "primaryDomain": primary_domain,
        "primaryOrigin": primary_origin,
        "alternateDomains": alternate_domains,
        "allowedHostnames": [primary_domain, *alternate_domains],
        "googleMapsAllowedReferrers": [
            f"{primary_origin}/*",
            *[f"{build_origin(domain)}/*" for domain in alternate_domains],
        ],
        "socialImagePath": social_image_path,
        "socialImageUrl": build_url(primary_origin, social_image_path),
    }


def build_site_runtime_config_file(runtime_config: dict) -> str:
    config_json = json.dumps(runtime_config, indent=2, ensure_ascii=False)
    return f"""(() => {{
  const config = Object.freeze({config_json});

  const normalizePathname = (value = "/") => {{
    const pathname = String(value || "/").trim();

    if (!pathname || pathname === "/") {{
      return "/";
    }}

    return pathname.startsWith("/") ? pathname : `/${{pathname}}`;
  }};

  const normalizeOrigin = (value = "") =>
    String(value || "")
      .trim()
      .replace(/\\/+$/, "");

  const buildUrl = (pathname = "/", origin = config.primaryOrigin) => {{
    const normalizedOrigin = normalizeOrigin(origin);
    const normalizedPathname = normalizePathname(pathname);

    if (!normalizedOrigin) {{
      return normalizedPathname;
    }}

    return normalizedPathname === "/" ? `${{normalizedOrigin}}/` : `${{normalizedOrigin}}${{normalizedPathname}}`;
  }};

  window.TOKYO_SITE_CONFIG = config;
  window.getTokyoSiteUrl = buildUrl;
}})();
"""


def build_robots_file(runtime_config: dict) -> str:
    return (
        "User-agent: *\n"
        "Allow: /\n\n"
        f"Sitemap: {runtime_config['primaryOrigin']}/sitemap.xml\n"
    )


def build_sitemap_file(runtime_config: dict) -> str:
    urls = "\n".join(
        [
            "  <url>\n"
            f"    <loc>{build_url(runtime_config['primaryOrigin'], get_page_pathname(file_name))}</loc>\n"
            "  </url>"
            for file_name in SITEMAP_FILES
        ]
    )

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{urls}\n"
        "</urlset>\n"
    )


def build_vercel_config(runtime_config: dict) -> str:
    vercel_config = {
        "$schema": "https://openapi.vercel.sh/vercel.json",
        "headers": [
            {
                "source": "/(.*)",
                "has": [{"type": "host", "value": {"suf": ".vercel.app"}}],
                "headers": [{"key": "X-Robots-Tag", "value": "noindex"}],
            },
            {
                "source": "/(.*)",
                "headers": [
                    {
                        "key": "Strict-Transport-Security",
                        "value": "max-age=31536000; includeSubDomains",
                    },
                    {
                        "key": "X-Content-Type-Options",
                        "value": "nosniff",
                    },
                    {
                        "key": "Referrer-Policy",
                        "value": "strict-origin-when-cross-origin",
                    },
                ],
            },
        ],
        "redirects": [
            {
                "source": "/:path*",
                "has": [{"type": "host", "value": domain}],
                "destination": f"{runtime_config['primaryOrigin']}/:path*",
                "permanent": True,
            }
            for domain in runtime_config["alternateDomains"]
        ],
    }

    return f"{json.dumps(vercel_config, indent=2, ensure_ascii=False)}\n"


def sync_html_files(runtime_config: dict) -> None:
    for file_name in HTML_FILES:
        absolute_path = ROOT_DIR / file_name
        canonical_url = build_url(runtime_config["primaryOrigin"], get_page_pathname(file_name))
        social_image_url = runtime_config["socialImageUrl"]
        html = absolute_path.read_text(encoding="utf-8")

        if './site-config.js' not in html:
            html = replace_or_raise(
                html,
                r'(\s+)<link rel="stylesheet" href="\./styles\.css" \/>',
                r'\1<script src="./site-config.js"></script>' + "\n" + r'\1<link rel="stylesheet" href="./styles.css" />',
                "o link do stylesheet",
                file_name,
            )

        html = replace_or_raise(
            html,
            r'<link rel="canonical" href="[^"]*" \/>',
            f'<link rel="canonical" href="{canonical_url}" />',
            "o link canonical",
            file_name,
        )

        if 'property="og:url"' in html:
            html = replace_or_raise(
                html,
                r'<meta property="og:url" content="[^"]*" \/>',
                f'<meta property="og:url" content="{canonical_url}" />',
                "a meta og:url",
                file_name,
            )

        if 'property="og:image"' in html:
            html = replace_or_raise(
                html,
                r'(<meta\s+property="og:image"\s+content=")[^"]*("\s*\/>)',
                rf'\1{social_image_url}\2',
                "a meta og:image",
                file_name,
                flags=re.MULTILINE,
            )

        if 'name="twitter:image"' in html:
            html = replace_or_raise(
                html,
                r'(<meta\s+name="twitter:image"\s+content=")[^"]*("\s*\/>)',
                rf'\1{social_image_url}\2',
                "a meta twitter:image",
                file_name,
                flags=re.MULTILINE,
            )

        absolute_path.write_text(html, encoding="utf-8")


def main() -> int:
    runtime_config = build_runtime_config(read_json(ROOT_DIR / "site.config.json"))

    write_generated_file("site-config.js", build_site_runtime_config_file(runtime_config))
    write_generated_file("robots.txt", build_robots_file(runtime_config))
    write_generated_file("sitemap.xml", build_sitemap_file(runtime_config))
    write_generated_file("vercel.json", build_vercel_config(runtime_config))
    sync_html_files(runtime_config)

    sys.stdout.write(
        f"Configuracao aplicada para {runtime_config['primaryOrigin']} em HTML, sitemap, robots e Vercel.\n"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
