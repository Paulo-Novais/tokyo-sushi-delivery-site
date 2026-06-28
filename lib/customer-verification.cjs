const { CUSTOMER_VERIFICATION_CODE_LENGTH } = require("./customer-auth.cjs");
const {
  getWhatsappCloudConfig,
  normalizeWhatsappPhone,
  sendWhatsappVerificationTemplate,
} = require("./whatsapp-cloud.cjs");

const hasWhatsappDeliveryConfig = () => getWhatsappCloudConfig().hasVerificationTemplateConfig;

const sendWhatsappVerificationCode = async ({ name, phone, code }) => {
  const normalizedCode = String(code || "")
    .replace(/\D/g, "")
    .slice(0, CUSTOMER_VERIFICATION_CODE_LENGTH);

  return sendWhatsappVerificationTemplate({
    name,
    phone,
    code: normalizedCode,
  });
};

const shouldAllowDevicePreviewFallback = (error) => {
  const vercelEnvironment = String(process.env.VERCEL_ENV || "").trim().toLowerCase();

  if (error?.errorCode === "whatsapp_not_configured") {
    return true;
  }

  return (
    String(process.env.NODE_ENV || "").trim() !== "production" || vercelEnvironment === "preview"
  );
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
    if (!shouldAllowDevicePreviewFallback(error)) {
      throw error;
    }

    return {
      mode: "device-preview",
      notice:
        error?.errorCode === "whatsapp_not_configured"
          ? "O WhatsApp ainda nao esta ativo neste ambiente. Use o codigo mostrado na tela para concluir a verificacao temporariamente."
          : "O envio automatico por WhatsApp nao respondeu no ambiente atual. Use o codigo provisorio mostrado neste aparelho para concluir a verificacao.",
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
