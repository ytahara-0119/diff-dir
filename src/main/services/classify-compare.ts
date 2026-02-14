import type { CompareItem, CompareSummary } from '../../shared/ipc';
import type { DirectoryEntry } from './walk-directory';

interface ClassifyResult {
  items: CompareItem[];
  summary: CompareSummary;
}

export function classifyEntries(
  leftEntries: DirectoryEntry[],
  rightEntries: DirectoryEntry[]
): ClassifyResult {
  const leftByPath = toEntryMap(leftEntries);
  const rightByPath = toEntryMap(rightEntries);
  const allPaths = Array.from(
    new Set([...leftByPath.keys(), ...rightByPath.keys()])
  ).sort((a, b) => a.localeCompare(b));

  const summary: CompareSummary = {
    same: 0,
    different: 0,
    leftOnly: 0,
    rightOnly: 0
  };

  const items = allPaths.map((relativePath) => {
    const left = leftByPath.get(relativePath);
    const right = rightByPath.get(relativePath);

    if (left && right) {
      const isSame = left.size === right.size && left.mtimeMs === right.mtimeMs;
      const status = isSame ? 'same' : 'different';
      if (isSame) {
        summary.same += 1;
      } else {
        summary.different += 1;
      }

      return {
        relativePath,
        status,
        left: {
          size: left.size,
          mtimeMs: left.mtimeMs
        },
        right: {
          size: right.size,
          mtimeMs: right.mtimeMs
        }
      } satisfies CompareItem;
    }

    if (left) {
      summary.leftOnly += 1;
      return {
        relativePath,
        status: 'left_only',
        left: {
          size: left.size,
          mtimeMs: left.mtimeMs
        }
      } satisfies CompareItem;
    }

    if (right) {
      summary.rightOnly += 1;
      return {
        relativePath,
        status: 'right_only',
        right: {
          size: right.size,
          mtimeMs: right.mtimeMs
        }
      } satisfies CompareItem;
    }

    throw new Error('Invalid compare state: entry is missing on both sides.');
  });

  return {
    items,
    summary
  };
}

function toEntryMap(entries: DirectoryEntry[]): Map<string, DirectoryEntry> {
  const map = new Map<string, DirectoryEntry>();
  for (const entry of entries) {
    map.set(entry.relativePath, entry);
  }
  return map;
}
