"use strict";

// Adicionais do plano (Painel INOVAS > Planos e adicionais).
//
// Catálogo: a equipe INOVAS cria cada adicional com valor mensal, em quais
// planos ele vale (pago à parte, incluso ou não disponível) e o link da tela da
// plataforma que ele libera. Fica em master_platform_state.addonCatalog.
//
// Restaurante: guarda o estado de cada adicional em restaurant.planAddons e a
// cortesia de desconto em restaurant.planDiscount.
//
// Regras de cobrança (combinadas com o Paulo, 26/11/2026):
//   - Ligou no meio do mês: paga o MÊS INTEIRO (lançado no extrato na hora).
//   - Desligou: continua funcionando até o fim do mês já pago e não é cobrado
//     no mês seguinte (desliga sozinho no dia 01).
//   - Religou antes do fim do mês: sem custo extra (mesma chave de cobrança).
//   - Cortesia: o adicional fica ligado sem cobrar até a data escolhida.
//
// Este arquivo só tem regras (sem banco): quem grava é master-platform-store.

const PLAN_KEYS = Object.freeze(["START", "BUSINESS", "PRO"]);
const PLAN_LABELS = Object.freeze({ START: "Essencial", BUSINESS: "Profissional", PRO: "Completo" });
const AVAILABILITY = Object.freeze(["paid", "included", "none"]);
const GROUPS = Object.freeze(["Operação", "Clientes", "Gestão", "Vendas"]);
const ICONS = Object.freeze(["chef", "scale", "qr", "chat", "gift", "sheet", "truck", "star", "chart", "receipt", "users", "clock"]);
const MAX_PRICE_CENTS = 100000; // R$ 1.000,00
const MAX_HISTORY = 40;

// Só telas de dentro da plataforma (Gestor ou app do garçom). Nada de site de fora.
const LINK_PATTERN = /^\/(admin|garcom)\/[\w\-./?=&%]*$/;

// Catálogo inicial. Fica em RASCUNHO: as telas ainda não existem, então nenhum
// restaurante vê nem paga. Quando a tela ficar pronta, a equipe muda para
// "Disponível" no Painel INOVAS.
const DEFAULT_CATALOG = Object.freeze([
  { key: "cozinha", name: "Tela da cozinha", group: "Operação", icon: "chef", priceCents: 990, description: "Os pedidos aparecem numa TV ou tablet na cozinha. Toca para marcar como pronto.", link: "/admin/?section=cozinha", menuLabel: "Cozinha", plans: { START: "paid", BUSINESS: "paid", PRO: "included" } },
  { key: "balanca", name: "Balança (comida por quilo)", group: "Operação", icon: "scale", priceCents: 1490, description: "Liga a balança no Caixa: o peso vira valor na comanda sozinho.", link: "/admin/?section=balanca", menuLabel: "Balança", plans: { START: "paid", BUSINESS: "paid", PRO: "paid" } },
  { key: "qr-mesa", name: "QR code na mesa", group: "Operação", icon: "qr", priceCents: 1290, description: "O cliente lê o QR, pede pelo celular e o pedido cai na comanda da mesa.", link: "/admin/?section=qr-mesa", menuLabel: "QR na mesa", plans: { START: "none", BUSINESS: "paid", PRO: "paid" } },
  { key: "whatsapp", name: "Avisos no WhatsApp", group: "Clientes", icon: "chat", priceCents: 2990, description: "“Pedido aceito” e “saiu para entrega” enviados sozinhos. Inclui 500 mensagens por mês.", link: "/admin/?section=whatsapp", menuLabel: "WhatsApp", plans: { START: "paid", BUSINESS: "paid", PRO: "paid" } },
  { key: "fidelidade", name: "Fidelidade", group: "Clientes", icon: "gift", priceCents: 990, description: "“A cada 10 pedidos, 1 grátis” ou saldo de volta para o próximo pedido.", link: "/admin/?section=fidelidade", menuLabel: "Fidelidade", plans: { START: "paid", BUSINESS: "paid", PRO: "included" } },
  { key: "ficha-tecnica", name: "Ficha técnica", group: "Gestão", icon: "sheet", priceCents: 990, description: "Custo e lucro de cada prato, ligado ao estoque. Ingredientes saem sozinhos a cada venda.", link: "/admin/?section=ficha-tecnica", menuLabel: "Ficha técnica", plans: { START: "none", BUSINESS: "paid", PRO: "paid" } },
]);

