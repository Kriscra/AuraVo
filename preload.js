const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveAudio: (payload) => ipcRenderer.invoke('save-audio', payload),
  minimizeWindow: () => ipcRenderer.send('window-control', 'minimize'),
  closeWindow: () => ipcRenderer.send('window-control', 'close')
});
