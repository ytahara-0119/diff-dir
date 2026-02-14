/// <reference types="vite/client" />

declare global {
  interface Window {
    appInfo: {
      name: string;
      version: string;
    };
  }
}

export {};
