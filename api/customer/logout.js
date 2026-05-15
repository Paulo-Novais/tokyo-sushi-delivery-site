const {
  serializeCustomerLoginChallengeClearCookie,
  serializeCustomerLogoutCookie,
} = require("../../lib/customer-auth.cjs");
const { json } = require("../../lib/http.cjs");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
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
      "Set-Cookie": [
        serializeCustomerLogoutCookie(req),
        serializeCustomerLoginChallengeClearCookie(req),
      ],
    }
  );
};
