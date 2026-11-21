import { requireContext } from "@/lib/auth";
import { fileResponse } from "@/lib/file-response";
import { renderPath } from "@/lib/history-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  const { id, file } = await params;
  const p = renderPath(ctx.space, id, file);
  if (!p) return new Response("Introuvable", { status: 404 });
  const download = new URL(req.url).searchParams.has("download");
  return fileResponse(req, p, "video/mp4", download ? `video-${file}` : undefined);
}
