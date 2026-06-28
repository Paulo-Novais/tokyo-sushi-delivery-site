const { json } = require("../lib/http.cjs");
const { getPublicRestaurantSettings } = require("../lib/restaurant-settings-store.cjs");
const {
  getRequestTenantContext,
  withTenantContextPayload,
} = require("../lib/tenant-context.cjs");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, {
      error: "Metodo nao permitido.",
      errorCode: "method_not_allowed",
    });
  }

  try {
    const tenantContext = await getRequestTenantContext(req, {
      source: "public:restaurant-settings",
    });

    return json(res, 200, {
      ok: true,
      ...withTenantContextPayload(await getPublicRestaurantSettings({ tenantContext }), tenantContext),
    });
  } catch (error) {
    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || "Nao foi possivel carregar as configuracoes do restaurante.",
      errorCode:
        error?.errorCode ||
        (error?.statusCode ? "public_restaurant_settings_error" : "internal_error"),
    });
  }
};
