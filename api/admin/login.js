const {
  createAdminSessionToken,
  getAdminAuthConfig,
  hasAdminAuthConfig,
  normalizeIdentifier,
  serializeAdminSessionCookie,
  verifyAdminPassword,
} = require("../../lib/admin-auth.cjs");
const { json, parseJsonBody } = require("../../lib/http.cjs");

const getSafeRedirectPath = (value) => {
  const candidate = String(value || "").trim();

  if (!candidate.startsWith("/admin")) {
    return "/admin/";
  }

  return candidate;
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, {
      error: "Metodo nao permitido.",
      errorCode: "method_not_allowed",
    });
  }

  if (!hasAdminAuthConfig()) {
    return json(res, 503, {
      error:
        "As credenciais do gestor ainda nao foram configuradas no servidor.",
      errorCode: "admin_auth_not_configured",
    });
  }

  const payload = parseJsonBody(req.body, { strict: true });
  const identifier = normalizeIdentifier(payload.identifier);
  const password = String(payload.password || "");
  const { login, displayName } = getAdminAuthConfig();

  if (!identifier || !password) {
    return json(res, 400, {
      error: "Login e senha sao obrigatorios.",
      errorCode: "missing_credentials",
    });
  }

  if (identifier !== normalizeIdentifier(login) || !verifyAdminPassword(password)) {
    return json(res, 401, {
      error: "Login ou senha invalidos.",
      errorCode: "invalid_credentials",
    });
  }

  const sessionToken = createAdminSessionToken({
    login,
    displayName,
  });

  return json(
    res,
    200,
    {
      ok: true,
      redirectTo: getSafeRedirectPath(payload.next),
      admin: {
        login,
        displayName,
      },
    },
    {
      "Set-Cookie": serializeAdminSessionCookie(sessionToken, req),
    }
  );
};
