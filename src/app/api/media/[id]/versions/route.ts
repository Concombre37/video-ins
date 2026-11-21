import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth";
import { addVersion, MAX_UPLOAD } from "@/lib/media-store";
import { notifyClient } from "@/lib/notify";
import { updateRequest } from "@/lib/requests-store";

export const dynamic = "force-dynamic";

/**
 * Livre une nouvelle version d'un média (équipe HytLabs). Formulaire : file, note, request (facultatif :
 * la demande de retouche correspondante passe alors en « Livrée » avec la note en réponse).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext({ admin: true });
  if (ctx instanceof Response) return ctx;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size < 10) return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
  if (file.size > MAX_UPLOAD) return NextResponse.json({ error: "Fichier trop gros (400 Mo maximum)" }, { status: 413 });
  const note = String(form?.get("note") || "");
  try {
    const item = await addVersion(ctx.space, (await params).id, {
      fileName: file.name,
      data: new Uint8Array(await file.arrayBuffer()),
      by: ctx.session.email,
      note,
    });
    const requestId = String(form?.get("request") || "");
    if (requestId) {
      const v = item.versions[item.versions.length - 1].n;
      const r = await updateRequest(ctx.space, requestId, {
        status: "livree",
        message: {
          by: ctx.session.email,
          byName: ctx.session.name,
          staff: true,
          text: `Version ${v} livrée dans la médiathèque.${note ? `\n${note}` : ""}`,
        },
      });
      if (r?.notify) {
        await notifyClient(
          r.by,
          "Ta retouche vidéo est prête",
          [`Bonjour ${r.byName},`, `La retouche demandée sur « ${r.target.title} » est livrée : version ${v} dans la médiathèque.`, note].filter(Boolean),
          { label: "Voir la retouche", url: "https://video.hytlabs.com/requests" },
        );
      }
    }
    return NextResponse.json(item);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
