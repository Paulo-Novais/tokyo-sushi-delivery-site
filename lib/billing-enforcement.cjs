// Mensalidade atrasada: situação de cada restaurante, prazo de pagamento e
// bloqueio. Só a equipe INOVAS (painel System) dá prazo, bloqueia ou libera;
// o restaurante apenas vê o aviso no Gestor.
//
// Situações:
//   BLOCKED        acesso suspenso (site fora do ar e Gestor travado)
//   GRACE          devendo, com prazo dado e ainda dentro do prazo
//   GRACE_EXPIRED  devendo e o prazo já venceu (pronto para bloquear)
//   OVERDUE        devendo há mais de 10 dias, sem prazo
//   DUE            devendo, cobrança recente
//   PAID_UP        em dia
//   CONTRACT_*     contrato fora de ACTIVE (teste, cancelado...)

const OVERDUE_MS = 10 * 24 * 60 * 60 * 1000;

// Data de hoje no Brasil (AAAA-MM-DD): o prazo vale até o fim do dia.
const todayInBrazil = (now = new Date()) =>
  new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

const computeBillingSituation = (contract = {}, balance = null, now = new Date()) => {
  const owedCents = Math.max(0, -Math.round(balance?.balanceCents || 0));
  const lastChargeAt = balance?.lastSubscriptionAt || null;
  const grace = contract.billingGrace || null;
  let situation = "PAID_UP";
  if (String(contract.accessStatus || "ACTIVE").toUpperCase() !== "ACTIVE") situation = "BLOCKED";
  else if (contract.status !== "ACTIVE") situation = `CONTRACT_${contract.status || "UNKNOWN"}`;
  else if (owedCents > 0) {
    if (grace?.until) situation = todayInBrazil(now) > grace.until ? "GRACE_EXPIRED" : "GRACE";
    else situation = lastChargeAt && now.getTime() - new Date(lastChargeAt).getTime() > OVERDUE_MS ? "OVERDUE" : "DUE";
  }
  return { situation, owedCents, lastChargeAt };
};

const formatDateBr = (iso = "") => {
  const [year, month, day] = String(iso).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : iso;
};

const loadDeps = () => {
  const store = require("./master-platform-store.cjs");
  const { listRestaurantBalances } = require("./payout-store.cjs");
  return { ...store, listRestaurantBalances };
};

const findBalance = (balances, contract) =>
  (balances || []).find((entry) => entry.tenantId === contract.tenantId && entry.restaurantId === contract.restaurantId) || null;

// Rotina diária: bloqueia quem tem prazo vencido com "bloquear sozinho"
// marcado e apaga o prazo de quem já pagou tudo.
const runBillingEnforcement = async ({ now = new Date(), actorLogin = "rotina-cobranca", audit = null, deps = null } = {}) => {
  const { listRestaurantBilling, listRestaurantBalances, updateRestaurantPlatformRecord, setRestaurantBillingGrace } = deps || loadDeps();
  const [contracts, balances] = await Promise.all([listRestaurantBilling(), listRestaurantBalances()]);
  const summary = { checked: contracts.length, blocked: [], graceCleared: [] };
  for (const contract of contracts) {
    const { situation, owedCents } = computeBillingSituation(contract, findBalance(balances, contract), now);
    if (contract.billingGrace && owedCents === 0 && situation !== "BLOCKED") {
      await setRestaurantBillingGrace(contract.restaurantKey, null, { login: actorLogin });
      summary.graceCleared.push(contract.restaurantKey);
      continue;
    }
    if (situation === "GRACE_EXPIRED" && contract.billingGrace?.autoBlock === true) {
      const reason = `Mensalidade em atraso: o prazo de pagamento venceu em ${formatDateBr(contract.billingGrace.until)}.`;
      const result = await updateRestaurantPlatformRecord(
        { restaurantKey: contract.restaurantKey, accessStatus: "SUSPENDED", reason, billingBlock: true, autoBlock: true },
        { login: actorLogin }
      );
      summary.blocked.push(contract.restaurantKey);
      if (audit) {
        await audit({
          eventType: "SYSTEM_RESTAURANT_SUSPENDED",
          reason,
          restaurant: result.restaurant,
          metadata: { restaurantKey: contract.restaurantKey, billingBlock: true, auto: true, owedCents },
        }).catch(() => {});
      }
    }
  }
  return summary;
};

// Depois de registrar um pagamento: se quitou, apaga o prazo e, se estava
// bloqueado por falta de pagamento, libera o acesso.
const releaseIfPaid = async (restaurantKey, { actorLogin = "System" } = {}) => {
  const { listRestaurantBilling, listRestaurantBalances, updateRestaurantPlatformRecord, setRestaurantBillingGrace } = loadDeps();
  const [contracts, balances] = await Promise.all([listRestaurantBilling(), listRestaurantBalances()]);
  const contract = contracts.find((entry) => entry.restaurantKey === restaurantKey);
  if (!contract) return { released: false, graceCleared: false };
  const { owedCents } = computeBillingSituation(contract, findBalance(balances, contract));
  if (owedCents > 0) return { released: false, graceCleared: false, owedCents };
  if (contract.billingBlock && String(contract.accessStatus).toUpperCase() !== "ACTIVE") {
    await updateRestaurantPlatformRecord(
      { restaurantKey, accessStatus: "ACTIVE", reason: "Mensalidade paga: acesso liberado automaticamente." },
      { login: actorLogin }
    );
    return { released: true, graceCleared: true, owedCents: 0 };
  }
  if (contract.billingGrace) {
    await setRestaurantBillingGrace(restaurantKey, null, { login: actorLogin });
    return { released: false, graceCleared: true, owedCents: 0 };
  }
  return { released: false, graceCleared: false, owedCents: 0 };
};

module.exports = { computeBillingSituation, runBillingEnforcement, releaseIfPaid, todayInBrazil, formatDateBr };
