import { NextResponse } from "next/server";
import {
  consumeNonce,
  safeReturn,
  SESSION_COOKIE,
  SESSION_DAYS,
  signSession,
  spacesOf,
  verifySsoToken,
  type Session,
} from "@/lib/auth";
import { isSpaceId } from "@/lib/spaces";

export const dynamic = "force-dynamic";

const page = (title: string, text: string, status: number) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0e0e17;color:#f4f4f8;font-family:system-ui,sans-serif">
<div style="max-width:460px;padding:32px;text-align:center"><img src="/hytlabs-logo.png" alt="HytLabs" style="height:32px"><h1 style="font-size:22px">${title}</h1>
<p style="color:#9a9ab3;line-height:1.5">${text}</p><p><a style="color:#9c8fff" href="/api/auth/login">Réessayer</a> · <a style="color:#9c8fff" href="https://hytlabs.com/">hytlabs.com</a></p></div>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

/** Retour du SSO : vérifie le jeton signé par hytlabs.com et ouvre la session du studio. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const t = verifySsoToken(url.searchParams.get("t"));
  if (!t || t.aud !== "video.hytlabs.com") {
    return page("Lien de connexion invalide", "Le lien a expiré ou a été modifié. Reconnecte-toi depuis hytlabs.com.", 401);
  }
  if (!consumeNonce(t.nonce, t.exp)) {
    return page("Lien déjà utilisé", "Ce lien de connexion a déjà servi. Reconnecte-toi depuis hytlabs.com.", 401);
  }
  const session: Session = {
    sub: String(t.sub),
    email: String(t.email ?? ""),
    name: String(t.name ?? t.email ?? "Utilisateur"),
    admin: t.admin === true,
    spaces: (Array.isArray(t.spaces) ? t.spaces : []).filter(isSpaceId),
    exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400,
  };
  if (spacesOf(session).length === 0) {
    return page(
      "Pas d'accès au studio",
      `Le compte ${session.email} n'a accès à aucun espace du studio vidéo. Demande l'accès à l'équipe HytLabs.`,
      403,
    );
  }
  const res = NextResponse.redirect(new URL(safeReturn(url.searchParams.get("return")), process.env.PUBLIC_URL ?? url.origin));
  res.cookies.set(SESSION_COOKIE, signSession(session), {
    httpOnly: true,
    secure: (process.env.PUBLIC_URL ?? url.origin).startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return res;
}
