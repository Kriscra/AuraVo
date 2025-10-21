const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const createWindow = () => {
  const win = new BrowserWindow({
    width: 900,
    height: 620,
    backgroundColor: '#08070d',
    autoHideMenuBar: true,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
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

ipcMain.on('window-control', (event, action) => {
  const targetWindow = BrowserWindow.fromWebContents(event.sender);
  if (!targetWindow) {
    return;
  }

  switch (action) {
    case 'minimize':
      targetWindow.minimize();
      break;
    case 'close':
      targetWindow.close();
      break;
    default:
      break;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('save-audio', async (_event, payload) => {
  const { buffer, extension = 'wav', suggestedName, mimeType } = payload || {};

  if (!buffer) {
    return { success: false, error: 'Herhangi bir kayıt verisi iletilmedi.' };
  }

  const normalizedExtension = extension.replace(/^\./, '').toLowerCase();
  const defaultFileName = suggestedName || `AuraVo-kayit.${normalizedExtension}`;

  const filters = [
    {
      name: `${normalizedExtension.toUpperCase()} Dosyası`,
      extensions: [normalizedExtension]
    }
  ];

  if (mimeType) {
    filters[0].name = `${normalizedExtension.toUpperCase()} (${mimeType})`;
  }

  filters.push({ name: 'Tüm Dosyalar', extensions: ['*'] });

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Kayıt Dosyasını Kaydet',
    defaultPath: defaultFileName,
    filters
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
