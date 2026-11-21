import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { tts } from "@/lib/audio-ai";
import { requireContext } from "@/lib/auth";
import { canSpend, charge } from "@/lib/budget-store";
import { isVoiceId, MAX_TTS_CHARS } from "@/lib/voices";

export const dynamic = "force-dynamic";

/**
 * Écoute du texte du client avec la voix choisie : { voiceId, text, speed } → MP3.
 * Gardé en cache : la retouche réutilise ce fichier sans repayer la synthèse.
 */
export async function POST(req: Request) {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  const b = await req.json().catch(() => ({}));
  const text = String(b.text ?? "").trim();
  const speed = Math.min(1.2, Math.max(0.7, Number(b.speed) || 1));
  if (!isVoiceId(b.voiceId)) return NextResponse.json({ error: "Voix inconnue" }, { status: 400 });
  if (text.length < 2 || text.length > MAX_TTS_CHARS) return NextResponse.json({ error: `Texte de 2 à ${MAX_TTS_CHARS} caractères` }, { status: 400 });
  if (!(await canSpend(ctx.space))) return NextResponse.json({ error: "Crédit épuisé" }, { status: 402 });
  try {
    const t = await tts(b.voiceId, text, speed);
    if (t.cost > 0) await charge(ctx.space, t.cost, { kind: "retouche", by: ctx.session.email, note: "Écoute de voix off" });
    return new Response(new Uint8Array(await fs.readFile(t.file)), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
