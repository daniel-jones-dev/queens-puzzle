import init, { WasmPuzzle } from "queens-puzzle-wasm";

let initialized = false;

self.onmessage = async (e: MessageEvent<{ n: number; seed: number }>) => {
  if (!initialized) {
    await init();
    initialized = true;
  }
  const { n, seed } = e.data;
  try {
    const puzzle = WasmPuzzle.generate(n, seed);
    const json = puzzle.to_json();
    const difficulty = puzzle.difficulty() ?? null;
    puzzle.free();
    self.postMessage({ json, difficulty });
  } catch {
    self.postMessage({ json: null, difficulty: null });
  }
};

export type {};
