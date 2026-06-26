import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WasmPuzzle } from "queens-puzzle-wasm";
import { Board } from "../components/Board";
import { PlayControls } from "../components/PlayControls";
import { HintBar } from "../components/HintBar";
import { SolvedBanner } from "../components/SolvedBanner";
import { ConfirmModal } from "../components/ConfirmModal";
import { ImportModal } from "../components/ImportModal";
import { GenerateModal } from "../components/GenerateModal";
import type { HintState } from "../types";
import { useSettings } from "../contexts/SettingsContext";
import { initWasm } from "../initWasm";
import {
  toBase64Url,
  fromBase64Url,
  computeCellSize,
  readRegions,
  readStates,
  hintComplete,
} from "../utils";
import styles from "./PlayPage.module.css";

const STORAGE_KEY = "queens-puzzle-v1";
const TIMER_KEY = "queens-puzzle-timer";
export const EDITOR_KEY = "queens-puzzle-editor-v1";

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

function loadPuzzle(): WasmPuzzle {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return WasmPuzzle.from_json(saved);
  } catch {}
  return WasmPuzzle.from_json(DEFAULT_JSON);
}

function WarningBanner({ msg, onDismiss }: { msg: string; onDismiss: () => void }) {
  return (
    <div className={styles.warningBanner}>
      <span>{msg}</span>
      <button className={styles.warningClose} onClick={onDismiss}>×</button>
    </div>
  );
}

