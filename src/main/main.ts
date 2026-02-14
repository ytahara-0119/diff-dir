import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { stat } from 'node:fs/promises';
import { IPC_CHANNELS } from '../shared/ipc';
import type {
  CompareRequest,
  CompareResponse,
  FileDiffRequest,
  FileDiffResponse
} from '../shared/ipc';
import { DEFAULT_EXCLUDED_NAMES, walkDirectory } from './services/walk-directory';
import { classifyEntries } from './services/classify-compare';
import { createFileDiff } from './services/file-diff';
import type { DirectoryEntry } from './services/walk-directory';
import {
  getDiffKindHint,
  KNOWN_BINARY_EXTENSIONS,
  MAX_TEXT_DIFF_BYTES
} from './services/diff-policy';

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

ipcMain.handle(
  IPC_CHANNELS.runCompare,
  async (_event, request: CompareRequest): Promise<CompareResponse> => {
    const leftPath = normalizeInputPath(request.leftPath);
    const rightPath = normalizeInputPath(request.rightPath);

    if (!leftPath || !rightPath) {
      return compareError(
        'INVALID_INPUT',
        'Both leftPath and rightPath are required.',
        'validate_input',
        false
      );
    }

    try {
      const leftStats = await stat(leftPath);
      const rightStats = await stat(rightPath);
      if (!leftStats.isDirectory() || !rightStats.isDirectory()) {
        return compareError(
          'INVALID_INPUT',
          'Both paths must point to directories.',
          'validate_input',
          false
        );
      }
    } catch (error: unknown) {
      return mapCompareFsError(error, 'validate_input');
    }

    const appliedExcludeNames = buildExcludeNameList(request.excludeNames);
    let leftEntries: DirectoryEntry[];
    let rightEntries: DirectoryEntry[];
    try {
      [leftEntries, rightEntries] = await Promise.all([
        walkDirectory(leftPath, { excludedNames: appliedExcludeNames }),
        walkDirectory(rightPath, { excludedNames: appliedExcludeNames })
      ]);
    } catch (error: unknown) {
      return mapCompareFsError(error, 'scan_directory');
    }

    let summary;
    let itemsWithHints;
    try {
      const classified = classifyEntries(leftEntries, rightEntries);
      summary = classified.summary;
      itemsWithHints = classified.items.map((item) => {
        if (item.status !== 'different' || !item.left || !item.right) {
          return item;
        }
        return {
          ...item,
          diffKindHint: getDiffKindHint(
            item.relativePath,
            item.left.size,
            item.right.size
          )
        };
      });
    } catch {
      return compareError(
        'INTERNAL_ERROR',
        'Failed to classify comparison results.',
        'classify_result',
        true
      );
    }

    return {
      ok: true,
      data: {
        request,
        leftFileCount: leftEntries.length,
        rightFileCount: rightEntries.length,
        appliedExcludeNames,
        diffPolicy: {
          maxTextDiffBytes: MAX_TEXT_DIFF_BYTES,
          binaryExtensions: [...KNOWN_BINARY_EXTENSIONS]
        },
        summary,
        items: itemsWithHints,
        requestId: crypto.randomUUID(),
        generatedAt: new Date().toISOString()
      }
    };
  }
);

ipcMain.handle(
  IPC_CHANNELS.getFileDiff,
  async (_event, request: FileDiffRequest): Promise<FileDiffResponse> =>
    createFileDiff(request)
);

ipcMain.handle(IPC_CHANNELS.selectDirectory, async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (result.canceled) {
    return null;
  }
  return result.filePaths[0] ?? null;
});

function buildExcludeNameList(customExcludeNames: string[] = []): string[] {
  return Array.from(
    new Set([...DEFAULT_EXCLUDED_NAMES, ...customExcludeNames.map((name) => name.trim())])
  ).filter((name) => name.length > 0);
}

function compareError(
  code: 'INVALID_INPUT' | 'NOT_FOUND' | 'PERMISSION_DENIED' | 'INTERNAL_ERROR',
  message: string,
  step: 'validate_input' | 'scan_directory' | 'classify_result' | 'unexpected',
  retryable: boolean
): CompareResponse {
  return {
    ok: false,
    error: {
      code,
      message,
      source: 'compare',
      step,
      retryable
    }
  };
}

function mapCompareFsError(
  error: unknown,
  step: 'validate_input' | 'scan_directory'
): CompareResponse {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  if (code === 'ENOENT' || code === 'ENOTDIR') {
    return compareError(
      'NOT_FOUND',
      'Directory path was not found. Please verify both folder paths.',
      step,
      false
    );
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return compareError(
      'PERMISSION_DENIED',
      'Cannot access one of the selected directories due to permission restrictions.',
      step,
      false
    );
  }
  return compareError(
    'INTERNAL_ERROR',
    'Unexpected error while running folder comparison.',
    'unexpected',
    true
  );
}

function normalizeInputPath(rawPath: string): string {
  const trimmed = rawPath.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed) {
    return '';
  }

  if (trimmed === '~') {
    return os.homedir();
  }
  if (trimmed.startsWith('~/')) {
    return path.join(os.homedir(), trimmed.slice(2));
  }
  return trimmed;
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL as string);
    win.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  void win.loadFile(path.join(__dirname, '../../renderer/index.html'));
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
