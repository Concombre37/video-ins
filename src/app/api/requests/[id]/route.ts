import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth";
import { enqueueRetouch } from "@/lib/auto-retouch";
import { notifyClient, notifyStaff } from "@/lib/notify";
import { getRequest, STATUS_LABEL, updateRequest, type RequestStatus } from "@/lib/requests-store";
import { SPACES } from "@/lib/spaces";

export const dynamic = "force-dynamic";

/**
 * Répondre ({ text }) ; l'équipe peut aussi changer le statut ({ status }) ou relancer ({ retry: true }) ;
 * le demandeur (ou l'équipe) active ou coupe les emails ({ notify }).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  const id = (await params).id;
  const b = await req.json().catch(() => ({}));
  const before = await getRequest(ctx.space, id);
  if (!before) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  const status: RequestStatus | undefined =
    ctx.session.admin && typeof b.status === "string" && b.status in STATUS_LABEL ? b.status : undefined;
  const notify = typeof b.notify === "boolean" && (ctx.session.admin || before.by === ctx.session.email) ? b.notify : undefined;
  const text = String(b.text ?? "").trim();
  const r = await updateRequest(ctx.space, id, {
    status,
    notify,
    message: text ? { by: ctx.session.email, byName: ctx.session.name, staff: ctx.session.admin, text } : undefined,
  });
  if (!r) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  // le client précise une retouche visuelle : l'IA relance ; l'équipe peut relancer n'importe quelle demande.
  // (musique / voix off : les réglages sont fixés, une précision du client part à l'équipe)
  const visual = (r.kind ?? "visuel") === "visuel";
  if ((text && !ctx.session.admin && visual) || (ctx.session.admin && b.retry === true)) {
    await enqueueRetouch(ctx.space, r.id);
  }
  if (text && !ctx.session.admin) {
    await notifyStaff(`💬 ${ctx.session.name} (${SPACES[ctx.space].name}) a répondu sur « ${r.target.title} » :\n${text}`);
  }
  if (text && ctx.session.admin && r.notify && r.by !== ctx.session.email) {
    await notifyClient(
      r.by,
      "Nouvelle réponse sur ta retouche",
      [`Bonjour ${r.byName},`, `L'équipe HytLabs a répondu sur « ${r.target.title} » :`, text],
      { label: "Voir la demande", url: "https://video.hytlabs.com/requests" },
    );
  }
  return NextResponse.json(r);
}
