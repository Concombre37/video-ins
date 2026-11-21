import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth";
import { getProject } from "@/lib/history-store";
import { getMedia } from "@/lib/media-store";
import { enqueueRetouch } from "@/lib/auto-retouch";
import { notifyStaff } from "@/lib/notify";
import { createRequest, KIND_LABEL, listRequests, type AudioSpec, type MusicSpec, type RequestKind } from "@/lib/requests-store";
import { SPACES, type SpaceId } from "@/lib/spaces";
import { MUSIC_TRACKS } from "@/lib/video-settings";
import { isVoiceId, MAX_TTS_CHARS, voiceName } from "@/lib/voices";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  return NextResponse.json(await listRequests(ctx.space));
}

const num = (v: unknown, min: number, max: number, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

/** Réglages d'une retouche musique / voix off, vérifiés. Renvoie un message d'erreur en cas de problème. */
async function parseAudio(space: SpaceId, kind: RequestKind, b: Record<string, unknown>): Promise<AudioSpec | string> {
  const a: AudioSpec = {};
  if (b.baseVersion != null) a.baseVersion = Math.round(num(b.baseVersion, 1, 9999, 1));
  if (kind === "musique") {
    const m = (b.music ?? {}) as Record<string, unknown>;
    let pick: MusicSpec;
    if (m.source === "track" && MUSIC_TRACKS.some((t) => t.id === m.id)) pick = { source: "track", id: String(m.id) };
    else if (m.source === "media") {
      const item = await getMedia(space, String(m.mediaId ?? ""));
      if (!item || item.kind !== "audio") return "Musique introuvable dans la médiathèque";
      pick = { source: "media", mediaId: item.id, title: item.title };
    } else if (m.source === "ia" && String(m.prompt ?? "").trim().length >= 3) pick = { source: "ia", prompt: String(m.prompt).trim().slice(0, 400) };
    else return "Choisis une musique (piste fournie, fichier de la médiathèque ou description pour l'IA)";
    a.music = { pick, mode: m.mode === "mixer" ? "mixer" : "remplacer", volume: num(m.volume, 0.05, 1, 0.7) };
  } else {
    const v = (b.voice ?? {}) as Record<string, unknown>;
    const text = String(v.text ?? "").trim();
    if (text.length < 2) return "Écris le texte que la voix doit dire";
    if (text.length > MAX_TTS_CHARS) return `Texte trop long (${MAX_TTS_CHARS} caractères au maximum)`;
    if (!isVoiceId(v.voiceId)) return "Choisis une voix";
    const start = v.start === "debut" || v.start === "fin" ? v.start : num(v.start, 0, 3600, 0);
    a.voice = { text, voiceId: v.voiceId, speed: num(v.speed, 0.7, 1.2, 1), start, duck: v.duck !== false, volume: num(v.volume, 0.1, 1.5, 1) };
  }
  return a;
}

/**
 * Nouvelle demande de retouche :
 * { targetType: "media"|"project", targetId, kind: "visuel"|"musique"|"voix", text, timecode, notify, audio? }
 */
export async function POST(req: Request) {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  const b = await req.json().catch(() => ({}));
  const kind: RequestKind = b.kind === "musique" || b.kind === "voix" ? b.kind : "visuel";
  let title: string | null = null;
  let isVideo = true;
  if (b.targetType === "media") {
    const item = await getMedia(ctx.space, String(b.targetId));
    title = item?.title ?? null;
    isVideo = item?.kind === "video";
  } else if (b.targetType === "project") title = (await getProject(ctx.space, String(b.targetId)))?.title ?? null;
  if (!title) return NextResponse.json({ error: "Vidéo introuvable" }, { status: 404 });

  let audio: AudioSpec | undefined;
  let text = String(b.text ?? "").trim();
  if (kind === "visuel") {
    if (text.length < 3) return NextResponse.json({ error: "Décris la retouche souhaitée" }, { status: 400 });
  } else {
    if (!isVideo) return NextResponse.json({ error: "La musique et la voix off ne se changent que sur une vidéo" }, { status: 400 });
    const a = await parseAudio(ctx.space, kind, (b.audio ?? {}) as Record<string, unknown>);
    if (typeof a === "string") return NextResponse.json({ error: a }, { status: 400 });
    audio = a;
    // résumé lisible dans le fil de la demande
    const summary =
      kind === "musique"
        ? `Changer la musique : ${a.music!.pick.source === "track" ? `piste « ${MUSIC_TRACKS.find((t) => t.id === (a.music!.pick as { id: string }).id)?.label} »` : a.music!.pick.source === "media" ? `fichier « ${a.music!.pick.title} »` : `musique générée (« ${a.music!.pick.prompt} »)`}, ${a.music!.mode === "remplacer" ? "à la place du son d'origine" : "mélangée au son d'origine"}, volume ${Math.round(a.music!.volume * 100)} %.`
        : `Voix off (${voiceName(a.voice!.voiceId)}, vitesse ${a.voice!.speed.toFixed(2).replace(".", ",")}, ${a.voice!.start === "debut" ? "au début" : a.voice!.start === "fin" ? "à la fin" : `à ${a.voice!.start} s`}${a.voice!.duck ? ", son d'origine baissé pendant la voix" : ""}) : « ${a.voice!.text} »`;
    text = text ? `${summary}\n${text}` : summary;
  }

  const r = await createRequest(ctx.space, {
    target: { type: b.targetType, id: String(b.targetId), title },
    timecode: kind === "visuel" && b.timecode ? String(b.timecode) : undefined,
    text,
    by: ctx.session.email,
    byName: ctx.session.name,
    staff: ctx.session.admin,
    kind,
    audio,
    notify: b.notify === true,
  });
  // retouche automatique lancée tout de suite
  await enqueueRetouch(ctx.space, r.id);
  if (!ctx.session.admin) {
    await notifyStaff(
      `🎬 Nouvelle demande de retouche ${KIND_LABEL[kind].toLowerCase()} (${SPACES[ctx.space].name}) par ${ctx.session.name}\n« ${title} »${r.timecode ? ` à ${r.timecode}` : ""}\n${text}\nhttps://video.hytlabs.com/requests`,
    );
  }
  return NextResponse.json(r);
}
