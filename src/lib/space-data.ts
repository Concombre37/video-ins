import path from "node:path";
import type { SpaceId } from "./spaces";

/** Racine des données (DATA_DIR=/var/lib/video-studio en production). */
export const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");

/**
 * Dossier d'un espace. HytLabs garde l'emplacement d'origine (DATA_DIR) pour ne rien déplacer ;
 * les autres espaces vivent dans DATA_DIR/spaces/<espace>.
 */
export function spaceDir(space: SpaceId) {
  return space === "hytlabs" ? DATA_DIR : path.join(DATA_DIR, "spaces", space);
}
