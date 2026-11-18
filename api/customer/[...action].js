const { withRequestTiming } = require("../../lib/request-timing.cjs");
const customerApi = require("../../lib/customer-api.cjs");
const paymentsApi = require("../../lib/payments-api.cjs");
const channelsApi = require("../../lib/channels-api.cjs");

// /api/payments/* também é atendido aqui (vercel.json reescreve para
// /api/customer/__payments/*): o plano da Vercel limita o número de funções.
const isPaymentsRequest = (req) => /\/(?:api\/payments|__payments)(?:\/|$|\?)/.test(String(req.url || "")) ||
  /^__payments(?:\/|$)/.test(String(req.query?.["...action"] || req.query?.action || ""));

// /api/channels/* (iFood, 99Food, Uber Eats) também: reescrito para __channels.
const isChannelsRequest = (req) => /\/(?:api\/channels|__channels)(?:\/|$|\?)/.test(String(req.url || "")) ||
  /^__channels(?:\/|$)/.test(String(req.query?.["...action"] || req.query?.action || ""));

module.exports = withRequestTiming((req, res) =>
  isPaymentsRequest(req) ? paymentsApi(req, res) : isChannelsRequest(req) ? channelsApi(req, res) : customerApi(req, res)
);
