import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readJson, withLock, writeJson } from "./json-file";
import { spaceDir } from "./space-data";
import type { SpaceId } from "./spaces";

/**
 * Médiathèque d'un espace : vidéos, images et sons livrés au client (ou envoyés par lui).
 *   <espace>/media/<id>/meta.json      fiche (titre, type, versions…)
 *   <espace>/media/<id>/v<n>.<ext>     chaque version du fichier (une retouche livrée = nouvelle version)
 *   <espace>/media/<id>/poster.jpg     image d'aperçu (facultative)
 * Les vidéos créées dans le studio restent dans les projets (history-store) ; la page Médiathèque
 * affiche les deux.
 */
export type MediaKind = "video" | "image" | "audio";

export interface MediaVersion {
  n: number;
  file: string;
  size: number;
  createdAt: number;
  by: string;
  note?: string;
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
};

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
  if (!t) throw new Error("Type de fichier non accepté (vidéo MP4/WebM/MOV, image JPG/PNG/WebP, son MP3/WAV)");
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
  input: { fileName: string; data: Uint8Array; by: string; note?: string },
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
    item.versions.push({ n, file, size: input.data.length, createdAt: now, by: input.by, note: input.note?.slice(0, 500) });
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

export function posterPath(space: SpaceId, id: string) {
  return ID_RE.test(id) ? path.join(dir(space, id), "poster.jpg") : null;
}
