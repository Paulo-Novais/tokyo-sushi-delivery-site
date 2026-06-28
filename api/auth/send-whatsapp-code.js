const { json, parseJsonBody } = require("../../lib/http.cjs");
const { sendWhatsappVerificationCode } = require("../../lib/customer-verification.cjs");
const {
  getRequestTenantContext,
  withTenantContextPayload,
} = require("../../lib/tenant-context.cjs");
const { guardSecurity, recordSecurityFailure } = require("../../lib/security-guardian.cjs");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, {
      error: "Metodo nao permitido.",
      errorCode: "method_not_allowed",
    });
  }

  try {
    await guardSecurity(req, {
      routeType: "integration",
      action: "whatsapp-code",
      requireTenant: true,
      rateLimitProfile: "customerAuth",
    });
    const tenantContext = await getRequestTenantContext(req, {
      source: "public:whatsapp-code",
    });
    const body = parseJsonBody(req.body, { strict: true });
    const response = await sendWhatsappVerificationCode({
      name: body.name,
      phone: body.phone,
      code: body.code,
    });

    return json(res, 200, {
      ok: true,
      ...withTenantContextPayload(
        {
          message: response.message,
          provider: response.provider,
          messageId: response.messageId,
        },
        tenantContext
      ),
    });
  } catch (error) {
    recordSecurityFailure(req, {
      routeType: "integration",
      action: "whatsapp-code",
      reason: error?.errorCode || "whatsapp_code_rejected",
    });

    return json(res, Number(error?.statusCode || 500), {
      error: error?.message || "Nao foi possivel enviar o codigo pelo WhatsApp.",
      errorCode:
        error?.errorCode || (error?.statusCode ? "whatsapp_send_error" : "internal_error"),
      providerStatus: error?.providerStatus || undefined,
    });
  }
};
