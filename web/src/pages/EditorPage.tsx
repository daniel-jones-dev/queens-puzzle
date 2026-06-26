import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WasmPuzzle } from "queens-puzzle-wasm";
import { Board } from "../components/Board";
import { ConfirmModal } from "../components/ConfirmModal";
import { useAnalysisWorker } from "../hooks/useAnalysisWorker";
import { initWasm } from "../initWasm";
import { computeCellSize, readRegions, readStates, toBase64Url } from "../utils";
import styles from "./EditorPage.module.css";

const EDITOR_KEY = "queens-puzzle-editor-v1";

// ── Types ─────────────────────────────────────────────────────────────────────

type ActiveTool =
  | { kind: "wand" }
  | { kind: "colour"; index: number }
  | { kind: "unset" }
  | { kind: "queen" };

interface EditorSnapshot {
  regions: (number | null)[][];
  queens: number[][];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadEditorPuzzle(): WasmPuzzle {
  try {
    const saved = localStorage.getItem(EDITOR_KEY);
    if (saved) return WasmPuzzle.from_json(saved);
  } catch {}
  return WasmPuzzle.new_empty(7);
}

function checkerBg(): React.CSSProperties {
  return {
    backgroundImage:
      "linear-gradient(45deg,#aaa 25%,transparent 25%)," +
      "linear-gradient(-45deg,#aaa 25%,transparent 25%)," +
      "linear-gradient(45deg,transparent 75%,#aaa 75%)," +
      "linear-gradient(-45deg,transparent 75%,#aaa 75%)",
    backgroundSize: "8px 8px",
    backgroundPosition: "0 0,0 4px,4px -4px,-4px 0",
    backgroundColor: "#d4d4d4",
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AnalysisStats({
  analysisResult,
  regionCount,
  queensCount,
  n,
}: {
  analysisResult: ReturnType<typeof useAnalysisWorker>;
  regionCount: number;
  queensCount: number;
  n: number;
}) {
  const isValid =
    analysisResult !== null && analysisResult.status !== "no-solution";
  const validLabel = analysisResult === null
    ? <span className={styles.computing}><span className={styles.spinner} />Calculating…</span>
    : isValid
    ? <span className={styles.ok}>✓ Yes</span>
    : <span className={styles.err}>✗ No</span>;

  const diffLabel = analysisResult?.status === "unique"
    ? <span className={styles.statVal}>{analysisResult.difficulty ?? "—"}</span>
    : analysisResult === null
    ? <span className={styles.computing}><span className={styles.spinner} />Calculating…</span>
    : <span className={styles.statVal2}>—</span>;

  const solLabel =
    analysisResult === null ? (
      <span className={styles.computing}><span className={styles.spinner} />Calculating…</span>
    ) : analysisResult.status === "no-solution" ? (
      <span className={styles.err}>None</span>
    ) : analysisResult.status === "unique" ? (
      <span className={styles.ok}>1 (unique)</span>
    ) : (
      <span className={styles.warn}>{analysisResult.count >= 10 ? "10+" : analysisResult.count}</span>
    );

  return (
    <>
      <div className={styles.statRow}>
        <span className={styles.statLabel}>Valid layout</span>
        <span className={styles.statVal}>{validLabel}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.statLabel}>Regions complete</span>
        <span className={`${styles.statVal} ${styles.mono}`}>{regionCount} / {n}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.statLabel}>Queens placed</span>
        <span className={`${styles.statVal} ${styles.mono}`}>{queensCount} / {n}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.statLabel}>Difficulty</span>
        <span className={styles.statVal}>{diffLabel}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.statLabel}>Solutions</span>
        <span className={styles.statVal}>{solLabel}</span>
      </div>
      {analysisResult?.status === "multiple" && (
        <div className={styles.multiWarn}>
          <strong>Multiple solutions detected.</strong> Cells at ambiguous row/column intersections are marked with diagonal lines — finish painting those regions.
        </div>
      )}
    </>
  );
}

