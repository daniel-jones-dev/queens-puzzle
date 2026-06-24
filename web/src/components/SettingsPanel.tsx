interface Anchor {
  bottom: number;
  right: number;
}

interface Props {
  anchor: Anchor;
  autoCross: boolean;
  timerEnabled: boolean;
  shareToast: boolean;
  onAutoCross: (v: boolean) => void;
  onTimerEnabled: (v: boolean) => void;
  onShare: () => void;
  onImport: () => void;
  onGenerate: () => void;
  onEditFromPlay: () => void;
  onNewPuzzle: () => void;
  onClose: () => void;
}

const menuBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "0.1rem 0",
  textAlign: "left",
  fontSize: "0.9rem",
};

export function SettingsPanel({
  anchor,
  autoCross,
  timerEnabled,
  shareToast,
  onAutoCross,
  onTimerEnabled,
  onShare,
  onImport,
  onGenerate,
  onEditFromPlay,
  onNewPuzzle,
  onClose,
}: Props) {
  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 150 }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed",
          bottom: anchor.bottom,
          right: anchor.right,
          zIndex: 160,
          background: "white",
          border: "1px solid #ddd",
          borderRadius: "8px",
          padding: "0.75rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem",
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          whiteSpace: "nowrap",
        }}
      >
        <label style={{ display: "flex", gap: "0.6rem", alignItems: "center", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={autoCross}
            onChange={(e) => onAutoCross(e.target.checked)}
          />
          Auto-cross
        </label>
        <label style={{ display: "flex", gap: "0.6rem", alignItems: "center", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={timerEnabled}
            onChange={(e) => onTimerEnabled(e.target.checked)}
          />
          Timer
        </label>
        <hr style={{ margin: "0.1rem 0", border: "none", borderTop: "1px solid #eee" }} />
        <button
          onClick={onShare}
          style={{ ...menuBtn, color: shareToast ? "#27ae60" : "inherit" }}
        >
          {shareToast ? "✓ Copied!" : "Share puzzle"}
        </button>
        <button onClick={onImport} style={menuBtn}>
          Import puzzle…
        </button>
        <button onClick={onGenerate} style={menuBtn}>
          Generate puzzle…
        </button>
        <hr style={{ margin: "0.1rem 0", border: "none", borderTop: "1px solid #eee" }} />
        <button onClick={onEditFromPlay} style={menuBtn}>
          Edit this puzzle
        </button>
        <button onClick={onNewPuzzle} style={menuBtn}>
          New puzzle (Editor)…
        </button>
      </div>
    </>
  );
}
