import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('appInfo', {
  name: 'diff-dir',
  version: '0.1.0'
});
