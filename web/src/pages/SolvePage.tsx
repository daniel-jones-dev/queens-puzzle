import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { WasmPuzzle } from "queens-puzzle-wasm";
import { Board } from "../components/Board";
import { SolvedBanner } from "../components/SolvedBanner";
import { initWasm } from "../initWasm";
import {
  computeCellSize,
  readRegions,
  readStates,
  parsePuzzleMeta,
  type PuzzleMeta,
} from "../utils";
import { STORAGE_KEY } from "./PlayPage";
import styles from "./SolvePage.module.css";

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
}

function SolverRulesPanel({ hintDescription, solved }: RulesPanelProps) {
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
                      <p className={styles.ruleDesc}>{hintDescription}</p>
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

  const regionColors = useMemo(
    () => (ready ? Array.from({ length: 12 }, (_, i) => WasmPuzzle.region_color_hex(i)) : []),
    [ready],
  );

  // Active hint — recomputed after every board change
  const activeHint = useMemo(() => {
    const p = puzzleRef.current;
    if (!p || !ready || solved) return null;
    const wasmHint = p.next_hint();
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
  }, [playerStates, solved, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!locState?.puzzleJson) return;
    let cancelled = false;
    initWasm()
      .then(() => {
        if (cancelled) return;
        const puzzle = WasmPuzzle.from_json(locState.puzzleJson);
        // Replay playerStates from Play
        if (locState.playerStates) {
          const n = puzzle.n();
          for (let r = 0; r < n; r++)
            for (let c = 0; c < n; c++)
              puzzle.set_cell_state(r, c, locState.playerStates![r]?.[c] ?? 0);
        }
        puzzleRef.current = puzzle;
        setRegions(readRegions(puzzle));
        setPlayerStates(readStates(puzzle));
        setCellSize(computeCellSize(puzzle.n()));
        setSolved(puzzle.is_solved());
        setPast(locState.past ?? []);
        setPuzzleMeta(parsePuzzleMeta(locState.puzzleJson));
        setReady(true);
      })
      .catch((err: unknown) => setError(String(err)));
    return () => { cancelled = true; };
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
    },
    [solved],
  );

  const handleCellClick = useCallback(
    (r: number, c: number, visualState: number) => {
      if (solved) return;
      const puzzle = puzzleRef.current;
      if (!puzzle) return;
      const snapshot = readStates(puzzle);
      const next = visualState === 2 ? 1 : 0;
      puzzle.set_cell_state(r, c, next);
      setPlayerStates(readStates(puzzle));
      setPast((p) => [...p, snapshot]);
      setFuture([]);
      const nowSolved = puzzle.is_solved();
      setSolved(nowSolved);
    },
    [solved],
  );

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
    setSolved(puzzle.is_solved());
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
    setSolved(puzzle.is_solved());
  }, [future]);

  const handleContinueInPlay = useCallback(() => {
    const puzzle = puzzleRef.current;
    if (!puzzle) return;
    try { localStorage.setItem(STORAGE_KEY, puzzle.to_json()); } catch {}
    navigate("/play");
  }, [navigate]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!locState?.puzzleJson) return <EmptyState />;
  if (error) return <p style={{ color: "red", padding: "1rem" }}>Error: {error}</p>;
  if (!ready) return <div className={styles.loading}>Loading…</div>;

  const difficulty = puzzleRef.current?.difficulty() ?? null;
  const hintInvolvedSet = activeHint?.involved;
  const hintChangesSet = activeHint ? new Set(activeHint.changes.keys()) : undefined;

  return (
    <div className={styles.page}>
      <div className={styles.layout}>

        {/* ── Board column ── */}
        <div className={styles.boardCol}>
          {/* Puzzle meta */}
          {(puzzleMeta.name || puzzleMeta.source || difficulty) && (
            <div className={styles.puzzleMeta}>
              {puzzleMeta.name && (
                <span className={styles.metaName}>{puzzleMeta.name}</span>
              )}
              {puzzleMeta.name && puzzleMeta.source && (
                <span className={styles.metaSep}>·</span>
              )}
              {puzzleMeta.source && <span>by {puzzleMeta.source}</span>}
              {(puzzleMeta.name || puzzleMeta.source) && difficulty && (
                <span className={styles.metaSep}>·</span>
              )}
              {difficulty && (
                <>
                  <span>Difficulty:</span>
                  <span className={styles.diffBadge}>{difficulty}</span>
                </>
              )}
            </div>
          )}

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

          {/* Mobile: rules panel below board */}
          <div className={styles.mobileRules}>
            <SolverRulesPanel
              hintDescription={activeHint?.description ?? null}
              solved={solved}
            />
          </div>
        </div>

        {/* ── Rules panel (desktop only) ── */}
        <div className={styles.desktopRules}>
          <SolverRulesPanel
            hintDescription={activeHint?.description ?? null}
            solved={solved}
          />
        </div>

      </div>
    </div>
  );
}
