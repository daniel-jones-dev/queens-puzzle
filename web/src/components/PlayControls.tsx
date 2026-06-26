import { useState } from "react";
import { useSettings } from "../contexts/SettingsContext";
import { SettingsPanel } from "./SettingsPanel";
import { formatTime } from "../utils";
import styles from "./PlayControls.module.css";

interface Props {
  timerElapsed: number;
  solved: boolean;
  canUndo: boolean;
  hintActive: boolean;
  noHintMsg: boolean;
  onHint: () => void;
  onUndo: () => void;
  onReset: () => void;
}

export function PlayControls({
  timerElapsed,
  solved,
  canUndo,
  hintActive,
  noHintMsg,
  onHint,
  onUndo,
  onReset,
}: Props) {
  const { showClock } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className={styles.controls}>
      {/* Left: Hint */}
      <div>
        {!solved && (
          <button
            className={styles.btnHint}
            onClick={onHint}
            disabled={hintActive || noHintMsg}
            title="Hint"
          >
            Hint
          </button>
        )}
      </div>

      {/* Centre: timer (absolute, non-interactive) */}
      <div className={styles.ctrlCenter}>
        {showClock && (
          <span className={styles.timer}>{formatTime(timerElapsed)}</span>
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
          ↩ Undo
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
          🗑 Reset
        </button>
      </div>
    </div>
  );
}
