const crypto = require("node:crypto");
const {
  CUSTOMER_LOGIN_CHALLENGE_TTL_SECONDS,
  CUSTOMER_VERIFICATION_CODE_LENGTH,
  createCustomerLoginChallengeToken,
  createCustomerSessionToken,
  getBoundCustomerLoginChallengeFromRequest,
  hashCustomerVerificationCode,
  readCustomerClientToken,
  serializeCustomerLoginChallengeClearCookie,
  serializeCustomerLoginChallengeCookie,
  serializeCustomerLogoutCookie,
  serializeCustomerSessionCookie,
  readRestaurantSessionToken,
  serializeRestaurantSessionClearCookie,
  serializeRestaurantSessionCookie,
} = require("./customer-auth.cjs");
const {
  createHandoffCode,
  getAuthBaseUrl,
  getIdentitySession,
  handleIdentityRequest,
  listSocialProviders,
  redeemHandoffCode,
  saveIdentityPhone,
  toCustomerProfile,
  validateReturnUrl,
} = require("./customer-identity.cjs");
const {
  createCustomerSession,
  revokeCustomerSession,
} = require("./customer-session-store.cjs");
const { getCustomerSessionForRequest } = require("./customer-order-session.cjs");
const { getRequestHeader } = require("./http.cjs");
const { sendCustomerVerificationCode } = require("./customer-verification.cjs");
const { buildHttpError, json, parseJsonBody } = require("./http.cjs");
const { buildCustomerKey, normalizePhone, normalizeText } = require("./order-payload.cjs");
const { getCustomerActiveOrder } = require("./order-store.cjs");
const {
  assertPublicCustomerAuthStartRequest,
  assertPublicCustomerAuthVerifyRequest,
  getClientIp: getDeliveryClientIp,
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
    restaurantKey: tenantContext.restaurantKey,
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
  const challenge = getBoundCustomerLoginChallengeFromRequest(req, {
    restaurantKey: tenantContext.restaurantKey,
  });

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
    restaurantKey: tenantContext.restaurantKey,
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

    // Login por código no WhatsApp: DESATIVADO (19/11/2026). O código fica
    // aqui, sem apagar, até o Paulo decidir. Para religar: remover este bloco.
    if (action === "start" || action === "verify") {
      return json(res, 410, {
        error: "Entre com Google ou com e-mail e senha.",
        errorCode: "customer_whatsapp_login_disabled",
      });
    }

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
  assertSameOrigin(req, getOwnOrigin(req));
  await revokeCustomerSession(tenantContext, readRestaurantSessionToken(req)).catch(() => {});

  return json(
    res,
    200,
    {
      ok: true,
      // O site leva o cliente para sair também do login central.
      centralLogoutUrl: `${getAuthBaseUrl()}/conta/entrar?modo=sair`,
      tenantContext: withTenantContextPayload({}, tenantContext).tenantContext,
    },
    {
      "Set-Cookie": [
        serializeRestaurantSessionClearCookie(req),
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
    const session = await getCustomerSessionForRequest(req, tenantContext);

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


/* ================= Login novo (Google / e-mail e senha) ================= */

const getOwnOrigin = (req) => {
  const host = String(getRequestHeader(req, "x-forwarded-host") || getRequestHeader(req, "host") || "")
    .split(",")[0]
    .trim();
  const forwardedProto = String(getRequestHeader(req, "x-forwarded-proto") || "").split(",")[0].trim();
  const proto = forwardedProto || (/^(localhost|127\.0\.0\.1|[^:]+\.localhost)(:\d+)?$/.test(host) ? "http" : "https");
  return host ? `${proto}://${host}` : "";
};

// Proteção contra outro site disparar ações com o cookie do cliente.
const assertSameOrigin = (req, expectedOrigin) => {
  const origin = String(getRequestHeader(req, "origin") || "").trim();
  if (!origin || !expectedOrigin || origin !== expectedOrigin) {
    throw buildHttpError(403, "Origem nao permitida.", "customer_origin_forbidden");
  }
};

const getCentralOrigin = () => {
  try {
    return new URL(getAuthBaseUrl()).origin;
  } catch {
    return "";
  }
};

const publicIdentity = (user) => {
  const profile = toCustomerProfile(user);
  return { name: profile.name, email: profile.email, phone: profile.phone, needsPhone: !profile.customerKey };
};

// Login central: quem está logado (para a tela /conta/entrar).
const handleAccountMe = async (req, res) => {
  const session = await getIdentitySession(req);
  res.setHeader("Cache-Control", "no-store");
  return json(res, 200, {
    ok: true,
    authenticated: Boolean(session),
    user: session ? publicIdentity(session.user) : null,
    providers: listSocialProviders(),
  });
};

// Login central: telefone pedido uma única vez (quem entrou pelo Google).
const handleAccountPhone = async (req, res) => {
  if (req.method !== "POST") return sendMethodNotAllowed(res, "POST");
  assertSameOrigin(req, getCentralOrigin());
  const session = await getIdentitySession(req);
  if (!session) throw buildHttpError(401, "Entre na sua conta.", "customer_identity_required");
  const payload = parseJsonBody(req.body, { strict: true });
  await saveIdentityPhone(session.user.id, payload.phone);
  return json(res, 200, { ok: true });
};

// Login central: gera o código de uso único e devolve o endereço de volta ao restaurante.
const handleAccountHandoff = async (req, res) => {
  if (req.method !== "POST") return sendMethodNotAllowed(res, "POST");
  assertSameOrigin(req, getCentralOrigin());
  const session = await getIdentitySession(req);
  if (!session) throw buildHttpError(401, "Entre na sua conta.", "customer_identity_required");
  const payload = parseJsonBody(req.body, { strict: true });
  const restaurantKey = normalizeText(payload.restaurantKey, 120);
  const returnUrl = await validateReturnUrl(payload.returnUrl, restaurantKey);
  if (!returnUrl) {
    throw buildHttpError(400, "Endereco de volta nao permitido.", "customer_return_url_forbidden");
  }
  if (!toCustomerProfile(session.user).customerKey) {
    throw buildHttpError(409, "Informe seu telefone para continuar.", "customer_phone_required");
  }
  const code = await createHandoffCode({ user: session.user, restaurantKey, returnUrl });
  returnUrl.searchParams.set("login_code", code);
  return json(res, 200, { ok: true, redirectUrl: returnUrl.toString() });
};

// Login central, depois de "Sair": confere o endereço de volta (sem open redirect).
const handleAccountReturnUrl = async (req, res) => {
  const url = new URL(String(req.url || "/"), "http://localhost");
  const restaurantKey = normalizeText(url.searchParams.get("r"), 120);
  const returnUrl = await validateReturnUrl(url.searchParams.get("volta"), restaurantKey);
  res.setHeader("Cache-Control", "no-store");
  return json(res, 200, { ok: true, url: returnUrl ? returnUrl.toString() : "" });
};

// Site do restaurante: troca o código pela sessão DESTE restaurante.
const handleAuthExchange = async (req, res) => {
  if (req.method !== "POST") return sendMethodNotAllowed(res, "POST");
  await guardSecurity(req, {
    routeType: "customer-auth",
    action: "customer-auth:exchange",
    requireTenant: true,
    rateLimitProfile: "customerAuth",
  });
  const tenantContext = await ensureCustomerTenantContext(req, "public:customer:auth:exchange");
  const ownOrigin = getOwnOrigin(req);
  assertSameOrigin(req, ownOrigin);
  const payload = parseJsonBody(req.body, { strict: true });
  const user = await redeemHandoffCode({
    code: payload.code,
    restaurantKey: tenantContext.restaurantKey,
    origin: ownOrigin,
  });
  if (!user) {
    throw buildHttpError(401, "O login expirou. Entre de novo.", "customer_login_code_invalid");
  }
  const profile = toCustomerProfile(user);
  if (!profile.customerKey) {
    throw buildHttpError(409, "Informe seu telefone para continuar.", "customer_phone_required");
  }
  const { token } = await createCustomerSession(tenantContext, profile);
  return json(
    res,
    200,
    {
      ok: true,
      ...withTenantContextPayload(
        { authenticated: true, customer: { name: profile.name, phone: profile.phone, email: profile.email } },
        tenantContext
      ),
    },
    {
      "Set-Cookie": [
        serializeRestaurantSessionCookie(token, req),
        serializeCustomerLogoutCookie(req),
        serializeCustomerLoginChallengeClearCookie(req),
      ],
    }
  );
};

// Site do restaurante: quem está logado aqui + endereço do login central.
const handleMe = async (req, res) => {
  const tenantContext = await ensureCustomerTenantContext(req, "public:customer:me");
  const session = await getCustomerSessionForRequest(req, tenantContext);
  res.setHeader("Cache-Control", "no-store");
  return json(res, 200, {
    ok: true,
    ...withTenantContextPayload(
      {
        authenticated: Boolean(session),
        customer: session ? { name: session.name, phone: session.phone, email: session.email } : null,
        loginUrl: `${getAuthBaseUrl()}/conta/entrar`,
        restaurantKey: tenantContext.restaurantKey,
      },
      tenantContext
    ),
  });
};

const withErrors = (handler, fallbackCode) => async (req, res) => {
  try {
    return await handler(req, res);
  } catch (error) {
    if (Number(error?.statusCode) >= 400 && Number(error?.statusCode) < 500) {
      recordSecurityFailure(req, { routeType: "customer-auth", action: fallbackCode, reason: error?.errorCode || fallbackCode });
    }
    return json(res, Number(error?.statusCode || 500), {
      error: error?.statusCode ? error.message : "Nao foi possivel concluir agora. Tente de novo.",
      errorCode: error?.errorCode || (error?.statusCode ? fallbackCode : "internal_error"),
    });
  }
};

// Entrega: CEP e localização do endereço pelo servidor (site do restaurante).
const { assertRateLimit, geocodeAddress, lookupCep } = require("./delivery-geo.cjs");

const handleDeliveryGeo = async (req, res, kind) => {
  if (req.method !== "GET") return sendMethodNotAllowed(res, "GET");
  // Só para o site de um restaurante (sem restaurante padrão silencioso).
  await ensureCustomerTenantContext(req, `public:delivery:${kind}`);
  assertRateLimit(getDeliveryClientIp(req));
  const url = getRequestUrl(req);
  const payload =
    kind === "cep"
      ? { address: await lookupCep(url.searchParams.get("cep")) }
      : { location: await geocodeAddress(url.searchParams.get("endereco")) };
  res.setHeader("Cache-Control", "no-store");
  return json(res, 200, { ok: true, ...payload });
};

const handleCustomerApi = async (req, res) => {
  const action = getCustomerActionFromRequest(req);

  // Better Auth (login central): /api/customer/identity/*
  if (action === "identity" || action.startsWith("identity/")) {
    const subPath = action.slice("identity".length).replace(/^\//, "");
    return withErrors((rq, rs) => handleIdentityRequest(rq, rs, subPath), "customer_identity_error")(req, res);
  }

  if (action === "account/me") return withErrors(handleAccountMe, "customer_account_error")(req, res);
  if (action === "account/phone") return withErrors(handleAccountPhone, "customer_phone_error")(req, res);
  if (action === "account/return-url") return withErrors(handleAccountReturnUrl, "customer_return_error")(req, res);
  if (action === "account/handoff") return withErrors(handleAccountHandoff, "customer_handoff_error")(req, res);
  if (action === "auth/exchange") return withErrors(handleAuthExchange, "customer_exchange_error")(req, res);
  if (action === "me") return withErrors(handleMe, "customer_me_error")(req, res);
  if (action === "delivery/cep") return withErrors((rq, rs) => handleDeliveryGeo(rq, rs, "cep"), "delivery_cep_error")(req, res);
  if (action === "delivery/geocode") return withErrors((rq, rs) => handleDeliveryGeo(rq, rs, "geocode"), "delivery_geocode_error")(req, res);

  if (action === "logout") {
    return withErrors(handleLogout, "customer_logout_error")(req, res);
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
