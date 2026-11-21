import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth";
import { markSeen } from "@/lib/requests-store";

export const dynamic = "force-dynamic";

/** Le client a lu ses retouches (efface la pastille du menu). */
export async function POST() {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  if (!ctx.session.admin) await markSeen(ctx.space);
  return NextResponse.json({ ok: true });
}
