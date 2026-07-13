from __future__ import annotations

import json
import re
import sys
from html import escape as html_escape
from pathlib import Path
from urllib.parse import quote


ROOT_DIR = Path(__file__).resolve().parent.parent
HTML_FILES = [
    "index.html",
    "cardapio.html",
    "entrega.html",
    "acompanhar.html",
    "historico.html",
    "avaliar.html",
    "trabalhe-conosco.html",
    "404.html",
]
ADMIN_HTML_FILES = ["admin/index.html", "admin/login.html"]
SITEMAP_FILES = [
    "index.html",
    "cardapio.html",
    "entrega.html",
    "historico.html",
    "avaliar.html",
    "trabalhe-conosco.html",
]


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


def normalize_text(value: object, fallback: str = "") -> str:
    text = str(value or "").strip()
    return text or fallback


def normalize_object(value: object) -> dict:
    return value if isinstance(value, dict) else {}


def merge_object(defaults: dict, value: object) -> dict:
    return {**defaults, **normalize_object(value)}


def escape_html_attr(value: object) -> str:
    return html_escape(str(value or ""), quote=True)


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
    assets = merge_object(
        {
            "siteIcon": "./site-images/site-icon.png",
            "publicLogo": "./site-images/tokyo-logo-premium-transparent.png",
            "publicBanner": "./site-images/combinado-imperial.png",
            "socialImage": social_image_path,
            "supportAvatar": "./site-images/support-avatar-duo.webp",
            "loginCover": "./site-images/login-cover-floating.png",
            "adminSidebarLogo": "../assets/inovas-food-logo-oficial.png",
        },
        site_config.get("assets"),
    )
    default_address = {
        "full": "Rua General Osorio, 2165, Franca - SP, 14400-520, Brasil",
        "label": "R. General Osorio, 2165 - CEP 14400-520",
        "postalCode": "14400-520",
        "street": "Rua General Osorio",
        "number": "2165",
        "complement": "",
        "neighborhood": "",
        "city": "Franca",
        "state": "SP",
        "cityState": "Franca - SP",
        "footerStreetLine": "Rua General Osório, 2165",
        "footerCityLine": "Franca - SP, CEP 14400-520",
        "footerBottomLine": "Rua General Osório, 2165 - Franca - SP.",
        **normalize_object(site_config.get("defaultAddress")),
    }
    app_branding = {
        "appName": normalize_text(
            site_config.get("appName"),
            normalize_text(site_config.get("siteName"), "Tokyo Sushi Delivery"),
        ),
        "appShortName": normalize_text(site_config.get("appShortName"), "Tokyo Sushi"),
        "brandTagline": normalize_text(site_config.get("brandTagline"), "Delivery Premium"),
        "supportEmail": normalize_text(
            site_config.get("supportEmail"), "admin@tokyosushidelivery.com.br"
        ),
        "supportPhone": normalize_text(
            site_config.get("supportPhone"),
            normalize_text(site_config.get("defaultWhatsapp"), "5516990507398"),
        ),
        "companyName": normalize_text(site_config.get("companyName"), "Tokyo Sushi Delivery"),
        "companyWebsite": normalize_text(site_config.get("companyWebsite"), primary_origin),
        "footerPoweredBy": normalize_text(
            site_config.get("footerPoweredBy"), "Tokyo Sushi Delivery Premium"
        ),
        "platformName": normalize_text(site_config.get("platformName"), "Tokyo Sushi Delivery"),
        "platformVersion": normalize_text(site_config.get("platformVersion"), "1.0.0"),
        "defaultWhatsapp": normalize_text(site_config.get("defaultWhatsapp"), "5516990507398"),
        "defaultAddress": default_address,
        "publicOrderPrefix": normalize_text(site_config.get("publicOrderPrefix"), "TKY"),
    }
    platform_brand_source = normalize_object(site_config.get("platformBrand"))
    platform_brand = {
        "name": normalize_text(platform_brand_source.get("name"), app_branding["platformName"]),
        "logo": normalize_text(
            platform_brand_source.get("logo"),
            assets["publicLogo"],
        ),
        "primaryColor": normalize_text(platform_brand_source.get("primaryColor"), "#e83637"),
        "secondaryColor": normalize_text(platform_brand_source.get("secondaryColor"), "#f5c3d3"),
    }
    restaurant_brand_source = normalize_object(site_config.get("restaurantBrand"))
    restaurant_brand = {
        "name": normalize_text(restaurant_brand_source.get("name"), app_branding["appName"]),
        "logo": normalize_text(restaurant_brand_source.get("logo"), platform_brand["logo"]),
        "banner": normalize_text(
            restaurant_brand_source.get("banner"), assets["publicBanner"]
        ),
        "primaryColor": normalize_text(
            restaurant_brand_source.get("primaryColor"), platform_brand["primaryColor"]
        ),
        "secondaryColor": normalize_text(
            restaurant_brand_source.get("secondaryColor"), platform_brand["secondaryColor"]
        ),
    }
    site_appearance_source = normalize_object(site_config.get("siteAppearance"))
    site_appearance_colors = merge_object(
        {
            "primary": restaurant_brand["primaryColor"],
            "secondary": restaurant_brand["secondaryColor"],
            "accent": "#f2b649",
            "gradientStart": restaurant_brand["primaryColor"],
            "gradientEnd": "#2b1214",
            "useGradient": True,
        },
        normalize_object(site_appearance_source.get("colors")),
    )
    site_appearance_identity = merge_object(
        {
            "slogan": app_branding["brandTagline"],
            "description": "Cada detalhe e pensado para transformar seu pedido em uma experiencia unica.",
        },
        normalize_object(site_appearance_source.get("identity")),
    )
    site_appearance_seo = merge_object(
        {
            "title": app_branding["appName"],
            "description": "Tokyo Sushi Delivery com experiencia premium, cardapio sofisticado e pedidos direto pelo site.",
            "shareImage": social_image_path,
            "keywords": ["Tokyo Sushi", "sushi delivery", "delivery japones", "Franca SP"],
            "openGraph": {
                "title": app_branding["appName"],
                "description": "Tokyo Sushi Delivery com experiencia premium, cardapio sofisticado e pedidos direto pelo site.",
                "image": social_image_path,
                "type": "website",
            },
        },
        normalize_object(site_appearance_source.get("seo")),
    )
    site_appearance_seo["openGraph"] = merge_object(
        {
            "title": site_appearance_seo["title"],
            "description": site_appearance_seo["description"],
            "image": site_appearance_seo["shareImage"],
            "type": "website",
        },
        normalize_object(normalize_object(site_appearance_source.get("seo")).get("openGraph")),
    )
    site_appearance = {
        "layout": normalize_text(site_appearance_source.get("layout"), "MODERN").upper(),
        "theme": normalize_text(site_appearance_source.get("theme"), "DARK").upper(),
        "layouts": site_appearance_source.get("layouts")
        if isinstance(site_appearance_source.get("layouts"), list)
        else ["MODERN", "CATALOGO", "PREMIUM"],
        "themes": site_appearance_source.get("themes")
        if isinstance(site_appearance_source.get("themes"), list)
        else ["LIGHT", "DARK", "AUTO"],
        "colors": site_appearance_colors,
        "identity": site_appearance_identity,
        "social": merge_object(
            {
                "instagram": "",
                "facebook": "",
                "tiktok": "",
                "site": app_branding["companyWebsite"],
            },
            normalize_object(site_appearance_source.get("social")),
        ),
        "seo": site_appearance_seo,
        "platformFooter": merge_object(
            {
                "showPlatformBranding": True,
                "brandName": "INOVAS Food",
                "headline": "Desenvolvido por INOVAS Food",
                "description": "Plataforma profissional para restaurantes",
                "url": "https://inovasfood.com.br",
                "displayUrl": "inovasfood.com.br",
            },
            normalize_object(site_appearance_source.get("platformFooter")),
        ),
    }
    features = {
        "deliveryCalculation": True,
        "advancedReports": True,
        "crm": True,
        "inventory": True,
        "finance": True,
        "reviews": True,
        "promotions": True,
        "scheduledOrders": True,
        **normalize_object(site_config.get("features")),
    }
    prefixes_source = normalize_object(site_config.get("prefixes"))
    order_prefixes = {
        "publicOrder": normalize_text(
            prefixes_source.get("publicOrder"),
            normalize_text(site_config.get("publicOrderPrefix"), "TKY"),
        ),
        "customer": normalize_text(
            prefixes_source.get("customer"),
            normalize_text(site_config.get("customerPrefix"), "tokyo_customer"),
        ),
        "promotion": normalize_text(
            prefixes_source.get("promotion"),
            normalize_text(site_config.get("promotionPrefix"), "tokyo_promotion"),
        ),
        "coupon": normalize_text(
            prefixes_source.get("coupon"),
            normalize_text(site_config.get("couponPrefix"), "TKY"),
        ),
    }
    identifiers = {
        "storageKeys": merge_object(
            {
                "cart": "tokyo_sushi_delivery_cart",
                "authProfile": "tokyo_sushi_profile",
                "authAccounts": "tokyo_sushi_accounts",
                "customerClientToken": "tokyo_customer_client_token",
                "orderHistory": "tokyo_sushi_order_history",
                "cartAddons": "tokyo_sushi_delivery_cart_addons",
                "cartCheckout": "tokyo_sushi_cart_checkout",
                "deliveryHistory": "tokyo_sushi_delivery_quotes",
                "careerForms": "tokyo_sushi_career_forms",
                "catalogCollapsedSections": "tokyo_sushi_catalog_collapsed_sections",
                "googleMapsApiKey": "tokyo_google_maps_api_key",
                "adminTheme": "tokyo_admin_theme",
            },
            normalize_object(site_config.get("identifiers")).get("storageKeys"),
        ),
        "cookieNames": merge_object(
            {
                "adminSession": "tokyo_admin_session",
                "customerSession": "tokyo_customer_session",
                "customerLoginChallenge": "tokyo_customer_login_challenge",
            },
            normalize_object(site_config.get("identifiers")).get("cookieNames"),
        ),
        "headerNames": merge_object(
            {
                "customerClientToken": "x-tokyo-customer-client-token",
                "customerKey": "x-tokyo-customer-key",
            },
            normalize_object(site_config.get("identifiers")).get("headerNames"),
        ),
        "globalNames": merge_object(
            {
                "siteConfig": "TOKYO_SITE_CONFIG",
                "businessHoursApi": "TokyoBusinessHours",
                "storeHoursApi": "TokyoStoreHours",
                "googleMapsApiKey": "TOKYO_GOOGLE_MAPS_API_KEY",
            },
            normalize_object(site_config.get("identifiers")).get("globalNames"),
        ),
        "socialEmailDomain": normalize_text(
            normalize_object(site_config.get("identifiers")).get("socialEmailDomain"),
            "social.tokyo",
        ),
    }
    admin_branding = merge_object(
        {
            "indexTitle": "Gestor de Pedidos | Tokyo Sushi Delivery",
            "loginTitle": "Login do Gestor | Tokyo Sushi Delivery",
            "privateAreaLabel": "Area privada",
            "loginHeadline": "Gestor web administrativo do Tokyo Sushi Delivery",
            "loginPlaceholder": "admin@tokyosushidelivery.com.br",
            "sidebarEyebrow": "Gestor privado",
            "sidebarTitle": "Tokyo Sushi Delivery",
            "sidebarSubtitle": "Gestor de pedidos",
            "displayNameFallback": "Gestor Tokyo",
        },
        site_config.get("adminBranding"),
    )
    whatsapp_templates = merge_object(
        {
            "orderSupport": "Ola, quero fazer um pedido no {restaurantName}.",
            "deliverySupport": "Olá, quero tirar uma dúvida sobre a entrega.",
            "reviewSupport": "Olá, quero falar sobre minha avaliacao do site.",
            "careerSupport": "Olá, quero falar sobre uma vaga no Tokyo Sushi.",
            "historySupport": "Olá, quero ajuda com meu historico de pedidos.",
            "trackingSupport": "Olá, quero ajuda com meu pedido.",
            "verificationTemplateText": "Seu codigo Tokyo Sushi Delivery e {{1}}. Digite no site para concluir o login.",
        },
        site_config.get("whatsappTemplates"),
    )

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
        "assets": assets,
        "appBranding": app_branding,
        "platformBrand": platform_brand,
        "restaurantBrand": restaurant_brand,
        "siteAppearance": site_appearance,
        "features": features,
        "identifiers": identifiers,
        "adminBranding": admin_branding,
        "whatsappTemplates": whatsapp_templates,
        "publicText": merge_object(
            {
                "authAccessLabel": "Acesso Tokyo",
                "menuItemAltTemplate": "{itemName} do Tokyo Sushi Delivery",
                "loginCoverAlt": "Arte de login Tokyo Sushi com cerejeiras, logo e combinado de sushi",
            },
            site_config.get("publicText"),
        ),
        "pages": normalize_object(site_config.get("pages")),
        "orderPrefixes": order_prefixes,
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


