const DEFAULT_GRAPH_API_VERSION = "v23.0";
const DEFAULT_TEMPLATE_LANGUAGE = "pt_BR";
const BRAZIL_COUNTRY_CODE = "55";

const parseJsonBody = (body) => {
  if (!body) {
    return {};
  }

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch (error) {
      return {};
    }
  }

  return typeof body === "object" ? body : {};
};

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

const json = (res, statusCode, payload) => {
  res.setHeader("Cache-Control", "no-store");
  return res.status(statusCode).json(payload);
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, {
      error: "Metodo nao permitido.",
      errorCode: "method_not_allowed",
    });
  }

  const body = parseJsonBody(req.body);
  const name = String(body.name || "").trim();
  const phone = normalizeWhatsappPhone(body.phone);
  const code = String(body.code || "").replace(/\D/g, "").slice(0, 6);

  if (!name || phone.length < 12 || code.length !== 6) {
    return json(res, 400, {
      error: "Nome, telefone e codigo validos sao obrigatorios.",
      errorCode: "invalid_payload",
    });
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_VERIFY_TEMPLATE_NAME;
  const templateLanguage =
    process.env.WHATSAPP_VERIFY_TEMPLATE_LANGUAGE || DEFAULT_TEMPLATE_LANGUAGE;
  const graphApiVersion =
    process.env.WHATSAPP_GRAPH_API_VERSION || DEFAULT_GRAPH_API_VERSION;

  if (!accessToken || !phoneNumberId || !templateName) {
    return json(res, 503, {
      error:
        "O envio automatico por WhatsApp ainda nao foi configurado no servidor deste site.",
      errorCode: "whatsapp_not_configured",
    });
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
        to: phone,
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
                  text: code,
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

    return json(res, 502, {
      error: providerMessage,
      errorCode: "whatsapp_provider_error",
      providerStatus: response.status,
    });
  }

  return json(res, 200, {
    ok: true,
    message: `Codigo enviado para ${name} pelo WhatsApp.`,
    provider: "whatsapp-cloud-api",
    messageId:
      (result && Array.isArray(result.messages) && result.messages[0] && result.messages[0].id) || "",
  });
};
