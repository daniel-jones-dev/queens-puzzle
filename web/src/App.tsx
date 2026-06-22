import { useCallback, useEffect, useRef, useState } from "react";
import init, { WasmPuzzle } from "queens-puzzle-wasm";
import { Board } from "./components/Board";

const STORAGE_KEY = "queens-puzzle-v1";

const DEFAULT_JSON = JSON.stringify({
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

// Singleton so double-invocation from React StrictMode doesn't re-run init().
let wasmInitPromise: ReturnType<typeof init> | null = null;
function initWasm(): ReturnType<typeof init> {
  if (!wasmInitPromise) wasmInitPromise = init();
  return wasmInitPromise!;
}

function loadPuzzle(): WasmPuzzle {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return WasmPuzzle.from_json(saved);
  } catch {}
  return WasmPuzzle.from_json(DEFAULT_JSON);
}

function readRegions(puzzle: WasmPuzzle): (number | null)[][] {
  const n = puzzle.n();
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => puzzle.cell_region(r, c) ?? null)
  );
}

function readStates(puzzle: WasmPuzzle): number[][] {
  const n = puzzle.n();
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => puzzle.cell_state(r, c))
  );
}

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetPending, setResetPending] = useState(false);

  const puzzleRef = useRef<WasmPuzzle | null>(null);
  const [regions, setRegions] = useState<(number | null)[][]>([]);
  const [cellStates, setCellStates] = useState<number[][]>([]);
  const [solved, setSolved] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    let cancelled = false;
    initWasm()
      .then(() => {
        if (cancelled) return;
        const puzzle = loadPuzzle();
        puzzleRef.current = puzzle;
        setRegions(readRegions(puzzle));
        setCellStates(readStates(puzzle));
        setSolved(puzzle.is_solved());
        setReady(true);
      })
      .catch((err) => setError(String(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (solved) setShowBanner(true);
  }, [solved]);

  const handleCellClick = useCallback(
    (r: number, c: number) => {
      if (solved) return;
      const puzzle = puzzleRef.current;
      if (!puzzle) return;
      try {
        setResetPending(false);

        // Unknown(0) → Empty(2) → Queen(1) → Unknown(0)
        const current = puzzle.cell_state(r, c);
        const next = current === 0 ? 2 : current === 2 ? 1 : 0;
        puzzle.set_cell_state(r, c, next);

        setCellStates((prev) => {
          const updated = prev.map((row) => [...row]);
          updated[r][c] = next;
          return updated;
        });

        const nowSolved =
          puzzle.is_solved() && puzzle.clashing_queens().length === 0;
        setSolved(nowSolved);

        try {
          localStorage.setItem(STORAGE_KEY, puzzle.to_json());
        } catch {}
      } catch (err) {
        console.error("cell click error:", err);
        setError(String(err));
      }
    },
    [solved]
  );

  const doReset = useCallback(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    const n = puzzle.n();
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        puzzle.set_cell_state(r, c, 0);
      }
    }
    setCellStates(readStates(puzzle));
    setSolved(false);
    setShowBanner(false);
    setResetPending(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  if (error)
    return <p style={{ color: "red", padding: "1rem" }}>Error: {error}</p>;
  if (!ready) return <p style={{ padding: "1rem" }}>Loading…</p>;

  return (
    <div style={{ padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginTop: 0, marginBottom: "1rem" }}>Queens Puzzle</h1>

      {showBanner && (
        <div
          style={{
            background: "#4caf50",
            color: "white",
            padding: "0.75rem 1.25rem",
            borderRadius: "6px",
            marginBottom: "1rem",
            fontWeight: "bold",
            fontSize: "1.1rem",
          }}
        >
          Congratulations — puzzle solved!
        </div>
      )}

      <Board
        regions={regions}
        cellStates={cellStates}
        onCellClick={handleCellClick}
        locked={solved}
      />

      <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
        {resetPending ? (
          <>
            <span style={{ fontSize: "0.9rem" }}>Clear all progress?</span>
            <button onClick={doReset}>Yes, reset</button>
            <button onClick={() => setResetPending(false)}>Cancel</button>
          </>
        ) : (
          <button onClick={() => setResetPending(true)}>Reset</button>
        )}
      </div>
    </div>
  );
}
