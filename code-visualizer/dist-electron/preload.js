"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("codyn", {
  repository: {
    selectFolder: () => electron.ipcRenderer.invoke("repository:selectFolder"),
    getTree: (path) => electron.ipcRenderer.invoke("repository:getTree", path),
    analyzeCST: (path) => electron.ipcRenderer.invoke("repository:analyzeCST", path)
  },
  graph: {
    generate: (path) => electron.ipcRenderer.invoke("graph:generate", path)
  }
});
