import { execFile, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { signSession } from "./auth";
import { getProject, listRenders, renderPath, saveProject, saveRender, type Project, type ProjectSource } from "./history-store";
import { addVersion, getMedia, mediaFilePath, previewPath, putSource, sourcePath as mediaSourcePath, type MediaItem, type VersionStems } from "./media-store";
import { notifyClient, notifyStaff } from "./notify";
import { generateMusic, tts } from "./audio-ai";
import { canSpend, charge } from "./budget-store";
import { getRequest, listRequests, setAi, updateRequest, type RetouchRequest } from "./requests-store";
import { SPACE_IDS, SPACES, type SpaceId } from "./spaces";
import { DEFAULT_VOLUME, FORMATS, MUSIC_TRACKS, musicSrc, type VideoFormat } from "./video-settings";
import { isVoiceId, voiceName } from "./voices";

/**
 * Retouche automatique : dès qu'une demande arrive (ou que le client y répond), l'IA (OpenRouter) modifie
 * le code de la vidéo, le serveur rend la nouvelle version, la livre dans la médiathèque et prévient le client.
 *
 * Les vidéos livrées (MP4 sans code source) deviennent un « projet de retouche » rt-<média> : le fichier d'origine
 * sert de fond (globale SOURCE) et les retouches s'empilent par-dessus dans le code. Si l'IA juge la demande
 * irréalisable, ou si le rendu échoue, la demande reste ouverte pour l'équipe HytLabs.
 *
 * File d'attente en mémoire (un travail à la fois), reprise au démarrage (instrumentation.ts).
 */
const run = promisify(execFile);
const ASSISTANT = "Assistant IA HytLabs";
const MODEL = () => process.env.AUTO_RETOUCH_MODEL || "claude-haiku-5-5";
const RENDER_TIMEOUT = 40 * 60_000;
const FRAME_W = 432;

type Job = { space: SpaceId; id: string };
const g = globalThis as unknown as { __retouche?: { queue: Job[]; running: boolean } };
const state = (g.__retouche ??= { queue: [], running: false });

export async function enqueueRetouch(space: SpaceId, id: string) {
  if (state.queue.some((j) => j.space === space && j.id === id)) return;
  await setAi(space, id, { state: "en_attente", step: "En attente", progress: 0, error: undefined });
  state.queue.push({ space, id });
  void pump();
}

/** Au démarrage : relance les retouches interrompues par un redémarrage. */
export async function resumePending() {
  for (const space of SPACE_IDS) {
    for (const r of await listRequests(space)) {
      if (r.ai && (r.ai.state === "en_attente" || r.ai.state === "en_cours")) await enqueueRetouch(space, r.id);
    }
  }
}

async function pump() {
  if (state.running) return;
  state.running = true;
  try {
    while (state.queue.length) {
      const job = state.queue.shift()!;
      try {
        await handle(job);
      } catch (e) {
        await fail(job, e instanceof Error ? e.message : String(e));
      }
    }
  } finally {
    state.running = false;
  }
}

class Impossible extends Error {}

/* ── Média d'origine ───────────────────────────────────────────── */

async function probe(file: string) {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate:format=duration", "-of", "json", file,
  ]);
  const d = JSON.parse(stdout);
  const st = d.streams?.[0] ?? {};
  const [n, m] = String(st.r_frame_rate ?? "30/1").split("/").map(Number);
  return { width: Number(st.width) || 1080, height: Number(st.height) || 1920, duration: Number(d.format?.duration) || 0, fps: m ? n / m : 30 };
}

function nearestFormat(w: number, h: number): VideoFormat {
  const r = w / h;
  return r < 0.8 ? "9:16" : r > 1.25 ? "16:9" : "1:1";
}

const BASE_CODE = {
  video: `import { AbsoluteFill } from "remotion";

export const MyAnimation = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Vidéo d'origine du client (globale SOURCE) : base à garder, les retouches se font par-dessus */}
      <OffthreadVideo src={SOURCE.src} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
    </AbsoluteFill>
  );
};`,
  image: `import { AbsoluteFill, Img } from "remotion";

export const MyAnimation = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Visuel d'origine du client (globale SOURCE) : base à garder, les retouches se font par-dessus */}
      <Img src={SOURCE.src} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
    </AbsoluteFill>
  );
};`,
};

