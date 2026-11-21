import { requireContext } from "@/lib/auth";
import { fileResponse } from "@/lib/file-response";
import { posterPath } from "@/lib/media-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  const p = posterPath(ctx.space, (await params).id);
  if (!p) return new Response("Introuvable", { status: 404 });
  return fileResponse(req, p, "image/jpeg");
}
