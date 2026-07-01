import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { WasmPuzzle } from "queens-puzzle-wasm";
import { Board } from "../components/Board";
import { SolvedBanner } from "../components/SolvedBanner";
import { AboveBoard } from "../components/AboveBoard";
import { initWasm } from "../initWasm";
import type { HintState } from "../types";
import {
  computeCellSize,
  readRegions,
  readStates,
  parsePuzzleMeta,
  hintComplete,
  type PuzzleMeta,
} from "../utils";
import { useSettings } from "../contexts/SettingsContext";
import { STORAGE_KEY } from "./PlayPage";
import styles from "./SolvePage.module.css";

function computeNextHint(puzzle: WasmPuzzle): HintState | null {
  const wasmHint = puzzle.next_hint();
  if (!wasmHint) return null;
  const changes = new Map<string, number>();
  const rawChanges = wasmHint.changes();
  for (let i = 0; i < rawChanges.length; i += 3)
    changes.set(`${rawChanges[i]},${rawChanges[i + 1]}`, rawChanges[i + 2]);
  const involved = new Set<string>();
  const rawInvolved = wasmHint.involved();
  for (let i = 0; i < rawInvolved.length; i += 2)
    involved.add(`${rawInvolved[i]},${rawInvolved[i + 1]}`);
  return { description: wasmHint.description(), changes, involved };
}

// ── Rule definitions ─────────────────────────────────────────────────────────

type RuleCategory = "Basic" | "Easy" | "Medium" | "Hard";

interface RuleDef {
  id: string;
  name: string;
  category: RuleCategory;
  match: (description: string) => boolean;
}

const RULE_DEFS: RuleDef[] = [
  {
    id: "force-queen",
    name: "Only candidate",
    category: "Basic",
    match: (d) => d.includes("must be a queen"),
  },
  {
    id: "eliminate",
    name: "Eliminate by queen",
    category: "Basic",
    match: (d) => d.includes("same row, column, region"),
  },
  {
    id: "region-row",
    name: "Region spans one row",
    category: "Easy",
    match: (d) => d.includes("are in Row"),
  },
  {
    id: "region-col",
    name: "Region spans one column",
    category: "Easy",
    match: (d) => d.includes("are in Column"),
  },
  {
    id: "naked-set",
    name: "Naked set",
    category: "Medium",
    match: (d) => d.includes("One of these cells"),
  },
  {
    id: "confined",
    name: "Confined regions",
    category: "Hard",
    match: (d) => d.includes("confined to"),
  },
];

const CATEGORIES: RuleCategory[] = ["Basic", "Easy", "Medium", "Hard"];

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>→</div>
      <h2 className={styles.emptyTitle}>No puzzle loaded</h2>
      <p className={styles.emptyBody}>
        Open a puzzle from the{" "}
        <Link to="/play" className={styles.emptyLink}>Play</Link>{" "}
        tab, then click "Open in Solver".
      </p>
    </div>
  );
}

// ── SolverRulesPanel ──────────────────────────────────────────────────────────

interface RulesPanelProps {
  hintDescription: string | null;
  solved: boolean;
  onApply?: () => void;
}

