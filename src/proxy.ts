import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

/**
 * Tout le studio demande une session (SSO hytlabs.com), sauf les routes de connexion
 * et les fichiers techniques de Next.
 */
export function proxy(req: NextRequest) {
  const session = verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }
  const login = new URL("/api/auth/login", process.env.PUBLIC_URL ?? req.url);
  login.searchParams.set("return", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!api/auth/|_next/static|_next/image|favicon.ico|hytlabs-symbol.svg|hytlabs-logo.png).*)"],
};
