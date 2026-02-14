import { describe, expect, it } from 'vitest';
import { classifyEntries } from './classify-compare';
import type { DirectoryEntry } from './walk-directory';

describe('classifyEntries', () => {
  it('classifies entries into same/different/left_only/right_only', () => {
    const leftEntries: DirectoryEntry[] = [
      entry('same.txt', 10, 1000),
      entry('diff.txt', 11, 1000),
      entry('left-only.txt', 9, 1000)
    ];
    const rightEntries: DirectoryEntry[] = [
      entry('same.txt', 10, 1000),
      entry('diff.txt', 11, 2000),
      entry('right-only.txt', 7, 1000)
    ];

    const result = classifyEntries(leftEntries, rightEntries);

    expect(result.summary).toEqual({
      same: 1,
      different: 1,
      leftOnly: 1,
      rightOnly: 1
    });
    expect(result.items.map((item) => `${item.relativePath}:${item.status}`)).toEqual([
      'diff.txt:different',
      'left-only.txt:left_only',
      'right-only.txt:right_only',
      'same.txt:same'
    ]);
  });
});

function entry(relativePath: string, size: number, mtimeMs: number): DirectoryEntry {
  return {
    absolutePath: `/tmp/${relativePath}`,
    relativePath,
    size,
    mtimeMs
  };
}
