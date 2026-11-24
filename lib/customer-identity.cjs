"use strict";

// Identidade do CLIENTE (quem faz pedido nos sites dos restaurantes).
//
// - Biblioteca: Better Auth (gratuita, código aberto). Entrar com Google,
//   criar conta com e-mail e senha, esqueci minha senha. Facebook entra depois
//   só com configuração (ver addSocialProviders).
// - A identidade é única na plataforma; os dados de cada restaurante
//   (pedidos, endereços, histórico) continuam separados por restaurante.
// - O login acontece num endereço central (CUSTOMER_AUTH_URL, ex.:
//   https://login.inovasfood.com.br). Depois do login, o cliente volta ao site
//   do restaurante com um código de uso único (60 s), trocado pela sessão
//   daquele restaurante (lib/customer-session-store.cjs).
// - Nada aqui é login da equipe (Gestor/Sistema): aquilo fica em domain-auth.
//
// Banco: CUSTOMER_AUTH_DATABASE_URL (usuário de banco próprio, que só enxerga
// as tabelas customer_auth_*). Sem ele, fora de produção, usa memória
// (testes). Em produção sem ele, o login falha fechado.

const crypto = require("node:crypto");
const { buildHttpError } = require("./http.cjs");
const { revokeAllSessionsForIdentity } = require("./customer-session-store.cjs");
const { sendPasswordResetEmail } = require("./customer-mailer.cjs");
const {
  HOST_KINDS,
  RESOLUTION_SOURCES,
  classifyTenantHost,
  parsePublicRestaurantPath,
  resolveRestaurantByHost,
  resolveRestaurantBySlug,
} = require("./tenant-resolution.cjs");

const BASE_PATH = "/api/customer/identity";
const HANDOFF_TTL_SECONDS = 60;
const RESET_TOKEN_TTL_SECONDS = 30 * 60;
const SESSION_TTL_SECONDS = 180 * 24 * 60 * 60;
const SIGN_IN_ATTEMPTS_PER_EMAIL = { max: 10, windowSeconds: 15 * 60 };
const RESET_REQUESTS_PER_EMAIL = { max: 3, windowSeconds: 60 * 60 };

const isProduction = () => String(process.env.NODE_ENV || "").trim() === "production";
const sha256 = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");

const normalizePhoneDigits = (value) => String(value || "").replace(/\D/g, "").slice(0, 13);
const isValidPhone = (digits) => digits.length >= 10 && digits.length <= 13;
const customerKeyFromPhone = (phone) => {
  const digits = normalizePhoneDigits(phone);
  return isValidPhone(digits) ? `phone:${digits}` : "";
};

