"use strict";

// Busca dados públicos para o cadastro do restaurante: CNPJ (Receita, via
// BrasilAPI) e CEP. Só leitura, sem segredo. Se o serviço falhar, o cadastro
// continua: o usuário preenche à mão.

const { buildHttpError } = require("./http.cjs");

const BASE_URL = () => String(process.env.INOVAS_LOOKUP_API_URL || "https://brasilapi.com.br/api").replace(/\/+$/, "");
const TIMEOUT_MS = 6000;

const onlyDigits = (value) => String(value || "").replace(/\D/g, "");

const fetchJson = async (url, fetchImpl = globalThis.fetch) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (response.status === 404) throw buildHttpError(404, "Não encontrado.", "lookup_not_found");
    if (!response.ok) throw buildHttpError(502, "Consulta indisponível agora. Preencha à mão.", "lookup_unavailable");
    return await response.json();
  } catch (error) {
    if (error?.statusCode) throw error;
    throw buildHttpError(502, "Consulta indisponível agora. Preencha à mão.", "lookup_unavailable");
  } finally {
    clearTimeout(timer);
  }
};

const mapCnpj = (data = {}) => ({
  cnpj: onlyDigits(data.cnpj),
  legalName: String(data.razao_social || "").trim(),
  tradeName: String(data.nome_fantasia || "").trim(),
  status: String(data.descricao_situacao_cadastral || "").trim(),
  mainActivity: String(data.cnae_fiscal_descricao || "").trim(),
  mainActivityCode: String(data.cnae_fiscal || "").trim(),
  active: String(data.descricao_situacao_cadastral || "").trim().toUpperCase() === "ATIVA",
  phone: onlyDigits(data.ddd_telefone_1 || data.ddd_telefone_2),
  email: String(data.email || "").trim().toLowerCase(),
  // Sócios (QSA): o primeiro vira sugestão de dono.
  partners: (Array.isArray(data.qsa) ? data.qsa : [])
    .map((partner) => String(partner?.nome_socio || "").trim())
    .filter(Boolean)
    .slice(0, 5),
  simples: data.opcao_pelo_simples === true,
  mei: data.opcao_pelo_mei === true,
  address: {
    postalCode: onlyDigits(data.cep),
    street: [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(" ").trim(),
    number: String(data.numero || "").trim(),
    complement: String(data.complemento || "").trim(),
    neighborhood: String(data.bairro || "").trim(),
    city: String(data.municipio || "").trim(),
    state: String(data.uf || "").trim().toUpperCase(),
  },
});

const mapCep = (data = {}) => ({
  postalCode: onlyDigits(data.cep),
  street: String(data.street || "").trim(),
  neighborhood: String(data.neighborhood || "").trim(),
  city: String(data.city || "").trim(),
  state: String(data.state || "").trim().toUpperCase(),
});

// Só para testes locais (INOVAS_LOOKUP_API_URL=fake): respostas fixas, sem rede.
const isFake = () => String(process.env.INOVAS_LOOKUP_API_URL || "") === "fake" && process.env.NODE_ENV !== "production";
const FAKE_CNPJ = (cnpj) => ({
  cnpj,
  razao_social: "EMPRESA TESTE ALIMENTOS LTDA",
  nome_fantasia: "Sushi Teste",
  descricao_situacao_cadastral: "ATIVA",
  cnae_fiscal_descricao: "Restaurantes e similares",
  cnae_fiscal: 5611201,
  ddd_telefone_1: "1633330000",
  email: "contato@empresateste.com.br",
  qsa: [{ nome_socio: "JOAO DA SILVA TESTE" }],
  opcao_pelo_simples: true,
  opcao_pelo_mei: false,
  cep: "14010000",
  descricao_tipo_de_logradouro: "RUA",
  logradouro: "DUQUE DE CAXIAS",
  numero: "100",
  bairro: "CENTRO",
  municipio: "RIBEIRAO PRETO",
  uf: "SP",
});

const lookupCnpj = async (value, fetchImpl) => {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) throw buildHttpError(400, "CNPJ precisa ter 14 números.", "invalid_cnpj");
  if (!require("./payment-settings.cjs").isValidCnpj(cnpj)) throw buildHttpError(400, "CNPJ inválido. Confira os números.", "invalid_cnpj");
  if (isFake()) {
    const fake = FAKE_CNPJ(cnpj);
    if (cnpj.startsWith("99")) fake.descricao_situacao_cadastral = "BAIXADA";
    return mapCnpj(fake);
  }
  return mapCnpj(await fetchJson(`${BASE_URL()}/cnpj/v1/${cnpj}`, fetchImpl));
};

const lookupCep = async (value, fetchImpl) => {
  const cep = onlyDigits(value);
  if (cep.length !== 8) throw buildHttpError(400, "CEP precisa ter 8 números.", "invalid_cep");
  if (isFake()) return mapCep({ cep, street: "Rua Duque de Caxias", neighborhood: "Centro", city: "Ribeirão Preto", state: "SP" });
  return mapCep(await fetchJson(`${BASE_URL()}/cep/v2/${cep}`, fetchImpl));
};

module.exports = { lookupCep, lookupCnpj, mapCep, mapCnpj };
