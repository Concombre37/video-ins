#!/usr/bin/env node
/**
 * Rendu headless d'un short en MP4 (sans navigateur ouvert) — pour agents / automatisation.
 *
 *   node scripts/render-short.mjs --code anim.tsx --images public/products/a.jpg,public/products/b.jpg \
 *        --seconds 12 --out out/bf.mp4
 *
 * --code    : fichier contenant le composant (export const MyAnimation = () => {...}),
 *             le même format que celui généré dans l'interface (onglet "Remotion Code").
 *             Par défaut : l'exemple Black Friday intégré.
 * --images  : photos produits (chemins locaux ou URLs https), accessibles via PRODUCT_IMAGES.
 * --format  : 9:16 (défaut), 1:1 ou 16:9.
 * --music   : energique (défaut), gaming, epique, chill, none, ou chemin d'un fichier audio.
 * --volume  : volume de la musique entre 0 et 1 (défaut 0.6).
 */
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith("--") ? [...acc, [v.slice(2), a[i + 1]]] : acc), []),
);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

let code;
if (args.code) code = fs.readFileSync(args.code, "utf8");
else {
  const src = fs.readFileSync(path.join(root, "src/examples/code/black-friday-promo.ts"), "utf8");
  code = src.match(/blackFridayPromoCode = `([\s\S]*?)\n`;/)[1].replace(/\\`/g, "`").replace(/\\\$/g, "$");
}

const mime = (f) => ({ ".png": "image/png", ".webp": "image/webp" })[path.extname(f).toLowerCase()] ?? "image/jpeg";
const productImages = (args.images ? args.images.split(",") : []).map((f) =>
  /^https?:/.test(f) ? f : `data:${mime(f)};base64,${fs.readFileSync(f).toString("base64")}`,
);

const format = ["9:16", "1:1", "16:9"].includes(args.format) ? args.format : "9:16";

const audioMime = (f) =>
  ({ ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/wav", ".ogg": "audio/ogg" })[
    path.extname(f).toLowerCase()
  ] ?? "audio/mpeg";
const musicArg = args.music ?? "energique";
let musicSrc = null;
if (musicArg !== "none") {
  const file = fs.existsSync(musicArg) ? musicArg : path.join(root, "public/music", `${musicArg}.mp3`);
  if (!fs.existsSync(file)) throw new Error(`Musique introuvable : ${musicArg}`);
  musicSrc = `data:${audioMime(file)};base64,${fs.readFileSync(file).toString("base64")}`;
}

const fps = Number(args.fps ?? 30);
const inputProps = {
  code,
  fps,
  durationInFrames: Math.round(Number(args.seconds ?? 10) * fps),
  productImages,
  format,
  musicSrc,
  musicVolume: Number(args.volume ?? 0.6),
};
const out = args.out ?? `out/short-${Date.now()}.mp4`;
fs.mkdirSync(path.dirname(out), { recursive: true });

const browserExecutable = process.env.REMOTION_BROWSER ?? null;
console.log("Bundling…");
const serveUrl = await bundle({
  entryPoint: path.join(root, "src/remotion/index.ts"),
  webpackOverride: (await import(path.join(root, "src/remotion/webpack-override.mjs"))).webpackOverride,
});
const composition = await selectComposition({ serveUrl, id: "DynamicComp", inputProps, browserExecutable });
console.log(`Rendu ${composition.width}x${composition.height}, ${composition.durationInFrames} frames…`);
await renderMedia({
  serveUrl, composition, inputProps, codec: "h264", outputLocation: out, browserExecutable,
  onProgress: ({ progress }) => process.stdout.write(`\r${Math.round(progress * 100)}%`),
});
console.log(`\n✔ ${path.resolve(out)}`);
