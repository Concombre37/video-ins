export const MODELS = [
  {
    id: "claude-haiku-5-5",
    name: "Claude Haiku 5.5 (économique)",
    short: "Haiku",
    hint: "rapide, le moins cher",
  },
  {
    id: "claude-sonnet-5-5",
    name: "Claude Sonnet 5.5 (meilleure qualité)",
    short: "Sonnet",
    hint: "plus soigné, ~20× plus cher",
  },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

export type StreamPhase = "idle" | "reasoning" | "generating";

export type GenerationErrorType = "validation" | "api";
