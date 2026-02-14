import { describe, expect, it } from 'vitest';
import { getDiffKindHint, MAX_TEXT_DIFF_BYTES } from './diff-policy';

describe('getDiffKindHint', () => {
  it('returns too_large when either side is over max bytes', () => {
    expect(getDiffKindHint('note.txt', MAX_TEXT_DIFF_BYTES + 1, 1)).toBe('too_large');
  });

  it('returns binary for known binary extensions', () => {
    expect(getDiffKindHint('image.png', 10, 10)).toBe('binary');
  });

  it('returns text for normal text file', () => {
    expect(getDiffKindHint('readme.md', 10, 10)).toBe('text');
  });
});
