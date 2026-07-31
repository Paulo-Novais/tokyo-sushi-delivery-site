const crypto = require("node:crypto");
const {
  CUSTOMER_LOGIN_CHALLENGE_TTL_SECONDS,
  CUSTOMER_VERIFICATION_CODE_LENGTH,
  createCustomerLoginChallengeToken,
  createCustomerSessionToken,
  getBoundCustomerLoginChallengeFromRequest,
  getBoundCustomerSessionFromRequest,
  hashCustomerVerificationCode,
  readCustomerClientToken,
  serializeCustomerLoginChallengeClearCookie,
  serializeCustomerLoginChallengeCookie,
  serializeCustomerLogoutCookie,
  serializeCustomerSessionCookie,
} = require("./customer-auth.cjs");
const { sendCustomerVerificationCode } = require("./customer-verification.cjs");
const { buildHttpError, json, parseJsonBody } = require("./http.cjs");
const { buildCustomerKey, normalizePhone, normalizeText } = require("./order-payload.cjs");
const { getCustomerActiveOrder } = require("./order-store.cjs");
const {
  assertPublicCustomerAuthStartRequest,
  assertPublicCustomerAuthVerifyRequest,
} = require("./request-guard.cjs");
const {
  getRequestTenantContext,
  withTenantContextPayload,
} = require("./tenant-context.cjs");
const { guardSecurity, recordSecurityFailure } = require("./security-guardian.cjs");
const { runWithDatabaseScope } = require("./tenant-sql.cjs");

const getRequestUrl = (req) => new URL(String(req.url || ""), "http://localhost");

const normalizeActionSegments = (value) =>
  String(value || "")
    .split("/")
    .map((entry) => entry.trim())
    .filter(Boolean);

const getCustomerActionFromRequest = (req) => {
  const requestUrl = getRequestUrl(req);
  const segments = requestUrl.pathname.split("/").filter(Boolean).slice(2);
  const queryAction =
    requestUrl.searchParams.get("action") || requestUrl.searchParams.get("...action");

  if (
    queryAction &&
    (!segments.length || (segments.length === 1 && /^\[\.\.\..+\]$/.test(segments[0])))
  ) {
    return normalizeActionSegments(queryAction).join("/");
  }

  return segments.join("/");
};

const getCustomerAuthActionFromRequest = (req) => {
  const action = getCustomerActionFromRequest(req);
  const segments = normalizeActionSegments(action);

  if (segments[0] === "auth") {
    return segments[segments.length - 1] || "";
  }

  return action;
};

const sendMethodNotAllowed = (res, allow) => {
  res.setHeader("Allow", allow);
  return json(res, 405, {
    error: "Metodo nao permitido.",
    errorCode: "method_not_allowed",
  });
};

const generateVerificationCode = () =>
  crypto.randomInt(0, 10 ** CUSTOMER_VERIFICATION_CODE_LENGTH)
    .toString()
    .padStart(CUSTOMER_VERIFICATION_CODE_LENGTH, "0");

const ensureCustomerTenantContext = (req, source = "public:customer") =>
  getRequestTenantContext(req, { source });

const handleStart = async (req, res) => {
  assertPublicCustomerAuthStartRequest(req);
  const tenantContext = await ensureCustomerTenantContext(req, "public:customer:auth:start");
  const payload = parseJsonBody(req.body, { strict: true });
  const name = normalizeText(payload.name, 160);
  const phone = normalizePhone(payload.phone);
  const clientToken = readCustomerClientToken(req);

  if (!clientToken) {
    throw buildHttpError(
      400,
      "Nao foi possivel confirmar o identificador seguro deste aparelho. Atualize a pagina e tente novamente.",
      "missing_customer_client_token"
    );
  }

  if (!name) {
    throw buildHttpError(400, "Informe seu nome para continuar.", "missing_customer_name");
  }

  if (phone.length < 10) {
    throw buildHttpError(400, "Informe um telefone valido para continuar.", "invalid_customer_phone");
  }

  const code = generateVerificationCode();
  const customerKey = buildCustomerKey({
    phone,
    email: "",
    profileId: "",
  });
  const challengeToken = createCustomerLoginChallengeToken({
    customerKey,
    clientToken,
    code,
  });
  const delivery = await sendCustomerVerificationCode({
    name,
    phone,
    code,
  });

  return json(
    res,
    200,
    {
      ok: true,
      ...withTenantContextPayload(
        {
          deliveryMode: delivery.mode,
          notice: delivery.notice,
          previewCode: delivery.previewCode || "",
          expiresInSeconds: CUSTOMER_LOGIN_CHALLENGE_TTL_SECONDS,
        },
        tenantContext
      ),
    },
    {
      "Set-Cookie": serializeCustomerLoginChallengeCookie(challengeToken, req),
    }
  );
};

