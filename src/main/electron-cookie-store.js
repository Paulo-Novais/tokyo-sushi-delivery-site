"use strict";

const { parseSetCookie } = require("./cookies");

// Guarda os cookies do login na mesma sessão (partição persistente) que a tela
// do Gestor usa. Assim o login feito pelo app vale para as telas do Gestor e
// sobrevive a fechar o app e reiniciar o computador, até o servidor expirar.
const createElectronCookieStore = (electronSession) => ({
  async getCookieHeader(url) {
    const cookies = await electronSession.cookies.get({ url });
    return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  },

  async storeSetCookies(url, headers) {
    const origin = new URL(url).origin;
    for (const header of headers || []) {
      const cookie = parseSetCookie(header);
      if (!cookie) continue;
      if (cookie.remove) {
        await electronSession.cookies.remove(origin, cookie.name).catch(() => {});
        continue;
      }
      await electronSession.cookies.set({
        url: origin,
        name: cookie.name,
        value: cookie.value,
        path: cookie.path || "/",
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: ["lax", "strict", "no_restriction"].includes(cookie.sameSite)
          ? cookie.sameSite
          : cookie.sameSite === "none"
            ? "no_restriction"
            : "lax",
        ...(cookie.expiresAt ? { expirationDate: Math.floor(cookie.expiresAt / 1000) } : {}),
      });
    }
    await electronSession.cookies.flushStore().catch(() => {});
  },

  async clear(url) {
    const cookies = await electronSession.cookies.get({ url });
    for (const cookie of cookies) {
      await electronSession.cookies.remove(new URL(url).origin, cookie.name).catch(() => {});
    }
    await electronSession.cookies.flushStore().catch(() => {});
  },
});

module.exports = { createElectronCookieStore };
