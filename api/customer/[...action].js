const { withRequestTiming } = require("../../lib/request-timing.cjs");
const customerApi = require("../../lib/customer-api.cjs");
const paymentsApi = require("../../lib/payments-api.cjs");

// /api/payments/* também é atendido aqui (vercel.json reescreve para
// /api/customer/__payments/*): o plano da Vercel limita o número de funções.
const isPaymentsRequest = (req) => /\/(?:api\/payments|__payments)(?:\/|$|\?)/.test(String(req.url || "")) ||
  /^__payments(?:\/|$)/.test(String(req.query?.["...action"] || req.query?.action || ""));

module.exports = withRequestTiming((req, res) =>
  isPaymentsRequest(req) ? paymentsApi(req, res) : customerApi(req, res)
);
