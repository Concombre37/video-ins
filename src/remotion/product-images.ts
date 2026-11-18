/**
 * Registre des photos produits envoyées par l'utilisateur.
 * Le code généré par Claude y accède via la variable globale PRODUCT_IMAGES
 * (ex: <Img src={PRODUCT_IMAGES[0]} />). Le tableau est muté en place pour que
 * les composants déjà compilés voient toujours la version courante.
 */
export const PRODUCT_IMAGES: string[] = [];
const captured = new Set<string>();

export const VIDEO_FORMAT = { width: 1080, height: 1920 } as const; // 9:16 Reels / Shorts

export function markCaptured(dataUrl: string) {
  captured.add(dataUrl);
}

/** Sépare les vraies photos des captures d'écran de l'animation. */
export function splitImages(images: string[] | undefined) {
  const products = (images ?? []).filter((i) => !captured.has(i));
  const captures = (images ?? []).filter((i) => captured.has(i));
  return { products, captures };
}

export function setProductImages(images: string[]) {
  PRODUCT_IMAGES.splice(0, PRODUCT_IMAGES.length, ...images);
}

/** Rend PRODUCT_IMAGES accessible depuis la console / un script (Playwright, agent…). */
export function exposeProductImages() {
  if (typeof window !== "undefined") {
    (window as unknown as { __PRODUCT_IMAGES__: string[] }).__PRODUCT_IMAGES__ = PRODUCT_IMAGES;
  }
}
