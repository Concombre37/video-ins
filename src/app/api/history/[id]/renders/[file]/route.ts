import { promises as fs } from "node:fs";
import { renderPath } from "@/lib/history-store";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; file: string }> },
) {
  const { id, file } = await params;
  const p = renderPath(id, file);
  if (!p) return new Response("Introuvable", { status: 404 });
  let data: Buffer;
  try {
    data = await fs.readFile(p);
  } catch {
    return new Response("Introuvable", { status: 404 });
  }
  const download = new URL(req.url).searchParams.has("download");
  const headers: Record<string, string> = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=86400",
  };
  if (download) headers["Content-Disposition"] = `attachment; filename="short-${file}"`;

  // Requêtes Range (lecture/avance dans le lecteur vidéo, Safari en a besoin)
  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
    if (start > end || start >= data.length) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${data.length}` } });
    }
    return new Response(new Uint8Array(data.subarray(start, end + 1)), {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${data.length}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }
  return new Response(new Uint8Array(data), {
    headers: { ...headers, "Content-Length": String(data.length) },
  });
}