const getAuthBaseUrl = () => {
  const configured = String(process.env.CUSTOMER_AUTH_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (isProduction()) return "";
  const port = Number(process.env.PORT || 3000);
  return `http://127.0.0.1:${port}`;
};

const getAuthSecret = () => {
  const secret = String(process.env.CUSTOMER_AUTH_SECRET || "").trim();
  if (secret.length >= 32) return secret;
  if (isProduction()) return "";
  // Só testes locais: segredo derivado do segredo de sessão local.
  return sha256(`inovas-customer-auth-local:${process.env.CUSTOMER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || "local"}`);
};

const isGoogleConfigured = () =>
  Boolean(String(process.env.GOOGLE_CLIENT_ID || "").trim() && String(process.env.GOOGLE_CLIENT_SECRET || "").trim());

// Provedores sociais. Para o Facebook: acrescentar aqui (FACEBOOK_CLIENT_ID /
// FACEBOOK_CLIENT_SECRET) e o botão na tela; o resto (vínculo, sessão,
// volta ao restaurante) já funciona igual.
const addSocialProviders = () => {
  const providers = {};
  if (isGoogleConfigured()) {
    providers.google = {
      clientId: String(process.env.GOOGLE_CLIENT_ID).trim(),
      clientSecret: String(process.env.GOOGLE_CLIENT_SECRET).trim(),
      prompt: "select_account",
      mapProfileToUser: (profile) => ({ name: profile.name || profile.given_name || "" }),
    };
  }
  return providers;
};
const listSocialProviders = () => Object.keys(addSocialProviders());

/* ---------------- banco ---------------- */

// Tabelas da identidade do cliente (migration 036).
const MODEL_NAMES = Object.freeze([
  "customer_auth_users",
  "customer_auth_sessions",
  "customer_auth_accounts",
  "customer_auth_verifications",
  "customer_auth_rate_limits",
]);

const buildDatabase = async () => {
  const url = String(process.env.CUSTOMER_AUTH_DATABASE_URL || "").trim();
  if (url) {
    const [{ Pool }, { PostgresDialect }] = await Promise.all([
      import("@neondatabase/serverless"),
      import("kysely"),
    ]);
    return { dialect: new PostgresDialect({ pool: new Pool({ connectionString: url, max: 3 }) }), type: "postgres" };
  }
  if (isProduction()) {
    throw buildHttpError(503, "Login de clientes ainda nao ativado.", "customer_auth_not_configured");
  }
  // Testes locais: memória do processo (some quando o servidor reinicia).
  const { memoryAdapter } = await import("better-auth/adapters/memory");
  if (!globalThis.__inovasCustomerAuthMemory) {
    globalThis.__inovasCustomerAuthMemory = Object.fromEntries(MODEL_NAMES.map((name) => [name, []]));
  }
  return memoryAdapter(globalThis.__inovasCustomerAuthMemory);
};

// Testes podem trocar o banco (ex.: PGlite) antes do primeiro uso.
let databaseOverride = null;
const setCustomerAuthDatabaseForTests = (database) => {
  databaseOverride = database;
  authPromise = null;
};

/* ---------------- limites por e-mail (além do limite por IP da biblioteca) ---------------- */

const countRecent = async (ctx, identifier) =>
  ctx.context.adapter.count({
    model: "verification",
    where: [
      { field: "identifier", value: identifier },
      { field: "expiresAt", operator: "gt", value: new Date() },
    ],
  });

const recordAttempt = (ctx, identifier, windowSeconds) =>
  ctx.context.internalAdapter.createVerificationValue({
    identifier,
    value: "1",
    expiresAt: new Date(Date.now() + windowSeconds * 1000),
  });

/* ---------------- instância ---------------- */

let authPromise = null;

const buildAuth = async () => {
  const baseURL = getAuthBaseUrl();
  const secret = getAuthSecret();
  if (!baseURL || !secret) {
    throw buildHttpError(503, "Login de clientes ainda nao ativado.", "customer_auth_not_configured");
  }
  const [{ betterAuth }, { createAuthMiddleware, APIError }, argon2, database] = await Promise.all([
    import("better-auth"),
    import("better-auth/api"),
    import("@node-rs/argon2"),
    databaseOverride ? Promise.resolve(databaseOverride) : buildDatabase(),
  ]);

  const tooManyAttempts = () =>
    new APIError("TOO_MANY_REQUESTS", {
      message: "Muitas tentativas. Espere alguns minutos e tente de novo.",
      code: "too_many_attempts",
    });

  return betterAuth({
    appName: "INOVAS Food",
    baseURL,
    basePath: BASE_PATH,
    secret,
    database,
    telemetry: { enabled: false },
    trustedOrigins: [baseURL],
    user: {
      modelName: "customer_auth_users",
      additionalFields: {
        phone: { type: "string", required: false, input: true },
      },
    },
    session: {
      modelName: "customer_auth_sessions",
      expiresIn: SESSION_TTL_SECONDS,
      updateAge: 24 * 60 * 60,
    },
    account: {
      modelName: "customer_auth_accounts",
      accountLinking: {
        enabled: true,
        // Vincula Google à conta de mesmo e-mail SÓ se o Google disser que o e-mail é verificado.
        trustedProviders: [],
        // A conta com senha não precisa ter e-mail confirmado; o gancho abaixo
        // desativa a senha não confirmada quando o dono real entra com o Google.
        requireLocalEmailVerified: false,
      },
    },
    verification: { modelName: "customer_auth_verifications" },
    rateLimit: {
      enabled: true,
      modelName: "customer_auth_rate_limits",
      storage: String(process.env.CUSTOMER_AUTH_DATABASE_URL || "").trim() ? "database" : "memory",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 300, max: 5 },
        "/request-password-reset": { window: 300, max: 3 },
        "/reset-password": { window: 300, max: 5 },
        "/sign-in/social": { window: 60, max: 10 },
      },
    },
    advanced: {
      cookiePrefix: "inovas_cliente",
      useSecureCookies: baseURL.startsWith("https://"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
      ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      // Sem entrar sozinho depois do cadastro: assim o cadastro com e-mail já
      // usado responde igual ao de e-mail novo (não revela quem tem conta).
      autoSignIn: false,
      resetPasswordTokenExpiresIn: RESET_TOKEN_TTL_SECONDS,
      revokeSessionsOnPasswordReset: true,
      password: {
        hash: (password) => argon2.hash(password),
        verify: ({ hash, password }) => argon2.verify(hash, password).catch(() => false),
      },
      sendResetPassword: async ({ user, url }) => {
        await sendPasswordResetEmail({ to: user.email, name: user.name, url, minutes: RESET_TOKEN_TTL_SECONDS / 60 });
      },
      onPasswordReset: async ({ user }) => {
        // Troca de senha: derruba as sessões desta pessoa nos sites dos restaurantes também.
        await revokeAllSessionsForIdentity(user.id);
      },
    },
    socialProviders: addSocialProviders(),
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const email = String(ctx.body?.email || "").trim().toLowerCase();
        if (ctx.path === "/sign-in/email" && email) {
          const id = `limit:signin:${sha256(email)}`;
          if ((await countRecent(ctx, id)) >= SIGN_IN_ATTEMPTS_PER_EMAIL.max) throw tooManyAttempts();
          await recordAttempt(ctx, id, SIGN_IN_ATTEMPTS_PER_EMAIL.windowSeconds);
        }
        if (ctx.path === "/request-password-reset" && email) {
          const id = `limit:reset:${sha256(email)}`;
          if ((await countRecent(ctx, id)) >= RESET_REQUESTS_PER_EMAIL.max) {
            // Mesma resposta de sempre: não revela nada e não envia mais e-mails.
            return ctx.json({ status: true, message: "Se o e-mail tiver conta, enviamos o link." });
          }
          await recordAttempt(ctx, id, RESET_REQUESTS_PER_EMAIL.windowSeconds);
        }
        if (ctx.path === "/sign-up/email") {
          const phone = normalizePhoneDigits(ctx.body?.phone);
          if (!isValidPhone(phone)) {
            throw new APIError("BAD_REQUEST", { message: "Informe um telefone com DDD.", code: "invalid_phone" });
          }
          if (!String(ctx.body?.name || "").trim()) {
            throw new APIError("BAD_REQUEST", { message: "Informe seu nome.", code: "invalid_name" });
          }
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: { ...user, phone: normalizePhoneDigits(user.phone) || null, name: String(user.name || "").trim().slice(0, 160) },
          }),
        },
      },
      account: {
        create: {
          // Google vinculado a uma conta com senha cujo e-mail NUNCA foi
          // confirmado: alguém pode ter criado essa senha com o e-mail de
          // outra pessoa. A senha não confirmada é desativada e as sessões caem.
          after: async (account, ctx) => {
            if (account.providerId === "credential" || !ctx?.context?.internalAdapter) return;
            const internal = ctx.context.internalAdapter;
            const user = await internal.findUserById(account.userId);
            if (!user || user.emailVerified) return;
            const accounts = await internal.findAccounts(account.userId);
            const passwordAccounts = accounts.filter((entry) => entry.providerId === "credential");
            if (!passwordAccounts.length) return;
            for (const entry of passwordAccounts) await internal.deleteAccount(entry.id);
            await internal.deleteUserSessions(account.userId);
            await revokeAllSessionsForIdentity(account.userId);
          },
        },
      },
    },
  });
};

