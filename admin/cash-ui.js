/* Novo Caixa INOVAS Food — utilitários base (Fase 2).
   Funções puras (dinheiro, divisão, quantidade) + comportamento de
   stepper e modal. Funciona no navegador (window.InovasCashUi) e no Node
   (require), para que as regras sejam testadas em tests/unit. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.InovasCashUi = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- dinheiro (sempre em centavos inteiros) ---------- */

  const toCents = (value) => {
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return NaN;
      return Math.round(value * 100);
    }
    const text = String(value ?? "")
      .trim()
      .replace(/\s|R\$/g, "");
    if (!text) return NaN;
    // "1.234,56" -> 1234.56 ; "12,5" -> 12.5 ; "12.50" -> 12.5
    const normalized = text.includes(",")
      ? text.replace(/\./g, "").replace(",", ".")
      : text;
    const number = Number(normalized);
    return Number.isFinite(number) ? Math.round(number * 100) : NaN;
  };

  const fromCents = (cents) => Math.round(cents) / 100;

  const formatMoney = (value) => {
    const cents = toCents(value);
    if (!Number.isFinite(cents)) return "R$ 0,00";
    const negative = cents < 0;
    const abs = Math.abs(cents);
    const reais = Math.floor(abs / 100)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const centavos = String(abs % 100).padStart(2, "0");
    return `${negative ? "−" : ""}R$ ${reais},${centavos}`;
  };

  /* Divide igual; o centavo que sobra fica com a ÚLTIMA pessoa
     (ESPEC 3.7: 295,35 / 4 = 73,84 + 73,84 + 73,84 + 73,83). */
  const splitEqually = (total, parts) => {
    const count = Math.trunc(Number(parts));
    if (!Number.isFinite(count) || count < 1) {
      throw new RangeError("Informe ao menos 1 pessoa para dividir.");
    }
    const cents = toCents(total);
    if (!Number.isFinite(cents) || cents < 0) {
      throw new RangeError("Valor inválido para dividir.");
    }
    const share = Math.ceil(cents / count);
    const result = [];
    let remaining = cents;
    for (let index = 0; index < count; index += 1) {
      const value = index === count - 1 ? remaining : Math.min(share, remaining);
      result.push(fromCents(value));
      remaining -= value;
    }
    return result;
  };

  /* Troco e falta de um pagamento em dinheiro. */
  const cashChange = (due, received) => {
    const dueCents = toCents(due);
    const receivedCents = toCents(received);
    if (!Number.isFinite(dueCents) || !Number.isFinite(receivedCents)) {
      return { change: 0, missing: fromCents(Math.max(0, dueCents || 0)) };
    }
    return {
      change: fromCents(Math.max(0, receivedCents - dueCents)),
      missing: fromCents(Math.max(0, dueCents - receivedCents)),
    };
  };

  /* ---------- quantidade / stepper ---------- */

  const clampInteger = (value, { min = 0, max = 999 } = {}) => {
    const number = Math.trunc(Number(value));
    if (!Number.isFinite(number)) return min;
    return Math.min(max, Math.max(min, number));
  };

  /* "3*12" -> { quantity: 3, query: "12" }; "12" -> { quantity: 1, query: "12" } */
  const parseQuickEntry = (input, { maxQuantity = 99 } = {}) => {
    const text = String(input ?? "").trim();
    const match = text.match(/^(\d{1,3})\s*[*xX×]\s*(.+)$/);
    if (match) {
      return {
        quantity: clampInteger(match[1], { min: 1, max: maxQuantity }),
        query: match[2].trim(),
      };
    }
    return { quantity: 1, query: text };
  };

  /* Mesas 1..N exibidas com dois dígitos (01, 02…). */
  const formatTableNumber = (number) => String(clampInteger(number, { min: 0, max: 999 })).padStart(2, "0");

  /* ---------- comportamento no navegador ---------- */

  const bindStepper = (container, { min = 0, max = 999, onChange } = {}) => {
    if (!container) return null;
    const output = container.querySelector("output, input");
    const minus = container.querySelector("[data-cx-step='-1']");
    const plus = container.querySelector("[data-cx-step='1']");
    const read = () => clampInteger(output?.value ?? output?.textContent, { min, max });
    const write = (value) => {
      const next = clampInteger(value, { min, max });
      if (output) {
        if ("value" in output) output.value = String(next);
        output.textContent = String(next);
      }
      if (minus) minus.disabled = next <= min;
      if (plus) plus.disabled = next >= max;
      if (typeof onChange === "function") onChange(next);
      return next;
    };
    container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-cx-step]");
      if (!button || button.disabled) return;
      write(read() + Number(button.dataset.cxStep));
    });
    write(read());
    return { get: read, set: write };
  };

  /* Modal: Esc fecha (nativo do <dialog>), Enter confirma se houver
     [data-cx-confirm] habilitado, foco volta para quem abriu. */
  const openModal = (dialog, { onConfirm } = {}) => {
    if (!dialog || typeof dialog.showModal !== "function") return;
    const opener = document.activeElement;
    const handleKey = (event) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      if (event.target && event.target.tagName === "TEXTAREA") return;
      const confirm = dialog.querySelector("[data-cx-confirm]");
      if (!confirm || confirm.disabled) return;
      event.preventDefault();
      if (typeof onConfirm === "function") onConfirm();
      else confirm.click();
    };
    const handleClose = () => {
      dialog.removeEventListener("keydown", handleKey);
      dialog.removeEventListener("close", handleClose);
      if (opener && typeof opener.focus === "function") opener.focus();
    };
    dialog.addEventListener("keydown", handleKey);
    dialog.addEventListener("close", handleClose);
    dialog.showModal();
    const first = dialog.querySelector("[autofocus], input, select, textarea, button");
    if (first) first.focus();
  };

  return Object.freeze({
    toCents,
    fromCents,
    formatMoney,
    splitEqually,
    cashChange,
    clampInteger,
    parseQuickEntry,
    formatTableNumber,
    bindStepper,
    openModal,
  });
});
