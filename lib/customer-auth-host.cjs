"use strict";

// Endereço do login central do cliente (CUSTOMER_AUTH_URL), sem depender da
// biblioteca de login (o middleware usa este arquivo).
const getCustomerAuthHost = () => {
  const raw = String(process.env.CUSTOMER_AUTH_URL || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    return "";
  }
};

// No endereço central só existem as telas e rotas do login do cliente.
const CUSTOMER_AUTH_HOST_PATH = /^\/(?:conta(?:\/|$)|api\/customer\/(?:identity|account)(?:\/|$)|assets\/|site-images\/|favicon\.ico$|robots\.txt$)/;
const isCustomerAuthHostPath = (pathname = "") => CUSTOMER_AUTH_HOST_PATH.test(String(pathname));

module.exports = { getCustomerAuthHost, isCustomerAuthHostPath };
