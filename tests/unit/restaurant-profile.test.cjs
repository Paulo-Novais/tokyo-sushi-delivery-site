// Cadastro novo: categoria, adicionais e consulta de CNPJ/CEP.
const test = require("node:test");
const assert = require("node:assert/strict");
const profile = require("../../lib/restaurant-profile.cjs");
const { mapCnpj, mapCep, lookupCnpj } = require("../../lib/company-lookup.cjs");

test("categoria sugerida pelo volume e pelo salão", () => {
  assert.equal(profile.suggestCategory(20, ["delivery"]), "DELIVERY");
  assert.equal(profile.suggestCategory(20, ["delivery", "dining"]), "RESTAURANT");
  assert.equal(profile.suggestCategory(80, []), "RESTAURANT");
  assert.equal(profile.suggestCategory(160, ["dining"]), "SUPER");
  assert.equal(profile.normalizeCategory("super"), "SUPER");
  assert.equal(profile.normalizeCategory("qualquer"), "");
});

test("Super Restaurante usa Brasil NFe; os outros a conta compartilhada", () => {
  const sup = profile.buildFiscalProfile({ category: "SUPER", addons: ["nfce"], plan: "BUSINESS" });
  assert.deepEqual([sup.enabled, sup.provider, sup.status], [true, "brasilnfe", "PENDING_CONFIG"]);
  const small = profile.buildFiscalProfile({ category: "DELIVERY", addons: ["nfce"], plan: "PRO" });
  assert.equal(small.provider, "shared");
  const off = profile.buildFiscalProfile({ category: "SUPER", addons: [], plan: "BUSINESS" });
  assert.deepEqual([off.enabled, off.status], [false, "DISABLED"]);
});

test("adicional de nota só conta nos planos Profissional e Completo", () => {
  assert.equal(profile.isAddonAllowed("nfce", "BUSINESS"), true);
  assert.equal(profile.isAddonAllowed("nfce", "PRO"), true);
  assert.equal(profile.isAddonAllowed("nfce", "START"), false);
  assert.equal(profile.isAddonAllowed("nfce", "FREE"), false);
  assert.equal(profile.addonsMonthlyValue(["nfce"], "BUSINESS"), 49.9);
  // Plano caiu para Essencial: adicional deixa de ser cobrado.
  assert.equal(profile.addonsMonthlyValue(["nfce"], "START"), 0);
  assert.deepEqual(profile.normalizeAddons(["nfce", "nfce", "inexistente"]).map((addon) => addon.key), ["nfce"]);
});

test("regime de impostos e formas de atendimento", () => {
  assert.equal(profile.normalizeTaxRegime("simples"), "SIMPLES");
  assert.equal(profile.normalizeTaxRegime("x"), "");
  assert.deepEqual(profile.normalizeServiceModes(["dining", "x", "dining", "pickup"]), ["dining", "pickup"]);
  assert.equal(profile.normalizeDailyOrders("-3"), 0);
  assert.equal(profile.normalizeDailyOrders("160"), 160);
});

test("CNPJ e CEP da consulta pública viram campos do cadastro", () => {
  const company = mapCnpj({
    cnpj: "11.222.333/0001-81",
    razao_social: "ACME LTDA",
    nome_fantasia: "Acme Sushi",
    opcao_pelo_simples: true,
    cep: "14010-000",
    descricao_tipo_de_logradouro: "RUA",
    logradouro: "A",
    numero: "10",
    bairro: "Centro",
    municipio: "Franca",
    uf: "sp",
  });
  assert.equal(company.cnpj, "11222333000181");
  assert.equal(company.legalName, "ACME LTDA");
  assert.equal(company.simples, true);
  assert.deepEqual(company.address, { postalCode: "14010000", street: "RUA A", number: "10", complement: "", neighborhood: "Centro", city: "Franca", state: "SP" });
  assert.deepEqual(mapCep({ cep: "14010000", street: "Rua B", neighborhood: "Centro", city: "Franca", state: "sp" }).state, "SP");
});

test("consulta de CNPJ recusa número errado e trata serviço fora do ar", async () => {
  await assert.rejects(() => lookupCnpj("123"), (error) => error.errorCode === "invalid_cnpj");
  const down = async () => ({ ok: false, status: 500, json: async () => ({}) });
  await assert.rejects(() => lookupCnpj("11222333000181", down), (error) => error.errorCode === "lookup_unavailable");
  const missing = async () => ({ ok: false, status: 404, json: async () => ({}) });
  await assert.rejects(() => lookupCnpj("11222333000181", missing), (error) => error.errorCode === "lookup_not_found");
});
