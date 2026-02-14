import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import crypto from 'node:crypto';
import { IPC_CHANNELS } from '../shared/ipc';
import type { CompareRequest, CompareResponse } from '../shared/ipc';

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

ipcMain.handle(
  IPC_CHANNELS.runCompare,
  async (_event, request: CompareRequest): Promise<CompareResponse> => {
    try {
      if (!request.leftPath || !request.rightPath) {
        return {
          ok: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Both leftPath and rightPath are required.'
          }
        };
      }

      return {
        ok: true,
        data: {
          request,
          message: 'IPC request received. Compare engine will be added later.',
          requestId: crypto.randomUUID(),
          generatedAt: new Date().toISOString()
        }
      };
    } catch {
      return {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unexpected error while processing compare request.'
        }
      };
    }
  }
);

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL as string);
    win.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  void win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

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
