const { requireAdminSession } = require("../../lib/admin-request.cjs");
const { json } = require("../../lib/http.cjs");
const { getAdminOrderList } = require("../../lib/order-store.cjs");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, {
      error: "Metodo nao permitido.",
      errorCode: "method_not_allowed",
    });
  }

  try {
    const session = requireAdminSession(req);
    const dashboard = await getAdminOrderList(40);

    return json(res, 200, {
      ok: true,
      admin: {
        displayName: session.displayName,
      },
      ...dashboard,
    });
  } catch (error) {
    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || "Nao foi possivel carregar o painel administrativo.",
      errorCode: error?.statusCode ? "dashboard_error" : "internal_error",
    });
  }
};
