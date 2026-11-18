"use strict";

// Configurações > Pagamentos e repasses (dono do restaurante).
// - Formas online que o restaurante aceita: Pix, Crédito, Débito, VR/VA.
// - Conta bancária para o repasse semanal (obrigatória para vender online).
//   Só o dono do restaurante altera; a tela recebe os dados mascarados.
// - Ao salvar a conta, o recebedor é criado no provedor (Stone/Pagar.me).
// - Taxas mostradas: as configuradas pela INOVAS conforme o contrato com o
//   provedor (INOVAS_PAYMENT_FEE_ESTIMATES); sem configuração, "a confirmar".

const { buildHttpError } = require("./http.cjs");
const { ONLINE_PAYMENT_METHODS } = require("./payment-methods.cjs");
const { getEnabledMethods, getPaymentProvider, getProviderName, isOnlinePaymentEnabled } = require("./payment-provider.cjs");
const store = require("./online-payment-store.cjs");
const { getPlatformFeeBps } = require("./payout-ledger.cjs");

const onlyDigits = (value, max = 20) => String(value || "").replace(/\D/g, "").slice(0, max);

const isValidCpf = (cpf) => {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (length) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += Number(cpf[index]) * (length + 1 - index);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
};

const isValidCnpj = (cnpj) => {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (length) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(cnpj[index]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
};

const mask = (value, visible = 4) => {
  const text = String(value || "");
  if (!text) return "";
  return `${"•".repeat(Math.max(0, text.length - visible))}${text.slice(-visible)}`;
};

const maskDocument = (document) =>
  document.length === 14
    ? `${document.slice(0, 2)}.•••.•••/••••-${document.slice(12)}`
    : document.length === 11
      ? `•••.•••.${document.slice(6, 9)}-${document.slice(9)}`
      : "";

const tenantOf = (tenantContext) => ({
  tenantId: tenantContext.tenantId,
  restaurantId: tenantContext.restaurantId,
  restaurantKey: tenantContext.restaurantKey,
});

const readFeeTable = () => {
  try {
    const parsed = JSON.parse(String(process.env.INOVAS_PAYMENT_FEE_ESTIMATES || "{}"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const hasBankAccount = (account) =>
  Boolean(account?.holderDocument && account?.bankCode && account?.accountNumber && account?.holderName);

// Formas que o site do restaurante oferece: escolhidas pelo dono, liberadas
// pela plataforma e com recebedor ativo (provedor de teste: basta escolher).
const getRestaurantOnlineMethods = async (tenantContext) => {
  if (!isOnlinePaymentEnabled()) return [];
  let account = null;
  try {
    account = await store.getRecipient(tenantOf(tenantContext));
  } catch (error) {
    if (error?.errorCode === "online_payment_disabled") return [];
    throw error;
  }
  if (!account) return [];
  const platform = getEnabledMethods();
  const chosen = Array.isArray(account.enabledMethods) ? account.enabledMethods : [];
  if (getProviderName() === "pagarme" && !(account.recipientId && account.recipientStatus === "ACTIVE")) return [];
  return platform.filter((method) => chosen.includes(method));
};

const toView = (account, { canEditBank }) => {
  const platformMethods = getEnabledMethods();
  const fees = readFeeTable();
  const configured = hasBankAccount(account);
  return {
    onlinePaymentAvailable: isOnlinePaymentEnabled(),
    canEditBank,
    bankAccountRequired: !configured,
    status: account?.recipientStatus || "NOT_SUBMITTED",
    statusMessage: account?.recipientMessage || "",
    enabledMethods: Array.isArray(account?.enabledMethods) ? account.enabledMethods : [],
    methods: ONLINE_PAYMENT_METHODS.map((method) => ({
      id: method.id,
      label: method.label,
      shortLabel: method.shortLabel,
      availableOnPlatform: platformMethods.includes(method.id),
      fee: fees[method.id]
        ? {
            percentBps: Math.max(0, Math.round(Number(fees[method.id].percentBps) || 0)),
            fixedCents: Math.max(0, Math.round(Number(fees[method.id].fixedCents) || 0)),
          }
        : null,
    })),
    platformFeeBps: getPlatformFeeBps(),
    payoutSchedule: {
      weekday: Number(process.env.INOVAS_PAYOUT_WEEKDAY || 3),
      description: "Repasse semanal: vendas de segunda a domingo, pagas na quarta-feira seguinte, já com a taxa da operadora, a taxa INOVAS, devoluções e mensalidade descontadas.",
    },
    bankAccount: configured
      ? {
          holderName: account.holderName,
          holderDocument: maskDocument(account.holderDocument),
          holderType: account.holderDocument.length === 14 ? "company" : "individual",
          holderEmail: account.holderEmail,
          bankCode: account.bankCode,
          branch: `${account.branchNumber}${account.branchCheckDigit ? `-${account.branchCheckDigit}` : ""}`,
          account: `${mask(account.accountNumber, 3)}-${account.accountCheckDigit}`,
          accountType: account.accountType,
          updatedAt: account.updatedAt,
        }
      : null,
  };
};

const getPaymentSettings = async (tenantContext, { canEditBank }) => {
  const account = await store.getRecipient(tenantOf(tenantContext));
  return toView(account, { canEditBank });
};

const normalizeBankInput = (input = {}) => {
  const holderDocument = onlyDigits(input.holderDocument, 14);
  const errors = [];
  if (!(isValidCpf(holderDocument) || isValidCnpj(holderDocument))) errors.push("CPF ou CNPJ do titular inválido.");
  const holderName = String(input.holderName || "").replace(/\s+/g, " ").trim().slice(0, 128);
  if (holderName.length < 3) errors.push("Informe o nome do titular (razão social ou nome completo).");
  const holderEmail = String(input.holderEmail || "").trim().toLowerCase().slice(0, 160);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(holderEmail)) errors.push("E-mail do titular inválido.");
  const holderPhone = onlyDigits(input.holderPhone, 13);
  if (holderPhone.length < 10 || holderPhone.length > 11) errors.push("Telefone do titular inválido (DDD + número).");
  const bankCode = onlyDigits(input.bankCode, 3).padStart(3, "0");
  if (!/^\d{3}$/.test(bankCode) || bankCode === "000") errors.push("Código do banco inválido (3 números, ex.: 341).");
  const branchNumber = onlyDigits(input.branchNumber, 4);
  if (!branchNumber) errors.push("Agência inválida.");
  const branchCheckDigit = onlyDigits(input.branchCheckDigit, 1);
  const accountNumber = onlyDigits(input.accountNumber, 13);
  if (!accountNumber) errors.push("Número da conta inválido.");
  const accountCheckDigit = String(input.accountCheckDigit || "").replace(/[^0-9Xx]/g, "").slice(0, 2).toUpperCase();
  if (!accountCheckDigit) errors.push("Dígito da conta obrigatório.");
  const accountType = input.accountType === "savings" ? "savings" : "checking";
  if (errors.length) {
    throw buildHttpError(400, errors.join(" "), "payment_bank_invalid", { details: { errors } });
  }
  return { holderDocument, holderName, holderEmail, holderPhone, bankCode, branchNumber, branchCheckDigit, accountNumber, accountCheckDigit, accountType };
};

const savePaymentSettings = async (tenantContext, input = {}, { canEditBank, actorLogin = "" }) => {
  const tenant = tenantOf(tenantContext);
  const current = await store.getRecipient(tenant);
  const patch = { provider: getProviderName() || current?.provider || "pagarme" };

  if (input.bankAccount) {
    if (!canEditBank) {
      throw buildHttpError(403, "Somente o dono do restaurante pode alterar a conta bancária.", "payment_bank_owner_only");
    }
    Object.assign(patch, normalizeBankInput(input.bankAccount), {
      // Conta nova: precisa de novo recebedor no provedor.
      recipientId: "",
      recipientStatus: "NOT_SUBMITTED",
      recipientMessage: "",
    });
  }

  if (Array.isArray(input.enabledMethods)) {
    const valid = ONLINE_PAYMENT_METHODS.map((method) => method.id);
    const enabledMethods = [...new Set(input.enabledMethods.map(String))].filter((id) => valid.includes(id));
    if (enabledMethods.length && !hasBankAccount({ ...current, ...patch })) {
      throw buildHttpError(409, "Cadastre a conta bancária antes de ativar o pagamento online.", "payment_bank_required");
    }
    patch.enabledMethods = enabledMethods;
  }

  let account = await store.savePaymentAccount(tenant, patch, { actorLogin });

  // Conta bancária nova: cria o recebedor no provedor (se ativo).
  if (input.bankAccount && isOnlinePaymentEnabled()) {
    try {
      const recipient = await getPaymentProvider().createRecipient({ ...account, restaurantKey: tenant.restaurantKey });
      account = await store.savePaymentAccount(
        tenant,
        {
          recipientId: recipient.recipientId,
          recipientStatus: recipient.status,
          recipientMessage: recipient.status === "ACTIVE" ? "" : "Cadastro em análise pela Stone/Pagar.me.",
        },
        { actorLogin }
      );
    } catch (error) {
      account = await store.savePaymentAccount(
        tenant,
        {
          recipientStatus: "PENDING",
          recipientMessage: "Conta salva. A ativação na Stone/Pagar.me será concluída pela equipe INOVAS.",
        },
        { actorLogin }
      );
    }
  }
  return toView(account, { canEditBank });
};

module.exports = {
  getPaymentSettings,
  getRestaurantOnlineMethods,
  hasBankAccount,
  isValidCnpj,
  isValidCpf,
  savePaymentSettings,
};
