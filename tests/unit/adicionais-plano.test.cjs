const test = require("node:test");
const assert = require("node:assert/strict");

const lib = require("../../lib/plan-addons.cjs");

const live = (overrides = {}) =>
  lib.normalizeCatalogItem({
    key: "cozinha",
    name: "Tela da cozinha",
    description: "Pedidos numa TV na cozinha.",
    priceCents: 990,
    link: "/admin/?section=cozinha",
    plans: { START: "paid", BUSINESS: "paid", PRO: "included" },
    status: "live",
    ...overrides,
  });

test("catálogo inicial fica em rascunho (ninguém paga por tela que ainda não existe)", () => {
  const catalog = lib.getCatalog({});
  assert.equal(catalog.length, 6);
  assert.ok(catalog.every((item) => item.status === "draft"));
  assert.ok(catalog.every((item) => lib.LINK_PATTERN.test(item.link)));
});

test("criar adicional: só link de dentro da plataforma, sem repetir nome nem tela", () => {
  const catalog = [live()];
  const base = { name: "Rotas", description: "Rotas do dia dos entregadores.", priceCents: 1990, plans: { START: "none", BUSINESS: "paid", PRO: "included" } };
  assert.throws(() => lib.upsertCatalogItem(catalog, { ...base, link: "https://site.com" }), (error) => error.errorCode === "addon_link_invalid");
  assert.throws(() => lib.upsertCatalogItem(catalog, { ...base, link: "/admin/?section=cozinha" }), (error) => error.errorCode === "addon_link_taken");
  assert.throws(() => lib.upsertCatalogItem(catalog, { ...base, name: "Tela da cozinha", link: "/admin/?section=rotas" }), (error) => error.errorCode === "addon_key_taken");
  assert.throws(() => lib.upsertCatalogItem(catalog, { ...base, link: "/admin/?section=rotas", plans: {} }), (error) => error.errorCode === "addon_plans_required");
  const { item, catalog: next } = lib.upsertCatalogItem(catalog, { ...base, link: "/admin/?section=rotas" }, "Paulo");
  assert.equal(item.key, "rotas");
  assert.equal(item.status, "draft");
  assert.equal(next.length, 2);
  // Editar mantém a chave e quem criou.
  const edited = lib.upsertCatalogItem(next, { originalKey: "rotas", priceCents: 2490, status: "live" }, "Ana");
  assert.equal(edited.item.priceCents, 2490);
  assert.equal(edited.item.createdBy, "Paulo");
  assert.equal(edited.catalog.length, 2);
});

test("ligar no dia 15: cobra o mês inteiro; religar no mesmo mês não cobra de novo", () => {
  const item = live();
  const first = lib.turnOn({ item, entry: null, plan: "BUSINESS", today: "2026-11-15", actor: "dono" });
  assert.equal(first.chargeMonth, "2026-11");
  assert.equal(lib.ledgerKeyFor("cozinha", first.chargeMonth), "addon:cozinha:2026-11");
  const off = lib.turnOff({ item, entry: first.entry, today: "2026-11-20", actor: "dono" });
  assert.equal(off.offAt, "2026-12-01");
  // Desligado, mas funciona até 30/11 e não é cobrado em dezembro.
  assert.equal(lib.effectiveAddon(item, off, "BUSINESS", "2026-11-30").state, "ending");
  assert.equal(lib.effectiveAddon(item, off, "BUSINESS", "2026-12-01").state, "off");
  assert.equal(lib.effectiveAddon(item, off, "BUSINESS", "2026-12-01").charged, false);
  // Religou antes do fim: mesma chave do mês (sem custo extra) e volta a "ligado".
  const again = lib.turnOn({ item, entry: off, plan: "BUSINESS", today: "2026-11-25", actor: "dono" });
  assert.equal(again.wasOn, true);
  assert.equal(again.chargeMonth, "2026-11");
  assert.equal(lib.effectiveAddon(item, again.entry, "BUSINESS", "2026-12-05").state, "on");
});

test("plano: incluso não cobra, não disponível bloqueia, rascunho não liga", () => {
  assert.equal(lib.effectiveAddon(live(), {}, "PRO", "2026-11-26").state, "included");
  assert.equal(lib.effectiveAddon(live({ plans: { START: "none", BUSINESS: "paid", PRO: "paid" } }), { on: true }, "START", "2026-11-26").state, "unavailable");
  assert.throws(() => lib.turnOn({ item: live(), plan: "PRO", today: "2026-11-26" }), (error) => error.errorCode === "addon_not_for_plan");
  assert.throws(() => lib.turnOn({ item: live({ status: "draft" }), plan: "BUSINESS", today: "2026-11-26" }), (error) => error.errorCode === "addon_not_available");
});

