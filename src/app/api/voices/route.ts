import { NextResponse } from "next/server";
import { voicePreviews } from "@/lib/audio-ai";
import { requireContext } from "@/lib/auth";
import { VOICES } from "@/lib/voices";

export const dynamic = "force-dynamic";

/** Voix off proposées, avec leur extrait d'écoute gratuit (ElevenLabs). */
export async function GET() {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  const previews = await voicePreviews();
  return NextResponse.json(VOICES.map((v) => ({ ...v, preview: previews[v.id] ?? null })));
}
