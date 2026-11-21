import type { SpaceId } from "./spaces";

/**
 * Consignes d'identité visuelle injectées dans le prompt système, selon l'espace.
 * Les images correspondantes sont dans la globale BRAND (src/remotion/brands/*), même structure partout.
 */
const HYTLABS = `## HYTLABS BRANDING (BRAND) — ALWAYS USE IT

These videos are ads for HytLabs (game-server hosting, website hytlabs.com). A global object \`BRAND\`
is available WITHOUT import (do not declare or import it):
- \`BRAND.logo.onDark\` / \`BRAND.logo.onLight\`: horizontal logo (purple "H" symbol + "HytLabs" wordmark),
  transparent PNG, width/height ratio \`BRAND.logo.aspectRatio\` (about 3.43). onDark has white text (use on dark
  backgrounds), onLight has black text (use on light backgrounds).
- \`BRAND.symbol.violet\` / \`.white\` / \`.black\`: the square "H" symbol alone.
- \`BRAND.colors\`: violet "#6F5CF1" (main brand color), night "#0E0E17" (dark background), light "#F4F4F8",
  blackFridayYellow "#FFC94A" (only for Black Friday accents).
- \`BRAND.url\`: "hytlabs.com".
Rules, unless the user explicitly asks otherwise:
- Show the logo in EVERY video: e.g. the symbol in the opening hook, and the full horizontal logo
  (\`<Img src={BRAND.logo.onDark} style={{ width: 700, height: 700 / BRAND.logo.aspectRatio }} />\`) in the final
  call-to-action scene together with \`BRAND.url\`.
- Use the brand colors (night background + violet accents) instead of random colors.
- Never redraw or imitate the logo with shapes or text: always use these images. Never distort them (keep the ratio).`;

const ELSASS = `## ELSASS SIMRACING BRANDING (BRAND) — ALWAYS USE IT

These videos are ads for Elsass SimRacing, a racing-simulator centre in Haguenau (Alsace, France), website
elsass-simracing.fr. Customers book sim-racing sessions alone or in groups (friends, birthdays, bachelor parties,
company team building), buy gift vouchers, and can join THE GRID, an international sim-racing league.
Write all on-screen text in French. A global object \`BRAND\` is available WITHOUT import (do not declare or import it):
- \`BRAND.logo.onDark\` / \`BRAND.logo.onLight\`: full logo (italic "ES" monogram above "ELSASS SIMRACING" and
  "HAGUENAU"), transparent PNG, width/height ratio \`BRAND.logo.aspectRatio\` (about 2.9). onDark has white text
  (use on dark backgrounds), onLight has navy text (use on light backgrounds).
- \`BRAND.symbol.white\` / \`BRAND.symbol.violet\`: the "ES" monogram alone for dark backgrounds (white "E", blue "S");
  \`BRAND.symbol.black\`: same for light backgrounds. Ratio \`BRAND.symbol.aspectRatio\` (about 2.8).
- \`BRAND.colors\`: blue "#1769E8" (main brand color), navy "#07111F" (dark background), light "#F4F6FA",
  white "#FFFFFF", red "#E10600" (only small racing accents).
- \`BRAND.url\`: "elsass-simracing.fr".
Style: motorsport, speed, energy: dark navy backgrounds, blue accents, fast diagonal stripes, very bold italic
uppercase titles (fontWeight 900, fontStyle "italic"), tight letter-spacing.
Rules, unless the user explicitly asks otherwise:
- Show the logo in EVERY video: the monogram in the opening hook and the full logo
  (\`<Img src={BRAND.logo.onDark} style={{ width: 760, height: 760 / BRAND.logo.aspectRatio }} />\`) in the final
  call-to-action scene together with \`BRAND.url\`.
- Never mention HytLabs. Never invent prices, dates or addresses: only use those given by the user.
- Never redraw or imitate the logo with shapes or text: always use these images. Never distort them (keep the ratio).`;

export function brandSection(space: SpaceId) {
  return space === "elsass" ? ELSASS : HYTLABS;
}

export function brandShort(space: SpaceId) {
  const name = space === "elsass" ? "Elsass SimRacing" : "HytLabs";
  return `The globals PRODUCT_IMAGES (uploaded product photos) and BRAND (${name} logo images BRAND.logo.onDark /
BRAND.logo.onLight with ratio BRAND.logo.aspectRatio, BRAND.symbol.violet/white/black, BRAND.colors, BRAND.url)
are available without import. Keep the ${name} logo visible unless the user asks to remove it, and never redraw
the logo with shapes or text.${space === "elsass" ? " This is an Elsass SimRacing video: on-screen text in French, never mention HytLabs." : ""}`;
}
