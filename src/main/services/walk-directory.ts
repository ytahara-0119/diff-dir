import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export interface DirectoryEntry {
  absolutePath: string;
  relativePath: string;
  size: number;
  mtimeMs: number;
}

export async function walkDirectory(rootPath: string): Promise<DirectoryEntry[]> {
  const rootStats = await stat(rootPath);
  if (!rootStats.isDirectory()) {
    throw new Error('Target path is not a directory.');
  }

  const entries: DirectoryEntry[] = [];

  const visit = async (currentPath: string): Promise<void> => {
    const dirents = await readdir(currentPath, { withFileTypes: true });

    for (const dirent of dirents) {
      const absolutePath = path.join(currentPath, dirent.name);

      if (dirent.isSymbolicLink()) {
        continue;
      }

      if (dirent.isDirectory()) {
        await visit(absolutePath);
        continue;
      }

      if (!dirent.isFile()) {
        continue;
      }

      const fileStats = await stat(absolutePath);
      entries.push({
        absolutePath,
        relativePath: toRelativePath(rootPath, absolutePath),
        size: fileStats.size,
        mtimeMs: fileStats.mtimeMs
      });
    }
  };

  await visit(rootPath);
  entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return entries;
}

function toRelativePath(rootPath: string, absolutePath: string): string {
  return path.relative(rootPath, absolutePath).split(path.sep).join('/');
}
