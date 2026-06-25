interface Props {
  solved: boolean;
}

export function SolvedBanner({ solved }: Props) {
  return (
    <div style={{ minHeight: "2.75rem", marginBottom: "0.75rem" }}>
      <div
        style={{
          background: "#4caf50",
          color: "white",
          padding: "0.6rem 1rem",
          borderRadius: "6px",
          fontWeight: "bold",
          fontSize: "1rem",
          visibility: solved ? "visible" : "hidden",
        }}
      >
        Congratulations — puzzle solved!
      </div>
    </div>
  );
}
