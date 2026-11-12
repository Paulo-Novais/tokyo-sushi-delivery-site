const { json } = require("../lib/http.cjs");
const { getPublicCatalogState } = require("../lib/catalog-store.cjs");
const { getPublicDeliverySettings } = require("../lib/delivery-settings-store.cjs");
const { parseJsonBody } = require("../lib/http.cjs");
const {
  getPublicRestaurantSettings,
} = require("../lib/restaurant-settings-store.cjs");
const {
  createPublicReview,
  getPublicReviewsSnapshot,
} = require("../lib/review-store.cjs");
const { getPlanAccessForAdminModule } = require("../lib/master-platform-store.cjs");
const {
  getRequestTenantContext,
  withTenantContextPayload,
} = require("../lib/tenant-context.cjs");
const { guardSecurity, recordSecurityFailure } = require("../lib/security-guardian.cjs");
const { runWithDatabaseScope } = require("../lib/tenant-sql.cjs");
const { PREMIUM_PAGES } = require("../lib/premium-model.cjs");
const { renderPremiumPage } = require("../lib/premium-site-renderer.cjs");
const { getPublicAppUrl, validateRestaurantSlug } = require("../lib/restaurant-public-url.cjs");
const { getRequestHost, isPathTenantHost } = require("../lib/tenant-resolution.cjs");

const sendHtml = (res, statusCode, html) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(statusCode).send(html);
};

const RESTAURANT_NOT_FOUND_HTML = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Restaurante não encontrado | INOVAS Food</title>
  </head>
  <body>
    <main>
      <h1>Restaurante não encontrado</h1>
      <p>Confira o endereço informado ou volte para o INOVAS Food.</p>
      <a href="/">Voltar ao início</a>
    </main>
  </body>
