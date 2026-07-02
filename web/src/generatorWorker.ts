import init, { WasmPuzzle } from "queens-puzzle-wasm";

export type GeneratorWorkerOut =
  | { type: "found"; json: string; difficulty: string | null; seed: number; tried: number }
  | { type: "error"; message: string };

let initialized = false;

async function ensureInit() {
  if (!initialized) {
    await init();
    initialized = true;
  }
}

async function runLoop(n: number, startSeed: number) {
  await ensureInit();
  let seed = startSeed >>> 0;
  let tried = 0;

  while (true) {
    try {
      const puzzle = WasmPuzzle.generate(n, seed);
      const json = puzzle.to_json();
      const difficulty = puzzle.difficulty() ?? null;
      puzzle.free();
      tried++;
      const out: GeneratorWorkerOut = { type: "found", json, difficulty, seed, tried };
      self.postMessage(out);
      seed = (seed + 1) >>> 0;
    } catch (err) {
      const out: GeneratorWorkerOut = { type: "error", message: String(err) };
      self.postMessage(out);
      return;
    }
    // Yield between generations so the worker can be terminated cleanly
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

self.onmessage = (e: MessageEvent<{ n: number; seed: number }>) => {
  const { n, seed } = e.data;
  runLoop(n, seed);
};

export type {};
