const CACHE_CONTROL_NO_STORE = "no-store, max-age=0";

const buildHttpError = (statusCode, message, errorCode = "request_error", extra = {}) => {
  const error = new Error(message);
  error.statusCode = Number(statusCode || 500);
  error.errorCode = errorCode;
  Object.assign(error, extra);
  return error;
};

const getHostName = (value) => {
  const host = String(value || "").trim();

  if (!host) {
    return "";
  }

  try {
    return new URL(`http://${host}`).hostname.toLowerCase();
  } catch (error) {
    return host
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .split(":")[0]
      .toLowerCase();
  }
};

const isLocalHost = (value) => ["localhost", "127.0.0.1", "::1"].includes(getHostName(value));

const getRequestHeader = (req, headerName) => {
  const normalizedHeaderName = String(headerName || "").trim().toLowerCase();

  if (!normalizedHeaderName) {
    return "";
  }

  if (typeof req?.headers?.get === "function") {
    return String(req.headers.get(normalizedHeaderName) || "").trim();
  }

  return String(req?.headers?.[normalizedHeaderName] || "").trim();
};

const parseJsonBody = (body, options = {}) => {
  const {
    fallback = {},
    strict = false,
  } = options;

  if (!body || body === "") {
    return fallback;
  }

  if (Buffer.isBuffer(body)) {
    return parseJsonBody(body.toString("utf8"), options);
  }

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch (error) {
      if (strict) {
        throw buildHttpError(
          400,
          "O corpo da requisicao nao contem um JSON valido.",
          "invalid_json"
        );
      }

      return fallback;
    }
  }

  if (typeof body === "object") {
    return body;
  }

  if (strict) {
    throw buildHttpError(400, "O corpo da requisicao e invalido.", "invalid_json");
  }

  return fallback;
};

const json = (res, statusCode, payload, extraHeaders = {}) => {
  res.setHeader("Cache-Control", CACHE_CONTROL_NO_STORE);

  Object.entries(extraHeaders).forEach(([key, value]) => {
    if (typeof value !== "undefined") {
      res.setHeader(key, value);
    }
  });

  return res.status(statusCode).json(payload);
};

const getCookieMap = (req) => {
  const header = getRequestHeader(req, "cookie");

  return header
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((cookies, entry) => {
      const separatorIndex = entry.indexOf("=");

      if (separatorIndex === -1) {
        cookies[entry] = "";
        return cookies;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();

      if (key) {
        cookies[key] = decodeURIComponent(value);
      }

      return cookies;
    }, {});
};

const getRequestOrigin = (req) => {
  const host = getRequestHeader(req, "x-forwarded-host") || getRequestHeader(req, "host");

  if (!host) {
    return "";
  }

  const forwardedProto = getRequestHeader(req, "x-forwarded-proto")
    .split(",")[0]
    .trim()
    .toLowerCase();
  let protocol = forwardedProto;

  if (!protocol) {
    try {
      protocol = new URL(String(req?.url || "")).protocol.replace(":", "").toLowerCase();
    } catch (error) {
      protocol = "";
    }
  }

  if (!protocol) {
    protocol = isLocalHost(host) ? "http" : "https";
  }

  return `${protocol}://${host}`;
};

module.exports = {
  CACHE_CONTROL_NO_STORE,
  buildHttpError,
  getCookieMap,
  getRequestHeader,
  getRequestOrigin,
  json,
  parseJsonBody,
};
