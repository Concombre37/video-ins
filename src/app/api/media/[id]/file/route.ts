import { requireContext } from "@/lib/auth";
import { fileResponse } from "@/lib/file-response";
import { extOf, getMedia, mediaFilePath } from "@/lib/media-store";

export const dynamic = "force-dynamic";

/** Fichier d'un média : ?v=<n> pour une version précise, ?download pour l'enregistrer. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  const item = await getMedia(ctx.space, (await params).id);
  if (!item) return new Response("Introuvable", { status: 404 });
  const q = new URL(req.url).searchParams;
  const f = mediaFilePath(ctx.space, item, Number(q.get("v")) || undefined);
  if (!f) return new Response("Introuvable", { status: 404 });
  const safe = item.title.replace(/[^\p{L}\p{N} _.-]+/gu, "").trim().slice(0, 80) || "media";
  const name = `${safe}${item.versions.length > 1 ? ` v${f.version.n}` : ""}.${extOf(f.version.file)}`;
  return fileResponse(req, f.path, f.type, q.has("download") ? name : undefined);
}
