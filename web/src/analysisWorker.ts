import init, { WasmPuzzle } from "queens-puzzle-wasm";

let initialized = false;

self.onmessage = async (e: MessageEvent<{ json: string }>) => {
  if (!initialized) {
    await init();
    initialized = true;
  }
  const { json } = e.data;
  try {
    const puzzle = WasmPuzzle.from_json(json);
    const raw = puzzle.solution_analysis();
    const count = raw[0];
    const n = (raw.length - 1) / 2;
    const ambiguousRows = Array.from(raw.slice(1, 1 + n), (v) => v === 1);
    const ambiguousCols = Array.from(raw.slice(1 + n), (v) => v === 1);
    const difficulty = count === 1 ? (puzzle.difficulty() ?? null) : null;
    puzzle.free();
    self.postMessage({ count, difficulty, ambiguousRows, ambiguousCols });
  } catch {
    self.postMessage({ count: 0, difficulty: null, ambiguousRows: [], ambiguousCols: [] });
  }
};

export type {};
