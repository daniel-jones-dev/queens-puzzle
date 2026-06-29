import { useState } from "react";
import { SettingsPanel } from "./SettingsPanel";
import styles from "./PlayControls.module.css";

interface Props {
  solved: boolean;
  canUndo: boolean;
  hintActive: boolean;
  noHintMsg: boolean;
  hintPulsing: boolean;
  onHint: () => void;
  onUndo: () => void;
  onReset: () => void;
}

export function PlayControls({
  solved,
  canUndo,
  hintActive,
  noHintMsg,
  hintPulsing,
  onHint,
  onUndo,
  onReset,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className={styles.controls}>
      {/* Left: Hint */}
      <div>
        {!solved && (
          <button
            className={`${styles.btn} ${styles.btnHint}${hintPulsing ? ` ${styles.btnHintPulsing}` : ""}`}
            onClick={onHint}
            disabled={hintActive || noHintMsg}
            title="Hint"
          >
            Hint
          </button>
        )}
      </div>

      {/* Right: Undo · Settings · Reset */}
      <div className={styles.ctrlRight}>
        <button
          className={styles.btn}
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo"
        >
          Undo
        </button>

        <div className={styles.settingsAnchor}>
          <button
            className={styles.btn}
            style={{ padding: "8px 11px", fontSize: "16px" }}
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label="Settings"
            title="Settings"
          >
            ⚙
          </button>
          {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
        </div>

        <button
          className={styles.btn}
          onClick={onReset}
          aria-label="Reset"
          title="Reset puzzle"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
