import { Link } from "react-router-dom";
import { RULES } from "../data/rules";

const ruleStyles: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--text2)",
  lineHeight: 1.65,
  paddingLeft: "16px",
  position: "relative",
};

function Rule({ name, description }: { name: string; description: string }) {
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
      <strong>{name}:</strong> {description}
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

const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

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

      {DIFFICULTIES.map((difficulty) => {
        const rules = RULES.filter((r) => r.difficulty === difficulty);
        if (rules.length === 0) return null;
        return (
          <Section key={difficulty} title={difficulty}>
            {rules.map((rule) => (
              <Rule key={rule.codeName} name={rule.name} description={rule.description} />
            ))}
          </Section>
        );
      })}
    </div>
  );
}
