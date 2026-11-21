import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth";
import { enqueueRetouch } from "@/lib/auto-retouch";
import { notifyStaff } from "@/lib/notify";
import { STATUS_LABEL, updateRequest, type RequestStatus } from "@/lib/requests-store";
import { SPACES } from "@/lib/spaces";

export const dynamic = "force-dynamic";

/** Répondre ({ text }) ; l'équipe peut aussi changer le statut ({ status }). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  const b = await req.json().catch(() => ({}));
  const status: RequestStatus | undefined =
    ctx.session.admin && typeof b.status === "string" && b.status in STATUS_LABEL ? b.status : undefined;
  const text = String(b.text ?? "").trim();
  const r = await updateRequest(ctx.space, (await params).id, {
    status,
    message: text ? { by: ctx.session.email, byName: ctx.session.name, staff: ctx.session.admin, text } : undefined,
  });
  if (!r) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  // le client précise ou relance : nouvelle retouche automatique ; l'équipe peut aussi la relancer ({ retry: true })
  if ((text && !ctx.session.admin) || (ctx.session.admin && b.retry === true)) {
    await enqueueRetouch(ctx.space, r.id);
  }
  if (text && !ctx.session.admin) {
    await notifyStaff(`💬 ${ctx.session.name} (${SPACES[ctx.space].name}) a répondu sur « ${r.target.title} » :\n${text}`);
  }
  return NextResponse.json(r);
}
