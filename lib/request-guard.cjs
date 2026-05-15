const {
  buildHttpError,
  getRequestHeader,
  getRequestOrigin,
} = require("./http.cjs");

const DEFAULT_ORDER_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_ORDER_RATE_LIMIT_MAX_REQUESTS = 6;
const DEFAULT_ORDER_MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_CUSTOMER_AUTH_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_CUSTOMER_AUTH_START_MAX_REQUESTS = 6;
const DEFAULT_CUSTOMER_AUTH_VERIFY_MAX_REQUESTS = 10;
const rateLimitBuckets = new Map();

const parsePositiveInteger = (value, fallback) => {
  const parsedValue = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};

const normalizeOrigin = (value) => {
  try {
    return new URL(String(value || "").trim()).origin.toLowerCase();
  } catch (error) {
    return "";
  }
};

const getConfiguredPublicOrigins = (req) => {
  const configuredOrigins = String(process.env.ALLOWED_PUBLIC_ORIGINS || "")
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  const requestOrigin = normalizeOrigin(getRequestOrigin(req));
  return requestOrigin ? [requestOrigin] : [];
};

const getSourceOrigin = (req) => {
  const originHeader = normalizeOrigin(getRequestHeader(req, "origin"));

  if (originHeader) {
    return originHeader;
  }

  return normalizeOrigin(getRequestHeader(req, "referer"));
};

const normalizeIp = (value) =>
  String(value || "")
    .trim()
    .replace(/^::ffff:/, "")
    .replace(/^\[|\]$/g, "");

const getClientIp = (req) => {
  const forwardedFor = getRequestHeader(req, "x-forwarded-for");

  if (forwardedFor) {
    return normalizeIp(forwardedFor.split(",")[0]);
  }

  return (
    normalizeIp(getRequestHeader(req, "x-real-ip")) ||
    normalizeIp(req?.socket?.remoteAddress) ||
    "unknown"
  );
};

const cleanupRateLimitBucket = (now, windowMs) => {
  rateLimitBuckets.forEach((timestamps, key) => {
    const recentTimestamps = timestamps.filter((timestamp) => now - timestamp < windowMs);

    if (recentTimestamps.length > 0) {
      rateLimitBuckets.set(key, recentTimestamps);
      return;
    }

    rateLimitBuckets.delete(key);
  });
};

const assertJsonRequest = (req, options = {}) => {
  const contentType = getRequestHeader(req, "content-type").toLowerCase();

  if (!contentType.includes("application/json")) {
    throw buildHttpError(
      415,
      options.invalidContentTypeMessage ||
        "Envie o pedido em JSON com Content-Type application/json.",
      "invalid_content_type"
    );
  }
};

const assertPayloadSize = (req, options = {}) => {
  const maxBodyBytes = parsePositiveInteger(
    process.env.ORDER_MAX_BODY_BYTES,
    DEFAULT_ORDER_MAX_BODY_BYTES
  );
  const contentLength = Number.parseInt(getRequestHeader(req, "content-length"), 10);
  const bodyBytes =
    typeof req?.body === "string"
      ? Buffer.byteLength(req.body, "utf8")
      : Buffer.isBuffer(req?.body)
        ? req.body.length
        : req?.body && typeof req.body === "object"
          ? Buffer.byteLength(JSON.stringify(req.body), "utf8")
        : null;

  if (
    (Number.isFinite(contentLength) && contentLength > maxBodyBytes) ||
    (Number.isFinite(bodyBytes) && bodyBytes > maxBodyBytes)
  ) {
    throw buildHttpError(
      413,
      options.payloadTooLargeMessage || "A requisicao enviada excede o tamanho maximo permitido.",
      "payload_too_large"
    );
  }
};

const assertAllowedPublicOrigin = (req, options = {}) => {
  const allowedOrigins = getConfiguredPublicOrigins(req);

  if (allowedOrigins.length === 0) {
    return;
  }

  const sourceOrigin = getSourceOrigin(req);

  if (!sourceOrigin) {
    throw buildHttpError(
      403,
      options.originRequiredMessage || "Nao foi possivel validar a origem da requisicao.",
      "origin_required"
    );
  }

  if (!allowedOrigins.includes(sourceOrigin)) {
    throw buildHttpError(
      403,
      options.originNotAllowedMessage || "A origem da requisicao nao esta autorizada.",
      "origin_not_allowed"
    );
  }
};

