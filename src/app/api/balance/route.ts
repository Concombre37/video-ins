import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth";
import { getBudget, remaining } from "@/lib/budget-store";
import { SPACES } from "@/lib/spaces";

export const dynamic = "force-dynamic";

let cache: { at: number; body: unknown } | null = null;

/** Solde OpenRouter global (mis en cache 20 s), réservé aux admins. */
async function openRouter() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { provider: "anthropic" };
  if (cache && Date.now() - cache.at < 20_000) return cache.body;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
    const { data } = await res.json();
    const body = {
      provider: "openrouter",
      limit: data.limit ?? null,
      remaining: data.limit_remaining ?? null,
      usage: data.usage ?? 0,
    };
    cache = { at: Date.now(), body };
    return body;
  } catch (e) {
    return { provider: "openrouter", error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Bandeau du bas : crédit de l'espace actif (s'il en a un) et, pour les admins, solde OpenRouter.
 */
export async function GET() {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  const b = SPACES[ctx.space].hasCredit ? await getBudget(ctx.space) : null;
  return NextResponse.json({
    space: ctx.space,
    credit: b ? { creditEur: b.creditEur, spentEur: b.spentEur, remainingEur: remaining(b) } : null,
    openrouter: ctx.session.admin ? await openRouter() : null,
  });
}
