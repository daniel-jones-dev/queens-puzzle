import { CSSProperties, useRef } from "react";
import { WasmPuzzle } from "queens-puzzle-wasm";
import styles from "./Board.module.css";

interface Props {
  regions: (number | null)[][];
  cellStates: number[][];
  clashingSet: Set<string>;
  onCellCross: (row: number, col: number) => void;
  onCellClick: (row: number, col: number, visualState: number) => void;
  locked?: boolean;
  cellSize?: number;
}

const BORDER_THICK = "3px solid #333";
const BORDER_THIN = "1px solid rgba(0,0,0,0.15)";

function cellBorders(
  regions: (number | null)[][],
  r: number,
  c: number
): CSSProperties {
  const n = regions.length;
  const reg = regions[r][c];
  return {
    borderRight:
      c === n - 1
        ? "none"
        : regions[r][c + 1] !== reg
          ? BORDER_THICK
          : BORDER_THIN,
    borderBottom:
      r === n - 1
        ? "none"
        : regions[r + 1][c] !== reg
          ? BORDER_THICK
          : BORDER_THIN,
  };
}

export function Board({
  regions,
  cellStates,
  clashingSet,
  onCellCross,
  onCellClick,
  locked,
  cellSize = 56,
}: Props) {
  const n = regions.length;
  const boardRef = useRef<HTMLDivElement>(null);

  // Refs for drag state — avoids stale closure between pointerdown and pointerup.
  const draggingRef = useRef(false);
  const clickDownCellRef = useRef<[number, number] | null>(null);

  if (n === 0) return null;

  function getCellFromPoint(
    clientX: number,
    clientY: number
  ): [number, number] | null {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    const c = Math.floor((clientX - rect.left) / cellSize);
    const r = Math.floor((clientY - rect.top) / cellSize);
    if (r < 0 || r >= n || c < 0 || c >= n) return null;
    return [r, c];
  }

  return (
    <div
      ref={boardRef}
      className={styles.board}
      style={{
        gridTemplateColumns: `repeat(${n}, ${cellSize}px)`,
        cursor: locked ? "default" : undefined,
        touchAction: "none",
      }}
      onPointerDown={(e) => {
        if (locked) return;
        const cell = getCellFromPoint(e.clientX, e.clientY);
        if (!cell) return;
        const [r, c] = cell;
        const visualState = cellStates[r]?.[c] ?? 0;
        if (visualState === 0) {
          // Unknown: start drag-to-cross
          e.currentTarget.setPointerCapture(e.pointerId);
          draggingRef.current = true;
          clickDownCellRef.current = null;
          onCellCross(r, c);
        } else {
          // Empty or Queen: record for potential click on pointer-up
          draggingRef.current = false;
          clickDownCellRef.current = [r, c];
        }
      }}
      onPointerMove={(e) => {
        if (!draggingRef.current) return;
        const cell = getCellFromPoint(e.clientX, e.clientY);
        if (!cell) return;
        const [r, c] = cell;
        if ((cellStates[r]?.[c] ?? 0) === 0) onCellCross(r, c);
      }}
      onPointerUp={(e) => {
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
        draggingRef.current = false;
        clickDownCellRef.current = null;
      }}
    >
      {regions.map((row, r) =>
        row.map((region, c) => {
          const state = cellStates[r]?.[c] ?? 0;
          const bg =
            region != null ? WasmPuzzle.region_color_hex(region) : "#ccc";
          const clashing = state === 1 && clashingSet.has(`${r},${c}`);
          return (
            <div
              key={`${r}-${c}`}
              className={styles.cell}
              style={{
                width: cellSize,
                height: cellSize,
                background: bg,
                cursor: locked ? "default" : "pointer",
                ...cellBorders(regions, r, c),
              }}
            >
              {state === 1 && (
                <span
                  className={clashing ? styles.queenClash : styles.queen}
                  style={{ fontSize: Math.round(cellSize * 0.54) }}
                >
                  ♛
                </span>
              )}
              {state === 2 && (
                <span
                  className={styles.cross}
                  style={{ fontSize: Math.round(cellSize * 0.36) }}
                >
                  ✕
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
