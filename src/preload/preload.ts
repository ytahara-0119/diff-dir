import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc';
import type {
  CompareRequest,
  CompareResponse,
  FileDiffRequest,
  FileDiffResponse
} from '../shared/ipc';

contextBridge.exposeInMainWorld('appInfo', {
  name: 'diff-dir',
  version: '0.1.0'
});

contextBridge.exposeInMainWorld('diffDirApi', {
  runCompare: (request: CompareRequest): Promise<CompareResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.runCompare, request),
  getFileDiff: (request: FileDiffRequest): Promise<FileDiffResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.getFileDiff, request),
  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.selectDirectory),
  resolveDirectoryPath: (rawPath: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.resolveDirectoryPath, rawPath),
  getDroppedFilePath: (file: File): string | null => {
    try {
      const resolved = webUtils.getPathForFile(file);
      return resolved || null;
    } catch {
      return null;
    }
  }
});
