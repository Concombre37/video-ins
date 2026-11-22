import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readJson, withLock, writeJson } from "./json-file";
import { spaceDir } from "./space-data";
import type { SourceRole } from "./source-roles";
import type { SpaceId } from "./spaces";

/**
 * Médiathèque d'un espace : vidéos, images et sons livrés au client (ou envoyés par lui).
 *   <espace>/media/<id>/meta.json      fiche (titre, type, versions…)
 *   <espace>/media/<id>/v<n>.<ext>     chaque version du fichier (une retouche livrée = nouvelle version)
 *   <espace>/media/<id>/poster.jpg     image d'aperçu (facultative)
 *   <espace>/media/<id>/sources/<nom>  fichiers source de la vidéo (projet de montage, plaque sans texte,
 *                                      pistes séparées : musique, voix off, bruitages…)
 * Les vidéos créées dans le studio restent dans les projets (history-store) ; la page Médiathèque
 * affiche les deux.
 */
export type MediaKind = "video" | "image" | "audio" | "document" | "font" | "fichier";

/**
 * Pistes séparées d'une version (noms de fichiers source, chacune à la durée exacte de la vidéo et calée
 * sur elle). Les retouches musique / voix off remplacent alors vraiment une piste au lieu de s'empiler.
 */
export interface VersionStems {
  music?: string;
  voice?: string;
  sfx?: string;
}

export interface MediaVersion {
  n: number;
  file: string;
  size: number;
  createdAt: number;
  by: string;
  note?: string;
  stems?: VersionStems;
}

export { SOURCE_ROLE_LABEL, type SourceRole } from "./source-roles";

export interface MediaSourceFile {
  /** nom du fichier dans sources/ (sert d'identifiant) */
  name: string;
  label: string;
  role: SourceRole;
  size: number;
  createdAt: number;
  /** piste interne aux retouches (pistes séparées générées) : cachée de la liste par défaut */
  internal?: boolean;
}

export interface MediaItem {
  id: string;
  title: string;
  kind: MediaKind;
  /** ex. « 9:16 », « 1080×1920 » (renseigné à l'import) */
  format?: string;
  durationSec?: number;
  category?: string;
  source: "livraison" | "envoi";
  createdAt: number;
  updatedAt: number;
  versions: MediaVersion[];
  hasPoster: boolean;
  /** copie légère (MP4 H.264 1080p) pour lire dans le navigateur les originaux lourds (4K, HEVC…) */
  hasPreview?: boolean;
  /** fichiers source (dossier sources/) */
  sources?: MediaSourceFile[];
}

const EXT: Record<string, { kind: MediaKind; type: string }> = {
  mp4: { kind: "video", type: "video/mp4" },
  webm: { kind: "video", type: "video/webm" },
  mov: { kind: "video", type: "video/quicktime" },
  jpg: { kind: "image", type: "image/jpeg" },
  jpeg: { kind: "image", type: "image/jpeg" },
  png: { kind: "image", type: "image/png" },
  webp: { kind: "image", type: "image/webp" },
  mp3: { kind: "audio", type: "audio/mpeg" },
  wav: { kind: "audio", type: "audio/wav" },
  svg: { kind: "image", type: "image/svg+xml" },
  pdf: { kind: "document", type: "application/pdf" },
  ttf: { kind: "font", type: "font/ttf" },
  otf: { kind: "font", type: "font/otf" },
  woff: { kind: "font", type: "font/woff" },
  woff2: { kind: "font", type: "font/woff2" },
  ai: { kind: "fichier", type: "application/postscript" },
  eps: { kind: "fichier", type: "application/postscript" },
  zip: { kind: "fichier", type: "application/zip" },
  m4a: { kind: "audio", type: "audio/mp4" },
};
const SOURCE_TYPES: Record<string, string> = { tsx: "text/plain; charset=utf-8", ts: "text/plain; charset=utf-8", py: "text/plain; charset=utf-8", md: "text/plain; charset=utf-8", txt: "text/plain; charset=utf-8", json: "application/json" };
export const sourceTypeOf = (name: string) => typeOfExt(extOf(name))?.type ?? SOURCE_TYPES[extOf(name)] ?? "application/octet-stream";
const SOURCE_RE = /^[a-z0-9][a-z0-9._-]{0,100}$/;

export const MAX_UPLOAD = 400 * 1024 * 1024;
const ID_RE = /^[a-z0-9-]{6,64}$/;
const FILE_RE = /^v[0-9]{1,4}\.[a-z0-9]{2,5}$/;

export const extOf = (name: string) => path.extname(name).slice(1).toLowerCase();
export const typeOfExt = (ext: string) => EXT[ext];

const root = (space: SpaceId) => path.join(spaceDir(space), "media");
const dir = (space: SpaceId, id: string) => path.join(root(space), id);
const metaFile = (space: SpaceId, id: string) => path.join(dir(space, id), "meta.json");

export async function getMedia(space: SpaceId, id: string): Promise<MediaItem | null> {
  if (!ID_RE.test(id)) return null;
  return readJson<MediaItem | null>(metaFile(space, id), null);
}

