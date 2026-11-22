#!/usr/bin/env node
/**
 * Rendu serveur d'une retouche automatique (lancé par src/lib/auto-retouch.ts).
 *   node scripts/render-job.mjs <job.json>
 * job.json : { code, space, fps, durationInFrames, width, height, format, still,
 *              sourceFile (chemin local du média d'origine), source: {type,width,height,durationInSeconds},
 *              assetFiles: { "<nom>": chemin local } (fichiers source exposés au code par SOURCE.assets),
 *              productImages, musicSrc, musicVolume, out }
 * Écrit la progression sur stdout (« PROGRESS 0.42 ») et termine par « DONE <chemin> ».
 */
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const job = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

// dossier public propre au rendu : le média d'origine y est servi via staticFile()
const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), "retouche-"));
let source = null;
if (job.sourceFile) {
  const name = `source${path.extname(job.sourceFile).toLowerCase()}`;
  try {
    fs.linkSync(job.sourceFile, path.join(publicDir, name));
  } catch {
    fs.copyFileSync(job.sourceFile, path.join(publicDir, name));
  }
  source = { ...job.source, file: name, assets: {} };
  if (job.assetFiles) fs.mkdirSync(path.join(publicDir, "assets"));
  for (const [n, f] of Object.entries(job.assetFiles ?? {})) {
    const rel = `assets/${path.basename(n)}`;
    try {
      fs.linkSync(f, path.join(publicDir, rel));
    } catch {
      fs.copyFileSync(f, path.join(publicDir, rel));
    }
    source.assets[n] = rel;
  }
}

// musique d'un projet du studio : « /music/x.mp3 » (dossier public) → data URL
let music = job.musicSrc ?? null;
if (music && music.startsWith("/")) {
  const f = path.join(root, "public", music);
  music = fs.existsSync(f) ? `data:audio/mpeg;base64,${fs.readFileSync(f).toString("base64")}` : null;
}

const inputProps = {
  code: job.code,
  fps: job.fps,
  durationInFrames: job.durationInFrames,
  width: job.width,
  height: job.height,
  format: job.format,
  productImages: job.productImages ?? [],
  musicSrc: music,
  musicVolume: job.musicVolume ?? 0.6,
  space: job.space,
  source,
};
const browserExecutable = process.env.REMOTION_BROWSER ?? null;
try {
  const serveUrl = await bundle({
    entryPoint: path.join(root, "src/remotion/index.ts"),
    publicDir,
    webpackOverride: (await import(path.join(root, "src/remotion/webpack-override.mjs"))).webpackOverride,
  });
  const composition = await selectComposition({ serveUrl, id: "DynamicComp", inputProps, browserExecutable });
  fs.mkdirSync(path.dirname(job.out), { recursive: true });
  if (job.still) {
    await renderStill({ serveUrl, composition, inputProps, output: job.out, frame: job.frame ?? 0, browserExecutable, ...(job.out.endsWith(".png") ? { imageFormat: "png" } : { imageFormat: "jpeg", jpegQuality: 92 }) });
  } else {
    let last = -1;
    await renderMedia({
      serveUrl,
      composition,
      inputProps,
      codec: "h264",
      crf: 20,
      audioCodec: "aac",
      outputLocation: job.out,
      browserExecutable,
      // 4 Go de RAM dans le LXC : 2 onglets Chrome au plus (RENDER_CONCURRENCY pour changer)
      concurrency: Number(process.env.RENDER_CONCURRENCY) || 2,
      timeoutInMilliseconds: 120_000,
      // le cache d'images des vidéos d'origine prend sinon la moitié de la RAM (OOM dans le LXC)
      offthreadVideoCacheSizeInBytes: 384 * 1024 * 1024,
      offthreadVideoThreads: 2,
      onProgress: ({ progress }) => {
        const p = Math.floor(progress * 100);
        if (p !== last) {
          last = p;
          console.log(`PROGRESS ${progress.toFixed(2)}`);
        }
      },
    });
  }
  console.log(`DONE ${job.out}`);
} finally {
  fs.rmSync(publicDir, { recursive: true, force: true });
}
