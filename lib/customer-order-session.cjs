"use strict";

// Pedido no site só com cliente logado (decisão do Paulo, 19/11/2026).
//
// O nome, o telefone e o e-mail do pedido vêm da SESSÃO do cliente, não do que
// o navegador mandou: ninguém faz pedido (nem vê pedido) no telefone de outra
// pessoa. A sessão precisa ser do mesmo restaurante da requisição.

const { buildHttpError } = require("./http.cjs");
const { readRestaurantSessionToken } = require("./customer-auth.cjs");
const { findCustomerSession } = require("./customer-session-store.cjs");

const getCustomerSessionForRequest = async (req, tenantContext) => {
  const token = readRestaurantSessionToken(req);
  if (!token) return null;
  return findCustomerSession(tenantContext, token);
};

const requireCustomerOrderSession = async (req, tenantContext) => {
  const session = await getCustomerSessionForRequest(req, tenantContext);
  if (!session) {
    throw buildHttpError(401, "Entre na sua conta para fazer o pedido.", "customer_login_required");
  }
  if (!session.phone || !session.customerKey) {
    throw buildHttpError(409, "Informe seu telefone para concluir o pedido.", "customer_phone_required");
  }
  return session;
};

// Troca os dados de cliente do pedido pelos da sessão.
const applySessionToOrderPayload = (payload = {}, session) => ({
  ...payload,
  profile: {
    ...(payload.profile && typeof payload.profile === "object" ? payload.profile : {}),
    id: session.identityId,
    name: session.name || String(payload.profile?.name || "").slice(0, 160),
    phone: session.phone,
    email: session.email || "",
  },
});

module.exports = { applySessionToOrderPayload, getCustomerSessionForRequest, requireCustomerOrderSession };
