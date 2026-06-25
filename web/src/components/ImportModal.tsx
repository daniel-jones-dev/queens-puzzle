import { useState } from "react";

interface Props {
  error: string | null;
  onImport: (json: string) => void;
  onCancel: () => void;
}

export function ImportModal({ error, onImport, onCancel }: Props) {
  const [text, setText] = useState("");

  return (
    <div
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
          background: "white",
          padding: "1.5rem 2rem",
          borderRadius: "10px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          maxWidth: 420,
          width: "calc(100vw - 4rem)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ margin: "0 0 0.75rem", fontWeight: "bold", fontSize: "1.05rem" }}>
          Import puzzle
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='{"regions": [[0, 0, ...], ...], "states": [[0, 0, ...], ...]}'
          rows={6}
          style={{
            width: "100%",
            boxSizing: "border-box",
            fontFamily: "monospace",
            fontSize: "0.78rem",
            resize: "vertical",
            padding: "0.5rem",
            border: error ? "1px solid #c0392b" : "1px solid #ccc",
            borderRadius: "4px",
          }}
        />
        {error && (
          <p style={{ margin: "0.35rem 0 0", color: "#c0392b", fontSize: "0.82rem" }}>{error}</p>
        )}
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1rem" }}>
          <button onClick={onCancel}>Cancel</button>
          <button
            onClick={() => onImport(text.trim())}
            style={{
              background: "#2980b9",
              color: "white",
              border: "none",
              borderRadius: "4px",
              padding: "0.35rem 0.9rem",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
