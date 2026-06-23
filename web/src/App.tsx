import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import init, { WasmPuzzle } from "queens-puzzle-wasm";
import { Board } from "./components/Board";

const STORAGE_KEY = "queens-puzzle-v1";
const TIMER_KEY = "queens-puzzle-timer";
const EDITOR_KEY = "queens-puzzle-editor-v1";

const CHECKERBOARD_BG: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg,#c0c0c0 25%,transparent 25%,transparent 75%,#c0c0c0 75%)," +
    "linear-gradient(45deg,#c0c0c0 25%,transparent 25%,transparent 75%,#c0c0c0 75%)",
  backgroundSize: "10px 10px",
  backgroundPosition: "0 0,5px 5px",
  backgroundColor: "#e4e4e4",
};

function toBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromBase64Url(b64: string): string {
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
}

type HintState = {
  description: string;
  changes: Map<string, number>;
  involved: Set<string>;
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
  for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
    const nr = qr + dr, nc = qc + dc;
    if (nr >= 0 && nr < n && nc >= 0 && nc < n) add(nr, nc);
  }
  return [...seen].map((s) => s.split(",").map(Number) as [number, number]);
}

export function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function computeCellSize(n: number): number {
  const available = window.innerWidth - 32;
  return Math.min(MAX_CELL_PX, Math.max(MIN_CELL_PX, Math.floor(available / n)));
}

function randomNQueens(n: number): [number, number][] {
  const cols = Array.from({ length: n }, (_, i) => i);
  for (let attempt = 0; attempt < 2000; attempt++) {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cols[i], cols[j]] = [cols[j], cols[i]];
    }
    let ok = true;
    for (let i = 0; i < n && ok; i++)
      for (let j = i + 1; j < n && ok; j++)
        if (Math.abs(cols[i] - cols[j]) === j - i) ok = false;
    if (ok) return cols.map((c, r) => [r, c] as [number, number]);
  }
  return Array.from({ length: n }, (_, i) => [i, (i * 2) % n] as [number, number]);
}

function editorHasWork(regions: (number | null)[][]): boolean {
  return regions.some(row => row.some(c => c !== null));
}

