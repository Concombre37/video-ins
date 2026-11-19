/**
 * Réglages vidéo partagés entre l'interface, l'API de génération et le rendu.
 */

export const FORMATS = {
  "9:16": {
    width: 1080,
    height: 1920,
    label: "Vertical 9:16",
    hint: "Reels, TikTok, Shorts",
  },
  "1:1": {
    width: 1080,
    height: 1080,
    label: "Carré 1:1",
    hint: "Post Instagram / Facebook",
  },
  "16:9": {
    width: 1920,
    height: 1080,
    label: "Paysage 16:9",
    hint: "YouTube, site web",
  },
} as const;

export type VideoFormat = keyof typeof FORMATS;
export const FORMAT_IDS = Object.keys(FORMATS) as VideoFormat[];
export const DEFAULT_FORMAT: VideoFormat = "9:16";

export function isVideoFormat(v: unknown): v is VideoFormat {
  return typeof v === "string" && v in FORMATS;
}

/** Durées proposées (secondes). */
export const DURATIONS = [6, 10, 15, 20, 30] as const;
export const DEFAULT_SECONDS = 10;
export const DEFAULT_FPS = 30;

export function clampSeconds(s: number) {
  if (!Number.isFinite(s)) return DEFAULT_SECONDS;
  return Math.min(60, Math.max(3, Math.round(s * 2) / 2));
}

/** Musiques fournies (composées pour l'outil, libres de droits). */
export const MUSIC_TRACKS = [
  { id: "energique", label: "Énergique", hint: "électro 128 BPM, promo / soldes", src: "/music/energique.mp3" },
  { id: "gaming", label: "Gaming", hint: "arpèges rapides 140 BPM", src: "/music/gaming.mp3" },
  { id: "epique", label: "Épique", hint: "cinématique, annonce", src: "/music/epique.mp3" },
  { id: "chill", label: "Chill", hint: "lo-fi 90 BPM, ambiance calme", src: "/music/chill.mp3" },
] as const;

export type MusicTrackId = (typeof MUSIC_TRACKS)[number]["id"];

/**
 * Musique d'un projet : aucune, une piste fournie, ou un fichier importé
 * (data URL, gardée dans le projet).
 */
export type MusicChoice =
  | { kind: "none" }
  | { kind: "track"; id: MusicTrackId }
  | { kind: "custom"; name: string; dataUrl: string };

export const DEFAULT_MUSIC: MusicChoice = { kind: "track", id: "energique" };
export const DEFAULT_VOLUME = 0.6;

export function musicSrc(m: MusicChoice | null | undefined): string | null {
  if (!m || m.kind === "none") return null;
  if (m.kind === "custom") return m.dataUrl;
  return MUSIC_TRACKS.find((t) => t.id === m.id)?.src ?? null;
}

export function musicLabel(m: MusicChoice | null | undefined): string {
  if (!m || m.kind === "none") return "Sans musique";
  if (m.kind === "custom") return m.name;
  return MUSIC_TRACKS.find((t) => t.id === m.id)?.label ?? "Musique";
}

export function parseMusic(v: unknown): MusicChoice {
  if (!v || typeof v !== "object") return DEFAULT_MUSIC;
  const m = v as Record<string, unknown>;
  if (m.kind === "none") return { kind: "none" };
  if (m.kind === "track" && MUSIC_TRACKS.some((t) => t.id === m.id)) {
    return { kind: "track", id: m.id as MusicTrackId };
  }
  if (m.kind === "custom" && typeof m.dataUrl === "string" && m.dataUrl.startsWith("data:audio/")) {
    return { kind: "custom", name: String(m.name ?? "Ma musique").slice(0, 80), dataUrl: m.dataUrl };
  }
  return DEFAULT_MUSIC;
}

/** Taille max d'une musique importée (avant encodage base64). */
export const MAX_CUSTOM_MUSIC_BYTES = 8 * 1024 * 1024;

export const usd = (n: number) =>
  n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: n > 0 && n < 0.01 ? 4 : 2,
    maximumFractionDigits: n > 0 && n < 0.01 ? 4 : 2,
  });
