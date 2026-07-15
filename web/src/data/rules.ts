export type RuleEntry = {
  codeName: string;
  name: string;
  difficulty: "Trivial" | "Easy" | "Medium" | "Hard";
  description: string;
};

export const RULES: RuleEntry[] = [
  {
    codeName: "mark_queen",
    name: "Mark Queen",
    difficulty: "Trivial",
    description:
      "If a row, column, or colour region has only one unknown cell left, that cell must be the queen for that block.",
  },
  {
    codeName: "mark_empty",
    name: "Mark Empty",
    difficulty: "Trivial",
    description:
      "Once a queen is placed, every cell in the same row, column, region, and all diagonally adjacent cells can be crossed out.",
  },
  {
    codeName: "region_spans_row",
    name: "Region Spans Row",
    difficulty: "Easy",
    description:
      "If all remaining unknown cells of a colour region lie in the same row, the queen for that region must be in that row — so all other unknowns in that row can be crossed out.",
  },
  {
    codeName: "region_spans_col",
    name: "Region Spans Column",
    difficulty: "Easy",
    description:
      "If all remaining unknown cells of a colour region lie in the same column, the queen for that region must be in that column — so all other unknowns in that column can be crossed out.",
  },
  {
    codeName: "naked_set",
    name: "Naked Set",
    difficulty: "Medium",
    description:
      "If a group of cells in one block (row, column, or region) all share the same connected unknowns, those shared cells must be empty — the group's queen will occupy one of them exclusively.",
  },
  {
    codeName: "hidden_set",
    name: "Hidden Set",
    difficulty: "Hard",
    description:
      "If a set of colour regions together span only as many rows (or columns) as there are regions, their queens must all go in those rows (or columns), eliminating other unknowns from those rows/columns.",
  },
];

export function ruleByCodeName(codeName: string): RuleEntry | undefined {
  return RULES.find((r) => r.codeName === codeName);
}
