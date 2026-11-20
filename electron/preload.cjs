const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mdlite', {
  getDocument: () => ipcRenderer.invoke('document:get'),
  open: () => ipcRenderer.invoke('document:open'),
  newDocument: () => ipcRenderer.invoke('document:new'),
  save: (text, saveAs = false) => ipcRenderer.invoke('document:save', text, saveAs),
  changed: text => ipcRenderer.invoke('document:changed', text),
  onCommand: callback => {
    const handler = (_event, command) => callback(command);
    ipcRenderer.on('command', handler);
    return () => ipcRenderer.removeListener('command', handler);
  },
  onDocument: callback => {
    const handler = (_event, document) => callback(document);
    ipcRenderer.on('document', handler);
    return () => ipcRenderer.removeListener('document', handler);
  },
});
