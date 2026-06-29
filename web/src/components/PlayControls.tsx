import styles from "./PlayControls.module.css";

interface Props {
  solved: boolean;
  canUndo: boolean;
  hintActive: boolean;
  noHintMsg: boolean;
  hintPulsing: boolean;
  onHint: () => void;
  onUndo: () => void;
}

export function PlayControls({
  solved,
  canUndo,
  hintActive,
  noHintMsg,
  hintPulsing,
  onHint,
  onUndo,
}: Props) {
  return (
    <div className={styles.controls}>
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

      <button
        className={styles.btn}
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo"
        title="Undo"
      >
        ↩ Undo
      </button>
    </div>
  );
}
