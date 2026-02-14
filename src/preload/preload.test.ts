import { describe, expect, it, vi, beforeEach } from 'vitest';

const exposeInMainWorld = vi.fn();
const invoke = vi.fn();

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke }
}));

describe('preload bridge', () => {
  beforeEach(() => {
    exposeInMainWorld.mockClear();
    invoke.mockClear();
    vi.resetModules();
  });

  it('exposes appInfo and diffDirApi', async () => {
    await import('./preload');

    expect(exposeInMainWorld).toHaveBeenCalledWith('appInfo', {
      name: 'diff-dir',
      version: '0.1.0'
    });

    const apiCall = exposeInMainWorld.mock.calls.find(
      ([name]) => name === 'diffDirApi'
    );
    expect(apiCall).toBeTruthy();

    const api = apiCall?.[1] as {
      runCompare: (request: { leftPath: string; rightPath: string }) => Promise<unknown>;
      getFileDiff: (request: {
        leftRootPath: string;
        rightRootPath: string;
        relativePath: string;
      }) => Promise<unknown>;
      selectDirectory: () => Promise<string | null>;
      resolveDirectoryPath: (rawPath: string) => Promise<string | null>;
    };

    await api.runCompare({ leftPath: '/tmp/left', rightPath: '/tmp/right' });
    await api.getFileDiff({
      leftRootPath: '/tmp/left',
      rightRootPath: '/tmp/right',
      relativePath: 'a.txt'
    });
    await api.selectDirectory();
    await api.resolveDirectoryPath('/tmp/file.txt');

    expect(invoke).toHaveBeenCalledTimes(4);
  });
});
