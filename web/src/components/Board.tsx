import { useRef } from "react";
import styles from "./Board.module.css";

interface Props {
  regions: (number | null)[][];
  regionColors: string[];
  cellStates: number[][];
  clashingSet: Set<string>;
  onCellCross: (row: number, col: number) => void;
  onCellClick: (row: number, col: number, visualState: number) => void;
  locked?: boolean;
  cellSize?: number;
  hintInvolved?: Set<string>;
  hintChanges?: Map<string, number>;
  editMode?: boolean;
  onCellPaint?: (row: number, col: number) => void;
  onPaintStart?: (row: number, col: number) => void;
  onPaintEnd?: () => void;
  /** Show queens as semi-transparent overlay even in editMode */
  showQueenOverlay?: boolean;
  /** Cells to highlight with a red inner border (multi-solution warning) */
  multiSolutionCells?: Set<string>;
}

const BORDER_THIN = "1px solid rgba(0,0,0,0.08)";

const CHECKERBOARD_STYLE = {
  backgroundImage:
    "linear-gradient(45deg,#c0c0c0 25%,transparent 25%,transparent 75%,#c0c0c0 75%)," +
    "linear-gradient(45deg,#c0c0c0 25%,transparent 25%,transparent 75%,#c0c0c0 75%)",
  backgroundSize: "12px 12px",
  backgroundPosition: "0 0,6px 6px",
  backgroundColor: "#e4e4e4",
};

interface Segment {
  x1: number; y1: number; x2: number; y2: number;
  adj: [[number, number], [number, number]];
}

function regionBorderSegments(regions: (number | null)[][], cellSize: number): Segment[] {
  const n = regions.length;
  const segs: Segment[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const reg = regions[r][c];
      if (c < n - 1 && regions[r][c + 1] !== reg) {
        const x = (c + 1) * cellSize;
        segs.push({ x1: x, y1: r * cellSize, x2: x, y2: (r + 1) * cellSize, adj: [[r, c], [r, c + 1]] });
      }
      if (r < n - 1 && regions[r + 1][c] !== reg) {
        const y = (r + 1) * cellSize;
        segs.push({ x1: c * cellSize, y1: y, x2: (c + 1) * cellSize, y2: y, adj: [[r, c], [r + 1, c]] });
      }
    }
  }
  return segs;
}

