"use strict";

// Rotina semanal do repasse (Vercel Cron, quarta-feira de manhã): para cada
// restaurante com conta de recebimento, fecha a semana anterior (seg–dom),
// congela o extrato e transfere o valor líquido para a conta bancária do
// restaurante. Pode rodar de novo sem duplicar: semana já fechada e já paga
// não é transferida outra vez.

const { buildTenantContext } = require("./tenant-context.cjs");
const { getWeekPeriod } = require("./payout-ledger.cjs");
const { closeWeek, listPayouts, markPayoutTransfer, recordLedgerEntry } = require("./payout-store.cjs");
const { getRestaurantBillingByKey, listRestaurantBilling } = require("./master-platform-store.cjs");
const { computeCycleCharge, cyclePeriodFor } = require("./billing-cycles.cjs");
const { listRecipients } = require("./online-payment-store.cjs");
const { chargeMonthlyAddons } = require("./plan-addon-billing.cjs");
const { getPaymentProvider } = require("./payment-provider.cjs");

const optionsFor = (account) => ({
  tenantContext: buildTenantContext(
    {
      host: "payouts.inovas.local",
      matched: true,
      tenantId: account.tenantId,
      restaurantId: account.restaurantId,
      restaurantKey: account.restaurantKey,
      resolutionMode: "system",
      multiRestaurantActive: true,
    },
    { source: "payouts:weekly" }
  ),
});

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// Mensalidade conforme o ciclo do contrato (mensal, trimestral, semestral ou
// anual, com desconto): lançada uma única vez no início de cada período, na
// primeira rotina do mês, e descontada no repasse seguinte. Só contrato ativo.
const chargeMonthlySubscription = async (account, options, now, { getBilling = getRestaurantBillingByKey } = {}) => {
  const billing = await getBilling(account.restaurantKey).catch(() => null);
  if (!billing || billing.status !== "ACTIVE") return null;
  const local = new Date(new Date(now).getTime() - 3 * 60 * 60 * 1000);
  const monthKey = local.toISOString().slice(0, 7);
  // Adicionais do catálogo: lançados todo mês, um a um (chave própria por mês),
  // qualquer que seja o ciclo do plano. Ver lib/plan-addon-billing.cjs.
  await chargeMonthlyAddons(account, billing, monthKey, { options, now }).catch(() => 0);
  // Plano + domínio − desconto de cortesia (sem os adicionais acima).
  const monthlyCents = Math.round(Number(billing.baseMonthlyValue ?? billing.monthlyValue ?? 0) * 100);
  if (monthlyCents <= 0) return null;
  const cycle = billing.billingCycle || "MONTHLY";
  const periodKey = cyclePeriodFor(cycle, billing.billingCycleStart || "", monthKey);
  if (!periodKey) return null; // meio do período: já foi cobrado no início
  const charge = computeCycleCharge(monthlyCents, cycle);
  const monthLabel = `${MONTH_NAMES[local.getUTCMonth()]}/${local.getUTCFullYear()}`;
  const description =
    charge.months === 1
      ? `${monthLabel} · Plano ${billing.planName}`
      : `${charge.label} a partir de ${monthLabel} · Plano ${billing.planName} · desconto ${(charge.discountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
  const { replayed } = await recordLedgerEntry(options, {
    type: "SUBSCRIPTION",
    amountCents: charge.totalCents,
    description: description.slice(0, 120),
    // Mensal mantém a chave antiga (subscription:AAAA-MM) para não cobrar em dobro.
    idempotencyKey: cycle === "MONTHLY" ? `subscription:${monthKey}` : `subscription:${periodKey}`,
    occurredAt: new Date(now).toISOString(),
  }, { actorLogin: "rotina-mensalidade" });
  return replayed ? null : charge.totalCents;
};

// Repasse que falhou (ex.: conta bancária recusada): tenta transferir de novo.
const retryFailedPayout = async (account, { weekKey }) => {
  const options = optionsFor(account);
  const payout = (await listPayouts(options)).find((entry) => entry.weekKey === weekKey);
  if (!payout || payout.status !== "FAILED" || payout.payoutCents <= 0) {
    return { status: payout?.status || "NOT_FOUND", retried: false };
  }
  try {
    const transfer = await getPaymentProvider().transfer({ recipientId: account.recipientId, amountCents: payout.payoutCents });
    await markPayoutTransfer(options, { weekKey, status: "PAID", providerTransferId: transfer.transferId });
    return { status: "PAID", retried: true };
  } catch (error) {
    await markPayoutTransfer(options, { weekKey, status: "FAILED" });
    return { status: "FAILED", retried: true, error: String(error.message || "").slice(0, 160) };
  }
};

const runWeeklyPayouts = async ({ now = new Date(), actorLogin = "rotina-semanal" } = {}) => {
  const lastWeek = getWeekPeriod(new Date(new Date(now).getTime() - 7 * 24 * 60 * 60 * 1000));
  // Sem pagamento online ativo: não há repasse, mas a mensalidade segue.
  let provider = null;
  try {
    provider = getPaymentProvider();
  } catch {
    provider = null;
  }
  const accounts = provider ? await listRecipients().catch(() => []) : [];
  const results = [];
  for (const account of accounts) {
    const options = optionsFor(account);
    try {
      const { payout } = await closeWeek(options, { weekKey: lastWeek.weekKey, actorLogin, now });
      // Depois de fechar a semana anterior: mensalidade do mês entra na semana atual.
      await chargeMonthlySubscription(account, options, now).catch(() => null);
      if (payout.status !== "SCHEDULED" || payout.payoutCents <= 0) {
        results.push({ restaurantKey: account.restaurantKey, status: payout.status, payoutCents: payout.payoutCents });
        continue;
      }
      try {
        const transfer = await provider.transfer({ recipientId: account.recipientId, amountCents: payout.payoutCents });
        await markPayoutTransfer(options, { weekKey: lastWeek.weekKey, status: "PAID", providerTransferId: transfer.transferId });
        results.push({ restaurantKey: account.restaurantKey, status: "PAID", payoutCents: payout.payoutCents });
      } catch (error) {
        await markPayoutTransfer(options, { weekKey: lastWeek.weekKey, status: "FAILED" });
        results.push({ restaurantKey: account.restaurantKey, status: "FAILED", error: String(error.message || "").slice(0, 160) });
      }
    } catch (error) {
      results.push({ restaurantKey: account.restaurantKey, status: "ERROR", error: String(error.message || "").slice(0, 160) });
    }
  }
  // Mensalidade de todo contrato ativo, mesmo sem pagamento online (fica
  // como valor devido até a INOVAS registrar o pagamento no painel).
  const withRecipient = new Set(accounts.map((account) => account.restaurantKey));
  const contracts = await listRestaurantBilling().catch(() => []);
  for (const contract of contracts) {
    if (withRecipient.has(contract.restaurantKey)) continue;
    await chargeMonthlySubscription(contract, optionsFor(contract), now).catch(() => null);
  }
  return { weekKey: lastWeek.weekKey, payoutDate: lastWeek.payoutDate, restaurants: results };
};

module.exports = { chargeMonthlySubscription, retryFailedPayout, runWeeklyPayouts };
