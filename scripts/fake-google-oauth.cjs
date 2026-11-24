"use strict";

// SÓ PARA TESTES LOCAIS: simula a resposta do Google no "Entrar com Google".
// O teste escolhe a pessoa no código de autorização:
//   code = base64url(JSON {sub, email, email_verified, name})
// Recusa rodar em produção.

const TOKEN_URL = "https://oauth2.googleapis.com/token";

const base64url = (value) => Buffer.from(value).toString("base64url");
const unsignedJwt = (claims) =>
  `${base64url(JSON.stringify({ alg: "none", typ: "JWT" }))}.${base64url(JSON.stringify(claims))}.`;

const installFakeGoogle = () => {
  if (String(process.env.NODE_ENV || "") === "production" || String(process.env.VERCEL_ENV || "") === "production") {
    throw new Error("fake-google-oauth nunca roda em produção.");
  }
  if (globalThis.__inovasFakeGoogleInstalled) return;
  globalThis.__inovasFakeGoogleInstalled = true;
  process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "fake-google-client.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "fake-google-secret-local-only";
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || String(input);
    if (!url.startsWith(TOKEN_URL)) return realFetch(input, init);
    const body = init.body instanceof URLSearchParams ? init.body : new URLSearchParams(String(init.body || ""));
    let profile = {};
    try {
      profile = JSON.parse(Buffer.from(String(body.get("code") || ""), "base64url").toString("utf8"));
    } catch {
      return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400, headers: { "content-type": "application/json" } });
    }
    const now = Math.floor(Date.now() / 1000);
    const idToken = unsignedJwt({
      iss: "https://accounts.google.com",
      aud: process.env.GOOGLE_CLIENT_ID,
      sub: String(profile.sub || "fake-sub"),
      email: String(profile.email || "").toLowerCase(),
      email_verified: profile.email_verified !== false,
      name: profile.name || "Cliente Google",
      iat: now,
      exp: now + 3600,
    });
    return new Response(
      JSON.stringify({ access_token: `fake-access-${now}`, expires_in: 3600, token_type: "Bearer", scope: "openid email profile", id_token: idToken }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };
};

const buildFakeGoogleCode = (profile) => Buffer.from(JSON.stringify(profile)).toString("base64url");

module.exports = { buildFakeGoogleCode, installFakeGoogle };
