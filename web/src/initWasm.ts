import init from "queens-puzzle-wasm";

let wasmInitPromise: ReturnType<typeof init> | null = null;

export function initWasm(): ReturnType<typeof init> {
  if (!wasmInitPromise) wasmInitPromise = init();
  return wasmInitPromise!;
}
