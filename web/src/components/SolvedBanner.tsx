interface Props {
  solved: boolean;
}

export function SolvedBanner({ solved }: Props) {
  if (!solved) return null;
  return (
    <div
      style={{
        background: "#4caf50",
        color: "white",
        padding: "0.6rem 1rem",
        borderRadius: "6px",
        fontWeight: "bold",
        fontSize: "1rem",
      }}
    >
      Congratulations — puzzle solved!
    </div>
  );
}
