import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc';
import type { CompareRequest, CompareResponse } from '../shared/ipc';

contextBridge.exposeInMainWorld('appInfo', {
  name: 'diff-dir',
  version: '0.1.0'
});

contextBridge.exposeInMainWorld('diffDirApi', {
  runCompare: (request: CompareRequest): Promise<CompareResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.runCompare, request)
});