</html>`;

// Página do Modelo Premium montada no servidor para o restaurante da rota.
// Sem restaurante identificado (slug ou domínio próprio) a página falha.
const handlePremiumPage = async (req, res) => {
  if (!["GET", "HEAD"].includes(String(req.method || "GET").toUpperCase())) {
    res.setHeader("Allow", "GET, HEAD");
    return sendHtml(res, 405, RESTAURANT_NOT_FOUND_HTML);
  }

  const requestUrl = new URL(String(req.url || ""), "http://localhost");
  const pageKey = String(requestUrl.searchParams.get("page") || "inicio");
  const rawSlug = String(requestUrl.searchParams.get("slug") || "");
  const host = getRequestHost(req);
  const usesPath = isPathTenantHost(host);
  const slugValidation = rawSlug ? validateRestaurantSlug(rawSlug) : null;

  if (
    !Object.prototype.hasOwnProperty.call(PREMIUM_PAGES, pageKey) ||
    (usesPath && !slugValidation?.ok)
  ) {
    return sendHtml(res, 404, RESTAURANT_NOT_FOUND_HTML);
  }

  try {
    const slug = usesPath ? slugValidation.slug : "";
    const tenantContext = await getRequestTenantContext(req, {
      source: "public:premium-page",
      ...(slug ? { slug } : {}),
    });
    const { settings, catalog } = await runAsPublicTenant(tenantContext, async () => ({
      settings: (await getPublicRestaurantSettings({ tenantContext })).settings,
      catalog: await getPublicCatalogState({ tenantContext }).catch(() => ({ sections: [] })),
    }));
    const html = renderPremiumPage({
      pageKey,
      basePath: slug ? `/${slug}` : "",
      origin: slug ? getPublicAppUrl() : `https://${host}`,
      slug: slug || tenantContext.restaurantKey,
      settings,
      catalog,
    });

    return sendHtml(res, 200, html);
  } catch (error) {
    const status = Number(error?.statusCode || 500);
    if (!(status >= 400 && status < 500)) {
      console.error("[premium-page]", {
        page: pageKey,
        slug: rawSlug,
        errorCode: error?.errorCode || error?.code || "",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return sendHtml(res, status >= 400 && status < 500 ? 404 : 500, RESTAURANT_NOT_FOUND_HTML);
  }
};

const runAsPublicTenant = (tenantContext, callback) =>
  runWithDatabaseScope(
    {
      audience: "public",
      tenantId: tenantContext.tenantId,
      restaurantId: tenantContext.restaurantId,
      restaurantKey: tenantContext.restaurantKey,
    },
    callback
  );

const resolvePublicAction = (req) => {
  const requestUrl = new URL(String(req.url || ""), "http://localhost");
  const explicitAction = String(requestUrl.searchParams.get("publicView") || "")
    .trim()
    .toLowerCase();

  if (explicitAction) {
    return explicitAction;
  }

  const routeAction = requestUrl.pathname
    .replace(/^\/api\//, "")
    .replace(/^public\/?/, "")
    .trim()
    .toLowerCase();

  return ["reviews", "delivery-settings", "restaurant-settings"].includes(
    routeAction
  )
    ? routeAction
    : "catalog";
};

const assertPublicReviewTenantCanOperate = async (tenantContext) => {
  const planAccess = await getPlanAccessForAdminModule({
    group: "reviews",
    action: "create",
    restaurantKey: tenantContext.restaurantKey || "default",
  });

  if (!planAccess.allowed) {
    const error = new Error("Nao foi possivel concluir a operacao.");
    error.statusCode = 403;
    error.errorCode = "plan_feature_forbidden";
    error.featureKey = planAccess.featureKey;
    error.planKey = planAccess.commercialAccess?.planKey;
    error.reason = planAccess.reason;
    throw error;
  }
};

module.exports = async (req, res) => {
  const action = resolvePublicAction(req);

  if (action === "premium-page") {
    return handlePremiumPage(req, res);
  }

  if (action === "reviews") {
    if (req.method === "GET") {
      try {
        const tenantContext = await getRequestTenantContext(req, {
          source: "public:reviews:list",
        });
        const payload = await runAsPublicTenant(tenantContext, () =>
          getPublicReviewsSnapshot({ tenantContext })
        );

        return json(res, 200, {
          ok: true,
          ...withTenantContextPayload(payload, tenantContext),
        });
      } catch (error) {
        return json(res, Number(error?.statusCode || 500), {
          error: error?.message || "Nao foi possivel carregar as avaliacoes publicas.",
          errorCode:
            error?.errorCode || (error?.statusCode ? "public_reviews_error" : "internal_error"),
        });
      }
    }

    if (req.method === "POST") {
      try {
        await guardSecurity(req, {
          routeType: "public-write",
          action: "reviews:create",
          requireTenant: true,
          rateLimitProfile: "publicWrite",
        });
        const tenantContext = await getRequestTenantContext(req, {
          source: "public:reviews:create",
        });
        const payload = parseJsonBody(req.body, { strict: true });

        return json(res, 200, {
          ok: true,
          ...withTenantContextPayload(
            await runAsPublicTenant(tenantContext, async () => {
              await assertPublicReviewTenantCanOperate(tenantContext);
              return createPublicReview(payload, { tenantContext });
            }),
            tenantContext
          ),
        });
      } catch (error) {
        if (error?.statusCode && Number(error.statusCode) >= 400) {
          recordSecurityFailure(req, {
            routeType: "public-write",
            action: "reviews:create",
            reason: error?.errorCode || "review_create_rejected",
          });
        }

        return json(res, Number(error?.statusCode || 500), {
          error: error?.message || "Nao foi possivel registrar a avaliacao.",
          errorCode:
            error?.errorCode ||
            (error?.statusCode ? "public_reviews_create_error" : "internal_error"),
        });
      }
    }

    res.setHeader("Allow", "GET, POST");
    return json(res, 405, {
      error: "Metodo nao permitido.",
      errorCode: "method_not_allowed",
    });
  }

  if (action === "delivery-settings" || action === "restaurant-settings") {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return json(res, 405, {
        error: "Metodo nao permitido.",
        errorCode: "method_not_allowed",
      });
    }

    try {
      const tenantContext = await getRequestTenantContext(req, {
        source: `public:${action}`,
      });
      const payload = await runAsPublicTenant(tenantContext, () =>
        action === "delivery-settings"
          ? getPublicDeliverySettings({ tenantContext })
          : getPublicRestaurantSettings({ tenantContext })
      );

      return json(res, 200, {
        ok: true,
        ...withTenantContextPayload(payload, tenantContext),
      });
    } catch (error) {
      return json(res, Number(error?.statusCode || 500), {
        error:
          error?.message ||
          (action === "delivery-settings"
            ? "Nao foi possivel carregar as configuracoes de entrega."
            : "Nao foi possivel carregar as configuracoes do restaurante."),
        errorCode:
          error?.errorCode ||
          (error?.statusCode
            ? `public_${action.replace("-", "_")}_error`
            : "internal_error"),
      });
    }
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, {
      error: "Metodo nao permitido.",
      errorCode: "method_not_allowed",
    });
  }

  try {
    const tenantContext = await getRequestTenantContext(req, {
      source: "public:catalog",
    });
    const payload = await runAsPublicTenant(tenantContext, () =>
      getPublicCatalogState({ tenantContext })
    );

    return json(res, 200, {
      ok: true,
      ...withTenantContextPayload(payload, tenantContext),
    });
  } catch (error) {
    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || "Nao foi possivel carregar o estado publico do catalogo.",
      errorCode:
        error?.errorCode || (error?.statusCode ? "public_catalog_error" : "internal_error"),
    });
  }
};
