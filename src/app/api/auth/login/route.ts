import { NextResponse } from "next/server";
import { safeReturn, ssoLoginUrl } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Envoie vers le SSO de hytlabs.com (connexion WordPress), qui revient sur /api/auth/sso. */
export async function GET(req: Request) {
  const ret = safeReturn(new URL(req.url).searchParams.get("return"));
  return NextResponse.redirect(ssoLoginUrl(ret));
}
