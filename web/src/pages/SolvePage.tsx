import { Link } from "react-router-dom";

export function SolvePage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 24px",
        gap: "12px",
        color: "var(--text2)",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "40px", lineHeight: 1 }}>→</div>
      <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text)", margin: 0 }}>
        Solver
      </h2>
      <p style={{ fontSize: "14px", maxWidth: "340px", lineHeight: 1.6 }}>
        The step-by-step solver is coming soon. You can open the current puzzle in the solver
        from the <Link to="/play" style={{ color: "var(--accent)" }}>Play</Link> tab.
      </p>
    </div>
  );
}
