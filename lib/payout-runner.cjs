"use strict";

// Rotina semanal do repasse (Vercel Cron, quarta-feira de manhã): para cada
// restaurante com conta de recebimento, fecha a semana anterior (seg–dom),
// congela o extrato e transfere o valor líquido para a conta bancária do
// restaurante. Pode rodar de novo sem duplicar: semana já fechada e já paga
// não é transferida outra vez.

const { buildTenantContext } = require("./tenant-context.cjs");
const { getWeekPeriod } = require("./payout-ledger.cjs");
const { closeWeek, markPayoutTransfer } = require("./payout-store.cjs");
const { listRecipients } = require("./online-payment-store.cjs");
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

const runWeeklyPayouts = async ({ now = new Date(), actorLogin = "rotina-semanal" } = {}) => {
  const lastWeek = getWeekPeriod(new Date(new Date(now).getTime() - 7 * 24 * 60 * 60 * 1000));
  const provider = getPaymentProvider();
  const accounts = await listRecipients();
  const results = [];
  for (const account of accounts) {
    const options = optionsFor(account);
    try {
      const { payout } = await closeWeek(options, { weekKey: lastWeek.weekKey, actorLogin, now });
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
  return { weekKey: lastWeek.weekKey, payoutDate: lastWeek.payoutDate, restaurants: results };
};

module.exports = { runWeeklyPayouts };
