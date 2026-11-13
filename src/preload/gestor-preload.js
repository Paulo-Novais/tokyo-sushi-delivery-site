"use strict";

// Roda dentro das telas do Gestor abertas no app. Não expõe nada para a página:
// só avisa o app em qual seção do Gestor a tela está (body[data-admin-section]).
// Quem decide é o processo principal (src/main/main.js, scheduleSectionCheck):
// ele só age depois que a página recebeu a sessão do Gestor, porque antes disso
// o Gestor passa por seções provisórias (ex.: "users") enquanto carrega.
const { ipcRenderer } = require("electron");

let lastSection = null;

const report = () => {
  const section = (document.body && document.body.dataset.adminSection) || "";
  if (section !== lastSection) {
    lastSection = section;
    ipcRenderer.send("gestor:section", section);
  }
};

window.addEventListener("DOMContentLoaded", () => {
  report();
  if (document.body) {
    new MutationObserver(report).observe(document.body, {
      attributes: true,
      attributeFilter: ["data-admin-section"],
    });
  }
});