test("cortesia: grátis até a data; depois volta ao normal", () => {
  const item = live();
  assert.equal(lib.giftUntilFor(1, "2026-11-26"), "2026-11-30");
  assert.equal(lib.giftUntilFor(3, "2026-11-26"), "2027-01-31");
  assert.equal(lib.giftUntilFor(0, "2026-11-26"), null);
  const entry = { on: false, gift: { until: "2026-12-31", reason: "teste", by: "Paulo" } };
  assert.equal(lib.effectiveAddon(item, entry, "BUSINESS", "2026-12-31").state, "gift");
  assert.equal(lib.effectiveAddon(item, entry, "BUSINESS", "2026-12-31").charged, false);
  assert.equal(lib.effectiveAddon(item, entry, "BUSINESS", "2027-01-01").state, "off");
});

test("mensalidade: soma adicionais ligados e tira o desconto de cortesia do plano", () => {
  const catalog = [live(), live({ key: "fidelidade", name: "Fidelidade", link: "/admin/?section=fidelidade", priceCents: 1490 })];
  const restaurant = {
    planAddons: { cozinha: { on: true, since: "2026-10-05" }, fidelidade: { on: true, since: "2026-10-12", offAt: "2026-12-01" } },
    planDiscount: { percent: 50, until: "2026-12-31", reason: "indicação" },
  };
  const nov = lib.summarizeRestaurantAddons({ catalog, restaurant, plan: "BUSINESS", planMonthlyValueCents: 17990, today: "2026-11-26" });
  // Fidelidade está desligando (vale até 30/11): não entra na próxima mensalidade.
  assert.equal(nov.chargedCents, 990);
  assert.equal(nov.discountCents, 8995);
  const dec = lib.summarizeRestaurantAddons({ catalog, restaurant, plan: "BUSINESS", planMonthlyValueCents: 17990, today: "2026-12-01" });
  assert.equal(dec.chargedCents, 990);
});

test("rotina do mês: plano cobrado sem os adicionais; adicionais com chave própria", async () => {
  const path = require("node:path");
  const os = require("node:os");
  const fs = require("node:fs");
  const file = path.join(os.tmpdir(), `addons-ledger-${process.pid}-${Date.now()}.json`);
  process.env.INOVAS_PAYOUTS_FILE = file;
  process.env.NODE_ENV = "development";
  process.env.INOVAS_TENANT_MODE = "default_only";
  delete process.env.DATABASE_URL;
  const { chargeMonthlySubscription } = require("../../lib/payout-runner.cjs");
  const { chargeAddonMonth } = require("../../lib/plan-addon-billing.cjs");
  const { buildTenantContext } = require("../../lib/tenant-context.cjs");
  const account = { tenantId: "t-addon", restaurantId: "r-addon", restaurantKey: "addon-test" };
  const options = { tenantContext: buildTenantContext({ host: "x.local", matched: true, ...account, resolutionMode: "system", multiRestaurantActive: true }, { source: "test" }) };
  // Ligou no dia 15/11: novembro lançado na hora.
  assert.equal(await chargeAddonMonth(account, { addonKey: "cozinha", name: "Tela da cozinha", priceCents: 990, monthKey: "2026-11" }, { options }), 990);
  assert.equal(await chargeAddonMonth(account, { addonKey: "cozinha", name: "Tela da cozinha", priceCents: 990, monthKey: "2026-11" }, { options }), 0);
  const billing = {
    status: "ACTIVE",
    planName: "Profissional",
    monthlyValue: 189.8,
    baseMonthlyValue: 179.9,
    planAddons: [{ key: "cozinha", name: "Tela da cozinha", priceCents: 990, charged: true }],
  };
  // Rotina de dezembro: plano (179,90) + adicional de dezembro (9,90), sem repetir novembro.
  assert.equal(await chargeMonthlySubscription(account, options, new Date("2026-12-02T12:00:00Z"), { getBilling: async () => billing }), 17990);
  const entries = JSON.parse(fs.readFileSync(file, "utf8")).entries.filter((entry) => entry.type === "SUBSCRIPTION");
  assert.deepEqual(entries.map((entry) => entry.idempotencyKey).sort(), ["addon:cozinha:2026-11", "addon:cozinha:2026-12", "subscription:2026-12"]);
  assert.equal(entries.find((entry) => entry.idempotencyKey === "subscription:2026-12").amountCents, 17990);
  fs.rmSync(file, { force: true });
});
