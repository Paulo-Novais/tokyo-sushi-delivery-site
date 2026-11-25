"use strict";

// Perfil comercial do restaurante, preenchido no cadastro do Painel INOVAS:
// categoria (define o serviço de nota fiscal por trás), regime de impostos,
// formas de atendimento e adicionais pagos (ex.: nota fiscal automática).
// Tudo puro, sem banco: testável e usado pelo cadastro e pela mensalidade.

const CATEGORIES = Object.freeze({
  DELIVERY: Object.freeze({ key: "DELIVERY", label: "Delivery", fiscalProvider: "shared" }),
  RESTAURANT: Object.freeze({ key: "RESTAURANT", label: "Restaurante", fiscalProvider: "shared" }),
  SUPER: Object.freeze({ key: "SUPER", label: "Super Restaurante", fiscalProvider: "brasilnfe" }),
});

// Limites (pedidos por dia) usados para sugerir a categoria.
const CATEGORY_LIMITS = Object.freeze({ restaurant: 50, super: 120 });

const FISCAL_PROVIDERS = Object.freeze({
  shared: "Conta compartilhada INOVAS",
  brasilnfe: "Brasil NFe (ilimitada)",
});

const TAX_REGIMES = Object.freeze({
  SIMPLES: "Simples Nacional",
  MEI: "MEI",
  PRESUMIDO: "Lucro Presumido",
  REAL: "Lucro Real",
});

const SERVICE_MODES = Object.freeze({
  delivery: "Delivery",
  pickup: "Retirada",
  dining: "Salão (mesas e garçom)",
  twoShifts: "Almoço e jantar",
});

// Planos com direito a adicionais: Profissional (BUSINESS), Completo (PRO/PREMIUM).
const ADDONS = Object.freeze({
  nfce: Object.freeze({
    key: "nfce",
    label: "Nota fiscal automática (NFC-e)",
    // Desde 25/11/2026 a nota fiscal vem inclusa no Profissional e no Completo.
    monthlyValue: 0,
    plans: Object.freeze(["BUSINESS", "PRO", "PREMIUM"]),
  }),
});

const normalizeCategory = (value) => {
  const key = String(value || "").trim().toUpperCase();
  return CATEGORIES[key] ? key : "";
};

const suggestCategory = (dailyOrders, modes = []) => {
  const orders = Number(dailyOrders) || 0;
  if (orders > CATEGORY_LIMITS.super) return "SUPER";
  if (orders > CATEGORY_LIMITS.restaurant || (Array.isArray(modes) && modes.includes("dining"))) return "RESTAURANT";
  return "DELIVERY";
};

const normalizeTaxRegime = (value) => {
  const key = String(value || "").trim().toUpperCase();
  return TAX_REGIMES[key] ? key : "";
};

const normalizeServiceModes = (value) =>
  [...new Set((Array.isArray(value) ? value : []).map((mode) => String(mode || "").trim()))].filter(
    (mode) => SERVICE_MODES[mode]
  );

const normalizeDailyOrders = (value) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= 0 ? Math.min(number, 100000) : 0;
};

const isAddonAllowed = (addonKey, plan) =>
  Boolean(ADDONS[addonKey]) && ADDONS[addonKey].plans.includes(String(plan || "").toUpperCase());

// Lista de adicionais guardada na assinatura: [{ key, label, monthlyValue }].
const normalizeAddons = (value) =>
  (Array.isArray(value) ? value : [])
    .map((entry) => (typeof entry === "string" ? { key: entry } : entry || {}))
    .map((entry) => String(entry.key || "").trim())
    .filter((key, index, list) => ADDONS[key] && list.indexOf(key) === index)
    .map((key) => ({ key, label: ADDONS[key].label, monthlyValue: ADDONS[key].monthlyValue }));

// Só os adicionais que o plano atual permite entram na cobrança (se o plano
// cair para um que não tem direito, o adicional para de ser cobrado).
const activeAddons = (addons, plan) => normalizeAddons(addons).filter((addon) => isAddonAllowed(addon.key, plan));

const addonsMonthlyValue = (addons, plan) =>
  Math.round(activeAddons(addons, plan).reduce((sum, addon) => sum + addon.monthlyValue * 100, 0)) / 100;

const buildFiscalProfile = ({ category, addons, plan }) => {
  const enabled = activeAddons(addons, plan).some((addon) => addon.key === "nfce");
  const provider = CATEGORIES[normalizeCategory(category)]?.fiscalProvider || "shared";
  return {
    enabled,
    provider,
    providerLabel: FISCAL_PROVIDERS[provider],
    // O dono completa certificado e CSC no Gestor; até lá a nota não sai.
    status: enabled ? "PENDING_CONFIG" : "DISABLED",
  };
};

module.exports = {
  ADDONS,
  CATEGORIES,
  CATEGORY_LIMITS,
  FISCAL_PROVIDERS,
  SERVICE_MODES,
  TAX_REGIMES,
  activeAddons,
  addonsMonthlyValue,
  buildFiscalProfile,
  isAddonAllowed,
  normalizeAddons,
  normalizeCategory,
  normalizeDailyOrders,
  normalizeServiceModes,
  normalizeTaxRegime,
  suggestCategory,
};
