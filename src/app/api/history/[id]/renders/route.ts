import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth";
import { getProject, saveRender } from "@/lib/history-store";

export const dynamic = "force-dynamic";

const MAX_BYTES = 300 * 1024 * 1024;

/** Reçoit le MP4 rendu dans le navigateur (corps brut video/mp4). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  if (!(await getProject(ctx.space, id))) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }
  const data = new Uint8Array(await req.arrayBuffer());
  if (data.length < 100 || data.length > MAX_BYTES) {
    return NextResponse.json({ error: "Fichier invalide" }, { status: 400 });
  }
  const file = await saveRender(ctx.space, id, data);
  return NextResponse.json({ file });
}
