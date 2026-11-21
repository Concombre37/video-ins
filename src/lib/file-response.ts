import { promises as fs } from "node:fs";

/** Réponse fichier avec prise en charge des requêtes Range (lecteurs vidéo, Safari). */
export async function fileResponse(
  req: Request,
  filePath: string,
  contentType: string,
  downloadName?: string,
): Promise<Response> {
  let data: Buffer;
  try {
    data = await fs.readFile(filePath);
  } catch {
    return new Response("Introuvable", { status: 404 });
  }
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  };
  // un SVG ouvert directement ne doit jamais pouvoir exécuter de script sur le domaine du studio
  if (contentType === "image/svg+xml") headers["Content-Security-Policy"] = "sandbox; default-src 'none'; style-src 'unsafe-inline'";
  // tout ce qui n'est ni média ni PDF est seulement téléchargé
  if (!downloadName && !/^(video|image|audio)\/|^application\/pdf$|^font\//.test(contentType)) downloadName = "fichier";
  if (downloadName) {
    headers["Content-Disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`;
  }
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
  return new Response(new Uint8Array(data), { headers: { ...headers, "Content-Length": String(data.length) } });
}