const handleVerify = async (req, res) => {
  assertPublicCustomerAuthVerifyRequest(req);
  const tenantContext = await ensureCustomerTenantContext(req, "public:customer:auth:verify");
  const payload = parseJsonBody(req.body, { strict: true });
  const code = String(payload.code || "")
    .replace(/\D/g, "")
    .slice(0, CUSTOMER_VERIFICATION_CODE_LENGTH);
  const challenge = getBoundCustomerLoginChallengeFromRequest(req);

  if (!challenge) {
    throw buildHttpError(
      401,
      "O codigo desta tentativa expirou ou nao pertence a este aparelho. Solicite um novo codigo.",
      "customer_login_challenge_required"
    );
  }

  if (code.length !== CUSTOMER_VERIFICATION_CODE_LENGTH) {
    throw buildHttpError(
      400,
      `Digite os ${CUSTOMER_VERIFICATION_CODE_LENGTH} digitos do codigo recebido.`,
      "invalid_customer_verification_code"
    );
  }

  if (hashCustomerVerificationCode(code) !== challenge.codeHash) {
    throw buildHttpError(
      401,
      "Codigo invalido. Confira os digitos recebidos e tente novamente.",
      "invalid_customer_verification_code"
    );
  }

  const clientToken = readCustomerClientToken(req);
  const sessionToken = createCustomerSessionToken({
    customerKey: challenge.customerKey,
    clientToken,
  });

  return json(
    res,
    200,
    {
      ok: true,
      ...withTenantContextPayload(
        {
          authenticated: true,
        },
        tenantContext
      ),
    },
    {
      "Set-Cookie": [
        serializeCustomerSessionCookie(sessionToken, req),
        serializeCustomerLoginChallengeClearCookie(req),
      ],
    }
  );
};

const handleCustomerAuth = async (req, res) => {
  try {
    const action = getCustomerAuthActionFromRequest(req);

    if (action === "start") {
      if (req.method !== "POST") {
        return sendMethodNotAllowed(res, "POST");
      }

      await guardSecurity(req, {
        routeType: "customer-auth",
        action: "customer-auth:start",
        requireTenant: true,
        rateLimitProfile: "customerAuth",
      });
      return await handleStart(req, res);
    }

    if (action === "verify") {
      if (req.method !== "POST") {
        return sendMethodNotAllowed(res, "POST");
      }

      await guardSecurity(req, {
        routeType: "customer-auth",
        action: "customer-auth:verify",
        requireTenant: true,
        rateLimitProfile: "customerAuth",
      });
      return await handleVerify(req, res);
    }

    return json(res, 404, {
      error: "Operacao de autenticacao do cliente nao encontrada.",
      errorCode: "customer_auth_action_not_found",
    });
  } catch (error) {
    const action = getCustomerAuthActionFromRequest(req);
    recordSecurityFailure(req, {
      routeType: "customer-auth",
      action: `customer-auth:${action}`,
      reason: error?.errorCode || "customer_auth_rejected",
    });

    return json(res, Number(error?.statusCode || 500), {
      error:
        error?.message ||
        (action === "verify"
          ? "Nao foi possivel validar o codigo do cliente."
          : "Nao foi possivel iniciar a verificacao do cliente."),
      errorCode:
        error?.errorCode ||
        (error?.statusCode
          ? action === "verify"
            ? "customer_auth_verify_error"
            : "customer_auth_start_error"
          : "internal_error"),
      providerStatus: error?.providerStatus || undefined,
    });
  }
};

const handleLogout = async (req, res) => {
  if (req.method !== "POST") {
    return sendMethodNotAllowed(res, "POST");
  }

  const tenantContext = await ensureCustomerTenantContext(req, "public:customer:logout");

  return json(
    res,
    200,
    {
      ok: true,
      tenantContext: withTenantContextPayload({}, tenantContext).tenantContext,
    },
    {
      "Set-Cookie": [
        serializeCustomerLogoutCookie(req),
        serializeCustomerLoginChallengeClearCookie(req),
      ],
    }
  );
};

const handleActiveOrder = async (req, res) => {
  if (req.method !== "GET") {
    return sendMethodNotAllowed(res, "GET");
  }

  try {
    const tenantContext = await ensureCustomerTenantContext(req, "public:customer:orders:active");
    const session = getBoundCustomerSessionFromRequest(req);

    if (!session) {
      return json(res, 200, {
        ok: true,
        ...withTenantContextPayload(
          {
            authenticated: false,
            hasActiveOrder: false,
            order: null,
          },
          tenantContext
        ),
      });
    }

    const payload = await runWithDatabaseScope(
      {
        audience: "public",
        customerKey: session.customerKey,
        tenantId: tenantContext.tenantId,
        restaurantId: tenantContext.restaurantId,
        restaurantKey: tenantContext.restaurantKey,
      },
      () => getCustomerActiveOrder(session.customerKey, { tenantContext })
    );

    return json(res, 200, {
      ok: true,
      authenticated: true,
      ...withTenantContextPayload(payload, tenantContext),
    });
  } catch (error) {
    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || "Nao foi possivel consultar o pedido ativo do cliente.",
      errorCode:
        error?.errorCode || (error?.statusCode ? "customer_active_order_error" : "internal_error"),
    });
  }
};

const handleCustomerApi = async (req, res) => {
  const action = getCustomerActionFromRequest(req);

  if (action === "logout") {
    return handleLogout(req, res);
  }

  if (action === "orders/active") {
    return handleActiveOrder(req, res);
  }

  if (action.startsWith("auth/") || action === "start" || action === "verify") {
    return handleCustomerAuth(req, res);
  }

  return json(res, 404, {
    error: "Operacao do cliente nao encontrada.",
    errorCode: "customer_action_not_found",
  });
};

module.exports = handleCustomerApi;
