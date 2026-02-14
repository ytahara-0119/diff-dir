import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import crypto from 'node:crypto';
import { stat } from 'node:fs/promises';
import { IPC_CHANNELS } from '../shared/ipc';
import type { CompareRequest, CompareResponse } from '../shared/ipc';
import { DEFAULT_EXCLUDED_NAMES, walkDirectory } from './services/walk-directory';
import { classifyEntries } from './services/classify-compare';

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

      const leftStats = await stat(request.leftPath);
      const rightStats = await stat(request.rightPath);
      if (!leftStats.isDirectory() || !rightStats.isDirectory()) {
        return {
          ok: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Both paths must point to directories.'
          }
        };
      }

      const appliedExcludeNames = buildExcludeNameList(request.excludeNames);
      const [leftEntries, rightEntries] = await Promise.all([
        walkDirectory(request.leftPath, { excludedNames: appliedExcludeNames }),
        walkDirectory(request.rightPath, { excludedNames: appliedExcludeNames })
      ]);
      const { items, summary } = classifyEntries(leftEntries, rightEntries);

      return {
        ok: true,
        data: {
          request,
          leftFileCount: leftEntries.length,
          rightFileCount: rightEntries.length,
          appliedExcludeNames,
          summary,
          items,
          requestId: crypto.randomUUID(),
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error: unknown) {
      if (isInvalidInputError(error)) {
        return {
          ok: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Directory path is invalid or inaccessible.'
          }
        };
      }

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

function isInvalidInputError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const maybeCode = (error as NodeJS.ErrnoException).code;
  return (
    maybeCode === 'ENOENT' ||
    maybeCode === 'ENOTDIR' ||
    maybeCode === 'EACCES' ||
    maybeCode === 'EPERM'
  );
}

function buildExcludeNameList(customExcludeNames: string[] = []): string[] {
  return Array.from(
    new Set([...DEFAULT_EXCLUDED_NAMES, ...customExcludeNames.map((name) => name.trim())])
  ).filter((name) => name.length > 0);
}

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
