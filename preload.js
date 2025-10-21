const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveAudio: (payload) => ipcRenderer.invoke('save-audio', payload)
});