const getCustomerAuth = () => {
  if (!authPromise) {
    authPromise = buildAuth().catch((error) => {
      authPromise = null;
      throw error;
    });
  }
  return authPromise;
};

/* ---------------- ponte HTTP (Vercel/servidor local -> Better Auth) ---------------- */

const toWebHeaders = (req) => {
  const headers = new Headers();
  Object.entries(req.headers || {}).forEach(([key, value]) => {
    if (value === undefined) return;
    (Array.isArray(value) ? value : [value]).forEach((entry) => headers.append(key, String(entry)));
  });
  return headers;
};

const readRawBody = async (req) => {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") return req.body;
    if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
    return JSON.stringify(req.body);
  }
  if (typeof req.on !== "function" || req.readableEnded) return "";
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
};

// subPath: o que vem depois de /api/customer/identity/ (a Vercel pode
// entregar a URL já reescrita para /api/customer/[...action]?action=...).
const handleIdentityRequest = async (req, res, subPath = "") => {
  const auth = await getCustomerAuth();
  const base = new URL(getAuthBaseUrl());
  const requestUrl = new URL(String(req.url || "/"), base);
  requestUrl.searchParams.delete("action");
  requestUrl.searchParams.delete("...action");
  const target = `${BASE_PATH}/${String(subPath || "").replace(/^\/+/, "")}`;
  const method = String(req.method || "GET").toUpperCase();
  const body = ["GET", "HEAD"].includes(method) ? undefined : await readRawBody(req);
  const request = new Request(new URL(target + requestUrl.search, base), {
    method,
    headers: toWebHeaders(req),
    body: body === "" ? undefined : body,
  });
  const response = await auth.handler(request);
  if (typeof res.status === "function") res.status(response.status);
  else res.statusCode = response.status;
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    res.setHeader(key, value);
  });
  if (cookies.length) res.setHeader("Set-Cookie", cookies);
  res.setHeader("Cache-Control", "no-store");
  const payload = Buffer.from(await response.arrayBuffer());
  if (typeof res.send === "function") res.send(payload);
  else res.end(payload);
};

