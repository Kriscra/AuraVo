const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const createWindow = () => {
  const win = new BrowserWindow({
    width: 900,
    height: 620,
    backgroundColor: '#08070d',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('index.html');
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('save-audio', async (_event, buffer) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Kayıt Dosyasını Kaydet',
    defaultPath: 'AuraVo-kayit.wav',
    filters: [
      { name: 'WAV Audio', extensions: ['wav'] },
      { name: 'Tüm Dosyalar', extensions: ['*'] }
    ]
  });

  if (canceled || !filePath) {
    return { success: false };
  }

  try {
    await fs.promises.writeFile(filePath, Buffer.from(buffer));
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
