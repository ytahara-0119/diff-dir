import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_EXCLUDED_NAMES = ['.git', 'node_modules'] as const;

export interface DirectoryEntry {
  absolutePath: string;
  relativePath: string;
  size: number;
  mtimeMs: number;
}

export interface WalkDirectoryOptions {
  excludedNames?: string[];
}

export async function walkDirectory(
  rootPath: string,
  options: WalkDirectoryOptions = {}
): Promise<DirectoryEntry[]> {
  const rootStats = await stat(rootPath);
  if (!rootStats.isDirectory()) {
    throw new Error('Target path is not a directory.');
  }

  const excludedNameSet = buildExcludedNameSet(options.excludedNames);
  const entries: DirectoryEntry[] = [];

  const visit = async (currentPath: string): Promise<void> => {
    const dirents = await readdir(currentPath, { withFileTypes: true });

    for (const dirent of dirents) {
      if (excludedNameSet.has(dirent.name)) {
        continue;
      }

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

function buildExcludedNameSet(customExcludedNames: string[] = []): Set<string> {
  const normalizedCustom = customExcludedNames
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  return new Set<string>([...DEFAULT_EXCLUDED_NAMES, ...normalizedCustom]);
}
