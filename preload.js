const { contextBridge, ipcRenderer } = require('electron');

function normalizeSaveOptions(input, filters) {
  if (typeof input === 'string') {
    return { defaultPath: input, filters };
  }
  if (input && typeof input === 'object') {
    if (filters && !input.filters) {
      return { ...input, filters };
    }
    return input;
  }
  return { defaultPath: undefined, filters };
}

contextBridge.exposeInMainWorld('bridge', {
  chooseSaveLocation(options, filters) {
    const payload = normalizeSaveOptions(options, filters);
    return ipcRenderer.invoke('dialog:select-save-location', payload);
  },
  writeFile(filePath, data) {
    return ipcRenderer.invoke('file:write', { filePath, data });
  },
  pickAudioFile() {
    return ipcRenderer.invoke('dialog:open-audio-file');
  },
  pickDirectory() {
    return ipcRenderer.invoke('dialog:select-directory');
  },
  loadSettings() {
    return ipcRenderer.invoke('settings:read');
  },
  saveSettings(data) {
    return ipcRenderer.invoke('settings:write', data);
  }
});
