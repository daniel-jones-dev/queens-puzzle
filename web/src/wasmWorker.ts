/**
 * Web Worker that initialises the WASM module independently.
 * Each worker needs its own init() call — workers cannot share the main thread's instance.
 */
import init, { WasmPuzzle } from "queens-puzzle-wasm";

self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data as { type: string; payload?: unknown };

  if (type === "init") {
    await init();
    self.postMessage({ type: "ready" });
    return;
  }

  if (type === "generate") {
    const { n, seed } = payload as { n: number; seed: number };
    const puzzle = WasmPuzzle.generate(n, seed);
    const json = puzzle.to_json();
    puzzle.free();
    self.postMessage({ type: "generated", payload: json });
    return;
  }
};

export type {};
