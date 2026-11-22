"use client";

/* eslint-disable @next/next/no-img-element */
import { PageLayout } from "@/components/PageLayout";
import { useSpace } from "@/components/SpaceProvider";
import type { ProjectSummary } from "@/lib/history-store";
import type { MediaItem } from "@/lib/media-store";
import { SOURCE_ROLE_LABEL, type SourceRole } from "@/lib/source-roles";
import { cn } from "@/lib/utils";
import { MUSIC_TRACKS } from "@/lib/video-settings";
import { DEFAULT_VOICE, MAX_TTS_CHARS } from "@/lib/voices";
import {
  Download,
  Eye,
  FileArchive,
  FileText,
  Film,
  ImageIcon,
  Bell,
  Loader2,
  MessageSquarePlus,
  Mic,
  Play,
  Square,
  Music2,
  PenLine,
  Search,
  Sparkles,
  Trash2,
  Type as TypeIcon,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import type { NextPage } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const dateFmt = (t: number) => new Date(t).toLocaleDateString("fr-FR", { dateStyle: "medium" });
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;

/** Élément affiché : média de la médiathèque ou vidéo exportée depuis un projet du studio. */
type Entry =
  | { kind: "media"; key: string; title: string; type: MediaItem["kind"]; date: number; item: MediaItem }
  | { kind: "studio"; key: string; title: string; type: "video"; date: number; project: ProjectSummary };

type Filter = "all" | "video" | "image" | "audio" | "docs" | "studio";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "video", label: "Vidéos" },
  { id: "image", label: "Visuels" },
  { id: "audio", label: "Sons" },
  { id: "docs", label: "Documents et polices" },
  { id: "studio", label: "Créées dans le studio" },
];

const isDoc = (t: Entry["type"]) => t === "document" || t === "font" || t === "fichier";
const extOfEntry = (e: Entry) =>
  e.kind === "media" ? e.item.versions[e.item.versions.length - 1].file.split(".").pop()?.toUpperCase() ?? "" : "MP4";

/** Police d'un média chargée dans la page pour l'aperçu */
function useMediaFont(e: Entry) {
  const [family, setFamily] = useState<string | null>(null);
  useEffect(() => {
    if (e.type !== "font" || e.kind !== "media") return;
    const name = `media-${e.item.id}`;
    const face = new FontFace(name, `url(/api/media/${e.item.id}/file)`);
    face
      .load()
      .then((f) => {
        document.fonts.add(f);
        setFamily(name);
      })
      .catch(() => undefined);
  }, [e]);
  return family;
}

function DocTile({ e, className, big }: { e: Entry; className?: string; big?: boolean }) {
  const family = useMediaFont(e);
  const Icon = e.type === "document" ? FileText : e.type === "font" ? TypeIcon : FileArchive;
  return (
    <div className={cn("flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-center", className)}>
      {family ? (
        <span style={{ fontFamily: family }} className={cn("leading-tight text-foreground", big ? "text-6xl" : "text-4xl")}>
          Aa Bb 123
          {big && <span className="mt-4 block text-2xl">Le pilote franchit la ligne en tête</span>}
        </span>
      ) : (
        <Icon className={cn("text-primary", big ? "w-20 h-20" : "w-12 h-12")} />
      )}
      <span className="rounded bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">{extOfEntry(e)}</span>
    </div>
  );
}

const fileUrl = (e: Entry, opts: { v?: number; download?: boolean } = {}) => {
  if (e.kind === "media") {
    // lecture : copie légère si l'original est trop lourd pour le navigateur
    if (!opts.v && !opts.download && e.item.hasPreview) return `/api/media/${e.item.id}/file?preview`;
    const q = new URLSearchParams();
    if (opts.v) q.set("v", String(opts.v));
    if (opts.download) q.set("download", "");
    const qs = q.toString();
    return `/api/media/${e.item.id}/file${qs ? `?${qs}` : ""}`;
  }
  const r = e.project.renders[0];
  return `/api/history/${e.project.id}/renders/${r.file}${opts.download ? "?download" : ""}`;
};