const text = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const slug = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
const isMonth = (value) => /^\d{4}-\d{2}$/.test(String(value || ""));

// Data de hoje no Brasil (AAAA-MM-DD), para todas as regras de mês.
const todayInBrazil = (now = new Date()) => new Date(new Date(now).getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
const monthOf = (date) => String(date).slice(0, 7);
const nextMonthFirstDay = (date) => {
  const [year, month] = String(date).slice(0, 7).split("-").map(Number);
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  return `${next}-01`;
};
const lastDayOfMonth = (monthKey) => {
  const [year, month] = monthKey.split("-").map(Number);
  return `${monthKey}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
};
// Último dia daqui a N meses (cortesia de 1, 3, 6 meses). 0 = sem prazo.
const giftUntilFor = (months, today) => {
  const count = Number(months);
  if (!count) return null;
  let monthKey = monthOf(today);
  for (let index = 1; index < count; index += 1) monthKey = monthOf(nextMonthFirstDay(`${monthKey}-01`));
  return lastDayOfMonth(monthKey);
};

const normalizePlanKey = (plan) => {
  const key = String(plan || "").trim().toUpperCase();
  if (key === "PREMIUM") return "PRO";
  return PLAN_KEYS.includes(key) ? key : "";
};

const assert = (condition, code, message) => {
  if (condition) return;
  const error = new Error(message);
  error.statusCode = 400;
  error.errorCode = code;
  throw error;
};

/* ---------------- catálogo ---------------- */

const normalizeCatalogItem = (item = {}) => {
  const plans = {};
  PLAN_KEYS.forEach((plan) => {
    const value = String(item.plans?.[plan] || "").toLowerCase();
    plans[plan] = AVAILABILITY.includes(value) ? value : "none";
  });
  return {
    key: slug(item.key || item.name),
    name: text(item.name, 40),
    group: GROUPS.includes(item.group) ? item.group : GROUPS[0],
    description: text(item.description, 140),
    icon: ICONS.includes(item.icon) ? item.icon : ICONS[0],
    priceCents: Math.min(MAX_PRICE_CENTS, Math.max(0, Math.round(Number(item.priceCents) || 0))),
    who: item.who === "inovas" ? "inovas" : "owner",
    plans,
    link: LINK_PATTERN.test(String(item.link || "").trim()) ? String(item.link).trim().slice(0, 200) : "",
    menuLabel: text(item.menuLabel, 30),
    status: item.status === "live" ? "live" : "draft",
    createdAt: text(item.createdAt, 40),
    createdBy: text(item.createdBy, 160),
    updatedAt: text(item.updatedAt, 40),
    updatedBy: text(item.updatedBy, 160),
  };
};

const getCatalog = (state = {}) => {
  const source = Array.isArray(state.addonCatalog) ? state.addonCatalog : DEFAULT_CATALOG;
  return source.map(normalizeCatalogItem).filter((item) => item.key && item.name);
};

// Valida e grava (cria ou edita) um item no catálogo. Devolve o novo catálogo.
const upsertCatalogItem = (catalog, payload = {}, actorLabel = "", now = new Date().toISOString()) => {
  const editingKey = slug(payload.originalKey || "");
  const existing = editingKey ? catalog.find((entry) => entry.key === editingKey) : null;
  assert(!editingKey || existing, "addon_not_found", "Adicional não encontrado.");
  const item = normalizeCatalogItem({ ...existing, ...payload, key: existing ? existing.key : payload.key || payload.name });
  assert(item.name.length >= 3, "addon_name_required", "Dê um nome ao adicional (mínimo 3 letras).");
  assert(item.description.length >= 10, "addon_description_required", "Escreva uma descrição curta para o dono do restaurante.");
  assert(item.priceCents > 0, "addon_price_required", "Informe o valor por mês.");
  assert(item.link, "addon_link_invalid", "Use um link de dentro da plataforma, começando com /admin/ ou /garcom/.");
  assert(PLAN_KEYS.some((plan) => item.plans[plan] !== "none"), "addon_plans_required", "Escolha pelo menos um plano.");
  const sameName = (entry) => entry.key === item.key || entry.name.toLowerCase() === item.name.toLowerCase();
  assert(!catalog.some((entry) => sameName(entry) && entry !== existing), "addon_key_taken", "Já existe um adicional com esse nome.");
  assert(!catalog.some((entry) => entry.link === item.link && entry !== existing), "addon_link_taken", "Essa tela já pertence a outro adicional.");
  const saved = existing
    ? { ...item, createdAt: existing.createdAt, createdBy: existing.createdBy, updatedAt: now, updatedBy: actorLabel }
    : { ...item, createdAt: now, createdBy: actorLabel, updatedAt: now, updatedBy: actorLabel };
  return { item: saved, catalog: existing ? catalog.map((entry) => (entry === existing ? saved : entry)) : [...catalog, saved] };
};

/* ---------------- estado do restaurante ---------------- */

const normalizeGift = (gift) => {
  if (!gift || typeof gift !== "object") return null;
  return {
    until: isDate(gift.until) ? gift.until : null, // null = sem prazo
    reason: text(gift.reason, 200),
    by: text(gift.by, 160),
    at: text(gift.at, 40),
  };
};

const normalizeRestaurantAddons = (value) => {
  const result = {};
  if (!value || typeof value !== "object") return result;
  Object.entries(value).forEach(([rawKey, entry]) => {
    const key = slug(rawKey);
    if (!key || !entry || typeof entry !== "object") return;
    result[key] = {
      on: entry.on === true,
      since: isDate(entry.since) ? entry.since : "",
      offAt: isDate(entry.offAt) ? entry.offAt : null, // desliga sozinho nesse dia (sempre dia 01)
      by: text(entry.by, 160),
      gift: normalizeGift(entry.gift),
    };
  });
  return result;
};

const normalizePlanDiscount = (value) => {
  if (!value || typeof value !== "object") return null;
  const percent = Math.round(Number(value.percent) || 0);
  if (percent < 1 || percent > 100) return null;
  return { percent, ...normalizeGift(value) };
};

const normalizeHistory = (value) =>
  (Array.isArray(value) ? value : [])
    .filter((entry) => entry && typeof entry === "object" && entry.text)
    .slice(0, MAX_HISTORY)
    .map((entry) => ({ at: text(entry.at, 40), kind: text(entry.kind, 20), text: text(entry.text, 200), by: text(entry.by, 160) }));

const addHistory = (history, entry) => normalizeHistory([{ at: new Date().toISOString(), ...entry }, ...(history || [])]);

const giftActive = (gift, today) => Boolean(gift) && (!gift.until || today <= gift.until);

// Situação de um adicional para um restaurante num dia.
//   state: "included" | "gift" | "on" | "ending" | "off" | "unavailable"
//   charged: entra na PRÓXIMA mensalidade (pago, ligado, sem cortesia e sem
//            desligamento marcado)
const effectiveAddon = (item, entry = {}, plan, today) => {
  const availability = item.plans[normalizePlanKey(plan)] || "none";
  const base = { key: item.key, name: item.name, priceCents: item.priceCents, availability };
  if (availability === "none" || (item.status !== "live" && !entry.on && !giftActive(entry.gift, today))) {
    return { ...base, state: "unavailable", active: false, charged: false };
  }
  if (availability === "included") return { ...base, state: "included", active: true, charged: false };
  if (giftActive(entry.gift, today)) return { ...base, state: "gift", active: true, charged: false, gift: entry.gift };
  const on = entry.on === true && (!entry.offAt || today < entry.offAt);
  if (!on) return { ...base, state: "off", active: false, charged: false };
  // "Desligando": já está pago até o fim do mês e não entra na próxima cobrança.
  return { ...base, state: entry.offAt ? "ending" : "on", active: true, charged: !entry.offAt, since: entry.since, offAt: entry.offAt || null };
};

// Todos os adicionais do catálogo para um restaurante + totais do mês.
const summarizeRestaurantAddons = ({ catalog, restaurant = {}, plan, planMonthlyValueCents = 0, today }) => {
  const entries = normalizeRestaurantAddons(restaurant.planAddons);
  const items = catalog.map((item) => effectiveAddon(item, entries[item.key], plan, today));
  const chargedCents = items.filter((item) => item.charged).reduce((sum, item) => sum + item.priceCents, 0);
  const discount = normalizePlanDiscount(restaurant.planDiscount);
  const discountActive = discount && giftActive(discount, today) ? discount : null;
  const discountCents = discountActive ? Math.round((planMonthlyValueCents * discountActive.percent) / 100) : 0;
  return { items, chargedCents, discount: discountActive, discountCents };
};

/* ---------------- ações ---------------- */

// Dono (ou INOVAS) liga um adicional. Devolve { entry, chargeMonth } — chargeMonth
// é o mês que deve ser cobrado inteiro agora (ou null se já estava pago).
const turnOn = ({ item, entry, plan, today, actor }) => {
  const availability = item.plans[normalizePlanKey(plan)] || "none";
  assert(item.status === "live", "addon_not_available", "Este adicional ainda não está disponível.");
  assert(availability === "paid", "addon_not_for_plan", availability === "included" ? "Este adicional já vem incluso no seu plano." : "Este adicional não está disponível no seu plano.");
  const current = normalizeRestaurantAddons({ [item.key]: entry || {} })[item.key] || {};
  const alreadyOn = current.on && (!current.offAt || today < current.offAt);
  return {
    entry: { ...current, on: true, since: alreadyOn ? current.since : today, offAt: null, by: actor },
    // Religou antes de acabar o mês: o mês já foi cobrado (a chave é a mesma).
    chargeMonth: monthOf(today),
    wasOn: alreadyOn,
  };
};

// Desliga no fim do mês pago: continua funcionando até lá.
const turnOff = ({ item, entry, today, actor }) => {
  const current = normalizeRestaurantAddons({ [item.key]: entry || {} })[item.key] || {};
  assert(current.on && (!current.offAt || today < current.offAt), "addon_not_on", "Este adicional já está desligado.");
  return { ...current, offAt: nextMonthFirstDay(today), by: actor };
};

const ledgerKeyFor = (addonKey, monthKey) => `addon:${addonKey}:${monthKey}`;

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const monthLabel = (monthKey) => {
  const [year, month] = monthKey.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]}/${year}`;
};

module.exports = {
  DEFAULT_CATALOG,
  GROUPS,
  ICONS,
  LINK_PATTERN,
  PLAN_KEYS,
  PLAN_LABELS,
  addHistory,
  effectiveAddon,
  getCatalog,
  giftActive,
  giftUntilFor,
  isMonth,
  ledgerKeyFor,
  monthLabel,
  monthOf,
  nextMonthFirstDay,
  normalizeCatalogItem,
  normalizeGift,
  normalizeHistory,
  normalizePlanDiscount,
  normalizePlanKey,
  normalizeRestaurantAddons,
  summarizeRestaurantAddons,
  todayInBrazil,
  turnOff,
  turnOn,
  upsertCatalogItem,
};
