# Manual Compare Fixtures

Use these two folders in the app:
- Left: `fixtures/manual-compare/left`
- Right: `fixtures/manual-compare/right`

Included cases:
- `same.txt`: identical on both sides
- `diff-100-lines.txt`: ~100 lines with multiple changed blocks
- `left-only.txt`: only in left
- `right-only.txt`: only in right
- `sub/nested-left-only.md`: nested left-only file
- `sub/nested-right-only.md`: nested right-only file
- `image.png`: binary-like file on both sides
- `large.txt`: files larger than 1MB (too_large case)
