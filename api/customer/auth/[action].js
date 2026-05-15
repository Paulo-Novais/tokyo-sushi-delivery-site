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
  serializeCustomerSessionCookie,
} = require("../../../lib/customer-auth.cjs");
const { sendCustomerVerificationCode } = require("../../../lib/customer-verification.cjs");
const { buildHttpError, json, parseJsonBody } = require("../../../lib/http.cjs");
const { buildCustomerKey, normalizePhone, normalizeText } = require("../../../lib/order-payload.cjs");
const {
  assertPublicCustomerAuthStartRequest,
  assertPublicCustomerAuthVerifyRequest,
} = require("../../../lib/request-guard.cjs");

const generateVerificationCode = () =>
  crypto.randomInt(0, 10 ** CUSTOMER_VERIFICATION_CODE_LENGTH)
    .toString()
    .padStart(CUSTOMER_VERIFICATION_CODE_LENGTH, "0");

const getActionFromRequest = (req) =>
  new URL(String(req.url || ""), "http://localhost").pathname.split("/").filter(Boolean).pop() || "";

const handleStart = async (req, res) => {
  assertPublicCustomerAuthStartRequest(req);
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
      deliveryMode: delivery.mode,
      notice: delivery.notice,
      previewCode: delivery.previewCode || "",
      expiresInSeconds: CUSTOMER_LOGIN_CHALLENGE_TTL_SECONDS,
    },
    {
      "Set-Cookie": serializeCustomerLoginChallengeCookie(challengeToken, req),
    }
  );
};

const handleVerify = async (req, res) => {
  assertPublicCustomerAuthVerifyRequest(req);
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
      authenticated: true,
    },
    {
      "Set-Cookie": [
        serializeCustomerSessionCookie(sessionToken, req),
        serializeCustomerLoginChallengeClearCookie(req),
      ],
    }
  );
};

module.exports = async (req, res) => {
  try {
    const action = getActionFromRequest(req);

    if (action === "start") {
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return json(res, 405, {
          error: "Metodo nao permitido.",
          errorCode: "method_not_allowed",
        });
      }

      return await handleStart(req, res);
    }

    if (action === "verify") {
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return json(res, 405, {
          error: "Metodo nao permitido.",
          errorCode: "method_not_allowed",
        });
      }

      return await handleVerify(req, res);
    }

    return json(res, 404, {
      error: "Operacao de autenticacao do cliente nao encontrada.",
      errorCode: "customer_auth_action_not_found",
    });
  } catch (error) {
    const action = getActionFromRequest(req);

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
