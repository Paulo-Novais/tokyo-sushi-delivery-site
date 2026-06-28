const { buildHttpError } = require("./http.cjs");

const DEFAULT_GRAPH_API_VERSION = "v23.0";
const DEFAULT_TEMPLATE_LANGUAGE = "pt_BR";
const DEFAULT_REQUEST_TIMEOUT_MS = 12000;
const BRAZIL_COUNTRY_CODE = "55";

const normalizePhone = (value) => String(value || "").replace(/\D/g, "").slice(0, 15);

const normalizeWhatsappPhone = (value) => {
  const digits = normalizePhone(value);

  if (!digits) {
    return "";
  }

  if (digits.startsWith(BRAZIL_COUNTRY_CODE) && digits.length >= 12) {
    return digits;
  }

  if (digits.length >= 10 && digits.length <= 11) {
    return `${BRAZIL_COUNTRY_CODE}${digits}`;
  }

  return digits;
};

const maskPhoneForLogs = (value) => {
  const digits = normalizeWhatsappPhone(value);

  if (!digits) {
    return "";
  }

  if (digits.length <= 4) {
    return digits;
  }

  return `${digits.slice(0, 4)}***${digits.slice(-3)}`;
};

const normalizeGraphApiVersion = (value = DEFAULT_GRAPH_API_VERSION) => {
  const normalizedValue = String(value || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  return normalizedValue || DEFAULT_GRAPH_API_VERSION;
};

const buildWhatsappMessagesUrl = ({ graphApiVersion = DEFAULT_GRAPH_API_VERSION, phoneNumberId }) => {
  const normalizedVersion = normalizeGraphApiVersion(graphApiVersion);
  const normalizedPhoneNumberId = String(phoneNumberId || "").trim().replace(/^\/+/, "").replace(/\/+$/, "");

  return `https://graph.facebook.com/${normalizedVersion}/${normalizedPhoneNumberId}/messages`;
};

const getWhatsappCloudConfig = () => {
  const accessToken = String(process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const templateName = String(process.env.WHATSAPP_VERIFY_TEMPLATE_NAME || "").trim();
  const templateLanguage =
    String(process.env.WHATSAPP_VERIFY_TEMPLATE_LANGUAGE || DEFAULT_TEMPLATE_LANGUAGE).trim() ||
    DEFAULT_TEMPLATE_LANGUAGE;
  const graphApiVersion = normalizeGraphApiVersion(
    process.env.WHATSAPP_GRAPH_API_VERSION || DEFAULT_GRAPH_API_VERSION
  );

  return {
    accessToken,
    phoneNumberId,
    templateName,
    templateLanguage,
    graphApiVersion,
    hasCloudApiConfig: Boolean(accessToken && phoneNumberId),
    hasVerificationTemplateConfig: Boolean(accessToken && phoneNumberId && templateName),
  };
};

const parseProviderResponse = async (response) => {
  let rawBody = "";

  try {
    rawBody = await response.text();
  } catch (error) {
    rawBody = "";
  }

  if (!rawBody) {
    return {
      rawBody: "",
      jsonBody: null,
    };
  }

  try {
    return {
      rawBody,
      jsonBody: JSON.parse(rawBody),
    };
  } catch (error) {
    return {
      rawBody,
      jsonBody: null,
    };
  }
};

const truncateForLog = (value, maxLength = 400) => {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "";
  }

  return normalizedValue.length <= maxLength
    ? normalizedValue
    : `${normalizedValue.slice(0, maxLength)}...`;
};

const logWhatsappEvent = (level, eventName, details = {}) => {
  const logger =
    (typeof console[level] === "function" && console[level]) ||
    console.log;

  logger(`[whatsapp] ${eventName}`, details);
};

const sendWhatsappCloudMessage = async ({
  payload,
  context = {},
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
} = {}) => {
  const config = getWhatsappCloudConfig();

  if (!config.hasCloudApiConfig) {
    throw buildHttpError(
      503,
      "A integracao do WhatsApp ainda nao foi configurada completamente neste servidor.",
      "whatsapp_not_configured"
    );
  }

  const requestUrl = buildWhatsappMessagesUrl({
    graphApiVersion: config.graphApiVersion,
    phoneNumberId: config.phoneNumberId,
  });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let response;

  try {
    response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    const timeoutReached = error?.name === "AbortError";

    logWhatsappEvent("error", timeoutReached ? "request_timeout" : "request_failed", {
      endpoint: requestUrl,
      graphApiVersion: config.graphApiVersion,
      phoneNumberIdSuffix: config.phoneNumberId.slice(-6),
      timeoutMs,
      reason: timeoutReached ? "timeout" : "network_error",
      errorName: error?.name || "",
      errorMessage: error?.message || "",
      ...context,
    });

    throw buildHttpError(
      502,
      timeoutReached
        ? "O WhatsApp nao respondeu a tempo."
        : "Nao foi possivel conectar com a API do WhatsApp.",
      "whatsapp_request_failed",
      {
        providerStatus: 0,
      }
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const { rawBody, jsonBody } = await parseProviderResponse(response);
  const providerError = jsonBody?.error || null;
  const messageId =
    (Array.isArray(jsonBody?.messages) && jsonBody.messages[0] && jsonBody.messages[0].id) || "";

  if (!response.ok) {
    const providerMessage =
      providerError?.message ||
      (rawBody ? truncateForLog(rawBody, 200) : "") ||
      "O WhatsApp recusou o envio da mensagem.";

    logWhatsappEvent("error", "provider_rejected", {
      endpoint: requestUrl,
      graphApiVersion: config.graphApiVersion,
      phoneNumberIdSuffix: config.phoneNumberId.slice(-6),
      httpStatus: response.status,
      providerMessage,
      providerCode: providerError?.code,
      providerType: providerError?.type,
      providerSubcode: providerError?.error_subcode,
      responseBody: truncateForLog(rawBody),
      ...context,
    });

    throw buildHttpError(502, providerMessage, "whatsapp_provider_error", {
      providerStatus: response.status,
      providerErrorCode: providerError?.code,
      providerErrorType: providerError?.type,
      providerErrorSubcode: providerError?.error_subcode,
    });
  }

  logWhatsappEvent("info", "message_sent", {
    endpoint: requestUrl,
    graphApiVersion: config.graphApiVersion,
    phoneNumberIdSuffix: config.phoneNumberId.slice(-6),
    httpStatus: response.status,
    messageId,
    ...context,
  });

  return {
    ok: true,
    providerStatus: response.status,
    messageId,
    response: jsonBody,
  };
};

const sendWhatsappVerificationTemplate = async ({ name, phone, code }) => {
  const normalizedName = String(name || "").trim();
  const normalizedPhone = normalizeWhatsappPhone(phone);
  const normalizedCode = String(code || "").replace(/\D/g, "").slice(0, 6);
  const config = getWhatsappCloudConfig();

  if (!normalizedName || normalizedPhone.length < 12 || normalizedCode.length !== 6) {
    throw buildHttpError(
      400,
      "Nome, telefone e codigo validos sao obrigatorios para enviar a verificacao.",
      "invalid_customer_verification_payload"
    );
  }

  if (!config.hasVerificationTemplateConfig) {
    throw buildHttpError(
      503,
      "O envio automatico por WhatsApp ainda nao foi configurado no servidor deste site.",
      "whatsapp_not_configured"
    );
  }

  const response = await sendWhatsappCloudMessage({
    payload: {
      messaging_product: "whatsapp",
      to: normalizedPhone,
      type: "template",
      template: {
        name: config.templateName,
        language: {
          code: config.templateLanguage,
        },
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: normalizedCode,
              },
            ],
          },
        ],
      },
    },
    context: {
      flow: "customer_verification",
      messageType: "template",
      templateName: config.templateName,
      to: maskPhoneForLogs(normalizedPhone),
    },
  });

  return {
    ok: true,
    message: `Codigo enviado para ${normalizedName} pelo WhatsApp.`,
    provider: "whatsapp-cloud-api",
    messageId: response.messageId,
  };
};

module.exports = {
  DEFAULT_GRAPH_API_VERSION,
  DEFAULT_TEMPLATE_LANGUAGE,
  buildWhatsappMessagesUrl,
  getWhatsappCloudConfig,
  maskPhoneForLogs,
  normalizeWhatsappPhone,
  sendWhatsappCloudMessage,
  sendWhatsappVerificationTemplate,
};
