import { promises as fs } from "node:fs";
import path from "node:path";
import {
  DEFAULT_FORMAT,
  DEFAULT_MUSIC,
  DEFAULT_VOLUME,
  type MusicChoice,
  type VideoFormat,
  musicLabel,
} from "./video-settings";

/**
 * Historique des vidéos, stocké sur disque (côté serveur uniquement).
 *   <espace>/projects/<id>.json   projet : prompts, code, réglages, photos produits
 *   <espace>/renders/<id>/<n>.mp4 rendus MP4 envoyés par le navigateur
 * (dossier de l'espace : voir space-data.ts)
 */
import { spaceDir } from "./space-data";
import type { SpaceId } from "./spaces";

export { DATA_DIR } from "./space-data";
const PROJECTS = (space: SpaceId) => path.join(spaceDir(space), "projects");
const RENDERS = (space: SpaceId) => path.join(spaceDir(space), "renders");

const ID_RE = /^[a-z0-9-]{8,64}$/;
const FILE_RE = /^[0-9]{10,16}\.mp4$/;

export function isValidId(id: string) {
  return ID_RE.test(id);
}
export function isValidRenderFile(file: string) {
  return FILE_RE.test(file);
}

export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  codeSnapshot?: string;
  model?: string;
  cost?: number;
  timestamp: number;
}

export interface Project {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  code: string;
  fps: number;
  durationInFrames: number;
  model?: string;
  messages: StoredMessage[];
  productImages: string[];
  format: VideoFormat;
  music: MusicChoice;
  volume: number;
  /** Coût total des générations du projet (USD) */
  totalCost: number;
}

export interface RenderInfo {
  file: string;
  size: number;
  createdAt: number;
}

export type ProjectSummary = Omit<Project, "code" | "messages" | "productImages" | "music"> & {
  prompts: number;
  renders: RenderInfo[];
  musicLabel: string;
};

export async function saveProject(space: SpaceId, p: Project) {
  if (!isValidId(p.id)) throw new Error("Identifiant invalide");
  await fs.mkdir(PROJECTS(space), { recursive: true });
  const existing = await getProject(space, p.id);
  const merged: Project = { ...p, createdAt: existing?.createdAt ?? p.createdAt };
  const target = path.join(PROJECTS(space), `${p.id}.json`);
  await fs.writeFile(`${target}.tmp`, JSON.stringify(merged));
  await fs.rename(`${target}.tmp`, target);
  return merged;
}

export async function getProject(space: SpaceId, id: string): Promise<Project | null> {
  if (!isValidId(id)) return null;
  try {
    const p = JSON.parse(await fs.readFile(path.join(PROJECTS(space), `${id}.json`), "utf8"));
    // valeurs par défaut pour les projets créés avant l'ajout de ces réglages
    return {
      format: DEFAULT_FORMAT,
      music: DEFAULT_MUSIC,
      volume: DEFAULT_VOLUME,
      totalCost: 0,
      ...p,
    } as Project;
  } catch {
    return null;
  }
}

export async function listRenders(space: SpaceId, id: string): Promise<RenderInfo[]> {
  if (!isValidId(id)) return [];
  try {
    const dir = path.join(RENDERS(space), id);
    const files = (await fs.readdir(dir)).filter(isValidRenderFile);
    const infos = await Promise.all(
      files.map(async (file) => {
        const st = await fs.stat(path.join(dir, file));
        return { file, size: st.size, createdAt: Number(file.replace(".mp4", "")) };
      }),
    );
    return infos.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function listProjects(space: SpaceId): Promise<ProjectSummary[]> {
  let files: string[] = [];
  try {
    files = (await fs.readdir(PROJECTS(space))).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const out: ProjectSummary[] = [];
  for (const f of files) {
    const p = await getProject(space, f.replace(".json", ""));
    if (!p) continue;
    out.push({
      id: p.id,
      title: p.title,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      fps: p.fps,
      durationInFrames: p.durationInFrames,
      model: p.model,
      format: p.format,
      volume: p.volume,
      totalCost: p.totalCost,
      prompts: p.messages.filter((m) => m.role === "user").length,
      renders: await listRenders(space, p.id),
      musicLabel: musicLabel(p.music),
    });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteProject(space: SpaceId, id: string) {
  if (!isValidId(id)) return;
  await fs.rm(path.join(PROJECTS(space), `${id}.json`), { force: true });
  await fs.rm(path.join(RENDERS(space), id), { recursive: true, force: true });
}

export async function saveRender(space: SpaceId, id: string, data: Uint8Array) {
  if (!isValidId(id)) throw new Error("Identifiant invalide");
  const dir = path.join(RENDERS(space), id);
  await fs.mkdir(dir, { recursive: true });
  const file = `${Date.now()}.mp4`;
  await fs.writeFile(path.join(dir, file), data);
  return file;
}

export function renderPath(space: SpaceId, id: string, file: string) {
  if (!isValidId(id) || !isValidRenderFile(file)) return null;
  return path.join(RENDERS(space), id, file);
}
