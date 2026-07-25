const { json } = require("./http.cjs");

const getDomainActionSegments = (req, domain) => {
  const queryAction = Array.isArray(req?.query?.action)
    ? req.query.action.join("/")
    : String(req?.query?.action || "");
  const rawAction = queryAction
    ? queryAction
    : new URL(String(req?.url || "/"), "http://localhost").pathname.replace(
        new RegExp(`^/api/${domain}/?`),
        ""
      );
  return rawAction
    .split("/")
    .map((segment) => decodeURIComponent(segment).trim())
    .filter(Boolean);
};

const sendDomainSuccess = (
  res,
  data,
  { statusCode = 200, meta = {}, requestId = "" } = {}
) =>
  json(res, statusCode, {
    success: true,
    data,
    meta,
    requestId,
  });

const sendDomainError = (res, error, requestId = "") => {
  const statusCode = Number(error?.statusCode || 500);
  const errorCode =
    error?.errorCode ||
    (statusCode >= 500 ? "internal_error" : "request_error");
  return json(res, statusCode, {
    success: false,
    error: {
      code: errorCode,
      message:
        statusCode >= 500
          ? "Não foi possível concluir a operação."
          : error?.message || "Operação não autorizada.",
      field: error?.field || undefined,
      details: error?.details || undefined,
    },
    requestId,
  });
};

const assertMethod = (req, allowedMethods) => {
  const methods = Array.isArray(allowedMethods)
    ? allowedMethods
    : [allowedMethods];
  if (!methods.includes(req.method)) {
    const error = new Error("Método não permitido.");
    error.statusCode = 405;
    error.errorCode = "method_not_allowed";
    throw error;
  }
};

module.exports = {
  assertMethod,
  getDomainActionSegments,
  sendDomainError,
  sendDomainSuccess,
};
