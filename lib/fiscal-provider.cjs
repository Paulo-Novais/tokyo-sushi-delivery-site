"use strict";

// Serviço emissor de nota fiscal (NFC-e). Igual ao pagamento online: o sistema
// fala com um "emissor" e dá para trocar de fornecedor sem mudar as telas.
//
// Variáveis (só no Vercel; nunca no código):
//   FISCAL_PROVIDER      focusnfe | fake | off   (vazio = desligado)
//   FOCUSNFE_TOKEN       token principal da conta INOVAS na Focus NFe
//   FOCUSNFE_ENV         homologacao (padrão) | producao
//   FOCUSNFE_API_URL     opcional (troca a URL da API)
// O "fake" (simulador) só funciona fora da produção: autoriza na hora e serve
// para os testes automáticos.
//
// ATENÇÃO (confirmar na homologação da Focus NFe): nomes dos campos da API
// seguem a documentação v2 (/v2/nfce, /v2/empresas). Se a conta exigir o token
// de cada empresa para emitir, trocar emitWithToken para usar esse token.

const crypto = require("node:crypto");
const { buildHttpError } = require("./http.cjs");

const getFiscalProviderName = () => {
  const explicit = String(process.env.FISCAL_PROVIDER || "").trim().toLowerCase();
  if (explicit === "fake") {
    return process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production" ? "" : "fake";
  }
  if (explicit === "focusnfe" && String(process.env.FOCUSNFE_TOKEN || "").trim()) return "focusnfe";
  return "";
};

const getFiscalEnvironment = () =>
  String(process.env.FOCUSNFE_ENV || "").trim().toLowerCase() === "producao" ? "producao" : "homologacao";

const isFiscalProviderActive = () => Boolean(getFiscalProviderName());

/* ---------------- Focus NFe ---------------- */

const focusBaseUrl = () => {
  const custom = String(process.env.FOCUSNFE_API_URL || "").trim().replace(/\/+$/, "");
  if (custom) return custom;
  return getFiscalEnvironment() === "producao" ? "https://api.focusnfe.com.br" : "https://homologacao.focusnfe.com.br";
};

