import crypto from "node:crypto";
import { cookies } from "next/headers";
import { DEFAULT_SPACE, isSpaceId, SPACE_IDS, type SpaceId } from "./spaces";

/**
 * Sessions du studio (côté serveur uniquement).
 *
 * Connexion par le SSO de hytlabs.com : l'extension WordPress « hytlabs-studio-sso » signe un jeton court
 * (HMAC-SHA256, SSO_SECRET partagé, 2 minutes, nonce à usage unique) et redirige vers /api/auth/sso.
 * Le studio vérifie le jeton puis pose son propre cookie de session signé avec SESSION_SECRET.
 */
export const SESSION_COOKIE = "hs_session";
export const SPACE_COOKIE = "hs_space";
export const SESSION_DAYS = 7;

export interface Session {
  /** identifiant WordPress */
  sub: string;
  email: string;
  name: string;
  admin: boolean;
  /** espaces accordés sur hytlabs.com (ignoré pour un admin : il voit tout) */
  spaces: SpaceId[];
  /** expiration, secondes Unix */
  exp: number;
}

const b64url = (b: Uint8Array | string) => (typeof b === "string" ? Buffer.from(b, "utf8") : Buffer.from(b)).toString("base64url");

function secret(name: "SESSION_SECRET" | "SSO_SECRET") {
  const s = process.env[name];
  if (!s || s.length < 32) throw new Error(`${name} manquant ou trop court`);
  return s;
}

function hmac(key: string, data: string) {
  return new Uint8Array(crypto.createHmac("sha256", key).update(data).digest());
}

/** « payload.signature » en base64url */
export function signToken(payload: object, key: string) {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${b64url(hmac(key, body))}`;
}

export function verifyToken<T>(token: string | undefined | null, key: string): T | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = hmac(key, body);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !crypto.timingSafeEqual(new Uint8Array(given), new Uint8Array(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof data.exp !== "number" || data.exp < Date.now() / 1000) return null;
    return data as T;
  } catch {
    return null;
  }
}

export const signSession = (s: Session) => signToken(s, secret("SESSION_SECRET"));
export const verifySession = (t: string | undefined | null) => verifyToken<Session>(t, secret("SESSION_SECRET"));
export const verifySsoToken = (t: string | undefined | null) =>
  verifyToken<Omit<Session, "exp"> & { exp: number; nonce: string; aud: string }>(t, secret("SSO_SECRET"));

/** Nonces SSO déjà utilisés (anti-rejeu), gardés le temps de validité d'un jeton */
const usedNonces = new Map<string, number>();
export function consumeNonce(nonce: string, exp: number) {
  const now = Date.now() / 1000;
  for (const [n, e] of usedNonces) if (e < now) usedNonces.delete(n);
  if (!nonce || usedNonces.has(nonce)) return false;
  usedNonces.set(nonce, exp);
  return true;
}

export function spacesOf(s: Session): SpaceId[] {
  return s.admin ? [...SPACE_IDS] : SPACE_IDS.filter((id) => s.spaces.includes(id));
}

export async function getSession(): Promise<Session | null> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

export interface AuthContext {
  session: Session;
  space: SpaceId;
  spaces: SpaceId[];
}

/** Session + espace actif (cookie hs_space, sinon le premier espace autorisé). */
export async function getContext(): Promise<AuthContext | null> {
  const session = await getSession();
  if (!session) return null;
  const spaces = spacesOf(session);
  if (spaces.length === 0) return null;
  const wanted = (await cookies()).get(SPACE_COOKIE)?.value;
  const space = isSpaceId(wanted) && spaces.includes(wanted) ? wanted : spaces.includes(DEFAULT_SPACE) ? DEFAULT_SPACE : spaces[0];
  return { session, space, spaces };
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Pour les routes API : contexte ou réponse 401/403 à renvoyer telle quelle. */
export async function requireContext(opts: { admin?: boolean } = {}): Promise<AuthContext | Response> {
  const ctx = await getContext();
  if (!ctx) return json({ error: "Connexion requise" }, 401);
  if (opts.admin && !ctx.session.admin) return json({ error: "Réservé aux administrateurs" }, 403);
  return ctx;
}

/** Adresse du SSO WordPress (admin-post.php, jamais mis en cache) */
export function ssoLoginUrl(returnPath: string) {
  const base = process.env.SSO_URL ?? "https://hytlabs.com/wp-admin/admin-post.php";
  const u = new URL(base);
  u.searchParams.set("action", "hytlabs_studio_sso");
  u.searchParams.set("return", safeReturn(returnPath));
  return u.toString();
}

/** Chemin de retour local uniquement (pas d'URL externe ni « //hote ») */
export function safeReturn(p: string | null | undefined) {
  if (!p || !p.startsWith("/") || p.startsWith("//") || p.startsWith("/\\")) return "/";
  return p.slice(0, 500);
}
