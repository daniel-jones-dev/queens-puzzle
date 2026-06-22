import { CSSProperties } from "react";
import { WasmPuzzle } from "queens-puzzle-wasm";
import styles from "./Board.module.css";

interface Props {
  regions: (number | null)[][];
  cellStates: number[][];
  onCellClick: (row: number, col: number) => void;
  locked?: boolean;
}

const CELL_SIZE = 56;
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
      c === n - 1 ? "none" : regions[r][c + 1] !== reg ? BORDER_THICK : BORDER_THIN,
    borderBottom:
      r === n - 1 ? "none" : regions[r + 1][c] !== reg ? BORDER_THICK : BORDER_THIN,
  };
}

export function Board({ regions, cellStates, onCellClick, locked }: Props) {
  const n = regions.length;
  if (n === 0) return null;

  return (
    <div
      className={styles.board}
      style={{
        gridTemplateColumns: `repeat(${n}, ${CELL_SIZE}px)`,
        cursor: locked ? "default" : undefined,
      }}
    >
      {regions.map((row, r) =>
        row.map((region, c) => {
          const state = cellStates[r]?.[c] ?? 0;
          const bg =
            region != null ? WasmPuzzle.region_color_hex(region) : "#ccc";
          return (
            <div
              key={`${r}-${c}`}
              className={styles.cell}
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                background: bg,
                cursor: locked ? "default" : "pointer",
                ...cellBorders(regions, r, c),
              }}
              onClick={() => onCellClick(r, c)}
            >
              {state === 1 && <span className={styles.queen}>♛</span>}
              {state === 2 && <span className={styles.cross}>✕</span>}
            </div>
          );
        })
      )}
    </div>
  );
}