const assertRateLimit = (
  req,
  { windowMs, maxRequests, bucketKeyPrefix, message, errorCode = "rate_limit_exceeded" }
) => {
  const now = Date.now();
  const clientIp = getClientIp(req);
  const bucketKey = `${bucketKeyPrefix}:${clientIp}`;
  const timestamps = rateLimitBuckets.get(bucketKey) || [];
  const recentTimestamps = timestamps.filter((timestamp) => now - timestamp < windowMs);

  cleanupRateLimitBucket(now, windowMs);

  if (recentTimestamps.length >= maxRequests) {
    const oldestTimestamp = recentTimestamps[0] || now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowMs - (now - oldestTimestamp)) / 1000)
    );
    const error = buildHttpError(
      429,
      message,
      errorCode,
      {
        retryAfterSeconds,
      }
    );

    throw error;
  }

  recentTimestamps.push(now);
  rateLimitBuckets.set(bucketKey, recentTimestamps);
};

const assertOrderRateLimit = (req) => {
  const windowMs = parsePositiveInteger(
    process.env.ORDER_RATE_LIMIT_WINDOW_MS,
    DEFAULT_ORDER_RATE_LIMIT_WINDOW_MS
  );
  const maxRequests = parsePositiveInteger(
    process.env.ORDER_RATE_LIMIT_MAX_REQUESTS,
    DEFAULT_ORDER_RATE_LIMIT_MAX_REQUESTS
  );

  assertRateLimit(req, {
    windowMs,
    maxRequests,
    bucketKeyPrefix: "orders:create",
    message:
      "Voce atingiu o limite temporario de tentativas para criar pedidos. Aguarde e tente novamente.",
  });
};

const assertCustomerAuthRateLimit = (req, phase) => {
  const windowMs = parsePositiveInteger(
    process.env.CUSTOMER_AUTH_RATE_LIMIT_WINDOW_MS,
    DEFAULT_CUSTOMER_AUTH_RATE_LIMIT_WINDOW_MS
  );
  const maxRequests = parsePositiveInteger(
    phase === "verify"
      ? process.env.CUSTOMER_AUTH_VERIFY_MAX_REQUESTS
      : process.env.CUSTOMER_AUTH_START_MAX_REQUESTS,
    phase === "verify"
      ? DEFAULT_CUSTOMER_AUTH_VERIFY_MAX_REQUESTS
      : DEFAULT_CUSTOMER_AUTH_START_MAX_REQUESTS
  );

  assertRateLimit(req, {
    windowMs,
    maxRequests,
    bucketKeyPrefix: `customer:auth:${phase}`,
    message:
      phase === "verify"
        ? "Voce atingiu o limite temporario de tentativas para validar o codigo. Aguarde e tente novamente."
        : "Voce atingiu o limite temporario para solicitar codigos de acesso. Aguarde e tente novamente.",
  });
};

const assertPublicOrderRequest = (req) => {
  assertJsonRequest(req);
  assertPayloadSize(req);
  assertAllowedPublicOrigin(req);
  assertOrderRateLimit(req);
};

const assertPublicCustomerAuthStartRequest = (req) => {
  assertJsonRequest(req, {
    invalidContentTypeMessage: "Envie a solicitacao de login em JSON.",
  });
  assertPayloadSize(req, {
    payloadTooLargeMessage: "A solicitacao de login excede o tamanho maximo permitido.",
  });
  assertAllowedPublicOrigin(req, {
    originRequiredMessage: "Nao foi possivel validar a origem da solicitacao de login.",
    originNotAllowedMessage: "A origem da solicitacao de login nao esta autorizada.",
  });
  assertCustomerAuthRateLimit(req, "start");
};

const assertPublicCustomerAuthVerifyRequest = (req) => {
  assertJsonRequest(req, {
    invalidContentTypeMessage: "Envie a validacao do codigo em JSON.",
  });
  assertPayloadSize(req, {
    payloadTooLargeMessage: "A validacao do codigo excede o tamanho maximo permitido.",
  });
  assertAllowedPublicOrigin(req, {
    originRequiredMessage: "Nao foi possivel validar a origem da verificacao do codigo.",
    originNotAllowedMessage: "A origem da verificacao do codigo nao esta autorizada.",
  });
  assertCustomerAuthRateLimit(req, "verify");
};

module.exports = {
  assertPublicOrderRequest,
  assertPublicCustomerAuthStartRequest,
  assertPublicCustomerAuthVerifyRequest,
  getClientIp,
};