/** Projet de retouche d'un média (créé au premier passage, puis réutilisé : les retouches s'empilent). */
async function projectForMedia(space: SpaceId, mediaId: string) {
  const item = await getMedia(space, mediaId);
  if (!item) throw new Error("Média introuvable");
  if (item.kind !== "video" && item.kind !== "image") {
    throw new Impossible("la retouche automatique ne gère que les vidéos et les visuels");
  }
  const kind: "video" | "image" = item.kind;
  const original = mediaFilePath(space, item, item.versions[0].n)!;
  const current = mediaFilePath(space, item)!;
  // originaux lourds (4K, HEVC) : on travaille sur la copie légère 1080p
  const preview = item.hasPreview ? previewPath(space, item.id) : null;
  if (preview && item.versions.length === 1) {
    original.path = preview;
    current.path = preview;
  }
  const id = `rt-${item.id}`.slice(0, 64);
  let project = await getProject(space, id);
  if (!project?.source) {
    const p = await probe(original.path);
    const fps = item.kind === "image" ? 30 : p.duration * Math.min(60, Math.round(p.fps)) > 2400 ? 30 : Math.min(60, Math.round(p.fps)) || 30;
    // composition plafonnée à 1920 px sur le grand côté (rendu raisonnable dans le LXC)
    const k = Math.min(1, 1920 / Math.max(p.width, p.height));
    const even = (n: number) => Math.max(2, Math.round((n * k) / 2) * 2);
    const source: ProjectSource = {
      mediaId: item.id,
      version: item.versions[0].n,
      type: kind,
      width: even(p.width),
      height: even(p.height),
      durationInSeconds: item.kind === "image" ? 0 : p.duration,
    };
    const now = Date.now();
    project = {
      id,
      title: `Retouches · ${item.title}`,
      createdAt: now,
      updatedAt: now,
      code: BASE_CODE[kind],
      fps,
      durationInFrames: item.kind === "image" ? 1 : Math.max(1, Math.round(p.duration * fps)),
      messages: [],
      productImages: [],
      format: nearestFormat(p.width, p.height),
      music: { kind: "none" },
      volume: DEFAULT_VOLUME,
      totalCost: 0,
      source,
    };
  }
  // vidéo sans textes (plaque) et fichiers source utilisés par le code du projet
  let originalPath = original.path;
  if (project.source?.plate) {
    const p = mediaSourcePath(space, item.id, project.source.plate);
    if (!p) throw new Error("vidéo sans textes introuvable");
    originalPath = p;
  }
  const assetFiles: Record<string, string> = {};
  for (const n of project.source?.assets ?? []) {
    const p = mediaSourcePath(space, item.id, n);
    if (p) assetFiles[n] = p;
  }
  return { item, project, originalPath, currentPath: current.path, assetFiles };
}

