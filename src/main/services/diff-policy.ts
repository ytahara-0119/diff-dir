import path from 'node:path';
import {
  KNOWN_BINARY_EXTENSIONS,
  MAX_TEXT_DIFF_BYTES
} from '../../shared/diff-policy';
import type { DiffKindHint } from '../../shared/ipc';

const binaryExtensionSet = new Set(KNOWN_BINARY_EXTENSIONS);

export function getDiffKindHint(
  relativePath: string,
  leftSize: number,
  rightSize: number
): DiffKindHint {
  if (leftSize > MAX_TEXT_DIFF_BYTES || rightSize > MAX_TEXT_DIFF_BYTES) {
    return 'too_large';
  }

  if (isBinaryPath(relativePath)) {
    return 'binary';
  }

  return 'text';
}

export function isBinaryPath(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return binaryExtensionSet.has(extension as (typeof KNOWN_BINARY_EXTENSIONS)[number]);
}

export { MAX_TEXT_DIFF_BYTES, KNOWN_BINARY_EXTENSIONS };
