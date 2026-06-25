import React from "react";
import { formatTime } from "../utils";

const btn: React.CSSProperties = {
  background: "white",
  border: "1px solid #bbb",
  borderRadius: "6px",
  padding: "0.3rem 0.6rem",
  cursor: "pointer",
  fontSize: "0.9rem",
  display: "flex",
  alignItems: "center",
  gap: "0.3rem",
};

interface Props {
  timerElapsed: number;
  timerEnabled: boolean;
  solved: boolean;
  canUndo: boolean;
  hintActive: boolean;
  noHintMsg: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  onHint: () => void;
  onUndo: () => void;
  onSettings: () => void;
  onReset: () => void;
}

export function PlayControls({
  timerElapsed,
  timerEnabled,
  solved,
  canUndo,
  hintActive,
  noHintMsg,
  containerRef,
  onHint,
  onUndo,
  onSettings,
  onReset,
}: Props) {
  return (
    <div
      ref={containerRef}
      style={{
        marginTop: "0.5rem",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div>
        {!solved && (
          <button
            onClick={onHint}
            disabled={hintActive || noHintMsg}
            title="Hint"
            style={{
              ...btn,
              padding: "0.3rem 0.85rem",
              opacity: hintActive || noHintMsg ? 0.5 : 1,
              cursor: hintActive || noHintMsg ? "default" : "pointer",
            }}
          >
            Hint
          </button>
        )}
      </div>

      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontVariantNumeric: "tabular-nums",
          fontSize: "1.05rem",
          pointerEvents: "none",
          visibility: timerEnabled ? "visible" : "hidden",
        }}
      >
        {formatTime(timerElapsed)}
      </span>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          style={{ ...btn, opacity: canUndo ? 1 : 0.4 }}
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo"
        >
          ↩
        </button>
        <button style={btn} onClick={onSettings} aria-label="Settings" title="Settings">
          ⚙
        </button>
        <button style={btn} onClick={onReset} aria-label="Reset" title="Reset puzzle">
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 4h12" />
            <path d="M5 4V2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V4" />
            <path d="M3 4l1 9.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5L13 4" />
            <path d="M6.5 7v5M9.5 7v5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
