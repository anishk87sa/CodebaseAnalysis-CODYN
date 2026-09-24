import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('codyn', {
  repository: {
    selectFolder: () => ipcRenderer.invoke('repository:selectFolder'),
    getTree: (path: string) => ipcRenderer.invoke('repository:getTree', path),
    analyzeCST: (path: string) => ipcRenderer.invoke('repository:analyzeCST', path),
  },
  graph: {
    generate: (path: string) => ipcRenderer.invoke('graph:generate', path),
  }
})
