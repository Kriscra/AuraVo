const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveAudio: (buffer) => ipcRenderer.invoke('save-audio', buffer)
});
