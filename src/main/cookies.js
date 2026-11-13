"use strict";

// Leitura de cabeçalhos Set-Cookie e um cofre de cookies em memória (usado nos
// testes). No app, o cofre real é o da sessão do Electron (electron-cookie-store.js).

const parseSetCookie = (header, now = Date.now()) => {
  const parts = String(header || "").split(";");
  const first = parts.shift() || "";
  const eq = first.indexOf("=");
  if (eq <= 0) return null;
  const cookie = {
    name: first.slice(0, eq).trim(),
    value: first.slice(eq + 1).trim(),
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "lax",
    expiresAt: null, // null = cookie de sessão do navegador
    remove: false,
  };
  for (const part of parts) {
    const [rawKey, ...rest] = part.split("=");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join("=").trim();
    if (key === "path" && value) cookie.path = value;
    else if (key === "domain" && value) cookie.domain = value.replace(/^\./, "");
    else if (key === "httponly") cookie.httpOnly = true;
    else if (key === "secure") cookie.secure = true;
    else if (key === "samesite") cookie.sameSite = value.toLowerCase() || "lax";
    else if (key === "max-age") {
      const seconds = Number(value);
      if (Number.isFinite(seconds)) {
        if (seconds <= 0) cookie.remove = true;
        else cookie.expiresAt = now + seconds * 1000;
      }
    } else if (key === "expires" && cookie.expiresAt === null && !cookie.remove) {
      const date = Date.parse(value);
      if (Number.isFinite(date)) {
        if (date <= now) cookie.remove = true;
        else cookie.expiresAt = date;
      }
    }
  }
  if (cookie.value === "" && cookie.expiresAt === null) cookie.remove = true;
  return cookie;
};

const createMemoryCookieStore = () => {
  const jar = new Map(); // name -> cookie
  return {
    async getCookieHeader() {
      const now = Date.now();
      return [...jar.values()]
        .filter((cookie) => cookie.expiresAt === null || cookie.expiresAt > now)
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join("; ");
    },
    async storeSetCookies(_url, headers) {
      for (const header of headers || []) {
        const cookie = parseSetCookie(header);
        if (!cookie) continue;
        if (cookie.remove) jar.delete(cookie.name);
        else jar.set(cookie.name, cookie);
      }
    },
    async clear() {
      jar.clear();
    },
    _jar: jar,
  };
};

module.exports = { createMemoryCookieStore, parseSetCookie };
