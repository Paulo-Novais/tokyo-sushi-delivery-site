"use strict";

// Contagem regressiva da licença do caixa local (sem Electron, testável).
//
// Com internet o app renova o passe de 24 h o tempo todo, e a contagem não
// aparece. Quando a internet cai, a tela mostra quanto falta para o fim do
// passe. Ao zerar, o sistema bloqueia e faz logout até conectar e renovar.
//
// Relógio: o app guarda o maior horário já visto (lastSeenAt). Se o relógio do
// Windows voltar para trás além da tolerância, a licença é tratada como
// vencida (impede "ganhar tempo" atrasando o relógio).

const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;
const WARN_BELOW_MS = 12 * 60 * 60 * 1000;
const URGENT_BELOW_MS = 2 * 60 * 60 * 1000;

const formatCountdown = (milliseconds) => {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h${String(minutes).padStart(2, "0")}`;
};

const evaluateLicense = ({ lease, online, now, lastSeenAt = 0 }) => {
  if (!lease || !Number.isFinite(lease.expiresAt)) {
    return { state: "missing", blocked: true, remainingMs: 0, label: "", level: "blocked" };
  }
  if (Number.isFinite(lastSeenAt) && now + CLOCK_TOLERANCE_MS < lastSeenAt) {
    return { state: "expired", reason: "clock", blocked: true, remainingMs: 0, label: "0h00", level: "blocked" };
  }
  const effectiveNow = Math.max(now, Number.isFinite(lastSeenAt) ? lastSeenAt : 0);
  const remainingMs = lease.expiresAt - effectiveNow;
  if (remainingMs <= 0) {
    return { state: "expired", reason: "time", blocked: true, remainingMs: 0, label: "0h00", level: "blocked" };
  }
  if (online) {
    return { state: "online", blocked: false, remainingMs, label: "", level: "ok" };
  }
  return {
    state: "offline",
    blocked: false,
    remainingMs,
    label: formatCountdown(remainingMs),
    level: remainingMs <= URGENT_BELOW_MS ? "urgent" : remainingMs <= WARN_BELOW_MS ? "warn" : "info",
  };
};

module.exports = {
  CLOCK_TOLERANCE_MS,
  URGENT_BELOW_MS,
  WARN_BELOW_MS,
  evaluateLicense,
  formatCountdown,
};
