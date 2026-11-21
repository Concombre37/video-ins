import crypto from "node:crypto";
import path from "node:path";
import { readJson, withLock, writeJson } from "./json-file";
import { spaceDir } from "./space-data";
import type { SpaceId } from "./spaces";

/**
 * Demandes de retouche d'un espace (<espace>/requests.json).
 * Le client décrit ce qu'il veut changer sur une vidéo de la médiathèque ou du studio ;
 * l'équipe HytLabs répond, change le statut et livre une nouvelle version du média.
 */
export type RequestStatus = "nouvelle" | "en_cours" | "livree" | "fermee";
export const STATUS_LABEL: Record<RequestStatus, string> = {
  nouvelle: "Nouvelle",
  en_cours: "En cours",
  livree: "Livrée",
  fermee: "Fermée",
};

export interface RequestMessage {
  at: number;
  by: string;
  byName: string;
  staff: boolean;
  text: string;
}

/** Suivi de la retouche automatique (IA + rendu serveur) */
export interface AiJob {
  state: "en_attente" | "en_cours" | "terminee" | "echec";
  step?: string;
  progress?: number;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
  /** version de média ou fichier de rendu livré */
  delivered?: string;
}

/** Type de retouche : visuelle (IA + rendu), musique seule ou voix off seule (traitées sans IA de code). */
export type RequestKind = "visuel" | "musique" | "voix";
export const KIND_LABEL: Record<RequestKind, string> = { visuel: "Visuel", musique: "Musique", voix: "Voix off" };

export type MusicSpec =
  | { source: "track"; id: string }
  | { source: "media"; mediaId: string; title?: string }
  | { source: "ia"; prompt: string };

export interface AudioSpec {
  /** version du média à partir de laquelle travailler (dernière si absent) */
  baseVersion?: number;
  music?: { pick: MusicSpec; mode: "remplacer" | "mixer"; volume: number };
  voice?: { text: string; voiceId: string; speed: number; start: "debut" | "fin" | number; duck: boolean; volume: number };
}

export interface RetouchRequest {
  id: string;
  kind?: RequestKind;
  audio?: AudioSpec;
  /** emails à chaque nouveauté (livraison, réponse de l'équipe) : non par défaut */
  notify?: boolean;
  target: { type: "media" | "project"; id: string; title: string };
  /** instant de la vidéo concerné, ex. « 0:52 » */
  timecode?: string;
  status: RequestStatus;
  createdAt: number;
  updatedAt: number;
  by: string;
  byName: string;
  messages: RequestMessage[];
  ai?: AiJob;
  /** le client a du nouveau à lire (réponse ou livraison) */
  clientUnread?: boolean;
}

const file = (space: SpaceId) => path.join(spaceDir(space), "requests.json");

export async function listRequests(space: SpaceId): Promise<RetouchRequest[]> {
  const list = await readJson<RetouchRequest[]>(file(space), []);
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createRequest(
  space: SpaceId,
  input: {
    target: RetouchRequest["target"];
    timecode?: string;
    text: string;
    by: string;
    byName: string;
    staff: boolean;
    kind: RequestKind;
    audio?: AudioSpec;
    notify: boolean;
  },
) {
  return withLock(file(space), async () => {
    const list = await readJson<RetouchRequest[]>(file(space), []);
    const now = Date.now();
    const r: RetouchRequest = {
      id: `${now.toString(36)}-${crypto.randomBytes(3).toString("hex")}`,
      kind: input.kind,
      audio: input.audio,
      notify: input.notify,
      target: { ...input.target, title: input.target.title.slice(0, 200) },
      timecode: input.timecode?.slice(0, 40) || undefined,
      status: "nouvelle",
      createdAt: now,
      updatedAt: now,
      by: input.by,
      byName: input.byName,
      messages: [{ at: now, by: input.by, byName: input.byName, staff: input.staff, text: input.text.slice(0, 4000) }],
    };
    list.push(r);
    await writeJson(file(space), list);
    return r;
  });
}

export async function getRequest(space: SpaceId, id: string) {
  return (await readJson<RetouchRequest[]>(file(space), [])).find((r) => r.id === id) ?? null;
}

/** Met à jour le suivi IA (fusion des champs). */
export async function setAi(space: SpaceId, id: string, ai: Partial<AiJob>) {
  return withLock(file(space), async () => {
    const list = await readJson<RetouchRequest[]>(file(space), []);
    const r = list.find((x) => x.id === id);
    if (!r) return null;
    r.ai = { ...(r.ai ?? { state: "en_attente" }), ...ai };
    await writeJson(file(space), list);
    return r;
  });
}

/** Le client a ouvert la page Retouches : plus rien de non lu. */
export async function markSeen(space: SpaceId) {
  return withLock(file(space), async () => {
    const list = await readJson<RetouchRequest[]>(file(space), []);
    if (!list.some((r) => r.clientUnread)) return;
    for (const r of list) r.clientUnread = false;
    await writeJson(file(space), list);
  });
}

export async function updateRequest(
  space: SpaceId,
  id: string,
  patch: { status?: RequestStatus; message?: Omit<RequestMessage, "at">; notify?: boolean },
) {
  return withLock(file(space), async () => {
    const list = await readJson<RetouchRequest[]>(file(space), []);
    const r = list.find((x) => x.id === id);
    if (!r) return null;
    if (patch.status && patch.status in STATUS_LABEL) r.status = patch.status;
    if (typeof patch.notify === "boolean") r.notify = patch.notify;
    if (patch.message?.text?.trim()) {
      r.messages.push({ ...patch.message, text: patch.message.text.slice(0, 4000), at: Date.now() });
      // un client qui relance une demande livrée la rouvre
      if (!patch.message.staff && (r.status === "livree" || r.status === "fermee") && !patch.status) r.status = "nouvelle";
      if (patch.message.staff) r.clientUnread = true;
    }
    r.updatedAt = Date.now();
    await writeJson(file(space), list);
    return r;
  });
}
