import { useEffect, useMemo, useState } from 'react';
import type { DragEvent, FormEvent } from 'react';
import type {
  CompareItem,
  CompareResponse,
  FileDiffLine,
  FileDiffResponse
} from '../shared/ipc';

type PaneSide = 'left' | 'right';
type ElectronFile = File & { path?: string };
type StatusFilter = 'all' | 'same' | 'different' | 'left_only' | 'right_only';
type SortKey = 'relativePath' | 'status' | 'leftSize' | 'rightSize';
type SortDirection = 'asc' | 'desc';
type Side = 'left' | 'right';

interface SplitDiffRow {
  left?: FileDiffLine;
  right?: FileDiffLine;
}

function App(): JSX.Element {
  const [leftPath, setLeftPath] = useState('');
  const [rightPath, setRightPath] = useState('');
  const [activeDrop, setActiveDrop] = useState<PaneSide | null>(null);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [selectedItem, setSelectedItem] = useState<CompareItem | null>(null);
  const [fileDiff, setFileDiff] = useState<FileDiffResponse | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [wrapDiffLine, setWrapDiffLine] = useState(false);
  const [showAllContextLines, setShowAllContextLines] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('relativePath');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canCompare = Boolean(leftPath.trim() && rightPath.trim() && !isSubmitting);

  useEffect(() => {
    const preventWindowDrop = (event: Event) => {
      event.preventDefault();
    };

    window.addEventListener('dragover', preventWindowDrop);
    window.addEventListener('drop', preventWindowDrop);
    return () => {
      window.removeEventListener('dragover', preventWindowDrop);
      window.removeEventListener('drop', preventWindowDrop);
    };
  }, []);

  const extractDirectoryPath = (
    event: DragEvent<HTMLElement>
  ): string | null => {
    const filePaths = Array.from(event.dataTransfer.files)
      .map((file) => (file as ElectronFile).path)
      .filter((value): value is string => Boolean(value));
    if (filePaths.length > 0) {
      return inferDropRootPath(filePaths);
    }

    const uriList = event.dataTransfer.getData('text/uri-list');
    if (uriList) {
      const uriPath = firstPathFromUriList(uriList);
      if (uriPath) {
        return uriPath;
      }
    }

    const plainText = event.dataTransfer.getData('text/plain').trim();
    return plainText || null;
  };

  const updatePath = (side: PaneSide, path: string) => {
    if (side === 'left') {
      setLeftPath(path);
      return;
    }

    setRightPath(path);
  };

  const handleDrop = (side: PaneSide) => async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveDrop(null);
    const rawPath = extractDirectoryPath(event);
    if (!rawPath) {
      return;
    }

    const resolvedPath = await window.diffDirApi.resolveDirectoryPath(rawPath);
    if (!resolvedPath) {
      return;
    }

    updatePath(side, resolvedPath);
  };

  const handleDragOver =
    (side: PaneSide) => (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setActiveDrop(side);
    };

  const handleDragLeave = () => setActiveDrop(null);

  const handlePickDirectory = async (side: PaneSide) => {
    const selectedPath = await window.diffDirApi.selectDirectory();
    if (!selectedPath) {
      return;
    }
    updatePath(side, selectedPath);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCompare) {
      return;
    }
    setIsSubmitting(true);
    try {
      if (!window.diffDirApi?.runCompare) {
        setResult(
          createCompareClientError(
            new Error('Preload bridge is unavailable. Please restart the app.')
          )
        );
        return;
      }
      const response = await window.diffDirApi.runCompare({
        leftPath,
        rightPath
      });
      setResult(response);
      setStatusFilter('all');
      setSearchQuery('');
      setSortKey('relativePath');
      setSortDirection('asc');
      setSelectedItem(null);
      setFileDiff(null);
      setWrapDiffLine(false);
      setShowAllContextLines(false);
    } catch (error: unknown) {
      setResult(createCompareClientError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectItem = async (item: CompareItem) => {
    if (
      item.status !== 'different' ||
      !item.left ||
      !item.right ||
      !result?.ok ||
      !leftPath.trim() ||
      !rightPath.trim()
    ) {
      return;
    }

    setSelectedItem(item);
    setFileDiff(null);
    setIsLoadingDiff(false);
    setShowAllContextLines(false);
    if (item.diffKindHint === 'binary') {
      setFileDiff({
        ok: true,
        data: {
          relativePath: item.relativePath,
          kind: 'binary',
          lines: [],
          maxBytes: result.data.diffPolicy.maxTextDiffBytes
        }
      });
      return;
    }

    if (item.diffKindHint === 'too_large') {
      setFileDiff({
        ok: true,
        data: {
          relativePath: item.relativePath,
          kind: 'too_large',
          lines: [],
          maxBytes: result.data.diffPolicy.maxTextDiffBytes
        }
      });
      return;
    }

    setIsLoadingDiff(true);
    try {
      if (!window.diffDirApi?.getFileDiff) {
        setFileDiff(
          createFileDiffClientError(
            new Error('Preload bridge is unavailable. Please restart the app.')
          )
        );
        return;
      }
      const response = await window.diffDirApi.getFileDiff({
        leftRootPath: leftPath,
        rightRootPath: rightPath,
        relativePath: item.relativePath
      });
      setFileDiff(response);
    } catch (error: unknown) {
      setFileDiff(createFileDiffClientError(error));
    } finally {
      setIsLoadingDiff(false);
    }
  };

  const retryFetchDiff = async () => {
    if (!selectedItem) {
      return;
    }
    await handleSelectItem(selectedItem);
  };

  const visibleItems = useMemo(() => {
    if (!result?.ok) {
      return [];
    }

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filtered = result.data.items.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      if (
        normalizedQuery &&
        !item.relativePath.toLowerCase().includes(normalizedQuery)
      ) {
        return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => compareItems(a, b, sortKey, sortDirection));
  }, [result, searchQuery, sortDirection, sortKey, statusFilter]);

  const diffTextView = useMemo(() => {
    if (!fileDiff?.ok || fileDiff.data.kind !== 'text') {
      return null;
    }
    return compressContextLines(fileDiff.data.lines, showAllContextLines);
  }, [fileDiff, showAllContextLines]);

  const splitDiffRows = useMemo(() => {
    return toSplitDiffRows(diffTextView?.lines ?? []);
  }, [diffTextView]);

  return (
    <main className="app">
      <h1>diff-dir</h1>
      <p>Drop two folders to compare. Merge feature is not included.</p>
      <form className="panel" onSubmit={handleSubmit}>
        <div className="drop-grid">
          <section
            className={`drop-pane ${activeDrop === 'left' ? 'active' : ''}`}
            onDragOver={handleDragOver('left')}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop('left')}
          >
            <h2>Left Folder</h2>
            <p>{leftPath || 'Drag and drop a folder here'}</p>
          </section>
          <section
            className={`drop-pane ${activeDrop === 'right' ? 'active' : ''}`}
            onDragOver={handleDragOver('right')}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop('right')}
          >
            <h2>Right Folder</h2>
            <p>{rightPath || 'Drag and drop a folder here'}</p>
          </section>
        </div>
        <label>
          Left Path (manual)
          <button
            type="button"
            className="ghost-button"
            onClick={() => void handlePickDirectory('left')}
          >
            Select Left Folder
          </button>
          <input
            type="text"
            value={leftPath}
            onChange={(event) => setLeftPath(event.target.value)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop('left')}
            placeholder="/Users/you/left-folder"
          />
        </label>
        <label>
          Right Path (manual)
          <button
            type="button"
            className="ghost-button"
            onClick={() => void handlePickDirectory('right')}
          >
            Select Right Folder
          </button>
          <input
            type="text"
            value={rightPath}
            onChange={(event) => setRightPath(event.target.value)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop('right')}
            placeholder="/Users/you/right-folder"
          />
        </label>
        <button type="submit" disabled={!canCompare}>
          {isSubmitting ? 'Comparing...' : 'Start Compare'}
        </button>
      </form>
      {result?.ok ? (
        <section className="result">
          <h3>Summary</h3>
          <p>
            same: {result.data.summary.same} / different: {result.data.summary.different}{' '}
            / left only: {result.data.summary.leftOnly} / right only:{' '}
            {result.data.summary.rightOnly}
          </p>
          <p className="muted">
            text diff limit: {result.data.diffPolicy.maxTextDiffBytes} bytes
          </p>
          <div className="result-controls">
            <label>
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              >
                <option value="all">all</option>
                <option value="different">different</option>
                <option value="same">same</option>
                <option value="left_only">left_only</option>
                <option value="right_only">right_only</option>
              </select>
            </label>
            <label>
              Search
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="filename or path"
              />
            </label>
            <label>
              Sort
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
              >
                <option value="relativePath">path</option>
                <option value="status">status</option>
                <option value="leftSize">left size</option>
                <option value="rightSize">right size</option>
              </select>
            </label>
            <label>
              Direction
              <select
                value={sortDirection}
                onChange={(event) =>
                  setSortDirection(event.target.value as SortDirection)
                }
              >
                <option value="asc">asc</option>
                <option value="desc">desc</option>
              </select>
            </label>
          </div>
          <p className="muted">
            showing {visibleItems.length} / {result.data.items.length}
          </p>
          <div className="result-table-wrap">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Diff Hint</th>
                  <th>Relative Path</th>
                  <th>Left Size</th>
                  <th>Right Size</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr
                    key={item.relativePath}
                    className={buildRowClassName(item, selectedItem)}
                    onClick={() => void handleSelectItem(item)}
                  >
                    <td>{item.status}</td>
                    <td>{formatDiffHint(item)}</td>
                    <td>{item.relativePath}</td>
                    <td>{item.left?.size ?? '-'}</td>
                    <td>{item.right?.size ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {result && !result.ok ? (
        <section className="result error-panel">
          <h3>Compare Failed</h3>
          <p>{result.error.message}</p>
          <p className="muted">{formatOperationError(result.error)}</p>
        </section>
      ) : null}
      {selectedItem ? (
        <section className="result">
          <h3>File Diff: {selectedItem.relativePath}</h3>
          <p className="muted">
            left: {selectedItem.left?.size ?? '-'} bytes / mtime:{' '}
            {formatDateTime(selectedItem.left?.mtimeMs)}
          </p>
          <p className="muted">
            right: {selectedItem.right?.size ?? '-'} bytes / mtime:{' '}
            {formatDateTime(selectedItem.right?.mtimeMs)}
          </p>
          <div className="diff-toolbar">
            <button
              type="button"
              className="ghost-button"
              onClick={() => setWrapDiffLine((current) => !current)}
            >
              {wrapDiffLine ? 'Disable Wrap' : 'Enable Wrap'}
            </button>
            {diffTextView?.hasCollapsed ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => setShowAllContextLines((current) => !current)}
              >
                {showAllContextLines ? 'Hide Long Context' : 'Show All Context'}
              </button>
            ) : null}
          </div>
          {isLoadingDiff ? <p>Loading diff...</p> : null}
          {!isLoadingDiff && fileDiff?.ok && fileDiff.data.kind === 'text' ? (
            <div className="result-table-wrap">
              <table className={`result-table ${wrapDiffLine ? '' : 'no-wrap'}`}>
                <thead>
                  <tr>
                    <th>Left #</th>
                    <th>Left</th>
                    <th>Right #</th>
                    <th>Right</th>
                  </tr>
                </thead>
                <tbody>
                  {splitDiffRows.map((row, index) => (
                    <tr key={`split-${index}`} className={buildSplitRowClassName(row)}>
                      <td className="line-no">{row.left?.leftLineNumber ?? '-'}</td>
                      <td className={buildSplitCellClass(row.left?.type, 'left')}>
                        <code>{row.left?.text ?? ' '}</code>
                      </td>
                      <td className="line-no">{row.right?.rightLineNumber ?? '-'}</td>
                      <td className={buildSplitCellClass(row.right?.type, 'right')}>
                        <code>{row.right?.text ?? ' '}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {!isLoadingDiff && fileDiff?.ok && fileDiff.data.kind === 'binary' ? (
            <p>Binary file diff is not supported in MVP.</p>
          ) : null}
          {!isLoadingDiff && fileDiff?.ok && fileDiff.data.kind === 'too_large' ? (
            <p>
              File is too large for text diff in MVP (limit: {fileDiff.data.maxBytes}{' '}
              bytes).
            </p>
          ) : null}
          {!isLoadingDiff && fileDiff && !fileDiff.ok ? (
            <div className="diff-error">
              <div>
                <p>{fileDiff.error.message}</p>
                <p className="muted">{formatOperationError(fileDiff.error)}</p>
              </div>
              {fileDiff.error.retryable ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void retryFetchDiff()}
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function formatDiffHint(item: CompareItem): string {
  if (item.status !== 'different') {
    return '-';
  }
  if (!item.diffKindHint) {
    return 'unknown';
  }
  if (item.diffKindHint === 'too_large') {
    return 'too_large';
  }
  if (item.diffKindHint === 'binary') {
    return 'binary';
  }
  return 'text';
}

function buildRowClassName(
  item: CompareItem,
  selectedItem: CompareItem | null
): string {
  const isClickable = item.status === 'different' && item.left && item.right;
  const isSelected = selectedItem?.relativePath === item.relativePath;
  if (isClickable && isSelected) {
    return 'row-clickable row-selected';
  }
  if (isClickable) {
    return 'row-clickable';
  }
  if (isSelected) {
    return 'row-selected';
  }
  return '';
}

function compareItems(
  left: CompareItem,
  right: CompareItem,
  sortKey: SortKey,
  sortDirection: SortDirection
): number {
  const multiplier = sortDirection === 'asc' ? 1 : -1;
  const leftValue = readSortValue(left, sortKey);
  const rightValue = readSortValue(right, sortKey);
  if (leftValue < rightValue) {
    return -1 * multiplier;
  }
  if (leftValue > rightValue) {
    return 1 * multiplier;
  }
  return left.relativePath.localeCompare(right.relativePath) * multiplier;
}

function readSortValue(item: CompareItem, sortKey: SortKey): number | string {
  if (sortKey === 'relativePath') {
    return item.relativePath;
  }
  if (sortKey === 'status') {
    return item.status;
  }
  if (sortKey === 'leftSize') {
    return item.left?.size ?? -1;
  }
  return item.right?.size ?? -1;
}

export default App;

function formatDateTime(value: number | undefined): string {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString();
}

function buildSplitRowClassName(row: SplitDiffRow): string {
  if (row.left?.type === 'removed' && row.right?.type === 'added') {
    return 'diff-row-changed';
  }
  if (row.left?.type === 'removed') {
    return 'diff-row-removed';
  }
  if (row.right?.type === 'added') {
    return 'diff-row-added';
  }
  return 'diff-row-context';
}

function buildSplitCellClass(
  lineType: FileDiffLine['type'] | undefined,
  side: Side
): string {
  if (!lineType) {
    return `split-cell split-cell-empty split-cell-${side}`;
  }
  return `split-cell split-cell-${lineType} split-cell-${side}`;
}

function toSplitDiffRows(lines: FileDiffLine[]): SplitDiffRow[] {
  const rows: SplitDiffRow[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.type === 'context') {
      rows.push({ left: line, right: line });
      index += 1;
      continue;
    }

    if (line.type === 'removed') {
      const removedRun: FileDiffLine[] = [];
      while (index < lines.length && lines[index].type === 'removed') {
        removedRun.push(lines[index]);
        index += 1;
      }

      const addedRun: FileDiffLine[] = [];
      while (index < lines.length && lines[index].type === 'added') {
        addedRun.push(lines[index]);
        index += 1;
      }

      const length = Math.max(removedRun.length, addedRun.length);
      for (let runIndex = 0; runIndex < length; runIndex += 1) {
        rows.push({
          left: removedRun[runIndex],
          right: addedRun[runIndex]
        });
      }
      continue;
    }

    const addedRun: FileDiffLine[] = [];
    while (index < lines.length && lines[index].type === 'added') {
      addedRun.push(lines[index]);
      index += 1;
    }
    for (const addedLine of addedRun) {
      rows.push({ right: addedLine });
    }
  }

  return rows;
}

function compressContextLines(
  lines: FileDiffLine[],
  showAll: boolean
): {
  lines: FileDiffLine[];
  hasCollapsed: boolean;
} {
  if (showAll) {
    return { lines, hasCollapsed: false };
  }

  const maxContextRun = 12;
  const headKeep = 4;
  const tailKeep = 4;
  const collapsed: FileDiffLine[] = [];
  let index = 0;
  let hasCollapsed = false;

  while (index < lines.length) {
    if (lines[index].type !== 'context') {
      collapsed.push(lines[index]);
      index += 1;
      continue;
    }

    let end = index;
    while (end < lines.length && lines[end].type === 'context') {
      end += 1;
    }

    const runLength = end - index;
    if (runLength <= maxContextRun) {
      collapsed.push(...lines.slice(index, end));
    } else {
      hasCollapsed = true;
      collapsed.push(...lines.slice(index, index + headKeep));
      collapsed.push({
        type: 'context',
        text: `... ${runLength - headKeep - tailKeep} context lines hidden ...`
      });
      collapsed.push(...lines.slice(end - tailKeep, end));
    }
    index = end;
  }

  return {
    lines: collapsed,
    hasCollapsed
  };
}

function formatOperationError(error: {
  code: string;
  source: string;
  step: string;
  retryable: boolean;
}): string {
  const retry = error.retryable ? 'retry available' : 'retry unlikely to help';
  return `source: ${error.source} / step: ${error.step} / code: ${error.code} / ${retry}`;
}

function createCompareClientError(error: unknown): CompareResponse {
  const message = error instanceof Error ? error.message : 'Unknown renderer-side error.';
  return {
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: `Renderer failed to request compare: ${message}`,
      source: 'compare',
      step: 'unexpected',
      retryable: true
    }
  };
}

function createFileDiffClientError(error: unknown): FileDiffResponse {
  const message = error instanceof Error ? error.message : 'Unknown renderer-side error.';
  return {
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: `Renderer failed to request file diff: ${message}`,
      source: 'file_diff',
      step: 'unexpected',
      retryable: true
    }
  };
}

function inferDropRootPath(paths: string[]): string {
  if (paths.length === 1) {
    return paths[0];
  }

  const normalizedParts = paths.map((value) =>
    value
      .replace(/\\/g, '/')
      .replace(/\/+$/g, '')
      .split('/')
  );
  const minimumLength = Math.min(...normalizedParts.map((parts) => parts.length));
  const commonParts: string[] = [];

  for (let index = 0; index < minimumLength; index += 1) {
    const candidate = normalizedParts[0][index];
    if (normalizedParts.every((parts) => parts[index] === candidate)) {
      commonParts.push(candidate);
      continue;
    }
    break;
  }

  if (commonParts.length === 0) {
    return paths[0];
  }

  if (commonParts.length === 1 && commonParts[0] === '') {
    return '/';
  }
  return commonParts.join('/');
}

function firstPathFromUriList(value: string): string | null {
  const line = value
    .split('\n')
    .map((item) => item.trim())
    .find((item) => item && !item.startsWith('#'));
  if (!line || !line.startsWith('file://')) {
    return null;
  }

  try {
    const parsed = new URL(line);
    return decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }
}
