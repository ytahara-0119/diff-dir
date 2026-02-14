import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { diffLines } from 'diff';
import type {
  FileDiffLine,
  FileDiffRequest,
  FileDiffResponse
} from '../../shared/ipc';
import { isBinaryPath, MAX_TEXT_DIFF_BYTES } from './diff-policy';

const FILE_DIFF_ERROR_MESSAGE = {
  INVALID_INPUT: 'The selected file path is invalid or inaccessible.',
  NOT_FOUND: 'The selected file was not found on one or both sides.',
  INTERNAL_ERROR: 'Unexpected error while creating file diff.'
} as const;

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
          message: FILE_DIFF_ERROR_MESSAGE.NOT_FOUND
        }
      };
    }

    if (code === 'EACCES' || code === 'EPERM' || code === 'ENOTDIR') {
      return invalidInput(FILE_DIFF_ERROR_MESSAGE.INVALID_INPUT);
    }

    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: FILE_DIFF_ERROR_MESSAGE.INTERNAL_ERROR
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
  if (isBinaryPath(filePath)) {
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
