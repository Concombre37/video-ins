/**
 * Coût des appels à Claude, calculé à partir des tokens consommés (côté serveur).
 * Les tarifs viennent d'OpenRouter (mis en cache 6 h), avec une table de secours.
 */

type Price = { input: number; output: number }; // USD par token

const FALLBACK: Record<string, Price> = {
  "claude-haiku-5-5": { input: 0.1e-6, output: 0.5e-6 },
  "claude-sonnet-5-5": { input: 2e-6, output: 10e-6 },
};

let cache: { at: number; prices: Record<string, Price> } | null = null;

async function loadPrices(): Promise<Record<string, Price>> {
  if (cache && Date.now() - cache.at < 6 * 3600_000) return cache.prices;
  const prices: Record<string, Price> = { ...FALLBACK };
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { cache: "no-store" });
    if (res.ok) {
      const { data } = (await res.json()) as {
        data: { id: string; pricing: { prompt: string; completion: string } }[];
      };
      for (const m of data) {
        if (!m.id.startsWith("anthropic/claude-")) continue;
        // "anthropic/claude-sonnet-5.5" -> "claude-sonnet-5-5"
        const id = m.id.replace("anthropic/", "").replace(/\./g, "-");
        const input = Number(m.pricing?.prompt);
        const output = Number(m.pricing?.completion);
        if (Number.isFinite(input) && Number.isFinite(output)) prices[id] = { input, output };
      }
    }
  } catch {
    // table de secours
  }
  cache = { at: Date.now(), prices };
  return prices;
}

export interface UsageEntry {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

/** Additionne le coût d'une liste d'appels (validation, détection, génération…). */
export async function computeCost(entries: UsageEntry[]) {
  const prices = await loadPrices();
  let cost = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  for (const e of entries) {
    const p = prices[e.model] ?? FALLBACK["claude-sonnet-5-5"];
    const i = e.inputTokens ?? 0;
    const o = e.outputTokens ?? 0;
    cost += i * p.input + o * p.output;
    inputTokens += i;
    outputTokens += o;
  }
  return { cost, inputTokens, outputTokens };
}