function WorkflowGuide() {
  return (
    <div className={styles.guideSteps}>
      <p className={styles.guideStep} data-n="1.">
        Select a colour and drag-paint cells with 🪄.
      </p>
      <p className={styles.guideStep} data-n="2.">
        Use <em>Shuffle queens</em> to find valid placements.
      </p>
      <p className={styles.guideStep} data-n="3.">
        Or sketch a shape first, then shuffle queens in.
      </p>
      <p className={styles.guideStep} data-n="4.">
        Aim for exactly 1 solution — analysis updates as you edit.
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function EditorPage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const puzzleRef = useRef<WasmPuzzle | null>(null);

  const [regions, setRegions] = useState<(number | null)[][]>([]);
  const [playerStates, setPlayerStates] = useState<number[][]>([]);
  const [cellSize, setCellSize] = useState(() => computeCellSize(7));

  const [activeTool, setActiveTool] = useState<ActiveTool>({ kind: "wand" });
  const [editorPast, setEditorPast] = useState<EditorSnapshot[]>([]);
  const [editorFuture, setEditorFuture] = useState<EditorSnapshot[]>([]);

  const [puzzleName, setPuzzleName] = useState("");
  const [puzzleAuthor, setPuzzleAuthor] = useState("");

  const [sizeChangePending, setSizeChangePending] = useState<number | null>(null);
  const [clearPending, setClearPending] = useState(false);
  const [exportToast, setExportToast] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // For wand tool: the region being extended (captured from the mousedown cell)
  const wandRegionRef = useRef<number | null>(null);
  // Snapshot captured at paint-start for undo
  const paintSnapshotRef = useRef<EditorSnapshot | null>(null);

  const analysisResult = useAnalysisWorker("edit", regions, puzzleRef);

  const regionColors = useMemo(
    () => ready ? Array.from({ length: 12 }, (_, i) => WasmPuzzle.region_color_hex(i)) : [],
    [ready],
  );

  const n = regions.length || 7;

  const regionCount = useMemo(() => {
    const seen = new Set<number>();
    for (const row of regions) for (const cell of row) if (cell !== null) seen.add(cell);
    return seen.size;
  }, [regions]);

  const queensCount = useMemo(
    () => playerStates.flat().filter((s) => s === 1).length,
    [playerStates],
  );

  const multiSolutionCells = useMemo(() => {
    if (!analysisResult || analysisResult.status !== "multiple") return new Set<string>();
    const { ambiguousRows, ambiguousCols } = analysisResult;
    const s = new Set<string>();
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        if (ambiguousRows[r] && ambiguousCols[c])
          s.add(`${r},${c}`);
    return s;
  }, [analysisResult, n]);

  // ── Init ──────────────────────────────────────────────────────────────────

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
    const update = () => setCellSize(computeCellSize(n));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [ready, n]);

  // ── Snapshot helpers ──────────────────────────────────────────────────────

  function takeSnapshot(): EditorSnapshot {
    const puzzle = puzzleRef.current!;
    return { regions: readRegions(puzzle), queens: readStates(puzzle) };
  }

  function applySnapshot(snap: EditorSnapshot) {
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    const sn = snap.regions.length;
    let wp: WasmPuzzle;
    if (puzzle.n() !== sn) {
      wp = WasmPuzzle.new_empty(sn);
    } else {
      wp = puzzle;
    }
    for (let r = 0; r < sn; r++)
      for (let c = 0; c < sn; c++)
        wp.set_cell_region(r, c, snap.regions[r][c] ?? undefined);
    for (let r = 0; r < sn; r++)
      for (let c = 0; c < sn; c++)
        wp.set_cell_state(r, c, snap.queens[r][c]);
    puzzleRef.current = wp;
    setRegions(readRegions(wp));
    setPlayerStates(readStates(wp));
    setCellSize(computeCellSize(sn));
    try { localStorage.setItem(EDITOR_KEY, wp.to_json()); } catch {}
  }

  function pushUndo(snap: EditorSnapshot) {
    setEditorPast((p) => [...p, snap]);
    setEditorFuture([]);
  }

  // ── Undo / Redo ───────────────────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    if (editorPast.length === 0) return;
    const current = takeSnapshot();
    const prev = editorPast[editorPast.length - 1];
    setEditorPast((p) => p.slice(0, -1));
    setEditorFuture((f) => [...f, current]);
    applySnapshot(prev);
  }, [editorPast]);

  const handleRedo = useCallback(() => {
    if (editorFuture.length === 0) return;
    const current = takeSnapshot();
    const next = editorFuture[editorFuture.length - 1];
    setEditorFuture((f) => f.slice(0, -1));
    setEditorPast((p) => [...p, current]);
    applySnapshot(next);
  }, [editorFuture]);

  // ── Paint handlers (wand / colour / unset) ────────────────────────────────

  const handlePaintStart = useCallback(
    (r: number, c: number) => {
      const puzzle = puzzleRef.current;
      if (!puzzle) return;
      paintSnapshotRef.current = takeSnapshot();

      if (activeTool.kind === "wand") {
        wandRegionRef.current = puzzle.cell_region(r, c) ?? null;
      }
    },
    [activeTool],
  );

  const handleCellPaint = useCallback(
    (r: number, c: number) => {
      const puzzle = puzzleRef.current;
      if (!puzzle) return;

      if (activeTool.kind === "wand") {
        const src = wandRegionRef.current;
        if (src === null) return; // started on unassigned cell — do nothing
        const current = puzzle.cell_region(r, c) ?? null;
        if (current === src) return;
        puzzle.set_cell_region(r, c, src);
        setRegions(readRegions(puzzle));
        try { localStorage.setItem(EDITOR_KEY, puzzle.to_json()); } catch {}
        return;
      }

      if (activeTool.kind === "colour") {
        const current = puzzle.cell_region(r, c) ?? null;
        if (current === activeTool.index) return;
        puzzle.set_cell_region(r, c, activeTool.index);
        setRegions(readRegions(puzzle));
        try { localStorage.setItem(EDITOR_KEY, puzzle.to_json()); } catch {}
        return;
      }

      if (activeTool.kind === "unset") {
        if (puzzle.cell_region(r, c) === undefined) return;
        puzzle.set_cell_region(r, c, undefined);
        setRegions(readRegions(puzzle));
        try { localStorage.setItem(EDITOR_KEY, puzzle.to_json()); } catch {}
        return;
      }

      // queen tool — handled via onPaintStart only (no drag painting)
    },
    [activeTool],
  );

  const handlePaintEnd = useCallback(() => {
    if (paintSnapshotRef.current !== null) {
      pushUndo(paintSnapshotRef.current);
      paintSnapshotRef.current = null;
    }
    wandRegionRef.current = null;
  }, []);

  // Queen tool: toggle queen on paint start; no drag painting
  const handleQueenPaintStart = useCallback(
    (r: number, c: number) => {
      const puzzle = puzzleRef.current;
      if (!puzzle) return;
      const snap = takeSnapshot();
      const current = puzzle.cell_state(r, c);
      puzzle.set_cell_state(r, c, current === 1 ? 0 : 1);
      setPlayerStates(readStates(puzzle));
      pushUndo(snap);
      try { localStorage.setItem(EDITOR_KEY, puzzle.to_json()); } catch {}
    },
    [],
  );

  // ── Size change ───────────────────────────────────────────────────────────

  const doSizeChange = useCallback((newN: number) => {
    const wp = WasmPuzzle.new_empty(newN);
    puzzleRef.current = wp;
    setRegions(readRegions(wp));
    setPlayerStates(readStates(wp));
    setCellSize(computeCellSize(newN));
    setEditorPast([]);
    setEditorFuture([]);
    setSizeChangePending(null);
    try { localStorage.setItem(EDITOR_KEY, wp.to_json()); } catch {}
  }, []);

  const handleSizeChange = useCallback(
    (newN: number) => {
      const hasWork = regions.some((row) => row.some((c) => c !== null));
      if (hasWork) setSizeChangePending(newN);
      else doSizeChange(newN);
    },
    [regions, doSizeChange],
  );

  // ── Shuffle queens ────────────────────────────────────────────────────────

  const handleShuffleQueens = useCallback(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    const rn = puzzle.n();
    const snap = takeSnapshot();
    const seed = Math.floor(Math.random() * 2 ** 32);
    const newPuzzle = WasmPuzzle.scatter_queens(rn, seed);
    // scatter_queens creates single-cell regions but leaves states unknown; place queens
    for (let r = 0; r < rn; r++)
      for (let c = 0; c < rn; c++)
        if (newPuzzle.cell_region(r, c) !== undefined)
          newPuzzle.set_cell_state(r, c, 1);
    puzzleRef.current = newPuzzle;
    setRegions(readRegions(newPuzzle));
    setPlayerStates(readStates(newPuzzle));
    pushUndo(snap);
    try { localStorage.setItem(EDITOR_KEY, newPuzzle.to_json()); } catch {}
  }, []);

  // ── Clear board ───────────────────────────────────────────────────────────

  const doClearBoard = useCallback(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    const snap = takeSnapshot();
    const rn = puzzle.n();
    const wp = WasmPuzzle.new_empty(rn);
    puzzleRef.current = wp;
    setRegions(readRegions(wp));
    setPlayerStates(readStates(wp));
    pushUndo(snap);
    setClearPending(false);
    try { localStorage.setItem(EDITOR_KEY, wp.to_json()); } catch {}
  }, []);

  // ── Export / Share ────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    const base = JSON.parse(puzzle.to_json()) as Record<string, unknown>;
    if (puzzleName) base.name = puzzleName;
    if (puzzleAuthor) base.source = puzzleAuthor;
    navigator.clipboard.writeText(JSON.stringify(base)).catch(() => {});
    setExportToast(true);
    setTimeout(() => setExportToast(false), 2000);
  }, [puzzleName, puzzleAuthor]);

  // ── Open in Play ↗ ────────────────────────────────────────────────────────

  const handleOpenInPlay = useCallback(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    const base = JSON.parse(puzzle.to_json()) as Record<string, unknown>;
    if (puzzleName) base.name = puzzleName;
    if (puzzleAuthor) base.source = puzzleAuthor;
    // Clear player states — the play page starts fresh
    if (base.states) delete base.states;
    const encoded = toBase64Url(JSON.stringify(base));
    const playPath = window.location.pathname.replace(/\/editor$/, "/play");
    window.open(`${window.location.origin}${playPath}#${encoded}`, "_blank");
  }, [puzzleName, puzzleAuthor]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (error) return <p style={{ color: "red", padding: "1rem" }}>Error: {error}</p>;
  if (!ready) return <p style={{ padding: "1rem", color: "var(--text2)" }}>Loading…</p>;

  const isQueenTool = activeTool.kind === "queen";

  // Summary chips for mobile bar
  const validChip = analysisResult === null
    ? { label: "Calculating…", cls: styles.chipNeutral }
    : analysisResult.status === "no-solution"
    ? { label: "✗ Invalid", cls: styles.chipErr }
    : analysisResult.status === "unique"
    ? { label: "✓ Valid · Unique", cls: styles.chipOk }
    : { label: "Multiple solutions", cls: styles.chipWarn };

  const regionsChip = `${regionCount}/${n} regions`;

  return (
    <div className={styles.page}>
      {/* Mobile analysis bar */}
      <div
        className={`${styles.analysisBar}${drawerOpen ? ` ${styles.analysisBarOpen}` : ""}`}
        onClick={() => setDrawerOpen((v) => !v)}
      >
        <div className={styles.analysisSummary}>
          <div className={styles.chips}>
            <span className={`${styles.chip} ${validChip.cls}`}>{validChip.label}</span>
            <span className={`${styles.chip} ${styles.chipNeutral}`}>{regionsChip}</span>
          </div>
          <span className={styles.expandIcon}>▾</span>
        </div>
        {drawerOpen && (
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <AnalysisStats
              analysisResult={analysisResult}
              regionCount={regionCount}
              queensCount={queensCount}
              n={n}
            />
            <div className={styles.drawerFields}>
              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>Puzzle name</label>
                <input
                  className={styles.fieldInput}
                  type="text"
                  placeholder="Untitled"
                  value={puzzleName}
                  onChange={(e) => setPuzzleName(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>Author</label>
                <input
                  className={styles.fieldInput}
                  type="text"
                  placeholder="Anonymous"
                  value={puzzleAuthor}
                  onChange={(e) => setPuzzleAuthor(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop two-column layout */}
      <div className={styles.layout}>
        {/* Left: board + toolbar + actions */}
        <div className={styles.boardCol} style={{ maxWidth: n * cellSize }}>
          {/* Board */}
          <Board
            regions={regions}
            regionColors={regionColors}
            cellStates={playerStates}
            clashingSet={new Set()}
            onCellCross={() => {}}
            onCellClick={() => {}}
            cellSize={cellSize}
            editMode={true}
            onCellPaint={isQueenTool ? () => {} : handleCellPaint}
            onPaintStart={isQueenTool ? handleQueenPaintStart : handlePaintStart}
            onPaintEnd={isQueenTool ? undefined : handlePaintEnd}
            showQueenOverlay={true}
            multiSolutionCells={multiSolutionCells}
          />

          {/* Single-row toolbar */}
          <div className={styles.toolBar}>
            {/* Wand */}
            <button
              className={`${styles.toolBtn}${activeTool.kind === "wand" ? ` ${styles.toolBtnActive}` : ""}`}
              title="Extend colour — drag from an existing cell to spread its region"
              onClick={() => setActiveTool({ kind: "wand" })}
            >
              🪄
            </button>
            <div className={styles.toolDivider} />

            {/* Colour swatches */}
            {regionColors.slice(0, n).map((color, i) => (
              <button
                key={i}
                className={`${styles.swatch}${activeTool.kind === "colour" && activeTool.index === i ? ` ${styles.swatchSelected}` : ""}`}
                style={{ background: color }}
                title={`Colour ${i + 1} (${i + 1})`}
                onClick={() => setActiveTool({ kind: "colour", index: i })}
              >
                <span className={styles.swatchNum}>{i + 1}</span>
              </button>
            ))}
            <div className={styles.toolDivider} />

            {/* Unset region */}
            <button
              className={`${styles.toolBtn}${activeTool.kind === "unset" ? ` ${styles.toolBtnActive}` : ""}`}
              title="Unset region — click any cell to clear its entire region"
              onClick={() => setActiveTool({ kind: "unset" })}
            >
              <span style={checkerBg() as React.CSSProperties} className={styles.checkerIcon} />
            </button>

            {/* Toggle queen */}
            <button
              className={`${styles.toolBtn}${activeTool.kind === "queen" ? ` ${styles.toolBtnActive}` : ""}`}
              title="Toggle queen — click a cell to place or remove a queen"
              onClick={() => setActiveTool({ kind: "queen" })}
            >
              ♛
            </button>
          </div>

          {/* Action row 1 */}
          <div className={styles.actionsRow}>
            <button
              className={styles.btn}
              onClick={handleUndo}
              disabled={editorPast.length === 0}
            >
              ↩ Undo
            </button>
            <button
              className={styles.btn}
              onClick={handleRedo}
              disabled={editorFuture.length === 0}
            >
              ↪ Redo
            </button>
            <div className={styles.dividerV} />
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={handleShuffleQueens}
              title="Place one random queen per region"
            >
              Shuffle queens
            </button>
            <button
              className={styles.btn}
              onClick={() => {
                const hasWork = regions.some((row) => row.some((c) => c !== null));
                if (hasWork) setClearPending(true);
                else doClearBoard();
              }}
            >
              Clear board
            </button>
          </div>

          {/* Action row 2 */}
          <div className={styles.actionsRow}>
            <div style={{ position: "relative", display: "inline-flex" }}>
              <button className={styles.btn}>Size: {n}×{n} ▾</button>
              <select
                value={n}
                onChange={(e) => handleSizeChange(Number(e.target.value))}
                aria-label="Board size"
                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%" }}
              >
                {Array.from({ length: 9 }, (_, i) => i + 4).map((sz) => (
                  <option key={sz} value={sz}>{sz}×{sz}</option>
                ))}
              </select>
            </div>
            <div className={styles.dividerV} />
            <button
              className={`${styles.btn}${exportToast ? ` ${styles.btnToast}` : ""}`}
              onClick={handleExport}
            >
              {exportToast ? "✓ Copied!" : "Share / Export"}
            </button>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={handleOpenInPlay}
            >
              Open in Play ↗
            </button>
          </div>
        </div>

        {/* Right panel (desktop only) */}
        <div className={styles.panel}>
          <div className={styles.panelSection}>
            <div className={styles.sectionTitle}>Puzzle info</div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Name</label>
              <input
                className={styles.fieldInput}
                type="text"
                placeholder="Untitled"
                value={puzzleName}
                onChange={(e) => setPuzzleName(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Author</label>
              <input
                className={styles.fieldInput}
                type="text"
                placeholder="Anonymous"
                value={puzzleAuthor}
                onChange={(e) => setPuzzleAuthor(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.panelSection}>
            <div className={styles.sectionTitle}>Analysis</div>
            <AnalysisStats
              analysisResult={analysisResult}
              regionCount={regionCount}
              queensCount={queensCount}
              n={n}
            />
          </div>

          <div className={styles.panelSection}>
            <div className={styles.sectionTitle}>How to build a puzzle</div>
            <WorkflowGuide />
          </div>
        </div>
      </div>

      {/* Modals */}
      {sizeChangePending !== null && (
        <ConfirmModal
          title={`Change to ${sizeChangePending}×${sizeChangePending}?`}
          detail="All painted regions will be cleared."
          confirmLabel="Change size"
          confirmColor="#2980b9"
          onConfirm={() => doSizeChange(sizeChangePending)}
          onCancel={() => setSizeChangePending(null)}
        />
      )}
      {clearPending && (
        <ConfirmModal
          title="Clear the board?"
          detail="All painted regions and queens will be removed."
          confirmLabel="Clear"
          confirmColor="#c0392b"
          onConfirm={doClearBoard}
          onCancel={() => setClearPending(false)}
        />
      )}
    </div>
  );
}
