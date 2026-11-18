export const MODELS = [
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5" },
  { id: "claude-sonnet-5-5:thinking", name: "Claude Sonnet 5.5 (Thinking)" },
  { id: "claude-opus-5-5", name: "Claude Opus 5.5" },
  { id: "claude-opus-5-5:thinking", name: "Claude Opus 5.5 (Thinking)" },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5 (rapide)" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

export type StreamPhase = "idle" | "reasoning" | "generating";

export type GenerationErrorType = "validation" | "api";