/** Envoi avec barre de progression (fetch ne la donne pas). */
function upload(url: string, form: FormData, onProgress: (p: number) => void) {
  return new Promise<unknown>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let body: { error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* réponse non JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new Error(body.error ?? `Erreur ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Connexion interrompue"));
    xhr.send(form);
  });
}

function Preview({ e, className }: { e: Entry; className?: string }) {
  if (isDoc(e.type)) return <DocTile e={e} className={className} />;
  if (e.type === "image") return <img src={fileUrl(e)} alt="" loading="lazy" className={cn("object-contain", className)} />;
  if (e.type === "audio") {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 p-4", className)}>
        <Music2 className="w-10 h-10 text-primary" />
        <audio src={fileUrl(e)} controls preload="none" className="w-full" />
      </div>
    );
  }
  const poster = e.kind === "media" && e.item.hasPoster ? `/api/media/${e.item.id}/poster` : undefined;
  return (
    <video
      src={fileUrl(e)}
      poster={poster}
      preload={poster ? "none" : "metadata"}
      muted
      playsInline
      loop
      onMouseEnter={(ev) => ev.currentTarget.play().catch(() => undefined)}
      onMouseLeave={(ev) => ev.currentTarget.pause()}
      className={cn("object-contain", className)}
    />
  );
}

function Modal({ onClose, children, wide }: { onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={onClose}>
      <div
        className={cn(
          "relative max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-border bg-background-elevated p-5 shadow-2xl",
          wide ? "max-w-5xl" : "max-w-lg",
        )}
        onMouseDown={(ev) => ev.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Fermer">
          <X className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

type Kind = "visuel" | "musique" | "voix";
type VoiceOpt = { id: string; name: string; gender: string; hint: string; preview: string | null };
const KINDS: { id: Kind; label: string; hint: string; Icon: typeof PenLine }[] = [
  { id: "visuel", label: "Visuel", hint: "textes, logo, couleurs, scènes…", Icon: PenLine },
  { id: "musique", label: "Musique", hint: "changer seulement la musique", Icon: Music2 },
  { id: "voix", label: "Voix off", hint: "ajouter une voix qui lit ton texte", Icon: Mic },
];
const field =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground-dim focus:outline-none focus:border-primary";
const pill = (on: boolean) =>
  cn(
    "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
    on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground",
  );
const pct = (v: number) => `${Math.round(v * 100)} %`;

/** « 0:52 », « 52 », « 1m05 » → secondes */
function parseTc(tc: string): number | null {
  const m = tc.trim().match(/^(\d+)\s*[:m']\s*(\d{1,2})$|^(\d+(?:[.,]\d+)?)\s*s?$/);
  if (!m) return null;
  return m[1] ? Number(m[1]) * 60 + Number(m[2]) : Number(m[3].replace(",", "."));
}

function PlayButton({ src, label = "Écouter" }: { src: string | (() => Promise<string>); label?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  const toggle = async (ev: React.MouseEvent) => {
    ev.preventDefault();
    if (state === "playing") {
      audio.current?.pause();
      setState("idle");
      return;
    }
    try {
      setState("loading");
      const url = typeof src === "string" ? src : await src();
      audio.current?.pause();
      const a = new Audio(url);
      audio.current = a;
      a.onended = () => setState("idle");
      await a.play();
      setState("playing");
    } catch {
      setState("idle");
    }
  };
  return (
    <button type="button" onClick={toggle} className="flex shrink-0 items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs text-foreground hover:bg-secondary/70">
      {state === "loading" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : state === "playing" ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
      {state === "playing" ? "Stop" : label}
    </button>
  );
}

function RequestForm({ e, timecode, audios, onDone }: { e: Entry; timecode?: string; audios: { id: string; title: string }[]; onDone: () => void }) {
  const [kind, setKind] = useState<Kind>("visuel");
  const [text, setText] = useState("");
  const [tc, setTc] = useState(timecode ?? "");
  const [notify, setNotify] = useState(false);
  const versions = e.kind === "media" ? e.item.versions : [];
  const [baseVersion, setBaseVersion] = useState<number | undefined>(versions.length ? versions[versions.length - 1].n : undefined);
  // musique
  const [source, setSource] = useState<"track" | "media" | "ia">("track");
  const [track, setTrack] = useState<string>(MUSIC_TRACKS[0].id);
  const [audioId, setAudioId] = useState(audios[0]?.id ?? "");
  const [musicPrompt, setMusicPrompt] = useState("");
  const [mode, setMode] = useState<"remplacer" | "mixer">("remplacer");
  const [musicVolume, setMusicVolume] = useState(0.7);
  // voix off
  const [voices, setVoices] = useState<VoiceOpt[] | null>(null);
  const [voiceText, setVoiceText] = useState("");
  const [voiceId, setVoiceId] = useState<string>(DEFAULT_VOICE);
  const [speed, setSpeed] = useState(1);
  const [when, setWhen] = useState<"debut" | "fin" | "moment">(timecode ? "moment" : "fin");
  const [at, setAt] = useState(timecode ?? "");
  const [duck, setDuck] = useState(true);
  const [voiceVolume, setVoiceVolume] = useState(1);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const canAudio = e.type === "video";

  useEffect(() => {
    if (kind !== "voix" || voices) return;
    fetch("/api/voices")
      .then((r) => (r.ok ? r.json() : []))
      .then(setVoices)
      .catch(() => setVoices([]));
  }, [kind, voices]);

  const listenVoice = async () => {
    const res = await fetch("/api/voices/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceId, text: voiceText, speed }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? `Erreur ${res.status}`);
      throw new Error("écoute impossible");
    }
    return URL.createObjectURL(await res.blob());
  };

  const atSeconds = parseTc(at);
  const valid =
    kind === "visuel"
      ? text.trim().length >= 3
      : kind === "musique"
        ? source === "track" || (source === "media" && !!audioId) || (source === "ia" && musicPrompt.trim().length >= 3)
        : voiceText.trim().length >= 2 && (when !== "moment" || atSeconds != null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const audio =
        kind === "musique"
          ? {
              baseVersion,
              music: {
                source,
                id: track,
                mediaId: audioId,
                prompt: musicPrompt,
                mode,
                volume: musicVolume,
              },
            }
          : kind === "voix"
            ? { baseVersion, voice: { text: voiceText, voiceId, speed, start: when === "moment" ? atSeconds : when, duck, volume: voiceVolume } }
            : undefined;
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: e.kind === "media" ? "media" : "project",
          targetId: e.kind === "media" ? e.item.id : e.project.id,
          kind,
          text,
          timecode: kind === "visuel" ? tc : undefined,
          notify,
          audio,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Erreur ${res.status}`);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Demande envoyée</h2>
        <p className="text-sm text-muted-foreground">
          {kind === "visuel" ? "L'IA s'en occupe tout de suite" : "Le nouveau son est préparé tout de suite"} : la nouvelle version arrive dans
          la médiathèque en quelques minutes{notify ? " et tu es prévenu par email" : ""}. Suis l&apos;avancement dans{" "}
          <Link href="/requests" className="text-primary hover:underline">Retouches</Link>. Si ça ne marche pas, l&apos;équipe HytLabs prend le relais.
        </p>
        <button onClick={onDone} className="self-end rounded-lg bg-secondary px-4 py-2 text-sm text-foreground hover:bg-primary hover:text-primary-foreground">
          Fermer
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="pr-8 text-lg font-semibold text-foreground">Demander une retouche</h2>
        <p className="text-sm text-muted-foreground">« {e.title} »</p>
      </div>

      {canAudio && (
        <div className="grid grid-cols-3 gap-2" role="tablist">
          {KINDS.map(({ id, label, hint, Icon }) => (
            <button key={id} role="tab" aria-selected={kind === id} onClick={() => setKind(id)} className={pill(kind === id)}>
              <span className="flex items-center gap-1.5 font-medium">
                <Icon className="w-4 h-4" /> {label}
              </span>
              <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">{hint}</span>
            </button>
          ))}
        </div>
      )}

      {kind === "visuel" && (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Ce qu&apos;il faut changer à l&apos;image
            <textarea
              value={text}
              onChange={(ev) => setText(ev.target.value)}
              rows={5}
              autoFocus
              placeholder="Ex. : changer le prix en 29 €, mettre notre adresse à la fin, logo plus gros…"
              className={cn(field, "p-3")}
            />
          </label>
          {e.type === "video" && (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              À quel moment de la vidéo ? (facultatif)
              <input value={tc} onChange={(ev) => setTc(ev.target.value)} placeholder="Ex. : 0:52, ou « à la fin »" className={field} />
            </label>
          )}
        </>
      )}

      {kind === "musique" && (
        <>
          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            Nouvelle musique
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["track", "Musique fournie"],
                  ["media", "Ma médiathèque"],
                  ["ia", "Composée par l'IA"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} onClick={() => setSource(id)} className={pill(source === id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {source === "track" && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MUSIC_TRACKS.map((t) => (
                <div key={t.id} onClick={() => setTrack(t.id)} className={cn(pill(track === t.id), "flex cursor-pointer items-center justify-between gap-2")}>
                  <span className="min-w-0">
                    <span className="block font-medium">{t.label}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{t.hint}</span>
                  </span>
                  <PlayButton src={t.src} />
                </div>
              ))}
            </div>
          )}
          {source === "media" &&
            (audios.length ? (
              <select value={audioId} onChange={(ev) => setAudioId(ev.target.value)} className={field}>
                {audios.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                Aucun son dans la médiathèque. Envoie d&apos;abord ton fichier (MP3 ou WAV) avec le bouton « Envoyer des fichiers ».
              </p>
            ))}
          {source === "ia" && (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Décris la musique (style, ambiance, rythme)
              <textarea
                value={musicPrompt}
                onChange={(ev) => setMusicPrompt(ev.target.value)}
                rows={3}
                placeholder="Ex. : électro rapide et intense, ambiance course automobile, montée en puissance"
                className={cn(field, "p-3")}
              />
              <span className="text-[11px] text-muted-foreground-dim">Instrumentale, à la durée de la vidéo. Environ 0,04 à 0,07 € débités du crédit.</span>
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMode("remplacer")} className={pill(mode === "remplacer")}>
              <span className="block font-medium">Remplacer le son</span>
              <span className="block text-[11px] text-muted-foreground">la vidéo n&apos;aura plus que cette musique</span>
            </button>
            <button onClick={() => setMode("mixer")} className={pill(mode === "mixer")}>
              <span className="block font-medium">Mélanger</span>
              <span className="block text-[11px] text-muted-foreground">garde le son d&apos;origine (voix, bruitages)</span>
            </button>
          </div>
          <label className="flex items-center gap-3 text-xs text-muted-foreground">
            Volume de la musique
            <input type="range" min={0.1} max={1} step={0.05} value={musicVolume} onChange={(ev) => setMusicVolume(Number(ev.target.value))} className="flex-1 accent-[var(--primary)]" />
            <span className="w-10 text-right text-foreground">{pct(musicVolume)}</span>
          </label>
        </>
      )}

      {kind === "voix" && (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="flex justify-between">
              Texte lu par la voix <span className={voiceText.length > MAX_TTS_CHARS ? "text-red-400" : ""}>{voiceText.length}/{MAX_TTS_CHARS}</span>
            </span>
            <textarea
              value={voiceText}
              onChange={(ev) => setVoiceText(ev.target.value)}
              rows={3}
              autoFocus
              placeholder="Ex. : Qualifie-toi chez Elsass SimRacing… et gagne ton baquet en Alpine Cup !"
              className={cn(field, "p-3")}
            />
          </label>
          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            Voix
            {!voices ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {voices.map((v) => (
                  <div key={v.id} onClick={() => setVoiceId(v.id)} className={cn(pill(voiceId === v.id), "flex cursor-pointer items-center justify-between gap-2 py-1.5")}>
                    <span className="min-w-0">
                      <span className="block font-medium">
                        {v.name} <span className="text-[11px] font-normal text-muted-foreground">{v.gender === "f" ? "femme" : "homme"}</span>
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">{v.hint}</span>
                    </span>
                    {v.preview && <PlayButton src={v.preview} label="Extrait" />}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-3 text-xs text-muted-foreground">
              Vitesse
              <input type="range" min={0.8} max={1.2} step={0.05} value={speed} onChange={(ev) => setSpeed(Number(ev.target.value))} className="flex-1 accent-[var(--primary)]" />
              <span className="w-10 text-right text-foreground">×{speed.toFixed(2).replace(".", ",")}</span>
            </label>
            <label className="flex items-center gap-3 text-xs text-muted-foreground">
              Volume
              <input type="range" min={0.3} max={1.5} step={0.05} value={voiceVolume} onChange={(ev) => setVoiceVolume(Number(ev.target.value))} className="flex-1 accent-[var(--primary)]" />
              <span className="w-10 text-right text-foreground">{pct(voiceVolume)}</span>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            Moment
            <select value={when} onChange={(ev) => setWhen(ev.target.value as typeof when)} className={cn(field, "py-1.5")}>
              <option value="debut">Au début</option>
              <option value="fin">À la fin</option>
              <option value="moment">À un instant précis</option>
            </select>
            {when === "moment" && (
              <input value={at} onChange={(ev) => setAt(ev.target.value)} placeholder="ex. 0:52" className={cn(field, "w-24 py-1.5", at && atSeconds == null && "border-red-400")} />
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={duck} onChange={(ev) => setDuck(ev.target.checked)} className="accent-[var(--primary)]" />
            Baisser la musique d&apos;origine pendant la voix
          </label>
          {voiceText.trim().length >= 2 && voiceText.length <= MAX_TTS_CHARS && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground-dim">
              <PlayButton key={`${voiceId}|${speed}|${voiceText}`} src={listenVoice} label="Écouter mon texte" />
              quelques centimes, pas repayés à l&apos;envoi de la demande
            </div>
          )}
        </>
      )}

      {kind !== "visuel" && versions.length > 1 && (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Partir de la version
          <select value={baseVersion} onChange={(ev) => setBaseVersion(Number(ev.target.value))} className={field}>
            {[...versions].reverse().map((v, i) => (
              <option key={v.n} value={v.n}>
                Version {v.n}
                {i === 0 ? " (la dernière)" : ""}
                {v.n === 1 ? " (l'originale)" : ""}
                {v.note ? ` · ${v.note.slice(0, 50)}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {kind !== "visuel" && (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Précision pour l&apos;équipe (facultatif)
          <input value={text} onChange={(ev) => setText(ev.target.value)} className={field} />
        </label>
      )}

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={notify} onChange={(ev) => setNotify(ev.target.checked)} className="accent-[var(--primary)]" />
        <Bell className="w-4 h-4" /> Me prévenir par email quand c&apos;est prêt
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        onClick={send}
        disabled={busy || !valid}
        className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquarePlus className="w-4 h-4" />} Envoyer la demande
      </button>
    </div>
  );
}

/** Fichiers source d'une vidéo : projet de montage, vidéo sans textes, pistes séparées… */
function SourceFiles({ item, admin, onChanged }: { item: MediaItem; admin: boolean; onChanged: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const [role, setRole] = useState<SourceRole>("projet");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const all = item.sources ?? [];
  const list = all.filter((x) => showAll || !x.internal);
  const url = (name: string, download?: boolean) => `/api/media/${item.id}/sources/${encodeURIComponent(name)}${download ? "?download" : ""}`;
  if (!all.length && !admin) return null;
  const send = async (file: File) => {
    const form = new FormData();
    form.set("file", file);
    form.set("role", role);
    form.set("label", file.name);
    setError(null);
    try {
      setProgress(0);
      await upload(`/api/media/${item.id}/sources`, form, setProgress);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress(null);
    }
  };
  const remove = async (name: string) => {
    if (!confirm("Supprimer ce fichier source ?")) return;
    await fetch(url(name), { method: "DELETE" });
    onChanged();
  };
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Fichiers source
        {all.some((x) => x.internal) && (
          <button onClick={() => setShowAll(!showAll)} className="text-[11px] font-normal normal-case tracking-normal text-primary hover:underline">
            {showAll ? "masquer les pistes des retouches" : "voir les pistes des retouches"}
          </button>
        )}
      </h3>
      {list.length === 0 && <p className="text-xs text-muted-foreground">Aucun fichier source.</p>}
      {list.map((x) => (
        <div key={x.name} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-foreground" title={x.label}>{x.label}</span>
            <span className="text-[11px] text-muted-foreground">
              {SOURCE_ROLE_LABEL[x.role]} · {mb(x.size)}
            </span>
          </span>
          {/\.(mp3|wav|m4a)$/.test(x.name) && <PlayButton src={url(x.name)} label="" />}
          <a href={url(x.name, true)} className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Télécharger">
            <Download className="w-3.5 h-3.5" />
          </a>
          {admin && (
            <button onClick={() => remove(x.name)} className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-red-400" title="Supprimer">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
      {admin && (
        <div className="flex items-center gap-2">
          <select value={role} onChange={(ev) => setRole(ev.target.value as SourceRole)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground">
            {Object.entries(SOURCE_ROLE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-foreground">
            {progress != null ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {progress != null ? `${Math.round(progress * 100)} %` : "Ajouter"}
            <input type="file" className="hidden" disabled={progress != null} onChange={(ev) => ev.target.files?.[0] && send(ev.target.files[0])} />
          </label>
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function Viewer({ e, admin, onRequest, onChanged }: { e: Entry; admin: boolean; onRequest: (tc?: string) => void; onChanged: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const versions = e.kind === "media" ? [...e.item.versions].reverse() : [];
  const [v, setV] = useState<number | undefined>(undefined);
  const [progress, setProgress] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const src = fileUrl(e, { v });

  const deliver = async (file: File) => {
    if (e.kind !== "media") return;
    const form = new FormData();
    form.set("file", file);
    form.set("note", note);
    setError(null);
    try {
      setProgress(0);
      await upload(`/api/media/${e.item.id}/versions`, form, setProgress);
      setNote("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex max-h-[80vh] items-center justify-center rounded-xl bg-black">
        {e.type === "document" ? (
          <iframe src={src} title={e.title} className="h-[80vh] w-full rounded-xl bg-white" />
        ) : isDoc(e.type) ? (
          <DocTile e={e} big className="min-h-[50vh]" />
        ) : e.type === "image" ? (
          <img src={src} alt="" className="max-h-[80vh] max-w-full object-contain" />
        ) : e.type === "audio" ? (
          <audio key={src} src={src} controls autoPlay className="w-full p-6" />
        ) : (
          <video key={src} ref={videoRef} src={src} controls autoPlay playsInline className="max-h-[80vh] max-w-full" />
        )}
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="pr-8 text-lg font-semibold leading-snug text-foreground">{e.title}</h2>
        <div className="flex flex-col gap-2">
          <a
            href={fileUrl(e, { v, download: true })}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <Download className="w-4 h-4" /> Télécharger
          </a>
          <button
            onClick={() => onRequest(videoRef.current ? fmtTime(videoRef.current.currentTime) : undefined)}
            className="flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm text-foreground hover:bg-secondary/70"
          >
            <MessageSquarePlus className="w-4 h-4" /> Demander une retouche
            {e.type === "video" && <span className="text-xs text-muted-foreground">(à cet instant)</span>}
          </button>
          {e.kind === "studio" && (
            <Link
              href={`/generate?project=${e.project.id}`}
              className="flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm text-foreground hover:bg-secondary/70"
            >
              <Sparkles className="w-4 h-4" /> Modifier avec l&apos;IA
            </Link>
          )}
        </div>

        {versions.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Versions</h3>
            {versions.map((x, i) => {
              const current = v ? v === x.n : i === 0;
              return (
                <button
                  key={x.n}
                  onClick={() => setV(i === 0 ? undefined : x.n)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                    current ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/50",
                  )}
                >
                  <span className="font-semibold">Version {x.n}</span>
                  {i === 0 && " · la plus récente"} · {dateFmt(x.createdAt)} · {mb(x.size)}
                  {x.stems && <span className="ml-1 rounded bg-secondary px-1 py-0.5 text-[10px] text-muted-foreground">pistes séparées</span>}
                  {x.note && <span className="mt-1 block text-muted-foreground">{x.note}</span>}
                </button>
              );
            })}
          </div>
        )}

        {e.kind === "media" && <SourceFiles item={e.item} admin={admin} onChanged={onChanged} />}

        {admin && e.kind === "media" && (
          <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Livrer une nouvelle version</h3>
            <input
              value={note}
              onChange={(ev) => setNote(ev.target.value)}
              placeholder="Note pour le client (facultatif)"
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
            />
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs text-foreground hover:bg-secondary/70">
              {progress != null ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {progress != null ? `Envoi… ${Math.round(progress * 100)} %` : "Choisir le fichier"}
              <input type="file" className="hidden" disabled={progress != null} onChange={(ev) => ev.target.files?.[0] && deliver(ev.target.files[0])} />
            </label>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

const MediaPage: NextPage = () => (
  <PageLayout>
    <MediaLibrary />
  </PageLayout>
);

function MediaLibrary() {
  const { me } = useSpace();
  const admin = me.user.admin;
  const [media, setMedia] = useState<MediaItem[] | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState<string>("");
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<Entry | null>(null);
  const [requesting, setRequesting] = useState<{ e: Entry; tc?: string } | null>(null);
  const [uploads, setUploads] = useState<{ name: string; p: number; error?: string }[]>([]);
  const [dragging, setDragging] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([
        fetch("/api/media", { cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Erreur ${r.status}`)))),
        fetch("/api/history", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])),
      ]);
      setMedia(m);
      setProjects(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = (media ?? []).map((item) => ({ kind: "media", key: `m-${item.id}`, title: item.title, type: item.kind, date: item.updatedAt, item }));
    for (const p of projects) {
      // les projets de retouche d'un média sont déjà livrés comme versions de ce média
      if (p.renders.length && !p.sourceMediaId) list.push({ kind: "studio", key: `p-${p.id}`, title: p.title, type: "video", date: p.renders[0].createdAt, project: p });
    }
    return list.sort((a, b) => b.date - a.date);
  }, [media, projects]);

  const categories = useMemo(
    () => [...new Set((media ?? []).map((m) => m.category).filter((c): c is string => !!c))].sort(),
    [media],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter === "studio" ? e.kind !== "studio" : filter === "docs" ? !isDoc(e.type) : filter !== "all" && e.type !== filter) return false;
      if (category && (e.kind !== "media" || e.item.category !== category)) return false;
      return !q || e.title.toLowerCase().includes(q);
    });
  }, [entries, filter, category, query]);

  const sendFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.set("file", file);
      if (category) form.set("category", category);
      setUploads((u) => [...u, { name: file.name, p: 0 }]);
      const set = (patch: { p?: number; error?: string }) =>
        setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, ...patch } : x)));
      try {
        await upload("/api/media", form, (p) => set({ p }));
        setUploads((u) => u.filter((x) => x.name !== file.name));
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    }
    load();
  };

  const remove = async (e: Entry) => {
    if (e.kind !== "media") return;
    if (!window.confirm(`Supprimer « ${e.title} » de la médiathèque ?\nCette action est définitive.`)) return;
    const res = await fetch(`/api/media/${e.item.id}`, { method: "DELETE" });
    if (!res.ok) window.alert((await res.json().catch(() => ({}))).error ?? "Suppression impossible");
    load();
  };

  const canDelete = (e: Entry) => e.kind === "media" && (admin || (e.item.source === "envoi" && e.item.versions[0]?.by === me.user.email));

  return (
    <main
      className="relative flex-1 overflow-y-auto"
      onDragOver={(ev) => {
        ev.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(ev) => ev.currentTarget === ev.target && setDragging(false)}
      onDrop={(ev) => {
        ev.preventDefault();
        setDragging(false);
        if (ev.dataTransfer.files.length) sendFiles(ev.dataTransfer.files);
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-3 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/10 text-lg font-semibold text-primary">
          Dépose tes fichiers pour les ajouter à la médiathèque
        </div>
      )}
      <div className="mx-auto w-full max-w-7xl px-6 py-8 flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Médiathèque</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Toutes les vidéos et visuels créés pour {me.spaces.find((s) => s.id === me.space)?.name}. Regarde-les,
              télécharge-les, demande une retouche, ou ajoute tes propres photos et vidéos.
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
            <UploadCloud className="w-4 h-4" /> Ajouter des fichiers
            <input type="file" multiple accept="video/*,image/*,audio/*,.pdf,.ttf,.otf,.woff,.woff2,.ai,.eps,.zip" className="hidden" onChange={(ev) => ev.target.files && sendFiles(ev.target.files)} />
          </label>
        </div>

        {uploads.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-xl border border-border bg-background-elevated p-3 text-xs">
            {uploads.map((u) => (
              <li key={u.name} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-foreground">{u.name}</span>
                {u.error ? (
                  <span className="text-red-400">{u.error}</span>
                ) : (
                  <span className="h-1.5 w-40 overflow-hidden rounded-full bg-secondary">
                    <span className="block h-full bg-primary" style={{ width: `${u.p * 100}%` }} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-background-elevated p-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  filter === f.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          {categories.length > 0 && (
            <select
              value={category}
              onChange={(ev) => setCategory(ev.target.value)}
              className="rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm text-foreground"
              aria-label="Catégorie"
            >
              <option value="">Toutes les campagnes</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <label className="flex flex-1 min-w-[200px] items-center gap-2 rounded-lg border border-border bg-background-elevated px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              placeholder="Rechercher…"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground-dim focus:outline-none"
            />
          </label>
        </div>

        {error && <p className="text-sm text-red-400">Impossible de charger la médiathèque : {error}</p>}
        {!media && !error && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
        {media && entries.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            La médiathèque est vide pour l&apos;instant. Ajoute des fichiers ou{" "}
            <Link href="/" className="text-primary hover:underline">crée une vidéo</Link>.
          </div>
        )}
        {media && entries.length > 0 && shown.length === 0 && <p className="text-sm text-muted-foreground">Aucun fichier ne correspond.</p>}

        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
          {shown.map((e) => {
            const versions = e.kind === "media" ? e.item.versions.length : 1;
            const Icon = e.type === "image" ? ImageIcon : e.type === "audio" ? Music2 : isDoc(e.type) ? FileText : Film;
            return (
              <article key={e.key} className="group flex flex-col overflow-hidden rounded-xl border border-border bg-background-elevated">
                <button onClick={() => setViewing(e)} className="relative flex h-[260px] items-center justify-center bg-black/40" title="Voir">
                  <Preview e={e} className="max-h-full max-w-full" />
                  <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                    <Icon className="w-3 h-3" />
                    {e.kind === "studio" ? "Studio" : e.item.format ?? ({ image: "Visuel", audio: "Son", video: "Vidéo", document: "PDF", font: "Police", fichier: "Fichier" } as const)[e.type]}
                  </span>
                  {versions > 1 && (
                    <span className="absolute right-2 top-2 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">v{versions}</span>
                  )}
                </button>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <h2 className="line-clamp-2 text-sm font-semibold text-foreground" title={e.title}>
                    {e.title}
                  </h2>
                  <p className="text-[11px] text-muted-foreground-dim">
                    {e.kind === "media" && e.item.category ? `${e.item.category} · ` : ""}
                    {dateFmt(e.date)}
                    {e.kind === "media" && e.item.source === "envoi" ? " · envoyé par le client" : ""}
                  </p>
                  <div className="mt-auto flex items-center gap-1 pt-1">
                    <button onClick={() => setViewing(e)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Voir">
                      <Eye className="w-4 h-4" />
                    </button>
                    <a href={fileUrl(e, { download: true })} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Télécharger">
                      <Download className="w-4 h-4" />
                    </a>
                    <button onClick={() => setRequesting({ e })} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Demander une retouche">
                      <MessageSquarePlus className="w-4 h-4" />
                    </button>
                    {e.kind === "studio" && (
                      <Link href={`/generate?project=${e.project.id}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Modifier avec l'IA">
                        <PenLine className="w-4 h-4" />
                      </Link>
                    )}
                    {canDelete(e) && (
                      <button onClick={() => remove(e)} className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-red-400" title="Supprimer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {viewing && !requesting && (
        <Modal wide onClose={() => setViewing(null)}>
          <Viewer
            e={viewing}
            admin={admin}
            onRequest={(tc) => setRequesting({ e: viewing, tc })}
            onChanged={async () => {
              await load();
              setViewing(null);
            }}
          />
        </Modal>
      )}
      {requesting && (
        <Modal onClose={() => setRequesting(null)}>
          <RequestForm
            e={requesting.e}
            timecode={requesting.tc}
            audios={entries.flatMap((x) => (x.kind === "media" && x.type === "audio" ? [{ id: x.item.id, title: x.title }] : []))}
            onDone={() => { setRequesting(null); setViewing(null); }} />
        </Modal>
      )}
    </main>
  );
}

export default MediaPage;
