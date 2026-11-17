"use strict";

// Licença do INOVAS PDV (caixa local / offline).
//
// Toda vez que o app do caixa fala com a nuvem, recebe um "passe" assinado
// válido por 24 h. Sem internet, o app mostra a contagem regressiva até o fim
// do passe; ao zerar, bloqueia e faz logout. O passe só é emitido para
// restaurante com assinatura em dia.
//
// Assinatura Ed25519: a nuvem assina com a chave privada (variável de
// ambiente, nunca no código); o app só tem a chave pública e confere. Ninguém
// consegue criar ou esticar um passe editando arquivos no computador.
//
// Formato: base64url(JSON do passe) + "." + base64url(assinatura).

const crypto = require("node:crypto");

const LEASE_VERSION = 1;
const LEASE_TTL_MS = 24 * 60 * 60 * 1000;

const toBase64Url = (buffer) => Buffer.from(buffer).toString("base64url");
const fromBase64Url = (text) => Buffer.from(String(text || ""), "base64url");

const requireText = (value, field) => {
  const text = String(value || "").trim();
  if (!text) throw new TypeError(`Passe do PDV sem ${field}.`);
  return text;
};

// Cria o passe. Só chamar depois de conferir sessão, restaurante e assinatura.
const createLeaseToken = ({
  restaurantId,
  tenantId,
  deviceId,
  subscriptionActive,
  privateKeyPem,
  now = Date.now(),
  ttlMs = LEASE_TTL_MS,
}) => {
  if (subscriptionActive !== true) {
    throw Object.assign(new Error("Assinatura do restaurante não está em dia."), {
      statusCode: 402,
      errorCode: "pdv_subscription_inactive",
    });
  }
  const payload = {
    v: LEASE_VERSION,
    restaurantId: requireText(restaurantId, "restaurante"),
    tenantId: requireText(tenantId, "tenant"),
    deviceId: requireText(deviceId, "computador"),
    issuedAt: now,
    expiresAt: now + ttlMs,
  };
  const body = Buffer.from(JSON.stringify(payload));
  const signature = crypto.sign(null, body, crypto.createPrivateKey(requireText(privateKeyPem, "chave")));
  return { token: `${toBase64Url(body)}.${toBase64Url(signature)}`, payload };
};

// Confere o passe com a chave pública. Devolve o conteúdo ou null.
const verifyLeaseToken = (token, publicKeyPem) => {
  const [bodyPart, signaturePart, extra] = String(token || "").split(".");
  if (!bodyPart || !signaturePart || extra !== undefined) return null;
  let body;
  let payload;
  try {
    body = fromBase64Url(bodyPart);
    const valid = crypto.verify(null, body, crypto.createPublicKey(publicKeyPem), fromBase64Url(signaturePart));
    if (!valid) return null;
    payload = JSON.parse(body.toString("utf8"));
  } catch {
    return null;
  }
  if (
    !payload ||
    payload.v !== LEASE_VERSION ||
    !Number.isFinite(payload.issuedAt) ||
    !Number.isFinite(payload.expiresAt) ||
    payload.expiresAt <= payload.issuedAt ||
    payload.expiresAt - payload.issuedAt > LEASE_TTL_MS ||
    !payload.restaurantId ||
    !payload.tenantId ||
    !payload.deviceId
  ) {
    return null;
  }
  return payload;
};

module.exports = {
  LEASE_TTL_MS,
  LEASE_VERSION,
  createLeaseToken,
  verifyLeaseToken,
};
