export type HintState = {
  description: string;
  changes: Map<string, number>;
  involved: Set<string>;
};

export type AnalysisResult =
  | { status: "no-solution" }
  | { status: "multiple"; count: number }
  | { status: "unique"; difficulty: string | null };
