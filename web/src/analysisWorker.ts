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
    const count = puzzle.count_solutions();
    const difficulty = count === 1 ? (puzzle.difficulty() ?? null) : null;
    puzzle.free();
    self.postMessage({ count, difficulty });
  } catch {
    self.postMessage({ count: 0, difficulty: null });
  }
};

export type {};
