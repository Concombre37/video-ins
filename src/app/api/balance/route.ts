import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

let cache: { at: number; body: unknown } | null = null;

/** Solde restant de la clé OpenRouter (mis en cache 20 s). */
export async function GET() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return NextResponse.json({ provider: "anthropic" });
  if (cache && Date.now() - cache.at < 20_000) return NextResponse.json(cache.body);
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
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json(
      { provider: "openrouter", error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
