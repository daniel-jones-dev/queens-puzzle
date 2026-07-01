import { useState } from "react";
import { SettingsPanel } from "./SettingsPanel";
import type { PuzzleMeta } from "../utils";
import styles from "./AboveBoard.module.css";

interface Props {
  width: number;
  meta: PuzzleMeta;
  difficulty: string | null;
  puzzleUnique: boolean;
  timer?: string;
  onReset: () => void;
}

export function AboveBoard({ width, meta, difficulty, puzzleUnique, timer, onReset }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className={styles.aboveBoard} style={{ width, maxWidth: "100%" }}>
      <div className={styles.topControls}>
        <div className={styles.settingsAnchor}>
          <button
            className={styles.iconBtn}
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label="Settings"
            title="Settings"
          >
            ⚙
          </button>
          {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
        </div>
        <button
          className={styles.iconBtn}
          onClick={onReset}
          aria-label="Reset"
          title="Reset puzzle"
        >
          Reset
        </button>
      </div>

      {(meta.name || meta.source) && (
        <div className={styles.metaRow}>
          {meta.name && <span className={styles.metaName}>{meta.name}</span>}
          {meta.name && meta.source && <span className={styles.metaSep}>·</span>}
          {meta.source && <span>by {meta.source}</span>}
        </div>
      )}

      {(difficulty || puzzleUnique || timer) && (
        <div className={styles.metaRow}>
          {difficulty && (
            <>
              <span>Difficulty:</span>
              <span className={styles.diffBadge}>{difficulty}</span>
            </>
          )}
          {puzzleUnique && <span className={styles.uniqueBadge}>✓ Unique</span>}
          {timer && <span className={styles.timer}>{timer}</span>}
        </div>
      )}
    </div>
  );
}
