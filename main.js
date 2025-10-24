const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f0f10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.removeMenu();

  win.loadFile('index.html');

  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('dialog:select-save-location', async (_event, options) => {
  const { defaultPath, filters } = options;
  const result = await dialog.showSaveDialog({
    title: 'Save recording',
    defaultPath,
    filters,
    properties: ['showOverwriteConfirmation']
  });

  if (result.canceled) {
    return null;
  }

  return result.filePath;
});

ipcMain.handle('file:write', async (_event, payload) => {
  const { filePath, data } = payload;
  if (!filePath) {
    throw new Error('No file path provided');
  }

  const buffer = Buffer.from(data);
  await fs.promises.writeFile(filePath, buffer);
  return true;
});

ipcMain.handle('dialog:open-audio-file', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Import audio file',
    properties: ['openFile'],
    filters: [
      { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'webm', 'flac', 'm4a', 'aac'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const data = await fs.promises.readFile(filePath);
  return {
    name: path.basename(filePath),
    path: filePath,
    data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
  };
});
