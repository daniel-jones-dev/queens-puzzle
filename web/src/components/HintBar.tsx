import type { HintState } from "../types";

const btn: React.CSSProperties = {
  background: "white",
  border: "1px solid #bbb",
  borderRadius: "6px",
  padding: "0.3rem 0.6rem",
  cursor: "pointer",
  fontSize: "0.85rem",
};

interface Props {
  hint: HintState | null;
  noHintMsg: boolean;
  solved: boolean;
  onApply: () => void;
  onDismiss: () => void;
}

export function HintBar({ hint, noHintMsg, solved, onApply, onDismiss }: Props) {
  if (solved || (!hint && !noHintMsg)) return null;
  return (
    <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {hint && (
        <div
          style={{
            background: "#f0faf2",
            border: "1px solid #a8dbb4",
            borderRadius: "8px",
            padding: "0.65rem 0.9rem",
          }}
        >
          <p style={{ margin: "0 0 0.6rem", fontSize: "0.9rem", color: "#1a5e2a", lineHeight: 1.4 }}>
            💡 {hint.description}
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={onApply}
              style={{
                background: "#27ae60",
                color: "white",
                border: "none",
                borderRadius: "4px",
                padding: "0.3rem 0.8rem",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "0.85rem",
              }}
            >
              Apply
            </button>
            <button onClick={onDismiss} style={btn}>
              Dismiss
            </button>
          </div>
        </div>
      )}
      {noHintMsg && (
        <p style={{ margin: 0, fontSize: "0.9rem", color: "#777", fontStyle: "italic" }}>
          No logical step found — try a different approach.
        </p>
      )}
    </div>
  );
}
