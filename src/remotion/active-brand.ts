import type { SpaceId } from "@/lib/spaces";
import { BRAND } from "./brand";
import { ELSASS_BRAND } from "./brands/elsass";

/**
 * Identité injectée dans le code généré (globale BRAND), selon l'espace actif du studio.
 * Le fournisseur d'espace (SpaceProvider) l'appelle au chargement ; le rendu CLI garde HytLabs.
 */
const BRANDS: Record<SpaceId, unknown> = { hytlabs: BRAND, elsass: ELSASS_BRAND };
let active: unknown = BRAND;

export function setActiveBrand(space: SpaceId) {
  active = BRANDS[space] ?? BRAND;
}

export function getActiveBrand() {
  return active;
}
