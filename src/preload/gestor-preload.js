"use strict";

// Roda dentro das telas do Gestor abertas no app. Não expõe nada para a página:
// só avisa o app em qual seção do Gestor a tela está, para o app voltar para
// Pedidos se alguém chegar ao painel, financeiro, relatórios etc.
//
// Ao abrir, o Gestor passa rapidamente por outras seções antes de chegar na
// pedida (ex.: "users" por um instante ao abrir o Caixa). Por isso só avisamos
// depois que a seção fica parada por um tempo.
const { ipcRenderer } = require("electron");

const SETTLE_MS = 1200;
let lastReported = null;
let timer = null;

const read = () => (document.body && document.body.dataset.adminSection) || "";

const schedule = () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const section = read();
    if (section !== lastReported) {
      lastReported = section;
      ipcRenderer.send("gestor:section", section);
    }
  }, SETTLE_MS);
};

window.addEventListener("DOMContentLoaded", () => {
  schedule();
  if (document.body) {
    new MutationObserver(schedule).observe(document.body, {
      attributes: true,
      attributeFilter: ["data-admin-section"],
    });
  }
});
