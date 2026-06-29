interface Props {
  title: string;
  detail?: string;
  confirmLabel: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  detail,
  confirmLabel,
  confirmColor = "#c0392b",
  onConfirm,
  onCancel,
}: Props) {
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
          maxWidth: 340,
          width: "calc(100vw - 4rem)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ margin: "0 0 0.5rem", fontWeight: "bold", fontSize: "1.05rem" }}>{title}</p>
        {detail && (
          <p style={{ margin: "0 0 1.5rem", color: "#555", fontSize: "0.9rem" }}>{detail}</p>
        )}
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button onClick={onCancel}>Cancel</button>
          <button
            data-testid="confirm-btn"
            onClick={onConfirm}
            style={{
              background: confirmColor,
              color: "white",
              border: "none",
              borderRadius: "4px",
              padding: "0.35rem 0.9rem",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
