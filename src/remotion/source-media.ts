/**
 * Média d'origine d'un projet de retouche (vidéo ou visuel déjà livré au client), exposé au code
 * généré via la globale SOURCE. Objet muté en place : les composants déjà compilés voient la valeur courante.
 *   SOURCE.type    "video" | "image" | null (null = projet sans média d'origine)
 *   SOURCE.src     URL du fichier (aperçu : /api/media/<id>/file ; rendu serveur : staticFile)
 *   SOURCE.width / SOURCE.height / SOURCE.durationInSeconds
 *   SOURCE.assets  { "<nom>": URL } fichiers source du média utilisables dans le code (logo, police…)
 */
export interface SourceMedia {
  type: "video" | "image" | null;
  src: string;
  width: number;
  height: number;
  durationInSeconds: number;
  assets: Record<string, string>;
}

export const SOURCE: SourceMedia = { type: null, src: "", width: 0, height: 0, durationInSeconds: 0, assets: {} };

export function setSource(s: Partial<SourceMedia> | null) {
  Object.assign(SOURCE, { type: null, src: "", width: 0, height: 0, durationInSeconds: 0, assets: {} }, s ?? {});
}
