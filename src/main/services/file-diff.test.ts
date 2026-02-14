import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createFileDiff } from './file-diff';
import { MAX_TEXT_DIFF_BYTES } from './diff-policy';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('createFileDiff', () => {
  it('returns line-based text diff', async () => {
    const { leftRoot, rightRoot } = await createPairRoots();
    await writePair(leftRoot, rightRoot, 'note.txt', 'a\nb\n', 'a\nc\n');

    const result = await createFileDiff({
      leftRootPath: leftRoot,
      rightRootPath: rightRoot,
      relativePath: 'note.txt'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.kind).toBe('text');
    expect(result.data.lines.some((line) => line.type === 'removed' && line.text === 'b')).toBe(
      true
    );
    expect(result.data.lines.some((line) => line.type === 'added' && line.text === 'c')).toBe(
      true
    );
  });

  it('returns binary for known binary extension', async () => {
    const { leftRoot, rightRoot } = await createPairRoots();
    await writePair(leftRoot, rightRoot, 'image.png', 'not-real', 'also-not-real');

    const result = await createFileDiff({
      leftRootPath: leftRoot,
      rightRootPath: rightRoot,
      relativePath: 'image.png'
    });

    expect(result).toMatchObject({ ok: true, data: { kind: 'binary' } });
  });

  it('returns too_large when file exceeds max bytes', async () => {
    const { leftRoot, rightRoot } = await createPairRoots();
    const huge = 'x'.repeat(MAX_TEXT_DIFF_BYTES + 1);
    await writePair(leftRoot, rightRoot, 'large.txt', huge, huge);

    const result = await createFileDiff({
      leftRootPath: leftRoot,
      rightRootPath: rightRoot,
      relativePath: 'large.txt'
    });

    expect(result).toMatchObject({ ok: true, data: { kind: 'too_large' } });
  });

  it('returns not_found when one side is missing', async () => {
    const { leftRoot, rightRoot } = await createPairRoots();
    await mkdir(path.join(leftRoot, 'docs'), { recursive: true });
    await writeFile(path.join(leftRoot, 'docs', 'a.txt'), 'a');

    const result = await createFileDiff({
      leftRootPath: leftRoot,
      rightRootPath: rightRoot,
      relativePath: 'docs/a.txt'
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND', source: 'file_diff', step: 'read_file' }
    });
  });

  it('returns invalid_input when target is not file', async () => {
    const { leftRoot, rightRoot } = await createPairRoots();
    await mkdir(path.join(leftRoot, 'folder'), { recursive: true });
    await mkdir(path.join(rightRoot, 'folder'), { recursive: true });

    const result = await createFileDiff({
      leftRootPath: leftRoot,
      rightRootPath: rightRoot,
      relativePath: 'folder'
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT', source: 'file_diff', step: 'validate_input' }
    });
  });
});

async function createPairRoots(): Promise<{ leftRoot: string; rightRoot: string }> {
  const base = await mkdtemp(path.join(os.tmpdir(), 'diff-dir-test-'));
  const leftRoot = path.join(base, 'left');
  const rightRoot = path.join(base, 'right');
  await mkdir(leftRoot, { recursive: true });
  await mkdir(rightRoot, { recursive: true });
  tempRoots.push(base);
  return { leftRoot, rightRoot };
}

async function writePair(
  leftRoot: string,
  rightRoot: string,
  relativePath: string,
  leftContent: string,
  rightContent: string
): Promise<void> {
  const leftPath = path.join(leftRoot, relativePath);
  const rightPath = path.join(rightRoot, relativePath);
  await mkdir(path.dirname(leftPath), { recursive: true });
  await mkdir(path.dirname(rightPath), { recursive: true });
  await writeFile(leftPath, leftContent);
  await writeFile(rightPath, rightContent);
}
