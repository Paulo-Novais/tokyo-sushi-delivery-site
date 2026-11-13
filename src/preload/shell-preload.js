"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// Ponte entre a interface do app (src/renderer) e o processo principal.
contextBridge.exposeInMainWorld("pdv", {
  getState: () => ipcRenderer.invoke("pdv:get-state"),
  login: (form) => ipcRenderer.invoke("pdv:login", form),
  logout: () => ipcRenderer.invoke("pdv:logout"),
  open: (moduleId, routeId) => ipcRenderer.invoke("pdv:open", { moduleId, routeId }),
  reload: () => ipcRenderer.invoke("pdv:reload"),
  retry: () => ipcRenderer.invoke("pdv:retry"),
  setServer: (url) => ipcRenderer.invoke("pdv:set-server", { url }),
  listCatalog: () => ipcRenderer.invoke("pdv:catalog:list"),
  setAvailability: (itemId, state) => ipcRenderer.invoke("pdv:catalog:set", { itemId, state }),
  setStageBounds: (rect) => ipcRenderer.send("pdv:stage-bounds", rect),
  checkUpdate: () => ipcRenderer.invoke("pdv:update:check"),
  installUpdate: () => ipcRenderer.invoke("pdv:update:install"),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("pdv:state", listener);
    return () => ipcRenderer.removeListener("pdv:state", listener);
  },
});
