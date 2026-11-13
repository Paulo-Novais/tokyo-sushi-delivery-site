"use strict";

const { roleLabel } = require("../shared/modules");

// Cliente HTTP do app. Usa as MESMAS rotas do Gestor web:
//   POST /api/admin/login           (mesmo usuário e senha do Gestor)
//   GET  /api/auth/restaurant/session
//   GET  /api/admin/session
//   POST /api/admin/logout
//   GET  /api/admin/catalog/list
//   POST /api/admin/catalog/update  (só { itemId, availabilityState })
// Nenhuma rota nova foi criada no servidor.

class PdvError extends Error {
  constructor(message, { code = "request_error", status = 0, details = null } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const FRIENDLY_ERRORS = Object.freeze({
  invalid_credentials: "Login ou senha inválidos.",
  missing_credentials: "Preencha login e senha para continuar.",
  rate_limited: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  too_many_requests: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  restaurant_selection_required: "Escolha o restaurante para entrar.",
  user_blocked: "Este usuário está bloqueado. Fale com o dono ou gerente do restaurante.",
  user_inactive: "Este usuário está inativo. Fale com o dono ou gerente do restaurante.",
});

const createApiClient = ({ getServerUrl, cookieStore, fetchImpl = globalThis.fetch, timeoutMs = 20000 }) => {
  const request = async (path, { method = "GET", body } = {}) => {
    const origin = getServerUrl();
    const url = `${origin}${path}`;
    const cookie = await cookieStore.getCookieHeader(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(url, {
        method,
        headers: {
          Accept: "application/json",
          // O servidor confere a origem em POST (proteção do navegador contra
          // CSRF). O app fala em nome do próprio site, como a tela do Gestor.
          Origin: origin,
          Referer: `${origin}/admin/`,
          "X-Inovas-Client": "inovas-pdv-desktop",
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (error) {
      throw new PdvError("Sem conexão com o servidor. Confira a internet deste computador.", {
        code: "offline",
      });
    } finally {
      clearTimeout(timer);
    }

    const setCookies =
      typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
    if (setCookies.length) await cookieStore.storeSetCookies(url, setCookies);

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    return { status: response.status, ok: response.ok, data: data || {} };
  };

  const toError = (result, fallback) => {
    const data = result.data || {};
    const code =
      data.errorCode || (typeof data.error === "object" && data.error?.code) || `http_${result.status}`;
    const serverMessage =
      typeof data.error === "string" ? data.error : typeof data.error?.message === "string" ? data.error.message : "";
    return new PdvError(FRIENDLY_ERRORS[code] || serverMessage || fallback, {
      code,
      status: result.status,
      details: data.details || data.error?.details || null,
    });
  };

  const logout = async () => {
    try {
      await request("/api/admin/logout", { method: "POST", body: {} });
    } catch {
      // Sem internet: o cookie é apagado do aparelho de qualquer forma.
    }
    await cookieStore.clear(getServerUrl());
  };

  const login = async ({ identifier, password, restaurantKey = "" }) => {
    const cleanIdentifier = String(identifier || "").trim();
    if (!cleanIdentifier || !password) {
      throw new PdvError(FRIENDLY_ERRORS.missing_credentials, { code: "missing_credentials" });
    }
    const result = await request("/api/admin/login", {
      method: "POST",
      body: {
        identifier: cleanIdentifier,
        password: String(password),
        next: "/admin/",
        ...(restaurantKey ? { restaurantKey } : {}),
      },
    });
    if (!result.ok || result.data.ok !== true) {
      const error = toError(result, "Não foi possível entrar agora.");
      if (error.code === "restaurant_selection_required") {
        const restaurants = Array.isArray(error.details?.restaurants) ? error.details.restaurants : [];
        error.restaurants = restaurants.map((restaurant) => ({
          restaurantKey: String(restaurant.restaurantKey || ""),
          name: String(restaurant.restaurantName || restaurant.name || restaurant.restaurantKey || ""),
          role: roleLabel(restaurant.role),
        }));
      }
      throw error;
    }
    const admin = result.data.admin || {};
    if (admin.userScope === "SYSTEM" || admin.platformScope === true || result.data.redirectTo === "/system") {
      await logout();
      throw new PdvError(
        "Este app é para a equipe do restaurante. A equipe INOVAS usa o System pelo navegador.",
        { code: "system_user" }
      );
    }
    return admin;
  };

  // Quem está conectado, com papel e permissões vindos do servidor.
  const fetchSession = async () => {
    const [restaurantResult, adminResult] = await Promise.all([
      request("/api/auth/restaurant/session"),
      request("/api/admin/session").catch(() => ({ ok: false, data: {} })),
    ]);
    const session = restaurantResult.data?.data?.session;
    if (!restaurantResult.ok || restaurantResult.data?.authenticated !== true || !session) {
      return { authenticated: false };
    }
    const admin = adminResult.ok && adminResult.data?.authenticated ? adminResult.data.admin || {} : {};
    const displayName = session.displayName || admin.displayName || session.login || "";
    return {
      authenticated: true,
      user: {
        login: session.login || admin.login || "",
        displayName,
        role: String(session.role || "").toUpperCase(),
        roleLabel: roleLabel(session.role),
        restaurantKey: session.restaurantKey || admin.restaurantKey || "",
        restaurantName: admin.restaurantName || admin.restaurant || session.restaurantKey || "",
        expiresAt: session.expiresAt || adminResult.data?.expiresAt || null,
        permissions: Array.isArray(session.effectivePermissions) ? session.effectivePermissions : [],
      },
    };
  };

  const listCatalog = async () => {
    const result = await request("/api/admin/catalog/list");
    if (!result.ok) throw toError(result, "Não foi possível carregar o cardápio.");
    const sections = Array.isArray(result.data.sections) ? result.data.sections : [];
    return sections.map((section) => ({
      id: String(section.id || ""),
      title: String(section.title || section.id || "Seção"),
      items: (Array.isArray(section.items) ? section.items : []).map((item) => ({
        id: String(item.id || ""),
        name: String(item.name || item.id || ""),
        category: String(item.category || ""),
        price: Number.isFinite(Number(item.price)) ? Number(item.price) : null,
        image: typeof item.image === "string" ? item.image : "",
        availabilityState: String(item.availabilityState || "active"),
      })),
    }));
  };

  const setAvailability = async (itemId, availabilityState) => {
    if (!["active", "paused"].includes(availabilityState)) {
      throw new PdvError("Estado inválido.", { code: "invalid_state" });
    }
    // Envia SÓ o id e o estado. Preço, nome, foto e descrição não saem do app.
    const result = await request("/api/admin/catalog/update", {
      method: "POST",
      body: { itemId: String(itemId || ""), availabilityState },
    });
    if (!result.ok) throw toError(result, "Não foi possível alterar este prato.");
    return true;
  };

  return { fetchSession, listCatalog, login, logout, request, setAvailability };
};

module.exports = { PdvError, createApiClient };
