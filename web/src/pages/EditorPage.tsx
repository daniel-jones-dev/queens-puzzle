import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WasmPuzzle } from "queens-puzzle-wasm";
import { Board } from "../components/Board";
import { EditControls } from "../components/EditControls";
import { ConfirmModal } from "../components/ConfirmModal";
import { useAnalysisWorker } from "../hooks/useAnalysisWorker";
import { initWasm } from "../initWasm";
import {
  computeCellSize,
  readRegions,
  readStates,
  editorHasWork,
  validateEditorBoard,
} from "../utils";

const EDITOR_KEY = "queens-puzzle-editor-v1";
const STORAGE_KEY = "queens-puzzle-v1";

function loadEditorPuzzle(): WasmPuzzle {
  try {
    const saved = localStorage.getItem(EDITOR_KEY);
    if (saved) return WasmPuzzle.from_json(saved);
  } catch {}
  return WasmPuzzle.new_empty(7);
}

export function EditorPage() {
  const navigate = useNavigate();

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const puzzleRef = useRef<WasmPuzzle | null>(null);

  const [regions, setRegions] = useState<(number | null)[][]>([]);
  const [playerStates, setPlayerStates] = useState<number[][]>([]);
  const [cellSize, setCellSize] = useState(() => computeCellSize(7));

  const [selectedColor, setSelectedColor] = useState<number | null>(0);
  const [editorPast, setEditorPast] = useState<(number | null)[][][]>([]);
  const paintSnapshotRef = useRef<(number | null)[][] | null>(null);
  const hasChangedSinceScatter = useRef(false);
  const [playConfirmPending, setPlayConfirmPending] = useState(false);
  const [scatterConfirmPending, setScatterConfirmPending] = useState(false);
  const [sizeChangePending, setSizeChangePending] = useState<number | null>(null);
  const [playValidationError, setPlayValidationError] = useState<string | null>(null);
  const [exportToast, setExportToast] = useState(false);

  const analysisResult = useAnalysisWorker("edit", regions, puzzleRef);

  const regionColors = useMemo(
    () => ready ? Array.from({ length: 12 }, (_, i) => WasmPuzzle.region_color_hex(i)) : [],
    [ready],
  );

  useEffect(() => {
    let cancelled = false;
    initWasm()
      .then(() => {
        if (cancelled) return;
        const puzzle = loadEditorPuzzle();
        puzzleRef.current = puzzle;
        setRegions(readRegions(puzzle));
        setPlayerStates(readStates(puzzle));
        setCellSize(computeCellSize(puzzle.n()));
        setReady(true);
      })
      .catch((err: unknown) => setError(String(err)));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const n = regions.length || 7;
    const update = () => setCellSize(computeCellSize(n));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [ready, regions.length]);

  // ── Size change ──────────────────────────────────────────────────────

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

  // ── Paint ────────────────────────────────────────────────────────────

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
      setRegions(readRegions(puzzle));
      try { localStorage.setItem(EDITOR_KEY, puzzle.to_json()); } catch {}
    },
    [selectedColor],
  );

  const handlePaintEnd = useCallback(() => {
    const snapshot = paintSnapshotRef.current;
    if (snapshot !== null) {
      setEditorPast((p) => [...p, snapshot]);
      paintSnapshotRef.current = null;
    }
  }, []);

  // ── Undo ─────────────────────────────────────────────────────────────

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

  // ── Scatter / shuffle ────────────────────────────────────────────────

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
      row.map((cell) => (cell !== null ? perm[cell] : null)),
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

  // ── Export ───────────────────────────────────────────────────────────

  const handleEditorExport = useCallback(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    navigator.clipboard.writeText(puzzle.to_json()).catch(() => {});
    setExportToast(true);
    setTimeout(() => setExportToast(false), 2000);
  }, []);

  // ── Play transition ───────────────────────────────────────────────────

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
    const n = puzzle.n();
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) puzzle.set_cell_state(r, c, 0);
    try { localStorage.setItem(STORAGE_KEY, puzzle.to_json()); } catch {}
    try { localStorage.removeItem(EDITOR_KEY); } catch {}
    setPlayConfirmPending(false);
    navigate("/play");
  }, [navigate]);

  // ── Render ────────────────────────────────────────────────────────────

  if (error) return <p style={{ color: "red", padding: "1rem" }}>Error: {error}</p>;
  if (!ready) return <p style={{ padding: "1rem", color: "var(--text2)" }}>Loading…</p>;

  const n = regions.length;
  const boardPx = cellSize * n;
  const hasWork = editorHasWork(regions);

  return (
    <>
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
        <Board
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
    </>
  );
}
