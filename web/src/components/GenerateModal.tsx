import React, { useState, useRef, useEffect } from "react";

interface Props {
  onLoad: (json: string) => void;
  onCancel: () => void;
}

type Phase = "idle" | "generating" | "done";

const inputStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  padding: "0.2rem 0.4rem",
  borderRadius: "4px",
  border: "1px solid #bbb",
};

export function GenerateModal({ onLoad, onCancel }: Props) {
  const [size, setSize] = useState(8);
  const [seedInput, setSeedInput] = useState("");
  const [seedError, setSeedError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [lastJson, setLastJson] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => { workerRef.current?.terminate(); };
  }, []);

  const handleGenerate = () => {
    const seedVal = seedInput.trim();
    let seed: number;
    if (seedVal === "") {
      seed = Math.floor(Math.random() * 0xffffffff);
      setSeedError(null);
    } else {
      const parsed = Number(seedVal);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 0xffffffff) {
        setSeedError("Must be an integer 0 – 4294967295");
        return;
      }
      seed = parsed;
      setSeedError(null);
    }

    workerRef.current?.terminate();
    setPhase("generating");
    setLastJson(null);
    setDifficulty(null);

    const worker = new Worker(
      new URL("../generatorWorker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;

    worker.onmessage = (ev: MessageEvent<{ json: string | null; difficulty: string | null }>) => {
      const { json, difficulty: diff } = ev.data;
      setLastJson(json);
      setDifficulty(diff);
      setPhase("done");
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };

    worker.onerror = () => {
      setPhase("idle");
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };

    worker.postMessage({ n: size, seed });
  };

  const handleChangeSize = (newSize: number) => {
    setSize(newSize);
    setPhase("idle");
    setLastJson(null);
    setDifficulty(null);
  };

  const handleChangeSeed = (val: string) => {
    setSeedInput(val);
    setSeedError(null);
    if (phase === "done") { setPhase("idle"); setLastJson(null); setDifficulty(null); }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
      onClick={onCancel}
    >
      <div
        style={{ background: "white", padding: "1.5rem 2rem", borderRadius: "10px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", maxWidth: 360, width: "calc(100vw - 4rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ margin: "0 0 1rem", fontWeight: "bold", fontSize: "1.05rem" }}>Generate puzzle</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginBottom: "1rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
            Size:
            <select
              value={size}
              disabled={phase === "generating"}
              onChange={(e) => handleChangeSize(Number(e.target.value))}
              style={inputStyle}
            >
              {Array.from({ length: 9 }, (_, i) => i + 4).map((n) => (
                <option key={n} value={n}>{n}×{n}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", flexWrap: "wrap" }}>
            Seed:
            <input
              type="text"
              value={seedInput}
              placeholder="random"
              disabled={phase === "generating"}
              onChange={(e) => handleChangeSeed(e.target.value)}
              style={{ ...inputStyle, width: "9rem" }}
            />
          </label>
          {seedError && (
            <p style={{ margin: 0, color: "#c0392b", fontSize: "0.82rem" }}>{seedError}</p>
          )}
        </div>

        {phase === "done" && (
          <p style={{ margin: "0 0 1rem", color: "#27ae60", fontWeight: "bold", fontSize: "0.9rem" }}>
            ✓ {difficulty ?? "Unknown difficulty"}
          </p>
        )}

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button onClick={onCancel} disabled={phase === "generating"}>Cancel</button>
          {phase === "done" ? (
            <>
              <button
                onClick={() => { setPhase("idle"); setLastJson(null); setDifficulty(null); }}
                style={{ background: "none", border: "1px solid #bbb", borderRadius: "4px", padding: "0.35rem 0.75rem", cursor: "pointer", fontSize: "0.9rem" }}
              >
                Re-generate
              </button>
              <button
                onClick={() => lastJson && onLoad(lastJson)}
                style={{ background: "#27ae60", color: "white", border: "none", borderRadius: "4px", padding: "0.35rem 0.9rem", cursor: "pointer", fontWeight: "bold" }}
              >
                Play ▶
              </button>
            </>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={phase === "generating"}
              style={{
                background: phase === "generating" ? "#95a5a6" : "#2980b9",
                color: "white",
                border: "none",
                borderRadius: "4px",
                padding: "0.35rem 0.9rem",
                cursor: phase === "generating" ? "default" : "pointer",
                fontWeight: "bold",
              }}
            >
              {phase === "generating" ? "Generating…" : "Generate"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
