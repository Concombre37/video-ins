import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth";
import { getProject } from "@/lib/history-store";
import { getMedia } from "@/lib/media-store";
import { enqueueRetouch } from "@/lib/auto-retouch";
import { notifyStaff } from "@/lib/notify";
import { createRequest, listRequests } from "@/lib/requests-store";
import { SPACES } from "@/lib/spaces";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  return NextResponse.json(await listRequests(ctx.space));
}

/** Nouvelle demande de retouche : { targetType: "media"|"project", targetId, text, timecode } */
export async function POST(req: Request) {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  const b = await req.json().catch(() => ({}));
  const text = String(b.text ?? "").trim();
  if (text.length < 3) return NextResponse.json({ error: "Décris la retouche souhaitée" }, { status: 400 });
  let title: string | null = null;
  if (b.targetType === "media") title = (await getMedia(ctx.space, String(b.targetId)))?.title ?? null;
  else if (b.targetType === "project") title = (await getProject(ctx.space, String(b.targetId)))?.title ?? null;
  if (!title) return NextResponse.json({ error: "Vidéo introuvable" }, { status: 404 });
  const r = await createRequest(ctx.space, {
    target: { type: b.targetType, id: String(b.targetId), title },
    timecode: b.timecode ? String(b.timecode) : undefined,
    text,
    by: ctx.session.email,
    byName: ctx.session.name,
    staff: ctx.session.admin,
  });
  // retouche automatique (IA + rendu) lancée tout de suite
  await enqueueRetouch(ctx.space, r.id);
  if (!ctx.session.admin) {
    await notifyStaff(
      `🎬 Nouvelle demande de retouche (${SPACES[ctx.space].name}) par ${ctx.session.name}\n« ${title} »${r.timecode ? ` à ${r.timecode}` : ""}\n${text}\nhttps://video.hytlabs.com/requests`,
    );
  }
  return NextResponse.json(r);
}
