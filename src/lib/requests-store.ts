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

export interface RetouchRequest {
  id: string;
  target: { type: "media" | "project"; id: string; title: string };
  /** instant de la vidéo concerné, ex. « 0:52 » */
  timecode?: string;
  status: RequestStatus;
  createdAt: number;
  updatedAt: number;
  by: string;
  byName: string;
  messages: RequestMessage[];
}

const file = (space: SpaceId) => path.join(spaceDir(space), "requests.json");

export async function listRequests(space: SpaceId): Promise<RetouchRequest[]> {
  const list = await readJson<RetouchRequest[]>(file(space), []);
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createRequest(
  space: SpaceId,
  input: { target: RetouchRequest["target"]; timecode?: string; text: string; by: string; byName: string; staff: boolean },
) {
  return withLock(file(space), async () => {
    const list = await readJson<RetouchRequest[]>(file(space), []);
    const now = Date.now();
    const r: RetouchRequest = {
      id: `${now.toString(36)}-${crypto.randomBytes(3).toString("hex")}`,
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

export async function updateRequest(
  space: SpaceId,
  id: string,
  patch: { status?: RequestStatus; message?: Omit<RequestMessage, "at"> },
) {
  return withLock(file(space), async () => {
    const list = await readJson<RetouchRequest[]>(file(space), []);
    const r = list.find((x) => x.id === id);
    if (!r) return null;
    if (patch.status && patch.status in STATUS_LABEL) r.status = patch.status;
    if (patch.message?.text?.trim()) {
      r.messages.push({ ...patch.message, text: patch.message.text.slice(0, 4000), at: Date.now() });
      // un client qui relance une demande livrée la rouvre
      if (!patch.message.staff && (r.status === "livree" || r.status === "fermee") && !patch.status) r.status = "nouvelle";
    }
    r.updatedAt = Date.now();
    await writeJson(file(space), list);
    return r;
  });
}
