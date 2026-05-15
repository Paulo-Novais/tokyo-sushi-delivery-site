const { serializeAdminLogoutCookie } = require("../../lib/admin-auth.cjs");
const { json } = require("../../lib/http.cjs");

module.exports = async (req, res) => {
  if (!["POST", "GET"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return json(res, 405, {
      error: "Metodo nao permitido.",
      errorCode: "method_not_allowed",
    });
  }

  return json(
    res,
    200,
    {
      ok: true,
    },
    {
      "Set-Cookie": serializeAdminLogoutCookie(req),
    }
  );
};