export function Board({
  regions,
  regionColors,
  cellStates,
  clashingSet,
  onCellCross,
  onCellClick,
  locked,
  cellSize = 56,
  hintInvolved,
  hintChanges,
  editMode,
  onCellPaint,
  onPaintStart,
  onPaintEnd,
  showQueenOverlay,
  multiSolutionCells,
}: Props) {
  const n = regions.length;
  const boardRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const clickDownCellRef = useRef<[number, number] | null>(null);

  if (n === 0) return null;

  function getCellFromPoint(clientX: number, clientY: number): [number, number] | null {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    const c = Math.floor((clientX - rect.left) / cellSize);
    const r = Math.floor((clientY - rect.top) / cellSize);
    if (r < 0 || r >= n || c < 0 || c >= n) return null;
    return [r, c];
  }

  const segments = regionBorderSegments(regions, cellSize);
  const boardPx = n * cellSize;
  const inHintMode = !!hintInvolved;

  function isSegDimmed(s: Segment): boolean {
    if (!inHintMode) return false;
    return s.adj.every(([r, c]) => {
      const key = `${r},${c}`;
      return !hintInvolved!.has(key) && !hintChanges?.has(key);
    });
  }

  return (
    <div
      ref={boardRef}
      data-testid="board"
      className={styles.board}
      style={{
        gridTemplateColumns: `repeat(${n}, ${cellSize}px)`,
        cursor: locked ? "default" : editMode ? "crosshair" : undefined,
        touchAction: "none",
        position: "relative",
      }}
      onPointerDown={(e) => {
        if (locked) return;
        const cell = getCellFromPoint(e.clientX, e.clientY);
        if (!cell) return;
        const [r, c] = cell;
        if (editMode && onCellPaint) {
          e.currentTarget.setPointerCapture(e.pointerId);
          draggingRef.current = true;
          onPaintStart?.(r, c);
          onCellPaint(r, c);
          return;
        }
        const visualState = cellStates[r]?.[c] ?? 0;
        if (visualState === 0) {
          e.currentTarget.setPointerCapture(e.pointerId);
          draggingRef.current = true;
          clickDownCellRef.current = null;
          onCellCross(r, c);
        } else {
          draggingRef.current = false;
          clickDownCellRef.current = [r, c];
        }
      }}
      onPointerMove={(e) => {
        if (!draggingRef.current) return;
        const cell = getCellFromPoint(e.clientX, e.clientY);
        if (!cell) return;
        const [r, c] = cell;
        if (editMode && onCellPaint) { onCellPaint(r, c); return; }
        if ((cellStates[r]?.[c] ?? 0) === 0) onCellCross(r, c);
      }}
      onPointerUp={(e) => {
        if (editMode) {
          if (draggingRef.current) onPaintEnd?.();
          draggingRef.current = false;
          return;
        }
        if (!draggingRef.current && clickDownCellRef.current) {
          const upCell = getCellFromPoint(e.clientX, e.clientY);
          const [dr, dc] = clickDownCellRef.current;
          if (upCell && upCell[0] === dr && upCell[1] === dc) {
            onCellClick(dr, dc, cellStates[dr]?.[dc] ?? 0);
          }
        }
        draggingRef.current = false;
        clickDownCellRef.current = null;
      }}
      onPointerCancel={() => {
        if (editMode && draggingRef.current) onPaintEnd?.();
        draggingRef.current = false;
        clickDownCellRef.current = null;
      }}
    >
      {regions.map((row, r) =>
        row.map((region, c) => {
          const cellKey = `${r},${c}`;
          const state = cellStates[r]?.[c] ?? 0;
          const clashing = state === 1 && clashingSet.has(cellKey);
          const hintChangeState = hintChanges?.get(cellKey); // undefined | 1 (queen) | 2 (cross)
          const hasHintChange = hintChangeState !== undefined;
          const isDimmed = inHintMode && !hintInvolved!.has(cellKey) && !hasHintChange;

          const isNull = region === null;
          const baseStyle = isNull && editMode
            ? CHECKERBOARD_STYLE
            : { background: region != null ? regionColors[region] : "#ccc" };

          return (
            <div
              key={`${r}-${c}`}
              className={styles.cell}
              style={{
                width: cellSize,
                height: cellSize,
                ...baseStyle,
                cursor: locked ? "default" : editMode ? "crosshair" : "pointer",
                borderRight: c === n - 1 ? "none" : BORDER_THIN,
                borderBottom: r === n - 1 ? "none" : BORDER_THIN,
                position: "relative",
              }}
            >
              {(!editMode || showQueenOverlay) && state === 1 && (
                <span
                  className={clashing ? styles.queenClash : styles.queen}
                  style={{
                    fontSize: Math.round(cellSize * 0.54),
                    ...(showQueenOverlay && editMode
                      ? { color: "rgba(0,0,0,0.32)", textShadow: "none" }
                      : {}),
                  }}
                >
                  ♛
                </span>
              )}
              {!editMode && state === 2 && (
                <span className={styles.cross} style={{ fontSize: Math.round(cellSize * 0.36) }}>
                  ✕
                </span>
              )}
              {isDimmed && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: state !== 0 ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.42)",
                    pointerEvents: "none",
                  }}
                />
              )}
              {hintChangeState === 2 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "repeating-linear-gradient(-45deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 2px, transparent 2px, transparent 8px)",
                    pointerEvents: "none",
                  }}
                />
              )}
              {multiSolutionCells?.has(cellKey) && (
                <svg
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                  }}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <line x1="10" y1="10" x2="90" y2="90" stroke="rgba(210,40,40,0.55)" strokeWidth="5" strokeLinecap="round" />
                  <line x1="90" y1="10" x2="10" y2="90" stroke="rgba(210,40,40,0.55)" strokeWidth="5" strokeLinecap="round" />
                </svg>
              )}
            </div>
          );
        })
      )}

      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: boardPx,
          height: boardPx,
          pointerEvents: "none",
        }}
      >
        {segments.map((s, i) => (
          <line
            key={i}
            x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
            stroke={isSegDimmed(s) ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.5)"}
            strokeWidth={2.5}
            strokeLinecap="square"
          />
        ))}
      </svg>
    </div>
  );
}