function SolverRulesPanel({ hintDescription, solved, onApply }: RulesPanelProps) {
  const activeIndex = useMemo(() => {
    if (!hintDescription) return -1;
    return RULE_DEFS.findIndex((r) => r.match(hintDescription));
  }, [hintDescription]);

  return (
    <div className={styles.rulesPanel}>
      <div className={styles.rulesHeader}>
        <span className={styles.rulesTitle}>Solver rules</span>
        <Link to="/solve/rules" className={styles.rulesAllLink}>All solver rules →</Link>
      </div>

      {CATEGORIES.map((cat) => {
        const rules = RULE_DEFS.filter((r) => r.category === cat);
        return (
          <div key={cat}>
            <div className={styles.ruleCategory}>{cat}</div>
            <div className={styles.ruleCategoryLine} />
            {rules.map((rule) => {
              const idx = RULE_DEFS.indexOf(rule);
              const status = solved
                ? "done"
                : activeIndex === -1
                ? "pending"
                : idx < activeIndex
                ? "done"
                : idx === activeIndex
                ? "active"
                : "pending";

              return (
                <div
                  key={rule.id}
                  className={`${styles.ruleItem} ${
                    status === "done"
                      ? styles.ruleItemDone
                      : status === "active"
                      ? styles.ruleItemActive
                      : styles.ruleItemPending
                  }`}
                >
                  <div className={styles.ruleIcon}>
                    {status === "done" ? "✓" : status === "active" ? "→" : "·"}
                  </div>
                  <div className={styles.ruleBody}>
                    <div className={styles.ruleNameRow}>
                      <span className={styles.ruleName}>{rule.name}</span>
                      <Link to="/solve/rules" className={styles.ruleLink}>
                        explain →
                      </Link>
                    </div>
                    {status === "active" && hintDescription && (
                      <>
                        <p className={styles.ruleDesc}>{hintDescription}</p>
                        {onApply && (
                          <button className={styles.applyBtn} onClick={onApply}>
                            Apply step →
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {!solved && activeIndex === -1 && (
        <p className={styles.noHint}>
          No logical deduction available — try guessing or use Undo.
        </p>
      )}

      <div className={styles.legend}>
        <span>
          <span className={`${styles.legendSwatch} ${styles.legendSwatchConstrained}`} />
          Constrained
        </span>
        <span>
          <span className={`${styles.legendSwatch} ${styles.legendSwatchEliminated}`} />
          Eliminated
        </span>
      </div>
    </div>
  );
}

// ── SolvePage ─────────────────────────────────────────────────────────────────

interface LocationState {
  puzzleJson: string;
  playerStates?: number[][];
  past?: number[][][];
}

export function SolvePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const locState = (location.state as LocationState | null) ?? null;
  const { autoPlaceXs } = useSettings();

  const puzzleRef = useRef<WasmPuzzle | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regions, setRegions] = useState<(number | null)[][]>([]);
  const [playerStates, setPlayerStates] = useState<number[][]>([]);
  const [cellSize, setCellSize] = useState(() => computeCellSize(7));
  const [solved, setSolved] = useState(false);
  const [past, setPast] = useState<number[][][]>([]);
  const [future, setFuture] = useState<number[][][]>([]);
  const [puzzleMeta, setPuzzleMeta] = useState<PuzzleMeta>({});
  const [initialized, setInitialized] = useState(false);
  const [frozenHint, setFrozenHint] = useState<HintState | null>(null);
  const frozenHintRef = useRef<HintState | null>(null);
  const [puzzleUnique, setPuzzleUnique] = useState(false);
  const validityWorkerRef = useRef<Worker | null>(null);

  // Keep ref in sync so handlers can read current hint without stale closure
  useEffect(() => { frozenHintRef.current = frozenHint; }, [frozenHint]);

  const regionColors = useMemo(
    () => (ready ? Array.from({ length: 12 }, (_, i) => WasmPuzzle.region_color_hex(i)) : []),
    [ready],
  );

  // ── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    initWasm()
      .then(() => {
        if (cancelled) return;
        // Prefer puzzle from navigation state; fall back to localStorage
        let puzzle: WasmPuzzle | null = null;
        let rawJson: string | null = null;
        if (locState?.puzzleJson) {
          rawJson = locState.puzzleJson;
          puzzle = WasmPuzzle.from_json(rawJson);
          if (locState.playerStates) {
            const n = puzzle.n();
            for (let r = 0; r < n; r++)
              for (let c = 0; c < n; c++)
                puzzle.set_cell_state(r, c, locState.playerStates![r]?.[c] ?? 0);
          }
        } else {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            try {
              puzzle = WasmPuzzle.from_json(saved);
              rawJson = saved;
            } catch { /* ignore malformed save */ }
          }
        }
        setInitialized(true);
        if (!puzzle || !rawJson) return; // nothing to load — show empty state
        const isSolved = puzzle.is_solved();
        puzzleRef.current = puzzle;
        setRegions(readRegions(puzzle));
        setPlayerStates(readStates(puzzle));
        setCellSize(computeCellSize(puzzle.n()));
        setSolved(isSolved);
        setPast(locState?.past ?? []);
        setPuzzleMeta(parsePuzzleMeta(rawJson));
        const initialHint = isSolved ? null : computeNextHint(puzzle);
        frozenHintRef.current = initialHint;
        setFrozenHint(initialHint);
        setReady(true);
        setPuzzleUnique(false);
        const vWorker = new Worker(new URL("../analysisWorker.ts", import.meta.url), { type: "module" });
        validityWorkerRef.current = vWorker;
        const capturedJson = rawJson;
        vWorker.onmessage = (e: MessageEvent<{ count: number }>) => {
          if (e.data.count === 1) setPuzzleUnique(true);
          validityWorkerRef.current = null;
          vWorker.terminate();
        };
        vWorker.onerror = () => { validityWorkerRef.current = null; vWorker.terminate(); };
        vWorker.postMessage({ json: capturedJson });
      })
      .catch((err: unknown) => { setInitialized(true); setError(String(err)); });
    return () => {
      cancelled = true;
      validityWorkerRef.current?.terminate();
      validityWorkerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready) return;
    const n = regions.length || 7;
    const update = () => setCellSize(computeCellSize(n));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [ready, regions.length]);

  // ── Board interaction ─────────────────────────────────────────────────────

  const advanceHintIfComplete = useCallback((puzzle: WasmPuzzle, nowSolved: boolean) => {
    if (nowSolved) {
      setFrozenHint(null);
      return;
    }
    const fh = frozenHintRef.current;
    if (fh && hintComplete(puzzle, fh.changes)) {
      const next = computeNextHint(puzzle);
      frozenHintRef.current = next;
      setFrozenHint(next);
    }
  }, []);

  const handleCellCross = useCallback(
    (r: number, c: number) => {
      if (solved) return;
      const puzzle = puzzleRef.current;
      if (!puzzle || puzzle.cell_state(r, c) !== 0) return;
      const snapshot = readStates(puzzle);
      puzzle.set_cell_state(r, c, 2);
      setPlayerStates(readStates(puzzle));
      setPast((p) => [...p, snapshot]);
      setFuture([]);
      advanceHintIfComplete(puzzle, false);
    },
    [solved, advanceHintIfComplete],
  );

  const handleCellClick = useCallback(
    (r: number, c: number, visualState: number) => {
      if (solved) return;
      const puzzle = puzzleRef.current;
      if (!puzzle) return;
      const snapshot = readStates(puzzle);
      const next = visualState === 2 ? 1 : 0;
      puzzle.set_cell_state(r, c, next);
      if (autoPlaceXs) {
        if (next === 1) {
          const affected = puzzle.cells_affected_by_queen(r, c);
          for (let i = 0; i < affected.length; i += 2)
            if (puzzle.cell_state(affected[i], affected[i + 1]) === 0)
              puzzle.set_cell_state(affected[i], affected[i + 1], 2);
        } else if (next === 0 && visualState === 1) {
          const affected = puzzle.cells_affected_by_queen(r, c);
          for (let i = 0; i < affected.length; i += 2) {
            const ar = affected[i], ac = affected[i + 1];
            if (puzzle.cell_state(ar, ac) !== 2) continue;
            const zone = puzzle.cells_affected_by_queen(ar, ac);
            let justified = false;
            for (let j = 0; j < zone.length; j += 2) {
              if (puzzle.cell_state(zone[j], zone[j + 1]) === 1) { justified = true; break; }
            }
            if (!justified) puzzle.set_cell_state(ar, ac, 0);
          }
        }
      }
      setPlayerStates(readStates(puzzle));
      setPast((p) => [...p, snapshot]);
      setFuture([]);
      const nowSolved = puzzle.is_solved();
      setSolved(nowSolved);
      advanceHintIfComplete(puzzle, nowSolved);
    },
    [solved, autoPlaceXs, advanceHintIfComplete],
  );

  const handleApply = useCallback(() => {
    const puzzle = puzzleRef.current;
    const fh = frozenHintRef.current;
    if (!puzzle || !fh) return;
    const snapshot = readStates(puzzle);
    for (const [key, state] of fh.changes) {
      const [r, c] = key.split(",").map(Number);
      puzzle.set_cell_state(r, c, state);
      if (state === 1 && autoPlaceXs) {
        const affected = puzzle.cells_affected_by_queen(r, c);
        for (let i = 0; i < affected.length; i += 2)
          if (puzzle.cell_state(affected[i], affected[i + 1]) === 0)
            puzzle.set_cell_state(affected[i], affected[i + 1], 2);
      }
    }
    setPlayerStates(readStates(puzzle));
    setPast((p) => [...p, snapshot]);
    setFuture([]);
    const nowSolved = puzzle.is_solved();
    setSolved(nowSolved);
    const next = nowSolved ? null : computeNextHint(puzzle);
    frozenHintRef.current = next;
    setFrozenHint(next);
  }, [autoPlaceXs]);

  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    const snapshot = past[past.length - 1];
    const n = puzzle.n();
    const current = readStates(puzzle);
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) puzzle.set_cell_state(r, c, snapshot[r][c]);
    setPlayerStates(readStates(puzzle));
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [current, ...f]);
    const nowSolved = puzzle.is_solved();
    setSolved(nowSolved);
    const next = nowSolved ? null : computeNextHint(puzzle);
    frozenHintRef.current = next;
    setFrozenHint(next);
  }, [past]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    const snapshot = future[0];
    const n = puzzle.n();
    const current = readStates(puzzle);
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) puzzle.set_cell_state(r, c, snapshot[r][c]);
    setPlayerStates(readStates(puzzle));
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, current]);
    const nowSolved = puzzle.is_solved();
    setSolved(nowSolved);
    const next = nowSolved ? null : computeNextHint(puzzle);
    frozenHintRef.current = next;
    setFrozenHint(next);
  }, [future]);

  const handleReset = useCallback(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    const n = puzzle.n();
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) puzzle.set_cell_state(r, c, 0);
    setPlayerStates(readStates(puzzle));
    setPast([]);
    setFuture([]);
    setSolved(false);
    const next = computeNextHint(puzzle);
    frozenHintRef.current = next;
    setFrozenHint(next);
  }, []);

  const handleContinueInPlay = useCallback(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    try { localStorage.setItem(STORAGE_KEY, puzzle.to_json()); } catch {}
    navigate("/play");
  }, [navigate]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (error) return <p style={{ color: "red", padding: "1rem" }}>Error: {error}</p>;
  if (!initialized) return <div className={styles.loading}>Loading…</div>;
  if (!ready) return <EmptyState />;

  const difficulty = puzzleRef.current?.difficulty() ?? null;
  const hintInvolvedSet = frozenHint?.involved;
  const hintChangesSet = frozenHint ? new Set(frozenHint.changes.keys()) : undefined;
  const boardPx = cellSize * regions.length;
  const colWidth = Math.max(boardPx, 280);

  return (
    <div className={styles.page}>
      <div className={styles.layout}>

        {/* ── Board column ── */}
        <div className={styles.boardCol}>
          <AboveBoard
            width={colWidth}
            meta={puzzleMeta}
            difficulty={difficulty}
            puzzleUnique={puzzleUnique}
            onReset={handleReset}
          />

          {/* Board */}
          <div style={{ position: "relative" }}>
            <Board
              regions={regions}
              regionColors={regionColors}
              cellStates={playerStates}
              clashingSet={new Set()}
              onCellCross={handleCellCross}
              onCellClick={handleCellClick}
              locked={solved}
              cellSize={cellSize}
              hintInvolved={hintInvolvedSet}
              hintChanges={hintChangesSet}
            />
          </div>

          <div style={{ width: colWidth, maxWidth: "100%" }}>
            <SolvedBanner solved={solved} />

            {/* Undo / Redo */}
            <div className={styles.undoRow}>
              <button className={styles.btn} onClick={handleUndo} disabled={past.length === 0}>
                ↩ Undo
              </button>
              <button className={styles.btn} onClick={handleRedo} disabled={future.length === 0}>
                ↪ Redo
              </button>
            </div>

            {/* Continue in Play */}
            <button className={`${styles.btn} ${styles.btnAccent}`} onClick={handleContinueInPlay}>
              Continue in Play →
            </button>
          </div>

          {/* Mobile: rules panel below board */}
          <div className={styles.mobileRules}>
            <SolverRulesPanel
              hintDescription={frozenHint?.description ?? null}
              solved={solved}
              onApply={frozenHint ? handleApply : undefined}
            />
          </div>
        </div>

        {/* ── Rules panel (desktop only) ── */}
        <div className={styles.desktopRules}>
          <SolverRulesPanel
            hintDescription={frozenHint?.description ?? null}
            solved={solved}
            onApply={frozenHint ? handleApply : undefined}
          />
        </div>

      </div>
    </div>
  );
}
