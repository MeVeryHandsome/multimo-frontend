import { useEffect, useState } from "react";
import { api, type Health } from "./api";

// P0 shell: confirms the frontend can reach the backend. The real interface
// is built in a later phase.
export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Health>("/system/health").then(setHealth, (e: Error) => setError(e.message));
  }, []);

  return (
    <main className="mx-auto max-w-xl px-4 py-16 font-mono text-sm">
      <h1 className="mb-6 text-lg">multimo</h1>
      {error && <p>后端不可达：{error}</p>}
      {!error && !health && <p>连接中…</p>}
      {health && (
        <dl className="grid grid-cols-[8rem_1fr] gap-y-1">
          <dt>status</dt><dd>{health.status}</dd>
          <dt>version</dt><dd>{health.version}</dd>
          <dt>database</dt><dd>{health.database}</dd>
          <dt>vlm</dt><dd>{health.models.vlm}</dd>
          <dt>embedding</dt><dd>{health.models.embedding} ({health.models.embeddingDim})</dd>
          <dt>decision</dt><dd>{health.models.decision}</dd>
          {health.missing.length > 0 && (<><dt>missing</dt><dd>{health.missing.join(", ")}</dd></>)}
        </dl>
      )}
    </main>
  );
}
