const { getBoundCustomerSessionFromRequest } = require("../../../lib/customer-auth.cjs");
const { json } = require("../../../lib/http.cjs");
const { getCustomerActiveOrder } = require("../../../lib/order-store.cjs");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, {
      error: "Metodo nao permitido.",
      errorCode: "method_not_allowed",
    });
  }

  try {
    const session = getBoundCustomerSessionFromRequest(req);

    if (!session) {
      return json(res, 200, {
        ok: true,
        authenticated: false,
        hasActiveOrder: false,
        order: null,
      });
    }

    const payload = await getCustomerActiveOrder(session.customerKey);

    return json(res, 200, {
      ok: true,
      authenticated: true,
      ...payload,
    });
  } catch (error) {
    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || "Nao foi possivel consultar o pedido ativo do cliente.",
      errorCode:
        error?.errorCode || (error?.statusCode ? "customer_active_order_error" : "internal_error"),
    });
  }
};
