import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth";
import { fileResponse } from "@/lib/file-response";
import { deleteSource, getMedia, sourcePath, sourceTypeOf } from "@/lib/media-store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; name: string }> };

/** Fichier source d'un média (lecture dans le navigateur pour les sons et images, ?download pour l'enregistrer). */
export async function GET(req: Request, { params }: Params) {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  const { id, name } = await params;
  const item = await getMedia(ctx.space, id);
  const src = item?.sources?.find((s) => s.name === name);
  const p = src ? sourcePath(ctx.space, id, name) : null;
  if (!item || !src || !p) return new Response("Introuvable", { status: 404 });
  const type = sourceTypeOf(name);
  const inline = /^(video|image|audio)\/|^font\//.test(type) && !new URL(req.url).searchParams.has("download");
  return fileResponse(req, p, type, inline ? undefined : name);
}

export async function DELETE(_req: Request, { params }: Params) {
  const ctx = await requireContext({ admin: true });
  if (ctx instanceof Response) return ctx;
  const { id, name } = await params;
  await deleteSource(ctx.space, id, name);
  return NextResponse.json(await getMedia(ctx.space, id));
}
