import { Link } from "react-router-dom";

const ruleStyles: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--text2)",
  lineHeight: 1.65,
  paddingLeft: "16px",
  position: "relative",
};

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <p style={ruleStyles}>
      <span
        style={{
          position: "absolute",
          left: "4px",
          color: "var(--accent)",
          fontWeight: 700,
        }}
      >
        ·
      </span>
      {children}
    </p>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "28px" }}>
      <h2
        style={{
          fontSize: "12px",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text2)",
          marginBottom: "10px",
        }}
      >
        {title}
      </h2>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {children}
      </div>
    </section>
  );
}

export function RulesPage() {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "600px",
        padding: "32px 24px 48px",
      }}
    >
      <div style={{ marginBottom: "24px" }}>
        <Link
          to="/solve"
          style={{
            fontSize: "13px",
            color: "var(--text2)",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          ← Solve
        </Link>
      </div>

      <h1
        style={{
          fontSize: "24px",
          fontWeight: 600,
          color: "var(--text)",
          marginBottom: "28px",
        }}
      >
        Solver rules
      </h1>

      <Section title="Easy">
        <Rule>
          <strong>Single cell in row:</strong> If a colour region has only one cell in a row, that
          cell must contain the queen for that row.
        </Rule>
        <Rule>
          <strong>Single cell in column:</strong> If a colour region has only one cell in a column,
          that cell must contain the queen for that column.
        </Rule>
        <Rule>
          <strong>Single cell in region:</strong> If a colour region contains only one cell, that
          cell must be the queen for that region.
        </Rule>
      </Section>

      <Section title="Medium">
        <Rule>
          <strong>Region spans one row:</strong> If all cells of a colour region lie in the same
          row, the queen for that region must be placed in that row — allowing all other cells in
          the row to be eliminated from other regions.
        </Rule>
        <Rule>
          <strong>Region spans one column:</strong> If all cells of a colour region lie in the same
          column, the queen for that region must be placed in that column — allowing all other cells
          in the column to be eliminated from other regions.
        </Rule>
      </Section>

      <Section title="Hard">
        <Rule>
          <strong>Exclusion chain:</strong> A set of regions whose combined cells span exactly the
          same set of rows (or columns) forces those queens to occupy those rows (or columns),
          eliminating the same rows/columns from all other regions.
        </Rule>
      </Section>
    </div>
  );
}
