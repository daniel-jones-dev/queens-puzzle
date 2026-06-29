import { WasmPuzzle } from "queens-puzzle-wasm";

export function toBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function fromBase64Url(b64: string): string {
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
}

export const MAX_CELL_PX = 56;
export const MIN_CELL_PX = 32;

export function computeCellSize(n: number): number {
  const available = window.innerWidth - 32;
  return Math.min(MAX_CELL_PX, Math.max(MIN_CELL_PX, Math.floor(available / n)));
}

export function readRegions(puzzle: WasmPuzzle): (number | null)[][] {
  const n = puzzle.n();
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => puzzle.cell_region(r, c) ?? null)
  );
}

export function readStates(puzzle: WasmPuzzle): number[][] {
  const n = puzzle.n();
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => puzzle.cell_state(r, c))
  );
}

export function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function editorHasWork(regions: (number | null)[][]): boolean {
  return regions.some((row) => row.some((c) => c !== null));
}

export function validateEditorBoard(regions: (number | null)[][], n: number): string | null {
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (regions[r][c] === null) return "Some cells have no region assigned.";
  const counts = new Array(n).fill(0);
  for (const row of regions) for (const cell of row) if (cell !== null) counts[cell]++;
  for (let i = 0; i < n; i++)
    if (counts[i] === 0)
      return `Region ${i + 1} is missing — each of the ${n} regions must appear at least once.`;
  return null;
}

export function hintComplete(puzzle: WasmPuzzle, changes: Map<string, number>): boolean {
  for (const [key, targetState] of changes) {
    const [r, c] = key.split(",").map(Number);
    if (puzzle.cell_state(r, c) !== targetState) return false;
  }
  return true;
}

export interface PuzzleMeta {
  name?: string;
  source?: string;
}

export function parsePuzzleMeta(json: string): PuzzleMeta {
  try {
    const obj = JSON.parse(json);
    return {
      name: typeof obj.name === "string" ? obj.name : undefined,
      source: typeof obj.source === "string" ? obj.source : undefined,
    };
  } catch {
    return {};
  }
}