// Sessão do login central (cookie do endereço central).
const getIdentitySession = async (req) => {
  const auth = await getCustomerAuth();
  const result = await auth.api.getSession({ headers: toWebHeaders(req) });
  return result?.user ? result : null;
};

/* ---------------- endereço de volta (sem open redirect) ---------------- */

const isLocalHostname = (hostname) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost");

// O endereço de volta precisa ser do PRÓPRIO restaurante: domínio próprio
// cadastrado e ativo, ou inovasfood.com.br/<slug> do restaurante. Nada de
// restaurante padrão: se não bater exatamente, recusa.
const validateReturnUrl = async (rawUrl, restaurantKey) => {
  const key = String(restaurantKey || "").trim();
  let url;
  try {
    url = new URL(String(rawUrl || ""));
  } catch {
    return null;
  }
  if (!key || url.username || url.password) return null;
  const local = isLocalHostname(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local && !isProduction())) return null;

  const hostKind = classifyTenantHost(url.host);
  let resolution = null;
  if (hostKind === HOST_KINDS.CUSTOM_DOMAIN) {
    resolution = await resolveRestaurantByHost(url.host);
  } else {
    const parsed = parsePublicRestaurantPath(url.pathname);
    if (parsed.recognized && parsed.valid) resolution = await resolveRestaurantBySlug(parsed.slug);
  }
  if (
    !resolution?.ok ||
    resolution.fallbackApplied ||
    resolution.source === RESOLUTION_SOURCES.DEFAULT_FALLBACK ||
    resolution.restaurantKey !== key
  ) {
    return null;
  }
  url.hash = "";
  url.searchParams.delete("login_code");
  return url;
};

/* ---------------- código de uso único (login central -> site do restaurante) ---------------- */

const createHandoffCode = async ({ user, restaurantKey, returnUrl }) => {
  const auth = await getCustomerAuth();
  const context = await auth.$context;
  const code = crypto.randomBytes(32).toString("base64url");
  await context.internalAdapter.createVerificationValue({
    identifier: `handoff:${sha256(code)}`,
    value: JSON.stringify({ userId: user.id, restaurantKey, origin: returnUrl.origin }),
    expiresAt: new Date(Date.now() + HANDOFF_TTL_SECONDS * 1000),
  });
  return code;
};

// Troca o código pela pessoa. Uso único (consumo atômico), validade curta,
// restaurante e endereço de origem precisam bater.
const redeemHandoffCode = async ({ code, restaurantKey, origin }) => {
  const value = String(code || "").trim();
  if (!value || value.length > 100) return null;
  const auth = await getCustomerAuth();
  const context = await auth.$context;
  const record = await context.internalAdapter.consumeVerificationValue(`handoff:${sha256(value)}`);
  if (!record || new Date(record.expiresAt).getTime() <= Date.now()) return null;
  let data;
  try {
    data = JSON.parse(record.value);
  } catch {
    return null;
  }
  if (data.restaurantKey !== restaurantKey) return null;
  if (origin && data.origin && data.origin !== origin) return null;
  const user = await context.internalAdapter.findUserById(data.userId);
  return user || null;
};

// Telefone pedido uma única vez (quem entrou pelo Google).
const saveIdentityPhone = async (userId, phone) => {
  const digits = normalizePhoneDigits(phone);
  if (!isValidPhone(digits)) {
    throw buildHttpError(400, "Informe um telefone com DDD.", "invalid_phone");
  }
  const auth = await getCustomerAuth();
  const context = await auth.$context;
  await context.internalAdapter.updateUser(userId, { phone: digits });
  return digits;
};

const toCustomerProfile = (user) => ({
  identityId: user.id,
  name: String(user.name || "").trim(),
  email: String(user.email || "").trim().toLowerCase(),
  phone: normalizePhoneDigits(user.phone),
  customerKey: customerKeyFromPhone(user.phone),
});

module.exports = {
  BASE_PATH,
  HANDOFF_TTL_SECONDS,
  createHandoffCode,
  customerKeyFromPhone,
  getAuthBaseUrl,
  getCustomerAuth,
  getIdentitySession,
  handleIdentityRequest,
  isGoogleConfigured,
  listSocialProviders,
  normalizePhoneDigits,
  redeemHandoffCode,
  saveIdentityPhone,
  setCustomerAuthDatabaseForTests,
  toCustomerProfile,
  validateReturnUrl,
};
