import { useEffect, useRef, useState, MutableRefObject } from "react";
import type { WasmPuzzle } from "queens-puzzle-wasm";
import type { AnalysisResult } from "../types";

export function useAnalysisWorker(
  mode: "play" | "edit",
  regions: (number | null)[][],
  puzzleRef: MutableRefObject<WasmPuzzle | null>,
): AnalysisResult | null {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (mode !== "edit" || regions.length === 0) {
      setResult(null);
      return;
    }

    const timerId = setTimeout(() => {
      const puzzle = puzzleRef.current;
      if (!puzzle) return;
      const worker = new Worker(new URL("../analysisWorker.ts", import.meta.url), { type: "module" });
      workerRef.current = worker;
      worker.onmessage = (e: MessageEvent<{ count: number; difficulty: string | null }>) => {
        const { count, difficulty } = e.data;
        if (count === 0) setResult({ status: "no-solution" });
        else if (count === 1) setResult({ status: "unique", difficulty });
        else setResult({ status: "multiple", count });
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
      };
      worker.onerror = () => {
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
      };
      worker.postMessage({ json: puzzle.to_json() });
    }, 300);

    return () => {
      clearTimeout(timerId);
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [mode, regions, puzzleRef]);

  return result;
}
