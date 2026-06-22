import { useEffect, useState } from "react";
import init, { WasmPuzzle } from "queens-puzzle-wasm";

/** The README example 7×7 puzzle in canonical JSON format. */
const README_PUZZLE_JSON = JSON.stringify({
  regions: [
    [0, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 0, 0, 0, 2],
    [3, 3, 3, 3, 3, 3, 2],
    [3, 3, 3, 3, 4, 4, 4],
    [3, 5, 3, 3, 4, 4, 4],
    [3, 3, 3, 6, 4, 4, 4],
    [3, 3, 3, 6, 4, 4, 4],
  ],
});

declare global {
  interface Window {
    WasmPuzzle: typeof WasmPuzzle;
    puzzle: WasmPuzzle;
    puzzleJson: string;
  }
}

type Status =
  | { kind: "ready"; puzzle: WasmPuzzle }
  | { kind: "error"; message: string };

export function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [workerStatus, setWorkerStatus] = useState<string>("idle");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await init();
        if (cancelled) return;

        const puzzle = WasmPuzzle.from_json(README_PUZZLE_JSON);

        // Expose on window so from_json and cell_region are callable from the browser console.
        window.WasmPuzzle = WasmPuzzle;
        window.puzzle = puzzle;
        window.puzzleJson = README_PUZZLE_JSON;

        setStatus({ kind: "ready", puzzle });
      } catch (err) {
        if (!cancelled) {
          setStatus({ kind: "error", message: String(err) });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function launchWorker() {
    setWorkerStatus("starting…");
    const worker = new Worker(new URL("./wasmWorker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e) => {
      const { type, payload } = e.data as { type: string; payload?: string };
      if (type === "ready") {
        setWorkerStatus("worker ready — sending generate request");
        worker.postMessage({ type: "generate", payload: { n: 6, seed: 42 } });
      } else if (type === "generated") {
        setWorkerStatus(`worker generated puzzle: ${payload}`);
        worker.terminate();
      }
    };
    worker.onerror = (err) => {
      setWorkerStatus(`worker error: ${err.message}`);
    };
    worker.postMessage({ type: "init" });
  }

  if (!status) {
    return <p>Loading WASM…</p>;
  }

  if (status.kind === "error") {
    return <p style={{ color: "red" }}>WASM error: {status.message}</p>;
  }

  const { puzzle } = status;
  const n = puzzle.n();

  return (
    <div style={{ fontFamily: "monospace", padding: "1rem" }}>
      <h1>Queens Puzzle — WASM scaffold (milestone 1)</h1>

      <section>
        <h2>WASM loaded ✓</h2>
        <p>
          Puzzle size: <strong>{n}×{n}</strong>
        </p>
        <p>
          Open the browser console and run:{" "}
          <code>puzzle.cell_region(0, 0)</code>
        </p>
        <pre style={{ background: "#f4f4f4", padding: "0.5rem" }}>
          {regionGrid(puzzle)}
        </pre>
      </section>

      <section>
        <h2>Web Worker WASM init</h2>
        <p>Status: {workerStatus}</p>
        <button onClick={launchWorker} disabled={workerStatus !== "idle"}>
          Launch worker
        </button>
      </section>
    </div>
  );
}

function regionGrid(puzzle: WasmPuzzle): string {
  const n = puzzle.n();
  const rows: string[] = [];
  for (let r = 0; r < n; r++) {
    const cells: string[] = [];
    for (let c = 0; c < n; c++) {
      const region = puzzle.cell_region(r, c);
      cells.push(region == null ? "?" : String(region));
    }
    rows.push(cells.join(" "));
  }
  return rows.join("\n");
}
