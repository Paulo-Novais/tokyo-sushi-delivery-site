const {
  getAdminAuthConfig,
  getAdminSessionFromRequest,
  hasAdminAuthConfig,
} = require("../../lib/admin-auth.cjs");
const { json } = require("../../lib/http.cjs");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, {
      error: "Metodo nao permitido.",
      errorCode: "method_not_allowed",
    });
  }

  if (!hasAdminAuthConfig()) {
    return json(res, 503, {
      authenticated: false,
      configured: false,
      error: "As credenciais do gestor ainda nao foram configuradas.",
      errorCode: "admin_auth_not_configured",
    });
  }

  const session = getAdminSessionFromRequest(req);

  if (!session) {
    return json(res, 200, {
      authenticated: false,
      configured: true,
    });
  }

  const authConfig = getAdminAuthConfig();

  return json(res, 200, {
    authenticated: true,
    configured: true,
    admin: {
      login: authConfig.login,
      displayName: session.displayName || authConfig.displayName,
    },
    expiresAt: session.expiresAt,
  });
};
