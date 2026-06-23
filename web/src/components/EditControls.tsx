import React from "react";
import { WasmPuzzle } from "queens-puzzle-wasm";

const CHECKERBOARD_BG: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg,#c0c0c0 25%,transparent 25%,transparent 75%,#c0c0c0 75%)," +
    "linear-gradient(45deg,#c0c0c0 25%,transparent 25%,transparent 75%,#c0c0c0 75%)",
  backgroundSize: "10px 10px",
  backgroundPosition: "0 0,5px 5px",
  backgroundColor: "#e4e4e4",
};

const btn: React.CSSProperties = {
  background: "white",
  border: "1px solid #bbb",
  borderRadius: "6px",
  padding: "0.3rem 0.6rem",
  cursor: "pointer",
  fontSize: "0.85rem",
  display: "flex",
  alignItems: "center",
  gap: "0.3rem",
};

interface Props {
  n: number;
  boardPx: number;
  selectedColor: number | null;
  canUndo: boolean;
  hasWork: boolean;
  validationError: string | null;
  exportToast: boolean;
  onSelectColor: (color: number | null) => void;
  onSizeChange: (n: number) => void;
  onScatter: () => void;
  onShuffle: () => void;
  onUndo: () => void;
  onExport: () => void;
  onPlay: () => void;
  children: React.ReactNode;
}

export function EditControls({
  n,
  boardPx,
  selectedColor,
  canUndo,
  hasWork,
  validationError,
  exportToast,
  onSelectColor,
  onSizeChange,
  onScatter,
  onShuffle,
  onUndo,
  onExport,
  onPlay,
  children,
}: Props) {
  return (
    <div style={{ width: Math.max(boardPx, 300), maxWidth: "calc(100vw - 2rem)" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "0.6rem",
          marginBottom: "0.75rem",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "clamp(1.2rem, 5vw, 1.8rem)" }}>Queens Puzzle</h1>
        <span
          style={{
            background: "#e8f4fd",
            color: "#2980b9",
            borderRadius: "4px",
            padding: "0.15rem 0.5rem",
            fontSize: "0.8rem",
            fontWeight: "bold",
          }}
        >
          EDITOR
        </span>
      </div>

      {/* Top bar: size picker + Play button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.6rem",
          flexWrap: "wrap",
        }}
      >
        <label style={{ fontSize: "0.9rem" }}>
          Size:&nbsp;
          <select
            value={n}
            onChange={(e) => onSizeChange(Number(e.target.value))}
            style={{
              fontSize: "0.9rem",
              padding: "0.2rem 0.4rem",
              borderRadius: "4px",
              border: "1px solid #bbb",
            }}
          >
            {Array.from({ length: 9 }, (_, i) => i + 4).map((sz) => (
              <option key={sz} value={sz}>
                {sz}×{sz}
              </option>
            ))}
          </select>
        </label>
        <div style={{ flex: 1 }} />
        <button
          onClick={onPlay}
          style={{
            ...btn,
            background: "#2980b9",
            color: "white",
            border: "none",
            fontWeight: "bold",
          }}
          title="Play this puzzle"
        >
          Play ▶
        </button>
      </div>

      {/* Validation error */}
      {validationError && (
        <div
          style={{
            background: "#fde8e8",
            border: "1px solid #e74c3c",
            color: "#c0392b",
            padding: "0.4rem 0.75rem",
            borderRadius: "6px",
            fontSize: "0.85rem",
            marginBottom: "0.5rem",
          }}
        >
          {validationError}
        </div>
      )}

      {/* Board (Grid) injected here */}
      {children}

      {/* Colour palette */}
      <div
        style={{
          display: "flex",
          gap: "0.35rem",
          marginTop: "0.6rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: "0.8rem", color: "#555", marginRight: "0.15rem" }}>Colour:</span>
        {Array.from({ length: n }, (_, i) => (
          <button
            key={i}
            onClick={() => onSelectColor(i)}
            title={`Region ${i + 1}`}
            style={{
              width: 26,
              height: 26,
              background: WasmPuzzle.region_color_hex(i),
              border:
                selectedColor === i ? "3px solid #111" : "2px solid rgba(0,0,0,0.22)",
              borderRadius: "4px",
              cursor: "pointer",
              padding: 0,
              boxSizing: "border-box",
              flexShrink: 0,
            }}
          />
        ))}
        <button
          onClick={() => onSelectColor(null)}
          title="Erase (unassign cell)"
          style={{
            width: 26,
            height: 26,
            ...CHECKERBOARD_BG,
            border:
              selectedColor === null ? "3px solid #111" : "2px solid rgba(0,0,0,0.22)",
            borderRadius: "4px",
            cursor: "pointer",
            padding: 0,
            boxSizing: "border-box",
            flexShrink: 0,
          }}
        />
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
        <button
          onClick={onScatter}
          style={btn}
          title="Place n non-attacking queens as single-cell starter regions"
        >
          Scatter queens
        </button>
        <button
          onClick={onShuffle}
          disabled={!hasWork}
          style={{ ...btn, opacity: hasWork ? 1 : 0.4 }}
          title="Randomly reassign region colour indices"
        >
          Shuffle colours
        </button>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo"
          style={{ ...btn, opacity: canUndo ? 1 : 0.4 }}
        >
          ↩ Undo
        </button>
        <button
          onClick={onExport}
          style={{ ...btn, color: exportToast ? "#27ae60" : "inherit" }}
          title="Copy puzzle JSON to clipboard"
        >
          {exportToast ? "✓ Copied!" : "Export JSON"}
        </button>
      </div>
    </div>
  );
}
