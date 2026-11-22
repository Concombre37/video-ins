/** Rôles des fichiers source d'un média (partagé avec l'interface). */
export type SourceRole = "projet" | "plaque" | "musique" | "voix" | "bruitages" | "logo" | "police" | "autre";
export const SOURCE_ROLE_LABEL: Record<SourceRole, string> = {
  projet: "Projet de montage",
  plaque: "Vidéo sans textes",
  musique: "Musique",
  voix: "Voix off",
  bruitages: "Bruitages",
  logo: "Logo",
  police: "Police",
  autre: "Fichier",
};
