import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import init, { WasmPuzzle } from "queens-puzzle-wasm";
import { Grid } from "./components/Grid";
import { PlayControls } from "./components/PlayControls";
import { HintBar } from "./components/HintBar";
import { SolvedBanner } from "./components/SolvedBanner";
import { EditControls } from "./components/EditControls";
import { SettingsPanel } from "./components/SettingsPanel";
import { ConfirmModal } from "./components/ConfirmModal";
import { ImportModal } from "./components/ImportModal";
import { GenerateModal } from "./components/GenerateModal";
import type { HintState } from "./types";
import { useAnalysisWorker } from "./hooks/useAnalysisWorker";
import {
  toBase64Url,
  fromBase64Url,
  computeCellSize,
  readRegions,
  readStates,
  editorHasWork,
  validateEditorBoard,
  hintComplete,
} from "./utils";

const STORAGE_KEY = "queens-puzzle-v1";
const TIMER_KEY = "queens-puzzle-timer";
const EDITOR_KEY = "queens-puzzle-editor-v1";

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

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const puzzleRef = useRef<WasmPuzzle | null>(null);

  // Derived render state — always re-derived from puzzleRef after every mutation
  const [regions, setRegions] = useState<(number | null)[][]>([]);
  const [playerStates, setPlayerStates] = useState<number[][]>([]);
  const [cellSize, setCellSize] = useState(() => computeCellSize(7));

  // Play mode state
  const [autoCrossEnabled, setAutoCrossEnabled] = useState(true);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [solved, setSolved] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [past, setPast] = useState<number[][][]>([]);
  const [hint, setHint] = useState<HintState | null>(null);
  const [noHintMsg, setNoHintMsg] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [resetPending, setResetPending] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<{ bottom: number; right: number } | null>(null);
  const clusterRef = useRef<HTMLDivElement>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Edit mode state
  const [mode, setMode] = useState<"play" | "edit">("play");
  const [selectedColor, setSelectedColor] = useState<number | null>(0);
  const [editorPast, setEditorPast] = useState<(number | null)[][][]>([]);
  const paintSnapshotRef = useRef<(number | null)[][] | null>(null);
  const hasChangedSinceScatter = useRef(false);
  const [playConfirmPending, setPlayConfirmPending] = useState(false);
  const [scatterConfirmPending, setScatterConfirmPending] = useState(false);
  const [sizeChangePending, setSizeChangePending] = useState<number | null>(null);
  const [playValidationError, setPlayValidationError] = useState<string | null>(null);
  const [exportToast, setExportToast] = useState(false);

  const analysisResult = useAnalysisWorker(mode, regions, puzzleRef);

  const clashingSet = useMemo(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle) return new Set<string>();
    const raw = puzzle.clashing_queens();
    const s = new Set<string>();
    for (let i = 0; i < raw.length; i += 2) s.add(`${raw[i]},${raw[i + 1]}`);
    return s;
  }, [playerStates]);

  // ── Init ──────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    initWasm()
      .then(() => {
        if (cancelled) return;

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

        // Restore an in-progress editor session
        try {
          const saved = localStorage.getItem(EDITOR_KEY);
          if (saved) {
            const wp = WasmPuzzle.from_json(saved);
            puzzleRef.current = wp;
            setRegions(readRegions(wp));
            setPlayerStates(readStates(wp));
            setCellSize(computeCellSize(wp.n()));
            setMode("edit");
          }
        } catch {}

        setReady(true);
      })
      .catch((err) => setError(String(err)));
    return () => { cancelled = true; };
  }, []);

  const regionColors = useMemo(
    () => ready ? Array.from({ length: 12 }, (_, i) => WasmPuzzle.region_color_hex(i)) : [],
    [ready],
  );

  useEffect(() => {
    if (!ready) return;
    const n = regions.length || 7;
    const update = () => setCellSize(computeCellSize(n));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [ready, regions.length]);

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
    return () => { clearInterval(id); timerIntervalRef.current = null; };
  }, [timerRunning, timerEnabled, solved]);

  useEffect(() => {
    if (solved) { setShowBanner(true); setHint(null); setNoHintMsg(false); }
  }, [solved]);

  // ── Shared: load a puzzle into play mode ─────────────────────────────

  const enterPlayWith = useCallback((puzzle: WasmPuzzle) => {
    puzzleRef.current = puzzle;
    if (timerIntervalRef.current !== null) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    const states = readStates(puzzle);
    const isSolved = puzzle.is_solved();
    const hasProgress = states.some((row) => row.some((s) => s !== 0));
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
  }, []);

  // ── Play mode handlers ────────────────────────────────────────────────

  const handleCellCross = useCallback(
    (r: number, c: number) => {
      if (solved) return;
      const puzzle = puzzleRef.current;
      if (!puzzle || puzzle.cell_state(r, c) !== 0) return;

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
        setError(String(err));
        return;
      }
      if (activeHint && isInvolved && hintComplete(puzzle, activeHint.changes)) setHint(null);
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
        const next = visualState === 2 ? 1 : 0;
        puzzle.set_cell_state(r, c, next);
        if (next === 1 && autoCrossEnabled) {
          const affected = puzzle.cells_affected_by_queen(r, c);
          for (let i = 0; i < affected.length; i += 2)
            if (puzzle.cell_state(affected[i], affected[i + 1]) === 0)
              puzzle.set_cell_state(affected[i], affected[i + 1], 2);
        }
        setPlayerStates(readStates(puzzle));
        setPast((p) => [...p, snapshot]);
        const nowSolved = puzzle.is_solved();
        setSolved(nowSolved);
        if (nowSolved) setTimerRunning(false);
        try { localStorage.setItem(STORAGE_KEY, puzzle.to_json()); } catch {}
      } catch (err) {
        setError(String(err));
        return;
      }
      if (activeHint && isInvolved && hintComplete(puzzle, activeHint.changes)) setHint(null);
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
    for (let i = 0; i < rawChanges.length; i += 3)
      changes.set(`${rawChanges[i]},${rawChanges[i + 1]}`, rawChanges[i + 2]);
    const involved = new Set<string>();
    const rawInvolved = wasmHint.involved();
    for (let i = 0; i < rawInvolved.length; i += 2)
      involved.add(`${rawInvolved[i]},${rawInvolved[i + 1]}`);
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

  const handleImport = useCallback((json: string) => {
    try {
      enterPlayWith(WasmPuzzle.from_json(json));
      setMode("play");
      setImportOpen(false);
      setImportError(null);
    } catch (e) {
      setImportError(String(e).replace(/^.*?Error:\s*/, ""));
    }
  }, [enterPlayWith]);

  const handleGenerateLoad = useCallback((json: string) => {
    try {
      enterPlayWith(WasmPuzzle.from_json(json));
      setMode("play");
      setGenerateOpen(false);
      setSettingsOpen(false);
    } catch (e) {
      setError(String(e));
    }
  }, [enterPlayWith]);

  const handleOpenSettings = useCallback(() => {
    if (settingsOpen) {
      setSettingsOpen(false);
    } else {
      const rect = clusterRef.current?.getBoundingClientRect();
      if (rect)
        setSettingsAnchor({
          bottom: window.innerHeight - rect.top + 8,
          right: window.innerWidth - rect.right,
        });
      setSettingsOpen(true);
    }
  }, [settingsOpen]);

  // ── Editor handlers ───────────────────────────────────────────────────

  const handleEnterEditFromPuzzle = useCallback(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    const n = puzzle.n();
    // Clear in-progress crosses and queens
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) puzzle.set_cell_state(r, c, 0);
    setPlayerStates(readStates(puzzle));
    setRegions(readRegions(puzzle));
    setHint(null);
    setEditorPast([]);
    setSelectedColor(0);
    setPlayValidationError(null);
    hasChangedSinceScatter.current = false;
    setSettingsOpen(false);
    setMode("edit");
  }, []);

  const handleEnterEditFresh = useCallback(() => {
    const n = puzzleRef.current?.n() ?? 7;
    const wp = WasmPuzzle.new_empty(n);
    puzzleRef.current = wp;
    setRegions(readRegions(wp));
    setPlayerStates(readStates(wp));
    setHint(null);
    setEditorPast([]);
    setSelectedColor(0);
    setPlayValidationError(null);
    hasChangedSinceScatter.current = false;
    try { localStorage.setItem(EDITOR_KEY, wp.to_json()); } catch {}
    setSettingsOpen(false);
    setMode("edit");
  }, []);

  const doEditorSizeChange = useCallback((newN: number) => {
    const wp = WasmPuzzle.new_empty(newN);
    puzzleRef.current = wp;
    setRegions(readRegions(wp));
    setPlayerStates(readStates(wp));
    setCellSize(computeCellSize(newN));
    setSelectedColor((prev) => (prev !== null && prev >= newN ? 0 : prev));
    setEditorPast([]);
    setPlayValidationError(null);
    hasChangedSinceScatter.current = false;
    setSizeChangePending(null);
    try { localStorage.setItem(EDITOR_KEY, wp.to_json()); } catch {}
  }, []);

  const handleEditorSizeChange = useCallback((newN: number) => {
    if (editorHasWork(regions)) {
      setSizeChangePending(newN);
    } else {
      doEditorSizeChange(newN);
    }
  }, [regions, doEditorSizeChange]);

  const handlePaintStart = useCallback(() => {
    const puzzle = puzzleRef.current;
    if (puzzle) paintSnapshotRef.current = readRegions(puzzle);
  }, []);

  const handleCellPaint = useCallback(
    (r: number, c: number) => {
      const puzzle = puzzleRef.current;
      if (!puzzle) return;
      const current = puzzle.cell_region(r, c) ?? null;
      if (current === selectedColor) return;
      puzzle.set_cell_region(r, c, selectedColor ?? undefined);
      hasChangedSinceScatter.current = true;
      const newRegions = readRegions(puzzle);
      setRegions(newRegions);
      try { localStorage.setItem(EDITOR_KEY, puzzle.to_json()); } catch {}
    },
    [selectedColor]
  );

  const handlePaintEnd = useCallback(() => {
    const snapshot = paintSnapshotRef.current;
    if (snapshot !== null) {
      setEditorPast((p) => [...p, snapshot]);
      paintSnapshotRef.current = null;
    }
  }, []);

  const handleEditorUndo = useCallback(() => {
    if (editorPast.length === 0) return;
    const snapshot = editorPast[editorPast.length - 1];
    const n = snapshot.length;
    const wp = WasmPuzzle.new_empty(n);
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const region = snapshot[r][c];
        if (region !== null) wp.set_cell_region(r, c, region);
      }
    puzzleRef.current = wp;
    hasChangedSinceScatter.current = true;
    setRegions(readRegions(wp));
    setEditorPast((p) => p.slice(0, -1));
    try { localStorage.setItem(EDITOR_KEY, wp.to_json()); } catch {}
  }, [editorPast]);

  const doScatterQueens = useCallback(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    const n = puzzle.n();
    const snapshot = readRegions(puzzle);
    const seed = Math.floor(Math.random() * 0xFFFFFFFF);
    const wp = WasmPuzzle.scatter_queens(n, seed);
    puzzleRef.current = wp;
    hasChangedSinceScatter.current = false;
    setEditorPast((p) => [...p, snapshot]);
    setRegions(readRegions(wp));
    setScatterConfirmPending(false);
    try { localStorage.setItem(EDITOR_KEY, wp.to_json()); } catch {}
  }, []);

  const handleScatterQueens = useCallback(() => {
    if (hasChangedSinceScatter.current) {
      setScatterConfirmPending(true);
    } else {
      doScatterQueens();
    }
  }, [doScatterQueens]);

  const handleShuffleColors = useCallback(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    const n = puzzle.n();
    const currRegions = readRegions(puzzle);
    const perm = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    const newRegs = currRegions.map((row) =>
      row.map((cell) => (cell !== null ? perm[cell] : null))
    );
    const wp = WasmPuzzle.new_empty(n);
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const region = newRegs[r][c];
        if (region !== null) wp.set_cell_region(r, c, region);
      }
    puzzleRef.current = wp;
    hasChangedSinceScatter.current = true;
    setEditorPast((p) => [...p, currRegions]);
    setRegions(readRegions(wp));
    try { localStorage.setItem(EDITOR_KEY, wp.to_json()); } catch {}
  }, []);

  const handleEditorExport = useCallback(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    navigator.clipboard.writeText(puzzle.to_json()).catch(() => {});
    setExportToast(true);
    setTimeout(() => setExportToast(false), 2000);
  }, []);

  const handleSwitchToPlay = useCallback(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    const currRegions = readRegions(puzzle);
    const err = validateEditorBoard(currRegions, puzzle.n());
    if (err) { setPlayValidationError(err); return; }
    setPlayValidationError(null);
    setPlayConfirmPending(true);
  }, []);

  const doSwitchToPlay = useCallback(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    enterPlayWith(puzzle);
    try { localStorage.removeItem(EDITOR_KEY); } catch {}
    setEditorPast([]);
    setPlayConfirmPending(false);
    setPlayValidationError(null);
    setMode("play");
  }, [enterPlayWith]);

  // ── Render ────────────────────────────────────────────────────────────

  if (error) return <p style={{ color: "red", padding: "1rem" }}>Error: {error}</p>;
  if (!ready) return <p style={{ padding: "1rem" }}>Loading…</p>;

  const n = regions.length;
  const boardPx = cellSize * n;
  const hintInvolvedSet = hint?.involved;
  const hintChangesSet = hint ? new Set(hint.changes.keys()) : undefined;
  const hasWork = editorHasWork(regions);

  return (
    <div
      style={{
        padding: "1rem",
        fontFamily: "system-ui, sans-serif",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {mode === "edit" ? (
        <EditControls
          n={n}
          boardPx={boardPx}
          regionColors={regionColors}
          selectedColor={selectedColor}
          canUndo={editorPast.length > 0}
          hasWork={hasWork}
          validationError={playValidationError}
          analysisResult={analysisResult}
          exportToast={exportToast}
          onSelectColor={setSelectedColor}
          onSizeChange={handleEditorSizeChange}
          onScatter={handleScatterQueens}
          onShuffle={handleShuffleColors}
          onUndo={handleEditorUndo}
          onExport={handleEditorExport}
          onPlay={handleSwitchToPlay}
        >
          <Grid
            regions={regions}
            regionColors={regionColors}
            cellStates={playerStates}
            clashingSet={new Set()}
            onCellCross={() => {}}
            onCellClick={() => {}}
            cellSize={cellSize}
            editMode={true}
            onCellPaint={handleCellPaint}
            onPaintStart={handlePaintStart}
            onPaintEnd={handlePaintEnd}
          />
        </EditControls>
      ) : (
        <div style={{ width: boardPx, maxWidth: "100%" }}>
          <h1
            style={{
              marginTop: 0,
              marginBottom: "0.75rem",
              fontSize: "clamp(1.2rem, 5vw, 1.8rem)",
            }}
          >
            Queens Puzzle
          </h1>

          {urlError && (
            <div
              style={{
                background: "#fff3cd",
                border: "1px solid #ffc107",
                color: "#856404",
                padding: "0.4rem 0.75rem",
                borderRadius: "6px",
                fontSize: "0.85rem",
                marginBottom: "0.5rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{urlError}</span>
              <button
                onClick={() => setUrlError(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "bold",
                  padding: "0 0 0 0.5rem",
                  color: "#856404",
                }}
              >
                ×
              </button>
            </div>
          )}

          <SolvedBanner solved={showBanner} />

          <div style={{ position: "relative" }}>
            <Grid
              regions={regions}
              regionColors={regionColors}
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

          <PlayControls
            timerElapsed={timerElapsed}
            timerEnabled={timerEnabled}
            solved={solved}
            canUndo={past.length > 0}
            hintActive={!!hint}
            noHintMsg={noHintMsg}
            containerRef={clusterRef}
            onHint={handleHint}
            onUndo={handleUndo}
            onSettings={handleOpenSettings}
            onReset={() => setResetPending(true)}
          />

          <HintBar
            hint={hint}
            noHintMsg={noHintMsg}
            solved={solved}
            onApply={handleApply}
            onDismiss={() => setHint(null)}
          />
        </div>
      )}

      {mode === "play" && settingsOpen && settingsAnchor && (
        <SettingsPanel
          anchor={settingsAnchor}
          autoCross={autoCrossEnabled}
          timerEnabled={timerEnabled}
          shareToast={shareToast}
          onAutoCross={setAutoCrossEnabled}
          onTimerEnabled={setTimerEnabled}
          onShare={handleShare}
          onImport={() => {
            setImportOpen(true);
            setImportError(null);
            setSettingsOpen(false);
          }}
          onGenerate={() => {
            setGenerateOpen(true);
            setSettingsOpen(false);
          }}
          onEditFromPlay={handleEnterEditFromPuzzle}
          onNewPuzzle={handleEnterEditFresh}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {resetPending && (
        <ConfirmModal
          title="Reset puzzle?"
          detail="All progress will be cleared."
          confirmLabel="Reset"
          confirmColor="#c0392b"
          onConfirm={doReset}
          onCancel={() => setResetPending(false)}
        />
      )}

      {importOpen && (
        <ImportModal
          error={importError}
          onImport={handleImport}
          onCancel={() => { setImportOpen(false); setImportError(null); }}
        />
      )}

      {generateOpen && (
        <GenerateModal
          onLoad={handleGenerateLoad}
          onCancel={() => setGenerateOpen(false)}
        />
      )}

      {playConfirmPending && (
        <ConfirmModal
          title="Play this puzzle?"
          detail={
            analysisResult?.status === "no-solution"
              ? "⚠ This puzzle has no solution. Are you sure you want to play it?"
              : analysisResult?.status === "multiple"
              ? `⚠ This puzzle has ${analysisResult.count >= 10 ? "10+" : analysisResult.count} solutions. Are you sure you want to play it?`
              : "This will replace your current puzzle and clear your progress."
          }
          confirmLabel="Play"
          confirmColor="#27ae60"
          onConfirm={doSwitchToPlay}
          onCancel={() => setPlayConfirmPending(false)}
        />
      )}

      {scatterConfirmPending && (
        <ConfirmModal
          title="Clear and scatter queens?"
          detail={`The board will be cleared, then ${n} non-attacking queens placed as single-cell starter regions.`}
          confirmLabel="Scatter"
          confirmColor="#2980b9"
          onConfirm={doScatterQueens}
          onCancel={() => setScatterConfirmPending(false)}
        />
      )}

      {sizeChangePending !== null && (
        <ConfirmModal
          title={`Change to ${sizeChangePending}×${sizeChangePending}?`}
          detail="All painted regions will be cleared."
          confirmLabel="Change size"
          confirmColor="#2980b9"
          onConfirm={() => doEditorSizeChange(sizeChangePending)}
          onCancel={() => setSizeChangePending(null)}
        />
      )}
    </div>
  );
}
