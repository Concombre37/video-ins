/**
 * Espaces du studio : chaque espace a ses projets, sa médiathèque, ses demandes de retouche,
 * son crédit et son identité visuelle. Fichier partagé client + serveur (pas d'import Node).
 *
 * L'accès est donné sur hytlabs.com (profil de l'utilisateur → « Studio vidéo ») et transmis
 * par le SSO. Les administrateurs du site voient tous les espaces.
 */
export interface SpaceInfo {
  id: SpaceId;
  name: string;
  /** Logo affiché dans l'en-tête (fichier de public/) */
  logo: string;
  /** Le crédit est-il limité ? (sinon : solde OpenRouter global, visible des admins) */
  hasCredit: boolean;
}

export const SPACES = {
  hytlabs: { id: "hytlabs", name: "HytLabs", logo: "/hytlabs-logo.png", hasCredit: false },
  elsass: { id: "elsass", name: "Elsass SimRacing", logo: "/spaces/elsass/logo.png", hasCredit: true },
} as const satisfies Record<string, Omit<SpaceInfo, "id"> & { id: string }>;

export type SpaceId = keyof typeof SPACES;
export const SPACE_IDS = Object.keys(SPACES) as SpaceId[];
export const DEFAULT_SPACE: SpaceId = "hytlabs";

export function isSpaceId(v: unknown): v is SpaceId {
  return typeof v === "string" && (SPACE_IDS as string[]).includes(v);
}

export const eur = (n: number) =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