export function PlayPage() {
  const navigate = useNavigate();
  const { autoPlaceXs, autoCheck } = useSettings();

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const puzzleRef = useRef<WasmPuzzle | null>(null);

  const [regions, setRegions] = useState<(number | null)[][]>([]);
  const [playerStates, setPlayerStates] = useState<number[][]>([]);
  const [cellSize, setCellSize] = useState(() => computeCellSize(7));

  const [timerElapsed, setTimerElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [solved, setSolved] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [past, setPast] = useState<number[][][]>([]);
  const [hint, setHint] = useState<HintState | null>(null);
  const [noHintMsg, setNoHintMsg] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [playValidityWarning, setPlayValidityWarning] = useState<string | null>(null);
  const [puzzleUnique, setPuzzleUnique] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);

  const validityWorkerRef = useRef<Worker | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const regionColors = useMemo(
    () => ready ? Array.from({ length: 12 }, (_, i) => WasmPuzzle.region_color_hex(i)) : [],
    [ready],
  );

  const clashingSet = useMemo(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle || !autoCheck) return new Set<string>();
    const raw = puzzle.clashing_queens();
    const s = new Set<string>();
    for (let i = 0; i < raw.length; i += 2) s.add(`${raw[i]},${raw[i + 1]}`);
    return s;
  }, [playerStates, autoCheck]);

  const runPlayValidityCheck = useCallback((json: string) => {
    setPuzzleUnique(false);
    setPlayValidityWarning(null);
    if (validityWorkerRef.current) {
      validityWorkerRef.current.terminate();
      validityWorkerRef.current = null;
    }
    const worker = new Worker(new URL("../analysisWorker.ts", import.meta.url), { type: "module" });
    validityWorkerRef.current = worker;
    worker.onmessage = (e: MessageEvent<{ count: number; difficulty: string | null }>) => {
      const { count } = e.data;
      if (count === 0) setPlayValidityWarning("This puzzle has no solution.");
      else if (count > 1) setPlayValidityWarning(`This puzzle has ${count >= 10 ? "10+" : count} solutions — the answer is not unique.`);
      else setPuzzleUnique(true);
      validityWorkerRef.current = null;
      worker.terminate();
    };
    worker.onerror = () => { validityWorkerRef.current = null; worker.terminate(); };
    worker.postMessage({ json });
  }, []);

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
        setReady(true);
        runPlayValidityCheck(puzzle.to_json());
      })
      .catch((err: unknown) => setError(String(err)));
    return () => { cancelled = true; };
  }, [runPlayValidityCheck]);

  useEffect(() => {
    if (!ready) return;
    const n = regions.length || 7;
    const update = () => setCellSize(computeCellSize(n));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [ready, regions.length]);

  useEffect(() => {
    if (!timerRunning || solved) return;
    const id = setInterval(() => {
      setTimerElapsed((prev) => {
        const next = prev + 1;
        try { localStorage.setItem(TIMER_KEY, String(next)); } catch {}
        return next;
      });
    }, 1000);
    timerIntervalRef.current = id;
    return () => { clearInterval(id); timerIntervalRef.current = null; };
  }, [timerRunning, solved]);

  useEffect(() => {
    if (solved) { setShowBanner(true); setHint(null); setNoHintMsg(false); }
  }, [solved]);

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
    const json = puzzle.to_json();
    try { localStorage.setItem(STORAGE_KEY, json); } catch {}
    try { localStorage.removeItem(TIMER_KEY); } catch {}
    runPlayValidityCheck(json);
  }, [runPlayValidityCheck]);

  // ── Play handlers ──────────────────────────────────────────────────────

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
    [solved, hint],
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
        if (next === 1 && autoPlaceXs) {
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
    [solved, autoPlaceXs, hint],
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
      setImportOpen(false);
      setImportError(null);
    } catch (e) {
      setImportError(String(e).replace(/^.*?Error:\s*/, ""));
    }
  }, [enterPlayWith]);

  const handleGenerateLoad = useCallback((json: string) => {
    try {
      enterPlayWith(WasmPuzzle.from_json(json));
      setGenerateOpen(false);
    } catch (e) {
      setError(String(e));
    }
  }, [enterPlayWith]);

  const handleOpenInEditor = useCallback(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    const n = puzzle.n();
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) puzzle.set_cell_state(r, c, 0);
    try { localStorage.setItem(EDITOR_KEY, puzzle.to_json()); } catch {}
    navigate("/editor");
  }, [navigate]);

  // ── Render ────────────────────────────────────────────────────────────

  if (error) return <p style={{ color: "red", padding: "1rem" }}>Error: {error}</p>;
  if (!ready) return <div className={styles.loading}>Loading…</div>;

  const n = regions.length;
  const boardPx = cellSize * n;
  const hintInvolvedSet = hint?.involved;
  const hintChangesSet = hint ? new Set(hint.changes.keys()) : undefined;
  const difficulty = puzzleRef.current?.difficulty() ?? null;

  return (
    <div className={styles.page}>
      {/* Puzzle meta */}
      {(difficulty || puzzleUnique) && (
        <div className={styles.puzzleMeta}>
          {difficulty && (
            <>
              <span className={styles.metaSep}>Difficulty:</span>
              <span className={styles.diffBadge}>{difficulty}</span>
            </>
          )}
          {difficulty && puzzleUnique && <span className={styles.metaSep}>·</span>}
          {puzzleUnique && (
            <span className={styles.uniqueBadge}>Confirmed unique</span>
          )}
        </div>
      )}

      {/* Board */}
      <div style={{ position: "relative" }}>
        <Board
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

      {/* Below-board area */}
      <div className={styles.belowBoard} style={{ width: boardPx, maxWidth: "100%" }}>
        <SolvedBanner solved={showBanner} />

        {urlError && <WarningBanner msg={urlError} onDismiss={() => setUrlError(null)} />}
        {playValidityWarning && (
          <WarningBanner
            msg={`⚠ ${playValidityWarning}`}
            onDismiss={() => setPlayValidityWarning(null)}
          />
        )}

        <PlayControls
          timerElapsed={timerElapsed}
          solved={solved}
          canUndo={past.length > 0}
          hintActive={!!hint}
          noHintMsg={noHintMsg}
          onHint={handleHint}
          onUndo={handleUndo}
          onReset={() => setResetPending(true)}
        />

        <HintBar
          hint={hint}
          noHintMsg={noHintMsg}
          solved={solved}
          onApply={handleApply}
          onDismiss={() => setHint(null)}
        />

        {/* How to play */}
        <details className={styles.howToPlay}>
          <summary>How to play</summary>
          <div className={styles.htpBody}>
            <div className={styles.htpRules}>
              <p className={styles.htpRule}>
                Place exactly one queen in each row, column, and coloured region.
              </p>
              <p className={styles.htpRule}>
                Queens may not touch each other — including diagonally.
              </p>
              <p className={styles.htpRule}>
                Click a cell to cycle: empty → ✕ (eliminated) → ♛ (queen) → empty.
              </p>
            </div>
          </div>
        </details>

        {/* Actions */}
        <div className={styles.actionRow}>
          <button className={styles.btn} onClick={() => navigate("/solve")}>
            Open in Solver
          </button>
          <button className={styles.btn} onClick={handleOpenInEditor}>
            Open in Editor
          </button>
          <button
            className={`${styles.btn}${shareToast ? ` ${styles.btnToast}` : ""}`}
            onClick={handleShare}
          >
            {shareToast ? "✓ Copied!" : "Copy link"}
          </button>
        </div>

        {/* Secondary actions */}
        <div className={styles.actionRow}>
          <button className={styles.btn} onClick={() => { setImportOpen(true); setImportError(null); }}>
            Import puzzle…
          </button>
          <button className={styles.btn} onClick={() => setGenerateOpen(true)}>
            Generate puzzle…
          </button>
        </div>
      </div>

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
    </div>
  );
}