/** Images (data URL) de la version actuelle, aux instants utiles, pour que l'IA voie la vidéo. */
async function frames(file: string, type: "video" | "image", duration: number, timecode?: string) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "frames-"));
  try {
    const times: number[] = [];
    if (type === "video") {
      const tc = parseTimecode(timecode, duration);
      if (tc != null) times.push(Math.max(0, tc - 1), tc, Math.min(duration - 0.05, tc + 1));
      for (const f of [0.1, 0.35, 0.6, 0.9]) times.push(duration * f);
    } else times.push(0);
    const uniq = [...new Set(times.map((t) => Math.round(t * 10) / 10))].sort((a, b) => a - b).slice(0, 7);
    const out: { at: number; url: string }[] = [];
    for (const [i, t] of uniq.entries()) {
      const jpg = path.join(tmp, `${i}.jpg`);
      await run("ffmpeg", ["-loglevel", "error", "-y", ...(type === "video" ? ["-ss", String(t)] : []), "-i", file, "-frames:v", "1", "-vf", `scale=${FRAME_W}:-2`, "-q:v", "5", jpg]);
      out.push({ at: t, url: `data:image/jpeg;base64,${(await fs.readFile(jpg)).toString("base64")}` });
    }
    return out;
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

function parseTimecode(tc: string | undefined, duration: number) {
  if (!tc) return null;
  if (/fin|end/i.test(tc)) return Math.max(0, duration - 2);
  if (/d[ée]but|start/i.test(tc)) return 0.5;
  const m = tc.match(/(\d+)\s*[:m']\s*(\d{1,2})|(\d+(?:[.,]\d+)?)\s*s?/);
  if (!m) return null;
  const t = m[1] ? Number(m[1]) * 60 + Number(m[2]) : Number(m[3].replace(",", "."));
  return Number.isFinite(t) ? Math.min(Math.max(0, t), Math.max(0, duration - 0.05)) : null;
}

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/* ── IA ────────────────────────────────────────────────────────── */

function instruction(r: RetouchRequest) {
  // messages du demandeur (un admin qui fait sa propre demande compte aussi), hors réponses de l'assistant
  const client = r.messages.filter((m) => (!m.staff || m.by === r.by) && m.by !== "ia@hytlabs.com");
  const last = client[client.length - 1]?.text ?? "";
  const earlier = r.messages.slice(0, -1).map((m) => `${m.staff ? "Équipe" : "Client"} : ${m.text}`).join("\n");
  return { last, earlier };
}

function buildPrompt(r: RetouchRequest, project: Project, shots: { at: number }[], width: number, height: number) {
  const { last, earlier } = instruction(r);
  const src = project.source;
  return `RETOUCHE DEMANDÉE PAR LE CLIENT (en français) :
« ${last} »${r.timecode ? `\nMoment indiqué par le client : ${r.timecode}` : ""}${earlier ? `\n\nÉchanges précédents sur cette demande :\n${earlier}` : ""}

CONTEXT FOR YOU:
- Composition: ${width}x${height} px, ${project.fps} fps, ${(project.durationInFrames / project.fps).toFixed(2)} s.
${src ? `- The base layer is the client's EXISTING ${src.type} (global SOURCE: SOURCE.src, SOURCE.type, SOURCE.width, SOURCE.height, SOURCE.durationInSeconds = ${src.durationInSeconds.toFixed(2)}), shown with ${src.type === "video" ? "<OffthreadVideo src={SOURCE.src} /> (OffthreadVideo is a global, also available as Remotion.OffthreadVideo)" : "<Img src={SOURCE.src} />"}. Keep it as the base. You cannot change its pixels: apply every change as layers ON TOP of it, at the right time (use <Sequence from durationInFrames>) and position (absolute positioning in px of the ${width}x${height} frame).
- To replace or remove text that is baked into the footage: cover it with an opaque shape whose color matches the background around it (look at the frames), then draw the new text in a similar style. To add an ending/intro: change the total duration (see below) and add a scene before/after the footage (shift the footage with <Sequence from>). To cut: <OffthreadVideo trimBefore={frames} trimAfter={frames} />. Volume: volume={0..1}.` : "- Edit the existing animation as requested and keep everything else unchanged."}
${src?.plate ? `- IMPORTANT: SOURCE here is a CLEAN PLATE (the footage without the added texts). Every text, logo and end card you see on the frames is drawn by the EXISTING CODE as real layers: to change a text, a color, a position or a timing, EDIT THOSE LAYERS DIRECTLY in the code. Never cover anything with a shape. Keep the font loading code as is.
` : ""}${src?.assets?.length ? `- Files available to the code: ${src.assets.map((n) => `SOURCE.assets["${n}"]`).join(", ")}.
` : ""}${src?.plate ? `- Sound is handled separately (music / voice-over requests): do not add, remove or change <Audio> elements, and leave the footage volume as is.
` : ""}- Attached images = frames of the CURRENT version, in this order: ${shots.map((s, i) => `image ${i + 1} at ${fmt(s.at)} (${s.at.toFixed(1)} s)`).join(", ") || "none"}.
  They are downscaled to ${FRAME_W} px wide: multiply any position you measure on them by ${(width / FRAME_W).toFixed(2)} to get composition pixels.
- Layout: look carefully at the frames before placing anything. Never cover the logo, the main title or a face unless asked.
  "En bas" means the bottom area of the frame (roughly the last 20 % of the height), "en haut" the top area. Match the existing
  typography (size, weight, italic, color, uppercase) so the change looks like it was always part of the video.
- On-screen text must stay in French. Keep the logo rules.
- If you need a different total duration, put this exact line at the very top of the code: // DURATION_SECONDS: <number>
- If the request is impossible this way (new filming, another language voice-over, etc.), return the code unchanged and put this exact line at the very top: // IMPOSSIBLE: <short reason in French>`;
}

async function callAi(r: RetouchRequest, space: SpaceId, project: Project, prompt: string, images: string[], errorFix?: string) {
  const cookie = signSession({
    sub: `retouche:${r.by}`,
    email: r.by,
    name: r.byName,
    admin: false,
    spaces: [space],
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const port = process.env.PORT || "3000";
  const res = await fetch(`http://127.0.0.1:${port}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `hs_session=${cookie}; hs_space=${space}` },
    body: JSON.stringify({
      prompt: errorFix ? `${prompt}\n\nYOUR PREVIOUS CODE FAILED TO RENDER WITH THIS ERROR, FIX IT:\n${errorFix}` : prompt,
      model: MODEL(),
      currentCode: project.code,
      isFollowUp: true,
      conversationHistory: [],
      frameImages: images,
      format: project.format,
      durationInFrames: project.durationInFrames,
      fps: project.fps,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 402) throw new Impossible("le crédit de l'espace est épuisé");
  if (!res.ok || typeof body.code !== "string") throw new Error(body.error ?? `génération refusée (${res.status})`);
  return { code: body.code as string, summary: String(body.summary ?? ""), cost: Number(body.metadata?.cost) || 0 };
}

/* ── Rendu ─────────────────────────────────────────────────────── */

async function render(
  space: SpaceId,
  project: Project,
  sourcePath: string | null,
  width: number,
  height: number,
  still: boolean,
  onProgress: (p: number) => void,
  assetFiles: Record<string, string> = {},
) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rendu-"));
  const out = path.join(dir, still ? "out.png" : "out.mp4");
  const jobFile = path.join(dir, "job.json");
  await fs.writeFile(
    jobFile,
    JSON.stringify({
      code: project.code,
      space,
      fps: project.fps,
      durationInFrames: project.durationInFrames,
      width,
      height,
      format: project.format,
      still,
      sourceFile: sourcePath,
      assetFiles,
      source: project.source ? { type: project.source.type, width: project.source.width, height: project.source.height, durationInSeconds: project.source.durationInSeconds } : null,
      productImages: project.productImages,
      musicSrc: musicSrc(project.music),
      musicVolume: project.volume,
      out,
    }),
  );
  const log: string[] = [];
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(process.cwd(), "scripts/render-job.mjs"), jobFile], { cwd: process.cwd(), env: process.env });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("rendu trop long (plus de 40 minutes)"));
    }, RENDER_TIMEOUT);
    const onData = (d: Buffer) => {
      for (const line of d.toString().split("\n")) {
        const m = line.match(/^PROGRESS ([\d.]+)/);
        if (m) onProgress(Number(m[1]));
        else if (line.trim()) log.push(line.trim());
      }
      log.splice(0, Math.max(0, log.length - 30));
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(log.filter((l) => /error|erreur|Error/.test(l)).slice(-3).join(" | ").slice(0, 600) || `rendu interrompu (code ${code})`));
    });
  });
  const data = new Uint8Array(await fs.readFile(out));
  await fs.rm(dir, { recursive: true, force: true });
  return { data, ext: still ? "png" : "mp4" };
}

/* ── Déroulé ───────────────────────────────────────────────────── */

async function handle({ space, id }: Job) {
  const r = await getRequest(space, id);
  if (!r) return;
  if (r.kind === "musique" || r.kind === "voix") return handleAudio({ space, id }, r);
  const step = (s: string, progress = 0) => setAi(space, id, { state: "en_cours", step: s, progress });
  await setAi(space, id, { state: "en_cours", step: "Analyse de la vidéo", progress: 0, startedAt: Date.now(), error: undefined });
  await updateRequest(space, id, { status: "en_cours" });

  // 1. projet à modifier + images de la version actuelle
  let project: Project | null;
  let sourcePath: string | null = null;
  let shotsFrom: string | null = null;
  let mediaId: string | null = null;
  let assetFiles: Record<string, string> = {};
  let width: number;
  let height: number;
  if (r.target.type === "media") {
    const m = await projectForMedia(space, r.target.id);
    project = m.project;
    sourcePath = m.originalPath;
    assetFiles = m.assetFiles;
    shotsFrom = m.currentPath;
    mediaId = m.item.id;
    width = project.source!.width;
    height = project.source!.height;
  } else {
    project = await getProject(space, r.target.id);
    if (!project) throw new Error("Projet introuvable");
    width = FORMATS[project.format].width;
    height = FORMATS[project.format].height;
    const last = (await listRenders(space, project.id))[0];
    shotsFrom = last ? renderPath(space, project.id, last.file) : null;
  }
  const isImage = project.source?.type === "image";
  const duration = project.durationInFrames / project.fps;
  const shots = shotsFrom ? await frames(shotsFrom, isImage ? "image" : "video", duration, r.timecode) : [];

  // 2. IA (une seconde tentative si le code ne se rend pas)
  const prompt = buildPrompt(r, project, shots, width, height);
  let errorFix: string | undefined;
  let delivered: { data: Uint8Array; ext: string } | null = null;
  let summary = "";
  let totalCost = 0;
  for (let attempt = 1; attempt <= 2 && !delivered; attempt++) {
    await step(attempt === 1 ? "L'IA prépare la retouche" : "L'IA corrige une erreur");
    // 2e tentative : on repart du code qui a échoué, avec l'erreur
    const ai = await callAi(r, space, project, prompt, shots.map((s) => s.url), errorFix);
    totalCost += ai.cost;
    summary = ai.summary;
    const impossible = ai.code.match(/^\s*\/\/\s*IMPOSSIBLE:\s*(.+)$/m);
    if (impossible) throw new Impossible(impossible[1].trim());
    const dur = ai.code.match(/^\s*\/\/\s*DURATION_SECONDS:\s*([\d.]+)/m);
    project = {
      ...project,
      code: ai.code,
      durationInFrames: isImage ? 1 : dur ? Math.max(1, Math.min(180 * project.fps, Math.round(Number(dur[1]) * project.fps))) : project.durationInFrames,
    };
    await step("Rendu de la nouvelle version", 0);
    let lastPct = -1;
    try {
      delivered = await render(space, project, sourcePath, width, height, isImage, (p) => {
        const pct = Math.floor(p * 20) * 5;
        if (pct !== lastPct) {
          lastPct = pct;
          void setAi(space, id, { progress: p });
        }
      }, assetFiles);
    } catch (e) {
      errorFix = e instanceof Error ? e.message : String(e);
      if (attempt === 2) throw new Error(`le rendu a échoué : ${errorFix}`);
    }
  }
  if (!delivered) throw new Error("aucune version produite");

  // 3. enregistrement du projet + livraison
  const now = Date.now();
  await saveProject(space, {
    ...project,
    updatedAt: now,
    model: MODEL(),
    totalCost: (project.totalCost ?? 0) + totalCost,
    messages: [
      ...project.messages,
      { role: "user", content: instruction(r).last, timestamp: now },
      { role: "assistant", content: summary || "Retouche appliquée", codeSnapshot: project.code, model: MODEL(), cost: totalCost, timestamp: now },
    ],
  });
  let where: string;
  if (mediaId) {
    // le son vit à part : si la version actuelle a des pistes séparées et que la durée n'a pas changé,
    // la nouvelle image reprend exactement son son (voix off, musique, bruitages)
    const kept = isImage ? null : await keepAudio(space, mediaId, delivered.data);
    const item = await addVersion(space, mediaId, {
      fileName: `retouche.${delivered.ext}`,
      data: kept?.data ?? delivered.data,
      by: "ia@hytlabs.com",
      note: `Retouche automatique : ${summary || instruction(r).last}`.slice(0, 500),
      stems: kept?.stems,
    });
    const v = item.versions[item.versions.length - 1].n;
    where = `version ${v} dans la médiathèque`;
  } else {
    await saveRender(space, project.id, delivered.data);
    where = "nouvelle vidéo exportée dans le projet";
  }
  await updateRequest(space, id, {
    status: "livree",
    message: {
      by: "ia@hytlabs.com",
      byName: ASSISTANT,
      staff: true,
      text: `C'est fait ! ${summary}\nNouvelle ${where}. Si ce n'est pas tout à fait ça, réponds ici : la retouche sera relancée.`,
    },
  });
  await setAi(space, id, { state: "terminee", step: "Livrée", progress: 1, finishedAt: Date.now(), delivered: where });
  await delivered_(space, id, summary, where);
}

/** Fin commune d'une retouche livrée : email au client s'il l'a demandé, message à l'équipe. */
async function delivered_(space: SpaceId, id: string, summary: string, where: string) {
  const r = await getRequest(space, id);
  if (!r) return;
  if (r.notify) {
    await notifyClient(
      r.by,
      "Ta retouche vidéo est prête",
      [`Bonjour ${r.byName},`, `La retouche demandée sur « ${r.target.title} » est terminée.`, summary, `Tu la trouves en ${where}.`].filter(Boolean),
      { label: "Voir la retouche", url: "https://video.hytlabs.com/requests" },
    );
  }
  await notifyStaff(`✅ Retouche automatique livrée (${SPACES[space].name}) : « ${r.target.title} » — ${summary}`);
}

async function fail({ space, id }: Job, reason: string) {
  const r = await getRequest(space, id);
  if (!r) return;
  console.error(`Retouche automatique ${space}/${id} : ${reason}`);
  await setAi(space, id, { state: "echec", step: "Reprise par l'équipe", error: reason.slice(0, 600), finishedAt: Date.now() });
  await updateRequest(space, id, {
    status: "nouvelle",
    message: {
      by: "ia@hytlabs.com",
      byName: ASSISTANT,
      staff: true,
      text: `Je n'ai pas pu faire cette retouche automatiquement (${reason.slice(0, 300)}). L'équipe HytLabs prend le relais et te répond ici.`,
    },
  });
  if (r.notify) await notifyClient(
    r.by,
    "Ta demande de retouche est prise en charge",
    [`Bonjour ${r.byName},`, `La retouche demandée sur « ${r.target.title} » demande une intervention de l'équipe HytLabs.`, "Nous te répondons dans le studio dès que possible."],
    { label: "Suivre la demande", url: "https://video.hytlabs.com/requests" },
  );
  await notifyStaff(`⚠️ Retouche automatique impossible (${SPACES[space].name}) : « ${r.target.title} » — ${reason}\nhttps://video.hytlabs.com/requests`);
}

/* ── Retouches audio (musique seule, voix off seule) ─────────────── */

async function probeAudio(file: string) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", file]);
  const d = JSON.parse(stdout);
  return {
    duration: Number(d.format?.duration) || 0,
    hasAudio: (d.streams ?? []).some((x: { codec_type?: string }) => x.codec_type === "audio"),
  };
}

const AAC = ["-c:a", "aac", "-b:a", "192k", "-ar", "48000"];
const ST = "aresample=48000,aformat=channel_layouts=stereo";

/** Piste son à la durée exacte de la vidéo (complétée par du silence). */
async function track(inputs: string[], filter: string, duration: number, out: string) {
  await run("ffmpeg", ["-loglevel", "error", "-y", ...inputs, "-filter_complex", filter, "-map", "[a]", "-t", duration.toFixed(3), ...AAC, out], { maxBuffer: 1 << 24 });
}

/** Mixe les pistes séparées (musique baissée sous la voix si demandé) et les pose sous l'image de la vidéo. */
async function mixStems(video: string, t: { music?: string; voice?: string; sfx?: string }, duck: boolean, duration: number, out: string) {
  const ins: string[] = [];
  const labels: string[] = [];
  let f = "";
  const add = (file: string) => {
    ins.push("-i", file);
    return ins.length / 2;
  };
  const voiceIdx = t.voice ? add(t.voice) : 0;
  if (t.music) {
    const i = add(t.music);
    if (t.voice && duck) {
      f += `[${voiceIdx}:a]${ST},asplit=2[vk][vm];[${i}:a]${ST}[mu];[mu][vk]sidechaincompress=threshold=0.02:ratio=12:attack=30:release=600[m];`;
      labels.push("[m]", "[vm]");
    } else labels.push(`[${i}:a]`);
  }
  if (t.voice && !(t.music && duck)) labels.push(`[${voiceIdx}:a]`);
  if (t.sfx) labels.push(`[${add(t.sfx)}:a]`);
  if (!labels.length) throw new Impossible("aucun son à mettre sur la vidéo");
  f += labels.length > 1 ? `${labels.join("")}amix=inputs=${labels.length}:duration=longest:normalize=0,alimiter=limit=0.95[a]` : `${labels[0]}${ST},alimiter=limit=0.95[a]`;
  const common = ["-loglevel", "error", "-y", "-i", video, ...ins, "-filter_complex", f, "-map", "0:v:0", "-map", "[a]", "-t", duration.toFixed(3)];
  const audio = [...AAC, "-movflags", "+faststart", out];
  try {
    await run("ffmpeg", [...common, "-c:v", "copy", ...audio], { maxBuffer: 1 << 24 });
  } catch {
    // codec vidéo non accepté dans un MP4 : on réencode l'image
    await run("ffmpeg", [...common, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", ...audio], { maxBuffer: 1 << 24 });
  }
}

async function handleAudio({ space, id }: Job, r: RetouchRequest) {
  const step = (s: string, progress = 0) => setAi(space, id, { state: "en_cours", step: s, progress });
  await setAi(space, id, { state: "en_cours", step: "Préparation du son", progress: 0, startedAt: Date.now(), error: undefined });
  await updateRequest(space, id, { status: "en_cours" });
  const spec = r.audio;
  if (!spec || (r.kind === "musique" && !spec.music) || (r.kind === "voix" && !spec.voice)) throw new Impossible("réglages audio manquants");

  // vidéo de départ : version choisie du média (avec ses pistes séparées s'il y en a), ou dernier rendu du projet
  let base: string;
  let item: MediaItem | null = null;
  let stems: VersionStems | undefined;
  if (r.target.type === "media") {
    item = await getMedia(space, r.target.id);
    if (!item) throw new Error("Média introuvable");
    if (item.kind !== "video") throw new Impossible("la musique et la voix off ne se changent que sur une vidéo");
    const f = mediaFilePath(space, item, spec.baseVersion) ?? mediaFilePath(space, item);
    if (!f) throw new Error("fichier du média introuvable");
    base = f.path;
    stems = f.version.stems;
  } else {
    const project = await getProject(space, r.target.id);
    if (!project) throw new Error("Projet introuvable");
    const last = (await listRenders(space, project.id))[0];
    if (!last) throw new Impossible("exporte d'abord la vidéo du projet");
    const p = renderPath(space, project.id, last.file);
    if (!p) throw new Error("rendu du projet introuvable");
    base = p;
  }
  if (!(await canSpend(space))) throw new Impossible("le crédit de l'espace est épuisé");
  const { duration, hasAudio } = await probeAudio(base);
  if (!(duration > 0)) throw new Error("durée de la vidéo illisible");
  const D = duration.toFixed(3);
  const stemPath = (n?: string) => (n && item ? mediaSourcePath(space, item.id, n) ?? undefined : undefined);
  const cur = { music: stemPath(stems?.music), voice: stemPath(stems?.voice), sfx: stemPath(stems?.sfx) };
  const separated = !!(cur.music || cur.voice || cur.sfx);

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "audio-"));
  const out = path.join(tmp, "out.mp4");
  // nouvelles pistes séparées (gardées comme fichiers source du média pour les retouches suivantes)
  const created: { key: keyof VersionStems; file: string; label: string; role: "musique" | "voix" }[] = [];
  let summary: string;
  let cost = 0;
  let duck = true;
  try {
    // sans pistes séparées, le son actuel de la vidéo devient la piste « son d'origine »
    if (!separated && hasAudio) {
      const orig = path.join(tmp, "origine.m4a");
      await track(["-i", base], `[0:a]${ST},apad[a]`, duration, orig);
      cur.music = orig;
      created.push({ key: "music", file: orig, label: "Son d'origine de la vidéo", role: "musique" });
    }
    if (r.kind === "musique") {
      const m = spec.music!;
      let music: string;
      let label: string;
      if (m.pick.source === "track") {
        const pick = m.pick;
        const t = MUSIC_TRACKS.find((x) => x.id === pick.id);
        if (!t) throw new Impossible("piste inconnue");
        music = path.join(process.cwd(), "public", t.src);
        label = `la piste « ${t.label} »`;
      } else if (m.pick.source === "media") {
        const a = await getMedia(space, m.pick.mediaId);
        const f = a && a.kind === "audio" ? mediaFilePath(space, a) : null;
        if (!f) throw new Impossible("le fichier de musique n'est plus dans la médiathèque");
        music = f.path;
        label = `« ${a!.title} »`;
      } else {
        await step("Composition de la musique par l'IA");
        const g = await generateMusic(m.pick.prompt, duration);
        cost += g.cost;
        music = path.join(tmp, "lyria.mp3");
        await fs.writeFile(music, g.data);
        label = "une musique composée par l'IA";
      }
      await step("Mixage", 0.5);
      const fadeOut = Math.max(0, duration - 1.5).toFixed(3);
      const chain = `[0:a]${ST},atrim=0:${D},asetpts=N/SR/TB,afade=t=in:d=0.3,afade=t=out:st=${fadeOut}:d=1.5,volume=${m.volume.toFixed(2)}`;
      const newMusic = path.join(tmp, "musique.m4a");
      const keepOld = m.mode === "mixer" && cur.music;
      if (keepOld) await track(["-stream_loop", "-1", "-i", music, "-i", cur.music!], `${chain}[n];[1:a]${ST}[o];[o][n]amix=inputs=2:duration=first:normalize=0[a]`, duration, newMusic);
      else await track(["-stream_loop", "-1", "-i", music], `${chain},apad[a]`, duration, newMusic);
      // la musique d'origine remplacée n'est plus utilisée
      if (!keepOld) created.splice(0, created.length, ...created.filter((c) => c.key !== "music"));
      cur.music = newMusic;
      created.push({ key: "music", file: newMusic, label: `Musique (${label.replace(/^la piste /, "")})`, role: "musique" });
      summary = `Musique changée : ${label}, ${keepOld ? "mélangée au son d'origine" : separated ? "à la place de l'ancienne musique (voix off et bruitages gardés)" : "à la place du son d'origine"}.`;
    } else {
      const v = spec.voice!;
      if (!isVoiceId(v.voiceId)) throw new Impossible("voix inconnue");
      await step("Enregistrement de la voix off");
      const t = await tts(v.voiceId, v.text, v.speed);
      cost += t.cost;
      const vd = (await probeAudio(t.file)).duration;
      if (vd > duration) throw new Impossible(`la voix dure ${vd.toFixed(1)} s, plus que la vidéo (${duration.toFixed(1)} s) : raccourcis le texte`);
      let start = v.start === "debut" ? 0.3 : v.start === "fin" ? duration - vd - 0.4 : v.start;
      start = Math.max(0, Math.min(start, duration - vd - 0.1));
      await step("Mixage", 0.5);
      const voice = path.join(tmp, "voix.m4a");
      await track(["-i", t.file], `[0:a]${ST},volume=${v.volume.toFixed(2)},adelay=${Math.round(start * 1000)}:all=1,apad[a]`, duration, voice);
      // avec des pistes séparées, l'ancienne voix off est remplacée ; sinon la voix s'ajoute au son actuel
      cur.voice = voice;
      duck = v.duck;
      created.push({ key: "voice", file: voice, label: `Voix off ${voiceName(v.voiceId)} : « ${v.text.slice(0, 60)} »`, role: "voix" });
      summary = `Voix off ${cur.voice && stems?.voice ? "remplacée" : "ajoutée"} (${voiceName(v.voiceId)}) à ${fmt(start)} : « ${v.text} ».`;
    }
    await mixStems(base, cur, duck, duration, out);
    const data = new Uint8Array(await fs.readFile(out));
    if (cost > 0) await charge(space, cost, { kind: "retouche", by: r.by, note: `${r.kind === "voix" ? "Voix off" : "Musique"} · ${r.target.title}`.slice(0, 200) });

    let where: string;
    if (item) {
      // pistes de la nouvelle version : celles gardées + celles créées ici
      const next: VersionStems = { ...stems };
      if (!separated && !created.some((c) => c.key === "music")) delete next.music;
      for (const c of created) {
        const name = `${c.key === "voice" ? "voix" : "musique"}-${id}.m4a`.replace(/[^a-z0-9.-]/g, "");
        await putSource(space, item.id, { name, label: c.label, role: c.role, from: c.file, internal: true });
        next[c.key] = name;
      }
      const v = await addVersion(space, item.id, { fileName: "retouche.mp4", data, by: "ia@hytlabs.com", note: summary.slice(0, 500), stems: next });
      where = `version ${v.versions[v.versions.length - 1].n} dans la médiathèque`;
    } else {
      await saveRender(space, r.target.id, data);
      where = "nouvelle vidéo exportée dans le projet";
    }
    await updateRequest(space, id, {
      status: "livree",
      message: {
        by: "ia@hytlabs.com",
        byName: ASSISTANT,
        staff: true,
        text: `C'est fait ! ${summary}\nNouvelle ${where}. Pour essayer d'autres réglages (voix, vitesse, musique…), fais une nouvelle demande depuis la médiathèque.`,
      },
    });
    await setAi(space, id, { state: "terminee", step: "Livrée", progress: 1, finishedAt: Date.now(), delivered: where });
    await delivered_(space, id, summary, where);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

/**
 * Son d'une retouche visuelle : le son se modifie à part (retouches musique / voix off). Si la durée n'a pas
 * changé, la nouvelle image garde à l'identique le son de la dernière version (et ses pistes séparées).
 * Sinon on garde le son du rendu.
 */
async function keepAudio(space: SpaceId, mediaId: string, rendered: Uint8Array): Promise<{ data: Uint8Array; stems?: VersionStems } | null> {
  const item = await getMedia(space, mediaId);
  const last = item?.versions[item.versions.length - 1];
  const f = item && last ? mediaFilePath(space, item) : null;
  if (!f || !last) return null;
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "son-"));
  try {
    const video = path.join(tmp, "image.mp4");
    await fs.writeFile(video, rendered);
    const [a, b] = await Promise.all([probeAudio(video), probeAudio(f.path)]);
    if (!b.hasAudio || Math.abs(a.duration - b.duration) > 0.2) return null;
    const out = path.join(tmp, "out.mp4");
    await run("ffmpeg", ["-loglevel", "error", "-y", "-i", video, "-i", f.path, "-map", "0:v:0", "-map", "1:a:0", "-c", "copy", "-shortest", "-movflags", "+faststart", out]);
    return { data: new Uint8Array(await fs.readFile(out)), stems: last.stems };
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
