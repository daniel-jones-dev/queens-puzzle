export function GeneratorPage() {
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
      <div style={{ fontSize: "40px", lineHeight: 1 }}>⚡</div>
      <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text)", margin: 0 }}>
        Generator
      </h2>
      <p style={{ fontSize: "14px", maxWidth: "340px", lineHeight: 1.6 }}>
        The puzzle generator is coming soon. You can generate puzzles from the{" "}
        <span style={{ color: "var(--accent)" }}>Editor</span> tab in the meantime.
      </p>
    </div>
  );
}
