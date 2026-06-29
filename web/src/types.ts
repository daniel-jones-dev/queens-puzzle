export type HintState = {
  codeName: string;
  description: string;
  changes: Map<string, number>;
  involved: Set<string>;
};

export type AnalysisResult =
  | { status: "no-solution" }
  | { status: "multiple"; count: number; ambiguousRows: boolean[]; ambiguousCols: boolean[] }
  | { status: "unique"; difficulty: string | null };
