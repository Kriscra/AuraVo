const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridge', {
  chooseSaveLocation(defaultPath, filters) {
    return ipcRenderer.invoke('dialog:select-save-location', {
      defaultPath,
      filters
    });
  },
  writeFile(filePath, data) {
    return ipcRenderer.invoke('file:write', { filePath, data });
  },
  pickAudioFile() {
    return ipcRenderer.invoke('dialog:open-audio-file');
  }
});
