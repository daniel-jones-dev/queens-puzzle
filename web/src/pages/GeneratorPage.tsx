import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useBeforeUnload } from "react-router-dom";
import { WasmPuzzle } from "queens-puzzle-wasm";
import { ConfirmModal } from "../components/ConfirmModal";
import { initWasm } from "../initWasm";
import { toBase64Url } from "../utils";
import type { GeneratorWorkerOut } from "../generatorWorker";
import styles from "./GeneratorPage.module.css";

const EDITOR_KEY = "queens-puzzle-editor-v1";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkerState {
  id: string;
  n: number;
  startSeed: number;
  resolvedSeed: number;
  status: "running" | "stopped";
  tried: number;
  lastSeed: number;
}

interface ResultItem {
  id: string;
  n: number;
  difficulty: string | null;
  json: string;
  seed: number;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniBoard({ json, regionColors }: { json: string; regionColors: string[] }) {
  const regions = useMemo(() => {
    try {
      const obj = JSON.parse(json) as { regions?: number[][] };
      if (!Array.isArray(obj.regions)) return null;
      return obj.regions;
    } catch {
      return null;
    }
  }, [json]);

  if (!regions) return null;
  const n = regions.length;
  const cell = Math.max(4, Math.min(8, Math.floor(56 / n)));

  return (
    <div
      className={styles.miniBoard}
      style={{ gridTemplateColumns: `repeat(${n}, ${cell}px)` }}
    >
      {regions.flat().map((region, i) => (
        <div
          key={i}
          style={{ width: cell, height: cell, backgroundColor: regionColors[region] ?? "#ccc" }}
        />
      ))}
    </div>
  );
}

function WorkerCard({
  entry,
  onStop,
  onRestart,
  onDelete,
}: {
  entry: WorkerState;
  onStop: () => void;
  onRestart: () => void;
  onDelete: () => void;
}) {
  const isAuto = entry.startSeed === -1;
  const seedLabel = isAuto
    ? `${entry.resolvedSeed.toLocaleString()} (auto)`
    : entry.resolvedSeed.toLocaleString();

  return (
    <div className={styles.workerCard} data-testid="worker-card">
      <div className={styles.workerHeader}>
        <span
          className={`${styles.statusBadge} ${entry.status === "running" ? styles.statusRunning : styles.statusStopped}`}
          data-testid="status-badge"
        >
          {entry.status === "running" ? "Running" : "Stopped"}
        </span>
        <span className={styles.workerSize}>{entry.n}×{entry.n}</span>
      </div>
      <div className={styles.workerStats}>
        <span className={styles.statItem}>Seed: {seedLabel}</span>
        <span className={styles.statItem}>Found: {entry.tried.toLocaleString()}</span>
      </div>
      {entry.status === "running" && (
        <div className={styles.progressBar}>
          <div className={styles.progressIndeterminate} />
        </div>
      )}
      <div className={styles.workerActions}>
        {entry.status === "running" ? (
          <button className={styles.stopBtn} onClick={onStop}>Stop</button>
        ) : (
          <>
            <button className={styles.restartBtn} onClick={onRestart}>Restart</button>
            <button className={styles.deleteBtn} onClick={onDelete}>Delete</button>
          </>
        )}
      </div>
    </div>
  );
}

function ResultRow({
  item,
  regionColors,
  onPlay,
  onEdit,
}: {
  item: ResultItem;
  regionColors: string[];
  onPlay: () => void;
  onEdit: () => void;
}) {
  return (
    <div className={styles.resultRow} data-testid="result-row">
      <MiniBoard json={item.json} regionColors={regionColors} />
      <div className={styles.resultMeta}>
        <span className={styles.sizeBadge} data-testid="size-badge">{item.n}×{item.n}</span>
        {item.difficulty && (
          <span className={styles.diffBadge} data-testid="diff-badge">{item.difficulty}</span>
        )}
      </div>
      <div className={styles.resultActions}>
        <button className={styles.openBtn} onClick={onPlay}>Play ↗</button>
        <button className={styles.openBtn} onClick={onEdit}>Edit ↗</button>
      </div>
    </div>
  );
}

function AddWorkerModal({
  onAdd,
  onCancel,
}: {
  onAdd: (n: number, seed: number | null) => void;
  onCancel: () => void;
}) {
  const [n, setN] = useState(7);
  const [seedStr, setSeedStr] = useState("");

  function handleAdd() {
    const parsed = seedStr.trim() ? parseInt(seedStr.trim(), 10) : null;
    const seed = parsed !== null && !isNaN(parsed) ? parsed >>> 0 : null;
    onAdd(n, seed);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "var(--surface)",
          padding: "1.5rem 2rem",
          borderRadius: "10px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          maxWidth: 340,
          width: "calc(100vw - 4rem)",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ fontWeight: "bold", fontSize: "1.05rem" }}>Add worker</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <label style={{ fontSize: "0.9rem", color: "var(--text2)", width: 48, flexShrink: 0 }}>Size</label>
            <select
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              style={{
                flex: 1,
                padding: "5px 8px",
                borderRadius: "6px",
                border: "1.5px solid var(--border)",
                fontSize: "0.9rem",
                background: "var(--surface)",
              }}
            >
              {Array.from({ length: 9 }, (_, i) => i + 4).map((sz) => (
                <option key={sz} value={sz}>{sz}×{sz}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <label style={{ fontSize: "0.9rem", color: "var(--text2)", width: 48, flexShrink: 0 }}>Seed</label>
            <input
              type="number"
              value={seedStr}
              onChange={(e) => setSeedStr(e.target.value)}
              placeholder="Random"
              style={{
                flex: 1,
                padding: "5px 8px",
                borderRadius: "6px",
                border: "1.5px solid var(--border)",
                fontSize: "0.9rem",
                background: "var(--surface)",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "0.35rem 0.9rem", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={handleAdd}
            style={{
              background: "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: "4px",
              padding: "0.35rem 0.9rem",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function GeneratorPage() {
  const [wasmReady, setWasmReady] = useState(false);
  const [regionColors, setRegionColors] = useState<string[]>([]);
  const [workerStates, setWorkerStates] = useState<WorkerState[]>([]);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sizeFilter, setSizeFilter] = useState<number | "all">("all");
  const [diffFilter, setDiffFilter] = useState<string | "all">("all");

  const workerInstancesRef = useRef<Map<string, Worker>>(new Map());

  const hasRunning = workerStates.some((w) => w.status === "running");

  // Blocker for in-app navigation
  const blocker = useBlocker(hasRunning);

  // Block browser close / tab refresh
  useBeforeUnload(
    useCallback(
      (e: BeforeUnloadEvent) => {
        if (hasRunning) e.preventDefault();
      },
      [hasRunning],
    ),
  );

  // Terminate all workers on unmount
  useEffect(() => {
    const instances = workerInstancesRef.current;
    return () => {
      for (const w of instances.values()) w.terminate();
    };
  }, []);

  // Init WASM for mini-board color rendering
  useEffect(() => {
    initWasm().then(() => {
      setRegionColors(Array.from({ length: 12 }, (_, i) => WasmPuzzle.region_color_hex(i)));
      setWasmReady(true);
    });
  }, []);

  // ── Worker lifecycle ────────────────────────────────────────────────────────

  const spawnWorker = useCallback((id: string, n: number, seed: number) => {
    const worker = new Worker(
      new URL("../generatorWorker.ts", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (e: MessageEvent<GeneratorWorkerOut>) => {
      const msg = e.data;
      setWorkerStates((prev) =>
        prev.map((w) =>
          w.id === id ? { ...w, tried: msg.tried, lastSeed: msg.seed } : w,
        ),
      );
      setResults((prev) => [
        {
          id: `${id}-${msg.tried}`,
          n,
          difficulty: msg.difficulty,
          json: msg.json,
          seed: msg.seed,
        },
        ...prev,
      ]);
    };

    worker.postMessage({ n, seed });
    workerInstancesRef.current.set(id, worker);
  }, []);

  const handleAddWorker = useCallback(
    (n: number, inputSeed: number | null) => {
      const seed =
        inputSeed !== null ? inputSeed >>> 0 : (Math.floor(Math.random() * 2 ** 32) >>> 0);
      const id = crypto.randomUUID();
      setWorkerStates((prev) => [
        ...prev,
        {
          id,
          n,
          startSeed: inputSeed !== null ? inputSeed : -1,
          resolvedSeed: seed,
          status: "running",
          tried: 0,
          lastSeed: seed,
        },
      ]);
      spawnWorker(id, n, seed);
      setShowAddModal(false);
    },
    [spawnWorker],
  );

  const handleStop = useCallback((id: string) => {
    const worker = workerInstancesRef.current.get(id);
    if (worker) {
      worker.terminate();
      workerInstancesRef.current.delete(id);
    }
    setWorkerStates((prev) =>
      prev.map((w) => (w.id === id ? { ...w, status: "stopped" } : w)),
    );
  }, []);

  const handleRestart = useCallback(
    (entry: WorkerState) => {
      const nextSeed = (entry.lastSeed + 1) >>> 0;
      spawnWorker(entry.id, entry.n, nextSeed);
      setWorkerStates((prev) =>
        prev.map((w) =>
          w.id === entry.id
            ? { ...w, status: "running", tried: 0, lastSeed: nextSeed }
            : w,
        ),
      );
    },
    [spawnWorker],
  );

  const handleDelete = useCallback((id: string) => {
    const worker = workerInstancesRef.current.get(id);
    if (worker) {
      worker.terminate();
      workerInstancesRef.current.delete(id);
    }
    setWorkerStates((prev) => prev.filter((w) => w.id !== id));
  }, []);

  // ── Open results ────────────────────────────────────────────────────────────

  const handleOpenInPlay = useCallback((json: string) => {
    const encoded = toBase64Url(json);
    const playPath = window.location.pathname.replace(/\/generator\/?$/, "/play");
    window.open(`${window.location.origin}${playPath}#${encoded}`, "_blank");
  }, []);

  const handleOpenInEdit = useCallback((json: string) => {
    try {
      const base = JSON.parse(json) as Record<string, unknown>;
      if (base.states) delete base.states;
      localStorage.setItem(EDITOR_KEY, JSON.stringify(base));
    } catch {}
    const editPath = window.location.pathname.replace(/\/generator\/?$/, "/editor");
    window.open(`${window.location.origin}${editPath}`, "_blank");
  }, []);

  // ── Filters ─────────────────────────────────────────────────────────────────

  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      if (sizeFilter !== "all" && r.n !== sizeFilter) return false;
      if (diffFilter !== "all" && r.difficulty !== diffFilter) return false;
      return true;
    });
  }, [results, sizeFilter, diffFilter]);

  const uniqueDifficulties = useMemo(() => {
    const seen = new Set<string>();
    for (const r of results) if (r.difficulty) seen.add(r.difficulty);
    return Array.from(seen).sort();
  }, [results]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Workers section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Workers</h2>
          <button
            className={styles.addBtn}
            onClick={() => setShowAddModal(true)}
            disabled={!wasmReady}
          >
            + Add worker
          </button>
        </div>

        {workerStates.length === 0 ? (
          <p className={styles.empty}>
            No workers running. Add one to start generating puzzles.
          </p>
        ) : (
          <div className={styles.workerList}>
            {workerStates.map((w) => (
              <WorkerCard
                key={w.id}
                entry={w}
                onStop={() => handleStop(w.id)}
                onRestart={() => handleRestart(w)}
                onDelete={() => handleDelete(w.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Results section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            Results
            {results.length > 0 && (
              <span className={styles.counter}>{results.length.toLocaleString()}</span>
            )}
          </h2>
          {results.length > 0 && (
            <div className={styles.filters}>
              <select
                data-testid="size-filter"
                value={sizeFilter === "all" ? "all" : String(sizeFilter)}
                onChange={(e) =>
                  setSizeFilter(e.target.value === "all" ? "all" : Number(e.target.value))
                }
                className={styles.filterSelect}
              >
                <option value="all">All sizes</option>
                {Array.from({ length: 9 }, (_, i) => i + 4).map((sz) => (
                  <option key={sz} value={sz}>{sz}×{sz}</option>
                ))}
              </select>
              <select
                data-testid="diff-filter"
                value={diffFilter}
                onChange={(e) => setDiffFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All difficulties</option>
                {uniqueDifficulties.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {results.length === 0 ? (
          <p className={styles.empty}>Generated puzzles will appear here.</p>
        ) : filteredResults.length === 0 ? (
          <p className={styles.empty}>No results match the current filters.</p>
        ) : (
          <div className={styles.resultList}>
            {filteredResults.map((r) => (
              <ResultRow
                key={r.id}
                item={r}
                regionColors={regionColors}
                onPlay={() => handleOpenInPlay(r.json)}
                onEdit={() => handleOpenInEdit(r.json)}
              />
            ))}
          </div>
        )}
      </section>

      {showAddModal && (
        <AddWorkerModal
          onAdd={handleAddWorker}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      {blocker.state === "blocked" && (
        <ConfirmModal
          title="Leave Generator?"
          detail="Leaving will stop all running workers."
          confirmLabel="Leave"
          confirmColor="#c0392b"
          onConfirm={() => blocker.proceed?.()}
          onCancel={() => blocker.reset?.()}
        />
      )}
    </div>
  );
}