def get_page_config(runtime_config: dict, file_name: str) -> dict:
    return normalize_object(runtime_config.get("pages")).get(file_name, {})


def replace_meta_content(html: str, attribute: str, value: str, file_name: str) -> str:
    escaped_value = escape_html_attr(value)
    return replace_or_raise(
        html,
        rf'(<meta\s+{attribute}\s+content=")[^"]*("\s*/>)',
        rf'\1{escaped_value}\2',
        f"meta {attribute}",
        file_name,
        flags=re.MULTILINE,
    )


def build_whatsapp_href(runtime_config: dict, template_key: str) -> str:
    templates = normalize_object(runtime_config.get("whatsappTemplates"))
    app_branding = normalize_object(runtime_config.get("appBranding"))
    restaurant_brand = normalize_object(runtime_config.get("restaurantBrand"))
    phone = normalize_text(app_branding.get("defaultWhatsapp"), "5516990507398")
    restaurant_name = normalize_text(restaurant_brand.get("name"), app_branding.get("appName"))
    template = normalize_text(templates.get(template_key), templates.get("orderSupport"))
    message = template.replace("{restaurantName}", restaurant_name)
    return f"https://wa.me/{phone}?text={quote(message, safe='')}"


def sync_public_brand_header(html: str, runtime_config: dict, file_name: str) -> str:
    app_branding = normalize_object(runtime_config.get("appBranding"))
    assets = normalize_object(runtime_config.get("assets"))
    brand_logo = escape_html_attr(assets.get("publicLogo"))
    brand_alt = escape_html_attr(f"Logo {app_branding.get('footerPoweredBy')}")
    brand_name = escape_html_attr(app_branding.get("appShortName"))
    brand_tagline = escape_html_attr(app_branding.get("brandTagline"))

    return replace_or_raise(
        html,
        (
            r'(<span class="brand-mark">\s*<img\s+src=")[^"]+("'
            r'\s+alt=")[^"]+("\s*/>\s*</span>\s*<span class="brand-meta">\s*'
            r'<strong>)[^<]+(</strong>\s*<small>)[^<]+(</small>)'
        ),
        rf"\1{brand_logo}\2{brand_alt}\3{brand_name}\4{brand_tagline}\5",
        "marca publica",
        file_name,
        flags=re.DOTALL,
    )


