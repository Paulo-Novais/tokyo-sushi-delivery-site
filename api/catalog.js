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

  if (action === "reviews") {
    if (req.method === "GET") {
      try {
        const tenantContext = await getRequestTenantContext(req, {
          source: "public:reviews:list",
        });
        const payload = await getPublicReviewsSnapshot({ tenantContext });

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
        await assertPublicReviewTenantCanOperate(tenantContext);
        const payload = parseJsonBody(req.body, { strict: true });

        return json(res, 200, {
          ok: true,
          ...withTenantContextPayload(await createPublicReview(payload, { tenantContext }), tenantContext),
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
      const payload =
        action === "delivery-settings"
          ? await getPublicDeliverySettings({ tenantContext })
          : await getPublicRestaurantSettings({ tenantContext });

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
    const payload = await getPublicCatalogState({ tenantContext });

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
