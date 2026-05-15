const { requireAdminSession } = require("../../../lib/admin-request.cjs");
const { buildHttpError, json, parseJsonBody } = require("../../../lib/http.cjs");
const {
  getAdminOrderDetails,
  getAdminOrderList,
  updateAdminOrderStatus,
} = require("../../../lib/order-store.cjs");

const parseLimit = (value) => {
  const numericValue = Number.parseInt(String(value || ""), 10);

  if (!Number.isFinite(numericValue)) {
    return 40;
  }

  return Math.min(Math.max(numericValue, 1), 100);
};

const getActionFromRequest = (req) => {
  const requestUrl = new URL(String(req.url || ""), "http://localhost");
  return {
    action: requestUrl.pathname.split("/").filter(Boolean).pop() || "",
    requestUrl,
  };
};

const handleOrderList = async (req, res, session, requestUrl) => {
  const payload = await getAdminOrderList(parseLimit(requestUrl.searchParams.get("limit")));

  return json(res, 200, {
    ok: true,
    admin: {
      displayName: session.displayName,
    },
    ...payload,
  });
};

const handleOrderDetails = async (req, res, session, requestUrl) => {
  const orderId = String(
    requestUrl.searchParams.get("orderId") || requestUrl.searchParams.get("id") || ""
  ).trim();

  if (!orderId) {
    throw buildHttpError(400, "Informe o pedido que deseja abrir.", "missing_order_identifier");
  }

  const payload = await getAdminOrderDetails(orderId);

  return json(res, 200, {
    ok: true,
    admin: {
      displayName: session.displayName,
    },
    ...payload,
  });
};

const handleOrderStatus = async (req, res, session) => {
  const payload = parseJsonBody(req.body, { strict: true });
  const orderId = String(payload.orderId || payload.id || "").trim();
  const status = String(payload.status || "").trim();
  const note = String(payload.note || "").trim();

  if (!orderId) {
    throw buildHttpError(400, "Informe o pedido que deseja atualizar.", "missing_order_identifier");
  }

  if (!status) {
    throw buildHttpError(400, "Informe o novo status do pedido.", "missing_order_status");
  }

  const result = await updateAdminOrderStatus(orderId, status, note);

  return json(res, 200, {
    ok: true,
    admin: {
      displayName: session.displayName,
    },
    ...result,
  });
};

module.exports = async (req, res) => {
  try {
    const session = requireAdminSession(req);
    const { action, requestUrl } = getActionFromRequest(req);

    if (action === "list") {
      if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return json(res, 405, {
          error: "Metodo nao permitido.",
          errorCode: "method_not_allowed",
        });
      }

      return await handleOrderList(req, res, session, requestUrl);
    }

    if (action === "details") {
      if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return json(res, 405, {
          error: "Metodo nao permitido.",
          errorCode: "method_not_allowed",
        });
      }

      return await handleOrderDetails(req, res, session, requestUrl);
    }

    if (action === "status") {
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return json(res, 405, {
          error: "Metodo nao permitido.",
          errorCode: "method_not_allowed",
        });
      }

      return await handleOrderStatus(req, res, session);
    }

    return json(res, 404, {
      error: "Operacao administrativa nao encontrada.",
      errorCode: "admin_order_action_not_found",
    });
  } catch (error) {
    const { action } = getActionFromRequest(req);
    const fallbackMessages = {
      list: "Nao foi possivel listar os pedidos do gestor.",
      details: "Nao foi possivel carregar os detalhes do pedido.",
      status: "Nao foi possivel atualizar o status do pedido.",
    };
    const fallbackErrorCodes = {
      list: "admin_orders_error",
      details: "admin_order_details_error",
      status: "admin_order_status_error",
    };

    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || fallbackMessages[action] || "Nao foi possivel concluir a operacao.",
      errorCode:
        error?.errorCode ||
        (error?.statusCode ? fallbackErrorCodes[action] || "admin_orders_error" : "internal_error"),
    });
  }
};
