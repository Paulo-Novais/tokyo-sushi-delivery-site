const { buildHttpError } = require("./http.cjs");
const { CUSTOMER_VERIFICATION_CODE_LENGTH } = require("./customer-auth.cjs");

const DEFAULT_GRAPH_API_VERSION = "v23.0";
const DEFAULT_TEMPLATE_LANGUAGE = "pt_BR";
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

const hasWhatsappDeliveryConfig = () =>
  Boolean(
    String(process.env.WHATSAPP_ACCESS_TOKEN || "").trim() &&
      String(process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim() &&
      String(process.env.WHATSAPP_VERIFY_TEMPLATE_NAME || "").trim()
  );

const sendWhatsappVerificationCode = async ({ name, phone, code }) => {
  const normalizedName = String(name || "").trim();
  const normalizedPhone = normalizeWhatsappPhone(phone);
  const normalizedCode = String(code || "")
    .replace(/\D/g, "")
    .slice(0, CUSTOMER_VERIFICATION_CODE_LENGTH);

  if (!normalizedName || normalizedPhone.length < 12 || normalizedCode.length !== 6) {
    throw buildHttpError(
      400,
      "Nome, telefone e codigo validos sao obrigatorios para enviar a verificacao.",
      "invalid_customer_verification_payload"
    );
  }

  const accessToken = String(process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const templateName = String(process.env.WHATSAPP_VERIFY_TEMPLATE_NAME || "").trim();
  const templateLanguage =
    String(process.env.WHATSAPP_VERIFY_TEMPLATE_LANGUAGE || DEFAULT_TEMPLATE_LANGUAGE).trim() ||
    DEFAULT_TEMPLATE_LANGUAGE;
  const graphApiVersion =
    String(process.env.WHATSAPP_GRAPH_API_VERSION || DEFAULT_GRAPH_API_VERSION).trim() ||
    DEFAULT_GRAPH_API_VERSION;

  if (!hasWhatsappDeliveryConfig()) {
    throw buildHttpError(
      503,
      "O envio automatico por WhatsApp ainda nao foi configurado no servidor deste site.",
      "whatsapp_not_configured"
    );
  }

  const response = await fetch(
    `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: templateLanguage,
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
      }),
    }
  );

  let result = null;

  try {
    result = await response.json();
  } catch (error) {
    result = null;
  }

  if (!response.ok) {
    const providerMessage =
      (result && result.error && result.error.message) ||
      "O WhatsApp recusou o envio do codigo.";

    throw buildHttpError(502, providerMessage, "whatsapp_provider_error", {
      providerStatus: response.status,
    });
  }

  return {
    ok: true,
    message: `Codigo enviado para ${normalizedName} pelo WhatsApp.`,
    provider: "whatsapp-cloud-api",
    messageId:
      (result && Array.isArray(result.messages) && result.messages[0] && result.messages[0].id) ||
      "",
  };
};

const sendCustomerVerificationCode = async ({ name, phone, code }) => {
  try {
    const response = await sendWhatsappVerificationCode({
      name,
      phone,
      code,
    });

    return {
      mode: "whatsapp-api",
      notice: response.message,
      previewCode: "",
    };
  } catch (error) {
    const vercelEnvironment = String(process.env.VERCEL_ENV || "").trim().toLowerCase();
    const allowDevicePreview =
      String(process.env.NODE_ENV || "").trim() !== "production" || vercelEnvironment === "preview";

    if (!allowDevicePreview) {
      throw error;
    }

    return {
      mode: "device-preview",
      notice:
        "O envio automatico por WhatsApp nao respondeu no ambiente atual. Use o codigo provisorio mostrado neste aparelho para concluir a verificacao.",
      previewCode: String(code || "")
        .replace(/\D/g, "")
        .slice(0, CUSTOMER_VERIFICATION_CODE_LENGTH),
    };
  }
};

module.exports = {
  hasWhatsappDeliveryConfig,
  normalizeWhatsappPhone,
  sendCustomerVerificationCode,
  sendWhatsappVerificationCode,
};
