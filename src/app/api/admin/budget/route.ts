import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth";
import { addCredit } from "@/lib/budget-store";
import { isSpaceId, SPACES } from "@/lib/spaces";

export const dynamic = "force-dynamic";

/** Ajoute (ou retire, si négatif) du crédit à un espace : { space, eur, note } */
export async function POST(req: Request) {
  const ctx = await requireContext({ admin: true });
  if (ctx instanceof Response) return ctx;
  const b: { space?: unknown; eur?: unknown; note?: unknown } = await req.json().catch(() => ({}));
  const eur = Math.round(Number(b.eur) * 100) / 100;
  if (!isSpaceId(b.space) || !SPACES[b.space].hasCredit) return NextResponse.json({ error: "Espace invalide" }, { status: 400 });
  if (!eur || Math.abs(eur) > 10000) return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  const space = b.space;
  const budget = await addCredit(space, eur, ctx.session.email, b.note ? String(b.note).slice(0, 200) : undefined);
  return NextResponse.json(budget);
}