export async function listMedia(space: SpaceId): Promise<MediaItem[]> {
  let ids: string[] = [];
  try {
    ids = await fs.readdir(root(space));
  } catch {
    return [];
  }
  const items = await Promise.all(ids.filter((i) => ID_RE.test(i)).map((i) => getMedia(space, i)));
  return items.filter((i): i is MediaItem => !!i).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Nouveau média à partir d'un fichier reçu. */
export async function createMedia(
  space: SpaceId,
  input: { title: string; fileName: string; data: Uint8Array; by: string; source: MediaItem["source"]; category?: string; format?: string },
): Promise<MediaItem> {
  const ext = extOf(input.fileName);
  const t = typeOfExt(ext);
  if (!t) throw new Error("Type de fichier non accepté (vidéo, image, son, PDF, police, AI/EPS, ZIP)");
  const id = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
  await fs.mkdir(dir(space, id), { recursive: true });
  const file = `v1.${ext}`;
  await fs.writeFile(path.join(dir(space, id), file), input.data);
  const now = Date.now();
  const item: MediaItem = {
    id,
    title: input.title.slice(0, 200) || input.fileName,
    kind: t.kind,
    format: input.format,
    category: input.category,
    source: input.source,
    createdAt: now,
    updatedAt: now,
    versions: [{ n: 1, file, size: input.data.length, createdAt: now, by: input.by }],
    hasPoster: false,
  };
  await writeJson(metaFile(space, id), item);
  return item;
}

/** Ajoute une version (retouche livrée). */
export async function addVersion(
  space: SpaceId,
  id: string,
  input: { fileName: string; data: Uint8Array; by: string; note?: string; stems?: VersionStems },
) {
  return withLock(metaFile(space, id), async () => {
    const item = await getMedia(space, id);
    if (!item) throw new Error("Média introuvable");
    const ext = extOf(input.fileName);
    if (!typeOfExt(ext)) throw new Error("Type de fichier non accepté");
    const n = Math.max(...item.versions.map((v) => v.n)) + 1;
    const file = `v${n}.${ext}`;
    await fs.writeFile(path.join(dir(space, id), file), input.data);
    const now = Date.now();
    item.versions.push({ n, file, size: input.data.length, createdAt: now, by: input.by, note: input.note?.slice(0, 500), stems: input.stems });
    item.updatedAt = now;
    await writeJson(metaFile(space, id), item);
    return item;
  });
}

export async function updateMedia(space: SpaceId, id: string, patch: { title?: string; category?: string }) {
  return withLock(metaFile(space, id), async () => {
    const item = await getMedia(space, id);
    if (!item) return null;
    if (patch.title !== undefined) item.title = String(patch.title).slice(0, 200) || item.title;
    if (patch.category !== undefined) item.category = String(patch.category).slice(0, 60) || undefined;
    await writeJson(metaFile(space, id), item);
    return item;
  });
}

export async function deleteMedia(space: SpaceId, id: string) {
  if (!ID_RE.test(id)) return;
  await fs.rm(dir(space, id), { recursive: true, force: true });
}

/** Chemin d'une version (la dernière si n absent) ou de l'aperçu. */
export function mediaFilePath(space: SpaceId, item: MediaItem, n?: number) {
  const v = n ? item.versions.find((x) => x.n === n) : item.versions[item.versions.length - 1];
  if (!v || !FILE_RE.test(v.file)) return null;
  return { path: path.join(dir(space, item.id), v.file), version: v, type: typeOfExt(extOf(v.file))?.type ?? "application/octet-stream" };
}

export function previewPath(space: SpaceId, id: string) {
  return ID_RE.test(id) ? path.join(dir(space, id), "preview.mp4") : null;
}

export function posterPath(space: SpaceId, id: string) {
  return ID_RE.test(id) ? path.join(dir(space, id), "poster.jpg") : null;
}

/* ── Fichiers source ───────────────────────────────────────────── */

export function sourcePath(space: SpaceId, id: string, name: string) {
  return ID_RE.test(id) && SOURCE_RE.test(name) && !name.includes("..") ? path.join(dir(space, id), "sources", name) : null;
}

/** Ajoute (ou remplace) un fichier source. `data` ou `from` (chemin local, lien dur si possible). */
export async function putSource(
  space: SpaceId,
  id: string,
  input: { name: string; label: string; role: SourceRole; data?: Uint8Array; from?: string; internal?: boolean },
) {
  const p = sourcePath(space, id, input.name);
  if (!p) throw new Error("Nom de fichier source invalide");
  return withLock(metaFile(space, id), async () => {
    const item = await getMedia(space, id);
    if (!item) throw new Error("Média introuvable");
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.rm(p, { force: true });
    if (input.data) await fs.writeFile(p, input.data);
    else if (input.from) await fs.link(input.from, p).catch(() => fs.copyFile(input.from!, p));
    else throw new Error("Fichier source vide");
    const size = (await fs.stat(p)).size;
    const entry: MediaSourceFile = { name: input.name, label: input.label.slice(0, 200), role: input.role, size, createdAt: Date.now(), internal: input.internal || undefined };
    item.sources = [...(item.sources ?? []).filter((x) => x.name !== input.name), entry];
    await writeJson(metaFile(space, id), item);
    return entry;
  });
}

export async function deleteSource(space: SpaceId, id: string, name: string) {
  const p = sourcePath(space, id, name);
  if (!p) return;
  await withLock(metaFile(space, id), async () => {
    const item = await getMedia(space, id);
    if (!item) return;
    item.sources = (item.sources ?? []).filter((x) => x.name !== name);
    await fs.rm(p, { force: true });
    await writeJson(metaFile(space, id), item);
  });
}