function validateEditorBoard(regions: (number | null)[][], n: number): string | null {
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (regions[r][c] === null) return "Some cells have no region assigned.";
  const counts = new Array(n).fill(0);
  for (const row of regions) for (const cell of row) if (cell !== null) counts[cell]++;
  for (let i = 0; i < n; i++)
    if (counts[i] === 0) return `Region ${i + 1} is missing — each of the ${n} regions must appear at least once.`;
  return null;
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
  // regions is shared between play and edit modes.
  // In play mode: all cells have a region (no nulls), derived from puzzleRef.
  // In edit mode: cells may be null (unassigned). Painted directly by the user.
  const [regions, setRegions] = useState<(number | null)[][]>([]);
  const [playerStates, setPlayerStates] = useState<number[][]>([]);
  const [autoCrossEnabled, setAutoCrossEnabled] = useState(true);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [solved, setSolved] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [cellSize, setCellSize] = useState(() => computeCellSize(7));
  const [past, setPast] = useState<number[][][]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Editor state
  const [mode, setMode] = useState<"play" | "edit">("play");
  const [selectedColor, setSelectedColor] = useState<number | null>(0);
  // Region snapshots for editor undo (separate from play-mode state undo)
  const [editorPast, setEditorPast] = useState<(number | null)[][][]>([]);
  const paintSnapshotRef = useRef<(number | null)[][] | null>(null);
  const [playConfirmPending, setPlayConfirmPending] = useState(false);
  const [scatterConfirmPending, setScatterConfirmPending] = useState(false);
  const [playValidationError, setPlayValidationError] = useState<string | null>(null);
  const [exportToast, setExportToast] = useState(false);

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

        // Try URL hash (share link) first
        let puzzle: WasmPuzzle | null = null;
        let fromShare = false;
        const hash = window.location.hash.slice(1);
        if (hash) {
          try {
            puzzle = WasmPuzzle.from_json(fromBase64Url(hash));
            fromShare = true;
            history.replaceState(null, "", window.location.pathname);
          } catch {
            setUrlError("Share link could not be decoded — loading your last saved puzzle.");
          }
        }
        if (!puzzle) puzzle = loadPuzzle();

        const states = readStates(puzzle);
        const hasProgress = states.some((row) => row.some((s) => s !== 0));
        const isSolved = puzzle.is_solved();
        const savedTimer = fromShare ? 0 : parseInt(localStorage.getItem(TIMER_KEY) ?? "0", 10) || 0;
        if (fromShare) {
          try { localStorage.setItem(STORAGE_KEY, puzzle.to_json()); } catch {}
          try { localStorage.removeItem(TIMER_KEY); } catch {}
        }
        puzzleRef.current = puzzle;
        setRegions(readRegions(puzzle));
        setPlayerStates(states);
        setCellSize(computeCellSize(puzzle.n()));
        setTimerElapsed(savedTimer);
        setTimerRunning(hasProgress && !isSolved);
        setSolved(isSolved);
        setShowBanner(isSolved);

        // Restore edit session if the user was editing when they last left
        try {
          const saved = localStorage.getItem(EDITOR_KEY);
          if (saved) {
            const { n, regions: savedRegs } = JSON.parse(saved);
            if (n >= 4 && n <= 12 && Array.isArray(savedRegs) && savedRegs.length === n) {
              setRegions(savedRegs);
              setCellSize(computeCellSize(n));
              setMode("edit");
            }
          }
        } catch {}

        setReady(true);
      })
      .catch((err) => setError(String(err)));
    return () => { cancelled = true; };
  }, []);

  // Responsive cell size — re-evaluates whenever board size changes
  useEffect(() => {
    if (!ready) return;
    const n = regions.length || 7;
    const update = () => setCellSize(computeCellSize(n));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [ready, regions.length]);

  // Timer tick
  useEffect(() => {
    if (!timerRunning || !timerEnabled || solved) return;
    const id = setInterval(() => {
      setTimerElapsed((prev) => {
        const next = prev + 1;
        try { localStorage.setItem(TIMER_KEY, String(next)); } catch {}
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

  // ── Play mode handlers ────────────────────────────────────────────────

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

      const snapshot = readStates(puzzle);
      try {
        setTimerRunning(true);
        puzzle.set_cell_state(r, c, 2);
        setPlayerStates(readStates(puzzle));
        setPast((p) => [...p, snapshot]);
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

      const snapshot = readStates(puzzle);
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
        setPast((p) => [...p, snapshot]);
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
    setPast([]);
    setResetPending(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
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
    const snapshot = readStates(puzzle);
    setTimerRunning(true);
    for (const [key, state] of hint.changes) {
      const [r, c] = key.split(",").map(Number);
      puzzle.set_cell_state(r, c, state);
    }
    setPlayerStates(readStates(puzzle));
    setPast((p) => [...p, snapshot]);
    const nowSolved = puzzle.is_solved();
    setSolved(nowSolved);
    if (nowSolved) setTimerRunning(false);
    try { localStorage.setItem(STORAGE_KEY, puzzle.to_json()); } catch {}
    setHint(null);
  }, [hint]);

  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    const snapshot = past[past.length - 1];
    const n = puzzle.n();
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) puzzle.set_cell_state(r, c, snapshot[r][c]);
    setPlayerStates(readStates(puzzle));
    setPast((p) => p.slice(0, -1));
    const nowSolved = puzzle.is_solved();
    const wasSolved = solved;
    setSolved(nowSolved);
    if (wasSolved && !nowSolved) setTimerRunning(true);
    if (!wasSolved && nowSolved) setTimerRunning(false);
    setHint(null);
    setNoHintMsg(false);
    try { localStorage.setItem(STORAGE_KEY, puzzle.to_json()); } catch {}
  }, [past, solved]);

  const handleShare = useCallback(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    const encoded = toBase64Url(puzzle.to_json());
    const url = `${window.location.origin}${window.location.pathname}#${encoded}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2000);
  }, []);

  const handleImport = useCallback(() => {
    try {
      const puzzle = WasmPuzzle.from_json(importText.trim());
      const states = readStates(puzzle);
      const hasProgress = states.some((row) => row.some((s) => s !== 0));
      const isSolved = puzzle.is_solved();
      puzzleRef.current = puzzle;
      if (timerIntervalRef.current !== null) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setCellSize(computeCellSize(puzzle.n()));
      setRegions(readRegions(puzzle));
      setPlayerStates(states);
      setPast([]);
      setHint(null);
      setNoHintMsg(false);
      setSolved(isSolved);
      setShowBanner(isSolved);
      setTimerElapsed(0);
      setTimerRunning(hasProgress && !isSolved);
      try { localStorage.setItem(STORAGE_KEY, puzzle.to_json()); } catch {}
      try { localStorage.removeItem(TIMER_KEY); } catch {}
      setImportOpen(false);
      setImportText("");
      setImportError(null);
    } catch (e) {
      setImportError(String(e).replace(/^.*?Error:\s*/, ""));
    }
  }, [importText]);

  // ── Editor handlers ───────────────────────────────────────────────────

  // Enter edit mode with current play puzzle's regions
  const handleEnterEditFromPuzzle = useCallback(() => {
    setEditorPast([]);
    setSelectedColor(0);
    setPlayValidationError(null);
    setSettingsOpen(false);
    setMode("edit");
  }, []);

  // Enter edit mode with a fresh empty n×n grid
  const handleEnterEditFresh = useCallback(() => {
    const n = regions.length; // keep same size as current board
    const newRegs: (number | null)[][] = Array.from({ length: n }, () => new Array(n).fill(null));
    setRegions(newRegs);
    setEditorPast([]);
    setSelectedColor(0);
    setPlayValidationError(null);
    try { localStorage.setItem(EDITOR_KEY, JSON.stringify({ n, regions: newRegs })); } catch {}
    setSettingsOpen(false);
    setMode("edit");
  }, [regions.length]);

  // Change board size inside the editor: resets to empty grid
  const handleEditorSizeChange = useCallback((newN: number) => {
    const newRegs: (number | null)[][] = Array.from({ length: newN }, () => new Array(newN).fill(null));
    setRegions(newRegs);
    setCellSize(computeCellSize(newN));
    setSelectedColor(prev => (prev !== null && prev >= newN) ? 0 : prev);
    setEditorPast([]);
    setPlayValidationError(null);
    try { localStorage.setItem(EDITOR_KEY, JSON.stringify({ n: newN, regions: newRegs })); } catch {}
  }, []);

  // Back: discard editor changes and restore committed play puzzle
  const handleBackToPlay = useCallback(() => {
    const p = puzzleRef.current;
    if (p) {
      setRegions(readRegions(p));
      setCellSize(computeCellSize(p.n()));
      setPlayerStates(readStates(p));
    }
    setEditorPast([]);
    setPlayValidationError(null);
    try { localStorage.removeItem(EDITOR_KEY); } catch {}
    setMode("play");
  }, []);

  const handlePaintStart = useCallback(() => {
    paintSnapshotRef.current = regions.map(row => [...row]);
  }, [regions]);

  const handleCellPaint = useCallback((r: number, c: number) => {
    if (regions[r]?.[c] === selectedColor) return;
    const next = regions.map(row => [...row]);
    next[r][c] = selectedColor;
    setRegions(next);
    try { localStorage.setItem(EDITOR_KEY, JSON.stringify({ n: next.length, regions: next })); } catch {}
  }, [regions, selectedColor]);

  const handlePaintEnd = useCallback(() => {
    const snapshot = paintSnapshotRef.current;
    if (snapshot !== null) {
      setEditorPast(p => [...p, snapshot]);
      paintSnapshotRef.current = null;
    }
  }, []);

  const handleEditorUndo = useCallback(() => {
    if (editorPast.length === 0) return;
    const snapshot = editorPast[editorPast.length - 1];
    setRegions(snapshot);
    setEditorPast(p => p.slice(0, -1));
    try { localStorage.setItem(EDITOR_KEY, JSON.stringify({ n: snapshot.length, regions: snapshot })); } catch {}
  }, [editorPast]);

  const doScatterQueens = useCallback(() => {
    const n = regions.length;
    const queens = randomNQueens(n);
    const newRegs: (number | null)[][] = Array.from({ length: n }, () => new Array(n).fill(null));
    queens.forEach(([r, c], i) => { newRegs[r][c] = i; });
    const snapshot = regions.map(row => [...row]);
    setEditorPast(p => [...p, snapshot]);
    setRegions(newRegs);
    setScatterConfirmPending(false);
    try { localStorage.setItem(EDITOR_KEY, JSON.stringify({ n, regions: newRegs })); } catch {}
  }, [regions]);

  const handleScatterQueens = useCallback(() => {
    if (editorHasWork(regions)) {
      setScatterConfirmPending(true);
    } else {
      doScatterQueens();
    }
  }, [regions, doScatterQueens]);

  const handleShuffleColors = useCallback(() => {
    const n = regions.length;
    const perm = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    const snapshot = regions.map(row => [...row]);
    const newRegs = regions.map(row => row.map(cell => cell !== null ? perm[cell] : null));
    setEditorPast(p => [...p, snapshot]);
    setRegions(newRegs);
    try { localStorage.setItem(EDITOR_KEY, JSON.stringify({ n, regions: newRegs })); } catch {}
  }, [regions]);

  const handleEditorExport = useCallback(() => {
    const json = JSON.stringify({ regions });
    navigator.clipboard.writeText(json).catch(() => {});
    setExportToast(true);
    setTimeout(() => setExportToast(false), 2000);
  }, [regions]);

  const handleSwitchToPlay = useCallback(() => {
    const n = regions.length;
    const err = validateEditorBoard(regions, n);
    if (err) {
      setPlayValidationError(err);
      return;
    }
    setPlayValidationError(null);
    setPlayConfirmPending(true);
  }, [regions]);

  const doSwitchToPlay = useCallback(() => {
    const n = regions.length;
    const wp = WasmPuzzle.new_empty(n);
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const region = regions[r][c];
        if (region !== null) wp.set_cell_region(r, c, region);
      }
    puzzleRef.current = wp;
    setCellSize(computeCellSize(n));
    setRegions(readRegions(wp));
    setPlayerStates(readStates(wp));
    setPast([]);
    setHint(null);
    setNoHintMsg(false);
    setSolved(false);
    setShowBanner(false);
    if (timerIntervalRef.current !== null) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setTimerElapsed(0);
    setTimerRunning(false);
    try { localStorage.setItem(STORAGE_KEY, wp.to_json()); } catch {}
    try { localStorage.removeItem(TIMER_KEY); } catch {}
    try { localStorage.removeItem(EDITOR_KEY); } catch {}
    setEditorPast([]);
    setPlayConfirmPending(false);
    setPlayValidationError(null);
    setMode("play");
  }, [regions]);

  // ── Render ────────────────────────────────────────────────────────────

  if (error)
    return <p style={{ color: "red", padding: "1rem" }}>Error: {error}</p>;
  if (!ready) return <p style={{ padding: "1rem" }}>Loading…</p>;

  const n = regions.length;
  const boardPx = cellSize * n;
  const hintInvolvedSet = hint?.involved;
  const hintChangesSet = hint ? new Set(hint.changes.keys()) : undefined;
  const emptyStates = Array.from({ length: n }, () => new Array(n).fill(0));

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

      {mode === "edit" ? (
        // ── Editor UI ─────────────────────────────────────────────────
        <div style={{ width: Math.max(boardPx, 300), maxWidth: "calc(100vw - 2rem)" }}>

          <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem", marginBottom: "0.75rem" }}>
            <h1 style={{ margin: 0, fontSize: "clamp(1.2rem, 5vw, 1.8rem)" }}>Queens Puzzle</h1>
            <span style={{ background: "#e8f4fd", color: "#2980b9", borderRadius: "4px", padding: "0.15rem 0.5rem", fontSize: "0.8rem", fontWeight: "bold" }}>EDITOR</span>
          </div>

          {/* Top bar: size picker + navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem", flexWrap: "wrap" }}>
            <label style={{ fontSize: "0.9rem" }}>
              Size:&nbsp;
              <select
                value={n}
                onChange={e => handleEditorSizeChange(Number(e.target.value))}
                style={{ fontSize: "0.9rem", padding: "0.2rem 0.4rem", borderRadius: "4px", border: "1px solid #bbb" }}
              >
                {Array.from({ length: 9 }, (_, i) => i + 4).map(sz => (
                  <option key={sz} value={sz}>{sz}×{sz}</option>
                ))}
              </select>
            </label>
            <div style={{ flex: 1 }} />
            <button
              onClick={handleBackToPlay}
              style={{ ...controlBtn, fontSize: "0.85rem" }}
              title="Return to play mode without changing the puzzle"
            >
              ← Back
            </button>
            <button
              onClick={handleSwitchToPlay}
              style={{ ...controlBtn, background: "#2980b9", color: "white", border: "none", fontSize: "0.85rem", fontWeight: "bold" }}
              title="Play this puzzle"
            >
              Play ▶
            </button>
          </div>

          {playValidationError && (
            <div style={{ background: "#fde8e8", border: "1px solid #e74c3c", color: "#c0392b", padding: "0.4rem 0.75rem", borderRadius: "6px", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
              {playValidationError}
            </div>
          )}

          {/* Editor board — uses shared regions, empty cell states */}
          <Board
            regions={regions}
            cellStates={emptyStates}
            clashingSet={new Set()}
            onCellCross={() => {}}
            onCellClick={() => {}}
            cellSize={cellSize}
            editMode={true}
            onCellPaint={handleCellPaint}
            onPaintStart={handlePaintStart}
            onPaintEnd={handlePaintEnd}
          />

          {/* Colour palette */}
          <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "#555", marginRight: "0.15rem" }}>Colour:</span>
            {Array.from({ length: n }, (_, i) => (
              <button
                key={i}
                onClick={() => setSelectedColor(i)}
                title={`Region ${i + 1}`}
                style={{
                  width: 26, height: 26,
                  background: WasmPuzzle.region_color_hex(i),
                  border: selectedColor === i ? "3px solid #111" : "2px solid rgba(0,0,0,0.22)",
                  borderRadius: "4px", cursor: "pointer", padding: 0,
                  boxSizing: "border-box", flexShrink: 0,
                }}
              />
            ))}
            <button
              onClick={() => setSelectedColor(null)}
              title="Erase (unassign cell)"
              style={{
                width: 26, height: 26, ...CHECKERBOARD_BG,
                border: selectedColor === null ? "3px solid #111" : "2px solid rgba(0,0,0,0.22)",
                borderRadius: "4px", cursor: "pointer", padding: 0,
                boxSizing: "border-box", flexShrink: 0,
              }}
            />
          </div>

          {/* Editor toolbar */}
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <button
              onClick={handleScatterQueens}
              style={{ ...controlBtn, fontSize: "0.85rem" }}
              title="Place n non-attacking queens as single-cell starter regions"
            >
              Scatter queens
            </button>
            <button
              onClick={handleShuffleColors}
              disabled={!editorHasWork(regions)}
              style={{ ...controlBtn, fontSize: "0.85rem", opacity: editorHasWork(regions) ? 1 : 0.4 }}
              title="Randomly reassign region colour indices"
            >
              Shuffle colours
            </button>
            <button
              onClick={handleEditorUndo}
              disabled={editorPast.length === 0}
              title="Undo"
              style={{ ...controlBtn, fontSize: "0.85rem", opacity: editorPast.length === 0 ? 0.4 : 1 }}
            >
              ↩ Undo
            </button>
            <button
              onClick={handleEditorExport}
              style={{ ...controlBtn, fontSize: "0.85rem", color: exportToast ? "#27ae60" : "inherit" }}
              title="Copy puzzle JSON to clipboard"
            >
              {exportToast ? "✓ Copied!" : "Export JSON"}
            </button>
          </div>

        </div>
      ) : (
        // ── Play UI ───────────────────────────────────────────────────
        <div style={{ width: boardPx, maxWidth: "100%" }}>
          <h1 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "clamp(1.2rem, 5vw, 1.8rem)" }}>
            Queens Puzzle
          </h1>

          {urlError && (
            <div style={{ background: "#fff3cd", border: "1px solid #ffc107", color: "#856404", padding: "0.4rem 0.75rem", borderRadius: "6px", fontSize: "0.85rem", marginBottom: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{urlError}</span>
              <button onClick={() => setUrlError(null)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "bold", padding: "0 0 0 0.5rem", color: "#856404" }}>×</button>
            </div>
          )}

          <div style={{ minHeight: "2.75rem", marginBottom: "0.75rem" }}>
            <div style={{ background: "#4caf50", color: "white", padding: "0.6rem 1rem", borderRadius: "6px", fontWeight: "bold", fontSize: "1rem", visibility: showBanner ? "visible" : "hidden" }}>
              Congratulations — puzzle solved!
            </div>
          </div>

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
          </div>

          {/* Controls row */}
          <div
            ref={clusterRef}
            style={{ marginTop: "0.5rem", position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <div>
              {!solved && (
                <button
                  onClick={handleHint}
                  disabled={!!hint || noHintMsg}
                  title="Hint"
                  style={{ ...controlBtn, padding: "0.3rem 0.85rem", opacity: hint || noHintMsg ? 0.5 : 1, cursor: hint || noHintMsg ? "default" : "pointer" }}
                >
                  Hint
                </button>
              )}
            </div>

            <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums", fontSize: "1.05rem", pointerEvents: "none", visibility: timerEnabled ? "visible" : "hidden" }}>
              {formatTime(timerElapsed)}
            </span>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button style={{ ...controlBtn, opacity: past.length === 0 ? 0.4 : 1 }} onClick={handleUndo} disabled={past.length === 0} aria-label="Undo" title="Undo">↩</button>
              <button
                style={controlBtn}
                aria-label="Settings"
                title="Settings"
                onClick={() => {
                  if (settingsOpen) {
                    setSettingsOpen(false);
                  } else {
                    const rect = clusterRef.current?.getBoundingClientRect();
                    if (rect) setSettingsAnchor({ bottom: window.innerHeight - rect.top + 8, right: window.innerWidth - rect.right });
                    setSettingsOpen(true);
                  }
                }}
              >⚙</button>
              <button style={controlBtn} onClick={() => setResetPending(true)} aria-label="Reset" title="Reset puzzle">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 4h12" /><path d="M5 4V2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V4" />
                  <path d="M3 4l1 9.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5L13 4" /><path d="M6.5 7v5M9.5 7v5" />
                </svg>
              </button>
            </div>
          </div>

          {/* Hint panel */}
          {!solved && (hint || noHintMsg) && (
            <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {hint && (
                <div style={{ background: "#f0faf2", border: "1px solid #a8dbb4", borderRadius: "8px", padding: "0.65rem 0.9rem" }}>
                  <p style={{ margin: "0 0 0.6rem", fontSize: "0.9rem", color: "#1a5e2a", lineHeight: 1.4 }}>💡 {hint.description}</p>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button onClick={handleApply} style={{ background: "#27ae60", color: "white", border: "none", borderRadius: "4px", padding: "0.3rem 0.8rem", cursor: "pointer", fontWeight: "bold", fontSize: "0.85rem" }}>Apply</button>
                    <button onClick={() => setHint(null)} style={{ ...controlBtn, fontSize: "0.85rem" }}>Dismiss</button>
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
      )}

      {/* ── Settings panel ── */}
      {mode === "play" && settingsOpen && settingsAnchor && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 150 }} onClick={() => setSettingsOpen(false)} />
          <div style={{ position: "fixed", bottom: settingsAnchor.bottom, right: settingsAnchor.right, zIndex: 160, background: "white", border: "1px solid #ddd", borderRadius: "8px", padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.6rem", boxShadow: "0 4px 16px rgba(0,0,0,0.15)", whiteSpace: "nowrap" }}>
            <label style={{ display: "flex", gap: "0.6rem", alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={autoCrossEnabled} onChange={(e) => setAutoCrossEnabled(e.target.checked)} />
              Auto-cross
            </label>
            <label style={{ display: "flex", gap: "0.6rem", alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={timerEnabled} onChange={(e) => setTimerEnabled(e.target.checked)} />
              Timer
            </label>
            <hr style={{ margin: "0.1rem 0", border: "none", borderTop: "1px solid #eee" }} />
            <button onClick={handleShare} style={{ background: "none", border: "none", cursor: "pointer", padding: "0.1rem 0", textAlign: "left", fontSize: "0.9rem", color: shareToast ? "#27ae60" : "inherit" }}>
              {shareToast ? "✓ Copied!" : "Share puzzle"}
            </button>
            <button onClick={() => { setImportOpen(true); setSettingsOpen(false); }} style={{ background: "none", border: "none", cursor: "pointer", padding: "0.1rem 0", textAlign: "left", fontSize: "0.9rem" }}>
              Import puzzle…
            </button>
            <hr style={{ margin: "0.1rem 0", border: "none", borderTop: "1px solid #eee" }} />
            <button onClick={handleEnterEditFromPuzzle} style={{ background: "none", border: "none", cursor: "pointer", padding: "0.1rem 0", textAlign: "left", fontSize: "0.9rem" }}>
              Edit this puzzle
            </button>
            <button onClick={handleEnterEditFresh} style={{ background: "none", border: "none", cursor: "pointer", padding: "0.1rem 0", textAlign: "left", fontSize: "0.9rem" }}>
              New puzzle (Editor)…
            </button>
          </div>
        </>
      )}

      {/* ── Reset modal ── */}
      {resetPending && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={() => setResetPending(false)}>
          <div style={{ background: "white", padding: "1.5rem 2rem", borderRadius: "10px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", maxWidth: 320, width: "calc(100vw - 4rem)" }} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: "0 0 0.5rem", fontWeight: "bold", fontSize: "1.05rem" }}>Reset puzzle?</p>
            <p style={{ margin: "0 0 1.5rem", color: "#555", fontSize: "0.9rem" }}>All progress will be cleared.</p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setResetPending(false)}>Cancel</button>
              <button onClick={doReset} style={{ background: "#c0392b", color: "white", border: "none", borderRadius: "4px", padding: "0.35rem 0.9rem", cursor: "pointer", fontWeight: "bold" }}>Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import modal ── */}
      {importOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={() => { setImportOpen(false); setImportError(null); }}>
          <div style={{ background: "white", padding: "1.5rem 2rem", borderRadius: "10px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", maxWidth: 420, width: "calc(100vw - 4rem)" }} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: "0 0 0.75rem", fontWeight: "bold", fontSize: "1.05rem" }}>Import puzzle</p>
            <textarea
              value={importText}
              onChange={(e) => { setImportText(e.target.value); setImportError(null); }}
              placeholder='{"regions": [[0, 0, ...], ...], "states": [[0, 0, ...], ...]}'
              rows={6}
              style={{ width: "100%", boxSizing: "border-box", fontFamily: "monospace", fontSize: "0.78rem", resize: "vertical", padding: "0.5rem", border: importError ? "1px solid #c0392b" : "1px solid #ccc", borderRadius: "4px" }}
            />
            {importError && <p style={{ margin: "0.35rem 0 0", color: "#c0392b", fontSize: "0.82rem" }}>{importError}</p>}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button onClick={() => { setImportOpen(false); setImportError(null); setImportText(""); }}>Cancel</button>
              <button onClick={handleImport} style={{ background: "#2980b9", color: "white", border: "none", borderRadius: "4px", padding: "0.35rem 0.9rem", cursor: "pointer", fontWeight: "bold" }}>Import</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Play confirm (editor → play) ── */}
      {playConfirmPending && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={() => setPlayConfirmPending(false)}>
          <div style={{ background: "white", padding: "1.5rem 2rem", borderRadius: "10px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", maxWidth: 340, width: "calc(100vw - 4rem)" }} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: "0 0 0.5rem", fontWeight: "bold", fontSize: "1.05rem" }}>Play this puzzle?</p>
            <p style={{ margin: "0 0 1.5rem", color: "#555", fontSize: "0.9rem" }}>This will replace your current puzzle and clear your progress.</p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setPlayConfirmPending(false)}>Cancel</button>
              <button onClick={doSwitchToPlay} style={{ background: "#27ae60", color: "white", border: "none", borderRadius: "4px", padding: "0.35rem 0.9rem", cursor: "pointer", fontWeight: "bold" }}>Play</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Scatter confirm ── */}
      {scatterConfirmPending && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={() => setScatterConfirmPending(false)}>
          <div style={{ background: "white", padding: "1.5rem 2rem", borderRadius: "10px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", maxWidth: 340, width: "calc(100vw - 4rem)" }} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: "0 0 0.5rem", fontWeight: "bold", fontSize: "1.05rem" }}>Clear and scatter queens?</p>
            <p style={{ margin: "0 0 1.5rem", color: "#555", fontSize: "0.9rem" }}>
              The board will be cleared, then {n} non-attacking queens placed as single-cell starter regions.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setScatterConfirmPending(false)}>Cancel</button>
              <button onClick={doScatterQueens} style={{ background: "#2980b9", color: "white", border: "none", borderRadius: "4px", padding: "0.35rem 0.9rem", cursor: "pointer", fontWeight: "bold" }}>Scatter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
