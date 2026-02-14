/// <reference types="vite/client" />
import type { DiffDirApi } from '../shared/ipc';

declare global {
  interface Window {
    appInfo: {
      name: string;
      version: string;
    };
    diffDirApi: DiffDirApi;
  }
}

export {};
