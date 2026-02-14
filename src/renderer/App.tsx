import { useState } from 'react';
import type { DragEvent, FormEvent } from 'react';
import type {
  CompareItem,
  CompareResponse,
  FileDiffResponse
} from '../shared/ipc';

type PaneSide = 'left' | 'right';
type ElectronFile = File & { path?: string };

function App(): JSX.Element {
  const [leftPath, setLeftPath] = useState('');
  const [rightPath, setRightPath] = useState('');
  const [activeDrop, setActiveDrop] = useState<PaneSide | null>(null);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [selectedItem, setSelectedItem] = useState<CompareItem | null>(null);
  const [fileDiff, setFileDiff] = useState<FileDiffResponse | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canCompare = Boolean(leftPath.trim() && rightPath.trim() && !isSubmitting);

  const extractDirectoryPath = (
    event: DragEvent<HTMLDivElement>
  ): string | null => {
    const firstItem = event.dataTransfer.items?.[0] as
      | (DataTransferItem & {
          webkitGetAsEntry?: () => { isDirectory?: boolean } | null;
        })
      | undefined;
    const firstFile = event.dataTransfer.files?.[0] as ElectronFile | undefined;

    if (!firstFile?.path) {
      return null;
    }

    const entry = firstItem?.webkitGetAsEntry?.();
    if (entry && entry.isDirectory === false) {
      return null;
    }

    return firstFile.path;
  };

  const updatePath = (side: PaneSide, path: string) => {
    if (side === 'left') {
      setLeftPath(path);
      return;
    }

    setRightPath(path);
  };

  const handleDrop = (side: PaneSide) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setActiveDrop(null);
    const droppedPath = extractDirectoryPath(event);
    if (!droppedPath) {
      return;
    }
    updatePath(side, droppedPath);
  };

  const handleDragOver =
    (side: PaneSide) => (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setActiveDrop(side);
    };

  const handleDragLeave = () => setActiveDrop(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCompare) {
      return;
    }
    setIsSubmitting(true);
    const response = await window.diffDirApi.runCompare({
      leftPath,
      rightPath
    });
    setResult(response);
    setSelectedItem(null);
    setFileDiff(null);
    setIsSubmitting(false);
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
    setIsLoadingDiff(true);
    const response = await window.diffDirApi.getFileDiff({
      leftRootPath: leftPath,
      rightRootPath: rightPath,
      relativePath: item.relativePath
    });
    setFileDiff(response);
    setIsLoadingDiff(false);
  };

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
          <input
            type="text"
            value={leftPath}
            onChange={(event) => setLeftPath(event.target.value)}
            placeholder="/Users/you/left-folder"
          />
        </label>
        <label>
          Right Path (manual)
          <input
            type="text"
            value={rightPath}
            onChange={(event) => setRightPath(event.target.value)}
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
          <div className="result-table-wrap">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Relative Path</th>
                  <th>Left Size</th>
                  <th>Right Size</th>
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((item) => (
                  <tr
                    key={item.relativePath}
                    className={
                      item.status === 'different' && item.left && item.right
                        ? 'row-clickable'
                        : ''
                    }
                    onClick={() => void handleSelectItem(item)}
                  >
                    <td>{item.status}</td>
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
      {result && !result.ok ? <pre className="result">{result.error.message}</pre> : null}
      {selectedItem ? (
        <section className="result">
          <h3>File Diff: {selectedItem.relativePath}</h3>
          {isLoadingDiff ? <p>Loading diff...</p> : null}
          {!isLoadingDiff && fileDiff?.ok && fileDiff.data.kind === 'text' ? (
            <div className="result-table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Left #</th>
                    <th>Right #</th>
                    <th>Line</th>
                  </tr>
                </thead>
                <tbody>
                  {fileDiff.data.lines.map((line, index) => (
                    <tr key={`${line.type}-${index}`}>
                      <td>{line.type}</td>
                      <td>{line.leftLineNumber ?? '-'}</td>
                      <td>{line.rightLineNumber ?? '-'}</td>
                      <td>
                        <code>{line.text || ' '}</code>
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
          {!isLoadingDiff && fileDiff && !fileDiff.ok ? <p>{fileDiff.error.message}</p> : null}
        </section>
      ) : null}
    </main>
  );
}

export default App;
