import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { walkDirectory } from './walk-directory';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('walkDirectory', () => {
  it('walks recursively and excludes default names', async () => {
    const root = await makeTempDir();
    await mkdir(path.join(root, 'nested'), { recursive: true });
    await mkdir(path.join(root, '.git'), { recursive: true });
    await mkdir(path.join(root, 'node_modules', 'pkg'), { recursive: true });
    await writeFile(path.join(root, 'root.txt'), 'root');
    await writeFile(path.join(root, 'nested', 'child.txt'), 'child');
    await writeFile(path.join(root, '.git', 'config'), 'ignored');
    await writeFile(path.join(root, 'node_modules', 'pkg', 'index.js'), 'ignored');

    const entries = await walkDirectory(root);

    expect(entries.map((entry) => entry.relativePath)).toEqual([
      'nested/child.txt',
      'root.txt'
    ]);
  });

  it('supports custom excluded names and skips symlinks', async () => {
    const root = await makeTempDir();
    await mkdir(path.join(root, 'keep'), { recursive: true });
    await mkdir(path.join(root, 'tmp-cache'), { recursive: true });
    await writeFile(path.join(root, 'keep', 'ok.txt'), 'ok');
    await writeFile(path.join(root, 'tmp-cache', 'ignore.txt'), 'ignore');
    await symlink(path.join(root, 'keep', 'ok.txt'), path.join(root, 'shortcut.txt'));

    const entries = await walkDirectory(root, { excludedNames: ['tmp-cache'] });

    expect(entries.map((entry) => entry.relativePath)).toEqual(['keep/ok.txt']);
  });
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'diff-dir-test-'));
  tempRoots.push(dir);
  return dir;
}
