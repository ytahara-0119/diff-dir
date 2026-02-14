import { useState } from 'react';
import type { FormEvent } from 'react';
import type { CompareResponse } from '../shared/ipc';

function App(): JSX.Element {
  const [leftPath, setLeftPath] = useState('/path/to/left');
  const [rightPath, setRightPath] = useState('/path/to/right');
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    const response = await window.diffDirApi.runCompare({
      leftPath,
      rightPath
    });
    setResult(response);
    setIsSubmitting(false);
  };

  return (
    <main className="app">
      <h1>diff-dir</h1>
      <p>IPC baseline is ready. Send a dummy compare request to Main process.</p>
      <form className="panel" onSubmit={handleSubmit}>
        <label>
          Left Path
          <input
            type="text"
            value={leftPath}
            onChange={(event) => setLeftPath(event.target.value)}
          />
        </label>
        <label>
          Right Path
          <input
            type="text"
            value={rightPath}
            onChange={(event) => setRightPath(event.target.value)}
          />
        </label>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Sending...' : 'Send Dummy Compare Request'}
        </button>
      </form>
      {result ? (
        <pre className="result">{JSON.stringify(result, null, 2)}</pre>
      ) : null}
    </main>
  );
}

export default App;
