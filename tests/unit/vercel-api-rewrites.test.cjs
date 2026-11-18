// Toda rota de API usada pelo Gestor/site precisa de reescrita no vercel.json:
// os arquivos "[...action].js" não respondem sozinhos em produção.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const vercel = require(path.join(__dirname, "..", "..", "vercel.json"));

const sources = new Set((vercel.rewrites || []).map((rule) => rule.source));

test("rotas novas do Gestor e do pagamento online têm reescrita", () => {
  for (const source of [
    "/api/admin/presence/:action",
    "/api/admin/pdv/:action",
    "/api/admin/payouts/:action",
    "/api/admin/payment-settings/:action",
    "/api/admin/cash-register/:action",
    "/api/payments/:path*",
    "/api/channels/:path*",
    "/api/admin/channels/:action",
  ]) {
    assert.ok(sources.has(source), `falta reescrita para ${source}`);
  }
  const payments = vercel.rewrites.find((rule) => rule.source === "/api/payments/:path*");
  assert.equal(payments.destination, "/api/customer/[...action]?action=__payments/:path*");
});

test("rotina semanal do repasse agendada", () => {
  assert.deepEqual(vercel.crons, [{ path: "/api/payments/cron-payouts", schedule: "7 12 * * 3" }]);
});