def sync_first_eyebrow(html: str, eyebrow: str, file_name: str) -> str:
    if not eyebrow or '<div class="eyebrow">' not in html:
        return html

    return replace_or_raise(
        html,
        r'(<div class="eyebrow">\s*<span></span>\s*)[^<]+(\s*</div>)',
        rf"\1{escape_html_attr(eyebrow)}\2",
        "eyebrow da pagina",
        file_name,
        flags=re.DOTALL,
    )


def sync_whatsapp_widget(html: str, runtime_config: dict, page_config: dict, file_name: str) -> str:
    if 'href="https://wa.me/' not in html:
        return html

    href = build_whatsapp_href(runtime_config, normalize_text(page_config.get("whatsappTemplate"), "orderSupport"))
    return replace_or_raise(
        html,
        r'(class="support-avatar support-avatar-link"\s+href=")[^"]+(")',
        rf"\1{escape_html_attr(href)}\2",
        "link do WhatsApp",
        file_name,
        flags=re.MULTILINE,
    )


def sync_html_files(runtime_config: dict) -> None:
    for file_name in HTML_FILES:
        absolute_path = ROOT_DIR / file_name
        canonical_url = build_url(runtime_config["primaryOrigin"], get_page_pathname(file_name))
        social_image_url = runtime_config["socialImageUrl"]
        page_config = get_page_config(runtime_config, file_name)
        title = normalize_text(page_config.get("title"), runtime_config["siteName"])
        description = normalize_text(page_config.get("description"), "")
        og_description = normalize_text(page_config.get("ogDescription"), description)
        twitter_description = normalize_text(page_config.get("twitterDescription"), description)
        og_image_alt = normalize_text(page_config.get("ogImageAlt"), title)
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
            r"<title>[^<]*</title>",
            f"<title>{escape_html_attr(title)}</title>",
            "o titulo da pagina",
            file_name,
        )

        if 'name="description"' in html:
            html = replace_meta_content(html, r'name="description"', description, file_name)

        if 'name="application-name"' in html:
            html = replace_meta_content(
                html,
                r'name="application-name"',
                runtime_config["appBranding"]["appName"],
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

        if 'property="og:site_name"' in html:
            html = replace_meta_content(
                html,
                r'property="og:site_name"',
                runtime_config["appBranding"]["appName"],
                file_name,
            )

        if 'property="og:title"' in html:
            html = replace_meta_content(html, r'property="og:title"', title, file_name)

        if 'property="og:description"' in html:
            html = replace_meta_content(html, r'property="og:description"', og_description, file_name)

        if 'property="og:image"' in html:
            html = replace_or_raise(
                html,
                r'(<meta\s+property="og:image"\s+content=")[^"]*("\s*\/>)',
                rf'\1{social_image_url}\2',
                "a meta og:image",
                file_name,
                flags=re.MULTILINE,
            )

        if 'property="og:image:alt"' in html:
            html = replace_meta_content(html, r'property="og:image:alt"', og_image_alt, file_name)

        if 'name="twitter:title"' in html:
            html = replace_meta_content(html, r'name="twitter:title"', title, file_name)

        if 'name="twitter:description"' in html:
            html = replace_meta_content(
                html,
                r'name="twitter:description"',
                twitter_description,
                file_name,
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

        if '<span class="brand-mark">' in html:
            html = sync_public_brand_header(html, runtime_config, file_name)

        html = sync_first_eyebrow(html, normalize_text(page_config.get("eyebrow"), ""), file_name)
        html = sync_whatsapp_widget(html, runtime_config, page_config, file_name)

        absolute_path.write_text(html, encoding="utf-8")


def sync_admin_html_files(runtime_config: dict) -> None:
    admin_branding = normalize_object(runtime_config.get("adminBranding"))
    assets = normalize_object(runtime_config.get("assets"))

    for file_name in ADMIN_HTML_FILES:
        absolute_path = ROOT_DIR / file_name
        html = absolute_path.read_text(encoding="utf-8")

        if "../site-config.js" not in html:
            html = replace_or_raise(
                html,
                r'(\s+)<script src="\./admin\.js" defer></script>',
                r'\1<script src="../site-config.js" defer></script>' + "\n" + r'\1<script src="./admin.js" defer></script>',
                "script de runtime do admin",
                file_name,
            )

        if file_name.endswith("index.html"):
            html = replace_or_raise(
                html,
                r"<title>[^<]*</title>",
                f"<title>{escape_html_attr(admin_branding['indexTitle'])}</title>",
                "titulo do admin",
                file_name,
            )
            html = replace_or_raise(
                html,
                r'(<img\s+class="admin-brand-logo"\s+src=")[^"]+("\s+alt=")[^"]+("\s*/>)',
                rf"\1{escape_html_attr(assets['adminSidebarLogo'])}\2{escape_html_attr(admin_branding['sidebarTitle'])}\3",
                "logo do admin",
                file_name,
                flags=re.DOTALL,
            )
            html = replace_or_raise(
                html,
                (
                    r'(<span class="admin-eyebrow">)[^<]+(</span>\s*'
                    r'<strong>)[^<]+(</strong>\s*<small>)[^<]+(</small>)'
                ),
                rf"\1{escape_html_attr(admin_branding['sidebarEyebrow'])}\2{escape_html_attr(admin_branding['sidebarTitle'])}\3{escape_html_attr(admin_branding['sidebarSubtitle'])}\4",
                "marca lateral do admin",
                file_name,
                flags=re.DOTALL,
            )
        else:
            html = replace_or_raise(
                html,
                r"<title>[^<]*</title>",
                f"<title>{escape_html_attr(admin_branding['loginTitle'])}</title>",
                "titulo do login admin",
                file_name,
            )
            html = replace_or_raise(
                html,
                r'(<span class="admin-eyebrow">)[^<]+(</span>)',
                rf"\1{escape_html_attr(admin_branding['privateAreaLabel'])}\2",
                "eyebrow do login admin",
                file_name,
            )
            html = replace_or_raise(
                html,
                r"(<h1>)[^<]+(</h1>)",
                rf"\1{escape_html_attr(admin_branding['loginHeadline'])}\2",
                "headline do login admin",
                file_name,
            )
            html = replace_or_raise(
                html,
                r'(name="identifier"\s+autocomplete="username"\s+placeholder=")[^"]+(")',
                rf"\1{escape_html_attr(admin_branding['loginPlaceholder'])}\2",
                "placeholder do login admin",
                file_name,
                flags=re.DOTALL,
            )

        absolute_path.write_text(html, encoding="utf-8")


def main() -> int:
    runtime_config = build_runtime_config(read_json(ROOT_DIR / "site.config.json"))

    write_generated_file("site-config.js", build_site_runtime_config_file(runtime_config))
    write_generated_file("robots.txt", build_robots_file(runtime_config))
    write_generated_file("sitemap.xml", build_sitemap_file(runtime_config))
    write_generated_file("vercel.json", build_vercel_config(runtime_config))
    sync_html_files(runtime_config)
    sync_admin_html_files(runtime_config)

    sys.stdout.write(
        f"Configuracao aplicada para {runtime_config['primaryOrigin']} em HTML, admin, sitemap, robots e Vercel.\n"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
