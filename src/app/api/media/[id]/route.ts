import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth";
import { deleteMedia, getMedia, updateMedia } from "@/lib/media-store";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: P) {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  const item = await getMedia(ctx.space, (await params).id);
  return item ? NextResponse.json(item) : NextResponse.json({ error: "Introuvable" }, { status: 404 });
}

/** Renommer / ranger ({ title, category }). */
export async function PATCH(req: Request, { params }: P) {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  const body = await req.json().catch(() => ({}));
  const item = await updateMedia(ctx.space, (await params).id, body);
  return item ? NextResponse.json(item) : NextResponse.json({ error: "Introuvable" }, { status: 404 });
}

/** Suppression : un admin, ou le client pour un fichier qu'il a lui-même envoyé. */
export async function DELETE(_req: Request, { params }: P) {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  const id = (await params).id;
  const item = await getMedia(ctx.space, id);
  if (!item) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const own = item.source === "envoi" && item.versions[0]?.by === ctx.session.email;
  if (!ctx.session.admin && !own) {
    return NextResponse.json({ error: "Seule l'équipe HytLabs peut supprimer ce fichier" }, { status: 403 });
  }
  await deleteMedia(ctx.space, id);
  return NextResponse.json({ ok: true });
}