const focusRequest = async (method, path, body) => {
  const token = String(process.env.FOCUSNFE_TOKEN || "").trim();
  let response;
  try {
    response = await fetch(`${focusBaseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(25000),
    });
  } catch (error) {
    throw buildHttpError(502, "Serviço de nota fiscal não respondeu. Tente de novo.", "fiscal_provider_unreachable");
  }
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
};

const absoluteFocusUrl = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text : `${focusBaseUrl()}${text.startsWith("/") ? "" : "/"}${text}`;
};

// Resposta da Focus -> formato do sistema.
const fromFocus = (data = {}) => {
  const status = String(data.status || "").toLowerCase();
  const mapped =
    status === "autorizado"
      ? "AUTHORIZED"
      : status === "cancelado"
        ? "CANCELED"
        : status === "processando_autorizacao"
          ? "PROCESSING"
          : status
            ? "REJECTED"
            : "ERROR";
  return {
    status: mapped,
    number: String(data.numero || ""),
    series: String(data.serie || ""),
    accessKey: String(data.chave_nfe || "").replace(/\D/g, "").replace(/^NFe/i, "").slice(0, 44),
    danfeUrl: absoluteFocusUrl(data.caminho_danfe),
    xmlUrl: absoluteFocusUrl(data.caminho_xml_nota_fiscal),
    qrcodeUrl: String(data.qrcode_url || data.url_consulta_nf || ""),
    message: String(data.mensagem_sefaz || data.mensagem || (Array.isArray(data.erros) ? data.erros.map((entry) => entry.mensagem).join("; ") : "") || "").slice(0, 500),
  };
};

const focusProvider = {
  name: "focusnfe",
  async emit({ ref, payload }) {
    const { status, data } = await focusRequest("POST", `/v2/nfce?ref=${encodeURIComponent(ref)}`, payload);
    if (status >= 500) throw buildHttpError(502, "Serviço de nota fiscal com erro. Tente de novo.", "fiscal_provider_error");
    return fromFocus(data);
  },
  async get({ ref }) {
    const { data } = await focusRequest("GET", `/v2/nfce/${encodeURIComponent(ref)}`);
    return fromFocus(data);
  },
  async cancel({ ref, reason }) {
    const { status, data } = await focusRequest("DELETE", `/v2/nfce/${encodeURIComponent(ref)}`, { justificativa: reason });
    if (status >= 500) throw buildHttpError(502, "Serviço de nota fiscal com erro. Tente de novo.", "fiscal_provider_error");
    const result = fromFocus(data);
    return { ...result, status: String(data.status || "").toLowerCase() === "cancelado" ? "CANCELED" : result.status };
  },
  // Cadastra/atualiza a empresa (restaurante) na conta INOVAS da Focus, com o
  // certificado A1 e o CSC. Esses dados vão direto para a Focus e não ficam
  // guardados na INOVAS.
  async registerCompany(company) {
    const cnpj = String(company.cnpj || "").replace(/\D/g, "");
    const body = {
      nome: company.legalName,
      nome_fantasia: company.tradeName,
      cnpj,
      inscricao_estadual: company.stateRegistration,
      regime_tributario: company.crt,
      logradouro: company.address?.street,
      numero: company.address?.number,
      complemento: company.address?.complement,
      bairro: company.address?.neighborhood,
      municipio: company.address?.city,
      uf: company.address?.state,
      cep: String(company.address?.postalCode || "").replace(/\D/g, ""),
      habilita_nfce: true,
      ...(company.certificateBase64
        ? { arquivo_certificado_base64: company.certificateBase64, senha_certificado: company.certificatePassword }
        : {}),
      ...(company.cscToken
        ? company.environment === "producao"
          ? { csc_nfce_producao: company.cscToken, id_token_nfce_producao: company.cscId }
          : { csc_nfce_homologacao: company.cscToken, id_token_nfce_homologacao: company.cscId }
        : {}),
    };
    // Tenta atualizar; se a empresa não existe, cria.
    let response = await focusRequest("PUT", `/v2/empresas/${cnpj}`, body);
    if (response.status === 404) response = await focusRequest("POST", "/v2/empresas", body);
    if (response.status >= 400) {
      const message = String(response.data?.mensagem || (Array.isArray(response.data?.erros) ? response.data.erros.map((entry) => entry.mensagem).join("; ") : "") || "Serviço de nota fiscal recusou os dados.");
      throw buildHttpError(400, message.slice(0, 300), "fiscal_company_refused");
    }
    return {
      registered: true,
      certificateExpiresAt: String(response.data?.certificado_valido_ate || ""),
    };
  },
};

/* ---------------- Simulador (testes) ---------------- */

const fakeNotes = new Map();
const fakeProvider = {
  name: "fake",
  async emit({ ref, payload }) {
    const cnpj = String(payload?.cnpj_emitente || "");
    const total = (payload?.items || []).reduce((sum, item) => sum + Number(item.valor_bruto || 0), 0);
    if (cnpj.length !== 14) return { status: "REJECTED", message: "CNPJ do emitente inválido.", number: "", series: "", accessKey: "", danfeUrl: "", xmlUrl: "", qrcodeUrl: "" };
    if (!(payload?.items || []).every((item) => /^\d{8}$/.test(String(item.codigo_ncm || "")))) {
      return { status: "REJECTED", message: "NCM inválido em um dos itens.", number: "", series: "", accessKey: "", danfeUrl: "", xmlUrl: "", qrcodeUrl: "" };
    }
    const number = String(fakeNotes.size + 1);
    const accessKey = crypto.createHash("sha256").update(ref).digest("hex").replace(/\D/g, "").padEnd(44, "7").slice(0, 44);
    const note = {
      status: "AUTHORIZED",
      number,
      series: String(payload?.serie || "1"),
      accessKey,
      danfeUrl: `https://simulador.inovas.local/danfe/${encodeURIComponent(ref)}`,
      xmlUrl: `https://simulador.inovas.local/xml/${encodeURIComponent(ref)}`,
      qrcodeUrl: `https://simulador.inovas.local/qrcode/${accessKey}`,
      message: `Autorizado o uso da NFC-e (simulador) · total ${total.toFixed(2)}`,
    };
    fakeNotes.set(ref, note);
    return { ...note };
  },
  async get({ ref }) {
    return fakeNotes.has(ref) ? { ...fakeNotes.get(ref) } : { status: "ERROR", message: "Nota não encontrada." };
  },
  async cancel({ ref, reason }) {
    const note = fakeNotes.get(ref);
    if (!note) return { status: "ERROR", message: "Nota não encontrada." };
    if (String(reason || "").length < 15) return { ...note, message: "Justificativa precisa de 15 caracteres ou mais." };
    note.status = "CANCELED";
    note.message = "Cancelamento homologado (simulador)";
    return { ...note };
  },
  async registerCompany(company) {
    const cnpj = String(company.cnpj || "").replace(/\D/g, "");
    if (cnpj.length !== 14) throw buildHttpError(400, "CNPJ inválido.", "fiscal_company_refused");
    return { registered: true, certificateExpiresAt: company.certificateBase64 ? "2027-11-30" : "" };
  },
};

const getFiscalProvider = () => {
  const name = getFiscalProviderName();
  if (name === "focusnfe") return focusProvider;
  if (name === "fake") return fakeProvider;
  throw buildHttpError(503, "Emissão de nota fiscal ainda não ativada pela INOVAS.", "fiscal_provider_inactive");
};

module.exports = {
  fromFocus,
  getFiscalEnvironment,
  getFiscalProvider,
  getFiscalProviderName,
  isFiscalProviderActive,
};
