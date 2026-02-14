import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { diffLines } from 'diff';
import type {
  FileDiffLine,
  FileDiffRequest,
  FileDiffResponse
} from '../../shared/ipc';

const MAX_TEXT_DIFF_BYTES = 1024 * 1024;
const KNOWN_BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.ico',
  '.pdf',
  '.zip',
  '.gz',
  '.mp3',
  '.mp4',
  '.mov',
  '.exe',
  '.dll',
  '.so',
  '.dylib'
]);

export async function createFileDiff(
  request: FileDiffRequest
): Promise<FileDiffResponse> {
  const leftPath = path.join(request.leftRootPath, request.relativePath);
  const rightPath = path.join(request.rightRootPath, request.relativePath);

  try {
    const [leftStat, rightStat] = await Promise.all([stat(leftPath), stat(rightPath)]);
    if (!leftStat.isFile() || !rightStat.isFile()) {
      return invalidInput('Both compared targets must be files.');
    }

    if (leftStat.size > MAX_TEXT_DIFF_BYTES || rightStat.size > MAX_TEXT_DIFF_BYTES) {
      return {
        ok: true,
        data: {
          relativePath: request.relativePath,
          kind: 'too_large',
          lines: [],
          maxBytes: MAX_TEXT_DIFF_BYTES
        }
      };
    }

    const [leftBuffer, rightBuffer] = await Promise.all([
      readFile(leftPath),
      readFile(rightPath)
    ]);

    if (isBinaryFile(leftPath, leftBuffer) || isBinaryFile(rightPath, rightBuffer)) {
      return {
        ok: true,
        data: {
          relativePath: request.relativePath,
          kind: 'binary',
          lines: [],
          maxBytes: MAX_TEXT_DIFF_BYTES
        }
      };
    }

    const lines = createLineDiff(
      leftBuffer.toString('utf8'),
      rightBuffer.toString('utf8')
    );

    return {
      ok: true,
      data: {
        relativePath: request.relativePath,
        kind: 'text',
        lines,
        maxBytes: MAX_TEXT_DIFF_BYTES
      }
    };
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ENOENT') {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Compared file was not found on one or both sides.'
        }
      };
    }

    if (code === 'EACCES' || code === 'EPERM' || code === 'ENOTDIR') {
      return invalidInput('Compared file path is invalid or inaccessible.');
    }

    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected error while creating file diff.'
      }
    };
  }
}

function invalidInput(message: string): FileDiffResponse {
  return {
    ok: false,
    error: {
      code: 'INVALID_INPUT',
      message
    }
  };
}

function isBinaryFile(filePath: string, content: Buffer): boolean {
  const extension = path.extname(filePath).toLowerCase();
  if (KNOWN_BINARY_EXTENSIONS.has(extension)) {
    return true;
  }

  const bytesToCheck = Math.min(content.length, 8000);
  for (let index = 0; index < bytesToCheck; index += 1) {
    if (content[index] === 0) {
      return true;
    }
  }

  return false;
}

function createLineDiff(leftText: string, rightText: string): FileDiffLine[] {
  const changes = diffLines(leftText, rightText);
  const lines: FileDiffLine[] = [];
  let leftLine = 1;
  let rightLine = 1;

  for (const change of changes) {
    const values = toLines(change.value);

    if (change.added) {
      for (const value of values) {
        lines.push({
          type: 'added',
          text: value,
          rightLineNumber: rightLine
        });
        rightLine += 1;
      }
      continue;
    }

    if (change.removed) {
      for (const value of values) {
        lines.push({
          type: 'removed',
          text: value,
          leftLineNumber: leftLine
        });
        leftLine += 1;
      }
      continue;
    }

    for (const value of values) {
      lines.push({
        type: 'context',
        text: value,
        leftLineNumber: leftLine,
        rightLineNumber: rightLine
      });
      leftLine += 1;
      rightLine += 1;
    }
  }

  return lines;
}

function toLines(value: string): string[] {
  const split = value.split('\n');
  if (split[split.length - 1] === '') {
    split.pop();
  }
  return split;
}
