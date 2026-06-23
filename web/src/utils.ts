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

export function affectedByQueen(
  qr: number,
  qc: number,
  regions: (number | null)[][],
  n: number
): [number, number][] {
  const region = regions[qr][qc];
  const seen = new Set<string>();
  const add = (r: number, c: number) => {
    if (r !== qr || c !== qc) seen.add(`${r},${c}`);
  };
  for (let i = 0; i < n; i++) { add(qr, i); add(i, qc); }
  if (region !== null) {
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        if (regions[r][c] === region) add(r, c);
  }
  for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
    const nr = qr + dr, nc = qc + dc;
    if (nr >= 0 && nr < n && nc >= 0 && nc < n) add(nr, nc);
  }
  return [...seen].map((s) => s.split(",").map(Number) as [number, number]);
}

export function randomNQueens(n: number): [number, number][] {
  const cols = Array.from({ length: n }, (_, i) => i);
  for (let attempt = 0; attempt < 2000; attempt++) {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cols[i], cols[j]] = [cols[j], cols[i]];
    }
    let ok = true;
    for (let i = 0; i < n && ok; i++)
      for (let j = i + 1; j < n && ok; j++)
        if (Math.abs(cols[i] - cols[j]) === j - i) ok = false;
    if (ok) return cols.map((c, r) => [r, c] as [number, number]);
  }
  return Array.from({ length: n }, (_, i) => [i, (i * 2) % n] as [number, number]);
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
