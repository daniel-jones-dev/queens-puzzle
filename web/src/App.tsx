import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import init, { WasmPuzzle } from "queens-puzzle-wasm";
import { Board } from "./components/Board";

const STORAGE_KEY = "queens-puzzle-v1";
const TIMER_KEY = "queens-puzzle-timer";

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

function affectedByQueen(
  qr: number,
  qc: number,
  regions: (number | null)[][],
  n: number
): [number, number][] {
  const region = regions[qr][qc];
  const seen = new Set<string>();
  const add = (r: number, c: number) => {
    if (r !== qr || c !== qc) seen.add(`${r},${c}`);
  };
  for (let i = 0; i < n; i++) {
    add(qr, i);
    add(i, qc);
  }
  if (region !== null) {
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        if (regions[r][c] === region) add(r, c);
  }
  for (const [dr, dc] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ] as const) {
    const nr = qr + dr,
      nc = qc + dc;
    if (nr >= 0 && nr < n && nc >= 0 && nc < n) add(nr, nc);
  }
  return [...seen].map((s) => s.split(",").map(Number) as [number, number]);
}


function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetPending, setResetPending] = useState(false);

  const puzzleRef = useRef<WasmPuzzle | null>(null);
  const [regions, setRegions] = useState<(number | null)[][]>([]);
  // playerStates mirrors the WASM puzzle state exactly (auto-crosses are written here too).
  const [playerStates, setPlayerStates] = useState<number[][]>([]);
  const [autoCrossEnabled, setAutoCrossEnabled] = useState(true);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [solved, setSolved] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  const clashingSet = useMemo(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle) return new Set<string>();
    const raw = puzzle.clashing_queens();
    const s = new Set<string>();
    for (let i = 0; i < raw.length; i += 2) s.add(`${raw[i]},${raw[i + 1]}`);
    return s;
  }, [playerStates]);

  useEffect(() => {
    let cancelled = false;
    initWasm()
      .then(() => {
        if (cancelled) return;
        const puzzle = loadPuzzle();
        const states = readStates(puzzle);
        const hasProgress = states.some((row) => row.some((s) => s !== 0));
        const isSolved = puzzle.is_solved();
        const savedTimer =
          parseInt(localStorage.getItem(TIMER_KEY) ?? "0", 10) || 0;
        puzzleRef.current = puzzle;
        setRegions(readRegions(puzzle));
        setPlayerStates(states);
        setTimerElapsed(savedTimer);
        setTimerRunning(hasProgress && !isSolved);
        setSolved(isSolved);
        setShowBanner(isSolved);
        setReady(true);
      })
      .catch((err) => setError(String(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!timerRunning || !timerEnabled) return;
    const id = setInterval(() => {
      setTimerElapsed((prev) => {
        const next = prev + 1;
        try {
          localStorage.setItem(TIMER_KEY, String(next));
        } catch {}
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning, timerEnabled]);

  useEffect(() => {
    if (solved) setShowBanner(true);
  }, [solved]);

  // Drag/tap on an Unknown cell → mark Empty.
  const handleCellCross = useCallback(
    (r: number, c: number) => {
      if (solved) return;
      const puzzle = puzzleRef.current;
      if (!puzzle) return;
      if (puzzle.cell_state(r, c) !== 0) return;
      try {
        setResetPending(false);
        setTimerRunning(true);
        puzzle.set_cell_state(r, c, 2);
        setPlayerStates(readStates(puzzle));
        try {
          localStorage.setItem(STORAGE_KEY, puzzle.to_json());
        } catch {}
      } catch (err) {
        console.error("cell cross error:", err);
        setError(String(err));
      }
    },
    [solved]
  );

  // Click on Empty/Queen cell → cycle (Empty→Queen, Queen→Unknown).
  // visualState is what the Board displayed (playerStates, no overlay).
  const handleCellClick = useCallback(
    (r: number, c: number, visualState: number) => {
      if (solved) return;
      const puzzle = puzzleRef.current;
      if (!puzzle) return;
      try {
        setResetPending(false);
        setTimerRunning(true);
        const n = puzzle.n();
        const next = visualState === 2 ? 1 : 0;
        puzzle.set_cell_state(r, c, next);
        // When placing a queen with auto-cross on, immediately write crosses
        // into board state (they persist regardless of the toggle).
        if (next === 1 && autoCrossEnabled) {
          for (const [ar, ac] of affectedByQueen(r, c, regions, n)) {
            if (puzzle.cell_state(ar, ac) === 0) {
              puzzle.set_cell_state(ar, ac, 2);
            }
          }
        }
        setPlayerStates(readStates(puzzle));
        const nowSolved = puzzle.is_solved();
        setSolved(nowSolved);
        if (nowSolved) setTimerRunning(false);
        try {
          localStorage.setItem(STORAGE_KEY, puzzle.to_json());
        } catch {}
      } catch (err) {
        console.error("cell click error:", err);
        setError(String(err));
      }
    },
    [solved, autoCrossEnabled, regions]
  );

  const handleToggleAutoCross = useCallback((enabled: boolean) => {
    setAutoCrossEnabled(enabled);
  }, []);

  const doReset = useCallback(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    const n = puzzle.n();
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) puzzle.set_cell_state(r, c, 0);
    setPlayerStates(readStates(puzzle));
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
        cellStates={playerStates}
        clashingSet={clashingSet}
        onCellCross={handleCellCross}
        onCellClick={handleCellClick}
        locked={solved}
      />

      <div
        style={{
          marginTop: "0.75rem",
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {timerEnabled && (
          <span
            style={{
              fontVariantNumeric: "tabular-nums",
              fontSize: "1.1rem",
              minWidth: "5ch",
            }}
          >
            {formatTime(timerElapsed)}
          </span>
        )}
        <label
          style={{
            display: "flex",
            gap: "0.4rem",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={autoCrossEnabled}
            onChange={(e) => handleToggleAutoCross(e.target.checked)}
          />
          Auto-cross
        </label>
        <label
          style={{
            display: "flex",
            gap: "0.4rem",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={timerEnabled}
            onChange={(e) => setTimerEnabled(e.target.checked)}
          />
          Timer
        </label>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
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
    </div>
  );
}
