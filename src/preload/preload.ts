import { contextBridge, ipcRenderer } from 'electron';
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
    ipcRenderer.invoke(IPC_CHANNELS.getFileDiff, request)
});
