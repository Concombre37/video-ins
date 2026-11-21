import { NextResponse } from "next/server";
import { SESSION_COOKIE, SPACE_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Ferme la session du studio (la session hytlabs.com reste ouverte). */
export async function GET() {
  const res = NextResponse.redirect("https://hytlabs.com/");
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(SPACE_COOKIE);
  return res;
}
