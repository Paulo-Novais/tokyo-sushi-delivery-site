(() => {
  const config = Object.freeze({
  "siteName": "Tokyo Sushi Delivery",
  "primaryDomain": "tokyosushidelivery.com.br",
  "primaryOrigin": "https://tokyosushidelivery.com.br",
  "alternateDomains": [
    "www.tokyosushidelivery.com.br"
  ],
  "allowedHostnames": [
    "tokyosushidelivery.com.br",
    "www.tokyosushidelivery.com.br"
  ],
  "googleMapsAllowedReferrers": [
    "https://tokyosushidelivery.com.br/*",
    "https://www.tokyosushidelivery.com.br/*"
  ],
  "socialImagePath": "/site-images/combinado-imperial.png",
  "socialImageUrl": "https://tokyosushidelivery.com.br/site-images/combinado-imperial.png"
});

  const normalizePathname = (value = "/") => {
    const pathname = String(value || "/").trim();

    if (!pathname || pathname === "/") {
      return "/";
    }

    return pathname.startsWith("/") ? pathname : `/${pathname}`;
  };

  const normalizeOrigin = (value = "") =>
    String(value || "")
      .trim()
      .replace(/\/+$/, "");

  const buildUrl = (pathname = "/", origin = config.primaryOrigin) => {
    const normalizedOrigin = normalizeOrigin(origin);
    const normalizedPathname = normalizePathname(pathname);

    if (!normalizedOrigin) {
      return normalizedPathname;
    }

    return normalizedPathname === "/" ? `${normalizedOrigin}/` : `${normalizedOrigin}${normalizedPathname}`;
  };

  window.TOKYO_SITE_CONFIG = config;
  window.getTokyoSiteUrl = buildUrl;
})();
