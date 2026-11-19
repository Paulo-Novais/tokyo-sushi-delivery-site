"use strict";

// Roda dentro das telas do Gestor abertas no app. Avisa o app em qual seção do
// Gestor a tela está (para voltar para Pedidos se alguém chegar ao painel,
// financeiro, relatórios etc.) e expõe só uma ação para a página:
// window.InovasPDV.getUpdate() e updateNow() — a faixa "Atualizar agora" do Gestor.
//
// Ao abrir, o Gestor passa rapidamente por outras seções antes de chegar na
// pedida (ex.: "users" por um instante ao abrir o Caixa). Por isso só avisamos
// depois que a seção fica parada por um tempo.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("InovasPDV", {
  getUpdate: () => ipcRenderer.invoke("gestor:update-state"),
  updateNow: () => ipcRenderer.invoke("gestor:update-now"),
});

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
