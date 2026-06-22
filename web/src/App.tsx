import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import init, { WasmPuzzle } from "queens-puzzle-wasm";
import { Board } from "./components/Board";

const STORAGE_KEY = "queens-puzzle-v1";
const TIMER_KEY = "queens-puzzle-timer";

type HintState = {
  description: string;
  changes: Map<string, number>;  // "r,c" -> target state
  involved: Set<string>;         // "r,c" of non-dimmed cells
};
const MAX_CELL_PX = 56;
const MIN_CELL_PX = 32;

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

export function affectedByQueen(
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

export function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function computeCellSize(n: number): number {
  const available = window.innerWidth - 32; // 16px padding each side
  return Math.min(MAX_CELL_PX, Math.max(MIN_CELL_PX, Math.floor(available / n)));
}

function hintComplete(puzzle: WasmPuzzle, changes: Map<string, number>): boolean {
  for (const [key, targetState] of changes) {
    const [r, c] = key.split(",").map(Number);
    if (puzzle.cell_state(r, c) !== targetState) return false;
  }
  return true;
}

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetPending, setResetPending] = useState(false);
  const [hint, setHint] = useState<HintState | null>(null);
  const [noHintMsg, setNoHintMsg] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<{ bottom: number; right: number } | null>(null);
  const clusterRef = useRef<HTMLDivElement>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const puzzleRef = useRef<WasmPuzzle | null>(null);
  const [regions, setRegions] = useState<(number | null)[][]>([]);
  const [playerStates, setPlayerStates] = useState<number[][]>([]);
  const [autoCrossEnabled, setAutoCrossEnabled] = useState(true);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [solved, setSolved] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  // Initialise to a close default so board doesn't flash at 56px on mobile
  const [cellSize, setCellSize] = useState(() => computeCellSize(7));

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
        setCellSize(computeCellSize(puzzle.n()));
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

  // Responsive cell size
  useEffect(() => {
    if (!ready) return;
    const n = puzzleRef.current?.n() ?? 7;
    const update = () => setCellSize(computeCellSize(n));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [ready]);

  // Timer tick
  useEffect(() => {
    if (!timerRunning || !timerEnabled || solved) return;
    const id = setInterval(() => {
      setTimerElapsed((prev) => {
        const next = prev + 1;
        try {
          localStorage.setItem(TIMER_KEY, String(next));
        } catch {}
        return next;
      });
    }, 1000);
    timerIntervalRef.current = id;
    return () => {
      clearInterval(id);
      timerIntervalRef.current = null;
    };
  }, [timerRunning, timerEnabled, solved]);

  useEffect(() => {
    if (solved) {
      setShowBanner(true);
      setHint(null);
      setNoHintMsg(false);
    }
  }, [solved]);

  const handleCellCross = useCallback(
    (r: number, c: number) => {
      if (solved) return;
      const puzzle = puzzleRef.current;
      if (!puzzle) return;
      if (puzzle.cell_state(r, c) !== 0) return;

      const key = `${r},${c}`;
      const activeHint = hint;
      const isInvolved = !activeHint || activeHint.involved.has(key) || activeHint.changes.has(key);
      const markQueenHint = activeHint ? [...activeHint.changes.values()].some((s) => s === 1) : false;
      if (activeHint && !isInvolved && !markQueenHint) setHint(null);

      try {
        setTimerRunning(true);
        puzzle.set_cell_state(r, c, 2);
        setPlayerStates(readStates(puzzle));
        try { localStorage.setItem(STORAGE_KEY, puzzle.to_json()); } catch {}
      } catch (err) {
        console.error("cell cross error:", err);
        setError(String(err));
        return;
      }

      if (activeHint && isInvolved && hintComplete(puzzle, activeHint.changes)) {
        setHint(null);
      }
    },
    [solved, hint]
  );

  const handleCellClick = useCallback(
    (r: number, c: number, visualState: number) => {
      if (solved) return;
      const puzzle = puzzleRef.current;
      if (!puzzle) return;

      const key = `${r},${c}`;
      const activeHint = hint;
      const isInvolved = !activeHint || activeHint.involved.has(key) || activeHint.changes.has(key);
      const markQueenHint = activeHint ? [...activeHint.changes.values()].some((s) => s === 1) : false;
      if (activeHint && !isInvolved && !markQueenHint) setHint(null);

      try {
        setTimerRunning(true);
        const n = puzzle.n();
        const next = visualState === 2 ? 1 : 0;
        puzzle.set_cell_state(r, c, next);
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
        try { localStorage.setItem(STORAGE_KEY, puzzle.to_json()); } catch {}
      } catch (err) {
        console.error("cell click error:", err);
        setError(String(err));
        return;
      }

      if (activeHint && isInvolved && hintComplete(puzzle, activeHint.changes)) {
        setHint(null);
      }
    },
    [solved, autoCrossEnabled, regions, hint]
  );

  const doReset = useCallback(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    const n = puzzle.n();
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) puzzle.set_cell_state(r, c, 0);
    setPlayerStates(readStates(puzzle));
    if (solved) {
      // Clear the interval immediately — the setInterval callback can fire
      // between this synchronous code and React's next render, which would
      // write the old value back to localStorage after we remove it.
      if (timerIntervalRef.current !== null) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setTimerElapsed(0);
      setTimerRunning(false);
      try { localStorage.removeItem(TIMER_KEY); } catch {}
    }
    setSolved(false);
    setShowBanner(false);
    setHint(null);
    setNoHintMsg(false);
    setResetPending(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [solved]);

  const handleHint = useCallback(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    const wasmHint = puzzle.next_hint();
    if (!wasmHint) {
      setNoHintMsg(true);
      setTimeout(() => setNoHintMsg(false), 4000);
      return;
    }
    const changes = new Map<string, number>();
    const rawChanges = wasmHint.changes();
    for (let i = 0; i < rawChanges.length; i += 3) {
      changes.set(`${rawChanges[i]},${rawChanges[i + 1]}`, rawChanges[i + 2]);
    }
    const involved = new Set<string>();
    const rawInvolved = wasmHint.involved();
    for (let i = 0; i < rawInvolved.length; i += 2) {
      involved.add(`${rawInvolved[i]},${rawInvolved[i + 1]}`);
    }
    setHint({ description: wasmHint.description(), changes, involved });
    setNoHintMsg(false);
  }, []);

  const handleApply = useCallback(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle || !hint) return;
    setTimerRunning(true);
    for (const [key, state] of hint.changes) {
      const [r, c] = key.split(",").map(Number);
      puzzle.set_cell_state(r, c, state);
    }
    setPlayerStates(readStates(puzzle));
    const nowSolved = puzzle.is_solved();
    setSolved(nowSolved);
    if (nowSolved) setTimerRunning(false);
    try { localStorage.setItem(STORAGE_KEY, puzzle.to_json()); } catch {}
    setHint(null);
  }, [hint]);

  if (error)
    return <p style={{ color: "red", padding: "1rem" }}>Error: {error}</p>;
  if (!ready) return <p style={{ padding: "1rem" }}>Loading…</p>;

  const boardPx = cellSize * regions.length;
  const hintInvolvedSet = hint?.involved;
  const hintChangesSet = hint ? new Set(hint.changes.keys()) : undefined;

  const controlBtn: React.CSSProperties = {
    background: "white",
    border: "1px solid #bbb",
    borderRadius: "6px",
    padding: "0.3rem 0.6rem",
    cursor: "pointer",
    fontSize: "0.9rem",
    display: "flex",
    alignItems: "center",
    gap: "0.3rem",
  };

  return (
    <div style={{ padding: "1rem", fontFamily: "system-ui, sans-serif", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: boardPx, maxWidth: "100%" }}>
        <h1 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "clamp(1.2rem, 5vw, 1.8rem)" }}>
          Queens Puzzle
        </h1>

        {/* Fixed-height banner area — always occupies space to prevent layout shift */}
        <div style={{ minHeight: "2.75rem", marginBottom: "0.75rem" }}>
          <div
            style={{
              background: "#4caf50",
              color: "white",
              padding: "0.6rem 1rem",
              borderRadius: "6px",
              fontWeight: "bold",
              fontSize: "1rem",
              visibility: showBanner ? "visible" : "hidden",
            }}
          >
            Congratulations — puzzle solved!
          </div>
        </div>

        {/* Board + icon cluster anchored at its bottom-right corner */}
        <div style={{ position: "relative" }}>
          <Board
            regions={regions}
            cellStates={playerStates}
            clashingSet={clashingSet}
            onCellCross={handleCellCross}
            onCellClick={handleCellClick}
            locked={solved}
            cellSize={cellSize}
            hintInvolved={hintInvolvedSet}
            hintChanges={hintChangesSet}
          />

          {/* Icon cluster — no z-index so it doesn't form a stacking context */}
          <div
            ref={clusterRef}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              transform: "translateY(calc(100% + 8px))",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "0.5rem",
              pointerEvents: "none",
            }}
          >
            {/* Timer — absolutely centered within the cluster row */}
            <span
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontVariantNumeric: "tabular-nums",
                fontSize: "1.05rem",
                pointerEvents: "none",
                visibility: timerEnabled ? "visible" : "hidden",
              }}
            >
              {formatTime(timerElapsed)}
            </span>
            <button
              style={{ ...controlBtn, pointerEvents: "auto" }}
              aria-label="Settings"
              onClick={() => {
                if (settingsOpen) {
                  setSettingsOpen(false);
                } else {
                  const rect = clusterRef.current?.getBoundingClientRect();
                  if (rect) {
                    setSettingsAnchor({
                      bottom: window.innerHeight - rect.top + 8,
                      right: window.innerWidth - rect.right,
                    });
                  }
                  setSettingsOpen(true);
                }
              }}
            >
              ⚙
            </button>
            <button style={{ ...controlBtn, pointerEvents: "auto" }} onClick={() => setResetPending(true)} aria-label="Reset">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 4h12" />
                <path d="M5 4V2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V4" />
                <path d="M3 4l1 9.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5L13 4" />
                <path d="M6.5 7v5M9.5 7v5" />
              </svg>
            </button>
          </div>
        </div>

        {/* Hint area — Hint button always visible when not solved */}
        {!solved && (
          <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div>
              <button
                onClick={handleHint}
                disabled={!!hint || noHintMsg}
                style={{
                  ...controlBtn,
                  padding: "0.3rem 0.85rem",
                  opacity: hint || noHintMsg ? 0.5 : 1,
                  cursor: hint || noHintMsg ? "default" : "pointer",
                }}
              >
                Hint
              </button>
            </div>

            {hint && (
              <div
                style={{
                  background: "#f0faf2",
                  border: "1px solid #a8dbb4",
                  borderRadius: "8px",
                  padding: "0.65rem 0.9rem",
                }}
              >
                <p style={{ margin: "0 0 0.6rem", fontSize: "0.9rem", color: "#1a5e2a", lineHeight: 1.4 }}>
                  💡 {hint.description}
                </p>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={handleApply}
                    style={{
                      background: "#27ae60",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      padding: "0.3rem 0.8rem",
                      cursor: "pointer",
                      fontWeight: "bold",
                      fontSize: "0.85rem",
                    }}
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => setHint(null)}
                    style={{ ...controlBtn, fontSize: "0.85rem" }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {noHintMsg && (
              <p style={{ margin: 0, fontSize: "0.9rem", color: "#777", fontStyle: "italic" }}>
                No logical step found — try a different approach.
              </p>
            )}
          </div>
        )}

      </div>

      {/* Settings panel — position: fixed anchored to the cluster's measured screen rect */}
      {settingsOpen && settingsAnchor && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 150 }}
            onClick={() => setSettingsOpen(false)}
          />
          <div
            style={{
              position: "fixed",
              bottom: settingsAnchor.bottom,
              right: settingsAnchor.right,
              zIndex: 160,
              background: "white",
              border: "1px solid #ddd",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              whiteSpace: "nowrap",
            }}
          >
            <label style={{ display: "flex", gap: "0.6rem", alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autoCrossEnabled}
                onChange={(e) => setAutoCrossEnabled(e.target.checked)}
              />
              Auto-cross
            </label>
            <label style={{ display: "flex", gap: "0.6rem", alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={timerEnabled}
                onChange={(e) => setTimerEnabled(e.target.checked)}
              />
              Timer
            </label>
          </div>
        </>
      )}

      {/* Reset modal */}
      {resetPending && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
          }}
          onClick={() => setResetPending(false)}
        >
          <div
            style={{
              background: "white",
              padding: "1.5rem 2rem",
              borderRadius: "10px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
              maxWidth: 320,
              width: "calc(100vw - 4rem)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ margin: "0 0 0.5rem", fontWeight: "bold", fontSize: "1.05rem" }}>
              Reset puzzle?
            </p>
            <p style={{ margin: "0 0 1.5rem", color: "#555", fontSize: "0.9rem" }}>
              All progress will be cleared.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setResetPending(false)}>Cancel</button>
              <button
                onClick={doReset}
                style={{
                  background: "#c0392b",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  padding: "0.35rem 0.9rem",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
