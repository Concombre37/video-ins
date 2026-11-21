import { NextResponse } from "next/server";
import { requireContext, SPACE_COOKIE } from "@/lib/auth";
import { getBudget, remaining } from "@/lib/budget-store";
import { listRequests } from "@/lib/requests-store";
import { isSpaceId, SPACES } from "@/lib/spaces";

export const dynamic = "force-dynamic";

/** Utilisateur connecté, espaces accessibles et espace actif. */
export async function GET() {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  const b = SPACES[ctx.space].hasCredit ? await getBudget(ctx.space) : null;
  const requests = await listRequests(ctx.space);
  // pastille du menu Retouches : nouveautés pour le client, demandes ouvertes pour l'équipe
  const badge = ctx.session.admin
    ? requests.filter((r) => r.status === "nouvelle").length
    : requests.filter((r) => r.clientUnread).length;
  return NextResponse.json({
    badge,
    user: { name: ctx.session.name, email: ctx.session.email, admin: ctx.session.admin },
    space: ctx.space,
    spaces: ctx.spaces.map((id) => SPACES[id]),
    credit: b ? { creditEur: b.creditEur, spentEur: b.spentEur, remainingEur: remaining(b) } : null,
  });
}

/** Change d'espace actif ({ space }). */
export async function POST(req: Request) {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  const { space } = await req.json().catch(() => ({}));
  if (!isSpaceId(space) || !ctx.spaces.includes(space)) {
    return NextResponse.json({ error: "Espace non autorisé" }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true, space });
  res.cookies.set(SPACE_COOKIE, space, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 365 * 86400 });
  return res;
}
