const { getAdminSessionFromRequest } = require("./admin-auth.cjs");
const { buildHttpError } = require("./http.cjs");

const requireAdminSession = (req) => {
  const session = getAdminSessionFromRequest(req);

  if (!session) {
    throw buildHttpError(
      401,
      "Sessao administrativa invalida ou expirada.",
      "admin_session_required"
    );
  }

  return session;
};

module.exports = {
  requireAdminSession,
};
