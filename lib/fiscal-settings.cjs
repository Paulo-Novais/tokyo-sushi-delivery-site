"use strict";

// Dados fiscais do restaurante para a NFC-e (Gestor > Configurações > Nota
// fiscal). Só dados NÃO secretos ficam aqui. O certificado A1 (arquivo e
// senha) e o CSC (token) vão direto para o serviço emissor e não são guardados.

const digits = (value, max) => String(value ?? "").replace(/\D/g, "").slice(0, max);
const text = (value, max = 120) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// CRT: 1 Simples Nacional · 2 Simples (excesso de sublimite) · 3 Regime normal.
const CRT_OPTIONS = Object.freeze({ 1: "Simples Nacional", 2: "Simples Nacional (excesso de sublimite)", 3: "Regime normal" });

// Padrões comuns para restaurante. O contador do restaurante confere.
const FISCAL_DEFAULTS = Object.freeze({
  ncmFood: "21069090", // preparações alimentícias
  ncmDrink: "22021000", // refrigerantes e bebidas não alcoólicas
  cfop: "5102", // venda de mercadoria
  icmsCst: "102", // Simples Nacional sem crédito
  pisCofinsCst: "49", // outras operações de saída
});

const normalizeFiscalSettings = (value) => {
  const source = value && typeof value === "object" ? value : {};
  const crt = [1, 2, 3].includes(Number(source.crt)) ? Number(source.crt) : 1;
  const ncm = (input, fallback) => (digits(input, 8).length === 8 ? digits(input, 8) : fallback);
  const code = (input, size, fallback) => (digits(input, size).length === size ? digits(input, size) : fallback);
  return {
    legalName: text(source.legalName, 160),
    cnpj: digits(source.cnpj, 14),
    stateRegistration: text(source.stateRegistration, 20).toUpperCase(),
    crt,
    series: code(source.series, 1, "") || digits(source.series, 3) || "1",
    ncmFood: ncm(source.ncmFood, FISCAL_DEFAULTS.ncmFood),
    ncmDrink: ncm(source.ncmDrink, FISCAL_DEFAULTS.ncmDrink),
    cfop: code(source.cfop, 4, FISCAL_DEFAULTS.cfop),
    icmsCst: code(source.icmsCst, 3, "") || code(source.icmsCst, 2, "") || (crt === 3 ? "00" : FISCAL_DEFAULTS.icmsCst),
    pisCofinsCst: code(source.pisCofinsCst, 2, FISCAL_DEFAULTS.pisCofinsCst),
    autoEmit: source.autoEmit !== false,
    cscId: digits(source.cscId, 6),
    // Preenchidos pelo servidor depois que o emissor aceita certificado e CSC.
    companyRegistered: source.companyRegistered === true,
    certificateExpiresAt: text(source.certificateExpiresAt, 40),
    registeredEnvironment: source.registeredEnvironment === "producao" ? "producao" : source.registeredEnvironment === "homologacao" ? "homologacao" : "",
    updatedAt: text(source.updatedAt, 40),
  };
};

// O que falta para o restaurante emitir (lista em português para a tela).
const getMissingFiscalFields = (fiscal) => {
  const missing = [];
  if (fiscal.cnpj.length !== 14) missing.push("CNPJ");
  if (!fiscal.legalName) missing.push("Razão social");
  if (!fiscal.stateRegistration) missing.push("Inscrição estadual");
  if (!fiscal.cscId) missing.push("ID do CSC");
  if (!fiscal.companyRegistered) missing.push("Certificado digital A1 e CSC enviados ao emissor");
  return missing;
};

module.exports = { CRT_OPTIONS, FISCAL_DEFAULTS, getMissingFiscalFields, normalizeFiscalSettings };
