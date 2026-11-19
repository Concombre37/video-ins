"use client";

import { cn } from "@/lib/utils";
import {
  DURATIONS,
  FORMATS,
  FORMAT_IDS,
  MAX_CUSTOM_MUSIC_BYTES,
  MUSIC_TRACKS,
  musicLabel,
  musicSrc,
  type MusicChoice,
  type VideoFormat,
} from "@/lib/video-settings";
import { MODELS, type ModelId } from "@/types/generation";
import { Music, Pause, Play, Upload, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Petit titre de section pour les réglages. */
export function OptionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground-dim">
      {children}
    </span>
  );
}

function Chip({
  active,
  onClick,
  children,
  title,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-50",
        active
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border bg-background-elevated text-muted-foreground hover:text-foreground hover:border-primary/50",
      )}
    >
      {children}
    </button>
  );
}

/** Rectangle aux proportions du format, pour le reconnaître d'un coup d'œil. */
function FormatGlyph({ format }: { format: VideoFormat }) {
  const f = FORMATS[format];
  const max = 16;
  const w = f.width >= f.height ? max : Math.round((max * f.width) / f.height);
  const h = f.height >= f.width ? max : Math.round((max * f.height) / f.width);
  return (
    <span className="inline-flex w-4 h-4 items-center justify-center">
      <span className="rounded-[2px] border-[1.5px] border-current" style={{ width: w, height: h }} />
    </span>
  );
}

export function FormatPicker({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: VideoFormat;
  onChange: (f: VideoFormat) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {FORMAT_IDS.map((id) => (
        <Chip
          key={id}
          active={value === id}
          onClick={() => onChange(id)}
          title={FORMATS[id].hint}
          disabled={disabled}
        >
          <FormatGlyph format={id} />
          <span>{FORMATS[id].label}</span>
          {!compact && (
            <span className="hidden lg:inline text-xs text-muted-foreground-dim">{FORMATS[id].hint}</span>
          )}
        </Chip>
      ))}
    </div>
  );
}

export function DurationPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (s: number) => void;
  disabled?: boolean;
}) {
  const isPreset = (DURATIONS as readonly number[]).includes(value);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {DURATIONS.map((s) => (
        <Chip key={s} active={value === s} onClick={() => onChange(s)} disabled={disabled}>
          {s} s
        </Chip>
      ))}
      {!isPreset && (
        <Chip active onClick={() => undefined} disabled={disabled}>
          {String(value).replace(".", ",")} s
        </Chip>
      )}
    </div>
  );
}

export function ModelPicker({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: ModelId;
  onChange: (m: ModelId) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {MODELS.map((m) => (
        <Chip key={m.id} active={value === m.id} onClick={() => onChange(m.id)} disabled={disabled}>
          <span>{m.short}</span>
          {!compact && <span className="text-xs text-muted-foreground-dim">{m.hint}</span>}
        </Chip>
      ))}
    </div>
  );
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/**
 * Choix de la musique : pistes fournies (écoute possible), sans musique,
 * ou fichier importé. Volume optionnel.
 */
export function MusicPicker({
  value,
  onChange,
  volume,
  onVolumeChange,
  disabled,
}: {
  value: MusicChoice;
  onChange: (m: MusicChoice) => void;
  volume?: number;
  onVolumeChange?: (v: number) => void;
  disabled?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);
  useEffect(() => {
    if (audioRef.current && volume != null) audioRef.current.volume = volume;
  }, [volume]);

  const toggle = (key: string, src: string | null) => {
    const a = audioRef.current ?? new Audio();
    audioRef.current = a;
    if (playing === key) {
      a.pause();
      setPlaying(null);
      return;
    }
    if (!src) return;
    a.src = src;
    a.volume = volume ?? 0.6;
    a.loop = true;
    a.play().catch(() => setPlaying(null));
    setPlaying(key);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setError("Ce fichier n'est pas un fichier audio.");
      return;
    }
    if (file.size > MAX_CUSTOM_MUSIC_BYTES) {
      setError(`Fichier trop lourd (max ${MAX_CUSTOM_MUSIC_BYTES / 1024 / 1024} Mo).`);
      return;
    }
    setError(null);
    const dataUrl = await readAsDataUrl(file);
    onChange({ kind: "custom", name: file.name.replace(/\.[^.]+$/, ""), dataUrl });
  };

  const current = value.kind === "track" ? value.id : value.kind;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Chip active={value.kind === "none"} onClick={() => onChange({ kind: "none" })} disabled={disabled}>
          <VolumeX className="w-3.5 h-3.5" /> Aucune
        </Chip>
        {MUSIC_TRACKS.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-center rounded-lg border text-sm transition-colors",
              current === t.id
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border bg-background-elevated text-muted-foreground hover:border-primary/50",
            )}
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange({ kind: "track", id: t.id })}
              title={t.hint}
              className="pl-3 pr-1.5 py-1.5 hover:text-foreground disabled:opacity-50"
            >
              {t.label}
            </button>
            <button
              type="button"
              onClick={() => toggle(t.id, t.src)}
              title={playing === t.id ? "Arrêter l'écoute" : "Écouter"}
              className="pr-2.5 pl-1 py-1.5 text-muted-foreground hover:text-primary"
            >
              {playing === t.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
          </div>
        ))}
        <Chip
          active={value.kind === "custom"}
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          title="MP3, M4A, WAV… (8 Mo max). Vérifie que tu as les droits sur la musique."
        >
          <Upload className="w-3.5 h-3.5" />
          {value.kind === "custom" ? value.name.slice(0, 24) : "Importer"}
        </Chip>
        {value.kind === "custom" && (
          <button
            type="button"
            onClick={() => toggle("custom", musicSrc(value))}
            className="text-muted-foreground hover:text-primary"
            title={playing === "custom" ? "Arrêter l'écoute" : "Écouter"}
          >
            {playing === "custom" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        )}
        <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={onFile} />
      </div>
      {volume != null && onVolumeChange && value.kind !== "none" && (
        <label className="flex items-center gap-3 text-xs text-muted-foreground">
          <Music className="w-3.5 h-3.5" />
          Volume
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="w-40"
          />
          <span className="w-9 tabular-nums">{Math.round(volume * 100)} %</span>
        </label>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {value.kind === "custom" && (
        <p className="text-[11px] text-muted-foreground-dim">
          Musique importée : « {musicLabel(value)} ». Assure-toi d&apos;avoir le droit de l&apos;utiliser.
        </p>
      )}
    </div>
  );
}
