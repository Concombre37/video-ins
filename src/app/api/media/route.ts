import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth";
import { createMedia, listMedia, MAX_UPLOAD } from "@/lib/media-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  return NextResponse.json(await listMedia(ctx.space));
}

/** Ajoute un fichier à la médiathèque (formulaire : file, title, category). */
export async function POST(req: Request) {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size < 10) {
    return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD) return NextResponse.json({ error: "Fichier trop gros (400 Mo maximum)" }, { status: 413 });
  try {
    const item = await createMedia(ctx.space, {
      title: String(form?.get("title") || file.name.replace(/\.[^.]+$/, "")),
      category: String(form?.get("category") || "") || undefined,
      fileName: file.name,
      data: new Uint8Array(await file.arrayBuffer()),
      by: ctx.session.email,
      source: ctx.session.admin ? "livraison" : "envoi",
    });
    return NextResponse.json(item);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
